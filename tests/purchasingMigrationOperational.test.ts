import { describe, expect, test, vi } from 'vitest';
import { approvePurchasingMigrationWithPermission, assessPurchasingCutoverDetailed, createPurchasingMigrationPreview, executePurchasingMigration, PurchasingMigrationError, reconcilePurchasingMigration } from '../src/pos-new/services/purchasingMigration/service';
import { deterministicMigrationId } from '../src/pos-new/services/purchasingMigration/fingerprint';
import type { CanonicalMigrationWriter } from '../src/pos-new/services/purchasingMigration/service';
import type { PurchasingMigrationApproval, PurchasingMigrationPreview, PurchasingMigrationRecord, PurchasingMigrationRun } from '../src/pos-new/services/purchasingMigration/types';

const record = (recordType: PurchasingMigrationRecord['recordType'], id: string, payload: Record<string, unknown> = {}, vendorId = 'vendor-a'): PurchasingMigrationRecord => ({ legacySourceType: 'browserStorage', legacyRecordId: id, vendorId, branchId: 'branch-a', recordType, payload });
const preview = async (records: PurchasingMigrationRecord[]) => createPurchasingMigrationPreview(records, { vendorId: 'vendor-a', branchId: 'branch-a', migrationRunId: 'run-operational', previewVersion: '09.1D-1', supplierIds: new Set(['supplier-1']), productIds: new Set(['product-1']) });
const approve = (value: PurchasingMigrationPreview, warnings: string[] = []) => approvePurchasingMigrationWithPermission(value, 'preparer', { actorId: 'approver', canApprove: true, canSelfApprove: false }, warnings, '09.1D');

class EffectWriter implements CanonicalMigrationWriter {
  fingerprints = new Map<string, string>(); inventoryMovements = 0; balances = new Map<string, number>(); payments = new Set<string>(); reversals = new Set<string>(); failOnce = new Set<string>();
  async migrate(source: PurchasingMigrationRecord, metadata: Parameters<CanonicalMigrationWriter['migrate']>[1]) {
    if (this.failOnce.delete(source.legacyRecordId)) throw new PurchasingMigrationError('TRANSIENT_WRITE_FAILURE', 'Temporary Firestore outage.', true);
    const prior = this.fingerprints.get(metadata.destinationId); if (prior && prior !== metadata.sourceFingerprint) throw new PurchasingMigrationError('FINGERPRINT_CONFLICT', 'Canonical identity already has another fingerprint.', false); if (prior) return;
    if (source.recordType === 'paymentReversal' && !this.payments.has(String(source.payload.originalPaymentId))) throw new PurchasingMigrationError('MISSING_DEPENDENCY', 'Original payment is required.', false);
    this.fingerprints.set(metadata.destinationId, metadata.sourceFingerprint);
    if (source.recordType === 'grn') this.inventoryMovements++;
    const deltas: Partial<Record<PurchasingMigrationRecord['recordType'], number>> = { grn: 100, supplierReturn: -20, supplierPayment: -30, supplierCreditNote: -10, paymentReversal: 30 };
    if (deltas[source.recordType]) this.balances.set('supplier-1', (this.balances.get('supplier-1') || 0) + deltas[source.recordType]!);
    if (source.recordType === 'supplierPayment') this.payments.add(source.legacyRecordId); if (source.recordType === 'paymentReversal') this.reversals.add(source.legacyRecordId);
  }
}

describe('Build 09.1D operational guarantees', () => {
  test('warning acknowledgement is complete, vendor scoped, and invalidated by changed preview', async () => {
    const value = await preview([record('supplier', 'supplier-1')]); value.issues.push({ issueId: 'warning:stable-1', code: 'DISCLOSED_NORMALIZATION', severity: 'warning', message: 'Review normalization.' });
    expect(() => approve(value)).toThrow('warning');
    const approval = approve(value, ['warning:stable-1']); expect(approval.acknowledgedWarnings).toEqual(['warning:stable-1']); expect(approval.warningAcknowledgementVendorId).toBe('vendor-a');
    await expect(executePurchasingMigration({ ...value, sourceFingerprint: 'changed' }, approval, new EffectWriter(), 'operator')).rejects.toMatchObject({ code: 'APPROVAL_INVALID' });
  });

  test('approval fails closed without permission and denies unauthorized self-approval', async () => {
    const value = await preview([record('supplier', 'supplier-1')]);
    expect(() => approvePurchasingMigrationWithPermission(value, 'preparer', undefined, [], '09.1D')).toThrow('permission');
    expect(() => approvePurchasingMigrationWithPermission(value, 'same-user', { actorId: 'same-user', canApprove: true, canSelfApprove: false }, [], '09.1D')).toThrow('Self-approval');
  });

  test('GRN inventory and every financial effect occur exactly once across retry and resume', async () => {
    const records = [record('grn', 'grn-1', { supplierId: 'supplier-1', lines: [{ productId: 'product-1' }] }), record('supplierReturn', 'return-1', { supplierId: 'supplier-1', lines: [{ productId: 'product-1' }] }), record('supplierCreditNote', 'credit-1', { supplierId: 'supplier-1' }), record('supplierPayment', 'payment-1', { supplierId: 'supplier-1' }), record('paymentReversal', 'reversal-1', { supplierId: 'supplier-1', originalPaymentId: 'payment-1' })];
    const value = await preview(records), approval = approve(value), writer = new EffectWriter(); const first = await executePurchasingMigration(value, approval, writer, 'operator'); await executePurchasingMigration(value, approval, writer, 'operator', first);
    expect(writer.inventoryMovements).toBe(1); expect(writer.balances.get('supplier-1')).toBe(70); expect(writer.payments.size).toBe(1); expect(writer.reversals.size).toBe(1);
  });

  test('payment and reversal are independently idempotent and reversal requires original payment', async () => {
    const writer = new EffectWriter(); const reversalPreview = await preview([record('paymentReversal', 'reversal-1', { supplierId: 'supplier-1', originalPaymentId: 'payment-1' })]); const failed = await executePurchasingMigration(reversalPreview, approve(reversalPreview), writer, 'operator'); expect(failed[0]).toMatchObject({ status: 'failed', errorCode: 'MISSING_DEPENDENCY', retryable: false });
    const paymentPreview = await preview([record('supplierPayment', 'payment-1', { supplierId: 'supplier-1' })]); const results = await executePurchasingMigration(paymentPreview, approve(paymentPreview), writer, 'operator'); await executePurchasingMigration(paymentPreview, approve(paymentPreview), writer, 'operator', results); expect(writer.payments.size).toBe(1);
  });

  test('selective retry retries only a transient failure and preserves completed records', async () => {
    const value = await preview([record('supplier', 'success'), record('supplier', 'transient')]); const writer = new EffectWriter(); writer.failOnce.add('transient'); const migrate = vi.spyOn(writer, 'migrate'); const first = await executePurchasingMigration(value, approve(value), writer, 'operator'); expect(first.map(row => row.status)).toEqual(['migrated', 'failed']); const resumed = await executePurchasingMigration(value, approve(value), writer, 'operator', first); expect(migrate).toHaveBeenCalledTimes(3); expect(resumed.filter(row => row.recordId === 'success')).toHaveLength(1); expect(resumed.at(-1)).toMatchObject({ recordId: 'transient', status: 'migrated', attemptNumber: 2 });
  });

  test('deterministic mapping is vendor/source/type scoped and conflicting remigration fails closed', async () => {
    expect(deterministicMigrationId('vendor-a', 'browserStorage', 'grn', '1')).toBe(deterministicMigrationId('vendor-a', 'browserStorage', 'grn', '1'));
    expect(deterministicMigrationId('vendor-a', 'browserStorage', 'grn', '1')).not.toBe(deterministicMigrationId('vendor-b', 'browserStorage', 'grn', '1')); expect(deterministicMigrationId('vendor-a', 'browserStorage', 'grn', '1')).not.toBe(deterministicMigrationId('vendor-a', 'browserStorage', 'supplierPayment', '1'));
    const writer = new EffectWriter(), original = await preview([record('supplier', 'same', { name: 'A' })]); await executePurchasingMigration(original, approve(original), writer, 'operator'); const changed = await preview([record('supplier', 'same', { name: 'B' })]); const conflict = await executePurchasingMigration(changed, approve(changed), writer, 'operator'); expect(conflict[0]).toMatchObject({ errorCode: 'FINGERPRINT_CONFLICT', retryable: false });
  });

  test('readiness reports every operational blocker and becomes ready only when all pass', () => {
    const run = { status: 'completed', failedRecordCount: 0 } as PurchasingMigrationRun; const reconciliation = reconcilePurchasingMigration('run', 'vendor-a', { total: 1 }, { total: 1 }); const checks = { supplierBalances: true, inventoryMovements: true, canonicalRepositories: true, legacyWritesDisabled: true, legacyFailClosed: true, rulesTests: true, authorityTests: true };
    expect(assessPurchasingCutoverDetailed(run, reconciliation, checks)).toMatchObject({ status: 'ready', blockers: [] });
    const blocked = assessPurchasingCutoverDetailed({ ...run, failedRecordCount: 1 }, { ...reconciliation, status: 'failed' }, { ...checks, supplierBalances: false, inventoryMovements: false, canonicalRepositories: false, legacyWritesDisabled: false, rulesTests: false, authorityTests: false, unacknowledgedWarnings: ['w1'], legacyWritePaths: [{ path: 'goodsReceivingService.postGRN', enabled: true }] });
    expect(blocked.blockers).toEqual(expect.arrayContaining(['RECORD_FAILURES_REMAIN', 'RECONCILIATION_FAILED', 'SUPPLIER_BALANCE_MISMATCH', 'INVENTORY_MOVEMENT_MISMATCH', 'CANONICAL_REPOSITORY_UNHEALTHY', 'LEGACY_WRITES_ACTIVE', 'LEGACY_PATH_ENABLED:goodsReceivingService.postGRN', 'RULES_TESTS_NOT_PASSED', 'AUTHORITY_TESTS_NOT_PASSED', 'UNACKNOWLEDGED_WARNINGS']));
  });

  test('diagnostics contain operational fields without unrestricted payloads', async () => {
    const value = await preview([record('supplier', 'supplier-opaque', { password: 'never-log', token: 'credential-value' })]); const diagnostics: unknown[] = []; await executePurchasingMigration(value, approve(value), new EffectWriter(), 'operator', [], 50, row => diagnostics.push(row)); const serialized = JSON.stringify(diagnostics); expect(diagnostics[0]).toMatchObject({ migrationRunId: 'run-operational', vendorId: 'vendor-a', recordId: 'supplier-opaque', recordType: 'supplier', operation: 'migrate:supplier', result: 'migrated', retryable: false, attemptNumber: 1 }); expect(serialized).not.toContain('never-log'); expect(serialized).not.toContain('credential-value'); expect(serialized).not.toContain('password');
  });
});
