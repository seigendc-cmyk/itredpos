import type {
  FinancialActivityRecord,
  FinancialActivitySource,
  FinancialActivityType,
  FinancialControlAccount,
  FinancialControlAccountType,
  FinancialPositionSummary
} from '../types/posTypes';
import { getCOAAccounts } from './accountingService';

interface FinancialControlFilters {
  accountType?: FinancialControlAccountType | 'All';
  source?: FinancialActivitySource | 'All';
  search?: string;
}

const ACCOUNTS_KEY = 'itred_pos_financial_control_accounts';
const ACTIVITIES_KEY = 'itred_pos_financial_control_activities';
const now = () => new Date().toISOString();

function readList<T>(key: string, fallback: T[]): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(fallback));
      return fallback;
    }
    return JSON.parse(raw) as T[];
  } catch {
    return fallback;
  }
}

function saveList<T>(key: string, rows: T[]): T[] {
  try {
    localStorage.setItem(key, JSON.stringify(rows));
  } catch {
    // Local/mock service remains usable in memory if storage is unavailable.
  }
  return rows;
}

function accountTypeForDomain(domain: string): FinancialControlAccountType {
  const normalized = domain.toLowerCase();
  if (normalized.includes('cash')) return 'Cash';
  if (normalized.includes('bank')) return 'Bank';
  if (normalized.includes('ecocash') || normalized.includes('mobile')) return 'MobileMoney';
  if (normalized.includes('swipe') || normalized.includes('card')) return 'CardControl';
  if (normalized.includes('receivable') || normalized.includes('debtor')) return 'ReceivablesControl';
  if (normalized.includes('payable') || normalized.includes('creditor')) return 'PayablesControl';
  if (normalized.includes('inventory')) return 'InventoryControl';
  if (normalized.includes('cogs')) return 'COGSReserveControl';
  if (normalized.includes('vat')) return 'VATReserveControl';
  if (normalized.includes('deposit')) return 'CustomerDepositControl';
  if (normalized.includes('sales')) return 'RevenueControl';
  return 'SuspenseControl';
}

function balanceSeed(type: FinancialControlAccountType): { current: number; restricted: number; protected: boolean } {
  if (type === 'Cash') return { current: 2000, restricted: 350, protected: false };
  if (type === 'Bank') return { current: 6400, restricted: 1200, protected: false };
  if (type === 'MobileMoney') return { current: 980, restricted: 0, protected: false };
  if (type === 'CardControl') return { current: 1450, restricted: 0, protected: false };
  if (type === 'COGSReserveControl') return { current: 2200, restricted: 2200, protected: true };
  if (type === 'VATReserveControl') return { current: 710, restricted: 710, protected: true };
  if (type === 'CustomerDepositControl') return { current: 430, restricted: 430, protected: true };
  if (type === 'PayablesControl') return { current: -3100, restricted: 0, protected: false };
  if (type === 'ReceivablesControl') return { current: 3850, restricted: 0, protected: false };
  return { current: 0, restricted: 0, protected: false };
}

async function defaultAccounts(): Promise<FinancialControlAccount[]> {
  const coa = await getCOAAccounts();
  const mapped = coa
    .filter((account) => ['Cash', 'EcoCash', 'Swipe', 'Bank', 'Inventory', 'COGS', 'VAT', 'Receivables'].some((domain) => account.linkedDomain.includes(domain)))
    .map((account): FinancialControlAccount => {
      const type = accountTypeForDomain(account.linkedDomain);
      const seed = balanceSeed(type);
      return {
        accountId: `FCA-${account.id}`,
        coaAccountId: account.id,
        accountCode: account.accountCode,
        accountName: account.accountName,
        accountType: type,
        linkedDomain: account.linkedDomain,
        currency: 'USD',
        openingBalance: seed.current,
        currentBalance: seed.current,
        restrictedBalance: seed.restricted,
        availableBalance: seed.current - seed.restricted,
        active: account.status !== 'Inactive',
        protected: seed.protected,
        notes: 'Build Development local COA-driven financial control account.',
        createdAt: now(),
        updatedAt: now()
      };
    });

  const extras: FinancialControlAccount[] = [
    makeAccount('FCA-INNBUCKS', 'COA-INNBUCKS', '1040', 'Innbucks Control', 'MobileMoney', 'Innbucks', 320, 0, false),
    makeAccount('FCA-MAIN-BANK', 'COA-BANK-MAIN', '1050', 'Main Bank Placeholder', 'Bank', 'Bank', 4600, 900, false),
    makeAccount('FCA-PETTY', 'COA-PETTY', '1060', 'Petty Cash', 'Cash', 'Petty Cash', 180, 0, false),
    makeAccount('FCA-CUSTOMER-DEPOSITS', 'COA-CUST-DEP', '2200', 'Customer Deposits Control', 'CustomerDepositControl', 'Deposits', 430, 430, true),
    makeAccount('FCA-OWNER-FUNDS', 'COA-OWNER-FUNDS', '3000', 'Owner Funds Control', 'OwnerFundsControl', 'Owner Funds', 0, 0, false)
  ];
  return [...mapped, ...extras];
}

function makeAccount(accountId: string, coaAccountId: string, code: string, name: string, type: FinancialControlAccountType, domain: string, current: number, restricted: number, protectedFlag: boolean): FinancialControlAccount {
  return {
    accountId,
    coaAccountId,
    accountCode: code,
    accountName: name,
    accountType: type,
    linkedDomain: domain,
    currency: 'USD',
    openingBalance: current,
    currentBalance: current,
    restrictedBalance: restricted,
    availableBalance: current - restricted,
    active: true,
    protected: protectedFlag,
    notes: 'Build Development local financial control account.',
    createdAt: now(),
    updatedAt: now()
  };
}

function defaultActivities(accounts: FinancialControlAccount[]): FinancialActivityRecord[] {
  const cash = accounts.find((account) => account.accountType === 'Cash') || accounts[0];
  const bank = accounts.find((account) => account.accountType === 'Bank') || cash;
  const reserve = accounts.find((account) => account.accountType === 'COGSReserveControl') || cash;
  return [
    activity('FAR-001', 'SaleCashReceipt', 'SalesTerminal', 'RCT-0001', 'Cash sale received into drawer.', cash.accountId, cash.accountName, 125, 125, 0, 0, 45),
    activity('FAR-002', 'SaleMobileReceipt', 'SalesTerminal', 'RCT-0002', 'EcoCash sale awaiting settlement control.', bank.accountId, bank.accountName, 320, 0, 320, 0, 110),
    activity('FAR-003', 'CreditSaleReceivable', 'Debtors', 'CR-0004', 'Credit sale increases debtor outstanding, not cash.', 'FCA-AR', 'Customer Receivables Placeholder', 240, 0, 0, 0, 80),
    activity('FAR-004', 'SupplierBillCreated', 'Creditors', 'SUP-BILL-0007', 'Supplier bill creates future cash pressure.', 'FCA-AP', 'Supplier Payables Control', 690, 0, 0, 0, 0),
    activity('FAR-005', 'COGSRecoveredFromSale', 'COGSReserve', 'RCT-0001', 'COGS reserve recovered from sale and protected.', reserve.accountId, reserve.accountName, 72, 0, 0, 72, 0),
    activity('FAR-006', 'DrawerExpense', 'CashControl', 'DRE-004', 'Drawer expense reduces free usable cash.', cash.accountId, cash.accountName, 28, -28, 0, 0, -28),
    activity('FAR-007', 'VATCollected', 'OwnerDesk', 'VAT-2026-06-09', 'VAT reserve placeholder from taxable sales.', 'FCA-VAT', 'VAT Reserve Control', 64, 0, 0, 0, 0)
  ];
}

function activity(id: string, type: FinancialActivityType, source: FinancialActivitySource, ref: string, description: string, accountId: string, accountName: string, amount: number, cashImpact: number, bankImpact: number, reserveImpact: number, profitImpact: number): FinancialActivityRecord {
  return {
    activityId: id,
    activityNumber: id.replace('FAR', 'FIN'),
    activityDate: '2026-06-09',
    type,
    source,
    sourceReferenceId: ref,
    sourceReferenceNumber: ref,
    description,
    debitAccountId: accountId,
    debitAccountName: accountName,
    amount,
    currency: 'USD',
    cashImpact,
    bankImpact,
    reserveImpact,
    profitImpact,
    restrictedCashImpact: reserveImpact,
    status: 'Preview',
    notes: 'Financial Control preview only. Not final posted accounts.',
    createdAt: now()
  };
}

export async function getFinancialControlAccounts(filters: FinancialControlFilters = {}): Promise<FinancialControlAccount[]> {
  const fallback = await defaultAccounts();
  return readList<FinancialControlAccount>(ACCOUNTS_KEY, fallback).filter((account) =>
    (!filters.accountType || filters.accountType === 'All' || account.accountType === filters.accountType) &&
    (!filters.search || `${account.accountCode} ${account.accountName} ${account.linkedDomain} ${account.accountType}`.toLowerCase().includes(filters.search.toLowerCase()))
  );
}

export async function getFinancialControlAccount(accountId: string): Promise<FinancialControlAccount | null> {
  return (await getFinancialControlAccounts()).find((account) => account.accountId === accountId) || null;
}

export async function createFinancialControlAccount(payload: Partial<FinancialControlAccount>): Promise<FinancialControlAccount[]> {
  const rows = await getFinancialControlAccounts();
  const current = payload.currentBalance || 0;
  const restricted = payload.restrictedBalance || 0;
  const next: FinancialControlAccount = {
    accountId: `FCA-${Date.now()}`,
    coaAccountId: payload.coaAccountId || 'COA-MANUAL',
    accountCode: payload.accountCode || '0000',
    accountName: payload.accountName || 'Manual Financial Control Placeholder',
    accountType: payload.accountType || 'SuspenseControl',
    linkedDomain: payload.linkedDomain || 'ManualPlaceholder',
    currency: payload.currency || 'USD',
    openingBalance: payload.openingBalance || current,
    currentBalance: current,
    restrictedBalance: restricted,
    availableBalance: current - restricted,
    active: payload.active ?? true,
    protected: payload.protected ?? false,
    notes: payload.notes || 'Created locally for build development.',
    createdAt: now(),
    updatedAt: now()
  };
  return saveList(ACCOUNTS_KEY, [next, ...rows]);
}

export async function updateFinancialControlAccount(accountId: string, patch: Partial<FinancialControlAccount>): Promise<FinancialControlAccount[]> {
  const rows = (await getFinancialControlAccounts()).map((account) => {
    if (account.accountId !== accountId) return account;
    const next = { ...account, ...patch, updatedAt: now() };
    return { ...next, availableBalance: next.currentBalance - next.restrictedBalance };
  });
  return saveList(ACCOUNTS_KEY, rows);
}

export async function deactivateFinancialControlAccount(accountId: string, reason: string, _staffId = 'Admin User'): Promise<FinancialControlAccount[]> {
  return updateFinancialControlAccount(accountId, { active: false, notes: reason });
}

export async function mapCOAToFinancialControlAccount(coaAccountId: string, mappingPayload: Partial<FinancialControlAccount>): Promise<FinancialControlAccount[]> {
  return createFinancialControlAccount({ ...mappingPayload, coaAccountId });
}

export async function getFinancialActivityRecords(filters: FinancialControlFilters = {}): Promise<FinancialActivityRecord[]> {
  const accounts = await getFinancialControlAccounts();
  return readList<FinancialActivityRecord>(ACTIVITIES_KEY, defaultActivities(accounts)).filter((row) =>
    (!filters.source || filters.source === 'All' || row.source === filters.source) &&
    (!filters.search || `${row.activityNumber} ${row.type} ${row.source} ${row.description} ${row.sourceReferenceNumber}`.toLowerCase().includes(filters.search.toLowerCase()))
  );
}

export async function createFinancialActivityRecord(payload: Partial<FinancialActivityRecord>): Promise<FinancialActivityRecord[]> {
  const rows = await getFinancialActivityRecords();
  const next: FinancialActivityRecord = {
    activityId: `FAR-${Date.now()}`,
    activityNumber: `FIN-${Date.now()}`,
    activityDate: payload.activityDate || new Date().toISOString().slice(0, 10),
    type: payload.type || 'Adjustment',
    source: payload.source || 'ManualPlaceholder',
    sourceReferenceId: payload.sourceReferenceId || 'MANUAL',
    sourceReferenceNumber: payload.sourceReferenceNumber || 'MANUAL',
    description: payload.description || 'Manual financial control placeholder.',
    amount: payload.amount || 0,
    currency: payload.currency || 'USD',
    cashImpact: payload.cashImpact || 0,
    bankImpact: payload.bankImpact || 0,
    reserveImpact: payload.reserveImpact || 0,
    profitImpact: payload.profitImpact || 0,
    restrictedCashImpact: payload.restrictedCashImpact || 0,
    status: payload.status || 'Preview',
    notes: payload.notes || 'Local preview only.',
    createdAt: now()
  };
  return saveList(ACTIVITIES_KEY, [next, ...rows]);
}

export const generateFinancialActivitiesFromSales = () => getFinancialActivityRecords({ source: 'SalesTerminal' });
export const generateFinancialActivitiesFromDebtors = () => getFinancialActivityRecords({ source: 'Debtors' });
export const generateFinancialActivitiesFromCreditors = () => getFinancialActivityRecords({ source: 'Creditors' });
export const generateFinancialActivitiesFromCashControl = () => getFinancialActivityRecords({ source: 'CashControl' });
export const generateFinancialActivitiesFromCOGSReserve = () => getFinancialActivityRecords({ source: 'COGSReserve' });
export const generateFinancialActivitiesFromInventory = () => getFinancialActivityRecords({ source: 'Inventory' });
export async function rebuildFinancialActivityPreview(): Promise<FinancialActivityRecord[]> {
  const rows = defaultActivities(await getFinancialControlAccounts());
  return saveList(ACTIVITIES_KEY, rows);
}

export async function getFinancialPositionSummary(): Promise<FinancialPositionSummary> {
  const accounts = await getFinancialControlAccounts();
  const activities = await getFinancialActivityRecords();
  const totalCashOnHand = sumAccounts(accounts, 'Cash');
  const totalBankBalancePlaceholder = sumAccounts(accounts, 'Bank');
  const totalMobileMoneyPlaceholder = sumAccounts(accounts, 'MobileMoney');
  const totalCardControlPlaceholder = sumAccounts(accounts, 'CardControl');
  const grossCashPosition = totalCashOnHand + totalBankBalancePlaceholder + totalMobileMoneyPlaceholder + totalCardControlPlaceholder;
  const lessCOGSReserve = sumAccounts(accounts, 'COGSReserveControl', 'restricted');
  const lessVATReserve = sumAccounts(accounts, 'VATReserveControl', 'restricted');
  const lessCustomerDeposits = sumAccounts(accounts, 'CustomerDepositControl', 'restricted');
  const lessCommittedSupplierPayments = 860;
  const freeUsableCash = grossCashPosition - lessCOGSReserve - lessVATReserve - lessCustomerDeposits - lessCommittedSupplierPayments;
  const debtorsOutstanding = sumAccounts(accounts, 'ReceivablesControl') || 3850;
  const creditorsOutstanding = Math.abs(sumAccounts(accounts, 'PayablesControl')) || 3100;
  const purchaseCommitments = 1250;
  const reserveShortfall = Math.max(0, 3000 - lessCOGSReserve);
  return {
    totalCashOnHand,
    totalBankBalancePlaceholder,
    totalMobileMoneyPlaceholder,
    totalCardControlPlaceholder,
    grossCashPosition,
    lessCOGSReserve,
    lessVATReserve,
    lessCustomerDeposits,
    lessCommittedSupplierPayments,
    freeUsableCash,
    debtorsOutstanding,
    creditorsOutstanding,
    purchaseCommitments,
    reserveShortfall,
    netControlPosition: freeUsableCash + debtorsOutstanding - creditorsOutstanding - purchaseCommitments - reserveShortfall + activities.reduce((total, row) => total + row.profitImpact, 0),
    generatedAt: now()
  };
}

function sumAccounts(accounts: FinancialControlAccount[], type: FinancialControlAccountType, field: 'current' | 'restricted' = 'current'): number {
  return accounts.filter((account) => account.accountType === type).reduce((total, account) => total + (field === 'restricted' ? account.restrictedBalance : account.currentBalance), 0);
}

export const calculateRestrictedCash = async () => {
  const summary = await getFinancialPositionSummary();
  return summary.lessCOGSReserve + summary.lessVATReserve + summary.lessCustomerDeposits;
};
export const calculateFreeUsableCash = async () => (await getFinancialPositionSummary()).freeUsableCash;
export const calculateNetControlPosition = async () => (await getFinancialPositionSummary()).netControlPosition;
export async function validateFinancialActivityMappings(): Promise<{ missing: number; warnings: string[] }> {
  const rows = await getFinancialActivityRecords();
  const missing = rows.filter((row) => !row.debitAccountId && !row.creditAccountId).length;
  return { missing, warnings: missing ? ['MISSING_COA_MAPPING', 'FINANCIAL_ACTIVITY_UNMAPPED'] : [] };
}

export async function getMoneyInSummary(filters: FinancialControlFilters = {}) {
  return (await getFinancialActivityRecords(filters)).filter((row) => row.cashImpact > 0 || row.bankImpact > 0 || row.type.includes('Receipt'));
}

export async function getMoneyOutSummary(filters: FinancialControlFilters = {}) {
  return (await getFinancialActivityRecords(filters)).filter((row) => row.cashImpact < 0 || row.type.includes('Payment') || row.type.includes('Expense') || row.type.includes('Refund'));
}

export const getFinancialActivityLedger = getFinancialActivityRecords;

export async function getProtectedFundsSummary() {
  const accounts = await getFinancialControlAccounts();
  return accounts.filter((account) => account.protected || account.restrictedBalance > 0);
}
