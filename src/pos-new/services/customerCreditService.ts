import { createBIAdviceFromTrigger } from './biAdviceService';
import { createOperationalApproval } from './approvalService';
import { getCustomerById, getCustomerPurchaseHistory } from './customerService';
import { mockCustomers } from '../mock/mockPosData';
import type {
  CustomerAgeingAnalysis,
  CustomerAgeingIntervalConfig,
  CustomerBehaviourAnalytics,
  CustomerBuyingPreferenceProfile,
  CustomerCreditActivityEvent,
  CustomerCreditProfile,
  CustomerCreditStatus,
  CustomerCreditWorthinessScore,
  CustomerDebtPayment,
  CustomerDebtRecord,
  CustomerRecord,
  CreditSaleStatus,
  DebtAgeingBucket,
  PaymentMode,
  RiskLevel,
  Role
} from '../types';

const PROFILE_KEY = 'itred_pos_customer_credit_profiles_v1';
const DEBT_KEY = 'itred_pos_customer_debts_v1';
const PAYMENT_KEY = 'itred_pos_customer_debt_payments_v1';
const CONFIG_KEY = 'itred_pos_customer_ageing_configs_v1';
const EVENT_KEY = 'itred_pos_customer_credit_events_v1';

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
  cashierStaffId: string;
  paymentTermsDays?: number;
  notes?: string;
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
  const overdueBalance = (await getCustomerDebtByCustomer(customerId)).filter((debt) => debt.overdueDays > 0).reduce((sum, debt) => sum + debt.outstandingAmount, 0);
  const status = normalizeCreditStatus(profile.creditStatus);
  const newBalance = balance + saleTotal;
  const reasonList: string[] = [];
  let decision: CreditDecision['decision'] = 'Allowed';
  if (!customerId || customerId === 'CUST-WALKIN') {
    decision = 'Blocked';
    reasonList.push('Walk-in customer cannot buy on credit.');
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
  const status: CreditSaleStatus = payload.paidAmount > 0 ? 'PartiallyPaid' : 'Open';
  const debt: CustomerDebtRecord = {
    debtId: makeId('DEBT'),
    customerId: payload.customerId,
    customerName: payload.customerName,
    receiptId: payload.receiptId,
    receiptNumber: payload.receiptNumber,
    saleId: payload.saleId,
    saleDate: payload.saleDate,
    dueDate,
    originalAmount: payload.creditAmount,
    paidAmount: 0,
    outstandingAmount: payload.creditAmount,
    overdueDays,
    ageingBucket: assignAgeingBucket(overdueDays, config),
    status,
    branchId: payload.branchId,
    branchName: payload.branchName,
    terminalId: payload.terminalId,
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
  logCreditEvent({ customerId: payload.customerId, eventType: 'CUSTOMER_DEBT_CREATED', user: payload.cashierStaffId, notes: `${money(debt.outstandingAmount)} debt created from ${payload.receiptNumber}.`, relatedRecord: debt.debtId });
  await createCustomerCreditBIAdvice('CREDIT_SALE_CREATED', payload.customerName, `Credit sale ${payload.receiptNumber} created with ${money(debt.outstandingAmount)} outstanding.`, 'Medium');
  return debt;
}

export async function getCustomerDebtRecords(filters: { customerId?: string; status?: CreditSaleStatus | 'All'; ageingBucket?: DebtAgeingBucket | 'All' } = {}): Promise<CustomerDebtRecord[]> {
  const config = getDefaultAgeingIntervalConfig();
  const rows = readList<CustomerDebtRecord>(DEBT_KEY, seededDebtRows()).map((debt) => {
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

export async function createCustomerCreditApprovalRequest(input: {
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
    requiredPermission: 'approvals.approve'
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

export function getCustomerDebtPayments(filters: { customerId?: string; debtId?: string } = {}): CustomerDebtPayment[] {
  return readList<CustomerDebtPayment>(PAYMENT_KEY).filter((payment) =>
    (!filters.customerId || payment.customerId === filters.customerId) &&
    (!filters.debtId || payment.debtId === filters.debtId)
  );
}
