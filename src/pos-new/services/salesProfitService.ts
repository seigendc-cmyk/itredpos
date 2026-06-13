import { mockProducts, mockRecentSales } from '../mock/mockPosData';
import type {
  Product,
  Sale,
  SalesProfitSnapshotActivityEvent,
  SalesProfitSnapshotFilter,
  SalesProfitSnapshotPayload
} from '../types';

const ACTIVITY_KEY = 'itred_pos_sales_profit_snapshot_activity';

const today = new Date().toISOString().slice(0, 10);

function readActivity(): SalesProfitSnapshotActivityEvent[] {
  try {
    return JSON.parse(localStorage.getItem(ACTIVITY_KEY) || '[]') as SalesProfitSnapshotActivityEvent[];
  } catch {
    return [];
  }
}

function recordActivity(eventType: SalesProfitSnapshotActivityEvent['eventType'], message: string, staffId?: string): void {
  try {
    const next: SalesProfitSnapshotActivityEvent = {
      eventId: `SPS-${Date.now()}`,
      eventType,
      message,
      staffId,
      createdAt: new Date().toISOString()
    };
    localStorage.setItem(ACTIVITY_KEY, JSON.stringify([next, ...readActivity()].slice(0, 80)));
  } catch {
    // Local activity is best-effort only.
  }
}

export function getSalesProfitDefaultFilter(): SalesProfitSnapshotFilter {
  return {
    period: 'Today',
    dateFrom: today,
    dateTo: today,
    includeHeldSales: false,
    includeReturns: true,
    includeDeliveryFees: true,
    includeOpex: true
  };
}

function dateRangeForFilter(filter: SalesProfitSnapshotFilter): { dateFrom?: string; dateTo?: string } {
  const now = new Date();
  if (filter.period === 'Custom') return { dateFrom: filter.dateFrom, dateTo: filter.dateTo };
  if (filter.period === 'Today' || filter.period === 'Current Shift') return { dateFrom: today, dateTo: today };
  if (filter.period === 'This Week') {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    return { dateFrom: start.toISOString().slice(0, 10), dateTo: today };
  }
  if (filter.period === 'This Month') {
    return { dateFrom: `${today.slice(0, 7)}-01`, dateTo: today };
  }
  return { dateFrom: filter.dateFrom, dateTo: filter.dateTo };
}

function saleInRange(sale: Sale, dateFrom?: string, dateTo?: string): boolean {
  const saleDate = (sale.date || '').slice(0, 10);
  return (!dateFrom || saleDate >= dateFrom) && (!dateTo || saleDate <= dateTo);
}

export function calculateGrossSalesRevenue(sales: Sale[]): number {
  return sales.reduce((sum, sale) => sum + sale.total, 0);
}

export function calculateCOGS(sales: Sale[], products: Product[] = mockProducts): number {
  return sales.reduce((sum, sale) => sum + sale.items.reduce((lineSum, item) => {
    const product = products.find((row) => row.id === item.productId || row.sku === item.code || row.code === item.code);
    const costBasis = product?.costPrice ?? product?.cost ?? item.price * 0.62;
    return lineSum + costBasis * item.quantity;
  }, 0), 0);
}

export function calculateGrossProfit(grossSalesRevenue: number, cogs: number): number {
  return grossSalesRevenue - cogs;
}

export function calculateOpex(filter: SalesProfitSnapshotFilter): number {
  if (!filter.includeOpex) return 0;
  const periodFactor = filter.period === 'This Month' ? 18 : filter.period === 'This Week' ? 5 : 1;
  return 42.5 * periodFactor;
}

export function calculateNetDrawerProfit(grossProfit: number, opex: number): number {
  return grossProfit - opex;
}

export function generateSalesProfitSnapshot(
  filter: SalesProfitSnapshotFilter,
  sales: Sale[] = mockRecentSales,
  products: Product[] = mockProducts,
  generatedBy = 'Sales Terminal',
  context: { branchName?: string; terminalName?: string; cashierName?: string } = {}
): SalesProfitSnapshotPayload {
  const { dateFrom, dateTo } = dateRangeForFilter(filter);
  const completedSales = sales.filter((sale) =>
    String(sale.status).toUpperCase() === 'COMPLETED' &&
    saleInRange(sale, dateFrom, dateTo) &&
    (!filter.terminalId || sale.terminal === filter.terminalId) &&
    (!filter.cashierStaffId || sale.operator === filter.cashierStaffId)
  );
  const grossSalesRevenue = calculateGrossSalesRevenue(completedSales);
  const returnsValue = filter.includeReturns ? sales.filter((sale) => String(sale.status).toUpperCase().includes('RETURN')).reduce((sum, sale) => sum + sale.total, 0) : 0;
  const netSalesRevenue = grossSalesRevenue - returnsValue;
  const cogs = calculateCOGS(completedSales, products);
  const grossProfit = calculateGrossProfit(grossSalesRevenue, cogs);
  const opex = calculateOpex(filter);
  const netDrawerProfit = calculateNetDrawerProfit(grossProfit, opex);
  const itemCount = completedSales.reduce((sum, sale) => sum + sale.items.reduce((lineSum, item) => lineSum + item.quantity, 0), 0);
  const averageGrossMargin = grossSalesRevenue > 0 ? (grossProfit / grossSalesRevenue) * 100 : 0;
  const payload: SalesProfitSnapshotPayload = {
    snapshotId: `SPS-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    generatedBy,
    period: filter.period,
    dateFrom,
    dateTo,
    branchName: context.branchName || filter.branchId || 'All Branches',
    terminalName: context.terminalName || filter.terminalId || 'All Terminals',
    cashierName: context.cashierName || filter.cashierStaffId || 'All Cashiers',
    grossSalesRevenue,
    returnsValue,
    netSalesRevenue,
    cogs,
    grossProfit,
    opex,
    netDrawerProfit,
    salesCount: completedSales.length,
    itemCount,
    averageGrossMargin,
    notes: 'Local operational estimate only. No accounting, cashbook, inventory, sale, or receipt records were posted or mutated.',
    status: completedSales.length > 0 ? 'Generated' : 'Empty'
  };
  recordActivity('SALES_PROFIT_SNAPSHOT_GENERATED', `Sales Profit Snapshot generated for ${filter.period}.`, generatedBy);
  return payload;
}

export function getSalesProfitSnapshotActivityEvents(): SalesProfitSnapshotActivityEvent[] {
  return readActivity();
}

export function recordSalesProfitSnapshotPrintPlaceholder(staffId: string): void {
  recordActivity('SALES_PROFIT_SNAPSHOT_PRINT_PLACEHOLDER', 'Sales Profit Snapshot print prepared locally.', staffId);
}

export function recordSalesProfitSnapshotExportPlaceholder(staffId: string): void {
  recordActivity('SALES_PROFIT_SNAPSHOT_EXPORT_PLACEHOLDER', 'Sales Profit Snapshot export prepared locally.', staffId);
}
