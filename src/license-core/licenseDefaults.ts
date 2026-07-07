import type { LicenseFeatureFlags, LicensePlanCode } from './licenseTypes';

export function getDefaultFeatureFlags(planCode: LicensePlanCode): LicenseFeatureFlags {
  switch (planCode) {
    case 'DEMO':
      return {
        posAccess: true,
        inventory: true,
        sales: true,
        reports: false
      };
    case 'STARTER':
      return {
        posAccess: true,
        inventory: true,
        sales: true,
        reports: true
      };
    case 'GROWTH':
    case 'ENTERPRISE':
      return {
        posAccess: true,
        inventory: true,
        sales: true,
        reports: true
      };
    default:
      return {
        posAccess: true,
        inventory: true,
        sales: true,
        reports: false
      };
  }
}
