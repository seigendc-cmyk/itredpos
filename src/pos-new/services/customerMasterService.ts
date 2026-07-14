import { COMMERCE_SCHEMA_VERSION, type SharedAuditRecord, type SharedBIEventRecord, type SharedCustomerAddressRecord, type SharedCustomerInteractionRecord, type SharedCustomerRecord, type SharedCustomerRequestRecord } from '../firebase/commerceDataContract';
import { createFirestoreId } from '../firebase/firestoreIds';
import type { CustomerListFilters, CustomerRequestFilters } from '../repositories/CustomerRepository';
import { createRepositoryBundle, type RepositoryBundle } from '../repositories/repositoryFactory';
import { validateRepositoryOperationContext, type RepositoryOperationContext } from '../repositories/repositoryContext';
import type { RepositoryListResult, RepositoryResult } from '../repositories/repositoryTypes';

export interface CustomerMasterResult<T> extends RepositoryResult<T> { warnings?: string[]; possibleDuplicates?: SharedCustomerRecord[]; }
export interface CustomerMasterSnapshot { customers: SharedCustomerRecord[]; customerRequests: SharedCustomerRequestRecord[]; }

let bundle: RepositoryBundle | null = null;
const repositories = (): RepositoryBundle => bundle ||= createRepositoryBundle();
export const resetCustomerMasterBundle = (): void => { bundle = null; };

export function normalizeCustomerPhone(value?: string): string | undefined {
  if (!value?.trim()) return undefined;
  const raw = value.trim();
  const prefix = raw.startsWith('+') ? '+' : raw.startsWith('00') ? '+' : '';
  const digits = raw.replace(/\D/g, '').replace(/^00/, '');
  return digits ? `${prefix}${digits}` : undefined;
}

export function normalizeCustomerEmail(value?: string): string | undefined { return value?.trim() ? value.trim().toLowerCase() : undefined; }

function invalidContext(context: RepositoryOperationContext): CustomerMasterResult<never> | null {
  try { validateRepositoryOperationContext(context); return null; } catch (error) { return { success: false, errorCode: 'VALIDATION_ERROR', errorMessage: error instanceof Error ? error.message : 'Invalid customer context.' }; }
}

const invalid = (message: string): CustomerMasterResult<never> => ({ success: false, errorCode: 'VALIDATION_ERROR', errorMessage: message });
const clean = (value?: string): string | undefined => value?.trim() || undefined;

async function audit(context: RepositoryOperationContext, action: string, entityType: string, entityId: string, before: unknown, after: unknown): Promise<void> {
  const record: SharedAuditRecord = { vendorId: context.vendorId, branchId: context.branchId || '', terminalId: context.terminalId || '', staffId: context.staffId || context.actorId, actorId: context.actorId, actorRole: context.actorRole || '', action, entityType, entityId, before, after, reason: '', sourceApp: context.sourceApp, createdAt: new Date().toISOString(), correlationId: context.correlationId };
  await repositories().audit.appendAuditRecord(context, record);
}

async function publish(context: RepositoryOperationContext, eventType: string, entityType: string, entityId: string, metadata: Record<string, unknown>): Promise<void> {
  const event: SharedBIEventRecord = { eventId: createFirestoreId(`bi-${eventType.toLowerCase()}`), eventType, vendorId: context.vendorId, branchId: context.branchId || '', terminalId: context.terminalId || '', staffId: context.staffId || context.actorId, sourceApp: context.sourceApp, entityType, entityId, timestamp: new Date().toISOString(), correlationId: context.correlationId, severity: 'INFO', actionRequired: eventType === 'CUSTOMER_DUPLICATE_DETECTED', metadata, schemaVersion: COMMERCE_SCHEMA_VERSION };
  await repositories().biEvents.publishEvent(context, event);
}

async function duplicates(context: RepositoryOperationContext, input: Partial<SharedCustomerRecord>, excludingId?: string): Promise<SharedCustomerRecord[]> {
  const found = new Map<string, SharedCustomerRecord>();
  const phone = normalizeCustomerPhone(input.phone);
  const email = normalizeCustomerEmail(input.email);
  if (phone) { const result = await repositories().customers.getCustomerByPhone(context, phone); if (result.success && result.data && result.data.customerId !== excludingId) found.set(result.data.customerId, result.data); }
  if (email) { const result = await repositories().customers.getCustomerByEmail(context, email); if (result.success && result.data && result.data.customerId !== excludingId) found.set(result.data.customerId, result.data); }
  if (input.customerId && input.customerId !== excludingId) { const result = await repositories().customers.getCustomer(context, input.customerId); if (result.success && result.data) found.set(result.data.customerId, result.data); }
  if (input.nationalId || input.taxNumber) {
    const list = await repositories().customers.listCustomers(context);
    if (list.success) list.records.forEach((row) => { if (row.customerId !== excludingId && ((input.nationalId && row.nationalId === input.nationalId.trim()) || (input.taxNumber && row.taxNumber?.toLowerCase() === input.taxNumber.trim().toLowerCase()))) found.set(row.customerId, row); });
  }
  return [...found.values()];
}

export async function loadCustomerMaster(context: RepositoryOperationContext, filters?: CustomerListFilters): Promise<RepositoryListResult<SharedCustomerRecord>> {
  const contextError = invalidContext(context); if (contextError) return { ...contextError, records: [] };
  return repositories().customers.listCustomers(context, filters);
}

export async function loadCustomerRequests(context: RepositoryOperationContext, filters?: CustomerRequestFilters): Promise<RepositoryListResult<SharedCustomerRequestRecord>> { const contextError = invalidContext(context); if (contextError) return { ...contextError, records: [] }; return repositories().customers.listCustomerRequests(context, filters); }
export async function searchCustomerMaster(context: RepositoryOperationContext, searchTerm: string, filters?: CustomerListFilters): Promise<RepositoryListResult<SharedCustomerRecord>> { const contextError = invalidContext(context); if (contextError) return { ...contextError, records: [] }; return repositories().customers.searchCustomers(context, searchTerm, filters); }

export async function createCustomerCommand(context: RepositoryOperationContext, input: Partial<SharedCustomerRecord>): Promise<CustomerMasterResult<SharedCustomerRecord>> {
  const contextError = invalidContext(context); if (contextError) return contextError;
  const displayName = clean(input.displayName) || clean(input.businessName); if (!displayName) return invalid('Display name or business name is required.');
  const phone = normalizeCustomerPhone(input.phone); const email = normalizeCustomerEmail(input.email);
  if (!phone && !email && !normalizeCustomerPhone(input.whatsappNumber)) return invalid('At least one contact method is required.');
  if ((input.creditLimit ?? 0) < 0 || (input.paymentTermsDays ?? 0) < 0) return invalid('Credit limit and payment terms cannot be negative.');
  const possibleDuplicates = await duplicates(context, { ...input, phone, email });
  if (possibleDuplicates.length) { await publish(context, 'CUSTOMER_DUPLICATE_DETECTED', 'customer', input.customerId || 'new', { matchingCustomerIds: possibleDuplicates.map((row) => row.customerId) }); return { success: false, errorCode: 'POSSIBLE_DUPLICATE', errorMessage: 'Possible duplicate customer detected. Review before creating a separate identity.', warnings: ['No records were merged or created.'], possibleDuplicates }; }
  const customerId = clean(input.customerId) || createFirestoreId('cust');
  const record: SharedCustomerRecord = { customerId, sciId: clean(input.sciId) || `SCI-${customerId}`, vendorId: context.vendorId, displayName, firstName: clean(input.firstName), lastName: clean(input.lastName), businessName: clean(input.businessName), phone, whatsappNumber: normalizeCustomerPhone(input.whatsappNumber), email, nationalId: clean(input.nationalId), taxNumber: clean(input.taxNumber), customerType: clean(input.customerType), status: input.status || 'ACTIVE', creditAllowed: input.creditAllowed, creditLimit: input.creditLimit, paymentTermsDays: input.paymentTermsDays, firstTransactionAt: input.firstTransactionAt, lastTransactionAt: input.lastTransactionAt, orderCount: input.orderCount, lifetimeValue: input.lifetimeValue, sourceApp: context.sourceApp, schemaVersion: COMMERCE_SCHEMA_VERSION, createdAt: '', updatedAt: '', createdBy: context.actorId, updatedBy: context.actorId, lastSyncAt: input.lastSyncAt };
  const result = await repositories().customers.createCustomer(context, record);
  if (result.success) { await audit(context, 'CREATE_CUSTOMER', 'customer', customerId, null, result.data || record); await publish(context, 'CUSTOMER_CREATED', 'customer', customerId, { displayName }); }
  return result;
}

export async function updateCustomerCommand(context: RepositoryOperationContext, customerId: string, changes: Partial<SharedCustomerRecord>): Promise<CustomerMasterResult<SharedCustomerRecord>> {
  const contextError = invalidContext(context); if (contextError) return contextError; if (!customerId.trim()) return invalid('customerId must be a non-blank string.');
  const before = await repositories().customers.getCustomer(context, customerId); if (!before.success || !before.data) return before;
  if (changes.vendorId && changes.vendorId !== context.vendorId) return invalid('Cross-vendor customer update is rejected.');
  if (changes.customerId && changes.customerId !== customerId) return invalid('Canonical customer ID cannot be changed.');
  if (changes.sciId && changes.sciId !== before.data.sciId) return invalid('Customer SCI identity cannot be changed.');
  if (changes.displayName !== undefined && !changes.displayName.trim() && !(changes.businessName || before.data.businessName)?.trim()) return invalid('Display name or business name is required.');
  if ((changes.creditLimit ?? 0) < 0 || (changes.paymentTermsDays ?? 0) < 0) return invalid('Credit limit and payment terms cannot be negative.');
  const normalized: Partial<SharedCustomerRecord> = { ...changes };
  if (changes.phone !== undefined) normalized.phone = normalizeCustomerPhone(changes.phone);
  if (changes.email !== undefined) normalized.email = normalizeCustomerEmail(changes.email);
  if (changes.whatsappNumber !== undefined) normalized.whatsappNumber = normalizeCustomerPhone(changes.whatsappNumber);
  if (changes.nationalId !== undefined) normalized.nationalId = clean(changes.nationalId);
  if (changes.taxNumber !== undefined) normalized.taxNumber = clean(changes.taxNumber);
  const possibleDuplicates = await duplicates(context, normalized, customerId); if (possibleDuplicates.length) { await publish(context, 'CUSTOMER_DUPLICATE_DETECTED', 'customer', customerId, { matchingCustomerIds: possibleDuplicates.map((row) => row.customerId) }); return { success: false, errorCode: 'POSSIBLE_DUPLICATE', errorMessage: 'The update matches another customer identity.', possibleDuplicates }; }
  const result = await repositories().customers.updateCustomer(context, customerId, normalized); if (result.success) { await audit(context, changes.status === 'ACTIVE' && before.data.status !== 'ACTIVE' ? 'REACTIVATE_CUSTOMER' : 'UPDATE_CUSTOMER', 'customer', customerId, before.data, result.data); await publish(context, changes.status === 'ACTIVE' && before.data.status !== 'ACTIVE' ? 'CUSTOMER_REACTIVATED' : 'CUSTOMER_UPDATED', 'customer', customerId, { changedFields: Object.keys(changes) }); } return result;
}

export async function deactivateCustomerCommand(context: RepositoryOperationContext, customerId: string): Promise<CustomerMasterResult<SharedCustomerRecord>> { const before = await repositories().customers.getCustomer(context, customerId); if (!before.success || !before.data) return before; const result = await repositories().customers.deactivateCustomer(context, customerId); if (result.success) { await audit(context, 'DEACTIVATE_CUSTOMER', 'customer', customerId, before.data, result.data); await publish(context, 'CUSTOMER_DEACTIVATED', 'customer', customerId, {}); } return result; }

export async function createCustomerAddressCommand(context: RepositoryOperationContext, input: Partial<SharedCustomerAddressRecord>): Promise<CustomerMasterResult<SharedCustomerAddressRecord>> { if (!input.customerId?.trim() || !input.addressLine1?.trim()) return invalid('Customer and address line 1 are required.'); const addressId = clean(input.addressId) || createFirestoreId('addr'); const record: SharedCustomerAddressRecord = { addressId, vendorId: context.vendorId, customerId: input.customerId, label: clean(input.label), addressLine1: input.addressLine1.trim(), addressLine2: clean(input.addressLine2), suburb: clean(input.suburb), city: clean(input.city), province: clean(input.province), country: clean(input.country) || 'Zimbabwe', postalCode: clean(input.postalCode), latitude: input.latitude, longitude: input.longitude, isDefaultBilling: input.isDefaultBilling, isDefaultDelivery: input.isDefaultDelivery, status: input.status || 'ACTIVE', createdAt: '', updatedAt: '', createdBy: context.actorId, updatedBy: context.actorId }; const result = await repositories().customers.createAddress(context, record); if (result.success) { await audit(context, 'CREATE_CUSTOMER_ADDRESS', 'customerAddress', addressId, null, result.data); await publish(context, 'CUSTOMER_ADDRESS_CREATED', 'customerAddress', addressId, { customerId: record.customerId }); } return result; }
export async function updateCustomerAddressCommand(context: RepositoryOperationContext, addressId: string, changes: Partial<SharedCustomerAddressRecord>): Promise<CustomerMasterResult<SharedCustomerAddressRecord>> { const result = await repositories().customers.updateAddress(context, addressId, changes); if (result.success) { await audit(context, 'UPDATE_CUSTOMER_ADDRESS', 'customerAddress', addressId, null, result.data); await publish(context, 'CUSTOMER_ADDRESS_UPDATED', 'customerAddress', addressId, { customerId: result.data?.customerId }); } return result; }

export async function appendCustomerInteractionCommand(context: RepositoryOperationContext, input: Partial<SharedCustomerInteractionRecord>): Promise<CustomerMasterResult<SharedCustomerInteractionRecord>> { if (!input.customerId?.trim() || !input.interactionType?.trim() || !input.channel?.trim()) return invalid('Customer, interaction type and channel are required.'); const interactionId = clean(input.interactionId) || createFirestoreId('interaction'); const record: SharedCustomerInteractionRecord = { interactionId, vendorId: context.vendorId, customerId: input.customerId, interactionType: input.interactionType, channel: input.channel, subject: clean(input.subject), notes: clean(input.notes), relatedEntityType: clean(input.relatedEntityType), relatedEntityId: clean(input.relatedEntityId), staffId: context.staffId, actorId: context.actorId, sourceApp: context.sourceApp, createdAt: '', schemaVersion: COMMERCE_SCHEMA_VERSION }; const result = await repositories().customers.appendInteraction(context, record); if (result.success) { await audit(context, 'RECORD_CUSTOMER_INTERACTION', 'customerInteraction', interactionId, null, result.data); await publish(context, 'CUSTOMER_INTERACTION_RECORDED', 'customerInteraction', interactionId, { customerId: record.customerId, interactionType: record.interactionType }); } return result; }

export async function createCustomerRequestCommand(context: RepositoryOperationContext, input: Partial<SharedCustomerRequestRecord>): Promise<CustomerMasterResult<SharedCustomerRequestRecord>> { if (!input.requestType?.trim() || !input.title?.trim()) return invalid('Request type and title are required.'); if (input.relatedProductId) { const product = await repositories().products.getProduct(context, input.relatedProductId); if (!product.success) return invalid('Related product is not available in this vendor.'); } const requestId = clean(input.requestId) || createFirestoreId('customer-request'); const record: SharedCustomerRequestRecord = { requestId, vendorId: context.vendorId, customerId: clean(input.customerId), requestType: input.requestType, title: input.title, description: clean(input.description), status: input.status || 'OPEN', priority: clean(input.priority), relatedProductId: clean(input.relatedProductId), relatedSaleId: clean(input.relatedSaleId), relatedDeliveryId: clean(input.relatedDeliveryId), assignedStaffId: clean(input.assignedStaffId), createdAt: '', updatedAt: '', createdBy: context.actorId, updatedBy: context.actorId }; const result = await repositories().customers.createCustomerRequest(context, record); if (result.success) { await audit(context, 'CREATE_CUSTOMER_REQUEST', 'customerRequest', requestId, null, result.data); await publish(context, 'CUSTOMER_REQUEST_CREATED', 'customerRequest', requestId, { customerId: record.customerId, requestType: record.requestType }); } return result; }
export async function updateCustomerRequestCommand(context: RepositoryOperationContext, requestId: string, changes: Partial<SharedCustomerRequestRecord>): Promise<CustomerMasterResult<SharedCustomerRequestRecord>> { const beforeList = await repositories().customers.listCustomerRequests(context); const before = beforeList.records.find((row) => row.requestId === requestId); if (changes.vendorId && changes.vendorId !== context.vendorId) return invalid('Cross-vendor request update is rejected.'); if (changes.customerId && changes.customerId !== before?.customerId) return invalid('A customer request cannot be reassigned to another customer.'); if (changes.relatedProductId) { const product = await repositories().products.getProduct(context, changes.relatedProductId); if (!product.success) return invalid('Related product is not available in this vendor.'); } const result = await repositories().customers.updateCustomerRequest(context, requestId, changes); if (result.success) { await audit(context, 'UPDATE_CUSTOMER_REQUEST', 'customerRequest', requestId, before || null, result.data); await publish(context, 'CUSTOMER_REQUEST_UPDATED', 'customerRequest', requestId, { customerId: result.data?.customerId, changedFields: Object.keys(changes) }); } return result; }

export async function resolveCustomerByPhone(context: RepositoryOperationContext, phone: string): Promise<CustomerMasterResult<SharedCustomerRecord>> { const normalized = normalizeCustomerPhone(phone); return normalized ? repositories().customers.getCustomerByPhone(context, normalized) : invalid('A valid phone number is required.'); }
export async function resolveCustomerByEmail(context: RepositoryOperationContext, email: string): Promise<CustomerMasterResult<SharedCustomerRecord>> { const normalized = normalizeCustomerEmail(email); return normalized ? repositories().customers.getCustomerByEmail(context, normalized) : invalid('A valid email is required.'); }
export const listCustomerAddresses = (context: RepositoryOperationContext, customerId: string) => repositories().customers.listAddresses(context, customerId);
export const listCustomerInteractions = (context: RepositoryOperationContext, customerId: string) => repositories().customers.listInteractions(context, customerId);
export const publishCustomerMigrationCompleted = (context: RepositoryOperationContext, metadata: Record<string, unknown>) => publish(context, 'CUSTOMER_MIGRATION_COMPLETED', 'customerMigration', context.vendorId, metadata);
export const auditLegacyCustomerMigration = (context: RepositoryOperationContext, customerId: string, after: unknown) => audit(context, 'MIGRATE_LEGACY_CUSTOMER', 'customer', customerId, null, after);
