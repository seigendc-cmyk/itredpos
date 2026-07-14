export function isFirebaseStorageMode(explicitMode?: string): boolean {
  return (explicitMode || import.meta.env.VITE_STORAGE_MODE || '').trim().toLowerCase() === 'firebase';
}

export function mayUseLocalOperationalAuthority(explicitMode?: string): boolean {
  return !isFirebaseStorageMode(explicitMode);
}
