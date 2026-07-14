import type { CommerceSourceApp } from './commerceDataContract';

export type CollectionAuthority =
  | 'SHARED_MASTER'
  | 'OPERATIONAL_LEDGER'
  | 'DERIVED_READ_MODEL'
  | 'AUDIT_LOG'
  | 'SYNC_QUEUE';

export interface CollectionGovernanceRule {
  collectionName: string;
  authority: CollectionAuthority;
  owningDomain: string;
  sharedWith: CommerceSourceApp[];
  immutable: boolean;
  vendorScoped: boolean;
}

export const collectionGovernanceRules: CollectionGovernanceRule[] = [
  {
    collectionName: 'vendors',
    authority: 'SHARED_MASTER',
    owningDomain: 'POS',
    sharedWith: ['ITRED_POS', 'ITRED_CONSOLE', 'ITRED_DISCOVERY', 'MARKETSPACE', 'IDELIVER', 'SYSTEM'],
    immutable: true,
    vendorScoped: true
  },
  {
    collectionName: 'branches',
    authority: 'SHARED_MASTER',
    owningDomain: 'POS',
    sharedWith: ['ITRED_POS', 'ITRED_CONSOLE', 'IDELIVER', 'SYSTEM'],
    immutable: false,
    vendorScoped: true
  },
  {
    collectionName: 'warehouses',
    authority: 'SHARED_MASTER',
    owningDomain: 'POS',
    sharedWith: ['ITRED_POS', 'ITRED_CONSOLE', 'IDELIVER', 'SYSTEM'],
    immutable: false,
    vendorScoped: true
  },
  {
    collectionName: 'terminals',
    authority: 'SHARED_MASTER',
    owningDomain: 'POS',
    sharedWith: ['ITRED_POS', 'SYSTEM'],
    immutable: false,
    vendorScoped: true
  },
  {
    collectionName: 'productMaster',
    authority: 'SHARED_MASTER',
    owningDomain: 'POS',
    sharedWith: ['ITRED_POS', 'ITRED_CONSOLE', 'ITRED_DISCOVERY', 'MARKETSPACE', 'IDELIVER', 'CASHPLAN', 'POOLWISE', 'SYSTEM'],
    immutable: false,
    vendorScoped: true
  },
  {
    collectionName: 'productStockBalances',
    authority: 'DERIVED_READ_MODEL',
    owningDomain: 'POS',
    sharedWith: ['ITRED_POS', 'ITRED_CONSOLE', 'ITRED_DISCOVERY', 'MARKETSPACE', 'IDELIVER', 'CASHPLAN', 'POOLWISE', 'SYSTEM'],
    immutable: true,
    vendorScoped: true
  },
  {
    collectionName: 'customers',
    authority: 'SHARED_MASTER',
    owningDomain: 'POS',
    sharedWith: ['ITRED_POS', 'ITRED_CONSOLE', 'MARKETSPACE', 'IDELIVER', 'SYSTEM'],
    immutable: false,
    vendorScoped: true
  },
  {
    collectionName: 'customerAddresses',
    authority: 'SHARED_MASTER',
    owningDomain: 'CUSTOMER',
    sharedWith: ['ITRED_POS', 'ITRED_CONSOLE', 'ITRED_DISCOVERY', 'MARKETSPACE', 'IDELIVER', 'SYSTEM'],
    immutable: false,
    vendorScoped: true
  },
  {
    collectionName: 'customerInteractions',
    authority: 'OPERATIONAL_LEDGER',
    owningDomain: 'CUSTOMER',
    sharedWith: ['ITRED_POS', 'ITRED_CONSOLE', 'ITRED_DISCOVERY', 'MARKETSPACE', 'IDELIVER', 'SYSTEM'],
    immutable: true,
    vendorScoped: true
  },
  {
    collectionName: 'customerRequests',
    authority: 'OPERATIONAL_LEDGER',
    owningDomain: 'CUSTOMER',
    sharedWith: ['ITRED_POS', 'ITRED_CONSOLE', 'ITRED_DISCOVERY', 'MARKETSPACE', 'IDELIVER', 'SYSTEM'],
    immutable: false,
    vendorScoped: true
  },
  {
    collectionName: 'inventoryMovements',
    authority: 'OPERATIONAL_LEDGER',
    owningDomain: 'POS',
    sharedWith: ['ITRED_POS', 'ITRED_CONSOLE', 'IDELIVER', 'SYSTEM'],
    immutable: true,
    vendorScoped: true
  },
  {
    collectionName: 'salesReceipts',
    authority: 'OPERATIONAL_LEDGER',
    owningDomain: 'POS',
    sharedWith: ['ITRED_POS', 'ITRED_CONSOLE', 'CASHPLAN', 'SYSTEM'],
    immutable: true,
    vendorScoped: true
  },
  {
    collectionName: 'payments',
    authority: 'OPERATIONAL_LEDGER',
    owningDomain: 'POS',
    sharedWith: ['ITRED_POS', 'ITRED_CONSOLE', 'CASHPLAN', 'SYSTEM'],
    immutable: true,
    vendorScoped: true
  },
  {
    collectionName: 'marketplaceListings',
    authority: 'SHARED_MASTER',
    owningDomain: 'MARKETSPACE',
    sharedWith: ['ITRED_POS', 'ITRED_CONSOLE', 'MARKETSPACE', 'SYSTEM'],
    immutable: false,
    vendorScoped: true
  },
  {
    collectionName: 'marketplaceOrders',
    authority: 'OPERATIONAL_LEDGER',
    owningDomain: 'MARKETSPACE',
    sharedWith: ['ITRED_POS', 'ITRED_CONSOLE', 'MARKETSPACE', 'IDELIVER', 'SYSTEM'],
    immutable: true,
    vendorScoped: true
  },
  {
    collectionName: 'deliveries',
    authority: 'OPERATIONAL_LEDGER',
    owningDomain: 'IDELIVER',
    sharedWith: ['ITRED_POS', 'IDELIVER', 'SYSTEM'],
    immutable: true,
    vendorScoped: true
  },
  {
    collectionName: 'biEvents',
    authority: 'OPERATIONAL_LEDGER',
    owningDomain: 'BI',
    sharedWith: ['ITRED_POS', 'ITRED_CONSOLE', 'ITRED_DISCOVERY', 'MARKETSPACE', 'IDELIVER', 'CASHPLAN', 'POOLWISE', 'SYSTEM'],
    immutable: true,
    vendorScoped: true
  },
  {
    collectionName: 'audit_logs',
    authority: 'AUDIT_LOG',
    owningDomain: 'SYSTEM',
    sharedWith: ['ITRED_POS', 'ITRED_CONSOLE', 'ITRED_DISCOVERY', 'MARKETSPACE', 'IDELIVER', 'CASHPLAN', 'POOLWISE', 'SYSTEM'],
    immutable: true,
    vendorScoped: true
  },
  {
    collectionName: 'offlineSyncQueue',
    authority: 'SYNC_QUEUE',
    owningDomain: 'POS',
    sharedWith: ['ITRED_POS', 'SYSTEM'],
    immutable: true,
    vendorScoped: true
  }
];

export function getGovernanceRule(collectionName: string): CollectionGovernanceRule | undefined {
  return collectionGovernanceRules.find((rule) => rule.collectionName === collectionName);
}
