import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/firebaseApp';
import { FIRESTORE_COLLECTIONS } from '../../shared/backend';
import { mirrorOwnerAsBusinessUser, type VendorBusinessUserMirror } from './vendorStaffMirrorService';

/**
 * Developer / admin utility to seed or repair the current Google owner's vendor
 * document (and its owner mirror) so tenant resolution can find the real vendor via
 * `vendors where ownerUid == Firebase uid`.
 *
 * SECURITY:
 *   - This is developer/admin tooling ONLY. It writes `vendors/{vendorId}` and
 *     `vendors/{vendorId}/businessUsers/{ownerUid}`. No PINs, passwords, password
 *     hashes, or any auth secrets are ever written.
 *   - It MUST NOT silently fall back to DEMO-VENDOR. If `vendorId` is missing or is a
 *     known demo/test id, the call fails safely.
 *   - In production, vendor creation should be handled by the verified onboarding /
 *     console workflow, not this utility.
 */

/** Known non-tenant ids that must never be seeded or used as a fallback. */
const NON_TENANT_VENDOR_IDS: ReadonlySet<string> = new Set([
  'DEMO-VENDOR',
  'demo-vendor',
  'demo-vendor-001',
  'test-vendor-001',
  'unassigned-vendor'
]);

export interface VendorOwnerSeedInput {
  vendorId: string;
  ownerUid: string;
  ownerEmail?: string;
  ownerName?: string;
  vendorName: string;
  city?: string;
  suburb?: string;
  source: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface VendorOwnerSeedResult {
  ok: boolean;
  vendorId?: string;
  ownerUid?: string;
  message: string;
}

export type VendorOwnerSeedWithMirrorResult = VendorOwnerSeedResult & {
  mirror?: VendorBusinessUserMirror;
};

function isNonTenantVendorId(value: string): boolean {
  const candidate = value.trim();
  return NON_TENANT_VENDOR_IDS.has(candidate) || NON_TENANT_VENDOR_IDS.has(candidate.toLowerCase());
}

function validateSeedInput(input: VendorOwnerSeedInput): { ok: boolean; message: string } {
  const vendorId = (input.vendorId || '').trim();
  const ownerUid = (input.ownerUid || '').trim();
  const vendorName = (input.vendorName || '').trim();

  if (!vendorId) {
    return { ok: false, message: 'vendorId is required to seed/repair a vendor.' };
  }
  if (isNonTenantVendorId(vendorId)) {
    return { ok: false, message: 'Refusing to seed/repair a demo or test vendorId. Provide a real vendorId.' };
  }
  if (!ownerUid) {
    return { ok: false, message: 'ownerUid (Firebase uid) is required to seed/repair a vendor.' };
  }
  if (!vendorName) {
    return { ok: false, message: 'vendorName is required to seed/repair a vendor.' };
  }
  return { ok: true, message: 'ok' };
}

/**
 * Pure function: builds a normalized vendor document from seed input. No IO.
 */
export function buildVendorOwnerSeed(input: VendorOwnerSeedInput): Record<string, unknown> {
  const now = new Date().toISOString();
  const createdBy = (input.createdBy || '').trim() || input.ownerUid;
  const updatedBy = (input.updatedBy || '').trim() || input.ownerUid;
  return {
    vendorId: input.vendorId.trim(),
    vendorName: input.vendorName.trim(),
    businessName: input.vendorName.trim(),
    tradingName: input.vendorName.trim(),
    ownerUid: input.ownerUid.trim(),
    ownerEmail: (input.ownerEmail || '').trim(),
    ownerName: (input.ownerName || '').trim() || input.vendorName.trim(),
    accountStatus: 'Active',
    verificationStatus: 'Verified',
    planCode: 'DEMO',
    city: (input.city || '').trim(),
    suburb: (input.suburb || '').trim(),
    createdAt: now,
    updatedAt: now,
    createdBy,
    updatedBy,
    source: input.source
  };
}

/**
 * Writes/merges `vendors/{vendorId}`. Returns a safe result on validation or
 * offline failure — never throws. No demo fallback.
 */
export async function seedOrRepairVendorForOwner(input: VendorOwnerSeedInput): Promise<VendorOwnerSeedResult> {
  const validation = validateSeedInput(input);
  if (!validation.ok) {
    return { ok: false, message: validation.message };
  }
  if (!db) {
    return { ok: false, message: 'Firestore is unavailable. Vendor seed skipped (offline).' };
  }
  try {
    const vendorDoc = buildVendorOwnerSeed(input);
    await setDoc(doc(db, FIRESTORE_COLLECTIONS.vendors, input.vendorId.trim()), vendorDoc, { merge: true });
    return {
      ok: true,
      vendorId: input.vendorId.trim(),
      ownerUid: input.ownerUid.trim(),
      message: `Vendor ${input.vendorId.trim()} created / repaired.`
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Vendor seed failed.';
    return { ok: false, message };
  }
}

/**
 * Writes/merges `vendors/{vendorId}` and `vendors/{vendorId}/businessUsers/{ownerUid}`
 * (via mirrorOwnerAsBusinessUser). Returns a safe result — never throws.
 */
export async function seedOrRepairVendorAndOwnerMirror(input: VendorOwnerSeedInput): Promise<VendorOwnerSeedWithMirrorResult> {
  const validation = validateSeedInput(input);
  if (!validation.ok) {
    return { ok: false, message: validation.message };
  }
  if (!db) {
    return { ok: false, message: 'Firestore is unavailable. Vendor + owner mirror seed skipped (offline).' };
  }
  try {
    const vendorDoc = buildVendorOwnerSeed(input);
    await setDoc(doc(db, FIRESTORE_COLLECTIONS.vendors, input.vendorId.trim()), vendorDoc, { merge: true });
    const mirror = await mirrorOwnerAsBusinessUser(
      input.vendorId.trim(),
      input.ownerUid.trim(),
      (input.ownerEmail || '').trim() || undefined,
      (input.ownerName || '').trim() || input.vendorName.trim()
    );
    return {
      ok: true,
      vendorId: input.vendorId.trim(),
      ownerUid: input.ownerUid.trim(),
      mirror,
      message: `Vendor ${input.vendorId.trim()} and owner mirror created / repaired.`
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Vendor + owner mirror seed failed.';
    return { ok: false, message };
  }
}
