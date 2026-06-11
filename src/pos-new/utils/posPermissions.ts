import { PosPageId, Role } from '../types';

/**
 * During build-development, Owner has full access. Plan-based feature enforcement
 * will be implemented later from the internal iTredVD Console backend.
 */
export const OWNER_BUILD_DEVELOPMENT_FULL_ACCESS = true;

export type PermissionKey =
  | 'sales.create'
  | 'sales.complete'
  | 'sales.viewHistory'
  | 'sales.discount'
  | 'sales.priceOverride'
  | 'sales.void'
  | 'sales.reprintReceipt'
  | 'returns.request'
  | 'returns.approve'
  | 'creditNotes.request'
  | 'creditNotes.approve'
  | 'terminal.activate'
  | 'terminal.deactivate'
  | 'shift.open'
  | 'shift.close'
  | 'shift.forceClose'
  | 'customers.createRequest'
  | 'customers.approve'
  | 'inventory.view'
  | 'inventory.import'
  | 'inventory.approveImport'
  | 'inventory.adjust'
  | 'inventory.approveAdjustment'
  | 'stocktake.create'
  | 'stocktake.count'
  | 'stocktake.approveAdjustment'
  | 'ideliver.createProvider'
  | 'delivery.broadcast'
  | 'delivery.review'
  | 'tasks.view'
  | 'tasks.assign'
  | 'tasks.close'
  | 'approvals.view'
  | 'approvals.approve'
  | 'approvals.reject'
  | 'hardware.configure'
  | 'reports.view'
  | 'reports.export'
  | 'accounting.view'
  | 'accounting.post'
  | 'accounting.review'
  | 'settings.view'
  | 'settings.manage'
  | 'bi.view'
  | 'bi.review'
  | 'sync.view'
  | 'sync.run';

export type PosAction =
  | PermissionKey
  | 'COMPLETE_SALE'
  | 'APPLY_DISCOUNT'
  | 'APPROVE_OVERRIDE'
  | 'VIEW_BI'
  | 'OPEN_SETTINGS'
  | 'CLOSE_SHIFT'
  | 'RECORD_CASH_MOVEMENT'
  | 'STOCK_ADJUSTMENT'
  | 'STOCKTAKE'
  | 'OWNER_FINANCIAL_EXPORT';

const ALL_PERMISSIONS: PermissionKey[] = [
  'sales.create',
  'sales.complete',
  'sales.viewHistory',
  'sales.discount',
  'sales.priceOverride',
  'sales.void',
  'sales.reprintReceipt',
  'returns.request',
  'returns.approve',
  'creditNotes.request',
  'creditNotes.approve',
  'terminal.activate',
  'terminal.deactivate',
  'shift.open',
  'shift.close',
  'shift.forceClose',
  'customers.createRequest',
  'customers.approve',
  'inventory.view',
  'inventory.import',
  'inventory.approveImport',
  'inventory.adjust',
  'inventory.approveAdjustment',
  'stocktake.create',
  'stocktake.count',
  'stocktake.approveAdjustment',
  'ideliver.createProvider',
  'delivery.broadcast',
  'delivery.review',
  'tasks.view',
  'tasks.assign',
  'tasks.close',
  'approvals.view',
  'approvals.approve',
  'approvals.reject',
  'hardware.configure',
  'reports.view',
  'reports.export',
  'accounting.view',
  'accounting.post',
  'accounting.review',
  'settings.view',
  'settings.manage',
  'bi.view',
  'bi.review',
  'sync.view',
  'sync.run'
];

const ROLE_MENUS: Record<Role, PosPageId[]> = {
  Owner: ['DASHBOARD', 'OWNER_DESK', 'SALES', 'SALES_HISTORY', 'DELIVERY', 'STOCK', 'TASK_DESK', 'APPROVALS', 'SHIFT', 'CASH', 'BI_DESK', 'SYNC_DESK', 'SETTINGS'],
  SysAdmin: ['DASHBOARD', 'OWNER_DESK', 'SALES', 'SALES_HISTORY', 'DELIVERY', 'STOCK', 'TASK_DESK', 'APPROVALS', 'SHIFT', 'CASH', 'BI_DESK', 'SYNC_DESK', 'SETTINGS'],
  Manager: ['DASHBOARD', 'OWNER_DESK', 'SALES', 'SALES_HISTORY', 'DELIVERY', 'STOCK', 'TASK_DESK', 'APPROVALS', 'SHIFT', 'CASH', 'BI_DESK', 'SYNC_DESK', 'SETTINGS'],
  Supervisor: ['DASHBOARD', 'SALES', 'SALES_HISTORY', 'DELIVERY', 'STOCK', 'TASK_DESK', 'APPROVALS', 'SHIFT', 'CASH', 'BI_DESK', 'SYNC_DESK'],
  Cashier: ['DASHBOARD', 'SALES', 'SALES_HISTORY', 'DELIVERY', 'SHIFT', 'TASK_DESK', 'SYNC_DESK'],
  'Stock Controller': ['DASHBOARD', 'STOCK', 'TASK_DESK', 'APPROVALS', 'BI_DESK', 'SYNC_DESK']
};

const ROLE_PERMISSIONS: Record<Role, PermissionKey[]> = {
  Owner: ALL_PERMISSIONS,
  SysAdmin: ALL_PERMISSIONS,
  Manager: [
    'sales.create', 'sales.complete', 'sales.viewHistory', 'sales.discount', 'sales.priceOverride', 'sales.void', 'sales.reprintReceipt',
    'returns.request', 'returns.approve', 'creditNotes.request', 'creditNotes.approve',
    'terminal.activate', 'terminal.deactivate', 'shift.open', 'shift.close', 'shift.forceClose',
    'customers.createRequest', 'customers.approve',
    'inventory.view', 'inventory.import', 'inventory.approveImport', 'inventory.adjust', 'inventory.approveAdjustment',
    'stocktake.create', 'stocktake.count', 'stocktake.approveAdjustment',
    'ideliver.createProvider', 'delivery.broadcast', 'delivery.review',
    'tasks.view', 'tasks.assign', 'tasks.close',
    'approvals.view', 'approvals.approve', 'approvals.reject',
    'reports.view', 'reports.export',
    'accounting.view', 'accounting.review',
    'settings.view',
    'bi.view', 'bi.review',
    'sync.view', 'sync.run'
  ],
  Supervisor: [
    'sales.create', 'sales.complete', 'sales.viewHistory', 'sales.discount', 'sales.priceOverride', 'sales.void', 'sales.reprintReceipt',
    'returns.request', 'returns.approve', 'creditNotes.request',
    'shift.open', 'shift.close',
    'customers.createRequest',
    'inventory.view',
    'stocktake.create', 'stocktake.count',
    'delivery.broadcast', 'delivery.review',
    'tasks.view', 'tasks.assign', 'tasks.close',
    'approvals.view', 'approvals.approve', 'approvals.reject',
    'reports.view',
    'bi.view', 'bi.review',
    'sync.view', 'sync.run'
  ],
  Cashier: [
    'sales.create', 'sales.complete', 'sales.viewHistory', 'sales.reprintReceipt',
    'returns.request', 'creditNotes.request',
    'shift.open', 'shift.close',
    'customers.createRequest',
    'delivery.broadcast',
    'tasks.view',
    'sync.view'
  ],
  'Stock Controller': [
    'sales.viewHistory',
    'inventory.view', 'inventory.import', 'inventory.adjust',
    'stocktake.create', 'stocktake.count',
    'tasks.view',
    'approvals.view',
    'reports.view',
    'bi.view',
    'sync.view', 'sync.run'
  ]
};

const LEGACY_ACTION_PERMISSION: Record<Exclude<PosAction, PermissionKey>, PermissionKey> = {
  COMPLETE_SALE: 'sales.complete',
  APPLY_DISCOUNT: 'sales.discount',
  APPROVE_OVERRIDE: 'sales.priceOverride',
  VIEW_BI: 'bi.view',
  OPEN_SETTINGS: 'settings.view',
  CLOSE_SHIFT: 'shift.close',
  RECORD_CASH_MOVEMENT: 'accounting.review',
  STOCK_ADJUSTMENT: 'inventory.adjust',
  STOCKTAKE: 'stocktake.count',
  OWNER_FINANCIAL_EXPORT: 'reports.export'
};

export function getPermissionsForRole(role: Role): PermissionKey[] {
  if (role === 'Owner' && OWNER_BUILD_DEVELOPMENT_FULL_ACCESS) {
    return ALL_PERMISSIONS;
  }
  return ROLE_PERMISSIONS[role] || [];
}

export function hasPermission(role: Role, permission: PermissionKey): boolean {
  return getPermissionsForRole(role).includes(permission);
}

export function getAllowedMenusForRole(role: Role): PosPageId[] {
  return ROLE_MENUS[role] || ['DASHBOARD'];
}

export function canAccessMenu(role: Role, menuKey: PosPageId): boolean {
  return getAllowedMenusForRole(role).includes(menuKey);
}

export function canPerformAction(role: Role, actionKey: PosAction): boolean {
  const permission = LEGACY_ACTION_PERMISSION[actionKey as Exclude<PosAction, PermissionKey>] || actionKey;
  return hasPermission(role, permission as PermissionKey);
}
