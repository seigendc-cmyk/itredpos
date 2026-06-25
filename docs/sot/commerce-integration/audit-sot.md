# Commerce Audit SOT v1.0

## Purpose

The Commerce Audit Layer provides immutable accountability across the seiGEN Commerce Operating System.

Every critical business action must generate an audit record.

Audit records support:

- Staff accountability
- Fraud investigation
- Compliance
- Risk scoring
- Operational BI
- Security monitoring
- Internal controls
- Regulatory reporting

Audit records are append-only.

They are never edited or deleted.

---

## Audit Principles

1. Every critical action creates an audit record.
2. Audit records are immutable.
3. Audit records never replace operational records.
4. Audit records never drive business logic.
5. Audit records support investigation and BI.

---

## Standard Audit Record

Every audit record shall contain:

auditId

vendorId

branchId

warehouseId

terminalId

staffId

application

module

action

entityType

entityId

before

after

device

ipAddress

gps

riskScore

correlationId

createdAt

---

## Critical Actions

Sales

Sale Completed

Sale Cancelled

Refund

Discount Override

Price Override

Void Transaction

Inventory

Stock Adjustment

Stock Transfer

Goods Receiving

Product Transformation

Stock Count

Negative Stock Attempt

Operations

Shift Open

Shift Close

Cash Declaration

Cash Variance

Drawer Open

Drawer Close

Login

Logout

Permissions

Role Created

Role Changed

Staff Created

Staff Disabled

Permission Granted

Permission Revoked

Licensing

License Activated

License Renewed

Token Redeemed

Delivery

Delivery Assigned

Delivery Accepted

Delivery Confirmed

Cash Collected

Driver Changed

Vendor

Branch Created

Warehouse Created

Terminal Registered

---

## Risk Levels

Low

Normal business activity

Medium

Requires supervisor visibility

High

Requires investigation

Critical

Immediate management notification

---

## Audit Rules

Every audit record must include

vendorId

staffId

application

module

action

entityId

timestamp

No operational module may delete audit records.

Audit collections are read-only after creation.

---

## Firestore Collection

auditLogs

Future

auditAlerts

auditInvestigations

auditEvidence

---

## Integration

Operational Modules

?

Audit Publisher

?

auditLogs

?

Operations BI

?

Risk Engine

?

Management Dashboard

