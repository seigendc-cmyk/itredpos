import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { getBytes, ref, uploadBytes } from 'firebase/storage';
import { afterAll, beforeAll, describe, test } from 'vitest';

const PROJECT_ID = 'gen-lang-client-0459000055';
const VENDOR_A = 'vendor-a';
const VENDOR_B = 'vendor-b';
const OWNER_A = 'owner-a';
const OWNER_B = 'owner-b';
const CASHIER_A = 'cashier-a';

let env: RulesTestEnvironment;

function storage(uid?: string) {
  const context = uid
    ? env.authenticatedContext(uid, { email: `${uid}@test.local` })
    : env.unauthenticatedContext();
  return context.storage();
}

function membership(uid: string, vendorId: string, role: string) {
  return {
    uid, vendorId, role, status: 'active', permissions: role === 'Owner' ? ['*'] : [],
    email: `${uid}@test.local`, displayName: uid,
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  };
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync(resolve('firestore.rules'), 'utf8') },
    storage: { rules: readFileSync(resolve('storage.rules'), 'utf8') },
  });

  await env.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();
    await Promise.all([
      setDoc(doc(adminDb, 'vendorUsers', OWNER_A), membership(OWNER_A, VENDOR_A, 'Owner')),
      setDoc(doc(adminDb, 'vendorUsers', OWNER_B), membership(OWNER_B, VENDOR_B, 'Owner')),
      setDoc(doc(adminDb, 'vendorUsers', CASHIER_A), membership(CASHIER_A, VENDOR_A, 'Cashier')),
    ]);
    await uploadBytes(
      ref(context.storage(), `vendors/${VENDOR_B}/products/product-b/existing.png`),
      new Uint8Array([1, 2, 3]),
      { contentType: 'image/png' },
    );
  });
});

afterAll(async () => {
  if (env) await env.cleanup();
});

describe('Storage tenant, type, and size controls', () => {
  test('14. authorized product image upload succeeds', async () => {
    await assertSucceeds(uploadBytes(
      ref(storage(OWNER_A), `vendors/${VENDOR_A}/products/product-a/image.png`),
      new Uint8Array([1, 2, 3]),
      { contentType: 'image/png' },
    ));
  });

  test('15a. invalid executable-like MIME type is denied', async () => {
    await assertFails(uploadBytes(
      ref(storage(OWNER_A), `vendors/${VENDOR_A}/products/product-a/script.js`),
      new TextEncoder().encode('alert(1)'),
      { contentType: 'application/javascript' },
    ));
  });

  test('15b. oversized product image is denied', async () => {
    await assertFails(uploadBytes(
      ref(storage(OWNER_A), `vendors/${VENDOR_A}/products/product-a/too-large.png`),
      new Uint8Array(5 * 1024 * 1024 + 1),
      { contentType: 'image/png' },
    ));
  });

  test('16a. cross-vendor Storage upload is denied', async () => {
    await assertFails(uploadBytes(
      ref(storage(OWNER_A), `vendors/${VENDOR_B}/products/product-b/foreign.png`),
      new Uint8Array([1, 2, 3]),
      { contentType: 'image/png' },
    ));
  });

  test('16b. cross-vendor Storage read is denied', async () => {
    await assertFails(getBytes(ref(storage(OWNER_A), `vendors/${VENDOR_B}/products/product-b/existing.png`)));
  });

  test('unauthenticated Storage access is denied', async () => {
    await assertFails(getBytes(ref(storage(), `vendors/${VENDOR_B}/products/product-b/existing.png`)));
  });

  test('ordinary cashier cannot replace a business logo', async () => {
    await assertFails(uploadBytes(
      ref(storage(CASHIER_A), `vendors/${VENDOR_A}/logos/logo.png`),
      new Uint8Array([1, 2, 3]),
      { contentType: 'image/png' },
    ));
  });

  test('owner can upload an approved business document', async () => {
    await assertSucceeds(uploadBytes(
      ref(storage(OWNER_A), `vendors/${VENDOR_A}/documents/registration.pdf`),
      new Uint8Array([1, 2, 3]),
      { contentType: 'application/pdf' },
    ));
  });
});
