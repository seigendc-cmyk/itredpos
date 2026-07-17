import {
  firestorePaths,
  firestoreCollectionNames,
  encodeFirestoreId
} from '../pos-new/firebase/firestorePaths';

export { firestorePaths, firestoreCollectionNames, encodeFirestoreId };

export type TenantContext = {
  vendorId: string;
  branchId?: string;
  warehouseId?: string;
  terminalId?: string;
  staffId?: string;
};

/**
 * Prevents a query from executing with an unresolved tenant context.
 * Centralised guard used by services/repositories before any Firestore read.
 */
export function assertTenantContext(context: TenantContext | null | undefined): asserts context is TenantContext {
  if (!context || typeof context.vendorId !== 'string' || context.vendorId.trim().length === 0) {
    throw new Error('Tenant context is unresolved: vendorId is required before any Firestore operation.');
  }
}

/**
 * Builds the canonical vendor-scoped collection path used by security rules.
 * Every tenant-owned collection must be reached through this helper so the
 * vendor boundary is never supplied as a free-form string by callers.
 */
export function vendorScopedPath(vendorId: string, collectionName: string, docId?: string): string {
  const base = `vendors/${encodeFirestoreId(vendorId)}/${collectionName}`;
  return docId ? `${base}/${encodeFirestoreId(docId)}` : base;
}
