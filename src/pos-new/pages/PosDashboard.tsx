import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  ClipboardCheck,
  ClipboardList,
  Package,
  Receipt,
  ShieldAlert,
  TrendingUp,
  Truck,
  Users,
  Wallet
} from 'lucide-react';
import {
  BusinessProfile,
  CashLog,
  CustomerDebtRecord,
  CustomerRecord,
  CustomerSummary,
  DeliverySummary,
  GoodsReceivingNote,
  OperationalApprovalRequest,
  PosPageId,
  PosSession,
  Product,
  Shift,
  StocktakeSessionSummary,
  StockTransferSummary,
  TaskRecord,
  TaskSummary,
  Transaction
} from '../types';
import { getDeliverySummary } from '../services/deliveryService';
import { getOperationalApprovals } from '../services/approvalService';
import { getTaskSummary, getTasks } from '../services/taskService';
import { biEventService } from '../services/biEventService';
import { getCustomerSummary, getCustomers } from '../services/customerService';
import { getCustomerDebtRecords } from '../services/customerCreditService';
import { getGoodsReceivingNotes } from '../services/goodsReceivingService';
import { getStockTransferSummary } from '../services/stockTransferService';
import { getStocktakeSessionSummary } from '../services/stocktakeService';
import { getStaffByVendor } from '../services/staffFirestoreService';

interface PosDashboardProps {
  products: Product[];
  transactions: Transaction[];
  activeShift: Shift | null;
  cashLogs: CashLog[];
  onNavigate: (page: PosPageId) => void;
  session?: PosSession | null;
  businessProfile?: BusinessProfile;
}

type DateFilter = 'Today' | 'Yesterday' | 'This Week' | 'This Month';
type Severity = 'Low' | 'Medium' | 'High' | 'Critical';

type ServiceState = {
  delivery: DeliverySummary | null;
  approvals: OperationalApprovalRequest[];
  taskSummary: TaskSummary | null;
  tasks: TaskRecord[];
  customers: CustomerRecord[];
  customerSummary: CustomerSummary | null;
  customerDebts: CustomerDebtRecord[];
  goodsReceiving: GoodsReceivingNote[];
  transferSummary: StockTransferSummary | null;
  stocktakeSummary: StocktakeSessionSummary | null;
  staffOnDuty: Array<{ name: string; role: string; status: string }>;
  biWarnings: Array<{ title: string; reason: string; severity: Severity; action: string }>;
};

const emptyServiceState: ServiceState = {
  delivery: null,
  approvals: [],
  taskSummary: null,
  tasks: [],
  customers: [],
  customerSummary: null,
  customerDebts: [],
  goodsReceiving: [],
  transferSummary: null,
  stocktakeSummary: null,
  staffOnDuty: [],
  biWarnings: []
};

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getDateRange(filter: DateFilter): { from: Date; to: Date; label: string } {
  const now = new Date();
  if (filter === 'Yesterday') {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    return { from: startOfDay(yesterday), to: endOfDay(yesterday), label: 'Yesterday' };
  }
  if (filter === 'This Week') {
    const first = new Date(now);
    first.setDate(now.getDate() - now.getDay());
    return { from: startOfDay(first), to: endOfDay(now), label: 'This Week' };
  }
  if (filter === 'This Month') {
    return { from: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)), to: endOfDay(now), label: 'This Month' };
  }
  return { from: startOfDay(now), to: endOfDay(now), label: 'Today' };
}

function previousDayRange(from: Date): { from: Date; to: Date } {
  const day = new Date(from);
  day.setDate(from.getDate() - 1);
  return { from: startOfDay(day), to: endOfDay(day) };
}

function inRange(value: string | undefined, from: Date, to: Date): boolean {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time >= from.getTime() && time <= to.getTime();
}

function money(value: number): string {
  return `USD ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function percent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function productQty(product: Product): number {
  return Number(product.availableStock ?? product.qtyOnHand ?? product.stock ?? 0) || 0;
}

function productCost(product: Product): number {
  return Number(product.costPrice ?? product.cost ?? 0) || 0;
}

function productPrice(product: Product): number {
  return Number(product.sellingPrice ?? product.price ?? 0) || 0;
}

function productName(product: Product): string {
  return product.productName || product.name || product.sku || product.code || 'Unnamed product';
}

function productCategory(product: Product): string {
  return product.productCategory || product.category || 'Uncategorised';
}

function isCashPayment(method: string): boolean {
  return ['CASH', 'Cash'].includes(method);
}

function scopeMatches(value: string, ...candidates: Array<string | undefined>): boolean {
  if (value === 'ALL') return true;
  const needle = value.trim().toLowerCase();
  return candidates.some((candidate) => String(candidate || '').trim().toLowerCase() === needle);
}

function compareStatus(value: number): 'Good' | 'Watch' | 'Attention' {
  if (value > 0) return 'Good';
  if (value === 0) return 'Watch';
  return 'Attention';
}

function severityForVariance(amount: number): Severity {
  const absolute = Math.abs(amount);
  if (absolute >= 250) return 'Critical';
  if (absolute >= 100) return 'High';
  if (absolute > 0) return 'Medium';
  return 'Low';
}

function severityClass(severity: Severity): string {
  if (severity === 'Critical') return 'border-rose-500 bg-rose-50 text-rose-900';
  if (severity === 'High') return 'border-orange-400 bg-orange-50 text-orange-950';
  if (severity === 'Medium') return 'border-amber-300 bg-amber-50 text-amber-900';
  return 'border-emerald-300 bg-emerald-50 text-emerald-800';
}

export default function PosDashboard({
  products,
  transactions,
  activeShift,
  cashLogs,
  onNavigate,
  session,
  businessProfile
}: PosDashboardProps) {
  const vendorName = session?.vendor || businessProfile?.tradingName || businessProfile?.legalName || businessProfile?.businessName || 'Business';
  const currentBranch = session?.branchId || session?.branch || 'ALL';
  const currentWarehouse = session?.warehouseId || session?.warehouse || 'ALL';
  const [dateFilter, setDateFilter] = useState<DateFilter>('Today');
  const [branchFilter, setBranchFilter] = useState(currentBranch);
  const [warehouseFilter, setWarehouseFilter] = useState(currentWarehouse);
  const [serviceState, setServiceState] = useState<ServiceState>(emptyServiceState);

  const dateRange = useMemo(() => getDateRange(dateFilter), [dateFilter]);
  const priorRange = useMemo(() => previousDayRange(dateRange.from), [dateRange.from]);

  const branchOptions = useMemo(() => {
    const rows = new Map<string, string>();
    rows.set('ALL', 'All Branches');
    if (session?.branchId || session?.branch) rows.set(currentBranch, session?.branch || session?.branchId || currentBranch);
    products.forEach((product) => {
      const key = product.branchId || product.branch;
      if (key) rows.set(key, product.branch || product.branchId || key);
    });
    transactions.forEach((transaction) => {
      if (transaction.branch) rows.set(transaction.branch, transaction.branch);
    });
    return Array.from(rows, ([value, label]) => ({ value, label }));
  }, [currentBranch, products, session?.branch, session?.branchId, transactions]);

  const warehouseOptions = useMemo(() => {
    const rows = new Map<string, string>();
    rows.set('ALL', 'All Warehouses');
    if (session?.warehouseId || session?.warehouse) rows.set(currentWarehouse, session?.warehouse || session?.warehouseId || currentWarehouse);
    products.forEach((product) => {
      const key = product.warehouseId || product.warehouse;
      if (key) rows.set(key, product.warehouse || product.warehouseId || key);
    });
    return Array.from(rows, ([value, label]) => ({ value, label }));
  }, [currentWarehouse, products, session?.warehouse, session?.warehouseId]);

  useEffect(() => {
    let active = true;
    const filters = {
      dateFrom: isoDate(dateRange.from),
      dateTo: isoDate(dateRange.to),
      branch: branchFilter === 'ALL' ? undefined : branchFilter,
      warehouse: warehouseFilter === 'ALL' ? undefined : warehouseFilter
    };

    void Promise.all([
      getDeliverySummary({ dateFrom: filters.dateFrom, dateTo: filters.dateTo }),
      getOperationalApprovals(),
      getTaskSummary(),
      getTasks({ dueDateFrom: filters.dateFrom, dueDateTo: filters.dateTo }),
      biEventService.getBIEvents(),
      getCustomerSummary(),
      getCustomers(),
      getCustomerDebtRecords({ status: 'All' }),
      getGoodsReceivingNotes({ dateFrom: filters.dateFrom, dateTo: filters.dateTo, branch: filters.branch, warehouse: filters.warehouse }),
      getStockTransferSummary({ dateFrom: filters.dateFrom, dateTo: filters.dateTo, sourceBranch: filters.branch, sourceWarehouse: filters.warehouse }),
      getStocktakeSessionSummary({ dateFrom: filters.dateFrom, dateTo: filters.dateTo, branch: filters.branch, warehouse: filters.warehouse }),
      session?.vendorId ? getStaffByVendor(session.vendorId) : Promise.resolve([])
    ]).then(([delivery, approvals, taskSummary, tasks, biEvents, customerSummary, customers, customerDebts, goodsReceiving, transferSummary, stocktakeSummary, staff]) => {
      if (!active) return;
      setServiceState({
        delivery,
        approvals,
        taskSummary,
        tasks,
        customers,
        customerSummary,
        customerDebts,
        goodsReceiving,
        transferSummary,
        stocktakeSummary,
        staffOnDuty: staff
          .filter((row) => String(row.status || '').toLowerCase() === 'active')
          .map((row) => ({ name: row.displayName || row.email || 'Staff member', role: row.roleName || 'Staff', status: 'Signed in' })),
        biWarnings: biEvents
          .filter((event) => ['High', 'Critical', 'WARNING', 'CRITICAL'].includes(String(event.severity)))
          .slice(0, 4)
          .map((event) => ({
            title: businessWarningTitle(event.eventType),
            reason: String(event.payload?.reason || event.payload?.details || 'Needs management review.'),
            severity: event.severity === 'Critical' || event.severity === 'CRITICAL' ? 'Critical' : 'High',
            action: 'Open related record'
          }))
      });
    }).catch(() => {
      if (active) setServiceState(emptyServiceState);
    });
    return () => {
      active = false;
    };
  }, [branchFilter, dateRange.from, dateRange.to, session?.vendorId, warehouseFilter]);

  const scopedProducts = useMemo(() => products.filter((product) => {
    const branchOk = branchFilter === 'ALL' || !product.branchId && !product.branch || scopeMatches(branchFilter, product.branchId, product.branch);
    const warehouseOk = warehouseFilter === 'ALL' || !product.warehouseId && !product.warehouse || scopeMatches(warehouseFilter, product.warehouseId, product.warehouse);
    return branchOk && warehouseOk;
  }), [branchFilter, products, warehouseFilter]);

  const scopedTransactions = useMemo(() => transactions.filter((transaction) => {
    const branchOk = branchFilter === 'ALL' || !transaction.branch || scopeMatches(branchFilter, transaction.branch);
    return branchOk && inRange(transaction.date, dateRange.from, dateRange.to);
  }), [branchFilter, dateRange.from, dateRange.to, transactions]);

  const priorTransactions = useMemo(() => transactions.filter((transaction) => {
    const branchOk = branchFilter === 'ALL' || !transaction.branch || scopeMatches(branchFilter, transaction.branch);
    return branchOk && inRange(transaction.date, priorRange.from, priorRange.to);
  }), [branchFilter, priorRange.from, priorRange.to, transactions]);

  const scopedCashLogs = useMemo(() => cashLogs.filter((log) => inRange(log.timestamp, dateRange.from, dateRange.to)), [cashLogs, dateRange.from, dateRange.to]);

  const productById = useMemo(() => {
    const entries: [string, Product][] = scopedProducts.flatMap((product) => {
      const key1: [string, Product] = [product.id, product];
      const key2: [string, Product] = [product.code, product];
      const key3: [string, Product] = [product.sku || '', product];
      return [key1, key2, key3];
    }).filter(([key]) => key);
    return new Map<string, Product>(entries);
  }, [scopedProducts]);

  const trading = useMemo(() => summarizeTrading(scopedTransactions, productById), [productById, scopedTransactions]);
  const priorTrading = useMemo(() => summarizeTrading(priorTransactions, productById), [priorTransactions, productById]);

  const cash = useMemo(() => {
    const cashSales = scopedTransactions.filter((transaction) => isCashPayment(transaction.paymentMethod)).reduce((sum, transaction) => sum + transaction.total, 0);
    const paidIn = scopedCashLogs.filter((log) => log.type === 'PAY_IN' || log.type === 'INITIAL').reduce((sum, log) => sum + log.amount, 0);
    const paidOut = scopedCashLogs.filter((log) => log.type === 'PAY_OUT' || log.type === 'SAFE_DROP').reduce((sum, log) => sum + log.amount, 0);
    const openingFloat = activeShift?.startingCash ?? scopedCashLogs.find((log) => log.type === 'INITIAL')?.amount ?? 0;
    const expectedCash = activeShift?.expectedCash ?? openingFloat + cashSales + paidIn - paidOut;
    const countedCash = activeShift?.actualCash ?? 0;
    const variance = activeShift?.difference ?? (countedCash ? countedCash - expectedCash : 0);
    return { openingFloat, cashSales, paidOut, expectedCash, countedCash, variance, severity: severityForVariance(variance) };
  }, [activeShift, scopedCashLogs, scopedTransactions]);

  const stock = useMemo(() => {
    const lowStockRows = scopedProducts.filter((product) => productQty(product) > 0 && productQty(product) <= (product.reorderLevel ?? product.minStock ?? 5));
    const outRows = scopedProducts.filter((product) => productQty(product) <= 0);
    const stockValue = scopedProducts.reduce((sum, product) => sum + productQty(product) * productCost(product), 0);
    const unpostedReceipts = serviceState.goodsReceiving.filter((note) => !['Posted', 'Partially Posted', 'Cancelled', 'Rejected', 'Reversed'].includes(note.receivingStatus)).length;
    const pendingTransfers = (serviceState.transferSummary?.draftTransfers || 0) + (serviceState.transferSummary?.pendingApproval || 0) + (serviceState.transferSummary?.inTransit || 0);
    return {
      lowStockRows,
      outRows,
      lowStock: lowStockRows.length,
      outOfStock: outRows.length,
      stockValue,
      unpostedReceipts,
      pendingTransfers,
      stocktakeProgress: serviceState.stocktakeSummary
        ? `${serviceState.stocktakeSummary.counting} counting, ${serviceState.stocktakeSummary.submitted} submitted`
        : 'No stocktake in progress'
    };
  }, [scopedProducts, serviceState.goodsReceiving, serviceState.stocktakeSummary, serviceState.transferSummary]);

  const performance = useMemo(() => summarizePerformance(scopedTransactions, scopedProducts), [scopedProducts, scopedTransactions]);
  const customerPanel = useMemo(() => summarizeCustomers(serviceState.customers, serviceState.customerSummary, serviceState.customerDebts, scopedTransactions, dateRange), [dateRange, scopedTransactions, serviceState.customerDebts, serviceState.customerSummary, serviceState.customers]);
  const approvals = useMemo(() => summarizeApprovals(serviceState.approvals), [serviceState.approvals]);
  const staffActivity = useMemo(() => summarizeStaff(scopedTransactions, serviceState.tasks, serviceState.staffOnDuty, activeShift, cash.variance), [activeShift, cash.variance, scopedTransactions, serviceState.staffOnDuty, serviceState.tasks]);
  const warnings = useMemo(() => buildWarnings(stock, cash, approvals, serviceState.delivery, customerPanel, performance, serviceState.stocktakeSummary, serviceState.biWarnings), [approvals, cash, customerPanel, performance, serviceState.biWarnings, serviceState.delivery, serviceState.stocktakeSummary, stock]);
  const dailyActions = useMemo(() => buildDailyActions(stock, cash, approvals, serviceState.delivery, customerPanel, serviceState.taskSummary, activeShift), [activeShift, approvals, cash, customerPanel, serviceState.delivery, serviceState.taskSummary, stock]);

  const kpis = [
    createKpi("Today's Sales", money(trading.sales), trading.sales, priorTrading.sales, trading.sales > 0 ? 'Sales recorded' : 'No sales recorded today'),
    createKpi('Gross Profit', money(trading.grossProfit), trading.grossProfit, priorTrading.grossProfit, trading.grossProfit > 0 ? `${trading.margin.toFixed(1)}% margin` : 'No gross profit yet'),
    createKpi('Cash in Drawer', money(cash.expectedCash), cash.expectedCash, priorTrading.cashSales, Math.abs(cash.variance) > 0 ? 'Variance to review' : 'No cash variance'),
    createKpi('Transactions', String(trading.transactions), trading.transactions, priorTrading.transactions, trading.transactions > 0 ? 'Receipts posted' : 'No sales recorded today'),
    createKpi('Customers Served', String(trading.customersServed), trading.customersServed, priorTrading.customersServed, trading.customersServed > 0 ? 'Customers served' : 'No customers served yet'),
    createKpi('Average Basket Value', money(trading.averageBasket), trading.averageBasket, priorTrading.averageBasket, trading.averageBasket > 0 ? 'Basket tracked' : 'No basket data yet')
  ];

  return (
    <div className="space-y-5 text-xs text-[#1e222b]" id="pos-vendor-dashboard">
      <header className="border border-slate-700 bg-[#1e222b] p-4 text-white">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-orange-400">Dashboard</p>
            <h1 className="mt-1 text-xl font-black uppercase">Daily Business Control</h1>
            <p className="mt-2 max-w-3xl text-[11px] font-bold uppercase leading-relaxed text-slate-300">
              {vendorName} | {branchOptions.find((row) => row.value === branchFilter)?.label || 'Current Branch'} | {dateRange.label}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Select label="Period" value={dateFilter} options={['Today', 'Yesterday', 'This Week', 'This Month']} onChange={(value) => setDateFilter(value as DateFilter)} />
            <Select label="Branch" value={branchFilter} options={branchOptions.map((row) => row.value)} optionLabels={Object.fromEntries(branchOptions.map((row) => [row.value, row.label]))} onChange={setBranchFilter} />
            <Select label="Warehouse" value={warehouseFilter} options={warehouseOptions.map((row) => row.value)} optionLabels={Object.fromEntries(warehouseOptions.map((row) => [row.value, row.label]))} onChange={setWarehouseFilter} />
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
        {kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel title="Stock Control" icon={Package} actions={[
          ['Open Inventory', () => onNavigate('STOCK')],
          ['Receive Stock', () => onNavigate('STOCK')],
          ['Start Stocktake', () => onNavigate('STOCK')],
          ['Review Transfers', () => onNavigate('STOCK')]
        ]}>
          <MetricGrid rows={[
            ['Low Stock Items', String(stock.lowStock)],
            ['Out of Stock Items', String(stock.outOfStock)],
            ['Stock Value', money(stock.stockValue)],
            ['Unposted Goods Receipts', String(stock.unpostedReceipts)],
            ['Pending Stock Transfers', String(stock.pendingTransfers)],
            ['Stocktake Progress', stock.stocktakeProgress]
          ]} />
          <MiniList
            empty="No low stock items"
            rows={stock.lowStockRows.slice(0, 4).map((product) => [productName(product), `${productQty(product)} left`])}
          />
        </Panel>

        <Panel title="Cash Control" icon={Wallet} actions={[
          ['Open Cash Control', () => onNavigate('CASH')],
          ['Count Drawer', () => onNavigate('CASH')],
          ['Review Variance', () => onNavigate('CASH')],
          ['Close Shift', () => onNavigate('SHIFT')]
        ]}>
          <MetricGrid rows={[
            ['Opening Float', money(cash.openingFloat)],
            ['Cash Sales', money(cash.cashSales)],
            ['Cash Paid Out', money(cash.paidOut)],
            ['Expected Cash', money(cash.expectedCash)],
            ['Counted Cash', cash.countedCash ? money(cash.countedCash) : 'Not counted'],
            ['Variance', money(cash.variance)]
          ]} />
          {Math.abs(cash.variance) > 0 ? (
            <WarningBox
              title="Cash variance detected"
              severity={cash.severity}
              reason={`${money(cash.variance)} variance on ${activeShift?.operator || 'current shift'}.`}
              action="Review variance before closing the shift."
            />
          ) : (
            <EmptyState text="No cash variance" />
          )}
        </Panel>

        <Panel title="Sales Performance" icon={TrendingUp}>
          <MetricGrid rows={[
            ['Best Performing Category', performance.bestCategory],
            ['Highest Value Sale', money(performance.highestValueSale)],
            ['Return Value', money(performance.returnValue)],
            ['Discount Value', money(performance.discountValue)]
          ]} />
          <BarList title="Top Selling Products" rows={performance.topProducts} />
          <MiniList empty="No slow-moving products" rows={performance.slowProducts.slice(0, 3).map((product) => [productName(product), `${productQty(product)} on hand`])} />
        </Panel>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel title="Customers" icon={Users} actions={[
          ['Open Customers', () => onNavigate('CUSTOMER_CENTRE')],
          ['Review Credit', () => onNavigate('CUSTOMER_CENTRE')],
          ['Send Reminder', () => onNavigate('CUSTOMER_CENTRE')]
        ]}>
          <MetricGrid rows={[
            ['New Customers Today', String(customerPanel.newToday)],
            ['Returning Customers', String(customerPanel.returning)],
            ['Credit Customers', String(customerPanel.creditCustomers)],
            ['Outstanding Balances', money(customerPanel.outstandingBalance)],
            ['Overdue Accounts', String(customerPanel.overdueAccounts)]
          ]} />
          {customerPanel.overdueAccounts > 0 ? <WarningBox title="Customer credit overdue" severity="High" reason={`${customerPanel.overdueAccounts} customer account(s) overdue.`} action="Review credit and send reminders." /> : <EmptyState text="No overdue customer accounts" />}
        </Panel>

        <Panel title="Deliveries" icon={Truck} actions={[
          ['Assign Delivery', () => onNavigate('DELIVERY')],
          ['Open Delivery Desk', () => onNavigate('DELIVERY')],
          ['Review Failed Delivery', () => onNavigate('DELIVERY')],
          ['Confirm Cash Handover', () => onNavigate('DELIVERY')]
        ]}>
          <MetricGrid rows={[
            ['Awaiting Assignment', String(serviceState.delivery?.pendingAssignment || 0)],
            ['In Transit', String(serviceState.delivery?.inTransit || 0)],
            ['Delivered Today', String(serviceState.delivery?.deliveredToday || 0)],
            ['Failed Deliveries', String(serviceState.delivery?.failedDeliveries || 0)],
            ['Cash Awaiting Handover', String(serviceState.delivery?.cashPendingReview || 0)]
          ]} />
          {(serviceState.delivery?.pendingAssignment || serviceState.delivery?.inTransit || serviceState.delivery?.failedDeliveries) ? null : <EmptyState text="No pending deliveries" />}
        </Panel>

        <Panel title="Staff Activity" icon={ClipboardCheck} actions={[
          ['Open Staff', () => onNavigate('SETTINGS')],
          ['Review Shift', () => onNavigate('SHIFT')],
          ['Assign Task', () => onNavigate('TASK_DESK')]
        ]}>
          <MetricGrid rows={[
            ['Staff Currently Signed In', String(staffActivity.signedIn)],
            ['Open Shifts', activeShift?.status === 'ACTIVE' ? '1' : '0'],
            ['Staff Sales', money(staffActivity.staffSales)],
            ['Staff Cash Variances', String(staffActivity.cashVarianceCount)],
            ['Pending Staff Tasks', String(staffActivity.pendingTasks)]
          ]} />
          <MiniList empty="No staff currently signed in" rows={staffActivity.staffRows.slice(0, 4).map((row) => [row.name, row.role])} />
        </Panel>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Approvals and Tasks" icon={ClipboardList} actions={[
          ['Open Approvals', () => onNavigate('APPROVALS')],
          ['Open Tasks', () => onNavigate('TASK_DESK')]
        ]}>
          <MetricGrid rows={[
            ['Pending Discounts', String(approvals.pendingDiscounts)],
            ['Pending Voids', String(approvals.pendingVoids)],
            ['Pending Refunds', String(approvals.pendingRefunds)],
            ['Pending Stock Adjustments', String(approvals.pendingStockAdjustments)],
            ['Pending Purchase Approvals', String(approvals.pendingPurchaseApprovals)],
            ['Overdue Tasks', String(serviceState.taskSummary?.overdue || 0)]
          ]} />
          {approvals.highRisk.length > 0 ? (
            <MiniList
              empty="No high-risk approvals"
              rows={approvals.highRisk.slice(0, 4).map((approval) => [approval.title || approval.category, approval.risk])}
            />
          ) : (
            <EmptyState text="No approvals waiting" />
          )}
        </Panel>

        <Panel title="Today's Actions" icon={Receipt}>
          <div className="space-y-2">
            {dailyActions.length > 0 ? dailyActions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => onNavigate(action.page)}
                className="flex w-full items-center justify-between border border-slate-200 bg-white px-3 py-2 text-left text-[11px] font-black uppercase text-[#1e222b] hover:border-orange-500 hover:bg-orange-50"
              >
                <span>{action.label}</span>
                <ArrowRight className="h-3.5 w-3.5 text-orange-600" />
              </button>
            )) : <EmptyState text="No urgent actions for today" />}
          </div>
        </Panel>
      </section>

      <Panel title="Loss Control and BI Warnings" icon={ShieldAlert} actions={[['Open BI Desk', () => onNavigate('BI_DESK')]]}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {warnings.length > 0 ? warnings.map((warning) => (
            <WarningBox key={`${warning.title}-${warning.reason}`} {...warning} />
          )) : <EmptyState text="No urgent loss-control risks" />}
        </div>
      </Panel>
    </div>
  );
}

function summarizeTrading(rows: Transaction[], productById: Map<string, Product>) {
  const activeRows = rows.filter((transaction) => !['VOIDED', 'RETURNED', 'REFUNDED'].includes(String(transaction.status)));
  const sales = activeRows.reduce((sum, transaction) => sum + transaction.total, 0);
  const grossCost = activeRows.reduce((sum, transaction) => sum + transaction.items.reduce((itemSum, item) => {
    const product = productById.get(item.productId) || productById.get(item.code);
    const unitCost = item.unitCost ?? item.costPrice ?? (product ? productCost(product) : item.price * 0.62);
    return itemSum + unitCost * item.quantity;
  }, 0), 0);
  const customers = new Set(activeRows.map((row) => row.customerId || row.customerName || row.invoiceNo).filter(Boolean));
  const cashSales = activeRows.filter((row) => isCashPayment(row.paymentMethod)).reduce((sum, row) => sum + row.total, 0);
  return {
    sales,
    grossProfit: Math.max(0, sales - grossCost),
    margin: sales > 0 ? ((sales - grossCost) / sales) * 100 : 0,
    transactions: activeRows.length,
    customersServed: customers.size,
    averageBasket: activeRows.length > 0 ? sales / activeRows.length : 0,
    cashSales
  };
}

function summarizePerformance(rows: Transaction[], products: Product[]) {
  const productMap = new Map<string, Product>(products.flatMap((product) => {
    const key1: [string, Product] = [product.id, product];
    const key2: [string, Product] = [product.code, product];
    const key3: [string, Product] = [product.sku || '', product];
    return [key1, key2, key3];
  }).filter(([key]) => key));
  const productSales = new Map<string, { name: string; qty: number; value: number }>();
  const categorySales = new Map<string, number>();

  rows.forEach((transaction) => {
    transaction.items.forEach((item) => {
      const product = productMap.get(item.productId) || productMap.get(item.code);
      const name = product ? productName(product) : item.name;
      const current = productSales.get(name) || { name, qty: 0, value: 0 };
      current.qty += item.quantity;
      current.value += item.total;
      productSales.set(name, current);
      const category = product ? productCategory(product) : 'Uncategorised';
      categorySales.set(category, (categorySales.get(category) || 0) + item.total);
    });
  });

  const topProducts = Array.from(productSales.values()).sort((a, b) => b.value - a.value).slice(0, 5).map((row) => ({
    label: row.name,
    value: money(row.value),
    percent: Math.min(100, rows.length ? (row.value / Math.max(1, Array.from(productSales.values()).reduce((sum, item) => sum + item.value, 0))) * 100 : 0)
  }));

  const bestCategory = Array.from(categorySales.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'No sales recorded';
  const soldNames = new Set(Array.from(productSales.keys()));
  return {
    topProducts,
    slowProducts: products.filter((product) => productQty(product) > 0 && !soldNames.has(productName(product))).slice(0, 5),
    bestCategory,
    highestValueSale: rows.reduce((max, row) => Math.max(max, row.total), 0),
    returnValue: rows.filter((row) => ['RETURNED', 'REFUNDED'].includes(String(row.status))).reduce((sum, row) => sum + row.total, 0),
    discountValue: rows.reduce((sum, row) => sum + (row.discount || 0), 0)
  };
}

function summarizeCustomers(customers: CustomerRecord[], summary: CustomerSummary | null, debts: CustomerDebtRecord[], transactions: Transaction[], range: { from: Date; to: Date }) {
  const newToday = customers.filter((customer) => inRange(customer.createdAt, range.from, range.to)).length;
  const creditCustomers = customers.filter((customer) => customer.creditStatus !== 'Cash Only' && customer.creditStatus !== 'Blocked').length;
  const outstandingBalance = debts.reduce((sum, debt) => sum + Math.max(0, debt.outstandingAmount || 0), 0);
  const overdueAccounts = new Set(debts.filter((debt) => debt.overdueDays > 0 && debt.outstandingAmount > 0).map((debt) => debt.customerId)).size;
  const returning = summary?.repeatCustomers ?? new Set(transactions.map((row) => row.customerId).filter(Boolean)).size;
  return { newToday, returning, creditCustomers, outstandingBalance, overdueAccounts };
}

function summarizeApprovals(approvals: OperationalApprovalRequest[]) {
  const pending = approvals.filter((approval) => ['Pending', 'InReview', 'MoreInfoRequested', 'Escalated'].includes(approval.status));
  const contains = (approval: OperationalApprovalRequest, text: string) => `${approval.category} ${approval.title || ''} ${approval.approvalType || ''}`.toLowerCase().includes(text);
  return {
    pendingDiscounts: pending.filter((approval) => contains(approval, 'discount') || contains(approval, 'price')).length,
    pendingVoids: pending.filter((approval) => contains(approval, 'void')).length,
    pendingRefunds: pending.filter((approval) => contains(approval, 'refund') || contains(approval, 'return')).length,
    pendingStockAdjustments: pending.filter((approval) => contains(approval, 'stock')).length,
    pendingPurchaseApprovals: pending.filter((approval) => contains(approval, 'purchase') || contains(approval, 'supplier') || contains(approval, 'goods')).length,
    highRisk: pending.filter((approval) => approval.risk === 'High' || approval.risk === 'Critical' || approval.priority === 'Urgent')
  };
}

function summarizeStaff(transactions: Transaction[], tasks: TaskRecord[], staffRows: Array<{ name: string; role: string; status: string }>, activeShift: Shift | null, variance: number) {
  const activeNames = new Set(staffRows.map((row) => row.name));
  if (activeShift?.operator) activeNames.add(activeShift.operator);
  const staffSales = transactions.reduce((sum, transaction) => sum + transaction.total, 0);
  return {
    signedIn: activeNames.size,
    staffSales,
    cashVarianceCount: Math.abs(variance) > 0 ? 1 : 0,
    pendingTasks: tasks.filter((task) => !['Closed', 'Completed', 'Cancelled'].includes(task.status)).length,
    staffRows: Array.from(activeNames).map((name) => ({
      name,
      role: staffRows.find((row) => row.name === name)?.role || (activeShift?.operator === name ? 'Shift operator' : 'Staff')
    }))
  };
}

function buildWarnings(
  stock: { outOfStock: number; lowStock: number },
  cash: { variance: number; severity: Severity },
  approvals: ReturnType<typeof summarizeApprovals>,
  delivery: DeliverySummary | null,
  customers: { overdueAccounts: number },
  performance: ReturnType<typeof summarizePerformance>,
  stocktake: StocktakeSessionSummary | null,
  biWarnings: ServiceState['biWarnings']
) {
  const warnings: Array<{ title: string; reason: string; severity: Severity; action: string }> = [];
  if (Math.abs(cash.variance) > 0) warnings.push({ title: 'Cash variance detected', reason: `${money(cash.variance)} variance requires review.`, severity: cash.severity, action: 'Review variance' });
  if (stock.outOfStock > 0) warnings.push({ title: 'Negative stock risk', reason: `${stock.outOfStock} product(s) are out of stock.`, severity: 'High', action: 'Review stock' });
  if (performance.discountValue > 0) warnings.push({ title: 'High discount activity', reason: `${money(performance.discountValue)} discount value in the selected period.`, severity: 'Medium', action: 'Review discounts' });
  if (performance.returnValue > 0) warnings.push({ title: 'Unusual returns', reason: `${money(performance.returnValue)} returns or refunds recorded.`, severity: 'Medium', action: 'Review sales history' });
  if ((stocktake?.openSessions || 0) === 0 && stock.lowStock > 0) warnings.push({ title: 'Stocktake overdue', reason: 'Low stock exists and no open stocktake is in progress.', severity: 'Medium', action: 'Start stocktake' });
  if ((delivery?.failedDeliveries || 0) > 0 || (delivery?.urgentDeliveries || 0) > 0) warnings.push({ title: 'Supplier delivery overdue', reason: 'Delivery exceptions need follow-up.', severity: 'High', action: 'Open delivery desk' });
  if (customers.overdueAccounts > 0) warnings.push({ title: 'Customer credit overdue', reason: `${customers.overdueAccounts} account(s) overdue.`, severity: 'High', action: 'Review credit' });
  if (performance.topProducts.length > 0 && performance.topProducts.every((row) => row.percent < 5)) warnings.push({ title: 'Low gross margin', reason: 'Sales mix may need margin review.', severity: 'Medium', action: 'Review performance' });
  if (approvals.highRisk.length > 0) warnings.push({ title: 'Unusual staff activity', reason: `${approvals.highRisk.length} high-risk approval(s) waiting.`, severity: 'High', action: 'Open approvals' });
  return [...warnings, ...biWarnings].slice(0, 9);
}

function buildDailyActions(
  stock: { lowStock: number; unpostedReceipts: number },
  cash: { variance: number },
  approvals: ReturnType<typeof summarizeApprovals>,
  delivery: DeliverySummary | null,
  customers: { overdueAccounts: number },
  tasks: TaskSummary | null,
  activeShift: Shift | null
): Array<{ label: string; page: PosPageId }> {
  const actions: Array<{ label: string; page: PosPageId }> = [];
  if (activeShift) actions.push({ label: 'Count cash drawer', page: 'CASH' });
  if (stock.lowStock > 0) actions.push({ label: 'Review low stock', page: 'STOCK' });
  if (approvals.pendingRefunds > 0) actions.push({ label: 'Approve pending refund', page: 'APPROVALS' });
  if ((delivery?.cashPendingReview || 0) > 0) actions.push({ label: 'Confirm delivery cash', page: 'DELIVERY' });
  if (customers.overdueAccounts > 0) actions.push({ label: 'Follow up overdue customer', page: 'CUSTOMER_CENTRE' });
  if (stock.unpostedReceipts > 0) actions.push({ label: 'Receive supplier stock', page: 'STOCK' });
  if (activeShift?.status === 'ACTIVE') actions.push({ label: 'Close open shift', page: 'SHIFT' });
  if (Math.abs(cash.variance) > 0) actions.push({ label: 'Review cash variance', page: 'CASH' });
  if ((tasks?.overdue || 0) > 0) actions.push({ label: 'Open overdue tasks', page: 'TASK_DESK' });
  return actions.slice(0, 8);
}

function businessWarningTitle(eventType: string): string {
  if (eventType.includes('CASH')) return 'Cash variance detected';
  if (eventType.includes('ZERO_STOCK')) return 'Negative stock risk';
  if (eventType.includes('PRICE') || eventType.includes('DISCOUNT')) return 'High discount activity';
  if (eventType.includes('RETURN')) return 'Unusual returns';
  if (eventType.includes('DELIVERY')) return 'Supplier delivery overdue';
  if (eventType.includes('LOGIN') || eventType.includes('STAFF')) return 'Unusual staff activity';
  return 'Business warning';
}

function createKpi(label: string, value: string, current: number, previous: number, statusText: string) {
  const delta = previous === 0 ? (current > 0 ? 100 : 0) : ((current - previous) / Math.abs(previous)) * 100;
  return {
    label,
    value,
    comparison: `${percent(delta)} vs previous day`,
    status: compareStatus(delta),
    statusText
  };
}

function KpiCard({ label, value, comparison, status, statusText }: { label: string; value: string; comparison: string; status: 'Good' | 'Watch' | 'Attention'; statusText: string }) {
  const statusClasses = status === 'Good' ? 'text-emerald-700 bg-emerald-50 border-emerald-300' : status === 'Attention' ? 'text-rose-800 bg-rose-50 border-rose-300' : 'text-orange-900 bg-orange-50 border-orange-300';
  return (
    <article className="min-h-[126px] border border-[#b1b5c2] bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[9px] font-black uppercase tracking-wide text-slate-500">{label}</p>
        <span className={`border px-1.5 py-0.5 text-[8px] font-black uppercase ${statusClasses}`}>{status}</span>
      </div>
      <strong className="mt-3 block text-lg font-black text-[#1e222b]">{value}</strong>
      <p className="mt-2 text-[10px] font-black uppercase text-orange-700">{comparison}</p>
      <p className="mt-1 text-[10px] font-bold uppercase text-slate-500">{statusText}</p>
    </article>
  );
}

function Panel({ title, icon: Icon, actions = [], children }: { title: string; icon: React.ElementType; actions?: Array<[string, () => void]>; children: React.ReactNode }) {
  return (
    <section className="border border-[#b1b5c2] bg-[#f4f5f7] p-4">
      <div className="mb-3 flex flex-col gap-2 border-b border-slate-300 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="flex items-center gap-2 text-sm font-black uppercase text-[#1e222b]">
          <Icon className="h-4 w-4 text-orange-600" />
          {title}
        </h2>
        {actions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {actions.map(([label, onClick]) => (
              <button key={label} type="button" onClick={onClick} className="border border-slate-300 bg-white px-2 py-1 text-[9px] font-black uppercase text-[#1e222b] hover:border-orange-500 hover:bg-orange-50">
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function MetricGrid({ rows }: { rows: string[][] }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="border border-slate-200 bg-white p-2">
          <p className="text-[8px] font-black uppercase text-slate-500">{label}</p>
          <strong className="mt-1 block break-words text-[11px] font-black uppercase text-[#1e222b]">{value}</strong>
        </div>
      ))}
    </div>
  );
}

function MiniList({ rows, empty }: { rows: string[][]; empty: string }) {
  if (rows.length === 0) return <EmptyState text={empty} />;
  return (
    <div className="space-y-1.5">
      {rows.map(([label, value]) => (
        <div key={`${label}-${value}`} className="flex items-center justify-between gap-3 border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-bold uppercase">
          <span className="truncate text-[#1e222b]">{label}</span>
          <span className="shrink-0 text-slate-500">{value}</span>
        </div>
      ))}
    </div>
  );
}

function BarList({ title, rows }: { title: string; rows: Array<{ label: string; value: string; percent: number }> }) {
  return (
    <div className="space-y-2">
      <h3 className="text-[10px] font-black uppercase text-slate-600">{title}</h3>
      {rows.length === 0 ? <EmptyState text="No sales recorded today" /> : rows.map((row) => (
        <div key={row.label} className="space-y-1">
          <div className="flex justify-between gap-3 text-[10px] font-black uppercase">
            <span className="truncate">{row.label}</span>
            <span>{row.value}</span>
          </div>
          <div className="h-2 border border-slate-200 bg-white">
            <div className="h-full bg-orange-600" style={{ width: `${Math.max(6, row.percent)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function WarningBox({ title, reason, severity, action }: { title: string; reason: string; severity: Severity; action: string }) {
  return (
    <div className={`border p-3 ${severityClass(severity)}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-black uppercase">{title}</h3>
        <span className="border border-current px-1.5 py-0.5 text-[8px] font-black uppercase">{severity}</span>
      </div>
      <p className="mt-2 text-[10px] font-bold uppercase leading-relaxed">{reason}</p>
      <button type="button" className="mt-3 inline-flex items-center gap-1 border border-current bg-white/60 px-2 py-1 text-[9px] font-black uppercase">
        {action}
        <ArrowRight className="h-3 w-3" />
      </button>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="border border-slate-200 bg-white p-3 text-center text-[10px] font-black uppercase text-slate-500">
      {text}
    </div>
  );
}

function Select({ label, value, options, optionLabels, onChange }: { label: string; value: string; options: string[]; optionLabels?: Record<string, string>; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="block text-[9px] font-black uppercase tracking-wide text-slate-400">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 min-h-9 w-full border border-slate-600 bg-slate-950 px-2 text-[11px] font-black uppercase text-white outline-none focus:border-orange-500"
      >
        {options.map((option) => <option key={option} value={option}>{optionLabels?.[option] || option}</option>)}
      </select>
    </label>
  );
}
