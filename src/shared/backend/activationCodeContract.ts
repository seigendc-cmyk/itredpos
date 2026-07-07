import type { PlanCode } from './planContract';

export type ActivationCodeStatus = 'unused' | 'active' | 'expired' | 'revoked' | 'consumed';

export interface ActivationCodeFeatures {
  posAccess: boolean;
  inventory: boolean;
  sales: boolean;
  reports: boolean;
}

export interface ActivationCodeRecord {
  codeId: string;
  code: string;
  vendorId: string;
  vendorName: string;
  planCode: PlanCode;
  licenseMode: 'trial' | 'demo' | 'paid';
  status: ActivationCodeStatus;
  features: ActivationCodeFeatures;
  maxDevices: number;
  activatedDevices: number;
  expiresAt: string;
  createdAt: string;
  createdBy: string;
  consumedAt?: string;
  consumedByDeviceId?: string;
  metadata?: Record<string, unknown>;
}

export interface POSActivationSnapshotLocal {
  vendorId: string;
  vendorName: string;
  planCode: string;
  licenseMode: 'trial' | 'demo' | 'paid';
  activationCodeId: string;
  activatedAt: string;
  expiresAt: string;
  features: ActivationCodeFeatures;
  deviceId: string;
  licenseStatusKnown: true;
}

export interface POSActivationCodeResult {
  ok: boolean;
  message: string;
  snapshot?: POSActivationSnapshotLocal;
  codeRecord?: ActivationCodeRecord;
}
