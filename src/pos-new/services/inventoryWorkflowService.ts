import { COMMERCE_SCHEMA_VERSION, type SharedInventoryMovementRecord } from '../firebase/commerceDataContract';
import { createRepositoryBundle } from '../repositories/repositoryFactory';
import type { RepositoryOperationContext } from '../repositories/repositoryContext';
import type { InventoryCommandResult } from '../repositories/InventoryRepository';

export interface WorkflowInventoryLine {
  productId: string;
  quantity: number;
  unitCost?: number;
  branchId?: string;
  warehouseId?: string;
  reason?: string;
  systemQty?: number;
  countedQty?: number;
}

export interface InventoryWorkflowResult {
  success: boolean;
  posted: number;
  duplicateOrExisting: number;
  results: InventoryCommandResult[];
  errorMessage?: string;
}

function aggregate(lines: WorkflowInventoryLine[]): WorkflowInventoryLine[] {
  const grouped = new Map<string, WorkflowInventoryLine>();
  lines.forEach((line) => {
    const key = [line.branchId || '', line.warehouseId || '', line.productId].join('|');
    const current = grouped.get(key);
    grouped.set(key, current ? { ...current, quantity: current.quantity + line.quantity } : { ...line });
  });
  return [...grouped.values()];
}

async function collect(operations: Array<() => Promise<InventoryCommandResult>>): Promise<InventoryWorkflowResult> {
  const results: InventoryCommandResult[] = [];
  for (const operation of operations) {
    const result = await operation();
    results.push(result);
    if (!result.success) return { success: false, posted: results.filter((item) => item.success).length, duplicateOrExisting: 0, results, errorMessage: result.errorMessage || 'Inventory workflow posting failed.' };
  }
  return { success: true, posted: results.length, duplicateOrExisting: results.filter((item) => item.success && !item.movement && !item.movements?.length).length, results };
}

export function postGoodsReceiptWorkflow(context: RepositoryOperationContext, grnId: string, lines: WorkflowInventoryLine[]): Promise<InventoryWorkflowResult> {
  const repository = createRepositoryBundle().inventory;
  return collect(aggregate(lines).map((line) => () => repository.receiveStock(context, { productId: line.productId, branchId: line.branchId, warehouseId: line.warehouseId, quantity: Math.abs(line.quantity), unitCost: line.unitCost, referenceType: 'GRN', referenceId: grnId, reason: line.reason || 'Goods received', notes: line.reason })));
}

export function postStockAdjustmentWorkflow(context: RepositoryOperationContext, adjustmentId: string, lines: WorkflowInventoryLine[], reason: string): Promise<InventoryWorkflowResult> {
  if (!reason.trim()) return Promise.resolve({ success: false, posted: 0, duplicateOrExisting: 0, results: [], errorMessage: 'Adjustment reason is required.' });
  const repository = createRepositoryBundle().inventory;
  return collect(aggregate(lines).map((line) => () => repository.adjustStock(context, { productId: line.productId, branchId: line.branchId, warehouseId: line.warehouseId, quantityDelta: line.quantity, unitCost: line.unitCost, reasonCode: reason, referenceType: 'STOCK_ADJUSTMENT', referenceId: adjustmentId, notes: line.reason || reason })));
}

export function postStockTransferWorkflow(context: RepositoryOperationContext, transferId: string, lines: Array<WorkflowInventoryLine & { destinationBranchId: string; destinationWarehouseId?: string }>): Promise<InventoryWorkflowResult> {
  const repository = createRepositoryBundle().inventory;
  return collect(lines.map((line) => () => repository.transferStock(context, { productId: line.productId, sourceBranchId: line.branchId, sourceWarehouseId: line.warehouseId, destinationBranchId: line.destinationBranchId, destinationWarehouseId: line.destinationWarehouseId, quantity: Math.abs(line.quantity), referenceType: 'STOCK_TRANSFER', referenceId: transferId, reason: line.reason || 'Stock transfer', notes: line.reason })));
}

export function postStocktakeWorkflow(context: RepositoryOperationContext, stocktakeId: string, lines: WorkflowInventoryLine[]): Promise<InventoryWorkflowResult> {
  const repository = createRepositoryBundle().inventory;
  return collect(lines.filter((line) => line.countedQty !== undefined && line.systemQty !== undefined && line.countedQty !== line.systemQty).map((line) => () => repository.postStocktakeVariance(context, { productId: line.productId, branchId: line.branchId, warehouseId: line.warehouseId, systemQty: Number(line.systemQty), countedQty: Number(line.countedQty), unitCost: line.unitCost, referenceType: 'STOCKTAKE', referenceId: stocktakeId, varianceRisk: line.reason, notes: line.reason || 'Stocktake variance' })));
}

export function postSupplierReturnWorkflow(context: RepositoryOperationContext, supplierReturnId: string, lines: WorkflowInventoryLine[]): Promise<InventoryWorkflowResult> {
  const repository = createRepositoryBundle().inventory;
  const timestamp = new Date().toISOString();
  return collect(aggregate(lines).map((line) => () => {
    const movementId = `supplier-return-${supplierReturnId}-${line.productId}-${line.warehouseId || line.branchId || 'location'}`.replace(/[^A-Za-z0-9_-]/g, '_');
    const movement: SharedInventoryMovementRecord = { sciId: movementId, movementId, vendorId: context.vendorId, branchId: line.branchId || context.branchId || '', warehouseId: line.warehouseId || context.warehouseId, productId: line.productId, movementType: 'SUPPLIER_RETURN', quantityDelta: -Math.abs(line.quantity), quantityBefore: 0, quantityAfter: 0, unitCost: line.unitCost, valueImpact: -Math.abs(line.quantity) * Number(line.unitCost || 0), referenceType: 'SUPPLIER_RETURN', referenceId: supplierReturnId, staffId: context.staffId || context.actorId, actorId: context.actorId, correlationId: context.correlationId, sourceApp: context.sourceApp, createdAt: timestamp, updatedAt: timestamp, createdBy: context.actorId, updatedBy: context.actorId, schemaVersion: COMMERCE_SCHEMA_VERSION, status: 'Posted' };
    return repository.postMovement(context, movement).then((result) => result.success ? { success: true, movement: result.data } : result);
  }));
}
