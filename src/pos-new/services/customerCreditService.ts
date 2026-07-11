import { createBIAdviceFromTrigger } from './biAdviceService';
import { createOperationalApproval } from './approvalService';
import { createAccountingPostingPlaceholder } from './accountingService';
import { getCustomerById, getCustomerPurchaseHistory, realRecordsExist } from './customerService';
import { assertCanonicalCustomerContext } from './customerContextService';
import {
  calculateCustomerLedgerBalance,
  getCustomerAccountEntries,
  recordCustomerAccountEntry
} from './customerAccountService';
import { getCustomerCreditPolicy, creditSaleRequiresApproval } from './customerCreditPolicyService';
import { recordCustomerPayment } from './customerPaymentService';
import { mockCustomers } from '../mock/mockPosData';
import { getActiveVendorId, readVendorScopedJson, readVendorScopedList, shouldUseMockSeedData, writeVendorScopedJson, writeVendorScopedList } from '../utils/vendorDataMode';

/*
 * Placeholder / Mock Data Sources Audited (Phase 2):
 * - seededDebtRows: Generates mock debt records for active customers with outstanding balance from mockCustomers (excluding WALK-IN).
 * - seedCreditApplications: Returns a single mock credit application for Brian Dube.
 * - seedPromises: Returns mock promises to pay for Apex Fleet and Brian Dube.
 * - seedCreditBlocks: Returns a mock credit block for Brian Dube.
 * - seedStatementAcknowledgements: Returns a mock statement acknowledgement for Apex Fleet.
 * - seedDebtDisputes: Returns a mock debt dispute for Brian Dube.
 * - seedCollectionDiary: Returns mock collection diary entries for Apex Fleet and Brian Dube.
 * - seedOpeningBalances: Returns a mock opening balance for Brian Dube.
 * - seedDeposits: Returns a mock deposit for Tapiwa Moyo.
 * - seedCreditNotes: Returns a mock credit note for Brian Dube.
 * - seedBulkCollectionBatches: Returns a sample bulk collection batch.
 * - seedPeriodLocks: Returns a sample locked period.
 */
import type {
  BulkCollectionActionType,
  BulkCollectionBatch,
  CustomerAgeingAnalysis,
  CustomerAgeingIntervalConfig,
  CustomerBehaviourAnalytics,
  CustomerCreditNote,
  CustomerCreditNoteStatus,
  CustomerDepositRecord,
  CustomerDepositSource,
  CustomerDepositStatus,
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
  DebtPaymentAllocation,
  DebtPaymentAllocationMethod,
  DebtorAdjustmentType,
  DebtDisputeRecord,
  DebtDisputeStatus,
  DebtAgeingBucket,
  DebtorOpeningBalance,
  DebtorOpeningBalanceStatus,
  DebtorPeriodAdjustment,
  DebtorPeriodLock,
  DebtorPeriodLockStatus,
  DebtorRiskHeatMapItem,
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
const OPENING_BALANCE_KEY = 'itred_pos_debtor_opening_balances_v1';
const PAYMENT_ALLOCATION_KEY = 'itred_pos_debt_payment_allocations_v1';
const CUSTOMER_DEPOSIT_KEY = 'itred_pos_customer_deposits_v1';
const CUSTOMER_CREDIT_NOTE_KEY = 'itred_pos_customer_credit_notes_v1';
const BULK_COLLECTION_KEY = 'itred_pos_bulk_collection_batches_v1';
const DEBTOR_PERIOD_LOCK_KEY = 'itred_pos_debtor_period_locks_v1';
const DEBTOR_PERIOD_ADJUSTMENT_KEY = 'itred_pos_debtor_period_adjustments_v1';

export const CUSTOMER_CREDIT_APPLICATIONS_COLLECTION = 'customer_credit_applications';

export interface CreditDecision {
  decision: 'Allowed' | 'Requires Approval' | 'Blocked';
  reasonList: string[];
  profile: CustomerCreditProfile;
  saleTotal: number;
  newBalance: number;
  dueDate: string;
  worthiness: CustomerCreditWorthinessScore;
  brokenPromisesCount?: number;
  lastPromiseStatus?: string;
  statementAcknowledgementStatus?: string;
  recommendedAction?: string;
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

function readList<T>(key: string, fallback: T[] = []): T[] {
  try {
    const parsed = readVendorScopedList<T>(key, fallback);
    if (realRecordsExist()) {
      const mockIds = [
        'CUST-TAPIWA', 'CUST-RUDO', 'CUST-FARAI', 'CUST-MEMORY',
        'CUST-BRIAN', 'CUST-APEX-FLEET', 'CUST-MUTSA-CLOSET',
        'CUST-PENDING-001', 'CUST-DUP-001'
      ];
      return parsed.filter((item: any) => {
        if (!item || typeof item !== 'object') return true;
        if (item.customerId && mockIds.includes(item.customerId)) return false;
        if (item.debtId && item.debtId.startsWith('DEBT-SEED-')) return false;
        if (item.receiptId && item.receiptId.startsWith('REC-SEED-')) return false;
        if (item.saleId && item.saleId.startsWith('SALE-SEED-')) return false;
        if (item.applicationId && item.applicationId.startsWith('CAPP-BUILD-DEV-')) return false;
        if (item.promiseId && item.promiseId.startsWith('PTP-BUILD-DEV-')) return false;
        if (item.blockId && item.blockId.startsWith('CBLOCK-BUILD-DEV-')) return false;
        if (item.acknowledgementId && item.acknowledgementId.startsWith('ST-ACK-BUILD-DEV-')) return false;
        if (item.disputeId && item.disputeId.startsWith('DDISP-BUILD-DEV-')) return false;
        if (item.diaryItemId && item.diaryItemId.startsWith('CDIARY-BUILD-DEV-')) return false;
        if (item.openingBalanceId && item.openingBalanceId.startsWith('OBAL-BUILD-DEV-')) return false;
        if (item.depositId && item.depositId.startsWith('DEP-BUILD-DEV-')) return false;
        if (item.creditNoteId && item.creditNoteId.startsWith('CN-BUILD-DEV-')) return false;
        if (item.batchId && item.batchId.startsWith('BCOLL-BUILD-DEV-')) return false;
        if (item.periodLockId && item.periodLockId.startsWith('DLOCK-BUILD-DEV-')) return false;
        return true;
      });
    }
    return parsed;
  } catch {
    return [];
  }
}

function saveList<T>(key: string, value: T[]): T[] {
  return writeVendorScopedList(key, value);
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
  return readVendorScopedJson<T>(key, fallback);
}

function saveValue<T>(key: string, value: T): T {
  return writeVendorScopedJson(key, value);
}

function seededDebtRows(): CustomerDebtRecord[] {
  if (!shouldUseMockSeedData()) return [];
  if (realRecordsExist()) return [];
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
        branchId: 'main-branch',
        branchName: 'Main Branch',
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

function todayDate(): string {
  return nowIso().slice(0, 10);
}

function isSameDate(left?: string, right = todayDate()): boolean {
  return Boolean(left && left.slice(0, 10) === right);
}

function creditControlStatusForProfile(profile: CustomerCreditProfile): CustomerCreditControlStatus {
  if (profile.creditStatus === 'Blocked') return 'CreditBlocked';
  if (profile.creditStatus === 'Suspended' || profile.creditStatus === 'Credit Suspended') return 'Suspended';
  if (profile.creditStatus === 'Cash Only' || profile.creditStatus === 'NotAllowed' || profile.creditStatus === 'Not Applicable') return 'CashOnly';
  if (profile.creditStatus === 'Review' || profile.creditStatus === 'Credit Review Required' || profile.creditStatus === 'Watchlist') return 'UnderReview';
  if (profile.creditStatus === 'OverLimit' || profile.creditStatus === 'Overdue') return 'ManagerApprovalRequired';
  return 'CreditAllowed';
}

function priorityFromDebt(debt?: CustomerDebtRecord): RiskLevel {
  if (!debt) return 'Medium';
  if (debt.overdueDays >= 90 || debt.outstandingAmount >= 500) return 'High';
  if (debt.overdueDays > 0) return 'Medium';
  return 'Low';
}

function seedCreditApplications(): CustomerCreditApplication[] {
  if (realRecordsExist()) return [];
  return [{
    applicationId: 'CAPP-BUILD-DEV-001',
    customerId: 'CUST-BRIAN',
    customerName: 'Brian Dube',
    requestedCreditLimit: 700,
    approvedCreditLimit: 0,
    requestedPaymentTermsDays: 30,
    approvedPaymentTermsDays: 0,
    status: 'PendingReview',
    reasonForCreditRequest: 'Customer requested account trading.',
    supportingNotes: 'Credit application pending manager review.',
    contactPersonName: 'Brian Dube',
    contactPersonPhone: '+263771000004',
    reviewDate: todayDate(),
    createdBy: 'Manager',
    createdAt: nowIso(),
    updatedAt: nowIso()
  }];
}

function seedPromises(): PromiseToPayRecord[] {
  if (realRecordsExist()) return [];
  return [{
    promiseId: 'PTP-BUILD-DEV-001',
    customerId: 'CUST-APEX-FLEET',
    customerName: 'Apex Fleet Services',
    debtReference: 'RCP-CR-1004',
    promisedAmount: 180,
    promisedDate: todayDate(),
    promiseMethod: 'PhoneCall',
    status: 'Pending',
    capturedBy: 'Manager',
    capturedAt: nowIso(),
    followUpNote: 'Confirm payment before close of business.',
    assignedTo: 'Manager',
    updatedAt: nowIso()
  }, {
    promiseId: 'PTP-BUILD-DEV-002',
    customerId: 'CUST-BRIAN',
    customerName: 'Brian Dube',
    debtReference: 'RCP-CR-1002',
    promisedAmount: 80,
    promisedDate: addDays(nowIso(), -2).slice(0, 10),
    promiseMethod: 'WhatsApp',
    status: 'Broken',
    capturedBy: 'Supervisor',
    capturedAt: addDays(nowIso(), -5),
    followUpNote: 'Payment promise missed.',
    assignedTo: 'Supervisor',
    brokenAt: nowIso(),
    brokenReason: 'No payment received by promise date.',
    updatedAt: nowIso()
  }];
}

function seedCreditBlocks(): CustomerCreditBlockRecord[] {
  if (realRecordsExist()) return [];
  return [{
    blockId: 'CBLOCK-BUILD-DEV-001',
    customerId: 'CUST-BRIAN',
    customerName: 'Brian Dube',
    previousStatus: 'Credit Review Required',
    newStatus: 'CreditBlocked',
    reason: 'Repeated overdue promises.',
    blockedBy: 'Manager',
    blockedAt: nowIso(),
    active: true
  }];
}

function seedStatementAcknowledgements(): StatementAcknowledgementRecord[] {
  if (realRecordsExist()) return [];
  return [{
    acknowledgementId: 'ST-ACK-BUILD-DEV-001',
    statementId: 'STATEMENT-BUILD-DEV-001',
    customerId: 'CUST-APEX-FLEET',
    customerName: 'Apex Fleet Services',
    statementPeriodFrom: addDays(nowIso(), -30).slice(0, 10),
    statementPeriodTo: todayDate(),
    sentVia: 'WhatsApp Placeholder',
    sentTo: '+263771000004',
    status: 'NoResponse',
    sentBy: 'Manager',
    sentAt: addDays(nowIso(), -4),
    notes: 'Awaiting statement acknowledgement.',
    updatedAt: nowIso()
  }];
}

function seedDebtDisputes(): DebtDisputeRecord[] {
  if (realRecordsExist()) return [];
  return [{
    disputeId: 'DDISP-BUILD-DEV-001',
    customerId: 'CUST-BRIAN',
    customerName: 'Brian Dube',
    debtId: 'DEBT-BUILD-DEV-002',
    debtReference: 'RCP-CR-1002',
    disputedAmount: 45,
    reason: 'Customer disputes delivery fee portion.',
    status: 'Open',
    openedBy: 'Manager',
    openedAt: nowIso(),
    assignedTo: 'Accountant'
  }];
}

function seedCollectionDiary(): CollectionDiaryItem[] {
  if (realRecordsExist()) return [];
  return [{
    diaryItemId: 'CDIARY-BUILD-DEV-001',
    customerId: 'CUST-APEX-FLEET',
    customerName: 'Apex Fleet Services',
    debtReference: 'RCP-CR-1004',
    type: 'PromiseDue',
    priority: 'High',
    dueDate: todayDate(),
    assignedTo: 'Manager',
    status: 'DueToday',
    notes: 'Promise-to-pay due today.',
    createdBy: 'Manager',
    createdAt: nowIso()
  }, {
    diaryItemId: 'CDIARY-BUILD-DEV-002',
    customerId: 'CUST-BRIAN',
    customerName: 'Brian Dube',
    debtReference: 'RCP-CR-1002',
    type: 'BrokenPromise',
    priority: 'High',
    dueDate: todayDate(),
    assignedTo: 'Supervisor',
    status: 'Overdue',
    notes: 'Broken promise follow-up.',
    createdBy: 'Supervisor',
    createdAt: nowIso()
  }];
}

function seedOpeningBalances(): DebtorOpeningBalance[] {
  if (realRecordsExist()) return [];
  return [{
    openingBalanceId: 'OBAL-BUILD-DEV-001',
    customerId: 'CUST-BRIAN',
    customerName: 'Brian Dube',
    openingReference: 'OB-BUILD-001',
    openingBalanceDate: addDays(nowIso(), -45).slice(0, 10),
    originalAmount: 220,
    paidAmount: 40,
    outstandingAmount: 180,
    dueDate: addDays(nowIso(), -15).slice(0, 10),
    ageingBucket: 'Overdue1',
    notes: 'Opening debtor balance.',
    status: 'Approved',
    importedBy: 'Manager',
    importedAt: nowIso(),
    approvedBy: 'Manager',
    approvedAt: nowIso()
  }];
}

function seedDeposits(): CustomerDepositRecord[] {
  if (realRecordsExist()) return [];
  return [{
    depositId: 'DEP-BUILD-DEV-001',
    depositNumber: 'DEP-000001',
    customerId: 'CUST-TAPIWA',
    customerName: 'Tapiwa Moyo',
    amountReceived: 120,
    amountApplied: 30,
    balance: 90,
    source: 'Cash',
    paymentReference: 'CASH-DEP-BUILD',
    receivedBy: 'Cashier',
    receivedAt: nowIso(),
    status: 'PartiallyApplied',
    notes: 'Customer deposit.',
    linkedDebtIds: []
  }];
}

function seedCreditNotes(): CustomerCreditNote[] {
  if (realRecordsExist()) return [];
  return [{
    creditNoteId: 'CN-BUILD-DEV-001',
    creditNoteNumber: 'CN-000001',
    customerId: 'CUST-BRIAN',
    customerName: 'Brian Dube',
    linkedDebtId: 'DEBT-BUILD-DEV-002',
    reason: 'Credit note pending approval.',
    originalAmount: 35,
    amountApplied: 0,
    balance: 35,
    status: 'PendingApproval',
    createdBy: 'Manager',
    createdAt: nowIso(),
    notes: 'Pending manager approval.'
  }];
}

function seedBulkCollectionBatches(): BulkCollectionBatch[] {
  if (realRecordsExist()) return [];
  return [{
    batchId: 'BCOLL-BUILD-DEV-001',
    batchNumber: 'BC-000001',
    actionType: 'GenerateOverdueReminders',
    filterSummary: 'Overdue account sample.',
    customerCount: 2,
    debtCount: 2,
    totalAmount: 360,
    status: 'Preview',
    generatedBy: 'Manager',
    generatedAt: nowIso(),
    notes: 'No WhatsApp API used; messages prepared only.'
  }];
}

function seedPeriodLocks(): DebtorPeriodLock[] {
  if (realRecordsExist()) return [];
  return [{
    periodLockId: 'DLOCK-BUILD-DEV-001',
    periodStart: addDays(nowIso(), -90).slice(0, 10),
    periodEnd: addDays(nowIso(), -31).slice(0, 10),
    status: 'Locked',
    lockedBy: 'Owner',
    lockedAt: nowIso(),
    notes: 'Locked debtor period.'
  }];
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
  const vendorId = getActiveVendorId();
  const ledgerEntries = getCustomerAccountEntries(vendorId, customerId);
  if (ledgerEntries.length > 0) return calculateCustomerLedgerBalance(vendorId, customerId);
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
  const [customer, profile] = await Promise.all([getCustomerById(customerId), getCustomerCreditProfile(customerId)]);
  const policy = getCustomerCreditPolicy();
  const worthiness = await calculateCustomerCreditWorthiness(customerId);
  const balance = await calculateCustomerOutstandingBalance(customerId);
  const customerDebts = await getCustomerDebtByCustomer(customerId);
  const overdueBalance = customerDebts.filter((debt) => debt.overdueDays > 0).reduce((sum, debt) => sum + debt.outstandingAmount, 0);
  const maxOverdueDays = Math.max(0, ...customerDebts.map((debt) => debt.overdueDays));
  const status = normalizeCreditStatus(profile.creditStatus);
  const newBalance = balance + saleTotal;
  const activeBlock = getCreditBlockHistory(customerId).find((block) => block.active);
  const controlStatus = activeBlock?.newStatus || creditControlStatusForProfile(profile);
  const brokenPromiseStats = getBrokenPromiseStats(customerId);
  const latestStatementAck = getStatementAcknowledgements({ customerId })[0];
  const reasonList: string[] = [];
  let decision: CreditDecision['decision'] = 'Allowed';
  if (!customerId) {
    decision = 'Blocked';
    reasonList.push('Select a customer before choosing Credit / Account.');
  } else if (customerId === 'CUST-WALKIN') {
    decision = 'Blocked';
    reasonList.push('Select a registered customer before selling on credit.');
  }
  if (!customer) {
    decision = 'Blocked';
    reasonList.push('Customer record was not found.');
  } else {
    if (customer.vendorId !== getActiveVendorId()) {
      decision = 'Blocked';
      reasonList.push('Customer belongs to another vendor.');
    }
    if (customer.status !== 'Active') {
      decision = 'Blocked';
      reasonList.push(customer.status === 'Suspended' ? 'Customer account suspended.' : 'Customer account is not active.');
    }
    const masterStatus = normalizeCreditStatus(customer.creditStatus);
    if (!statusAllowsCredit(masterStatus)) {
      decision = masterStatus === 'Review' ? 'Requires Approval' : 'Blocked';
      reasonList.push(masterStatus === 'Review' ? 'Credit application pending.' : 'Credit not enabled.');
    }
  }
  if (controlStatus === 'CreditBlocked' || controlStatus === 'Suspended' || controlStatus === 'CashOnly') {
    decision = 'Blocked';
    reasonList.push(controlStatus === 'CashOnly' ? 'Customer is cash only. Credit / Account payment is disabled.' : 'Customer credit is blocked. Cash sale only unless Manager approves override.');
  }
  if (controlStatus === 'DepositRequired') {
    decision = decision === 'Blocked' ? 'Blocked' : 'Requires Approval';
    reasonList.push('Deposit required before credit sale.');
  }
  if (brokenPromiseStats.brokenCount > 0) {
    decision = decision === 'Blocked' ? 'Blocked' : 'Requires Approval';
    reasonList.push(`${brokenPromiseStats.brokenCount} broken promise(s) recorded.`);
  }
  if (latestStatementAck && ['NoResponse', 'Disputed', 'ReconciliationRequested'].includes(latestStatementAck.status)) {
    decision = decision === 'Blocked' ? 'Blocked' : 'Requires Approval';
    reasonList.push(`Latest statement acknowledgement is ${latestStatementAck.status}.`);
  }
  if (!statusAllowsCredit(status)) {
    decision = status === 'Review' || status === 'Watchlist' || status === 'OverLimit' || status === 'Overdue' ? 'Requires Approval' : 'Blocked';
    reasonList.push(`Credit status is ${profile.creditStatus}.`);
  }
  if (overdueBalance > 0) {
    decision = policy.blockOnOverdue ? 'Blocked' : decision === 'Blocked' ? 'Blocked' : 'Requires Approval';
    reasonList.push(`${money(overdueBalance)} is overdue.`);
  }
  if (newBalance > profile.creditLimit) {
    decision = policy.blockOnLimitExceeded ? 'Blocked' : decision === 'Blocked' ? 'Blocked' : 'Requires Approval';
    reasonList.push(`Credit limit exceeded. New balance ${money(newBalance)} exceeds limit ${money(profile.creditLimit)}.`);
  }
  const policyDecision = creditSaleRequiresApproval({ saleTotal, currentBalance: balance, creditLimit: profile.creditLimit, overdueBalance }, policy);
  if (policyDecision.required && decision !== 'Blocked') {
    decision = 'Requires Approval';
    reasonList.push(...policyDecision.reasons.filter((reason) => !reasonList.includes(reason)));
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
    if (controlStatus === 'CreditBlocked') {
      await createCustomerCreditBIAdvice('BLOCKED_CUSTOMER_ATTEMPTED_CREDIT_SALE', profile.customerName, `${profile.customerName} attempted a credit sale while blocked.`, 'Critical');
      await createCustomerCreditApprovalRequest({ approvalType: 'BLOCKED_CUSTOMER_CREDIT_OVERRIDE', customerName: profile.customerName, requestedBy: 'Sales Terminal', requestedByRole: 'Manager', branchId: 'main-branch', branch: 'Main Branch', relatedRecord: customerId, amountOrValue: money(saleTotal), risk: 'Critical', reason: 'Blocked customer attempted credit sale.', context: 'Blocked customer override review.' });
    }
    if (brokenPromiseStats.brokenCount >= 2) {
      await createCustomerCreditBIAdvice('REPEATED_BROKEN_PROMISES', profile.customerName, `${profile.customerName} has repeated broken promises before new credit sale.`, 'High');
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
    worthiness,
    brokenPromisesCount: brokenPromiseStats.brokenCount,
    lastPromiseStatus: brokenPromiseStats.latestPromise?.status,
    statementAcknowledgementStatus: latestStatementAck?.status,
    recommendedAction: controlStatus === 'DepositRequired' ? 'Take deposit before credit balance.' : decision === 'Blocked' ? 'Cash sale only unless Manager approves override.' : worthiness.recommendedAction
  };
}

export async function createCustomerDebtFromCreditSale(payload: CreditSaleDebtPayload): Promise<CustomerDebtRecord> {
  const existing = readList<CustomerDebtRecord>(DEBT_KEY).find((debt) =>
    debt.saleId === payload.saleId || debt.receiptNumber === payload.receiptNumber
  );
  if (existing) return existing;
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
  const context = assertCanonicalCustomerContext({
    vendorId: getActiveVendorId(),
    branchId: payload.branchId,
    warehouseId: payload.branchId,
    terminalId: payload.terminalId,
    staffId: payload.cashierStaffId,
    staffName: payload.cashierStaffId,
    role: 'Cashier',
    permissions: []
  });
  recordCustomerAccountEntry({
    customerId: payload.customerId,
    entryType: 'CREDIT_SALE',
    referenceType: 'SALE',
    referenceId: payload.saleId,
    debit: payload.creditAmount,
    dueDate,
    transactionDate: payload.saleDate,
    description: `Credit sale ${payload.receiptNumber}.`,
    branchId: payload.branchId,
    idempotencyKey: `${payload.saleId}_CUSTOMER_LEDGER`
  }, context);
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
  const [debts, customerRows] = await Promise.all([
    getCustomerDebtRecords(),
    Promise.resolve(readList<CustomerRecord>('itred_pos_customers_v1', mockCustomers))
  ]);
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

export async function recordCustomerDebtPayment(payload: Omit<CustomerDebtPayment, 'paymentId' | 'receivedAt'> & { allocationMethod?: DebtPaymentAllocationMethod }): Promise<CustomerDebtRecord | null> {
  if (payload.amount <= 0) throw new Error('Payment amount must be above zero.');
  const debts = await getCustomerDebtRecords();
  const target = debts.find((debt) => debt.debtId === payload.debtId);
  if (!target) return null;
  if (payload.amount > target.outstandingAmount) throw new Error('Payment cannot exceed outstanding amount.');
  const context = assertCanonicalCustomerContext({
    vendorId: getActiveVendorId(),
    branchId: payload.branchId || target.branchId,
    warehouseId: payload.branchId || target.branchId,
    terminalId: target.terminalId || 'CUSTOMER-CENTRE',
    staffId: payload.receivedByStaffId,
    staffName: payload.receivedByStaffId,
    role: 'Cashier',
    permissions: []
  });
  const ledgerEntries = getCustomerAccountEntries(context.vendorId, payload.customerId);
  if (ledgerEntries.length === 0 && target.outstandingAmount > 0) {
    recordCustomerAccountEntry({
      customerId: payload.customerId,
      entryType: 'OPENING_BALANCE',
      referenceType: 'DEBT',
      referenceId: target.debtId,
      debit: target.outstandingAmount,
      dueDate: target.dueDate,
      transactionDate: target.saleDate,
      description: `Opening debtor balance for ${target.receiptNumber}.`,
      branchId: target.branchId,
      idempotencyKey: `${target.debtId}_OPENING_LEDGER`
    }, context);
  }
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
  const payment: CustomerDebtPayment = {
    ...payload,
    paymentId: makeId('DEBT-PAY'),
    receivedAt: nowIso()
  };
  saveList(PAYMENT_KEY, [payment, ...readList<CustomerDebtPayment>(PAYMENT_KEY)]);
  await recordCustomerPayment({
    customerId: payload.customerId,
    amount: payload.amount,
    paymentMethod: payload.paymentMethod,
    reference: payload.reference || payment.paymentId,
    paymentDate: payment.receivedAt,
    notes: payload.notes,
    idempotencyKey: `${target.debtId}_${payload.reference || payment.paymentId}_${payload.amount}`,
    allowCashWithoutDrawer: true
  }, context);
  await allocateDebtPayment(payment.paymentId, payload.allocationMethod || 'SelectedDebtOnly', [{
    customerId: payload.customerId,
    debtId: payload.debtId,
    debtReference: target.receiptNumber,
    allocatedAmount: payload.amount,
    allocatedBy: payload.receivedByStaffId,
    notes: payload.notes || payload.paymentMethod
  }]);
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
    topCategories: history.length ? ['General'] : [],
    topProducts: history.slice(0, 3).map((row) => row.receiptNo),
    preferredBrands: [],
    averageBasketValue: totals.length ? totals.reduce((sum, value) => sum + value, 0) / totals.length : 0,
    purchaseFrequency: history.length >= 4 ? 'Weekly' : history.length >= 2 ? 'Monthly' : 'New / Low activity',
    preferredPaymentMethod: history[0]?.paymentMethod || 'Cash',
    preferredBranch: history[0]?.branch || 'Main Branch',
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
  const canonicalEntries = getCustomerAccountEntries(getActiveVendorId(), customerId);
  if (canonicalEntries.length > 0) {
    return canonicalEntries.map((entry) => ({
      id: entry.entryId,
      date: entry.transactionDate,
      type: entry.entryType.replace(/_/g, ' '),
      reference: entry.referenceId,
      debit: entry.debit,
      credit: entry.credit,
      balance: entry.balanceAfter,
      staff: entry.createdBy,
      notes: entry.description
    }));
  }
  const [debts, payments] = await Promise.all([
    getCustomerDebtByCustomer(customerId),
    Promise.resolve(getCustomerDebtPayments({ customerId }))
  ]);
  const openingBalances = getDebtorOpeningBalances({ customerId });
  const deposits = getCustomerDeposits({ customerId });
  const creditNotes = getCustomerCreditNotes({ customerId });
  const allocations = getPaymentAllocations().filter((allocation) => allocation.customerId === customerId);
  const entries = [
    ...openingBalances.map((opening) => ({
      id: `${opening.openingBalanceId}-opening`,
      date: opening.openingBalanceDate,
      type: 'Opening Balance',
      reference: opening.openingReference,
      debit: opening.outstandingAmount,
      credit: 0,
      staff: opening.importedBy,
      notes: opening.notes
    })),
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
    ...allocations.map((allocation) => ({
      id: `${allocation.allocationId}-allocation`,
      date: allocation.allocatedAt,
      type: 'Allocation',
      reference: allocation.debtReference,
      debit: 0,
      credit: 0,
      staff: allocation.allocatedBy,
      notes: `${allocation.notes} Allocation amount ${money(allocation.allocatedAmount)}.`
    })),
    ...deposits.map((deposit) => ({
      id: `${deposit.depositId}-deposit`,
      date: deposit.receivedAt,
      type: deposit.amountApplied > 0 ? 'Deposit applied' : 'Deposit received',
      reference: deposit.depositNumber,
      debit: 0,
      credit: deposit.amountApplied,
      staff: deposit.receivedBy,
      notes: `Deposit balance ${money(deposit.balance)}. ${deposit.notes}`
    })),
    ...creditNotes.map((note) => ({
      id: `${note.creditNoteId}-credit-note`,
      date: note.appliedAt || note.createdAt,
      type: note.amountApplied > 0 ? 'Credit Note applied' : 'Credit Note issued',
      reference: note.creditNoteNumber,
      debit: 0,
      credit: note.amountApplied,
      staff: note.approvedBy || note.createdBy,
      notes: note.reason
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
  const filteredLedger = ledger.filter((row) => row.date >= periodStart && row.date <= periodEnd);
  const creditSales = filteredDebts.reduce((sum, debt) => sum + debt.originalAmount, 0);
  const initialSalePayments = filteredDebts.reduce((sum, debt) => sum + (debt.initialSalePaidAmount || 0), 0);
  const paymentsTotal = filteredPayments.reduce((sum, payment) => sum + payment.amount, 0) + initialSalePayments;
  const openingBalance = filteredLedger.filter((row) => row.type === 'Opening Balance').reduce((sum, row) => sum + row.debit, 0);
  const creditNotesTotal = filteredLedger.filter((row) => row.type.toLowerCase().includes('credit note')).reduce((sum, row) => sum + row.credit, 0);
  const depositTotal = filteredLedger.filter((row) => row.type.toLowerCase().includes('deposit')).reduce((sum, row) => sum + row.credit, 0);
  const allocationTotal = filteredLedger.filter((row) => row.type === 'Allocation').reduce((sum, row) => sum + row.credit, 0);
  const canonicalClosingBalance = filteredLedger.length > 0
    ? filteredLedger[filteredLedger.length - 1].balance
    : filteredDebts.reduce((sum, debt) => sum + debt.outstandingAmount, 0);
  return {
    customer,
    profile,
    debts: filteredDebts,
    payments: filteredPayments,
    ledger: filteredLedger,
    periodFrom: input.dateFrom,
    periodTo: input.dateTo,
    openingBalance,
    creditSales,
    paymentsTotal,
    returnsTotal: 0,
    creditNotesTotal,
    adjustmentsTotal: depositTotal + allocationTotal,
    closingBalance: canonicalClosingBalance,
    overdueBalance: canonicalClosingBalance > 0 ? filteredDebts.filter((debt) => debt.overdueDays > 0).reduce((sum, debt) => sum + debt.outstandingAmount, 0) : 0,
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
    'Hello from your account team.',
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

export function createDebtorsControlTask(input: Omit<CustomerCreditTask, 'taskId' | 'status' | 'createdAt'> & { source?: CustomerCreditTask['source'] }): CustomerCreditTask {
  const task: CustomerCreditTask = {
    ...input,
    taskId: makeId('DEBT-TASK'),
    source: input.source || 'Debtors Control Desk',
    status: 'Open',
    createdAt: nowIso()
  };
  saveList(TASK_KEY, [task, ...readList<CustomerCreditTask>(TASK_KEY)].slice(0, 100));
  return task;
}

export async function createCustomerCreditApprovalRequest(input: {
  approvalType?: 'CREDIT_SALE_OVERRIDE' | 'CREDIT_LIMIT_CHANGE' | 'DEBT_WRITE_OFF' | 'OVERDUE_CUSTOMER_OVERRIDE' | 'SUSPENDED_CUSTOMER_OVERRIDE' | 'CREDIT_APPLICATION_APPROVAL' | 'CREDIT_BLOCK_RELEASE' | 'BLOCKED_CUSTOMER_CREDIT_OVERRIDE' | 'DEBT_DISPUTE_ADJUSTMENT' | 'DEBTOR_OPENING_BALANCE_APPROVAL' | 'DEBTOR_OPENING_BALANCE_REVERSAL' | 'CUSTOMER_DEPOSIT_REFUND' | 'CUSTOMER_CREDIT_NOTE_APPROVAL' | 'CUSTOMER_CREDIT_NOTE_CANCELLATION' | 'DEBTOR_PERIOD_UNLOCK' | 'DEBTOR_PERIOD_ADJUSTMENT' | 'PAYMENT_ALLOCATION_CORRECTION';
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
    vendorId: getActiveVendorId(),
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

export function getCreditApplications(filters: { customerId?: string; status?: CustomerCreditApplication['status'] | 'All'; search?: string } = {}): CustomerCreditApplication[] {
  const query = (filters.search || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
  return readList<CustomerCreditApplication>(CREDIT_APPLICATION_KEY, seedCreditApplications()).filter((application) =>
    (!filters.customerId || application.customerId === filters.customerId) &&
    (!filters.status || filters.status === 'All' || application.status === filters.status) &&
    (query.length === 0 || query.every((word) => [application.customerName, application.status, application.reasonForCreditRequest, application.supportingNotes].join(' ').toLowerCase().includes(word)))
  );
}

export async function createCreditApplication(payload: Omit<CustomerCreditApplication, 'applicationId' | 'approvedCreditLimit' | 'approvedPaymentTermsDays' | 'status' | 'createdAt' | 'updatedAt'> & Partial<Pick<CustomerCreditApplication, 'approvedCreditLimit' | 'approvedPaymentTermsDays' | 'status'>>): Promise<CustomerCreditApplication> {
  const application: CustomerCreditApplication = {
    ...payload,
    applicationId: makeId('CAPP'),
    approvedCreditLimit: payload.approvedCreditLimit || 0,
    approvedPaymentTermsDays: payload.approvedPaymentTermsDays || 0,
    status: payload.status || 'Draft',
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  saveList(CREDIT_APPLICATION_KEY, [application, ...readList<CustomerCreditApplication>(CREDIT_APPLICATION_KEY, seedCreditApplications())]);
  logCreditEvent({ customerId: application.customerId, eventType: 'CREDIT_APPLICATION_CREATED', user: application.createdBy, notes: `Credit application created for ${money(application.requestedCreditLimit)}.`, relatedRecord: application.applicationId });
  return application;
}

export async function submitCreditApplication(applicationId: string): Promise<CustomerCreditApplication | null> {
  let submitted: CustomerCreditApplication | null = null;
  const rows = readList<CustomerCreditApplication>(CREDIT_APPLICATION_KEY, seedCreditApplications()).map((application) => {
    if (application.applicationId !== applicationId) return application;
    submitted = { ...application, status: 'PendingReview', updatedAt: nowIso() };
    return submitted;
  });
  saveList(CREDIT_APPLICATION_KEY, rows);
  if (submitted) {
    const application = submitted as CustomerCreditApplication;
    logCreditEvent({ customerId: application.customerId, eventType: 'CREDIT_APPLICATION_SUBMITTED', user: application.createdBy, notes: 'Credit application submitted for approval.', relatedRecord: application.applicationId });
    await createCustomerCreditApprovalRequest({ approvalType: 'CREDIT_APPLICATION_APPROVAL', customerName: application.customerName, requestedBy: application.createdBy, requestedByRole: 'Manager', branchId: 'main-branch', branch: 'Main Branch', relatedRecord: application.applicationId, amountOrValue: money(application.requestedCreditLimit), risk: 'Medium', reason: 'Credit application approval required.', context: application.reasonForCreditRequest });
  }
  return submitted;
}

export async function approveCreditApplication(applicationId: string, approvalPayload: { approvedCreditLimit: number; approvedPaymentTermsDays: number; approvedBy: string; approvalNotes?: string }): Promise<CustomerCreditApplication | null> {
  let approved: CustomerCreditApplication | null = null;
  const rows = readList<CustomerCreditApplication>(CREDIT_APPLICATION_KEY, seedCreditApplications()).map((application) => {
    if (application.applicationId !== applicationId) return application;
    approved = { ...application, status: 'Approved', approvedCreditLimit: approvalPayload.approvedCreditLimit, approvedPaymentTermsDays: approvalPayload.approvedPaymentTermsDays, approvedBy: approvalPayload.approvedBy, approvedAt: nowIso(), supportingNotes: `${application.supportingNotes} ${approvalPayload.approvalNotes || ''}`.trim(), updatedAt: nowIso() };
    return approved;
  });
  saveList(CREDIT_APPLICATION_KEY, rows);
  if (approved) {
    const application = approved as CustomerCreditApplication;
    await createOrUpdateCustomerCreditProfile(application.customerId, { creditStatus: 'Approved', creditLimit: application.approvedCreditLimit, paymentTermsDays: application.approvedPaymentTermsDays, approvedBy: approvalPayload.approvedBy, approvedAt: application.approvedAt });
    logCreditEvent({ customerId: application.customerId, eventType: 'CREDIT_APPLICATION_APPROVED', user: approvalPayload.approvedBy, notes: `Credit approved at ${money(application.approvedCreditLimit)}.`, relatedRecord: application.applicationId });
  }
  return approved;
}

export async function rejectCreditApplication(applicationId: string, reason: string, rejectedBy = 'Manager'): Promise<CustomerCreditApplication | null> {
  let rejected: CustomerCreditApplication | null = null;
  const rows = readList<CustomerCreditApplication>(CREDIT_APPLICATION_KEY, seedCreditApplications()).map((application) => {
    if (application.applicationId !== applicationId) return application;
    rejected = { ...application, status: 'Rejected', rejectedBy, rejectedAt: nowIso(), rejectionReason: reason, updatedAt: nowIso() };
    return rejected;
  });
  saveList(CREDIT_APPLICATION_KEY, rows);
  if (rejected) logCreditEvent({ customerId: rejected.customerId, eventType: 'CREDIT_APPLICATION_REJECTED', user: rejectedBy, notes: reason, relatedRecord: rejected.applicationId });
  return rejected;
}

export async function markCreditReviewDue(customerId: string, reviewDate: string): Promise<void> {
  const profile = await getCustomerCreditProfile(customerId);
  await createOrUpdateCustomerCreditProfile(customerId, { creditStatus: 'Review', creditNotes: `${profile.creditNotes || ''} Credit review due ${reviewDate}.`.trim() });
  await createCollectionDiaryItem({ customerId, customerName: profile.customerName, type: 'CreditReview', priority: 'Medium', dueDate: reviewDate, assignedTo: 'Manager', status: isSameDate(reviewDate) ? 'DueToday' : 'Pending', notes: 'Credit review due.', createdBy: 'Customer Centre' });
  await createCustomerCreditBIAdvice('CREDIT_REVIEW_DUE', profile.customerName, `${profile.customerName} has a credit review due on ${reviewDate}.`, 'Medium');
}

export function getPromisesToPay(filters: { customerId?: string; status?: PromiseToPayStatus | 'All'; date?: string; search?: string } = {}): PromiseToPayRecord[] {
  const query = (filters.search || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
  return readList<PromiseToPayRecord>(PROMISE_KEY, seedPromises()).filter((promise) =>
    (!filters.customerId || promise.customerId === filters.customerId) &&
    (!filters.status || filters.status === 'All' || promise.status === filters.status) &&
    (!filters.date || promise.promisedDate.slice(0, 10) === filters.date) &&
    (query.length === 0 || query.every((word) => [promise.customerName, promise.debtReference, promise.status, promise.followUpNote, promise.promiseMethod].join(' ').toLowerCase().includes(word)))
  );
}

export async function createPromiseToPay(payload: Omit<PromiseToPayRecord, 'promiseId' | 'status' | 'capturedAt' | 'updatedAt'> & { status?: PromiseToPayStatus }): Promise<PromiseToPayRecord> {
  if (payload.promisedAmount <= 0) throw new Error('Promised amount must be greater than zero.');
  if (!payload.promisedDate) throw new Error('Promised date is required.');
  const promise: PromiseToPayRecord = { ...payload, promiseId: makeId('PTP'), status: payload.status || 'Pending', capturedAt: nowIso(), updatedAt: nowIso() };
  saveList(PROMISE_KEY, [promise, ...readList<PromiseToPayRecord>(PROMISE_KEY, seedPromises())]);
  logCreditEvent({ customerId: promise.customerId, eventType: 'PROMISE_TO_PAY_CREATED', user: promise.capturedBy, notes: `${money(promise.promisedAmount)} promised for ${promise.promisedDate}.`, relatedRecord: promise.promiseId });
  if (isSameDate(promise.promisedDate)) {
    await createCollectionDiaryItem({ customerId: promise.customerId, customerName: promise.customerName, debtId: promise.debtId, debtReference: promise.debtReference, type: 'PromiseDue', priority: 'High', dueDate: promise.promisedDate, assignedTo: promise.assignedTo || 'Manager', status: 'DueToday', notes: promise.followUpNote, createdBy: promise.capturedBy });
    await createCustomerCreditBIAdvice('PROMISE_TO_PAY_DUE_TODAY', promise.customerName, `${promise.customerName} has a promise-to-pay due today for ${money(promise.promisedAmount)}.`, 'Medium');
  }
  return promise;
}

export async function markPromiseKept(promiseId: string, paymentId?: string): Promise<PromiseToPayRecord | null> {
  let kept: PromiseToPayRecord | null = null;
  const rows = readList<PromiseToPayRecord>(PROMISE_KEY, seedPromises()).map((promise) => {
    if (promise.promiseId !== promiseId) return promise;
    kept = { ...promise, status: 'Kept', paymentId, keptAt: nowIso(), updatedAt: nowIso() };
    return kept;
  });
  saveList(PROMISE_KEY, rows);
  if (kept) logCreditEvent({ customerId: kept.customerId, eventType: 'PROMISE_TO_PAY_KEPT', user: kept.capturedBy, notes: 'Promise-to-pay marked kept.', relatedRecord: kept.promiseId });
  return kept;
}

export async function markPromiseBroken(promiseId: string, reason: string): Promise<PromiseToPayRecord | null> {
  let broken: PromiseToPayRecord | null = null;
  const rows = readList<PromiseToPayRecord>(PROMISE_KEY, seedPromises()).map((promise) => {
    if (promise.promiseId !== promiseId) return promise;
    broken = { ...promise, status: 'Broken', brokenAt: nowIso(), brokenReason: reason, updatedAt: nowIso() };
    return broken;
  });
  saveList(PROMISE_KEY, rows);
  if (broken) {
    logCreditEvent({ customerId: broken.customerId, eventType: 'PROMISE_TO_PAY_BROKEN', user: broken.capturedBy, notes: reason, relatedRecord: broken.promiseId });
    await createCollectionDiaryItem({ customerId: broken.customerId, customerName: broken.customerName, debtId: broken.debtId, debtReference: broken.debtReference, type: 'BrokenPromise', priority: 'High', dueDate: todayDate(), assignedTo: broken.assignedTo || 'Manager', status: 'Overdue', notes: reason, createdBy: broken.capturedBy });
    await createCustomerCreditBIAdvice('BROKEN_PAYMENT_PROMISE', broken.customerName, `${broken.customerName} broke a promise-to-pay for ${money(broken.promisedAmount)}.`, 'High');
    if (getBrokenPromiseStats(broken.customerId).brokenCount >= 2) await createCustomerCreditBIAdvice('REPEATED_BROKEN_PROMISES', broken.customerName, `${broken.customerName} has repeated broken promises.`, 'Critical');
  }
  return broken;
}

export async function reschedulePromiseToPay(promiseId: string, newDate: string, note: string): Promise<PromiseToPayRecord | null> {
  const source = readList<PromiseToPayRecord>(PROMISE_KEY, seedPromises()).find((promise) => promise.promiseId === promiseId);
  if (!source) return null;
  const rescheduled: PromiseToPayRecord = { ...source, promiseId: makeId('PTP'), promisedDate: newDate, status: 'Rescheduled', followUpNote: note, rescheduledFromPromiseId: promiseId, capturedAt: nowIso(), updatedAt: nowIso() };
  saveList(PROMISE_KEY, [rescheduled, ...readList<PromiseToPayRecord>(PROMISE_KEY, seedPromises()).map((promise) => promise.promiseId === promiseId ? { ...promise, status: 'Rescheduled' as const, updatedAt: nowIso() } : promise)]);
  logCreditEvent({ customerId: source.customerId, eventType: 'PROMISE_TO_PAY_RESCHEDULED', user: source.capturedBy, notes: note, relatedRecord: rescheduled.promiseId });
  return rescheduled;
}

export function getBrokenPromiseStats(customerId: string): { brokenCount: number; latestBroken?: PromiseToPayRecord; latestPromise?: PromiseToPayRecord } {
  const promises = getPromisesToPay({ customerId });
  const broken = promises.filter((promise) => promise.status === 'Broken');
  return { brokenCount: broken.length, latestBroken: broken[0], latestPromise: promises[0] };
}

export function getCreditBlockHistory(customerId?: string): CustomerCreditBlockRecord[] {
  return readList<CustomerCreditBlockRecord>(CREDIT_BLOCK_KEY, seedCreditBlocks()).filter((block) => !customerId || block.customerId === customerId);
}

async function createCreditBlockRecord(customerId: string, reason: string, staffId: string, newStatus: CustomerCreditBlockRecord['newStatus'], eventType: CustomerCreditActivityEvent['eventType']): Promise<CustomerCreditBlockRecord> {
  const profile = await getCustomerCreditProfile(customerId);
  const block: CustomerCreditBlockRecord = { blockId: makeId('CBLOCK'), customerId, customerName: profile.customerName, previousStatus: profile.creditStatus, newStatus, reason, blockedBy: staffId, blockedAt: nowIso(), active: newStatus !== 'CreditAllowed' };
  saveList(CREDIT_BLOCK_KEY, [block, ...readList<CustomerCreditBlockRecord>(CREDIT_BLOCK_KEY, seedCreditBlocks())]);
  const status: CustomerCreditStatus = newStatus === 'CreditBlocked' ? 'Blocked' : newStatus === 'DepositRequired' ? 'Review' : newStatus === 'CashOnly' ? 'Cash Only' : newStatus === 'Suspended' ? 'Suspended' : 'Approved';
  await createOrUpdateCustomerCreditProfile(customerId, { creditStatus: status, blockedReason: reason });
  logCreditEvent({ customerId, eventType, user: staffId, notes: reason, relatedRecord: block.blockId });
  return block;
}

export async function blockCustomerCredit(customerId: string, reason: string, staffId: string): Promise<CustomerCreditBlockRecord> {
  const block = await createCreditBlockRecord(customerId, reason, staffId, 'CreditBlocked', 'CUSTOMER_CREDIT_BLOCKED');
  await createCustomerCreditBIAdvice('CREDIT_CUSTOMER_BLOCKED', block.customerName, `${block.customerName} credit was blocked. ${reason}`, 'High');
  return block;
}

export async function releaseCustomerCredit(customerId: string, reason: string, staffId: string): Promise<CustomerCreditBlockRecord> {
  const profile = await getCustomerCreditProfile(customerId);
  const rows = getCreditBlockHistory().map((block) => block.customerId === customerId && block.active ? { ...block, active: false, releaseRequestedBy: staffId, releasedBy: staffId, releasedAt: nowIso(), releaseReason: reason } : block);
  saveList(CREDIT_BLOCK_KEY, rows);
  await createCustomerCreditApprovalRequest({ approvalType: 'CREDIT_BLOCK_RELEASE', customerName: profile.customerName, requestedBy: staffId, requestedByRole: 'Manager', branchId: 'main-branch', branch: 'Main Branch', relatedRecord: customerId, amountOrValue: profile.creditStatus, risk: 'Medium', reason, context: 'Credit block release requested.' });
  const block = await createCreditBlockRecord(customerId, reason, staffId, 'CreditAllowed', 'CUSTOMER_CREDIT_RELEASED');
  return { ...block, active: false, releasedBy: staffId, releasedAt: nowIso(), releaseReason: reason };
}

export async function requireCustomerDeposit(customerId: string, reason: string, staffId: string): Promise<CustomerCreditBlockRecord> {
  return createCreditBlockRecord(customerId, reason, staffId, 'DepositRequired', 'CUSTOMER_DEPOSIT_REQUIRED');
}

export async function setCustomerCashOnly(customerId: string, reason: string, staffId: string): Promise<CustomerCreditBlockRecord> {
  return createCreditBlockRecord(customerId, reason, staffId, 'CashOnly', 'CUSTOMER_SET_CASH_ONLY');
}

export function getStatementAcknowledgements(filters: { customerId?: string; status?: StatementAcknowledgementStatus | 'All' } = {}): StatementAcknowledgementRecord[] {
  return readList<StatementAcknowledgementRecord>(STATEMENT_ACK_KEY, seedStatementAcknowledgements()).filter((ack) => (!filters.customerId || ack.customerId === filters.customerId) && (!filters.status || filters.status === 'All' || ack.status === filters.status));
}

export async function createStatementAcknowledgement(payload: Omit<StatementAcknowledgementRecord, 'acknowledgementId' | 'sentAt' | 'updatedAt'> & { sentAt?: string }): Promise<StatementAcknowledgementRecord> {
  const acknowledgement: StatementAcknowledgementRecord = { ...payload, acknowledgementId: makeId('ST-ACK'), sentAt: payload.sentAt || nowIso(), updatedAt: nowIso() };
  saveList(STATEMENT_ACK_KEY, [acknowledgement, ...readList<StatementAcknowledgementRecord>(STATEMENT_ACK_KEY, seedStatementAcknowledgements())]);
  logCreditEvent({ customerId: acknowledgement.customerId, eventType: 'STATEMENT_SENT', user: acknowledgement.sentBy, notes: `${acknowledgement.sentVia} statement acknowledgement recorded.`, relatedRecord: acknowledgement.acknowledgementId });
  return acknowledgement;
}

export async function updateStatementAcknowledgementStatus(acknowledgementId: string, status: StatementAcknowledgementStatus, notes: string): Promise<StatementAcknowledgementRecord | null> {
  let updated: StatementAcknowledgementRecord | null = null;
  const rows = readList<StatementAcknowledgementRecord>(STATEMENT_ACK_KEY, seedStatementAcknowledgements()).map((ack) => {
    if (ack.acknowledgementId !== acknowledgementId) return ack;
    updated = { ...ack, status, notes: `${ack.notes} ${notes}`.trim(), acknowledgedAt: status === 'Acknowledged' ? nowIso() : ack.acknowledgedAt, updatedAt: nowIso() };
    return updated;
  });
  saveList(STATEMENT_ACK_KEY, rows);
  if (updated) logCreditEvent({ customerId: updated.customerId, eventType: status === 'Acknowledged' ? 'STATEMENT_ACKNOWLEDGED' : status === 'Disputed' ? 'STATEMENT_DISPUTED' : status === 'PaymentPromised' ? 'STATEMENT_PAYMENT_PROMISED' : 'STATEMENT_SENT', user: updated.sentBy, notes, relatedRecord: updated.acknowledgementId });
  return updated;
}

export async function markStatementDisputed(acknowledgementId: string, reason: string): Promise<StatementAcknowledgementRecord | null> {
  const updated = await updateStatementAcknowledgementStatus(acknowledgementId, 'Disputed', reason);
  if (updated) await createCustomerCreditBIAdvice('CUSTOMER_DISPUTED_DEBT', updated.customerName, `${updated.customerName} disputed statement ${updated.statementId}.`, 'High');
  return updated;
}

export async function markStatementPaymentPromised(acknowledgementId: string, amount: number, date: string): Promise<StatementAcknowledgementRecord | null> {
  let updated: StatementAcknowledgementRecord | null = null;
  const rows = readList<StatementAcknowledgementRecord>(STATEMENT_ACK_KEY, seedStatementAcknowledgements()).map((ack) => {
    if (ack.acknowledgementId !== acknowledgementId) return ack;
    updated = { ...ack, status: 'PaymentPromised', promisedPaymentAmount: amount, promisedPaymentDate: date, updatedAt: nowIso() };
    return updated;
  });
  saveList(STATEMENT_ACK_KEY, rows);
  if (updated) {
    logCreditEvent({ customerId: updated.customerId, eventType: 'STATEMENT_PAYMENT_PROMISED', user: updated.sentBy, notes: `${money(amount)} promised for ${date}.`, relatedRecord: updated.acknowledgementId });
    await createPromiseToPay({ customerId: updated.customerId, customerName: updated.customerName, promisedAmount: amount, promisedDate: date, promiseMethod: 'WhatsApp', capturedBy: updated.sentBy, followUpNote: `Statement ${updated.statementId} payment promised.`, assignedTo: 'Customer Centre' });
  }
  return updated;
}

export function getDebtDisputes(filters: { customerId?: string; status?: DebtDisputeStatus | 'All' } = {}): DebtDisputeRecord[] {
  return readList<DebtDisputeRecord>(DEBT_DISPUTE_KEY, seedDebtDisputes()).filter((dispute) => (!filters.customerId || dispute.customerId === filters.customerId) && (!filters.status || filters.status === 'All' || dispute.status === filters.status));
}

export async function createDebtDispute(payload: Omit<DebtDisputeRecord, 'disputeId' | 'status' | 'openedAt'> & { status?: DebtDisputeStatus }): Promise<DebtDisputeRecord> {
  const dispute: DebtDisputeRecord = { ...payload, disputeId: makeId('DDISP'), status: payload.status || 'Open', openedAt: nowIso() };
  saveList(DEBT_DISPUTE_KEY, [dispute, ...readList<DebtDisputeRecord>(DEBT_DISPUTE_KEY, seedDebtDisputes())]);
  logCreditEvent({ customerId: dispute.customerId, eventType: 'DEBT_DISPUTE_OPENED', user: dispute.openedBy, notes: dispute.reason, relatedRecord: dispute.disputeId });
  await createCollectionDiaryItem({ customerId: dispute.customerId, customerName: dispute.customerName, debtId: dispute.debtId, debtReference: dispute.debtReference, type: 'DisputeFollowUp', priority: 'High', dueDate: todayDate(), assignedTo: dispute.assignedTo || 'Accountant', status: 'DueToday', notes: dispute.reason, createdBy: dispute.openedBy });
  await createCustomerCreditBIAdvice('CUSTOMER_DISPUTED_DEBT', dispute.customerName, `${dispute.customerName} opened a debt dispute for ${money(dispute.disputedAmount)}.`, 'High');
  return dispute;
}

export async function updateDebtDisputeStatus(disputeId: string, status: DebtDisputeStatus, notes: string): Promise<DebtDisputeRecord | null> {
  let updated: DebtDisputeRecord | null = null;
  const rows = readList<DebtDisputeRecord>(DEBT_DISPUTE_KEY, seedDebtDisputes()).map((dispute) => {
    if (dispute.disputeId !== disputeId) return dispute;
    updated = { ...dispute, status, resolutionNote: notes };
    return updated;
  });
  saveList(DEBT_DISPUTE_KEY, rows);
  return updated;
}

export async function resolveDebtDispute(disputeId: string, resolutionNote: string, staffId: string): Promise<DebtDisputeRecord | null> {
  let resolved: DebtDisputeRecord | null = null;
  const rows = readList<DebtDisputeRecord>(DEBT_DISPUTE_KEY, seedDebtDisputes()).map((dispute) => {
    if (dispute.disputeId !== disputeId) return dispute;
    resolved = { ...dispute, status: 'Resolved', resolutionNote, resolvedBy: staffId, resolvedAt: nowIso() };
    return resolved;
  });
  saveList(DEBT_DISPUTE_KEY, rows);
  if (resolved) logCreditEvent({ customerId: resolved.customerId, eventType: 'DEBT_DISPUTE_RESOLVED', user: staffId, notes: resolutionNote, relatedRecord: resolved.disputeId });
  return resolved;
}

export function getCollectionDiary(filters: { date?: string; assignedTo?: string; type?: CollectionDiaryItemType | 'All'; priority?: RiskLevel | 'All'; status?: CollectionDiaryItemStatus | 'All'; customerId?: string; search?: string } = {}): CollectionDiaryItem[] {
  const query = (filters.search || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
  return readList<CollectionDiaryItem>(COLLECTION_DIARY_KEY, seedCollectionDiary()).filter((item) =>
    (!filters.date || item.dueDate.slice(0, 10) === filters.date) &&
    (!filters.assignedTo || item.assignedTo.toLowerCase().includes(filters.assignedTo.toLowerCase())) &&
    (!filters.type || filters.type === 'All' || item.type === filters.type) &&
    (!filters.priority || filters.priority === 'All' || item.priority === filters.priority) &&
    (!filters.status || filters.status === 'All' || item.status === filters.status) &&
    (!filters.customerId || item.customerId === filters.customerId) &&
    (query.length === 0 || query.every((word) => [item.customerName, item.debtReference, item.type, item.priority, item.status, item.assignedTo, item.notes].join(' ').toLowerCase().includes(word)))
  );
}

export async function createCollectionDiaryItem(payload: Omit<CollectionDiaryItem, 'diaryItemId' | 'createdAt'>): Promise<CollectionDiaryItem> {
  const item: CollectionDiaryItem = { ...payload, diaryItemId: makeId('CDIARY'), createdAt: nowIso() };
  saveList(COLLECTION_DIARY_KEY, [item, ...readList<CollectionDiaryItem>(COLLECTION_DIARY_KEY, seedCollectionDiary())]);
  logCreditEvent({ customerId: item.customerId, eventType: 'COLLECTION_DIARY_ITEM_CREATED', user: item.createdBy, notes: item.notes, relatedRecord: item.diaryItemId });
  createDebtorsControlTask({ title: `${item.type} - ${item.customerName}`, customer: item.customerName, debtReference: item.debtReference || item.diaryItemId, dueDate: item.dueDate, assignedTo: item.assignedTo, source: 'Debtors Collection Diary' });
  return item;
}

export async function completeCollectionDiaryItem(itemId: string, outcomeNote: string): Promise<CollectionDiaryItem | null> {
  let completed: CollectionDiaryItem | null = null;
  const rows = readList<CollectionDiaryItem>(COLLECTION_DIARY_KEY, seedCollectionDiary()).map((item) => {
    if (item.diaryItemId !== itemId) return item;
    completed = { ...item, status: 'Completed', completedAt: nowIso(), outcomeNote };
    return completed;
  });
  saveList(COLLECTION_DIARY_KEY, rows);
  if (completed) logCreditEvent({ customerId: completed.customerId, eventType: 'COLLECTION_DIARY_ITEM_COMPLETED', user: completed.assignedTo, notes: outcomeNote, relatedRecord: completed.diaryItemId });
  return completed;
}

export async function escalateCollectionDiaryItem(itemId: string, note: string): Promise<CollectionDiaryItem | null> {
  let escalated: CollectionDiaryItem | null = null;
  const rows = readList<CollectionDiaryItem>(COLLECTION_DIARY_KEY, seedCollectionDiary()).map((item) => {
    if (item.diaryItemId !== itemId) return item;
    escalated = { ...item, status: 'Escalated', priority: item.priority === 'Critical' ? 'Critical' : 'High', outcomeNote: note };
    return escalated;
  });
  saveList(COLLECTION_DIARY_KEY, rows);
  if (escalated) {
    logCreditEvent({ customerId: escalated.customerId, eventType: 'COLLECTION_DIARY_ITEM_ESCALATED', user: escalated.assignedTo, notes: note, relatedRecord: escalated.diaryItemId });
    await createCustomerCreditBIAdvice('HIGH_RISK_COLLECTION_CUSTOMER', escalated.customerName, `${escalated.customerName} collection diary item escalated.`, 'High');
  }
  return escalated;
}

export async function generateCollectionDiaryForToday(): Promise<CollectionDiaryItem[]> {
  const debts = await getCustomerDebtRecords();
  const promises = getPromisesToPay();
  const acknowledgements = getStatementAcknowledgements();
  const existing = getCollectionDiary({ date: todayDate() });
  const created: CollectionDiaryItem[] = [];
  for (const debt of debts.filter((row) => row.outstandingAmount > 0 && (row.overdueDays > 0 || isSameDate(row.dueDate)))) {
    if (!existing.some((item) => item.debtReference === debt.receiptNumber && item.type === 'PaymentDue')) {
      created.push(await createCollectionDiaryItem({ customerId: debt.customerId, customerName: debt.customerName, debtId: debt.debtId, debtReference: debt.receiptNumber, type: 'PaymentDue', priority: priorityFromDebt(debt), dueDate: todayDate(), assignedTo: 'Customer Centre', status: debt.overdueDays > 0 ? 'Overdue' : 'DueToday', notes: `${money(debt.outstandingAmount)} due for collection.`, createdBy: 'System Local' }));
    }
  }
  for (const promise of promises.filter((row) => row.status === 'Pending' && row.promisedDate.slice(0, 10) <= todayDate())) {
    if (promise.promisedDate.slice(0, 10) < todayDate()) await markPromiseBroken(promise.promiseId, 'Promise date passed without matched payment.');
    else if (!existing.some((item) => item.debtReference === promise.debtReference && item.type === 'PromiseDue')) {
      created.push(await createCollectionDiaryItem({ customerId: promise.customerId, customerName: promise.customerName, debtId: promise.debtId, debtReference: promise.debtReference, type: 'PromiseDue', priority: 'High', dueDate: todayDate(), assignedTo: promise.assignedTo || 'Manager', status: 'DueToday', notes: promise.followUpNote, createdBy: 'System Local' }));
    }
  }
  for (const ack of acknowledgements.filter((row) => row.status === 'NoResponse' || row.status === 'Sent' || row.status === 'Delivered')) {
    if (!existing.some((item) => item.customerId === ack.customerId && item.type === 'StatementFollowUp')) {
      created.push(await createCollectionDiaryItem({ customerId: ack.customerId, customerName: ack.customerName, debtReference: ack.statementId, type: 'StatementFollowUp', priority: 'Medium', dueDate: todayDate(), assignedTo: 'Customer Centre', status: 'DueToday', notes: `Statement acknowledgement is ${ack.status}.`, createdBy: 'System Local' }));
      await createCustomerCreditBIAdvice('STATEMENT_NOT_ACKNOWLEDGED', ack.customerName, `${ack.customerName} has not acknowledged statement ${ack.statementId}.`, 'Medium');
    }
  }
  return created;
}

export function getDebtorOpeningBalances(filters: { customerId?: string; status?: DebtorOpeningBalanceStatus | 'All' } = {}): DebtorOpeningBalance[] {
  return readList<DebtorOpeningBalance>(OPENING_BALANCE_KEY, seedOpeningBalances()).filter((row) => (!filters.customerId || row.customerId === filters.customerId) && (!filters.status || filters.status === 'All' || row.status === filters.status));
}

export async function createDebtorOpeningBalance(payload: Omit<DebtorOpeningBalance, 'openingBalanceId' | 'ageingBucket' | 'status' | 'importedAt'> & { status?: DebtorOpeningBalanceStatus }): Promise<DebtorOpeningBalance> {
  if (await isDebtorTransactionPeriodLocked(payload.openingBalanceDate)) throw new Error('Debtor period is locked. Create an adjustment instead.');
  const config = getDefaultAgeingIntervalConfig();
  const outstandingAmount = Math.max(0, payload.outstandingAmount);
  const opening: DebtorOpeningBalance = { ...payload, openingBalanceId: makeId('OBAL'), outstandingAmount, ageingBucket: assignAgeingBucket(calculateOverdueDays(payload.dueDate), config), status: payload.status || 'Draft', importedAt: nowIso() };
  saveList(OPENING_BALANCE_KEY, [opening, ...readList<DebtorOpeningBalance>(OPENING_BALANCE_KEY, seedOpeningBalances())]);
  logCreditEvent({ customerId: opening.customerId, eventType: 'DEBTOR_OPENING_BALANCE_CREATED', user: opening.importedBy, notes: `${money(opening.outstandingAmount)} opening balance created.`, relatedRecord: opening.openingBalanceId });
  if (opening.outstandingAmount >= 1000) await createCustomerCreditBIAdvice('LARGE_OPENING_BALANCE_REQUIRES_REVIEW', opening.customerName, `${opening.customerName} has a large opening balance of ${money(opening.outstandingAmount)}.`, 'High');
  await createCustomerCreditApprovalRequest({ approvalType: 'DEBTOR_OPENING_BALANCE_APPROVAL', customerName: opening.customerName, requestedBy: opening.importedBy, requestedByRole: 'Accountant', branchId: 'main-branch', branch: 'Main Branch', relatedRecord: opening.openingReference, amountOrValue: money(opening.outstandingAmount), risk: opening.outstandingAmount >= 1000 ? 'High' : 'Medium', reason: 'Debtor opening balance approval required.', context: opening.notes });
  return opening;
}

export async function approveDebtorOpeningBalance(openingBalanceId: string, staffId: string, note: string): Promise<DebtorOpeningBalance | null> {
  let approved: DebtorOpeningBalance | null = null;
  const rows = getDebtorOpeningBalances().map((row) => row.openingBalanceId === openingBalanceId ? (approved = { ...row, status: 'Approved', approvedBy: staffId, approvedAt: nowIso(), notes: `${row.notes} ${note}`.trim() }) : row);
  saveList(OPENING_BALANCE_KEY, rows);
  if (approved) logCreditEvent({ customerId: approved.customerId, eventType: 'DEBTOR_OPENING_BALANCE_APPROVED', user: staffId, notes: note, relatedRecord: openingBalanceId });
  return approved;
}

export async function postDebtorOpeningBalance(openingBalanceId: string): Promise<CustomerDebtRecord | null> {
  const opening = getDebtorOpeningBalances().find((row) => row.openingBalanceId === openingBalanceId);
  if (!opening || opening.status !== 'Approved') return null;
  if (await isDebtorTransactionPeriodLocked(opening.openingBalanceDate)) throw new Error('Debtor period is locked. Opening balance posting is blocked.');
  const debt: CustomerDebtRecord = {
    debtId: makeId('DEBT-OBAL'),
    customerId: opening.customerId,
    customerName: opening.customerName,
    receiptId: opening.openingBalanceId,
    receiptNumber: opening.openingReference,
    saleId: opening.openingBalanceId,
    saleDate: `${opening.openingBalanceDate}T00:00:00`,
    saleTotal: opening.originalAmount,
    initialSalePaidAmount: opening.paidAmount,
    creditAmountCreated: opening.outstandingAmount,
    dueDate: `${opening.dueDate}T00:00:00`,
    originalAmount: opening.originalAmount,
    paidAmount: opening.paidAmount,
    outstandingAmount: opening.outstandingAmount,
    overdueDays: calculateOverdueDays(opening.dueDate),
    ageingBucket: opening.ageingBucket,
    status: opening.outstandingAmount > 0 ? 'Open' : 'Paid',
    branchId: 'main-branch',
    branchName: 'Main Branch',
    terminalId: 'OPENING-BALANCE',
    cashierStaffId: opening.importedBy,
    paymentTermsDays: Math.max(0, daysBetween(opening.openingBalanceDate, opening.dueDate)),
    notes: `Opening Balance. ${opening.notes}`,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  saveList(DEBT_KEY, [debt, ...readList<CustomerDebtRecord>(DEBT_KEY)]);
  saveList(OPENING_BALANCE_KEY, getDebtorOpeningBalances().map((row) => row.openingBalanceId === openingBalanceId ? { ...row, status: 'Posted', postedAt: nowIso() } : row));
  await createOrUpdateCustomerCreditProfile(opening.customerId, { currentBalance: (await calculateCustomerOutstandingBalance(opening.customerId)) + opening.outstandingAmount });
  logCreditEvent({ customerId: opening.customerId, eventType: 'DEBTOR_OPENING_BALANCE_POSTED', user: opening.importedBy, notes: 'Opening balance posted to debtor ledger.', relatedRecord: openingBalanceId });
  await createAccountingPostingPlaceholder({ source: 'Manual Entry', sourceReference: opening.openingReference, branch: 'Main Branch', amount: opening.outstandingAmount });
  await createCustomerCreditBIAdvice('OPENING_BALANCE_POSTED', opening.customerName, `Opening balance ${opening.openingReference} posted for ${money(opening.outstandingAmount)}.`, 'Medium');
  return debt;
}

export async function rejectDebtorOpeningBalance(openingBalanceId: string, reason: string): Promise<DebtorOpeningBalance | null> {
  let rejected: DebtorOpeningBalance | null = null;
  const rows = getDebtorOpeningBalances().map((row) => row.openingBalanceId === openingBalanceId ? (rejected = { ...row, status: 'Rejected', rejectedAt: nowIso(), rejectionReason: reason }) : row);
  saveList(OPENING_BALANCE_KEY, rows);
  return rejected;
}

export async function reverseDebtorOpeningBalance(openingBalanceId: string, reason: string, staffId: string): Promise<DebtorOpeningBalance | null> {
  let reversed: DebtorOpeningBalance | null = null;
  const rows = getDebtorOpeningBalances().map((row) => row.openingBalanceId === openingBalanceId ? (reversed = { ...row, status: 'Reversed', reversedBy: staffId, reversedAt: nowIso(), reversalReason: reason }) : row);
  saveList(OPENING_BALANCE_KEY, rows);
  if (reversed) {
    logCreditEvent({ customerId: reversed.customerId, eventType: 'DEBTOR_OPENING_BALANCE_REVERSED', user: staffId, notes: reason, relatedRecord: openingBalanceId });
    await createCustomerCreditApprovalRequest({ approvalType: 'DEBTOR_OPENING_BALANCE_REVERSAL', customerName: reversed.customerName, requestedBy: staffId, requestedByRole: 'Manager', branchId: 'main-branch', branch: 'Main Branch', relatedRecord: reversed.openingReference, amountOrValue: money(reversed.outstandingAmount), risk: 'High', reason, context: 'Opening balance reversal requested.' });
  }
  return reversed;
}

export async function previewPaymentAllocation(customerId: string, amount: number, allocationMethod: DebtPaymentAllocationMethod, selectedDebtId?: string): Promise<Array<{ debtId: string; debtReference: string; outstandingBefore: number; allocatedAmount: number; outstandingAfter: number; statusAfter: CreditSaleStatus }>> {
  let remaining = Math.max(0, amount);
  let debts = (await getCustomerDebtByCustomer(customerId)).filter((debt) => debt.outstandingAmount > 0);
  if (allocationMethod === 'SelectedDebtOnly' && selectedDebtId) debts = debts.filter((debt) => debt.debtId === selectedDebtId);
  if (allocationMethod === 'OldestDebtFirst' || allocationMethod === 'AutoClearSmallBalances') debts = debts.sort((left, right) => left.dueDate.localeCompare(right.dueDate));
  if (allocationMethod === 'HighestOverdueFirst') debts = debts.sort((left, right) => right.overdueDays - left.overdueDays);
  return debts.map((debt) => {
    const allocatedAmount = Math.min(debt.outstandingAmount, remaining);
    remaining -= allocatedAmount;
    const outstandingAfter = debt.outstandingAmount - allocatedAmount;
    return { debtId: debt.debtId, debtReference: debt.receiptNumber, outstandingBefore: debt.outstandingAmount, allocatedAmount, outstandingAfter, statusAfter: outstandingAfter <= 0 ? 'Paid' : allocatedAmount > 0 ? 'PartiallyPaid' : debt.status };
  }).filter((row) => row.allocatedAmount > 0);
}

export async function allocateDebtPayment(paymentId: string, allocationMethod: DebtPaymentAllocationMethod, allocations: Array<{ customerId: string; debtId: string; debtReference: string; allocatedAmount: number; allocatedBy: string; notes?: string }>): Promise<DebtPaymentAllocation[]> {
  const created = allocations.map((allocation) => ({ ...allocation, allocationId: makeId('ALLOC'), paymentId, allocationMethod, allocatedAt: nowIso(), notes: allocation.notes || `${allocationMethod} allocation.` }));
  saveList(PAYMENT_ALLOCATION_KEY, [...created, ...readList<DebtPaymentAllocation>(PAYMENT_ALLOCATION_KEY)]);
  for (const allocation of created) logCreditEvent({ customerId: allocation.customerId, eventType: 'DEBT_PAYMENT_ALLOCATED', user: allocation.allocatedBy, notes: `${money(allocation.allocatedAmount)} allocated to ${allocation.debtReference}.`, relatedRecord: allocation.paymentId });
  return created;
}

export function getPaymentAllocations(paymentId?: string): DebtPaymentAllocation[] {
  return readList<DebtPaymentAllocation>(PAYMENT_ALLOCATION_KEY).filter((row) => !paymentId || row.paymentId === paymentId);
}

export async function reversePaymentAllocation(allocationId: string, reason: string, staffId: string): Promise<DebtPaymentAllocation | null> {
  const allocation = getPaymentAllocations().find((row) => row.allocationId === allocationId) || null;
  if (allocation) {
    logCreditEvent({ customerId: allocation.customerId, eventType: 'DEBT_PAYMENT_ALLOCATION_REVERSED', user: staffId, notes: reason, relatedRecord: allocationId });
    await createCustomerCreditApprovalRequest({ approvalType: 'PAYMENT_ALLOCATION_CORRECTION', customerName: allocation.customerId, requestedBy: staffId, requestedByRole: 'Accountant', branchId: 'main-branch', branch: 'Main Branch', relatedRecord: allocation.debtReference, amountOrValue: money(allocation.allocatedAmount), risk: 'Medium', reason, context: 'Payment allocation reversal review.' });
  }
  return allocation;
}

export function getCustomerDeposits(filters: { customerId?: string; status?: CustomerDepositStatus | 'All' } = {}): CustomerDepositRecord[] {
  return readList<CustomerDepositRecord>(CUSTOMER_DEPOSIT_KEY, seedDeposits()).filter((row) => (!filters.customerId || row.customerId === filters.customerId) && (!filters.status || filters.status === 'All' || row.status === filters.status));
}

export async function receiveCustomerDeposit(payload: Omit<CustomerDepositRecord, 'depositId' | 'depositNumber' | 'amountApplied' | 'balance' | 'status' | 'receivedAt'> & { receivedAt?: string }): Promise<CustomerDepositRecord> {
  const deposit: CustomerDepositRecord = { ...payload, depositId: makeId('DEP'), depositNumber: `DEP-${Date.now().toString().slice(-6)}`, amountApplied: 0, balance: payload.amountReceived, status: 'Received', receivedAt: payload.receivedAt || nowIso() };
  saveList(CUSTOMER_DEPOSIT_KEY, [deposit, ...getCustomerDeposits()]);
  logCreditEvent({ customerId: deposit.customerId, eventType: 'CUSTOMER_DEPOSIT_RECEIVED', user: deposit.receivedBy, notes: `${money(deposit.amountReceived)} deposit received.`, relatedRecord: deposit.depositNumber });
  await createAccountingPostingPlaceholder({ source: 'Manual Entry', sourceReference: deposit.depositNumber, branch: 'Main Branch', amount: deposit.amountReceived });
  return deposit;
}

function updateDepositApplication(depositId: string, amount: number, eventType: CustomerCreditActivityEvent['eventType'], reference: string, staff = 'Local User'): CustomerDepositRecord | null {
  let updated: CustomerDepositRecord | null = null;
  saveList(CUSTOMER_DEPOSIT_KEY, getCustomerDeposits().map((deposit) => {
    if (deposit.depositId !== depositId) return deposit;
    const amountApplied = Math.min(deposit.amountReceived, deposit.amountApplied + amount);
    const balance = Math.max(0, deposit.amountReceived - amountApplied);
    updated = { ...deposit, amountApplied, balance, status: balance === 0 ? 'FullyApplied' : 'PartiallyApplied', linkedDebtIds: deposit.linkedDebtIds || [] };
    return updated;
  }));
  if (updated) logCreditEvent({ customerId: updated.customerId, eventType, user: staff, notes: `${money(amount)} applied to ${reference}.`, relatedRecord: depositId });
  return updated;
}

export async function applyCustomerDepositToSale(depositId: string, saleId: string, amount: number): Promise<CustomerDepositRecord | null> {
  const updated = updateDepositApplication(depositId, amount, 'CUSTOMER_DEPOSIT_APPLIED_TO_SALE', saleId);
  if (updated) await createAccountingPostingPlaceholder({ source: 'Manual Entry', sourceReference: `${updated.depositNumber}-${saleId}`, branch: 'Main Branch', amount });
  return updated;
}

export async function applyCustomerDepositToDebt(depositId: string, debtId: string, amount: number): Promise<CustomerDepositRecord | null> {
  const debt = (await getCustomerDebtRecords()).find((row) => row.debtId === debtId);
  const updated = updateDepositApplication(depositId, amount, 'CUSTOMER_DEPOSIT_APPLIED_TO_DEBT', debt?.receiptNumber || debtId);
  if (updated && debt) await recordCustomerDebtPayment({ debtId, customerId: debt.customerId, amount, paymentMethod: 'Customer Deposit', reference: updated.depositNumber, notes: 'Deposit applied to debt.', receivedByStaffId: updated.receivedBy, allocationMethod: 'SelectedDebtOnly' });
  return updated;
}

export async function refundCustomerDeposit(depositId: string, amount: number, reason: string, staffId: string): Promise<CustomerDepositRecord | null> {
  let updated: CustomerDepositRecord | null = null;
  saveList(CUSTOMER_DEPOSIT_KEY, getCustomerDeposits().map((deposit) => {
    if (deposit.depositId !== depositId) return deposit;
    const refundedAmount = (deposit.refundedAmount || 0) + amount;
    updated = { ...deposit, refundedAmount, refundedBy: staffId, refundedAt: nowIso(), refundReason: reason, balance: Math.max(0, deposit.balance - amount), status: 'Refunded' };
    return updated;
  }));
  if (updated) {
    logCreditEvent({ customerId: updated.customerId, eventType: 'CUSTOMER_DEPOSIT_REFUNDED', user: staffId, notes: reason, relatedRecord: depositId });
    if (amount >= 100) await createCustomerCreditApprovalRequest({ approvalType: 'CUSTOMER_DEPOSIT_REFUND', customerName: updated.customerName, requestedBy: staffId, requestedByRole: 'Manager', branchId: 'main-branch', branch: 'Main Branch', relatedRecord: updated.depositNumber, amountOrValue: money(amount), risk: 'Medium', reason, context: 'Large customer deposit refund review.' });
  }
  return updated;
}

export function getCustomerDepositBalance(customerId: string): number {
  return getCustomerDeposits({ customerId }).reduce((sum, deposit) => sum + deposit.balance, 0);
}

export function getCustomerCreditNotes(filters: { customerId?: string; status?: CustomerCreditNoteStatus | 'All' } = {}): CustomerCreditNote[] {
  return readList<CustomerCreditNote>(CUSTOMER_CREDIT_NOTE_KEY, seedCreditNotes()).filter((row) => (!filters.customerId || row.customerId === filters.customerId) && (!filters.status || filters.status === 'All' || row.status === filters.status));
}

export async function createCustomerCreditNote(payload: Omit<CustomerCreditNote, 'creditNoteId' | 'creditNoteNumber' | 'amountApplied' | 'balance' | 'status' | 'createdAt'> & { status?: CustomerCreditNoteStatus }): Promise<CustomerCreditNote> {
  const note: CustomerCreditNote = { ...payload, creditNoteId: makeId('CN'), creditNoteNumber: `CN-${Date.now().toString().slice(-6)}`, amountApplied: 0, balance: payload.originalAmount, status: payload.status || 'PendingApproval', createdAt: nowIso() };
  saveList(CUSTOMER_CREDIT_NOTE_KEY, [note, ...getCustomerCreditNotes()]);
  logCreditEvent({ customerId: note.customerId, eventType: 'CUSTOMER_CREDIT_NOTE_CREATED', user: note.createdBy, notes: `${money(note.originalAmount)} credit note created.`, relatedRecord: note.creditNoteNumber });
  await createCustomerCreditApprovalRequest({ approvalType: 'CUSTOMER_CREDIT_NOTE_APPROVAL', customerName: note.customerName, requestedBy: note.createdBy, requestedByRole: 'Manager', branchId: 'main-branch', branch: 'Main Branch', relatedRecord: note.creditNoteNumber, amountOrValue: money(note.originalAmount), risk: 'Medium', reason: note.reason, context: note.notes });
  await createCustomerCreditBIAdvice('CREDIT_NOTE_PENDING_APPROVAL', note.customerName, `${note.creditNoteNumber} is pending approval.`, 'Medium');
  return note;
}

export async function approveCustomerCreditNote(creditNoteId: string, staffId: string, noteText: string): Promise<CustomerCreditNote | null> {
  let approved: CustomerCreditNote | null = null;
  saveList(CUSTOMER_CREDIT_NOTE_KEY, getCustomerCreditNotes().map((note) => note.creditNoteId === creditNoteId ? (approved = { ...note, status: 'Approved', approvedBy: staffId, approvedAt: nowIso(), notes: `${note.notes} ${noteText}`.trim() }) : note));
  if (approved) logCreditEvent({ customerId: approved.customerId, eventType: 'CUSTOMER_CREDIT_NOTE_APPROVED', user: staffId, notes: noteText, relatedRecord: approved.creditNoteNumber });
  return approved;
}

export async function applyCreditNoteToDebt(creditNoteId: string, debtId: string, amount: number): Promise<CustomerCreditNote | null> {
  const note = getCustomerCreditNotes().find((row) => row.creditNoteId === creditNoteId);
  const debt = (await getCustomerDebtRecords()).find((row) => row.debtId === debtId);
  if (!note || !debt || note.status !== 'Approved') return null;
  const applied = Math.min(amount, note.balance, debt.outstandingAmount);
  await recordCustomerDebtPayment({ debtId, customerId: debt.customerId, amount: applied, paymentMethod: 'Credit Note', reference: note.creditNoteNumber, notes: 'Credit note applied to debt.', receivedByStaffId: note.approvedBy || note.createdBy, allocationMethod: 'SelectedDebtOnly' });
  let updated: CustomerCreditNote | null = null;
  saveList(CUSTOMER_CREDIT_NOTE_KEY, getCustomerCreditNotes().map((row) => {
    if (row.creditNoteId !== creditNoteId) return row;
    const amountApplied = row.amountApplied + applied;
    const balance = Math.max(0, row.originalAmount - amountApplied);
    updated = { ...row, amountApplied, balance, status: balance === 0 ? 'FullyApplied' : 'PartiallyApplied', appliedAt: nowIso(), linkedDebtId: debtId };
    return updated;
  }));
  if (updated) {
    logCreditEvent({ customerId: updated.customerId, eventType: 'CUSTOMER_CREDIT_NOTE_APPLIED', user: updated.approvedBy || updated.createdBy, notes: `${money(applied)} applied to ${debt.receiptNumber}.`, relatedRecord: updated.creditNoteNumber });
    await createAccountingPostingPlaceholder({ source: 'Manual Entry', sourceReference: `${updated.creditNoteNumber}-${debt.receiptNumber}`, branch: debt.branchName, amount: applied });
    if (debt.outstandingAmount >= 500) await createCustomerCreditBIAdvice('CREDIT_NOTE_USED_TO_CLEAR_HIGH_DEBT', debt.customerName, `${updated.creditNoteNumber} used against high debt ${debt.receiptNumber}.`, 'Medium');
  }
  return updated;
}

export async function cancelCustomerCreditNote(creditNoteId: string, reason: string, staffId: string): Promise<CustomerCreditNote | null> {
  let cancelled: CustomerCreditNote | null = null;
  saveList(CUSTOMER_CREDIT_NOTE_KEY, getCustomerCreditNotes().map((note) => note.creditNoteId === creditNoteId ? (cancelled = { ...note, status: 'Cancelled', notes: `${note.notes} Cancelled: ${reason}` }) : note));
  if (cancelled) {
    logCreditEvent({ customerId: cancelled.customerId, eventType: 'CUSTOMER_CREDIT_NOTE_CANCELLED', user: staffId, notes: reason, relatedRecord: cancelled.creditNoteNumber });
    await createCustomerCreditApprovalRequest({ approvalType: 'CUSTOMER_CREDIT_NOTE_CANCELLATION', customerName: cancelled.customerName, requestedBy: staffId, requestedByRole: 'Manager', branchId: 'main-branch', branch: 'Main Branch', relatedRecord: cancelled.creditNoteNumber, amountOrValue: money(cancelled.balance), risk: 'Medium', reason, context: 'Credit note cancellation review.' });
  }
  return cancelled;
}

export function createBulkCollectionBatch(payload: Omit<BulkCollectionBatch, 'batchId' | 'batchNumber' | 'generatedAt'>): BulkCollectionBatch {
  const batch: BulkCollectionBatch = { ...payload, batchId: makeId('BCOLL'), batchNumber: `BC-${Date.now().toString().slice(-6)}`, generatedAt: nowIso() };
  saveList(BULK_COLLECTION_KEY, [batch, ...readList<BulkCollectionBatch>(BULK_COLLECTION_KEY, seedBulkCollectionBatches())]);
  logCreditEvent({ customerId: 'BULK', eventType: 'BULK_COLLECTION_BATCH_CREATED', user: batch.generatedBy, notes: `${batch.actionType} batch created for ${batch.customerCount} customer(s).`, relatedRecord: batch.batchNumber });
  return batch;
}

async function createBatchFromDebts(actionType: BulkCollectionActionType, filters: DebtorsControlFilters, generatedBy: string): Promise<BulkCollectionBatch> {
  const summary = await calculateDebtorsControlSummary(filters);
  return createBulkCollectionBatch({ actionType, filterSummary: JSON.stringify(filters), customerCount: new Set(summary.rows.map((row) => row.customerId)).size, debtCount: summary.rows.length, totalAmount: summary.totalOutstanding, status: 'Preview', generatedBy, notes: 'Bulk action prepared locally; no external API called.' });
}

export function getBulkCollectionBatches(): BulkCollectionBatch[] {
  return readList<BulkCollectionBatch>(BULK_COLLECTION_KEY, seedBulkCollectionBatches());
}

export const generateDueTodayReminderBatch = (filters: DebtorsControlFilters, generatedBy = 'Customer Centre') => createBatchFromDebts('GenerateDueTodayReminders', { ...filters, dueFrom: todayDate(), dueTo: todayDate() }, generatedBy);
export const generateOverdueReminderBatch = (filters: DebtorsControlFilters, generatedBy = 'Customer Centre') => createBatchFromDebts('GenerateOverdueReminders', filters, generatedBy);
export const generateStatementBatch = (filters: DebtorsControlFilters, generatedBy = 'Customer Centre') => createBatchFromDebts('PrintStatementBatch', filters, generatedBy);
export const createBatchFollowUpTasks = (filters: DebtorsControlFilters, generatedBy = 'Customer Centre') => createBatchFromDebts('CreateFollowUpTasks', filters, generatedBy);
export const exportDebtorsList = (filters: DebtorsControlFilters, generatedBy = 'Customer Centre') => createBatchFromDebts('ExportDebtorsList', filters, generatedBy);

export async function calculateDebtorRiskHeatMapItem(customerId: string): Promise<DebtorRiskHeatMapItem> {
  const [profile, debts] = await Promise.all([getCustomerCreditProfile(customerId), getCustomerDebtByCustomer(customerId)]);
  const outstandingAmount = debts.reduce((sum, debt) => sum + debt.outstandingAmount, 0);
  const overdueAmount = debts.filter((debt) => debt.overdueDays > 0).reduce((sum, debt) => sum + debt.outstandingAmount, 0);
  const maxDebt = debts.sort((left, right) => right.overdueDays - left.overdueDays)[0];
  const disputedAmount = getDebtDisputes({ customerId }).reduce((sum, dispute) => sum + (dispute.status === 'Resolved' ? 0 : dispute.disputedAmount), 0);
  const brokenPromiseCount = getBrokenPromiseStats(customerId).brokenCount;
  const daysSinceLastPayment = profile.lastPaymentDate ? daysBetween(profile.lastPaymentDate, nowIso()) : 999;
  const creditLimitUsagePercent = profile.creditLimit > 0 ? (outstandingAmount / profile.creditLimit) * 100 : 0;
  const riskLevel: RiskLevel = overdueAmount > 500 || brokenPromiseCount >= 2 || daysSinceLastPayment >= 90 ? 'Critical' : overdueAmount > 0 || creditLimitUsagePercent >= 80 || daysSinceLastPayment >= 60 ? 'High' : outstandingAmount > 0 ? 'Medium' : 'Low';
  const recommendedAction = riskLevel === 'Critical' ? 'Manager review and block credit if needed.' : riskLevel === 'High' ? 'Create collection task and send reminder.' : riskLevel === 'Medium' ? 'Monitor payment behaviour.' : 'No immediate action.';
  if (creditLimitUsagePercent >= 80) await createCustomerCreditBIAdvice('CUSTOMER_ABOVE_80_PERCENT_LIMIT', profile.customerName, `${profile.customerName} is above 80% credit limit usage.`, 'High');
  if (daysSinceLastPayment >= 90) await createCustomerCreditBIAdvice('CUSTOMER_NO_PAYMENT_90_DAYS', profile.customerName, `${profile.customerName} has no payment in 90 days.`, 'Critical');
  else if (daysSinceLastPayment >= 60) await createCustomerCreditBIAdvice('CUSTOMER_NO_PAYMENT_60_DAYS', profile.customerName, `${profile.customerName} has no payment in 60 days.`, 'High');
  return { customerId, customerName: profile.customerName, outstandingAmount, overdueAmount, ageingBucket: maxDebt?.ageingBucket || 'Current', creditLimitUsagePercent, brokenPromiseCount, disputedAmount, daysSinceLastPayment, riskLevel, recommendedAction };
}

export async function getDebtorRiskHeatMap(filters: { customerId?: string } = {}): Promise<DebtorRiskHeatMapItem[]> {
  const customerIds = filters.customerId ? [filters.customerId] : Array.from(new Set([...(await getCustomerDebtRecords()).map((debt) => debt.customerId), ...readList<CustomerRecord>('itred_pos_customers_v1', mockCustomers).map((customer) => customer.customerId)]));
  const rows = await Promise.all(customerIds.map((customerId) => calculateDebtorRiskHeatMapItem(customerId)));
  const risky = rows.filter((row) => row.riskLevel === 'High' || row.riskLevel === 'Critical');
  if (risky.length) await createCustomerCreditBIAdvice('HIGH_RISK_DEBTOR_HEATMAP', 'Debtor Heat Map', `${risky.length} high-risk debtor(s) found in heat map.`, 'High');
  return rows.sort((left, right) => right.outstandingAmount - left.outstandingAmount);
}

export function getDebtorPeriodLocks(): DebtorPeriodLock[] {
  return readList<DebtorPeriodLock>(DEBTOR_PERIOD_LOCK_KEY, seedPeriodLocks());
}

export function createDebtorPeriodLock(periodStart: string, periodEnd: string, staffId: string): DebtorPeriodLock {
  const lock: DebtorPeriodLock = { periodLockId: makeId('DLOCK'), periodStart, periodEnd, status: 'Open', notes: `Created by ${staffId}.` };
  saveList(DEBTOR_PERIOD_LOCK_KEY, [lock, ...getDebtorPeriodLocks()]);
  return lock;
}

export async function lockDebtorPeriod(periodLockId: string, staffId: string, note: string): Promise<DebtorPeriodLock | null> {
  let locked: DebtorPeriodLock | null = null;
  saveList(DEBTOR_PERIOD_LOCK_KEY, getDebtorPeriodLocks().map((period) => period.periodLockId === periodLockId ? (locked = { ...period, status: 'Locked', lockedBy: staffId, lockedAt: nowIso(), notes: note }) : period));
  if (locked) logCreditEvent({ customerId: 'PERIOD', eventType: 'DEBTOR_PERIOD_LOCKED', user: staffId, notes: note, relatedRecord: periodLockId });
  return locked;
}

export async function requestDebtorPeriodUnlock(periodLockId: string, staffId: string, reason: string): Promise<DebtorPeriodLock | null> {
  let updated: DebtorPeriodLock | null = null;
  saveList(DEBTOR_PERIOD_LOCK_KEY, getDebtorPeriodLocks().map((period) => period.periodLockId === periodLockId ? (updated = { ...period, status: 'UnlockRequested', unlockRequestedBy: staffId, unlockRequestedAt: nowIso(), unlockReason: reason }) : period));
  if (updated) {
    logCreditEvent({ customerId: 'PERIOD', eventType: 'DEBTOR_PERIOD_UNLOCK_REQUESTED', user: staffId, notes: reason, relatedRecord: periodLockId });
    await createCustomerCreditApprovalRequest({ approvalType: 'DEBTOR_PERIOD_UNLOCK', customerName: 'Debtor Period', requestedBy: staffId, requestedByRole: 'Manager', branchId: 'main-branch', branch: 'Main Branch', relatedRecord: periodLockId, amountOrValue: updated.periodStart, risk: 'High', reason, context: 'Debtor period unlock requested.' });
    await createCustomerCreditBIAdvice('PERIOD_UNLOCK_REQUESTED', 'Debtor Period', `Period unlock requested for ${updated.periodStart} to ${updated.periodEnd}.`, 'High');
  }
  return updated;
}

export async function approveTemporaryDebtorUnlock(periodLockId: string, staffId: string, expiry: string, note: string): Promise<DebtorPeriodLock | null> {
  let updated: DebtorPeriodLock | null = null;
  saveList(DEBTOR_PERIOD_LOCK_KEY, getDebtorPeriodLocks().map((period) => period.periodLockId === periodLockId ? (updated = { ...period, status: 'TemporarilyUnlocked', temporaryUnlockExpiresAt: expiry, notes: note }) : period));
  if (updated) logCreditEvent({ customerId: 'PERIOD', eventType: 'DEBTOR_PERIOD_TEMPORARILY_UNLOCKED', user: staffId, notes: note, relatedRecord: periodLockId });
  return updated;
}

export async function closeDebtorPeriod(periodLockId: string, staffId: string, note: string): Promise<DebtorPeriodLock | null> {
  let closed: DebtorPeriodLock | null = null;
  saveList(DEBTOR_PERIOD_LOCK_KEY, getDebtorPeriodLocks().map((period) => period.periodLockId === periodLockId ? (closed = { ...period, status: 'Closed', closedBy: staffId, closedAt: nowIso(), notes: note }) : period));
  if (closed) logCreditEvent({ customerId: 'PERIOD', eventType: 'DEBTOR_PERIOD_CLOSED', user: staffId, notes: note, relatedRecord: periodLockId });
  return closed;
}

export async function isDebtorTransactionPeriodLocked(date: string): Promise<boolean> {
  const value = date.slice(0, 10);
  return getDebtorPeriodLocks().some((period) => value >= period.periodStart && value <= period.periodEnd && (period.status === 'Locked' || period.status === 'Closed'));
}

export async function createDebtorPeriodAdjustment(payload: Omit<DebtorPeriodAdjustment, 'adjustmentId' | 'createdAt'>): Promise<DebtorPeriodAdjustment> {
  const adjustment: DebtorPeriodAdjustment = { ...payload, adjustmentId: makeId('DADJ'), createdAt: nowIso() };
  saveList(DEBTOR_PERIOD_ADJUSTMENT_KEY, [adjustment, ...readList<DebtorPeriodAdjustment>(DEBTOR_PERIOD_ADJUSTMENT_KEY)]);
  logCreditEvent({ customerId: adjustment.customerId, eventType: 'DEBTOR_PERIOD_ADJUSTMENT_CREATED', user: adjustment.createdBy, notes: adjustment.reason, relatedRecord: adjustment.adjustmentId });
  await createCustomerCreditApprovalRequest({ approvalType: 'DEBTOR_PERIOD_ADJUSTMENT', customerName: adjustment.customerId, requestedBy: adjustment.createdBy, requestedByRole: 'Accountant', branchId: 'main-branch', branch: 'Main Branch', relatedRecord: adjustment.adjustmentId, amountOrValue: money(adjustment.amount), risk: 'High', reason: adjustment.reason, context: `Adjustment type ${adjustment.adjustmentType}.` });
  await createAccountingPostingPlaceholder({ source: 'Manual Entry', sourceReference: adjustment.adjustmentId, branch: 'Main Branch', amount: adjustment.amount });
  await createCustomerCreditBIAdvice('DEBTOR_ADJUSTMENT_AFTER_LOCK', adjustment.customerId, `Debtor period adjustment created for ${money(adjustment.amount)}.`, 'High');
  return adjustment;
}

export function getCustomerDebtPayments(filters: { customerId?: string; debtId?: string; shiftId?: string } = {}): CustomerDebtPayment[] {
  return readList<CustomerDebtPayment>(PAYMENT_KEY).filter((payment) =>
    (!filters.customerId || payment.customerId === filters.customerId) &&
    (!filters.debtId || payment.debtId === filters.debtId) &&
    (!filters.shiftId || payment.shiftId === filters.shiftId)
  );
}
