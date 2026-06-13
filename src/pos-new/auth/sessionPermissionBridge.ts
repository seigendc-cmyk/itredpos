import { getCurrentTenantSession } from './tenantSessionService';
import type { TenantUserRole } from './authTypes';
import { type PermissionKey, type PosAction } from '../utils/posPermissions';
import {
  canCurrentSessionPerformAction,
  getEffectivePermissionsForRole,
  getEffectivePermissionsForSession,
  isOwnerBypassSession,
  normalizeRoleKey
} from './effectivePermissionService';

const actionPermissionMap: Partial<Record<PosAction, string>> = {
  'sales.create': 'sales.open',
  'settings.manage': 'settings.permissions.edit',
  'stockAdjustments.create': 'stockAdjustment.create',
  'stockAdjustments.approve': 'stockAdjustment.approve',
  'stockAdjustments.post': 'stockAdjustment.post',
  'goodsReceiving.post': 'goodsReceiving.post',
  'supplierReturns.post': 'supplierReturn.post',
  'stockTransfers.dispatch': 'stockTransfer.dispatch',
  'stockTransfers.receive': 'stockTransfer.receive',
  'approvals.approve': 'approvals.approveLowRisk',
  COMPLETE_SALE: 'sales.complete',
  APPLY_DISCOUNT: 'sales.discount',
  APPROVE_OVERRIDE: 'approvals.approveLowRisk',
  VIEW_BI: 'bi.view',
  OPEN_SETTINGS: 'settings.view',
  CLOSE_SHIFT: 'sales.endOfDay.run',
  RECORD_CASH_MOVEMENT: 'accounting.review',
  STOCK_ADJUSTMENT: 'stockAdjustment.create',
  STOCKTAKE: 'stocktake.create',
  OWNER_FINANCIAL_EXPORT: 'reports.export'
};

export function getPermissionsForTenantRole(role?: TenantUserRole): PermissionKey[] {
  return getEffectivePermissionsForRole(normalizeRoleKey(role || 'Viewer')) as PermissionKey[];
}

export function getCurrentSessionPermissions(): PermissionKey[] {
  const session = getCurrentTenantSession();
  if (isOwnerBypassSession(session)) return getEffectivePermissionsForRole('Owner') as PermissionKey[];
  return (session.permissions?.length ? session.permissions : getEffectivePermissionsForSession(session)) as PermissionKey[];
}

export function hasSessionPermission(permission: PermissionKey): boolean {
  return getCurrentSessionPermissions().includes(permission) || getCurrentSessionPermissions().includes(permission as PermissionKey);
}

export function isBuildDevelopmentOwnerSession(): boolean {
  const session = getCurrentTenantSession();
  return Boolean(session.isBuildDevelopmentSession && session.staffRole === 'VendorOwner');
}

export function canCurrentSessionPerform(action: PosAction): boolean {
  const permissionKey = actionPermissionMap[action] || action;
  return canCurrentSessionPerformAction(permissionKey);
}
