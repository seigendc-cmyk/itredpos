import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Check,
  Edit3,
  Eye,
  FileDown,
  FileText,
  History,
  MessageCircle,
  MessageSquare,
  Plus,
  RotateCcw,
  Search,
  ShoppingCart,
  ShieldAlert,
  Trash2,
  UserCheck,
  UserPlus,
  X
} from 'lucide-react';
import NewCustomerModal from '../components/NewCustomerModal';
import CustomerCreditWorthinessPanel from '../components/CustomerCreditWorthinessPanel';
import CustomerStatementPanel from '../components/CustomerStatementPanel';
import DebtorsControlDeskPanel from '../components/DebtorsControlDeskPanel';
import RecordDebtPaymentModal from '../components/RecordDebtPaymentModal';
import RowActionMenu, { RowActionMenuItem } from '../components/RowActionMenu';
import {
  CustomerAgeingAnalysis,
  CustomerAgeingIntervalConfig,
  CustomerActivityEvent,
  CustomerBehaviourAnalytics,
  CustomerBuyingPreferenceProfile,
  CustomerCreditProfile,
  CustomerCreditStatus,
  CustomerCreditWorthinessScore,
  CustomerDebtRecord,
  CustomerFilterState,
  CustomerNote,
  CustomerPurchaseHistoryRow,
  CustomerRecord,
  CustomerSource,
  CustomerStatus,
  CustomerSummary,
  CustomerType,
  PosSession,
  Role
} from '../types';
import {
  calculateCustomerAgeingAnalysis,
  calculateCustomerBehaviourAnalytics,
  calculateCustomerBuyingPreferences,
  calculateCustomerCreditWorthiness,
  createCustomerCreditApprovalRequest,
  createCustomerCreditBIAdvice,
  getAgeingIntervalConfigs,
  getCustomerCreditActivityEvents,
  getCustomerCreditProfile,
  recordCustomerDebtPayment,
  saveAgeingIntervalConfig
} from '../services/customerCreditService';
import {
  addCustomerNote,
  approveCustomer,
  createCustomer,
  createCustomerRequest,
  exportCustomerListPlaceholder,
  getCustomerActivityEvents,
  getCustomerNotes,
  getCustomerPurchaseHistory,
  getCustomerSummary,
  getCustomers,
  markCustomerCreditReview,
  markCustomerDuplicate,
  reactivateCustomer,
  recordCustomerSaleBridgeEvent,
  recordCustomerSelectedForSale,
  rejectCustomer,
  suspendCustomer,
  updateCustomer,
  type CustomerCreatePayload
} from '../services/customerService';
import { hasPermission, type PermissionKey } from '../utils/posPermissions';

interface PosCustomerDeskProps {
  session: PosSession;
  onNavigate?: (page: string) => void;
}

type CustomerTab = 'Customer List' | 'Customer Requests' | 'Customer Profile' | 'Purchase History' | 'Credit & Ageing' | 'Debtors Control Desk' | 'Customer Statements' | 'Buying Behaviour' | 'Customer Notes' | 'Customer Activity';

const tabs: CustomerTab[] = ['Customer List', 'Customer Requests', 'Customer Profile', 'Purchase History', 'Credit & Ageing', 'Debtors Control Desk', 'Customer Statements', 'Buying Behaviour', 'Customer Notes', 'Customer Activity'];
const customerTypes: Array<CustomerType | 'All'> = ['All', 'Walk-in', 'Individual', 'Business', 'Government', 'School', 'Fleet Customer', 'Dealer', 'Internal Account'];
const customerStatuses: Array<CustomerStatus | 'All'> = ['All', 'Pending Approval', 'Active', 'Rejected', 'Duplicate', 'Suspended', 'Inactive'];
const creditStatuses: Array<CustomerCreditStatus | 'All'> = ['All', 'Cash Only', 'Credit Allowed', 'Credit Suspended', 'Credit Review Required', 'Not Applicable'];
const sources: Array<CustomerSource | 'All'> = ['All', 'Walk-in', 'WhatsApp Catalogue', 'Commerce Access Hub', 'Referral', 'Phone Call', 'Facebook', 'Sales Terminal', 'Imported', 'Other'];
const permissionBlockedMessage = 'You do not have permission to perform this action.';
const SELECTED_CUSTOMER_FOR_SALE_KEY = 'itred-pos-selected-customer-for-sale';
const SELECTED_CUSTOMER_FOR_SALE_SESSION_KEY = 'itred_pos_selected_customer_for_sale_v1';

interface SelectedCustomerForSaleBridge {
  customerId: string;
  customerCode: string;
  customerName: string;
  customerType: CustomerType;
  phone: string;
  whatsapp: string;
  email: string;
  cityTown: string;
  district: string;
  suburb: string;
  address: string;
  taxNumber: string;
  creditStatus: CustomerCreditStatus;
  creditLimit?: number;
  selectedAt: string;
  selectedByStaffId: string;
  source: 'Customer Centre';
}

function money(value?: number): string {
  return `USD ${(value || 0).toFixed(2)}`;
}

function dateLabel(value: string): string {
  return new Date(value).toLocaleString();
}

function statusClass(status: CustomerStatus): string {
  if (status === 'Active') return 'sci-status-pill--success';
  if (status === 'Rejected' || status === 'Suspended') return 'sci-status-pill--danger';
  return 'sci-status-pill--warning';
}

function eventTitle(value: CustomerActivityEvent['eventType']): string {
  return value.toLowerCase().split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function creditLabel(value: CustomerCreditStatus): string {
  if (value === 'Credit Review Required') return 'Review';
  if (value === 'Credit Suspended') return 'Suspended';
  return value;
}

function exportCsv(filename: string, rows: string[][]) {
  const content = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function readSelectedCustomerForSaleBridge(): SelectedCustomerForSaleBridge | null {
  try {
    const raw = localStorage.getItem(SELECTED_CUSTOMER_FOR_SALE_KEY) || sessionStorage.getItem(SELECTED_CUSTOMER_FOR_SALE_SESSION_KEY);
    return raw ? JSON.parse(raw) as SelectedCustomerForSaleBridge : null;
  } catch {
    return null;
  }
}

function writeSelectedCustomerForSaleBridge(payload: SelectedCustomerForSaleBridge): void {
  try {
    localStorage.setItem(SELECTED_CUSTOMER_FOR_SALE_KEY, JSON.stringify(payload));
  } catch {
    // Local bridge is best-effort.
  }
  try {
    sessionStorage.setItem(SELECTED_CUSTOMER_FOR_SALE_SESSION_KEY, JSON.stringify(payload));
  } catch {
    // Session bridge is best-effort.
  }
}

function clearSelectedCustomerForSaleBridge(): void {
  try {
    localStorage.removeItem(SELECTED_CUSTOMER_FOR_SALE_KEY);
  } catch {
    // Local bridge is best-effort.
  }
  try {
    sessionStorage.removeItem(SELECTED_CUSTOMER_FOR_SALE_SESSION_KEY);
  } catch {
    // Session bridge is best-effort.
  }
}

export default function PosCustomerDesk({ session, onNavigate }: PosCustomerDeskProps) {
  const roleName = session.role as Role;
  const [activeTab, setActiveTab] = useState<CustomerTab>('Customer List');
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [summary, setSummary] = useState<CustomerSummary | null>(null);
  const [filters, setFilters] = useState<CustomerFilterState>({ status: 'All', customerType: 'All', creditStatus: 'All', source: 'All' });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState('CUST-WALKIN');
  const [history, setHistory] = useState<CustomerPurchaseHistoryRow[]>([]);
  const [notes, setNotes] = useState<CustomerNote[]>([]);
  const [activity, setActivity] = useState<CustomerActivityEvent[]>([]);
  const [noteText, setNoteText] = useState('');
  const [quickNoteCustomer, setQuickNoteCustomer] = useState<CustomerRecord | null>(null);
  const [quickNoteText, setQuickNoteText] = useState('');
  const [notice, setNotice] = useState('');
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<CustomerRecord | null>(null);
  const [ageingAnalysis, setAgeingAnalysis] = useState<CustomerAgeingAnalysis | null>(null);
  const [creditProfile, setCreditProfile] = useState<CustomerCreditProfile | null>(null);
  const [creditScore, setCreditScore] = useState<CustomerCreditWorthinessScore | null>(null);
  const [buyingPreferences, setBuyingPreferences] = useState<CustomerBuyingPreferenceProfile | null>(null);
  const [behaviourAnalytics, setBehaviourAnalytics] = useState<CustomerBehaviourAnalytics | null>(null);
  const [ageingConfigs, setAgeingConfigs] = useState<CustomerAgeingIntervalConfig[]>([]);
  const [ageingDraft, setAgeingDraft] = useState<CustomerAgeingIntervalConfig | null>(null);
  const [paymentDebt, setPaymentDebt] = useState<CustomerDebtRecord | null>(null);
  const [selectedForSale, setSelectedForSale] = useState<SelectedCustomerForSaleBridge | null>(() => readSelectedCustomerForSaleBridge());

  const selectedCustomer = customers.find((customer) => customer.customerId === selectedCustomerId) || customers[0] || null;
  const canCreateDirect = hasPermission(roleName, 'customers.createDirect');
  const canUseInSale = hasPermission(roleName, 'customers.useInSale');
  const canOpenSalesTerminal = hasPermission(roleName, 'sales.open');

  const loadCustomers = async () => {
    const [rows, nextSummary] = await Promise.all([getCustomers(filters), getCustomerSummary(filters)]);
    setCustomers(rows);
    setSummary(nextSummary);
    setSelectedCustomerId((current) => current || rows[0]?.customerId || '');
  };

  const loadSelectedDetails = async (customerId: string) => {
    const [historyRows, noteRows, activityRows, profile, score, analysis, configs, preferences, behaviour, creditEvents] = await Promise.all([
      getCustomerPurchaseHistory(customerId),
      getCustomerNotes(customerId),
      getCustomerActivityEvents(customerId),
      getCustomerCreditProfile(customerId),
      calculateCustomerCreditWorthiness(customerId),
      calculateCustomerAgeingAnalysis({ customerId }),
      Promise.resolve(getAgeingIntervalConfigs()),
      calculateCustomerBuyingPreferences(customerId),
      calculateCustomerBehaviourAnalytics(customerId),
      getCustomerCreditActivityEvents({ customerId })
    ]);
    setHistory(historyRows);
    setNotes(noteRows);
    setActivity([
      ...creditEvents.map((event) => ({
        id: event.id,
        customerId: event.customerId,
        dateTime: event.dateTime,
        eventType: 'CUSTOMER_CREDIT_REVIEW_REQUIRED' as const,
        user: event.user,
        notes: `${event.eventType}: ${event.notes}`
      })),
      ...activityRows
    ]);
    setCreditProfile(profile);
    setCreditScore(score);
    setAgeingAnalysis(analysis);
    setAgeingConfigs(configs);
    setAgeingDraft(configs.find((config) => config.active) || configs[0] || null);
    setBuyingPreferences(preferences);
    setBehaviourAnalytics(behaviour);
  };

  useEffect(() => {
    void loadCustomers();
  }, [filters]);

  useEffect(() => {
    if (selectedCustomerId) void loadSelectedDetails(selectedCustomerId);
  }, [selectedCustomerId]);

  const requests = useMemo(() => customers.filter((customer) =>
    customer.status === 'Pending Approval' || customer.status === 'Duplicate' || customer.status === 'Rejected'
  ), [customers]);

  const requirePermission = (permission: PermissionKey): boolean => {
    if (hasPermission(roleName, permission)) return true;
    setNotice(permissionBlockedMessage);
    return false;
  };

  const refreshAfterAction = async (message: string, customerId = selectedCustomerId) => {
    setNotice(message);
    await loadCustomers();
    if (customerId) await loadSelectedDetails(customerId);
  };

  const handleProfile = (customer: CustomerRecord) => {
    setSelectedCustomerId(customer.customerId);
    setActiveTab('Customer Profile');
  };

  const handleSubmitCustomer = async (payload: CustomerCreatePayload, useInSale: boolean) => {
    if (editCustomer) {
      if (!requirePermission('customers.edit')) return;
      const updated = await updateCustomer(editCustomer.customerId, payload, session.staffName, 'Customer edited from Customer Centre.');
      if (updated) setSelectedCustomerId(updated.customerId);
      setEditCustomer(null);
      await refreshAfterAction('Customer updated.', editCustomer.customerId);
      return;
    }
    if (!requirePermission('customers.createDirect')) return;
    const customer = await createCustomer(payload, session.staffName);
    setSelectedCustomerId(customer.customerId);
    if (useInSale) await handleUseInSale(customer, false);
    await refreshAfterAction(useInSale ? 'Customer created and selected for sale.' : 'Customer created.', customer.customerId);
  };

  const handleApprove = async (customer: CustomerRecord) => {
    if (!requirePermission('customers.requests.approve')) return;
    await approveCustomer(customer.customerId, session.staffName, 'Approved from Customer Centre.');
    await refreshAfterAction('Customer approved.', customer.customerId);
  };

  const handleReject = async (customer: CustomerRecord) => {
    if (!requirePermission('customers.requests.approve')) return;
    await rejectCustomer(customer.customerId, session.staffName, 'Rejected from Customer Centre.');
    await refreshAfterAction('Customer rejected.', customer.customerId);
  };

  const handleDuplicate = async (customer: CustomerRecord) => {
    if (!requirePermission('customers.requests.approve')) return;
    await markCustomerDuplicate(customer.customerId, 'Duplicate Review Placeholder', session.staffName, 'Duplicate warning placeholder confirmed.');
    await refreshAfterAction('Customer marked duplicate.', customer.customerId);
  };

  const handleSuspend = async (customer: CustomerRecord) => {
    if (!requirePermission('customers.suspend')) return;
    const reason = window.prompt('Suspend reason', 'Suspended from Customer Centre.');
    if (reason === null) return;
    await suspendCustomer(customer.customerId, session.staffName, reason.trim() || 'Suspended from Customer Centre.');
    await refreshAfterAction('Customer suspended.', customer.customerId);
  };

  const handleReactivate = async (customer: CustomerRecord) => {
    if (!requirePermission('customers.reactivate')) return;
    await reactivateCustomer(customer.customerId, session.staffName, 'Reactivated from Customer Centre.');
    await refreshAfterAction('Customer reactivated.', customer.customerId);
  };

  const handleCreditReview = async (customer: CustomerRecord) => {
    if (!requirePermission('customers.creditReview')) return;
    await markCustomerCreditReview(customer.customerId, session.staffName, 'Marked for credit review from Customer Centre.');
    await refreshAfterAction('Customer marked for credit review.', customer.customerId);
  };

  const handleAddNote = async () => {
    if (!selectedCustomer || !noteText.trim()) return;
    if (!requirePermission('customers.notes.create')) return;
    await addCustomerNote(selectedCustomer.customerId, session.staffName, noteText.trim(), roleName);
    setNoteText('');
    await refreshAfterAction('Customer note saved.', selectedCustomer.customerId);
  };

  const handleQuickNote = async () => {
    if (!quickNoteCustomer || !quickNoteText.trim()) return;
    if (!requirePermission('customers.notes.create')) return;
    await addCustomerNote(quickNoteCustomer.customerId, session.staffName, quickNoteText.trim(), roleName);
    setQuickNoteCustomer(null);
    setQuickNoteText('');
    await refreshAfterAction('Customer note saved.', quickNoteCustomer.customerId);
  };

  const handleUseInSale = async (customer: CustomerRecord, showNotice = true) => {
    if (!requirePermission('customers.useInSale')) return;
    setSelectedCustomerId(customer.customerId);
    await recordCustomerSelectedForSale(customer.customerId, session.staffName);
    const payload: SelectedCustomerForSaleBridge = {
      customerId: customer.customerId,
      customerCode: customer.customerCode,
      customerName: customer.customerName,
      customerType: customer.customerType,
      phone: customer.phone,
      whatsapp: customer.whatsapp,
      email: customer.email,
      cityTown: customer.cityTown,
      district: customer.district,
      suburb: customer.suburb,
      address: customer.deliveryAddress || customer.billingAddress,
      taxNumber: customer.taxNumber,
      creditStatus: customer.creditStatus,
      creditLimit: customer.creditLimit,
      selectedAt: new Date().toISOString(),
      selectedByStaffId: session.staffName,
      source: 'Customer Centre'
    };
    writeSelectedCustomerForSaleBridge(payload);
    setSelectedForSale(payload);
    await recordCustomerSaleBridgeEvent(customer.customerId, session.staffName, 'CUSTOMER_SELECTED_SALES_TERMINAL_CTA_SHOWN', 'Open Sales Terminal CTA shown after customer selection.');
    if (showNotice) setNotice(`${customer.customerName} selected for sale.`);
  };

  const handleOpenSalesTerminal = async () => {
    if (!selectedForSale) return;
    if (!canOpenSalesTerminal) {
      setNotice('You do not have permission to open Sales Terminal.');
      return;
    }
    await recordCustomerSaleBridgeEvent(selectedForSale.customerId, session.staffName, 'CUSTOMER_SELECTED_SALES_TERMINAL_OPENED', 'Open Sales Terminal CTA clicked from Customer Centre.');
    onNavigate?.('SALES');
  };

  const handleClearSelectedForSale = async () => {
    const current = selectedForSale;
    clearSelectedCustomerForSaleBridge();
    setSelectedForSale(null);
    setNotice('Selected customer cleared.');
    if (current) await recordCustomerSaleBridgeEvent(current.customerId, session.staffName, 'CUSTOMER_SELECTED_FOR_SALE_CLEARED', 'Selected customer for sale bridge cleared from Customer Centre.');
  };

  const handleWhatsApp = (customer: CustomerRecord) => {
    if (!requirePermission('customers.whatsappMessage')) return;
    const rawNumber = customer.whatsapp || customer.phone;
    const fallbackNumber = rawNumber || window.prompt('WhatsApp phone number', '');
    if (!fallbackNumber) {
      setNotice('WhatsApp message cancelled. No phone number was provided.');
      return;
    }
    const phone = fallbackNumber.replace(/[^\d]/g, '');
    window.open(`https://wa.me/${phone}`, '_blank', 'noopener,noreferrer');
  };

  const handleCreateRequest = async (customer: CustomerRecord) => {
    if (!requirePermission('customers.requests.create')) return;
    await createCustomerRequest({
      customerName: customer.customerName,
      phone: customer.phone,
      whatsapp: customer.whatsapp,
      email: customer.email,
      taxNumber: customer.taxNumber,
      billingAddress: customer.billingAddress,
      deliveryAddress: customer.deliveryAddress,
      cityTown: customer.cityTown,
      district: customer.district,
      suburb: customer.suburb,
      notes: `Request created from customer row ${customer.customerCode}.`,
      source: customer.source,
      requestedByStaffId: session.staffName,
      requestedByStaffName: session.staffName,
      requestedByRole: roleName
    }, session.staffName);
    await refreshAfterAction('Customer request created.', customer.customerId);
  };

  const handleExportRow = (customer: CustomerRecord) => {
    if (!requirePermission('customers.export')) return;
    exportCsv(`${customer.customerCode}.csv`, [
      ['Customer Code', 'Customer Name', 'Type', 'Phone', 'WhatsApp', 'Email', 'Source', 'Status', 'Credit Status'],
      [customer.customerCode, customer.customerName, customer.customerType, customer.phone, customer.whatsapp, customer.email, customer.source, customer.status, customer.creditStatus]
    ]);
    setNotice('Customer row exported.');
  };

  const handleExport = async () => {
    if (!requirePermission('customers.export')) return;
    setNotice(await exportCustomerListPlaceholder(filters));
  };

  const refreshCreditPanels = async (customerId = selectedCustomerId) => {
    if (!customerId) return;
    await loadSelectedDetails(customerId);
  };

  const handleSaveAgeingConfig = async () => {
    if (!ageingDraft) return;
    if (!requirePermission('customers.credit.ageing.configure')) return;
    try {
      saveAgeingIntervalConfig(ageingDraft);
      await refreshCreditPanels();
      setNotice('Ageing interval config saved locally.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Ageing config validation failed.');
    }
  };

  const handleDebtAction = async (debt: CustomerDebtRecord, action: string) => {
    if (action === 'Record Payment') {
      if (!requirePermission('customers.credit.recordPayment')) return;
      setPaymentDebt(debt);
      return;
    }
    if (action === 'Open Customer Profile') {
      setSelectedCustomerId(debt.customerId);
      setActiveTab('Customer Profile');
      return;
    }
    if (action === 'Send WhatsApp Reminder') {
      if (!requirePermission('customers.whatsappReminder')) return;
      setNotice(`Local WhatsApp reminder prepared for ${debt.customerName}: ${money(debt.outstandingAmount)} due ${new Date(debt.dueDate).toLocaleDateString()}.`);
      return;
    }
    if (action === 'Escalate to Manager' || action === 'Mark Written Off') {
      if (action === 'Mark Written Off' && !requirePermission('customers.credit.writeOff')) return;
      await createCustomerCreditApprovalRequest({
        customerName: debt.customerName,
        requestedBy: session.staffName,
        requestedByRole: roleName,
        branchId: debt.branchId,
        branch: debt.branchName,
        relatedRecord: debt.receiptNumber,
        amountOrValue: money(debt.outstandingAmount),
        risk: action === 'Mark Written Off' ? 'High' : 'Medium',
        reason: action,
        context: `${action} requested locally from Customer Centre.`
      });
      setNotice(`${action} approval request created locally.`);
      return;
    }
    if (action === 'Create Follow-up Task') {
      await createCustomerCreditBIAdvice('CUSTOMER_CREDIT_FOLLOW_UP_TASK', debt.customerName, `Follow up ${debt.customerName} for ${money(debt.outstandingAmount)} on ${debt.receiptNumber}.`, 'Medium');
      setNotice('Follow-up task placeholder created in BI Advice Flow.');
      return;
    }
    if (action === 'Mark Disputed') {
      await createCustomerCreditBIAdvice('CUSTOMER_DEBT_DISPUTED', debt.customerName, `${debt.receiptNumber} marked disputed locally.`, 'Medium');
      setNotice('Debt dispute logged locally.');
      return;
    }
    if (action === 'Export Row') {
      if (!requirePermission('customers.credit.export')) return;
      exportCsv(`${debt.receiptNumber}-debt.csv`, [
        ['Customer', 'Receipt', 'Sale Date', 'Due Date', 'Original', 'Paid', 'Outstanding', 'Overdue Days', 'Ageing Bucket', 'Status'],
        [debt.customerName, debt.receiptNumber, debt.saleDate, debt.dueDate, String(debt.originalAmount), String(debt.paidAmount), String(debt.outstandingAmount), String(debt.overdueDays), debt.ageingBucket, debt.status]
      ]);
      setNotice('Debt row exported.');
      return;
    }
    setNotice(`${action} opened locally for ${debt.receiptNumber}.`);
  };

  const handleRecordDebtPayment = async (payload: {
    debtId: string;
    customerId: string;
    amount: number;
    paymentMethod: string;
    reference: string;
    notes: string;
    receivedByStaffId: string;
    branchId?: string;
    shiftId?: string;
  }) => {
    try {
      await recordCustomerDebtPayment(payload);
      setPaymentDebt(null);
      await refreshCreditPanels(payload.customerId);
      setNotice('Debt payment recorded locally.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Debt payment could not be recorded.');
    }
  };

  const customerActionItems = (customer: CustomerRecord): RowActionMenuItem[] => [
    { label: 'View Customer', icon: <Eye size={15} />, onClick: () => handleProfile(customer), disabled: !hasPermission(roleName, 'customers.view') },
    { label: 'Edit Customer', icon: <Edit3 size={15} />, onClick: () => setEditCustomer(customer), disabled: !hasPermission(roleName, 'customers.edit') },
    ...(hasPermission(roleName, 'customers.useInSale') ? [{ label: 'Use in Sale', icon: <UserCheck size={15} />, onClick: () => void handleUseInSale(customer) }] : []),
    { label: 'View Purchase History', icon: <History size={15} />, onClick: () => { setSelectedCustomerId(customer.customerId); setActiveTab('Purchase History'); }, disabled: !hasPermission(roleName, 'customers.purchaseHistory.view') },
    { label: 'View Notes', icon: <MessageSquare size={15} />, onClick: () => { setSelectedCustomerId(customer.customerId); setActiveTab('Customer Notes'); }, disabled: !hasPermission(roleName, 'customers.notes.view') },
    { label: 'Add Note', icon: <Plus size={15} />, onClick: () => setQuickNoteCustomer(customer), disabled: !hasPermission(roleName, 'customers.notes.create') },
    { label: 'WhatsApp Message', icon: <MessageCircle size={15} />, onClick: () => handleWhatsApp(customer), disabled: !hasPermission(roleName, 'customers.whatsappMessage') },
    { label: 'Create Customer Request', icon: <FileText size={15} />, onClick: () => void handleCreateRequest(customer), disabled: !hasPermission(roleName, 'customers.requests.create') },
    { label: 'Mark Credit Review', icon: <ShieldAlert size={15} />, onClick: () => void handleCreditReview(customer), disabled: !hasPermission(roleName, 'customers.creditReview') },
    customer.status === 'Suspended'
      ? { label: 'Reactivate', icon: <RotateCcw size={15} />, onClick: () => void handleReactivate(customer), disabled: !hasPermission(roleName, 'customers.reactivate') }
      : { label: 'Suspend', icon: <X size={15} />, onClick: () => void handleSuspend(customer), disabled: !hasPermission(roleName, 'customers.suspend'), danger: true },
    { label: 'Export Row', icon: <FileDown size={15} />, onClick: () => handleExportRow(customer), disabled: !hasPermission(roleName, 'customers.export') }
  ];

  const requestActionItems = (customer: CustomerRecord): RowActionMenuItem[] => [
    { label: 'View Request', icon: <Eye size={15} />, onClick: () => handleProfile(customer), disabled: !hasPermission(roleName, 'customers.view') },
    { label: 'Approve', icon: <Check size={15} />, onClick: () => void handleApprove(customer), disabled: !hasPermission(roleName, 'customers.requests.approve') },
    { label: 'Reject', icon: <X size={15} />, onClick: () => void handleReject(customer), disabled: !hasPermission(roleName, 'customers.requests.approve'), danger: true },
    { label: 'Convert to Customer', icon: <UserPlus size={15} />, onClick: () => void handleApprove(customer), disabled: !hasPermission(roleName, 'customers.requests.approve') },
    { label: 'Assign Reviewer', icon: <UserCheck size={15} />, onClick: () => setNotice(`${session.staffName} assigned as reviewer for ${customer.customerName}.`), disabled: !hasPermission(roleName, 'customers.requests.approve') },
    { label: 'Mark Duplicate', icon: <ShieldAlert size={15} />, onClick: () => void handleDuplicate(customer), disabled: !hasPermission(roleName, 'customers.requests.approve') }
  ];

  return (
    <div className="space-y-5 industrial-font-sans pos-customer-centre">
      <header className="sci-page-header sci-page-header--compact pos-customer-hero">
        <div>
          <p className="sci-pos-eyebrow">Customer Centre</p>
          <h1>Customer Centre</h1>
          <p>Customer records, requests, purchase history, notes, and local activity.</p>
        </div>
        <div className="sci-page-header__actions">
          {canCreateDirect && (
            <button type="button" className="pos-action-button pos-action-button-primary" onClick={() => setNewCustomerOpen(true)}>
              <UserPlus size={16} />New Customer
            </button>
          )}
          <button type="button" className="pos-action-button pos-action-button-secondary" onClick={handleExport}>
            <FileDown size={16} />Export
          </button>
        </div>
      </header>

      {notice && <div className="sci-pos-alert" role="status">{notice}</div>}

      {selectedForSale && canUseInSale && (
        <section className="pos-selected-sale-cta-card" aria-label="Customer selected for sale">
          <div className="pos-selected-sale-cta-card__icon"><ShoppingCart size={18} /></div>
          <div className="pos-selected-sale-cta-card__body">
            <span>Customer selected for sale:</span>
            <strong>{selectedForSale.customerName}</strong>
            <small>Open Sales Terminal to continue checkout with this customer.</small>
          </div>
          <div className="pos-selected-sale-cta-card__actions">
            <button type="button" className="pos-action-button pos-action-button-primary" disabled={!canOpenSalesTerminal} title={canOpenSalesTerminal ? '' : 'You do not have permission to open Sales Terminal.'} onClick={() => void handleOpenSalesTerminal()}>
              <ShoppingCart size={16} />Open Sales Terminal
            </button>
            <button type="button" className="pos-action-button pos-action-button-secondary" onClick={() => void handleClearSelectedForSale()}>
              <Trash2 size={15} />Clear Selected Customer
            </button>
          </div>
        </section>
      )}

      <section className="pos-customer-summary-grid">
        {[
          ['Total Customers', summary?.totalCustomers || 0],
          ['Active', summary?.activeCustomers || 0],
          ['Pending', summary?.pendingApproval || 0],
          ['Duplicates', summary?.duplicateReview || 0],
          ['Suspended', summary?.suspended || 0],
          ['WhatsApp', summary?.whatsAppLeads || 0],
          ['Repeat', summary?.repeatCustomers || 0],
          ['Credit Review', summary?.creditReview || 0]
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </section>

      <section className="sci-pos-card pos-customer-filter-card">
        <div className="sci-pos-card__bar">
          <div>
            <p className="sci-pos-eyebrow">Filters</p>
            <h2>Customer Filters</h2>
          </div>
          <button type="button" className="pos-action-button pos-action-button-secondary" onClick={() => setFiltersOpen((value) => !value)}>
            <Search size={16} />{filtersOpen ? 'Hide Filters' : 'More Filters'}
          </button>
        </div>
        <div className="pos-customer-filter-primary">
          <label className="pos-customer-search-field">
            <span>Search</span>
            <span className="pos-search-bubble">
              <input
                className="pos-search-bubble-input"
                type="search"
                value={filters.search || ''}
                onChange={(event) => setFilters({ ...filters, search: event.target.value })}
                placeholder="Search by customer name, code, phone, WhatsApp, email, city, suburb, source, credit status, or debt status..."
              />
              <Search className="pos-search-bubble-icon" size={17} aria-hidden="true" />
            </span>
          </label>
        </div>
        <div className={`pos-customer-filter-grid ${filtersOpen ? 'pos-customer-filter-grid--open' : ''}`}>
          <FilterSelect label="Customer Type" value={filters.customerType || 'All'} options={customerTypes} onChange={(value) => setFilters({ ...filters, customerType: value as CustomerFilterState['customerType'] })} />
          <FilterSelect label="Status" value={filters.status || 'All'} options={customerStatuses} onChange={(value) => setFilters({ ...filters, status: value as CustomerFilterState['status'] })} />
          <FilterSelect label="Credit Status" value={filters.creditStatus || 'All'} options={creditStatuses} onChange={(value) => setFilters({ ...filters, creditStatus: value as CustomerFilterState['creditStatus'] })} />
          <FilterSelect label="Source" value={filters.source || 'All'} options={sources} onChange={(value) => setFilters({ ...filters, source: value as CustomerFilterState['source'] })} />
          <FilterInput label="City / Town" value={filters.cityTown || ''} onChange={(value) => setFilters({ ...filters, cityTown: value })} />
          <FilterInput label="District" value={filters.district || ''} onChange={(value) => setFilters({ ...filters, district: value })} />
          <FilterInput label="Suburb" value={filters.suburb || ''} onChange={(value) => setFilters({ ...filters, suburb: value })} />
          <FilterInput label="Date From" type="date" value={filters.dateFrom || ''} onChange={(value) => setFilters({ ...filters, dateFrom: value })} />
          <FilterInput label="Date To" type="date" value={filters.dateTo || ''} onChange={(value) => setFilters({ ...filters, dateTo: value })} />
        </div>
      </section>

      <div className="pos-shift-tabs pos-customer-tabs" role="tablist" aria-label="Customer Centre sections">
        {tabs.map((tab) => (
          <button key={tab} type="button" className={`pos-tab-button ${activeTab === tab ? 'pos-tab-button-active' : ''}`} onClick={() => setActiveTab(tab)}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Customer List' && (
        <CustomerTable customers={customers} actionItems={customerActionItems} onProfile={handleProfile} />
      )}

      {activeTab === 'Customer Requests' && (
        <RequestTable requests={requests} actionItems={requestActionItems} />
      )}

      {activeTab === 'Customer Profile' && (
        selectedCustomer
          ? <CustomerProfile customer={selectedCustomer} actionItems={customerActionItems(selectedCustomer)} />
          : <EmptyState title="No Customer Selected" message="Select a customer row to view the profile." />
      )}

      {activeTab === 'Purchase History' && (
        selectedCustomer
          ? <SimpleTable title={`Purchase History - ${selectedCustomer.customerName}`} icon={<History size={18} />} headings={['Receipt No.', 'Date', 'Branch', 'Cashier', 'Items', 'Total', 'Payment', 'Delivery', 'Return']}>
              {history.map((row) => <tr key={row.id}><td>{row.receiptNo}</td><td>{dateLabel(row.date)}</td><td>{row.branch}</td><td>{row.cashier}</td><td>{row.items}</td><td>{money(row.total)}</td><td>{row.paymentMethod}</td><td>{row.deliveryStatus}</td><td>{row.returnStatus}</td></tr>)}
              {history.length === 0 && <EmptyTableRow colSpan={9} label="No purchase history found." />}
            </SimpleTable>
          : <EmptyState title="No Customer Selected" message="Select a customer to view purchase history." />
      )}

      {activeTab === 'Credit & Ageing' && (
        selectedCustomer
          ? <CreditAgeingTab
              customer={selectedCustomer}
              analysis={ageingAnalysis}
              profile={creditProfile}
              score={creditScore}
              configs={ageingConfigs}
              draft={ageingDraft}
              canConfigure={hasPermission(roleName, 'customers.credit.ageing.configure')}
              onDraftChange={setAgeingDraft}
              onSaveConfig={handleSaveAgeingConfig}
              onDebtAction={handleDebtAction}
            />
          : <EmptyState title="No Customer Selected" message="Select a customer to view credit and ageing." />
      )}

      {activeTab === 'Debtors Control Desk' && (
        hasPermission(roleName, 'customers.debtorsDesk.view')
          ? <DebtorsControlDeskPanel
              customers={customers}
              selectedCustomerId={selectedCustomerId}
              staffName={session.staffName}
              roleName={roleName}
              canManagePolicy={hasPermission(roleName, 'customers.credit.policyManage')}
              canRecordPayment={hasPermission(roleName, 'customers.credit.recordPayment')}
              canWriteOff={hasPermission(roleName, 'customers.credit.writeOff')}
              onRecordPayment={(debt) => setPaymentDebt(debt)}
              onOpenCustomerProfile={(customerId) => { setSelectedCustomerId(customerId); setActiveTab('Customer Profile'); }}
              onPrintStatement={(customerId) => { setSelectedCustomerId(customerId); setActiveTab('Customer Statements'); }}
              onNotice={setNotice}
            />
          : <EmptyState title="Restricted" message="You do not have permission to view Debtors Control Desk." />
      )}

      {activeTab === 'Customer Statements' && (
        hasPermission(roleName, 'customers.credit.statement.view')
          ? <CustomerStatementPanel
              customers={customers}
              selectedCustomerId={selectedCustomerId}
              generatedBy={session.staffName}
              canPrint={hasPermission(roleName, 'customers.credit.statement.print')}
              canWhatsApp={hasPermission(roleName, 'customers.credit.statement.whatsapp')}
              onNotice={setNotice}
            />
          : <EmptyState title="Restricted" message="You do not have permission to view customer statements." />
      )}

      {activeTab === 'Buying Behaviour' && (
        selectedCustomer
          ? <BuyingBehaviourTab preferences={buyingPreferences} behaviour={behaviourAnalytics} />
          : <EmptyState title="No Customer Selected" message="Select a customer to view buying behaviour." />
      )}

      {activeTab === 'Customer Notes' && (
        selectedCustomer
          ? <section className="sci-pos-card">
              <div className="sci-pos-card__bar"><div><p className="sci-pos-eyebrow">Service Notes</p><h2>{selectedCustomer.customerName}</h2></div><MessageSquare size={18} /></div>
              {hasPermission(roleName, 'customers.notes.create') && (
                <div className="pos-customer-note-form"><textarea rows={3} value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="Note text" /><button type="button" className="sci-pos-button sci-pos-button--primary" onClick={handleAddNote}>Save Note</button></div>
              )}
              <div className="sci-pos-table-wrap"><table className="sci-pos-table"><thead><tr>{['Date / Time', 'Note', 'Added By', 'Role', 'Related Record'].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{notes.map((note) => <tr key={note.id}><td>{dateLabel(note.dateTime)}</td><td>{note.note}</td><td>{note.addedBy}</td><td>{note.role}</td><td>{note.relatedRecord || 'None'}</td></tr>)}{notes.length === 0 && <EmptyTableRow colSpan={5} label="No notes found." />}</tbody></table></div>
            </section>
          : <EmptyState title="No Customer Selected" message="Select a customer to view notes." />
      )}

      {activeTab === 'Customer Activity' && (
        selectedCustomer
          ? <SimpleTable title={`Customer Activity - ${selectedCustomer.customerName}`} icon={<FileText size={18} />} headings={['Date / Time', 'Event', 'User', 'Notes']}>
              {activity.map((event) => <tr key={event.id}><td>{dateLabel(event.dateTime)}</td><td>{eventTitle(event.eventType)}</td><td>{event.user}</td><td>{event.notes}</td></tr>)}
              {activity.length === 0 && <EmptyTableRow colSpan={4} label="No activity found." />}
            </SimpleTable>
          : <EmptyState title="No Customer Selected" message="Select a customer to view activity." />
      )}

      <NewCustomerModal
        open={newCustomerOpen || Boolean(editCustomer)}
        initialCustomer={editCustomer}
        canSaveAndUse={hasPermission(roleName, 'customers.useInSale')}
        onClose={() => { setNewCustomerOpen(false); setEditCustomer(null); }}
        onSubmit={handleSubmitCustomer}
      />

      {quickNoteCustomer && (
        <div className="pos-modal-backdrop" role="presentation">
          <section className="pos-quick-note-modal" role="dialog" aria-modal="true" aria-labelledby="quick-note-title">
            <div className="pos-new-customer-modal__header">
              <div><p className="sci-pos-eyebrow">Add Note</p><h2 id="quick-note-title">{quickNoteCustomer.customerName}</h2></div>
              <button type="button" className="sci-pos-icon-button" aria-label="Close note modal" onClick={() => setQuickNoteCustomer(null)}><X size={18} /></button>
            </div>
            <textarea rows={4} value={quickNoteText} onChange={(event) => setQuickNoteText(event.target.value)} placeholder="Note text" />
            <div className="pos-new-customer-modal__actions">
              <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => setQuickNoteCustomer(null)}>Cancel</button>
              <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={() => void handleQuickNote()}>Save Note</button>
            </div>
          </section>
        </div>
      )}

      <RecordDebtPaymentModal debt={paymentDebt} receivedBy={session.staffName} onClose={() => setPaymentDebt(null)} onRecord={handleRecordDebtPayment} />
    </div>
  );
}

function CustomerTable({ customers, actionItems, onProfile }: { customers: CustomerRecord[]; actionItems: (customer: CustomerRecord) => RowActionMenuItem[]; onProfile: (customer: CustomerRecord) => void }) {
  const [openMenuId, setOpenMenuId] = useState('');
  const lastPurchaseByCustomer = new Map<string, string>([
    ['CUST-TAPIWA', '2026-06-09'],
    ['CUST-RUDO', '2026-06-09'],
    ['CUST-FARAI', '2026-06-09'],
    ['CUST-APEX-FLEET', '2026-06-09']
  ]);
  return (
    <section className="sci-pos-card pos-customer-list-card">
      <div className="sci-pos-card__bar"><div><p className="sci-pos-eyebrow">Records</p><h2>Customer List</h2></div><span>{customers.length} records</span></div>
      <div className="pos-customer-list-scroll">
        <table className="sci-pos-table pos-customer-table customer-list-table">
          <colgroup>
            <col className="customer-col-code" />
            <col className="customer-col-customer" />
            <col className="customer-col-type" />
            <col className="customer-col-contact" />
            <col className="customer-col-location" />
            <col className="customer-col-source" />
            <col className="customer-col-status" />
            <col className="customer-col-credit" />
            <col className="customer-col-last" />
            <col className="customer-col-action" />
          </colgroup>
          <thead><tr>{['Code', 'Customer', 'Type', 'Contact', 'Location', 'Source', 'Status', 'Credit', 'Last Purchase', ''].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer.customerId} onDoubleClick={() => onProfile(customer)}>
                <td><span className="customer-list-primary">{customer.customerCode}</span></td>
                <td><span className="customer-list-primary">{customer.customerName}</span><span className="customer-list-secondary">{customer.email || 'No email'}</span></td>
                <td><span className="customer-list-primary">{customer.customerType}</span></td>
                <td><span className="customer-list-primary">{customer.phone || customer.email || 'No contact'}</span><span className="customer-list-secondary">{customer.whatsapp && customer.whatsapp !== customer.phone ? customer.whatsapp : customer.whatsapp ? 'WhatsApp same' : 'No WhatsApp'}</span></td>
                <td><span className="customer-list-primary">{customer.cityTown || 'No city'}</span><span className="customer-list-secondary">{customer.suburb || customer.district || 'No suburb'}</span></td>
                <td><span className="customer-list-primary customer-list-truncate">{customer.source}</span></td>
                <td><span className={`customer-list-status customer-list-status--${customer.status.toLowerCase().replace(/\s+/g, '-')}`}>{customer.status}</span></td>
                <td><span className="customer-list-credit">{creditLabel(customer.creditStatus)}</span></td>
                <td><span className="customer-list-secondary">{lastPurchaseByCustomer.get(customer.customerId) || 'No purchase'}</span></td>
                <td className="pos-customer-row-actions"><RowActionMenu ariaLabel={`Actions for ${customer.customerName}`} open={openMenuId === customer.customerId} items={actionItems(customer)} onOpenChange={(open) => setOpenMenuId(open ? customer.customerId : '')} /></td>
              </tr>
            ))}
            {customers.length === 0 && <EmptyTableRow colSpan={10} label="No customers match the current filters." />}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RequestTable({ requests, actionItems }: { requests: CustomerRecord[]; actionItems: (customer: CustomerRecord) => RowActionMenuItem[] }) {
  const [openMenuId, setOpenMenuId] = useState('');
  return (
    <section className="sci-pos-card pos-customer-list-card">
      <div className="sci-pos-card__bar"><div><p className="sci-pos-eyebrow">Approval Requests</p><h2>Customer Requests</h2></div><UserCheck size={18} /></div>
      <div className="pos-customer-list-scroll">
        <table className="sci-pos-table pos-customer-table">
          <thead><tr>{['Request', 'Customer', 'Phone', 'WhatsApp', 'Source', 'Requested By', 'Requested At', 'Risk', 'Status', ''].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead>
          <tbody>
            {requests.map((customer) => (
              <tr key={customer.customerId}>
                <td className="sci-pos-table__strong">{customer.customerCode}</td>
                <td>{customer.customerName}</td>
                <td>{customer.phone || 'None'}</td>
                <td>{customer.whatsapp || 'None'}</td>
                <td>{customer.source}</td>
                <td>{customer.createdByStaffId}</td>
                <td>{dateLabel(customer.createdAt)}</td>
                <td>{customer.status === 'Duplicate' ? 'High' : 'Low'}</td>
                <td><span className={`sci-status-pill ${statusClass(customer.status)}`}>{customer.status}</span></td>
                <td className="pos-customer-row-actions"><RowActionMenu ariaLabel={`Request actions for ${customer.customerName}`} open={openMenuId === customer.customerId} items={actionItems(customer)} onOpenChange={(open) => setOpenMenuId(open ? customer.customerId : '')} /></td>
              </tr>
            ))}
            {requests.length === 0 && <EmptyTableRow colSpan={10} label="No customer requests found." />}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CustomerProfile({ customer, actionItems }: { customer: CustomerRecord; actionItems: RowActionMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const rows = [['Customer Name', customer.customerName], ['Customer Code', customer.customerCode], ['Customer Type', customer.customerType], ['Phone', customer.phone || 'None'], ['WhatsApp', customer.whatsapp || 'None'], ['Email', customer.email || 'None'], ['Tax Number', customer.taxNumber || 'None'], ['Billing Address', customer.billingAddress || 'None'], ['Delivery Address', customer.deliveryAddress || 'None'], ['City / Town', customer.cityTown], ['District', customer.district], ['Suburb', customer.suburb || 'None'], ['Source', customer.source], ['Status', customer.status], ['Credit Status', customer.creditStatus], ['Credit Limit', money(customer.creditLimit)], ['Current Balance', money(customer.currentBalance)], ['Created By', customer.createdByStaffId], ['Approved By', customer.approvedByStaffId || 'Pending'], ['Created At', dateLabel(customer.createdAt)]];
  return (
    <section className="sci-pos-card">
      <div className="sci-pos-card__bar"><div><p className="sci-pos-eyebrow">Profile</p><h2>Customer Profile</h2></div><RowActionMenu ariaLabel={`Actions for ${customer.customerName}`} open={open} items={actionItems} onOpenChange={setOpen} /></div>
      <div className="pos-customer-profile-grid">{rows.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
    </section>
  );
}

function CreditAgeingTab({
  customer,
  analysis,
  profile,
  score,
  configs,
  draft,
  canConfigure,
  onDraftChange,
  onSaveConfig,
  onDebtAction
}: {
  customer: CustomerRecord;
  analysis: CustomerAgeingAnalysis | null;
  profile: CustomerCreditProfile | null;
  score: CustomerCreditWorthinessScore | null;
  configs: CustomerAgeingIntervalConfig[];
  draft: CustomerAgeingIntervalConfig | null;
  canConfigure: boolean;
  onDraftChange: (config: CustomerAgeingIntervalConfig) => void;
  onSaveConfig: () => void;
  onDebtAction: (debt: CustomerDebtRecord, action: string) => void | Promise<void>;
}) {
  const summary = analysis || {
    totalCreditCustomers: 0,
    totalOutstanding: 0,
    current: 0,
    dueSoon: 0,
    overdue1: 0,
    overdue2: 0,
    overdue3: 0,
    overdue4: 0,
    severeOverdue: 0,
    overdueCustomers: 0,
    blockedCustomers: 0,
    debts: []
  };
  const updateDraft = (field: keyof CustomerAgeingIntervalConfig, value: string | boolean) => {
    if (!draft) return;
    onDraftChange({ ...draft, [field]: typeof value === 'boolean' || field === 'name' ? value : Number(value) });
  };
  return (
    <div className="pos-credit-ageing-layout">
      <section className="pos-credit-summary-grid">
        {[
          ['Total Credit Customers', summary.totalCreditCustomers],
          ['Total Outstanding', money(summary.totalOutstanding)],
          ['Current', money(summary.current)],
          ['1-30 Days', money(summary.overdue1)],
          ['31-60 Days', money(summary.overdue2)],
          ['61-90 Days', money(summary.overdue3)],
          ['91-120 Days', money(summary.overdue4)],
          ['120+ Days', money(summary.severeOverdue)],
          ['Overdue Customers', summary.overdueCustomers],
          ['Blocked Customers', summary.blockedCustomers]
        ].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
      </section>

      <div className="pos-credit-two-column">
        <section className="sci-pos-card pos-credit-panel">
          <div className="sci-pos-card__bar"><div><p className="sci-pos-eyebrow">Credit Profile</p><h2>{customer.customerName}</h2></div><ShieldAlert size={18} /></div>
          <div className="pos-credit-profile-grid">
            {[
              ['Credit Status', profile?.creditStatus || customer.creditStatus],
              ['Credit Limit', money(profile?.creditLimit ?? customer.creditLimit)],
              ['Current Balance', money(profile?.currentBalance ?? customer.currentBalance)],
              ['Available Credit', money(profile?.availableCredit)],
              ['Overdue Balance', money(profile?.overdueBalance)],
              ['Payment Terms', `${profile?.paymentTermsDays || 30} days`],
              ['Last Payment', profile?.lastPaymentDate ? dateLabel(profile.lastPaymentDate) : 'None'],
              ['Last Credit Sale', profile?.lastCreditSaleDate ? dateLabel(profile.lastCreditSaleDate) : 'None']
            ].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
          </div>
        </section>
        <CustomerCreditWorthinessPanel score={score} profile={profile} />
      </div>

      <section className="sci-pos-card pos-credit-config-card">
        <div className="sci-pos-card__bar"><div><p className="sci-pos-eyebrow">Ageing Intervals</p><h2>Credit Ageing Config</h2></div><span>{configs.length} config(s)</span></div>
        {draft && (
          <div className="pos-credit-config-grid">
            <label>Config Name<input disabled={!canConfigure} value={draft.name} onChange={(event) => updateDraft('name', event.target.value)} /></label>
            <label>Current / Due Soon Days<input disabled={!canConfigure} type="number" value={draft.currentMaxDays} onChange={(event) => updateDraft('currentMaxDays', event.target.value)} /></label>
            <label>Bucket 1 From<input disabled={!canConfigure} type="number" value={draft.bucket1From} onChange={(event) => updateDraft('bucket1From', event.target.value)} /></label>
            <label>Bucket 1 To<input disabled={!canConfigure} type="number" value={draft.bucket1To} onChange={(event) => updateDraft('bucket1To', event.target.value)} /></label>
            <label>Bucket 2 From<input disabled={!canConfigure} type="number" value={draft.bucket2From} onChange={(event) => updateDraft('bucket2From', event.target.value)} /></label>
            <label>Bucket 2 To<input disabled={!canConfigure} type="number" value={draft.bucket2To} onChange={(event) => updateDraft('bucket2To', event.target.value)} /></label>
            <label>Bucket 3 From<input disabled={!canConfigure} type="number" value={draft.bucket3From} onChange={(event) => updateDraft('bucket3From', event.target.value)} /></label>
            <label>Bucket 3 To<input disabled={!canConfigure} type="number" value={draft.bucket3To} onChange={(event) => updateDraft('bucket3To', event.target.value)} /></label>
            <label>Bucket 4 From<input disabled={!canConfigure} type="number" value={draft.bucket4From} onChange={(event) => updateDraft('bucket4From', event.target.value)} /></label>
            <label>Bucket 4 To<input disabled={!canConfigure} type="number" value={draft.bucket4To} onChange={(event) => updateDraft('bucket4To', event.target.value)} /></label>
            <label>Severe From<input disabled={!canConfigure} type="number" value={draft.severeFrom} onChange={(event) => updateDraft('severeFrom', event.target.value)} /></label>
            <label className="pos-credit-checkbox"><input disabled={!canConfigure} type="checkbox" checked={draft.active} onChange={(event) => updateDraft('active', event.target.checked)} /> Set as Active</label>
            <button type="button" className="sci-pos-button sci-pos-button--primary" disabled={!canConfigure} onClick={onSaveConfig}>Save Config</button>
          </div>
        )}
      </section>

      <DebtAgeingTable debts={summary.debts} customerStatus={profile?.creditStatus || customer.creditStatus} onDebtAction={onDebtAction} />
    </div>
  );
}

function DebtAgeingTable({ debts, customerStatus, onDebtAction }: { debts: CustomerDebtRecord[]; customerStatus: string; onDebtAction: (debt: CustomerDebtRecord, action: string) => void | Promise<void> }) {
  const [openMenuId, setOpenMenuId] = useState('');
  const actionItems = (debt: CustomerDebtRecord): RowActionMenuItem[] => [
    'View Debt',
    'Record Payment',
    'Send WhatsApp Reminder',
    'Open Customer Profile',
    'Mark Disputed',
    'Mark Written Off',
    'Create Follow-up Task',
    'Escalate to Manager',
    'Export Row'
  ].map((label) => ({ label, icon: <FileText size={15} />, onClick: () => void onDebtAction(debt, label), danger: label === 'Mark Written Off' }));
  return (
    <section className="sci-pos-card pos-credit-debt-card">
      <div className="sci-pos-card__bar"><div><p className="sci-pos-eyebrow">Debt Ageing</p><h2>Customer Debt Table</h2></div><span>{debts.length} debt(s)</span></div>
      <div className="pos-credit-debt-scroll">
        <table className="sci-pos-table pos-credit-debt-table">
          <thead><tr>{['Customer', 'Receipt', 'Sale Date', 'Due Date', 'Original Amount', 'Paid', 'Outstanding', 'Overdue Days', 'Ageing Bucket', 'Credit Status', 'Action'].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead>
          <tbody>
            {debts.map((debt) => (
              <tr key={debt.debtId}>
                <td>{debt.customerName}</td>
                <td>{debt.receiptNumber}</td>
                <td>{new Date(debt.saleDate).toLocaleDateString()}</td>
                <td>{new Date(debt.dueDate).toLocaleDateString()}</td>
                <td>{money(debt.originalAmount)}</td>
                <td>{money(debt.paidAmount)}</td>
                <td>{money(debt.outstandingAmount)}</td>
                <td>{debt.overdueDays}</td>
                <td>{debt.ageingBucket}</td>
                <td>{customerStatus}</td>
                <td className="pos-customer-row-actions"><RowActionMenu ariaLabel={`Debt actions for ${debt.receiptNumber}`} open={openMenuId === debt.debtId} items={actionItems(debt)} onOpenChange={(open) => setOpenMenuId(open ? debt.debtId : '')} /></td>
              </tr>
            ))}
            {debts.length === 0 && <EmptyTableRow colSpan={11} label="No debt records found for this customer." />}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BuyingBehaviourTab({ preferences, behaviour }: { preferences: CustomerBuyingPreferenceProfile | null; behaviour: CustomerBehaviourAnalytics | null }) {
  const suggestedOffer = behaviour?.segment === 'Dormant'
    ? 'Send follow-up reminder'
    : behaviour?.segment === 'DiscountDriven'
      ? 'Offer controlled bundle pricing'
      : behaviour?.segment === 'SlowPayer' || behaviour?.segment === 'CreditRisk'
        ? 'Require deposit before credit'
        : 'Send service reminder';
  const rows = [
    ['Top Categories', preferences?.topCategories.join(', ') || 'None'],
    ['Top Products', preferences?.topProducts.join(', ') || 'None'],
    ['Preferred Brands', preferences?.preferredBrands.join(', ') || 'None'],
    ['Average Basket Value', money(preferences?.averageBasketValue)],
    ['Purchase Frequency', preferences?.purchaseFrequency || 'None'],
    ['Last Purchase Date', preferences?.lastPurchaseDate ? dateLabel(preferences.lastPurchaseDate) : 'None'],
    ['Payment Preference', preferences?.preferredPaymentMethod || 'None'],
    ['Discount Sensitivity', preferences?.priceSensitivity || 'None'],
    ['Return Rate', `${Math.round((behaviour?.returnRate || 0) * 100)}%`],
    ['Credit Usage Rate', `${Math.round((behaviour?.creditUsageRate || 0) * 100)}%`],
    ['Customer Segment', behaviour?.segment || 'New'],
    ['Suggested Offer / Reminder', suggestedOffer]
  ];
  return (
    <section className="sci-pos-card pos-buying-behaviour-card">
      <div className="sci-pos-card__bar"><div><p className="sci-pos-eyebrow">Buying Behaviour</p><h2>Customer Analytics</h2></div><History size={18} /></div>
      <div className="pos-credit-profile-grid">
        {rows.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
      </div>
      {behaviour && <div className="pos-credit-reasons"><span>Repeat purchases: {behaviour.repeatPurchaseCount}</span><span>Days since last purchase: {behaviour.daysSinceLastPurchase}</span><span>Reliability: {behaviour.paymentReliabilityScore}/100</span><span>{behaviour.notes}</span></div>}
    </section>
  );
}

function SimpleTable({ title, icon, headings, children }: { title: string; icon: ReactNode; headings: string[]; children: ReactNode }) {
  return <section className="sci-pos-card"><div className="sci-pos-card__bar"><div><p className="sci-pos-eyebrow">Customer</p><h2>{title}</h2></div>{icon}</div><div className="sci-pos-table-wrap"><table className="sci-pos-table"><thead><tr>{headings.map((heading) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{children}</tbody></table></div></section>;
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return <section className="sci-pos-card pos-customer-empty"><p className="sci-pos-eyebrow">{title}</p><h2>{message}</h2></section>;
}

function EmptyTableRow({ colSpan, label }: { colSpan: number; label: string }) {
  return <tr><td colSpan={colSpan} className="pos-customer-empty-cell">{label}</td></tr>;
}

function FilterInput({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label>{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void }) {
  return <label>{label}<select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}
