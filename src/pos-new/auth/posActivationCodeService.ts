import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch
} from 'firebase/firestore';
import { db, firebaseReady } from '../firebase/firebaseApp';
import { FIRESTORE_COLLECTIONS } from '../../shared/backend';
import type {
  ActivationCodeRecord,
  POSActivationSnapshotLocal,
  POSActivationCodeResult
} from '../../shared/backend';

const POS_ACTIVATION_STORAGE_KEY = 'itred_pos_activation_snapshot';
const DEVICE_ID_STORAGE_KEY = 'itred_pos_device_id';

export function getDeviceId(): string {
  try {
    if (typeof localStorage === 'undefined') return crypto.randomUUID?.() || 'device-unknown';
    let id = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (!id) {
      id = crypto.randomUUID?.() || `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(DEVICE_ID_STORAGE_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID?.() || 'device-unknown';
  }
}

function canUseLocalStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

export function readLocalActivation(): POSActivationSnapshotLocal | null {
  if (!canUseLocalStorage()) return null;
  try {
    const raw = localStorage.getItem(POS_ACTIVATION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as POSActivationSnapshotLocal) : null;
  } catch {
    return null;
  }
}

export function saveLocalActivation(snapshot: POSActivationSnapshotLocal): void {
  if (!canUseLocalStorage()) return;
  try {
    localStorage.setItem(POS_ACTIVATION_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // ignore write failures
  }
}

export function clearLocalActivation(): void {
  if (!canUseLocalStorage()) return;
  try {
    localStorage.removeItem(POS_ACTIVATION_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function text(value: unknown, fallback = ''): string {
  return String(value ?? '').trim() || fallback;
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeCode(value: string): string {
  return value.trim().toUpperCase();
}

async function findActivationCode(code: string): Promise<{ codeId: string; data: Record<string, unknown> } | null> {
  const cleanCode = normalizeCode(code);
  const snapshot = await getDocs(query(
    collection(db!, FIRESTORE_COLLECTIONS.activationCodes),
    where('code', '==', cleanCode)
  ));

  if (snapshot.empty) return null;

  const docSnap = snapshot.docs[0];
  return { codeId: docSnap.id, data: docSnap.data() as Record<string, unknown> };
}

async function createAuditLog(vendorId: string, eventType: string, message: string): Promise<void> {
  if (!db) return;
  const auditRef = doc(collection(db!, FIRESTORE_COLLECTIONS.vendorAuditLogs));
  const batch = writeBatch(db!);
  batch.set(auditRef, {
    auditLogId: auditRef.id,
    vendorId,
    eventType,
    message,
    createdAt: nowIso(),
    updatedAt: nowIso()
  });
  await batch.commit();
}

export async function validateActivationCode(code: string): Promise<POSActivationCodeResult> {
  if (!firebaseReady || !db) {
    return { ok: false, message: 'Internet connection is required to validate the activation code.' };
  }

  const cleanCode = normalizeCode(code);
  if (!cleanCode) {
    return { ok: false, message: 'Activation code is required.' };
  }

  try {
    const found = await findActivationCode(cleanCode);
    if (!found) {
      return { ok: false, message: 'Invalid activation code.' };
    }

    const data = found.data;
    const status = text(data.status, 'unused').toLowerCase();
    const expiresAt = text(data.expiresAt);
    const vendorId = text(data.vendorId);
    const planCode = text(data.planCode, 'DEMO').toUpperCase();
    const licenseMode = text(data.licenseMode, 'trial').toLowerCase();
    const features = (data.features && typeof data.features === 'object') ? data.features as Record<string, boolean> : {};
    const maxDevices = typeof data.maxDevices === 'number' ? data.maxDevices : 1;
    const activatedDevices = typeof data.activatedDevices === 'number' ? data.activatedDevices : 0;

    if (status === 'revoked') {
      await createAuditLog(vendorId, 'POS_ACTIVATION_FAILED', `Revoked activation code rejected: ${cleanCode}`);
      return { ok: false, message: 'Activation code has been revoked.' };
    }

    if (status === 'expired') {
      await createAuditLog(vendorId, 'POS_ACTIVATION_FAILED', `Expired activation code rejected: ${cleanCode}`);
      return { ok: false, message: 'Activation code has expired.' };
    }

    if (status === 'consumed') {
      await createAuditLog(vendorId, 'POS_ACTIVATION_FAILED', `Consumed activation code rejected: ${cleanCode}`);
      return { ok: false, message: 'Activation code has already been fully consumed.' };
    }

    if (expiresAt && Date.parse(expiresAt) < Date.now()) {
      await createAuditLog(vendorId, 'POS_ACTIVATION_FAILED', `Expired activation code rejected: ${cleanCode}`);
      return { ok: false, message: 'Activation code has expired.' };
    }

    if (!features.posAccess) {
      await createAuditLog(vendorId, 'POS_ACTIVATION_FAILED', `POS access not enabled for code: ${cleanCode}`);
      return { ok: false, message: 'This activation code does not enable POS access.' };
    }

    if (activatedDevices >= maxDevices) {
      await createAuditLog(vendorId, 'POS_ACTIVATION_FAILED', `Device limit reached for code: ${cleanCode}`);
      return { ok: false, message: 'Activation code device limit reached.' };
    }

    const codeRecord: ActivationCodeRecord = {
      codeId: found.codeId,
      code: cleanCode,
      vendorId,
      vendorName: text(data.vendorName, vendorId),
      planCode: planCode as ActivationCodeRecord['planCode'],
      licenseMode: licenseMode as ActivationCodeRecord['licenseMode'],
      status: status as ActivationCodeRecord['status'],
      features: {
        posAccess: Boolean(features.posAccess),
        inventory: Boolean(features.inventory),
        sales: Boolean(features.sales),
        reports: Boolean(features.reports)
      },
      maxDevices,
      activatedDevices,
      expiresAt,
      createdAt: text(data.createdAt, nowIso()),
      createdBy: text(data.createdBy, 'system'),
      consumedAt: data.consumedAt ? text(data.consumedAt) : undefined,
      consumedByDeviceId: data.consumedByDeviceId ? text(data.consumedByDeviceId) : undefined,
      metadata: data.metadata && typeof data.metadata === 'object' ? (data.metadata as Record<string, unknown>) : undefined
    };

    return { ok: true, message: `Activation code valid for ${planCode}.`, codeRecord };
  } catch {
    return { ok: false, message: 'Activation could not be completed. Please try again.' };
  }
}

export async function consumeActivationCode(
  code: string,
  deviceId: string
): Promise<POSActivationCodeResult> {
  if (!firebaseReady || !db) {
    return { ok: false, message: 'Internet connection is required to activate POS.' };
  }

  const cleanCode = normalizeCode(code);
  if (!cleanCode) {
    return { ok: false, message: 'Activation code is required.' };
  }

  try {
    const validation = await validateActivationCode(cleanCode);
    if (!validation.ok || !validation.codeRecord) {
      return validation;
    }

    const codeRecord = validation.codeRecord;
    const now = nowIso();
    const newActivatedDevices = codeRecord.activatedDevices + 1;
    const isFullyConsumed = newActivatedDevices >= codeRecord.maxDevices;
    const newStatus: ActivationCodeRecord['status'] = isFullyConsumed ? 'consumed' : 'active';

    const codeRef = doc(db!, FIRESTORE_COLLECTIONS.activationCodes, codeRecord.codeId);
    const licenseRef = doc(db!, FIRESTORE_COLLECTIONS.vendorLicenses, codeRecord.vendorId);
    const planRef = doc(db!, FIRESTORE_COLLECTIONS.vendorPlans, codeRecord.vendorId);
    const vendorRef = doc(db!, FIRESTORE_COLLECTIONS.vendors, codeRecord.vendorId);

    const batch = writeBatch(db!);

    batch.update(codeRef, {
      activatedDevices: newActivatedDevices,
      status: newStatus,
      consumedAt: isFullyConsumed ? now : codeRecord.consumedAt,
      consumedByDeviceId: isFullyConsumed ? deviceId : codeRecord.consumedByDeviceId,
      updatedAt: now
    });

    batch.set(licenseRef, {
      planCode: codeRecord.planCode,
      planId: codeRecord.planCode,
      licenseStatus: 'Active',
      activationStatus: 'Active',
      licenseMode: codeRecord.licenseMode,
      activatedAt: now,
      updatedAt: now
    }, { merge: true });

    batch.set(planRef, {
      planCode: codeRecord.planCode,
      planId: codeRecord.planCode,
      activatedAt: now,
      updatedAt: now
    }, { merge: true });

    batch.set(vendorRef, {
      planCode: codeRecord.planCode,
      accountStatus: 'Active',
      updatedAt: now
    }, { merge: true });

    const auditRef = doc(collection(db!, FIRESTORE_COLLECTIONS.vendorAuditLogs));
    batch.set(auditRef, {
      auditLogId: auditRef.id,
      vendorId: codeRecord.vendorId,
      eventType: 'POS_ACTIVATION_SUCCESS',
      message: `POS activated with code ${cleanCode} on device ${deviceId}. Plan: ${codeRecord.planCode}.`,
      performedBy: deviceId,
      createdAt: now,
      updatedAt: now
    });

    await batch.commit();

    const snapshot: POSActivationSnapshotLocal = {
      vendorId: codeRecord.vendorId,
      vendorName: codeRecord.vendorName,
      planCode: codeRecord.planCode,
      licenseMode: codeRecord.licenseMode,
      activationCodeId: codeRecord.codeId,
      activatedAt: now,
      expiresAt: codeRecord.expiresAt,
      features: codeRecord.features,
      deviceId,
      licenseStatusKnown: true
    };

    saveLocalActivation(snapshot);

    return {
      ok: true,
      message: 'POS activated successfully. Redirecting to Staff Access...',
      snapshot,
      codeRecord
    };
  } catch {
    return { ok: false, message: 'Activation could not be completed. Please try again.' };
  }
}

export async function hasValidPOSActivation(): Promise<boolean> {
  const snapshot = readLocalActivation();
  if (!snapshot) return false;

  if (snapshot.expiresAt && Date.parse(snapshot.expiresAt) < Date.now()) {
    clearLocalActivation();
    return false;
  }

  return snapshot.features.posAccess === true && snapshot.licenseStatusKnown === true;
}
