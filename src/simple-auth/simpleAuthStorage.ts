import type { SimpleOwnerAuthContext } from './simpleAuthTypes';

const STORAGE_KEY = 'itred_simple_owner_auth_context';

export function readSimpleAuthContext(): SimpleOwnerAuthContext | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SimpleOwnerAuthContext;
  } catch {
    return null;
  }
}

export function saveSimpleAuthContext(context: SimpleOwnerAuthContext): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(context));
  } catch {
    // ignore write failures
  }
}

export function clearSimpleAuthContext(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
