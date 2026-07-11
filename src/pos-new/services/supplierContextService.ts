import { readSciPosStaffSession, type SciPosStaffSession } from '../../sci-auth/StaffAuthService';
import type { PosSession } from '../types';

export const POS_SUPPLIER_SESSION_INCOMPLETE_MESSAGE = 'Your POS session is incomplete. Please sign in again.';

const BLOCKED_VENDOR_IDS = new Set([
  'demo-vendor-001',
  'unassigned-vendor',
  'DEMO-VENDOR',
  'demo-vendor',
  'test-vendor-001',
  'unlicensed'
]);

export interface CanonicalSupplierContext {
  vendorId: string;
  branchId: string;
  warehouseId: string;
  terminalId: string;
  staffId: string;
  staffName: string;
  role: string;
  permissions: string[];
}

function clean(value: unknown): string {
  return String(value ?? '').trim();
}

function permissionsFrom(value: unknown): string[] {
  return Array.isArray(value) ? value.map(clean).filter(Boolean) : [];
}

function blockedVendorId(vendorId: string): boolean {
  return BLOCKED_VENDOR_IDS.has(vendorId) || BLOCKED_VENDOR_IDS.has(vendorId.toLowerCase());
}

function fromSciSession(session: SciPosStaffSession | null): CanonicalSupplierContext | null {
  if (!session) return null;
  return {
    vendorId: clean(session.vendorId),
    branchId: clean(session.branchId),
    warehouseId: clean(session.warehouseId),
    terminalId: clean(session.terminalId),
    staffId: clean(session.staffId),
    staffName: clean(session.staffName),
    role: clean(session.role),
    permissions: permissionsFrom(session.permissions)
  };
}

export function normalizeSupplierContext(session?: PosSession | CanonicalSupplierContext | null): CanonicalSupplierContext | null {
  if (!session) return fromSciSession(readSciPosStaffSession());
  const row = session as PosSession & Partial<CanonicalSupplierContext>;
  return {
    vendorId: clean(row.vendorId),
    branchId: clean(row.branchId),
    warehouseId: clean(row.warehouseId),
    terminalId: clean(row.terminalId),
    staffId: clean(row.staffId),
    staffName: clean(row.staffName),
    role: clean(row.role),
    permissions: permissionsFrom(row.permissions)
  };
}

export function validateSupplierContext(context: CanonicalSupplierContext | null): { ok: boolean; message: string } {
  if (!context) return { ok: false, message: POS_SUPPLIER_SESSION_INCOMPLETE_MESSAGE };
  if (!context.vendorId || !context.staffId || blockedVendorId(context.vendorId)) {
    return { ok: false, message: POS_SUPPLIER_SESSION_INCOMPLETE_MESSAGE };
  }
  return { ok: true, message: 'Supplier context ready.' };
}

export function assertCanonicalSupplierContext(session?: PosSession | CanonicalSupplierContext | null): CanonicalSupplierContext {
  const context = normalizeSupplierContext(session);
  const validation = validateSupplierContext(context);
  if (!validation.ok || !context) throw new Error(validation.message);
  return context;
}

export function hasSupplierPermission(context: CanonicalSupplierContext, permission: string): boolean {
  return context.permissions.includes('*') || context.permissions.includes(permission);
}
