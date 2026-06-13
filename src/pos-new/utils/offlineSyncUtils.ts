import {
  LocalTerminalSnapshot,
  OfflineSyncHealthStatus,
  OfflineSyncQueueItem,
  SyncEntityType,
  SyncPriority,
  SyncQueueStatus
} from '../types/posTypes';

function stableStringify(value: unknown, seen = new WeakSet<object>()): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (seen.has(value as object)) return '"[Circular]"';
  seen.add(value as object);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item, seen)).join(',')}]`;
  const source = value as Record<string, unknown>;
  return `{${Object.keys(source).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(source[key], seen)}`).join(',')}}`;
}

export function createPayloadHash(payload: unknown): string {
  const raw = stableStringify(payload);
  let hash = 0;
  for (let index = 0; index < raw.length; index += 1) {
    hash = ((hash << 5) - hash + raw.charCodeAt(index)) | 0;
  }
  return `HASH-${Math.abs(hash).toString(16).toUpperCase().padStart(8, '0')}`;
}

export function generateQueueId(): string {
  return `SYNC-Q-${String(Date.now()).slice(-6)}-${Math.floor(Math.random() * 90 + 10)}`;
}

export function generateSyncBatchId(): string {
  return `SYNC-B-${String(Date.now()).slice(-6)}-${Math.floor(Math.random() * 90 + 10)}`;
}

export function determineSyncPriority(entityType: SyncEntityType, operationType: string): SyncPriority {
  const operation = operationType.toUpperCase();
  if (entityType === 'Payment' || operation.includes('SHIFT') || operation.includes('CONFLICT')) return 'Critical';
  if (entityType === 'Sale' || entityType === 'Receipt' || entityType === 'Stock Adjustment' || entityType === 'Stock Transfer') return 'High';
  if (entityType === 'Delivery Request' || entityType === 'Customer Request' || entityType === 'Approval Request') return 'Normal';
  return 'Low';
}

export function formatSyncStatus(status: SyncQueueStatus): string {
  return status;
}

export function formatSyncEntityType(entityType: SyncEntityType): string {
  return entityType;
}

export function calculateSyncHealth(queueItems: OfflineSyncQueueItem[]): OfflineSyncHealthStatus {
  if (queueItems.some((item) => item.priority === 'Critical' && (item.status === 'Conflict' || item.status === 'Failed'))) return 'Critical';
  if (queueItems.some((item) => item.status === 'Conflict' || item.status === 'Failed' || item.status === 'Held For Review')) return 'Warning';
  if (queueItems.length === 0) return 'Healthy';
  return queueItems.every((item) => item.status === 'Synced') ? 'Healthy' : 'Warning';
}

export function detectPotentialConflict(queueItem: OfflineSyncQueueItem, localSnapshot?: LocalTerminalSnapshot): string | null {
  if (queueItem.status === 'Conflict' || queueItem.conflictId) return queueItem.conflictId || 'Existing conflict';
  if (queueItem.entityType === 'Receipt' && queueItem.entityNumber?.includes('DUP')) return 'Duplicate receipt number risk';
  if (queueItem.entityType === 'Stock Adjustment' && queueItem.remoteVersion && queueItem.remoteVersion > queueItem.localVersion) return 'Remote stock version is newer';
  if (queueItem.entityType === 'Shift Session' && localSnapshot?.openShiftId && queueItem.operationType.includes('CLOSE')) return 'Shift close requires remote state review';
  return null;
}

export function isRetryAllowed(queueItem: OfflineSyncQueueItem): boolean {
  return queueItem.status === 'Failed' || queueItem.status === 'Queued' || queueItem.status === 'Ready To Sync';
}

export function getNextRetryDelay(retryCount: number): number {
  return Math.min(30, Math.max(1, 2 ** retryCount));
}

export function sanitizePayloadForDisplay(payload: unknown): Record<string, unknown> {
  try {
    const raw = JSON.parse(stableStringify(payload)) as Record<string, unknown>;
    const sensitiveKeys = ['password', 'pass', 'token', 'secret', 'cardNumber', 'pin'];
    Object.keys(raw).forEach((key) => {
      if (sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive.toLowerCase()))) {
        raw[key] = '[Hidden]';
      }
    });
    return raw;
  } catch {
    return { summary: 'Payload could not be displayed safely.' };
  }
}

export function summarizeQueuePayload(payload: unknown): string {
  const safe = sanitizePayloadForDisplay(payload);
  const pairs = Object.entries(safe).slice(0, 5).map(([key, value]) => `${key}: ${typeof value === 'object' ? '[Object]' : String(value)}`);
  return pairs.length ? pairs.join(' | ') : 'No payload summary available';
}
