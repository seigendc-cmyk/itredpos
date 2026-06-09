import { SyncQueueItem, SyncStatus, SyncActivityEvent } from '../types/posTypes';
import { 
  loadLocalQueue, 
  saveLocalQueue, 
  updateLocalQueueItem, 
  addLocalSyncActivity, 
  clearSyncedQueueItems,
  loadLocalSyncActivity
} from '../utils/localQueueStore';

export async function getLocalSyncQueue(): Promise<SyncQueueItem[]> {
  return loadLocalQueue();
}

export async function runSyncCheck(operator: string): Promise<SyncQueueItem[]> {
  const queue = loadLocalQueue();
  let modifiedCount = 0;

  const updated = queue.map(item => {
    // If pending and low risk, elevate to 'Ready'
    if (item.syncStatus === 'Pending' && item.risk === 'Low') {
      modifiedCount++;
      return { ...item, syncStatus: 'Ready' as SyncStatus };
    }
    // High or Critical stay Pending or move to Conflict if needed
    if (item.syncStatus === 'Pending' && (item.risk === 'High' || item.risk === 'Critical')) {
      // Keep pending or flag as conflict for simulation representation
      if (item.id === 'Q-007') {
        return { ...item, syncStatus: 'Conflict' as SyncStatus };
      }
    }
    return item;
  });

  saveLocalQueue(updated);

  addLocalSyncActivity({
    eventType: 'SYNC_CHECK_COMPLETED',
    message: `Sync checksum executed on ${queue.length} items. Elevated ${modifiedCount} Low-Risk offset layers to READY.`,
    operator
  });

  return updated;
}

export async function syncReadyItems(operator: string): Promise<SyncQueueItem[]> {
  const queue = loadLocalQueue();
  let syncedCount = 0;

  const updated = queue.map(item => {
    if (item.syncStatus === 'Ready') {
      syncedCount++;
      return { ...item, syncStatus: 'Synced' as SyncStatus };
    }
    return item;
  });

  saveLocalQueue(updated);

  addLocalSyncActivity({
    eventType: 'LOCAL_QUEUE_SYNCED',
    message: `Simulated transmit of ${syncedCount} READY records. Upstream master database updated successfully.`,
    operator
  });

  return updated;
}

export async function flagSyncConflict(queueId: string, operator: string): Promise<SyncQueueItem | null> {
  const item = updateLocalQueueItem(queueId, { syncStatus: 'Conflict' });
  if (item) {
    addLocalSyncActivity({
      eventType: 'SYNC_CONFLICT_FLAGGED',
      message: `Flagged schema/receipt conflict on item ${queueId} (${item.reference}). Safe block activated.`,
      operator
    });
  }
  return item;
}

export async function clearSyncedItems(operator: string): Promise<SyncQueueItem[]> {
  clearSyncedQueueItems();
  
  addLocalSyncActivity({
    eventType: 'SYNCED_QUEUE_CLEARED',
    message: `Scrubbed synced rows from local terminal buffer to reclaim device storage.`,
    operator
  });

  return loadLocalQueue();
}

export async function exportQueuePlaceholder(operator: string): Promise<string> {
  const queue = loadLocalQueue();
  const rawJSON = JSON.stringify(queue, null, 2);

  addLocalSyncActivity({
    eventType: 'OFFLINE_AUDIT_EXPORT_PREPARED',
    message: `Exported sqlite snapshot. Saved buffer state segment (${queue.length} payload packages).`,
    operator
  });

  return rawJSON;
}
