import type { VendorAccountStatus } from './vendorContract';
import type { ActivationStatus, LicenseStatus } from './licenseContract';
import { createInitialVendorLicenseLifecycle } from './licenseLifecycle';

export const PLAN_CODES = ['DEMO', 'STARTER', 'STANDARD', 'PRO', 'ENTERPRISE'] as const;

export type PlanCode = (typeof PLAN_CODES)[number];
export type PricingPlanStatus = 'Active' | 'Inactive';

export interface PlanFeatureFlags {
  salesEnabled: boolean;
  inventoryEnabled: boolean;
  reportsEnabled: boolean;
  deliveryEnabled: boolean;
  purchasingEnabled: boolean;
  creditorsEnabled: boolean;
  biEnabled: boolean;
  multiBranchEnabled: boolean;
  multiWarehouseEnabled: boolean;
  staffManagementEnabled: boolean;
  advancedSettingsEnabled: boolean;
}

export interface PlanLimits {
  maxBranches: number;
  maxWarehouses: number;
  maxTerminals: number;
  maxStaff: number;
  maxProducts: number;
}

export interface PricingPlanRecord {
  planCode: PlanCode;
  planName: string;
  description: string;
  monthlyPrice: number;
  currency: string;
  billingCycle: 'Monthly';
  featureFlags: PlanFeatureFlags;
  limits: PlanLimits;
  status: PricingPlanStatus;
  createdAt: string;
  updatedAt: string;
}

export interface VendorPlanRecord {
  vendorId: string;
  planId: PlanCode;
  planCode: PlanCode;
  planName: string;
  accountStatus: VendorAccountStatus;
  licenseStatus: LicenseStatus;
  activationStatus: ActivationStatus;
  featureFlags: PlanFeatureFlags;
  limits: PlanLimits;
  trialStartedAt: string;
  trialExpiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_PLAN_FEATURE_FLAGS: Record<PlanCode, PlanFeatureFlags> = {
  DEMO: {
    salesEnabled: true,
    inventoryEnabled: true,
    reportsEnabled: false,
    deliveryEnabled: false,
    purchasingEnabled: false,
    creditorsEnabled: false,
    biEnabled: false,
    multiBranchEnabled: false,
    multiWarehouseEnabled: false,
    staffManagementEnabled: false,
    advancedSettingsEnabled: false
  },
  STARTER: {
    salesEnabled: true,
    inventoryEnabled: true,
    reportsEnabled: true,
    deliveryEnabled: false,
    purchasingEnabled: false,
    creditorsEnabled: false,
    biEnabled: false,
    multiBranchEnabled: false,
    multiWarehouseEnabled: false,
    staffManagementEnabled: false,
    advancedSettingsEnabled: false
  },
  STANDARD: {
    salesEnabled: true,
    inventoryEnabled: true,
    reportsEnabled: true,
    deliveryEnabled: true,
    purchasingEnabled: true,
    creditorsEnabled: true,
    biEnabled: false,
    multiBranchEnabled: true,
    multiWarehouseEnabled: true,
    staffManagementEnabled: true,
    advancedSettingsEnabled: true
  },
  PRO: {
    salesEnabled: true,
    inventoryEnabled: true,
    reportsEnabled: true,
    deliveryEnabled: true,
    purchasingEnabled: true,
    creditorsEnabled: true,
    biEnabled: true,
    multiBranchEnabled: true,
    multiWarehouseEnabled: true,
    staffManagementEnabled: true,
    advancedSettingsEnabled: true
  },
  ENTERPRISE: {
    salesEnabled: true,
    inventoryEnabled: true,
    reportsEnabled: true,
    deliveryEnabled: true,
    purchasingEnabled: true,
    creditorsEnabled: true,
    biEnabled: true,
    multiBranchEnabled: true,
    multiWarehouseEnabled: true,
    staffManagementEnabled: true,
    advancedSettingsEnabled: true
  }
};

export const DEFAULT_PLAN_LIMITS: Record<PlanCode, PlanLimits> = {
  DEMO: { maxBranches: 1, maxWarehouses: 1, maxTerminals: 1, maxStaff: 2, maxProducts: 50 },
  STARTER: { maxBranches: 1, maxWarehouses: 1, maxTerminals: 2, maxStaff: 5, maxProducts: 1000 },
  STANDARD: { maxBranches: 3, maxWarehouses: 3, maxTerminals: 6, maxStaff: 20, maxProducts: 10000 },
  PRO: { maxBranches: 8, maxWarehouses: 8, maxTerminals: 20, maxStaff: 75, maxProducts: 50000 },
  ENTERPRISE: { maxBranches: 999, maxWarehouses: 999, maxTerminals: 999, maxStaff: 999, maxProducts: 999999 }
};

const DEFAULT_PLAN_NAMES: Record<PlanCode, string> = {
  DEMO: 'Demo Trial',
  STARTER: 'Starter',
  STANDARD: 'Standard',
  PRO: 'Pro',
  ENTERPRISE: 'Enterprise'
};

const DEFAULT_PLAN_DESCRIPTIONS: Record<PlanCode, string> = {
  DEMO: 'Trial POS access for onboarding and evaluation.',
  STARTER: 'Core POS operations for a small single-branch vendor.',
  STANDARD: 'Expanded POS operations with purchasing, delivery, and staff controls.',
  PRO: 'Advanced POS operations with BI and larger operating limits.',
  ENTERPRISE: 'Full operating limits for multi-branch vendor groups.'
};

const DEFAULT_MONTHLY_PRICES: Record<PlanCode, number> = {
  DEMO: 0,
  STARTER: 0,
  STANDARD: 0,
  PRO: 0,
  ENTERPRISE: 0
};

function nowIso(): string {
  return new Date().toISOString();
}

function cloneFeatureFlags(planCode: PlanCode): PlanFeatureFlags {
  return { ...DEFAULT_PLAN_FEATURE_FLAGS[planCode] };
}

function cloneLimits(planCode: PlanCode): PlanLimits {
  return { ...DEFAULT_PLAN_LIMITS[planCode] };
}

export function createDefaultDemoPlan(vendorId: string, nowDate = new Date()): VendorPlanRecord {
  const lifecycle = createInitialVendorLicenseLifecycle(nowDate);
  const now = lifecycle.trialStartedAt;
  return {
    vendorId,
    planId: 'DEMO',
    planCode: 'DEMO',
    planName: DEFAULT_PLAN_NAMES.DEMO,
    accountStatus: lifecycle.accountStatus,
    licenseStatus: lifecycle.licenseStatus,
    activationStatus: lifecycle.activationStatus,
    featureFlags: cloneFeatureFlags('DEMO'),
    limits: cloneLimits('DEMO'),
    trialStartedAt: lifecycle.trialStartedAt,
    trialExpiresAt: lifecycle.trialExpiresAt,
    createdAt: now,
    updatedAt: now
  };
}

export function createDefaultPricingPlans(): PricingPlanRecord[] {
  const now = nowIso();
  return PLAN_CODES.map((planCode) => ({
    planCode,
    planName: DEFAULT_PLAN_NAMES[planCode],
    description: DEFAULT_PLAN_DESCRIPTIONS[planCode],
    monthlyPrice: DEFAULT_MONTHLY_PRICES[planCode],
    currency: 'USD',
    billingCycle: 'Monthly',
    featureFlags: cloneFeatureFlags(planCode),
    limits: cloneLimits(planCode),
    status: 'Active',
    createdAt: now,
    updatedAt: now
  }));
}

