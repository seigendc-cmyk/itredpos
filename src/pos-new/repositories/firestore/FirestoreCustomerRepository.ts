import { collection, doc, getDoc, getDocs, onSnapshot, query, setDoc, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db, firebaseReady } from '../../firebase/firebaseApp';
import { firestorePaths } from '../../firebase/firestorePaths';
import { mapFirestoreError, REPOSITORY_ERROR_CODES } from './firestoreErrorMapper';
import { validateRepositoryOperationContext } from '../repositoryContext';
import type { CustomerRepository } from '../CustomerRepository';
import type { SharedCustomerRecord } from '../../firebase/commerceDataContract';
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

function normalizeCustomer(data: Record<string, unknown>, fallbackVendorId: string): SharedCustomerRecord {
  return {
    sciId: typeof data.sciId === 'string' ? data.sciId : '',
    schemaVersion: typeof data.schemaVersion === 'number' ? data.schemaVersion : 0,
    status: typeof data.status === 'string' ? data.status : 'Active',
    vendorId: typeof data.vendorId === 'string' ? data.vendorId : fallbackVendorId,
    customerId: typeof data.customerId === 'string' ? data.customerId : '',
    customerName: typeof data.customerName === 'string' ? data.customerName : '',
    phone: typeof data.phone === 'string' ? data.phone : undefined,
    email: typeof data.email === 'string' ? data.email : undefined,
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : '',
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
    createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : '',
    sourceApp: (typeof data.sourceApp === 'string' ? data.sourceApp : 'SYSTEM') as CommerceSourceApp,
    lastSyncAt: typeof data.lastSyncAt === 'string' ? data.lastSyncAt : undefined
  };
}

export function createFirestoreCustomerRepository(): CustomerRepository {
  return {
    async getCustomer(context: RepositoryOperationContext, customerId: string): Promise<{ success: boolean; data?: SharedCustomerRecord; errorCode?: string; errorMessage?: string }> {
      try {
        validateRepositoryOperationContext(context);
      } catch (validationError) {
        const message = validationError instanceof Error ? validationError.message : 'Invalid repository operation context.';
        return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: message };
      }

      if (!customerId || customerId.trim().length === 0) {
        return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'customerId must be a non-blank string.' };
      }

      const ready = assertReady();
      if (ready) return ready;

      try {
        const docRef = doc(db, firestorePaths.customers(context.vendorId), customerId);
        const snapshot = await getDoc(docRef);
        if (!snapshot.exists()) {
          return { success: false, errorCode: REPOSITORY_ERROR_CODES.NOT_FOUND, errorMessage: 'Customer not found.' };
        }
        const record = normalizeCustomer(snapshot.data() as Record<string, unknown>, context.vendorId);
        if (record.vendorId !== context.vendorId) {
          return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'Cross-vendor document access is rejected.' };
        }
        return { success: true, data: record };
      } catch (error) {
        const mapped = mapFirestoreError(error);
        return { success: false, errorCode: mapped.errorCode, errorMessage: mapped.errorMessage };
      }
    },

    async listCustomers(context: RepositoryOperationContext): Promise<{ success: boolean; records: SharedCustomerRecord[]; errorCode?: string; errorMessage?: string }> {
      try {
        validateRepositoryOperationContext(context);
      } catch (validationError) {
        const message = validationError instanceof Error ? validationError.message : 'Invalid repository operation context.';
        return { success: false, records: [], errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: message };
      }

      const ready = assertReady();
      if (ready) return { ...ready, records: [] };

      try {
        const q = query(collection(db, firestorePaths.customers(context.vendorId)), where('vendorId', '==', context.vendorId));
        const snapshot = await getDocs(q);
        const records: SharedCustomerRecord[] = [];
        snapshot.forEach((docSnapshot) => {
          const data = docSnapshot.data() as Record<string, unknown>;
          const record = normalizeCustomer(data, context.vendorId);
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

    async createCustomer(context: RepositoryOperationContext, customer: SharedCustomerRecord): Promise<{ success: boolean; data?: SharedCustomerRecord; errorCode?: string; errorMessage?: string }> {
      try {
        validateRepositoryOperationContext(context);
      } catch (validationError) {
        const message = validationError instanceof Error ? validationError.message : 'Invalid repository operation context.';
        return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: message };
      }

      if (customer.vendorId !== context.vendorId) {
        return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'Cross-vendor document creation is rejected.' };
      }

      const ready = assertReady();
      if (ready) return ready;

      try {
        const docRef = doc(db, firestorePaths.customers(context.vendorId), customer.customerId);
        const payload: Record<string, unknown> = {
          ...customer,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: context.actorId,
          updatedBy: context.actorId,
          sourceApp: context.sourceApp
        };

        await setDoc(docRef, payload);
        return { success: true, data: { ...customer, createdAt: '', updatedAt: '' } };
      } catch (error) {
        const mapped = mapFirestoreError(error);
        return { success: false, errorCode: mapped.errorCode, errorMessage: mapped.errorMessage };
      }
    },

    async updateCustomer(context: RepositoryOperationContext, customerId: string, changes: Partial<SharedCustomerRecord>): Promise<{ success: boolean; data?: SharedCustomerRecord; errorCode?: string; errorMessage?: string }> {
      try {
        validateRepositoryOperationContext(context);
      } catch (validationError) {
        const message = validationError instanceof Error ? validationError.message : 'Invalid repository operation context.';
        return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: message };
      }

      if (!customerId || customerId.trim().length === 0) {
        return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'customerId must be a non-blank string.' };
      }

      const ready = assertReady();
      if (ready) return ready;

      try {
        const docRef = doc(db, firestorePaths.customers(context.vendorId), customerId);
        const snapshot = await getDoc(docRef);
        if (!snapshot.exists()) {
          return { success: false, errorCode: REPOSITORY_ERROR_CODES.NOT_FOUND, errorMessage: 'Customer not found.' };
        }
        const existing = snapshot.data() as Record<string, unknown>;
        if (existing.vendorId !== context.vendorId) {
          return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'Cross-vendor document update is rejected.' };
        }
        await updateDoc(docRef, { ...changes, updatedAt: serverTimestamp(), updatedBy: context.actorId });
        const updated = { ...existing, ...changes, updatedAt: '', updatedBy: context.actorId };
        return { success: true, data: normalizeCustomer(updated, context.vendorId) };
      } catch (error) {
        const mapped = mapFirestoreError(error);
        return { success: false, errorCode: mapped.errorCode, errorMessage: mapped.errorMessage };
      }
    },

    subscribeCustomers(context: RepositoryOperationContext, listener: (records: SharedCustomerRecord[]) => void): { unsubscribe: () => void } {
      try {
        validateRepositoryOperationContext(context);
      } catch {
        return { unsubscribe: () => {} };
      }

      if (!firebaseReady || !db) {
        return { unsubscribe: () => {} };
      }

      const q = query(collection(db, firestorePaths.customers(context.vendorId)), where('vendorId', '==', context.vendorId));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const records: SharedCustomerRecord[] = [];
        snapshot.forEach((docSnapshot) => {
          const data = docSnapshot.data() as Record<string, unknown>;
          const record = normalizeCustomer(data, context.vendorId);
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
