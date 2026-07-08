# Firestore Rules — Emulator Test Plan

**Build:** BUILD 08072026-FIRESTORE-RULES — STEP 3
**Date:** 2026-07-08
**Reviewed rules:** `firestore.vendor-rooted.rules`
**Status:** Review + emulator test plan. **Rules NOT deployed.**

This document reviews `firestore.vendor-rooted.rules` and defines a concrete emulator
testing checklist covering the 10 required scenarios. It pairs with:
- `docs/firestore/FIRESTORE_DISCOVERY_08072026.md` (collection discovery)
- `docs/firestore/FIRESTORE_RULES_VENDOR_ROOTED_08072026.md` (rules design + assumptions)

---

## 1. Review Summary

The draft is internally consistent and meets the stated constraints:
- All 11 required helper functions are present (`isSignedIn`, `isValidId`, `vendorPath`,
  `vendorExists`, `vendorStaffPath`, `isVendorOwner`, `hasVendorStaffRole`, `isVendorMember`,
  `getVendorRole`, `isVendorAdmin`, `belongsToVendor`).
- No `allow ... if true` is used; a trailing `match /{document=**} { allow read, write: if false; }`
  enforces default deny.
- `vendorId` is the tenant boundary; writes require `request.resource.data.vendorId` and forbid
  changing it on update.
- Sensitive writes (licenses, plans, tokens, codes) are owner/admin only in this draft.

**Key review finding (must be reflected in tests):** non-owner staff membership is resolved from
a uid-keyed mirror `vendors/{vendorId}/businessUsers/{uid}`. The app does **not** yet write this
mirror, so in tests it must be seeded (via Admin SDK) before member scenarios. Without it,
`IS_VENDOR_MEMBER` is always false and only the **owner** passes.

---

## 2. Emulator Setup

### 2.1 Start the emulator (do NOT deploy)

```bash
# from repo root
firebase emulators:start --only firestore
# load the draft rules explicitly (no deploy):
#   firebase emulators:start --only firestore --rules firestore.vendor-rooted.rules
```

Use a fixed project id for tests, e.g. `itredpos-emulator`.

### 2.2 Project layout used by tests

```
vendors/V_A            { ownerUid: "ownerA" }
vendors/V_A/businessUsers/ownerA   { vendorId: "V_A", role: "Owner" }
vendors/V_A/businessUsers/staffA   { vendorId: "V_A", role: "Staff" }
vendors/V_A/businessUsers/adminA   { vendorId: "V_A", role: "Admin" }
vendors/V_B            { ownerUid: "ownerB" }
vendorBranches/B1      { vendorId: "V_A", branchName: "Main" }
vendorWarehouses/W1    { vendorId: "V_A", warehouseName: "WH1" }
vendorInvoices/INV1    { vendorId: "V_A", total: 100, subtotal: 100 }
vendorPayments/PAY1    { vendorId: "V_A", amount: 10 }
activationTokens/T1    { vendorId: "V_A", code: "SCI-XXXX" }
```

Seed the `businessUsers` mirror and base docs with the **Admin** app (server context) so the
seed itself is not blocked by the rules under test.

---

## 3. Required Scenario Checklist (manual emulator)

| # | Scenario | As | Target | Expected |
|---|---|---|---|---|
| 1 | Owner creates vendor | ownerA | `vendors/V_NEW` (ownerUid=ownerA) | **ALLOW** |
| 2 | Owner reads/updates vendor | ownerA | `vendors/V_A` | **ALLOW** |
| 3 | Non-owner (no mirror) accesses vendor | ownerB / staffX | `vendors/V_A` | **DENY** |
| 4 | Member reads branch/warehouse/product | staffA | `vendorBranches/B1`, `vendorWarehouses/W1`, `vendors/V_A/productMaster/M1` | **ALLOW** |
| 5 | Member accesses another vendor | staffA | `vendors/V_B`, `vendorBranches` (vendorId=V_B) | **DENY** |
| 6 | Audit log create vs update/delete | staffA | `vendorAuditLogs/X1` | create **ALLOW**, update/delete **DENY** |
| 7 | Activation token restricted | staffA / ownerA | `activationTokens/T1` | staff **DENY** read/write, owner **ALLOW** |
| 8 | Payment amount > 0 | staffA | `vendorPayments/P2` (amount=0 vs 10) | 0 **DENY**, 10 **ALLOW** |
| 9 | Invoice non-negative totals | staffA | `vendorInvoices/I2` (total=-5 vs 0) | -5 **DENY**, 0 **ALLOW** |
| 10 | Default deny unknown path | any signed-in | `someUnknownCollection/X` | **DENY** |

---

## 4. Automated Test (rules-unit-testing)

`firestore.rules.test.ts` (run with `firebase emulators:exec` or `jest` + emulator):

```ts
import {
  initializeAdminApp, initializeTestApp, assertSucceeds, assertFails, clearFirestoreData
} from '@firebase/rules-unit-testing';
import { setDoc, getDoc, addDoc, updateDoc, deleteDoc, doc, collection } from 'firebase/firestore';

const PROJECT = 'itredpos-emulator';
const rules = 'firestore.vendor-rooted.rules';

const admin = initializeAdminApp({ projectId: PROJECT });
const appAs = (uid: string) => initializeTestApp({ projectId: PROJECT, auth: { uid, email: `${uid}@test.com` } });
const dbAs = (uid: string) => appAs(uid).firestore();

async function seed() {
  const a = admin.firestore();
  await setDoc(doc(a, 'vendors/V_A'), { ownerUid: 'ownerA' });
  await setDoc(doc(a, 'vendors/V_A/businessUsers/ownerA'), { vendorId: 'V_A', role: 'Owner' });
  await setDoc(doc(a, 'vendors/V_A/businessUsers/staffA'), { vendorId: 'V_A', role: 'Staff' });
  await setDoc(doc(a, 'vendors/V_A/businessUsers/adminA'), { vendorId: 'V_A', role: 'Admin' });
  await setDoc(doc(a, 'vendors/V_B'), { ownerUid: 'ownerB' });
  await setDoc(doc(a, 'vendorBranches/B1'), { vendorId: 'V_A', branchName: 'Main' });
  await setDoc(doc(a, 'vendorWarehouses/W1'), { vendorId: 'V_A', warehouseName: 'WH1' });
  await setDoc(doc(a, 'activationTokens/T1'), { vendorId: 'V_A', code: 'SCI-XXXX' });
}

beforeAll(async () => { await seed(); });
afterAll(async () => { await Promise.all([admin.delete(), appAs('ownerA').delete(), appAs('staffA').delete(), appAs('ownerB').delete()]); await clearFirestoreData({ projectId: PROJECT }); });

// 1. Owner can create vendor
test('1 owner creates vendor', async () => {
  await assertSucceeds(setDoc(doc(dbAs('ownerA'), 'vendors/V_NEW'), { ownerUid: 'ownerA' }));
});

// 2. Owner can read/update vendor
test('2 owner reads/updates vendor', async () => {
  await assertSucceeds(getDoc(doc(dbAs('ownerA'), 'vendors/V_A')));
  await assertSucceeds(updateDoc(doc(dbAs('ownerA'), 'vendors/V_A'), { note: 'ok' }));
});

// 3. Non-owner cannot access vendor without businessUsers mirror
test('3 non-owner denied (no mirror)', async () => {
  await assertFails(getDoc(doc(dbAs('ownerB'), 'vendors/V_A')));
  await assertFails(getDoc(doc(dbAs('stranger'), 'vendors/V_A'))); // uid with no mirror
});

// 4. Vendor member can read branch/warehouse/product records
test('4 member reads branch/warehouse/product', async () => {
  await assertSucceeds(getDoc(doc(dbAs('staffA'), 'vendorBranches/B1')));
  await assertSucceeds(getDoc(doc(dbAs('staffA'), 'vendorWarehouses/W1')));
  await assertSucceeds(setDoc(doc(dbAs('staffA'), 'vendors/V_A/productMaster/M1'), { vendorId: 'V_A' }));
  await assertSucceeds(getDoc(doc(dbAs('staffA'), 'vendors/V_A/productMaster/M1')));
});

// 5. Vendor member cannot access another vendor
test('5 member denied cross-vendor', async () => {
  await assertFails(getDoc(doc(dbAs('staffA'), 'vendors/V_B')));
  await assertFails(setDoc(doc(dbAs('staffA'), 'vendorBranches/BX'), { vendorId: 'V_B' }));
});

// 6. Audit logs: create allowed, update/delete denied
test('6 audit log immutable', async () => {
  await assertSucceeds(addDoc(collection(dbAs('staffA'), 'vendorAuditLogs'), { vendorId: 'V_A', eventType: 'Test' }));
  await assertFails(updateDoc(doc(dbAs('staffA'), 'vendorAuditLogs/ANY'), { eventType: 'x' }));
  await assertFails(deleteDoc(doc(dbAs('staffA'), 'vendorAuditLogs/ANY')));
});

// 7. Activation token access restricted
test('7 activation token restricted', async () => {
  await assertFails(getDoc(doc(dbAs('staffA'), 'activationTokens/T1')));
  await assertFails(setDoc(doc(dbAs('staffA'), 'activationTokens/T2'), { vendorId: 'V_A' }));
  await assertSucceeds(getDoc(doc(dbAs('ownerA'), 'activationTokens/T1')));
  await assertSucceeds(setDoc(doc(dbAs('ownerA'), 'activationTokens/T2'), { vendorId: 'V_A' }));
});

// 8. Payments require amount > 0
test('8 payment amount > 0', async () => {
  await assertFails(setDoc(doc(dbAs('staffA'), 'vendorPayments/P0'), { vendorId: 'V_A', amount: 0 }));
  await assertSucceeds(setDoc(doc(dbAs('staffA'), 'vendorPayments/P1'), { vendorId: 'V_A', amount: 10 }));
  await assertFails(updateDoc(doc(dbAs('staffA'), 'vendorPayments/P1'), { amount: 5 })); // not admin
});

// 9. Invoices require non-negative totals
test('9 invoice non-negative totals', async () => {
  await assertFails(setDoc(doc(dbAs('staffA'), 'vendorInvoices/I0'), { vendorId: 'V_A', total: -5, subtotal: -5 }));
  await assertSucceeds(setDoc(doc(dbAs('staffA'), 'vendorInvoices/I1'), { vendorId: 'V_A', total: 0, subtotal: 0 }));
});

// 10. Default deny blocks unknown paths
test('10 default deny', async () => {
  await assertFails(getDoc(doc(dbAs('ownerA'), 'someUnknownCollection/X')));
  await assertFails(setDoc(doc(dbAs('ownerA'), 'someUnknownCollection/X'), { foo: 1 }));
});
```

Run:

```bash
firebase emulators:exec --only firestore "npx jest firestore.rules.test.ts"
```

Or point `rules-unit-testing` at the emulator with `FIREBASE_EMULATOR_HOST`.

---

## 5. Expected Results vs Rule Mapping

| # | Pass condition | Rule(s) exercised |
|---|---|---|
| 1 | ownerA create `vendors/V_NEW` | L98–100 (ownerUid == uid) |
| 2 | ownerA read/update `vendors/V_A` | L102 (read), L104 (update owner) |
| 3 | ownerB/stranger read `vendors/V_A` | L102 → `isVendorOwner`/`isVendorStaffMember` both false |
| 4 | staffA read branch/warehouse/product | L148, L157, nested L112 (member + mirror present) |
| 5 | staffA cross-vendor | L148/`isVendorMember(resource.data.vendorId)` false for V_B |
| 6 | audit create/update/delete | L237–244 (create allowed, update/delete `if false`) |
| 7 | token staff denied / owner allowed | L195–203 (read owner/admin only) |
| 8 | payment amount 0 denied / 10 allowed | L228–233 (`amount > 0`) |
| 9 | invoice total -5 denied / 0 allowed | L218–225 (`total/subtotal >= 0`) |
| 10 | unknown collection denied | L302–305 (default deny) |

---

## 6. Review Notes / Cautions for the Reviewer

- **Mirror dependency:** scenarios 4, 5, 6, 7, 8, 9 require the `businessUsers` mirror to be
  seeded. If the app never writes it, those "member" paths will **fail** in production until the
  mirror is added (Step 2 recommendation). The emulator test seeds it as Admin to isolate rule logic.
- **Dev-only token/code writes:** scenarios 7 owner-writes pass only because the draft permits
  owner/admin writes. Production must move issuance to Admin SDK and tighten to `if false`.
- **`plans` is public read** (L272 `if true`) — intended (catalogue). Confirm this is acceptable.
- **`activationCodes` is unused** in app code; its rules mirror `activationTokens`.
- **Two audit collections** (`vendorAuditLogs`, `auditLogs`) behave identically; reconcile later.
- **`get()` quota:** role chains use a few `get()` calls per evaluation, within Firestore limits.

No runtime code was modified. Rules were not deployed.
