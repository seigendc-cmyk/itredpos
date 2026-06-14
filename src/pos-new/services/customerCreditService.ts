import { createBIAdviceFromTrigger } from './biAdviceService';
import { createOperationalApproval } from './approvalService';
import { getCustomerById, getCustomerPurchaseHistory } from './customerService';
import { mockCustomers } from '../mock/mockPosData';
import type {
  CustomerAgeingAnalysis,
  CustomerAgeingIntervalConfig,
  CustomerBehaviourAnalytics,
  CollectionDiaryItem,
  CollectionDiaryItemStatus,
  CollectionDiaryItemType,
  CustomerCreditApplication,
  CustomerCreditBlockRecord,
  CustomerCreditControlStatus,
  CustomerBuyingPreferenceProfile,
  CustomerCreditActivityEvent,
  CustomerCreditProfile,
  CustomerCreditStatus,
  CustomerCreditWorthinessScore,
  CustomerDebtPayment,
  CustomerDebtRecord,
  CustomerRecord,
  CreditSaleStatus,
  DebtDisputeRecord,
  DebtDisputeStatus,
  DebtAgeingBucket,
  PaymentMode,
  PromiseToPayMethod,
  PromiseToPayRecord,
  PromiseToPayStatus,
  RiskLevel,
  Role,
  StatementAcknowledgementRecord,
  StatementAcknowledgementStatus
} from '../types';

const PROFILE_KEY = 'itred_pos_customer_credit_profiles_v1';
const DEBT_KEY = 'itred_pos_customer_debts_v1';
const PAYMENT_KEY = 'itred_pos_customer_debt_payments_v1';
const CONFIG_KEY = 'itred_pos_customer_ageing_configs_v1';
const EVENT_KEY = 'itred_pos_customer_credit_events_v1';
const POLICY_KEY = 'itred_pos_customer_credit_policy_v1';
const TASK_KEY = 'itred_pos_customer_credit_tasks_v1';
const CREDIT_APPLICATION_KEY = 'itred_pos_customer_credit_applications_v1';
const PROMISE_KEY = 'itred_pos_customer_promises_to_pay_v1';
const CREDIT_BLOCK_KEY = 'itred_pos_customer_credit_blocks_v1';
const STATEMENT_ACK_KEY = 'itred_pos_customer_statement_acknowledgements_v1';
const DEBT_DISPUTE_KEY = 'itred_pos_customer_debt_disputes_v1';
const COLLECTION_DIARY_KEY = 'itred_pos_customer_collection_diary_v1';

export interface CreditDecision {
  decision: 'Allowed' | 'Requires Approval' | 'Blocked';
  reasonList: string[];
  profile: CustomerCreditProfile;
  saleTotal: number;
  newBalance: number;
  dueDate: string;
  worthiness: CustomerCreditWorthinessScore;
}

export interface CreditSaleDebtPayload {
  customerId: string;
  customerName: string;
  receiptId: string;
  receiptNumber: string;
  saleId: string;
  saleDate: string;
  saleTotal: number;
  paidAmount: number;
  creditAmount: number;
  branchId: string;
  branchName: string;
  terminalId: string;
  shiftId?: string;
  cashierStaffId: string;
  paymentTermsDays?: number;
  notes?: string;
}

export interface CustomerCreditPolicySettings {
  defaultPaymentTermsDays: number;
  allowPartialCreditPayments: boolean;
  allowCreditSaleToOverdueCustomer: boolean;
  allowCreditSaleAboveLimit: boolean;
  requireApprovalAboveLimit: boolean;
  requireApprovalIfOverdue: boolean;
  defaultCreditLimit: number;
  severeOverdueBlockDays: number;
  reminderScheduleDays: string;
  activeAgeingIntervalConfigId: string;
}

export interface DebtorsControlFilters {
  search?: string;
  customerId?: string;
  branch?: string;
  cashier?: string;
  ageingBucket?: DebtAgeingBucket | 'All';
  creditStatus?: CustomerCreditStatus | 'All';
  debtStatus?: CreditSaleStatus | 'All';
  dateFrom?: string;
  dateTo?: string;
  dueFrom?: string;
  dueTo?: string;
  minOutstanding?: number;
  maxOutstanding?: number;
}

export interface DebtorsControlRow extends CustomerDebtRecord {
  customerCode: string;
  phone: string;
  whatsapp: string;
  creditStatus: CustomerCreditStatus;
  cashierName: string;
  lastReminder?: string;
}

export interface DebtorsControlSummary {
  totalOutstanding: number;
  currentDebt: number;
  dueToday: number;
  overdue1: number;
  overdue2: number;
  overdue3: number;
  overdue4: number;
  severeOverdue: number;
  watchlistCustomers: number;
  blockedCreditCustomers: number;
  paymentsReceivedToday: number;
  writeOffRequests: number;
  rows: DebtorsControlRow[];
}

export interface CustomerDebtLedgerRow {
  id: string;
  date: string;
  type: string;
  reference: string;
  debit: number;
  credit: number;
  balance: number;
  staff: string;
  notes: string;
}

export interface CustomerStatementPayload {
  customer: CustomerRecord | null;
  profile: CustomerCreditProfile;
  debts: CustomerDebtRecord[];
  payments: CustomerDebtPayment[];
  ledger: CustomerDebtLedgerRow[];
  periodFrom: string;
  periodTo: string;
  openingBalance: number;
  creditSales: number;
  paymentsTotal: number;
  returnsTotal: number;
  creditNotesTotal: number;
  adjustmentsTotal: number;
  closingBalance: number;
  overdueBalance: number;
  ageing: CustomerAgeingAnalysis;
  generatedBy: string;
  generatedAt: string;
  statementType: 'Summary' | 'Detailed';
}

export interface CustomerCreditTask {
  taskId: string;
  title: string;
  customer: string;
  debtReference: string;
  dueDate: string;
  assignedTo: string;
  source: 'Debtors Control Desk' | 'Debtors Collection Diary';
  status: 'Open';
  createdAt: string;
}

function canUseLocalStorage(): boolean {
  return typeof localStorage !== 'undefined';
}

function readList<T>(key: string, fallback: T[] = []): T[] {
  if (!canUseLocalStorage()) return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(fallback));
      return fallback;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as T[] : fallback;
  } catch {
    return fallback;
  }
}

function saveList<T>(key: string, value: T[]): T[] {
  if (!canUseLocalStorage()) return value;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local credit persistence is best effort in development builds.
  }
  return value;
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

function normalizeCreditStatus(status?: CustomerCreditStatus): CustomerCreditStatus {
  if (status === 'Credit Allowed') return 'Approved';
  if (status === 'Credit Suspended') return 'Suspended';
  if (status === 'Credit Review Required') return 'Review';
  if (status === 'Cash Only' || status === 'Not Applicable') return 'Cash Only';
  return status || 'Cash Only';
}

function statusAllowsCredit(status: CustomerCreditStatus): boolean {
  return status === 'Approved' || status === 'Credit Allowed';
}

function addDays(dateValue: string, days: number): string {
  const date = new Date(dateValue);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function daysBetween(start: string, end: string): number {
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  if (Number.isNaN(startTime) || Number.isNaN(endTime)) return 0;
  return Math.floor((endTime - startTime) / 86400000);
}

function defaultConfig(): CustomerAgeingIntervalConfig {
  return {
    configId: 'AGE-DEFAULT',
    name: 'Default POS Ageing',
    currentMaxDays: 0,
    bucket1From: 1,
    bucket1To: 30,
    bucket2From: 31,
    bucket2To: 60,
    bucket3From: 61,
    bucket3To: 90,
    bucket4From: 91,
    bucket4To: 120,
    severeFrom: 121,
    active: true
  };
}

function defaultPolicy(): CustomerCreditPolicySettings {
  return {
    defaultPaymentTermsDays: 30,
    allowPartialCreditPayments: true,
    allowCreditSaleToOverdueCustomer: false,
    allowCreditSaleAboveLimit: false,
    requireApprovalAboveLimit: true,
    requireApprovalIfOverdue: true,
    defaultCreditLimit: 250,
    severeOverdueBlockDays: 120,
    reminderScheduleDays: '0,7,30,60,90',
    activeAgeingIntervalConfigId: 'AGE-DEFAULT'
  };
}

function readValue<T>(key: string, fallback: T): T {
  if (!canUseLocalStorage()) return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(fallback));
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveValue<T>(key: string, value: T): T {
  if (!canUseLocalStorage()) return value;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local persistence is best-effort.
  }
  return value;
}

function seededDebtRows(): CustomerDebtRecord[] {
  const config = defaultConfig();
  return mockCustomers
    .filter((customer) => customer.customerId !== 'CUST-WALKIN' && (customer.currentBalance || 0) > 0)
    .map((customer, index) => {
      const saleDate = new Date(Date.now() - (index + 1) * 18 * 86400000).toISOString();
      const dueDate = addDays(saleDate, 30);
      const overdueDays = calculateOverdueDays(dueDate);
      const outstandingAmount = customer.currentBalance || 0;
      return {
        debtId: `DEBT-SEED-${customer.customerId}`,
        customerId: customer.customerId,
        customerName: customer.customerName,
        receiptId: `REC-SEED-${index + 1}`,
        receiptNumber: `RCT-CREDIT-${String(index + 1).padStart(3, '0')}`,
        saleId: `SALE-SEED-${index + 1}`,
        saleDate,
        dueDate,
        originalAmount: outstandingAmount,
        paidAmount: 0,
        outstandingAmount,
        overdueDays,
        ageingBucket: assignAgeingBucket(overdueDays, config),
        status: overdueDays > 0 ? 'Overdue' : 'Open',
        branchId: 'BR-HARARE',
        branchName: 'Harare Main',
        terminalId: 'POS-01',
        cashierStaffId: customer.createdByStaffId,
        paymentTermsDays: 30,
        notes: 'Seeded local/mock debt from existing customer balance.',
        createdAt: saleDate,
        updatedAt: saleDate
      } satisfies CustomerDebtRecord;
    });
}

function fallbackProfile(customer: CustomerRecord | null, customerId: string): CustomerCreditProfile {
  const creditLimit = customer?.creditLimit || 0;
  const currentBalance = customer?.currentBalance || 0;
  const overdueBalance = normalizeCreditStatus(customer?.creditStatus) === 'Suspended' ? currentBalance : 0;
  return {
    customerId,
    creditStatus: normalizeCreditStatus(customer?.creditStatus),
    creditLimit,
    availableCredit: Math.max(0, creditLimit - currentBalance),
    currentBalance,
    overdueBalance,
    paymentTermsDays: 30,
    defaultAgeingIntervalConfigId: 'AGE-DEFAULT',
    creditNotes: customer?.notes || '',
    approvedBy: customer?.approvedByStaffId,
    approvedAt: customer?.createdAt,
    blockedReason: normalizeCreditStatus(customer?.creditStatus) === 'Suspended' ? 'Customer credit is suspended.' : undefined
  };
}

function upsertProfile(profile: CustomerCreditProfile): CustomerCreditProfile {
  const profiles = readList<CustomerCreditProfile>(PROFILE_KEY);
  const next = [profile, ...profiles.filter((row) => row.customerId !== profile.customerId)];
  saveList(PROFILE_KEY, next);
  return profile;
}

function logCreditEvent(input: Omit<CustomerCreditActivityEvent, 'id' | 'dateTime'>): CustomerCreditActivityEvent {
  const event: CustomerCreditActivityEvent = {
    ...input,
    id: makeId('CCE'),
    dateTime: nowIso()
  };
  saveList(EVENT_KEY, [event, ...readList<CustomerCreditActivityEvent>(EVENT_KEY)].slice(0, 160));
  return event;
}

export async function getCustomerCreditProfile(customerId: string): Promise<CustomerCreditProfile> {
  const stored = readList<CustomerCreditProfile>(PROFILE_KEY).find((profile) => profile.customerId === customerId);
  if (stored) return stored;
  const customer = await getCustomerById(customerId);
  return upsertProfile(fallbackProfile(customer, customerId));
}

export async function createOrUpdateCustomerCreditProfile(
  customerId: string,
  payload: Partial<CustomerCreditProfile>
): Promise<CustomerCreditProfile> {
  const current = await getCustomerCreditProfile(customerId);
  const next: CustomerCreditProfile = {
    ...current,
    ...payload,
    customerId,
    availableCredit: Math.max(0, (payload.creditLimit ?? current.creditLimit) - (payload.currentBalance ?? current.currentBalance))
  };
  const saved = upsertProfile(next);
  logCreditEvent({ customerId, eventType: 'CREDIT_PROFILE_UPDATED', user: payload.approvedBy || 'Local User', notes: 'Credit profile updated locally.' });
  return saved;
}

export function calculateOverdueDays(dueDate: string, asOfDate = nowIso()): number {
  return Math.max(0, daysBetween(dueDate, asOfDate));
}

export function assignAgeingBucket(overdueDays: number, config: CustomerAgeingIntervalConfig): DebtAgeingBucket {
  if (overdueDays <= 0) return 'Current';
  if (overdueDays <= config.currentMaxDays) return 'DueSoon';
  if (overdueDays >= config.bucket1From && overdueDays <= config.bucket1To) return 'Overdue1';
  if (overdueDays >= config.bucket2From && overdueDays <= config.bucket2To) return 'Overdue2';
  if (overdueDays >= config.bucket3From && overdueDays <= config.bucket3To) return 'Overdue3';
  if (overdueDays >= config.bucket4From && overdueDays <= config.bucket4To) return 'Overdue4';
  return 'SevereOverdue';
}

export function getDefaultAgeingIntervalConfig(): CustomerAgeingIntervalConfig {
  const configs = readList<CustomerAgeingIntervalConfig>(CONFIG_KEY, [defaultConfig()]);
  return configs.find((config) => config.active) || configs[0] || defaultConfig();
}

function validateAgeingConfig(config: CustomerAgeingIntervalConfig): string[] {
  const errors: string[] = [];
  if (!config.name.trim()) errors.push('Config name is required.');
  if (config.bucket1From >= config.bucket1To) errors.push('Bucket 1 start must be less than end.');
  if (config.bucket2From >= config.bucket2To) errors.push('Bucket 2 start must be less than end.');
  if (config.bucket3From >= config.bucket3To) errors.push('Bucket 3 start must be less than end.');
  if (config.bucket4From >= config.bucket4To) errors.push('Bucket 4 start must be less than end.');
  if (config.bucket2From <= config.bucket1To || config.bucket3From <= config.bucket2To || config.bucket4From <= config.bucket3To) errors.push('Ageing intervals must not overlap.');
  if (config.severeFrom <= config.bucket4To) errors.push('Severe from must be greater than bucket 4.');
  return errors;
}

export function saveAgeingIntervalConfig(config: CustomerAgeingIntervalConfig): CustomerAgeingIntervalConfig {
  const errors = validateAgeingConfig(config);
  if (errors.length) throw new Error(errors.join(' '));
  const current = readList<CustomerAgeingIntervalConfig>(CONFIG_KEY, [defaultConfig()]);
  const nextConfig = { ...config, configId: config.configId || makeId('AGE') };
  const next = [
    nextConfig,
    ...current
      .filter((row) => row.configId !== nextConfig.configId)
      .map((row) => nextConfig.active ? { ...row, active: false } : row)
  ];
  if (!next.some((row) => row.active)) next[0].active = true;
  saveList(CONFIG_KEY, next);
  return nextConfig;
}

export function getAgeingIntervalConfigs(): CustomerAgeingIntervalConfig[] {
  return readList<CustomerAgeingIntervalConfig>(CONFIG_KEY, [defaultConfig()]);
}

export async function calculateCustomerOutstandingBalance(customerId: string): Promise<number> {
  return getCustomerDebtByCustomer(customerId).then((rows) => rows.reduce((sum, debt) => sum + debt.outstandingAmount, 0));
}

export async function calculateCustomerAvailableCredit(customerId: string): Promise<number> {
  const profile = await getCustomerCreditProfile(customerId);
  const balance = await calculateCustomerOutstandingBalance(customerId);
  return Math.max(0, profile.creditLimit - balance);
}

export async function calculateCustomerCreditWorthiness(customerId: string): Promise<CustomerCreditWorthinessScore> {
  const [profile, debts, history] = await Promise.all([
    getCustomerCreditProfile(customerId),
    getCustomerDebtByCustomer(customerId),
    getCustomerPurchaseHistory(customerId)
  ]);
  const totalPurchases = history.reduce((sum, row) => sum + row.total, 0);
  const totalCreditSales = debts.reduce((sum, debt) => sum + debt.originalAmount, 0);
  const totalPaid = debts.reduce((sum, debt) => sum + debt.paidAmount, 0);
  const outstandingBalance = debts.reduce((sum, debt) => sum + debt.outstandingAmount, 0);
  const overdueBalance = debts.filter((debt) => debt.overdueDays > 0).reduce((sum, debt) => sum + debt.outstandingAmount, 0);
  const latePaymentCount = debts.filter((debt) => debt.overdueDays > 0 || debt.status === 'Overdue').length;
  const averageDaysToPay = debts.length ? Math.round(debts.reduce((sum, debt) => sum + Math.max(0, daysBetween(debt.saleDate, debt.updatedAt)), 0) / debts.length) : 0;
  let score = 82;
  score -= latePaymentCount * 12;
  score -= overdueBalance > 0 ? 18 : 0;
  score -= outstandingBalance > profile.creditLimit ? 20 : 0;
  score += history.length >= 3 ? 8 : 0;
  score = Math.max(0, Math.min(100, score));
  const grade = normalizeCreditStatus(profile.creditStatus) === 'Suspended' || normalizeCreditStatus(profile.creditStatus) === 'Blocked'
    ? 'Blocked'
    : score >= 85 ? 'Excellent' : score >= 70 ? 'Good' : score >= 55 ? 'Fair' : score >= 40 ? 'Watch' : 'Risky';
  const reasonList = [
    `${debts.length} credit debt record(s)`,
    `${latePaymentCount} late payment warning(s)`,
    `${money(overdueBalance)} overdue`
  ];
  return {
    customerId,
    grade,
    score,
    reasonList,
    totalPurchases,
    totalCreditSales,
    totalPaid,
    outstandingBalance,
    overdueBalance,
    averageDaysToPay,
    latePaymentCount,
    returnCount: history.filter((row) => row.returnStatus !== 'None').length,
    discountDependenceScore: history.length > 2 ? 32 : 12,
    lastActivityDate: history[0]?.date || debts[0]?.updatedAt || nowIso(),
    recommendedCreditLimit: grade === 'Excellent' ? Math.max(profile.creditLimit, totalPurchases * 0.35, 500) : grade === 'Risky' || grade === 'Blocked' ? Math.max(0, profile.creditLimit * 0.5) : profile.creditLimit,
    recommendedAction: grade === 'Excellent' ? 'Increase Limit' : grade === 'Good' ? 'Keep Limit' : grade === 'Fair' ? 'Manager Review' : grade === 'Watch' ? 'Put on Watchlist' : grade === 'Blocked' ? 'Suspend Credit' : 'Require Deposit'
  };
}

export async function canCustomerBuyOnCredit(customerId: string, saleTotal: number): Promise<CreditDecision> {
  const profile = await getCustomerCreditProfile(customerId);
  const worthiness = await calculateCustomerCreditWorthiness(customerId);
  const balance = await calculateCustomerOutstandingBalance(customerId);
  const customerDebts = await getCustomerDebtByCustomer(customerId);
  const overdueBalance = customerDebts.filter((debt) => debt.overdueDays > 0).reduce((sum, debt) => sum + debt.outstandingAmount, 0);
  const maxOverdueDays = Math.max(0, ...customerDebts.map((debt) => debt.overdueDays));
  const status = normalizeCreditStatus(profile.creditStatus);
  const newBalance = balance + saleTotal;
  const reasonList: string[] = [];
  let decision: CreditDecision['decision'] = 'Allowed';
  if (!customerId) {
    decision = 'Blocked';
    reasonList.push('Select a customer before choosing Credit / Account.');
  } else if (customerId === 'CUST-WALKIN') {
    decision = 'Blocked';
    reasonList.push('Select a registered customer before selling on credit.');
  }
  if (!statusAllowsCredit(status)) {
    decision = status === 'Review' || status === 'Watchlist' || status === 'OverLimit' || status === 'Overdue' ? 'Requires Approval' : 'Blocked';
    reasonList.push(`Credit status is ${profile.creditStatus}.`);
  }
  if (overdueBalance > 0) {
    decision = decision === 'Blocked' ? 'Blocked' : 'Requires Approval';
    reasonList.push(`${money(overdueBalance)} is overdue.`);
  }
  if (newBalance > profile.creditLimit) {
    decision = decision === 'Blocked' ? 'Blocked' : 'Requires Approval';
    reasonList.push(`New balance ${money(newBalance)} exceeds limit ${money(profile.creditLimit)}.`);
  }
  if (worthiness.grade === 'Risky' || worthiness.grade === 'Blocked') {
    decision = decision === 'Blocked' ? 'Blocked' : 'Requires Approval';
    reasonList.push(`Credit worthiness is ${worthiness.grade}.`);
  }
  if (reasonList.length === 0) reasonList.push('Customer is within credit rules.');
  if (saleTotal > 0 && customerId && customerId !== 'CUST-WALKIN') {
    if (overdueBalance > 0) {
      await createCustomerCreditBIAdvice('OVERDUE_CUSTOMER_TRYING_TO_BUY', profile.customerName, `${profile.customerName} has ${money(overdueBalance)} overdue before a new account sale.`, 'High');
    }
    if (maxOverdueDays > 120) {
      await createCustomerCreditBIAdvice('SEVERE_OVERDUE_CUSTOMER', profile.customerName, `${profile.customerName} has debt ${maxOverdueDays} day(s) overdue.`, 'Critical');
    }
    if (newBalance > profile.creditLimit) {
      await createCustomerCreditBIAdvice('CREDIT_LIMIT_EXCEEDED', profile.customerName, `${profile.customerName} would exceed the credit limit by ${money(newBalance - profile.creditLimit)}.`, 'High');
    }
    if (worthiness.latePaymentCount >= 2) {
      await createCustomerCreditBIAdvice('REPEAT_LATE_PAYER', profile.customerName, `${profile.customerName} has ${worthiness.latePaymentCount} late credit payments.`, 'Medium');
    }
    if ((worthiness.grade === 'Excellent' || worthiness.grade === 'Good') && worthiness.recommendedAction === 'Increase Limit') {
      await createCustomerCreditBIAdvice('GOOD_PAYER_LIMIT_REVIEW', profile.customerName, `${profile.customerName} qualifies for a credit limit review.`, 'Low');
    }
  }
  return {
    decision,
    reasonList,
    profile: { ...profile, currentBalance: balance, overdueBalance, availableCredit: Math.max(0, profile.creditLimit - balance) },
    saleTotal,
    newBalance,
    dueDate: addDays(nowIso(), profile.paymentTermsDays),
    worthiness
  };
}

export async function createCustomerDebtFromCreditSale(payload: CreditSaleDebtPayload): Promise<CustomerDebtRecord> {
  const config = getDefaultAgeingIntervalConfig();
  const dueDate = addDays(payload.saleDate, payload.paymentTermsDays || 30);
  const overdueDays = calculateOverdueDays(dueDate);
  const initialSalePaidAmount = Math.max(0, payload.paidAmount || 0);
  const saleTotal = Math.max(payload.saleTotal || 0, payload.creditAmount + initialSalePaidAmount);
  const status: CreditSaleStatus = payload.creditAmount <= 0 ? 'Paid' : initialSalePaidAmount > 0 ? 'PartiallyPaid' : 'Open';
  const debt: CustomerDebtRecord = {
    debtId: makeId('DEBT'),
    customerId: payload.customerId,
    customerName: payload.customerName,
    receiptId: payload.receiptId,
    receiptNumber: payload.receiptNumber,
    saleId: payload.saleId,
    saleDate: payload.saleDate,
    saleTotal,
    initialSalePaidAmount,
    creditAmountCreated: payload.creditAmount,
    dueDate,
    originalAmount: saleTotal,
    paidAmount: initialSalePaidAmount,
    outstandingAmount: payload.creditAmount,
    overdueDays,
    ageingBucket: assignAgeingBucket(overdueDays, config),
    status,
    branchId: payload.branchId,
    branchName: payload.branchName,
    terminalId: payload.terminalId,
    shiftId: payload.shiftId,
    cashierStaffId: payload.cashierStaffId,
    paymentTermsDays: payload.paymentTermsDays || 30,
    notes: payload.notes || 'Credit sale debt created locally.',
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  saveList(DEBT_KEY, [debt, ...readList<CustomerDebtRecord>(DEBT_KEY)]);
  const profile = await getCustomerCreditProfile(payload.customerId);
  await createOrUpdateCustomerCreditProfile(payload.customerId, {
    currentBalance: profile.currentBalance + debt.outstandingAmount,
    availableCredit: Math.max(0, profile.creditLimit - profile.currentBalance - debt.outstandingAmount),
    lastCreditSaleDate: payload.saleDate
  });
  logCreditEvent({ customerId: payload.customerId, eventType: 'CUSTOMER_DEBT_CREATED', user: payload.cashierStaffId, notes: `${money(debt.outstandingAmount)} debt created from ${payload.receiptNumber}. ${money(initialSalePaidAmount)} was paid during sale.`, relatedRecord: debt.debtId });
  await createCustomerCreditBIAdvice('CREDIT_SALE_CREATED', payload.customerName, `Credit sale ${payload.receiptNumber} created with ${money(debt.outstandingAmount)} outstanding.`, 'Medium');
  return debt;
}

export async function getCustomerDebtRecords(filters: { customerId?: string; status?: CreditSaleStatus | 'All'; ageingBucket?: DebtAgeingBucket | 'All' } = {}): Promise<CustomerDebtRecord[]> {
  const config = getDefaultAgeingIntervalConfig();
  const storedDebts = readList<CustomerDebtRecord>(DEBT_KEY);
  const seedRows = seededDebtRows().filter((seed) => !storedDebts.some((debt) => debt.debtId === seed.debtId || debt.receiptNumber === seed.receiptNumber));
  const rows = [...storedDebts, ...seedRows].map((debt) => {
    const overdueDays = calculateOverdueDays(debt.dueDate);
    const nextStatus: CreditSaleStatus = debt.outstandingAmount <= 0 ? 'Paid' : overdueDays > 0 && debt.status === 'Open' ? 'Overdue' : debt.status;
    return { ...debt, overdueDays, ageingBucket: assignAgeingBucket(overdueDays, config), status: nextStatus };
  });
  return rows.filter((debt) =>
    (!filters.customerId || debt.customerId === filters.customerId) &&
    (!filters.status || filters.status === 'All' || debt.status === filters.status) &&
    (!filters.ageingBucket || filters.ageingBucket === 'All' || debt.ageingBucket === filters.ageingBucket)
  );
}

function matchesAnyOrderSearch(row: DebtorsControlRow, query?: string): boolean {
  const words = (query || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = [
    row.customerName,
    row.customerCode,
    row.receiptNumber,
    row.debtId,
    row.phone,
    row.whatsapp,
    row.branchName,
    row.cashierName,
    row.creditStatus,
    row.status,
    row.ageingBucket,
    row.notes
  ].join(' ').toLowerCase();
  return words.every((word) => haystack.includes(word));
}

export async function getDebtorsControlRows(filters: DebtorsControlFilters = {}): Promise<DebtorsControlRow[]> {
  const [debts, customerRows] = await Promise.all([getCustomerDebtRecords(), Promise.resolve(mockCustomers)]);
  const customers = new Map(customerRows.map((customer) => [customer.customerId, customer]));
  return debts.map((debt) => {
    const customer = customers.get(debt.customerId);
    return {
      ...debt,
      customerCode: customer?.customerCode || debt.customerId,
      phone: customer?.phone || '',
      whatsapp: customer?.whatsapp || '',
      creditStatus: normalizeCreditStatus(customer?.creditStatus),
      cashierName: debt.cashierStaffId,
      lastReminder: readList<CustomerCreditActivityEvent>(EVENT_KEY).find((event) => event.customerId === debt.customerId && event.eventType.includes('REMINDER'))?.dateTime
    };
  }).filter((row) =>
    matchesAnyOrderSearch(row, filters.search) &&
    (!filters.customerId || row.customerId === filters.customerId) &&
    (!filters.branch || filters.branch === 'All' || row.branchName === filters.branch) &&
    (!filters.cashier || filters.cashier === 'All' || row.cashierStaffId === filters.cashier || row.cashierName === filters.cashier) &&
    (!filters.ageingBucket || filters.ageingBucket === 'All' || row.ageingBucket === filters.ageingBucket) &&
    (!filters.creditStatus || filters.creditStatus === 'All' || row.creditStatus === filters.creditStatus) &&
    (!filters.debtStatus || filters.debtStatus === 'All' || row.status === filters.debtStatus) &&
    (!filters.dateFrom || row.saleDate >= `${filters.dateFrom}T00:00:00`) &&
    (!filters.dateTo || row.saleDate <= `${filters.dateTo}T23:59:59`) &&
    (!filters.dueFrom || row.dueDate >= `${filters.dueFrom}T00:00:00`) &&
    (!filters.dueTo || row.dueDate <= `${filters.dueTo}T23:59:59`) &&
    (filters.minOutstanding === undefined || row.outstandingAmount >= filters.minOutstanding) &&
    (filters.maxOutstanding === undefined || row.outstandingAmount <= filters.maxOutstanding)
  );
}

export async function calculateDebtorsControlSummary(filters: DebtorsControlFilters = {}): Promise<DebtorsControlSummary> {
  const rows = await getDebtorsControlRows(filters);
  const today = nowIso().slice(0, 10);
  const paymentsToday = readList<CustomerDebtPayment>(PAYMENT_KEY).filter((payment) => payment.receivedAt.slice(0, 10) === today);
  return {
    totalOutstanding: rows.reduce((sum, row) => sum + row.outstandingAmount, 0),
    currentDebt: rows.filter((row) => row.ageingBucket === 'Current').reduce((sum, row) => sum + row.outstandingAmount, 0),
    dueToday: rows.filter((row) => row.dueDate.slice(0, 10) === today).reduce((sum, row) => sum + row.outstandingAmount, 0),
    overdue1: rows.filter((row) => row.ageingBucket === 'Overdue1').reduce((sum, row) => sum + row.outstandingAmount, 0),
    overdue2: rows.filter((row) => row.ageingBucket === 'Overdue2').reduce((sum, row) => sum + row.outstandingAmount, 0),
    overdue3: rows.filter((row) => row.ageingBucket === 'Overdue3').reduce((sum, row) => sum + row.outstandingAmount, 0),
    overdue4: rows.filter((row) => row.ageingBucket === 'Overdue4').reduce((sum, row) => sum + row.outstandingAmount, 0),
    severeOverdue: rows.filter((row) => row.ageingBucket === 'SevereOverdue').reduce((sum, row) => sum + row.outstandingAmount, 0),
    watchlistCustomers: new Set(rows.filter((row) => row.creditStatus === 'Watchlist').map((row) => row.customerId)).size,
    blockedCreditCustomers: new Set(rows.filter((row) => row.creditStatus === 'Blocked' || row.creditStatus === 'Suspended').map((row) => row.customerId)).size,
    paymentsReceivedToday: paymentsToday.reduce((sum, payment) => sum + payment.amount, 0),
    writeOffRequests: readList<CustomerCreditActivityEvent>(EVENT_KEY).filter((event) => event.eventType === 'WRITE_OFF_REQUESTED').length,
    rows
  };
}

export async function getCustomerDebtByCustomer(customerId: string): Promise<CustomerDebtRecord[]> {
  return getCustomerDebtRecords({ customerId });
}

export async function recordCustomerDebtPayment(payload: Omit<CustomerDebtPayment, 'paymentId' | 'receivedAt'>): Promise<CustomerDebtRecord | null> {
  if (payload.amount <= 0) throw new Error('Payment amount must be above zero.');
  const debts = await getCustomerDebtRecords();
  const target = debts.find((debt) => debt.debtId === payload.debtId);
  if (!target) return null;
  if (payload.amount > target.outstandingAmount) throw new Error('Payment cannot exceed outstanding amount.');
  const paidAmount = target.paidAmount + payload.amount;
  const outstandingAmount = Math.max(0, target.outstandingAmount - payload.amount);
  const updated: CustomerDebtRecord = {
    ...target,
    paidAmount,
    outstandingAmount,
    status: outstandingAmount === 0 ? 'Paid' : 'PartiallyPaid',
    updatedAt: nowIso()
  };
  saveList(DEBT_KEY, debts.map((debt) => debt.debtId === updated.debtId ? updated : debt));
  saveList(PAYMENT_KEY, [{
    ...payload,
    paymentId: makeId('DEBT-PAY'),
    receivedAt: nowIso()
  }, ...readList<CustomerDebtPayment>(PAYMENT_KEY)]);
  const balance = await calculateCustomerOutstandingBalance(payload.customerId);
  const profile = await getCustomerCreditProfile(payload.customerId);
  await createOrUpdateCustomerCreditProfile(payload.customerId, {
    currentBalance: balance,
    availableCredit: Math.max(0, profile.creditLimit - balance),
    lastPaymentDate: nowIso()
  });
  logCreditEvent({ customerId: payload.customerId, eventType: 'CUSTOMER_DEBT_PAYMENT_RECORDED', user: payload.receivedByStaffId, notes: `${money(payload.amount)} recorded against ${target.receiptNumber}.`, relatedRecord: payload.debtId });
  logCreditEvent({ customerId: payload.customerId, eventType: outstandingAmount === 0 ? 'CUSTOMER_DEBT_FULLY_PAID' : 'CUSTOMER_CREDIT_BALANCE_UPDATED', user: payload.receivedByStaffId, notes: `Balance updated to ${money(outstandingAmount)}.`, relatedRecord: payload.debtId });
  return updated;
}

export async function calculateCustomerAgeingAnalysis(filters: { customerId?: string } = {}): Promise<CustomerAgeingAnalysis> {
  const [debts, profiles] = await Promise.all([getCustomerDebtRecords(filters), Promise.resolve(readList<CustomerCreditProfile>(PROFILE_KEY))]);
  const outstandingDebts = debts.filter((debt) => debt.outstandingAmount > 0);
  const sumBucket = (bucket: DebtAgeingBucket) => outstandingDebts.filter((debt) => debt.ageingBucket === bucket).reduce((sum, debt) => sum + debt.outstandingAmount, 0);
  return {
    totalCreditCustomers: new Set(outstandingDebts.map((debt) => debt.customerId)).size,
    totalOutstanding: outstandingDebts.reduce((sum, debt) => sum + debt.outstandingAmount, 0),
    current: sumBucket('Current'),
    dueSoon: sumBucket('DueSoon'),
    overdue1: sumBucket('Overdue1'),
    overdue2: sumBucket('Overdue2'),
    overdue3: sumBucket('Overdue3'),
    overdue4: sumBucket('Overdue4'),
    severeOverdue: sumBucket('SevereOverdue'),
    overdueCustomers: new Set(outstandingDebts.filter((debt) => debt.overdueDays > 0).map((debt) => debt.customerId)).size,
    blockedCustomers: profiles.filter((profile) => normalizeCreditStatus(profile.creditStatus) === 'Blocked' || normalizeCreditStatus(profile.creditStatus) === 'Suspended').length,
    debts
  };
}

export async function calculateCustomerBuyingPreferences(customerId: string): Promise<CustomerBuyingPreferenceProfile> {
  const history = await getCustomerPurchaseHistory(customerId);
  const totals = history.map((row) => row.total);
  return {
    customerId,
    topCategories: ['Engine Service', 'Brake Parts', 'Accessories'],
    topProducts: history.slice(0, 3).map((row) => row.receiptNo).concat(['Brake Pads', 'Engine Oil']).slice(0, 3),
    preferredBrands: ['Toyota', 'Bosch', 'SCI Industrial'],
    averageBasketValue: totals.length ? totals.reduce((sum, value) => sum + value, 0) / totals.length : 0,
    purchaseFrequency: history.length >= 4 ? 'Weekly' : history.length >= 2 ? 'Monthly' : 'New / Low activity',
    preferredPaymentMethod: history[0]?.paymentMethod || 'Cash',
    preferredBranch: history[0]?.branch || 'Harare Main',
    preferredSalesPeriod: 'Morning counter sales',
    priceSensitivity: history.length > 2 ? 'Medium' : 'Low',
    lastPurchaseDate: history[0]?.date || ''
  };
}

export async function calculateCustomerBehaviourAnalytics(customerId: string): Promise<CustomerBehaviourAnalytics> {
  const [history, worthiness] = await Promise.all([getCustomerPurchaseHistory(customerId), calculateCustomerCreditWorthiness(customerId)]);
  const totalLifetimeValue = history.reduce((sum, row) => sum + row.total, 0);
  const averageBasketValue = history.length ? totalLifetimeValue / history.length : 0;
  const daysSinceLastPurchase = history[0]?.date ? Math.max(0, daysBetween(history[0].date, nowIso())) : 999;
  const segment = worthiness.latePaymentCount > 1 ? 'SlowPayer' : worthiness.overdueBalance > 0 ? 'CreditRisk' : totalLifetimeValue > 1000 ? 'HighValue' : history.length > 3 ? 'Loyal' : history.length > 1 ? 'Repeat' : daysSinceLastPurchase > 90 ? 'Dormant' : 'New';
  return {
    customerId,
    segment,
    repeatPurchaseCount: Math.max(0, history.length - 1),
    daysSinceLastPurchase,
    totalLifetimeValue,
    averageBasketValue,
    returnRate: history.length ? history.filter((row) => row.returnStatus !== 'None').length / history.length : 0,
    discountUsageRate: history.length > 2 ? 0.25 : 0.05,
    creditUsageRate: worthiness.totalCreditSales > 0 && totalLifetimeValue > 0 ? worthiness.totalCreditSales / Math.max(totalLifetimeValue, worthiness.totalCreditSales) : 0,
    paymentReliabilityScore: worthiness.score,
    notes: segment === 'SlowPayer' || segment === 'CreditRisk' ? 'Review before further account sales.' : 'No immediate customer risk flag.'
  };
}

export async function getCustomerCreditActivityEvents(filters: { customerId?: string } = {}): Promise<CustomerCreditActivityEvent[]> {
  return readList<CustomerCreditActivityEvent>(EVENT_KEY).filter((event) => !filters.customerId || event.customerId === filters.customerId);
}

export async function getCustomerDebtLedger(customerId: string): Promise<CustomerDebtLedgerRow[]> {
  const [debts, payments] = await Promise.all([
    getCustomerDebtByCustomer(customerId),
    Promise.resolve(getCustomerDebtPayments({ customerId }))
  ]);
  const entries = [
    ...debts.map((debt) => ({
      id: `${debt.debtId}-sale`,
      date: debt.saleDate,
      type: 'Credit sale created',
      reference: debt.receiptNumber,
      debit: debt.originalAmount,
      credit: 0,
      staff: debt.cashierStaffId,
      notes: debt.notes
    })),
    ...debts
      .filter((debt) => (debt.initialSalePaidAmount || 0) > 0)
      .map((debt) => ({
        id: `${debt.debtId}-sale-payment`,
        date: debt.saleDate,
        type: 'Sale payment received',
        reference: debt.receiptNumber,
        debit: 0,
        credit: debt.initialSalePaidAmount || 0,
        staff: debt.cashierStaffId,
        notes: 'Amount paid during mixed payment sale.'
      })),
    ...payments.map((payment) => ({
      id: `${payment.paymentId}-payment`,
      date: payment.receivedAt,
      type: 'Partial payment received',
      reference: payment.reference || payment.debtId,
      debit: 0,
      credit: payment.amount,
      staff: payment.receivedByStaffId,
      notes: payment.notes || payment.paymentMethod
    })),
    ...readList<CustomerCreditActivityEvent>(EVENT_KEY)
      .filter((event) => event.customerId === customerId && (event.eventType.includes('REMINDER') || event.eventType.includes('WRITE_OFF') || event.eventType.includes('APPROVAL')))
      .map((event) => ({
        id: event.id,
        date: event.dateTime,
        type: event.eventType.includes('REMINDER') ? 'Reminder sent' : event.eventType.includes('WRITE_OFF') ? 'Write-off request' : 'Approval action',
        reference: event.relatedRecord || event.id,
        debit: 0,
        credit: 0,
        staff: event.user,
        notes: event.notes
      }))
  ].sort((left, right) => left.date.localeCompare(right.date));
  let balance = 0;
  return entries.map((entry) => {
    balance += entry.debit - entry.credit;
    return { ...entry, balance };
  });
}

export function getCreditPolicySettings(): CustomerCreditPolicySettings {
  return readValue<CustomerCreditPolicySettings>(POLICY_KEY, defaultPolicy());
}

export function saveCreditPolicySettings(policy: CustomerCreditPolicySettings): CustomerCreditPolicySettings {
  return saveValue(POLICY_KEY, policy);
}

export function resetCreditPolicySettings(): CustomerCreditPolicySettings {
  return saveValue(POLICY_KEY, defaultPolicy());
}

export async function generateCustomerStatement(input: {
  customerId: string;
  dateFrom: string;
  dateTo: string;
  includePaidDebts: boolean;
  includeOpenDebts: boolean;
  includePayments: boolean;
  statementType: 'Summary' | 'Detailed';
  generatedBy: string;
}): Promise<CustomerStatementPayload> {
  const [customer, profile, debts, payments, ledger, ageing] = await Promise.all([
    getCustomerById(input.customerId),
    getCustomerCreditProfile(input.customerId),
    getCustomerDebtByCustomer(input.customerId),
    Promise.resolve(getCustomerDebtPayments({ customerId: input.customerId })),
    getCustomerDebtLedger(input.customerId),
    calculateCustomerAgeingAnalysis({ customerId: input.customerId })
  ]);
  const periodStart = `${input.dateFrom || '1900-01-01'}T00:00:00`;
  const periodEnd = `${input.dateTo || '2999-12-31'}T23:59:59`;
  const filteredDebts = debts.filter((debt) =>
    debt.saleDate >= periodStart && debt.saleDate <= periodEnd &&
    ((input.includePaidDebts && debt.status === 'Paid') || (input.includeOpenDebts && debt.status !== 'Paid'))
  );
  const filteredPayments = input.includePayments ? payments.filter((payment) => payment.receivedAt >= periodStart && payment.receivedAt <= periodEnd) : [];
  const creditSales = filteredDebts.reduce((sum, debt) => sum + debt.originalAmount, 0);
  const initialSalePayments = filteredDebts.reduce((sum, debt) => sum + (debt.initialSalePaidAmount || 0), 0);
  const paymentsTotal = filteredPayments.reduce((sum, payment) => sum + payment.amount, 0) + initialSalePayments;
  return {
    customer,
    profile,
    debts: filteredDebts,
    payments: filteredPayments,
    ledger: ledger.filter((row) => row.date >= periodStart && row.date <= periodEnd),
    periodFrom: input.dateFrom,
    periodTo: input.dateTo,
    openingBalance: 0,
    creditSales,
    paymentsTotal,
    returnsTotal: 0,
    creditNotesTotal: 0,
    adjustmentsTotal: 0,
    closingBalance: filteredDebts.reduce((sum, debt) => sum + debt.outstandingAmount, 0),
    overdueBalance: filteredDebts.filter((debt) => debt.overdueDays > 0).reduce((sum, debt) => sum + debt.outstandingAmount, 0),
    ageing,
    generatedBy: input.generatedBy,
    generatedAt: nowIso(),
    statementType: input.statementType
  };
}

export function prepareDebtReminderWhatsAppMessage(
  customer: Pick<CustomerRecord, 'customerName'> | { customerName: string },
  debts: CustomerDebtRecord[],
  reminderType: 'Due Today' | 'Overdue 7 Days' | 'Overdue 30 Days' | 'Final Reminder' | 'Statement Summary' | 'Thank You Payment Received'
): string {
  const total = debts.reduce((sum, debt) => sum + debt.outstandingAmount, 0);
  const references = debts.map((debt) => debt.receiptNumber).join(', ');
  const dueDate = debts[0]?.dueDate ? new Date(debts[0].dueDate).toLocaleDateString() : 'your statement due date';
  const overdueDays = Math.max(0, ...debts.map((debt) => debt.overdueDays));
  return [
    'Hello, this is Demo Vendor.',
    `${customer.customerName}, ${reminderType.toLowerCase()} reminder for your account.`,
    `Outstanding amount: ${money(total)}.`,
    overdueDays > 0 ? `Oldest balance is ${overdueDays} day(s) overdue.` : `Due date: ${dueDate}.`,
    references ? `Reference(s): ${references}.` : '',
    'Please arrange payment or contact us if already settled.',
    'Thank you.'
  ].filter(Boolean).join(' ');
}

export async function logDebtReminder(customerId: string, staffId: string, relatedRecord: string): Promise<void> {
  logCreditEvent({ customerId, eventType: 'CUSTOMER_DEBT_REMINDER_PREPARED', user: staffId, notes: 'Debt reminder WhatsApp link prepared locally.', relatedRecord });
  logCreditEvent({ customerId, eventType: 'CUSTOMER_DEBT_REMINDER_SENT_VIA_WHATSAPP_LINK', user: staffId, notes: 'wa.me reminder link opened locally.', relatedRecord });
}

export async function requestDebtWriteOff(debt: CustomerDebtRecord, requestedBy: string, requestedByRole: Role): Promise<void> {
  await createCustomerCreditApprovalRequest({
    approvalType: 'DEBT_WRITE_OFF',
    customerName: debt.customerName,
    requestedBy,
    requestedByRole,
    branchId: debt.branchId,
    branch: debt.branchName,
    relatedRecord: debt.receiptNumber,
    amountOrValue: money(debt.outstandingAmount),
    risk: 'High',
    reason: 'Debt write-off request.',
    context: `${debt.receiptNumber} write-off requested locally from Debtors Control Desk.`
  });
  logCreditEvent({ customerId: debt.customerId, eventType: 'WRITE_OFF_REQUESTED', user: requestedBy, notes: `Write-off requested for ${money(debt.outstandingAmount)}.`, relatedRecord: debt.debtId });
  await createCustomerCreditBIAdvice('WRITE_OFF_REQUESTED', debt.customerName, `${debt.receiptNumber} write-off requested for ${money(debt.outstandingAmount)}.`, 'High');
}

export function createDebtorsControlTask(input: Omit<CustomerCreditTask, 'taskId' | 'source' | 'status' | 'createdAt'>): CustomerCreditTask {
  const task: CustomerCreditTask = {
    ...input,
    taskId: makeId('DEBT-TASK'),
    source: 'Debtors Control Desk',
    status: 'Open',
    createdAt: nowIso()
  };
  saveList(TASK_KEY, [task, ...readList<CustomerCreditTask>(TASK_KEY)].slice(0, 100));
  return task;
}

export async function createCustomerCreditApprovalRequest(input: {
  approvalType?: 'CREDIT_SALE_OVERRIDE' | 'CREDIT_LIMIT_CHANGE' | 'DEBT_WRITE_OFF' | 'OVERDUE_CUSTOMER_OVERRIDE' | 'SUSPENDED_CUSTOMER_OVERRIDE';
  customerName: string;
  requestedBy: string;
  requestedByRole: Role;
  branchId: string;
  branch: string;
  relatedRecord: string;
  amountOrValue: string;
  risk: RiskLevel;
  reason: string;
  context: string;
}): Promise<void> {
  await createOperationalApproval({
    vendorId: 'SCI-LOG-ZW',
    branchId: input.branchId,
    branch: input.branch,
    category: 'Customer Approval',
    requestedBy: input.requestedBy,
    requestedByRole: input.requestedByRole,
    relatedRecord: input.relatedRecord,
    amountOrValue: input.amountOrValue,
    risk: input.risk,
    reason: input.reason,
    context: input.context,
    approvalType: input.approvalType,
    requiredPermission: 'approvals.credit.approve'
  });
}

export async function createCustomerCreditBIAdvice(eventType: string, customerName: string, description: string, severity: RiskLevel = 'Medium'): Promise<void> {
  await createBIAdviceFromTrigger({
    id: makeId('CREDIT-BI'),
    eventType,
    domain: 'Customer Credit',
    severity,
    description,
    recommendedAction: 'Manager Review',
    productName: customerName,
    notes: description
  });
}

export function getCustomerDebtPayments(filters: { customerId?: string; debtId?: string; shiftId?: string } = {}): CustomerDebtPayment[] {
  return readList<CustomerDebtPayment>(PAYMENT_KEY).filter((payment) =>
    (!filters.customerId || payment.customerId === filters.customerId) &&
    (!filters.debtId || payment.debtId === filters.debtId) &&
    (!filters.shiftId || payment.shiftId === filters.shiftId)
  );
}
