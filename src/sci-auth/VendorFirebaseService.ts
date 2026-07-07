import {
  collection,
  getDocs,
  query,
  where,
  limit
} from 'firebase/firestore';
import { db } from '../pos-new/firebase/firebaseApp';

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

export async function findVendorByGoogleAccount(profile: { uid: string; email?: string }): Promise<VendorRecord | null> {
  if (!db) return null;

  const uid = profile.uid;
  const email = profile.email?.toLowerCase() || '';

  const q1 = query(collection(db, 'vendors'), where('ownerUid', '==', uid), limit(1));
  const snap1 = await getDocs(q1);
  if (!snap1.empty) {
    const data = snap1.docs[0].data();
    return mapVendorData(snap1.docs[0].id, data);
  }

  if (email) {
    const q2 = query(collection(db, 'vendors'), where('ownerEmail', '==', email), limit(1));
    const snap2 = await getDocs(q2);
    if (!snap2.empty) {
      const data = snap2.docs[0].data();
      return mapVendorData(snap2.docs[0].id, data);
    }
  }

  return null;
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
