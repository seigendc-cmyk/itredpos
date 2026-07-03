import type {
  SCIBaseRecord,
  SCIRecordStatus,
  SCILicenseMode,
  SCIStorageMode,
  SCIBillingCycle,
} from "../commerce/baseTypes";

export interface SCIPlanRecord extends SCIBaseRecord {
  planId: string;
  planName: string;
  planCode: string;
  price: number;
  currency: string;
  billingCycle: SCIBillingCycle;
  status: SCIRecordStatus;
  maxBranches: number;
  maxTerminals: number;
  maxStaff: number;
  maxProducts: number;
}

export interface SCIPOSActivationRecord extends SCIBaseRecord {
  activationId: string;
  vendorId: string;
  vendorName: string;
  ownerEmail: string;
  licenseId: string;
  planId: string;
  planName: string;
  branchId: string;
  branchName: string;
  terminalId: string;
  terminalCode: string;
  status: SCIRecordStatus;
  licenseMode: SCILicenseMode;
  storageMode: SCIStorageMode;
  startsAt: string;
  expiresAt: string;
  maxBranches: number;
  maxTerminals: number;
  maxStaff: number;
  maxProducts: number;
  issuedBy: string;
  issuedAt: string;
}
