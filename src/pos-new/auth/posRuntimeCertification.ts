import type { VendorLicenseRuntimeSnapshot } from './vendorLicenseRuntimeService';
import type { SciPosStaffSession, SciVendorOwnerSession } from '../../sci-auth/StaffAuthService';

export interface RuntimeCertificationResult {
  certified: boolean;
  reason: string;
}

const clean = (value: unknown): string => String(value ?? '').trim();
const compact = (value: unknown): string => clean(value).replace(/[\s_-]+/g, '').toLowerCase();

export function certifyVendorIdentity(
  profile: { uid: string; email?: string } | null | undefined,
  vendor: Partial<SciVendorOwnerSession> & { ownerUid?: string; accountStatus?: string; verificationStatus?: string }
): RuntimeCertificationResult {
  if (!profile?.uid) return { certified: false, reason: 'Firebase vendor authentication is required.' };
  if (!clean(vendor.vendorId)) return { certified: false, reason: 'Vendor tenant could not be resolved.' };
  const ownerUid = clean(vendor.ownerUid);
  const ownerEmail = clean(vendor.ownerEmail).toLowerCase();
  const profileEmail = clean(profile.email).toLowerCase();
  if (ownerUid && ownerUid !== profile.uid) return { certified: false, reason: 'Vendor owner identity does not match the authenticated user.' };
  if (!ownerUid && (!ownerEmail || ownerEmail !== profileEmail)) return { certified: false, reason: 'Vendor owner identity does not match the authenticated account.' };
  const blocked = [vendor.status, vendor.accountStatus, vendor.verificationStatus].map(compact);
  if (blocked.some((status) => ['inactive', 'disabled', 'suspended', 'rejected', 'revoked'].includes(status))) {
    return { certified: false, reason: 'Vendor account is not active.' };
  }
  return { certified: true, reason: 'Vendor identity certified.' };
}

export function certifyStaffRuntimeSession(
  owner: SciVendorOwnerSession | null | undefined,
  staff: SciPosStaffSession | null | undefined,
  license: VendorLicenseRuntimeSnapshot | null | undefined,
  now = Date.now(),
  maximumAgeMs = 12 * 60 * 60 * 1000
): RuntimeCertificationResult {
  if (!owner?.vendorId) return { certified: false, reason: 'Validated vendor context is required.' };
  if (!staff) return { certified: false, reason: 'Staff authentication is required.' };
  for (const [field, value] of Object.entries({ vendorId: staff.vendorId, staffId: staff.staffId, branchId: staff.branchId, warehouseId: staff.warehouseId, terminalId: staff.terminalId, role: staff.role })) {
    if (!clean(value)) return { certified: false, reason: `${field} is required in the authenticated staff session.` };
  }
  if (staff.vendorId !== owner.vendorId) return { certified: false, reason: 'Staff session belongs to another vendor.' };
  const signedInAt = Date.parse(staff.signedInAt);
  const validatedAt = Date.parse(staff.validatedAt || staff.signedInAt);
  if (!Number.isFinite(signedInAt) || !Number.isFinite(validatedAt) || signedInAt > now + 60_000 || validatedAt > now + 60_000 || now - validatedAt > maximumAgeMs) {
    return { certified: false, reason: 'Staff session is stale or has invalid validation metadata.' };
  }
  if (!license || license.vendorId !== owner.vendorId) return { certified: false, reason: 'Vendor license context is missing or mismatched.' };
  if (!license.licenseStatusKnown) return { certified: false, reason: 'Vendor license has not been validated.' };
  if (!license.allowed) return { certified: false, reason: license.message || 'Vendor license does not permit POS access.' };
  return { certified: true, reason: 'POS runtime identity certified.' };
}
