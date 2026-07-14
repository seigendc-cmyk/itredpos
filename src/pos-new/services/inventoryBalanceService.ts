import {
  getInventoryBalance,
  rebuildInventoryBalance,
  type InventoryBalanceInput,
  type InventoryBalanceRecord
} from './inventorySyncService';

/** @deprecated Collection routing belongs to firestorePaths. */
export const INVENTORY_BALANCE_COLLECTION = 'productStockBalances';

export type AvailableStockStatus =
  | 'In Stock'
  | 'Low Stock'
  | 'Out of Stock'
  | 'Negative Stock'
  | 'Reserved'
  | 'In Transit';

export interface AvailableStockInput extends InventoryBalanceInput {
  reorderLevel?: number;
}

export interface AvailableStockResult {
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number;
  quantityInTransit: number;
  status: AvailableStockStatus;
}

export function classifyAvailableStock(balance: AvailableStockResult, reorderLevel = 0): AvailableStockStatus {
  if (balance.quantityOnHand < 0 || balance.quantityAvailable < 0) return 'Negative Stock';
  if (balance.quantityInTransit > 0 && balance.quantityOnHand <= 0) return 'In Transit';
  if (balance.quantityReserved > 0 && balance.quantityAvailable <= 0) return 'Reserved';
  if (balance.quantityAvailable <= 0) return 'Out of Stock';
  if (reorderLevel > 0 && balance.quantityAvailable <= reorderLevel) return 'Low Stock';
  return 'In Stock';
}

export async function getAvailableStock(input: AvailableStockInput): Promise<AvailableStockResult> {
  const balance = await getInventoryBalance(input);
  const quantityOnHand = Number(balance.quantityOnHand || 0);
  const quantityReserved = Number(balance.quantityReserved || 0);
  const quantityInTransit = Number(balance.quantityInTransit || 0);
  const quantityAvailable = quantityOnHand - quantityReserved;
  return {
    quantityOnHand,
    quantityReserved,
    quantityAvailable,
    quantityInTransit,
    status: classifyAvailableStock({ quantityOnHand, quantityReserved, quantityAvailable, quantityInTransit, status: 'In Stock' }, input.reorderLevel)
  };
}

export async function rebuildInventoryBalanceFromLedger(input: InventoryBalanceInput): Promise<InventoryBalanceRecord> {
  return rebuildInventoryBalance(input);
}
