const fs = require("fs");
const path = "src/sci-auth/VendorLandingPage.tsx";
let text = fs.readFileSync(path, "utf8");

const oldFn = `  const openPosWithGoogleProfile = () => {
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
  };`;

const newFn = `  const openPosWithGoogleProfile = async () => {
    setAuthError(null);
    setAuthLoading(true);

    try {
      const result = await signInWithGooglePlaceholder();

      if (!result.ok || !result.profile?.email) {
        setAuthError(result.message || "Google sign-in could not be completed.");
        setAuthLoading(false);
        return;
      }

      const profile = {
        uid: result.profile.uid,
        email: result.profile.email,
        displayName: result.profile.displayName
      };

      setGoogleProfile(profile);

      localStorage.setItem("sci_vendor_owner_session", JSON.stringify({
        vendorId: "demo-vendor-001",
        ownerName: profile.displayName || "Business Owner",
        ownerEmail: profile.email,
        vendorName: "Demo Business",
        role: "Owner",
        mode: "DEMO"
      }));

      localStorage.setItem("itred_pos_business_profile", JSON.stringify({
        legalName: "Demo Business",
        tradingName: "Demo Business",
        ownerName: profile.displayName || "Business Owner",
        ownerEmail: profile.email,
        currency: "USD"
      }));

      window.history.pushState({}, "", "/pos-prototype");
      window.dispatchEvent(new PopStateEvent("popstate"));
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Google sign-in failed.");
    } finally {
      setAuthLoading(false);
    }
  };`;

if (text.includes(oldFn)) {
  text = text.replace(oldFn, newFn);
} else {
  console.log("Old sign-in function not found. Inspect VendorLandingPage manually.");
}

fs.writeFileSync(path, text, "utf8");
console.log("Sign In card now opens Google account selection before POS.");
