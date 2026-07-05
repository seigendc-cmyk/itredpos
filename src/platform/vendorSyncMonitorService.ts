import {
  collection,
  doc,
  getDoc,
  getDocs,
  writeBatch,
  type WriteBatch
} from 'firebase/firestore';
import { db, firebaseReady } from '../pos-new/firebase/firebaseApp';
import { FIRESTORE_COLLECTIONS } from '../shared/backend';
import type { VendorAuditLogRecord } from '../shared/backend';

export const VENDOR_SYNC_STATUSES = ['Synced', 'PendingSync', 'Failed', 'Offline', 'Unknown'] as const;
export type VendorSyncStatus = (typeof VENDOR_SYNC_STATUSES)[number];

export const VENDOR_SYNC_SEVERITIES = ['Info', 'Warning', 'Error', 'Critical'] as const;
export type VendorSyncSeverity = (typeof VENDOR_SYNC_SEVERITIES)[number];

type RawRecord = Record<string, unknown>;

export interface VendorSyncStatusSummary {
  vendorId: string;
  businessName: string;
  ownerName: string;
  ownerEmail: string;
  phone: string;
  whatsapp: string;
  syncStatus: VendorSyncStatus;
  lastSyncAt: string;
  lastPOSHeartbeatAt: string;
  lastConsoleUpdateAt: string;
  pendingWritesCount: number;
  failedWritesCount: number;
  lastError: string;
  reviewedAt: string;
  reviewedBy: string;
  latestEventAt?: string;
  latestSeverity?: VendorSyncSeverity;
  highestSeverity?: VendorSyncSeverity;
}

export interface VendorSyncEventRecord {
  syncEventId: string;
  vendorId: string;
  eventType: string;
  message: string;
  severity: VendorSyncSeverity;
  createdAt: string;
  updatedAt: string;
  performedBy?: string;
}

export interface VendorSyncRetryResult {
  vendorId: string;
  rebuiltCollections: string[];
  auditLogId: string;
  syncEventId: string;
}

function checkFirebaseReady(): void {
  if (!firebaseReady || !db) {
    throw new Error('Firebase client is not initialized or database is unavailable.');
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function text(value: unknown, fallback = ''): string {
  const clean = String(value ?? '').trim();
  return clean || fallback;
}

function numberValue(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : fallback;
}

function normalizeStatus(value: unknown): VendorSyncStatus {
  const clean = text(value).replace(/\s+/g, '').toLowerCase();
  if (clean === 'synced') return 'Synced';
  if (clean === 'pendingsync' || clean === 'pending') return 'PendingSync';
  if (clean === 'failed' || clean === 'error') return 'Failed';
  if (clean === 'offline') return 'Offline';
  return 'Unknown';
}

function normalizeSeverity(value: unknown): VendorSyncSeverity {
  const clean = text(value).toLowerCase();
  if (clean === 'critical') return 'Critical';
  if (clean === 'error') return 'Error';
  if (clean === 'warning' || clean === 'warn') return 'Warning';
  return 'Info';
}

function severityRank(value?: VendorSyncSeverity): number {
  if (value === 'Critical') return 4;
  if (value === 'Error') return 3;
  if (value === 'Warning') return 2;
  if (value === 'Info') return 1;
  return 0;
}

function latestIso(left?: string, right?: string): string {
  const cleanLeft = text(left);
  const cleanRight = text(right);
  if (!cleanLeft) return cleanRight;
  if (!cleanRight) return cleanLeft;

  const leftTime = Date.parse(cleanLeft);
  const rightTime = Date.parse(cleanRight);
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) {
    return rightTime > leftTime ? cleanRight : cleanLeft;
  }
  return cleanRight.localeCompare(cleanLeft) > 0 ? cleanRight : cleanLeft;
}

function isOfflineHeartbeat(value: string): boolean {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return false;
  const oneDayMs = 24 * 60 * 60 * 1000;
  return Date.now() - parsed > oneDayMs;
}

function vendorNameFromData(data: RawRecord): string {
  return text(data.businessName, text(data.tradingName, text(data.legalName, text(data.vendorName))));
}

function ownerNameFromData(data: RawRecord): string {
  return text(data.ownerName, text(data.contactName, text(data.representativeName)));
}

function ownerEmailFromData(data: RawRecord): string {
  return text(data.ownerEmail, text(data.googleEmail, text(data.email)));
}

function emptySummary(vendorId: string): VendorSyncStatusSummary {
  return {
    vendorId,
    businessName: vendorId,
    ownerName: '',
    ownerEmail: '',
    phone: '',
    whatsapp: '',
    syncStatus: 'Unknown',
    lastSyncAt: '',
    lastPOSHeartbeatAt: '',
    lastConsoleUpdateAt: '',
    pendingWritesCount: 0,
    failedWritesCount: 0,
    lastError: '',
    reviewedAt: '',
    reviewedBy: ''
  };
}

function getOrCreateSummary(summaries: Map<string, VendorSyncStatusSummary>, vendorId: string): VendorSyncStatusSummary {
  const cleanVendorId = text(vendorId);
  const current = summaries.get(cleanVendorId);
  if (current) return current;
  const next = emptySummary(cleanVendorId);
  summaries.set(cleanVendorId, next);
  return next;
}

function mergeVendorFields(summary: VendorSyncStatusSummary, data: RawRecord): void {
  const businessName = vendorNameFromData(data);
  if (businessName) summary.businessName = businessName;

  const ownerName = ownerNameFromData(data);
  if (ownerName) summary.ownerName = ownerName;

  const ownerEmail = ownerEmailFromData(data);
  if (ownerEmail) summary.ownerEmail = ownerEmail;

  const phone = text(data.phone, text(data.mobile));
  if (phone) summary.phone = phone;

  const whatsapp = text(data.whatsapp, text(data.whatsApp));
  if (whatsapp) summary.whatsapp = whatsapp;
}

function mergeSyncFields(summary: VendorSyncStatusSummary, data: RawRecord): void {
  const syncStatus = normalizeStatus(text(data.syncStatus, text(data.syncState)));
  if (syncStatus !== 'Unknown') summary.syncStatus = syncStatus;

  summary.lastSyncAt = latestIso(summary.lastSyncAt, text(data.lastSyncAt, text(data.syncedAt)));
  summary.lastPOSHeartbeatAt = latestIso(
    summary.lastPOSHeartbeatAt,
    text(data.lastPOSHeartbeatAt, text(data.lastPosHeartbeatAt, text(data.lastHeartbeatAt)))
  );
  summary.lastConsoleUpdateAt = latestIso(
    summary.lastConsoleUpdateAt,
    text(data.lastConsoleUpdateAt, text(data.consoleUpdatedAt, text(data.updatedAt)))
  );
  summary.pendingWritesCount = Math.max(summary.pendingWritesCount, numberValue(data.pendingWritesCount));
  summary.failedWritesCount = Math.max(summary.failedWritesCount, numberValue(data.failedWritesCount));

  const lastError = text(data.lastError, text(data.syncError, text(data.errorMessage)));
  if (lastError) summary.lastError = lastError;

  const reviewedAt = text(data.reviewedAt);
  if (reviewedAt) summary.reviewedAt = reviewedAt;

  const reviewedBy = text(data.reviewedBy);
  if (reviewedBy) summary.reviewedBy = reviewedBy;
}

function finalizeSummary(summary: VendorSyncStatusSummary): VendorSyncStatusSummary {
  let syncStatus = summary.syncStatus;
  if (summary.failedWritesCount > 0 || summary.lastError) {
    syncStatus = syncStatus === 'Synced' ? 'Failed' : syncStatus;
  }
  if (syncStatus === 'Unknown') {
    if (summary.failedWritesCount > 0 || summary.lastError) syncStatus = 'Failed';
    else if (summary.pendingWritesCount > 0) syncStatus = 'PendingSync';
    else if (isOfflineHeartbeat(summary.lastPOSHeartbeatAt)) syncStatus = 'Offline';
    else if (summary.lastSyncAt) syncStatus = 'Synced';
  }
  if (syncStatus === 'Synced' && isOfflineHeartbeat(summary.lastPOSHeartbeatAt)) {
    syncStatus = 'Offline';
  }
  return { ...summary, syncStatus };
}

function eventStatus(eventType: string, severity: VendorSyncSeverity): VendorSyncStatus {
  const cleanType = eventType.toUpperCase();
  if (severity === 'Critical' || severity === 'Error') return 'Failed';
  if (severity === 'Warning') return 'PendingSync';
  if (cleanType.includes('OFFLINE')) return 'Offline';
  if (cleanType.includes('PENDING') || cleanType.includes('RETRY')) return 'PendingSync';
  if (cleanType.includes('SYNCED') || cleanType.includes('COMPLETED')) return 'Synced';
  return 'Unknown';
}

function mapEvent(rowId: string, data: RawRecord): VendorSyncEventRecord {
  const createdAt = text(data.createdAt, text(data.recordedAt));
  return {
    syncEventId: text(data.syncEventId, rowId),
    vendorId: text(data.vendorId),
    eventType: text(data.eventType, 'SYNC_EVENT'),
    message: text(data.message, 'Sync event recorded.'),
    severity: normalizeSeverity(data.severity),
    createdAt,
    updatedAt: text(data.updatedAt, createdAt),
    performedBy: text(data.performedBy) || undefined
  };
}

function mergeEvent(summary: VendorSyncStatusSummary, event: VendorSyncEventRecord): void {
  summary.latestEventAt = latestIso(summary.latestEventAt, event.createdAt);
  if (summary.latestEventAt === event.createdAt) {
    summary.latestSeverity = event.severity;
  }
  if (severityRank(event.severity) > severityRank(summary.highestSeverity)) {
    summary.highestSeverity = event.severity;
  }

  const nextStatus = eventStatus(event.eventType, event.severity);
  if (nextStatus !== 'Unknown') summary.syncStatus = nextStatus;
  if (event.severity === 'Error' || event.severity === 'Critical') {
    summary.lastError = event.message;
  }
}

function createAuditLogInBatch(batch: WriteBatch, vendorId: string, message: string, performedBy: string): string {
  const now = nowIso();
  const auditRef = doc(collection(db!, FIRESTORE_COLLECTIONS.vendorAuditLogs));
  const auditLog: VendorAuditLogRecord = {
    auditLogId: auditRef.id,
    vendorId,
    eventType: 'SYNC_RETRY_REQUESTED',
    message,
    performedBy,
    createdAt: now,
    updatedAt: now
  };
  batch.set(auditRef, auditLog);
  return auditRef.id;
}

function createSyncEventInBatch(
  batch: WriteBatch,
  vendorId: string,
  eventType: string,
  message: string,
  severity: VendorSyncSeverity,
  performedBy?: string
): VendorSyncEventRecord {
  const now = nowIso();
  const eventRef = doc(collection(db!, FIRESTORE_COLLECTIONS.vendorSyncEvents));
  const event: VendorSyncEventRecord = {
    syncEventId: eventRef.id,
    vendorId,
    eventType,
    message,
    severity,
    createdAt: now,
    updatedAt: now
  };
  if (performedBy) event.performedBy = performedBy;
  batch.set(eventRef, event);
  return event;
}

export async function listVendorSyncStatuses(): Promise<VendorSyncStatusSummary[]> {
  checkFirebaseReady();

  const [
    vendorSnapshot,
    registrationSnapshot,
    licenseSnapshot,
    planSnapshot,
    statusSnapshot,
    eventSnapshot
  ] = await Promise.all([
    getDocs(collection(db!, FIRESTORE_COLLECTIONS.vendors)),
    getDocs(collection(db!, FIRESTORE_COLLECTIONS.vendorRegistrations)),
    getDocs(collection(db!, FIRESTORE_COLLECTIONS.vendorLicenses)),
    getDocs(collection(db!, FIRESTORE_COLLECTIONS.vendorPlans)),
    getDocs(collection(db!, FIRESTORE_COLLECTIONS.vendorSyncStatus)),
    getDocs(collection(db!, FIRESTORE_COLLECTIONS.vendorSyncEvents))
  ]);

  const summaries = new Map<string, VendorSyncStatusSummary>();

  vendorSnapshot.docs.forEach((row) => {
    const data = row.data() as RawRecord;
    const summary = getOrCreateSummary(summaries, text(data.vendorId, row.id));
    mergeVendorFields(summary, data);
    mergeSyncFields(summary, data);
  });

  registrationSnapshot.docs.forEach((row) => {
    const data = row.data() as RawRecord;
    const summary = getOrCreateSummary(summaries, text(data.vendorId, row.id));
    mergeVendorFields(summary, data);
    mergeSyncFields(summary, data);
  });

  licenseSnapshot.docs.forEach((row) => {
    const data = row.data() as RawRecord;
    const summary = getOrCreateSummary(summaries, text(data.vendorId, row.id));
    mergeVendorFields(summary, data);
    summary.lastConsoleUpdateAt = latestIso(summary.lastConsoleUpdateAt, text(data.updatedAt));
  });

  planSnapshot.docs.forEach((row) => {
    const data = row.data() as RawRecord;
    const summary = getOrCreateSummary(summaries, text(data.vendorId, row.id));
    mergeVendorFields(summary, data);
    summary.lastConsoleUpdateAt = latestIso(summary.lastConsoleUpdateAt, text(data.updatedAt));
  });

  statusSnapshot.docs.forEach((row) => {
    const data = row.data() as RawRecord;
    const summary = getOrCreateSummary(summaries, text(data.vendorId, row.id));
    mergeVendorFields(summary, data);
    mergeSyncFields(summary, data);
  });

  eventSnapshot.docs.forEach((row) => {
    const event = mapEvent(row.id, row.data() as RawRecord);
    if (!event.vendorId) return;
    const summary = getOrCreateSummary(summaries, event.vendorId);
    mergeEvent(summary, event);
  });

  return Array.from(summaries.values())
    .map(finalizeSummary)
    .sort((a, b) => a.businessName.localeCompare(b.businessName));
}

export async function getVendorSyncStatus(vendorId: string): Promise<VendorSyncStatusSummary> {
  const cleanVendorId = text(vendorId);
  if (!cleanVendorId) throw new Error('Vendor is required.');
  const statuses = await listVendorSyncStatuses();
  return statuses.find((status) => status.vendorId === cleanVendorId) || emptySummary(cleanVendorId);
}

export async function listVendorSyncEvents(vendorId: string): Promise<VendorSyncEventRecord[]> {
  checkFirebaseReady();
  const cleanVendorId = text(vendorId);
  if (!cleanVendorId) throw new Error('Vendor is required.');

  const snapshot = await getDocs(collection(db!, FIRESTORE_COLLECTIONS.vendorSyncEvents));
  return snapshot.docs
    .map((row) => mapEvent(row.id, row.data() as RawRecord))
    .filter((event) => event.vendorId === cleanVendorId)
    .sort((a, b) => text(b.createdAt).localeCompare(text(a.createdAt)))
    .slice(0, 100);
}

export async function markVendorSyncReviewed(vendorId: string, reviewedBy: string): Promise<VendorSyncStatusSummary> {
  checkFirebaseReady();
  const cleanVendorId = text(vendorId);
  if (!cleanVendorId) throw new Error('Vendor is required.');

  const now = nowIso();
  const batch = writeBatch(db!);
  batch.set(doc(db!, FIRESTORE_COLLECTIONS.vendorSyncStatus, cleanVendorId), {
    vendorId: cleanVendorId,
    reviewedAt: now,
    reviewedBy: text(reviewedBy, 'Console Admin'),
    updatedAt: now
  }, { merge: true });
  createSyncEventInBatch(
    batch,
    cleanVendorId,
    'SYNC_REVIEWED',
    'Vendor sync status reviewed by Console.',
    'Info',
    text(reviewedBy, 'Console Admin')
  );
  await batch.commit();
  return getVendorSyncStatus(cleanVendorId);
}

export async function createVendorSyncEvent(
  vendorId: string,
  eventType: string,
  message: string,
  severity: VendorSyncSeverity
): Promise<VendorSyncEventRecord> {
  checkFirebaseReady();
  const cleanVendorId = text(vendorId);
  if (!cleanVendorId) throw new Error('Vendor is required.');

  const cleanEventType = text(eventType, 'SYNC_EVENT').toUpperCase();
  const cleanMessage = text(message, 'Sync event recorded.');
  const cleanSeverity = normalizeSeverity(severity);
  const now = nowIso();
  const batch = writeBatch(db!);
  const event = createSyncEventInBatch(batch, cleanVendorId, cleanEventType, cleanMessage, cleanSeverity);
  const nextStatus = eventStatus(cleanEventType, cleanSeverity);
  const statusPatch: RawRecord = {
    vendorId: cleanVendorId,
    lastConsoleUpdateAt: now,
    latestEventAt: now,
    updatedAt: now
  };
  if (nextStatus !== 'Unknown') statusPatch.syncStatus = nextStatus;
  if (cleanSeverity === 'Error' || cleanSeverity === 'Critical') statusPatch.lastError = cleanMessage;
  batch.set(doc(db!, FIRESTORE_COLLECTIONS.vendorSyncStatus, cleanVendorId), statusPatch, { merge: true });
  await batch.commit();
  return event;
}

export async function retryPendingVendorSync(vendorId: string, performedBy: string): Promise<VendorSyncRetryResult> {
  checkFirebaseReady();
  const cleanVendorId = text(vendorId);
  if (!cleanVendorId) throw new Error('Vendor is required.');

  const vendorRef = doc(db!, FIRESTORE_COLLECTIONS.vendors, cleanVendorId);
  const registrationRef = doc(db!, FIRESTORE_COLLECTIONS.vendorRegistrations, cleanVendorId);
  const licenseRef = doc(db!, FIRESTORE_COLLECTIONS.vendorLicenses, cleanVendorId);
  const planRef = doc(db!, FIRESTORE_COLLECTIONS.vendorPlans, cleanVendorId);

  const [vendorSnap, registrationSnap, licenseSnap, planSnap] = await Promise.all([
    getDoc(vendorRef),
    getDoc(registrationRef),
    getDoc(licenseRef),
    getDoc(planRef)
  ]);

  const now = nowIso();
  const batch = writeBatch(db!);
  const rebuiltCollections: string[] = [];

  if (vendorSnap.exists()) {
    batch.set(vendorRef, { vendorId: cleanVendorId, syncStatus: 'PendingSync', updatedAt: now }, { merge: true });
    rebuiltCollections.push(FIRESTORE_COLLECTIONS.vendors);
  }

  if (registrationSnap.exists()) {
    batch.set(registrationRef, { vendorId: cleanVendorId, syncStatus: 'PendingSync', updatedAt: now }, { merge: true });
    rebuiltCollections.push(FIRESTORE_COLLECTIONS.vendorRegistrations);
  }

  if (licenseSnap.exists()) {
    batch.set(licenseRef, { vendorId: cleanVendorId, updatedAt: now }, { merge: true });
    rebuiltCollections.push(FIRESTORE_COLLECTIONS.vendorLicenses);
  }

  if (planSnap.exists()) {
    batch.set(planRef, { vendorId: cleanVendorId, updatedAt: now }, { merge: true });
    rebuiltCollections.push(FIRESTORE_COLLECTIONS.vendorPlans);
  }

  if (rebuiltCollections.length === 0) {
    throw new Error('No local Firestore records exist for this vendor. Retry cannot rebuild missing data.');
  }

  batch.set(doc(db!, FIRESTORE_COLLECTIONS.vendorSyncStatus, cleanVendorId), {
    vendorId: cleanVendorId,
    syncStatus: 'PendingSync',
    lastConsoleUpdateAt: now,
    pendingWritesCount: rebuiltCollections.length,
    failedWritesCount: 0,
    updatedAt: now
  }, { merge: true });

  const performedByLabel = text(performedBy, 'Console Admin');
  const message = `Console sync retry requested. Existing records touched: ${rebuiltCollections.join(', ')}.`;
  const auditLogId = createAuditLogInBatch(batch, cleanVendorId, message, performedByLabel);
  const event = createSyncEventInBatch(batch, cleanVendorId, 'SYNC_RETRY_REQUESTED', message, 'Info', performedByLabel);

  await batch.commit();

  return {
    vendorId: cleanVendorId,
    rebuiltCollections,
    auditLogId,
    syncEventId: event.syncEventId
  };
}
