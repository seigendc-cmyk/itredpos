import { useState } from "react";
import {
  doc,
  writeBatch
} from "firebase/firestore";
import { db } from "../pos-new/firebase/firebaseApp";
import { getCurrentFirebaseUserProfile } from "../pos-new/auth/firebaseAuthShell";

export type VendorBusinessProfileDraft = {
  businessName: string;
  tradingName: string;
  businessType: string;
  currency: string;
  ownerName: string;
  ownerEmail: string;
  phone: string;
  whatsapp: string;
  country: string;
  city: string;
  suburb: string;
  physicalAddress: string;
};

type VendorOnboardingFormProps = {
  onBack?: () => void;
  onComplete?: (profile: VendorBusinessProfileDraft) => void;
  initialProfile?: Partial<VendorBusinessProfileDraft>;
  googleUid?: string;
  googleEmail?: string;
};

const OWNER_PIN = "040369";

const BUSINESS_TYPES = [
  "Retail",
  "Wholesale",
  "Supermarket",
  "Restaurant",
  "Pharmacy",
  "Hardware",
  "Services",
  "Other"
];

const CURRENCIES = ["USD", "ZWL", "ZAR", "BWP", "ZMW", "MZN"];

type FirebaseProvisioningError = Error & {
  code?: string;
};

function formatProvisioningError(error: unknown): string {
  const firebaseError = error as Partial<FirebaseProvisioningError>;
  const code = typeof firebaseError.code === "string" ? firebaseError.code : "unknown";
  const message =
    error instanceof Error
      ? error.message
      : typeof firebaseError.message === "string"
        ? firebaseError.message
        : "Unknown Firestore provisioning error.";

  if (import.meta.env.DEV) {
    return `Vendor provisioning failed (${code}): ${message}`;
  }

  return "Vendor provisioning failed. Please try again.";
}

const emptyProfile: VendorBusinessProfileDraft = {
  businessName: "",
  tradingName: "",
  businessType: "",
  currency: "USD",
  ownerName: "",
  ownerEmail: "",
  phone: "",
  whatsapp: "",
  country: "Zimbabwe",
  city: "",
  suburb: "",
  physicalAddress: ""
};

export default function VendorOnboardingForm({
  onBack,
  onComplete,
  initialProfile,
  googleUid,
  googleEmail
}: VendorOnboardingFormProps) {
  const [profile, setProfile] = useState<VendorBusinessProfileDraft>({
    ...emptyProfile,
    ...initialProfile
  });
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const update = (key: keyof VendorBusinessProfileDraft, value: string) => {
    setProfile((current) => ({ ...current, [key]: value }));
  };

  const canContinue =
    profile.businessName.trim() &&
    profile.ownerName.trim() &&
    profile.ownerEmail.trim() &&
    profile.phone.trim();

  async function handleFinish() {
    setError(null);

    const businessName = profile.businessName.trim();
    const ownerName = profile.ownerName.trim();
    const ownerEmail = profile.ownerEmail.trim().toLowerCase();

    if (!businessName) {
      setError("Business Name is required to finish onboarding.");
      return;
    }
    if (!ownerName) {
      setError("Owner Name is required to finish onboarding.");
      return;
    }
    if (!ownerEmail) {
      setError("Owner Email is required to finish onboarding.");
      return;
    }

    const resolvedUid = googleUid || getCurrentFirebaseUserProfile()?.uid;
    const resolvedEmail =
      (googleEmail || getCurrentFirebaseUserProfile()?.email || "").toLowerCase();

    if (!resolvedUid || !resolvedEmail) {
      setError(
        "A verified Google owner account is required before finishing onboarding. Please sign in with Google first."
      );
      return;
    }

    if (!db) {
      setError(
        "Firestore is not available. Please check the Firebase configuration before finishing onboarding."
      );
      return;
    }

    setIsSaving(true);

    try {
      const now = new Date().toISOString();
      const vendorId = `vendor-${resolvedUid}`;
      const branchId = `${vendorId}_main_branch`;
      const warehouseId = `${vendorId}_main_warehouse`;
      const staffId = `${vendorId}_owner`;
      const terminalId = `${vendorId}_main_terminal`;
      const licenseId = `${vendorId}_demo_license`;

      const phone = profile.phone.trim();
      const whatsapp = profile.whatsapp.trim();
      const country = profile.country.trim();
      const city = profile.city.trim();
      const suburb = profile.suburb.trim();
      const physicalAddress = profile.physicalAddress.trim();
      const tradingName = profile.tradingName.trim() || businessName;
      const businessType = profile.businessType.trim();
      const currency = profile.currency.trim() || "USD";

      const vendorDoc = {
        vendorId,
        ownerUid: resolvedUid,
        ownerEmail,
        ownerName,
        businessName,
        tradingName,
        businessType,
        currency,
        phone,
        whatsapp,
        country,
        city,
        suburb,
        physicalAddress,
        status: "Active",
        mode: "Demo",
        planCode: "DEMO",
        licenseStatus: "DEMO",
        createdAt: now,
        updatedAt: now
      };

      const vendorUserDoc = {
        uid: resolvedUid,
        vendorId,
        email: resolvedEmail || ownerEmail,
        displayName: ownerName,
        role: "Owner",
        status: "active",
        permissions: ["*"],
        createdAt: now,
        updatedAt: now
      };

      const branchDoc = {
        branchId,
        vendorId,
        name: "Main Branch",
        branchName: "Main Branch",
        phone,
        whatsapp,
        email: ownerEmail,
        country,
        city,
        suburb,
        address: physicalAddress,
        status: "Active",
        createdAt: now,
        updatedAt: now
      };

      const warehouseDoc = {
        warehouseId,
        vendorId,
        branchId,
        name: "Main Warehouse",
        warehouseName: "Main Warehouse",
        phone,
        whatsapp,
        email: ownerEmail,
        country,
        city,
        suburb,
        address: physicalAddress,
        status: "Active",
        createdAt: now,
        updatedAt: now
      };

      const staffDoc = {
        id: staffId,
        staffId,
        vendorId,
        branchId,
        name: ownerName,
        displayName: ownerName,
        email: ownerEmail,
        staffCode: "OWNER",
        roleId: "owner",
        roleName: "Owner",
        role: "Owner",
        permissions: ["*"],
        pin: OWNER_PIN,
        pinCode: OWNER_PIN,
        status: "Active",
        ownerUid: resolvedUid,
        assignedTerminalIds: [terminalId],
        createdBy: resolvedUid,
        updatedBy: resolvedUid,
        createdAt: now,
        updatedAt: now
      };

      const terminalDoc = {
        terminalId,
        vendorId,
        branchId,
        warehouseId,
        name: "Main POS Terminal",
        terminalName: "Main POS Terminal",
        type: "POS",
        status: "Active",
        createdAt: now,
        updatedAt: now
      };

      const licenseDoc = {
        licenseId,
        vendorId,
        planCode: "DEMO",
        licenseStatus: "DEMO",
        licenseMode: "demo",
        status: "Active",
        createdAt: now,
        updatedAt: now
      };

      const vendorSettingsDoc = {
        vendorId,
        vatEnabled: false,
        vatRegistered: false,
        vatNumber: "",
        defaultVatRate: 0,
        pricesIncludeVat: true,
        outputTaxAccountId: "",
        inputTaxAccountId: "",
        exemptTaxCode: "EXEMPT",
        zeroRatedTaxCode: "ZERO",
        preventNegativeStock: true,
        updatedAt: now,
        updatedBy: resolvedUid,
        createdAt: now
      };

      const phase1Batch = writeBatch(db);

      console.log('[VendorOnboardingForm] Firestore WRITE', {
        operation: 'batch.set',
        phase: 'phase-1',
        path: `vendors/${vendorId}`,
        vendorId,
        uid: resolvedUid
      });

      phase1Batch.set(doc(db, "vendors", vendorId), vendorDoc);

      console.log('[VendorOnboardingForm] Firestore WRITE', {
        operation: 'batch.set',
        phase: 'phase-1',
        path: `vendorUsers/${resolvedUid}`,
        vendorId,
        uid: resolvedUid
      });

      phase1Batch.set(doc(db, "vendorUsers", resolvedUid), vendorUserDoc);

      await phase1Batch.commit();
      console.log('[VendorOnboardingForm] Firestore PHASE 1 committed', {
        collections: ['vendors', 'vendorUsers'],
        vendorId,
        uid: resolvedUid
      });

      const phase2Batch = writeBatch(db);

      console.log('[VendorOnboardingForm] Firestore WRITE', {
        operation: 'batch.set',
        phase: 'phase-2',
        path: `branches/${branchId}`,
        vendorId,
        uid: resolvedUid
      });

      phase2Batch.set(doc(db, "branches", branchId), branchDoc);

      console.log('[VendorOnboardingForm] Firestore WRITE', {
        operation: 'batch.set',
        phase: 'phase-2',
        path: `warehouses/${warehouseId}`,
        vendorId,
        uid: resolvedUid
      });

      phase2Batch.set(doc(db, "warehouses", warehouseId), warehouseDoc);

      console.log('[VendorOnboardingForm] Firestore WRITE', {
        operation: 'batch.set',
        phase: 'phase-2',
        path: `staff/${staffId}`,
        vendorId,
        uid: resolvedUid
      });

      phase2Batch.set(doc(db, "staff", staffId), staffDoc);

      console.log('[VendorOnboardingForm] Firestore WRITE', {
        operation: 'batch.set',
        phase: 'phase-2',
        path: `pos_terminals/${terminalId}`,
        vendorId,
        uid: resolvedUid
      });

      phase2Batch.set(doc(db, "pos_terminals", terminalId), terminalDoc);

      console.log('[VendorOnboardingForm] Firestore WRITE', {
        operation: 'batch.set',
        phase: 'phase-2',
        path: `licenses/${licenseId}`,
        vendorId,
        uid: resolvedUid
      });

      phase2Batch.set(doc(db, "licenses", licenseId), licenseDoc);

      console.log('[VendorOnboardingForm] Firestore WRITE', {
        operation: 'batch.set',
        phase: 'phase-2',
        path: `vendor_settings/${vendorId}`,
        vendorId,
        uid: resolvedUid
      });

      phase2Batch.set(doc(db, "vendor_settings", vendorId), vendorSettingsDoc);

      await phase2Batch.commit();

      localStorage.setItem(
        "sci_vendor_owner_session",
        JSON.stringify({
          vendorId,
          ownerName,
          ownerEmail,
          vendorName: businessName,
          tradingName,
          phone,
          whatsapp,
          country,
          city,
          suburb,
          physicalAddress,
          status: "Active",
          mode: "Demo",
          role: "Owner",
          signedInAt: now
        })
      );

      localStorage.setItem(
        "itred_pos_business_profile",
        JSON.stringify({
          legalName: businessName,
          tradingName,
          businessName,
          registeredBusinessName: businessName,
          ownerName,
          ownerFullName: ownerName,
          ownerEmail,
          email: ownerEmail,
          vendorId,
          ownerContact: phone,
          ownerPhone: phone,
          ownerWhatsApp: whatsapp,
          businessPhone: phone,
          businessWhatsapp: whatsapp,
          phone,
          whatsapp,
          businessType,
          currency,
          country,
          city,
          suburb,
          address: physicalAddress,
          physicalAddress,
          status: "Active",
          businessStatus: "Trial",
          licenseStatus: "Trial"
        })
      );

      onComplete?.(profile);
    } catch (error) {
      console.error("Vendor provisioning failed", error);
      setError(formatProvisioningError(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f5ef] flex items-center justify-center p-6">
      <section className="w-full max-w-3xl bg-white border border-slate-300 p-8 shadow-xl">
        <p className="text-[11px] font-black uppercase tracking-[0.35em] text-orange-600">
          New Vendor Onboarding
        </p>

        <h1 className="mt-3 text-2xl font-black uppercase text-[#1e222b]">
          Create Business Owner Profile
        </h1>

        <p className="mt-2 text-sm text-slate-600">
          Capture the first business profile before entering POS settings.
        </p>

        {error && (
          <div className="mt-6 bg-rose-50 border border-rose-300 text-rose-700 text-sm font-bold p-3">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
          <input className="border border-slate-300 px-4 py-3" placeholder="Business Name *" value={profile.businessName} onChange={(e) => update("businessName", e.target.value)} />
          <input className="border border-slate-300 px-4 py-3" placeholder="Trading Name" value={profile.tradingName} onChange={(e) => update("tradingName", e.target.value)} />
          <select className="border border-slate-300 px-4 py-3 bg-white" value={profile.businessType} onChange={(e) => update("businessType", e.target.value)}>
            <option value="">Business Type</option>
            {BUSINESS_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <input className="border border-slate-300 px-4 py-3" placeholder="Owner Name *" value={profile.ownerName} onChange={(e) => update("ownerName", e.target.value)} />
          <input className="border border-slate-300 px-4 py-3" placeholder="Owner Email *" value={profile.ownerEmail} onChange={(e) => update("ownerEmail", e.target.value)} />
          <input className="border border-slate-300 px-4 py-3" placeholder="Phone *" value={profile.phone} onChange={(e) => update("phone", e.target.value)} />
          <input className="border border-slate-300 px-4 py-3" placeholder="WhatsApp" value={profile.whatsapp} onChange={(e) => update("whatsapp", e.target.value)} />
          <select className="border border-slate-300 px-4 py-3 bg-white" value={profile.currency} onChange={(e) => update("currency", e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input className="border border-slate-300 px-4 py-3" placeholder="Country" value={profile.country} onChange={(e) => update("country", e.target.value)} />
          <input className="border border-slate-300 px-4 py-3" placeholder="City" value={profile.city} onChange={(e) => update("city", e.target.value)} />
          <input className="border border-slate-300 px-4 py-3" placeholder="Suburb" value={profile.suburb} onChange={(e) => update("suburb", e.target.value)} />
          <input className="border border-slate-300 px-4 py-3" placeholder="Physical Address" value={profile.physicalAddress} onChange={(e) => update("physicalAddress", e.target.value)} />
        </div>

        <div className="flex gap-4 mt-8">
          {onBack && (
            <button type="button" onClick={onBack} className="px-6 py-3 border border-slate-300 font-black uppercase">
              Back
            </button>
          )}

          <button
            type="button"
            disabled={!canContinue || isSaving}
            onClick={handleFinish}
            className="flex-1 px-6 py-3 bg-orange-600 disabled:bg-slate-300 text-white font-black uppercase"
          >
            {isSaving ? "Finishing..." : "Finish Onboarding"}
          </button>
        </div>
      </section>
    </main>
  );
}
