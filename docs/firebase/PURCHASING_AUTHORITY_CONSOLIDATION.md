# Purchasing Authority Consolidation (Build 09.1A)

## Canonical authority

Production purchasing mutations follow one path: UI → `usePurchasingData` → `PurchasingTransactionService` → `PurchasingRepository` → `FirestorePurchasingRepository` → Firestore. The Firestore repository owns business transactions and their audit/BI events.

The legacy goods-receiving and supplier-return posting exports are deprecated compatibility adapters. They require canonical operation context, delegate to `PurchasingTransactionService`, and fail closed when context is absent. Active posting forms require a canonical `onPostRequest`; there is no local posting fallback.

Legacy supplier-account and payment mutation functions fail closed. Their historical bodies remain temporarily as unreachable migration reference for Build 09.1C, while read-only reports can inspect retained legacy records. The creditors UI does not mount local supplier, invoice, payment, or return mutation panels.

## Mutation context and statuses

Staff mutations require vendor, staff, role, correlation, idempotency, occurrence time, and source metadata. The hook creates fresh correlation and idempotency values for each user mutation and passes them unchanged through the transaction service.

Posted GRNs, payments, returns, and reversals are immutable. A posted document cannot return to Draft. Purchase-order transitions are explicitly validated. Payment correction is an append-only reversal, never an edit or deletion of the original payment.

## Supplier balance model

Authoritative invoices, payments, payment reversals, returns, and credit notes remain append-only source records. `vendors/{vendorId}/supplierBalances/{supplierId}` is a versioned projection maintained in the same Firestore transaction as payment and reversal source records. It records totals, outstanding balance, version, update time, and the last correlation ID. The UI may display or reconcile values but cannot make a calculated total authoritative.

Only managers may create/update the projection under current rules, identity cannot change, versions must increment by one, and deletion is denied.

## Legacy data policy

Build 09.1A neither imports nor deletes localStorage purchasing records. `detectLegacyPurchasingRecords()` performs a read-only count of known PO, GRN, return, payment, and supplier-account keys and marks whether migration is required. Draft/recovery data may remain local; it must never be treated as a posted record or stock/accounting authority.

## Remaining work

- Build 09.1B adds durable mutation receipts, stable payload fingerprints, transaction-integrated replay protection, capacity checks, and inventory/supplier-balance invariants. Offline queue orchestration remains part of Build 09.1C.
- Build 09.1C: reviewed, fingerprinted migration of detected legacy records with explicit operator approval and reconciliation.
- Remaining legacy draft and reporting imports should be progressively replaced with canonical repository reads; they must not be re-enabled for posting.
