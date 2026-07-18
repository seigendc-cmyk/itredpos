import { useState, useEffect } from 'react';
import {
  listPricingPlans,
  seedDefaultPricingPlansIfEmpty,
  activatePricingPlan,
  deactivatePricingPlan,
  assignPlanToVendor,
  repairLegacyDemoLicense
} from './pricingPlansService';
import type {
  PricingPlanRecord,
  PlanCode,
  PlanLimits
} from '../shared/backend';
import {
  Layers,
  ArrowLeft,
  RefreshCw,
  PlusCircle,
  Database,
  CheckCircle,
  XCircle,
  Link,
  Users,
  Compass,
  AlertTriangle,
  FolderOpen
} from 'lucide-react';

export default function PricingPlansManagerPage() {
  const [plans, setPlans] = useState<PricingPlanRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errMessage, setErrMessage] = useState<string | null>(null);
  const [adminName, setAdminName] = useState('Console Admin');

  const fetchPlans = async () => {
    setIsLoading(true);
    setErrMessage(null);
    try {
      const data = await listPricingPlans();
      setPlans(data);
    } catch (err) {
      console.error(err);
      setErrMessage("Pricing plans queue is unavailable. Check Firebase connection.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const handleSeed = async () => {
    setIsLoading(true);
    try {
      await seedDefaultPricingPlansIfEmpty();
      await fetchPlans();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to seed default plans');
      setIsLoading(false);
    }
  };

  const handleActivate = async (planCode: PlanCode) => {
    try {
      await activatePricingPlan(planCode);
      await fetchPlans();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to activate plan');
    }
  };

  const handleDeactivate = async (planCode: PlanCode) => {
    try {
      await deactivatePricingPlan(planCode);
      await fetchPlans();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to deactivate plan');
    }
  };

  const handleAssignToVendor = async (planCode: PlanCode) => {
    const vendorId = prompt("Enter Vendor ID to assign this plan to:");
    if (!vendorId) return; // User cancelled or left empty
    try {
      await assignPlanToVendor(vendorId.trim(), planCode, adminName);
      alert(`Successfully assigned plan ${planCode} to vendor ${vendorId}!`);
      await fetchPlans();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to assign plan to vendor');
    }
  };

  const handleRepairLegacyDemo = async () => {
    const vendorId = prompt('Enter the exact Vendor ID to dry-run legacy DEMO repair:');
    if (!vendorId) return;
    try {
      const dryRun = await repairLegacyDemoLicense(vendorId.trim(), adminName, true);
      if (!dryRun.eligible) {
        alert(`Repair refused: ${dryRun.reason}`);
        return;
      }
      const approved = confirm(`${dryRun.reason}\n\nApply the canonical Trial lifecycle to ${dryRun.vendorId}?`);
      if (!approved) return;
      const applied = await repairLegacyDemoLicense(vendorId.trim(), adminName, false);
      alert(applied.reason);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Legacy DEMO repair failed safely.');
    }
  };

  // Custom route navigation matching App.tsx
  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <div className="min-h-screen bg-gray-50/50 font-sans text-gray-800 antialiased pb-12">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 text-white p-6 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigateTo('/platform/firebase-readiness')}
              className="p-2 bg-slate-800/80 rounded-lg hover:bg-slate-800 transition-colors border border-slate-700/50"
              title="Back to Platform Readiness"
            >
              <ArrowLeft className="w-5 h-5 text-slate-300" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[9px] bg-orange-600 text-white rounded font-bold uppercase tracking-wider">Console</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Subscription Management</span>
              </div>
              <h1 className="text-2xl font-black text-white tracking-wide uppercase mt-1">
                Pricing Plans Manager
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-400" />
              <label className="text-[10px] font-bold text-slate-400 uppercase mr-1">Admin:</label>
              <input
                type="text"
                value={adminName}
                onChange={e => setAdminName(e.target.value)}
                className="bg-transparent text-sm text-white font-bold outline-none border-b border-transparent focus:border-orange-500 w-32"
              />
            </div>
            
            {plans.length === 0 && !isLoading && (
              <button
                onClick={handleSeed}
                className="bg-orange-600 hover:bg-orange-700 text-white font-black text-xs uppercase px-4 py-2.5 rounded-lg flex items-center gap-2 transition-all active:scale-[0.98]"
              >
                <Database className="w-4 h-4" />
                Seed Default Plans
              </button>
            )}

            <button
              onClick={fetchPlans}
              className="bg-slate-800 hover:bg-slate-750 text-white border border-slate-755 font-bold text-xs px-4 py-2.5 rounded-lg flex items-center gap-2 transition-all active:scale-[0.98]"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={handleRepairLegacyDemo}
              className="bg-amber-700 hover:bg-amber-800 text-white border border-amber-600 font-bold text-xs px-4 py-2.5 rounded-lg flex items-center gap-2 transition-all active:scale-[0.98]"
            >
              <CheckCircle className="w-4 h-4" />
              Repair Legacy Demo
            </button>
          </div>
        </div>
      </header>

      {/* Sub navigation bar */}
      <div className="bg-white border-b border-gray-200 py-3 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center gap-4">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase">
            <Compass className="w-4 h-4 text-gray-400" />
            Quick Navigation:
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateTo('/platform/vendor-verification')}
              className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 rounded-lg text-xs font-bold uppercase transition-colors"
            >
              Vendor Verification Queue
            </button>
            <button
              onClick={() => navigateTo('/platform/activation-tokens')}
              className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 rounded-lg text-xs font-bold uppercase transition-colors"
            >
              Activation Tokens
            </button>
            <button
              onClick={() => navigateTo('/platform/payment-renewals')}
              className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 rounded-lg text-xs font-bold uppercase transition-colors"
            >
              Payment Renewals
            </button>
            <button
              onClick={() => navigateTo('/platform/firebase-readiness')}
              className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 rounded-lg text-xs font-bold uppercase transition-colors"
            >
              Platform Readiness Page
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {errMessage ? (
          <div className="bg-red-50 border-l-4 border-red-500 rounded-xl p-6 shadow-sm flex items-start gap-4">
            <AlertTriangle className="w-6 h-6 text-red-500 shrink-0" />
            <div>
              <h3 className="font-extrabold text-red-900 uppercase text-sm tracking-wider">Connection Failure</h3>
              <p className="text-sm text-red-700 font-semibold mt-1">{errMessage}</p>
            </div>
          </div>
        ) : isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
            <p className="text-sm text-gray-500 font-bold uppercase tracking-wider">Loading pricing configurations...</p>
          </div>
        ) : plans.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl py-16 px-6 text-center shadow-sm max-w-2xl mx-auto">
            <Layers className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="font-black text-gray-700 uppercase text-sm tracking-wider">No Plans Seeded</h3>
            <p className="text-sm text-gray-400 mt-2">
              The pricing configuration store is currently empty in Firestore. Seed the default iTred pricing schemas to initialize.
            </p>
            <button
              onClick={handleSeed}
              className="mt-6 bg-orange-600 hover:bg-orange-700 text-white font-black text-xs uppercase px-6 py-3 rounded-lg inline-flex items-center gap-2 transition-all active:scale-[0.98]"
            >
              <Database className="w-4 h-4" />
              Seed Default Plans Now
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map(plan => {
              const features = plan.featureFlags || {};
              const limits: PlanLimits = plan.limits || { maxBranches: 0, maxWarehouses: 0, maxTerminals: 0, maxStaff: 0, maxProducts: 0 };

              return (
                <div key={plan.planCode} className="bg-white rounded-2xl border border-gray-150 shadow-[0_4px_20px_rgb(0,0,0,0.015)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.03)] transition-all overflow-hidden flex flex-col justify-between">
                  {/* Header */}
                  <div className="p-6 border-b border-gray-100">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-black text-[9px] uppercase tracking-wider">
                            {plan.planCode}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${
                            plan.status === 'Active'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-rose-50 text-rose-800 border-rose-200'
                          }`}>
                            {plan.status || 'Active'}
                          </span>
                        </div>
                        <h3 className="text-base font-black text-gray-800 uppercase mt-2 tracking-wide">
                          {plan.planName}
                        </h3>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-lg font-black text-orange-600 leading-tight">
                          ${plan.monthlyPrice}
                        </div>
                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                          Per {plan.billingCycle || 'Month'}
                        </div>
                      </div>
                    </div>
                    {plan.description && (
                      <p className="text-xs text-gray-500 font-medium mt-3 leading-relaxed">
                        {plan.description}
                      </p>
                    )}
                  </div>

                  {/* Limits */}
                  <div className="p-6 bg-gray-50/20 border-b border-gray-100 space-y-3">
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Operating Limits</h4>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs text-gray-600 font-semibold">
                      <div className="flex justify-between border-b border-gray-100/60 pb-1">
                        <span className="text-gray-400">Max Branches</span>
                        <span className="text-gray-800 font-bold">{limits.maxBranches ?? 'n/a'}</span>
                      </div>
                      <div className="flex justify-between border-b border-gray-100/60 pb-1">
                        <span className="text-gray-400">Max Warehouses</span>
                        <span className="text-gray-800 font-bold">{limits.maxWarehouses ?? 'n/a'}</span>
                      </div>
                      <div className="flex justify-between border-b border-gray-100/60 pb-1">
                        <span className="text-gray-400">Max Terminals</span>
                        <span className="text-gray-800 font-bold">{limits.maxTerminals ?? 'n/a'}</span>
                      </div>
                      <div className="flex justify-between border-b border-gray-100/60 pb-1">
                        <span className="text-gray-400">Max Staff</span>
                        <span className="text-gray-800 font-bold">{limits.maxStaff ?? 'n/a'}</span>
                      </div>
                      <div className="col-span-2 flex justify-between border-b border-gray-100/60 pb-1">
                        <span className="text-gray-400">Max Products</span>
                        <span className="text-gray-800 font-bold">{limits.maxProducts ?? 'n/a'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Feature flags */}
                  <div className="p-6 bg-gray-50/10 space-y-3">
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Enabled Features</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(features).map(([flag, enabled]) => {
                        const label = flag.replace(/Enabled$/, '').replace(/([A-Z])/g, ' $1').trim();
                        return (
                          <span
                            key={flag}
                            className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors ${
                              enabled
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-150'
                                : 'bg-gray-50 text-gray-450 border-gray-200 line-through opacity-60'
                            }`}
                          >
                            {label}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="p-6 bg-white border-t border-gray-100 space-y-2">
                    <div className="flex gap-2">
                      {plan.status === 'Inactive' ? (
                        <button
                          onClick={() => handleActivate(plan.planCode)}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-[0.98]"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Activate
                        </button>
                      ) : (
                        <button
                          onClick={() => handleDeactivate(plan.planCode)}
                          className="flex-1 bg-red-650 hover:bg-red-700 text-white font-bold text-xs uppercase py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-[0.98]"
                        >
                          <XCircle className="w-4 h-4" />
                          Deactivate
                        </button>
                      )}
                    </div>
                    
                    <button
                      onClick={() => handleAssignToVendor(plan.planCode)}
                      className="w-full bg-white hover:bg-orange-50 border border-orange-500 text-orange-600 font-extrabold text-xs uppercase py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-[0.98]"
                    >
                      <Link className="w-4 h-4" />
                      Assign Plan to Vendor
                    </button>
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
