export interface BranchRecord {
  branchId: string;
  vendorId: string;
  branchCode: string;
  branchName: string;
  country: string;
  city: string;
  address: string;
  phone?: string;
  whatsapp?: string;
  status: "Active" | "Suspended" | "Closed";
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy?: string;
}
