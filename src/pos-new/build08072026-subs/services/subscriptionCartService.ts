import type { SubscriptionCart, SubscriptionCartLine, SubscriptionInvoice } from '../models/subscriptionModels';

export function buildCartLines(plans: Array<{ id: string; priceMonthlyUsd: number }>): SubscriptionCartLine[] {
  return plans.map((plan) => ({ planId: plan.id, quantity: 1, unitPriceUsd: plan.priceMonthlyUsd }));
}

export function calculateCartTotal(lines: SubscriptionCartLine[]): number {
  return lines.reduce((sum, line) => sum + line.unitPriceUsd * line.quantity, 0);
}

export function createCart(vendorId: string): SubscriptionCart {
  return { vendorId, lines: [], currency: 'USD' };
}

export function buildInvoice(vendorId: string, cart: SubscriptionCart): SubscriptionInvoice {
  return {
    invoiceId: `${vendorId}-${Date.now()}`,
    vendorId,
    lines: cart.lines,
    totalUsd: calculateCartTotal(cart.lines)
  };
}
