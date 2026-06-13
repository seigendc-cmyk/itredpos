import { encodeFirestoreId } from './firestorePaths';

export const sandboxAllowedCollections = [
  'sandboxConnectivityTests',
  'sandboxRepositoryTests',
  'vendors/{vendorId}/sandboxNotes',
  'vendors/{vendorId}/sandboxRepositoryTests'
];

export const sandboxBlockedCollections = [
  'salesReceipts',
  'payments',
  'productMaster',
  'productStockBalances',
  'inventoryMovements',
  'productLedger',
  'customers',
  'deliveryRequests',
  'approvals',
  'accountingReadiness',
  'offlineSyncQueue',
  'stockAdjustments',
  'stocktakes',
  'stockTransfers',
  'purchaseOrders',
  'goodsReceivingNotes',
  'supplierReturns'
];

export const firestoreSandboxPaths = {
  globalConnectivityTests: () => 'sandboxConnectivityTests',
  globalRepositoryTests: () => 'sandboxRepositoryTests',
  vendorSandboxNotes: (vendorId: string) => `vendors/${encodeFirestoreId(vendorId)}/sandboxNotes`,
  vendorSandboxRepositoryTests: (vendorId: string) => `vendors/${encodeFirestoreId(vendorId)}/sandboxRepositoryTests`
};

const normalizePath = (path: string): string => path.trim().replace(/^\/+|\/+$/g, '');

export function isSandboxCollectionAllowed(path: string): boolean {
  const normalized = normalizePath(path);
  if (!normalized) return false;
  if (sandboxBlockedCollections.some((blocked) => normalized.split('/').includes(blocked))) return false;
  if (normalized === 'sandboxConnectivityTests' || normalized === 'sandboxRepositoryTests') return true;
  const parts = normalized.split('/');
  return parts.length === 3 && parts[0] === 'vendors' && Boolean(parts[1]) && (parts[2] === 'sandboxNotes' || parts[2] === 'sandboxRepositoryTests');
}

