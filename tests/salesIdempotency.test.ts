import { describe, expect, test } from 'vitest'; import { canonicalSalesReceiptId, canonicalSaleId, canonicalSaleMovementId } from '../src/pos-new/domain/sales/salesIdentity';
describe('sales duplicate prevention identities', () => {
  test('same request resolves to the original sale and receipt identities', () => { expect(canonicalSaleId('vendor-a', 'branch-a', 'request-1')).toBe(canonicalSaleId('vendor-a', 'branch-a', 'request-1')); expect(canonicalSalesReceiptId('vendor-a', 'branch-a', 'complete', 'request-1')).toBe(canonicalSalesReceiptId('vendor-a', 'branch-a', 'complete', 'request-1')); });
  test('different request, vendor, branch and command identities cannot collide', () => { const base = canonicalSalesReceiptId('v1', 'b1', 'complete', 'r1'); expect(new Set([base, canonicalSalesReceiptId('v1', 'b1', 'complete', 'r2'), canonicalSalesReceiptId('v2', 'b1', 'complete', 'r1'), canonicalSalesReceiptId('v1', 'b2', 'complete', 'r1'), canonicalSalesReceiptId('v1', 'b1', 'return', 'r1')]).size).toBe(5); });
  test('inventory movement identity is stable per sale line', () => { expect(canonicalSaleMovementId('v', 's', 'l')).toBe(canonicalSaleMovementId('v', 's', 'l')); });
});
