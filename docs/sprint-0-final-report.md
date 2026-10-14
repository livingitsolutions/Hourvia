# Hourvia — Sprint 0 architectural review

Review date: October 14, 2026. Scope: architecture and foundation only. Implementation stopped at Sprint 0; the next sprint was not started.

## 1. Environment inspection findings

The repository and previous attempt history were reviewed before implementation. The repository contained a README, Netlify static publishing configuration, favicon, four static presentation assets, and a prior branding report. There was no package manifest, React application, TypeScript setup, domain/application layer, database schema, function implementation, or unit-test suite. The working tree initially had no changes. No scoped AGENTS.md files were found.

The observed runtime was Node **24.22.0** and npm **11.19.1**, rather than the task environment's older Node description. The supplied Netlify settings selected Node 24, main-branch publishing, a US East function region, and an already-published static site. The Netlify CLI was available at its supplied executable location but was not used to connect, provision, migrate, or deploy.

The task described fresh managed PostgreSQL capability, while the supplied site snapshot did not report an already-provisioned database. Database-related runtime configuration was checked for presence only; no values were printed. Because first connection may provision resources, database availability, branch state, and live schema were deliberately **not queried**. This is an identified inspection limitation, not proof of a provisioned database.

Netlify build settings were prepared in repository configuration only. No live configuration API calls, resource changes, migrations, deployment, commit, or push occurred. Browser checks used a frontend-only Vite development server to avoid database activation through platform emulation.

## 2. Architecture and folder structure

A modular monolith now separates framework-independent domain/application logic from adapters and React presentation:

```
src/domain/          shared contracts and nine bounded-context directories
src/application/     identity ports and server-side membership authorization
src/infrastructure/  disabled auth, clock/ID adapters, validation, lazy DB factory
src/presentation/    React shell, shared brand/icons, pages, styles, navigation
db/                  offline proposed Drizzle schema
netlify/functions/   static health handler only
tests/               shared fixtures, metadata/boundary/adapter checks
docs/adr/            five architecture decision records
```

All requested contexts have explicit ownership charters: Identity; Workspace & Membership; Time Tracking; Time Adjustments; Timesheets; Projects & Clients; Approvals; Reporting; Audit. Only foundation behavior is implemented. Charters for later contexts are not fake services or complete product modules.

Production domain/application imports do not reference React, Zod, Drizzle, Netlify, presentation, or database adapters. Lint restrictions and automated import tests enforce this direction. A separate import test keeps server-only adapters out of the browser source graph. Full boundaries, role capabilities, request flow, and transaction policies are in `docs/architecture.md`.

The responsive shell contains Dashboard, Timer, Timesheets, Adjustments, Projects, Reports, and Settings. Hash navigation, direct links/history, local-session appearance controls, native dialogs with keyboard loops, focus restoration, skip navigation, and reduced-motion styling are present. All business screens disclose placeholder status. No business metrics or signed-in accounts are fabricated. The previous static HTML/JS/CSS implementation was replaced, preserving the favicon, brand identity, navy/emerald/mint colors, parent endorsement, and tagline. The dedicated old design-system specimen page was superseded by reusable React components, CSS tokens, and appearance settings. External font requests were removed in favor of local fallbacks.

## 3. Implemented domain models

**Shared contracts:** branded UUID entity IDs, immutable discriminated Result values, typed domain errors, canonical millisecond UTC instants, validated IANA timezones, bounded integer DurationSeconds, Clock port, and ID generator port. System clock and UUID implementations are isolated infrastructure adapters.

**Workspace:** PERSONAL/BUSINESS type, global owner ID, workspace ID, normalized 1–120 Unicode-code-point name, IANA timezone, UTC creation/update/archive timestamps. Factories and immutable rename/archive transitions reject invalid names/types, backwards update times, repeat archive, and mutation after archive. The database enforces lifetime personal-workspace uniqueness by proposed index; an individual object cannot enforce global uniqueness itself.

**Membership:** tenant ID, global user ID, membership ID, OWNER/ADMIN/MEMBER/VIEWER role, ACTIVE/SUSPENDED/REMOVED state, UTC timestamps. Creation rejects archived workspaces, invalid roles, owner mismatches, other personal-workspace users, and creation predating the workspace. Transitions preserve the original object, protect the owner, reject backwards/duplicate transitions, and make removal terminal. Ownership transfer and reinvitation are deliberately not implemented.

## 4. Proposed database schema

`db/schema.ts` defines **15 proposed tables**: users, external identities, workspaces, memberships, clients, projects, active timers, time entries, adjustments, timesheets, current timesheet entries, submission versions, historical submission entries, approvals, and audit events. It defines five enums and reviewed proposed primary/unique keys, foreign keys, checks, and query indexes.

Users and external identities are global; the workspace is the tenant root; all twelve descendant tables have required workspace IDs. Tenant-to-tenant relationships use composite workspace references. UTC storage is `timestamptz(3)`; local timesheet boundaries are date values plus a preserved IANA timezone; canonical durations are integers. Default restrictive foreign keys and archival/tombstone policies avoid destroying history.

The schema proposes personal-owner uniqueness, active timer concurrency exclusion, entry idempotency, integer elapsed-duration checks, revision uniqueness, tenant-safe project/member references, exact timesheet-period uniqueness, immutable versioned submission snapshots, and approval-target/version constraints. Reporting remains a future read projection, not an additional canonical time store.

`docs/database-design.md` details ownership, indexes, operation-by-operation transaction boundaries, and **mandatory deferred enforcement**: exact owner membership/identity, append-only privileges/triggers, overlapping-period exclusion, period locks, approval/self-review/revision policies, IANA DB validation, tenant-aware repository mappers, RLS feasibility, and integration tests. These protections are not claimed live. No migrations were generated or executed, and no database client was instantiated.

## 5. Workspace tenancy and authorization design

`AuthenticationProvider` returns only a verified global user identity or typed failure. `WorkspaceAuthorization` and `WorkspaceAccessRepository` are provider/database-neutral ports. The implemented authorization policy retrieves the workspace and the verified user's membership server-side; rejects missing, archived, inactive, mismatched, or invalid scopes; checks role capabilities; and fails closed on provider/repository failures without leaking internals.

No client user ID or role is an authorization input. The strict Zod workspace-body schema rejects unexpected identity, owner, role, and tenant fields. A workspace ID is a selector, not permission. Own-resource actions must additionally check resource user ownership. Future writes recheck membership inside the same transaction as mutations and audit to prevent revocation races. The role baseline is documented, but membership administration, owner transfer, and adjustment review require narrower action policies before implementation.

The disabled authentication adapter rejects every credential. There is no production authentication, login flow, development identity bypass, repository adapter query, or authenticated business endpoint. `/api/health` returns static foundation status only and explicitly reports persistence as not connected; it is not a readiness probe.

## 6. Time tracking and adjustment invariants

The documented proposals specify one active timer per user/workspace, UTC instants with preserved reporting zones, and server-authoritative floor-of-elapsed integer seconds. Concurrent timers in different workspaces are allowed by this particular rule. Finalized manual-entry overlap is not automatically prohibited by the timer constraint.

Base entries remain immutable. Adjustments are full replacement revisions with a reason and increasing sequence, not deltas. The effective entry is the latest approved replacement or the base; pending/rejected revisions do not affect totals, and approved voids remove the entry from reporting. Do not add base and revision durations together.

Reports use half-open timezone-derived ranges and attribute an entry to its effective start local date. Midnight splitting and billing rounding are deferred explicit policies. Timesheets snapshot period/timezone, exact effective revisions, and time values by submission version. Submitted/approved periods and contents lock against impactful changes. Approval, rejection, and reopening require immutable decisions, exact versions, authorization, transaction locks, and audit; reopening creates a new version without erasing prior snapshots.

Proposed business review prohibits self-approval; personal automatic approval still records a decision. A sole-owner business consequently needs another reviewer unless a later product decision defines a restricted exception. These workflow policies are documented, not implemented. There is no live timer persistence, adjustment service, approval handler, reporting query, or timesheet workflow in this sprint.

## 7. Files created or modified

Created configuration and entry files: `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `eslint.config.js`, `drizzle.config.ts`, `index.html`.

Modified repository configuration/documentation: `.gitignore`, `netlify.toml`, `README.md`, `docs/sprint-0-final-report.md`. Added the required standalone changes summary at `.netlify/results.md`.

Created domain code and tests:

- `src/domain/shared/result.ts`, `src/domain/shared/identifiers.ts`, `src/domain/shared/time.ts`, `src/domain/shared/contracts.test.ts`.
- `src/domain/workspace-membership/workspace.ts`, `src/domain/workspace-membership/membership.ts`, `src/domain/workspace-membership/workspace.test.ts`, `src/domain/workspace-membership/membership.test.ts`.
- Context `README.md` files under all nine domain context directories listed in section 2.

Created application/infrastructure/server code:

- `src/application/README.md`, `src/application/identity/authentication.ts`, `src/application/workspace-membership/authorization.ts`, `src/application/workspace-membership/authorization.test.ts`.
- `src/infrastructure/README.md`, `src/infrastructure/authentication/disabled-authentication.ts`, `src/infrastructure/database/netlify-client.ts`, `src/infrastructure/runtime/system-clock.ts`, `src/infrastructure/runtime/uuid-generator.ts`, `src/infrastructure/validation/workspace-input.ts`.
- `db/schema.ts`, `netlify/functions/health.mts`, `tests/fixtures.ts`, `tests/foundation.test.ts`.

Created presentation: `src/presentation/main.tsx`, `src/presentation/App.tsx`, `src/presentation/styles.css`, `src/presentation/brand.ts`, `src/presentation/navigation.ts`, `src/presentation/components/Brand.tsx`, `src/presentation/components/Icon.tsx`, `src/presentation/pages/Dashboard.tsx`, `src/presentation/pages/Placeholder.tsx`, `src/presentation/pages/Settings.tsx`.

Created architectural documentation: `docs/architecture.md`, `docs/database-design.md`, and five files in `docs/adr`: `0001-modular-monolith.md`, `0002-global-identity-workspace-tenancy.md`, `0003-utc-seconds-immutable-corrections.md`, `0004-provider-neutral-disabled-auth.md`, `0005-dormant-netlify-database.md`.

Removed superseded static entry assets: `public/index.html`, `public/app.js`, `public/brand.js`, `public/styles.css`. `public/favicon.svg` was retained unchanged. Browser tools, test script, and screenshots were kept outside the repository; no browser-test dependencies were added to the application manifest.

## 8. Tests and commands executed with results

| Command/check | Actual result |
| --- | --- |
| Repository/history/configuration/skill inspection; `node --version`, `npm --version`, `git status --short` | Completed; environment findings recorded above; configuration presence only, no secret values |
| Runtime dependency installation, including `@netlify/database`, native Drizzle beta adapter, React and Zod | Passed; lockfile created; install audit reported zero vulnerabilities |
| Development dependency installation for Vite, TypeScript, Tailwind v4, Drizzle Kit, ESLint, Vitest and types | Passed; install audit reported zero vulnerabilities; Drizzle beta deprecation warning recorded |
| `npm ls --depth=0` | Passed; installed stack inspected |
| `npm run typecheck` | PASS, zero TypeScript errors on final run |
| `npm run test` | PASS, **99 tests in 5 files** on final run; no database connection |
| `npm run lint` | PASS, zero errors/warnings with `--max-warnings 0` |
| `git diff --check` | PASS |
| `npm run dev -- --port 5173` | Vite development server started successfully; frontend-only, no Netlify/database activation |
| Temporary Playwright/Chromium and axe tooling installation outside repository | Passed; used only for local development-browser checks |
| `node /tmp/hourvia-validation/check.mjs` | PASS on final run: 42 page/width checks; 28 WCAG A/AA scans; zero automated violations; zero browser runtime errors |
| Manual desktop/mobile screenshot review | Completed at 1440px and 375px |
| `npm run build` / Netlify build / function bundling | **NOT RUN**; execution prohibited in this task and reserved for automatic hosting validation |
| Migration generation/execution, live DB integration, Netlify resource activation/deployment | **NOT RUN**, deliberately prohibited/deferred |

Responsive checks covered all seven pages at 320, 375, 600, 900, 1024, and 1440 pixels with no horizontal overflow. Accessibility scans covered all seven pages in light/dark at mobile/desktop (28 scans). Browser checks covered direct links, titles, history, disabled timer controls, session/system theme changes, skip navigation without route mutation, mobile focus loops and Escape restoration, mobile link dismissal, and about dialog behavior. Automated accessibility checks are not formal accessibility certification or comprehensive assistive-technology testing.

Intermediate validation found a test-helper narrowing error, a lint rule incorrectly applied to test-only adapter imports, light-theme badge contrast, and modal keyboard-loop behavior. These were corrected and the final checks rerun successfully. Temporary browser harness setup and navigation timing were also corrected; only the final passing results above are acceptance evidence. Prior attempt test claims were not treated as results for this React rewrite.

Unit coverage includes identifier/timezone/UTC/duration values; immutable Workspace/Membership rules and transitions; owner/personal invariants; server-derived identity, role permissions, invalid/missing/cross-tenant/inactive membership, disabled auth and error redaction; strict input shape and Unicode length; health method/status; schema metadata and tenant keys; historical snapshot keys; navigation mapping; and dependency boundaries. Metadata tests are not live constraint/race tests.

No `dist` directory or migration output directory was present after validation. Development processes were stopped by their specific session/process, not broad process matching.

## 9. Risks, blockers, and incomplete items

1. **Production build gate remains unverified.** Vite development transforms worked, but production assets, function bundles, and actual Netlify routing are not validated by those checks. Automatic hosting validation must pass before complete acceptance.
2. **Database is an offline proposal.** Provisioning/branch availability and SQL constraints are unverified. Deferred owner, append-only, overlapping-period, approval, lock, and tenant-context hardening must precede persistence release. Do not ship DB endpoints against an unmigrated database.
3. **Authentication is disabled by design.** Provider selection, validated credential mapping, account lifecycle/revocation, secure session handling, CSRF decisions, rate limiting, and protected HTTP composition are future work.
4. **Drizzle beta upgrade risk.** The required native adapter works in typecheck with locked beta packages, but the registry marks the beta line superseded by release candidates. Review compatibility and upgrade policy before migration rollout; no unreviewed switch was made.
5. **Product policies require approval.** Start-day attribution, personal lifetime slot/archive behavior, weekly periods, no business self-review, sole-owner review, removal/reinvitation, overlap handling, billing rounding, and retention/redaction require senior/product review before workflows are implemented.
6. **RLS and transaction enforcement are not active.** Future server repositories must scope every query and recheck membership/resource ownership inside writes. Adapter support for connection-local tenant context and DB role privileges must be tested before RLS is claimed.
7. **Historical labels need a decision.** Snapshot schema preserves time values and classification IDs; exact old project/client display names require additional immutable label snapshots if that is a reporting requirement.
8. **Brand/domain and accessibility follow-up.** The proposed custom domain remains unconfigured/unverified. Permanent brand artwork and social-preview assets are deferred. Chromium automated checks do not replace real assistive-technology and cross-browser testing.

There is no unresolved failing typecheck, unit test, lint, or development-browser check. The missing production build verification is the remaining Sprint 0 acceptance gate; the deliberate auth/persistence omissions are scope boundaries, not accidental unfinished features.

## 10. Sprint 0 acceptance verdict

**NOT RUN — complete quality-gate acceptance awaits automatic production build validation.**

Architecture, contracts, Workspace/Membership behavior, proposed schema/security/time policies, application shell, tooling, documentation, and ADR deliverables are present. Typecheck, 99 unit tests, lint, whitespace validation, responsive checks, and automated development-browser accessibility checks passed. No production build pass is claimed. If the hosting workflow confirms both the frontend production build and supported function bundling, the remaining build gate can be reviewed for PASS; this report cannot certify a workflow that has not been observed.

All prohibited operations remained out of scope. Work stopped at Sprint 0.

## 11. Proposed Sprint 1 scope — not implemented

Subject to explicit approval, first activate the tenant foundation rather than expanding into all time workflows:

1. Approve the ADR/policy proposals and resolve ownership, invitation/reinstatement, review exceptions, report attribution, retention, and auth-provider decisions.
2. Validate the automatic production build and Netlify function routing/bundling; establish CI checks using the existing scripts.
3. Review/generate migrations in the required platform directory on an explicitly approved isolated database branch, implement mandatory foundational tenant/owner hardening, and test migrations, composite constraints, rollback/conflict behavior, and membership revocation races.
4. Implement the chosen production auth adapter behind the existing provider-neutral port, verified global identity mapping, disabled-state removal only with protected routes, safe HTTP errors, and appropriate security controls.
5. Implement real tenant-scoped workspace/membership repositories and atomic personal/business provisioning with owner membership and audit; add authenticated workspace discovery and selection.
6. Add integration/security tests for cross-tenant denial, role escalation, own-resource authorization, personal uniqueness, ownership atomicity, and audit/idempotency behavior. Decide when to implement and test RLS based on actual adapter capabilities.

Live timers, corrections, timesheet review, projects/client CRUD, and reporting remain subsequent approved work, not a hidden continuation of this Sprint 0 task.
