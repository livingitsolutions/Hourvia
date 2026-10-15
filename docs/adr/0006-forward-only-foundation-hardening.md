# ADR 0006 — Forward-only owner, tenant, and audit hardening

Date: 2026-10-14. Status: **PROPOSED — senior architecture/PostgreSQL/platform review required**. No migration or database operation authorized.

## Context

The generated baseline is reported applied to preview, while runtime persistence is disconnected. It supplies composite tenant references and partial uniqueness but not exactly-one matching owner, immutable personal slots, append-only audit enforcement, or transaction/revocation guarantees. Rewriting the applied migration would corrupt migration history rather than resolve those gaps.

## Proposed decision

Preserve baseline SQL and snapshot byte-for-byte. Later approved hardening uses new migration files only, after read-only preflight on an explicitly authorized isolated branch. Keep all existing checks, unique indexes, and restrictive foreign keys.

Use immediate locks/immutability guards plus deferred row-level constraint triggers for final owner and personal-membership consistency. Make workspace type/identity immutable and personal ownership/deletion forbidden. Create workspace, active owner membership, canonical audit event, and request-deduplication result in one transaction.

Deny runtime direct writes. Expose narrowly scoped, fixed-operation database functions through tenant-aware repositories; restrict function execution and secure function ownership/search paths. Record database-generated audit obligations for protected writes and require matching tenant audit events through deferred foreign keys. Revoke audit update/delete/truncate and add rejection triggers. Membership/admin/business writes share a conservative lock order and recheck authenticated user/session and membership before mutation.

Persist idempotency results and request hashes in Netlify Database, atomically with mutation and audit. Optional RLS adds a transaction-local tenant fence only after role/pooling verification; it does not authenticate a caller or replace explicit tenant/action checks.

## Consequences and approval gates

Coarse user/workspace locks favor correctness over maximum write throughput. Removing them requires measured evidence and a replacement concurrency proof. Shared backend credentials remain a trusted boundary; PostgreSQL constraints cannot independently verify a caller's provider identity.

This design requires separation of migrator/table-owner/runtime/operation roles and support for secured functions, triggers, transactions, and appropriate grants. If the platform cannot support the required privilege model, persistence remains disabled pending redesign; unrestricted writes are not an acceptable fallback.

The [hardening design](../forward-only-hardening-design.md) specifies mechanics and preflight. The [test plan](../database-integration-test-plan.md) defines evidence. These are proposals, not claims of live enforcement or permission to begin Sprint 1.
