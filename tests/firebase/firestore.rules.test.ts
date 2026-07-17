import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { assertSupplierReturn, PurchasingValidationError } from '../../src/pos-new/repositories/purchasingAssertions';
import type { PostSupplierReturnCommand } from '../../src/pos-new/repositories/PurchasingRepository';

const PROJECT_ID = 'itred-pos-purchasing-rules';
const VENDOR_A = 'vendor-a';
const VENDOR_B = 'vendor-b';
const MANAGER = 'manager-a';
const CASHIER = 'cashier-a';

let env: RulesTestEnvironment;

const dbFor = (uid: string) => env.authenticatedContext(uid, { email: `${uid}@example.test` }).firestore();

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: readFileSync(resolve('firestore.vendor-rooted.rules'), 'utf8')
    }
  });
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, 'vendors', VENDOR_A), { vendorId: VENDOR_A, ownerUid: 'owner-a', status: 'Active' }),
      setDoc(doc(db, 'vendors', VENDOR_B), { vendorId: VENDOR_B, ownerUid: 'owner-b', status: 'Active' }),
      setDoc(doc(db, 'vendorUsers', MANAGER), { uid: MANAGER, vendorId: VENDOR_A, role: 'Manager', status: 'active', permissions: ['purchaseOrders.approve'] }),
      setDoc(doc(db, 'vendorUsers', CASHIER), { uid: CASHIER, vendorId: VENDOR_A, role: 'Cashier', status: 'active', permissions: [] }),
      setDoc(doc(db, 'vendors', VENDOR_A, 'suppliers', 'supplier-a'), { supplierId: 'supplier-a', vendorId: VENDOR_A, supplierCode: 'SA', supplierName: 'Supplier A', status: 'ACTIVE' }),
      setDoc(doc(db, 'vendors', VENDOR_B, 'suppliers', 'supplier-b'), { supplierId: 'supplier-b', vendorId: VENDOR_B, supplierCode: 'SB', supplierName: 'Supplier B', status: 'ACTIVE' }),
      setDoc(doc(db, 'vendors', VENDOR_A, 'purchaseOrders', 'po-1'), { poId: 'po-1', poNumber: 'PO-1', vendorId: VENDOR_A, supplierId: 'supplier-a', branchId: 'branch-a', warehouseId: 'warehouse-a', status: 'Pending Approval' }),
      setDoc(doc(db, 'vendors', VENDOR_A, 'goodsReceivingNotes', 'grn-1'), { grnId: 'grn-1', vendorId: VENDOR_A, supplierId: 'supplier-a', branchId: 'branch-a', warehouseId: 'warehouse-a', receivingStatus: 'Posted', postingStatus: 'Posted' }),
      setDoc(doc(db, 'vendors', VENDOR_A, 'supplierPayments', 'payment-1'), { paymentId: 'payment-1', vendorId: VENDOR_A, supplierId: 'supplier-a', invoiceId: 'invoice-1', amount: 10, status: 'POSTED' })
    ]);
  });
});

afterAll(async () => env.cleanup());

describe('canonical purchasing security', () => {
  test('cross-vendor supplier access is denied', async () => {
    await assertFails(getDoc(doc(dbFor(MANAGER), 'vendors', VENDOR_B, 'suppliers', 'supplier-b')));
  });

  test('cashier cannot approve a purchase order', async () => {
    await assertFails(updateDoc(doc(dbFor(CASHIER), 'vendors', VENDOR_A, 'purchaseOrders', 'po-1'), { status: 'Approved' }));
  });

  test('authorized manager can approve a purchase order', async () => {
    await assertSucceeds(updateDoc(doc(dbFor(MANAGER), 'vendors', VENDOR_A, 'purchaseOrders', 'po-1'), { status: 'Approved' }));
  });

  test('posted GRN cannot be deleted', async () => {
    await assertFails(deleteDoc(doc(dbFor(MANAGER), 'vendors', VENDOR_A, 'goodsReceivingNotes', 'grn-1')));
  });

  test('supplier payment cannot be arbitrarily edited', async () => {
    await assertFails(updateDoc(doc(dbFor(MANAGER), 'vendors', VENDOR_A, 'supplierPayments', 'payment-1'), { amount: 999 }));
  });

  test('manager can create one immutable payment reversal referencing the original payment', async () => {
    const ref = doc(dbFor(MANAGER), 'vendors', VENDOR_A, 'supplierPaymentReversals', 'payment-1');
    await assertSucceeds(setDoc(ref, { reversalId: 'payment-1', vendorId: VENDOR_A, supplierId: 'supplier-a', originalPaymentId: 'payment-1', invoiceId: 'invoice-1', amount: 10, reason: 'Duplicate bank settlement', status: 'POSTED', correlationId: 'corr-1', idempotencyKey: 'reverse-1' }));
    await assertFails(updateDoc(ref, { reason: 'Changed reason' }));
  });

  test('cross-vendor supplier balance access is denied', async () => {
    await env.withSecurityRulesDisabled(async (context) => setDoc(doc(context.firestore(), 'vendors', VENDOR_B, 'supplierBalances', 'supplier-b'), { vendorId: VENDOR_B, supplierId: 'supplier-b', version: 1 }));
    await assertFails(getDoc(doc(dbFor(MANAGER), 'vendors', VENDOR_B, 'supplierBalances', 'supplier-b')));
  });

  test('supplier balance projection is versioned and immutable by identity', async () => {
    const ref = doc(dbFor(MANAGER), 'vendors', VENDOR_A, 'supplierBalances', 'supplier-a');
    await assertSucceeds(setDoc(ref, { vendorId: VENDOR_A, supplierId: 'supplier-a', version: 1, outstandingBalance: 10 }));
    await assertFails(updateDoc(ref, { vendorId: VENDOR_B, version: 2 }));
  });

  test('supplier vendor identity cannot change', async () => {
    await assertFails(updateDoc(doc(dbFor(MANAGER), 'vendors', VENDOR_A, 'suppliers', 'supplier-a'), { vendorId: VENDOR_B }));
  });

  test('unauthenticated purchasing access is denied', async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'vendors', VENDOR_A, 'suppliers', 'supplier-a')));
  });
});

test('repository assertion rejects cumulative returns above received quantity', () => {
  const command = {
    supplierReturn: {
      supplierReturnId: 'return-1', vendorId: VENDOR_A, grnId: 'grn-1', supplierId: 'supplier-a'
    },
    lines: [{
      lineId: 'line-1', supplierReturnId: 'return-1', productId: 'product-1', qtyAlreadyReturned: 4,
      qtyReturnApproved: 3, qtyAcceptedIntoStock: 5
    }]
  } as unknown as PostSupplierReturnCommand;
  expect(() => assertSupplierReturn(command, VENDOR_A)).toThrowError(PurchasingValidationError);
  expect(() => assertSupplierReturn(command, VENDOR_A)).toThrow('Cumulative supplier return quantity cannot exceed');
});
