export interface SCIPOSSession {
  sessionId: string;
  vendorId: string;
  branchId: string;
  terminalId: string;
  licenseId: string;
  planId: string;
  ownerEmail: string;
  licenseMode: "demo" | "production";
  storageMode: "localOnly" | "cloud";
  openedAt: string;
}
