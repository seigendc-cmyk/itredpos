import type { CompleteSaleInput, CompleteSaleResult, SaleReturnInput, PosCashMovementRecord } from '../salesCheckoutService';
import { executeCanonicalCheckoutPipeline } from '../salesCheckoutService';
import type { InventoryMovementRecord } from '../inventorySyncService';
import type { HoldSaleCommand, IssueCustomerCreditNoteCommand, RefundSaleCommand, ResumeHeldSaleCommand, ReverseCustomerPaymentCommand } from '../../domain/sales/salesCommands';
import { assertSalesScope } from '../../domain/sales/salesAssertions';
import { CanonicalSalesError } from '../../domain/sales/salesErrors';

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
}

export const canonicalSalesTransactionService: CanonicalSalesTransactionService = new DefaultCanonicalSalesTransactionService();
