# Audit

Owns future append-only tenant event history, trusted actor attribution, UTC occurrence, and request correlation. Write audit in the same transaction as the mutation. Metadata must be allowlisted and omit credentials, tokens, and sensitive free-form request payloads. No audit persistence exists in Sprint 0.
