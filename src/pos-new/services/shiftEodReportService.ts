import { getCashDrawerAssignments, getShiftSessionControl, getTerminalControlEvents } from './terminalControlService';
import type { CashDrawerAssignment, CashLog, Shift, ShiftSessionControl, TerminalControlEvent, Transaction } from '../types';

export interface ShiftEodContext {
  vendorId: string;
  branchId: string;
  branchName: string;
  terminalId: string;
  terminalName: string;
  staffName: string;
  shift?: ShiftSessionControl | Shift | null;
  transactions?: Transaction[];
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
  bankTransfer: number;
  cardPlaceholder: number;
  accountCredit: number;
  mixedPayment: number;
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
  businessName: string;
  summary: ShiftEodSummary;
  vat: ShiftVatSummary;
  cashVariance: ShiftCashVarianceSummary;
  sales: ShiftSalesSummary;
  payments: ShiftPaymentSummary;
  drawer: ShiftDrawerSummary;
  activity: ShiftActivitySummary;
  pdfInstruction: string;
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
    staffName: 'Local Operator',
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
  return openingFloat(context.shift) + cashSales(context.transactions || []) + cashLogTotal(context.cashLogs || []);
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
  return completedTransactions(transactions)
    .filter((transaction) => transaction.paymentMethod === 'CASH' || transaction.paymentMethod === 'Cash')
    .reduce((sum, transaction) => sum + transaction.total, 0);
}

function cashLogTotal(cashLogs: CashLog[] = []): number {
  return cashLogs.reduce((sum, log) => {
    if (log.type === 'PAY_IN' || log.type === 'INITIAL') return sum + log.amount;
    if (log.type === 'PAY_OUT' || log.type === 'SAFE_DROP') return sum - log.amount;
    return sum;
  }, 0);
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
    bankTransfer: paymentTotal(transactions, (method) => method === 'Bank Transfer'),
    cardPlaceholder: paymentTotal(transactions, (method) => method === 'CARD' || method === 'Card'),
    accountCredit: paymentTotal(transactions, (method) => method === 'Credit Sale'),
    mixedPayment: paymentTotal(transactions, (method) => method === 'SPLIT' || method === 'Split Payment')
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
  const [summary, vat, cashVariance, sales, payments, drawer, activity] = await Promise.all([
    generateShiftEodSummary(input),
    generateShiftVatSummary(input),
    generateShiftCashVarianceSummary(input),
    generateShiftSalesSummary(input),
    generateShiftPaymentSummary(input),
    generateShiftDrawerSummary(input),
    generateShiftActivitySummary(input)
  ]);
  return {
    generatedAt: nowIso(),
    businessName: 'iTred Commerce POS',
    summary,
    vat,
    cashVariance,
    sales,
    payments,
    drawer,
    activity,
    pdfInstruction: prepareShiftEodPdfPlaceholder(summary.shiftId)
  };
}

export function prepareShiftEodPdfPlaceholder(shiftId: string): string {
  return `To download PDF for ${shiftId}, choose Print and select "Save as PDF" on this device.`;
}
