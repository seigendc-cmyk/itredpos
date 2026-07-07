const fs = require("fs");
const path = "src/App.tsx";
let text = fs.readFileSync(path, "utf8");

if (!text.includes("PosVendorAuthGate")) {
  text = text.replace(
    "import PosPrototypeApp from './pos-new/PosPrototypeApp';",
    "import PosPrototypeApp from './pos-new/PosPrototypeApp';\nimport PosVendorAuthGate from './pos-new/auth/PosVendorAuthGate';"
  );
}

text = text.replace(
  "return <PosPrototypeApp />;",
  "return (\n      <PosVendorAuthGate>\n        <PosPrototypeApp />\n      </PosVendorAuthGate>\n    );"
);

fs.writeFileSync(path, text, "utf8");
console.log("App.tsx wrapped with PosVendorAuthGate.");
