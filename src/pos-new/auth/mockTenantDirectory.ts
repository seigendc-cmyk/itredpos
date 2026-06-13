import type {
  TenantBranchAccessContract,
  TenantMembershipContract,
  TenantStaffProfileContract,
  TenantTerminalAccessContract
} from './tenantResolutionTypes';

export const mockTenantMemberships: TenantMembershipContract[] = [
  {
    membershipId: 'MEM-DEMO-OWNER',
    vendorId: 'demo-vendor-001',
    vendorName: 'Build Development Vendor',
    signedInEmail: 'owner@build.local',
    role: 'VendorOwner',
    accessStatus: 'Active',
    isPrimaryVendor: true
  },
  {
    membershipId: 'MEM-DEMO-ADMIN',
    vendorId: 'demo-vendor-001',
    vendorName: 'Build Development Vendor',
    signedInEmail: 'admin@build.local',
    role: 'VendorAdmin',
    accessStatus: 'Active',
    isPrimaryVendor: true
  },
  {
    membershipId: 'MEM-DEMO-CASHIER',
    vendorId: 'demo-vendor-001',
    vendorName: 'Build Development Vendor',
    signedInEmail: 'cashier@build.local',
    role: 'Cashier',
    accessStatus: 'Active',
    isPrimaryVendor: true
  },
  {
    membershipId: 'MEM-DEMO-DISABLED',
    vendorId: 'demo-vendor-001',
    vendorName: 'Build Development Vendor',
    signedInEmail: 'disabled@build.local',
    role: 'Viewer',
    accessStatus: 'Disabled',
    isPrimaryVendor: true
  }
];

export const mockStaffProfiles: TenantStaffProfileContract[] = [
  { staffId: 'ST-OWNER', vendorId: 'demo-vendor-001', membershipId: 'MEM-DEMO-OWNER', staffName: 'Build Owner', staffCode: 'OWNER', role: 'VendorOwner', status: 'Active', pinRequired: false },
  { staffId: 'ST-ADMIN', vendorId: 'demo-vendor-001', membershipId: 'MEM-DEMO-ADMIN', staffName: 'Admin User', staffCode: 'ADMIN', role: 'VendorAdmin', status: 'Active', pinRequired: false },
  { staffId: 'ST-MARY', vendorId: 'demo-vendor-001', membershipId: 'MEM-DEMO-CASHIER', staffName: 'Mary Cashier', staffCode: 'MARY', role: 'Cashier', status: 'Active', pinRequired: false },
  { staffId: 'ST-BLESSING', vendorId: 'demo-vendor-001', membershipId: 'MEM-DEMO-ADMIN', staffName: 'Blessing Stock', staffCode: 'BLESSING', role: 'StockController', status: 'Active', pinRequired: false }
];

export const mockBranchAccess: TenantBranchAccessContract[] = [
  { branchAccessId: 'BA-OWNER-HARARE', vendorId: 'demo-vendor-001', branchId: 'BR-HARARE', branchName: 'Harare Main', staffId: 'ST-OWNER', accessStatus: 'Active' },
  { branchAccessId: 'BA-OWNER-BYO', vendorId: 'demo-vendor-001', branchId: 'BR-BYO', branchName: 'Bulawayo Branch', staffId: 'ST-OWNER', accessStatus: 'Active' },
  { branchAccessId: 'BA-ADMIN-HARARE', vendorId: 'demo-vendor-001', branchId: 'BR-HARARE', branchName: 'Harare Main', staffId: 'ST-ADMIN', accessStatus: 'Active' },
  { branchAccessId: 'BA-MARY-HARARE', vendorId: 'demo-vendor-001', branchId: 'BR-HARARE', branchName: 'Harare Main', staffId: 'ST-MARY', accessStatus: 'Active' },
  { branchAccessId: 'BA-BLESSING-BYO', vendorId: 'demo-vendor-001', branchId: 'BR-BYO', branchName: 'Bulawayo Branch', staffId: 'ST-BLESSING', accessStatus: 'Active' }
];

export const mockTerminalAccess: TenantTerminalAccessContract[] = [
  { terminalAccessId: 'TA-OWNER-POS01', vendorId: 'demo-vendor-001', branchId: 'BR-HARARE', terminalId: 'POS-01', terminalName: 'POS-01 Harare Front Counter', staffId: 'ST-OWNER', accessStatus: 'Active' },
  { terminalAccessId: 'TA-OWNER-BACK01', vendorId: 'demo-vendor-001', branchId: 'BR-HARARE', terminalId: 'BACK-01', terminalName: 'BACK-01 Harare Back Office', staffId: 'ST-OWNER', accessStatus: 'Active' },
  { terminalAccessId: 'TA-OWNER-POS02', vendorId: 'demo-vendor-001', branchId: 'BR-BYO', terminalId: 'POS-02', terminalName: 'POS-02 Bulawayo Counter', staffId: 'ST-OWNER', accessStatus: 'Active' },
  { terminalAccessId: 'TA-ADMIN-BACK01', vendorId: 'demo-vendor-001', branchId: 'BR-HARARE', terminalId: 'BACK-01', terminalName: 'BACK-01 Harare Back Office', staffId: 'ST-ADMIN', accessStatus: 'Active' },
  { terminalAccessId: 'TA-MARY-POS01', vendorId: 'demo-vendor-001', branchId: 'BR-HARARE', terminalId: 'POS-01', terminalName: 'POS-01 Harare Front Counter', staffId: 'ST-MARY', accessStatus: 'Active' },
  { terminalAccessId: 'TA-BLESSING-POS02', vendorId: 'demo-vendor-001', branchId: 'BR-BYO', terminalId: 'POS-02', terminalName: 'POS-02 Bulawayo Counter', staffId: 'ST-BLESSING', accessStatus: 'Active' }
];
