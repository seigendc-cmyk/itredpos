import { describe, expect, test, vi } from 'vitest';
import { approvePurchasingMigration, assessPurchasingCutover, createPurchasingMigrationPreview, executePurchasingMigration, reconcilePurchasingMigration } from '../src/pos-new/services/purchasingMigration/service';
import { fingerprintMigrationRecord } from '../src/pos-new/services/purchasingMigration/fingerprint';
import type { PurchasingMigrationRecord, PurchasingMigrationRun } from '../src/pos-new/services/purchasingMigration/types';

const supplier = (overrides: Partial<PurchasingMigrationRecord> = {}): PurchasingMigrationRecord => ({ legacySourceType: 'browserStorage', legacyRecordId: 'supplier-1', vendorId: 'vendor-a', recordType: 'supplier', payload: { supplierName: 'Acme', amount: 10 }, ...overrides });
const context = { vendorId: 'vendor-a', migrationRunId: 'run-1', previewVersion: '1' };

describe('purchasing migration controls', () => {
  test('fingerprints are deterministic, vendor scoped, and change with source', async () => {
    expect(await fingerprintMigrationRecord(supplier())).toBe(await fingerprintMigrationRecord(supplier({ payload: { amount: 10, supplierName: 'Acme' } })));
    expect(await fingerprintMigrationRecord(supplier())).not.toBe(await fingerprintMigrationRecord(supplier({ vendorId: 'vendor-b' })));
    expect(await fingerprintMigrationRecord(supplier())).not.toBe(await fingerprintMigrationRecord(supplier({ payload: { supplierName: 'Acme', amount: 11 } })));
  });

  test('preview performs no writes and blocks invalid, duplicate, vendor and branch records', async () => {
    const preview = await createPurchasingMigrationPreview([supplier(), supplier(), supplier({ legacyRecordId: 'bad', vendorId: 'vendor-b', branchId: 'branch-b', payload: { amount: -1 } })], { ...context, branchId: 'branch-a' });
    expect(preview.canApprove).toBe(false);
    expect(preview.issues.map(row => row.code)).toEqual(expect.arrayContaining(['DUPLICATE_SOURCE', 'VENDOR_MISMATCH', 'BRANCH_MISMATCH', 'INVALID_MONEY']));
  });

  test('approval is explicit and changed source invalidates it', async () => {
    const preview = await createPurchasingMigrationPreview([supplier()], context);
    const approval = approvePurchasingMigration(preview, 'owner-2', [], '09.1C', true, 'owner-1', true);
    const changed = await createPurchasingMigrationPreview([supplier({ payload: { supplierName: 'Changed' } })], context);
    await expect(executePurchasingMigration(changed, approval, { migrate: vi.fn() }, 'owner-1')).rejects.toThrow('preview changed');
    expect(() => approvePurchasingMigration(preview, 'owner-1', [], '09.1C', true, 'owner-1', true)).toThrow('Separation');
  });

  test('resume and retry never duplicate a successful canonical write', async () => {
    const preview = await createPurchasingMigrationPreview([supplier()], context);
    const approval = approvePurchasingMigration(preview, 'owner', [], '09.1C', true);
    const migrate = vi.fn().mockResolvedValue(undefined);
    const first = await executePurchasingMigration(preview, approval, { migrate }, 'owner');
    await executePurchasingMigration(preview, approval, { migrate }, 'owner', first);
    expect(migrate).toHaveBeenCalledTimes(1);
    expect(first[0].destinationId).toBe('migration_supplier_supplier-1');
  });

  test('missing supplier and product references block dependent documents', async () => {
    const preview = await createPurchasingMigrationPreview([{ ...supplier(), recordType: 'grn', legacyRecordId: 'grn-1', payload: { supplierId: 'missing', lines: [{ productId: 'missing-product' }] } }], { ...context, supplierIds: new Set(), productIds: new Set() });
    expect(preview.issues.map(row => row.code)).toEqual(expect.arrayContaining(['MISSING_SUPPLIER', 'MISSING_PRODUCT']));
  });

  test('financial and inventory mismatches fail reconciliation and readiness', () => {
    const reconciliation = reconcilePurchasingMigration('run-1', 'vendor-a', { supplierPayments: 100, inventoryQuantity: 5 }, { supplierPayments: 99, inventoryQuantity: 4 });
    expect(reconciliation.status).toBe('failed');
    const run = { status: 'completed', failedRecordCount: 0 } as PurchasingMigrationRun;
    expect(assessPurchasingCutover(run, reconciliation, { supplierBalances: true, inventoryMovements: true, canonicalRepositories: true, legacyWritesDisabled: true, legacyFailClosed: true, rulesTests: true, authorityTests: true })).toBe('notReady');
  });
});
