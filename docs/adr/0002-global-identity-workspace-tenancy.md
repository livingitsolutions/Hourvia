# ADR 0002 — Global identity, workspace tenant

Date: 2026-10-14. Status: accepted for foundation; database hardening deferred.

## Context

One person may work personally and in several businesses without separate login identities.

## Decision

Users and verified issuer/subject mappings are global. A workspace is a tenant. Every descendant row has a non-null workspace ID and tenant-safe composite references. PERSONAL workspaces allow only the owner membership and one lifetime personal workspace per global user; archived personal workspaces retain that slot. BUSINESS workspaces permit role-based memberships with one owner. All workspace access is authenticated and authorized server-side from persisted active membership, never browser user IDs/roles.

## Consequences

The requested workspace ID only selects a scope. Queries must explicitly constrain tenant and check resource ownership. Personal provisioning and owner membership are atomic. Partial indexes alone cannot verify owner identity/existence; deferred triggers are required before persistence. RLS is future defense in depth, not an assumed guarantee.
