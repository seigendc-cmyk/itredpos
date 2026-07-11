import { readSciPosStaffSession, type SciPosStaffSession } from '../../sci-auth/StaffAuthService';
import type { PosSession } from '../types';

export const POS_CASH_SESSION_INCOMPLETE_MESSAGE = 'Your POS session is incomplete. Please sign in again.';

const BLOCKED_VENDOR_IDS = new Set([
  'demo-vendor-001',
  'unassigned-vendor',
  'DEMO-VENDOR',
  'demo-vendor',
  'test-vendor-001',
  'unlicensed'
]);

export interface CanonicalCashSession {
  vendorId: string;
  vendorName: string;
  branchId: string;
  branchName: string;
  warehouseId: string;
  terminalId: string;
  terminalName: string;
  staffId: string;
  staffName: string;
  role: string;
  permissions: string[];
  signedInAt: string;
}

function clean(value: unknown): string {
  return String(value ?? '').trim();
}

function isBlockedVendorId(vendorId: string): boolean {
  return BLOCKED_VENDOR_IDS.has(vendorId) || BLOCKED_VENDOR_IDS.has(vendorId.toLowerCase());
}

function permissionsFrom(value: unknown): string[] {
  return Array.isArray(value) ? value.map(clean).filter(Boolean) : [];
}

function fromSciSession(session: SciPosStaffSession | null): CanonicalCashSession | null {
  if (!session) return null;
  return {
    vendorId: clean(session.vendorId),
    vendorName: clean(session.vendorName),
    branchId: clean(session.branchId),
    branchName: clean(session.branchName),
    warehouseId: clean(session.warehouseId),
    terminalId: clean(session.terminalId),
    terminalName: clean(session.terminalName),
    staffId: clean(session.staffId),
    staffName: clean(session.staffName),
    role: clean(session.role),
    permissions: permissionsFrom(session.permissions),
    signedInAt: clean(session.signedInAt)
  };
}

export function normalizeCashSession(session?: PosSession | CanonicalCashSession | null): CanonicalCashSession | null {
  if (!session) return fromSciSession(readSciPosStaffSession());
  const row = session as PosSession & Partial<CanonicalCashSession>;
  return {
    vendorId: clean(row.vendorId),
    vendorName: clean(row.vendorName || row.vendor),
    branchId: clean(row.branchId),
    branchName: clean(row.branchName || row.branch),
    warehouseId: clean(row.warehouseId),
    terminalId: clean(row.terminalId),
    terminalName: clean(row.terminalName || row.terminal),
    staffId: clean(row.staffId),
    staffName: clean(row.staffName),
    role: clean(row.role),
    permissions: permissionsFrom(row.permissions),
    signedInAt: clean(row.signedInAt || row.openedAt)
  };
}

export function validateCashSession(session: CanonicalCashSession | null): { ok: boolean; message: string } {
  if (!session) return { ok: false, message: POS_CASH_SESSION_INCOMPLETE_MESSAGE };
  const missingRequired = !clean(session.vendorId)
    || !clean(session.branchId)
    || !clean(session.terminalId)
    || !clean(session.staffId);
  if (missingRequired || isBlockedVendorId(session.vendorId)) {
    return { ok: false, message: POS_CASH_SESSION_INCOMPLETE_MESSAGE };
  }
  return { ok: true, message: 'POS cash session ready.' };
}

export function getCanonicalCashSession(session?: PosSession | CanonicalCashSession | null): CanonicalCashSession | null {
  return normalizeCashSession(session);
}

export function assertCanonicalCashSession(session?: PosSession | CanonicalCashSession | null): CanonicalCashSession {
  const resolved = getCanonicalCashSession(session);
  const validation = validateCashSession(resolved);
  if (!validation.ok || !resolved) {
    throw new Error(validation.message);
  }
  return resolved;
}

export function hasCashPermission(session: CanonicalCashSession, permission: string): boolean {
  return session.permissions.includes('*') || session.permissions.includes(permission);
}
