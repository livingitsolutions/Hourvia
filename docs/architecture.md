# Hourvia architecture — Sprint 0

Status: foundation implemented; baseline schema metadata and an immutable generated migration are present. The platform reports that baseline applied to preview; production database state has not been inspected. Authentication and application persistence remain disabled/disconnected. Hardening and authentication architecture below are proposals, not activated protections. See the [current-state addendum](sprint-0-current-state-addendum.md).

## Product model

A global user can own at most one PERSONAL workspace (including an archived one) and participate in multiple BUSINESS workspaces. A workspace is the tenant boundary. Ownership belongs to one global user; membership supplies workspace-scoped access. Personal workspaces permit only the owner membership. Business workspaces have one OWNER and optional ADMIN, MEMBER, and VIEWER memberships. Ownership transfer is a separate future atomic use case, not a role toggle.

## Dependency direction

Presentation and infrastructure depend inward on application contracts and domain types. Application depends on domain. Domain depends only on language/platform value primitives and its own modules. React, HTTP, Zod, Netlify, PostgreSQL, and Drizzle do not appear in domain or application production modules. Unit tests may use test tools and fixtures.

```
src/
  domain/
    shared/                     UUIDs, Result, errors, UTC, timezone, seconds, ports
    identity/                   context charter (no authentication behavior)
    workspace-membership/       Workspace, Membership, immutable transitions
    time-tracking/              context charter
    time-adjustments/           context charter
    timesheets/                 context charter
    projects-clients/           context charter
    approvals/                  context charter
    reporting/                  context charter
    audit/                      context charter
  application/
    identity/                   AuthenticationProvider port
    workspace-membership/       authorization ports and membership policy
  infrastructure/
    authentication/             fail-closed, disabled adapter
    database/                   lazy Netlify/Drizzle factory, not connected
    runtime/                    system clock and UUID adapters
    validation/                 strict Zod HTTP-boundary input schema
  presentation/
    components/                 shared brand and icon primitives
    pages/                      dashboard and placeholder screens
    App.tsx                     shell, hash navigation, session theme
db/schema.ts                    baseline Drizzle metadata, never imported by browser
netlify/database/migrations/     immutable generated baseline; no Sprint 0.2 changes
netlify/functions/health.mts     static health handler; no database or auth calls
tests/                          fixtures, schema metadata and boundary checks
docs/adr/                       architecture decision records
```

Context charters reserve ownership, not speculative implementations. There are no empty service classes, fake repositories, demo accounts, or simulated business records. Future application use cases and adapters belong in their corresponding context directories only when that sprint implements them.

## Bounded contexts

| Context | Owns | Contracts with other contexts |
| --- | --- | --- |
| Identity | Global user and verified external identity mapping | Supplies trusted global user ID; never workspace roles |
| Workspace & Membership | Workspace lifecycle, tenancy, roles, active membership | Supplies authorized workspace scope and permissions |
| Time Tracking | Timer lifecycle and finalized base entries | References workspace, member, optional project |
| Time Adjustments | Append-only replacement revisions and reasons | References base entry, requests approval |
| Timesheets | Local-date periods, entry snapshots, submission and lock state | Consumes effective entries and approval decisions |
| Projects & Clients | Tenant-scoped work classification, archive state | Exposes tenant-safe references, no time calculation |
| Approvals | Immutable review decisions and reviewer policy | Targets adjustment revision or timesheet version |
| Reporting | Read-only effective-entry projection and aggregation | Never independently changes canonical time records |
| Audit | Immutable tenant event trail and request correlation | Appended within successful mutation transactions |

Modules must not directly reach into another context's internals. Use application ports or shared identifier/value contracts. Drizzle describes relational links, not domain dependencies. Initially one deployment and one PostgreSQL database are intentional: a modular monolith avoids premature distributed transactions.

## Request flow (future, not wired)

1. The HTTP adapter validates path UUIDs and strict Zod bodies; rejects unexpected fields and sets request limits.
2. Authentication validates the credential server-side and maps a verified issuer/subject to a global user. It ignores body user IDs and roles.
3. Authorization retrieves the requested workspace and that user's membership from a server-side repository. The workspace ID is a selector, never proof of access.
4. The use case scopes all queries by authorized workspace ID and applies resource ownership and action-specific policies.
5. Writes recheck active membership and locks inside the same transaction as mutation, version increment, idempotency record, and audit event.
6. Domain results map to safe HTTP responses without internal errors or credentials.

The implemented `MembershipAuthorization` tests port orchestration and fail-closed policy. It is not connected to an HTTP business endpoint. `DisabledAuthentication` rejects every credential. No production auth provider is selected or activated; there is no login UI. The only function is a static operational health response, not a DB readiness probe.

## Role baseline

| Permission | OWNER | ADMIN | MEMBER | VIEWER |
| --- | --- | --- | --- | --- |
| Workspace read | yes | yes | yes | yes |
| Workspace management | yes | yes* | no | no |
| Write own time / submit own timesheets | yes | yes | yes | no |
| Review timesheets / read all-workspace reports | yes | yes | no | no |

`*` Ownership transfer, deleting the workspace, granting OWNER, and privileged membership changes require more restrictive future policies. Authorization grants a capability, not arbitrary access to other users' entries. The `:own` permissions require an additional `entry.userId === authorized.membership.userId` check at the use case. Adjustment review requires a separately defined permission before implementation. Personal workspace behavior is owner-only, regardless of generic business role permissions.

## Time policies

UTC instants use canonical `YYYY-MM-DDTHH:mm:ss.sssZ`; reporting keeps the original IANA timezone. The persisted type is `timestamptz(3)`, never a naive wall-clock timestamp. Integer seconds are canonical. Finalized entry duration is `floor((endedAt - startedAt) / 1000)`; UI ticking and display rounding are not authoritative. Zero-second entries are valid; negative and PostgreSQL-integer-overflow durations are rejected.

The proposed timer key `(workspace_id, user_id)` prevents two active timers within one workspace even under concurrent requests. A user may run timers in distinct workspaces; changing to global single-timer semantics would require an ADR. Stopping a timer locks the row and atomically inserts the entry, removes the timer, and appends audit. Retry idempotency must preserve the original response. No timer is persisted or simulated here.

Manual overlapping finalized entries are not prohibited by the foundation; overlap warnings and a rejection policy need product review before manual-entry implementation. Never infer overlap enforcement from the single-active-timer rule.

## Effective-entry semantics (proposed)

A base entry is revision zero and is immutable after finalization. Each correction is a full replacement of start, end, integer seconds, project, description, billable flag, and void status; it is not a duration delta. The original entry timezone and user remain fixed. Revision numbers strictly increase per entry under a transaction lock. A rejected revision still occupies its revision number. Only one undecided revision may exist per entry; enforce this in the future transactional use case.

An effective entry is its highest-revision approved replacement, or its base if none is approved. Pending/rejected corrections do not affect reports. An approved void excludes the entry entirely. Approval is an immutable record; never sum base plus adjustment durations. Normal business reviewers cannot approve their own correction. Personal-owner changes receive an explicit automatic approval record in the same transaction, rather than bypassing history.

Live reporting uses this effective projection at a statement-level database snapshot. Filters use half-open UTC ranges derived from reporting-local boundaries. Attribute the entire entry to its effective **start** local date; do not silently split a midnight-spanning entry. The initial start-attribution policy keeps reports and timesheets consistent. Interval allocation or payroll rounding is a future policy, not implemented. Timezone changes must not change already-approved timesheet snapshots.

## Timesheets and approvals (proposed)

Periods are nonoverlapping local-date ranges `[period_start, period_end)` for a user/workspace, with the reporting timezone snapshotted. The initial proposed cadence is Monday-based weekly periods. DST means local weeks are not assumed to contain exactly 604800 seconds. Convert both date boundaries independently using the IANA timezone.

`DRAFT -> SUBMITTED -> APPROVED | REJECTED`. Submit locks content and snapshots each included effective revision and duration. Submitted and approved sheets prohibit timer/entry/correction mutations that would affect their effective contents or move entries into/out of the locked period. Rejected sheets require an audited transition to a new draft version before edits; approved sheets require an explicit reviewer REOPEN decision, reason, new version, and audit event. Previous decisions and submission snapshots remain in append-only history. The schema proposes separate `timesheet_submissions` and `timesheet_submission_entries` keyed by sheet/version, preserving period, timezone, effective entry values, and revision across reopenings. `timesheet_entries` is the current assignment only. Snapshot writes and database immutability hardening are not implemented guarantees.

Approval of a sheet records the decision for the exact submitted version under a lock. No business self-approval, including owner self-approval. A sole-owner business needs another authorized reviewer; a special exception is not assumed. Personal sheets may be auto-approved with a decision record on submission. These are reviewable architecture proposals, not shipped workflows.

## Presentation and operational scope

Seven hash-addressed screens are navigable with direct links and browser history. Theme selection follows system preference unless overridden for the page session; no user setting is persisted. Responsive navigation uses native modal dialogs, with explicit close controls. Brand tokens retain navy, emerald, mint, and neutral palettes; fonts use local fallbacks only, eliminating the previous external font request. Shell previews, empty metrics, and disabled timer controls clearly disclose that no business state exists.

Vite builds only browser presentation imports. Netlify bundles `.mts` functions separately. Client code must never import the database factory, Node crypto adapter, or auth credentials. SPA fallback follows the `/api/*` fallback so unknown API endpoints do not return the app shell. Typecheck covers server and browser files; lint and architecture tests guard inward dependencies.

The original implementation-session report described no migration generation/execution or deployment by that session. The repository subsequently contained a generated baseline, the platform reported it applied to preview, and a ready production deployment was observed. Sprint 0.2 performed only source validation and read-only hosting/source-documentation retrieval: no database connection, migration operation, activation, deployment, commit, or push. The lazy factory is still unused by runtime functions. A ready deployment does not supply the inaccessible build's terminal record or logs.

## Proposed security architecture — not implemented

[ADR 0006](adr/0006-forward-only-foundation-hardening.md) and the [forward-only hardening design](forward-only-hardening-design.md) specify deferred owner/personal consistency checks, immutable personal slots, scoped mutation procedures, deferred audit obligations, append-only audit grants/triggers, lock ordering, persistent deduplication, and conditional RLS. Direct runtime table writes are denied in the proposed privilege model; constraints protect data shape and narrow procedures enforce caller/action policy. This model depends on role separation that must be verified on an approved isolated branch.

[ADR 0007](adr/0007-authentication-provider-proposal.md) and the [authentication design](authentication-design.md) propose Netlify Identity behind the existing provider-neutral port, with authoritative online provider validation and application-owned server sessions. Workspace roles remain database membership data. SDK claim fallback and browser-readable auth-cookie defaults are not accepted as the protected-API boundary. The provider, secure session transport, lifecycle, and revocation policies require senior review; no SDK was installed or Identity enabled.

All authenticated writes must recheck user/session and membership under the documented transaction locks, use tenant-qualified resource predicates, and commit mutation, audit, and deduplication together. Reads must combine authorization and tenant/resource scoping in one statement/snapshot. No role token, requested workspace ID, or editable user metadata grants access. [Integration tests](database-integration-test-plan.md) are planned, not run. [Build evidence](build-verification-status.md) and the [risk register](sprint-0-risk-register.md) remain release gates. These designs do not authorize Sprint 1.
