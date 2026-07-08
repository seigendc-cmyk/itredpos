import type {
  SubscriptionPlan,
  SubscriptionFeature,
  SubscriptionCart,
  SubscriptionCartItem,
  SubscriptionCartSummary,
  SubscriptionPricingConfig
} from '../models/subscriptionModels';

export function createCart(vendorId: string, currency = 'USD'): SubscriptionCart {
  return { vendorId, items: [], currency };
}

/** A vendor may hold only one main plan. Selecting a new plan replaces the old one. */
export function addPlanToCart(cart: SubscriptionCart, plan: SubscriptionPlan): SubscriptionCart {
  const withoutPlan = cart.items.filter((item) => item.type !== 'PLAN');
  const planItem: SubscriptionCartItem = {
    itemId: `plan-${plan.id}`,
    refId: plan.id,
    name: plan.name,
    type: 'PLAN',
    quantity: 1,
    unitPriceUsd: plan.priceMonthlyUsd ?? 0,
    priceSource: plan.priceSource
  };
  return { ...cart, items: [...withoutPlan, planItem] };
}

/** Features can be added repeatedly; adding the same feature increments its quantity. */
export function addFeatureToCart(cart: SubscriptionCart, feature: SubscriptionFeature): SubscriptionCart {
  if (feature.type !== 'FEATURE') return cart;
  const existing = cart.items.find((item) => item.refId === feature.id);
  if (existing) {
    return {
      ...cart,
      items: cart.items.map((item) =>
        item.refId === feature.id ? { ...item, quantity: item.quantity + 1 } : item
      )
    };
  }
  const featureItem: SubscriptionCartItem = {
    itemId: `feature-${feature.id}`,
    refId: feature.id,
    name: feature.name,
    type: 'FEATURE',
    quantity: 1,
    unitPriceUsd: feature.priceMonthlyUsd ?? 0,
    priceSource: feature.priceSource
  };
  return { ...cart, items: [...cart.items, featureItem] };
}

export function removeCartItem(cart: SubscriptionCart, itemId: string): SubscriptionCart {
  return { ...cart, items: cart.items.filter((item) => item.itemId !== itemId) };
}

export function updateCartItemQuantity(cart: SubscriptionCart, itemId: string, quantity: number): SubscriptionCart {
  if (quantity <= 0) {
    return removeCartItem(cart, itemId);
  }
  return {
    ...cart,
    items: cart.items.map((item) => (item.itemId === itemId ? { ...item, quantity } : item))
  };
}

export function clearCart(cart: SubscriptionCart): SubscriptionCart {
  return { ...cart, items: [] };
}

export function calculateCartSummary(cart: SubscriptionCart, pricingConfig: SubscriptionPricingConfig): SubscriptionCartSummary {
  const subtotalUsd = cart.items.reduce((sum, item) => sum + item.unitPriceUsd * item.quantity, 0);
  const taxAmountUsd = subtotalUsd * pricingConfig.taxRate;
  return {
    currency: pricingConfig.currency,
    subtotalUsd,
    taxRate: pricingConfig.taxRate,
    taxAmountUsd,
    grandTotalUsd: subtotalUsd + taxAmountUsd
  };
}
