export type LimitValue = number | 'Unlimited';

export type PriceSource = 'backend' | 'demo-fallback';

export type SubscriptionPlanCode = 'TRIAL' | 'STARTER' | 'GROWTH' | 'ENTERPRISE';

export type SubscriptionProductType = 'PLAN' | 'FEATURE';

export type SubscriptionInvoiceStatus = 'PENDING_TOKEN_REQUEST' | 'TOKEN_ISSUED' | 'ACTIVATED';

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
  code: string;
  name: string;
  description: string;
  /** Fallback/demo price only. Real prices must come from the Backend Console. */
  priceMonthlyUsd: number | null;
  priceSource: PriceSource;
  type: SubscriptionProductType;
  category?: string;
}

export interface SubscriptionCartItem {
  itemId: string;
  refId: string;
  name: string;
  type: SubscriptionProductType;
  quantity: number;
  unitPriceUsd: number;
  priceSource: PriceSource;
}

export interface SubscriptionCart {
  vendorId: string;
  items: SubscriptionCartItem[];
  currency: string;
}

export interface SubscriptionPricingConfig {
  currency: string;
  /** Placeholder tax rate. Real tax logic connects with the Backend Console. */
  taxRate: number;
  taxLabel: string;
}

export interface SubscriptionCartSummary {
  currency: string;
  subtotalUsd: number;
  taxRate: number;
  taxAmountUsd: number;
  grandTotalUsd: number;
}

export interface SubscriptionInvoiceLine {
  refId: string;
  name: string;
  type: SubscriptionProductType;
  quantity: number;
  unitPriceUsd: number;
  lineSubtotalUsd: number;
}

export interface SubscriptionInvoice {
  invoiceNumber: string;
  invoiceDate: string;
  vendorName: string;
  vendorId: string;
  currentPlan: string;
  requestedPlan: string;
  currency: string;
  lines: SubscriptionInvoiceLine[];
  subtotalUsd: number;
  taxRate: number;
  taxAmountUsd: number;
  grandTotalUsd: number;
  status: SubscriptionInvoiceStatus;
}

export interface SubscriptionWhatsAppRequestConfig {
  currency: string;
  taxRate: number;
  /** Fallback/demo WhatsApp number. Real number connects from the Backend Console. */
  whatsappPhone: string;
  fallback: boolean;
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
