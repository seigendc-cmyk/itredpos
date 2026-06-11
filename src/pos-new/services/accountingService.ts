import {
  AccountingActivityEvent,
  AccountingActivityEventType,
  AccountingPosting,
  CashbookEntry,
  COAAccount,
  COGSReserveSummary,
  InventoryAssetPostingRow,
  PaymentAccountingSummary,
  PostingStatus,
  SalesAccountingSummary,
  VATSummary,
  AccountingReadinessCheck
} from '../types/posTypes';
import {
  mockAccountingActivityEvents,
  mockAccountingPostings,
  mockAccountingReadinessChecks,
  mockCashbookEntries,
  mockCOAAccounts,
  mockCOGSReserveRows,
  mockInventoryAssetPostingRows,
  mockPaymentAccountingSummaryRows,
  mockSalesAccountingSummaryRows,
  mockVATSummaryRows
} from '../mock/mockPosData';

export interface AccountingFilters {
  vendorId?: string;
  businessDate?: string;
  branch?: string;
  terminal?: string;
  cashier?: string;
  dateFrom?: string;
  dateTo?: string;
  salesAccount?: string;
  cashAccount?: string;
  movementType?: string;
  vatMode?: string;
}

export interface AccountingPostingPlaceholderPayload {
  sourceReference: string;
  source: AccountingPosting['source'];
  branch: string;
  amount: number;
}

const COA_KEY = 'itred_pos_accounting_coa';
const POSTINGS_KEY = 'itred_pos_accounting_postings';
const ACTIVITY_KEY = 'itred_pos_accounting_activity';

function readList<T>(key: string, fallback: T[]): T[] {
  const raw = localStorage.getItem(key);
  if (!raw) {
    localStorage.setItem(key, JSON.stringify(fallback));
    return fallback;
  }

  try {
    return JSON.parse(raw) as T[];
  } catch {
    localStorage.setItem(key, JSON.stringify(fallback));
    return fallback;
  }
}

function saveList<T>(key: string, list: T[]): T[] {
  localStorage.setItem(key, JSON.stringify(list));
  return list;
}

function addActivity(
  eventType: AccountingActivityEventType,
  message: string,
  operator = 'Admin User'
): AccountingActivityEvent[] {
  const current = readList<AccountingActivityEvent>(ACTIVITY_KEY, mockAccountingActivityEvents);
  const next: AccountingActivityEvent = {
    id: `ACC-ACT-${Math.floor(10000 + Math.random() * 90000)}`,
    timestamp: new Date().toISOString(),
    eventType,
    message,
    operator
  };
  return saveList(ACTIVITY_KEY, [next, ...current].slice(0, 40));
}

function branchMatch(rowBranch: string, branch?: string): boolean {
  return !branch || branch === 'All Branches' || rowBranch === branch;
}

function terminalMatch(rowTerminal: string, terminal?: string): boolean {
  return !terminal || terminal === 'All Terminals' || rowTerminal === terminal;
}

function cashierMatch(rowCashier: string, cashier?: string): boolean {
  return !cashier || cashier === 'All Staff' || rowCashier === cashier;
}

export async function getCOAAccounts(): Promise<COAAccount[]> {
  return readList<COAAccount>(COA_KEY, mockCOAAccounts);
}

export async function getSalesAccountingSummary(filters: AccountingFilters): Promise<SalesAccountingSummary[]> {
  return mockSalesAccountingSummaryRows.filter((row) =>
    branchMatch(row.branch, filters.branch) &&
    terminalMatch(row.terminal, filters.terminal) &&
    cashierMatch(row.cashier, filters.cashier) &&
    (!filters.salesAccount || filters.salesAccount === 'All Sales Accounts' || row.salesAccount.includes(filters.salesAccount))
  );
}

export async function getPaymentAccountingSummary(_filters: AccountingFilters): Promise<PaymentAccountingSummary[]> {
  return mockPaymentAccountingSummaryRows;
}

export async function getCashbookEntries(filters: AccountingFilters): Promise<CashbookEntry[]> {
  return mockCashbookEntries.filter((row) =>
    branchMatch(row.branch, filters.branch) &&
    terminalMatch(row.terminal, filters.terminal) &&
    cashierMatch(row.staff, filters.cashier) &&
    (!filters.cashAccount || filters.cashAccount === 'All Cash Accounts' || row.account.includes(filters.cashAccount)) &&
    (!filters.movementType || filters.movementType === 'All Movement Types' || row.movementType === filters.movementType)
  );
}

export async function getVATSummary(filters: AccountingFilters): Promise<VATSummary[]> {
  const rows = filters.vatMode && filters.vatMode !== 'All VAT Modes'
    ? mockVATSummaryRows.filter((row) => row.vatMode === filters.vatMode)
    : mockVATSummaryRows;
  addActivity('VAT_SUMMARY_VIEWED', 'VAT summary viewed.');
  return rows;
}

export async function getCOGSReserveSummary(_filters: AccountingFilters): Promise<COGSReserveSummary[]> {
  return mockCOGSReserveRows;
}

export async function getInventoryAssetPosting(_filters: AccountingFilters): Promise<InventoryAssetPostingRow[]> {
  return mockInventoryAssetPostingRows;
}

export async function getAccountingReadinessChecks(_vendorId: string): Promise<AccountingReadinessCheck[]> {
  addActivity('ACCOUNTING_READINESS_CHECK_RUN', 'Accounting readiness checklist run.');
  return mockAccountingReadinessChecks;
}

export async function getAccountingActivityEvents(): Promise<AccountingActivityEvent[]> {
  return readList<AccountingActivityEvent>(ACTIVITY_KEY, mockAccountingActivityEvents);
}

export async function createAccountingPostingPlaceholder(
  payload: AccountingPostingPlaceholderPayload
): Promise<AccountingPosting[]> {
  const current = readList<AccountingPosting>(POSTINGS_KEY, mockAccountingPostings);
  const next: AccountingPosting = {
    id: `ACC-POST-${Math.floor(10000 + Math.random() * 90000)}`,
    source: payload.source,
    sourceReference: payload.sourceReference,
    businessDate: '2026-06-09',
    branch: payload.branch,
    postingStatus: 'Draft',
    totalDebit: payload.amount,
    totalCredit: payload.amount
  };
  addActivity('CASHBOOK_ENTRY_CREATED', `Accounting posting placeholder created for ${payload.sourceReference}.`);
  return saveList(POSTINGS_KEY, [next, ...current]);
}

export async function markAccountingPostingReviewed(postingId: string): Promise<AccountingActivityEvent[]> {
  const current = readList<AccountingPosting>(POSTINGS_KEY, mockAccountingPostings);
  saveList<AccountingPosting>(
    POSTINGS_KEY,
    current.map((posting) =>
      posting.id === postingId || posting.sourceReference === postingId
        ? { ...posting, postingStatus: 'Posted' as PostingStatus, reviewedBy: 'Admin User' }
        : posting
    )
  );
  const eventType: AccountingActivityEventType = postingId.includes('PAY')
    ? 'PAYMENT_POSTING_REVIEWED'
    : postingId.includes('INV')
    ? 'INVENTORY_ASSET_POSTING_REVIEWED'
    : 'SALES_POSTING_REVIEWED';
  return addActivity(eventType, `${postingId} marked reviewed locally.`);
}

export async function reverseAccountingPostingPlaceholder(
  postingId: string,
  reason: string
): Promise<AccountingActivityEvent[]> {
  const current = readList<AccountingPosting>(POSTINGS_KEY, mockAccountingPostings);
  saveList<AccountingPosting>(
    POSTINGS_KEY,
    current.map((posting) =>
      posting.id === postingId || posting.sourceReference === postingId
        ? { ...posting, postingStatus: 'Reversed' as PostingStatus, reason }
        : posting
    )
  );
  return addActivity('SALES_POSTING_REVIEWED', `${postingId} reverse placeholder recorded: ${reason}`);
}

export async function exportAccountingReportPlaceholder(reportType: string): Promise<{ message: string; activity: AccountingActivityEvent[] }> {
  const activity = addActivity('ACCOUNTING_REPORT_EXPORT_PREPARED', `${reportType} accounting report export prepared.`);
  return { message: `${reportType} accounting report export prepared.`, activity };
}
