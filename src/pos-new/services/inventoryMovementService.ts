import {
  InventoryMovement,
  InventoryMovementFilters,
  InventoryMovementPayload,
  InventoryMovementStatus,
  InventoryMovementSummary,
  InventoryMovementType
} from '../types/posTypes';
import {
  addInventoryMovement,
  loadInventoryMovements,
  saveInventoryMovements,
  updateInventoryMovement
} from '../utils/localInventoryStore';

const EVENT_KEY = 'sci_pos_inventory_movement_events';

function recordInventoryEvent(eventType: string, message: string, movementId?: string): void {
  try {
    const cached = localStorage.getItem(EVENT_KEY);
    const existing = cached ? JSON.parse(cached) as Array<Record<string, unknown>> : [];
    localStorage.setItem(EVENT_KEY, JSON.stringify([{
      id: `IME-${Date.now()}`,
      eventType,
      movementId,
      message,
      createdAt: new Date().toISOString()
    }, ...existing].slice(0, 100)));
  } catch {
    // localStorage may be unavailable in some test contexts.
  }
}

function movementAffectsBalance(status: InventoryMovementStatus): boolean {
  return status === 'Posted';
}

function makeMovementId(): string {
  return `MOV-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
}

function calculateImpact(qtyIn: number, qtyOut: number, unitCost: number): number {
  return (qtyIn - qtyOut) * unitCost;
}

export async function getInventoryMovementsByProduct(productId: string): Promise<InventoryMovement[]> {
  return loadInventoryMovements()
    .filter((movement) => movement.productId === productId)
    .sort((a, b) => new Date(a.movementDate).getTime() - new Date(b.movementDate).getTime());
}

export async function getInventoryMovementsBySku(sku: string): Promise<InventoryMovement[]> {
  const normalizedSku = sku.toLowerCase();
  return loadInventoryMovements()
    .filter((movement) => movement.sku.toLowerCase() === normalizedSku)
    .sort((a, b) => new Date(a.movementDate).getTime() - new Date(b.movementDate).getTime());
}

export async function getInventoryMovementsByFilters(
  filters: InventoryMovementFilters,
  productContext?: Array<{ id: string; industrialSector?: string; productCategory?: string; category?: string }>
): Promise<InventoryMovement[]> {
  const fromTime = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`).getTime() : null;
  const toTime = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59`).getTime() : null;

  return loadInventoryMovements().filter((movement) => {
    const movementTime = new Date(movement.movementDate).getTime();
    const matchesDateFrom = fromTime === null || movementTime >= fromTime;
    const matchesDateTo = toTime === null || movementTime <= toTime;
    const matchesVendor = !filters.vendorId || movement.vendorId === filters.vendorId;
    const matchesProduct = !filters.productId || filters.productId === 'ALL' || movement.productId === filters.productId;
    const matchesSku = !filters.sku || movement.sku === filters.sku;
    const matchesBranch = !filters.branchId || filters.branchId === 'ALL' || movement.branchId === filters.branchId;
    const matchesWarehouse = !filters.warehouseId || filters.warehouseId === 'ALL' || movement.warehouseId === filters.warehouseId;
    const matchesShelf = !filters.shelfLocation || filters.shelfLocation === 'ALL' || movement.shelfLocation === filters.shelfLocation;
    const matchesMovement = !filters.movementType || filters.movementType === 'ALL' || movement.movementType === filters.movementType;
    const matchesReference = !filters.referenceType || filters.referenceType === 'ALL' || movement.referenceType === filters.referenceType;
    const matchesStaff = !filters.staffName || filters.staffName === 'ALL' || movement.staffName === filters.staffName;
    const matchesStatus = !filters.status || filters.status === 'ALL' || movement.status === filters.status;

    const productMeta = productContext?.find((product) => product.id === movement.productId);
    const matchesSector = !filters.sector || filters.sector === 'ALL' || productMeta?.industrialSector === filters.sector;
    const matchesCategory = !filters.category || filters.category === 'ALL' ||
      productMeta?.productCategory === filters.category ||
      productMeta?.category === filters.category;

    return matchesDateFrom && matchesDateTo && matchesVendor && matchesProduct && matchesSku && matchesBranch &&
      matchesWarehouse && matchesShelf && matchesMovement && matchesReference && matchesStaff && matchesStatus &&
      matchesSector && matchesCategory;
  }).sort((a, b) => new Date(a.movementDate).getTime() - new Date(b.movementDate).getTime());
}

export async function calculateRunningBalance(productId: string, warehouseId: string): Promise<number> {
  const movements = loadInventoryMovements()
    .filter((movement) => movement.productId === productId && movement.warehouseId === warehouseId && movementAffectsBalance(movement.status))
    .sort((a, b) => new Date(a.movementDate).getTime() - new Date(b.movementDate).getTime());
  return movements.at(-1)?.balanceAfter || 0;
}

export async function postInventoryMovement(payload: InventoryMovementPayload): Promise<InventoryMovement> {
  const now = new Date().toISOString();
  const balanceBefore = payload.balanceBefore;
  const balanceAfter = payload.balanceAfter ?? (movementAffectsBalance(payload.status) ? balanceBefore + payload.qtyIn - payload.qtyOut : balanceBefore);
  const movement: InventoryMovement = {
    ...payload,
    movementId: payload.movementId || makeMovementId(),
    movementType: payload.movementType || 'MANUAL_CORRECTION',
    referenceType: payload.referenceType || 'MANUAL',
    balanceAfter,
    totalCostImpact: payload.totalCostImpact ?? calculateImpact(payload.qtyIn, payload.qtyOut, payload.unitCost),
    createdAt: now,
    updatedAt: now
  };

  addInventoryMovement(movement);
  recordInventoryEvent('INVENTORY_MOVEMENT_POSTED', `${movement.movementType} posted for ${movement.sku}.`, movement.movementId);
  return movement;
}

export async function postSaleMovement(payload: InventoryMovementPayload): Promise<InventoryMovement> {
  const movement = await postInventoryMovement({ ...payload, movementType: 'SALE', referenceType: 'RECEIPT', status: payload.status || 'Posted' });
  recordInventoryEvent('SALE_STOCK_POSTED', `Sale stock posted for ${movement.sku}.`, movement.movementId);
  return movement;
}

export async function postReturnMovement(payload: InventoryMovementPayload): Promise<InventoryMovement> {
  const movement = await postInventoryMovement({ ...payload, movementType: 'SALE_RETURN', referenceType: 'RETURN', status: payload.status || 'Posted' });
  recordInventoryEvent('RETURN_STOCK_POSTED', `Return stock posted for ${movement.sku}.`, movement.movementId);
  return movement;
}

export async function postGoodsReceivedMovement(payload: InventoryMovementPayload): Promise<InventoryMovement> {
  const movement = await postInventoryMovement({ ...payload, movementType: 'GOODS_RECEIVED', referenceType: 'GRN' });
  if (movement.status === 'Pending Approval') {
    recordInventoryEvent('PURCHASE_VARIANCE_FOUND', `GRN variance pending approval for ${movement.sku}.`, movement.movementId);
  } else {
    recordInventoryEvent('GOODS_RECEIVED_POSTED', `Goods received posted for ${movement.sku}.`, movement.movementId);
  }
  return movement;
}

export async function postStockAdjustmentMovement(payload: InventoryMovementPayload): Promise<InventoryMovement> {
  const movement = await postInventoryMovement(payload);
  if (movement.status === 'Pending Approval') {
    recordInventoryEvent('STOCK_ADJUSTMENT_APPROVAL_REQUIRED', `Stock adjustment approval required for ${movement.sku}.`, movement.movementId);
    if (movement.qtyOut > 3) {
      recordInventoryEvent('SUSPICIOUS_STOCK_LOSS', `Suspicious stock loss flagged for ${movement.sku}.`, movement.movementId);
    }
  } else {
    recordInventoryEvent('STOCK_ADJUSTMENT_REQUESTED', `Stock adjustment recorded for ${movement.sku}.`, movement.movementId);
  }
  return movement;
}

export async function postStocktakeAdjustmentMovement(payload: InventoryMovementPayload): Promise<InventoryMovement> {
  const movement = await postInventoryMovement(payload);
  if (movement.status === 'Pending Approval') {
    recordInventoryEvent('AUDIT_STOCKTAKE_REVIEW_REQUIRED', `Audit stocktake review required for ${movement.sku}.`, movement.movementId);
  } else {
    recordInventoryEvent('STOCKTAKE_ADJUSTMENT_POSTED', `Stocktake adjustment posted for ${movement.sku}.`, movement.movementId);
  }
  recordInventoryEvent('STOCKTAKE_VARIANCE_FOUND', `Stocktake movement recorded for ${movement.sku}.`, movement.movementId);
  return movement;
}

export async function postTransferMovement(payload: InventoryMovementPayload): Promise<InventoryMovement> {
  const movement = await postInventoryMovement(payload);
  recordInventoryEvent('STOCK_TRANSFER_POSTED', `Stock transfer movement posted for ${movement.sku}.`, movement.movementId);
  return movement;
}

export async function postSupplierReturnMovement(payload: InventoryMovementPayload): Promise<InventoryMovement> {
  const movement = await postInventoryMovement({ ...payload, movementType: 'SUPPLIER_RETURN', referenceType: 'SUPPLIER_RETURN' });
  recordInventoryEvent('SUPPLIER_RETURN_POSTED', `Supplier return posted for ${movement.sku}.`, movement.movementId);
  return movement;
}

function oppositeMovementType(type: InventoryMovementType): InventoryMovementType {
  if (type.endsWith('_IN')) return type.replace('_IN', '_OUT') as InventoryMovementType;
  if (type.endsWith('_OUT')) return type.replace('_OUT', '_IN') as InventoryMovementType;
  if (type === 'SALE') return 'SALE_RETURN';
  if (type === 'SALE_RETURN') return 'SALE';
  if (type === 'GOODS_RECEIVED') return 'SUPPLIER_RETURN';
  return 'MANUAL_CORRECTION';
}

export async function reverseInventoryMovement(movementId: string, reason: string): Promise<InventoryMovement | null> {
  const original = loadInventoryMovements().find((movement) => movement.movementId === movementId);
  if (!original || original.status !== 'Posted') return null;

  updateInventoryMovement(movementId, { status: 'Reversed', notes: `${original.notes} | Reversed: ${reason}` });
  const reversal = await postInventoryMovement({
    ...original,
    movementId: undefined,
    movementType: oppositeMovementType(original.movementType),
    referenceType: 'MANUAL',
    referenceNumber: `REV-${original.referenceNumber}`,
    qtyIn: original.qtyOut,
    qtyOut: original.qtyIn,
    balanceBefore: original.balanceAfter,
    balanceAfter: original.balanceBefore,
    notes: `Reversal placeholder for ${original.movementId}. Reason: ${reason}`,
    status: 'Posted',
    riskFlag: 'Medium'
  });
  recordInventoryEvent('INVENTORY_MOVEMENT_REVERSED', `Movement ${movementId} reversed.`, reversal.movementId);
  return reversal;
}

export async function getInventoryMovementSummary(
  filters: InventoryMovementFilters,
  productContext?: Array<{ id: string; industrialSector?: string; productCategory?: string; category?: string }>
): Promise<InventoryMovementSummary> {
  const movements = await getInventoryMovementsByFilters(filters, productContext);
  return {
    totalSaleQtyOut: movements.filter((movement) => movement.movementType === 'SALE').reduce((sum, movement) => sum + movement.qtyOut, 0),
    totalReturnQtyIn: movements.filter((movement) => movement.movementType === 'SALE_RETURN').reduce((sum, movement) => sum + movement.qtyIn, 0),
    totalGoodsReceivedQtyIn: movements.filter((movement) => movement.movementType === 'GOODS_RECEIVED').reduce((sum, movement) => sum + movement.qtyIn, 0),
    totalAdjustmentQtyIn: movements.filter((movement) => movement.movementType === 'STOCK_ADJUSTMENT_IN' || movement.movementType === 'STOCKTAKE_ADJUSTMENT_IN' || movement.movementType === 'MANUAL_CORRECTION').reduce((sum, movement) => sum + movement.qtyIn, 0),
    totalAdjustmentQtyOut: movements.filter((movement) => movement.movementType === 'STOCK_ADJUSTMENT_OUT' || movement.movementType === 'STOCKTAKE_ADJUSTMENT_OUT' || movement.movementType === 'DAMAGE_WRITEOFF' || movement.movementType === 'MANUAL_CORRECTION').reduce((sum, movement) => sum + movement.qtyOut, 0),
    totalTransferIn: movements.filter((movement) => movement.movementType === 'TRANSFER_IN').reduce((sum, movement) => sum + movement.qtyIn, 0),
    totalTransferOut: movements.filter((movement) => movement.movementType === 'TRANSFER_OUT').reduce((sum, movement) => sum + movement.qtyOut, 0),
    totalSupplierReturnQtyOut: movements.filter((movement) => movement.movementType === 'SUPPLIER_RETURN').reduce((sum, movement) => sum + movement.qtyOut, 0),
    netMovement: movements.reduce((sum, movement) => sum + movement.qtyIn - movement.qtyOut, 0),
    highRiskMovements: movements.filter((movement) => movement.riskFlag === 'High' || movement.riskFlag === 'Critical').length
  };
}

export async function getInventoryMovementEvents(): Promise<Array<{ id: string; eventType: string; message: string; createdAt: string }>> {
  try {
    const cached = localStorage.getItem(EVENT_KEY);
    return cached ? JSON.parse(cached) as Array<{ id: string; eventType: string; message: string; createdAt: string }> : [];
  } catch {
    return [];
  }
}
