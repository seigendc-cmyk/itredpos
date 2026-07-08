import { useState } from "react";

type VendorOnboardingFormProps = {
  onBack: () => void;
  onComplete: (profile: VendorBusinessProfileDraft) => void;
  initialProfile?: Partial<VendorBusinessProfileDraft>;
};

export type VendorBusinessProfileDraft = {
  businessName: string;
  tradingName: string;
  ownerName: string;
  ownerEmail: string;
  phone: string;
  whatsapp: string;
  country: string;
  city: string;
  suburb: string;
  physicalAddress: string;
};

const emptyProfile: VendorBusinessProfileDraft = {
  businessName: "",
  tradingName: "",
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
  initialProfile
}: VendorOnboardingFormProps) {
  const [profile, setProfile] = useState<VendorBusinessProfileDraft>({
    ...emptyProfile,
    ...initialProfile
  });

  const update = (key: keyof VendorBusinessProfileDraft, value: string) => {
    setProfile((current) => ({ ...current, [key]: value }));
  };

  const canContinue =
    profile.businessName.trim() &&
    profile.ownerName.trim() &&
    profile.ownerEmail.trim() &&
    profile.phone.trim();

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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
          <input className="border border-slate-300 px-4 py-3" placeholder="Business Name *" value={profile.businessName} onChange={(e) => update("businessName", e.target.value)} />
          <input className="border border-slate-300 px-4 py-3" placeholder="Trading Name" value={profile.tradingName} onChange={(e) => update("tradingName", e.target.value)} />
          <input className="border border-slate-300 px-4 py-3" placeholder="Owner Name *" value={profile.ownerName} onChange={(e) => update("ownerName", e.target.value)} />
          <input className="border border-slate-300 px-4 py-3" placeholder="Owner Email *" value={profile.ownerEmail} onChange={(e) => update("ownerEmail", e.target.value)} />
          <input className="border border-slate-300 px-4 py-3" placeholder="Phone *" value={profile.phone} onChange={(e) => update("phone", e.target.value)} />
          <input className="border border-slate-300 px-4 py-3" placeholder="WhatsApp" value={profile.whatsapp} onChange={(e) => update("whatsapp", e.target.value)} />
          <input className="border border-slate-300 px-4 py-3" placeholder="Country" value={profile.country} onChange={(e) => update("country", e.target.value)} />
          <input className="border border-slate-300 px-4 py-3" placeholder="City" value={profile.city} onChange={(e) => update("city", e.target.value)} />
          <input className="border border-slate-300 px-4 py-3" placeholder="Suburb" value={profile.suburb} onChange={(e) => update("suburb", e.target.value)} />
          <input className="border border-slate-300 px-4 py-3" placeholder="Physical Address" value={profile.physicalAddress} onChange={(e) => update("physicalAddress", e.target.value)} />
        </div>

        <div className="flex gap-4 mt-8">
          <button type="button" onClick={onBack} className="px-6 py-3 border border-slate-300 font-black uppercase">
            Back
          </button>

          <button
            type="button"
            disabled={!canContinue}
            onClick={() => onComplete(profile)}
            className="flex-1 px-6 py-3 bg-orange-600 disabled:bg-slate-300 text-white font-black uppercase"
          >
            Finish Onboarding
          </button>
        </div>
      </section>
    </main>
  );
}
