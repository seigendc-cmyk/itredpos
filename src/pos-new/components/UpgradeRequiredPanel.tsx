import { useMemo, useState } from 'react';
import { AlertTriangle, MessageCircle, KeyRound } from 'lucide-react';
import ActivationTokenEntryPanel from './ActivationTokenEntryPanel';
import type { ActivationTokenResult } from '../auth/activationTokenService';

export const SCI_BACKOFFICE_WHATSAPP = '263775747198';

export interface UpgradeRequiredVendorContext {
  vendorName: string;
  vendorId: string;
  ownerName?: string;
  ownerPhone?: string;
  ownerWhatsapp?: string;
  city?: string;
  suburb?: string;
}

interface UpgradeRequiredPanelProps {
  featureName: string;
  currentPlan: string;
  requiredPlan: string;
  vendor: UpgradeRequiredVendorContext;
  detail?: string;
  onActivated?: (result: ActivationTokenResult) => void;
}

function display(value?: string): string {
  return String(value || '').trim() || '-';
}

export default function UpgradeRequiredPanel({
  featureName,
  currentPlan,
  requiredPlan,
  vendor,
  detail,
  onActivated
}: UpgradeRequiredPanelProps) {
  const [tokenEntryOpen, setTokenEntryOpen] = useState(false);
  const ownerPhone = vendor.ownerWhatsapp || vendor.ownerPhone || '';

  const whatsAppMessage = useMemo(() => {
    return [
      'POS Upgrade Request',
      `Vendor business name: ${display(vendor.vendorName)}`,
      `Vendor ID: ${display(vendor.vendorId)}`,
      `Current plan: ${display(currentPlan)}`,
      `Requested feature: ${display(featureName)}`,
      `Required plan: ${display(requiredPlan)}`,
      `Owner name: ${display(vendor.ownerName)}`,
      `Owner phone: ${display(ownerPhone)}`,
      `City / suburb: ${[vendor.city, vendor.suburb].filter(Boolean).join(' / ') || '-'}`,
      `Date/time: ${new Date().toLocaleString()}`
    ].join('\n');
  }, [currentPlan, featureName, ownerPhone, requiredPlan, vendor.city, vendor.ownerName, vendor.suburb, vendor.vendorId, vendor.vendorName]);

  const whatsAppHref = `https://wa.me/${SCI_BACKOFFICE_WHATSAPP}?text=${encodeURIComponent(whatsAppMessage)}`;

  return (
    <div className="mx-auto my-12 flex min-h-[380px] max-w-2xl flex-col justify-center border border-orange-300 bg-white p-6 text-center shadow-sm">
      <div className="mx-auto mb-4 border border-orange-300 bg-orange-50 p-3 text-orange-700">
        <AlertTriangle className="h-8 w-8" />
      </div>
      <h2 className="text-lg font-black uppercase text-[#1e222b]">Upgrade Required</h2>
      {detail && <p className="mx-auto mt-2 max-w-lg text-sm font-semibold text-slate-600">{detail}</p>}

      <div className="mt-5 grid gap-2 text-left text-xs font-bold text-slate-700 md:grid-cols-2">
        <InfoRow label="Feature" value={featureName} />
        <InfoRow label="Current plan" value={currentPlan} />
        <InfoRow label="Required plan" value={requiredPlan} />
        <InfoRow label="Vendor" value={vendor.vendorName} />
        <InfoRow label="Vendor ID" value={vendor.vendorId} />
        <InfoRow label="Owner" value={vendor.ownerName} />
        <InfoRow label="Phone / WhatsApp" value={ownerPhone} />
        <InfoRow label="City / suburb" value={[vendor.city, vendor.suburb].filter(Boolean).join(' / ')} />
      </div>

      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <a
          href={whatsAppHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 bg-orange-600 px-5 py-3 text-xs font-black uppercase text-white hover:bg-orange-500"
        >
          <MessageCircle className="h-4 w-4" />
          Request Upgrade via WhatsApp
        </a>
        <button
          type="button"
          onClick={() => setTokenEntryOpen(true)}
          className="inline-flex items-center gap-2 border border-slate-300 bg-white px-5 py-3 text-xs font-black uppercase text-slate-900 hover:border-orange-400"
        >
          <KeyRound className="h-4 w-4" />
          Enter Activation Code
        </button>
      </div>

      {tokenEntryOpen && (
        <div className="mt-5">
          <ActivationTokenEntryPanel
            vendorId={vendor.vendorId}
            onCancel={() => setTokenEntryOpen(false)}
            onActivated={(result) => {
              onActivated?.(result);
              if (result.ok) setTokenEntryOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex justify-between gap-3 border border-slate-200 bg-slate-50 p-3">
      <span className="text-slate-500">{label}</span>
      <strong className="text-right text-slate-950">{display(value)}</strong>
    </div>
  );
}
