import { useEffect, useState, type ReactNode } from "react";
import {
  collection,
  getDocs,
  limit,
  query,
  where
} from "firebase/firestore";
import { db } from "../pos-new/firebase/firebaseApp";
import {
  signInWithGooglePlaceholder
} from "../pos-new/auth/firebaseAuthShell";
import { readSciVendorOwnerSession } from "./StaffAuthService";
import VendorOnboardingForm from "./VendorOnboardingForm";
import PosStaffAccess from "../pos-new/pages/PosStaffAccess";

type GoogleProfile = {
  uid: string;
  email: string;
  displayName?: string;
};

type Stage = "landing" | "signup" | "staff" | "authed";

type VendorAuthGateProps = {
  children?: ReactNode;
};

const ACTIVE_SESSION_KEY = "itred_pos_active_session";

function saveOwnerSession(vendor: Record<string, unknown>) {
  const vendorId = String(vendor.vendorId || "");
  const ownerName = String(
    vendor.ownerName || vendor.businessName || "Owner"
  );
  const ownerEmail = String(vendor.ownerEmail || "");
  const businessName = String(
    vendor.businessName || vendor.tradingName || vendorId
  );

  localStorage.setItem(
    "sci_vendor_owner_session",
    JSON.stringify({
      vendorId,
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
    })
  );

  localStorage.setItem(
    "itred_pos_business_profile",
    JSON.stringify({
      legalName: businessName,
      tradingName: vendor.tradingName ? String(vendor.tradingName) : businessName,
      businessName,
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
      licenseStatus: vendor.licenseStatus ? String(vendor.licenseStatus) : "DEMO"
    })
  );
}

async function findVendorByGoogleAccount(
  profile: GoogleProfile
): Promise<Record<string, unknown> | null> {
  if (!db) return null;
  const uid = profile.uid;
  const email = profile.email.toLowerCase();

  console.log('[VendorAuthGate] Firestore READ', 'vendors', {
    operation: 'query',
    path: 'vendors',
    uid,
    email,
    vendorId: 'unknown',
    filter: { ownerUid: uid }
  });

  const q1 = query(
    collection(db, "vendors"),
    where("ownerUid", "==", uid),
    limit(1)
  );
  const snap1 = await getDocs(q1);
  if (!snap1.empty) return snap1.docs[0].data() as Record<string, unknown>;

  console.log('[VendorAuthGate] Firestore READ', 'vendors', {
    operation: 'query',
    path: 'vendors',
    uid,
    email,
    vendorId: 'unknown',
    filter: { ownerEmail: email }
  });

  if (email) {
    const q2 = query(
      collection(db, "vendors"),
      where("ownerEmail", "==", email),
      limit(1)
    );
    const snap2 = await getDocs(q2);
    if (!snap2.empty) return snap2.docs[0].data() as Record<string, unknown>;
  }

  return null;
}

export default function VendorAuthGate({ children }: VendorAuthGateProps) {
  const [stage, setStage] = useState<Stage>(
    readSciVendorOwnerSession() ? "staff" : "landing"
  );
  const [googleProfile, setGoogleProfile] = useState<GoogleProfile | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (stage === "authed") return;
    if (!readSciVendorOwnerSession()) {
      setStage("landing");
    }
  }, [stage]);

  async function startGoogle(mode: "signup" | "signin") {
    setError(null);
    setBusy(true);
    try {
      const result = await signInWithGooglePlaceholder();
      if (!result.ok || !result.profile?.uid) {
        setError(result.message || "Google sign-in could not be completed.");
        return;
      }

      const profile: GoogleProfile = {
        uid: result.profile.uid,
        email: result.profile.email || "",
        displayName: result.profile.displayName
      };
      setGoogleProfile(profile);

      if (mode === "signup") {
        setStage("signup");
        return;
      }

      const vendor = await findVendorByGoogleAccount(profile);
      if (!vendor) {
        setError(
          "No registered business was found for this Google account. Please choose Sign Up."
        );
        setStage("landing");
        return;
      }

      saveOwnerSession(vendor);
      setStage("staff");
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Google sign-in failed."
      );
    } finally {
      setBusy(false);
    }
  }

  function handleStaffSuccess(session: unknown) {
    try {
      localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
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
        onComplete={() => setStage("staff")}
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
            onClick={() => void startGoogle("signin")}
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
            onClick={() => void startGoogle("signup")}
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
