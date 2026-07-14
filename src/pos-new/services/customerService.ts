import {
  mockCustomerActivityEvents,
  mockCustomerNotes,
  mockCustomerPurchaseHistory,
  mockCustomers,
  mockRecentSales
} from '../mock/mockPosData';

/*
 * Placeholder / Mock Data Sources Audited (Phase 2):
 * - mockCustomers: Seeded list of 10 customers including walk-in, tapiwa, rudo, farai, memory, brian, apex-fleet, mutsa-closet, and pending/duplicate examples.
 * - mockCustomerAddresses: Billing and delivery address structures mapped from mockCustomers.
 * - mockCustomerPurchaseHistory: Fallback customer sales history rows containing records for Tapiwa, Rudo, Farai, and Apex Fleet.
 * - mockCustomerNotes: Seeded note objects for Tapiwa, Rudo, and Memory.
 * - mockCustomerActivityEvents: Seeded activity history actions including pending request creation, purchase, duplicate flag, and credit review.
 */
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
  PosSession,
  Role,
  Transaction
} from '../types';
import { createOperationalApproval } from './approvalService';
import { assertCanonicalCustomerContext, type CanonicalCustomerContext } from './customerContextService';
import { getActiveVendorId, getVendorScopedStorageKey, readVendorScopedList, writeVendorScopedList } from '../utils/vendorDataMode';
import type { SharedCustomerRecord } from '../firebase/commerceDataContract';
import type { RepositoryOperationContext } from '../repositories/repositoryContext';
import { appendCustomerInteractionCommand, createCustomerAddressCommand, createCustomerCommand, createCustomerRequestCommand as createMasterRequest, listCustomerAddresses, listCustomerInteractions, loadCustomerMaster, updateCustomerAddressCommand, updateCustomerCommand } from './customerMasterService';

const CUSTOMER_KEY = 'itred_pos_customers_v1';
const CUSTOMER_HISTORY_KEY = 'itred_pos_customer_purchase_history_v1';
const CUSTOMER_NOTES_KEY = 'itred_pos_customer_notes_v1';
const CUSTOMER_ACTIVITY_KEY = 'itred_pos_customer_activity_v1';

export const CUSTOMERS_COLLECTION = 'customers';
const firebaseCustomerMode = (): boolean => import.meta.env.VITE_STORAGE_MODE === 'firebase';

function masterContext(context: CanonicalCustomerContext): RepositoryOperationContext {
  return { vendorId: context.vendorId, branchId: context.branchId, warehouseId: context.warehouseId, terminalId: context.terminalId, staffId: context.staffId, actorId: context.staffId, actorRole: context.role, sourceApp: 'ITRED_POS', correlationId: `customer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}` };
}

function fromShared(row: SharedCustomerRecord): CustomerRecord {
  const statuses: Record<string, CustomerRecord['status']> = { ACTIVE: 'Active', INACTIVE: 'Inactive', PENDING_APPROVAL: 'Pending Approval', REJECTED: 'Rejected', DUPLICATE: 'Duplicate', SUSPENDED: 'Suspended' };
  return { customerId: row.customerId, vendorId: row.vendorId, customerCode: row.customerId, customerName: row.displayName, customerType: (row.customerType || 'Individual') as CustomerType, tradingName: row.businessName, phone: row.phone || '', whatsapp: row.whatsappNumber || '', email: row.email || '', taxNumber: row.taxNumber || '', billingAddress: '', deliveryAddress: '', cityTown: '', district: '', suburb: '', source: 'Sales Terminal', status: statuses[row.status] || 'Active', creditStatus: row.creditAllowed ? 'Credit Allowed' : 'Cash Only', creditEnabled: row.creditAllowed, creditLimit: row.creditLimit, paymentTermsDays: row.paymentTermsDays, currentBalance: 0, overdueBalance: 0, notes: '', createdByStaffId: row.createdBy, createdAt: row.createdAt, updatedAt: row.updatedAt };
}

function toSharedPatch(row: Partial<CustomerRecord>): Partial<SharedCustomerRecord> {
  const statuses: Partial<Record<CustomerRecord['status'], string>> = { Active: 'ACTIVE', Inactive: 'INACTIVE', Suspended: 'SUSPENDED', 'Pending Approval': 'PENDING_APPROVAL', Rejected: 'REJECTED', Duplicate: 'DUPLICATE' };
  return { displayName: row.customerName, businessName: row.tradingName, phone: row.phone, whatsappNumber: row.whatsapp, email: row.email, taxNumber: row.taxNumber, customerType: row.customerType, status: row.status ? statuses[row.status] : undefined, creditAllowed: row.creditEnabled ?? (row.creditStatus ? row.creditStatus === 'Credit Allowed' || row.creditStatus === 'Approved' : undefined), creditLimit: row.creditLimit, paymentTermsDays: row.paymentTermsDays };
}

export function realRecordsExist(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    // 1. Check transactions key
    const rawTxs = localStorage.getItem(getVendorScopedStorageKey('itred_pos_transactions'));
    if (rawTxs) {
      const txs = JSON.parse(rawTxs);
      if (Array.isArray(txs)) {
        const hasRealTxs = txs.some(
          (tx: any) => tx.branch || tx.terminal || tx.customerId || (tx.id && !['TXN-88220', 'TXN-88221'].includes(tx.id))
        );
        if (hasRealTxs) return true;
      }
    }

    // 2. Check customer key
    const rawCusts = localStorage.getItem(getVendorScopedStorageKey(CUSTOMER_KEY));
    if (rawCusts) {
      const custs = JSON.parse(rawCusts);
      if (Array.isArray(custs)) {
        const mockIds = ['CUST-WALKIN', 'CUST-TAPIWA', 'CUST-RUDO', 'CUST-FARAI', 'CUST-MEMORY', 'CUST-BRIAN', 'CUST-APEX-FLEET', 'CUST-MUTSA-CLOSET', 'CUST-PENDING-001', 'CUST-DUP-001'];
        const hasRealCusts = custs.some((c: any) => c.customerId && !mockIds.includes(c.customerId));
        if (hasRealCusts) return true;
      }
    }

    // 3. Check debts key
    const rawDebts = localStorage.getItem(getVendorScopedStorageKey('itred_pos_customer_debts_v1'));
    if (rawDebts) {
      const debts = JSON.parse(rawDebts);
      if (Array.isArray(debts) && debts.length > 0) return true;
    }
  } catch (e) {
    // Ignore error
  }
  return false;
}

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

function readList<T>(key: string, fallback: T[], vendorId?: string): T[] {
  return readVendorScopedList<T>(key, fallback, vendorId);
}

function saveList<T>(key: string, value: T[], vendorId?: string): T[] {
  return writeVendorScopedList(key, value, vendorId);
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

async function recordCustomerActivity(event: Omit<CustomerActivityEvent, 'id' | 'dateTime'>, vendorId?: string): Promise<CustomerActivityEvent[]> {
  if (firebaseCustomerMode()) {
    const context = assertCanonicalCustomerContext();
    const result = await appendCustomerInteractionCommand(masterContext(context), { customerId: event.customerId, interactionType: event.eventType, channel: 'INTERNAL', notes: event.notes, staffId: event.user });
    if (!result.success || !result.data) throw new Error(result.errorMessage || 'Customer interaction could not be recorded.');
    return [{ ...event, id: result.data.interactionId, dateTime: result.data.createdAt }];
  }
  const events = readList<CustomerActivityEvent>(CUSTOMER_ACTIVITY_KEY, mockCustomerActivityEvents, vendorId);
  const next: CustomerActivityEvent = {
    ...event,
    id: makeId('CAE'),
    dateTime: nowIso()
  };
  return saveList(CUSTOMER_ACTIVITY_KEY, [next, ...events].slice(0, 100), vendorId);
}

export async function getCustomers(filters: CustomerFilterState = {}, session?: PosSession | CanonicalCustomerContext | null): Promise<CustomerRecord[]> {
  const context = assertCanonicalCustomerContext(session);
  if (firebaseCustomerMode()) {
    const statusMap: Record<string, string> = { Active: 'ACTIVE', Inactive: 'INACTIVE', Suspended: 'SUSPENDED', 'Pending Approval': 'PENDING_APPROVAL', Rejected: 'REJECTED', Duplicate: 'DUPLICATE' };
    const result = await loadCustomerMaster(masterContext(context), { status: filters.status && filters.status !== 'All' ? statusMap[filters.status] || filters.status : undefined, customerType: filters.customerType && filters.customerType !== 'All' ? filters.customerType : undefined });
    if (!result.success) throw new Error(result.errorMessage || 'Customer master could not be loaded.');
    return result.records.map(fromShared).filter((customer) => matchesFilters(customer, filters));
  }
  let list = readList<CustomerRecord>(CUSTOMER_KEY, mockCustomers, context.vendorId);
  if (realRecordsExist()) {
    const mockIds = [
      'CUST-TAPIWA', 'CUST-RUDO', 'CUST-FARAI', 'CUST-MEMORY',
      'CUST-BRIAN', 'CUST-APEX-FLEET', 'CUST-MUTSA-CLOSET',
      'CUST-PENDING-001', 'CUST-DUP-001'
    ];
    list = list.filter((c) => c.customerId === 'CUST-WALKIN' || !mockIds.includes(c.customerId));
  }
  return list
    .filter((customer) => customer.vendorId === context.vendorId)
    .filter((customer) => matchesFilters(customer, filters));
}

export async function getCustomerById(customerId: string, session?: PosSession | CanonicalCustomerContext | null): Promise<CustomerRecord | null> {
  const context = assertCanonicalCustomerContext(session);
  if (firebaseCustomerMode()) {
    const result = await loadCustomerMaster(masterContext(context));
    if (!result.success) throw new Error(result.errorMessage || 'Customer master could not be loaded.');
    const row = result.records.find((customer) => customer.customerId === customerId);
    if (!row) return null;
    const mapped = fromShared(row);
    const addresses = await listCustomerAddresses(masterContext(context), customerId);
    if (addresses.success) {
      const billing = addresses.records.find((address) => address.status !== 'INACTIVE' && address.isDefaultBilling);
      const delivery = addresses.records.find((address) => address.status !== 'INACTIVE' && address.isDefaultDelivery);
      mapped.billingAddress = billing?.addressLine1 || '';
      mapped.deliveryAddress = delivery?.addressLine1 || billing?.addressLine1 || '';
      mapped.cityTown = delivery?.city || billing?.city || '';
      mapped.district = delivery?.province || billing?.province || '';
      mapped.suburb = delivery?.suburb || billing?.suburb || '';
    }
    return mapped;
  }
  let list = readList<CustomerRecord>(CUSTOMER_KEY, mockCustomers, context.vendorId);
  if (realRecordsExist()) {
    const mockIds = [
      'CUST-TAPIWA', 'CUST-RUDO', 'CUST-FARAI', 'CUST-MEMORY',
      'CUST-BRIAN', 'CUST-APEX-FLEET', 'CUST-MUTSA-CLOSET',
      'CUST-PENDING-001', 'CUST-DUP-001'
    ];
    list = list.filter((c) => c.customerId === 'CUST-WALKIN' || !mockIds.includes(c.customerId));
  }
  return list.find((customer) => customer.vendorId === context.vendorId && customer.customerId === customerId) || null;
}

export async function searchCustomers(query: string, filters: CustomerFilterState = {}): Promise<CustomerRecord[]> {
  return getCustomers({ ...filters, search: query });
}

export async function getCustomerSummary(filters: CustomerFilterState = {}): Promise<CustomerSummary> {
  const context = assertCanonicalCustomerContext();
  const customers = await getCustomers(filters, context);
  let history: { customerId: string }[] = [];
  if (realRecordsExist()) {
    try {
      const raw = localStorage.getItem(getVendorScopedStorageKey('itred_pos_transactions', context.vendorId));
      if (raw) {
        const txs = JSON.parse(raw);
        if (Array.isArray(txs)) {
          history = txs.filter((tx) => tx.id !== 'TXN-88220' && tx.id !== 'TXN-88221');
        }
      }
    } catch {}
  } else {
    history = readList<CustomerPurchaseHistoryRow>(CUSTOMER_HISTORY_KEY, mockCustomerPurchaseHistory, context.vendorId);
  }
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
  const context = assertCanonicalCustomerContext();
  const errors = validateCustomerPayload(payload);
  if (errors.length) throw new Error(errors.join(' '));
  if (firebaseCustomerMode()) {
    const operationContext = masterContext(context);
    const result = await createCustomerCommand(operationContext, { displayName: payload.customerName, businessName: payload.customerType === 'Business' ? payload.customerName : undefined, phone: payload.phone, whatsappNumber: payload.whatsapp, email: payload.email, taxNumber: payload.taxNumber, customerType: payload.customerType, creditAllowed: payload.creditStatus === 'Credit Allowed' || payload.creditStatus === 'Approved', creditLimit: payload.creditLimit, paymentTermsDays: 30, status: 'ACTIVE' });
    if (!result.success || !result.data) throw new Error(result.errorMessage || 'Customer could not be created.');
    if (payload.billingAddress?.trim()) await createCustomerAddressCommand(operationContext, { customerId: result.data.customerId, label: 'Billing', addressLine1: payload.billingAddress, city: payload.cityTown, suburb: payload.suburb, province: payload.district, country: 'Zimbabwe', isDefaultBilling: true, isDefaultDelivery: payload.deliveryAddress === payload.billingAddress });
    if (payload.deliveryAddress?.trim() && payload.deliveryAddress !== payload.billingAddress) await createCustomerAddressCommand(operationContext, { customerId: result.data.customerId, label: 'Delivery', addressLine1: payload.deliveryAddress, city: payload.cityTown, suburb: payload.suburb, province: payload.district, country: 'Zimbabwe', isDefaultDelivery: true });
    return { ...fromShared(result.data), billingAddress: payload.billingAddress || '', deliveryAddress: payload.deliveryAddress || payload.billingAddress || '', cityTown: payload.cityTown || '', district: payload.district || '', suburb: payload.suburb || '', notes: payload.notes || '', createdByStaffId: context.staffId || staffId };
  }
  const customers = readList<CustomerRecord>(CUSTOMER_KEY, mockCustomers, context.vendorId);
  const duplicate = customers.find((customer) =>
    customer.vendorId === context.vendorId
    && (
      (payload.phone && customer.phone === payload.phone.trim())
      || (payload.whatsapp && customer.whatsapp === payload.whatsapp.trim())
      || (payload.email && customer.email.toLowerCase() === payload.email.trim().toLowerCase())
      || (payload.taxNumber && customer.taxNumber.toLowerCase() === payload.taxNumber.trim().toLowerCase())
      || normalize(customer.customerName) === normalize(payload.customerName)
    )
  );
  if (duplicate) throw new Error(`Possible duplicate customer: ${duplicate.customerName}.`);
  const timestamp = nowIso();
  const customer: CustomerRecord = {
    customerId: makeId('CUST'),
    vendorId: context.vendorId,
    customerCode: nextCustomerCode(customers),
    customerName: payload.customerName.trim(),
    customerType: payload.customerType,
    phone: payload.phone?.trim() || '',
    whatsapp: payload.whatsapp?.trim() || payload.phone?.trim() || '',
    email: payload.email?.trim() || '',
    taxNumber: payload.taxNumber?.trim() || '',
    billingAddress: payload.billingAddress?.trim() || '',
    deliveryAddress: payload.deliveryAddress?.trim() || payload.billingAddress?.trim() || '',
    cityTown: payload.cityTown?.trim() || '',
    city: payload.cityTown?.trim() || '',
    district: payload.district?.trim() || '',
    suburb: payload.suburb?.trim() || '',
    source: payload.source || 'Sales Terminal',
    status: 'Active',
    creditStatus: payload.creditStatus || 'Cash Only',
    creditEnabled: payload.creditStatus === 'Credit Allowed' || payload.creditStatus === 'Approved',
    creditLimit: payload.creditLimit,
    currentBalance: 0,
    overdueBalance: 0,
    paymentTermsDays: 30,
    riskLevel: 'Low',
    notes: payload.notes?.trim() || '',
    createdByStaffId: context.staffId || staffId,
    approvedByStaffId: context.staffId || staffId,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  saveList(CUSTOMER_KEY, [customer, ...customers], context.vendorId);
  await recordCustomerActivity({
    customerId: customer.customerId,
    eventType: 'CUSTOMER_CREATED',
    user: staffId,
    notes: 'Customer created directly in Customer Centre.'
  }, context.vendorId);
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
  const context = assertCanonicalCustomerContext();
  if (firebaseCustomerMode()) {
    const operationContext = masterContext(context);
    const customer = await createCustomerCommand(operationContext, { displayName: payload.customerName || 'Pending Customer', phone: payload.phone, whatsappNumber: payload.whatsapp, email: payload.email, taxNumber: payload.taxNumber, customerType: 'Individual', status: 'PENDING_APPROVAL' });
    if (!customer.success || !customer.data) throw new Error(customer.errorMessage || 'Customer request could not be created.');
    const request = await createMasterRequest(operationContext, { customerId: customer.data.customerId, requestType: 'CUSTOMER_ONBOARDING', title: `New customer approval: ${customer.data.displayName}`, description: payload.notes, status: 'OPEN', priority: 'MEDIUM' });
    if (!request.success) throw new Error(request.errorMessage || 'Customer approval request could not be created.');
    if (payload.billingAddress?.trim()) await createCustomerAddressCommand(operationContext, { customerId: customer.data.customerId, label: 'Billing', addressLine1: payload.billingAddress, city: payload.cityTown, suburb: payload.suburb, province: payload.district, country: 'Zimbabwe', isDefaultBilling: true });
    return { ...fromShared(customer.data), billingAddress: payload.billingAddress || '', deliveryAddress: payload.deliveryAddress || payload.billingAddress || '', cityTown: payload.cityTown || '', district: payload.district || '', suburb: payload.suburb || '', notes: payload.notes || '', createdByStaffId: payload.requestedByStaffId };
  }
  const customers = readList<CustomerRecord>(CUSTOMER_KEY, mockCustomers, context.vendorId);
  const timestamp = nowIso();
  const duplicate = customers.find((customer) =>
    customer.vendorId === context.vendorId
    && (
      (payload.phone && customer.phone === payload.phone)
      || (payload.whatsapp && customer.whatsapp === payload.whatsapp)
      || (payload.email && customer.email.toLowerCase() === payload.email.trim().toLowerCase())
      || (payload.taxNumber && customer.taxNumber.toLowerCase() === payload.taxNumber.trim().toLowerCase())
      || normalize(customer.customerName) === normalize(payload.customerName)
    )
  );
  const customer: CustomerRecord = {
    customerId: makeId('CUST'),
    vendorId: context.vendorId,
    customerCode: `PEND-${String(customers.length + 1).padStart(4, '0')}`,
    customerName: payload.customerName || 'Pending Customer',
    customerType: 'Individual',
    phone: payload.phone || '',
    whatsapp: payload.whatsapp || payload.phone || '',
    email: payload.email || '',
    taxNumber: payload.taxNumber || '',
    billingAddress: payload.billingAddress || '',
    deliveryAddress: payload.deliveryAddress || payload.billingAddress || '',
    cityTown: payload.cityTown || '',
    district: payload.district || '',
    suburb: payload.suburb || '',
    source: payload.source || 'Sales Terminal',
    status: duplicate ? 'Duplicate' : 'Pending Approval',
    creditStatus: 'Cash Only',
    notes: payload.notes || '',
    createdByStaffId: payload.requestedByStaffId,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  saveList(CUSTOMER_KEY, [customer, ...customers], context.vendorId);
  await recordCustomerActivity({
    customerId: customer.customerId,
    eventType: 'CUSTOMER_CREATED_PENDING',
    user: staffId,
    notes: duplicate ? `Possible duplicate: ${duplicate.customerCode}.` : 'Customer request created and sent for approval.'
  }, context.vendorId);
  await createOperationalApproval({
    vendorId: context.vendorId,
    branchId: context.branchId,
    branch: context.branchId,
    category: 'NEW_CUSTOMER',
    requestedBy: payload.requestedByStaffName,
    requestedByRole: payload.requestedByRole,
    relatedRecord: customer.customerId,
    amountOrValue: customer.customerName,
    risk: duplicate ? 'High' : 'Medium',
    reason: duplicate ? 'Possible duplicate requires review.' : 'New customer request requires approval.',
    context: `Customer approval request for ${customer.customerName}.`,
    requiredPermission: 'approvals.approve'
  });
  return customer;
}

async function patchCustomer(customerId: string, patch: Partial<CustomerRecord>, eventType?: CustomerActivityEvent['eventType'], staffId = 'Admin User', notes = ''): Promise<CustomerRecord | null> {
  const context = assertCanonicalCustomerContext();
  if (firebaseCustomerMode()) {
    const operationContext = masterContext(context);
    const result = await updateCustomerCommand(operationContext, customerId, toSharedPatch(patch));
    if (!result.success) throw new Error(result.errorMessage || 'Customer could not be updated.');
    if (patch.billingAddress !== undefined || patch.deliveryAddress !== undefined) {
      const existing = await listCustomerAddresses(operationContext, customerId);
      const syncAddress = async (kind: 'Billing' | 'Delivery', addressLine1: string | undefined) => {
        if (!addressLine1?.trim()) return;
        const current = existing.success ? existing.records.find((row) => kind === 'Billing' ? row.isDefaultBilling : row.isDefaultDelivery) : undefined;
        const changes = { addressLine1, city: patch.cityTown, province: patch.district, suburb: patch.suburb, isDefaultBilling: kind === 'Billing', isDefaultDelivery: kind === 'Delivery' };
        if (current) await updateCustomerAddressCommand(operationContext, current.addressId, changes);
        else await createCustomerAddressCommand(operationContext, { customerId, label: kind, country: 'Zimbabwe', ...changes });
      };
      await syncAddress('Billing', patch.billingAddress);
      await syncAddress('Delivery', patch.deliveryAddress);
    }
    if (notes.trim()) await appendCustomerInteractionCommand(operationContext, { customerId, interactionType: eventType || 'CUSTOMER_UPDATED', channel: 'INTERNAL', notes });
    return result.data ? { ...fromShared(result.data), ...patch } : null;
  }
  const customers = readList<CustomerRecord>(CUSTOMER_KEY, mockCustomers, context.vendorId);
  let updatedCustomer: CustomerRecord | null = null;
  const updated = customers.map((customer) => {
    if (customer.vendorId !== context.vendorId || customer.customerId !== customerId) return customer;
    updatedCustomer = { ...customer, ...patch, updatedAt: nowIso() };
    return updatedCustomer;
  });
  saveList(CUSTOMER_KEY, updated, context.vendorId);
  if (updatedCustomer && eventType) {
    await recordCustomerActivity({ customerId, eventType, user: staffId, notes }, context.vendorId);
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
  const customer = await getCustomerById(customerId);
  if (!customer) return [];

  let txs: any[] = [];
  try {
    const raw = localStorage.getItem(getVendorScopedStorageKey('itred_pos_transactions'));
    if (raw) {
      txs = JSON.parse(raw);
    }
  } catch (e) {
    txs = [];
  }

  // Check if there are any real completed sales in the transactions list
  const hasRealSales = txs.some(
    (tx) => tx.branch || tx.terminal || tx.customerId || (tx.id && !['TXN-88220', 'TXN-88221'].includes(tx.id))
  );

  if (!hasRealSales) {
    // Keep mock data only as fallback when there are no completed sales
    return mockCustomerPurchaseHistory.filter((row) => row.customerId === customerId);
  }

  // Do not use seed data when real completed sales exist.
  const realTxs = txs.filter((tx) => tx.id !== 'TXN-88220' && tx.id !== 'TXN-88221');

  const matched = realTxs.filter((tx) => {
    // Match sales to customers using customerId first
    if (tx.customerId) {
      return tx.customerId === customerId;
    }

    // Walk-in sales can remain separate or show under WALK-IN customer
    if (customerId === 'CUST-WALKIN') {
      return !tx.customerName || tx.customerName === 'Walk-in Customer';
    }

    // Customer code/name/phone only as fallback
    if (tx.customerCode && customer.customerCode && tx.customerCode === customer.customerCode) {
      return true;
    }
    if (tx.customerName && customer.customerName && tx.customerName.toLowerCase() === customer.customerName.toLowerCase()) {
      return true;
    }
    if (tx.customerPhone && (tx.customerPhone === customer.phone || tx.customerPhone === customer.whatsapp)) {
      return true;
    }
    return false;
  });

  return matched.map((tx) => {
    const itemsCount = tx.items ? tx.items.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0) : 0;
    return {
      id: tx.id || `CPH-${Math.random()}`,
      customerId: customerId,
      customerName: tx.customerName || customer.customerName || 'Walk-in Customer',
      receiptNo: tx.invoiceNo || tx.receiptNo || 'N/A',
      date: tx.date || tx.dateTime || new Date().toISOString(),
      branch: tx.branch || 'Main Branch',
      cashier: tx.operator || 'Unknown',
      items: itemsCount,
      total: tx.total || tx.grandTotal || 0,
      paymentMethod: tx.paymentMethod || 'Cash',
      deliveryStatus: tx.deliveryStatus || 'No Delivery',
      returnStatus: tx.returnStatus || (tx.status === 'RETURNED' ? 'Returned' : 'None')
    };
  });
}

export async function getCustomerNotes(customerId: string): Promise<CustomerNote[]> {
  if (firebaseCustomerMode()) return [];
  let notes = readList<CustomerNote>(CUSTOMER_NOTES_KEY, mockCustomerNotes);
  if (realRecordsExist()) {
    const mockNoteIds = ['CN-TAPIWA-001', 'CN-RUDO-001', 'CN-MEMORY-001'];
    notes = notes.filter((n) => !mockNoteIds.includes(n.id));
  }
  return notes.filter((note) => note.customerId === customerId);
}

export async function addCustomerNote(customerId: string, staffId: string, note: string, role: Role = 'Cashier', relatedRecord = ''): Promise<CustomerNote[]> {
  if (firebaseCustomerMode()) {
    const context = assertCanonicalCustomerContext();
    const result = await appendCustomerInteractionCommand(masterContext(context), { customerId, interactionType: 'FOLLOW_UP', channel: 'INTERNAL', notes: note, relatedEntityId: relatedRecord || undefined, staffId });
    if (!result.success) throw new Error(result.errorMessage || 'Customer note could not be recorded.');
    return [{ id: result.data!.interactionId, customerId, dateTime: result.data!.createdAt, note, addedBy: staffId, role, relatedRecord }];
  }
  const notes = readList<CustomerNote>(CUSTOMER_NOTES_KEY, mockCustomerNotes);
  const next: CustomerNote = { id: makeId('CN'), customerId, dateTime: nowIso(), note, addedBy: staffId, role, relatedRecord };
  saveList(CUSTOMER_NOTES_KEY, [next, ...notes]);
  await recordCustomerActivity({ customerId, eventType: 'CUSTOMER_NOTE_ADDED', user: staffId, notes: note });
  return getCustomerNotes(customerId);
}

export async function getCustomerActivityEvents(filter: string | { customerId?: string } = {}): Promise<CustomerActivityEvent[]> {
  const customerId = typeof filter === 'string' ? filter : filter.customerId;
  if (firebaseCustomerMode()) {
    if (!customerId) return [];
    const context = assertCanonicalCustomerContext();
    const result = await listCustomerInteractions(masterContext(context), customerId);
    if (!result.success) throw new Error(result.errorMessage || 'Customer interactions could not be loaded.');
    return result.records.map((row) => ({ id: row.interactionId, customerId: row.customerId, dateTime: row.createdAt, eventType: row.interactionType as CustomerActivityEvent['eventType'], user: row.staffId || row.actorId, notes: row.notes || row.subject || '', relatedRecord: row.relatedEntityId }));
  }
  let events = readList<CustomerActivityEvent>(CUSTOMER_ACTIVITY_KEY, mockCustomerActivityEvents);
  if (realRecordsExist()) {
    const mockEventIds = ['CAE-001', 'CAE-002', 'CAE-003', 'CAE-004'];
    events = events.filter((e) => !mockEventIds.includes(e.id));
  }
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
