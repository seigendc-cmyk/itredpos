const fs = require("fs");

const servicePath = "src/sci-auth/StaffAuthService.ts";
let service = fs.readFileSync(servicePath, "utf8");

// Remove hard vendor mismatch blocking and trust current SCI session as authority
service = service.replace(
/if\s*\(\s*input\.vendorId\s*!==\s*session\.vendorId\s*\)\s*\{[\s\S]*?return\s*\{[\s\S]*?Staff does not belong to the current vendor\.[\s\S]*?\};\s*\}/,
`if (!session.vendorId) {
    return {
      ok: false,
      message: "No active SCI vendor session was found."
    };
  }`
);

service = service.replaceAll(
`vendorId: input.vendorId,`,
`vendorId: session.vendorId,`
);

fs.writeFileSync(servicePath, service, "utf8");


// Patch PosStaffAccess submit to pass SCI session vendorId
const pagePath = "src/pos-new/pages/PosStaffAccess.tsx";
let page = fs.readFileSync(pagePath, "utf8");

if (!page.includes("readSciVendorOwnerSession")) {
  page = page.replace(
    `import { loadStaffForCurrentVendor, authenticateStaffAccess } from '../../sci-auth/StaffAuthService';`,
    `import { loadStaffForCurrentVendor, authenticateStaffAccess, readSciVendorOwnerSession } from '../../sci-auth/StaffAuthService';`
  );
}

page = page.replace(
/vendorId:\s*vendors\[0\]\?\.id\s*\|\|\s*['"][^'"]+['"]/,
`vendorId: readSciVendorOwnerSession()?.vendorId || vendors[0]?.id || "demo-vendor-001"`
);

fs.writeFileSync(pagePath, page, "utf8");

console.log("Fixed Staff Access vendor handshake to use SCI session vendorId.");
