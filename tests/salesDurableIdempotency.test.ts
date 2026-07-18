import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const fakeFirestore = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  const rows = new Map<string, Row>();
  let queue: Promise<unknown> = Promise.resolve();
  let failNext: Error | null = null;
  const snapshot = (path: string) => ({
    exists: () => rows.has(path),
    data: () => rows.get(path)
  });
  return {
    rows,
    reset() { rows.clear(); queue = Promise.resolve(); failNext = null; },
    failOnce(error: Error) { failNext = error; },
    path(parts: unknown[]) { return parts.slice(1).map(String).join('/'); },
    snapshot,
    run<T>(operation: (transaction: { get(ref: string): Promise<ReturnType<typeof snapshot>>; set(ref: string, data: Row): void }) => Promise<T>): Promise<T> {
      const execute = async () => {
        if (failNext) { const error = failNext; failNext = null; throw error; }
        const writes = new Map<string, Row>();
        const result = await operation({
          get: async (ref) => snapshot(ref),
          set: (ref, data) => writes.set(ref, structuredClone(data))
        });
        writes.forEach((data, path) => rows.set(path, data));
        return result;
      };
      const result = queue.then(execute, execute);
      queue = result.then(() => undefined, () => undefined);
      return result;
    }
  };
});

vi.mock('firebase/firestore', () => ({
  doc: (...parts: unknown[]) => fakeFirestore.path(parts),
  runTransaction: (_db: unknown, operation: Parameters<typeof fakeFirestore.run>[0]) => fakeFirestore.run(operation),
  serverTimestamp: () => ({ __serverTimestamp: true })
}));

vi.mock('../src/pos-new/firebase/firebaseApp', () => ({ db: { kind: 'fake-firestore' }, firebaseReady: true }));

import { postCanonicalSaleAtomic, type AtomicSalePosting } from '../src/pos-new/repositories/firestore/FirestoreSalesTransactionRepository';
import { firestorePaths } from '../src/pos-new/firebase/firestorePaths';
import { canonicalizeSalesMutation, createSalesMutationReceiptId, fingerprintSalesMutation } from '../src/pos-new/services/salesIdempotencyService';
import {
  checkoutRequestStorageKey,
  clearCheckoutRequestId,
  getOrCreateCheckoutRequestId,
  saveCheckoutRequestId,
  type CheckoutRequestStorage
} from '../src/pos-new/services/salesCheckoutRequestIdentity';

const VENDOR = 'vendor-a';
const BRANCH = 'branch-a';
const WAREHOUSE = 'warehouse-a';
const PRODUCT = 'product-a';
const REQUEST = 'request-a';

function posting(overrides: Partial<AtomicSalePosting> = {}): AtomicSalePosting {
  const createdAt = '2026-07-18T08:00:00.000Z';
  const sale = {
    saleId: 'SALE-request-a', saleNumber: 'INV-SALE-request-a', vendorId: VENDOR, branchId: BRANCH,
    warehouseId: WAREHOUSE, terminalId: 'terminal-a', staffId: 'cashier-a', staffName: 'Cashier A',
    customerId: 'WALK-IN', customerName: 'Walk-In Customer', saleDate: createdAt, subtotal: 10,
    discountTotal: 0, taxableAmount: 10, vatTotal: 0, grandTotal: 10, amountPaid: 10,
    balanceDue: 0, paymentStatus: 'Paid' as const, saleStatus: 'Completed' as const,
    postingStatus: 'Completed' as const, source: 'POS' as const, receiptNumber: 'INV-SALE-request-a',
    createdAt, updatedAt: createdAt
  };
  const lines = [{
    saleLineId: 'SALE-request-a_1_product-a', saleId: sale.saleId, vendorId: VENDOR, branchId: BRANCH,
    warehouseId: WAREHOUSE, productId: PRODUCT, sku: 'SKU-A', productName: 'Product A', quantity: 2,
    unitPrice: 5, unitCost: 2, discountAmount: 0, taxableAmount: 10, vatRate: 0, vatAmount: 0,
    lineTotal: 10, isInventoryAsset: true
  }];
  const payments = [{
    paymentId: 'PAY-A', saleId: sale.saleId, vendorId: VENDOR, branchId: BRANCH, terminalId: 'terminal-a',
    staffId: 'cashier-a', paymentMethod: 'Cash' as const, amount: 10, receivedAt: createdAt, tendered: 10, change: 0
  }];
  return { sale, lines, payments, requestId: REQUEST, currency: 'USD', customerCreditAmount: 0, ...overrides };
}

function seedStock(quantity = 10): void {
  fakeFirestore.rows.set(`${firestorePaths.productMaster(VENDOR)}/${PRODUCT}`, { vendorId: VENDOR, productId: PRODUCT });
  fakeFirestore.rows.set(firestorePaths.productStockBalance(VENDOR, `${VENDOR}_${BRANCH}_${WAREHOUSE}_${PRODUCT}`), {
    vendorId: VENDOR, productId: PRODUCT, quantityOnHand: quantity, quantityReserved: 0
  });
}

function rowsUnder(path: string): Array<Record<string, unknown>> {
  return [...fakeFirestore.rows.entries()].filter(([key]) => key.startsWith(`${path}/`)).map(([, value]) => value);
}

function memoryStorage(): CheckoutRequestStorage {
  const values = new Map<string, string>();
  return { getItem: (key) => values.get(key) || null, setItem: (key, value) => { values.set(key, value); }, removeItem: (key) => { values.delete(key); } };
}

beforeEach(() => { fakeFirestore.reset(); seedStock(); });

describe('sales command identity and fingerprint', () => {
  test('stable receipt identity is command, vendor, branch and request scoped', () => {
    const base = createSalesMutationReceiptId('complete', VENDOR, BRANCH, REQUEST);
    expect(base).toBe(createSalesMutationReceiptId('complete', VENDOR, BRANCH, REQUEST));
    expect(new Set([base, createSalesMutationReceiptId('return', VENDOR, BRANCH, REQUEST), createSalesMutationReceiptId('complete', 'vendor-b', BRANCH, REQUEST), createSalesMutationReceiptId('complete', VENDOR, 'branch-b', REQUEST), createSalesMutationReceiptId('complete', VENDOR, BRANCH, 'request-b')]).size).toBe(5);
  });

  test('fingerprint is deterministic across property ordering', async () => {
    expect(await fingerprintSalesMutation('COMPLETE_SALE', { total: 10, customerId: 'c1' }))
      .toBe(await fingerprintSalesMutation('COMPLETE_SALE', { customerId: 'c1', total: 10 }));
  });

  test('fingerprint ignores volatile timestamps and generated receipt sequence', async () => {
    const first = { saleId: 'sale-1', total: 10, createdAt: '2026-01-01', saleDate: '2026-01-01', receivedAt: '2026-01-01', receiptNumber: 'RCT-0001' };
    const retry = { ...first, createdAt: '2026-01-02', saleDate: '2026-01-02', receivedAt: '2026-01-02', receiptNumber: 'RCT-9999' };
    expect(await fingerprintSalesMutation('COMPLETE_SALE', first)).toBe(await fingerprintSalesMutation('COMPLETE_SALE', retry));
  });

  test('fingerprint changes for meaningful business content', async () => {
    expect(await fingerprintSalesMutation('COMPLETE_SALE', { productId: 'p1', quantity: 1, total: 10 }))
      .not.toBe(await fingerprintSalesMutation('COMPLETE_SALE', { productId: 'p1', quantity: 2, total: 20 }));
    expect(canonicalizeSalesMutation('COMPLETE_SALE', { total: 10 })).not.toBe(canonicalizeSalesMutation('RETURN_SALE', { total: 10 }));
  });
});

describe('real canonical Firestore repository durable behavior', () => {
  test('first request atomically creates one canonical result and completed receipt', async () => {
    const result = await postCanonicalSaleAtomic(posting());
    expect(result.replayed).toBeUndefined();
    expect(rowsUnder(firestorePaths.salesReceipts(VENDOR))).toHaveLength(1);
    expect(rowsUnder(firestorePaths.mutationReceipts(VENDOR))).toHaveLength(1);
    expect(rowsUnder(firestorePaths.mutationReceipts(VENDOR))[0]).toMatchObject({ status: 'completed', requestId: REQUEST, attemptCount: 1, authorityVersion: 1 });
  });

  test('completed replay returns the original result without a second sale or stock deduction', async () => {
    const first = await postCanonicalSaleAtomic(posting());
    const replay = await postCanonicalSaleAtomic(posting({ sale: { ...posting().sale, createdAt: '2026-07-18T09:00:00.000Z', updatedAt: '2026-07-18T09:00:00.000Z', saleDate: '2026-07-18T09:00:00.000Z', receiptNumber: 'INV-RETRY' }, payments: posting().payments.map((payment) => ({ ...payment, receivedAt: '2026-07-18T09:00:00.000Z' })) }));
    expect(replay).toMatchObject({ ...first, replayed: true });
    expect(rowsUnder(firestorePaths.salesReceipts(VENDOR))).toHaveLength(1);
    expect(rowsUnder(firestorePaths.inventoryMovements(VENDOR))).toHaveLength(1);
    expect(rowsUnder(firestorePaths.productStockBalances(VENDOR))[0].quantityOnHand).toBe(8);
  });

  test('completed replay creates no additional payment, audit or BI event', async () => {
    await postCanonicalSaleAtomic(posting());
    await postCanonicalSaleAtomic(posting());
    expect(rowsUnder(firestorePaths.payments(VENDOR))).toHaveLength(1);
    expect(rowsUnder(firestorePaths.auditLogs(VENDOR))).toHaveLength(1);
    expect(rowsUnder(firestorePaths.biEvents(VENDOR))).toHaveLength(1);
  });

  test('credit replay creates one ledger entry and increments customer balance once', async () => {
    const input = posting({
      sale: { ...posting().sale, customerId: 'customer-a', customerName: 'Customer A', amountPaid: 0, balanceDue: 10, paymentStatus: 'Credit' },
      payments: [{ ...posting().payments[0], paymentMethod: 'Credit', amount: 0 }], customerCreditAmount: 10
    });
    fakeFirestore.rows.set(firestorePaths.customerBalance(VENDOR, 'customer-a'), { vendorId: VENDOR, customerId: 'customer-a', outstandingBalanceMinor: 500, version: 2 });
    await postCanonicalSaleAtomic(input); await postCanonicalSaleAtomic(input);
    expect(rowsUnder(firestorePaths.customerLedger(VENDOR))).toHaveLength(1);
    expect(fakeFirestore.rows.get(firestorePaths.customerBalance(VENDOR, 'customer-a'))).toMatchObject({ outstandingBalanceMinor: 1500, version: 3 });
  });

  test('same request with conflicting payload fails closed without extra effects', async () => {
    await postCanonicalSaleAtomic(posting());
    const conflict = posting({ lines: posting().lines.map((line) => ({ ...line, quantity: 3, lineTotal: 15 })) });
    await expect(postCanonicalSaleAtomic(conflict)).rejects.toMatchObject({ code: 'SALES_IDEMPOTENCY_CONFLICT' });
    expect(rowsUnder(firestorePaths.salesReceipts(VENDOR))).toHaveLength(1);
    expect(rowsUnder(firestorePaths.inventoryMovements(VENDOR))).toHaveLength(1);
  });

  test('an existing processing receipt prevents blind duplicate execution', async () => {
    await postCanonicalSaleAtomic(posting());
    const receipt = rowsUnder(firestorePaths.mutationReceipts(VENDOR))[0];
    receipt.status = 'processing';
    await expect(postCanonicalSaleAtomic(posting())).rejects.toMatchObject({ code: 'SALES_STATUS_CONFLICT' });
    expect(rowsUnder(firestorePaths.inventoryMovements(VENDOR))).toHaveLength(1);
  });

  test('two concurrent identical requests produce one result', async () => {
    const [left, right] = await Promise.all([postCanonicalSaleAtomic(posting()), postCanonicalSaleAtomic(posting())]);
    expect(left.mutationReceiptId).toBe(right.mutationReceiptId);
    expect(rowsUnder(firestorePaths.salesReceipts(VENDOR))).toHaveLength(1);
    expect(rowsUnder(firestorePaths.productStockBalances(VENDOR))[0].quantityOnHand).toBe(8);
  });

  test('concurrent conflicting requests cannot both succeed', async () => {
    const conflict = posting({ lines: posting().lines.map((line) => ({ ...line, quantity: 1, lineTotal: 5 })) });
    const outcomes = await Promise.allSettled([postCanonicalSaleAtomic(posting()), postCanonicalSaleAtomic(conflict)]);
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === 'rejected')).toHaveLength(1);
    expect(rowsUnder(firestorePaths.salesReceipts(VENDOR))).toHaveLength(1);
  });

  test('validation failure creates no completed receipt or business effects', async () => {
    await expect(postCanonicalSaleAtomic(posting({ lines: [...posting().lines, { ...posting().lines[0], saleLineId: 'duplicate-product' }] }))).rejects.toMatchObject({ code: 'SALES_VALIDATION_FAILED' });
    expect(rowsUnder(firestorePaths.mutationReceipts(VENDOR))).toHaveLength(0);
    expect(rowsUnder(firestorePaths.salesReceipts(VENDOR))).toHaveLength(0);
  });

  test('insufficient stock produces no partial sale, payment, movement or receipt', async () => {
    fakeFirestore.rows.set(firestorePaths.productStockBalance(VENDOR, `${VENDOR}_${BRANCH}_${WAREHOUSE}_${PRODUCT}`), { vendorId: VENDOR, productId: PRODUCT, quantityOnHand: 1, quantityReserved: 0 });
    await expect(postCanonicalSaleAtomic(posting())).rejects.toMatchObject({ code: 'SALES_STOCK_CONFLICT' });
    expect(rowsUnder(firestorePaths.salesReceipts(VENDOR))).toHaveLength(0);
    expect(rowsUnder(firestorePaths.payments(VENDOR))).toHaveLength(0);
    expect(rowsUnder(firestorePaths.inventoryMovements(VENDOR))).toHaveLength(0);
    expect(rowsUnder(firestorePaths.mutationReceipts(VENDOR))).toHaveLength(0);
  });

  test('retryable infrastructure interruption can safely complete once later', async () => {
    fakeFirestore.failOnce(new Error('transient unavailable'));
    await expect(postCanonicalSaleAtomic(posting())).rejects.toThrow('transient unavailable');
    expect(rowsUnder(firestorePaths.mutationReceipts(VENDOR))).toHaveLength(0);
    await postCanonicalSaleAtomic(posting());
    expect(rowsUnder(firestorePaths.salesReceipts(VENDOR))).toHaveLength(1);
    expect(rowsUnder(firestorePaths.mutationReceipts(VENDOR))).toHaveLength(1);
  });
});

describe('cashier request identity and authority wiring', () => {
  const scope = { vendorId: VENDOR, branchId: BRANCH, terminalId: 'terminal-a' };

  test('checkout double-click and retry reuse the stored request identity', () => {
    const storage = memoryStorage();
    expect(getOrCreateCheckoutRequestId(storage, scope)).toBe(getOrCreateCheckoutRequestId(storage, scope));
  });

  test('refresh-equivalent storage recreation retains a pending request identity', () => {
    const values = new Map<string, string>();
    const storage = (): CheckoutRequestStorage => ({ getItem: (key) => values.get(key) || null, setItem: (key, value) => { values.set(key, value); }, removeItem: (key) => { values.delete(key); } });
    const first = getOrCreateCheckoutRequestId(storage(), scope);
    expect(getOrCreateCheckoutRequestId(storage(), scope)).toBe(first);
  });

  test('clearing a completed sale causes a genuinely new sale identity', () => {
    const storage = memoryStorage(); const first = getOrCreateCheckoutRequestId(storage, scope);
    clearCheckoutRequestId(storage, scope);
    expect(getOrCreateCheckoutRequestId(storage, scope)).not.toBe(first);
  });

  test('held-sale completion can persist its stable held identity', () => {
    const storage = memoryStorage();
    expect(saveCheckoutRequestId(storage, scope, 'checkout-held-vendor-a-branch-a-held-1')).toBe('checkout-held-vendor-a-branch-a-held-1');
    expect(storage.getItem(checkoutRequestStorageKey(scope))).toBe('checkout-held-vendor-a-branch-a-held-1');
  });

  test('sales UI delegates once and does not perform a separate stock deduction or fabricate invoice identity', () => {
    const ui = readFileSync(resolve('src/pos-new/pages/PosSales.tsx'), 'utf8');
    const shell = readFileSync(resolve('src/pos-new/PosPrototypeApp.tsx'), 'utf8');
    expect(ui).toContain('completeSale({');
    expect(ui).toContain('onAddTransaction(result.sale)');
    expect(ui).not.toContain('onProductStockChange');
    expect(shell).not.toContain("const invoiceNo = 'INV-'");
  });

  test('legacy completion delegates or fails closed and only the canonical repository owns the transaction', () => {
    const adapter = readFileSync(resolve('src/pos-new/services/salesCheckoutService.ts'), 'utf8');
    const legacy = readFileSync(resolve('src/pos-new/services/saleService.ts'), 'utf8');
    const repository = readFileSync(resolve('src/pos-new/repositories/firestore/FirestoreSalesTransactionRepository.ts'), 'utf8');
    expect(adapter).toContain('canonicalSalesTransactionService.completeCheckout(input)');
    expect(legacy).toContain('Legacy saleService.completeSale is disabled');
    expect(repository).toContain('runTransaction(db');
  });
});
