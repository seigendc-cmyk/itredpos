import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  DollarSign,
  Download,
  Eye,
  FileText,
  Flag,
  Lock,
  PackageCheck,
  Printer,
  RefreshCw,
  ShieldAlert,
  StickyNote,
  Truck,
  Users,
  XCircle
} from 'lucide-react';
import {
  EODActivityEvent,
  EODBIReviewItem,
  EODCashReconciliation,
  EODChecklistItem,
  EODDeliveryClosingRow,
  EODInventoryClosingRow,
  EODPaymentSummary,
  EODSession,
  EODShiftSummary,
  PaymentMode,
  PosSession,
  Role,
  AccountType,
  AccountingActivityEvent,
  AccountingReadinessCheck,
  AccountingMappingRule,
  CashbookEntry,
  ChartOfAccountsPlaceholder,
  COAAccount,
  COGSReserveSummary,
  InventoryAccountingFilterState,
  InventoryAccountingActivityEvent,
  InventoryAccountingReadinessLine,
  InventoryAccountingReadinessRecord,
  InventoryAccountingSummary,
  InventoryAssetPostingRow,
  PaymentAccountingSummary,
  SalesAccountingSummary,
  VATSummary
} from '../types/posTypes';
import type { FinancialPositionSummary } from '../types/posTypes';
import {
  attemptDayLock,
  exportEODReportPlaceholder,
  getEODActivityEvents,
  getEODBIReviewItems,
  getEODCashReconciliation,
  getEODChecklist,
  getEODDeliveryClosing,
  getEODInventoryClosing,
  getEODPaymentSummary,
  getEODSession,
  getEODShiftSummaries,
  markEODItemReviewed,
  recordEODActivity,
  runEODReadinessCheck,
  updateEODCashReconciliationRow
} from '../services/eodService';
import {
  createAccountingPostingPlaceholder,
  createCOAReplacementPlaceholder,
  exportAccountingReportPlaceholder,
  getAccountingActivityEvents,
  getAccountingReadinessChecks,
  getCashbookEntries,
  getCOAAccounts,
  getCOGSReserveSummary,
  getInventoryAssetPosting,
  getPaymentAccountingSummary,
  getSalesAccountingSummary,
  getVATSummary,
  markAccountingPostingReviewed,
  markCOAAccountInactivePlaceholder,
  reactivateCOAAccountPlaceholder,
  recordAccountingActivity,
  reverseAccountingPostingPlaceholder,
  updatePaymentAccountingSummaryRow,
  updateCOAAccountPlaceholder
} from '../services/accountingService';
import { getFinancialPositionSummary, validateFinancialActivityMappings } from '../services/financialControlService';
import InventoryAccountingReadinessForm from '../components/InventoryAccountingReadinessForm';
import COAAccountDetailModal from '../components/COAAccountDetailModal';
import COAAccountEditDraftModal from '../components/COAAccountEditDraftModal';
import {
  approveInventoryAccountingRecord,
  exportInventoryAccountingPlaceholder,
  getAccountingMappingRules,
  getChartOfAccountsPlaceholders,
  getInventoryAccountingActivityEvents,
  getInventoryAccountingReadinessLines,
  getInventoryAccountingReadinessRecords,
  getInventoryAccountingSummary,
  holdInventoryAccountingRecord,
  markPostedPlaceholder,
  rejectInventoryAccountingRecord,
  reviewInventoryAccountingRecord
} from '../services/inventoryAccountingService';
import RowActionMenu, { RowActionMenuItem } from '../components/RowActionMenu';
import { canPerformAction, PermissionKey } from '../utils/posPermissions';
import { getOwnerSummary } from '../services/ownerService';
import { OwnerSummary } from '../types/posTypes';

interface PosOwnerDeskProps {
  session?: PosSession;
}

type FeedbackType = 'success' | 'warning' | 'error';
type OwnerTab =
  | 'Owner Summary'
  | 'EOD Reconciliation'
  | 'Cash Reconciliation'
  | 'Payment Summary'
  | 'Shift Closing'
  | 'Inventory Closing'
  | 'Delivery Closing'
  | 'BI Review'
  | 'Accounting Desk'
  | 'Day Lock';

type AccountingTab =
  | 'COA Accounts'
  | 'Sales Posting'
  | 'Payment Posting'
  | 'Cashbook'
  | 'VAT Summary'
  | 'COGS Reserve'
  | 'Inventory Asset Posting'
  | 'Inventory Accounting Readiness'
  | 'Accounting Readiness';

type CashModalMode = 'review' | 'note' | 'detail' | 'shift' | 'movements' | 'markBalanced';
type OwnerDeskActionMode = 'detail' | 'note' | 'reconcile' | 'notReady' | 'forceClose' | 'print';
type OwnerDeskActionDomain = 'EOD Readiness' | 'Payment Summary' | 'Shift Closing' | 'Inventory Closing' | 'Delivery Closing' | 'BI Review' | 'Accounting Desk';
type COAAccountModalMode = 'detail' | 'edit' | 'inactive' | 'reactivate' | 'note';
type PaymentPostingModalMode = 'settle' | 'receipts' | 'variance' | 'detail' | 'note' | 'task' | 'bi';
type PaymentVarianceType = 'Short' | 'Over' | 'Timing Difference' | 'Refund Mismatch' | 'Settlement Pending' | 'Control Account Mapping Issue' | 'Other';
type AccountingDeskActionMode = 'detail' | 'issue' | 'note' | 'task' | 'bi' | 'approval';
type AccountingDeskActionTab = 'Sales Posting' | 'Cashbook' | 'VAT Summary' | 'COGS Reserve' | 'Inventory Asset Posting' | 'Inventory Accounting Readiness' | 'Accounting Readiness';

interface AccountingDeskActionState {
  tab: AccountingDeskActionTab;
  mode: AccountingDeskActionMode;
  rowId: string;
  title: string;
  fields: Array<[string, string]>;
  statusField?: string;
}

interface OwnerDeskActionModalState {
  domain: OwnerDeskActionDomain;
  mode: OwnerDeskActionMode;
  rowId: string;
  title: string;
  fields: Array<[string, string]>;
  note?: string;
}

const tabs: OwnerTab[] = [
  'Owner Summary',
  'EOD Reconciliation',
  'Cash Reconciliation',
  'Payment Summary',
  'Shift Closing',
  'Inventory Closing',
  'Delivery Closing',
  'BI Review',
  'Accounting Desk',
  'Day Lock'
];

const accountingTabs: AccountingTab[] = [
  'COA Accounts',
  'Sales Posting',
  'Payment Posting',
  'Cashbook',
  'VAT Summary',
  'COGS Reserve',
  'Inventory Asset Posting',
  'Inventory Accounting Readiness',
  'Accounting Readiness'
];

const branches = ['All Branches', 'Harare Main', 'Bulawayo Branch', 'Mutare Branch'];
const terminals = ['All Terminals', 'POS-01', 'POS-02', 'BACK-01'];
const cashiers = ['All Staff', 'Admin User', 'Mary Cashier', 'Tawanda Supervisor', 'Blessing Stock'];
const paymentModes: Array<PaymentMode | 'All'> = ['All', 'Cash', 'EcoCash', 'Swipe', 'Bank Transfer', 'Split Payment', 'Credit Sale', 'Store Credit'];
const accountTypes: AccountType[] = ['Asset', 'Liability', 'Equity', 'Income', 'Cost of Sales', 'Expense', 'Tax', 'Control'];
const cashMovementTypes = ['All Movement Types', 'Opening Float', 'Cash Sale', 'Cash In', 'Cash Out', 'Refund', 'Banking', 'Owner Withdrawal', 'Petty Cash', 'Cash Variance'];
const vatModes = ['All VAT Modes', 'Inclusive', 'Exclusive', 'Not VAT Registered'];
const paymentSettlementStatuses = ['All Settlement Statuses', 'Settled', 'Pending', 'Variance', 'Under Review'];
const postingStatuses = ['All Posting Statuses', 'Draft', 'Posted', 'Posted Preview', 'Ready for Review', 'Pending Review', 'Reversed'];
const varianceStatuses = ['All Variance Statuses', 'Variance Only', 'No Variance', 'Pending Variance'];
const paymentVarianceTypes: PaymentVarianceType[] = ['Short', 'Over', 'Timing Difference', 'Refund Mismatch', 'Settlement Pending', 'Control Account Mapping Issue', 'Other'];
const riskLevels: Array<'Low' | 'Medium' | 'High' | 'Critical'> = ['Low', 'Medium', 'High', 'Critical'];

const statusClass: Record<string, string> = {
  Passed: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  Warning: 'bg-amber-50 text-amber-900 border-amber-300',
  Failed: 'bg-rose-50 text-rose-800 border-rose-300',
  Pending: 'bg-slate-100 text-slate-700 border-slate-300',
  Balanced: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  Variance: 'bg-amber-50 text-amber-900 border-amber-300',
  Review: 'bg-orange-50 text-orange-800 border-orange-300',
  Reviewed: 'bg-blue-50 text-blue-800 border-blue-300',
  Open: 'bg-orange-50 text-orange-800 border-orange-300',
  Closed: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  Posted: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  'Pending Approval': 'bg-amber-50 text-amber-900 border-amber-300',
  Completed: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  'Follow Up': 'bg-blue-50 text-blue-800 border-blue-300',
  Synced: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  Conflict: 'bg-rose-50 text-rose-800 border-rose-300',
  'Pending Sync': 'bg-amber-50 text-amber-900 border-amber-300',
  Confirmed: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  Mismatch: 'bg-rose-50 text-rose-800 border-rose-300',
  Blocked: 'bg-rose-50 text-rose-800 border-rose-300',
  Locked: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  Active: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  Inactive: 'bg-slate-100 text-slate-700 border-slate-300',
  Draft: 'bg-slate-100 text-slate-700 border-slate-300',
  'Pending Review': 'bg-amber-50 text-amber-900 border-amber-300',
  'Ready for Review': 'bg-cyan-50 text-cyan-800 border-cyan-300',
  'Posted Preview': 'bg-emerald-50 text-emerald-800 border-emerald-300',
  Reversed: 'bg-slate-100 text-slate-700 border-slate-300',
  Settled: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  'Under Review': 'bg-orange-50 text-orange-800 border-orange-300',
  Reserved: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  Used: 'bg-blue-50 text-blue-800 border-blue-300',
  'Misuse Risk': 'bg-rose-50 text-rose-800 border-rose-300',
  'Review Required': 'bg-amber-50 text-amber-900 border-amber-300'
};

const riskClass: Record<string, string> = {
  Low: 'bg-slate-100 text-slate-700 border-slate-300',
  Medium: 'bg-blue-50 text-blue-800 border-blue-300',
  High: 'bg-amber-50 text-amber-900 border-amber-300',
  Critical: 'bg-rose-50 text-rose-800 border-rose-300'
};

export default function PosOwnerDesk({ session }: PosOwnerDeskProps) {
  const [activeTab, setActiveTab] = useState<OwnerTab>('Owner Summary');
  const [activeAccountingTab, setActiveAccountingTab] = useState<AccountingTab>('COA Accounts');
  const [ownerSummary, setOwnerSummary] = useState<OwnerSummary | null>(null);
  const [eodSession, setEODSession] = useState<EODSession | null>(null);
  const [checklist, setChecklist] = useState<EODChecklistItem[]>([]);
  const [payments, setPayments] = useState<EODPaymentSummary[]>([]);
  const [shifts, setShifts] = useState<EODShiftSummary[]>([]);
  const [cashRows, setCashRows] = useState<EODCashReconciliation[]>([]);
  const [inventoryRows, setInventoryRows] = useState<EODInventoryClosingRow[]>([]);
  const [deliveryRows, setDeliveryRows] = useState<EODDeliveryClosingRow[]>([]);
  const [biRows, setBIRows] = useState<EODBIReviewItem[]>([]);
  const [activity, setActivity] = useState<EODActivityEvent[]>([]);
  const [coaAccounts, setCOAAccounts] = useState<COAAccount[]>([]);
  const [salesAccountingRows, setSalesAccountingRows] = useState<SalesAccountingSummary[]>([]);
  const [paymentAccountingRows, setPaymentAccountingRows] = useState<PaymentAccountingSummary[]>([]);
  const [cashbookRows, setCashbookRows] = useState<CashbookEntry[]>([]);
  const [vatRows, setVATRows] = useState<VATSummary[]>([]);
  const [cogsRows, setCOGSRows] = useState<COGSReserveSummary[]>([]);
  const [inventoryAssetRows, setInventoryAssetRows] = useState<InventoryAssetPostingRow[]>([]);
  const [accountingReadiness, setAccountingReadiness] = useState<AccountingReadinessCheck[]>([]);
  const [accountingActivity, setAccountingActivity] = useState<AccountingActivityEvent[]>([]);
  const [financialControlSummary, setFinancialControlSummary] = useState<FinancialPositionSummary | null>(null);
  const [financialMappingStatus, setFinancialMappingStatus] = useState<{ missing: number; warnings: string[] }>({ missing: 0, warnings: [] });
  const [inventoryAccountingRows, setInventoryAccountingRows] = useState<InventoryAccountingReadinessRecord[]>([]);
  const [inventoryAccountingLines, setInventoryAccountingLines] = useState<InventoryAccountingReadinessLine[]>([]);
  const [inventoryAccountingActivity, setInventoryAccountingActivity] = useState<InventoryAccountingActivityEvent[]>([]);
  const [inventoryAccountingSummary, setInventoryAccountingSummary] = useState<InventoryAccountingSummary>({
    pendingReview: 0,
    reviewed: 0,
    approvedForPosting: 0,
    onHold: 0,
    highRisk: 0,
    critical: 0,
    inventoryIncreaseValue: 0,
    inventoryDecreaseValue: 0,
    writeOffValue: 0,
    stocktakeLossValue: 0,
    supplierCreditExpected: 0,
    transferNeutral: 0
  });
  const [inventoryAccountingFilters, setInventoryAccountingFilters] = useState<InventoryAccountingFilterState>({
    sourceType: 'ALL',
    movementType: 'ALL',
    impactType: 'ALL',
    status: 'ALL',
    riskLevel: 'ALL'
  });
  const [chartAccounts, setChartAccounts] = useState<ChartOfAccountsPlaceholder[]>([]);
  const [mappingRules, setMappingRules] = useState<AccountingMappingRule[]>([]);
  const [selectedInventoryAccounting, setSelectedInventoryAccounting] = useState<InventoryAccountingReadinessRecord | null>(null);
  const [branch, setBranch] = useState('All Branches');
  const [terminal, setTerminal] = useState('All Terminals');
  const [cashier, setCashier] = useState('All Staff');
  const [paymentMode, setPaymentMode] = useState<PaymentMode | 'All'>('All');
  const [paymentPostingModeFilter, setPaymentPostingModeFilter] = useState('All Payment Modes');
  const [paymentSettlementFilter, setPaymentSettlementFilter] = useState('All Settlement Statuses');
  const [paymentPostingStatusFilter, setPaymentPostingStatusFilter] = useState('All Posting Statuses');
  const [paymentControlAccountFilter, setPaymentControlAccountFilter] = useState('All Control Accounts');
  const [paymentVarianceStatusFilter, setPaymentVarianceStatusFilter] = useState('All Variance Statuses');
  const [paymentMinAmount, setPaymentMinAmount] = useState('');
  const [paymentMaxAmount, setPaymentMaxAmount] = useState('');
  const [salesAccount, setSalesAccount] = useState('All Sales Accounts');
  const [cashAccount, setCashAccount] = useState('All Cash Accounts');
  const [movementType, setMovementType] = useState('All Movement Types');
  const [vatMode, setVATMode] = useState('Inclusive');
  const [dateFrom, setDateFrom] = useState('2026-06-09');
  const [dateTo, setDateTo] = useState('2026-06-09');
  const [feedback, setFeedback] = useState<{ type: FeedbackType; message: string } | null>(null);
  const [openCashMenuId, setOpenCashMenuId] = useState<string | null>(null);
  const [cashModal, setCashModal] = useState<{ mode: CashModalMode; row: EODCashReconciliation } | null>(null);
  const [cashNote, setCashNote] = useState('');
  const [openOwnerActionMenuId, setOpenOwnerActionMenuId] = useState<string | null>(null);
  const [ownerActionModal, setOwnerActionModal] = useState<OwnerDeskActionModalState | null>(null);
  const [ownerActionNote, setOwnerActionNote] = useState('');
  const [eodSearch, setEodSearch] = useState('');
  const [eodStatusFilter, setEodStatusFilter] = useState('All');
  const [eodRiskFilter, setEodRiskFilter] = useState('All');
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('All');
  const [paymentVarianceFilter, setPaymentVarianceFilter] = useState('All');
  const [shiftSearch, setShiftSearch] = useState('');
  const [inventorySearch, setInventorySearch] = useState('');
  const [deliverySearch, setDeliverySearch] = useState('');
  const [biSearch, setBISearch] = useState('');
  const [accountingSearch, setAccountingSearch] = useState('');
  const [openCOAMenuId, setOpenCOAMenuId] = useState<string | null>(null);
  const [selectedCOAAccount, setSelectedCOAAccount] = useState<COAAccount | null>(null);
  const [coaModalMode, setCOAModalMode] = useState<COAAccountModalMode | null>(null);
  const [coaReason, setCOAReason] = useState('');
  const [openPaymentPostingMenuId, setOpenPaymentPostingMenuId] = useState<string | null>(null);
  const [paymentPostingModal, setPaymentPostingModal] = useState<{ mode: PaymentPostingModalMode; row: PaymentAccountingSummary } | null>(null);
  const [paymentSettlementForm, setPaymentSettlementForm] = useState({ settlementDate: '2026-06-09', settlementReference: '', settledBy: 'Admin User', note: '' });
  const [paymentVarianceForm, setPaymentVarianceForm] = useState<{ amount: string; type: PaymentVarianceType; riskLevel: 'Low' | 'Medium' | 'High' | 'Critical'; note: string; assignTo: string }>({ amount: '', type: 'Short', riskLevel: 'Medium', note: '', assignTo: '' });
  const [paymentOwnerNote, setPaymentOwnerNote] = useState('');
  const [paymentTaskForm, setPaymentTaskForm] = useState({ title: 'Review payment posting variance', issueType: 'Payment variance review', dueDate: '2026-06-10', assignedTo: 'Accountant', notes: '' });
  const [paymentBIForm, setPaymentBIForm] = useState({ rule: 'PAYMENT_POSTING_VARIANCE_REVIEW', priority: 'High', assignedDesk: 'Accounting Desk', narrative: '' });
  const [paymentReceiptSearch, setPaymentReceiptSearch] = useState('');
  const [openAccountingDeskMenuId, setOpenAccountingDeskMenuId] = useState<string | null>(null);
  const [accountingDeskActionModal, setAccountingDeskActionModal] = useState<AccountingDeskActionState | null>(null);
  const [accountingDeskActionNote, setAccountingDeskActionNote] = useState('');
  const [accountingDeskIssueType, setAccountingDeskIssueType] = useState('Control Mapping Review');
  const [accountingDeskRisk, setAccountingDeskRisk] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('Medium');
  const [accountingDeskAssignTo, setAccountingDeskAssignTo] = useState('Accountant');

  const staffName = session?.staffName || 'Admin User';
  const currentRole = toOwnerDeskRole(session?.role);
  const vendorId = 'SCI-LOG-ZW';
  const vendorName = 'Demo Vendor';
  const businessDate = '2026-06-09';

  const filters = useMemo(
    () => ({ vendorId, businessDate, branch, terminal, cashier, paymentMode, dateFrom, dateTo }),
    [vendorId, branch, terminal, cashier, paymentMode, dateFrom, dateTo]
  );

  const accountingFilters = useMemo(
    () => ({ vendorId, businessDate, branch, terminal, cashier, dateFrom, dateTo, salesAccount, cashAccount, movementType, vatMode }),
    [vendorId, branch, terminal, cashier, dateFrom, dateTo, salesAccount, cashAccount, movementType, vatMode]
  );

  const failedChecks = checklist.filter((item) => item.status === 'Failed').length;
  const warningChecks = checklist.filter((item) => item.status === 'Warning').length;
  const pendingReviews = checklist.filter((item) => item.status === 'Pending').length;

  const blockingReasons = useMemo(() => {
    const reasons = [
      cashRows.some((row) => row.variance !== 0 && row.status !== 'Reviewed') ? 'Cash variance not reviewed' : '',
      shifts.some((row) => row.status === 'Open') ? 'Open shift exists' : '',
      checklist.some((item) => item.domain === 'Sync' && item.status === 'Failed') ? 'Sync queue has critical conflicts' : '',
      biRows.some((row) => row.severity === 'Critical' && row.status !== 'Reviewed') ? 'Critical BI alerts not reviewed' : '',
      deliveryRows.some((row) => row.status === 'Pending') ? 'Delivery pending assignment, in transit, cash review, or iDeliver provider selection exists' : '',
      deliveryRows.some((row) => row.status === 'Failed') ? 'Failed or returned delivery requires follow-up' : '',
      deliveryRows.some((row) => row.secretCodeStatus === 'Pending' || row.secretCodeStatus === 'Mismatch') ? 'Delivery confirmation code review pending' : '',
      inventoryRows.some((row) => row.status === 'Pending Approval') ? 'Pending approval inventory movements exist' : '',
      accountingReadiness.some((row) => row.check.includes('Product Sales Account') && row.status !== 'Passed') ? 'Missing Sales Account COA' : '',
      accountingReadiness.some((row) => row.check.includes('Product Asset Account') && row.status !== 'Passed') ? 'Missing Asset Account COA' : '',
      salesAccountingRows.some((row) => row.postingStatus === 'Pending Review') ? 'Unreviewed accounting postings' : '',
      inventoryAccountingRows.some((row) => row.status === 'Pending Review') ? 'Inventory accounting readiness pending review' : '',
      inventoryAccountingRows.some((row) => row.riskLevel === 'High' || row.riskLevel === 'Critical') ? 'High-risk inventory accounting readiness pending' : '',
      inventoryAccountingRows.some((row) => row.impactType === 'Inventory Write Off' && row.status === 'Pending Review') ? 'Write-off pending accounting review' : '',
      inventoryAccountingRows.some((row) => row.impactType === 'Stocktake Loss' && row.status === 'Pending Review') ? 'Stocktake loss pending accounting review' : '',
      inventoryAccountingRows.some((row) => row.impactType === 'Supplier Return Credit Expected' && row.status === 'Pending Review') ? 'Supplier credit expected pending review' : ''
    ];
    return reasons.filter(Boolean);
  }, [accountingReadiness, biRows, cashRows, checklist, deliveryRows, inventoryAccountingRows, inventoryRows, salesAccountingRows, shifts]);

  const filteredChecklist = useMemo(() => checklist.filter((row) =>
    (eodStatusFilter === 'All' || row.status === eodStatusFilter) &&
    (eodRiskFilter === 'All' || (row.risk || 'Low') === eodRiskFilter) &&
    matchesOwnerDeskSearch(eodSearch, [row.check || row.label, row.domain || 'EOD', row.status, row.risk || 'Low', row.requiredAction || row.ownerAction || '', row.reviewedBy || '', row.notes || '', eodSession?.lastCheckTime || 'Pending'])
  ), [checklist, eodRiskFilter, eodSearch, eodSession?.lastCheckTime, eodStatusFilter]);

  const filteredPayments = useMemo(() => payments.filter((row) =>
    (paymentStatusFilter === 'All' || row.status === paymentStatusFilter) &&
    (paymentVarianceFilter === 'All' || (paymentVarianceFilter === 'Variance' ? Number(row.variance) !== 0 : Number(row.variance) === 0)) &&
    matchesOwnerDeskSearch(paymentSearch, [row.paymentMode, row.status, displayAmount(row.variance), displayAmount(row.declaredOrConfirmed), money(row.netAmount), money(row.expectedSettlement)])
  ), [paymentSearch, paymentStatusFilter, paymentVarianceFilter, payments]);

  const filteredShifts = useMemo(() => shifts.filter((row) =>
    matchesOwnerDeskSearch(shiftSearch, [row.shiftId, row.terminal, row.staff, row.status, row.syncStatus, displayAmount(row.variance), displayAmount(row.declaredCash), money(row.salesTotal)])
  ), [shiftSearch, shifts]);

  const filteredInventoryRows = useMemo(() => inventoryRows.filter((row) =>
    matchesOwnerDeskSearch(inventorySearch, [row.movementId, row.product, row.movementType, row.reference, row.branch, row.warehouse, row.status, row.risk, row.requiredAction])
  ), [inventoryRows, inventorySearch]);

  const filteredDeliveryRows = useMemo(() => deliveryRows.filter((row) =>
    matchesOwnerDeskSearch(deliverySearch, [row.deliveryId, row.receipt, row.customer, row.deliveryMethod, row.driver, row.status, row.secretCodeStatus, row.risk, row.requiredAction])
  ), [deliveryRows, deliverySearch]);

  const filteredBIRows = useMemo(() => biRows.filter((row) =>
    matchesOwnerDeskSearch(biSearch, [row.eventType, row.domain, row.severity, row.description, row.recommendedAction, row.status, row.reviewedBy || ''])
  ), [biRows, biSearch]);

  const filteredSalesAccountingRows = useMemo(() => salesAccountingRows.filter((row) =>
    matchesOwnerDeskSearch(accountingSearch, [row.receiptNo, row.branch, row.terminal, row.cashier, row.salesAccount, row.postingStatus, money(row.netSale)])
  ), [accountingSearch, salesAccountingRows]);

  const paymentControlAccountOptions = useMemo(() => ['All Control Accounts', ...Array.from(new Set(paymentAccountingRows.map((row) => cleanPaymentPostingLabel(row.controlAccount))))], [paymentAccountingRows]);
  const paymentModeOptions = useMemo(() => ['All Payment Modes', ...Array.from(new Set(paymentAccountingRows.map((row) => String(row.paymentMode))))], [paymentAccountingRows]);
  const filteredPaymentAccountingRows = useMemo(() => {
    const minAmount = Number(paymentMinAmount);
    const maxAmount = Number(paymentMaxAmount);
    const hasMin = paymentMinAmount.trim() !== '' && Number.isFinite(minAmount);
    const hasMax = paymentMaxAmount.trim() !== '' && Number.isFinite(maxAmount);
    return paymentAccountingRows.filter((row) => {
      const varianceText = typeof row.variance === 'number' ? displayAmount(row.variance) : row.variance;
      const notes = row.ownerNote || '';
      const activityText = accountingActivity.filter((event) => event.message.includes(String(row.paymentMode))).map((event) => event.message).join(' ');
      const cleanControl = cleanPaymentPostingLabel(row.controlAccount);
      const varianceMatches =
        paymentVarianceStatusFilter === 'All Variance Statuses' ||
        (paymentVarianceStatusFilter === 'Variance Only' && typeof row.variance === 'number' && row.variance !== 0) ||
        (paymentVarianceStatusFilter === 'No Variance' && row.variance === 0) ||
        (paymentVarianceStatusFilter === 'Pending Variance' && row.variance === 'Pending');

      return (
        (paymentPostingModeFilter === 'All Payment Modes' || row.paymentMode === paymentPostingModeFilter) &&
        (paymentSettlementFilter === 'All Settlement Statuses' || row.settlementStatus === paymentSettlementFilter) &&
        (paymentPostingStatusFilter === 'All Posting Statuses' || row.postingStatus === paymentPostingStatusFilter) &&
        (paymentControlAccountFilter === 'All Control Accounts' || cleanControl === paymentControlAccountFilter) &&
        varianceMatches &&
        (!hasMin || row.netAmount >= minAmount) &&
        (!hasMax || row.netAmount <= maxAmount) &&
        matchesOwnerDeskSearch(accountingSearch, [String(row.paymentMode), cleanControl, row.settlementStatus, row.postingStatus, varianceText, notes, activityText, money(row.netAmount)])
      );
    });
  }, [accountingActivity, accountingSearch, paymentAccountingRows, paymentControlAccountFilter, paymentMaxAmount, paymentMinAmount, paymentPostingModeFilter, paymentPostingStatusFilter, paymentSettlementFilter, paymentVarianceStatusFilter]);

  const paymentPostingActiveFilters = [
    accountingSearch,
    paymentPostingModeFilter !== 'All Payment Modes' ? paymentPostingModeFilter : '',
    paymentSettlementFilter !== 'All Settlement Statuses' ? paymentSettlementFilter : '',
    paymentPostingStatusFilter !== 'All Posting Statuses' ? paymentPostingStatusFilter : '',
    paymentControlAccountFilter !== 'All Control Accounts' ? paymentControlAccountFilter : '',
    paymentVarianceStatusFilter !== 'All Variance Statuses' ? paymentVarianceStatusFilter : '',
    paymentMinAmount,
    paymentMaxAmount
  ].filter(Boolean).length;

  useEffect(() => {
    void loadEOD();
  }, [filters, accountingFilters, inventoryAccountingFilters]);

  const loadEOD = async () => {
    const [summary, nextSession, nextChecklist, nextPayments, nextShifts, nextCash, nextInventory, nextDelivery, nextBI, nextActivity] =
      await Promise.all([
        getOwnerSummary(),
        getEODSession(vendorId, businessDate),
        getEODChecklist(vendorId, businessDate),
        getEODPaymentSummary(filters),
        getEODShiftSummaries(filters),
        getEODCashReconciliation(filters),
        getEODInventoryClosing(filters),
        getEODDeliveryClosing(filters),
        getEODBIReviewItems(filters),
        getEODActivityEvents()
      ]);

    setOwnerSummary(summary);
    setEODSession(nextSession);
    setChecklist(nextChecklist);
    setPayments(nextPayments);
    setShifts(nextShifts);
    setCashRows(nextCash);
    setInventoryRows(nextInventory);
    setDeliveryRows(nextDelivery);
    setBIRows(nextBI);
    setActivity(nextActivity);
    await loadAccounting();
  };

  const loadAccounting = async () => {
    const [nextCOA, nextSales, nextPayments, nextCashbook, nextVAT, nextCOGS, nextInventoryAsset, nextReadiness, nextActivity, nextInventoryAccounting, nextInventorySummary, nextChartAccounts, nextMappingRules, nextInventoryAccountingActivity, nextFinancialSummary, nextFinancialMapping] =
      await Promise.all([
        getCOAAccounts(),
        getSalesAccountingSummary(accountingFilters),
        getPaymentAccountingSummary(accountingFilters),
        getCashbookEntries(accountingFilters),
        getVATSummary(accountingFilters),
        getCOGSReserveSummary(accountingFilters),
        getInventoryAssetPosting(accountingFilters),
        getAccountingReadinessChecks(vendorId),
        getAccountingActivityEvents(),
        getInventoryAccountingReadinessRecords(inventoryAccountingFilters),
        getInventoryAccountingSummary(inventoryAccountingFilters),
        getChartOfAccountsPlaceholders(),
        getAccountingMappingRules(),
        getInventoryAccountingActivityEvents(),
        getFinancialPositionSummary(),
        validateFinancialActivityMappings()
      ]);

    setCOAAccounts(nextCOA);
    setSalesAccountingRows(nextSales);
    setPaymentAccountingRows(nextPayments);
    setCashbookRows(nextCashbook);
    setVATRows(nextVAT);
    setCOGSRows(nextCOGS);
    setInventoryAssetRows(nextInventoryAsset);
    setAccountingReadiness(nextReadiness);
    setAccountingActivity(nextActivity);
    setInventoryAccountingRows(nextInventoryAccounting);
    setInventoryAccountingSummary(nextInventorySummary);
    setChartAccounts(nextChartAccounts);
    setMappingRules(nextMappingRules);
    setInventoryAccountingActivity(nextInventoryAccountingActivity);
    setFinancialControlSummary(nextFinancialSummary);
    setFinancialMappingStatus(nextFinancialMapping);
  };

  const showFeedback = (type: FeedbackType, message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000);
  };

  const hasCashPermission = (permission: PermissionKey) => canPerformAction(currentRole, permission);

  const canPaymentPosting = (permission: PermissionKey) => hasCashPermission(permission);

  const refreshPaymentRows = (rows: PaymentAccountingSummary[]) => {
    setPaymentAccountingRows(rows);
  };

  const recordPaymentPostingActivity = async (eventType: Parameters<typeof recordAccountingActivity>[0], message: string, type: FeedbackType = 'success') => {
    setAccountingActivity(await recordAccountingActivity(eventType, message, staffName));
    showFeedback(type, message);
  };

  const openPaymentPostingModal = async (mode: PaymentPostingModalMode, row: PaymentAccountingSummary) => {
    setPaymentPostingModal({ mode, row });
    setPaymentReceiptSearch('');
    if (mode === 'settle') {
      setPaymentSettlementForm({
        settlementDate: row.settlementDate || businessDate,
        settlementReference: row.settlementReference || `SET-${row.id.replace('ACC-PAY-', '')}`,
        settledBy: row.settledBy || staffName,
        note: row.ownerNote || ''
      });
    }
    if (mode === 'variance') {
      const varianceAmount = typeof row.variance === 'number' ? Math.abs(row.variance) : 0;
      setPaymentVarianceForm({
        amount: varianceAmount ? String(varianceAmount) : '',
        type: row.variance && row.variance !== 'Pending' && row.variance < 0 ? 'Short' : 'Over',
        riskLevel: row.riskLevel || (varianceAmount > 20 ? 'High' : 'Medium'),
        note: row.ownerNote || '',
        assignTo: row.assignedTo || 'Accountant'
      });
    }
    if (mode === 'note') setPaymentOwnerNote(row.ownerNote || '');
    if (mode === 'task') setPaymentTaskForm({ title: 'Review payment posting variance', issueType: 'Payment variance review', dueDate: '2026-06-10', assignedTo: row.assignedTo || 'Accountant', notes: row.ownerNote || '' });
    if (mode === 'bi') setPaymentBIForm({ rule: row.settlementStatus === 'Pending' ? 'PAYMENT_SETTLEMENT_PENDING_REVIEW' : 'PAYMENT_POSTING_VARIANCE_REVIEW', priority: row.riskLevel || 'High', assignedDesk: 'Accounting Desk', narrative: row.ownerNote || `${row.paymentMode} payment posting requires review.` });
    if (mode === 'detail') await recordPaymentPostingActivity('PAYMENT_MODE_DETAIL_VIEWED', `Payment mode detail viewed for ${row.paymentMode}.`);
    if (mode === 'receipts') await recordPaymentPostingActivity('PAYMENT_MODE_RECEIPTS_VIEWED', `Receipts viewed for ${row.paymentMode}.`);
  };

  const updatePaymentRow = async (row: PaymentAccountingSummary, changes: Partial<PaymentAccountingSummary>, eventType: Parameters<typeof recordAccountingActivity>[0], message: string, type: FeedbackType = 'success') => {
    const result = await updatePaymentAccountingSummaryRow(row.id, changes, staffName, eventType, message);
    refreshPaymentRows(result.rows);
    setPaymentPostingModal((current) => current && current.row.id === row.id && result.row ? { ...current, row: result.row } : current);
    setAccountingActivity(result.activity);
    showFeedback(type, message);
  };

  const handlePaymentMarkSettled = async () => {
    if (!paymentPostingModal) return;
    const row = paymentPostingModal.row;
    const varianceValue = typeof row.variance === 'number' ? row.variance : 0;
    if (varianceValue !== 0 && !paymentSettlementForm.note.trim()) {
      showFeedback('warning', 'Settlement note is required when a variance exists.');
      return;
    }
    await updatePaymentRow(row, {
      settlementStatus: 'Settled',
      postingStatus: varianceValue === 0 ? 'Ready for Review' : 'Pending Review',
      settlementDate: paymentSettlementForm.settlementDate,
      settlementReference: paymentSettlementForm.settlementReference,
      settledBy: paymentSettlementForm.settledBy,
      ownerNote: paymentSettlementForm.note
    }, 'PAYMENT_MODE_MARKED_SETTLED', `${row.paymentMode} marked settled for accounting readiness.`, 'success');
    setPaymentPostingModal(null);
  };

  const handlePaymentReopenSettlement = async (row: PaymentAccountingSummary) => {
    await updatePaymentRow(row, { settlementStatus: 'Under Review', postingStatus: 'Pending Review' }, 'PAYMENT_SETTLEMENT_REOPENED', `${row.paymentMode} settlement review reopened.`, 'warning');
  };

  const handlePaymentFlagVariance = async (createBI = false, createTask = false) => {
    if (!paymentPostingModal) return;
    const row = paymentPostingModal.row;
    const varianceAmount = Number(paymentVarianceForm.amount);
    if (!Number.isFinite(varianceAmount) || varianceAmount <= 0) {
      showFeedback('warning', 'Variance amount is required.');
      return;
    }
    if ((paymentVarianceForm.riskLevel === 'High' || paymentVarianceForm.riskLevel === 'Critical') && !paymentVarianceForm.note.trim()) {
      showFeedback('warning', 'Explanation is required for High or Critical variance.');
      return;
    }
    const signedVariance = paymentVarianceForm.type === 'Short' ? -Math.abs(varianceAmount) : Math.abs(varianceAmount);
    await updatePaymentRow(row, {
      settlementStatus: 'Variance',
      postingStatus: 'Pending Review',
      variance: signedVariance,
      varianceType: paymentVarianceForm.type,
      riskLevel: paymentVarianceForm.riskLevel,
      ownerNote: paymentVarianceForm.note,
      assignedTo: paymentVarianceForm.assignTo
    }, 'PAYMENT_MODE_VARIANCE_FLAGGED', `${row.paymentMode} variance flagged for ${displayAmount(signedVariance)}.`, 'warning');
    if (createBI) await recordPaymentPostingActivity('PAYMENT_POSTING_BI_WARNING_CREATED', `PAYMENT_POSTING_VARIANCE_REVIEW BI warning created for ${row.paymentMode}.`, 'warning');
    if (createTask) await recordPaymentPostingActivity('PAYMENT_POSTING_TASK_CREATED', `Accounting task created to review ${row.paymentMode} payment variance.`, 'success');
    setPaymentPostingModal(null);
  };

  const handlePaymentSaveNote = async () => {
    if (!paymentPostingModal) return;
    if (!paymentOwnerNote.trim()) {
      showFeedback('warning', 'Owner note cannot be blank.');
      return;
    }
    await updatePaymentRow(paymentPostingModal.row, { ownerNote: paymentOwnerNote }, 'PAYMENT_POSTING_OWNER_NOTE_ADDED', `Owner note added to ${paymentPostingModal.row.paymentMode} payment posting.`, 'success');
    setPaymentPostingModal(null);
  };

  const handlePaymentCreateTask = async () => {
    if (!paymentPostingModal) return;
    await updatePaymentRow(paymentPostingModal.row, { ownerNote: paymentTaskForm.notes, assignedTo: paymentTaskForm.assignedTo, postingStatus: 'Pending Review' }, 'PAYMENT_POSTING_TASK_CREATED', `${paymentTaskForm.title} task created for ${paymentPostingModal.row.paymentMode}.`, 'success');
    setPaymentPostingModal(null);
  };

  const handlePaymentCreateBIWarning = async () => {
    if (!paymentPostingModal) return;
    await updatePaymentRow(paymentPostingModal.row, { ownerNote: paymentBIForm.narrative, riskLevel: paymentBIForm.priority as PaymentAccountingSummary['riskLevel'], postingStatus: 'Pending Review' }, 'PAYMENT_POSTING_BI_WARNING_CREATED', `${paymentBIForm.rule} BI warning created for ${paymentPostingModal.row.paymentMode}.`, 'warning');
    setPaymentPostingModal(null);
  };

  const handlePaymentPrint = async (row: PaymentAccountingSummary) => {
    const html = paymentSummaryPrintHtml(row);
    const printWindow = window.open('', '_blank', 'width=900,height=720');
    if (!printWindow) {
      showFeedback('warning', 'Print window was blocked. Allow pop-ups to print the payment summary.');
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    await recordPaymentPostingActivity('PAYMENT_POSTING_SUMMARY_PRINTED', `Payment summary print prepared for ${row.paymentMode}.`);
  };

  const handlePaymentExport = async (row: PaymentAccountingSummary) => {
    const csv = [
      ['Payment Mode', 'Receipts', 'Gross Amount', 'Refunds', 'Net Amount', 'Control Account', 'Settlement Status', 'Variance', 'Posting Status', 'Note'],
      [row.paymentMode, row.receiptCount, row.grossAmount, row.refunds, row.netAmount, cleanPaymentPostingLabel(row.controlAccount), row.settlementStatus, row.variance, row.postingStatus, row.ownerNote || '']
    ].map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `payment-posting-${String(row.paymentMode).replace(/\s+/g, '-').toLowerCase()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    await recordPaymentPostingActivity('PAYMENT_POSTING_ROW_EXPORTED', `Payment posting row export prepared for ${row.paymentMode}.`);
  };

  const clearPaymentPostingFilters = () => {
    setAccountingSearch('');
    setPaymentPostingModeFilter('All Payment Modes');
    setPaymentSettlementFilter('All Settlement Statuses');
    setPaymentPostingStatusFilter('All Posting Statuses');
    setPaymentControlAccountFilter('All Control Accounts');
    setPaymentVarianceStatusFilter('All Variance Statuses');
    setPaymentMinAmount('');
    setPaymentMaxAmount('');
  };

  const openAccountingDeskAction = async (tab: AccountingDeskActionTab, mode: AccountingDeskActionMode, rowId: string, title: string, fields: Array<[string, string]>, statusField?: string) => {
    setAccountingDeskActionModal({ tab, mode, rowId, title, fields, statusField });
    setAccountingDeskActionNote('');
    setAccountingDeskIssueType('Control Mapping Review');
    setAccountingDeskRisk('Medium');
    setAccountingDeskAssignTo('Accountant');
    if (mode === 'detail') await recordAccountingDeskTabActivity(tab, detailEventForTab(tab), `${tab} detail viewed for ${title}.`);
  };

  const recordAccountingDeskTabActivity = async (tab: AccountingDeskActionTab, eventType: Parameters<typeof recordAccountingActivity>[0], message: string, type: FeedbackType = 'success') => {
    setAccountingActivity(await recordAccountingActivity(eventType, message, staffName));
    showFeedback(type, `${tab}: ${message}`);
  };

  const applyAccountingDeskStatus = async (tab: AccountingDeskActionTab, rowId: string, status: string) => {
    if (tab === 'Sales Posting') setSalesAccountingRows((rows) => rows.map((row) => row.id === rowId || row.receiptNo === rowId ? { ...row, postingStatus: status as SalesAccountingSummary['postingStatus'] } : row));
    if (tab === 'Cashbook') setCashbookRows((rows) => rows.map((row) => row.id === rowId || row.reference === rowId ? { ...row, status: status as CashbookEntry['status'], notes: accountingDeskActionNote || row.notes } : row));
    if (tab === 'VAT Summary') setVATRows((rows) => rows.map((row) => row.id === rowId || row.receiptNo === rowId ? { ...row, status: status as VATSummary['status'] } : row));
    if (tab === 'COGS Reserve') setCOGSRows((rows) => rows.map((row) => row.id === rowId ? { ...row, reserveStatus: status as COGSReserveSummary['reserveStatus'] } : row));
    if (tab === 'Inventory Asset Posting') setInventoryAssetRows((rows) => rows.map((row) => row.id === rowId ? { ...row, postingStatus: status as InventoryAssetPostingRow['postingStatus'] } : row));
    if (tab === 'Inventory Accounting Readiness') setInventoryAccountingRows((rows) => rows.map((row) => row.readinessId === rowId ? { ...row, status: status as InventoryAccountingReadinessRecord['status'] } : row));
    if (tab === 'Accounting Readiness') setAccountingReadiness((rows) => rows.map((row) => row.id === rowId ? { ...row, status: status as AccountingReadinessCheck['status'], requiredAction: accountingDeskActionNote || 'Reviewed locally' } : row));
  };

  const handleAccountingDeskAction = async (action: 'review' | 'postedPreview' | 'ready' | 'issue' | 'task' | 'bi' | 'approval' | 'print' | 'export' | 'source') => {
    if (!accountingDeskActionModal) return;
    const { tab, rowId, title } = accountingDeskActionModal;
    if (action === 'review') {
      await applyAccountingDeskStatus(tab, rowId, reviewedStatusForTab(tab));
      await recordAccountingDeskTabActivity(tab, reviewEventForTab(tab), `${title} marked reviewed.`);
    } else if (action === 'postedPreview') {
      await applyAccountingDeskStatus(tab, rowId, 'Posted Preview');
      await recordAccountingDeskTabActivity(tab, 'SALES_POSTING_MARKED_POSTED_PREVIEW', `${title} marked Posted Preview.`, 'warning');
    } else if (action === 'ready') {
      await applyAccountingDeskStatus(tab, rowId, readyStatusForTab(tab));
      await recordAccountingDeskTabActivity(tab, reviewEventForTab(tab), `${title} marked ready for accounting review.`);
    } else if (action === 'issue') {
      await applyAccountingDeskStatus(tab, rowId, issueStatusForTab(tab));
      await recordAccountingDeskTabActivity(tab, issueEventForTab(tab), `${accountingDeskIssueType} flagged for ${title}. Risk: ${accountingDeskRisk}. ${accountingDeskActionNote}`.trim(), 'warning');
    } else if (action === 'task') {
      await recordAccountingDeskTabActivity(tab, taskEventForTab(tab), `Accounting task created for ${title}. Assigned to ${accountingDeskAssignTo}.`, 'success');
    } else if (action === 'bi') {
      await recordAccountingDeskTabActivity(tab, biEventForTab(tab), `BI warning created for ${title}. Risk: ${accountingDeskRisk}.`, 'warning');
    } else if (action === 'approval') {
      await recordAccountingDeskTabActivity(tab, taskEventForTab(tab), `Approval request prepared locally for ${title}.`, 'warning');
    } else if (action === 'print') {
      printAccountingDeskDetail(accountingDeskActionModal);
      await recordAccountingDeskTabActivity(tab, reviewEventForTab(tab), `Print prepared for ${title}.`);
    } else if (action === 'export') {
      exportAccountingDeskDetail(accountingDeskActionModal);
      await recordAccountingDeskTabActivity(tab, reviewEventForTab(tab), `Export prepared for ${title}.`);
    } else {
      await recordAccountingDeskTabActivity(tab, detailEventForTab(tab), `Source record opened locally for ${title}.`);
    }
    if (action !== 'print' && action !== 'export' && action !== 'source') setAccountingDeskActionModal(null);
  };

  const addCashActivity = async (eventType: Parameters<typeof recordEODActivity>[0], message: string, type: FeedbackType = 'success') => {
    setActivity(await recordEODActivity(eventType, message, staffName));
    showFeedback(type, message);
  };

  const updateCashRow = async (rowId: string, changes: Partial<EODCashReconciliation>) => {
    const rows = await updateEODCashReconciliationRow(rowId, changes);
    setCashRows(rows.filter((row) =>
      (branch === 'All Branches' || row.branch === branch) &&
      (terminal === 'All Terminals' || row.terminal === terminal) &&
      (cashier === 'All Staff' || row.cashier === cashier)
    ));
  };

  const openCashModal = async (mode: CashModalMode, row: EODCashReconciliation) => {
    setCashNote(row.ownerNote || '');
    setCashModal({ mode, row });
    if (mode === 'review') {
      await addCashActivity('CASH_VARIANCE_REVIEW_OPENED', `Cash variance review opened for ${row.terminal} / ${row.shiftId}.`, 'warning');
    }
  };

  const handleCashMarkReviewed = async (row: EODCashReconciliation) => {
    await updateCashRow(row.id, { status: 'Reviewed', reviewedBy: staffName, requiredAction: 'Variance reviewed locally' });
    setCashModal(null);
    await addCashActivity('CASH_VARIANCE_MARKED_REVIEWED', `Cash variance marked reviewed for ${row.terminal} / ${row.shiftId}.`);
  };

  const handleCashSaveNote = async () => {
    if (!cashModal) return;
    const note = cashNote.trim();
    if (!note) {
      showFeedback('error', 'Owner note is required before saving.');
      return;
    }
    await updateCashRow(cashModal.row.id, { ownerNote: note, requiredAction: cashModal.row.variance === 0 ? 'Owner note recorded' : 'Owner note recorded for variance' });
    setCashModal(null);
    await addCashActivity('CASH_RECONCILIATION_OWNER_NOTE_ADDED', `Owner note added for ${cashModal.row.terminal} / ${cashModal.row.shiftId}.`);
  };

  const handleCashMarkBalanced = async () => {
    if (!cashModal) return;
    const note = cashNote.trim();
    if (cashModal.row.variance !== 0 && !note) {
      showFeedback('error', 'This drawer has a variance. Enter an owner note before marking balanced.');
      return;
    }
    await updateCashRow(cashModal.row.id, {
      status: 'Balanced',
      reviewedBy: staffName,
      ownerNote: note || cashModal.row.ownerNote,
      requiredAction: cashModal.row.variance === 0 ? 'Balanced locally' : 'Balanced with owner variance note'
    });
    setCashModal(null);
    await addCashActivity('CASH_RECONCILIATION_MARKED_BALANCED', `Cash reconciliation marked balanced for ${cashModal.row.terminal} / ${cashModal.row.shiftId}.`);
  };

  const handleCashPrint = async (row: EODCashReconciliation) => {
    const printWindow = window.open('', '_blank', 'width=760,height=900');
    if (!printWindow) {
      showFeedback('error', 'Print window was blocked by the browser.');
      return;
    }
    printWindow.document.write(`
      <html>
        <head>
          <title>Cash Summary ${row.shiftId}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111827; padding: 24px; }
            h1 { color: #1f2529; font-size: 18px; text-transform: uppercase; border-bottom: 3px solid #f26a1b; padding-bottom: 8px; }
            table { border-collapse: collapse; width: 100%; margin-top: 18px; }
            th, td { border: 1px solid #b8b2aa; padding: 8px; text-align: left; font-size: 12px; }
            th { background: #1f2529; color: #ffffff; text-transform: uppercase; }
          </style>
        </head>
        <body>
          <h1>Cash Drawer Reconciliation Summary</h1>
          <table>
            <tbody>
              ${[
                ['Branch', row.branch],
                ['Terminal', row.terminal],
                ['Cashier', row.cashier],
                ['Shift', row.shiftId],
                ['Opening Float', money(row.openingFloat)],
                ['Cash Sales', money(row.cashSales)],
                ['Cash In', money(row.cashIn)],
                ['Cash Out', money(row.cashOut)],
                ['Expected Cash', money(row.expectedCash)],
                ['Declared Cash', money(row.declaredCash)],
                ['Variance', money(row.variance)],
                ['Status', row.status],
                ['Required Action', row.requiredAction],
                ['Owner Note', row.ownerNote || 'None']
              ].map(([label, value]) => `<tr><th>${label}</th><td>${value}</td></tr>`).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    await addCashActivity('CASH_RECONCILIATION_PRINTED', `Cash summary printed for ${row.terminal} / ${row.shiftId}.`);
  };

  const handleCashExport = async (row: EODCashReconciliation) => {
    const headers = ['Branch', 'Terminal', 'Cashier', 'Shift', 'Opening Float', 'Cash Sales', 'Cash In', 'Cash Out', 'Expected', 'Declared', 'Variance', 'Status', 'Required Action', 'Owner Note'];
    const values = [row.branch, row.terminal, row.cashier, row.shiftId, row.openingFloat, row.cashSales, row.cashIn, row.cashOut, row.expectedCash, row.declaredCash, row.variance, row.status, row.requiredAction, row.ownerNote || ''];
    const csv = `${headers.join(',')}\n${values.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `cash-reconciliation-${row.shiftId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    await addCashActivity('CASH_RECONCILIATION_EXPORTED', `Cash reconciliation CSV exported for ${row.terminal} / ${row.shiftId}.`);
  };

  const handleCashPlaceholderAction = async (eventType: Parameters<typeof recordEODActivity>[0], message: string) => {
    await addCashActivity(eventType, message, 'warning');
  };

  const handleCashAssignFollowUp = async (row: EODCashReconciliation) => {
    await updateCashRow(row.id, {
      ownerNote: 'Follow-up assigned locally for manager review.',
      requiredAction: 'Manager follow-up assigned locally'
    });
    setCashModal(null);
    await addCashActivity('CASH_RECONCILIATION_ESCALATED', `Follow-up assigned locally for ${row.terminal} / ${row.shiftId}.`, 'warning');
  };

  const addOwnerActivity = async (eventType: Parameters<typeof recordEODActivity>[0], message: string, type: FeedbackType = 'success') => {
    setActivity(await recordEODActivity(eventType, message, staffName));
    showFeedback(type, message);
  };

  const openOwnerActionModal = async (modal: OwnerDeskActionModalState) => {
    setOwnerActionNote(modal.note || '');
    setOwnerActionModal(modal);
    if (modal.mode === 'detail') {
      await addOwnerActivity(
        modal.domain === 'EOD Readiness' ? 'EOD_READINESS_CHECK_VIEWED' : modal.domain === 'Payment Summary' ? 'PAYMENT_MODE_DETAIL_VIEWED' : 'OWNER_DESK_PLACEHOLDER_VIEWED',
        `${modal.title} opened locally.`,
        'warning'
      );
    }
  };

  const handleOwnerActionNoteSave = async () => {
    if (!ownerActionModal) return;
    const note = ownerActionNote.trim();
    if ((ownerActionModal.mode === 'notReady' || ownerActionModal.mode === 'forceClose' || ownerActionModal.mode === 'reconcile') && !note) {
      showFeedback('error', 'Owner note is required for this local action.');
      return;
    }
    if (ownerActionModal.domain === 'EOD Readiness') {
      setChecklist((rows) => rows.map((row) => row.id === ownerActionModal.rowId ? {
        ...row,
        status: ownerActionModal.mode === 'notReady' ? 'Failed' : row.status,
        notes: note || row.notes,
        requiredAction: ownerActionModal.mode === 'notReady' ? 'Owner marked not ready locally' : row.requiredAction
      } : row));
      await addOwnerActivity(ownerActionModal.mode === 'notReady' ? 'EOD_READINESS_MARKED_NOT_READY' : 'EOD_READINESS_OWNER_NOTE_ADDED', `${ownerActionModal.title} updated locally.`);
    } else if (ownerActionModal.domain === 'Payment Summary') {
      setPayments((rows) => rows.map((row) => row.id === ownerActionModal.rowId ? { ...row, status: ownerActionModal.mode === 'reconcile' ? 'Balanced' : row.status } : row));
      await addOwnerActivity(ownerActionModal.mode === 'reconcile' ? 'PAYMENT_MODE_RECONCILED' : 'PAYMENT_MODE_OWNER_NOTE_ADDED', `${ownerActionModal.title} updated locally.`);
    } else if (ownerActionModal.domain === 'Shift Closing') {
      setShifts((rows) => rows.map((row) => row.id === ownerActionModal.rowId ? { ...row, status: ownerActionModal.mode === 'forceClose' ? 'Force Closed Placeholder' : row.status, reviewedBy: staffName } : row));
      await addOwnerActivity('OWNER_DESK_PLACEHOLDER_UPDATED', `${ownerActionModal.title} updated locally.`);
    } else {
      await addOwnerActivity('OWNER_DESK_PLACEHOLDER_UPDATED', `${ownerActionModal.title} updated locally.`);
    }
    setOwnerActionModal(null);
  };

  const handleOwnerMarkReviewed = async (domain: OwnerDeskActionDomain, rowId: string, title: string) => {
    if (domain === 'EOD Readiness') {
      setChecklist((rows) => rows.map((row) => row.id === rowId ? { ...row, status: 'Passed', reviewedBy: staffName, notes: 'Marked ready locally.' } : row));
      await addOwnerActivity('EOD_READINESS_MARKED_READY', `${title} marked ready locally.`);
    } else if (domain === 'Payment Summary') {
      setPayments((rows) => rows.map((row) => row.id === rowId ? { ...row, status: 'Review' } : row));
      await addOwnerActivity('PAYMENT_MODE_MARKED_REVIEWED', `${title} marked reviewed locally.`);
    } else if (domain === 'Shift Closing') {
      setShifts((rows) => rows.map((row) => row.id === rowId ? { ...row, reviewedBy: staffName } : row));
      await addOwnerActivity('OWNER_DESK_PLACEHOLDER_UPDATED', `${title} marked reviewed locally.`);
    } else if (domain === 'Inventory Closing') {
      setInventoryRows((rows) => rows.map((row) => row.id === rowId ? { ...row, status: 'Reviewed', reviewedBy: staffName } : row));
      await addOwnerActivity('OWNER_DESK_PLACEHOLDER_UPDATED', `${title} marked reviewed locally.`);
    } else if (domain === 'Delivery Closing') {
      setDeliveryRows((rows) => rows.map((row) => row.id === rowId ? { ...row, status: 'Follow Up', reviewedBy: staffName } : row));
      await addOwnerActivity('OWNER_DESK_PLACEHOLDER_UPDATED', `${title} marked reviewed locally.`);
    } else if (domain === 'BI Review') {
      setBIRows((rows) => rows.map((row) => row.id === rowId ? { ...row, status: 'Reviewed', reviewedBy: staffName } : row));
      await addOwnerActivity('OWNER_DESK_PLACEHOLDER_UPDATED', `${title} marked reviewed locally.`);
    } else {
      await addOwnerActivity('OWNER_DESK_PLACEHOLDER_UPDATED', `${title} marked reviewed locally.`);
    }
  };

  const handleOwnerPlaceholderEvent = async (domain: OwnerDeskActionDomain, eventType: Parameters<typeof recordEODActivity>[0], title: string) => {
    await addOwnerActivity(eventType, `${domain}: ${title} recorded locally.`, 'warning');
  };

  const handleOwnerPrint = async (domain: OwnerDeskActionDomain, title: string, fields: Array<[string, string]>, eventType: Parameters<typeof recordEODActivity>[0]) => {
    const printWindow = window.open('', '_blank', 'width=760,height=900');
    if (!printWindow) {
      showFeedback('error', 'Print window was blocked by the browser.');
      return;
    }
    printWindow.document.write(buildOwnerDeskPrintHtml(domain, title, fields));
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    await addOwnerActivity(eventType, `${title} printed locally.`);
  };

  const handleOwnerExport = async (domain: OwnerDeskActionDomain, title: string, fields: Array<[string, string]>, eventType: Parameters<typeof recordEODActivity>[0]) => {
    const csv = `${fields.map(([label]) => `"${label.replace(/"/g, '""')}"`).join(',')}\n${fields.map(([, value]) => `"${value.replace(/"/g, '""')}"`).join(',')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${domain.toLowerCase().replace(/\s+/g, '-')}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    await addOwnerActivity(eventType, `${title} exported locally.`);
  };

  const refreshMutableRows = async () => {
    const [nextChecklist, nextCash, nextInventory, nextDelivery, nextBI, nextActivity, nextSession] = await Promise.all([
      getEODChecklist(vendorId, businessDate),
      getEODCashReconciliation(filters),
      getEODInventoryClosing(filters),
      getEODDeliveryClosing(filters),
      getEODBIReviewItems(filters),
      getEODActivityEvents(),
      getEODSession(vendorId, businessDate)
    ]);
    setChecklist(nextChecklist);
    setCashRows(nextCash);
    setInventoryRows(nextInventory);
    setDeliveryRows(nextDelivery);
    setBIRows(nextBI);
    setActivity(nextActivity);
    setEODSession(nextSession);
  };

  const handleRunCheck = async () => {
    setChecklist(await runEODReadinessCheck(vendorId, businessDate));
    setActivity(await getEODActivityEvents());
    showFeedback('success', 'EOD readiness check run for Demo Vendor.');
  };

  const handleMarkReviewed = async (itemId: string) => {
    setActivity(await markEODItemReviewed(itemId));
    await refreshMutableRows();
    showFeedback('success', `${itemId} marked reviewed locally.`);
  };

  const handleLockDay = async () => {
    const result = await attemptDayLock(vendorId, businessDate);
    setEODSession(result.session);
    setActivity(result.activity);
    showFeedback(result.success ? 'success' : 'error', result.message);
  };

  const handleExport = async () => {
    const result = await exportEODReportPlaceholder(filters);
    setActivity(result.activity);
    showFeedback('success', result.message);
  };

  const handleActivityOnly = async (message: string) => {
    setActivity(await recordEODActivity('SHIFT_FORCE_CLOSE_PLACEHOLDER', message, staffName));
    showFeedback('warning', message);
  };

  const handleAccountingReviewed = async (postingId: string) => {
    setAccountingActivity(await markAccountingPostingReviewed(postingId));
    await loadAccounting();
    showFeedback('success', `${postingId} marked reviewed locally.`);
  };

  const handleAccountingReverse = async (postingId: string) => {
    setAccountingActivity(await reverseAccountingPostingPlaceholder(postingId, 'Owner Desk reverse placeholder.'));
    await loadAccounting();
    showFeedback('warning', `${postingId} reverse placeholder recorded.`);
  };

  const handleAccountingExport = async (reportType: string) => {
    const result = await exportAccountingReportPlaceholder(reportType);
    setAccountingActivity(result.activity);
    showFeedback('success', result.message);
  };

  const handleCreatePostingPlaceholder = async () => {
    await createAccountingPostingPlaceholder({
      sourceReference: 'MANUAL-PLACEHOLDER',
      source: 'Manual Placeholder',
      branch: branch === 'All Branches' ? 'Harare Main' : branch,
      amount: 0
    });
    setAccountingActivity(await getAccountingActivityEvents());
    showFeedback('success', 'New COA account form placeholder recorded locally.');
  };

  const openCOAModal = async (account: COAAccount, mode: COAAccountModalMode) => {
    setSelectedCOAAccount(account);
    setCOAModalMode(mode);
    setCOAReason(account.notes || '');
    if (mode === 'detail') {
      setAccountingActivity(await recordAccountingActivity('COA_ACCOUNT_VIEWED', `${account.accountCode} account detail opened locally.`, staffName));
    }
  };

  const closeCOAModal = () => {
    setSelectedCOAAccount(null);
    setCOAModalMode(null);
    setCOAReason('');
  };

  const handleCOAEditSave = async (changes: Partial<COAAccount>) => {
    if (!selectedCOAAccount) return;
    const result = await updateCOAAccountPlaceholder(selectedCOAAccount.id, changes, staffName, 'COA_ACCOUNT_DRAFT_EDITED');
    setCOAAccounts(result.accounts);
    setAccountingActivity(result.activity);
    closeCOAModal();
    showFeedback('success', `${changes.accountCode || selectedCOAAccount.accountCode} draft updated locally.`);
  };

  const handleCOAMarkInactive = async () => {
    if (!selectedCOAAccount) return;
    const reason = coaReason.trim();
    if (!reason) {
      showFeedback('error', 'Reason / owner note is required before marking inactive.');
      return;
    }
    const result = await markCOAAccountInactivePlaceholder(selectedCOAAccount.id, reason, staffName);
    setCOAAccounts(result.accounts);
    setAccountingActivity(result.activity);
    closeCOAModal();
    showFeedback('success', `${selectedCOAAccount.accountCode} marked inactive locally.`);
  };

  const handleCOAReactivate = async (account: COAAccount) => {
    const reason = coaReason.trim();
    if (!reason) {
      showFeedback('error', 'Reason / owner note is required before reactivation.');
      return;
    }
    const result = await reactivateCOAAccountPlaceholder(account.id, 'Draft', reason, staffName);
    setCOAAccounts(result.accounts);
    setAccountingActivity(result.activity);
    closeCOAModal();
    showFeedback('success', `${account.accountCode} reactivated as Draft locally.`);
  };

  const handleCOAOwnerNote = async () => {
    if (!selectedCOAAccount) return;
    const note = coaReason.trim();
    if (!note) {
      showFeedback('error', 'Owner note is required.');
      return;
    }
    const result = await updateCOAAccountPlaceholder(selectedCOAAccount.id, { notes: note }, staffName, 'COA_ACCOUNT_OWNER_NOTE_ADDED');
    setCOAAccounts(result.accounts);
    setAccountingActivity(result.activity);
    closeCOAModal();
    showFeedback('success', `${selectedCOAAccount.accountCode} owner note saved locally.`);
  };

  const handleCOACreateReplacement = async (account: COAAccount) => {
    const result = await createCOAReplacementPlaceholder(account, staffName);
    setCOAAccounts(result.accounts);
    setAccountingActivity(result.activity);
    showFeedback('success', `${result.account.accountCode} replacement draft created locally.`);
  };

  const handleCOAPrint = async (account: COAAccount) => {
    const fields = coaAccountFields(account);
    const printWindow = window.open('', '_blank', 'width=760,height=900');
    if (!printWindow) {
      showFeedback('error', 'Print window was blocked by the browser.');
      return;
    }
    printWindow.document.write(buildOwnerDeskPrintHtml('COA Account Detail', `${account.accountCode} ${account.accountName}`, fields));
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    setAccountingActivity(await recordAccountingActivity('COA_ACCOUNT_DETAIL_PRINTED', `${account.accountCode} account detail printed locally.`, staffName));
  };

  const handleCOAExport = async (account: COAAccount) => {
    const fields = coaAccountFields(account);
    const csv = `${fields.map(([label]) => `"${label.replace(/"/g, '""')}"`).join(',')}\n${fields.map(([, value]) => `"${value.replace(/"/g, '""')}"`).join(',')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `coa-account-${account.accountCode}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setAccountingActivity(await recordAccountingActivity('COA_ACCOUNT_ROW_EXPORTED', `${account.accountCode} account row exported locally.`, staffName));
    showFeedback('success', `${account.accountCode} export prepared locally.`);
  };

  const refreshInventoryAccounting = async (readinessId?: string) => {
    const [nextRows, nextSummary, nextActivity] = await Promise.all([
      getInventoryAccountingReadinessRecords(inventoryAccountingFilters),
      getInventoryAccountingSummary(inventoryAccountingFilters),
      getInventoryAccountingActivityEvents()
    ]);
    setInventoryAccountingRows(nextRows);
    setInventoryAccountingSummary(nextSummary);
    setInventoryAccountingActivity(nextActivity);

    const activeId = readinessId || selectedInventoryAccounting?.readinessId;
    if (activeId) {
      const nextSelected = nextRows.find((row) => row.readinessId === activeId) || selectedInventoryAccounting;
      setSelectedInventoryAccounting(nextSelected);
      setInventoryAccountingLines(await getInventoryAccountingReadinessLines(activeId));
    }
  };

  const ensureInventoryAccountingPermission = (permission: Parameters<typeof canPerformAction>[1]) => {
    if (!canPerformAction(currentRole, permission)) {
      showFeedback('error', 'You do not have permission to perform this action.');
      return false;
    }
    return true;
  };

  const openInventoryAccountingRecord = async (record: InventoryAccountingReadinessRecord) => {
    if (!ensureInventoryAccountingPermission('inventoryAccounting.view')) {
      return;
    }
    setSelectedInventoryAccounting(record);
    setInventoryAccountingLines(await getInventoryAccountingReadinessLines(record.readinessId));
  };

  const handleInventoryAccountingReview = async (notes: string) => {
    if (!selectedInventoryAccounting || !ensureInventoryAccountingPermission('inventoryAccounting.review')) {
      return;
    }
    await reviewInventoryAccountingRecord(selectedInventoryAccounting.readinessId, staffName, notes);
    await refreshInventoryAccounting(selectedInventoryAccounting.readinessId);
    showFeedback('success', `${selectedInventoryAccounting.readinessNumber} marked reviewed locally.`);
  };

  const handleInventoryAccountingApprove = async (notes: string) => {
    if (!selectedInventoryAccounting || !ensureInventoryAccountingPermission('inventoryAccounting.approve')) {
      return;
    }
    await approveInventoryAccountingRecord(selectedInventoryAccounting.readinessId, staffName, notes);
    await refreshInventoryAccounting(selectedInventoryAccounting.readinessId);
    showFeedback('success', `${selectedInventoryAccounting.readinessNumber} approved for posting review.`);
  };

  const handleInventoryAccountingHold = async (notes: string) => {
    if (!selectedInventoryAccounting || !ensureInventoryAccountingPermission('inventoryAccounting.hold')) {
      return;
    }
    const result = await holdInventoryAccountingRecord(selectedInventoryAccounting.readinessId, staffName, notes);
    if (!result) {
      showFeedback('error', 'Action notes are required before placing inventory accounting on hold.');
      return;
    }
    await refreshInventoryAccounting(selectedInventoryAccounting.readinessId);
    showFeedback('warning', `${selectedInventoryAccounting.readinessNumber} placed on hold.`);
  };

  const handleInventoryAccountingReject = async (notes: string) => {
    if (!selectedInventoryAccounting || !ensureInventoryAccountingPermission('inventoryAccounting.reject')) {
      return;
    }
    const result = await rejectInventoryAccountingRecord(selectedInventoryAccounting.readinessId, staffName, notes);
    if (!result) {
      showFeedback('error', 'Action notes are required before rejecting inventory accounting readiness.');
      return;
    }
    await refreshInventoryAccounting(selectedInventoryAccounting.readinessId);
    showFeedback('warning', `${selectedInventoryAccounting.readinessNumber} rejected locally.`);
  };

  const handleInventoryAccountingMarkPosted = async (notes: string) => {
    if (!selectedInventoryAccounting || !ensureInventoryAccountingPermission('accounting.postPlaceholder')) {
      return;
    }
    await markPostedPlaceholder(selectedInventoryAccounting.readinessId, staffName, notes);
    await refreshInventoryAccounting(selectedInventoryAccounting.readinessId);
    showFeedback('success', `${selectedInventoryAccounting.readinessNumber} marked posted placeholder.`);
  };

  const handleInventoryAccountingExport = async () => {
    if (!ensureInventoryAccountingPermission('inventoryAccounting.export')) {
      return;
    }
    const result = await exportInventoryAccountingPlaceholder(inventoryAccountingFilters);
    showFeedback('success', result.message);
  };

  const eodMetrics: Array<[string, string]> = eodSession
    ? [
        ['Today Sales', money(eodSession.todaySales)],
        ['Net Receipts', money(eodSession.netReceipts)],
        ['Cash Expected', money(eodSession.cashExpected)],
        ['Cash Declared', money(eodSession.cashDeclared)],
        ['Cash Variance', money(eodSession.cashVariance)],
        ['Refunds', money(eodSession.refunds)],
        ['Voids', eodSession.voids.toString()],
        ['Open Shifts', eodSession.openShifts.toString()],
        ['Pending Stock Movements', eodSession.pendingStockMovements.toString()],
        ['Pending Deliveries', eodSession.pendingDeliveries.toString()],
        ['Critical BI Alerts', eodSession.criticalBIAlerts.toString()],
        ['Sync Pending Items', eodSession.syncPendingItems.toString()],
        ['EOD Status', eodSession.status]
      ]
    : [];

  return (
    <div className="space-y-5 font-mono text-xs text-[#111827] select-none pb-12">
      <div className="industrial-section p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <div className="text-[9px] font-black text-orange-600 uppercase tracking-widest">Owner Desk</div>
          <h1 className="text-base font-black text-[#1e222b] uppercase flex items-center gap-2 mt-1">
            <BarChart3 className="w-5 h-5 text-orange-500" />
            EOD Reconciliation and Day Closing Control
          </h1>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2 text-[10px] text-slate-700">
            <span><strong>Business / Vendor:</strong> <span className="font-bold text-[#1e222b]">{vendorName}</span></span>
            <span><strong>Business Date:</strong> <span className="font-bold text-[#1e222b]">{businessDate}</span></span>
            <span><strong>Status:</strong> <Badge value={eodSession?.status || 'Blocked'} /></span>
            <span><strong>Last Check:</strong> <span className="font-bold text-[#1e222b]">{timeOnly(eodSession?.lastCheckTime)}</span></span>
            <span><strong>Owner Access:</strong> <span className="industrial-status-badge">Full Build Access</span></span>
          </div>
        </div>
        <div className="industrial-card p-3 text-[10px] uppercase font-black min-w-[190px]">
          <span className="block text-slate-600">Day Lock Status</span>
          <span className="industrial-status-badge mt-1">Lock Allowed: {failedChecks === 0 && blockingReasons.length === 0 ? 'Yes' : 'No'}</span>
        </div>
      </div>

      {feedback && (
        <div className={`p-4 border-l-4 flex items-start gap-3 ${
          feedback.type === 'success'
            ? 'bg-emerald-50 border-l-emerald-600 border border-emerald-200 text-emerald-900'
            : feedback.type === 'warning'
            ? 'bg-amber-50 border-l-amber-500 border border-amber-200 text-amber-900'
            : 'bg-rose-50 border-l-rose-600 border border-rose-200 text-rose-900'
        }`}>
          {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
          <div>
            <span className="font-black uppercase text-[10px] block">Owner Desk Notice</span>
            <span className="font-semibold">{feedback.message}</span>
          </div>
        </div>
      )}

      <div className="owner-desk-tabbar">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`owner-desk-tab ${
              activeTab === tab
                ? 'owner-desk-tab--active'
                : ''
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Owner Summary' && (
        <div className="space-y-5">
          <MetricGrid metrics={[
            ['Today Sales', ownerSummary?.todaySales || money(1245)],
            ['Cash Expected', ownerSummary?.cashExpected || money(760)],
            ['Cash Declared', ownerSummary?.cashDeclared || money(755)],
            ['Cash Variance', ownerSummary?.cashVariance || money(-5)],
            ['Open Approvals', ownerSummary?.openApprovals.toString() || '6'],
            ['Pending Sync Items', ownerSummary?.pendingSyncItems.toString() || '23'],
            ['Completed Deliveries', ownerSummary?.completedDeliveries.toString() || '9'],
            ['EOD Status', eodSession?.status || 'Blocked']
          ]} />
          <Panel title="Owner Control Summary" icon={<ShieldAlert className="w-4 h-4 text-orange-500" />}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <InfoBox label="Access Scope" value="Owner full access during build-development" />
              <InfoBox label="Tenant Scope" value="Owner Desk local EOD control only" />
              <InfoBox label="Data Source" value="Mock/local EOD data only" />
            </div>
          </Panel>
        </div>
      )}

      {activeTab === 'EOD Reconciliation' && (
        <div className="space-y-5">
          <Filters branch={branch} setBranch={setBranch} dateFrom={dateFrom} setDateFrom={setDateFrom} dateTo={dateTo} setDateTo={setDateTo} />
          <MetricGrid metrics={eodMetrics} />
          <Panel title="EOD Readiness Checklist" icon={<ClipboardCheck className="w-4 h-4 text-orange-500" />}>
            <OwnerDeskFilterBar
              search={eodSearch}
              onSearch={setEodSearch}
              filters={[
                { label: 'Status', value: eodStatusFilter, options: ['All', 'Passed', 'Warning', 'Failed', 'Pending'], onChange: setEodStatusFilter },
                { label: 'Risk', value: eodRiskFilter, options: ['All', 'Low', 'Medium', 'High', 'Critical'], onChange: setEodRiskFilter }
              ]}
              activeCount={[eodSearch, eodStatusFilter !== 'All' ? eodStatusFilter : '', eodRiskFilter !== 'All' ? eodRiskFilter : ''].filter(Boolean).length}
              onClear={() => { setEodSearch(''); setEodStatusFilter('All'); setEodRiskFilter('All'); }}
            />
            <div className="owner-desk-scroll-body pos-custom-scroll">
              <table className="owner-desk-table">
              <thead><tr><th>Area / Check</th><th>Status</th><th>Risk</th><th>Required Action</th><th>Owner Decision</th><th>Last Checked</th><th>Action</th></tr></thead>
              <tbody>
                {filteredChecklist.map((item) => {
                  const fields = checklistFields(item, eodSession?.lastCheckTime);
                  const title = item.check || item.label || item.id;
                  return (
                  <tr key={item.id}>
                    <td><strong>{title}</strong><span>{item.domain || 'EOD'}</span></td>
                    <td><Badge value={item.status} /></td>
                    <td><Badge value={item.risk || 'Low'} risk /></td>
                    <td className="owner-desk-wrap-cell">{item.requiredAction || item.ownerAction || 'None'}</td>
                    <td>{item.reviewedBy || item.notes || 'Pending owner decision'}</td>
                    <td>{timeOnly(eodSession?.lastCheckTime)}</td>
                    <td className="owner-desk-row-actions">
                      <OwnerDeskRowActionMenu
                        id={`eod-${item.id}`}
                        openId={openOwnerActionMenuId}
                        setOpenId={setOpenOwnerActionMenuId}
                        ariaLabel={`EOD readiness actions for ${title}`}
                        items={[
                          { label: 'View Check Detail', icon: <Eye className="w-3.5 h-3.5" />, onClick: () => void openOwnerActionModal({ domain: 'EOD Readiness', mode: 'detail', rowId: item.id, title, fields, note: item.notes }) },
                          hasCashPermission('ownerDesk.eodReconciliation.manage') && { label: 'Mark Ready', icon: <CheckCircle2 className="w-3.5 h-3.5" />, onClick: () => void handleOwnerMarkReviewed('EOD Readiness', item.id, title) },
                          hasCashPermission('ownerDesk.eodReconciliation.manage') && { label: 'Mark Not Ready', icon: <AlertTriangle className="w-3.5 h-3.5" />, onClick: () => void openOwnerActionModal({ domain: 'EOD Readiness', mode: 'notReady', rowId: item.id, title, fields, note: item.notes }) },
                          hasCashPermission('ownerDesk.eodReconciliation.manage') && { label: 'Add Owner Note', icon: <StickyNote className="w-3.5 h-3.5" />, onClick: () => void openOwnerActionModal({ domain: 'EOD Readiness', mode: 'note', rowId: item.id, title, fields, note: item.notes }) },
                          hasCashPermission('ownerDesk.createBIWarning') && { label: 'Create BI Warning', icon: <Flag className="w-3.5 h-3.5" />, onClick: () => void handleOwnerPlaceholderEvent('EOD Readiness', 'EOD_READINESS_BI_WARNING_CREATED', title) },
                          hasCashPermission('ownerDesk.createTask') && { label: 'Create Follow-up Task', icon: <ClipboardCheck className="w-3.5 h-3.5" />, onClick: () => void handleOwnerPlaceholderEvent('EOD Readiness', 'EOD_READINESS_TASK_CREATED', title) },
                          hasCashPermission('ownerDesk.escalate') && { label: 'Escalate to Manager', icon: <ShieldAlert className="w-3.5 h-3.5" />, onClick: () => void handleOwnerPlaceholderEvent('EOD Readiness', 'EOD_READINESS_ESCALATED', title) },
                          hasCashPermission('ownerDesk.print') && { label: 'Print Check Row', icon: <Printer className="w-3.5 h-3.5" />, onClick: () => void handleOwnerPrint('EOD Readiness', title, fields, 'EOD_READINESS_PRINTED') },
                          hasCashPermission('ownerDesk.export') && { label: 'Export Row', icon: <Download className="w-3.5 h-3.5" />, onClick: () => void handleOwnerExport('EOD Readiness', title, fields, 'EOD_READINESS_EXPORTED') }
                        ]}
                      />
                    </td>
                  </tr>
                );})}
              </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}

      {activeTab === 'Payment Summary' && (
        <div className="space-y-5">
          <PaymentFilters branch={branch} setBranch={setBranch} terminal={terminal} setTerminal={setTerminal} cashier={cashier} setCashier={setCashier} dateFrom={dateFrom} setDateFrom={setDateFrom} dateTo={dateTo} setDateTo={setDateTo} paymentMode={paymentMode} setPaymentMode={setPaymentMode} />
          <MetricGrid metrics={[
            ['Cash', money(750)], ['EcoCash', money(320)], ['Swipe', money(215)], ['Bank Transfer', money(460)], ['Split Payment', money(200)], ['Credit Sale', money(90)], ['Store Credit', money(42)], ['Refunds', money(10)], ['Net Receipts', money(1227)]
          ]} />
          <Panel title="Payment Mode Summary" icon={<DollarSign className="w-4 h-4 text-orange-500" />}>
            <OwnerDeskFilterBar
              search={paymentSearch}
              onSearch={setPaymentSearch}
              filters={[
                { label: 'Status', value: paymentStatusFilter, options: ['All', 'Balanced', 'Variance', 'Review'], onChange: setPaymentStatusFilter },
                { label: 'Variance', value: paymentVarianceFilter, options: ['All', 'Balanced', 'Variance'], onChange: setPaymentVarianceFilter }
              ]}
              activeCount={[paymentSearch, paymentStatusFilter !== 'All' ? paymentStatusFilter : '', paymentVarianceFilter !== 'All' ? paymentVarianceFilter : ''].filter(Boolean).length}
              onClear={() => { setPaymentSearch(''); setPaymentStatusFilter('All'); setPaymentVarianceFilter('All'); }}
            />
            <div className="owner-desk-scroll-body pos-custom-scroll">
              <table className="owner-desk-table owner-desk-table--payments">
              <thead><tr><th>Payment Mode</th><th>Count</th><th>Gross</th><th>Refunds</th><th>Net</th><th>Drawer Impact</th><th>Reconciled</th><th>Variance</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {filteredPayments.map((row) => {
                  const fields = paymentFields(row);
                  const title = `${row.paymentMode} payment summary`;
                  return (
                  <tr key={row.id}>
                    <td><strong>{row.paymentMode}</strong><span>Source transactions: {row.receiptCount}</span></td>
                    <td className="owner-desk-num">{row.receiptCount}</td>
                    <td className="owner-desk-num">{money(row.grossAmount)}</td>
                    <td className="owner-desk-num">{money(row.refunds)}</td>
                    <td className="owner-desk-num">{money(row.netAmount)}</td>
                    <td className="owner-desk-num">{money(row.expectedSettlement)}</td>
                    <td>{displayAmount(row.declaredOrConfirmed)}</td>
                    <td className="owner-desk-num">{displayAmount(row.variance)}</td>
                    <td><Badge value={row.status} /></td>
                    <td className="owner-desk-row-actions">
                      <OwnerDeskRowActionMenu
                        id={`payment-${row.id}`}
                        openId={openOwnerActionMenuId}
                        setOpenId={setOpenOwnerActionMenuId}
                        ariaLabel={`Payment summary actions for ${row.paymentMode}`}
                        items={[
                          { label: 'View Payment Detail', icon: <Eye className="w-3.5 h-3.5" />, onClick: () => void openOwnerActionModal({ domain: 'Payment Summary', mode: 'detail', rowId: row.id, title, fields }) },
                          hasCashPermission('ownerDesk.paymentSummary.manage') && { label: 'Mark Reviewed', icon: <CheckCircle2 className="w-3.5 h-3.5" />, onClick: () => void handleOwnerMarkReviewed('Payment Summary', row.id, title) },
                          hasCashPermission('ownerDesk.paymentSummary.manage') && { label: 'Reconcile Mode', icon: <DollarSign className="w-3.5 h-3.5" />, onClick: () => void openOwnerActionModal({ domain: 'Payment Summary', mode: 'reconcile', rowId: row.id, title, fields }) },
                          hasCashPermission('ownerDesk.paymentSummary.manage') && { label: 'Add Owner Note', icon: <StickyNote className="w-3.5 h-3.5" />, onClick: () => void openOwnerActionModal({ domain: 'Payment Summary', mode: 'note', rowId: row.id, title, fields }) },
                          hasCashPermission('ownerDesk.createBIWarning') && { label: 'Create BI Warning', icon: <Flag className="w-3.5 h-3.5" />, onClick: () => void handleOwnerPlaceholderEvent('Payment Summary', 'PAYMENT_MODE_BI_WARNING_CREATED', title) },
                          hasCashPermission('ownerDesk.print') && { label: 'Print Summary', icon: <Printer className="w-3.5 h-3.5" />, onClick: () => void handleOwnerPrint('Payment Summary', title, fields, 'PAYMENT_MODE_PRINTED') },
                          hasCashPermission('ownerDesk.export') && { label: 'Export Row', icon: <Download className="w-3.5 h-3.5" />, onClick: () => void handleOwnerExport('Payment Summary', title, fields, 'PAYMENT_MODE_EXPORTED') },
                          { label: 'Open Source Transactions', icon: <FileText className="w-3.5 h-3.5" />, onClick: () => void openOwnerActionModal({ domain: 'Payment Summary', mode: 'detail', rowId: row.id, title: `${row.paymentMode} source transactions`, fields: [...fields, ['Mock Source', `${row.receiptCount} local transaction(s) prepared for review`]] }) }
                        ]}
                      />
                    </td>
                  </tr>
                );})}
              </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}

      {activeTab === 'Cash Reconciliation' && (
        <Panel title="Cash Drawer Reconciliation" icon={<DollarSign className="w-4 h-4 text-orange-500" />}>
          <CashFilters branch={branch} setBranch={setBranch} terminal={terminal} setTerminal={setTerminal} cashier={cashier} setCashier={setCashier} />
          <div className="owner-cash-table-scroll pos-custom-scroll">
            <table className="owner-cash-table">
              <thead>
                <tr>
                  <th className="owner-cash-col-terminal">Terminal</th>
                  <th className="owner-cash-col-cashier">Cashier</th>
                  <th className="owner-cash-col-shift">Shift</th>
                  <th className="owner-cash-col-money">Opening</th>
                  <th className="owner-cash-col-money">Sales</th>
                  <th className="owner-cash-col-money">Cash In</th>
                  <th className="owner-cash-col-money">Cash Out</th>
                  <th className="owner-cash-col-money">Expected</th>
                  <th className="owner-cash-col-money">Declared</th>
                  <th className="owner-cash-col-money">Variance</th>
                  <th className="owner-cash-col-status">Status</th>
                  <th className="owner-cash-col-required">Required Action</th>
                  <th className="owner-cash-col-action">Action</th>
                </tr>
              </thead>
              <tbody>
                {cashRows.map((row) => (
                  <tr key={row.id}>
                    <td><strong>{row.terminal}</strong><span>{row.branch}</span></td>
                    <td>{row.cashier}</td>
                    <td>{row.shiftId}</td>
                    <td className="owner-cash-num">{money(row.openingFloat)}</td>
                    <td className="owner-cash-num">{money(row.cashSales)}</td>
                    <td className="owner-cash-num">{money(row.cashIn)}</td>
                    <td className="owner-cash-num">{money(row.cashOut)}</td>
                    <td className="owner-cash-num">{money(row.expectedCash)}</td>
                    <td className="owner-cash-num">{money(row.declaredCash)}</td>
                    <td className={`owner-cash-num ${row.variance !== 0 ? 'owner-cash-variance' : ''}`}>{money(row.variance)}</td>
                    <td><Badge value={row.status} /></td>
                    <td className="owner-cash-required">{row.requiredAction}{row.ownerNote ? <span>Note: {row.ownerNote}</span> : null}</td>
                    <td className="owner-cash-actions">
                      <CashActionGroup
                        row={row}
                        open={openCashMenuId === row.id}
                        onOpenChange={(open) => setOpenCashMenuId(open ? row.id : null)}
                        can={(permission) => hasCashPermission(permission)}
                        onReviewVariance={() => void openCashModal('review', row)}
                        onMarkBalanced={() => void openCashModal('markBalanced', row)}
                        onAddNote={() => void openCashModal('note', row)}
                        onDetail={() => void openCashModal('detail', row)}
                        onPrint={() => void handleCashPrint(row)}
                        onExport={() => void handleCashExport(row)}
                        onBIWarning={() => void handleCashPlaceholderAction('CASH_RECONCILIATION_BI_WARNING_CREATED', `BI advice CASH_RECONCILIATION_VARIANCE_OWNER_REVIEW created locally for ${row.terminal} / ${row.shiftId}.`)}
                        onEscalate={() => void handleCashPlaceholderAction('CASH_RECONCILIATION_ESCALATED', `Manager escalation task created locally for ${row.terminal} / ${row.shiftId}.`)}
                        onShiftDetail={() => void openCashModal('shift', row)}
                        onMovements={() => void openCashModal('movements', row)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {activeTab === 'Shift Closing' && (
        <Panel title="Shift Closing Review" icon={<Users className="w-4 h-4 text-orange-500" />}>
          <OwnerDeskFilterBar search={shiftSearch} onSearch={setShiftSearch} filters={[]} activeCount={shiftSearch ? 1 : 0} onClear={() => setShiftSearch('')} />
          <Table>
            <thead><tr><Th>Shift ID</Th><Th>Branch</Th><Th>Terminal</Th><Th>Staff</Th><Th>Opened At</Th><Th>Closed At</Th><Th>Status</Th><Th>Sales Total</Th><Th>Expected Cash</Th><Th>Declared Cash</Th><Th>Variance</Th><Th>Sync Status</Th><Th>Action</Th></tr></thead>
            <tbody>
              {filteredShifts.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <Td strong>{row.shiftId}</Td><Td>{row.branch}</Td><Td>{row.terminal}</Td><Td>{row.staff}</Td><Td>{timeOnly(row.openedAt)}</Td><Td>{timeOnly(row.closedAt)}</Td><Td><Badge value={row.status} /></Td><Td>{money(row.salesTotal)}</Td><Td>{money(row.expectedCash)}</Td><Td>{displayAmount(row.declaredCash)}</Td><Td>{displayAmount(row.variance)}</Td><Td><Badge value={row.syncStatus} /></Td>
                  <Td><ShiftActionGroup id={row.id} shiftId={row.shiftId} openId={openOwnerActionMenuId} setOpenId={setOpenOwnerActionMenuId} onReview={handleMarkReviewed} onForceClose={handleActivityOnly} /></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>
      )}

      {activeTab === 'Inventory Closing' && (
        <div className="space-y-5">
          <MetricGrid metrics={[
            ['Sale Movements', '8'], ['Return Movements', '1'], ['Goods Received', '4'], ['Stock Adjustments', '2'], ['Stocktake Adjustments', '1'], ['Transfers', '2'], ['Supplier Returns', '1'], ['Pending Approval Movements', '3'], ['High Risk Movements', '3']
          ]} />
          <Panel title="Inventory Movement Closing" icon={<PackageCheck className="w-4 h-4 text-orange-500" />}>
            <OwnerDeskFilterBar search={inventorySearch} onSearch={setInventorySearch} filters={[]} activeCount={inventorySearch ? 1 : 0} onClear={() => setInventorySearch('')} />
            <Table>
              <thead><tr><Th>Movement ID</Th><Th>Product</Th><Th>Movement Type</Th><Th>Reference</Th><Th>Branch</Th><Th>Warehouse</Th><Th>Qty In</Th><Th>Qty Out</Th><Th>Status</Th><Th>Risk</Th><Th>Required Action</Th><Th>Action</Th></tr></thead>
              <tbody>
                {filteredInventoryRows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <Td strong>{row.movementId}</Td><Td>{row.product}</Td><Td>{row.movementType}</Td><Td>{row.reference}</Td><Td>{row.branch}</Td><Td>{row.warehouse}</Td><Td>{row.qtyIn}</Td><Td>{row.qtyOut}</Td><Td><Badge value={row.status} /></Td><Td><Badge value={row.risk} risk /></Td><Td>{row.requiredAction}</Td><Td><InventoryActionGroup id={row.id} openId={openOwnerActionMenuId} setOpenId={setOpenOwnerActionMenuId} onReview={handleMarkReviewed} onAction={(message) => void handleOwnerPlaceholderEvent('Inventory Closing', 'OWNER_DESK_PLACEHOLDER_VIEWED', message)} /></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Panel>
        </div>
      )}

      {activeTab === 'Delivery Closing' && (
        <Panel title="Delivery Closing Review" icon={<Truck className="w-4 h-4 text-orange-500" />}>
          <OwnerDeskFilterBar search={deliverySearch} onSearch={setDeliverySearch} filters={[]} activeCount={deliverySearch ? 1 : 0} onClear={() => setDeliverySearch('')} />
          <Table>
            <thead><tr><Th>Delivery ID</Th><Th>Receipt</Th><Th>Customer</Th><Th>Delivery Method</Th><Th>Driver</Th><Th>Delivery Status</Th><Th>Code Status</Th><Th>Completed At</Th><Th>Risk</Th><Th>Required Action</Th><Th>Action</Th></tr></thead>
            <tbody>
              {filteredDeliveryRows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <Td strong>{row.deliveryId}</Td><Td>{row.receipt}</Td><Td>{row.customer}</Td><Td>{row.deliveryMethod}</Td><Td>{row.driver}</Td><Td><Badge value={row.status} /></Td><Td><Badge value={row.secretCodeStatus} /></Td><Td>{timeOnly(row.completedAt)}</Td><Td><Badge value={row.risk} risk /></Td><Td>{row.requiredAction}</Td><Td><DeliveryActionGroup id={row.id} openId={openOwnerActionMenuId} setOpenId={setOpenOwnerActionMenuId} onReview={handleMarkReviewed} onAction={(message) => void handleOwnerPlaceholderEvent('Delivery Closing', 'OWNER_DESK_PLACEHOLDER_VIEWED', message)} /></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>
      )}

      {activeTab === 'BI Review' && (
        <Panel title="BI Risk Review" icon={<ShieldAlert className="w-4 h-4 text-orange-500" />}>
          <OwnerDeskFilterBar search={biSearch} onSearch={setBISearch} filters={[]} activeCount={biSearch ? 1 : 0} onClear={() => setBISearch('')} />
          <Table>
            <thead><tr><Th>BI Event</Th><Th>Domain</Th><Th>Severity</Th><Th>Description</Th><Th>Recommended Action</Th><Th>Status</Th><Th>Reviewed By</Th><Th>Action</Th></tr></thead>
            <tbody>
              {filteredBIRows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <Td strong>{row.eventType}</Td><Td>{row.domain}</Td><Td><Badge value={row.severity} risk /></Td><Td>{row.description}</Td><Td>{row.recommendedAction}</Td><Td><Badge value={row.status} /></Td><Td>{row.reviewedBy || 'Pending'}</Td><Td><BIActionGroup id={row.id} openId={openOwnerActionMenuId} setOpenId={setOpenOwnerActionMenuId} onReview={handleMarkReviewed} onAction={(message) => void handleOwnerPlaceholderEvent('BI Review', 'OWNER_DESK_PLACEHOLDER_VIEWED', message)} /></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>
      )}

      {activeTab === 'Accounting Desk' && (
        <div className="space-y-5">
          <div className="pos-page-action-menu pos-compact-tab-row">
            {accountingTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveAccountingTab(tab)}
                className={`pos-page-action-tab pos-owner-tab ${
                  activeAccountingTab === tab
                    ? 'pos-page-action-tab-active'
                    : ''
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <MetricGrid metrics={[
            ['Financial Control Mapping', financialMappingStatus.missing === 0 ? 'Ready' : `${financialMappingStatus.missing} unmapped`],
            ['Free Usable Cash', financialControlSummary ? money(financialControlSummary.freeUsableCash) : 'Loading'],
            ['Protected Reserves', financialControlSummary ? money(financialControlSummary.lessCOGSReserve + financialControlSummary.lessVATReserve + financialControlSummary.lessCustomerDeposits) : 'Loading'],
            ['Net Control Position', financialControlSummary ? money(financialControlSummary.netControlPosition) : 'Loading']
          ]} />

          {activeAccountingTab === 'COA Accounts' && (
            <div className="space-y-5">
              <Panel title="New COA Account" icon={<ClipboardCheck className="w-4 h-4 text-orange-500" />}>
                <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
                  <Input label="Account Code" value="New Code" onChange={() => undefined} />
                  <Input label="Account Name" value="New Account Draft" onChange={() => undefined} />
                  <Select label="Account Type" value="Asset" onChange={() => undefined} options={accountTypes} />
                  <Input label="Linked Domain" value="Sales" onChange={() => undefined} />
                  <Select label="Status" value="Draft" onChange={() => undefined} options={['Active', 'Inactive', 'Draft']} />
                  <Input label="Notes" value="Local account note" onChange={() => undefined} />
                  <ActionButton icon={<ClipboardCheck className="w-4 h-4" />} onClick={handleCreatePostingPlaceholder}>Add New COA Account</ActionButton>
                </div>
              </Panel>
              <Panel title="Chart of Accounts" icon={<DollarSign className="w-4 h-4 text-orange-500" />}>
                <div className="owner-desk-scroll-body pos-custom-scroll">
                  <table className="owner-desk-table coa-account-table">
                  <thead><tr><th>Account Code</th><th>Account Name</th><th>Account Type</th><th>Linked Domain</th><th>Status</th><th>Action</th></tr></thead>
                  <tbody>
                    {coaAccounts.map((account) => (
                      <tr key={account.id}>
                        <td><strong>{account.accountCode}</strong></td>
                        <td className="owner-desk-wrap-cell">{account.accountName}<span>{account.notes || 'Accounting readiness placeholder'}</span></td>
                        <td>{account.accountType}</td>
                        <td>{account.linkedDomain}</td>
                        <td><Badge value={account.status} /></td>
                        <td className="owner-desk-row-actions">
                          <COAAccountActionMenu
                            account={account}
                            openId={openCOAMenuId}
                            setOpenId={setOpenCOAMenuId}
                            can={(permission) => hasCashPermission(permission)}
                            onView={() => void openCOAModal(account, 'detail')}
                            onEditDraft={() => void openCOAModal(account, 'edit')}
                            onViewMapping={() => void openCOAModal(account, 'detail')}
                            onMarkInactive={() => void openCOAModal(account, 'inactive')}
                            onReactivate={() => void openCOAModal(account, 'reactivate')}
                            onReplacement={() => void handleCOACreateReplacement(account)}
                            onAddNote={() => void openCOAModal(account, 'note')}
                            onPrint={() => void handleCOAPrint(account)}
                            onExport={() => void handleCOAExport(account)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  </table>
                </div>
              </Panel>
            </div>
          )}

          {activeAccountingTab === 'Sales Posting' && (
            <div className="space-y-5">
              <AccountingFilters branch={branch} setBranch={setBranch} terminal={terminal} setTerminal={setTerminal} cashier={cashier} setCashier={setCashier} dateFrom={dateFrom} setDateFrom={setDateFrom} dateTo={dateTo} setDateTo={setDateTo} />
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <Select label="Sales Account" value={salesAccount} onChange={setSalesAccount} options={['All Sales Accounts', '4000', '4010', '4020', '9000']} />
                <ActionButton icon={<Download className="w-4 h-4" />} onClick={() => handleAccountingExport('Sales Posting')}>Export Sales Posting</ActionButton>
              </div>
              <MetricGrid metrics={[
                ['Gross Sales', money(sum(salesAccountingRows, 'grossSale'))],
                ['Discounts', money(sum(salesAccountingRows, 'discount'))],
                ['Refunds', money(10)],
                ['Voids', '1'],
                ['Net Sales', money(sum(salesAccountingRows, 'netSale'))],
                ['VAT Output Control', money(sum(salesAccountingRows, 'vat'))],
                ['COGS Readiness', money(164.5)],
                ['Gross Profit Preview', money(1062.5)]
              ]} />
              <Panel title="Sales Posting Summary" icon={<DollarSign className="w-4 h-4 text-orange-500" />}>
                <OwnerDeskFilterBar search={accountingSearch} onSearch={setAccountingSearch} filters={[]} activeCount={accountingSearch ? 1 : 0} onClear={() => setAccountingSearch('')} />
                <Table>
                  <thead><tr><Th>Receipt No.</Th><Th>Date / Time</Th><Th>Branch</Th><Th>Terminal</Th><Th>Cashier</Th><Th>Gross Sale</Th><Th>Discount</Th><Th>VAT</Th><Th>Net Sale</Th><Th>Sales Account</Th><Th>Posting Status</Th><Th>Action</Th></tr></thead>
                  <tbody>
                    {filteredSalesAccountingRows.map((row) => (
                      <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50">
                        <Td strong>{row.receiptNo}</Td><Td>{timeOnly(row.dateTime)}</Td><Td>{row.branch}</Td><Td>{row.terminal}</Td><Td>{row.cashier}</Td><Td>{money(row.grossSale)}</Td><Td>{money(row.discount)}</Td><Td>{money(row.vat)}</Td><Td>{money(row.netSale)}</Td><Td>{row.salesAccount}</Td><Td><Badge value={row.postingStatus} /></Td>
                        <Td><AccountingDeskRowActionMenu tab="Sales Posting" rowId={row.id} title={row.receiptNo} fields={salesPostingFields(row)} openId={openAccountingDeskMenuId} setOpenId={setOpenAccountingDeskMenuId} can={hasCashPermission} onOpen={openAccountingDeskAction} onAction={handleAccountingDeskAction} /></Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Panel>
            </div>
          )}

          {activeAccountingTab === 'Payment Posting' && (
            <Panel title="Payment Posting Summary" icon={<DollarSign className="w-4 h-4 text-orange-500" />}>
              <div className="mb-3 text-[10px] text-slate-500 uppercase tracking-wider">Accounting readiness preview only. Not final posted accounts.</div>
              <OwnerDeskFilterBar
                search={accountingSearch}
                onSearch={setAccountingSearch}
                activeCount={paymentPostingActiveFilters}
                onClear={clearPaymentPostingFilters}
                filters={[
                  { label: 'Payment Mode', value: paymentPostingModeFilter, options: paymentModeOptions, onChange: setPaymentPostingModeFilter },
                  { label: 'Settlement Status', value: paymentSettlementFilter, options: paymentSettlementStatuses, onChange: setPaymentSettlementFilter },
                  { label: 'Posting Status', value: paymentPostingStatusFilter, options: postingStatuses, onChange: setPaymentPostingStatusFilter },
                  { label: 'Control Account', value: paymentControlAccountFilter, options: paymentControlAccountOptions, onChange: setPaymentControlAccountFilter },
                  { label: 'Variance Status', value: paymentVarianceStatusFilter, options: varianceStatuses, onChange: setPaymentVarianceStatusFilter }
                ]}
              />
              <div className="owner-desk-filter-row owner-desk-filter-row--compact">
                <Input label="Min Amount" value={paymentMinAmount} onChange={setPaymentMinAmount} />
                <Input label="Max Amount" value={paymentMaxAmount} onChange={setPaymentMaxAmount} />
              </div>
              <div className="owner-desk-scroll-body owner-desk-scroll-body--tall pos-custom-scroll">
                <table className="industrial-table owner-payment-posting-table">
                  <thead><tr><Th>Payment Mode</Th><Th>Receipts</Th><Th>Gross Amount</Th><Th>Refunds</Th><Th>Net Amount</Th><Th>Control Account</Th><Th>Settlement Status</Th><Th>Variance</Th><Th>Posting Status</Th><Th>Action</Th></tr></thead>
                  <tbody>
                    {filteredPaymentAccountingRows.map((row) => (
                      <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50">
                        <Td strong>{row.paymentMode}</Td>
                        <Td>{row.receiptCount}</Td>
                        <Td>{money(row.grossAmount)}</Td>
                        <Td>{money(row.refunds)}</Td>
                        <Td>{money(row.netAmount)}</Td>
                        <Td><span className="owner-desk-wrap-cell">{cleanPaymentPostingLabel(row.controlAccount)}</span></Td>
                        <Td><Badge value={row.settlementStatus} /></Td>
                        <Td>{displayAmount(row.variance)}</Td>
                        <Td><Badge value={row.postingStatus} /></Td>
                        <Td>
                          <PaymentPostingActionMenu
                            row={row}
                            openId={openPaymentPostingMenuId}
                            setOpenId={setOpenPaymentPostingMenuId}
                            can={canPaymentPosting}
                            onSettle={() => void openPaymentPostingModal('settle', row)}
                            onReceipts={() => void openPaymentPostingModal('receipts', row)}
                            onVariance={() => void openPaymentPostingModal('variance', row)}
                            onDetail={() => void openPaymentPostingModal('detail', row)}
                            onNote={() => void openPaymentPostingModal('note', row)}
                            onBI={() => void openPaymentPostingModal('bi', row)}
                            onTask={() => void openPaymentPostingModal('task', row)}
                            onPrint={() => void handlePaymentPrint(row)}
                            onExport={() => void handlePaymentExport(row)}
                          />
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          {activeAccountingTab === 'Cashbook' && (
            <div className="space-y-5">
              <div className="bg-white border-2 border-[#b1b5c2] p-3 grid grid-cols-1 md:grid-cols-4 xl:grid-cols-7 gap-2">
                <InfoBox label="Business / Vendor" value="Demo Vendor" />
                <Select label="Branch" value={branch} onChange={setBranch} options={branches} />
                <Select label="Terminal" value={terminal} onChange={setTerminal} options={terminals} />
                <Select label="Cashier" value={cashier} onChange={setCashier} options={cashiers} />
                <Select label="Cash Account" value={cashAccount} onChange={setCashAccount} options={['All Cash Accounts', '1000', '6000', '9010']} />
                <Select label="Movement Type" value={movementType} onChange={setMovementType} options={cashMovementTypes} />
                <Input label="Date From" value={dateFrom} onChange={setDateFrom} />
                <Input label="Date To" value={dateTo} onChange={setDateTo} />
              </div>
              <Panel title="Cashbook Movements" icon={<DollarSign className="w-4 h-4 text-orange-500" />}>
                <Table>
                  <thead><tr><Th>Date / Time</Th><Th>Branch</Th><Th>Terminal</Th><Th>Staff</Th><Th>Movement Type</Th><Th>Reference</Th><Th>Cash In</Th><Th>Cash Out</Th><Th>Balance After</Th><Th>Account</Th><Th>Status</Th><Th>Notes</Th><Th>Action</Th></tr></thead>
                  <tbody>
                    {cashbookRows.map((row) => (
                      <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50">
                        <Td strong>{timeOnly(row.dateTime)}</Td><Td>{cleanPaymentPostingLabel(row.account)}</Td><Td>{row.movementType}</Td><Td>{row.reference}</Td><Td>{money(row.cashIn)}</Td><Td>{money(row.cashOut)}</Td><Td>{money(row.balanceAfter)}</Td><Td>{row.status === 'Posted' ? 'Yes' : 'Pending'}</Td><Td><Badge value={row.status} /></Td><Td><AccountingDeskRowActionMenu tab="Cashbook" rowId={row.id} title={row.reference} fields={cashbookFields(row)} openId={openAccountingDeskMenuId} setOpenId={setOpenAccountingDeskMenuId} can={hasCashPermission} onOpen={openAccountingDeskAction} onAction={handleAccountingDeskAction} /></Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Panel>
            </div>
          )}

          {activeAccountingTab === 'VAT Summary' && (
            <div className="space-y-5">
              <div className="bg-white border-2 border-[#b1b5c2] p-3 grid grid-cols-1 md:grid-cols-5 gap-2">
                <InfoBox label="Business / Vendor" value="Demo Vendor" />
                <Select label="Branch" value={branch} onChange={setBranch} options={branches} />
                <Input label="Date From" value={dateFrom} onChange={setDateFrom} />
                <Input label="Date To" value={dateTo} onChange={setDateTo} />
                <Select label="VAT Mode" value={vatMode} onChange={setVATMode} options={vatModes} />
              </div>
              <MetricGrid metrics={[
                ['Gross VATable Sales', money(sum(vatRows, 'vatableAmount'))],
                ['VAT Output Control', money(sum(vatRows, 'vatAmount'))],
                ['Non-VAT Sales', money(0)],
                ['Refund VAT Impact', money(10.5)],
                ['Net VAT Output Preview', money(Math.max(sum(vatRows, 'vatAmount') - 10.5, 0))],
                ['VAT Registration Status', 'Tax-ready preview']
              ]} />
              <Panel title="VAT Summary" icon={<ShieldAlert className="w-4 h-4 text-orange-500" />}>
                <div className="mb-3 bg-orange-50 border border-orange-200 text-orange-900 p-3 text-[10px] font-bold">
                  This POS is tax-ready, but fiscalization and official tax submission will be connected later.
                </div>
                <Table>
                  <thead><tr><Th>Date</Th><Th>Source</Th><Th>Reference</Th><Th>Tax Type</Th><Th>Taxable Amount</Th><Th>VAT Amount</Th><Th>Control Account</Th><Th>Status</Th><Th>Action</Th></tr></thead>
                  <tbody>
                    {vatRows.map((row) => (
                      <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50">
                        <Td strong>{row.date}</Td><Td>Sales VAT</Td><Td>{row.receiptNo}</Td><Td>{row.vatMode}</Td><Td>{money(row.vatableAmount)}</Td><Td>{money(row.vatAmount)}</Td><Td>VAT Output Control</Td><Td><Badge value={row.status} /></Td><Td><AccountingDeskRowActionMenu tab="VAT Summary" rowId={row.id} title={row.receiptNo} fields={vatFields(row)} openId={openAccountingDeskMenuId} setOpenId={setOpenAccountingDeskMenuId} can={hasCashPermission} onOpen={openAccountingDeskAction} onAction={handleAccountingDeskAction} /></Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Panel>
            </div>
          )}

          {activeAccountingTab === 'COGS Reserve' && (
            <div className="space-y-5">
              <MetricGrid metrics={[
                ['Net Sales', money(1227)],
                ['Estimated COGS', money(sum(cogsRows, 'estimatedCOGS'))],
                ['Suggested COGS Reserve', money(sum(cogsRows, 'suggestedReserve'))],
                ['Reserve Used Preview', money(0)],
                ['Reserve Misuse Risk', cogsRows.filter((row) => row.reserveStatus === 'Misuse Risk').length.toString()],
                ['Available Reserve Preview', money(sum(cogsRows, 'suggestedReserve'))]
              ]} />
              <Panel title="COGS Reserve Control" icon={<PackageCheck className="w-4 h-4 text-orange-500" />}>
                <Table>
                  <thead><tr><Th>Date</Th><Th>Movement Type</Th><Th>Source</Th><Th>Reference</Th><Th>Amount</Th><Th>Reserve Balance After</Th><Th>Control Account</Th><Th>Status</Th><Th>Action</Th></tr></thead>
                  <tbody>
                    {cogsRows.map((row) => (
                      <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50">
                        <Td strong>{businessDate}</Td><Td>{row.reserveStatus === 'Misuse Risk' ? 'Reserve Leakage' : 'COGS Reserve Movement'}</Td><Td>{row.product}</Td><Td>{row.receiptReference}</Td><Td>{money(row.estimatedCOGS)}</Td><Td>{money(row.suggestedReserve)}</Td><Td>COGS Reserve Control</Td><Td><Badge value={row.reserveStatus} /></Td><Td><AccountingDeskRowActionMenu tab="COGS Reserve" rowId={row.id} title={row.receiptReference} fields={cogsFields(row)} openId={openAccountingDeskMenuId} setOpenId={setOpenAccountingDeskMenuId} can={hasCashPermission} onOpen={openAccountingDeskAction} onAction={handleAccountingDeskAction} /></Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Panel>
            </div>
          )}

          {activeAccountingTab === 'Inventory Asset Posting' && (
            <Panel title="Inventory Asset Posting" icon={<PackageCheck className="w-4 h-4 text-orange-500" />}>
              <Table>
                <thead><tr><Th>Date</Th><Th>Movement Type</Th><Th>Product / Reference</Th><Th>Branch / Warehouse</Th><Th>Quantity</Th><Th>Value</Th><Th>Inventory Control Account</Th><Th>Status</Th><Th>Action</Th></tr></thead>
                <tbody>
                  {inventoryAssetRows.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <Td strong>{businessDate}</Td><Td>{row.movementType}</Td><Td>{row.product}<span>{row.reference}</span></Td><Td>Current Branch / Warehouse</Td><Td>{row.qtyIn - row.qtyOut}</Td><Td>{money(row.costImpact)}</Td><Td>{cleanPaymentPostingLabel(row.assetAccount)}</Td><Td><Badge value={row.postingStatus} /></Td><Td><AccountingDeskRowActionMenu tab="Inventory Asset Posting" rowId={row.id} title={row.reference} fields={inventoryAssetFields(row)} openId={openAccountingDeskMenuId} setOpenId={setOpenAccountingDeskMenuId} can={hasCashPermission} onOpen={openAccountingDeskAction} onAction={handleAccountingDeskAction} /></Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Panel>
          )}

          {activeAccountingTab === 'Inventory Accounting Readiness' && (
            <div className="space-y-5">
              <div className="bg-orange-50 border border-orange-200 text-orange-900 p-3 text-[10px] font-bold uppercase">
                Review-only inventory value readiness. This tab prepares accounting review records only; it does not post journals, update cashbook, update supplier/customer balances, or change stock quantities.
              </div>
              <MetricGrid metrics={[
                ['Pending Review', inventoryAccountingSummary.pendingReview.toString()],
                ['Reviewed', inventoryAccountingSummary.reviewed.toString()],
                ['Approved For Posting', inventoryAccountingSummary.approvedForPosting.toString()],
                ['On Hold', inventoryAccountingSummary.onHold.toString()],
                ['High Risk', inventoryAccountingSummary.highRisk.toString()],
                ['Critical', inventoryAccountingSummary.critical.toString()],
                ['Inventory Increase', money(inventoryAccountingSummary.inventoryIncreaseValue)],
                ['Inventory Decrease', money(inventoryAccountingSummary.inventoryDecreaseValue)],
                ['Write Off Value', money(inventoryAccountingSummary.writeOffValue)],
                ['Stocktake Loss', money(inventoryAccountingSummary.stocktakeLossValue)],
                ['Supplier Credit Expected', money(inventoryAccountingSummary.supplierCreditExpected)],
                ['Transfer Neutral', inventoryAccountingSummary.transferNeutral.toString()]
              ]} />
              <Panel title="Inventory Accounting Filters" icon={<RefreshCw className="w-4 h-4 text-orange-500" />}>
                <div className="grid grid-cols-1 md:grid-cols-4 xl:grid-cols-6 gap-2">
                  <Input label="Readiness Number" value={inventoryAccountingFilters.readinessNumber || ''} onChange={(value) => setInventoryAccountingFilters((current) => ({ ...current, readinessNumber: value }))} />
                  <Select label="Source Type" value={inventoryAccountingFilters.sourceType || 'ALL'} onChange={(value) => setInventoryAccountingFilters((current) => ({ ...current, sourceType: value as InventoryAccountingFilterState['sourceType'] }))} options={['ALL', 'GRN', 'Supplier Return', 'Stock Adjustment', 'Stocktake', 'Stock Transfer', 'Inventory Movement', 'Product Ledger']} />
                  <Input label="Source Number" value={inventoryAccountingFilters.sourceNumber || ''} onChange={(value) => setInventoryAccountingFilters((current) => ({ ...current, sourceNumber: value }))} />
                  <Select label="Impact Type" value={inventoryAccountingFilters.impactType || 'ALL'} onChange={(value) => setInventoryAccountingFilters((current) => ({ ...current, impactType: value as InventoryAccountingFilterState['impactType'] }))} options={['ALL', 'Inventory Asset Increase', 'Inventory Asset Decrease', 'Inventory Write Off', 'Stocktake Gain', 'Stocktake Loss', 'Supplier Return Credit Expected', 'GRN Supplier Invoice Pending', 'Transfer Neutral', 'Cost Variance Review', 'Unknown Impact Review']} />
                  <Select label="Status" value={inventoryAccountingFilters.status || 'ALL'} onChange={(value) => setInventoryAccountingFilters((current) => ({ ...current, status: value as InventoryAccountingFilterState['status'] }))} options={['ALL', 'Pending Review', 'Reviewed', 'Approved For Posting', 'Posted Preview', 'Rejected', 'On Hold', 'Reversal Requested', 'Closed']} />
                  <Select label="Risk Level" value={inventoryAccountingFilters.riskLevel || 'ALL'} onChange={(value) => setInventoryAccountingFilters((current) => ({ ...current, riskLevel: value as InventoryAccountingFilterState['riskLevel'] }))} options={['ALL', 'Low', 'Medium', 'High', 'Critical']} />
                  <Input label="Branch ID" value={inventoryAccountingFilters.branchId || ''} onChange={(value) => setInventoryAccountingFilters((current) => ({ ...current, branchId: value }))} />
                  <Input label="Warehouse ID" value={inventoryAccountingFilters.warehouseId || ''} onChange={(value) => setInventoryAccountingFilters((current) => ({ ...current, warehouseId: value }))} />
                  <Input label="Date From" value={inventoryAccountingFilters.dateFrom || ''} onChange={(value) => setInventoryAccountingFilters((current) => ({ ...current, dateFrom: value }))} />
                  <Input label="Date To" value={inventoryAccountingFilters.dateTo || ''} onChange={(value) => setInventoryAccountingFilters((current) => ({ ...current, dateTo: value }))} />
                  <ActionButton icon={<Download className="w-4 h-4" />} onClick={handleInventoryAccountingExport}>Prepare Export</ActionButton>
                </div>
              </Panel>
              <Panel title="Inventory Accounting Readiness Records" icon={<PackageCheck className="w-4 h-4 text-orange-500" />}>
                <Table>
                  <thead><tr><Th>Readiness No.</Th><Th>Source</Th><Th>Movement Type</Th><Th>Impact Type</Th><Th>Branch</Th><Th>Warehouse</Th><Th>Value Impact</Th><Th>Status</Th><Th>Risk</Th><Th>Reviewed By</Th><Th>Approved By</Th><Th>Action</Th></tr></thead>
                  <tbody>
                    {inventoryAccountingRows.map((row) => (
                      <tr key={row.readinessId} className="border-t border-slate-100 hover:bg-slate-50" onDoubleClick={() => void openInventoryAccountingRecord(row)}>
                        <Td strong>{row.readinessNumber}</Td>
                        <Td>{row.sourceType}: {row.sourceNumber}</Td>
                        <Td>{row.movementType}</Td>
                        <Td>{row.impactType}</Td>
                        <Td>{row.branchName}</Td>
                        <Td>{row.warehouseName}</Td>
                        <Td>{money(row.totalValueImpact)}</Td>
                        <Td><Badge value={row.status} /></Td>
                        <Td><Badge value={row.riskLevel} risk /></Td>
                        <Td>{row.reviewedByStaffName || 'Pending'}</Td>
                        <Td>{row.approvedByStaffName || 'Pending'}</Td>
                        <Td><AccountingDeskRowActionMenu tab="Inventory Accounting Readiness" rowId={row.readinessId} title={row.readinessNumber} fields={inventoryReadinessFields(row)} openId={openAccountingDeskMenuId} setOpenId={setOpenAccountingDeskMenuId} can={hasCashPermission} onOpen={(tab, mode, rowId, title, fields) => mode === 'detail' ? void openInventoryAccountingRecord(row) : void openAccountingDeskAction(tab, mode, rowId, title, fields)} onAction={handleAccountingDeskAction} /></Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Panel>
              <Panel title="Inventory Accounting Activity" icon={<CheckCircle2 className="w-4 h-4 text-orange-500" />}>
                <Table>
                  <thead><tr><Th>Date / Time</Th><Th>Event</Th><Th>Readiness</Th><Th>Source</Th><Th>Message</Th><Th>Staff</Th><Th>Notes</Th></tr></thead>
                  <tbody>
                    {inventoryAccountingActivity.map((event) => (
                      <tr key={event.id} className="border-t border-slate-100 hover:bg-slate-50">
                        <Td>{timeOnly(event.createdAt)}</Td>
                        <Td strong>{humanizeEventName(event.eventType)}</Td>
                        <Td>{event.readinessId || '-'}</Td>
                        <Td>{event.sourceNumber || '-'}</Td>
                        <Td>{event.message}</Td>
                        <Td>{event.staffId || '-'}</Td>
                        <Td>{event.notes || '-'}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Panel>
            </div>
          )}

          {activeAccountingTab === 'Accounting Readiness' && (
            <Panel title="Accounting Readiness" icon={<ClipboardCheck className="w-4 h-4 text-orange-500" />}>
              <Table>
                <thead><tr><Th>Domain</Th><Th>Ready Items</Th><Th>Review Items</Th><Th>Issues</Th><Th>Risk</Th><Th>Status</Th><Th>Required Action</Th><Th>Action</Th></tr></thead>
                <tbody>
                  {accountingReadiness.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <Td strong>{row.domain}</Td><Td>{row.status === 'Passed' ? '1' : '0'}</Td><Td>{row.status === 'Warning' || row.status === 'Pending' ? '1' : '0'}</Td><Td>{row.status === 'Failed' ? '1' : '0'}</Td><Td><Badge value={row.status === 'Passed' ? 'Low' : row.status === 'Warning' ? 'Medium' : 'High'} risk /></Td><Td><Badge value={row.status} /></Td><Td>{row.requiredAction}</Td><Td><AccountingDeskRowActionMenu tab="Accounting Readiness" rowId={row.id} title={row.check} fields={accountingReadinessFields(row)} openId={openAccountingDeskMenuId} setOpenId={setOpenAccountingDeskMenuId} can={hasCashPermission} onOpen={openAccountingDeskAction} onAction={handleAccountingDeskAction} /></Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Panel>
          )}

          <AccountingActivityFeed activity={accountingActivity} />
        </div>
      )}

      {activeTab === 'Day Lock' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <div className="xl:col-span-8 space-y-5">
            <Panel title="Day Lock Readiness" icon={<Lock className="w-4 h-4 text-orange-500" />}>
              <MetricGrid metrics={[
                ['Business Date', businessDate],
                ['EOD Status', eodSession?.status || 'Blocked'],
                ['Failed Checks', failedChecks.toString()],
                ['Warning Checks', warningChecks.toString()],
                ['Pending Reviews', pendingReviews.toString()],
                ['Lock Allowed', failedChecks === 0 && blockingReasons.length === 0 ? 'Yes' : 'No']
              ]} />
              <div className="mt-4 bg-slate-50 border border-[#b1b5c2] p-3">
                <div className="text-[9px] font-black uppercase text-slate-500 mb-2">Blocking Reasons</div>
                <div className="space-y-1">
                  {(blockingReasons.length ? blockingReasons : ['No blocking reasons detected locally.']).map((reason) => (
                    <div key={reason} className="flex items-center gap-2 text-[10px] font-bold text-[#1e222b]">
                      <AlertTriangle className="w-3 h-3 text-orange-500" />
                      {reason}
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
            <Panel title="Day Lock Actions" icon={<RefreshCw className="w-4 h-4 text-orange-500" />}>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <ActionButton icon={<RefreshCw className="w-4 h-4" />} onClick={handleRunCheck}>Run EOD Check</ActionButton>
                <ActionButton icon={<Lock className="w-4 h-4" />} onClick={handleLockDay}>Attempt Lock Day</ActionButton>
                <ActionButton icon={<Download className="w-4 h-4" />} onClick={handleExport}>Prepare EOD Export</ActionButton>
                <ActionButton icon={<Eye className="w-4 h-4" />} onClick={() => showFeedback('warning', 'Day reopen request recorded locally.')}>Request Day Reopen</ActionButton>
              </div>
            </Panel>
          </div>
          <div className="xl:col-span-4"><ActivityFeed activity={activity} /></div>
        </div>
      )}

      {activeTab !== 'Day Lock' && activeTab !== 'Accounting Desk' && <ActivityFeed activity={activity} />}

      {selectedInventoryAccounting && (
        <InventoryAccountingReadinessForm
          record={selectedInventoryAccounting}
          lines={inventoryAccountingLines}
          accounts={chartAccounts}
          mappingRules={mappingRules}
          onClose={() => setSelectedInventoryAccounting(null)}
          onReview={(notes) => void handleInventoryAccountingReview(notes)}
          onApprove={(notes) => void handleInventoryAccountingApprove(notes)}
          onHold={(notes) => void handleInventoryAccountingHold(notes)}
          onReject={(notes) => void handleInventoryAccountingReject(notes)}
          onMarkPosted={(notes) => void handleInventoryAccountingMarkPosted(notes)}
          onExport={() => void handleInventoryAccountingExport()}
        />
      )}

      {cashModal && (
        <CashReconciliationModal
          mode={cashModal.mode}
          row={cashModal.row}
          note={cashNote}
          onNoteChange={setCashNote}
          onClose={() => setCashModal(null)}
          onMarkReviewed={() => void handleCashMarkReviewed(cashModal.row)}
          onAssignFollowUp={() => void handleCashAssignFollowUp(cashModal.row)}
          onSaveNote={() => void handleCashSaveNote()}
          onMarkBalanced={() => void handleCashMarkBalanced()}
          onBIWarning={() => void handleCashPlaceholderAction('CASH_RECONCILIATION_BI_WARNING_CREATED', `BI advice CASH_RECONCILIATION_VARIANCE_OWNER_REVIEW created locally for ${cashModal.row.terminal} / ${cashModal.row.shiftId}.`)}
        />
      )}

      {ownerActionModal && (
        <OwnerDeskActionModal
          modal={ownerActionModal}
          note={ownerActionNote}
          onNoteChange={setOwnerActionNote}
          onClose={() => setOwnerActionModal(null)}
          onSave={() => void handleOwnerActionNoteSave()}
        />
      )}

      {selectedCOAAccount && coaModalMode === 'detail' && (
        <COAAccountDetailModal
          account={selectedCOAAccount}
          onClose={closeCOAModal}
          onEditDraft={() => setCOAModalMode('edit')}
          onMarkInactive={() => setCOAModalMode('inactive')}
          onAddNote={() => setCOAModalMode('note')}
          onPrint={() => void handleCOAPrint(selectedCOAAccount)}
          onExport={() => void handleCOAExport(selectedCOAAccount)}
        />
      )}

      {selectedCOAAccount && coaModalMode === 'edit' && (
        <COAAccountEditDraftModal
          account={selectedCOAAccount}
          accounts={coaAccounts}
          onClose={closeCOAModal}
          onSave={(changes) => void handleCOAEditSave(changes)}
        />
      )}

      {selectedCOAAccount && (coaModalMode === 'inactive' || coaModalMode === 'reactivate' || coaModalMode === 'note') && (
        <COAAccountReasonModal
          account={selectedCOAAccount}
          mode={coaModalMode}
          reason={coaReason}
          onReasonChange={setCOAReason}
          onClose={closeCOAModal}
          onConfirm={coaModalMode === 'inactive' ? () => void handleCOAMarkInactive() : coaModalMode === 'note' ? () => void handleCOAOwnerNote() : () => void handleCOAReactivate(selectedCOAAccount)}
        />
      )}

      {paymentPostingModal && (
        <PaymentPostingModal
          modal={paymentPostingModal}
          settlementForm={paymentSettlementForm}
          setSettlementForm={setPaymentSettlementForm}
          varianceForm={paymentVarianceForm}
          setVarianceForm={setPaymentVarianceForm}
          ownerNote={paymentOwnerNote}
          setOwnerNote={setPaymentOwnerNote}
          taskForm={paymentTaskForm}
          setTaskForm={setPaymentTaskForm}
          biForm={paymentBIForm}
          setBIForm={setPaymentBIForm}
          receiptSearch={paymentReceiptSearch}
          setReceiptSearch={setPaymentReceiptSearch}
          activity={accountingActivity}
          onClose={() => setPaymentPostingModal(null)}
          onSettle={handlePaymentMarkSettled}
          onReopen={() => void handlePaymentReopenSettlement(paymentPostingModal.row)}
          onSaveVariance={() => void handlePaymentFlagVariance(false, false)}
          onSaveVarianceBI={() => void handlePaymentFlagVariance(true, false)}
          onSaveVarianceTask={() => void handlePaymentFlagVariance(false, true)}
          onSaveNote={handlePaymentSaveNote}
          onCreateTask={handlePaymentCreateTask}
          onCreateBI={handlePaymentCreateBIWarning}
          onPrint={() => void handlePaymentPrint(paymentPostingModal.row)}
          onExport={() => void handlePaymentExport(paymentPostingModal.row)}
          onOpenNested={(mode) => void openPaymentPostingModal(mode, paymentPostingModal.row)}
          onReceiptAction={(message) => void recordPaymentPostingActivity('PAYMENT_MODE_RECEIPTS_VIEWED', message)}
        />
      )}

      {accountingDeskActionModal && (
        <AccountingDeskActionModal
          modal={accountingDeskActionModal}
          note={accountingDeskActionNote}
          onNoteChange={setAccountingDeskActionNote}
          issueType={accountingDeskIssueType}
          onIssueTypeChange={setAccountingDeskIssueType}
          risk={accountingDeskRisk}
          onRiskChange={setAccountingDeskRisk}
          assignTo={accountingDeskAssignTo}
          onAssignToChange={setAccountingDeskAssignTo}
          onClose={() => setAccountingDeskActionModal(null)}
          onAction={(action) => void handleAccountingDeskAction(action)}
        />
      )}
    </div>
  );
}

function Filters({ branch, setBranch, dateFrom, setDateFrom, dateTo, setDateTo }: { branch: string; setBranch: (value: string) => void; dateFrom: string; setDateFrom: (value: string) => void; dateTo: string; setDateTo: (value: string) => void }) {
  return (
    <div className="bg-white border-2 border-[#b1b5c2] p-3 grid grid-cols-1 md:grid-cols-4 gap-2">
      <InfoBox label="Business / Vendor" value="Demo Vendor" />
      <Select label="Branch" value={branch} onChange={setBranch} options={branches} />
      <Input label="Date From" value={dateFrom} onChange={setDateFrom} />
      <Input label="Date To" value={dateTo} onChange={setDateTo} />
    </div>
  );
}

function PaymentFilters(props: {
  branch: string; setBranch: (value: string) => void; terminal: string; setTerminal: (value: string) => void; cashier: string; setCashier: (value: string) => void;
  dateFrom: string; setDateFrom: (value: string) => void; dateTo: string; setDateTo: (value: string) => void; paymentMode: PaymentMode | 'All'; setPaymentMode: (value: PaymentMode | 'All') => void;
}) {
  return (
    <div className="bg-white border-2 border-[#b1b5c2] p-3 grid grid-cols-1 md:grid-cols-4 xl:grid-cols-7 gap-2">
      <InfoBox label="Business / Vendor" value="Demo Vendor" />
      <Select label="Branch" value={props.branch} onChange={props.setBranch} options={branches} />
      <Select label="Terminal" value={props.terminal} onChange={props.setTerminal} options={terminals} />
      <Select label="Cashier" value={props.cashier} onChange={props.setCashier} options={cashiers} />
      <Input label="Date From" value={props.dateFrom} onChange={props.setDateFrom} />
      <Input label="Date To" value={props.dateTo} onChange={props.setDateTo} />
      <Select label="Payment Mode" value={props.paymentMode} onChange={(value) => props.setPaymentMode(value as PaymentMode | 'All')} options={paymentModes} />
    </div>
  );
}

function CashFilters({ branch, setBranch, terminal, setTerminal, cashier, setCashier }: { branch: string; setBranch: (value: string) => void; terminal: string; setTerminal: (value: string) => void; cashier: string; setCashier: (value: string) => void }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-4">
      <Select label="Branch" value={branch} onChange={setBranch} options={branches} />
      <Select label="Terminal" value={terminal} onChange={setTerminal} options={terminals} />
      <Select label="Cashier" value={cashier} onChange={setCashier} options={cashiers} />
      <Input label="Shift" value="All Shifts" onChange={() => undefined} />
      <Input label="Date" value="2026-06-09" onChange={() => undefined} />
    </div>
  );
}

function AccountingFilters(props: {
  branch: string; setBranch: (value: string) => void; terminal: string; setTerminal: (value: string) => void; cashier: string; setCashier: (value: string) => void;
  dateFrom: string; setDateFrom: (value: string) => void; dateTo: string; setDateTo: (value: string) => void;
}) {
  return (
    <div className="bg-white border-2 border-[#b1b5c2] p-3 grid grid-cols-1 md:grid-cols-4 xl:grid-cols-6 gap-2">
      <InfoBox label="Business / Vendor" value="Demo Vendor" />
      <Select label="Branch" value={props.branch} onChange={props.setBranch} options={branches} />
      <Select label="Terminal" value={props.terminal} onChange={props.setTerminal} options={terminals} />
      <Select label="Cashier" value={props.cashier} onChange={props.setCashier} options={cashiers} />
      <Input label="Date From" value={props.dateFrom} onChange={props.setDateFrom} />
      <Input label="Date To" value={props.dateTo} onChange={props.setDateTo} />
    </div>
  );
}

function MetricGrid({ metrics }: { metrics: Array<[string, string]> }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
      {metrics.map(([label, value]) => (
        <div key={label} className="bg-white border border-[#b1b5c2] border-l-4 border-l-orange-500 p-3 h-[88px] flex flex-col justify-between">
          <span className="text-[8.5px] font-black text-slate-500 uppercase tracking-tight truncate" title={label}>{label}</span>
          <span className="text-sm font-black text-[#1e222b] leading-tight truncate" title={value}>{value}</span>
          <span className="text-[8px] text-slate-400 uppercase">EOD control metric</span>
        </div>
      ))}
    </div>
  );
}

function ActivityFeed({ activity }: { activity: EODActivityEvent[] }) {
  return (
    <Panel title="EOD Activity Feed" icon={<CheckCircle2 className="w-4 h-4 text-orange-500" />}>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[360px] overflow-y-auto pos-custom-scroll">
        {activity.map((event) => (
          <div key={event.id} className="industrial-card p-3">
            <div className="flex items-start justify-between gap-2">
              <span className="font-black text-[#1e222b] uppercase text-[10px]">{humanizeEventName(event.eventType)}</span>
              <span className="text-[9px] text-slate-700 font-bold">{timeOnly(event.timestamp)}</span>
            </div>
            <p className="text-[10.5px] text-slate-800 font-semibold mt-1 leading-snug">{event.message}</p>
            <span className="text-[9px] text-slate-700 uppercase font-black">Operator: {event.operator}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function AccountingActivityFeed({ activity }: { activity: AccountingActivityEvent[] }) {
  return (
    <Panel title="Accounting Activity Feed" icon={<CheckCircle2 className="w-4 h-4 text-orange-500" />}>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[360px] overflow-y-auto pos-custom-scroll">
        {activity.map((event) => (
          <div key={event.id} className="industrial-card p-3">
            <div className="flex items-start justify-between gap-2">
              <span className="font-black text-[#1e222b] uppercase text-[10px]">{humanizeEventName(event.eventType)}</span>
              <span className="text-[9px] text-slate-700 font-bold">{timeOnly(event.timestamp)}</span>
            </div>
            <p className="text-[10.5px] text-slate-800 font-semibold mt-1 leading-snug">{event.message}</p>
            <span className="text-[9px] text-slate-700 uppercase font-black">Operator: {event.operator}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="industrial-section shadow-sm">
      <div className="industrial-section-header">
        <div className="flex items-center gap-2">
          {icon}
          <span className="industrial-section-title">{title}</span>
        </div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Table({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto owner-desk-scroll-body pos-custom-scroll"><table className="industrial-table">{children}</table></div>;
}

function Th({ children }: { children: React.ReactNode }) {
  return <th>{children}</th>;
}

function Td({ children, strong }: { children: React.ReactNode; strong?: boolean }) {
  return <td className={strong ? 'font-black text-[#1e222b]' : 'font-semibold'}>{children}</td>;
}

function Badge({ value, risk = false }: { value: string; risk?: boolean }) {
  const classes = risk ? riskClass[value] : statusClass[value];
  const Icon = value === 'Failed' || value === 'Critical' || value === 'Blocked' ? XCircle : value === 'Passed' || value === 'Balanced' || value === 'Locked' ? CheckCircle2 : AlertTriangle;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 border text-[8px] uppercase font-black ${classes || 'bg-slate-100 text-slate-700 border-slate-300'}`}>
      <Icon className="w-3 h-3" />
      {value}
    </span>
  );
}

function Select<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly T[]; onChange: (value: T) => void }) {
  return (
    <label className="space-y-1">
      <span className="block text-[8px] uppercase font-black text-slate-500">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value as T)} className="w-full border border-[#b1b5c2] bg-white px-2 py-2 text-[10px] font-bold text-[#1e222b]">
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-1">
      <span className="block text-[8px] uppercase font-black text-slate-500">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="w-full border border-[#b1b5c2] bg-white px-2 py-2 text-[10px] font-bold text-[#1e222b]" />
    </label>
  );
}

function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-1 block">
      <span className="block text-[8px] uppercase font-black text-slate-500">{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} className="w-full min-h-[96px] border border-[#b1b5c2] bg-white px-2 py-2 text-[10px] font-bold text-[#1e222b]" />
    </label>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50 border border-[#b1b5c2] p-2 min-h-[48px]">
      <span className="block text-[8px] uppercase font-black text-slate-500">{label}</span>
      <span className="block text-[10px] font-black text-[#1e222b] mt-1">{value}</span>
    </div>
  );
}

function SmallAction({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button onClick={onClick} className="industrial-secondary-button text-[8.5px] min-h-[1.85rem] px-2 py-1 whitespace-nowrap">{children}</button>;
}

function PaymentPostingActionMenu({
  row,
  openId,
  setOpenId,
  can,
  onSettle,
  onReceipts,
  onVariance,
  onDetail,
  onNote,
  onBI,
  onTask,
  onPrint,
  onExport
}: {
  row: PaymentAccountingSummary;
  openId: string | null;
  setOpenId: (id: string | null) => void;
  can: (permission: PermissionKey) => boolean;
  onSettle: () => void;
  onReceipts: () => void;
  onVariance: () => void;
  onDetail: () => void;
  onNote: () => void;
  onBI: () => void;
  onTask: () => void;
  onPrint: () => void;
  onExport: () => void;
}) {
  const alreadySettled = row.settlementStatus === 'Settled';
  const items: Array<RowActionMenuItem | false> = [
    can('ownerDesk.accountingDesk.paymentPosting.markSettled') && { label: alreadySettled ? 'View Settlement' : 'Mark Settled', icon: <CheckCircle2 className="w-3.5 h-3.5" />, onClick: onSettle },
    can('ownerDesk.accountingDesk.paymentPosting.viewReceipts') && { label: 'View Receipts', icon: <FileText className="w-3.5 h-3.5" />, onClick: onReceipts },
    can('ownerDesk.accountingDesk.paymentPosting.flagVariance') && { label: 'Flag Variance', icon: <AlertTriangle className="w-3.5 h-3.5" />, onClick: onVariance },
    can('ownerDesk.accountingDesk.paymentPosting.view') && { label: 'View Payment Mode Detail', icon: <Eye className="w-3.5 h-3.5" />, onClick: onDetail },
    can('ownerDesk.accountingDesk.paymentPosting.addNote') && { label: 'Add Owner Note', icon: <StickyNote className="w-3.5 h-3.5" />, onClick: onNote },
    can('ownerDesk.accountingDesk.paymentPosting.createBIWarning') && { label: 'Create BI Warning', icon: <Flag className="w-3.5 h-3.5" />, onClick: onBI },
    can('ownerDesk.accountingDesk.paymentPosting.createTask') && { label: 'Create Accounting Task', icon: <ClipboardCheck className="w-3.5 h-3.5" />, onClick: onTask },
    can('ownerDesk.accountingDesk.paymentPosting.print') && { label: 'Print Payment Summary', icon: <Printer className="w-3.5 h-3.5" />, onClick: onPrint },
    can('ownerDesk.accountingDesk.paymentPosting.export') && { label: 'Export Row', icon: <Download className="w-3.5 h-3.5" />, onClick: onExport }
  ];
  return (
    <OwnerDeskRowActionMenu
      id={`payment-posting-${row.id}`}
      openId={openId}
      setOpenId={setOpenId}
      ariaLabel={`Payment posting actions for ${row.paymentMode}`}
      items={items}
    />
  );
}

function AccountingDeskRowActionMenu({
  tab,
  rowId,
  title,
  fields,
  openId,
  setOpenId,
  can,
  onOpen,
  onAction
}: {
  tab: AccountingDeskActionTab;
  rowId: string;
  title: string;
  fields: Array<[string, string]>;
  openId: string | null;
  setOpenId: (id: string | null) => void;
  can: (permission: PermissionKey) => boolean;
  onOpen: (tab: AccountingDeskActionTab, mode: AccountingDeskActionMode, rowId: string, title: string, fields: Array<[string, string]>) => void;
  onAction: (action: 'review' | 'postedPreview' | 'ready' | 'issue' | 'task' | 'bi' | 'approval' | 'print' | 'export' | 'source') => void;
}) {
  const menuId = `${tab}-${rowId}`;
  const canView = can(permissionForTab(tab, 'view'));
  const canReview = can(permissionForTab(tab, 'review'));
  const canIssue = can(permissionForTab(tab, 'issue'));
  const items: Array<RowActionMenuItem | false> = [
    canView && { label: detailLabelForTab(tab), icon: <Eye className="w-3.5 h-3.5" />, onClick: () => onOpen(tab, 'detail', rowId, title, fields) },
    canReview && { label: 'Mark Reviewed', icon: <CheckCircle2 className="w-3.5 h-3.5" />, onClick: () => onAction('review') },
    canReview && tab === 'Sales Posting' && { label: 'Mark Posted Preview', icon: <ClipboardCheck className="w-3.5 h-3.5" />, onClick: () => onAction('postedPreview') },
    canReview && tab !== 'Sales Posting' && { label: 'Mark Ready', icon: <ClipboardCheck className="w-3.5 h-3.5" />, onClick: () => onAction('ready') },
    canIssue && { label: issueLabelForTab(tab), icon: <AlertTriangle className="w-3.5 h-3.5" />, onClick: () => onOpen(tab, 'issue', rowId, title, fields) },
    can('ownerDesk.accountingDesk.createBIWarning') && { label: 'Create BI Warning', icon: <Flag className="w-3.5 h-3.5" />, onClick: () => onOpen(tab, 'bi', rowId, title, fields) },
    can('ownerDesk.accountingDesk.createTask') && { label: 'Create Accounting Task', icon: <ClipboardCheck className="w-3.5 h-3.5" />, onClick: () => onOpen(tab, 'task', rowId, title, fields) },
    canReview && { label: 'Create Approval', icon: <ShieldAlert className="w-3.5 h-3.5" />, onClick: () => onOpen(tab, 'approval', rowId, title, fields) },
    can('ownerDesk.accountingDesk.print') && { label: printLabelForTab(tab), icon: <Printer className="w-3.5 h-3.5" />, onClick: () => { onOpen(tab, 'detail', rowId, title, fields); setTimeout(() => onAction('print'), 0); } },
    can('ownerDesk.accountingDesk.export') && { label: 'Export Row', icon: <Download className="w-3.5 h-3.5" />, onClick: () => { onOpen(tab, 'detail', rowId, title, fields); setTimeout(() => onAction('export'), 0); } },
    canView && { label: sourceLabelForTab(tab), icon: <FileText className="w-3.5 h-3.5" />, onClick: () => onAction('source') }
  ];
  return <OwnerDeskRowActionMenu id={menuId} openId={openId} setOpenId={setOpenId} ariaLabel={`${tab} actions for ${title}`} items={items} />;
}

function AccountingDeskActionModal({
  modal,
  note,
  onNoteChange,
  issueType,
  onIssueTypeChange,
  risk,
  onRiskChange,
  assignTo,
  onAssignToChange,
  onClose,
  onAction
}: {
  modal: AccountingDeskActionState;
  note: string;
  onNoteChange: (value: string) => void;
  issueType: string;
  onIssueTypeChange: (value: string) => void;
  risk: 'Low' | 'Medium' | 'High' | 'Critical';
  onRiskChange: (value: 'Low' | 'Medium' | 'High' | 'Critical') => void;
  assignTo: string;
  onAssignToChange: (value: string) => void;
  onClose: () => void;
  onAction: (action: 'review' | 'postedPreview' | 'ready' | 'issue' | 'task' | 'bi' | 'approval' | 'print' | 'export' | 'source') => void;
}) {
  const heading = modal.mode === 'detail' ? `${modal.tab} Detail` : modal.mode === 'issue' ? `Flag ${modal.tab} Issue` : modal.mode === 'bi' ? 'Create BI Warning' : modal.mode === 'task' ? 'Create Accounting Task' : modal.mode === 'approval' ? 'Create Approval' : 'Add Note';
  return (
    <div className="fixed inset-0 z-[70] bg-slate-950/60 flex items-center justify-center p-4">
      <div className="bg-white border-2 border-[#1e222b] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-[#b1b5c2] flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-[#1e222b]">{heading}</h3>
            <p className="text-[10px] text-slate-500 uppercase">Accounting readiness preview only. Not final posted accounts.</p>
          </div>
          <button className="industrial-secondary-button text-[10px]" onClick={onClose}>Close</button>
        </div>
        <div className="p-4 overflow-y-auto pos-custom-scroll space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {modal.fields.map(([label, value]) => <InfoBox key={label} label={label} value={cleanPaymentPostingLabel(value)} />)}
          </div>
          {modal.mode !== 'detail' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <Input label="Issue / Action Type" value={issueType} onChange={onIssueTypeChange} />
                <Select label="Risk Level" value={risk} onChange={(value) => onRiskChange(value as 'Low' | 'Medium' | 'High' | 'Critical')} options={riskLevels} />
                <Input label="Assign To" value={assignTo} onChange={onAssignToChange} />
              </div>
              <Textarea label="Owner / Accounting Note" value={note} onChange={onNoteChange} />
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-3">
            <SmallAction onClick={() => onAction('review')}>Mark Reviewed</SmallAction>
            {modal.tab === 'Sales Posting' && <SmallAction onClick={() => onAction('postedPreview')}>Mark Posted Preview</SmallAction>}
            {modal.tab !== 'Sales Posting' && <SmallAction onClick={() => onAction('ready')}>Mark Ready</SmallAction>}
            <SmallAction onClick={() => onAction('issue')}>Save Issue</SmallAction>
            <SmallAction onClick={() => onAction('bi')}>Create BI Warning</SmallAction>
            <SmallAction onClick={() => onAction('task')}>Create Task</SmallAction>
            <SmallAction onClick={() => onAction('approval')}>Create Approval</SmallAction>
            <SmallAction onClick={() => onAction('print')}>Print</SmallAction>
            <SmallAction onClick={() => onAction('export')}>Export</SmallAction>
          </div>
        </div>
      </div>
    </div>
  );
}

function PaymentPostingModal({
  modal,
  settlementForm,
  setSettlementForm,
  varianceForm,
  setVarianceForm,
  ownerNote,
  setOwnerNote,
  taskForm,
  setTaskForm,
  biForm,
  setBIForm,
  receiptSearch,
  setReceiptSearch,
  activity,
  onClose,
  onSettle,
  onReopen,
  onSaveVariance,
  onSaveVarianceBI,
  onSaveVarianceTask,
  onSaveNote,
  onCreateTask,
  onCreateBI,
  onPrint,
  onExport,
  onOpenNested,
  onReceiptAction
}: {
  modal: { mode: PaymentPostingModalMode; row: PaymentAccountingSummary };
  settlementForm: { settlementDate: string; settlementReference: string; settledBy: string; note: string };
  setSettlementForm: (value: { settlementDate: string; settlementReference: string; settledBy: string; note: string }) => void;
  varianceForm: { amount: string; type: PaymentVarianceType; riskLevel: 'Low' | 'Medium' | 'High' | 'Critical'; note: string; assignTo: string };
  setVarianceForm: (value: { amount: string; type: PaymentVarianceType; riskLevel: 'Low' | 'Medium' | 'High' | 'Critical'; note: string; assignTo: string }) => void;
  ownerNote: string;
  setOwnerNote: (value: string) => void;
  taskForm: { title: string; issueType: string; dueDate: string; assignedTo: string; notes: string };
  setTaskForm: (value: { title: string; issueType: string; dueDate: string; assignedTo: string; notes: string }) => void;
  biForm: { rule: string; priority: string; assignedDesk: string; narrative: string };
  setBIForm: (value: { rule: string; priority: string; assignedDesk: string; narrative: string }) => void;
  receiptSearch: string;
  setReceiptSearch: (value: string) => void;
  activity: AccountingActivityEvent[];
  onClose: () => void;
  onSettle: () => void;
  onReopen: () => void;
  onSaveVariance: () => void;
  onSaveVarianceBI: () => void;
  onSaveVarianceTask: () => void;
  onSaveNote: () => void;
  onCreateTask: () => void;
  onCreateBI: () => void;
  onPrint: () => void;
  onExport: () => void;
  onOpenNested: (mode: PaymentPostingModalMode) => void;
  onReceiptAction: (message: string) => void;
}) {
  const { mode, row } = modal;
  const receipts = buildPaymentReceipts(row).filter((receipt) =>
    matchesOwnerDeskSearch(receiptSearch, [receipt.receiptNo, receipt.cashier, receipt.customer, money(receipt.netAmount), receipt.settlementStatus, displayAmount(receipt.variance)])
  );
  const title =
    mode === 'settle' ? 'Mark Payment Mode Settled' :
    mode === 'receipts' ? 'Receipts for Payment Mode' :
    mode === 'variance' ? 'Flag Payment Variance' :
    mode === 'detail' ? 'Payment Mode Detail' :
    mode === 'note' ? 'Add Owner Note' :
    mode === 'task' ? 'Create Accounting Task' :
    'Create BI Warning';
  const rowActivity = activity.filter((event) => event.message.includes(String(row.paymentMode))).slice(0, 6);

  return (
    <div className="fixed inset-0 z-[70] bg-slate-950/60 flex items-center justify-center p-4">
      <div className="bg-white border-2 border-[#1e222b] shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-[#b1b5c2] flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-[#1e222b]">{title}</h3>
            <p className="text-[10px] text-slate-500 uppercase">Accounting readiness preview only. Not final posted accounts.</p>
          </div>
          <button className="industrial-secondary-button text-[10px]" onClick={onClose}>Close</button>
        </div>
        <div className="p-4 overflow-y-auto pos-custom-scroll space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
            <InfoBox label="Payment Mode" value={String(row.paymentMode)} />
            <InfoBox label="Receipts" value={String(row.receiptCount)} />
            <InfoBox label="Gross Amount" value={money(row.grossAmount)} />
            <InfoBox label="Refunds" value={money(row.refunds)} />
            <InfoBox label="Net Amount" value={money(row.netAmount)} />
            <InfoBox label="Control Account" value={cleanPaymentPostingLabel(row.controlAccount)} />
            <InfoBox label="Settlement Status" value={row.settlementStatus} />
            <InfoBox label="Variance" value={displayAmount(row.variance)} />
          </div>

          {mode === 'settle' && (
            <div className="space-y-3">
              {row.settlementStatus === 'Settled' && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-3 text-xs font-bold">
                  This payment mode is settled for readiness review. You can reopen settlement review if permitted.
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <Input label="Settlement Date" value={settlementForm.settlementDate} onChange={(value) => setSettlementForm({ ...settlementForm, settlementDate: value })} />
                <Input label="Settlement Reference" value={settlementForm.settlementReference} onChange={(value) => setSettlementForm({ ...settlementForm, settlementReference: value })} />
                <Input label="Settled By" value={settlementForm.settledBy} onChange={(value) => setSettlementForm({ ...settlementForm, settledBy: value })} />
                <InfoBox label="Posting Status" value={row.postingStatus} />
              </div>
              <Textarea label="Owner / Accounting Note" value={settlementForm.note} onChange={(value) => setSettlementForm({ ...settlementForm, note: value })} />
              <div className="flex flex-wrap gap-2">
                <SmallAction onClick={onSettle}>Confirm Settlement</SmallAction>
                {row.settlementStatus === 'Settled' && <SmallAction onClick={onReopen}>Reopen Settlement Review</SmallAction>}
              </div>
            </div>
          )}

          {mode === 'receipts' && (
            <div className="space-y-3">
              <Input label="Receipt Search" value={receiptSearch} onChange={setReceiptSearch} />
              <div className="max-h-[48vh] overflow-auto pos-custom-scroll border border-[#b1b5c2]">
                <table className="industrial-table">
                  <thead><tr><Th>Receipt No.</Th><Th>Date / Time</Th><Th>Cashier</Th><Th>Customer</Th><Th>Gross Amount</Th><Th>Refunds</Th><Th>Net Amount</Th><Th>Payment Mode</Th><Th>Settlement Status</Th><Th>Variance</Th><Th>Action</Th></tr></thead>
                  <tbody>
                    {receipts.map((receipt) => (
                      <tr key={receipt.receiptNo}>
                        <Td strong>{receipt.receiptNo}</Td><Td>{timeOnly(receipt.dateTime)}</Td><Td>{receipt.cashier}</Td><Td>{receipt.customer}</Td><Td>{money(receipt.grossAmount)}</Td><Td>{money(receipt.refunds)}</Td><Td>{money(receipt.netAmount)}</Td><Td>{receipt.paymentMode}</Td><Td><Badge value={receipt.settlementStatus} /></Td><Td>{displayAmount(receipt.variance)}</Td>
                        <Td><div className="flex flex-wrap gap-1"><SmallAction onClick={() => onReceiptAction(`Receipt ${receipt.receiptNo} viewed locally for ${row.paymentMode}.`)}>View Receipt</SmallAction><SmallAction onClick={() => onReceiptAction(`CAT opened locally for ${receipt.receiptNo}.`)}>Open CAT</SmallAction><SmallAction onClick={() => onReceiptAction(`Receipt print prepared locally for ${receipt.receiptNo}.`)}>Print Receipt</SmallAction><SmallAction onClick={() => onReceiptAction(`Receipt note added locally for ${receipt.receiptNo}.`)}>Add Note</SmallAction><SmallAction onClick={() => onReceiptAction(`Receipt row export prepared locally for ${receipt.receiptNo}.`)}>Export Row</SmallAction></div></Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {mode === 'variance' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                <Input label="Variance Amount" value={varianceForm.amount} onChange={(value) => setVarianceForm({ ...varianceForm, amount: value })} />
                <Select label="Variance Type" value={varianceForm.type} onChange={(value) => setVarianceForm({ ...varianceForm, type: value as PaymentVarianceType })} options={paymentVarianceTypes} />
                <Select label="Risk Level" value={varianceForm.riskLevel} onChange={(value) => setVarianceForm({ ...varianceForm, riskLevel: value as 'Low' | 'Medium' | 'High' | 'Critical' })} options={riskLevels} />
                <Input label="Assign To" value={varianceForm.assignTo} onChange={(value) => setVarianceForm({ ...varianceForm, assignTo: value })} />
                <InfoBox label="Current Status" value={row.settlementStatus} />
              </div>
              <Textarea label="Explanation / Owner Note" value={varianceForm.note} onChange={(value) => setVarianceForm({ ...varianceForm, note: value })} />
              <div className="flex flex-wrap gap-2">
                <SmallAction onClick={onSaveVariance}>Save Variance Flag</SmallAction>
                <SmallAction onClick={onSaveVarianceBI}>Create BI Warning</SmallAction>
                <SmallAction onClick={onSaveVarianceTask}>Create Accounting Task</SmallAction>
              </div>
            </div>
          )}

          {mode === 'detail' && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="space-y-3">
                <InfoBox label="Linked COA Account" value={cleanPaymentPostingLabel(row.controlAccount)} />
                <InfoBox label="Readiness Mapping" value={row.controlAccount.includes('Suspense') ? 'Review required' : 'Mapped'} />
                <InfoBox label="Notes" value={row.ownerNote || 'No owner note recorded'} />
                <div className="flex flex-wrap gap-2">
                  <SmallAction onClick={() => onOpenNested('settle')}>Mark Settled</SmallAction>
                  <SmallAction onClick={() => onOpenNested('receipts')}>View Receipts</SmallAction>
                  <SmallAction onClick={() => onOpenNested('variance')}>Flag Variance</SmallAction>
                  <SmallAction onClick={() => onOpenNested('note')}>Add Owner Note</SmallAction>
                  <SmallAction onClick={onPrint}>Print</SmallAction>
                </div>
              </div>
              <div className="border border-[#b1b5c2] p-3">
                <h4 className="text-[10px] font-black uppercase text-slate-700">Activity History</h4>
                <div className="mt-2 space-y-2 max-h-[220px] overflow-y-auto pos-custom-scroll">
                  {rowActivity.length ? rowActivity.map((event) => <div key={event.id} className="text-[10px] border-b border-slate-100 pb-2"><strong>{humanizeEventName(event.eventType)}</strong><p>{event.message}</p></div>) : <p className="text-xs text-slate-500">No payment activity recorded yet.</p>}
                </div>
              </div>
            </div>
          )}

          {mode === 'note' && (
            <div className="space-y-3">
              <Textarea label="Owner Note" value={ownerNote} onChange={setOwnerNote} />
              <SmallAction onClick={onSaveNote}>Save Note</SmallAction>
            </div>
          )}

          {mode === 'task' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <Input label="Title" value={taskForm.title} onChange={(value) => setTaskForm({ ...taskForm, title: value })} />
                <Input label="Issue Type" value={taskForm.issueType} onChange={(value) => setTaskForm({ ...taskForm, issueType: value })} />
                <Input label="Due Date" value={taskForm.dueDate} onChange={(value) => setTaskForm({ ...taskForm, dueDate: value })} />
                <Input label="Assigned Role / Staff" value={taskForm.assignedTo} onChange={(value) => setTaskForm({ ...taskForm, assignedTo: value })} />
              </div>
              <Textarea label="Task Notes" value={taskForm.notes} onChange={(value) => setTaskForm({ ...taskForm, notes: value })} />
              <SmallAction onClick={onCreateTask}>Create Accounting Task</SmallAction>
            </div>
          )}

          {mode === 'bi' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <Input label="BI Rule" value={biForm.rule} onChange={(value) => setBIForm({ ...biForm, rule: value })} />
                <Input label="Priority" value={biForm.priority} onChange={(value) => setBIForm({ ...biForm, priority: value })} />
                <Input label="Assigned Desk" value={biForm.assignedDesk} onChange={(value) => setBIForm({ ...biForm, assignedDesk: value })} />
              </div>
              <Textarea label="Narrative / Business Risk / Recommended Action" value={biForm.narrative} onChange={(value) => setBIForm({ ...biForm, narrative: value })} />
              <SmallAction onClick={onCreateBI}>Create BI Warning</SmallAction>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
            <SmallAction onClick={onExport}>Export Row</SmallAction>
            <SmallAction onClick={onClose}>Close</SmallAction>
          </div>
        </div>
      </div>
    </div>
  );
}

function CashActionGroup({
  row,
  open,
  onOpenChange,
  can,
  onReviewVariance,
  onMarkBalanced,
  onAddNote,
  onDetail,
  onPrint,
  onExport,
  onBIWarning,
  onEscalate,
  onShiftDetail,
  onMovements
}: {
  row: EODCashReconciliation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  can: (permission: PermissionKey) => boolean;
  onReviewVariance: () => void;
  onMarkBalanced: () => void;
  onAddNote: () => void;
  onDetail: () => void;
  onPrint: () => void;
  onExport: () => void;
  onBIWarning: () => void;
  onEscalate: () => void;
  onShiftDetail: () => void;
  onMovements: () => void;
}) {
  const items: RowActionMenuItem[] = [
    can('ownerDesk.cashReconciliation.reviewVariance') && { label: 'Review Variance', icon: <Eye className="w-3.5 h-3.5" />, onClick: onReviewVariance },
    can('ownerDesk.cashReconciliation.markBalanced') && { label: 'Mark Balanced', icon: <CheckCircle2 className="w-3.5 h-3.5" />, onClick: onMarkBalanced },
    can('ownerDesk.cashReconciliation.addOwnerNote') && { label: 'Add Owner Note', icon: <StickyNote className="w-3.5 h-3.5" />, onClick: onAddNote },
    can('ownerDesk.cashReconciliation.view') && { label: 'View Reconciliation Detail', icon: <FileText className="w-3.5 h-3.5" />, onClick: onDetail },
    can('ownerDesk.cashReconciliation.print') && { label: 'Print Cash Summary', icon: <Printer className="w-3.5 h-3.5" />, onClick: onPrint },
    can('ownerDesk.cashReconciliation.export') && { label: 'Export Row', icon: <Download className="w-3.5 h-3.5" />, onClick: onExport },
    can('ownerDesk.cashReconciliation.createBIWarning') && { label: 'Create BI Warning', icon: <Flag className="w-3.5 h-3.5" />, onClick: onBIWarning },
    can('ownerDesk.cashReconciliation.escalate') && { label: 'Escalate to Manager', icon: <ShieldAlert className="w-3.5 h-3.5" />, onClick: onEscalate },
    can('ownerDesk.cashReconciliation.view') && { label: 'Open Shift Detail', icon: <Users className="w-3.5 h-3.5" />, onClick: onShiftDetail },
    can('ownerDesk.cashReconciliation.view') && { label: 'Open Cash Drawer Movements', icon: <DollarSign className="w-3.5 h-3.5" />, onClick: onMovements }
  ].filter(Boolean) as RowActionMenuItem[];

  return (
    <RowActionMenu
      ariaLabel={`Cash reconciliation actions for ${row.terminal} ${row.shiftId}`}
      align="top"
      open={open}
      items={items}
      onOpenChange={onOpenChange}
    />
  );
}

function CashReconciliationModal({
  mode,
  row,
  note,
  onNoteChange,
  onClose,
  onMarkReviewed,
  onAssignFollowUp,
  onSaveNote,
  onMarkBalanced,
  onBIWarning
}: {
  mode: CashModalMode;
  row: EODCashReconciliation;
  note: string;
  onNoteChange: (value: string) => void;
  onClose: () => void;
  onMarkReviewed: () => void;
  onAssignFollowUp: () => void;
  onSaveNote: () => void;
  onMarkBalanced: () => void;
  onBIWarning: () => void;
}) {
  const isNoteMode = mode === 'note' || mode === 'markBalanced';
  const titleMap: Record<CashModalMode, string> = {
    review: 'Review Variance',
    note: 'Add Owner Note',
    detail: 'Reconciliation Detail',
    shift: 'Shift Detail',
    movements: 'Cash Drawer Movements',
    markBalanced: 'Mark Balanced'
  };

  return (
    <div className="owner-cash-modal-backdrop" role="dialog" aria-modal="true" aria-label={titleMap[mode]}>
      <div className="owner-cash-modal">
        <div className="owner-cash-modal-header">
          <div>
            <span>Cash Reconciliation</span>
            <h3>{titleMap[mode]}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close cash reconciliation modal">Close</button>
        </div>
        <div className="owner-cash-modal-body pos-custom-scroll">
          <div className="owner-cash-detail-grid">
            <InfoBox label="Terminal" value={row.terminal} />
            <InfoBox label="Cashier" value={row.cashier} />
            <InfoBox label="Shift" value={row.shiftId} />
            <InfoBox label="Opening Float" value={money(row.openingFloat)} />
            <InfoBox label="Cash Sales" value={money(row.cashSales)} />
            <InfoBox label="Cash In" value={money(row.cashIn)} />
            <InfoBox label="Cash Out" value={money(row.cashOut)} />
            <InfoBox label="Expected Cash" value={money(row.expectedCash)} />
            <InfoBox label="Declared Cash" value={money(row.declaredCash)} />
            <InfoBox label="Variance" value={money(row.variance)} />
            <InfoBox label="Status" value={row.status} />
            <InfoBox label="Required Action" value={row.requiredAction} />
          </div>

          {mode === 'markBalanced' && row.variance !== 0 && (
            <div className="owner-cash-warning">This drawer has a variance. Marking balanced requires owner note.</div>
          )}

          {(mode === 'review' || mode === 'detail') && (
            <div className="owner-cash-notes">
              <span>Activity Notes</span>
              <p>{row.ownerNote || 'No owner note recorded yet. Review remains local/mock for build development.'}</p>
            </div>
          )}

          {mode === 'shift' && (
            <table className="owner-cash-movement-table">
              <thead><tr><th>Shift Field</th><th>Value</th></tr></thead>
              <tbody>
                <tr><td>Branch</td><td>{row.branch}</td></tr>
                <tr><td>Terminal</td><td>{row.terminal}</td></tr>
                <tr><td>Cashier</td><td>{row.cashier}</td></tr>
                <tr><td>Shift</td><td>{row.shiftId}</td></tr>
                <tr><td>Local Status</td><td>{row.status}</td></tr>
              </tbody>
            </table>
          )}

          {mode === 'movements' && (
            <table className="owner-cash-movement-table">
              <thead><tr><th>Movement</th><th>Amount</th><th>Reference</th></tr></thead>
              <tbody>
                <tr><td>Opening Float</td><td>{money(row.openingFloat)}</td><td>{row.shiftId}-FLOAT</td></tr>
                <tr><td>Cash Sales</td><td>{money(row.cashSales)}</td><td>{row.shiftId}-SALES</td></tr>
                <tr><td>Cash In</td><td>{money(row.cashIn)}</td><td>{row.shiftId}-IN</td></tr>
                <tr><td>Cash Out</td><td>{money(row.cashOut)}</td><td>{row.shiftId}-OUT</td></tr>
                <tr><td>Variance</td><td>{money(row.variance)}</td><td>{row.shiftId}-VAR</td></tr>
              </tbody>
            </table>
          )}

          {isNoteMode && (
            <label className="owner-cash-note-field">
              <span>Owner Note</span>
              <textarea value={note} onChange={(event) => onNoteChange(event.target.value)} rows={5} placeholder="Enter owner reconciliation note" />
            </label>
          )}
        </div>
        <div className="owner-cash-modal-actions">
          {mode === 'review' && <button type="button" className="industrial-secondary-button" onClick={onMarkReviewed}>Mark Reviewed</button>}
          {mode === 'review' && <button type="button" className="industrial-secondary-button" onClick={onAssignFollowUp}>Assign Follow-up</button>}
          {mode === 'review' && <button type="button" className="industrial-secondary-button" onClick={onBIWarning}>Create BI Warning</button>}
          {mode === 'note' && <button type="button" className="industrial-primary-button" onClick={onSaveNote}>Save Note</button>}
          {mode === 'markBalanced' && <button type="button" className="industrial-primary-button" onClick={onMarkBalanced}>Mark Balanced</button>}
          <button type="button" className="industrial-secondary-button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function OwnerDeskActionModal({
  modal,
  note,
  onNoteChange,
  onClose,
  onSave
}: {
  modal: OwnerDeskActionModalState;
  note: string;
  onNoteChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const needsNote = modal.mode === 'note' || modal.mode === 'notReady' || modal.mode === 'reconcile' || modal.mode === 'forceClose';
  return (
    <div className="owner-cash-modal-backdrop" role="dialog" aria-modal="true" aria-label={modal.title}>
      <div className="owner-cash-modal">
        <div className="owner-cash-modal-header">
          <div>
            <span>{modal.domain}</span>
            <h3>{modal.title}</h3>
          </div>
          <button type="button" onClick={onClose}>Close</button>
        </div>
        <div className="owner-cash-modal-body pos-custom-scroll">
          <div className="owner-cash-detail-grid">
            {modal.fields.map(([label, value]) => (
              <div key={label}>
                <InfoBox label={label} value={value || 'Pending'} />
              </div>
            ))}
          </div>
          {modal.domain === 'Accounting Desk' && (
            <div className="owner-cash-warning">Accounting readiness preview only. Not final posted accounts.</div>
          )}
          {modal.mode === 'detail' && (
            <div className="owner-cash-notes">
              <span>Local Detail</span>
              <p>This is a local/mock Owner Desk action surface. No external service or final posting is called.</p>
            </div>
          )}
          {needsNote && (
            <label className="owner-cash-note-field">
              <span>Owner Note</span>
              <textarea value={note} onChange={(event) => onNoteChange(event.target.value)} rows={5} placeholder="Enter owner note for this local action" />
            </label>
          )}
        </div>
        <div className="owner-cash-modal-actions">
          {needsNote && <button type="button" className="industrial-primary-button" onClick={onSave}>Save Local Action</button>}
          <button type="button" className="industrial-secondary-button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function ShiftActionGroup({
  id,
  shiftId,
  openId,
  setOpenId,
  onReview,
  onForceClose
}: {
  id: string;
  shiftId: string;
  openId: string | null;
  setOpenId: (id: string | null) => void;
  onReview: (id: string) => void;
  onForceClose: (message: string) => void;
}) {
  return (
    <OwnerDeskRowActionMenu
      id={`shift-${id}`}
      openId={openId}
      setOpenId={setOpenId}
      ariaLabel={`Shift closing actions for ${shiftId}`}
      items={[
        { label: 'View Shift Detail', icon: <Eye className="w-3.5 h-3.5" />, onClick: () => onForceClose(`Shift detail opened locally for ${shiftId}.`) },
        { label: 'Force Close', icon: <Lock className="w-3.5 h-3.5" />, onClick: () => onForceClose(`Force close request recorded for ${shiftId}.`) },
        { label: 'Request Cashier Note', icon: <StickyNote className="w-3.5 h-3.5" />, onClick: () => onForceClose(`Cashier note requested locally for ${shiftId}.`) },
        { label: 'Review Variance', icon: <AlertTriangle className="w-3.5 h-3.5" />, onClick: () => onForceClose(`Shift variance review opened locally for ${shiftId}.`) },
        { label: 'Print Shift Summary', icon: <Printer className="w-3.5 h-3.5" />, onClick: () => onForceClose(`Shift summary print prepared locally for ${shiftId}.`) },
        { label: 'Create BI Warning', icon: <Flag className="w-3.5 h-3.5" />, onClick: () => onForceClose(`Shift BI warning created locally for ${shiftId}.`) },
        { label: 'Create Follow-up Task', icon: <ClipboardCheck className="w-3.5 h-3.5" />, onClick: () => onForceClose(`Shift follow-up task created locally for ${shiftId}.`) },
        { label: 'Mark Reviewed', icon: <CheckCircle2 className="w-3.5 h-3.5" />, onClick: () => onReview(id) },
        { label: 'Export Row', icon: <Download className="w-3.5 h-3.5" />, onClick: () => onForceClose(`Shift row export prepared locally for ${shiftId}.`) }
      ]}
    />
  );
}

function InventoryActionGroup({ id, openId, setOpenId, onReview, onAction }: { id: string; openId: string | null; setOpenId: (id: string | null) => void; onReview: (id: string) => void; onAction: (message: string) => void }) {
  return (
    <OwnerDeskRowActionMenu
      id={`inventory-${id}`}
      openId={openId}
      setOpenId={setOpenId}
      ariaLabel={`Inventory closing actions for ${id}`}
      items={[
        { label: 'View Detail', icon: <Eye className="w-3.5 h-3.5" />, onClick: () => onAction(`Inventory detail opened locally for ${id}.`) },
        { label: 'Mark Reviewed', icon: <CheckCircle2 className="w-3.5 h-3.5" />, onClick: () => onReview(id) },
        { label: 'Create Stocktake Task', icon: <ClipboardCheck className="w-3.5 h-3.5" />, onClick: () => onAction(`Stocktake task created locally for ${id}.`) },
        { label: 'Create BI Warning', icon: <Flag className="w-3.5 h-3.5" />, onClick: () => onAction(`Inventory BI warning created locally for ${id}.`) },
        { label: 'Escalate', icon: <ShieldAlert className="w-3.5 h-3.5" />, onClick: () => onAction(`Inventory issue escalated locally for ${id}.`) },
        { label: 'Print Exception', icon: <Printer className="w-3.5 h-3.5" />, onClick: () => onAction(`Inventory exception print prepared locally for ${id}.`) },
        { label: 'Export Row', icon: <Download className="w-3.5 h-3.5" />, onClick: () => onAction(`Inventory row export prepared locally for ${id}.`) },
        { label: 'Open Inventory Source', icon: <FileText className="w-3.5 h-3.5" />, onClick: () => onAction(`Inventory source opened locally for ${id}.`) }
      ]}
    />
  );
}

function DeliveryActionGroup({ id, openId, setOpenId, onReview, onAction }: { id: string; openId: string | null; setOpenId: (id: string | null) => void; onReview: (id: string) => void; onAction: (message: string) => void }) {
  return (
    <OwnerDeskRowActionMenu
      id={`delivery-${id}`}
      openId={openId}
      setOpenId={setOpenId}
      ariaLabel={`Delivery closing actions for ${id}`}
      items={[
        { label: 'View Delivery Detail', icon: <Eye className="w-3.5 h-3.5" />, onClick: () => onAction(`Delivery detail opened locally for ${id}.`) },
        { label: 'Confirm Cash Handover', icon: <DollarSign className="w-3.5 h-3.5" />, onClick: () => onAction(`Delivery cash handover confirmed locally for ${id}.`) },
        { label: 'Flag Code Issue', icon: <AlertTriangle className="w-3.5 h-3.5" />, onClick: () => onAction(`Delivery code issue flagged locally for ${id}.`) },
        { label: 'Create BI Warning', icon: <Flag className="w-3.5 h-3.5" />, onClick: () => onAction(`Delivery BI warning created locally for ${id}.`) },
        { label: 'Create Follow-up Task', icon: <ClipboardCheck className="w-3.5 h-3.5" />, onClick: () => onAction(`Delivery follow-up task created locally for ${id}.`) },
        { label: 'Mark Reviewed', icon: <CheckCircle2 className="w-3.5 h-3.5" />, onClick: () => onReview(id) },
        { label: 'Print Delivery Closeout', icon: <Printer className="w-3.5 h-3.5" />, onClick: () => onAction(`Delivery closeout print prepared locally for ${id}.`) },
        { label: 'Export Row', icon: <Download className="w-3.5 h-3.5" />, onClick: () => onAction(`Delivery row export prepared locally for ${id}.`) }
      ]}
    />
  );
}

function BIActionGroup({ id, openId, setOpenId, onReview, onAction }: { id: string; openId: string | null; setOpenId: (id: string | null) => void; onReview: (id: string) => void; onAction: (message: string) => void }) {
  return (
    <OwnerDeskRowActionMenu
      id={`bi-${id}`}
      openId={openId}
      setOpenId={setOpenId}
      ariaLabel={`BI review actions for ${id}`}
      items={[
        { label: 'View BI Detail', icon: <Eye className="w-3.5 h-3.5" />, onClick: () => onAction(`BI detail opened locally for ${id}.`) },
        { label: 'Assign Owner Action', icon: <StickyNote className="w-3.5 h-3.5" />, onClick: () => onAction(`Owner action assigned locally for ${id}.`) },
        { label: 'Mark Reviewed', icon: <CheckCircle2 className="w-3.5 h-3.5" />, onClick: () => onReview(id) },
        { label: 'Create Task', icon: <ClipboardCheck className="w-3.5 h-3.5" />, onClick: () => onAction(`BI task created locally for ${id}.`) },
        { label: 'Escalate', icon: <ShieldAlert className="w-3.5 h-3.5" />, onClick: () => onAction(`BI warning escalated locally for ${id}.`) },
        { label: 'Dismiss with Reason', icon: <XCircle className="w-3.5 h-3.5" />, onClick: () => onAction(`BI warning dismissed locally with owner reason for ${id}.`) },
        { label: 'Print BI Note', icon: <Printer className="w-3.5 h-3.5" />, onClick: () => onAction(`BI note print prepared locally for ${id}.`) },
        { label: 'Export Row', icon: <Download className="w-3.5 h-3.5" />, onClick: () => onAction(`BI row export prepared locally for ${id}.`) }
      ]}
    />
  );
}

function AccountingActionGroup({ id, openId, setOpenId, onReview, onReverse, onAction }: { id: string; openId: string | null; setOpenId: (id: string | null) => void; onReview: (id: string) => void; onReverse: (id: string) => void; onAction: (message: string) => void }) {
  return (
    <OwnerDeskRowActionMenu
      id={`accounting-${id}`}
      openId={openId}
      setOpenId={setOpenId}
      ariaLabel={`Accounting readiness actions for ${id}`}
      items={[
        { label: 'View Readiness Detail', icon: <Eye className="w-3.5 h-3.5" />, onClick: () => onAction(`Accounting readiness detail opened locally for ${id}.`) },
        { label: 'Mark Reviewed', icon: <CheckCircle2 className="w-3.5 h-3.5" />, onClick: () => onReview(id) },
        { label: 'Create Accounting Task', icon: <ClipboardCheck className="w-3.5 h-3.5" />, onClick: () => onAction(`Accounting task created locally for ${id}.`) },
        { label: 'Create BI Warning', icon: <Flag className="w-3.5 h-3.5" />, onClick: () => onAction(`Accounting BI warning created locally for ${id}.`) },
        { label: 'Print Readiness Note', icon: <Printer className="w-3.5 h-3.5" />, onClick: () => onAction(`Accounting readiness print prepared locally for ${id}.`) },
        { label: 'Export Row', icon: <Download className="w-3.5 h-3.5" />, onClick: () => onAction(`Accounting row export prepared locally for ${id}.`) },
        { label: 'Open Source Record', icon: <FileText className="w-3.5 h-3.5" />, onClick: () => onAction(`Accounting source record opened locally for ${id}.`) },
        { label: 'Request Reverse', icon: <RefreshCw className="w-3.5 h-3.5" />, onClick: () => onReverse(id) }
      ]}
    />
  );
}

function OwnerDeskFilterBar({
  search,
  onSearch,
  filters,
  activeCount,
  onClear
}: {
  search: string;
  onSearch: (value: string) => void;
  filters: Array<{ label: string; value: string; options: string[]; onChange: (value: string) => void }>;
  activeCount: number;
  onClear: () => void;
}) {
  return (
    <div className="owner-desk-filter-row">
      <label>
        <span>Content Search</span>
        <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search any row content" />
      </label>
      {filters.map((filter) => (
        <label key={filter.label}>
          <span>{filter.label}</span>
          <select value={filter.value} onChange={(event) => filter.onChange(event.target.value)}>
            {filter.options.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
      ))}
      <button type="button" onClick={onClear}>Clear Filters {activeCount > 0 ? `(${activeCount})` : ''}</button>
    </div>
  );
}

function OwnerDeskRowActionMenu({
  id,
  openId,
  setOpenId,
  ariaLabel,
  items
}: {
  id: string;
  openId: string | null;
  setOpenId: (id: string | null) => void;
  ariaLabel: string;
  items: Array<RowActionMenuItem | false>;
}) {
  return (
    <RowActionMenu
      ariaLabel={ariaLabel}
      align="top"
      open={openId === id}
      onOpenChange={(open) => setOpenId(open ? id : null)}
      items={items.filter(Boolean) as RowActionMenuItem[]}
    />
  );
}

function COAAccountActionMenu({
  account,
  openId,
  setOpenId,
  can,
  onView,
  onEditDraft,
  onViewMapping,
  onMarkInactive,
  onReactivate,
  onReplacement,
  onAddNote,
  onPrint,
  onExport
}: {
  account: COAAccount;
  openId: string | null;
  setOpenId: (id: string | null) => void;
  can: (permission: PermissionKey) => boolean;
  onView: () => void;
  onEditDraft: () => void;
  onViewMapping: () => void;
  onMarkInactive: () => void;
  onReactivate: () => void;
  onReplacement: () => void;
  onAddNote: () => void;
  onPrint: () => void;
  onExport: () => void;
}) {
  const isDraft = account.status === 'Draft';
  const isInactive = account.status === 'Inactive';
  return (
    <OwnerDeskRowActionMenu
      id={`coa-${account.id}`}
      openId={openId}
      setOpenId={setOpenId}
      ariaLabel={`COA account actions for ${account.accountCode}`}
      items={[
        can('ownerDesk.accountingDesk.coa.view') && { label: 'View Account Detail', icon: <Eye className="w-3.5 h-3.5" />, onClick: onView },
        isDraft && can('ownerDesk.accountingDesk.coa.editDraft') && { label: 'Edit Draft', icon: <FileText className="w-3.5 h-3.5" />, onClick: onEditDraft },
        !isDraft && can('ownerDesk.accountingDesk.coa.view') && { label: 'View Mapping', icon: <FileText className="w-3.5 h-3.5" />, onClick: onViewMapping },
        !isInactive && can('ownerDesk.accountingDesk.coa.markInactive') && { label: 'Mark Inactive', icon: <XCircle className="w-3.5 h-3.5" />, onClick: onMarkInactive },
        isInactive && can('ownerDesk.accountingDesk.coa.reactivate') && { label: 'Reactivate', icon: <RefreshCw className="w-3.5 h-3.5" />, onClick: onReactivate },
        can('ownerDesk.accountingDesk.coa.create') && { label: 'Create Replacement Account', icon: <ClipboardCheck className="w-3.5 h-3.5" />, onClick: onReplacement },
        can('ownerDesk.accountingDesk.coa.addNote') && { label: 'Add Owner Note', icon: <StickyNote className="w-3.5 h-3.5" />, onClick: onAddNote },
        can('ownerDesk.accountingDesk.coa.print') && { label: 'Print Account Detail', icon: <Printer className="w-3.5 h-3.5" />, onClick: onPrint },
        can('ownerDesk.accountingDesk.coa.export') && { label: 'Export Row', icon: <Download className="w-3.5 h-3.5" />, onClick: onExport }
      ]}
    />
  );
}

function COAAccountReasonModal({
  account,
  mode,
  reason,
  onReasonChange,
  onClose,
  onConfirm
}: {
  account: COAAccount;
  mode: Exclude<COAAccountModalMode, 'detail' | 'edit'>;
  reason: string;
  onReasonChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const title = mode === 'inactive' ? 'Mark COA Account Inactive' : mode === 'reactivate' ? 'Reactivate COA Account' : 'Add COA Owner Note';
  const actionLabel = mode === 'inactive' ? 'Confirm Mark Inactive' : mode === 'reactivate' ? 'Confirm Reactivate' : 'Save Owner Note';
  return (
    <div className="owner-cash-modal-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="owner-cash-modal coa-account-modal">
        <div className="owner-cash-modal-header">
          <div>
            <span>Accounting readiness preview only. Not final posted accounts.</span>
            <h3>{title}</h3>
          </div>
          <button type="button" onClick={onClose}>Close</button>
        </div>
        <div className="owner-cash-modal-body pos-custom-scroll">
          <div className="owner-cash-detail-grid">
            <InfoBox label="Account Code" value={account.accountCode} />
            <InfoBox label="Account Name" value={account.accountName} />
            <InfoBox label="Current Status" value={account.status} />
            <InfoBox label="Linked Domain" value={account.linkedDomain} />
          </div>
          {mode === 'inactive' && (
            <div className="owner-cash-warning">This will prevent this local account from being used in new accounting-readiness mappings. Existing history remains visible.</div>
          )}
          <label className="owner-cash-note-field">
            <span>Reason / Owner Note</span>
            <textarea value={reason} onChange={(event) => onReasonChange(event.target.value)} rows={5} placeholder="Enter reason or owner note" />
          </label>
        </div>
        <div className="owner-cash-modal-actions">
          <button type="button" className="industrial-primary-button" onClick={onConfirm}>{actionLabel}</button>
          <button type="button" className="industrial-secondary-button" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function ActionButton({ children, icon, onClick }: { children: React.ReactNode; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="industrial-primary-button w-full min-h-[48px] justify-start text-left">
      {icon}
      <span>{children}</span>
    </button>
  );
}

function humanizeEventName(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function money(value: number): string {
  return `USD ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function displayAmount(value: number | string): string {
  return typeof value === 'number' ? money(value) : value;
}

function cleanPaymentPostingLabel(value: string): string {
  return value
    .replace(/placeholder/gi, '')
    .replace('Split by payment components', 'Split by Payment Components')
    .replace('Customer Receivables', 'Customer Receivables Control')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

interface PaymentPostingReceiptRow {
  receiptNo: string;
  dateTime: string;
  cashier: string;
  customer: string;
  grossAmount: number;
  refunds: number;
  netAmount: number;
  paymentMode: string;
  settlementStatus: PaymentAccountingSummary['settlementStatus'];
  variance: number | 'Pending';
}

function buildPaymentReceipts(row: PaymentAccountingSummary): PaymentPostingReceiptRow[] {
  const count = Math.max(1, Math.min(row.receiptCount, 12));
  const baseNet = row.netAmount / count;
  const baseGross = row.grossAmount / count;
  return Array.from({ length: count }, (_, index) => {
    const receiptIndex = index + 1;
    const variance = receiptIndex === 1 ? row.variance : 0;
    return {
      receiptNo: `RCT-${String(900 + receiptIndex).padStart(4, '0')}`,
      dateTime: `2026-06-09T${String(8 + (index % 9)).padStart(2, '0')}:${String((index * 7) % 60).padStart(2, '0')}:00Z`,
      cashier: index % 3 === 0 ? 'Mary Cashier' : index % 3 === 1 ? 'Tawanda Supervisor' : 'Admin User',
      customer: row.paymentMode === 'Credit Sale' ? 'Customer Account Sale' : index % 2 === 0 ? 'Walk-in Customer' : 'Registered Customer',
      grossAmount: Number(baseGross.toFixed(2)),
      refunds: receiptIndex === count ? Number(row.refunds.toFixed(2)) : 0,
      netAmount: Number(baseNet.toFixed(2)),
      paymentMode: String(row.paymentMode),
      settlementStatus: row.settlementStatus,
      variance
    };
  });
}

function paymentSummaryPrintHtml(row: PaymentAccountingSummary): string {
  const account = cleanPaymentPostingLabel(row.controlAccount);
  return `<!doctype html><html><head><title>Payment Summary ${row.paymentMode}</title><style>
    body{font-family:Arial,sans-serif;background:#fff;color:#111;margin:32px}
    h1{font-size:20px;text-transform:uppercase;margin:0 0 4px}
    p{font-size:12px;color:#444;margin:0 0 18px}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th,td{border:1px solid #999;padding:8px;text-align:left}
    th{background:#f1f5f9;text-transform:uppercase}
  </style></head><body>
    <h1>Payment Posting Summary</h1>
    <p>Accounting readiness preview only. Not final posted accounts.</p>
    <table><tbody>
      <tr><th>Payment Mode</th><td>${row.paymentMode}</td></tr>
      <tr><th>Receipts</th><td>${row.receiptCount}</td></tr>
      <tr><th>Gross Amount</th><td>${money(row.grossAmount)}</td></tr>
      <tr><th>Refunds</th><td>${money(row.refunds)}</td></tr>
      <tr><th>Net Amount</th><td>${money(row.netAmount)}</td></tr>
      <tr><th>Control Account</th><td>${account}</td></tr>
      <tr><th>Settlement Status</th><td>${row.settlementStatus}</td></tr>
      <tr><th>Variance</th><td>${displayAmount(row.variance)}</td></tr>
      <tr><th>Posting Status</th><td>${row.postingStatus}</td></tr>
      <tr><th>Owner Note</th><td>${row.ownerNote || 'None'}</td></tr>
    </tbody></table>
  </body></html>`;
}

function salesPostingFields(row: SalesAccountingSummary): Array<[string, string]> {
  const net = row.netSale;
  const cogs = Math.max(0, Math.round(net * 0.35 * 100) / 100);
  return [
    ['Receipt', row.receiptNo],
    ['Date', timeOnly(row.dateTime)],
    ['Customer', 'Local receipt customer'],
    ['Gross Sales', money(row.grossSale)],
    ['Discount', money(row.discount)],
    ['Returns', money(0)],
    ['Net Sales', money(row.netSale)],
    ['VAT', money(row.vat)],
    ['COGS', money(cogs)],
    ['Gross Profit', money(net - cogs)],
    ['Posting Status', row.postingStatus]
  ];
}

function cashbookFields(row: CashbookEntry): Array<[string, string]> {
  return [
    ['Date', timeOnly(row.dateTime)],
    ['Account', row.account],
    ['Source', row.movementType],
    ['Reference', row.reference],
    ['Money In', money(row.cashIn)],
    ['Money Out', money(row.cashOut)],
    ['Balance Preview', money(row.balanceAfter)],
    ['Status', row.status],
    ['Notes', row.notes]
  ];
}

function vatFields(row: VATSummary): Array<[string, string]> {
  return [
    ['Date', row.date],
    ['Source', 'Sales VAT'],
    ['Reference', row.receiptNo],
    ['Tax Type', row.vatMode],
    ['Taxable Amount', money(row.vatableAmount)],
    ['VAT Amount', money(row.vatAmount)],
    ['Control Account', 'VAT Output Control'],
    ['Status', row.status]
  ];
}

function cogsFields(row: COGSReserveSummary): Array<[string, string]> {
  return [
    ['Date', '2026-06-09'],
    ['Movement Type', row.reserveStatus === 'Misuse Risk' ? 'Reserve Leakage' : 'COGS Reserve Movement'],
    ['Source', row.product],
    ['Reference', row.receiptReference],
    ['Amount', money(row.estimatedCOGS)],
    ['Reserve Balance After', money(row.suggestedReserve)],
    ['Control Account', 'COGS Reserve Control'],
    ['Status', row.reserveStatus]
  ];
}

function inventoryAssetFields(row: InventoryAssetPostingRow): Array<[string, string]> {
  return [
    ['Date', '2026-06-09'],
    ['Movement Type', row.movementType],
    ['Product / Reference', `${row.product} / ${row.reference}`],
    ['Branch / Warehouse', 'Current Branch / Warehouse'],
    ['Quantity', String(row.qtyIn - row.qtyOut)],
    ['Value', money(row.costImpact)],
    ['Inventory Control Account', row.assetAccount],
    ['Status', row.postingStatus],
    ['Risk', row.risk]
  ];
}

function inventoryReadinessFields(row: InventoryAccountingReadinessRecord): Array<[string, string]> {
  return [
    ['Check', row.readinessNumber],
    ['Area', row.impactType],
    ['Count / Amount', money(row.totalValueImpact)],
    ['Risk', row.riskLevel],
    ['Status', row.status],
    ['Required Action', row.recommendedAction]
  ];
}

function accountingReadinessFields(row: AccountingReadinessCheck): Array<[string, string]> {
  return [
    ['Domain', row.domain],
    ['Check', row.check],
    ['Ready Items', row.status === 'Passed' ? '1' : '0'],
    ['Review Items', row.status === 'Warning' || row.status === 'Pending' ? '1' : '0'],
    ['Issues', row.status === 'Failed' ? '1' : '0'],
    ['Status', row.status],
    ['Required Action', row.requiredAction]
  ];
}

function detailEventForTab(tab: AccountingDeskActionTab): Parameters<typeof recordAccountingActivity>[0] {
  const map: Record<AccountingDeskActionTab, Parameters<typeof recordAccountingActivity>[0]> = {
    'Sales Posting': 'SALES_POSTING_DETAIL_VIEWED',
    Cashbook: 'CASHBOOK_DETAIL_VIEWED',
    'VAT Summary': 'VAT_DETAIL_VIEWED',
    'COGS Reserve': 'COGS_RESERVE_ACCOUNTING_DETAIL_VIEWED',
    'Inventory Asset Posting': 'INVENTORY_ASSET_POSTING_DETAIL_VIEWED',
    'Inventory Accounting Readiness': 'INVENTORY_ACCOUNTING_READINESS_CHECK_VIEWED',
    'Accounting Readiness': 'ACCOUNTING_READINESS_DOMAIN_VIEWED'
  };
  return map[tab];
}

function reviewEventForTab(tab: AccountingDeskActionTab): Parameters<typeof recordAccountingActivity>[0] {
  const map: Record<AccountingDeskActionTab, Parameters<typeof recordAccountingActivity>[0]> = {
    'Sales Posting': 'SALES_POSTING_MARKED_REVIEWED',
    Cashbook: 'CASHBOOK_MARKED_REVIEWED',
    'VAT Summary': 'VAT_MARKED_REVIEWED',
    'COGS Reserve': 'COGS_RESERVE_ACCOUNTING_MARKED_REVIEWED',
    'Inventory Asset Posting': 'INVENTORY_ASSET_POSTING_MARKED_REVIEWED',
    'Inventory Accounting Readiness': 'INVENTORY_ACCOUNTING_READINESS_MARKED_REVIEWED',
    'Accounting Readiness': 'ACCOUNTING_READINESS_MARKED_REVIEWED'
  };
  return map[tab];
}

function issueEventForTab(tab: AccountingDeskActionTab): Parameters<typeof recordAccountingActivity>[0] {
  const map: Record<AccountingDeskActionTab, Parameters<typeof recordAccountingActivity>[0]> = {
    'Sales Posting': 'SALES_POSTING_ISSUE_FLAGGED',
    Cashbook: 'CASHBOOK_VARIANCE_FLAGGED',
    'VAT Summary': 'VAT_ISSUE_FLAGGED',
    'COGS Reserve': 'COGS_RESERVE_ACCOUNTING_ISSUE_FLAGGED',
    'Inventory Asset Posting': 'INVENTORY_ASSET_POSTING_ISSUE_FLAGGED',
    'Inventory Accounting Readiness': 'INVENTORY_ACCOUNTING_READINESS_BI_CREATED',
    'Accounting Readiness': 'ACCOUNTING_READINESS_BI_CREATED'
  };
  return map[tab];
}

function taskEventForTab(tab: AccountingDeskActionTab): Parameters<typeof recordAccountingActivity>[0] {
  const map: Record<AccountingDeskActionTab, Parameters<typeof recordAccountingActivity>[0]> = {
    'Sales Posting': 'SALES_POSTING_TASK_CREATED',
    Cashbook: 'CASHBOOK_OWNER_NOTE_ADDED',
    'VAT Summary': 'VAT_TASK_CREATED',
    'COGS Reserve': 'COGS_RESERVE_ACCOUNTING_TASK_CREATED',
    'Inventory Asset Posting': 'INVENTORY_ASSET_POSTING_TASK_CREATED',
    'Inventory Accounting Readiness': 'INVENTORY_ACCOUNTING_READINESS_TASK_CREATED',
    'Accounting Readiness': 'ACCOUNTING_READINESS_TASK_CREATED'
  };
  return map[tab];
}

function biEventForTab(tab: AccountingDeskActionTab): Parameters<typeof recordAccountingActivity>[0] {
  if (tab === 'VAT Summary') return 'VAT_RESERVE_WARNING_CREATED';
  if (tab === 'Inventory Accounting Readiness') return 'INVENTORY_ACCOUNTING_READINESS_BI_CREATED';
  if (tab === 'Accounting Readiness') return 'ACCOUNTING_READINESS_BI_CREATED';
  if (tab === 'Sales Posting') return 'SALES_POSTING_BI_WARNING_CREATED';
  return issueEventForTab(tab);
}

function reviewedStatusForTab(tab: AccountingDeskActionTab): string {
  if (tab === 'Accounting Readiness') return 'Passed';
  if (tab === 'COGS Reserve') return 'Review Required';
  return 'Reviewed';
}

function readyStatusForTab(tab: AccountingDeskActionTab): string {
  if (tab === 'Cashbook' || tab === 'VAT Summary' || tab === 'Inventory Asset Posting') return 'Ready for Review';
  if (tab === 'COGS Reserve') return 'Reserved';
  if (tab === 'Accounting Readiness') return 'Passed';
  return 'Reviewed';
}

function issueStatusForTab(tab: AccountingDeskActionTab): string {
  if (tab === 'COGS Reserve') return 'Review Required';
  if (tab === 'Accounting Readiness') return 'Warning';
  return 'Pending Review';
}

function permissionForTab(tab: AccountingDeskActionTab, action: 'view' | 'review' | 'issue'): PermissionKey {
  const map: Record<AccountingDeskActionTab, Record<'view' | 'review' | 'issue', PermissionKey>> = {
    'Sales Posting': { view: 'ownerDesk.accountingDesk.salesPosting.view', review: 'ownerDesk.accountingDesk.salesPosting.review', issue: 'ownerDesk.accountingDesk.salesPosting.review' },
    Cashbook: { view: 'ownerDesk.accountingDesk.cashbook.view', review: 'ownerDesk.accountingDesk.cashbook.review', issue: 'ownerDesk.accountingDesk.cashbook.review' },
    'VAT Summary': { view: 'ownerDesk.accountingDesk.vat.view', review: 'ownerDesk.accountingDesk.vat.review', issue: 'ownerDesk.accountingDesk.vat.flagIssue' },
    'COGS Reserve': { view: 'ownerDesk.accountingDesk.cogsReserve.view', review: 'ownerDesk.accountingDesk.cogsReserve.review', issue: 'ownerDesk.accountingDesk.cogsReserve.flagIssue' },
    'Inventory Asset Posting': { view: 'ownerDesk.accountingDesk.inventoryAsset.view', review: 'ownerDesk.accountingDesk.inventoryAsset.review', issue: 'ownerDesk.accountingDesk.inventoryAsset.flagIssue' },
    'Inventory Accounting Readiness': { view: 'ownerDesk.accountingDesk.inventoryReadiness.view', review: 'ownerDesk.accountingDesk.inventoryReadiness.manage', issue: 'ownerDesk.accountingDesk.inventoryReadiness.manage' },
    'Accounting Readiness': { view: 'ownerDesk.accountingDesk.readiness.view', review: 'ownerDesk.accountingDesk.readiness.review', issue: 'ownerDesk.accountingDesk.readiness.review' }
  };
  return map[tab][action];
}

function detailLabelForTab(tab: AccountingDeskActionTab): string {
  if (tab === 'Sales Posting') return 'View Sale Posting Detail';
  if (tab === 'Cashbook') return 'View Cashbook Detail';
  if (tab === 'VAT Summary') return 'View VAT Detail';
  if (tab === 'COGS Reserve') return 'View Reserve Detail';
  if (tab === 'Inventory Asset Posting') return 'View Inventory Posting Detail';
  if (tab === 'Inventory Accounting Readiness') return 'View Check Detail';
  return 'View Domain Detail';
}

function issueLabelForTab(tab: AccountingDeskActionTab): string {
  if (tab === 'Cashbook') return 'Flag Variance';
  if (tab === 'VAT Summary') return 'Flag VAT Issue';
  if (tab === 'COGS Reserve') return 'Flag Reserve Issue';
  if (tab === 'Inventory Asset Posting') return 'Flag Inventory Value Issue';
  return 'Flag Issue';
}

function printLabelForTab(tab: AccountingDeskActionTab): string {
  return tab === 'Accounting Readiness' ? 'Print Readiness Summary' : 'Print Detail';
}

function sourceLabelForTab(tab: AccountingDeskActionTab): string {
  if (tab === 'Inventory Asset Posting') return 'Open Inventory Source';
  if (tab === 'Inventory Accounting Readiness') return 'Open Source List';
  if (tab === 'Accounting Readiness') return 'Open Source Domain';
  if (tab === 'Sales Posting') return 'Open CAT';
  return 'Open Source Record';
}

function printAccountingDeskDetail(modal: AccountingDeskActionState): void {
  const rows = modal.fields.map(([label, value]) => `<tr><th>${label}</th><td>${cleanPaymentPostingLabel(value)}</td></tr>`).join('');
  const printWindow = window.open('', '_blank', 'width=900,height=720');
  if (!printWindow) return;
  printWindow.document.write(`<!doctype html><html><head><title>${modal.tab} ${modal.title}</title><style>body{font-family:Arial,sans-serif;background:#fff;color:#111;margin:32px}h1{font-size:20px;text-transform:uppercase;margin:0 0 4px}p{font-size:12px;color:#444;margin:0 0 18px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #999;padding:8px;text-align:left}th{background:#f1f5f9;text-transform:uppercase}</style></head><body><h1>${modal.tab}</h1><p>Accounting readiness preview only. Not final posted accounts.</p><table><tbody>${rows}</tbody></table></body></html>`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function exportAccountingDeskDetail(modal: AccountingDeskActionState): void {
  const csv = modal.fields.map(([label, value]) => `"${label.replace(/"/g, '""')}","${cleanPaymentPostingLabel(value).replace(/"/g, '""')}"`).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${modal.tab.replace(/\s+/g, '-').toLowerCase()}-${modal.rowId}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function matchesOwnerDeskSearch(search: string, values: Array<string | number | undefined>): boolean {
  const terms = search.toLowerCase().split(/\s+/).map((term) => term.trim()).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = values.map((value) => String(value ?? '')).join(' ').toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

function timeOnly(value?: string): string {
  if (!value) return 'Pending';
  if (!value.includes('T')) return value;
  return value.slice(11, 19);
}

function checklistFields(item: EODChecklistItem, lastChecked?: string): Array<[string, string]> {
  return [
    ['Area / Check', item.check || item.label || item.id],
    ['Area', item.domain || 'EOD'],
    ['Status', item.status],
    ['Risk', item.risk || 'Low'],
    ['Required Action', item.requiredAction || item.ownerAction || 'None'],
    ['Owner Decision', item.reviewedBy || item.notes || 'Pending'],
    ['Last Checked', timeOnly(lastChecked)],
    ['Notes', item.notes || 'No notes recorded']
  ];
}

function paymentFields(row: EODPaymentSummary): Array<[string, string]> {
  return [
    ['Payment Mode', row.paymentMode],
    ['Count', row.receiptCount.toString()],
    ['Gross Amount', money(row.grossAmount)],
    ['Refunds', money(row.refunds)],
    ['Net Amount', money(row.netAmount)],
    ['Drawer Impact', money(row.expectedSettlement)],
    ['Reconciled', displayAmount(row.declaredOrConfirmed)],
    ['Variance', displayAmount(row.variance)],
    ['Status', row.status]
  ];
}

function coaAccountFields(account: COAAccount): Array<[string, string]> {
  return [
    ['Account Code', account.accountCode],
    ['Account Name', account.accountName],
    ['Account Type', account.accountType],
    ['Linked Domain', account.linkedDomain],
    ['Status', account.status],
    ['Notes', account.notes || 'No notes recorded'],
    ['Created By', account.createdBy || 'Owner Desk'],
    ['Created At', account.createdAt || 'Local placeholder seed'],
    ['Updated At', account.updatedAt || 'No local update'],
    ['Used In Accounting Readiness Areas', `${account.linkedDomain} readiness preview`],
    ['Linked Transaction Domains', `${account.linkedDomain}, EOD Accounting, Owner Desk Accounting Preview`],
    ['Audit / Activity History', account.inactiveReason || account.notes || 'Visible in local accounting readiness history']
  ];
}

function buildOwnerDeskPrintHtml(domain: string, title: string, fields: Array<[string, string]>): string {
  return `
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #111827; padding: 24px; }
          h1 { color: #1f2529; font-size: 18px; text-transform: uppercase; border-bottom: 3px solid #f26a1b; padding-bottom: 8px; }
          h2 { color: #c94f0f; font-size: 12px; text-transform: uppercase; }
          table { border-collapse: collapse; width: 100%; margin-top: 18px; }
          th, td { border: 1px solid #b8b2aa; padding: 8px; text-align: left; font-size: 12px; }
          th { background: #1f2529; color: #ffffff; text-transform: uppercase; width: 32%; }
        </style>
      </head>
      <body>
        <h2>${domain}</h2>
        <h1>${title}</h1>
        <table><tbody>${fields.map(([label, value]) => `<tr><th>${label}</th><td>${value}</td></tr>`).join('')}</tbody></table>
      </body>
    </html>
  `;
}

function toOwnerDeskRole(value?: string): Role {
  const roles: Role[] = ['Owner', 'SysAdmin', 'Manager', 'Cashier', 'Stock Controller', 'Supervisor', 'Delivery Staff', 'Accountant', 'Viewer'];
  return roles.includes(value as Role) ? value as Role : 'Owner';
}

function sum<T extends Record<string, unknown>>(rows: T[], key: keyof T): number {
  return rows.reduce((total, row) => total + (typeof row[key] === 'number' ? row[key] : 0), 0);
}
