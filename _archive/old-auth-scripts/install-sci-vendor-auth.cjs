const fs = require("fs");

// 1. Create SCI VendorAuthGate
fs.mkdirSync("src/sci-auth", { recursive: true });

fs.writeFileSync("src/sci-auth/VendorAuthGate.tsx", `
import VendorLandingPage from "./VendorLandingPage";

type VendorAuthGateProps = {
  children: React.ReactNode;
};

const SESSION_KEY = "sci_vendor_owner_session";

export default function VendorAuthGate({ children }: VendorAuthGateProps) {
  const hasSession = Boolean(localStorage.getItem(SESSION_KEY));

  if (!hasSession) {
    return <VendorLandingPage />;
  }

  return <>{children}</>;
}
`, "utf8");


// 2. Patch App.tsx to use SCI VendorAuthGate for /pos-prototype
let path = "src/App.tsx";
let text = fs.readFileSync(path, "utf8");

if (!text.includes("import VendorAuthGate from './sci-auth/VendorAuthGate';")) {
  text = text.replace(
    "import PosPrototypeApp from './pos-new/PosPrototypeApp';",
    "import PosPrototypeApp from './pos-new/PosPrototypeApp';\nimport VendorAuthGate from './sci-auth/VendorAuthGate';"
  );
}

text = text.replace(/<SimpleAuthGate>\s*<PosPrototypeApp \/>[\s\S]*?<\/SimpleAuthGate>/, `<VendorAuthGate>
        <PosPrototypeApp />
      </VendorAuthGate>`);

text = text.replace(/<PosVendorAuthGate>\s*<PosPrototypeApp \/>[\s\S]*?<\/PosVendorAuthGate>/, `<VendorAuthGate>
        <PosPrototypeApp />
      </VendorAuthGate>`);

fs.writeFileSync(path, text, "utf8");


// 3. Patch VendorLandingPage completion to create vendor session
path = "src/sci-auth/VendorLandingPage.tsx";
text = fs.readFileSync(path, "utf8");

if (!text.includes('"sci_vendor_owner_session"')) {
  text = text.replace(
    `localStorage.setItem("itred_pos_start_page", "SETTINGS");`,
    `localStorage.setItem("itred_pos_start_page", "SETTINGS");
    localStorage.setItem("sci_vendor_owner_session", JSON.stringify({
      vendorId: "demo-vendor-001",
      ownerName: profile.ownerName,
      ownerEmail: profile.ownerEmail,
      vendorName: profile.businessName,
      role: "Owner",
      mode: "DEMO"
    }));`
  );
}

fs.writeFileSync(path, text, "utf8");


// 4. Disable POS upgrade blockers and force demo mode
path = "src/pos-new/PosPrototypeApp.tsx";
text = fs.readFileSync(path, "utf8");

text = text.replace(
  "if (runtimeLicense && !runtimeLicense.allowed) {",
  "if (false && runtimeLicense && !runtimeLicense.allowed) {"
);

text = text.replace(
  "const isPagePlanLocked = !isPageRestricted && Boolean(activePagePlanAccess && !activePagePlanAccess.allowed);",
  "const isPagePlanLocked = false;"
);

text = text.replace(
  "{!planLimitNotice && activePage === 'DASHBOARD' && licenseNotice && (licenseNotice.kind === 'trial' || licenseNotice.kind === 'pending') && (",
  "{false && !planLimitNotice && activePage === 'DASHBOARD' && licenseNotice && (licenseNotice.kind === 'trial' || licenseNotice.kind === 'pending') && ("
);

fs.writeFileSync(path, text, "utf8");

console.log("SCI VendorAuthGate installed and upgrade blockers disabled.");
