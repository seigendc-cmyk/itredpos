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
  reverseAccountingPostingPlaceholder
} from '../services/accountingService';
import InventoryAccountingReadinessForm from '../components/InventoryAccountingReadinessForm';
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
  Reversed: 'bg-slate-100 text-slate-700 border-slate-300',
  Settled: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  Placeholder: 'bg-orange-50 text-orange-800 border-orange-300',
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
    const [nextCOA, nextSales, nextPayments, nextCashbook, nextVAT, nextCOGS, nextInventoryAsset, nextReadiness, nextActivity, nextInventoryAccounting, nextInventorySummary, nextChartAccounts, nextMappingRules, nextInventoryAccountingActivity] =
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
        getInventoryAccountingActivityEvents()
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
  };

  const showFeedback = (type: FeedbackType, message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000);
  };

  const hasCashPermission = (permission: PermissionKey) => canPerformAction(currentRole, permission);

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
          <div className="industrial-toolbar">
            {accountingTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveAccountingTab(tab)}
                className={`industrial-tab ${
                  activeAccountingTab === tab
                    ? 'active'
                    : ''
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {activeAccountingTab === 'COA Accounts' && (
            <div className="space-y-5">
              <Panel title="New COA Account Placeholder" icon={<ClipboardCheck className="w-4 h-4 text-orange-500" />}>
                <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
                  <Input label="Account Code" value="New Code" onChange={() => undefined} />
                  <Input label="Account Name" value="New Account Placeholder" onChange={() => undefined} />
                  <Select label="Account Type" value="Asset" onChange={() => undefined} options={accountTypes} />
                  <Input label="Linked Domain" value="Sales" onChange={() => undefined} />
                  <Select label="Status" value="Draft" onChange={() => undefined} options={['Active', 'Inactive', 'Draft']} />
                  <Input label="Notes" value="Placeholder account note" onChange={() => undefined} />
                  <ActionButton icon={<ClipboardCheck className="w-4 h-4" />} onClick={handleCreatePostingPlaceholder}>Add New COA Account</ActionButton>
                </div>
              </Panel>
              <Panel title="Chart of Accounts Placeholder" icon={<DollarSign className="w-4 h-4 text-orange-500" />}>
                <Table>
                  <thead><tr><Th>Account Code</Th><Th>Account Name</Th><Th>Account Type</Th><Th>Linked Domain</Th><Th>Status</Th><Th>Action</Th></tr></thead>
                  <tbody>
                    {coaAccounts.map((account) => (
                      <tr key={account.id} className="border-t border-slate-100 hover:bg-slate-50">
                        <Td strong>{account.accountCode}</Td><Td>{account.accountName}</Td><Td>{account.accountType}</Td><Td>{account.linkedDomain}</Td><Td><Badge value={account.status} /></Td>
                        <Td><div className="flex gap-1"><SmallAction onClick={() => undefined}>View</SmallAction><SmallAction onClick={() => undefined}>Edit Draft</SmallAction><SmallAction onClick={() => undefined}>Mark Inactive</SmallAction></div></Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
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
                ['VAT Output Placeholder', money(sum(salesAccountingRows, 'vat'))],
                ['COGS Placeholder', money(164.5)],
                ['Gross Profit Placeholder', money(1062.5)]
              ]} />
              <Panel title="Sales Posting Summary" icon={<DollarSign className="w-4 h-4 text-orange-500" />}>
                <OwnerDeskFilterBar search={accountingSearch} onSearch={setAccountingSearch} filters={[]} activeCount={accountingSearch ? 1 : 0} onClear={() => setAccountingSearch('')} />
                <Table>
                  <thead><tr><Th>Receipt No.</Th><Th>Date / Time</Th><Th>Branch</Th><Th>Terminal</Th><Th>Cashier</Th><Th>Gross Sale</Th><Th>Discount</Th><Th>VAT</Th><Th>Net Sale</Th><Th>Sales Account</Th><Th>Posting Status</Th><Th>Action</Th></tr></thead>
                  <tbody>
                    {filteredSalesAccountingRows.map((row) => (
                      <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50">
                        <Td strong>{row.receiptNo}</Td><Td>{timeOnly(row.dateTime)}</Td><Td>{row.branch}</Td><Td>{row.terminal}</Td><Td>{row.cashier}</Td><Td>{money(row.grossSale)}</Td><Td>{money(row.discount)}</Td><Td>{money(row.vat)}</Td><Td>{money(row.netSale)}</Td><Td>{row.salesAccount}</Td><Td><Badge value={row.postingStatus} /></Td>
                        <Td><AccountingActionGroup id={row.receiptNo} openId={openOwnerActionMenuId} setOpenId={setOpenOwnerActionMenuId} onReview={handleAccountingReviewed} onReverse={handleAccountingReverse} onAction={(message) => void handleOwnerPlaceholderEvent('Accounting Desk', 'OWNER_DESK_PLACEHOLDER_VIEWED', message)} /></Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Panel>
            </div>
          )}

          {activeAccountingTab === 'Payment Posting' && (
            <Panel title="Payment Posting Summary" icon={<DollarSign className="w-4 h-4 text-orange-500" />}>
              <Table>
                <thead><tr><Th>Payment Mode</Th><Th>Receipts</Th><Th>Gross Amount</Th><Th>Refunds</Th><Th>Net Amount</Th><Th>Control Account</Th><Th>Settlement Status</Th><Th>Variance</Th><Th>Posting Status</Th><Th>Action</Th></tr></thead>
                <tbody>
                  {paymentAccountingRows.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <Td strong>{row.paymentMode}</Td><Td>{row.receiptCount}</Td><Td>{money(row.grossAmount)}</Td><Td>{money(row.refunds)}</Td><Td>{money(row.netAmount)}</Td><Td>{row.controlAccount}</Td><Td><Badge value={row.settlementStatus} /></Td><Td>{displayAmount(row.variance)}</Td><Td><Badge value={row.postingStatus} /></Td>
                      <Td><div className="flex gap-1"><SmallAction onClick={() => handleAccountingReviewed(row.id)}>Mark Settled Placeholder</SmallAction><SmallAction onClick={() => undefined}>View Receipts</SmallAction><SmallAction onClick={() => undefined}>Flag Variance</SmallAction></div></Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
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
                        <Td strong>{timeOnly(row.dateTime)}</Td><Td>{row.branch}</Td><Td>{row.terminal}</Td><Td>{row.staff}</Td><Td>{row.movementType}</Td><Td>{row.reference}</Td><Td>{money(row.cashIn)}</Td><Td>{money(row.cashOut)}</Td><Td>{money(row.balanceAfter)}</Td><Td>{row.account}</Td><Td><Badge value={row.status} /></Td><Td>{row.notes}</Td><Td><SmallAction onClick={() => handleAccountingReviewed(row.reference)}>Mark Reviewed</SmallAction></Td>
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
                ['VAT Output Placeholder', money(sum(vatRows, 'vatAmount'))],
                ['Non-VAT Sales', money(0)],
                ['Refund VAT Impact', money(10.5)],
                ['Net VAT Output Placeholder', money(Math.max(sum(vatRows, 'vatAmount') - 10.5, 0))],
                ['VAT Registration Status', 'Tax-ready placeholder']
              ]} />
              <Panel title="VAT Summary" icon={<ShieldAlert className="w-4 h-4 text-orange-500" />}>
                <div className="mb-3 bg-orange-50 border border-orange-200 text-orange-900 p-3 text-[10px] font-bold">
                  This POS is tax-ready, but fiscalization and official tax submission will be connected later.
                </div>
                <Table>
                  <thead><tr><Th>Receipt No.</Th><Th>Date</Th><Th>Gross Amount</Th><Th>VATable Amount</Th><Th>VAT Amount</Th><Th>VAT Mode</Th><Th>VAT Number</Th><Th>Status</Th></tr></thead>
                  <tbody>
                    {vatRows.map((row) => (
                      <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50">
                        <Td strong>{row.receiptNo}</Td><Td>{row.date}</Td><Td>{money(row.grossAmount)}</Td><Td>{money(row.vatableAmount)}</Td><Td>{money(row.vatAmount)}</Td><Td>{row.vatMode}</Td><Td>{row.vatNumber}</Td><Td><Badge value={row.status} /></Td>
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
                ['Reserve Used Placeholder', money(0)],
                ['Reserve Misuse Risk', cogsRows.filter((row) => row.reserveStatus === 'Misuse Risk').length.toString()],
                ['Available Reserve Placeholder', money(sum(cogsRows, 'suggestedReserve'))]
              ]} />
              <Panel title="COGS Reserve Placeholder" icon={<PackageCheck className="w-4 h-4 text-orange-500" />}>
                <Table>
                  <thead><tr><Th>Product</Th><Th>Receipt / Reference</Th><Th>Qty Sold</Th><Th>Unit Cost</Th><Th>Selling Price</Th><Th>Estimated COGS</Th><Th>Suggested Reserve</Th><Th>Reserve Status</Th><Th>Action</Th></tr></thead>
                  <tbody>
                    {cogsRows.map((row) => (
                      <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50">
                        <Td strong>{row.product}</Td><Td>{row.receiptReference}</Td><Td>{row.qtySold}</Td><Td>{money(row.unitCost)}</Td><Td>{money(row.sellingPrice)}</Td><Td>{money(row.estimatedCOGS)}</Td><Td>{money(row.suggestedReserve)}</Td><Td><Badge value={row.reserveStatus} /></Td><Td><SmallAction onClick={() => handleAccountingReviewed(row.id)}>Mark Reviewed</SmallAction></Td>
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
                <thead><tr><Th>Product</Th><Th>Movement Type</Th><Th>Reference</Th><Th>Qty In</Th><Th>Qty Out</Th><Th>Unit Cost</Th><Th>Cost Impact</Th><Th>Asset Account</Th><Th>COGS Account</Th><Th>Sales Account</Th><Th>Posting Status</Th><Th>Risk</Th><Th>Action</Th></tr></thead>
                <tbody>
                  {inventoryAssetRows.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <Td strong>{row.product}</Td><Td>{row.movementType}</Td><Td>{row.reference}</Td><Td>{row.qtyIn}</Td><Td>{row.qtyOut}</Td><Td>{money(row.unitCost)}</Td><Td>{money(row.costImpact)}</Td><Td>{row.assetAccount}</Td><Td>{row.cogsAccount}</Td><Td>{row.salesAccount}</Td><Td><Badge value={row.postingStatus} /></Td><Td><Badge value={row.risk} risk /></Td><Td><SmallAction onClick={() => handleAccountingReviewed(row.id)}>Mark Reviewed</SmallAction></Td>
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
                  <Select label="Status" value={inventoryAccountingFilters.status || 'ALL'} onChange={(value) => setInventoryAccountingFilters((current) => ({ ...current, status: value as InventoryAccountingFilterState['status'] }))} options={['ALL', 'Pending Review', 'Reviewed', 'Approved For Posting', 'Posted Placeholder', 'Rejected', 'On Hold', 'Reversal Requested', 'Closed']} />
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
                        <Td>
                          <div className="flex flex-wrap gap-1">
                            <SmallAction onClick={() => void openInventoryAccountingRecord(row)}>Open Review</SmallAction>
                            <SmallAction onClick={() => {
                              if (!ensureInventoryAccountingPermission('inventoryAccounting.review')) {
                                return;
                              }
                              void reviewInventoryAccountingRecord(row.readinessId, staffName, 'Quick review from Owner Desk.').then(() => refreshInventoryAccounting(row.readinessId));
                            }}>Quick Review</SmallAction>
                          </div>
                        </Td>
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
                <thead><tr><Th>Check</Th><Th>Domain</Th><Th>Status</Th><Th>Required Action</Th></tr></thead>
                <tbody>
                  {accountingReadiness.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <Td strong>{row.check}</Td><Td>{row.domain}</Td><Td><Badge value={row.status} /></Td><Td>{row.requiredAction}</Td>
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

function ActionGroup({ id, onReview }: { id: string; onReview: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      <SmallAction onClick={() => undefined}>Review</SmallAction>
      <SmallAction onClick={() => onReview(id)}>Mark Reviewed</SmallAction>
      <SmallAction onClick={() => undefined}>Open Related Record</SmallAction>
    </div>
  );
}

function PaymentActionGroup({ id, onReview }: { id: string; onReview: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      <SmallAction onClick={() => undefined}>View Receipts</SmallAction>
      <SmallAction onClick={() => onReview(id)}>Mark Reviewed</SmallAction>
      <SmallAction onClick={() => undefined}>Flag Variance</SmallAction>
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
        { label: 'Force Close Placeholder', icon: <Lock className="w-3.5 h-3.5" />, onClick: () => onForceClose(`Force close request recorded for ${shiftId}.`) },
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
