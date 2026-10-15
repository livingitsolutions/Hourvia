# ADR 0005 — Dormant Netlify Database schema and adapter

Date: 2026-10-14. Status: historical implementation-session decision; runtime adapter remains dormant. Current platform/migration interpretation is superseded by the Sprint 0.2 addendum and proposed ADR 0006.

## Context

The site has a fresh database capability in the task context, while the supplied site snapshot does not report a provisioned database. A first connection may provision resources; this sprint prohibits resource changes and migration execution.

## Decision

Use the Netlify Database package and the Drizzle native Netlify adapter behind a lazy server-only factory. Define the proposed schema at `db/schema.ts` and reserve the platform migration directory. Do not instantiate the factory, issue queries, generate/apply migrations, run database CLI commands, or deploy. No in-memory/JSON persistence alternative is introduced. The health function has no database dependency.

## Consequences

Schema metadata can be typechecked and tested offline, but cannot be called a verified database. Mandatory hardening is documented separately. Installed Drizzle beta packages are locked for adapter compatibility; the registry marks this beta line superseded by release candidates. Upgrade evaluation is explicit future work, not an automatic unreviewed dependency change. A later approved migration workflow is a prerequisite to persistence.

## Sprint 0.2 reconciliation

The earlier context and no-generation decision above described the implementation session. A generated migration now exists at `20261014193353_wise_hawkeye`, and the platform reports it applied to preview. Both migration files are immutable and were preserved exactly. No live database was inspected, no production application state was inferred, and the runtime factory still has no production caller. See the [current-state addendum](../sprint-0-current-state-addendum.md) and [ADR 0006](0006-forward-only-foundation-hardening.md). Any hardening must roll forward under separate approval; do not regenerate or replay the applied baseline on an existing branch.
