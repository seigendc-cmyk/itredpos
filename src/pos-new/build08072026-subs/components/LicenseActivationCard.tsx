import { useState, useEffect } from 'react';
import {
  subscribeToVendorRuntimeLicense,
  type VendorLicenseRuntimeSnapshot
} from '../../auth/vendorLicenseRuntimeService';
import { redeemActivationToken } from '../../auth/activationTokenService';
import {
  Layers,
  ShieldAlert,
  CheckCircle,
  Clock,
  ArrowRight,
  Key,
  AlertTriangle
} from 'lucide-react';

interface LicenseActivationCardProps {
  businessProfile: any;
  vendorAuth: any;
  onToast?: (msg: string) => void;
}

const featuresList = [
  { key: 'salesEnabled', label: 'Sales Processing' },
  { key: 'inventoryEnabled', label: 'Inventory Control' },
  { key: 'reportsEnabled', label: 'Analytics & Reports' },
  { key: 'deliveryEnabled', label: 'Delivery Tracking' },
  { key: 'purchasingEnabled', label: 'Supplier Purchasing' },
  { key: 'creditorsEnabled', label: 'Creditor Accounts' },
  { key: 'biEnabled', label: 'BI Warnings Desk' },
  { key: 'multiBranchEnabled', label: 'Multi-Branch registry' },
  { key: 'multiWarehouseEnabled', label: 'Multi-Warehouse registry' },
  { key: 'staffManagementEnabled', label: 'Staff Management' },
  { key: 'advancedSettingsEnabled', label: 'Advanced Settings' }
];

export default function LicenseActivationCard({ businessProfile, vendorAuth, onToast }: LicenseActivationCardProps) {
  const [runtimeLicense, setRuntimeLicense] = useState<VendorLicenseRuntimeSnapshot | null>(null);
  const [activationCode, setActivationCode] = useState('');
  const [activationStatus, setActivationStatus] = useState<string | null>(null);
  const [activationError, setActivationError] = useState<string | null>(null);
  const [isActivating, setIsActivating] = useState(false);
  const [upgradeTarget, setUpgradeTarget] = useState('STARTER');
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);

  useEffect(() => {
    const vendorId = vendorAuth?.vendorId;
    if (!vendorId) return;
    return subscribeToVendorRuntimeLicense(vendorId, (snapshot) => {
      setRuntimeLicense(snapshot);
    });
  }, [vendorAuth?.vendorId]);

  const handleActivate = async () => {
    if (isActivating) return;
    const code = activationCode.trim();
    if (!code) {
      setActivationError('Enter an activation code.');
      return;
    }
    const vendorId = vendorAuth?.vendorId;
    if (!vendorId) {
      setActivationError('Vendor identity is missing.');
      return;
    }
    setIsActivating(true);
    setActivationStatus(null);
    setActivationError(null);
    try {
      const result = await redeemActivationToken(code, vendorId);
      if (result.ok) {
        setActivationStatus(result.message);
        setActivationCode('');
        setShowSuccessScreen(true);
        if (onToast) onToast(result.message);
      } else {
        setActivationError(result.message);
      }
    } catch (err) {
      setActivationError(err instanceof Error ? err.message : 'Failed to activate token.');
    } finally {
      setIsActivating(false);
    }
  };

  const handleWhatsAppUpgrade = () => {
    const currentPlan = runtimeLicense?.planCode || vendorAuth?.planCode || 'DEMO';
    const city = businessProfile?.cityTown || businessProfile?.city || '';
    const suburb = businessProfile?.districtSuburb || businessProfile?.suburb || '';
    const textMessage = `Hello iTred Support, I would like to request an upgrade for my POS account.
- Business Name: ${businessProfile?.businessName || 'N/A'}
- Vendor ID: ${vendorAuth?.vendorId || 'N/A'}
- Current Plan: ${currentPlan}
- Requested Upgrade: ${upgradeTarget}
- Owner Contact: ${businessProfile?.ownerContact || businessProfile?.phone || 'N/A'}
- Location: ${[suburb, city].filter(Boolean).join(', ') || 'N/A'}`;
    const whatsappUrl = `https://wa.me/27820000000?text=${encodeURIComponent(textMessage)}`;
    window.open(whatsappUrl, '_blank');
  };

  const getStatusAlert = (snapshot: VendorLicenseRuntimeSnapshot) => {
    const actStatus = snapshot.activationStatus?.toLowerCase().replace(/[\s_-]+/g, '');
    const licStatus = snapshot.licenseStatus?.toLowerCase().replace(/[\s_-]+/g, '');
    const accStatus = snapshot.accountStatus?.toLowerCase().replace(/[\s_-]+/g, '');
    const verStatus = snapshot.verificationStatus?.toLowerCase().replace(/[\s_-]+/g, '');
    if (accStatus === 'suspended') return { tone: 'error', title: 'Account Suspended', text: 'Account Suspended. Contact back office.' };
    if (verStatus === 'rejected') return { tone: 'error', title: 'Vendor Registration Rejected', text: 'Vendor Registration Rejected. Contact back office.' };
    if (licStatus === 'expired' || snapshot.blockReason === 'LicenseRequired') return { tone: 'error', title: 'License Required', text: 'License Required' };
    if (licStatus === 'trial' && actStatus === 'pendingconsoleverification') {
      return { tone: 'warning', title: 'Pending Verification', text: 'Your account is pending verification. You can continue using trial access while back office reviews your registration.' };
    }
    if (licStatus === 'trial' && actStatus === 'active') {
      const days = snapshot.daysRemaining ?? 3;
      return { tone: 'info', title: 'Trial Active', text: `Trial Plan Active · ${days} Days Remaining` };
    }
    return { tone: 'success', title: 'Active Subscription', text: 'Your business subscription is active and all plan features are enabled.' };
  };

  if (showSuccessScreen) {
    return (
      <div className="border border-emerald-300 bg-emerald-50 p-6 text-emerald-800 space-y-4">
        <div className="flex items-center gap-3">
          <CheckCircle className="w-8 h-8 text-emerald-600 shrink-0" />
          <div>
            <h2 className="text-base font-black uppercase tracking-wider">Subscription Activated Successfully</h2>
            <p className="text-xs font-semibold mt-1">Your new service plan features have been unlocked and synced in real-time.</p>
          </div>
        </div>
        <button onClick={() => setShowSuccessScreen(false)} className="mt-2 bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs uppercase py-2.5 px-6 transition-colors shadow-sm cursor-pointer">
          Done
        </button>
      </div>
    );
  }

  if (!runtimeLicense) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-500 text-xs font-mono uppercase">
        <RefreshCwIcon className="w-5 h-5 animate-spin text-orange-500 mb-2" />
        Loading license state...
      </div>
    );
  }

  const alert = getStatusAlert(runtimeLicense);

  return (
    <div className="space-y-4 border border-[#b1b5c2] bg-white">
      <div className="border-b border-[#d6d9e0] bg-slate-50 px-3 py-2 flex items-center justify-between">
        <span className="text-sm font-black uppercase text-[#1e222b] flex items-center gap-2">
          <Layers className="w-4 h-4 text-orange-500" />
          License Activation
        </span>
        <span className="text-[9px] text-orange-400 uppercase bg-slate-950 px-1.5 py-0.5 border border-slate-900 font-bold">Secure License Gate</span>
      </div>

      <div className="p-3 space-y-4">
        <div className={`p-3 border ${
          alert.tone === 'error' ? 'bg-rose-50 border-rose-300 text-rose-800'
            : alert.tone === 'warning' ? 'bg-amber-50 border-amber-300 text-amber-800'
            : alert.tone === 'info' ? 'bg-blue-50 border-blue-300 text-blue-800'
            : 'bg-emerald-50 border-emerald-300 text-emerald-800'
        }`}>
          <div className="flex items-start gap-3">
            {alert.tone === 'error' ? <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
              : alert.tone === 'warning' ? <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
              : alert.tone === 'info' ? <Clock className="w-5 h-5 shrink-0 mt-0.5 text-blue-600" />
              : <CheckCircle className="w-5 h-5 shrink-0 mt-0.5 text-emerald-600" />}
            <div>
              <h4 className="font-extrabold uppercase text-[10px] tracking-wider">{alert.title}</h4>
              <p className="text-xs font-semibold mt-1 leading-relaxed">{alert.text}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs font-mono border border-[#e6e8ee] bg-slate-50 p-2">
          <div className="flex justify-between border-b border-slate-200 pb-1 text-slate-400"><span>Plan</span><span className="text-[#1e222b] font-bold">{runtimeLicense.planCode}</span></div>
          <div className="flex justify-between border-b border-slate-200 pb-1 text-slate-400"><span>License</span><span className="text-[#1e222b] font-semibold">{runtimeLicense.licenseStatus}</span></div>
          <div className="flex justify-between border-b border-slate-200 pb-1 text-slate-400"><span>Branches</span><span className="text-[#1e222b] font-bold">{runtimeLicense.maxBranches}</span></div>
          <div className="flex justify-between border-b border-slate-200 pb-1 text-slate-400"><span>Warehouses</span><span className="text-[#1e222b] font-bold">{runtimeLicense.maxWarehouses}</span></div>
          <div className="flex justify-between border-b border-slate-200 pb-1 text-slate-400"><span>Terminals</span><span className="text-[#1e222b] font-bold">{runtimeLicense.maxTerminals}</span></div>
          <div className="flex justify-between text-slate-400"><span>Staff</span><span className="text-[#1e222b] font-bold">{runtimeLicense.maxStaff}</span></div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          {featuresList.map((item) => {
            const enabled = Boolean((runtimeLicense.featureFlags as any)?.[item.key]);
            return (
              <div key={item.key} className={`p-2 flex items-center justify-between text-[11px] font-semibold border ${
                enabled ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500 line-through opacity-70'
              }`}>
                <span>{item.label}</span>
                <span className="text-[9px] uppercase px-1">{enabled ? 'Active' : 'Locked'}</span>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-[#b1b5c2] p-3 space-y-3">
            <h4 className="text-[10px] font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-1.5">Request Pricing Upgrade</h4>
            <label className="block text-slate-600 text-[10px] uppercase font-bold">
              Target Upgrade Plan:
              <select value={upgradeTarget} onChange={(e) => setUpgradeTarget(e.target.value)} className="w-full mt-1 bg-white border border-[#b1b5c2] p-2 text-[#1e222b] text-xs outline-none">
                <option value="STARTER">STARTER PLAN</option>
                <option value="GROWTH">GROWTH PLAN</option>
                <option value="ENTERPRISE">ENTERPRISE CUSTOM</option>
              </select>
            </label>
            <button onClick={handleWhatsAppUpgrade} className="w-full bg-orange-600 hover:bg-orange-700 text-white font-black text-xs uppercase py-3 border border-orange-500 flex items-center justify-center gap-2 cursor-pointer">
              Request Upgrade via WhatsApp <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="border border-[#b1b5c2] p-3 space-y-3">
            <h4 className="text-[10px] font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-1.5">Redeem Activation Code</h4>
            <label className="block text-slate-600 text-[10px] uppercase font-bold">
              Activation Code Token:
              <input type="text" placeholder="SCI-XXXX-XXXX-XXXX" value={activationCode} onChange={(e) => setActivationCode(e.target.value)} className="w-full mt-1 bg-white border border-[#b1b5c2] p-2 text-[#1e222b] text-xs outline-none uppercase font-mono tracking-wider" />
            </label>
            {activationStatus && <div className="text-[10px] text-emerald-800 border border-emerald-200 bg-emerald-50 p-2 font-semibold">{activationStatus}</div>}
            {activationError && <div className="text-[10px] text-rose-800 border border-rose-200 bg-rose-50 p-2 font-semibold">{activationError}</div>}
            <button onClick={handleActivate} disabled={isActivating} className="w-full bg-[#1e222b] hover:bg-slate-800 text-white font-black text-xs uppercase py-3 border border-slate-700 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
              <Key className="w-4 h-4 text-orange-400" /> {isActivating ? 'Activating Code...' : 'Activate License'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RefreshCwIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  );
}
