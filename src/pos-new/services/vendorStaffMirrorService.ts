import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/firebaseApp';
import { writeAuditLog } from '../../commerce-integration/audit/writeAuditLog';
import type { TenantUserRole } from '../auth/authTypes';

/**
 * Vendor Staff Membership Mirror service.
 *
 * Maintains a uid-keyed mirror at:
 *   vendors/{vendorId}/businessUsers/{uid}
 *
 * This mirror lets the vendor-rooted Firestore security rules (firestore.vendor-rooted.rules)
 * recognise active vendor staff membership via `isVendorStaffMember()` / `isVendorMember()`.
 *
 * SECURITY: This mirror stores only non-sensitive identity/authorization metadata.
 * It MUST NOT store PINs, passwords, password hashes, refresh tokens, or any
 * authentication secrets. PIN hashes live only in staffPinService and are never copied here.
 */

export type VendorBusinessUserStatus = 'active' | 'inactive' | 'suspended' | 'removed';

export type VendorBusinessUserRole = TenantUserRole | 'Owner';

export type VendorBusinessUserSource =
  | 'pos-settings'
  | 'owner-provisioning'
  | 'staff-management'
  | 'migration'
  | 'test-seed';

export interface VendorBusinessUserMirror {
  uid: string;
  vendorId: string;
  staffId: string;
  displayName: string;
  email: string;
  role: VendorBusinessUserRole;
  permissions: string[];
  status: VendorBusinessUserStatus;
  branchIds: string[];
  terminalIds: string[];
  warehouseIds: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  source: VendorBusinessUserSource;
  removedAt?: string;
}

export interface VendorBusinessUserMirrorInput {
  uid: string;
  vendorId: string;
  staffId?: string;
  displayName?: string;
  email?: string;
  role: VendorBusinessUserRole;
  permissions?: string[];
  status?: VendorBusinessUserStatus;
  branchIds?: string[];
  terminalIds?: string[];
  warehouseIds?: string[];
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  source?: VendorBusinessUserSource;
}

const VALID_STATUSES: VendorBusinessUserStatus[] = ['active', 'inactive', 'suspended', 'removed'];
const VALID_SOURCES: VendorBusinessUserSource[] = [
  'pos-settings',
  'owner-provisioning',
  'staff-management',
  'migration',
  'test-seed'
];

function asString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`vendorStaffMirror: '${field}' is required and must be a non-empty string.`);
  }
  return value;
}

function normalizeEmail(value?: string): string {
  if (!value) return '';
  return value.trim().toLowerCase();
}

function asArray(value?: string[]): string[] {
  return Array.isArray(value) ? value.filter((v) => typeof v === 'string') : [];
}

function requireStatus(value: VendorBusinessUserStatus | undefined): VendorBusinessUserStatus {
  const status = value ?? 'active';
  if (!VALID_STATUSES.includes(status)) {
    throw new Error(`vendorStaffMirror: invalid status '${status}'.`);
  }
  return status;
}

function requireSource(value: VendorBusinessUserSource | undefined): VendorBusinessUserSource {
  const source = value ?? 'staff-management';
  if (!VALID_SOURCES.includes(source)) {
    throw new Error(`vendorStaffMirror: invalid source '${source}'.`);
  }
  return source;
}

/**
 * Pure function. Validates and normalizes the mirror payload into a complete
 * VendorBusinessUserMirror. Throws on missing required fields or invalid enums.
 */
export function buildVendorBusinessUserMirror(input: VendorBusinessUserMirrorInput): VendorBusinessUserMirror {
  const uid = asString(input.uid, 'uid');
  // Firebase auth uid may contain characters outside the simple id pattern; we only require non-empty.
  const vendorId = asString(input.vendorId, 'vendorId');
  const now = new Date().toISOString();

  return {
    uid,
    vendorId,
    staffId: input.staffId?.trim() ?? '',
    displayName: input.displayName?.trim() ?? '',
    email: normalizeEmail(input.email),
    role: input.role,
    permissions: asArray(input.permissions),
    status: requireStatus(input.status),
    branchIds: asArray(input.branchIds),
    terminalIds: asArray(input.terminalIds),
    warehouseIds: asArray(input.warehouseIds),
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    createdBy: input.createdBy?.trim() || uid,
    updatedBy: input.updatedBy?.trim() || uid,
    source: requireSource(input.source)
  };
}

async function writeBusinessUserAudit(
  vendorId: string,
  uid: string,
  action: string,
  details: { role?: VendorBusinessUserRole; status?: VendorBusinessUserStatus }
): Promise<void> {
  try {
    await writeAuditLog({
      vendorId,
      staffId: uid,
      module: 'VendorBusinessUserMirror',
      action,
      entityType: 'businessUser',
      entityId: `${vendorId}/${uid}`,
      after: details
    });
  } catch {
    // Audit is best-effort; mirror writes must not fail because of audit issues.
  }
}

/**
 * Writes vendors/{vendorId}/businessUsers/{uid} with merge:true.
 * Preserves createdAt/createdBy on update. Records a BUSINESS_USER_MIRROR_UPSERTED audit event.
 */
export async function upsertVendorBusinessUserMirror(
  input: VendorBusinessUserMirrorInput
): Promise<VendorBusinessUserMirror> {
  if (!db) {
    console.warn('[vendorStaffMirror] Firestore unavailable; skipping mirror write (offline workspace).');
    return buildVendorBusinessUserMirror(input);
  }

  const ref = doc(db, 'vendors', input.vendorId, 'businessUsers', input.uid);
  const existing = await getDoc(ref);
  const base = existing.exists() ? (existing.data() as Partial<VendorBusinessUserMirror>) : {};
  const now = new Date().toISOString();

  const normalized = buildVendorBusinessUserMirror({
    ...input,
    createdAt: base.createdAt ?? now,
    createdBy: base.createdBy ?? input.createdBy ?? input.uid,
    updatedAt: now,
    updatedBy: input.updatedBy ?? input.uid
  });

  await setDoc(ref, normalized, { merge: true });
  await writeBusinessUserAudit(input.vendorId, input.uid, 'BUSINESS_USER_MIRROR_UPSERTED', { role: normalized.role, status: normalized.status });
  return normalized;
}

/** Sets status: inactive (soft disable). No physical delete. */
export async function disableVendorBusinessUserMirror(
  vendorId: string,
  uid: string,
  updatedBy?: string
): Promise<void> {
  if (!db) {
    console.warn('[vendorStaffMirror] Firestore unavailable; skipping disable (offline workspace).');
    return;
  }
  const ref = doc(db, 'vendors', vendorId, 'businessUsers', uid);
  const now = new Date().toISOString();
  await setDoc(ref, { status: 'inactive', updatedAt: now, updatedBy: updatedBy ?? uid }, { merge: true });
  await writeBusinessUserAudit(vendorId, uid, 'BUSINESS_USER_MIRROR_DISABLED', { status: 'inactive' });
}

/** Soft remove: status: removed + removedAt. No physical delete (per spec). */
export async function removeVendorBusinessUserMirror(
  vendorId: string,
  uid: string,
  updatedBy?: string
): Promise<void> {
  if (!db) {
    console.warn('[vendorStaffMirror] Firestore unavailable; skipping remove (offline workspace).');
    return;
  }
  const ref = doc(db, 'vendors', vendorId, 'businessUsers', uid);
  const now = new Date().toISOString();
  await setDoc(
    ref,
    { status: 'removed', removedAt: now, updatedAt: now, updatedBy: updatedBy ?? uid },
    { merge: true }
  );
  await writeBusinessUserAudit(vendorId, uid, 'BUSINESS_USER_MIRROR_REMOVED', { status: 'removed' });
}

/** Reads the mirror document, or null if it does not exist. */
export async function getVendorBusinessUserMirror(
  vendorId: string,
  uid: string
): Promise<VendorBusinessUserMirror | null> {
  if (!db) return null;
  const ref = doc(db, 'vendors', vendorId, 'businessUsers', uid);
  const snapshot = await getDoc(ref);
  return snapshot.exists() ? (snapshot.data() as VendorBusinessUserMirror) : null;
}

/** Convenience: create the owner's mirror record (role: Owner, permissions: ['*'], status: active). */
export async function mirrorOwnerAsBusinessUser(
  vendorId: string,
  ownerUid: string,
  ownerEmail?: string,
  ownerName?: string
): Promise<VendorBusinessUserMirror> {
  return upsertVendorBusinessUserMirror({
    uid: ownerUid,
    vendorId,
    displayName: ownerName,
    email: ownerEmail,
    role: 'Owner',
    permissions: ['*'],
    status: 'active',
    source: 'owner-provisioning'
  });
}
