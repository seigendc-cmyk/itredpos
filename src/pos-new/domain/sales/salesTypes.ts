export type CanonicalSaleStatus = 'Draft' | 'Held' | 'Posted' | 'Voided' | 'PartiallyReturned' | 'Returned';
export type CanonicalSalesPaymentMethod = 'Cash' | 'Card' | 'Mobile Money' | 'Bank Transfer' | 'Credit' | 'Other';
export interface CanonicalSaleLineInput { lineId: string; productId: string; quantity: number; unitPriceMinor: number; discountMinor?: number; taxRateBasisPoints?: number; stockControlled?: boolean; }
export interface CanonicalSaleTotals { subtotalMinor: number; discountMinor: number; taxableMinor: number; taxMinor: number; grossMinor: number; netMinor: number; amountPaidMinor: number; amountDueMinor: number; changeDueMinor: number; }
export interface CanonicalSalesReferences { saleId: string; saleLineIds: string[]; paymentIds: string[]; inventoryMovementIds: string[]; customerLedgerEntryId?: string; customerBalanceProjectionId?: string; mutationReceiptId: string; auditEventId: string; biEventId: string; }
export interface CanonicalSalesResult { status: 'completed'; requestId: string; references: CanonicalSalesReferences; totals: CanonicalSaleTotals; }
