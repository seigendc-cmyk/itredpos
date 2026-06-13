import type { FirebaseAuthUserProfile } from './authTypes';
import {
  mockBranchAccess,
  mockStaffProfiles,
  mockTenantMemberships,
  mockTerminalAccess
} from './mockTenantDirectory';
import type {
  TenantBranchAccessContract,
  TenantMembershipContract,
  TenantResolutionReadinessRow,
  TenantResolutionResult,
  TenantStaffProfileContract,
  TenantTerminalAccessContract
} from './tenantResolutionTypes';

const fallbackEmail = 'owner@build.local';

export function resolveTenantFromMockDirectory(profile?: FirebaseAuthUserProfile | null): TenantResolutionResult {
  const signedInEmail = (profile?.email || fallbackEmail).toLowerCase();
  const exactMatches = mockTenantMemberships.filter((row) => row.signedInEmail.toLowerCase() === signedInEmail);
  const memberships = exactMatches.length > 0 ? exactMatches : mockTenantMemberships.filter((row) => row.isPrimaryVendor);
  const activeMemberships = memberships.filter((row) => row.accessStatus === 'Active');
  const selectedMembership = activeMemberships.find((row) => row.isPrimaryVendor) || activeMemberships[0];

  if (memberships.length === 0) {
    return { mode: 'Mock Directory', signedInEmail, firebaseUid: profile?.uid, memberships: [], status: 'No Tenant Found', message: 'No mock tenant membership matched this signed-in email.' };
  }

  if (!selectedMembership) {
    return { mode: 'Mock Directory', signedInEmail, firebaseUid: profile?.uid, memberships, status: 'Access Disabled', message: 'Mock tenant memberships exist, but no active POS access is available.' };
  }

  return {
    mode: 'Mock Directory',
    signedInEmail,
    firebaseUid: profile?.uid,
    memberships,
    selectedMembership,
    status: memberships.length > 1 ? 'Multiple Tenants Found' : 'Resolved',
    message: memberships.length > 1 ? 'Multiple mock memberships found; primary active membership selected.' : 'Mock tenant membership resolved.'
  };
}

export function getMockMembershipById(membershipId: string): TenantMembershipContract | undefined {
  return mockTenantMemberships.find((row) => row.membershipId === membershipId);
}

export function getMockStaffProfilesForTenant(vendorId: string, membershipId?: string): TenantStaffProfileContract[] {
  const rows = mockStaffProfiles.filter((row) => row.vendorId === vendorId);
  return membershipId ? rows.filter((row) => row.membershipId === membershipId || row.role === 'VendorOwner') : rows;
}

export function getMockBranchAccessForStaff(vendorId: string, staffId?: string): TenantBranchAccessContract[] {
  return mockBranchAccess.filter((row) => row.vendorId === vendorId && (!staffId || row.staffId === staffId));
}

export function getMockTerminalAccessForStaff(vendorId: string, branchId?: string, staffId?: string): TenantTerminalAccessContract[] {
  return mockTerminalAccess.filter((row) => row.vendorId === vendorId && (!branchId || row.branchId === branchId) && (!staffId || row.staffId === staffId));
}

export function getTenantResolutionReadinessRows(): TenantResolutionReadinessRow[] {
  return [
    { item: 'Vendor Memberships', status: 'Placeholder', contractPath: '/vendorMemberships/{membershipId}', notes: 'Mock directory resolves signed-in email to active vendor memberships.' },
    { item: 'Staff Profiles', status: 'Placeholder', contractPath: '/vendors/{vendorId}/staffProfiles', notes: 'Staff profile mapping is local contract-only.' },
    { item: 'Branch Access', status: 'Placeholder', contractPath: '/vendors/{vendorId}/branchAccess', notes: 'Branch access contracts are visible before production rules.' },
    { item: 'Terminal Access', status: 'Placeholder', contractPath: '/vendors/{vendorId}/terminalAccess', notes: 'Terminal assignment is local and non-blocking.' },
    { item: 'Role Permission Profiles', status: 'Ready', contractPath: '/vendors/{vendorId}/rolePermissionProfiles', notes: 'Tenant roles map to existing POS permission keys.' },
    { item: 'Session Audit Events', status: 'Placeholder', contractPath: '/vendors/{vendorId}/sessionAuditEvents', notes: 'Activity is localStorage-only until audit repository activation.' },
    { item: 'Production Firestore Lookup', status: 'Disabled', contractPath: 'Disabled', notes: 'Business Firestore tenant lookup is intentionally not active.' }
  ];
}
