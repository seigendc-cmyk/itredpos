import {
  InventoryMovement,
  MovementClass,
  Product,
  RecommendedStockAction,
  StockHealthFilters,
  StockHealthRow,
  StockHealthSummary
} from '../types/posTypes';

const HEALTH_EVENT_KEY = 'itred_pos_bi_events';
const DAY_MS = 24 * 60 * 60 * 1000;

function nowTime(): number {
  return new Date('2026-06-09T12:00:00Z').getTime();
}

function daysSince(dateValue: string): number {
  return Math.max(0, Math.floor((nowTime() - new Date(dateValue).getTime()) / DAY_MS));
}

function recordHealthEvent(eventType: string, productName: string, severity: 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL'): void {
  try {
    const cached = localStorage.getItem(HEALTH_EVENT_KEY);
    const events = cached ? JSON.parse(cached) as Array<Record<string, unknown>> : [];
    localStorage.setItem(HEALTH_EVENT_KEY, JSON.stringify([{
      id: `HEALTH-${Date.now()}-${Math.floor(Math.random() * 999)}`,
      timestamp: new Date().toISOString(),
      eventType,
      operator: 'Stock Health',
      terminal: 'STOCK_CONTROL',
      payload: { productName },
      severity
    }, ...events].slice(0, 150)));
  } catch {
    // BI event writing is best-effort in local build-development.
  }
}

function getProductQty(product: Product): number {
  return product.qtyOnHand ?? product.stock ?? 0;
}

function getReorderLevel(product: Product): number {
  return product.reorderLevel ?? product.minStock ?? 0;
}

function filterMovementsByPeriod(movements: InventoryMovement[], filters: StockHealthFilters): InventoryMovement[] {
  const period = filters.movementPeriod || 'Last 30 Days';
  if (period === 'Custom') {
    const fromTime = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`).getTime() : null;
    const toTime = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59`).getTime() : null;
    return movements.filter((movement) => {
      const movementTime = new Date(movement.movementDate).getTime();
      const matchesFrom = fromTime === null || movementTime >= fromTime;
      const matchesTo = toTime === null || movementTime <= toTime;
      return matchesFrom && matchesTo;
    });
  }

  const maxDays = period === 'Today' ? 0
    : period === 'Last 7 Days' ? 7
    : period === 'Last 90 Days' ? 90
    : 30;

  return movements.filter((movement) => daysSince(movement.movementDate) <= maxDays);
}

function saleMovementsFor(product: Product, movements: InventoryMovement[]): InventoryMovement[] {
  return movements.filter((movement) => movement.productId === product.id && movement.movementType === 'SALE' && movement.status === 'Posted');
}

function receivedMovementsFor(product: Product, movements: InventoryMovement[]): InventoryMovement[] {
  return movements.filter((movement) => movement.productId === product.id && movement.movementType === 'GOODS_RECEIVED');
}

export function classifyMovementSpeed(product: Product, movements: InventoryMovement[], periodMovements?: InventoryMovement[]): MovementClass {
  const allSales = saleMovementsFor(product, movements);
  if (allSales.length === 0) return 'No Movement Data';

  const periodSales = periodMovements ? saleMovementsFor(product, periodMovements) : allSales;
  const salesLast7 = periodSales.filter((movement) => daysSince(movement.movementDate) <= 7).length;
  if (salesLast7 >= 2) return 'Fast Moving';

  const lastSale = allSales.reduce((latest, movement) => movement.movementDate > latest ? movement.movementDate : latest, allSales[0].movementDate);
  const days = daysSince(lastSale);
  if (days >= 90 && getProductQty(product) > 0) return 'Dead Stock';
  if (days >= 30) return 'Slow Moving';
  return 'Normal Moving';
}

export function getRecommendedStockAction(product: Product, movements: InventoryMovement[], periodMovements?: InventoryMovement[]): RecommendedStockAction {
  const qty = getProductQty(product);
  const reorderLevel = getReorderLevel(product);
  const movementClass = classifyMovementSpeed(product, movements, periodMovements);
  const hasVariance = movements.some((movement) =>
    movement.productId === product.id &&
    (movement.movementType.includes('STOCKTAKE') || movement.movementType.includes('ADJUSTMENT')) &&
    daysSince(movement.movementDate) <= 30
  );

  if (qty < 0) return 'Immediate Stock Review';
  if (qty <= 0) return 'Reorder / Stock Review';
  if (!product.shelfLocation) return 'Check Shelf';
  if (hasVariance) return 'Stocktake Required';
  if (qty <= reorderLevel) return 'Reorder';
  if (movementClass === 'Dead Stock') return 'Discount / Clearance';
  if (movementClass === 'Slow Moving') return 'Review Price';
  if (movementClass === 'Fast Moving') return 'Reorder';
  return 'No Action';
}

function buildHealthRow(product: Product, movements: InventoryMovement[], periodMovements: InventoryMovement[], emitEvents: boolean): StockHealthRow {
  const qty = getProductQty(product);
  const reorderLevel = getReorderLevel(product);
  const sales = saleMovementsFor(product, movements);
  const received = receivedMovementsFor(product, movements);
  const lastSaleDate = sales.length > 0
    ? sales.reduce((latest, movement) => movement.movementDate > latest ? movement.movementDate : latest, sales[0].movementDate)
    : '';
  const lastReceivedDate = received.length > 0
    ? received.reduce((latest, movement) => movement.movementDate > latest ? movement.movementDate : latest, received[0].movementDate)
    : '';
  const hasVariance = movements.some((movement) =>
    movement.productId === product.id &&
    (movement.movementType.includes('STOCKTAKE') || movement.movementType.includes('ADJUSTMENT')) &&
    daysSince(movement.movementDate) <= 30
  );
  const movementClass = classifyMovementSpeed(product, movements, periodMovements);
  const recommendedAction = getRecommendedStockAction(product, movements, periodMovements);

  let stockStatus = product.stockStatus || product.healthStatus || 'In Stock';
  let riskLevel: StockHealthRow['riskLevel'] = product.riskLevel || 'Low';

  if (qty < 0) {
    riskLevel = 'Critical';
    stockStatus = 'Variance Risk';
    if (emitEvents) recordHealthEvent('NEGATIVE_STOCK_ALERT', product.name, 'CRITICAL');
  } else if (qty <= 0) {
    stockStatus = 'Out of Stock';
    riskLevel = 'Critical';
    if (emitEvents) recordHealthEvent('OUT_OF_STOCK_ALERT', product.name, 'CRITICAL');
  } else if (qty <= reorderLevel) {
    stockStatus = 'Low Stock';
    riskLevel = riskLevel === 'Critical' ? 'Critical' : 'High';
    if (emitEvents) recordHealthEvent('LOW_STOCK_REMINDER', product.name, 'WARNING');
  }

  if (movementClass === 'Dead Stock') {
    stockStatus = 'Dead Stock';
    if (emitEvents) recordHealthEvent('DEAD_STOCK_WARNING', product.name, 'WARNING');
  }
  if (movementClass === 'Slow Moving' && stockStatus === 'In Stock') {
    stockStatus = 'Slow Moving';
    if (emitEvents) recordHealthEvent('SLOW_MOVING_STOCK_WARNING', product.name, 'WARNING');
  }
  if (movementClass === 'Fast Moving') {
    if (emitEvents) recordHealthEvent('FAST_MOVING_REORDER_RECOMMENDED', product.name, 'INFO');
  }
  if (hasVariance) {
    stockStatus = 'Variance Risk';
    riskLevel = riskLevel === 'Critical' ? 'Critical' : 'High';
    if (emitEvents) recordHealthEvent('VARIANCE_RISK_FOUND', product.name, 'HIGH');
  }
  if (!product.shelfLocation) {
    riskLevel = riskLevel === 'Critical' || riskLevel === 'High' ? riskLevel : 'Medium';
    if (emitEvents) recordHealthEvent('MISSING_SHELF_LOCATION', product.name, 'WARNING');
  }

  return {
    productId: product.id,
    numericNo: product.productNumericNumber || '',
    sku: product.sku || product.code,
    alu: product.alu || '',
    productName: product.productName || product.name,
    sector: product.industrialSector || 'General',
    category: product.productCategory || product.category,
    brand: product.brand || 'N/A',
    supplier: product.supplierName || 'N/A',
    branch: product.branch || product.branchId || 'N/A',
    warehouse: product.warehouse || product.warehouseId || 'N/A',
    shelfLocation: product.shelfLocation || '',
    qtyOnHand: qty,
    reorderLevel,
    lastSaleDate,
    lastReceivedDate,
    daysSinceLastSale: lastSaleDate ? daysSince(lastSaleDate) : null,
    stockStatus,
    movementClass,
    riskLevel,
    recommendedAction
  };
}

function matchesFilters(product: Product, filters: StockHealthFilters): boolean {
  if (filters.includeSerialized === false && product.isSerialized) return false;
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

export async function getStockHealthRows(products: Product[], movements: InventoryMovement[], filters: StockHealthFilters): Promise<StockHealthRow[]> {
  const periodMovements = filterMovementsByPeriod(movements, filters);
  const rows = products
    .filter((product) => matchesFilters(product, filters))
    .map((product) => buildHealthRow(product, movements, periodMovements, false));

  return rows.filter((row) => {
    if (filters.stockStatus && filters.stockStatus !== 'ALL' && row.stockStatus !== filters.stockStatus) return false;
    if (filters.riskLevel && filters.riskLevel !== 'ALL' && row.riskLevel !== filters.riskLevel) return false;
    return true;
  });
}

export async function getStockHealthSummary(products: Product[], movements: InventoryMovement[], filters: StockHealthFilters): Promise<StockHealthSummary> {
  const rows = await getStockHealthRows(products, movements, filters);
  return {
    totalProducts: rows.length,
    totalStockUnits: rows.reduce((sum, row) => sum + row.qtyOnHand, 0),
    inventoryValueAtCost: rows.reduce((sum, row) => {
      const product = products.find((item) => item.id === row.productId);
      return sum + row.qtyOnHand * (product?.costPrice ?? product?.cost ?? 0);
    }, 0),
    inventoryValueAtSellingPrice: rows.reduce((sum, row) => {
      const product = products.find((item) => item.id === row.productId);
      return sum + row.qtyOnHand * (product?.sellingPrice ?? product?.price ?? 0);
    }, 0),
    lowStockItems: rows.filter((row) => row.stockStatus === 'Low Stock').length,
    outOfStockItems: rows.filter((row) => row.stockStatus === 'Out of Stock').length,
    deadStockItems: rows.filter((row) => row.movementClass === 'Dead Stock' || row.stockStatus === 'Dead Stock').length,
    slowMovingItems: rows.filter((row) => row.movementClass === 'Slow Moving' || row.stockStatus === 'Slow Moving').length,
    fastMovingItems: rows.filter((row) => row.movementClass === 'Fast Moving' || row.stockStatus === 'Fast Moving').length,
    varianceRiskItems: rows.filter((row) => row.stockStatus === 'Variance Risk' || row.recommendedAction === 'Stocktake Required').length,
    serializedItems: products.filter((product) => product.isSerialized).length,
    productsWithoutShelfLocation: rows.filter((row) => !row.shelfLocation).length
  };
}

export async function evaluateStockHealth(products: Product[], movements: InventoryMovement[], filters: StockHealthFilters): Promise<{ rows: StockHealthRow[]; summary: StockHealthSummary }> {
  const periodMovements = filterMovementsByPeriod(movements, filters);
  const rows = products
    .filter((product) => matchesFilters(product, filters))
    .map((product) => buildHealthRow(product, movements, periodMovements, true))
    .filter((row) => {
      if (filters.stockStatus && filters.stockStatus !== 'ALL' && row.stockStatus !== filters.stockStatus) return false;
      if (filters.riskLevel && filters.riskLevel !== 'ALL' && row.riskLevel !== filters.riskLevel) return false;
      return true;
    });

  recordHealthEvent('STOCK_HEALTH_EVALUATED', 'Inventory health set', 'INFO');

  const summary: StockHealthSummary = {
    totalProducts: rows.length,
    totalStockUnits: rows.reduce((sum, row) => sum + row.qtyOnHand, 0),
    inventoryValueAtCost: rows.reduce((sum, row) => {
      const product = products.find((item) => item.id === row.productId);
      return sum + row.qtyOnHand * (product?.costPrice ?? product?.cost ?? 0);
    }, 0),
    inventoryValueAtSellingPrice: rows.reduce((sum, row) => {
      const product = products.find((item) => item.id === row.productId);
      return sum + row.qtyOnHand * (product?.sellingPrice ?? product?.price ?? 0);
    }, 0),
    lowStockItems: rows.filter((row) => row.stockStatus === 'Low Stock').length,
    outOfStockItems: rows.filter((row) => row.stockStatus === 'Out of Stock').length,
    deadStockItems: rows.filter((row) => row.movementClass === 'Dead Stock' || row.stockStatus === 'Dead Stock').length,
    slowMovingItems: rows.filter((row) => row.movementClass === 'Slow Moving' || row.stockStatus === 'Slow Moving').length,
    fastMovingItems: rows.filter((row) => row.movementClass === 'Fast Moving' || row.stockStatus === 'Fast Moving').length,
    varianceRiskItems: rows.filter((row) => row.stockStatus === 'Variance Risk' || row.recommendedAction === 'Stocktake Required').length,
    serializedItems: products.filter((product) => product.isSerialized).length,
    productsWithoutShelfLocation: rows.filter((row) => !row.shelfLocation).length
  };

  return { rows, summary };
}
