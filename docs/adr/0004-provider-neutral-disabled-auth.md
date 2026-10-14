# ADR 0004 — Provider-neutral authentication, fail-closed foundation

Date: 2026-10-14. Status: accepted for Sprint 0.

## Context

Production authentication is prohibited in this sprint, but application behavior must not assume client-supplied identities are verified.

## Decision

Define an `AuthenticationProvider` port returning only a trusted global user ID and typed failures. Workspace authorization retrieves the persisted active membership for that ID and workspace. A disabled infrastructure adapter returns authentication unavailable for every credential. Do not wire any business endpoint or create an insecure development bypass. Do not provision identity services or add provider SDKs.

## Consequences

Authorization can be tested with test-only port fixtures, which are not runtime identities or stored user state. Future auth providers must validate issuer, signature, audience, expiry, and account status before subject mapping; lifecycle/revocation policies and rate limits require review. Any eventual Netlify Identity adapter must retain these ports and use the supported platform SDK, without pushing provider semantics into domain.
