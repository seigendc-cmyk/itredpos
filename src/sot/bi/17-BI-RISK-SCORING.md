# SCI POS Business Intelligence Risk Scoring

## Purpose

Risk Scoring is the central intelligence engine of SCI POS BI.

It converts business activity into measurable risk levels so that owners, managers, and supervisors can understand where attention is needed.

SCI POS must score risk across stock, cash, staff, suppliers, branches, customers, deliveries, terminals, shelves, and product categories.

## Core Principle

Risk must be measured from evidence, not opinion.

Risk scoring must be based on:

- Frequency
- Financial value
- Repetition
- Timing
- Staff involvement
- Branch involvement
- Product value
- Approval status
- Historical behavior
- Pattern changes

## Risk Score Range

SCI POS must use a 0 to 100 risk score.

- 0 to 30 = Low Risk
- 31 to 60 = Medium Risk
- 61 to 80 = High Risk
- 81 to 100 = Critical Risk

## Entities That Must Be Scored

SCI POS must calculate risk scores for:

- Products
- Product categories
- Shelves
- Warehouses
- Branches
- Staff members
- Cashiers
- Suppliers
- Customers
- Delivery drivers
- Terminals
- Stocktake tasks
- Purchase orders
- Deliveries

## Stock Risk Score

Stock risk must increase when:

- Product has repeated variance
- Product is high value
- Product is fast moving
- Product is easy to hide
- Product has manual adjustments
- Product has suspicious refunds
- Product has transfer mismatch
- Product has delivery mismatch

## Staff Risk Score

Staff risk must increase when:

- Staff is linked to stock variances
- Staff is linked to cash shortages
- Staff performs excessive voids
- Staff processes abnormal refunds
- Staff applies risky discounts
- Staff requests many overrides
- Staff delays shift closure
- Staff ignores BI tasks

## Supplier Risk Score

Supplier risk must increase when:

- Supplier delivers late
- Supplier delivers short
- Supplier changes prices frequently
- Supplier invoice mismatches purchase order
- Supplier products have high returns
- Supplier causes stockouts
- Supplier damages margin

## Delivery Risk Score

Delivery risk must increase when:

- Driver delays delivery
- Driver deviates route
- Secret code fails
- Cash is not remitted
- Customer disputes delivery
- Delivery is completed away from customer location

## Branch Risk Score

Branch risk must increase when:

- Stock variance rises
- Cash variance rises
- Protected profit declines
- Staff risk increases
- Customer churn increases
- Delivery failure increases
- Stocktake compliance declines

## Risk Score Decay

Risk must not disappear immediately.

If behavior improves, the risk score must reduce gradually over time.

This prevents temporary good behavior from hiding long-term risk patterns.

## Risk Alerts

When risk crosses thresholds, the system must create alerts.

Examples:

- Product entered high stock risk
- Staff member entered high cash risk
- Supplier entered high cost risk
- Branch entered critical stock risk
- Driver entered delivery cash risk

## Future Prediction Possibilities

SCI POS must predict:

- Future stock loss risk
- Future cash variance risk
- Future supplier risk
- Future staff risk
- Future branch decline
- Future delivery failure

## Strategic Principle

Risk Scoring converts scattered business events into a clear control signal.

The owner should not need to read thousands of transactions.

SCI POS must identify where risk is growing and what action is required.
