import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { detectLegacyPurchasingRecords } from '../src/pos-new/services/legacyPurchasingDetection';
import { assertPostedDocumentTransition, PurchasingValidationError } from '../src/pos-new/repositories/purchasingAssertions';
import { recordSupplierAccountEntry } from '../src/pos-new/services/supplierAccountService';

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
});
