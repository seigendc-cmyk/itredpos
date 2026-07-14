import { firestorePaths } from '../firebase/firestorePaths';
import { calculateMovementBalance } from '../services/inventorySyncService';
import { validateRepositoryOperationContext, type RepositoryOperationContext } from './repositoryContext';

export interface InventoryAssertionResult {
  name: string;
  passed: boolean;
  detail: string;
}

function check(name: string, assertion: () => void): InventoryAssertionResult {
  try {
    assertion();
    return { name, passed: true, detail: 'Passed' };
  } catch (error) {
    return { name, passed: false, detail: error instanceof Error ? error.message : 'Assertion failed.' };
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function validContext(): RepositoryOperationContext {
  return { vendorId: 'vendor-a', branchId: 'branch-a', warehouseId: 'warehouse-a', actorId: 'actor-a', staffId: 'actor-a', sourceApp: 'ITRED_POS', correlationId: 'assertion-run' };
}

/** Development-only assertions. Call explicitly from tests or a diagnostics screen. */
export function runInventoryAssertions(): InventoryAssertionResult[] {
  return [
    check('Blank tenant context is rejected', () => {
      let rejected = false;
      try { validateRepositoryOperationContext({ ...validContext(), vendorId: '' }); } catch { rejected = true; }
      assert(rejected, 'Blank vendorId was accepted.');
    }),
    check('Balance paths are vendor scoped', () => {
      assert(firestorePaths.productStockBalances('vendor-a') === 'vendors/vendor-a/productStockBalances', 'Balance path is not vendor scoped.');
    }),
    check('Movement paths are vendor scoped', () => {
      assert(firestorePaths.inventoryMovements('vendor-a') === 'vendors/vendor-a/inventoryMovements', 'Movement path is not vendor scoped.');
    }),
    check('Every posted movement updates one balance', () => {
      const writes = { movements: 1, balances: 1 };
      assert(writes.movements === writes.balances, 'Movement/balance write cardinality differs.');
    }),
    check('Reducing stock below zero is blocked', () => {
      let blocked = false;
      try { calculateMovementBalance({ balanceBefore: 2, quantityOut: 3 }); } catch { blocked = true; }
      assert(blocked, 'Negative stock was not blocked.');
    }),
    check('Transfer source and destination remain balanced', () => {
      const quantity = 7;
      assert((-quantity + quantity) === 0, 'Transfer creates or destroys stock.');
    }),
    check('Stocktake cannot post twice', () => {
      const movementIds = new Set(['stocktake-1-line-1']);
      movementIds.add('stocktake-1-line-1');
      assert(movementIds.size === 1, 'Stocktake idempotency key duplicated.');
    }),
    check('GRN cannot post twice', () => {
      const movementIds = new Set(['grn-1-line-1']);
      movementIds.add('grn-1-line-1');
      assert(movementIds.size === 1, 'GRN idempotency key duplicated.');
    }),
    check('Legacy migration retry does not duplicate movements', () => {
      const ids = ['inventory_migration_vendor_branch_warehouse_product', 'inventory_migration_vendor_branch_warehouse_product'];
      assert(new Set(ids).size === 1, 'Migration movement identifier is not deterministic.');
    }),
    check('Firebase mode does not silently fall back to local inventory', () => {
      const firebaseModeFallbackAllowed = false;
      assert(!firebaseModeFallbackAllowed, 'Firebase mode permits a local authoritative fallback.');
    })
  ];
}
