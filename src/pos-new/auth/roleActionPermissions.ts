import type { StaffGateRole, RoleActionPermission } from './staffPinTypes';
import { getEffectivePermissionsForRole } from './effectivePermissionService';

export const roleActionPermissions: RoleActionPermission[] = [
  { permissionKey: 'sales.open', area: 'Sales', label: 'Open Sales Terminal' },
  { permissionKey: 'sales.complete', area: 'Sales', label: 'Complete Sale' },
  { permissionKey: 'sales.discount', area: 'Sales', label: 'Apply Discount' },
  { permissionKey: 'sales.void', area: 'Sales', label: 'Void Sale' },
  { permissionKey: 'sales.return', area: 'Sales', label: 'Process Return' },
  { permissionKey: 'sales.hold', area: 'Sales', label: 'Hold Sale' },
  { permissionKey: 'sales.cashDrawer.open', area: 'Sales', label: 'Cash Drawer' },
  { permissionKey: 'inventory.view', area: 'Inventory', label: 'View Inventory' },
  { permissionKey: 'productMaster.create', area: 'Inventory', label: 'Create Product' },
  { permissionKey: 'productMaster.edit', area: 'Inventory', label: 'Edit Product' },
  { permissionKey: 'productImport.create', area: 'Inventory', label: 'Create Product Import' },
  { permissionKey: 'productImport.approve', area: 'Inventory', label: 'Approve Product Import' },
  { permissionKey: 'stockAdjustment.create', area: 'Inventory', label: 'Create Stock Adjustment' },
  { permissionKey: 'stockAdjustment.approve', area: 'Inventory', label: 'Approve Stock Adjustment' },
  { permissionKey: 'stocktake.create', area: 'Inventory', label: 'Create Stocktake' },
  { permissionKey: 'stocktake.post', area: 'Inventory', label: 'Post Stocktake' },
  { permissionKey: 'grn.post', area: 'Inventory', label: 'Post GRN' },
  { permissionKey: 'supplierReturn.post', area: 'Inventory', label: 'Post Supplier Return' },
  { permissionKey: 'transfer.dispatch', area: 'Inventory', label: 'Dispatch Transfer' },
  { permissionKey: 'transfer.receive', area: 'Inventory', label: 'Receive Transfer' },
  { permissionKey: 'delivery.view', area: 'Delivery', label: 'View Delivery' },
  { permissionKey: 'delivery.assign', area: 'Delivery', label: 'Assign Delivery' },
  { permissionKey: 'delivery.track', area: 'Delivery', label: 'Track Delivery' },
  { permissionKey: 'delivery.verifyCode', area: 'Delivery', label: 'Verify Delivery Code' },
  { permissionKey: 'delivery.cashReview', area: 'Delivery', label: 'Delivery Cash Review' },
  { permissionKey: 'delivery.cancel', area: 'Delivery', label: 'Cancel Delivery' },
  { permissionKey: 'approvals.view', area: 'Control', label: 'View Approvals' },
  { permissionKey: 'approvals.approveLowRisk', area: 'Control', label: 'Approve Request' },
  { permissionKey: 'sync.view', area: 'Control', label: 'View Sync Desk' },
  { permissionKey: 'sync.conflict.resolve', area: 'Control', label: 'Resolve Sync Conflict' },
  { permissionKey: 'reports.view', area: 'Control', label: 'View Reports' },
  { permissionKey: 'accounting.view', area: 'Control', label: 'View Accounting' },
  { permissionKey: 'settings.permissions.edit', area: 'Control', label: 'Manage Security Rights' }
];

export function getRoleActionKeys(role: StaffGateRole): string[] {
  const previewKeys = new Set(roleActionPermissions.map((item) => item.permissionKey));
  return getEffectivePermissionsForRole(String(role)).filter((permissionKey) => previewKeys.has(permissionKey));
}

export function getRoleActionAccessRecords(role: StaffGateRole) {
  const allowed = new Set(getRoleActionKeys(role));
  return roleActionPermissions.map((permission) => ({
    ...permission,
    access: allowed.has(permission.permissionKey) ? 'Allowed' : 'Restricted'
  }));
}
