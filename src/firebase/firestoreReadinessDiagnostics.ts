import { initializeSCIFirebase, getFirestoreModeStatus, type FirestoreMode } from './firebaseClient';
import { firestoreDataContracts } from '../pos-new/firebase/firestoreDataRegistry';
import { moduleRepositoryDescriptors } from '../pos-new/repositories/moduleRepositoryRegistry';
import {
  mockStaff,
  mockVendors,
  mockVendorPOSLicense,
  mockVendorPOSSubscription,
  mockPOSPlans
} from '../pos-new/mock/mockPosData';

export type ReadinessStatus = 'READY' | 'NOT_CONFIGURED' | 'LOCAL_ONLY' | 'WRITE_PROTECTED' | 'BLOCKED';

export interface FirestoreReadinessDiagnostic {
  name: string;
  status: ReadinessStatus;
  message: string;
}

export interface FirestoreSeedPreviewRow {
  collectionName: string;
  recordCount: number;
  writeProtected: boolean;
  message: string;
}

export interface FirestoreSeedWriteResult {
  ok: boolean;
  blocked: boolean;
  reason: string;
  message: string;
  attemptedAt: string;
}

export interface PlatformAuditEvent {
  id: string;
  eventType: string;
  message: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface PlatformNotification {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  severity: 'info' | 'success' | 'warning';
}

const AUDIT_KEY = 'sci_platform_firebase_audit';
const NOTIFICATION_KEY = 'sci_platform_firebase_notifications';

const nowIso = () => new Date().toISOString();
const makeId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const canUseLocalStorage = (): boolean => {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
};

const readJson = <T>(key: string, fallback: T): T => {
  if (!canUseLocalStorage()) return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key: string, value: unknown): void => {
  if (!canUseLocalStorage()) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local diagnostics must remain non-blocking.
  }
};

export function recordPlatformFirebaseAudit(eventType: string, message: string, metadata?: Record<string, unknown>): PlatformAuditEvent {
  const event: PlatformAuditEvent = { id: makeId('PFA'), eventType, message, createdAt: nowIso(), metadata };
  const rows = readJson<PlatformAuditEvent[]>(AUDIT_KEY, []);
  writeJson(AUDIT_KEY, [event, ...rows].slice(0, 200));
  return event;
}

export function createPlatformFirebaseNotification(title: string, message: string, severity: PlatformNotification['severity'] = 'info'): PlatformNotification {
  const notification: PlatformNotification = { id: makeId('PFN'), title, message, severity, createdAt: nowIso() };
  const rows = readJson<PlatformNotification[]>(NOTIFICATION_KEY, []);
  writeJson(NOTIFICATION_KEY, [notification, ...rows].slice(0, 120));
  return notification;
}

export function getPlatformFirebaseAuditEvents(): PlatformAuditEvent[] {
  return readJson<PlatformAuditEvent[]>(AUDIT_KEY, []);
}

export function getPlatformFirebaseNotifications(): PlatformNotification[] {
  return readJson<PlatformNotification[]>(NOTIFICATION_KEY, []);
}

export function notifyFirebaseConfigState(): PlatformNotification {
  const readiness = initializeSCIFirebase();
  if (readiness.configured) {
    return createPlatformFirebaseNotification('Firebase config ready', `Project ${readiness.projectId} is configured.`, 'success');
  }
  return createPlatformFirebaseNotification('Firebase config missing', `${readiness.missingKeys.length} Firebase environment key(s) are missing.`, 'warning');
}

export function runFirestoreReadinessDiagnostics(mode?: FirestoreMode): FirestoreReadinessDiagnostic[] {
  const readiness = initializeSCIFirebase();
  const modeStatus = getFirestoreModeStatus(mode, readiness);
  const repositoryCount = moduleRepositoryDescriptors.length;
  const contractCount = firestoreDataContracts.length;

  recordPlatformFirebaseAudit('FIRESTORE_DIAGNOSTICS_RUN', 'Firebase readiness diagnostics were run.', {
    mode: modeStatus.mode,
    configured: readiness.configured,
    repositoryCount,
    contractCount
  });

  return [
    {
      name: 'Firebase Configuration',
      status: readiness.configured ? 'READY' : 'NOT_CONFIGURED',
      message: readiness.configured
        ? `Configured for ${readiness.projectId} (${readiness.authDomain}).`
        : `Missing keys: ${readiness.missingKeys.join(', ') || 'unknown'}.`
    },
    {
      name: 'Firestore Repository Provider',
      status: readiness.firestoreReady ? (modeStatus.readsAllowed ? 'READY' : 'LOCAL_ONLY') : 'NOT_CONFIGURED',
      message: readiness.firestoreReady
        ? `${repositoryCount} repository descriptor(s) available. Current mode: ${modeStatus.currentModeLabel}.`
        : 'Firestore is not initialized.'
    },
    {
      name: 'Internal Staff Repository',
      status: readiness.configured ? (modeStatus.readsAllowed ? 'READY' : 'LOCAL_ONLY') : 'NOT_CONFIGURED',
      message: `${mockStaff.length} local staff seed record(s). ${modeStatus.readsAllowed ? 'Firestore reads are allowed.' : 'Local prototype remains authoritative.'}`
    },
    {
      name: 'Licensing Repository',
      status: readiness.configured ? 'WRITE_PROTECTED' : 'NOT_CONFIGURED',
      message: `License and subscription preview records are available. Writes are ${modeStatus.writesAllowed ? 'visible but warning-gated' : 'disabled'}.`
    },
    {
      name: 'Vendor Repository',
      status: readiness.configured ? (modeStatus.readsAllowed ? 'READY' : 'LOCAL_ONLY') : 'NOT_CONFIGURED',
      message: `${mockVendors.length} vendor seed record(s). ${contractCount} Firestore data contract(s) mapped.`
    }
  ];
}

export function exportFirestoreSeedPreview(mode?: FirestoreMode): FirestoreSeedPreviewRow[] {
  const modeStatus = getFirestoreModeStatus(mode);
  const writeProtected = !modeStatus.writesAllowed;
  return [
    {
      collectionName: 'vendors',
      recordCount: mockVendors.length,
      writeProtected,
      message: writeProtected ? 'Vendor seed is preview-only in the current mode.' : 'Vendor seed is warning-gated for write mode.'
    },
    {
      collectionName: 'staff',
      recordCount: mockStaff.length,
      writeProtected,
      message: writeProtected ? 'Internal staff seed is preview-only in the current mode.' : 'Internal staff seed is warning-gated for write mode.'
    },
    {
      collectionName: 'licensing',
      recordCount: [mockVendorPOSLicense, mockVendorPOSSubscription, ...mockPOSPlans].filter(Boolean).length,
      writeProtected,
      message: writeProtected ? 'Licensing seed remains protected.' : 'Licensing seed write attempt requires audit confirmation.'
    },
    {
      collectionName: 'repositoryContracts',
      recordCount: firestoreDataContracts.length,
      writeProtected: true,
      message: 'Repository contract rows are diagnostics only and are never written as seed data.'
    }
  ];
}

export function runFirestoreSeedPreviewDiagnostics(mode?: FirestoreMode): FirestoreSeedPreviewRow[] {
  const preview = exportFirestoreSeedPreview(mode);
  recordPlatformFirebaseAudit('FIRESTORE_SEED_PREVIEW_OPENED', 'Firestore seed preview was generated.', {
    collections: preview.map((row) => row.collectionName),
    recordCount: preview.reduce((sum, row) => sum + row.recordCount, 0)
  });
  createPlatformFirebaseNotification('Seed preview generated', `${preview.length} collection preview(s) are ready.`, 'success');
  return preview;
}

export function writeFirestoreSeedPreviewOnly(mode?: FirestoreMode): FirestoreSeedWriteResult {
  const modeStatus = getFirestoreModeStatus(mode);
  const attemptedAt = nowIso();

  if (!modeStatus.writesAllowed) {
    const reason = 'Firestore Write Mode is not active.';
    recordPlatformFirebaseAudit('FIRESTORE_SEED_WRITE_BLOCKED', reason, { mode: modeStatus.mode });
    return {
      ok: false,
      blocked: true,
      reason,
      message: 'Seed write is disabled until Firestore Write Mode is active.',
      attemptedAt
    };
  }

  recordPlatformFirebaseAudit('FIRESTORE_SEED_WRITE_ATTEMPTED', 'Firestore seed write was attempted from the readiness page.', {
    mode: modeStatus.mode,
    productionActionsEnabled: modeStatus.productionActionsEnabled
  });

  return {
    ok: true,
    blocked: false,
    reason: 'AUDIT_CREATED_PREVIEW_ONLY',
    message: 'Seed write attempt was audited. This build keeps the seed writer preview-only; no Firestore documents were written.',
    attemptedAt
  };
}
