import type { FirebaseOptions } from 'firebase/app';

const firebaseEnvKeys = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
  'VITE_FIREBASE_MEASUREMENT_ID'
] as const;

export type FirebaseEnvKey = typeof firebaseEnvKeys[number];

export interface FirebaseConfigStatus {
  configured: boolean;
  missingKeys: FirebaseEnvKey[];
  projectId: string;
  authDomain: string;
  storageBucket: string;
  maskedApiKey: string;
  measurementId: string;
}

const envValue = (key: FirebaseEnvKey): string => {
  const value = import.meta.env[key];
  return typeof value === 'string' ? value.trim() : '';
};

const maskSecret = (value: string): string => {
  if (!value) return 'Missing';
  if (value.length <= 8) return 'Configured';
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
};

export const firebaseConfig: FirebaseOptions = {
  apiKey: envValue('VITE_FIREBASE_API_KEY'),
  authDomain: envValue('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: envValue('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: envValue('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: envValue('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: envValue('VITE_FIREBASE_APP_ID'),
  measurementId: envValue('VITE_FIREBASE_MEASUREMENT_ID')
};

export const firebaseEnvStatus: FirebaseConfigStatus = {
  configured: firebaseEnvKeys.every((key) => Boolean(envValue(key))),
  missingKeys: firebaseEnvKeys.filter((key) => !envValue(key)),
  projectId: firebaseConfig.projectId || 'Not configured',
  authDomain: firebaseConfig.authDomain || 'Not configured',
  storageBucket: firebaseConfig.storageBucket || 'Not configured',
  maskedApiKey: maskSecret(firebaseConfig.apiKey || ''),
  measurementId: firebaseConfig.measurementId || 'Not configured'
};

export const isFirebaseConfigured = firebaseEnvStatus.configured;

export function getFirebaseConfigStatus(): FirebaseConfigStatus {
  return firebaseEnvStatus;
}

