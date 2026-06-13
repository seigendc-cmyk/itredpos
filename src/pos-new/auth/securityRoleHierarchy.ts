import type { SecurityRoleDefinition, SecurityRoleHierarchyRule, SecurityRoleKey } from './permissionMatrixTypes';
import { securityRightsCatalog } from './securityRightsCatalog';

export const securityRoleDefinitions: SecurityRoleDefinition[] = [
  { roleKey: 'Owner', roleLabel: 'Owner', hierarchyLevel: 1, description: 'Full vendor owner access during build-development.', inheritsFrom: ['SysAdmin', 'Manager', 'Supervisor', 'Accountant', 'StockController', 'Cashier', 'DeliveryStaff', 'Viewer'], systemRole: true, canBeEdited: false, defaultDashboard: 'Owner Desk', notes: 'Locked full access while build-development Owner bypass is active.' },
  { roleKey: 'SysAdmin', roleLabel: 'SysAdmin', hierarchyLevel: 2, description: 'Vendor system setup role without internal console access.', inheritsFrom: ['Manager', 'Supervisor', 'Accountant', 'StockController', 'Cashier', 'DeliveryStaff', 'Viewer'], systemRole: true, canBeEdited: true, defaultDashboard: 'Settings' },
  { roleKey: 'Manager', roleLabel: 'Manager', hierarchyLevel: 3, description: 'Operational manager with sales, oversight, selected inventory, delivery, reporting, approval, and EOD rights.', inheritsFrom: ['Supervisor', 'Cashier', 'Viewer'], systemRole: true, canBeEdited: true, defaultDashboard: 'Dashboard' },
  { roleKey: 'Supervisor', roleLabel: 'Supervisor', hierarchyLevel: 4, description: 'Floor supervisor with cashier rights and limited oversight.', inheritsFrom: ['Cashier', 'Viewer'], systemRole: true, canBeEdited: true, defaultDashboard: 'Sales Terminal' },
  { roleKey: 'Accountant', roleLabel: 'Accountant', hierarchyLevel: 5, description: 'Finance and reporting role with accounting review and export rights.', inheritsFrom: ['Viewer'], systemRole: true, canBeEdited: true, defaultDashboard: 'Reports' },
  { roleKey: 'StockController', roleLabel: 'Stock Controller', hierarchyLevel: 6, description: 'Inventory specialist with stock, procurement, GRN, adjustment, stocktake, and transfer rights.', inheritsFrom: ['Viewer'], systemRole: true, canBeEdited: true, defaultDashboard: 'Inventory' },
  { roleKey: 'Cashier', roleLabel: 'Cashier', hierarchyLevel: 7, description: 'Sales terminal role with customer lookup and basic transaction rights.', inheritsFrom: ['Viewer'], systemRole: true, canBeEdited: true, defaultDashboard: 'Sales Terminal' },
  { roleKey: 'DeliveryStaff', roleLabel: 'Delivery Staff', hierarchyLevel: 8, description: 'Assigned delivery tracking and code confirmation rights only.', inheritsFrom: ['Viewer'], systemRole: true, canBeEdited: true, defaultDashboard: 'Delivery Desk' },
  { roleKey: 'Viewer', roleLabel: 'Viewer', hierarchyLevel: 9, description: 'Read-only dashboard and report visibility.', inheritsFrom: [], systemRole: true, canBeEdited: true, defaultDashboard: 'Dashboard' }
];

export const securityRoleHierarchyRules: SecurityRoleHierarchyRule[] = securityRoleDefinitions.flatMap((role) =>
  role.inheritsFrom.map((inheritedRole) => ({
    roleKey: role.roleKey,
    inheritsFrom: inheritedRole,
    inheritanceType: role.roleKey === 'StockController' || role.roleKey === 'DeliveryStaff' || role.roleKey === 'Accountant' ? 'Area Specific' : 'Full',
    notes: `${role.roleLabel} inherits appropriate ${inheritedRole} rights in the preview matrix.`
  }))
);

export function getRoleHierarchyLevel(roleKey: SecurityRoleKey): number {
  return securityRoleDefinitions.find((role) => role.roleKey === roleKey)?.hierarchyLevel || 99;
}

export function getInheritedRoles(roleKey: SecurityRoleKey): SecurityRoleKey[] {
  const role = securityRoleDefinitions.find((item) => item.roleKey === roleKey);
  if (!role) return [];
  return Array.from(new Set(role.inheritsFrom.flatMap((inheritedRole) => [inheritedRole, ...getInheritedRoles(inheritedRole)])));
}

export function roleInheritsFrom(roleKey: SecurityRoleKey, inheritedRoleKey: SecurityRoleKey): boolean {
  return getInheritedRoles(roleKey).includes(inheritedRoleKey);
}

export function getDefaultRolePermissions(roleKey: SecurityRoleKey): string[] {
  if (roleKey === 'Owner') return securityRightsCatalog.map((right) => right.permissionKey);
  const inheritedRoles = getInheritedRoles(roleKey);
  return securityRightsCatalog
    .filter((right) => right.defaultRoles.includes(roleKey) || right.defaultRoles.some((defaultRole) => inheritedRoles.includes(defaultRole)))
    .map((right) => right.permissionKey);
}
