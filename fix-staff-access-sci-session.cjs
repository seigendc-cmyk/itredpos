const fs = require("fs");
const path = "src/pos-new/pages/PosStaffAccessPage.tsx";
let text = fs.readFileSync(path, "utf8");

text = text.replace(
`    if (pin !== "0000") {
      alert("Invalid access code. Default owner code is 0000.");
      return;
    }`,
`    if (pin !== "040369") {
      alert("Invalid access code. Default owner code is 040369.");
      return;
    }

    const sciOwnerSessionRaw = localStorage.getItem("sci_vendor_owner_session");
    const sciOwnerSession = sciOwnerSessionRaw ? JSON.parse(sciOwnerSessionRaw) : null;`
);

text = text.replace(
`      ...(context || {}),
      staffId: "owner-staff",
      staffRole,
      warehouseId,
      message: \`${staffName} signed into POS.\`
    };`,
`      ...(context || {}),
      vendorId: sciOwnerSession?.vendorId || context?.vendorId || "demo-vendor-001",
      vendorName: sciOwnerSession?.vendorName || context?.vendorName || "Demo Business",
      branchId: context?.branchId || "main-branch",
      warehouseId,
      staffId: sciOwnerSession?.staffId || "owner-staff",
      staffRole: "Owner",
      licenseStatus: "Active",
      activationStatus: "Active",
      message: \`${staffName} signed into POS.\`
    };`
);

text = text.replaceAll("Default owner code: 0000", "Default owner code: 040369");

fs.writeFileSync(path, text, "utf8");
console.log("PosStaffAccessPage now handshakes with SCI owner session and PIN 040369.");
