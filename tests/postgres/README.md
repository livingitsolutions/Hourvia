# Isolated PostgreSQL tests — NOT RUN

No database access is authorized in Sprint 0.3A's implementation run. The default test command skips this suite without constructing a database client. Mocks are not database-enforcement evidence.

A separately authorized operator must prepare an empty disposable Netlify PostgreSQL database named with the `hourvia_s03a_` prefix, provision the reviewed roles, and install the baseline plus reviewed candidate. Never target an inherited preview, staging or production database. The baseline may only be installed on that fresh disposable database, never replayed on an existing branch. This harness performs no DDL or migration execution.

Only after explicit authorization, set `HOURVIA_PG_AUTHORIZATION` to `isolated-sprint-0.3a`, `HOURVIA_PG_RUNTIME_URL` to the actual reviewed runtime login connection, and `HOURVIA_PG_MAINTENANCE_URL` to isolated fixture/observation credentials in protected configuration. Do not print these values. Run the specific integration test file with Vitest. URL/database-name checks prevent accidental ordinary branch use but are not proof of isolation: operator provenance is mandatory.

The fixture role must insert baseline global users, temporarily assume the non-login operations role, observe `pg_blocking_pids`, and exercise structural denials without disabling triggers. Tests use real runtime credentials for commands and direct-write denials. They leave committed retained fixture history; dispose of the entire test database afterward under the same authorization. Never add cleanup DELETE/TRUNCATE bypasses.

Concurrency uses two pinned connections and an observed PostgreSQL lock barrier. Both revocation orders and same/distinct-key personal races are covered. Set an appropriate runner timeout if the authorized transport is slow. Record PostgreSQL/driver versions, isolated database provenance, effective privileges, candidate fingerprint, SQLSTATEs, counts and reviewer without credentials or raw driver errors. Current tests prove neither real deployed pooling/context cleanup nor account/session revocation; additional platform acceptance cases are mandatory before activation.
