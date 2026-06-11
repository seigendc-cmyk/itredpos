import {
  InventoryMovement,
  InventoryMovementFilters,
  InventoryMovementType,
  ProductLedgerEntry,
  ProductLedgerFilters,
  ProductLedgerSummary
} from '../types/posTypes';
import {
  getInventoryMovementsByProduct,
  getInventoryMovementsBySku
} from './inventoryMovementService';

const EVENT_KEY = 'sci_pos_product_ledger_events';

const LEDGER_MOVEMENT_TYPE_MAP: Record<InventoryMovementType, string> = {
  OPENING_BALANCE: 'Opening Balance',
  SALE: 'Sale',
  SALE_RETURN: 'Return',
  CUSTOMER_RETURN: 'Return',
  GOODS_RECEIVED: 'Goods Received',
  STOCK_ADJUSTMENT_IN: 'Stock Adjustment',
  STOCK_ADJUSTMENT_OUT: 'Stock Adjustment',
  STOCKTAKE_ADJUSTMENT_IN: 'Stocktake Adjustment',
  STOCKTAKE_ADJUSTMENT_OUT: 'Stocktake Adjustment',
  STOCKTAKE_GAIN: 'Stocktake Adjustment',
  STOCKTAKE_LOSS: 'Stocktake Adjustment',
  TRANSFER_IN: 'Transfer In',
  TRANSFER_OUT: 'Transfer Out',
  BRANCH_TRANSFER_IN: 'Transfer In',
  BRANCH_TRANSFER_OUT: 'Transfer Out',
  SUPPLIER_RETURN: 'Supplier Return',
  DAMAGE_WRITEOFF: 'Damage / Write-Off',
  WRITE_OFF: 'Write Off',
  REVERSAL: 'Reversal',
  MANUAL_CORRECTION: 'Correction'
};

const DISPLAY_TO_MOVEMENT_TYPE: Record<string, InventoryMovementType | InventoryMovementType[]> = {
  'Opening Balance': 'OPENING_BALANCE',
  Sale: 'SALE',
  Return: ['SALE_RETURN', 'CUSTOMER_RETURN'],
  'Goods Received': 'GOODS_RECEIVED',
  'Stock Adjustment': ['STOCK_ADJUSTMENT_IN', 'STOCK_ADJUSTMENT_OUT'],
  'Stocktake Adjustment': ['STOCKTAKE_ADJUSTMENT_IN', 'STOCKTAKE_ADJUSTMENT_OUT', 'STOCKTAKE_GAIN', 'STOCKTAKE_LOSS'],
  'Transfer In': ['TRANSFER_IN', 'BRANCH_TRANSFER_IN'],
  'Transfer Out': ['TRANSFER_OUT', 'BRANCH_TRANSFER_OUT'],
  'Supplier Return': 'SUPPLIER_RETURN',
  'Damage / Write-Off': ['DAMAGE_WRITEOFF', 'WRITE_OFF'],
  'Write Off': 'WRITE_OFF',
  Reversal: 'REVERSAL',
  Correction: 'MANUAL_CORRECTION'
};

function recordProductLedgerEvent(eventType: string, productId: string, message: string): void {
  try {
    const cached = localStorage.getItem(EVENT_KEY);
    const existing = cached ? JSON.parse(cached) as Array<Record<string, unknown>> : [];
    const event = {
      id: `PLE-${Date.now()}`,
      eventType,
      productId,
      message,
      createdAt: new Date().toISOString()
    };
    localStorage.setItem(EVENT_KEY, JSON.stringify([event, ...existing].slice(0, 100)));
  } catch {
    // localStorage may be unavailable.
  }
}

export function formatMovementTypeLabel(type: InventoryMovementType): string {
  return LEDGER_MOVEMENT_TYPE_MAP[type] || type.replaceAll('_', ' ');
}

function matchesMovementTypeFilter(
  movementType: InventoryMovementType,
  filterValue: ProductLedgerFilters['movementType']
): boolean {
  if (!filterValue || filterValue === 'ALL') return true;
  if (filterValue in DISPLAY_TO_MOVEMENT_TYPE) {
    const mapped = DISPLAY_TO_MOVEMENT_TYPE[filterValue];
    return Array.isArray(mapped) ? mapped.includes(movementType) : movementType === mapped;
  }
  return movementType === filterValue;
}

export async function getProductLedgerMovements(productId: string): Promise<InventoryMovement[]> {
  recordProductLedgerEvent('PRODUCT_LEDGER_OPENED', productId, 'Product ledger opened from inventory movements.');
  return getInventoryMovementsByProduct(productId);
}

/** @deprecated Use getProductLedgerMovements — kept for compatibility */
export async function getProductLedger(productId: string): Promise<ProductLedgerEntry[]> {
  const movements = await getProductLedgerMovements(productId);
  return movements.map(mapMovementToLegacyLedgerEntry);
}

export async function getProductLedgerBySku(sku: string): Promise<ProductLedgerEntry[]> {
  const movements = await getInventoryMovementsBySku(sku);
  if (movements[0]) {
    recordProductLedgerEvent('PRODUCT_LEDGER_OPENED', movements[0].productId, 'Product ledger opened by SKU.');
  }
  return movements.map(mapMovementToLegacyLedgerEntry);
}

function mapMovementToLegacyLedgerEntry(movement: InventoryMovement): ProductLedgerEntry {
  return {
    id: movement.movementId,
    vendorId: movement.vendorId,
    productId: movement.productId,
    sku: movement.sku,
    productNumericNumber: movement.productNumericNumber,
    alu: movement.alu,
    dateTime: movement.movementDate,
    movementType: formatMovementTypeLabel(movement.movementType) as ProductLedgerEntry['movementType'],
    referenceType: movement.referenceType.replaceAll('_', ' ') as ProductLedgerEntry['referenceType'],
    referenceNo: movement.referenceNumber,
    branch: movement.branchId,
    warehouse: movement.warehouseId,
    shelfLocation: movement.shelfLocation || 'N/A',
    qtyIn: movement.qtyIn,
    qtyOut: movement.qtyOut,
    balanceAfter: movement.balanceAfter,
    unitCost: movement.unitCost,
    sellingPrice: movement.sellingPrice,
    staffId: movement.staffId,
    staffName: movement.staffName,
    notes: movement.notes,
    riskFlag: movement.riskFlag
  };
}

export function filterLedgerMovements(
  entries: InventoryMovement[],
  filters: ProductLedgerFilters
): InventoryMovement[] {
  const fromTime = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`).getTime() : null;
  const toTime = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59`).getTime() : null;

  return entries.filter((entry) => {
    const entryTime = new Date(entry.movementDate).getTime();
    const matchesFrom = fromTime === null || entryTime >= fromTime;
    const matchesTo = toTime === null || entryTime <= toTime;
    const matchesBranch = !filters.branch || filters.branch === 'ALL' || entry.branchId === filters.branch;
    const matchesWarehouse = !filters.warehouse || filters.warehouse === 'ALL' || entry.warehouseId === filters.warehouse;
    const matchesShelf = !filters.shelfLocation || filters.shelfLocation === 'ALL' || entry.shelfLocation === filters.shelfLocation;
    const matchesMovement = matchesMovementTypeFilter(entry.movementType, filters.movementType);
    const matchesReference = !filters.referenceType || filters.referenceType === 'ALL' || entry.referenceType === filters.referenceType;
    const matchesStaff = !filters.staff || filters.staff === 'ALL' || entry.staffName === filters.staff;
    const matchesStatus = !filters.status || filters.status === 'ALL' || entry.status === filters.status;

    return matchesFrom && matchesTo && matchesBranch && matchesWarehouse && matchesShelf && matchesMovement && matchesReference && matchesStaff && matchesStatus;
  });
}

/** @deprecated Use filterLedgerMovements */
export function filterProductLedger(entries: ProductLedgerEntry[], filters: ProductLedgerFilters): ProductLedgerEntry[] {
  const fromTime = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`).getTime() : null;
  const toTime = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59`).getTime() : null;

  return entries.filter((entry) => {
    const entryTime = new Date(entry.dateTime).getTime();
    const matchesFrom = fromTime === null || entryTime >= fromTime;
    const matchesTo = toTime === null || entryTime <= toTime;
    const matchesBranch = !filters.branch || filters.branch === 'ALL' || entry.branch === filters.branch;
    const matchesWarehouse = !filters.warehouse || filters.warehouse === 'ALL' || entry.warehouse === filters.warehouse;
    const matchesShelf = !filters.shelfLocation || filters.shelfLocation === 'ALL' || entry.shelfLocation === filters.shelfLocation;
    const matchesMovement = !filters.movementType || filters.movementType === 'ALL' || entry.movementType === filters.movementType;
    const matchesReference = !filters.referenceType || filters.referenceType === 'ALL' || entry.referenceType === filters.referenceType;
    const matchesStaff = !filters.staff || filters.staff === 'ALL' || entry.staffName === filters.staff;

    return matchesFrom && matchesTo && matchesBranch && matchesWarehouse && matchesShelf && matchesMovement && matchesReference && matchesStaff;
  });
}

export function getLedgerSummaryFromMovements(entries: InventoryMovement[]): ProductLedgerSummary {
  const opening = entries.find((entry) => entry.movementType === 'OPENING_BALANCE') || entries[0];
  const closing = entries[entries.length - 1];

  return {
    openingBalance: opening?.balanceAfter ?? 0,
    totalQtyIn: entries.reduce((sum, entry) => sum + entry.qtyIn, 0),
    totalQtyOut: entries.reduce((sum, entry) => sum + entry.qtyOut, 0),
    closingBalance: closing?.balanceAfter ?? 0,
    salesMovements: entries.filter((entry) => entry.movementType === 'SALE').length,
    returnMovements: entries.filter((entry) => entry.movementType === 'SALE_RETURN' || entry.movementType === 'CUSTOMER_RETURN').length,
    goodsReceivedMovements: entries.filter((entry) => entry.movementType === 'GOODS_RECEIVED').length,
    adjustmentMovements: entries.filter(
      (entry) =>
        entry.movementType === 'STOCK_ADJUSTMENT_IN' ||
        entry.movementType === 'STOCK_ADJUSTMENT_OUT' ||
        entry.movementType === 'MANUAL_CORRECTION' ||
        entry.movementType === 'DAMAGE_WRITEOFF' ||
        entry.movementType === 'WRITE_OFF'
    ).length,
    stocktakeVariances: entries.filter(
      (entry) =>
        entry.movementType === 'STOCKTAKE_ADJUSTMENT_IN' ||
        entry.movementType === 'STOCKTAKE_ADJUSTMENT_OUT' ||
        entry.movementType === 'STOCKTAKE_GAIN' ||
        entry.movementType === 'STOCKTAKE_LOSS'
    ).length,
    transferMovements: entries.filter(
      (entry) => entry.movementType === 'TRANSFER_IN' || entry.movementType === 'TRANSFER_OUT' || entry.movementType === 'BRANCH_TRANSFER_IN' || entry.movementType === 'BRANCH_TRANSFER_OUT'
    ).length,
    lastMovementDate: closing?.movementDate || '',
    currentSystemQty: closing?.balanceAfter ?? 0
  };
}

/** @deprecated Use getLedgerSummaryFromMovements */
export function getProductLedgerSummary(entries: ProductLedgerEntry[]): ProductLedgerSummary {
  const openingEntry = entries.find((entry) => entry.movementType === 'Opening Balance') || entries[0];
  const closingEntry = entries[entries.length - 1];

  return {
    openingBalance: openingEntry?.balanceAfter ?? 0,
    totalQtyIn: entries.reduce((sum, entry) => sum + entry.qtyIn, 0),
    totalQtyOut: entries.reduce((sum, entry) => sum + entry.qtyOut, 0),
    closingBalance: closingEntry?.balanceAfter ?? 0,
    salesMovements: entries.filter((entry) => entry.movementType === 'Sale').length,
    returnMovements: entries.filter((entry) => entry.movementType === 'Return').length,
    goodsReceivedMovements: entries.filter((entry) => entry.movementType === 'Goods Received').length,
    adjustmentMovements: entries.filter(
      (entry) =>
        entry.movementType === 'Stock Adjustment' ||
        entry.movementType === 'Correction' ||
        entry.movementType === 'Damage / Write-Off'
    ).length,
    stocktakeVariances: entries.filter((entry) => entry.movementType === 'Stocktake Adjustment').length,
    transferMovements: entries.filter(
      (entry) => entry.movementType === 'Transfer In' || entry.movementType === 'Transfer Out'
    ).length,
    lastMovementDate: closingEntry?.dateTime || '',
    currentSystemQty: closingEntry?.balanceAfter ?? 0
  };
}

export async function exportProductLedgerPlaceholder(productId: string): Promise<{ message: string }> {
  recordProductLedgerEvent('PRODUCT_LEDGER_EXPORT_PREPARED', productId, 'Product ledger export prepared.');
  return { message: 'Product ledger export prepared.' };
}

export async function recordProductListEvent(eventType: string, message: string): Promise<void> {
  recordProductLedgerEvent(eventType, 'PRODUCT_LIST', message);
}

export type { InventoryMovementFilters };
