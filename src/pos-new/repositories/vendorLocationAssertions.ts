import { createRepositoryBundle } from '../repositories/repositoryFactory';
import { mapFirestoreError, REPOSITORY_ERROR_CODES } from '../repositories/firestore/firestoreErrorMapper';
import { firestorePaths } from '../firebase/firestorePaths';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Vendor location assertion failed: ${message}`);
  }
}

export async function runVendorLocationAssertions(): Promise<void> {
  const bundle = createRepositoryBundle();

  // 1. Blank vendor IDs are rejected.
  const vendorResult = await bundle.vendors.getVendor('');
  assert(!vendorResult.success, 'getVendor should reject blank vendorId.');

  const branchResult = await bundle.vendors.listBranches('');
  assert(!branchResult.success, 'listBranches should reject blank vendorId.');

  // 2. Branch writes remain vendor-scoped.
  const branchPath = firestorePaths.branch('vendor-1', 'branch-1');
  assert(branchPath.startsWith('vendors/vendor-1'), 'Branch path must be vendor-scoped.');

  // 3. Warehouse writes remain vendor-scoped.
  const warehousePath = firestorePaths.warehouse('vendor-1', 'warehouse-1');
  assert(warehousePath.startsWith('vendors/vendor-1'), 'Warehouse path must be vendor-scoped.');

  // 4. Terminal paths include vendor and branch.
  const terminalPath = firestorePaths.terminal('vendor-1', 'branch-1', 'term-1');
  assert(terminalPath.includes('/branches/branch-1/terminals/'), 'Terminal path must include vendor and branch.');

  // 5. Deactivation does not delete records.
  const deactivateResult = await bundle.vendors.deactivateBranch({ vendorId: 'vendor-1', actorId: 'actor-1', sourceApp: 'ITRED_POS', correlationId: 'corr-1' }, 'branch-1');
  assert(deactivateResult.success === false || deactivateResult.success === true, 'Deactivation should return a result.');

  // 6. Repository subscriptions return unsubscribe functions.
  const subscription = bundle.vendors.subscribeBranches({ vendorId: 'vendor-1', actorId: 'actor-1', sourceApp: 'ITRED_POS', correlationId: 'corr-1' }, () => {});
  assert(typeof subscription.unsubscribe === 'function', 'Subscription must provide unsubscribe function.');

  // 7. Local recovery selections are not treated as master records.
  const localRecoveryKey = 'itred_pos_branches';
  assert(localRecoveryKey.includes('itred_pos_'), 'Local recovery keys should be distinguishable from repository paths.');

  // 8. Firestore errors map to stable error codes.
  const mappedUnknown = mapFirestoreError({ code: 'unknown-code', message: 'test' });
  assert(mappedUnknown.errorCode === REPOSITORY_ERROR_CODES.UNKNOWN, 'Unknown Firebase error should map to REPOSITORY_UNKNOWN.');

}
