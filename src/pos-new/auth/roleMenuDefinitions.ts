import type { PosPageId } from '../types';
import type { RoleMenuDefinition, RoleMenuKey, StaffGateRole, StaffMenuAccessRecord } from './staffPinTypes';
import { getEffectiveMenuKeysForRole } from './effectivePermissionService';

export const roleMenuDefinitions: RoleMenuDefinition[] = [
  { menuKey: 'dashboard', menuLabel: 'Dashboard', group: 'Main', pageId: 'DASHBOARD' },
  { menuKey: 'ownerDesk', menuLabel: 'Owner Desk', group: 'Main', pageId: 'OWNER_DESK' },
  { menuKey: 'salesTerminal', menuLabel: 'Sales Terminal', group: 'Main', pageId: 'SALES' },
  { menuKey: 'salesHistory', menuLabel: 'Sales History', group: 'Main', pageId: 'SALES_HISTORY' },
  { menuKey: 'customerCentre', menuLabel: 'Customer Centre', group: 'Main', pageId: 'CUSTOMER_CENTRE' },
  { menuKey: 'deliveryDesk', menuLabel: 'Delivery Desk', group: 'Main', pageId: 'DELIVERY' },
  { menuKey: 'inventory', menuLabel: 'Inventory', group: 'Inventory', pageId: 'STOCK' },
  { menuKey: 'productMaster', menuLabel: 'Product Master', group: 'Inventory', pageId: 'STOCK' },
  { menuKey: 'productImportDesk', menuLabel: 'Product Import Desk', group: 'Inventory', pageId: 'STOCK' },
  { menuKey: 'stocktakeDesk', menuLabel: 'Stocktake Desk', group: 'Inventory', pageId: 'STOCK' },
  { menuKey: 'stockAdjustments', menuLabel: 'Stock Adjustments', group: 'Inventory', pageId: 'STOCK' },
  { menuKey: 'purchaseOrders', menuLabel: 'Purchase Orders', group: 'Inventory', pageId: 'STOCK' },
  { menuKey: 'goodsReceiving', menuLabel: 'Goods Receiving', group: 'Inventory', pageId: 'STOCK' },
  { menuKey: 'supplierReturns', menuLabel: 'Supplier Returns', group: 'Inventory', pageId: 'STOCK' },
  { menuKey: 'stockTransfers', menuLabel: 'Stock Transfers', group: 'Inventory', pageId: 'STOCK' },
  { menuKey: 'purchaseDiscipline', menuLabel: 'Purchasing Discipline', group: 'Inventory', pageId: 'PURCHASE_DISCIPLINE' },
  { menuKey: 'creditorsManagement', menuLabel: 'Creditors Management', group: 'Control', pageId: 'CREDITORS' },
  { menuKey: 'taskDesk', menuLabel: 'Task Desk', group: 'Control', pageId: 'TASK_DESK' },
  { menuKey: 'approvals', menuLabel: 'Approvals', group: 'Control', pageId: 'APPROVALS' },
  { menuKey: 'biDesk', menuLabel: 'BI Desk', group: 'Control', pageId: 'BI_DESK' },
  { menuKey: 'syncDesk', menuLabel: 'Sync Desk', group: 'Control', pageId: 'SYNC_DESK' },
  { menuKey: 'helpDesk', menuLabel: 'Help Desk', group: 'Control', pageId: 'HELP_DESK' },
  { menuKey: 'reports', menuLabel: 'Reports', group: 'Control', pageId: 'REPORTS' },
  { menuKey: 'accountingFinance', menuLabel: 'Accounting Finance', group: 'Control', pageId: 'CASH' },
  { menuKey: 'financialControl', menuLabel: 'Financial Control', group: 'Control', pageId: 'FINANCIAL_CONTROL' },
  { menuKey: 'settings', menuLabel: 'Settings', group: 'Control', pageId: 'SETTINGS' }
];

export function getRoleMenuKeys(role: StaffGateRole): RoleMenuKey[] {
  const known = new Set(roleMenuDefinitions.map((menu) => menu.menuKey));
  return getEffectiveMenuKeysForRole(String(role)).filter((menuKey): menuKey is RoleMenuKey => known.has(menuKey as RoleMenuKey));
}

export function getRoleMenuAccessRecords(role: StaffGateRole): StaffMenuAccessRecord[] {
  const allowed = new Set(getRoleMenuKeys(role));
  return roleMenuDefinitions.map((menu) => ({
    menuKey: menu.menuKey,
    menuLabel: menu.menuLabel,
    group: menu.group,
    pageId: menu.pageId,
    access: allowed.has(menu.menuKey) ? 'Allowed' : 'Restricted',
    notes: allowed.has(menu.menuKey) ? 'Visible for selected role.' : 'Restricted in production preview.'
  }));
}

export function getAllowedPosPageIdsForRoleMenu(role: StaffGateRole): PosPageId[] {
  return Array.from(new Set(roleMenuDefinitions.filter((menu) => getRoleMenuKeys(role).includes(menu.menuKey) && menu.pageId).map((menu) => menu.pageId as PosPageId)));
}

export function getRoleMenuDefinition(menuKey: RoleMenuKey): RoleMenuDefinition | undefined {
  return roleMenuDefinitions.find((menu) => menu.menuKey === menuKey);
}
