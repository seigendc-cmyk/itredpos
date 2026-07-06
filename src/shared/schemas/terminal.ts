export interface TerminalRecord {
  terminalId: string;
  vendorId: string;
  branchId: string;
  terminalName: string;
  terminalCode: string;
  status: "Pending Activation" | "Active" | "Locked" | "Suspended";
  licenseId?: string;
  activationStatus: "Pending" | "Activated" | "Rejected" | "Revoked";
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy?: string;
}
