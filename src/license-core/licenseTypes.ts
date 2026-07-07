export type LicensePlanCode = 'DEMO' | 'STARTER' | 'GROWTH' | 'ENTERPRISE';

export type LicenseStatus = 'Unused' | 'Active' | 'Consumed' | 'Expired' | 'Revoked';

export interface LicenseFeatureFlags {
  posAccess: boolean;
  inventory: boolean;
  sales: boolean;
  reports: boolean;
}

export interface LicenseGenerationInput {
  vendorId: string;
  planCode: LicensePlanCode;
  issuedBy: string;
  expiryDays?: number;
  maxDevices?: number;
  vendorName?: string;
  note?: string;
}

export interface LicenseActivationToken {
  tokenId: string;
  tokenCode: string;
  vendorId: string;
  vendorName?: string;
  planCode: LicensePlanCode;
  status: LicenseStatus;
  features: LicenseFeatureFlags;
  maxDevices: number;
  activatedDevices: number;
  issuedAt: string;
  expiresAt: string;
  issuedBy: string;
  createdAt: string;
  updatedAt: string;
  note?: string;
}

export interface LicenseValidationResult {
  ok: boolean;
  message: string;
  token?: LicenseActivationToken;
}
