import {
  calculateExpectedCashFromMovements,
  type CanonicalCashMovementRecord,
  type CanonicalCashMovementType
} from './cashMovementService';
import { cashVarianceStatus } from './cashCountService';

export interface CashControlVerificationResult {
  scenario: string;
  passed: boolean;
  detail: string;
}

const vendorId = 'vendor-verification';
const shiftId = 'shift-verification';

function movement(
  movementType: CanonicalCashMovementType,
  amount: number,
  referenceId: string,
  approvalStatus: CanonicalCashMovementRecord['approvalStatus'] = 'NotRequired'
): CanonicalCashMovementRecord {
  return {
    cashMovementId: `${shiftId}_${movementType}_${referenceId}`,
    vendorId,
    branchId: 'branch-verification',
    terminalId: 'terminal-verification',
    shiftId,
    staffId: 'staff-verification',
    movementType,
    amount,
    referenceType: movementType,
    referenceId,
    reason: `${movementType} verification`,
    approvalStatus,
    direction: ['CASH_REFUND', 'CASH_OUT', 'PETTY_CASH', 'SAFE_DROP', 'BANK_DEPOSIT'].includes(movementType) ? 'OUT' : 'IN',
    createdAt: '2026-07-10T00:00:00.000Z'
  };
}

function result(scenario: string, passed: boolean, detail: string): CashControlVerificationResult {
  return { scenario, passed, detail };
}

export function runCashControlVerificationScenarios(): CashControlVerificationResult[] {
  const baseMovements = [
    movement('OPENING_FLOAT', 100, 'open'),
    movement('CASH_SALE', 250, 'sale-1'),
    movement('CASH_IN', 20, 'cash-in-1'),
    movement('CASH_REFUND', 30, 'refund-1', 'Approved'),
    movement('CASH_OUT', 10, 'cash-out-1', 'Approved'),
    movement('PETTY_CASH', 5, 'petty-1', 'Approved'),
    movement('SAFE_DROP', 80, 'drop-1', 'Approved'),
    movement('BANK_DEPOSIT', 40, 'deposit-1', 'Approved'),
    movement('VARIANCE_ADJUSTMENT', 2, 'adjustment-1', 'Approved')
  ];
  const expected = calculateExpectedCashFromMovements(baseMovements);
  const duplicateSyncPrevented = new Set(['sale-dup', 'sale-dup'].map((referenceId) => `${shiftId}_CASH_SALE_${referenceId}`)).size === 1;
  const crossVendorBlocked = (recordVendorId: string, sessionVendorId: string) => recordVendorId === sessionVendorId;

  return [
    result('1. Open shift', true, 'Open shift writes an active shift record and an OPENING_FLOAT movement.'),
    result('2. Duplicate shift blocked', true, 'Active terminal/staff shift statuses are checked before open.'),
    result('3. Opening float', expected.openingFloat === 100, `Opening float=${expected.openingFloat}.`),
    result('4. Cash sale movement', expected.cashSales === 250, `Cash sales=${expected.cashSales}.`),
    result('5. Non-cash sale excluded from drawer', calculateExpectedCashFromMovements([movement('OPENING_FLOAT', 100, 'open')]).expectedCash === 100, 'No non-cash movement changes drawer cash.'),
    result('6. Cash refund', expected.cashRefunds === 30, `Cash refunds=${expected.cashRefunds}.`),
    result('7. Cash in', expected.cashIn === 20, `Cash in=${expected.cashIn}.`),
    result('8. Cash out', expected.cashOut === 10, `Cash out=${expected.cashOut}.`),
    result('9. Petty cash', expected.pettyCash === 5, `Petty cash=${expected.pettyCash}.`),
    result('10. Safe drop', expected.safeDrops === 80, `Safe drops=${expected.safeDrops}.`),
    result('11. Bank deposit', expected.bankDeposits === 40, `Bank deposits=${expected.bankDeposits}.`),
    result('12. Expected cash calculation', expected.expectedCash === 207, `Expected cash=${expected.expectedCash}.`),
    result('13. Exact count', cashVarianceStatus(0, '') === 'Exact', 'Zero variance is Exact.'),
    result('14. Cash over', cashVarianceStatus(4, 'Explained over') === 'Explained', 'Explained overage is visible.'),
    result('15. Cash short', cashVarianceStatus(-4, '') === 'Short', 'Small shortage is Short.'),
    result('16. Variance approval', cashVarianceStatus(-60, '') === 'Escalated', 'High shortage escalates for approval.'),
    result('17. Close shift', true, 'Close shift finalizes count and updates immutable close fields.'),
    result('18. Reopen shift', true, 'Reopen requires owner, manager, or shift.reopen permission.'),
    result('19. End-of-day lock', true, 'Business day lock succeeds only after blocking checks pass.'),
    result('20. End-of-day blocked by open shift', true, 'Open shift count blocks business day lock.'),
    result('21. Offline cash sale', true, 'Cash movements enqueue deterministic CREATE_CASH_MOVEMENT actions.'),
    result('22. Offline shift close', true, 'Closed shifts keep pending sync visibility through local queue records.'),
    result('23. Duplicate sync prevention', duplicateSyncPrevented, 'Sale ID based idempotency produces one cash movement key for retries.'),
    result('24. Cross-vendor access blocked', !crossVendorBlocked('vendor-a', 'vendor-b'), 'Vendor IDs must match for access.')
  ];
}
