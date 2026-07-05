import { collection, doc, getDocs, query, where, runTransaction } from 'firebase/firestore';
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

const OFFLINE_MESSAGE = 'Internet connection is required to activate your subscription.';

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
  if (!cleanToken) return { ok: false, message: 'Invalid activation code.' };
  if (!cleanVendorId) return { ok: false, message: 'Vendor identity is missing.' };

  try {
    const snapshot = await getDocs(query(
      collection(db, 'activationTokens'),
      where('tokenCode', '==', cleanToken)
    ));

    if (snapshot.empty) {
      return { ok: false, message: 'Invalid activation code.' };
    }

    const token = tokenFromDoc(snapshot.docs[0].data() as Record<string, unknown>, snapshot.docs[0].id);

    if (token.status === 'Revoked') {
      return { ok: false, message: 'Activation code has been revoked.' };
    }
    if (token.status === 'Used') {
      return { ok: false, message: 'Activation code has already been used.' };
    }
    if (token.vendorId !== cleanVendorId) {
      return { ok: false, message: 'Activation code belongs to another vendor.' };
    }
    if (token.expiresAt && Date.parse(token.expiresAt) < Date.now()) {
      return { ok: false, message: 'Activation code has expired.' };
    }
    if (!token.planCode) {
      return { ok: false, message: 'Invalid activation code.' };
    }

    return { ok: true, message: `Activation code valid for ${token.planCode}.`, token, planCode: token.planCode };
  } catch {
    return { ok: false, message: 'Activation could not be completed.\nPlease try again.' };
  }
}

export async function redeemActivationToken(tokenCode: string, vendorId: string): Promise<ActivationTokenResult> {
  if (!db) return { ok: false, message: OFFLINE_MESSAGE };

  const cleanToken = normalizeTokenCode(tokenCode);
  const cleanVendorId = text(vendorId);
  if (!cleanToken) return { ok: false, message: 'Invalid activation code.' };
  if (!cleanVendorId) return { ok: false, message: 'Vendor identity is missing.' };

  try {
    // 1. Query token first to find doc reference
    const snapshot = await getDocs(query(
      collection(db, 'activationTokens'),
      where('tokenCode', '==', cleanToken)
    ));

    if (snapshot.empty) {
      return { ok: false, message: 'Invalid activation code.' };
    }

    const tokenDocRef = snapshot.docs[0].ref;

    // 2. Run transaction for atomic validation and updates
    const transactionResult = await runTransaction(db, async (transaction) => {
      const tokenSnap = await transaction.get(tokenDocRef);
      if (!tokenSnap.exists()) {
        return { ok: false, message: 'Invalid activation code.' };
      }

      const data = tokenSnap.data();
      const status = text(data.status, 'Unused');
      const tokenVendorId = text(data.vendorId);
      const planCode = text(data.planCode, 'DEMO').toUpperCase();
      const expiresAt = text(data.expiresAt);

      // Perform all validations in the transaction to prevent race conditions
      if (status === 'Revoked') {
        return { ok: false, message: 'Activation code has been revoked.' };
      }
      if (status === 'Used') {
        return { ok: false, message: 'Activation code has already been used.' };
      }
      if (tokenVendorId !== cleanVendorId) {
        return { ok: false, message: 'Activation code belongs to another vendor.' };
      }
      if (expiresAt && Date.parse(expiresAt) < Date.now()) {
        return { ok: false, message: 'Activation code has expired.' };
      }
      if (!planCode) {
        return { ok: false, message: 'Invalid activation code.' };
      }

      const usedAt = nowIso();

      // Update Token
      transaction.update(tokenDocRef, {
        status: 'Used',
        usedAt,
        usedByVendor: cleanVendorId,
        updatedAt: usedAt
      });

      // Update License
      const licenseRef = doc(db, 'vendorLicenses', cleanVendorId);
      transaction.set(licenseRef, {
        planCode,
        planId: planCode,
        licenseStatus: 'Active',
        activationStatus: 'Active',
        activatedAt: usedAt,
        updatedAt: usedAt
      }, { merge: true });

      // Update Plan
      const planRef = doc(db, 'vendorPlans', cleanVendorId);
      transaction.set(planRef, {
        planCode,
        planId: planCode,
        activatedAt: usedAt,
        updatedAt: usedAt
      }, { merge: true });

      // Update Vendor
      const vendorRef = doc(db, 'vendors', cleanVendorId);
      transaction.set(vendorRef, {
        planCode,
        accountStatus: 'Active',
        updatedAt: usedAt
      }, { merge: true });

      // Create Audit Log
      const auditLogRef = doc(collection(db, 'vendorAuditLogs'));
      transaction.set(auditLogRef, {
        auditLogId: auditLogRef.id,
        vendorId: cleanVendorId,
        planCode,
        tokenCode: cleanToken,
        eventType: 'ACTIVATION_CODE_REDEEMED',
        performedBy: 'Vendor POS Client',
        createdAt: usedAt,
        updatedAt: usedAt
      });

      const tokenRecord: ActivationTokenRecord = {
        tokenId: tokenSnap.id,
        vendorId: tokenVendorId,
        planCode,
        tokenCode: cleanToken,
        status: 'Used',
        expiresAt
      };

      return {
        ok: true,
        message: 'Subscription Activated Successfully',
        token: tokenRecord,
        planCode
      };
    });

    return transactionResult;
  } catch (err) {
    console.error('Redemption failed:', err);
    return { ok: false, message: 'Activation could not be completed.\nPlease try again.' };
  }
}
