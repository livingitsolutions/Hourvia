# ADR 0005 — Dormant Netlify Database schema and adapter

Date: 2026-10-14. Status: accepted for foundation; provisioning and migration deferred.

## Context

The site has a fresh database capability in the task context, while the supplied site snapshot does not report a provisioned database. A first connection may provision resources; this sprint prohibits resource changes and migration execution.

## Decision

Use the Netlify Database package and the Drizzle native Netlify adapter behind a lazy server-only factory. Define the proposed schema at `db/schema.ts` and reserve the platform migration directory. Do not instantiate the factory, issue queries, generate/apply migrations, run database CLI commands, or deploy. No in-memory/JSON persistence alternative is introduced. The health function has no database dependency.

## Consequences

Schema metadata can be typechecked and tested offline, but cannot be called a verified database. Mandatory hardening is documented separately. Installed Drizzle beta packages are locked for adapter compatibility; the registry marks this beta line superseded by release candidates. Upgrade evaluation is explicit future work, not an automatic unreviewed dependency change. A later approved migration workflow is a prerequisite to persistence.
