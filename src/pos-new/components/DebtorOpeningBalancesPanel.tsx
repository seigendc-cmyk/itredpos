import { useEffect, useState } from 'react';
import type { CustomerRecord, DebtorOpeningBalance } from '../types';
import { approveDebtorOpeningBalance, createDebtorOpeningBalance, getDebtorOpeningBalances, postDebtorOpeningBalance, rejectDebtorOpeningBalance, reverseDebtorOpeningBalance } from '../services/customerCreditService';
import RowActionMenu from './RowActionMenu';

interface DebtorOpeningBalancesPanelProps {
  customers: CustomerRecord[];
  selectedCustomerId?: string;
  staffName: string;
  canApprove: boolean;
  onNotice: (message: string) => void;
  onChanged?: () => void;
}

function money(value: number): string {
  return `USD ${value.toFixed(2)}`;
}

export default function DebtorOpeningBalancesPanel({ customers, selectedCustomerId = '', staffName, canApprove, onNotice, onChanged }: DebtorOpeningBalancesPanelProps) {
  const [customerId, setCustomerId] = useState(selectedCustomerId || customers[0]?.customerId || '');
  const [rows, setRows] = useState<DebtorOpeningBalance[]>([]);
  const [reference, setReference] = useState(`OB-${Date.now().toString().slice(-5)}`);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [originalAmount, setOriginalAmount] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const load = () => setRows(getDebtorOpeningBalances({ customerId: customerId || undefined }));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const customer = customers.find((item) => item.customerId === customerId) || customers[0] || null;
  const outstandingAmount = Math.max(0, originalAmount - paidAmount);

  const create = async (status: 'Draft' | 'PendingApproval') => {
    if (!customer) return;
    await createDebtorOpeningBalance({ customerId: customer.customerId, customerName: customer.customerName, openingReference: reference, openingBalanceDate: date, originalAmount, paidAmount, outstandingAmount, dueDate, notes: notes || 'Opening debtor balance captured locally.', importedBy: staffName, status });
    onNotice(status === 'Draft' ? 'Opening balance draft created locally.' : 'Opening balance submitted for approval locally.');
    load();
    onChanged?.();
  };

  const action = async (row: DebtorOpeningBalance, type: 'Approve' | 'Post' | 'Reject' | 'Reverse') => {
    if (type === 'Approve') await approveDebtorOpeningBalance(row.openingBalanceId, staffName, notes || 'Approved locally.');
    if (type === 'Post') await postDebtorOpeningBalance(row.openingBalanceId);
    if (type === 'Reject') await rejectDebtorOpeningBalance(row.openingBalanceId, notes || 'Rejected locally.');
    if (type === 'Reverse') await reverseDebtorOpeningBalance(row.openingBalanceId, notes || 'Reversed.', staffName);
    onNotice(`Opening balance ${type.toLowerCase()} action completed.`);
    load();
    onChanged?.();
  };

  return (
    <section className="sci-pos-card debtor-control-panel">
      <div className="sci-pos-card__bar"><div><p className="sci-pos-eyebrow">Opening Balances</p><h2>Debtor Opening Balances</h2></div><span>{rows.length} records</span></div>
      <div className="pos-credit-config-grid">
        <label>Customer<select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>{customers.map((item) => <option key={item.customerId} value={item.customerId}>{item.customerName}</option>)}</select></label>
        <label>Opening Reference<input value={reference} onChange={(event) => setReference(event.target.value)} /></label>
        <label>Opening Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        <label>Original Amount<input type="number" value={originalAmount} onChange={(event) => setOriginalAmount(Number(event.target.value))} /></label>
        <label>Paid Amount<input type="number" value={paidAmount} onChange={(event) => setPaidAmount(Number(event.target.value))} /></label>
        <label>Outstanding<input readOnly value={outstandingAmount.toFixed(2)} /></label>
        <label>Due Date<input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
        <label className="pos-credit-config-grid__wide">Notes<textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
      </div>
      <div className="pos-new-customer-modal__actions">
        <button type="button" className="pos-action-button pos-action-button-secondary" onClick={() => void create('Draft')}>Create Draft</button>
        <button type="button" className="pos-action-button pos-action-button-primary" onClick={() => void create('PendingApproval')}>Submit for Approval</button>
      </div>
      <div className="collection-diary-table-scroll">
        <table className="sci-pos-table collection-diary-table">
          <thead><tr><th>Reference</th><th>Date</th><th>Original</th><th>Paid</th><th>Outstanding</th><th>Due</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {rows.map((row) => <tr key={row.openingBalanceId}><td>{row.openingReference}</td><td>{row.openingBalanceDate}</td><td>{money(row.originalAmount)}</td><td>{money(row.paidAmount)}</td><td>{money(row.outstandingAmount)}</td><td>{row.dueDate}</td><td>{row.status}</td><td><RowActionMenu rowId={row.openingBalanceId} ariaLabel={`Opening balance actions for ${row.openingReference}`} open={openMenuId === row.openingBalanceId} onOpenChange={(open) => setOpenMenuId(open ? row.openingBalanceId : null)} items={[{ id: 'approve', label: 'Approve', disabled: !canApprove, onClick: () => void action(row, 'Approve') }, { id: 'post', label: 'Post', disabled: !canApprove, onClick: () => void action(row, 'Post') }, { id: 'reject', label: 'Reject', disabled: !canApprove, danger: true, separatorBefore: true, onClick: () => void action(row, 'Reject') }, { id: 'reverse', label: 'Reverse', disabled: !canApprove, danger: true, onClick: () => void action(row, 'Reverse') }]} /></td></tr>)}
            {rows.length === 0 && <tr><td colSpan={8}>No opening balances found.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
