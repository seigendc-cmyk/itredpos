# Build 09.3A.3 — Vendor License Lifecycle Alignment

Date: 2026-07-18

## Root cause

The simple Firebase onboarding path wrote `planCode: DEMO` and `licenseStatus: DEMO` to the vendor, then wrote a legacy `licenses/{vendorId}_demo_license` document. The POS runtime does not read that path: it subscribes to `vendorLicenses/{vendorId}`, `vendorPlans/{vendorId}`, and `vendors/{vendorId}`.

Because the vendor fallback exposed `licenseStatus: DEMO`, the runtime correctly rejected the combination. Runtime access permits pending Trial, active Trial, or active Active states; `DEMO` is a commercial plan code, not a lifecycle status.

## Canonical initial lifecycle

`src/shared/backend/licenseLifecycle.ts` is the single source of truth:

- `planCode`: `DEMO`
- `licenseStatus`: `Trial`
- `activationStatus`: `PendingConsoleVerification`
- `verificationStatus`: `Pending`
- `accountStatus`: `Trial`
- `licenseMode`: `demo`
- trial duration: three days, defined once by `DEFAULT_VENDOR_TRIAL_DAYS`

The vendor, `vendorLicenses/{vendorId}`, and `vendorPlans/{vendorId}` records are created from that contract with the same timestamps. DEMO includes sales and inventory features; runtime POS access remains a lifecycle decision and is not hardcoded through a separate `posAccess` field.

## Runtime and plan behavior

Runtime behavior remains restrictive:

- pending Trial: allowed;
- active Trial: allowed;
- active Active: allowed;
- rejected verification: blocked;
- suspended account/license/activation: blocked;
- expired Trial: blocked;
- `licenseStatus: DEMO`: blocked with `InvalidLicenseState` rather than an unknown reason.

Pricing-plan assignment now updates only commercial entitlement fields (`planCode`, plan name, feature flags, limits). It no longer silently changes license or activation lifecycle states to Active.

## Guarded legacy repair

The Pricing Plans Manager has a `Repair Legacy Demo` console action. It always performs an exact-document dry run first and requires a second confirmation before writing.

The repair is eligible only when the vendor is exactly:

- `planCode: DEMO`;
- `licenseStatus: DEMO`;
- `status: Active`;
- free of paid, suspended, rejected, expired, inactive, or conflicting license/plan records.

Eligible repair atomically aligns the vendor, `vendorLicenses/{vendorId}`, `vendorPlans/{vendorId}`, an existing legacy license document, and an audit event. Paid, active, suspended, rejected, expired, or ambiguous records are refused.

No live repair was run because the current browser vendor ID and authenticated browser context are not available to this workspace. Therefore there is no target-specific dry-run output and no live data was changed.

## Firestore rules

Rules now:

- require the canonical Trial lifecycle for onboarding vendor creation;
- allow active members exact `get` access to their own `vendorLicenses/{vendorId}` and `vendorPlans/{vendorId}`;
- deny collection listing for both runtime collections;
- require canonical initial fields on creation;
- restrict updates to the vendor owner and preserve tenant/document identity;
- allow owner-created immutable `vendorAuditLogs` records.

Cross-tenant access and listing remain denied.

## Validation

- TypeScript lint: passed.
- Production build: passed with existing non-fatal Vite chunk warnings.
- License lifecycle: 7/7 passed.
- Vendor onboarding authority: 11/11 passed.
- Vendor resolution: 10/10 passed.
- POS UI/auth certification: 22/22 passed.
- Firestore emulator suite: passed (44 tests).
- Sales authority/idempotency regression: 38/38 passed.
- `git diff --check`: passed; only Git line-ending notices were emitted.

No hosting, Firestore rules, or application deployment was performed. No live Firestore data was modified.

## Completion Status

BLOCKED
