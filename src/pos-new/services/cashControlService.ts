import { createAccountingPostingPlaceholder } from './accountingService';
import { createBIAdviceFromTrigger, getBIAdviceRecords } from './biAdviceService';
import { getCustomerDebtPayments } from './customerCreditService';
import { assertCanonicalCashSession } from './cashSessionService';
import { calculateExpectedCash as calculateCanonicalExpectedCash } from './cashMovementService';
import { readVendorScopedList, writeVendorScopedList } from '../utils/vendorDataMode';
import type {
  CashControlActivityEvent,
  CashControlFilterState,
  CashControlSummary,
  CashDrawerCountLine,
  CashDrawerMovement,
  CashDrawerReconciliation,
  CashDropRecord,
  CashEquivalencePolicy,
  CashMovementDirection,
  CashMovementSource,
  CashMovementType,
  CashReconciliationStatus,
  CashVarianceRecord,
  CashVarianceType,
  DebtorPaymentCashLink,
  DeliveryCashHandoverRecord,
  DrawerExpenseRecord,
  RiskLevel
} from '../types';

const MOVEMENT_KEY = 'itred_pos_cash_control_movements_v1';
const RECON_KEY = 'itred_pos_cash_control_reconciliations_v1';
const EXPENSE_KEY = 'itred_pos_cash_control_expenses_v1';
const DROP_KEY = 'itred_pos_cash_control_drops_v1';
const LINK_KEY = 'itred_pos_cash_control_debtor_links_v1';
const DELIVERY_KEY = 'delivery_cash_handovers';
const ACTIVITY_KEY = 'itred_pos_cash_control_activity_v1';
const VARIANCE_KEY = 'itred_pos_cash_control_variances_v1';

function readList<T>(key: string, fallback: T[] = []): T[] {
  return readVendorScopedList<T>(key, fallback);
}

function saveList<T>(key: string, rows: T[]): T[] {
  return writeVendorScopedList(key, rows);
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function money(value: number): string {
  return `USD ${value.toFixed(2)}`;
}

function varianceType(value: number): CashVarianceType {
  if (value < 0) return 'Short';
  if (value > 0) return 'Over';
  return 'Balanced';
}

function movementDirection(type: CashMovementType): CashMovementDirection {
  if (['OpeningFloat', 'CashSale', 'CashDebtorPayment', 'CashDeliveryHandover', 'CashCorrection'].includes(type)) return 'In';
  if (['CashRefund', 'CashReturnRefund', 'CashDrop', 'DrawerExpense', 'PettyCashPayout', 'SupplierPayment'].includes(type)) return 'Out';
  return 'Neutral';
}

function sourceForType(type: CashMovementType): CashMovementSource {
  if (type === 'CashSale') return 'Sale';
  if (type === 'CashDebtorPayment') return 'DebtPayment';
  if (type === 'CashDeliveryHandover') return 'Delivery';
  if (type === 'DrawerExpense' || type === 'PettyCashPayout') return 'Expense';
  if (type === 'SupplierPayment') return 'SupplierPayment';
  if (type === 'CashRefund' || type === 'CashReturnRefund') return 'Refund';
  if (type === 'OpeningFloat') return 'Shift';
  if (type === 'CashVarianceAdjustment') return 'EOD';
  return 'ManualAdjustment';
}

function isCashEquivalent(method: string, policy: CashEquivalencePolicy = 'PhysicalCashOnly'): boolean {
  if (method === 'Cash') return true;
  if (policy === 'IncludeMobileMoneyAsCashEquivalent' && ['EcoCash Placeholder', 'Innbucks Placeholder', 'Mukuru Placeholder', 'ZIPIT Placeholder'].includes(method)) return true;
  if (policy === 'IncludeBankTransferAsCashEquivalent' && method === 'Bank Transfer') return true;
  if (policy === 'IncludeCardAsCashEquivalent' && method === 'Card Placeholder') return true;
  return false;
}

function logActivity(input: Omit<CashControlActivityEvent, 'eventId' | 'createdAt'>): CashControlActivityEvent {
  const event: CashControlActivityEvent = {
    ...input,
    eventId: makeId('CASH-ACT'),
    createdAt: nowIso()
  };
  saveList(ACTIVITY_KEY, [event, ...readList<CashControlActivityEvent>(ACTIVITY_KEY)].slice(0, 120));
  return event;
}

function filterByState<T extends { shiftId?: string; branchId?: string; terminalId?: string; drawerId?: string; staffName?: string; createdAt?: string }>(rows: T[], filters: CashControlFilterState = {}): T[] {
  return rows.filter((row) =>
    (!filters.shiftId || row.shiftId === filters.shiftId) &&
    (!filters.branchId || row.branchId === filters.branchId) &&
    (!filters.terminalId || row.terminalId === filters.terminalId) &&
    (!filters.drawerId || row.drawerId === filters.drawerId) &&
    (!filters.staffName || row.staffName === filters.staffName) &&
    (!filters.dateFrom || !row.createdAt || row.createdAt >= `${filters.dateFrom}T00:00:00`) &&
    (!filters.dateTo || !row.createdAt || row.createdAt <= `${filters.dateTo}T23:59:59`)
  );
}

export async function getCashDrawerMovements(filters: CashControlFilterState = {}): Promise<CashDrawerMovement[]> {
  return filterByState(readList<CashDrawerMovement>(MOVEMENT_KEY, seedMovements()), filters).filter((movement) =>
    (!filters.source || filters.source === 'All' || movement.source === filters.source) &&
    (!filters.movementType || filters.movementType === 'All' || movement.type === filters.movementType)
  );
}

export async function createCashDrawerMovement(payload: Omit<CashDrawerMovement, 'movementId' | 'movementNumber' | 'createdAt' | 'reviewed'>): Promise<CashDrawerMovement> {
  const movement: CashDrawerMovement = {
    ...payload,
    movementId: makeId('CASH-MOV'),
    movementNumber: `CM-${Date.now().toString().slice(-8)}`,
    direction: payload.direction || movementDirection(payload.type),
    source: payload.source || sourceForType(payload.type),
    createdAt: nowIso(),
    reviewed: false
  };
  saveList(MOVEMENT_KEY, [movement, ...readList<CashDrawerMovement>(MOVEMENT_KEY, seedMovements())]);
  logActivity({ eventType: 'CASH_MOVEMENT_CREATED', message: `${movement.type} ${money(movement.amount)} recorded.`, shiftId: movement.shiftId, drawerId: movement.drawerId, staffName: movement.staffName });
  return movement;
}

export async function calculateCashSalesForShift(shiftId: string): Promise<number> {
  return (await getCashDrawerMovements({ shiftId, movementType: 'CashSale' })).reduce((sum, movement) => sum + movement.amount, 0);
}

export async function calculateCashDebtorPaymentsForShift(shiftId: string, policy: CashEquivalencePolicy = 'PhysicalCashOnly'): Promise<number> {
  const movementTotal = (await getCashDrawerMovements({ shiftId, movementType: 'CashDebtorPayment' })).reduce((sum, movement) => sum + movement.amount, 0);
  const linkedMovementRefs = new Set((await getCashDrawerMovements({ shiftId, movementType: 'CashDebtorPayment' })).map((movement) => movement.referenceId));
  const paymentTotal = getCustomerDebtPayments({ shiftId })
    .filter((payment) => isCashEquivalent(payment.paymentMethod, policy) && !linkedMovementRefs.has(payment.paymentId))
    .reduce((sum, payment) => sum + payment.amount, 0);
  return movementTotal + paymentTotal;
}

export async function calculateCashDeliveryHandoversForShift(shiftId: string): Promise<number> {
  return readList<DeliveryCashHandoverRecord>(DELIVERY_KEY, seedDeliveryHandovers())
    .filter((handover) => handover.shiftId === shiftId && handover.handoverStatus === 'Confirmed')
    .reduce((sum, handover) => sum + handover.cashReceived, 0);
}

export async function calculateCashRefundsForShift(shiftId: string): Promise<number> {
  return (await getCashDrawerMovements({ shiftId })).filter((movement) => movement.type === 'CashRefund' || movement.type === 'CashReturnRefund').reduce((sum, movement) => sum + movement.amount, 0);
}

export async function calculateDrawerExpensesForShift(shiftId: string): Promise<number> {
  const expenses = readList<DrawerExpenseRecord>(EXPENSE_KEY, seedExpenses()).filter((expense) => expense.shiftId === shiftId && expense.status !== 'Rejected');
  return expenses.reduce((sum, expense) => sum + expense.amount, 0);
}

export async function calculateSupplierCashPaymentsForShift(shiftId: string): Promise<number> {
  return (await getCashDrawerMovements({ shiftId, movementType: 'SupplierPayment' })).reduce((sum, movement) => sum + movement.amount, 0);
}

export async function calculateCashDropsForShift(shiftId: string): Promise<number> {
  return readList<CashDropRecord>(DROP_KEY, seedCashDrops()).filter((drop) => drop.shiftId === shiftId && drop.status !== 'Rejected').reduce((sum, drop) => sum + drop.amount, 0);
}

async function openingFloatForShift(shiftId: string): Promise<number> {
  const opening = (await getCashDrawerMovements({ shiftId, movementType: 'OpeningFloat' }))[0];
  return opening?.amount || 0;
}

export async function calculateExpectedDrawerCash(shiftId: string, policy: CashEquivalencePolicy = 'PhysicalCashOnly'): Promise<number> {
  const canonical = await calculateCanonicalExpectedCash(shiftId);
  if (canonical.expectedCash !== 0 || canonical.openingFloat !== 0) return canonical.expectedCash;
  const [openingFloat, cashSales, cashDebtorPayments, cashDeliveryHandovers, cashRefunds, drawerExpenses, supplierCashPayments, cashDrops] = await Promise.all([
    openingFloatForShift(shiftId),
    calculateCashSalesForShift(shiftId),
    calculateCashDebtorPaymentsForShift(shiftId, policy),
    calculateCashDeliveryHandoversForShift(shiftId),
    calculateCashRefundsForShift(shiftId),
    calculateDrawerExpensesForShift(shiftId),
    calculateSupplierCashPaymentsForShift(shiftId),
    calculateCashDropsForShift(shiftId)
  ]);
  return openingFloat + cashSales + cashDebtorPayments + cashDeliveryHandovers - cashRefunds - drawerExpenses - supplierCashPayments - cashDrops;
}

export async function recordSupplierPaymentCashImpact(payload: {
  shiftId?: string;
  branchId?: string;
  branchName?: string;
  terminalId?: string;
  terminalName?: string;
  drawerId?: string;
  drawerName?: string;
  staffId: string;
  staffName: string;
  amount: number;
  paymentId: string;
  paymentNumber: string;
  supplierId: string;
  supplierName: string;
  notes?: string;
}): Promise<CashDrawerMovement | null> {
  if (payload.amount <= 0) return null;
  if (!payload.shiftId) throw new Error('No open shift. Please open a shift before recording cash.');
  const session = assertCanonicalCashSession();
  return createCashDrawerMovement({
    shiftId: payload.shiftId,
    branchId: payload.branchId || session.branchId,
    branchName: payload.branchName || session.branchName,
    terminalId: payload.terminalId || session.terminalId,
    terminalName: payload.terminalName || session.terminalName,
    drawerId: payload.drawerId || `DRAWER-${session.terminalId}`,
    drawerName: payload.drawerName || payload.drawerId || `DRAWER-${session.terminalId}`,
    staffId: payload.staffId || session.staffId,
    staffName: payload.staffName || session.staffName,
    type: 'SupplierPayment',
    direction: 'Out',
    source: 'SupplierPayment',
    amount: payload.amount,
    paymentMethod: 'Cash',
    referenceId: payload.paymentId,
    referenceNumber: payload.paymentNumber,
    notes: payload.notes || `Supplier payment to ${payload.supplierName}.`
  });
}

export async function createDrawerExpense(payload: Omit<DrawerExpenseRecord, 'expenseId' | 'createdAt' | 'status'> & { status?: CashReconciliationStatus }): Promise<DrawerExpenseRecord> {
  if (payload.amount <= 0) throw new Error('Drawer expense amount must be above zero.');
  const session = assertCanonicalCashSession();
  const expense: DrawerExpenseRecord = { ...payload, expenseId: makeId('DRE'), createdAt: nowIso(), status: payload.status || (payload.amount > 50 ? 'PendingReview' : 'Approved') };
  saveList(EXPENSE_KEY, [expense, ...readList<DrawerExpenseRecord>(EXPENSE_KEY, seedExpenses())]);
  await createCashDrawerMovement({
    shiftId: expense.shiftId,
    branchId: session.branchId,
    branchName: session.branchName,
    terminalId: session.terminalId,
    terminalName: session.terminalName,
    drawerId: expense.drawerId,
    drawerName: expense.drawerId,
    staffId: session.staffId,
    staffName: session.staffName,
    type: expense.expenseType === 'Petty Cash' ? 'PettyCashPayout' : 'DrawerExpense',
    direction: 'Out',
    source: 'Expense',
    amount: expense.amount,
    paymentMethod: 'Cash',
    referenceId: expense.expenseId,
    referenceNumber: expense.expenseId,
    notes: expense.reason
  });
  await createAccountingPostingPlaceholder({ source: 'Cash Movement', sourceReference: expense.expenseId, branch: 'Local Branch', amount: expense.amount });
  if (expense.status === 'PendingReview') await createCashBIAdvice('DRAWER_EXPENSE_WITHOUT_APPROVAL', `Drawer expense ${expense.expenseId} requires approval for ${money(expense.amount)}.`, 'High');
  return expense;
}

export async function createCashDrop(payload: Omit<CashDropRecord, 'cashDropId' | 'createdAt' | 'status'> & { status?: CashReconciliationStatus }): Promise<CashDropRecord> {
  if (payload.amount <= 0) throw new Error('Cash drop amount must be above zero.');
  const session = assertCanonicalCashSession();
  const drop: CashDropRecord = { ...payload, cashDropId: makeId('DROP'), createdAt: nowIso(), status: payload.status || (payload.receivedBy ? 'Approved' : 'PendingReview') };
  saveList(DROP_KEY, [drop, ...readList<CashDropRecord>(DROP_KEY, seedCashDrops())]);
  await createCashDrawerMovement({
    shiftId: drop.shiftId,
    branchId: session.branchId,
    branchName: session.branchName,
    terminalId: session.terminalId,
    terminalName: session.terminalName,
    drawerId: drop.drawerId,
    drawerName: drop.drawerId,
    staffId: session.staffId,
    staffName: session.staffName,
    type: 'CashDrop',
    direction: 'Out',
    source: 'EOD',
    amount: drop.amount,
    paymentMethod: 'Cash',
    referenceId: drop.cashDropId,
    referenceNumber: drop.cashDropId,
    notes: drop.reason
  });
  await createAccountingPostingPlaceholder({ source: 'Cash Movement', sourceReference: drop.cashDropId, branch: 'Local Branch', amount: drop.amount });
  if (!drop.receivedBy) await createCashBIAdvice('CASH_DROP_NOT_CONFIRMED', `Cash drop ${drop.cashDropId} is not receiver-confirmed.`, 'Medium');
  return drop;
}

export async function createCashDrawerReconciliation(payload: Omit<CashDrawerReconciliation, 'reconciliationId' | 'createdAt' | 'variance' | 'varianceType'>): Promise<CashDrawerReconciliation> {
  const variance = payload.countedCash - payload.expectedCash;
  const reconciliation: CashDrawerReconciliation = {
    ...payload,
    reconciliationId: makeId('CASH-REC'),
    variance,
    varianceType: varianceType(variance),
    status: payload.status || (variance === 0 ? 'Balanced' : 'VarianceFound'),
    createdAt: nowIso()
  };
  saveList(RECON_KEY, [reconciliation, ...readList<CashDrawerReconciliation>(RECON_KEY, seedReconciliations())]);
  if (variance !== 0) await createVarianceFromReconciliation(reconciliation);
  logActivity({ eventType: 'CASH_RECONCILIATION_CREATED', message: `Reconciliation ${reconciliation.reconciliationId} created with variance ${money(variance)}.`, shiftId: reconciliation.shiftId, drawerId: reconciliation.drawerId, staffName: reconciliation.preparedBy });
  return reconciliation;
}

export async function updateCashDrawerReconciliation(reconciliationId: string, patch: Partial<CashDrawerReconciliation>): Promise<CashDrawerReconciliation | null> {
  const rows = readList<CashDrawerReconciliation>(RECON_KEY, seedReconciliations());
  let updated: CashDrawerReconciliation | null = null;
  saveList(RECON_KEY, rows.map((row) => {
    if (row.reconciliationId !== reconciliationId) return row;
    const expectedCash = patch.expectedCash ?? row.expectedCash;
    const countedCash = patch.countedCash ?? row.countedCash;
    const variance = countedCash - expectedCash;
    updated = { ...row, ...patch, expectedCash, countedCash, variance, varianceType: varianceType(variance) };
    return updated;
  }));
  return updated;
}

export async function countDrawerCash(payload: { reconciliationId: string; countedCash: number; countLines?: CashDrawerCountLine[]; staffName: string; notes?: string }): Promise<CashDrawerReconciliation | null> {
  if (payload.countedCash < 0) throw new Error('Counted cash cannot be negative.');
  const updated = await updateCashDrawerReconciliation(payload.reconciliationId, {
    countedCash: payload.countedCash,
    notes: payload.notes || 'Drawer cash counted locally.',
    status: 'PendingReview'
  });
  if (updated && updated.variance !== 0) await createVarianceFromReconciliation(updated);
  logActivity({ eventType: 'DRAWER_CASH_COUNTED', message: `Drawer counted at ${money(payload.countedCash)}.`, shiftId: updated?.shiftId, drawerId: updated?.drawerId, staffName: payload.staffName });
  return updated;
}

export async function approveCashReconciliation(reconciliationId: string, staffId: string, note: string): Promise<CashDrawerReconciliation | null> {
  return updateCashDrawerReconciliation(reconciliationId, { status: 'Approved', reviewedBy: staffId, closedAt: nowIso(), notes: note });
}

export async function rejectCashReconciliation(reconciliationId: string, staffId: string, reason: string): Promise<CashDrawerReconciliation | null> {
  return updateCashDrawerReconciliation(reconciliationId, { status: 'Rejected', reviewedBy: staffId, notes: reason });
}

export async function linkDebtorPaymentToDrawer(paymentId: string, drawerId: string): Promise<DebtorPaymentCashLink | null> {
  const payment = getCustomerDebtPayments().find((row) => row.paymentId === paymentId);
  if (!payment) return null;
  const link: DebtorPaymentCashLink = {
    linkId: makeId('DEBT-CASH-LINK'),
    paymentId,
    debtId: payment.debtId,
    drawerId,
    shiftId: payment.shiftId || 'SHIFT-LOCAL',
    amount: payment.amount,
    cashEquivalent: payment.paymentMethod === 'Cash',
    createdAt: nowIso()
  };
  saveList(LINK_KEY, [link, ...readList<DebtorPaymentCashLink>(LINK_KEY)]);
  return link;
}

export async function linkDeliveryCashHandoverToDrawer(handoverId: string, drawerId: string): Promise<DeliveryCashHandoverRecord | null> {
  const rows = readList<DeliveryCashHandoverRecord>(DELIVERY_KEY, seedDeliveryHandovers());
  let updated: DeliveryCashHandoverRecord | null = null;
  saveList(DELIVERY_KEY, rows.map((row) => {
    if (row.handoverId !== handoverId) return row;
    updated = { ...row, drawerId, handoverStatus: 'Confirmed' };
    return updated;
  }));
  return updated;
}

export async function getCashControlActivityEvents(filters: CashControlFilterState = {}): Promise<CashControlActivityEvent[]> {
  return filterByState(readList<CashControlActivityEvent>(ACTIVITY_KEY), filters);
}

export async function getCashControlSummary(filters: CashControlFilterState = {}): Promise<CashControlSummary> {
  const shiftId = filters.shiftId || '';
  if (!shiftId) {
    return {
      openingFloat: 0,
      cashSales: 0,
      cashDebtorPayments: 0,
      deliveryCashHandovers: 0,
      cashRefunds: 0,
      drawerExpenses: 0,
      pettyCashPayouts: 0,
      supplierCashPayments: 0,
      cashDrops: 0,
      expectedCash: 0,
      countedCash: 0,
      variance: 0,
      varianceType: 'Balanced',
      pendingReview: 0,
      highRiskAlerts: 0,
      debtorNonCashPayments: 0,
      deliveryCashPending: 0
    };
  }
  const canonical = await calculateCanonicalExpectedCash(shiftId);
  const [openingFloat, cashSales, cashDebtorPayments, deliveryCashHandovers, cashRefunds, drawerExpenses, supplierCashPayments, cashDrops, reconciliations, alerts] = await Promise.all([
    Promise.resolve(canonical.openingFloat || openingFloatForShift(shiftId)),
    Promise.resolve(canonical.cashSales || calculateCashSalesForShift(shiftId)),
    calculateCashDebtorPaymentsForShift(shiftId, filters.cashEquivalencePolicy),
    calculateCashDeliveryHandoversForShift(shiftId),
    Promise.resolve(canonical.cashRefunds || calculateCashRefundsForShift(shiftId)),
    Promise.resolve(canonical.cashOut || calculateDrawerExpensesForShift(shiftId)),
    calculateSupplierCashPaymentsForShift(shiftId),
    Promise.resolve((canonical.safeDrops + canonical.bankDeposits) || calculateCashDropsForShift(shiftId)),
    Promise.resolve(readList<CashDrawerReconciliation>(RECON_KEY, seedReconciliations()).filter((row) => row.shiftId === shiftId)),
    getBIAdviceRecords({ category: 'Cash Control' })
  ]);
  const latestRecon = reconciliations[0];
  const expectedCash = canonical.expectedCash || openingFloat + cashSales + cashDebtorPayments + deliveryCashHandovers - cashRefunds - drawerExpenses - supplierCashPayments - cashDrops;
  const countedCash = latestRecon?.countedCash ?? expectedCash;
  const variance = countedCash - expectedCash;
  const nonCashDebtorPayments = getCustomerDebtPayments({ shiftId }).filter((payment) => !isCashEquivalent(payment.paymentMethod, filters.cashEquivalencePolicy)).reduce((sum, payment) => sum + payment.amount, 0);
  const deliveryCashPending = readList<DeliveryCashHandoverRecord>(DELIVERY_KEY, seedDeliveryHandovers()).filter((handover) => handover.shiftId === shiftId && handover.handoverStatus === 'Pending').reduce((sum, handover) => sum + handover.cashExpected, 0);
  return {
    openingFloat,
    cashSales,
    cashDebtorPayments,
    deliveryCashHandovers,
    cashRefunds,
    drawerExpenses,
    pettyCashPayouts: canonical.pettyCash || (await getCashDrawerMovements({ shiftId, movementType: 'PettyCashPayout' })).reduce((sum, movement) => sum + movement.amount, 0),
    supplierCashPayments,
    cashDrops,
    expectedCash,
    countedCash,
    variance,
    varianceType: varianceType(variance),
    pendingReview: reconciliations.filter((row) => row.status === 'PendingReview' || row.status === 'VarianceFound').length,
    highRiskAlerts: alerts.filter((alert) => alert.priority === 'High' || alert.priority === 'Critical').length,
    debtorNonCashPayments: nonCashDebtorPayments,
    deliveryCashPending
  };
}

export async function getCashDrawerReconciliations(filters: CashControlFilterState = {}): Promise<CashDrawerReconciliation[]> {
  return filterByState(readList<CashDrawerReconciliation>(RECON_KEY, seedReconciliations()), filters).filter((row) => !filters.status || filters.status === 'All' || row.status === filters.status);
}

export async function getDrawerExpenses(filters: CashControlFilterState = {}): Promise<DrawerExpenseRecord[]> {
  return filterByState(readList<DrawerExpenseRecord>(EXPENSE_KEY, seedExpenses()), filters);
}

export async function getCashDrops(filters: CashControlFilterState = {}): Promise<CashDropRecord[]> {
  return filterByState(readList<CashDropRecord>(DROP_KEY, seedCashDrops()), filters);
}

export async function getDeliveryCashHandovers(filters: CashControlFilterState = {}): Promise<DeliveryCashHandoverRecord[]> {
  return filterByState(readList<DeliveryCashHandoverRecord>(DELIVERY_KEY, seedDeliveryHandovers()), filters);
}

export async function getDebtorPaymentCashLinks(): Promise<DebtorPaymentCashLink[]> {
  return readList<DebtorPaymentCashLink>(LINK_KEY);
}

export async function getCashVarianceRecords(filters: CashControlFilterState = {}): Promise<CashVarianceRecord[]> {
  return filterByState(readList<CashVarianceRecord>(VARIANCE_KEY), filters);
}

async function createVarianceFromReconciliation(reconciliation: CashDrawerReconciliation): Promise<CashVarianceRecord> {
  const variance: CashVarianceRecord = {
    varianceId: makeId('CASH-VAR'),
    reconciliationId: reconciliation.reconciliationId,
    shiftId: reconciliation.shiftId,
    drawerId: reconciliation.drawerId,
    staffName: reconciliation.preparedBy,
    expectedCash: reconciliation.expectedCash,
    countedCash: reconciliation.countedCash,
    variance: reconciliation.variance,
    varianceType: reconciliation.varianceType,
    status: reconciliation.status,
    reviewNotes: reconciliation.notes,
    createdAt: nowIso()
  };
  saveList(VARIANCE_KEY, [variance, ...readList<CashVarianceRecord>(VARIANCE_KEY)].slice(0, 80));
  await createCashBIAdvice(variance.varianceType === 'Short' ? 'DRAWER_CASH_SHORT' : 'DRAWER_CASH_OVER', `Drawer ${variance.drawerId} ${variance.varianceType.toLowerCase()} by ${money(Math.abs(variance.variance))}.`, Math.abs(variance.variance) > 20 ? 'High' : 'Medium');
  const sameStaffVariances = readList<CashVarianceRecord>(VARIANCE_KEY).filter((row) => row.staffName === variance.staffName && row.varianceType !== 'Balanced');
  if (sameStaffVariances.length >= 2) await createCashBIAdvice('REPEATED_CASH_VARIANCE_BY_STAFF', `${variance.staffName} has repeated cash variances in local records.`, 'High');
  return variance;
}

export async function createCashBIAdvice(eventType: string, description: string, severity: RiskLevel = 'Medium'): Promise<void> {
  await createBIAdviceFromTrigger({
    id: makeId('CASH-BI'),
    eventType,
    domain: 'Cash Control',
    severity,
    description,
    recommendedAction: 'Review Cash Variance',
    notes: description
  });
}

function seedMovements(): CashDrawerMovement[] {
  const now = nowIso();
  return [
    movementSeed('OpeningFloat', 50, 'Opening float loaded.', now, 'SHIFT-DEV-CASH', 'DRAWER-DEV-01'),
    movementSeed('CashSale', 300, 'Cash sale sample.', now, 'SHIFT-DEV-CASH', 'DRAWER-DEV-01'),
    movementSeed('CashDebtorPayment', 40, 'Debtor cash payment sample.', now, 'SHIFT-DEV-CASH', 'DRAWER-DEV-01'),
    movementSeed('CashDrop', 80, 'Cash drop sample.', now, 'SHIFT-DEV-CASH', 'DRAWER-DEV-01', 'Out')
  ];
}

function movementSeed(type: CashMovementType, amount: number, notes: string, createdAt: string, shiftId: string, drawerId: string, direction = movementDirection(type)): CashDrawerMovement {
  return {
    movementId: `SEED-${type}`,
    movementNumber: `CM-SEED-${type}`,
    shiftId,
    branchId: 'BR-DEV',
    branchName: 'Harare Main',
    terminalId: 'POS-DEV',
    terminalName: 'POS Dev',
    drawerId,
    drawerName: drawerId,
    staffId: 'Build Dev',
    staffName: 'Build Dev',
    type,
    direction: direction as CashMovementDirection,
    source: sourceForType(type),
    amount,
    paymentMethod: 'Cash',
    referenceId: `REF-${type}`,
    referenceNumber: `REF-${type}`,
    notes,
    createdAt,
    reviewed: type !== 'CashDrop'
  };
}

function seedExpenses(): DrawerExpenseRecord[] {
  return [{
    expenseId: 'DRE-SEED-001',
    shiftId: 'SHIFT-DEV-CASH',
    drawerId: 'DRAWER-DEV-01',
    amount: 15,
    expenseType: 'Petty Cash',
    reason: 'Drawer expense sample.',
    paidTo: 'Local supplier',
    notes: 'Prepared for review.',
    createdBy: 'Manager',
    createdAt: nowIso(),
    status: 'Approved'
  }];
}

function seedCashDrops(): CashDropRecord[] {
  return [{
    cashDropId: 'DROP-SEED-001',
    shiftId: 'SHIFT-DEV-CASH',
    drawerId: 'DRAWER-DEV-01',
    amount: 80,
    handedTo: 'Safe Custodian',
    receivedBy: 'Manager',
    reason: 'Safe drop sample.',
    notes: 'Prepared for review.',
    createdBy: 'Build Dev',
    createdAt: nowIso(),
    status: 'Approved'
  }];
}

function seedDeliveryHandovers(): DeliveryCashHandoverRecord[] {
  return [
    { handoverId: 'DEL-CASH-SEED-001', deliveryId: 'DEL-SEED-001', shiftId: 'SHIFT-DEV-CASH', drawerId: 'DRAWER-DEV-01', customerName: 'Build Dev Customer', driverName: 'Delivery Staff', cashExpected: 25, cashReceived: 25, difference: 0, handoverStatus: 'Confirmed', receivedBy: 'Cashier', createdAt: nowIso(), notes: 'Confirmed delivery cash sample.' },
    { handoverId: 'DEL-CASH-SEED-002', deliveryId: 'DEL-SEED-002', shiftId: 'SHIFT-DEV-CASH', drawerId: '', customerName: 'Pending Customer', driverName: 'Delivery Staff', cashExpected: 35, cashReceived: 0, difference: -35, handoverStatus: 'Pending', receivedBy: '', createdAt: nowIso(), notes: 'Pending handover excluded from expected cash.' }
  ];
}

function seedReconciliations(): CashDrawerReconciliation[] {
  const expectedCash = 50 + 300 + 40 + 25 - 15 - 80;
  return [{
    reconciliationId: 'CASH-REC-SEED-001',
    shiftId: 'SHIFT-DEV-CASH',
    branchId: 'BR-DEV',
    terminalId: 'POS-DEV',
    drawerId: 'DRAWER-DEV-01',
    openingFloat: 50,
    cashSales: 300,
    cashDebtorPayments: 40,
    cashDeliveryHandovers: 25,
    cashRefunds: 0,
    drawerExpenses: 15,
    pettyCashPayouts: 15,
    cashDrops: 80,
    expectedCash,
    countedCash: expectedCash - 5,
    variance: -5,
    varianceType: 'Short',
    status: 'VarianceFound',
    notes: 'Variance sample.',
    preparedBy: 'Manager',
    createdAt: nowIso()
  }];
}
