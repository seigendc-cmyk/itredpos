import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { auth, firebaseInitStatus, firebaseReady } from '../firebase/firebaseApp';
import { isFirebaseAuthShellEnabled } from '../repositories/repositoryConfig';
import type { AuthShellActionResult, FirebaseAuthShellStatus, FirebaseAuthUserProfile } from './authTypes';
import { recordAuthActivity } from './tenantSessionService';

let currentProfile: FirebaseAuthUserProfile | null = null;

const errorMessage = (error: unknown): string => error instanceof Error ? error.message : 'Unknown Firebase Auth shell error.';

export function getFirebaseAuthShellStatus(): FirebaseAuthShellStatus {
  if (!isFirebaseAuthShellEnabled()) return 'Disabled';
  if (!firebaseInitStatus.configured) return 'Not Configured';
  if (!firebaseReady || !auth) return 'Disabled';
  return currentProfile ? 'Signed In' : 'Ready';
}

export function buildFirebaseUserProfile(user: User): FirebaseAuthUserProfile {
  return {
    uid: user.uid,
    email: user.email || undefined,
    displayName: user.displayName || undefined,
    photoURL: user.photoURL || undefined,
    providerId: user.providerId,
    authProvider: 'Google'
  };
}

export async function signInWithGooglePlaceholder(): Promise<AuthShellActionResult> {
  recordAuthActivity({ eventType: 'GOOGLE_SIGN_IN_PLACEHOLDER_STARTED', label: 'Google Sign-In Placeholder Started', message: 'Google sign-in shell started.' });
  if (!isFirebaseAuthShellEnabled()) return { ok: false, status: 'Disabled', message: 'Firebase Auth shell is disabled.' };
  if (!firebaseReady || !auth) return { ok: false, status: 'Not Configured', message: 'Firebase Auth is not configured. Build-development access remains available.' };
  try {
    const provider = new GoogleAuthProvider();
    const credential = await signInWithPopup(auth, provider);
    currentProfile = buildFirebaseUserProfile(credential.user);
    recordAuthActivity({ eventType: 'GOOGLE_SIGN_IN_PLACEHOLDER_SUCCESS', label: 'Google Sign-In Placeholder Success', message: 'Google sign-in shell completed.', staffId: currentProfile.email, vendorId: 'demo-vendor-001' });
    return { ok: true, status: 'Signed In', message: 'Google sign-in shell completed. Tenant resolution remains placeholder.', profile: currentProfile };
  } catch (error) {
    recordAuthActivity({ eventType: 'GOOGLE_SIGN_IN_PLACEHOLDER_FAILED', label: 'Google Sign-In Placeholder Failed', message: errorMessage(error), vendorId: 'demo-vendor-001' });
    return { ok: false, status: 'Error', message: 'Google sign-in shell failed safely.', error: errorMessage(error) };
  }
}

export async function signOutFirebasePlaceholder(): Promise<AuthShellActionResult> {
  if (!auth) {
    currentProfile = null;
    recordAuthActivity({ eventType: 'FIREBASE_SIGN_OUT_PLACEHOLDER', label: 'Firebase Sign-Out Placeholder', message: 'Firebase Auth shell local profile cleared.' });
    return { ok: true, status: 'Signed Out', message: 'Firebase Auth shell is not active; local profile cleared.' };
  }
  try {
    await signOut(auth);
    currentProfile = null;
    recordAuthActivity({ eventType: 'FIREBASE_SIGN_OUT_PLACEHOLDER', label: 'Firebase Sign-Out Placeholder', message: 'Firebase sign-out placeholder completed.' });
    return { ok: true, status: 'Signed Out', message: 'Firebase sign-out placeholder completed.' };
  } catch (error) {
    return { ok: false, status: 'Error', message: 'Firebase sign-out placeholder failed safely.', error: errorMessage(error) };
  }
}

export function subscribeToFirebaseAuthState(callback: (profile: FirebaseAuthUserProfile | null) => void): () => void {
  if (!auth || !isFirebaseAuthShellEnabled()) {
    callback(null);
    return () => undefined;
  }
  return onAuthStateChanged(auth, (user) => {
    currentProfile = user ? buildFirebaseUserProfile(user) : null;
    callback(currentProfile);
  });
}

export function getCurrentFirebaseUserProfile(): FirebaseAuthUserProfile | null {
  const user = auth?.currentUser;
  if (user) currentProfile = buildFirebaseUserProfile(user);
  return currentProfile;
}
