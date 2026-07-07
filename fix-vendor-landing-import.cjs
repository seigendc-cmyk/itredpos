const fs = require("fs");
const path = "src/App.tsx";
let text = fs.readFileSync(path, "utf8");

if (!text.includes("import VendorLandingPage from './sci-auth/VendorLandingPage';")) {
  text = text.replace(
    "import PosPrototypeApp from './pos-new/PosPrototypeApp';",
    "import PosPrototypeApp from './pos-new/PosPrototypeApp';\nimport VendorLandingPage from './sci-auth/VendorLandingPage';"
  );
}

fs.writeFileSync(path, text, "utf8");
console.log("VendorLandingPage import added.");
