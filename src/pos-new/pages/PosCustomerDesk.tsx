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
  ShieldAlert,
  UserCheck,
  UserPlus,
  X
} from 'lucide-react';
import NewCustomerModal from '../components/NewCustomerModal';
import RowActionMenu, { RowActionMenuItem } from '../components/RowActionMenu';
import {
  CustomerActivityEvent,
  CustomerCreditStatus,
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

type CustomerTab = 'Customer List' | 'Customer Requests' | 'Customer Profile' | 'Purchase History' | 'Customer Notes' | 'Customer Activity';

const tabs: CustomerTab[] = ['Customer List', 'Customer Requests', 'Customer Profile', 'Purchase History', 'Customer Notes', 'Customer Activity'];
const customerTypes: Array<CustomerType | 'All'> = ['All', 'Walk-in', 'Individual', 'Business', 'Government', 'School', 'Fleet Customer', 'Dealer', 'Internal Account'];
const customerStatuses: Array<CustomerStatus | 'All'> = ['All', 'Pending Approval', 'Active', 'Rejected', 'Duplicate', 'Suspended', 'Inactive'];
const creditStatuses: Array<CustomerCreditStatus | 'All'> = ['All', 'Cash Only', 'Credit Allowed', 'Credit Suspended', 'Credit Review Required', 'Not Applicable'];
const sources: Array<CustomerSource | 'All'> = ['All', 'Walk-in', 'WhatsApp Catalogue', 'Commerce Access Hub', 'Referral', 'Phone Call', 'Facebook', 'Sales Terminal', 'Imported', 'Other'];
const permissionBlockedMessage = 'You do not have permission to perform this action.';

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

  const selectedCustomer = customers.find((customer) => customer.customerId === selectedCustomerId) || customers[0] || null;
  const canCreateDirect = hasPermission(roleName, 'customers.createDirect');

  const loadCustomers = async () => {
    const [rows, nextSummary] = await Promise.all([getCustomers(filters), getCustomerSummary(filters)]);
    setCustomers(rows);
    setSummary(nextSummary);
    setSelectedCustomerId((current) => current || rows[0]?.customerId || '');
  };

  const loadSelectedDetails = async (customerId: string) => {
    const [historyRows, noteRows, activityRows] = await Promise.all([
      getCustomerPurchaseHistory(customerId),
      getCustomerNotes(customerId),
      getCustomerActivityEvents(customerId)
    ]);
    setHistory(historyRows);
    setNotes(noteRows);
    setActivity(activityRows);
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
    try {
      sessionStorage.setItem('itred_pos_selected_customer_for_sale_v1', JSON.stringify({
        customerId: customer.customerId,
        customerCode: customer.customerCode,
        customerName: customer.customerName,
        selectedAt: new Date().toISOString()
      }));
    } catch {
      // Session storage is optional in local-only builds.
    }
    if (showNotice) setNotice(`${customer.customerName} selected for sale.`);
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

  const customerActionItems = (customer: CustomerRecord): RowActionMenuItem[] => [
    { label: 'View Customer', icon: <Eye size={15} />, onClick: () => handleProfile(customer), disabled: !hasPermission(roleName, 'customers.view') },
    { label: 'Edit Customer', icon: <Edit3 size={15} />, onClick: () => setEditCustomer(customer), disabled: !hasPermission(roleName, 'customers.edit') },
    { label: 'Use in Sale', icon: <UserCheck size={15} />, onClick: () => void handleUseInSale(customer), disabled: !hasPermission(roleName, 'customers.useInSale') },
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
            <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={() => setNewCustomerOpen(true)}>
              <UserPlus size={16} />New Customer
            </button>
          )}
          <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={handleExport}>
            <FileDown size={16} />Export
          </button>
        </div>
      </header>

      {notice && <div className="sci-pos-alert" role="status">{notice}</div>}

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
          <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => setFiltersOpen((value) => !value)}>
            <Search size={16} />{filtersOpen ? 'Hide Filters' : 'More Filters'}
          </button>
        </div>
        <div className="pos-customer-filter-primary">
          <FilterInput label="Search" value={filters.search || ''} onChange={(value) => setFilters({ ...filters, search: value })} />
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
          <button key={tab} type="button" className={`pos-shift-tab ${activeTab === tab ? 'pos-shift-tab--active' : ''}`} onClick={() => setActiveTab(tab)}>
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
