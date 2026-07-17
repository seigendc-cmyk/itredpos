import { firebaseEnvStatus, isFirebaseConfigured, type FirebaseEnvKey } from '../pos-new/firebase/firebaseConfig';

const firebaseEnvKeys: FirebaseEnvKey[] = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID'
];

export interface FirebaseEnvValidation {
  configured: boolean;
  projectId: string;
  missingKeys: FirebaseEnvKey[];
  errors: string[];
}

/**
 * Validates that the required Firebase web configuration variables are present.
 * Intentionally does NOT read or log secret values; it only reports presence.
 */
export function validateFirebaseEnv(): FirebaseEnvValidation {
  const errors: string[] = [];
  const missingKeys = firebaseEnvKeys.filter((key) => !import.meta.env[key]);

  if (missingKeys.length > 0) {
    errors.push(`Missing Firebase environment keys: ${missingKeys.join(', ')}`);
  }

  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;
  if (typeof projectId !== 'string' || projectId.trim().length === 0) {
    errors.push('VITE_FIREBASE_PROJECT_ID is required and must be non-blank.');
  }

  return {
    configured: isFirebaseConfigured,
    projectId: firebaseEnvStatus.projectId,
    missingKeys,
    errors
  };
}

export function requireFirebaseEnv(): FirebaseEnvValidation {
  const result = validateFirebaseEnv();
  if (!result.configured) {
    throw new Error(`Firebase environment is not fully configured: ${result.errors.join(' ')}`);
  }
  return result;
}
