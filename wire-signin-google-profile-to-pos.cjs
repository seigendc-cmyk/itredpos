const fs = require("fs");
const path = "src/sci-auth/VendorLandingPage.tsx";
let text = fs.readFileSync(path, "utf8");

const marker = `  const handleGoogleSignUp = async () => {`;

const signInFn = `  const openPosWithGoogleProfile = () => {
    if (!googleProfile?.email) {
      setAuthError("Google account is not signed in yet. Click Sign Up with Google first or refresh after Google sign-in.");
      return;
    }

    localStorage.setItem("sci_vendor_owner_session", JSON.stringify({
      vendorId: "demo-vendor-001",
      ownerName: googleProfile.displayName || "Business Owner",
      ownerEmail: googleProfile.email,
      vendorName: "Demo Business",
      role: "Owner",
      mode: "DEMO"
    }));

    localStorage.setItem("itred_pos_business_profile", JSON.stringify({
      legalName: "Demo Business",
      tradingName: "Demo Business",
      ownerName: googleProfile.displayName || "Business Owner",
      ownerEmail: googleProfile.email,
      currency: "USD"
    }));

    window.history.pushState({}, "", "/pos-prototype");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

`;

if (!text.includes("const openPosWithGoogleProfile = () =>")) {
  text = text.replace(marker, signInFn + marker);
}

text = text.replace("onClick={onSignIn}", "onClick={openPosWithGoogleProfile}");

fs.writeFileSync(path, text, "utf8");
console.log("Sign In card now opens POS using Google profile.");
