import type { LegacyPurchasingWritePathStatus, PurchasingCutoverAssessment, PurchasingMigrationApproval, PurchasingMigrationDiagnostic, PurchasingMigrationErrorCode, PurchasingMigrationIssue, PurchasingMigrationPermissionContext, PurchasingMigrationPreview, PurchasingMigrationRecord, PurchasingMigrationRecordResult, PurchasingMigrationReconciliation, PurchasingMigrationReconciliationItem, PurchasingMigrationRun, PurchasingCutoverReadiness } from './types';
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
  return { migrationRunId: preview.migrationRunId, vendorId: preview.vendorId, preparedBy, approvedBy, approvedAt: new Date().toISOString(), approvedSourceFingerprint: preview.sourceFingerprint, approvedPreviewVersion: preview.previewVersion, acknowledgedWarnings, warningAcknowledgementVendorId: preview.vendorId, migrationVersion };
}
export function approvePurchasingMigrationWithPermission(preview: PurchasingMigrationPreview, preparedBy: string, permission: PurchasingMigrationPermissionContext | undefined, acknowledgedWarnings: string[], migrationVersion: string): PurchasingMigrationApproval {
  if (!permission?.actorId || !permission.canApprove) throw new PurchasingMigrationError('PERMISSION_DENIED', 'Explicit migration approval permission is required.', false);
  if (preparedBy === permission.actorId && !permission.canSelfApprove) throw new PurchasingMigrationError('PERMISSION_DENIED', 'Self-approval is not permitted by the effective permission context.', false);
  return approvePurchasingMigration(preview, permission.actorId, acknowledgedWarnings, migrationVersion, true, preparedBy, false);
}
export function assertApprovalCurrent(preview: PurchasingMigrationPreview, approval: PurchasingMigrationApproval): void { if (preview.sourceFingerprint !== approval.approvedSourceFingerprint || preview.previewVersion !== approval.approvedPreviewVersion || preview.vendorId !== approval.vendorId || approval.warningAcknowledgementVendorId !== preview.vendorId) throw new PurchasingMigrationError('APPROVAL_INVALID', 'Migration approval is invalid because the approved preview changed.', false); }

export class PurchasingMigrationError extends Error { constructor(public readonly code: PurchasingMigrationErrorCode, message: string, public readonly retryable: boolean) { super(message); this.name = 'PurchasingMigrationError'; } }

export interface CanonicalMigrationWriter { migrate(record: PurchasingMigrationRecord, metadata: { legacySourceType: string; legacyRecordId: string; legacyParentId?: string; sourceFingerprint: string; migrationRunId: string; migratedAt: string; migratedBy: string; migrationVersion: string; destinationId: string }): Promise<import('./types').PurchasingMigrationCanonicalReferences | void>; }
export async function executePurchasingMigration(preview: PurchasingMigrationPreview, approval: PurchasingMigrationApproval, writer: CanonicalMigrationWriter, migratedBy: string, previous: PurchasingMigrationRecordResult[] = [], batchSize = 50, onDiagnostic?: (diagnostic: PurchasingMigrationDiagnostic) => void): Promise<PurchasingMigrationRecordResult[]> {
  assertApprovalCurrent(preview, approval); if (batchSize < 1 || batchSize > 200) throw new Error('Migration batch size must be between 1 and 200.');
  const results = [...previous]; const latest = new Map<string, PurchasingMigrationRecordResult>(); previous.forEach(row => latest.set(row.sourceFingerprint, row));
  const sorted = [...preview.records].sort((a, b) => order.indexOf(a.recordType) - order.indexOf(b.recordType));
  for (const record of sorted.slice(0, batchSize)) {
    const prior = latest.get(record.sourceFingerprint!); if (prior && (prior.status !== 'failed' || prior.retryable === false)) continue;
    const attemptNumber = (prior?.attemptNumber || 0) + 1; const attemptedAt = new Date().toISOString();
    const emit = (result: PurchasingMigrationRecordResult) => onDiagnostic?.({ migrationRunId: preview.migrationRunId, vendorId: preview.vendorId, branchId: preview.branchId, recordId: result.recordId, recordType: result.recordType, legacyRecordId: record.legacyRecordId, sourceFingerprint: result.sourceFingerprint, operation: `migrate:${record.recordType}`, result: result.status, errorCode: result.errorCode, errorMessage: result.failureReason, retryable: Boolean(result.retryable), attemptedAt, attemptNumber });
    if (record.legacyParentId && !sorted.some(parent => parent.legacyRecordId === record.legacyParentId) && !previous.some(parent => parent.destinationId?.endsWith(`_${record.legacyParentId}`))) { const result = { recordId: record.legacyRecordId, recordType: record.recordType, status: 'invalid' as const, sourceFingerprint: record.sourceFingerprint!, failureReason: 'Parent reference is unresolved.', errorCode: 'MISSING_DEPENDENCY' as const, retryable: false, attemptNumber }; results.push(result); emit(result); continue; }
    const destinationId = deterministicMigrationId(record.vendorId, record.legacySourceType, record.recordType, record.legacyRecordId); const migratedAt = new Date().toISOString();
    try { const canonicalReferences = await writer.migrate(record, { legacySourceType: record.legacySourceType, legacyRecordId: record.legacyRecordId, legacyParentId: record.legacyParentId, sourceFingerprint: record.sourceFingerprint!, migrationRunId: preview.migrationRunId, migratedAt, migratedBy, migrationVersion: approval.migrationVersion, destinationId }); const result = { recordId: record.legacyRecordId, recordType: record.recordType, status: 'migrated' as const, sourceFingerprint: record.sourceFingerprint!, destinationId, canonicalReferences: canonicalReferences || undefined, migratedAt, retryable: false, attemptNumber }; results.push(result); emit(result); }
    catch (error) { const migrationError = error instanceof PurchasingMigrationError ? error : new PurchasingMigrationError('TRANSIENT_WRITE_FAILURE', error instanceof Error ? error.message : 'Canonical migration failed.', true); const result = { recordId: record.legacyRecordId, recordType: record.recordType, status: 'failed' as const, sourceFingerprint: record.sourceFingerprint!, failureReason: migrationError.message, errorCode: migrationError.code, retryable: migrationError.retryable, attemptNumber }; results.push(result); emit(result); }
  } return results;
}

export function reconcilePurchasingMigration(migrationRunId: string, vendorId: string, source: Record<string, number>, destination: Record<string, number>, tolerances: Record<string, number> = {}): PurchasingMigrationReconciliation {
  const items: PurchasingMigrationReconciliationItem[] = [...new Set([...Object.keys(source), ...Object.keys(destination)])].map(metric => { const sourceValue = source[metric] || 0, destinationValue = destination[metric] || 0, difference = destinationValue - sourceValue, tolerance = tolerances[metric] || 0; const result = Math.abs(difference) <= tolerance ? 'matched' : 'failed'; return { metric, sourceValue, destinationValue, difference, tolerance, result, explanation: result === 'matched' ? 'Values reconcile within tolerance.' : 'Destination differs from the approved source total.' }; });
  return { reconciliationId: `${migrationRunId}_reconciliation`, migrationRunId, vendorId, createdAt: new Date().toISOString(), status: items.some(row => row.result === 'failed') ? 'failed' : items.some(row => row.result === 'warning') ? 'warning' : 'matched', items, acknowledgedWarnings: [], completed: true };
}
export interface PurchasingCutoverChecks { supplierBalances: boolean; inventoryMovements: boolean; canonicalRepositories: boolean; legacyWritesDisabled: boolean; legacyFailClosed: boolean; rulesTests: boolean; authorityTests: boolean; unacknowledgedWarnings?: string[]; legacyWritePaths?: LegacyPurchasingWritePathStatus[]; }
export function assessPurchasingCutoverDetailed(run: PurchasingMigrationRun, reconciliation: PurchasingMigrationReconciliation | undefined, checks: PurchasingCutoverChecks): PurchasingCutoverAssessment {
  const blockers: string[] = [];
  if (run.status !== 'completed') blockers.push('MIGRATION_INCOMPLETE'); if (run.failedRecordCount) blockers.push('RECORD_FAILURES_REMAIN');
  if (!reconciliation?.completed) blockers.push('RECONCILIATION_INCOMPLETE'); else if (reconciliation.status === 'failed') blockers.push('RECONCILIATION_FAILED');
  if (!checks.supplierBalances) blockers.push('SUPPLIER_BALANCE_MISMATCH'); if (!checks.inventoryMovements) blockers.push('INVENTORY_MOVEMENT_MISMATCH'); if (!checks.canonicalRepositories) blockers.push('CANONICAL_REPOSITORY_UNHEALTHY');
  if (!checks.legacyWritesDisabled || !checks.legacyFailClosed) blockers.push('LEGACY_WRITES_ACTIVE'); checks.legacyWritePaths?.filter(path => path.enabled).forEach(path => blockers.push(`LEGACY_PATH_ENABLED:${path.path}`));
  if (!checks.rulesTests) blockers.push('RULES_TESTS_NOT_PASSED'); if (!checks.authorityTests) blockers.push('AUTHORITY_TESTS_NOT_PASSED'); if (checks.unacknowledgedWarnings?.length) blockers.push('UNACKNOWLEDGED_WARNINGS');
  const warnings = reconciliation?.status === 'warning' ? reconciliation.items.filter(item => item.result === 'warning').map(item => item.metric) : [];
  return { status: blockers.length ? 'notReady' : warnings.length ? 'readyWithWarnings' : 'ready', blockers, warnings };
}
export function assessPurchasingCutover(run: PurchasingMigrationRun, reconciliation: PurchasingMigrationReconciliation | undefined, checks: PurchasingCutoverChecks): PurchasingCutoverReadiness { return assessPurchasingCutoverDetailed(run, reconciliation, checks).status; }
export const activeLegacyPurchasingWritePaths = (paths: LegacyPurchasingWritePathStatus[]): string[] => paths.filter(path => path.enabled).map(path => path.path);
