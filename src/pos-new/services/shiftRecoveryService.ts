import type { CashDrawerAssignment, ShiftSessionControl, TerminalControlCheck } from '../types';

const RECOVERY_STATE_KEY = 'itred_pos_shift_recovery_state_v1';
const PENDING_PROCESS_KEY = 'itred_pos_shift_pending_process_v1';
const CHECKPOINT_KEY = 'itred_pos_shift_recovery_checkpoints_v1';

export type ShiftProcessType =
  | 'opening-shift'
  | 'closing-shift'
  | 'drawer-assignment'
  | 'eod-preview'
  | 'payment-reconciliation';

export interface ShiftRecoveryState {
  savedAt: string;
  vendorId: string;
  branchId: string;
  branchName: string;
  terminalId: string;
  terminalName: string;
  staffId: string;
  staffName: string;
  roleName: string;
  shift?: ShiftSessionControl | null;
  drawerAssignment?: CashDrawerAssignment | null;
  readiness?: TerminalControlCheck | null;
  statusMessage?: string;
  lastCheckpoint?: string;
}

export interface PendingShiftProcess {
  id: string;
  type: ShiftProcessType;
  label: string;
  startedAt: string;
  updatedAt: string;
  terminalId: string;
  staffName: string;
  payload?: Record<string, unknown>;
}

export interface ShiftRecoveryCheckpoint {
  id: string;
  label: string;
  createdAt: string;
  payload?: unknown;
}

function canUseLocalStorage(): boolean {
  return typeof localStorage !== 'undefined';
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function readJson<T>(key: string, fallback: T): T {
  if (!canUseLocalStorage()) return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (!canUseLocalStorage()) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local recovery is best-effort and must not block the POS workflow.
  }
}

function removeJson(key: string): void {
  if (!canUseLocalStorage()) return;
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage failures.
  }
}

export function saveShiftRecoveryState(state: ShiftRecoveryState): void {
  writeJson(RECOVERY_STATE_KEY, { ...state, savedAt: nowIso() });
  markRecoveryCheckpoint('SHIFT_RECOVERY_STATE_SAVED', {
    terminalId: state.terminalId,
    staffName: state.staffName,
    shiftStatus: state.shift?.status,
    drawerStatus: state.drawerAssignment?.status
  });
}

export function getShiftRecoveryState(): ShiftRecoveryState | null {
  return readJson<ShiftRecoveryState | null>(RECOVERY_STATE_KEY, null);
}

export function clearShiftRecoveryState(): void {
  removeJson(RECOVERY_STATE_KEY);
  markRecoveryCheckpoint('SHIFT_RECOVERY_STATE_CLEARED', {});
}

export function hasRecoverableShiftState(): boolean {
  const state = getShiftRecoveryState();
  return Boolean(state?.terminalId && state?.staffName);
}

export function recoverShiftState(): ShiftRecoveryState | null {
  const state = getShiftRecoveryState();
  if (state) {
    markRecoveryCheckpoint('SHIFT_RECOVERY_STATE_RESTORED', {
      terminalId: state.terminalId,
      staffName: state.staffName,
      shiftStatus: state.shift?.status
    });
  }
  return state;
}

export function savePendingShiftProcess(process: PendingShiftProcess): void {
  writeJson(PENDING_PROCESS_KEY, { ...process, updatedAt: nowIso() });
}

export function clearPendingShiftProcess(): void {
  removeJson(PENDING_PROCESS_KEY);
}

export function getPendingShiftProcess(): PendingShiftProcess | null {
  return readJson<PendingShiftProcess | null>(PENDING_PROCESS_KEY, null);
}

export function markRecoveryCheckpoint(label: string, payload?: unknown): ShiftRecoveryCheckpoint {
  const checkpoint: ShiftRecoveryCheckpoint = {
    id: makeId('SRC'),
    label,
    createdAt: nowIso(),
    payload
  };
  const current = readJson<ShiftRecoveryCheckpoint[]>(CHECKPOINT_KEY, []);
  writeJson(CHECKPOINT_KEY, [checkpoint, ...current].slice(0, 50));
  return checkpoint;
}

export function getShiftRecoveryCheckpoints(): ShiftRecoveryCheckpoint[] {
  return readJson<ShiftRecoveryCheckpoint[]>(CHECKPOINT_KEY, []);
}

export function makePendingShiftProcess(input: Omit<PendingShiftProcess, 'id' | 'startedAt' | 'updatedAt'>): PendingShiftProcess {
  const startedAt = nowIso();
  return {
    ...input,
    id: makeId('SPP'),
    startedAt,
    updatedAt: startedAt
  };
}
