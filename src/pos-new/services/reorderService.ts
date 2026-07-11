import { getAvailableStock } from './inventoryBalanceService';
import { getProductMasterRecords } from './productMasterService';

export const REORDER_RECOMMENDATION_COLLECTION = 'reorder_recommendations';

export type StockoutRisk = 'Low' | 'Medium' | 'High' | 'Critical';

export interface ReorderRecommendation {
  vendorId: string;
  warehouseId: string;
  productId: string;
  quantityOnHand: number;
  quantityAvailable: number;
  reorderLevel: number;
  maximumStock: number;
  recommendedOrderQty: number;
  preferredSupplierId?: string;
  averageDailySales: number;
  leadTimeDays: number;
  stockoutRisk: StockoutRisk;
  recommendationReason:
    | 'Low stock'
    | 'Out of stock'
    | 'Overstock'
    | 'Slow-moving stock'
    | 'No recent movement'
    | 'High stockout risk'
    | 'Reorder overdue';
}

function riskFor(quantityAvailable: number, reorderLevel: number): StockoutRisk {
  if (quantityAvailable <= 0) return 'Critical';
  if (reorderLevel > 0 && quantityAvailable <= reorderLevel * 0.5) return 'High';
  if (reorderLevel > 0 && quantityAvailable <= reorderLevel) return 'Medium';
  return 'Low';
}

export async function getReorderRecommendationsForWarehouse(input: {
  vendorId: string;
  branchId: string;
  warehouseId: string;
  averageDailySalesByProduct?: Record<string, number>;
  leadTimeDaysByProduct?: Record<string, number>;
}): Promise<ReorderRecommendation[]> {
  const products = (await getProductMasterRecords({ warehouseId: input.warehouseId }))
    .filter((product) => product.vendorId === input.vendorId && product.productType !== 'Service' && product.productType !== 'Non-Stock');
  const rows: ReorderRecommendation[] = [];
  for (const product of products) {
    const reorderLevel = Number(product.reorderLevel || product.reorderQty || 0);
    const maximumStock = Math.max(Number(product.reorderQty || 0) * 2, reorderLevel * 2);
    const balance = await getAvailableStock({
      vendorId: input.vendorId,
      branchId: input.branchId,
      warehouseId: input.warehouseId,
      productId: product.productId,
      reorderLevel
    }).catch(() => null);
    const quantityOnHand = balance?.quantityOnHand ?? 0;
    const quantityAvailable = balance?.quantityAvailable ?? 0;
    if (quantityAvailable > reorderLevel && quantityAvailable <= maximumStock) continue;
    const averageDailySales = input.averageDailySalesByProduct?.[product.productId] ?? 0;
    const leadTimeDays = input.leadTimeDaysByProduct?.[product.productId] ?? 7;
    const risk = riskFor(quantityAvailable, reorderLevel);
    rows.push({
      vendorId: input.vendorId,
      warehouseId: input.warehouseId,
      productId: product.productId,
      quantityOnHand,
      quantityAvailable,
      reorderLevel,
      maximumStock,
      recommendedOrderQty: Math.max(maximumStock - quantityAvailable, reorderLevel, 0),
      preferredSupplierId: product.preferredSupplierId,
      averageDailySales,
      leadTimeDays,
      stockoutRisk: risk,
      recommendationReason: quantityAvailable <= 0
        ? 'Out of stock'
        : quantityAvailable > maximumStock
          ? 'Overstock'
          : risk === 'High' || risk === 'Critical'
            ? 'High stockout risk'
            : 'Low stock'
    });
  }
  return rows;
}
