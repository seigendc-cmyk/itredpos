import type { PlanCode } from './planContract';

export type ActivationTokenStatus = 'Unused' | 'Used' | 'Expired' | 'Revoked';

export interface ActivationTokenFeatures {
  posAccess: boolean;
  inventory: boolean;
  sales: boolean;
  reports: boolean;
}

export interface ActivationTokenRecord {
  tokenId: string;
  vendorId: string;
  vendorName?: string;
  planCode: PlanCode;
  tokenCode: string;
  status: ActivationTokenStatus;
  issuedAt: string;
  expiresAt: string;
  issuedBy: string;
  features: ActivationTokenFeatures;
  maxDevices: number;
  activatedDevices: number;
  usedAt?: string;
  revokedAt?: string;
  createdAt: string;
  updatedAt: string;
}

