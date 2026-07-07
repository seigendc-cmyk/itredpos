const fs = require("fs");
const path = "src/App.tsx";
let text = fs.readFileSync(path, "utf8");

if (!text.includes("ActivationTokenManagerPage")) {
  text = text.replace(
    "import VendorVerificationQueuePage from './platform/VendorVerificationQueuePage';",
    "import VendorVerificationQueuePage from './platform/VendorVerificationQueuePage';\nimport ActivationTokenManagerPage from './platform/ActivationTokenManagerPage';"
  );
}

if (!text.includes("currentPath === '/platform/activation-tokens'")) {
  text = text.replace(
`  if (currentPath === '/platform/vendor-verification') {
    return <VendorVerificationQueuePage />;
  }`,
`  if (currentPath === '/platform/vendor-verification') {
    return <VendorVerificationQueuePage />;
  }

  if (currentPath === '/platform/activation-tokens') {
    return <ActivationTokenManagerPage />;
  }`
  );
}

fs.writeFileSync(path, text, "utf8");
console.log("Activation token manager route added.");
