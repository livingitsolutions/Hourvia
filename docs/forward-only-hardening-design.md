# Proposed forward-only PostgreSQL hardening

Date: October 14, 2026. Status: **DESIGN ONLY**; governed by [ADR 0006](adr/0006-forward-only-foundation-hardening.md). No executable migration file or schema change was created. The names below describe proposed objects, not existing objects.

## 1. Baseline, threat boundary, and cutover

Preserve `20261014193353_wise_hawkeye/migration.sql` and `snapshot.json` exactly. Do not regenerate, rename, delete, edit, or replay the applied migration. Future implementation must add new migration files and corresponding schema metadata, retaining baseline checks, unique keys, and foreign keys. Custom trigger/function/privilege objects must remain explicitly tracked by the new migration history; schema generation must not silently drop them.

Before any separately approved hardening, inspect an isolated branch for every existing workspace's owner/membership state; duplicate or reassigned personal slots; audit actor/tenant consistency; privilege/role attributes; triggers/policies; installed PostgreSQL version/extensions; and migration lineage. Identify orphan/mismatched historical rows and stop rather than silently repair or invent audit attribution. New deferred triggers alone do not retrospectively validate untouched old rows.

Plan a controlled write-free cutover, bounded lock/statement timeouts, transactional function/trigger/grant installation, and explicit validation of added constraints. A `NOT VALID` foreign key can stage historical verification but is not completion evidence until validated. Repair of existing data, if ever needed, requires separate review and authorization. Rollback means disabling the affected feature and adding a corrective forward migration, not weakening a proven invariant or rewriting history.

Trust boundaries: the HTTP/service adapter validates identity; the database independently enforces persisted structure, transaction/audit integrity, and permitted operation shape. A shared runtime DB credential plus caller-supplied user/GUC is not cryptographic proof of identity. Backend compromise, migrator/table-owner abuse, and superuser trigger disabling are outside the ordinary runtime protection guarantee and require separate credential/access controls.

## 2. Workspace and Membership invariants

For every committed workspace, including archived workspaces:

- Exactly one membership has role OWNER; that row is ACTIVE and its user equals `workspaces.owner_id`.
- A PERSONAL workspace has exactly one total membership: that active matching owner. Suspended/removed additional rows are not permitted exceptions.
- A workspace's ID and type never change. A PERSONAL workspace's owner never changes and its lifetime row is never physically deleted or truncated. Archival does not release its owner slot.
- Membership ID, workspace ID, and user ID never change after creation. Membership physical deletion is denied; BUSINESS removal keeps a tombstone. No generic role/status update grants OWNER or transfers ownership.

Retain the existing lifetime PERSONAL-owner index, membership workspace/user uniqueness, at-most-one OWNER index, OWNER-active check, and timestamp checks. The lifetime index becomes sufficient for the chosen slot policy only alongside immutable personal type/owner and retained root rows. User/account deletion is logical disable, not deletion of referenced lifetime/history rows. PERSONAL-to-BUSINESS conversion is not supported; a user may separately create BUSINESS workspaces.

### Constraint and trigger specification

| Proposed control | Timing/events | Required behavior |
| --- | --- | --- |
| Workspace identity/personal-slot guard | BEFORE UPDATE/DELETE on workspaces; BEFORE TRUNCATE statement guard | Deny ID/type mutation, PERSONAL owner mutation, personal deletion, and runtime truncation; business owner changes only through restricted transfer operation |
| Membership identity/tombstone guard | BEFORE UPDATE/DELETE; TRUNCATE guard | Deny identity/scope reassignment, physical deletion, and generic OWNER changes; supported operations never disable/remove an owner |
| Workspace consistency constraint trigger | AFTER INSERT/UPDATE on workspaces, FOR EACH ROW, DEFERRABLE INITIALLY DEFERRED | Read the final state and require exactly one ACTIVE matching OWNER and PERSONAL owner-only membership |
| Membership consistency constraint trigger | AFTER INSERT/UPDATE/DELETE on memberships, FOR EACH ROW, DEFERRABLE INITIALLY DEFERRED | Recheck the affected workspace's final state; reject extra PERSONAL memberships and ownerless/mismatched commits |
| Membership/workspace write backstop | Immediate trigger | Take the workspace-root lock for alternate permitted write paths; reject unsupported context. This is a safety backstop, not a substitute for acquiring locks before DML |

Deferred checks allow workspace creation and business owner transfer to have temporary internal states within one transaction, but never at commit. They query current final rows rather than trusting the triggering OLD/NEW snapshot alone. They must see all relevant tenant rows; an RLS-filtered count must never masquerade as invariant verification. A dedicated non-login invariant-check role gets only the required read visibility through explicit policies/privileges, not general bypass powers.

Constraint triggers can fire repeatedly for one workspace; checks must be idempotent. Existing at-most-one-owner uniqueness stays immediate. A proposed business transfer therefore locks all participants, verifies the current owner and ACTIVE target membership, demotes the old owner, updates the root owner, then promotes the target, before final audit/commit. This ordering avoids inserting a second OWNER while retaining the existing index. It is not permitted for PERSONAL workspaces, generic admins, or removed/suspended targets; exact resulting old-owner role requires senior policy approval.

## 3. Privilege model and operation boundaries

Proposed separate roles: a trusted migration/table-owner role, a non-login operation-function owner, a narrowly scoped invariant-check role, and an application runtime login role. Runtime is not a table owner, superuser, or BYPASSRLS role and cannot assume the other roles. No role credentials are documented here.

Runtime receives only required schema usage and execution on named operations/read functions, not direct INSERT/UPDATE/DELETE/TRUNCATE on workspaces, memberships, tenant business rows, audit, obligations, or deduplication tables. Avoid generic functions accepting arbitrary SQL, entity types, role strings, or unrestricted column updates. PUBLIC execute is revoked in the same transaction as SECURITY DEFINER function creation; function owners have only their operation's required privileges. Fully qualify relations and use a fixed trusted search path with untrusted temporary schemas last; deny runtime schema/object creation and role/grant/trigger alteration.

Each operation validates a server-authenticated principal, tenant selector, action-specific permission, target user/resource ownership, allowed lifecycle transition, and trusted operation context. A plain FK proving membership existence never proves ACTIVE membership or permission. If SECURITY DEFINER is used, review its effective RLS behavior and owner privileges; do not assume definer code is automatically tenant safe.

The HTTP adapter never accepts actor/owner/role from a general workspace body. Provisioning derives owner from verified identity. Membership administration is a separate command: only an explicitly authorized BUSINESS owner may create an ADMIN/MEMBER/VIEWER membership for an already verified target/invitation acceptance; no arbitrary email-to-user linkage, PERSONAL invitation, or generic OWNER grant. Invitation acceptance and reinvitation remain separate future policies; existing removed membership is not bypassed by deleting/reinserting its row.

## 4. Atomic provisioning and tenant writes

Baseline isolation for supported mutation transactions is READ COMMITTED plus explicit locks. Every operation establishes transaction-local trusted user, workspace, session, logical operation ID, and canonical audit-event ID; context comes from server validation, never request JSON. No session-level tenant setting survives a request.

Conservative lock order for every cooperating operation:

1. Involved global user/account rows in ascending UUID order; then involved application-session rows in ascending ID order. Recheck account status, auth epoch, revocation, and expiry.
2. Workspace root rows in ascending UUID order; then involved membership rows in ascending user UUID order. Recheck archive state, ACTIVE status, permission, and target policy.
3. Persistent request/deduplication lookup; then future user-period coordination, sheet, entry, adjustment/timer resources in documented stable order.

Lock roots with FOR UPDATE for the initial correctness-first design. FOR KEY SHARE is not sufficient protection against ordinary membership-status updates. Procedures must acquire roots before DML: a BEFORE trigger may execute after a target tuple has already been locked, so arbitrary direct statements can invert ordering and deadlock. Direct runtime DML is denied; privileged maintenance follows an approved write-free window. Deadlocks still abort safely and receive bounded whole-operation retry handling.

For personal provisioning, the existing global user row is the stable lock even when the personal workspace does not yet exist. In one transaction: revalidate verified identity/account; claim or inspect the request; discover the lifetime slot; insert workspace and matching ACTIVE OWNER membership; append audit; store the deduplicated response; force/check deferred constraints; commit. Concurrent distinct-key requests converge on the existing lifetime workspace rather than create another; an archived slot is returned as archived/conflict according to reviewed product policy, never replaced. Workspace and owner creation cannot be split across connections/transactions.

Business operations follow the same protocol. Audit insertion failure, constraint failure, authorization revocation, or request conflict rolls back the entire mutation. No network email/provider callback occurs while holding these locks; external side effects, when approved, require a persisted transactional outbox and their own delivery idempotency.

## 5. Revocation and tenant-scoped repositories

Membership suspension/removal and permission changes acquire the same user/workspace/member locks as business writes. If revocation obtains the locks and commits first, the subsequent write rechecks and is denied. If a valid write obtains them first, it may commit before revocation; revocation waits. The promised boundary is database linearization, not retroactively undoing a completed operation. Self-removal/owner removal is not enabled by this generic protocol.

Global disable/session revocation updates account auth epoch or session revocation under the same account/session locks. An earlier HTTP authentication result is never enough to authorize a later write. Provider-only remote revocation cannot be serialized by local PostgreSQL locks; authoritative online provider validation and a documented maximum propagation window are addressed in the [authentication design](authentication-design.md).

Repositories receive an authorized scope from the application, not a raw tenant selector as proof of access. Every tenant read/write, relationship check, list/count/export, conflict lookup, and RETURNING result explicitly constrains workspace ID; owned actions additionally constrain the authenticated resource user. Avoid ID-only lookup followed by unchecked mutation. Global identity mapping is a separate narrowly privileged repository.

Read operations combine account/session validity, ACTIVE membership, archive/permission checks, and scoped resource selection in one statement snapshot. A read that starts before revocation may complete using that snapshot; a new statement after committed revocation must deny. Long-running exports require a reviewed snapshot/revocation policy, not an assumed forever-valid initial authorization. Row mapping validates canonical UTC, recognized timezone, enums, branded IDs, and immutable domain contracts.

## 6. Audit attribution and mandatory audit obligations

Add a unique audit key `(workspace_id, id)` and a deferred composite FK from `(audit_events.workspace_id, actor_id)` to `(memberships.workspace_id, user_id)`, after historical preflight. Membership tombstones preserve historical links. An event insertion guard checks actor equality with trusted operation context, current account/session validity, ACTIVE actor membership, allowed action/entity kind, bounded metadata schema, and the entity's tenant. Provider claims, body metadata, and client request IDs cannot manufacture an audit principal.

Bootstrap creates membership before audit in the same transaction. Revocation of another user is attributed to the authorized actor, not the target. Operations that remove their own actor membership are not supported without a separately reviewed pre-state authorization rule. Background/system and global identity events must use a separately modeled service/global security event trail, not a fake global user or invented tenant membership.

Polymorphic entity IDs cannot receive one universal FK. Each fixed operation resolves its entity within the workspace and constructs server-side event data. Creation/archive events retain stable entity IDs; destructive deletion is not enabled. Allowlist metadata per operation, bound bytes/depth/array lengths, omit secrets/credentials/raw tokens/passwords/provider payloads, and separate user-entered text from security assertions. Corrections to history are new compensating events, not rewriting old metadata.

### Database-level atomicity proposal

For protected foundation tables, add immediate write triggers that record an internal append-only `mutation_audit_obligations` row containing workspace ID, canonical audit-event ID, entity kind/ID, and operation kind from validated operation context. Deny a write if context is absent or scope is inconsistent. The trigger must capture context immediately; a deferred trigger must not read a possibly changed GUC and attribute an earlier write to a later operation.

Each obligation has a composite FK `(workspace_id, audit_event_id)` to audit `(workspace_id, id)`, DEFERRABLE INITIALLY DEFERRED. An operation can write business rows first and its canonical audit envelope last, but cannot commit an unaudited protected write. Multiple row changes can reference one canonical operation event; obligations identify affected rows, so every operation need not create misleading per-row user events. Different logical commands in one transaction require separate explicit operation contexts/events. Protected-table coverage is enumerated in each new migration and expanded before any later business table is activated.

Revoke direct runtime INSERT as well as UPDATE/DELETE/TRUNCATE on audit/obligation tables; expose only the controlled writer and scoped readers. Reject audit and obligation UPDATE/DELETE with row triggers, and TRUNCATE with statement triggers. Apply the same principle to committed request results. No ON DELETE CASCADE destroys this history. FK, obligation, and event checks are evaluated before returning success; an audit failure aborts the business operation. This is integrity against ordinary runtime writes, not tamper-evident protection against a database administrator.

## 7. Persistent retries and idempotency

Propose a `mutation_requests` table in Netlify Database with authenticated actor, scope kind (GLOBAL_PROVISION or TENANT), scope ID (actor for bootstrap; workspace otherwise), fixed operation name, UUID idempotency key, canonical request hash, logical operation ID, resulting workspace, bounded response status/payload, canonical audit-event ID, and committed timestamp. A composite result/audit FK preserves tenant attribution. Unique `(actor, scope_kind, scope_id, operation, idempotency_key)` prevents duplicate logical results; payload hashes exclude credentials and include normalized route/action, tenant, target, and business input.

The table records completed results only, inserted in the business transaction after mutations/audit. No independently committed IN_PROGRESS marker, process-local map, or JSON file is used. The shared user/workspace locks serialize duplicate operations; a unique-conflict loser must roll back all its changes and re-read the winner in a new transaction. The same key/hash returns the original allowed response; a changed hash returns safe 409 without changing data. A distinct key for personal provisioning still finds the immutable existing slot.

Every replay authenticates and authorizes again; a removed/disabled actor does not receive cached privileged output. Completed request records are immutable; the initial proposal retains them for the relevant operation's lifetime. Any future TTL requires an approved replay/tombstone strategy so expiry cannot turn an old request into a second write. Response payloads contain no tokens or personal data beyond the original authorized operation's minimum result.

Retry only whole idempotent transactions for approved transient serialization/deadlock/transport errors, with a proposed maximum of three total attempts and bounded exponential jitter within the function timeout. Reauthenticate/recheck state on each attempt, reuse the same logical request key/hash, and never retry validation/authorization failure as a transient success path. An uncertain COMMIT outcome is resolved by a fresh authorized deduplication lookup, not an unconditional second mutation. All attempts produce at most one committed business result and canonical audit event.

## 8. Optional RLS and connection-pooling assumptions

RLS is a proposed second fence, not currently claimed active. Policies for each tenant relation use both USING and WITH CHECK against a fail-closed, transaction-local workspace setting; roots use their ID, descendants their workspace ID. Missing/empty/malformed context must deny or error, never select every tenant. Global users/identity/session tables require separate access rules and cannot inherit a tenant-column policy.

A tenant setting is asserted by trusted backend code and is not an unforgeable authenticated identity. Persisted membership/session checks remain in fixed operations and scoped reads. Avoid recursive membership policies: use simple tenant fencing plus explicitly authorized repository/procedure checks, rather than a membership policy that recursively queries itself. Any helper requiring broader visibility must have tightly limited read-only purpose and execution privileges.

Runtime and operation-function roles must not own/bypass protected tables where RLS is expected. If table-owner paths are necessary, evaluate FORCE ROW LEVEL SECURITY and explicit invariant-helper visibility. TRUNCATE is not row-filtered by RLS; deny it with privileges/triggers. Security-definer policy behavior, column permissions, cross-tenant FK error leakage, and pooled-context reset require separate tests.

The installed native Drizzle adapter's source shows callback transactions acquiring a pool client and using that client through BEGIN/COMMIT/ROLLBACK/release; ordinary calls use a separate HTTP query path. This source observation is not proof that deployed WebSockets/transactions, rollback-on-failure, or tenant context work. Put context setup and every dependent statement on the same transaction handle; independent `sql`/HTTP calls with session SET are forbidden. Use transaction-local `set_config(..., true)` rather than session SET. A single secured server-side operation call is a possible fallback only if its entire execution is one transaction and all privilege/authorization guarantees remain intact.

Verify on the isolated branch: actual PostgreSQL version; supported custom roles and SECURITY DEFINER; schema/function creation permissions; effective PUBLIC grants; runtime table-owner/superuser/BYPASSRLS attributes; ability to prohibit SET ROLE, trigger disabling, replication-role changes, and TRUNCATE; driver transaction transport; connection checkout/rollback/release; transaction-local context reset after success/failure/cancellation; statement/lock timeouts; and optional RLS policy behavior. If any mandatory capability cannot be demonstrated, do not replace it with an unrestricted privileged connection: keep persistence disabled and request redesign.

## Primary technical references

Verified as accessible primary sources on October 14, 2026; version-specific PostgreSQL behavior must be checked against the branch's actual server version before implementation. These references support PostgreSQL mechanism semantics, not live Hourvia configuration:

- PostgreSQL 18 CREATE TRIGGER: `https://www.postgresql.org/docs/18/sql-createtrigger.html` — deferred constraint triggers and event timing.
- PostgreSQL 18 Explicit Locking: `https://www.postgresql.org/docs/18/explicit-locking.html` — lock conflicts and ordering.
- PostgreSQL 18 CREATE FUNCTION: `https://www.postgresql.org/docs/18/sql-createfunction.html` — definer search path and default PUBLIC execution.
- PostgreSQL 18 Row Security: `https://www.postgresql.org/docs/18/ddl-rowsecurity.html` — owner/BYPASSRLS behavior, policies, and non-row-filtered operations.
- Installed `drizzle-orm/netlify-db/session.js` and `driver.js` from the locked beta.22 package — offline source evidence only; no client factory was invoked.
