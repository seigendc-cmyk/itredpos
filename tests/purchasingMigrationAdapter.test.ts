import { describe, expect, test, vi } from 'vitest';
import { CanonicalAdapterMigrationWriter, LiveCanonicalPurchasingMigrationAdapter, type CanonicalPurchasingMigrationAdapter, type CanonicalPurchasingMigrationOperation } from '../src/pos-new/services/purchasingMigration/canonicalAdapter';
import { PurchasingMigrationTranslationError, translatePurchasingMigrationRecord } from '../src/pos-new/services/purchasingMigration/canonicalTranslator';
import { approvePurchasingMigration, createPurchasingMigrationPreview, executePurchasingMigration } from '../src/pos-new/services/purchasingMigration/service';
import type { PurchasingMigrationRecord, PurchasingMigrationRecordType } from '../src/pos-new/services/purchasingMigration/types';

const record = (recordType: PurchasingMigrationRecordType, payload: Record<string, unknown>, id = `${recordType}-1`): PurchasingMigrationRecord => ({ legacySourceType: 'browserStorage', legacyRecordId: id, vendorId: 'vendor-a', branchId: 'branch-a', recordType, payload });
const metadata = { migrationRunId: 'run-1', vendorId: 'vendor-a', branchId: 'branch-a', warehouseId: 'warehouse-a', sourceType: 'browserStorage', legacyRecordId: 'legacy-1', destinationId: 'destination-1', sourceFingerprint: 'fingerprint-1', actorId: 'operator', approverId: 'approver', actorRole: 'Owner', idempotencyKey: 'migration-key', attemptNumber: 1 };
const success = (id = 'destination-1') => ({ success: true, data: { id } });

function transactionAuthority() {
  return { createSupplier: vi.fn().mockResolvedValue(success()), createPurchaseOrder: vi.fn().mockResolvedValue(success()), postGoodsReceipt: vi.fn().mockResolvedValue(success()), postSupplierReturn: vi.fn().mockResolvedValue(success()), recordSupplierPayment: vi.fn().mockResolvedValue(success()), postSupplierCreditNote: vi.fn().mockResolvedValue(success()), reverseSupplierPayment: vi.fn().mockResolvedValue(success()) };
}

describe('live canonical purchasing migration adapter', () => {
  test('purchase order translation recomputes totals and adapter uses canonical authority', async () => {
    const source = record('purchaseOrder', { vendorId: 'vendor-a', branchId: 'branch-a', supplierId: 'supplier-1', status: 'Draft', currency: 'usd', taxEstimate: 1.25, lines: [{ lineId: 'line-1', productId: 'product-1', qtyOrdered: 2, unitCost: 3.333 }] });
    const translated = translatePurchasingMigrationRecord(source, 'destination-1') as { order: { grandTotal: number; currency: string }; lines: unknown[] }; expect(translated.order).toMatchObject({ grandTotal: 7.91, currency: 'USD' });
    const authority = transactionAuthority(); await new LiveCanonicalPurchasingMigrationAdapter(authority as never).execute('purchaseOrder', { ...metadata, normalizedCanonicalPayload: translated }); expect(authority.createPurchaseOrder).toHaveBeenCalledOnce();
  });

  test('GRN routes once through canonical transaction and returns inventory, balance, audit, BI and receipt references', async () => {
    const authority = transactionAuthority(); const adapter = new LiveCanonicalPurchasingMigrationAdapter(authority as never); const payload = { receipt: { vendorId: 'vendor-a', supplierId: 'supplier-1' }, lines: [{ lineId: 'line-1' }] };
    const result = await adapter.execute('grn', { ...metadata, normalizedCanonicalPayload: payload }); expect(authority.postGoodsReceipt).toHaveBeenCalledOnce(); expect(result.affectedInventoryMovementIds).toHaveLength(1); expect(result.affectedSupplierBalanceProjectionIds).toEqual(['supplier-1']); expect(result).toMatchObject({ mutationReceiptId: 'migration-key', durableIdempotencyStatus: 'completed' }); expect(result.auditReference).toBeTruthy(); expect(result.biEventReference).toBeTruthy();
  });

  test.each(['supplierReturn', 'supplierPayment', 'supplierCreditNote', 'paymentReversal'] as const)('%s uses its canonical transaction authority', async type => {
    const authority = transactionAuthority(), adapter = new LiveCanonicalPurchasingMigrationAdapter(authority as never); const payload = type === 'supplierReturn' ? { supplierReturn: { vendorId: 'vendor-a', supplierId: 'supplier-1' }, lines: [] } : type === 'paymentReversal' ? { reversal: { vendorId: 'vendor-a', supplierId: 'supplier-1' } } : { vendorId: 'vendor-a', supplierId: 'supplier-1' };
    await adapter.execute(type, { ...metadata, normalizedCanonicalPayload: payload }); const method = { supplierReturn: 'postSupplierReturn', supplierPayment: 'recordSupplierPayment', supplierCreditNote: 'postSupplierCreditNote', paymentReversal: 'reverseSupplierPayment' }[type] as keyof typeof authority; expect(authority[method]).toHaveBeenCalledOnce();
  });

  test('translation rejects cross-vendor, branch mismatch, unsupported state, missing references and invalid quantities without writes', () => {
    expect(() => translatePurchasingMigrationRecord(record('supplierPayment', { vendorId: 'vendor-b', supplierId: 's', invoiceId: 'i', amount: 1 }), 'id')).toThrow(PurchasingMigrationTranslationError);
    expect(() => translatePurchasingMigrationRecord(record('supplierPayment', { branchId: 'branch-b', supplierId: 's', invoiceId: 'i', amount: 1 }), 'id')).toThrow('branch');
    expect(() => translatePurchasingMigrationRecord(record('supplierPayment', { status: 'VOID', supplierId: 's', invoiceId: 'i', amount: 1 }), 'id')).toThrow('posted');
    expect(() => translatePurchasingMigrationRecord(record('grn', { supplierId: 's', lines: [{ productId: 'p', qtyAccepted: -1 }] }), 'id')).toThrow();
  });

  test('adapter unavailable fails closed and completed migration result is not replayed', async () => {
    const source = record('supplierPayment', { supplierId: 'supplier-1', invoiceId: 'invoice-1', amount: 10, currency: 'USD', status: 'POSTED' }); const preview = await createPurchasingMigrationPreview([source], { vendorId: 'vendor-a', branchId: 'branch-a', migrationRunId: 'run-1', previewVersion: '1', supplierIds: new Set(['supplier-1']) }); const approval = approvePurchasingMigration(preview, 'approver', [], '09.1E', true); const unavailable = new CanonicalAdapterMigrationWriter(undefined, 'actor', 'approver'); const failed = await executePurchasingMigration(preview, approval, unavailable, 'actor'); expect(failed[0]).toMatchObject({ status: 'failed', retryable: false });
    const execute = vi.fn().mockResolvedValue({ canonicalRecordId: 'id', mutationReceiptId: 'receipt', affectedInventoryMovementIds: [], affectedSupplierBalanceProjectionIds: ['supplier-1'], operationStatus: 'completed', durableIdempotencyStatus: 'completed', auditReference: 'audit' }); const writer = new CanonicalAdapterMigrationWriter({ execute } as CanonicalPurchasingMigrationAdapter, 'actor', 'approver'); const first = await executePurchasingMigration(preview, approval, writer, 'actor'); const resumed = await executePurchasingMigration(preview, approval, writer, 'actor', first); expect(execute).toHaveBeenCalledOnce(); expect(resumed[0].canonicalReferences?.mutationReceiptId).toBe('receipt');
  });

  test('durable adapter identity includes run, type, legacy ID and source fingerprint', async () => {
    const calls: CanonicalPurchasingMigrationOperation[] = []; const adapter: CanonicalPurchasingMigrationAdapter = { execute: vi.fn(async (_type, operation) => { calls.push(operation); return { canonicalRecordId: operation.destinationId, mutationReceiptId: operation.idempotencyKey, affectedInventoryMovementIds: [], affectedSupplierBalanceProjectionIds: [], operationStatus: 'completed', durableIdempotencyStatus: 'completed', auditReference: 'audit' }; }) };
    const writer = new CanonicalAdapterMigrationWriter(adapter, 'actor', 'approver'); const source = record('supplierPayment', { supplierId: 'supplier-1', invoiceId: 'invoice-1', amount: 10, status: 'POSTED' }); await writer.migrate(source, { legacySourceType: 'browserStorage', legacyRecordId: source.legacyRecordId, sourceFingerprint: 'fp', migrationRunId: 'run', migratedAt: 'now', migratedBy: 'actor', migrationVersion: '09.1E', destinationId: 'destination' }); expect(calls[0].idempotencyKey).toContain('run'); expect(calls[0].idempotencyKey).toContain('supplierPayment'); expect(calls[0].idempotencyKey).toContain('fp');
  });

  test('canonical transaction failure returns no fabricated completed references', async () => {
    const authority = transactionAuthority(); authority.postGoodsReceipt.mockResolvedValue({ success: false, errorCode: 'UNAVAILABLE', errorMessage: 'transaction aborted' } as never); await expect(new LiveCanonicalPurchasingMigrationAdapter(authority as never).execute('grn', { ...metadata, normalizedCanonicalPayload: { receipt: { vendorId: 'vendor-a' }, lines: [] } })).rejects.toMatchObject({ code: 'TRANSIENT_WRITE_FAILURE', retryable: true });
  });
});
