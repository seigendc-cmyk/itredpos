import { collection, doc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/firebaseApp';

export interface ActivationTokenRecord {
  tokenId: string;
  vendorId: string;
  planCode: string;
  tokenCode: string;
  status: 'Unused' | 'Used' | 'Revoked' | string;
  issuedAt?: string;
  expiresAt: string;
  issuedBy?: string;
}

export interface ActivationTokenResult {
  ok: boolean;
  message: string;
  token?: ActivationTokenRecord;
  planCode?: string;
}

const OFFLINE_MESSAGE = 'Activation requires internet connection. Please connect and try again.';

function text(value: unknown, fallback = ''): string {
  const clean = String(value ?? '').trim();
  return clean || fallback;
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeTokenCode(value: string): string {
  return value.trim().toUpperCase();
}

function tokenFromDoc(data: Record<string, unknown>, docId: string): ActivationTokenRecord {
  return {
    tokenId: text(data.tokenId, docId),
    vendorId: text(data.vendorId),
    planCode: text(data.planCode, 'DEMO').toUpperCase(),
    tokenCode: text(data.tokenCode).toUpperCase(),
    status: text(data.status, 'Unused'),
    issuedAt: text(data.issuedAt),
    expiresAt: text(data.expiresAt),
    issuedBy: text(data.issuedBy)
  };
}

export async function validateActivationToken(tokenCode: string, vendorId: string): Promise<ActivationTokenResult> {
  if (!db) return { ok: false, message: OFFLINE_MESSAGE };

  const cleanToken = normalizeTokenCode(tokenCode);
  const cleanVendorId = text(vendorId);
  if (!cleanToken) return { ok: false, message: 'Enter an activation code.' };
  if (!cleanVendorId) return { ok: false, message: 'Vendor identity is missing. Please sign in again.' };

  try {
    const snapshot = await getDocs(query(
      collection(db, 'activationTokens'),
      where('tokenCode', '==', cleanToken),
      where('vendorId', '==', cleanVendorId),
      where('status', '==', 'Unused'),
      where('expiresAt', '>=', nowIso())
    ));

    const token = snapshot.docs
      .map((item) => tokenFromDoc(item.data() as Record<string, unknown>, item.id))
      .find((row) => row.expiresAt && Date.parse(row.expiresAt) >= Date.now());

    if (!token) return { ok: false, message: 'Activation code is invalid, used, or expired.' };
    return { ok: true, message: `Activation code valid for ${token.planCode}.`, token, planCode: token.planCode };
  } catch {
    return { ok: false, message: OFFLINE_MESSAGE };
  }
}

export async function redeemActivationToken(tokenCode: string, vendorId: string): Promise<ActivationTokenResult> {
  if (!db) return { ok: false, message: OFFLINE_MESSAGE };

  const validation = await validateActivationToken(tokenCode, vendorId);
  if (!validation.ok || !validation.token) return validation;

  const usedAt = nowIso();
  const token = validation.token;
  const batch = writeBatch(db);

  batch.set(doc(db, 'activationTokens', token.tokenId), {
    status: 'Used',
    usedAt,
    updatedAt: usedAt
  }, { merge: true });

  batch.set(doc(db, 'vendorLicenses', vendorId), {
    vendorId,
    planCode: token.planCode,
    planId: token.planCode,
    licenseStatus: 'Active',
    activationStatus: 'Active',
    activatedAt: usedAt,
    source: 'ACTIVATION_TOKEN',
    updatedAt: usedAt
  }, { merge: true });

  batch.set(doc(db, 'vendorPlans', vendorId), {
    vendorId,
    planCode: token.planCode,
    planId: token.planCode,
    activatedAt: usedAt,
    source: 'ACTIVATION_TOKEN',
    updatedAt: usedAt
  }, { merge: true });

  batch.set(doc(db, 'vendors', vendorId), {
    planCode: token.planCode,
    accountStatus: 'Active',
    updatedAt: usedAt
  }, { merge: true });

  await batch.commit();
  return {
    ok: true,
    message: `Activation complete. ${token.planCode} plan is active.`,
    token,
    planCode: token.planCode
  };
}
