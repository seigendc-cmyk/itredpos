import type { Role } from '../types';
import { getAllowedMenusForRole, getPermissionsForRole, type PermissionKey } from '../utils/posPermissions';
import type { TenantUserRole } from './authTypes';
import { getEffectivePermissionsForRole, normalizeSecurityRole } from './permissionMatrixService';

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
  if (role === 'VendorOwner') return getPermissionsForRole('Owner');
  return getEffectivePermissionsForRole(normalizeSecurityRole(role)) as PermissionKey[];
}

export function getTenantPermissionMappingRows() {
  return (Object.keys(roleMap) as TenantUserRole[]).map((tenantRole) => {
    const posRole = mapTenantRoleToPosRole(tenantRole);
    return {
      tenantRole,
      posRole,
      permissionCount: getTenantPermissionsForRole(tenantRole).length,
      menuCount: getAllowedMenusForRole(posRole).length
    };
  });
}
