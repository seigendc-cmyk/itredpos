# Commerce Event Spine SOT v1.0

## Purpose

The Commerce Event Spine is the central nervous system of the seiGEN Commerce Operating System.

Every business application publishes standard business events into the Event Spine.

Applications do not communicate directly through business logic. They communicate by publishing and consuming events.

The Event Spine provides the foundation for:

- Commerce BI
- Audit
- Alerts
- Dashboards
- Notifications
- Future AI
- Reporting
- Automation
- Integration between applications

---

## Core Principles

1. Operational transactions complete first.
2. Events are published only after successful completion.
3. Events are immutable.
4. Events describe facts that already happened.
5. BI consumes events passively.
6. Event consumers must never modify operational records.

---

## Standard Event Envelope

Every event shall contain:

version
eventId
eventType
sourceApp
sourceModule
aggregateType
aggregateId
vendorId
branchId
warehouseId
staffId
customerId
supplierId
terminalId
correlationId
causationId
occurredAt
payload
riskScore

---

## Event Version

Every event must include

version = 1

Future changes will increase the version without breaking older consumers.

---

## Correlation ID

Every business process must share one correlationId.

Example

Sale

?

Inventory Update

?

Delivery Request

?

WhatsApp Notification

?

BI Processing

?

Audit

All share the same correlationId.

---

## Event Rules

Events must be:

- append-only
- immutable
- timestamped
- versioned
- tenant aware
- source aware

Events must never contain UI state.

Events must never contain temporary application state.

---

## Approved Event Groups

Sales

SaleCreated

SaleCompleted

SaleCancelled

SaleRefunded

Inventory

StockReceived

StockIssued

StockAdjusted

StockTransferred

StockCounted

StockDamaged

StockExpired

Purchasing

PurchaseReceived

Transformation

TransformationCreated

TransformationCompleted

TransformationCancelled

Delivery

DeliveryRequested

DriverAssigned

DriverAccepted

PickedUp

GPSUpdated

Delivered

DeliveryConfirmed

CashCollected

Discovery

CatalogueViewed

ProductViewed

VendorViewed

WhatsAppClicked

EnquiryCreated

Licensing

LicenseActivated

LicenseExpired

LicenseRenewed

TokenRedeemed

Operations

ShiftOpened

ShiftClosed

TerminalLocked

TerminalUnlocked

CashDeclared

CashVarianceDetected

ApprovalRequested

ApprovalGranted

ApprovalRejected

---

## Firestore Collections

commerceEvents

auditLogs

Future collections

eventDeadLetter

eventReplay

eventSnapshots

---

## Publisher Responsibilities

Operational modules publish events.

They never process BI.

They never perform analytics.

---

## Consumer Responsibilities

Consumers include

Sales BI

Inventory BI

Transformation BI

Marketing BI

Delivery BI

Operations BI

Customer BI

Notification Service

Reporting

Future AI

Consumers never change operational records.

---

## Build Sequence

Build 1
SOT Documents

Build 2
Event Registry

Build 3
Event Publisher

Build 4
Audit Publisher

Build 5
BI Consumers

Build 6
POS Instrumentation

Build 7
Cross Application Integration

