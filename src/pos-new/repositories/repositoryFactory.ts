import { createDisabledFirestoreRepository } from './disabledFirestoreRepository';
import { createMockLocalRepository } from './mockLocalRepository';
import type { BaseRepository, ModuleRepositoryDescriptor } from './repositoryTypes';
import { db, firebaseReady } from '../firebase/firebaseApp';
import { createFirestoreVendorRepository } from './firestore/FirestoreVendorRepository';
import { createFirestoreProductRepository } from './firestore/FirestoreProductRepository';
import { createFirestoreCustomerRepository } from './firestore/FirestoreCustomerRepository';
import { createFirestoreInventoryRepository } from './firestore/FirestoreInventoryRepository';
import { createFirestoreBIEventRepository } from './firestore/FirestoreBIEventRepository';
import { createFirestoreAuditRepository } from './firestore/FirestoreAuditRepository';
import type { VendorRepository } from './VendorRepository';
import type { ProductRepository } from './ProductRepository';
import type { CustomerRepository } from './CustomerRepository';
import type { InventoryRepository } from './InventoryRepository';
import type { BIEventRepository } from './BIEventRepository';
import type { AuditRepository } from './AuditRepository';

export type RepositoryStorageMode = 'firebase' | 'local';

const notImplemented = <T>(): T => {
  throw new Error('Local repository adapter is not implemented for this build.');
};

export function createRepository<T extends { id?: string }>(
  descriptor: ModuleRepositoryDescriptor,
  initialRows: T[] = []
): BaseRepository<T> {
  if (descriptor.sourceMode === 'MockLocal') {
    return createMockLocalRepository({ entityName: descriptor.entityName, initialRows });
  }

  if (descriptor.sourceMode === 'LocalStorage') {
    return createMockLocalRepository({
      entityName: descriptor.entityName,
      initialRows,
      persistKey: `itred_repo_${descriptor.entityName}`
    });
  }

  return createDisabledFirestoreRepository<T>(descriptor.entityName);
}

export interface RepositoryBundle {
  vendors: VendorRepository;
  products: ProductRepository;
  customers: CustomerRepository;
  inventory: InventoryRepository;
  biEvents: BIEventRepository;
  audit: AuditRepository;
}

function createLocalAdapters(): RepositoryBundle {
  return {
    vendors: {
      getVendor: () => Promise.resolve({ success: false, errorMessage: 'Local vendor repository is not implemented.' }),
      listBranches: () => Promise.resolve({ success: false, records: [], errorMessage: 'Local vendor repository is not implemented.' }),
      listWarehouses: () => Promise.resolve({ success: false, records: [], errorMessage: 'Local vendor repository is not implemented.' }),
      listTerminals: () => Promise.resolve({ success: false, records: [], errorMessage: 'Local vendor repository is not implemented.' })
    } as VendorRepository,
    products: {
      getProduct: () => Promise.resolve({ success: false, errorMessage: 'Local product repository is not implemented.' }),
      listProducts: () => Promise.resolve({ success: false, records: [], errorMessage: 'Local product repository is not implemented.' }),
      createProduct: () => Promise.resolve({ success: false, errorMessage: 'Local product repository is not implemented.' }),
      updateProduct: () => Promise.resolve({ success: false, errorMessage: 'Local product repository is not implemented.' }),
      subscribeProducts: () => ({ unsubscribe: () => {} })
    } as ProductRepository,
    customers: {
      getCustomer: () => Promise.resolve({ success: false, errorMessage: 'Local customer repository is not implemented.' }),
      listCustomers: () => Promise.resolve({ success: false, records: [], errorMessage: 'Local customer repository is not implemented.' }),
      createCustomer: () => Promise.resolve({ success: false, errorMessage: 'Local customer repository is not implemented.' }),
      updateCustomer: () => Promise.resolve({ success: false, errorMessage: 'Local customer repository is not implemented.' }),
      subscribeCustomers: () => ({ unsubscribe: () => {} })
    } as CustomerRepository,
    inventory: {
      getBalance: () => Promise.resolve({ success: false, errorMessage: 'Local inventory repository is not implemented.' }),
      listBalances: () => Promise.resolve({ success: false, records: [], errorMessage: 'Local inventory repository is not implemented.' }),
      listMovements: () => Promise.resolve({ success: false, records: [], errorMessage: 'Local inventory repository is not implemented.' }),
      postMovement: () => Promise.resolve({ success: false, errorMessage: 'Local inventory repository is not implemented.' }),
      subscribeBalances: () => ({ unsubscribe: () => {} })
    } as InventoryRepository,
    biEvents: {
      publishEvent: () => Promise.resolve({ success: false, errorMessage: 'Local BI event repository is not implemented.' }),
      listEvents: () => Promise.resolve({ success: false, records: [], errorMessage: 'Local BI event repository is not implemented.' }),
      subscribeEvents: () => ({ unsubscribe: () => {} })
    } as BIEventRepository,
    audit: {
      appendAuditRecord: () => Promise.resolve({ success: false, errorMessage: 'Local audit repository is not implemented.' }),
      listAuditRecords: () => Promise.resolve({ success: false, records: [], errorMessage: 'Local audit repository is not implemented.' })
    } as AuditRepository
  };
}

export function createRepositoryBundle(): RepositoryBundle {
  const storageMode = (import.meta.env.VITE_STORAGE_MODE as RepositoryStorageMode) || 'local';

  if (storageMode === 'firebase') {
    if (!firebaseReady || !db) {
      const error: RepositoryBundle = {
        vendors: {
          getVendor: () => Promise.resolve({ success: false, errorCode: 'REPOSITORY_CONFIGURATION_ERROR', errorMessage: 'Firebase is unavailable. Cannot create Firestore repository bundle.' }),
          listBranches: () => Promise.resolve({ success: false, records: [], errorCode: 'REPOSITORY_CONFIGURATION_ERROR', errorMessage: 'Firebase is unavailable.' }),
          listWarehouses: () => Promise.resolve({ success: false, records: [], errorCode: 'REPOSITORY_CONFIGURATION_ERROR', errorMessage: 'Firebase is unavailable.' }),
          listTerminals: () => Promise.resolve({ success: false, records: [], errorCode: 'REPOSITORY_CONFIGURATION_ERROR', errorMessage: 'Firebase is unavailable.' })
        } as VendorRepository,
        products: {
          getProduct: () => Promise.resolve({ success: false, errorCode: 'REPOSITORY_CONFIGURATION_ERROR', errorMessage: 'Firebase is unavailable.' }),
          listProducts: () => Promise.resolve({ success: false, records: [], errorCode: 'REPOSITORY_CONFIGURATION_ERROR', errorMessage: 'Firebase is unavailable.' }),
          createProduct: () => Promise.resolve({ success: false, errorCode: 'REPOSITORY_CONFIGURATION_ERROR', errorMessage: 'Firebase is unavailable.' }),
          updateProduct: () => Promise.resolve({ success: false, errorCode: 'REPOSITORY_CONFIGURATION_ERROR', errorMessage: 'Firebase is unavailable.' }),
          subscribeProducts: () => ({ unsubscribe: () => {} })
        } as ProductRepository,
        customers: {
          getCustomer: () => Promise.resolve({ success: false, errorCode: 'REPOSITORY_CONFIGURATION_ERROR', errorMessage: 'Firebase is unavailable.' }),
          listCustomers: () => Promise.resolve({ success: false, records: [], errorCode: 'REPOSITORY_CONFIGURATION_ERROR', errorMessage: 'Firebase is unavailable.' }),
          createCustomer: () => Promise.resolve({ success: false, errorCode: 'REPOSITORY_CONFIGURATION_ERROR', errorMessage: 'Firebase is unavailable.' }),
          updateCustomer: () => Promise.resolve({ success: false, errorCode: 'REPOSITORY_CONFIGURATION_ERROR', errorMessage: 'Firebase is unavailable.' }),
          subscribeCustomers: () => ({ unsubscribe: () => {} })
        } as CustomerRepository,
        inventory: {
          getBalance: () => Promise.resolve({ success: false, errorCode: 'REPOSITORY_CONFIGURATION_ERROR', errorMessage: 'Firebase is unavailable.' }),
          listBalances: () => Promise.resolve({ success: false, records: [], errorCode: 'REPOSITORY_CONFIGURATION_ERROR', errorMessage: 'Firebase is unavailable.' }),
          listMovements: () => Promise.resolve({ success: false, records: [], errorCode: 'REPOSITORY_CONFIGURATION_ERROR', errorMessage: 'Firebase is unavailable.' }),
          postMovement: () => Promise.resolve({ success: false, errorCode: 'REPOSITORY_CONFIGURATION_ERROR', errorMessage: 'Firebase is unavailable.' }),
          subscribeBalances: () => ({ unsubscribe: () => {} })
        } as InventoryRepository,
        biEvents: {
          publishEvent: () => Promise.resolve({ success: false, errorCode: 'REPOSITORY_CONFIGURATION_ERROR', errorMessage: 'Firebase is unavailable.' }),
          listEvents: () => Promise.resolve({ success: false, records: [], errorCode: 'REPOSITORY_CONFIGURATION_ERROR', errorMessage: 'Firebase is unavailable.' }),
          subscribeEvents: () => ({ unsubscribe: () => {} })
        } as BIEventRepository,
        audit: {
          appendAuditRecord: () => Promise.resolve({ success: false, errorCode: 'REPOSITORY_CONFIGURATION_ERROR', errorMessage: 'Firebase is unavailable.' }),
          listAuditRecords: () => Promise.resolve({ success: false, records: [], errorCode: 'REPOSITORY_CONFIGURATION_ERROR', errorMessage: 'Firebase is unavailable.' })
        } as AuditRepository
      };
      return error;
    }

    return {
      vendors: createFirestoreVendorRepository(),
      products: createFirestoreProductRepository(),
      customers: createFirestoreCustomerRepository(),
      inventory: createFirestoreInventoryRepository(),
      biEvents: createFirestoreBIEventRepository(),
      audit: createFirestoreAuditRepository()
    };
  }

  return createLocalAdapters();
}

