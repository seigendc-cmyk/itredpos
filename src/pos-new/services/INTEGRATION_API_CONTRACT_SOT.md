# Integration API Contract SOT (Source of Truth)

This document defines the public API contract for the Commerce Integration layer. Any interaction between the core POS application and the integration services (events, audit, BI) must use these defined functions and interfaces.

## Guiding Principles

- **Passive and Non-Intrusive**: Integration logic must not mutate core operational records (sales, stock, etc.). Its role is to observe and report.
- **Asynchronous**: Event and audit logging must be asynchronous (`async`) and should not block the main execution thread of the core transaction.
- **Post-Transaction Execution**: Logging must occur only *after* the core business transaction has successfully completed and been persisted.
- **Single Responsibility**: Each function must have a single, well-defined purpose.

## Public API Surface

### 1. Event Publishing

**Function**: `publishCommerceEvent(eventInput: CommerceEventInput): Promise<void>`

- **File**: `src/commerce-integration/events/publishCommerceEvent.ts`
- **Description**: Publishes a business event to the `commerceEvents` collection in Firestore. This is the sole entry point for creating new commerce events.
- **Contract**:
  - Must not throw an error that blocks the caller. Errors should be handled gracefully (e.g., logged internally).
  - Must only write to the `commerceEvents` collection.
  - The `CommerceEventInput` interface is defined in `src/commerce-integration/events/commerceEvents.ts`.

### 2. Audit Logging

**Function**: `writeAuditLog(logEntry: AuditLogInput): Promise<void>`

- **File**: `src/commerce-integration/audit/writeAuditLog.ts`
- **Description**: Writes a detailed audit trail entry for significant, security-sensitive, or high-risk actions.
- **Contract**:
  - Must only write to the `auditLogs` collection.
  - The `AuditLogInput` type contract is defined within the function signature in `writeAuditLog.ts`.

### 3. BI Consumption (Internal Hooks)

**Functions**: `consume...BIEvent(event: CommerceEvent): void`

- **File**: `src/commerce-integration/bi/index.ts`
- **Description**: A set of functions (`consumeSalesBIEvent`, `consumeInventoryBIEvent`, etc.) that act as internal consumers for events. These are placeholders for future passive BI logic.
- **Contract**:
  - These functions are for internal use by the BI subsystem only.
  - They MUST NOT write back to or mutate any operational POS records.
  - Their purpose is strictly for passive analysis, analytics aggregation, or triggering external alerts.