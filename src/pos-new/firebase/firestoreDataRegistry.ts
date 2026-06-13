import {
  accountingReadinessFromFirestore,
  accountingReadinessToFirestore,
  approvalRequestFromFirestore,
  approvalRequestToFirestore,
  customerFromFirestore,
  customerToFirestore,
  deliveryRequestFromFirestore,
  deliveryRequestToFirestore,
  goodsReceivingFromFirestore,
  goodsReceivingToFirestore,
  inventoryMovementFromFirestore,
  inventoryMovementToFirestore,
  offlineQueueItemFromFirestore,
  offlineQueueItemToFirestore,
  productMasterFromFirestore,
  productMasterToFirestore,
  purchaseOrderFromFirestore,
  purchaseOrderToFirestore,
  salesReceiptFromFirestore,
  salesReceiptToFirestore,
  stockBalanceFromFirestore,
  stockBalanceToFirestore,
  type AppModel
} from './firestoreMappers';
import {
  validateFirestoreContract,
  validateInventoryMovementDoc,
  validateOfflineQueueDoc,
  validateProductMasterDoc,
  validateSalesReceiptDoc,
  validateStockBalanceDoc,
  validateVendorScopedDoc,
  type FirestoreValidationResult
} from './firestoreValidation';

export interface FirestoreDataContractRegistryEntry {
  entityType: string;
  collectionPathName: string;
  pathHelperName: string;
  documentContractName: string;
  mapperToFirestore: (model: AppModel) => AppModel;
  mapperFromFirestore: (doc: AppModel) => AppModel;
  validationFunction: (doc: unknown) => FirestoreValidationResult;
  liveWritesEnabled: false;
  liveReadsEnabled: false;
  offlineSyncEnabledPlaceholder: boolean;
  notes: string;
}

const passThroughToFirestore = (model: AppModel): AppModel => ({ ...model, schemaVersion: Number(model.schemaVersion || 1), syncVersion: Number(model.syncVersion || 1), deleted: Boolean(model.deleted) });
const passThroughFromFirestore = (doc: AppModel): AppModel => ({ ...doc });

const entry = (
  entityType: string,
  collectionPathName: string,
  pathHelperName: string,
  documentContractName: string,
  mapperToFirestore: (model: AppModel) => AppModel = passThroughToFirestore,
  mapperFromFirestore: (doc: AppModel) => AppModel = passThroughFromFirestore,
  validationFunction: (doc: unknown) => FirestoreValidationResult = validateVendorScopedDoc,
  offlineSyncEnabledPlaceholder = true,
  notes = 'Contract only. Reads and writes remain disabled.'
): FirestoreDataContractRegistryEntry => ({
  entityType,
  collectionPathName,
  pathHelperName,
  documentContractName,
  mapperToFirestore,
  mapperFromFirestore,
  validationFunction,
  liveWritesEnabled: false,
  liveReadsEnabled: false,
  offlineSyncEnabledPlaceholder,
  notes
});

export const firestoreDataContracts = [
  entry('productMaster', 'productMaster', 'firestorePaths.productMaster', 'FirestoreProductMasterDoc', productMasterToFirestore, productMasterFromFirestore, validateProductMasterDoc),
  entry('productStockBalances', 'productStockBalances', 'firestorePaths.productStockBalances', 'FirestoreProductStockBalanceDoc', stockBalanceToFirestore, stockBalanceFromFirestore, validateStockBalanceDoc),
  entry('productImportBatches', 'productImportBatches', 'firestorePaths.productImportBatches', 'FirestoreProductImportBatchDoc'),
  entry('customers', 'customers', 'firestorePaths.customers', 'FirestoreCustomerDoc', customerToFirestore, customerFromFirestore),
  entry('purchaseOrders', 'purchaseOrders', 'firestorePaths.purchaseOrders', 'FirestorePurchaseOrderDoc', purchaseOrderToFirestore, purchaseOrderFromFirestore),
  entry('goodsReceivingNotes', 'goodsReceivingNotes', 'firestorePaths.goodsReceivingNotes', 'FirestoreGoodsReceivingDoc', goodsReceivingToFirestore, goodsReceivingFromFirestore),
  entry('supplierReturns', 'supplierReturns', 'firestorePaths.supplierReturns', 'FirestoreSupplierReturnDoc'),
  entry('stockAdjustments', 'stockAdjustments', 'firestorePaths.stockAdjustments', 'FirestoreStockAdjustmentDoc'),
  entry('stocktakes', 'stocktakes', 'firestorePaths.stocktakes', 'FirestoreStocktakeDoc'),
  entry('stockTransfers', 'stockTransfers', 'firestorePaths.stockTransfers', 'FirestoreStockTransferDoc'),
  entry('inventoryMovements', 'inventoryMovements', 'firestorePaths.inventoryMovements', 'FirestoreInventoryMovementDoc', inventoryMovementToFirestore, inventoryMovementFromFirestore, validateInventoryMovementDoc),
  entry('productLedger', 'productLedger', 'firestorePaths.productLedger', 'FirestoreProductLedgerDoc', inventoryMovementToFirestore, inventoryMovementFromFirestore, validateInventoryMovementDoc),
  entry('salesReceipts', 'salesReceipts', 'firestorePaths.salesReceipts', 'FirestoreSalesReceiptDoc', salesReceiptToFirestore, salesReceiptFromFirestore, validateSalesReceiptDoc),
  entry('payments', 'payments', 'firestorePaths.payments', 'FirestorePaymentDoc'),
  entry('deliveryRequests', 'deliveryRequests', 'firestorePaths.deliveryRequests', 'FirestoreDeliveryRequestDoc', deliveryRequestToFirestore, deliveryRequestFromFirestore),
  entry('approvals', 'approvals', 'firestorePaths.approvals', 'FirestoreApprovalDoc', approvalRequestToFirestore, approvalRequestFromFirestore),
  entry('tasks', 'tasks', 'firestorePaths.tasks', 'FirestoreTaskDoc'),
  entry('biEvents', 'biEvents', 'firestorePaths.biEvents', 'FirestoreBIEventDoc'),
  entry('auditEvents', 'auditEvents', 'firestorePaths.auditEvents', 'FirestoreAuditEventDoc'),
  entry('offlineSyncQueue', 'offlineSyncQueue', 'firestorePaths.offlineSyncQueue', 'FirestoreOfflineSyncQueueDoc', offlineQueueItemToFirestore, offlineQueueItemFromFirestore, validateOfflineQueueDoc),
  entry('syncConflicts', 'syncConflicts', 'firestorePaths.syncConflicts', 'FirestoreSyncConflictDoc'),
  entry('accountingReadiness', 'accountingReadiness', 'firestorePaths.accountingReadiness', 'FirestoreAccountingReadinessDoc', accountingReadinessToFirestore, accountingReadinessFromFirestore)
] as const;

export function getFirestoreContractStatus() {
  return {
    ready: firestoreDataContracts.length > 0,
    mappedEntitiesCount: firestoreDataContracts.length,
    liveReads: 'Disabled',
    liveWrites: 'Disabled',
    repositories: 'Disabled Placeholder',
    nextStep: 'Repository Layer Activation'
  };
}

export { validateFirestoreContract };

