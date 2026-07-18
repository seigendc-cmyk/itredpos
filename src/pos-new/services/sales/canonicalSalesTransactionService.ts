import type { CompleteSaleInput, CompleteSaleResult, SaleReturnInput, PosCashMovementRecord } from '../salesCheckoutService';
import { executeCanonicalCheckoutPipeline } from '../salesCheckoutService';
import type { InventoryMovementRecord } from '../inventorySyncService';
import type { HoldSaleCommand, IssueCustomerCreditNoteCommand, RefundSaleCommand, ResumeHeldSaleCommand, ReverseCustomerPaymentCommand } from '../../domain/sales/salesCommands';
import { assertSalesScope } from '../../domain/sales/salesAssertions';
import { CanonicalSalesError } from '../../domain/sales/salesErrors';
import { postCanonicalSaleAtomic, type AtomicSalePostingResult } from '../../repositories/firestore/FirestoreSalesTransactionRepository';
import type { CheckoutPaymentMethod, PosPaymentRecord, PosSaleHeader, PosSaleLine } from '../salesCheckoutService';

const inFlight = new Map<string, Promise<unknown>>();
function once<T>(key: string, operation: () => Promise<T>): Promise<T> { const active = inFlight.get(key) as Promise<T> | undefined; if (active) return active; const pending = operation().finally(() => inFlight.delete(key)); inFlight.set(key, pending); return pending; }

export interface CanonicalSalesTransactionService {
  completeCheckout(input: CompleteSaleInput): Promise<CompleteSaleResult>;
  returnCheckoutSale(input: SaleReturnInput): Promise<{ returnId: string; restoredMovements: InventoryMovementRecord[]; cashRefund?: PosCashMovementRecord }>;
  holdSale(command: HoldSaleCommand): Promise<never>;
  resumeHeldSale(command: ResumeHeldSaleCommand): Promise<never>;
  refundSale(command: RefundSaleCommand): Promise<never>;
  issueCustomerCreditNote(command: IssueCustomerCreditNoteCommand): Promise<never>;
  reverseCustomerPayment(command: ReverseCustomerPaymentCommand): Promise<never>;
  migrateCompletedSale(input: CanonicalHistoricalSaleMigrationInput): Promise<AtomicSalePostingResult>;
}

export interface CanonicalHistoricalSaleMigrationInput {
  vendorId: string;
  branchId: string;
  warehouseId: string;
  terminalId: string;
  operatorId: string;
  operatorName: string;
  actorRole: string;
  requestId: string;
  destinationSaleId: string;
  legacySaleNumber: string;
  occurredAt: string;
  currency: string;
  customerId?: string;
  customerName?: string;
  lines: Array<{
    productId: string;
    sku: string;
    productName: string;
    quantity: number;
    unitPriceMinor: number;
    unitCostMinor: number;
    discountMinor: number;
    taxableMinor: number;
    vatMinor: number;
    lineTotalMinor: number;
    vatRate: number;
    isInventoryAsset: boolean;
  }>;
  payments: Array<{ method: CheckoutPaymentMethod; amountMinor: number; reference?: string }>;
  migration: { migrationRunId: string; sourceFingerprint: string; legacyRecordId: string; migrationVersion: string };
}

const unsupported = (operation: string): never => { throw new CanonicalSalesError('SALES_UNSUPPORTED_OPERATION', `${operation} is not yet a supported authoritative mutation. Use the canonical sales workflow.`); };

class DefaultCanonicalSalesTransactionService implements CanonicalSalesTransactionService {
  completeCheckout(input: CompleteSaleInput): Promise<CompleteSaleResult> {
    const session = input.session; if (!session?.vendorId || !session.branchId || !session.terminalId || !session.staffId) throw new CanonicalSalesError('SALES_CONTEXT_INVALID', 'Explicit vendor, branch, terminal and operator scope is required.');
    const requestId = input.idempotencyKey?.trim(); if (!requestId) throw new CanonicalSalesError('SALES_CONTEXT_INVALID', 'Checkout requires a stable idempotency key.');
    return once(`complete:${session.vendorId}:${session.branchId}:${requestId}`, () => executeCanonicalCheckoutPipeline(input));
  }
  async returnCheckoutSale(input: SaleReturnInput): Promise<never> { const session = input.session; if (!session?.vendorId || !session.branchId || !session.terminalId || !session.staffId) throw new CanonicalSalesError('SALES_CONTEXT_INVALID', 'Explicit return scope is required.'); return unsupported('Sale return'); }
  async holdSale(command: HoldSaleCommand): Promise<never> { assertSalesScope(command); return unsupported('Held-sale mutation'); }
  async resumeHeldSale(command: ResumeHeldSaleCommand): Promise<never> { assertSalesScope(command); return unsupported('Held-sale resume mutation'); }
  async refundSale(command: RefundSaleCommand): Promise<never> { assertSalesScope(command); return unsupported('Standalone refund'); }
  async issueCustomerCreditNote(command: IssueCustomerCreditNoteCommand): Promise<never> { assertSalesScope(command); return unsupported('Customer credit note'); }
  async reverseCustomerPayment(command: ReverseCustomerPaymentCommand): Promise<never> { assertSalesScope(command); return unsupported('Customer payment reversal'); }
  async migrateCompletedSale(input: CanonicalHistoricalSaleMigrationInput): Promise<AtomicSalePostingResult> {
    if (!input.vendorId || !input.branchId || !input.warehouseId || !input.terminalId || !input.operatorId || !input.requestId) {
      throw new CanonicalSalesError('SALES_CONTEXT_INVALID', 'Historical sale migration requires explicit canonical scope and request identity.');
    }
    if (!input.lines.length || input.lines.some(line => !line.productId || !Number.isFinite(line.quantity) || line.quantity <= 0)) {
      throw new CanonicalSalesError('SALES_VALIDATION_FAILED', 'Historical sale migration requires valid positive sale lines.');
    }
    const moneyFields = input.lines.flatMap(line => [line.unitPriceMinor, line.unitCostMinor, line.discountMinor, line.taxableMinor, line.vatMinor, line.lineTotalMinor]);
    if (moneyFields.some(value => !Number.isSafeInteger(value) || value < 0)) {
      throw new CanonicalSalesError('SALES_VALIDATION_FAILED', 'Historical sale money must use non-negative integer minor units.');
    }
    const lineTotalMinor = input.lines.reduce((sum, line) => sum + line.lineTotalMinor, 0);
    const paidMinor = input.payments.reduce((sum, payment) => sum + payment.amountMinor, 0);
    if (input.payments.some(payment => !Number.isSafeInteger(payment.amountMinor) || payment.amountMinor <= 0) || paidMinor > lineTotalMinor) {
      throw new CanonicalSalesError('SALES_PAYMENT_INVALID', 'Historical sale payments are invalid.');
    }
    const amount = (minor: number) => minor / 100;
    const customerId = input.customerId || 'WALK-IN';
    const sale: PosSaleHeader = {
      saleId: input.destinationSaleId, saleNumber: input.legacySaleNumber, receiptNumber: input.legacySaleNumber,
      vendorId: input.vendorId, branchId: input.branchId, warehouseId: input.warehouseId, terminalId: input.terminalId,
      staffId: input.operatorId, staffName: input.operatorName || input.operatorId, customerId,
      customerName: input.customerName || 'Walk-In Customer', saleDate: input.occurredAt,
      subtotal: amount(input.lines.reduce((sum, line) => sum + (line.unitPriceMinor * line.quantity), 0)),
      discountTotal: amount(input.lines.reduce((sum, line) => sum + line.discountMinor, 0)),
      taxableAmount: amount(input.lines.reduce((sum, line) => sum + line.taxableMinor, 0)),
      vatTotal: amount(input.lines.reduce((sum, line) => sum + line.vatMinor, 0)), grandTotal: amount(lineTotalMinor),
      amountPaid: amount(paidMinor), balanceDue: amount(lineTotalMinor - paidMinor),
      paymentStatus: paidMinor === lineTotalMinor ? 'Paid' : paidMinor > 0 ? 'Partially Paid' : 'Credit',
      saleStatus: 'Completed', postingStatus: 'Completed', source: 'POS', createdAt: input.occurredAt,
      updatedAt: input.occurredAt, notes: `Migrated from ${input.migration.legacyRecordId}`
    };
    const lines: PosSaleLine[] = input.lines.map((line, index) => ({
      saleLineId: `${input.destinationSaleId}_${index + 1}_${line.productId}`.replace(/[^A-Za-z0-9_-]/g, '_'),
      saleId: input.destinationSaleId, vendorId: input.vendorId, branchId: input.branchId, warehouseId: input.warehouseId,
      productId: line.productId, sku: line.sku, productName: line.productName, quantity: line.quantity,
      unitPrice: amount(line.unitPriceMinor), unitCost: amount(line.unitCostMinor), discountAmount: amount(line.discountMinor),
      taxableAmount: amount(line.taxableMinor), vatRate: line.vatRate, vatAmount: amount(line.vatMinor),
      lineTotal: amount(line.lineTotalMinor), isInventoryAsset: line.isInventoryAsset
    }));
    const payments: PosPaymentRecord[] = input.payments.map((payment, index) => ({
      paymentId: `${input.destinationSaleId}_payment_${index + 1}`, saleId: input.destinationSaleId,
      vendorId: input.vendorId, branchId: input.branchId, terminalId: input.terminalId, staffId: input.operatorId,
      paymentMethod: payment.method, amount: amount(payment.amountMinor), reference: payment.reference, receivedAt: input.occurredAt
    }));
    return postCanonicalSaleAtomic({
      sale, lines, payments, requestId: input.requestId, currency: input.currency,
      customerCreditAmount: amount(lineTotalMinor - paidMinor), migration: input.migration
    });
  }
}

export const canonicalSalesTransactionService: CanonicalSalesTransactionService = new DefaultCanonicalSalesTransactionService();
