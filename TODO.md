# SCI Build 09.2B Completion & POS UI Wiring Audit - TODO

- [x] Step 0: Safety checks (git status/diff)

- [x] Step 1: Identify canonical sales authority (repo evidence)
- [x] Step 2: Identify all legacy/bypass completion paths
- [x] Step 3: Audit durable idempotency: requestId lifecycle + receipt schema
- [x] Step 4: Audit fingerprint determinism + conflict behavior
- [x] Step 5: Audit atomicity/concurrency strategy
- [x] Step 6: Audit POS UI wiring: actual cashier completion runtime chain
- [x] Step 7: Audit held-sales and returns paths (bypass checks)
- [x] Step 8: Audit Firestore rules for mutation receipts + transactional records
- [x] Step 9: Create tests/salesDurableIdempotency.test.ts with required scenarios
- [x] Step 10: Run full validation matrix
- [x] Step 11: Produce docs/architecture/BUILD_09_2B_COMPLETION_AND_UI_WIRING_AUDIT.md report

