import type { Role } from '../types';
import { getAllowedMenusForRole, getPermissionsForRole, type PermissionKey } from '../utils/posPermissions';
import type { TenantUserRole } from './authTypes';

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
  if (role === 'VendorAdmin') return getPermissionsForRole('Manager');
  if (role === 'Viewer') return ['sales.viewHistory', 'sync.view'];
  return getPermissionsForRole(mapTenantRoleToPosRole(role));
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
