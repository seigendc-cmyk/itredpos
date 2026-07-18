export const DEFAULT_VENDOR_TRIAL_DAYS = 3;

export const INITIAL_VENDOR_LICENSE_STATE = {
  planCode: 'DEMO',
  licenseStatus: 'Trial',
  activationStatus: 'PendingConsoleVerification',
  verificationStatus: 'Pending',
  accountStatus: 'Trial',
  licenseMode: 'demo'
} as const;

export type InitialVendorLicenseLifecycle = typeof INITIAL_VENDOR_LICENSE_STATE & {
  trialStartedAt: string;
  trialExpiresAt: string;
  expiresAt: string;
};

export function createInitialVendorLicenseLifecycle(
  now = new Date(),
  trialDays = DEFAULT_VENDOR_TRIAL_DAYS
): InitialVendorLicenseLifecycle {
  const trialStartedAt = now.toISOString();
  const safeDays = Number.isFinite(trialDays) ? Math.max(0, trialDays) : DEFAULT_VENDOR_TRIAL_DAYS;
  const trialExpiresAt = new Date(now.getTime() + safeDays * 24 * 60 * 60 * 1000).toISOString();
  return {
    ...INITIAL_VENDOR_LICENSE_STATE,
    trialStartedAt,
    trialExpiresAt,
    expiresAt: trialExpiresAt
  };
}
