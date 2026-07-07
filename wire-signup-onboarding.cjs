const fs = require("fs");
const path = "src/sci-auth/VendorLandingPage.tsx";
let text = fs.readFileSync(path, "utf8");

if (!text.includes("useState")) {
  text = "import { useState } from 'react';\nimport VendorOnboardingForm, { type VendorBusinessProfileDraft } from './VendorOnboardingForm';\n" + text;
}

text = text.replace(
`export default function VendorLandingPage({
  onSignIn,
  onSignUp
}: VendorLandingPageProps) {
  return (`,
`export default function VendorLandingPage({
  onSignIn,
  onSignUp
}: VendorLandingPageProps) {
  const [mode, setMode] = useState<"landing" | "signup">("landing");

  const handleComplete = (profile: VendorBusinessProfileDraft) => {
    localStorage.setItem("itred_pending_vendor_business_profile", JSON.stringify(profile));
    alert("Business profile captured. Next build will open POS Settings.");
  };

  if (mode === "signup") {
    return (
      <VendorOnboardingForm
        onBack={() => setMode("landing")}
        onComplete={handleComplete}
      />
    );
  }

  return (`
);

text = text.replace("onClick={onSignUp}", "onClick={() => setMode('signup')}");

fs.writeFileSync(path, text, "utf8");
console.log("VendorLandingPage wired to onboarding form.");
