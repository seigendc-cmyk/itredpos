const fs = require("fs");

// 1. Patch onboarding form to accept initial profile
let path = "src/sci-auth/VendorOnboardingForm.tsx";
let text = fs.readFileSync(path, "utf8");

text = text.replace(
`type VendorOnboardingFormProps = {
  onBack: () => void;
  onComplete: (profile: VendorBusinessProfileDraft) => void;
};`,
`type VendorOnboardingFormProps = {
  onBack: () => void;
  onComplete: (profile: VendorBusinessProfileDraft) => void;
  initialProfile?: Partial<VendorBusinessProfileDraft>;
};`
);

text = text.replace(
`export default function VendorOnboardingForm({
  onBack,
  onComplete
}: VendorOnboardingFormProps) {
  const [profile, setProfile] = useState<VendorBusinessProfileDraft>(emptyProfile);`,
`export default function VendorOnboardingForm({
  onBack,
  onComplete,
  initialProfile
}: VendorOnboardingFormProps) {
  const [profile, setProfile] = useState<VendorBusinessProfileDraft>({
    ...emptyProfile,
    ...initialProfile
  });`
);

fs.writeFileSync(path, text, "utf8");


// 2. Patch landing page so Sign Up first performs Google auth, then opens onboarding
path = "src/sci-auth/VendorLandingPage.tsx";
text = fs.readFileSync(path, "utf8");

if (!text.includes("signInWithGooglePlaceholder")) {
  text = text.replace(
    `import VendorOnboardingForm, { type VendorBusinessProfileDraft } from './VendorOnboardingForm';`,
    `import VendorOnboardingForm, { type VendorBusinessProfileDraft } from './VendorOnboardingForm';
import { signInWithGooglePlaceholder } from '../pos-new/auth/firebaseAuthShell';`
  );
}

text = text.replace(
`  const [mode, setMode] = useState<"landing" | "signup">("landing");`,
`  const [mode, setMode] = useState<"landing" | "signup">("landing");
  const [googleProfile, setGoogleProfile] = useState<{ uid?: string; email?: string; displayName?: string } | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const handleGoogleSignUp = async () => {
    setAuthError(null);
    setAuthLoading(true);

    try {
      const result = await signInWithGooglePlaceholder();

      if (!result.ok || !result.profile) {
        setAuthError(result.message || "Google sign-up could not be completed.");
        setAuthLoading(false);
        return;
      }

      setGoogleProfile({
        uid: result.profile.uid,
        email: result.profile.email,
        displayName: result.profile.displayName
      });

      setMode("signup");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Google sign-up failed.");
    } finally {
      setAuthLoading(false);
    }
  };`
);

text = text.replace(
`      <VendorOnboardingForm
        onBack={() => setMode("landing")}
        onComplete={handleComplete}
      />`,
`      <VendorOnboardingForm
        onBack={() => setMode("landing")}
        onComplete={handleComplete}
        initialProfile={{
          ownerName: googleProfile?.displayName || "",
          ownerEmail: googleProfile?.email || ""
        }}
      />`
);

text = text.replace(
`onClick={() => setMode('signup')}`,
`onClick={handleGoogleSignUp}`
);

text = text.replace(
`<p className="mt-3 text-sm text-slate-600">
            Sign in or create your vendor owner profile before entering Staff Access.
          </p>`,
`<p className="mt-3 text-sm text-slate-600">
            Sign in or create your vendor owner profile before entering Staff Access.
          </p>

          {authError && (
            <div className="mt-4 bg-rose-50 border border-rose-300 text-rose-700 text-sm font-bold p-3">
              {authError}
            </div>
          )}`
);

text = text.replaceAll(
`<div className="mt-6 bg-[#1e222b] text-white text-center font-black uppercase py-3">
              Sign Up
            </div>`,
`<div className="mt-6 bg-[#1e222b] text-white text-center font-black uppercase py-3">
              {authLoading ? "Opening Google..." : "Sign Up"}
            </div>`
);

fs.writeFileSync(path, text, "utf8");

console.log("Sign Up now opens Google auth before onboarding.");
