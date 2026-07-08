from pathlib import Path

# 1. Patch posVendorAuthState.ts
path = Path("src/pos-new/auth/posVendorAuthState.ts")
text = path.read_text()

text = text.replace(
"""export type PosAuthStage =
  | 'checkingGoogleSession'
  | 'googleSignInRequired'
  | 'businessProfileRequired'
  | 'staffAccessRequired'
  | 'licenseRequired'
  | 'posReady';""",
"""export type PosAuthStage =
  | 'checkingGoogleSession'
  | 'googleSignInRequired'
  | 'activationRequired'
  | 'businessProfileRequired'
  | 'staffAccessRequired'
  | 'licenseRequired'
  | 'posReady';"""
)

start = text.index("export function resolveNextAuthStage")
end = text.index("\n}", start) + 2

new_resolver = """export function resolveNextAuthStage(context: PosVendorAuthContext): PosAuthStage {
  if (!context.googleUid || !context.googleEmail) return 'googleSignInRequired';

  if (!context.vendorId || !context.vendorName) return 'activationRequired';

  const statusValues = [
    context.licenseStatus,
    context.activationStatus,
    context.accountStatus,
    context.verificationStatus
  ].map((value) => String(value || '').toLowerCase());

  if (
    context.licenseStatus === 'Expired' ||
    statusValues.some((value) => value === 'suspended' || value === 'rejected')
  ) {
    return 'licenseRequired';
  }

  if (!context.branchId || !context.warehouseId) return 'businessProfileRequired';

  if (!context.staffId || !context.staffRole) return 'staffAccessRequired';

  return 'posReady';
}"""

text = text[:start] + new_resolver + text[end:]
path.write_text(text)


# 2. Patch PosVendorAuthGate.tsx
path = Path("src/pos-new/auth/PosVendorAuthGate.tsx")
text = path.read_text()

if 'ActivationLandingPage' not in text:
    text = text.replace(
        'import VendorBusinessSetupPage from "../pages/VendorBusinessSetupPage";',
        'import VendorBusinessSetupPage from "../pages/VendorBusinessSetupPage";\nimport ActivationLandingPage from "../pages/ActivationLandingPage";'
    )

if 'POSActivationSnapshotLocal' not in text:
    text = text.replace(
        'import { getNextPlanCode } from "./planFeatureGate";',
        'import { getNextPlanCode } from "./planFeatureGate";\nimport type { POSActivationSnapshotLocal } from "../shared/backend";'
    )

insert_before = "  const resetAuthFlow = () => {"

activation_handler = """  const handleActivationSuccess = (snapshot: POSActivationSnapshotLocal) => {
    setContextSafe((current) => {
      const baseContext: PosVendorAuthContext = {
        ...current,
        vendorId: snapshot.vendorId,
        vendorName: snapshot.vendorName,
        planCode: snapshot.planCode,
        licenseMode: snapshot.licenseMode,
        licenseStatus: "Active",
        activationStatus: "Active",
        activatedAt: snapshot.activatedAt
      };

      return {
        ...baseContext,
        stage: resolveNextAuthStage(baseContext)
      };
    });
  };

"""

if "const handleActivationSuccess = (snapshot: POSActivationSnapshotLocal)" not in text:
    text = text.replace(insert_before, activation_handler + insert_before)

activation_render = """  if (context.stage === "activationRequired") {
    return <ActivationLandingPage onActivated={handleActivationSuccess} />;
  }

"""

if 'context.stage === "activationRequired"' not in text:
    text = text.replace(
        '  if (context.stage === "businessProfileRequired") {',
        activation_render + '  if (context.stage === "businessProfileRequired") {'
    )

path.write_text(text)


# 3. Patch PosPrototypeApp.tsx
path = Path("src/pos-new/PosPrototypeApp.tsx")
text = path.read_text()

start_marker = "  // Render loading state while checking activation"
end_marker = "  // Guard the operational register with Staff Access"

start = text.find(start_marker)
end = text.find(end_marker)

if start != -1 and end != -1:
    replacement = """  // Activation is now controlled by PosVendorAuthGate.
  // PosPrototypeApp only runs after Google Auth + Activation + Vendor Auth stages.

"""
    text = text[:start] + replacement + text[end:]

path.write_text(text)

print("AUTH refactor patch applied.")
