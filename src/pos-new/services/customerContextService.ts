import { readSciPosStaffSession, type SciPosStaffSession } from '../../sci-auth/StaffAuthService';
import type { PosSession } from '../types';

export const POS_CUSTOMER_SESSION_INCOMPLETE_MESSAGE = 'Your POS session is incomplete. Please sign in again.';

const BLOCKED_VENDOR_IDS = new Set([
  'demo-vendor-001',
  'unassigned-vendor',
  'DEMO-VENDOR',
  'demo-vendor',
  'test-vendor-001',
  'unlicensed'
]);

export interface CanonicalCustomerContext {
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

function fromSciSession(session: SciPosStaffSession | null): CanonicalCustomerContext | null {
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

export function normalizeCustomerContext(session?: PosSession | CanonicalCustomerContext | null): CanonicalCustomerContext | null {
  if (!session) return fromSciSession(readSciPosStaffSession());
  const row = session as PosSession & Partial<CanonicalCustomerContext>;
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

export function validateCustomerContext(context: CanonicalCustomerContext | null): { ok: boolean; message: string } {
  if (!context) return { ok: false, message: POS_CUSTOMER_SESSION_INCOMPLETE_MESSAGE };
  if (!context.vendorId || !context.staffId || blockedVendorId(context.vendorId)) {
    return { ok: false, message: POS_CUSTOMER_SESSION_INCOMPLETE_MESSAGE };
  }
  return { ok: true, message: 'Customer context ready.' };
}

export function assertCanonicalCustomerContext(session?: PosSession | CanonicalCustomerContext | null): CanonicalCustomerContext {
  const context = normalizeCustomerContext(session);
  const validation = validateCustomerContext(context);
  if (!validation.ok || !context) throw new Error(validation.message);
  return context;
}

export function hasCustomerPermission(context: CanonicalCustomerContext, permission: string): boolean {
  return context.permissions.includes('*') || context.permissions.includes(permission);
}
