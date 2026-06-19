import { useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, FileText, Lock, Printer, Search } from 'lucide-react';
import type { BusinessProfile, CashLog, PosSession, Product, Transaction } from '../types';
import { sessionHasEffectivePermission } from '../auth/effectivePermissionService';

interface PosReportsProps {
  products: Product[];
  transactions: Transaction[];
  cashLogs: CashLog[];
  session: PosSession;
  businessProfile?: BusinessProfile;
}

type ReportDomainId =
  | 'sales-performance'
  | 'products'
  | 'cashiers'
  | 'branches'
  | 'customers'
  | 'discounts'
  | 'returns'
  | 'payments'
  | 'profitability'
  | 'business-intelligence'
  | 'executive-dashboard';

type ReportRow = Record<string, string | number>;

interface ReportDomain {
  id: ReportDomainId;
  label: string;
  permission: string;
}

interface ReportDefinition {
  id: string;
  title: string;
  domainId: ReportDomainId;
  permission: string;
  description: string;
}

interface ReportFilters {
  dateFrom: string;
  dateTo: string;
  branch: string;
}

const reportDomains: ReportDomain[] = [
  { id: 'sales-performance', label: 'Sales Performance', permission: 'reports.sales' },
  { id: 'products', label: 'Products', permission: 'reports.inventory' },
  { id: 'cashiers', label: 'Cashiers', permission: 'reports.sales' },
  { id: 'branches', label: 'Branches', permission: 'reports.sales' },
  { id: 'customers', label: 'Customers', permission: 'reports.sales' },
  { id: 'discounts', label: 'Discounts', permission: 'reports.sales' },
  { id: 'returns', label: 'Returns', permission: 'reports.sales' },
  { id: 'payments', label: 'Payments', permission: 'reports.accounting' },
  { id: 'profitability', label: 'Profitability', permission: 'reports.accounting' },
  { id: 'business-intelligence', label: 'Business Intelligence', permission: 'bi.view' },
  { id: 'executive-dashboard', label: 'Executive Dashboard', permission: 'reports.view' }
];

const reportDefinitions: ReportDefinition[] = [
  { id: 'daily-sales-summary', title: 'Daily Sales Summary', domainId: 'sales-performance', permission: 'reports.sales', description: 'Daily revenue, transaction count, item volume, discounts, and net sales.' },
  { id: 'sales-by-period', title: 'Sales By Period', domainId: 'sales-performance', permission: 'reports.sales', description: 'Sales grouped by business date for the selected period.' },
  { id: 'product-sales', title: 'Product Sales', domainId: 'products', permission: 'reports.inventory', description: 'Product quantity, revenue, cost, and margin ranking.' },
  { id: 'cashier-sales', title: 'Cashier Sales', domainId: 'cashiers', permission: 'reports.sales', description: 'Cashier revenue, transaction count, discounts, and average basket.' },
  { id: 'branch-sales', title: 'Branch Sales', domainId: 'branches', permission: 'reports.sales', description: 'Branch revenue, transaction count, and average basket.' },
  { id: 'customer-sales', title: 'Customer Sales', domainId: 'customers', permission: 'reports.sales', description: 'Customer spend, order count, last purchase, and average order value.' },
  { id: 'discount-analysis', title: 'Discount Analysis', domainId: 'discounts', permission: 'reports.sales', description: 'Discount value, discount rate, and discount exposure by receipt.' },
  { id: 'returns-analysis', title: 'Returns Analysis', domainId: 'returns', permission: 'reports.sales', description: 'Refunded, returned, and voided sales by receipt and cashier.' },
  { id: 'payment-method', title: 'Payment Method', domainId: 'payments', permission: 'reports.accounting', description: 'Payment mix and settlement value by payment method.' },
  { id: 'gross-profit', title: 'Gross Profit', domainId: 'profitability', permission: 'reports.accounting', description: 'Revenue, estimated COGS, gross profit, and margin.' },
  { id: 'sales-leakage', title: 'Sales Leakage', domainId: 'business-intelligence', permission: 'bi.view', description: 'Leakage signals from discounts, returns, voids, and cash variance.' },
  { id: 'sales-anomaly', title: 'Sales Anomaly', domainId: 'business-intelligence', permission: 'bi.view', description: 'Transactions outside normal value or discount guardrails.' },
  { id: 'executive-dashboard', title: 'Executive Dashboard', domainId: 'executive-dashboard', permission: 'reports.view', description: 'Owner-level commercial summary across sales, stock, profit, returns, and cash.' }
];

function money(value: number): string {
  return `USD ${value.toFixed(2)}`;
}

function dateKey(value?: string): string {
  return value ? value.slice(0, 10) : new Date().toISOString().slice(0, 10);
}

function branchForTransaction(transaction: Transaction, session: PosSession): string {
  return String((transaction as Transaction & { branch?: string; branchName?: string }).branch || (transaction as Transaction & { branchName?: string }).branchName || session.branch);
}

function saleCost(transaction: Transaction): number {
  return transaction.items.reduce((sum, item) => {
    const cost = item.unitCost ?? item.costPrice ?? item.price * 0.62;
    return sum + cost * item.quantity;
  }, 0);
}

function saleItemCount(transaction: Transaction): number {
  return transaction.items.reduce((sum, item) => sum + item.quantity, 0);
}

function groupRows(rows: ReportRow[], keyName: string, valueName: string): ReportRow[] {
  const grouped = new Map<string, { transactions: number; value: number; discount: number }>();
  rows.forEach((row) => {
    const key = String(row[keyName] || 'Unassigned');
    const current = grouped.get(key) || { transactions: 0, value: 0, discount: 0 };
    grouped.set(key, {
      transactions: current.transactions + 1,
      value: current.value + Number(row[valueName] || 0),
      discount: current.discount + Number(row.discountAmount || 0)
    });
  });
  return Array.from(grouped.entries()).map(([name, row]) => ({
    name,
    transactions: row.transactions,
    value: money(row.value),
    discounts: money(row.discount),
    averageBasket: money(row.transactions ? row.value / row.transactions : 0)
  }));
}

function exportFile(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function csvContent(rows: ReportRow[]): string {
  const headers = Object.keys(rows[0] || { report: 'No rows' });
  return [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => `"${String(row[header] ?? '').replace(/"/g, '""')}"`).join(','))
  ].join('\n');
}

function printReport(title: string, subtitle: string, rows: ReportRow[]): void {
  const headers = Object.keys(rows[0] || { report: 'No rows' });
  const printWindow = window.open('', '_blank', 'noopener,noreferrer');
  if (!printWindow) return;
  printWindow.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { color: #111827; font-family: Arial, sans-serif; padding: 24px; }
          h1 { color: #f26a1b; font-size: 22px; margin: 0 0 4px; }
          p { color: #475569; margin: 0 0 18px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #cbd5e1; font-size: 11px; padding: 8px; text-align: left; vertical-align: top; }
          th { background: #fff7ed; color: #9a3412; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <p>${subtitle}</p>
        <table>
          <thead><tr>${headers.map((header) => `<th>${header}</th>`).join('')}</tr></thead>
          <tbody>${rows.map((row) => `<tr>${headers.map((header) => `<td>${row[header] ?? ''}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

export default function PosReports({ products, transactions, cashLogs, session, businessProfile }: PosReportsProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [activeDomainId, setActiveDomainId] = useState<ReportDomainId>('sales-performance');
  const [activeReportId, setActiveReportId] = useState('daily-sales-summary');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<ReportFilters>({ dateFrom: today, dateTo: today, branch: 'ALL' });
  const tenantName = businessProfile?.legalName || businessProfile?.tradingName || session.vendor || 'Tenant';
  const canViewReports = sessionHasEffectivePermission(session, 'reports.view');
  const canExport = sessionHasEffectivePermission(session, 'reports.export');
  const canUsePermission = (permission: string) => canViewReports && (permission === 'reports.view' || sessionHasEffectivePermission(session, permission));
  const branchOptions = useMemo(() => {
    const branches = new Set<string>([session.branch]);
    transactions.forEach((transaction) => branches.add(branchForTransaction(transaction, session)));
    return ['ALL', ...Array.from(branches).filter(Boolean)];
  }, [session, transactions]);
  const visibleDomains = useMemo(() => reportDomains.filter((domain) => canUsePermission(domain.permission)), [canViewReports, session]);
  const visibleReports = useMemo(() => reportDefinitions.filter((report) => report.domainId === activeDomainId && canUsePermission(report.permission)), [activeDomainId, canViewReports, session]);

  useEffect(() => {
    if (visibleDomains.length > 0 && !visibleDomains.some((domain) => domain.id === activeDomainId)) {
      setActiveDomainId(visibleDomains[0].id);
    }
  }, [activeDomainId, visibleDomains]);

  useEffect(() => {
    if (visibleReports.length > 0 && !visibleReports.some((report) => report.id === activeReportId)) {
      setActiveReportId(visibleReports[0].id);
    }
  }, [activeReportId, visibleReports]);

  const activeReport = reportDefinitions.find((report) => report.id === activeReportId) || visibleReports[0];
  const reportRows = useMemo(() => buildRows(activeReportId, transactions, products, cashLogs, session, filters), [activeReportId, transactions, products, cashLogs, session, filters]);
  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return reportRows;
    return reportRows.filter((row) => Object.values(row).join(' ').toLowerCase().includes(normalized));
  }, [query, reportRows]);
  const totalRevenue = reportScopedTransactions(transactions, session, filters).reduce((sum, transaction) => sum + transaction.total, 0);
  const totalProfit = reportScopedTransactions(transactions, session, filters).reduce((sum, transaction) => sum + transaction.total - saleCost(transaction), 0);
  const returnCount = reportScopedTransactions(transactions, session, filters).filter((transaction) => ['RETURNED', 'REFUNDED', 'VOIDED'].includes(String(transaction.status).toUpperCase())).length;
  const subtitle = `${tenantName} | ${filters.branch === 'ALL' ? 'All branches' : filters.branch} | ${filters.dateFrom} to ${filters.dateTo}`;

  const exportExcel = () => exportFile(`${activeReportId}-${today}.xls`, csvContent(filteredRows), 'application/vnd.ms-excel;charset=utf-8');
  const exportPdf = () => printReport(activeReport?.title || 'Report', subtitle, filteredRows);
  const printActiveReport = () => printReport(activeReport?.title || 'Report', subtitle, filteredRows);

  if (!canViewReports) {
    return (
      <div className="reports-page reports-page--locked">
        <Lock size={26} />
        <h1>Reports access restricted</h1>
        <p>Your staff profile does not include reports.view.</p>
      </div>
    );
  }

  return (
    <div className="reports-page">
      <header className="reports-header">
        <div>
          <p>iTred Commerce OS</p>
          <h1>Reports</h1>
          <span>{tenantName} | {session.branch} | {session.terminal}</span>
        </div>
        <div className="reports-header-metrics">
          <div><span>Revenue</span><strong>{money(totalRevenue)}</strong></div>
          <div><span>Gross profit</span><strong>{money(totalProfit)}</strong></div>
          <div><span>Returns</span><strong>{returnCount}</strong></div>
        </div>
      </header>

      <nav className="reports-tabs" aria-label="Report domains">
        {visibleDomains.map((domain) => (
          <button key={domain.id} type="button" className={domain.id === activeDomainId ? 'active' : undefined} onClick={() => setActiveDomainId(domain.id)}>
            {domain.label}
          </button>
        ))}
      </nav>

      <section className="reports-workspace">
        <aside className="reports-list" aria-label="Available reports">
          {visibleReports.map((report) => (
            <button key={report.id} type="button" className={report.id === activeReportId ? 'active' : undefined} onClick={() => setActiveReportId(report.id)}>
              <strong>{report.title}</strong>
              <span>{report.description}</span>
            </button>
          ))}
        </aside>

        <main className="reports-panel">
          <div className="reports-panel-bar">
            <div>
              <p>{reportDomains.find((domain) => domain.id === activeDomainId)?.label}</p>
              <h2>{activeReport?.title || 'Report'}</h2>
              <span>{activeReport?.description}</span>
            </div>
            <div className="reports-actions">
              <label>
                <span>Date From</span>
                <input type="date" value={filters.dateFrom} onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))} />
              </label>
              <label>
                <span>Date To</span>
                <input type="date" value={filters.dateTo} onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))} />
              </label>
              <label>
                <span>Branch</span>
                <select value={filters.branch} onChange={(event) => setFilters((current) => ({ ...current, branch: event.target.value }))}>
                  {branchOptions.map((branch) => <option key={branch} value={branch}>{branch === 'ALL' ? 'All branches' : branch}</option>)}
                </select>
              </label>
              <label>
                <Search size={15} />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search report rows" />
              </label>
              <button type="button" onClick={exportPdf} disabled={!canExport}><FileText size={15} /> PDF</button>
              <button type="button" onClick={exportExcel} disabled={!canExport}><FileSpreadsheet size={15} /> Excel</button>
              <button type="button" onClick={printActiveReport}><Printer size={15} /> Print</button>
            </div>
          </div>

          <div className="reports-table-wrap">
            <table className="reports-table">
              <thead>
                <tr>{Object.keys(filteredRows[0] || { status: 'No rows' }).map((header) => <th key={header}>{header}</th>)}</tr>
              </thead>
              <tbody>
                {filteredRows.map((row, index) => (
                  <tr key={`${activeReportId}-${index}`}>
                    {Object.keys(filteredRows[0] || row).map((key) => <td key={key}>{row[key]}</td>)}
                  </tr>
                ))}
                {filteredRows.length === 0 && <tr><td>No report rows match the current filters.</td></tr>}
              </tbody>
            </table>
          </div>
        </main>
      </section>
    </div>
  );
}

function reportScopedTransactions(transactions: Transaction[], session: PosSession, filters: ReportFilters): Transaction[] {
  return transactions.filter((transaction) => {
    const rowDate = dateKey(transaction.date);
    const rowBranch = branchForTransaction(transaction, session);
    return rowDate >= filters.dateFrom &&
      rowDate <= filters.dateTo &&
      (filters.branch === 'ALL' || rowBranch === filters.branch);
  });
}

function buildBaseRows(transactions: Transaction[], session: PosSession, filters: ReportFilters): ReportRow[] {
  return reportScopedTransactions(transactions, session, filters).map((transaction) => ({
    receipt: transaction.invoiceNo,
    date: dateKey(transaction.date),
    cashier: transaction.operator || session.staffName,
    branch: branchForTransaction(transaction, session),
    customer: transaction.customerName || 'Walk-in customer',
    payment: transaction.paymentMethod,
    status: transaction.status,
    itemCount: saleItemCount(transaction),
    discountAmount: transaction.discount || 0,
    total: transaction.total || 0,
    cost: saleCost(transaction),
    profit: (transaction.total || 0) - saleCost(transaction)
  }));
}

function buildRows(reportId: string, transactions: Transaction[], products: Product[], cashLogs: CashLog[], session: PosSession, filters: ReportFilters): ReportRow[] {
  const rows = buildBaseRows(transactions, session, filters);
  const sales = reportScopedTransactions(transactions, session, filters).filter((transaction) => String(transaction.status).toUpperCase() !== 'VOIDED');
  const returns = reportScopedTransactions(transactions, session, filters).filter((transaction) => ['RETURNED', 'REFUNDED', 'VOIDED'].includes(String(transaction.status).toUpperCase()));

  if (reportId === 'daily-sales-summary') {
    return [
      { metric: 'Gross sales', value: money(rows.reduce((sum, row) => sum + Number(row.total), 0)), scope: `${filters.dateFrom} to ${filters.dateTo}` },
      { metric: 'Transactions', value: rows.length, scope: filters.branch === 'ALL' ? 'All branches' : filters.branch },
      { metric: 'Items sold', value: rows.reduce((sum, row) => sum + Number(row.itemCount), 0), scope: 'Sold quantity' },
      { metric: 'Discounts', value: money(rows.reduce((sum, row) => sum + Number(row.discountAmount), 0)), scope: 'Discount value' },
      { metric: 'Average order', value: money(rows.length ? rows.reduce((sum, row) => sum + Number(row.total), 0) / rows.length : 0), scope: 'Basket value' }
    ];
  }

  if (reportId === 'sales-by-period') return groupRows(rows, 'date', 'total');

  if (reportId === 'product-sales' || reportId === 'gross-profit') {
    const grouped = new Map<string, { product: string; quantity: number; revenue: number; cost: number }>();
    sales.forEach((sale) => sale.items.forEach((item) => {
      const sku = item.code || item.productId;
      const product = products.find((row) => row.id === item.productId || row.code === item.code);
      const current = grouped.get(sku) || { product: product?.name || item.name || sku, quantity: 0, revenue: 0, cost: 0 };
      const unitCost = item.unitCost ?? item.costPrice ?? product?.cost ?? item.price * 0.62;
      grouped.set(sku, {
        product: current.product,
        quantity: current.quantity + item.quantity,
        revenue: current.revenue + item.total,
        cost: current.cost + unitCost * item.quantity
      });
    }));
    return Array.from(grouped.entries()).map(([sku, row]) => ({
      sku,
      product: row.product,
      quantity: row.quantity,
      revenue: money(row.revenue),
      estimatedCogs: money(row.cost),
      grossProfit: money(row.revenue - row.cost),
      margin: `${row.revenue ? (((row.revenue - row.cost) / row.revenue) * 100).toFixed(1) : '0.0'}%`
    }));
  }

  if (reportId === 'cashier-sales') return groupRows(rows, 'cashier', 'total');
  if (reportId === 'branch-sales') return groupRows(rows, 'branch', 'total');
  if (reportId === 'customer-sales') return groupRows(rows, 'customer', 'total');
  if (reportId === 'payment-method') return groupRows(rows, 'payment', 'total');

  if (reportId === 'discount-analysis') {
    return rows
      .filter((row) => Number(row.discountAmount) > 0)
      .map((row) => ({
        receipt: row.receipt,
        date: row.date,
        cashier: row.cashier,
        customer: row.customer,
        discount: money(Number(row.discountAmount)),
        grossSale: money(Number(row.total) + Number(row.discountAmount)),
        discountRate: `${Number(row.total) + Number(row.discountAmount) > 0 ? ((Number(row.discountAmount) / (Number(row.total) + Number(row.discountAmount))) * 100).toFixed(1) : '0.0'}%`
      }));
  }

  if (reportId === 'returns-analysis') {
    return returns.map((transaction) => ({
      receipt: transaction.invoiceNo,
      date: dateKey(transaction.date),
      branch: branchForTransaction(transaction, session),
      cashier: transaction.operator || session.staffName,
      customer: transaction.customerName || 'Walk-in customer',
      status: transaction.status,
      value: money(transaction.total || 0)
    }));
  }

  if (reportId === 'executive-dashboard') {
    const revenue = rows.reduce((sum, row) => sum + Number(row.total), 0);
    const cogs = rows.reduce((sum, row) => sum + Number(row.cost), 0);
    const lowStock = products.filter((product) => (product.stock ?? product.qtyOnHand ?? product.availableStock ?? 0) <= (product.minStock || 5)).length;
    return [
      { metric: 'Net revenue', value: money(revenue), status: 'Selected period' },
      { metric: 'Gross profit', value: money(revenue - cogs), status: 'Estimated from product cost' },
      { metric: 'Gross margin', value: `${revenue ? (((revenue - cogs) / revenue) * 100).toFixed(1) : '0.0'}%`, status: 'Commercial margin' },
      { metric: 'Active products', value: products.length, status: 'Catalog coverage' },
      { metric: 'Low stock products', value: lowStock, status: lowStock > 0 ? 'Needs reorder review' : 'Controlled' },
      { metric: 'Cash movements', value: cashLogs.length, status: 'Drawer activity' },
      { metric: 'Return exposure', value: returns.length, status: returns.length > 0 ? 'Review' : 'Clear' }
    ];
  }

  if (reportId === 'sales-leakage') {
    const discountLeakage = rows.reduce((sum, row) => sum + Number(row.discountAmount), 0);
    const cashVarianceSignals = cashLogs.filter((log) => String(log.reason).toLowerCase().includes('variance')).length;
    return [
      { signal: 'Discount leakage', value: money(discountLeakage), risk: discountLeakage > 0 ? 'Review' : 'Clear', action: discountLeakage > 0 ? 'Audit discounted receipts' : 'No action required' },
      { signal: 'Return / void leakage', value: returns.length, risk: returns.length > 0 ? 'Review' : 'Clear', action: returns.length > 0 ? 'Review return authorisations' : 'No action required' },
      { signal: 'Cash variance signals', value: cashVarianceSignals, risk: cashVarianceSignals > 0 ? 'Review' : 'Clear', action: cashVarianceSignals > 0 ? 'Reconcile drawer variances' : 'No action required' }
    ];
  }

  if (reportId === 'sales-anomaly') {
    const average = rows.length ? rows.reduce((sum, row) => sum + Number(row.total), 0) / rows.length : 0;
    return rows
      .filter((row) => Number(row.total) > average * 1.8 || Number(row.discountAmount) > Math.max(1, Number(row.total)) * 0.2)
      .map((row) => ({
        receipt: row.receipt,
        date: row.date,
        branch: row.branch,
        cashier: row.cashier,
        customer: row.customer,
        total: money(Number(row.total)),
        reason: Number(row.total) > average * 1.8 ? 'High-value sale' : 'High discount ratio'
      }));
  }

  return rows.map((row) => ({
    receipt: row.receipt,
    date: row.date,
    branch: row.branch,
    cashier: row.cashier,
    customer: row.customer,
    payment: row.payment,
    total: money(Number(row.total))
  }));
}
