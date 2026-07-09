import type { ActivationStatus, LicenseStatus } from './licenseContract';
import type { PlanCode } from './planContract';

export type VendorVerificationStatus = 'Pending' | 'Verified' | 'Rejected';
export type VendorAccountStatus = 'Trial' | 'Active' | 'Suspended' | 'Rejected' | 'Closed';
export type VendorChildRecordStatus = 'Active' | 'Inactive' | 'Suspended';
export type VendorStaffRole = 'Owner' | 'Manager' | 'Supervisor' | 'Cashier' | 'Stock Controller' | 'Admin';
export type StaffRecordStatus = 'active' | 'suspended' | 'archived';
export type StaffRoleId = 'owner' | 'sysadmin' | 'manager' | 'supervisor' | 'cashier' | 'stock_controller' | 'delivery_staff' | 'accountant' | 'viewer';

export interface VendorRecord {
  vendorId: string;
  businessName: string;
  legalName: string;
  tradingName: string;
  ownerName: string;
  ownerEmail: string;
  googleEmail: string;
  googleUid?: string;
  phone: string;
  whatsapp: string;
  alternatePhone?: string;
  website?: string;
  businessType?: string;
  industry?: string;
  country: string;
  province?: string;
  city: string;
  suburb?: string;
  postalCode?: string;
  address?: string;
  physicalAddress?: string;
  vatRegistered: boolean;
  vatNumber?: string;
  taxNumber?: string;
  registrationNumber?: string;
  verificationStatus: VendorVerificationStatus;
  accountStatus: VendorAccountStatus;
  planCode: PlanCode;
  licenseStatus: LicenseStatus;
  activationStatus: ActivationStatus;
  defaultBranchId: string;
  defaultWarehouseId: string;
  defaultTerminalId: string;
  ownerStaffId: string;
  source: string;
  createdAt: string;
  updatedAt: string;
  verifiedAt?: string;
  verifiedBy?: string;
}

export interface VendorRegistrationRecord extends VendorRecord {
  registrationStatus: ActivationStatus;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNotes?: string;
  reviewReason?: string;
  syncStatus?: 'Synced' | 'PendingSync';
}

export interface VendorBranchRecord {
  vendorId: string;
  branchId: string;
  branchName: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  country?: string;
  province?: string;
  city?: string;
  suburb?: string;
  address?: string;
  status: VendorChildRecordStatus;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface VendorWarehouseRecord {
  vendorId: string;
  warehouseId: string;
  branchId: string;
  warehouseName: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  country?: string;
  province?: string;
  city?: string;
  suburb?: string;
  address?: string;
  status: VendorChildRecordStatus;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface VendorStaffRecord {
  vendorId: string;
  staffId: string;
  branchId: string;
  name: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  role: VendorStaffRole;
  status: VendorChildRecordStatus;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface StaffRecord {
  id: string;
  vendorId: string;
  branchId: string;
  staffCode: string;
  displayName: string;
  email: string;
  roleId: StaffRoleId;
  roleName: string;
  pinHash?: string;
  pinCode?: string;
  status: StaffRecordStatus;
  assignedTerminalIds?: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  uid?: string;
}

export interface VendorAuditLogRecord {
  auditLogId: string;
  vendorId: string;
  eventType: string;
  message: string;
  performedBy?: string;
  createdAt: string;
  updatedAt: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function sanitizeAuditIdPart(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'event';
}

export function createVendorAuditLog(vendorId: string, eventType: string, message: string): VendorAuditLogRecord {
  const now = nowIso();
  const safeEventType = eventType.trim() || 'VendorEvent';
  return {
    auditLogId: `${vendorId}_${sanitizeAuditIdPart(safeEventType)}_${Date.now()}`,
    vendorId,
    eventType: safeEventType,
    message,
    createdAt: now,
    updatedAt: now
  };
}

