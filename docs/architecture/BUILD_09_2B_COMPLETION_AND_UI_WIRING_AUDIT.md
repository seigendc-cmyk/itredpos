# Build 09.2B Completion and UI Wiring Audit

Date: 2026-07-18
Branch: `build/firebase-sales-idempotency-v09-2b`

## Scope and first failure

The `SCI POS Validation` workflow was reproduced in its declared order. `npm ci`, type checking, the production build, Firestore rules, and the three pre-existing sales suites passed. The first repository failure was the required `tests/salesDurableIdempotency.test.ts` step: the file did not exist, so Vitest exited with “No test files found.” The workflow was correct to fail rather than silently skip this Build 09.2B gate.

The missing file exposed incomplete implementation details, not just missing test coverage:

- the durable fingerprint reused the purchasing helper and included retry-varying sale/payment dates plus a locally sequenced receipt number;
- checkout request identity existed only in a React ref and was lost on refresh;
- the cashier page separately decremented local stock after canonical success;
- the application shell fabricated a second transaction and invoice identity instead of retaining the authority result;
- the durable receipt result omitted sale, sale-line, and payment references;
- completed receipt rules did not validate the expanded sales receipt identity/schema.

No package, lockfile, Firebase configuration, or workflow defect caused the failure. The workflow file was not changed.

## Build 09.2A architecture

Supported completed sales have one canonical authority. `canonicalSalesTransactionService.completeCheckout` validates explicit vendor, branch, terminal, operator, and stable request scope. It coalesces same-process duplicate calls and invokes the internal checkout pipeline. The compatibility `completeSale` adapter delegates to this authority. The legacy `saleService.completeSale` path fails closed. Unsupported return, refund, void, credit-note, and payment-reversal authority methods also fail closed rather than writing partial authoritative state.

Totals, lines, discounts, tax, payment allocation, credit eligibility, and stock availability are recomputed or revalidated by the service/repository boundary. Posted Firestore sale, line, payment, customer-ledger, inventory-movement, and mutation-receipt documents are append-only under the rules.

## Actual cashier runtime path

`src/pos-new/pages/PosSales.tsx` `handleCompleteSale`

-> `src/pos-new/services/salesCheckoutService.ts` `completeSale`

-> `src/pos-new/services/sales/canonicalSalesTransactionService.ts` `completeCheckout`

-> `src/pos-new/services/salesCheckoutService.ts` `executeCanonicalCheckoutPipeline`

-> `src/pos-new/repositories/firestore/FirestoreSalesTransactionRepository.ts` `postCanonicalSaleAtomic`

-> Firebase `runTransaction`

-> vendor-rooted sale header and lines, stock projections and inventory movements, payments, optional customer ledger and balance, audit event, BI event, and completed mutation receipt.

The UI clears the cart only after authority success. It now stores the exact returned `Sale` in the application transaction list, upserts it by canonical sale ID, and no longer performs a second local stock deduction or invents an invoice number.

## Request identity lifecycle

`salesCheckoutRequestIdentity.ts` owns checkout identity generation and storage. The key is scoped by vendor, branch, and terminal. A new cart receives one random request ID on first completion attempt. Double-click/in-process retries reuse the React ref; later retries and page refreshes reuse session storage. Validation or infrastructure failure retains the identity. Successful completion, cancellation, holding, voiding, or clearing the cart removes it so a new sale receives a new identity.

Resumed held-sale completion uses a deterministic identity derived from vendor, branch, and held-sale ID. The hold itself remains non-posting. Unsupported authoritative return/refund/void operations fail closed.

Session storage is deliberately tab/session scoped. A stale recovered identity with different business content cannot post a second sale because its fingerprint conflicts. Multiple independent carts in one browser tab are not currently supported.

## Durable fingerprint and receipt

`salesIdempotencyService.ts` provides sales-specific canonical serialization and SHA-256 fingerprinting. Object keys are sorted, identifiers are normalized, and volatile generated fields (`createdAt`, `updatedAt`, `saleDate`, `receivedAt`, posting/completion timestamps, and receipt sequence) are excluded. Product, quantity, price, discount, tax, customer, payment, currency, credit, vendor, branch, terminal, and request changes remain meaningful.

The receipt ID is deterministic across command, vendor, branch, and request. The completed document records receipt/document identity, raw request ID, vendor, branch, terminal, command, entity, fingerprint, result path, actor/correlation data, attempt count, authority version, timestamps, and canonical result references. The result includes sale, sale-line, payment, inventory-movement, optional customer-ledger/balance, audit, BI, and mutation-receipt references.

## Transaction and concurrency boundary

All Firestore reads happen before writes in one transaction. The repository reads the sale, mutation receipt, products, stock balances, and optional customer balance. If a completed matching receipt exists, it returns the stored result with `replayed: true`. A different fingerprint fails with `SALES_IDEMPOTENCY_CONFLICT`. Any non-completed receipt fails with `SALES_STATUS_CONFLICT` and cannot trigger blind effects.

When no receipt exists, the same transaction validates stock and writes every authoritative effect plus the completed receipt. Firestore transaction retries serialize concurrent claims. Two identical concurrent calls converge on one result; conflicting calls cannot both commit. A failed or interrupted transaction leaves no partial effect or completed receipt and can safely retry. Because claim, effects, and completion are one atomic commit, `processing` is a transaction-local state rather than a separately persisted lease; externally persisting it would introduce a stranded-receipt recovery problem without improving this transaction boundary.

Deterministic identifiers prevent duplicate inventory movements, payments, customer debt, audit events, and BI events. Cash-drawer records already use sale-derived idempotency IDs. This audit also made the derived local receipt-creation audit and COGS recovery IDs deterministic.

## Firestore security

Rules require a completed sales receipt to be paired in the same atomic write with its sale and matching request ID. Sales receipts validate document identity, vendor, branch, terminal, request/correlation identity, operation, entity type, fingerprint, attempt count, and authority version. Completed receipts, posted sales, completed payments, customer ledger entries, and inventory movements cannot be updated or deleted. Vendor membership gates reads and prevents cross-vendor access. A standalone completed receipt cannot be forged.

The application remains a Firebase client application rather than a privileged server-side sales service. Security therefore relies on Firebase authentication, vendor membership, permission checks, cross-document rule invariants, and immutable transaction records.

## Direct-write and legacy-path review

The operational sales UI contains no Firestore write API. Sales completion has one `runTransaction` owner: `FirestoreSalesTransactionRepository`. Other Firestore write occurrences found by the repository-wide search belong to their own bounded repositories (customer master, product master, inventory operations, purchasing), BI administration, or activation provisioning. None is an alternate completed-sale path.

The previous UI-only `onProductStockChange` completion path was removed. Local product state now follows repository-backed product/inventory refresh rather than independently asserting an authoritative deduction. The application transaction list uses the canonical sale identity and ignores an already-present replay.

## Tests created and updated

`tests/salesDurableIdempotency.test.ts` exercises the real sales repository with an isolated transactional Firestore adapter. It covers scoped identity, stable fingerprinting, volatile-field exclusion, meaningful conflicts, first completion, replay, exact effect counts, credit ledger/balance behavior, processing-state rejection, identical and conflicting concurrency, validation/stock rollback, infrastructure retry, request persistence/reset, held completion identity, UI delegation, and legacy failure/delegation.

`tests/firebase/firestore.rules.test.ts` now also verifies completed sales mutation receipt immutability and rejects standalone completed-receipt forgery. Existing sales authority, arithmetic, identity, rules, and purchasing regression suites remain in the validation matrix.

## Fixes implemented

- Added a sales-specific deterministic fingerprint and receipt identity service.
- Expanded durable results and receipt metadata.
- Made retry-generated receipt numbers stable for a request.
- Persisted checkout request identity across recoverable refresh/retry.
- Added stable held-sale completion identity.
- Returned an explicit replay signal/message.
- Removed UI-side stock deduction and fabricated invoice/transaction identities.
- Made local receipt-created audit and COGS recovery effects idempotent.
- Hardened completed sales mutation-receipt rules and emulator coverage.
- Added the missing durable repository/concurrency/UI test suite.

## Final validation results

- `npm ci`: passed; 878 packages installed. npm reported 8 dependency advisories (1 low, 5 moderate, 2 high) and existing deprecation notices.
- `npm run lint`: passed (`tsc --noEmit`).
- `npm run build`: passed. Vite reported the existing large-chunk and static/dynamic import warnings; they are not Build 09.2B correctness failures.
- `npm run firebase:rules:test`: passed, 28 tests. Expected `PERMISSION_DENIED` emulator logs came from negative security assertions.
- `salesAuthority.test.ts`: 6 passed.
- `salesTransaction.test.ts`: 8 passed.
- `salesIdempotency.test.ts`: 3 passed.
- `salesDurableIdempotency.test.ts`: 21 passed.
- `purchasingAuthority.test.ts`: 10 passed.
- `purchasingMigration.test.ts`: 6 passed.
- `purchasingMigrationOperational.test.ts`: 8 passed.
- `purchasingMigrationAdapter.test.ts`: 10 passed.
- Required focused sales and purchasing commands: 72 passed, 0 failed.
- The workflow configuration was inspected and left unchanged because its ordering, Node 20 setup, lockfile install, emulator invocation, required-file gate, and focused test commands are correct.

## Documented non-blocking limitations

- The atomic design intentionally does not expose a separately persisted `processing` lease or failed receipt. Failed transactions have no committed authoritative effects or completed receipt; retries use the same request identity. Existing non-completed receipts fail closed.
- Receipt rendering, delivery preparation, accounting placeholders, cash-control projections, and reporting UI events are downstream local/derived concerns outside the canonical Firestore transaction. Required authoritative sale, stock, payment, customer, audit, and BI effects are inside it and exactly once.
- Session storage retains one active checkout identity per vendor/branch/terminal in a browser tab. Multiple simultaneous carts in the same tab are outside the current UI model.
- Returns, refunds, voids, standalone customer credit notes, and payment reversals remain explicitly unsupported by the canonical service and fail closed; no Build 09.2C migration or cutover work was started.

## Final Completion Decision

COMPLETE WITH DOCUMENTED NON-BLOCKING LIMITATIONS
