import { enqueueOfflineAction, getNetworkStatus } from './offlineSyncService';
import { assertCanonicalCashSession, type CanonicalCashSession } from './cashSessionService';
import type { CashDrawerMovement, CashMovementDirection, CashMovementSource, CashMovementType, PosSession, ShiftSessionControl } from '../types';
import { getActiveVendorId, readVendorScopedList, writeVendorScopedList } from '../utils/vendorDataMode';

export const POS_CASH_MOVEMENTS_COLLECTION = 'pos_cash_movements';
export const POS_SHIFT_STORE_KEY = 'itred_pos_shift_session_controls_v1';

const CASH_CONTROL_MOVEMENT_KEY = 'itred_pos_cash_control_movements_v1';
const CASH_MOVEMENT_SYNC_QUEUE_KEY = 'itred_pos_cash_movement_sync_queue_v1';
const BANKBOOK_ENTRIES_COLLECTION = 'bankbook_entries';

export type CanonicalCashMovementType =
  | 'OPENING_FLOAT'
  | 'CASH_SALE'
  | 'CASH_REFUND'
  | 'CASH_IN'
  | 'CASH_OUT'
  | 'PETTY_CASH'
  | 'SAFE_DROP'
  | 'BANK_DEPOSIT'
  | 'FLOAT_ADJUSTMENT'
  | 'VARIANCE_ADJUSTMENT'
  | 'REVERSAL';

export type CashMovementApprovalStatus = 'NotRequired' | 'Pending' | 'Approved' | 'Rejected';
export type CashMovementSyncStatus = 'SavedOffline' | 'WaitingToSynchronize' | 'Synchronized' | 'SynchronizationFailed';
export type CanonicalCashMovementDirection = 'IN' | 'OUT' | 'NEUTRAL';

export interface CanonicalCashMovementRecord {
  cashMovementId: string;
  vendorId: string;
  branchId: string;
  terminalId: string;
  shiftId: string;
  staffId: string;
  movementType: CanonicalCashMovementType;
  amount: number;
  referenceType: string;
  referenceId: string;
  reason: string;
  approvalStatus: CashMovementApprovalStatus;
  approvedBy?: string;
  direction: CanonicalCashMovementDirection;
  createdAt: string;
  syncStatus?: CashMovementSyncStatus;
  reversesMovementId?: string;
}

export interface CashMovementPolicy {
  openingFloatApprovalLimit: number;
  cashOutApprovalLimit: number;
  pettyCashApprovalLimit: number;
  safeDropApprovalLimit: number;
  bankDepositApprovalLimit: number;
  refundApprovalLimit: number;
  adjustmentApprovalLimit: number;
}

export interface ExpectedCashBreakdown {
  openingFloat: number;
  cashSales: number;
  cashIn: number;
  cashRefunds: number;
  cashOut: number;
  pettyCash: number;
  safeDrops: number;
  bankDeposits: number;
  adjustments: number;
  expectedCash: number;
}

export interface RecordCashMovementInput {
  movementType: CanonicalCashMovementType;
  amount: number;
  shiftId: string;
  referenceType: string;
  referenceId: string;
  reason?: string;
  approvedBy?: string;
  approvalStatus?: CashMovementApprovalStatus;
  idempotencyKey?: string;
  allowInsufficientDrawerCash?: boolean;
  allowPendingApproval?: boolean;
  reversesMovementId?: string;
  createdAt?: string;
}

export interface RecordedCashMovement {
  movement: CanonicalCashMovementRecord;
  drawerMovement: CashDrawerMovement;
}

const DEFAULT_CASH_POLICY: CashMovementPolicy = {
  openingFloatApprovalLimit: 500,
  cashOutApprovalLimit: 100,
  pettyCashApprovalLimit: 50,
  safeDropApprovalLimit: 500,
  bankDepositApprovalLimit: 1000,
  refundApprovalLimit: 100,
  adjustmentApprovalLimit: 20
};

const ACTIVE_SHIFT_STATUSES = new Set(['Open', 'Counting', 'PendingApproval', 'Reopened']);

function clean(value: unknown): string {
  return String(value ?? '').trim();
}

function roundMoney(value: number): number {
  return Number((Math.round((Number(value) + Number.EPSILON) * 100) / 100).toFixed(2));
}

function nowIso(): string {
  return new Date().toISOString();
}

function cleanId(value: string): string {
  return String(value || '').replace(/[^A-Za-z0-9_-]/g, '_');
}

function makeMovementId(input: Pick<CanonicalCashMovementRecord, 'vendorId' | 'shiftId' | 'movementType' | 'referenceType' | 'referenceId'>): string {
  return cleanId(`${input.vendorId}_${input.shiftId}_${input.movementType}_${input.referenceType}_${input.referenceId}`);
}

export function cashMovementDirection(type: CanonicalCashMovementType): CanonicalCashMovementDirection {
  if (['OPENING_FLOAT', 'CASH_SALE', 'CASH_IN', 'FLOAT_ADJUSTMENT'].includes(type)) return 'IN';
  if (['CASH_REFUND', 'CASH_OUT', 'PETTY_CASH', 'SAFE_DROP', 'BANK_DEPOSIT'].includes(type)) return 'OUT';
  return 'NEUTRAL';
}

function requiresApproval(type: CanonicalCashMovementType, amount: number, policy: CashMovementPolicy = DEFAULT_CASH_POLICY): boolean {
  if (type === 'OPENING_FLOAT') return amount > policy.openingFloatApprovalLimit;
  if (type === 'CASH_OUT') return amount > policy.cashOutApprovalLimit;
  if (type === 'PETTY_CASH') return amount > policy.pettyCashApprovalLimit;
  if (type === 'SAFE_DROP') return amount > policy.safeDropApprovalLimit;
  if (type === 'BANK_DEPOSIT') return amount > policy.bankDepositApprovalLimit;
  if (type === 'CASH_REFUND') return amount > policy.refundApprovalLimit;
  if (type === 'FLOAT_ADJUSTMENT' || type === 'VARIANCE_ADJUSTMENT' || type === 'REVERSAL') return amount > policy.adjustmentApprovalLimit;
  return false;
}

function defaultApprovalStatus(input: RecordCashMovementInput, amount: number): CashMovementApprovalStatus {
  if (input.approvalStatus) return input.approvalStatus;
  if (input.approvedBy) return 'Approved';
  return requiresApproval(input.movementType, amount) ? 'Pending' : 'NotRequired';
}

function validateRestrictedMovement(input: RecordCashMovementInput, amount: number): void {
  const restricted = requiresApproval(input.movementType, amount);
  if (!restricted) return;
  if (input.approvedBy || input.approvalStatus === 'Approved' || input.allowPendingApproval) return;
  throw new Error('This cash movement requires approval before posting.');
}

function readCanonicalMovements(vendorId: string): CanonicalCashMovementRecord[] {
  return readVendorScopedList<CanonicalCashMovementRecord>(POS_CASH_MOVEMENTS_COLLECTION, [], vendorId);
}

function writeCanonicalMovements(vendorId: string, movements: CanonicalCashMovementRecord[]): CanonicalCashMovementRecord[] {
  return writeVendorScopedList(POS_CASH_MOVEMENTS_COLLECTION, movements, vendorId);
}

function readShifts(vendorId: string): ShiftSessionControl[] {
  return readVendorScopedList<ShiftSessionControl>(POS_SHIFT_STORE_KEY, [], vendorId);
}

function writeShifts(vendorId: string, shifts: ShiftSessionControl[]): ShiftSessionControl[] {
  return writeVendorScopedList(POS_SHIFT_STORE_KEY, shifts, vendorId);
}

function findActiveShift(session: CanonicalCashSession, shiftId: string): ShiftSessionControl | null {
  const shifts = readShifts(session.vendorId);
  return shifts.find((shift) =>
    shift.id === shiftId
    && shift.vendorId === session.vendorId
    && shift.branchId === session.branchId
    && shift.terminalId === session.terminalId
    && ACTIVE_SHIFT_STATUSES.has(shift.status)
  ) || null;
}

function requireActiveShift(session: CanonicalCashSession, shiftId: string): ShiftSessionControl {
  const shift = findActiveShift(session, shiftId);
  if (!shift) throw new Error('No open shift. Please open a shift before recording cash.');
  return shift;
}

function toDrawerType(type: CanonicalCashMovementType, direction: CanonicalCashMovementDirection): CashMovementType {
  if (type === 'OPENING_FLOAT') return 'OpeningFloat';
  if (type === 'CASH_SALE') return 'CashSale';
  if (type === 'CASH_REFUND') return 'CashRefund';
  if (type === 'PETTY_CASH') return 'PettyCashPayout';
  if (type === 'SAFE_DROP' || type === 'BANK_DEPOSIT') return 'CashDrop';
  if (type === 'VARIANCE_ADJUSTMENT') return 'CashVarianceAdjustment';
  if (type === 'FLOAT_ADJUSTMENT') return 'CashCorrection';
  if (type === 'REVERSAL') return 'CashCorrection';
  return direction === 'IN' ? 'CashCorrection' : 'DrawerExpense';
}

function toDrawerDirection(direction: CanonicalCashMovementDirection): CashMovementDirection {
  if (direction === 'IN') return 'In';
  if (direction === 'OUT') return 'Out';
  return 'Neutral';
}

function toDrawerSource(type: CanonicalCashMovementType): CashMovementSource {
  if (type === 'CASH_SALE') return 'Sale';
  if (type === 'CASH_REFUND') return 'Refund';
  if (type === 'OPENING_FLOAT') return 'Shift';
  if (type === 'SAFE_DROP' || type === 'BANK_DEPOSIT' || type === 'VARIANCE_ADJUSTMENT') return 'EOD';
  if (type === 'PETTY_CASH' || type === 'CASH_OUT') return 'Expense';
  if (type === 'REVERSAL') return 'Recovery';
  return 'ManualAdjustment';
}

function movementNumber(movementId: string): string {
  return `CM-${movementId.slice(-10).toUpperCase()}`;
}

function toDrawerMovement(movement: CanonicalCashMovementRecord, session: CanonicalCashSession): CashDrawerMovement {
  const direction = toDrawerDirection(movement.direction);
  return {
    movementId: movement.cashMovementId,
    movementNumber: movementNumber(movement.cashMovementId),
    shiftId: movement.shiftId,
    branchId: movement.branchId,
    branchName: session.branchName || movement.branchId,
    terminalId: movement.terminalId,
    terminalName: session.terminalName || movement.terminalId,
    drawerId: `DRAWER-${movement.terminalId}`,
    drawerName: `DRAWER-${movement.terminalId}`,
    staffId: movement.staffId,
    staffName: session.staffName || movement.staffId,
    type: toDrawerType(movement.movementType, movement.direction),
    direction,
    source: toDrawerSource(movement.movementType),
    amount: movement.amount,
    paymentMethod: 'Cash',
    referenceId: movement.referenceId,
    referenceNumber: movement.referenceId,
    notes: movement.reason,
    createdAt: movement.createdAt,
    reviewed: movement.approvalStatus === 'Approved' || movement.approvalStatus === 'NotRequired',
    reviewedBy: movement.approvedBy,
    reviewedAt: movement.approvedBy ? movement.createdAt : undefined
  };
}

function upsertDrawerMovement(vendorId: string, movement: CashDrawerMovement): CashDrawerMovement {
  const rows = readVendorScopedList<CashDrawerMovement>(CASH_CONTROL_MOVEMENT_KEY, [], vendorId);
  const next = [movement, ...rows.filter((row) => row.movementId !== movement.movementId)];
  writeVendorScopedList(CASH_CONTROL_MOVEMENT_KEY, next, vendorId);
  return movement;
}

function fromLegacyDrawerMovement(movement: CashDrawerMovement, vendorId: string): CanonicalCashMovementRecord {
  const direction = movement.direction === 'Out' ? 'OUT' : movement.direction === 'In' ? 'IN' : 'NEUTRAL';
  const movementType: CanonicalCashMovementType =
    movement.type === 'OpeningFloat' ? 'OPENING_FLOAT'
      : movement.type === 'CashSale' ? 'CASH_SALE'
        : movement.type === 'CashRefund' || movement.type === 'CashReturnRefund' ? 'CASH_REFUND'
          : movement.type === 'PettyCashPayout' ? 'PETTY_CASH'
            : movement.type === 'CashDrop' ? 'SAFE_DROP'
              : movement.type === 'CashVarianceAdjustment' ? 'VARIANCE_ADJUSTMENT'
                : direction === 'IN' ? 'CASH_IN' : 'CASH_OUT';
  return {
    cashMovementId: movement.movementId,
    vendorId,
    branchId: movement.branchId,
    terminalId: movement.terminalId,
    shiftId: movement.shiftId,
    staffId: movement.staffId,
    movementType,
    amount: roundMoney(movement.amount),
    referenceType: movement.source,
    referenceId: movement.referenceId,
    reason: movement.notes,
    approvalStatus: movement.reviewed ? 'Approved' : 'Pending',
    approvedBy: movement.reviewedBy,
    direction,
    createdAt: movement.createdAt
  };
}

function movementIsIncluded(movement: CanonicalCashMovementRecord): boolean {
  return movement.approvalStatus !== 'Rejected';
}

export function calculateExpectedCashFromMovements(movements: CanonicalCashMovementRecord[]): ExpectedCashBreakdown {
  const included = movements.filter(movementIsIncluded);
  const sum = (types: CanonicalCashMovementType[]) => roundMoney(included
    .filter((movement) => types.includes(movement.movementType))
    .reduce((total, movement) => total + movement.amount, 0));
  const adjustments = roundMoney(included
    .filter((movement) =>
      ['FLOAT_ADJUSTMENT', 'VARIANCE_ADJUSTMENT', 'REVERSAL'].includes(movement.movementType)
      && (movement.approvalStatus === 'Approved' || movement.approvalStatus === 'NotRequired')
    )
    .reduce((total, movement) => total + (movement.direction === 'OUT' ? -movement.amount : movement.amount), 0));
  const openingFloat = sum(['OPENING_FLOAT']);
  const cashSales = sum(['CASH_SALE']);
  const cashIn = sum(['CASH_IN']);
  const cashRefunds = sum(['CASH_REFUND']);
  const cashOut = sum(['CASH_OUT']);
  const pettyCash = sum(['PETTY_CASH']);
  const safeDrops = sum(['SAFE_DROP']);
  const bankDeposits = sum(['BANK_DEPOSIT']);
  const expectedCash = roundMoney(openingFloat + cashSales + cashIn - cashRefunds - cashOut - pettyCash - safeDrops - bankDeposits + adjustments);
  return {
    openingFloat,
    cashSales,
    cashIn,
    cashRefunds,
    cashOut,
    pettyCash,
    safeDrops,
    bankDeposits,
    adjustments,
    expectedCash
  };
}

export function getCashMovementsForShift(shiftId: string, vendorId?: string): CanonicalCashMovementRecord[] {
  const vendor = clean(vendorId) || getActiveVendorId('');
  const canonical = vendor ? readCanonicalMovements(vendor) : [];
  const canonicalIds = new Set(canonical.map((movement) => movement.cashMovementId));
  const legacy = vendor
    ? readVendorScopedList<CashDrawerMovement>(CASH_CONTROL_MOVEMENT_KEY, [], vendor)
      .filter((movement) => movement.shiftId === shiftId && !canonicalIds.has(movement.movementId))
      .map((movement) => fromLegacyDrawerMovement(movement, vendor))
    : [];
  return [...canonical, ...legacy].filter((movement) => movement.shiftId === shiftId);
}

export async function calculateExpectedCash(shiftId: string, vendorId?: string): Promise<ExpectedCashBreakdown> {
  return calculateExpectedCashFromMovements(getCashMovementsForShift(shiftId, vendorId));
}

function assertSufficientDrawerCash(input: RecordCashMovementInput, session: CanonicalCashSession, amount: number): void {
  if (!['CASH_REFUND', 'CASH_OUT', 'PETTY_CASH', 'SAFE_DROP', 'BANK_DEPOSIT'].includes(input.movementType)) return;
  if (input.allowInsufficientDrawerCash) return;
  const expectedCash = calculateExpectedCashFromMovements(getCashMovementsForShift(input.shiftId, session.vendorId)).expectedCash;
  if (expectedCash < amount) {
    throw new Error('Cash out cannot exceed drawer balance unless authorized.');
  }
}

async function queueCashMovement(movement: CanonicalCashMovementRecord, session: CanonicalCashSession): Promise<void> {
  const network = await getNetworkStatus().catch(() => 'Unknown');
  const status = network === 'Offline' || network === 'Unstable' ? 'Queued' : 'Ready To Sync';
  await enqueueOfflineAction({
    queueId: cleanId(`cash_${movement.cashMovementId}`),
    vendorId: movement.vendorId,
    branchId: movement.branchId,
    terminalId: movement.terminalId,
    staffId: movement.staffId,
    staffName: session.staffName,
    entityType: 'Payment',
    entityId: movement.cashMovementId,
    entityNumber: movement.referenceId,
    operationType: 'CREATE_CASH_MOVEMENT',
    payload: { cashMovement: movement },
    status,
    notes: status === 'Queued' ? 'Saved offline. Waiting to synchronize.' : 'Cash movement ready to synchronize.'
  }).catch(() => undefined);
  const queue = readVendorScopedList<CanonicalCashMovementRecord>(CASH_MOVEMENT_SYNC_QUEUE_KEY, [], movement.vendorId);
  writeVendorScopedList(CASH_MOVEMENT_SYNC_QUEUE_KEY, [movement, ...queue.filter((row) => row.cashMovementId !== movement.cashMovementId)], movement.vendorId);
}

function updateShiftExpectedCash(vendorId: string, shiftId: string, expectedCash: number): void {
  const shifts = readShifts(vendorId);
  const updatedAt = nowIso();
  writeShifts(vendorId, shifts.map((shift) => shift.id === shiftId ? { ...shift, expectedCash, updatedAt } as ShiftSessionControl : shift));
}

function recordBankbookDeposit(input: {
  session: CanonicalCashSession;
  depositReference: string;
  bankAccountId: string;
  amount: number;
  notes: string;
}): void {
  const now = nowIso();
  const bankbookEntryId = cleanId(`${input.session.vendorId}_${input.depositReference}_BANKBOOK`);
  const rows = readVendorScopedList<Record<string, unknown>>(BANKBOOK_ENTRIES_COLLECTION, [], input.session.vendorId);
  writeVendorScopedList(BANKBOOK_ENTRIES_COLLECTION, [{
    bankbookEntryId,
    vendorId: input.session.vendorId,
    branchId: input.session.branchId,
    businessDate: now.slice(0, 10),
    bankAccountId: input.bankAccountId,
    referenceId: input.depositReference,
    entryType: 'Deposit',
    amount: input.amount,
    status: 'Pending',
    notes: input.notes,
    createdAt: now,
    updatedAt: now
  }, ...rows.filter((row) => row.bankbookEntryId !== bankbookEntryId)], input.session.vendorId);
}

export async function recordCashMovement(
  input: RecordCashMovementInput,
  sessionInput?: PosSession | CanonicalCashSession | null
): Promise<RecordedCashMovement> {
  const session = assertCanonicalCashSession(sessionInput);
  const amount = roundMoney(input.amount);
  if (amount <= 0) throw new Error('Cash movement amount must be above zero.');
  const referenceId = clean(input.referenceId);
  if (!referenceId) throw new Error('Cash movement requires a reference.');
  const reason = clean(input.reason) || (input.movementType === 'CASH_SALE' ? 'Cash sale posted to drawer.' : '');
  if (!reason) throw new Error('Cash movement requires a reason.');
  requireActiveShift(session, input.shiftId);
  validateRestrictedMovement(input, amount);
  assertSufficientDrawerCash(input, session, amount);

  const createdAt = input.createdAt || nowIso();
  const direction = cashMovementDirection(input.movementType);
  const movement: CanonicalCashMovementRecord = {
    cashMovementId: cleanId(input.idempotencyKey || makeMovementId({
      vendorId: session.vendorId,
      shiftId: input.shiftId,
      movementType: input.movementType,
      referenceType: input.referenceType,
      referenceId
    })),
    vendorId: session.vendorId,
    branchId: session.branchId,
    terminalId: session.terminalId,
    shiftId: input.shiftId,
    staffId: session.staffId,
    movementType: input.movementType,
    amount,
    referenceType: clean(input.referenceType),
    referenceId,
    reason,
    approvalStatus: defaultApprovalStatus(input, amount),
    approvedBy: clean(input.approvedBy) || undefined,
    direction,
    createdAt,
    syncStatus: 'WaitingToSynchronize',
    reversesMovementId: clean(input.reversesMovementId) || undefined
  };

  const existing = readCanonicalMovements(session.vendorId).find((row) => row.cashMovementId === movement.cashMovementId);
  if (existing) {
    const drawerMovement = upsertDrawerMovement(session.vendorId, toDrawerMovement(existing, session));
    return { movement: existing, drawerMovement };
  }

  const movements = readCanonicalMovements(session.vendorId);
  writeCanonicalMovements(session.vendorId, [movement, ...movements]);
  const drawerMovement = upsertDrawerMovement(session.vendorId, toDrawerMovement(movement, session));
  const expected = calculateExpectedCashFromMovements(getCashMovementsForShift(input.shiftId, session.vendorId));
  updateShiftExpectedCash(session.vendorId, input.shiftId, expected.expectedCash);
  await queueCashMovement(movement, session);
  return { movement, drawerMovement };
}

export function getOpenCashShiftForSession(sessionInput?: PosSession | CanonicalCashSession | null): ShiftSessionControl | null {
  const session = assertCanonicalCashSession(sessionInput);
  return readShifts(session.vendorId).find((shift) =>
    shift.vendorId === session.vendorId
    && shift.branchId === session.branchId
    && shift.terminalId === session.terminalId
    && ACTIVE_SHIFT_STATUSES.has(shift.status)
  ) || null;
}

export async function recordCashSaleMovement(input: {
  saleId: string;
  receiptNumber?: string;
  shiftId: string;
  amount: number;
  createdAt?: string;
}, session?: PosSession | CanonicalCashSession | null): Promise<RecordedCashMovement> {
  return recordCashMovement({
    movementType: 'CASH_SALE',
    amount: input.amount,
    shiftId: input.shiftId,
    referenceType: 'SALE',
    referenceId: input.saleId,
    reason: `Cash received for sale ${input.receiptNumber || input.saleId}.`,
    idempotencyKey: cleanId(`${input.saleId}_CASH_SALE`),
    createdAt: input.createdAt
  }, session);
}

export async function recordCashRefundMovement(input: {
  returnId: string;
  originalSaleId: string;
  shiftId: string;
  amount: number;
  reason: string;
  approvedBy?: string;
  allowInsufficientDrawerCash?: boolean;
}, session?: PosSession | CanonicalCashSession | null): Promise<RecordedCashMovement> {
  return recordCashMovement({
    movementType: 'CASH_REFUND',
    amount: input.amount,
    shiftId: input.shiftId,
    referenceType: 'RETURN',
    referenceId: input.returnId,
    reason: `${input.reason} Original sale: ${input.originalSaleId}.`,
    approvedBy: input.approvedBy,
    idempotencyKey: cleanId(`${input.returnId}_CASH_REFUND`),
    allowInsufficientDrawerCash: input.allowInsufficientDrawerCash
  }, session);
}

export async function recordCashIn(input: {
  shiftId: string;
  amount: number;
  reason: string;
  referenceId: string;
}, session?: PosSession | CanonicalCashSession | null): Promise<RecordedCashMovement> {
  return recordCashMovement({ movementType: 'CASH_IN', referenceType: 'CASH_IN', ...input }, session);
}

export async function recordCashOut(input: {
  shiftId: string;
  amount: number;
  reason: string;
  referenceId: string;
  approvedBy?: string;
  allowInsufficientDrawerCash?: boolean;
}, session?: PosSession | CanonicalCashSession | null): Promise<RecordedCashMovement> {
  return recordCashMovement({ movementType: 'CASH_OUT', referenceType: 'CASH_OUT', ...input }, session);
}

export async function recordPettyCash(input: {
  shiftId: string;
  amount: number;
  reason: string;
  referenceId: string;
  approvedBy?: string;
}, session?: PosSession | CanonicalCashSession | null): Promise<RecordedCashMovement> {
  return recordCashMovement({ movementType: 'PETTY_CASH', referenceType: 'PETTY_CASH', ...input }, session);
}

export async function recordSafeDrop(input: {
  shiftId: string;
  amount: number;
  reason: string;
  sealedBagNumber?: string;
  approvedBy?: string;
}, session?: PosSession | CanonicalCashSession | null): Promise<RecordedCashMovement> {
  return recordCashMovement({
    movementType: 'SAFE_DROP',
    amount: input.amount,
    shiftId: input.shiftId,
    referenceType: 'SAFE_DROP',
    referenceId: input.sealedBagNumber || cleanId(`SAFE_DROP_${input.shiftId}_${input.amount}`),
    reason: input.reason,
    approvedBy: input.approvedBy
  }, session);
}

export async function recordBankDeposit(input: {
  shiftId: string;
  amount: number;
  reason: string;
  depositReference: string;
  bankAccountId: string;
  approvedBy?: string;
}, session?: PosSession | CanonicalCashSession | null): Promise<RecordedCashMovement> {
  const resolved = assertCanonicalCashSession(session);
  const recorded = await recordCashMovement({
    movementType: 'BANK_DEPOSIT',
    amount: input.amount,
    shiftId: input.shiftId,
    referenceType: 'BANK_DEPOSIT',
    referenceId: input.depositReference,
    reason: `${input.reason} Bank account: ${input.bankAccountId}.`,
    approvedBy: input.approvedBy
  }, resolved);
  recordBankbookDeposit({
    session: resolved,
    depositReference: input.depositReference,
    bankAccountId: input.bankAccountId,
    amount: roundMoney(input.amount),
    notes: input.reason
  });
  return recorded;
}

export async function reverseCashMovement(input: {
  originalMovementId: string;
  shiftId: string;
  reason: string;
  approvedBy: string;
}, session?: PosSession | CanonicalCashSession | null): Promise<RecordedCashMovement> {
  const resolved = assertCanonicalCashSession(session);
  const original = readCanonicalMovements(resolved.vendorId).find((movement) => movement.cashMovementId === input.originalMovementId);
  if (!original) throw new Error('Original cash movement was not found.');
  return recordCashMovement({
    movementType: 'REVERSAL',
    amount: original.amount,
    shiftId: input.shiftId,
    referenceType: 'REVERSAL',
    referenceId: input.originalMovementId,
    reason: input.reason,
    approvedBy: input.approvedBy,
    reversesMovementId: input.originalMovementId
  }, resolved);
}
