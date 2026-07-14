import type { SharedInventoryBalanceRecord, SharedInventoryMovementRecord, SharedInventoryMovementType } from '../firebase/commerceDataContract';
import type { RepositoryOperationContext, RepositorySubscription } from './repositoryContext';

export interface InventoryBalanceFilters {
  productId?: string;
  branchId?: string;
  warehouseId?: string;
  locationId?: string;
}

export interface InventoryMovementFilters {
  productId?: string;
  movementType?: SharedInventoryMovementType | string;
  branchId?: string;
  warehouseId?: string;
  referenceId?: string;
  referenceType?: string;
}

export interface ReceiveStockCommand {
  productId: string;
  warehouseId?: string;
  branchId?: string;
  quantity: number;
  unitCost?: number;
  referenceType: string;
  referenceId: string;
  reason?: string;
  notes?: string;
}

export interface AdjustStockCommand {
  productId: string;
  warehouseId?: string;
  branchId?: string;
  quantityDelta: number;
  reasonCode: string;
  unitCost?: number;
  referenceType: string;
  referenceId: string;
  allowNegativeStock?: boolean;
  hasNegativeStockOverridePermission?: boolean;
  negativeStockOverrideReason?: string;
  notes?: string;
}

export interface TransferStockCommand {
  productId: string;
  sourceBranchId?: string;
  sourceWarehouseId?: string;
  destinationBranchId?: string;
  destinationWarehouseId?: string;
  quantity: number;
  referenceType: string;
  referenceId: string;
  reason?: string;
  notes?: string;
}

export interface PostStocktakeVarianceCommand {
  productId: string;
  warehouseId?: string;
  branchId?: string;
  systemQty: number;
  countedQty: number;
  unitCost?: number;
  referenceType: string;
  referenceId: string;
  varianceRisk?: string;
  notes?: string;
}

export type InventoryCommandResult = {
  success: boolean;
  movement?: SharedInventoryMovementRecord;
  movements?: SharedInventoryMovementRecord[];
  balance?: SharedInventoryBalanceRecord;
  errorCode?: string;
  errorMessage?: string;
};

export interface InventoryRepository {
  getBalance(context: RepositoryOperationContext, productId: string, locationId: string): Promise<{ success: boolean; data?: SharedInventoryBalanceRecord; errorCode?: string; errorMessage?: string }>;
  listBalances(context: RepositoryOperationContext, filters?: InventoryBalanceFilters): Promise<{ success: boolean; records: SharedInventoryBalanceRecord[]; errorCode?: string; errorMessage?: string }>;
  subscribeBalances(context: RepositoryOperationContext, listener: (records: SharedInventoryBalanceRecord[]) => void): RepositorySubscription;

  listMovements(context: RepositoryOperationContext, filters?: InventoryMovementFilters): Promise<{ success: boolean; records: SharedInventoryMovementRecord[]; errorCode?: string; errorMessage?: string }>;
  getMovement(context: RepositoryOperationContext, movementId: string): Promise<{ success: boolean; data?: SharedInventoryMovementRecord; errorCode?: string; errorMessage?: string }>;
  postMovement(context: RepositoryOperationContext, movement: SharedInventoryMovementRecord): Promise<{ success: boolean; data?: SharedInventoryMovementRecord; errorCode?: string; errorMessage?: string }>;

  receiveStock(context: RepositoryOperationContext, command: ReceiveStockCommand): Promise<InventoryCommandResult>;
  adjustStock(context: RepositoryOperationContext, command: AdjustStockCommand): Promise<InventoryCommandResult>;
  transferStock(context: RepositoryOperationContext, command: TransferStockCommand): Promise<InventoryCommandResult>;
  postStocktakeVariance(context: RepositoryOperationContext, command: PostStocktakeVarianceCommand): Promise<InventoryCommandResult>;
}
