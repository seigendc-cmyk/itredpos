import { Role, PosPageId } from '../types';

export type PosAction =
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

// Define strict menu mapping rules for roles
const ROLE_MENUS: Record<Role, PosPageId[]> = {
  'Owner': ['DASHBOARD', 'OWNER_DESK', 'SALES', 'DELIVERY', 'STOCK', 'SHIFT', 'CASH', 'BI_DESK', 'SYNC_DESK', 'SETTINGS'],
  'SysAdmin': ['DASHBOARD', 'OWNER_DESK', 'SALES', 'DELIVERY', 'STOCK', 'SHIFT', 'CASH', 'BI_DESK', 'SYNC_DESK', 'SETTINGS'],
  'Manager': ['DASHBOARD', 'OWNER_DESK', 'SALES', 'DELIVERY', 'STOCK', 'SHIFT', 'CASH', 'BI_DESK', 'SYNC_DESK'],
  'Supervisor': ['DASHBOARD', 'SALES', 'DELIVERY', 'STOCK', 'SHIFT', 'CASH', 'BI_DESK', 'SYNC_DESK'],
  'Cashier': ['DASHBOARD', 'SALES', 'DELIVERY', 'SHIFT', 'SYNC_DESK'],
  'Stock Controller': ['DASHBOARD', 'STOCK', 'BI_DESK', 'SYNC_DESK']
};

export function getAllowedMenusForRole(role: Role): PosPageId[] {
  return ROLE_MENUS[role] || ['DASHBOARD'];
}

export function canAccessMenu(role: Role, menuKey: PosPageId): boolean {
  const allowed = getAllowedMenusForRole(role);
  return allowed.includes(menuKey);
}

// Action permission definitions
const ROLE_ACTIONS: Record<Role, PosAction[]> = {
  'Owner': [
    'COMPLETE_SALE',
    'APPLY_DISCOUNT',
    'APPROVE_OVERRIDE',
    'VIEW_BI',
    'OPEN_SETTINGS',
    'CLOSE_SHIFT',
    'RECORD_CASH_MOVEMENT',
    'STOCK_ADJUSTMENT',
    'STOCKTAKE',
    'OWNER_FINANCIAL_EXPORT'
  ],
  'SysAdmin': [
    'COMPLETE_SALE',
    'APPLY_DISCOUNT',
    'APPROVE_OVERRIDE',
    'VIEW_BI',
    'OPEN_SETTINGS',
    'CLOSE_SHIFT',
    'RECORD_CASH_MOVEMENT',
    'STOCK_ADJUSTMENT',
    'STOCKTAKE'
  ],
  'Manager': [
    'COMPLETE_SALE',
    'APPLY_DISCOUNT',
    'APPROVE_OVERRIDE',
    'VIEW_BI',
    'CLOSE_SHIFT',
    'RECORD_CASH_MOVEMENT',
    'STOCK_ADJUSTMENT',
    'STOCKTAKE'
  ],
  'Supervisor': [
    'APPROVE_OVERRIDE',
    'VIEW_BI',
    'CLOSE_SHIFT',
    'RECORD_CASH_MOVEMENT',
    'STOCKTAKE'
  ],
  'Cashier': [
    'COMPLETE_SALE',
    'APPLY_DISCOUNT',
    'CLOSE_SHIFT'
  ],
  'Stock Controller': [
    'VIEW_BI',
    'STOCK_ADJUSTMENT',
    'STOCKTAKE'
  ]
};

export function canPerformAction(role: Role, action: PosAction): boolean {
  const allowedActions = ROLE_ACTIONS[role] || [];
  return allowedActions.includes(action);
}
