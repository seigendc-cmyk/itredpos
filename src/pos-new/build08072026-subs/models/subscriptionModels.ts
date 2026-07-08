export interface SubscriptionPlan {
  id: string;
  name: string;
  priceMonthlyUsd: number;
  features: string[];
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
