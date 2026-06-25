# Integration API Contract SOT v1.0

## Purpose

The Integration API Contract defines how iTredPOS, iDeliver, Vendor Discovery, Console, Licensing, Commerce BI, Audit, and future seiGEN Commerce applications exchange information safely.

This SOT prevents direct, uncontrolled cross-application writes.

---

## Core Rule

Applications must not directly mutate another application's operational records.

Cross-application communication must happen through:

- standard commerce events
- approved service APIs
- approved shared master entities
- approved integration contracts

---

## Approved Integration Methods

### 1. Commerce Events

Used for completed business facts.

Examples:

SaleCompleted

StockAdjusted

DeliveryRequested

LicenseActivated

CatalogueViewed

### 2. Shared Master Entities

Used for common identity records.

Examples:

vendorId

branchId

staffId

productId

customerId

terminalId

licenseId

### 3. Approved Service APIs

Used when one application must request a controlled action from another application.

Example:

iTredPOS requests delivery fulfillment from iDeliver.

### 4. BI Event Consumers

Used for passive analytics only.

BI consumers must not mutate operational records.

---

## Forbidden Integration Practices

Do not directly write to another application's operational collection.

Do not bypass the Event Spine.

Do not invent new identifier names.

Do not duplicate business logic in multiple applications.

Do not let BI repair operational records.

Do not let reporting modules create operational transactions.

Do not couple UI pages directly to another application's database internals.

---

## Request Contract Standard

Every integration request should include:

requestId

vendorId

sourceApp

targetApp

requestType

requestedByStaffId

branchId

terminalId

correlationId

payload

createdAt

status

---

## Response Contract Standard

Every integration response should include:

requestId

correlationId

status

message

result

errorCode

completedAt

---

## Delivery Integration Example

iTredPOS creates sale

?

SaleCompleted event published

?

iTredPOS creates DeliveryRequested integration request

?

iDeliver accepts request

?

DriverAssigned event published

?

PickedUp event published

?

Delivered event published

?

DeliveryConfirmed event published

?

BI consumes full correlationId journey

---

## License Integration Example

Vendor redeems top-up token

?

TokenRedeemed event published

?

LicenseActivated or LicenseRenewed event published

?

Console updates subscription state

?

POS reads license state

?

BI tracks license activity

---

## API Ownership

iTredPOS owns:

sales

saleItems

shifts

stockMovements

stockAdjustments

stockTransfers

goodsReceivingNotes

productTransformations

iDeliver owns:

deliveries

drivers

vehicles

deliveryAssignments

deliveryTracking

proofOfDelivery

Vendor Discovery owns:

vendorProfiles

catalogues

productViews

vendorViews

enquiries

Console owns:

tenants

plans

subscriptions

licenses

tokens

staffConsoleAccess

Commerce BI owns:

biSalesMetrics

biInventoryMetrics

biTransformationMetrics

biMarketingMetrics

biDeliveryMetrics

biOperationsMetrics

biCustomerMetrics

biRiskScores

biAlerts

Audit owns:

auditLogs

Event Spine owns:

commerceEvents

---

## Build Rule

Before integrating two modules:

1. Identify source application.
2. Identify target application.
3. Confirm ownership.
4. Decide whether the integration needs an event, a service API, or shared master data.
5. Do not write across boundaries unless the SOT explicitly approves it.
