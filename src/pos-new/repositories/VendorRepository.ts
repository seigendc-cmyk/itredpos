import type { SharedVendorRecord, SharedBranchRecord, SharedWarehouseRecord, SharedTerminalRecord } from '../firebase/commerceDataContract';
import type { RepositoryOperationContext, RepositorySubscription } from './repositoryContext';

export interface VendorRepository {
  getVendor(vendorId: string): Promise<{ success: boolean; data?: SharedVendorRecord; errorCode?: string; errorMessage?: string }>;
  listBranches(vendorId: string): Promise<{ success: boolean; records: SharedBranchRecord[]; errorCode?: string; errorMessage?: string }>;
  listWarehouses(vendorId: string): Promise<{ success: boolean; records: SharedWarehouseRecord[]; errorCode?: string; errorMessage?: string }>;
  listTerminals(vendorId: string, branchId: string): Promise<{ success: boolean; records: SharedTerminalRecord[]; errorCode?: string; errorMessage?: string }>;
}
