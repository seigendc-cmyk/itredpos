import { Download, Printer, X } from 'lucide-react';
import { useState } from 'react';
import type { Product, Sale, SalesProfitSnapshotFilter, SalesProfitSnapshotPayload, SalesProfitPeriod } from '../types';
import {
  generateSalesProfitSnapshot,
  getSalesProfitDefaultFilter,
  recordSalesProfitSnapshotExportPlaceholder,
  recordSalesProfitSnapshotPrintPlaceholder
} from '../services/salesProfitService';

interface SalesProfitSnapshotCardProps {
  open: boolean;
  allowed: boolean;
  canGenerate: boolean;
  canExport: boolean;
  canPrint: boolean;
  sales: Sale[];
  products: Product[];
  generatedBy: string;
  branchName: string;
  terminalName: string;
  cashierName: string;
  onClose: () => void;
  onNotice: (message: string) => void;
}

const periods: SalesProfitPeriod[] = ['Today', 'Current Shift', 'Yesterday', 'This Week', 'This Month', 'Custom'];

function money(value: number): string {
  return `USD ${value.toFixed(2)}`;
}

export default function SalesProfitSnapshotCard({
  open,
  allowed,
  canGenerate,
  canExport,
  canPrint,
  sales,
  products,
  generatedBy,
  branchName,
  terminalName,
  cashierName,
  onClose,
  onNotice
}: SalesProfitSnapshotCardProps) {
  const [filter, setFilter] = useState<SalesProfitSnapshotFilter>(() => getSalesProfitDefaultFilter());
  const [payload, setPayload] = useState<SalesProfitSnapshotPayload | null>(null);

  if (!open) return null;

  const generate = () => {
    if (!allowed || !canGenerate) {
      onNotice('You do not have permission to generate Sales Profit Snapshot.');
      return;
    }
    if (filter.period === 'Custom' && (!filter.dateFrom || !filter.dateTo)) {
      onNotice('Custom period requires Date From and Date To.');
      return;
    }
    setPayload(generateSalesProfitSnapshot(filter, sales, products, generatedBy, { branchName, terminalName, cashierName }));
  };

  const exportCsv = () => {
    recordSalesProfitSnapshotExportPlaceholder(generatedBy);
    if (!payload) {
      onNotice('Sales Profit Snapshot export prepared locally. Generate a snapshot to include calculated values.');
      return;
    }
    const rows = [
      ['Metric', 'Value'],
      ['Gross Sales Revenue', payload.grossSalesRevenue.toFixed(2)],
      ['COGS', payload.cogs.toFixed(2)],
      ['Gross Profit', payload.grossProfit.toFixed(2)],
      ['Drawer Expenses', payload.drawerExpenses.toFixed(2)],
      ['Drawer Net Profit', payload.netDrawerProfit.toFixed(2)]
    ];
    const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sales-profit-snapshot-${payload.snapshotId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    onNotice('Sales Profit Snapshot CSV prepared locally.');
  };

  return (
    <div className="floating-cart-backdrop sales-profit-backdrop" onClick={onClose}>
      <section id="sales-profit-print-area" className="sales-profit-card" onClick={(event) => event.stopPropagation()} aria-label="Sales Profit Snapshot">
        <header className="floating-cart-card-header no-print">
          <div>
            <p className="sci-pos-eyebrow">Owner / Manager Estimate</p>
            <h3>Sales Profit Snapshot</h3>
            <span>Gross sales revenue less COGS less drawer expenses for selected period.</span>
          </div>
          <button type="button" className="sci-pos-icon-button" onClick={onClose} aria-label="Close sales profit snapshot"><X size={16} /></button>
        </header>

        {!allowed ? (
          <div className="sales-profit-restricted">You do not have permission to view Sales Profit Snapshot.</div>
        ) : (
          <>
            <div className="sales-profit-filters">
              <label>Period<select value={filter.period} onChange={(event) => setFilter({ ...filter, period: event.target.value as SalesProfitPeriod })}>{periods.map((period) => <option key={period} value={period}>{period}</option>)}</select></label>
              <label>Date From<input type="date" value={filter.dateFrom || ''} onChange={(event) => setFilter({ ...filter, dateFrom: event.target.value })} /></label>
              <label>Date To<input type="date" value={filter.dateTo || ''} onChange={(event) => setFilter({ ...filter, dateTo: event.target.value })} /></label>
              <label>Branch<input value={filter.branchId || branchName} onChange={(event) => setFilter({ ...filter, branchId: event.target.value })} /></label>
              <label>Terminal<input value={filter.terminalId || terminalName} onChange={(event) => setFilter({ ...filter, terminalId: event.target.value })} /></label>
              <label>Cashier<input value={filter.cashierStaffId || cashierName} onChange={(event) => setFilter({ ...filter, cashierStaffId: event.target.value })} /></label>
              <label className="sales-profit-check"><input type="checkbox" checked={Boolean(filter.includeReturns)} onChange={(event) => setFilter({ ...filter, includeReturns: event.target.checked })} /> Include Returns</label>
              <label className="sales-profit-check"><input type="checkbox" checked={Boolean(filter.includeDiscounts)} onChange={(event) => setFilter({ ...filter, includeDiscounts: event.target.checked })} /> Include Discounts</label>
              <label className="sales-profit-check"><input type="checkbox" checked={Boolean(filter.includeDeliveryFees)} onChange={(event) => setFilter({ ...filter, includeDeliveryFees: event.target.checked })} /> Include Delivery Fees</label>
              <label className="sales-profit-check"><input type="checkbox" checked={filter.includeDrawerExpenses !== false} onChange={(event) => setFilter({ ...filter, includeDrawerExpenses: event.target.checked, includeOpex: event.target.checked })} /> Include Drawer Expenses</label>
            </div>

            <div className="sales-profit-formula">
              <div><span>Gross Sales Revenue</span><strong>{money(payload?.grossSalesRevenue || 0)}</strong></div>
              <div><span>less COGS</span><strong>{money(payload?.cogs || 0)}</strong></div>
              <div className="sales-profit-subtotal"><span>= Gross Profit</span><strong>{money(payload?.grossProfit || 0)}</strong></div>
              <div><span>less Drawer Expenses / OPEX</span><strong>{money(payload?.drawerExpenses || payload?.opex || 0)}</strong></div>
              <div className="sales-profit-net"><span>= Drawer Net Profit</span><strong>{money(payload?.netDrawerProfit || 0)}</strong></div>
            </div>

            <div className="sales-profit-metrics">
              <span>Sales Count <strong>{payload?.salesCount || 0}</strong></span>
              <span>Items Sold <strong>{payload?.itemCount || 0}</strong></span>
              <span>Average Gross Margin <strong>{(payload?.averageGrossMargin || 0).toFixed(1)}%</strong></span>
              <span>Period <strong>{payload?.period || filter.period}</strong></span>
              <span>Branch <strong>{payload?.branchName || branchName}</strong></span>
              <span>Terminal <strong>{payload?.terminalName || terminalName}</strong></span>
              <span>Cashier <strong>{payload?.cashierName || cashierName}</strong></span>
              <span>Generated By <strong>{payload?.generatedBy || generatedBy}</strong></span>
              <span>Generated At <strong>{payload ? new Date(payload.generatedAt).toLocaleString() : '-'}</strong></span>
            </div>

            <details className="sales-profit-expenses" open>
              <summary>Drawer Expenses Breakdown</summary>
              <div className="sales-profit-expense-table">
                <table>
                  <thead>
                    <tr>
                      <th>Expense Type</th>
                      <th>Amount</th>
                      <th>Note</th>
                      <th>Staff</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(payload?.drawerExpenseBreakdown || []).map((expense) => (
                      <tr key={expense.expenseId}>
                        <td>{expense.expenseType}</td>
                        <td>{money(expense.amount)}</td>
                        <td>{expense.note}</td>
                        <td>{expense.staff}</td>
                        <td>{new Date(expense.time).toLocaleString()}</td>
                      </tr>
                    ))}
                    {!payload && (
                      <tr>
                        <td colSpan={5} className="sci-pos-empty-cell">Generate Snapshot to view local drawer expense estimates.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </details>

            <p className="sales-profit-note">{payload?.notes || 'Generate a local operational estimate. No accounting, cashbook, sale, receipt, inventory, or delivery records will be changed.'}</p>
          </>
        )}

        <footer className="floating-cart-card-footer no-print">
          <button type="button" className="sci-pos-button sci-pos-button--primary" disabled={!allowed || !canGenerate} onClick={generate}>Generate Snapshot</button>
          <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => { setFilter(getSalesProfitDefaultFilter()); setPayload(null); }}>Clear Filters</button>
          <button type="button" className="sci-pos-button sci-pos-button--secondary" disabled={!allowed || !canPrint} onClick={() => { recordSalesProfitSnapshotPrintPlaceholder(generatedBy); onNotice('Sales Profit Snapshot print prepared locally.'); window.print(); }}><Printer size={16} /> Print Snapshot</button>
          <button type="button" className="sci-pos-button sci-pos-button--secondary" disabled={!allowed || !canExport} onClick={exportCsv}><Download size={16} /> Export CSV Placeholder</button>
          <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={onClose}>Close</button>
        </footer>
      </section>
    </div>
  );
}
