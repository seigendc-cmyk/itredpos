import type { SubscriptionCart, SubscriptionPricingConfig, SubscriptionCartSummary } from '../models/subscriptionModels';

interface SubscriptionCartProps {
  cart: SubscriptionCart;
  pricingConfig: SubscriptionPricingConfig;
  summary: SubscriptionCartSummary;
  onRemoveItem: (itemId: string) => void;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onClear: () => void;
}

function money(value: number): string {
  return `$${value.toFixed(2)}`;
}

export default function SubscriptionCart({
  cart,
  pricingConfig,
  summary,
  onRemoveItem,
  onUpdateQuantity,
  onClear
}: SubscriptionCartProps) {
  const isEmpty = cart.items.length === 0;

  return (
    <div className="border border-[#b1b5c2] bg-white">
      <div className="flex items-center justify-between border-b border-[#d6d9e0] bg-slate-50 px-3 py-2">
        <h3 className="text-sm font-black uppercase text-[#1e222b]">Subscription Cart</h3>
        {!isEmpty && (
          <button
            type="button"
            onClick={onClear}
            className="border border-slate-300 bg-white px-2 py-0.5 text-[9px] font-black uppercase text-slate-600 hover:border-rose-400"
          >
            Clear Cart
          </button>
        )}
      </div>

      <div className="p-3 text-xs">
        {isEmpty ? (
          <p className="text-[10px] text-slate-500">Your cart is empty. Select a plan or add features above.</p>
        ) : (
          <div className="space-y-2">
            {cart.items.map((item) => {
              const lineSubtotal = item.unitPriceUsd * item.quantity;
              return (
                <div key={item.itemId} className="border border-[#e6e8ee] p-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-[#1e222b]">{item.name}</div>
                      <span className="text-[8px] font-black uppercase px-1 py-0.5 bg-slate-100 text-slate-500">{item.type}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveItem(item.itemId)}
                      className="text-[9px] font-black uppercase text-rose-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[10px]">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(item.itemId, item.quantity - 1)}
                        className="h-5 w-5 border border-slate-300 bg-white font-black text-slate-700"
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <span className="w-6 text-center font-bold text-[#1e222b]">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(item.itemId, item.quantity + 1)}
                        className="h-5 w-5 border border-slate-300 bg-white font-black text-slate-700"
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                    <div className="text-right font-mono text-slate-600">
                      {money(item.unitPriceUsd)} × {item.quantity} = <span className="font-bold text-[#1e222b]">{money(lineSubtotal)}</span>
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="mt-2 space-y-1 border-t border-[#d6d9e0] pt-2 text-[10px] font-bold uppercase text-slate-700">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="text-[#1e222b]">{money(summary.subtotalUsd)} {summary.currency}</span>
              </div>
              <div className="flex justify-between">
                <span>{pricingConfig.taxLabel}</span>
                <span className="text-[#1e222b]">{money(summary.taxAmountUsd)} {summary.currency}</span>
              </div>
              <div className="flex justify-between border-t border-[#e6e8ee] pt-1 text-xs">
                <span>Grand Total</span>
                <span className="text-orange-700">{money(summary.grandTotalUsd)} {summary.currency}</span>
              </div>
            </div>
            <p className="text-[8px] uppercase text-slate-400">Prices are demo/fallback. Backend Console pricing connects later. Tax is a placeholder.</p>
          </div>
        )}
      </div>
    </div>
  );
}
