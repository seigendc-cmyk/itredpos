import type { PermissionKey } from '../utils/posPermissions';
import type { TenantUserRole } from './authTypes';

export type TenantAccessStatus = 'Active' | 'Disabled' | 'Pending' | 'No Access';
export type TenantResolutionMode = 'Mock Directory' | 'Firestore Future';

export interface TenantMembershipContract {
  membershipId: string;
  vendorId: string;
  vendorName: string;
  signedInEmail: string;
  firebaseUid?: string;
  role: TenantUserRole;
  accessStatus: TenantAccessStatus;
  isPrimaryVendor: boolean;
}

export interface TenantStaffProfileContract {
  staffId: string;
  vendorId: string;
  membershipId: string;
  staffName: string;
  staffCode: string;
  role: TenantUserRole;
  status: TenantAccessStatus;
  pinRequired: boolean;
}

export interface TenantBranchAccessContract {
  branchAccessId: string;
  vendorId: string;
  branchId: string;
  branchName: string;
  staffId: string;
  accessStatus: TenantAccessStatus;
}

export interface TenantTerminalAccessContract {
  terminalAccessId: string;
  vendorId: string;
  branchId: string;
  terminalId: string;
  terminalName: string;
  staffId: string;
  accessStatus: TenantAccessStatus;
}

export interface TenantSessionClaims {
  sessionId: string;
  mode: TenantResolutionMode;
  vendorId: string;
  vendorName: string;
  membershipId?: string;
  signedInEmail?: string;
  membershipRole?: TenantUserRole;
  staffId?: string;
  staffName?: string;
  staffStatus?: TenantAccessStatus;
  branchId?: string;
  branchName?: string;
  terminalId?: string;
  terminalName?: string;
  terminalStatus?: TenantAccessStatus;
  posAccessStatus: TenantAccessStatus;
  permissions: PermissionKey[];
  createdAt: string;
  updatedAt: string;
  notes: string;
}

export interface TenantResolutionResult {
  mode: TenantResolutionMode;
  signedInEmail?: string;
  firebaseUid?: string;
  memberships: TenantMembershipContract[];
  selectedMembership?: TenantMembershipContract;
  status: 'Resolved' | 'No Tenant Found' | 'Multiple Tenants Found' | 'Access Disabled';
  message: string;
}

export interface TenantResolutionReadinessRow {
  item: string;
  status: 'Ready' | 'Placeholder' | 'Disabled' | 'Future';
  contractPath: string;
  notes: string;
}
