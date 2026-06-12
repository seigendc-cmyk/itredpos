import {
  InventoryReportType,
  ProductStockBalance,
  StockHealthRecommendation,
  StockHealthRow,
  StockHealthSeverity,
  StockHealthStatus
} from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_NOW = new Date('2026-06-12T12:00:00Z').getTime();

export const STOCK_HEALTH_DEFAULTS = {
  deadStockDays: 90,
  slowMovingDays: 60,
  fastMovingMovementThreshold: 20,
  highVarianceThreshold: 5,
  criticalVarianceValueThreshold: 300
};

export function calculateAvailableQty(balance: ProductStockBalance): number {
  return Math.max(
    0,
    balance.qtyOnHand -
      balance.qtyReserved -
      balance.qtyDamaged -
      (balance.qtyReturnHolding || 0) -
      (balance.qtyBlocked || 0)
  );
}

export function calculateDaysSinceLastMovement(row: Pick<StockHealthRow, 'lastMovementDate'>): number {
  if (!row.lastMovementDate) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor((DEFAULT_NOW - new Date(row.lastMovementDate).getTime()) / DAY_MS));
}

export function calculateSalesVelocity(row: Pick<StockHealthRow, 'movementCount'>): number {
  return Number(((row.movementCount || 0) / 30).toFixed(2));
}

export function calculateDeadStockFlag(row: StockHealthRow, deadStockDays = STOCK_HEALTH_DEFAULTS.deadStockDays): boolean {
  return (row.qtyAvailable || 0) > 0 && calculateDaysSinceLastMovement(row) >= deadStockDays;
}

export function calculateSlowMovingFlag(row: StockHealthRow, slowMovingDays = STOCK_HEALTH_DEFAULTS.slowMovingDays): boolean {
  return (row.qtyAvailable || 0) > 0 && calculateDaysSinceLastMovement(row) >= slowMovingDays && (row.movementCount || 0) <= 2;
}

export function calculateFastMovingFlag(row: StockHealthRow, threshold = STOCK_HEALTH_DEFAULTS.fastMovingMovementThreshold): boolean {
  return (row.movementCount || 0) >= threshold || (row.salesVelocity || 0) >= 1;
}

export function calculateOverstockFlag(row: StockHealthRow): boolean {
  const reorderQty = row.reorderQty || Math.max(1, row.reorderLevel * 2);
  return (row.qtyAvailable || 0) > reorderQty * 2;
}

export function calculateVarianceRiskScore(row: StockHealthRow): number {
  let score = 0;
  if (row.stockStatus === 'Variance Risk' || row.stockHealthStatus === 'Variance Risk') score += 5;
  if ((row.notes || '').toLowerCase().includes('variance')) score += 3;
  if ((row.qtyDamaged || 0) > 0) score += 2;
  if ((row.qtyReturnHolding || 0) > 0) score += 1;
  return score;
}

export function calculateStockHealthStatus(row: StockHealthRow): StockHealthStatus {
  if ((row.qtyDamaged || 0) > 0) return 'Damaged';
  if ((row.qtyReturnHolding || 0) > 0) return 'Return Holding';
  if ((row.qtyAvailable || 0) <= 0) return 'Out Of Stock';
  if ((row.qtyAvailable || 0) <= row.reorderLevel) return 'Reorder Required';
  if (calculateVarianceRiskScore(row) >= STOCK_HEALTH_DEFAULTS.highVarianceThreshold) return 'Variance Risk';
  if (calculateDeadStockFlag(row)) return 'Dead Stock';
  if (calculateSlowMovingFlag(row)) return 'Slow Moving';
  if (calculateFastMovingFlag(row)) return 'Fast Moving';
  if (calculateOverstockFlag(row)) return 'Overstocked';
  return 'Healthy';
}

export function calculateStockHealthSeverity(row: StockHealthRow): StockHealthSeverity {
  const status = row.stockHealthStatus || calculateStockHealthStatus(row);
  if (status === 'Out Of Stock' || status === 'Variance Risk') return 'Critical';
  if (status === 'Damaged' || status === 'Return Holding' || status === 'Reorder Required') return 'High';
  if (status === 'Dead Stock' || status === 'Slow Moving' || status === 'Overstocked') return 'Medium';
  if (status === 'Low Stock' || status === 'Fast Moving') return 'Low';
  return 'Info';
}

export function calculateReorderRecommendation(row: StockHealthRow): string {
  if ((row.qtyAvailable || 0) <= 0) return `Create PO recommendation for ${row.reorderQty || row.reorderLevel || 1} units.`;
  if ((row.qtyAvailable || 0) <= row.reorderLevel) return `Reorder ${row.reorderQty || row.reorderLevel} units from preferred supplier.`;
  if ((row.qtyInTransit || 0) > 0) return 'Monitor in-transit stock before creating PO.';
  return 'No reorder required.';
}

export function formatStockHealthStatus(status: StockHealthStatus): string {
  return status;
}

export function formatInventoryReportType(reportType: InventoryReportType): string {
  return reportType;
}

export function recommendationFromHealthRow(row: StockHealthRow, type: StockHealthRecommendation['recommendationType']): StockHealthRecommendation {
  return {
    recommendationId: `REC-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`,
    recommendationType: type,
    severity: row.severity || calculateStockHealthSeverity(row),
    productId: row.productId,
    sku: row.sku,
    productName: row.productName,
    branchId: row.branchId,
    warehouseId: row.warehouseId,
    title: `${type}: ${row.productName}`,
    description: row.notes || `${row.productName} requires inventory review.`,
    recommendedAction: row.recommendedAction,
    relatedReportType: row.stockHealthStatus === 'Variance Risk' ? 'Variance Risk' : 'Inventory Summary',
    status: 'Open',
    createdAt: new Date().toISOString()
  };
}
