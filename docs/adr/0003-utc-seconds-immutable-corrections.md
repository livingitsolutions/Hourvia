# ADR 0003 — UTC instants, integer seconds, immutable corrections

Date: 2026-10-14. Status: proposed policies; shared value contracts accepted.

## Context

Browser clocks, daylight saving changes, edits, and approval snapshots can produce ambiguous or irreproducible totals.

## Decision

Use millisecond UTC instants and `timestamptz(3)`. Preserve IANA timezone strings. Canonical duration is floor of elapsed seconds, without billing rounding. Enforce one active timer per user/workspace through a composite key. Finalized entries are immutable. Corrections carry full replacement values, increasing revision numbers and reason; only approved revisions replace the base in the effective projection. Approved voids exclude records. Use effective-start-local-date attribution, not implicit midnight splitting.

Submitted/approved timesheets lock their affected contents and periods. Approvals and reopen events are append-only, target exact versions, and cannot overwrite earlier decisions. Business self-approval is prohibited; personal automatic approval still creates a decision record. Separate immutable submission-version and full effective-entry snapshot tables preserve prior time values across reopening; enforcement and workflow implementation are deferred.

## Consequences

Reporting never adds base and correction values. DST handling derives local boundaries independently. Midnight-spanning entries belong entirely to their start day until a future interval-allocation ADR. Database triggers, review workflows, reporting queries, and live timer persistence remain unimplemented. Overlap handling, billing rounding, and sole-owner business review exceptions require product decisions.
