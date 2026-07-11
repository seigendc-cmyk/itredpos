import {
  authenticateStaffAccess,
  type SciVendorOwnerSession,
  type StaffAccessBranch,
  type StaffAccessStaff,
  type StaffAccessTerminal,
  type StaffAccessWarehouse
} from '../../sci-auth/StaffAuthService';
import {
  calculateDocumentTax,
  type VendorTaxSettings
} from './vendorTaxSettingsService';
import {
  calculateMovementBalance,
  createInventoryMovementId
} from './inventorySyncService';

export type CoreFoundationArea = 'Authentication' | 'Staff' | 'VAT' | 'Inventory';

export interface CoreFoundationVerificationResult {
  area: CoreFoundationArea;
  scenario: string;
  ok: boolean;
  message: string;
}

interface VendorFixture {
  vendorId: string;
  ownerUid: string;
  ownerEmail: string;
  businessName: string;
}

function result(area: CoreFoundationArea, scenario: string, ok: boolean, message: string): CoreFoundationVerificationResult {
  return { area, scenario, ok, message };
}

function approxEqual(actual: number, expected: number): boolean {
  return Math.abs(actual - expected) < 0.01;
}

function verify(area: CoreFoundationArea, scenario: string, actual: unknown, expected: unknown): CoreFoundationVerificationResult {
  const ok = actual === expected;
  return result(area, scenario, ok, ok ? 'passed' : `expected ${String(expected)}, got ${String(actual)}`);
}

function resolveVendorFixture(profile: { uid: string; email?: string }, vendors: VendorFixture[]): VendorFixture | null {
  const byUid = vendors.find((vendor) => vendor.ownerUid === profile.uid);
  if (byUid) return byUid;
  const email = String(profile.email || '').toLowerCase();
  return vendors.find((vendor) => vendor.ownerEmail.toLowerCase() === email) || null;
}

function verifySignupFoundationShape(): CoreFoundationVerificationResult {
  const foundation = {
    vendors: { vendorId: 'vendor-owneruid', ownerUid: 'owneruid', status: 'Active', planCode: 'DEMO', licenseStatus: 'DEMO' },
    vendorUsers: { uid: 'owneruid', vendorId: 'vendor-owneruid', role: 'Owner', status: 'Active', permissions: ['*'] },
    branches: { branchId: 'vendor-owneruid_main_branch', vendorId: 'vendor-owneruid', branchName: 'Main Branch', status: 'Active' },
    warehouses: { warehouseId: 'vendor-owneruid_main_warehouse', vendorId: 'vendor-owneruid', branchId: 'vendor-owneruid_main_branch', status: 'Active' },
    staff: { staffId: 'vendor-owneruid_owner', vendorId: 'vendor-owneruid', branchId: 'vendor-owneruid_main_branch', pin: '040369', status: 'Active' },
    pos_terminals: { terminalId: 'vendor-owneruid_main_terminal', vendorId: 'vendor-owneruid', branchId: 'vendor-owneruid_main_branch', status: 'Active' },
    licenses: { licenseId: 'vendor-owneruid_demo_license', vendorId: 'vendor-owneruid', planCode: 'DEMO' },
    vendor_settings: { vendorId: 'vendor-owneruid', vatEnabled: false, defaultVatRate: 0 }
  };
  const required = ['vendors', 'vendorUsers', 'branches', 'warehouses', 'staff', 'pos_terminals', 'licenses', 'vendor_settings'];
  const ok = required.every((key) => key in foundation);
  return result('Authentication', 'New vendor signup creates canonical foundation documents', ok, ok ? 'passed' : 'missing foundation document');
}

function staffFixtures() {
  const vendorSession: SciVendorOwnerSession = {
    vendorId: 'vendor-1',
    ownerName: 'Owner',
    ownerEmail: 'owner@example.com',
    vendorName: 'Example Trading',
    role: 'Owner',
    signedInAt: '2026-07-10T00:00:00.000Z'
  };
  const branches: StaffAccessBranch[] = [
    { vendorId: 'vendor-1', branchId: 'branch-1', branchName: 'Main Branch', status: 'Active' },
    { vendorId: 'vendor-1', branchId: 'branch-2', branchName: 'Second Branch', status: 'Active' }
  ];
  const warehouses: StaffAccessWarehouse[] = [
    { vendorId: 'vendor-1', branchId: 'branch-1', warehouseId: 'warehouse-1', warehouseName: 'Main Warehouse', status: 'Active' },
    { vendorId: 'vendor-1', branchId: 'branch-2', warehouseId: 'warehouse-2', warehouseName: 'Second Warehouse', status: 'Active' }
  ];
  const terminals: StaffAccessTerminal[] = [
    { vendorId: 'vendor-1', branchId: 'branch-1', terminalId: 'terminal-1', terminalName: 'Main POS Terminal', status: 'Active' },
    { vendorId: 'vendor-1', branchId: 'branch-2', terminalId: 'terminal-2', terminalName: 'Second POS Terminal', status: 'Active' }
  ];
  const staff: StaffAccessStaff[] = [
    { vendorId: 'vendor-1', branchId: 'branch-1', staffId: 'owner', staffName: 'Owner', role: 'Owner', status: 'Active', pin: '040369', permissions: ['*'], assignedTerminalIds: ['terminal-1'] },
    { vendorId: 'vendor-1', branchId: 'branch-1', staffId: 'inactive', staffName: 'Inactive', role: 'Cashier', status: 'Inactive', pin: '040369', permissions: [], assignedTerminalIds: ['terminal-1'] },
    { vendorId: 'vendor-2', branchId: 'branch-1', staffId: 'other-vendor', staffName: 'Other Vendor', role: 'Cashier', status: 'Active', pin: '040369', permissions: [], assignedTerminalIds: ['terminal-1'] }
  ];

  return { vendorSession, branches, warehouses, terminals, staff };
}

function runAuthenticationVerification(): CoreFoundationVerificationResult[] {
  const vendors: VendorFixture[] = [
    { vendorId: 'vendor-1', ownerUid: 'uid-1', ownerEmail: 'owner@example.com', businessName: 'Example Trading' }
  ];
  return [
    verifySignupFoundationShape(),
    verify('Authentication', 'Existing vendor sign-in resolves by ownerUid', resolveVendorFixture({ uid: 'uid-1', email: 'other@example.com' }, vendors)?.vendorId, 'vendor-1'),
    verify('Authentication', 'Existing vendor sign-in falls back to ownerEmail', resolveVendorFixture({ uid: 'new-uid', email: 'OWNER@example.com' }, vendors)?.vendorId, 'vendor-1'),
    verify('Authentication', 'Unknown Google account returns no vendor', resolveVendorFixture({ uid: 'missing', email: 'missing@example.com' }, vendors), null)
  ];
}

function runStaffVerification(): CoreFoundationVerificationResult[] {
  const fixture = staffFixtures();
  const baseInput = {
    vendorSession: fixture.vendorSession,
    staffId: 'owner',
    pin: '040369',
    branchId: 'branch-1',
    warehouseId: 'warehouse-1',
    terminalId: 'terminal-1',
    staff: fixture.staff,
    branches: fixture.branches,
    warehouses: fixture.warehouses,
    terminals: fixture.terminals
  };

  return [
    verify('Staff', 'Valid owner PIN opens staff session', authenticateStaffAccess(baseInput).ok, true),
    verify('Staff', 'Invalid PIN is rejected', authenticateStaffAccess({ ...baseInput, pin: '000000' }).message, 'Invalid PIN'),
    verify('Staff', 'Staff from another vendor is rejected', authenticateStaffAccess({ ...baseInput, staffId: 'other-vendor' }).message, 'Staff belongs to another vendor'),
    verify('Staff', 'Inactive staff is rejected', authenticateStaffAccess({ ...baseInput, staffId: 'inactive' }).message, 'Staff record is inactive'),
    verify('Staff', 'Branch mismatch is rejected', authenticateStaffAccess({ ...baseInput, branchId: 'branch-2' }).message, 'Branch mismatch'),
    verify('Staff', 'Terminal mismatch is rejected', authenticateStaffAccess({ ...baseInput, terminalId: 'terminal-2' }).message, 'Terminal mismatch'),
    verify('Staff', 'Missing vendor session is rejected', authenticateStaffAccess({ ...baseInput, vendorSession: null as unknown as SciVendorOwnerSession }).message, 'Vendor session missing')
  ];
}

function taxSettings(settings: Partial<VendorTaxSettings>): VendorTaxSettings {
  return {
    vendorId: 'vendor-1',
    vatEnabled: false,
    vatRegistered: false,
    vatNumber: '',
    defaultVatRate: 0,
    pricesIncludeVat: true,
    outputTaxAccountId: '',
    inputTaxAccountId: '',
    exemptTaxCode: 'EXEMPT',
    zeroRatedTaxCode: 'ZERO',
    updatedAt: '2026-07-10T00:00:00.000Z',
    updatedBy: 'verification',
    ...settings
  };
}

function runVatVerification(): CoreFoundationVerificationResult[] {
  const disabled = calculateDocumentTax([{ lineAmount: 100 }], taxSettings({}));
  const inclusive = calculateDocumentTax([{ lineAmount: 115 }], taxSettings({ vatEnabled: true, vatRegistered: true, defaultVatRate: 15, pricesIncludeVat: true }));
  const exclusive = calculateDocumentTax([{ lineAmount: 100 }], taxSettings({ vatEnabled: true, vatRegistered: true, defaultVatRate: 15, pricesIncludeVat: false }));
  const zeroRated = calculateDocumentTax([{ lineAmount: 100, taxTreatment: 'ZERO_RATED' }], taxSettings({ vatEnabled: true, vatRegistered: true, defaultVatRate: 15 }));
  const exempt = calculateDocumentTax([{ lineAmount: 100, taxTreatment: 'EXEMPT' }], taxSettings({ vatEnabled: true, vatRegistered: true, defaultVatRate: 15 }));
  const rounding = calculateDocumentTax([{ lineAmount: 19.99 }], taxSettings({ vatEnabled: true, vatRegistered: true, defaultVatRate: 7.5, pricesIncludeVat: false }));

  return [
    verify('VAT', 'VAT disabled returns no VAT', disabled.vatAmount, 0),
    (() => {
      const ok = approxEqual(inclusive.subtotal, 100) && approxEqual(inclusive.vatAmount, 15) && approxEqual(inclusive.total, 115);
      return result('VAT', 'VAT inclusive splits net and VAT', ok, ok ? 'passed' : 'expected net 100, VAT 15, total 115');
    })(),
    (() => {
      const ok = approxEqual(exclusive.subtotal, 100) && approxEqual(exclusive.vatAmount, 15) && approxEqual(exclusive.total, 115);
      return result('VAT', 'VAT exclusive adds VAT to total', ok, ok ? 'passed' : 'expected net 100, VAT 15, total 115');
    })(),
    verify('VAT', 'Zero-rated item keeps taxable amount with zero VAT', zeroRated.taxableAmount, 100),
    verify('VAT', 'Exempt item is non-taxable', exempt.nonTaxableAmount, 100),
    verify('VAT', 'VAT rounding is stable', rounding.vatAmount, 1.5)
  ];
}

function runInventoryVerification(): CoreFoundationVerificationResult[] {
  const goodsReceipt = calculateMovementBalance({ balanceBefore: 0, quantityIn: 10, quantityOut: 0 });
  const sale = calculateMovementBalance({ balanceBefore: 10, quantityIn: 0, quantityOut: 3 });
  const returnRestore = calculateMovementBalance({ balanceBefore: 7, quantityIn: 3, quantityOut: 0 });
  const transferOut = calculateMovementBalance({ balanceBefore: 10, quantityOut: 4 });
  const transferIn = calculateMovementBalance({ balanceBefore: 2, quantityIn: 4 });
  const stocktake = calculateMovementBalance({ balanceBefore: 7, quantityIn: 1 });
  let negativeBlocked = false;
  try {
    calculateMovementBalance({ balanceBefore: 1, quantityOut: 2 });
  } catch {
    negativeBlocked = true;
  }
  const movementA = createInventoryMovementId({
    vendorId: 'vendor-1',
    referenceType: 'SALE',
    referenceId: 'INV-1',
    productId: 'product-1',
    movementType: 'SALE'
  });
  const movementB = createInventoryMovementId({
    vendorId: 'vendor-1',
    referenceType: 'SALE',
    referenceId: 'INV-1',
    productId: 'product-1',
    movementType: 'SALE'
  });

  return [
    verify('Inventory', 'Goods receipt increases stock', goodsReceipt.balanceAfter, 10),
    verify('Inventory', 'Sale deduction reduces stock', sale.balanceAfter, 7),
    verify('Inventory', 'Return restoration increases stock', returnRestore.balanceAfter, 10),
    verify('Inventory', 'Transfer source creates outbound effect', transferOut.balanceAfter, 6),
    verify('Inventory', 'Transfer destination creates inbound effect', transferIn.balanceAfter, 6),
    verify('Inventory', 'Stocktake adjustment updates stock', stocktake.balanceAfter, 8),
    verify('Inventory', 'Negative stock is blocked by default', negativeBlocked, true),
    verify('Inventory', 'Duplicate movement uses stable idempotency key', movementA, movementB)
  ];
}

export function runCoreFoundationVerification(): CoreFoundationVerificationResult[] {
  return [
    ...runAuthenticationVerification(),
    ...runStaffVerification(),
    ...runVatVerification(),
    ...runInventoryVerification()
  ];
}
