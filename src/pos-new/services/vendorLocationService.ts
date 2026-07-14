import { createRepositoryBundle, type RepositoryBundle } from '../repositories/repositoryFactory';
import type { RepositoryOperationContext } from '../repositories/repositoryContext';
import type { RepositoryListResult, RepositoryResult, RepositorySubscription } from '../repositories/repositoryTypes';
import type { SharedAuditRecord, SharedVendorRecord, SharedBranchRecord, SharedWarehouseRecord, SharedTerminalRecord, SharedVendorAppAccessRecord } from '../firebase/commerceDataContract';
import { REPOSITORY_ERROR_CODES } from '../repositories/firestore/firestoreErrorMapper';

export type VendorLocationErrorCode =
  | 'PERMISSION_DENIED'
  | 'UNAUTHENTICATED'
  | 'TENANT_CONTEXT_MISSING'
  | 'NOT_FOUND'
  | 'ALREADY_EXISTS'
  | 'SERVICE_UNAVAILABLE'
  | 'VALIDATION_ERROR'
  | 'UNKNOWN';

export type VendorLocationResult<T> = Omit<RepositoryResult<T>, 'errorCode'> & {
  errorCode?: VendorLocationErrorCode;
};

export type VendorLocationListResult<T> = Omit<RepositoryListResult<T>, 'errorCode'> & {
  errorCode?: VendorLocationErrorCode;
};

export type VendorLocationSubscription = RepositorySubscription;

function toVendorLocationErrorCode(code?: string): VendorLocationErrorCode {
  if (!code) return 'UNKNOWN';
  switch (code) {
    case REPOSITORY_ERROR_CODES.PERMISSION_DENIED:
      return 'PERMISSION_DENIED';
    case REPOSITORY_ERROR_CODES.UNAUTHENTICATED:
      return 'UNAUTHENTICATED';
    case REPOSITORY_ERROR_CODES.NOT_FOUND:
      return 'NOT_FOUND';
    case REPOSITORY_ERROR_CODES.ALREADY_EXISTS:
      return 'ALREADY_EXISTS';
    case REPOSITORY_ERROR_CODES.UNAVAILABLE:
      return 'SERVICE_UNAVAILABLE';
    case REPOSITORY_ERROR_CODES.FAILED_PRECONDITION:
      return 'VALIDATION_ERROR';
    default:
      return 'UNKNOWN';
  }
}

function mapOperationResult<T>(result: RepositoryResult<T>): VendorLocationResult<T> {
  return {
    success: result.success,
    data: result.data,
    errorCode: result.errorCode ? toVendorLocationErrorCode(result.errorCode) : undefined,
    errorMessage: result.errorMessage
  };
}

function mapListResult<T>(result: RepositoryListResult<T>): VendorLocationListResult<T> {
  return {
    success: result.success,
    records: result.records,
    errorCode: result.errorCode ? toVendorLocationErrorCode(result.errorCode) : undefined,
    errorMessage: result.errorMessage
  };
}

let cachedBundle: RepositoryBundle | null = null;

export function getRepositoryBundle(): RepositoryBundle {
  if (!cachedBundle) {
    cachedBundle = createRepositoryBundle();
  }
  return cachedBundle;
}

export function resetRepositoryBundle(): void {
  cachedBundle = null;
}

export async function loadVendorLocationContext(context: RepositoryOperationContext): Promise<{
  vendor: VendorLocationResult<SharedVendorRecord>;
  branches: VendorLocationListResult<SharedBranchRecord>;
  warehouses: VendorLocationListResult<SharedWarehouseRecord>;
  terminals: VendorLocationListResult<SharedTerminalRecord>;
  appAccess: VendorLocationListResult<SharedVendorAppAccessRecord>;
}> {
  const bundle = getRepositoryBundle();
  const vendors = bundle.vendors;

  const vendorResult = mapOperationResult<SharedVendorRecord>(await vendors.getVendor(context.vendorId));
  const branchesResult = mapListResult<SharedBranchRecord>(await vendors.listBranches(context.vendorId));
  const warehousesResult = mapListResult<SharedWarehouseRecord>(await vendors.listWarehouses(context.vendorId));
  const terminalsResult = mapListResult<SharedTerminalRecord>(await vendors.listTerminals(context.vendorId, context.branchId || ''));
  const appAccessResult = mapListResult<SharedVendorAppAccessRecord>(await vendors.listVendorAppAccess(context));

  return {
    vendor: vendorResult,
    branches: branchesResult,
    warehouses: warehousesResult,
    terminals: terminalsResult,
    appAccess: appAccessResult
  };
}

export async function updateVendorCommand(context: RepositoryOperationContext, changes: Partial<SharedVendorRecord>): Promise<VendorLocationResult<SharedVendorRecord>> {
  const result = await getRepositoryBundle().vendors.updateVendor(context, context.vendorId, changes);
  const mapped = mapOperationResult(result);
  if (mapped.success) await appendAuditEvent(context, 'VENDOR_UPDATED', 'vendor', context.vendorId, changes);
  return mapped;
}

export async function createBranchCommand(context: RepositoryOperationContext, branch: SharedBranchRecord): Promise<VendorLocationResult<SharedBranchRecord>> {
  const bundle = getRepositoryBundle();
  const result = await bundle.vendors.createBranch(context, branch);
  const mapped = mapOperationResult(result);
  if (mapped.success) {
    await appendAuditEvent(context, 'BRANCH_CREATED', 'branch', branch.branchId, { branch });
  }
  return mapped;
}

export async function updateBranchCommand(context: RepositoryOperationContext, branchId: string, changes: Partial<SharedBranchRecord>): Promise<VendorLocationResult<SharedBranchRecord>> {
  const bundle = getRepositoryBundle();
  const result = await bundle.vendors.updateBranch(context, branchId, changes);
  const mapped = mapOperationResult(result);
  if (mapped.success) {
    await appendAuditEvent(context, 'BRANCH_UPDATED', 'branch', branchId, changes);
  }
  return mapped;
}

export async function deactivateBranchCommand(context: RepositoryOperationContext, branchId: string): Promise<VendorLocationResult<SharedBranchRecord>> {
  const bundle = getRepositoryBundle();
  const result = await bundle.vendors.deactivateBranch(context, branchId);
  const mapped = mapOperationResult(result);
  if (mapped.success) {
    await appendAuditEvent(context, 'BRANCH_DEACTIVATED', 'branch', branchId, { branchId });
  }
  return mapped;
}

export async function createWarehouseCommand(context: RepositoryOperationContext, warehouse: SharedWarehouseRecord): Promise<VendorLocationResult<SharedWarehouseRecord>> {
  const bundle = getRepositoryBundle();
  const result = await bundle.vendors.createWarehouse(context, warehouse);
  const mapped = mapOperationResult(result);
  if (mapped.success) {
    await appendAuditEvent(context, 'WAREHOUSE_CREATED', 'warehouse', warehouse.warehouseId, { warehouse });
  }
  return mapped;
}

export async function updateWarehouseCommand(context: RepositoryOperationContext, warehouseId: string, changes: Partial<SharedWarehouseRecord>): Promise<VendorLocationResult<SharedWarehouseRecord>> {
  const bundle = getRepositoryBundle();
  const result = await bundle.vendors.updateWarehouse(context, warehouseId, changes);
  const mapped = mapOperationResult(result);
  if (mapped.success) {
    await appendAuditEvent(context, 'WAREHOUSE_UPDATED', 'warehouse', warehouseId, changes);
  }
  return mapped;
}

export async function deactivateWarehouseCommand(context: RepositoryOperationContext, warehouseId: string): Promise<VendorLocationResult<SharedWarehouseRecord>> {
  const bundle = getRepositoryBundle();
  const result = await bundle.vendors.deactivateWarehouse(context, warehouseId);
  const mapped = mapOperationResult(result);
  if (mapped.success) {
    await appendAuditEvent(context, 'WAREHOUSE_DEACTIVATED', 'warehouse', warehouseId, { warehouseId });
  }
  return mapped;
}

export async function createTerminalCommand(context: RepositoryOperationContext, terminal: SharedTerminalRecord): Promise<VendorLocationResult<SharedTerminalRecord>> {
  const bundle = getRepositoryBundle();
  const result = await bundle.vendors.createTerminal(context, terminal);
  const mapped = mapOperationResult(result);
  if (mapped.success) {
    await appendAuditEvent(context, 'TERMINAL_CREATED', 'terminal', terminal.terminalId, { terminal });
  }
  return mapped;
}

export async function updateTerminalCommand(context: RepositoryOperationContext, branchId: string, terminalId: string, changes: Partial<SharedTerminalRecord>): Promise<VendorLocationResult<SharedTerminalRecord>> {
  const bundle = getRepositoryBundle();
  const result = await bundle.vendors.updateTerminal(context, branchId, terminalId, changes);
  const mapped = mapOperationResult(result);
  if (mapped.success) {
    await appendAuditEvent(context, 'TERMINAL_UPDATED', 'terminal', terminalId, changes);
  }
  return mapped;
}

export async function deactivateTerminalCommand(context: RepositoryOperationContext, branchId: string, terminalId: string): Promise<VendorLocationResult<SharedTerminalRecord>> {
  const bundle = getRepositoryBundle();
  const result = await bundle.vendors.deactivateTerminal(context, branchId, terminalId);
  const mapped = mapOperationResult(result);
  if (mapped.success) {
    await appendAuditEvent(context, 'TERMINAL_DEACTIVATED', 'terminal', terminalId, { branchId, terminalId });
  }
  return mapped;
}

export async function updateVendorAppAccessCommand(context: RepositoryOperationContext, appCode: string, changes: Partial<SharedVendorAppAccessRecord>): Promise<VendorLocationResult<SharedVendorAppAccessRecord>> {
  const bundle = getRepositoryBundle();
  const result = await bundle.vendors.updateVendorAppAccess(context, appCode, changes);
  const mapped = mapOperationResult(result);
  if (mapped.success) {
    await appendAuditEvent(context, 'VENDOR_APP_ACCESS_UPDATED', 'vendorAppAccess', appCode, changes);
  }
  return mapped;
}

export async function appendAuditEvent(
  context: RepositoryOperationContext,
  action: string,
  entityType: string,
  entityId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const bundle = getRepositoryBundle();
  const auditRepository = bundle.audit;
  const biRepository = bundle.biEvents;

  const auditRecord: SharedAuditRecord = {
    vendorId: context.vendorId,
    branchId: context.branchId || '',
    terminalId: context.terminalId || '',
    staffId: context.staffId || '',
    actorId: context.actorId,
    actorRole: context.actorRole || '',
    action,
    entityType,
    entityId,
    before: null,
    after: payload,
    reason: '',
    sourceApp: context.sourceApp,
    createdAt: new Date().toISOString(),
    correlationId: context.correlationId
  };

  await auditRepository.appendAuditRecord(context, auditRecord);

  await biRepository.publishEvent(context, {
    eventId: `${entityType}-${entityId}-${Date.now().toString(36)}`,
    eventType: action,
    vendorId: context.vendorId,
    branchId: context.branchId || '',
    terminalId: context.terminalId || '',
    staffId: context.staffId || '',
    sourceApp: context.sourceApp,
    entityType,
    entityId,
    timestamp: new Date().toISOString(),
    severity: 'INFO',
    actionRequired: false,
    metadata: payload,
    schemaVersion: 1
  });
}

export function resolveDefaultBranch(branches: SharedBranchRecord[]): SharedBranchRecord | undefined {
  return branches.find((branch) => branch.status === 'ACTIVE') || branches[0];
}

export function resolveDefaultWarehouse(warehouses: SharedWarehouseRecord[]): SharedWarehouseRecord | undefined {
  return warehouses.find((warehouse) => warehouse.status === 'ACTIVE') || warehouses[0];
}

export function resolveDefaultTerminal(terminals: SharedTerminalRecord[]): SharedTerminalRecord | undefined {
  return terminals.find((terminal) => terminal.status === 'ACTIVE') || terminals[0];
}
