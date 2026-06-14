import { getCashDrawerAssignments, getShiftSessionControl, getTerminalControlEvents } from './terminalControlService';
import { getCashControlSummary } from './cashControlService';
import { getCustomerCreditActivityEvents, getCustomerDebtPayments, getCustomerDebtRecords } from './customerCreditService';
import type { CashControlSummary, CashDrawerAssignment, CashLog, CustomerDebtPayment, CustomerDebtRecord, Shift, ShiftSessionControl, TerminalControlEvent, Transaction } from '../types';

export interface ShiftEodContext {
  vendorId: string;
  branchId: string;
  branchName: string;
  terminalId: string;
  terminalName: string;
  staffId?: string;
  staffName: string;
  roleName?: string;
  shift?: ShiftSessionControl | Shift | null;
  transactions?: Transaction[];
  creditDebts?: CustomerDebtRecord[];
  debtPayments?: CustomerDebtPayment[];
  cashLogs?: CashLog[];
  drawerAssignment?: CashDrawerAssignment | null;
  countedCash?: number;
  cashNotes?: string;
}

export interface ShiftEodSummary {
  shiftId: string;
  terminal: string;
  branch: string;
  staff: string;
  openedAt: string;
  closedAt: string;
  salesCount: number;
  grossSales: number;
  returns: number;
  discounts: number;
  vat: number;
  netReceived: number;
  expectedCash: number;
  countedCash: number;
  variance: number;
}

export interface ShiftVatSummary {
  vatInclusiveSales: number;
  vatExclusiveSales: number;
  vatExemptSales: number;
  vatAmount: number;
  taxableAmount: number;
  rateBreakdown: Array<{ rate: string; taxable: number; vat: number }>;
}

export interface ShiftCashVarianceSummary {
  expectedCash: number;
  countedCash: number;
  variance: number;
  cashSales: number;
  cashRefunds: number;
  drawerOpens: number;
  notes: string;
  reviewedBy: string;
}

export interface ShiftSalesSummary {
  completedSales: number;
  grossSales: number;
  returns: number;
  discounts: number;
  netSales: number;
}

export interface ShiftPaymentSummary {
  cash: number;
  ecocashPlaceholder: number;
  innbucksPlaceholder: number;
  mukuruPlaceholder: number;
  zipitPlaceholder: number;
  bankTransfer: number;
  cardPlaceholder: number;
  accountCredit: number;
  mixedPayment: number;
  alreadyPaid: number;
}

export interface ShiftCreditSummary {
  cashSales: number;
  creditSalesCreated: number;
  customerDebtPaymentsReceived: number;
  partialCreditPayments: number;
  newDebtCreatedToday: number;
  debtPaymentsByMethod: Array<{ method: string; amount: number }>;
  overduePaymentsReceived: number;
  creditSaleApprovals: number;
  debtWriteOffRequests: number;
  outstandingCreditGeneratedByCashier: Array<{ cashier: string; amount: number }>;
}

export interface ShiftDrawerSummary {
  drawerId: string;
  assignedAt: string;
  releasedAt?: string;
  openingFloat: number;
  cashSales: number;
  expectedCash: number;
  countedCash: number;
  variance: number;
}

export interface ShiftActivitySummary {
  salesCompleted: number;
  heldSales: number;
  voidedCarts: number;
  discounts: number;
  stockMovements: number;
  deliveryEvents: number;
  cashDrawerEvents: number;
  approvalEvents: number;
  events: TerminalControlEvent[];
}

export interface ShiftEodPrintPayload {
  generatedAt: string;
  generatedBy: string;
  reportNumber: string;
  reportStatus: string;
  source: string;
  businessName: string;
  branchId: string;
  terminalId: string;
  staffId: string;
  roleName: string;
  summary: ShiftEodSummary;
  vat: ShiftVatSummary;
  cashVariance: ShiftCashVarianceSummary;
  sales: ShiftSalesSummary;
  payments: ShiftPaymentSummary;
  credit: ShiftCreditSummary;
  cashControl: CashControlSummary;
  drawer: ShiftDrawerSummary;
  activity: ShiftActivitySummary;
  exceptions: string[];
  signatures: {
    preparedBy: string;
    reviewedBy: string;
    approvedBy: string;
    cashHandedOverBy: string;
    cashReceivedBy: string;
  };
  pdfInstruction: string;
}

export async function generateShiftCreditSummary(input: ShiftEodContext | string): Promise<ShiftCreditSummary> {
  const context = await resolveContext(input);
  const today = shiftOpenedAt(context.shift).slice(0, 10);
  const [storedDebts, storedPayments, creditEvents] = await Promise.all([getCustomerDebtRecords(), Promise.resolve(getCustomerDebtPayments()), getCustomerCreditActivityEvents()]);
  const debts = context.creditDebts || storedDebts;
  const payments = context.debtPayments || storedPayments;
  const currentShiftId = shiftIdFrom(context);
  const scopeDebtsByShift = Boolean(currentShiftId && debts.some((debt) => debt.shiftId));
  const scopePaymentsByShift = Boolean(currentShiftId && payments.some((payment) => payment.shiftId));
  const todaysDebts = debts.filter((debt) =>
    (debt.createdAt.slice(0, 10) === today || debt.saleDate.slice(0, 10) === today) &&
    (!scopeDebtsByShift || debt.shiftId === currentShiftId)
  );
  const todaysPayments = payments.filter((payment) =>
    payment.receivedAt.slice(0, 10) === today &&
    (!scopePaymentsByShift || payment.shiftId === currentShiftId)
  );
  const debtPaymentsByMethod = Array.from(new Set(todaysPayments.map((payment) => payment.paymentMethod))).map((method) => ({
    method,
    amount: todaysPayments.filter((payment) => payment.paymentMethod === method).reduce((sum, payment) => sum + payment.amount, 0)
  }));
  const outstandingCreditGeneratedByCashier = Array.from(new Set(todaysDebts.map((debt) => debt.cashierStaffId))).map((cashier) => ({
    cashier,
    amount: todaysDebts.filter((debt) => debt.cashierStaffId === cashier).reduce((sum, debt) => sum + debt.outstandingAmount, 0)
  }));
  return {
    cashSales: cashSales(context.transactions),
    creditSalesCreated: todaysDebts.reduce((sum, debt) => sum + (debt.creditAmountCreated ?? debt.outstandingAmount), 0),
    customerDebtPaymentsReceived: todaysPayments.reduce((sum, payment) => sum + payment.amount, 0),
    partialCreditPayments: todaysPayments.length,
    newDebtCreatedToday: todaysDebts.reduce((sum, debt) => sum + (debt.creditAmountCreated ?? debt.outstandingAmount), 0),
    debtPaymentsByMethod,
    overduePaymentsReceived: todaysPayments.filter((payment) => debts.find((debt) => debt.debtId === payment.debtId && debt.overdueDays > 0)).reduce((sum, payment) => sum + payment.amount, 0),
    creditSaleApprovals: creditEvents.filter((event) => event.dateTime.slice(0, 10) === today && event.eventType.includes('APPROVAL')).length,
    debtWriteOffRequests: creditEvents.filter((event) => event.dateTime.slice(0, 10) === today && event.eventType === 'WRITE_OFF_REQUESTED').length,
    outstandingCreditGeneratedByCashier
  };
}

const DEFAULT_VENDOR_ID = 'SCI-LOG-ZW';
const DEFAULT_BRANCH_ID = 'BR-HARARE';
const DEFAULT_TERMINAL_ID = 'POS-01';

function nowIso(): string {
  return new Date().toISOString();
}

function isModernShift(shift: ShiftSessionControl | Shift | null | undefined): shift is ShiftSessionControl {
  return Boolean(shift && 'openingFloat' in shift);
}

function shiftIdFrom(input: ShiftEodContext | string): string {
  return typeof input === 'string' ? input : input.shift?.id || 'SHIFT-LOCAL';
}

function contextFrom(input: ShiftEodContext | string): ShiftEodContext {
  if (typeof input !== 'string') return input;
  return {
    vendorId: DEFAULT_VENDOR_ID,
    branchId: DEFAULT_BRANCH_ID,
    branchName: 'Harare Main',
    terminalId: DEFAULT_TERMINAL_ID,
    terminalName: DEFAULT_TERMINAL_ID,
    staffId: 'STAFF-LOCAL',
    staffName: 'Local Operator',
    roleName: 'Local Operator',
    shift: { id: input, status: 'CLOSED', operator: 'Local Operator', startTime: nowIso(), startingCash: 0, expectedCash: 0, salesCount: 0, totalSales: 0 }
  };
}

function shiftOpenedAt(shift: ShiftSessionControl | Shift | null | undefined): string {
  if (!shift) return nowIso();
  return isModernShift(shift) ? shift.openedAt || nowIso() : shift.startTime;
}

function shiftClosedAt(shift: ShiftSessionControl | Shift | null | undefined): string {
  if (!shift) return nowIso();
  return isModernShift(shift) ? shift.closedAt || nowIso() : shift.endTime || nowIso();
}

function openingFloat(shift: ShiftSessionControl | Shift | null | undefined): number {
  if (!shift) return 0;
  return isModernShift(shift) ? shift.openingFloat : shift.startingCash;
}

function expectedCash(context: ShiftEodContext): number {
  if (context.shift && isModernShift(context.shift)) return context.shift.expectedCash;
  if (context.shift && 'expectedCash' in context.shift) return context.shift.expectedCash;
  return openingFloat(context.shift) + cashSales(context.transactions || []) + cashDebtPayments(context.debtPayments || []) + cashLogTotal(context.cashLogs || []);
}

function countedCash(context: ShiftEodContext): number {
  if (typeof context.countedCash === 'number') return context.countedCash;
  if (context.shift && isModernShift(context.shift) && typeof context.shift.declaredCash === 'number') return context.shift.declaredCash;
  if (context.shift && 'actualCash' in context.shift && typeof context.shift.actualCash === 'number') return context.shift.actualCash;
  return expectedCash(context);
}

function completedTransactions(transactions: Transaction[] = []): Transaction[] {
  return transactions.filter((transaction) => transaction.status === 'COMPLETED');
}

function cashSales(transactions: Transaction[] = []): number {
  return completedTransactions(transactions).reduce((sum, transaction) => {
    const method = transaction.paymentMethod;
    if (method === 'CASH' || method === 'Cash') return sum + transaction.total;
    if (method === 'Credit Sale' || method === 'SPLIT' || method === 'Split Payment') {
      return sum + Math.max(0, (transaction.cashReceived || 0) - (transaction.changeGiven || 0));
    }
    return sum;
  }, 0);
}

function cashLogTotal(cashLogs: CashLog[] = []): number {
  return cashLogs.reduce((sum, log) => {
    if (log.type === 'PAY_IN' || log.type === 'INITIAL') return sum + log.amount;
    if (log.type === 'PAY_OUT' || log.type === 'SAFE_DROP') return sum - log.amount;
    return sum;
  }, 0);
}

function cashDebtPayments(payments: CustomerDebtPayment[] = []): number {
  return payments
    .filter((payment) => payment.paymentMethod === 'Cash')
    .reduce((sum, payment) => sum + payment.amount, 0);
}

function grossSales(transactions: Transaction[] = []): number {
  return completedTransactions(transactions).reduce((sum, transaction) => sum + transaction.total, 0);
}

function discounts(transactions: Transaction[] = []): number {
  return completedTransactions(transactions).reduce((sum, transaction) => sum + (transaction.discount || 0), 0);
}

function vatTotal(transactions: Transaction[] = []): number {
  return completedTransactions(transactions).reduce((sum, transaction) => sum + (transaction.tax || 0), 0);
}

function paymentTotal(transactions: Transaction[] = [], matcher: (method: string) => boolean): number {
  return completedTransactions(transactions)
    .filter((transaction) => matcher(String(transaction.paymentMethod)))
    .reduce((sum, transaction) => sum + transaction.total, 0);
}

function normalisePaymentMethod(method: string): string {
  return method.trim().toUpperCase().replace(/[\s/_-]+/g, '');
}

function varianceStatus(variance: number): string {
  if (variance === 0) return 'Balanced';
  return variance > 0 ? 'Over declared cash' : 'Cash short';
}

function buildReportNumber(summary: ShiftEodSummary, generatedAt: string): string {
  const shiftPart = summary.shiftId.replace(/[^A-Z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'SHIFT-LOCAL';
  const timestampPart = generatedAt.replace(/[-:.TZ]/g, '').slice(0, 12);
  return `EOD-${shiftPart}-${timestampPart}`;
}

function buildExceptions(context: ShiftEodContext, cashVariance: ShiftCashVarianceSummary, activity: ShiftActivitySummary): string[] {
  const exceptions: string[] = [];
  if (cashVariance.variance !== 0) {
    exceptions.push(`Cash variance recorded: ${varianceStatus(cashVariance.variance)} by USD ${Math.abs(cashVariance.variance).toFixed(2)}.`);
  }
  if (activity.deliveryEvents > 0) exceptions.push(`${activity.deliveryEvents} delivery event(s) require EOD review.`);
  if (activity.approvalEvents > 0) exceptions.push(`${activity.approvalEvents} approval event(s) recorded during this shift.`);
  if ((context.cashNotes || '').trim()) exceptions.push(`EOD notes: ${context.cashNotes!.trim()}`);
  exceptions.push('Unposted offline sales: Local build placeholder - none flagged.');
  exceptions.push('Suspicious overrides: Local build placeholder - none flagged.');
  return exceptions;
}

async function resolveContext(input: ShiftEodContext | string): Promise<ShiftEodContext> {
  const base = contextFrom(input);
  if (base.shift && base.drawerAssignment) return base;
  const shift = base.shift || await getShiftSessionControl(base.vendorId, base.branchId, base.terminalId);
  const drawers = await getCashDrawerAssignments(base.vendorId, base.branchId, base.terminalId);
  return {
    ...base,
    shift,
    drawerAssignment: base.drawerAssignment || drawers.find((drawer) => drawer.status === 'Assigned') || drawers[0] || null
  };
}

export async function generateShiftEodSummary(input: ShiftEodContext | string): Promise<ShiftEodSummary> {
  const context = await resolveContext(input);
  const gross = grossSales(context.transactions);
  const vat = vatTotal(context.transactions);
  const expected = expectedCash(context);
  const counted = countedCash(context);
  return {
    shiftId: shiftIdFrom(context),
    terminal: context.terminalName || context.terminalId,
    branch: context.branchName,
    staff: context.staffName,
    openedAt: shiftOpenedAt(context.shift),
    closedAt: shiftClosedAt(context.shift),
    salesCount: completedTransactions(context.transactions).length,
    grossSales: gross,
    returns: 0,
    discounts: discounts(context.transactions),
    vat,
    netReceived: gross,
    expectedCash: expected,
    countedCash: counted,
    variance: counted - expected
  };
}

export async function generateShiftVatSummary(input: ShiftEodContext | string): Promise<ShiftVatSummary> {
  const context = await resolveContext(input);
  const vat = vatTotal(context.transactions);
  const gross = grossSales(context.transactions);
  return {
    vatInclusiveSales: gross,
    vatExclusiveSales: Math.max(0, gross - vat),
    vatExemptSales: 0,
    vatAmount: vat,
    taxableAmount: Math.max(0, gross - vat),
    rateBreakdown: [{ rate: 'Local VAT', taxable: Math.max(0, gross - vat), vat }]
  };
}

export async function generateShiftCashVarianceSummary(input: ShiftEodContext | string): Promise<ShiftCashVarianceSummary> {
  const context = await resolveContext(input);
  const expected = expectedCash(context);
  const counted = countedCash(context);
  return {
    expectedCash: expected,
    countedCash: counted,
    variance: counted - expected,
    cashSales: cashSales(context.transactions),
    cashRefunds: 0,
    drawerOpens: (context.cashLogs || []).filter((log) => log.type === 'PAY_IN' || log.type === 'PAY_OUT' || log.type === 'SAFE_DROP').length,
    notes: context.cashNotes || 'Local EOD cash variance summary prepared.',
    reviewedBy: context.staffName
  };
}

export async function generateShiftSalesSummary(input: ShiftEodContext | string): Promise<ShiftSalesSummary> {
  const context = await resolveContext(input);
  const gross = grossSales(context.transactions);
  const discountTotal = discounts(context.transactions);
  return {
    completedSales: completedTransactions(context.transactions).length,
    grossSales: gross,
    returns: 0,
    discounts: discountTotal,
    netSales: Math.max(0, gross - discountTotal)
  };
}

export async function generateShiftPaymentSummary(input: ShiftEodContext | string): Promise<ShiftPaymentSummary> {
  const context = await resolveContext(input);
  const transactions = context.transactions || [];
  return {
    cash: paymentTotal(transactions, (method) => method === 'CASH' || method === 'Cash'),
    ecocashPlaceholder: paymentTotal(transactions, (method) => method === 'EcoCash'),
    innbucksPlaceholder: paymentTotal(transactions, (method) => method === 'Innbucks'),
    mukuruPlaceholder: paymentTotal(transactions, (method) => method === 'Mukuru'),
    zipitPlaceholder: paymentTotal(transactions, (method) => normalisePaymentMethod(method) === 'ZIPIT'),
    bankTransfer: paymentTotal(transactions, (method) => method === 'Bank Transfer'),
    cardPlaceholder: paymentTotal(transactions, (method) => method === 'CARD' || method === 'Card'),
    accountCredit: paymentTotal(transactions, (method) => method === 'Credit Sale'),
    mixedPayment: paymentTotal(transactions, (method) => method === 'SPLIT' || method === 'Split Payment'),
    alreadyPaid: paymentTotal(transactions, (method) => normalisePaymentMethod(method) === 'ALREADYPAID')
  };
}

export async function generateShiftDrawerSummary(input: ShiftEodContext | string): Promise<ShiftDrawerSummary> {
  const context = await resolveContext(input);
  const expected = expectedCash(context);
  const counted = countedCash(context);
  return {
    drawerId: context.drawerAssignment?.drawerId || 'No drawer assigned',
    assignedAt: context.drawerAssignment?.assignedAt || shiftOpenedAt(context.shift),
    releasedAt: context.drawerAssignment?.unassignedAt,
    openingFloat: context.drawerAssignment?.openingFloat ?? openingFloat(context.shift),
    cashSales: cashSales(context.transactions),
    expectedCash: expected,
    countedCash: counted,
    variance: counted - expected
  };
}

export async function generateShiftActivitySummary(input: ShiftEodContext | string): Promise<ShiftActivitySummary> {
  const context = await resolveContext(input);
  const events = await getTerminalControlEvents(context.vendorId, context.branchId);
  const terminalEvents = events.filter((event) => event.terminalId === context.terminalId || event.terminalId === context.terminalName);
  return {
    salesCompleted: completedTransactions(context.transactions).length,
    heldSales: 0,
    voidedCarts: 0,
    discounts: completedTransactions(context.transactions).filter((transaction) => (transaction.discount || 0) > 0).length,
    stockMovements: completedTransactions(context.transactions).length,
    deliveryEvents: terminalEvents.filter((event) => event.eventType.toLowerCase().includes('delivery')).length,
    cashDrawerEvents: terminalEvents.filter((event) => event.eventType.toLowerCase().includes('drawer')).length,
    approvalEvents: terminalEvents.filter((event) => event.eventType.toLowerCase().includes('approve')).length,
    events: terminalEvents.slice(0, 20)
  };
}

export async function prepareShiftEodPrintPayload(input: ShiftEodContext | string): Promise<ShiftEodPrintPayload> {
  const context = contextFrom(input);
  const [summary, vat, cashVariance, sales, payments, credit, cashControl, drawer, activity] = await Promise.all([
    generateShiftEodSummary(input),
    generateShiftVatSummary(input),
    generateShiftCashVarianceSummary(input),
    generateShiftSalesSummary(input),
    generateShiftPaymentSummary(input),
    generateShiftCreditSummary(input),
    getCashControlSummary({ shiftId: shiftIdFrom(context) }),
    generateShiftDrawerSummary(input),
    generateShiftActivitySummary(input)
  ]);
  const generatedAt = nowIso();
  return {
    generatedAt,
    generatedBy: context.staffName || summary.staff,
    reportNumber: buildReportNumber(summary, generatedAt),
    reportStatus: 'Local Build Preview',
    source: 'Local Build Development',
    businessName: 'iTred Commerce POS',
    branchId: context.branchId,
    terminalId: context.terminalId,
    staffId: context.staffId || 'STAFF-LOCAL',
    roleName: context.roleName || 'POS Operator',
    summary,
    vat,
    cashVariance,
    sales,
    payments,
    credit,
    cashControl,
    drawer,
    activity,
    exceptions: buildExceptions(context, cashVariance, activity),
    signatures: {
      preparedBy: context.staffName || summary.staff,
      reviewedBy: '',
      approvedBy: '',
      cashHandedOverBy: context.staffName || summary.staff,
      cashReceivedBy: ''
    },
    pdfInstruction: prepareShiftEodPdfPlaceholder(summary.shiftId)
  };
}

export function prepareShiftEodPdfPlaceholder(shiftId: string): string {
  return `To download PDF for ${shiftId}, choose Print and select "Save as PDF" on this device.`;
}
