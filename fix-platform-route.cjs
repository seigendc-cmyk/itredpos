const fs = require("fs");
const path = "src/App.tsx";
let text = fs.readFileSync(path, "utf8");

const target = `  if (currentPath === '/platform/vendor-verification') {
    return <VendorVerificationQueuePage />;
  }`;

const replacement = `  if (currentPath === '/platform/vendor-verification') {
    return <VendorVerificationQueuePage />;
  }

  if (currentPath === '/platform/activation-tokens') {
    return <ActivationTokenManagerPage />;
  }`;

if (!text.includes("currentPath === '/platform/activation-tokens'")) {
  text = text.replace(target, replacement);
}

fs.writeFileSync(path, text, "utf8");
console.log("Route inserted.");
