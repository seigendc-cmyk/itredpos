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

`FirestoreSalesTransactionRepository.postCanonicalSaleAtomic` is the canonical atomic authority for cashier sales. The migration adapter does not create another transaction authority. It invokes the historical-migration entry point on the same `CanonicalSalesTransactionService`, which ends at the same repository with an explicit historical effect policy. Migration creates the canonical historical sale header, sale lines, and durable mutation/migration receipts, but it does not repost inventory movements, payments, customer debt, audit events, or BI events. Normal cashier posting retains all of those operational effects.

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

Processing claims use a five-minute lease. Concurrent work during an active lease is rejected as retryable. An expired lease can be reclaimed after a worker crash. If the canonical historical transaction committed before a crash, the canonical Build 09.2B mutation receipt safely replays the historical sale result. Inventory, payment, customer debt, audit, and BI effects are not part of the historical migration transaction and therefore cannot be reposted by retry.

### Mock isolation and legacy cutover

The legacy reader accesses only the exact vendor-scoped `itred_pos_transactions_{vendorId}` key. Mock source mode, explicit `__mockData`, and the known `TXN-88220` / `TXN-88221` fixtures are excluded before preview. Quarantined records never reach the adapter.

The legacy `saleService.completeSale` writer remains disabled and its obsolete unreachable direct-write implementation was removed. `assertLegacySalesWritesDisabled` and the cutover assessment fail closed if any declared legacy mutation path is enabled.

### Reconciliation and cutover gate

Reconciliation compares source and destination sale count, gross minor units, paid minor units, credit minor units, and item quantity. Cutover is not ready unless the run is completed without failed or quarantined records, receipts and reconciliation are complete, the canonical authority is healthy, legacy writes are disabled, mocks are isolated, and rule and authority tests pass.

### Firestore security

Rules were added for migration receipts, runs, quarantine records, and reconciliations. Migration control writes require the vendor owner. A migration receipt cannot be created already completed. Completion requires an existing completed canonical mutation receipt whose migration fingerprint matches the source receipt. Receipt identity and completed state are immutable; quarantine and reconciliation records are immutable; reads are tenant scoped.

## UI wiring

### Route

`/admin/sales-migration-cutover` is registered in `src/App.tsx`. The route is wrapped in the canonical `VendorAuthGate`; it is not added to cashier navigation and is not available as an unrestricted platform utility.

### Page/component

`src/pos-new/pages/SalesMigrationCutoverPage.tsx` is the restricted Sales Migration and Production Cutover surface. It displays the active sales authority version, disabled legacy-write state, mock-data state, exact vendor/branch/warehouse/terminal/actor context, preview counts, reconciliation, unexplained differences, progress, final results, receipt references, and conflict/quarantine detail. It states explicitly that inventory, payments, customer debt, audit events, and BI events are not reposted.

### Service calls

`src/pos-new/services/salesMigration/uiWorkflow.ts` is the UI orchestration boundary. The page calls `workflow.preview`, `workflow.approve`, and `workflow.apply`. Those operations delegate to `readLegacySalesSource`, `createSalesMigrationDryRun`, `approveSalesMigration`, `executeSalesMigration`, `reconcileSalesMigration`, `CanonicalSalesMigrationAdapter`, and `FirestoreSalesMigrationReceiptStore`. The page imports no Firestore write API, never calls `salesCheckoutService`, and never writes migration documents directly.

### Authorization guard

The outer `VendorAuthGate` requires authenticated vendor and staff sessions. `resolveSalesMigrationAdminContext` then independently requires the certified vendor owner, an Owner staff session with protected full authority, and matching vendor IDs. Cashier, missing, mismatched, and cross-vendor contexts fail closed before source reads or service actions. Firestore rules independently require the matching vendor Owner for migration-control writes and deny cross-tenant reads/writes.

### Vendor-context resolution

Vendor context is taken only from the in-memory certified owner and staff sessions. Vendor, branch, warehouse, terminal, and actor identifiers are all required. An optional `vendorId` route query is treated only as a scope assertion: if it differs from the certified vendor, access is denied; it can never select another tenant.

### Dry-run flow

The primary/default action is **Generate dry-run preview**. It reads only `itred_pos_transactions_{canonicalVendorId}`, fails on unreadable or malformed source data, blocks when mock mode is enabled, verifies that legacy sales writes remain disabled, fingerprints the source, and calls the existing no-write dry-run service. It reports candidate, eligible, conflict, invalid, and quarantine counts. Preview creation does not invoke the canonical adapter or create a migration receipt.

### Approval flow

Apply is disabled until the operator checks the explicit approval statement and binds approval to the exact migration run, vendor, preview version, and source fingerprint. Immediately before apply, the workflow re-reads the same vendor-scoped source and regenerates its fingerprint. Any source change or stale/conflicting approval is rejected before `executeSalesMigration` runs. Execution remains inside the existing migration service and its durable receipt/idempotency controls.

### Reconciliation presentation

The page shows source and migrated sale count, gross minor units, paid minor units, credit minor units, and item quantity in one table. It always includes a visible **Unexplained difference** result: not calculated before apply, `NO - matched` for zero differences, or `YES - cutover blocked` for any non-zero difference.

### Error handling

Authorization, tenant mapping, source parsing, mock-mode, stale preview, approval, receipt, and canonical-service failures are surfaced as errors. Failed record codes and service messages are shown in the final result. Error paths clear or withhold results and do not substitute mock data. Quarantined records are review-only and never reach the canonical adapter.

### Test evidence

`tests/salesMigrationUi.test.ts` contains seven integration tests covering read-only dry-run preview and all required counts; apply disabled before valid explicit approval; fingerprint binding; changed/stale source rejection; cashier/missing/cross-vendor denial; truthful source and canonical-service failures without mock fallback; progress, reconciliation, and receipt references; no direct UI Firestore writes; historical non-reposting; and preservation of the canonical cashier checkout adapter. The existing `tests/salesMigration.test.ts`, sales authority/transaction/idempotency suites, and Firestore rules emulator tests remain the backend and security evidence.

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
- `src/pos-new/services/salesMigration/uiWorkflow.ts`
- `src/pos-new/pages/SalesMigrationCutoverPage.tsx`
- `src/pos-new/domain/sales/salesAuthorityContract.ts`
- `src/App.tsx`
- `firestore.vendor-rooted.rules`
- `tests/salesMigration.test.ts`
- `tests/salesMigrationUi.test.ts`
- `tests/firebase/firestore.rules.test.ts`
- `package.json`
- this report

`firestore.vendor-rooted.rules`, `tests/firebase/firestore.rules.test.ts`, and `package.json` also contain pre-existing work from the dirty worktree; only their sales-migration additions belong to this build.

## Tests added or updated

`tests/salesMigration.test.ts` adds 12 tests covering deterministic fingerprints, no-write dry run, quarantine reasons, vendor-scoped legacy reads, mock isolation, canonical adapter routing, durable completion and replay, concurrency, expired-lease recovery, fingerprint conflicts, reconciliation, cutover gating, and the fail-closed legacy writer. `tests/salesMigrationUi.test.ts` adds the seven UI integration tests described above.

`tests/firebase/firestore.rules.test.ts` adds emulator tests for owner-only receipt creation, rejection of forged completion, cross-tenant denial, completion only against a matching canonical receipt, completed-receipt immutability, and owner-controlled immutable runs/quarantine/reconciliation.

## Validation actually executed

- `npm.cmd run lint` — passed (`tsc --noEmit`).
- `npm.cmd run build` — passed after UI wiring; Vite transformed 2,448 modules. Existing chunk-size and mixed static/dynamic import warnings remain non-blocking.
- `npm.cmd run firebase:rules:test` — first invocation could not read the Firebase CLI user config because of the workspace sandbox; the identical command was rerun with local config access and passed both rule-test files. This used only the local Firestore emulator.
- `npx.cmd vitest run tests/salesAuthority.test.ts` — 6 passed.
- `npx.cmd vitest run tests/salesTransaction.test.ts` — 8 passed.
- `npx.cmd vitest run tests/salesIdempotency.test.ts` — 3 passed.
- `npx.cmd vitest run tests/salesDurableIdempotency.test.ts` — 21 passed.
- `npx.cmd vitest run tests/salesMigration.test.ts` — 12 passed.
- `npm.cmd run test:sales-migration-ui` — 7 passed.
- Combined sales, migration, idempotency, and POS UI-auth certification — 79 passed across 7 files.
- `npx.cmd vitest run tests/purchasingAuthority.test.ts` — 10 passed.
- `npx.cmd vitest run tests/purchasingMigration.test.ts` — 6 passed.
- `npx.cmd vitest run tests/purchasingMigrationOperational.test.ts` — 8 passed.
- `npx.cmd vitest run tests/purchasingMigrationAdapter.test.ts` — 10 passed.
- `git diff --check` — passed. `git status --short`, `git diff --stat`, and `git diff --name-only` were also captured; they show the preserved pre-existing Build 09.3A work alongside this build.

No live migration was executed, as required. Consequently this report certifies the implementation, dry-run behavior, emulator rules, and automated reconciliation/cutover logic, not the contents of any production dataset.

## Final Completion Decision

COMPLETE WITH DOCUMENTED NON-BLOCKING LIMITATIONS
