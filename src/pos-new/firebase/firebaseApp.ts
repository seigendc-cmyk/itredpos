import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { firebaseConfig, getFirebaseConfigStatus, isFirebaseConfigured } from './firebaseConfig';

export interface FirebaseInitStatus {
  configured: boolean;
  appInitialized: boolean;
  firestoreAvailable: boolean;
  authAvailable: boolean;
  storageAvailable: boolean;
  missingKeys: string[];
  warningMessages: string[];
}

let initializedApp: FirebaseApp | null = null;
let initializedDb: Firestore | null = null;
let initializedAuth: Auth | null = null;
let initializedStorage: FirebaseStorage | null = null;
const warnings: string[] = [];

if (isFirebaseConfigured) {
  try {
    initializedApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    initializedDb = getFirestore(
  initializedApp,
  import.meta.env.VITE_FIREBASE_DATABASE_ID || undefined
);
    initializedAuth = getAuth(initializedApp);
    initializedStorage = getStorage(initializedApp);
  } catch {
    warnings.push('Cloud services could not initialize. POS will continue with the offline workspace.');
    initializedApp = null;
    initializedDb = null;
    initializedAuth = null;
    initializedStorage = null;
  }
} else {
  warnings.push('Cloud configuration is incomplete. POS will continue with the offline workspace.');
}

const configStatus = getFirebaseConfigStatus();

export const app = initializedApp;
export const db = initializedDb;
export const auth = initializedAuth;
export const storage = initializedStorage;
export const firebaseReady = Boolean(app && db && auth && storage);

export const firebaseInitStatus: FirebaseInitStatus = {
  configured: configStatus.configured,
  appInitialized: Boolean(app),
  firestoreAvailable: Boolean(db),
  authAvailable: Boolean(auth),
  storageAvailable: Boolean(storage),
  missingKeys: configStatus.missingKeys,
  warningMessages: warnings
};

