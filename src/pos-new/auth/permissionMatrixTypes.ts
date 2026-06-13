export type PermissionArea =
  | 'Dashboard'
  | 'Sales'
  | 'Customers'
  | 'Inventory'
  | 'Procurement'
  | 'Stock Control'
  | 'Delivery'
  | 'Accounting'
  | 'Reports'
  | 'Approvals'
  | 'Sync'
  | 'Settings'
  | 'Staff Access'
  | 'Hardware'
  | 'BI'
  | 'Audit';

export type PermissionRiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';
export type PermissionInheritanceMode = 'Inherited' | 'Direct' | 'Denied' | 'Locked' | 'Not Applicable';
export type SecurityRoleKey = 'Owner' | 'SysAdmin' | 'Manager' | 'Supervisor' | 'Accountant' | 'StockController' | 'Cashier' | 'DeliveryStaff' | 'Viewer';

export interface SecurityPermissionRight {
  permissionKey: string;
  label: string;
  area: PermissionArea;
  description: string;
  riskLevel: PermissionRiskLevel;
  requiresApproval: boolean;
  systemLocked: boolean;
  defaultRoles: SecurityRoleKey[];
  warningNote?: string;
  sortOrder: number;
}

export interface SecurityRoleDefinition {
  roleKey: SecurityRoleKey;
  roleLabel: string;
  hierarchyLevel: number;
  description: string;
  inheritsFrom: SecurityRoleKey[];
  systemRole: boolean;
  canBeEdited: boolean;
  defaultDashboard: string;
  notes?: string;
}

export interface SecurityRoleHierarchyRule {
  roleKey: SecurityRoleKey;
  inheritsFrom: SecurityRoleKey;
  inheritanceType: 'Full' | 'Area Specific' | 'Read Only';
  notes: string;
}

export interface SecurityPermissionMatrixCell {
  permissionKey: string;
  roleKey: SecurityRoleKey;
  allowed: boolean;
  inheritanceMode: PermissionInheritanceMode;
  inheritedFrom?: SecurityRoleKey;
  locked: boolean;
  reason?: string;
  changedByStaffId?: string;
  changedAt?: string;
}

export interface SecurityPermissionMatrixRow {
  permission: SecurityPermissionRight;
  cells: SecurityPermissionMatrixCell[];
}

export interface SecurityPermissionMatrix {
  roles: SecurityRoleDefinition[];
  rows: SecurityPermissionMatrixRow[];
  updatedAt: string;
}

export interface SecurityPermissionOverride {
  permissionKey: string;
  roleKey: SecurityRoleKey;
  allowed: boolean;
  reason: string;
  changedByStaffId: string;
  changedAt: string;
}

export interface SecurityPermissionActivityEvent {
  eventId: string;
  eventType:
    | 'SECURITY_RIGHTS_MATRIX_OPENED'
    | 'SECURITY_RIGHT_TOGGLED'
    | 'SECURITY_ROLE_OVERRIDE_SET'
    | 'SECURITY_ROLE_OVERRIDE_CLEARED'
    | 'SECURITY_ROLE_RESET_TO_DEFAULT'
    | 'SECURITY_MATRIX_RESET_TO_DEFAULT'
    | 'SECURITY_RIGHT_SELECTED'
    | 'SECURITY_RIGHT_SEARCHED'
    | 'SECURITY_GROUP_COPY_PLACEHOLDER'
    | 'SECURITY_GROUP_PRINT_PLACEHOLDER'
    | 'ROLES_PERMISSIONS_RETIRED'
    | 'STAFF_ACCESS_RIGHTS_OPENED'
    | 'STAFF_ACCESS_RIGHTS_SET_AS_PRIMARY'
    | 'ROLE_MENU_ACCESS_RECALCULATED'
    | 'STAFF_ROLE_NAVIGATION_APPLIED'
    | 'DUPLICATE_PERMISSION_STATE_DISABLED'
    | 'PERMISSION_SOURCE_UNIFIED';
  label: string;
  message: string;
  createdAt: string;
  staffId?: string;
  roleKey?: SecurityRoleKey;
  permissionKey?: string;
}

export interface SecurityRightsFilterState {
  area: PermissionArea | 'ALL';
  view: 'All Rights' | 'Allowed Only' | 'High Risk' | 'Overrides';
  search: string;
}
