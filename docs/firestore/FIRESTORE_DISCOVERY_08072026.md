# Firestore Discovery — BUILD 08072026-FIRESTORE-DISCOVERY (STEP 1)

**Date:** 2026-07-08
**Scope:** Inspect Firestore collections used by the POS app BEFORE connecting subscription commerce or inventory workflows to Firestore. No runtime code was changed.

---

## 1. Summary

- The app uses a **`vendors`‑rooted, top‑level collection model** (e.g. `vendors`, `vendorLicenses`, `vendorPlans`, `activationTokens`, …).
- The current Firestore rules allow a **`businesses/{businessId}/...`** tree (`businesses`, `businessUsers`, `customers`, `invoices`, `payments`, `items`, `quotations`, `auditLogs`).
- **There is no `firestore.rules` file in this repository.** The "current rules" referenced by the task are treated here as the target spec to compare against.
- **Every collection the app actually writes/reads is a MISMATCH** with those rules. None of the app's real collections live under `businesses/{businessId}`.
- Authoritative collection names are centralised in `src/shared/backend/firestoreCollections.ts` (`FIRESTORE_COLLECTIONS`), but several collections are also hard‑coded as literal strings in services and fall outside that constant.

---

## 2. Method

Searched `src/**` for: `collection(`, `doc(`, `FIRESTORE_COLLECTIONS`, `getDocs`, `setDoc`, `addDoc`, `updateDoc`, `writeBatch`, `runTransaction`. Cross‑checked against the central `FIRESTORE_COLLECTIONS` constant and the task's rules spec.

---

## 3. Authoritative Collection Constant

`src/shared/backend/firestoreCollections.ts` defines:

`vendors`, `vendorRegistrations`, `vendorBranches`, `vendorWarehouses`, `vendorStaff`, `vendorLicenses`, `vendorPlans`, `plans`, `activationTokens`, `activationCodes`, `vendorPayments`, `vendorInvoices`, `vendorSyncStatus`, `vendorSyncEvents`, `vendorAuditLogs`.

`activationCodes` is **declared but never referenced** anywhere else in the codebase.

---

## 4. Collection Usage Report

Legend — **Level:** Top = top‑level collection; Nested = `vendors/{vendorId}/sub`. **Rules OK:** whether the referenced `businesses/{businessId}/...` rules allow it (all **NO**).

### 4.1 Top‑level collections defined in `FIRESTORE_COLLECTIONS`

| Collection | Level | Actions | Files (key lines) | Purpose | Rules OK |
|---|---|---|---|---|---|
| `vendors` | Top | R/W | vendorProvisioningService:215; VendorFirebaseService:52,60,91; posActivationCodeService:289; activationTokenConsoleService:85,202; vendorVerificationService:62,107,151; vendorSyncMonitorService:318; paymentRenewalService:199 | Vendor/business master record | NO |
| `vendorRegistrations` | Top | R/W | vendorProvisioningService:216; activationTokenConsoleService:91,190,222; vendorVerificationService:42,49,71,114,157; vendorSyncMonitorService:319 | Onboarding/registration docs | NO |
| `vendorBranches` | Top | W | vendorProvisioningService:217; VendorFirebaseService:173 | Branch registry | NO |
| `vendorWarehouses` | Top | W | vendorProvisioningService:218; VendorFirebaseService:174 | Warehouse registry (independent of branches) | NO |
| `vendorStaff` | Top | W | vendorProvisioningService:219; VendorFirebaseService:175 | Staff registry | NO |
| `vendorLicenses` | Top | R/W | vendorLicenseRuntimeService:391; posActivationCodeService:287; vendorVerificationService:79,123,163,205,237; vendorSyncMonitorService:320; paymentRenewalService:200; VendorVerificationQueuePage:57 | Runtime license state | NO |
| `vendorPlans` | Top | R/W | vendorLicenseRuntimeService:409; vendorProvisioningService:221; posActivationCodeService:288; vendorVerificationService:195; vendorSyncMonitorService:321 | Active plan assignment | NO |
| `plans` | Top | R | pricingPlansService:33,39; paymentRenewalService:238 | Catalogue of plan definitions | NO |
| `activationTokens` | Top | R/W | posActivationCodeService:147,286; activationTokenConsoleService:49,68,131,154; activationTokenService:60,103 (literal) | Issued activation tokens | NO |
| `activationCodes` | Top | — | declared only in firestoreCollections.ts:11 | (unused) | NO |
| `vendorPayments` | Top | R/W | paymentRenewalService:256 (R), 283 (W) | Vendor payment records | NO |
| `vendorInvoices` | Top | R/W | paymentRenewalService:265 (R), 375 (W) | Vendor invoice records | NO |
| `vendorSyncStatus` | Top | R | vendorSyncMonitorService:322 | Sync status | NO |
| `vendorSyncEvents` | Top | R/W | vendorSyncMonitorService:292 (W), 323/387 (R) | Sync events | NO |
| `vendorAuditLogs` | Top | W | vendorProvisioningService:223; posActivationCodeService:159,329; activationTokenConsoleService:134,172; vendorVerificationService:86,130,170,218,263; vendorSyncMonitorService:269; pricingPlansService:134; paymentRenewalService:183; activationTokenService:182 (literal) | Audit log (vendor‑scoped) | NO |

### 4.2 Top‑level collections hard‑coded as literal strings (NOT in `FIRESTORE_COLLECTIONS`)

| Collection | Level | Actions | Files | Purpose | Rules OK |
|---|---|---|---|---|---|
| `commerceEvents` | Top | W (addDoc) | commerce-integration/events/publishCommerceEvent.ts:25 | Commerce integration events | NO |
| `auditLogs` | Top | R/W (addDoc / getDocs) | commerce-integration/audit/writeAuditLog.ts:43; commerce-integration/audit/readAuditLogs.ts:15 | **Separate** top‑level audit log (distinct from `vendorAuditLogs`) | NO |
| `productTransformations` | Top | R/W | pos-new/services/productTransformationRepository.ts:30,94 | Product transformation records | NO |
| `productTransformationInputLines` | Top | R/W | productTransformationRepository.ts:44,114 | Transformation input lines | NO |
| `productTransformationOutputLines` | Top | R/W | productTransformationRepository.ts:62,133 | Transformation output lines | NO |

### 4.3 Nested collections under `vendors/{vendorId}`

| Collection | Level | Actions | Files | Purpose | Rules OK |
|---|---|---|---|---|---|
| `vendors/{vendorId}/sessionAuditEvents` | Nested | W (addDoc) | pos-new/pages/PosBIDesk.tsx:778 | Operator session audit events | NO |
| `vendors/{vendorId}/salesReceipts` | Nested | R | services/biService.ts:92 | BI sales source | NO |
| `vendors/{vendorId}/productMaster` | Nested | R | services/biService.ts:93 | BI product source | NO |
| `vendors/{vendorId}/stockAdjustments` | Nested | R | services/biService.ts:94 | BI stock source | NO |
| `vendors/{vendorId}/deliveryRequests` | Nested | R | services/biService.ts:95 | BI delivery source | NO |
| `vendors/{vendorId}/biEvents` | Nested | R | services/biService.ts:96 | BI events | NO |
| `vendors/{vendorId}/branches` | Nested | R | services/biService.ts:97 | BI branch source | NO |

### 4.4 Dynamic / diagnostic

| Collection | Level | Actions | Files | Purpose | Rules OK |
|---|---|---|---|---|---|
| `<collectionPath>` (param) | Dynamic | R/W | pos-new/firebase/firestoreSandboxRepository.ts:98,134,158,179,198,215 | Sandbox/diagnostics test writes | NO |

---

## 5. Rule Mismatch Analysis

**Reference rules (from task):** `businesses/{businessId}`, `businesses/{businessId}/businessUsers`, `businesses/{businessId}/customers`, `businesses/{businessId}/invoices`, `businesses/{businessId}/payments`, `businesses/{businessId}/items`, `businesses/{businessId}/quotations`, `businesses/{businessId}/auditLogs`.

**Findings:**

1. **Total structural mismatch.** The app writes to a `vendors` root; the rules permit only a `businesses/{businessId}` root. **No app collection matches the rules path/name.**
2. **Name mismatches even where concepts align:**
   - `vendors` (app) vs `businesses` (rules).
   - `vendorInvoices` (app) vs `businesses/{id}/invoices` (rules).
   - `vendorPayments` (app) vs `businesses/{id}/payments` (rules).
   - `vendorAuditLogs` (app) vs `businesses/{id}/auditLogs` (rules).
3. **App collections with no rule equivalent:** `vendorRegistrations`, `vendorBranches`, `vendorWarehouses`, `vendorStaff`, `vendorLicenses`, `vendorPlans`, `plans`, `activationTokens`, `activationCodes`, `vendorSyncStatus`, `vendorSyncEvents`.
4. **Undocumented top‑level collections** (not in `FIRESTORE_COLLECTIONS`, not in rules): `commerceEvents`, `auditLogs`, `productTransformations`, `productTransformationInputLines`, `productTransformationOutputLines`.
5. **Duplicate audit log concern:** app writes to BOTH `vendorAuditLogs` and a separate top‑level `auditLogs`. These should be reconciled.
6. **Nested collections** under `vendors/{vendorId}/...` (sessionAuditEvents, salesReceipts, productMaster, stockAdjustments, deliveryRequests, biEvents, branches) are not permitted by rules (which only allow nesting under `businesses/{businessId}`).
7. The referenced `businesses/{businessId}` rules tree is **entirely unused** by current code (no `businesses` references found anywhere).

**Net:** 100% of active collections are blocked by the current rules spec.

---

## 6. Recommended Option

**Recommend Option B — update Firestore rules to support the vendor top‑level collections** (with Option C as a temporary dev‑only bridge for testing).

Rationale:
- The whole app (provisioning, auth, activation, verification, sync, payments, BI, product transformation) is built around the `vendors` + `vendor*` model.
- **Option A** (migrate everything under `businesses/{businessId}/...`) would require rewriting `vendorProvisioningService`, `VendorFirebaseService`, `posActivationCodeService`, `activationTokenConsoleService`, `vendorVerificationService`, `vendorSyncMonitorService`, `paymentRenewalService`, `productTransformationRepository`, `biService`, `PosBIDesk`, and the central `FIRESTORE_COLLECTIONS` constant — a large, risky change that conflicts with the "do not modify business logic" constraint.
- **Option C** (dev‑only `allow read, write: if true`) is fine for local testing but unsafe for shared/production databases; use only as a short‑term bridge.
- **Option B** keeps the existing data model and only changes security rules.

### 6.1 Recommended rule structure (Option B draft)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Vendor root (replaces businesses/{businessId})
    match /vendors/{vendorId} {
      allow read, write: if isVendorMember(vendorId);
      // Nested sub-collections under vendors/{vendorId}
      match /{sub=**} { allow read, write: if isVendorMember(vendorId); }
    }

    match /vendorRegistrations/{id} { allow read, write: if request.auth != null; }
    match /vendorBranches/{id}    { allow read, write: if request.auth != null; }
    match /vendorWarehouses/{id}  { allow read, write: if request.auth != null; }
    match /vendorStaff/{id}       { allow read, write: if request.auth != null; }
    match /vendorLicenses/{id}    { allow read, write: if request.auth != null; }
    match /vendorPlans/{id}       { allow read, write: if request.auth != null; }
    match /vendorPayments/{id}    { allow read, write: if request.auth != null; }
    match /vendorInvoices/{id}    { allow read, write: if request.auth != null; }
    match /vendorSyncStatus/{id}  { allow read, write: if request.auth != null; }
    match /vendorSyncEvents/{id}  { allow read, write: if request.auth != null; }
    match /vendorAuditLogs/{id}   { allow create: if request.auth != null; }

    match /plans/{id}             { allow read: if true; allow write: if isAdmin(); }
    match /activationTokens/{id}  { allow read, write: if isAdmin(); }
    match /activationCodes/{id}   { allow read, write: if isAdmin(); }

    match /commerceEvents/{id}    { allow create: if request.auth != null; }
    match /auditLogs/{id}         { allow create: if request.auth != null; }

    match /productTransformations/{id} { allow read, write: if request.auth != null; }
    match /productTransformationInputLines/{id}  { allow read, write: if request.auth != null; }
    match /productTransformationOutputLines/{id} { allow read, write: if request.auth != null; }

    function isVendorMember(vendorId) {
      return request.auth != null
        && (request.auth.uid == vendorId
            || exists(/databases/$(database)/documents/vendors/$(vendorId)/businessUsers/$(request.auth.uid)));
    }
    function isAdmin() { return request.auth != null && isAdminClaim(); }
  }
}
```

### 6.2 Secondary recommendations
- Reconcile the two audit collections (`vendorAuditLogs` vs top‑level `auditLogs`); standardise on one.
- Add `activationCodes` usage or remove it from `FIRESTORE_COLLECTIONS` to avoid dead config.
- Add the literal‑string collections (`commerceEvents`, `auditLogs`, `productTransformations*`) to `FIRESTORE_COLLECTIONS` so all names are centralised.
- Decide whether nested `vendors/{vendorId}/...` (BI/session) should stay nested or move to flat `vendor*` collections for rule simplicity.

---

## 7. Files Inspected

- src/shared/backend/firestoreCollections.ts
- src/pos-new/vendor/vendorProvisioningService.ts
- src/sci-auth/VendorFirebaseService.ts
- src/pos-new/auth/vendorLicenseRuntimeService.ts
- src/pos-new/auth/posActivationCodeService.ts
- src/pos-new/auth/activationTokenService.ts
- src/platform/activationTokenConsoleService.ts
- src/platform/vendorVerificationService.ts
- src/platform/vendorSyncMonitorService.ts
- src/platform/pricingPlansService.ts
- src/platform/paymentRenewalService.ts
- src/platform/VendorVerificationQueuePage.tsx
- src/commerce-integration/events/publishCommerceEvent.ts
- src/commerce-integration/audit/writeAuditLog.ts
- src/commerce-integration/audit/readAuditLogs.ts
- src/pos-new/services/productTransformationRepository.ts
- src/pos-new/firebase/firestoreSandboxRepository.ts
- src/services/biService.ts
- src/pos-new/pages/PosBIDesk.tsx

No runtime code was modified.
