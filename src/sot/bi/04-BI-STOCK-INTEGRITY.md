# SCI POS Business Intelligence Stock Integrity

## Purpose

Stock Integrity is one of the most important BI domains in SCI POS.

Stock is money sitting on shelves, in warehouses, in delivery vehicles, and across branches.

If stock records are wrong, the business owner cannot trust sales reports, profit reports, purchasing decisions, staff accountability reports, or stock valuation.

The Stock Integrity BI layer must continuously compare what the system says the business should have against what the business physically has.

## Core Stock Integrity Formula

Expected Stock is calculated as:

Opening Stock
plus Stock Received
plus Transfers In
plus Customer Returns
minus Sales
minus Transfers Out
minus Supplier Returns
minus Write-Offs
minus Approved Adjustments
equals Expected Stock

Then SCI POS compares:

Expected Stock against Physical Stock

The difference is called Stock Variance.

## Stock Variance Types

SCI POS must identify:

- Negative Variance: physical stock is less than expected stock
- Positive Variance: physical stock is more than expected stock
- Repeated Variance: the same item keeps showing differences
- Shelf Variance: one shelf or rack repeatedly shows differences
- Branch Variance: one branch repeatedly loses stock accuracy
- Staff-Linked Variance: variance happens during or after specific staff activity
- Supplier-Linked Variance: received quantity does not match supplier documents
- Delivery-Linked Variance: dispatched stock does not reconcile with delivery completion
- Adjustment-Linked Variance: manual adjustments hide stock movement problems

## Stock Integrity Scores

SCI POS must calculate stock integrity scores for:

- Product
- Category
- Shelf
- Rack
- Warehouse
- Branch
- Supplier Batch
- Staff Shift
- Terminal
- Delivery Route

Example:

Product: Battery 70AH
Expected Stock: 20
Physical Stock: 17
Variance: -3
Estimated Cost Loss: 180
Estimated Selling Value Exposure: 270
Stock Integrity Score: 62 out of 100
Risk Level: High

## Product Stock Integrity

Each product must have a stock integrity profile.

The profile must show:

- Current system stock
- Last physical count
- Last variance
- Variance frequency
- Variance value
- Sales velocity
- Adjustment history
- Transfer history
- Refund and void relationship
- Staff links
- Supplier links
- Delivery links
- Risk level
- Recommended action

## Shelf and Location Integrity

SCI POS must treat shelves, racks, counters, warehouses, and storage zones as BI entities.

Each location must have:

- Location ID
- Assigned products
- Count history
- Variance history
- Risk score
- Staff access history
- Last count date
- Recommended next count date

Example:

Shelf B3
Risk Level: Critical
Reason: repeated shortages, high-value products, and frequent manual adjustments
Recommendation: conduct surprise count today

## Branch Stock Integrity

Each branch must have a branch stock integrity score.

The score must consider:

- Total variances
- Variance value
- Count compliance
- Stock adjustment frequency
- Transfer mismatch
- Delivery mismatch
- Staff-linked risk
- Product category risk
- High-value item accuracy

Branch managers must see branch-level intelligence.

Owners must see branch comparison intelligence.

## Stock Integrity Alerts

The system must raise alerts for:

- Repeated negative variance
- High-value item shortage
- Stock adjustment abuse
- Stock received but not available for sale
- Transfer not confirmed
- Stock sold into negative quantity
- Shelf count failure
- Product with declining integrity score
- Branch stock accuracy deterioration

## Future Prediction Possibilities

The BI layer must be ready to predict:

- Which products are likely to go missing
- Which shelves need surprise counts
- Which branch is becoming risky
- Which staff shifts are linked to variance growth
- Which supplier batches are likely to create disputes
- Which products are likely to become unreliable in system stock
- Which categories require stricter controls

## Strategic Principle

Stock Integrity is the foundation of stock theft detection, COGS accuracy, profit protection, purchasing discipline, and business survival.

If SCI POS protects stock integrity, it protects the business owner from silent financial failure.
