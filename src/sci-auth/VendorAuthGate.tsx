import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  signInWithGooglePlaceholder,
  signOutFirebasePlaceholder,
  subscribeToFirebaseAuthState
} from "../pos-new/auth/firebaseAuthShell";
import {
  clearSciAuthSessions,
  LEGACY_POS_ACTIVE_SESSION_KEY,
  readSciVendorOwnerSession,
  saveSciVendorOwnerSession
} from "./StaffAuthService";
import { certifyVendorIdentity } from "../pos-new/auth/posRuntimeCertification";
import {
  subscribeToVendorLicense,
  type VendorLicenseRuntimeSnapshot
} from "../pos-new/auth/vendorLicenseRuntimeService";
import VendorOnboardingForm from "./VendorOnboardingForm";
import PosStaffAccess from "../pos-new/pages/PosStaffAccess";
import {
  resolveAuthenticatedVendor,
  VendorResolutionError,
  vendorResolutionMessage
} from "./VendorResolutionService";

type GoogleProfile = {
  uid: string;
  email: string;
  displayName?: string;
};

type Stage = "checking" | "landing" | "signup" | "license" | "staff" | "authed" | "blocked";

type VendorAuthGateProps = {
  children?: ReactNode;
};

function saveOwnerSession(vendor: Record<string, unknown>) {
  const vendorId = String(vendor.vendorId || "");
  const ownerName = String(
    vendor.ownerName || vendor.businessName || "Owner"
  );
  const ownerEmail = String(vendor.ownerEmail || "");
  const businessName = String(
    vendor.businessName || vendor.tradingName || vendorId
  );

  saveSciVendorOwnerSession({
      vendorId,
      ownerUid: vendor.ownerUid ? String(vendor.ownerUid) : undefined,
      ownerName,
      ownerEmail,
      vendorName: businessName,
      tradingName: vendor.tradingName ? String(vendor.tradingName) : businessName,
      phone: vendor.phone ? String(vendor.phone) : "",
      whatsapp: vendor.whatsapp ? String(vendor.whatsapp) : "",
      country: vendor.country ? String(vendor.country) : "",
      city: vendor.city ? String(vendor.city) : "",
      suburb: vendor.suburb ? String(vendor.suburb) : "",
      physicalAddress: vendor.physicalAddress
        ? String(vendor.physicalAddress)
        : "",
      status: vendor.status ? String(vendor.status) : "Active",
      mode: vendor.mode ? String(vendor.mode) : "Demo",
      role: "Owner",
      signedInAt: new Date().toISOString()
    });

  localStorage.setItem(
    "itred_pos_business_profile",
    JSON.stringify({
      legalName: businessName,
      tradingName: vendor.tradingName ? String(vendor.tradingName) : businessName,
      businessName,
      vendorId,
      registeredBusinessName: businessName,
      ownerName,
      ownerFullName: ownerName,
      ownerEmail,
      email: ownerEmail,
      ownerContact: vendor.phone ? String(vendor.phone) : "",
      ownerPhone: vendor.phone ? String(vendor.phone) : "",
      ownerWhatsApp: vendor.whatsapp ? String(vendor.whatsapp) : "",
      businessPhone: vendor.phone ? String(vendor.phone) : "",
      businessWhatsapp: vendor.whatsapp ? String(vendor.whatsapp) : "",
      phone: vendor.phone ? String(vendor.phone) : "",
      whatsapp: vendor.whatsapp ? String(vendor.whatsapp) : "",
      businessType: vendor.businessType ? String(vendor.businessType) : "",
      country: vendor.country ? String(vendor.country) : "",
      city: vendor.city ? String(vendor.city) : "",
      suburb: vendor.suburb ? String(vendor.suburb) : "",
      address: vendor.physicalAddress ? String(vendor.physicalAddress) : "",
      physicalAddress: vendor.physicalAddress
        ? String(vendor.physicalAddress)
        : "",
      currency: vendor.currency ? String(vendor.currency) : "USD",
      status: "Active",
      businessStatus: "Trial",
      licenseStatus: vendor.licenseStatus ? String(vendor.licenseStatus) : "Trial"
    })
  );
}

export default function VendorAuthGate({ children }: VendorAuthGateProps) {
  const [stage, setStage] = useState<Stage>("checking");
  const [googleProfile, setGoogleProfile] = useState<GoogleProfile | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [license, setLicense] = useState<VendorLicenseRuntimeSnapshot | null>(null);
  const manualFlow = useRef(false);

  function blockResolution(error: unknown) {
    clearSciAuthSessions(true);
    const resolutionError = error instanceof VendorResolutionError
      ? error
      : new VendorResolutionError(
          "UNKNOWN_VENDOR_RESOLUTION_ERROR",
          error instanceof Error ? error.message : "Vendor authentication could not be validated.",
          error
        );
    const diagnostic = import.meta.env.DEV ? ` [${resolutionError.code}]` : "";
    setError(`${vendorResolutionMessage(resolutionError)}${diagnostic}`);
    setStage("blocked");
  }

  async function resolveProfile(profile: GoogleProfile) {
    const resolution = await resolveAuthenticatedVendor(profile.uid);
    if (resolution.state === "onboarding") {
      clearSciAuthSessions(true);
      setError(null);
      setStage("signup");
      return;
    }
    const certification = certifyVendorIdentity(profile, resolution.vendor);
    if (!certification.certified) {
      throw new VendorResolutionError("VENDOR_OWNERSHIP_CONFLICT", certification.reason);
    }
    saveOwnerSession(resolution.vendor);
    setStage("license");
  }

  useEffect(() => {
    clearSciAuthSessions();
    return subscribeToFirebaseAuthState((profile) => {
      if (manualFlow.current) return;
      if (!profile?.uid) {
        clearSciAuthSessions(true);
        setGoogleProfile(null);
        setStage("landing");
        return;
      }
      const authenticatedProfile: GoogleProfile = {
        uid: profile.uid,
        email: profile.email || "",
        displayName: profile.displayName
      };
      setGoogleProfile(authenticatedProfile);
      setStage("checking");
      void resolveProfile(authenticatedProfile).catch(blockResolution);
    });
  }, []);

  useEffect(() => {
    if (stage !== "license") return undefined;
    const owner = readSciVendorOwnerSession();
    if (!owner?.vendorId) {
      setError("Validated vendor context is missing.");
      setStage("blocked");
      return undefined;
    }
    return subscribeToVendorLicense(owner.vendorId, (snapshot) => {
      setLicense(snapshot);
      if (!snapshot.licenseStatusKnown) return;
      if (!snapshot.allowed) {
        clearSciAuthSessions();
        setError(snapshot.message || snapshot.noticeDetail || "Vendor license does not permit POS access.");
        setStage("blocked");
        return;
      }
      setStage("staff");
    });
  }, [stage]);

  async function startGoogle() {
    setError(null);
    setBusy(true);
    manualFlow.current = true;
    try {
      const result = await signInWithGooglePlaceholder();
      if (!result.ok || !result.profile?.uid) {
        console.error("[VendorAuthGate] Google authentication failed", result);
        setError(result.message || "Google sign-in could not be completed.");
        return;
      }

      const profile: GoogleProfile = {
        uid: result.profile.uid,
        email: result.profile.email || "",
        displayName: result.profile.displayName
      };
      setGoogleProfile(profile);
      setStage("checking");
      await resolveProfile(profile);
    } catch (err) {
      console.error(err);
      blockResolution(err);
    } finally {
      setBusy(false);
      manualFlow.current = false;
    }
  }

  async function finishOnboarding() {
    if (!googleProfile) return;
    setBusy(true);
    try {
      const resolution = await resolveAuthenticatedVendor(googleProfile.uid);
      if (resolution.state !== "resolved") {
        throw new VendorResolutionError(
          "VENDOR_NOT_FOUND",
          "The provisioned vendor could not be resolved."
        );
      }
      const certification = certifyVendorIdentity(googleProfile, resolution.vendor);
      if (!certification.certified) {
        throw new VendorResolutionError("VENDOR_OWNERSHIP_CONFLICT", certification.reason);
      }
      saveOwnerSession(resolution.vendor);
      setStage("license");
    } catch (onboardingError) {
      blockResolution(onboardingError);
    } finally {
      setBusy(false);
    }
  }

  async function returnToSignIn() {
    await signOutFirebasePlaceholder();
    clearSciAuthSessions(true);
    setLicense(null);
    setError(null);
    setStage("landing");
  }

  function handleStaffSuccess(session: unknown) {
    void session;
    try {
      localStorage.removeItem(LEGACY_POS_ACTIVE_SESSION_KEY);
    } catch {
      /* ignore persistence errors */
    }
    setStage("authed");
  }

  function backToBios() {
    window.history.pushState({}, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));
  }

  if (stage === "authed") {
    return <>{children}</>;
  }

  if (stage === "signup" && googleProfile) {
    return (
      <VendorOnboardingForm
        googleUid={googleProfile.uid}
        googleEmail={googleProfile.email}
        initialProfile={{
          ownerEmail: googleProfile.email,
          ownerName: googleProfile.displayName || ""
        }}
        onBack={() => setStage("landing")}
        onComplete={() => void finishOnboarding()}
      />
    );
  }

  if (stage === "staff") {
    return (
      <PosStaffAccess
        onLoginSuccess={handleStaffSuccess}
        onBackToBios={backToBios}
      />
    );
  }

  if (stage === "checking" || stage === "license") {
    return (
      <main className="min-h-screen bg-[#f7f5ef] flex items-center justify-center p-6">
        <section className="w-full max-w-xl bg-white border border-slate-300 p-8 text-center">
          <h1 className="text-xl font-black uppercase text-[#1e222b]">Validating secure POS access</h1>
          <p className="mt-3 text-sm text-slate-600">
            {stage === "license" ? "Checking the vendor license and account status." : "Checking the authenticated vendor identity."}
          </p>
        </section>
      </main>
    );
  }

  if (stage === "blocked") {
    return (
      <main className="min-h-screen bg-[#f7f5ef] flex items-center justify-center p-6">
        <section className="w-full max-w-xl bg-white border border-rose-300 p-8 text-center">
          <h1 className="text-xl font-black uppercase text-rose-700">POS access blocked</h1>
          <p className="mt-3 text-sm text-slate-700">{error || license?.noticeDetail || "Authentication or license certification failed."}</p>
          <button type="button" onClick={() => void returnToSignIn()} className="mt-6 bg-[#1e222b] px-6 py-3 text-sm font-black uppercase text-white">
            Return to sign in
          </button>
        </section>
      </main>
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
            Sign in or create your vendor owner profile before entering Staff
            Access.
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
                  <span className="font-bold">Name:</span>{" "}
                  {googleProfile.displayName || "Google User"}
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

          {error && (
            <div className="mt-4 bg-rose-50 border border-rose-300 text-rose-700 text-sm font-bold p-3">
              {error}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button
            type="button"
            onClick={() => void startGoogle()}
            disabled={busy}
            className="bg-white border border-slate-300 hover:border-orange-600 p-8 text-left shadow-sm hover:shadow-xl transition-all rounded-none disabled:opacity-60"
          >
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              Existing Vendor
            </div>
            <h2 className="mt-3 text-xl font-black uppercase text-[#1e222b]">
              Sign In with Google
            </h2>
            <p className="mt-3 text-sm text-slate-600">
              Use your registered Google account to open your vendor session and
              continue to Staff Access.
            </p>
            <div className="mt-6 bg-orange-600 text-white text-center font-black uppercase py-3">
              {busy ? "Opening Google..." : "Sign In"}
            </div>
          </button>

          <button
            type="button"
            onClick={() => void startGoogle()}
            disabled={busy}
            className="bg-white border border-slate-300 hover:border-orange-600 p-8 text-left shadow-sm hover:shadow-xl transition-all rounded-none disabled:opacity-60"
          >
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              New Vendor
            </div>
            <h2 className="mt-3 text-xl font-black uppercase text-[#1e222b]">
              Sign Up with Google
            </h2>
            <p className="mt-3 text-sm text-slate-600">
              Create a new vendor owner profile, default branch, warehouse, and
              owner access.
            </p>
            <div className="mt-6 bg-[#1e222b] text-white text-center font-black uppercase py-3">
              {busy ? "Opening Google..." : "Sign Up"}
            </div>
          </button>
        </div>
      </section>
    </main>
  );
}
