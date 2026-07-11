import {
  CanonicalDeliveryStatus,
  DeliveryActivityEvent,
  DeliveryAssignment,
  DeliveryBIWarning,
  DeliveryBroadcastPayload,
  DeliveryCashCollection,
  DeliveryCashHandoverRecord,
  DeliveryConfirmationCode,
  DeliveryConfirmationStatus,
  DeliveryContext,
  DeliveryEvent,
  DeliveryFailureReason,
  DeliveryFailureRecord,
  DeliveryFilterState,
  DeliveryMethod,
  DeliveryOrder,
  DeliveryPaymentMode,
  DeliveryPerson,
  DeliveryProvider,
  DeliveryProviderType,
  DeliveryRequest,
  DeliveryRequestLine,
  DeliveryReturnCondition,
  DeliveryReturnRecord,
  DeliveryStatus,
  DeliverySummary,
  DeliveryTrackingEvent,
  DeliveryTrackingStatus,
  DeliveryWhatsAppMessageDraft,
  PosSession,
  ProofOfDeliveryRecord,
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
import {
  assertCanonicalPurchaseSession,
  getCanonicalPurchaseSession,
  POS_SESSION_INCOMPLETE_MESSAGE,
  type CanonicalPurchaseSession
} from './purchaseSessionService';
import { enqueueOfflineAction, getNetworkStatus } from './offlineSyncService';
import { getOpenCashShiftForSession, recordCashMovement } from './cashMovementService';

export const DELIVERY_COLLECTIONS = {
  deliveries: 'deliveries',
  deliveryLines: 'delivery_lines',
  deliveryAddresses: 'delivery_addresses',
  deliveryAssignments: 'delivery_assignments',
  deliveryTracking: 'delivery_tracking',
  deliveryConfirmations: 'delivery_confirmations',
  proofOfDelivery: 'proof_of_delivery',
  deliveryCashCollections: 'delivery_cash_collections',
  deliveryCashHandovers: 'delivery_cash_handovers',
  deliveryFailures: 'delivery_failures',
  deliveryReturns: 'delivery_returns',
  deliveryPartners: 'delivery_partners',
  deliveryPerformance: 'delivery_performance',
  approvalRequests: 'approval_requests',
  posCashMovements: 'pos_cash_movements',
  auditLogs: 'audit_logs',
  biEvents: 'biEvents'
} as const;

export const DELIVERY_SESSION_INCOMPLETE_MESSAGE = POS_SESSION_INCOMPLETE_MESSAGE;

const REQUEST_KEY = DELIVERY_COLLECTIONS.deliveries;
const LINE_KEY = DELIVERY_COLLECTIONS.deliveryLines;
const PROVIDER_KEY = DELIVERY_COLLECTIONS.deliveryPartners;
const ASSIGNMENT_KEY = DELIVERY_COLLECTIONS.deliveryAssignments;
const TRACKING_KEY = DELIVERY_COLLECTIONS.deliveryTracking;
const CODE_KEY = DELIVERY_COLLECTIONS.deliveryConfirmations;
const CASH_KEY = DELIVERY_COLLECTIONS.deliveryCashCollections;
const ACTIVITY_KEY = 'delivery_activity_events';
const WHATSAPP_KEY = 'delivery_notification_previews';
const PROOF_KEY = DELIVERY_COLLECTIONS.proofOfDelivery;
const HANDOVER_KEY = DELIVERY_COLLECTIONS.deliveryCashHandovers;
const FAILURE_KEY = DELIVERY_COLLECTIONS.deliveryFailures;
const RETURN_KEY = DELIVERY_COLLECTIONS.deliveryReturns;

const COLLECTION_KEY = 'sci_pos_walk_in_collections';
const ORDER_KEY = 'sci_pos_delivery_orders';
const PERSON_KEY = 'sci_pos_delivery_persons';
const EVENT_KEY = 'sci_pos_delivery_events';

const DELIVERY_CODE_TTL_MINUTES = 60 * 24;

const LEGACY_TO_CANONICAL: Partial<Record<DeliveryStatus, CanonicalDeliveryStatus>> = {
  Draft: 'Draft',
  'Pending Assignment': 'AwaitingAssignment',
  AwaitingAssignment: 'AwaitingAssignment',
  'Broadcast To iDeliver': 'AwaitingAssignment',
  'Provider Selected': 'Assigned',
  Assigned: 'Assigned',
  ReadyForDispatch: 'ReadyForDispatch',
  'Accepted By Driver': 'ReadyForDispatch',
  Dispatched: 'Dispatched',
  'Picked Up': 'Dispatched',
  'Out for Delivery': 'InTransit',
  'In Transit': 'InTransit',
  InTransit: 'InTransit',
  Arrived: 'Arrived',
  AwaitingCustomerConfirmation: 'AwaitingCustomerConfirmation',
  PartiallyDelivered: 'PartiallyDelivered',
  Delivered: 'Delivered',
  'Cash Pending Review': 'AwaitingCashHandover',
  AwaitingCashHandover: 'AwaitingCashHandover',
  'Delivery Failed': 'DeliveryFailed',
  DeliveryFailed: 'DeliveryFailed',
  Failed: 'DeliveryFailed',
  Cancelled: 'Cancelled',
  Completed: 'Completed',
  Closed: 'Completed',
  Disputed: 'Disputed'
};

const CANONICAL_TO_LEGACY: Record<CanonicalDeliveryStatus, DeliveryStatus> = {
  Draft: 'Draft',
  AwaitingAssignment: 'Pending Assignment',
  Assigned: 'Assigned',
  ReadyForDispatch: 'Accepted By Driver',
  Dispatched: 'Picked Up',
  InTransit: 'In Transit',
  Arrived: 'Arrived',
  AwaitingCustomerConfirmation: 'Arrived',
  PartiallyDelivered: 'Delivered',
  Delivered: 'Delivered',
  AwaitingCashHandover: 'Cash Pending Review',
  DeliveryFailed: 'Delivery Failed',
  Cancelled: 'Cancelled',
  Completed: 'Completed',
  Disputed: 'Delivery Failed'
};

const VALID_TRANSITIONS: Record<CanonicalDeliveryStatus, CanonicalDeliveryStatus[]> = {
  Draft: ['AwaitingAssignment', 'Cancelled'],
  AwaitingAssignment: ['Assigned', 'DeliveryFailed', 'Cancelled', 'Disputed'],
  Assigned: ['AwaitingAssignment', 'ReadyForDispatch', 'Dispatched', 'DeliveryFailed', 'Cancelled', 'Disputed'],
  ReadyForDispatch: ['Dispatched', 'DeliveryFailed', 'Cancelled', 'Disputed'],
  Dispatched: ['InTransit', 'Arrived', 'Delivered', 'DeliveryFailed', 'Cancelled', 'Disputed'],
  InTransit: ['Arrived', 'Delivered', 'DeliveryFailed', 'Cancelled', 'Disputed'],
  Arrived: ['AwaitingCustomerConfirmation', 'Delivered', 'PartiallyDelivered', 'DeliveryFailed', 'Disputed'],
  AwaitingCustomerConfirmation: ['Delivered', 'PartiallyDelivered', 'DeliveryFailed', 'Disputed'],
  PartiallyDelivered: ['AwaitingCashHandover', 'Delivered', 'Completed', 'Disputed'],
  Delivered: ['AwaitingCashHandover', 'Completed', 'Disputed'],
  AwaitingCashHandover: ['Completed', 'Disputed'],
  DeliveryFailed: ['AwaitingAssignment', 'Cancelled', 'Disputed'],
  Cancelled: [],
  Completed: ['Disputed'],
  Disputed: ['AwaitingAssignment', 'Completed']
};

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function clean(value: unknown): string {
  return String(value ?? '').trim();
}

function roundMoney(value: number): number {
  return Number((Math.round((Number(value) + Number.EPSILON) * 100) / 100).toFixed(2));
}

function safeId(value: string): string {
  return clean(value).replace(/[^A-Za-z0-9_-]/g, '_').replace(/^_+|_+$/g, '') || 'unassigned';
}

function readList<T>(key: string, fallback: T[], vendorId?: string): T[] {
  return readVendorScopedList<T>(key, fallback, vendorId);
}

function saveList<T>(key: string, rows: T[], vendorId?: string): T[] {
  return writeVendorScopedList(key, rows, vendorId);
}

function deliveryNumberFor(count: number): string {
  return `DEL-${String(count + 1).padStart(4, '0')}`;
}

function codeHash(code: string): string {
  const raw = `itred-delivery:${clean(code)}`;
  let hash = 0;
  for (let index = 0; index < raw.length; index += 1) {
    hash = ((hash << 5) - hash + raw.charCodeAt(index)) | 0;
  }
  return `DCODE-${Math.abs(hash).toString(16).toUpperCase().padStart(8, '0')}`;
}

function expiresAtFrom(issuedAt: string): string {
  return new Date(new Date(issuedAt).getTime() + DELIVERY_CODE_TTL_MINUTES * 60 * 1000).toISOString();
}

function contextFromSession(session: CanonicalPurchaseSession): DeliveryContext {
  return {
    vendorId: session.vendorId,
    branchId: session.branchId,
    warehouseId: session.warehouseId,
    terminalId: session.terminalId,
    staffId: session.staffId,
    staffName: session.staffName,
    role: session.role,
    permissions: session.permissions
  };
}

function contextFromPayload(payload: {
  vendorId?: string;
  branchId?: string;
  warehouseId?: string;
  terminalId?: string;
  cashierStaffId?: string;
  cashierStaffName?: string;
  role?: string;
  permissions?: string[];
}): DeliveryContext {
  if (!clean(payload.vendorId) || !clean(payload.branchId) || !clean(payload.warehouseId) || !clean(payload.terminalId) || !clean(payload.cashierStaffId)) {
    throw new Error(POS_SESSION_INCOMPLETE_MESSAGE);
  }
  return {
    vendorId: clean(payload.vendorId),
    branchId: clean(payload.branchId),
    warehouseId: clean(payload.warehouseId),
    terminalId: clean(payload.terminalId),
    staffId: clean(payload.cashierStaffId),
    staffName: clean(payload.cashierStaffName) || clean(payload.cashierStaffId),
    role: clean(payload.role) || 'Owner',
    permissions: payload.permissions?.length ? payload.permissions : ['*']
  };
}

export function resolveDeliveryContext(session?: PosSession | CanonicalPurchaseSession | null): DeliveryContext {
  return contextFromSession(assertCanonicalPurchaseSession(session));
}

function resolveOptionalDeliveryContext(session?: PosSession | CanonicalPurchaseSession | null): DeliveryContext | null {
  const resolved = getCanonicalPurchaseSession(session);
  return resolved ? contextFromSession(assertCanonicalPurchaseSession(resolved)) : null;
}

function roleCan(permission: string, role: string): boolean {
  const normalized = clean(role).toLowerCase();
  if (['owner', 'sysadmin'].includes(normalized)) return true;
  if (permission === 'delivery.view') return ['manager', 'supervisor', 'cashier', 'delivery staff', 'accountant', 'viewer'].includes(normalized);
  if (permission === 'delivery.create') return ['manager', 'supervisor', 'cashier'].includes(normalized);
  if (permission === 'delivery.assign' || permission === 'delivery.dispatch' || permission === 'delivery.cancel') return ['manager', 'supervisor'].includes(normalized);
  if (permission === 'delivery.track' || permission === 'delivery.verifyCode' || permission === 'delivery.complete' || permission === 'delivery.collectCash') return ['manager', 'supervisor', 'delivery staff'].includes(normalized);
  if (permission === 'delivery.cashReview' || permission === 'delivery.cashHandover') return ['manager', 'supervisor', 'accountant'].includes(normalized);
  if (permission === 'delivery.providerManage' || permission === 'delivery.performance') return ['manager'].includes(normalized);
  if (permission === 'delivery.broadcast') return ['manager', 'supervisor'].includes(normalized);
  return false;
}

function requireDeliveryPermission(context: DeliveryContext, permission: string): void {
  if (context.permissions.includes('*') || context.permissions.includes(permission) || roleCan(permission, context.role)) return;
  throw new Error('You do not have permission to perform this delivery action.');
}

function ensureSameVendor(context: DeliveryContext, vendorId: string): void {
  if (context.vendorId !== vendorId) {
    throw new Error('This delivery belongs to another vendor.');
  }
}

function canonicalStatusOf(row: DeliveryRequest): CanonicalDeliveryStatus {
  return row.status || LEGACY_TO_CANONICAL[row.deliveryStatus] || 'Draft';
}

function normalizeRequest(row: DeliveryRequest): DeliveryRequest {
  const status = canonicalStatusOf(row);
  const cashToCollect = Number(row.cashToCollect || 0);
  return {
    ...row,
    status,
    deliveryType: row.deliveryType || row.deliveryMethod,
    deliveryInstructions: row.deliveryInstructions || row.deliveryNotes,
    proofStatus: row.proofStatus || (status === 'Completed' || status === 'Delivered' ? 'Captured' : 'Pending'),
    customerConfirmationStatus: row.customerConfirmationStatus || row.confirmationStatus,
    amountCollected: Number(row.amountCollected ?? 0),
    amountHandedOver: Number(row.amountHandedOver ?? (row.cashStatus === 'Confirmed By Vendor' ? cashToCollect : 0)),
    createdBy: row.createdBy || row.cashierStaffId,
    version: row.version || 1
  };
}

function normalizeLine(line: DeliveryRequestLine): DeliveryRequestLine {
  const ordered = Number(line.quantityOrdered ?? line.qty ?? 0);
  return {
    ...line,
    deliveryLineId: line.deliveryLineId || line.lineId,
    saleLineId: line.saleLineId || line.receiptLineId,
    quantityOrdered: ordered,
    quantityDispatched: Number(line.quantityDispatched ?? (line.lineStatus === 'Dispatched' || line.lineStatus === 'In Transit' || line.lineStatus === 'Delivered' ? ordered : 0)),
    quantityDelivered: Number(line.quantityDelivered ?? (line.lineStatus === 'Delivered' ? ordered : 0)),
    quantityRejected: Number(line.quantityRejected ?? 0),
    condition: line.condition || 'Pending'
  };
}

function canTransition(from: CanonicalDeliveryStatus, to: CanonicalDeliveryStatus): boolean {
  return from === to || VALID_TRANSITIONS[from].includes(to);
}

function activity(event: Omit<DeliveryActivityEvent, 'id' | 'createdAt'>, vendorId?: string): DeliveryActivityEvent[] {
  const rows = readList<DeliveryActivityEvent>(ACTIVITY_KEY, mockDeliveryActivityEvents, vendorId);
  const next: DeliveryActivityEvent = { id: makeId('DACT'), createdAt: nowIso(), ...event };
  const updated = [next, ...rows].slice(0, 250);
  saveList(ACTIVITY_KEY, updated, vendorId);
  return updated;
}

function updateDelivery(deliveryId: string, patch: Partial<DeliveryRequest>, vendorId?: string): DeliveryRequest | null {
  const rows = readList<DeliveryRequest>(REQUEST_KEY, mockDeliveryRequests, vendorId);
  const index = rows.findIndex((row) => row.deliveryId === deliveryId);
  if (index < 0) return null;
  const current = normalizeRequest(rows[index]);
  if (canonicalStatusOf(current) === 'Completed' && patch.status && patch.status !== 'Disputed') {
    throw new Error('Completed deliveries cannot be casually edited.');
  }
  const updated = normalizeRequest({
    ...current,
    ...patch,
    version: (current.version || 1) + 1,
    updatedAt: nowIso()
  });
  rows[index] = updated;
  saveList(REQUEST_KEY, rows, vendorId || updated.vendorId);
  return updated;
}

function transitionDelivery(
  request: DeliveryRequest,
  nextStatus: CanonicalDeliveryStatus,
  staffId: string,
  patch: Partial<DeliveryRequest> = {},
  notes?: string
): DeliveryRequest {
  const current = canonicalStatusOf(request);
  if (!canTransition(current, nextStatus)) {
    throw new Error(`Delivery status cannot move from ${current} to ${nextStatus}.`);
  }
  const updated = updateDelivery(request.deliveryId, {
    ...patch,
    status: nextStatus,
    deliveryStatus: patch.deliveryStatus || CANONICAL_TO_LEGACY[nextStatus],
    completedAt: nextStatus === 'Completed' ? nowIso() : patch.completedAt,
    cancelledAt: nextStatus === 'Cancelled' ? nowIso() : patch.cancelledAt
  }, request.vendorId);
  if (!updated) throw new Error('Delivery request not found.');
  activity({
    deliveryId: request.deliveryId,
    deliveryNumber: request.deliveryNumber,
    receiptNumber: request.receiptNumber,
    eventType: 'DELIVERY_STATUS_CHANGED',
    message: `Delivery status changed from ${current} to ${nextStatus}.`,
    staffId,
    notes
  }, request.vendorId);
  return updated;
}

function matchesFilter(row: DeliveryRequest, filters: DeliveryFilterState = {}): boolean {
  const request = normalizeRequest(row);
  const haystack = [
    request.deliveryNumber,
    request.receiptNumber,
    request.customerName,
    request.customerPhone,
    request.customerWhatsapp,
    request.providerName,
    request.driverName,
    request.deliveryAddress
  ].join(' ').toLowerCase();
  const requestedDate = request.requestedAt.slice(0, 10);
  return (
    (!filters.deliveryNumber || request.deliveryNumber.toLowerCase().includes(filters.deliveryNumber.toLowerCase())) &&
    (!filters.receiptNumber || request.receiptNumber.toLowerCase().includes(filters.receiptNumber.toLowerCase())) &&
    (!filters.customer || haystack.includes(filters.customer.toLowerCase())) &&
    (!filters.phone || haystack.includes(filters.phone.toLowerCase())) &&
    (!filters.provider || (request.providerName || '').toLowerCase().includes(filters.provider.toLowerCase())) &&
    (!filters.driver || (request.driverName || '').toLowerCase().includes(filters.driver.toLowerCase())) &&
    (!filters.deliveryMethod || filters.deliveryMethod === 'ALL' || request.deliveryMethod === filters.deliveryMethod) &&
    (!filters.deliveryStatus || filters.deliveryStatus === 'ALL' || request.deliveryStatus === filters.deliveryStatus || request.status === filters.deliveryStatus) &&
    (!filters.cashStatus || filters.cashStatus === 'ALL' || request.cashStatus === filters.cashStatus) &&
    (!filters.confirmationStatus || filters.confirmationStatus === 'ALL' || request.confirmationStatus === filters.confirmationStatus) &&
    (!filters.priority || filters.priority === 'ALL' || request.priority === filters.priority) &&
    (!filters.dateFrom || requestedDate >= filters.dateFrom) &&
    (!filters.dateTo || requestedDate <= filters.dateTo)
  );
}

async function queueDeliveryOfflineAction(request: DeliveryRequest, operationType: string, payload: Record<string, unknown>, staffId: string, staffName: string, actionId = operationType): Promise<void> {
  const network = await getNetworkStatus().catch(() => 'Unknown');
  const status = network === 'Offline' || network === 'Unstable' ? 'Queued' : 'Ready To Sync';
  await enqueueOfflineAction({
    queueId: safeId(`delivery_${request.deliveryId}_${actionId}`),
    vendorId: request.vendorId,
    branchId: request.branchId,
    terminalId: request.terminalId,
    staffId,
    staffName,
    entityType: 'Delivery Request',
    entityId: request.deliveryId,
    entityNumber: request.deliveryNumber,
    operationType,
    payload,
    status,
    notes: status === 'Queued' ? 'Saved offline. Waiting to synchronize.' : 'Delivery action waiting to synchronize.'
  }).catch(() => undefined);
}

async function requireRequestForAction(
  deliveryId: string,
  permission: string,
  session?: PosSession | CanonicalPurchaseSession | null
): Promise<{ request: DeliveryRequest; context: DeliveryContext }> {
  const context = resolveDeliveryContext(session);
  requireDeliveryPermission(context, permission);
  const request = await getDeliveryRequestById(deliveryId, context.vendorId) || await getDeliveryRequestById(deliveryId);
  if (!request) throw new Error('Delivery request not found.');
  ensureSameVendor(context, request.vendorId);
  return { request, context };
}

function validateDeliveryAddress(request: DeliveryRequest): void {
  if (!clean(request.deliveryAddress)) throw new Error('Delivery address must be confirmed before dispatch.');
  if (!clean(request.customerPhone) && !clean(request.customerWhatsapp)) throw new Error('Customer contact number must be confirmed before dispatch.');
}

function cashHandoverSatisfied(request: DeliveryRequest): boolean {
  if (Number(request.cashToCollect || 0) <= 0) return true;
  if (['Confirmed By Vendor', 'Closed', 'HandedOver', 'Reconciled'].includes(request.cashStatus)) return Number(request.amountHandedOver || 0) >= Number(request.cashToCollect || 0);
  const handovers = readList<DeliveryCashHandoverRecord>(HANDOVER_KEY, [], request.vendorId);
  return handovers.some((handover) => (
    handover.deliveryId === request.deliveryId
    && ['Accepted', 'Confirmed', 'Reconciled'].includes(handover.handoverStatus)
    && Number(handover.amountCounted ?? handover.cashReceived) >= Number(request.cashToCollect || 0)
  ));
}

function completionBlockers(request: DeliveryRequest): string[] {
  const blockers: string[] = [];
  const proofCaptured = request.proofStatus === 'Captured' || readList<ProofOfDeliveryRecord>(PROOF_KEY, [], request.vendorId).some((proof) => proof.deliveryId === request.deliveryId && proof.status === 'Captured');
  const customerConfirmed = ['Code Verified', 'Verified'].includes(request.confirmationStatus) || ['Code Verified', 'Verified'].includes(request.customerConfirmationStatus || '');
  if (!proofCaptured) blockers.push('Proof of delivery missing.');
  if (!customerConfirmed) blockers.push('Customer confirmation missing.');
  if (!cashHandoverSatisfied(request)) blockers.push('Delivery cash handover missing.');
  return blockers;
}

async function closeIfReady(request: DeliveryRequest, context: DeliveryContext, notes?: string): Promise<DeliveryRequest> {
  const normalized = normalizeRequest(request);
  const blockers = completionBlockers(normalized);
  if (blockers.length > 0) return normalized;
  if (canonicalStatusOf(normalized) === 'Completed') return normalized;
  const completed = transitionDelivery(normalized, 'Completed', context.staffId, {
    deliveryStatus: 'Completed',
    trackingStatus: 'Completed',
    cashStatus: Number(normalized.cashToCollect || 0) > 0 ? 'Closed' : normalized.cashStatus,
    completedAt: nowIso()
  }, notes || 'Delivery closed after confirmation, proof, and cash handover checks.');
  activity({
    deliveryId: completed.deliveryId,
    deliveryNumber: completed.deliveryNumber,
    receiptNumber: completed.receiptNumber,
    eventType: 'DELIVERY_COMPLETED',
    message: 'Delivery closed after fulfillment evidence passed.',
    staffId: context.staffId
  }, completed.vendorId);
  await queueDeliveryOfflineAction(completed, 'CLOSE_DELIVERY', { deliveryId: completed.deliveryId, status: completed.status }, context.staffId, context.staffName, 'close');
  return completed;
}

export async function getDeliveryRequests(filters: DeliveryFilterState = {}): Promise<DeliveryRequest[]> {
  return readList<DeliveryRequest>(REQUEST_KEY, mockDeliveryRequests).map(normalizeRequest).filter((row) => matchesFilter(row, filters));
}

export async function getDeliveryRequestById(deliveryId: string, vendorId?: string): Promise<DeliveryRequest | undefined> {
  return readList<DeliveryRequest>(REQUEST_KEY, mockDeliveryRequests, vendorId).map(normalizeRequest).find((row) => row.deliveryId === deliveryId);
}

export async function getDeliveryRequestLines(deliveryId: string): Promise<DeliveryRequestLine[]> {
  const request = await getDeliveryRequestById(deliveryId);
  return readList<DeliveryRequestLine>(LINE_KEY, mockDeliveryRequestLines, request?.vendorId).filter((line) => line.deliveryId === deliveryId).map(normalizeLine);
}

export async function getDeliverySummary(filters: DeliveryFilterState = {}): Promise<DeliverySummary> {
  const rows = await getDeliveryRequests(filters);
  const today = nowIso().slice(0, 10);
  const status = (row: DeliveryRequest) => canonicalStatusOf(row);
  return {
    pendingAssignment: rows.filter((row) => status(row) === 'AwaitingAssignment').length,
    broadcastToIDeliver: rows.filter((row) => row.deliveryStatus === 'Broadcast To iDeliver').length,
    assigned: rows.filter((row) => status(row) === 'Assigned').length,
    readyForDispatch: rows.filter((row) => status(row) === 'ReadyForDispatch').length,
    inTransit: rows.filter((row) => status(row) === 'Dispatched' || status(row) === 'InTransit').length,
    arrived: rows.filter((row) => status(row) === 'Arrived').length,
    awaitingConfirmation: rows.filter((row) => status(row) === 'AwaitingCustomerConfirmation' || row.confirmationStatus === 'Code Sent' || row.confirmationStatus === 'Code Pending').length,
    awaitingCashHandover: rows.filter((row) => status(row) === 'AwaitingCashHandover' || row.cashStatus === 'Collected By Driver' || row.deliveryStatus === 'Cash Pending Review').length,
    completedToday: rows.filter((row) => status(row) === 'Completed' && (row.completedAt || row.updatedAt).startsWith(today)).length,
    deliveredToday: rows.filter((row) => ['Delivered', 'Completed'].includes(status(row)) && (row.deliveredAt || row.completedAt || row.updatedAt).startsWith(today)).length,
    failedDeliveries: rows.filter((row) => status(row) === 'DeliveryFailed').length,
    failedToday: rows.filter((row) => status(row) === 'DeliveryFailed' && row.updatedAt.startsWith(today)).length,
    cashPendingReview: rows.filter((row) => row.cashStatus === 'Collected By Driver' || row.cashStatus === 'Variance Review' || status(row) === 'AwaitingCashHandover').length,
    codeVerificationPending: rows.filter((row) => row.confirmationStatus === 'Code Pending' || row.confirmationStatus === 'Code Sent').length,
    returnedToVendor: rows.filter((row) => row.deliveryStatus === 'Returned To Vendor').length,
    urgentDeliveries: rows.filter((row) => row.priority === 'Urgent').length
  };
}

export async function createDeliveryRequestFromReceipt(payload: {
  vendorId: string;
  receiptId: string;
  receiptNumber: string;
  saleId?: string;
  orderId?: string;
  branchId: string;
  branchName: string;
  warehouseId?: string;
  warehouseName?: string;
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
  latitude?: number;
  longitude?: number;
  deliveryNotes: string;
  deliveryFee: number;
  paymentMode: DeliveryPaymentMode;
  totalReceiptAmount: number;
  cashToCollect: number;
  lines: Array<{ productId: string; sku: string; productName: string; qty: number; receiptLineId?: string; saleLineId?: string }>;
  session?: PosSession | CanonicalPurchaseSession | null;
}): Promise<DeliveryRequest | null> {
  if (payload.deliveryMethod === 'No Delivery') return null;
  const context = payload.session ? resolveDeliveryContext(payload.session) : contextFromPayload(payload);
  requireDeliveryPermission(context, 'delivery.create');
  if (context.vendorId !== payload.vendorId || context.branchId !== payload.branchId || context.terminalId !== payload.terminalId) {
    throw new Error(POS_SESSION_INCOMPLETE_MESSAGE);
  }
  if (!clean(payload.receiptId) && !clean(payload.saleId) && !clean(payload.orderId)) throw new Error('Delivery must reference a sale or order.');
  if (!clean(payload.customerName)) throw new Error('Customer name is required for delivery.');
  if (!clean(payload.customerPhone) && !clean(payload.customerWhatsapp)) throw new Error('Customer contact number is required for delivery.');
  if (payload.deliveryMethod !== 'Customer Collection' && !clean(payload.deliveryAddress)) throw new Error('Delivery address is required.');
  if (!payload.lines.length || payload.lines.some((line) => Number(line.qty || 0) <= 0)) throw new Error('Delivery items must match sale lines.');
  const cashToCollect = roundMoney(Number(payload.cashToCollect || 0));
  if (['Already Paid', 'Prepaid', 'No Payment Due', 'No Payment Required'].includes(payload.paymentMode) && cashToCollect > 0) {
    throw new Error('Prepaid delivery must not collect again.');
  }
  if (payload.paymentMode === 'Cash On Delivery' && cashToCollect <= 0) {
    throw new Error('Cash on delivery requires an approved amount to collect.');
  }

  const rows = readList<DeliveryRequest>(REQUEST_KEY, mockDeliveryRequests, payload.vendorId).map(normalizeRequest);
  const duplicate = rows.find((row) => (
    (payload.saleId && row.saleId === payload.saleId)
    || (payload.receiptId && row.receiptId === payload.receiptId)
    || (payload.receiptNumber && row.receiptNumber === payload.receiptNumber)
  ));
  if (duplicate) return duplicate;

  const issuedAt = nowIso();
  const code = generateDeliveryConfirmationCode();
  const deliveryId = safeId(payload.saleId ? `DEL-${payload.saleId}` : makeId('DEL-ID'));
  const initialStatus: CanonicalDeliveryStatus = payload.deliveryMethod === 'Customer Collection' ? 'ReadyForDispatch' : 'AwaitingAssignment';
  const deliveryStatus: DeliveryStatus = payload.deliveryMethod === 'iDeliver Service'
    ? 'Broadcast To iDeliver'
    : CANONICAL_TO_LEGACY[initialStatus];
  const cashStatus = cashToCollect > 0 ? 'Pending Collection' : 'Not Required';
  const record: DeliveryRequest = normalizeRequest({
    deliveryId,
    deliveryNumber: deliveryNumberFor(rows.length),
    vendorId: payload.vendorId,
    receiptId: payload.receiptId || payload.saleId || payload.orderId || deliveryId,
    receiptNumber: payload.receiptNumber || payload.saleId || payload.orderId || deliveryId,
    saleId: payload.saleId || payload.receiptId,
    orderId: payload.orderId,
    branchId: payload.branchId,
    branchName: payload.branchName,
    warehouseId: payload.warehouseId || context.warehouseId,
    warehouseName: payload.warehouseName,
    terminalId: payload.terminalId,
    cashierStaffId: payload.cashierStaffId,
    cashierStaffName: payload.cashierStaffName,
    customerId: payload.customerId,
    customerName: payload.customerName,
    customerPhone: payload.customerPhone,
    customerWhatsapp: payload.customerWhatsapp,
    deliveryMethod: payload.deliveryMethod,
    deliveryType: payload.deliveryMethod,
    deliveryStatus,
    status: initialStatus,
    priority: payload.priority,
    deliveryAddress: payload.deliveryAddress,
    deliverySuburb: payload.deliverySuburb,
    deliveryCityTown: payload.deliveryCityTown,
    latitude: payload.latitude,
    longitude: payload.longitude,
    deliveryNotes: payload.deliveryNotes,
    deliveryInstructions: payload.deliveryNotes,
    deliveryFee: payload.deliveryFee,
    paymentMode: payload.paymentMode,
    cashStatus,
    totalReceiptAmount: payload.totalReceiptAmount,
    cashToCollect,
    amountCollected: 0,
    amountHandedOver: 0,
    confirmationCode: code,
    confirmationCodeHash: codeHash(code),
    confirmationStatus: 'Code Sent',
    customerConfirmationStatus: 'Code Sent',
    proofStatus: 'Pending',
    trackingStatus: payload.deliveryMethod === 'iDeliver Service' ? 'Tracking Unavailable' : 'Not Started',
    requestedAt: issuedAt,
    createdBy: payload.cashierStaffId,
    syncStatus: 'Waiting to synchronize',
    createdAt: issuedAt,
    updatedAt: issuedAt
  });
  saveList(REQUEST_KEY, [record, ...rows], payload.vendorId);

  const currentLines = readList<DeliveryRequestLine>(LINE_KEY, mockDeliveryRequestLines, payload.vendorId);
  const nextLines = payload.lines.map((line, index): DeliveryRequestLine => {
    const quantity = Number(line.qty || 0);
    return normalizeLine({
      lineId: makeId(`DLL-${index + 1}`),
      deliveryLineId: makeId(`DLL-${index + 1}`),
      deliveryId,
      vendorId: payload.vendorId,
      productId: line.productId,
      sku: line.sku,
      productName: line.productName,
      qty: quantity,
      quantityOrdered: quantity,
      quantityDispatched: 0,
      quantityDelivered: 0,
      quantityRejected: 0,
      receiptLineId: line.receiptLineId,
      saleLineId: line.saleLineId || line.receiptLineId,
      lineStatus: payload.deliveryMethod === 'iDeliver Service' ? 'Ready For iDeliver' : 'Ready For Delivery',
      condition: 'Pending',
      notes: 'Created from completed POS sale. Stock already moved during sale completion.'
    });
  });
  saveList(LINE_KEY, [...nextLines, ...currentLines], payload.vendorId);

  const codes = readList<DeliveryConfirmationCode>(CODE_KEY, mockDeliveryConfirmationCodes, payload.vendorId);
  const confirmation: DeliveryConfirmationCode = {
    codeId: makeId('DCODE'),
    confirmationId: makeId('DCONF'),
    vendorId: payload.vendorId,
    deliveryId,
    customerId: payload.customerId,
    code,
    codeHash: codeHash(code),
    status: 'Code Sent',
    sentToCustomer: true,
    attempts: 0,
    issuedAt,
    expiresAt: expiresAtFrom(issuedAt),
    createdAt: issuedAt
  };
  saveList(CODE_KEY, [confirmation, ...codes], payload.vendorId);
  await createWhatsAppMessageDraft(deliveryId, 'Customer Code', context);
  activity({ deliveryId, deliveryNumber: record.deliveryNumber, receiptNumber: record.receiptNumber, eventType: 'DELIVERY_REQUEST_CREATED', message: 'Delivery request created from completed receipt.', staffId: payload.cashierStaffId }, payload.vendorId);
  if (payload.deliveryMethod === 'iDeliver Service') {
    activity({ deliveryId, deliveryNumber: record.deliveryNumber, receiptNumber: record.receiptNumber, eventType: 'DELIVERY_BROADCAST_TO_IDELIVER', message: 'iDeliver broadcast placeholder prepared from POS sale.', staffId: payload.cashierStaffId }, payload.vendorId);
  }
  await queueDeliveryOfflineAction(record, 'CREATE_DELIVERY_REQUEST', { delivery: record, lines: nextLines }, context.staffId, context.staffName, 'create');
  return record;
}

export async function createDeliveryDraftFromCart(payload: Partial<DeliveryRequest> & { session?: PosSession | CanonicalPurchaseSession | null }): Promise<DeliveryRequest> {
  const context = payload.session ? resolveDeliveryContext(payload.session) : resolveDeliveryContext();
  requireDeliveryPermission(context, 'delivery.create');
  const rows = readList<DeliveryRequest>(REQUEST_KEY, mockDeliveryRequests, context.vendorId).map(normalizeRequest);
  const draft: DeliveryRequest = normalizeRequest({
    deliveryId: makeId('DEL-DRAFT'),
    deliveryNumber: deliveryNumberFor(rows.length),
    vendorId: context.vendorId,
    receiptId: payload.receiptId || 'DRAFT',
    receiptNumber: payload.receiptNumber || 'DRAFT',
    branchId: context.branchId,
    branchName: payload.branchName || context.branchId,
    warehouseId: context.warehouseId,
    warehouseName: payload.warehouseName,
    terminalId: context.terminalId,
    cashierStaffId: context.staffId,
    cashierStaffName: context.staffName,
    customerName: payload.customerName || '',
    customerPhone: payload.customerPhone || '',
    customerWhatsapp: payload.customerWhatsapp || '',
    deliveryMethod: payload.deliveryMethod || 'Vendor Delivery',
    deliveryType: payload.deliveryMethod || 'Vendor Delivery',
    deliveryStatus: 'Draft',
    status: 'Draft',
    priority: payload.priority || 'Normal',
    deliveryAddress: payload.deliveryAddress || '',
    deliveryNotes: payload.deliveryNotes || '',
    deliveryInstructions: payload.deliveryNotes || '',
    deliveryFee: payload.deliveryFee || 0,
    paymentMode: payload.paymentMode || 'No Payment Due',
    cashStatus: 'Not Required',
    totalReceiptAmount: payload.totalReceiptAmount || 0,
    cashToCollect: payload.cashToCollect || 0,
    amountCollected: 0,
    amountHandedOver: 0,
    confirmationCode: payload.confirmationCode || generateDeliveryConfirmationCode(),
    confirmationCodeHash: payload.confirmationCodeHash || codeHash(payload.confirmationCode || ''),
    confirmationStatus: 'Code Pending',
    customerConfirmationStatus: 'Code Pending',
    proofStatus: 'Pending',
    trackingStatus: 'Not Started',
    requestedAt: nowIso(),
    createdBy: context.staffId,
    syncStatus: 'Saved offline',
    createdAt: nowIso(),
    updatedAt: nowIso()
  });
  saveList(REQUEST_KEY, [draft, ...rows], context.vendorId);
  activity({ deliveryId: draft.deliveryId, deliveryNumber: draft.deliveryNumber, receiptNumber: draft.receiptNumber, eventType: 'DELIVERY_DRAFT_CREATED', message: 'Draft delivery details captured. No delivery request is active until sale completion.', staffId: context.staffId }, context.vendorId);
  return draft;
}

export async function updateDeliveryDraft(deliveryId: string, patch: Partial<DeliveryRequest>): Promise<DeliveryRequest | null> {
  const current = await getDeliveryRequestById(deliveryId);
  return updateDelivery(deliveryId, patch, current?.vendorId);
}

export async function broadcastToIDeliver(deliveryId: string, staffId: string, session?: PosSession | CanonicalPurchaseSession | null): Promise<{ request: DeliveryRequest | null; payload?: DeliveryBroadcastPayload; message: string }> {
  const { request, context } = await requireRequestForAction(deliveryId, 'delivery.broadcast', session);
  const updated = updateDelivery(deliveryId, { deliveryStatus: 'Broadcast To iDeliver', trackingStatus: 'Tracking Unavailable', status: canonicalStatusOf(request) }, request.vendorId);
  if (!updated) return { request: null, message: 'Delivery request not found.' };
  const lines = await getDeliveryRequestLines(deliveryId);
  const payload: DeliveryBroadcastPayload = {
    deliveryNumber: updated.deliveryNumber,
    receiptNumber: updated.receiptNumber,
    vendorId: updated.vendorId,
    branchId: updated.branchId,
    customerName: updated.customerName,
    customerPhone: updated.customerPhone,
    deliveryAddress: updated.deliveryAddress,
    deliveryFee: updated.deliveryFee,
    cashToCollect: updated.cashToCollect,
    priority: updated.priority,
    itemCount: lines.reduce((sum, line) => sum + Number(line.qty || 0), 0),
    notes: updated.deliveryNotes
  };
  activity({ deliveryId, deliveryNumber: updated.deliveryNumber, receiptNumber: updated.receiptNumber, eventType: 'DELIVERY_BROADCAST_TO_IDELIVER', message: 'iDeliver broadcast placeholder prepared. No real network request was made.', staffId: staffId || context.staffId, notes: JSON.stringify(payload) }, updated.vendorId);
  await queueDeliveryOfflineAction(updated, 'BROADCAST_DELIVERY', payload as unknown as Record<string, unknown>, context.staffId, context.staffName, 'broadcast');
  return { request: updated, payload, message: 'iDeliver broadcast placeholder prepared.' };
}

export async function getDeliveryProviders(filters: { providerType?: 'ALL' | DeliveryProviderType; active?: 'ALL' | 'Active' | 'Inactive' } = {}): Promise<DeliveryProvider[]> {
  return readList<DeliveryProvider>(PROVIDER_KEY, mockDeliveryProviders).filter((provider) => (
    (!filters.providerType || filters.providerType === 'ALL' || provider.providerType === filters.providerType) &&
    (!filters.active || filters.active === 'ALL' || (filters.active === 'Active' ? provider.active : !provider.active))
  ));
}

export async function selectDeliveryProvider(deliveryId: string, providerId: string, staffId: string, session?: PosSession | CanonicalPurchaseSession | null): Promise<DeliveryRequest | null> {
  const { request, context } = await requireRequestForAction(deliveryId, 'delivery.assign', session);
  const provider = readList<DeliveryProvider>(PROVIDER_KEY, mockDeliveryProviders, request.vendorId).find((row) => row.providerId === providerId);
  if (!provider || !provider.active) throw new Error('Active delivery provider is required.');
  const updated = transitionDelivery(request, 'Assigned', staffId || context.staffId, {
    providerId,
    providerName: provider.providerName,
    deliveryStatus: 'Provider Selected',
    assignedTeamId: provider.providerId,
    assignedVehicleId: provider.vehiclePlaceholder
  }, `${provider.providerName} selected.`);
  await queueDeliveryOfflineAction(updated, 'SELECT_DELIVERY_PROVIDER', { providerId }, context.staffId, context.staffName, `provider_${providerId}`);
  return updated;
}

export async function assignVendorDriver(deliveryId: string, driverStaffId: string, staffId: string, session?: PosSession | CanonicalPurchaseSession | null): Promise<DeliveryRequest | null> {
  const { request, context } = await requireRequestForAction(deliveryId, 'delivery.assign', session);
  const provider = readList<DeliveryProvider>(PROVIDER_KEY, mockDeliveryProviders, request.vendorId).find((row) => row.providerId === driverStaffId);
  if (!provider || !provider.active) throw new Error('Active vendor driver or approved partner is required.');
  const assignments = readList<DeliveryAssignment>(ASSIGNMENT_KEY, mockDeliveryAssignments, request.vendorId);
  const now = nowIso();
  const archived = assignments.map((assignment) => assignment.deliveryId === deliveryId && assignment.status !== 'Superseded' ? { ...assignment, status: 'Superseded' as const, notes: 'Superseded by reassignment.' } : assignment);
  const assignment: DeliveryAssignment = {
    assignmentId: makeId('DASS'),
    vendorId: request.vendorId,
    deliveryId,
    teamId: provider.providerId,
    providerId: provider.providerId,
    providerName: provider.providerName,
    driverStaffId,
    driverId: driverStaffId,
    driverName: provider.providerName,
    driverPhone: provider.phone,
    vehicleId: provider.vehiclePlaceholder,
    vehiclePlaceholder: provider.vehiclePlaceholder,
    assignedAt: now,
    status: 'Active',
    notes: 'One active assignment created for delivery.',
    assignedByStaffId: staffId || context.staffId,
    assignedBy: staffId || context.staffId
  };
  saveList(ASSIGNMENT_KEY, [assignment, ...archived], request.vendorId);
  const updated = transitionDelivery(request, 'Assigned', staffId || context.staffId, {
    providerId: provider.providerId,
    providerName: provider.providerName,
    driverStaffId,
    assignedDriverId: driverStaffId,
    assignedTeamId: provider.providerId,
    assignedVehicleId: provider.vehiclePlaceholder,
    driverName: provider.providerName,
    driverPhone: provider.phone,
    deliveryStatus: 'Assigned',
    assignedAt: now
  }, `${provider.providerName} assigned to delivery.`);
  await createWhatsAppMessageDraft(deliveryId, 'Driver Assignment', context);
  await queueDeliveryOfflineAction(updated, 'ASSIGN_DELIVERY_TEAM', { assignment }, context.staffId, context.staffName, `assignment_${assignment.assignmentId}`);
  return updated;
}

export async function acceptDelivery(deliveryId: string, driverStaffId: string, session?: PosSession | CanonicalPurchaseSession | null): Promise<DeliveryRequest | null> {
  const { request, context } = await requireRequestForAction(deliveryId, 'delivery.track', session);
  const updated = transitionDelivery(request, 'ReadyForDispatch', driverStaffId || context.staffId, {
    deliveryStatus: 'Accepted By Driver',
    acceptedAt: nowIso(),
    driverStaffId: driverStaffId || request.driverStaffId,
    assignedDriverId: driverStaffId || request.assignedDriverId
  }, 'Delivery accepted by driver.');
  activity({ deliveryId, deliveryNumber: updated.deliveryNumber, receiptNumber: updated.receiptNumber, eventType: 'DELIVERY_ACCEPTED_BY_DRIVER', message: 'Delivery accepted by driver.', staffId: driverStaffId || context.staffId }, updated.vendorId);
  await queueDeliveryOfflineAction(updated, 'ACCEPT_DELIVERY', { driverStaffId: driverStaffId || context.staffId }, context.staffId, context.staffName, 'accept');
  return updated;
}

export async function dispatchDelivery(deliveryId: string, staffId: string, session?: PosSession | CanonicalPurchaseSession | null): Promise<DeliveryRequest | null> {
  const { request, context } = await requireRequestForAction(deliveryId, 'delivery.dispatch', session);
  validateDeliveryAddress(request);
  const status = canonicalStatusOf(request);
  if (['Dispatched', 'InTransit', 'Arrived', 'Delivered', 'AwaitingCashHandover', 'Completed'].includes(status)) {
    throw new Error('Dispatch cannot be repeated without reversal or re-dispatch.');
  }
  if (!request.driverStaffId && !request.assignedDriverId && !request.assignedTeamId && request.deliveryMethod !== 'Customer Collection') {
    throw new Error('Dispatch requires an assigned delivery team.');
  }
  const lines = await getDeliveryRequestLines(deliveryId);
  if (!lines.length) throw new Error('Delivery lines must be checked before dispatch.');
  const nextLines = lines.map((line) => {
    const ordered = Number(line.quantityOrdered ?? line.qty ?? 0);
    if (ordered <= 0) throw new Error('Dispatch quantity must be greater than zero.');
    return normalizeLine({
      ...line,
      quantityDispatched: ordered,
      lineStatus: 'Dispatched',
      notes: `${line.notes || ''} Dispatch confirmed. Cash to collect: USD ${Number(request.cashToCollect || 0).toFixed(2)}.`.trim()
    });
  });
  const allLines = readList<DeliveryRequestLine>(LINE_KEY, mockDeliveryRequestLines, request.vendorId);
  saveList(LINE_KEY, [...nextLines, ...allLines.filter((line) => line.deliveryId !== deliveryId)], request.vendorId);
  const updated = transitionDelivery(request, 'Dispatched', staffId || context.staffId, {
    deliveryStatus: 'Picked Up',
    dispatchedAt: nowIso(),
    pickedUpAt: nowIso(),
    trackingStatus: 'Location Shared'
  }, 'Dispatch confirmed after items, quantities, address, team, vehicle, and cash to collect were checked.');
  await createWhatsAppMessageDraft(deliveryId, 'Customer Status', context);
  await queueDeliveryOfflineAction(updated, 'DISPATCH_DELIVERY', { lines: nextLines, cashToCollect: request.cashToCollect }, context.staffId, context.staffName, 'dispatch');
  return updated;
}

export async function markPickedUp(deliveryId: string, staffId: string, session?: PosSession | CanonicalPurchaseSession | null): Promise<DeliveryRequest | null> {
  const { request, context } = await requireRequestForAction(deliveryId, 'delivery.dispatch', session);
  let current = request;
  if (!['Dispatched', 'InTransit', 'Arrived'].includes(canonicalStatusOf(current))) {
    current = await dispatchDelivery(deliveryId, staffId || context.staffId, session) || current;
  }
  await addTrackingEvent(deliveryId, { status: 'En Route', locationText: 'Picked up from branch', notes: 'Status tracking active. Live maps will use the existing maps integration when available.', updatedByStaffId: staffId || context.staffId }, session);
  const next = await getDeliveryRequestById(deliveryId, current.vendorId);
  return next || current;
}

export async function addTrackingEvent(
  deliveryId: string,
  payload: {
    status: DeliveryTrackingStatus;
    locationText: string;
    latitudePlaceholder?: string;
    longitudePlaceholder?: string;
    latitude?: number;
    longitude?: number;
    accuracy?: number;
    heading?: number;
    speed?: number;
    notes: string;
    updatedByStaffId: string;
    source?: DeliveryTrackingEvent['source'];
  },
  session?: PosSession | CanonicalPurchaseSession | null
): Promise<DeliveryTrackingEvent[]> {
  const { request, context } = await requireRequestForAction(deliveryId, 'delivery.track', session);
  if (['Completed', 'Cancelled'].includes(canonicalStatusOf(request))) throw new Error('Tracking stops after completion or cancellation.');
  const rows = readList<DeliveryTrackingEvent>(TRACKING_KEY, mockDeliveryTrackingEvents, request.vendorId);
  const event: DeliveryTrackingEvent = {
    trackingEventId: makeId('DTRK'),
    vendorId: request.vendorId,
    deliveryId,
    driverId: request.driverStaffId || request.assignedDriverId,
    dateTime: nowIso(),
    recordedAt: nowIso(),
    source: payload.source || 'ManualStatus',
    latitude: payload.latitude,
    longitude: payload.longitude,
    accuracy: payload.accuracy,
    heading: payload.heading,
    speed: payload.speed,
    ...payload
  };
  saveList(TRACKING_KEY, [event, ...rows], request.vendorId);
  let nextStatus: CanonicalDeliveryStatus | undefined;
  if (payload.status === 'En Route') nextStatus = 'InTransit';
  if (payload.status === 'Arrived') nextStatus = 'Arrived';
  if (nextStatus && canTransition(canonicalStatusOf(request), nextStatus)) {
    transitionDelivery(request, nextStatus, payload.updatedByStaffId || context.staffId, { trackingStatus: payload.status }, payload.notes);
  } else {
    updateDelivery(deliveryId, { trackingStatus: payload.status }, request.vendorId);
  }
  activity({ deliveryId, deliveryNumber: request.deliveryNumber, receiptNumber: request.receiptNumber, eventType: payload.status === 'En Route' ? 'DELIVERY_IN_TRANSIT' : 'DELIVERY_TRACKING_UPDATED', message: payload.locationText, staffId: payload.updatedByStaffId || context.staffId, notes: payload.notes }, request.vendorId);
  await queueDeliveryOfflineAction(request, 'ADD_DELIVERY_TRACKING', { tracking: event }, context.staffId, context.staffName, event.trackingEventId);
  return [event, ...rows];
}

export async function markArrived(deliveryId: string, staffId: string, session?: PosSession | CanonicalPurchaseSession | null): Promise<DeliveryRequest | null> {
  const { request, context } = await requireRequestForAction(deliveryId, 'delivery.track', session);
  const updated = transitionDelivery(request, 'Arrived', staffId || context.staffId, { deliveryStatus: 'Arrived', trackingStatus: 'Arrived' }, 'Driver arrival recorded.');
  await addTrackingEvent(deliveryId, { status: 'Arrived', locationText: 'Driver arrived at delivery address', notes: 'Arrival status recorded.', updatedByStaffId: staffId || context.staffId }, session);
  return updated;
}

export async function verifyDeliveryCode(deliveryId: string | { deliveryId: string; code: string; recipientName?: string; deliveryNote?: string; operator?: string }, code?: string, staffId?: string, session?: PosSession | CanonicalPurchaseSession | null): Promise<{ success: boolean; message: string; request?: DeliveryRequest | null }> {
  const normalized = typeof deliveryId === 'string'
    ? { deliveryId, code: code || '', staffId: staffId || '' }
    : { deliveryId: deliveryId.deliveryId, code: deliveryId.code, staffId: deliveryId.operator || '' };
  const { request, context } = await requireRequestForAction(normalized.deliveryId, 'delivery.verifyCode', session);
  const codes = readList<DeliveryConfirmationCode>(CODE_KEY, mockDeliveryConfirmationCodes, request.vendorId);
  const currentCode = codes.find((row) => row.deliveryId === normalized.deliveryId);
  const now = nowIso();
  if (currentCode?.expiresAt && currentCode.expiresAt < now) {
    updateDelivery(normalized.deliveryId, { confirmationStatus: 'Expired', customerConfirmationStatus: 'Expired' }, request.vendorId);
    return { success: false, message: 'Delivery confirmation code has expired.', request };
  }
  if ((currentCode?.attempts || request.verificationAttempts || 0) >= 3) {
    updateDelivery(normalized.deliveryId, { confirmationStatus: 'Locked', customerConfirmationStatus: 'Locked' }, request.vendorId);
    return { success: false, message: 'Delivery confirmation code is locked after too many attempts.', request };
  }
  const ok = currentCode?.codeHash
    ? currentCode.codeHash === codeHash(normalized.code)
    : verifyDeliveryConfirmationCode(request.confirmationCode, normalized.code);
  const attempts = (currentCode?.attempts ?? request.verificationAttempts ?? 0) + (ok ? 0 : 1);
  const confirmationStatus: DeliveryConfirmationStatus = ok ? 'Code Verified' : attempts >= 3 ? 'Manual Override Required' : 'Code Failed';
  const updated = updateDelivery(normalized.deliveryId, {
    confirmationStatus,
    customerConfirmationStatus: ok ? 'Verified' : confirmationStatus,
    verificationAttempts: attempts,
    verifiedAt: ok ? now : request.verifiedAt,
    verifiedByStaffId: ok ? (normalized.staffId || context.staffId) : request.verifiedByStaffId,
    customerConfirmedAt: ok ? now : request.customerConfirmedAt,
    customerConfirmedBy: ok ? request.customerName : request.customerConfirmedBy,
    status: ok && canonicalStatusOf(request) === 'Arrived' ? 'AwaitingCustomerConfirmation' : request.status
  }, request.vendorId);
  saveList(CODE_KEY, codes.map((row) => row.deliveryId === normalized.deliveryId ? {
    ...row,
    status: ok ? 'Verified' : confirmationStatus,
    attempts,
    verifiedAt: ok ? now : row.verifiedAt,
    verifiedByStaffId: ok ? (normalized.staffId || context.staffId) : row.verifiedByStaffId
  } : row), request.vendorId);
  activity({ deliveryId: normalized.deliveryId, deliveryNumber: request.deliveryNumber, receiptNumber: request.receiptNumber, eventType: ok ? 'DELIVERY_CODE_VERIFIED' : 'DELIVERY_CODE_FAILED', message: ok ? 'Delivery code verified.' : 'Delivery code verification failed.', staffId: normalized.staffId || context.staffId }, request.vendorId);
  await queueDeliveryOfflineAction(request, 'VERIFY_DELIVERY_CODE', { deliveryId: normalized.deliveryId, success: ok }, context.staffId, context.staffName, `verify_${attempts}`);
  return { success: ok, message: ok ? 'Delivery code verified.' : 'Incorrect code. Delivery cannot be completed.', request: updated };
}

export async function captureProofOfDelivery(
  deliveryId: string,
  payload: {
    receivedByName: string;
    receiverRelationship?: string;
    signatureUrl?: string;
    photoUrls?: string[];
    latitude?: number;
    longitude?: number;
    condition?: DeliveryReturnCondition | 'Delivered' | 'Partial';
    notes?: string;
    lines?: Array<{ lineId: string; quantityDelivered: number; quantityRejected?: number; condition?: DeliveryReturnCondition | 'Delivered' | 'Rejected'; notes?: string }>;
  },
  staffId: string,
  session?: PosSession | CanonicalPurchaseSession | null
): Promise<ProofOfDeliveryRecord> {
  const { request, context } = await requireRequestForAction(deliveryId, 'delivery.complete', session);
  if (!clean(payload.receivedByName)) throw new Error('Proof of delivery requires receiver name.');
  const lines = await getDeliveryRequestLines(deliveryId);
  if (payload.lines?.length) {
    const updatedLines = lines.map((line) => {
      const match = payload.lines?.find((row) => row.lineId === line.lineId || row.lineId === line.deliveryLineId);
      if (!match) return line;
      const dispatched = Number(line.quantityDispatched ?? line.quantityOrdered ?? line.qty ?? 0);
      const delivered = Number(match.quantityDelivered || 0);
      const rejected = Number(match.quantityRejected || 0);
      if (delivered + rejected > dispatched) throw new Error('Delivered quantity cannot exceed dispatched quantity.');
      return normalizeLine({
        ...line,
        quantityDelivered: delivered,
        quantityRejected: rejected,
        condition: match.condition || (rejected > 0 ? 'Rejected' : 'Delivered'),
        lineStatus: rejected > 0 ? 'Partially Delivered' : 'Delivered',
        notes: match.notes || line.notes
      });
    });
    const allLines = readList<DeliveryRequestLine>(LINE_KEY, mockDeliveryRequestLines, request.vendorId);
    saveList(LINE_KEY, [...updatedLines, ...allLines.filter((line) => line.deliveryId !== deliveryId)], request.vendorId);
  } else {
    const updatedLines = lines.map((line) => normalizeLine({
      ...line,
      quantityDelivered: Number(line.quantityDispatched || line.quantityOrdered || line.qty || 0),
      quantityRejected: 0,
      condition: 'Delivered',
      lineStatus: 'Delivered'
    }));
    const allLines = readList<DeliveryRequestLine>(LINE_KEY, mockDeliveryRequestLines, request.vendorId);
    saveList(LINE_KEY, [...updatedLines, ...allLines.filter((line) => line.deliveryId !== deliveryId)], request.vendorId);
  }
  const proof: ProofOfDeliveryRecord = {
    proofId: makeId('POD'),
    vendorId: request.vendorId,
    deliveryId,
    receivedByName: payload.receivedByName,
    receiverRelationship: payload.receiverRelationship || 'Customer',
    signatureUrl: payload.signatureUrl,
    photoUrls: payload.photoUrls || [],
    latitude: payload.latitude,
    longitude: payload.longitude,
    confirmedAt: nowIso(),
    confirmedByStaffId: staffId || context.staffId,
    condition: payload.condition || 'Delivered',
    notes: payload.notes || '',
    status: 'Captured'
  };
  const proofs = readList<ProofOfDeliveryRecord>(PROOF_KEY, [], request.vendorId);
  saveList(PROOF_KEY, [proof, ...proofs], request.vendorId);
  updateDelivery(deliveryId, { proofStatus: 'Captured', proofId: proof.proofId }, request.vendorId);
  activity({ deliveryId, deliveryNumber: request.deliveryNumber, receiptNumber: request.receiptNumber, eventType: 'PROOF_OF_DELIVERY_CAPTURED', message: 'Proof of delivery captured.', staffId: staffId || context.staffId, notes: payload.notes }, request.vendorId);
  await queueDeliveryOfflineAction(request, 'CAPTURE_PROOF_OF_DELIVERY', { proof }, context.staffId, context.staffName, proof.proofId);
  return proof;
}

export async function markDelivered(deliveryId: string, staffId: string, payload: { overrideCode?: boolean; notes?: string } = {}, session?: PosSession | CanonicalPurchaseSession | null): Promise<{ success: boolean; message: string; request?: DeliveryRequest | null }> {
  const { request, context } = await requireRequestForAction(deliveryId, 'delivery.complete', session);
  const customerConfirmed = request.confirmationStatus === 'Code Verified' || request.customerConfirmationStatus === 'Verified';
  const overrideAllowed = payload.overrideCode && ['Owner', 'SysAdmin', 'Manager', 'Supervisor'].includes(context.role);
  if (!customerConfirmed && !overrideAllowed) {
    return { success: false, message: 'Delivery cannot be marked delivered until the customer confirmation code is verified.' };
  }
  if (overrideAllowed && !customerConfirmed) {
    updateDelivery(deliveryId, { confirmationStatus: 'Manual Override Required', customerConfirmationStatus: 'Verified', verifiedAt: nowIso(), verifiedByStaffId: staffId || context.staffId }, request.vendorId);
  }
  const proof = await captureProofOfDelivery(deliveryId, {
    receivedByName: request.customerName,
    receiverRelationship: 'Customer',
    condition: 'Delivered',
    notes: payload.notes || 'Delivered from Delivery Fulfilment form.'
  }, staffId || context.staffId, session);
  const withProof = await getDeliveryRequestById(deliveryId, request.vendorId) || { ...request, proofStatus: 'Captured' as const, proofId: proof.proofId };
  const delivered = transitionDelivery(withProof, 'Delivered', staffId || context.staffId, {
    deliveryStatus: 'Delivered',
    trackingStatus: 'Completed',
    deliveredAt: nowIso()
  }, payload.notes || 'Goods delivered and proof captured.');
  activity({ deliveryId, deliveryNumber: delivered.deliveryNumber, receiptNumber: delivered.receiptNumber, eventType: 'DELIVERY_DELIVERED', message: 'Goods delivered. Completion remains gated by proof, customer confirmation, and cash handover where applicable.', staffId: staffId || context.staffId, notes: payload.notes }, delivered.vendorId);
  const gated = Number(delivered.cashToCollect || 0) > 0 && !cashHandoverSatisfied(delivered)
    ? transitionDelivery(delivered, 'AwaitingCashHandover', staffId || context.staffId, { deliveryStatus: 'Cash Pending Review' }, 'Cash handover required before closure.')
    : delivered;
  const finalRequest = await closeIfReady(gated, context, payload.notes);
  return {
    success: true,
    message: canonicalStatusOf(finalRequest) === 'Completed' ? 'Delivery completed with valid fulfillment evidence.' : 'Delivery recorded. Close is pending cash handover if required.',
    request: finalRequest
  };
}

export async function recordDeliveryFailure(deliveryId: string, staffId: string, reason: string, session?: PosSession | CanonicalPurchaseSession | null): Promise<DeliveryRequest | null> {
  if (!reason.trim()) return null;
  const { request, context } = await requireRequestForAction(deliveryId, 'delivery.cancel', session);
  const failed = transitionDelivery(request, 'DeliveryFailed', staffId || context.staffId, { deliveryStatus: 'Delivery Failed', failureReason: reason }, `Delivery failed: ${reason}`);
  const failure: DeliveryFailureRecord = {
    failureId: makeId('DFAIL'),
    vendorId: request.vendorId,
    deliveryId,
    reason,
    notes: reason,
    failedAt: nowIso(),
    reportedBy: staffId || context.staffId,
    nextAction: 'Review and reschedule or return goods.',
    status: 'Open'
  };
  saveList(FAILURE_KEY, [failure, ...readList<DeliveryFailureRecord>(FAILURE_KEY, [], request.vendorId)], request.vendorId);
  activity({ deliveryId, deliveryNumber: failed.deliveryNumber, receiptNumber: failed.receiptNumber, eventType: 'DELIVERY_FAILED', message: `Delivery failed: ${reason}`, staffId: staffId || context.staffId }, failed.vendorId);
  await queueDeliveryOfflineAction(failed, 'RECORD_DELIVERY_FAILURE', { failure }, context.staffId, context.staffName, failure.failureId);
  return failed;
}

export async function cancelDelivery(deliveryId: string, staffId: string, reason: string, session?: PosSession | CanonicalPurchaseSession | null): Promise<DeliveryRequest | null> {
  if (!reason.trim()) return null;
  const { request, context } = await requireRequestForAction(deliveryId, 'delivery.cancel', session);
  const updated = transitionDelivery(request, 'Cancelled', staffId || context.staffId, { deliveryStatus: 'Cancelled', cancelledAt: nowIso(), failureReason: reason }, `Delivery cancelled: ${reason}`);
  activity({ deliveryId, deliveryNumber: updated.deliveryNumber, receiptNumber: updated.receiptNumber, eventType: 'DELIVERY_CANCELLED', message: `Delivery cancelled: ${reason}`, staffId: staffId || context.staffId }, updated.vendorId);
  await queueDeliveryOfflineAction(updated, 'CANCEL_DELIVERY', { reason }, context.staffId, context.staffName, 'cancel');
  return updated;
}

export async function markReturnedToVendor(deliveryId: string, staffId: string, reason: string, session?: PosSession | CanonicalPurchaseSession | null): Promise<DeliveryRequest | null> {
  const { request, context } = await requireRequestForAction(deliveryId, 'delivery.cancel', session);
  const updated = updateDelivery(deliveryId, { deliveryStatus: 'Returned To Vendor', status: 'DeliveryFailed', failureReason: reason }, request.vendorId);
  if (updated) activity({ deliveryId, deliveryNumber: updated.deliveryNumber, receiptNumber: updated.receiptNumber, eventType: 'DELIVERY_RETURNED_TO_VENDOR', message: `Returned to vendor: ${reason}`, staffId: staffId || context.staffId }, updated.vendorId);
  return updated;
}

export async function recordPartialDelivery(
  deliveryId: string,
  lines: Array<{ lineId: string; quantityDelivered: number; quantityRejected: number; condition?: DeliveryReturnCondition; notes?: string }>,
  staffId: string,
  session?: PosSession | CanonicalPurchaseSession | null
): Promise<DeliveryRequest | null> {
  const { request, context } = await requireRequestForAction(deliveryId, 'delivery.complete', session);
  await captureProofOfDelivery(deliveryId, {
    receivedByName: request.customerName,
    receiverRelationship: 'Customer',
    condition: 'Partial',
    notes: 'Partial delivery recorded.',
    lines
  }, staffId || context.staffId, session);
  const latest = await getDeliveryRequestById(deliveryId, request.vendorId) || request;
  const updated = transitionDelivery(latest, 'PartiallyDelivered', staffId || context.staffId, { deliveryStatus: 'Delivered' }, 'Partial delivery recorded.');
  await queueDeliveryOfflineAction(updated, 'RECORD_PARTIAL_DELIVERY', { lines }, context.staffId, context.staffName, 'partial');
  return updated;
}

export async function recordDeliveryReturn(
  deliveryId: string,
  payload: { lineId: string; productId: string; quantityReturned: number; condition: DeliveryReturnCondition; notes: string },
  staffId: string,
  session?: PosSession | CanonicalPurchaseSession | null
): Promise<DeliveryReturnRecord> {
  const { request, context } = await requireRequestForAction(deliveryId, 'delivery.complete', session);
  const lines = await getDeliveryRequestLines(deliveryId);
  const line = lines.find((row) => row.lineId === payload.lineId || row.deliveryLineId === payload.lineId);
  if (!line) throw new Error('Delivery line not found for return.');
  const dispatched = Number(line.quantityDispatched ?? line.quantityOrdered ?? line.qty ?? 0);
  if (payload.quantityReturned > dispatched) throw new Error('Returned quantity cannot exceed dispatched quantity.');
  const record: DeliveryReturnRecord = {
    returnId: makeId('DRET'),
    vendorId: request.vendorId,
    deliveryId,
    deliveryLineId: line.deliveryLineId || line.lineId,
    productId: payload.productId,
    quantityReturned: payload.quantityReturned,
    condition: payload.condition,
    inspectedBy: staffId || context.staffId,
    returnedAt: nowIso(),
    notes: payload.notes
  };
  saveList(RETURN_KEY, [record, ...readList<DeliveryReturnRecord>(RETURN_KEY, [], request.vendorId)], request.vendorId);
  activity({ deliveryId, deliveryNumber: request.deliveryNumber, receiptNumber: request.receiptNumber, eventType: 'DELIVERY_RETURN_RECORDED', message: `Returned ${payload.quantityReturned} item(s) from delivery.`, staffId: staffId || context.staffId, notes: payload.notes }, request.vendorId);
  await queueDeliveryOfflineAction(request, 'RECORD_DELIVERY_RETURN', { return: record }, context.staffId, context.staffName, record.returnId);
  return record;
}

export async function rescheduleDelivery(deliveryId: string, staffId: string, rescheduleDate: string, notes: string, session?: PosSession | CanonicalPurchaseSession | null): Promise<DeliveryRequest | null> {
  const { request, context } = await requireRequestForAction(deliveryId, 'delivery.assign', session);
  const failures = readList<DeliveryFailureRecord>(FAILURE_KEY, [], request.vendorId).map((failure) => failure.deliveryId === deliveryId ? { ...failure, status: 'Rescheduled' as const, rescheduleDate, notes: notes || failure.notes } : failure);
  saveList(FAILURE_KEY, failures, request.vendorId);
  const updated = transitionDelivery(request, 'AwaitingAssignment', staffId || context.staffId, { deliveryStatus: 'Pending Assignment' }, `Delivery rescheduled for ${rescheduleDate}.`);
  await queueDeliveryOfflineAction(updated, 'RESCHEDULE_DELIVERY', { rescheduleDate, notes }, context.staffId, context.staffName, `reschedule_${safeId(rescheduleDate)}`);
  return updated;
}

export async function recordCashCollectedByDriver(deliveryId: string, staffId: string, amount: number, notes: string, session?: PosSession | CanonicalPurchaseSession | null): Promise<DeliveryCashCollection | null> {
  const { request, context } = await requireRequestForAction(deliveryId, 'delivery.collectCash', session);
  const collected = roundMoney(Number(amount || 0));
  const expected = roundMoney(Number(request.cashToCollect || 0));
  if (expected <= 0) throw new Error('This delivery does not require cash collection.');
  if (collected > expected && !clean(notes)) throw new Error('Cash collected cannot exceed amount due without explanation.');
  if (collected < expected && !clean(notes)) throw new Error('Partial collection requires a reason.');
  const rows = readList<DeliveryCashCollection>(CASH_KEY, mockDeliveryCashCollections, request.vendorId);
  const existing = rows.find((row) => row.deliveryId === deliveryId);
  const variance = roundMoney(collected - expected);
  const status: DeliveryCashCollection['status'] = variance === 0 ? 'Collected' : variance < 0 ? 'Short' : 'Over';
  const cash: DeliveryCashCollection = {
    cashCollectionId: existing?.cashCollectionId || makeId('DCASH'),
    collectionId: existing?.collectionId || existing?.cashCollectionId || makeId('DCOL'),
    vendorId: request.vendorId,
    deliveryId,
    saleId: request.saleId || request.receiptId,
    customerId: request.customerId,
    deliveryStaffId: staffId || context.staffId,
    paymentMode: request.paymentMode,
    paymentMethod: request.paymentMode,
    cashToCollect: expected,
    amountExpected: expected,
    deliveryFeeCash: request.paymentMode === 'Delivery Fee Cash' ? request.deliveryFee : 0,
    amountCollectedByDriver: collected,
    amountCollected: collected,
    collectionReference: request.deliveryNumber,
    collectedAt: nowIso(),
    driverCollectionNotes: notes,
    vendorCashConfirmed: existing?.vendorCashConfirmed || false,
    vendorConfirmedAmount: existing?.vendorConfirmedAmount || 0,
    cashVariance: variance,
    cashStatus: 'Collected By Driver',
    status,
    notes,
    updatedAt: nowIso()
  };
  saveList(CASH_KEY, [cash, ...rows.filter((row) => row.deliveryId !== deliveryId)], request.vendorId);
  updateDelivery(deliveryId, { cashStatus: 'Collected By Driver', amountCollected: collected, deliveryStatus: 'Cash Pending Review', status: 'AwaitingCashHandover' }, request.vendorId);
  activity({ deliveryId, deliveryNumber: request.deliveryNumber, receiptNumber: request.receiptNumber, eventType: 'DELIVERY_CASH_COLLECTED_BY_DRIVER', message: `Driver cash collection recorded for USD ${collected.toFixed(2)}.`, staffId: staffId || context.staffId, notes }, request.vendorId);
  await queueDeliveryOfflineAction(request, 'DECLARE_DELIVERY_CASH', { cash }, context.staffId, context.staffName, cash.cashCollectionId);
  return cash;
}

export async function confirmDeliveryCashReceived(deliveryId: string, staffId: string, amount: number, notes: string, session?: PosSession | CanonicalPurchaseSession | null): Promise<DeliveryCashCollection | null> {
  const { request, context } = await requireRequestForAction(deliveryId, 'delivery.cashHandover', session);
  if ((request.driverStaffId || request.assignedDriverId) === (staffId || context.staffId) && !['Owner', 'SysAdmin', 'Manager', 'Supervisor'].includes(context.role)) {
    throw new Error('Delivery staff cannot accept their own cash handover.');
  }
  const counted = roundMoney(Number(amount || 0));
  const expected = roundMoney(Number(request.cashToCollect || 0));
  if (expected <= 0) throw new Error('This delivery does not require cash handover.');
  if (counted > expected && !clean(notes)) throw new Error('Cash counted cannot exceed expected amount without explanation.');
  if (counted < expected && !clean(notes)) throw new Error('Cash handover variance requires explanation.');
  const rows = readList<DeliveryCashCollection>(CASH_KEY, mockDeliveryCashCollections, request.vendorId);
  const existing = rows.find((row) => row.deliveryId === deliveryId);
  const variance = roundMoney(counted - expected);
  const status = variance === 0 ? 'Confirmed By Vendor' : 'Variance Review';
  const cash: DeliveryCashCollection = {
    cashCollectionId: existing?.cashCollectionId || makeId('DCASH'),
    collectionId: existing?.collectionId || existing?.cashCollectionId || makeId('DCOL'),
    vendorId: request.vendorId,
    deliveryId,
    saleId: request.saleId || request.receiptId,
    customerId: request.customerId,
    deliveryStaffId: request.driverStaffId || request.assignedDriverId,
    paymentMode: request.paymentMode,
    paymentMethod: request.paymentMode,
    cashToCollect: expected,
    amountExpected: expected,
    deliveryFeeCash: request.paymentMode === 'Delivery Fee Cash' ? request.deliveryFee : 0,
    amountCollectedByDriver: existing?.amountCollectedByDriver || counted,
    amountCollected: existing?.amountCollected || counted,
    collectionReference: request.deliveryNumber,
    collectedAt: existing?.collectedAt || nowIso(),
    driverCollectionNotes: existing?.driverCollectionNotes || '',
    vendorCashConfirmed: variance === 0,
    vendorConfirmedAmount: counted,
    cashVariance: variance,
    cashStatus: status,
    status: variance === 0 ? 'HandedOver' : 'Short',
    notes,
    updatedAt: nowIso()
  };
  saveList(CASH_KEY, [cash, ...rows.filter((row) => row.deliveryId !== deliveryId)], request.vendorId);

  const handover: DeliveryCashHandoverRecord = {
    handoverId: makeId('DCH'),
    vendorId: request.vendorId,
    deliveryId,
    shiftId: '',
    drawerId: '',
    customerName: request.customerName,
    driverName: request.driverName || request.driverStaffId || 'Delivery Staff',
    deliveryStaffId: request.driverStaffId || request.assignedDriverId,
    receivingStaffId: staffId || context.staffId,
    cashExpected: expected,
    cashReceived: counted,
    difference: variance,
    amountExpected: expected,
    amountDeclared: existing?.amountCollectedByDriver || counted,
    amountCounted: counted,
    variance,
    handoverStatus: variance === 0 ? 'Accepted' : 'VarianceReview',
    handedOverAt: nowIso(),
    receivedAt: nowIso(),
    receivedBy: staffId || context.staffId,
    createdAt: nowIso(),
    notes
  };

  try {
    if (variance === 0) {
      const shift = getOpenCashShiftForSession(context as unknown as CanonicalPurchaseSession);
      if (shift) {
        const posted = await recordCashMovement({
          movementType: 'CASH_IN',
          amount: counted,
          shiftId: shift.id,
          referenceType: 'DELIVERY_HANDOVER',
          referenceId: handover.handoverId,
          reason: `Delivery cash handover accepted for ${request.deliveryNumber}.`,
          idempotencyKey: safeId(`${handover.handoverId}_CASH_IN`)
        }, context as unknown as CanonicalPurchaseSession);
        handover.shiftId = shift.id;
        handover.drawerId = posted.drawerMovement.drawerId;
        handover.cashMovementId = posted.movement.cashMovementId;
      }
    }
  } catch (error) {
    handover.notes = `${handover.notes || ''} Cash movement posting deferred: ${error instanceof Error ? error.message : String(error)}`.trim();
  }

  saveList(HANDOVER_KEY, [handover, ...readList<DeliveryCashHandoverRecord>(HANDOVER_KEY, [], request.vendorId)], request.vendorId);
  const updated = updateDelivery(deliveryId, {
    cashStatus: status,
    cashHandoverId: handover.handoverId,
    amountHandedOver: counted,
    deliveryStatus: variance === 0 ? 'Cash Pending Review' : 'Cash Pending Review',
    status: 'AwaitingCashHandover'
  }, request.vendorId);
  activity({ deliveryId, deliveryNumber: request.deliveryNumber, receiptNumber: request.receiptNumber, eventType: variance === 0 ? 'DELIVERY_CASH_HANDOVER_ACCEPTED' : 'DELIVERY_CASH_VARIANCE_FOUND', message: `Vendor cash handover counted for USD ${counted.toFixed(2)}.`, staffId: staffId || context.staffId, notes: handover.notes }, request.vendorId);
  await queueDeliveryOfflineAction(updated || request, 'ACCEPT_DELIVERY_CASH_HANDOVER', { cash, handover }, context.staffId, context.staffName, handover.handoverId);
  if (updated && variance === 0) {
    await closeIfReady(updated, context, 'Cash handover accepted.');
  }
  return cash;
}

export async function createWhatsAppMessageDraft(deliveryId: string, messageType: DeliveryWhatsAppMessageDraft['messageType'], session?: PosSession | CanonicalPurchaseSession | DeliveryContext | null): Promise<DeliveryWhatsAppMessageDraft | null> {
  const request = await getDeliveryRequestById(deliveryId);
  if (!request) return null;
  const context = session && 'permissions' in session && 'staffId' in session && !('vendor' in session)
    ? session as DeliveryContext
    : resolveOptionalDeliveryContext(session as PosSession | CanonicalPurchaseSession | null);
  if (context) ensureSameVendor(context, request.vendorId);
  const recipient = messageType === 'Driver Assignment' ? request.driverPhone || '' : request.customerWhatsapp || request.customerPhone;
  const messageText = messageType === 'Customer Code'
    ? createDeliveryMessageText({ ...request, messageType: 'code' })
    : messageType === 'Customer Status'
      ? createDeliveryMessageText({ ...request, messageType: 'status' })
      : messageType === 'Driver Assignment'
        ? createDriverMessageText(request)
        : `Delivery ${request.deliveryNumber} has cash pending confirmation. Please confirm cash received from the delivery person.`;
  const draft: DeliveryWhatsAppMessageDraft = { draftId: makeId('DWA'), deliveryId, messageType, recipient, messageText, createdAt: nowIso(), status: 'Prepared' };
  saveList(WHATSAPP_KEY, [draft, ...readList<DeliveryWhatsAppMessageDraft>(WHATSAPP_KEY, mockDeliveryWhatsAppMessageDrafts, request.vendorId)], request.vendorId);
  activity({ deliveryId, deliveryNumber: request.deliveryNumber, receiptNumber: request.receiptNumber, eventType: 'DELIVERY_NOTIFICATION_PREVIEW_PREPARED', message: `${messageType} message preview prepared. Integration was not claimed as sent.`, staffId: context?.staffId || request.cashierStaffId }, request.vendorId);
  return draft;
}

export async function getDeliveryBIWarnings(filters: DeliveryFilterState = {}): Promise<DeliveryBIWarning[]> {
  const rows = await getDeliveryRequests(filters);
  const now = Date.now();
  return rows.flatMap((request): DeliveryBIWarning[] => {
    const warnings: DeliveryBIWarning[] = [];
    const ageHours = (now - new Date(request.updatedAt || request.requestedAt).getTime()) / (1000 * 60 * 60);
    if (!['Completed', 'Cancelled', 'DeliveryFailed'].includes(canonicalStatusOf(request)) && ageHours > 24) {
      warnings.push({ warningId: `${request.deliveryId}-overdue`, deliveryId: request.deliveryId, title: 'Delivery overdue', shortReason: 'Delivery has been open for more than 24 hours.', severity: 'High', recommendedAction: 'Open the delivery and update assignment, tracking, or reschedule.', relatedRecordId: request.deliveryId });
    }
    if (['Dispatched', 'InTransit'].includes(canonicalStatusOf(request)) && request.trackingStatus === 'En Route' && ageHours > 2) {
      warnings.push({ warningId: `${request.deliveryId}-not-moving`, deliveryId: request.deliveryId, title: 'Driver not moving', shortReason: 'No recent tracking update has been recorded.', severity: 'Medium', recommendedAction: 'Contact driver or update route status.', relatedRecordId: request.deliveryId });
    }
    if (!['Code Verified', 'Verified'].includes(request.confirmationStatus) && ['Arrived', 'Delivered', 'AwaitingCashHandover'].includes(canonicalStatusOf(request))) {
      warnings.push({ warningId: `${request.deliveryId}-confirmation`, deliveryId: request.deliveryId, title: 'Customer confirmation missing', shortReason: 'Delivery reached customer stage without verified confirmation.', severity: 'High', recommendedAction: 'Verify the customer code or record approved override.', relatedRecordId: request.deliveryId });
    }
    if (request.proofStatus !== 'Captured' && ['Delivered', 'AwaitingCashHandover', 'Completed'].includes(canonicalStatusOf(request))) {
      warnings.push({ warningId: `${request.deliveryId}-proof`, deliveryId: request.deliveryId, title: 'Proof of delivery missing', shortReason: 'Delivery cannot close without proof.', severity: 'Critical', recommendedAction: 'Capture proof of delivery.', relatedRecordId: request.deliveryId });
    }
    if (request.cashToCollect > 0 && !cashHandoverSatisfied(request)) {
      warnings.push({ warningId: `${request.deliveryId}-cash`, deliveryId: request.deliveryId, title: 'Cash collected but not handed over', shortReason: 'Cash delivery is still waiting for vendor handover.', severity: 'Critical', recommendedAction: 'Open Cash Collection and accept handover.', relatedRecordId: request.deliveryId });
    }
    if (request.failureReason && request.deliveryStatus === 'Returned To Vendor') {
      warnings.push({ warningId: `${request.deliveryId}-returned`, deliveryId: request.deliveryId, title: 'Delivery returned with damage', shortReason: request.failureReason, severity: 'High', recommendedAction: 'Inspect returned items and post inventory workflow.', relatedRecordId: request.deliveryId });
    }
    return warnings;
  });
}

export async function createCustomerTrackingToken(deliveryId: string): Promise<string | null> {
  const request = await getDeliveryRequestById(deliveryId);
  if (!request) return null;
  return codeHash(`${request.deliveryId}:${request.customerPhone || request.customerWhatsapp}:${request.deliveryNumber}`);
}

export async function getCustomerDeliveryTrackingView(deliveryId: string, token: string): Promise<Record<string, unknown> | null> {
  const request = await getDeliveryRequestById(deliveryId);
  if (!request) return null;
  const expected = await createCustomerTrackingToken(deliveryId);
  if (!expected || expected !== token) return null;
  return {
    vendorName: request.branchName,
    deliveryNumber: request.deliveryNumber,
    deliveryStatus: canonicalStatusOf(request),
    estimatedArrival: request.deliveredAt ? undefined : 'Pending route update',
    driverName: request.driverName ? request.driverName.split(' ')[0] : undefined,
    confirmationInstructions: request.confirmationStatus === 'Code Sent' ? 'Share your confirmation code only after receiving goods.' : undefined,
    supportContact: request.customerPhone || request.customerWhatsapp
  };
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
  const request = await getDeliveryRequestById(deliveryId);
  return readList<DeliveryTrackingEvent>(TRACKING_KEY, mockDeliveryTrackingEvents, request?.vendorId).filter((event) => event.deliveryId === deliveryId);
}

export async function getDeliveryConfirmationCode(deliveryId: string): Promise<DeliveryConfirmationCode | undefined> {
  const request = await getDeliveryRequestById(deliveryId);
  return readList<DeliveryConfirmationCode>(CODE_KEY, mockDeliveryConfirmationCodes, request?.vendorId).find((row) => row.deliveryId === deliveryId);
}

export async function getDeliveryCashCollection(deliveryId: string): Promise<DeliveryCashCollection | undefined> {
  const request = await getDeliveryRequestById(deliveryId);
  return readList<DeliveryCashCollection>(CASH_KEY, mockDeliveryCashCollections, request?.vendorId).find((row) => row.deliveryId === deliveryId);
}

export async function getProofOfDelivery(deliveryId: string): Promise<ProofOfDeliveryRecord | undefined> {
  const request = await getDeliveryRequestById(deliveryId);
  return readList<ProofOfDeliveryRecord>(PROOF_KEY, [], request?.vendorId).find((row) => row.deliveryId === deliveryId);
}

export async function getDeliveryCashHandovers(deliveryId: string): Promise<DeliveryCashHandoverRecord[]> {
  const request = await getDeliveryRequestById(deliveryId);
  return readList<DeliveryCashHandoverRecord>(HANDOVER_KEY, [], request?.vendorId).filter((row) => row.deliveryId === deliveryId);
}

export async function getDeliveryWhatsAppMessageDrafts(deliveryId: string): Promise<DeliveryWhatsAppMessageDraft[]> {
  const request = await getDeliveryRequestById(deliveryId);
  return readList<DeliveryWhatsAppMessageDraft>(WHATSAPP_KEY, mockDeliveryWhatsAppMessageDrafts, request?.vendorId).filter((draft) => draft.deliveryId === deliveryId);
}

export async function getDeliveryPerformance(filters: DeliveryFilterState = {}): Promise<{
  bestPerformingTeam: string;
  delayedDeliveries: number;
  failedDeliveries: number;
  cashHandoverIssues: number;
  customerRatings: string;
}> {
  const rows = await getDeliveryRequests(filters);
  const warnings = await getDeliveryBIWarnings(filters);
  const completed = rows.filter((row) => canonicalStatusOf(row) === 'Completed').length;
  return {
    bestPerformingTeam: rows.find((row) => row.assignedTeamId || row.providerName)?.providerName || 'No completed team yet',
    delayedDeliveries: warnings.filter((warning) => warning.title === 'Delivery overdue' || warning.title === 'Driver not moving').length,
    failedDeliveries: rows.filter((row) => canonicalStatusOf(row) === 'DeliveryFailed').length,
    cashHandoverIssues: warnings.filter((warning) => warning.title.includes('Cash')).length,
    customerRatings: completed > 0 ? 'Customer rating capture pending' : 'No completed delivery ratings yet'
  };
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
