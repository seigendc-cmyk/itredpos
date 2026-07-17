import type { CanonicalSaleLineInput, CanonicalSalesPaymentMethod } from './salesTypes';
export interface SalesCommandScope { vendorId: string; branchId: string; terminalId: string; operatorId: string; actorRole: string; requestId: string; idempotencyKey: string; occurredAt: string; currency: string; }
export interface CreateSaleCommand extends SalesCommandScope { customerId?: string; lines: CanonicalSaleLineInput[]; orderDiscountMinor?: number; payment?: { method: CanonicalSalesPaymentMethod; amountMinor: number; currency: string; reference?: string }; metadata?: Record<string, unknown>; }
export interface PostSaleCommand extends SalesCommandScope { saleId: string; }
export interface RecordSalePaymentCommand extends SalesCommandScope { saleId: string; amountMinor: number; method: CanonicalSalesPaymentMethod; reference?: string; }
export interface HoldSaleCommand extends SalesCommandScope { lines: CanonicalSaleLineInput[]; customerId?: string; notes?: string; }
export interface ResumeHeldSaleCommand extends SalesCommandScope { heldSaleId: string; }
export interface ReturnSaleCommand extends SalesCommandScope { originalSaleId: string; reason: string; lines: Array<{ saleLineId: string; quantity: number }>; }
export interface RefundSaleCommand extends SalesCommandScope { originalSaleId: string; returnId: string; amountMinor: number; method: CanonicalSalesPaymentMethod; reason: string; }
export interface IssueCustomerCreditNoteCommand extends SalesCommandScope { originalSaleId: string; customerId: string; amountMinor: number; reason: string; }
export interface ReverseCustomerPaymentCommand extends SalesCommandScope { originalPaymentId: string; reason: string; }
