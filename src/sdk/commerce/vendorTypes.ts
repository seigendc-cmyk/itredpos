import type { SCIBaseRecord, SCIRecordStatus } from "./baseTypes";

export interface SCIVendorRecord extends SCIBaseRecord {
  vendorId: string;
  businessName: string;
  tradingName?: string;
  industrialSector?: string;
  businessType?: string;
  ownerEmail: string;
  contactPerson?: string;
  contactPhone?: string;
  whatsappNumber?: string;
  email?: string;
  country: string;
  city: string;
  physicalAddress?: string;
  area?: string;
  status: SCIRecordStatus;
}
