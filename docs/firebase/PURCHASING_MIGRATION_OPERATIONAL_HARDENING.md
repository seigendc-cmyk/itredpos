# Purchasing migration operational hardening (Build 09.1D)

Build 09.1D makes the Build 09.1C controls observable and explicitly testable without changing the purchasing authority chain.

Build 09.1E connects these controls to the live authority through [PURCHASING_MIGRATION_CANONICAL_ADAPTER.md](./PURCHASING_MIGRATION_CANONICAL_ADAPTER.md).

## Approval and warning controls

Warnings use stable issue IDs and every ID must be acknowledged before approval. The approval stores the vendor, preparer, approver, preview version, source fingerprint, warning IDs, and migration version. An explicit effective-permission context is mandatory. Self-approval is denied unless that context explicitly grants it. Any preview, fingerprint, version, or vendor change invalidates the approval and its acknowledgements. Approval identity and warning IDs are sealed by Firestore rules after approval.

## Exactly-once effects and retry

The orchestrator derives destination identity from vendor, legacy source type, record type, and legacy ID. Payload changes therefore cannot silently create a second identity; a different fingerprint at the same identity fails with `FINGERPRINT_CONFLICT`. Canonical repository transactions and mutation receipts remain responsible for atomic inventory and supplier-balance effects.

Resume examines the latest record result. `migrated`, `duplicate`, `skipped`, and `invalid` records are not retried. Only a `failed` result marked `retryable` is eligible. Attempts preserve migration run and source identity and increment `attemptNumber`.

## Legacy shutdown and readiness

Read-only discovery remains enabled. Known legacy mutation entry points are reported separately and must all be disabled. Readiness returns named blockers for incomplete migration/reconciliation, record failures, unacknowledged warnings, balance or inventory mismatches, unhealthy canonical repositories, active legacy paths, and missing rules or authority test evidence. Legacy data is not deleted.

## Diagnostics and failure codes

Each attempt may emit a diagnostic containing run/vendor/branch identifiers, record/type/legacy ID, source fingerprint, operation, result, error code/message, retryability, timestamp, and attempt number. Full source payloads and credentials are never included.

Operational codes are `VALIDATION_FAILURE`, `MISSING_DEPENDENCY`, `DUPLICATE_SOURCE`, `FINGERPRINT_CONFLICT`, `PERMISSION_DENIED`, `APPROVAL_INVALID`, `WARNING_ACKNOWLEDGEMENT_MISSING`, `RECONCILIATION_MISMATCH`, `TRANSIENT_WRITE_FAILURE`, `NON_RETRYABLE_WRITE_FAILURE`, and `LEGACY_PATH_STILL_ENABLED`.
