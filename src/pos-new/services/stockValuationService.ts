import { getInventoryBalance } from './inventorySyncService';
import { getProductMasterRecords } from './productMasterService';

export const STOCK_VALUATION_COLLECTION = 'inventory_valuation_snapshots';

export type StockCostingMethod = 'Weighted Average' | 'Last Purchase Cost' | 'Standard Cost';

export interface StockValuationOutput {
  vendorId: string;
  branchId: string;
  warehouseId: string;
  quantityOnHand: number;
  stockValue: number;
  costingMethod: StockCostingMethod;
  lastValuationAt: string;
  negativeStockFlag: boolean;
  costAuditRequired: boolean;
}

function nowIso(): string {
  return new Date().toISOString();
}

function productCost(product: Record<string, unknown>, method: StockCostingMethod, averageCost: number): number {
  if (method === 'Weighted Average') return averageCost || Number(product.averageCost || product.defaultCostPrice || 0);
  if (method === 'Last Purchase Cost') return Number(product.lastPurchaseCost || product.defaultCostPrice || 0);
  return Number(product.standardCost || product.defaultCostPrice || 0);
}

export async function calculateStockValuation(input: {
  vendorId: string;
  branchId: string;
  warehouseId: string;
  costingMethod?: StockCostingMethod;
}): Promise<StockValuationOutput> {
  const costingMethod = input.costingMethod || 'Weighted Average';
  const products = (await getProductMasterRecords({ warehouseId: input.warehouseId }))
    .filter((product) => product.vendorId === input.vendorId && product.productType !== 'Service' && product.productType !== 'Non-Stock');
  let quantityOnHand = 0;
  let stockValue = 0;
  let negativeStockFlag = false;
  let costAuditRequired = false;
  for (const product of products) {
    const balance = await getInventoryBalance({
      vendorId: input.vendorId,
      branchId: input.branchId,
      warehouseId: input.warehouseId,
      productId: product.productId
    }).catch(() => null);
    const qty = Number(balance?.quantityOnHand || 0);
    const unitCost = productCost(product as unknown as Record<string, unknown>, costingMethod, Number(balance?.averageCost || 0));
    quantityOnHand += qty;
    stockValue += qty * unitCost;
    negativeStockFlag = negativeStockFlag || qty < 0;
    costAuditRequired = costAuditRequired || unitCost < 0 || !Number.isFinite(unitCost);
  }
  return {
    vendorId: input.vendorId,
    branchId: input.branchId,
    warehouseId: input.warehouseId,
    quantityOnHand,
    stockValue: Number(stockValue.toFixed(2)),
    costingMethod,
    lastValuationAt: nowIso(),
    negativeStockFlag,
    costAuditRequired
  };
}
