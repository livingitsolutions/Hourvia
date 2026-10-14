# Hourvia

**Hourvia by Living IT Solutions**

Time tracked. Progress made.

Hourvia is a multi-tenant time-tracking SaaS foundation for individuals, freelancers, and businesses. Sprint 0 establishes architecture, tested domain contracts, an offline schema proposal, and a responsive React application shell. It does not enable authentication, live timers, or database-backed product features.

## Run locally

Use Node 22.12 or later (Node 24 is the inspected Netlify runtime) and npm:

```sh
npm ci
npm run dev
```

For an approved local Netlify-emulated session, use `netlify dev --port 8889`. Do not connect to the database until provisioning and migrations are explicitly authorized. Pure frontend development through Vite does not require a database. Netlify is configured to publish `dist` after its build workflow; no deployment occurred in this sprint.

## Validation

```sh
npm run typecheck
npm test
npm run lint
```

`npm run build` runs typecheck and the Vite production bundle in the hosting workflow. It was not executed during this task because build execution is reserved for automatic validation. `npm run test:watch` supports local iteration. Tests use no database connection and cover domain invariants, authorization ports, input validation, handler behavior, schema metadata, navigation, and import boundaries.

## Stack

React, Vite, TypeScript, Tailwind CSS v4, Netlify Functions, Netlify Database/PostgreSQL, Drizzle ORM, Zod, ESLint, and Vitest. Versions are pinned by `package-lock.json`. The native Netlify adapter uses the Drizzle beta release line; its registry deprecation notice and upgrade risk are documented in ADR 0005.

## Structure

- `src/domain`: framework-independent shared contracts, Workspace/Membership models, and nine context charters.
- `src/application`: provider-neutral identity and server-side workspace authorization ports/policy.
- `src/infrastructure`: disabled auth, runtime value adapters, Zod boundary, dormant database factory.
- `src/presentation`: React shell, reusable brand/icon components, local-session themes, seven navigable screens.
- `db/schema.ts`: offline proposed relational schema; no generated or applied migrations.
- `netlify/functions/health.mts`: static `/api/health`; no database or authenticated business operations.
- `docs/architecture.md`, `docs/database-design.md`, `docs/adr`: boundaries, security, invariants, policies, and decisions.
- `docs/sprint-0-final-report.md`: architectural review and actual validation results.

Dashboard, Timer, Timesheets, Adjustments, Projects, Reports, and Settings use hash navigation with direct links and back/forward support. All business screens are placeholders. Workspace/account labels disclose preview status; metrics are unconnected, not fabricated records. The timer does not start or persist. Settings changes appearance only.

## Design principles

Deep navy `#0C2530`, emerald `#087F5B`, soft mint `#7BD9B0`, and white retain the established brand. Semantic neutral colors adapt to light/dark themes. Local Avenir Next/Segoe UI fallbacks replace the previous externally hosted font request. Tailwind v4 is configured through its Vite plugin, with reusable semantic CSS tokens and component styles. Focus indicators, skip navigation, native dialogs, reduced-motion support, labeled controls, and responsive layouts are shared across the shell.

The default theme follows the device setting. The header toggles light/dark; Settings also offers system mode. Manual choices last only for the page session. No user preference or business state is saved locally or sent to a server.

## Deployment identity

Project identifier: `hourvia`. Proposed production address: `hourvia.livingitsolutions.com`. The custom domain remains a proposal, not a verified deployment. No canonical URL, DNS/TLS configuration, production resource activation, migration execution, commit, push, or deployment is part of Sprint 0.
