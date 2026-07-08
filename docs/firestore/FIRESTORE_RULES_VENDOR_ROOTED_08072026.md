# Firestore Rules — Vendor-Rooted Draft

**Build:** BUILD 08072026-FIRESTORE-RULES — STEP 2
**Date:** 2026-07-08
**Draft file:** `firestore.vendor-rooted.rules`
**Status:** DRAFT for review — NOT deployed.

This draft supports the current iTredPOS **vendors-rooted** data model. It replaces the
obsolete `businesses/{businessId}/...` rules tree (which the app does not use at all).

---

## 1. Files Created

| File | Purpose |
|---|---|
| `firestore.vendor-rooted.rules` | Production-safe Firestore rules draft using `vendorId` as the tenant boundary. |
| `docs/firestore/FIRESTORE_RULES_VENDOR_ROOTED_08072026.md` | This document. |

No runtime app code, auth, sales, or inventory logic was modified. The previous
discovery report (`docs/firestore/FIRESTORE_DISCOVERY_08072026.md`) and any existing
rules were not deleted.

---

## 2. Collections Covered

**Top-level (`vendorId` tenant boundary via the `vendors/{vendorId}` doc):**

| Collection | Read | Create | Update | Delete |
|---|---|---|---|---|
| `vendors/{vendorId}` | owner/staff | signed-in owner (ownerUid == uid) | owner/admin | owner |
| `vendorStaff/{staffId}` | member | admin | admin (vendorId immutable) | owner/admin |
| `vendorBranches/{branchId}` | member | member | member | admin |
| `vendorWarehouses/{warehouseId}` | member | member | member | admin |
| `vendorLicenses/{vendorId}` | owner/admin | owner/admin | owner/admin | owner |
| `vendorPlans/{vendorId}` | owner/admin | owner/admin | owner/admin | owner |
| `vendorRegistrations/{vendorId}` | owner/admin | signed-in owner | owner/admin | owner |
| `activationTokens/{tokenId}` | owner/admin only | owner/admin (dev) | owner/admin (dev) | owner |
| `activationCodes/{codeId}` | owner/admin only | owner/admin (dev) | owner/admin (dev) | owner |
| `vendorInvoices/{invoiceId}` | member | member (totals ≥ 0) | member (totals ≥ 0) | admin |
| `vendorPayments/{paymentId}` | member | member (amount > 0) | admin | admin |
| `vendorAuditLogs/{logId}` | member | member (eventType required) | **deny** | **deny** |
| `commerceEvents/{eventId}` | member | member (eventType required) | **deny** | **deny** |
| `auditLogs/{logId}` | member | member (eventType required) | **deny** | **deny** |
| `plans/{planId}` | public | — | — | server-only (`if false`) |
| `productTransformations/{docId}` | member | member | member | admin |
| `productTransformationInputLines/{docId}` | member | member | member | admin |
| `productTransformationOutputLines/{docId}` | member | member | member | admin |

**Nested under `vendors/{vendorId}/...`:**

`sessionAuditEvents`, `salesReceipts`, `productMaster`, `stockAdjustments`,
`deliveryRequests`, `biEvents`, `branches`.

- read: vendor member
- create: vendor member, `request.resource.data.vendorId == vendorId`
- update: admin only for the mutable set (`branches`, `salesReceipts`, `productMaster`,
  `stockAdjustments`, `deliveryRequests`); **denied** for immutable audit/BI records
  (`sessionAuditEvents`, `biEvents`)
- delete: admin only for the mutable set; **denied** for immutable audit/BI records

A final `match /{document=**} { allow read, write: if false; }` enforces default deny.

---

## 3. Security Assumptions

1. **Tenant boundary = `vendors/{vendorId}`**, with `ownerUid` on the vendor doc.
2. **Membership mirror required:** non-owner staff membership is resolved from a
   uid-keyed mirror `vendors/{vendorId}/businessUsers/{request.auth.uid}` (fields
   `vendorId`, `role`). This helper is named `vendorStaffPath()` in the draft.
3. **Roles:** `Owner` (vendor doc `ownerUid == uid`), `Admin` (staff role), plus
   generic `Manager`/`Staff` recognised by `hasVendorStaffRole`.
4. **`vendorId` immutability:** creates/updates require `request.resource.data.vendorId`
   and forbid changing it on update.
5. **Validation:** invoices require `total/subtotal >= 0`; payments require `amount > 0`;
   audit/event creates require a non-empty `eventType`.
6. **Sensitive writes (licenses, plans, tokens, codes):** owner/admin only in this
   draft; intended to move to server/Admin SDK in production (see §5).
7. **`plans` catalogue:** public read, server-only write.
8. **No `allow ... if true`** anywhere; default deny preserved.

---

## 4. Development-Only Risks

- **Staff blocked until mirror exists.** The app currently writes staff to the
  TOP-LEVEL `vendorStaff/{staffId}` keyed by `staffId` (e.g. `${vendorId}_owner`),
  **not** by auth uid, and does **not** write `vendors/{vendorId}/businessUsers/{uid}`.
  Therefore `isVendorStaffMember` is **always false** until that mirror is populated,
  so only the **vendor owner** can pass membership checks in the emulator. To test
  non-owner staff flows, the app must write the `businessUsers` mirror (or use the
  emulator with owner credentials).
- **Tokens/codes dev-only writes.** `activationTokens`/`activationCodes` allow
  owner/admin writes in this draft. In a shared/dev database this is acceptable; in
  production it must be restricted to Admin SDK.
- **`activationCodes` is unused** in app code (declared in `FIRESTORE_COLLECTIONS`
  only). The draft mirrors `activationTokens`; confirm or remove once usage is known.
- **Two audit collections.** The app writes both `vendorAuditLogs` and a separate
  top-level `auditLogs`. They should be reconciled to avoid split audit trails.
- **`get()` quota.** Role resolution chains a few `get()` calls per evaluation; within
  Firestore's limits (~10) but worth noting if logic grows.

### Emulator test checklist (emulator-friendly, no auto-deploy)

1. Start Firestore emulator, load `firestore.vendor-rooted.rules` (do not deploy to prod).
2. Sign in as **owner A** → create `vendors/{A}` (ownerUid == A). Expect **allow**.
3. As anonymous/unauthenticated → create/read `vendors/{A}`. Expect **deny**.
4. As **owner B** → read `vendors/{A}`. Expect **deny**.
5. Owner A → write `vendors/{A}/businessUsers/{staffUid}` `{vendorId:A, role:'Staff'}`.
6. As **staffUid** (non-owner) → read `vendors/{A}`, `vendorInvoices`, `vendorAuditLogs`.
   Expect **allow** (membership works only after step 5).
7. As staffUid → update `vendors/{A}`. Expect **deny** (not admin).
8. staffUid → create `vendorInvoices/{x}` with `total = -5`. Expect **deny** (totals ≥ 0).
9. staffUid → create `vendorPayments/{x}` with `amount = 0`. Expect **deny** (amount > 0).
10. staffUid → update `vendorAuditLogs/{x}`. Expect **deny** (immutable).
11. staffUid → read `activationTokens/{t}`. Expect **deny** (owner/admin only).
12. Owner A → read `activationTokens/{t}`. Expect **allow**.
13. Confirm `match /{document=**}` denies any undocumented collection.

---

## 5. Production Recommendations

1. **Move sensitive writes server-side.** License/plan/token/code issuance should be
   performed by **Cloud Functions / Admin SDK**, which bypass these rules. Then tighten
   browser rules for those collections to `allow write: if false;` to remove the dev-only
   owner/admin write path.
2. **Populate the `businessUsers` mirror** (or switch staff keying to auth uid) so
   browser-rule role resolution works for non-owner staff. Until then, only owners pass.
3. **Reconcile `auditLogs` vs `vendorAuditLogs`** into a single audit trail.
4. **Confirm or remove `activationCodes`.**
5. **Add the literal-string collections** (`commerceEvents`, `auditLogs`,
   `productTransformations*`) to `FIRESTORE_COLLECTIONS` so all names are centralised.
6. **Keep these rules as a defensive layer** even after server-side issuance; never use
   `allow read, write: if true`.
7. **Deploy only after** the emulator checklist passes and a human reviews this draft.
