# Event Naming Convention SOT v1.0

## Purpose

This document defines the official naming convention for all commerce events published within the seiGEN Commerce Operating System.

Every application must use these conventions.

Applications include:

- iTredPOS
- iDeliver
- Vendor Discovery
- Console
- Licensing
- Commerce BI

---

## Core Rule

Events describe completed business facts.

Events must always be named in the past tense.

Correct examples

SaleCompleted

StockTransferred

DeliveryConfirmed

LicenseActivated

Wrong examples

CompleteSale

TransferStock

DoDelivery

SaleComplete

StockTransfer

---

## Event Structure

<EventSubject><PastTenseAction>

Examples

SaleCompleted

SaleRefunded

ShiftOpened

ShiftClosed

StockAdjusted

StockTransferred

DeliveryRequested

DeliveryConfirmed

ProductViewed

CustomerRegistered

---

## Prefix Rules

Sales

SaleCreated

SaleCompleted

SaleCancelled

SaleRefunded

SaleVoided

Inventory

StockReceived

StockIssued

StockAdjusted

StockTransferred

StockCounted

StockExpired

StockDamaged

Purchasing

PurchaseOrderCreated

PurchaseReceived

SupplierBillCreated

SupplierPaymentRecorded

Transformation

TransformationCreated

TransformationCompleted

TransformationCancelled

TransformationReversed

Delivery

DeliveryRequested

DriverAssigned

DriverAccepted

DriverRejected

PickedUp

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

LicenseRenewed

LicenseExpired

TokenRedeemed

Operations

ShiftOpened

ShiftClosed

CashDeclared

CashVarianceDetected

ApprovalRequested

ApprovalGranted

ApprovalRejected

StaffLoggedIn

StaffLoggedOut

TerminalLocked

TerminalUnlocked

Security

RoleCreated

RoleUpdated

PermissionGranted

PermissionRevoked

UserDisabled

UserEnabled

---

## Event Rules

Every event name:

Must use PascalCase.

Must not contain spaces.

Must not contain underscores.

Must not contain hyphens.

Must not contain abbreviations unless officially approved.

---

## Event Ownership

Each event belongs to one source application.

Examples

SaleCompleted

Source:

iTredPOS

DeliveryConfirmed

Source:

iDeliver

CatalogueViewed

Source:

Vendor Discovery

LicenseActivated

Source:

Console

---

## Versioning

Do not rename existing events.

If meaning changes:

Increase event version.

Do not silently replace old event names.

---

## Deprecated Events

Deprecated events must remain readable for historical replay.

Never delete event history because an event name changes.

---

## Build Rule

Before publishing any new event:

1. Check this SOT.
2. Reuse an approved event if one already exists.
3. If a new event is required, update this SOT first before implementation.
