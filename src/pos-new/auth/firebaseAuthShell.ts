import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, getRedirectResult, signOut, type User, signInWithRedirect } from 'firebase/auth';
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
  // Keep function name to avoid changing call sites.
  if (!isFirebaseAuthShellEnabled()) {
    return {
      ok: false,
      status: 'Disabled',
      message: 'Firebase Auth shell is disabled. Please enable Firebase Auth in repositoryConfig.'
    };
  }
  if (!firebaseReady || !auth) {
    return {
      ok: false,
      status: 'Not Configured',
      message: 'Firebase Auth is not configured. Check firebaseConfig and initialization.'
    };
  }

  if (auth.currentUser) {
    currentProfile = buildFirebaseUserProfile(auth.currentUser);
    return { ok: true, status: 'Signed In', message: 'Google session already exists.', profile: currentProfile };
  }

  recordAuthActivity({
    eventType: 'GOOGLE_SIGN_IN_PLACEHOLDER_STARTED',
    label: 'Google Sign-In Started',
    message: 'Google sign-in started.'
  });


  try {
    const provider = new GoogleAuthProvider();

    // Requirement: Prefer signInWithPopup for localhost development.
    const isLocalhost =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    if (isLocalhost) {
      const result = await signInWithPopup(auth, provider);
      currentProfile = buildFirebaseUserProfile(result.user);
      recordAuthActivity({
        eventType: 'GOOGLE_SIGN_IN_PLACEHOLDER_SUCCESS',

        label: 'Google Sign-In Popup Success',
        message: 'Google popup sign-in completed successfully.',
        staffId: currentProfile.email,
        vendorId: 'demo-vendor-001'
      });
      return { ok: true, status: 'Signed In', message: 'Google sign-in completed.', profile: currentProfile };
    }

    // Non-local environments keep redirect flow (routing remains unchanged).
    await (await import('firebase/auth')).signInWithRedirect(auth, provider);
    return { ok: true, status: 'Signed In', message: 'Google redirect initiated.' };
  } catch (error) {
    const msg = errorMessage(error);
    recordAuthActivity({
        eventType: 'GOOGLE_SIGN_IN_PLACEHOLDER_FAILED',

      label: 'Google Sign-In Failed',
      message: msg,
      vendorId: 'demo-vendor-001'
    });
    return { ok: false, status: 'Error', message: msg };
  }
}

export async function handleGoogleRedirectResult(): Promise<AuthShellActionResult | null> {
  if (!isFirebaseAuthShellEnabled() || !firebaseReady || !auth) return null;
  try {
    const result = await getRedirectResult(auth);
    if (result) {
      currentProfile = buildFirebaseUserProfile(result.user);
      recordAuthActivity({
        eventType: 'GOOGLE_SIGN_IN_PLACEHOLDER_SUCCESS',

        label: 'Google Sign-In Redirect Success',
        message: 'Google sign-in redirect completed successfully.',
        staffId: currentProfile.email,
        vendorId: 'demo-vendor-001'
      });
      return { ok: true, status: 'Signed In', message: 'Google sign-in redirect completed.', profile: currentProfile };
    }
    if (auth.currentUser) {
      currentProfile = buildFirebaseUserProfile(auth.currentUser);
      return { ok: true, status: 'Signed In', message: 'Google session restored.', profile: currentProfile };
    }
    return null;
  } catch (error) {
    recordAuthActivity({
      eventType: 'GOOGLE_SIGN_IN_PLACEHOLDER_FAILED',

      label: 'Google Sign-In Redirect Failed',
      message: errorMessage(error),
      vendorId: 'demo-vendor-001'
    });
    return { ok: false, status: 'Error', message: errorMessage(error) };
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
