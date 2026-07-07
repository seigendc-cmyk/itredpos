export const FIRESTORE_COLLECTIONS = {
  vendors: 'vendors',
  vendorRegistrations: 'vendorRegistrations',
  vendorBranches: 'vendorBranches',
  vendorWarehouses: 'vendorWarehouses',
  vendorStaff: 'vendorStaff',
  vendorLicenses: 'vendorLicenses',
  vendorPlans: 'vendorPlans',
  plans: 'plans',
  activationTokens: 'activationTokens',
  activationCodes: 'activationCodes',
  vendorPayments: 'vendorPayments',
  vendorInvoices: 'vendorInvoices',
  vendorSyncStatus: 'vendorSyncStatus',
  vendorSyncEvents: 'vendorSyncEvents',
  vendorAuditLogs: 'vendorAuditLogs'
} as const;

export type FirestoreCollectionKey = keyof typeof FIRESTORE_COLLECTIONS;
export type FirestoreCollectionName = (typeof FIRESTORE_COLLECTIONS)[FirestoreCollectionKey];
