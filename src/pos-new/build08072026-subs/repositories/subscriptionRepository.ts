import type { SubscriptionPlan, SubscriptionCart, LicenseActivation } from '../models/subscriptionModels';

export async function getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  return [];
}

export async function getSubscriptionCart(vendorId: string): Promise<SubscriptionCart | null> {
  return null;
}

export async function saveSubscriptionCart(cart: SubscriptionCart): Promise<void> {
  return;
}

export async function getLicenseActivation(vendorId: string): Promise<LicenseActivation | null> {
  return null;
}
