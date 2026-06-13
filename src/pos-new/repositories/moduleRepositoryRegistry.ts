import { firestoreDataContracts } from '../firebase/firestoreDataRegistry';
import { getRepositoryModeForModule } from './repositoryConfig';
import type { ModuleRepositoryDescriptor, RepositoryHealthStatus } from './repositoryTypes';

const offlineEnabled = new Set([
  'productMaster',
  'productStockBalances',
  'productImportBatches',
  'customers',
  'purchaseOrders',
  'goodsReceivingNotes',
  'supplierReturns',
  'stockAdjustments',
  'stocktakes',
  'stockTransfers',
  'inventoryMovements',
  'productLedger',
  'salesReceipts',
  'payments',
  'deliveryRequests',
  'approvals',
  'tasks',
  'biEvents',
  'auditEvents',
  'offlineSyncQueue',
  'syncConflicts',
  'accountingReadiness'
]);

const readableName = (entityType: string): string => entityType
  .replace(/([A-Z])/g, ' $1')
  .replace(/^./, (value) => value.toUpperCase());

const descriptor = (
  moduleName: string,
  entityName: string,
  collectionPathName: string,
  notes = 'Repository boundary prepared. Existing mock/local service remains authoritative.'
): ModuleRepositoryDescriptor => {
  const sourceMode = getRepositoryModeForModule(moduleName);
  const healthStatus: RepositoryHealthStatus = sourceMode === 'MockLocal' || sourceMode === 'LocalStorage' ? 'Healthy' : 'Disabled';
  return {
    moduleName,
    entityName,
    collectionPathName,
    sourceMode,
    liveReadsEnabled: false,
    liveWritesEnabled: false,
    offlineQueueEnabled: offlineEnabled.has(entityName),
    healthStatus,
    notes
  };
};

const contractDescriptors = firestoreDataContracts.map((contract) => descriptor(
  readableName(contract.entityType),
  contract.entityType,
  contract.collectionPathName,
  contract.notes
));

const extraDescriptors = [
  descriptor('Customer Requests', 'customerRequests', 'customerRequests'),
  descriptor('Delivery Providers', 'deliveryProviders', 'deliveryProviders'),
  descriptor('Chart Of Accounts', 'chartOfAccounts', 'chartOfAccounts', 'Contract only. Accounting repository activation is deferred.')
];

export const moduleRepositoryDescriptors: ModuleRepositoryDescriptor[] = [
  ...contractDescriptors,
  ...extraDescriptors
].sort((a, b) => a.moduleName.localeCompare(b.moduleName));

export function getModuleRepositoryDescriptor(moduleName: string): ModuleRepositoryDescriptor | undefined {
  return moduleRepositoryDescriptors.find((descriptorRow) => descriptorRow.moduleName === moduleName || descriptorRow.entityName === moduleName);
}

