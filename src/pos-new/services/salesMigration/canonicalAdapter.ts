import type { CheckoutPaymentMethod } from '../salesCheckoutService';
import type { CanonicalHistoricalSaleMigrationInput, CanonicalSalesTransactionService } from '../sales/canonicalSalesTransactionService';
import { salesMigrationDestinationId } from './fingerprint';
import type { SalesMigrationCanonicalReferences, SalesMigrationRecord } from './types';

export class SalesMigrationTranslationError extends Error {
  constructor(public readonly code: 'SCOPE_MISMATCH' | 'UNSUPPORTED_STATUS' | 'INVALID_DATA', message: string) { super(message); this.name = 'SalesMigrationTranslationError'; }
}
const text = (value: unknown, fallback = '') => String(value ?? '').trim() || fallback;
const minor = (value: unknown, field: string) => { const amount = Number(value); if (!Number.isFinite(amount) || amount < 0) throw new SalesMigrationTranslationError('INVALID_DATA', `${field} must be finite and non-negative.`); return Math.round(amount * 100); };
const paymentMethod = (value: unknown): CheckoutPaymentMethod => {
  const method = text(value).toUpperCase();
  if (method === 'CASH') return 'Cash'; if (['CARD', 'NFC', 'SWIPE'].includes(method)) return 'Card';
  if (['MOBILE MONEY', 'ECOCASH'].includes(method)) return 'Mobile Money'; if (['BANK', 'BANK TRANSFER'].includes(method)) return 'Bank Transfer';
  if (method === 'CREDIT') return 'Credit'; return 'Other';
};

export function translateLegacySaleToCanonical(input: {
  record: SalesMigrationRecord;
  migrationRunId: string;
  migrationVersion: string;
  warehouseId: string;
  terminalId: string;
  actorId: string;
  actorRole: string;
}): CanonicalHistoricalSaleMigrationInput {
  const { record } = input; const payload = structuredClone(record.payload);
  if (payload.vendorId && payload.vendorId !== record.vendorId) throw new SalesMigrationTranslationError('SCOPE_MISMATCH', 'Legacy sale vendor does not match migration scope.');
  if (payload.branchId && payload.branchId !== record.branchId) throw new SalesMigrationTranslationError('SCOPE_MISMATCH', 'Legacy sale branch does not match migration scope.');
  if (text(payload.status).toUpperCase() !== 'COMPLETED') throw new SalesMigrationTranslationError('UNSUPPORTED_STATUS', 'Only completed legacy sales may be migrated.');
  if (!Array.isArray(payload.items) || !payload.items.length) throw new SalesMigrationTranslationError('INVALID_DATA', 'Legacy sale items are required.');
  const subtotalMinor = minor(payload.subtotal, 'subtotal'), discountMinor = minor(payload.discount || 0, 'discount'), taxMinor = minor(payload.tax || 0, 'tax');
  const taxableTotal = subtotalMinor - discountMinor;
  if (taxableTotal < 0) throw new SalesMigrationTranslationError('INVALID_DATA', 'Discount cannot exceed subtotal.');
  const rows = payload.items as Array<Record<string, unknown>>; let allocatedDiscount = 0; let allocatedTax = 0;
  const lines = rows.map((row, index) => {
    const quantity = Number(row.quantity), unitPriceMinor = minor(row.price, `items[${index}].price`);
    if (!Number.isFinite(quantity) || quantity <= 0) throw new SalesMigrationTranslationError('INVALID_DATA', `items[${index}].quantity must be positive.`);
    const grossMinor = Math.round(unitPriceMinor * quantity);
    const lineDiscount = index === rows.length - 1 ? discountMinor - allocatedDiscount : Math.round(discountMinor * (grossMinor / Math.max(1, subtotalMinor)));
    const taxableMinor = grossMinor - lineDiscount;
    const vatMinor = index === rows.length - 1 ? taxMinor - allocatedTax : Math.round(taxMinor * (taxableMinor / Math.max(1, taxableTotal)));
    allocatedDiscount += lineDiscount; allocatedTax += vatMinor;
    return { productId: text(row.productId), sku: text(row.code, text(row.productId)), productName: text(row.name, text(row.productId)), quantity,
      unitPriceMinor, unitCostMinor: minor(row.unitCost ?? row.costPrice ?? 0, `items[${index}].unitCost`), discountMinor: lineDiscount,
      taxableMinor, vatMinor, lineTotalMinor: taxableMinor + vatMinor, vatRate: taxableMinor ? Number(((vatMinor / taxableMinor) * 100).toFixed(4)) : 0,
      isInventoryAsset: row.isInventoryAsset !== false };
  });
  if (lines.some(line => !line.productId)) throw new SalesMigrationTranslationError('INVALID_DATA', 'Every legacy item requires a productId.');
  const grandMinor = lines.reduce((sum, line) => sum + line.lineTotalMinor, 0);
  if (grandMinor !== minor(payload.total, 'total')) throw new SalesMigrationTranslationError('INVALID_DATA', 'Legacy total does not reconcile to subtotal, discount and tax.');
  const method = paymentMethod(payload.paymentMethod); const payments = method === 'Credit' ? [] : [{ method, amountMinor: grandMinor, reference: text(payload.invoiceNo) }];
  const fingerprint = record.sourceFingerprint!;
  return { vendorId: record.vendorId, branchId: record.branchId, warehouseId: input.warehouseId, terminalId: input.terminalId,
    operatorId: input.actorId, operatorName: text(payload.operator, input.actorId), actorRole: input.actorRole,
    requestId: `sales:migration:${record.vendorId}:${record.legacyRecordId}:${fingerprint}`, destinationSaleId: salesMigrationDestinationId(record.vendorId, record.legacyRecordId),
    legacySaleNumber: text(payload.invoiceNo, record.legacyRecordId), occurredAt: text(payload.date), currency: text(payload.currency, 'USD').toUpperCase(),
    customerId: text(payload.customerId) || undefined, customerName: text(payload.customerName) || undefined, lines, payments,
    migration: { migrationRunId: input.migrationRunId, sourceFingerprint: fingerprint, legacyRecordId: record.legacyRecordId, migrationVersion: input.migrationVersion } };
}

export class CanonicalSalesMigrationAdapter {
  constructor(private readonly authority: Pick<CanonicalSalesTransactionService, 'migrateCompletedSale'>) {}
  async migrate(input: CanonicalHistoricalSaleMigrationInput): Promise<SalesMigrationCanonicalReferences> {
    const result = await this.authority.migrateCompletedSale(input);
    return { ...result, canonicalSaleId: result.saleId, mutationReceiptId: result.mutationReceiptId };
  }
}
