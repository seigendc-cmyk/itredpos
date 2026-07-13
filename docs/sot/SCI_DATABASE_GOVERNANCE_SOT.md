# SCI Database Governance SOT

**Owner:** Digital Commerce (Private) Limited  
**Status:** Controlled Source of Truth  

## Scope

This SOT governs:

- Firestore.
- SQLite.
- PostgreSQL.
- Offline data stores.
- Future SCI databases.

## Data rules

- vendorId is the primary tenant boundary.
- branchId separates branch operations.
- terminalId identifies terminal operations.
- Critical records require timestamps and actor identity.
- Financial and stock records require immutable movement history.
- Sensitive operations require audit records.

## Transaction rules

Use transaction-safe or idempotent writes for:

- Sales.
- Payments.
- Stock movements.
- Returns.
- Transfers.
- Shifts.
- Approvals.

## Migration rules

Every migration must record:

- Source schema version.
- Target schema version.
- Structures affected.
- Index changes.
- Backfill requirements.
- Backup requirements.
- Validation.
- Rollback.
