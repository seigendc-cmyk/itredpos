const fs = require("fs");
const path = "src/pos-new/pages/PosStaffAccess.tsx";
let text = fs.readFileSync(path, "utf8");

text = text.replace(
/const handleSubmit = \(e: FormEvent\) => \{[\s\S]*?\n  \};\n\n  const handleQuickFill/,
`const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!password.trim()) {
      setErrorMsg("AUTHENTICATION BLOCKED: PIN/PASSWORD REQUIRED FOR ACCESS TOKEN CREATION");
      return;
    }

    if (password !== "040369") {
      setErrorMsg("INVALID PIN. OWNER ACCESS CODE IS 040369.");
      return;
    }

    const rawSession = localStorage.getItem("sci_vendor_owner_session");
    const sciSession = rawSession ? JSON.parse(rawSession) : {};

    onLoginSuccess({
      vendor: sciSession.vendorName || selectedVendor || "Demo Business",
      vendorId: sciSession.vendorId || "demo-vendor-001",
      branch: "Main Branch",
      branchId: "main-branch",
      terminal: "Main POS Terminal",
      terminalId: "TERM-MAIN-001",
      staffName: sciSession.ownerName || "Owner",
      role: "Owner",
      licenseId: "demo-license",
      planId: "DEMO",
      licenseMode: "demo",
      storageMode: "LOCAL",
      activationId: "demo-activation"
    });
  };

  const handleQuickFill`
);

fs.writeFileSync(path, text, "utf8");
console.log("Direct owner PIN POS opening patched.");
