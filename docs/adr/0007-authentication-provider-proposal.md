# ADR 0007 — Netlify Identity with a fail-closed application session boundary

Date: 2026-10-14. Status: **PROPOSED, CONDITIONAL — not approved for integration**. Authentication remains disabled; no SDK installation or service activation.

## Context and recommendation

Recommend **Netlify Identity** as the first provider to evaluate for Hourvia. Its current official documentation describes Functions integration and server-side verification; the maintained headless `@netlify/identity` package supports modern Functions. The registry identified version `2.0.0` on October 14, 2026. This was research evidence, not a dependency selection/install or proof of this site's Identity configuration.

Use `@netlify/identity` as the supported auth library if integration is later approved. Do not directly adopt deprecated Identity widget/GoTrue client libraries. Keep the existing `AuthenticationProvider` port provider-neutral and return only the verified global user ID; provider roles never authorize workspaces.

## Material SDK tradeoffs discovered

The SDK README describes `getUser()` as best-available user data, including fallback when the Identity API is unavailable. Reviewed server source falls back only to a server-validated Identity context, not an unverified decoded cookie. That is not a signature-bypass finding. It nevertheless cannot by itself establish fresh provider account/session state under Hourvia's proposed outage/revocation policy.

Reviewed default server auth-cookie construction used `httpOnly: false` for both `nf_jwt` and `nf_refresh`. Do not blindly use that default for Hourvia's intended browser boundary. An application-owned HttpOnly opaque session and supported server-only provider-token transport are proposed instead. A supported way to avoid/suppress those default cookie side effects must be verified before approving implementation; no wrapper compatibility is assumed. If the required flow cannot be achieved with supported interfaces, stop and revisit provider/transport selection in senior review, rather than downgrade to browser-readable refresh credentials.

## Proposed decision and tradeoffs

Use a same-origin backend-for-frontend (BFF), provider credentials retained server-side, an opaque Secure/HttpOnly host-only app cookie, authoritative online validation for protected requests, local session/account revocation, and transactional persisted membership authorization. The detailed [authentication design](../authentication-design.md) specifies identity mapping, expiry, CSRF/CORS, rate limits, HTTP errors, and test gates.

Benefits are one-platform operations, compatibility with the existing modern Functions/identity ports, and no tenant-role coupling to provider claims. Costs are provider/network availability on protected requests, extra session storage/key management, tighter coupling to the project's Identity issuer/lifecycle, and SDK-cookie/validation work that must be demonstrated. These are accepted design considerations for review, not measured latency, pricing, uptime, or compliance claims.

A standard OIDC provider is a possible separately reviewed alternative if the supported Netlify session transport cannot satisfy the requirements. No alternative provider was selected, configured, or represented as a drop-in solution. Provider choice, registration mode, verified-account policy, session lifetimes, recovery, audience binding, revocation SLA, and transport capability remain explicit review decisions.

## Acceptance and references

Approval requires deployed isolated-context evidence of request-scoped credential validation, trusted issuer/subject and audience/resource binding, token expiry, authoritative disabled/revocation handling, secure cookie output without extra token cookies, CSRF protection, and fail-closed outages. No SDK fallback user object or bearer-role claim substitutes for those checks.

Primary references retrieved October 14, 2026:

- Netlify Identity overview: `https://docs.netlify.com/manage/security/secure-access-to-sites/identity/overview/`.
- Registry release metadata: `https://registry.npmjs.org/@netlify%2fidentity/latest` (observed version `2.0.0`; future selection must review a pinned version).
- SDK README: `https://github.com/netlify/primitives/blob/main/packages/identity/prod/README.md`.
- Version-associated source commit `11913fe6c0613267be193ae7b17a24cf14acd50e`: `https://github.com/netlify/primitives/tree/11913fe6c0613267be193ae7b17a24cf14acd50e/packages/identity/prod/src`; specifically `user.ts`, `cookies.ts`, and `csrf.ts`.

This proposal augments the disabled foundation decision in ADR 0004; it does not authorize changing the adapter or beginning Sprint 1.
