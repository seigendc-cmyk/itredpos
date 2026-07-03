export type SCIRecordStatus =
  | "draft"
  | "pending"
  | "active"
  | "suspended"
  | "expired"
  | "revoked"
  | "rejected"
  | "archived";

export type SCILicenseMode = "demo" | "production";
export type SCIStorageMode = "localOnly" | "cloud";
export type SCIBillingCycle = "none" | "weekly" | "monthly" | "quarterly" | "yearly";

export interface SCIBaseRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}
