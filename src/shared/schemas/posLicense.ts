export interface PosLicenseRecord {
  licenseId: string;
  vendorId: string;
  vendorName: string;
  branchId: string;
  terminalId: string;
  planId: string;
  licenseKey: string;
  status: "Demo" | "Active" | "Expired" | "Suspended" | "Revoked";
  issuedAt: string;
  expiryDate: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy?: string;
}
