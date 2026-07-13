import { collection, doc, getDoc, getDocs, onSnapshot, query, setDoc, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db, firebaseReady } from '../../firebase/firebaseApp';
import { firestorePaths } from '../../firebase/firestorePaths';
import { mapFirestoreError, REPOSITORY_ERROR_CODES } from './firestoreErrorMapper';
import { validateRepositoryOperationContext } from '../repositoryContext';
import type { VendorRepository } from '../VendorRepository';
import type { CommerceSourceApp, SharedVendorRecord, SharedBranchRecord, SharedWarehouseRecord, SharedTerminalRecord, SharedVendorAppAccessRecord } from '../../firebase/commerceDataContract';
import type { RepositoryOperationContext } from '../repositoryContext';
import type { RepositoryListResult, RepositoryResult, RepositorySubscription } from '../repositoryTypes';

const blankOrWhitespace = (value: string | undefined | null): boolean =>
  typeof value !== 'string' || value.trim().length === 0;

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

function toResultFailure<T>(failure: { errorCode: string; errorMessage: string }): RepositoryResult<T> {
  return {
    success: false,
    errorCode: failure.errorCode,
    errorMessage: failure.errorMessage
  };
}

function toListFailure<T>(failure: { errorCode: string; errorMessage: string }): RepositoryListResult<T> {
  return {
    success: false,
    records: [],
    errorCode: failure.errorCode,
    errorMessage: failure.errorMessage
  };
}

function normalizeVendor(data: Record<string, unknown>, fallbackVendorId: string): SharedVendorRecord {
  return {
    sciId: typeof data.sciId === 'string' ? data.sciId : '',
    schemaVersion: typeof data.schemaVersion === 'number' ? data.schemaVersion : 0,
    status: typeof data.status === 'string' ? data.status : 'Active',
    vendorId: typeof data.vendorId === 'string' ? data.vendorId : fallbackVendorId,
    vendorName: typeof data.vendorName === 'string' ? data.vendorName : '',
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : '',
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
    createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : '',
    sourceApp: (typeof data.sourceApp === 'string' ? data.sourceApp : 'SYSTEM') as CommerceSourceApp,
    lastSyncAt: typeof data.lastSyncAt === 'string' ? data.lastSyncAt : undefined
  };
}

function normalizeBranch(data: Record<string, unknown>, fallbackVendorId: string): SharedBranchRecord {
  return {
    sciId: typeof data.sciId === 'string' ? data.sciId : '',
    schemaVersion: typeof data.schemaVersion === 'number' ? data.schemaVersion : 0,
    status: typeof data.status === 'string' ? data.status : 'Active',
    vendorId: typeof data.vendorId === 'string' ? data.vendorId : fallbackVendorId,
    branchId: typeof data.branchId === 'string' ? data.branchId : '',
    branchName: typeof data.branchName === 'string' ? data.branchName : '',
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : '',
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
    createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : '',
    sourceApp: (typeof data.sourceApp === 'string' ? data.sourceApp : 'SYSTEM') as CommerceSourceApp,
    lastSyncAt: typeof data.lastSyncAt === 'string' ? data.lastSyncAt : undefined
  };
}

function normalizeWarehouse(data: Record<string, unknown>, fallbackVendorId: string): SharedWarehouseRecord {
  return {
    sciId: typeof data.sciId === 'string' ? data.sciId : '',
    schemaVersion: typeof data.schemaVersion === 'number' ? data.schemaVersion : 0,
    status: typeof data.status === 'string' ? data.status : 'Active',
    vendorId: typeof data.vendorId === 'string' ? data.vendorId : fallbackVendorId,
    warehouseId: typeof data.warehouseId === 'string' ? data.warehouseId : '',
    branchId: typeof data.branchId === 'string' ? data.branchId : undefined,
    warehouseName: typeof data.warehouseName === 'string' ? data.warehouseName : '',
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : '',
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
    createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : '',
    sourceApp: (typeof data.sourceApp === 'string' ? data.sourceApp : 'SYSTEM') as CommerceSourceApp,
    lastSyncAt: typeof data.lastSyncAt === 'string' ? data.lastSyncAt : undefined
  };
}

function normalizeTerminal(data: Record<string, unknown>, fallbackVendorId: string): SharedTerminalRecord {
  return {
    sciId: typeof data.sciId === 'string' ? data.sciId : '',
    schemaVersion: typeof data.schemaVersion === 'number' ? data.schemaVersion : 0,
    status: typeof data.status === 'string' ? data.status : 'Active',
    vendorId: typeof data.vendorId === 'string' ? data.vendorId : fallbackVendorId,
    branchId: typeof data.branchId === 'string' ? data.branchId : '',
    terminalId: typeof data.terminalId === 'string' ? data.terminalId : '',
    terminalName: typeof data.terminalName === 'string' ? data.terminalName : '',
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : '',
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
    createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : '',
    sourceApp: (typeof data.sourceApp === 'string' ? data.sourceApp : 'SYSTEM') as CommerceSourceApp,
    lastSyncAt: typeof data.lastSyncAt === 'string' ? data.lastSyncAt : undefined
  };
}

function normalizeVendorAppAccess(data: Record<string, unknown>, fallbackVendorId: string): SharedVendorAppAccessRecord {
  return {
    vendorId: typeof data.vendorId === 'string' ? data.vendorId : fallbackVendorId,
    appCode: typeof data.appCode === 'string' ? data.appCode : '',
    enabled: typeof data.enabled === 'boolean' ? data.enabled : false,
    planCode: typeof data.planCode === 'string' ? data.planCode : '',
    licenseStatus: typeof data.licenseStatus === 'string' ? data.licenseStatus : '',
    activatedAt: typeof data.activatedAt === 'string' ? data.activatedAt : '',
    expiresAt: typeof data.expiresAt === 'string' ? data.expiresAt : '',
    featureFlags: typeof data.featureFlags === 'object' && data.featureFlags !== null ? (data.featureFlags as Record<string, unknown>) : {},
    schemaVersion: typeof data.schemaVersion === 'number' ? data.schemaVersion : 0,
    sourceApp: (typeof data.sourceApp === 'string' ? data.sourceApp : 'SYSTEM') as CommerceSourceApp,
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : '',
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
    createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : ''
  };
}

export function createFirestoreVendorRepository(): VendorRepository {
  return {
    async getVendor(vendorId: string): Promise<RepositoryResult<SharedVendorRecord>> {
      if (blankOrWhitespace(vendorId)) {
        return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'vendorId must be a non-blank, non-whitespace string.' };
      }
      const ready = assertReady();
      if (ready) return toResultFailure(ready);

      try {
        const snapshot = await getDoc(doc(db, firestorePaths.vendor(vendorId)));
        if (!snapshot.exists()) {
          return { success: false, errorCode: REPOSITORY_ERROR_CODES.NOT_FOUND, errorMessage: 'Vendor not found.' };
        }
        const data = snapshot.data() as Record<string, unknown>;
        const record = normalizeVendor(data, vendorId);
        if (record.vendorId !== vendorId) {
          return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'Cross-vendor document access is rejected.' };
        }
        return { success: true, data: record };
      } catch (error) {
        const mapped = mapFirestoreError(error);
        return { success: false, errorCode: mapped.errorCode, errorMessage: mapped.errorMessage };
      }
    },

    async updateVendor(context: RepositoryOperationContext, vendorId: string, changes: Partial<SharedVendorRecord>): Promise<RepositoryResult<SharedVendorRecord>> {
      try {
        validateRepositoryOperationContext(context);
      } catch (validationError) {
        const message = validationError instanceof Error ? validationError.message : 'Invalid repository operation context.';
        return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: message };
      }

      if (blankOrWhitespace(vendorId) || vendorId !== context.vendorId || (changes.vendorId !== undefined && changes.vendorId !== context.vendorId)) {
        return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'Vendor updates must remain within the operation context vendor.' };
      }

      const ready = assertReady();
      if (ready) return toResultFailure(ready);

      try {
        const docRef = doc(db, firestorePaths.vendor(vendorId));
        const snapshot = await getDoc(docRef);
        if (!snapshot.exists()) {
          return { success: false, errorCode: REPOSITORY_ERROR_CODES.NOT_FOUND, errorMessage: 'Vendor not found.' };
        }
        const existing = snapshot.data() as Record<string, unknown>;
        if (existing.vendorId !== vendorId) {
          return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'Cross-vendor document update is rejected.' };
        }
        await updateDoc(docRef, { ...changes, updatedAt: serverTimestamp(), updatedBy: context.actorId });
        const updated = { ...existing, ...changes, updatedAt: '', updatedBy: context.actorId };
        return { success: true, data: normalizeVendor(updated, vendorId) };
      } catch (error) {
        const mapped = mapFirestoreError(error);
        return { success: false, errorCode: mapped.errorCode, errorMessage: mapped.errorMessage };
      }
    },

    async listBranches(vendorId: string): Promise<RepositoryListResult<SharedBranchRecord>> {
      if (blankOrWhitespace(vendorId)) {
        return { success: false, records: [], errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'vendorId must be a non-blank, non-whitespace string.' };
      }
      const ready = assertReady();
      if (ready) return toListFailure(ready);

      try {
        const snapshot = await getDocs(query(collection(db, firestorePaths.branches(vendorId)), where('vendorId', '==', vendorId)));
        const records: SharedBranchRecord[] = [];
        snapshot.forEach((docSnapshot) => {
          const data = docSnapshot.data() as Record<string, unknown>;
          records.push(normalizeBranch(data, vendorId));
        });
        return { success: true, records };
      } catch (error) {
        const mapped = mapFirestoreError(error);
        return { success: false, records: [], errorCode: mapped.errorCode, errorMessage: mapped.errorMessage };
      }
    },

    async getBranch(vendorId: string, branchId: string): Promise<RepositoryResult<SharedBranchRecord>> {
      if (blankOrWhitespace(vendorId) || blankOrWhitespace(branchId)) {
        return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'vendorId and branchId must be non-blank, non-whitespace strings.' };
      }
      const ready = assertReady();
      if (ready) return toResultFailure(ready);

      try {
        const snapshot = await getDoc(doc(db, firestorePaths.branch(vendorId, branchId)));
        if (!snapshot.exists()) {
          return { success: false, errorCode: REPOSITORY_ERROR_CODES.NOT_FOUND, errorMessage: 'Branch not found.' };
        }
        const data = snapshot.data() as Record<string, unknown>;
        const record = normalizeBranch(data, vendorId);
        if (record.vendorId !== vendorId) {
          return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'Cross-vendor document access is rejected.' };
        }
        return { success: true, data: record };
      } catch (error) {
        const mapped = mapFirestoreError(error);
        return { success: false, errorCode: mapped.errorCode, errorMessage: mapped.errorMessage };
      }
    },

    async createBranch(context: RepositoryOperationContext, branch: SharedBranchRecord): Promise<RepositoryResult<SharedBranchRecord>> {
      try {
        validateRepositoryOperationContext(context);
      } catch (validationError) {
        const message = validationError instanceof Error ? validationError.message : 'Invalid repository operation context.';
        return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: message };
      }

      if (branch.vendorId !== context.vendorId || blankOrWhitespace(branch.branchId)) {
        return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'Cross-vendor document creation is rejected.' };
      }

      const ready = assertReady();
      if (ready) return toResultFailure(ready);

      try {
        const docRef = doc(db, firestorePaths.branch(context.vendorId, branch.branchId));
        const payload: Record<string, unknown> = {
          ...branch,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: context.actorId,
          updatedBy: context.actorId,
          sourceApp: context.sourceApp
        };
        await setDoc(docRef, payload);
        return { success: true, data: { ...branch, createdAt: '', updatedAt: '' } };
      } catch (error) {
        const mapped = mapFirestoreError(error);
        return { success: false, errorCode: mapped.errorCode, errorMessage: mapped.errorMessage };
      }
    },

    async updateBranch(context: RepositoryOperationContext, branchId: string, changes: Partial<SharedBranchRecord>): Promise<RepositoryResult<SharedBranchRecord>> {
      try {
        validateRepositoryOperationContext(context);
      } catch (validationError) {
        const message = validationError instanceof Error ? validationError.message : 'Invalid repository operation context.';
        return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: message };
      }

      if (blankOrWhitespace(branchId) || (changes.vendorId !== undefined && changes.vendorId !== context.vendorId) || (changes.branchId !== undefined && changes.branchId !== branchId)) {
        return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'branchId must be a non-blank string.' };
      }

      const ready = assertReady();
      if (ready) return toResultFailure(ready);

      try {
        const docRef = doc(db, firestorePaths.branch(context.vendorId, branchId));
        const snapshot = await getDoc(docRef);
        if (!snapshot.exists()) {
          return { success: false, errorCode: REPOSITORY_ERROR_CODES.NOT_FOUND, errorMessage: 'Branch not found.' };
        }
        const existing = snapshot.data() as Record<string, unknown>;
        if (existing.vendorId !== context.vendorId) {
          return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'Cross-vendor document update is rejected.' };
        }
        await updateDoc(docRef, { ...changes, updatedAt: serverTimestamp(), updatedBy: context.actorId });
        const updated = { ...existing, ...changes, updatedAt: '', updatedBy: context.actorId };
        return { success: true, data: normalizeBranch(updated, context.vendorId) };
      } catch (error) {
        const mapped = mapFirestoreError(error);
        return { success: false, errorCode: mapped.errorCode, errorMessage: mapped.errorMessage };
      }
    },

    async deactivateBranch(context: RepositoryOperationContext, branchId: string): Promise<RepositoryResult<SharedBranchRecord>> {
      return this.updateBranch(context, branchId, { status: 'INACTIVE' });
    },

    subscribeBranches(context: RepositoryOperationContext, listener: (records: SharedBranchRecord[]) => void): RepositorySubscription {
      try {
        validateRepositoryOperationContext(context);
      } catch {
        return { unsubscribe: () => {} };
      }

      if (!firebaseReady || !db) {
        return { unsubscribe: () => {} };
      }

      const q = query(collection(db, firestorePaths.branches(context.vendorId)), where('vendorId', '==', context.vendorId));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const records: SharedBranchRecord[] = [];
        snapshot.forEach((docSnapshot) => {
          const data = docSnapshot.data() as Record<string, unknown>;
          const record = normalizeBranch(data, context.vendorId);
          if (record.vendorId === context.vendorId) {
            records.push(record);
          }
        });
        listener(records);
      });

      return { unsubscribe };
    },

    async listWarehouses(vendorId: string): Promise<RepositoryListResult<SharedWarehouseRecord>> {
      if (blankOrWhitespace(vendorId)) {
        return { success: false, records: [], errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'vendorId must be a non-blank, non-whitespace string.' };
      }
      const ready = assertReady();
      if (ready) return toListFailure(ready);

      try {
        const snapshot = await getDocs(query(collection(db, firestorePaths.warehouses(vendorId)), where('vendorId', '==', vendorId)));
        const records: SharedWarehouseRecord[] = [];
        snapshot.forEach((docSnapshot) => {
          const data = docSnapshot.data() as Record<string, unknown>;
          records.push(normalizeWarehouse(data, vendorId));
        });
        return { success: true, records };
      } catch (error) {
        const mapped = mapFirestoreError(error);
        return { success: false, records: [], errorCode: mapped.errorCode, errorMessage: mapped.errorMessage };
      }
    },

    async getWarehouse(vendorId: string, warehouseId: string): Promise<RepositoryResult<SharedWarehouseRecord>> {
      if (blankOrWhitespace(vendorId) || blankOrWhitespace(warehouseId)) {
        return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'vendorId and warehouseId must be non-blank, non-whitespace strings.' };
      }
      const ready = assertReady();
      if (ready) return toResultFailure(ready);

      try {
        const snapshot = await getDoc(doc(db, firestorePaths.warehouse(vendorId, warehouseId)));
        if (!snapshot.exists()) {
          return { success: false, errorCode: REPOSITORY_ERROR_CODES.NOT_FOUND, errorMessage: 'Warehouse not found.' };
        }
        const data = snapshot.data() as Record<string, unknown>;
        const record = normalizeWarehouse(data, vendorId);
        if (record.vendorId !== vendorId) {
          return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'Cross-vendor document access is rejected.' };
        }
        return { success: true, data: record };
      } catch (error) {
        const mapped = mapFirestoreError(error);
        return { success: false, errorCode: mapped.errorCode, errorMessage: mapped.errorMessage };
      }
    },

    async createWarehouse(context: RepositoryOperationContext, warehouse: SharedWarehouseRecord): Promise<RepositoryResult<SharedWarehouseRecord>> {
      try {
        validateRepositoryOperationContext(context);
      } catch (validationError) {
        const message = validationError instanceof Error ? validationError.message : 'Invalid repository operation context.';
        return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: message };
      }

      if (warehouse.vendorId !== context.vendorId || blankOrWhitespace(warehouse.warehouseId)) {
        return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'Cross-vendor document creation is rejected.' };
      }

      const ready = assertReady();
      if (ready) return toResultFailure(ready);

      try {
        const docRef = doc(db, firestorePaths.warehouse(context.vendorId, warehouse.warehouseId));
        const payload: Record<string, unknown> = {
          ...warehouse,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: context.actorId,
          updatedBy: context.actorId,
          sourceApp: context.sourceApp
        };
        await setDoc(docRef, payload);
        return { success: true, data: { ...warehouse, createdAt: '', updatedAt: '' } };
      } catch (error) {
        const mapped = mapFirestoreError(error);
        return { success: false, errorCode: mapped.errorCode, errorMessage: mapped.errorMessage };
      }
    },

    async updateWarehouse(context: RepositoryOperationContext, warehouseId: string, changes: Partial<SharedWarehouseRecord>): Promise<RepositoryResult<SharedWarehouseRecord>> {
      try {
        validateRepositoryOperationContext(context);
      } catch (validationError) {
        const message = validationError instanceof Error ? validationError.message : 'Invalid repository operation context.';
        return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: message };
      }

      if (blankOrWhitespace(warehouseId) || (changes.vendorId !== undefined && changes.vendorId !== context.vendorId) || (changes.warehouseId !== undefined && changes.warehouseId !== warehouseId)) {
        return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'warehouseId must be a non-blank string.' };
      }

      const ready = assertReady();
      if (ready) return toResultFailure(ready);

      try {
        const docRef = doc(db, firestorePaths.warehouse(context.vendorId, warehouseId));
        const snapshot = await getDoc(docRef);
        if (!snapshot.exists()) {
          return { success: false, errorCode: REPOSITORY_ERROR_CODES.NOT_FOUND, errorMessage: 'Warehouse not found.' };
        }
        const existing = snapshot.data() as Record<string, unknown>;
        if (existing.vendorId !== context.vendorId) {
          return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'Cross-vendor document update is rejected.' };
        }
        await updateDoc(docRef, { ...changes, updatedAt: serverTimestamp(), updatedBy: context.actorId });
        const updated = { ...existing, ...changes, updatedAt: '', updatedBy: context.actorId };
        return { success: true, data: normalizeWarehouse(updated, context.vendorId) };
      } catch (error) {
        const mapped = mapFirestoreError(error);
        return { success: false, errorCode: mapped.errorCode, errorMessage: mapped.errorMessage };
      }
    },

    async deactivateWarehouse(context: RepositoryOperationContext, warehouseId: string): Promise<RepositoryResult<SharedWarehouseRecord>> {
      return this.updateWarehouse(context, warehouseId, { status: 'INACTIVE' });
    },

    subscribeWarehouses(context: RepositoryOperationContext, listener: (records: SharedWarehouseRecord[]) => void): RepositorySubscription {
      try {
        validateRepositoryOperationContext(context);
      } catch {
        return { unsubscribe: () => {} };
      }

      if (!firebaseReady || !db) {
        return { unsubscribe: () => {} };
      }

      const q = query(collection(db, firestorePaths.warehouses(context.vendorId)), where('vendorId', '==', context.vendorId));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const records: SharedWarehouseRecord[] = [];
        snapshot.forEach((docSnapshot) => {
          const data = docSnapshot.data() as Record<string, unknown>;
          const record = normalizeWarehouse(data, context.vendorId);
          if (record.vendorId === context.vendorId) {
            records.push(record);
          }
        });
        listener(records);
      });

      return { unsubscribe };
    },

    async listTerminals(vendorId: string, branchId: string): Promise<RepositoryListResult<SharedTerminalRecord>> {
      if (blankOrWhitespace(vendorId) || blankOrWhitespace(branchId)) {
        return { success: false, records: [], errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'vendorId and branchId must be non-blank, non-whitespace strings.' };
      }
      const ready = assertReady();
      if (ready) return toListFailure(ready);

      try {
        const snapshot = await getDocs(query(collection(db, firestorePaths.terminals(vendorId, branchId)), where('vendorId', '==', vendorId), where('branchId', '==', branchId)));
        const records: SharedTerminalRecord[] = [];
        snapshot.forEach((docSnapshot) => {
          const data = docSnapshot.data() as Record<string, unknown>;
          records.push(normalizeTerminal(data, vendorId));
        });
        return { success: true, records };
      } catch (error) {
        const mapped = mapFirestoreError(error);
        return { success: false, records: [], errorCode: mapped.errorCode, errorMessage: mapped.errorMessage };
      }
    },

    async getTerminal(vendorId: string, branchId: string, terminalId: string): Promise<RepositoryResult<SharedTerminalRecord>> {
      if (blankOrWhitespace(vendorId) || blankOrWhitespace(branchId) || blankOrWhitespace(terminalId)) {
        return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'vendorId, branchId and terminalId must be non-blank, non-whitespace strings.' };
      }
      const ready = assertReady();
      if (ready) return toResultFailure(ready);

      try {
        const snapshot = await getDoc(doc(db, firestorePaths.terminal(vendorId, branchId, terminalId)));
        if (!snapshot.exists()) {
          return { success: false, errorCode: REPOSITORY_ERROR_CODES.NOT_FOUND, errorMessage: 'Terminal not found.' };
        }
        const data = snapshot.data() as Record<string, unknown>;
        const record = normalizeTerminal(data, vendorId);
        if (record.vendorId !== vendorId || record.branchId !== branchId) {
          return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'Cross-vendor or cross-branch document access is rejected.' };
        }
        return { success: true, data: record };
      } catch (error) {
        const mapped = mapFirestoreError(error);
        return { success: false, errorCode: mapped.errorCode, errorMessage: mapped.errorMessage };
      }
    },

    async createTerminal(context: RepositoryOperationContext, terminal: SharedTerminalRecord): Promise<RepositoryResult<SharedTerminalRecord>> {
      try {
        validateRepositoryOperationContext(context);
      } catch (validationError) {
        const message = validationError instanceof Error ? validationError.message : 'Invalid repository operation context.';
        return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: message };
      }

      if (
        terminal.vendorId !== context.vendorId ||
        blankOrWhitespace(terminal.branchId) ||
        blankOrWhitespace(terminal.terminalId) ||
        (context.branchId !== undefined && terminal.branchId !== context.branchId)
      ) {
        return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'Terminal creation must remain within the operation context vendor and branch.' };
      }

      const ready = assertReady();
      if (ready) return toResultFailure(ready);

      try {
        const docRef = doc(db, firestorePaths.terminal(context.vendorId, terminal.branchId, terminal.terminalId));
        const payload: Record<string, unknown> = {
          ...terminal,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: context.actorId,
          updatedBy: context.actorId,
          sourceApp: context.sourceApp
        };
        await setDoc(docRef, payload);
        return { success: true, data: { ...terminal, createdAt: '', updatedAt: '' } };
      } catch (error) {
        const mapped = mapFirestoreError(error);
        return { success: false, errorCode: mapped.errorCode, errorMessage: mapped.errorMessage };
      }
    },

    async updateTerminal(context: RepositoryOperationContext, branchId: string, terminalId: string, changes: Partial<SharedTerminalRecord>): Promise<RepositoryResult<SharedTerminalRecord>> {
      try {
        validateRepositoryOperationContext(context);
      } catch (validationError) {
        const message = validationError instanceof Error ? validationError.message : 'Invalid repository operation context.';
        return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: message };
      }

      if (
        blankOrWhitespace(branchId) ||
        blankOrWhitespace(terminalId) ||
        (context.branchId !== undefined && context.branchId !== branchId) ||
        (changes.vendorId !== undefined && changes.vendorId !== context.vendorId) ||
        (changes.branchId !== undefined && changes.branchId !== branchId) ||
        (changes.terminalId !== undefined && changes.terminalId !== terminalId)
      ) {
        return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'branchId and terminalId must be non-blank strings.' };
      }

      const ready = assertReady();
      if (ready) return toResultFailure(ready);

      try {
        const docRef = doc(db, firestorePaths.terminal(context.vendorId, branchId, terminalId));
        const snapshot = await getDoc(docRef);
        if (!snapshot.exists()) {
          return { success: false, errorCode: REPOSITORY_ERROR_CODES.NOT_FOUND, errorMessage: 'Terminal not found.' };
        }
        const existing = snapshot.data() as Record<string, unknown>;
        if (existing.vendorId !== context.vendorId || existing.branchId !== branchId) {
          return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'Cross-vendor or cross-branch document update is rejected.' };
        }
        await updateDoc(docRef, { ...changes, updatedAt: serverTimestamp(), updatedBy: context.actorId });
        const updated = { ...existing, ...changes, updatedAt: '', updatedBy: context.actorId };
        return { success: true, data: normalizeTerminal(updated, context.vendorId) };
      } catch (error) {
        const mapped = mapFirestoreError(error);
        return { success: false, errorCode: mapped.errorCode, errorMessage: mapped.errorMessage };
      }
    },

    async deactivateTerminal(context: RepositoryOperationContext, branchId: string, terminalId: string): Promise<RepositoryResult<SharedTerminalRecord>> {
      return this.updateTerminal(context, branchId, terminalId, { status: 'INACTIVE' });
    },

    subscribeTerminals(context: RepositoryOperationContext, listener: (records: SharedTerminalRecord[]) => void): RepositorySubscription {
      try {
        validateRepositoryOperationContext(context);
      } catch {
        return { unsubscribe: () => {} };
      }

      if (!firebaseReady || !db || blankOrWhitespace(context.branchId)) {
        return { unsubscribe: () => {} };
      }

      const q = query(collection(db, firestorePaths.terminals(context.vendorId, context.branchId || '')), where('vendorId', '==', context.vendorId), where('branchId', '==', context.branchId || ''));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const records: SharedTerminalRecord[] = [];
        snapshot.forEach((docSnapshot) => {
          const data = docSnapshot.data() as Record<string, unknown>;
          const record = normalizeTerminal(data, context.vendorId);
          if (record.vendorId === context.vendorId && record.branchId === context.branchId) {
            records.push(record);
          }
        });
        listener(records);
      });

      return { unsubscribe };
    },

    async listVendorAppAccess(context: RepositoryOperationContext): Promise<RepositoryListResult<SharedVendorAppAccessRecord>> {
      try {
        validateRepositoryOperationContext(context);
      } catch (validationError) {
        const message = validationError instanceof Error ? validationError.message : 'Invalid repository operation context.';
        return { success: false, records: [], errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: message };
      }

      const ready = assertReady();
      if (ready) return toListFailure(ready);

      try {
        const snapshot = await getDocs(query(collection(db, firestorePaths.vendorAppAccess(context.vendorId)), where('vendorId', '==', context.vendorId)));
        const records: SharedVendorAppAccessRecord[] = [];
        snapshot.forEach((docSnapshot) => {
          const data = docSnapshot.data() as Record<string, unknown>;
          records.push(normalizeVendorAppAccess(data, context.vendorId));
        });
        return { success: true, records };
      } catch (error) {
        const mapped = mapFirestoreError(error);
        return { success: false, records: [], errorCode: mapped.errorCode, errorMessage: mapped.errorMessage };
      }
    },

    async getVendorAppAccess(context: RepositoryOperationContext, appCode: string): Promise<RepositoryResult<SharedVendorAppAccessRecord>> {
      try {
        validateRepositoryOperationContext(context);
      } catch (validationError) {
        const message = validationError instanceof Error ? validationError.message : 'Invalid repository operation context.';
        return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: message };
      }

      if (blankOrWhitespace(appCode)) {
        return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'appCode must be a non-blank string.' };
      }

      const ready = assertReady();
      if (ready) return toResultFailure(ready);

      try {
        const snapshot = await getDoc(doc(db, firestorePaths.vendorAppAccess(context.vendorId), appCode));
        if (!snapshot.exists()) {
          return { success: false, errorCode: REPOSITORY_ERROR_CODES.NOT_FOUND, errorMessage: 'Vendor app access not found.' };
        }
        const data = snapshot.data() as Record<string, unknown>;
        const record = normalizeVendorAppAccess(data, context.vendorId);
        if (record.vendorId !== context.vendorId) {
          return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'Cross-vendor document access is rejected.' };
        }
        return { success: true, data: record };
      } catch (error) {
        const mapped = mapFirestoreError(error);
        return { success: false, errorCode: mapped.errorCode, errorMessage: mapped.errorMessage };
      }
    },

    async updateVendorAppAccess(context: RepositoryOperationContext, appCode: string, changes: Partial<SharedVendorAppAccessRecord>): Promise<RepositoryResult<SharedVendorAppAccessRecord>> {
      try {
        validateRepositoryOperationContext(context);
      } catch (validationError) {
        const message = validationError instanceof Error ? validationError.message : 'Invalid repository operation context.';
        return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: message };
      }

      if (blankOrWhitespace(appCode) || (changes.vendorId !== undefined && changes.vendorId !== context.vendorId) || (changes.appCode !== undefined && changes.appCode !== appCode)) {
        return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'appCode must be a non-blank string.' };
      }

      const ready = assertReady();
      if (ready) return toResultFailure(ready);

      try {
        const docRef = doc(db, firestorePaths.vendorAppAccess(context.vendorId), appCode);
        const snapshot = await getDoc(docRef);
        if (!snapshot.exists()) {
          return { success: false, errorCode: REPOSITORY_ERROR_CODES.NOT_FOUND, errorMessage: 'Vendor app access not found.' };
        }
        const existing = snapshot.data() as Record<string, unknown>;
        if (existing.vendorId !== context.vendorId) {
          return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'Cross-vendor document update is rejected.' };
        }
        await updateDoc(docRef, { ...changes, updatedAt: serverTimestamp(), updatedBy: context.actorId });
        const updated = { ...existing, ...changes, updatedAt: '', updatedBy: context.actorId };
        return { success: true, data: normalizeVendorAppAccess(updated, context.vendorId) };
      } catch (error) {
        const mapped = mapFirestoreError(error);
        return { success: false, errorCode: mapped.errorCode, errorMessage: mapped.errorMessage };
      }
    },

    subscribeVendorAppAccess(context: RepositoryOperationContext, listener: (records: SharedVendorAppAccessRecord[]) => void): RepositorySubscription {
      try {
        validateRepositoryOperationContext(context);
      } catch {
        return { unsubscribe: () => {} };
      }

      if (!firebaseReady || !db) {
        return { unsubscribe: () => {} };
      }

      const q = query(collection(db, firestorePaths.vendorAppAccess(context.vendorId)), where('vendorId', '==', context.vendorId));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const records: SharedVendorAppAccessRecord[] = [];
        snapshot.forEach((docSnapshot) => {
          const data = docSnapshot.data() as Record<string, unknown>;
          const record = normalizeVendorAppAccess(data, context.vendorId);
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
