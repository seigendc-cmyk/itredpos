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
  const notImplVendor = (): VendorRepository => ({
    getVendor: () => Promise.resolve({ success: false, errorMessage: 'Local vendor repository is not implemented.' }),
    updateVendor: () => Promise.resolve({ success: false, errorMessage: 'Local vendor repository is not implemented.' }),
    listBranches: () => Promise.resolve({ success: false, records: [], errorMessage: 'Local vendor repository is not implemented.' }),
    getBranch: () => Promise.resolve({ success: false, errorMessage: 'Local vendor repository is not implemented.' }),
    createBranch: () => Promise.resolve({ success: false, errorMessage: 'Local vendor repository is not implemented.' }),
    updateBranch: () => Promise.resolve({ success: false, errorMessage: 'Local vendor repository is not implemented.' }),
    deactivateBranch: () => Promise.resolve({ success: false, errorMessage: 'Local vendor repository is not implemented.' }),
    subscribeBranches: () => ({ unsubscribe: () => {} }),
    listWarehouses: () => Promise.resolve({ success: false, records: [], errorMessage: 'Local vendor repository is not implemented.' }),
    getWarehouse: () => Promise.resolve({ success: false, errorMessage: 'Local vendor repository is not implemented.' }),
    createWarehouse: () => Promise.resolve({ success: false, errorMessage: 'Local vendor repository is not implemented.' }),
    updateWarehouse: () => Promise.resolve({ success: false, errorMessage: 'Local vendor repository is not implemented.' }),
    deactivateWarehouse: () => Promise.resolve({ success: false, errorMessage: 'Local vendor repository is not implemented.' }),
    subscribeWarehouses: () => ({ unsubscribe: () => {} }),
    listTerminals: () => Promise.resolve({ success: false, records: [], errorMessage: 'Local vendor repository is not implemented.' }),
    getTerminal: () => Promise.resolve({ success: false, errorMessage: 'Local vendor repository is not implemented.' }),
    createTerminal: () => Promise.resolve({ success: false, errorMessage: 'Local vendor repository is not implemented.' }),
    updateTerminal: () => Promise.resolve({ success: false, errorMessage: 'Local vendor repository is not implemented.' }),
    deactivateTerminal: () => Promise.resolve({ success: false, errorMessage: 'Local vendor repository is not implemented.' }),
    subscribeTerminals: () => ({ unsubscribe: () => {} }),
    listVendorAppAccess: () => Promise.resolve({ success: false, records: [], errorMessage: 'Local vendor repository is not implemented.' }),
    getVendorAppAccess: () => Promise.resolve({ success: false, errorMessage: 'Local vendor repository is not implemented.' }),
    updateVendorAppAccess: () => Promise.resolve({ success: false, errorMessage: 'Local vendor repository is not implemented.' }),
    subscribeVendorAppAccess: () => ({ unsubscribe: () => {} })
  });

  return {
    vendors: notImplVendor(),
    products: {
      getProduct: () => Promise.resolve({ success: false, errorMessage: 'Local product repository is not implemented.' }),
      getProductBySku: () => Promise.resolve({ success: false, errorMessage: 'Local product repository is not implemented.' }),
      getProductByBarcode: () => Promise.resolve({ success: false, errorMessage: 'Local product repository is not implemented.' }),
      listProducts: () => Promise.resolve({ success: false, records: [], errorMessage: 'Local product repository is not implemented.' }),
      searchProducts: () => Promise.resolve({ success: false, records: [], errorMessage: 'Local product repository is not implemented.' }),
      createProduct: () => Promise.resolve({ success: false, errorMessage: 'Local product repository is not implemented.' }),
      updateProduct: () => Promise.resolve({ success: false, errorMessage: 'Local product repository is not implemented.' }),
      deactivateProduct: () => Promise.resolve({ success: false, errorMessage: 'Local product repository is not implemented.' }),
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
      getMovement: () => Promise.resolve({ success: false, errorMessage: 'Local inventory repository is not implemented.' }),
      postMovement: () => Promise.resolve({ success: false, errorMessage: 'Local inventory repository is not implemented.' }),
      receiveStock: () => Promise.resolve({ success: false, errorMessage: 'Local inventory repository is not implemented.' }),
      adjustStock: () => Promise.resolve({ success: false, errorMessage: 'Local inventory repository is not implemented.' }),
      transferStock: () => Promise.resolve({ success: false, errorMessage: 'Local inventory repository is not implemented.' }),
      postStocktakeVariance: () => Promise.resolve({ success: false, errorMessage: 'Local inventory repository is not implemented.' }),
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
      const notImplVendor = (): VendorRepository => ({
        getVendor: () => Promise.resolve({ success: false, errorCode: 'REPOSITORY_CONFIGURATION_ERROR', errorMessage: 'Firebase is unavailable. Cannot create Firestore repository bundle.' }),
        updateVendor: () => Promise.resolve({ success: false, errorCode: 'REPOSITORY_CONFIGURATION_ERROR', errorMessage: 'Firebase is unavailable.' }),
        listBranches: () => Promise.resolve({ success: false, records: [], errorCode: 'REPOSITORY_CONFIGURATION_ERROR', errorMessage: 'Firebase is unavailable.' }),
        getBranch: () => Promise.resolve({ success: false, errorCode: 'REPOSITORY_CONFIGURATION_ERROR', errorMessage: 'Firebase is unavailable.' }),
        createBranch: () => Promise.resolve({ success: false, errorCode: 'REPOSITORY_CONFIGURATION_ERROR', errorMessage: 'Firebase is unavailable.' }),
        updateBranch: () => Promise.resolve({ success: false, errorCode: 'REPOSITORY_CONFIGURATION_ERROR', errorMessage: 'Firebase is unavailable.' }),
        deactivateBranch: () => Promise.resolve({ success: false, errorCode: 'REPOSITORY_CONFIGURATION_ERROR', errorMessage: 'Firebase is unavailable.' }),
        subscribeBranches: () => ({ unsubscribe: () => {} }),
        listWarehouses: () => Promise.resolve({ success: false, records: [], errorCode: 'REPOSITORY_CONFIGURATION_ERROR', errorMessage: 'Firebase is unavailable.' }),
        getWarehouse: () => Promise.resolve({ success: false, errorCode: 'REPOSITORY_CONFIGURATION_ERROR', errorMessage: 'Firebase is unavailable.' }),
        createWarehouse: () => Promise.resolve({ success: false, errorCode: 'REPOSITORY_CONFIGURATION_ERROR', errorMessage: 'Firebase is unavailable.' }),
        updateWarehouse: () => Promise.resolve({ success: false, errorCode: 'REPOSITORY_CONFIGURATION_ERROR', errorMessage: 'Firebase is unavailable.' }),
        deactivateWarehouse: () => Promise.resolve({ success: false, errorCode: 'REPOSITORY_CONFIGURATION_ERROR', errorMessage: 'Firebase is unavailable.' }),
        subscribeWarehouses: () => ({ unsubscribe: () => {} }),
        listTerminals: () => Promise.resolve({ success: false, records: [], errorCode: 'REPOSITORY_CONFIGURATION_ERROR', errorMessage: 'Firebase is unavailable.' }),
        getTerminal: () => Promise.resolve({ success: false, errorCode: 'REPOSITORY_CONFIGURATION_ERROR', errorMessage: 'Firebase is unavailable.' }),
        createTerminal: () => Promise.resolve({ success: false, errorCode: 'REPOSITORY_CONFIGURATION_ERROR', errorMessage: 'Firebase is unavailable.' }),
        updateTerminal: () => Promise.resolve({ success: false, errorCode: 'REPOSITORY_CONFIGURATION_ERROR', errorMessage: 'Firebase is unavailable.' }),
        deactivateTerminal: () => Promise.resolve({ success: false, errorCode: 'REPOSITORY_CONFIGURATION_ERROR', errorMessage: 'Firebase is unavailable.' }),
        subscribeTerminals: () => ({ unsubscribe: () => {} }),
        listVendorAppAccess: () => Promise.resolve({ success: false, records: [], errorCode: 'REPOSITORY_CONFIGURATION_ERROR', errorMessage: 'Firebase is unavailable.' }),
        getVendorAppAccess: () => Promise.resolve({ success: false, errorCode: 'REPOSITORY_CONFIGURATION_ERROR', errorMessage: 'Firebase is unavailable.' }),
        updateVendorAppAccess: () => Promise.resolve({ success: false, errorCode: 'REPOSITORY_CONFIGURATION_ERROR', errorMessage: 'Firebase is unavailable.' }),
        subscribeVendorAppAccess: () => ({ unsubscribe: () => {} })
      });

      return {
        vendors: notImplVendor(),
        products: {
          getProduct: () => Promise.resolve({ success: false, errorCode: 'REPOSITORY_CONFIGURATION_ERROR', errorMessage: 'Firebase is unavailable.' }),
          getProductBySku: () => Promise.resolve({ success: false, errorCode: 'REPOSITORY_CONFIGURATION_ERROR', errorMessage: 'Firebase is unavailable.' }),
          getProductByBarcode: () => Promise.resolve({ success: false, errorCode: 'REPOSITORY_CONFIGURATION_ERROR', errorMessage: 'Firebase is unavailable.' }),
          listProducts: () => Promise.resolve({ success: false, records: [], errorCode: 'REPOSITORY_CONFIGURATION_ERROR', errorMessage: 'Firebase is unavailable.' }),
          searchProducts: () => Promise.resolve({ success: false, records: [], errorCode: 'REPOSITORY_CONFIGURATION_ERROR', errorMessage: 'Firebase is unavailable.' }),
          createProduct: () => Promise.resolve({ success: false, errorCode: 'REPOSITORY_CONFIGURATION_ERROR', errorMessage: 'Firebase is unavailable.' }),
          updateProduct: () => Promise.resolve({ success: false, errorCode: 'REPOSITORY_CONFIGURATION_ERROR', errorMessage: 'Firebase is unavailable.' }),
          deactivateProduct: () => Promise.resolve({ success: false, errorCode: 'REPOSITORY_CONFIGURATION_ERROR', errorMessage: 'Firebase is unavailable.' }),
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
          getMovement: () => Promise.resolve({ success: false, errorCode: 'REPOSITORY_CONFIGURATION_ERROR', errorMessage: 'Firebase is unavailable.' }),
          postMovement: () => Promise.resolve({ success: false, errorCode: 'REPOSITORY_CONFIGURATION_ERROR', errorMessage: 'Firebase is unavailable.' }),
          receiveStock: () => Promise.resolve({ success: false, errorCode: 'REPOSITORY_CONFIGURATION_ERROR', errorMessage: 'Firebase is unavailable.' }),
          adjustStock: () => Promise.resolve({ success: false, errorCode: 'REPOSITORY_CONFIGURATION_ERROR', errorMessage: 'Firebase is unavailable.' }),
          transferStock: () => Promise.resolve({ success: false, errorCode: 'REPOSITORY_CONFIGURATION_ERROR', errorMessage: 'Firebase is unavailable.' }),
          postStocktakeVariance: () => Promise.resolve({ success: false, errorCode: 'REPOSITORY_CONFIGURATION_ERROR', errorMessage: 'Firebase is unavailable.' }),
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

