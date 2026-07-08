import type { Key } from 'react';
import type { SubscriptionPlan, LimitValue } from '../models/subscriptionModels';
import { formatLimitValue } from '../models/subscriptionModels';
import FeatureCard from './FeatureCard';

interface PlanCardProps {
  key?: Key;
  plan: SubscriptionPlan;
  selected?: boolean;
  onSelect?: (plan: SubscriptionPlan) => void;
}

function formatPrice(plan: SubscriptionPlan): string {
  if (plan.priceMonthlyUsd === null) return 'Contact Sales';
  if (plan.priceMonthlyUsd === 0) return 'Free';
  return `$${plan.priceMonthlyUsd} /mo`;
}

const LIMIT_ROWS: Array<{ key: keyof SubscriptionPlan['limits']; label: string }> = [
  { key: 'products', label: 'Products' },
  { key: 'branches', label: 'Branches' },
  { key: 'warehouses', label: 'Warehouses' },
  { key: 'terminals', label: 'POS Terminals' },
  { key: 'staff', label: 'Staff Users' }
];

export default function PlanCard({ plan, selected = false, onSelect }: PlanCardProps) {
  const isDemoPrice = plan.priceSource === 'demo-fallback';

  return (
    <div
      className={`flex flex-col border bg-white ${
        plan.popular ? 'border-orange-500 ring-1 ring-orange-300' : 'border-[#b1b5c2]'
      } ${selected ? 'outline outline-2 outline-orange-600' : ''}`}
    >
      <div className="flex items-center justify-between border-b border-[#d6d9e0] bg-slate-50 px-3 py-2">
        <div>
          <h3 className="text-sm font-black uppercase text-[#1e222b]">{plan.name}</h3>
          <p className="text-[10px] text-slate-500">{plan.tagline}</p>
        </div>
        {plan.popular && (
          <span className="bg-orange-600 px-2 py-0.5 text-[9px] font-black uppercase text-white">Popular</span>
        )}
      </div>

      <div className="px-3 py-3">
        <div className="flex items-baseline justify-between">
          <span className="text-lg font-black text-[#1e222b]">{formatPrice(plan)}</span>
          {isDemoPrice && (
            <span
              title="Placeholder pricing. Real prices load from the Backend Console."
              className="border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[8px] font-black uppercase text-amber-700"
            >
              Demo / Fallback
            </span>
          )}
        </div>
        {plan.durationDays && (
          <p className="mt-0.5 text-[10px] font-bold uppercase text-slate-500">{plan.durationDays}-day trial · config-ready (14 or 30)</p>
        )}

        <div className="mt-3 grid grid-cols-1 gap-1 border border-[#e6e8ee] bg-slate-50 p-2 text-[10px] font-bold text-slate-700">
          {LIMIT_ROWS.map((row) => (
            <div key={row.key} className="flex justify-between">
              <span>{row.label}</span>
              <span className="text-[#1e222b]">{formatLimitValue(plan.limits[row.key])}</span>
            </div>
          ))}
        </div>
        <p className="mt-1 text-[9px] uppercase text-slate-400">
          Warehouses are independent inventory entry points — not tied to branch count.
        </p>

        <div className="mt-3 grid grid-cols-1 gap-1">
          {plan.features.map((feature) => (
            <FeatureCard key={feature} label={feature} enabled />
          ))}
        </div>
      </div>

      {onSelect && (
        <button
          type="button"
          onClick={() => onSelect(plan)}
          className={`mt-auto w-full px-3 py-2 text-[10px] font-black uppercase ${
            selected ? 'bg-orange-700 text-white' : 'bg-[#1e222b] text-white hover:bg-slate-800'
          }`}
        >
          {selected ? 'Selected' : 'Select Plan'}
        </button>
      )}
    </div>
  );
}
