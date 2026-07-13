# SCI POS Business Intelligence Stocktake Intelligence

## Purpose

Stocktake Intelligence is one of the most important SCI POS BI features.

The system must not wait for month-end or year-end stocktake to discover losses.

SCI POS must continuously generate intelligent physical count tasks based on stock movement behavior, risk patterns, product value, shelf behavior, staff activity, supplier activity, delivery activity, and previous stock variances.

The objective is to move from passive stocktaking to active stock control.

## Core Principle

The system must decide what should be counted, when it should be counted, and why it should be counted.

Stocktake must become:

- Random
- Risk-based
- Behavior-based
- Shelf-aware
- Staff-aware
- Supplier-aware
- Delivery-aware
- Profit-aware

## Stocktake Task Types

SCI POS must support the following count types:

### Random Spot Count

The system randomly selects items or shelves to count without warning.

This prevents staff from predicting what will be checked.

### Risk-Based Count

The system selects items with suspicious or risky behavior.

Examples include repeated variances, frequent adjustments, high refund activity, unusual voids, and abnormal movement.

### Fast-Moving Product Count

The system selects products that sell quickly and require tighter control.

Fast-moving products can create hidden losses if stock is not monitored frequently.

### High-Value Product Count

The system selects expensive items because even small quantity losses can cause serious financial damage.

### Shelf Count

The system selects a shelf, rack, counter, storage zone, or warehouse location for physical counting.

### Variance Follow-Up Count

The system re-counts items that previously showed variance.

### Staff-Linked Count

The system selects items handled by staff members whose activity is linked to repeated stock issues.

### Supplier-Linked Count

The system selects products from suppliers with short delivery, invoice mismatch, or cost dispute history.

### Delivery-Linked Count

The system selects items involved in delivery fulfilment where dispatch, delivery completion, or cash remittance has risk flags.

## Critical Security Rule

Staff must not see the expected system quantity before physical count submission.

The staff member should only see:

- Product Name
- Product Code
- Shelf or Location
- Count Instruction

The expected quantity must only be revealed after submission.

This prevents staff from simply copying the system figure instead of physically counting.

## Stocktake Workflow

The standard workflow is:

1. BI engine selects item or location to count.
2. System creates stocktake task.
3. Task is assigned to authorized staff.
4. Staff physically counts item.
5. Staff submits physical quantity.
6. System compares physical quantity with expected quantity.
7. Variance is calculated.
8. Risk score is updated.
9. Alert is created if required.
10. Supervisor reviews variance.
11. Owner sees financial impact.
12. Corrective action is recorded.

## Stocktake Selection Logic

The BI engine must consider:

- Product value
- Product movement speed
- Product size
- Theft attractiveness
- Previous variance frequency
- Previous variance value
- Manual adjustment history
- Refund history
- Void history
- Transfer history
- Staff activity links
- Supplier receiving history
- Delivery dispatch history
- Shelf risk score
- Branch risk score
- Days since last count

## Stocktake Outputs

Each stocktake task must produce:

- Count result
- Expected quantity
- Physical quantity
- Variance quantity
- Variance cost value
- Variance selling value
- Variance percentage
- Risk classification
- Staff who counted
- Supervisor who reviewed
- Recommended action

## Stocktake Alerts

The system must raise alerts for:

- High-value shortage
- Repeated product variance
- Repeated shelf variance
- Staff-linked variance
- Supplier-linked shortage
- Delivery-linked shortage
- Count refusal
- Late count submission
- Suspicious count correction
- Count result matching system quantity too often without variance in high-risk areas

## Future Prediction Possibilities

The system must be ready to predict:

- Which products should be counted tomorrow
- Which shelf is likely to show variance
- Which branch needs surprise stocktake
- Which staff shift requires audit
- Which products are becoming theft-prone
- Which categories require tighter control
- Which suppliers require receiving verification

## Strategic Principle

Stocktake Intelligence must make SCI POS behave like a continuous stock watchdog.

The system must not only record stock loss after it happens.

It must actively search for possible stock loss before it destroys business profit.
