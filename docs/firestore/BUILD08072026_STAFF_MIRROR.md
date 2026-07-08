# BUILD08072026-STAFF-MIRROR — Step 2

## Owner Mirror During Vendor Provisioning

**Branch:** `build08072026-subs`
**Scope:** Wire `vendorStaffMirrorService.mirrorOwnerAsBusinessUser` into vendor **owner** provisioning only.
**Status:** Implementation complete. `npm run build` passes.

---

## 1. Owner Provisioning Integration Point (chosen)

**File:** `src/pos-new/vendor/vendorProvisioningService.ts`
**Function:** `provisionVendorFromBusinessSetup(...)`
**Wired at:** immediately after `await batch.commit()` succeeds (the vendor + owner staff
record are durably committed), via a new best-effort helper `ensureOwnerBusinessUserMirror(...)`.

The call made:

```ts
await mirrorOwnerAsBusinessUser(vendorId, ownerUid, ownerEmail, ownerName);
```

which writes:

```
vendors/{vendorId}/businessUsers/{ownerUid}
```

with role `Owner`, status `active`, permissions `['*']`, source `owner-provisioning`,
`createdAt`/`updatedAt`, `createdBy`/`updatedBy`.

### Why this point

- It is the canonical POS onboarding path in `pos-new` and is the function that
  **creates** the `vendors/{vendorId}` document and the owner `vendorStaff` record.
- It already has all required owner identity available: `authContext.googleUid`
  (owner uid), `business.ownerName`, `business.ownerEmail`.
- Placing the mirror write **after** `batch.commit()` guarantees it is the point
  *closest to successful vendor creation* — the vendor document provably exists
  before the mirror is attempted.
- The mirror write is isolated in its own `try/catch`, so even if it fails the
  vendor provisioning result is unchanged and the flow returns success.

---

## 2. Why Only Owner Is Wired in Step 2

This step exists only to satisfy the vendor-rooted Firestore rules requirement that
`vendors/{vendorId}/businessUsers/{uid}` exist for **owner-level** membership checks
(`isVendorMember()` / `isVendorStaffMember()`). The owner must always have a mirror so
owner reads/writes pass once rules are deployed. Staff membership mirroring is a
separate concern (normal staff management, POS settings) and is intentionally deferred
to a later step to keep the change minimal and isolated.

---

## 3. How To Test The Owner Mirror

1. Run the app locally (`npm run dev`) and complete vendor onboarding via the
   business-setup / owner signup flow that calls `provisionVendorFromBusinessSetup`.
2. After provisioning succeeds, open **Firestore** and confirm the document exists:

   ```
   vendors/{vendorId}/businessUsers/{ownerUid}
   ```

3. Verify the fields:
   - `role` === `Owner`
   - `status` === `active`
   - `permissions` === `['*']`
   - `source` === `owner-provisioning`
   - `uid` === `ownerUid`, `vendorId` === `vendorId`
   - `createdAt` / `updatedAt` present and ISO strings
   - `createdBy` / `updatedBy` present
4. Confirm **no** `pin`, `password`, `passwordHash`, `pinHash`, or secret fields exist
   in the mirror document.
5. Negative test: simulate a mirror-write failure (e.g. offline / rules reject). The
   vendor provisioning result must still return `firestoreWritten: true` and a console
   warning must be logged; the owner creation flow must not crash.

---

## 4. Step 3 — Staff Management Integration Point

**File:** `src/pos-new/pages/PosSettings.tsx`
**Workflow:** Settings → Staff Database (`STAFF` tab)

Wired into the two staff lifecycle mutations that exist in Settings:

| Action | Handler | Mirror call |
|--------|---------|-------------|
| Create / Update | `handleAddOrEditStaff` | `upsertVendorBusinessUserMirror(...)` (best-effort, fire-and-forget `void`) |
| Remove / Delete | `handleDeleteStaff` | `removeVendorBusinessUserMirror(vendorId, uid, updatedBy)` (best-effort) |

Disable is **not** wired: the Settings Staff workflow has no staff-disable / status
toggle control (staff are only created, updated, or removed). `disableVendorBusinessUserMirror`
remains available for a future staff-disable UI / status control and is documented as a
follow-up.

### UID dependency

`StaffSetting` (local POS staff record) had **no Firebase auth uid** — only `id`,
`name`, `email`, `role`, `pass`, `pin?`, `branchId`. Staff in this app are local (the
`pin` is a demo PIN, not a Firebase credential).

- Added optional `uid?: string` to `StaffSetting` (type-only change; no logic change).
- In both handlers, if `staff.uid` is **missing**, the mirror is **skipped** and a
  non-blocking warning is logged:
  ```
  [posSettings] Staff mirror skipped because uid is missing.
  ```
  The `uid` is **never invented**; the staff record is left unchanged.

### Fields mapped from the staff record

| Mirror field | Source |
|--------------|--------|
| `uid` | `staff.uid` (skipped if absent) |
| `vendorId` | `businessProfile.vendorId \|\| getActiveVendorId()` |
| `staffId` | `staff.id` |
| `displayName` | `staff.name` |
| `email` | `staff.email` |
| `role` | `staff.role` via `mapRoleToMirrorRole` (`'Stock Controller'` → `'StockController'`, etc.) |
| `permissions` | `[]` (effective permissions not available in this local flow) |
| `status` | `active` (create/update) / `removed` (delete) |
| `branchIds` | `[staff.branchId]` if present |
| `terminalIds` / `warehouseIds` | `[]` (not present on the local staff record) |
| `source` | `staff-management` |
| `createdBy` / `updatedBy` | `activeOperatorName \|\| vendorId` |

### Security

- The mirror write **never** reads `staff.pass` or `staff.pin`. No PIN, PIN hash,
  password, or local unlock secret is ever written to `businessUsers/{uid}`.
- Mirror writes are best-effort: each is wrapped in its own `try/catch`; failures log a
  console warning and do **not** block or crash the staff save/delete.

### How to test the staff mirror

1. `npm run build` passes (verified: `✓ built in 18.59s`).
2. In Settings → Staff Database, add a staff member.
   - With **no** `uid` (current local staff): confirm the app does not crash and the
     console shows `Staff mirror skipped because uid is missing.`
   - With a `uid` present (Firebase-linked staff): confirm
     `vendors/{vendorId}/businessUsers/{uid}` exists, `role`/`status` correct, and no
     `pin`/`password` fields are written.
3. Update the staff role → confirm the mirror `role` updates (upsert).
4. Delete the staff → confirm mirror `status` === `removed`.
5. Simulate a mirror failure (offline / rejected) → confirm the staff save/delete still
   succeeds with a console warning.

### Remaining for staff

- **Disable**: add `disableVendorBusinessUserMirror` when a staff-disable / status
  control is introduced (none exists in Settings today).
- **Effective permissions**: replace the `[]` placeholder with computed effective
  permissions when a permission-resolution function is available in this flow.
- **Secondary owner provisioning point not wired** (follow-up):
  `src/sci-auth/VendorFirebaseService.ts` → `createVendorAccount(...)`.

---

## 5. Files Changed

- `src/pos-new/vendor/vendorProvisioningService.ts` (Step 2)
  - Added import of `mirrorOwnerAsBusinessUser` from `../services/vendorStaffMirrorService`.
  - Added `ensureOwnerBusinessUserMirror(...)` best-effort helper.
  - Called it after `batch.commit()` in `provisionVendorFromBusinessSetup(...)`.
- `src/pos-new/pages/PosSettings.tsx` (Step 3)
  - Imported `upsertVendorBusinessUserMirror`, `removeVendorBusinessUserMirror`, and
    `VendorBusinessUserRole` from `../services/vendorStaffMirrorService`.
  - Added `mapRoleToMirrorRole`, `syncStaffBusinessUserMirror`, `removeStaffBusinessUserMirror`
    helpers (best-effort, UID-aware).
  - Wired `syncStaffBusinessUserMirror` into `handleAddOrEditStaff` (create + update).
  - Wired `removeStaffBusinessUserMirror` into `handleDeleteStaff` (remove).
- `src/pos-new/types/posTypes.ts` (Step 3)
  - Added optional `uid?: string` to `StaffSetting` (type-only; enables Firebase-linked
    staff to receive a mirror without changing existing local-staff behavior).

## 6. Step 4 — Staff Mirror Diagnostic Panel

**New file:** `src/pos-new/components/VendorStaffMirrorDiagnosticsPanel.tsx`
**Wired in:** `src/pos-new/pages/PosSettings.tsx` (dev/admin-only section)

A read-only-ish diagnostic panel that verifies the vendor-rooted membership mirror at
`vendors/{vendorId}/businessUsers/{uid}` and can create/repair the **owner** mirror.

- Reads `vendorId` / `uid` from `readPosAuthContext()` (falls back to
  `getActiveVendorId()`). Shows: vendorId, Firebase uid, whether the owner mirror exists,
  mirror role, status, permissions count, and updatedAt.
- **Refresh Mirror Status** → `getVendorBusinessUserMirror(vendorId, uid)`.
- **Create / Repair Owner Mirror** → `mirrorOwnerAsBusinessUser(vendorId, uid, ownerEmail)`
  (writes `role: Owner`, `permissions: ['*']`, `status: active`).
- Safe empty state when `vendorId` or `uid` is missing (never crashes).
- No PIN, PIN hash, password, or auth secret is read or displayed.
- Gated behind `SHOW_DEV_BADGES` (same convention as `BUILD_STATUS`), so it is a
  developer/admin section only and not a main user-facing feature.

---

## 5. Files Changed

- `src/pos-new/vendor/vendorProvisioningService.ts` (Step 2)
  - Added import of `mirrorOwnerAsBusinessUser` from `../services/vendorStaffMirrorService`.
  - Added `ensureOwnerBusinessUserMirror(...)` best-effort helper.
  - Called it after `batch.commit()` in `provisionVendorFromBusinessSetup(...)`.
- `src/pos-new/pages/PosSettings.tsx` (Step 3 + Step 4)
  - (Step 3) Imported `upsertVendorBusinessUserMirror`, `removeVendorBusinessUserMirror`,
    and `VendorBusinessUserRole`; added `mapRoleToMirrorRole`, `syncStaffBusinessUserMirror`,
    `removeStaffBusinessUserMirror`; wired into `handleAddOrEditStaff` and `handleDeleteStaff`.
  - (Step 4) Imported `VendorStaffMirrorDiagnosticsPanel`; added `STAFF_MIRROR_DIAGNOSTICS`
    section (dev/admin only) and rendered the panel gated behind `SHOW_DEV_BADGES`.
- `src/pos-new/types/posTypes.ts` (Step 3)
  - Added optional `uid?: string` to `StaffSetting` (type-only).
- `src/pos-new/components/VendorStaffMirrorDiagnosticsPanel.tsx` (Step 4, new)
  - Diagnostic panel component (see section 6).

No application logic, sales, inventory, subscription, or invoice code was changed.
`_archive`, `recovered-*`, and `*backup*` files untouched.
