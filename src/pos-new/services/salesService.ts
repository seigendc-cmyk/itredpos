import type { CartItem, VATMode } from '../types';
import type {
  DeliveryMode,
  SalesCustomerMode,
  SalesDeliveryPaymentMode,
  SalesDeliveryPriority,
  SalesPaymentLine,
  SalesPaymentMethod
} from '../components/SalesCartCard';
import { matchesFreeOrderSearch } from '../utils/searchUtils';

const HELD_SALES_KEY = 'itred_pos_held_sales_v1';

export interface HeldSaleRecord {
  id: string;
  heldSaleNumber: string;
  customerMode: SalesCustomerMode;
  selectedCustomerId?: string;
  customerName: string;
  customerPhone?: string;
  customerWhatsApp?: string;
  customerAddress?: string;
  customerTaxNumber?: string;
  customerNotes?: string;
  items: CartItem[];
  total: number;
  heldBy: string;
  heldAt: string;
  note?: string;
  status: 'Held' | 'Resumed' | 'Cancelled' | 'Deleted';
  paymentMethod: SalesPaymentMethod;
  paymentAmount?: string;
  paymentReference?: string;
  payments: SalesPaymentLine[];
  deliveryMode: DeliveryMode;
  deliveryAddress?: string;
  deliveryWhatsApp?: string;
  deliveryNotes?: string;
  deliveryFee: string;
  deliveryPriority: SalesDeliveryPriority;
  deliveryPaymentMode: SalesDeliveryPaymentMode;
  vatMode: VATMode;
  vatRate: string;
  expiryDateTime: string;
  deletedAt?: string;
  deletedBy?: string;
  deletedStaffName?: string;
  deletedReason?: string;
}

export interface HeldSaleFilters {
  query?: string;
  status?: HeldSaleRecord['status'] | 'All';
}

function readHeldSales(): HeldSaleRecord[] {
  try {
    const raw = localStorage.getItem(HELD_SALES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HeldSaleRecord[];
  } catch {
    return [];
  }
}

function saveHeldSales(records: HeldSaleRecord[]): HeldSaleRecord[] {
  try {
    localStorage.setItem(HELD_SALES_KEY, JSON.stringify(records));
  } catch {
    // Held sales remain in React state when localStorage is unavailable.
  }
  return records;
}

export async function getHeldSales(filters: HeldSaleFilters = {}): Promise<HeldSaleRecord[]> {
  return searchHeldSales(filters.query || '', filters);
}

export async function holdCurrentSale(payload: Omit<HeldSaleRecord, 'id' | 'heldSaleNumber' | 'status' | 'expiryDateTime'> & { expiryDateTime?: string }): Promise<HeldSaleRecord> {
  const expiry = payload.expiryDateTime || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const heldSale: HeldSaleRecord = {
    ...payload,
    expiryDateTime: expiry,
    id: `HOLD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
    heldSaleNumber: `HOLD-${Date.now().toString().slice(-8)}`,
    status: 'Held'
  };
  saveHeldSales([heldSale, ...readHeldSales()].slice(0, 40));
  return heldSale;
}

export function getHeldSaleExpiryStatus(expiryDateTime: string): 'Active' | 'Expiring Soon' | 'Expired' {
  const now = new Date();
  const expiry = new Date(expiryDateTime);
  const diffMs = expiry.getTime() - now.getTime();
  if (diffMs <= 0) return 'Expired';
  const diffHours = diffMs / (1000 * 60 * 60);
  if (diffHours <= 1) return 'Expiring Soon';
  return 'Active';
}

export async function deleteHeldSale(heldSaleId: string, staffId: string, staffName: string, reason?: string): Promise<HeldSaleRecord[]> {
  return saveHeldSales(readHeldSales().map((sale) => sale.id === heldSaleId || sale.heldSaleNumber === heldSaleId ? {
    ...sale,
    status: 'Deleted',
    deletedAt: new Date().toISOString(),
    deletedBy: staffId,
    deletedStaffName: staffName,
    deletedReason: reason || 'Deleted from Held Sales drawer'
  } : sale));
}

export async function deleteAllHeldSales(staffId: string, staffName: string, reason?: string): Promise<HeldSaleRecord[]> {
  const deletedAt = new Date().toISOString();
  return saveHeldSales(readHeldSales().map((sale) => sale.status === 'Held' ? {
    ...sale,
    status: 'Deleted',
    deletedAt,
    deletedBy: staffId,
    deletedStaffName: staffName,
    deletedReason: reason || 'Bulk cleared from Held Sales drawer'
  } : sale));
}

export async function reopenHeldSale(heldSaleId: string): Promise<HeldSaleRecord | undefined> {
  return readHeldSales().find((sale) => sale.id === heldSaleId || sale.heldSaleNumber === heldSaleId);
}

export async function markHeldSaleResumed(heldSaleId: string, staffId: string): Promise<HeldSaleRecord[]> {
  return saveHeldSales(readHeldSales().map((sale) => sale.id === heldSaleId ? {
    ...sale,
    status: 'Resumed',
    note: [sale.note, `Resumed by ${staffId}`].filter(Boolean).join(' | ')
  } : sale));
}

export async function cancelHeldSalePlaceholder(heldSaleId: string, staffId: string, reason: string): Promise<HeldSaleRecord[]> {
  return saveHeldSales(readHeldSales().map((sale) => sale.id === heldSaleId ? {
    ...sale,
    status: 'Cancelled',
    note: [sale.note, `${reason || 'Cancelled'} by ${staffId}`].filter(Boolean).join(' | ')
  } : sale));
}

export async function searchHeldSales(query: string, filters: HeldSaleFilters = {}): Promise<HeldSaleRecord[]> {
  const status = filters.status || 'All';
  return readHeldSales().filter((sale) => {
    const matchesStatus = status === 'All' || sale.status === status;
    const matchesQuery = matchesFreeOrderSearch(sale, query, [
      'heldSaleNumber',
      'customerName',
      'customerPhone',
      'heldBy',
      'note',
      'status',
      'total',
      'expiryDateTime',
      (row) => row.items.map((item) => item.product.productName || item.product.name).join(' '),
      (row) => row.items.map((item) => item.product.sku || item.product.code).join(' ')
    ]);
    return matchesStatus && matchesQuery;
  });
}
