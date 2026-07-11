import { readSciPosStaffSession, type SciPosStaffSession } from '../../sci-auth/StaffAuthService';
import type { PosSession } from '../types';

export const POS_SESSION_INCOMPLETE_MESSAGE = 'Your POS session is incomplete. Please sign in again.';

const BLOCKED_VENDOR_IDS = new Set([
  'demo-vendor-001',
  'unassigned-vendor',
  'DEMO-VENDOR',
  'demo-vendor',
  'test-vendor-001',
  'unlicensed'
]);

export interface CanonicalPurchaseSession {
  vendorId: string;
  vendorName: string;
  branchId: string;
  branchName: string;
  warehouseId: string;
  warehouseName: string;
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

function fromSciSession(session: SciPosStaffSession | null): CanonicalPurchaseSession | null {
  if (!session) return null;
  return {
    vendorId: clean(session.vendorId),
    vendorName: clean(session.vendorName),
    branchId: clean(session.branchId),
    branchName: clean(session.branchName),
    warehouseId: clean(session.warehouseId),
    warehouseName: clean(session.warehouseName),
    terminalId: clean(session.terminalId),
    terminalName: clean(session.terminalName),
    staffId: clean(session.staffId),
    staffName: clean(session.staffName),
    role: clean(session.role),
    permissions: Array.isArray(session.permissions) ? session.permissions.map(clean).filter(Boolean) : [],
    signedInAt: clean(session.signedInAt)
  };
}

export function normalizePurchaseSession(session?: PosSession | CanonicalPurchaseSession | null): CanonicalPurchaseSession | null {
  if (!session) return fromSciSession(readSciPosStaffSession());
  const row = session as PosSession & Partial<CanonicalPurchaseSession>;
  return {
    vendorId: clean(row.vendorId),
    vendorName: clean(row.vendorName || row.vendor),
    branchId: clean(row.branchId),
    branchName: clean(row.branchName || row.branch),
    warehouseId: clean(row.warehouseId),
    warehouseName: clean(row.warehouseName || row.warehouse),
    terminalId: clean(row.terminalId),
    terminalName: clean(row.terminalName || row.terminal),
    staffId: clean(row.staffId),
    staffName: clean(row.staffName),
    role: clean(row.role),
    permissions: Array.isArray(row.permissions) ? row.permissions.map(clean).filter(Boolean) : [],
    signedInAt: clean(row.signedInAt || row.openedAt)
  };
}

export function validatePurchaseSession(session: CanonicalPurchaseSession | null): { ok: boolean; message: string } {
  if (!session) return { ok: false, message: POS_SESSION_INCOMPLETE_MESSAGE };
  const required: Array<keyof CanonicalPurchaseSession> = [
    'vendorId',
    'vendorName',
    'branchId',
    'branchName',
    'warehouseId',
    'warehouseName',
    'terminalId',
    'terminalName',
    'staffId',
    'staffName',
    'role',
    'signedInAt'
  ];
  const missing = required.some((field) => !clean(session[field]));
  if (missing || isBlockedVendorId(session.vendorId)) {
    return { ok: false, message: POS_SESSION_INCOMPLETE_MESSAGE };
  }
  return { ok: true, message: 'POS session ready.' };
}

export function getCanonicalPurchaseSession(session?: PosSession | CanonicalPurchaseSession | null): CanonicalPurchaseSession | null {
  return normalizePurchaseSession(session);
}

export function assertCanonicalPurchaseSession(session?: PosSession | CanonicalPurchaseSession | null): CanonicalPurchaseSession {
  const resolved = getCanonicalPurchaseSession(session);
  const validation = validatePurchaseSession(resolved);
  if (!validation.ok || !resolved) {
    throw new Error(validation.message);
  }
  return resolved;
}

export function hasPurchasePermission(session: CanonicalPurchaseSession, permission: string): boolean {
  return session.permissions.includes('*') || session.permissions.includes(permission);
}
