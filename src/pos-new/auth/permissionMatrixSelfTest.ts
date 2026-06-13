import { roleHasEffectivePermission } from './effectivePermissionService';

export interface PermissionMatrixSelfTestCase {
  label: string;
  roleKey: string;
  permissionKey: string;
  expected: boolean;
}

export interface PermissionMatrixSelfTestResult extends PermissionMatrixSelfTestCase {
  actual: boolean;
  passed: boolean;
}

export interface PermissionMatrixSelfTestReport {
  passed: boolean;
  results: PermissionMatrixSelfTestResult[];
}

const cases: PermissionMatrixSelfTestCase[] = [
  { label: 'Owner can edit security rights', roleKey: 'Owner', permissionKey: 'settings.permissions.edit', expected: true },
  { label: 'Cashier cannot edit security rights', roleKey: 'Cashier', permissionKey: 'settings.permissions.edit', expected: false },
  { label: 'Cashier can complete sales', roleKey: 'Cashier', permissionKey: 'sales.complete', expected: true },
  { label: 'Delivery Staff cannot complete sales', roleKey: 'DeliveryStaff', permissionKey: 'sales.complete', expected: false },
  { label: 'Stock Controller can create products', roleKey: 'StockController', permissionKey: 'productMaster.create', expected: true },
  { label: 'Stock Controller cannot open cash drawer', roleKey: 'StockController', permissionKey: 'sales.cashDrawer.open', expected: false },
  { label: 'Accountant can view accounting', roleKey: 'Accountant', permissionKey: 'accounting.view', expected: true },
  { label: 'Accountant cannot post stock adjustments', roleKey: 'Accountant', permissionKey: 'stockAdjustment.post', expected: false },
  { label: 'Viewer cannot edit products', roleKey: 'Viewer', permissionKey: 'productMaster.edit', expected: false },
  { label: 'Manager can approve low-risk requests', roleKey: 'Manager', permissionKey: 'approvals.approveLowRisk', expected: true },
  { label: 'Supervisor cannot approve high-risk requests', roleKey: 'Supervisor', permissionKey: 'approvals.approveHighRisk', expected: false }
];

export function runPermissionMatrixSelfTest(): PermissionMatrixSelfTestReport {
  const results = cases.map((testCase) => {
    const actual = roleHasEffectivePermission(testCase.roleKey, testCase.permissionKey);
    return { ...testCase, actual, passed: actual === testCase.expected };
  });
  return { passed: results.every((result) => result.passed), results };
}
