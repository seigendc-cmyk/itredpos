import type { SCIBaseRecord, SCIRecordStatus } from "./baseTypes";

export interface SCIBranchRecord extends SCIBaseRecord {
  branchId: string;
  vendorId: string;
  branchName: string;
  branchCode: string;
  country?: string;
  city?: string;
  address?: string;
  status: SCIRecordStatus;
}

export interface SCIPOSTerminalRecord extends SCIBaseRecord {
  terminalId: string;
  vendorId: string;
  branchId: string;
  terminalName: string;
  terminalCode: string;
  status: SCIRecordStatus;
}
