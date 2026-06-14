import { useState } from 'react';
import type { DrawerExpenseRecord } from '../types';

function money(value: number): string {
  return `USD ${value.toFixed(2)}`;
}

export default function DrawerExpensesPanel({ expenses, canCreate, onCreate }: { expenses: DrawerExpenseRecord[]; canCreate: boolean; onCreate: (amount: number, reason: string) => void }) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  return (
    <section className="sci-pos-card cash-control-panel">
      <div className="sci-pos-card__bar"><div><p className="sci-pos-eyebrow">Drawer Expenses</p><h2>Petty Cash / Payouts</h2></div><span>{expenses.length} rows</span></div>
      <div className="cash-inline-form">
        <label>Amount<input type="number" min="0" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
        <label>Reason<input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Expense reason" /></label>
        <button className="sci-pos-button sci-pos-button--primary" type="button" disabled={!canCreate} onClick={() => { onCreate(Number(amount), reason); setAmount(''); setReason(''); }}>Add Drawer Expense</button>
      </div>
      <div className="cash-control-table-scroll">
        <table className="cash-control-table">
          <thead><tr>{['Expense', 'Amount', 'Paid To', 'Reason', 'Status', 'Created By'].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead>
          <tbody>{expenses.map((expense) => <tr key={expense.expenseId}><td>{expense.expenseType}</td><td>{money(expense.amount)}</td><td>{expense.paidTo || '-'}</td><td>{expense.reason}</td><td>{expense.status}</td><td>{expense.createdBy}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}
