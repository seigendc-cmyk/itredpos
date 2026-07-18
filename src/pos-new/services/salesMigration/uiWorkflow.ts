import type { SciPosStaffSession, SciVendorOwnerSession } from '../../../sci-auth/StaffAuthService';
import { CANONICAL_SALES_AUTHORITY_VERSION } from '../../domain/sales/salesAuthorityContract';
import { ENABLE_MOCK_SEED_DATA } from '../../utils/vendorDataMode';
import { canonicalSalesTransactionService } from '../sales/canonicalSalesTransactionService';
import { CanonicalSalesMigrationAdapter } from './canonicalAdapter';
import { FirestoreSalesMigrationReceiptStore, type SalesMigrationReceiptStore } from './durableReceiptStore';
import { assertLegacySalesWritesDisabled, readLegacySalesSource } from './legacySource';
import {
  approveSalesMigration,
  assertSalesMigrationApproval,
  calculateSalesMigrationTotals,
  createSalesMigrationDryRun,
  executeSalesMigration,
  reconcileSalesMigration
} from './service';
import type {
  SalesMigrationApproval,
  SalesMigrationPreview,
  SalesMigrationReconciliation,
  SalesMigrationResult
} from './types';

export const SALES_MIGRATION_ROUTE = '/admin/sales-migration-cutover';
export const ACTIVE_SALES_AUTHORITY_VERSION = CANONICAL_SALES_AUTHORITY_VERSION;
export const SALES_MIGRATION_PREVIEW_VERSION = '09.2C-ui-1';
export const SALES_MIGRATION_VERSION = '09.2C';

export class SalesMigrationUiAccessError extends Error {
  constructor(message: string) { super(message); this.name = 'SalesMigrationUiAccessError'; }
}

export interface SalesMigrationAdminContext {
  vendorId: string;
  vendorName: string;
  branchId: string;
  branchName: string;
  warehouseId: string;
  warehouseName: string;
  terminalId: string;
  terminalName: string;
  actorId: string;
  actorName: string;
  actorRole: 'Owner';
}

export function resolveSalesMigrationAdminContext(
  owner: SciVendorOwnerSession | null,
  staff: SciPosStaffSession | null,
  requestedVendorId?: string | null
): SalesMigrationAdminContext {
  if (!owner?.vendorId || !staff) throw new SalesMigrationUiAccessError('Authenticated vendor-owner and staff authority are required.');
  if (owner.role !== 'Owner' || staff.role !== 'Owner' || !staff.permissions.includes('*')) {
    throw new SalesMigrationUiAccessError('Sales migration is restricted to an authenticated vendor owner.');
  }
  if (owner.vendorId !== staff.vendorId) throw new SalesMigrationUiAccessError('Vendor authority mapping is missing or conflicting.');
  if (requestedVendorId && requestedVendorId !== owner.vendorId) throw new SalesMigrationUiAccessError('Cross-vendor sales migration access is denied.');
  const required = [staff.branchId, staff.warehouseId, staff.terminalId, staff.staffId];
  if (required.some(value => !String(value || '').trim())) throw new SalesMigrationUiAccessError('Canonical vendor, branch, warehouse, terminal, and actor context are required.');
  return {
    vendorId: owner.vendorId,
    vendorName: owner.vendorName || owner.vendorId,
    branchId: staff.branchId,
    branchName: staff.branchName || staff.branchId,
    warehouseId: staff.warehouseId,
    warehouseName: staff.warehouseName || staff.warehouseId,
    terminalId: staff.terminalId,
    terminalName: staff.terminalName || staff.terminalId,
    actorId: staff.staffId,
    actorName: staff.staffName || staff.staffId,
    actorRole: 'Owner'
  };
}

export interface SalesMigrationPreviewBundle {
  preview: SalesMigrationPreview;
  ignoredMockRecordIds: string[];
  counts: { candidate: number; eligible: number; conflict: number; invalid: number; quarantine: number };
}

export interface SalesMigrationApplyBundle {
  results: SalesMigrationResult[];
  reconciliation: SalesMigrationReconciliation;
  receiptReferences: string[];
}

export interface SalesMigrationUiDependencies {
  storage: Pick<Storage, 'getItem'>;
  receiptStore: SalesMigrationReceiptStore;
  adapter: CanonicalSalesMigrationAdapter;
  mockDataEnabled?: boolean;
  runId?: () => string;
}

function scan(context: SalesMigrationAdminContext, dependencies: SalesMigrationUiDependencies) {
  if (dependencies.mockDataEnabled) throw new Error('Sales migration is unavailable while mock-data mode is enabled.');
  assertLegacySalesWritesDisabled();
  const source = readLegacySalesSource({
    vendorId: context.vendorId,
    branchId: context.branchId,
    storage: dependencies.storage,
    sourceKind: 'legacyProduction'
  });
  if (source.sourceError) throw new Error(source.sourceError);
  return source;
}

export function salesMigrationPreviewCounts(preview: SalesMigrationPreview) {
  const conflicts = preview.quarantine.filter(row => row.codes.some(code => code === 'DUPLICATE_SOURCE' || code === 'FINGERPRINT_CONFLICT')).length;
  return {
    candidate: preview.records.length,
    eligible: preview.readyRecords.length,
    conflict: conflicts,
    invalid: preview.quarantine.length - conflicts,
    quarantine: preview.quarantine.length
  };
}

export function canApplySalesMigration(preview?: SalesMigrationPreview, approval?: SalesMigrationApproval, explicitlyApproved = false): boolean {
  if (!preview?.canApprove || !approval || !explicitlyApproved) return false;
  try { assertSalesMigrationApproval(preview, approval); return true; } catch { return false; }
}

export function createSalesMigrationUiWorkflow(overrides?: Partial<SalesMigrationUiDependencies>) {
  const dependencies: SalesMigrationUiDependencies = {
    storage: overrides?.storage ?? localStorage,
    receiptStore: overrides?.receiptStore ?? new FirestoreSalesMigrationReceiptStore(),
    adapter: overrides?.adapter ?? new CanonicalSalesMigrationAdapter(canonicalSalesTransactionService),
    mockDataEnabled: overrides?.mockDataEnabled ?? ENABLE_MOCK_SEED_DATA,
    runId: overrides?.runId ?? (() => `sales-migration-${Date.now()}-${crypto.randomUUID()}`)
  };
  return {
    async preview(context: SalesMigrationAdminContext): Promise<SalesMigrationPreviewBundle> {
      const source = scan(context, dependencies);
      const preview = await createSalesMigrationDryRun(source.records, {
        migrationRunId: dependencies.runId!(),
        vendorId: context.vendorId,
        branchId: context.branchId,
        previewVersion: SALES_MIGRATION_PREVIEW_VERSION
      });
      return { preview, ignoredMockRecordIds: source.ignoredMockRecordIds, counts: salesMigrationPreviewCounts(preview) };
    },
    approve(preview: SalesMigrationPreview, context: SalesMigrationAdminContext): SalesMigrationApproval {
      if (preview.vendorId !== context.vendorId || preview.branchId !== context.branchId) throw new SalesMigrationUiAccessError('Preview does not belong to the canonical vendor context.');
      return approveSalesMigration(preview, context.actorId, SALES_MIGRATION_VERSION, true);
    },
    async apply(
      context: SalesMigrationAdminContext,
      preview: SalesMigrationPreview,
      approval: SalesMigrationApproval,
      explicitlyApproved: boolean,
      onProgress?: (completed: number, total: number) => void
    ): Promise<SalesMigrationApplyBundle> {
      if (!canApplySalesMigration(preview, approval, explicitlyApproved)) throw new Error('A valid dry-run preview and explicit approval are required.');
      if (preview.vendorId !== context.vendorId || preview.branchId !== context.branchId) throw new SalesMigrationUiAccessError('Cross-vendor or cross-branch migration is denied.');
      const currentSource = scan(context, dependencies);
      const currentPreview = await createSalesMigrationDryRun(currentSource.records, {
        migrationRunId: preview.migrationRunId,
        vendorId: context.vendorId,
        branchId: context.branchId,
        previewVersion: preview.previewVersion
      });
      if (currentPreview.sourceFingerprint !== preview.sourceFingerprint) throw new Error('The legacy source changed after preview. Generate and approve a new dry run.');
      const results = await executeSalesMigration({
        preview: currentPreview,
        approval,
        adapter: dependencies.adapter,
        receiptStore: dependencies.receiptStore,
        actorId: context.actorId,
        actorRole: context.actorRole,
        warehouseId: context.warehouseId,
        terminalId: context.terminalId,
        onProgress
      });
      const completedIds = new Set(results.filter(row => row.status === 'migrated' || row.status === 'replayed').map(row => row.legacyRecordId));
      const destination = calculateSalesMigrationTotals(currentPreview.readyRecords.filter(row => completedIds.has(row.legacyRecordId)));
      return {
        results,
        reconciliation: reconcileSalesMigration(preview.migrationRunId, context.vendorId, currentPreview.totals, destination),
        receiptReferences: results.map(row => row.receiptId)
      };
    }
  };
}
