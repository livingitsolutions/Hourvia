# Application layer

Depends only on domain contracts and application ports. Identity supplies trusted principals; workspace authorization composes identity and repository ports with a fail-closed membership policy. Future mutation use cases must enforce resource ownership, transaction-local membership verification, idempotency, locks, and audit. No framework or database imports belong in production application code.
