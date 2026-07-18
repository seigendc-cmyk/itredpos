import type { PlanCode, PlanFeatureFlags, PlanLimits } from './planContract';
import { DEFAULT_PLAN_FEATURE_FLAGS, DEFAULT_PLAN_LIMITS } from './planContract';
import { createInitialVendorLicenseLifecycle, DEFAULT_VENDOR_TRIAL_DAYS } from './licenseLifecycle';

export type LicenseStatus = 'Trial' | 'Active' | 'Expired' | 'Suspended' | 'Rejected';
export type ActivationStatus = 'PendingConsoleVerification' | 'Active' | 'Expired' | 'Suspended' | 'Rejected';

export interface VendorLicenseRecord {
  vendorId: string;
  licenseId: string;
  activationId: string;
  planId: PlanCode;
  planCode: PlanCode;
  planName: string;
  licenseStatus: LicenseStatus;
  activationStatus: ActivationStatus;
  licenseMode: 'demo' | 'trial' | 'paid';
  storageMode: 'localOnly' | 'cloudSync' | 'cloud';
  branchId: string;
  terminalId: string;
  issuedBy: string;
  issuedAt: string;
  trialStartedAt: string;
  trialExpiresAt: string;
  expiresAt: string;
  featureFlags: PlanFeatureFlags;
  limits: PlanLimits;
  activatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export function createDefaultDemoLicense(
  vendorId: string,
  trialDays = DEFAULT_VENDOR_TRIAL_DAYS,
  nowDate = new Date()
): VendorLicenseRecord {
  const lifecycle = createInitialVendorLicenseLifecycle(nowDate, trialDays);
  const now = lifecycle.trialStartedAt;
  return {
    vendorId,
    licenseId: vendorId,
    activationId: vendorId,
    planId: 'DEMO',
    planCode: 'DEMO',
    planName: 'Demo Trial',
    licenseStatus: lifecycle.licenseStatus,
    activationStatus: lifecycle.activationStatus,
    licenseMode: lifecycle.licenseMode,
    storageMode: 'localOnly',
    branchId: 'main-branch',
    terminalId: 'TERM-MAIN-001',
    issuedBy: 'POS_ONBOARDING',
    issuedAt: now,
    trialStartedAt: lifecycle.trialStartedAt,
    trialExpiresAt: lifecycle.trialExpiresAt,
    expiresAt: lifecycle.expiresAt,
    featureFlags: { ...DEFAULT_PLAN_FEATURE_FLAGS.DEMO },
    limits: { ...DEFAULT_PLAN_LIMITS.DEMO },
    createdAt: now,
    updatedAt: now
  };
}

