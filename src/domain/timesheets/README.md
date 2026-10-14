# Timesheets

Owns future local-date reporting periods, versioned submission snapshots, and submission/lock state. Consumes effective entries and immutable approval decisions. Submitted/approved contents and affected periods are locked by proposed policy. Historical snapshot tables are proposed in the offline schema; append-only enforcement and cross-period exclusion remain mandatory future implementation work, not database guarantees today.
