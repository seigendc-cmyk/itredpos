import type { PlanCode, PlanFeatureFlags, PlanLimits } from './planContract';
import { DEFAULT_PLAN_FEATURE_FLAGS, DEFAULT_PLAN_LIMITS } from './planContract';

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

function nowIso(): string {
  return new Date().toISOString();
}

function addDaysIso(baseIso: string, days: number): string {
  const base = new Date(baseIso);
  const safeDays = Number.isFinite(days) ? Math.max(0, days) : 0;
  return new Date(base.getTime() + safeDays * 24 * 60 * 60 * 1000).toISOString();
}

export function createDefaultDemoLicense(vendorId: string, trialDays: number): VendorLicenseRecord {
  const now = nowIso();
  const trialExpiresAt = addDaysIso(now, trialDays);
  return {
    vendorId,
    licenseId: vendorId,
    activationId: vendorId,
    planId: 'DEMO',
    planCode: 'DEMO',
    planName: 'Demo Trial',
    licenseStatus: 'Trial',
    activationStatus: 'PendingConsoleVerification',
    licenseMode: 'demo',
    storageMode: 'localOnly',
    branchId: 'main-branch',
    terminalId: 'TERM-MAIN-001',
    issuedBy: 'POS_ONBOARDING',
    issuedAt: now,
    trialStartedAt: now,
    trialExpiresAt,
    expiresAt: trialExpiresAt,
    featureFlags: { ...DEFAULT_PLAN_FEATURE_FLAGS.DEMO },
    limits: { ...DEFAULT_PLAN_LIMITS.DEMO },
    createdAt: now,
    updatedAt: now
  };
}

