import { useMemo, useState } from 'react';
import { CopyPlus, FileText, Printer, X } from 'lucide-react';
import type { Sale } from '../types';
// Assuming a hook that provides permission checks.
// You would need to create this hook based on your auth context.

interface SalesReceiptReviewModalProps {
  sale: Sale | null;
  onClose: () => void;
  onReprint: (sale: Sale) => void | Promise<void>;
  onCatForm: (sale: Sale) => void; // CAT: Customer Action Trail
  onDuplicate: (sale: Sale) => void;
  canReprint?: boolean;
  canOpenCatForm?: boolean;
  canDuplicate?: boolean;
}

const tabs = ['Receipt', 'Items', 'Customer', 'Payment', 'Tax', 'Delivery', 'Audit'] as const;
type ReceiptReviewTab = typeof tabs[number];

function money(value: number): string {
  return `USD ${value.toFixed(2)}`;
}

export default function SalesReceiptReviewModal({ sale, onClose, onReprint, onCatForm, onDuplicate, canReprint = false, canOpenCatForm = false, canDuplicate = false }: SalesReceiptReviewModalProps) {
  const [activeTab, setActiveTab] = useState<ReceiptReviewTab>('Receipt');
  const itemCount = useMemo(() => sale?.items.reduce((sum, item) => sum + item.quantity, 0) || 0, [sale]);

  if (!sale) return null;

  return (
    <div className="sales-drawer-backdrop sales-receipt-review-backdrop" onClick={onClose}>
      <section className="sales-receipt-review-modal" onClick={(event) => event.stopPropagation()} aria-label="Receipt Review">
        <div className="sales-drawer-header">
          <div>
            <p className="sci-pos-eyebrow">Receipt Review</p>
            <h3>{sale.invoiceNo}</h3>
            <span>Read-only sale receipt, tax, payment, delivery, and audit details.</span>
          </div>
          <button type="button" className="sci-pos-icon-button" onClick={onClose} aria-label="Close receipt review">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="sales-receipt-review-tabs" role="tablist" aria-label="Receipt review tabs">
          {tabs.map((tab) => (
            <button key={tab} type="button" className={activeTab === tab ? 'active' : undefined} onClick={() => setActiveTab(tab)}>
              {tab}
            </button>
          ))}
        </div>
        <div className="sales-receipt-review-body">
          {activeTab === 'Receipt' && (
            <div className="sales-review-grid">
              <div><span>Receipt No.</span><strong>{sale.invoiceNo}</strong></div>
              <div><span>Date / Time</span><strong>{new Date(sale.date).toLocaleString()}</strong></div>
              <div><span>Status</span><strong>{sale.status}</strong></div>
              <div><span>Terminal</span><strong>{sale.terminal || '-'}</strong></div>
              <div><span>Cashier</span><strong>{sale.operator}</strong></div>
              <div><span>Total Items</span><strong>{itemCount}</strong></div>
            </div>
          )}
          {activeTab === 'Items' && (
            <div className="sales-review-table-wrap">
              <table className="sci-pos-table">
                <thead><tr><th>SKU</th><th>Product</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
                <tbody>{sale.items.map((item) => <tr key={`${item.productId}-${item.code}`}><td className="sales-sku">{item.code}</td><td>{item.name}</td><td>{item.quantity}</td><td>{money(item.price)}</td><td>{money(item.total)}</td></tr>)}</tbody>
              </table>
            </div>
          )}
          {activeTab === 'Customer' && <div className="sales-review-grid"><div><span>Customer</span><strong>{sale.customerName || 'Walk-in Customer'}</strong></div></div>}
          {activeTab === 'Payment' && <div className="sales-review-grid"><div><span>Payment Method</span><strong>{sale.paymentMethod}</strong></div><div><span>Cash Received</span><strong>{money(sale.cashReceived || 0)}</strong></div><div><span>Change</span><strong>{money(sale.changeGiven || 0)}</strong></div></div>}
          {activeTab === 'Tax' && <div className="sales-review-grid"><div><span>Subtotal</span><strong>{money(sale.subtotal)}</strong></div><div><span>Discount</span><strong>{money(sale.discount)}</strong></div><div><span>Tax</span><strong>{money(sale.tax)}</strong></div><div><span>Total</span><strong>{money(sale.total)}</strong></div></div>}
          {activeTab === 'Delivery' && <div className="sales-review-grid"><div><span>Delivery</span><strong>Read-only local receipt detail</strong></div><div><span>Mutation</span><strong>No delivery changes from receipt review.</strong></div></div>}
          {activeTab === 'Audit' && <div className="sales-review-grid"><div><span>Review Mode</span><strong>Read-only</strong></div><div><span>Stock</span><strong>No stock changes</strong></div><div><span>Payment</span><strong>No payment changes</strong></div><div><span>Receipt</span><strong>No receipt mutation</strong></div></div>}
        </div>
        <div className="sales-drawer-actions">
          {canReprint && (
            <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => void onReprint(sale)}><Printer size={16} aria-hidden="true" /> Reprint</button>
          )}
          {canOpenCatForm && (
            <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => onCatForm(sale)}><FileText size={16} aria-hidden="true" /> Open CAT Form</button>
          )}
          {canDuplicate && (
            <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => onDuplicate(sale)}><CopyPlus size={16} aria-hidden="true" /> Duplicate as New Sale</button>
          )}
          <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={onClose}>Close</button>
        </div>
      </section>
    </div>
  );
}

