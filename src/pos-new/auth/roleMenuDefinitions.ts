import type { PosPageId } from '../types';
import type { RoleMenuDefinition, RoleMenuKey, StaffGateRole, StaffMenuAccessRecord } from './staffPinTypes';
import { getEffectivePermissionsForRole, normalizeSecurityRole } from './permissionMatrixService';

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
  { menuKey: 'taskDesk', menuLabel: 'Task Desk', group: 'Control', pageId: 'TASK_DESK' },
  { menuKey: 'approvals', menuLabel: 'Approvals', group: 'Control', pageId: 'APPROVALS' },
  { menuKey: 'biDesk', menuLabel: 'BI Desk', group: 'Control', pageId: 'BI_DESK' },
  { menuKey: 'syncDesk', menuLabel: 'Sync Desk', group: 'Control', pageId: 'SYNC_DESK' },
  { menuKey: 'reports', menuLabel: 'Reports', group: 'Control', pageId: 'BI_DESK' },
  { menuKey: 'accountingFinance', menuLabel: 'Accounting Finance', group: 'Control', pageId: 'CASH' },
  { menuKey: 'settings', menuLabel: 'Settings', group: 'Control', pageId: 'SETTINGS' }
];

const allMenuKeys = roleMenuDefinitions.map((menu) => menu.menuKey);

const roleMenuAccess: Record<string, RoleMenuKey[]> = {
  Owner: allMenuKeys,
  SysAdmin: allMenuKeys,
  VendorOwner: allMenuKeys,
  VendorAdmin: ['dashboard', 'salesTerminal', 'salesHistory', 'customerCentre', 'deliveryDesk', 'inventory', 'productMaster', 'productImportDesk', 'stocktakeDesk', 'taskDesk', 'approvals', 'biDesk', 'syncDesk', 'reports', 'accountingFinance', 'settings'],
  Manager: ['dashboard', 'salesTerminal', 'salesHistory', 'customerCentre', 'deliveryDesk', 'inventory', 'productMaster', 'productImportDesk', 'stocktakeDesk', 'taskDesk', 'approvals', 'biDesk', 'syncDesk', 'reports', 'accountingFinance', 'settings'],
  Supervisor: ['dashboard', 'salesTerminal', 'salesHistory', 'customerCentre', 'deliveryDesk', 'inventory', 'stocktakeDesk', 'taskDesk', 'approvals', 'reports'],
  Cashier: ['dashboard', 'salesTerminal', 'salesHistory', 'customerCentre', 'syncDesk'],
  StockController: ['dashboard', 'inventory', 'productMaster', 'productImportDesk', 'stocktakeDesk', 'stockAdjustments', 'purchaseOrders', 'goodsReceiving', 'supplierReturns', 'stockTransfers', 'syncDesk', 'reports'],
  'Stock Controller': ['dashboard', 'inventory', 'productMaster', 'productImportDesk', 'stocktakeDesk', 'stockAdjustments', 'purchaseOrders', 'goodsReceiving', 'supplierReturns', 'stockTransfers', 'syncDesk', 'reports'],
  DeliveryStaff: ['dashboard', 'deliveryDesk', 'syncDesk'],
  'Delivery Staff': ['dashboard', 'deliveryDesk', 'syncDesk'],
  Accountant: ['dashboard', 'salesHistory', 'reports', 'accountingFinance', 'approvals', 'syncDesk'],
  Viewer: ['dashboard', 'reports']
};

export function getRoleMenuKeys(role: StaffGateRole): RoleMenuKey[] {
  const effective = new Set(getEffectivePermissionsForRole(normalizeSecurityRole(String(role))));
  const catalogMenus = roleMenuAccess[role] || roleMenuAccess.Viewer;
  const matrixMenus = roleMenuDefinitions
    .filter((menu) => {
      if (menu.menuKey === 'dashboard') return effective.has('dashboard.view');
      if (menu.menuKey === 'salesTerminal') return effective.has('sales.open');
      if (menu.menuKey === 'salesHistory') return effective.has('sales.viewHistory');
      if (menu.menuKey === 'customerCentre') return effective.has('customers.view');
      if (menu.menuKey === 'deliveryDesk') return effective.has('delivery.view');
      if (menu.menuKey === 'inventory' || menu.menuKey === 'productMaster') return effective.has('inventory.view') || effective.has('productMaster.view');
      if (menu.menuKey === 'productImportDesk') return effective.has('productImport.view');
      if (menu.menuKey === 'stocktakeDesk') return effective.has('stocktake.view');
      if (menu.menuKey === 'stockAdjustments') return effective.has('stockAdjustment.view');
      if (menu.menuKey === 'purchaseOrders') return effective.has('purchaseOrder.view');
      if (menu.menuKey === 'goodsReceiving') return effective.has('goodsReceiving.view');
      if (menu.menuKey === 'supplierReturns') return effective.has('supplierReturn.view');
      if (menu.menuKey === 'stockTransfers') return effective.has('stockTransfer.view');
      if (menu.menuKey === 'approvals') return effective.has('approvals.view');
      if (menu.menuKey === 'syncDesk') return effective.has('sync.view');
      if (menu.menuKey === 'reports') return effective.has('reports.view');
      if (menu.menuKey === 'accountingFinance') return effective.has('accounting.view');
      if (menu.menuKey === 'settings') return effective.has('settings.view');
      if (menu.menuKey === 'biDesk') return effective.has('bi.view');
      if (menu.menuKey === 'ownerDesk') return effective.has('ownerDesk.view');
      return catalogMenus.includes(menu.menuKey);
    })
    .map((menu) => menu.menuKey);
  return Array.from(new Set([...catalogMenus, ...matrixMenus]));
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
