import type {
  SubscriptionPlan,
  SubscriptionFeature,
  SubscriptionPricingConfig,
  SubscriptionCart,
  SubscriptionWhatsAppRequestConfig
} from '../models/subscriptionModels';

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
    limits: { products: 500, branches: 1, warehouses: 1, terminals: 1, staff: 2 },
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
    limits: { products: 1200, branches: 1, warehouses: 2, terminals: 2, staff: 5 },
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
    limits: { products: 3000, branches: 5, warehouses: 10, terminals: 10, staff: 30 },
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
 * Fallback add-on features. Prices are demo/fallback only and live in the
 * repository — never hardcoded in UI components.
 */
export const DEFAULT_SUBSCRIPTION_FEATURES: SubscriptionFeature[] = [
  { id: 'feat-extra-terminal', code: 'EXTRA_TERMINAL', name: 'Extra Terminal', description: 'Add one additional POS terminal licence.', priceMonthlyUsd: 5, priceSource: 'demo-fallback', type: 'FEATURE', category: 'Hardware' },
  { id: 'feat-extra-warehouse', code: 'EXTRA_WAREHOUSE', name: 'Extra Warehouse', description: 'Provision an additional warehouse entry point (independent of branches).', priceMonthlyUsd: 8, priceSource: 'demo-fallback', type: 'FEATURE', category: 'Inventory' },
  { id: 'feat-extra-staff-pack', code: 'EXTRA_STAFF_PACK', name: 'Extra Staff Pack', description: 'Add a pack of extra staff user seats.', priceMonthlyUsd: 6, priceSource: 'demo-fallback', type: 'FEATURE', category: 'Staff' },
  { id: 'feat-delivery-module', code: 'DELIVERY_MODULE', name: 'Delivery Module', description: 'Enable the delivery and dispatch module.', priceMonthlyUsd: 15, priceSource: 'demo-fallback', type: 'FEATURE', category: 'Operations' },
  { id: 'feat-marketing-module', code: 'MARKETING_MODULE', name: 'Marketing Module', description: 'Campaigns, promotions and customer outreach.', priceMonthlyUsd: 12, priceSource: 'demo-fallback', type: 'FEATURE', category: 'Growth' },
  { id: 'feat-whatsapp-automation', code: 'WHATSAPP_AUTOMATION', name: 'WhatsApp Automation', description: 'Automated WhatsApp notifications and reminders.', priceMonthlyUsd: 10, priceSource: 'demo-fallback', type: 'FEATURE', category: 'Comms' },
  { id: 'feat-inventory-ai', code: 'INVENTORY_AI', name: 'Inventory AI', description: 'AI-assisted stock forecasting and reordering.', priceMonthlyUsd: 20, priceSource: 'demo-fallback', type: 'FEATURE', category: 'AI' },
  { id: 'feat-executive-bi', code: 'EXECUTIVE_BI', name: 'Executive BI', description: 'Executive dashboards and board reporting.', priceMonthlyUsd: 25, priceSource: 'demo-fallback', type: 'FEATURE', category: 'BI' },
  { id: 'feat-extra-storage', code: 'EXTRA_STORAGE', name: 'Extra Storage', description: 'Additional product catalogue and document storage.', priceMonthlyUsd: 4, priceSource: 'demo-fallback', type: 'FEATURE', category: 'Storage' },
  { id: 'feat-priority-support', code: 'PRIORITY_SUPPORT', name: 'Priority Support', description: 'Priority response and dedicated support.', priceMonthlyUsd: 9, priceSource: 'demo-fallback', type: 'FEATURE', category: 'Support' }
];

export const DEFAULT_PRICING_CONFIG: SubscriptionPricingConfig = {
  currency: 'USD',
  taxRate: 0,
  taxLabel: 'Tax (placeholder 0%)'
};

export const DEFAULT_REQUEST_CONFIG: SubscriptionWhatsAppRequestConfig = {
  currency: 'USD',
  taxRate: DEFAULT_PRICING_CONFIG.taxRate,
  whatsappPhone: '27820000000',
  fallback: true
};

/**
 * Returns the active subscription plan catalogue.
 * Repository-ready: when Backend Console pricing exists, fetch and merge
 * priceMonthlyUsd (priceSource: 'backend') here without touching UI components.
 */
export async function getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  return DEFAULT_SUBSCRIPTION_PLANS.map((plan) => ({ ...plan, limits: { ...plan.limits } }));
}

export async function getSubscriptionFeatures(): Promise<SubscriptionFeature[]> {
  return DEFAULT_SUBSCRIPTION_FEATURES.map((feature) => ({ ...feature }));
}

export async function getSubscriptionPricingConfig(): Promise<SubscriptionPricingConfig> {
  return { ...DEFAULT_PRICING_CONFIG };
}

export async function getSubscriptionRequestConfig(): Promise<SubscriptionWhatsAppRequestConfig> {
  return { ...DEFAULT_REQUEST_CONFIG };
}

export async function getSubscriptionCart(vendorId: string): Promise<SubscriptionCart> {
  return { vendorId, items: [], currency: DEFAULT_PRICING_CONFIG.currency };
}

export async function saveSubscriptionCart(cart: SubscriptionCart): Promise<void> {
  return;
}
