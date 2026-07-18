# SCI Build 09.2B Completion & POS UI Wiring Audit - TODO

- [x] Step 0: Safety checks (git status/diff)

- [ ] Step 1: Identify canonical sales authority (repo evidence)
- [ ] Step 2: Identify all legacy/bypass completion paths
- [ ] Step 3: Audit durable idempotency: requestId lifecycle + receipt schema
- [ ] Step 4: Audit fingerprint determinism + conflict behavior
- [ ] Step 5: Audit atomicity/concurrency strategy
- [ ] Step 6: Audit POS UI wiring: actual cashier completion runtime chain
- [ ] Step 7: Audit held-sales and returns paths (bypass checks)
- [ ] Step 8: Audit Firestore rules for mutation receipts + transactional records
- [ ] Step 9: Create tests/salesDurableIdempotency.test.ts with required scenarios
- [ ] Step 10: Run full validation matrix
- [ ] Step 11: Produce docs/architecture/BUILD_09_2B_COMPLETION_AND_UI_WIRING_AUDIT.md report

