import type { SharedInventoryBalanceRecord, SharedInventoryMovementRecord } from '../firebase/commerceDataContract';
import type { RepositoryOperationContext, RepositorySubscription } from './repositoryContext';

export interface InventoryRepository {
  getBalance(context: RepositoryOperationContext, productId: string, locationId: string): Promise<{ success: boolean; data?: SharedInventoryBalanceRecord; errorCode?: string; errorMessage?: string }>;
  listBalances(context: RepositoryOperationContext): Promise<{ success: boolean; records: SharedInventoryBalanceRecord[]; errorCode?: string; errorMessage?: string }>;
  listMovements(context: RepositoryOperationContext, productId?: string): Promise<{ success: boolean; records: SharedInventoryMovementRecord[]; errorCode?: string; errorMessage?: string }>;
  postMovement(context: RepositoryOperationContext, movement: SharedInventoryMovementRecord): Promise<{ success: boolean; data?: SharedInventoryMovementRecord; errorCode?: string; errorMessage?: string }>;
  subscribeBalances(context: RepositoryOperationContext, listener: (records: SharedInventoryBalanceRecord[]) => void): RepositorySubscription;
}
