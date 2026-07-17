# Purchasing migration, reconciliation and cutover (Build 09.1C)

## Authority boundary

Migration is a control-plane orchestrator, never a purchasing transaction authority. Canonical writes remain `UI -> usePurchasingData -> PurchasingTransactionService -> PurchasingRepository -> FirestorePurchasingRepository -> Firestore`. The migration writer adapter must call that chain; it may not write inventory movements, supplier balances, receipts, or posted documents directly.

## Discovered sources

The inspected legacy sources are vendor-scoped browser storage and their mock fallbacks: `itred_pos_supplier_records_v1`, `itred_pos_purchase_orders_v1`, `itred_pos_purchase_order_lines_v1`, `itred_pos_goods_receiving_notes_v1`, `itred_pos_goods_receiving_lines_v1`, `itred_pos_supplier_returns_v1`, `itred_pos_supplier_return_lines_v1`, `itred_pos_supplier_return_credit_notes_v1`, `itred_pos_supplier_credit_profiles_v1`, `itred_pos_supplier_bills_v1`, `itred_pos_supplier_payments_v1`, `itred_pos_supplier_payment_allocations_v1`, and `itred_pos_supplier_statements_v1`. Mock purchasing fixtures in `mockPosData` are fallback source data. Source scanning is read-only; legacy write paths remain fail-closed.

## Operational flow

1. Select an explicitly supported source and vendor/branch scope.
2. Scan and normalize into typed migration records without canonical writes.
3. Preview validation rejects vendor/branch conflicts, duplicates, prior fingerprints, unresolved suppliers/products, invalid quantities/money, and unsupported statuses.
4. Resolve errors. Explicitly acknowledge every warning.
5. A permitted approver approves the exact preview version, aggregate source fingerprint, migration version, and warning set. Separation of duties is enforced when the effective permission policy requires it.
6. Execute bounded batches in dependency order: suppliers, purchase orders, GRNs, returns, credit notes, payments, reversals, projections.
7. Retry only failed records. Successful fingerprints and deterministic destination IDs are never replayed.
8. Reconcile counts, minor-unit financial totals, supplier balances, inventory quantities and available inventory values.
9. Assess cutover readiness. Do not declare success from document writes alone.

## Fingerprinting, mapping, and audit

SHA-256 input is stable serialization of vendor ID, source type, legacy record ID, record type, normalized payload, and source version. Changed input invalidates approval. Canonical records retain non-editable legacy source/type/parent IDs, fingerprint, run, actor/time and migration version metadata. Run records, record results, issues and reconciliations use only `firestorePaths` vendor-rooted paths.

## Failure, retry, and rollback

Execution is resumable from record results. A successful record is skipped on retry; repository idempotency remains the final duplicate guard for inventory, balances and mutation receipts. Unresolved parents are not migrated. Before final approval a draft/preview may be cancelled; after canonical posted transactions exist, rollback is compensating-domain work and is not performed by migration. Legacy data is never automatically deleted.

## Security and readiness checklist

Only vendor managers may read migration history and only vendor owners may mutate the migration control plane. Source fingerprints cannot change; migrated results and completed reconciliations/runs are immutable; completed history cannot be client-deleted; cross-vendor access is denied.

Cutover is `ready` only when migration and reconciliation complete with no blocking failures, supplier balances and inventory reconcile, canonical repositories operate, legacy writes are disabled and fail closed, and authority/rules tests pass. A fully acknowledged non-blocking reconciliation warning yields `readyWithWarnings`; otherwise status is `notReady`.
