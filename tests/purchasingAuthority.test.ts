import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { detectLegacyPurchasingRecords } from '../src/pos-new/services/legacyPurchasingDetection';
import { assertGRNCapacity, assertInventoryMovement, assertPostedDocumentTransition, assertSupplierBalanceProjection, estimateGRNTransactionDocuments, MAX_GRN_LINES, PurchasingValidationError } from '../src/pos-new/repositories/purchasingAssertions';
import { createPurchasingCorrelationId, createPurchasingIdempotencyKey, fingerprintPurchasingMutation } from '../src/pos-new/services/purchasingIdempotencyService';
import { recordSupplierAccountEntry } from '../src/pos-new/services/supplierAccountService';
import { readLegacyPurchasingSource } from '../src/pos-new/services/purchasingMigration/legacySource';

describe('purchasing authority consolidation', () => {
  test('posting forms do not call legacy posting functions', () => {
    const grn = readFileSync(resolve('src/pos-new/components/GoodsReceivingForm.tsx'), 'utf8');
    const returns = readFileSync(resolve('src/pos-new/components/SupplierReturnForm.tsx'), 'utf8');
    expect(grn).not.toMatch(/\bpostGRN\s*\(/);
    expect(returns).not.toMatch(/\bpostSupplierReturn\s*\(/);
    expect(grn).toContain('onPostRequest(note, lines)');
    expect(returns).toContain('onPostRequest(record, lines)');
  });

  test('legacy GRN and return adapters delegate to the canonical transaction service', () => {
    const grn = readFileSync(resolve('src/pos-new/services/goodsReceivingService.ts'), 'utf8');
    const returns = readFileSync(resolve('src/pos-new/services/supplierReturnService.ts'), 'utf8');
    expect(grn).toContain('getPurchasingTransactionService().postGoodsReceipt');
    expect(returns).toContain('getPurchasingTransactionService().postSupplierReturn');
    expect(grn).toContain('Canonical purchasing operation context is required');
    expect(returns).toContain('Canonical purchasing operation context is required');
  });

  test('payment UI does not expose the legacy mutation panel', () => {
    const creditors = readFileSync(resolve('src/pos-new/pages/PosCreditors.tsx'), 'utf8');
    expect(creditors).not.toContain('SupplierPaymentsPanel');
    expect(creditors).toContain('purchasing.supplierPayments');
  });

  test('legacy supplier-account service cannot update the authoritative balance', () => {
    expect(() => recordSupplierAccountEntry({ supplierId: 'supplier-1', entryType: 'PAYMENT', referenceType: 'PAYMENT', referenceId: 'payment-1', debit: 10 })).toThrow('Legacy supplier-account writes are disabled');
  });

  test('posted documents cannot transition back to Draft', () => {
    expect(() => assertPostedDocumentTransition('Posted', 'Draft', 'GRN')).toThrowError(PurchasingValidationError);
  });

  test('legacy records are detected without mutation', () => {
    const values = new Map([['itred_pos_goods_receiving_notes_v1', JSON.stringify([{ grnId: 'legacy-1' }])]]);
    const storage = { getItem: (key: string) => values.get(key) ?? null };
    const before = values.get('itred_pos_goods_receiving_notes_v1');
    const result = detectLegacyPurchasingRecords(storage);
    expect(result.find((row) => row.entityType === 'goodsReceivingNotes')).toMatchObject({ recordCount: 1, migrationRequired: true });
    expect(values.get('itred_pos_goods_receiving_notes_v1')).toBe(before);
  });

  test('migration source discovery is read-only and vendor scoped', () => {
    const source = JSON.stringify([{ supplierId: 'supplier-legacy', supplierName: 'Legacy Supplier' }]);
    const storage = { getItem: (key: string) => key === 'itred_pos_supplier_records_v1' ? source : null };
    const records = readLegacyPurchasingSource('vendor-a', 'branch-a', storage as Pick<Storage, 'getItem'>);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ vendorId: 'vendor-a', branchId: 'branch-a', recordType: 'supplier', legacyRecordId: 'supplier-legacy' });
    expect(storage.getItem('itred_pos_supplier_records_v1')).toBe(source);
  });

  test('purchasing identities and fingerprints are deterministic and ignore volatile timestamps', async () => {
    expect(createPurchasingIdempotencyKey('grn-post', 'vendor-a', 'grn-1')).toBe('purchasing:grn-post:vendor-a:grn-1');
    expect(createPurchasingCorrelationId('grn-post', 'grn-1')).toBe('purchasing-grn-post-grn-1');
    expect(createPurchasingIdempotencyKey('grn/post', 'vendor-a', 'grn?1')).not.toBe(createPurchasingIdempotencyKey('grn?post', 'vendor-a', 'grn/1'));
    expect(await fingerprintPurchasingMutation('GRN', { id: '1', amount: 10, createdAt: 'yesterday' })).toBe(await fingerprintPurchasingMutation('GRN', { amount: 10, id: '1', createdAt: 'today' }));
    expect(await fingerprintPurchasingMutation('GRN', { supplierId: ' supplier-a ', businessDate: '2026-07-17', retryCount: 1 })).toBe(await fingerprintPurchasingMutation('GRN', { supplierId: 'supplier-a', businessDate: '2026-07-17T00:00:00.000Z', retryCount: 9 }));
    expect(await fingerprintPurchasingMutation('GRN', { id: '1', amount: 11 })).not.toBe(await fingerprintPurchasingMutation('GRN', { id: '1', amount: 10 }));
  });

  test('capacity and arithmetic assertions protect atomic posting', () => {
    const lines = Array.from({ length: MAX_GRN_LINES + 1 }, (_, index) => ({ lineId: `line-${index}`, poLineId: `po-line-${index}` }));
    expect(() => assertGRNCapacity({ receipt: {}, lines } as never)).toThrow('at most');
    expect(() => assertGRNCapacity({ receipt: {}, lines: [{ lineId: '1', poLineId: 'po-1', productId: 'product-1', qtyAccepted: 1 }, { lineId: '2', poLineId: 'po-2', productId: 'product-1', qtyAccepted: 1 }] } as never)).toThrow('duplicate product');
    expect(estimateGRNTransactionDocuments({ receipt: {}, lines: lines.slice(0, MAX_GRN_LINES), createSupplierInvoice: true } as never)).toBeLessThanOrEqual(450);
    expect(() => assertInventoryMovement(5, 3, 8)).not.toThrow();
    expect(() => assertInventoryMovement(5, 3, 9)).toThrow('arithmetic');
    expect(() => assertSupplierBalanceProjection({ invoiceTotal: 100, paymentTotal: 30, reversalTotal: 5, creditNoteTotal: 10, returnCreditTotal: 5, outstandingBalance: 60 })).not.toThrow();
  });
});
