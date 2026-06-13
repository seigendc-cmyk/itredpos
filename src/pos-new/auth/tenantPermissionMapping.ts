import type { Role } from '../types';
import { type PermissionKey } from '../utils/posPermissions';
import type { TenantUserRole } from './authTypes';
import { getEffectiveMenuKeysForRole, getEffectivePermissionsForRole, normalizeRoleKey } from './effectivePermissionService';

const roleMap: Record<TenantUserRole, Role> = {
  VendorOwner: 'Owner',
  VendorAdmin: 'Manager',
  Manager: 'Manager',
  Supervisor: 'Supervisor',
  Cashier: 'Cashier',
  StockController: 'Stock Controller',
  DeliveryStaff: 'Delivery Staff',
  Accountant: 'Manager',
  Viewer: 'Cashier'
};

export function mapTenantRoleToPosRole(role: TenantUserRole): Role {
  return roleMap[role] || 'Cashier';
}

export function getTenantPermissionsForRole(role: TenantUserRole): PermissionKey[] {
  return getEffectivePermissionsForRole(normalizeRoleKey(role)) as PermissionKey[];
}

export function getTenantPermissionMappingRows() {
  return (Object.keys(roleMap) as TenantUserRole[]).map((tenantRole) => {
    const posRole = mapTenantRoleToPosRole(tenantRole);
    return {
      tenantRole,
      posRole,
      permissionCount: getTenantPermissionsForRole(tenantRole).length,
      menuCount: getEffectiveMenuKeysForRole(tenantRole).length
    };
  });
}
