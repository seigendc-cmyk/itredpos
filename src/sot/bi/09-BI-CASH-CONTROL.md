# SCI POS Business Intelligence Cash Control

## Purpose

Cash Control BI protects the business from cash leakage, cashier abuse, drawer manipulation, delivery cash loss, shift shortages, and weak remittance discipline.

Cash is one of the most sensitive business assets.

SCI POS must ensure that every cash movement is recorded, reconciled, scored, and auditable.

## Core Principle

Every cash movement must have:

- Source
- Staff member
- Branch
- Terminal
- Shift
- Amount
- Time
- Reason
- Approval status
- Reconciliation status

Cash must never move invisibly.

## Cash Control Domains

SCI POS must monitor:

- Opening float
- Cash sales
- Refund payouts
- Paid-outs
- Cash drawer openings
- Cash drawer closings
- Shift closing cash
- Expected cash
- Counted cash
- Cash shortages
- Cash overages
- Supervisor collections
- Banking records
- Delivery cash collections
- Delivery cash remittances

## Shift Cash Intelligence

Each shift must produce:

- Opening float
- Total cash sales
- Total cash refunds
- Expected cash
- Counted cash
- Shortage or overage
- Cashier name
- Terminal
- Branch
- Shift start time
- Shift close time
- Supervisor approval status

Example:

Cashier: Tariro
Expected Cash: 850
Counted Cash: 835
Variance: -15
Risk Level: Medium
Action: Supervisor review required

## Cash Variance Detection

The BI engine must detect:

- Repeated shortages
- Repeated overages
- Large single variance
- Variance linked to refunds
- Variance linked to voids
- Variance linked to discounts
- Variance linked to cash drawer openings
- Variance linked to specific terminals
- Variance linked to specific shifts
- Variance linked to specific staff members

## Cash Drawer Intelligence

The system must log:

- Drawer opened for sale
- Drawer opened without sale
- Drawer opened for refund
- Drawer opened by supervisor
- Drawer opened after shift close
- Drawer opened outside business hours

Drawer openings without valid transaction reason must increase risk score.

## Delivery Cash Control

When delivery agents collect cash, SCI POS must track:

- Delivery order
- Driver
- Customer
- Amount collected
- Collection time
- Remittance time
- Remittance recipient
- Variance
- Confirmation status

If delivery cash is collected but not remitted, the system must raise a cash risk alert.

## Staff Cash Risk Score

Each cashier or staff member must have a cash risk profile.

Risk increases when:

- Shortages repeat
- Drawer opens without sale
- Refunds increase
- Voids increase
- Discounts increase
- Cash remittance is late
- Shift close is delayed
- Counted cash differs from expected cash

The system must not accuse staff automatically.

It must say:

- Cash risk detected
- Supervisor review required
- Investigation recommended

## Cash Alerts

SCI POS must create alerts for:

- Cash shortage
- Cash overage
- Repeated variance
- Suspicious drawer opening
- Delivery cash not remitted
- Refund cash abuse
- Shift closed with unresolved cash
- Cash variance above threshold
- Cashier with rising cash risk score

## Future Prediction Possibilities

The BI layer must predict:

- Cashier likely to produce variance
- Terminal likely to show cash discrepancy
- Branch likely to have cash shortage
- Shift period with high cash risk
- Delivery agent likely to delay remittance
- Cash control weakening over time

## Strategic Principle

Cash Control BI must protect the owner from invisible cash leakage.

Cash discipline, stock integrity, and profit protection must work together.

A business may sell well and still fail if cash is not controlled.
