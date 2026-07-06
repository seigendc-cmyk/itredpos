import { useEffect, useState } from "react";
import VendorBusinessSetupPage from "../pages/VendorBusinessSetupPage";
import PosStaffAccessPage from "../pages/PosStaffAccessPage";
import {
  PosVendorAuthContext,
  createInitialPosAuthContext,
  readPosAuthContext,
  resolveNextAuthStage,
  savePosAuthContext,
  clearPosAuthContext
} from "./posVendorAuthState";
import {
  mergeVendorLicenseIntoAuthContext,
  subscribeToVendorLicense
} from "./vendorLicenseRuntimeService";
import { getNextPlanCode } from "./planFeatureGate";
import UpgradeRequiredPanel from "../components/UpgradeRequiredPanel";
import {
  handleGoogleRedirectResult,
  signInWithGooglePlaceholder,
  subscribeToFirebaseAuthState
} from "./firebaseAuthShell";

type PosVendorAuthGateProps = {
  children: React.ReactNode;
};

const SHOW_DEV_BADGES = false;

function readBusinessProfileForUpgrade(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem('itred_pos_business_profile');
    return raw ? JSON.parse(raw) as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function profileText(profile: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = String(profile[key] || '').trim();
    if (value) return value;
  }
  return '';
}

export default function PosVendorAuthGate({ children }: PosVendorAuthGateProps) {
  const [context, setContext] = useState<PosVendorAuthContext>(
    createInitialPosAuthContext()
  );

  // Keep staff PIN / licensing logic unchanged; only drive googleUid/googleEmail population.
  const setContextSafe = (updater: (current: PosVendorAuthContext) => PosVendorAuthContext) => {
    setContext((current) => {
      const next = updater(current);
      savePosAuthContext(next);
      return next;
    });
  };

  useEffect(() => {
    const stored = readPosAuthContext();

    if (stored) {
      const nextStage = resolveNextAuthStage(stored);
      const nextContext = {
        ...stored,
        stage: nextStage
      };

      setContext(nextContext);
      savePosAuthContext(nextContext);
      return;
    }

    const firstRunContext: PosVendorAuthContext = {
      stage: "googleSignInRequired",
      licenseStatus: "Demo",
      message: "Vendor identity is required before POS access."
    };

    setContext(firstRunContext);
    savePosAuthContext(firstRunContext);
  }, []);

  // AUTH-GOOGLE-01: Populate sci_pos_vendor_auth_context from Firebase Google session.
  useEffect(() => {
    let active = true;

    const syncFromProfile = (profile: { uid: string; email?: string } | null) => {
      if (!active) return;
      if (!profile) return;

      const googleEmail = (profile.email || '').trim();
      const googleUid = profile.uid;
      if (!googleUid || !googleEmail) {
      setContextSafe((current) => ({
          ...current,
          stage: "googleSignInRequired",
          message: "Google email is required to continue."
        }));
        return;
      }

      setContextSafe((current) => {
        const merged: PosVendorAuthContext = {
          ...current,
          googleUid,
          googleEmail,
          stage: resolveNextAuthStage({
            ...current,
            googleUid,
            googleEmail
          })
        };
        return merged;
      });
    };

    const bootstrapRedirect = async () => {
      try {
        await handleGoogleRedirectResult();
      } catch {
        // Safe fallback: stay on current stage.
      }
    };

    void bootstrapRedirect();
    const unsubscribe = subscribeToFirebaseAuthState((profile) => {
      syncFromProfile(profile);
    });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (!context.vendorId) return undefined;
    return subscribeToVendorLicense(context.vendorId, (licenseSnapshot) => {
      setContext((current) => {
        const merged = mergeVendorLicenseIntoAuthContext(current, licenseSnapshot);
        savePosAuthContext(merged);
        return merged;
      });
    });
  }, [context.vendorId]);


  const resetAuthFlow = () => {
    clearPosAuthContext();
    window.location.reload();
  };

  if (context.stage === "checkingGoogleSession") {
    return (
      <div className="min-h-screen bg-[#f7f5ef] flex items-center justify-center">
        <div className="bg-white border border-gray-300 p-8 text-center">
          <h1 className="text-xl font-black uppercase text-[#1e222b]">
            Checking POS Access
          </h1>
          <p className="text-sm mt-2 text-slate-600">
            Preparing vendor session...
          </p>
        </div>
      </div>
    );
  }

  if (context.stage === "googleSignInRequired") {
    return (
      <div className="min-h-screen bg-[#f7f5ef] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-gray-300 p-6">
          <h1 className="text-xl font-black uppercase text-[#1e222b]">
            iTredPOS Vendor Access
          </h1>

          <p className="text-sm mt-3 text-slate-600">
            Use Google once to verify the business owner. Daily POS access will use staff PIN login after setup.
          </p>

          <button
            type="button"
            onClick={() => {
              // Keep routing/session gating intact; only initiate Firebase Google redirect.
              void signInWithGooglePlaceholder();
            }}
            className="mt-6 w-full bg-orange-600 hover:bg-orange-700 border border-orange-700 text-white font-black uppercase py-3 rounded-none"
          >
            Continue with Google
          </button>

          {SHOW_DEV_BADGES && (
            <>
              <button
                type="button"
                onClick={resetAuthFlow}
                className="mt-3 w-full bg-white hover:bg-slate-50 border border-[#b1b5c2] text-[#1e222b] font-black uppercase py-2 rounded-none"
              >
                Reset Demo Auth
              </button>

              <div className="mt-4 text-xs uppercase font-bold text-slate-500">
                AUTH-04 foundation: Google button is currently a safe local demo action. Real Firebase Google sign-in will be wired in AUTH-05.
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  if (context.stage === "businessProfileRequired") {
    return <VendorBusinessSetupPage />;
  }

  if (context.stage === "staffAccessRequired") {
    return <PosStaffAccessPage />;
  }

  if (context.stage === "licenseRequired") {
    const profile = readBusinessProfileForUpgrade();
    const planCode = context.planCode || 'DEMO';
    return (
      <main className="min-h-screen bg-[#f7f5ef] p-6">
        <UpgradeRequiredPanel
          featureName="POS License"
          currentPlan={planCode}
          requiredPlan={String(getNextPlanCode(planCode))}
          vendor={{
            vendorName: context.vendorName || profileText(profile, 'legalName', 'tradingName', 'businessName') || 'Business',
            vendorId: context.vendorId || profileText(profile, 'vendorId') || 'unassigned-vendor',
            ownerName: profileText(profile, 'ownerName', 'contactPerson'),
            ownerPhone: profileText(profile, 'ownerContact', 'ownerPhone', 'businessPhone', 'phone', 'phoneNumber1'),
            ownerWhatsapp: profileText(profile, 'businessWhatsapp', 'whatsapp', 'ownerWhatsApp', 'whatsAppNumber1'),
            city: profileText(profile, 'city', 'cityTown'),
            suburb: profileText(profile, 'suburb', 'districtSuburb', 'district')
          }}
          detail={context.message || "Contact SCI support to activate POS access."}
          onActivated={(result) => {
            const nextContext = {
              ...context,
              message: result.message
            };
            setContext(nextContext);
            savePosAuthContext(nextContext);
          }}
        />
      </main>
    );
  }

  return (
    <>
      {SHOW_DEV_BADGES && (
        <button
          type="button"
          onClick={resetAuthFlow}
          className="fixed bottom-3 right-3 z-[9999] bg-white border border-[#b1b5c2] px-3 py-1.5 text-[8px] uppercase font-black text-[#1e222b] shadow"
        >
          Reset Auth
        </button>
      )}
      {children}
    </>
  );
}

