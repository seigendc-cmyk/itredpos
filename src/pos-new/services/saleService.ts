import { Sale, HeldTransaction, CartItem } from '../types/posTypes';
import { mockHeldTransactions, mockRecentSales } from '../mock/mockPosData';

export const saleService = {
  getHeldTransactions: async (): Promise<HeldTransaction[]> => {
    return mockHeldTransactions;
  },

  getRecentSales: async (): Promise<Sale[]> => {
    return mockRecentSales;
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
    mockHeldTransactions.push(nextHeld);
    return nextHeld;
  },

  completeSale: async (saleDraft: Omit<Sale, 'id' | 'date' | 'invoiceNo'>): Promise<Sale> => {
    const freshSale: Sale = {
      ...saleDraft,
      id: `TXN-${Math.floor(10000 + Math.random() * 90000)}`,
      invoiceNo: `INV-${Math.floor(100000 + Math.random() * 900000)}`,
      date: new Date().toISOString()
    };
    mockRecentSales.push(freshSale);
    return freshSale;
  }
};
