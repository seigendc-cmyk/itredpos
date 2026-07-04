import type { PlanCode } from './planContract';

export type ActivationTokenStatus = 'Unused' | 'Used' | 'Expired' | 'Revoked';

export interface ActivationTokenRecord {
  tokenId: string;
  vendorId: string;
  planCode: PlanCode;
  tokenCode: string;
  status: ActivationTokenStatus;
  issuedAt: string;
  expiresAt: string;
  issuedBy: string;
  usedAt?: string;
  revokedAt?: string;
  createdAt: string;
  updatedAt: string;
}

