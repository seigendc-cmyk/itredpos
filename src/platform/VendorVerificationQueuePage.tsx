import { useState, useEffect } from 'react';
import {
  collection,
  getDocs
} from 'firebase/firestore';
import { db } from '../pos-new/firebase/firebaseApp';
import {
  listVendorRegistrations,
  verifyVendor,
  rejectVendor,
  suspendVendor,
  assignVendorPlan,
  extendVendorTrial
} from './vendorVerificationService';
import {
  FIRESTORE_COLLECTIONS
} from '../shared/backend';
import type {
  VendorRegistrationRecord,
  VendorLicenseRecord,
  PlanCode
} from '../shared/backend';
import {
  Building2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Calendar,
  Mail,
  Phone,
  Layers,
  RefreshCw,
  MapPin,
  User,
  ArrowLeft,
  CalendarPlus,
  ShieldAlert
} from 'lucide-react';

export default function VendorVerificationQueuePage() {
  const [registrations, setRegistrations] = useState<VendorRegistrationRecord[]>([]);
  const [licenses, setLicenses] = useState<Record<string, VendorLicenseRecord>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [errMessage, setErrMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'verified' | 'rejected' | 'suspended'>('pending');
  const [reviewerName, setReviewerName] = useState('Console Admin');

  const fetchQueue = async () => {
    setIsLoading(true);
    setErrMessage(null);
    try {
      const regs = await listVendorRegistrations();
      
      let licenseMap: Record<string, VendorLicenseRecord> = {};
      try {
        const licensesSnapshot = await getDocs(collection(db!, FIRESTORE_COLLECTIONS.vendorLicenses));
        licensesSnapshot.docs.forEach(doc => {
          licenseMap[doc.id] = doc.data() as VendorLicenseRecord;
        });
      } catch (licenseErr) {
        console.warn('Failed to fetch licenses, merging may be incomplete:', licenseErr);
      }

      setRegistrations(regs);
      setLicenses(licenseMap);
    } catch (err) {
      console.error(err);
      setErrMessage("Vendor verification queue is unavailable. Check Firebase connection.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const handleVerify = async (vendorId: string) => {
    try {
      await verifyVendor(vendorId, reviewerName);
      await fetchQueue();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to verify vendor');
    }
  };

  const handleReject = async (vendorId: string) => {
    const reason = prompt("Enter the reason for rejection:");
    if (reason === null) return; // User cancelled
    try {
      await rejectVendor(vendorId, reviewerName, reason || "No reason specified");
      await fetchQueue();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reject vendor');
    }
  };

  const handleSuspend = async (vendorId: string) => {
    const reason = prompt("Enter the reason for suspension:");
    if (reason === null) return; // User cancelled
    try {
      await suspendVendor(vendorId, reviewerName, reason || "No reason specified");
      await fetchQueue();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to suspend vendor');
    }
  };

  const handleAssignPlan = async (vendorId: string, planCode: PlanCode) => {
    try {
      await assignVendorPlan(vendorId, planCode, reviewerName);
      await fetchQueue();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to assign plan');
    }
  };

  const handleExtendTrial = async (vendorId: string) => {
    try {
      await extendVendorTrial(vendorId, 3, reviewerName);
      await fetchQueue();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to extend trial');
    }
  };

  // Filter registrations by tab
  const getFilteredRegistrations = () => {
    return registrations.filter(reg => {
      // 1. Get active live status (merging with license if available)
      const license = licenses[reg.vendorId];
      const liveAccountStatus = license ? license.licenseStatus : reg.accountStatus;

      if (activeTab === 'suspended') {
        return liveAccountStatus === 'Suspended';
      }
      if (activeTab === 'rejected') {
        return reg.verificationStatus === 'Rejected';
      }
      if (activeTab === 'verified') {
        return reg.verificationStatus === 'Verified' && liveAccountStatus !== 'Suspended';
      }
      // 'pending' is the default
      return reg.verificationStatus === 'Pending';
    });
  };

  const filteredList = getFilteredRegistrations();

  const handleBackToReadiness = () => {
    window.history.pushState({}, '', '/platform/firebase-readiness');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <div className="min-h-screen bg-gray-50/50 font-sans text-gray-800 antialiased pb-12">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 text-white p-6 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBackToReadiness}
              className="p-2 bg-slate-800/80 rounded-lg hover:bg-slate-800 transition-colors border border-slate-700/50"
              title="Back to Platform Readiness"
            >
              <ArrowLeft className="w-5 h-5 text-slate-300" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[9px] bg-orange-600 text-white rounded font-bold uppercase tracking-wider">Console</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Vendor Management</span>
              </div>
              <h1 className="text-2xl font-black text-white tracking-wide uppercase mt-1">
                Vendor Verification Queue
              </h1>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 flex items-center gap-2">
              <User className="w-4 h-4 text-slate-400" />
              <label className="text-[10px] font-bold text-slate-400 uppercase mr-1">Reviewer:</label>
              <input
                type="text"
                value={reviewerName}
                onChange={e => setReviewerName(e.target.value)}
                className="bg-transparent text-sm text-white font-bold outline-none border-b border-transparent focus:border-orange-500 w-32"
              />
            </div>
            <button
              onClick={() => {
                window.history.pushState({}, '', '/platform/pricing-plans');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
              className="bg-slate-800 hover:bg-slate-750 text-white border border-slate-700/50 font-bold text-xs px-4 py-2.5 rounded-lg flex items-center gap-2 transition-all active:scale-[0.98]"
            >
              Pricing Plans Manager
            </button>
            <button
              onClick={() => {
                window.history.pushState({}, '', '/platform/activation-tokens');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
              className="bg-slate-800 hover:bg-slate-750 text-white border border-slate-700/50 font-bold text-xs px-4 py-2.5 rounded-lg flex items-center gap-2 transition-all active:scale-[0.98]"
            >
              Activation Tokens Manager
            </button>
            <button
              onClick={() => {
                window.history.pushState({}, '', '/platform/vendor-sync-monitor');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
              className="bg-slate-800 hover:bg-slate-750 text-white border border-slate-700/50 font-bold text-xs px-4 py-2.5 rounded-lg flex items-center gap-2 transition-all active:scale-[0.98]"
            >
              Vendor Sync Monitor
            </button>
            <button
              onClick={fetchQueue}
              className="bg-slate-800 hover:bg-slate-750 text-white border border-slate-755 font-bold text-xs px-4 py-2.5 rounded-lg flex items-center gap-2 transition-all active:scale-[0.98]"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6">
          <nav className="-mb-px flex gap-8">
            {(['pending', 'verified', 'rejected', 'suspended'] as const).map(tab => {
              const count = registrations.filter(reg => {
                const license = licenses[reg.vendorId];
                const liveStatus = license ? license.licenseStatus : reg.accountStatus;
                if (tab === 'suspended') return liveStatus === 'Suspended';
                if (tab === 'rejected') return reg.verificationStatus === 'Rejected';
                if (tab === 'verified') return reg.verificationStatus === 'Verified' && liveStatus !== 'Suspended';
                return reg.verificationStatus === 'Pending';
              }).length;

              const isActive = activeTab === tab;

              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`py-4 px-1 border-b-2 font-bold text-xs uppercase tracking-wider transition-colors relative flex items-center gap-2 cursor-pointer ${
                    isActive
                      ? 'border-orange-500 text-orange-600'
                      : 'border-transparent text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {tab}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                    isActive
                      ? 'bg-orange-100 text-orange-800'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {errMessage ? (
          <div className="bg-red-50 border-l-4 border-red-500 rounded-xl p-6 shadow-sm flex items-start gap-4">
            <ShieldAlert className="w-6 h-6 text-red-500 shrink-0" />
            <div>
              <h3 className="font-extrabold text-red-900 uppercase text-sm tracking-wider">Connection Error</h3>
              <p className="text-sm text-red-700 font-semibold mt-1">{errMessage}</p>
            </div>
          </div>
        ) : isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
            <p className="text-sm text-gray-500 font-bold uppercase tracking-wider">Loading registrations...</p>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl py-16 px-6 text-center shadow-sm">
            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="font-black text-gray-600 uppercase text-sm tracking-wider">No Records Found</h3>
            <p className="text-sm text-gray-400 mt-1">There are no vendor profiles in the "{activeTab}" state.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredList.map(reg => {
              const license = licenses[reg.vendorId];
              const displayLicenseStatus = license ? license.licenseStatus : reg.licenseStatus;
              const displayAccountStatus = license ? license.licenseStatus : reg.accountStatus;
              const displayPlan = license ? license.planCode : reg.planCode;
              const displayExpires = license?.expiresAt || '';

              return (
                <div key={reg.vendorId} className="bg-white rounded-2xl border border-gray-150 shadow-[0_4px_20px_rgb(0,0,0,0.015)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.03)] transition-all overflow-hidden flex flex-col justify-between">
                  
                  {/* Card Header */}
                  <div className="p-6 border-b border-gray-100">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-base font-black text-gray-800 tracking-wide uppercase leading-tight">
                          {reg.businessName}
                        </h3>
                        {reg.tradingName && reg.tradingName !== reg.businessName && (
                          <p className="text-xs text-gray-400 font-medium mt-0.5">
                            Trading as: {reg.tradingName}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5 shrink-0 justify-end">
                        {/* Verification Status */}
                        <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border ${
                          reg.verificationStatus === 'Pending'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : reg.verificationStatus === 'Verified'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-rose-50 text-rose-800 border-rose-200'
                        }`}>
                          {reg.verificationStatus}
                        </span>

                        {/* Account Status */}
                        <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border ${
                          displayAccountStatus === 'Suspended'
                            ? 'bg-slate-50 text-slate-800 border-slate-200'
                            : displayAccountStatus === 'Active'
                              ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                              : 'bg-blue-50 text-blue-800 border-blue-200'
                        }`}>
                          {displayAccountStatus}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-6 bg-gray-50/20 grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                    {/* Contacts */}
                    <div className="space-y-3">
                      <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5" /> Owner & Contacts
                      </h4>
                      <div className="space-y-2 text-gray-600 font-medium">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-450 w-4">💼</span>
                          <span className="text-gray-800 font-bold">{reg.ownerName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Mail className="w-3.5 h-3.5 text-gray-400" />
                          <a href={`mailto:${reg.ownerEmail}`} className="hover:underline hover:text-orange-500">{reg.ownerEmail}</a>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-gray-400" />
                          <span>{reg.phone || 'No phone'}</span>
                        </div>
                        {reg.whatsapp && (
                          <div className="flex items-center gap-2">
                            <span className="text-green-500">💬</span>
                            <span>WhatsApp: {reg.whatsapp}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* License & Plans */}
                    <div className="space-y-3">
                      <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5" /> License & Subscription
                      </h4>
                      <div className="space-y-2 text-gray-600 font-medium">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-400">Plan:</span>
                          <span className="px-1.5 py-0.5 bg-gray-100 text-gray-800 rounded font-black tracking-wider uppercase text-[10px]">
                            {displayPlan}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-400">Status:</span>
                          <span className="text-gray-800 font-semibold">{displayLicenseStatus}</span>
                        </div>
                        {displayExpires && (
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-gray-400" />
                            <div>
                              <div className="text-[10px] text-gray-400 font-bold uppercase">Expires</div>
                              <span className="text-gray-850 font-bold">
                                {new Date(displayExpires).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Metadata & Location */}
                  <div className="px-6 py-3 bg-gray-50/50 border-y border-gray-100 flex flex-wrap justify-between items-center gap-2 text-[10px] text-gray-450 font-semibold">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-gray-400" />
                      <span>{[reg.suburb, reg.city, reg.country].filter(Boolean).join(', ')}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-gray-400" />
                      <span>Submitted: {new Date(reg.createdAt).toLocaleDateString(undefined, { dateStyle: 'short' })}</span>
                    </div>
                  </div>

                  {/* Audit / Review Reason Warning if Rejected */}
                  {reg.verificationStatus === 'Rejected' && reg.reviewReason && (
                    <div className="px-6 py-3 bg-rose-50 border-b border-gray-100 flex items-start gap-2 text-xs text-rose-800 font-medium">
                      <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-black uppercase text-[10px] text-rose-700 block">Rejection Reason</span>
                        {reg.reviewReason}
                      </div>
                    </div>
                  )}

                  {/* Card Actions Panel */}
                  <div className="p-6 bg-white border-t border-gray-100 flex flex-col gap-4">
                    {/* Primary Operations (Verify, Reject, Suspend, Extend) */}
                    <div className="flex flex-wrap gap-2">
                      {reg.verificationStatus === 'Pending' ? (
                        <>
                          <button
                            onClick={() => handleVerify(reg.vendorId)}
                            className="bg-orange-600 hover:bg-orange-700 text-white font-black text-xs uppercase px-4 py-2.5 rounded-lg flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-[0.98]"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Verify Vendor
                          </button>
                          <button
                            onClick={() => handleReject(reg.vendorId)}
                            className="bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase px-4 py-2.5 rounded-lg flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-[0.98]"
                          >
                            <XCircle className="w-4 h-4" />
                            Reject Vendor
                          </button>
                        </>
                      ) : (
                        <>
                          {displayAccountStatus !== 'Suspended' && (
                            <button
                              onClick={() => handleSuspend(reg.vendorId)}
                              className="bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase px-4 py-2.5 rounded-lg flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-[0.98]"
                            >
                              <ShieldAlert className="w-4 h-4" />
                              Suspend Vendor
                            </button>
                          )}
                          {displayAccountStatus === 'Suspended' && (
                            <button
                              onClick={() => handleVerify(reg.vendorId)}
                              className="bg-orange-600 hover:bg-orange-700 text-white font-black text-xs uppercase px-4 py-2.5 rounded-lg flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-[0.98]"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              Re-Verify / Activate
                            </button>
                          )}
                          {reg.verificationStatus === 'Rejected' && (
                            <button
                              onClick={() => handleVerify(reg.vendorId)}
                              className="bg-orange-600 hover:bg-orange-700 text-white font-black text-xs uppercase px-4 py-2.5 rounded-lg flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-[0.98]"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              Verify Vendor
                            </button>
                          )}
                          <button
                            onClick={() => handleExtendTrial(reg.vendorId)}
                            className="bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 font-bold text-xs uppercase px-4 py-2.5 rounded-lg flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-[0.98]"
                          >
                            <CalendarPlus className="w-4 h-4 text-orange-500" />
                            Extend Trial 3 Days
                          </button>
                        </>
                      )}
                    </div>

                    {/* Subscription Pricing Plans Assigner (Only if not Pending) */}
                    {reg.verificationStatus !== 'Pending' && (
                      <div className="border-t border-gray-100 pt-4">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-2">
                          Assign Pricing Subscription Plan
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {(['DEMO', 'STARTER', 'STANDARD', 'PRO'] as PlanCode[]).map(plan => {
                            const isCurrent = displayPlan === plan;
                            return (
                              <button
                                key={plan}
                                onClick={() => handleAssignPlan(reg.vendorId, plan)}
                                disabled={isCurrent}
                                className={`text-[10px] font-extrabold uppercase px-2.5 py-1.5 rounded-md border transition-all cursor-pointer ${
                                  isCurrent
                                    ? 'bg-orange-100 border-orange-200 text-orange-700 font-black cursor-default'
                                    : 'bg-white border-gray-300 text-gray-600 hover:border-orange-500 hover:text-orange-600 active:scale-[0.98]'
                                }`}
                              >
                                {plan}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
