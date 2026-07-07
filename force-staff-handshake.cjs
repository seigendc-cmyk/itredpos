const fs = require("fs");
const path = "src/pos-new/pages/PosStaffAccess.tsx";
let text = fs.readFileSync(path, "utf8");

// Force correct import
if (!text.includes("StaffAuthService")) {
  text = text.replace(
    `import { getCurrentTenantSession, loadBranchesForCurrentTenant, loadStaffProfilesForCurrentTenant, loadTerminalsForCurrentBranch } from '../auth/tenantSessionService';`,
    `import { loadStaffForCurrentVendor, authenticateStaffAccess } from '../../sci-auth/StaffAuthService';`
  );
}

// Force staff access data source
text = text.replace(
/const tenantSession[\s\S]*?const \[selectedVendor, setSelectedVendor\]/,
`const staffProfiles = loadStaffForCurrentVendor();
  const ownerStaff = staffProfiles[0];

  const vendors = [{ id: ownerStaff?.vendorId || 'demo-vendor-001', name: ownerStaff?.vendorName || 'Demo Business' }];
  const branches = [{ id: ownerStaff?.branchId || 'main-branch', name: 'Main Branch', location: 'Main Branch' }];
  const terminals = [{ id: ownerStaff?.terminalId || 'TERM-MAIN-001', name: 'Main POS Terminal', branchId: ownerStaff?.branchId || 'main-branch', type: 'POS' }];
  const staffList = staffProfiles.map((staff) => ({
    id: staff.staffId,
    name: staff.staffName,
    email: staff.staffEmail || '',
    role: staff.role,
    pass: '',
    branchId: staff.branchId
  }));

  const [selectedVendor, setSelectedVendor]`
);

// Remove dynamic terminal reload line if still present
text = text.replace(
/const terminalAccessRows[\s\S]*?const terminals = terminalAccessRows[\s\S]*?\);/,
``
);

// Force submit authentication
text = text.replace(
/setIsAuthenticating\(true\);[\s\S]*?}, 600\);/,
`setIsAuthenticating(true);

    setTimeout(() => {
      setIsAuthenticating(false);

      const authResult = authenticateStaffAccess({
        vendorId: vendors[0]?.id || 'demo-vendor-001',
        staffId: selectedStaffId,
        pin: password
      });

      if (!authResult.ok || !authResult.session) {
        setErrorMsg(authResult.message || 'INVALID PIN OR STAFF ACCESS DENIED');
        return;
      }

      onLoginSuccess(authResult.session);
    }, 300);`
);

fs.writeFileSync(path, text, "utf8");
console.log("Forced PosStaffAccess to use SCI StaffAuthService handshake.");
