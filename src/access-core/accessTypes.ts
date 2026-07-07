export type AccessStage =
  | 'licenseRequired'
  | 'businessProfileRequired'
  | 'ownerSetupRequired'
  | 'staffAccessRequired'
  | 'posReady';

export type LicenseStatus = 'Unused' | 'Active' | 'Consumed' | 'Expired' | 'Revoked';

export interface AccessContext {
  vendorId: string;
  vendorName?: string;
  licenseTokenCode?: string;
  licenseStatus: LicenseStatus;
  businessProfileCreated: boolean;
  ownerCreated: boolean;
  staffAuthenticated: boolean;
  branchId?: string;
  warehouseId?: string;
  terminalId?: string;
}

export interface AccessStageResult {
  stage: AccessStage;
  context: AccessContext;
}
