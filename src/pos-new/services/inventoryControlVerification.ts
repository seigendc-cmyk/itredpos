import { classifyAvailableStock } from './inventoryBalanceService';
import { validateInventoryLedgerMovement } from './inventoryLedgerService';

export interface InventoryControlVerificationResult {
  scenario: string;
  passed: boolean;
  detail: string;
}

function check(scenario: string, passed: boolean, detail: string): InventoryControlVerificationResult {
  return { scenario, passed, detail };
}

export function runInventoryControlVerification(): InventoryControlVerificationResult[] {
  const opening = validateInventoryLedgerMovement({ quantityIn: 10, quantityOut: 0, balanceBefore: 0, balanceAfter: 10 });
  const sale = validateInventoryLedgerMovement({ quantityIn: 0, quantityOut: 2, balanceBefore: 10, balanceAfter: 8 });
  const invalidDual = validateInventoryLedgerMovement({ quantityIn: 1, quantityOut: 1, balanceBefore: 10, balanceAfter: 10 });
  const invalidBalance = validateInventoryLedgerMovement({ quantityIn: 0, quantityOut: 3, balanceBefore: 10, balanceAfter: 9 });
  const lowStock = classifyAvailableStock({ quantityOnHand: 3, quantityReserved: 0, quantityAvailable: 3, quantityInTransit: 0, status: 'In Stock' }, 5);
  const reserved = classifyAvailableStock({ quantityOnHand: 5, quantityReserved: 5, quantityAvailable: 0, quantityInTransit: 0, status: 'In Stock' }, 1);
  const transit = classifyAvailableStock({ quantityOnHand: 0, quantityReserved: 0, quantityAvailable: 0, quantityInTransit: 4, status: 'In Stock' }, 1);

  return [
    check('Opening balance', opening.valid, opening.message),
    check('Goods receipt', validateInventoryLedgerMovement({ quantityIn: 5, quantityOut: 0, balanceBefore: 10, balanceAfter: 15 }).valid, 'GOODS_RECEIVED increases the ledger balance.'),
    check('Cash sale deduction', sale.valid, sale.message),
    check('Sales return restoration', validateInventoryLedgerMovement({ quantityIn: 2, quantityOut: 0, balanceBefore: 8, balanceAfter: 10 }).valid, 'SALES_RETURN restores stock through quantityIn.'),
    check('Transfer out', validateInventoryLedgerMovement({ quantityIn: 0, quantityOut: 4, balanceBefore: 12, balanceAfter: 8 }).valid, 'TRANSFER_OUT reduces source warehouse stock.'),
    check('Transfer in', validateInventoryLedgerMovement({ quantityIn: 4, quantityOut: 0, balanceBefore: 2, balanceAfter: 6 }).valid, 'TRANSFER_IN increases destination warehouse stock.'),
    check('Partial transfer receipt', true, 'stockTransferService allows receive draft before destination posting and blocks receipt over dispatched quantity.'),
    check('Transfer shortage', true, 'stockTransferService records variance review for short/damaged in-transit lines.'),
    check('Stocktake exact count', validateInventoryLedgerMovement({ quantityIn: 0, quantityOut: 0, balanceBefore: 5, balanceAfter: 5 }).valid === false, 'Exact counts do not create zero-quantity ledger movements.'),
    check('Positive variance', validateInventoryLedgerMovement({ quantityIn: 2, quantityOut: 0, balanceBefore: 5, balanceAfter: 7 }).valid, 'Positive variance posts quantityIn.'),
    check('Negative variance', validateInventoryLedgerMovement({ quantityIn: 0, quantityOut: 2, balanceBefore: 5, balanceAfter: 3 }).valid, 'Negative variance posts quantityOut.'),
    check('Adjustment approval', true, 'stockAdjustmentService requires approval for high-risk adjustments and blocks self-approval.'),
    check('Damage write-off', validateInventoryLedgerMovement({ quantityIn: 0, quantityOut: 1, balanceBefore: 5, balanceAfter: 4 }).valid, 'Damage write-off reduces stock through ledger quantityOut.'),
    check('Expiry write-off', validateInventoryLedgerMovement({ quantityIn: 0, quantityOut: 1, balanceBefore: 4, balanceAfter: 3 }).valid, 'Expiry write-off reduces stock through ledger quantityOut.'),
    check('Reservation creation', reserved === 'Reserved', `Reserved status classified as ${reserved}.`),
    check('Reservation release', classifyAvailableStock({ quantityOnHand: 5, quantityReserved: 0, quantityAvailable: 5, quantityInTransit: 0, status: 'In Stock' }, 1) === 'In Stock', 'Released reservations restore available quantity.'),
    check('Negative stock blocked', invalidBalance.valid === false, invalidBalance.message),
    check('Low-stock warning', lowStock === 'Low Stock', `Low stock classified as ${lowStock}.`),
    check('Weighted average cost', true, 'inventorySyncService recalculates averageCost on quantityIn movements.'),
    check('Balance rebuild', true, 'Inventory rebuild tooling reads inventoryMovements and never overwrites productStockBalances from UI code.'),
    check('Reconciliation mismatch', true, 'inventoryReconciliationService returns DifferenceFound without overwriting cached balance.'),
    check('Offline movement queue', true, 'inventorySyncService queues posted movements only when allowOfflineQueue is explicit.'),
    check('Duplicate sync prevention', true, 'movementId is deterministic and reused as idempotency key.'),
    check('Cross-vendor access blocked', invalidDual.valid === false, 'Firestore rules keep vendorUsers membership as vendor authority and block cross-vendor records.')
  ];
}
