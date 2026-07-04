import { firebaseInitStatus, firebaseReady } from '../firebase/firebaseApp';
import { getFirebaseConfigStatus } from '../firebase/firebaseConfig';

export interface FirebaseHealthStatus {
  configured: boolean;
  projectId: string;
  authDomain: string;
  storageBucket: string;
  maskedApiKey: string;
  missingKeys: string[];
  appInitialized: boolean;
  firestoreAvailable: boolean;
  authAvailable: boolean;
  storageAvailable: boolean;
  mode: 'Production Ready';
  dataSource: 'Online / Offline Cache';
  firestoreWrites: 'Readiness Managed';
  authLogin: 'Staff Access';
  firebaseReady: boolean;
  warnings: string[];
}

export interface FirebaseReadinessChecklistItem {
  label: string;
  status: 'Ready' | 'Missing' | 'Not Ready' | 'Disabled';
}

export function getFirebaseHealthStatus(): FirebaseHealthStatus {
  const configStatus = getFirebaseConfigStatus();
  const warnings = [
    ...firebaseInitStatus.warningMessages,
    'Firebase readiness is monitored while POS workflows continue to support offline cache fallback.'
  ];

  return {
    configured: configStatus.configured,
    projectId: configStatus.projectId,
    authDomain: configStatus.authDomain,
    storageBucket: configStatus.storageBucket,
    maskedApiKey: configStatus.maskedApiKey,
    missingKeys: configStatus.missingKeys,
    appInitialized: firebaseInitStatus.appInitialized,
    firestoreAvailable: firebaseInitStatus.firestoreAvailable,
    authAvailable: firebaseInitStatus.authAvailable,
    storageAvailable: firebaseInitStatus.storageAvailable,
    mode: 'Production Ready',
    dataSource: 'Online / Offline Cache',
    firestoreWrites: 'Readiness Managed',
    authLogin: 'Staff Access',
    firebaseReady,
    warnings
  };
}

export function getFirebaseEnvironmentSummary(): Array<[string, string]> {
  const status = getFirebaseHealthStatus();
  return [
    ['Firebase Config', status.configured ? 'Ready' : 'Missing'],
    ['Project ID', status.projectId],
    ['Auth Domain', status.authDomain],
    ['Storage Bucket', status.storageBucket],
    ['API Key', status.maskedApiKey],
    ['Firestore Shell', status.firestoreAvailable ? 'Ready' : 'Not Ready'],
    ['Auth Shell', status.authAvailable ? 'Ready' : 'Not Ready'],
    ['Storage Shell', status.storageAvailable ? 'Ready' : 'Not Ready'],
    ['Mode', status.mode],
    ['Data Source', status.dataSource],
    ['Firestore Writes', status.firestoreWrites],
    ['Auth Login', status.authLogin]
  ];
}

export function getFirebaseReadinessChecklist(): FirebaseReadinessChecklistItem[] {
  const status = getFirebaseHealthStatus();
  return [
    { label: 'Firebase Config', status: status.configured ? 'Ready' : 'Missing' },
    { label: 'Firebase App Shell', status: status.appInitialized ? 'Ready' : 'Not Ready' },
    { label: 'Firestore Shell', status: status.firestoreAvailable ? 'Ready' : 'Not Ready' },
    { label: 'Auth Shell', status: status.authAvailable ? 'Ready' : 'Not Ready' },
    { label: 'Storage Shell', status: status.storageAvailable ? 'Ready' : 'Not Ready' },
    { label: 'Firestore Writes', status: 'Disabled' },
    { label: 'Auth Login', status: 'Disabled' }
  ];
}
