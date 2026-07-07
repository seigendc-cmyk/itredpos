import type { AccessContext } from './accessTypes';

const STORAGE_KEY = 'itred_clean_access_context';

function canUseLocalStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

export function readAccessContext(): AccessContext | null {
  if (!canUseLocalStorage()) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AccessContext;
  } catch {
    return null;
  }
}

export function saveAccessContext(context: AccessContext): void {
  if (!canUseLocalStorage()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(context));
  } catch {
    // ignore write failures
  }
}

export function clearAccessContext(): void {
  if (!canUseLocalStorage()) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
