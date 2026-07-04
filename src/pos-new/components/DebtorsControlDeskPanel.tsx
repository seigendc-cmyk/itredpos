import { FileText, MessageCircle, MoreVertical } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type {
  CustomerAgeingIntervalConfig,
  CustomerCreditProfile,
  CustomerCreditStatus,
  CustomerCreditWorthinessScore,
  CustomerDebtRecord,
  CustomerRecord,
  CreditSaleStatus,
  DebtAgeingBucket,
  Role
} from '../types';
import {
  calculateCustomerCreditWorthiness,
  calculateDebtorsControlSummary,
  createDebtorsControlTask,
  getAgeingIntervalConfigs,
  getCreditPolicySettings,
  getCustomerCreditProfile,
  getCustomerDebtLedger,
  logDebtReminder,
  prepareDebtReminderWhatsAppMessage,
  requestDebtWriteOff,
  resetCreditPolicySettings,
  saveCreditPolicySettings,
  type CustomerCreditPolicySettings,
  type CustomerDebtLedgerRow,
  type DebtorsControlFilters,
  type DebtorsControlRow,
  type DebtorsControlSummary
} from '../services/customerCreditService';
import RowActionMenu, { type RowActionMenuItem } from './RowActionMenu';
import CustomerCreditWorthinessPanel from './CustomerCreditWorthinessPanel';
import CustomerDebtLedgerModal from './CustomerDebtLedgerModal';
import BulkCollectionActionsPanel from './BulkCollectionActionsPanel';
import DebtorPeriodLockPanel from './DebtorPeriodLockPanel';

interface DebtorsControlDeskPanelProps {
  customers: CustomerRecord[];
  selectedCustomerId: string;
  staffName: string;
  roleName: Role;
  canManagePolicy: boolean;
  canRecordPayment: boolean;
  canWriteOff: boolean;
  onRecordPayment: (debt: CustomerDebtRecord) => void;
  onCreatePromise?: (debt: CustomerDebtRecord) => void;
  onCreateDispute?: (debt: CustomerDebtRecord) => void;
  onCreditApplication?: (customerId: string) => void;
  onOpenCustomerProfile: (customerId: string) => void;
  onPrintStatement: (customerId: string) => void;
  onNotice: (message: string) => void;
}

function money(value?: number): string {
  return `USD ${(value || 0).toFixed(2)}`;
}

const debtStatuses: Array<CreditSaleStatus | 'All'> = ['All', 'Open', 'PartiallyPaid', 'Paid', 'Overdue', 'WrittenOff', 'Disputed', 'Cancelled'];
const ageingBuckets: Array<DebtAgeingBucket | 'All'> = ['All', 'Current', 'DueSoon', 'Overdue1', 'Overdue2', 'Overdue3', 'Overdue4', 'SevereOverdue'];
const creditStatuses: Array<CustomerCreditStatus | 'All'> = ['All', 'Approved', 'Review', 'Suspended', 'Blocked', 'OverLimit', 'Overdue', 'Watchlist', 'Cash Only', 'Credit Allowed', 'Credit Suspended', 'Credit Review Required'];

export default function DebtorsControlDeskPanel({
  customers,
  selectedCustomerId,
  staffName,
  roleName,
  canManagePolicy,
  canRecordPayment,
  canWriteOff,
  onRecordPayment,
  onCreatePromise,
  onCreateDispute,
  onCreditApplication,
  onOpenCustomerProfile,
  onPrintStatement,
  onNotice
}: DebtorsControlDeskPanelProps) {
  const [filters, setFilters] = useState<DebtorsControlFilters>({ customerId: selectedCustomerId });
  const [summary, setSummary] = useState<DebtorsControlSummary | null>(null);
  const [openMenuId, setOpenMenuId] = useState('');
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [ledgerRows, setLedgerRows] = useState<CustomerDebtLedgerRow[]>([]);
  const [ledgerCustomer, setLedgerCustomer] = useState<DebtorsControlRow | null>(null);
  const [ledgerProfile, setLedgerProfile] = useState<CustomerCreditProfile | null>(null);
  const [ledgerScore, setLedgerScore] = useState<CustomerCreditWorthinessScore | null>(null);
  const [policy, setPolicy] = useState<CustomerCreditPolicySettings>(() => getCreditPolicySettings());
  const [configs, setConfigs] = useState<CustomerAgeingIntervalConfig[]>(() => getAgeingIntervalConfigs());

  const branches = useMemo(() => Array.from(new Set((summary?.rows || []).map((row) => row.branchName))).filter(Boolean), [summary]);
  const cashiers = useMemo(() => Array.from(new Set((summary?.rows || []).map((row) => row.cashierName))).filter(Boolean), [summary]);

  const load = async () => {
    setSummary(await calculateDebtorsControlSummary(filters));
    setConfigs(getAgeingIntervalConfigs());
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters)]);

  const openLedger = async (row: DebtorsControlRow) => {
    const [ledger, profile, score] = await Promise.all([
      getCustomerDebtLedger(row.customerId),
      getCustomerCreditProfile(row.customerId),
      calculateCustomerCreditWorthiness(row.customerId)
    ]);
    setLedgerCustomer(row);
    setLedgerRows(ledger);
    setLedgerProfile(profile);
    setLedgerScore(score);
    setLedgerOpen(true);
  };

  const sendReminder = async (row: DebtorsControlRow) => {
    const customer = customers.find((item) => item.customerId === row.customerId);
    const phone = customer?.whatsapp || customer?.phone || window.prompt('WhatsApp phone number', '') || '';
    const normalized = phone.replace(/[^\d]/g, '');
    if (!normalized) {
      onNotice('WhatsApp reminder cancelled. No phone number was provided.');
      return;
    }
    const message = prepareDebtReminderWhatsAppMessage(customer || row, [row], row.overdueDays > 30 ? 'Overdue 30 Days' : row.overdueDays > 0 ? 'Overdue 7 Days' : 'Due Today');
    await logDebtReminder(row.customerId, staffName, row.debtId);
    window.open(`https://wa.me/${normalized}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
    onNotice('Debt reminder WhatsApp link prepared locally.');
    await load();
  };

  const exportRow = (row: DebtorsControlRow) => {
    const content = [
      ['Customer', 'Receipt', 'Sale Date', 'Due Date', 'Original', 'Paid', 'Outstanding', 'Ageing', 'Status'],
      [row.customerName, row.receiptNumber, row.saleDate, row.dueDate, row.originalAmount, row.paidAmount, row.outstandingAmount, row.ageingBucket, row.status]
    ].map((cells) => cells.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${row.receiptNumber}-debt.csv`;
    link.click();
    URL.revokeObjectURL(url);
    onNotice('Debtor row exported locally.');
  };

  const actionItems = (row: DebtorsControlRow): RowActionMenuItem[] => [
    { label: 'View Debt', icon: <FileText size={15} />, onClick: () => void openLedger(row) },
    { label: 'Record Payment', icon: <FileText size={15} />, onClick: () => onRecordPayment(row), disabled: !canRecordPayment },
    { label: 'Add Promise to Pay', icon: <FileText size={15} />, onClick: () => onCreatePromise?.(row), disabled: !onCreatePromise },
    { label: 'New Credit Application', icon: <FileText size={15} />, onClick: () => onCreditApplication?.(row.customerId), disabled: !onCreditApplication },
    { label: 'Print Statement', icon: <FileText size={15} />, onClick: () => onPrintStatement(row.customerId) },
    { label: 'Send WhatsApp Reminder', icon: <MessageCircle size={15} />, onClick: () => void sendReminder(row) },
    { label: 'Open Customer Profile', icon: <FileText size={15} />, onClick: () => onOpenCustomerProfile(row.customerId) },
    { label: 'Create Follow-up Task', icon: <FileText size={15} />, onClick: () => { createDebtorsControlTask({ title: `Follow up ${row.customerName}`, customer: row.customerName, debtReference: row.receiptNumber, dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10), assignedTo: 'Manager' }); onNotice('Payment follow-up task created locally.'); } },
    { label: 'Escalate to Manager', icon: <FileText size={15} />, onClick: () => { createDebtorsControlTask({ title: `Manager escalation - ${row.customerName}`, customer: row.customerName, debtReference: row.receiptNumber, dueDate: new Date().toISOString().slice(0, 10), assignedTo: 'Manager' }); onNotice('Manager escalation task created locally.'); } },
    { label: 'Mark Disputed', icon: <FileText size={15} />, onClick: () => onCreateDispute ? onCreateDispute(row) : onNotice(`${row.receiptNumber} dispute placeholder logged locally.`) },
    { label: 'Request Write-Off', icon: <FileText size={15} />, onClick: () => void requestDebtWriteOff(row, staffName, roleName).then(() => { onNotice('Debt write-off approval request created locally.'); void load(); }), disabled: !canWriteOff, danger: true },
    { label: 'Export Row', icon: <FileText size={15} />, onClick: () => exportRow(row) }
  ];

  const updatePolicy = (field: keyof CustomerCreditPolicySettings, value: string | number | boolean) => {
    setPolicy((current) => ({ ...current, [field]: value }));
  };

  return (
    <div className="pos-debtors-control-desk">
      <section className="pos-credit-summary-grid">
        {[
          ['Total Outstanding', money(summary?.totalOutstanding)],
          ['Current Debt', money(summary?.currentDebt)],
          ['Due Today', money(summary?.dueToday)],
          ['1-30 Days Overdue', money(summary?.overdue1)],
          ['31-60 Days Overdue', money(summary?.overdue2)],
          ['61-90 Days Overdue', money(summary?.overdue3)],
          ['91-120 Days Overdue', money(summary?.overdue4)],
          ['120+ Severe Overdue', money(summary?.severeOverdue)],
          ['Customers on Watchlist', summary?.watchlistCustomers || 0],
          ['Blocked Credit Customers', summary?.blockedCreditCustomers || 0],
          ['Payments Received Today', money(summary?.paymentsReceivedToday)],
          ['Write-Off Requests', summary?.writeOffRequests || 0]
        ].map(([label, value]) => <div key={label} className="pos-debtors-summary-card"><span>{label}</span><strong>{value}</strong></div>)}
      </section>

      <section className="sci-pos-card pos-credit-config-card">
        <div className="sci-pos-card__bar"><div><p className="sci-pos-eyebrow">Filters</p><h2>Debtors Filters</h2></div><MoreVertical size={18} /></div>
        <div className="pos-credit-config-grid">
          <label>Search<input value={filters.search || ''} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="moyo overdue 30" /></label>
          <label>Customer<select value={filters.customerId || ''} onChange={(event) => setFilters({ ...filters, customerId: event.target.value })}><option value="">All Customers</option>{customers.map((customer) => <option key={customer.customerId} value={customer.customerId}>{customer.customerName}</option>)}</select></label>
          <label>Branch<select value={filters.branch || 'All'} onChange={(event) => setFilters({ ...filters, branch: event.target.value })}><option>All</option>{branches.map((branch) => <option key={branch}>{branch}</option>)}</select></label>
          <label>Cashier / Salesperson<select value={filters.cashier || 'All'} onChange={(event) => setFilters({ ...filters, cashier: event.target.value })}><option>All</option>{cashiers.map((cashier) => <option key={cashier}>{cashier}</option>)}</select></label>
          <label>Ageing Bucket<select value={filters.ageingBucket || 'All'} onChange={(event) => setFilters({ ...filters, ageingBucket: event.target.value as DebtAgeingBucket | 'All' })}>{ageingBuckets.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Credit Status<select value={filters.creditStatus || 'All'} onChange={(event) => setFilters({ ...filters, creditStatus: event.target.value as CustomerCreditStatus | 'All' })}>{creditStatuses.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Debt Status<select value={filters.debtStatus || 'All'} onChange={(event) => setFilters({ ...filters, debtStatus: event.target.value as CreditSaleStatus | 'All' })}>{debtStatuses.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Date From<input type="date" value={filters.dateFrom || ''} onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })} /></label>
          <label>Date To<input type="date" value={filters.dateTo || ''} onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })} /></label>
          <label>Due From<input type="date" value={filters.dueFrom || ''} onChange={(event) => setFilters({ ...filters, dueFrom: event.target.value })} /></label>
          <label>Due To<input type="date" value={filters.dueTo || ''} onChange={(event) => setFilters({ ...filters, dueTo: event.target.value })} /></label>
          <label>Minimum Outstanding<input type="number" value={filters.minOutstanding ?? ''} onChange={(event) => setFilters({ ...filters, minOutstanding: event.target.value ? Number(event.target.value) : undefined })} /></label>
          <label>Maximum Outstanding<input type="number" value={filters.maxOutstanding ?? ''} onChange={(event) => setFilters({ ...filters, maxOutstanding: event.target.value ? Number(event.target.value) : undefined })} /></label>
        </div>
      </section>

      <section className="sci-pos-card pos-credit-debt-card">
        <div className="sci-pos-card__bar"><div><p className="sci-pos-eyebrow">Debt Ledger</p><h2>Debtors Table</h2></div><span>{summary?.rows.length || 0} record(s)</span></div>
        <div className="pos-credit-debt-scroll">
          <table className="sci-pos-table pos-credit-debt-table">
            <thead><tr>{['Customer', 'Receipt / Debt No.', 'Sale Date', 'Due Date', 'Original', 'Paid', 'Outstanding', 'Ageing', 'Credit Status', 'Last Reminder', 'Action'].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead>
            <tbody>
              {(summary?.rows || []).map((row) => (
                <tr key={row.debtId}>
                  <td>{row.customerName}<span className="customer-list-secondary">{row.customerCode}</span></td>
                  <td>{row.receiptNumber}<span className="customer-list-secondary">{row.debtId}</span></td>
                  <td>{new Date(row.saleDate).toLocaleDateString()}</td>
                  <td>{new Date(row.dueDate).toLocaleDateString()}</td>
                  <td>{money(row.originalAmount)}</td>
                  <td>{money(row.paidAmount)}</td>
                  <td>{money(row.outstandingAmount)}</td>
                  <td>{row.ageingBucket}</td>
                  <td>{row.creditStatus}</td>
                  <td>{row.lastReminder ? new Date(row.lastReminder).toLocaleDateString() : 'None'}</td>
                  <td className="pos-customer-row-actions"><RowActionMenu ariaLabel={`Debtor actions for ${row.receiptNumber}`} open={openMenuId === row.debtId} items={actionItems(row)} onOpenChange={(open) => setOpenMenuId(open ? row.debtId : '')} /></td>
                </tr>
              ))}
              {(summary?.rows.length || 0) === 0 && <tr><td colSpan={11} className="pos-customer-empty-cell">No debtor records match the current filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="sci-pos-card pos-credit-config-card">
        <div className="sci-pos-card__bar"><div><p className="sci-pos-eyebrow">Credit Policy Settings</p><h2>Local Policy</h2></div><span>{policy.activeAgeingIntervalConfigId}</span></div>
        <div className="pos-credit-config-grid">
          <label>Default Payment Terms Days<input disabled={!canManagePolicy} type="number" value={policy.defaultPaymentTermsDays} onChange={(event) => updatePolicy('defaultPaymentTermsDays', Number(event.target.value))} /></label>
          <label>Default Credit Limit<input disabled={!canManagePolicy} type="number" value={policy.defaultCreditLimit} onChange={(event) => updatePolicy('defaultCreditLimit', Number(event.target.value))} /></label>
          <label>Severe Overdue Block Days<input disabled={!canManagePolicy} type="number" value={policy.severeOverdueBlockDays} onChange={(event) => updatePolicy('severeOverdueBlockDays', Number(event.target.value))} /></label>
          <label>Reminder Schedule Days<input disabled={!canManagePolicy} value={policy.reminderScheduleDays} onChange={(event) => updatePolicy('reminderScheduleDays', event.target.value)} /></label>
          <label>Active Ageing Interval Config<select disabled={!canManagePolicy} value={policy.activeAgeingIntervalConfigId} onChange={(event) => updatePolicy('activeAgeingIntervalConfigId', event.target.value)}>{configs.map((config) => <option key={config.configId} value={config.configId}>{config.name}</option>)}</select></label>
          <label className="pos-credit-checkbox"><input disabled={!canManagePolicy} type="checkbox" checked={policy.allowPartialCreditPayments} onChange={(event) => updatePolicy('allowPartialCreditPayments', event.target.checked)} /> Allow Partial Credit Payments</label>
          <label className="pos-credit-checkbox"><input disabled={!canManagePolicy} type="checkbox" checked={policy.allowCreditSaleToOverdueCustomer} onChange={(event) => updatePolicy('allowCreditSaleToOverdueCustomer', event.target.checked)} /> Allow Credit Sale to Overdue Customer</label>
          <label className="pos-credit-checkbox"><input disabled={!canManagePolicy} type="checkbox" checked={policy.allowCreditSaleAboveLimit} onChange={(event) => updatePolicy('allowCreditSaleAboveLimit', event.target.checked)} /> Allow Credit Sale Above Limit</label>
          <label className="pos-credit-checkbox"><input disabled={!canManagePolicy} type="checkbox" checked={policy.requireApprovalAboveLimit} onChange={(event) => updatePolicy('requireApprovalAboveLimit', event.target.checked)} /> Require Approval Above Limit</label>
          <label className="pos-credit-checkbox"><input disabled={!canManagePolicy} type="checkbox" checked={policy.requireApprovalIfOverdue} onChange={(event) => updatePolicy('requireApprovalIfOverdue', event.target.checked)} /> Require Approval If Overdue</label>
        </div>
        <div className="pos-new-customer-modal__actions">
          <button type="button" className="sci-pos-button sci-pos-button--primary" disabled={!canManagePolicy} onClick={() => { saveCreditPolicySettings(policy); onNotice('Credit policy saved.'); }}>Save Policy</button>
          <button type="button" className="sci-pos-button sci-pos-button--secondary" disabled={!canManagePolicy} onClick={() => { const next = resetCreditPolicySettings(); setPolicy(next); onNotice('Credit policy reset.'); }}>Reset Defaults</button>
        </div>
      </section>

      <div className="pos-credit-two-column">
        <CustomerCreditWorthinessPanel score={ledgerScore} profile={ledgerProfile} />
      </div>

      <BulkCollectionActionsPanel filters={filters} staffName={staffName} onNotice={onNotice} />
      <DebtorPeriodLockPanel staffName={staffName} customerId={selectedCustomerId} canManage={canManagePolicy} onNotice={onNotice} />

      <CustomerDebtLedgerModal
        open={ledgerOpen}
        customerName={ledgerCustomer?.customerName || 'Customer'}
        profile={ledgerProfile}
        worthiness={ledgerScore}
        rows={ledgerRows}
        onRecordPayment={() => { if (ledgerCustomer) onRecordPayment(ledgerCustomer); }}
        onPrintStatement={() => { if (ledgerCustomer) onPrintStatement(ledgerCustomer.customerId); }}
        onSendReminder={() => { if (ledgerCustomer) void sendReminder(ledgerCustomer); }}
        onCreateTask={() => { if (ledgerCustomer) { createDebtorsControlTask({ title: `Statement delivery - ${ledgerCustomer.customerName}`, customer: ledgerCustomer.customerName, debtReference: ledgerCustomer.receiptNumber, dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10), assignedTo: 'Customer Centre' }); onNotice('Statement delivery task created locally.'); } }}
        onClose={() => setLedgerOpen(false)}
      />
    </div>
  );
}
