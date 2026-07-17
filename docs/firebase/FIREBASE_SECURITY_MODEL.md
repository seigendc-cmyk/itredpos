# iTredPOS2 Firebase Security Model

Build: **08.2 — Firebase Security Rules, Indexes and Emulator Acceptance**
Scope: Firestore rules, indexes, Storage rules, tenant-aware application hardening, emulator support and rule tests.

## 1. Architecture Summary

iTredPOS2 is a **multi-tenant** POS platform. Each business is a *vendor*. All tenant data lives under a vendor-rooted document tree:

```
vendors/{vendorId}/
  branches/{branchId}
  warehouses/{warehouseId}
  terminals/{terminalId}
  staffProfiles/{staffId}
  businessUsers/{uid}            (membership mirror, manager-managed)
  branchAccess/{id}
  terminalAccess/{id}
  rolePermissionProfiles/{id}
  shifts/{shiftId}
  cashDrawers/{cashDrawerId}
  pos_cash_movements/{cashMovementId}
  productMaster/{productId}
  productStockBalances/{balanceId}
  inventoryMovements/{movementId}
  productLedger/{ledgerId}
  salesReceipts/{saleId}
  salesReceiptLines/{saleLineId}
  payments/{paymentId}
  salesReturns/{returnId}
  stockAdjustments/{adjustmentId}
  stocktakes/{stocktakeId}
  stockTransfers/{transferId}
  audit_logs/{auditLogId}
  auditEvents/{auditId}
  biEvents/{eventId}
  tasks/{taskId}
  approvals/{approvalId}
  marketplaceListings/{listingId}
  deliveries/{deliveryId}
  customers/{customerId}
  ... (and a generic catch-all subcollection rule)
```

A small number of **legacy flat collections** are retained for onboarding/auth bootstrapping and are also covered by rules:

```
vendors/{vendorId}
vendorUsers/{uid}      (authoritative membership document)
branches/{branchId}
warehouses/{warehouseId}
staff/{staffId}
pos_terminals/{terminalId}
licenses/{licenseId}
vendor_settings/{vendorId}
```

Storage follows an authenticated, active-membership vendor-scoped layout:

```
vendors/{vendorId}/products/{productId}/{fileName}
vendors/{vendorId}/logos/{fileName}
vendors/{vendorId}/receipts/{fileName}
vendors/{vendorId}/receipts/{receiptId}/{fileName}  (compatibility path)
vendors/{vendorId}/documents/{fileName}
```

## 2. Authoritative Membership Model

The security rules never trust a client-supplied `vendorId`. Access is derived from an **authoritative membership document**:

| Document | Purpose | Trusted fields |
| --- | --- | --- |
| `vendorUsers/{uid}` | Primary membership / authorization record | `vendorId`, `role`, `status`, `permissions` |
| `staff/{staffId}` | Staff identity (PIN-based POS login) | `vendorId`, `status`, `uid` |
| `vendors/{vendorId}` | Vendor ownership | `ownerUid`, `ownerEmail` |
| `vendors/{vendorId}/businessUsers/{uid}` | Mirror of membership for vendor-scoped lookups | `vendorId`, `uid`, `role`, `status` |

Rules resolve identity with `request.auth.uid` and compare it to `vendorUsers/{request.auth.uid}`. Cross-vendor reads/writes are rejected because `get(vendorUserPath()).data.vendorId` must equal the path's `vendorId`. Staff actions additionally require an active `staff/{staffId}` record matching the vendor.

**Platform administrator** is recognised only via the Firebase Auth custom claim `admin == true` (`isPlatformAdmin()`). It grants cross-vendor *read* through `belongsToVendor()` but does **not** bypass operation-specific guards (e.g. audit/stock-movement immutability, license protection).

## 3. Reusable Rule Functions

`firestore.rules` defines:

- `isAuthenticated()` — wrapper (`signedIn()`) over `request.auth != null`.
- `currentUser()` — `vendorUsers/{request.auth.uid}` lookup path.
- `isPlatformAdmin()` — Auth `admin` claim.
- `belongsToVendor(vendorId)` — active member OR platform admin.
- `belongsToBranch(vendorId, branchId)` — vendor membership + valid branch id.
- `isActiveStaff(vendorId, staffId)` — active `staff/{staffId}` for the vendor.
- `hasRole(vendorId, allowedRoles)` — role membership check.
- `hasPermission(vendorId, permission)` — permission list check (`'*'` wildcard supported).
- `fieldsAreUnchanged(fieldNames)` — diff-based immutability guard.
- `validCreateAuditFields(data)` / `validUpdateAuditFields(data, old)` — audit integrity.

All `get()`/`exists()` calls target only the authoritative membership documents listed above.

## 4. Collection Security (highlights)

| Collection | Read | Create | Update | Delete |
| --- | --- | --- | --- | --- |
| `vendors/{vendorId}` | owner / active member / email match | self-owned DEMO vendor only | owner, immutable owner | owner |
| `vendorUsers/{uid}` | self (active) | self, role Owner, perm `['*']` | self / owner | owner |
| `branches/warehouses/terminals` | active member | manager | manager, immutable keys | owner |
| `staffProfiles` | active member | manager | manager, **role immutable** | owner |
| `productMaster` | active member | vendor staff | vendor staff | manager |
| `salesReceipts` | active member | vendor (needs branch/terminal/staff) | same vendor, completed totals immutable | **denied** |
| `salesReceiptLines`, `payments` | active member | vendor | **denied** | **denied** |
| `inventoryMovements`, `productLedger` | active member | vendor staff (validated) | **denied** | **denied** |
| `audit_logs`, `auditEvents` | active member | vendor staff (validated) | **denied** | **denied** |
| `stockAdjustments`, `stocktakes`, `stockTransfers` | active member | vendor staff (risk-gated) | vendor staff (status-gated) | **denied** |
| `licenses/{licenseId}` | active member | manager | **owner only** | owner |
| `marketplaceListings` | **public if published+active+visible** | manager | manager | owner |
| `pos_cash_movements` | active member | vendor staff (approval-gated) | **denied** | **denied** |
| `shifts` | active member | vendor staff | vendor staff (closed-status immutable) | **denied** |

A `match /{document=**} { allow read, write: if false; }` fallback denies everything not explicitly matched.

## 5. Public vs Private

- **Private**: every tenant-owned collection requires an authenticated, vendor-membership-verified principal.
- **Public (read-only)**: `vendors/{vendorId}/marketplaceListings/{listingId}` is readable anonymously **only** when `published == true && status == 'Active' && marketplaceVisible == true`. No public writes, no exposure of cost/stock/staff/audit data.
- **Storage**: all reads require active membership in the path vendor. Product images are limited to approved image MIME types and 5 MB; logos and business documents additionally require an administrative role. Unmatched paths are denied.

## 6. Field Validation & Immutability

Rules enforce required fields and types (`is string`, `is number`, `is bool`, enumerated statuses) and immutable fields including `vendorId`, `branchId`, `terminalId`, `createdAt`, `createdBy`, `auditLogId`, `saleId`, `movementId`, `stockMovementId`, `originalTransactionId`, and license ownership. Authoritative `createdAt`/`updatedAt` should be server timestamps; client-supplied time is never trusted for financial, licensing, audit or stock integrity.

## 7. Transaction Safety

Application workflows use Firestore transactions / write batches at the repository layer:

- **Sale completion** — `FirestoreSalesRepository` commits sale header, lines, payments and inventory movements inside `runTransaction`, with an **idempotency key** to prevent duplicate writes.
- **Stock deduction / receipt / adjustment / transfer** — `FirestoreInventoryRepository` uses `runTransaction` with balance-before/after validation.
- **Returns / reversals** — idempotency-key guarded transactions.
- **Shift open/close & cash movements** — repository-guarded, permission/role checked.

## 8. Indexes (`firestore.indexes.json`)

Compound indexes are declared for vendor-scoped subcollection queries (scope `COLLECTION`, since the app issues single-collection queries via `collection(db, firestorePaths.X(vendorId))`):

- `salesReceipts` (vendorId, saleStatus, createdAt)
- `salesReceiptLines` (vendorId, saleId)
- `audit_logs` (vendorId, action, createdAt)
- `auditEvents` (vendorId, createdAt)
- `inventoryMovements` (vendorId, branchId, movementType, createdAt) and (vendorId, productId, movementType, createdAt)
- `deliveries` (vendorId, status, createdAt)
- `delivery_lines` (deliveryId, productId)
- `stockTransfers` / `stocktakes` / `stockAdjustments` (vendorId, status/branchId, createdAt)
- `shifts` (vendorId, terminalId, status, createdAt)
- `pos_cash_movements` (vendorId, terminalId, movementType, createdAt)
- `approvals` (vendorId, status, createdAt)
- `tasks` (vendorId, assignedTo, status)
- `biEvents` (vendorId, eventType, timestamp)
- `productMaster` (vendorId, status, category), (vendorId, sku), (vendorId, barcode)
- `customers` (vendorId, status)
- `payments` (vendorId, saleId)
- `productStockBalances` (vendorId, productId, branchId / warehouseId)

## 9. Environment Configuration

Required variables (`src/pos-new/firebase/firebaseConfig.ts`, validated by `src/firebase/firebaseEnvValidation.ts`):

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

`.env*` is git-ignored (only `.env.example` is committed). **Never commit** service-account JSON, private keys or Admin SDK credentials.

## 10. Emulator & Test Commands

```bash
# Start emulators (requires Java 21+)
npm run firebase:emulators

# Start Auth, Firestore and Storage, run both suites, then stop
npm run firebase:rules:test

# Run against emulators that are already active
npm run test:firebase-rules
```

Acceptance suites in `tests/firebase/`:
- `firestore.rules.test.ts` — 15 Firestore authorization, tenancy, privilege-escalation and immutability scenarios.
- `storage.rules.test.ts` — 8 Storage authorization, MIME, size and cross-vendor scenarios.

The Firebase emulator binaries are local development dependencies only. No production credentials are needed and the command does not deploy resources.

## 11. Deployment Commands (operator review — do NOT auto-deploy)

```bash
firebase use itredPOS
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
firebase deploy --only storage
firebase deploy --only hosting
```

Dry-run validation (non-destructive; fails safe if the CLI version lacks `--dry-run` for the target):

```bash
firebase deploy --only firestore:rules --dry-run
```

## 12. Known Limitations

1. **Java dependency** — emulator-based rule tests require a local Java 21+ runtime.
2. **Onboarding flat paths** — `VendorFirebaseService`/`VendorAuthGate` write legacy flat collections (`branches`, `staff`, `licenses`, `pos_terminals`, `vendor_settings`). Rules cover these, but the long-term target is to migrate onboarding to the vendor-scoped tree for a single consistent boundary.
3. **Plaintext PINs** — `staff/{staffId}` stores `pinCode` in plaintext. Recommended migration: store `pinHash` only and verify server-side (Cloud Function) rather than client-side comparison.
4. **Business-user mirror** — `businessUsers/{uid}` is manager-managed and not used for primary read authorization (still `vendorUsers/{uid}`), keeping a single source of truth for access decisions.
5. **Platform admin claim** — must be set by a trusted backend (Admin SDK), never by the client.

## 13. Backend-Only Operations

The following must remain server-controlled (Cloud Functions / Admin SDK) and are **denied to ordinary clients** by the rules:

- License creation, activation, plan change, expiry change, device-limit change.
- Activation code generation/issuance (`activationCodes`, `activationTokens`).
- Vendor deletion (client write of `delete` on `vendors/{vendorId}` is owner-only; privileged lifecycle ops stay server-side).
- Audit/stock-movement/BI-event mutation (create is client-permitted for staff, but update/delete denied).
- Cross-vendor data aggregation and platform analytics.

## 14. Rollback Procedure

1. `firebase deploy --only firestore:rules --version <previous>` (list versions: `firebase firestore:rules:list`).
2. Restore `firestore.rules` from git history and re-deploy if needed.
3. Index changes are additive; remove unused indexes via `firestore.indexes.json` and `firebase deploy --only firestore:indexes`.
4. Storage rollback: `firebase deploy --only storage --version <previous>`.

## 15. Acceptance Criteria Mapping

- [x] `firestore.rules` exists and referenced by `firebase.json`
- [x] `firestore.indexes.json` exists and referenced
- [x] `storage.rules` exists (Storage is initialised)
- [x] Hosting configuration preserved
- [x] All active collections have explicit coverage
- [x] Deny-all fallback present
- [x] Unauthenticated access denied
- [x] Cross-vendor access denied
- [x] Branch restrictions enforced via membership
- [x] Staff role escalation prevented (`role` immutable for non-owners)
- [x] Licenses / activation codes protected
- [x] Audit & stock-movement records immutable
- [x] Public marketplace reads expose only published/active/visible data
- [x] Application queries use vendor-scoped paths via `firestorePaths`
- [x] Repository context validation blocks undefined tenant queries
- [x] Rule tests authored and passing (23 scenarios across Firestore and Storage)
- [x] TypeScript validation passing (`npm run lint`)
- [x] Production build passing (`npm run build`)
- [x] No secrets committed (`.env*` ignored)
- [x] Documentation updated
- [x] No production deployment performed
