import type { PosPageId } from '../types';

export type PlanCode = 'DEMO' | 'STARTER' | 'STANDARD' | 'PRO' | 'ENTERPRISE' | string;

export type PlanFeatureKey =
  | 'salesEnabled'
  | 'inventoryEnabled'
  | 'reportsEnabled'
  | 'deliveryEnabled'
  | 'purchasingEnabled'
  | 'creditorsEnabled'
  | 'biEnabled'
  | 'multiBranchEnabled'
  | 'multiWarehouseEnabled'
  | 'staffManagementEnabled'
  | 'advancedSettingsEnabled';

export type PlanLimitKey =
  | 'maxBranches'
  | 'maxWarehouses'
  | 'maxTerminals'
  | 'maxStaff'
  | 'maxProducts';

export type PlanFeatureFlags = Record<PlanFeatureKey, boolean>;
export type PlanLimits = Record<PlanLimitKey, number>;

export interface PlanPageAccess {
  allowed: boolean;
  featureName: string;
  requiredPlan: PlanCode;
  featureKey?: PlanFeatureKey;
}

export interface PlanFeatureAccess {
  planCode: PlanCode;
  featureFlags: PlanFeatureFlags;
  limits: PlanLimits;
  pageAccess: Record<PosPageId, PlanPageAccess>;
}

type LicenseLike = {
  planCode?: string;
  planId?: string;
  featureFlags?: Partial<Record<PlanFeatureKey | 'creditControlEnabled', boolean>>;
  maxBranches?: number | string;
  maxWarehouses?: number | string;
  maxTerminals?: number | string;
  maxStaff?: number | string;
  maxProducts?: number | string;
  [key: string]: unknown;
} | null | undefined;

const DEFAULT_LIMITS: Record<string, PlanLimits> = {
  DEMO: { maxBranches: 1, maxWarehouses: 1, maxTerminals: 1, maxStaff: 2, maxProducts: 50 },
  STARTER: { maxBranches: 1, maxWarehouses: 1, maxTerminals: 2, maxStaff: 5, maxProducts: 1000 },
  STANDARD: { maxBranches: 3, maxWarehouses: 3, maxTerminals: 6, maxStaff: 20, maxProducts: 10000 },
  PRO: { maxBranches: 8, maxWarehouses: 8, maxTerminals: 20, maxStaff: 75, maxProducts: 50000 },
  ENTERPRISE: { maxBranches: 999, maxWarehouses: 999, maxTerminals: 999, maxStaff: 999, maxProducts: 999999 }
};

const DEFAULT_FEATURES: Record<string, PlanFeatureFlags> = {
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

const FEATURE_REQUIRED_PLAN: Record<PlanFeatureKey, PlanCode> = {
  salesEnabled: 'DEMO',
  inventoryEnabled: 'DEMO',
  reportsEnabled: 'STARTER',
  deliveryEnabled: 'STANDARD',
  purchasingEnabled: 'STANDARD',
  creditorsEnabled: 'STANDARD',
  biEnabled: 'PRO',
  multiBranchEnabled: 'STANDARD',
  multiWarehouseEnabled: 'STANDARD',
  staffManagementEnabled: 'STANDARD',
  advancedSettingsEnabled: 'STANDARD'
};

const PAGE_FEATURE_MAP: Partial<Record<PosPageId, { featureKey: PlanFeatureKey; featureName: string }>> = {
  SALES: { featureKey: 'salesEnabled', featureName: 'Sales Terminal' },
  SALES_HISTORY: { featureKey: 'salesEnabled', featureName: 'Sales History' },
  DELIVERY: { featureKey: 'deliveryEnabled', featureName: 'Delivery Desk' },
  STOCK: { featureKey: 'inventoryEnabled', featureName: 'Inventory' },
  PURCHASE_DISCIPLINE: { featureKey: 'purchasingEnabled', featureName: 'Purchasing Discipline' },
  CREDITORS: { featureKey: 'creditorsEnabled', featureName: 'Creditors' },
  REPORTS: { featureKey: 'reportsEnabled', featureName: 'Reports' },
  BI_DESK: { featureKey: 'biEnabled', featureName: 'BI Desk' }
};

const ALL_POS_PAGES: PosPageId[] = [
  'DASHBOARD',
  'OWNER_DESK',
  'SALES',
  'SALES_HISTORY',
  'CUSTOMER_CENTRE',
  'DELIVERY',
  'STOCK',
  'PURCHASE_DISCIPLINE',
  'CREDITORS',
  'TASK_DESK',
  'APPROVALS',
  'SHIFT',
  'CASH',
  'FINANCIAL_CONTROL',
  'REPORTS',
  'BI_DESK',
  'SYNC_DESK',
  'HELP_DESK',
  'SETTINGS'
];

function normalizePlanCode(value: unknown): PlanCode {
  return String(value || 'DEMO').trim().toUpperCase() || 'DEMO';
}

function numberLimit(value: unknown, fallback: number): number {
  const next = Number(value);
  return Number.isFinite(next) && next >= 0 ? next : fallback;
}

function booleanFlag(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return fallback;
}

function defaultFeaturesForPlan(planCode: PlanCode): PlanFeatureFlags {
  return { ...(DEFAULT_FEATURES[String(planCode)] || DEFAULT_FEATURES.DEMO) };
}

function defaultLimitsForPlan(planCode: PlanCode): PlanLimits {
  return { ...(DEFAULT_LIMITS[String(planCode)] || DEFAULT_LIMITS.DEMO) };
}

function extractFeatureFlags(context: LicenseLike, defaults: PlanFeatureFlags): PlanFeatureFlags {
  const source = (context?.featureFlags || {}) as Record<string, unknown>;
  const merged = { ...defaults };
  (Object.keys(merged) as PlanFeatureKey[]).forEach((key) => {
    const directValue = context?.[key];
    const nestedValue = key === 'creditorsEnabled'
      ? source.creditorsEnabled ?? source.creditControlEnabled
      : source[key];
    merged[key] = booleanFlag(nestedValue ?? directValue, merged[key]);
  });
  merged.multiBranchEnabled = booleanFlag(source.multiBranchEnabled ?? context?.multiBranchEnabled, merged.multiBranchEnabled || numberLimit(context?.maxBranches, 0) > 1);
  merged.multiWarehouseEnabled = booleanFlag(source.multiWarehouseEnabled ?? context?.multiWarehouseEnabled, merged.multiWarehouseEnabled || numberLimit(context?.maxWarehouses, 0) > 1);
  return merged;
}

function extractLimits(context: LicenseLike, defaults: PlanLimits): PlanLimits {
  return {
    maxBranches: numberLimit(context?.maxBranches, defaults.maxBranches),
    maxWarehouses: numberLimit(context?.maxWarehouses, defaults.maxWarehouses),
    maxTerminals: numberLimit(context?.maxTerminals, defaults.maxTerminals),
    maxStaff: numberLimit(context?.maxStaff, defaults.maxStaff),
    maxProducts: numberLimit(context?.maxProducts, defaults.maxProducts)
  };
}

function buildPageAccess(planCode: PlanCode, featureFlags: PlanFeatureFlags): Record<PosPageId, PlanPageAccess> {
  return ALL_POS_PAGES.reduce<Record<PosPageId, PlanPageAccess>>((acc, pageId) => {
    const gate = PAGE_FEATURE_MAP[pageId];
    if (!gate) {
      acc[pageId] = {
        allowed: true,
        featureName: pageId.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase()),
        requiredPlan: 'DEMO'
      };
      return acc;
    }
    acc[pageId] = {
      allowed: featureFlags[gate.featureKey],
      featureName: gate.featureName,
      requiredPlan: FEATURE_REQUIRED_PLAN[gate.featureKey],
      featureKey: gate.featureKey
    };
    return acc;
  }, {} as Record<PosPageId, PlanPageAccess>);
}

export function getPlanFeatureAccess(licenseContext?: LicenseLike): PlanFeatureAccess {
  const planCode = normalizePlanCode(licenseContext?.planCode || licenseContext?.planId);
  const defaults = defaultFeaturesForPlan(planCode);
  const limits = extractLimits(licenseContext, defaultLimitsForPlan(planCode));
  const featureFlags = extractFeatureFlags({ ...licenseContext, maxBranches: limits.maxBranches, maxWarehouses: limits.maxWarehouses }, defaults);
  return {
    planCode,
    featureFlags,
    limits,
    pageAccess: buildPageAccess(planCode, featureFlags)
  };
}

export function getLockedPlanPages(access: PlanFeatureAccess): PosPageId[] {
  return ALL_POS_PAGES.filter((pageId) => !access.pageAccess[pageId].allowed);
}

export function isLimitReached(currentCount: number, limit: number): boolean {
  return Number.isFinite(limit) && currentCount >= limit;
}

export function getNextPlanCode(planCode: PlanCode): PlanCode {
  const order = ['DEMO', 'STARTER', 'STANDARD', 'PRO', 'ENTERPRISE'];
  const normalized = normalizePlanCode(planCode);
  const index = order.indexOf(String(normalized));
  if (index === -1) return 'STARTER';
  return order[Math.min(index + 1, order.length - 1)];
}
