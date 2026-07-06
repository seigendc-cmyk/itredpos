export type VendorStatus =
  | "Pending Verification"
  | "Approved"
  | "Active"
  | "Suspended"
  | "Rejected";

export type VendorLicenseMode = "demo" | "production";
export type VendorStorageMode = "localOnly" | "cloud";

export interface VendorRecord {
  vendorId: string;
  vendorCode: string;
  legalName: string;
  tradingName: string;
  email: string;
  phone: string;
  category: string;
  country: string;
  city: string;
  address: string;
  status: VendorStatus;
  assignedPlanId?: string;
  assignedPlanName?: string;
  licenseMode?: VendorLicenseMode;
  storageMode?: VendorStorageMode;
  linkedRpnId?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy?: string;
}
