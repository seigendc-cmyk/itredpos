# Commerce Build Order SOT v1.0

## Purpose

This document defines the mandatory development sequence for the seiGEN Commerce Operating System.

Every new module, feature, service, or application must follow this build order to maintain architectural consistency and prevent technical debt.

This applies to:

- iTredPOS
- iDeliver
- Vendor Discovery
- Console
- Licensing
- Commerce BI
- Audit
- Event Spine
- Future Commerce Services

---

## Core Principle

Never implement business functionality before its architectural foundation exists.

Documentation defines architecture.

Architecture defines contracts.

Contracts define implementation.

Implementation produces operational behaviour.

Operational behaviour produces events.

Events produce intelligence.

---

# Standard Development Lifecycle

## Phase 1

System of Truth (SOT)

Purpose

Define business rules before writing code.

Deliverables

Business SOT

Integration SOT

BI SOT

Event Spine SOT

Audit SOT

Firestore Standards

Master Entity Standards

Naming Standards

API Contracts

Build Order

---

## Phase 2

Shared Foundation

Purpose

Create reusable infrastructure.

Deliverables

Shared Types

Master Entity Models

Commerce Event Envelope

Audit Envelope

Repository Standards

Utilities

Validation Rules

---

## Phase 3

Event Spine

Purpose

Enable applications to publish standard business events.

Deliverables

Event Registry

Event Publisher

Event Dispatcher

Event Replay

Dead Letter Queue (future)

Versioning

Correlation IDs

---

## Phase 4

Operational Modules

Purpose

Build business functionality.

Examples

Sales

Inventory

Purchasing

Goods Receiving

Product Transformation

Customers

Suppliers

Branches

Warehouses

Shift Control

Cash Control

Pricing

Licensing

Delivery

---

## Phase 5

Instrumentation

Purpose

Connect operational modules to the Event Spine.

Requirements

Publish events only after successful operations.

Write audit records.

Never publish incomplete transactions.

Never publish failed operations.

---

## Phase 6

Commerce BI

Purpose

Consume business events.

Domains

Sales BI

Inventory BI

Transformation BI

Marketing BI

Delivery BI

Operations BI

Customer BI

Risk BI

---

## Phase 7

Dashboards

Purpose

Present business intelligence.

Examples

Owner Dashboard

Branch Dashboard

Cashier Dashboard

Warehouse Dashboard

Delivery Dashboard

Console Dashboard

---

## Phase 8

Automation

Purpose

Convert BI into actions.

Examples

Alerts

Notifications

Approvals

Fraud Detection

Stock Recommendations

Reorder Suggestions

Performance Scoring

---

## Phase 9

AI and Advanced Intelligence

Purpose

Build advanced decision support.

Examples

Forecasting

Demand Prediction

Anomaly Detection

Vendor Recommendations

Operational Optimisation

---

## Build Rules

Never skip phases.

Never build dashboards before BI exists.

Never build BI before the Event Spine exists.

Never publish events before defining event contracts.

Never build APIs before defining API contracts.

Never create Firestore collections without checking Firestore Standards.

Never introduce new identifiers without checking the Master Entity SOT.

Never rename approved events without updating the Event Naming Convention SOT.

---

## Definition of Done

A feature is complete only when it includes:

Business rules

Documentation

Shared types

Operational logic

Event publication

Audit logging

BI integration

Tests

Build verification

Documentation updates

---

## Architecture Hierarchy

Business Vision

?

SOT Documents

?

Shared Standards

?

Event Spine

?

Operational Modules

?

Instrumentation

?

Commerce BI

?

Dashboards

?

Automation

?

Advanced Intelligence

This hierarchy is mandatory for every future development effort within the seiGEN Commerce Operating System.

