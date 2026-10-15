# Sprint 0 current-state addendum

Date: October 14, 2026. Scope: repository reconciliation and evidence, not database/authentication activation.

## Interpretation of historical records

The [original Sprint 0 report](sprint-0-final-report.md) remains an implementation-session record. Its no-migration/no-deployment statements and historical browser/install checks must not be read as a current platform inventory. The [Sprint 0.1 evidence summary](sprint-0-1-acceptance-verification.md) retains the preceding audit's conclusions; its transient artifact was unavailable in this workspace. This addendum describes the state actually available to Sprint 0.2 and supersedes earlier current-state interpretations.

## Repository and application state

The source baseline was commit `daaaf00a3aeec7e6a2729d7b15d0bfd2d50871ae`; the working tree was clean before documentation edits. Runtime inspection remained Node `v24.22.0` and npm `11.19.1`. The locked stack, domain/application boundaries, immutable Workspace/Membership objects, and 99-test suite remained present. `dist` already existed; Sprint 0.2 did not run a build or establish those artifacts' provenance.

Only the static health function was implemented. The disabled auth adapter rejected credentials, and no runtime caller of the lazy database factory was found. No authenticated product endpoint, provider SDK integration, live timer, or persistence repository was enabled. An existing database capability/migration is distinct from application persistence activation.

## Immutable baseline and application evidence

Both baseline files existed and were tracked before this sprint. Their SHA-256 fingerprints were recorded before editing documentation:

| File under `netlify/database/migrations/20261014193353_wise_hawkeye` | SHA-256 |
| --- | --- |
| `migration.sql` | `e0d7439b120175b4cff1fd890af2ba9ccb8e3ec6030d4f5ca992ff9c43f96e8e` |
| `snapshot.json` | `0aee1b8a6b37ec228074537c6b2442836095722b909f282034991b10bb31e12c` |

The migration entered repository history in commit `0e734ab`, dated October 14, 2026, 19:36:57 UTC. The supplied platform state reported it already applied to the preview branch. That application status was platform-supplied evidence, not an independent database query. No preview or production database connection was made. Production applied migrations, actual table definitions, role privileges, extensions, pooling, existing records, and out-of-band policies remain **DATABASE NOT VERIFIED**.

Offline inspection found 15 tables, five enums, and 42 declared foreign-key relationships; the SQL migration matched those relationship endpoints. Its snapshot used PostgreSQL format version 8 and contained 239 DDL metadata objects. This was not full SQL equivalence or live migration verification. The baseline contained no hardening triggers, RLS statements, or explicit GRANT/REVOKE controls.

Never edit, rename, delete, regenerate, or replay this applied migration on an existing branch. Any later approved change must use a new forward-only migration after preflight review. Both recorded fingerprints passed final post-documentation integrity checks; no migration or schema file was modified in Sprint 0.2.

## Hosting evidence

Read-only deployment retrieval at **October 14, 2026, 21:26:40.694 UTC** reported production deployment `6acfda088b7a1fd46e470565` as `ready`, matching the source baseline and branch `main`. It referenced build `6acfda088b7a1fd46e470563`, with publication at **October 14, 2026, 19:38:05.373 UTC**. This was evidence for the previously published foundation, not publication of these documentation changes.

The build-details and build-list interfaces remained unauthorized/401. **BUILD NOT VERIFIED** remained the build verdict. No build log, command exit code, terminal build record, or function-bundling phase result was accessible. A ready deployment was not promoted to an automatic-build PASS. Exact evidence required from an authorized reviewer is listed in the [build-status record](build-verification-status.md).

The exact deployment's health GET returned 200 with disabled authentication and disconnected application persistence. An unauthenticated `/api/workspaces` GET returned 404. Those requests did not touch the database or certify a future protected API.

## Reconciled documentation and boundaries

README, architecture, database design, and ADR 0005 now distinguish historical implementation actions, generated/applied-preview evidence, disconnected runtime persistence, and unverified production database/build details. The original report's remaining historical measurements were retained rather than relabeled as newly rerun results.

The [forward-only design](forward-only-hardening-design.md), [authentication proposal](authentication-design.md), and [test plan](database-integration-test-plan.md) are reviewable proposals only. Runtime enforcement and integration evidence remain outstanding. The [risk register](sprint-0-risk-register.md) separates addressed documentation/design gaps from unresolved release risks. No Sprint 1 authority was granted.
