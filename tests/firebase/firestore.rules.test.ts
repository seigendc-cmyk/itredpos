import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, runTransaction, setDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { assertSupplierReturn, PurchasingValidationError } from '../../src/pos-new/repositories/purchasingAssertions';
import type { PostSupplierReturnCommand } from '../../src/pos-new/repositories/PurchasingRepository';

const PROJECT_ID = 'itred-pos-purchasing-rules';
const VENDOR_A = 'vendor-a';
const VENDOR_B = 'vendor-b';
const MANAGER = 'manager-a';
const CASHIER = 'cashier-a';
const OWNER = 'owner-a';

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
      setDoc(doc(db, 'vendorUsers', OWNER), { uid: OWNER, vendorId: VENDOR_A, role: 'Owner', status: 'active', permissions: ['settings.permissions.edit'] }),
      setDoc(doc(db, 'vendors', VENDOR_A, 'suppliers', 'supplier-a'), { supplierId: 'supplier-a', vendorId: VENDOR_A, supplierCode: 'SA', supplierName: 'Supplier A', status: 'ACTIVE' }),
      setDoc(doc(db, 'vendors', VENDOR_B, 'suppliers', 'supplier-b'), { supplierId: 'supplier-b', vendorId: VENDOR_B, supplierCode: 'SB', supplierName: 'Supplier B', status: 'ACTIVE' }),
      setDoc(doc(db, 'vendors', VENDOR_A, 'purchaseOrders', 'po-1'), { poId: 'po-1', poNumber: 'PO-1', vendorId: VENDOR_A, supplierId: 'supplier-a', branchId: 'branch-a', warehouseId: 'warehouse-a', status: 'Pending Approval' }),
      setDoc(doc(db, 'vendors', VENDOR_A, 'goodsReceivingNotes', 'grn-1'), { grnId: 'grn-1', vendorId: VENDOR_A, supplierId: 'supplier-a', branchId: 'branch-a', warehouseId: 'warehouse-a', receivingStatus: 'Posted', postingStatus: 'Posted' }),
      setDoc(doc(db, 'vendors', VENDOR_A, 'supplierPayments', 'payment-1'), { paymentId: 'payment-1', vendorId: VENDOR_A, supplierId: 'supplier-a', invoiceId: 'invoice-1', amount: 10, status: 'POSTED' })
    ]);
  });
}, 30_000);

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

  test('mutation receipts are vendor-scoped and immutable', async () => {
    const ref = doc(dbFor(MANAGER), 'vendors', VENDOR_A, 'mutationReceipts', 'purchasing:grn:vendor-a:grn-1');
    await assertSucceeds(setDoc(ref, { receiptDocumentId: 'purchasing:grn:vendor-a:grn-1', idempotencyKey: 'purchasing:grn:vendor-a:grn-1', operation: 'POST_GOODS_RECEIPT', entityType: 'GOODS_RECEIPT', entityId: 'grn-1', vendorId: VENDOR_A, correlationId: 'corr-grn-1', actorId: MANAGER, actorRole: 'Manager', requestFingerprint: 'fp-1', status: 'completed', resultPath: 'vendors/vendor-a/goodsReceivingNotes/grn-1' }));
    await assertFails(updateDoc(ref, { status: 'failed' }));
    await assertFails(getDoc(doc(dbFor(MANAGER), 'vendors', VENDOR_B, 'mutationReceipts', 'other')));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'vendors', VENDOR_A, 'mutationReceipts', 'purchasing:grn:vendor-a:grn-1')));
  });

  test('cashier cannot forge a completed mutation receipt', async () => {
    await assertFails(setDoc(doc(dbFor(CASHIER), 'vendors', VENDOR_A, 'mutationReceipts', 'forged'), { receiptDocumentId: 'forged', idempotencyKey: 'forged', operation: 'POST_GOODS_RECEIPT', entityId: 'grn-x', vendorId: VENDOR_A, correlationId: 'corr-x', requestFingerprint: 'fp-x', status: 'completed' }));
  });

  test('inventory movements require balanced immutable posting data', async () => {
    const valid = doc(dbFor(MANAGER), 'vendors', VENDOR_A, 'inventoryMovements', 'movement-valid');
    const movement = { movementId: 'movement-valid', vendorId: VENDOR_A, productId: 'product-1', branchId: 'branch-a', warehouseId: 'warehouse-a', movementType: 'GOODS_RECEIVED', quantityDelta: 3, openingBalance: 2, closingBalance: 5, sourceType: 'GRN', sourceId: 'grn-2', sourceLineId: 'grn-line-1', correlationId: 'corr-movement', idempotencyKey: 'idem-movement', postedBy: MANAGER, postedAt: Timestamp.now() };
    await assertSucceeds(setDoc(valid, movement));
    await assertFails(updateDoc(valid, { closingBalance: 6 }));
    await assertFails(setDoc(doc(dbFor(MANAGER), 'vendors', VENDOR_A, 'inventoryMovements', 'movement-invalid'), { ...movement, movementId: 'movement-invalid', closingBalance: 6 }));
  });

  test('supplier vendor identity cannot change', async () => {
    await assertFails(updateDoc(doc(dbFor(MANAGER), 'vendors', VENDOR_A, 'suppliers', 'supplier-a'), { vendorId: VENDOR_B }));
  });

  test('unauthenticated purchasing access is denied', async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'vendors', VENDOR_A, 'suppliers', 'supplier-a')));
  });
});

describe('purchasing migration security', () => {
  const runPath = ['vendors', VENDOR_A, 'purchasingMigrationRuns', 'migration-run-1'] as const;
  test('ordinary users cannot approve and cross-vendor migration access is denied', async () => {
    await assertFails(setDoc(doc(dbFor(MANAGER), ...runPath), { migrationRunId: 'migration-run-1', vendorId: VENDOR_A, status: 'approved', sourceFingerprint: 'fp-1', approvedBy: MANAGER }));
    await assertFails(getDoc(doc(dbFor(MANAGER), 'vendors', VENDOR_B, 'purchasingMigrationRuns', 'migration-run-b')));
  });

  test('completed migration history and source fingerprint are immutable', async () => {
    const ref = doc(dbFor(OWNER), ...runPath);
    await assertSucceeds(setDoc(ref, { migrationRunId: 'migration-run-1', vendorId: VENDOR_A, status: 'previewed', sourceFingerprint: 'fp-1' }));
    await assertFails(updateDoc(ref, { sourceFingerprint: 'fp-changed' }));
    await assertSucceeds(updateDoc(ref, { status: 'completed' }));
    await assertFails(updateDoc(ref, { status: 'failed' }));
    await assertFails(deleteDoc(ref));
  });

  test('migrated record results and completed reconciliations are immutable', async () => {
    await env.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      await setDoc(doc(db, ...runPath, 'records', 'record-1'), { vendorId: VENDOR_A, status: 'migrated', sourceFingerprint: 'record-fp' });
      await setDoc(doc(db, ...runPath, 'reconciliations', 'reconciliation-1'), { vendorId: VENDOR_A, completed: true, status: 'matched' });
    });
    await assertFails(updateDoc(doc(dbFor(OWNER), ...runPath, 'records', 'record-1'), { status: 'failed' }));
    await assertFails(updateDoc(doc(dbFor(OWNER), ...runPath, 'reconciliations', 'reconciliation-1'), { status: 'failed' }));
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

describe('purchasing transaction concurrency', () => {
  const receive = async (db: ReturnType<typeof dbFor>, lineId: string, quantity: number) => runTransaction(db, async (transaction) => {
    const ref = doc(db, 'vendors', VENDOR_A, 'purchaseOrderLines', lineId);
    const snapshot = await transaction.get(ref);
    const ordered = Number(snapshot.data()?.qtyOrdered || 0);
    const received = Number(snapshot.data()?.qtyReceived || 0);
    if (received + quantity > ordered) throw new Error('PURCHASING_OVER_RECEIPT');
    transaction.update(ref, { qtyReceived: received + quantity });
  });

  test('competing receipts cannot exceed the ordered quantity and corrected retry succeeds', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore(); const ref = doc(db, 'vendors', VENDOR_A, 'purchaseOrderLines', 'concurrent-over');
      await setDoc(ref, { vendorId: VENDOR_A, lineId: 'concurrent-over', poId: 'po-concurrent', qtyOrdered: 10, qtyReceived: 0 });
      const outcomes = await Promise.allSettled([receive(db, 'concurrent-over', 7), receive(db, 'concurrent-over', 6)]);
      expect(outcomes.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      const afterCompetition = Number((await getDoc(ref)).data()?.qtyReceived);
      expect(afterCompetition).toBeLessThanOrEqual(10);
      await receive(db, 'concurrent-over', 10 - afterCompetition);
      expect((await getDoc(ref)).data()?.qtyReceived).toBe(10);
    });
  });

  test('two valid partial concurrent receipts complete exactly at ordered quantity', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore(); const ref = doc(db, 'vendors', VENDOR_A, 'purchaseOrderLines', 'concurrent-valid');
      await setDoc(ref, { vendorId: VENDOR_A, lineId: 'concurrent-valid', poId: 'po-concurrent', qtyOrdered: 10, qtyReceived: 0 });
      const outcomes = await Promise.allSettled([receive(db, 'concurrent-valid', 5), receive(db, 'concurrent-valid', 5)]);
      expect(outcomes.every((result) => result.status === 'fulfilled')).toBe(true);
      expect((await getDoc(ref)).data()?.qtyReceived).toBe(10);
    });
  });

  test('a completed durable receipt prevents re-execution and conflicting reuse', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore(); const businessRef = doc(db, 'vendors', VENDOR_A, 'goodsReceivingNotes', 'idem-grn'); const receiptRef = doc(db, 'vendors', VENDOR_A, 'mutationReceipts', 'idem-key');
      const execute = (fingerprint: string) => runTransaction(db, async (transaction) => {
        const [business, receipt] = await Promise.all([transaction.get(businessRef), transaction.get(receiptRef)]);
        if (receipt.exists()) {
          if (receipt.data().requestFingerprint !== fingerprint) throw new Error('PURCHASING_IDEMPOTENCY_CONFLICT');
          return business.data();
        }
        transaction.set(businessRef, { vendorId: VENDOR_A, grnId: 'idem-grn', executions: 1 });
        transaction.set(receiptRef, { vendorId: VENDOR_A, idempotencyKey: 'idem-key', requestFingerprint: fingerprint, status: 'completed' });
        return { executions: 1 };
      });
      await Promise.all([execute('same-fingerprint'), execute('same-fingerprint')]);
      expect((await getDoc(businessRef)).data()?.executions).toBe(1);
      await expect(execute('different-fingerprint')).rejects.toThrow('PURCHASING_IDEMPOTENCY_CONFLICT');
    });
  });
});
