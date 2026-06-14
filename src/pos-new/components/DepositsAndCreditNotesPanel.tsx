import { useEffect, useMemo, useState } from 'react';
import type { CustomerCreditNote, CustomerDepositRecord, CustomerDepositSource, CustomerRecord } from '../types';
import { applyCreditNoteToDebt, applyCustomerDepositToDebt, approveCustomerCreditNote, createCustomerCreditNote, getCustomerCreditNotes, getCustomerDebtRecords, getCustomerDeposits, receiveCustomerDeposit, refundCustomerDeposit } from '../services/customerCreditService';

interface DepositsAndCreditNotesPanelProps {
  customers: CustomerRecord[];
  selectedCustomerId?: string;
  staffName: string;
  canApprove: boolean;
  onNotice: (message: string) => void;
}

const sources: CustomerDepositSource[] = ['Cash', 'EcoCashPlaceholder', 'InnbucksPlaceholder', 'MukuruPlaceholder', 'BankTransfer', 'CardPlaceholder', 'Other'];

function money(value: number): string {
  return `USD ${value.toFixed(2)}`;
}

export default function DepositsAndCreditNotesPanel({ customers, selectedCustomerId = '', staffName, canApprove, onNotice }: DepositsAndCreditNotesPanelProps) {
  const [customerId, setCustomerId] = useState(selectedCustomerId || customers[0]?.customerId || '');
  const [deposits, setDeposits] = useState<CustomerDepositRecord[]>([]);
  const [creditNotes, setCreditNotes] = useState<CustomerCreditNote[]>([]);
  const [debts, setDebts] = useState<Array<{ debtId: string; receiptNumber: string; outstandingAmount: number }>>([]);
  const [amount, setAmount] = useState(0);
  const [source, setSource] = useState<CustomerDepositSource>('Cash');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedDebtId, setSelectedDebtId] = useState('');

  const load = async () => {
    setDeposits(getCustomerDeposits({ customerId }));
    setCreditNotes(getCustomerCreditNotes({ customerId }));
    const debtRows = await getCustomerDebtRecords({ customerId });
    setDebts(debtRows.filter((debt) => debt.outstandingAmount > 0).map((debt) => ({ debtId: debt.debtId, receiptNumber: debt.receiptNumber, outstandingAmount: debt.outstandingAmount })));
    if (!selectedDebtId && debtRows[0]) setSelectedDebtId(debtRows[0].debtId);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const customer = customers.find((item) => item.customerId === customerId) || customers[0] || null;
  const today = new Date().toISOString().slice(0, 10);
  const summary = useMemo(() => ({
    totalDepositBalances: deposits.reduce((sum, deposit) => sum + deposit.balance, 0),
    depositsReceivedToday: deposits.filter((deposit) => deposit.receivedAt.slice(0, 10) === today).reduce((sum, deposit) => sum + deposit.amountReceived, 0),
    depositsAppliedToday: deposits.reduce((sum, deposit) => sum + deposit.amountApplied, 0),
    depositsRefundedToday: deposits.filter((deposit) => deposit.refundedAt?.slice(0, 10) === today).reduce((sum, deposit) => sum + (deposit.refundedAmount || 0), 0),
    creditNotesPending: creditNotes.filter((note) => note.status === 'PendingApproval').length,
    creditNotesAvailable: creditNotes.reduce((sum, note) => sum + note.balance, 0),
    creditNotesAppliedToday: creditNotes.filter((note) => note.appliedAt?.slice(0, 10) === today).reduce((sum, note) => sum + note.amountApplied, 0)
  }), [creditNotes, deposits, today]);

  const receiveDeposit = async () => {
    if (!customer) return;
    await receiveCustomerDeposit({ customerId: customer.customerId, customerName: customer.customerName, amountReceived: amount, source, paymentReference: reference || `DEP-${Date.now()}`, receivedBy: staffName, notes: notes || 'Customer deposit received locally.' });
    onNotice('Customer deposit received locally.');
    await load();
  };

  const createNote = async () => {
    if (!customer) return;
    await createCustomerCreditNote({ customerId: customer.customerId, customerName: customer.customerName, linkedDebtId: selectedDebtId || undefined, reason: notes || 'Customer credit note placeholder.', originalAmount: amount, createdBy: staffName, notes });
    onNotice('Credit note created and sent for local approval.');
    await load();
  };

  return (
    <section className="sci-pos-card debtor-control-panel">
      <div className="sci-pos-card__bar"><div><p className="sci-pos-eyebrow">Debtors</p><h2>Deposits & Credit Notes</h2></div><span>{customer?.customerName || 'No customer'}</span></div>
      <div className="collection-diary-summary-grid">
        {[
          ['Total Deposit Balances', money(summary.totalDepositBalances)],
          ['Deposits Received Today', money(summary.depositsReceivedToday)],
          ['Deposits Applied', money(summary.depositsAppliedToday)],
          ['Deposits Refunded Today', money(summary.depositsRefundedToday)],
          ['Credit Notes Pending Approval', summary.creditNotesPending],
          ['Credit Notes Available', money(summary.creditNotesAvailable)],
          ['Credit Notes Applied Today', money(summary.creditNotesAppliedToday)]
        ].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
      </div>
      <div className="pos-credit-config-grid">
        <label>Customer<select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>{customers.map((item) => <option key={item.customerId} value={item.customerId}>{item.customerName}</option>)}</select></label>
        <label>Amount<input type="number" value={amount} onChange={(event) => setAmount(Number(event.target.value))} /></label>
        <label>Deposit Source<select value={source} onChange={(event) => setSource(event.target.value as CustomerDepositSource)}>{sources.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Reference<input value={reference} onChange={(event) => setReference(event.target.value)} /></label>
        <label>Debt<select value={selectedDebtId} onChange={(event) => setSelectedDebtId(event.target.value)}><option value="">No debt selected</option>{debts.map((debt) => <option key={debt.debtId} value={debt.debtId}>{debt.receiptNumber} - {money(debt.outstandingAmount)}</option>)}</select></label>
        <label className="pos-credit-config-grid__wide">Notes / Reason<textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
      </div>
      <div className="pos-new-customer-modal__actions">
        <button type="button" className="pos-action-button pos-action-button-primary" onClick={() => void receiveDeposit()}>Receive Deposit</button>
        <button type="button" className="pos-action-button pos-action-button-secondary" onClick={() => void createNote()}>Create Credit Note</button>
      </div>
      <div className="collection-diary-table-scroll">
        <table className="sci-pos-table collection-diary-table">
          <thead><tr><th>Deposit</th><th>Received</th><th>Applied</th><th>Balance</th><th>Source</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>{deposits.map((deposit) => <tr key={deposit.depositId}><td>{deposit.depositNumber}</td><td>{money(deposit.amountReceived)}</td><td>{money(deposit.amountApplied)}</td><td>{money(deposit.balance)}</td><td>{deposit.source}</td><td>{deposit.status}</td><td><button disabled={!selectedDebtId} onClick={() => void applyCustomerDepositToDebt(deposit.depositId, selectedDebtId, Math.min(deposit.balance, amount || deposit.balance)).then(load)}>Apply to Debt</button><button onClick={() => void refundCustomerDeposit(deposit.depositId, Math.min(deposit.balance, amount || deposit.balance), notes || 'Refunded locally.', staffName).then(load)}>Refund</button></td></tr>)}</tbody>
        </table>
      </div>
      <div className="collection-diary-table-scroll">
        <table className="sci-pos-table collection-diary-table">
          <thead><tr><th>Credit Note</th><th>Reason</th><th>Original</th><th>Applied</th><th>Balance</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>{creditNotes.map((note) => <tr key={note.creditNoteId}><td>{note.creditNoteNumber}</td><td>{note.reason}</td><td>{money(note.originalAmount)}</td><td>{money(note.amountApplied)}</td><td>{money(note.balance)}</td><td>{note.status}</td><td><button disabled={!canApprove} onClick={() => void approveCustomerCreditNote(note.creditNoteId, staffName, notes || 'Approved locally.').then(load)}>Approve</button><button disabled={!selectedDebtId} onClick={() => void applyCreditNoteToDebt(note.creditNoteId, selectedDebtId, Math.min(note.balance, amount || note.balance)).then(load)}>Apply to Debt</button></td></tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}
