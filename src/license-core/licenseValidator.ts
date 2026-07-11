import type { LicenseActivationToken, LicenseFeatureFlags, LicenseStatus, LicenseValidationResult } from './licenseTypes';

export function validateLicenseToken(token: LicenseActivationToken | undefined, deviceId: string): LicenseValidationResult {
  if (!token) {
    return { ok: false, message: 'Invalid activation code.' };
  }

  if (token.status === 'Revoked') {
    return { ok: false, message: 'Activation code has been revoked.' };
  }

  if (token.status === 'Consumed') {
    return { ok: false, message: 'Activation code has already been fully consumed.' };
  }

  if (token.status === 'Expired') {
    return { ok: false, message: 'Activation code has expired.' };
  }

  if (token.expiresAt && Date.parse(token.expiresAt) < Date.now()) {
    return { ok: false, message: 'Activation code has expired.' };
  }

  const secureFeatureDefaults: LicenseFeatureFlags = {
    posAccess: false,
    inventory: false,
    sales: false,
    reports: false
  };
  const features: LicenseFeatureFlags = token.features
    ? { ...secureFeatureDefaults, ...token.features }
    : secureFeatureDefaults;
  if (!features.posAccess) {
    return { ok: false, message: 'This activation code does not enable POS access.' };
  }

  if (token.activatedDevices >= token.maxDevices) {
    return { ok: false, message: 'Activation code device limit reached.' };
  }

  return { ok: true, message: `Activation code valid for ${token.planCode}.`, token };
}
