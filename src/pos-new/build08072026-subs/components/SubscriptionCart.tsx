import type { SubscriptionPlan } from '../models/subscriptionModels';

interface SubscriptionCartProps {
  selectedPlan?: SubscriptionPlan | null;
}

/**
 * Placeholder cart panel — wired for Step 3 (checkout / invoice generation).
 * For now it reflects the currently selected plan and a ready state.
 */
export default function SubscriptionCart({ selectedPlan }: SubscriptionCartProps) {
  return (
    <div className="border border-[#b1b5c2] bg-white">
      <div className="flex items-center justify-between border-b border-[#d6d9e0] bg-slate-50 px-3 py-2">
        <h3 className="text-sm font-black uppercase text-[#1e222b]">Subscription Cart</h3>
        <span className="bg-orange-600 px-2 py-0.5 text-[9px] font-black uppercase text-white">Step 3 Ready</span>
      </div>

      <div className="p-3 text-xs">
        {selectedPlan ? (
          <div className="space-y-2">
            <div className="flex justify-between border-b border-[#e6e8ee] pb-1 font-bold text-[#1e222b]">
              <span>{selectedPlan.name}</span>
              <span>{selectedPlan.priceMonthlyUsd === null ? 'Contact' : selectedPlan.priceMonthlyUsd === 0 ? 'Free' : `$${selectedPlan.priceMonthlyUsd}/mo`}</span>
            </div>
            <p className="text-[10px] text-slate-500">Checkout and invoice preview will be enabled in Step 3.</p>
          </div>
        ) : (
          <p className="text-[10px] text-slate-500">No plan selected yet. Choose a plan above to add it to the cart.</p>
        )}
      </div>
    </div>
  );
}
