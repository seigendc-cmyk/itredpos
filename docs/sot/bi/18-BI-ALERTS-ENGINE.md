# SCI POS Business Intelligence Alerts Engine

## Purpose

The Alerts Engine is responsible for converting business events, risk scores, variances, exceptions, anomalies, and predictive findings into actionable notifications.

The objective is not to overwhelm users with data.

The objective is to ensure the right person sees the right problem at the right time.

SCI POS must behave like an active business monitoring system rather than a passive reporting system.

## Core Principle

Every alert must answer:

- What happened?
- Why is it important?
- What is the financial impact?
- What action is recommended?
- Who should act?
- How urgent is the issue?

An alert without a recommended action has limited value.

## Alert Severity Levels

SCI POS shall support:

### Information

General awareness items.

Examples:

- New supplier added
- New branch created
- New staff member activated

### Warning

Potential issues requiring monitoring.

Examples:

- Product approaching reorder level
- Supplier delivery delayed
- Customer purchase decline

### High

Significant operational risk.

Examples:

- Repeated stock variance
- Repeated cash variance
- Margin deterioration

### Critical

Immediate management attention required.

Examples:

- Major stock shortage
- Unremitted delivery cash
- High-value product missing
- Branch profitability collapse

## Alert Categories

### Stock Integrity Alerts

Examples:

- Product variance detected
- Shelf variance detected
- Warehouse variance detected
- High-value item shortage
- Negative stock detected

### Stocktake Alerts

Examples:

- Count task overdue
- Count not completed
- Repeated variance after count
- Suspicious count result

### Theft Detection Alerts

Examples:

- Suspicious adjustment
- Excessive void activity
- Excessive refund activity
- Delivery leakage risk

### Cash Control Alerts

Examples:

- Shift shortage
- Shift overage
- Delivery cash not remitted
- Cash drawer anomaly

### Staff Intelligence Alerts

Examples:

- Rising staff risk score
- Excessive discounts
- Repeated override requests
- Compliance deterioration

### Sales Intelligence Alerts

Examples:

- Sales decline
- Product demand spike
- Category collapse
- Branch underperformance

### Purchase Intelligence Alerts

Examples:

- Stockout risk
- Overstock risk
- Cost increase
- Purchase discipline failure

### Supplier Intelligence Alerts

Examples:

- Supplier delay
- Supplier short delivery
- Supplier cost increase
- Supplier reliability decline

### Delivery Intelligence Alerts

Examples:

- Route deviation
- Delivery delay
- Secret code failure
- Driver cash remittance delay

### Customer Intelligence Alerts

Examples:

- High-value customer churn risk
- Customer complaint spike
- Customer buying decline

### Branch Intelligence Alerts

Examples:

- Branch risk increase
- Branch profitability decline
- Branch stock integrity decline

## Alert Structure

Every alert must contain:

- Alert ID
- Alert Type
- Severity
- Risk Score
- Entity Affected
- Description
- Financial Impact
- Root Cause
- Recommended Action
- Assigned Owner
- Created Date
- Status
- Resolution Notes

## Alert Lifecycle

Alert states:

- Open
- Acknowledged
- Investigating
- Resolved
- Closed

The system must track how long alerts remain unresolved.

## Escalation Rules

Examples:

If critical alert remains unresolved for 24 hours:

Escalate to Branch Manager.

If unresolved after 48 hours:

Escalate to Business Owner.

If unresolved after 72 hours:

Escalate to Executive Dashboard.

Escalation rules must be configurable.

## Financial Impact Measurement

Every alert should estimate:

- Cost Exposure
- Revenue Exposure
- Gross Profit Exposure
- Protected Profit Exposure

Example:

Alert:
Battery Stock Variance

Quantity Missing:
3

Cost Exposure:
180

Selling Value Exposure:
270

Profit Exposure:
90

## Alert Dashboard

The BI dashboard must show:

- Open Alerts
- Critical Alerts
- Alerts by Branch
- Alerts by Category
- Alerts by Risk Level
- Alerts by Staff Member
- Alerts by Supplier
- Alerts by Delivery Driver

## Future Prediction Alerts

SCI POS must eventually generate predictive alerts:

Examples:

- Product likely to stock out
- Branch likely to decline
- Customer likely to churn
- Driver likely to delay
- Supplier likely to increase prices
- Staff risk likely to increase

## Strategic Principle

The Alerts Engine is the nervous system of SCI POS Business Intelligence.

Its purpose is to transform intelligence into action before business problems become business losses.
