import { useState } from 'react';
import type { BulkCollectionBatch } from '../types';
import { createBatchFollowUpTasks, exportDebtorsList, generateDueTodayReminderBatch, generateOverdueReminderBatch, generateStatementBatch, getBulkCollectionBatches, type DebtorsControlFilters } from '../services/customerCreditService';

interface BulkCollectionActionsPanelProps {
  filters: DebtorsControlFilters;
  staffName: string;
  onNotice: (message: string) => void;
}

function money(value: number): string {
  return `USD ${value.toFixed(2)}`;
}

export default function BulkCollectionActionsPanel({ filters, staffName, onNotice }: BulkCollectionActionsPanelProps) {
  const [batches, setBatches] = useState<BulkCollectionBatch[]>(() => getBulkCollectionBatches());
  const run = async (action: string) => {
    const batch = action === 'due'
      ? await generateDueTodayReminderBatch(filters, staffName)
      : action === 'overdue'
        ? await generateOverdueReminderBatch(filters, staffName)
        : action === 'statements'
          ? await generateStatementBatch(filters, staffName)
          : action === 'tasks'
            ? await createBatchFollowUpTasks(filters, staffName)
            : await exportDebtorsList(filters, staffName);
    setBatches(getBulkCollectionBatches());
    onNotice(`${batch.actionType} batch prepared locally for ${batch.customerCount} customer(s).`);
  };

  return (
    <section className="sci-pos-card debtor-control-panel">
      <div className="sci-pos-card__bar"><div><p className="sci-pos-eyebrow">Bulk Collections</p><h2>Batch Actions</h2></div><span>{batches.length} batches</span></div>
      <div className="pos-new-customer-modal__actions">
        <button className="pos-action-button pos-action-button-secondary" onClick={() => void run('due')}>Generate Due Today Reminders</button>
        <button className="pos-action-button pos-action-button-secondary" onClick={() => void run('overdue')}>Generate Overdue Reminders</button>
        <button className="pos-action-button pos-action-button-secondary" onClick={() => void run('statements')}>Print Statement Batch</button>
        <button className="pos-action-button pos-action-button-secondary" onClick={() => void run('export')}>Export Debtors List</button>
        <button className="pos-action-button pos-action-button-primary" onClick={() => void run('tasks')}>Create Follow-up Tasks</button>
      </div>
      <div className="collection-diary-table-scroll">
        <table className="sci-pos-table collection-diary-table">
          <thead><tr><th>Batch</th><th>Action</th><th>Customers</th><th>Debts</th><th>Total</th><th>Status</th><th>Notes</th></tr></thead>
          <tbody>{batches.map((batch) => <tr key={batch.batchId}><td>{batch.batchNumber}</td><td>{batch.actionType}</td><td>{batch.customerCount}</td><td>{batch.debtCount}</td><td>{money(batch.totalAmount)}</td><td>{batch.status}</td><td>{batch.notes}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}
