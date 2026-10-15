# HOURVIA — Sprint 0.3A final report

Date: October 15, 2026. Verdict: **BLOCKED** for migration application and protected persistence activation. The review candidate and isolated tests were implemented; PostgreSQL enforcement has not been demonstrated. No database connection, migration application, baseline replay, provider integration, business endpoint activation, build command, deployment, commit or push occurred. Sprint 0.3B and Sprint 1 were not begun.

## 1. Baseline migration integrity

The supplied platform state records `20261014193353_wise_hawkeye` as applied to the preview branch. Offline fingerprints matched the Sprint 0.2 current-state addendum before and after implementation:

| Immutable file | Recorded and verified SHA-256 |
| --- | --- |
| migration.sql | `e0d7439b120175b4cff1fd890af2ba9ccb8e3ec6030d4f5ca992ff9c43f96e8e` |
| snapshot.json | `0aee1b8a6b37ec228074537c6b2442836095722b909f282034991b10bb31e12c` |

Neither file was edited, renamed, deleted, regenerated or replayed. This verifies repository bytes, not live production schema or migration state.

## 2. Files created/modified

Modified `db/schema.ts` with candidate request/obligation metadata and audit uniqueness. Created `db/candidates/20261015010000_harden_foundation.sql`, its quarantine README, the dormant `src/infrastructure/database/foundation-transactions.ts` adapter and its transport unit tests, `tests/hardening-candidate.test.ts`, `tests/postgres/foundation.integration.test.ts`, its isolated-run README, this report, and `.netlify/results.md`.

No package, hosting configuration, authentication implementation, handler, applied migration or snapshot changed. Candidate metadata is deliberately ahead of the installed database; no active caller uses it. Deferred FKs and custom controls are SQL-owned. Promotion must reconcile a new snapshot without modifying the applied snapshot; ordinary generation is blocked in the interim.

## 3. Forward-only migration design

Candidate ID: `20261015010000_harden_foundation`. Candidate SQL fingerprint: `f8dc17ea92cd4bfcf3edb0c80c02f0ff1612bcea24b27cfeaf56c59eafedd221`.

The SQL is quarantined outside Netlify's automatic migration directory because previews also automatically apply migrations. It is not an automatically deployable migration. Senior-approved promotion is a separate action. The candidate uses one transaction, bounded lock/statement timeouts, separated-role preconditions, exclusive cutover locks, historical owner/personal checks, and validated audit-actor FK installation. Historical polymorphic audit entities outside workspace/membership require separate review and stop installation. No historical data is silently repaired.

New objects include request and audit-obligation tables, an obligation index, audit uniqueness and deferred actor FK, immediate identity/history/context guards, deferred owner/attribution checks, and fixed command/read functions. Existing immediate owner/personal indexes, owner-active checks, tenant FKs and restrictive deletion behavior remain intact. No business-feature tables become writable by runtime.

## 4. Database ownership enforcement

Every committed workspace requires one ACTIVE OWNER matching the root owner; PERSONAL requires exactly one total membership, regardless of extra-row status. Deferred checks read final state rather than the triggering row's historical state. Immediate guards preserve workspace ID/type/owner and membership identity, deny owner role toggles, retain roots/membership tombstones, and prohibit TRUNCATE. This deliberately denies BUSINESS transfer too until a separately reviewed operation exists.

Workspace creation inserts the root, then its matching owner membership, then audit and request result in one transaction. Existing immediate FKs therefore remain satisfied; final owner checks wait until transaction completion. The immediate at-most-one-owner index remains unchanged. Checks do not depend on alphabetical ordering between deferred FK and constraint-trigger events. Both possible audit failure mechanisms abort safely.

Triggers on different timing/event classes do not use names as an authorization boundary. Immediate capture runs after insertion, so the inserted root exists when locked; arbitrary privileged DML may still invert tuple/root lock order. Runtime direct DML is denied, fixed operations lock before DML, and maintenance requires a write-free window. Deferred owner and audit-attribution helpers use narrowly restricted SECURITY DEFINER ownership because commit-time execution can occur after the command function restores the runtime role. Fully qualified relations and fixed `pg_catalog,public,pg_temp` search paths exclude untrusted object creation.

## 5. Audit integrity enforcement

Audit events, obligations and completed requests reject UPDATE/DELETE and statement TRUNCATE. Runtime has no direct INSERT permission either. Tenant audit actors reference membership tombstones through a validated deferred composite FK. Immediate audit guards require operation-derived actor/workspace/event/request/action context, an ACTIVE actor, fixed supported entity/action combinations, an entity inside the workspace and empty allowlisted metadata.

Every workspace/membership INSERT or UPDATE captures an immutable obligation immediately, including actor, request and action. Deferred audit existence/attribution checks prevent a commit without the canonical tenant event. One provisioning event may cover both root and owner rows. Protected coverage is limited to foundation workspaces/memberships; later business writes require explicit extension before activation. New system/global identity actor models are not fabricated here. DBA/table-owner abuse is outside the ordinary runtime guarantee.

## 6. Transaction and locking implementation

The dormant Netlify native-pool adapter checks out one client, runs BEGIN, local timeouts, fixed parameterized commands, deferred validation and COMMIT, then releases. Failures roll back; a failed rollback discards the connection. Results leave only after commit succeeds. It never mixes HTTP SQL with pinned-connection statements.

Commands lock existing global user rows in UUID order, then workspace and actor/target memberships. The global user lock serializes personal creation before a root exists. Rename and owner-authorized BUSINESS revocation share these locks. Revocation-first denies the later write; write-first may commit before removal, after which replay denies the removed actor. Only OWNER/ADMIN can rename; only BUSINESS OWNER can revoke another ACTIVE non-owner. A single scoped read statement combines workspace and ACTIVE membership access.

Persistent request rows use actor/scope/operation/key uniqueness, a database SHA-256 of normalized command data, resulting workspace/audit and completion time. Same-key replays reauthorize and return the original result; changed inputs deny. Distinct personal keys resolve the retained slot; archived slots deny. Existing-slot PROVISION events describe slot resolution. Request history has no expiry. Whole-transaction retries are bounded to three attempts for known-aborted serialization/deadlock SQLSTATEs. Unknown commit/transport outcomes propagate and require a new authorized same-key resolution rather than blind mutation retry.

No user-disable/auth-epoch/session tables exist in the baseline. Local account/session and provider revocation remain outside this dormant adapter and block activation. Actor IDs are trusted backend inputs, not cryptographic identity attestations; functions/GUCs do not turn a shared credential into a user-authentication boundary.

## 7. Integration tests added

Fifteen real-PostgreSQL cases cover atomic provisioning; same-key and distinct-key concurrent personal creation on fresh actor rows; mismatched owner at deferred validation; extra ACTIVE/SUSPENDED/REMOVED personal memberships; personal slot/type/owner/role retention; runtime direct-write denial; foreign-tenant audit entities/actors and actual foreign-tenant client references; audit modification/deletion/truncation; missing-audit and explicit rollback; duplicate/conflicting payloads and retry after rollback; transaction-local context reset after commit/rollback; later audit failure rolling back preceding mutation; and both revocation lock orders with denied post-removal replay.

Two-connection race schedules observe `pg_blocking_pids` as the barrier, rather than inferring ordering from sleeps. Runtime commands use actual runtime login credentials; isolated maintenance credentials prepare fixtures and test structural backstops. Default tests skip without explicit isolated authorization and both dedicated URLs. URL and connected-database names require a disposable prefix. The harness installs no schema or migrations and retains fixture history until the disposable database is discarded.

## 8. Actual test results and unexecuted gates

| Check | Actual result |
| --- | --- |
| TypeScript typecheck | PASS |
| ESLint, zero warnings | PASS |
| Vitest offline tests | PASS: 104 tests, 7 files; includes architecture and disabled-health checks |
| PostgreSQL suite | **NOT RUN: 15 cases skipped**, no isolated database authorization |
| Applied SQL/snapshot fingerprint tests | PASS |
| Automatic migration quarantine test | PASS; only applied baseline present |
| PostgreSQL SQL syntax parsing | PASS: 67 statements with pglast/libpg_query |
| PL/pgSQL syntax parsing | PASS; parser accepted function bodies/DO blocks |
| Whitespace diff validation | PASS |
| Live catalog/type resolution, function installation/privileges, historical preflight, races, constraints, rollback, pooling and context reuse | **NOT RUN** |
| Build/deployment/provider/browser checks | **NOT RUN**, outside permitted scope |

Syntax parsing used a temporary external-to-repository parser installation, not a database or application dependency. It does not validate catalog references, role permissions, actual transport or runtime semantics. Transport unit tests use controlled clients solely to check adapter lifecycle; they are not database-enforcement proof.

## 9. PostgreSQL privilege/pooling risks

The installed Netlify driver exposes `getDatabase().pool.connect()`; TypeScript accepts both native/serverless pool variants. Earlier source inspection establishes intended pinned-client transaction support, not actual deployed compatibility. Verify PostgreSQL version, pool driver/transport, WebSocket availability, rollback/cancellation behavior, local-context reset and runtime/function-owner identity on a separately authorized isolated database.

The candidate requires custom separated roles, ownership transfer, trigger creation, table grants and schema control. Function ownership transfer receives temporary schema CREATE in the installation transaction; that permission is revoked before commit. Runtime/operations cannot inherit roles or own protected tables. Actual Netlify ability to satisfy those requirements is UNKNOWN. Effective inherited/column grants, PUBLIC/alternate-schema function execution, database CREATE/TEMP rights, role switching, trigger disabling and replication settings require a catalog privilege audit. No arbitrary existing privilege graph is declared safe from these SQL revokes alone.

RLS is not installed or claimed. Mandatory isolation relies on operation-only privileges and scoped fixed functions; the operations role has the read visibility needed for deferred checks. A separate invariant role or future RLS would require a reviewed visibility design. Shared runtime credentials and caller-supplied actor IDs require a trusted backend and separately approved authentication/session integration before activation. Any unmet role or pooling requirement blocks promotion; do not substitute a privileged application connection.

## 10. Migration rollback/recovery considerations

Installation is transactional: a timeout, invalid historical row, missing role capability or constraint failure should roll back candidate installation. Prove this on the authorized isolated database, including the platform's migration transaction wrapper behavior. Read-only historical preflight, backup/recovery evidence, a write-free cutover, privilege inspection and fingerprint checks precede promotion. Migration lineage for production is still unknown.

After application, recovery uses a new corrective forward migration under review. Do not rewrite either historical migration, drop retained history, release personal slots, or silently invent audit actors. Keep protected persistence disabled while investigating. Backups and separately authorized data repairs are required for preexisting damage; archive/tombstone semantics do not justify deleting records. Retried business transactions preserve request keys; uncertain COMMIT is resolved through authorized durable-result lookup.

## 11. Remaining P0/P1 findings

No active P0 exposure was observed; no protected endpoint was enabled. Existing P1 database findings now have a concrete implementation candidate but remain open until actual constraint, audit, privilege and race proofs pass. P1 gates include isolated database authorization/evidence; Netlify role and pooling compatibility; historical data/privilege audit; approved snapshot reconciliation/promotion; senior approval of retained ownership and slot-resolution audit semantics; account/session/provider revocation implementation before activation; and the prior automatic-build/authentication acceptance gates. The broader Sprint 0.2 risk register remains applicable; this sprint does not close unrelated release findings.

## 12. Sprint 0.3A verdict

**BLOCKED.** Reviewable candidate implementation and offline validation passed. Unexecuted mandatory PostgreSQL tests and unknown platform capabilities prevent a database-enforcement PASS. No observed source-check failure or executed PostgreSQL failure is reported.

## 13. Sprint 0.3B readiness recommendation

Do not begin Sprint 0.3B or Sprint 1. Senior PostgreSQL/security review is requested for the candidate, its role/search-path/trigger semantics, slot and audit policies, snapshot promotion plan and isolated-test protocol. Only after review and separate explicit authorization may an operator prepare the isolated test database or promote/apply a migration. This run stops at that review gate.
