import { Sale, HeldTransaction, CartItem } from '../types/posTypes';
import { mockHeldTransactions, mockRecentSales } from '../mock/mockPosData';
import { publishCommerceEvent } from '../../commerce-integration/events/publishCommerceEvent';
import { writeAuditLog } from '../../commerce-integration/audit/writeAuditLog';

/**
 * Provides the necessary context for sales operations, including
 * identifiers for tenancy, location, staff, and customer.
 */
export interface SalesContext {
  vendorId: string;
  branchId: string;
  terminalId: string;
  staffId: string;
  customerId?: string;
  correlationId?: string;
}

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

  completeSale: async (
    saleDraft: Omit<Sale, 'id' | 'date' | 'invoiceNo'>,
    context?: SalesContext
  ): Promise<Sale> => {
    const freshSale: Sale = {
      ...saleDraft,
      id: `TXN-${Math.floor(10000 + Math.random() * 90000)}`,
      invoiceNo: `INV-${Math.floor(100000 + Math.random() * 900000)}`,
      date: new Date().toISOString()
    };
    mockRecentSales.push(freshSale);

    // Eventing and Auditing will only occur if context is provided.
    if (context) {
      // Publish SaleCompleted event after the core transaction succeeds.
      void publishCommerceEvent({
        eventType: 'SaleCompleted',
        vendorId: context.vendorId,
        branchId: context.branchId,
        terminalId: context.terminalId,
        staffId: context.staffId,
        customerId: context.customerId,
        correlationId: context.correlationId,
        module: 'Sales',
        entityType: 'Sale',
        entityId: freshSale.id,
        payload: {
          summary: `Sale ${freshSale.invoiceNo} completed for ${freshSale.customerName}.`,
          amount: freshSale.total,
          currency: 'USD',
          paymentMethod: freshSale.paymentMethod,
          items: freshSale.items,
          metadata: { invoiceNo: freshSale.invoiceNo },
        },
      });

      // Write an audit log for the sale completion.
      void writeAuditLog({
        vendorId: context.vendorId,
        branchId: context.branchId,
        terminalId: context.terminalId,
        staffId: context.staffId,
        correlationId: context.correlationId,
        module: 'Sales',
        action: 'SaleCompleted',
        entityType: 'Sale',
        entityId: freshSale.id,
        after: {
          status: 'COMPLETED',
          total: freshSale.total,
          paymentMethod: freshSale.paymentMethod,
        },
      });
    }
    return freshSale;
  }
};
