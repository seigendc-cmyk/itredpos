# SCI Build 09.2C — Sales Migration and Production Cutover

## Build Objective

This build establishes the canonical sales authority as the only production sales completion path.

## Summary

Build 09.2C delivers:

- Sales migration framework
- Production cutover controls
- Canonical sales authority enforcement
- Legacy write-path shutdown
- Dry-run migration support
- Migration reconciliation
- Durable migration receipts
- Tenant-safe Firestore rules
- Mock-data isolation
- Production validation

## Primary Architecture

PosSales UI
→ salesCheckoutService
→ canonicalSalesTransactionService
→ durable mutation receipt
→ authoritative sales
→ inventory effects
→ payment effects
→ customer ledger
→ audit events
→ BI events

## Deliverables

Refer to:

docs/architecture/BUILD_09_2C_SALES_MIGRATION_CUTOVER_AUDIT.md

for the complete implementation, repository audit, migration design, reconciliation process, Firestore rules, testing evidence, and engineering decisions.

## Status

COMPLETE WITH DOCUMENTED NON-BLOCKING LIMITATIONS

## Deployment

NOT PERFORMED

## Live Migration

NOT PERFORMED

## Production Data Changes

NONE
