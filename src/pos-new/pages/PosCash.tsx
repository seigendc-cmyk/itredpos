import { useEffect, useMemo, useState } from 'react';
import CashControlDashboardPanel from '../components/CashControlDashboardPanel';
import CashDropsPanel from '../components/CashDropsPanel';
import CashMovementsPanel from '../components/CashMovementsPanel';
import CashVarianceReviewPanel from '../components/CashVarianceReviewPanel';
import DebtorPaymentsCashPanel from '../components/DebtorPaymentsCashPanel';
import DeliveryCashHandoverPanel from '../components/DeliveryCashHandoverPanel';
import DrawerExpensesPanel from '../components/DrawerExpensesPanel';
import DrawerReconciliationPanel from '../components/DrawerReconciliationPanel';
import {
  approveCashReconciliation,
  createCashBIAdvice,
  createCashDrawerReconciliation,
  createCashDrop,
  createCashDrawerMovement,
  createDrawerExpense,
  getCashControlActivityEvents,
  getCashControlSummary,
  getCashDrops,
  getCashDrawerMovements,
  getCashDrawerReconciliations,
  getCashVarianceRecords,
  getDebtorPaymentCashLinks,
  getDeliveryCashHandovers,
  getDrawerExpenses,
  linkDebtorPaymentToDrawer,
  linkDeliveryCashHandoverToDrawer,
  rejectCashReconciliation
} from '../services/cashControlService';
import { getBIAdviceRecords } from '../services/biAdviceService';
import { getCustomerDebtPayments } from '../services/customerCreditService';
import { canPerformAction } from '../utils/posPermissions';
import type {
  BiEvent,
  CashControlActivityEvent,
  CashControlSummary,
  CashDrawerMovement,
  CashDrawerReconciliation,
  CashDropRecord,
  CashLog,
  CashVarianceRecord,
  CustomerDebtPayment,
  DebtorPaymentCashLink,
  DeliveryCashHandoverRecord,
  DrawerExpenseRecord,
  PosSession,
  Role,
  Shift,
  Transaction,
  BIAdviceRecord
} from '../types';

interface PosCashProps {
  cashLogs: CashLog[];
  activeShift: Shift | null;
  onAddCashLog: (type: CashLog['type'], amount: number, reason: string) => void;
  terminalId: string;
  activeOperator: string;
  biEvents: BiEvent[];
  onLogBiEvent: (
    eventType: BiEvent['eventType'],
    operator: string,
    terminal: string,
    payload: Record<string, unknown>,
    severity: 'INFO' | 'WARNING' | 'CRITICAL'
  ) => void;
  transactions: Transaction[];
  session?: PosSession | null;
}

type CashTab =
  | 'Cash Dashboard'
  | 'Drawer Reconciliation'
  | 'Cash Movements'
  | 'Debtor Payments'
  | 'Delivery Cash Handovers'
  | 'Drawer Expenses'
  | 'Cash Drops'
  | 'Variance Review'
  | 'Cash BI Warnings'
  | 'Cash Activity';

const tabs: CashTab[] = ['Cash Dashboard', 'Drawer Reconciliation', 'Cash Movements', 'Debtor Payments', 'Delivery Cash Handovers', 'Drawer Expenses', 'Cash Drops', 'Variance Review', 'Cash BI Warnings', 'Cash Activity'];

function money(value: number): string {
  return `USD ${value.toFixed(2)}`;
}

export default function PosCash({
  activeShift,
  onAddCashLog,
  terminalId,
  activeOperator,
  session
}: PosCashProps) {
  const roleName = (session?.role || 'Owner') as Role;
  const staffName = session?.staffName || activeOperator || 'Cashier';
  const branchId = session?.branchId || 'BR-LOCAL';
  const branchName = session?.branch || session?.branchName || 'Main Branch';
  const staffId = session?.staffId || staffName;
  const terminalKey = session?.terminalId || terminalId || 'POS-01';
  const terminalName = session?.terminal || session?.terminalName || terminalKey;
  const shiftId = activeShift?.id || '';
  const drawerId = `DRAWER-${terminalKey}`;
  const [activeTab, setActiveTab] = useState<CashTab>('Cash Dashboard');
  const [summary, setSummary] = useState<CashControlSummary | null>(null);
  const [movements, setMovements] = useState<CashDrawerMovement[]>([]);
  const [reconciliations, setReconciliations] = useState<CashDrawerReconciliation[]>([]);
  const [debtorPayments, setDebtorPayments] = useState<CustomerDebtPayment[]>([]);
  const [debtorLinks, setDebtorLinks] = useState<DebtorPaymentCashLink[]>([]);
  const [deliveryHandovers, setDeliveryHandovers] = useState<DeliveryCashHandoverRecord[]>([]);
  const [expenses, setExpenses] = useState<DrawerExpenseRecord[]>([]);
  const [drops, setDrops] = useState<CashDropRecord[]>([]);
  const [variances, setVariances] = useState<CashVarianceRecord[]>([]);
  const [cashAdvice, setCashAdvice] = useState<BIAdviceRecord[]>([]);
  const [activity, setActivity] = useState<CashControlActivityEvent[]>([]);
  const [notice, setNotice] = useState('');

  const latestReconciliation = reconciliations[0] || null;
  const canView = canPerformAction(roleName, 'cashControl.view');
  const canReconcile = canPerformAction(roleName, 'cashControl.reconcile');
  const canApprove = canPerformAction(roleName, 'cashControl.approve');
  const canCreateExpense = canPerformAction(roleName, 'cashControl.expense.create');
  const canCreateDrop = canPerformAction(roleName, 'cashControl.cashDrop.create');
  const canLinkDebtor = canPerformAction(roleName, 'cashControl.debtorPayments.linkDrawer');

  const load = async () => {
    if (!shiftId) {
      const emptySummary = await getCashControlSummary({ shiftId: '' });
      setSummary(emptySummary);
      setMovements([]);
      setReconciliations([]);
      setDebtorPayments([]);
      setDebtorLinks([]);
      setDeliveryHandovers([]);
      setExpenses([]);
      setDrops([]);
      setVariances([]);
      setCashAdvice([]);
      setActivity([]);
      return;
    }
    const [nextSummary, nextMovements, nextReconciliations, nextLinks, nextDelivery, nextExpenses, nextDrops, nextVariances, nextAdvice, nextActivity] = await Promise.all([
      getCashControlSummary({ shiftId }),
      getCashDrawerMovements({ shiftId }),
      getCashDrawerReconciliations({ shiftId }),
      getDebtorPaymentCashLinks(),
      getDeliveryCashHandovers({ shiftId }),
      getDrawerExpenses({ shiftId }),
      getCashDrops({ shiftId }),
      getCashVarianceRecords({ shiftId }),
      getBIAdviceRecords({ category: 'Cash Control' }),
      getCashControlActivityEvents({ shiftId })
    ]);
    setSummary(nextSummary);
    setMovements(nextMovements);
    setReconciliations(nextReconciliations);
    setDebtorPayments(getCustomerDebtPayments({ shiftId }));
    setDebtorLinks(nextLinks);
    setDeliveryHandovers(nextDelivery);
    setExpenses(nextExpenses);
    setDrops(nextDrops);
    setVariances(nextVariances);
    setCashAdvice(nextAdvice);
    setActivity(nextActivity);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shiftId]);

  const restricted = useMemo(() => !canView, [canView]);

  const createReconciliation = async (countedCash: number, notes: string, status: CashDrawerReconciliation['status']) => {
    if (!shiftId) {
      setNotice('No open shift.');
      return;
    }
    if (!canReconcile) {
      setNotice('You do not have permission to reconcile cash.');
      return;
    }
    const expectedCash = summary?.expectedCash || 0;
    await createCashDrawerReconciliation({
      shiftId,
      branchId,
      terminalId: terminalKey,
      drawerId,
      openingFloat: summary?.openingFloat || 0,
      cashSales: summary?.cashSales || 0,
      cashDebtorPayments: summary?.cashDebtorPayments || 0,
      cashDeliveryHandovers: summary?.deliveryCashHandovers || 0,
      cashRefunds: summary?.cashRefunds || 0,
      drawerExpenses: summary?.drawerExpenses || 0,
      pettyCashPayouts: summary?.pettyCashPayouts || 0,
      supplierCashPayments: summary?.supplierCashPayments || 0,
      cashDrops: summary?.cashDrops || 0,
      expectedCash,
      countedCash,
      status,
      notes,
      preparedBy: staffName
    });
    setNotice(`Cash reconciliation saved. Expected ${money(expectedCash)}, counted ${money(countedCash)}.`);
    await load();
  };

  const addExpense = async (amount: number, reason: string) => {
    if (!shiftId) {
      setNotice('No open shift.');
      return;
    }
    if (amount <= 0) {
      setNotice('Drawer expense amount must be above zero.');
      return;
    }
    await createDrawerExpense({ shiftId, drawerId, amount, expenseType: 'Drawer Expense', reason: reason || 'Drawer expense', paidTo: 'Local payee', notes: 'Drawer expense recorded at POS.', createdBy: staffName });
    onAddCashLog('PAY_OUT', amount, reason || 'Drawer expense');
    setNotice('Drawer expense recorded locally.');
    await load();
  };

  const addDrop = async (amount: number, handedTo: string) => {
    if (!shiftId) {
      setNotice('No open shift.');
      return;
    }
    if (amount <= 0) {
      setNotice('Cash drop amount must be above zero.');
      return;
    }
    await createCashDrop({ shiftId, drawerId, amount, handedTo: handedTo || 'Safe Custodian', receivedBy: handedTo || 'Safe Custodian', reason: 'Cash drop / safe handover', notes: 'Cash drop recorded at POS.', createdBy: staffName });
    onAddCashLog('SAFE_DROP', amount, 'Cash drop / safe handover');
    setNotice('Cash drop recorded locally.');
    await load();
  };

  const addMovement = async () => {
    if (!shiftId) {
      setNotice('No open shift.');
      return;
    }
    await createCashDrawerMovement({
      shiftId,
      branchId,
      branchName,
      terminalId: terminalKey,
      terminalName,
      drawerId,
      drawerName: drawerId,
      staffId,
      staffName,
      type: 'CashCorrection',
      direction: 'In',
      source: 'ManualAdjustment',
      amount: 1,
      paymentMethod: 'Cash',
      referenceId: 'LOCAL-CORRECTION',
      referenceNumber: 'CASH-CORRECTION',
      notes: 'Manual cash correction.'
    });
    setNotice('Movement reviewed and cash correction recorded.');
    await load();
  };

  if (restricted) {
    return <div className="sci-pos-card cash-control-panel"><p className="sci-pos-eyebrow">Cash Control</p><h2>Restricted</h2><p>You do not have permission to view Cash Control.</p></div>;
  }

  return (
    <div className="cash-control-page">
      <header className="sci-page-header sci-page-header--compact">
        <div>
          <p className="sci-pos-eyebrow">Cash Control</p>
          <h1>Drawer-to-Debtors Reconciliation</h1>
          <p>{branchName} / {terminalName} / {shiftId}</p>
        </div>
        <div className="sci-page-header__actions">
          <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => void load()}>Refresh</button>
          <button type="button" className="sci-pos-button sci-pos-button--primary" disabled={!canPerformAction(roleName, 'cashControl.print')} onClick={() => window.print()}>Print</button>
        </div>
      </header>

      {notice && <div className="sci-pos-alert" role="status">{notice}</div>}

      <nav className="cash-control-tabs" aria-label="Cash Control tabs">
        {tabs.map((tab) => <button key={tab} type="button" className={tab === activeTab ? 'active' : ''} onClick={() => setActiveTab(tab)}>{tab}</button>)}
      </nav>

      {activeTab === 'Cash Dashboard' && <CashControlDashboardPanel summary={summary} />}
      {activeTab === 'Drawer Reconciliation' && <DrawerReconciliationPanel summary={summary} reconciliation={latestReconciliation} staffName={staffName} canApprove={canApprove} onCreate={(counted, notes, status) => void createReconciliation(counted, notes, status)} onApprove={(id) => void approveCashReconciliation(id, staffName, 'Approved locally.').then(load)} onReject={(id) => void rejectCashReconciliation(id, staffName, 'Returned for correction.').then(load)} />}
      {activeTab === 'Cash Movements' && <CashMovementsPanel movements={movements} onReview={() => void addMovement()} />}
      {activeTab === 'Debtor Payments' && <DebtorPaymentsCashPanel payments={debtorPayments} links={debtorLinks} onLink={(paymentId) => canLinkDebtor ? void linkDebtorPaymentToDrawer(paymentId, drawerId).then(load) : setNotice('You do not have permission to link debtor payments to drawer.')} />}
      {activeTab === 'Delivery Cash Handovers' && <DeliveryCashHandoverPanel handovers={deliveryHandovers} onConfirm={(handoverId) => void linkDeliveryCashHandoverToDrawer(handoverId, drawerId).then(load)} />}
      {activeTab === 'Drawer Expenses' && <DrawerExpensesPanel expenses={expenses} canCreate={canCreateExpense} onCreate={(amount, reason) => void addExpense(amount, reason)} />}
      {activeTab === 'Cash Drops' && <CashDropsPanel drops={drops} canCreate={canCreateDrop} onCreate={(amount, handedTo) => void addDrop(amount, handedTo)} />}
      {activeTab === 'Variance Review' && <CashVarianceReviewPanel variances={variances} onCreateBI={(variance) => void createCashBIAdvice(variance.varianceType === 'Short' ? 'DRAWER_CASH_SHORT' : 'DRAWER_CASH_OVER', `${variance.drawerId} variance ${money(variance.variance)} requires review.`, 'High').then(load)} />}
      {activeTab === 'Cash BI Warnings' && (
        <section className="sci-pos-card cash-control-panel">
          <div className="sci-pos-card__bar"><div><p className="sci-pos-eyebrow">Cash BI Warnings</p><h2>Advice Flow</h2></div><span>{cashAdvice.length} warnings</span></div>
          <div className="cash-control-table-scroll"><table className="cash-control-table"><thead><tr>{['Advice', 'Priority', 'Narrative', 'Desk', 'Role', 'Status'].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{cashAdvice.map((row) => <tr key={row.adviceId}><td>{row.title}</td><td>{row.priority}</td><td>{row.narrative}</td><td>{row.assignedDesk}</td><td>{row.assignedToRole}</td><td>{row.status}</td></tr>)}</tbody></table></div>
        </section>
      )}
      {activeTab === 'Cash Activity' && (
        <section className="sci-pos-card cash-control-panel">
          <div className="sci-pos-card__bar"><div><p className="sci-pos-eyebrow">Cash Activity</p><h2>Audit Events</h2></div><span>{activity.length} events</span></div>
          <div className="cash-control-table-scroll"><table className="cash-control-table"><thead><tr>{['Time', 'Event', 'Message', 'Staff'].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{activity.map((event) => <tr key={event.eventId}><td>{new Date(event.createdAt).toLocaleString()}</td><td>{event.eventType}</td><td>{event.message}</td><td>{event.staffName}</td></tr>)}</tbody></table></div>
        </section>
      )}
    </div>
  );
}
