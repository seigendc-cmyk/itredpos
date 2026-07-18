import { getCurrentTenantSession } from './tenantSessionService';
import type { PosPageId, PosSession } from '../types';
import type { PermissionKey } from '../utils/posPermissions';
import { isPermissionKey, validatePermissionKeys } from '../utils/posPermissions';
import {
  getEffectivePermissionsForRole as getMatrixPermissionsForRole,
  normalizeSecurityRole,
  roleHasPermission
} from './permissionMatrixService';
import type { SecurityRoleKey } from './permissionMatrixTypes';

export type PermissionSessionLike = {
  role?: string;
  staffRole?: string;
  permissions?: readonly unknown[];
  isBuildDevelopmentSession?: boolean;
  isBuildDevelopmentOwnerSession?: boolean;
};

export function normalizeRoleKey(role?: string): SecurityRoleKey {
  return normalizeSecurityRole(role || 'Viewer');
}

export function isOwnerBypassSession(session?: PermissionSessionLike | null): boolean {
  if (!session) return false;
  const role = normalizeRoleKey(session.role || session.staffRole);
  return Boolean(role === 'Owner' && (session.isBuildDevelopmentOwnerSession || session.isBuildDevelopmentSession || session.staffRole === 'VendorOwner' || session.role === 'Owner'));
}

export function getEffectivePermissionsForRole(roleKey: string): PermissionKey[] {
  const normalized = normalizeRoleKey(roleKey);
  return validatePermissionKeys(getMatrixPermissionsForRole(normalized));
}

export function getEffectivePermissionsForSession(session?: PermissionSessionLike | null): PermissionKey[] {
  if (isOwnerBypassSession(session)) return validatePermissionKeys(getMatrixPermissionsForRole('Owner'));
  const persisted = validatePermissionKeys(session?.permissions);
  return persisted.length > 0 ? persisted : getEffectivePermissionsForRole(session?.role || session?.staffRole || 'Viewer');
}

export function roleHasEffectivePermission(roleKey: string, permissionKey: string): boolean {
  return roleHasPermission(normalizeRoleKey(roleKey), permissionKey);
}

export function sessionHasEffectivePermission(session: PermissionSessionLike | null | undefined, permissionKey: string): boolean {
  if (!isPermissionKey(permissionKey)) return false;
  if (isOwnerBypassSession(session)) return true;
  return getEffectivePermissionsForSession(session).includes(permissionKey);
}

const allPosPageIds: PosPageId[] = ['DASHBOARD', 'OWNER_DESK', 'SALES', 'SALES_HISTORY', 'CUSTOMER_CENTRE', 'DELIVERY', 'STOCK', 'PURCHASE_DISCIPLINE', 'CREDITORS', 'TASK_DESK', 'APPROVALS', 'SHIFT', 'CASH', 'FINANCIAL_CONTROL', 'REPORTS', 'BI_DESK', 'SYNC_DESK', 'HELP_DESK', 'SETTINGS'];

const menuPermissionMap: Array<{ menuKey: string; pageId: PosPageId; permissions: string[] }> = [
  { menuKey: 'dashboard', pageId: 'DASHBOARD', permissions: ['dashboard.view'] },
  { menuKey: 'ownerDesk', pageId: 'OWNER_DESK', permissions: ['ownerDesk.view'] },
  { menuKey: 'salesTerminal', pageId: 'SALES', permissions: ['sales.open'] },
  { menuKey: 'salesHistory', pageId: 'SALES_HISTORY', permissions: ['sales.viewHistory'] },
  { menuKey: 'customerCentre', pageId: 'CUSTOMER_CENTRE', permissions: ['customers.view', 'customers.createRequest'] },
  { menuKey: 'deliveryDesk', pageId: 'DELIVERY', permissions: ['delivery.view'] },
  { menuKey: 'inventory', pageId: 'STOCK', permissions: ['inventory.view'] },
  { menuKey: 'productMaster', pageId: 'STOCK', permissions: ['productMaster.view'] },
  { menuKey: 'productImportDesk', pageId: 'STOCK', permissions: ['productImport.view'] },
  { menuKey: 'stocktakeDesk', pageId: 'STOCK', permissions: ['stocktake.view'] },
  { menuKey: 'stockAdjustments', pageId: 'STOCK', permissions: ['stockAdjustment.view'] },
  { menuKey: 'purchaseOrders', pageId: 'STOCK', permissions: ['purchaseOrder.view'] },
  { menuKey: 'goodsReceiving', pageId: 'STOCK', permissions: ['goodsReceiving.view'] },
  { menuKey: 'supplierReturns', pageId: 'STOCK', permissions: ['supplierReturn.view'] },
  { menuKey: 'stockTransfers', pageId: 'STOCK', permissions: ['stockTransfer.view'] },
  { menuKey: 'purchaseDiscipline', pageId: 'PURCHASE_DISCIPLINE', permissions: ['purchaseDiscipline.view'] },
  { menuKey: 'creditorsManagement', pageId: 'CREDITORS', permissions: ['creditors.view'] },
  { menuKey: 'taskDesk', pageId: 'TASK_DESK', permissions: ['taskDesk.view'] },
  { menuKey: 'approvals', pageId: 'APPROVALS', permissions: ['approvals.view'] },
  { menuKey: 'shiftControl', pageId: 'SHIFT', permissions: ['shift.view', 'sales.endOfDay.run'] },
  { menuKey: 'biDesk', pageId: 'BI_DESK', permissions: ['bi.view', 'bi.summary.view'] },
  { menuKey: 'syncDesk', pageId: 'SYNC_DESK', permissions: ['sync.view'] },
  { menuKey: 'helpDesk', pageId: 'HELP_DESK', permissions: ['helpDesk.view'] },
  { menuKey: 'reports', pageId: 'REPORTS', permissions: ['reports.view'] },
  { menuKey: 'accountingFinance', pageId: 'CASH', permissions: ['accounting.view', 'sales.endOfDay.run'] },
  { menuKey: 'financialControl', pageId: 'FINANCIAL_CONTROL', permissions: ['financialControl.view'] },
  { menuKey: 'settings', pageId: 'SETTINGS', permissions: ['settings.view'] }
];

export function getEffectiveMenuKeysForRole(roleKey: string): string[] {
  const permissions = new Set(getEffectivePermissionsForRole(roleKey));
  return menuPermissionMap.filter((menu) => menu.permissions.some((permission) => isPermissionKey(permission) && permissions.has(permission))).map((menu) => menu.menuKey);
}

export function getEffectiveMenuKeysForSession(session?: PermissionSessionLike | null): string[] {
  if (isOwnerBypassSession(session)) return menuPermissionMap.map((menu) => menu.menuKey);
  const permissions = new Set(getEffectivePermissionsForSession(session));
  return menuPermissionMap
    .filter((menu) => menu.permissions.some((permission) => isPermissionKey(permission) && permissions.has(permission)))
    .map((menu) => menu.menuKey);
}

export function getEffectivePageIdsForRole(roleKey: string): PosPageId[] {
  const normalized = normalizeRoleKey(roleKey);
  if (normalized === 'Owner' || normalized === 'SysAdmin') return allPosPageIds;
  const menuKeys = new Set(getEffectiveMenuKeysForRole(roleKey));
  return Array.from(new Set(menuPermissionMap.filter((menu) => menuKeys.has(menu.menuKey)).map((menu) => menu.pageId)));
}

export function getEffectivePageIdsForSession(session?: PermissionSessionLike | null): PosPageId[] {
  if (isOwnerBypassSession(session)) return allPosPageIds;
  const menuKeys = new Set(getEffectiveMenuKeysForSession(session));
  return Array.from(new Set(menuPermissionMap.filter((menu) => menuKeys.has(menu.menuKey)).map((menu) => menu.pageId)));
}

export function canCurrentSessionOpenMenu(menuKey: string): boolean {
  return getEffectiveMenuKeysForSession(getCurrentTenantSession()).includes(menuKey);
}

export function canCurrentSessionPerformAction(permissionKey: string): boolean {
  return sessionHasEffectivePermission(getCurrentTenantSession(), permissionKey);
}
