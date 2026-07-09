export type PosAuthStage =
  | 'checkingGoogleSession'
  | 'googleSignInRequired'
  | 'vendorSelectionRequired'
  | 'businessProfileRequired'
  | 'staffAccessRequired'
  | 'licenseRequired'
  | 'posReady';

import type { ResolvedVendorSummary } from './tenantResolutionTypes';

export type PosVendorAuthContext = {
  stage: PosAuthStage;
  googleUid?: string;
  googleEmail?: string;
  vendorId?: string;
  vendorName?: string;
  /** Candidates resolved from the ownerUid query when more than one vendor exists. */
  candidateVendors?: ResolvedVendorSummary[];
  /** True when the owner must pick a tenant from candidateVendors. */
  selectedVendorRequired?: boolean;
  /** ISO timestamp when the owner selected a tenant. */
  selectedAt?: string;
  /** Firebase uid of the owner who selected the tenant. */
  selectedByUid?: string;
  branchId?: string;
  warehouseId?: string;
  staffId?: string;
  staffRole?: string;
  planCode?: string;
  licenseMode?: 'trial' | 'active' | 'demo' | string;
  licenseStatus?: 'Demo' | 'Trial' | 'Active' | 'Expired' | 'Suspended' | 'Rejected' | 'Pending';
  activationStatus?: string;
  accountStatus?: string;
  verificationStatus?: string;
  trialStartedAt?: string;
  trialExpiresAt?: string;
  activatedAt?: string;
  suspendedAt?: string;
  rejectedAt?: string;
  featureFlags?: Record<string, boolean>;
  maxBranches?: number;
  maxWarehouses?: number;
  maxTerminals?: number;
  maxStaff?: number;
  maxProducts?: number;
  demoExpiresAt?: string;
  syncStatus?: 'Synced' | 'PendingSync';
  consoleProvisionedAt?: string;
  consoleProvisioningError?: string;
  message?: string;
};

export const POS_AUTH_STORAGE_KEY = 'sci_pos_vendor_auth_context';

export function createInitialPosAuthContext(): PosVendorAuthContext {
  return {
    stage: 'checkingGoogleSession',
    licenseStatus: 'Demo'
  };
}

export function savePosAuthContext(context: PosVendorAuthContext): void {
  localStorage.setItem(POS_AUTH_STORAGE_KEY, JSON.stringify(context));
}

export function readPosAuthContext(): PosVendorAuthContext | null {
  try {
    const raw = localStorage.getItem(POS_AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) as PosVendorAuthContext : null;
  } catch {
    return null;
  }
}

export function clearPosAuthContext(): void {
  localStorage.removeItem(POS_AUTH_STORAGE_KEY);
}

export function resolveNextAuthStage(context: PosVendorAuthContext): PosAuthStage {
  if (!context.googleUid || !context.googleEmail) return 'googleSignInRequired';

  // Keep the owner on the tenant selector until a specific vendor is chosen.
  if (context.stage === 'vendorSelectionRequired' && !context.vendorId) {
    return 'vendorSelectionRequired';
  }

  if (!context.vendorId || !context.vendorName) return 'posReady';

  const statusValues = [
    context.licenseStatus,
    context.activationStatus,
    context.accountStatus,
    context.verificationStatus
  ].map((value) => String(value || '').toLowerCase());

  if (
    context.licenseStatus === 'Expired' ||
    statusValues.some((value) => value === 'suspended' || value === 'rejected')
  ) {
    return 'posReady';
  }

  if (!context.branchId || !context.warehouseId) return 'businessProfileRequired';

  if (!context.staffId || !context.staffRole) return 'posReady';

  return 'posReady';
}

