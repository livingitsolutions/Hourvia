# Sprint 0 P0/P1 risk register — reconciled in Sprint 0.2

Date: October 14, 2026. Current posture: authentication disabled, application persistence disconnected, no protected business API. Design completion is not runtime remediation.

## Severity and current exposure

No observed P0 incident or active protected-data bypass was identified by these source/evidence audits; no penetration-test certification is implied. Any future authentication bypass, compromised shared runtime credential, or unrestricted privileged database release would be an immediate release stop requiring P0 incident assessment if active.

P1 items below are acceptance/release blockers, including latent risks that become exposed only when persistence/authentication is enabled. They are not all claims of exploitable behavior in the currently disabled foundation. Later timer/timesheet/approval workflows retain separate pre-release gates and are not being implemented to close this sprint.

| ID | Priority / concern | Current evidence and design status | Closure evidence / responsible review |
| --- | --- | --- | --- |
| R01 | P1 — automatic hosting build unverified | Published deploy ready at baseline commit; build-details/list retrieval unauthorized/401; no terminal build/log evidence | Redacted exact-ID/commit build record, command/bundle phase result; Netlify platform lead; see build-status record |
| R02 | P1 — actual branch schema/grants unknown | Baseline applied-to-preview status supplied by platform; no live branch inspected; production state not inferred | Approved isolated lineage/schema/role/pooling evidence before persistence activation; production verification separately authorized before rollout; database/platform reviewers |
| R03 | P1 — owner/personal-slot integrity | Existing partial keys do not enforce matching-owner existence, extra-personal-member exclusion, or immutable owner/type/deletion; forward trigger/privilege design complete, not installed | Approve ADR 0006; later forward-hardening commit/constraint/concurrency tests on isolated branch; architect/PostgreSQL reviewer |
| R04 | P1 — audit attribution/append-only/atomicity | Baseline actor FK is global, entity polymorphic, metadata unrestricted at DB type level; no append-only trigger/grant/obligation protection; proposed controls specified | Approve actor/bootstrap/system-event policies and obligation coverage; runtime UPDATE/DELETE/TRUNCATE denial and rollback evidence; security/PostgreSQL reviewers |
| R05 | P1 — revocation and tenant-operation races | Current authorization is offline port policy; no persisted write adapter exists; shared user/session/workspace/member locking and scoped read/write rules proposed | Two-connection revocation schedules, same-transaction rechecks, cross-tenant/owned-resource denial through actual runtime role; backend/security reviewers |
| R06 | P1 — duplicate/retry integrity | Baseline timer/entry keys are not a general persistent response ledger; proposed hash-bound committed request result and atomic audit protocol | Same/different-key provisioning, payload-conflict, uncertain COMMIT, revoked replay, bounded retries; PostgreSQL/backend reviewers |
| R07 | P1 — grants/pooling/RLS assumptions | Driver source suggests pool-backed transactions but deployed behavior/role separation unverified; optional RLS not assumed | Required roles/functions/revokes supported; no owner/BYPASSRLS runtime; context reset/cancellation/definer visibility tests; platform/PostgreSQL reviewers. If mandatory capabilities unavailable, redesign instead of weakening |
| R08 | P1 — auth validation/session transport compatibility | Netlify Identity recommended conditionally. SDK server fallback is validated context, not fresh online state; default token cookies are browser-readable; no SDK installed | Prove supported authoritative validation and BFF token-only/secure cookie flow; no fallback grants/no extra provider cookies; revisit provider if unsupported; application-security/platform reviewers |
| R09 | P1 — identity/lifecycle/security policy approval | Issuer/subject, audience binding, account eligibility, expiry, recovery, local/provider revocation windows, encryption/key handling now specified as proposals, not observed/approved settings | Senior approval of ADR 0007 and exact provider profile/transport/registration/session/recovery/revocation policies; security/architecture leads |
| R10 | P1 — HTTP boundary and distributed throttling | Same-origin/CSRF/typed-error/cache and persisted limiter designs present; no handlers/limiter enabled | Future isolated HTTP tests for missing/forged/expired credentials, Origin/CSRF denial, outages/429, redirect rejection, concurrent request isolation; security/backend reviewers |

## Documentation/design findings addressed

The obsolete current-state interpretation of no generated/applied migration and no observed deployment was corrected without rewriting historical action claims. The transient Sprint 0.1 report's absence was explicitly recorded and a durable evidence summary retained. Applied baseline hashes and preview-versus-production evidence boundaries were documented. Owner, audit, transaction, retry, authentication, and isolated-test designs now exist with named approval/capability gates. Source validation passed again.

Those are documentation/design closures only. R01 remains evidence-blocked; R02–R10 require the specified approvals and/or future separately authorized implementation/verification. No risk is marked runtime-resolved merely because a document was added.

## Later-workflow gates

Before time/approval workflows: period overlap exclusion, submitted-content locks, same-user sheet assignment, effective revision/approval-version consistency, self-review restrictions and reasons, snapshot immutability, effective reporting projection, retained labels, general external-effect outbox, and retention/redaction policy. They are already disclosed in database/architecture documentation. They do not authorize expanding Sprint 0.2 or require implementing timers to review authentication.

## Review and acceptance boundary

Senior architectural review should cover ADRs 0006/0007, privilege feasibility, audit obligations, personal ownership/archival semantics, callback/session compatibility, and isolated test schedules. Product/security approval is required for the proposed starting session lifetimes, registration/confirmation/recovery mode, rate thresholds, and revocation detection SLA. Build evidence can be supplied independently. Until those gates are closed, overall Sprint 0 acceptance and authorization to begin Sprint 1 remain **BLOCKED**.
