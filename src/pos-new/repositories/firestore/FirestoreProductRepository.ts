import { collection, doc, getDoc, getDocs, onSnapshot, query, setDoc, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db, firebaseReady } from '../../firebase/firebaseApp';
import { firestorePaths } from '../../firebase/firestorePaths';
import { mapFirestoreError, REPOSITORY_ERROR_CODES } from './firestoreErrorMapper';
import { validateRepositoryOperationContext } from '../repositoryContext';
import type { ProductRepository, ProductListFilters } from '../ProductRepository';
import type { SharedProductRecord } from '../../firebase/commerceDataContract';
import type { CommerceSourceApp, RepositoryOperationContext } from '../repositoryContext';

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

function normalizeProduct(data: Record<string, unknown>, fallbackVendorId: string): SharedProductRecord {
  return {
    sciId: typeof data.sciId === 'string' ? data.sciId : '',
    schemaVersion: typeof data.schemaVersion === 'number' ? data.schemaVersion : 0,
    status: typeof data.status === 'string' ? data.status : 'Active',
    vendorId: typeof data.vendorId === 'string' ? data.vendorId : fallbackVendorId,
    productId: typeof data.productId === 'string' ? data.productId : '',
    sku: typeof data.sku === 'string' ? data.sku : '',
    numericNo: typeof data.numericNo === 'string' ? data.numericNo : undefined,
    alu: typeof data.alu === 'string' ? data.alu : undefined,
    barcode: typeof data.barcode === 'string' ? data.barcode : undefined,
    productName: typeof data.productName === 'string' ? data.productName : '',
    description: typeof data.description === 'string' ? data.description : undefined,
    industrialSector: typeof data.industrialSector === 'string' ? data.industrialSector : undefined,
    category: typeof data.category === 'string' ? data.category : undefined,
    subcategory: typeof data.subcategory === 'string' ? data.subcategory : undefined,
    brand: typeof data.brand === 'string' ? data.brand : undefined,
    unitOfMeasure: typeof data.unitOfMeasure === 'string' ? data.unitOfMeasure : 'pcs',
    purchaseUnit: typeof data.purchaseUnit === 'string' ? data.purchaseUnit : undefined,
    salesUnit: typeof data.salesUnit === 'string' ? data.salesUnit : undefined,
    costPrice: typeof data.costPrice === 'number' ? data.costPrice : undefined,
    sellingPrice: typeof data.sellingPrice === 'number' ? data.sellingPrice : undefined,
    wholesalePrice: typeof data.wholesalePrice === 'number' ? data.wholesalePrice : undefined,
    taxable: typeof data.taxable === 'boolean' ? data.taxable : undefined,
    vatRatePct: typeof data.vatRatePct === 'number' ? data.vatRatePct : undefined,
    marketplaceVisible: typeof data.marketplaceVisible === 'boolean' ? data.marketplaceVisible : undefined,
    catalogueVisible: typeof data.catalogueVisible === 'boolean' ? data.catalogueVisible : undefined,
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : '',
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
    createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : '',
    sourceApp: (typeof data.sourceApp === 'string' ? data.sourceApp : 'SYSTEM') as CommerceSourceApp,
    lastSyncAt: typeof data.lastSyncAt === 'string' ? data.lastSyncAt : undefined
  };
}

function buildProductQuery(vendorId: string, filters?: ProductListFilters) {
  const constraints = [where('vendorId', '==', vendorId)];
  if (filters?.status) {
    constraints.push(where('status', '==', filters.status));
  }
  if (filters?.category) {
    constraints.push(where('category', '==', filters.category));
  }
  if (filters?.brand) {
    constraints.push(where('brand', '==', filters.brand));
  }
  if (filters?.industrialSector) {
    constraints.push(where('industrialSector', '==', filters.industrialSector));
  }
  if (typeof filters?.marketplaceVisible === 'boolean') {
    constraints.push(where('marketplaceVisible', '==', filters.marketplaceVisible));
  }
  if (typeof filters?.catalogueVisible === 'boolean') {
    constraints.push(where('catalogueVisible', '==', filters.catalogueVisible));
  }
  return query(collection(db, firestorePaths.productMaster(vendorId)), ...constraints);
}

export function createFirestoreProductRepository(): ProductRepository {
  return {
    async getProduct(context: RepositoryOperationContext, productId: string): Promise<{ success: boolean; data?: SharedProductRecord; errorCode?: string; errorMessage?: string }> {
      try {
        validateRepositoryOperationContext(context);
      } catch (validationError) {
        const message = validationError instanceof Error ? validationError.message : 'Invalid repository operation context.';
        return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: message };
      }

      if (!productId || productId.trim().length === 0) {
        return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'productId must be a non-blank string.' };
      }

      const ready = assertReady();
      if (ready) return ready;

      try {
        const docRef = doc(db, firestorePaths.productMaster(context.vendorId), productId);
        const snapshot = await getDoc(docRef);
        if (!snapshot.exists()) {
          return { success: false, errorCode: REPOSITORY_ERROR_CODES.NOT_FOUND, errorMessage: 'Product not found.' };
        }
        const record = normalizeProduct(snapshot.data() as Record<string, unknown>, context.vendorId);
        if (record.vendorId !== context.vendorId) {
          return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'Cross-vendor document access is rejected.' };
        }
        return { success: true, data: record };
      } catch (error) {
        const mapped = mapFirestoreError(error);
        return { success: false, errorCode: mapped.errorCode, errorMessage: mapped.errorMessage };
      }
    },

    async getProductBySku(context: RepositoryOperationContext, sku: string): Promise<{ success: boolean; data?: SharedProductRecord; errorCode?: string; errorMessage?: string }> {
      try {
        validateRepositoryOperationContext(context);
      } catch (validationError) {
        const message = validationError instanceof Error ? validationError.message : 'Invalid repository operation context.';
        return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: message };
      }

      if (!sku || sku.trim().length === 0) {
        return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'sku must be a non-blank string.' };
      }

      const ready = assertReady();
      if (ready) return ready;

      try {
        const q = query(collection(db, firestorePaths.productMaster(context.vendorId)), where('vendorId', '==', context.vendorId), where('sku', '==', sku));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
          return { success: false, errorCode: REPOSITORY_ERROR_CODES.NOT_FOUND, errorMessage: 'Product not found for SKU.' };
        }
        const record = normalizeProduct(snapshot.docs[0].data() as Record<string, unknown>, context.vendorId);
        return { success: true, data: record };
      } catch (error) {
        const mapped = mapFirestoreError(error);
        return { success: false, errorCode: mapped.errorCode, errorMessage: mapped.errorMessage };
      }
    },

    async getProductByBarcode(context: RepositoryOperationContext, barcode: string): Promise<{ success: boolean; data?: SharedProductRecord; errorCode?: string; errorMessage?: string }> {
      try {
        validateRepositoryOperationContext(context);
      } catch (validationError) {
        const message = validationError instanceof Error ? validationError.message : 'Invalid repository operation context.';
        return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: message };
      }

      if (!barcode || barcode.trim().length === 0) {
        return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'barcode must be a non-blank string.' };
      }

      const ready = assertReady();
      if (ready) return ready;

      try {
        const q = query(collection(db, firestorePaths.productMaster(context.vendorId)), where('vendorId', '==', context.vendorId), where('barcode', '==', barcode));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
          return { success: false, errorCode: REPOSITORY_ERROR_CODES.NOT_FOUND, errorMessage: 'Product not found for barcode.' };
        }
        const record = normalizeProduct(snapshot.docs[0].data() as Record<string, unknown>, context.vendorId);
        return { success: true, data: record };
      } catch (error) {
        const mapped = mapFirestoreError(error);
        return { success: false, errorCode: mapped.errorCode, errorMessage: mapped.errorMessage };
      }
    },

    async listProducts(context: RepositoryOperationContext, filters?: ProductListFilters): Promise<{ success: boolean; records: SharedProductRecord[]; errorCode?: string; errorMessage?: string }> {
      try {
        validateRepositoryOperationContext(context);
      } catch (validationError) {
        const message = validationError instanceof Error ? validationError.message : 'Invalid repository operation context.';
        return { success: false, records: [], errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: message };
      }

      const ready = assertReady();
      if (ready) return { ...ready, records: [] };

      try {
        const q = buildProductQuery(context.vendorId, filters);
        const snapshot = await getDocs(q);
        const records: SharedProductRecord[] = [];
        snapshot.forEach((docSnapshot) => {
          const data = docSnapshot.data() as Record<string, unknown>;
          const record = normalizeProduct(data, context.vendorId);
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

    async searchProducts(context: RepositoryOperationContext, searchTerm: string, filters?: ProductListFilters): Promise<{ success: boolean; records: SharedProductRecord[]; errorCode?: string; errorMessage?: string }> {
      try {
        validateRepositoryOperationContext(context);
      } catch (validationError) {
        const message = validationError instanceof Error ? validationError.message : 'Invalid repository operation context.';
        return { success: false, records: [], errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: message };
      }

      const ready = assertReady();
      if (ready) return { ...ready, records: [] };

      try {
        const q = buildProductQuery(context.vendorId, filters);
        const snapshot = await getDocs(q);
        const term = searchTerm.trim().toLowerCase();
        const records: SharedProductRecord[] = [];
        snapshot.forEach((docSnapshot) => {
          const data = docSnapshot.data() as Record<string, unknown>;
          const record = normalizeProduct(data, context.vendorId);
          if (record.vendorId !== context.vendorId) return;
          if (!term) {
            records.push(record);
            return;
          }
          const haystack = [
            record.productId,
            record.sku,
            record.barcode,
            record.productName,
            record.description,
            record.brand,
            record.category,
            record.industrialSector
          ].filter(Boolean).join(' ').toLowerCase();
          if (haystack.includes(term)) {
            records.push(record);
          }
        });
        return { success: true, records };
      } catch (error) {
        const mapped = mapFirestoreError(error);
        return { success: false, records: [], errorCode: mapped.errorCode, errorMessage: mapped.errorMessage };
      }
    },

    async createProduct(context: RepositoryOperationContext, product: SharedProductRecord): Promise<{ success: boolean; data?: SharedProductRecord; errorCode?: string; errorMessage?: string }> {
      try {
        validateRepositoryOperationContext(context);
      } catch (validationError) {
        const message = validationError instanceof Error ? validationError.message : 'Invalid repository operation context.';
        return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: message };
      }

      if (product.vendorId !== context.vendorId) {
        return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'Cross-vendor document creation is rejected.' };
      }

      if (!product.productId || product.productId.trim().length === 0) {
        return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'productId must be a non-blank string.' };
      }

      if (!product.productName || product.productName.trim().length === 0) {
        return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'productName must be a non-blank string.' };
      }

      const ready = assertReady();
      if (ready) return ready;

      try {
        const docRef = doc(db, firestorePaths.productMaster(context.vendorId), product.productId);
        const payload: Record<string, unknown> = {
          ...product,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: context.actorId,
          updatedBy: context.actorId,
          sourceApp: context.sourceApp
        };
        await setDoc(docRef, payload);
        return { success: true, data: { ...product, createdAt: '', updatedAt: '' } };
      } catch (error) {
        const mapped = mapFirestoreError(error);
        return { success: false, errorCode: mapped.errorCode, errorMessage: mapped.errorMessage };
      }
    },

    async updateProduct(context: RepositoryOperationContext, productId: string, changes: Partial<SharedProductRecord>): Promise<{ success: boolean; data?: SharedProductRecord; errorCode?: string; errorMessage?: string }> {
      try {
        validateRepositoryOperationContext(context);
      } catch (validationError) {
        const message = validationError instanceof Error ? validationError.message : 'Invalid repository operation context.';
        return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: message };
      }

      if (!productId || productId.trim().length === 0) {
        return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'productId must be a non-blank string.' };
      }

      const ready = assertReady();
      if (ready) return ready;

      try {
        const docRef = doc(db, firestorePaths.productMaster(context.vendorId), productId);
        const snapshot = await getDoc(docRef);
        if (!snapshot.exists()) {
          return { success: false, errorCode: REPOSITORY_ERROR_CODES.NOT_FOUND, errorMessage: 'Product not found.' };
        }
        const existing = snapshot.data() as Record<string, unknown>;
        if (existing.vendorId !== context.vendorId) {
          return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'Cross-vendor document update is rejected.' };
        }
        await updateDoc(docRef, { ...changes, updatedAt: serverTimestamp(), updatedBy: context.actorId });
        const updated = { ...existing, ...changes, updatedAt: '', updatedBy: context.actorId };
        return { success: true, data: normalizeProduct(updated, context.vendorId) };
      } catch (error) {
        const mapped = mapFirestoreError(error);
        return { success: false, errorCode: mapped.errorCode, errorMessage: mapped.errorMessage };
      }
    },

    async deactivateProduct(context: RepositoryOperationContext, productId: string): Promise<{ success: boolean; data?: SharedProductRecord; errorCode?: string; errorMessage?: string }> {
      return this.updateProduct(context, productId, { status: 'INACTIVE' });
    },

    subscribeProducts(context: RepositoryOperationContext, listener: (records: SharedProductRecord[]) => void): { unsubscribe: () => void } {
      try {
        validateRepositoryOperationContext(context);
      } catch {
        return { unsubscribe: () => {} };
      }

      if (!firebaseReady || !db) {
        return { unsubscribe: () => {} };
      }

      const q = buildProductQuery(context.vendorId);
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const records: SharedProductRecord[] = [];
        snapshot.forEach((docSnapshot) => {
          const data = docSnapshot.data() as Record<string, unknown>;
          const record = normalizeProduct(data, context.vendorId);
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
