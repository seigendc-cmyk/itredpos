import { collection, doc, getDocs, onSnapshot, orderBy, query, setDoc, serverTimestamp, where } from 'firebase/firestore';
import { db, firebaseReady } from '../../firebase/firebaseApp';
import { firestorePaths } from '../../firebase/firestorePaths';
import { mapFirestoreError, REPOSITORY_ERROR_CODES } from './firestoreErrorMapper';
import { validateRepositoryOperationContext } from '../repositoryContext';
import type { BIEventRepository, BIEventFilters } from '../BIEventRepository';
import type { SharedBIEventRecord } from '../../firebase/commerceDataContract';
import type { CommerceSourceApp, RepositoryOperationContext } from '../repositoryContext';

function assertReady(): { success: false; errorCode: string; errorMessage: string } | null {
  if (!firebaseReady || !db) {
    return {
      success: false,
      errorCode: REPOSITORY_ERROR_CODES.UNAVAILABLE,
      errorMessage: 'Firebase is not configured or Firestore is not available.'
    };
  }
  return null;
}

function normalizeEvent(data: Record<string, unknown>, fallbackVendorId: string): SharedBIEventRecord {
  return {
    eventId: typeof data.eventId === 'string' ? data.eventId : '',
    eventType: typeof data.eventType === 'string' ? data.eventType : '',
    vendorId: typeof data.vendorId === 'string' ? data.vendorId : fallbackVendorId,
    branchId: typeof data.branchId === 'string' ? data.branchId : '',
    warehouseId: typeof data.warehouseId === 'string' ? data.warehouseId : undefined,
    productId: typeof data.productId === 'string' ? data.productId : undefined,
    terminalId: typeof data.terminalId === 'string' ? data.terminalId : '',
    staffId: typeof data.staffId === 'string' ? data.staffId : '',
    sourceApp: (typeof data.sourceApp === 'string' ? data.sourceApp : 'SYSTEM') as CommerceSourceApp,
    entityType: typeof data.entityType === 'string' ? data.entityType : '',
    entityId: typeof data.entityId === 'string' ? data.entityId : '',
    timestamp: typeof data.timestamp === 'string' ? data.timestamp : '',
    correlationId: typeof data.correlationId === 'string' ? data.correlationId : undefined,
    severity: typeof data.severity === 'string' ? data.severity : 'INFO',
    actionRequired: typeof data.actionRequired === 'boolean' ? data.actionRequired : false,
    metadata: typeof data.metadata === 'object' && data.metadata !== null ? (data.metadata as Record<string, unknown>) : {},
    schemaVersion: typeof data.schemaVersion === 'number' ? data.schemaVersion : undefined
  };
}

export function createFirestoreBIEventRepository(): BIEventRepository {
  return {
    async publishEvent(context: RepositoryOperationContext, event: SharedBIEventRecord): Promise<{ success: boolean; data?: SharedBIEventRecord; errorCode?: string; errorMessage?: string }> {
      try {
        validateRepositoryOperationContext(context);
      } catch (validationError) {
        const message = validationError instanceof Error ? validationError.message : 'Invalid repository operation context.';
        return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: message };
      }

      if (event.vendorId !== context.vendorId) {
        return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'Cross-vendor document creation is rejected.' };
      }

      const ready = assertReady();
      if (ready) return ready;

      try {
        const docRef = doc(db, firestorePaths.biEvents(context.vendorId), event.eventId);
        const payload: Record<string, unknown> = {
          ...event,
          timestamp: serverTimestamp(),
          sourceApp: context.sourceApp
        };

        await setDoc(docRef, payload);
        return { success: true, data: { ...event, timestamp: '' } };
      } catch (error) {
        const mapped = mapFirestoreError(error);
        return { success: false, errorCode: mapped.errorCode, errorMessage: mapped.errorMessage };
      }
    },

    async listEvents(context: RepositoryOperationContext, filters?: BIEventFilters): Promise<{ success: boolean; records: SharedBIEventRecord[]; errorCode?: string; errorMessage?: string }> {
      try {
        validateRepositoryOperationContext(context);
      } catch (validationError) {
        const message = validationError instanceof Error ? validationError.message : 'Invalid repository operation context.';
        return { success: false, records: [], errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: message };
      }

      const ready = assertReady();
      if (ready) return { ...ready, records: [] };

      try {
        const constraints = [where('vendorId', '==', context.vendorId)];
        if (filters?.entityType) {
          constraints.push(where('entityType', '==', filters.entityType));
        }
        if (filters?.entityId) {
          constraints.push(where('entityId', '==', filters.entityId));
        }
        if (filters?.eventType) {
          constraints.push(where('eventType', '==', filters.eventType));
        }
        if (filters?.severity) {
          constraints.push(where('severity', '==', filters.severity));
        }

        const q = query(collection(db, firestorePaths.biEvents(context.vendorId)), ...constraints, orderBy('timestamp', 'desc'));
        const snapshot = await getDocs(q);
        const records: SharedBIEventRecord[] = [];
        snapshot.forEach((docSnapshot) => {
          const data = docSnapshot.data() as Record<string, unknown>;
          const record = normalizeEvent(data, context.vendorId);
          if (record.vendorId === context.vendorId) {
            records.push(record);
          }
        });
        return { success: true, records };
      } catch (error) {
        const mapped = mapFirestoreError(error);
        return { success: false, errorCode: mapped.errorCode, errorMessage: mapped.errorMessage, records: [] };
      }
    },

    subscribeEvents(context: RepositoryOperationContext, listener: (records: SharedBIEventRecord[]) => void): { unsubscribe: () => void } {
      try {
        validateRepositoryOperationContext(context);
      } catch {
        return { unsubscribe: () => {} };
      }

      if (!firebaseReady || !db) {
        return { unsubscribe: () => {} };
      }

      const q = query(collection(db, firestorePaths.biEvents(context.vendorId)), where('vendorId', '==', context.vendorId), orderBy('timestamp', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const records: SharedBIEventRecord[] = [];
        snapshot.forEach((docSnapshot) => {
          const data = docSnapshot.data() as Record<string, unknown>;
          const record = normalizeEvent(data, context.vendorId);
          if (record.vendorId === context.vendorId) {
            records.push(record);
          }
        });
        listener(records);
      });

      return { unsubscribe };
    }
  };
}
