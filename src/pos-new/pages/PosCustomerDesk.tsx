import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Check, FileText, History, MessageSquare, Search, UserCheck, X } from 'lucide-react';
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
  exportCustomerListPlaceholder,
  getCustomerActivityEvents,
  getCustomerNotes,
  getCustomerPurchaseHistory,
  getCustomerSummary,
  getCustomers,
  markCustomerDuplicate,
  rejectCustomer,
  suspendCustomer
} from '../services/customerService';
import { hasPermission } from '../utils/posPermissions';

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

export default function PosCustomerDesk({ session, onNavigate }: PosCustomerDeskProps) {
  const roleName = session.role as Role;
  const [activeTab, setActiveTab] = useState<CustomerTab>('Customer List');
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [summary, setSummary] = useState<CustomerSummary | null>(null);
  const [filters, setFilters] = useState<CustomerFilterState>({ status: 'All', customerType: 'All', creditStatus: 'All', source: 'All' });
  const [selectedCustomerId, setSelectedCustomerId] = useState('CUST-WALKIN');
  const [history, setHistory] = useState<CustomerPurchaseHistoryRow[]>([]);
  const [notes, setNotes] = useState<CustomerNote[]>([]);
  const [activity, setActivity] = useState<CustomerActivityEvent[]>([]);
  const [noteText, setNoteText] = useState('');
  const [notice, setNotice] = useState('');

  const selectedCustomer = customers.find((customer) => customer.customerId === selectedCustomerId) || customers[0] || null;

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

  const handleProfile = (customer: CustomerRecord) => {
    setSelectedCustomerId(customer.customerId);
    setActiveTab('Customer Profile');
  };

  const requirePermission = (permission: 'customers.approve' | 'customers.createRequest' | 'approvals.view'): boolean => {
    if (hasPermission(roleName, permission)) return true;
    setNotice(permissionBlockedMessage);
    return false;
  };

  const refreshAfterAction = async (message: string) => {
    setNotice(message);
    await loadCustomers();
    if (selectedCustomerId) await loadSelectedDetails(selectedCustomerId);
  };

  const handleApprove = async (customer: CustomerRecord) => {
    if (!requirePermission('customers.approve')) return;
    await approveCustomer(customer.customerId, session.staffName, 'Approved from Customer Centre.');
    await refreshAfterAction('Customer approved.');
  };

  const handleReject = async (customer: CustomerRecord) => {
    if (!requirePermission('customers.approve')) return;
    await rejectCustomer(customer.customerId, session.staffName, 'Rejected from Customer Centre.');
    await refreshAfterAction('Customer rejected.');
  };

  const handleDuplicate = async (customer: CustomerRecord) => {
    if (!requirePermission('customers.approve')) return;
    await markCustomerDuplicate(customer.customerId, 'Duplicate Review Placeholder', session.staffName, 'Duplicate warning placeholder confirmed.');
    await refreshAfterAction('Customer marked duplicate.');
  };

  const handleSuspend = async (customer: CustomerRecord) => {
    if (!requirePermission('customers.approve')) return;
    await suspendCustomer(customer.customerId, session.staffName, 'Suspended from Customer Centre.');
    await refreshAfterAction('Customer suspended.');
  };

  const handleAddNote = async () => {
    if (!selectedCustomer || !noteText.trim()) return;
    await addCustomerNote(selectedCustomer.customerId, session.staffName, noteText.trim(), roleName);
    setNoteText('');
    await refreshAfterAction('Customer note saved.');
  };

  const handleSelectForSale = (customer: CustomerRecord) => {
    setSelectedCustomerId(customer.customerId);
    setNotice(`${customer.customerName} selected for sale placeholder.`);
  };

  const handleExport = async () => {
    setNotice(await exportCustomerListPlaceholder(filters));
  };

  return (
    <div className="space-y-5 industrial-font-sans">
      <header className="sci-page-header sci-page-header--compact">
        <div>
          <p className="sci-pos-eyebrow">Customer Centre</p>
          <h1>Customer Centre</h1>
          <p>Customer Records, Approval Requests, Purchase History, and Service Notes</p>
        </div>
        <div className="sci-page-header__actions">
          <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={handleExport}>Export Placeholder</button>
        </div>
      </header>

      {notice && <div className="sci-pos-alert" role="status">{notice}</div>}

      <section className="pos-customer-summary-grid">
        {[
          ['Total Customers', summary?.totalCustomers || 0],
          ['Active Customers', summary?.activeCustomers || 0],
          ['Pending Approval', summary?.pendingApproval || 0],
          ['Duplicate Review', summary?.duplicateReview || 0],
          ['Suspended', summary?.suspended || 0],
          ['WhatsApp Leads', summary?.whatsAppLeads || 0],
          ['Repeat Customers', summary?.repeatCustomers || 0],
          ['Credit Review', summary?.creditReview || 0]
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </section>

      <section className="sci-pos-card">
        <div className="sci-pos-card__bar">
          <div>
            <p className="sci-pos-eyebrow">Filters</p>
            <h2>Customer Filters</h2>
          </div>
          <Search size={18} aria-hidden="true" />
        </div>
        <div className="pos-customer-filter-grid">
          <FilterInput label="Search" value={filters.search || ''} onChange={(value) => setFilters({ ...filters, search: value })} />
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

      <div className="pos-shift-tabs" role="tablist" aria-label="Customer Centre sections">
        {tabs.map((tab) => (
          <button key={tab} type="button" className={`pos-shift-tab ${activeTab === tab ? 'pos-shift-tab--active' : ''}`} onClick={() => setActiveTab(tab)}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Customer List' && (
        <CustomerTable
          customers={customers}
          onProfile={handleProfile}
          onSelect={handleSelectForSale}
          onNote={(customer) => { setSelectedCustomerId(customer.customerId); setActiveTab('Customer Notes'); }}
          onSuspend={handleSuspend}
        />
      )}

      {activeTab === 'Customer Requests' && (
        <section className="sci-pos-card">
          <div className="sci-pos-card__bar"><div><p className="sci-pos-eyebrow">Approval Requests</p><h2>Customer Requests</h2></div><UserCheck size={18} /></div>
          <div className="sci-pos-table-wrap">
            <table className="sci-pos-table">
              <thead><tr>{['Request ID', 'Customer Name', 'Phone', 'WhatsApp', 'Source', 'Requested By', 'Requested At', 'Duplicate Risk', 'Status', 'Action'].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead>
              <tbody>
                {requests.map((customer) => (
                  <tr key={customer.customerId}>
                    <td>{customer.customerCode}</td>
                    <td>{customer.customerName}</td>
                    <td>{customer.phone}</td>
                    <td>{customer.whatsapp}</td>
                    <td>{customer.source}</td>
                    <td>{customer.createdByStaffId}</td>
                    <td>{dateLabel(customer.createdAt)}</td>
                    <td>{customer.status === 'Duplicate' ? 'High' : 'Low'}</td>
                    <td><span className={`sci-status-pill ${statusClass(customer.status)}`}>{customer.status}</span></td>
                    <td><div className="pos-approval-actions">
                      <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => handleProfile(customer)}>View</button>
                      <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={() => handleApprove(customer)}><Check size={15} />Approve</button>
                      <button type="button" className="sci-pos-button sci-pos-button--danger" onClick={() => handleReject(customer)}><X size={15} />Reject</button>
                      <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => handleDuplicate(customer)}>Mark Duplicate</button>
                      <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => { requirePermission('approvals.view'); onNavigate?.('APPROVALS'); }}>Open Approval</button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === 'Customer Profile' && selectedCustomer && (
        <CustomerProfile customer={selectedCustomer} onApprove={handleApprove} onReject={handleReject} onDuplicate={handleDuplicate} onSuspend={handleSuspend} onNote={() => setActiveTab('Customer Notes')} onSelect={handleSelectForSale} />
      )}

      {activeTab === 'Purchase History' && (
        <SimpleTable title="Purchase History" icon={<History size={18} />} headings={['Receipt No.', 'Date', 'Branch', 'Cashier', 'Items', 'Total', 'Payment Method', 'Delivery Status', 'Return Status', 'Action']}>
          {history.map((row) => <tr key={row.id}><td>{row.receiptNo}</td><td>{dateLabel(row.date)}</td><td>{row.branch}</td><td>{row.cashier}</td><td>{row.items}</td><td>{money(row.total)}</td><td>{row.paymentMethod}</td><td>{row.deliveryStatus}</td><td>{row.returnStatus}</td><td><button className="sci-pos-button sci-pos-button--secondary" type="button">Open CAT Form Placeholder</button><button className="sci-pos-button sci-pos-button--secondary" type="button">View Receipt Placeholder</button></td></tr>)}
        </SimpleTable>
      )}

      {activeTab === 'Customer Notes' && (
        <section className="sci-pos-card">
          <div className="sci-pos-card__bar"><div><p className="sci-pos-eyebrow">Service Notes</p><h2>Customer Notes</h2></div><MessageSquare size={18} /></div>
          <div className="pos-customer-note-form"><textarea rows={3} value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="Note text" /><button type="button" className="sci-pos-button sci-pos-button--primary" onClick={handleAddNote}>Save Note</button></div>
          <div className="sci-pos-table-wrap"><table className="sci-pos-table"><thead><tr>{['Date / Time', 'Note', 'Added By', 'Role', 'Related Record', 'Action'].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{notes.map((note) => <tr key={note.id}><td>{dateLabel(note.dateTime)}</td><td>{note.note}</td><td>{note.addedBy}</td><td>{note.role}</td><td>{note.relatedRecord || 'None'}</td><td><button type="button" className="sci-pos-button sci-pos-button--secondary">View</button></td></tr>)}</tbody></table></div>
        </section>
      )}

      {activeTab === 'Customer Activity' && (
        <SimpleTable title="Customer Activity" icon={<FileText size={18} />} headings={['Date / Time', 'Event', 'User', 'Notes']}>
          {activity.map((event) => <tr key={event.id}><td>{dateLabel(event.dateTime)}</td><td>{eventTitle(event.eventType)}</td><td>{event.user}</td><td>{event.notes}</td></tr>)}
        </SimpleTable>
      )}
    </div>
  );
}

function CustomerTable({ customers, onProfile, onSelect, onNote, onSuspend }: { customers: CustomerRecord[]; onProfile: (customer: CustomerRecord) => void; onSelect: (customer: CustomerRecord) => void; onNote: (customer: CustomerRecord) => void; onSuspend: (customer: CustomerRecord) => void }) {
  return (
    <section className="sci-pos-card">
      <div className="sci-pos-card__bar"><div><p className="sci-pos-eyebrow">Records</p><h2>Customer List</h2></div></div>
      <div className="sci-pos-table-wrap"><table className="sci-pos-table"><thead><tr>{['Customer Code', 'Customer Name', 'Type', 'Phone', 'WhatsApp', 'City / Town', 'Suburb', 'Source', 'Status', 'Credit Status', 'Last Purchase', 'Action'].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>
        {customers.map((customer) => <tr key={customer.customerId} onDoubleClick={() => onProfile(customer)}><td className="sci-pos-table__strong">{customer.customerCode}</td><td>{customer.customerName}</td><td>{customer.customerType}</td><td>{customer.phone || 'None'}</td><td>{customer.whatsapp || 'None'}</td><td>{customer.cityTown}</td><td>{customer.suburb}</td><td>{customer.source}</td><td><span className={`sci-status-pill ${statusClass(customer.status)}`}>{customer.status}</span></td><td>{customer.creditStatus}</td><td>Placeholder</td><td><div className="pos-approval-actions"><button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => onProfile(customer)}>View Profile</button><button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => onSelect(customer)}>Select for Sale Placeholder</button><button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => onNote(customer)}>Add Note</button><button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => onSuspend(customer)}>Suspend Placeholder</button></div></td></tr>)}
      </tbody></table></div>
    </section>
  );
}

function CustomerProfile({ customer, onApprove, onReject, onDuplicate, onSuspend, onNote, onSelect }: { customer: CustomerRecord; onApprove: (customer: CustomerRecord) => void; onReject: (customer: CustomerRecord) => void; onDuplicate: (customer: CustomerRecord) => void; onSuspend: (customer: CustomerRecord) => void; onNote: () => void; onSelect: (customer: CustomerRecord) => void }) {
  const rows = [['Customer Name', customer.customerName], ['Customer Code', customer.customerCode], ['Customer Type', customer.customerType], ['Phone', customer.phone], ['WhatsApp', customer.whatsapp], ['Email', customer.email], ['Tax Number', customer.taxNumber || 'None'], ['Billing Address', customer.billingAddress], ['Delivery Address', customer.deliveryAddress], ['City / Town', customer.cityTown], ['District', customer.district], ['Suburb', customer.suburb], ['Source', customer.source], ['Status', customer.status], ['Credit Status', customer.creditStatus], ['Credit Limit Placeholder', money(customer.creditLimit)], ['Current Balance Placeholder', money(customer.currentBalance)], ['Created By', customer.createdByStaffId], ['Approved By', customer.approvedByStaffId || 'Pending'], ['Created At', dateLabel(customer.createdAt)]];
  return <section className="sci-pos-card"><div className="sci-pos-card__bar"><div><p className="sci-pos-eyebrow">Profile</p><h2>Customer Profile</h2></div></div><div className="pos-customer-profile-grid">{rows.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><div className="pos-control-actions"><button type="button" className="sci-pos-button sci-pos-button--secondary">Edit Draft Placeholder</button><button type="button" className="sci-pos-button sci-pos-button--primary" onClick={() => onApprove(customer)}>Approve Customer</button><button type="button" className="sci-pos-button sci-pos-button--danger" onClick={() => onReject(customer)}>Reject Customer</button><button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => onDuplicate(customer)}>Mark Duplicate</button><button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => onSuspend(customer)}>Suspend Customer</button><button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={onNote}>Add Note</button><button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => onSelect(customer)}>Select for Sale Placeholder</button></div></section>;
}

function SimpleTable({ title, icon, headings, children }: { title: string; icon: ReactNode; headings: string[]; children: ReactNode }) {
  return <section className="sci-pos-card"><div className="sci-pos-card__bar"><div><p className="sci-pos-eyebrow">Customer</p><h2>{title}</h2></div>{icon}</div><div className="sci-pos-table-wrap"><table className="sci-pos-table"><thead><tr>{headings.map((heading) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{children}</tbody></table></div></section>;
}

function FilterInput({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label>{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void }) {
  return <label>{label}<select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}
