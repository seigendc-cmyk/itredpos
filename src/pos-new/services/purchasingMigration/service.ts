import type { PurchasingMigrationApproval, PurchasingMigrationIssue, PurchasingMigrationPreview, PurchasingMigrationRecord, PurchasingMigrationRecordResult, PurchasingMigrationReconciliation, PurchasingMigrationReconciliationItem, PurchasingMigrationRun, PurchasingCutoverReadiness } from './types';
import { deterministicMigrationId, fingerprintMigrationRecord, fingerprintMigrationSource } from './fingerprint';

const order = ['supplier', 'purchaseOrder', 'grn', 'supplierReturn', 'supplierCreditNote', 'supplierPayment', 'paymentReversal', 'reconciliationProjection'];
const issue = (recordId: string, code: string, severity: 'error' | 'warning', message: string): PurchasingMigrationIssue => ({ issueId: `${code}:${recordId}`, recordId, code, severity, message });
const finiteNonNegative = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0;

export interface MigrationPreviewContext { vendorId: string; branchId?: string; migrationRunId: string; previewVersion: string; existingFingerprints?: ReadonlySet<string>; supplierIds?: ReadonlySet<string>; productIds?: ReadonlySet<string>; }
export async function createPurchasingMigrationPreview(input: PurchasingMigrationRecord[], context: MigrationPreviewContext): Promise<PurchasingMigrationPreview> {
  const records = await Promise.all(input.map(async source => ({ ...source, payload: JSON.parse(JSON.stringify(source.payload)), sourceFingerprint: await fingerprintMigrationRecord(source) })));
  const issues: PurchasingMigrationIssue[] = []; const seen = new Set<string>();
  for (const record of records) {
    const id = record.legacyRecordId;
    if (!id || !record.recordType) issues.push(issue(id || 'unknown', 'REQUIRED_FIELD', 'error', 'Record identifier and type are required.'));
    if (record.vendorId !== context.vendorId) issues.push(issue(id, 'VENDOR_MISMATCH', 'error', 'Source record belongs to another vendor.'));
    if (context.branchId && record.branchId && record.branchId !== context.branchId) issues.push(issue(id, 'BRANCH_MISMATCH', 'error', 'Source record belongs to another branch.'));
    if (seen.has(record.sourceFingerprint!)) issues.push(issue(id, 'DUPLICATE_SOURCE', 'error', 'Duplicate source record detected.')); else seen.add(record.sourceFingerprint!);
    if (context.existingFingerprints?.has(record.sourceFingerprint!)) issues.push(issue(id, 'ALREADY_MIGRATED', 'error', 'This exact source record was already migrated.'));
    const supplierId = record.payload.supplierId;
    if (record.recordType !== 'supplier' && typeof supplierId === 'string' && context.supplierIds && !context.supplierIds.has(supplierId) && !records.some(row => row.recordType === 'supplier' && row.legacyRecordId === supplierId)) issues.push(issue(id, 'MISSING_SUPPLIER', 'error', 'Referenced supplier is unresolved.'));
    const productIds = Array.isArray(record.payload.lines) ? record.payload.lines.map(line => (line as Record<string, unknown>).productId) : [record.payload.productId];
    if (['grn', 'supplierReturn'].includes(record.recordType) && context.productIds && productIds.some(productId => typeof productId !== 'string' || !context.productIds!.has(productId))) issues.push(issue(id, 'MISSING_PRODUCT', 'error', 'An inventory-affecting product is unresolved.'));
    for (const key of ['quantity', 'qty', 'qtyAccepted']) if (key in record.payload && !finiteNonNegative(record.payload[key])) issues.push(issue(id, 'INVALID_QUANTITY', 'error', `${key} must be finite and non-negative.`));
    for (const key of ['amount', 'total', 'grandTotal', 'unitCost']) if (key in record.payload && !finiteNonNegative(record.payload[key])) issues.push(issue(id, 'INVALID_MONEY', 'error', `${key} must be finite and non-negative.`));
    if (record.payload.status === 'UNKNOWN') issues.push(issue(id, 'UNSUPPORTED_STATUS', 'error', 'Legacy status is unsupported.'));
  }
  const totals = Object.fromEntries(order.map(type => { const rows = records.filter(row => row.recordType === type); return [type, { count: rows.length, monetaryValueMinor: rows.reduce((sum, row) => sum + Math.round(Number(row.payload.amount ?? row.payload.grandTotal ?? row.payload.total ?? 0) * 100), 0), quantity: rows.reduce((sum, row) => sum + Number(row.payload.quantity ?? row.payload.qty ?? row.payload.qtyAccepted ?? 0), 0) }]; }));
  return { migrationRunId: context.migrationRunId, vendorId: context.vendorId, branchId: context.branchId, previewVersion: context.previewVersion, sourceFingerprint: await fingerprintMigrationSource(records), createdAt: new Date().toISOString(), records, issues, sourceTotals: totals, expectedDestinationTotals: structuredClone(totals), canApprove: !issues.some(row => row.severity === 'error') };
}

export function approvePurchasingMigration(preview: PurchasingMigrationPreview, approvedBy: string, acknowledgedWarnings: string[], migrationVersion: string, canApprove: boolean, preparedBy?: string, separationRequired = false): PurchasingMigrationApproval {
  if (!canApprove || !preview.canApprove) throw new Error('Migration approval denied.');
  if (separationRequired && preparedBy === approvedBy) throw new Error('Separation of duties requires another approver.');
  const warningIds = preview.issues.filter(row => row.severity === 'warning').map(row => row.issueId);
  if (warningIds.some(id => !acknowledgedWarnings.includes(id))) throw new Error('Every migration warning must be explicitly acknowledged.');
  return { migrationRunId: preview.migrationRunId, vendorId: preview.vendorId, approvedBy, approvedAt: new Date().toISOString(), approvedSourceFingerprint: preview.sourceFingerprint, approvedPreviewVersion: preview.previewVersion, acknowledgedWarnings, migrationVersion };
}
export function assertApprovalCurrent(preview: PurchasingMigrationPreview, approval: PurchasingMigrationApproval): void { if (preview.sourceFingerprint !== approval.approvedSourceFingerprint || preview.previewVersion !== approval.approvedPreviewVersion || preview.vendorId !== approval.vendorId) throw new Error('Migration approval is invalid because the approved preview changed.'); }

export interface CanonicalMigrationWriter { migrate(record: PurchasingMigrationRecord, metadata: { legacySourceType: string; legacyRecordId: string; legacyParentId?: string; sourceFingerprint: string; migrationRunId: string; migratedAt: string; migratedBy: string; migrationVersion: string; destinationId: string }): Promise<void>; }
export async function executePurchasingMigration(preview: PurchasingMigrationPreview, approval: PurchasingMigrationApproval, writer: CanonicalMigrationWriter, migratedBy: string, previous: PurchasingMigrationRecordResult[] = [], batchSize = 50): Promise<PurchasingMigrationRecordResult[]> {
  assertApprovalCurrent(preview, approval); if (batchSize < 1 || batchSize > 200) throw new Error('Migration batch size must be between 1 and 200.');
  const results = [...previous]; const successful = new Set(previous.filter(row => row.status === 'migrated' || row.status === 'duplicate').map(row => row.sourceFingerprint));
  const sorted = [...preview.records].sort((a, b) => order.indexOf(a.recordType) - order.indexOf(b.recordType));
  for (const record of sorted.slice(0, batchSize)) {
    if (successful.has(record.sourceFingerprint!)) continue;
    if (record.legacyParentId && !sorted.some(parent => parent.legacyRecordId === record.legacyParentId) && !previous.some(parent => parent.destinationId === deterministicMigrationId('supplier', record.legacyParentId!))) { results.push({ recordId: record.legacyRecordId, recordType: record.recordType, status: 'invalid', sourceFingerprint: record.sourceFingerprint!, failureReason: 'Parent reference is unresolved.' }); continue; }
    const destinationId = deterministicMigrationId(record.recordType, record.legacyRecordId); const migratedAt = new Date().toISOString();
    try { await writer.migrate(record, { legacySourceType: record.legacySourceType, legacyRecordId: record.legacyRecordId, legacyParentId: record.legacyParentId, sourceFingerprint: record.sourceFingerprint!, migrationRunId: preview.migrationRunId, migratedAt, migratedBy, migrationVersion: approval.migrationVersion, destinationId }); results.push({ recordId: record.legacyRecordId, recordType: record.recordType, status: 'migrated', sourceFingerprint: record.sourceFingerprint!, destinationId, migratedAt }); }
    catch (error) { results.push({ recordId: record.legacyRecordId, recordType: record.recordType, status: 'failed', sourceFingerprint: record.sourceFingerprint!, failureReason: error instanceof Error ? error.message : 'Canonical migration failed.' }); }
  } return results;
}

export function reconcilePurchasingMigration(migrationRunId: string, vendorId: string, source: Record<string, number>, destination: Record<string, number>, tolerances: Record<string, number> = {}): PurchasingMigrationReconciliation {
  const items: PurchasingMigrationReconciliationItem[] = [...new Set([...Object.keys(source), ...Object.keys(destination)])].map(metric => { const sourceValue = source[metric] || 0, destinationValue = destination[metric] || 0, difference = destinationValue - sourceValue, tolerance = tolerances[metric] || 0; const result = Math.abs(difference) <= tolerance ? 'matched' : 'failed'; return { metric, sourceValue, destinationValue, difference, tolerance, result, explanation: result === 'matched' ? 'Values reconcile within tolerance.' : 'Destination differs from the approved source total.' }; });
  return { reconciliationId: `${migrationRunId}_reconciliation`, migrationRunId, vendorId, createdAt: new Date().toISOString(), status: items.some(row => row.result === 'failed') ? 'failed' : items.some(row => row.result === 'warning') ? 'warning' : 'matched', items, acknowledgedWarnings: [], completed: true };
}
export function assessPurchasingCutover(run: PurchasingMigrationRun, reconciliation: PurchasingMigrationReconciliation | undefined, checks: { supplierBalances: boolean; inventoryMovements: boolean; canonicalRepositories: boolean; legacyWritesDisabled: boolean; legacyFailClosed: boolean; rulesTests: boolean; authorityTests: boolean }): PurchasingCutoverReadiness { if (run.status !== 'completed' || run.failedRecordCount || !reconciliation?.completed || reconciliation.status === 'failed' || Object.values(checks).includes(false)) return 'notReady'; return reconciliation.status === 'warning' ? 'readyWithWarnings' : 'ready'; }
