import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../pos-new/firebase/firebaseApp';
import type { SimpleOwnerAuthContext } from './simpleAuthTypes';

const LOCALHOST_ONLY_POPUP = true;

export async function signInWithGoogle(): Promise<SimpleOwnerAuthContext> {
  if (!auth) {
    throw new Error('Firebase Auth is not configured.');
  }

  const provider = new GoogleAuthProvider();

  let user;
  if (LOCALHOST_ONLY_POPUP && typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    const result = await signInWithPopup(auth, provider);
    user = result.user;
  } else {
    throw new Error('Google sign-in is only available on localhost for this simple auth flow.');
  }

  if (!user.email) {
    throw new Error('Google account email is required.');
  }

  const ownerUid = user.uid;
  const ownerEmail = user.email;
  const ownerName = user.displayName || ownerEmail.split('@')[0];
  const vendorId = `vendor-${ownerUid.slice(0, 8)}`;
  const vendorName = 'New Business';
  const branchId = 'main-branch';
  const warehouseId = 'main-warehouse';
  const role = 'Owner';
  const permissions = ['*'];
  const signedInAt = new Date().toISOString();

  return {
    ownerUid,
    ownerEmail,
    ownerName,
    vendorId,
    vendorName,
    branchId,
    warehouseId,
    role,
    permissions,
    signedInAt
  };
}

export function getCurrentSimpleAuthContext(): SimpleOwnerAuthContext | null {
  try {
    const raw = localStorage.getItem('itred_simple_owner_auth_context');
    if (!raw) return null;
    return JSON.parse(raw) as SimpleOwnerAuthContext;
  } catch {
    return null;
  }
}

export function clearSimpleAuthContext(): void {
  localStorage.removeItem('itred_simple_owner_auth_context');
}
