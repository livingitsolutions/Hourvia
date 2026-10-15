# PostgreSQL baseline and proposed hardening

`db/schema.ts` describes the baseline Drizzle schema. `netlify/database/migrations/20261014193353_wise_hawkeye` contains generated SQL and its snapshot. The supplied platform state reports that migration already applied to the preview branch; neither preview nor production was queried in Sprint 0.2. Preserve both files exactly. Runtime code still does not query these tables. The baseline does not contain the mandatory hardening below. See the [current-state addendum](sprint-0-current-state-addendum.md), [forward-only design](forward-only-hardening-design.md), and [isolated integration-test plan](database-integration-test-plan.md). No new migration was authored or executed by this design sprint.

## Ownership and keys

UUIDs identify entities globally; tenant-owned rows carry non-null `workspace_id`. `users` and `external_identities` are global exceptions; the `workspaces.id` root itself is the tenant identifier. Global user identities do not convey membership. The workspace owner is a global user foreign key, not an authentication-provider-specific identifier. Business accounts do not duplicate users.

| Table | Context / ownership | Key relationships and constraints |
| --- | --- | --- |
| users | Identity, global | UUID PK; display name; default IANA timezone; UTC creation |
| external_identities | Identity, global | User FK; unique verified `(issuer, subject)`; never store credentials |
| workspaces | Tenant root | User owner FK; PERSONAL/BUSINESS enum; lifetime partial unique PERSONAL owner index |
| memberships | Workspace & Membership, tenant | UUID PK; unique `(workspace, user)` and `(workspace, id)`; at most one OWNER via partial unique index; owner ACTIVE check; exact matching-owner existence is deferred hardening |
| clients | Projects & Clients, tenant | UUID PK, unique `(workspace, id)`; archive instead of destructive delete |
| projects | Projects & Clients, tenant | UUID PK, unique `(workspace, id)`; optional composite client FK prevents cross-tenant link |
| active_timers | Time Tracking, tenant | PK `(workspace, user)` enforces timer concurrency; composite member/project FKs; idempotency key |
| time_entries | Time Tracking, tenant | Immutable finalized base; composite member/project FKs; UTC bounds and integer-second duration check; idempotency uniqueness |
| adjustments | Time Adjustments, tenant | Immutable full replacement; composite base-entry, actor, project FKs; unique `(workspace, entry, revision)`; positive revision and nonempty reason |
| timesheets | Timesheets, tenant | User member FK; local-date period and IANA timezone; version/status; exact period unique; positive version and ordered period check |
| timesheet_entries | Timesheets, tenant | Composite sheet/entry FKs; current effective revision/duration assignment; one entry in one sheet |
| timesheet_submissions | Timesheets, tenant | Append-only sheet/version key; submitted user, period, timezone and UTC timestamp snapshot |
| timesheet_submission_entries | Timesheets, tenant | Composite submission-version and base-entry FKs; full effective entry values retained for each historical submission |
| approvals | Approvals, tenant | Exactly one composite adjustment/sheet target; sheet target-version FK to submission; actor membership FK; one decision per adjustment and terminal decision per sheet version |
| audit_events | Audit, tenant | Actor global-user FK; polymorphic entity reference; request UUID; UTC timestamp; JSON metadata; tenant attribution, allowlisting, and append-only enforcement are proposed, not baseline guarantees |

Reporting owns a future read projection, not duplicate authoritative time tables. Invitations and provider credential/session storage are outside Sprint 0 and not modeled prematurely. Roles remain membership data, never token claims.

All tenant-to-tenant FKs include workspace ID, even when global UUID uniqueness might appear sufficient. Foreign keys use restrictive deletion behavior; no cascade destroys audit or correction history. Keep removed membership tombstones so finalized historical member links remain valid. Current domain removal is terminal; reinvitation/reinstatement requires a later lifecycle policy and cannot be implemented by inserting a duplicate membership.

`timestamptz(3)` stores absolute instants; its session rendering may be non-UTC. Database adapters must serialize to canonical UTC ISO strings and run with UTC session configuration. Domain parsing accepts only normalized strings. Dates are deliberately wall-calendar values only for timesheet period boundaries. IANA zone validation occurs at the value-contract boundary, with database hardening to follow. No SQL timezone conversion should substitute a numeric offset for an IANA zone.

## Query indexes

- Global identity lookup: unique issuer/subject; identity user index.
- Workspace lookup: PK and owner index; one lifetime personal workspace per owner, even when archived.
- Workspace discovery: membership `(user_id, status)` plus unique tenant/user lookup. Mutations must still recheck inside a transaction.
- Project/client browsing: tenant/name client index and tenant/client project index.
- Time reports: `(workspace_id, user_id, started_at)` and `(workspace_id, project_id, started_at)`. Queries always include tenant equality and a bounded range.
- Corrections: unique tenant/entry/revision supports ordered revision reads.
- Approval lookup: partial adjustment decision uniqueness and tenant/sheet/version terminal uniqueness; tenant/sheet/time review index.
- Timesheet review queue: `(workspace_id, status, period_start)` plus exact user-period uniqueness.
- Audit: `(workspace_id, occurred_at)` and `(workspace_id, entity_type, entity_id, occurred_at)` for bounded timelines.

Indexes are proposals encoded in schema metadata, not verified query plans. Add indexes only from real workload evidence. Bulk reports need pagination/range limits and explain-plan review before release.

## Transaction boundaries (future implementation)

| Operation | Atomic work and contention strategy |
| --- | --- |
| Create workspace | Check global identity; insert workspace + OWNER membership + audit. Personal uniqueness violation becomes a domain conflict, never two workspaces. |
| Change membership / ownership | Lock workspace and affected membership rows; verify privileges; prevent owner removal; atomically transfer old/new owner roles and owner FK; audit. Deferred owner checks support the transition. |
| Start timer | Recheck active membership; validate scoped project; insert timer with unique workspace/user and idempotency key; audit. Unique violation resolves concurrent starts. |
| Stop timer | Lock active timer; verify member and timesheet locks; compute server UTC stop/duration; insert immutable entry + delete timer + audit; replay retries from committed entry idempotency key. |
| Request correction | Lock base entry; reject locked-period impact and another undecided request; allocate next revision; validate scoped replacements; insert immutable adjustment + audit. |
| Decide correction | Lock base entry and adjustment; recheck reviewer membership/permission and no self-review; verify revision and locked-period impact; append decision + audit. |
| Submit timesheet | Acquire stable user/workspace period lock, validate no intersecting active timer/undecided correction, lock relevant entries; materialize effective snapshots; version/state update + audit. |
| Approve/reject/reopen sheet | Lock sheet and relevant version; recheck reviewer; append decision; increment version for reopen/rejected-to-draft; preserve old snapshots; state update + audit. |
| Read reports | One read statement uses effective projection at a consistent snapshot; multi-query export uses read-only repeatable-read snapshot. Approved-sheet exports use submitted snapshots, not current effective revisions. |

Cross-cutting: every mutation scopes rows by tenant; reads authorization membership again under the transaction lock; rejects revoked membership; correlates audit with server request UUID; writes idempotency and audit atomically; maps unique/version conflicts to safe application errors. Use a consistent lock order: workspace/member -> user-period coordination -> sheet -> entry -> adjustment/timer. A stable advisory transaction lock keyed by workspace/user serializes entry/correction/timer and period operations when absence of rows otherwise leaves a race. Transaction retries must be bounded and repeat the entire idempotent transaction. Membership administration must share the workspace/member locking strategy to avoid check/write races.

## Mandatory hardening before persistence release

The following are **not enforced by the baseline source schema/migration**. Live database state and effective privileges are unverified; this is not a claim about every rule that might exist outside the repository:

1. Deferred constraint triggers requiring exactly one owner membership matching `workspaces.owner_id`, and personal owner-only membership. The current indexes enforce *at most* one owner, not existence/cross-row identity equality.
2. Append-only database privileges/triggers for finalized entries, adjustments, decisions, and audit. TypeScript readonly is not database immutability. Safe retention/redaction needs a separately authorized policy.
3. Submitted/approved period exclusion, mutation locks, user alignment of timesheet entries, effective-revision validation, and append-only privileges/triggers for the proposed historical `timesheet_submissions` and `timesheet_submission_entries`. Current assignment rows cannot substitute for historical snapshots. Snapshot project labels may need their own immutable values if exact historical display names are required; the schema currently snapshots classification IDs and time values.
4. Nonoverlapping timesheet periods through a reviewed exclusion constraint (`workspace`, `user`, `daterange`) and appropriate extension availability, or a locked transactional alternative. Exact-range uniqueness alone does not prevent partially overlapping periods.
5. One pending correction per entry, sequential revision allocation, approval target-version validation, nonempty rejection/reopen reasons, and no self-approval. Cross-row policies require transactions or triggers beyond ordinary checks.
6. An approved effective-entry SQL projection and tenant-scoped reporting adapter. No view or report query exists yet.
7. IANA timezone validation and canonical row-to-domain mappers. PostgreSQL itself does not restrict text timezone fields to recognized IANA names.
8. Reviewed database-role grants, transaction-local tenant context, and PostgreSQL row-level security as defense in depth where the Netlify adapter/role supports it. RLS is not assumed active, and must not replace server-side authorization. Verify pooled-connection context reset before enabling it.
9. Persistent idempotency response records for operations other than timer stop/start. The current timer/entry keys do not solve every retry workflow.
10. Integration tests against an explicitly approved isolated database branch for constraints, races, lock order, and revocation. Current tests inspect schema metadata only.

The original report's no-migration statements described the implementation session; the current repository and preview application report are reconciled above. Sprint 0.2 executed no DDL, generated no migration, and made no database connection. Any approved implementation must use new forward-only migration files, retain the applied baseline byte-for-byte, and prove role, trigger, transaction, and pooling assumptions on an isolated branch before persistence release. Deployment of the scaffold must not be mistaken for activation of database workflows.
