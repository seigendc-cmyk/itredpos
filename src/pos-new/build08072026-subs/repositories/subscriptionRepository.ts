import type { SubscriptionPlan } from '../models/subscriptionModels';

/**
 * Industrial default subscription plan records.
 *
 * Prices here are FALLBACK / DEMO data only (priceSource: 'demo-fallback').
 * When the Backend Console pricing service is available, getSubscriptionPlans()
 * should override priceMonthlyUsd from backend data and set priceSource to 'backend'.
 * UI components must NEVER hardcode prices — they render plan.priceMonthlyUsd.
 */
export const DEFAULT_SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'plan-trial',
    code: 'TRIAL',
    name: 'Trial',
    tagline: 'Explore core POS operations before you commit.',
    currency: 'USD',
    priceMonthlyUsd: 0,
    priceSource: 'demo-fallback',
    durationDays: 14,
    limits: {
      products: 500,
      branches: 1,
      warehouses: 1,
      terminals: 1,
      staff: 2
    },
    features: [
      'Basic sales',
      'Basic inventory',
      'Basic customers',
      'Basic receipts',
      'Basic dashboard'
    ]
  },
  {
    id: 'plan-starter',
    code: 'STARTER',
    name: 'Starter',
    tagline: 'Run a single location with solid day-to-day control.',
    currency: 'USD',
    priceMonthlyUsd: 19,
    priceSource: 'demo-fallback',
    limits: {
      products: 1200,
      branches: 1,
      warehouses: 2,
      terminals: 2,
      staff: 5
    },
    features: [
      'Sales',
      'Inventory',
      'Customers',
      'Suppliers',
      'Purchase orders',
      'Cash management',
      'Basic BI',
      'Receipt configuration',
      'Optional add-ons supported'
    ]
  },
  {
    id: 'plan-growth',
    code: 'GROWTH',
    name: 'Growth',
    tagline: 'Scale across branches and warehouses with discipline.',
    currency: 'USD',
    priceMonthlyUsd: 49,
    priceSource: 'demo-fallback',
    popular: true,
    limits: {
      products: 3000,
      branches: 5,
      warehouses: 10,
      terminals: 10,
      staff: 30
    },
    features: [
      'Advanced BI',
      'Multi-branch inventory',
      'Stock transfers',
      'Purchasing discipline',
      'Creditors',
      'Debtors-ready',
      'Approvals',
      'Shift management',
      'Cash discipline',
      'Delivery module-ready',
      'WhatsApp integration-ready',
      'Marketplace-ready'
    ]
  },
  {
    id: 'plan-enterprise',
    code: 'ENTERPRISE',
    name: 'Enterprise',
    tagline: 'Group-wide control, integrations, and premium support.',
    currency: 'USD',
    priceMonthlyUsd: null,
    priceSource: 'demo-fallback',
    limits: {
      products: 'Unlimited',
      branches: 'Unlimited',
      warehouses: 'Unlimited',
      terminals: 'Unlimited',
      staff: 'Unlimited'
    },
    features: [
      'Executive BI',
      'Audit centre',
      'API access-ready',
      'Custom integrations-ready',
      'AI decision engine-ready',
      'Predictive inventory-ready',
      'Multi-company-ready',
      'Central procurement-ready',
      'Head office controls',
      'Disaster recovery-ready',
      'Premium support'
    ]
  }
];

/**
 * Returns the active subscription plan catalogue.
 * Repository-ready: when Backend Console pricing exists, fetch and merge
 * priceMonthlyUsd (priceSource: 'backend') here without touching UI components.
 */
export async function getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  return DEFAULT_SUBSCRIPTION_PLANS.map((plan) => ({ ...plan, limits: { ...plan.limits } }));
}

export async function getSubscriptionCart(vendorId: string): Promise<{ vendorId: string; lines: never[]; currency: string } | null> {
  return null;
}

export async function saveSubscriptionCart(cart: { vendorId: string; lines: never[]; currency: string }): Promise<void> {
  return;
}

export async function getLicenseActivation(vendorId: string): Promise<null> {
  return null;
}
