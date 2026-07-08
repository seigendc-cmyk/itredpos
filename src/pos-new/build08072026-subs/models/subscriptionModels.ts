export type LimitValue = number | 'Unlimited';

export type PriceSource = 'backend' | 'demo-fallback';

export type SubscriptionPlanCode = 'TRIAL' | 'STARTER' | 'GROWTH' | 'ENTERPRISE';

export interface SubscriptionPlanLimits {
  products: LimitValue;
  branches: LimitValue;
  warehouses: LimitValue;
  terminals: LimitValue;
  staff: LimitValue;
}

export interface SubscriptionPlan {
  id: string;
  code: SubscriptionPlanCode;
  name: string;
  tagline: string;
  currency: string;
  /** Fallback/demo price only. Real prices must come from the Backend Console. null = contact sales. */
  priceMonthlyUsd: number | null;
  priceSource: PriceSource;
  durationDays?: number;
  limits: SubscriptionPlanLimits;
  features: string[];
  popular?: boolean;
}

export interface SubscriptionFeature {
  id: string;
  label: string;
  description: string;
}

export interface SubscriptionCartLine {
  planId: string;
  quantity: number;
  unitPriceUsd: number;
}

export interface SubscriptionCart {
  vendorId: string;
  lines: SubscriptionCartLine[];
  currency: string;
}

export interface SubscriptionInvoice {
  invoiceId: string;
  vendorId: string;
  lines: SubscriptionCartLine[];
  totalUsd: number;
}

export interface LicenseActivation {
  licenseKey: string;
  planId: string;
  activatedAt: string | null;
  status: 'pending' | 'active' | 'expired';
}

/** Warehouse rule: warehouses are inventory entry points independent of branch count. */
export function formatLimitValue(value: LimitValue): string {
  return value === 'Unlimited' ? 'Unlimited' : value.toLocaleString();
}
