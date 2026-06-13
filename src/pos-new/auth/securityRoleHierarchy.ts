import type { SecurityRoleDefinition, SecurityRoleHierarchyRule, SecurityRoleKey } from './permissionMatrixTypes';
import { securityRightsCatalog } from './securityRightsCatalog';

export const securityRoleDefinitions: SecurityRoleDefinition[] = [
  { roleKey: 'Owner', roleLabel: 'Owner', hierarchyLevel: 1, description: 'Full vendor owner access during build-development.', inheritsFrom: ['SysAdmin', 'Manager', 'Supervisor', 'Accountant', 'StockController', 'Cashier', 'DeliveryStaff', 'Viewer'], systemRole: true, canBeEdited: false, defaultDashboard: 'Owner Desk', notes: 'Locked full access while build-development Owner bypass is active.' },
  { roleKey: 'SysAdmin', roleLabel: 'SysAdmin', hierarchyLevel: 2, description: 'Vendor system setup role without internal console access.', inheritsFrom: ['Manager', 'Supervisor', 'Accountant', 'StockController', 'Cashier', 'DeliveryStaff', 'Viewer'], systemRole: true, canBeEdited: true, defaultDashboard: 'Settings' },
  { roleKey: 'Manager', roleLabel: 'Manager', hierarchyLevel: 3, description: 'Operational manager with sales, oversight, selected inventory, delivery, reporting, approval, and EOD rights.', inheritsFrom: ['Supervisor', 'Cashier', 'Viewer'], systemRole: true, canBeEdited: true, defaultDashboard: 'Dashboard' },
  { roleKey: 'Supervisor', roleLabel: 'Supervisor', hierarchyLevel: 4, description: 'Floor supervisor with cashier rights and limited oversight.', inheritsFrom: ['Cashier', 'Viewer'], systemRole: true, canBeEdited: true, defaultDashboard: 'Sales Terminal' },
  { roleKey: 'Accountant', roleLabel: 'Accountant', hierarchyLevel: 5, description: 'Finance and reporting role with accounting review and export rights.', inheritsFrom: [], systemRole: true, canBeEdited: true, defaultDashboard: 'Reports' },
  { roleKey: 'StockController', roleLabel: 'Stock Controller', hierarchyLevel: 6, description: 'Inventory specialist with stock, procurement, GRN, adjustment, stocktake, and transfer rights.', inheritsFrom: [], systemRole: true, canBeEdited: true, defaultDashboard: 'Inventory' },
  { roleKey: 'Cashier', roleLabel: 'Cashier', hierarchyLevel: 7, description: 'Sales terminal role with customer lookup and basic transaction rights.', inheritsFrom: [], systemRole: true, canBeEdited: true, defaultDashboard: 'Sales Terminal' },
  { roleKey: 'DeliveryStaff', roleLabel: 'Delivery Staff', hierarchyLevel: 8, description: 'Assigned delivery tracking and code confirmation rights only.', inheritsFrom: [], systemRole: true, canBeEdited: true, defaultDashboard: 'Delivery Desk' },
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

const managerDirectPermissions = [
  'ownerDesk.view',
  'bi.summary.view',
  'sales.discount',
  'sales.priceChange',
  'sales.void',
  'sales.return',
  'sales.creditRedeem',
  'sales.loyalty',
  'sales.accountSale',
  'payment.capture',
  'sales.profitSnapshot.view',
  'sales.profitSnapshot.generate',
  'sales.profitSnapshot.export',
  'sales.profitSnapshot.print',
  'sales.miscellaneous.create',
  'sales.miscellaneous.review',
  'sales.miscellaneous.approve',
  'sales.endOfDay.run',
  'shift.view',
  'shift.open',
  'shift.close',
  'shift.eodReport.view',
  'shift.eodReport.print',
  'shift.recovery.restore',
  'shift.override',
  'cashDrawer.assign',
  'cashDrawer.release',
  'terminal.activate',
  'terminal.deactivate',
  'terminal.readinessCheck',
  'terminal.history.view',
  'customers.createDirect',
  'customers.edit',
  'inventory.view',
  'productMaster.view',
  'productMaster.create',
  'productMaster.edit',
  'productMaster.activate',
  'productImport.view',
  'productImport.create',
  'productImport.map',
  'productImport.validate',
  'productImport.approve',
  'productImport.import',
  'purchaseOrder.view',
  'purchaseOrder.create',
  'purchaseOrder.approve',
  'goodsReceiving.view',
  'goodsReceiving.create',
  'goodsReceiving.post',
  'stockAdjustment.view',
  'stockAdjustment.create',
  'stockAdjustment.approve',
  'stocktake.view',
  'stocktake.create',
  'stocktake.approve',
  'delivery.assign',
  'delivery.cashReview',
  'approvals.approveHighRisk',
  'reports.sales',
  'reports.inventory',
  'settings.view',
  'businessProfile.edit',
  'businessRegistration.view',
  'businessRegistration.dashboardView',
  'businessTax.view',
  'businessAdministrator.view',
  'hardware.view',
  'bi.view',
  'bi.management.view',
  'bi.management.generate',
  'bi.riskReview',
  'bi.advice.view',
  'bi.advice.generate',
  'bi.advice.assign',
  'bi.advice.resolve',
  'bi.advice.dismiss',
  'bi.advice.escalate',
  'bi.advice.createTask',
  'bi.actionPoints.view',
  'bi.actionPoints.manage',
  'bi.reorderProtection.view',
  'bi.reorderProtection.override',
  'bi.shelfStocktake.assign',
  'bi.cashRisk.view',
  'bi.staffRisk.view',
  'bi.taxReadiness.view',
  'bi.profitSnapshot.view',
  'bi.reorderBlock.review',
  'bi.reorderBlock.override'
];

const directRolePermissions: Record<SecurityRoleKey, string[]> = {
  Owner: [],
  SysAdmin: [],
  Manager: managerDirectPermissions,
  Supervisor: [
    'sales.discount',
    'sales.viewHistory',
    'shift.view',
    'shift.open',
    'shift.close',
    'shift.recovery.restore',
    'terminal.readinessCheck',
    'terminal.history.view',
    'cashDrawer.assign',
    'cashDrawer.release',
    'inventory.view',
    'productMaster.view',
    'stocktake.view',
    'delivery.view',
    'delivery.assign',
    'approvals.view',
    'approvals.approveLowRisk',
    'reports.view',
    'sync.view',
    'bi.view',
    'bi.riskReview',
    'bi.advice.view',
    'bi.advice.generate',
    'bi.advice.resolve',
    'bi.advice.createTask'
  ],
  Accountant: [
    'dashboard.view',
    'sales.viewHistory',
    'sales.creditRedeem',
    'sales.accountSale',
    'sales.profitSnapshot.view',
    'sales.profitSnapshot.generate',
    'sales.profitSnapshot.export',
    'sales.profitSnapshot.print',
    'sales.miscellaneous.review',
    'reports.view',
    'reports.sales',
    'reports.accounting',
    'reports.export',
    'shift.eodReport.view',
    'shift.eodReport.print',
    'terminal.history.view',
    'accounting.view',
    'accounting.readinessReview',
    'accounting.export',
    'chartOfAccounts.view',
    'delivery.cashReview',
    'approvals.view',
    'sync.view',
    'customers.creditView',
    'businessRegistration.view',
    'businessRegistration.dashboardView',
    'businessTax.view',
    'businessAdministrator.view',
    'bi.advice.view'
  ],
  StockController: [
    'dashboard.view',
    'inventory.view',
    'productMaster.view',
    'productMaster.create',
    'productMaster.edit',
    'productImport.view',
    'productImport.create',
    'productImport.map',
    'productImport.validate',
    'purchaseOrder.view',
    'purchaseOrder.create',
    'goodsReceiving.view',
    'goodsReceiving.create',
    'supplierReturn.view',
    'supplierReturn.create',
    'stockAdjustment.view',
    'stockAdjustment.create',
    'stocktake.view',
    'stocktake.create',
    'stockTransfer.view',
    'stockTransfer.create',
    'stockTransfer.dispatch',
    'stockTransfer.receive',
    'openingBalance.view',
    'openingBalance.create',
    'reports.inventory',
    'bi.view',
    'bi.advice.view',
    'bi.advice.generate',
    'bi.shelfStocktake.assign',
    'bi.reorderBlock.review',
    'sync.view',
    'sync.retry',
    'sync.batch.create'
  ],
  Cashier: [
    'dashboard.view',
    'sales.open',
    'sales.complete',
    'sales.hold',
    'sales.reprintReceipt',
    'shift.view',
    'shift.open',
    'shift.close',
    'shift.recovery.restore',
    'terminal.history.view',
    'customers.view',
    'customers.createRequest',
    'delivery.create',
    'sync.view'
  ],
  DeliveryStaff: [
    'dashboard.view',
    'delivery.view',
    'delivery.track',
    'delivery.verifyCode',
    'delivery.complete',
    'bi.advice.view',
    'sync.view'
  ],
  Viewer: [
    'dashboard.view',
    'reports.view',
    'audit.view',
    'businessProfile.view'
  ]
};

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
  if (roleKey === 'Owner' || roleKey === 'SysAdmin') return securityRightsCatalog.map((right) => right.permissionKey);
  return Array.from(new Set([...getDirectRolePermissions(roleKey), ...getInheritedRoles(roleKey).flatMap((role) => getDirectRolePermissions(role))]));
}

export function getDirectRolePermissions(roleKey: SecurityRoleKey): string[] {
  if (roleKey === 'Owner' || roleKey === 'SysAdmin') return securityRightsCatalog.map((right) => right.permissionKey);
  return directRolePermissions[roleKey] || directRolePermissions.Viewer;
}

export function getPermissionInheritanceSource(roleKey: SecurityRoleKey, permissionKey: string): SecurityRoleKey | undefined {
  return getInheritedRoles(roleKey).find((inheritedRole) => getDirectRolePermissions(inheritedRole).includes(permissionKey));
}
