import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test, vi } from 'vitest';
import type { SciPosStaffSession, SciVendorOwnerSession } from '../src/sci-auth/StaffAuthService';
import { shouldRepostSalesOperationalEffects } from '../src/pos-new/repositories/firestore/FirestoreSalesTransactionRepository';
import { CanonicalSalesMigrationAdapter } from '../src/pos-new/services/salesMigration/canonicalAdapter';
import { MemorySalesMigrationReceiptStore } from '../src/pos-new/services/salesMigration/durableReceiptStore';
import { canApplySalesMigration, createSalesMigrationUiWorkflow, resolveSalesMigrationAdminContext } from '../src/pos-new/services/salesMigration/uiWorkflow';

const owner: SciVendorOwnerSession = {
  vendorId: 'vendor-a', ownerUid: 'owner-a', ownerName: 'Owner A', ownerEmail: 'owner@example.test',
  vendorName: 'Vendor A', role: 'Owner', signedInAt: '2026-07-18T10:00:00.000Z'
};
const staff = (overrides: Partial<SciPosStaffSession> = {}): SciPosStaffSession => ({
  vendorId: 'vendor-a', vendorName: 'Vendor A', branchId: 'branch-a', branchName: 'Branch A',
  warehouseId: 'warehouse-a', warehouseName: 'Warehouse A', terminalId: 'terminal-a', terminalName: 'Terminal A',
  staffId: 'owner-a', staffName: 'Owner A', role: 'Owner', permissions: ['*'],
  signedInAt: '2026-07-18T10:00:00.000Z', validatedAt: '2026-07-18T10:00:00.000Z', sessionVersion: 1, ...overrides
});
const sale = (overrides: Record<string, unknown> = {}) => ({
  id: 'legacy-sale-1', invoiceNo: 'INV-1', vendorId: 'vendor-a', branchId: 'branch-a',
  date: '2025-01-01T10:00:00.000Z', status: 'COMPLETED', subtotal: 10, discount: 0, tax: 1,
  total: 11, paymentMethod: 'CARD', items: [{ productId: 'product-a', code: 'SKU-A', name: 'Product A', quantity: 2, price: 5, unitCost: 3 }],
  ...overrides
});
const canonical = { saleId: 'canonical-sale', canonicalSaleId: 'canonical-sale', saleLineIds: ['line'], paymentIds: [], inventoryMovements: [], mutationReceiptId: 'mutation' };

function setup(initialRows: unknown[] = [sale()]) {
  let rows = initialRows;
  const storage = { getItem: vi.fn((key: string) => key === 'itred_pos_transactions_vendor-a' ? JSON.stringify(rows) : null) };
  const authority = { migrateCompletedSale: vi.fn().mockResolvedValue(canonical) };
  const receiptStore = new MemorySalesMigrationReceiptStore();
  const workflow = createSalesMigrationUiWorkflow({ storage, receiptStore, adapter: new CanonicalSalesMigrationAdapter(authority), mockDataEnabled: false, runId: () => 'ui-run-1' });
  return { workflow, authority, receiptStore, setRows: (next: unknown[]) => { rows = next; } };
}

describe('Build 09.2C sales migration UI wiring', () => {
  test('dry-run preview is read-only and reports all required counts', async () => {
    const { workflow, authority, receiptStore } = setup([sale(), sale({ id: 'legacy-sale-2', total: 99 })]);
    const bundle = await workflow.preview(resolveSalesMigrationAdminContext(owner, staff()));
    expect(bundle.preview.dryRun).toBe(true);
    expect(bundle.counts).toEqual({ candidate: 2, eligible: 1, conflict: 0, invalid: 1, quarantine: 1 });
    expect(authority.migrateCompletedSale).not.toHaveBeenCalled();
    expect(receiptStore.receipts.size).toBe(0);
  });

  test('apply remains disabled until a valid preview is explicitly approved and fingerprint-bound', async () => {
    const { workflow } = setup();
    const context = resolveSalesMigrationAdminContext(owner, staff());
    const { preview } = await workflow.preview(context);
    expect(canApplySalesMigration()).toBe(false);
    expect(canApplySalesMigration(preview)).toBe(false);
    const approval = workflow.approve(preview, context);
    expect(canApplySalesMigration(preview, approval, false)).toBe(false);
    expect(canApplySalesMigration(preview, approval, true)).toBe(true);
    expect(approval.approvedSourceFingerprint).toBe(preview.sourceFingerprint);
  });

  test('changed or stale sources cannot be applied', async () => {
    const { workflow, authority, setRows } = setup();
    const context = resolveSalesMigrationAdminContext(owner, staff());
    const { preview } = await workflow.preview(context);
    const approval = workflow.approve(preview, context);
    setRows([sale({ customerName: 'Changed after approval' })]);
    await expect(workflow.apply(context, preview, approval, true)).rejects.toThrow('source changed after preview');
    expect(authority.migrateCompletedSale).not.toHaveBeenCalled();
  });

  test('unauthorized and cross-vendor sessions cannot open or execute the workflow', async () => {
    expect(() => resolveSalesMigrationAdminContext(owner, staff({ role: 'Cashier', permissions: ['sales.complete'] }))).toThrow('restricted');
    expect(() => resolveSalesMigrationAdminContext(owner, staff({ vendorId: 'vendor-b' }))).toThrow('mapping');
    expect(() => resolveSalesMigrationAdminContext(owner, staff(), 'vendor-b')).toThrow('Cross-vendor');
    const { workflow, authority } = setup();
    const context = resolveSalesMigrationAdminContext(owner, staff());
    const { preview } = await workflow.preview(context);
    const approval = workflow.approve(preview, context);
    await expect(workflow.apply({ ...context, vendorId: 'vendor-b' }, preview, approval, true)).rejects.toThrow('Cross-vendor');
    expect(authority.migrateCompletedSale).not.toHaveBeenCalled();
  });

  test('source and service failures remain truthful and never load mock fallback data', async () => {
    const invalidSource = createSalesMigrationUiWorkflow({
      storage: { getItem: () => '{broken-json' }, receiptStore: new MemorySalesMigrationReceiptStore(),
      adapter: new CanonicalSalesMigrationAdapter({ migrateCompletedSale: vi.fn() }), mockDataEnabled: false, runId: () => 'bad-run'
    });
    await expect(invalidSource.preview(resolveSalesMigrationAdminContext(owner, staff()))).rejects.toThrow('could not be read or parsed');
    const { workflow, authority } = setup();
    authority.migrateCompletedSale.mockRejectedValueOnce(new Error('Canonical authority unavailable'));
    const context = resolveSalesMigrationAdminContext(owner, staff());
    const { preview } = await workflow.preview(context);
    const result = await workflow.apply(context, preview, workflow.approve(preview, context), true);
    expect(result.results[0]).toMatchObject({ status: 'failed', errorCode: 'CANONICAL_FAILURE', message: 'Canonical authority unavailable' });
    expect(result.reconciliation.status).toBe('failed');
  });

  test('successful apply reports progress, reconciliation, and durable migration receipt references', async () => {
    const { workflow } = setup();
    const context = resolveSalesMigrationAdminContext(owner, staff());
    const { preview } = await workflow.preview(context);
    const progress = vi.fn();
    const result = await workflow.apply(context, preview, workflow.approve(preview, context), true, progress);
    expect(progress).toHaveBeenLastCalledWith(1, 1);
    expect(result.reconciliation.status).toBe('matched');
    expect(result.receiptReferences).toEqual(['sales_migration_vendor-a_legacy-sale-1']);
  });

  test('historical migration suppresses operational reposting while cashier sales remain canonical', () => {
    expect(shouldRepostSalesOperationalEffects({ migration: { migrationRunId: 'run', sourceFingerprint: 'fp', legacyRecordId: 'legacy', migrationVersion: '09.2C' } })).toBe(false);
    expect(shouldRepostSalesOperationalEffects({})).toBe(true);
    const page = readFileSync(resolve('src/pos-new/pages/SalesMigrationCutoverPage.tsx'), 'utf8');
    expect(page).not.toMatch(/from ['"]firebase\/firestore['"]/);
    expect(page).not.toMatch(/\b(addDoc|setDoc|updateDoc|writeBatch|runTransaction)\s*\(/);
    const checkout = readFileSync(resolve('src/pos-new/services/salesCheckoutService.ts'), 'utf8');
    expect(checkout).toContain('canonicalSalesTransactionService.completeCheckout(input)');
    const app = readFileSync(resolve('src/App.tsx'), 'utf8');
    expect(app).toContain("currentPath === '/admin/sales-migration-cutover'");
    expect(app).toContain('<VendorAuthGate>');
  });
});
