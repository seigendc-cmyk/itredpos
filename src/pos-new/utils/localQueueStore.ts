import { SyncQueueItem, SyncActivityEvent, SyncStatus, SyncRisk } from '../types/posTypes';
import { mockSyncQueueItems, mockSyncActivityEvents } from '../mock/mockPosData';

const QUEUE_KEY = 'sci_pos_sync_queue';
const ACTIVITY_KEY = 'sci_pos_sync_activity';
const CONNECTIVITY_KEY = 'sci_pos_terminal_connectivity';

// Check if localStorage is available
function isLocalStorageAvailable(): boolean {
  try {
    const test = '__test_local_storage__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
}

// In-memory fallback objects
let ramQueue: SyncQueueItem[] = [...mockSyncQueueItems];
let ramActivity: SyncActivityEvent[] = [...mockSyncActivityEvents];
let ramConnectivity = 'ONLINE';

export function loadLocalQueue(): SyncQueueItem[] {
  if (isLocalStorageAvailable()) {
    const data = localStorage.getItem(QUEUE_KEY);
    if (data) {
      try {
        return JSON.parse(data);
      } catch (e) {
        console.warn('Error parsing sync queue from localStorage', e);
      }
    }
    // Initialize
    localStorage.setItem(QUEUE_KEY, JSON.stringify(mockSyncQueueItems));
    return [...mockSyncQueueItems];
  }
  return ramQueue;
}

export function saveLocalQueue(queueItems: SyncQueueItem[]): void {
  if (isLocalStorageAvailable()) {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queueItems));
  } else {
    ramQueue = queueItems;
  }
}

export function addLocalQueueItem(item: Omit<SyncQueueItem, 'id' | 'createdAt' | 'syncStatus'>): SyncQueueItem {
  const queue = loadLocalQueue();
  const nextNumber = queue.length > 0 
    ? Math.max(...queue.map(q => {
        const parsed = parseInt(q.id.replace('Q-', ''));
        return isNaN(parsed) ? 0 : parsed;
      })) + 1
    : 1;
  const padding = nextNumber < 10 ? '00' : nextNumber < 100 ? '0' : '';
  
  const newItem: SyncQueueItem = {
    ...item,
    id: `Q-${padding}${nextNumber}`,
    createdAt: new Date().toISOString(),
    syncStatus: 'Pending'
  };

  queue.push(newItem);
  saveLocalQueue(queue);

  // Auto-log event
  addLocalSyncActivity({
    eventType: 'LOCAL_QUEUE_ITEM_CREATED',
    message: `New queue item parsed to SQ buffer: ${item.domain} > ${item.eventType} (${item.reference})`,
    operator: item.createdBy
  });

  return newItem;
}

export function updateLocalQueueItem(queueId: string, patch: Partial<SyncQueueItem>): SyncQueueItem | null {
  const queue = loadLocalQueue();
  const idx = queue.findIndex(q => q.id === queueId);
  if (idx === -1) return null;

  queue[idx] = { ...queue[idx], ...patch };
  saveLocalQueue(queue);
  return queue[idx];
}

export function clearSyncedQueueItems(): void {
  const queue = loadLocalQueue();
  const activeItems = queue.filter(q => q.syncStatus !== 'Synced');
  saveLocalQueue(activeItems);

  addLocalSyncActivity({
    eventType: 'SYNCED_QUEUE_CLEARED',
    message: 'Local sqlite transaction table reduced by scrubbing all synced offsets.',
    operator: 'Central Daemon'
  });
}

// Connectivity state persistence
export function loadTerminalConnectivity(): 'ONLINE' | 'OFFLINE' {
  if (isLocalStorageAvailable()) {
    const status = localStorage.getItem(CONNECTIVITY_KEY);
    return (status === 'OFFLINE' ? 'OFFLINE' : 'ONLINE');
  }
  return ramConnectivity === 'OFFLINE' ? 'OFFLINE' : 'ONLINE';
}

export function saveTerminalConnectivity(status: 'ONLINE' | 'OFFLINE'): void {
  if (isLocalStorageAvailable()) {
    localStorage.setItem(CONNECTIVITY_KEY, status);
  } else {
    ramConnectivity = status;
  }
}

// Activity logging helper
export function loadLocalSyncActivity(): SyncActivityEvent[] {
  if (isLocalStorageAvailable()) {
    const data = localStorage.getItem(ACTIVITY_KEY);
    if (data) {
      try {
        return JSON.parse(data);
      } catch (e) {
        console.warn('Error parsing sync activity from localStorage', e);
      }
    }
    // Initialize
    localStorage.setItem(ACTIVITY_KEY, JSON.stringify(mockSyncActivityEvents));
    return [...mockSyncActivityEvents];
  }
  return ramActivity;
}

export function saveLocalSyncActivity(activityEvents: SyncActivityEvent[]): void {
  if (isLocalStorageAvailable()) {
    localStorage.setItem(ACTIVITY_KEY, JSON.stringify(activityEvents));
  } else {
    ramActivity = activityEvents;
  }
}

export function addLocalSyncActivity(payload: {
  eventType: SyncActivityEvent['eventType'];
  message: string;
  operator: string;
}): SyncActivityEvent {
  const activities = loadLocalSyncActivity();
  const nextId = 'ACT-' + (activities.length + 101);
  const newEvent: SyncActivityEvent = {
    id: nextId,
    timestamp: new Date().toISOString(),
    ...payload
  };

  activities.unshift(newEvent);
  saveLocalSyncActivity(activities);
  return newEvent;
}
