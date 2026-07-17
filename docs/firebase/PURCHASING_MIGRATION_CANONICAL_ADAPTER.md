# Purchasing migration canonical adapter (Build 09.1E)

## Authority boundary

The adapter translates approved migration records and invokes `PurchasingTransactionService`. It receives no Firestore handle and cannot directly write inventory balances, supplier balances, posted purchasing documents, audit logs, BI events, or mutation receipts.

Canonical ownership is: purchase orders → `createPurchaseOrder`; GRNs → `postGoodsReceipt`; supplier returns → `postSupplierReturn`; payments → `recordSupplierPayment`; credit notes → `postSupplierCreditNote`; reversals → `reverseSupplierPayment`. The Firestore repository transactions own all resulting domain documents, projections, immutable movements, receipts, audit records, and BI events.

## Supported records and translation

Supported types are suppliers, purchase orders, GRNs, supplier returns, supplier payments, supplier credit notes, and payment reversals. Reconciliation projections are deliberately unsupported because legacy calculated balances are not authoritative.

Translation is read-only. It validates vendor/branch scope, dependencies, posting references, quantities, money and supported statuses; preserves supplied business dates; normalizes currency and precision; derives canonical IDs; recomputes PO line/subtotal/grand totals; and resets forged posted state before the canonical transaction applies its own transition. Full legacy payloads are not used as identity metadata.

## Idempotency, retry and recovery

The adapter idempotency key includes vendor, migration run, record type, legacy ID, source fingerprint and operation context. Canonical Firestore transactions persist the mutation receipt with the domain mutation. Supplier and purchase-order creation use the same optional durable receipt path when called by migration. A completed receipt returns the durable canonical record; conflicting fingerprint reuse fails closed. A transient repository failure is retryable; validation and conflict failures are not. Completed migration results are not replayed.

Canonical references retained in the record result include canonical record, mutation receipt, inventory movements, supplier projection, audit record and BI event. This permits recovery after a caller interruption following commit.

## Activation and recovery

1. Confirm preview, approval, warnings and 09.1D readiness controls.
2. Enable Firebase purchasing mode and verify repository health.
3. Execute a bounded batch from Settings.
4. Resume only retryable failures; never alter completed results.
5. Reconcile inventory and supplier projections before cutover readiness.

There is no legacy fallback and no automatic data deletion. Rollback before execution cancels the run. After canonical commit, recovery uses durable receipts and domain compensating operations rather than deleting posted documents.
