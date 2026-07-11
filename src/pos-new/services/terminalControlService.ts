import {
  mockCashDrawerAssignments,
  mockShiftSessionControls,
  mockTerminalActivationRequests,
  mockTerminalControlEvents,
  mockTerminalLifecycleRecords
} from '../mock/mockPosData';
import {
  CashDrawerAssignment,
  PosSession,
  Role,
  ShiftSessionControl,
  TerminalActivationRequest,
  TerminalControlCheck,
  TerminalControlEvent,
  TerminalLifecycleRecord
} from '../types';
import { canPerformAction } from '../utils/posPermissions';
import { readVendorScopedList, writeVendorScopedList } from '../utils/vendorDataMode';
import { calculateExpectedCash, POS_SHIFT_STORE_KEY, recordCashMovement } from './cashMovementService';
import { finalizeCashCount } from './cashCountService';

const TERMINAL_KEY = 'itred_pos_terminal_lifecycle_v1';
const REQUEST_KEY = 'itred_pos_terminal_activation_requests_v1';
const SHIFT_KEY = POS_SHIFT_STORE_KEY;
const DRAWER_KEY = 'itred_pos_cash_drawer_assignments_v1';
const EVENT_KEY = 'itred_pos_terminal_control_events_v1';

export interface TerminalControlContext {
  vendorId: string;
  branchId: string;
  terminalId: string;
  terminalName?: string;
  staffId?: string;
  staffName: string;
  role: Role;
  requiresCashDrawer?: boolean;
}

function canUseLocalStorage(): boolean {
  return typeof localStorage !== 'undefined';
}

function readList<T>(key: string, fallback: T[], vendorId?: string): T[] {
  if (!canUseLocalStorage()) return [];
  return readVendorScopedList<T>(key, fallback, vendorId);
}

function saveList<T>(key: string, value: T[], vendorId?: string): void {
  if (!canUseLocalStorage()) return;
  writeVendorScopedList(key, value, vendorId);
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function normalizeTerminalId(value: string): string {
  return value.trim().toUpperCase();
}

function terminalMatches(recordTerminalId: string, terminalId: string): boolean {
  const left = normalizeTerminalId(recordTerminalId);
  const right = normalizeTerminalId(terminalId);
  return left === right || left.includes(right) || right.includes(left);
}

async function recordTerminalEvent(event: Omit<TerminalControlEvent, 'id' | 'createdAt'>): Promise<TerminalControlEvent> {
  const events = readList<TerminalControlEvent>(EVENT_KEY, mockTerminalControlEvents, event.vendorId);
  const nextEvent: TerminalControlEvent = {
    ...event,
    id: makeId('TCE'),
    createdAt: nowIso()
  };
  saveList(EVENT_KEY, [nextEvent, ...events].slice(0, 80), event.vendorId);
  return nextEvent;
}

export async function getTerminalLifecycle(
  vendorId: string,
  branchId: string,
  terminalId: string
): Promise<TerminalLifecycleRecord | null> {
  const records = readList<TerminalLifecycleRecord>(TERMINAL_KEY, mockTerminalLifecycleRecords, vendorId);
  return records.find((record) =>
    record.vendorId === vendorId
    && record.branchId === branchId
    && terminalMatches(record.terminalId, terminalId)
  ) || records.find((record) =>
    record.vendorId === vendorId
    && terminalMatches(record.terminalId, terminalId)
  ) || null;
}

export async function getTerminalActivationRequests(
  vendorId: string,
  branchId?: string
): Promise<TerminalActivationRequest[]> {
  const requests = readList<TerminalActivationRequest>(REQUEST_KEY, mockTerminalActivationRequests, vendorId);
  return requests.filter((request) => request.vendorId === vendorId && (!branchId || request.branchId === branchId));
}

export async function requestTerminalActivation(input: {
  vendorId: string;
  branchId: string;
  terminalId: string;
  terminalName: string;
  requestedBy: string;
  reason: string;
}): Promise<TerminalActivationRequest> {
  const requests = readList<TerminalActivationRequest>(REQUEST_KEY, mockTerminalActivationRequests, input.vendorId);
  const terminals = readList<TerminalLifecycleRecord>(TERMINAL_KEY, mockTerminalLifecycleRecords, input.vendorId);
  const requestedAt = nowIso();
  const request: TerminalActivationRequest = {
    id: makeId('TAR'),
    status: 'Activation Requested',
    requestedAt,
    ...input
  };
  const lifecycle: TerminalLifecycleRecord = {
    id: makeId('TLC'),
    vendorId: input.vendorId,
    branchId: input.branchId,
    terminalId: input.terminalId,
    terminalName: input.terminalName,
    status: 'Activation Requested',
    requestedBy: input.requestedBy,
    requestedAt,
    reason: input.reason,
    updatedAt: requestedAt
  };
  saveList(REQUEST_KEY, [request, ...requests], input.vendorId);
  saveList(TERMINAL_KEY, [lifecycle, ...terminals.filter((record) => !terminalMatches(record.terminalId, input.terminalId))], input.vendorId);
  await recordTerminalEvent({
    vendorId: input.vendorId,
    branchId: input.branchId,
    terminalId: input.terminalId,
    staffName: input.requestedBy,
    eventType: 'ACTIVATE_TERMINAL',
    message: `${input.terminalId} activation requested.`,
    severity: 'INFO'
  });
  return request;
}

export async function approveTerminalActivation(
  requestId: string,
  approvedBy: string
): Promise<TerminalLifecycleRecord | null> {
  const requests = readList<TerminalActivationRequest>(REQUEST_KEY, mockTerminalActivationRequests);
  const request = requests.find((item) => item.id === requestId);
  if (!request) return null;
  const approvedAt = nowIso();
  const updatedRequests = requests.map((item) => item.id === requestId ? {
    ...item,
    status: 'Active' as const,
    approvedBy,
    approvedAt
  } : item);
  const terminals = readList<TerminalLifecycleRecord>(TERMINAL_KEY, mockTerminalLifecycleRecords, request.vendorId);
  const record: TerminalLifecycleRecord = {
    id: `TLC-${request.terminalId}`,
    vendorId: request.vendorId,
    branchId: request.branchId,
    terminalId: request.terminalId,
    terminalName: request.terminalName,
    status: 'Active',
    requestedBy: request.requestedBy,
    requestedAt: request.requestedAt,
    approvedBy,
    approvedAt,
    reason: request.reason,
    updatedAt: approvedAt
  };
  saveList(REQUEST_KEY, updatedRequests, request.vendorId);
  saveList(TERMINAL_KEY, [record, ...terminals.filter((item) => !terminalMatches(item.terminalId, request.terminalId))], request.vendorId);
  await recordTerminalEvent({
    vendorId: request.vendorId,
    branchId: request.branchId,
    terminalId: request.terminalId,
    staffName: approvedBy,
    eventType: 'ACTIVATE_TERMINAL',
    message: `${request.terminalId} activated.`,
    severity: 'INFO'
  });
  return record;
}

async function updateTerminalStatus(
  context: Pick<TerminalControlContext, 'vendorId' | 'branchId' | 'terminalId' | 'staffName'>,
  status: TerminalLifecycleRecord['status'],
  message: string,
  reason?: string
): Promise<TerminalLifecycleRecord> {
  const terminals = readList<TerminalLifecycleRecord>(TERMINAL_KEY, mockTerminalLifecycleRecords, context.vendorId);
  const existing = terminals.find((record) =>
    record.vendorId === context.vendorId
    && record.branchId === context.branchId
    && terminalMatches(record.terminalId, context.terminalId)
  );
  const updatedAt = nowIso();
  const record: TerminalLifecycleRecord = {
    id: existing?.id || makeId('TLC'),
    vendorId: context.vendorId,
    branchId: context.branchId,
    terminalId: context.terminalId,
    terminalName: existing?.terminalName || context.terminalId,
    status,
    approvedBy: existing?.approvedBy,
    approvedAt: existing?.approvedAt,
    requestedBy: existing?.requestedBy,
    requestedAt: existing?.requestedAt,
    reason,
    lockedReason: status === 'Locked' ? reason || 'Terminal is locked pending review.' : undefined,
    updatedAt
  };
  saveList(TERMINAL_KEY, [record, ...terminals.filter((item) => !terminalMatches(item.terminalId, context.terminalId))], context.vendorId);
  await recordTerminalEvent({
    vendorId: context.vendorId,
    branchId: context.branchId,
    terminalId: context.terminalId,
    staffName: context.staffName,
    eventType: status === 'Locked' ? 'LOCK_TERMINAL' : 'DEACTIVATE_TERMINAL',
    message,
    severity: status === 'Locked' ? 'WARNING' : 'INFO'
  });
  return record;
}

export async function deactivateTerminal(context: Pick<TerminalControlContext, 'vendorId' | 'branchId' | 'terminalId' | 'staffName'>, reason = 'Terminal deactivated.'): Promise<TerminalLifecycleRecord> {
  return updateTerminalStatus(context, 'Deactivated', `${context.terminalId} deactivated.`, reason);
}

export async function lockTerminal(context: Pick<TerminalControlContext, 'vendorId' | 'branchId' | 'terminalId' | 'staffName'>, reason = 'Terminal is locked pending review.'): Promise<TerminalLifecycleRecord> {
  return updateTerminalStatus(context, 'Locked', `${context.terminalId} locked pending review.`, reason);
}

export async function requestTerminalReactivation(context: Pick<TerminalControlContext, 'vendorId' | 'branchId' | 'terminalId' | 'terminalName' | 'staffName'>, reason = 'Terminal reactivation requested.'): Promise<TerminalActivationRequest> {
  return requestTerminalActivation({
    vendorId: context.vendorId,
    branchId: context.branchId,
    terminalId: context.terminalId,
    terminalName: context.terminalName || context.terminalId,
    requestedBy: context.staffName,
    reason
  });
}

export async function getShiftSessionControl(
  vendorId: string,
  branchId: string,
  terminalId: string,
  staffId?: string
): Promise<ShiftSessionControl | null> {
  const shifts = readList<ShiftSessionControl>(SHIFT_KEY, mockShiftSessionControls, vendorId);
  const terminalShifts = shifts.filter((shift) =>
    shift.vendorId === vendorId
    && shift.branchId === branchId
    && terminalMatches(shift.terminalId, terminalId)
  );
  return terminalShifts.find((shift) => staffId && shift.staffId === staffId && shift.status === 'Open')
    || terminalShifts.find((shift) => shift.status === 'Open')
    || terminalShifts[0]
    || null;
}

export async function getCashDrawerAssignments(
  vendorId: string,
  branchId: string,
  terminalId?: string
): Promise<CashDrawerAssignment[]> {
  const drawers = readList<CashDrawerAssignment>(DRAWER_KEY, mockCashDrawerAssignments, vendorId);
  return drawers.filter((drawer) =>
    drawer.vendorId === vendorId
    && drawer.branchId === branchId
    && (!terminalId || terminalMatches(drawer.terminalId, terminalId))
  );
}

export async function openShift(input: {
  vendorId: string;
  branchId: string;
  terminalId: string;
  terminalName: string;
  staffId: string;
  staffName: string;
  openingFloat: number;
  notes?: string;
  session?: PosSession | null;
}): Promise<ShiftSessionControl> {
  if (input.openingFloat < 0) throw new Error('Opening float cannot be negative.');
  const shifts = readList<ShiftSessionControl>(SHIFT_KEY, mockShiftSessionControls, input.vendorId);
  const activeShift = shifts.find((item) =>
    item.vendorId === input.vendorId
    && (terminalMatches(item.terminalId, input.terminalId) || item.staffId === input.staffId)
    && ['Open', 'Counting', 'PendingApproval', 'Reopened'].includes(item.status)
  );
  if (activeShift && terminalMatches(activeShift.terminalId, input.terminalId)) {
    throw new Error('An open shift already exists for this terminal.');
  }
  if (activeShift && activeShift.staffId === input.staffId) {
    throw new Error('This staff member already has an open shift.');
  }
  const openedAt = nowIso();
  const shift: ShiftSessionControl = {
    id: makeId('SSC'),
    vendorId: input.vendorId,
    branchId: input.branchId,
    terminalId: input.terminalId,
    terminalName: input.terminalName,
    staffId: input.staffId,
    staffName: input.staffName,
    status: 'Open',
    openedAt,
    openingFloat: input.openingFloat,
    expectedCash: input.openingFloat,
    notes: input.notes
  };
  saveList(SHIFT_KEY, [shift, ...shifts], input.vendorId);
  await recordCashMovement({
    movementType: 'OPENING_FLOAT',
    amount: input.openingFloat,
    shiftId: shift.id,
    referenceType: 'SHIFT',
    referenceId: shift.id,
    reason: input.notes || 'Opening float recorded at shift open.',
    idempotencyKey: `${shift.id}_OPENING_FLOAT`,
    createdAt: openedAt,
    allowPendingApproval: true
  }, input.session || {
    vendorId: input.vendorId,
    vendorName: input.vendorId,
    branchId: input.branchId,
    branchName: input.branchId,
    warehouseId: input.branchId,
    terminalId: input.terminalId,
    terminalName: input.terminalName,
    staffId: input.staffId,
    staffName: input.staffName,
    role: 'POS Operator',
    permissions: [],
    signedInAt: openedAt
  });
  await recordTerminalEvent({
    vendorId: input.vendorId,
    branchId: input.branchId,
    terminalId: input.terminalId,
    staffId: input.staffId,
    staffName: input.staffName,
    eventType: 'OPEN_SHIFT',
    message: `${input.staffName} opened shift on ${input.terminalId}.`,
    severity: 'INFO'
  });
  return shift;
}

export async function closeShift(shiftId: string, declaredCash: number, staffName: string, session?: PosSession | null): Promise<ShiftSessionControl | null> {
  const shifts = readList<ShiftSessionControl>(SHIFT_KEY, mockShiftSessionControls);
  const existing = shifts.find((shift) => shift.id === shiftId);
  if (!existing) return null;
  if (existing.status === 'Closed' || existing.status === 'Force Closed' || existing.status === 'Locked') return existing;
  const cash = await calculateExpectedCash(existing.id, existing.vendorId);
  const expectedCash = cash.expectedCash;
  const variance = declaredCash - expectedCash;
  const status = Math.abs(variance) > 20 ? 'PendingApproval' : 'Closed';
  await finalizeCashCount({
    shiftId: existing.id,
    countedCash: declaredCash,
    notes: status === 'PendingApproval' ? 'Material variance requires review.' : 'Drawer count confirmed during shift close.',
    explanation: status === 'PendingApproval' ? '' : 'Variance reviewed during shift close.',
    confirmedByStaff: true
  }, session || {
    vendorId: existing.vendorId,
    vendorName: existing.vendorId,
    branchId: existing.branchId,
    branchName: existing.branchId,
    warehouseId: existing.branchId,
    terminalId: existing.terminalId,
    terminalName: existing.terminalName,
    staffId: existing.staffId,
    staffName: existing.staffName,
    role: 'POS Operator',
    permissions: [],
    signedInAt: existing.openedAt || nowIso()
  });
  const updated: ShiftSessionControl = {
    ...existing,
    status,
    closedAt: nowIso(),
    expectedCash,
    declaredCash,
    variance,
    reviewedBy: staffName
  };
  saveList(SHIFT_KEY, shifts.map((shift) => shift.id === shiftId ? updated : shift), existing.vendorId);
  await recordTerminalEvent({
    vendorId: updated.vendorId,
    branchId: updated.branchId,
    terminalId: updated.terminalId,
    staffId: updated.staffId,
    staffName,
    eventType: 'CLOSE_SHIFT',
    message: status === 'PendingApproval'
      ? `${updated.terminalId} shift close is pending approval with variance USD ${variance.toFixed(2)}.`
      : `${updated.terminalId} shift closed with variance USD ${variance.toFixed(2)}.`,
    severity: variance === 0 ? 'INFO' : 'WARNING'
  });
  return updated;
}

export async function forceCloseShift(shiftId: string, staffName: string): Promise<ShiftSessionControl | null> {
  const shifts = readList<ShiftSessionControl>(SHIFT_KEY, mockShiftSessionControls);
  const existing = shifts.find((shift) => shift.id === shiftId);
  if (!existing) return null;
  const updated: ShiftSessionControl = {
    ...existing,
    status: 'Force Closed',
    closedAt: nowIso(),
    reviewedBy: staffName
  };
  saveList(SHIFT_KEY, shifts.map((shift) => shift.id === shiftId ? updated : shift), existing.vendorId);
  await recordTerminalEvent({
    vendorId: updated.vendorId,
    branchId: updated.branchId,
    terminalId: updated.terminalId,
    staffId: updated.staffId,
    staffName,
    eventType: 'FORCE_CLOSE_SHIFT',
    message: `${updated.terminalId} shift force closed.`,
    severity: 'WARNING'
  });
  return updated;
}

export async function assignCashDrawer(input: {
  vendorId: string;
  branchId: string;
  terminalId: string;
  terminalName: string;
  drawerId: string;
  staffId: string;
  staffName: string;
  openingFloat: number;
  notes?: string;
}): Promise<CashDrawerAssignment> {
  const drawers = readList<CashDrawerAssignment>(DRAWER_KEY, mockCashDrawerAssignments, input.vendorId);
  const assignment: CashDrawerAssignment = {
    id: makeId('CDA'),
    status: 'Assigned',
    assignedAt: nowIso(),
    ...input
  };
  saveList(DRAWER_KEY, [assignment, ...drawers.map((drawer) =>
    terminalMatches(drawer.terminalId, input.terminalId) && drawer.status === 'Assigned'
      ? { ...drawer, status: 'Unassigned' as const, unassignedAt: nowIso() }
      : drawer
  )], input.vendorId);
  await recordTerminalEvent({
    vendorId: input.vendorId,
    branchId: input.branchId,
    terminalId: input.terminalId,
    staffId: input.staffId,
    staffName: input.staffName,
    eventType: 'ASSIGN_CASH_DRAWER',
    message: `${input.drawerId} assigned to ${input.staffName}.`,
    severity: 'INFO'
  });
  return assignment;
}

export async function unassignCashDrawer(assignmentId: string, staffName: string): Promise<CashDrawerAssignment | null> {
  const drawers = readList<CashDrawerAssignment>(DRAWER_KEY, mockCashDrawerAssignments);
  const existing = drawers.find((drawer) => drawer.id === assignmentId);
  if (!existing) return null;
  const updated: CashDrawerAssignment = {
    ...existing,
    status: 'Unassigned',
    unassignedAt: nowIso()
  };
  saveList(DRAWER_KEY, drawers.map((drawer) => drawer.id === assignmentId ? updated : drawer), existing.vendorId);
  await recordTerminalEvent({
    vendorId: updated.vendorId,
    branchId: updated.branchId,
    terminalId: updated.terminalId,
    staffId: updated.staffId,
    staffName,
    eventType: 'UNASSIGN_CASH_DRAWER',
    message: `${updated.drawerId} unassigned.`,
    severity: 'INFO'
  });
  return updated;
}

export async function canTerminalSell(context: TerminalControlContext): Promise<boolean> {
  const check = await runTerminalControlCheck(context);
  return check.allowed;
}

export async function runTerminalControlCheck(context: TerminalControlContext): Promise<TerminalControlCheck> {
  const terminal = await getTerminalLifecycle(context.vendorId, context.branchId, context.terminalId);
  const shift = await getShiftSessionControl(context.vendorId, context.branchId, context.terminalId, context.staffId);
  const drawers = readList<CashDrawerAssignment>(DRAWER_KEY, mockCashDrawerAssignments);
  const drawerAssigned = drawers.some((drawer) =>
    drawer.vendorId === context.vendorId
    && drawer.branchId === context.branchId
    && terminalMatches(drawer.terminalId, context.terminalId)
    && drawer.status === 'Assigned'
  );
  const reasons: string[] = [];

  if (!canPerformAction(context.role, 'sales.complete')) reasons.push('You do not have permission to complete a sale.');
  if (!terminal || terminal.status !== 'Active') reasons.push(terminal?.status === 'Locked' ? 'Terminal is locked pending review.' : 'Terminal is not active.');
  if (terminal?.status === 'Suspended' || terminal?.status === 'Deactivated') reasons.push('Terminal is not active.');
  if (!shift || shift.status === 'Not Opened') reasons.push('Shift is not open.');
  if (shift?.status === 'Closed' || shift?.status === 'Force Closed' || shift?.status === 'Locked') reasons.push('Shift has been closed.');
  if (!shift || !['Open', 'Counting', 'PendingApproval', 'Reopened'].includes(shift.status)) reasons.push('Shift is not open.');
  if (context.requiresCashDrawer && !drawerAssigned) reasons.push('Cash drawer is not assigned.');

  const uniqueReasons = [...new Set(reasons)];
  return {
    allowed: uniqueReasons.length === 0,
    message: uniqueReasons[0] || 'Sales allowed.',
    reasons: uniqueReasons,
    terminalStatus: terminal?.status,
    shiftStatus: shift?.status,
    drawerAssigned,
    salesAllowed: uniqueReasons.length === 0
  };
}

export function canSellInventoryItems(input: {
  check?: TerminalControlCheck | null;
  staffSessionValid?: boolean;
  branchExists?: boolean;
  terminalExists?: boolean;
  recoveryBlocked?: boolean;
}): boolean {
  return Boolean(
    input.check?.allowed
    && input.staffSessionValid !== false
    && input.branchExists !== false
    && input.terminalExists !== false
    && input.recoveryBlocked !== true
  );
}

export async function getTerminalControlEvents(vendorId: string, branchId?: string): Promise<TerminalControlEvent[]> {
  const events = readList<TerminalControlEvent>(EVENT_KEY, mockTerminalControlEvents, vendorId);
  return events.filter((event) => event.vendorId === vendorId && (!branchId || event.branchId === branchId));
}

export async function logTerminalControlEvent(event: Omit<TerminalControlEvent, 'id' | 'createdAt'>): Promise<TerminalControlEvent> {
  return recordTerminalEvent(event);
}
