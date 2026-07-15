import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, describe, test } from 'vitest';

const PROJECT_ID = 'gen-lang-client-0459000055';
const VENDOR_A = 'vendor-a';
const VENDOR_B = 'vendor-b';
const OWNER_A = 'owner-a';
const OWNER_B = 'owner-b';
const CASHIER_A = 'cashier-a';
const SYSADMIN_A = 'sysadmin-a';

let env: RulesTestEnvironment;

function db(uid?: string) {
  return uid
    ? env.authenticatedContext(uid, { email: `${uid}@test.local` }).firestore()
    : env.unauthenticatedContext().firestore();
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync(resolve('firestore.rules'), 'utf8') },
  });

  await env.withSecurityRulesDisabled(async (context) => {
    const admin = context.firestore();
    await Promise.all([
      setDoc(doc(admin, 'vendors', VENDOR_A), {
        vendorId: VENDOR_A, ownerUid: OWNER_A, ownerEmail: `${OWNER_A}@test.local`,
        ownerName: 'Owner A', businessName: 'Vendor A', status: 'Active',
      }),
      setDoc(doc(admin, 'vendors', VENDOR_B), {
        vendorId: VENDOR_B, ownerUid: OWNER_B, ownerEmail: `${OWNER_B}@test.local`,
        ownerName: 'Owner B', businessName: 'Vendor B', status: 'Active',
      }),
      setDoc(doc(admin, 'vendorUsers', OWNER_A), membership(OWNER_A, VENDOR_A, 'Owner', ['*'])),
      setDoc(doc(admin, 'vendorUsers', OWNER_B), membership(OWNER_B, VENDOR_B, 'Owner', ['*'])),
      setDoc(doc(admin, 'vendorUsers', CASHIER_A), membership(CASHIER_A, VENDOR_A, 'Cashier', ['sales.create'])),
      setDoc(doc(admin, 'vendorUsers', SYSADMIN_A), membership(SYSADMIN_A, VENDOR_A, 'SysAdmin', ['*'])),
      setDoc(doc(admin, 'staff', CASHIER_A), { staffId: CASHIER_A, uid: CASHIER_A, vendorId: VENDOR_A, status: 'active' }),
      setDoc(doc(admin, 'staff', SYSADMIN_A), { staffId: SYSADMIN_A, uid: SYSADMIN_A, vendorId: VENDOR_A, status: 'active' }),
      setDoc(doc(admin, 'vendors', VENDOR_A, 'branches', 'main'), { vendorId: VENDOR_A, branchId: 'main' }),
      setDoc(doc(admin, 'vendors', VENDOR_B, 'branches', 'main'), { vendorId: VENDOR_B, branchId: 'main' }),
      setDoc(doc(admin, 'vendors', VENDOR_A, 'vendorAppAccess', 'pos'), {
        vendorId: VENDOR_A, appCode: 'pos', enabled: true, planCode: 'PRO', licenseStatus: 'ACTIVE',
      }),
      setDoc(doc(admin, 'vendors', VENDOR_A, 'productMaster', 'product-a'), {
        vendorId: VENDOR_A, productId: 'product-a', staffId: CASHIER_A, name: 'Product A',
      }),
      setDoc(doc(admin, 'vendors', VENDOR_B, 'productMaster', 'product-b'), {
        vendorId: VENDOR_B, productId: 'product-b', name: 'Product B',
      }),
      setDoc(doc(admin, 'vendors', VENDOR_B, 'customers', 'customer-b'), {
        vendorId: VENDOR_B, customerId: 'customer-b', name: 'Customer B',
      }),
      setDoc(doc(admin, 'vendors', VENDOR_B, 'productStockBalances', 'balance-b'), {
        vendorId: VENDOR_B, balanceId: 'balance-b', productId: 'product-b', quantityOnHand: 3,
      }),
      setDoc(doc(admin, 'vendors', VENDOR_A, 'salesReceipts', 'sale-a'), {
        vendorId: VENDOR_A, saleId: 'sale-a', branchId: 'main', terminalId: 't1', staffId: CASHIER_A,
        saleStatus: 'Completed', subtotal: 10, grandTotal: 10, amountPaid: 10, balanceDue: 0,
      }),
      setDoc(doc(admin, 'vendors', VENDOR_A, 'salesReceiptLines', 'line-a'), {
        vendorId: VENDOR_A, saleLineId: 'line-a', saleId: 'sale-a', branchId: 'main',
        productId: 'product-a', quantity: 1, lineTotal: 10,
      }),
      setDoc(doc(admin, 'vendors', VENDOR_A, 'inventoryMovements', 'movement-a'), {
        vendorId: VENDOR_A, movementId: 'movement-a', branchId: 'main', warehouseId: 'w1',
        productId: 'product-a', movementType: 'SALE', quantityIn: 0, quantityOut: 1,
        balanceBefore: 4, balanceAfter: 3, referenceType: 'SALE', referenceId: 'sale-a',
      }),
      setDoc(doc(admin, 'vendors', VENDOR_A, 'audit_logs', 'audit-a'), {
        vendorId: VENDOR_A, auditLogId: 'audit-a', eventType: 'SALE_COMPLETED',
        referenceId: 'sale-a', createdBy: CASHIER_A, createdAt: '2026-01-01T00:00:00Z',
      }),
    ]);
  });
});

afterAll(async () => {
  if (env) await env.cleanup();
});

function membership(uid: string, vendorId: string, role: string, permissions: string[]) {
  return {
    uid, vendorId, role, permissions, status: 'active', email: `${uid}@test.local`,
    displayName: uid, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  };
}

describe('Firestore tenant and operational controls', () => {
  test('1. unauthenticated vendor read is denied', async () => {
    await assertFails(getDoc(doc(db(), 'vendors', VENDOR_A)));
  });

  test('2. active vendor member can read own vendor data', async () => {
    await assertSucceeds(getDoc(doc(db(CASHIER_A), 'vendors', VENDOR_A, 'branches', 'main')));
  });

  test('3. member cannot read another vendor', async () => {
    await assertFails(getDoc(doc(db(CASHIER_A), 'vendors', VENDOR_B, 'branches', 'main')));
  });

  test('4. cashier cannot update vendor app access', async () => {
    await assertFails(updateDoc(doc(db(CASHIER_A), 'vendors', VENDOR_A, 'vendorAppAccess', 'pos'), { enabled: false }));
  });

  test('5a. owner can update vendor app access', async () => {
    await assertSucceeds(updateDoc(doc(db(OWNER_A), 'vendors', VENDOR_A, 'vendorAppAccess', 'pos'), { planCode: 'OWNER_TEST' }));
  });

  test('5b. SysAdmin can update vendor app access', async () => {
    await assertSucceeds(updateDoc(doc(db(SYSADMIN_A), 'vendors', VENDOR_A, 'vendorAppAccess', 'pos'), { planCode: 'PRO' }));
  });

  test('6. user cannot change a document vendorId', async () => {
    await assertFails(updateDoc(doc(db(CASHIER_A), 'vendors', VENDOR_A, 'productMaster', 'product-a'), { vendorId: VENDOR_B }));
  });

  test('6b. user cannot escalate their authoritative membership role', async () => {
    await assertFails(updateDoc(doc(db(CASHIER_A), 'vendorUsers', CASHIER_A), { role: 'Owner', permissions: ['*'] }));
  });

  test('7. posted sale cannot be deleted', async () => {
    await assertFails(deleteDoc(doc(db(OWNER_A), 'vendors', VENDOR_A, 'salesReceipts', 'sale-a')));
  });

  test('8. posted sale line cannot be arbitrarily changed', async () => {
    await assertFails(updateDoc(doc(db(OWNER_A), 'vendors', VENDOR_A, 'salesReceiptLines', 'line-a'), { quantity: 9 }));
  });

  test('9. inventory movement cannot be deleted', async () => {
    await assertFails(deleteDoc(doc(db(OWNER_A), 'vendors', VENDOR_A, 'inventoryMovements', 'movement-a')));
  });

  test('10. audit record cannot be deleted', async () => {
    await assertFails(deleteDoc(doc(db(OWNER_A), 'vendors', VENDOR_A, 'audit_logs', 'audit-a')));
  });

  test('11. cross-vendor customer access is denied', async () => {
    await assertFails(getDoc(doc(db(CASHIER_A), 'vendors', VENDOR_B, 'customers', 'customer-b')));
  });

  test('12. cross-vendor product access is denied', async () => {
    await assertFails(getDoc(doc(db(CASHIER_A), 'vendors', VENDOR_B, 'productMaster', 'product-b')));
  });

  test('13. cross-vendor inventory access is denied', async () => {
    await assertFails(getDoc(doc(db(CASHIER_A), 'vendors', VENDOR_B, 'productStockBalances', 'balance-b')));
  });
});
