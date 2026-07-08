import type {
  SubscriptionCart,
  SubscriptionCartSummary,
  SubscriptionInvoice,
  SubscriptionInvoiceLine,
  SubscriptionWhatsAppRequestConfig
} from '../models/subscriptionModels';

export interface VendorContext {
  vendorName: string;
  vendorId: string;
  currentPlan: string;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function formatInvoiceDate(iso: string): string {
  const date = new Date(iso);
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

/**
 * Generates a local Billing Invoice Preview. No Firestore write, no token
 * consumption, no license activation in this step.
 */
export function createInvoicePreview(
  cart: SubscriptionCart,
  summary: SubscriptionCartSummary,
  vendorContext: VendorContext,
  config: SubscriptionWhatsAppRequestConfig
): SubscriptionInvoice {
  const now = new Date();
  const invoiceNumber = `SCI-INV-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

  const lines: SubscriptionInvoiceLine[] = cart.items.map((item) => ({
    refId: item.refId,
    name: item.name,
    type: item.type,
    quantity: item.quantity,
    unitPriceUsd: item.unitPriceUsd,
    lineSubtotalUsd: item.unitPriceUsd * item.quantity
  }));

  const requestedPlan = cart.items.find((item) => item.type === 'PLAN')?.name ?? 'None';

  return {
    invoiceNumber,
    invoiceDate: now.toISOString(),
    vendorName: vendorContext.vendorName,
    vendorId: vendorContext.vendorId,
    currentPlan: vendorContext.currentPlan,
    requestedPlan,
    currency: config.currency,
    lines,
    subtotalUsd: summary.subtotalUsd,
    taxRate: summary.taxRate,
    taxAmountUsd: summary.taxAmountUsd,
    grandTotalUsd: summary.grandTotalUsd,
    status: 'PENDING_TOKEN_REQUEST'
  };
}

function formatMoney(value: number, currency: string): string {
  return `${currency} ${value.toFixed(2)}`;
}

export function buildWhatsAppActivationRequestMessage(invoice: SubscriptionInvoice): string {
  const featureLines = invoice.lines
    .map((line) => `- ${line.name} x ${line.quantity} = ${formatMoney(line.lineSubtotalUsd, invoice.currency)}`)
    .join('\n');

  return [
    'SCI License Request',
    '',
    'Date:',
    formatInvoiceDate(invoice.invoiceDate),
    '',
    'Invoice:',
    invoice.invoiceNumber,
    '',
    'Vendor:',
    invoice.vendorName,
    '',
    'Vendor ID:',
    invoice.vendorId,
    '',
    'Current Plan:',
    invoice.currentPlan,
    '',
    'Requested Plan:',
    invoice.requestedPlan,
    '',
    'Requested Features:',
    featureLines,
    '',
    'Subtotal:',
    formatMoney(invoice.subtotalUsd, invoice.currency),
    '',
    'Tax:',
    formatMoney(invoice.taxAmountUsd, invoice.currency),
    '',
    'Grand Total:',
    formatMoney(invoice.grandTotalUsd, invoice.currency),
    '',
    'Please issue activation token.',
    '',
    'Thank you.'
  ].join('\n');
}

export function buildWhatsAppActivationRequestUrl(
  invoice: SubscriptionInvoice,
  config: SubscriptionWhatsAppRequestConfig
): string {
  const message = buildWhatsAppActivationRequestMessage(invoice);
  return `https://wa.me/${config.whatsappPhone}?text=${encodeURIComponent(message)}`;
}
