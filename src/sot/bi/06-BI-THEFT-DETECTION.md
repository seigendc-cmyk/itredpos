# SCI POS Business Intelligence Theft Detection

## Purpose

Stock theft is one of the biggest causes of business failure.

SCI POS must treat theft detection as a core Business Intelligence function, not as a basic inventory report.

The system must detect stock leakage, manipulation, suspicious transaction patterns, adjustment abuse, delivery leakage, supplier disputes, staff-linked variance, and profit damage caused by missing stock.

The purpose is not to accuse staff automatically.

The purpose is to detect risk evidence, preserve audit trails, and help the owner investigate early.

## Definition of Theft Risk

SCI POS must understand theft risk broadly.

Theft risk includes:

- Physical stock theft
- Stock sold outside the POS
- Under-ringing
- Fake refunds
- Fake voids
- Excessive discounts used to hide theft
- Price override abuse
- Stock adjustment abuse
- Breakage or write-off abuse
- Goods received but not recorded
- Supplier short delivery
- Stock transfer manipulation
- Warehouse/cashier collusion
- Cashier/customer collusion
- Delivery stock leakage
- Delivery cash leakage
- Stock counted falsely
- Stock moved between shelves without proper logging

## Theft Detection Inputs

The BI engine must use:

- Sales history
- Refund history
- Void history
- Discount history
- Price override history
- Stock adjustment history
- Stock receiving history
- Stock transfer history
- Stocktake variance history
- Shelf movement history
- Staff activity history
- Branch activity history
- Supplier delivery history
- Delivery fulfilment history
- Cash variance history

## Product Theft Risk

Each product must have a theft risk profile.

Risk increases when:

- Product is high value
- Product is small and easy to hide
- Product moves quickly
- Product has repeated negative variance
- Product has frequent manual adjustments
- Product has suspicious refund or void activity
- Product is often sold below expected price
- Product is linked to delivery failures
- Product is linked to staff or shelf risk

Example:

Product: Battery 70AH
Risk Level: High
Reasons:
Repeated negative variance, high value, manual adjustments, and transfer mismatch.

## Shelf Theft Risk

Each shelf, rack, counter, warehouse zone, and storage location must be scored.

Risk increases when:

- The shelf has repeated variances
- The shelf stores high-value products
- The shelf is accessed by many staff members
- The shelf has frequent movement without sales
- The shelf is counted late or rarely
- Stock moves from the shelf without clear transaction evidence

## Staff-Linked Theft Risk

The BI engine must identify staff activity patterns linked to theft risk.

Examples:

- Staff linked to repeated variances
- Staff with high void activity
- Staff with unusual refunds
- Staff with frequent discounts
- Staff approving their own adjustments
- Staff linked to missing high-value products
- Staff working shifts where stock loss increases

Important rule:

The system must say "risk detected" or "review required".

The system must not say "staff member stole stock" without investigation.

## Transaction Manipulation Detection

The BI engine must identify:

- Voids after payment
- Refunds without original sale
- Repeated refunds on same product
- Discounts above normal range
- Price overrides below safe margin
- Sales suspended and never resumed
- Transactions cancelled repeatedly
- High-value items removed from basket before completion

## Delivery Theft Detection

The system must monitor delivery leakage.

Risk events include:

- Delivery completed without secret code
- Driver collected cash but did not remit
- Product dispatched but delivery failed
- Delivery delayed without reason
- Route deviation
- Customer disputes delivery receipt
- Delivery marked complete outside expected location

## Supplier Theft or Loss Risk

The system must detect supplier-side risk:

- Goods received less than invoice quantity
- Supplier invoice mismatch
- Purchase order quantity mismatch
- Damaged goods not recorded
- Supplier cost manipulation
- Repeated short delivery by same supplier

## Financial Impact

Every theft risk must estimate financial impact.

Required measures:

- Missing quantity
- Cost value loss
- Selling value exposure
- Gross profit damage
- Profit damage percentage
- Branch impact
- Product category impact

Example:

Missing Quantity: 3
Cost Loss: 180
Selling Value Exposure: 270
Gross Profit Damage: 90

## Alerts

The system must create alerts for:

- Critical stock variance
- Repeated product shortage
- High-value item missing
- Suspicious refund pattern
- Suspicious void pattern
- Stock adjustment abuse
- Delivery fulfilment risk
- Supplier short delivery
- Staff-linked stock risk
- Shelf-linked theft risk

## Future Prediction Possibilities

The system must be ready to predict:

- Products likely to go missing
- Shelves likely to show shortages
- Branches at risk of stock leakage
- Staff shifts requiring audit
- Delivery routes with leakage risk
- Suppliers likely to cause receiving disputes
- Product categories requiring tighter control

## Strategic Principle

SCI POS must become a stock theft detection and prevention engine.

The objective is to protect business owners before stock leakage becomes business failure.
