import type { LicenseActivationToken, LicenseGenerationInput, LicenseStatus } from './licenseTypes';
import { generateLicenseCode } from './licenseCodeGenerator';
import { getDefaultFeatureFlags } from './licenseDefaults';

export function createLicenseActivationToken(input: LicenseGenerationInput): LicenseActivationToken {
  const now = new Date().toISOString();
  const tokenId = `token-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const tokenCode = generateLicenseCode();
  const expiryDays = input.expiryDays ?? 30;
  const maxDevices = input.maxDevices ?? 1;

  const features = getDefaultFeatureFlags(input.planCode);

  const token: LicenseActivationToken = {
    tokenId,
    tokenCode,
    vendorId: input.vendorId,
    vendorName: input.vendorName,
    planCode: input.planCode,
    status: 'Unused',
    features,
    maxDevices,
    activatedDevices: 0,
    issuedAt: now,
    expiresAt: new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString(),
    issuedBy: input.issuedBy,
    createdAt: now,
    updatedAt: now
  };

  if (input.note) {
    token.note = input.note;
  }

  return token;
}
