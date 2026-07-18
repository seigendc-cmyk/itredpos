import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, writeBatch, setDoc, updateDoc } from 'firebase/firestore';

const PROJECT_ID = 'itred-pos-onboarding-rules';
let env: RulesTestEnvironment;

const vendorId = (uid: string) => `vendor-${uid}`;
const vendor = (uid: string, overrides: Record<string, unknown> = {}) => ({
  vendorId: vendorId(uid), ownerUid: uid, ownerEmail: `${uid}@example.test`, ownerName: 'Owner', businessName: 'Business',
  status: 'Active', planCode: 'DEMO', licenseStatus: 'Trial', activationStatus: 'PendingConsoleVerification',
  verificationStatus: 'Pending', accountStatus: 'Trial', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ...overrides
});
const vendorUser = (uid: string, overrides: Record<string, unknown> = {}) => ({
  uid, vendorId: vendorId(uid), email: `${uid}@example.test`, displayName: 'Owner', role: 'Owner', status: 'active',
  permissions: ['*'], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ...overrides
});
const dbFor = (uid: string) => env.authenticatedContext(uid, { email: `${uid}@example.test` }).firestore();

async function bootstrap(uid: string, vendorOverrides: Record<string, unknown> = {}, userOverrides: Record<string, unknown> = {}) {
  const db = dbFor(uid);
  const batch = writeBatch(db);
  batch.set(doc(db, 'vendors', vendorId(uid)), vendor(uid, vendorOverrides));
  batch.set(doc(db, 'vendorUsers', uid), vendorUser(uid, userOverrides));
  return batch.commit();
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync(resolve('firestore.vendor-rooted.rules'), 'utf8') }
  });
}, 30_000);

afterAll(async () => env.cleanup());

describe('secure vendor onboarding bootstrap rules', () => {
  test('signed-in user can detect a missing own vendorUser mapping', async () => {
    const snapshot = await assertSucceeds(getDoc(doc(dbFor('new-owner'), 'vendorUsers', 'new-owner')));
    expect(snapshot.exists()).toBe(false);
  });

  test('vendorUsers exact reads are self-only and collection listing remains denied', async () => {
    await assertSucceeds(bootstrap('mapping-owner'));
    await assertSucceeds(getDoc(doc(dbFor('mapping-owner'), 'vendorUsers', 'mapping-owner')));
    await assertFails(getDoc(doc(dbFor('other-owner'), 'vendorUsers', 'mapping-owner')));
    await assertFails(getDocs(collection(dbFor('mapping-owner'), 'vendorUsers')));
  });

  test('exact mapped vendor read is tenant-isolated and vendor listing remains denied', async () => {
    await assertSucceeds(bootstrap('exact-owner'));
    await assertSucceeds(getDoc(doc(dbFor('exact-owner'), 'vendors', vendorId('exact-owner'))));
    await assertFails(getDoc(doc(dbFor('other-tenant'), 'vendors', vendorId('exact-owner'))));
    await assertFails(getDocs(collection(dbFor('exact-owner'), 'vendors')));
  });

  test('signed-out user cannot onboard', async () => {
    const db = env.unauthenticatedContext().firestore();
    const batch = writeBatch(db);
    batch.set(doc(db, 'vendors', 'vendor-anonymous'), vendor('anonymous'));
    batch.set(doc(db, 'vendorUsers', 'anonymous'), vendorUser('anonymous'));
    await assertFails(batch.commit());
  });

  test('authenticated user atomically creates vendor and owner vendorUser', async () => {
    await assertSucceeds(bootstrap('bootstrap-owner'));
    const db = dbFor('bootstrap-owner');
    expect((await getDoc(doc(db, 'vendors', vendorId('bootstrap-owner')))).data()?.ownerUid).toBe('bootstrap-owner');
    expect((await getDoc(doc(db, 'vendorUsers', 'bootstrap-owner'))).data()?.vendorId).toBe(vendorId('bootstrap-owner'));
  });

  test('vendor creation without vendorUser bootstrap fails', async () => {
    const uid = 'vendor-only';
    await assertFails(setDoc(doc(dbFor(uid), 'vendors', vendorId(uid)), vendor(uid)));
  });

  test('vendorUser creation without vendor document fails', async () => {
    const uid = 'user-only';
    await assertFails(setDoc(doc(dbFor(uid), 'vendorUsers', uid), vendorUser(uid)));
  });

  test.each([
    ['wrong status casing', { status: 'active' }],
    ['wrong planCode', { planCode: 'TRIAL' }],
    ['legacy DEMO lifecycle status', { licenseStatus: 'DEMO' }]
  ])('%s is rejected', async (_label, overrides) => {
    const uid = `invalid-${String(Object.keys(overrides)[0]).toLowerCase()}`;
    await assertFails(bootstrap(uid, overrides));
  });

  test('invalid vendor ID is rejected', async () => {
    const uid = 'invalid-id';
    const db = dbFor(uid);
    const batch = writeBatch(db);
    batch.set(doc(db, 'vendors', 'vendor.invalid'), { ...vendor(uid), vendorId: 'vendor.invalid' });
    batch.set(doc(db, 'vendorUsers', uid), { ...vendorUser(uid), vendorId: 'vendor.invalid' });
    await assertFails(batch.commit());
  });

  test('wrong authenticated owner UID and document ID are rejected', async () => {
    const uid = 'real-owner';
    await assertFails(bootstrap(uid, { ownerUid: 'stale-owner' }));
    const db = dbFor(uid);
    const batch = writeBatch(db);
    batch.set(doc(db, 'vendors', vendorId(uid)), vendor(uid));
    batch.set(doc(db, 'vendorUsers', 'stale-owner'), vendorUser(uid));
    await assertFails(batch.commit());
  });

  test('Phase 2 succeeds only after the owner bootstrap is visible', async () => {
    const uid = 'phase-two-owner';
    const id = vendorId(uid);
    const db = dbFor(uid);
    await assertFails(setDoc(doc(db, 'branches', `${id}_main_branch`), { branchId: `${id}_main_branch`, vendorId: id }));
    await assertSucceeds(bootstrap(uid));
    const phase2 = writeBatch(db);
    phase2.set(doc(db, 'branches', `${id}_main_branch`), { branchId: `${id}_main_branch`, vendorId: id });
    phase2.set(doc(db, 'warehouses', `${id}_main_warehouse`), { warehouseId: `${id}_main_warehouse`, branchId: `${id}_main_branch`, vendorId: id });
    phase2.set(doc(db, 'staff', `${id}_owner`), { staffId: `${id}_owner`, vendorId: id });
    phase2.set(doc(db, 'pos_terminals', `${id}_main_terminal`), { terminalId: `${id}_main_terminal`, vendorId: id });
    phase2.set(doc(db, 'vendorLicenses', id), {
      licenseId: id, vendorId: id, planCode: 'DEMO', licenseStatus: 'Trial',
      activationStatus: 'PendingConsoleVerification', licenseMode: 'demo'
    });
    phase2.set(doc(db, 'vendorPlans', id), {
      vendorId: id, planCode: 'DEMO', licenseStatus: 'Trial',
      activationStatus: 'PendingConsoleVerification', accountStatus: 'Trial'
    });
    phase2.set(doc(db, 'vendor_settings', id), { vendorId: id });
    await assertSucceeds(phase2.commit());
  });

  test('canonical runtime license reads are exact and tenant-isolated', async () => {
    const uid = 'runtime-license-owner';
    const id = vendorId(uid);
    const db = dbFor(uid);
    await assertSucceeds(bootstrap(uid));
    await assertSucceeds(setDoc(doc(db, 'vendorLicenses', id), {
      licenseId: id, vendorId: id, planCode: 'DEMO', licenseStatus: 'Trial',
      activationStatus: 'PendingConsoleVerification', licenseMode: 'demo'
    }));
    await assertSucceeds(setDoc(doc(db, 'vendorPlans', id), {
      vendorId: id, planCode: 'DEMO', licenseStatus: 'Trial',
      activationStatus: 'PendingConsoleVerification', accountStatus: 'Trial'
    }));
    await assertSucceeds(getDoc(doc(db, 'vendorLicenses', id)));
    await assertSucceeds(getDoc(doc(db, 'vendorPlans', id)));
    await assertFails(getDoc(doc(dbFor('another-tenant'), 'vendorLicenses', id)));
    await assertFails(getDoc(doc(dbFor('another-tenant'), 'vendorPlans', id)));
    await assertFails(getDocs(collection(db, 'vendorLicenses')));
    await assertFails(getDocs(collection(db, 'vendorPlans')));
  });

  test('a correct duplicate pair can be read without replacement', async () => {
    const uid = 'duplicate-owner';
    await assertSucceeds(bootstrap(uid));
    await assertSucceeds(getDoc(doc(dbFor(uid), 'vendors', vendorId(uid))));
    await assertSucceeds(getDoc(doc(dbFor(uid), 'vendorUsers', uid)));
  });

  test('tenant A cannot create or modify tenant B', async () => {
    await assertSucceeds(bootstrap('tenant-b-owner'));
    await assertFails(updateDoc(doc(dbFor('tenant-a-owner'), 'vendors', vendorId('tenant-b-owner')), { businessName: 'Hijacked' }));
    await assertFails(setDoc(doc(dbFor('tenant-a-owner'), 'vendorUsers', 'tenant-a-owner'), vendorUser('tenant-a-owner', { vendorId: vendorId('tenant-b-owner') })));
  });
});
