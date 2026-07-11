import type { BIEvent as LegacyBIEvent } from '../types/posTypes';
import { getActiveVendorId, readVendorScopedList, writeVendorScopedList } from '../utils/vendorDataMode';

export const BI_EVENT_TYPES = [
  'SALE_COMPLETED', 'SALE_VOIDED', 'SALE_RETURNED', 'HIGH_DISCOUNT_APPLIED', 'LOW_MARGIN_SALE', 'LARGE_SALE', 'SALES_DROP', 'SALES_SPIKE',
  'SHIFT_OPENED', 'SHIFT_CLOSED', 'CASH_VARIANCE_FOUND', 'CASH_SHORTAGE', 'CASH_OVERAGE', 'CASH_OUT_POSTED', 'SAFE_DROP_POSTED', 'BANK_DEPOSIT_PENDING', 'DRAWER_COUNT_OVERDUE',
  'GOODS_RECEIVED', 'LOW_STOCK', 'OUT_OF_STOCK', 'NEGATIVE_STOCK_RISK', 'STOCKTAKE_SUBMITTED', 'STOCKTAKE_VARIANCE', 'STOCK_ADJUSTMENT_POSTED', 'STOCK_LOSS_RECORDED', 'TRANSFER_SHORTAGE', 'INVENTORY_RECONCILIATION_FAILED', 'SLOW_MOVING_STOCK', 'EXPIRY_RISK',
  'CREDIT_LIMIT_EXCEEDED', 'CUSTOMER_OVERDUE', 'BROKEN_PROMISE_TO_PAY', 'CUSTOMER_PAYMENT_RECEIVED', 'CREDIT_APPLICATION_PENDING', 'CUSTOMER_RISK_INCREASED',
  'SUPPLIER_PAYMENT_DUE', 'SUPPLIER_PAYMENT_OVERDUE', 'DUPLICATE_SUPPLIER_INVOICE', 'SUPPLIER_CREDIT_LIMIT_NEAR', 'SUPPLIER_STATEMENT_DIFFERENCE', 'SUPPLIER_DELIVERY_OVERDUE', 'COST_INCREASE_DETECTED',
  'DELIVERY_ASSIGNED', 'DELIVERY_DISPATCHED', 'DELIVERY_DELAYED', 'DELIVERY_FAILED', 'DELIVERY_COMPLETED', 'DELIVERY_CASH_COLLECTED', 'DELIVERY_CASH_NOT_HANDED_OVER', 'DELIVERY_CASH_VARIANCE',
  'APPROVAL_PENDING', 'APPROVAL_OVERDUE', 'TASK_OVERDUE', 'STAFF_LOGIN_FAILED', 'STAFF_ACCESS_DISABLED', 'SYNC_PENDING', 'SYNC_FAILED', 'BUSINESS_DAY_LOCK_BLOCKED'
] as const;

export type BIEventType = typeof BI_EVENT_TYPES[number];
export type BISeverity = 'Info' | 'Low' | 'Medium' | 'High' | 'Critical';
export type BIProcessingStatus = 'Pending' | 'Processing' | 'Processed' | 'Failed' | 'RetryScheduled';

export interface CanonicalBIEvent {
  eventId: string;
  eventType: BIEventType;
  vendorId: string;
  branchId?: string;
  warehouseId?: string;
  terminalId?: string;
  staffId?: string;
  staffName?: string;
  sourceModule: string;
  sourceRecordType: string;
  sourceRecordId: string;
  occurredAt: string;
  severity: BISeverity;
  amount?: number;
  quantity?: number;
  dimensions: Record<string, string | number | boolean | null>;
  summary: string;
  metadata: Record<string, unknown>;
  processingStatus: BIProcessingStatus;
  processingResult?: string;
  failureReason?: string;
  retryCount?: number;
  createdAt: string;
}

export type CreateBIEventInput = Omit<CanonicalBIEvent, 'eventId' | 'vendorId' | 'occurredAt' | 'createdAt' | 'processingStatus' | 'dimensions' | 'metadata'> & {
  vendorId?: string;
  eventId?: string;
  occurredAt?: string;
  dimensions?: CanonicalBIEvent['dimensions'];
  metadata?: CanonicalBIEvent['metadata'];
};

const BI_EVENTS_KEY = 'itred_pos_bi_events_v2';
const OFFLINE_QUEUE_KEY = 'itred_pos_bi_event_outbox_v1';

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function createDeterministicBIEventId(input: Pick<CreateBIEventInput, 'eventType' | 'sourceModule' | 'sourceRecordType' | 'sourceRecordId' | 'vendorId'>): string {
  const vendorId = input.vendorId || getActiveVendorId();
  return `BIE-${stableHash([vendorId, input.eventType, input.sourceModule, input.sourceRecordType, input.sourceRecordId].join('|'))}`;
}

function assertScoped(input: CreateBIEventInput): string {
  const activeVendorId = getActiveVendorId();
  const vendorId = input.vendorId || activeVendorId;
  if (!vendorId || vendorId === 'unassigned-vendor') throw new Error('A valid vendor is required to record business intelligence events.');
  if (input.vendorId && activeVendorId !== 'unassigned-vendor' && input.vendorId !== activeVendorId) throw new Error('Cross-vendor BI event access is not allowed.');
  if (!input.sourceRecordId || !input.sourceRecordType || !input.sourceModule) throw new Error('BI events require source record references.');
  return vendorId;
}

export function getCanonicalBIEvents(vendorId = getActiveVendorId()): CanonicalBIEvent[] {
  return readVendorScopedList<CanonicalBIEvent>(BI_EVENTS_KEY, [], vendorId).filter((event) => event.vendorId === vendorId);
}

export function captureBIEvent(input: CreateBIEventInput, options: { offline?: boolean } = {}): CanonicalBIEvent {
  const vendorId = assertScoped(input);
  const eventId = input.eventId || createDeterministicBIEventId({ ...input, vendorId });
  const existing = getCanonicalBIEvents(vendorId).find((event) => event.eventId === eventId);
  if (existing) return existing;
  const timestamp = new Date().toISOString();
  const event: CanonicalBIEvent = {
    ...input,
    eventId,
    vendorId,
    occurredAt: input.occurredAt || timestamp,
    severity: input.severity || 'Info',
    dimensions: input.dimensions || {},
    metadata: input.metadata || {},
    processingStatus: 'Pending',
    createdAt: timestamp
  };
  writeVendorScopedList(BI_EVENTS_KEY, [...getCanonicalBIEvents(vendorId), event], vendorId);
  if (options.offline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    const queue = readVendorScopedList<CanonicalBIEvent>(OFFLINE_QUEUE_KEY, [], vendorId);
    if (!queue.some((item) => item.eventId === eventId)) writeVendorScopedList(OFFLINE_QUEUE_KEY, [...queue, event], vendorId);
  }
  return event;
}

export function updateBIEventProcessing(eventId: string, status: BIProcessingStatus, result?: string, vendorId = getActiveVendorId()): CanonicalBIEvent | null {
  let updated: CanonicalBIEvent | null = null;
  const events = getCanonicalBIEvents(vendorId).map((event) => {
    if (event.eventId !== eventId) return event;
    updated = { ...event, processingStatus: status, processingResult: status === 'Processed' ? result : event.processingResult, failureReason: status === 'Failed' || status === 'RetryScheduled' ? result : undefined, retryCount: status === 'RetryScheduled' ? (event.retryCount || 0) + 1 : event.retryCount };
    return updated;
  });
  writeVendorScopedList(BI_EVENTS_KEY, events, vendorId);
  return updated;
}

export function getOfflineBIEventQueue(vendorId = getActiveVendorId()): CanonicalBIEvent[] {
  return readVendorScopedList<CanonicalBIEvent>(OFFLINE_QUEUE_KEY, [], vendorId).filter((event) => event.vendorId === vendorId);
}

export function acknowledgeSyncedBIEvents(eventIds: string[], vendorId = getActiveVendorId()): CanonicalBIEvent[] {
  const ids = new Set(eventIds);
  return writeVendorScopedList(OFFLINE_QUEUE_KEY, getOfflineBIEventQueue(vendorId).filter((event) => !ids.has(event.eventId)), vendorId);
}

// Compatibility facade for existing screens. New transaction code should use captureBIEvent.
export const biEventService = {
  getBIEvents: async (): Promise<LegacyBIEvent[]> => getCanonicalBIEvents().map((event) => ({ id: event.eventId, eventType: event.eventType, timestamp: event.occurredAt, severity: event.severity, operator: event.staffName || 'System', terminal: event.terminalId || 'Business Intelligence', payload: { ...event.dimensions, summary: event.summary, status: event.processingStatus } } as unknown as LegacyBIEvent)),
  getBiEvents: async (): Promise<LegacyBIEvent[]> => biEventService.getBIEvents(),
  recordBIEvent: async (event: Omit<LegacyBIEvent, 'id' | 'timestamp'>): Promise<LegacyBIEvent> => {
    const payload = (event.payload || {}) as Record<string, unknown>;
    const sourceRecordId = String(payload.sourceRecordId || payload.recordId || stableHash(JSON.stringify(payload)));
    const canonical = captureBIEvent({ eventType: event.eventType as BIEventType, sourceModule: String(payload.sourceModule || 'POS'), sourceRecordType: String(payload.sourceRecordType || 'LegacyRecord'), sourceRecordId, severity: normalizeSeverity(event.severity), summary: String(payload.summary || event.eventType), metadata: payload });
    return { ...event, id: canonical.eventId, timestamp: canonical.occurredAt } as LegacyBIEvent;
  },
  createBiEvent: async (event: Omit<LegacyBIEvent, 'id' | 'timestamp'>): Promise<LegacyBIEvent> => biEventService.recordBIEvent(event),
  updateBIEventStatus: async (eventId: string, status: string): Promise<LegacyBIEvent | null> => {
    const updated = updateBIEventProcessing(eventId, normalizeProcessingStatus(status), status);
    return updated ? { id: updated.eventId, eventType: updated.eventType, timestamp: updated.occurredAt, severity: updated.severity, operator: updated.staffName || 'System', terminal: updated.terminalId || 'Business Intelligence', payload: { status: updated.processingStatus } } as unknown as LegacyBIEvent : null;
  }
};

function normalizeSeverity(value: unknown): BISeverity {
  const label = String(value || 'Info').toLowerCase();
  if (label === 'critical') return 'Critical';
  if (label === 'high' || label === 'warning') return 'High';
  if (label === 'medium') return 'Medium';
  if (label === 'low') return 'Low';
  return 'Info';
}

function normalizeProcessingStatus(value: string): BIProcessingStatus {
  const match = ['Pending', 'Processing', 'Processed', 'Failed', 'RetryScheduled'].find((status) => status.toLowerCase() === value.toLowerCase());
  return (match || 'Processed') as BIProcessingStatus;
}
