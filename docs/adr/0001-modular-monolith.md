# ADR 0001 — Modular monolith with inward dependencies

Date: 2026-10-14. Status: accepted for Sprint 0 foundation.

## Context

Hourvia has nine bounded contexts but a single founding team and a shared transactional tenant model. Framework-coupled domain objects and premature services would increase migration and review costs.

## Decision

Use domain, application, infrastructure, and presentation layers in one TypeScript repository. Domain/application production code has no third-party runtime dependencies. Keep contexts explicit with charters, shared value contracts, and narrow ports. React/Vite/Tailwind is presentation; Zod is adapter validation; Netlify Functions composes server-side use cases; Drizzle/Netlify Database is infrastructure. Avoid a router/state library until needed.

## Consequences

Transactions stay local and domain tests stay fast. Lint and import-boundary tests guard direction. This is module separation, not separate deployments or packages. Future service extraction requires evidence rather than this sprint's speculation.
