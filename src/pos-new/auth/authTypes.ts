import type { PermissionKey } from '../utils/posPermissions';

export type AuthProviderType = 'Google' | 'Build Development' | 'Staff PIN' | 'Unknown';
export type FirebaseAuthShellStatus = 'Ready' | 'Not Configured' | 'Disabled' | 'Signed Out' | 'Signed In' | 'Error';
export type TenantSessionStatus =
  | 'Build Development'
  | 'Pending Vendor Auth'
  | 'Vendor Authenticated'
  | 'Tenant Resolved'
  | 'Staff Selection Required'
  | 'Staff Authenticated'
  | 'Session Active'
  | 'Session Locked'
  | 'Error';

export type TenantUserRole =
  | 'VendorOwner'
  | 'VendorAdmin'
  | 'Manager'
  | 'Supervisor'
  | 'Cashier'
  | 'StockController'
  | 'DeliveryStaff'
  | 'Accountant'
  | 'Viewer';

export interface FirebaseAuthUserProfile {
  uid: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  providerId: string;
  authProvider: AuthProviderType;
}

export interface VendorTenantIdentity {
  vendorId: string;
  vendorName: string;
  vendorEmail?: string;
  firebaseUid?: string;
  googleEmail?: string;
  status: 'Placeholder' | 'Resolved' | 'Not Resolved';
}

export interface TenantStaffIdentity {
  staffId: string;
  staffName: string;
  staffRole: TenantUserRole;
  pinRequired: boolean;
}

export interface TenantBranchIdentity {
  branchId: string;
  branchName: string;
}

export interface TenantTerminalIdentity {
  terminalId: string;
  terminalName: string;
}

export interface TenantSession {
  sessionId: string;
  authProvider: AuthProviderType;
  status: TenantSessionStatus;
  vendorId: string;
  vendorName: string;
  membershipId?: string;
  membershipRole?: TenantUserRole;
  vendorEmail?: string;
  firebaseUid?: string;
  googleEmail?: string;
  staffId?: string;
  staffName?: string;
  staffRole?: TenantUserRole;
  branchId?: string;
  branchName?: string;
  terminalId?: string;
  terminalName?: string;
  licenseId?: string;
  planId?: string;
  licenseMode?: string;
  storageMode?: string;
  activationId?: string;
  permissions: PermissionKey[];
  isBuildDevelopmentSession: boolean;
  authRequired: boolean;
  tenantResolved: boolean;
  staffAuthenticated: boolean;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  lockedAt?: string;
  notes?: string;
}

export interface StaffAccessAttempt {
  vendorId: string;
  staffId: string;
  branchId: string;
  terminalId: string;
  pinOrPassword?: string;
  rememberTerminal?: boolean;
}

export interface TenantSessionReadiness {
  item: string;
  status: 'Ready' | 'Disabled' | 'Placeholder' | 'Required' | 'Active';
  notes: string;
}

export interface AuthActivityEvent {
  eventId: string;
  eventType:
    | 'AUTH_SHELL_CHECKED'
    | 'GOOGLE_SIGN_IN_PLACEHOLDER_STARTED'
    | 'GOOGLE_SIGN_IN_PLACEHOLDER_SUCCESS'
    | 'GOOGLE_SIGN_IN_PLACEHOLDER_FAILED'
    | 'FIREBASE_SIGN_OUT_PLACEHOLDER'
    | 'BUILD_DEV_SESSION_CREATED'
    | 'BUILD_DEV_TENANT_BYPASS_USED'
    | 'TENANT_RESOLUTION_PLACEHOLDER'
    | 'TENANT_RESOLUTION_STARTED'
    | 'TENANT_RESOLUTION_RESOLVED'
    | 'TENANT_RESOLUTION_NO_TENANT_FOUND'
    | 'TENANT_RESOLUTION_MULTIPLE_TENANTS_FOUND'
    | 'TENANT_ACCESS_DISABLED'
    | 'STAFF_PROFILE_MAPPING_LOADED'
    | 'BRANCH_ACCESS_LOADED'
    | 'TERMINAL_ACCESS_LOADED'
    | 'SESSION_CLAIMS_CREATED'
    | 'STAFF_MAPPED_SESSION_ACTIVATED'
    | 'STAFF_ACCESS_SELECTED'
    | 'STAFF_PIN_VERIFIED_PLACEHOLDER'
    | 'TENANT_SESSION_ACTIVATED'
    | 'TENANT_SESSION_LOCKED'
    | 'TENANT_SESSION_CLEARED'
    | 'POS_ACTIVATION_VALIDATED'
    | 'POS_LOGIN_ALLOWED'
    | 'POS_LOGIN_BLOCKED'
    | 'ACTIVATION_VALIDATED'
    | 'SESSION_CREATED';
  label: string;
  message: string;
  createdAt: string;
  staffId?: string;
  vendorId?: string;
}

export interface AuthShellActionResult {
  ok: boolean;
  status: FirebaseAuthShellStatus;
  message: string;
  profile?: FirebaseAuthUserProfile | null;
  error?: string;
}
