/**
 * Emulator-ready Firestore rules test for the vendor staff membership mirror.
 *
 *   vendors/{vendorId}/businessUsers/{uid}
 *
 * Run against the Firestore emulator with `@firebase/rules-unit-testing` + `vitest`
 * (see docs/firestore/FIRESTORE_RULES_EMULATOR_TEST_08072026.md).
 *
 * NOTE: these dev dependencies (@firebase/rules-unit-testing, vitest, firebase) are
 * NOT installed in this repo yet. The file is committed so it is ready to run once
 * the dev dependency is added — it does not affect `npm run build`.
 */

import {
  initializeAdminApp,
  initializeTestApp,
  assertSucceeds,
  assertFails,
  clearFirestoreData,
  apps
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection } from 'firebase/firestore';
import { afterAll, beforeAll, describe, test } from 'vitest';

const PROJECT_ID = 'itredpos-emulator';

// --- Fixed test identities (from the Step 5 spec) ---
const VENDOR_ID = 'vendor-test-001';
const OTHER_VENDOR_ID = 'vendor-other-001';
const OWNER_UID = 'owner-001';
const STAFF_UID = 'staff-001';
const OUTSIDER_UID = 'outsider-001';

const adminApp = initializeAdminApp({ projectId: PROJECT_ID });
const adminDb = adminApp.firestore();

/** Returns a Firestore instance authenticated as `uid`. */
function authedDb(uid: string) {
  const app = initializeTestApp({
    projectId: PROJECT_ID,
    auth: { uid, email: `${uid}@test.com` }
  });
  return app.firestore();
}

/** Seed base docs + the uid-keyed membership mirror. Admin context bypasses rules. */
async function seed() {
  // Target vendor (owned by owner-001) + branch.
  await setDoc(doc(adminDb, 'vendors', VENDOR_ID), { vendorId: VENDOR_ID, ownerUid: OWNER_UID });
  await setDoc(doc(adminDb, 'vendorBranches', 'B1'), { vendorId: VENDOR_ID, branchName: 'Main' });

  // Owner mirror (role Owner, active).
  await setDoc(doc(adminDb, 'vendors', VENDOR_ID, 'businessUsers', OWNER_UID), {
    uid: OWNER_UID,
    vendorId: VENDOR_ID,
    role: 'Owner',
    status: 'active',
    source: 'owner-provisioning'
  });

  // Staff mirror (role Staff, active) — used by member scenarios.
  await setDoc(doc(adminDb, 'vendors', VENDOR_ID, 'businessUsers', STAFF_UID), {
    uid: STAFF_UID,
    vendorId: VENDOR_ID,
    role: 'Staff',
    status: 'active',
    source: 'staff-management'
  });

  // Another vendor owned by the outsider (used for cross-tenant isolation).
  await setDoc(doc(adminDb, 'vendors', OTHER_VENDOR_ID), { vendorId: OTHER_VENDOR_ID, ownerUid: OUTSIDER_UID });
  await setDoc(doc(adminDb, 'vendorBranches', 'OTHER-B1'), { vendorId: OTHER_VENDOR_ID, branchName: 'Other' });
}

beforeAll(async () => {
  await seed();
});

afterAll(async () => {
  await clearFirestoreData({ projectId: PROJECT_ID });
  await Promise.all(apps().map((app) => app.delete()));
});

describe('Vendor staff mirror — vendors/{vendorId}/businessUsers/{uid}', () => {
  // 1. Owner can create vendor document.
  test('1. owner can create the vendor document', async () => {
    await assertSucceeds(
      setDoc(doc(authedDb(OWNER_UID), 'vendors', 'vendor-new-001'), {
        vendorId: 'vendor-new-001',
        ownerUid: OWNER_UID
      })
    );
  });

  // 2. Owner can create own mirror at vendors/{vendorId}/businessUsers/{ownerUid}.
  test('2. owner can create own membership mirror', async () => {
    await assertSucceeds(
      setDoc(doc(authedDb(OWNER_UID), 'vendors', VENDOR_ID, 'businessUsers', OWNER_UID), {
        uid: OWNER_UID,
        vendorId: VENDOR_ID,
        role: 'Owner',
        status: 'active',
        source: 'owner-provisioning'
      })
    );
  });

  // 3. Owner can read own mirror.
  test('3. owner can read own membership mirror', async () => {
    await assertSucceeds(getDoc(doc(authedDb(OWNER_UID), 'vendors', VENDOR_ID, 'businessUsers', OWNER_UID)));
  });

  // 4. Non-member cannot read vendor.
  test('4. non-member cannot read the vendor document', async () => {
    await assertFails(getDoc(doc(authedDb(OUTSIDER_UID), 'vendors', VENDOR_ID)));
  });

  // 5. Non-member cannot read mirror.
  test('5. non-member cannot read the owner membership mirror', async () => {
    await assertFails(getDoc(doc(authedDb(OUTSIDER_UID), 'vendors', VENDOR_ID, 'businessUsers', OWNER_UID)));
  });

  // 6. Staff member with active mirror can read a vendor branch document.
  test('6. staff with active mirror can read vendor branch', async () => {
    await setDoc(doc(adminDb, 'vendors', VENDOR_ID, 'businessUsers', STAFF_UID), {
      uid: STAFF_UID,
      vendorId: VENDOR_ID,
      role: 'Staff',
      status: 'active',
      source: 'staff-management'
    });
    await assertSucceeds(getDoc(doc(authedDb(STAFF_UID), 'vendorBranches', 'B1')));
  });

  // 7. Staff member with inactive mirror cannot read vendor branch document.
  //
  // EXPECTED-TO-FAIL vs the CURRENT DRAFT rules: `isVendorStaffMember` only checks
  // `exists(businessUsers/{uid}) && vendorId == vendorId` and does NOT check
  // `status`, so an inactive mirror still passes membership and the read SUCCEEDS.
  // This scenario documents the intended behaviour and flags the rules gap: the
  // mirror service writes `status`, but the rules must enforce `status == 'active'`
  // (e.g. add `get(...).status == 'active'` to `isVendorStaffMember`) before this
  // scenario will pass.
  test('7. staff with inactive mirror cannot read vendor branch (rules gap — see docs)', async () => {
    await setDoc(doc(adminDb, 'vendors', VENDOR_ID, 'businessUsers', STAFF_UID), {
      uid: STAFF_UID,
      vendorId: VENDOR_ID,
      role: 'Staff',
      status: 'inactive',
      source: 'staff-management'
    });
    await assertFails(getDoc(doc(authedDb(STAFF_UID), 'vendorBranches', 'B1')));
  });

  // 8. Vendor member cannot access another vendor's branch.
  test('8. vendor member cannot access another vendor branch', async () => {
    await setDoc(doc(adminDb, 'vendors', VENDOR_ID, 'businessUsers', STAFF_UID), {
      uid: STAFF_UID,
      vendorId: VENDOR_ID,
      role: 'Staff',
      status: 'active',
      source: 'staff-management'
    });
    await assertFails(getDoc(doc(authedDb(STAFF_UID), 'vendorBranches', 'OTHER-B1')));
  });

  // 9. Audit log can be created but not updated/deleted.
  test('9. audit log create allowed, update/delete denied', async () => {
    await setDoc(doc(adminDb, 'vendors', VENDOR_ID, 'businessUsers', STAFF_UID), {
      uid: STAFF_UID,
      vendorId: VENDOR_ID,
      role: 'Staff',
      status: 'active',
      source: 'staff-management'
    });
    const ref = doc(collection(authedDb(STAFF_UID), 'vendorAuditLogs'));
    await assertSucceeds(
      setDoc(ref, { vendorId: VENDOR_ID, eventType: 'Test', message: 'mirror-test' })
    );
    await assertFails(updateDoc(ref, { message: 'changed' }));
    await assertFails(deleteDoc(ref));
  });

  // 10. Default deny blocks unknown paths.
  test('10. default deny blocks unknown collection paths', async () => {
    await assertFails(getDoc(doc(authedDb(OWNER_UID), 'someUnknownCollection', 'X')));
    await assertFails(setDoc(doc(authedDb(OWNER_UID), 'someUnknownCollection', 'X'), { foo: 1 }));
  });
});
