# Firestore Standards SOT (Source of Truth)

This document outlines the standards and best practices for using Google Firestore within the iTred Commerce Integration layer. All new and existing services must adhere to these standards to ensure data consistency, security, and scalability.

## 1. Data Scoping and Multi-Tenancy

- **Vendor-First Model**: All operational documents MUST be scoped under the `/vendors/{vendorId}` collection path. This is the root for all tenant-specific data.
- **Required Fields**: Every operational document MUST include a `vendorId` field.
- **Branch and Terminal Context**:
  - Branch-specific records must include a `branchId` field.
  - Records originating from a terminal session must include a `terminalId` field.
  - Hierarchical data may be stored under nested collections, such as `/vendors/{vendorId}/branches/{branchId}/terminals/{terminalId}`.

## 2. Collection Naming

- **Use camelCase**: Collection names must be in `camelCase` (e.g., `commerceEvents`, `auditLogs`).
- **Pluralization**: Collection names should be plural to indicate they hold multiple documents (e.g., `salesReceipts`).

## 3. Document IDs

- **System-Generated IDs**: Unless there is a strong and specific reason for a natural key, use Firestore's default auto-generated document IDs.
- **Human-Readable IDs**: For entities that require a human-readable identifier (e.g., `invoiceNo`, `adjustmentNumber`), store it as a field within the document. This field should be unique within its scope (e.g., unique per vendor/branch).

## 4. Timestamps

- **ISO 8601 Format**: All date and time fields must be stored as strings in ISO 8601 format (e.g., `2026-06-25T14:30:36.123Z`). This ensures consistency and simplifies queries and sorting.
- **Standard Fields**: Use `createdAt` for document creation time and `updatedAt` for the last modification time.

## 5. Security and Rules

- **Default Deny**: Firestore security rules will be implemented with a "default deny" policy. Access to any document path must be explicitly granted.
- **Role-Based Access Control (RBAC)**: Rules will enforce access based on the authenticated user's role and tenant (`vendorId`) claims.
- **Input Validation**: Security rules will perform basic input validation to protect data integrity (e.g., checking data types, required fields, and value constraints).

## 6. Specific Collection Contracts

- **`commerceEvents`**:
  - **Purpose**: Immutable, append-only log of all significant business events.
  - **Write Access**: Only the `publishCommerceEvent` function is permitted to write to this collection.
  - **Mutation Rule**: Documents in this collection must never be updated or deleted.

- **`auditLogs`**:
  - **Purpose**: Immutable, append-only log for critical system and user actions.
  - **Write Access**: Only the `writeAuditLog` function is permitted to write to this collection.
  - **Mutation Rule**: Documents in this collection must never be updated or deleted.

## 7. Offline and Sync Strategy

- **Offline Queue**: Records intended for Firestore that are created while offline will be stored in a local queue.
- **Sync Collection**: Upon reconnection, these records will be processed and written to their target collections. The master sync queue will reside at `/vendors/{vendorId}/offlineSyncQueue`.
- **Conflict Resolution**: A dedicated conflict resolution strategy will be implemented to handle cases where local and remote data have diverged. Conflicts will be logged to `/vendors/{vendorId}/syncConflicts` for manual or automated resolution.