import {
  collection,
  getDocs,
  query,
  where,
  limit,
  doc,
  setDoc,
  writeBatch
} from 'firebase/firestore';
import { db } from '../pos-new/firebase/firebaseApp';
import { FIRESTORE_COLLECTIONS } from '../shared/backend';
import type { VendorRecord } from './VendorFirebaseService';
import { createVendorAuditLog } from '../shared/backend';

export interface VendorRecord {
  vendorId: string;
  businessName: string;
  tradingName?: string;
  ownerUid: string;
  ownerEmail: string;
  ownerName: string;
  phone?: string;
  whatsapp?: string;
  country?: string;
  city?: string;
  suburb?: string;
  physicalAddress?: string;
  status?: string;
  mode?: string;
}

export interface VendorOnboardingDraft {
  businessName: string;
  tradingName?: string;
  ownerName: string;
  ownerEmail: string;
  phone: string;
  whatsapp?: string;
  country?: string;
  city?: string;
  suburb?: string;
  physicalAddress?: string;
}

export async function findVendorByGoogleAccount(profile: { uid: string; email?: string }): Promise<VendorRecord | null> {
  if (!db) return null;

  const uid = profile.uid;
  const email = profile.email?.toLowerCase() || '';

  console.log('[VendorFirebaseService] Firestore READ', 'vendors', {
    operation: 'query',
    path: 'vendors',
    uid,
    email,
    vendorId: 'unknown',
    filter: { ownerUid: uid }
  });

  const q1 = query(collection(db, 'vendors'), where('ownerUid', '==', uid), limit(1));
  const snap1 = await getDocs(q1);
  if (!snap1.empty) {
    const data = snap1.docs[0].data();
    return mapVendorData(snap1.docs[0].id, data);
  }

  if (email) {
    console.log('[VendorFirebaseService] Firestore READ', 'vendors', {
      operation: 'query',
      path: 'vendors',
      uid,
      email,
      vendorId: 'unknown',
      filter: { ownerEmail: email }
    });

    const q2 = query(collection(db, 'vendors'), where('ownerEmail', '==', email), limit(1));
    const snap2 = await getDocs(q2);
    if (!snap2.empty) {
      const data = snap2.docs[0].data();
      return mapVendorData(snap2.docs[0].id, data);
    }
  }

  return null;
}

export async function createVendorAccount(
  profile: { uid: string; email?: string; displayName?: string },
  draft: VendorOnboardingDraft
): Promise<VendorRecord> {
  if (!db) {
    throw new Error('Firestore is not available.');
  }

  const existing = await findVendorByGoogleAccount(profile);
  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const vendorId = `vendor-${profile.uid.slice(0, 8)}`;
  const businessName = draft.businessName.trim() || 'New Business';
  const tradingName = draft.tradingName?.trim() || businessName;
  const ownerName = draft.ownerName.trim() || profile.displayName || profile.email?.split('@')[0] || 'Owner';
  const ownerEmail = draft.ownerEmail.trim() || profile.email || '';

  const vendorRef = doc(db, FIRESTORE_COLLECTIONS.vendors, vendorId);
  const branchId = `${vendorId}_main_branch`;
  const warehouseId = `${vendorId}_main_warehouse`;
  const staffId = `${vendorId}_owner`;

  const vendor = {
    vendorId,
    businessName,
    tradingName,
    ownerUid: profile.uid,
    ownerEmail,
    ownerName,
    phone: draft.phone || '',
    whatsapp: draft.whatsapp || '',
    country: draft.country || '',
    city: draft.city || '',
    suburb: draft.suburb || '',
    physicalAddress: draft.physicalAddress || '',
    status: 'Active',
    mode: 'Demo',
    createdAt: now,
    updatedAt: now
  };

  const branch = {
    vendorId,
    branchId,
    branchName: 'Main Branch',
    phone: draft.phone || '',
    whatsapp: draft.whatsapp || '',
    email: ownerEmail,
    country: draft.country || '',
    city: draft.city || '',
    suburb: draft.suburb || '',
    address: draft.physicalAddress || '',
    status: 'Active' as const,
    source: 'simple-auth',
    createdAt: now,
    updatedAt: now
  };

  const warehouse = {
    vendorId,
    warehouseId,
    branchId,
    warehouseName: 'Main Warehouse',
    phone: draft.phone || '',
    whatsapp: draft.whatsapp || '',
    email: ownerEmail,
    country: draft.country || '',
    city: draft.city || '',
    suburb: draft.suburb || '',
    address: draft.physicalAddress || '',
    status: 'Active' as const,
    source: 'simple-auth',
    createdAt: now,
    updatedAt: now
  };

  const staff = {
    vendorId,
    staffId,
    branchId,
    name: ownerName,
    email: ownerEmail,
    phone: draft.phone || '',
    whatsapp: draft.whatsapp || '',
    role: 'Owner' as const,
    status: 'Active' as const,
    source: 'simple-auth',
    createdAt: now,
    updatedAt: now
  };

  const auditLog = createVendorAuditLog(
    vendorId,
    'VENDOR_SIGN_UP',
    `Vendor account created via simple auth. Business: ${businessName}.`
  );

  const batch = writeBatch(db);
  batch.set(vendorRef, vendor);
  batch.set(doc(db, FIRESTORE_COLLECTIONS.vendorBranches, branchId), branch);
  batch.set(doc(db, FIRESTORE_COLLECTIONS.vendorWarehouses, warehouseId), warehouse);
  batch.set(doc(db, FIRESTORE_COLLECTIONS.vendorStaff, staffId), staff);
  batch.set(doc(db, FIRESTORE_COLLECTIONS.vendorAuditLogs, auditLog.auditLogId), auditLog);

  await batch.commit();

  return mapVendorData(vendorId, vendor);
}

export function saveVendorSessionFromFirebase(vendor: VendorRecord): void {
  const session = {
    vendorId: vendor.vendorId,
    ownerName: vendor.ownerName,
    ownerEmail: vendor.ownerEmail,
    vendorName: vendor.businessName || vendor.tradingName || vendor.vendorId,
    tradingName: vendor.tradingName,
    phone: vendor.phone,
    whatsapp: vendor.whatsapp,
    country: vendor.country,
    city: vendor.city,
    suburb: vendor.suburb,
    physicalAddress: vendor.physicalAddress,
    status: vendor.status,
    mode: vendor.mode,
    role: 'Owner',
    signedInAt: new Date().toISOString()
  };

  localStorage.setItem('sci_vendor_owner_session', JSON.stringify(session));

  const businessProfile = {
    legalName: vendor.businessName,
    tradingName: vendor.tradingName,
    ownerName: vendor.ownerName,
    ownerEmail: vendor.ownerEmail,
    businessPhone: vendor.phone,
    businessWhatsapp: vendor.whatsapp,
    country: vendor.country,
    city: vendor.city,
    suburb: vendor.suburb,
    address: vendor.physicalAddress,
    physicalAddress: vendor.physicalAddress,
    currency: 'USD'
  };

  localStorage.setItem('itred_pos_business_profile', JSON.stringify(businessProfile));
}

function mapVendorData(docId: string, data: Record<string, unknown>): VendorRecord {
  return {
    vendorId: (data.vendorId as string) || docId,
    businessName: (data.businessName as string) || (data.tradingName as string) || docId,
    tradingName: data.tradingName as string | undefined,
    ownerUid: data.ownerUid as string,
    ownerEmail: data.ownerEmail as string,
    ownerName: data.ownerName as string,
    phone: data.phone as string | undefined,
    whatsapp: data.whatsapp as string | undefined,
    country: data.country as string | undefined,
    city: data.city as string | undefined,
    suburb: data.suburb as string | undefined,
    physicalAddress: data.physicalAddress as string | undefined,
    status: data.status as string | undefined,
    mode: data.mode as string | undefined
  };
}
