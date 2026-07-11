import {
  adjustStock,
  consumeStockForSale,
  createInventoryMovementId,
  getPendingInventoryMovements,
  postInventoryMovement,
  postStocktakeAdjustment,
  receiveStock,
  rebuildInventoryBalance,
  recordTheftLoss,
  restoreStockForReturn,
  returnStockToSupplier,
  syncPendingInventoryMovements,
  transferStock,
  writeOffDamagedStock,
  writeOffExpiredStock,
  type InventoryMovementInput,
  type InventoryMovementRecord
} from './inventorySyncService';

export const INVENTORY_LEDGER_COLLECTION = 'inventory_ledger';

export function validateInventoryLedgerMovement(input: Pick<InventoryMovementRecord, 'quantityIn' | 'quantityOut' | 'balanceBefore' | 'balanceAfter'>): { valid: boolean; message: string } {
  if (input.quantityIn > 0 && input.quantityOut > 0) {
    return { valid: false, message: 'Inventory movement cannot increase and decrease stock at the same time.' };
  }
  if (input.quantityIn <= 0 && input.quantityOut <= 0) {
    return { valid: false, message: 'Inventory movement quantity must be greater than zero.' };
  }
  const expected = input.balanceBefore + input.quantityIn - input.quantityOut;
  if (expected !== input.balanceAfter) {
    return { valid: false, message: 'Inventory movement balance does not reconcile.' };
  }
  return { valid: true, message: 'Inventory movement reconciles.' };
}

export async function postLedgerMovement(input: InventoryMovementInput): Promise<InventoryMovementRecord> {
  return postInventoryMovement(input);
}

export {
  adjustStock,
  consumeStockForSale,
  createInventoryMovementId,
  getPendingInventoryMovements,
  postInventoryMovement,
  postStocktakeAdjustment,
  receiveStock,
  rebuildInventoryBalance,
  recordTheftLoss,
  restoreStockForReturn,
  returnStockToSupplier,
  syncPendingInventoryMovements,
  transferStock,
  writeOffDamagedStock,
  writeOffExpiredStock
};
