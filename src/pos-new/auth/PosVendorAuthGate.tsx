import { useEffect, useState } from "react";
import VendorBusinessSetupPage from "../pages/VendorBusinessSetupPage";
import PosStaffAccessPage from "../pages/PosStaffAccessPage";
import {
  PosVendorAuthContext,
  createInitialPosAuthContext,
  readPosAuthContext,
  resolveNextAuthStage,
  savePosAuthContext
} from "./posVendorAuthState";

type PosVendorAuthGateProps = {
  children: React.ReactNode;
};

export default function PosVendorAuthGate({ children }: PosVendorAuthGateProps) {
  const [context, setContext] = useState<PosVendorAuthContext>(
    createInitialPosAuthContext()
  );

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
              const demoGoogleContext: PosVendorAuthContext = {
                stage: "businessProfileRequired",
                googleUid: `demo-google-${Date.now()}`,
                googleEmail: "owner@example.com",
                licenseStatus: "Demo",
                message: "Demo Google identity captured. Complete business setup."
              };

              setContext(demoGoogleContext);
              savePosAuthContext(demoGoogleContext);
            }}
            className="mt-6 w-full bg-orange-600 hover:bg-orange-700 border border-orange-700 text-white font-black uppercase py-3 rounded-none"
          >
            Continue with Google
          </button>

          <div className="mt-4 text-xs uppercase font-bold text-slate-500">
            AUTH-04 foundation: Google button is currently a safe local demo action. Real Firebase Google sign-in will be wired in AUTH-05.
          </div>
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
    return (
      <div className="min-h-screen bg-[#f7f5ef] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-gray-300 p-6">
          <h1 className="text-xl font-black uppercase text-[#1e222b]">
            License Required
          </h1>
          <p className="text-sm mt-2 text-slate-600">
            Demo license has expired or account has been suspended.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

