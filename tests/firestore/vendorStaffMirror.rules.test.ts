/**
 * Focused Firestore rules test for the vendor membership mirror:
 *   vendors/{vendorId}/businessUsers/{uid}
 * Uses the @firebase/rules-unit-testing v3 API.
 * Run with `npm run test:rules`.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { beforeAll, afterAll, describe, test } from 'vitest';

const PROJECT_ID = 'itredpos-mirror';
const RULES_PATH = resolve('firestore.rules');
const VENDOR_A = 'vendor-a';
const OWNER_A = 'owner-a';
const STAFF_A = 'staff-a';

let testEnv: any;

function authedDb(uid: string) {
  return testEnv.authenticatedContext(uid, { email: `${uid}@test.com` }).firestore();
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync(RULES_PATH, 'utf8') }
  });
  await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
    const adminDb = ctx.firestore();
    await setDoc(doc(adminDb, 'vendors', VENDOR_A), { vendorId: VENDOR_A, ownerUid: OWNER_A });
    await setDoc(doc(adminDb, 'vendorUsers', OWNER_A), {
      uid: OWNER_A, vendorId: VENDOR_A, role: 'Owner', status: 'active', permissions: ['*'],
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z'
    });
    await setDoc(doc(adminDb, 'vendorUsers', STAFF_A), {
      uid: STAFF_A, vendorId: VENDOR_A, role: 'Staff', status: 'active', permissions: [],
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z'
    });
  });
});

afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});

describe('businessUsers membership mirror', () => {
  test('manager can create a member mirror', async () => {
    await assertSucceeds(setDoc(doc(authedDb(OWNER_A), 'vendors', VENDOR_A, 'businessUsers', STAFF_A), {
      uid: STAFF_A, vendorId: VENDOR_A, role: 'Staff', status: 'active', source: 'staff-management'
    }));
  });

  test('non-manager cannot create a member mirror', async () => {
    await assertFails(setDoc(doc(authedDb(STAFF_A), 'vendors', VENDOR_A, 'businessUsers', 'other-staff'), {
      uid: 'other-staff', vendorId: VENDOR_A, role: 'Staff', status: 'active'
    }));
  });

  test('member can read own mirror', async () => {
    await assertSucceeds(getDoc(doc(authedDb(STAFF_A), 'vendors', VENDOR_A, 'businessUsers', STAFF_A)));
  });

  test('member cannot read another user mirror', async () => {
    await assertFails(getDoc(doc(authedDb(STAFF_A), 'vendors', VENDOR_A, 'businessUsers', OWNER_A)));
  });

  test('owner can delete a member mirror', async () => {
    await assertSucceeds(deleteDoc(doc(authedDb(OWNER_A), 'vendors', VENDOR_A, 'businessUsers', STAFF_A)));
  });
});
