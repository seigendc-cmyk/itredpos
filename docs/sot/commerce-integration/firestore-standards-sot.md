# Firestore Standards SOT v1.0

## Purpose

Firestore is the operational database layer for iTredPOS and the wider seiGEN Commerce Operating System.

This SOT defines how Firestore collections, documents, identifiers, timestamps, tenancy, and write rules must be handled across iTredPOS, iDeliver, Vendor Discovery, Console, Licensing, Audit, Event Spine, and BI.

---

## Core Rule

Firestore must support multi-tenant commerce safely.

Every operational record must be tenant-aware.

The minimum tenant identifier is:

vendorId

Where applicable, records must also include:

branchId

warehouseId

terminalId

staffId

correlationId

---

## Collection Naming Standard

Use camelCase collection names.

Approved examples:

vendors

branches

warehouses

staff

roles

permissions

terminals

products

productCategories

customers

suppliers

sales

saleItems

shifts

stockMovements

stockAdjustments

stockTransfers

goodsReceivingNotes

productTransformations

deliveries

commerceEvents

auditLogs

biSalesMetrics

biInventoryMetrics

biTransformationMetrics

biMarketingMetrics

biDeliveryMetrics

biOperationsMetrics

biCustomerMetrics

biRiskScores

biAlerts

---

## Forbidden Collection Naming

Do not create duplicate naming styles for the same meaning.

Avoid:

vendor

Vendor

vendor_profile

vendorProfiles

businesses

merchants

Use:

vendors

Avoid:

sale_items

sales_items

invoiceItems

Use:

saleItems

Avoid:

eventLogs

events

businessEvents

Use:

commerceEvents

Avoid:

audit

logs

activityLogs

Use:

auditLogs

---

## Document Identifier Rules

System relationships must use approved IDs:

vendorId

branchId

warehouseId

staffId

terminalId

productId

customerId

supplierId

saleId

orderId

deliveryId

transformationId

licenseId

correlationId

Display codes may exist, but they must not replace system IDs.

Examples:

invoiceNo is allowed for display.

saleId is required for system relationship.

transferNumber is allowed for display.

transferId is required for system relationship.

---

## Timestamp Rules

Every operational record should include:

createdAt

updatedAt

Critical event and audit records must include:

occurredAt

createdAt

Use Firestore server timestamps where possible for persisted records.

Use ISO timestamps only when local/offline staging is required.

---

## Multi-Tenant Rules

Every vendor-owned record must include vendorId.

Every branch-owned record must include branchId.

Every terminal-owned record must include terminalId.

BI records must preserve vendorId and, where applicable, branchId and terminalId.

Audit records must preserve vendorId, staffId, module, action, entityType, and entityId.

---

## Operational Collection Rules

Operational records are the source of truth for business state.

Examples:

sales

stockMovements

shifts

deliveries

products

customers

suppliers

BI must not mutate these collections directly.

Audit must not mutate these collections directly.

Event consumers must not mutate these collections directly unless explicitly approved as an operational service.

---

## Event Collection Rules

commerceEvents is append-only.

Events describe completed business facts.

Events should not be silently edited.

If correction is required, publish a corrective event.

---

## Audit Collection Rules

auditLogs is append-only.

Audit records are never silently edited or deleted.

Audit supports accountability, investigation, compliance, and operational risk scoring.

---

## BI Collection Rules

BI may write only to BI-owned collections.

Approved examples:

biSalesMetrics

biInventoryMetrics

biTransformationMetrics

biMarketingMetrics

biDeliveryMetrics

biOperationsMetrics

biCustomerMetrics

biRiskScores

biAlerts

BI records must contain enough references to trace back to source events:

vendorId

branchId

sourceEventId

correlationId

metricType

calculatedAt

---

## Offline and Sync Rules

Offline records must preserve:

localId

syncStatus

createdOfflineAt

lastSyncAttemptAt

conflictStatus

Once synced, records must receive server-side identifiers or confirmed source identifiers.

Conflict resolution must never silently overwrite critical operational records.

---

## Security Rules Direction

Firestore security rules must enforce:

vendor tenancy isolation

branch-level access where applicable

role-based permissions

staff-level restrictions

admin-only configuration writes

audit immutability

event append-only behavior

BI read/write separation

---

## Build Rule

Before creating a new collection, check this SOT.

Before creating a new document shape, confirm it uses approved identifiers, timestamps, and tenant fields.
