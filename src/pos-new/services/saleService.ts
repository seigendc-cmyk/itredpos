import { Sale, HeldTransaction, CartItem } from '../types/posTypes';
import { mockHeldTransactions, mockRecentSales } from '../mock/mockPosData';
import type { CommerceOperationContext } from '../../commerce-integration';
import { readVendorScopedList, writeVendorScopedList } from '../utils/vendorDataMode';

const HELD_SALES_KEY = 'itred_pos_held_transactions_v1';
const RECENT_SALES_KEY = 'itred_pos_transactions';

export const saleService = {
  getHeldTransactions: async (): Promise<HeldTransaction[]> => {
    return readVendorScopedList<HeldTransaction>(HELD_SALES_KEY, mockHeldTransactions);
  },

  getRecentSales: async (): Promise<Sale[]> => {
    return readVendorScopedList<Sale>(RECENT_SALES_KEY, mockRecentSales);
  },

  holdTransaction: async (items: CartItem[], notes?: string): Promise<HeldTransaction> => {
    const total = items.reduce((acc, current) => {
      const discountPct = current.discount || 0;
      const sub = current.product.price * current.quantity;
      const disc = sub * (discountPct / 100);
      return acc + (sub - disc);
    }, 0);

    const nextHeld: HeldTransaction = {
      id: `HELD-${Math.floor(100 + Math.random() * 900)}`,
      date: new Date().toISOString(),
      notes,
      items,
      total
    };
    writeVendorScopedList(HELD_SALES_KEY, [nextHeld, ...readVendorScopedList<HeldTransaction>(HELD_SALES_KEY, mockHeldTransactions)]);
    return nextHeld;
  },

  completeSale: async (
    saleDraft: Omit<Sale, 'id' | 'date' | 'invoiceNo'>,
    context?: CommerceOperationContext
  ): Promise<Sale> => {
    void saleDraft;
    void context;
    throw new Error('Legacy saleService.completeSale is disabled. Use canonicalSalesTransactionService.completeCheckout.');
  }
};
