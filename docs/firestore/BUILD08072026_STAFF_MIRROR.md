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

- Reads `uid` from `readPosAuthContext()` and resolves `vendorId` through the real
  tenant lookup priority (`resolveDiagnosticVendorId()`). Shows: vendorId, Firebase uid,
  whether the owner mirror exists, mirror role, status, permissions count, and updatedAt.
- **Refresh Mirror Status** → `getVendorBusinessUserMirror(vendorId, uid)`.
- **Create / Repair Owner Mirror** → `mirrorOwnerAsBusinessUser(vendorId, uid, ownerEmail)`
  (writes `role: Owner`, `permissions: ['*']`, `status: active`).
- Safe empty state when `vendorId` or `uid` is missing (never crashes).
- No PIN, PIN hash, password, or auth secret is read or displayed.
- Gated behind `SHOW_DEV_BADGES` (same convention as `BUILD_STATUS`), so it is a
  developer/admin section only and not a main user-facing feature.

---

## 7. Step 5 — Tenant Resolution (remove DEMO-VENDOR dependency)

**Branch:** `build08072026-subs`
**Scope:** Remove the DEMO-VENDOR dependency from the Staff Mirror Diagnostics panel and
resolve the real tenant vendorId.

**Status:** Implementation complete. `npm run build` passes.

### Problem

The diagnostic panel previously computed `vendorId` as:

```ts
const vendorId = auth?.vendorId || getActiveVendorId() || '';
```

`getActiveVendorId()` always returns a placeholder string (`'unassigned-vendor'`) when no
real vendor is found, and the surrounding auth/session code contains silent fallbacks such
as `'demo-vendor'` (PosPrototypeApp active-session creation) and `'demo-vendor-001'`
(build-development tenant session, Firebase auth logging). This meant the panel could read
or **write** the owner mirror under a demo/test vendor (e.g. `vendors/DEMO-VENDOR/...`),
which is exactly what the vendor-rooted Firestore rules must never depend on.

### Tenant resolution priority

A new pure helper `resolveDiagnosticVendorId()` in `src/pos-new/utils/vendorDataMode.ts`
replaces the `auth?.vendorId || getActiveVendorId()` call. It never falls back to a
placeholder — it returns `''` when no real tenant is resolved. Precedence:

1. **POS auth context vendorId** — `localStorage['sci_pos_vendor_auth_context'].vendorId`
2. **Active POS session vendorId** — `localStorage['itred_pos_active_session'].vendorId`
3. **Tenant session vendorId** — `localStorage['itred_pos_tenant_session'].vendorId`
   (build-development sessions are skipped via `isBuildDevelopmentSession`)
4. **Business profile vendorId** — `localStorage['itred_pos_business_profile'].vendorId`
5. **Local activation snapshot vendorId** —
   `localStorage['itred_pos_activation_snapshot'].vendorId`

Every resolved value is passed through `isRealVendorId()`, which rejects the known
non-tenant IDs: `DEMO-VENDOR`, `demo-vendor`, `demo-vendor-001`, `test-vendor-001`, and
`unassigned-vendor`.

### Why the DEMO-VENDOR fallback was removed

- The vendor-rooted Firestore rules (`firestore.vendor-rooted.rules`) expect
  `vendors/{vendorId}/businessUsers/{uid}` to exist for the **real** owner vendor. A mirror
  written under a demo vendor gives a false sense of readiness and pollutes Firestore.
- Silent fallbacks (`'demo-vendor'`, `'demo-vendor-001'`) invented a tenant that does not
  represent the signed-in vendor, violating the "do not invent vendorId" rule.
- Removing the fallback makes the panel honest: if there is no real tenant, it says so and
  stays read-only instead of pointing at a fake vendor.

### What happens when vendorId is missing

- `vendorId` resolves to `''` → the panel shows:
  `No vendorId resolved. Sign in or activate a vendor before repairing mirror.`
- The `vendorId` / `Firebase uid` / owner-mirror field grid is **hidden**.
- **Refresh Mirror Status** and **Create / Repair Owner Mirror** are **disabled** (the
  button row only renders when at least one of `vendorId`/`uid` is present, and each button
  is `disabled={!canAct}` where `canAct = hasVendorId && hasUid`).
- No `vendors/.../businessUsers/{uid}` read or write is attempted.

### What happens when Firebase uid is missing

- `uid` resolves to `''` (no Google session / not signed in) → the panel shows:
  `No Firebase UID resolved. Google owner sign-in is required.`
- Mirror actions are disabled for the same reason (`canAct` is false).
- This protects the owner-mirror key (`{uid}`) which must be the real Google auth uid.

### Owner mirror repair

`Create / Repair Owner Mirror` → `mirrorOwnerAsBusinessUser(vendorId, uid, ownerEmail, ownerName)`
which writes `vendors/{vendorId}/businessUsers/{uid}` with `role: Owner`,
`permissions: ['*']`, `status: active`, `source: owner-provisioning`. It only runs when both
`vendorId` and `uid` are present, so a real tenant and real Google identity are guaranteed.

### How to test the real vendor mirror

1. `npm run build` passes.
2. Open `/pos-prototype` → **Settings → Staff Mirror Diagnostics**.
3. With no signed-in vendor and no activation (fresh/clean storage):
   - Confirm **DEMO-VENDOR / demo-vendor / demo-vendor-001 never appears**.
   - Confirm the missing-state message
     `No vendorId resolved. Sign in or activate a vendor before repairing mirror.`
   - Confirm both buttons are disabled.
4. Sign in with a Google owner account and complete vendor onboarding / activation so a
   real `vendorId` and `googleUid` are present in `sci_pos_vendor_auth_context` (or the
   active/tenant session / activation snapshot).
   - Confirm the panel now shows the **real** `vendorId` and `Firebase uid`.
   - Click **Refresh Mirror Status** → reads `vendors/{realVendorId}/businessUsers/{uid}`.
   - Click **Create / Repair Owner Mirror** → writes the owner mirror under that real vendor.
5. Sign out the Google session but keep a vendor context:
   - Confirm `No Firebase UID resolved. Google owner sign-in is required.` and disabled actions.

### Files changed (Step 5)

- `src/pos-new/utils/vendorDataMode.ts`
  - Added `NON_TENANT_VENDOR_IDS`, session/activation storage keys, `isRealVendorId()`, and
    `resolveDiagnosticVendorId()` (strict 5-step priority, no demo fallback).
- `src/pos-new/components/VendorStaffMirrorDiagnosticsPanel.tsx`
  - Replaced `getActiveVendorId()` import with `resolveDiagnosticVendorId()`.
  - `vendorId` now from the tenant lookup priority; `ownerName` derived from
    `googleEmail`/`vendorName`.
  - Split empty state into `!hasVendorId` and `!hasUid` messages with the exact required
    copy; field grid shown only when `canAct`; buttons disabled when `!canAct`.
  - `repairOwner` passes `ownerName` to `mirrorOwnerAsBusinessUser`.

No sales, inventory, subscription, invoice, Firestore-rule, or UI-redesign changes were made.

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

---

## 8. Step 6 — Vendor Resolution By Owner UID

**Branch:** `build08072026-subs`
**Scope:** Resolve the real vendor document from Firestore after Google sign-in so the POS
no longer depends on local/demo vendor IDs.
**Status:** Implementation complete. `npm run build` passes.

### Vendor resolution by ownerUid

New service function `resolveVendorByOwnerUid(ownerUid)` in
`src/pos-new/auth/tenantResolutionService.ts`:

```ts
const q = query(
  collection(db, FIRESTORE_COLLECTIONS.vendors),
  where('ownerUid', '==', ownerUid)
);
```

Result type `VendorByOwnerUidResult` (`tenantResolutionTypes.ts`) returns:
`ok`, `vendorId`, `vendorName`, `ownerUid`, `ownerEmail?`, `status?`,
`accountStatus?`, `message`, `warning?`.

Resolution outcomes:
- **Exactly one vendor** → `ok: true`, `vendorId` + `vendorName`.
- **None found** → `ok: false`, message
  `"No vendor found for this Google account."` (clear missing state, no fake fallback).
- **More than one** → `ok: true`, first only, with
  `"Multiple vendors found for this owner. Vendor selector required in a later build."`

### Wiring into PosVendorAuthGate

After the Firebase Google profile populates `sci_pos_vendor_auth_context`
(`googleUid` / `googleEmail`), `PosVendorAuthGate` calls `resolveVendorByOwnerUid(uid)`
in `resolveVendorIntoContext(...)`:
- If a vendor is found → merge `vendorId` / `vendorName` into the auth context, save it,
  and re-run `resolveNextAuthStage`.
- If none is found → set the clear missing-vendor message; no stage change, no forced
  activation / business-profile / staff / license screens (rebuild mode still allows POS).
- If resolution throws → caught; context is left unchanged so POS access is preserved.

This path runs both from the `onAuthStateChanged` subscriber and from the Google
sign-in button success handler.

### Security

- Queries **only** by the authenticated owner's UID — no other vendor data is read or
  exposed.
- **No writes** in this step (read-only lookup).
- **No DEMO-VENDOR fallback** and **no invented vendorId**: when no real vendor resolves,
  `vendorId` stays empty and the diagnostics panel shows its missing-state message
  (Step 5 already rejects `DEMO-VENDOR` / `demo-vendor` / `demo-vendor-001` /
  `test-vendor-001`).
- Offline safe: if `db` is null or the query fails, it returns `ok: false` with a message
  and never crashes the app.

### How this supports rules and the staff mirror

- The vendor-rooted Firestore rules (`firestore.vendor-rooted.rules`) grant the owner
  mirror read/write based on `vendors/{vendorId}` existing for the real `ownerUid`. Once
  this resolver populates the real `vendorId` into the auth context, the Staff Mirror
  Diagnostics panel (Step 5) reads it directly from `sci_pos_vendor_auth_context` and can
  safely read/repair `vendors/{realVendorId}/businessUsers/{uid}`.
- `vendorStaffMirrorService.mirrorOwnerAsBusinessUser` therefore targets the genuine
  vendor document instead of a demo placeholder, matching the rule expectations.

### How to test

1. `npm run build` passes.
2. Sign in with Google (real Firebase account that owns a `vendors` doc with
   `ownerUid == uid`).
3. Confirm `sci_pos_vendor_auth_context` now contains the real `vendorId` / `vendorName`.
4. Open **Settings → Staff Mirror Diagnostics** and confirm `vendorId` is no longer
   `DEMO-VENDOR`.
5. With no vendor doc for the account, confirm the clear
   `"No vendor found for this Google account."` message and no fake fallback.
6. Kill Firestore / go offline → app must not crash; `ok: false` with an offline message.

### Files changed (Step 6)

- `src/pos-new/auth/tenantResolutionTypes.ts`
  - Added `VendorByOwnerUidResult` interface.
- `src/pos-new/auth/tenantResolutionService.ts`
  - Added `resolveVendorByOwnerUid(ownerUid)` (Firestore `vendors` where `ownerUid == uid`,
    one/none/multiple handling, offline-safe, read-only).
- `src/pos-new/auth/PosVendorAuthGate.tsx`
  - Imported `resolveVendorByOwnerUid`.
  - Added `resolveVendorIntoContext(uid)` and invoked it after the Google profile is
    captured (auth-state subscriber + sign-in button success).
- `docs/firestore/BUILD08072026_STAFF_MIRROR.md` — this section.

---

## 9. Step 7 — Multiple Vendor Owner Handling (Vendor Selector)

**Branch:** `build08072026-subs`
**Scope:** Handle one Google owner owning/managing more than one vendor via a safe
tenant selector.
**Status:** Implementation complete. `npm run build` passes.

### Multiple vendor owner handling

`resolveVendorByOwnerUid(ownerUid)` now returns the **full** candidate list:

```ts
vendors: ResolvedVendorSummary[];        // every vendor where ownerUid == uid
selectedVendorRequired: boolean;          // true when vendors.length > 1
```

`ResolvedVendorSummary` (only fields needed by the selector, no unrelated data):

```ts
{ vendorId, vendorName, accountStatus?, verificationStatus?, planCode?, city?, suburb? }
```

Behaviour in `PosVendorAuthGate.resolveVendorIntoContext(uid)`:

- **Exactly one vendor** → auto-select, persist `vendorId` / `vendorName`, continue
  (same as Step 6).
- **More than one vendor** → set `stage: 'vendorSelectionRequired'`, store `candidateVendors`
  in the auth context, leave `vendorId` empty, and render `VendorTenantSelectorPanel`.
- **None found** → clear state, show `"No vendor found for this Google account."`, no
  `DEMO-VENDOR` fallback.

### Vendor selector behavior

New component `src/pos-new/components/VendorTenantSelectorPanel.tsx`:

- Heading: **Select Business Tenant**.
- One card per candidate with: vendor name, vendor ID, status, plan, city/suburb
  (when available), and a **Select** button.
- A warning banner is shown when `vendors.length > 1`
  (`"Multiple vendors found for this owner. Vendor selector required to continue."`).
- On **Select**, `selectVendor(summary)` writes into `sci_pos_vendor_auth_context`
  (auth context only — **no Firestore write**) and calls `resolveNextAuthStage`:
  - `vendorId`, `vendorName`
  - `selectedAt` (ISO timestamp)
  - `selectedByUid` (current `googleUid`)
  - `selectedVendorRequired: false`

After selection the resolved `vendorId` flows into the Staff Mirror Diagnostics panel
(Step 5 priority 1 reads `sci_pos_vendor_auth_context`), so the mirror targets the
selected real vendor.

### Security notes

- Only vendors returned by the **ownerUid query** are selectable; the candidate list is
  produced solely from that query. Manual `vendorId` entry is not possible.
- Only `ResolvedVendorSummary` fields are displayed — no unrelated vendor data is exposed.
- No writes to Firestore occur in this step; selection is stored locally in the auth
  context only.
- A `resolvedForUidRef` guard prevents re-resolution from clobbering an already-made
  selection when the Firebase auth callback fires repeatedly.
- `resolveNextAuthStage` keeps `vendorSelectionRequired` sticky until a `vendorId` is
  actually chosen, so a mid-flow reload returns the owner to the selector.

### How to test

1. `npm run build` passes.
2. Owner with **one** vendor → app auto-selects it (no selector).
3. Owner with **multiple** vendors → `VendorTenantSelectorPanel` appears.
4. Select a vendor → `sci_pos_vendor_auth_context` gets `vendorId`, `vendorName`,
   `selectedAt`, `selectedByUid`.
5. Staff Mirror Diagnostics uses the **selected** `vendorId`.
6. No `DEMO-VENDOR` fallback appears at any point.
7. No Firestore writes happen in this step (selection is local only).

### Files changed (Step 7)

- `src/pos-new/auth/tenantResolutionTypes.ts`
  - Added `ResolvedVendorSummary`; extended `VendorByOwnerUidResult` with `vendors` and
    `selectedVendorRequired`.
- `src/pos-new/auth/tenantResolutionService.ts`
  - `resolveVendorByOwnerUid` now maps every matched doc to `ResolvedVendorSummary`,
    returns the full `vendors` array, and flags `selectedVendorRequired` when > 1.
- `src/pos-new/auth/posVendorAuthState.ts`
  - Added `vendorSelectionRequired` stage.
  - Extended `PosVendorAuthContext` with `candidateVendors`, `selectedVendorRequired`,
    `selectedAt`, `selectedByUid`.
  - `resolveNextAuthStage` keeps `vendorSelectionRequired` sticky until a vendor is chosen.
- `src/pos-new/auth/PosVendorAuthGate.tsx`
  - Imported `VendorTenantSelectorPanel` and `ResolvedVendorSummary`; added `useRef`.
  - `resolveVendorIntoContext` handles single (auto) vs multiple (selector) vs none.
  - Added `selectVendor(summary)` and a `vendorSelectionRequired` render branch.
- `src/pos-new/components/VendorTenantSelectorPanel.tsx` (new)
  - Selector panel with candidate vendor cards.
- `docs/firestore/BUILD08072026_STAFF_MIRROR.md` — this section.
