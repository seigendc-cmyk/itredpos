import { useEffect, useMemo, useState } from 'react';
import { FileText, MessageCircle } from 'lucide-react';
import type { CollectionDiaryItem, CollectionDiaryItemStatus, CollectionDiaryItemType, CustomerRecord, RiskLevel } from '../types';
import { completeCollectionDiaryItem, escalateCollectionDiaryItem, generateCollectionDiaryForToday, getCollectionDiary } from '../services/customerCreditService';
import RowActionMenu, { type RowActionMenuItem } from './RowActionMenu';

interface CollectionDiaryPanelProps {
  customers: CustomerRecord[];
  staffName: string;
  onOpenCustomer: (customerId: string) => void;
  onRecordPayment: (customerId: string) => void;
  onPromiseToPay: (customerId: string) => void;
  onDispute: (customerId: string) => void;
  onNotice: (message: string) => void;
}

const types: Array<CollectionDiaryItemType | 'All'> = ['All', 'PaymentDue', 'PromiseDue', 'BrokenPromise', 'StatementFollowUp', 'ManagerCall', 'CustomerVisit', 'DisputeFollowUp', 'CreditReview'];
const priorities: Array<RiskLevel | 'All'> = ['All', 'Low', 'Medium', 'High', 'Critical'];
const statuses: Array<CollectionDiaryItemStatus | 'All'> = ['All', 'DueToday', 'Pending', 'Completed', 'Overdue', 'Escalated', 'Cancelled'];

export default function CollectionDiaryPanel({ customers, staffName, onOpenCustomer, onRecordPayment, onPromiseToPay, onDispute, onNotice }: CollectionDiaryPanelProps) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [assignedTo, setAssignedTo] = useState('');
  const [type, setType] = useState<CollectionDiaryItemType | 'All'>('All');
  const [priority, setPriority] = useState<RiskLevel | 'All'>('All');
  const [status, setStatus] = useState<CollectionDiaryItemStatus | 'All'>('All');
  const [customerId, setCustomerId] = useState('');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<CollectionDiaryItem[]>([]);
  const [openMenuId, setOpenMenuId] = useState('');

  const load = () => setRows(getCollectionDiary({ date, assignedTo, type, priority, status, customerId, search }));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, assignedTo, type, priority, status, customerId, search]);

  const summary = useMemo(() => ({
    dueToday: rows.filter((row) => row.status === 'DueToday').length,
    overdue: rows.filter((row) => row.status === 'Overdue').length,
    brokenPromises: rows.filter((row) => row.type === 'BrokenPromise').length,
    statements: rows.filter((row) => row.type === 'StatementFollowUp').length,
    highRisk: rows.filter((row) => row.priority === 'High' || row.priority === 'Critical').length,
    managerCalls: rows.filter((row) => row.type === 'ManagerCall').length,
    visits: rows.filter((row) => row.type === 'CustomerVisit').length,
    completed: rows.filter((row) => row.status === 'Completed').length
  }), [rows]);

  const refreshToday = async () => {
    const created = await generateCollectionDiaryForToday();
    onNotice(`${created.length} collection diary item(s) generated locally.`);
    load();
  };

  const actionItems = (row: CollectionDiaryItem): RowActionMenuItem[] => [
    { label: 'Open Customer', icon: <FileText size={15} />, onClick: () => onOpenCustomer(row.customerId) },
    { label: 'Open Debt Ledger', icon: <FileText size={15} />, onClick: () => onOpenCustomer(row.customerId) },
    { label: 'Record Payment', icon: <FileText size={15} />, onClick: () => onRecordPayment(row.customerId) },
    { label: 'Add Promise to Pay', icon: <FileText size={15} />, onClick: () => onPromiseToPay(row.customerId) },
    { label: 'Send WhatsApp Reminder', icon: <MessageCircle size={15} />, onClick: () => onNotice(`WhatsApp reminder prepared for ${row.customerName}.`) },
    { label: 'Mark Completed', icon: <FileText size={15} />, onClick: () => void completeCollectionDiaryItem(row.diaryItemId, `Completed by ${staffName}.`).then(() => { onNotice('Diary item completed.'); load(); }) },
    { label: 'Escalate', icon: <FileText size={15} />, onClick: () => void escalateCollectionDiaryItem(row.diaryItemId, `Escalated by ${staffName}.`).then(() => { onNotice('Diary item escalated.'); load(); }) },
    { label: 'Add Note', icon: <FileText size={15} />, onClick: () => onNotice(`Note placeholder added locally for ${row.customerName}.`) }
  ];

  return (
    <section className="sci-pos-card collection-diary-panel">
      <div className="sci-pos-card__bar"><div><p className="sci-pos-eyebrow">Debtors</p><h2>Collection Diary</h2></div><button type="button" className="pos-action-button pos-action-button-secondary" onClick={() => void refreshToday()}>Generate Today</button></div>
      <div className="collection-diary-summary-grid">
        {[
          ['Due Today', summary.dueToday],
          ['Overdue Follow-ups', summary.overdue],
          ['Broken Promises', summary.brokenPromises],
          ['Statements Awaiting Acknowledgement', summary.statements],
          ['High Risk Customers', summary.highRisk],
          ['Manager Calls', summary.managerCalls],
          ['Customer Visits', summary.visits],
          ['Completed Today', summary.completed]
        ].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
      </div>
      <div className="pos-credit-config-grid">
        <label>Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        <label>Assigned Staff<input value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)} placeholder="Manager" /></label>
        <label>Type<select value={type} onChange={(event) => setType(event.target.value as CollectionDiaryItemType | 'All')}>{types.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Priority<select value={priority} onChange={(event) => setPriority(event.target.value as RiskLevel | 'All')}>{priorities.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Status<select value={status} onChange={(event) => setStatus(event.target.value as CollectionDiaryItemStatus | 'All')}>{statuses.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Customer<select value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">All Customers</option>{customers.map((customer) => <option key={customer.customerId} value={customer.customerId}>{customer.customerName}</option>)}</select></label>
        <label className="pos-credit-config-grid__wide">Search<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="broken promise manager moyo" /></label>
      </div>
      <div className="collection-diary-table-scroll">
        <table className="sci-pos-table collection-diary-table">
          <thead><tr>{['Due Date', 'Type', 'Customer', 'Debt / Reference', 'Assigned To', 'Priority', 'Status', 'Action'].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead>
          <tbody>
            {rows.map((row) => <tr key={row.diaryItemId}><td>{row.dueDate}</td><td>{row.type}</td><td>{row.customerName}</td><td>{row.debtReference || 'Customer'}</td><td>{row.assignedTo}</td><td>{row.priority}</td><td>{row.status}</td><td className="pos-customer-row-actions"><RowActionMenu ariaLabel={`Collection actions for ${row.customerName}`} open={openMenuId === row.diaryItemId} items={actionItems(row)} onOpenChange={(open) => setOpenMenuId(open ? row.diaryItemId : '')} /></td></tr>)}
            {rows.length === 0 && <tr><td colSpan={8}>No collection diary items match the filters.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
