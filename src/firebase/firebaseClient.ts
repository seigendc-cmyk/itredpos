import { app, auth, db, firebaseInitStatus, firebaseReady, storage } from '../pos-new/firebase/firebaseApp';
import { getFirebaseConfigStatus } from '../pos-new/firebase/firebaseConfig';

export type FirestoreMode = 'localPrototype' | 'firestoreRead' | 'firestoreWrite';

export interface SCIFirebaseReadiness {
  configured: boolean;
  statusLabel: 'CONFIGURED' | 'NOT_CONFIGURED';
  projectId: string;
  authDomain: string;
  missingKeys: string[];
  appInitialized: boolean;
  authReady: boolean;
  firestoreReady: boolean;
  storageReady: boolean;
  firebaseReady: boolean;
  measurementId: string;
  warnings: string[];
}

export function initializeSCIFirebase(): SCIFirebaseReadiness {
  const config = getFirebaseConfigStatus();
  return {
    configured: config.configured,
    statusLabel: config.configured ? 'CONFIGURED' : 'NOT_CONFIGURED',
    projectId: config.projectId,
    authDomain: config.authDomain,
    missingKeys: config.missingKeys,
    appInitialized: Boolean(app) && firebaseInitStatus.appInitialized,
    authReady: Boolean(auth) && firebaseInitStatus.authAvailable,
    firestoreReady: Boolean(db) && firebaseInitStatus.firestoreAvailable,
    storageReady: Boolean(storage) && firebaseInitStatus.storageAvailable,
    firebaseReady,
    measurementId: config.measurementId,
    warnings: firebaseInitStatus.warningMessages
  };
}

const FIRESTORE_MODE_KEY = 'sci_platform_firestore_mode';

const canUseLocalStorage = (): boolean => {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
};

export function getFirestoreMode(): FirestoreMode {
  if (!canUseLocalStorage()) return 'localPrototype';
  const stored = localStorage.getItem(FIRESTORE_MODE_KEY);
  return stored === 'firestoreRead' || stored === 'firestoreWrite' ? stored : 'localPrototype';
}

export function setFirestoreMode(mode: FirestoreMode): FirestoreMode {
  if (canUseLocalStorage()) {
    localStorage.setItem(FIRESTORE_MODE_KEY, mode);
  }
  return mode;
}

export function getFirestoreModeStatus(mode = getFirestoreMode(), readiness = initializeSCIFirebase()) {
  return {
    mode,
    environmentMode: import.meta.env.MODE || 'development',
    readsAllowed: mode === 'firestoreRead' || mode === 'firestoreWrite',
    writesAllowed: mode === 'firestoreWrite',
    productionActionsEnabled: mode === 'firestoreWrite' && readiness.configured,
    canSelectReadMode: readiness.configured,
    canSelectWriteMode: readiness.configured,
    currentModeLabel: mode === 'localPrototype'
      ? 'Local Prototype Mode'
      : mode === 'firestoreRead'
        ? 'Firestore Read Mode'
        : 'Firestore Write Mode'
  };
}
