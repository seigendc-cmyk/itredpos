import { useState } from 'react';
import VendorOnboardingForm, { type VendorBusinessProfileDraft } from './VendorOnboardingForm';
import { signInWithGooglePlaceholder } from '../pos-new/auth/firebaseAuthShell';
import { findVendorByGoogleAccount, saveVendorSessionFromFirebase, createVendorAccount } from './VendorFirebaseService';
type VendorLandingPageProps = {
  onSignIn?: () => void;
  onSignUp?: () => void;
};

export default function VendorLandingPage({
  onSignIn,
  onSignUp
}: VendorLandingPageProps) {
  const [mode, setMode] = useState<"landing" | "signup">("landing");
  const [googleProfile, setGoogleProfile] = useState<{ uid?: string; email?: string; displayName?: string } | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const openPosWithGoogleProfile = async () => {
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

      const vendor = await findVendorByGoogleAccount(result.profile);

      if (!vendor) {
        setAuthError("No registered vendor business found for this Google account. Please use Sign Up.");
        setAuthLoading(false);
        return;
      }

      saveVendorSessionFromFirebase(vendor);

      window.history.pushState({}, "", "/pos-prototype");
      window.dispatchEvent(new PopStateEvent("popstate"));
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Google sign-in failed.");
    } finally {
      setAuthLoading(false);
    }
  };

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
  };

  const handleComplete = async (profile: VendorBusinessProfileDraft) => {
    if (!googleProfile) {
      setAuthError("Google profile is missing. Please start over.");
      return;
    }

    setAuthLoading(true);
    setAuthError(null);

    try {
      const vendor = await createVendorAccount(
        {
          uid: googleProfile.uid,
          email: googleProfile.email,
          displayName: googleProfile.displayName
        },
        profile
      );

      saveVendorSessionFromFirebase(vendor);

      localStorage.setItem('itred_pos_start_page', 'SETTINGS');

      window.history.pushState({}, '', '/pos-prototype');
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Failed to create vendor account.');
    } finally {
      setAuthLoading(false);
    }
  };

  if (mode === "signup") {
    return (
      <VendorOnboardingForm
        onBack={() => setMode("landing")}
        onComplete={handleComplete}
        initialProfile={{
          ownerName: googleProfile?.displayName || "",
          ownerEmail: googleProfile?.email || ""
        }}
      />
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f5ef] flex items-center justify-center p-6">
      <section className="w-full max-w-4xl">
        <div className="text-center mb-10">
          <p className="text-[11px] font-black uppercase tracking-[0.35em] text-orange-600">
            SCI Vendor Access
          </p>
          <h1 className="mt-3 text-3xl font-black uppercase text-[#1e222b]">
            iTredPOS Business Owner Login
          </h1>
          <p className="mt-3 text-sm text-slate-600">
            Sign in or create your vendor owner profile before entering Staff Access.
          </p>

          <div className="mt-5 mx-auto max-w-xl bg-white border border-slate-300 px-5 py-4 text-left">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              Google Account Status
            </div>

            {googleProfile?.email ? (
              <div className="mt-2">
                <div className="text-sm font-black text-emerald-700 uppercase">
                  Signed in
                </div>
                <div className="mt-1 text-sm text-slate-700">
                  <span className="font-bold">Name:</span> {googleProfile.displayName || "Google User"}
                </div>
                <div className="text-sm text-slate-700">
                  <span className="font-bold">Email:</span> {googleProfile.email}
                </div>
              </div>
            ) : (
              <div className="mt-2 text-sm font-black text-slate-600 uppercase">
                Signed out
              </div>
            )}
          </div>

          {authError && (
            <div className="mt-4 bg-rose-50 border border-rose-300 text-rose-700 text-sm font-bold p-3">
              {authError}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button
            type="button"
            onClick={openPosWithGoogleProfile}
            className="bg-white border border-slate-300 hover:border-orange-600 p-8 text-left shadow-sm hover:shadow-xl transition-all rounded-none"
          >
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              Existing Vendor
            </div>
            <h2 className="mt-3 text-xl font-black uppercase text-[#1e222b]">
              Sign in with Google
            </h2>
            <p className="mt-3 text-sm text-slate-600">
              Use your registered Google account to open your vendor session and continue to Staff Access.
            </p>
            <div className="mt-6 bg-orange-600 text-white text-center font-black uppercase py-3">
              Sign In
            </div>
          </button>

          <button
            type="button"
            onClick={handleGoogleSignUp}
            className="bg-white border border-slate-300 hover:border-orange-600 p-8 text-left shadow-sm hover:shadow-xl transition-all rounded-none"
          >
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              New Vendor
            </div>
            <h2 className="mt-3 text-xl font-black uppercase text-[#1e222b]">
              Sign up with Google
            </h2>
            <p className="mt-3 text-sm text-slate-600">
              Create a new vendor owner profile, default branch, warehouse, and owner access.
            </p>
            <div className="mt-6 bg-[#1e222b] text-white text-center font-black uppercase py-3">
              {authLoading ? "Opening Google..." : "Sign Up"}
            </div>
          </button>
        </div>
      </section>
    </main>
  );
}
