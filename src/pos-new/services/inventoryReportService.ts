import {
  COAInventoryReportRow,
  InventoryMovement,
  InventoryReportFilters,
  InventoryReportActivityEvent,
  InventoryReportSummary,
  InventoryReportType,
  InventoryValueReportRow,
  MovementSummaryReportTotals,
  MovementSummaryRow,
  Product,
  RecommendedStockAction,
  ReorderRecommendationRow,
  ShelfLocationReportRow,
  StockHealthRecommendation,
  StockValuationRow,
  StockHealthRow,
  StockMovementAuditRow,
  SupplierPerformanceRow,
  SupplierStockReportRow
} from '../types/posTypes';
import { classifyMovementSpeed } from './stockHealthService';
import {
  mockGRNDelayRows,
  mockInventoryReportActivityEvents,
  mockInventoryValueReportRows,
  mockStockHealthRecommendations,
  mockStockHealthRows,
  mockStockMovementAuditRows,
  mockSupplierPerformanceRows,
  mockTransferDelayRows
} from '../mock/mockPosData';
import {
  calculateReorderRecommendation,
  calculateStockHealthSeverity,
  calculateStockHealthStatus
} from '../utils/stockHealthUtils';

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
