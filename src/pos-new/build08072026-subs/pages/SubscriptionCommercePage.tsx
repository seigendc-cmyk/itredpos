import { useEffect, useState, useMemo } from 'react';
import { Layers } from 'lucide-react';
import type {
  SubscriptionPlan,
  SubscriptionFeature,
  SubscriptionCart,
  SubscriptionPricingConfig,
  SubscriptionCartSummary,
  SubscriptionInvoice,
  SubscriptionWhatsAppRequestConfig
} from '../models/subscriptionModels';
import {
  getSubscriptionPlans,
  getSubscriptionFeatures,
  getSubscriptionPricingConfig,
  getSubscriptionRequestConfig
} from '../repositories/subscriptionRepository';
import {
  createCart,
  addPlanToCart,
  addFeatureToCart,
  removeCartItem,
  updateCartItemQuantity,
  clearCart,
  calculateCartSummary
} from '../services/subscriptionCartService';
import { createInvoicePreview, type VendorContext } from '../services/subscriptionInvoiceService';
import PlanCard from '../components/PlanCard';
import FeatureCard from '../components/FeatureCard';
import SubscriptionCartPanel from '../components/SubscriptionCart';
import SubscriptionInvoicePreview from '../components/SubscriptionInvoicePreview';
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
  const [features, setFeatures] = useState<SubscriptionFeature[]>([]);
  const [pricingConfig, setPricingConfig] = useState<SubscriptionPricingConfig>({ currency: 'USD', taxRate: 0, taxLabel: 'Tax' });
  const [requestConfig, setRequestConfig] = useState<SubscriptionWhatsAppRequestConfig>({ currency: 'USD', taxRate: 0, whatsappPhone: '', fallback: true });
  const [cart, setCart] = useState<SubscriptionCart>({ vendorId: '', items: [], currency: 'USD' });
  const [invoice, setInvoice] = useState<SubscriptionInvoice | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    const vendorId = vendorAuth?.vendorId || 'demo-vendor';
    void Promise.all([
      getSubscriptionPlans(),
      getSubscriptionFeatures(),
      getSubscriptionPricingConfig(),
      getSubscriptionRequestConfig()
    ]).then(([planResult, featureResult, configResult, requestResult]) => {
      if (!active) return;
      setPlans(planResult);
      setFeatures(featureResult);
      setPricingConfig(configResult);
      setRequestConfig(requestResult);
      setCart(createCart(vendorId, configResult.currency));
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [vendorAuth?.vendorId]);

  const summary: SubscriptionCartSummary = useMemo(
    () => calculateCartSummary(cart, pricingConfig),
    [cart, pricingConfig]
  );

  const selectedPlan = cart.items.find((item) => item.type === 'PLAN')?.name ?? null;
  const anyDemoPrice = plans.some((plan) => plan.priceSource === 'demo-fallback');

  const handleSelectPlan = (plan: SubscriptionPlan) => {
    setCart((current) => addPlanToCart(current, plan));
    setInvoice(null);
  };

  const handleAddFeature = (feature: SubscriptionFeature) => {
    setCart((current) => addFeatureToCart(current, feature));
    setInvoice(null);
  };

  const handleRemoveItem = (itemId: string) => {
    setCart((current) => removeCartItem(current, itemId));
    setInvoice(null);
  };

  const handleUpdateQuantity = (itemId: string, quantity: number) => {
    setCart((current) => updateCartItemQuantity(current, itemId, quantity));
    setInvoice(null);
  };

  const handleClear = () => {
    setCart((current) => clearCart(current));
    setInvoice(null);
  };

  const handleCheckout = () => {
    if (!cart.items.some((item) => item.type === 'PLAN')) {
      setCheckoutError('Select a plan before checkout. Features alone cannot be checked out.');
      setInvoice(null);
      return;
    }
    setCheckoutError(null);

    const vendorContext: VendorContext = {
      vendorName:
        businessProfile?.legalName ||
        businessProfile?.tradingName ||
        businessProfile?.businessName ||
        'Demo Vendor',
      vendorId: vendorAuth?.vendorId || businessProfile?.vendorId || 'demo-vendor',
      currentPlan: planAccess?.planCode || vendorAuth?.planCode || 'Unknown'
    };

    const preview = createInvoicePreview(cart, summary, vendorContext, requestConfig);
    setInvoice(preview);
    if (onToast) onToast('Invoice preview generated. Request activation via WhatsApp.');
  };

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
        <>
          <section className="space-y-2">
            <h3 className="text-[10px] font-black uppercase text-slate-300 tracking-wider">Plans</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {plans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  selected={cart.items.some((item) => item.type === 'PLAN' && item.refId === plan.id)}
                  onSelect={handleSelectPlan}
                />
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-[10px] font-black uppercase text-slate-300 tracking-wider">Add-on Features</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {features.map((feature) => (
                <FeatureCard key={feature.id} feature={feature} onAdd={handleAddFeature} />
              ))}
            </div>
          </section>

          {selectedPlan && (
            <div className="border border-orange-300 bg-orange-50 p-2 text-[10px] font-bold uppercase text-orange-800">
              Selected plan: {selectedPlan}
            </div>
          )}

          <SubscriptionCartPanel
            cart={cart}
            pricingConfig={pricingConfig}
            summary={summary}
            onRemoveItem={handleRemoveItem}
            onUpdateQuantity={handleUpdateQuantity}
            onClear={handleClear}
          />

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCheckout}
              className="bg-orange-600 hover:bg-orange-700 text-white font-black text-xs uppercase px-6 py-3 border border-orange-500 flex items-center gap-2 cursor-pointer"
            >
              Checkout
            </button>
            {checkoutError && (
              <span className="text-[10px] font-bold uppercase text-rose-600">{checkoutError}</span>
            )}
          </div>

          {invoice && (
            <SubscriptionInvoicePreview invoice={invoice} config={requestConfig} />
          )}
        </>
      )}

      <LicenseActivationCard
        businessProfile={businessProfile}
        vendorAuth={vendorAuth}
        onToast={onToast}
      />
    </div>
  );
}
