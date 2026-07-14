import { COMMERCE_SCHEMA_VERSION, type SharedInventoryMovementRecord } from '../firebase/commerceDataContract';
import { firestorePaths } from '../firebase/firestorePaths';
import { createFirestoreInventoryRepository } from './firestore/FirestoreInventoryRepository';
import { createRepositoryBundle } from './repositoryFactory';
import type { RepositoryOperationContext } from './repositoryContext';

export interface InventoryAssertionResult { name: string; passed: boolean; detail: string; }
type Assertion = () => void | Promise<void>;

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
async function check(name: string, assertion: Assertion): Promise<InventoryAssertionResult> {
  try { await assertion(); return { name, passed: true, detail: 'Passed' }; }
  catch (error) { return { name, passed: false, detail: error instanceof Error ? error.message : 'Assertion failed.' }; }
}

function context(overrides: Partial<RepositoryOperationContext> = {}): RepositoryOperationContext {
  return { vendorId: 'vendor-a', branchId: 'branch-a', warehouseId: 'warehouse-a', actorId: 'actor-a', staffId: 'actor-a', sourceApp: 'ITRED_POS', correlationId: 'inventory-assertion', ...overrides };
}

/** Development-only. Invoke explicitly from tests or diagnostics; never from production boot. */
export async function runInventoryAssertions(): Promise<InventoryAssertionResult[]> {
  const repository = createFirestoreInventoryRepository();
  const blankContext = context({ vendorId: '' });
  return Promise.all([
    check('Blank vendor context is rejected', async () => {
      const result = await repository.listBalances(blankContext);
      assert(!result.success, 'Blank vendor context was accepted.');
      assert(result.records.length === 0, 'Failed balance list did not return records: [].');
    }),
    check('Inventory paths are vendor scoped', () => {
      assert(firestorePaths.productStockBalances('vendor-a') === 'vendors/vendor-a/productStockBalances', 'Balance path is not vendor scoped.');
      assert(firestorePaths.inventoryMovements('vendor-a') === 'vendors/vendor-a/inventoryMovements', 'Movement path is not vendor scoped.');
    }),
    check('List failures return empty records', async () => {
      const [balances, movements] = await Promise.all([repository.listBalances(blankContext), repository.listMovements(blankContext)]);
      assert(!balances.success && balances.records.length === 0, 'Balance list failure shape is invalid.');
      assert(!movements.success && movements.records.length === 0, 'Movement list failure shape is invalid.');
    }),
    check('Single-record failures do not expose records', async () => {
      const [balance, movement] = await Promise.all([repository.getBalance(blankContext, 'product-a', 'warehouse-a'), repository.getMovement(blankContext, 'movement-a')]);
      assert(!balance.success && !('records' in balance), 'Balance single-result shape is invalid.');
      assert(!movement.success && !('records' in movement), 'Movement single-result shape is invalid.');
    }),
    check('Cross-vendor balance mutation is rejected', async () => {
      const movement: SharedInventoryMovementRecord = { sciId: 'movement-cross-vendor', movementId: 'movement-cross-vendor', vendorId: 'vendor-b', branchId: 'branch-a', warehouseId: 'warehouse-a', productId: 'product-a', movementType: 'OPENING_BALANCE', quantityDelta: 1, quantityBefore: 0, quantityAfter: 1, referenceType: 'ASSERTION', referenceId: 'assertion', actorId: 'actor-a', correlationId: 'inventory-assertion', sourceApp: 'ITRED_POS', schemaVersion: COMMERCE_SCHEMA_VERSION, status: 'Posted', createdAt: '', updatedAt: '', createdBy: 'actor-a', updatedBy: 'actor-a' };
      const result = await repository.postMovement(context(), movement);
      assert(!result.success, 'Cross-vendor movement was allowed to mutate a balance.');
    }),
    check('Subscription returns unsubscribe', () => {
      const subscription = repository.subscribeBalances(blankContext, () => undefined);
      assert(typeof subscription.unsubscribe === 'function', 'Inventory subscription did not return unsubscribe.');
      subscription.unsubscribe();
    }),
    check('Firebase mode has no silent local authoritative fallback', async () => {
      if (import.meta.env.VITE_STORAGE_MODE !== 'firebase') return;
      const result = await createRepositoryBundle().inventory.listBalances(blankContext);
      assert(!result.errorMessage?.includes('Local inventory repository'), 'Firebase mode silently selected the local inventory repository.');
    })
  ]);
}
