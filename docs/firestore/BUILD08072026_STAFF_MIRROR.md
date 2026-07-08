# Vendor Staff Membership Mirror — BUILD 08072026-STAFF-MIRROR (STEP 1)

**Date:** 2026-07-08
**Service:** `src/pos-new/services/vendorStaffMirrorService.ts`
**Status:** Service + types + validation + docs created. Not yet wired into staff workflows. Rules NOT deployed/modified.

---

## 1. Why the mirror is needed

The vendor-rooted Firestore rules (`firestore.vendor-rooted.rules`) use `vendorId` as the
tenant boundary and resolve **non-owner staff membership** from a uid-keyed mirror:

```
vendors/{vendorId}/businessUsers/{uid}
```

The app currently stores staff in the **top-level** `vendorStaff/{staffId}` collection, keyed by
`staffId` (e.g. `${vendorId}_owner`), **not** by Firebase auth uid, and there is no uid-indexed
staff path. Browser rules cannot `get()` a document by an unknown id, so without this mirror
`isVendorStaffMember()` is always false and only the vendor **owner** passes membership checks.

This service maintains the mirror so the rules can recognise vendor staff.

---

## 2. Firestore path

```
vendors/{vendorId}/businessUsers/{uid}
```

Writes use `setDoc(ref, data, { merge: true })`. `createdAt`/`createdBy` are preserved on update.

> Note: per the rules, writing a staff mirror requires owner/admin (the member is not yet in
> `businessUsers` when first created). The owner record itself is writable because the owner is
> recognised via `vendors/{vendorId}.ownerUid`. In practice this service is called from an
> owner/admin context (or seeded via Admin SDK in the emulator).

---

## 3. Mirror fields (`VendorBusinessUserMirror`)

| Field | Type | Notes |
|---|---|---|
| `uid` | string | Firebase auth uid (required) |
| `vendorId` | string | Tenant id (required) |
| `staffId` | string | App staff record id (optional) |
| `displayName` | string | Normalized display name |
| `email` | string | Normalized (trim + lowercase), optional |
| `role` | `VendorBusinessUserRole` | `TenantUserRole` ∪ `'Owner'` |
| `permissions` | string[] | Default `[]`; owner uses `['*']` |
| `status` | `VendorBusinessUserStatus` | `active` \| `inactive` \| `suspended` \| `removed` (default `active`) |
| `branchIds` | string[] | Default `[]` |
| `terminalIds` | string[] | Default `[]` |
| `warehouseIds` | string[] | Default `[]` |
| `createdAt` | string (ISO) | Preserved on update |
| `updatedAt` | string (ISO) | Set on every write |
| `createdBy` | string | Defaults to `uid` |
| `updatedBy` | string | Defaults to `uid` |
| `source` | `VendorBusinessUserSource` | `pos-settings` \| `owner-provisioning` \| `staff-management` \| `migration` \| `test-seed` |
| `removedAt?` | string (ISO) | Set only by `removeVendorBusinessUserMirror` |

---

## 4. Service functions

| Function | Purpose |
|---|---|
| `buildVendorBusinessUserMirror(input)` | **Pure.** Validates + normalizes the payload into a complete mirror. Throws on missing `uid`/`vendorId` or invalid `status`/`source`. |
| `upsertVendorBusinessUserMirror(input)` | Writes `vendors/{vendorId}/businessUsers/{uid}` (`merge:true`), preserves `createdAt`/`createdBy`, writes `BUSINESS_USER_MIRROR_UPSERTED` audit event. |
| `disableVendorBusinessUserMirror(vendorId, uid, updatedBy?)` | Soft disable → `status: inactive`, `updatedAt`, `updatedBy`. Writes `BUSINESS_USER_MIRROR_DISABLED`. |
| `removeVendorBusinessUserMirror(vendorId, uid, updatedBy?)` | Soft remove (no physical delete) → `status: removed`, `removedAt`, `updatedAt`, `updatedBy`. Writes `BUSINESS_USER_MIRROR_REMOVED`. |
| `getVendorBusinessUserMirror(vendorId, uid)` | Reads the mirror or returns `null`. |
| `mirrorOwnerAsBusinessUser(vendorId, ownerUid, ownerEmail?, ownerName?)` | Owner record: `role: 'Owner'`, `permissions: ['*']`, `status: 'active'`, `source: 'owner-provisioning'`. |

---

## 5. Security notes

- **No auth secrets.** The mirror stores only non-sensitive identity/authorization metadata
  (uid, vendorId, displayName, email, role, permissions, scoped ids). It does **not** store PINs,
  passwords, password/PIN hashes, refresh tokens, or any authentication secrets.
- PIN hashes remain exclusively in `staffPinService` and are never copied into this mirror.
- `db` may be `null` in the offline workspace; every writer guards on `!db` and degrades
  gracefully (logs a warning, returns the normalized object / no-ops) instead of throwing.
- Audit writes go through the existing `writeAuditLog` utility, which self-guards
  `firebaseReady` / `isPOSFirebaseWritesAllowed` and falls back to `console.info` locally. Audit
  failures are caught so they never block mirror writes.

---

## 6. How it supports the rules

- `isVendorStaffMember(vendorId)` in the rules does
  `exists(vendors/{vendorId}/businessUsers/{uid}) && get(...).vendorId == vendorId`.
  This service is what populates that document, so once a member's mirror exists, the rules treat
  them as a vendor member (read branch/warehouse/product records, create invoices/payments/audit
  logs, etc.).
- Owner is recognised directly via `vendors/{vendorId}.ownerUid`, independent of the mirror.

**Role mapping gap (track for wiring step):** the app uses `TenantUserRole`
(`VendorOwner`, `VendorAdmin`, `Manager`, …) while the rules currently recognise
`'Owner'` / `'Admin'` / `'Manager'` / `'Staff'`. This service stores the app role (with `'Owner'`
for the owner record). When wiring into staff workflows, apply a normalization map
(`VendorOwner`→`Owner`, `VendorAdmin`→`Admin`, …) or update the rules' `getVendorRole()` to the
app vocabulary. Not done in this step (rules are not modified yet).

---

## 7. What still needs to be wired later

- Call `mirrorOwnerAsBusinessUser` from owner provisioning (`vendorProvisioningService`) so the
  owner mirror exists on onboarding.
- Call `upsertVendorBusinessUserMirror` from staff creation/management (`PosStaffAccessPage`,
  `PosSettings` staff section) for each staff member.
- Call `disableVendorBusinessUserMirror` / `removeVendorBusinessUserMirror` from staff
  deactivation/removal flows.
- Add the `businessUsers` subcollection (and the mirror writes) to the emulator test plan in
  `docs/firestore/FIRESTORE_RULES_EMULATOR_TEST_08072026.md` so member scenarios are exercised.
- Resolve the role-mapping gap above (rules vs app vocabulary).

No UI was added and no POS workflow was changed in this step.
