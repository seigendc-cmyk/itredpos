# Canonical sales authority (Build 09.2A)

## Authority map

The pre-consolidation checkout path staged independent writes through `salesCheckoutService`, `inventorySyncService`, customer-credit services, browser persistence, and root Firestore collections. `saleService.completeSale` was a second posting path. Held sales in `salesService` are local drafts and do not post stock, payments, or debt.

`canonicalSalesTransactionService` is now the sole public sales-mutation authority. `PosSales` supplies explicit vendor, branch, warehouse, terminal, operator, and stable request identity and renders the returned result. The compatibility exports in `salesCheckoutService` delegate to the authority. The obsolete `saleService.completeSale` path fails closed.

Supported checkout posting uses `FirestoreSalesTransactionRepository`. One Firestore transaction writes the vendor-rooted sale header and lines, inventory balances and immutable movements, payment records, customer ledger and versioned balance when credit is used, audit event, BI event, and durable mutation receipt. All transaction reads occur before writes. The same request fingerprint replays the stored result; conflicting reuse or an existing sale without its receipt fails closed. Offline authoritative sale replay is not supported.

Receipt rendering and cash-drawer/reporting integrations are presentation or post-commit integrations; they are not alternative sales authorities. Browser records are a local read cache only and are written after canonical posting succeeds.

## Lifecycle and unsupported operations

The modeled lifecycle is `Draft/Held -> Posted -> PartiallyReturned/Returned` or `Voided`; posted records cannot transition to draft. Arithmetic uses integer minor units for deterministic discount, tax, tender, balance, and change calculations.

Held sales remain non-posted local drafts. Sale returns, standalone refunds, customer credit notes, and customer-payment reversals fail closed until each has its own complete canonical transaction. No legacy implementation is treated as an authoritative fallback.

## Firestore layout and rules

Canonical records live below `vendors/{vendorId}` in `salesReceipts`, `salesReceiptLines`, `payments`, `customerLedger`, `customerBalances`, `inventoryMovements`, `audit_logs`, `biEvents`, and `mutationReceipts`. Rules require active vendor membership and matching document identity, make posted financial records immutable, preserve versioned customer balances, and deny cross-vendor or unauthenticated access. Legacy root sales collections are not used by canonical checkout.
