import { getInventoryMovements } from './inventoryMovementService';
import { getPendingInventoryMovements } from './inventorySyncService';
import { getStockLosses } from './stockLossService';
import { getStocktakeSessions, getStocktakeLines } from './stocktakeService';
import { getStockTransferLines, getStockTransfers } from './stockTransferService';

export interface InventoryLossControlWarning {
  title: string;
  shortExplanation: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  estimatedValue: number;
  recommendedAction: string;
  relatedRecordId?: string;
}

export async function getInventoryLossControlWarnings(input: { vendorId: string; branchId?: string; warehouseId?: string }): Promise<InventoryLossControlWarning[]> {
  const warnings: InventoryLossControlWarning[] = [];
  const movements = await getInventoryMovements({
    vendorId: input.vendorId,
    branchId: input.branchId,
    warehouseId: input.warehouseId
  });
  const negativeAdjustments = movements.filter((movement) => (
    movement.qtyOut > 0 &&
    ['STOCK_ADJUSTMENT_OUT', 'STOCKTAKE_LOSS', 'DAMAGE_WRITEOFF', 'WRITE_OFF', 'MANUAL_CORRECTION'].includes(movement.movementType)
  ));
  const lossValue = negativeAdjustments.reduce((sum, movement) => sum + Math.abs(movement.qtyOut * movement.unitCost), 0);
  if (negativeAdjustments.length >= 3) {
    warnings.push({
      title: 'Repeated negative adjustments',
      shortExplanation: 'Several stock reductions were posted through adjustment or write-off movements.',
      severity: lossValue >= 500 ? 'Critical' : 'High',
      estimatedValue: Number(lossValue.toFixed(2)),
      recommendedAction: 'Review approvals, supporting evidence, and staff activity.',
      relatedRecordId: negativeAdjustments[0]?.movementId
    });
  }

  const losses = await getStockLosses({ vendorId: input.vendorId, warehouseId: input.warehouseId });
  const expiryLosses = losses.filter((loss) => loss.lossType === 'Expiry');
  if (expiryLosses.length > 1) {
    warnings.push({
      title: 'Repeated expiry',
      shortExplanation: 'Multiple expiry losses were recorded for this inventory scope.',
      severity: 'High',
      estimatedValue: expiryLosses.reduce((sum, loss) => sum + loss.totalValue, 0),
      recommendedAction: 'Run expiry stocktake and review purchasing quantities.',
      relatedRecordId: expiryLosses[0]?.lossId
    });
  }

  const transfers = await getStockTransfers({ status: 'Variance Review' });
  for (const transfer of transfers.filter((row) => row.vendorId === input.vendorId)) {
    const lines = await getStockTransferLines(transfer.transferId);
    const shortageValue = lines
      .filter((line) => line.varianceType === 'Short Received' || line.varianceType === 'Damaged In Transit')
      .reduce((sum, line) => sum + Math.abs(line.qtyOutstanding * line.unitCost), 0);
    if (shortageValue > 0) {
      warnings.push({
        title: 'Transfer shortage',
        shortExplanation: `${transfer.transferNumber} has unreceived or damaged transfer quantity.`,
        severity: shortageValue >= 250 ? 'High' : 'Medium',
        estimatedValue: Number(shortageValue.toFixed(2)),
        recommendedAction: 'Investigate dispatch, transport, and receiving evidence.',
        relatedRecordId: transfer.transferId
      });
    }
  }

  const postedStocktakes = await getStocktakeSessions({ status: 'Posted' });
  for (const stocktake of postedStocktakes.filter((row) => row.vendorId === input.vendorId)) {
    const lines = await getStocktakeLines(stocktake.stocktakeId);
    const varianceValue = lines.reduce((sum, line) => sum + Math.abs(line.valueImpact), 0);
    if (varianceValue >= 300) {
      warnings.push({
        title: 'High-value stocktake variance',
        shortExplanation: `${stocktake.stocktakeNumber} posted a material stock variance.`,
        severity: varianceValue >= 750 ? 'Critical' : 'High',
        estimatedValue: Number(varianceValue.toFixed(2)),
        recommendedAction: 'Review count sheets, recount decisions, and posted movement evidence.',
        relatedRecordId: stocktake.stocktakeId
      });
    }
  }

  const pending = getPendingInventoryMovements().filter((movement) => movement.vendorId === input.vendorId);
  if (pending.length > 0) {
    warnings.push({
      title: 'Inventory synchronization pending',
      shortExplanation: 'Some posted inventory movements are waiting to synchronize.',
      severity: pending.some((movement) => movement.syncStatus === 'Failed') ? 'High' : 'Medium',
      estimatedValue: pending.reduce((sum, movement) => sum + Math.abs(movement.totalCost || 0), 0),
      recommendedAction: 'Open the offline queue and synchronize before closing inventory.',
      relatedRecordId: pending[0]?.movementId
    });
  }

  return warnings;
}
