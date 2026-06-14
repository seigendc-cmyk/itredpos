import {
  mockCustomerActivityEvents,
  mockCustomerNotes,
  mockCustomerPurchaseHistory,
  mockCustomers
} from '../mock/mockPosData';
import {
  CustomerActivityEvent,
  CustomerCreditStatus,
  CustomerFilterState,
  CustomerNote,
  CustomerPurchaseHistoryRow,
  CustomerRecord,
  CustomerSource,
  CustomerSummary,
  CustomerType,
  Role
} from '../types';
import { createOperationalApproval } from './approvalService';

const CUSTOMER_KEY = 'itred_pos_customers_v1';
const CUSTOMER_HISTORY_KEY = 'itred_pos_customer_purchase_history_v1';
const CUSTOMER_NOTES_KEY = 'itred_pos_customer_notes_v1';
const CUSTOMER_ACTIVITY_KEY = 'itred_pos_customer_activity_v1';
const VENDOR_ID = 'SCI-LOG-ZW';

export interface CustomerCreatePayload {
  customerName: string;
  customerType: CustomerType;
  phone?: string;
  whatsapp?: string;
  email?: string;
  taxNumber?: string;
  billingAddress?: string;
  deliveryAddress?: string;
  cityTown?: string;
  district?: string;
  suburb?: string;
  source?: CustomerSource;
  creditStatus?: CustomerCreditStatus;
  creditLimit?: number;
  currentBalance?: number;
  notes?: string;
}

function readList<T>(key: string, fallback: T[]): T[] {
  if (typeof localStorage === 'undefined') return fallback;
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
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(value));
  } catch {
    return value;
  }
  return value;
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function normalize(value?: string): string {
  return (value || '').toLowerCase().trim();
}

function customerSearchAliases(customer: CustomerRecord): string {
  const aliases: string[] = [];
  if (customer.creditStatus === 'Credit Review Required') aliases.push('credit watch credit review');
  if (customer.creditStatus === 'Credit Suspended') aliases.push('credit blocked suspended debt hold');
  if (customer.currentBalance && customer.currentBalance > 0) aliases.push('debt debtor outstanding balance');
  return aliases.join(' ');
}

function matchesSearch(customer: CustomerRecord, query?: string): boolean {
  const search = normalize(query);
  if (!search) return true;
  const customerSearchFields = customer as CustomerRecord & {
    address?: string;
    creditWorthinessGrade?: string;
    debtStatus?: string;
  };
  const haystack = [
    customer.customerId,
    customer.customerCode,
    customer.customerName,
    customer.customerType,
    customer.phone,
    customer.whatsapp,
    customer.email,
    customer.taxNumber,
    customer.billingAddress,
    customer.deliveryAddress,
    customerSearchFields.address,
    customer.cityTown,
    customer.district,
    customer.suburb,
    customer.source,
    customer.status,
    customer.creditStatus,
    customerSearchFields.creditWorthinessGrade,
    customerSearchFields.debtStatus,
    customerSearchAliases(customer),
    customer.notes
  ].join(' ').toLowerCase();
  return search.split(/\s+/).every((word) => haystack.includes(word));
}

function matchesFilters(customer: CustomerRecord, filters: CustomerFilterState = {}): boolean {
  if (!matchesSearch(customer, filters.search)) return false;
  if (filters.customerType && filters.customerType !== 'All' && customer.customerType !== filters.customerType) return false;
  if (filters.status && filters.status !== 'All' && customer.status !== filters.status) return false;
  if (filters.creditStatus && filters.creditStatus !== 'All' && customer.creditStatus !== filters.creditStatus) return false;
  if (filters.source && filters.source !== 'All' && customer.source !== filters.source) return false;
  if (filters.cityTown && !normalize(customer.cityTown).includes(normalize(filters.cityTown))) return false;
  if (filters.district && !normalize(customer.district).includes(normalize(filters.district))) return false;
  if (filters.suburb && !normalize(customer.suburb).includes(normalize(filters.suburb))) return false;
  if (filters.dateFrom && customer.createdAt < `${filters.dateFrom}T00:00:00`) return false;
  if (filters.dateTo && customer.createdAt > `${filters.dateTo}T23:59:59`) return false;
  return true;
}

async function recordCustomerActivity(event: Omit<CustomerActivityEvent, 'id' | 'dateTime'>): Promise<CustomerActivityEvent[]> {
  const events = readList<CustomerActivityEvent>(CUSTOMER_ACTIVITY_KEY, mockCustomerActivityEvents);
  const next: CustomerActivityEvent = {
    ...event,
    id: makeId('CAE'),
    dateTime: nowIso()
  };
  return saveList(CUSTOMER_ACTIVITY_KEY, [next, ...events].slice(0, 100));
}

export async function getCustomers(filters: CustomerFilterState = {}): Promise<CustomerRecord[]> {
  return readList<CustomerRecord>(CUSTOMER_KEY, mockCustomers).filter((customer) => matchesFilters(customer, filters));
}

export async function getCustomerById(customerId: string): Promise<CustomerRecord | null> {
  return readList<CustomerRecord>(CUSTOMER_KEY, mockCustomers).find((customer) => customer.customerId === customerId) || null;
}

export async function searchCustomers(query: string, filters: CustomerFilterState = {}): Promise<CustomerRecord[]> {
  return getCustomers({ ...filters, search: query });
}

export async function getCustomerSummary(filters: CustomerFilterState = {}): Promise<CustomerSummary> {
  const customers = await getCustomers(filters);
  const history = readList<CustomerPurchaseHistoryRow>(CUSTOMER_HISTORY_KEY, mockCustomerPurchaseHistory);
  return {
    totalCustomers: customers.length,
    activeCustomers: customers.filter((customer) => customer.status === 'Active').length,
    pendingApproval: customers.filter((customer) => customer.status === 'Pending Approval').length,
    duplicateReview: customers.filter((customer) => customer.status === 'Duplicate').length,
    suspended: customers.filter((customer) => customer.status === 'Suspended').length,
    whatsAppLeads: customers.filter((customer) => customer.source === 'WhatsApp Catalogue').length,
    repeatCustomers: customers.filter((customer) => history.filter((row) => row.customerId === customer.customerId).length > 0).length,
    creditReview: customers.filter((customer) => customer.creditStatus === 'Credit Review Required').length
  };
}

function nextCustomerCode(customers: CustomerRecord[]): string {
  const highest = customers.reduce((max, customer) => {
    const match = customer.customerCode.match(/CUST-(\d+)/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `CUST-${String(highest + 1).padStart(4, '0')}`;
}

export function validateCustomerPayload(payload: Partial<CustomerCreatePayload>): string[] {
  const errors: string[] = [];
  if (!payload.customerName?.trim()) errors.push('Customer name is required.');
  if (!payload.customerType) errors.push('Customer type is required.');
  const hasContact = Boolean(payload.phone?.trim() || payload.whatsapp?.trim() || payload.email?.trim());
  if (!hasContact) errors.push('At least one contact method is required.');
  if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email.trim())) errors.push('Email address is invalid.');
  if (payload.creditLimit !== undefined && Number.isNaN(Number(payload.creditLimit))) errors.push('Credit limit must be a number.');
  return errors;
}

export async function createCustomer(payload: CustomerCreatePayload, staffId: string): Promise<CustomerRecord> {
  const errors = validateCustomerPayload(payload);
  if (errors.length) throw new Error(errors.join(' '));
  const customers = readList<CustomerRecord>(CUSTOMER_KEY, mockCustomers);
  const timestamp = nowIso();
  const customer: CustomerRecord = {
    customerId: makeId('CUST'),
    vendorId: VENDOR_ID,
    customerCode: nextCustomerCode(customers),
    customerName: payload.customerName.trim(),
    customerType: payload.customerType,
    phone: payload.phone?.trim() || '',
    whatsapp: payload.whatsapp?.trim() || payload.phone?.trim() || '',
    email: payload.email?.trim() || '',
    taxNumber: payload.taxNumber?.trim() || '',
    billingAddress: payload.billingAddress?.trim() || '',
    deliveryAddress: payload.deliveryAddress?.trim() || payload.billingAddress?.trim() || '',
    cityTown: payload.cityTown?.trim() || 'Harare',
    district: payload.district?.trim() || 'Harare',
    suburb: payload.suburb?.trim() || '',
    source: payload.source || 'Sales Terminal',
    status: 'Active',
    creditStatus: payload.creditStatus || 'Cash Only',
    creditLimit: payload.creditLimit,
    currentBalance: payload.currentBalance || 0,
    notes: payload.notes?.trim() || '',
    createdByStaffId: staffId,
    approvedByStaffId: staffId,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  saveList(CUSTOMER_KEY, [customer, ...customers]);
  await recordCustomerActivity({
    customerId: customer.customerId,
    eventType: 'CUSTOMER_CREATED',
    user: staffId,
    notes: 'Customer created directly in Customer Centre.'
  });
  return customer;
}

export async function createCustomerRequest(payload: {
  customerName: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  taxNumber?: string;
  billingAddress?: string;
  deliveryAddress?: string;
  cityTown?: string;
  district?: string;
  suburb?: string;
  notes?: string;
  source?: CustomerRecord['source'];
  requestedByStaffId: string;
  requestedByStaffName: string;
  requestedByRole: Role;
}, staffId = payload.requestedByStaffName): Promise<CustomerRecord> {
  const customers = readList<CustomerRecord>(CUSTOMER_KEY, mockCustomers);
  const timestamp = nowIso();
  const duplicate = customers.find((customer) =>
    (payload.phone && customer.phone === payload.phone)
    || (payload.whatsapp && customer.whatsapp === payload.whatsapp)
    || normalize(customer.customerName) === normalize(payload.customerName)
  );
  const customer: CustomerRecord = {
    customerId: makeId('CUST'),
    vendorId: VENDOR_ID,
    customerCode: `PEND-${String(customers.length + 1).padStart(4, '0')}`,
    customerName: payload.customerName || 'Pending Customer',
    customerType: 'Individual',
    phone: payload.phone || '',
    whatsapp: payload.whatsapp || payload.phone || '',
    email: payload.email || '',
    taxNumber: payload.taxNumber || '',
    billingAddress: payload.billingAddress || '',
    deliveryAddress: payload.deliveryAddress || payload.billingAddress || '',
    cityTown: payload.cityTown || 'Harare',
    district: payload.district || 'Harare',
    suburb: payload.suburb || '',
    source: payload.source || 'Sales Terminal',
    status: duplicate ? 'Duplicate' : 'Pending Approval',
    creditStatus: 'Cash Only',
    notes: payload.notes || '',
    createdByStaffId: payload.requestedByStaffId,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  saveList(CUSTOMER_KEY, [customer, ...customers]);
  await recordCustomerActivity({
    customerId: customer.customerId,
    eventType: 'CUSTOMER_CREATED_PENDING',
    user: staffId,
    notes: duplicate ? `Duplicate warning placeholder: possible match ${duplicate.customerCode}.` : 'Customer request created and sent for approval.'
  });
  await createOperationalApproval({
    vendorId: VENDOR_ID,
    branchId: 'BR-HARARE',
    branch: 'Harare Main',
    category: 'NEW_CUSTOMER',
    requestedBy: payload.requestedByStaffName,
    requestedByRole: payload.requestedByRole,
    relatedRecord: customer.customerId,
    amountOrValue: customer.customerName,
    risk: duplicate ? 'High' : 'Medium',
    reason: duplicate ? 'Duplicate warning placeholder requires review.' : 'New customer request requires approval.',
    context: `Customer approval request for ${customer.customerName}.`,
    requiredPermission: 'approvals.approve'
  });
  return customer;
}

async function patchCustomer(customerId: string, patch: Partial<CustomerRecord>, eventType?: CustomerActivityEvent['eventType'], staffId = 'Admin User', notes = ''): Promise<CustomerRecord | null> {
  const customers = readList<CustomerRecord>(CUSTOMER_KEY, mockCustomers);
  let updatedCustomer: CustomerRecord | null = null;
  const updated = customers.map((customer) => {
    if (customer.customerId !== customerId) return customer;
    updatedCustomer = { ...customer, ...patch, updatedAt: nowIso() };
    return updatedCustomer;
  });
  saveList(CUSTOMER_KEY, updated);
  if (updatedCustomer && eventType) {
    await recordCustomerActivity({ customerId, eventType, user: staffId, notes });
  }
  return updatedCustomer;
}

export async function approveCustomer(customerId: string, approverStaffId: string, notes = ''): Promise<CustomerRecord | null> {
  return patchCustomer(customerId, { status: 'Active', approvedByStaffId: approverStaffId }, 'CUSTOMER_APPROVED', approverStaffId, notes || 'Customer approved.');
}

export async function rejectCustomer(customerId: string, approverStaffId: string, notes = ''): Promise<CustomerRecord | null> {
  return patchCustomer(customerId, { status: 'Rejected' }, 'CUSTOMER_REJECTED', approverStaffId, notes || 'Customer rejected.');
}

export async function markCustomerDuplicate(customerId: string, duplicateOfCustomerId: string, staffId: string, notes = ''): Promise<CustomerRecord | null> {
  return patchCustomer(customerId, { status: 'Duplicate', notes: `${notes} Duplicate of ${duplicateOfCustomerId}`.trim() }, 'CUSTOMER_DUPLICATE_FLAGGED', staffId, notes || `Duplicate of ${duplicateOfCustomerId}.`);
}

export async function suspendCustomer(customerId: string, staffId: string, notes = ''): Promise<CustomerRecord | null> {
  return patchCustomer(customerId, { status: 'Suspended' }, 'CUSTOMER_SUSPENDED', staffId, notes || 'Customer suspended.');
}

export async function reactivateCustomer(customerId: string, staffId: string, notes = ''): Promise<CustomerRecord | null> {
  return patchCustomer(customerId, { status: 'Active' }, 'CUSTOMER_REACTIVATED', staffId, notes || 'Customer reactivated.');
}

export async function updateCustomer(customerId: string, patch: Partial<CustomerRecord>, staffId = 'Admin User', notes = ''): Promise<CustomerRecord | null> {
  return patchCustomer(customerId, patch, 'CUSTOMER_UPDATED', staffId, notes || 'Customer record updated.');
}

export async function markCustomerCreditReview(customerId: string, staffId: string, notes = ''): Promise<CustomerRecord | null> {
  return patchCustomer(customerId, { creditStatus: 'Credit Review Required' }, 'CUSTOMER_CREDIT_REVIEW_REQUIRED', staffId, notes || 'Customer marked for credit review.');
}

export async function updateCustomerPlaceholder(customerId: string, patch: Partial<CustomerRecord>): Promise<CustomerRecord | null> {
  return updateCustomer(customerId, patch);
}

export async function getCustomerPurchaseHistory(customerId: string): Promise<CustomerPurchaseHistoryRow[]> {
  return readList<CustomerPurchaseHistoryRow>(CUSTOMER_HISTORY_KEY, mockCustomerPurchaseHistory).filter((row) => row.customerId === customerId);
}

export async function getCustomerNotes(customerId: string): Promise<CustomerNote[]> {
  return readList<CustomerNote>(CUSTOMER_NOTES_KEY, mockCustomerNotes).filter((note) => note.customerId === customerId);
}

export async function addCustomerNote(customerId: string, staffId: string, note: string, role: Role = 'Cashier', relatedRecord = ''): Promise<CustomerNote[]> {
  const notes = readList<CustomerNote>(CUSTOMER_NOTES_KEY, mockCustomerNotes);
  const next: CustomerNote = { id: makeId('CN'), customerId, dateTime: nowIso(), note, addedBy: staffId, role, relatedRecord };
  saveList(CUSTOMER_NOTES_KEY, [next, ...notes]);
  await recordCustomerActivity({ customerId, eventType: 'CUSTOMER_NOTE_ADDED', user: staffId, notes: note });
  return getCustomerNotes(customerId);
}

export async function getCustomerActivityEvents(filter: string | { customerId?: string } = {}): Promise<CustomerActivityEvent[]> {
  const customerId = typeof filter === 'string' ? filter : filter.customerId;
  const events = readList<CustomerActivityEvent>(CUSTOMER_ACTIVITY_KEY, mockCustomerActivityEvents);
  return customerId ? events.filter((event) => event.customerId === customerId) : events;
}

export async function recordCustomerSelectedForSale(customerId: string, staffId: string): Promise<CustomerActivityEvent[]> {
  return recordCustomerActivity({
    customerId,
    eventType: 'CUSTOMER_SELECTED_FOR_SALE',
    user: staffId,
    notes: 'Customer selected for Sales Terminal cart.'
  });
}

export async function recordCustomerSaleBridgeEvent(
  customerId: string,
  staffId: string,
  eventType: Extract<CustomerActivityEvent['eventType'],
    | 'CUSTOMER_SELECTED_SALES_TERMINAL_CTA_SHOWN'
    | 'CUSTOMER_SELECTED_SALES_TERMINAL_OPENED'
    | 'CUSTOMER_LOADED_FROM_CUSTOMER_CENTRE'
    | 'CUSTOMER_SELECTED_FOR_SALE_CLEARED'>,
  notes: string
): Promise<CustomerActivityEvent[]> {
  return recordCustomerActivity({ customerId, eventType, user: staffId, notes });
}

export async function exportCustomerListPlaceholder(filters: CustomerFilterState = {}): Promise<string> {
  const customers = await getCustomers(filters);
  return `Customer list export prepared for ${customers.length} customers.`;
}
