const fs = require("fs");
const path = "src/App.tsx";
let text = fs.readFileSync(path, "utf8");

if (!text.includes("VendorLandingPage")) {
  text = text.replace(
    "import PosVendorAuthGate from './pos-new/auth/PosVendorAuthGate';",
    "import PosVendorAuthGate from './pos-new/auth/PosVendorAuthGate';\nimport VendorLandingPage from './sci-auth/VendorLandingPage';"
  );
}

if (!text.includes("currentPath === '/sci-auth-test'")) {
  text = text.replace(
    "  // If path is indeed /pos-prototype, mount our primary modern shell application",
    "  if (currentPath === '/sci-auth-test') {\n    return <VendorLandingPage />;\n  }\n\n  // If path is indeed /pos-prototype, mount our primary modern shell application"
  );
}

fs.writeFileSync(path, text, "utf8");
console.log("SCI auth landing test route added.");
