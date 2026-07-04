import {
  POSAccessSnapshot,
  POSFeatureEntitlement,
  POSFeatureKey,
  POSPlan,
  POSPlanLimit,
  POSPlanLimitKey,
  VendorPOSLicense,
  VendorPOSSubscription
} from '../types/posTypes';
import {
  mockPOSFeatureEntitlements,
  mockPOSPlans,
  mockVendorPOSLicense,
  mockVendorPOSSubscription
} from '../mock/mockPosData';

const DEFAULT_VENDOR_ID = 'unassigned-vendor';

/**
 * During diagnostics mode, Owner has full access. Commercial feature enforcement
 * will be implemented later from internal backend services.
 */
export function isOwnerBuildDevelopmentBypass(role?: string): boolean {
  return role === 'Owner';
}

function getPlanForSubscription(subscription: VendorPOSSubscription): POSPlan {
  return mockPOSPlans.find((plan) => plan.tier === subscription.planTier) || mockPOSPlans[1];
}

function buildPOSPlanLimits(license: VendorPOSLicense, plan: POSPlan): POSPlanLimit[] {
  return [
    { key: 'branches', label: 'Branches', allowed: plan.branchesAllowed, currentUsage: 1, status: 'Within Limit', requiredAction: 'None' },
    { key: 'terminals', label: 'Terminals', allowed: plan.terminalsAllowed, currentUsage: 3, status: 'Within Limit', requiredAction: 'None' },
    { key: 'staff', label: 'Staff', allowed: plan.staffAllowed, currentUsage: 4, status: 'Within Limit', requiredAction: 'None' },
    { key: 'products', label: 'Products', allowed: plan.productsAllowed, currentUsage: 125, status: 'Within Limit', requiredAction: 'None' },
    { key: 'offlineGraceDays', label: 'Offline Grace Days', allowed: license.offlineGraceDays, currentUsage: 0, status: 'Within Limit', requiredAction: 'None' }
  ];
}

function applyOwnerBuildDevelopmentEntitlements(
  entitlements: POSFeatureEntitlement[],
  role?: string
): POSFeatureEntitlement[] {
  if (!isOwnerBuildDevelopmentBypass(role)) {
    return entitlements;
  }
  return entitlements.map((entitlement) => ({
    ...entitlement,
    enabled: true,
    status: 'Enabled' as const,
    uiEffect: 'Full access'
  }));
}

export async function getVendorPOSPlan(vendorId: string): Promise<POSPlan> {
  const subscription = await getVendorPOSSubscription(vendorId);
  return getPlanForSubscription(subscription);
}

export async function getVendorPOSSubscription(vendorId: string): Promise<VendorPOSSubscription> {
  return { ...mockVendorPOSSubscription, vendorId: vendorId || DEFAULT_VENDOR_ID };
}

export async function getVendorPOSLicense(vendorId: string): Promise<VendorPOSLicense> {
  return { ...mockVendorPOSLicense, vendorId: vendorId || DEFAULT_VENDOR_ID };
}

export async function getPOSFeatureEntitlements(
  vendorId: string,
  role?: string
): Promise<POSFeatureEntitlement[]> {
  const entitlements = mockPOSFeatureEntitlements.map((entitlement) => ({
    ...entitlement,
    vendorId: vendorId || DEFAULT_VENDOR_ID
  }));
  return applyOwnerBuildDevelopmentEntitlements(entitlements, role);
}

export async function checkPOSFeatureAccess(
  vendorId: string,
  featureKey: POSFeatureKey,
  role?: string
): Promise<{ allowed: boolean; entitlement: POSFeatureEntitlement | null; message: string }> {
  const entitlements = await getPOSFeatureEntitlements(vendorId, role);
  const entitlement = entitlements.find((item) => item.featureKey === featureKey) || null;

  if (isOwnerBuildDevelopmentBypass(role)) {
    return {
      allowed: true,
      entitlement,
      message: 'POS feature enabled for Owner access.'
    };
  }

  const allowed = Boolean(entitlement?.enabled);

  return {
    allowed,
    entitlement,
    message: allowed
      ? 'POS feature enabled for current plan.'
      : 'This POS feature is not enabled on your current plan. Please contact Digital Commerce / SCI support.'
  };
}

export async function checkPOSPlanLimit(
  vendorId: string,
  limitKey: POSPlanLimitKey,
  currentCount: number,
  role?: string
): Promise<POSPlanLimit> {
  const snapshot = await getPOSAccessSnapshot(vendorId, role);
  const baseLimit = snapshot.limits.find((limit) => limit.key === limitKey);
  if (!baseLimit) {
    return {
      key: limitKey,
      label: limitKey,
      allowed: 0,
      currentUsage: currentCount,
      status: 'Over Limit',
      requiredAction: 'Contact Digital Commerce / SCI support'
    };
  }

  if (isOwnerBuildDevelopmentBypass(role)) {
    return {
      ...baseLimit,
      currentUsage: currentCount,
      status: 'Within Limit',
      requiredAction: 'None'
    };
  }

  const allowed = baseLimit.allowed;
  const status = allowed === 'unlimited' || currentCount <= allowed ? 'Within Limit' : 'Over Limit';

  return {
    ...baseLimit,
    currentUsage: currentCount,
    status,
    requiredAction: status === 'Within Limit' ? 'None' : 'Contact Digital Commerce / SCI support'
  };
}

export async function getPOSAccessSnapshot(
  vendorId: string,
  role?: string
): Promise<POSAccessSnapshot> {
  const subscription = await getVendorPOSSubscription(vendorId);
  const license = await getVendorPOSLicense(vendorId);
  const plan = getPlanForSubscription(subscription);
  const entitlements = await getPOSFeatureEntitlements(vendorId, role);
  const limits = buildPOSPlanLimits(license, plan).map((limit) =>
    isOwnerBuildDevelopmentBypass(role)
      ? { ...limit, status: 'Within Limit' as const, requiredAction: 'None' }
      : limit
  );

  return {
    vendorId: vendorId || DEFAULT_VENDOR_ID,
    plan,
    subscription,
    license,
    entitlements,
    limits
  };
}
