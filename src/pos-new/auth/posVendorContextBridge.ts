import { readPosAuthContext, savePosAuthContext, type PosVendorAuthContext } from "./posVendorAuthState";
import { resolveVendorContext, type VendorContext } from "../../shared/services";

export interface PosVendorContextBridgeResult {
  ok: boolean;
  message: string;
  context?: VendorContext;
}

function text(value: unknown, fallback = ""): string {
  const clean = String(value ?? "").trim();
  return clean || fallback;
}

export async function refreshPosVendorContext(): Promise<PosVendorContextBridgeResult> {
  const auth = readPosAuthContext();

  if (!auth?.vendorId) {
    return {
      ok: false,
      message: "Vendor ID is not available yet."
    };
  }

  try {
    const vendorContext = await resolveVendorContext(auth.vendorId);
    const vendor = vendorContext.vendor || {};
    const license = vendorContext.license || {};
    const plan = vendorContext.plan || {};
    const firstBranch = vendorContext.branches[0] || {};
    const firstWarehouse = vendorContext.warehouses[0] || {};
    const firstStaff = vendorContext.staff[0] || {};

    const nextAuth: PosVendorAuthContext = {
      ...auth,
      vendorName: text(vendor["tradingName"], text(vendor["businessName"], auth.vendorName)),
      branchId: text(firstBranch["branchId"], auth.branchId),
      warehouseId: text(firstWarehouse["warehouseId"], auth.warehouseId),
      staffId: text(firstStaff["staffId"], auth.staffId),
      staffRole: text(firstStaff["role"], auth.staffRole),
      planCode: text(plan["planCode"], text(license["planCode"], auth.planCode || "DEMO")),
      licenseStatus: text(license["licenseStatus"], auth.licenseStatus || "Demo") as PosVendorAuthContext["licenseStatus"],
      activationStatus: text(license["activationStatus"], auth.activationStatus),
      accountStatus: text(vendor["accountStatus"], auth.accountStatus),
      verificationStatus: text(vendor["verificationStatus"], auth.verificationStatus),
      trialStartedAt: text(license["trialStartedAt"], auth.trialStartedAt),
      trialExpiresAt: text(license["trialExpiresAt"], auth.trialExpiresAt),
      message: "Vendor context synchronized."
    };

    savePosAuthContext(nextAuth);

    return {
      ok: true,
      message: "Vendor context synchronized.",
      context: vendorContext
    };
  } catch {
    return {
      ok: false,
      message: "Working offline. Vendor context will sync when connection returns."
    };
  }
}
