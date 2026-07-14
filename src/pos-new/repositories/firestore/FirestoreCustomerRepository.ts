import { collection, doc, getDoc, getDocs, onSnapshot, query, setDoc, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db, firebaseReady } from '../../firebase/firebaseApp';
import { firestorePaths } from '../../firebase/firestorePaths';
import { mapFirestoreError, REPOSITORY_ERROR_CODES, type RepositoryErrorCode } from './firestoreErrorMapper';
import { validateRepositoryOperationContext } from '../repositoryContext';
import type { CustomerListFilters, CustomerRepository, CustomerRequestFilters } from '../CustomerRepository';
import type { SharedCustomerAddressRecord, SharedCustomerInteractionRecord, SharedCustomerRecord, SharedCustomerRequestRecord } from '../../firebase/commerceDataContract';
import type { CommerceSourceApp, RepositoryOperationContext } from '../repositoryContext';

type Failure = { success: false; errorCode: string; errorMessage: string };
const failed = (errorMessage: string, errorCode: RepositoryErrorCode = REPOSITORY_ERROR_CODES.FAILED_PRECONDITION): Failure => ({ success: false, errorCode, errorMessage });

function preflight(context: RepositoryOperationContext): Failure | null {
  try { validateRepositoryOperationContext(context); } catch (error) { return failed(error instanceof Error ? error.message : 'Invalid repository operation context.'); }
  return firebaseReady && db ? null : failed('Firebase is not configured or Firestore is not available.', REPOSITORY_ERROR_CODES.UNAVAILABLE);
}

function nonBlank(value: string, name: string): Failure | null {
  return value?.trim() ? null : failed(`${name} must be a non-blank string.`);
}

function sameVendor(context: RepositoryOperationContext, value: unknown, operation: string): Failure | null {
  return value === context.vendorId ? null : failed(`Cross-vendor ${operation} is rejected.`);
}

const text = (data: Record<string, unknown>, key: string, fallback = ''): string => typeof data[key] === 'string' ? data[key] as string : fallback;
const dateText = (data: Record<string, unknown>, key: string): string => {
  const value = data[key];
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') return (value as { toDate: () => Date }).toDate().toISOString();
  return '';
};
const optionalText = (data: Record<string, unknown>, key: string): string | undefined => typeof data[key] === 'string' ? data[key] as string : undefined;
const optionalNumber = (data: Record<string, unknown>, key: string): number | undefined => typeof data[key] === 'number' ? data[key] as number : undefined;
const optionalBoolean = (data: Record<string, unknown>, key: string): boolean | undefined => typeof data[key] === 'boolean' ? data[key] as boolean : undefined;
const withoutUndefined = (data: Record<string, unknown>): Record<string, unknown> => Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));

function customer(data: Record<string, unknown>, vendorId: string): SharedCustomerRecord {
  return {
    sciId: text(data, 'sciId'), schemaVersion: optionalNumber(data, 'schemaVersion') || 1,
    status: text(data, 'status', 'ACTIVE'), vendorId: text(data, 'vendorId', vendorId), customerId: text(data, 'customerId'),
    displayName: text(data, 'displayName', text(data, 'customerName')), firstName: optionalText(data, 'firstName'), lastName: optionalText(data, 'lastName'), businessName: optionalText(data, 'businessName'),
    phone: optionalText(data, 'phone'), whatsappNumber: optionalText(data, 'whatsappNumber'), email: optionalText(data, 'email'), nationalId: optionalText(data, 'nationalId'), taxNumber: optionalText(data, 'taxNumber'), customerType: optionalText(data, 'customerType'),
    creditAllowed: optionalBoolean(data, 'creditAllowed'), creditLimit: optionalNumber(data, 'creditLimit'), paymentTermsDays: optionalNumber(data, 'paymentTermsDays'), firstTransactionAt: optionalText(data, 'firstTransactionAt'), lastTransactionAt: optionalText(data, 'lastTransactionAt'), orderCount: optionalNumber(data, 'orderCount'), lifetimeValue: optionalNumber(data, 'lifetimeValue'),
    createdAt: dateText(data, 'createdAt'), updatedAt: dateText(data, 'updatedAt'), createdBy: text(data, 'createdBy'), updatedBy: text(data, 'updatedBy'), sourceApp: text(data, 'sourceApp', 'SYSTEM') as CommerceSourceApp, lastSyncAt: optionalText(data, 'lastSyncAt')
  };
}

function address(data: Record<string, unknown>, vendorId: string): SharedCustomerAddressRecord {
  return { addressId: text(data, 'addressId'), vendorId: text(data, 'vendorId', vendorId), customerId: text(data, 'customerId'), label: optionalText(data, 'label'), addressLine1: text(data, 'addressLine1'), addressLine2: optionalText(data, 'addressLine2'), suburb: optionalText(data, 'suburb'), city: optionalText(data, 'city'), province: optionalText(data, 'province'), country: text(data, 'country'), postalCode: optionalText(data, 'postalCode'), latitude: optionalNumber(data, 'latitude'), longitude: optionalNumber(data, 'longitude'), isDefaultBilling: optionalBoolean(data, 'isDefaultBilling'), isDefaultDelivery: optionalBoolean(data, 'isDefaultDelivery'), status: text(data, 'status', 'ACTIVE'), createdAt: dateText(data, 'createdAt'), updatedAt: dateText(data, 'updatedAt'), createdBy: text(data, 'createdBy'), updatedBy: text(data, 'updatedBy') };
}

function interaction(data: Record<string, unknown>, vendorId: string): SharedCustomerInteractionRecord {
  return { interactionId: text(data, 'interactionId'), vendorId: text(data, 'vendorId', vendorId), customerId: text(data, 'customerId'), interactionType: text(data, 'interactionType'), channel: text(data, 'channel'), subject: optionalText(data, 'subject'), notes: optionalText(data, 'notes'), relatedEntityType: optionalText(data, 'relatedEntityType'), relatedEntityId: optionalText(data, 'relatedEntityId'), staffId: optionalText(data, 'staffId'), actorId: text(data, 'actorId'), sourceApp: text(data, 'sourceApp', 'SYSTEM') as CommerceSourceApp, createdAt: dateText(data, 'createdAt'), schemaVersion: optionalNumber(data, 'schemaVersion') || 1 };
}

function request(data: Record<string, unknown>, vendorId: string): SharedCustomerRequestRecord {
  return { requestId: text(data, 'requestId'), vendorId: text(data, 'vendorId', vendorId), customerId: optionalText(data, 'customerId'), requestType: text(data, 'requestType'), title: text(data, 'title'), description: optionalText(data, 'description'), status: text(data, 'status'), priority: optionalText(data, 'priority'), relatedProductId: optionalText(data, 'relatedProductId'), relatedSaleId: optionalText(data, 'relatedSaleId'), relatedDeliveryId: optionalText(data, 'relatedDeliveryId'), assignedStaffId: optionalText(data, 'assignedStaffId'), createdAt: dateText(data, 'createdAt'), updatedAt: dateText(data, 'updatedAt'), createdBy: text(data, 'createdBy'), updatedBy: text(data, 'updatedBy') };
}

function mappedFailure(error: unknown): Failure { const mapped = mapFirestoreError(error); return failed(mapped.errorMessage, mapped.errorCode); }

export function createFirestoreCustomerRepository(): CustomerRepository {
  const listCustomers = async (context: RepositoryOperationContext, filters?: CustomerListFilters) => {
    const invalid = preflight(context); if (invalid) return { ...invalid, records: [] };
    try {
      const snap = await getDocs(query(collection(db!, firestorePaths.customers(context.vendorId)), where('vendorId', '==', context.vendorId)));
      const records = snap.docs.map((row) => customer(row.data(), context.vendorId)).filter((row) => (!filters?.status || row.status === filters.status) && (!filters?.customerType || row.customerType === filters.customerType));
      return { success: true, records };
    } catch (error) { return { ...mappedFailure(error), records: [] }; }
  };

  const getCustomer = async (context: RepositoryOperationContext, customerId: string) => {
    const invalid = nonBlank(customerId, 'customerId') || preflight(context); if (invalid) return invalid;
    try { const snap = await getDoc(doc(db!, firestorePaths.customers(context.vendorId), customerId)); if (!snap.exists()) return failed('Customer not found.', REPOSITORY_ERROR_CODES.NOT_FOUND); const row = customer(snap.data(), context.vendorId); return sameVendor(context, row.vendorId, 'customer access') || { success: true, data: row }; } catch (error) { return mappedFailure(error); }
  };

  const findCustomer = async (context: RepositoryOperationContext, field: 'phone' | 'email', value: string) => {
    const invalid = nonBlank(value, field) || preflight(context); if (invalid) return invalid;
    try { const snap = await getDocs(query(collection(db!, firestorePaths.customers(context.vendorId)), where('vendorId', '==', context.vendorId), where(field, '==', value))); const row = snap.docs[0]; return row ? { success: true, data: customer(row.data(), context.vendorId) } : failed('Customer not found.', REPOSITORY_ERROR_CODES.NOT_FOUND); } catch (error) { return mappedFailure(error); }
  };

  const updateEntity = async <T>(context: RepositoryOperationContext, path: string, id: string, changes: Partial<T>, mapper: (data: Record<string, unknown>, vendorId: string) => T, label: string) => {
    const invalid = nonBlank(id, `${label}Id`) || preflight(context); if (invalid) return invalid;
    try { const ref = doc(db!, path, id); const snap = await getDoc(ref); if (!snap.exists()) return failed(`${label} not found.`, REPOSITORY_ERROR_CODES.NOT_FOUND); const current = snap.data(); const cross = sameVendor(context, current.vendorId, `${label} update`); if (cross) return cross; if ('vendorId' in changes && (changes as { vendorId?: string }).vendorId !== context.vendorId) return failed(`Cross-vendor ${label} update is rejected.`); if ('customerId' in changes && current.customerId && (changes as { customerId?: string }).customerId !== current.customerId) return failed(`${label} cannot be reassigned to another customer.`); const payload = withoutUndefined({ ...changes, updatedAt: serverTimestamp(), updatedBy: context.actorId }); await updateDoc(ref, payload); return { success: true, data: mapper({ ...current, ...changes, updatedAt: '', updatedBy: context.actorId }, context.vendorId) }; } catch (error) { return mappedFailure(error); }
  };

  return {
    getCustomer,
    getCustomerByPhone: (context, phone) => findCustomer(context, 'phone', phone),
    getCustomerByEmail: (context, email) => findCustomer(context, 'email', email),
    listCustomers,
    async searchCustomers(context, term, filters) { const result = await listCustomers(context, filters); if (!result.success) return result; const needle = term.trim().toLowerCase(); return { success: true, records: result.records.filter((row) => [row.customerId, row.displayName, row.businessName, row.phone, row.email, row.nationalId, row.taxNumber].some((value) => value?.toLowerCase().includes(needle))) }; },
    async createCustomer(context, record) { const invalid = nonBlank(record.customerId, 'customerId') || preflight(context) || sameVendor(context, record.vendorId, 'customer creation'); if (invalid) return invalid; try { const ref = doc(db!, firestorePaths.customers(context.vendorId), record.customerId); if ((await getDoc(ref)).exists()) return failed('Customer ID already exists.', REPOSITORY_ERROR_CODES.FAILED_PRECONDITION); await setDoc(ref, withoutUndefined({ ...record, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), createdBy: context.actorId, updatedBy: context.actorId, sourceApp: context.sourceApp })); return { success: true, data: { ...record, createdAt: '', updatedAt: '' } }; } catch (error) { return mappedFailure(error); } },
    updateCustomer: (context, id, changes) => updateEntity(context, firestorePaths.customers(context.vendorId), id, changes, customer, 'customer'),
    deactivateCustomer: (context, id) => updateEntity(context, firestorePaths.customers(context.vendorId), id, { status: 'INACTIVE' }, customer, 'customer'),
    async listAddresses(context, customerId) { const invalid = nonBlank(customerId, 'customerId') || preflight(context); if (invalid) return { ...invalid, records: [] }; try { const snap = await getDocs(query(collection(db!, firestorePaths.customerAddresses(context.vendorId)), where('vendorId', '==', context.vendorId), where('customerId', '==', customerId))); return { success: true, records: snap.docs.map((row) => address(row.data(), context.vendorId)) }; } catch (error) { return { ...mappedFailure(error), records: [] }; } },
    async createAddress(context, record) { const invalid = nonBlank(record.addressId, 'addressId') || nonBlank(record.customerId, 'customerId') || preflight(context) || sameVendor(context, record.vendorId, 'address creation'); if (invalid) return invalid; const owner = await getCustomer(context, record.customerId); if (!owner.success) return failed('Address customer does not exist in this vendor.', REPOSITORY_ERROR_CODES.NOT_FOUND); try { const ref = doc(db!, firestorePaths.customerAddresses(context.vendorId), record.addressId); if ((await getDoc(ref)).exists()) return failed('Address ID already exists.'); await setDoc(ref, withoutUndefined({ ...record, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), createdBy: context.actorId, updatedBy: context.actorId })); return { success: true, data: { ...record, createdAt: '', updatedAt: '' } }; } catch (error) { return mappedFailure(error); } },
    updateAddress: (context, id, changes) => updateEntity(context, firestorePaths.customerAddresses(context.vendorId), id, changes, address, 'address'),
    deactivateAddress: (context, id) => updateEntity(context, firestorePaths.customerAddresses(context.vendorId), id, { status: 'INACTIVE' }, address, 'address'),
    async listInteractions(context, customerId) { const invalid = nonBlank(customerId, 'customerId') || preflight(context); if (invalid) return { ...invalid, records: [] }; try { const snap = await getDocs(query(collection(db!, firestorePaths.customerInteractions(context.vendorId)), where('vendorId', '==', context.vendorId), where('customerId', '==', customerId))); return { success: true, records: snap.docs.map((row) => interaction(row.data(), context.vendorId)) }; } catch (error) { return { ...mappedFailure(error), records: [] }; } },
    async appendInteraction(context, record) { const invalid = nonBlank(record.interactionId, 'interactionId') || nonBlank(record.customerId, 'customerId') || preflight(context) || sameVendor(context, record.vendorId, 'interaction creation'); if (invalid) return invalid; const owner = await getCustomer(context, record.customerId); if (!owner.success) return failed('Interaction customer does not exist in this vendor.', REPOSITORY_ERROR_CODES.NOT_FOUND); try { const ref = doc(db!, firestorePaths.customerInteractions(context.vendorId), record.interactionId); if ((await getDoc(ref)).exists()) return failed('Interaction ID already exists.'); await setDoc(ref, withoutUndefined({ ...record, actorId: context.actorId, sourceApp: context.sourceApp, createdAt: serverTimestamp() })); return { success: true, data: { ...record, createdAt: '' } }; } catch (error) { return mappedFailure(error); } },
    async listCustomerRequests(context, filters?: CustomerRequestFilters) { const invalid = preflight(context); if (invalid) return { ...invalid, records: [] }; try { const snap = await getDocs(query(collection(db!, firestorePaths.customerRequests(context.vendorId)), where('vendorId', '==', context.vendorId))); const records = snap.docs.map((row) => request(row.data(), context.vendorId)).filter((row) => (!filters?.customerId || row.customerId === filters.customerId) && (!filters?.status || row.status === filters.status) && (!filters?.requestType || row.requestType === filters.requestType)); return { success: true, records }; } catch (error) { return { ...mappedFailure(error), records: [] }; } },
    async createCustomerRequest(context, record) { const invalid = nonBlank(record.requestId, 'requestId') || preflight(context) || sameVendor(context, record.vendorId, 'request creation'); if (invalid) return invalid; if (record.customerId && !(await getCustomer(context, record.customerId)).success) return failed('Request customer does not exist in this vendor.', REPOSITORY_ERROR_CODES.NOT_FOUND); try { const ref = doc(db!, firestorePaths.customerRequests(context.vendorId), record.requestId); if ((await getDoc(ref)).exists()) return failed('Request ID already exists.'); await setDoc(ref, withoutUndefined({ ...record, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), createdBy: context.actorId, updatedBy: context.actorId })); return { success: true, data: { ...record, createdAt: '', updatedAt: '' } }; } catch (error) { return mappedFailure(error); } },
    updateCustomerRequest: (context, id, changes) => updateEntity(context, firestorePaths.customerRequests(context.vendorId), id, changes, request, 'request'),
    subscribeCustomers(context, listener) { if (preflight(context)) return { unsubscribe: () => undefined }; return { unsubscribe: onSnapshot(query(collection(db!, firestorePaths.customers(context.vendorId)), where('vendorId', '==', context.vendorId)), (snap) => listener(snap.docs.map((row) => customer(row.data(), context.vendorId)))) }; },
    subscribeCustomerRequests(context, listener) { if (preflight(context)) return { unsubscribe: () => undefined }; return { unsubscribe: onSnapshot(query(collection(db!, firestorePaths.customerRequests(context.vendorId)), where('vendorId', '==', context.vendorId)), (snap) => listener(snap.docs.map((row) => request(row.data(), context.vendorId)))) }; }
  };
}
