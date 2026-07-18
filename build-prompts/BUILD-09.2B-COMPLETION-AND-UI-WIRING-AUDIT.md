# BUILD 09.2B COMPLETION AND UI WIRING AUDIT

You are working inside the SCI / iTredPOS2 repository.

This is not Build 09.2C.

Do not begin sales migration or cutover work.

Your task is to inspect, verify, complete and harden Build 09.2B, and verify that the completed canonical sales authority is connected to the real POS user interface.

Do not commit.
Do not push.
Do not redesign the UI.
Do not add unrelated features.

==================================================
1. PRIMARY OBJECTIVES
==================================================

Determine conclusively whether Build 09.2B is complete.

Also determine whether the following builds are wired to the operational sales UI:

- Build 09.2A - Canonical Sales Authority
- Build 09.2B - Durable Sales Idempotency

The audit must not rely only on documentation, filenames or existing tests.

Trace the actual runtime execution path from the cashier sales UI to the canonical transaction authority and durable idempotency mechanism.

If required functionality is missing, implement it during this audit.

==================================================
2. PRESERVE EXISTING AUTHORITY
==================================================

Build 09.2A already established canonical sales authority.

Do not create another sales authority.

Do not duplicate the canonical posting service.

Do not restore legacy direct-write behaviour.

Build 09.2B must extend the existing canonical authority with durable idempotency.

All sales posting paths must converge on the same authority.

==================================================
3. INSPECT THE ACTUAL REPOSITORY
==================================================

First inspect the repository structure and locate the real implementations.

Search for:

canonicalSalesTransactionService
salesAuthority
salesTransaction
salesCheckoutService
saleService
postSale
completeSale
finalizeSale
checkout
requestId
commandId
mutationReceipt
idempotency
fingerprint
inventoryMovement
salePayment
customerLedger
customerBalance
audit
BIEvent
heldSale
returnSale
refundSale
voidSale

Also inspect:

src/pos-new/pages
src/pos-new/components
src/pos-new/services
src/pos-new/repositories
src/pos-new/repositories/firestore
src/commerce-integration
tests
firestore.rules
package.json

Do not assume the expected filenames exist.

Identify the actual implementation paths.

==================================================
4. BUILD 09.2A COMPLETION CHECK
==================================================

Verify that Build 09.2A provides one canonical sales authority for:

- cash sales,
- credit sales,
- sale payments,
- stock deduction,
- customer ledger effects,
- customer balance effects,
- audit events,
- BI events,
- held-sale completion where supported,
- returns, refunds and voids where supported.

Confirm that:

- sale totals are recomputed by authority,
- UI values are not blindly trusted,
- posted sales cannot return to draft,
- unsupported mutations fail closed,
- legacy services delegate to the canonical authority,
- obsolete posting services cannot write authoritative sales,
- inventory is not independently mutated by the UI,
- customer balances are not independently mutated by the UI,
- payments are not independently written by the UI.

If any bypass exists, close it.

==================================================
5. BUILD 09.2B COMPLETION CHECK
==================================================

Verify that durable sales idempotency is genuinely implemented.

Required capabilities:

1. Stable request identity.
2. Vendor-scoped identity.
3. Branch-scoped identity.
4. Command-type identity.
5. Stable requestId reuse for retries.
6. Deterministic command fingerprint.
7. Fingerprint ignores volatile timestamps.
8. Fingerprint changes for meaningful business changes.
9. Durable mutation receipt.
10. Explicit processing state.
11. Explicit completed state.
12. Controlled failed or retryable state.
13. Completed replay returns the original result.
14. Completed replay does not execute business effects again.
15. Conflicting request reuse fails closed.
16. Concurrent duplicate requests create one canonical result.
17. Inventory is deducted once.
18. Payment is recorded once.
19. Customer debt is recorded once.
20. Audit events are emitted once.
21. BI events are emitted once.
22. Completed receipts cannot be rewritten.
23. Completed receipts cannot be deleted.
24. Cross-vendor receipt access is denied.
25. Client code cannot forge completed receipts.

Do not treat deterministic IDs alone as full durable idempotency.

Do not mark 09.2B complete unless replay handling, durable receipt state and exactly-once business effects exist.

==================================================
6. TRACE THE REAL UI EXECUTION PATH
==================================================

Trace the actual cashier workflow from the operational POS screen.

Identify:

- the sales page,
- the checkout button or form submission handler,
- the function called by that handler,
- the service called by the UI,
- the canonical transaction authority,
- the repository transaction,
- the result returned to the UI.

Document the complete runtime chain.

Example format:

Cashier sales page
-> checkout handler
-> sales checkout adapter
-> canonical sales transaction service
-> Firestore sales transaction repository
-> sale, inventory, payment, customer ledger, audit and BI effects

Use actual repository filenames and symbols.

==================================================
7. VERIFY REQUEST ID BEHAVIOUR IN THE UI
==================================================

Confirm how the cashier UI creates and retains requestId.

Required behaviour:

- a new transaction gets one requestId,
- double-clicking checkout reuses the same requestId,
- a retry after a temporary error reuses the same requestId,
- refreshing a pending transaction does not silently create a second identity,
- changing meaningful sale content must not reuse a completed request identity,
- starting a genuinely new sale creates a new requestId,
- held-sale completion has a stable completion request identity,
- return, refund or void commands use stable command identities where supported.

Do not rely only on disabled buttons.

Do not rely only on React component state if the state is lost during a recoverable retry.

If current requestId handling is unsafe, fix it using the smallest compatible change.

==================================================
8. VERIFY UI RESULT HANDLING
==================================================

Confirm the UI correctly handles:

- first successful posting,
- successful idempotent replay,
- transaction already processing,
- idempotency conflict,
- validation failure,
- insufficient stock,
- permission failure,
- retryable infrastructure failure,
- unknown failure.

The UI must not:

- show two successful sale numbers for one request,
- clear the cart before authoritative success,
- deduct local stock separately,
- post payment separately,
- update customer balance separately,
- fabricate a receipt number,
- report success when authority failed.

Use existing UI notification and error patterns.

Do not redesign the interface.

==================================================
9. VERIFY LEGACY PATHS
==================================================

Search all sales UI and service files for direct calls to:

- addDoc,
- setDoc,
- updateDoc,
- deleteDoc,
- runTransaction,
- inventory decrement functions,
- customer balance update functions,
- payment creation functions.

Classify each occurrence as:

- canonical repository implementation,
- safe read-only use,
- non-authoritative derived write,
- prohibited authority bypass.

Close prohibited bypasses.

Legacy sales adapters must delegate to canonical authority or fail closed.

==================================================
10. VERIFY FIRESTORE TRANSACTION OWNERSHIP
==================================================

Confirm the authoritative transaction boundary.

For normal sale posting, verify atomic or equivalent protection for:

- mutation receipt claim,
- sale document,
- sale lines where separate,
- inventory movements,
- stock projections,
- payment record,
- customer ledger entry,
- customer balance projection,
- mutation receipt completion.

Audit and BI effects must be exactly once.

If audit or BI writes are outside the main transaction:

- use deterministic IDs,
- make the writes idempotent,
- document them as derived effects,
- ensure replay cannot duplicate them.

Do not mark a receipt completed before required authoritative effects exist.

==================================================
11. VERIFY DURABLE RECEIPT MODEL
==================================================

Inspect the mutation receipt schema.

It should include or validly represent:

- receipt ID,
- vendorId,
- branchId,
- terminalId where applicable,
- command type,
- requestId,
- command fingerprint,
- status,
- attempt count,
- createdAt,
- updatedAt,
- completedAt,
- canonical result references,
- controlled failure classification,
- authority or schema version.

Completed identity and result fields must be immutable.

Do not store unrestricted sensitive payloads.

If the current receipt model is incomplete, improve it without breaking purchasing receipts.

==================================================
12. CREATE OR LOCATE THE REQUIRED TEST SUITE
==================================================

The previous validation expected:

tests/salesDurableIdempotency.test.ts

The file was not found.

Determine whether:

A. durable tests exist under another valid filename, or
B. the durable test suite was never created.

If an equivalent suite exists:

- report its actual path,
- verify that it covers the full 09.2B contract,
- update documentation or validation references as appropriate.

If no equivalent suite exists:

- create tests/salesDurableIdempotency.test.ts.

==================================================
13. REQUIRED 09.2B TESTS
==================================================

Test at minimum:

1. Stable command identity.
2. Stable receipt identity.
3. Deterministic fingerprint.
4. Fingerprint ignores volatile timestamps.
5. Fingerprint changes for meaningful sale changes.
6. First request creates one canonical result.
7. Completed replay returns the same result.
8. Completed replay creates no second sale.
9. Completed replay deducts no additional stock.
10. Completed replay creates no additional payment.
11. Completed replay creates no additional customer ledger entry.
12. Completed replay does not increase customer balance again.
13. Completed replay creates no duplicate audit event.
14. Completed replay creates no duplicate BI event.
15. Same request identity with conflicting fingerprint fails closed.
16. Processing receipt prevents blind duplicate execution.
17. Two concurrent identical requests produce one result.
18. Concurrent conflicting requests cannot both succeed.
19. Validation failure creates no completed receipt.
20. Insufficient stock produces no partial effects.
21. Retryable failure can safely complete once later.
22. Completed receipt cannot be modified.
23. Completed receipt cannot be deleted.
24. Cross-vendor access is denied.
25. Client cannot forge completed status.
26. Checkout supplies a stable requestId.
27. Checkout retry reuses requestId.
28. Starting a new sale creates a new requestId.
29. Sales UI delegates to canonical authority.
30. Legacy posting paths cannot bypass authority.

Use focused unit, integration, repository and Firestore emulator tests as appropriate.

Do not fake concurrency with tests that only call identity helpers.

==================================================
14. VERIFY PREVIOUS BUILD UI WIRING
==================================================

Audit whether previous relevant builds are operationally connected.

At minimum verify:

Build 09.2A:
- cashier checkout uses canonical sales authority,
- held sales remain non-posting until canonical completion,
- payment and credit effects come from authority,
- posted state is returned to UI.

Build 09.2B:
- UI supplies stable request identity,
- authority receives the request identity,
- mutation receipt is claimed during posting,
- replay result is returned to the UI,
- UI handles in-progress and conflict states.

Also inspect whether canonical purchasing builds already used by current purchasing UI remain intact:

- purchase order operations,
- goods receiving,
- supplier returns,
- supplier payments,
- migration adapters where operationally exposed.

Do not modify purchasing unless the audit discovers a direct regression caused by sales changes.

==================================================
15. ADD AN ARCHITECTURE AUDIT DOCUMENT
==================================================

Create or update:

docs/architecture/BUILD_09_2B_COMPLETION_AND_UI_WIRING_AUDIT.md

Document:

- actual 09.2A architecture,
- actual 09.2B architecture,
- actual UI execution path,
- requestId lifecycle,
- mutation receipt lifecycle,
- transaction boundary,
- exactly-once effects,
- legacy bypass review,
- Firestore security,
- tests created or located,
- weaknesses discovered,
- fixes implemented,
- final completion decision.

The final decision must be one of:

- COMPLETE
- COMPLETE WITH DOCUMENTED NON-BLOCKING LIMITATIONS
- INCOMPLETE

Do not use vague wording.

==================================================
16. VALIDATION
==================================================

Run the actual available commands.

Run:

npm run lint
npm run build
npm run firebase:rules:test

Run:

npx vitest run tests/salesAuthority.test.ts
npx vitest run tests/salesTransaction.test.ts
npx vitest run tests/salesIdempotency.test.ts
npx vitest run tests/salesDurableIdempotency.test.ts

Run purchasing regressions:

npx vitest run tests/purchasingAuthority.test.ts
npx vitest run tests/purchasingMigration.test.ts
npx vitest run tests/purchasingMigrationOperational.test.ts
npx vitest run tests/purchasingMigrationAdapter.test.ts

Search for direct UI writes using commands appropriate to the repository.

Also run:

git diff --check
git status --short
git diff --stat
git diff --name-only

If any command fails:

- diagnose it,
- fix failures within this audit scope,
- rerun the affected validation,
- report the exact final result.

Do not hide warnings.

==================================================
17. COMPLETION GATE
==================================================

Build 09.2B may be declared complete only if:

- durable receipt behaviour exists,
- matching replay returns original result,
- conflicting replay fails closed,
- exactly-once authoritative effects are enforced,
- concurrency is tested,
- Firestore security is tested,
- the real cashier UI reaches the canonical authority,
- the real cashier UI supplies stable request identity,
- legacy authority bypasses are closed,
- the durable test suite passes,
- existing sales tests pass,
- purchasing regression tests pass,
- lint passes,
- build passes,
- Firestore rules tests pass.

If any release-blocking requirement remains, declare 09.2B incomplete.

Do not start 09.2C.

==================================================
18. FINAL REPORT
==================================================

Return:

1. Final 09.2A status.
2. Final 09.2B status.
3. Actual canonical sales service path.
4. Actual UI-to-authority runtime path.
5. RequestId creation and retention path.
6. Durable receipt implementation path.
7. Fingerprint implementation path.
8. Firestore transaction boundary.
9. Deterministic effect identity paths.
10. UI wiring confirmed.
11. Legacy bypasses found.
12. Legacy bypasses fixed.
13. Files created.
14. Files modified.
15. Tests created or located.
16. Exact test counts and outcomes.
17. Lint result.
18. Build result.
19. Firestore rules result.
20. Purchasing regression result.
21. Remaining limitations.
22. Final completion decision.
23. git status --short.
24. git diff --stat.
25. git diff --name-only.

Do not commit.
Do not push.

Stop after the audit, fixes and validation.
