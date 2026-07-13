import { collection, doc, getDocs, orderBy, query, setDoc, serverTimestamp, where } from 'firebase/firestore';
import { db, firebaseReady } from '../../firebase/firebaseApp';
import { firestorePaths } from '../../firebase/firestorePaths';
import { mapFirestoreError, REPOSITORY_ERROR_CODES } from './firestoreErrorMapper';
import { validateRepositoryOperationContext } from '../repositoryContext';
import { createFirestoreId } from '../../firebase/firestoreIds';
import type { AuditRepository, AuditFilters } from '../AuditRepository';
import type { SharedAuditRecord } from '../../firebase/commerceDataContract';
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

function normalizeAudit(data: Record<string, unknown>, fallbackVendorId: string): SharedAuditRecord {
  return {
    vendorId: typeof data.vendorId === 'string' ? data.vendorId : fallbackVendorId,
    branchId: typeof data.branchId === 'string' ? data.branchId : '',
    terminalId: typeof data.terminalId === 'string' ? data.terminalId : '',
    staffId: typeof data.staffId === 'string' ? data.staffId : '',
    actorId: typeof data.actorId === 'string' ? data.actorId : '',
    actorRole: typeof data.actorRole === 'string' ? data.actorRole : '',
    action: typeof data.action === 'string' ? data.action : '',
    entityType: typeof data.entityType === 'string' ? data.entityType : '',
    entityId: typeof data.entityId === 'string' ? data.entityId : '',
    before: data.before,
    after: data.after,
    reason: typeof data.reason === 'string' ? data.reason : '',
    sourceApp: (typeof data.sourceApp === 'string' ? data.sourceApp : 'SYSTEM') as CommerceSourceApp,
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : ''
  };
}

export function createFirestoreAuditRepository(): AuditRepository {
  return {
    async appendAuditRecord(context: RepositoryOperationContext, record: SharedAuditRecord): Promise<{ success: boolean; data?: SharedAuditRecord; errorCode?: string; errorMessage?: string }> {
      try {
        validateRepositoryOperationContext(context);
      } catch (validationError) {
        const message = validationError instanceof Error ? validationError.message : 'Invalid repository operation context.';
        return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: message };
      }

      if (record.vendorId !== context.vendorId) {
        return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'Cross-vendor document creation is rejected.' };
      }

      const ready = assertReady();
      if (ready) return ready;

      try {
        const docId = createFirestoreId(`audit-${context.correlationId}`);
        const docRef = doc(db, firestorePaths.auditLogs(context.vendorId), docId);
        const payload: Record<string, unknown> = {
          ...record,
          createdAt: serverTimestamp()
        };

        await setDoc(docRef, payload);
        return { success: true, data: { ...record, createdAt: '' } };
      } catch (error) {
        const mapped = mapFirestoreError(error);
        return { success: false, errorCode: mapped.errorCode, errorMessage: mapped.errorMessage };
      }
    },

    async listAuditRecords(context: RepositoryOperationContext, filters?: AuditFilters): Promise<{ success: boolean; records: SharedAuditRecord[]; errorCode?: string; errorMessage?: string }> {
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
        if (filters?.action) {
          constraints.push(where('action', '==', filters.action));
        }
        if (filters?.entityType) {
          constraints.push(where('entityType', '==', filters.entityType));
        }
        if (filters?.entityId) {
          constraints.push(where('entityId', '==', filters.entityId));
        }
        if (filters?.actorId) {
          constraints.push(where('actorId', '==', filters.actorId));
        }

        const q = query(collection(db, firestorePaths.auditLogs(context.vendorId)), ...constraints, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        const records: SharedAuditRecord[] = [];
        snapshot.forEach((docSnapshot) => {
          const data = docSnapshot.data() as Record<string, unknown>;
          const record = normalizeAudit(data, context.vendorId);
          if (record.vendorId === context.vendorId) {
            records.push(record);
          }
        });
        return { success: true, records };
      } catch (error) {
        const mapped = mapFirestoreError(error);
        return { success: false, errorCode: mapped.errorCode, errorMessage: mapped.errorMessage, records: [] };
      }
    }
  };
}
