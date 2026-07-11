import type { Shift, ShiftSessionControl } from '../types/posTypes';
import type { CommerceOperationContext } from '../../commerce-integration';
import { assertCanonicalCashSession, type CanonicalCashSession } from './cashSessionService';
import { calculateExpectedCash, POS_SHIFT_STORE_KEY } from './cashMovementService';
import { closeShift as closeTerminalShift, openShift as openTerminalShift } from './terminalControlService';
import { readVendorScopedList, writeVendorScopedList } from '../utils/vendorDataMode';

export type CanonicalShiftStatus = 'Open' | 'Counting' | 'PendingApproval' | 'Closed' | 'Suspended' | 'Reopened';

export interface CanonicalShiftRecord {
  shiftId: string;
  vendorId: string;
  branchId: string;
  terminalId: string;
  staffId: string;
  staffName: string;
  openedAt: string;
  closedAt?: string;
  openingFloat: number;
  expectedCash: number;
  countedCash?: number;
  variance?: number;
  varianceStatus?: 'Exact' | 'Over' | 'Short' | 'PendingReview' | 'Explained' | 'Approved' | 'Escalated';
  status: CanonicalShiftStatus;
  openingApprovedBy?: string;
  closingApprovedBy?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function statusFromShift(shift: ShiftSessionControl): CanonicalShiftStatus {
  if (shift.status === 'Closed' || shift.status === 'Force Closed' || shift.status === 'Locked') return 'Closed';
  if (shift.status === 'Counting') return 'Counting';
  if (shift.status === 'PendingApproval' || shift.status === 'Closing Review') return 'PendingApproval';
  if (shift.status === 'Suspended') return 'Suspended';
  if (shift.status === 'Reopened') return 'Reopened';
  return 'Open';
}

function varianceStatus(value = 0): CanonicalShiftRecord['varianceStatus'] {
  if (value === 0) return 'Exact';
  return value > 0 ? 'Over' : 'Short';
}

function readShifts(vendorId: string): ShiftSessionControl[] {
  return readVendorScopedList<ShiftSessionControl>(POS_SHIFT_STORE_KEY, [], vendorId);
}

function writeShifts(vendorId: string, shifts: ShiftSessionControl[]): ShiftSessionControl[] {
  return writeVendorScopedList(POS_SHIFT_STORE_KEY, shifts, vendorId);
}

function toCanonical(shift: ShiftSessionControl): CanonicalShiftRecord {
  const variance = shift.variance || 0;
  return {
    shiftId: shift.id,
    vendorId: shift.vendorId,
    branchId: shift.branchId,
    terminalId: shift.terminalId,
    staffId: shift.staffId,
    staffName: shift.staffName,
    openedAt: shift.openedAt || shift.closedAt || nowIso(),
    closedAt: shift.closedAt,
    openingFloat: shift.openingFloat,
    expectedCash: shift.expectedCash,
    countedCash: shift.declaredCash,
    variance,
    varianceStatus: shift.status === 'PendingApproval' ? 'PendingReview' : varianceStatus(variance),
    status: statusFromShift(shift),
    closingApprovedBy: shift.reviewedBy,
    notes: shift.notes,
    createdAt: shift.openedAt || nowIso(),
    updatedAt: shift.closedAt || shift.openedAt || nowIso()
  };
}

function toLegacyShift(shift: ShiftSessionControl): Shift {
  return {
    id: shift.id,
    operator: shift.staffName,
    status: statusFromShift(shift) === 'Closed' ? 'CLOSED' : 'ACTIVE',
    startTime: shift.openedAt || nowIso(),
    endTime: shift.closedAt,
    startingCash: shift.openingFloat,
    expectedCash: shift.expectedCash,
    actualCash: shift.declaredCash,
    difference: shift.variance,
    salesCount: 0,
    totalSales: 0
  };
}

export function getOpenShiftForTerminal(vendorId: string, branchId: string, terminalId: string): CanonicalShiftRecord | null {
  const shift = readShifts(vendorId).find((row) =>
    row.vendorId === vendorId
    && row.branchId === branchId
    && row.terminalId === terminalId
    && ['Open', 'Counting', 'PendingApproval', 'Reopened'].includes(row.status)
  );
  return shift ? toCanonical(shift) : null;
}

export function getActiveShiftForStaff(vendorId: string, staffId: string): CanonicalShiftRecord | null {
  const shift = readShifts(vendorId).find((row) =>
    row.vendorId === vendorId
    && row.staffId === staffId
    && ['Open', 'Counting', 'PendingApproval', 'Reopened'].includes(row.status)
  );
  return shift ? toCanonical(shift) : null;
}

export async function openPosShift(input: {
  openingFloat: number;
  notes?: string;
}, sessionInput?: CanonicalCashSession | null): Promise<CanonicalShiftRecord> {
  const session = assertCanonicalCashSession(sessionInput);
  const opened = await openTerminalShift({
    vendorId: session.vendorId,
    branchId: session.branchId,
    terminalId: session.terminalId,
    terminalName: session.terminalName,
    staffId: session.staffId,
    staffName: session.staffName,
    openingFloat: input.openingFloat,
    notes: input.notes,
    session
  });
  return toCanonical(opened);
}

export async function closePosShift(input: {
  shiftId: string;
  countedCash: number;
}, sessionInput?: CanonicalCashSession | null): Promise<CanonicalShiftRecord | null> {
  const session = assertCanonicalCashSession(sessionInput);
  const closed = await closeTerminalShift(input.shiftId, input.countedCash, session.staffName, session);
  return closed ? toCanonical(closed) : null;
}

export async function reopenShift(input: {
  shiftId: string;
  reason: string;
  approvedBy: string;
}, sessionInput?: CanonicalCashSession | null): Promise<CanonicalShiftRecord> {
  const session = assertCanonicalCashSession(sessionInput);
  const rows = readShifts(session.vendorId);
  const existing = rows.find((shift) => shift.id === input.shiftId);
  if (!existing) throw new Error('Shift was not found.');
  if (!session.permissions.includes('*') && !session.permissions.includes('shift.reopen') && !['Owner', 'SysAdmin', 'Manager'].includes(session.role)) {
    throw new Error('Reopening a closed shift requires owner or manager approval.');
  }
  const updated: ShiftSessionControl = {
    ...existing,
    status: 'Reopened',
    reviewedBy: input.approvedBy,
    notes: `${existing.notes || ''}\nReopened: ${input.reason}`.trim()
  };
  writeShifts(session.vendorId, rows.map((shift) => shift.id === input.shiftId ? updated : shift));
  return toCanonical(updated);
}

export const shiftService = {
  getCurrentShift: async (branchId: string, terminalId: string): Promise<Shift | null> => {
    const session = assertCanonicalCashSession();
    const shift = readShifts(session.vendorId).find((row) =>
      row.branchId === branchId
      && row.terminalId === terminalId
      && ['Open', 'Counting', 'PendingApproval', 'Reopened'].includes(row.status)
    );
    return shift ? toLegacyShift(shift) : null;
  },

  openShift: async (
    payload: { operator: string; startingCash: number },
    context?: CommerceOperationContext
  ): Promise<Shift> => {
    const session = assertCanonicalCashSession(context ? {
      vendorId: context.vendorId,
      vendorName: context.vendorId,
      branchId: context.branchId,
      branchName: context.branchId,
      warehouseId: context.branchId,
      terminalId: context.terminalId,
      terminalName: context.terminalId,
      staffId: context.staffId,
      staffName: payload.operator,
      role: 'POS Operator',
      permissions: [],
      signedInAt: nowIso()
    } : undefined);
    const opened = await openPosShift({ openingFloat: payload.startingCash, notes: `Opened by ${payload.operator}.` }, session);
    const shift = readShifts(opened.vendorId).find((row) => row.id === opened.shiftId);
    return toLegacyShift(shift!);
  },

  closeShift: async (
    payload: { actualCash: number; difference?: number },
    context?: CommerceOperationContext
  ): Promise<Shift> => {
    const session = assertCanonicalCashSession(context ? {
      vendorId: context.vendorId,
      vendorName: context.vendorId,
      branchId: context.branchId,
      branchName: context.branchId,
      warehouseId: context.branchId,
      terminalId: context.terminalId,
      terminalName: context.terminalId,
      staffId: context.staffId,
      staffName: context.staffId,
      role: 'POS Operator',
      permissions: [],
      signedInAt: nowIso()
    } : undefined);
    const active = getOpenShiftForTerminal(session.vendorId, session.branchId, session.terminalId);
    if (!active) throw new Error('No open shift. Please open a shift before closing.');
    const expected = await calculateExpectedCash(active.shiftId, session.vendorId);
    const closed = await closePosShift({ shiftId: active.shiftId, countedCash: payload.actualCash }, session);
    if (!closed) throw new Error('Shift was not found.');
    return {
      id: closed.shiftId,
      operator: closed.staffName,
      status: 'CLOSED',
      startTime: closed.openedAt,
      endTime: closed.closedAt,
      startingCash: closed.openingFloat,
      expectedCash: expected.expectedCash,
      actualCash: payload.actualCash,
      difference: closed.variance,
      salesCount: 0,
      totalSales: 0
    };
  }
};
