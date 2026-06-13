import {
  LocalTerminalSnapshot,
  NetworkStatus,
  OfflineSyncActivityEvent,
  OfflineSyncBatch,
  OfflineSyncConflict,
  OfflineSyncConflictDecision,
  OfflineSyncFilterState,
  OfflineSyncHealth,
  OfflineSyncQueueItem,
  SyncConflictResolution,
  SyncConflictType,
  SyncQueueStatus
} from '../types/posTypes';
import {
  mockLocalTerminalSnapshots,
  mockOfflineSyncActivityEvents,
  mockOfflineSyncBatches,
  mockOfflineSyncConflictDecisions,
  mockOfflineSyncConflicts,
  mockOfflineSyncHealth,
  mockOfflineSyncQueue
} from '../mock/mockPosData';
import {
  calculateSyncHealth,
  createPayloadHash,
  determineSyncPriority,
  generateQueueId,
  generateSyncBatchId
} from '../utils/offlineSyncUtils';

const QUEUE_KEY = 'itred_pos_offline_sync_queue_v1';
const BATCH_KEY = 'itred_pos_offline_sync_batches_v1';
const CONFLICT_KEY = 'itred_pos_offline_sync_conflicts_v1';
const DECISION_KEY = 'itred_pos_offline_sync_decisions_v1';
const HEALTH_KEY = 'itred_pos_offline_sync_health_v1';
const ACTIVITY_KEY = 'itred_pos_offline_sync_activity_v1';
const SNAPSHOT_KEY = 'itred_pos_offline_terminal_snapshots_v1';
const NETWORK_KEY = 'itred_pos_network_status_placeholder_v1';

let ramQueue = [...mockOfflineSyncQueue];
let ramBatches = [...mockOfflineSyncBatches];
let ramConflicts = [...mockOfflineSyncConflicts];
let ramDecisions = [...mockOfflineSyncConflictDecisions];
let ramHealth = [...mockOfflineSyncHealth];
let ramActivity = [...mockOfflineSyncActivityEvents];
let ramSnapshots = [...mockLocalTerminalSnapshots];
let ramNetworkStatus: NetworkStatus = 'Online';

function canUseStorage(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    const key = '__itred_sync_storage_test__';
    localStorage.setItem(key, '1');
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function readStore<T>(key: string, fallback: T[], ram: T[]): T[] {
  if (!canUseStorage()) return ram;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(fallback));
      return [...fallback];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [...fallback];
  } catch {
    return [...fallback];
  }
}

function writeStore<T>(key: string, value: T[], assignRam: (next: T[]) => void): void {
  assignRam(value);
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Keep in-memory state for build-development if storage is full or unavailable.
  }
}

function queue(): OfflineSyncQueueItem[] {
  return readStore(QUEUE_KEY, mockOfflineSyncQueue, ramQueue);
}

function saveQueue(next: OfflineSyncQueueItem[]): void {
  writeStore(QUEUE_KEY, next, (value) => { ramQueue = value; });
}

function batches(): OfflineSyncBatch[] {
  return readStore(BATCH_KEY, mockOfflineSyncBatches, ramBatches);
}

function saveBatches(next: OfflineSyncBatch[]): void {
  writeStore(BATCH_KEY, next, (value) => { ramBatches = value; });
}

function conflicts(): OfflineSyncConflict[] {
  return readStore(CONFLICT_KEY, mockOfflineSyncConflicts, ramConflicts);
}

function saveConflicts(next: OfflineSyncConflict[]): void {
  writeStore(CONFLICT_KEY, next, (value) => { ramConflicts = value; });
}

function decisions(): OfflineSyncConflictDecision[] {
  return readStore(DECISION_KEY, mockOfflineSyncConflictDecisions, ramDecisions);
}

function saveDecisions(next: OfflineSyncConflictDecision[]): void {
  writeStore(DECISION_KEY, next, (value) => { ramDecisions = value; });
}

function health(): OfflineSyncHealth[] {
  return readStore(HEALTH_KEY, mockOfflineSyncHealth, ramHealth);
}

function saveHealth(next: OfflineSyncHealth[]): void {
  writeStore(HEALTH_KEY, next, (value) => { ramHealth = value; });
}

function activity(): OfflineSyncActivityEvent[] {
  return readStore(ACTIVITY_KEY, mockOfflineSyncActivityEvents, ramActivity);
}

function saveActivity(next: OfflineSyncActivityEvent[]): void {
  writeStore(ACTIVITY_KEY, next, (value) => { ramActivity = value; });
}

function snapshots(): LocalTerminalSnapshot[] {
  return readStore(SNAPSHOT_KEY, mockLocalTerminalSnapshots, ramSnapshots);
}

function addActivity(event: Omit<OfflineSyncActivityEvent, 'eventId' | 'createdAt'>): OfflineSyncActivityEvent {
  const nextEvent: OfflineSyncActivityEvent = {
    eventId: `SYNC-ACT-${String(activity().length + 1).padStart(4, '0')}`,
    createdAt: new Date().toISOString(),
    ...event
  };
  saveActivity([nextEvent, ...activity()]);
  return nextEvent;
}

function matchesFilters(item: OfflineSyncQueueItem, filters?: OfflineSyncFilterState): boolean {
  if (!filters) return true;
  if (filters.entityType && filters.entityType !== 'ALL' && item.entityType !== filters.entityType) return false;
  if (filters.status && filters.status !== 'ALL' && item.status !== filters.status) return false;
  if (filters.priority && filters.priority !== 'ALL' && item.priority !== filters.priority) return false;
  if (filters.branchId && filters.branchId !== 'ALL' && item.branchId !== filters.branchId) return false;
  if (filters.terminalId && filters.terminalId !== 'ALL' && item.terminalId !== filters.terminalId) return false;
  if (filters.staffId && filters.staffId !== 'ALL' && item.staffId !== filters.staffId) return false;
  if (filters.dateFrom && item.queuedAt.slice(0, 10) < filters.dateFrom) return false;
  if (filters.dateTo && item.queuedAt.slice(0, 10) > filters.dateTo) return false;
  if (filters.searchReference) {
    const haystack = `${item.queueId} ${item.entityId} ${item.entityNumber || ''} ${item.operationType} ${item.staffName}`.toLowerCase();
    if (!haystack.includes(filters.searchReference.toLowerCase())) return false;
  }
  return true;
}

export async function getNetworkStatus(): Promise<NetworkStatus> {
  if (!canUseStorage()) return ramNetworkStatus;
  try {
    const stored = localStorage.getItem(NETWORK_KEY) as NetworkStatus | null;
    return stored || 'Online';
  } catch {
    return 'Unknown';
  }
}

export async function setNetworkStatusPlaceholder(status: NetworkStatus): Promise<NetworkStatus> {
  ramNetworkStatus = status;
  if (canUseStorage()) {
    try {
      localStorage.setItem(NETWORK_KEY, status);
    } catch {
      // In-memory status remains available.
    }
  }
  return status;
}

export async function getOfflineSyncQueue(filters?: OfflineSyncFilterState): Promise<OfflineSyncQueueItem[]> {
  return queue().filter((item) => matchesFilters(item, filters));
}

export async function getOfflineSyncQueueItem(queueId: string): Promise<OfflineSyncQueueItem | undefined> {
  return queue().find((item) => item.queueId === queueId);
}

export async function enqueueOfflineAction(payload: Partial<OfflineSyncQueueItem> & Pick<OfflineSyncQueueItem, 'vendorId' | 'branchId' | 'terminalId' | 'staffId' | 'staffName' | 'entityType' | 'entityId' | 'operationType' | 'payload'>): Promise<OfflineSyncQueueItem> {
  const now = new Date().toISOString();
  const item: OfflineSyncQueueItem = {
    queueId: payload.queueId || generateQueueId(),
    vendorId: payload.vendorId,
    branchId: payload.branchId,
    terminalId: payload.terminalId,
    staffId: payload.staffId,
    staffName: payload.staffName,
    entityType: payload.entityType,
    entityId: payload.entityId,
    entityNumber: payload.entityNumber,
    operationType: payload.operationType,
    payload: payload.payload,
    payloadHash: payload.payloadHash || createPayloadHash(payload.payload),
    localVersion: payload.localVersion || 1,
    remoteVersion: payload.remoteVersion,
    priority: payload.priority || determineSyncPriority(payload.entityType, payload.operationType),
    status: payload.status || 'Queued',
    retryCount: payload.retryCount || 0,
    lastError: payload.lastError,
    conflictId: payload.conflictId,
    queuedAt: payload.queuedAt || now,
    lastAttemptAt: payload.lastAttemptAt,
    syncedAt: payload.syncedAt,
    notes: payload.notes
  };
  saveQueue([item, ...queue()]);
  addActivity({ eventType: 'OFFLINE_ACTION_QUEUED', queueId: item.queueId, message: `${item.entityType} queued locally for placeholder sync.`, staffId: item.staffId, staffName: item.staffName, terminalId: item.terminalId, branchId: item.branchId });
  return item;
}

export async function updateQueueItem(queueId: string, patch: Partial<OfflineSyncQueueItem>): Promise<OfflineSyncQueueItem | undefined> {
  let updated: OfflineSyncQueueItem | undefined;
  saveQueue(queue().map((item) => {
    if (item.queueId !== queueId) return item;
    updated = { ...item, ...patch };
    return updated;
  }));
  return updated;
}

export async function cancelQueueItem(queueId: string, staffId: string, reason: string): Promise<OfflineSyncQueueItem | undefined> {
  const item = await updateQueueItem(queueId, { status: 'Cancelled', notes: reason });
  if (item) addActivity({ eventType: 'SYNC_ITEM_CANCELLED', queueId, message: `Queue item cancelled locally. Reason: ${reason}`, staffId, terminalId: item.terminalId, branchId: item.branchId });
  return item;
}

export async function createSyncBatch(filters: OfflineSyncFilterState | undefined, staffId: string): Promise<OfflineSyncBatch> {
  const items = queue().filter((item) => matchesFilters(item, filters) && ['Queued', 'Ready To Sync', 'Failed'].includes(item.status));
  const first = items[0] || queue()[0];
  const batch: OfflineSyncBatch = {
    batchId: generateSyncBatchId(),
    vendorId: first?.vendorId || 'SCI-LOG-ZW',
    branchId: filters?.branchId && filters.branchId !== 'ALL' ? filters.branchId : first?.branchId || 'BR-HARARE',
    terminalId: filters?.terminalId && filters.terminalId !== 'ALL' ? filters.terminalId : first?.terminalId || 'POS-01',
    createdByStaffId: staffId,
    createdByStaffName: staffId,
    itemCount: items.length,
    highPriorityCount: items.filter((item) => item.priority === 'High' || item.priority === 'Critical').length,
    failedCount: items.filter((item) => item.status === 'Failed').length,
    conflictCount: items.filter((item) => item.status === 'Conflict').length,
    status: 'Queued',
    createdAt: new Date().toISOString(),
    notes: 'Local placeholder batch. No backend sync will run.'
  };
  saveBatches([batch, ...batches()]);
  addActivity({ eventType: 'SYNC_BATCH_CREATED', batchId: batch.batchId, message: `Local sync batch created with ${batch.itemCount} item(s).`, staffId, terminalId: batch.terminalId, branchId: batch.branchId });
  return batch;
}

export async function getSyncBatches(filters?: OfflineSyncFilterState): Promise<OfflineSyncBatch[]> {
  return batches().filter((batch) => (!filters?.branchId || filters.branchId === 'ALL' || batch.branchId === filters.branchId) && (!filters?.terminalId || filters.terminalId === 'ALL' || batch.terminalId === filters.terminalId));
}

export async function prepareSyncBatch(batchId: string): Promise<OfflineSyncBatch | undefined> {
  let updated: OfflineSyncBatch | undefined;
  saveBatches(batches().map((batch) => {
    if (batch.batchId !== batchId) return batch;
    updated = { ...batch, status: 'Ready To Sync', notes: 'Prepared locally. Backend sync intentionally disabled.' };
    return updated;
  }));
  if (updated) addActivity({ eventType: 'SYNC_BATCH_PREPARED', batchId, message: 'Sync batch prepared locally. No backend connection used.', staffId: updated.createdByStaffId, terminalId: updated.terminalId, branchId: updated.branchId });
  return updated;
}

export async function runSyncBatchPlaceholder(batchId: string, staffId: string): Promise<OfflineSyncBatch | undefined> {
  const batch = batches().find((item) => item.batchId === batchId);
  if (!batch) return undefined;
  const now = new Date().toISOString();
  saveQueue(queue().map((item) => {
    if (item.branchId !== batch.branchId || item.terminalId !== batch.terminalId) return item;
    if (item.status === 'Ready To Sync') return { ...item, status: 'Synced' as SyncQueueStatus, lastAttemptAt: now, syncedAt: now, notes: 'Synced placeholder. No backend call made.' };
    if (item.status === 'Queued') return { ...item, status: 'Ready To Sync' as SyncQueueStatus, lastAttemptAt: now };
    return item;
  }));
  let updated: OfflineSyncBatch | undefined;
  saveBatches(batches().map((item) => {
    if (item.batchId !== batchId) return item;
    updated = { ...item, status: 'Synced', completedAt: now, notes: 'Run Sync Placeholder completed locally. Failed and conflict items remain reviewable.' };
    return updated;
  }));
  addActivity({ eventType: 'SYNC_BATCH_RUN_PLACEHOLDER', batchId, message: 'Sync batch placeholder run completed locally. No backend call made.', staffId, terminalId: batch.terminalId, branchId: batch.branchId });
  return updated;
}

export async function retryQueueItem(queueId: string, staffId: string): Promise<OfflineSyncQueueItem | undefined> {
  const item = queue().find((row) => row.queueId === queueId);
  if (!item || item.status === 'Synced' || item.status === 'Conflict') return item;
  const updated = await updateQueueItem(queueId, { status: 'Ready To Sync', retryCount: item.retryCount + 1, lastAttemptAt: new Date().toISOString(), lastError: undefined });
  if (updated) addActivity({ eventType: 'SYNC_ITEM_RETRIED', queueId, message: `Retry placeholder prepared. Retry count is ${updated.retryCount}.`, staffId, terminalId: item.terminalId, branchId: item.branchId });
  return updated;
}

export async function retryFailedItems(filters: OfflineSyncFilterState | undefined, staffId: string): Promise<OfflineSyncQueueItem[]> {
  const failed = queue().filter((item) => item.status === 'Failed' && matchesFilters(item, filters));
  for (const item of failed) {
    await retryQueueItem(item.queueId, staffId);
  }
  return getOfflineSyncQueue(filters);
}

export async function markQueueItemSyncedPlaceholder(queueId: string, staffId: string): Promise<OfflineSyncQueueItem | undefined> {
  const item = await updateQueueItem(queueId, { status: 'Synced', lastAttemptAt: new Date().toISOString(), syncedAt: new Date().toISOString(), notes: 'Marked synced locally as placeholder. No backend call made.' });
  if (item) addActivity({ eventType: 'SYNC_ITEM_SYNCED_PLACEHOLDER', queueId, message: 'Queue item marked synced placeholder only.', staffId, terminalId: item.terminalId, branchId: item.branchId });
  return item;
}

export async function markQueueItemFailed(queueId: string, staffId: string, error: string): Promise<OfflineSyncQueueItem | undefined> {
  const current = queue().find((item) => item.queueId === queueId);
  const item = await updateQueueItem(queueId, { status: 'Failed', retryCount: (current?.retryCount || 0) + 1, lastAttemptAt: new Date().toISOString(), lastError: error });
  if (item) addActivity({ eventType: 'SYNC_ITEM_FAILED', queueId, message: `Queue item failed locally: ${error}`, staffId, terminalId: item.terminalId, branchId: item.branchId });
  return item;
}

export async function detectSyncConflict(queueItem: OfflineSyncQueueItem): Promise<OfflineSyncConflict> {
  const conflictType: SyncConflictType = queueItem.entityType === 'Stock Adjustment' ? 'Stock Quantity Conflict' : queueItem.entityType === 'Customer Request' ? 'Customer Duplicate' : queueItem.entityType === 'Shift Session' ? 'Shift Closed Remotely' : 'Version Mismatch';
  const conflict: OfflineSyncConflict = {
    conflictId: `SYNC-CF-${String(conflicts().length + 1).padStart(4, '0')}`,
    queueId: queueItem.queueId,
    vendorId: queueItem.vendorId,
    branchId: queueItem.branchId,
    terminalId: queueItem.terminalId,
    entityType: queueItem.entityType,
    entityId: queueItem.entityId,
    entityNumber: queueItem.entityNumber,
    conflictType,
    localPayload: queueItem.payload,
    remotePayload: { placeholder: 'Remote payload will be loaded after backend sync is connected.' },
    localVersion: queueItem.localVersion,
    remoteVersion: queueItem.remoteVersion || queueItem.localVersion + 1,
    detectedAt: new Date().toISOString(),
    status: 'Conflict',
    recommendedResolution: conflictType === 'Customer Duplicate' ? 'Merge' : 'Manual Review Required',
    riskLevel: queueItem.priority === 'Critical' ? 'Critical' : queueItem.priority === 'High' ? 'High' : 'Medium',
    notes: 'Detected locally by placeholder conflict scanner.'
  };
  saveConflicts([conflict, ...conflicts()]);
  await updateQueueItem(queueItem.queueId, { status: 'Conflict', conflictId: conflict.conflictId, lastError: conflict.conflictType });
  addActivity({ eventType: 'SYNC_CONFLICT_DETECTED', queueId: queueItem.queueId, conflictId: conflict.conflictId, message: `${conflict.conflictType} detected and held for review.`, staffId: queueItem.staffId, staffName: queueItem.staffName, terminalId: queueItem.terminalId, branchId: queueItem.branchId });
  return conflict;
}

export async function getSyncConflicts(filters?: OfflineSyncFilterState): Promise<OfflineSyncConflict[]> {
  return conflicts().filter((conflict) => {
    if (filters?.conflictType && filters.conflictType !== 'ALL' && conflict.conflictType !== filters.conflictType) return false;
    if (filters?.branchId && filters.branchId !== 'ALL' && conflict.branchId !== filters.branchId) return false;
    if (filters?.terminalId && filters.terminalId !== 'ALL' && conflict.terminalId !== filters.terminalId) return false;
    if (filters?.searchReference) {
      const haystack = `${conflict.conflictId} ${conflict.queueId} ${conflict.entityNumber || ''} ${conflict.entityId}`.toLowerCase();
      if (!haystack.includes(filters.searchReference.toLowerCase())) return false;
    }
    return true;
  });
}

export async function getSyncConflictById(conflictId: string): Promise<OfflineSyncConflict | undefined> {
  return conflicts().find((conflict) => conflict.conflictId === conflictId);
}

export async function resolveSyncConflict(conflictId: string, decisionPayload: { resolution: SyncConflictResolution; staffId: string; staffName: string; reason: string }): Promise<OfflineSyncConflict | undefined> {
  let updated: OfflineSyncConflict | undefined;
  saveConflicts(conflicts().map((conflict) => {
    if (conflict.conflictId !== conflictId) return conflict;
    updated = { ...conflict, status: decisionPayload.resolution === 'Hold For Review' ? 'Held For Review' : decisionPayload.resolution === 'Cancel Local' ? 'Cancelled' : 'Ready To Sync', recommendedResolution: decisionPayload.resolution, notes: decisionPayload.reason };
    return updated;
  }));
  if (!updated) return undefined;
  const decision: OfflineSyncConflictDecision = {
    decisionId: `SYNC-CD-${String(decisions().length + 1).padStart(4, '0')}`,
    conflictId,
    queueId: updated.queueId,
    resolution: decisionPayload.resolution,
    decidedByStaffId: decisionPayload.staffId,
    decidedByStaffName: decisionPayload.staffName,
    reason: decisionPayload.reason,
    decidedAt: new Date().toISOString()
  };
  saveDecisions([decision, ...decisions()]);
  await updateQueueItem(updated.queueId, { status: updated.status, notes: decisionPayload.reason });
  addActivity({ eventType: 'SYNC_CONFLICT_RESOLVED', queueId: updated.queueId, conflictId, message: `Conflict decision recorded: ${decisionPayload.resolution}.`, staffId: decisionPayload.staffId, staffName: decisionPayload.staffName, terminalId: updated.terminalId, branchId: updated.branchId });
  return updated;
}

export async function holdConflictForReview(conflictId: string, staffId: string, notes: string): Promise<OfflineSyncConflict | undefined> {
  const conflict = await getSyncConflictById(conflictId);
  if (!conflict) return undefined;
  const updated = await resolveSyncConflict(conflictId, { resolution: 'Hold For Review', staffId, staffName: staffId, reason: notes });
  addActivity({ eventType: 'SYNC_CONFLICT_HELD_FOR_REVIEW', queueId: conflict.queueId, conflictId, message: `Conflict held for review: ${notes}`, staffId, terminalId: conflict.terminalId, branchId: conflict.branchId });
  return updated;
}

export async function getOfflineSyncHealth(filters?: OfflineSyncFilterState): Promise<OfflineSyncHealth[]> {
  const items = queue();
  const current = health().map((row) => {
    const terminalItems = items.filter((item) => item.terminalId === row.terminalId);
    return {
      ...row,
      queueCount: terminalItems.filter((item) => item.status !== 'Synced' && item.status !== 'Cancelled').length,
      failedCount: terminalItems.filter((item) => item.status === 'Failed').length,
      conflictCount: terminalItems.filter((item) => item.status === 'Conflict').length,
      syncHealth: row.networkStatus === 'Offline' ? 'Offline' : calculateSyncHealth(terminalItems)
    };
  });
  saveHealth(current);
  return current.filter((row) => (!filters?.branchId || filters.branchId === 'ALL' || row.branchId === filters.branchId) && (!filters?.terminalId || filters.terminalId === 'ALL' || row.terminalId === filters.terminalId));
}

export async function getLocalTerminalSnapshot(terminalId: string): Promise<LocalTerminalSnapshot | undefined> {
  return snapshots().find((snapshot) => snapshot.terminalId === terminalId);
}

export async function getLocalTerminalSnapshots(filters?: OfflineSyncFilterState): Promise<LocalTerminalSnapshot[]> {
  return snapshots().filter((snapshot) => (!filters?.branchId || filters.branchId === 'ALL' || snapshot.branchId === filters.branchId) && (!filters?.terminalId || filters.terminalId === 'ALL' || snapshot.terminalId === filters.terminalId));
}

export async function clearSyncedItemsPlaceholder(filters: OfflineSyncFilterState | undefined, staffId: string): Promise<OfflineSyncQueueItem[]> {
  const retained = queue().filter((item) => !(item.status === 'Synced' && matchesFilters(item, filters)));
  saveQueue(retained);
  addActivity({ eventType: 'SYNC_ITEM_CANCELLED', message: 'Synced placeholder items cleared locally. Unsynced data was preserved.', staffId });
  return retained;
}

export async function exportSyncReportPlaceholder(filters?: OfflineSyncFilterState): Promise<string> {
  const report = {
    createdAt: new Date().toISOString(),
    note: 'Offline sync report placeholder. No backend data included.',
    queue: await getOfflineSyncQueue(filters),
    conflicts: await getSyncConflicts(filters),
    batches: await getSyncBatches(filters)
  };
  addActivity({ eventType: 'SYNC_REPORT_EXPORT_PREPARED', message: 'Sync report export placeholder prepared.' });
  return JSON.stringify(report, null, 2);
}

export async function getOfflineSyncActivityEvents(filters?: OfflineSyncFilterState): Promise<OfflineSyncActivityEvent[]> {
  return activity().filter((event) => (!filters?.branchId || filters.branchId === 'ALL' || event.branchId === filters.branchId) && (!filters?.terminalId || filters.terminalId === 'ALL' || event.terminalId === filters.terminalId));
}

export async function getOfflineSyncConflictDecisions(conflictId?: string): Promise<OfflineSyncConflictDecision[]> {
  return decisions().filter((decision) => !conflictId || decision.conflictId === conflictId);
}
