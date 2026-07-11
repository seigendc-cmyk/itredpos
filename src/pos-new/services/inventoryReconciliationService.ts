import { calculateRunningBalance } from './inventoryMovementService';
import { getInventoryBalance, getPendingInventoryMovements, rebuildInventoryBalance } from './inventorySyncService';

export const INVENTORY_RECONCILIATION_COLLECTION = 'inventory_reconciliations';

export type InventoryReconciliationStatus = 'Reconciled' | 'DifferenceFound' | 'PendingSync' | 'RepairRequired';

export interface InventoryReconciliationResult {
  vendorId: string;
  warehouseId: string;
  productId: string;
  ledgerBalance: number;
  cachedBalance: number;
  variance: number;
  pendingMovements: number;
  status: InventoryReconciliationStatus;
  checkedAt: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function reconcileInventoryBalance(input: {
  vendorId: string;
  branchId: string;
  warehouseId: string;
  productId: string;
}): Promise<InventoryReconciliationResult> {
  const balance = await getInventoryBalance(input);
  const ledgerBalance = await calculateRunningBalance(input.productId, input.warehouseId);
  const pendingMovements = getPendingInventoryMovements().filter((movement) => (
    movement.vendorId === input.vendorId &&
    movement.warehouseId === input.warehouseId &&
    movement.productId === input.productId
  )).length;
  const cachedBalance = Number(balance.quantityOnHand || 0);
  const variance = ledgerBalance - cachedBalance;
  const status: InventoryReconciliationStatus = pendingMovements > 0
    ? 'PendingSync'
    : variance === 0
      ? 'Reconciled'
      : Math.abs(variance) > 0
        ? 'DifferenceFound'
        : 'RepairRequired';
  return {
    vendorId: input.vendorId,
    warehouseId: input.warehouseId,
    productId: input.productId,
    ledgerBalance,
    cachedBalance,
    variance,
    pendingMovements,
    status,
    checkedAt: nowIso()
  };
}

export async function rebuildReconciledInventoryBalance(input: {
  vendorId: string;
  branchId: string;
  warehouseId: string;
  productId: string;
  authorized: boolean;
}) {
  if (!input.authorized) {
    throw new Error('Balance rebuild requires owner or authorized manager approval.');
  }
  return rebuildInventoryBalance(input);
}
