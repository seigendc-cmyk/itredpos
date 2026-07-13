# SCI POS Business Intelligence Architecture

## Purpose

The SCI POS Business Intelligence architecture defines how business events are transformed into intelligence, alerts, risk scoring, recommendations, and future decision support.

The BI layer must be modular, scalable, auditable, role-based, and ready for predictive intelligence.

The BI layer must never depend only on screen data. All intelligence must originate from transaction events, audit records, stock movement logs, cash records, staff activity logs, supplier records, delivery records, and customer activity.

## Architecture Flow

Business Activity
to
Event Collection
to
Audit Log
to
BI Rules Engine
to
Risk Scoring
to
Alerts Engine
to
Recommendation Engine
to
Business Intelligence Control Centre

## Core Architecture Layers

### 1. Transaction Layer

This is where business activity starts.

Examples include sales, refunds, voids, stock receiving, stock transfers, stock adjustments, stocktake counts, cash drawer activity, purchases, deliveries, approvals, customer activities, and staff actions.

Every transaction must produce a BI-readable event.

### 2. Event Collection Layer

This layer converts every business activity into structured event data.

Each event must include vendorId, branchId, terminalId, staffId, eventType, timestamp, affected records, before value, after value, quantity, cost value, selling value, and approval status.

### 3. Audit Layer

The audit layer stores immutable evidence.

It must answer who performed the action, when it happened, what changed, what was the previous value, what is the new value, who approved it, and which business object was affected.

Audit records must not be deleted. Corrections must be recorded through reversal or amendment events.

### 4. BI Rules Engine

The rules engine evaluates business activity against defined BI rules.

Examples:

If stock variance exceeds threshold, create a stock risk event.

If supplier cost increases but selling price is unchanged, create a margin risk alert.

If cashier performs excessive voids, increase staff risk score.

If delivery cash is collected but not remitted, create cash control alert.

### 5. Risk Scoring Layer

The system must calculate risk scores for products, shelves, warehouses, staff, branches, suppliers, customers, delivery agents, and terminals.

Risk scoring must use historical behavior, frequency, financial value, repeated patterns, timing, approval status, and relationship to other events.

### 6. Alerts Engine

The alerts engine converts risk events into actionable warnings.

Alerts must include severity, reason, affected entity, financial impact, recommended action, owner, status, and resolution history.

### 7. Recommendation Engine

The recommendation engine converts BI findings into practical actions.

Examples include count this shelf, investigate this variance, adjust selling price, reorder stock, review supplier cost, restrict staff discount permission, or follow up delivery cash.

### 8. Predictive Intelligence Layer

The system must be ready to predict future business risks.

Examples include stockout prediction, theft risk prediction, margin collapse prediction, customer churn prediction, supplier risk prediction, branch underperformance prediction, and cash variance risk.

### 9. Business Intelligence Control Centre

This is the user-facing BI page.

It must include a landing dashboard, business brief, search, filters, BI chapters, alerts, recommendations, and investigation views.

## Design Principle

SCI POS BI must behave like a business advisor, not a complicated reporting module.

It must help ordinary vendors understand what happened, why it matters, what risk exists, and what action must be taken.
