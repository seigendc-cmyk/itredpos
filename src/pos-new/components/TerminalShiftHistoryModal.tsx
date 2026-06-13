import { useMemo, useState } from 'react';
import { FileText, Printer, X } from 'lucide-react';
import type { BiEvent, CashLog, Shift, TerminalControlEvent, Transaction } from '../types';

interface TerminalShiftHistoryModalProps {
  open: boolean;
  shift: Shift | null;
  terminalId: string;
  branchName: string;
  staffName: string;
  roleName: string;
  transactions: Transaction[];
  biEvents: BiEvent[];
  cashLogs: CashLog[];
  controlEvents: TerminalControlEvent[];
  onClose: () => void;
}

type HistoryTab = 'Summary' | 'Sales' | 'Payments' | 'VAT' | 'Cash Variance' | 'Activity' | 'BI Events';

const tabs: HistoryTab[] = ['Summary', 'Sales', 'Payments', 'VAT', 'Cash Variance', 'Activity', 'BI Events'];

function money(value: number): string {
  return `USD ${value.toFixed(2)}`;
}

function formatDate(value?: string): string {
  if (!value) return 'Not recorded';
  return new Date(value).toLocaleString();
}

function duration(start?: string, end?: string): string {
  if (!start || !end) return 'Open or unavailable';
  const minutes = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}h ${remainder}m`;
}

export default function TerminalShiftHistoryModal({
  open,
  shift,
  terminalId,
  branchName,
  staffName,
  roleName,
  transactions,
  biEvents,
  cashLogs,
  controlEvents,
  onClose
}: TerminalShiftHistoryModalProps) {
  const [activeTab, setActiveTab] = useState<HistoryTab>('Summary');

  const totals = useMemo(() => {
    const completed = transactions.filter((transaction) => transaction.status === 'COMPLETED');
    const gross = completed.reduce((sum, transaction) => sum + transaction.total, 0);
    const vat = completed.reduce((sum, transaction) => sum + (transaction.tax || 0), 0);
    const cash = completed.filter((transaction) => transaction.paymentMethod === 'CASH' || transaction.paymentMethod === 'Cash').reduce((sum, transaction) => sum + transaction.total, 0);
    const card = gross - cash;
    return { completed, gross, vat, cash, card };
  }, [transactions]);

  if (!open || !shift) return null;

  const expectedCash = shift.expectedCash || shift.startingCash + totals.cash;
  const countedCash = shift.actualCash ?? expectedCash;
  const variance = shift.difference ?? countedCash - expectedCash;
  const drawerEvents = controlEvents.filter((event) => event.eventType.toLowerCase().includes('drawer'));

  return (
    <div className="shift-control-modal-backdrop" role="presentation">
      <section className="shift-control-modal shift-control-modal--wide" role="dialog" aria-modal="true" aria-labelledby="terminal-history-title">
        <header className="shift-control-modal__header">
          <div>
            <p className="sci-pos-eyebrow">Detailed activity for the selected terminal session.</p>
            <h2 id="terminal-history-title">Terminal Active Period History</h2>
          </div>
          <button type="button" className="sci-icon-button" onClick={onClose} aria-label="Close terminal history">
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="shift-history-tabs" role="tablist" aria-label="Terminal history sections">
          {tabs.map((tab) => (
            <button key={tab} type="button" className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>
              {tab}
            </button>
          ))}
        </div>
        <div className="shift-control-modal__body">
          {activeTab === 'Summary' && (
            <div className="shift-history-detail-grid">
              <div><span>Terminal</span><strong>{terminalId}</strong></div>
              <div><span>Branch</span><strong>{branchName}</strong></div>
              <div><span>Staff</span><strong>{shift.operator || staffName}</strong></div>
              <div><span>Role</span><strong>{roleName}</strong></div>
              <div><span>Shift Opened At</span><strong>{formatDate(shift.startTime)}</strong></div>
              <div><span>Shift Closed At</span><strong>{formatDate(shift.endTime)}</strong></div>
              <div><span>Active Duration</span><strong>{duration(shift.startTime, shift.endTime)}</strong></div>
              <div><span>Opening Float</span><strong>{money(shift.startingCash)}</strong></div>
              <div><span>Expected Cash</span><strong>{money(expectedCash)}</strong></div>
              <div><span>Counted Cash</span><strong>{money(countedCash)}</strong></div>
              <div><span>Cash Variance</span><strong>{money(variance)}</strong></div>
              <div><span>Sales Count</span><strong>{shift.salesCount || totals.completed.length}</strong></div>
              <div><span>Gross Sales</span><strong>{money(shift.totalSales || totals.gross)}</strong></div>
              <div><span>VAT Amount</span><strong>{money(totals.vat)}</strong></div>
              <div><span>Payment Breakdown</span><strong>Cash {money(totals.cash)} / Other {money(totals.card)}</strong></div>
              <div><span>Drawer Open Count</span><strong>{drawerEvents.length}</strong></div>
              <div><span>Refunds / Voids</span><strong>0 / 0</strong></div>
              <div><span>Delivery Cash Pending</span><strong>{money(0)}</strong></div>
              <div><span>BI Events Count</span><strong>{biEvents.length}</strong></div>
              <div><span>Cash Logs Count</span><strong>{cashLogs.length}</strong></div>
            </div>
          )}
          {activeTab === 'Sales' && (
            <div className="sci-pos-table-wrap">
              <table className="sci-pos-table">
                <thead><tr><th>Invoice</th><th>Customer</th><th>Total</th><th>Status</th></tr></thead>
                <tbody>{totals.completed.map((transaction) => <tr key={transaction.id}><td>{transaction.invoiceNo}</td><td>{transaction.customerName}</td><td>{money(transaction.total)}</td><td>{transaction.status}</td></tr>)}</tbody>
              </table>
            </div>
          )}
          {activeTab === 'Payments' && <div className="shift-history-detail-grid"><div><span>Cash</span><strong>{money(totals.cash)}</strong></div><div><span>Other Payments</span><strong>{money(totals.card)}</strong></div></div>}
          {activeTab === 'VAT' && <div className="shift-history-detail-grid"><div><span>Taxable Sales</span><strong>{money(Math.max(0, totals.gross - totals.vat))}</strong></div><div><span>VAT Amount</span><strong>{money(totals.vat)}</strong></div></div>}
          {activeTab === 'Cash Variance' && <div className="shift-history-detail-grid"><div><span>Expected Cash</span><strong>{money(expectedCash)}</strong></div><div><span>Counted Cash</span><strong>{money(countedCash)}</strong></div><div><span>Variance</span><strong>{money(variance)}</strong></div></div>}
          {activeTab === 'Activity' && <div className="pos-audit-feed">{controlEvents.map((event) => <div key={event.id}><strong>{event.eventType}</strong><span>{event.message}</span><small>{formatDate(event.createdAt)}</small></div>)}</div>}
          {activeTab === 'BI Events' && <div className="pos-audit-feed">{biEvents.map((event) => <div key={event.id}><strong>{event.eventType}</strong><span>{String(event.payload?.details || event.severity)}</span><small>{formatDate(event.timestamp)}</small></div>)}</div>}
        </div>
        <footer className="shift-control-modal__footer">
          <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => window.print()}>
            <Printer size={16} aria-hidden="true" />
            Print History
          </button>
          <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => window.print()}>
            <FileText size={16} aria-hidden="true" />
            Prepare PDF / Save as PDF through device print dialog
          </button>
          <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={onClose}>Close</button>
        </footer>
      </section>
    </div>
  );
}
