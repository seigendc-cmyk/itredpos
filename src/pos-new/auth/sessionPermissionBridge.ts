import { getCurrentTenantSession } from './tenantSessionService';
import type { TenantUserRole } from './authTypes';
import { canPerformAction, getPermissionsForRole, type PermissionKey, type PosAction } from '../utils/posPermissions';

export function getPermissionsForTenantRole(role?: TenantUserRole): PermissionKey[] {
  if (role === 'VendorOwner' || role === 'VendorAdmin') return getPermissionsForRole('Owner');
  if (role === 'StockController') return getPermissionsForRole('Stock Controller');
  if (role === 'DeliveryStaff') return getPermissionsForRole('Delivery Staff');
  if (role === 'Manager' || role === 'Supervisor' || role === 'Cashier') return getPermissionsForRole(role);
  return [];
}

export function getCurrentSessionPermissions(): PermissionKey[] {
  const session = getCurrentTenantSession();
  if (session.isBuildDevelopmentSession && session.staffRole === 'VendorOwner') return getPermissionsForRole('Owner');
  return session.permissions || getPermissionsForTenantRole(session.staffRole);
}

export function hasSessionPermission(permission: PermissionKey): boolean {
  return getCurrentSessionPermissions().includes(permission);
}

export function isBuildDevelopmentOwnerSession(): boolean {
  const session = getCurrentTenantSession();
  return Boolean(session.isBuildDevelopmentSession && session.staffRole === 'VendorOwner');
}

export function canCurrentSessionPerform(action: PosAction): boolean {
  const session = getCurrentTenantSession();
  if (isBuildDevelopmentOwnerSession()) return true;
  if (session.staffRole === 'StockController') return canPerformAction('Stock Controller', action);
  if (session.staffRole === 'DeliveryStaff') return canPerformAction('Delivery Staff', action);
  if (session.staffRole === 'Manager' || session.staffRole === 'Supervisor' || session.staffRole === 'Cashier') return canPerformAction(session.staffRole, action);
  return false;
}

