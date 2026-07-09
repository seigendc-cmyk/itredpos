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
  TenantTerminalAccessContract,
  VendorByOwnerUidResult
} from './tenantResolutionTypes';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase/firebaseApp';
import { FIRESTORE_COLLECTIONS } from '../../shared/backend';

const fallbackEmail = 'owner@build.local';

/**
 * Resolves the real vendor document from Firestore by the authenticated owner's
 * Firebase UID, so the POS stops depending on local/demo vendor IDs.
 *
 * Query:
 *   collection(db, "vendors") where ownerUid == ownerUid
 *
 * Behaviour:
 *   - exactly one vendor  -> ok true, vendorId + vendorName
 *   - none found          -> ok false, message "No vendor found for this Google account."
 *   - more than one       -> ok true, first only, warning about vendor selector
 *
 * Safety:
 *   - Only queries by the authenticated owner's UID (no other vendor data exposed).
 *   - Never writes. Never invents a vendorId. Never falls back to DEMO-VENDOR.
 *   - Returns ok false with a message when Firebase is offline or the query fails,
 *     so the app does not crash.
 */
function mapVendorSummary(docId: string, data: Record<string, unknown>): ResolvedVendorSummary {
  const vendorId = (data.vendorId as string) || docId;
  return {
    vendorId,
    vendorName: (data.businessName as string) || (data.tradingName as string) || vendorId,
    accountStatus: (data.accountStatus as string) || undefined,
    verificationStatus: (data.verificationStatus as string) || undefined,
    planCode: (data.planCode as string) || undefined,
    city: (data.city as string) || undefined,
    suburb: (data.suburb as string) || undefined
  };
}

export async function resolveVendorByOwnerUid(ownerUid: string): Promise<VendorByOwnerUidResult> {
  const base: VendorByOwnerUidResult = {
    ok: false,
    vendorId: '',
    vendorName: '',
    ownerUid,
    vendors: [],
    selectedVendorRequired: false,
    message: 'Vendor resolution did not complete.'
  };

  if (!ownerUid) {
    return { ...base, message: 'Owner UID is required to resolve a vendor.' };
  }

  if (!db) {
    return { ...base, message: 'Firestore is unavailable. Vendor resolution skipped (offline).' };
  }

  try {
    const q = query(
      collection(db, FIRESTORE_COLLECTIONS.vendors),
      where('ownerUid', '==', ownerUid)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      return { ...base, message: 'No vendor found for this Google account.' };
    }

    const docs = snap.docs;
    const vendors = docs.map((d) => mapVendorSummary(d.id, d.data() as Record<string, unknown>));
    const first = vendors[0];
    const selectedVendorRequired = docs.length > 1;

    const result: VendorByOwnerUidResult = {
      ok: true,
      vendorId: first.vendorId,
      vendorName: first.vendorName,
      ownerUid,
      ownerEmail: (docs[0].data() as Record<string, unknown>).ownerEmail as string | undefined,
      status: (docs[0].data() as Record<string, unknown>).status as string | undefined,
      accountStatus: first.accountStatus,
      vendors,
      selectedVendorRequired,
      message: selectedVendorRequired
        ? 'Multiple vendors found for this owner. Select a business tenant to continue.'
        : 'Vendor resolved from Firebase owner UID.'
    };

    if (selectedVendorRequired) {
      result.warning =
        'Multiple vendors found for this owner. Vendor selector required to continue.';
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Vendor resolution failed.';
    return { ...base, message };
  }
}

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
