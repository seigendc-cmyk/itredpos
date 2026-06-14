import type { PosPageId, Role } from '../types';
import type { PermissionKey } from '../utils/posPermissions';
import type { TenantUserRole } from './authTypes';

export type StaffPinVerificationStatus =
  | 'Not Required'
  | 'Pending'
  | 'Verified'
  | 'Failed'
  | 'Locked'
  | 'Expired'
  | 'Disabled'
  | 'Build Development Bypass';

export type StaffSessionGateStatus =
  | 'Disabled'
  | 'Preview'
  | 'Required'
  | 'Staff Selection Required'
  | 'Pin Required'
  | 'Session Active'
  | 'Session Locked'
  | 'Build Development Bypass'
  | 'Error';

export type StaffDeskType =
  | 'Sales Terminal'
  | 'Stock Desk'
  | 'Delivery Desk'
  | 'Owner Desk'
  | 'Manager Desk'
  | 'Accounting Desk'
  | 'Sync Desk'
  | 'Reports Desk'
  | 'General POS';

export type RoleMenuKey =
  | 'dashboard'
  | 'ownerDesk'
  | 'salesTerminal'
  | 'salesHistory'
  | 'customerCentre'
  | 'deliveryDesk'
  | 'inventory'
  | 'productMaster'
  | 'productImportDesk'
  | 'stocktakeDesk'
  | 'stockAdjustments'
  | 'purchaseOrders'
  | 'goodsReceiving'
  | 'supplierReturns'
  | 'stockTransfers'
  | 'purchaseDiscipline'
  | 'creditorsManagement'
  | 'taskDesk'
  | 'approvals'
  | 'biDesk'
  | 'syncDesk'
  | 'reports'
  | 'accountingFinance'
  | 'financialControl'
  | 'settings';

export type StaffGateRole = Role | TenantUserRole | 'Accountant' | 'Viewer';

export interface StaffPinCredential {
  staffId: string;
  staffName: string;
  demoPin: string;
  isBuildDevelopmentDemo: true;
  notes: string;
}

export interface StaffPinVerificationAttempt {
  attemptId: string;
  staffId: string;
  enteredAt: string;
  status: StaffPinVerificationStatus;
  message: string;
  failedAttempts: number;
}

export interface StaffGateSession {
  gateSessionId: string;
  tenantSessionId: string;
  vendorId: string;
  staffId: string;
  staffName: string;
  staffRole: StaffGateRole;
  branchId: string;
  branchName: string;
  terminalId: string;
  terminalName: string;
  deskType: StaffDeskType;
  pinStatus: StaffPinVerificationStatus;
  gateStatus: StaffSessionGateStatus;
  menuKeys: RoleMenuKey[];
  permissions: string[];
  startedAt: string;
  lastActiveAt: string;
  lockedAt?: string;
  expiresAt?: string;
  failedAttempts: number;
  isBuildDevelopmentBypass: boolean;
  notes?: string;
}

export interface StaffMenuAccessRecord {
  menuKey: RoleMenuKey;
  menuLabel: string;
  group: string;
  access: 'Allowed' | 'Restricted' | 'Limited';
  pageId?: PosPageId;
  notes?: string;
}

export interface RoleMenuDefinition {
  menuKey: RoleMenuKey;
  menuLabel: string;
  group: 'Main' | 'Inventory' | 'Control';
  pageId?: PosPageId;
}

export interface RoleMenuGroup {
  group: 'Main' | 'Inventory' | 'Control';
  menus: RoleMenuDefinition[];
}

export interface RoleActionPermission {
  permissionKey: PermissionKey | string;
  area: 'Sales' | 'Inventory' | 'Delivery' | 'Control';
  label: string;
}

export interface StaffSessionGateReadiness {
  item: string;
  status: 'Enabled' | 'Disabled' | 'Preview' | 'Required' | 'Active';
  notes: string;
}

export interface StaffPinActivityEvent {
  eventId: string;
  eventType:
    | 'STAFF_GATE_SESSION_STARTED'
    | 'STAFF_PIN_VERIFICATION_NOT_REQUIRED'
    | 'STAFF_PIN_VERIFIED'
    | 'STAFF_PIN_FAILED'
    | 'STAFF_PIN_LOCKED'
    | 'STAFF_GATE_SESSION_ACTIVATED'
    | 'STAFF_GATE_SESSION_LOCKED'
    | 'STAFF_GATE_SESSION_CLEARED'
    | 'ROLE_MENU_PREVIEW_LOADED'
    | 'PERMISSION_PREVIEW_CHECKED'
    | 'BUILD_DEV_OWNER_BYPASS_USED';
  label: string;
  message: string;
  createdAt: string;
  staffId?: string;
  gateSessionId?: string;
}
