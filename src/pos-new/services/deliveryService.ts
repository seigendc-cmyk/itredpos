import {
  DeliveryActivityEvent,
  DeliveryAssignment,
  DeliveryBroadcastPayload,
  DeliveryCashCollection,
  DeliveryConfirmationCode,
  DeliveryConfirmationStatus,
  DeliveryEvent,
  DeliveryFailureReason,
  DeliveryFilterState,
  DeliveryMethod,
  DeliveryOrder,
  DeliveryPaymentMode,
  DeliveryPerson,
  DeliveryProvider,
  DeliveryProviderType,
  DeliveryRequest,
  DeliveryRequestLine,
  DeliveryStatus,
  DeliverySummary,
  DeliveryTrackingEvent,
  DeliveryTrackingStatus,
  DeliveryWhatsAppMessageDraft,
  VehicleType,
  WalkInCollection
} from '../types';
import {
  mockDeliveryActivityEvents,
  mockDeliveryAssignments,
  mockDeliveryCashCollections,
  mockDeliveryConfirmationCodes,
  mockDeliveryEvents,
  mockDeliveryOrders,
  mockDeliveryPersons,
  mockDeliveryProviders,
  mockDeliveryRequestLines,
  mockDeliveryRequests,
  mockDeliveryTrackingEvents,
  mockDeliveryWhatsAppMessageDrafts,
  mockWalkInCollections
} from '../mock/mockPosData';
import {
  createDeliveryMessageText,
  createDriverMessageText,
  generateDeliveryConfirmationCode,
  verifyDeliveryConfirmationCode
} from '../utils/deliveryCodeUtils';
import { getActiveVendorId, readVendorScopedList, writeVendorScopedList } from '../utils/vendorDataMode';

const REQUEST_KEY = 'sci_pos_delivery_requests_v2';
const LINE_KEY = 'sci_pos_delivery_request_lines_v2';
const PROVIDER_KEY = 'sci_pos_delivery_providers_v2';
const ASSIGNMENT_KEY = 'sci_pos_delivery_assignments_v2';
const TRACKING_KEY = 'sci_pos_delivery_tracking_v2';
const CODE_KEY = 'sci_pos_delivery_codes_v2';
const CASH_KEY = 'sci_pos_delivery_cash_v2';
const ACTIVITY_KEY = 'sci_pos_delivery_activity_v2';
const WHATSAPP_KEY = 'sci_pos_delivery_whatsapp_v2';

const COLLECTION_KEY = 'sci_pos_walk_in_collections';
const ORDER_KEY = 'sci_pos_delivery_orders';
const PERSON_KEY = 'sci_pos_delivery_persons';
const EVENT_KEY = 'sci_pos_delivery_events';

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function readList<T>(key: string, fallback: T[]): T[] {
  return readVendorScopedList<T>(key, fallback);
}

function saveList<T>(key: string, rows: T[]): void {
  writeVendorScopedList(key, rows);
}

function activity(event: Omit<DeliveryActivityEvent, 'id' | 'createdAt'>): DeliveryActivityEvent[] {
  const rows = readList<DeliveryActivityEvent>(ACTIVITY_KEY, mockDeliveryActivityEvents);
  const next: DeliveryActivityEvent = { id: makeId('DACT'), createdAt: nowIso(), ...event };
  const updated = [next, ...rows].slice(0, 250);
  saveList(ACTIVITY_KEY, updated);
  return updated;
}

function updateDelivery(deliveryId: string, patch: Partial<DeliveryRequest>): DeliveryRequest | null {
  const rows = readList<DeliveryRequest>(REQUEST_KEY, mockDeliveryRequests);
  const index = rows.findIndex((row) => row.deliveryId === deliveryId);
  if (index < 0) return null;
  const updated = { ...rows[index], ...patch, updatedAt: nowIso() };
  rows[index] = updated;
  saveList(REQUEST_KEY, rows);
  return updated;
}

function matchesFilter(row: DeliveryRequest, filters: DeliveryFilterState = {}): boolean {
  const haystack = [
    row.deliveryNumber,
    row.receiptNumber,
    row.customerName,
    row.customerPhone,
    row.customerWhatsapp,
    row.providerName,
    row.driverName,
    row.deliveryAddress
  ].join(' ').toLowerCase();
  const requestedDate = row.requestedAt.slice(0, 10);
  return (
    (!filters.deliveryNumber || row.deliveryNumber.toLowerCase().includes(filters.deliveryNumber.toLowerCase())) &&
    (!filters.receiptNumber || row.receiptNumber.toLowerCase().includes(filters.receiptNumber.toLowerCase())) &&
    (!filters.customer || haystack.includes(filters.customer.toLowerCase())) &&
    (!filters.phone || haystack.includes(filters.phone.toLowerCase())) &&
    (!filters.provider || (row.providerName || '').toLowerCase().includes(filters.provider.toLowerCase())) &&
    (!filters.driver || (row.driverName || '').toLowerCase().includes(filters.driver.toLowerCase())) &&
    (!filters.deliveryMethod || filters.deliveryMethod === 'ALL' || row.deliveryMethod === filters.deliveryMethod) &&
    (!filters.deliveryStatus || filters.deliveryStatus === 'ALL' || row.deliveryStatus === filters.deliveryStatus) &&
    (!filters.cashStatus || filters.cashStatus === 'ALL' || row.cashStatus === filters.cashStatus) &&
    (!filters.confirmationStatus || filters.confirmationStatus === 'ALL' || row.confirmationStatus === filters.confirmationStatus) &&
    (!filters.priority || filters.priority === 'ALL' || row.priority === filters.priority) &&
    (!filters.dateFrom || requestedDate >= filters.dateFrom) &&
    (!filters.dateTo || requestedDate <= filters.dateTo)
  );
}

function deliveryNumberFor(count: number): string {
  return `DEL-${String(count + 1).padStart(4, '0')}`;
}

export async function getDeliveryRequests(filters: DeliveryFilterState = {}): Promise<DeliveryRequest[]> {
  return readList<DeliveryRequest>(REQUEST_KEY, mockDeliveryRequests).filter((row) => matchesFilter(row, filters));
}

export async function getDeliveryRequestById(deliveryId: string): Promise<DeliveryRequest | undefined> {
  return readList<DeliveryRequest>(REQUEST_KEY, mockDeliveryRequests).find((row) => row.deliveryId === deliveryId);
}

export async function getDeliveryRequestLines(deliveryId: string): Promise<DeliveryRequestLine[]> {
  return readList<DeliveryRequestLine>(LINE_KEY, mockDeliveryRequestLines).filter((line) => line.deliveryId === deliveryId);
}

export async function getDeliverySummary(filters: DeliveryFilterState = {}): Promise<DeliverySummary> {
  const rows = await getDeliveryRequests(filters);
  const today = nowIso().slice(0, 10);
  return {
    pendingAssignment: rows.filter((row) => row.deliveryStatus === 'Pending Assignment').length,
    broadcastToIDeliver: rows.filter((row) => row.deliveryStatus === 'Broadcast To iDeliver').length,
    assigned: rows.filter((row) => row.deliveryStatus === 'Assigned').length,
    inTransit: rows.filter((row) => row.deliveryStatus === 'In Transit' || row.deliveryStatus === 'Picked Up').length,
    deliveredToday: rows.filter((row) => row.deliveryStatus === 'Delivered' && (row.deliveredAt || row.updatedAt).startsWith(today)).length,
    failedDeliveries: rows.filter((row) => row.deliveryStatus === 'Delivery Failed').length,
    cashPendingReview: rows.filter((row) => row.cashStatus === 'Collected By Driver' || row.deliveryStatus === 'Cash Pending Review').length,
    codeVerificationPending: rows.filter((row) => row.confirmationStatus === 'Code Pending' || row.confirmationStatus === 'Code Sent').length,
    returnedToVendor: rows.filter((row) => row.deliveryStatus === 'Returned To Vendor').length,
    urgentDeliveries: rows.filter((row) => row.priority === 'Urgent').length
  };
}

export async function createDeliveryRequestFromReceipt(payload: {
  vendorId: string;
  receiptId: string;
  receiptNumber: string;
  branchId: string;
  branchName: string;
  terminalId: string;
  cashierStaffId: string;
  cashierStaffName: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  customerWhatsapp: string;
  deliveryMethod: DeliveryMethod;
  priority: DeliveryRequest['priority'];
  deliveryAddress: string;
  deliverySuburb?: string;
  deliveryCityTown?: string;
  deliveryNotes: string;
  deliveryFee: number;
  paymentMode: DeliveryPaymentMode;
  totalReceiptAmount: number;
  cashToCollect: number;
  lines: Array<{ productId: string; sku: string; productName: string; qty: number; receiptLineId?: string }>;
}): Promise<DeliveryRequest | null> {
  if (payload.deliveryMethod === 'No Delivery') return null;
  const rows = readList<DeliveryRequest>(REQUEST_KEY, mockDeliveryRequests);
  const existing = rows.find((row) => row.receiptNumber === payload.receiptNumber && row.deliveryMethod === payload.deliveryMethod);
  if (existing) return existing;
  const code = generateDeliveryConfirmationCode();
  const deliveryId = makeId('DEL-ID');
  const deliveryStatus: DeliveryStatus = payload.deliveryMethod === 'Customer Collection'
    ? 'Waiting Collection'
    : payload.deliveryMethod === 'iDeliver Service'
      ? 'Broadcast To iDeliver'
      : 'Pending Assignment';
  const cashStatus = payload.cashToCollect > 0 ? 'Pending Collection' : 'Not Required';
  const record: DeliveryRequest = {
    deliveryId,
    deliveryNumber: deliveryNumberFor(rows.length),
    vendorId: payload.vendorId,
    receiptId: payload.receiptId,
    receiptNumber: payload.receiptNumber,
    branchId: payload.branchId,
    branchName: payload.branchName,
    terminalId: payload.terminalId,
    cashierStaffId: payload.cashierStaffId,
    cashierStaffName: payload.cashierStaffName,
    customerId: payload.customerId,
    customerName: payload.customerName,
    customerPhone: payload.customerPhone,
    customerWhatsapp: payload.customerWhatsapp,
    deliveryMethod: payload.deliveryMethod,
    deliveryStatus,
    priority: payload.priority,
    deliveryAddress: payload.deliveryAddress,
    deliverySuburb: payload.deliverySuburb,
    deliveryCityTown: payload.deliveryCityTown,
    deliveryNotes: payload.deliveryNotes,
    deliveryFee: payload.deliveryFee,
    paymentMode: payload.paymentMode,
    cashStatus,
    totalReceiptAmount: payload.totalReceiptAmount,
    cashToCollect: payload.cashToCollect,
    confirmationCode: code,
    confirmationStatus: 'Code Sent',
    trackingStatus: payload.deliveryMethod === 'iDeliver Service' ? 'Tracking Unavailable' : 'Not Started',
    requestedAt: nowIso(),
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  saveList(REQUEST_KEY, [record, ...rows]);

  const currentLines = readList<DeliveryRequestLine>(LINE_KEY, mockDeliveryRequestLines);
  const nextLines = payload.lines.map((line, index): DeliveryRequestLine => ({
    lineId: makeId(`DLL-${index + 1}`),
    deliveryId,
    productId: line.productId,
    sku: line.sku,
    productName: line.productName,
    qty: line.qty,
    receiptLineId: line.receiptLineId,
    lineStatus: payload.deliveryMethod === 'iDeliver Service' ? 'Ready For iDeliver' : 'Ready For Delivery',
    notes: 'Created from completed POS sale. Stock already moved during sale completion.'
  }));
  saveList(LINE_KEY, [...nextLines, ...currentLines]);
  await createWhatsAppMessageDraft(deliveryId, 'Customer Code');
  activity({ deliveryId, deliveryNumber: record.deliveryNumber, receiptNumber: record.receiptNumber, eventType: 'DELIVERY_REQUEST_CREATED', message: 'Delivery request created from completed receipt.', staffId: payload.cashierStaffId });
  if (payload.deliveryMethod === 'iDeliver Service') {
    activity({ deliveryId, deliveryNumber: record.deliveryNumber, receiptNumber: record.receiptNumber, eventType: 'DELIVERY_BROADCAST_TO_IDELIVER', message: 'iDeliver broadcast placeholder prepared from POS sale.', staffId: payload.cashierStaffId });
  }
  return record;
}

export async function createDeliveryDraftFromCart(payload: Partial<DeliveryRequest>): Promise<DeliveryRequest> {
  const rows = readList<DeliveryRequest>(REQUEST_KEY, mockDeliveryRequests);
  const draft: DeliveryRequest = {
    deliveryId: makeId('DEL-DRAFT'),
    deliveryNumber: deliveryNumberFor(rows.length),
    vendorId: payload.vendorId || getActiveVendorId(),
    receiptId: payload.receiptId || 'DRAFT',
    receiptNumber: payload.receiptNumber || 'DRAFT',
    branchId: payload.branchId || 'main-branch',
    branchName: payload.branchName || 'Main Branch',
    terminalId: payload.terminalId || 'POS-01',
    cashierStaffId: payload.cashierStaffId || 'DRAFT',
    cashierStaffName: payload.cashierStaffName || 'Draft User',
    customerName: payload.customerName || 'Draft Customer',
    customerPhone: payload.customerPhone || '',
    customerWhatsapp: payload.customerWhatsapp || '',
    deliveryMethod: payload.deliveryMethod || 'Vendor Delivery',
    deliveryStatus: 'Draft',
    priority: payload.priority || 'Normal',
    deliveryAddress: payload.deliveryAddress || '',
    deliveryNotes: payload.deliveryNotes || '',
    deliveryFee: payload.deliveryFee || 0,
    paymentMode: payload.paymentMode || 'No Payment Due',
    cashStatus: 'Not Required',
    totalReceiptAmount: payload.totalReceiptAmount || 0,
    cashToCollect: payload.cashToCollect || 0,
    confirmationCode: payload.confirmationCode || generateDeliveryConfirmationCode(),
    confirmationStatus: 'Code Pending',
    trackingStatus: 'Not Started',
    requestedAt: nowIso(),
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  saveList(REQUEST_KEY, [draft, ...rows]);
  activity({ deliveryId: draft.deliveryId, deliveryNumber: draft.deliveryNumber, receiptNumber: draft.receiptNumber, eventType: 'DELIVERY_DRAFT_CREATED', message: 'Draft delivery details captured. No delivery request is active until sale completion.', staffId: draft.cashierStaffId });
  return draft;
}

export async function updateDeliveryDraft(deliveryId: string, patch: Partial<DeliveryRequest>): Promise<DeliveryRequest | null> {
  return updateDelivery(deliveryId, patch);
}

export async function broadcastToIDeliver(deliveryId: string, staffId: string): Promise<{ request: DeliveryRequest | null; payload?: DeliveryBroadcastPayload; message: string }> {
  const request = updateDelivery(deliveryId, { deliveryStatus: 'Broadcast To iDeliver', trackingStatus: 'Tracking Unavailable' });
  if (!request) return { request: null, message: 'Delivery request not found.' };
  const lines = await getDeliveryRequestLines(deliveryId);
  const payload: DeliveryBroadcastPayload = {
    deliveryNumber: request.deliveryNumber,
    receiptNumber: request.receiptNumber,
    vendorId: request.vendorId,
    branchId: request.branchId,
    customerName: request.customerName,
    customerPhone: request.customerPhone,
    deliveryAddress: request.deliveryAddress,
    deliveryFee: request.deliveryFee,
    cashToCollect: request.cashToCollect,
    priority: request.priority,
    itemCount: lines.reduce((sum, line) => sum + line.qty, 0),
    notes: request.deliveryNotes
  };
  activity({ deliveryId, deliveryNumber: request.deliveryNumber, receiptNumber: request.receiptNumber, eventType: 'DELIVERY_BROADCAST_TO_IDELIVER', message: 'iDeliver broadcast placeholder prepared. No real network request was made.', staffId, notes: JSON.stringify(payload) });
  return { request, payload, message: 'iDeliver broadcast placeholder prepared.' };
}

export async function getDeliveryProviders(filters: { providerType?: 'ALL' | DeliveryProviderType; active?: 'ALL' | 'Active' | 'Inactive' } = {}): Promise<DeliveryProvider[]> {
  return readList<DeliveryProvider>(PROVIDER_KEY, mockDeliveryProviders).filter((provider) => (
    (!filters.providerType || filters.providerType === 'ALL' || provider.providerType === filters.providerType) &&
    (!filters.active || filters.active === 'ALL' || (filters.active === 'Active' ? provider.active : !provider.active))
  ));
}

export async function selectDeliveryProvider(deliveryId: string, providerId: string, staffId: string): Promise<DeliveryRequest | null> {
  const provider = readList<DeliveryProvider>(PROVIDER_KEY, mockDeliveryProviders).find((row) => row.providerId === providerId);
  if (!provider) return null;
  const updated = updateDelivery(deliveryId, { providerId, providerName: provider.providerName, deliveryStatus: 'Provider Selected' });
  if (updated) activity({ deliveryId, deliveryNumber: updated.deliveryNumber, receiptNumber: updated.receiptNumber, eventType: 'DELIVERY_PROVIDER_SELECTED', message: `${provider.providerName} selected.`, staffId });
  return updated;
}

export async function assignVendorDriver(deliveryId: string, driverStaffId: string, staffId: string): Promise<DeliveryRequest | null> {
  const provider = readList<DeliveryProvider>(PROVIDER_KEY, mockDeliveryProviders).find((row) => row.providerId === driverStaffId) || mockDeliveryProviders[0];
  const updated = updateDelivery(deliveryId, { providerId: provider.providerId, providerName: provider.providerName, driverStaffId, driverName: provider.providerName, driverPhone: provider.phone, deliveryStatus: 'Assigned', assignedAt: nowIso() });
  if (!updated) return null;
  const assignments = readList<DeliveryAssignment>(ASSIGNMENT_KEY, mockDeliveryAssignments);
  saveList(ASSIGNMENT_KEY, [{ assignmentId: makeId('DASS'), deliveryId, providerId: provider.providerId, providerName: provider.providerName, driverStaffId, driverName: provider.providerName, driverPhone: provider.phone, vehiclePlaceholder: provider.vehiclePlaceholder, assignedAt: nowIso(), assignedByStaffId: staffId }, ...assignments]);
  activity({ deliveryId, deliveryNumber: updated.deliveryNumber, receiptNumber: updated.receiptNumber, eventType: 'DELIVERY_DRIVER_ASSIGNED', message: `${provider.providerName} assigned to delivery.`, staffId });
  return updated;
}

export async function acceptDelivery(deliveryId: string, driverStaffId: string): Promise<DeliveryRequest | null> {
  const updated = updateDelivery(deliveryId, { deliveryStatus: 'Accepted By Driver', acceptedAt: nowIso(), driverStaffId });
  if (updated) activity({ deliveryId, deliveryNumber: updated.deliveryNumber, receiptNumber: updated.receiptNumber, eventType: 'DELIVERY_ACCEPTED_BY_DRIVER', message: 'Delivery accepted by driver placeholder.', staffId: driverStaffId });
  return updated;
}

export async function markPickedUp(deliveryId: string, staffId: string): Promise<DeliveryRequest | null> {
  const updated = updateDelivery(deliveryId, { deliveryStatus: 'Picked Up', trackingStatus: 'En Route', pickedUpAt: nowIso() });
  if (updated) {
    await addTrackingEvent(deliveryId, { status: 'En Route', locationText: 'Picked up from branch', notes: 'Google Maps live tracking integration will be connected later.', updatedByStaffId: staffId });
    activity({ deliveryId, deliveryNumber: updated.deliveryNumber, receiptNumber: updated.receiptNumber, eventType: 'DELIVERY_PICKED_UP', message: 'Delivery marked picked up. Stock already moved at sale completion.', staffId });
  }
  return updated;
}

export async function addTrackingEvent(deliveryId: string, payload: { status: DeliveryTrackingStatus; locationText: string; latitudePlaceholder?: string; longitudePlaceholder?: string; notes: string; updatedByStaffId: string }): Promise<DeliveryTrackingEvent[]> {
  const rows = readList<DeliveryTrackingEvent>(TRACKING_KEY, mockDeliveryTrackingEvents);
  const event: DeliveryTrackingEvent = { trackingEventId: makeId('DTRK'), deliveryId, dateTime: nowIso(), ...payload };
  saveList(TRACKING_KEY, [event, ...rows]);
  const statusPatch: Partial<DeliveryRequest> = { trackingStatus: payload.status };
  if (payload.status === 'En Route') statusPatch.deliveryStatus = 'In Transit';
  if (payload.status === 'Arrived') statusPatch.deliveryStatus = 'Arrived';
  updateDelivery(deliveryId, statusPatch);
  activity({ deliveryId, eventType: payload.status === 'En Route' ? 'DELIVERY_IN_TRANSIT' : 'DELIVERY_TRACKING_UPDATED', message: payload.locationText, staffId: payload.updatedByStaffId, notes: payload.notes });
  return [event, ...rows];
}

export async function markArrived(deliveryId: string, staffId: string): Promise<DeliveryRequest | null> {
  const updated = updateDelivery(deliveryId, { deliveryStatus: 'Arrived', trackingStatus: 'Arrived' });
  if (updated) activity({ deliveryId, deliveryNumber: updated.deliveryNumber, receiptNumber: updated.receiptNumber, eventType: 'DELIVERY_ARRIVED', message: 'Driver arrived placeholder recorded.', staffId });
  return updated;
}

export async function verifyDeliveryCode(deliveryId: string | { deliveryId: string; code: string; recipientName?: string; deliveryNote?: string; operator?: string }, code?: string, staffId?: string): Promise<{ success: boolean; message: string; request?: DeliveryRequest | null }> {
  const normalized = typeof deliveryId === 'string'
    ? { deliveryId, code: code || '', staffId: staffId || 'SYSTEM' }
    : { deliveryId: deliveryId.deliveryId, code: deliveryId.code, staffId: deliveryId.operator || 'SYSTEM' };
  const request = await getDeliveryRequestById(normalized.deliveryId);
  if (!request) return { success: false, message: 'Delivery request not found.' };
  const ok = verifyDeliveryConfirmationCode(request.confirmationCode, normalized.code);
  const attempts = (request.verificationAttempts || 0) + (ok ? 0 : 1);
  const confirmationStatus: DeliveryConfirmationStatus = ok ? 'Code Verified' : attempts >= 3 ? 'Manual Override Required' : 'Code Failed';
  const updated = updateDelivery(normalized.deliveryId, { confirmationStatus, verificationAttempts: attempts, verifiedAt: ok ? nowIso() : request.verifiedAt, verifiedByStaffId: ok ? normalized.staffId : request.verifiedByStaffId });
  const codes = readList<DeliveryConfirmationCode>(CODE_KEY, mockDeliveryConfirmationCodes);
  saveList(CODE_KEY, codes.map((row) => row.deliveryId === normalized.deliveryId ? { ...row, status: confirmationStatus, attempts, verifiedAt: ok ? nowIso() : row.verifiedAt, verifiedByStaffId: ok ? normalized.staffId : row.verifiedByStaffId } : row));
  activity({ deliveryId: normalized.deliveryId, deliveryNumber: request.deliveryNumber, receiptNumber: request.receiptNumber, eventType: ok ? 'DELIVERY_CODE_VERIFIED' : 'DELIVERY_CODE_FAILED', message: ok ? 'Delivery code verified.' : 'Delivery code verification failed.', staffId: normalized.staffId });
  return { success: ok, message: ok ? 'Delivery code verified.' : 'Incorrect code. Delivery cannot be completed.', request: updated };
}

export async function markDelivered(deliveryId: string, staffId: string, payload: { overrideCode?: boolean; notes?: string } = {}): Promise<{ success: boolean; message: string; request?: DeliveryRequest | null }> {
  const request = await getDeliveryRequestById(deliveryId);
  if (!request) return { success: false, message: 'Delivery request not found.' };
  if (request.confirmationStatus !== 'Code Verified' && !payload.overrideCode) {
    return { success: false, message: 'Delivery cannot be marked delivered until the customer confirmation code is verified.' };
  }
  const nextStatus: DeliveryStatus = request.cashToCollect > 0 && request.cashStatus !== 'Confirmed By Vendor' ? 'Cash Pending Review' : 'Delivered';
  const updated = updateDelivery(deliveryId, { deliveryStatus: nextStatus, trackingStatus: 'Completed', deliveredAt: nowIso() });
  activity({ deliveryId, deliveryNumber: request.deliveryNumber, receiptNumber: request.receiptNumber, eventType: 'DELIVERY_COMPLETED', message: 'Delivery completed. No stock or cashbook posting created.', staffId, notes: payload.notes });
  return { success: true, message: 'Delivery completed locally.', request: updated };
}

export async function recordDeliveryFailure(deliveryId: string, staffId: string, reason: string): Promise<DeliveryRequest | null> {
  if (!reason.trim()) return null;
  const updated = updateDelivery(deliveryId, { deliveryStatus: 'Delivery Failed', failureReason: reason });
  if (updated) activity({ deliveryId, deliveryNumber: updated.deliveryNumber, receiptNumber: updated.receiptNumber, eventType: 'DELIVERY_FAILED', message: `Delivery failed: ${reason}`, staffId });
  return updated;
}

export async function cancelDelivery(deliveryId: string, staffId: string, reason: string): Promise<DeliveryRequest | null> {
  if (!reason.trim()) return null;
  const updated = updateDelivery(deliveryId, { deliveryStatus: 'Cancelled', cancelledAt: nowIso(), failureReason: reason });
  if (updated) activity({ deliveryId, deliveryNumber: updated.deliveryNumber, receiptNumber: updated.receiptNumber, eventType: 'DELIVERY_CANCELLED', message: `Delivery cancelled: ${reason}`, staffId });
  return updated;
}

export async function markReturnedToVendor(deliveryId: string, staffId: string, reason: string): Promise<DeliveryRequest | null> {
  const updated = updateDelivery(deliveryId, { deliveryStatus: 'Returned To Vendor', failureReason: reason });
  if (updated) activity({ deliveryId, deliveryNumber: updated.deliveryNumber, receiptNumber: updated.receiptNumber, eventType: 'DELIVERY_RETURNED_TO_VENDOR', message: `Returned to vendor: ${reason}`, staffId });
  return updated;
}

export async function recordCashCollectedByDriver(deliveryId: string, staffId: string, amount: number, notes: string): Promise<DeliveryCashCollection | null> {
  const request = await getDeliveryRequestById(deliveryId);
  if (!request) return null;
  const rows = readList<DeliveryCashCollection>(CASH_KEY, mockDeliveryCashCollections);
  const existing = rows.find((row) => row.deliveryId === deliveryId);
  const cash: DeliveryCashCollection = {
    cashCollectionId: existing?.cashCollectionId || makeId('DCASH'),
    deliveryId,
    paymentMode: request.paymentMode,
    cashToCollect: request.cashToCollect,
    deliveryFeeCash: request.paymentMode === 'Delivery Fee Cash' ? request.deliveryFee : 0,
    amountCollectedByDriver: amount,
    driverCollectionNotes: notes,
    vendorCashConfirmed: existing?.vendorCashConfirmed || false,
    vendorConfirmedAmount: existing?.vendorConfirmedAmount || 0,
    cashVariance: amount - request.cashToCollect,
    cashStatus: 'Collected By Driver',
    updatedAt: nowIso()
  };
  saveList(CASH_KEY, [cash, ...rows.filter((row) => row.deliveryId !== deliveryId)]);
  updateDelivery(deliveryId, { cashStatus: 'Collected By Driver', deliveryStatus: 'Cash Pending Review' });
  activity({ deliveryId, deliveryNumber: request.deliveryNumber, receiptNumber: request.receiptNumber, eventType: 'DELIVERY_CASH_COLLECTED_BY_DRIVER', message: `Driver cash collection recorded for USD ${amount.toFixed(2)}. No cashbook posting created.`, staffId, notes });
  return cash;
}

export async function confirmDeliveryCashReceived(deliveryId: string, staffId: string, amount: number, notes: string): Promise<DeliveryCashCollection | null> {
  const request = await getDeliveryRequestById(deliveryId);
  if (!request) return null;
  const rows = readList<DeliveryCashCollection>(CASH_KEY, mockDeliveryCashCollections);
  const existing = rows.find((row) => row.deliveryId === deliveryId);
  const variance = amount - request.cashToCollect;
  const status = variance === 0 ? 'Confirmed By Vendor' : 'Variance Review';
  const cash: DeliveryCashCollection = {
    cashCollectionId: existing?.cashCollectionId || makeId('DCASH'),
    deliveryId,
    paymentMode: request.paymentMode,
    cashToCollect: request.cashToCollect,
    deliveryFeeCash: request.paymentMode === 'Delivery Fee Cash' ? request.deliveryFee : 0,
    amountCollectedByDriver: existing?.amountCollectedByDriver || amount,
    driverCollectionNotes: existing?.driverCollectionNotes || '',
    vendorCashConfirmed: variance === 0,
    vendorConfirmedAmount: amount,
    cashVariance: variance,
    cashStatus: status,
    updatedAt: nowIso()
  };
  saveList(CASH_KEY, [cash, ...rows.filter((row) => row.deliveryId !== deliveryId)]);
  updateDelivery(deliveryId, { cashStatus: status, deliveryStatus: variance === 0 ? 'Delivered' : 'Cash Pending Review' });
  activity({ deliveryId, deliveryNumber: request.deliveryNumber, receiptNumber: request.receiptNumber, eventType: variance === 0 ? 'DELIVERY_CASH_CONFIRMED_BY_VENDOR' : 'DELIVERY_CASH_VARIANCE_FOUND', message: `Vendor cash confirmation recorded for USD ${amount.toFixed(2)}. EOD review remains responsible for reconciliation.`, staffId, notes });
  return cash;
}

export async function createWhatsAppMessageDraft(deliveryId: string, messageType: DeliveryWhatsAppMessageDraft['messageType']): Promise<DeliveryWhatsAppMessageDraft | null> {
  const request = await getDeliveryRequestById(deliveryId);
  if (!request) return null;
  const recipient = messageType === 'Driver Assignment' ? request.driverPhone || '' : request.customerWhatsapp;
  const messageText = messageType === 'Customer Code'
    ? createDeliveryMessageText({ ...request, messageType: 'code' })
    : messageType === 'Customer Status'
      ? createDeliveryMessageText({ ...request, messageType: 'status' })
      : messageType === 'Driver Assignment'
        ? createDriverMessageText(request)
        : `Delivery ${request.deliveryNumber} has cash pending confirmation. Please confirm cash received from the delivery person.`;
  const draft: DeliveryWhatsAppMessageDraft = { draftId: makeId('DWA'), deliveryId, messageType, recipient, messageText, createdAt: nowIso(), status: 'Prepared' };
  saveList(WHATSAPP_KEY, [draft, ...readList<DeliveryWhatsAppMessageDraft>(WHATSAPP_KEY, mockDeliveryWhatsAppMessageDrafts)]);
  activity({ deliveryId, deliveryNumber: request.deliveryNumber, receiptNumber: request.receiptNumber, eventType: 'WHATSAPP_DELIVERY_MESSAGE_PREPARED', message: `${messageType} WhatsApp draft prepared locally.`, staffId: request.cashierStaffId });
  return draft;
}

export async function exportDeliveryPlaceholder(filters: DeliveryFilterState = {}): Promise<{ message: string; filters: DeliveryFilterState }> {
  return { message: 'Delivery export placeholder prepared.', filters };
}

export async function getDeliveryActivityEvents(filters: DeliveryFilterState = {}): Promise<DeliveryActivityEvent[]> {
  const requests = await getDeliveryRequests(filters);
  const allowed = new Set(requests.map((row) => row.deliveryId));
  return readList<DeliveryActivityEvent>(ACTIVITY_KEY, mockDeliveryActivityEvents).filter((event) => !event.deliveryId || allowed.has(event.deliveryId));
}

export async function getDeliveryTrackingEvents(deliveryId: string): Promise<DeliveryTrackingEvent[]> {
  return readList<DeliveryTrackingEvent>(TRACKING_KEY, mockDeliveryTrackingEvents).filter((event) => event.deliveryId === deliveryId);
}

export async function getDeliveryConfirmationCode(deliveryId: string): Promise<DeliveryConfirmationCode | undefined> {
  return readList<DeliveryConfirmationCode>(CODE_KEY, mockDeliveryConfirmationCodes).find((row) => row.deliveryId === deliveryId);
}

export async function getDeliveryCashCollection(deliveryId: string): Promise<DeliveryCashCollection | undefined> {
  return readList<DeliveryCashCollection>(CASH_KEY, mockDeliveryCashCollections).find((row) => row.deliveryId === deliveryId);
}

export async function getDeliveryWhatsAppMessageDrafts(deliveryId: string): Promise<DeliveryWhatsAppMessageDraft[]> {
  return readList<DeliveryWhatsAppMessageDraft>(WHATSAPP_KEY, mockDeliveryWhatsAppMessageDrafts).filter((draft) => draft.deliveryId === deliveryId);
}

// Legacy compatibility for earlier Delivery Desk code.
export async function getDeliveryOrders(): Promise<DeliveryOrder[]> {
  return readList<DeliveryOrder>(ORDER_KEY, mockDeliveryOrders);
}

export async function getDeliveryPersons(): Promise<DeliveryPerson[]> {
  return readList<DeliveryPerson>(PERSON_KEY, mockDeliveryPersons);
}

export async function getWalkInCollections(): Promise<WalkInCollection[]> {
  return readList<WalkInCollection>(COLLECTION_KEY, mockWalkInCollections);
}

export async function getDeliveryEvents(): Promise<DeliveryEvent[]> {
  return readList<DeliveryEvent>(EVENT_KEY, mockDeliveryEvents);
}

export async function assignDelivery(payload: { id: string; receiptNumber: string; customerName: string; customerWhatsApp: string; deliveryAddress: string; district: string; suburb: string; deliveryMethod: DeliveryMethod; deliveryPersonId: string; vehicleType: VehicleType; vehicleRegistration: string; driverPhone: string; deliveryCharge: number; notes?: string; operator: string }): Promise<DeliveryOrder> {
  const orders = await getDeliveryOrders();
  const updated: DeliveryOrder = { id: payload.id || makeId('DEL'), receiptNumber: payload.receiptNumber, customerName: payload.customerName, customerWhatsApp: payload.customerWhatsApp, deliveryAddress: payload.deliveryAddress, district: payload.district, suburb: payload.suburb, deliveryMethod: payload.deliveryMethod, status: 'Assigned', codeStatus: 'Code Pending', deliveryPersonId: payload.deliveryPersonId, vehicleType: payload.vehicleType, vehicleRegistration: payload.vehicleRegistration, driverPhone: payload.driverPhone, deliveryCharge: payload.deliveryCharge, notes: payload.notes };
  saveList(ORDER_KEY, [updated, ...orders.filter((order) => order.id !== updated.id)]);
  return updated;
}

export async function generateDeliveryCode(deliveryId: string, operator: string): Promise<string> {
  const code = generateDeliveryConfirmationCode();
  saveList(ORDER_KEY, (await getDeliveryOrders()).map((order) => order.id === deliveryId ? { ...order, secretCode: code, codeStatus: 'Code Generated' } : order));
  activity({ deliveryId, eventType: 'DELIVERY_CODE_GENERATED', message: 'Legacy delivery code generated.', staffId: operator });
  return code;
}

export async function updateCodeStatus(deliveryId: string, status: 'Code Sent' | 'Code Pending' | 'Code Confirmed', operator: string): Promise<void> {
  saveList(ORDER_KEY, (await getDeliveryOrders()).map((order) => order.id === deliveryId ? { ...order, codeStatus: status } : order));
  activity({ deliveryId, eventType: 'WHATSAPP_DELIVERY_MESSAGE_PREPARED', message: 'Legacy WhatsApp code placeholder updated.', staffId: operator });
}

export async function markDeliveryFailed(payload: { deliveryId: string; failedReason: DeliveryFailureReason; nextAction: string; notes: string; operator: string }): Promise<void> {
  saveList(ORDER_KEY, (await getDeliveryOrders()).map((order) => order.id === payload.deliveryId ? { ...order, status: 'Failed', failedReason: payload.failedReason, nextAction: payload.nextAction, notes: payload.notes } : order));
  activity({ deliveryId: payload.deliveryId, eventType: 'DELIVERY_FAILED', message: `Legacy delivery failed: ${payload.failedReason}`, staffId: payload.operator });
}

export async function generateCollectionCode(receiptNumber: string, operator: string): Promise<string> {
  const code = generateDeliveryConfirmationCode();
  const rows = await getWalkInCollections();
  const current = rows.find((row) => row.receiptNumber === receiptNumber);
  const next: WalkInCollection = current ? { ...current, collectionCode: code, status: 'Pending' } : { receiptNumber, customerName: `Customer ${receiptNumber}`, customerWhatsApp: '', collectionCode: code, status: 'Pending' };
  saveList(COLLECTION_KEY, [next, ...rows.filter((row) => row.receiptNumber !== receiptNumber)]);
  activity({ receiptNumber, eventType: 'DELIVERY_CODE_GENERATED', message: 'Collection code generated.', staffId: operator });
  return code;
}

export async function verifyCollectionCode(payload: { receiptNumber: string; code: string; collectedBy: string; notes: string; operator: string }): Promise<{ success: boolean; message: string }> {
  const rows = await getWalkInCollections();
  const current = rows.find((row) => row.receiptNumber === payload.receiptNumber);
  const ok = Boolean(current && current.collectionCode === payload.code);
  if (ok && current) saveList(COLLECTION_KEY, [{ ...current, status: 'Completed', collectedBy: payload.collectedBy, notes: payload.notes }, ...rows.filter((row) => row.receiptNumber !== payload.receiptNumber)]);
  activity({ receiptNumber: payload.receiptNumber, eventType: ok ? 'DELIVERY_CODE_VERIFIED' : 'DELIVERY_CODE_FAILED', message: ok ? 'Collection code verified.' : 'Collection code failed.', staffId: payload.operator });
  return { success: ok, message: ok ? 'Collection verified and completed successfully!' : 'Incorrect collection code. Walk-in collection denied.' };
}
