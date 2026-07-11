import {
  collection,
  getDocs,
  query,
  where,
  limit,
  doc,
  writeBatch
} from 'firebase/firestore';
import { db } from '../pos-new/firebase/firebaseApp';
import { FIRESTORE_COLLECTIONS } from '../shared/backend';

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
  const ownerEmail = (draft.ownerEmail.trim() || profile.email || '').toLowerCase();

  const vendorRef = doc(db, FIRESTORE_COLLECTIONS.vendors, vendorId);
  const branchId = `${vendorId}_main_branch`;
  const warehouseId = `${vendorId}_main_warehouse`;
  const staffId = `${vendorId}_owner`;
  const terminalId = `${vendorId}_main_terminal`;
  const licenseId = `${vendorId}_demo_license`;

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
    planCode: 'DEMO',
    licenseStatus: 'DEMO',
    mode: 'Demo',
    createdAt: now,
    updatedAt: now
  };

  const vendorUser = {
    uid: profile.uid,
    vendorId,
    email: ownerEmail,
    displayName: ownerName,
    role: 'Owner',
    status: 'active',
    permissions: ['*'],
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
    id: staffId,
    vendorId,
    staffId,
    branchId,
    name: ownerName,
    displayName: ownerName,
    email: ownerEmail,
    staffCode: 'OWNER',
    roleId: 'owner',
    roleName: 'Owner',
    phone: draft.phone || '',
    whatsapp: draft.whatsapp || '',
    role: 'Owner' as const,
    status: 'Active' as const,
    pin: '040369',
    pinCode: '040369',
    permissions: ['*'],
    assignedTerminalIds: [terminalId],
    source: 'simple-auth',
    createdAt: now,
    updatedAt: now
  };

  const terminal = {
    terminalId,
    vendorId,
    branchId,
    warehouseId,
    terminalName: 'Main POS Terminal',
    status: 'Active',
    createdAt: now,
    updatedAt: now
  };

  const license = {
    licenseId,
    vendorId,
    planCode: 'DEMO',
    licenseStatus: 'DEMO',
    licenseMode: 'demo',
    status: 'Active',
    createdAt: now,
    updatedAt: now
  };

  const vendorSettings = {
    vendorId,
    vatEnabled: false,
    vatRegistered: false,
    vatNumber: '',
    defaultVatRate: 0,
    pricesIncludeVat: true,
    outputTaxAccountId: '',
    inputTaxAccountId: '',
    exemptTaxCode: 'EXEMPT',
    zeroRatedTaxCode: 'ZERO',
    updatedAt: now,
    updatedBy: profile.uid,
    createdAt: now
  };

  const phase1Batch = writeBatch(db);
  phase1Batch.set(vendorRef, vendor);
  phase1Batch.set(doc(db, 'vendorUsers', profile.uid), vendorUser);
  await phase1Batch.commit();

  const phase2Batch = writeBatch(db);
  phase2Batch.set(doc(db, 'branches', branchId), branch);
  phase2Batch.set(doc(db, 'warehouses', warehouseId), warehouse);
  phase2Batch.set(doc(db, 'staff', staffId), staff);
  phase2Batch.set(doc(db, 'pos_terminals', terminalId), terminal);
  phase2Batch.set(doc(db, 'licenses', licenseId), license);
  phase2Batch.set(doc(db, 'vendor_settings', vendorId), vendorSettings);
  await phase2Batch.commit();

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
    vendorId: vendor.vendorId,
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
