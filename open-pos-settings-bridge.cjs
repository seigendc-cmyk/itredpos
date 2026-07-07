const fs = require("fs");

// 1. Patch VendorLandingPage onboarding completion
let path = "src/sci-auth/VendorLandingPage.tsx";
let text = fs.readFileSync(path, "utf8");

text = text.replace(
`  const handleComplete = (profile: VendorBusinessProfileDraft) => {
    localStorage.setItem("itred_pending_vendor_business_profile", JSON.stringify(profile));
    alert("Business profile captured. Next build will open POS Settings.");
  };`,
`  const handleComplete = (profile: VendorBusinessProfileDraft) => {
    const businessProfile = {
      legalName: profile.businessName,
      tradingName: profile.tradingName || profile.businessName,
      ownerName: profile.ownerName,
      ownerEmail: profile.ownerEmail,
      businessPhone: profile.phone,
      businessWhatsapp: profile.whatsapp,
      country: profile.country,
      city: profile.city,
      suburb: profile.suburb,
      address: profile.physicalAddress,
      physicalAddress: profile.physicalAddress,
      currency: "USD"
    };

    localStorage.setItem("itred_pending_vendor_business_profile", JSON.stringify(profile));
    localStorage.setItem("itred_pos_business_profile", JSON.stringify(businessProfile));
    localStorage.setItem("itred_pos_start_page", "SETTINGS");

    window.history.pushState({}, "", "/pos-prototype");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };`
);

fs.writeFileSync(path, text, "utf8");


// 2. Patch PosPrototypeApp to respect startup page
path = "src/pos-new/PosPrototypeApp.tsx";
text = fs.readFileSync(path, "utf8");

text = text.replace(
`export default function PosPrototypeApp() {
  const [activePage, setActivePage] = useState<PosPageId>('DASHBOARD');`,
`export default function PosPrototypeApp() {
  const [activePage, setActivePage] = useState<PosPageId>(() => {
    try {
      const startPage = localStorage.getItem("itred_pos_start_page") as PosPageId | null;
      if (startPage) {
        localStorage.removeItem("itred_pos_start_page");
        return startPage;
      }
    } catch {
      // ignore startup page fallback
    }
    return "DASHBOARD";
  });`
);

fs.writeFileSync(path, text, "utf8");

console.log("Open POS Settings bridge added.");
