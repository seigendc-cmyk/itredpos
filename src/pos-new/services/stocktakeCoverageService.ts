import { getProductMasterRecords } from './productMasterService';
import { getStocktakeLines, getStocktakeSessions } from './stocktakeService';

export interface StocktakeCoverageResult {
  warehouseId: string;
  totalProducts: number;
  productsCountedThisPeriod: number;
  coveragePercentage: number;
  overdueProducts: string[];
  highRiskProductsNotCounted: string[];
  nextRecommendedCountDate: string;
  message: 'Stocktake coverage complete' | 'Stocktake overdue' | 'High-risk items need counting' | 'Monthly coverage below target';
}

function addDays(date: Date, days: number): string {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

export async function getStocktakeCoverage(input: {
  vendorId: string;
  warehouseId: string;
  periodFrom: string;
  periodTo: string;
  targetCoveragePercentage?: number;
}): Promise<StocktakeCoverageResult> {
  const products = (await getProductMasterRecords({ warehouseId: input.warehouseId })).filter((product) => product.vendorId === input.vendorId && product.productType !== 'Non-Stock' && product.productType !== 'Service');
  const sessions = (await getStocktakeSessions({ warehouse: input.warehouseId })).filter((session) => (
    session.vendorId === input.vendorId &&
    session.warehouseId === input.warehouseId &&
    session.status === 'Posted' &&
    (session.postedAt || session.updatedAt).slice(0, 10) >= input.periodFrom &&
    (session.postedAt || session.updatedAt).slice(0, 10) <= input.periodTo
  ));
  const counted = new Set<string>();
  for (const session of sessions) {
    (await getStocktakeLines(session.stocktakeId)).forEach((line) => {
      if (line.lineStatus === 'Posted' || line.countedQty !== null) counted.add(line.productId);
    });
  }
  const totalProducts = products.length;
  const productsCountedThisPeriod = products.filter((product) => counted.has(product.productId)).length;
  const coveragePercentage = totalProducts > 0 ? Number(((productsCountedThisPeriod / totalProducts) * 100).toFixed(2)) : 100;
  const highRiskProductsNotCounted = products
    .filter((product) => !counted.has(product.productId) && product.riskStatus !== 'None' && product.riskStatus !== 'Normal')
    .map((product) => product.productId);
  const overdueProducts = products.filter((product) => !counted.has(product.productId)).map((product) => product.productId);
  const target = input.targetCoveragePercentage ?? 95;
  const message = coveragePercentage >= 100
    ? 'Stocktake coverage complete'
    : highRiskProductsNotCounted.length > 0
      ? 'High-risk items need counting'
      : coveragePercentage < target
        ? 'Monthly coverage below target'
        : 'Stocktake overdue';
  return {
    warehouseId: input.warehouseId,
    totalProducts,
    productsCountedThisPeriod,
    coveragePercentage,
    overdueProducts,
    highRiskProductsNotCounted,
    nextRecommendedCountDate: highRiskProductsNotCounted.length > 0 ? addDays(new Date(), 1) : addDays(new Date(), 7),
    message
  };
}
