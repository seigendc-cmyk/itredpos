# Build 09.2C Sales Migration and Cutover Audit

Date: 2026-07-18  
Branch: `build/09.2c-sales-migration-cutover`  
Repository: `D:\VendorDiscovery\iTredPOS2`

## Scope and prompt evidence

The only opened build prompt present in the repository is `build-prompts/BUILD-09.2B-COMPLETION-AND-UI-WIRING-AUDIT.md`. It explicitly covers Build 09.2B and says not to begin 09.2C. No Build 09.2C prompt was found by repository search. This implementation therefore follows the 09.2C deliverables stated by the operator and the repository's established purchasing-migration pattern. No live migration, deployment, production data mutation, commit, push, or merge was performed.

The worktree already contained unrelated Build 09.3A onboarding, vendor-resolution, and licensing changes when this audit began. Those changes were preserved and are not represented here as Build 09.2C work.

## Repository audit

The real completed-sale runtime path is:

`PosSales.tsx` -> `salesCheckoutService.completeSale` -> `CanonicalSalesTransactionService.completeSale` -> `postCanonicalSaleAtomic` -> Firestore transaction.

`FirestoreSalesTransactionRepository.postCanonicalSaleAtomic` is the canonical atomic authority for the completed sale, sale lines, payment, inventory movements, optional customer-ledger entry, audit event, BI event, and durable mutation receipt. The migration adapter does not create another transaction authority. It invokes the new historical-migration entry point on the same `CanonicalSalesTransactionService`, which ends at the same atomic repository. Historical import deliberately omits cashier-only UI effects such as printing a receipt and changing a live cash shift.

A targeted source search for Firestore write APIs in the sales UI, checkout service, legacy sale service, canonical sales service, migration service, and repository found writes only in:

- `FirestoreSalesTransactionRepository.ts`, for the canonical atomic business transaction; and
- `salesMigration/durableReceiptStore.ts`, for migration control receipts.

No direct Firestore completed-sale write was found in `PosSales.tsx`. The unreachable legacy completed-sale implementation in `saleService.ts` was removed; that entry point remains fail-closed with an explicit error. Browser-storage updates in `PosPrototypeApp.tsx` remain local UI/read-model persistence and are not a second Firestore transaction authority.

## Implemented architecture

### Canonical migration adapter

`canonicalAdapter.ts` validates and translates a completed legacy sale into the canonical historical-sale command. It converts money to minor units, allocates discount and tax deterministically, recomputes totals, creates a stable destination sale ID and request ID, and calls only `CanonicalSalesTransactionService.migrateCompletedSale`.

The canonical service validates tenant scope, line quantities, money, and payment coverage before building canonical records. The repository stores migration run ID, source fingerprint, legacy record ID, and migration version on the existing canonical durable mutation receipt.

### Dry run, fingerprints, quarantine, and approval

`createSalesMigrationDryRun` clones source data and performs no writes. It computes SHA-256 fingerprints using stable key ordering and excludes volatile sync timestamps. It quarantines:

- mock or fixture rows;
- vendor or branch scope mismatches;
- missing identifiers or invalid lines;
- non-completed statuses;
- financial totals that do not reconcile;
- duplicate source identities; and
- fingerprints already represented by completed receipts.

Approval is explicit and binds the migration run, tenant, source fingerprint, preview version, approver, and migration version. A changed preview is rejected as stale.

### Durable receipts and recovery

The Firestore receipt store uses transactions at `vendors/{vendorId}/salesMigrationReceipts/{receiptId}`. Receipt identity binds the vendor, legacy record, fingerprint, and deterministic destination sale. Identical completed requests replay the stored canonical result; a changed fingerprint or destination is rejected.

Processing claims use a five-minute lease. Concurrent work during an active lease is rejected as retryable. An expired lease can be reclaimed after a worker crash. If the canonical transaction committed before a crash, the canonical Build 09.2B mutation receipt safely replays without duplicating sale, stock, payment, customer ledger, audit, or BI effects.

### Mock isolation and legacy cutover

The legacy reader accesses only the exact vendor-scoped `itred_pos_transactions_{vendorId}` key. Mock source mode, explicit `__mockData`, and the known `TXN-88220` / `TXN-88221` fixtures are excluded before preview. Quarantined records never reach the adapter.

The legacy `saleService.completeSale` writer remains disabled and its obsolete unreachable direct-write implementation was removed. `assertLegacySalesWritesDisabled` and the cutover assessment fail closed if any declared legacy mutation path is enabled.

### Reconciliation and cutover gate

Reconciliation compares source and destination sale count, gross minor units, paid minor units, credit minor units, and item quantity. Cutover is not ready unless the run is completed without failed or quarantined records, receipts and reconciliation are complete, the canonical authority is healthy, legacy writes are disabled, mocks are isolated, and rule and authority tests pass.

### Firestore security

Rules were added for migration receipts, runs, quarantine records, and reconciliations. Migration control writes require the vendor owner. A migration receipt cannot be created already completed. Completion requires an existing completed canonical mutation receipt whose migration fingerprint matches the source receipt. Receipt identity and completed state are immutable; quarantine and reconciliation records are immutable; reads are tenant scoped.

## Files changed for Build 09.2C

- `src/pos-new/services/sales/canonicalSalesTransactionService.ts`
- `src/pos-new/repositories/firestore/FirestoreSalesTransactionRepository.ts`
- `src/pos-new/services/saleService.ts`
- `src/pos-new/services/salesMigration/types.ts`
- `src/pos-new/services/salesMigration/fingerprint.ts`
- `src/pos-new/services/salesMigration/legacySource.ts`
- `src/pos-new/services/salesMigration/canonicalAdapter.ts`
- `src/pos-new/services/salesMigration/durableReceiptStore.ts`
- `src/pos-new/services/salesMigration/service.ts`
- `firestore.vendor-rooted.rules`
- `tests/salesMigration.test.ts`
- `tests/firebase/firestore.rules.test.ts`
- `package.json`
- this report

`firestore.vendor-rooted.rules`, `tests/firebase/firestore.rules.test.ts`, and `package.json` also contain pre-existing work from the dirty worktree; only their sales-migration additions belong to this build.

## Tests added or updated

`tests/salesMigration.test.ts` adds 12 tests covering deterministic fingerprints, no-write dry run, quarantine reasons, vendor-scoped legacy reads, mock isolation, canonical adapter routing, durable completion and replay, concurrency, expired-lease recovery, fingerprint conflicts, reconciliation, cutover gating, and the fail-closed legacy writer.

`tests/firebase/firestore.rules.test.ts` adds emulator tests for owner-only receipt creation, rejection of forged completion, cross-tenant denial, completion only against a matching canonical receipt, completed-receipt immutability, and owner-controlled immutable runs/quarantine/reconciliation.

## Validation actually executed

- `npm.cmd run lint` — passed (`tsc --noEmit`).
- `npm.cmd run build` — passed; Vite transformed 2,440 modules. Existing chunk-size and mixed static/dynamic import warnings remain non-blocking.
- `npm.cmd run firebase:rules:test` — first invocation could not read the Firebase CLI user config because of the workspace sandbox; the identical command was rerun with local config access and passed both rule-test files. This used only the local Firestore emulator.
- `npx.cmd vitest run tests/salesAuthority.test.ts` — 6 passed.
- `npx.cmd vitest run tests/salesTransaction.test.ts` — 8 passed.
- `npx.cmd vitest run tests/salesIdempotency.test.ts` — 3 passed.
- `npx.cmd vitest run tests/salesDurableIdempotency.test.ts` — 21 passed.
- `npx.cmd vitest run tests/salesMigration.test.ts` — 12 passed.
- `npx.cmd vitest run tests/purchasingAuthority.test.ts` — 10 passed.
- `npx.cmd vitest run tests/purchasingMigration.test.ts` — 6 passed.
- `npx.cmd vitest run tests/purchasingMigrationOperational.test.ts` — 8 passed.
- `npx.cmd vitest run tests/purchasingMigrationAdapter.test.ts` — 10 passed.
- `git diff --check` — passed. `git status --short`, `git diff --stat`, and `git diff --name-only` were also captured; they show the preserved pre-existing Build 09.3A work alongside this build.

No live migration was executed, as required. Consequently this report certifies the implementation, dry-run behavior, emulator rules, and automated reconciliation/cutover logic, not the contents of any production dataset.

## Final Completion Decision

COMPLETE WITH DOCUMENTED NON-BLOCKING LIMITATIONS
