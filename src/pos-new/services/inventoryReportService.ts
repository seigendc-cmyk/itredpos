import {
  COAInventoryReportRow,
  GoodsReceivingLine,
  GoodsReceivingNote,
  InventoryMovement,
  InventoryReportColumn,
  InventoryReportDefinition,
  InventoryReportFilters,
  InventoryReportActivityEvent,
  InventoryReportPayload,
  InventoryReportRow,
  InventoryReportSummary,
  InventoryReportType,
  InventoryValueReportRow,
  MovementSummaryReportTotals,
  MovementSummaryRow,
  Product,
  ProductMasterRecord,
  RecommendedStockAction,
  ReorderRecommendationRow,
  ShelfLocationReportRow,
  StockAdjustment,
  StockAdjustmentLine,
  StockHealthRecommendation,
  StockValuationRow,
  StockHealthRow,
  StockMovementAuditRow,
  StocktakeLine,
  StocktakeSession,
  StockTransfer,
  StockTransferLine,
  SupplierReturn,
  SupplierReturnLine,
  SupplierPerformanceRow,
  SupplierStockReportRow
} from '../types/posTypes';
import { classifyMovementSpeed } from './stockHealthService';
import {
  mockGRNDelayRows,
  mockGoodsReceivingLines,
  mockGoodsReceivingNotes,
  mockInventoryReportActivityEvents,
  mockInventoryMovements,
  mockInventoryValueReportRows,
  mockProductLedgerEntries,
  mockProductMasterRecords,
  mockProductStockBalances,
  mockStockHealthRecommendations,
  mockStockHealthRows,
  mockStockAdjustments,
  mockStockAdjustmentLines,
  mockStockMovementAuditRows,
  mockStocktakeLines,
  mockStocktakeSessions,
  mockStockTransfers,
  mockStockTransferLines,
  mockSupplierReturnLines,
  mockSupplierReturns,
  mockSupplierPerformanceRows,
  mockTransferDelayRows
} from '../mock/mockPosData';
import {
  calculateReorderRecommendation,
  calculateStockHealthSeverity,
  calculateStockHealthStatus
} from '../utils/stockHealthUtils';
import { matchesFreeOrderSearch } from '../utils/searchUtils';

const REPORT_EVENT_KEY = 'sci_pos_inventory_report_events';

function productQty(product: Product): number {
  return product.qtyOnHand ?? product.stock ?? 0;
}

function productCost(product: Product): number {
  return product.costPrice ?? product.cost ?? 0;
}

function productPrice(product: Product): number {
  return product.sellingPrice ?? product.price ?? 0;
}

function filterMovementsByDate(movements: InventoryMovement[], filters: InventoryReportFilters): InventoryMovement[] {
  const fromTime = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`).getTime() : null;
  const toTime = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59`).getTime() : null;
  if (fromTime === null && toTime === null) return movements;

  return movements.filter((movement) => {
    const movementTime = new Date(movement.movementDate).getTime();
    const matchesFrom = fromTime === null || movementTime >= fromTime;
    const matchesTo = toTime === null || movementTime <= toTime;
    return matchesFrom && matchesTo;
  });
}

function productMatches(product: Product, filters: InventoryReportFilters): boolean {
  if (filters.branch && filters.branch !== 'ALL' && product.branch !== filters.branch && product.branchId !== filters.branch) return false;
  if (filters.warehouse && filters.warehouse !== 'ALL' && product.warehouse !== filters.warehouse && product.warehouseId !== filters.warehouse) return false;
  if (filters.industrialSector && filters.industrialSector !== 'ALL' && product.industrialSector !== filters.industrialSector) return false;
  if (filters.category && filters.category !== 'ALL' && (product.productCategory || product.category) !== filters.category) return false;
  if (filters.brand && filters.brand !== 'ALL' && product.brand !== filters.brand) return false;
  if (filters.supplier && filters.supplier !== 'ALL' && product.supplierName !== filters.supplier) return false;
  if (filters.shelfLocation && filters.shelfLocation !== 'ALL') {
    if (filters.shelfLocation === 'UNASSIGNED') {
      if (product.shelfLocation) return false;
    } else if (product.shelfLocation !== filters.shelfLocation) {
      return false;
    }
  }
  return true;
}

function movementsForProduct(product: Product, movements: InventoryMovement[]): InventoryMovement[] {
  return movements.filter((movement) => movement.productId === product.id);
}

function supplierRecommendedAction(
  lowStockItems: number,
  deadStockItems: number,
  supplierReturnCount: number,
  lastReceivedDate: string
): RecommendedStockAction {
  if (lowStockItems > 0) return 'Reorder';
  if (deadStockItems > 0) return 'Stop Reordering';
  if (supplierReturnCount >= 2) return 'Review Supplier Performance';
  if (lastReceivedDate === 'N/A') return 'Supplier Follow-Up';
  return 'No Action';
}

export async function getStockValuationReport(products: Product[], filters: InventoryReportFilters): Promise<StockValuationRow[]> {
  return products.filter((product) => productMatches(product, filters)).map((product) => {
    const qty = productQty(product);
    const cost = productCost(product);
    const price = productPrice(product);
    const totalCostValue = qty * cost;
    const totalSellingValue = qty * price;
    const marginValue = totalSellingValue - totalCostValue;
    return {
      numericNo: product.productNumericNumber || '',
      sku: product.sku || product.code,
      productName: product.productName || product.name,
      sector: product.industrialSector || 'General',
      brand: product.brand || 'N/A',
      supplier: product.supplierName || 'N/A',
      branch: product.branch || product.branchId || 'N/A',
      warehouse: product.warehouse || product.warehouseId || 'N/A',
      qtyOnHand: qty,
      unitCost: cost,
      sellingPrice: price,
      totalCostValue,
      totalSellingValue,
      marginValue,
      marginPct: totalSellingValue > 0 ? (marginValue / totalSellingValue) * 100 : 0,
      assetAccountCOA: product.assetAccountCOA || '1400-INVENTORY-ASSET',
      salesAccountCOA: product.salesAccountCOA || '4000-SALES-STOCK'
    };
  });
}

export async function getMovementSummaryReport(products: Product[], movements: InventoryMovement[], filters: InventoryReportFilters): Promise<MovementSummaryRow[]> {
  const scopedMovements = filterMovementsByDate(movements, filters);
  return products.filter((product) => productMatches(product, filters)).map((product) => {
    const rows = movementsForProduct(product, scopedMovements);
    const opening = rows.find((movement) => movement.movementType === 'OPENING_BALANCE')?.balanceAfter || 0;
    const closing = rows.at(-1)?.balanceAfter ?? productQty(product);
    const qtyIn = rows.reduce((sum, movement) => sum + movement.qtyIn, 0);
    const qtyOut = rows.reduce((sum, movement) => sum + movement.qtyOut, 0);
    return {
      productId: product.id,
      product: product.productName || product.name,
      openingBalance: opening,
      qtyIn,
      qtyOut,
      transferIn: rows.filter((movement) => movement.movementType === 'TRANSFER_IN').reduce((sum, movement) => sum + movement.qtyIn, 0),
      transferOut: rows.filter((movement) => movement.movementType === 'TRANSFER_OUT').reduce((sum, movement) => sum + movement.qtyOut, 0),
      returnsIn: rows.filter((movement) => movement.movementType === 'SALE_RETURN').reduce((sum, movement) => sum + movement.qtyIn, 0),
      supplierReturnsOut: rows.filter((movement) => movement.movementType === 'SUPPLIER_RETURN').reduce((sum, movement) => sum + movement.qtyOut, 0),
      adjustmentsIn: rows.filter((movement) => movement.movementType.includes('ADJUSTMENT_IN') || movement.movementType === 'MANUAL_CORRECTION').reduce((sum, movement) => sum + movement.qtyIn, 0),
      adjustmentsOut: rows.filter((movement) => movement.movementType.includes('ADJUSTMENT_OUT') || movement.movementType === 'DAMAGE_WRITEOFF' || movement.movementType === 'MANUAL_CORRECTION').reduce((sum, movement) => sum + movement.qtyOut, 0),
      closingBalance: closing,
      netMovement: qtyIn - qtyOut,
      risk: rows.some((movement) => movement.riskFlag === 'High' || movement.riskFlag === 'Critical') ? 'High' : 'Low'
    };
  });
}

export async function getMovementSummaryReportTotals(movements: InventoryMovement[], filters: InventoryReportFilters): Promise<MovementSummaryReportTotals> {
  const scopedMovements = filterMovementsByDate(movements, filters);
  const totalQtyIn = scopedMovements.reduce((sum, movement) => sum + movement.qtyIn, 0);
  const totalQtyOut = scopedMovements.reduce((sum, movement) => sum + movement.qtyOut, 0);
  return {
    totalQtyIn,
    totalQtyOut,
    netMovement: totalQtyIn - totalQtyOut,
    highRiskMovements: scopedMovements.filter((movement) => movement.riskFlag === 'High' || movement.riskFlag === 'Critical').length,
    reversalCount: scopedMovements.filter((movement) => movement.referenceNumber.startsWith('REV-') || movement.notes?.toLowerCase().includes('reversal')).length,
    pendingApprovalMovements: scopedMovements.filter((movement) => movement.status === 'Pending Approval').length
  };
}

export async function getShelfLocationReport(products: Product[], movements: InventoryMovement[], filters: InventoryReportFilters): Promise<ShelfLocationReportRow[]> {
  const scopedMovements = filterMovementsByDate(movements, filters);
  const grouped = new Map<string, Product[]>();
  products.filter((product) => productMatches(product, filters)).forEach((product) => {
    const shelf = product.shelfLocation || 'UNASSIGNED';
    grouped.set(shelf, [...(grouped.get(shelf) || []), product]);
  });

  return Array.from(grouped.entries()).map(([shelfLocation, shelfProducts]) => {
    const shelfMovements = scopedMovements.filter((movement) => movement.shelfLocation === shelfLocation || (!movement.shelfLocation && shelfLocation === 'UNASSIGNED'));
    return {
      shelfLocation,
      productsCount: shelfProducts.length,
      totalUnits: shelfProducts.reduce((sum, product) => sum + productQty(product), 0),
      totalCostValue: shelfProducts.reduce((sum, product) => sum + productQty(product) * productCost(product), 0),
      lowStockItems: shelfProducts.filter((product) => productQty(product) <= (product.reorderLevel ?? product.minStock) && productQty(product) > 0).length,
      outOfStockItems: shelfProducts.filter((product) => productQty(product) <= 0).length,
      varianceRiskItems: shelfMovements.filter((movement) => movement.movementType.includes('STOCKTAKE') || movement.movementType.includes('ADJUSTMENT')).length,
      lastStocktakeDate: shelfMovements.filter((movement) => movement.movementType.includes('STOCKTAKE')).at(-1)?.movementDate || 'N/A',
      recommendedAction: shelfLocation === 'UNASSIGNED' ? 'Check Shelf' : shelfProducts.some((product) => productQty(product) <= (product.reorderLevel ?? product.minStock)) ? 'Stocktake Required' : 'No Action'
    };
  });
}

export async function getCOAInventoryReport(products: Product[], movements: InventoryMovement[], filters: InventoryReportFilters): Promise<COAInventoryReportRow[]> {
  const scopedMovements = filterMovementsByDate(movements, filters);
  const rows: COAInventoryReportRow[] = [];
  const addAccount = (coaAccount: string, accountType: 'Asset' | 'Sales', accountProducts: Product[]) => {
    const relatedMovements = scopedMovements.filter((movement) => accountProducts.some((product) => product.id === movement.productId));
    rows.push({
      coaAccount,
      accountType,
      productsCount: accountProducts.length,
      totalUnits: accountProducts.reduce((sum, product) => sum + productQty(product), 0),
      totalCostValue: accountProducts.reduce((sum, product) => sum + productQty(product) * productCost(product), 0),
      totalSellingValue: accountProducts.reduce((sum, product) => sum + productQty(product) * productPrice(product), 0),
      movementCount: relatedMovements.length,
      lastMovementDate: relatedMovements.at(-1)?.movementDate || 'N/A'
    });
  };

  const filtered = products.filter((product) => productMatches(product, filters));
  Array.from(new Set(filtered.map((product) => product.assetAccountCOA || '1400-INVENTORY-ASSET'))).forEach((account) => {
    addAccount(account, 'Asset', filtered.filter((product) => (product.assetAccountCOA || '1400-INVENTORY-ASSET') === account));
  });
  Array.from(new Set(filtered.map((product) => product.salesAccountCOA || '4000-SALES-STOCK'))).forEach((account) => {
    addAccount(account, 'Sales', filtered.filter((product) => (product.salesAccountCOA || '4000-SALES-STOCK') === account));
  });
  return rows;
}

export async function getSupplierStockReport(products: Product[], movements: InventoryMovement[], filters: InventoryReportFilters): Promise<SupplierStockReportRow[]> {
  const scopedMovements = filterMovementsByDate(movements, filters);
  const grouped = new Map<string, Product[]>();
  products.filter((product) => productMatches(product, filters)).forEach((product) => {
    const supplier = product.supplierName || 'N/A';
    grouped.set(supplier, [...(grouped.get(supplier) || []), product]);
  });

  return Array.from(grouped.entries()).map(([supplier, supplierProducts]) => {
    const relatedMovements = scopedMovements.filter((movement) => supplierProducts.some((product) => product.id === movement.productId));
    const lowStockItems = supplierProducts.filter((product) => productQty(product) <= (product.reorderLevel ?? product.minStock) && productQty(product) > 0).length;
    const deadStockItems = supplierProducts.filter((product) => classifyMovementSpeed(product, relatedMovements) === 'Dead Stock').length;
    const supplierReturnCount = relatedMovements.filter((movement) => movement.movementType === 'SUPPLIER_RETURN').length;
    const lastReceivedDate = relatedMovements.filter((movement) => movement.movementType === 'GOODS_RECEIVED').at(-1)?.movementDate || 'N/A';
    return {
      supplier,
      productsCount: supplierProducts.length,
      totalUnits: supplierProducts.reduce((sum, product) => sum + productQty(product), 0),
      stockValueAtCost: supplierProducts.reduce((sum, product) => sum + productQty(product) * productCost(product), 0),
      lowStockItems,
      deadStockItems,
      lastReceivedDate,
      supplierReturnCount,
      recommendedAction: supplierRecommendedAction(lowStockItems, deadStockItems, supplierReturnCount, lastReceivedDate)
    };
  });
}

const RECOMMENDATION_KEY = 'sci_pos_inventory_recommendations';

function normalizeText(value?: string): string {
  return (value || '').trim().toLowerCase();
}

function getStoredRecommendations(): StockHealthRecommendation[] {
  try {
    const cached = localStorage.getItem(RECOMMENDATION_KEY);
    return cached ? JSON.parse(cached) as StockHealthRecommendation[] : [];
  } catch {
    return [];
  }
}

function saveStoredRecommendations(recommendations: StockHealthRecommendation[]): StockHealthRecommendation[] {
  try {
    localStorage.setItem(RECOMMENDATION_KEY, JSON.stringify(recommendations));
  } catch {
    // localStorage may be unavailable in test contexts.
  }
  return recommendations;
}

function recordReportEvent(eventType: string, message: string, reportType?: InventoryReportType, staffId = 'SYSTEM', notes?: string): void {
  try {
    const cached = localStorage.getItem(REPORT_EVENT_KEY);
    const events = cached ? JSON.parse(cached) as InventoryReportActivityEvent[] : [];
    localStorage.setItem(REPORT_EVENT_KEY, JSON.stringify([{
      id: `IRE-${Date.now()}`,
      eventType,
      reportType,
      message,
      staffId,
      notes,
      createdAt: new Date().toISOString()
    }, ...events].slice(0, 150)));
  } catch {
    // Report events are best-effort local placeholders.
  }
}

function rowMatchesFilters(row: StockHealthRow, filters: InventoryReportFilters = {}): boolean {
  const search = normalizeText(filters.search || filters.sku);
  const matchesSearch = !search || [
    row.sku,
    row.productName,
    row.brand,
    row.category,
    row.supplier,
    row.branchName,
    row.warehouseName,
    row.shelfLocation
  ].some((value) => normalizeText(String(value)).includes(search));
  const branchFilter = filters.branchId || filters.branch;
  const warehouseFilter = filters.warehouseId || filters.warehouse;
  return matchesSearch &&
    (!branchFilter || branchFilter === 'ALL' || row.branchId === branchFilter || row.branchName === branchFilter || row.branch === branchFilter) &&
    (!warehouseFilter || warehouseFilter === 'ALL' || row.warehouseId === warehouseFilter || row.warehouseName === warehouseFilter || row.warehouse === warehouseFilter) &&
    (!filters.locationType || filters.locationType === 'ALL' || row.locationType === filters.locationType) &&
    (!filters.category || filters.category === 'ALL' || row.category === filters.category) &&
    (!filters.supplier || filters.supplier === 'ALL' || row.supplier === filters.supplier) &&
    (!filters.stockHealthStatus || filters.stockHealthStatus === 'ALL' || row.stockHealthStatus === filters.stockHealthStatus) &&
    (!filters.severity || filters.severity === 'ALL' || row.severity === filters.severity);
}

function stockHealthRows(filters: InventoryReportFilters = {}): StockHealthRow[] {
  return mockStockHealthRows.map((row) => {
    const stockHealthStatus = row.stockHealthStatus || calculateStockHealthStatus(row);
    const severity = row.severity || calculateStockHealthSeverity({ ...row, stockHealthStatus });
    return {
      ...row,
      stockHealthStatus,
      severity,
      salesVelocity: row.salesVelocity ?? 0,
      recommendedAction: row.recommendedAction || 'No Action',
      notes: row.notes || calculateReorderRecommendation(row)
    };
  }).filter((row) => rowMatchesFilters(row, filters));
}

export async function getInventoryReportSummary(filters: InventoryReportFilters = {}): Promise<InventoryReportSummary> {
  const rows = stockHealthRows(filters);
  return {
    totalStockValue: rows.reduce((sum, row) => sum + (row.estimatedStockValue || 0), 0),
    lowStockItems: rows.filter((row) => row.stockHealthStatus === 'Low Stock' || row.stockHealthStatus === 'Reorder Required').length,
    outOfStockItems: rows.filter((row) => row.stockHealthStatus === 'Out Of Stock').length,
    deadStockItems: rows.filter((row) => row.stockHealthStatus === 'Dead Stock').length,
    slowMovingItems: rows.filter((row) => row.stockHealthStatus === 'Slow Moving').length,
    fastMovingItems: rows.filter((row) => row.stockHealthStatus === 'Fast Moving').length,
    overstockedItems: rows.filter((row) => row.stockHealthStatus === 'Overstocked').length,
    varianceRiskItems: rows.filter((row) => row.stockHealthStatus === 'Variance Risk').length,
    damagedHoldingQty: rows.reduce((sum, row) => sum + (row.qtyDamaged || 0), 0),
    returnHoldingQty: rows.reduce((sum, row) => sum + (row.qtyReturnHolding || 0), 0),
    inTransitQty: rows.reduce((sum, row) => sum + (row.qtyInTransit || 0), 0),
    reorderRecommendations: rows.filter((row) => row.stockHealthStatus === 'Reorder Required' || row.stockHealthStatus === 'Out Of Stock').length
  };
}

export async function getStockHealthRowsForReports(filters: InventoryReportFilters = {}): Promise<StockHealthRow[]> {
  return stockHealthRows(filters);
}

export async function getStockHealthRows(filters: InventoryReportFilters = {}): Promise<StockHealthRow[]> {
  return stockHealthRows(filters);
}

export async function getLowStockReport(filters: InventoryReportFilters = {}): Promise<StockHealthRow[]> {
  return stockHealthRows(filters).filter((row) => row.stockHealthStatus === 'Reorder Required' || row.stockHealthStatus === 'Low Stock');
}

export async function getOutOfStockReport(filters: InventoryReportFilters = {}): Promise<StockHealthRow[]> {
  return stockHealthRows(filters).filter((row) => row.stockHealthStatus === 'Out Of Stock');
}

export async function getDeadStockReport(filters: InventoryReportFilters = {}): Promise<StockHealthRow[]> {
  return stockHealthRows(filters).filter((row) => row.stockHealthStatus === 'Dead Stock');
}

export async function getSlowMovingReport(filters: InventoryReportFilters = {}): Promise<StockHealthRow[]> {
  return stockHealthRows(filters).filter((row) => row.stockHealthStatus === 'Slow Moving');
}

export async function getFastMovingReport(filters: InventoryReportFilters = {}): Promise<StockHealthRow[]> {
  return stockHealthRows(filters).filter((row) => row.stockHealthStatus === 'Fast Moving');
}

export async function getOverstockReport(filters: InventoryReportFilters = {}): Promise<StockHealthRow[]> {
  return stockHealthRows(filters).filter((row) => row.stockHealthStatus === 'Overstocked');
}

export async function getStockValueReport(filters: InventoryReportFilters = {}): Promise<InventoryValueReportRow[]> {
  const allowed = new Set(stockHealthRows(filters).map((row) => `${row.sku}-${row.branchName}-${row.warehouseName}`));
  return mockInventoryValueReportRows.filter((row) => allowed.has(`${row.sku}-${row.branch}-${row.warehouse}`) || allowed.size === 0);
}

export async function getVarianceRiskReport(filters: InventoryReportFilters = {}): Promise<StockHealthRow[]> {
  return stockHealthRows(filters).filter((row) => row.stockHealthStatus === 'Variance Risk' || row.severity === 'Critical');
}

export async function getReorderRecommendations(filters: InventoryReportFilters = {}): Promise<ReorderRecommendationRow[]> {
  return stockHealthRows(filters)
    .filter((row) => row.stockHealthStatus === 'Reorder Required' || row.stockHealthStatus === 'Out Of Stock')
    .map((row) => ({
      sku: row.sku,
      productName: row.productName,
      branch: row.branchName || row.branch,
      warehouse: row.warehouseName || row.warehouse,
      availableQty: row.qtyAvailable || 0,
      reorderLevel: row.reorderLevel,
      reorderQty: row.reorderQty || row.reorderLevel,
      preferredSupplier: row.supplier,
      salesVelocity: row.salesVelocity || 0,
      daysCover: (row.salesVelocity || 0) > 0 ? Math.floor((row.qtyAvailable || 0) / (row.salesVelocity || 1)) : 0,
      recommendation: calculateReorderRecommendation(row),
      priority: row.severity || 'Medium'
    }));
}

export async function getSupplierPerformanceReport(filters: InventoryReportFilters = {}): Promise<SupplierPerformanceRow[]> {
  return mockSupplierPerformanceRows.filter((row) => !filters.supplier || filters.supplier === 'ALL' || row.supplier === filters.supplier);
}

export async function getGRNDelayReport(filters: InventoryReportFilters = {}): Promise<import('../types/posTypes').GRNDelayRow[]> {
  return mockGRNDelayRows.filter((row) => !filters.supplier || filters.supplier === 'ALL' || row.supplier === filters.supplier);
}

export async function getTransferDelayReport(): Promise<import('../types/posTypes').TransferDelayRow[]> {
  return mockTransferDelayRows;
}

export async function getDamagedHoldingReport(filters: InventoryReportFilters = {}): Promise<StockHealthRow[]> {
  return stockHealthRows(filters).filter((row) => (row.qtyDamaged || 0) > 0 || row.stockHealthStatus === 'Damaged');
}

export async function getReturnHoldingReport(filters: InventoryReportFilters = {}): Promise<StockHealthRow[]> {
  return stockHealthRows(filters).filter((row) => (row.qtyReturnHolding || 0) > 0 || row.stockHealthStatus === 'Return Holding');
}

export async function getStockMovementAuditReport(filters: InventoryReportFilters = {}): Promise<StockMovementAuditRow[]> {
  return mockStockMovementAuditRows.filter((row) => {
    const search = normalizeText(filters.search || filters.sku);
    return (!search || [row.sku, row.productName, row.reference, row.notes].some((value) => normalizeText(value).includes(search))) &&
      (!filters.movementType || filters.movementType === 'ALL' || row.movementType === filters.movementType);
  });
}

export async function getInventoryRecommendations(filters: InventoryReportFilters = {}): Promise<StockHealthRecommendation[]> {
  const stored = getStoredRecommendations();
  const rows = [...stored, ...mockStockHealthRecommendations];
  return rows.filter((row) => {
    const search = normalizeText(filters.search || filters.sku);
    return !search || [row.sku, row.productName, row.title, row.description].some((value) => normalizeText(value).includes(search));
  });
}

function createRecommendationPlaceholder(payload: Partial<StockHealthRecommendation>, type: StockHealthRecommendation['recommendationType']): StockHealthRecommendation {
  const recommendation: StockHealthRecommendation = {
    recommendationId: `REC-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`,
    recommendationType: type,
    severity: payload.severity || 'Medium',
    productId: payload.productId,
    sku: payload.sku,
    productName: payload.productName,
    branchId: payload.branchId,
    warehouseId: payload.warehouseId,
    title: payload.title || type,
    description: payload.description || 'Inventory report recommendation placeholder created.',
    recommendedAction: payload.recommendedAction || type,
    relatedReportType: payload.relatedReportType || 'Inventory Summary',
    status: 'Open',
    createdAt: new Date().toISOString()
  };
  saveStoredRecommendations([recommendation, ...getStoredRecommendations()].slice(0, 100));
  recordReportEvent(`${type.toUpperCase().replaceAll(' ', '_')}_CREATED`, `${type} created.`, recommendation.relatedReportType);
  return recommendation;
}

export async function createPORecommendationPlaceholder(payload: Partial<StockHealthRecommendation>): Promise<StockHealthRecommendation> {
  return createRecommendationPlaceholder(payload, 'Create PO Recommendation');
}

export async function createStocktakeRecommendationPlaceholder(payload: Partial<StockHealthRecommendation>): Promise<StockHealthRecommendation> {
  return createRecommendationPlaceholder(payload, 'Stocktake Recommendation');
}

export async function createTransferRecommendationPlaceholder(payload: Partial<StockHealthRecommendation>): Promise<StockHealthRecommendation> {
  return createRecommendationPlaceholder(payload, 'Transfer Stock Recommendation');
}

export async function markRecommendationReviewed(recommendationId: string, staffId: string, notes: string): Promise<StockHealthRecommendation | null> {
  let reviewed: StockHealthRecommendation | null = null;
  const next = getStoredRecommendations().map((recommendation) => {
    if (recommendation.recommendationId !== recommendationId) return recommendation;
    reviewed = { ...recommendation, status: 'Reviewed' };
    return reviewed;
  });
  saveStoredRecommendations(next);
  recordReportEvent('INVENTORY_RECOMMENDATION_REVIEWED', `Recommendation ${recommendationId} reviewed.`, undefined, staffId, notes);
  return reviewed;
}

export async function getInventoryReportActivityEvents(): Promise<InventoryReportActivityEvent[]> {
  try {
    const cached = localStorage.getItem(REPORT_EVENT_KEY);
    const events = cached ? JSON.parse(cached) as InventoryReportActivityEvent[] : [];
    return [...events, ...mockInventoryReportActivityEvents].slice(0, 100);
  } catch {
    return mockInventoryReportActivityEvents;
  }
}

export async function exportInventoryReportPlaceholder(reportType: InventoryReportType, filters: InventoryReportFilters = {}): Promise<{ message: string; filters?: InventoryReportFilters }> {
  try {
    const cached = localStorage.getItem(REPORT_EVENT_KEY);
    const events = cached ? JSON.parse(cached) as Array<Record<string, unknown>> : [];
    localStorage.setItem(REPORT_EVENT_KEY, JSON.stringify([{
      id: `IRE-${Date.now()}`,
      eventType: 'INVENTORY_REPORT_EXPORT_PREPARED',
      reportType,
      createdAt: new Date().toISOString()
    }, ...events].slice(0, 100)));

    const biCached = localStorage.getItem('itred_pos_bi_events');
    const biEvents = biCached ? JSON.parse(biCached) as Array<Record<string, unknown>> : [];
    localStorage.setItem('itred_pos_bi_events', JSON.stringify([{
      id: `IRE-BI-${Date.now()}`,
      timestamp: new Date().toISOString(),
      eventType: 'INVENTORY_REPORT_EXPORT_PREPARED',
      operator: 'Inventory Reports',
      terminal: 'STOCK_CONTROL',
      payload: { reportType },
      severity: 'INFO'
    }, ...biEvents].slice(0, 150)));
  } catch {
    // Export placeholder event is best-effort locally.
  }
  return { message: `${reportType} export prepared.`, filters };
}

const reportColumns = {
  stockPosition: [
    { key: 'sku', label: 'SKU' },
    { key: 'productName', label: 'Product' },
    { key: 'brand', label: 'Brand' },
    { key: 'category', label: 'Category' },
    { key: 'branchName', label: 'Branch' },
    { key: 'warehouseName', label: 'Warehouse' },
    { key: 'shelfLocation', label: 'Shelf' },
    { key: 'qtyAvailable', label: 'Available', align: 'right' as const },
    { key: 'qtyOnHand', label: 'On Hand', align: 'right' as const },
    { key: 'reorderLevel', label: 'Reorder', align: 'right' as const },
    { key: 'stockHealthStatus', label: 'Status' },
    { key: 'severity', label: 'Risk' }
  ],
  movement: [
    { key: 'dateTime', label: 'Date / Time' },
    { key: 'sku', label: 'SKU' },
    { key: 'productName', label: 'Product' },
    { key: 'movementType', label: 'Movement Type' },
    { key: 'reference', label: 'Document No.' },
    { key: 'branch', label: 'Branch' },
    { key: 'warehouse', label: 'Warehouse' },
    { key: 'qtyIn', label: 'Qty In', align: 'right' as const },
    { key: 'qtyOut', label: 'Qty Out', align: 'right' as const },
    { key: 'balanceAfter', label: 'Balance', align: 'right' as const },
    { key: 'staff', label: 'Staff' },
    { key: 'risk', label: 'Risk' }
  ],
  adjustment: [
    { key: 'adjustmentNumber', label: 'Adjustment No.' },
    { key: 'adjustmentDate', label: 'Date' },
    { key: 'reason', label: 'Reason' },
    { key: 'riskLevel', label: 'Risk' },
    { key: 'status', label: 'Status' },
    { key: 'requestedByStaffName', label: 'Requested By' },
    { key: 'approvedByStaffName', label: 'Approved By' },
    { key: 'lineCount', label: 'Lines', align: 'right' as const },
    { key: 'valueImpact', label: 'Value Impact', align: 'right' as const }
  ],
  compactDoc: [
    { key: 'documentNumber', label: 'Document No.' },
    { key: 'date', label: 'Date' },
    { key: 'supplierName', label: 'Supplier' },
    { key: 'branchName', label: 'Branch' },
    { key: 'warehouseName', label: 'Warehouse' },
    { key: 'status', label: 'Status' },
    { key: 'lineCount', label: 'Lines', align: 'right' as const },
    { key: 'valueImpact', label: 'Value Impact', align: 'right' as const }
  ]
};

const inventoryReportDefinitions: InventoryReportDefinition[] = [
  { reportType: 'STOCK_ON_HAND', reportName: 'Stock On Hand Report', description: 'Shows current inventory by product, branch, warehouse, shelf, available quantity, on hand, damaged, in transit, reorder level, and value estimate.', category: 'Stock Position', requiredPermission: 'reports.view', defaultColumns: reportColumns.stockPosition, supportsPrint: true, supportsPdf: true, supportsCsvPlaceholder: true, riskLevel: 'Low', sortOrder: 1 },
  { reportType: 'LOW_STOCK', reportName: 'Low Stock Report', description: 'Shows products where available stock is below reorder level.', category: 'Stock Position', requiredPermission: 'reports.view', defaultColumns: reportColumns.stockPosition, supportsPrint: true, supportsPdf: true, supportsCsvPlaceholder: true, riskLevel: 'Medium', sortOrder: 2 },
  { reportType: 'OUT_OF_STOCK', reportName: 'Out of Stock Report', description: 'Shows products with zero available quantity.', category: 'Stock Position', requiredPermission: 'reports.view', defaultColumns: reportColumns.stockPosition, supportsPrint: true, supportsPdf: true, supportsCsvPlaceholder: true, riskLevel: 'High', sortOrder: 3 },
  { reportType: 'REORDER', reportName: 'Reorder Report', description: 'Shows products requiring reorder attention with preferred supplier and days-cover estimates.', category: 'Stock Position', requiredPermission: 'reports.view', defaultColumns: reportColumns.stockPosition, supportsPrint: true, supportsPdf: true, supportsCsvPlaceholder: true, riskLevel: 'Medium', sortOrder: 4 },
  { reportType: 'DAMAGED_HOLDING', reportName: 'Damaged / Holding Stock Report', description: 'Shows damaged, return holding, in transit, and review holding quantities.', category: 'Stock Position', requiredPermission: 'reports.view', defaultColumns: reportColumns.stockPosition, supportsPrint: true, supportsPdf: true, supportsCsvPlaceholder: true, riskLevel: 'Medium', sortOrder: 5 },
  { reportType: 'INVENTORY_MOVEMENT', reportName: 'Inventory Movement Report', description: 'Shows movement records by product, source document, movement type, quantity, staff, and date.', category: 'Movement and Control', requiredPermission: 'reports.view', defaultColumns: reportColumns.movement, supportsPrint: true, supportsPdf: true, supportsCsvPlaceholder: true, riskLevel: 'Medium', sortOrder: 6 },
  { reportType: 'PRODUCT_LEDGER', reportName: 'Product Ledger Report', description: 'Shows product ledger movement history with references, balances, staff, and risk flags.', category: 'Movement and Control', requiredPermission: 'reports.view', defaultColumns: reportColumns.movement, supportsPrint: true, supportsPdf: true, supportsCsvPlaceholder: true, riskLevel: 'Medium', sortOrder: 7 },
  { reportType: 'STOCK_ADJUSTMENT', reportName: 'Stock Adjustment Report', description: 'Shows stock adjustments by reason, risk, approval status, value impact, and posting status.', category: 'Movement and Control', requiredPermission: 'stockAdjustment.view', defaultColumns: reportColumns.adjustment, supportsPrint: true, supportsPdf: true, supportsCsvPlaceholder: true, riskLevel: 'High', sortOrder: 8 },
  { reportType: 'STOCKTAKE_VARIANCE', reportName: 'Stocktake Variance Report', description: 'Shows counted quantity versus system quantity, variance quantity, variance value, and risk.', category: 'Movement and Control', requiredPermission: 'stocktake.view', defaultColumns: reportColumns.compactDoc, supportsPrint: true, supportsPdf: true, supportsCsvPlaceholder: true, riskLevel: 'High', sortOrder: 9 },
  { reportType: 'STOCK_TRANSFER', reportName: 'Stock Transfer Report', description: 'Shows transfer documents, source/destination locations, quantities, status, and variances.', category: 'Movement and Control', requiredPermission: 'stockTransfer.view', defaultColumns: reportColumns.compactDoc, supportsPrint: true, supportsPdf: true, supportsCsvPlaceholder: true, riskLevel: 'Medium', sortOrder: 10 },
  { reportType: 'GOODS_RECEIVED', reportName: 'Goods Received Report', description: 'Shows goods receiving notes, suppliers, invoices, status, accepted quantities, and variance indicators.', category: 'Procurement', requiredPermission: 'goodsReceiving.view', defaultColumns: reportColumns.compactDoc, supportsPrint: true, supportsPdf: true, supportsCsvPlaceholder: true, riskLevel: 'Medium', sortOrder: 11 },
  { reportType: 'SUPPLIER_RETURNS', reportName: 'Supplier Returns Report', description: 'Shows supplier returns, return reasons, value impact, posting status, and credit note readiness.', category: 'Procurement', requiredPermission: 'supplierReturn.view', defaultColumns: reportColumns.compactDoc, supportsPrint: true, supportsPdf: true, supportsCsvPlaceholder: true, riskLevel: 'Medium', sortOrder: 12 },
  { reportType: 'DEAD_STOCK', reportName: 'Dead Stock Report', description: 'Shows products with no movement in the selected period.', category: 'Intelligence', requiredPermission: 'reports.view', defaultColumns: reportColumns.stockPosition, supportsPrint: true, supportsPdf: true, supportsCsvPlaceholder: true, riskLevel: 'Medium', sortOrder: 13 },
  { reportType: 'SLOW_MOVING', reportName: 'Slow Moving Report', description: 'Shows slow-moving stock based on local stock health intelligence.', category: 'Intelligence', requiredPermission: 'reports.view', defaultColumns: reportColumns.stockPosition, supportsPrint: true, supportsPdf: true, supportsCsvPlaceholder: true, riskLevel: 'Medium', sortOrder: 14 },
  { reportType: 'FAST_MOVING', reportName: 'Fast Moving Report', description: 'Shows fast-moving stock for replenishment and transfer planning.', category: 'Intelligence', requiredPermission: 'reports.view', defaultColumns: reportColumns.stockPosition, supportsPrint: true, supportsPdf: true, supportsCsvPlaceholder: true, riskLevel: 'Low', sortOrder: 15 },
  { reportType: 'STOCK_VALUATION', reportName: 'Stock Valuation Report', description: 'Shows inventory value using quantity and cost basis.', category: 'Intelligence', requiredPermission: 'reports.view', defaultColumns: [{ key: 'sku', label: 'SKU' }, { key: 'productName', label: 'Product' }, { key: 'branch', label: 'Branch' }, { key: 'warehouse', label: 'Warehouse' }, { key: 'qtyOnHand', label: 'Qty', align: 'right' }, { key: 'unitCost', label: 'Unit Cost', align: 'right' }, { key: 'estimatedStockValue', label: 'Value', align: 'right' }, { key: 'status', label: 'Status' }], supportsPrint: true, supportsPdf: true, supportsCsvPlaceholder: true, riskLevel: 'High', sortOrder: 16 },
  { reportType: 'INVENTORY_RISK', reportName: 'Inventory Risk Report', description: 'Shows high-risk stock records, variance risk, dead stock, and critical review recommendations.', category: 'Intelligence', requiredPermission: 'reports.view', defaultColumns: reportColumns.stockPosition, supportsPrint: true, supportsPdf: true, supportsCsvPlaceholder: true, riskLevel: 'High', sortOrder: 17 },
  { reportType: 'PRODUCT_MASTER_EXPORT', reportName: 'Product Master Export Report', description: 'Shows product master export readiness across SKU, barcode, ALU, supplier, sector, and status fields.', category: 'Master Data', requiredPermission: 'productMaster.view', defaultColumns: [{ key: 'sku', label: 'SKU' }, { key: 'barcode', label: 'Barcode' }, { key: 'alu', label: 'ALU' }, { key: 'productName', label: 'Product' }, { key: 'brand', label: 'Brand' }, { key: 'supplierName', label: 'Supplier' }, { key: 'industrialSector', label: 'Sector' }, { key: 'status', label: 'Status' }], supportsPrint: true, supportsPdf: true, supportsCsvPlaceholder: true, riskLevel: 'Low', sortOrder: 18 }
];

export function getInventoryReportDefinitions(): InventoryReportDefinition[] {
  return [...inventoryReportDefinitions].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getInventoryReportDefinition(reportType: InventoryReportType): InventoryReportDefinition {
  return getInventoryReportDefinitions().find((report) => report.reportType === reportType) || inventoryReportDefinitions[0];
}

export function getInventoryReportDefaultFilters(reportType: InventoryReportType): InventoryReportFilters {
  return { reportType, branch: 'ALL', warehouse: 'ALL', supplier: 'ALL', industrialSector: 'ALL', category: 'ALL', stockStatus: 'ALL', riskStatus: 'ALL', movementType: 'ALL', approvalStatus: 'ALL', includeZeroStock: true, includeInactive: false };
}

function asReportRow(rowId: string, values: Record<string, unknown>): InventoryReportRow {
  return { rowId, values: values as InventoryReportRow['values'] };
}

function reportSearchMatches(values: Record<string, unknown>, filters: InventoryReportFilters): boolean {
  const query = filters.searchQuery || filters.search || filters.sku || '';
  return matchesFreeOrderSearch(values, query, [
    'productName', 'sku', 'barcode', 'alu', 'brand', 'supplierName', 'industrialSector', 'category',
    'branchName', 'warehouseName', 'shelfLocation', 'movementType', 'documentNumber', 'reason', 'riskStatus', 'status'
  ]);
}

function filteredStockRows(filters: InventoryReportFilters, predicate: (row: StockHealthRow) => boolean = () => true): InventoryReportRow[] {
  return stockHealthRows(filters)
    .filter(predicate)
    .map((row) => asReportRow(row.productId || row.sku, { ...row, riskStatus: row.severity || row.riskLevel }))
    .filter((row) => reportSearchMatches(row.values, filters));
}

function movementRows(filters: InventoryReportFilters): InventoryReportRow[] {
  return mockStockMovementAuditRows
    .filter((row) => !filters.movementType || filters.movementType === 'ALL' || row.movementType === filters.movementType)
    .map((row, index) => asReportRow(`movement-${index}`, { ...row, dateTime: row.dateTime, documentNumber: row.reference, riskStatus: row.risk }))
    .filter((row) => reportSearchMatches(row.values, filters));
}

function productLedgerRows(filters: InventoryReportFilters): InventoryReportRow[] {
  return mockProductLedgerEntries
    .map((row) => asReportRow(row.id, { ...row, dateTime: row.dateTime, productName: row.sku, documentNumber: row.referenceNo, reference: row.referenceNo, risk: row.riskFlag, riskStatus: row.riskFlag, balanceAfter: row.balanceAfter }))
    .filter((row) => reportSearchMatches(row.values, filters));
}

function stockAdjustmentRows(filters: InventoryReportFilters): InventoryReportRow[] {
  return mockStockAdjustments
    .map((record: StockAdjustment) => {
      const lines = mockStockAdjustmentLines.filter((line: StockAdjustmentLine) => line.adjustmentId === record.adjustmentId);
      return asReportRow(record.adjustmentId, { ...record, documentNumber: record.adjustmentNumber, lineCount: lines.length, valueImpact: lines.reduce((sum, line) => sum + line.valueImpact, 0), riskStatus: record.riskLevel });
    })
    .filter((row) => reportSearchMatches(row.values, filters));
}

function stocktakeRows(filters: InventoryReportFilters): InventoryReportRow[] {
  return mockStocktakeSessions.map((session: StocktakeSession) => {
    const lines = mockStocktakeLines.filter((line: StocktakeLine) => line.stocktakeId === session.stocktakeId);
    return asReportRow(session.stocktakeId, { documentNumber: session.stocktakeNumber, date: session.createdAt.slice(0, 10), supplierName: '-', branchName: session.branchId, warehouseName: session.warehouseId, status: session.status, lineCount: lines.length, valueImpact: lines.reduce((sum, line) => sum + (line.valueVariance || 0), 0), riskStatus: lines.some((line) => line.varianceRisk === 'Critical') ? 'Critical' : 'Medium' });
  }).filter((row) => reportSearchMatches(row.values, filters));
}

function goodsReceivedRows(filters: InventoryReportFilters): InventoryReportRow[] {
  return mockGoodsReceivingNotes.map((note: GoodsReceivingNote) => {
    const lines = mockGoodsReceivingLines.filter((line: GoodsReceivingLine) => line.grnId === note.grnId);
    return asReportRow(note.grnId, { documentNumber: note.grnNumber, date: note.receivedDate, supplierName: note.supplierName, branchName: note.branchId, warehouseName: note.warehouseId, status: note.receivingStatus, lineCount: lines.length, valueImpact: note.supplierInvoiceAmount, riskStatus: note.approvalRequired ? 'High' : 'Low' });
  }).filter((row) => reportSearchMatches(row.values, filters));
}

function supplierReturnRows(filters: InventoryReportFilters): InventoryReportRow[] {
  return mockSupplierReturns.map((record: SupplierReturn) => {
    const lines = mockSupplierReturnLines.filter((line: SupplierReturnLine) => line.supplierReturnId === record.supplierReturnId);
    return asReportRow(record.supplierReturnId, { documentNumber: record.supplierReturnNumber, date: record.createdAt.slice(0, 10), supplierName: record.supplierName, branchName: record.branchId, warehouseName: record.warehouseId, status: record.status, lineCount: lines.length, valueImpact: lines.reduce((sum, line) => sum + line.lineTotal, 0), riskStatus: record.approvalRequired ? 'High' : 'Medium' });
  }).filter((row) => reportSearchMatches(row.values, filters));
}

function transferRows(filters: InventoryReportFilters): InventoryReportRow[] {
  return mockStockTransfers.map((record: StockTransfer) => {
    const lines = mockStockTransferLines.filter((line: StockTransferLine) => line.transferId === record.transferId);
    return asReportRow(record.transferId, { documentNumber: record.transferNumber, date: record.createdAt.slice(0, 10), supplierName: `${record.sourceBranchName} to ${record.destinationBranchName}`, branchName: record.sourceBranchName, warehouseName: record.sourceWarehouseName, status: record.status, lineCount: lines.length, valueImpact: lines.reduce((sum, line) => sum + line.valueImpact, 0), riskStatus: lines.some((line) => line.varianceType !== 'None') ? 'High' : 'Low' });
  }).filter((row) => reportSearchMatches(row.values, filters));
}

function valuationRows(filters: InventoryReportFilters): InventoryReportRow[] {
  return mockInventoryValueReportRows
    .map((row) => asReportRow(`${row.sku}-${row.branch}-${row.warehouse}`, { ...row, branchName: row.branch, warehouseName: row.warehouse, riskStatus: row.status }))
    .filter((row) => reportSearchMatches(row.values, filters));
}

function productMasterRows(filters: InventoryReportFilters): InventoryReportRow[] {
  return mockProductMasterRecords.map((record: ProductMasterRecord) => asReportRow(record.productId, { ...record, supplierName: record.supplierName || record.preferredSupplierName, status: record.productStatus || record.status, category: record.productCategory || record.category, riskStatus: record.riskStatus })).filter((row) => reportSearchMatches(row.values, filters));
}

async function reportRows(reportType: InventoryReportType, filters: InventoryReportFilters): Promise<InventoryReportRow[]> {
  switch (reportType) {
    case 'LOW_STOCK': return filteredStockRows(filters, (row) => row.stockHealthStatus === 'Low Stock' || row.stockHealthStatus === 'Reorder Required');
    case 'OUT_OF_STOCK': return filteredStockRows(filters, (row) => row.stockHealthStatus === 'Out Of Stock');
    case 'DEAD_STOCK': return filteredStockRows(filters, (row) => row.stockHealthStatus === 'Dead Stock');
    case 'SLOW_MOVING': return filteredStockRows(filters, (row) => row.stockHealthStatus === 'Slow Moving');
    case 'FAST_MOVING': return filteredStockRows(filters, (row) => row.stockHealthStatus === 'Fast Moving');
    case 'DAMAGED_HOLDING': return filteredStockRows(filters, (row) => (row.qtyDamaged || 0) > 0 || (row.qtyReturnHolding || 0) > 0 || row.stockHealthStatus === 'Damaged' || row.stockHealthStatus === 'Return Holding');
    case 'REORDER': return filteredStockRows(filters, (row) => row.stockHealthStatus === 'Reorder Required' || row.stockHealthStatus === 'Low Stock' || row.stockHealthStatus === 'Out Of Stock');
    case 'INVENTORY_RISK': return filteredStockRows(filters, (row) => row.severity === 'High' || row.severity === 'Critical' || row.stockHealthStatus === 'Variance Risk');
    case 'STOCK_VALUATION': return valuationRows(filters);
    case 'INVENTORY_MOVEMENT': return movementRows(filters);
    case 'PRODUCT_LEDGER': return productLedgerRows(filters);
    case 'STOCK_ADJUSTMENT': return stockAdjustmentRows(filters);
    case 'STOCKTAKE_VARIANCE': return stocktakeRows(filters);
    case 'GOODS_RECEIVED': return goodsReceivedRows(filters);
    case 'SUPPLIER_RETURNS': return supplierReturnRows(filters);
    case 'STOCK_TRANSFER': return transferRows(filters);
    case 'PRODUCT_MASTER_EXPORT': return productMasterRows(filters);
    case 'STOCK_ON_HAND':
    default: return filteredStockRows(filters);
  }
}

function summaryMetrics(rows: InventoryReportRow[]): Array<{ label: string; value: string | number }> {
  const valueTotal = rows.reduce((sum, row) => sum + Number(row.values.estimatedStockValue || row.values.valueImpact || 0), 0);
  return [
    { label: 'Rows', value: rows.length },
    { label: 'Value Impact', value: `USD ${valueTotal.toFixed(2)}` },
    { label: 'High Risk Rows', value: rows.filter((row) => ['High', 'Critical'].includes(String(row.values.riskStatus || row.values.risk || row.values.severity))).length }
  ];
}

export async function generateInventoryReport(reportType: InventoryReportType, filters: InventoryReportFilters = {}): Promise<InventoryReportPayload> {
  const definition = getInventoryReportDefinition(reportType);
  const mergedFilters = { ...getInventoryReportDefaultFilters(reportType), ...filters, reportType };
  const rows = await reportRows(reportType, mergedFilters);
  const payload: InventoryReportPayload = {
    reportId: `IR-${Date.now()}`,
    reportType,
    reportName: definition.reportName,
    vendorName: 'SCI / iTred Commerce POS',
    branchName: mergedFilters.branchName || mergedFilters.branch || mergedFilters.branchId || 'All Branches',
    warehouseName: mergedFilters.warehouseName || mergedFilters.warehouse || mergedFilters.warehouseId || 'All Warehouses',
    generatedAt: new Date().toISOString(),
    generatedBy: mergedFilters.staffId || 'Inventory Reports',
    filters: mergedFilters,
    summaryMetrics: summaryMetrics(rows),
    columns: definition.defaultColumns,
    rows,
    notes: 'Read-only local/mock inventory report. No stock, accounting, cashbook, payment, or product master changes were made.',
    status: rows.length > 0 ? 'Generated' : 'Empty'
  };
  recordReportEvent('INVENTORY_REPORT_GENERATED', `${definition.reportName} generated with ${rows.length} row(s).`, reportType, payload.generatedBy);
  return payload;
}

export const generateStockOnHandReport = (filters: InventoryReportFilters = {}) => generateInventoryReport('STOCK_ON_HAND', filters);
export const generateLowStockReport = (filters: InventoryReportFilters = {}) => generateInventoryReport('LOW_STOCK', filters);
export const generateOutOfStockReport = (filters: InventoryReportFilters = {}) => generateInventoryReport('OUT_OF_STOCK', filters);
export const generateDeadStockReport = (filters: InventoryReportFilters = {}) => generateInventoryReport('DEAD_STOCK', filters);
export const generateSlowMovingReport = (filters: InventoryReportFilters = {}) => generateInventoryReport('SLOW_MOVING', filters);
export const generateFastMovingReport = (filters: InventoryReportFilters = {}) => generateInventoryReport('FAST_MOVING', filters);
export const generateStockValuationReport = (filters: InventoryReportFilters = {}) => generateInventoryReport('STOCK_VALUATION', filters);
export const generateInventoryMovementReport = (filters: InventoryReportFilters = {}) => generateInventoryReport('INVENTORY_MOVEMENT', filters);
export const generateProductLedgerReport = (filters: InventoryReportFilters = {}) => generateInventoryReport('PRODUCT_LEDGER', filters);
export const generateStockAdjustmentReport = (filters: InventoryReportFilters = {}) => generateInventoryReport('STOCK_ADJUSTMENT', filters);
export const generateStocktakeVarianceReport = (filters: InventoryReportFilters = {}) => generateInventoryReport('STOCKTAKE_VARIANCE', filters);
export const generateGoodsReceivedReport = (filters: InventoryReportFilters = {}) => generateInventoryReport('GOODS_RECEIVED', filters);
export const generateSupplierReturnsReport = (filters: InventoryReportFilters = {}) => generateInventoryReport('SUPPLIER_RETURNS', filters);
export const generateStockTransferReport = (filters: InventoryReportFilters = {}) => generateInventoryReport('STOCK_TRANSFER', filters);
export const generateDamagedHoldingReport = (filters: InventoryReportFilters = {}) => generateInventoryReport('DAMAGED_HOLDING', filters);
export const generateReorderReport = (filters: InventoryReportFilters = {}) => generateInventoryReport('REORDER', filters);
export const generateInventoryRiskReport = (filters: InventoryReportFilters = {}) => generateInventoryReport('INVENTORY_RISK', filters);
export const generateProductMasterExportReport = (filters: InventoryReportFilters = {}) => generateInventoryReport('PRODUCT_MASTER_EXPORT', filters);

export function prepareInventoryReportPrintPayload(reportPayload: InventoryReportPayload): InventoryReportPayload {
  recordReportEvent('INVENTORY_REPORT_PRINT_PREPARED', `${reportPayload.reportName} print view prepared.`, reportPayload.reportType, reportPayload.generatedBy);
  return { ...reportPayload, status: 'Ready' };
}

export function recordInventoryReportSelected(reportType: InventoryReportType, staffId = 'Inventory Reports'): void {
  const definition = getInventoryReportDefinition(reportType);
  recordReportEvent('INVENTORY_REPORT_SELECTED', `${definition.reportName} selected.`, reportType, staffId);
}

export function markInventoryReportPrintedPlaceholder(reportPayload: InventoryReportPayload): InventoryReportPayload {
  recordReportEvent('INVENTORY_REPORT_PRINTED_PLACEHOLDER', `${reportPayload.reportName} printed through the device print dialog placeholder.`, reportPayload.reportType, reportPayload.generatedBy);
  return { ...reportPayload, status: 'Printed' };
}

export function prepareInventoryReportPdfPlaceholder(reportPayload: InventoryReportPayload): { message: string; payload: InventoryReportPayload; fileName: string } {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  recordReportEvent('INVENTORY_REPORT_PDF_PREPARED', `${reportPayload.reportName} PDF placeholder prepared.`, reportPayload.reportType, reportPayload.generatedBy);
  return {
    message: 'PDF download is prepared through the device print dialog. Choose "Save as PDF" from your printer options.',
    payload: { ...reportPayload, status: 'PdfPrepared' },
    fileName: `inventory-${reportPayload.reportType}-${stamp}.pdf`
  };
}

export function exportInventoryReportCsvPlaceholder(reportPayload: InventoryReportPayload): { message: string; fileName: string; csvText: string } {
  const header = reportPayload.columns.map((column) => column.label).join(',');
  const lines = reportPayload.rows.map((row) => reportPayload.columns.map((column) => JSON.stringify(row.values[column.key] ?? '')).join(','));
  const csvText = [header, ...lines].join('\n');
  recordReportEvent('INVENTORY_REPORT_CSV_EXPORTED_PLACEHOLDER', `${reportPayload.reportName} CSV placeholder prepared.`, reportPayload.reportType, reportPayload.generatedBy);
  return { message: `${reportPayload.reportName} CSV export placeholder prepared locally.`, fileName: `inventory-${reportPayload.reportType}.csv`, csvText };
}
