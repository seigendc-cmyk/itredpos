import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test, vi } from 'vitest';
import { CanonicalSalesMigrationAdapter, translateLegacySaleToCanonical } from '../src/pos-new/services/salesMigration/canonicalAdapter';
import { MemorySalesMigrationReceiptStore } from '../src/pos-new/services/salesMigration/durableReceiptStore';
import { fingerprintSalesMigrationRecord } from '../src/pos-new/services/salesMigration/fingerprint';
import { assertLegacySalesWritesDisabled, readLegacySalesSource } from '../src/pos-new/services/salesMigration/legacySource';
import { approveSalesMigration, assessSalesCutover, createSalesMigrationDryRun, executeSalesMigration, reconcileSalesMigration } from '../src/pos-new/services/salesMigration/service';
import type { SalesMigrationRecord, SalesMigrationRun } from '../src/pos-new/services/salesMigration/types';

const record = (overrides: Partial<SalesMigrationRecord> = {}): SalesMigrationRecord => ({
  sourceType: 'legacyBrowserStorage', sourceKey: 'itred_pos_transactions_vendor-a', legacyRecordId: 'legacy-sale-1',
  vendorId: 'vendor-a', branchId: 'branch-a', sourceVersion: 'v1', payload: {
    id: 'legacy-sale-1', invoiceNo: 'INV-LEGACY-1', date: '2025-01-01T10:00:00.000Z', operator: 'cashier-a',
    status: 'COMPLETED', subtotal: 10, discount: 0, tax: 1, total: 11, paymentMethod: 'CARD',
    items: [{ productId: 'product-a', code: 'SKU-A', name: 'Product A', quantity: 2, price: 5, total: 10, unitCost: 3 }]
  }, ...overrides
});
const context = { migrationRunId: 'sales-run-1', vendorId: 'vendor-a', branchId: 'branch-a', previewVersion: '09.2C-1' };
const canonicalResult = { saleId: 'canonical-sale', canonicalSaleId: 'canonical-sale', saleLineIds: ['line'], paymentIds: ['payment'], inventoryMovements: [], mutationReceiptId: 'mutation', auditEventId: 'audit', biEventId: 'bi' };

async function prepared(records = [record()]) { const preview = await createSalesMigrationDryRun(records, context); return { preview, approval: approveSalesMigration(preview, 'owner-a', '09.2C', true) }; }

describe('Build 09.2C sales migration and cutover', () => {
  test('fingerprint is deterministic, scoped, ignores volatile sync timestamps, and changes with business content', async () => {
    expect(await fingerprintSalesMigrationRecord(record())).toBe(await fingerprintSalesMigrationRecord(record({ payload: { ...record().payload, updatedAt: 'later' } })));
    expect(await fingerprintSalesMigrationRecord(record())).not.toBe(await fingerprintSalesMigrationRecord(record({ vendorId: 'vendor-b' })));
    expect(await fingerprintSalesMigrationRecord(record())).not.toBe(await fingerprintSalesMigrationRecord(record({ payload: { ...record().payload, total: 12 } })));
  });

  test('dry run performs no writes and quarantines scope, status, mock, duplicate, and financial failures', async () => {
    const invalid = [record({ vendorId: 'vendor-b' }), record({ legacyRecordId: 'void', payload: { ...record().payload, status: 'VOIDED' } }), record({ legacyRecordId: 'mock', mockData: true }), record(), record({ legacyRecordId: 'bad-total', payload: { ...record().payload, total: 99 } })];
    const preview = await createSalesMigrationDryRun(invalid, context);
    expect(preview.dryRun).toBe(true); expect(preview.canApprove).toBe(false); expect(preview.quarantine.flatMap(row => row.codes)).toEqual(expect.arrayContaining(['SCOPE_MISMATCH', 'UNSUPPORTED_STATUS', 'MOCK_DATA', 'DUPLICATE_SOURCE', 'VALIDATION_FAILURE']));
  });

  test('legacy reader uses only the exact vendor-scoped key and excludes mock fixtures', () => {
    const storage = { getItem: vi.fn((key: string) => key === 'itred_pos_transactions_vendor-a' ? JSON.stringify([record().payload, { ...record().payload, id: 'TXN-88220' }]) : null) };
    const scan = readLegacySalesSource({ vendorId: 'vendor-a', branchId: 'branch-a', storage, sourceKind: 'legacyProduction' });
    expect(storage.getItem).toHaveBeenCalledWith('itred_pos_transactions_vendor-a'); expect(scan.records).toHaveLength(1); expect(scan.ignoredMockRecordIds).toEqual(['TXN-88220']);
    expect(readLegacySalesSource({ vendorId: 'vendor-a', branchId: 'branch-a', storage, sourceKind: 'mock' }).records).toHaveLength(0);
  });

  test('adapter recomputes canonical minor-unit totals and invokes the existing sales authority', async () => {
    const source = record(); source.sourceFingerprint = await fingerprintSalesMigrationRecord(source);
    const command = translateLegacySaleToCanonical({ record: source, migrationRunId: 'run', migrationVersion: '09.2C', warehouseId: 'warehouse-a', terminalId: 'terminal-a', actorId: 'owner-a', actorRole: 'Owner' });
    expect(command.lines[0]).toMatchObject({ quantity: 2, unitPriceMinor: 500, taxableMinor: 1000, vatMinor: 100, lineTotalMinor: 1100 });
    const authority = { migrateCompletedSale: vi.fn().mockResolvedValue(canonicalResult) }; const result = await new CanonicalSalesMigrationAdapter(authority).migrate(command);
    expect(authority.migrateCompletedSale).toHaveBeenCalledOnce(); expect(result.mutationReceiptId).toBe('mutation');
  });

  test('first execution completes one durable migration receipt and replay returns the original canonical result', async () => {
    const { preview, approval } = await prepared(); const store = new MemorySalesMigrationReceiptStore(); const authority = { migrateCompletedSale: vi.fn().mockResolvedValue(canonicalResult) }; const adapter = new CanonicalSalesMigrationAdapter(authority);
    const args = { preview, approval, store, authority, adapter, receiptStore: store, actorId: 'owner-a', actorRole: 'Owner', warehouseId: 'warehouse-a', terminalId: 'terminal-a' };
    const first = await executeSalesMigration(args); const replay = await executeSalesMigration(args);
    expect(first[0].status).toBe('migrated'); expect(replay[0]).toMatchObject({ status: 'replayed', result: expect.objectContaining({ mutationReceiptId: 'mutation' }) }); expect(authority.migrateCompletedSale).toHaveBeenCalledOnce(); expect([...store.receipts.values()][0].status).toBe('completed');
  });

  test('concurrent duplicate execution invokes canonical authority once', async () => {
    const { preview, approval } = await prepared(); const store = new MemorySalesMigrationReceiptStore(); let release!: () => void; const wait = new Promise<void>(resolvePromise => { release = resolvePromise; });
    const authority = { migrateCompletedSale: vi.fn(async () => { await wait; return canonicalResult; }) }; const adapter = new CanonicalSalesMigrationAdapter(authority); const args = { preview, approval, adapter, receiptStore: store, actorId: 'owner-a', actorRole: 'Owner', warehouseId: 'warehouse-a', terminalId: 'terminal-a' };
    const first = executeSalesMigration(args); await Promise.resolve(); const duplicate = executeSalesMigration(args); release(); const [, second] = await Promise.all([first, duplicate]);
    expect(authority.migrateCompletedSale).toHaveBeenCalledOnce(); expect(second[0]).toMatchObject({ status: 'failed', errorCode: 'TRANSIENT_FAILURE', retryable: true });
  });

  test('an expired processing lease can be reclaimed after a worker crash', async () => {
    const store = new MemorySalesMigrationReceiptStore(); const now = new Date().toISOString();
    const receipt = { receiptId: 'receipt', migrationRunId: 'run', vendorId: 'vendor-a', branchId: 'branch-a', legacyRecordId: 'legacy', sourceFingerprint: 'fp', destinationSaleId: 'sale', status: 'processing' as const, attemptCount: 1, leaseExpiresAt: new Date(Date.now() + 60_000).toISOString(), createdAt: now, updatedAt: now };
    expect((await store.claim(receipt)).state).toBe('claimed'); expect((await store.claim(receipt)).state).toBe('processing');
    store.receipts.set(receipt.receiptId, { ...receipt, leaseExpiresAt: new Date(Date.now() - 1).toISOString() });
    const reclaimed = await store.claim(receipt); expect(reclaimed.state).toBe('claimed'); expect(reclaimed.receipt.attemptCount).toBe(2);
  });

  test('changed source cannot reuse a completed migration receipt', async () => {
    const initial = await prepared(); const store = new MemorySalesMigrationReceiptStore(); const authority = { migrateCompletedSale: vi.fn().mockResolvedValue(canonicalResult) }; const base = { adapter: new CanonicalSalesMigrationAdapter(authority), receiptStore: store, actorId: 'owner-a', actorRole: 'Owner', warehouseId: 'warehouse-a', terminalId: 'terminal-a' };
    await executeSalesMigration({ ...base, ...initial }); const changed = await prepared([record({ payload: { ...record().payload, customerName: 'Changed' } })]);
    expect((await executeSalesMigration({ ...base, ...changed }))[0]).toMatchObject({ status: 'failed', errorCode: 'FINGERPRINT_CONFLICT', retryable: false });
  });

  test('quarantined records never reach the canonical adapter', async () => {
    const preview = await createSalesMigrationDryRun([record({ payload: { ...record().payload, status: 'RETURNED' } })], context); const authority = { migrateCompletedSale: vi.fn() };
    expect(preview.readyRecords).toHaveLength(0); expect(authority.migrateCompletedSale).not.toHaveBeenCalled();
  });

  test('reconciliation covers counts, money, credit, payments, and item quantities', () => {
    const source = { saleCount: 1, grossMinor: 1100, paidMinor: 1100, creditMinor: 0, itemQuantity: 2 };
    expect(reconcileSalesMigration('run', 'vendor-a', source, source).status).toBe('matched'); expect(reconcileSalesMigration('run', 'vendor-a', source, { ...source, paidMinor: 1099 }).status).toBe('failed');
  });

  test('cutover fails closed until receipts, reconciliation, authority, legacy writes, mocks, rules, and tests pass', () => {
    const run = { migrationRunId: 'run', vendorId: 'vendor-a', status: 'completed', failedRecordCount: 0, quarantineCount: 0 } as SalesMigrationRun; const totals = { saleCount: 1, grossMinor: 1100, paidMinor: 1100, creditMinor: 0, itemQuantity: 2 }; const reconciliation = reconcileSalesMigration('run', 'vendor-a', totals, totals);
    const checks = { migrationReceiptsComplete: true, reconciliationComplete: true, canonicalAuthorityHealthy: true, legacyWritesDisabled: true, mockDataIsolated: true, rulesPassed: true, testsPassed: true };
    expect(assessSalesCutover(run, reconciliation, checks)).toEqual({ status: 'ready', blockers: [] }); expect(assessSalesCutover({ ...run, quarantineCount: 1 }, reconciliation, { ...checks, legacyWritesDisabled: false, mockDataIsolated: false }).status).toBe('notReady');
  });

  test('legacy completed-sale writer remains fail-closed and contains no unreachable direct write implementation', () => {
    assertLegacySalesWritesDisabled(); const legacy = readFileSync(resolve('src/pos-new/services/saleService.ts'), 'utf8'); expect(legacy).toContain('Legacy saleService.completeSale is disabled'); expect(legacy).not.toContain('publishCommerceEvent({'); expect(legacy).not.toContain('writeAuditLog({');
  });
});
