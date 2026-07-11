import { assertCanonicalCashSession, type CanonicalCashSession } from './cashSessionService';
import { calculateExpectedCash } from './cashMovementService';
import type { PosSession } from '../types';
import { readVendorScopedList, writeVendorScopedList } from '../utils/vendorDataMode';

export const CASH_COUNTS_COLLECTION = 'cash_counts';
export const CASH_VARIANCES_COLLECTION = 'cash_variances';

const AUDIT_LOG_COLLECTION = 'audit_logs';

export type CashCountStatus = 'Draft' | 'Counting' | 'Final' | 'PendingReview' | 'Approved' | 'CorrectionRequired';
export type CashVarianceStatus = 'Exact' | 'Over' | 'Short' | 'PendingReview' | 'Explained' | 'Approved' | 'Escalated';
export type CashVarianceSeverity = 'None' | 'Small' | 'Material' | 'High';

export interface CashDenominationCount {
  denomination: string;
  quantity: number;
  total: number;
}

export interface CashCountRecord {
  cashCountId: string;
  shiftId: string;
  vendorId: string;
  branchId: string;
  terminalId: string;
  staffId: string;
  countedAt: string;
  denominations: CashDenominationCount[];
  countedCash: number;
  expectedCash: number;
  variance: number;
  notes: string;
  status: CashCountStatus;
  confirmedByStaff: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CashVarianceRecord {
  varianceId: string;
  shiftId: string;
  vendorId: string;
  terminalId: string;
  staffId: string;
  expectedCash: number;
  countedCash: number;
  variance: number;
  tolerance: number;
  severity: CashVarianceSeverity;
  explanation: string;
  reviewedBy?: string;
  reviewedAt?: string;
  status: CashVarianceStatus;
  cashCountId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CashCountPolicy {
  smallVarianceTolerance: number;
  materialVarianceThreshold: number;
  highVarianceThreshold: number;
}

const DEFAULT_COUNT_POLICY: CashCountPolicy = {
  smallVarianceTolerance: 2,
  materialVarianceThreshold: 10,
  highVarianceThreshold: 50
};

function roundMoney(value: number): number {
  return Number((Math.round((Number(value) + Number.EPSILON) * 100) / 100).toFixed(2));
}

function nowIso(): string {
  return new Date().toISOString();
}

function clean(value: unknown): string {
  return String(value ?? '').trim();
}

function cleanId(value: string): string {
  return String(value || '').replace(/[^A-Za-z0-9_-]/g, '_');
}

export function calculateDenominationTotal(denominations: CashDenominationCount[]): number {
  return roundMoney(denominations.reduce((total, row) => total + roundMoney(row.total), 0));
}

export function cashVarianceSeverity(variance: number, policy: CashCountPolicy = DEFAULT_COUNT_POLICY): CashVarianceSeverity {
  const absolute = Math.abs(variance);
  if (absolute === 0) return 'None';
  if (absolute <= policy.smallVarianceTolerance) return 'Small';
  if (absolute >= policy.highVarianceThreshold) return 'High';
  if (absolute >= policy.materialVarianceThreshold) return 'Material';
  return 'Small';
}

export function cashVarianceStatus(
  variance: number,
  explanation: string,
  policy: CashCountPolicy = DEFAULT_COUNT_POLICY
): CashVarianceStatus {
  if (variance === 0) return 'Exact';
  const severity = cashVarianceSeverity(variance, policy);
  if (severity === 'High') return 'Escalated';
  if (severity === 'Material' && !clean(explanation)) return 'PendingReview';
  if (clean(explanation)) return 'Explained';
  return variance > 0 ? 'Over' : 'Short';
}

function defaultDenomination(countedCash: number): CashDenominationCount[] {
  return [{ denomination: 'Drawer Count', quantity: 1, total: roundMoney(countedCash) }];
}

function saveCount(record: CashCountRecord): CashCountRecord {
  const rows = readVendorScopedList<CashCountRecord>(CASH_COUNTS_COLLECTION, [], record.vendorId);
  writeVendorScopedList(CASH_COUNTS_COLLECTION, [record, ...rows.filter((row) => row.cashCountId !== record.cashCountId)], record.vendorId);
  return record;
}

function saveVariance(record: CashVarianceRecord): CashVarianceRecord {
  const rows = readVendorScopedList<CashVarianceRecord>(CASH_VARIANCES_COLLECTION, [], record.vendorId);
  writeVendorScopedList(CASH_VARIANCES_COLLECTION, [record, ...rows.filter((row) => row.varianceId !== record.varianceId)], record.vendorId);
  return record;
}

function appendAudit(session: CanonicalCashSession, action: string, referenceId: string, message: string): void {
  const now = nowIso();
  const auditLogId = cleanId(`${referenceId}_${action}`);
  const rows = readVendorScopedList<Record<string, unknown>>(AUDIT_LOG_COLLECTION, [], session.vendorId);
  const record = {
    auditLogId,
    vendorId: session.vendorId,
    branchId: session.branchId,
    terminalId: session.terminalId,
    staffId: session.staffId,
    eventType: action,
    referenceType: 'CASH_CONTROL',
    referenceId,
    message,
    createdAt: now
  };
  writeVendorScopedList(AUDIT_LOG_COLLECTION, [record, ...rows.filter((row) => row.auditLogId !== auditLogId)], session.vendorId);
}

export function getCashCounts(vendorId: string, shiftId?: string): CashCountRecord[] {
  return readVendorScopedList<CashCountRecord>(CASH_COUNTS_COLLECTION, [], vendorId)
    .filter((row) => !shiftId || row.shiftId === shiftId);
}

export function getCashVariances(vendorId: string, shiftId?: string): CashVarianceRecord[] {
  return readVendorScopedList<CashVarianceRecord>(CASH_VARIANCES_COLLECTION, [], vendorId)
    .filter((row) => !shiftId || row.shiftId === shiftId);
}

export async function createCashCount(input: {
  shiftId: string;
  countedCash: number;
  denominations?: CashDenominationCount[];
  notes?: string;
  status?: CashCountStatus;
}, sessionInput?: PosSession | CanonicalCashSession | null): Promise<CashCountRecord> {
  const session = assertCanonicalCashSession(sessionInput);
  const countedCash = roundMoney(input.countedCash);
  if (countedCash < 0) throw new Error('Counted cash cannot be negative.');
  const denominations = input.denominations && input.denominations.length > 0
    ? input.denominations.map((row) => ({ ...row, total: roundMoney(row.total) }))
    : defaultDenomination(countedCash);
  const denominationTotal = calculateDenominationTotal(denominations);
  if (denominationTotal !== countedCash) {
    throw new Error('Counted cash must equal denomination total.');
  }
  const expected = await calculateExpectedCash(input.shiftId, session.vendorId);
  const now = nowIso();
  const record: CashCountRecord = {
    cashCountId: cleanId(`${input.shiftId}_${now}_COUNT`),
    shiftId: input.shiftId,
    vendorId: session.vendorId,
    branchId: session.branchId,
    terminalId: session.terminalId,
    staffId: session.staffId,
    countedAt: now,
    denominations,
    countedCash,
    expectedCash: expected.expectedCash,
    variance: roundMoney(countedCash - expected.expectedCash),
    notes: input.notes || 'Drawer cash counted.',
    status: input.status || 'Counting',
    confirmedByStaff: false,
    createdAt: now,
    updatedAt: now
  };
  appendAudit(session, 'CASH_COUNT_CREATED', record.cashCountId, 'Drawer count started.');
  return saveCount(record);
}

export async function finalizeCashCount(input: {
  cashCountId?: string;
  shiftId: string;
  countedCash: number;
  denominations?: CashDenominationCount[];
  notes?: string;
  explanation?: string;
  confirmedByStaff: boolean;
}, sessionInput?: PosSession | CanonicalCashSession | null): Promise<{ count: CashCountRecord; variance?: CashVarianceRecord }> {
  const session = assertCanonicalCashSession(sessionInput);
  if (!input.confirmedByStaff) throw new Error('Cash count requires staff confirmation.');
  const existing = input.cashCountId
    ? getCashCounts(session.vendorId).find((row) => row.cashCountId === input.cashCountId)
    : undefined;
  const draft = existing || await createCashCount({
    shiftId: input.shiftId,
    countedCash: input.countedCash,
    denominations: input.denominations,
    notes: input.notes,
    status: 'Counting'
  }, session);
  if (draft.status === 'Final' || draft.status === 'Approved') {
    throw new Error('Final cash count cannot be edited without an approved correction.');
  }
  const expected = await calculateExpectedCash(input.shiftId, session.vendorId);
  const countedCash = roundMoney(input.countedCash);
  const denominations = input.denominations && input.denominations.length > 0 ? input.denominations : draft.denominations;
  if (calculateDenominationTotal(denominations) !== countedCash) {
    throw new Error('Counted cash must equal denomination total.');
  }
  const variance = roundMoney(countedCash - expected.expectedCash);
  const severity = cashVarianceSeverity(variance);
  const count: CashCountRecord = {
    ...draft,
    countedAt: nowIso(),
    denominations,
    countedCash,
    expectedCash: expected.expectedCash,
    variance,
    notes: input.notes || draft.notes,
    status: variance === 0 || severity === 'Small' ? 'Final' : 'PendingReview',
    confirmedByStaff: true,
    updatedAt: nowIso()
  };
  saveCount(count);

  let varianceRecord: CashVarianceRecord | undefined;
  if (variance !== 0) {
    const status = cashVarianceStatus(variance, input.explanation || count.notes);
    varianceRecord = saveVariance({
      varianceId: cleanId(`${input.shiftId}_${count.cashCountId}_VARIANCE`),
      shiftId: input.shiftId,
      vendorId: session.vendorId,
      terminalId: session.terminalId,
      staffId: session.staffId,
      expectedCash: expected.expectedCash,
      countedCash,
      variance,
      tolerance: DEFAULT_COUNT_POLICY.smallVarianceTolerance,
      severity,
      explanation: input.explanation || count.notes,
      status,
      cashCountId: count.cashCountId,
      createdAt: count.createdAt,
      updatedAt: nowIso()
    });
    appendAudit(session, 'CASH_VARIANCE_RECORDED', varianceRecord.varianceId, `Cash variance recorded: ${variance.toFixed(2)}.`);
  }

  appendAudit(session, 'CASH_COUNT_FINALIZED', count.cashCountId, 'Drawer count finalized.');
  return { count, variance: varianceRecord };
}

export function approveCashVariance(input: {
  varianceId: string;
  reviewedBy: string;
  decisionNote: string;
}, sessionInput?: PosSession | CanonicalCashSession | null): CashVarianceRecord {
  const session = assertCanonicalCashSession(sessionInput);
  const rows = getCashVariances(session.vendorId);
  const existing = rows.find((row) => row.varianceId === input.varianceId);
  if (!existing) throw new Error('Cash variance was not found.');
  const now = nowIso();
  const updated: CashVarianceRecord = {
    ...existing,
    reviewedBy: input.reviewedBy,
    reviewedAt: now,
    explanation: input.decisionNote || existing.explanation,
    status: 'Approved',
    updatedAt: now
  };
  saveVariance(updated);
  appendAudit(session, 'CASH_VARIANCE_APPROVED', updated.varianceId, input.decisionNote || 'Cash variance approved.');
  return updated;
}
