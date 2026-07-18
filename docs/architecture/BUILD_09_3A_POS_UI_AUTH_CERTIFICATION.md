# Build 09.3A POS UI and Authentication Certification

## Scope

This build audits and hardens the real `/pos-prototype` entry path from Firebase vendor authentication through tenant, license, staff, branch, terminal, permission, checkout, canonical sales authority, and Firestore repository boundaries. It does not redesign the POS or change Build 09.2B durable transaction semantics.

## Starting Baseline

- Branch: `audit/build-09-ui-auth-certification`
- Commit: `f556cf1 feat: complete durable sales idempotency build 09.2B`
- Starting worktree: clean

## Runtime Authority Chain

| Stage | Runtime authority | Certified result |
| --- | --- | --- |
| Application entry | `App.tsx` and `sci-auth/VendorAuthGate.tsx` | The POS route is wrapped by the canonical vendor gate. |
| Vendor identity | Firebase Auth state in `firebaseAuthShell.ts` | A current Firebase UID is mandatory; browser storage cannot establish identity. |
| Tenant resolution | `VendorAuthGate.findVendorByGoogleAccount` | The vendor is queried by owner UID, with owner email as the compatibility lookup, and the result must match the Firebase identity. |
| License | `vendorLicenseRuntimeService.ts` | Firestore vendor, plan, and license state must be known and allowed before Staff Access opens. |
| Staff | `PosStaffAccess.tsx` and `StaffAuthService.authenticateStaffAccess` | An active vendor-scoped staff record and correct PIN are required. |
| Branch/warehouse/terminal | `StaffAuthService.authenticateStaffAccess` | Vendor ownership, active status, staff branch assignment, terminal assignment, terminal branch, and terminal warehouse must agree. |
| Permissions | Staff record, `effectivePermissionService.ts` | The certified session permission set drives both menu visibility and checkout action checks. |
| POS runtime | `PosPrototypeApp.tsx` | Vendor, staff, branch, warehouse, terminal, session age, and license are certified before an operational session is restored. |
| Checkout | `PosSales.tsx` | Identity comes from the certified `PosSession`; one stable request ID is forwarded to one checkout adapter call. |
| Transaction authority | `salesCheckoutService.ts` to `canonicalSalesTransactionService.ts` | The compatibility adapter delegates to the canonical Build 09.2B authority. |
| Persistence | `FirestoreSalesTransactionRepository.ts` | Durable receipts and the atomic Firestore transaction remain the authoritative posting boundary. |

## Vendor Authentication

`VendorAuthGate` now starts in a checking state and subscribes to Firebase Auth. A local owner record is a cache only and is never promoted into the authoritative in-memory context without a current Firebase user, a resolved vendor, and a matching owner UID or email. Missing, mismatched, inactive, suspended, rejected, disabled, or revoked vendor identity fails closed. Firebase logout clears vendor and staff authority.

## Tenant Resolution

Vendor resolution returns the Firestore document ID when an older vendor document lacks a duplicated `vendorId` field. Certification still requires a non-empty tenant ID and a Firebase-owner match. Switching vendors invalidates the prior staff, branch, warehouse, terminal, legacy session, and pending checkout request context.

## License Enforcement

The previous runtime license guard was explicitly disabled in `PosPrototypeApp` by `if (false && ...)`. The gate and POS runtime now wait for a known license decision. Unknown, expired, blocked, suspended, or rejected state cannot open the dashboard or sales UI. An allowed snapshot must belong to the same certified vendor. The existing offline evaluator continues to recalculate cached state and exposes its offline source.

## Staff Authentication

Staff Access loads vendor-scoped Firestore records after vendor and license certification. Only active staff with the configured PIN can create a staff session. The authoritative runtime session is held in memory; local storage is retained only for compatibility and diagnostics and cannot restore authority by itself. Sessions include `signedInAt`, `validatedAt`, and `sessionVersion` metadata and expire from runtime certification after 12 hours.

## Branch and Terminal Authorization

The staff record must belong to the certified vendor and its branch assignment must match the selected branch. The branch, warehouse, and terminal must be active and vendor-scoped. The terminal must be in the selected branch, must be included in any explicit staff terminal assignment, and must point to the selected warehouse when it carries a warehouse assignment.

## Role and Permission Enforcement

Menu visibility now uses `getEffectivePageIdsForSession`, including the permission list copied from the authenticated staff record. Sales actions use `sessionHasEffectivePermission` rather than independently re-deriving authority from a role label. Canonical checkout still rejects `canCompleteSale: false` before repository posting. Price, discount, credit, negative-stock, hold, restore, void, receipt, customer, and delivery controls therefore use the same session permission source; role-based defaults remain the defined fallback when a staff record does not provide an explicit list.

## POS UI Wiring

The cashier path is `PosSales` -> `salesCheckoutService.completeSale` -> `canonicalSalesTransactionService.completeCheckout` -> `FirestoreSalesTransactionRepository.postCanonicalSaleAtomic`. The UI has one `await completeSale(...)` call and no Firestore posting primitives. Vendor, branch, warehouse, terminal, and staff IDs come from the certified session. The scoped checkout request ID is created once, reused across retry and held-sale completion, and cleared after success, logout, or authority-context invalidation. Inventory, payment, customer ledger, audit, BI, and durable receipt effects remain behind the canonical transaction boundary.

## Legacy and Duplicate Paths

- `src/pos-new/auth/PosVendorAuthGate.tsx` is a compatibility export that delegates to the canonical `src/sci-auth/VendorAuthGate.tsx`.
- `PosPrototypeApp` retains a defensive `PosStaffAccess` render when no certified staff session exists. It delegates to the same staff component and service; it is not a competing authenticator.
- `tenantSessionService`, `staffSessionGateService`, `staffPinService`, mock tenant data, preview panels, and build-development flags remain for historical preview/diagnostic surfaces. They are not imported by the active `App.tsx` POS route and cannot populate the new in-memory SCI authority context.
- `PosPrototypeApp.backup.tsx` is a non-imported source backup. It is not part of the Vite runtime graph.

## Security Findings

The first material defect was that the application trusted browser-restored vendor and staff objects while the real license block in `PosPrototypeApp` was disabled. A stale or altered local record could therefore reach operational POS rendering without Firebase, tenant, license, and session revalidation.

Additional findings were role-only menu/action derivation despite authenticated staff permissions, incomplete terminal-to-warehouse validation, and pending checkout identities surviving staff logout. These are corrected. Static inspection confirms that `PosSales.tsx` performs no direct Firestore or inventory posting and invokes the canonical checkout adapter once.

## Changes Implemented

- Added pure vendor and staff runtime certification rules.
- Made Firebase Auth state and Firestore tenant resolution prerequisites for vendor authority.
- Enforced a known, allowed, same-vendor license before Staff Access and POS operations.
- Separated persisted auth caches from authoritative in-memory sessions.
- Added validation timestamps and a bounded staff session lifetime.
- Added terminal warehouse authorization.
- Invalidated staff and pending mutation identity on logout and tenant change.
- Unified menu and sales action permission decisions around the authenticated session.
- Removed the disabled license condition and added a fail-closed checking state.

## Test Evidence

`tests/posUiAuthCertification.test.ts` contains 22 focused cases covering unauthenticated access, unresolved and mismatched vendors, unknown/expired licenses, inactive staff, unauthorized branch, cross-branch and cross-warehouse terminals, cross-vendor and stale sessions, logout, session permission menus and actions, canonical pre-posting denial, one checkout call, authoritative identity forwarding, direct-write absence, legacy-gate delegation, browser-storage tampering, tenant switching, and pending request cleanup.

The required Build 09.2B sales authority, transaction, in-memory idempotency, and durable idempotency suites are rerun unchanged as regression evidence. Firestore rules tests certify that the existing vendor-rooted rules remain intact.

## Known Limitations

- Staff PIN verification is currently a client-side comparison against the tenant-scoped staff document returned after Firebase vendor authentication. Moving PIN challenge verification to a trusted backend would further reduce credential exposure, but is outside this UI authority-chain build.
- Historical preview and build-development authentication modules remain in the repository for non-runtime diagnostic compatibility. The active POS route neither imports nor delegates authority to them.
- A browser reload intentionally requires Firebase/tenant/license revalidation and a new staff login; persisted values are not accepted as proof of identity.

## Final Certification Decision

CERTIFIED WITH DOCUMENTED NON-BLOCKING LIMITATIONS
