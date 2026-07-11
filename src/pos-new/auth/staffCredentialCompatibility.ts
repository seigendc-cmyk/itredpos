export interface LegacyStaffPinCredential {
  pin: string;
}

/**
 * Isolates legacy plaintext PIN fields from the public staff profile contract.
 * New profiles must use the dedicated credential service; these aliases are read-only.
 */
export function readLegacyStaffPinCredential(profile: unknown): LegacyStaffPinCredential | null {
  if (typeof profile !== 'object' || profile === null) return null;

  if ('pin' in profile && typeof profile.pin === 'string' && profile.pin.trim()) {
    return { pin: profile.pin.trim() };
  }
  if ('defaultPin' in profile && typeof profile.defaultPin === 'string' && profile.defaultPin.trim()) {
    return { pin: profile.defaultPin.trim() };
  }
  return null;
}
