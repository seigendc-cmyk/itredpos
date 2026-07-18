import { useState } from 'react';
import {
  provisionAuthenticatedVendor,
  userMessageForProvisioningError,
  type VendorOnboardingDraft
} from './VendorOnboardingService';

export type VendorBusinessProfileDraft = VendorOnboardingDraft;

type VendorOnboardingFormProps = {
  onBack?: () => void;
  onComplete?: (profile: VendorBusinessProfileDraft) => void;
  initialProfile?: Partial<VendorBusinessProfileDraft>;
  googleUid?: string;
  googleEmail?: string;
};

const BUSINESS_TYPES = ['Retail', 'Wholesale', 'Supermarket', 'Restaurant', 'Pharmacy', 'Hardware', 'Services', 'Other'];
const CURRENCIES = ['USD', 'ZWL', 'ZAR', 'BWP', 'ZMW', 'MZN'];
const emptyProfile: VendorBusinessProfileDraft = {
  businessName: '', tradingName: '', businessType: '', currency: 'USD', ownerName: '', ownerEmail: '', phone: '',
  whatsapp: '', country: 'Zimbabwe', city: '', suburb: '', physicalAddress: ''
};

export default function VendorOnboardingForm({
  onBack,
  onComplete,
  initialProfile,
  googleUid
}: VendorOnboardingFormProps) {
  const [profile, setProfile] = useState<VendorBusinessProfileDraft>({ ...emptyProfile, ...initialProfile });
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const update = (key: keyof VendorBusinessProfileDraft, value: string) => {
    setProfile((current) => ({ ...current, [key]: value }));
  };

  const canContinue = Boolean(
    profile.businessName.trim()
    && profile.ownerName.trim()
    && profile.ownerEmail.trim()
    && profile.phone.trim()
  );

  async function handleFinish() {
    setError(null);
    if (!canContinue) {
      setError('Business name, owner name, owner email, and phone are required.');
      return;
    }
    setIsSaving(true);
    try {
      // googleUid is an expected identity assertion only. The provisioning
      // service always derives ownership from live Firebase auth.currentUser.
      const result = await provisionAuthenticatedVendor(profile, googleUid);
      const now = new Date().toISOString();
      const ownerEmail = profile.ownerEmail.trim().toLowerCase();
      const businessName = profile.businessName.trim();
      const tradingName = profile.tradingName.trim() || businessName;
      localStorage.setItem('sci_vendor_owner_session', JSON.stringify({
        vendorId: result.vendorId,
        ownerUid: result.uid,
        ownerName: profile.ownerName.trim(),
        ownerEmail,
        vendorName: businessName,
        tradingName,
        phone: profile.phone.trim(),
        whatsapp: profile.whatsapp.trim(),
        country: profile.country.trim(),
        city: profile.city.trim(),
        suburb: profile.suburb.trim(),
        physicalAddress: profile.physicalAddress.trim(),
        status: 'Active', mode: 'Demo', role: 'Owner', signedInAt: now
      }));
      localStorage.setItem('itred_pos_business_profile', JSON.stringify({
        vendorId: result.vendorId,
        legalName: businessName,
        tradingName,
        businessName,
        ownerName: profile.ownerName.trim(),
        ownerEmail,
        email: result.authenticatedEmail,
        phone: profile.phone.trim(),
        whatsapp: profile.whatsapp.trim(),
        currency: profile.currency.trim() || 'USD',
        country: profile.country.trim(),
        city: profile.city.trim(),
        suburb: profile.suburb.trim(),
        physicalAddress: profile.physicalAddress.trim(),
        status: 'Active', businessStatus: 'Trial', licenseStatus: 'Trial'
      }));
      onComplete?.(profile);
    } catch (provisioningError) {
      setError(userMessageForProvisioningError(provisioningError));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f5ef] flex items-center justify-center p-6">
      <section className="w-full max-w-3xl bg-white border border-slate-300 p-8 shadow-xl">
        <p className="text-[11px] font-black uppercase tracking-[0.35em] text-orange-600">New Vendor Onboarding</p>
        <h1 className="mt-3 text-2xl font-black uppercase text-[#1e222b]">Create Business Owner Profile</h1>
        <p className="mt-2 text-sm text-slate-600">Capture the first business profile before entering POS settings.</p>
        {error && <div className="mt-6 bg-rose-50 border border-rose-300 text-rose-700 text-sm font-bold p-3">{error}</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
          <input className="border border-slate-300 px-4 py-3" placeholder="Business Name *" value={profile.businessName} onChange={(event) => update('businessName', event.target.value)} />
          <input className="border border-slate-300 px-4 py-3" placeholder="Trading Name" value={profile.tradingName} onChange={(event) => update('tradingName', event.target.value)} />
          <select className="border border-slate-300 px-4 py-3 bg-white" value={profile.businessType} onChange={(event) => update('businessType', event.target.value)}>
            <option value="">Business Type</option>
            {BUSINESS_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          <input className="border border-slate-300 px-4 py-3" placeholder="Owner Name *" value={profile.ownerName} onChange={(event) => update('ownerName', event.target.value)} />
          <input className="border border-slate-300 px-4 py-3" placeholder="Owner Email *" value={profile.ownerEmail} onChange={(event) => update('ownerEmail', event.target.value)} />
          <input className="border border-slate-300 px-4 py-3" placeholder="Phone *" value={profile.phone} onChange={(event) => update('phone', event.target.value)} />
          <input className="border border-slate-300 px-4 py-3" placeholder="WhatsApp" value={profile.whatsapp} onChange={(event) => update('whatsapp', event.target.value)} />
          <select className="border border-slate-300 px-4 py-3 bg-white" value={profile.currency} onChange={(event) => update('currency', event.target.value)}>
            {CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
          </select>
          <input className="border border-slate-300 px-4 py-3" placeholder="Country" value={profile.country} onChange={(event) => update('country', event.target.value)} />
          <input className="border border-slate-300 px-4 py-3" placeholder="City" value={profile.city} onChange={(event) => update('city', event.target.value)} />
          <input className="border border-slate-300 px-4 py-3" placeholder="Suburb" value={profile.suburb} onChange={(event) => update('suburb', event.target.value)} />
          <input className="border border-slate-300 px-4 py-3" placeholder="Physical Address" value={profile.physicalAddress} onChange={(event) => update('physicalAddress', event.target.value)} />
        </div>

        <div className="flex gap-4 mt-8">
          {onBack && <button type="button" onClick={onBack} className="px-6 py-3 border border-slate-300 font-black uppercase">Back</button>}
          <button type="button" disabled={!canContinue || isSaving} onClick={() => void handleFinish()} className="flex-1 px-6 py-3 bg-orange-600 disabled:bg-slate-300 text-white font-black uppercase">
            {isSaving ? 'Finishing...' : 'Finish Onboarding'}
          </button>
        </div>
      </section>
    </main>
  );
}
