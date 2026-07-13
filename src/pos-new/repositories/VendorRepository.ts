import type {
  SharedVendorRecord,
  SharedBranchRecord,
  SharedWarehouseRecord,
  SharedTerminalRecord,
  SharedVendorAppAccessRecord
} from '../firebase/commerceDataContract';
import type { RepositoryOperationContext, RepositorySubscription } from './repositoryContext';
import type { RepositoryListResult, RepositoryResult } from './repositoryTypes';

export interface VendorRepository {
  getVendor(vendorId: string): Promise<RepositoryResult<SharedVendorRecord>>;
  updateVendor(context: RepositoryOperationContext, vendorId: string, changes: Partial<SharedVendorRecord>): Promise<RepositoryResult<SharedVendorRecord>>;
  listBranches(vendorId: string): Promise<RepositoryListResult<SharedBranchRecord>>;
  getBranch(vendorId: string, branchId: string): Promise<RepositoryResult<SharedBranchRecord>>;
  createBranch(context: RepositoryOperationContext, branch: SharedBranchRecord): Promise<RepositoryResult<SharedBranchRecord>>;
  updateBranch(context: RepositoryOperationContext, branchId: string, changes: Partial<SharedBranchRecord>): Promise<RepositoryResult<SharedBranchRecord>>;
  deactivateBranch(context: RepositoryOperationContext, branchId: string): Promise<RepositoryResult<SharedBranchRecord>>;
  subscribeBranches(context: RepositoryOperationContext, listener: (records: SharedBranchRecord[]) => void): RepositorySubscription;
  listWarehouses(vendorId: string): Promise<RepositoryListResult<SharedWarehouseRecord>>;
  getWarehouse(vendorId: string, warehouseId: string): Promise<RepositoryResult<SharedWarehouseRecord>>;
  createWarehouse(context: RepositoryOperationContext, warehouse: SharedWarehouseRecord): Promise<RepositoryResult<SharedWarehouseRecord>>;
  updateWarehouse(context: RepositoryOperationContext, warehouseId: string, changes: Partial<SharedWarehouseRecord>): Promise<RepositoryResult<SharedWarehouseRecord>>;
  deactivateWarehouse(context: RepositoryOperationContext, warehouseId: string): Promise<RepositoryResult<SharedWarehouseRecord>>;
  subscribeWarehouses(context: RepositoryOperationContext, listener: (records: SharedWarehouseRecord[]) => void): RepositorySubscription;
  listTerminals(vendorId: string, branchId: string): Promise<RepositoryListResult<SharedTerminalRecord>>;
  getTerminal(vendorId: string, branchId: string, terminalId: string): Promise<RepositoryResult<SharedTerminalRecord>>;
  createTerminal(context: RepositoryOperationContext, terminal: SharedTerminalRecord): Promise<RepositoryResult<SharedTerminalRecord>>;
  updateTerminal(context: RepositoryOperationContext, branchId: string, terminalId: string, changes: Partial<SharedTerminalRecord>): Promise<RepositoryResult<SharedTerminalRecord>>;
  deactivateTerminal(context: RepositoryOperationContext, branchId: string, terminalId: string): Promise<RepositoryResult<SharedTerminalRecord>>;
  subscribeTerminals(context: RepositoryOperationContext, listener: (records: SharedTerminalRecord[]) => void): RepositorySubscription;
  listVendorAppAccess(context: RepositoryOperationContext): Promise<RepositoryListResult<SharedVendorAppAccessRecord>>;
  getVendorAppAccess(context: RepositoryOperationContext, appCode: string): Promise<RepositoryResult<SharedVendorAppAccessRecord>>;
  updateVendorAppAccess(context: RepositoryOperationContext, appCode: string, changes: Partial<SharedVendorAppAccessRecord>): Promise<RepositoryResult<SharedVendorAppAccessRecord>>;
  subscribeVendorAppAccess(context: RepositoryOperationContext, listener: (records: SharedVendorAppAccessRecord[]) => void): RepositorySubscription;
}
