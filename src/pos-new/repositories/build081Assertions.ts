import { inventoryOperationId, projectTransferBalances } from './firestore/FirestoreInventoryRepository';
import { refundQuantityError, salesReversalId } from './firestore/FirestoreSalesRepository';
import { createFirestoreVendorRepository } from './firestore/FirestoreVendorRepository';
import type { RepositoryOperationContext } from './repositoryContext';
import { isFirebaseStorageMode, mayUseLocalOperationalAuthority } from '../utils/storageAuthority';

export interface Build081AssertionResult {
  name: string;
  passed: boolean;
  detail: string;
}

type DevelopmentAssertion = () => void | Promise<void>;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function check(name: string, assertion: DevelopmentAssertion): Promise<Build081AssertionResult> {
  try {
    await assertion();
    return { name, passed: true, detail: 'Passed' };
  } catch (error) {
    return { name, passed: false, detail: error instanceof Error ? error.message : 'Assertion failed.' };
  }
}

function context(vendorId = 'vendor-a'): RepositoryOperationContext {
  return { vendorId, branchId: 'branch-a', warehouseId: 'warehouse-a', actorId: 'actor-a', staffId: 'actor-a', sourceApp: 'ITRED_POS', correlationId: 'build-08-1-assertion' };
}

/** Development-only. Invoke explicitly from tests or diagnostics; never from production boot. */
export async function runBuild081Assertions(): Promise<Build081AssertionResult[]> {
  return Promise.all([
    check('Refund retries use one reversal identity', () => {
      const first = salesReversalId('REFUND', 'sale-a', 'refund-attempt-a');
      const retry = salesReversalId('REFUND', 'sale-a', 'refund-attempt-a');
      assert(first === retry, 'The same refund command generated a different reversal identity.');
    }),
    check('Void retries use one reversal identity', () => {
      const first = salesReversalId('VOID', 'sale-a', 'void-sale-a');
      const retry = salesReversalId('VOID', 'sale-a', 'void-sale-a');
      assert(first === retry, 'The same void command generated a different reversal identity.');
      assert(first !== salesReversalId('REFUND', 'sale-a', 'void-sale-a'), 'Void and refund identities collided.');
    }),
    check('Partial refund quantity limits are cumulative', () => {
      const saleLines = [{ saleLineId: 'line-a', quantity: 3, productName: 'Product A' }];
      assert(refundQuantityError([{ saleLineId: 'line-a', quantity: 1 }], saleLines, { 'line-a': 1 }) === null, 'A valid remaining partial quantity was rejected.');
      assert(refundQuantityError([{ saleLineId: 'line-a', quantity: 2 }], saleLines, { 'line-a': 2 })?.includes('exceeds'), 'A cumulative over-refund was accepted.');
    }),
    check('GRN posting identity prevents duplicate movement creation', () => {
      const first = inventoryOperationId('vendor-a', 'GRN', 'grn-a', 'product-a', 'GOODS_RECEIVED', 'warehouse-a');
      const retry = inventoryOperationId('vendor-a', 'GRN', 'grn-a', 'product-a', 'GOODS_RECEIVED', 'warehouse-a');
      assert(first === retry, 'A GRN retry generated a different inventory operation identity.');
    }),
    check('Stock transfer projection conserves total stock', () => {
      const projected = projectTransferBalances(10, 4, 3);
      assert(projected.sourceAfter === 7 && projected.destinationAfter === 7, 'Transfer balances were projected incorrectly.');
      assert(projected.sourceAfter + projected.destinationAfter === 14, 'Transfer created or destroyed stock.');
      let negativeBlocked = false;
      try { projectTransferBalances(2, 4, 3); } catch { negativeBlocked = true; }
      assert(negativeBlocked, 'A transfer that exceeds source stock was accepted.');
    }),
    check('Stocktake posting identity prevents duplicate variance creation', () => {
      const first = inventoryOperationId('vendor-a', 'STOCKTAKE', 'stocktake-a', 'product-a', 'STOCKTAKE_GAIN', 'warehouse-a');
      const retry = inventoryOperationId('vendor-a', 'STOCKTAKE', 'stocktake-a', 'product-a', 'STOCKTAKE_GAIN', 'warehouse-a');
      assert(first === retry, 'A stocktake retry generated a different inventory operation identity.');
    }),
    check('Vendor app access rejects cross-tenant changes', async () => {
      const result = await createFirestoreVendorRepository().updateVendorAppAccess(context(), 'ITRED_POS', { vendorId: 'vendor-b' });
      assert(!result.success, 'Cross-vendor app-access update was accepted.');
    }),
    check('Vendor profile rejects cross-tenant changes', async () => {
      const result = await createFirestoreVendorRepository().updateVendor(context(), 'vendor-b', { vendorName: 'Wrong Tenant' });
      assert(!result.success, 'Cross-vendor profile update was accepted.');
    }),
    check('Firebase mode disables local operational authority', () => {
      assert(isFirebaseStorageMode('firebase'), 'Firebase storage mode was not recognized.');
      assert(!mayUseLocalOperationalAuthority('firebase'), 'Firebase mode allowed local operational authority.');
      assert(mayUseLocalOperationalAuthority('local'), 'Local compatibility mode was disabled.');
    })
  ]);
}
