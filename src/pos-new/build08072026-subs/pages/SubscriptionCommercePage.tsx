import { useEffect, useState } from 'react';
import { Layers } from 'lucide-react';
import type { SubscriptionPlan } from '../models/subscriptionModels';
import { getSubscriptionPlans } from '../repositories/subscriptionRepository';
import PlanCard from '../components/PlanCard';
import SubscriptionCart from '../components/SubscriptionCart';
import LicenseActivationCard from '../components/LicenseActivationCard';

interface SubscriptionCommercePageProps {
  businessProfile: any;
  vendorAuth: any;
  planAccess?: any;
  onToast?: (msg: string) => void;
}

export default function SubscriptionCommercePage({
  businessProfile,
  vendorAuth,
  planAccess,
  onToast
}: SubscriptionCommercePageProps) {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    void getSubscriptionPlans().then((result) => {
      if (!active) return;
      setPlans(result);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const anyDemoPrice = plans.some((plan) => plan.priceSource === 'demo-fallback');

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-800 pb-2 flex items-center justify-between">
        <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Layers className="w-4 h-4 text-orange-500" />
          SUBSCRIPTION COMMERCE
        </span>
        <span className="text-[9px] text-orange-400 uppercase bg-slate-950 px-1.5 py-0.5 border border-slate-900 font-bold">Plan Catalogue</span>
      </div>

      <p className="text-[10px] text-slate-300 uppercase leading-normal">
        Compare industrial-grade plans, review included limits and features, then activate or request an upgrade. Warehouses are independent inventory entry points and are not tied to branch count.
      </p>

      {anyDemoPrice && (
        <div className="border border-amber-300 bg-amber-50 p-2 text-[10px] font-bold uppercase text-amber-800">
          Pricing shown is DEMO / FALLBACK data. Real prices load from the Backend Console when available.
        </div>
      )}

      {!loaded && (
        <div className="p-12 text-center text-slate-500 text-xs font-mono uppercase">Loading plans...</div>
      )}

      {loaded && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              selected={selectedPlan?.id === plan.id}
              onSelect={setSelectedPlan}
            />
          ))}
        </div>
      )}

      <SubscriptionCart selectedPlan={selectedPlan} />

      <LicenseActivationCard
        businessProfile={businessProfile}
        vendorAuth={vendorAuth}
        onToast={onToast}
      />
    </div>
  );
}
