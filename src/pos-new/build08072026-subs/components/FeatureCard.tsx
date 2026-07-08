import type { Key } from 'react';
import type { SubscriptionFeature } from '../models/subscriptionModels';

interface FeatureCardProps {
  key?: Key;
  feature: SubscriptionFeature;
  onAdd?: (feature: SubscriptionFeature) => void;
}

function formatFeaturePrice(feature: SubscriptionFeature): string {
  if (feature.priceMonthlyUsd === null) return 'Contact';
  if (feature.priceMonthlyUsd === 0) return 'Free';
  return `$${feature.priceMonthlyUsd} /mo`;
}

export default function FeatureCard({ feature, onAdd }: FeatureCardProps) {
  const isDemoPrice = feature.priceSource === 'demo-fallback';
  return (
    <div className="flex flex-col border border-[#b1b5c2] bg-white">
      <div className="border-b border-[#d6d9e0] bg-slate-50 px-2 py-1.5">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-[11px] font-black uppercase text-[#1e222b]">{feature.name}</h4>
          {feature.category && <span className="text-[8px] font-bold uppercase text-slate-400">{feature.category}</span>}
        </div>
        <p className="text-[9px] text-slate-500 leading-tight">{feature.description}</p>
      </div>

      <div className="flex items-center justify-between gap-2 p-2">
        <div>
          <span className="text-xs font-black text-[#1e222b]">{formatFeaturePrice(feature)}</span>
          {isDemoPrice && <span className="ml-1 text-[8px] font-black uppercase text-amber-700">Demo</span>}
        </div>
        <button
          type="button"
          onClick={() => onAdd?.(feature)}
          className="bg-[#1e222b] px-2.5 py-1.5 text-[9px] font-black uppercase text-white hover:bg-slate-800"
        >
          Add Feature
        </button>
      </div>
    </div>
  );
}
