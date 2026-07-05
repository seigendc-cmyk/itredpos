import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  writeBatch
} from 'firebase/firestore';
import { db, firebaseReady } from '../pos-new/firebase/firebaseApp';
import {
  FIRESTORE_COLLECTIONS
} from '../shared/backend';
import type {
  ActivationTokenRecord,
  VendorAuditLogRecord,
  PlanCode
} from '../shared/backend';

function checkFirebaseReady(): void {
  if (!firebaseReady || !db) {
    throw new Error('Firebase client is not initialized or database is unavailable.');
  }
}

function generateTokenCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const part1 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const part2 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `POS-${part1}-${part2}`;
}

export async function listActivationTokens(): Promise<ActivationTokenRecord[]> {
  checkFirebaseReady();
  const q = query(
    collection(db!, FIRESTORE_COLLECTIONS.activationTokens),
    orderBy('issuedAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as ActivationTokenRecord);
}

export async function issueActivationToken(
  vendorId: string,
  planCode: PlanCode,
  expiryDays: number,
  issuedBy: string,
  note?: string
): Promise<ActivationTokenRecord> {
  checkFirebaseReady();
  const now = new Date().toISOString();

  // 1. Duplicate Guard: Check duplicate active unused token
  const q = query(
    collection(db!, FIRESTORE_COLLECTIONS.activationTokens),
    where('vendorId', '==', vendorId),
    where('planCode', '==', planCode),
    where('status', '==', 'Unused')
  );
  const snapshot = await getDocs(q);
  const duplicate = snapshot.docs.some(doc => {
    const data = doc.data();
    return data.expiresAt && data.expiresAt > now;
  });
  if (duplicate) {
    throw new Error(`This vendor already has an active unused activation code for ${planCode}.`);
  }

  // 2. Fetch vendor name & profile details
  let vendorName = vendorId;
  try {
    const vendorRef = doc(db!, FIRESTORE_COLLECTIONS.vendors, vendorId);
    const vendorSnap = await getDoc(vendorRef);
    if (vendorSnap.exists()) {
      const data = vendorSnap.data();
      vendorName = data.businessName || data.tradingName || vendorId;
    } else {
      const regRef = doc(db!, FIRESTORE_COLLECTIONS.vendorRegistrations, vendorId);
      const regSnap = await getDoc(regRef);
      if (regSnap.exists()) {
        const data = regSnap.data();
        vendorName = data.businessName || data.tradingName || vendorId;
      }
    }
  } catch (err) {
    console.warn('Failed to load vendor details, falling back to ID:', err);
  }

  // 3. Generate token details
  const tokenId = doc(collection(db!, FIRESTORE_COLLECTIONS.activationTokens)).id;
  const tokenCode = generateTokenCode();
  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString();

  const tokenDoc: ActivationTokenRecord = {
    tokenId,
    tokenCode,
    vendorId,
    planCode,
    status: 'Unused',
    issuedAt: now,
    expiresAt,
    issuedBy,
    createdAt: now,
    updatedAt: now
  };
  
  if (note) {
    (tokenDoc as any).note = note;
  }

  const batch = writeBatch(db!);
  batch.set(doc(db!, FIRESTORE_COLLECTIONS.activationTokens, tokenId), tokenDoc);

  // Write audit log
  const auditLogRef = doc(collection(db!, FIRESTORE_COLLECTIONS.vendorAuditLogs));
  const auditLogDoc: VendorAuditLogRecord = {
    auditLogId: auditLogRef.id,
    vendorId,
    eventType: 'IssueActivationToken',
    message: `Activation code generated: ${tokenCode} (Expires: ${new Date(expiresAt).toLocaleDateString()})`,
    performedBy: issuedBy,
    createdAt: now,
    updatedAt: now
  };
  batch.set(auditLogRef, auditLogDoc);

  await batch.commit();
  return tokenDoc;
}

export async function revokeActivationToken(tokenId: string, revokedBy: string): Promise<void> {
  checkFirebaseReady();
  const now = new Date().toISOString();

  const tokenRef = doc(db!, FIRESTORE_COLLECTIONS.activationTokens, tokenId);
  const tokenSnap = await getDoc(tokenRef);
  if (!tokenSnap.exists()) {
    throw new Error('Token document not found.');
  }

  const token = tokenSnap.data() as ActivationTokenRecord;
  if (token.status !== 'Unused') {
    throw new Error(`Cannot revoke a token with status "${token.status}".`);
  }

  const batch = writeBatch(db!);
  batch.update(tokenRef, {
    status: 'Revoked',
    revokedAt: now,
    updatedAt: now
  });

  const auditLogRef = doc(collection(db!, FIRESTORE_COLLECTIONS.vendorAuditLogs));
  const auditLogDoc: VendorAuditLogRecord = {
    auditLogId: auditLogRef.id,
    vendorId: token.vendorId,
    eventType: 'RevokeActivationToken',
    message: `Activation code revoked: ${token.tokenCode}`,
    performedBy: revokedBy,
    createdAt: now,
    updatedAt: now
  };
  batch.set(auditLogRef, auditLogDoc);

  await batch.commit();
}

export async function getVendorForToken(vendorId: string): Promise<{ businessName: string; whatsapp?: string; phone?: string; city?: string; suburb?: string } | null> {
  checkFirebaseReady();
  try {
    const regRef = doc(db!, FIRESTORE_COLLECTIONS.vendorRegistrations, vendorId);
    const regSnap = await getDoc(regRef);
    if (regSnap.exists()) {
      const data = regSnap.data();
      return {
        businessName: data.businessName || data.tradingName || vendorId,
        whatsapp: data.whatsapp || data.phone || '',
        phone: data.phone || '',
        city: data.city || '',
        suburb: data.suburb || ''
      };
    }
    const vendorRef = doc(db!, FIRESTORE_COLLECTIONS.vendors, vendorId);
    const vendorSnap = await getDoc(vendorRef);
    if (vendorSnap.exists()) {
      const data = vendorSnap.data();
      return {
        businessName: data.businessName || data.tradingName || vendorId,
        whatsapp: data.whatsapp || data.phone || '',
        phone: data.phone || '',
        city: data.city || '',
        suburb: data.suburb || ''
      };
    }
  } catch (err) {
    console.error('Failed to get vendor details:', err);
  }
  return null;
}

export async function listTokenEligibleVendors(): Promise<{ vendorId: string; vendorName: string }[]> {
  checkFirebaseReady();
  const snapshot = await getDocs(collection(db!, FIRESTORE_COLLECTIONS.vendorRegistrations));
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      vendorId: doc.id,
      vendorName: data.businessName || data.tradingName || doc.id
    };
  });
}

export async function listTokenEligiblePlans(): Promise<PlanCode[]> {
  return ['STARTER', 'STANDARD', 'PRO', 'ENTERPRISE'];
}
