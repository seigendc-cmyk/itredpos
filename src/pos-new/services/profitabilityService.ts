import type { ProfitabilitySummary, ProfitabilityViewMode } from '../types/posTypes';
import { getFinancialActivityRecords } from './financialControlService';

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (offset: number) => {
  const date = new Date();
  date.setDate(date.getDate() - offset);
  return date.toISOString().slice(0, 10);
};

export async function getProfitabilitySummary(mode: ProfitabilityViewMode = 'HybridManagement'): Promise<ProfitabilitySummary> {
  const activities = await getFinancialActivityRecords();
  const salesReceipts = activities.filter((row) => row.type.includes('Sale') || row.type.includes('Receipt'));
  const grossSales = Math.max(1265, salesReceipts.reduce((total, row) => total + Math.max(0, row.amount), 0));
  const discounts = 48;
  const returns = activities.filter((row) => row.type === 'Return' || row.type === 'Refund').reduce((total, row) => total + row.amount, 0);
  const netSales = grossSales - discounts - returns;
  const cogs = Math.max(410, activities.filter((row) => row.type.includes('COGS')).reduce((total, row) => total + row.amount, 0));
  const operatingExpenses = 185;
  const drawerExpenses = Math.abs(activities.filter((row) => row.type === 'DrawerExpense').reduce((total, row) => total + row.cashImpact, 0));
  const deliveryCosts = 75;
  const cashShortages = mode === 'CashBasis' ? 16 : 0;
  const adjustments = activities.filter((row) => row.type === 'Adjustment').reduce((total, row) => total + row.profitImpact, 0);
  const grossProfit = netSales - cogs;
  const netOperatingProfit = grossProfit - operatingExpenses - drawerExpenses - deliveryCosts - cashShortages + adjustments;
  const cashSales = activities.reduce((total, row) => total + Math.max(0, row.cashImpact) + Math.max(0, row.bankImpact), 0);
  const creditSales = activities.filter((row) => row.type === 'CreditSaleReceivable').reduce((total, row) => total + row.amount, 0);
  const debtorCollections = activities.filter((row) => row.type === 'DebtorPaymentReceipt').reduce((total, row) => total + row.amount, 0);
  return {
    periodFrom: daysAgo(7),
    periodTo: today(),
    grossSales,
    discounts,
    returns,
    netSales,
    cogs,
    grossProfit,
    operatingExpenses,
    drawerExpenses,
    deliveryCosts,
    cashShortages,
    adjustments,
    netOperatingProfit,
    cashSales,
    creditSales,
    debtorCollections,
    cashProfitIndicator: cashSales + debtorCollections - cogs - operatingExpenses - drawerExpenses - deliveryCosts,
    accrualProfitIndicator: netOperatingProfit + creditSales,
    grossMarginPercent: netSales ? (grossProfit / netSales) * 100 : 0,
    netMarginPercent: netSales ? (netOperatingProfit / netSales) * 100 : 0,
    generatedAt: new Date().toISOString()
  };
}

export async function getProfitabilityDrivers() {
  const summary = await getProfitabilitySummary();
  return [
    { label: 'Gross margin health', value: `${summary.grossMarginPercent.toFixed(1)}%`, status: summary.grossMarginPercent >= 35 ? 'Good' : 'Review' },
    { label: 'Net margin after controls', value: `${summary.netMarginPercent.toFixed(1)}%`, status: summary.netMarginPercent >= 15 ? 'Good' : 'Pressure' },
    { label: 'Cash profit indicator', value: summary.cashProfitIndicator, status: summary.cashProfitIndicator >= 0 ? 'Positive' : 'Negative' },
    { label: 'Credit sales exposure', value: summary.creditSales, status: summary.creditSales > summary.cashSales ? 'Watch' : 'Normal' }
  ];
}
