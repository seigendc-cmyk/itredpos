import { assertCanonicalCashSession, hasCashPermission, type CanonicalCashSession } from './cashSessionService';
import { calculateExpectedCash, POS_SHIFT_STORE_KEY } from './cashMovementService';
import { getCashCounts, getCashVariances } from './cashCountService';
import { getOfflineSyncQueue } from './offlineSyncService';
import type { PosSession, ShiftSessionControl } from '../types';
import { readVendorScopedList, writeVendorScopedList } from '../utils/vendorDataMode';

export const BUSINESS_DAYS_COLLECTION = 'business_days';
export const PAYMENT_RECONCILIATIONS_COLLECTION = 'payment_reconciliations';
export const BANKBOOK_ENTRIES_COLLECTION = 'bankbook_entries';

const SALES_COLLECTION = 'pos_sales';
const PAYMENTS_COLLECTION = 'pos_payments';
const AUDIT_LOG_COLLECTION = 'audit_logs';
const BI_EVENTS_COLLECTION = 'biEvents';

export type BusinessDayStatus = 'Open' | 'Closing' | 'PendingReview' | 'Locked' | 'Reopened';
export type PaymentReconciliationStatus = 'Balanced' | 'Difference' | 'PendingReview' | 'Approved';
export type PaymentReconciliationMethod = 'Cash' | 'Mobile Money' | 'Card' | 'Bank Transfer' | 'Credit' | 'Other';

export interface BusinessDayRecord {
  businessDayId: string;
  vendorId: string;
  branchId: string;
  businessDate: string;
  openedAt: string;
  closedAt?: string;
  openedBy: string;
  closedBy?: string;
  totalSales: number;
  totalCash: number;
  totalNonCash: number;
  totalRefunds: number;
  totalDiscounts: number;
  totalVat: number;
  expectedCash: number;
  countedCash: number;
  cashVariance: number;
  openShiftCount: number;
  pendingSyncCount: number;
  status: BusinessDayStatus;
  ownerNotes: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentReconciliationRecord {
  reconciliationId: string;
  vendorId: string;
  branchId: string;
  businessDate: string;
  method: PaymentReconciliationMethod;
  systemTotal: number;
  providerTotal: number;
  difference: number;
  status: PaymentReconciliationStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface BankbookEntryRecord {
  bankbookEntryId: string;
  vendorId: string;
  branchId: string;
  businessDate: string;
  bankAccountId: string;
  referenceId: string;
  entryType: 'Deposit' | 'Reversal';
  amount: number;
  status: 'Pending' | 'Posted' | 'Reversed';
  notes: string;
  createdAt: string;
  updatedAt: string;
}

interface SaleLike {
  branchId?: string;
  saleDate?: string;
  grandTotal?: number;
  vatTotal?: number;
  discountTotal?: number;
  saleStatus?: string;
}

interface PaymentLike {
  branchId?: string;
  receivedAt?: string;
  paymentMethod?: string;
  amount?: number;
}

function roundMoney(value: number): number {
  return Number((Math.round((Number(value) + Number.EPSILON) * 100) / 100).toFixed(2));
}

function nowIso(): string {
  return new Date().toISOString();
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function cleanId(value: string): string {
  return String(value || '').replace(/[^A-Za-z0-9_-]/g, '_');
}

function businessDayId(vendorId: string, branchId: string, businessDate: string): string {
  return cleanId(`${vendorId}_${branchId}_${businessDate}`);
}

function saveBusinessDay(record: BusinessDayRecord): BusinessDayRecord {
  const rows = readVendorScopedList<BusinessDayRecord>(BUSINESS_DAYS_COLLECTION, [], record.vendorId);
  writeVendorScopedList(BUSINESS_DAYS_COLLECTION, [record, ...rows.filter((row) => row.businessDayId !== record.businessDayId)], record.vendorId);
  return record;
}

function appendAudit(session: CanonicalCashSession, action: string, referenceId: string, message: string): void {
  const now = nowIso();
  const auditLogId = cleanId(`${referenceId}_${action}`);
  const rows = readVendorScopedList<Record<string, unknown>>(AUDIT_LOG_COLLECTION, [], session.vendorId);
  writeVendorScopedList(AUDIT_LOG_COLLECTION, [{
    auditLogId,
    vendorId: session.vendorId,
    branchId: session.branchId,
    terminalId: session.terminalId,
    staffId: session.staffId,
    eventType: action,
    referenceType: 'BUSINESS_DAY',
    referenceId,
    message,
    createdAt: now
  }, ...rows.filter((row) => row.auditLogId !== auditLogId)], session.vendorId);
}

function appendBiEvent(session: CanonicalCashSession, eventType: string, payload: Record<string, unknown>): void {
  const now = nowIso();
  const eventId = cleanId(`${eventType}_${session.branchId}_${now}`);
  const rows = readVendorScopedList<Record<string, unknown>>(BI_EVENTS_COLLECTION, [], session.vendorId);
  writeVendorScopedList(BI_EVENTS_COLLECTION, [{
    eventId,
    vendorId: session.vendorId,
    branchId: session.branchId,
    terminalId: session.terminalId,
    staffId: session.staffId,
    eventType,
    severity: eventType.includes('BLOCKED') ? 'WARNING' : 'INFO',
    payload,
    createdAt: now
  }, ...rows.filter((row) => row.eventId !== eventId)], session.vendorId);
}

function shiftsForDay(session: CanonicalCashSession, businessDate: string): ShiftSessionControl[] {
  return readVendorScopedList<ShiftSessionControl>(POS_SHIFT_STORE_KEY, [], session.vendorId)
    .filter((shift) =>
      shift.vendorId === session.vendorId
      && shift.branchId === session.branchId
      && (shift.openedAt || '').slice(0, 10) === businessDate
    );
}

function salesForDay(session: CanonicalCashSession, businessDate: string): SaleLike[] {
  return readVendorScopedList<SaleLike>(SALES_COLLECTION, [], session.vendorId)
    .filter((sale) => sale.branchId === session.branchId && (sale.saleDate || '').slice(0, 10) === businessDate && sale.saleStatus !== 'Failed');
}

function paymentsForDay(session: CanonicalCashSession, businessDate: string): PaymentLike[] {
  return readVendorScopedList<PaymentLike>(PAYMENTS_COLLECTION, [], session.vendorId)
    .filter((payment) => payment.branchId === session.branchId && (payment.receivedAt || '').slice(0, 10) === businessDate);
}

function methodFromPayment(value: string | undefined): PaymentReconciliationMethod {
  if (value === 'Cash') return 'Cash';
  if (value === 'Mobile Money') return 'Mobile Money';
  if (value === 'Card') return 'Card';
  if (value === 'Bank Transfer') return 'Bank Transfer';
  if (value === 'Credit') return 'Credit';
  return 'Other';
}

async function pendingSyncCount(session: CanonicalCashSession): Promise<number> {
  const queue = await getOfflineSyncQueue().catch(() => []);
  return queue.filter((item) =>
    item.vendorId === session.vendorId
    && item.branchId === session.branchId
    && ['Queued', 'Ready To Sync', 'Failed', 'Conflict', 'Held For Review'].includes(item.status)
  ).length;
}

export function getBusinessDays(vendorId: string, branchId?: string): BusinessDayRecord[] {
  return readVendorScopedList<BusinessDayRecord>(BUSINESS_DAYS_COLLECTION, [], vendorId)
    .filter((day) => !branchId || day.branchId === branchId);
}

export async function openBusinessDay(input: {
  businessDate?: string;
  ownerNotes?: string;
}, sessionInput?: PosSession | CanonicalCashSession | null): Promise<BusinessDayRecord> {
  const session = assertCanonicalCashSession(sessionInput);
  const businessDate = input.businessDate || today();
  const existing = getBusinessDays(session.vendorId, session.branchId).find((day) =>
    day.businessDate === businessDate && day.status !== 'Locked'
  );
  if (existing) return existing;
  const now = nowIso();
  const record: BusinessDayRecord = {
    businessDayId: businessDayId(session.vendorId, session.branchId, businessDate),
    vendorId: session.vendorId,
    branchId: session.branchId,
    businessDate,
    openedAt: now,
    openedBy: session.staffId,
    totalSales: 0,
    totalCash: 0,
    totalNonCash: 0,
    totalRefunds: 0,
    totalDiscounts: 0,
    totalVat: 0,
    expectedCash: 0,
    countedCash: 0,
    cashVariance: 0,
    openShiftCount: 0,
    pendingSyncCount: 0,
    status: 'Open',
    ownerNotes: input.ownerNotes || '',
    createdAt: now,
    updatedAt: now
  };
  appendAudit(session, 'BUSINESS_DAY_OPENED', record.businessDayId, 'Business day opened.');
  return saveBusinessDay(record);
}

export async function buildBusinessDaySummary(
  businessDate: string,
  sessionInput?: PosSession | CanonicalCashSession | null
): Promise<Omit<BusinessDayRecord, 'businessDayId' | 'openedAt' | 'openedBy' | 'status' | 'ownerNotes' | 'createdAt' | 'updatedAt'>> {
  const session = assertCanonicalCashSession(sessionInput);
  const shifts = shiftsForDay(session, businessDate);
  const sales = salesForDay(session, businessDate);
  const payments = paymentsForDay(session, businessDate);
  const cashBreakdowns = await Promise.all(shifts.map((shift) => calculateExpectedCash(shift.id, session.vendorId)));
  const counts = shifts.flatMap((shift) => getCashCounts(session.vendorId, shift.id));
  const totalCash = payments.filter((payment) => methodFromPayment(payment.paymentMethod) === 'Cash').reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const totalPayments = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const expectedCash = roundMoney(cashBreakdowns.reduce((sum, row) => sum + row.expectedCash, 0));
  const countedCash = roundMoney(counts.filter((count) => count.status === 'Final' || count.status === 'Approved' || count.status === 'PendingReview').reduce((sum, count) => sum + count.countedCash, 0));
  return {
    vendorId: session.vendorId,
    branchId: session.branchId,
    businessDate,
    closedAt: undefined,
    closedBy: undefined,
    totalSales: roundMoney(sales.reduce((sum, sale) => sum + Number(sale.grandTotal || 0), 0)),
    totalCash: roundMoney(totalCash),
    totalNonCash: roundMoney(totalPayments - totalCash),
    totalRefunds: 0,
    totalDiscounts: roundMoney(sales.reduce((sum, sale) => sum + Number(sale.discountTotal || 0), 0)),
    totalVat: roundMoney(sales.reduce((sum, sale) => sum + Number(sale.vatTotal || 0), 0)),
    expectedCash,
    countedCash,
    cashVariance: roundMoney(countedCash - expectedCash),
    openShiftCount: shifts.filter((shift) => ['Open', 'Counting', 'PendingApproval', 'Reopened'].includes(shift.status)).length,
    pendingSyncCount: await pendingSyncCount(session)
  };
}

export function recordPaymentReconciliation(input: {
  businessDate: string;
  method: PaymentReconciliationMethod;
  systemTotal: number;
  providerTotal: number;
  notes?: string;
}, sessionInput?: PosSession | CanonicalCashSession | null): PaymentReconciliationRecord {
  const session = assertCanonicalCashSession(sessionInput);
  const now = nowIso();
  const difference = roundMoney(input.providerTotal - input.systemTotal);
  const record: PaymentReconciliationRecord = {
    reconciliationId: cleanId(`${session.vendorId}_${session.branchId}_${input.businessDate}_${input.method}`),
    vendorId: session.vendorId,
    branchId: session.branchId,
    businessDate: input.businessDate,
    method: input.method,
    systemTotal: roundMoney(input.systemTotal),
    providerTotal: roundMoney(input.providerTotal),
    difference,
    status: difference === 0 ? 'Balanced' : 'PendingReview',
    notes: input.notes || '',
    createdAt: now,
    updatedAt: now
  };
  const rows = readVendorScopedList<PaymentReconciliationRecord>(PAYMENT_RECONCILIATIONS_COLLECTION, [], session.vendorId);
  writeVendorScopedList(PAYMENT_RECONCILIATIONS_COLLECTION, [record, ...rows.filter((row) => row.reconciliationId !== record.reconciliationId)], session.vendorId);
  return record;
}

export function createBankbookEntryForDeposit(input: {
  businessDate: string;
  bankAccountId: string;
  depositReference: string;
  amount: number;
  notes?: string;
}, sessionInput?: PosSession | CanonicalCashSession | null): BankbookEntryRecord {
  const session = assertCanonicalCashSession(sessionInput);
  const now = nowIso();
  const record: BankbookEntryRecord = {
    bankbookEntryId: cleanId(`${session.vendorId}_${input.depositReference}_BANKBOOK`),
    vendorId: session.vendorId,
    branchId: session.branchId,
    businessDate: input.businessDate,
    bankAccountId: input.bankAccountId,
    referenceId: input.depositReference,
    entryType: 'Deposit',
    amount: roundMoney(input.amount),
    status: 'Pending',
    notes: input.notes || 'Bank deposit pending confirmation.',
    createdAt: now,
    updatedAt: now
  };
  const rows = readVendorScopedList<BankbookEntryRecord>(BANKBOOK_ENTRIES_COLLECTION, [], session.vendorId);
  writeVendorScopedList(BANKBOOK_ENTRIES_COLLECTION, [record, ...rows.filter((row) => row.bankbookEntryId !== record.bankbookEntryId)], session.vendorId);
  return record;
}

export async function lockBusinessDay(input: {
  businessDate?: string;
  ownerNotes: string;
  overrideCriticalSync?: boolean;
}, sessionInput?: PosSession | CanonicalCashSession | null): Promise<{ ok: boolean; message: string; businessDay: BusinessDayRecord; blockingReasons: string[] }> {
  const session = assertCanonicalCashSession(sessionInput);
  const businessDate = input.businessDate || today();
  const current = await openBusinessDay({ businessDate, ownerNotes: input.ownerNotes }, session);
  const summary = await buildBusinessDaySummary(businessDate, session);
  const shifts = shiftsForDay(session, businessDate);
  const unresolvedVariances = shifts.flatMap((shift) => getCashVariances(session.vendorId, shift.id))
    .filter((variance) => ['Material', 'High'].includes(variance.severity) && !['Approved', 'Explained'].includes(variance.status));
  const blockingReasons = [
    summary.openShiftCount > 0 ? 'Open shift exists' : '',
    unresolvedVariances.length > 0 ? 'Material cash variance is unresolved' : '',
    summary.pendingSyncCount > 0 && !input.overrideCriticalSync ? 'Critical records are waiting to synchronize' : ''
  ].filter(Boolean);

  if (blockingReasons.length > 0) {
    const blocked = saveBusinessDay({
      ...current,
      ...summary,
      status: 'PendingReview',
      ownerNotes: input.ownerNotes,
      updatedAt: nowIso()
    });
    appendBiEvent(session, 'BUSINESS_DAY_LOCK_BLOCKED', { businessDate, blockingReasons });
    return { ok: false, message: 'Business day cannot be locked.', businessDay: blocked, blockingReasons };
  }

  const now = nowIso();
  const locked = saveBusinessDay({
    ...current,
    ...summary,
    closedAt: now,
    closedBy: session.staffId,
    status: 'Locked',
    ownerNotes: input.ownerNotes,
    updatedAt: now
  });
  appendAudit(session, 'BUSINESS_DAY_LOCKED', locked.businessDayId, 'Business day locked.');
  appendBiEvent(session, 'BUSINESS_DAY_LOCKED', { businessDate, totalSales: locked.totalSales, cashVariance: locked.cashVariance });
  return { ok: true, message: 'Business day locked successfully.', businessDay: locked, blockingReasons: [] };
}

export function reopenBusinessDay(input: {
  businessDayId: string;
  reason: string;
}, sessionInput?: PosSession | CanonicalCashSession | null): BusinessDayRecord {
  const session = assertCanonicalCashSession(sessionInput);
  if (!hasCashPermission(session, 'businessDay.reopen') && !['Owner', 'SysAdmin', 'Manager'].includes(session.role)) {
    throw new Error('Reopening a business day requires owner or manager approval.');
  }
  const rows = getBusinessDays(session.vendorId, session.branchId);
  const existing = rows.find((day) => day.businessDayId === input.businessDayId);
  if (!existing) throw new Error('Business day was not found.');
  const updated = saveBusinessDay({
    ...existing,
    status: 'Reopened',
    ownerNotes: `${existing.ownerNotes || ''}\nReopened: ${input.reason}`.trim(),
    updatedAt: nowIso()
  });
  appendAudit(session, 'BUSINESS_DAY_REOPENED', updated.businessDayId, input.reason);
  return updated;
}
