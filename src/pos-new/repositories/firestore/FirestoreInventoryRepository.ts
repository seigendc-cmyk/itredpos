import { collection, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db, firebaseReady } from '../../firebase/firebaseApp';
import { firestorePaths } from '../../firebase/firestorePaths';
import { mapFirestoreError, REPOSITORY_ERROR_CODES } from './firestoreErrorMapper';
import { validateRepositoryOperationContext } from '../repositoryContext';
import type { InventoryRepository } from '../InventoryRepository';
import type { CommerceSourceApp, SharedInventoryBalanceRecord, SharedInventoryMovementRecord } from '../../firebase/commerceDataContract';
import type { RepositoryOperationContext } from '../repositoryContext';

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

function normalizeBalance(data: Record<string, unknown>, fallbackVendorId: string): SharedInventoryBalanceRecord {
  return {
    sciId: typeof data.sciId === 'string' ? data.sciId : '',
    schemaVersion: typeof data.schemaVersion === 'number' ? data.schemaVersion : 0,
    status: typeof data.status === 'string' ? data.status : 'Active',
    vendorId: typeof data.vendorId === 'string' ? data.vendorId : fallbackVendorId,
    balanceId: typeof data.balanceId === 'string' ? data.balanceId : '',
    productId: typeof data.productId === 'string' ? data.productId : '',
    warehouseId: typeof data.warehouseId === 'string' ? data.warehouseId : '',
    branchId: typeof data.branchId === 'string' ? data.branchId : undefined,
    shelfLocation: typeof data.shelfLocation === 'string' ? data.shelfLocation : undefined,
    qtyOnHand: typeof data.qtyOnHand === 'number' ? data.qtyOnHand : 0,
    qtyAvailable: typeof data.qtyAvailable === 'number' ? data.qtyAvailable : 0,
    qtyReserved: typeof data.qtyReserved === 'number' ? data.qtyReserved : undefined,
    unitOfMeasure: typeof data.unitOfMeasure === 'string' ? data.unitOfMeasure : undefined,
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : '',
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
    createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : '',
    sourceApp: (typeof data.sourceApp === 'string' ? data.sourceApp : 'SYSTEM') as CommerceSourceApp,
    lastSyncAt: typeof data.lastSyncAt === 'string' ? data.lastSyncAt : undefined
  };
}

function normalizeMovement(data: Record<string, unknown>, fallbackVendorId: string): SharedInventoryMovementRecord {
  return {
    sciId: typeof data.sciId === 'string' ? data.sciId : '',
    schemaVersion: typeof data.schemaVersion === 'number' ? data.schemaVersion : 0,
    status: typeof data.status === 'string' ? data.status : 'Active',
    vendorId: typeof data.vendorId === 'string' ? data.vendorId : fallbackVendorId,
    movementId: typeof data.movementId === 'string' ? data.movementId : '',
    productId: typeof data.productId === 'string' ? data.productId : '',
    warehouseId: typeof data.warehouseId === 'string' ? data.warehouseId : '',
    branchId: typeof data.branchId === 'string' ? data.branchId : undefined,
    movementType: typeof data.movementType === 'string' ? data.movementType : '',
    qtyDelta: typeof data.qtyDelta === 'number' ? data.qtyDelta : 0,
    reason: typeof data.reason === 'string' ? data.reason : undefined,
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : '',
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
    createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : '',
    sourceApp: (typeof data.sourceApp === 'string' ? data.sourceApp : 'SYSTEM') as CommerceSourceApp,
    lastSyncAt: typeof data.lastSyncAt === 'string' ? data.lastSyncAt : undefined
  };
}

export function createFirestoreInventoryRepository(): InventoryRepository {
  return {
    async getBalance(context: RepositoryOperationContext, productId: string, locationId: string): Promise<{ success: boolean; data?: SharedInventoryBalanceRecord; errorCode?: string; errorMessage?: string }> {
      try {
        validateRepositoryOperationContext(context);
      } catch (validationError) {
        const message = validationError instanceof Error ? validationError.message : 'Invalid repository operation context.';
        return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: message };
      }

      if (!productId || productId.trim().length === 0 || !locationId || locationId.trim().length === 0) {
        return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'productId and locationId must be non-blank strings.' };
      }

      const ready = assertReady();
      if (ready) return ready;

      try {
        const q = query(
          collection(db, firestorePaths.productStockBalances(context.vendorId)),
          where('vendorId', '==', context.vendorId),
          where('productId', '==', productId),
          where('warehouseId', '==', locationId)
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
          return { success: false, errorCode: REPOSITORY_ERROR_CODES.NOT_FOUND, errorMessage: 'Inventory balance not found.' };
        }
        const data = snapshot.docs[0].data() as Record<string, unknown>;
        const record = normalizeBalance(data, context.vendorId);
        if (record.vendorId !== context.vendorId) {
          return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'Cross-vendor document access is rejected.' };
        }
        return { success: true, data: record };
      } catch (error) {
        const mapped = mapFirestoreError(error);
        return { success: false, errorCode: mapped.errorCode, errorMessage: mapped.errorMessage };
      }
    },

    async listBalances(context: RepositoryOperationContext): Promise<{ success: boolean; records: SharedInventoryBalanceRecord[]; errorCode?: string; errorMessage?: string }> {
      try {
        validateRepositoryOperationContext(context);
      } catch (validationError) {
        const message = validationError instanceof Error ? validationError.message : 'Invalid repository operation context.';
        return { success: false, records: [], errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: message };
      }

      const ready = assertReady();
      if (ready) return { ...ready, records: [] };

      try {
        const q = query(collection(db, firestorePaths.productStockBalances(context.vendorId)), where('vendorId', '==', context.vendorId));
        const snapshot = await getDocs(q);
        const records: SharedInventoryBalanceRecord[] = [];
        snapshot.forEach((docSnapshot) => {
          const data = docSnapshot.data() as Record<string, unknown>;
          const record = normalizeBalance(data, context.vendorId);
          if (record.vendorId === context.vendorId) {
            records.push(record);
          }
        });
        return { success: true, records };
      } catch (error) {
        const mapped = mapFirestoreError(error);
        return { success: false, records: [], errorCode: mapped.errorCode, errorMessage: mapped.errorMessage };
      }
    },

    async listMovements(context: RepositoryOperationContext, productId?: string): Promise<{ success: boolean; records: SharedInventoryMovementRecord[]; errorCode?: string; errorMessage?: string }> {
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
        if (productId && productId.trim().length > 0) {
          constraints.push(where('productId', '==', productId));
        }

        const q = query(collection(db, firestorePaths.inventoryMovements(context.vendorId)), ...constraints);
        const snapshot = await getDocs(q);
        const records: SharedInventoryMovementRecord[] = [];
        snapshot.forEach((docSnapshot) => {
          const data = docSnapshot.data() as Record<string, unknown>;
          const record = normalizeMovement(data, context.vendorId);
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

    async postMovement(context: RepositoryOperationContext, movement: SharedInventoryMovementRecord): Promise<{ success: boolean; data?: SharedInventoryMovementRecord; errorCode?: string; errorMessage?: string }> {
      try {
        validateRepositoryOperationContext(context);
      } catch (validationError) {
        const message = validationError instanceof Error ? validationError.message : 'Invalid repository operation context.';
        return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: message };
      }

      if (movement.vendorId !== context.vendorId) {
        return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'Cross-vendor document creation is rejected.' };
      }

      const ready = assertReady();
      if (ready) return ready;

      try {
        const docRef = doc(db, firestorePaths.inventoryMovements(context.vendorId), movement.movementId);
        const payload: Record<string, unknown> = {
          ...movement,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: context.actorId,
          updatedBy: context.actorId,
          sourceApp: context.sourceApp
        };

        await setDoc(docRef, payload);
        return { success: true, data: { ...movement, createdAt: '', updatedAt: '' } };
      } catch (error) {
        const mapped = mapFirestoreError(error);
        return { success: false, errorCode: mapped.errorCode, errorMessage: mapped.errorMessage };
      }
    },

    subscribeBalances(context: RepositoryOperationContext, listener: (records: SharedInventoryBalanceRecord[]) => void): { unsubscribe: () => void } {
      try {
        validateRepositoryOperationContext(context);
      } catch {
        return { unsubscribe: () => {} };
      }

      if (!firebaseReady || !db) {
        return { unsubscribe: () => {} };
      }

      const q = query(collection(db, firestorePaths.productStockBalances(context.vendorId)), where('vendorId', '==', context.vendorId));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const records: SharedInventoryBalanceRecord[] = [];
        snapshot.forEach((docSnapshot) => {
          const data = docSnapshot.data() as Record<string, unknown>;
          const record = normalizeBalance(data, context.vendorId);
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
