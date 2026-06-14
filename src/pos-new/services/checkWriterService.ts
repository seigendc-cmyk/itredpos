import type {
  CheckPaymentPurpose,
  CheckStatus,
  CheckWriterRecord,
  CheckWriterSettings,
  FinancialActivityType,
  PayeeRecord
} from '../types/posTypes';
import { amountInWords } from '../utils/amountInWords';
import { createFinancialActivityRecord, getFinancialControlAccounts } from './financialControlService';

const SETTINGS_KEY = 'itred_pos_check_writer_settings_v1';
const PAYEES_KEY = 'itred_pos_check_writer_payees_v1';
const CHECKS_KEY = 'itred_pos_check_writer_checks_v1';
const CHECK_EVENTS_KEY = 'itred_pos_check_writer_events_v1';

export interface FinancialToolEvent {
  eventId: string;
  eventType: string;
  message: string;
  staffId: string;
  createdAt: string;
}

const now = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);

function readJson<T>(key: string, fallback: T): T {
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(fallback));
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch {
    localStorage.setItem(key, JSON.stringify(fallback));
    return fallback;
  }
}

function saveJson<T>(key: string, value: T): T {
  if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(value));
  return value;
}

function addEvent(eventType: string, message: string, staffId = 'Admin User'): FinancialToolEvent[] {
  const rows = readJson<FinancialToolEvent[]>(CHECK_EVENTS_KEY, []);
  const next: FinancialToolEvent = { eventId: `FTE-${Date.now()}`, eventType, message, staffId, createdAt: now() };
  return saveJson(CHECK_EVENTS_KEY, [next, ...rows].slice(0, 120));
}

function defaultSettings(): CheckWriterSettings {
  return {
    settingsId: 'CHECK-SETTINGS-LOCAL',
    chequePrefix: 'CHQ',
    nextChequeNumber: 1,
    chequeNumberPadding: 6,
    requireApprovalAboveAmount: true,
    approvalThresholdAmount: 500,
    allowManualChequeNumber: false,
    printBusinessName: true,
    printPayeeLine: true,
    printAmountInWords: true,
    printMemo: true,
    updatedBy: 'Build Development',
    updatedAt: now()
  };
}

function defaultPayees(): PayeeRecord[] {
  return [
    { payeeId: 'PAYEE-001', payeeCode: 'SUP-HYD', payeeName: 'Hydraulic Parts Supplier', payeeType: 'Supplier', defaultCOAAccountId: 'COA-AP', defaultPaymentPurpose: 'SupplierPayment', active: true, notes: 'Build-development local payee.', createdAt: now(), updatedAt: now() },
    { payeeId: 'PAYEE-002', payeeCode: 'PETTY', payeeName: 'Petty Cash Custodian', payeeType: 'Staff', defaultCOAAccountId: 'COA-PETTY', defaultPaymentPurpose: 'PettyCash', active: true, notes: 'Build-development local payee.', createdAt: now(), updatedAt: now() },
    { payeeId: 'PAYEE-003', payeeCode: 'OWNER', payeeName: 'Owner Drawings', payeeType: 'Owner', defaultCOAAccountId: 'COA-OWNER-FUNDS', defaultPaymentPurpose: 'OwnerDrawing', active: true, notes: 'Build-development local payee.', createdAt: now(), updatedAt: now() }
  ];
}

function defaultChecks(): CheckWriterRecord[] {
  return [];
}

function checkNo(settings: CheckWriterSettings): string {
  return `${settings.chequePrefix}-${String(settings.nextChequeNumber).padStart(Math.max(3, settings.chequeNumberPadding), '0')}`;
}

export async function getCheckWriterSettings(): Promise<CheckWriterSettings> {
  const settings = readJson<CheckWriterSettings>(SETTINGS_KEY, defaultSettings());
  const accounts = await getFinancialControlAccounts();
  return { ...settings, defaultBankAccountId: settings.defaultBankAccountId || accounts.find((account) => account.accountType === 'Bank')?.accountId || accounts[0]?.accountId };
}

export async function updateCheckWriterSettings(payload: Partial<CheckWriterSettings>, staffId = 'Admin User'): Promise<CheckWriterSettings> {
  const current = await getCheckWriterSettings();
  const next: CheckWriterSettings = {
    ...current,
    ...payload,
    nextChequeNumber: Math.max(1, Number(payload.nextChequeNumber ?? current.nextChequeNumber) || 1),
    chequeNumberPadding: Math.max(3, Number(payload.chequeNumberPadding ?? current.chequeNumberPadding) || 6),
    updatedBy: staffId,
    updatedAt: now()
  };
  addEvent('CHECK_WRITER_SETTINGS_UPDATED', `Check writer settings updated. Next number ${previewNumber(next)}.`, staffId);
  return saveJson(SETTINGS_KEY, next);
}

export async function previewNextCheckNumber(): Promise<string> {
  const settings = await getCheckWriterSettings();
  addEvent('CHECK_WRITER_NEXT_NUMBER_PREVIEWED', `Next check number previewed as ${previewNumber(settings)}.`, settings.updatedBy);
  return previewNumber(settings);
}

export function previewNumber(settings: CheckWriterSettings): string {
  return checkNo(settings);
}

export async function generateNextCheckNumber(): Promise<string> {
  return previewNumber(await getCheckWriterSettings());
}

export async function incrementNextCheckNumber(): Promise<CheckWriterSettings> {
  const settings = await getCheckWriterSettings();
  return saveJson(SETTINGS_KEY, { ...settings, nextChequeNumber: settings.nextChequeNumber + 1, updatedAt: now() });
}

export async function getPayees(filters: { search?: string; activeOnly?: boolean } = {}): Promise<PayeeRecord[]> {
  const rows = readJson<PayeeRecord[]>(PAYEES_KEY, defaultPayees());
  const parts = (filters.search || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
  return rows.filter((row) =>
    (!filters.activeOnly || row.active) &&
    parts.every((part) => `${row.payeeCode} ${row.payeeName} ${row.payeeType} ${row.phone || ''} ${row.email || ''}`.toLowerCase().includes(part))
  );
}

export async function createPayee(payload: Partial<PayeeRecord>, staffId = 'Admin User'): Promise<PayeeRecord[]> {
  const rows = await getPayees();
  const next: PayeeRecord = {
    payeeId: `PAYEE-${Date.now()}`,
    payeeCode: payload.payeeCode || `P-${rows.length + 1}`,
    payeeName: payload.payeeName || 'New Payee',
    payeeType: payload.payeeType || 'Other',
    linkedSupplierId: payload.linkedSupplierId,
    linkedCustomerId: payload.linkedCustomerId,
    linkedStaffId: payload.linkedStaffId,
    phone: payload.phone,
    email: payload.email,
    address: payload.address,
    defaultCOAAccountId: payload.defaultCOAAccountId,
    defaultPaymentPurpose: payload.defaultPaymentPurpose || 'Other',
    active: payload.active ?? true,
    notes: payload.notes || 'Created locally from Payee Register.',
    createdAt: now(),
    updatedAt: now()
  };
  addEvent('PAYEE_CREATED', `${next.payeeName} payee created.`, staffId);
  return saveJson(PAYEES_KEY, [next, ...rows]);
}

export async function updatePayee(payeeId: string, patch: Partial<PayeeRecord>, staffId = 'Admin User'): Promise<PayeeRecord[]> {
  const rows = (await getPayees()).map((row) => row.payeeId === payeeId ? { ...row, ...patch, updatedAt: now() } : row);
  addEvent('PAYEE_UPDATED', `${payeeId} payee updated.`, staffId);
  return saveJson(PAYEES_KEY, rows);
}

export async function deactivatePayee(payeeId: string, reason: string, staffId = 'Admin User'): Promise<PayeeRecord[]> {
  addEvent('PAYEE_DEACTIVATED', `${payeeId} deactivated. ${reason}`, staffId);
  return updatePayee(payeeId, { active: false, notes: reason }, staffId);
}

export async function getChecks(filters: { search?: string; status?: CheckStatus | 'All' } = {}): Promise<CheckWriterRecord[]> {
  const rows = readJson<CheckWriterRecord[]>(CHECKS_KEY, defaultChecks());
  const parts = (filters.search || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
  return rows.filter((row) =>
    (!filters.status || filters.status === 'All' || row.status === filters.status) &&
    parts.every((part) => `${row.checkNumber} ${row.payeeName} ${row.paymentPurpose} ${row.bankAccountName} ${row.memo}`.toLowerCase().includes(part))
  );
}

function activityTypeForPurpose(purpose: CheckPaymentPurpose): FinancialActivityType {
  if (purpose === 'SupplierPayment') return 'SupplierPaymentMade';
  if (purpose === 'Refund' || purpose === 'CustomerDepositRefund') return 'Refund';
  if (purpose === 'OwnerDrawing') return 'OwnerDrawing';
  if (purpose === 'COGSReserveUse') return 'COGSReserveUsed';
  return 'DrawerExpense';
}

export async function createCheckDraft(payload: Partial<CheckWriterRecord>, staffId = 'Admin User'): Promise<CheckWriterRecord[]> {
  const settings = await getCheckWriterSettings();
  const rows = await getChecks();
  const number = payload.checkNumber || previewNumber(settings);
  if (rows.some((row) => row.checkNumber === number && row.status !== 'Voided' && row.status !== 'Cancelled')) {
    throw new Error(`Duplicate check number ${number}.`);
  }
  if (!payload.payeeId || !payload.payeeName) throw new Error('Payee is required.');
  if (!payload.bankAccountId || !payload.debitAccountId) throw new Error('Bank and debit accounts are required.');
  if (!payload.amount || payload.amount <= 0) throw new Error('Amount must be greater than 0.');
  const next: CheckWriterRecord = {
    checkId: `CHK-${Date.now()}`,
    checkNumber: number,
    checkDate: payload.checkDate || today(),
    payeeId: payload.payeeId,
    payeeName: payload.payeeName,
    payeeType: payload.payeeType || 'Other',
    amount: payload.amount,
    amountInWords: amountInWords(payload.amount),
    currency: payload.currency || 'USD',
    bankAccountId: payload.bankAccountId,
    bankAccountName: payload.bankAccountName || 'Bank/Cash Control',
    creditAccountId: payload.creditAccountId || payload.bankAccountId,
    creditAccountName: payload.creditAccountName || payload.bankAccountName || 'Bank/Cash Control',
    debitAccountId: payload.debitAccountId,
    debitAccountName: payload.debitAccountName || 'Expense / Payable Control',
    paymentPurpose: payload.paymentPurpose || 'Other',
    linkedModule: payload.linkedModule,
    linkedRecordId: payload.linkedRecordId,
    memo: payload.memo || 'Financial Control preview only. Not final posted accounts or banking transaction.',
    status: payload.amount > settings.approvalThresholdAmount && settings.requireApprovalAboveAmount ? 'PendingApproval' : 'Draft',
    approvalId: payload.amount > settings.approvalThresholdAmount && settings.requireApprovalAboveAmount ? `CHECK_PAYMENT_APPROVAL-${Date.now()}` : undefined,
    createdBy: staffId,
    createdAt: now(),
    updatedAt: now()
  };
  await incrementNextCheckNumber();
  addEvent('CHECK_DRAFT_CREATED', `${next.checkNumber} draft created for ${next.payeeName}.`, staffId);
  return saveJson(CHECKS_KEY, [next, ...rows]);
}

async function updateCheck(checkId: string, status: CheckStatus, staffId: string, eventType: string, patch: Partial<CheckWriterRecord> = {}): Promise<CheckWriterRecord[]> {
  const rows = (await getChecks()).map((row) => row.checkId === checkId ? { ...row, ...patch, status, updatedAt: now() } : row);
  const row = rows.find((item) => item.checkId === checkId);
  addEvent(eventType, `${row?.checkNumber || checkId} ${status}.`, staffId);
  return saveJson(CHECKS_KEY, rows);
}

export const prepareCheck = (checkId: string, staffId = 'Admin User') => updateCheck(checkId, 'Prepared', staffId, 'CHECK_PREPARED');
export const approveCheckPreview = (checkId: string, staffId = 'Admin User') => updateCheck(checkId, 'Approved', staffId, 'CHECK_SUBMITTED_FOR_APPROVAL');
export const printCheckPreview = (checkId: string, staffId = 'Admin User') => updateCheck(checkId, 'PrintedPreview', staffId, 'CHECK_PRINT_PREVIEWED', { printedAt: now() });
export const voidCheck = (checkId: string, staffId = 'Admin User', reason = '') => updateCheck(checkId, 'Voided', staffId, 'CHECK_VOIDED', { voidedBy: staffId, voidedAt: now(), voidReason: reason });
export const cancelCheck = (checkId: string, staffId = 'Admin User', reason = '') => updateCheck(checkId, 'Cancelled', staffId, 'CHECK_CANCELLED', { voidReason: reason });

export async function markCheckIssuedLocal(checkId: string, staffId = 'Admin User', note = ''): Promise<CheckWriterRecord[]> {
  const check = (await getChecks()).find((row) => row.checkId === checkId);
  if (!check) return getChecks();
  const settings = await getCheckWriterSettings();
  if (settings.requireApprovalAboveAmount && check.amount > settings.approvalThresholdAmount && !['Approved', 'PrintedPreview'].includes(check.status)) {
    throw new Error('Approval placeholder is required before Issued Local.');
  }
  await createFinancialActivityRecord({
    type: activityTypeForPurpose(check.paymentPurpose),
    source: 'ManualPlaceholder',
    sourceReferenceId: check.checkId,
    sourceReferenceNumber: check.checkNumber,
    description: `${check.paymentPurpose} check preview issued locally to ${check.payeeName}.`,
    debitAccountId: check.debitAccountId,
    debitAccountName: check.debitAccountName,
    creditAccountId: check.creditAccountId,
    creditAccountName: check.creditAccountName,
    amount: check.amount,
    currency: check.currency,
    cashImpact: check.bankAccountName.toLowerCase().includes('cash') ? -check.amount : 0,
    bankImpact: check.bankAccountName.toLowerCase().includes('bank') ? -check.amount : 0,
    reserveImpact: check.paymentPurpose === 'COGSReserveUse' ? -check.amount : 0,
    status: 'IssuedLocal',
    staffName: staffId,
    notes: note || 'Financial Control preview only. Not final posted accounts or banking transaction.'
  });
  return updateCheck(checkId, 'IssuedLocal', staffId, 'CHECK_MARKED_ISSUED_LOCAL', { issuedBy: staffId, issuedAt: now() });
}

export function getFinancialToolEvents(): FinancialToolEvent[] {
  return readJson<FinancialToolEvent[]>(CHECK_EVENTS_KEY, []);
}
