import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db, firebaseReady } from '../../firebase/firebaseApp';
import { firestorePaths } from '../../firebase/firestorePaths';
import { mapFirestoreError, REPOSITORY_ERROR_CODES } from './firestoreErrorMapper';
import type { VendorRepository } from '../VendorRepository';
import type { CommerceSourceApp, SharedVendorRecord, SharedBranchRecord, SharedWarehouseRecord, SharedTerminalRecord } from '../../firebase/commerceDataContract';

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

export function createFirestoreVendorRepository(): VendorRepository {
  return {
    getVendor(vendorId: string): Promise<{ success: boolean; data?: SharedVendorRecord; errorCode?: string; errorMessage?: string }> {
      if (blankOrWhitespace(vendorId)) {
        return Promise.resolve({
          success: false,
          records: [],
          errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION,
          errorMessage: 'vendorId must be a non-blank, non-whitespace string.'
        });
      }
      const ready = assertReady();
      if (ready) return Promise.resolve({ ...ready, records: [] });

      return getDoc(doc(db, firestorePaths.vendor(vendorId)))
        .then((snapshot) => {
          if (!snapshot.exists()) {
            return { success: false, records: [], errorCode: REPOSITORY_ERROR_CODES.NOT_FOUND, errorMessage: 'Vendor not found.' };
          }
          const data = snapshot.data() as Record<string, unknown>;
          const record = normalizeVendor(data, vendorId);
          if (record.vendorId !== vendorId) {
            return { success: false, records: [], errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'Cross-vendor document access is rejected.' };
          }
          return { success: true, data: record };
        })
        .catch((error) => {
          const mapped = mapFirestoreError(error);
          return { success: false, records: [], errorCode: mapped.errorCode, errorMessage: mapped.errorMessage };
        });
    },

    listBranches(vendorId: string): Promise<{ success: boolean; records: SharedBranchRecord[]; errorCode?: string; errorMessage?: string }> {
      if (blankOrWhitespace(vendorId)) {
        return Promise.resolve({
          success: false,
          records: [],
          errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION,
          errorMessage: 'vendorId must be a non-blank, non-whitespace string.'
        });
      }
      const ready = assertReady();
      if (ready) return Promise.resolve({ ...ready, records: [] });

      return getDocs(query(collection(db, firestorePaths.branches(vendorId)), where('vendorId', '==', vendorId)))
        .then((snapshot) => {
          const records: SharedBranchRecord[] = [];
          snapshot.forEach((docSnapshot) => {
            const data = docSnapshot.data() as Record<string, unknown>;
            records.push(normalizeBranch(data, vendorId));
          });
          return { success: true, records };
        })
        .catch((error) => {
          const mapped = mapFirestoreError(error);
          return { success: false, records: [], errorCode: mapped.errorCode, errorMessage: mapped.errorMessage };
        });
    },

    listWarehouses(vendorId: string): Promise<{ success: boolean; records: SharedWarehouseRecord[]; errorCode?: string; errorMessage?: string }> {
      if (blankOrWhitespace(vendorId)) {
        return Promise.resolve({
          success: false,
          records: [],
          errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION,
          errorMessage: 'vendorId must be a non-blank, non-whitespace string.'
        });
      }
      const ready = assertReady();
      if (ready) return Promise.resolve({ ...ready, records: [] });

      return getDocs(query(collection(db, firestorePaths.warehouses(vendorId)), where('vendorId', '==', vendorId)))
        .then((snapshot) => {
          const records: SharedWarehouseRecord[] = [];
          snapshot.forEach((docSnapshot) => {
            const data = docSnapshot.data() as Record<string, unknown>;
            records.push(normalizeWarehouse(data, vendorId));
          });
          return { success: true, records };
        })
        .catch((error) => {
          const mapped = mapFirestoreError(error);
          return { success: false, records: [], errorCode: mapped.errorCode, errorMessage: mapped.errorMessage };
        });
    },

    listTerminals(vendorId: string, branchId: string): Promise<{ success: boolean; records: SharedTerminalRecord[]; errorCode?: string; errorMessage?: string }> {
      if (blankOrWhitespace(vendorId) || blankOrWhitespace(branchId)) {
        return Promise.resolve({
          success: false,
          records: [],
          errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION,
          errorMessage: 'vendorId and branchId must be non-blank, non-whitespace strings.'
        });
      }
      const ready = assertReady();
      if (ready) return Promise.resolve({ ...ready, records: [] });

      return getDocs(query(collection(db, firestorePaths.terminals(vendorId, branchId)), where('vendorId', '==', vendorId), where('branchId', '==', branchId)))
        .then((snapshot) => {
          const records: SharedTerminalRecord[] = [];
          snapshot.forEach((docSnapshot) => {
            const data = docSnapshot.data() as Record<string, unknown>;
            records.push(normalizeTerminal(data, vendorId));
          });
          return { success: true, records };
        })
        .catch((error) => {
          const mapped = mapFirestoreError(error);
          return { success: false, records: [], errorCode: mapped.errorCode, errorMessage: mapped.errorMessage };
        });
    }
  };
}
