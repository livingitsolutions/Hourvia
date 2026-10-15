# Hourvia — Sprint 0.2 final report

Date: October 14, 2026. Scope: foundation reconciliation and security design only.

## Final verdict

**BLOCKED** for complete Sprint 0 acceptance and permission to begin authentication/Sprint 1. Requested documentation/design deliverables were completed and permitted source checks passed. Automatic-build evidence remained inaccessible, live database/role/pooling state was not verified, and proposed security/provider policies require senior approval. No failed build or active authentication bypass was established.

This sprint addressed the architectural/documentation portion of the Sprint 0.1 blockers. It did not pretend that proposed triggers, privileges, session stores, or integration tests were implemented. Authentication remained disabled and application persistence disconnected.

## Deliverables completed

| Deliverable | Result |
| --- | --- |
| Updated architecture/documentation | README, architecture, database design, historical-report interpretation, and ADRs 0002/0004/0005 reconciled |
| Sprint 0.1 durable evidence | Prior conversation-backed acceptance summary retained; missing transient report explicitly disclosed |
| Current-state addendum | Existing artifacts, applied-preview evidence, branch limitations, exact baseline hashes, and ready deployment recorded |
| Forward-only migration design | ADR 0006 and hardening design specified final owner/personal checks, immutable slots, secured operations, audit obligations/immutability, atomic provisioning, revocation locks, scoped repositories, persistent retries and optional RLS |
| Authentication decision/design | Conditional Netlify Identity recommendation behind provider-neutral port; trusted identity binding, authoritative validation, BFF session design, lifecycle, CSRF/CORS, throttling, authorization/errors, and SDK transport gates documented |
| Database integration-test plan | Isolated inherited-baseline branch, actual runtime role, commit-time checks, two-connection schedules, and required denial/rollback/retry cases specified; not run |
| Build verification status | Read-only API attempts and exact manual status/log evidence requirements recorded; BUILD NOT VERIFIED |
| P0/P1 register | No observed P0; ten outstanding P1 approval/evidence/release concerns differentiated from completed documentation work |

## Key design findings and decisions

Exactly-one matching owner requires deferred final-state checks in addition to the retained partial indexes. Personal lifetime uniqueness also needs immutable type/owner and retained root rows. Atomic provisioning and mutation/audit integrity require one transaction, scoped secured operation privileges, and deferred audit obligations rather than best-effort application logging. Membership/local-account revocation must share mutation locks; provider-only revocation needs an explicit documented detection boundary. Persistent request hashes/results plus authorization on replay prevent duplicate writes without exposing revoked users' cached output.

Role separation and transaction-local context are mandatory assumptions to prove, not inferred platform capabilities. Optional RLS is a tenant fence, not identity attestation or a replacement for persisted authorization. Installed driver source was reviewed offline; no client factory, pool, or connection was opened.

Netlify Identity was evaluated using current primary documentation, release metadata, and source. SDK `getUser()` fallback in server code uses validated platform context; it was not reported as an unverified-cookie signature bypass. It does not satisfy proposed fresh provider-state validation by itself. Browser-readable default access/refresh cookies also do not satisfy the BFF design. Supported authoritative verification and secure token-only/session transport remain explicit approval gates; no SDK was installed or Identity service enabled.

## Actual validation and evidence

| Check actually performed | Result |
| --- | --- |
| `npm run typecheck` | PASS; exit 0 |
| `npm run lint` | PASS; zero errors/warnings |
| `npm test` | PASS; 99 tests in 5 files; offline, no database connection |
| `npm ls --depth=0` | PASS; installed locked top-level stack resolved |
| `git diff --check` | PASS before edits and after documentation changes |
| Markdown relative-link/whitespace validation | PASS across README, documentation, and requested summary: 20 Markdown files |
| Runtime/schema/dependency/configuration diff guard | PASS; no changes to schema, migrations, runtime source, tests, dependencies, or hosting configuration |
| Offline schema/migration inspection | 15 tables; 42 matching FK relationship endpoints; PostgreSQL snapshot version 8 with 239 DDL metadata objects; no baseline hardening triggers/RLS/grant statements |
| Baseline preservation | PASS; both SQL and snapshot matched their recorded pre-edit SHA-256 fingerprints after documentation edits |
| Read-only hosting lookup | Production deploy `6acfda088b7a1fd46e470565` ready at baseline commit, associated build `6acfda088b7a1fd46e470563` |
| Build own status/logs | UNAVAILABLE; `getSiteBuild` and `listSiteBuilds` unauthorized/401 |
| Deployed health/workspace GETs | 200 with disabled auth/disconnected persistence; 404 for unimplemented workspace API |
| Primary provider/PostgreSQL mechanism research | Official documentation/source and public release metadata retrieved; not live configuration verification |
| Production build, migrations, live database tests, provider integration, fresh vulnerability audit, browser/accessibility suite | NOT RUN |

The observed deployment was published October 14, 2026, 19:38:05.373 UTC and retrieved October 14, 2026, 21:26:40.694 UTC. It matched source baseline `daaaf00a3aeec7e6a2729d7b15d0bfd2d50871ae`, not unpublished documentation edits. `dist` provenance remained unverified. The platform-supplied applied-preview migration status did not prove production database state.

## Remaining blockers and senior review request

Obtain the redacted exact-build/commit Netlify status and log records listed in [build verification](build-verification-status.md). Request senior architectural review of [ADR 0006](adr/0006-forward-only-foundation-hardening.md), [ADR 0007](adr/0007-authentication-provider-proposal.md), the [hardening design](forward-only-hardening-design.md), [authentication design](authentication-design.md), [integration plan](database-integration-test-plan.md), and [P0/P1 register](sprint-0-risk-register.md). Reviewers must explicitly approve the owner/lifetime-slot policy, audit/system-actor model, operation privileges, lock/idempotency protocol, provider/session transport and lifecycle, and test/rollout gates.

Database/platform reviewers must later demonstrate mandatory role and pooling capabilities on a separately authorized isolated branch. Provider validation/cookie transport must satisfy the proposed security boundary or return for redesign. Any subsequent implementation requires separate Sprint 1 authorization and forward-only migrations; completion of these documents is not that authorization.

## Restrictions observed

Only Markdown documentation and the requested output summary were authored. `db/schema.ts`, both immutable baseline files, dependencies, runtime code, tests, and hosting configuration were left unchanged. No migration was edited/generated/executed/replayed; no database was connected to or modified; no authenticated business endpoint, session store, or limiter was created; no feature activation, build command, deployment, commit, or push was performed. No secret or credential values were output. Sprint 1 was not begun.

The work stopped after reporting and requesting senior architectural review.
