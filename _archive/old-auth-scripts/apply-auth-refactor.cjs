const fs = require("fs");

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function write(path, text) {
  fs.writeFileSync(path, text, "utf8");
}

// 1. Patch posVendorAuthState.ts
let path = "src/pos-new/auth/posVendorAuthState.ts";
let text = read(path);

text = text.replace(
`export type PosAuthStage =
  | 'checkingGoogleSession'
  | 'googleSignInRequired'
  | 'businessProfileRequired'
  | 'staffAccessRequired'
  | 'licenseRequired'
  | 'posReady';`,
`export type PosAuthStage =
  | 'checkingGoogleSession'
  | 'googleSignInRequired'
  | 'activationRequired'
  | 'businessProfileRequired'
  | 'staffAccessRequired'
  | 'licenseRequired'
  | 'posReady';`
);

const resolverStart = text.indexOf("export function resolveNextAuthStage");
const resolverEnd = text.indexOf("\n}", resolverStart) + 2;

const newResolver = `export function resolveNextAuthStage(context: PosVendorAuthContext): PosAuthStage {
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
}`;

text = text.slice(0, resolverStart) + newResolver + text.slice(resolverEnd);
write(path, text);


// 2. Patch PosVendorAuthGate.tsx
path = "src/pos-new/auth/PosVendorAuthGate.tsx";
text = read(path);

if (!text.includes("ActivationLandingPage")) {
  text = text.replace(
    `import VendorBusinessSetupPage from "../pages/VendorBusinessSetupPage";`,
    `import VendorBusinessSetupPage from "../pages/VendorBusinessSetupPage";
import ActivationLandingPage from "../pages/ActivationLandingPage";`
  );
}

if (!text.includes("POSActivationSnapshotLocal")) {
  text = text.replace(
    `import { getNextPlanCode } from "./planFeatureGate";`,
    `import { getNextPlanCode } from "./planFeatureGate";
import type { POSActivationSnapshotLocal } from "../shared/backend";`
  );
}

const handler = `  const handleActivationSuccess = (snapshot: POSActivationSnapshotLocal) => {
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

`;

if (!text.includes("const handleActivationSuccess = (snapshot: POSActivationSnapshotLocal)")) {
  text = text.replace(`  const resetAuthFlow = () => {`, handler + `  const resetAuthFlow = () => {`);
}

const activationRender = `  if (context.stage === "activationRequired") {
    return <ActivationLandingPage onActivated={handleActivationSuccess} />;
  }

`;

if (!text.includes(`context.stage === "activationRequired"`)) {
  text = text.replace(
    `  if (context.stage === "businessProfileRequired") {`,
    activationRender + `  if (context.stage === "businessProfileRequired") {`
  );
}

write(path, text);


// 3. Patch PosPrototypeApp.tsx
path = "src/pos-new/PosPrototypeApp.tsx";
text = read(path);

const startMarker = "  // Render loading state while checking activation";
const endMarker = "  // Guard the operational register with Staff Access";

const start = text.indexOf(startMarker);
const end = text.indexOf(endMarker);

if (start !== -1 && end !== -1) {
  const replacement = `  // Activation is now controlled by PosVendorAuthGate.
  // PosPrototypeApp only runs after Google Auth + Activation + Vendor Auth stages.

`;
  text = text.slice(0, start) + replacement + text.slice(end);
}

write(path, text);

console.log("AUTH refactor patch applied.");
