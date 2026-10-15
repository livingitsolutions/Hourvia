# Isolated database integration-test plan

Date: October 14, 2026. Status: **PLAN ONLY — no database connected, branch provisioned, fixture written, or test run**.

## Environment and authority gates

Obtain explicit approval for an isolated Netlify Database test branch with synthetic data and inherited, already-recorded baseline migration. Verify the branch identity, isolation, PostgreSQL version, and migration ledger before writes. Do not point the harness at production or the existing shared preview branch, import production user data, or replay/regenerate `20261014193353_wise_hawkeye`. If an appropriate inherited baseline cannot be established through approved branch mechanisms, stop for platform review rather than reconstruct the applied migration.

Only later, separately approved work may implement/apply new forward hardening on that isolated branch and add the integration harness. Preserve the baseline fingerprints before/after. Use separate migrator/invariant/function-owner/runtime roles matching the reviewed production-intended grants. Privilege-denial tests must run with actual runtime credentials or an independently verified equivalent role, not solely as a table owner using pretend checks. Keep credentials in protected runtime configuration; log sanitized case IDs/SQLSTATEs, not connection strings, tokens, user payloads, or raw credential-bearing errors.

Fixtures use generated synthetic global users, isolated PERSONAL/BUSINESS tenants, active owner/member/viewer memberships, and test-only verified principals behind the existing auth port. Fixture creation is confined to the approved test branch. No test identity bypass is added to production. Clean up through branch disposal under explicit approval; append-only history and personal rows are not truncated/deleted to reset tests. Provision distinct case-scoped tenants/users instead.

## Harness and concurrency rules

Use at least two independent database connections and explicit synchronization barriers, not timing sleeps alone. Confirm transaction handles and commit/rollback outcomes. Give each case bounded statement/lock timeout and a deterministic expected serialization order. Exercise both the secured operation path and direct forbidden runtime SQL. Record exact new migration IDs, baseline hashes, branch provenance, effective roles, database/driver versions, sanitized SQLSTATEs, and committed row/event counts.

Initially test READ COMMITTED with the prescribed user/session/workspace/member lock order. Additional SERIALIZABLE runs may test full-transaction retry behavior but do not substitute for the actual intended isolation. Tests must await COMMIT: a successful INSERT before a deferred constraint fires is not acceptance. Force deferred checks in selected cases to confirm early detection too.

## Required cases and expected evidence

| Case | Schedule / action | Required result |
| --- | --- | --- |
| Concurrent PERSONAL creation, same key/hash | Two connections authenticate the same user; barrier before stable user lock; issue identical request | Both get the same authorized result; one workspace, one ACTIVE matching OWNER, one committed request result/canonical audit event |
| Concurrent PERSONAL creation, different keys | Same user, different creation requests, simultaneous attempts | At most one lifetime slot; loser converges to existing workspace or documented conflict; no orphan/second owner |
| Archived lifetime slot | Archive existing personal tenant; attempt creation with another key | Original slot remains; no replacement workspace, type conversion, reassignment, hard delete, or truncate |
| Missing/mismatched owner | Privileged constraint-test path inserts workspace without owner, wrong-owner membership, or owner mismatch; COMMIT | Deferred consistency rejects transaction; no persisted invalid workspace/membership or misleading audit |
| PERSONAL membership restrictions | Attempt ACTIVE/SUSPENDED/REMOVED non-owner rows, non-OWNER owner role, and owner suspend/remove | Denied at operation/constraint boundary; exactly one matching ACTIVE membership remains |
| BUSINESS transfer | Valid locked transfer and two competing transfer targets; generic ADMIN/role-update attempts | Only authorized atomic transfer succeeds; immediate uniqueness retained; final single matching owner; failed transfers leave old owner intact |
| Cross-tenant reads | User in tenant A requests tenant B object/list/count/export, including guessed global IDs | No B data, identifiers, or counts returned; consistent safe denial; owned-resource predicates tested within A too |
| Cross-tenant writes/links | A-scoped entry/project/member relation targets B ID; crafted audit references B entity | FK/operation/attribution denial; no mutation, request-result disclosure, or cross-tenant audit event |
| Unauthorized membership creation | Runtime direct INSERT; VIEWER/MEMBER/ADMIN generic commands; forged actor/owner/role; unverified invitation target | Privilege/action denial; no membership or extra PERSONAL row; provider metadata role grants nothing |
| Revocation wins | Revoker locks required roots, removes/suspends subject, commits; waiting write resumes | Write rechecks and fails; no business mutation/audit success record |
| Write wins | Writer locks roots and validates ACTIVE membership; revoker waits; writer commits, then revoker commits | One valid write before revocation; every later write denied; order documented without claiming retroactive cancellation |
| Disable/session revocation | Disable account or revoke session under account/session locks while write is staged | Same serialization guarantee; stale HTTP principal/old auth epoch cannot authorize later mutation |
| Audit actor mismatch | Event actor belongs only to another tenant, disagrees with principal, or is target rather than actor | Denial with safe error; bootstrap event succeeds only with matching in-transaction owner membership |
| Audit update/delete denial | Runtime attempts UPDATE, DELETE, TRUNCATE; attempts function/trigger privilege bypass | Denied; event/obligation bytes unchanged; no runtime trigger disabling/SET ROLE/DDL rights |
| Missing canonical audit | Protected write creates obligation but operation omits audit or inserts it in another workspace | Deferred obligation FK rejects COMMIT and rolls back business rows and request result |
| Explicit rollback/fault injection | Fail after root insertion, owner insertion, business DML, audit write, or deduplication insert | All staged state rolls back; no orphan owner/workspace, unaudited write, or falsely completed request |
| Duplicate request retries | Same key/hash after success, overlapping retries, and dropped response after actual COMMIT | One mutation/audit/result; return original authorized response after fresh authentication/authorization |
| Changed payload retry | Same scoped key with changed normalized request hash | Safe 409; original result remains immutable; no second mutation/event |
| Revoked replay | Valid recorded response followed by removal/disable, then replay | Deny rather than return cached privileged data |
| Retryable deadlock/serialization fault | Deterministically induce contention/failure; reuse logical key; exhaust bounded retries | Whole-operation retry only; no duplicate state; bounded safe unavailable/conflict on exhaustion |
| Pooled context reuse | A transaction succeeds, fails, times out, or is cancelled; next borrower starts without scope or as B | No residual A context; missing/malformed context denies; B sees only B; same tests through actual adapter transport |
| Optional RLS | Exercise USING/WITH CHECK, roots/descendants/global exceptions, definer/invariant roles, owner bypass, TRUNCATE | Claimed policies work with actual roles; no recursion; no accidental unfiltered invariant count; optional RLS absence explicitly recorded |

Test stable tenant selectors and branded/canonical row mapping at repository boundaries. Assert documented SQLSTATE categories where PostgreSQL supplies them (for example unique violation, privilege denial, foreign-key failure, deadlock, serialization failure) without baking implementation-specific custom trigger messages into security behavior. HTTP safe-error mapping receives separate adapter tests.

## Release criteria

All required cases pass on the reviewed forward-hardening branch and runtime role; connection/pooling evidence is reproducible; deferred constraints are observed at commit; no production branch is involved; migration fingerprints remain unchanged; source unit tests still pass. Optional RLS may remain explicitly deferred only if mandatory procedure privileges, scoped authorization, locks, and tenant FKs are proven and senior review approves that posture. Missing mandatory role/transaction capabilities is a release blocker, not a reason to skip a case.

A sanitized signed-off test record must identify branch, migration versions, roles, environment, case outcomes, failure injections, concurrency schedules, and reviewer. No planned case is marked PASS until actually executed. Existing 99 offline tests do not satisfy this plan.
