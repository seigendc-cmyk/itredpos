export interface VendorBootstrapProfile {
  vendorId: string;
  businessName: string;
  tradingName: string;
  ownerName: string;
  ownerEmail: string;
  phone: string;
  whatsapp: string;
  businessType: string;
  country: string;
  city: string;

  defaultBranchName: string;
  defaultWarehouseName: string;

  ownerStaffName: string;
  ownerPin: string;

  planCode: string;
  trialDays: number;

  createdAt: string;
}

export function createEmptyVendorBootstrap(): VendorBootstrapProfile {

  return {

    vendorId: '',

    businessName: '',
    tradingName: '',

    ownerName: '',
    ownerEmail: '',

    phone: '',
    whatsapp: '',

    businessType: '',

    country: 'Zimbabwe',
    city: '',

    defaultBranchName: 'Main Branch',

    defaultWarehouseName: 'Main Warehouse',

    ownerStaffName: 'Owner',

    ownerPin: '0000',

    planCode: 'DEMO',

    trialDays: 3,

    createdAt: new Date().toISOString()

  };

}
