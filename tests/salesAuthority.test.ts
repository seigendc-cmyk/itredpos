import { describe, expect, test } from 'vitest'; import { readFileSync } from 'node:fs'; import { resolve } from 'node:path';
import { assertSaleTransition } from '../src/pos-new/domain/sales/salesAssertions';
import { canonicalSalesTransactionService } from '../src/pos-new/services/sales/canonicalSalesTransactionService';
describe('canonical sales authority', () => {
  test('sales UI does not perform Firestore or inventory writes directly', () => { const ui = readFileSync(resolve('src/pos-new/pages/PosSales.tsx'), 'utf8'); expect(ui).not.toMatch(/\b(setDoc|updateDoc|writeBatch|consumeStockForSale|recordCustomerDebt)\s*\(/); expect(ui).toContain('completeSale('); });
  test('legacy checkout delegates to canonical authority', () => { const checkout = readFileSync(resolve('src/pos-new/services/salesCheckoutService.ts'), 'utf8'); expect(checkout).toContain("import('./sales/canonicalSalesTransactionService')"); expect(checkout).toContain('canonicalSalesTransactionService.completeCheckout(input)'); });
  test('obsolete saleService posting fails closed', () => { const legacy = readFileSync(resolve('src/pos-new/services/saleService.ts'), 'utf8'); expect(legacy).toContain('Legacy saleService.completeSale is disabled'); });
  test('posted sales cannot transition back to draft', () => { expect(() => assertSaleTransition('Posted', 'Draft')).toThrow('cannot transition'); });
  test('unsupported authoritative mutations fail closed', async () => { await expect(canonicalSalesTransactionService.issueCustomerCreditNote({} as never)).rejects.toThrow(); });
  test('held sale service does not post inventory, payments or debt', () => { const held = readFileSync(resolve('src/pos-new/services/salesService.ts'), 'utf8'); expect(held).not.toMatch(/consumeStockForSale|recordCustomerDebt|pos_payments/); });
});
