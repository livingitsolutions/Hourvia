# Proposed authentication and protected-request architecture

Date: October 14, 2026. Status: **DESIGN ONLY**. See [ADR 0007](adr/0007-authentication-provider-proposal.md) for provider recommendation and primary sources. No auth feature, session table, endpoint, SDK dependency, or Identity activation was implemented.

## 1. Ports and trust separation

Preserve `AuthenticationProvider.authenticate(credential: string | null)` and its typed success/failure contract. A future HTTP adapter extracts exactly one approved credential transport; the provider-neutral credential passed to the application is an opaque application-session reference. It is not a client user ID, role, editable metadata, or tenant ID. Ambiguous multiple credentials and unsupported transports are rejected, not silently prioritized.

Only infrastructure owns provider URL/client configuration, token validation/refresh, encrypted provider credentials, and session lookup. A successful adapter returns the trusted global `UserId` only. A server-side request context can carry internal session/version information to transactions without expanding the principal into token-based role claims. Domain/application production code stays independent of Netlify, HTTP, SDKs, and encryption/storage implementation.

The current disabled adapter remains wired until all review, migration, isolated integration, HTTP-security, and hosting gates pass under separate authorization. There is no test-user or header/body identity bypass. No proposed routing here is an actual implemented endpoint.

## 2. Provider-neutral identity linkage

Freeze an allowlisted HTTPS provider endpoint and trusted issuer profile per environment. Ignore issuer/verification URL/JWKS hints supplied by an untrusted token or request. Production and preview Identity contexts must be isolated; production does not accept a preview issuer/cookie/session. Canonicalization of the configured issuer is fixed and tested, not arbitrary lowercasing or rewriting subject values.

Map only an authoritative provider subject and trusted issuer through unique `(issuer, subject)` in `external_identities`. A concurrent first login creates global user plus mapping in one transaction; unique-conflict losers roll back provisional rows and load the established mapping. An existing subject is never reassigned through a generic update. Email/name are profile data, never identity join keys; matching email across providers does not auto-link accounts.

Require the approved confirmation/account-eligibility policy before linkage or provisioning. Account recovery, provider migration, explicit cross-provider linking, unlinking the last credential, and invitations require separate proven-user workflows and security events. A verified external identity confers no workspace membership by itself. Personal workspace provisioning, if approved later, uses the atomic owner/audit/request protocol rather than a login-side partial write.

## 3. Authoritative provider validation

The proposal requires fresh authoritative provider acceptance of the same request's credential on each protected request, not merely an SDK user object from fallback claims. Validate expected issuer, subject, permitted algorithm/signature or authoritative provider verification, expiry/not-before, intended audience/resource/site binding, and current provider account/session eligibility. Provider endpoint access is HTTPS, fixed-origin, timeout-bounded, and never redirected to a token-selected host.

For Netlify Identity, demonstrate the supported request-scoped validation path and authoritative current-user/token result, including provider rejection and service outage. The reviewed SDK's server fallback uses validated platform context, but it still lacks the fresh provider-state evidence required here. Never infer provenance from which optional profile fields happen to be present. Online verification must have explicit success versus invalid/unavailable outcomes; timeout/5xx/malformed response returns unavailable without fallback authorization.

Exact token issuer/audience/signing profile and disable/logout semantics were not queried on this site. If its token profile lacks an `aud` claim, review must explicitly approve authoritative issuer/site-bound resource verification as the audience-binding mechanism and reconcile ADR 0004 before integration. Do not invent an audience check or silently omit the accepted requirement. Offline signature verification, if later approved, needs pinned issuer/JWKS/algorithms, bounded key rotation, expiry checks, and an explicit revocation freshness policy; token decoding alone is never verification.

Platform-verified context can be a cryptographic input only after its request binding is proven on modern deployed Functions; a client header named like a platform context is not trusted. Do not reuse process-global mutable session state between concurrent requests or use browser/localStorage SDK sessions in server handlers.

## 4. Session storage and browser boundary

Propose a BFF serving only the exact application origin. Browsers receive a random, high-entropy opaque `__Host-hourvia_session` cookie with Secure, HttpOnly, Path `/`, no Domain, and SameSite=Lax. Store only the session identifier's cryptographic hash in a new Netlify Database session table. This is a proposal, not a cookie already set by Hourvia.

Session records include global user, trusted external-identity reference, account/session auth epoch, creation/last-activity/absolute-expiry times, revocation time, and strictly server-side provider-token material if needed. Encrypt sensitive provider access/refresh material with authenticated encryption and an approved server-only key reference, versioned rotation, and associated session/user/provider binding. Tokens never appear in external identity mappings, audit metadata, response bodies, logs, browser storage, frontend environment variables, or source. Missing key/configuration fails closed. Cryptographic-key handling requires its own operational review; no key is created or printed here.

Proposed starting limits for review: 30-minute application idle timeout, 12-hour absolute session lifetime, and provider access tokens targeted at no more than 15 minutes where supported. These are requested settings, not observed provider defaults or an approved product policy. Application expiry is checked server-side on every request independently of cookie retention. Never extend absolute lifetime indefinitely on refresh.

Rotate the opaque app session at login, recovery, explicit privilege-sensitive reauthentication, and other approved transitions; invalidate the old identifier. Serialize refresh per session, persist successful rotation atomically, reject revoked/expired refresh state, and do not let a failed refresh grant a stale session. Logout first revokes local session state and clears the cookie, then attempts provider logout with bounded retries; provider outage cannot restore local access. Refresh/session credentials never cross to the browser.

**SDK transport gate:** current reviewed defaults produce browser-readable `nf_jwt`/`nf_refresh`. Before using login/signup/refresh wrappers, prove a supported token-only/server flow and response-cookie control that meets the BFF requirements. Native HTTPS transport to an explicitly supported provider endpoint may be evaluated alongside `@netlify/identity` helpers, but no undocumented monkey-patching of global runtime state or assumption about intercepted Set-Cookie ordering is accepted. The supported SDK remains the auth library; no direct deprecated-client dependency is introduced. If compatible supported transport cannot be established, provider/session design returns to senior review. Do not implement a knowingly weaker cookie flow first.

## 5. Revocation, disabled accounts, and security events

Propose additive global account state/auth epoch and a server session store in a future migration; neither exists in the current schema. Local disable, recovery, or logout invalidates the applicable sessions/epoch. Every protected request checks both provider eligibility and local account/session state. Every business write rechecks local state under the same account/session locks used by revocation, then membership under workspace/member locks.

Local revocation linearizes at its database commit: a transaction already holding valid locks may finish first; later operations deny. Provider-only revocation has no shared PostgreSQL lock and cannot honestly promise zero-latency propagation. Online provider checks bound access by the provider's documented visibility; before approval, establish and test the provider's exact disable/logout/refresh revocation behavior and maximum detection window. If the target is immediate app-level denial, route administrative revocation through the app's durable state as well as the provider. Authentic lifecycle events may update app state, but delivery delay cannot be the sole gate.

Provider lifecycle/event input must have proven platform-authenticated provenance or verified signature, timestamp, and anti-replay identity; an arbitrary HTTP JSON body never disables/enables or maps a user. Idempotent event processing and verified current-state reconciliation are planned. Unknown provider account state, failed mapping, invalid/expired session, or disabled global user grants no principal.

Maintain a separate append-only global identity/security event trail for login failure, disable/revoke/recovery and session lifecycle. Do not attach provider-system events to a fabricated tenant or fake human actor. Its privileges, allowable service principals, sensitive-data limits, and retention require review separately from tenant business audit. Provider roles and editable app/user metadata never replace ACTIVE persisted workspace membership.

## 6. CSRF, CORS, redirects, and content policy

Same-origin by default: no cross-origin credentialed API access and no wildcard CORS headers. Compare Origin against configured exact allowed application origin(s), not reflected Host/client configuration. Exact approved preview origins are separately scoped; do not trust every Netlify subdomain. OPTIONS never creates a mutation or business principal.

For cookie-authenticated mutations, require an allowed non-null Origin, appropriate Fetch Metadata where present, JSON content type, bounded body, and a synchronizer CSRF token tied to the server session. SameSite alone is not sufficient. Login/signup/recovery initiation also require origin verification and a short-lived pre-authentication CSRF state, preventing login CSRF before an authenticated session exists. GET/HEAD remain non-mutating. Validate every redirect/return path against a local allowlist to prevent token leakage/open redirects.

`verifyRequestOrigin` from the supported SDK is a useful check, not the whole session-CSRF design. Its configured allowlist must match the approved exact origins; do not bypass missing/null Origin for browser mutations. A future non-browser integration uses a separately reviewed credential transport rather than disabling CSRF for everyone.

OAuth/provider callback, if later enabled, needs single-use state, safe callback binding, PKCE where supported by the chosen flow, no arbitrary return URL, and isolated handling of protocol-required redirect behavior. No implicit browser token delivery or generic callback-origin exemption is approved by this proposal. Signed service callbacks have a separate authentication path, not a CORS or CSRF bypass for browser actions.

No new CORS headers were configured in this sprint. A future restrictive CSP and escaped presentation reduce XSS exposure but do not excuse browser-readable refresh credentials or missing server authorization.

## 7. Distributed rate limiting

Rate-limit login, signup/invitation acceptance, recovery, refresh, mapping/provisioning, and protected mutations with separate policies. Proposed review starting values are five failed login attempts per account-identifier bucket per 15 minutes and 20 attempts per trusted client-IP bucket per 15 minutes, plus a session/user mutation budget to be defined per use case. Do not treat these untested thresholds as production configuration; assess NAT/shared-network usability, denial-of-service, accessibility, and recovery.

Use an atomic, time-bounded Netlify Database security counter keyed by action and a protected hash of the identifier/trusted network attribute; raw email/IP and credentials are not stored in bucket keys/logs. Trusted IP comes from the verified platform request context, never arbitrary forwarding headers. Persist counters across function instances; no per-process map/local JSON fallback. A configured platform distributed limiter can add an edge fence only after its availability and semantics are verified; no such configuration was assumed here.

Limiter persistence/configuration failure returns safe unavailable for protected paths, not unlimited access. Authenticated 429 responses include a bounded Retry-After where appropriate; login/recovery messages remain non-enumerating. Counters/security events are separate from business mutation/audit transactions, with reviewed retention and no raw provider error dumps. Load/cost and failure behavior need isolated tests.

## 8. Authorization and fail-closed HTTP results

After authentication, request validation selects a tenant but never grants access. The application authorization port retrieves persisted ACTIVE membership and checks archive status and role capability. Fixed mutation operations add narrower ownership/administration/no-self-review policies, user/session and membership lock rechecks, tenant-qualified predicates, and atomic audit/deduplication. Session/JWT roles are ignored for tenant permission.

| Condition | Proposed safe response |
| --- | --- |
| Missing/invalid/expired/revoked credential or disabled global user | 401, generic unauthenticated; no account-existence detail |
| Authenticated but tenant permission denied/missing membership/archived workspace | 403, same generic forbidden message for inaccessible scopes |
| Owned/scoped resource missing or inaccessible within permitted tenant | Consistent 404 without cross-tenant existence disclosure |
| Provider, mapping, session store, authorizer, limiter, or required configuration unavailable | 503; no fallback user/role or internal exception detail |
| Throttled request | 429; safe bounded retry information |
| Invalid body/type/size or unsupported method | 400/415/413/405 with appropriate safe headers |
| Changed idempotent payload or reviewed version conflict | 409; never disclose another tenant's result |

Authentication-invalid versus infrastructure-unavailable stays typed behind the current port. Dependency outages are not translated into permissive anonymous state. Protected/session responses use no-store and appropriate cache controls; cookies/credentials are never cached as static output. Browser shell routing is not authorization; every function has the same fail-closed composition. Server-generated correlation IDs help investigation without logging secrets.

## 9. Required evidence before integration approval

Confirm provider service/plan eligibility and registration settings without activating it in this sprint. Demonstrate the exact supported SDK/transport version in modern Functions; issuer/subject/audience binding; untrusted-context rejection; online-invalid versus outage behavior; emitted cookie attributes/no extra provider-token cookies; session expiry/rotation/logout; local and provider revocation windows; account confirmation/recovery policy; CSRF/CORS/redirect denial; persistent distributed throttling; and concurrent request/session isolation.

Combine those adapter/HTTP tests with the [isolated database plan](database-integration-test-plan.md), approved grants/pooling assumptions, and verified automatic-build evidence. The current health handler and 99 offline tests are not auth acceptance evidence. Senior approval of the provider, BFF transport, lifetimes, registration, recovery, key handling, rate limits, and revocation SLA is required before Sprint 1 may be separately authorized.
