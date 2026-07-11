import type { Role } from '../types';
import type { SecurityRoleKey } from './permissionMatrixTypes';
import type { TenantUserRole } from './authTypes';

const tenantRoles: readonly TenantUserRole[] = [
  'VendorOwner', 'VendorAdmin', 'Manager', 'Supervisor', 'Cashier',
  'StockController', 'DeliveryStaff', 'Accountant', 'Viewer'
];

export function isTenantRole(value: unknown): value is TenantUserRole {
  return typeof value === 'string' && tenantRoles.some((role) => role === value);
}

export function normalizeTenantRole(value: unknown): TenantUserRole {
  return isTenantRole(value) ? value : 'Viewer';
}

export function normalizePermissionRole(value: unknown): SecurityRoleKey {
  switch (value) {
    case 'Owner':
    case 'VendorOwner': return 'Owner';
    case 'SysAdmin': return 'SysAdmin';
    case 'VendorAdmin': return 'Manager';
    case 'Manager': return 'Manager';
    case 'Supervisor': return 'Supervisor';
    case 'Cashier': return 'Cashier';
    case 'Accountant': return 'Accountant';
    case 'StockController':
    case 'Stock Controller': return 'StockController';
    case 'DeliveryStaff':
    case 'Delivery Staff': return 'DeliveryStaff';
    default: return 'Viewer';
  }
}

export function normalizeOperationalRole(value: unknown): Role {
  const role = normalizePermissionRole(value);
  if (role === 'StockController') return 'Stock Controller';
  if (role === 'DeliveryStaff') return 'Delivery Staff';
  return role;
}
