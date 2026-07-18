import { fingerprintSalesMigrationRecord, fingerprintSalesMigrationSource, salesMigrationDestinationId, salesMigrationReceiptId } from './fingerprint';
import type { CanonicalSalesMigrationAdapter } from './canonicalAdapter';
import { SalesMigrationReceiptConflict } from './durableReceiptStore';
import type { SalesMigrationReceiptStore } from './durableReceiptStore';
import type { SalesCutoverAssessment, SalesCutoverChecks, SalesMigrationApproval, SalesMigrationPreview, SalesMigrationQuarantineRecord, SalesMigrationReceipt, SalesMigrationReconciliation, SalesMigrationRecord, SalesMigrationResult, SalesMigrationRun, SalesMigrationTotals } from './types';
import { translateLegacySaleToCanonical } from './canonicalAdapter';

const number = (value: unknown) => Number(value);
const moneyMinor = (value: unknown) => Math.round(number(value) * 100);
const emptyTotals = (): SalesMigrationTotals => ({ saleCount: 0, grossMinor: 0, paidMinor: 0, creditMinor: 0, itemQuantity: 0 });
function totals(records: SalesMigrationRecord[]): SalesMigrationTotals { return records.reduce((sum, record) => { const p = record.payload; const total = moneyMinor(p.total || 0); const credit = String(p.paymentMethod || '').toUpperCase() === 'CREDIT' ? total : 0; return { saleCount: sum.saleCount + 1, grossMinor: sum.grossMinor + total, paidMinor: sum.paidMinor + total - credit, creditMinor: sum.creditMinor + credit, itemQuantity: sum.itemQuantity + (Array.isArray(p.items) ? p.items.reduce((q, row) => q + number((row as Record<string, unknown>).quantity || 0), 0) : 0) }; }, emptyTotals()); }
const quarantine = (run: string, record: SalesMigrationRecord, codes: SalesMigrationQuarantineRecord['codes'], reasons: string[]): SalesMigrationQuarantineRecord => ({ quarantineId: `quarantine_${run}_${record.legacyRecordId || 'unknown'}`.replace(/[^A-Za-z0-9_-]/g, '_'), migrationRunId: run, vendorId: record.vendorId, legacyRecordId: record.legacyRecordId, sourceFingerprint: record.sourceFingerprint, codes, reasons, status: 'quarantined', createdAt: new Date().toISOString() });

export async function createSalesMigrationDryRun(records: SalesMigrationRecord[], context: { migrationRunId: string; vendorId: string; branchId: string; previewVersion: string; existingFingerprints?: ReadonlySet<string> }): Promise<SalesMigrationPreview> {
  const copied = await Promise.all(records.map(async record => { const next = { ...record, payload: structuredClone(record.payload) }; return { ...next, sourceFingerprint: await fingerprintSalesMigrationRecord(next) }; }));
  const quarantined: SalesMigrationQuarantineRecord[] = []; const ready: SalesMigrationRecord[] = []; const identities = new Set<string>();
  for (const record of copied) {
    const codes: SalesMigrationQuarantineRecord['codes'] = []; const reasons: string[] = []; const payload = record.payload;
    if (record.mockData) { codes.push('MOCK_DATA'); reasons.push('Mock or fixture records are never eligible for migration.'); }
    if (!record.legacyRecordId) { codes.push('VALIDATION_FAILURE'); reasons.push('Legacy sale ID is required.'); }
    if (record.vendorId !== context.vendorId || record.branchId !== context.branchId) { codes.push('SCOPE_MISMATCH'); reasons.push('Vendor or branch scope does not match the selected migration.'); }
    if (String(payload.status || '').toUpperCase() !== 'COMPLETED') { codes.push('UNSUPPORTED_STATUS'); reasons.push('Only completed sales are supported.'); }
    if (!Array.isArray(payload.items) || !payload.items.length) { codes.push('VALIDATION_FAILURE'); reasons.push('At least one sale item is required.'); }
    else if (payload.items.some(row => { const item = row as Record<string, unknown>; return !String(item.productId || '').trim() || !Number.isFinite(number(item.quantity)) || number(item.quantity) <= 0 || !Number.isFinite(number(item.price)) || number(item.price) < 0; })) { codes.push('VALIDATION_FAILURE'); reasons.push('Sale items require product identity, positive quantity, and valid money.'); }
    const subtotal = number(payload.subtotal), discount = number(payload.discount || 0), tax = number(payload.tax || 0), total = number(payload.total);
    if (![subtotal, discount, tax, total].every(value => Number.isFinite(value) && value >= 0) || Math.round((subtotal - discount + tax) * 100) !== Math.round(total * 100)) { codes.push('VALIDATION_FAILURE'); reasons.push('Sale financial totals do not reconcile.'); }
    const identity = `${record.sourceKey}:${record.legacyRecordId}`;
    if (identities.has(identity)) { codes.push('DUPLICATE_SOURCE'); reasons.push('Duplicate legacy sale identity.'); } identities.add(identity);
    if (context.existingFingerprints?.has(record.sourceFingerprint!)) { codes.push('DUPLICATE_SOURCE'); reasons.push('Source fingerprint already has a completed migration receipt.'); }
    if (codes.length) quarantined.push(quarantine(context.migrationRunId, record, [...new Set(codes)], reasons)); else ready.push(record);
  }
  return { migrationRunId: context.migrationRunId, vendorId: context.vendorId, branchId: context.branchId, previewVersion: context.previewVersion,
    sourceFingerprint: await fingerprintSalesMigrationSource(copied), createdAt: new Date().toISOString(), records: copied, readyRecords: ready,
    quarantine: quarantined, totals: totals(ready), canApprove: ready.length > 0 && quarantined.length === 0, dryRun: true };
}

export function approveSalesMigration(preview: SalesMigrationPreview, approvedBy: string, migrationVersion: string, permitted: boolean): SalesMigrationApproval {
  if (!permitted || !preview.canApprove || !approvedBy) throw new Error('Sales migration approval denied.');
  return { migrationRunId: preview.migrationRunId, vendorId: preview.vendorId, approvedBy, approvedAt: new Date().toISOString(), approvedSourceFingerprint: preview.sourceFingerprint, approvedPreviewVersion: preview.previewVersion, migrationVersion };
}
export function assertSalesMigrationApproval(preview: SalesMigrationPreview, approval: SalesMigrationApproval) { if (approval.migrationRunId !== preview.migrationRunId || approval.vendorId !== preview.vendorId || approval.approvedSourceFingerprint !== preview.sourceFingerprint || approval.approvedPreviewVersion !== preview.previewVersion) throw new Error('Sales migration approval is stale or conflicting.'); }

export async function executeSalesMigration(input: { preview: SalesMigrationPreview; approval: SalesMigrationApproval; adapter: CanonicalSalesMigrationAdapter; receiptStore: SalesMigrationReceiptStore; actorId: string; actorRole: string; warehouseId: string; terminalId: string }): Promise<SalesMigrationResult[]> {
  assertSalesMigrationApproval(input.preview, input.approval); const results: SalesMigrationResult[] = [];
  for (const record of input.preview.readyRecords) {
    const receiptId = salesMigrationReceiptId(record.vendorId, record.legacyRecordId); const now = new Date().toISOString();
    const receipt: SalesMigrationReceipt = { receiptId, migrationRunId: input.preview.migrationRunId, vendorId: record.vendorId, branchId: record.branchId, legacyRecordId: record.legacyRecordId, sourceFingerprint: record.sourceFingerprint!, destinationSaleId: salesMigrationDestinationId(record.vendorId, record.legacyRecordId), status: 'processing', attemptCount: 1, leaseExpiresAt: new Date(Date.now() + 5 * 60_000).toISOString(), createdAt: now, updatedAt: now };
    try {
      const claim = await input.receiptStore.claim(receipt);
      if (claim.state === 'completed') { results.push({ legacyRecordId: record.legacyRecordId, sourceFingerprint: record.sourceFingerprint!, status: 'replayed', receiptId, result: claim.receipt.result, retryable: false }); continue; }
      if (claim.state === 'processing') { results.push({ legacyRecordId: record.legacyRecordId, sourceFingerprint: record.sourceFingerprint!, status: 'failed', receiptId, errorCode: 'TRANSIENT_FAILURE', message: 'Migration record is already processing.', retryable: true }); continue; }
      const command = translateLegacySaleToCanonical({ record, migrationRunId: input.preview.migrationRunId, migrationVersion: input.approval.migrationVersion, warehouseId: input.warehouseId, terminalId: input.terminalId, actorId: input.actorId, actorRole: input.actorRole });
      const canonical = await input.adapter.migrate(command); await input.receiptStore.complete(receiptId, record.vendorId, record.sourceFingerprint!, canonical);
      results.push({ legacyRecordId: record.legacyRecordId, sourceFingerprint: record.sourceFingerprint!, status: canonical.replayed ? 'replayed' : 'migrated', receiptId, result: canonical, retryable: false });
    } catch (error) {
      const conflict = error instanceof SalesMigrationReceiptConflict; const code = conflict ? 'FINGERPRINT_CONFLICT' : 'CANONICAL_FAILURE';
      await input.receiptStore.fail(receiptId, record.vendorId, record.sourceFingerprint!, code).catch(() => undefined);
      results.push({ legacyRecordId: record.legacyRecordId, sourceFingerprint: record.sourceFingerprint!, status: 'failed', receiptId, errorCode: code, message: error instanceof Error ? error.message : 'Migration failed.', retryable: !conflict });
    }
  } return results;
}

export function reconcileSalesMigration(migrationRunId: string, vendorId: string, source: SalesMigrationTotals, destination: SalesMigrationTotals): SalesMigrationReconciliation {
  const differences = Object.fromEntries(Object.keys(source).map(key => [key, destination[key as keyof SalesMigrationTotals] - source[key as keyof SalesMigrationTotals]])) as unknown as SalesMigrationTotals;
  return { migrationRunId, vendorId, status: Object.values(differences).every(value => value === 0) ? 'matched' : 'failed', source, destination, differences, completedAt: new Date().toISOString() };
}
export function assessSalesCutover(run: SalesMigrationRun, reconciliation: SalesMigrationReconciliation | undefined, checks: SalesCutoverChecks): SalesCutoverAssessment {
  const blockers: string[] = []; if (run.status !== 'completed' || run.failedRecordCount) blockers.push('MIGRATION_INCOMPLETE'); if (run.quarantineCount) blockers.push('QUARANTINE_NOT_EMPTY');
  if (!reconciliation || reconciliation.status !== 'matched' || !checks.reconciliationComplete) blockers.push('RECONCILIATION_INCOMPLETE');
  if (!checks.migrationReceiptsComplete) blockers.push('MIGRATION_RECEIPTS_INCOMPLETE'); if (!checks.canonicalAuthorityHealthy) blockers.push('CANONICAL_AUTHORITY_UNHEALTHY');
  if (!checks.legacyWritesDisabled) blockers.push('LEGACY_WRITES_ACTIVE'); if (!checks.mockDataIsolated) blockers.push('MOCK_DATA_NOT_ISOLATED');
  if (!checks.rulesPassed) blockers.push('RULES_NOT_PASSED'); if (!checks.testsPassed) blockers.push('TESTS_NOT_PASSED'); return { status: blockers.length ? 'notReady' : 'ready', blockers };
}
