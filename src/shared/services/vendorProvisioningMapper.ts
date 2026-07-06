import type {
  BranchRecord,
  PosLicenseRecord,
  TerminalRecord,
  VendorRecord
} from "../schemas";

export type VendorProvisioningInput = {
  vendorId: string;
  businessName: string;
  tradingName?: string;
  ownerEmail: string;
  phone: string;
  whatsapp?: string;
  category?: string;
  country?: string;
  city?: string;
  address?: string;
  branchId: string;
  branchName: string;
  branchPhone?: string;
  branchWhatsapp?: string;
  branchAddress?: string;
  terminalId: string;
  terminalName: string;
  planId?: string;
  createdBy: string;
};

function clean(value: unknown, fallback = ""): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

export function buildSharedVendorRecords(input: VendorProvisioningInput): {
  vendor: VendorRecord;
  branch: BranchRecord;
  terminal: TerminalRecord;
  license: PosLicenseRecord;
} {
  const now = new Date().toISOString();
  const vendorName = clean(input.businessName, "Vendor");
  const tradingName = clean(input.tradingName, vendorName);
  const planId = clean(input.planId, "DEMO");
  const licenseId = `${input.vendorId}_${input.terminalId}_license`;
  const licenseKey = `DEMO-${input.vendorId}-${input.terminalId}`.toUpperCase();

  const vendor: VendorRecord = {
    vendorId: input.vendorId,
    vendorCode: input.vendorId,
    legalName: vendorName,
    tradingName,
    email: clean(input.ownerEmail),
    phone: clean(input.phone),
    category: clean(input.category, "Retail"),
    country: clean(input.country, "Zimbabwe"),
    city: clean(input.city),
    address: clean(input.address),
    status: "Pending Verification",
    assignedPlanId: planId,
    assignedPlanName: planId,
    licenseMode: "demo",
    storageMode: "cloud",
    createdAt: now,
    updatedAt: now,
    createdBy: clean(input.createdBy, "POS_ONBOARDING")
  };

  const branch: BranchRecord = {
    branchId: input.branchId,
    vendorId: input.vendorId,
    branchCode: input.branchId,
    branchName: clean(input.branchName, "Main Branch"),
    country: clean(input.country, "Zimbabwe"),
    city: clean(input.city),
    address: clean(input.branchAddress || input.address),
    phone: clean(input.branchPhone || input.phone),
    whatsapp: clean(input.branchWhatsapp || input.whatsapp),
    status: "Active",
    createdAt: now,
    updatedAt: now,
    createdBy: clean(input.createdBy, "POS_ONBOARDING")
  };

  const terminal: TerminalRecord = {
    terminalId: input.terminalId,
    vendorId: input.vendorId,
    branchId: input.branchId,
    terminalName: clean(input.terminalName, "Main POS Terminal"),
    terminalCode: input.terminalId,
    status: "Active",
    licenseId,
    activationStatus: "Activated",
    createdAt: now,
    updatedAt: now,
    createdBy: clean(input.createdBy, "POS_ONBOARDING")
  };

  const license: PosLicenseRecord = {
    licenseId,
    vendorId: input.vendorId,
    vendorName: tradingName,
    branchId: input.branchId,
    terminalId: input.terminalId,
    planId,
    licenseKey,
    status: "Demo",
    issuedAt: now,
    expiryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: now,
    updatedAt: now,
    createdBy: clean(input.createdBy, "POS_ONBOARDING")
  };

  return { vendor, branch, terminal, license };
}
