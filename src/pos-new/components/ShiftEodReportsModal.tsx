import { FileText, Printer, X } from 'lucide-react';
import type { ShiftEodPrintPayload } from '../services/shiftEodReportService';

interface ShiftEodReportsModalProps {
  open: boolean;
  payload: ShiftEodPrintPayload | null;
  onClose: () => void;
}

function money(value: number): string {
  return `USD ${value.toFixed(2)}`;
}

export default function ShiftEodReportsModal({ open, payload, onClose }: ShiftEodReportsModalProps) {
  if (!open || !payload) return null;

  return (
    <div className="shift-control-modal-backdrop shift-eod-print-host" role="presentation">
      <section className="shift-control-modal shift-control-modal--wide shift-eod-report-card" role="dialog" aria-modal="true" aria-labelledby="shift-eod-title">
        <header className="shift-control-modal__header">
          <div>
            <p className="sci-pos-eyebrow">{payload.businessName}</p>
            <h2 id="shift-eod-title">Shift EOD Reports</h2>
          </div>
          <button type="button" className="sci-icon-button shift-print-hide" onClick={onClose} aria-label="Close EOD reports">
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="shift-control-modal__body shift-eod-report-body">
          <section>
            <h3>EOD Summary</h3>
            <div className="shift-history-detail-grid">
              <div><span>Shift ID</span><strong>{payload.summary.shiftId}</strong></div>
              <div><span>Terminal</span><strong>{payload.summary.terminal}</strong></div>
              <div><span>Branch</span><strong>{payload.summary.branch}</strong></div>
              <div><span>Staff</span><strong>{payload.summary.staff}</strong></div>
              <div><span>Opened At</span><strong>{new Date(payload.summary.openedAt).toLocaleString()}</strong></div>
              <div><span>Closed At</span><strong>{new Date(payload.summary.closedAt).toLocaleString()}</strong></div>
              <div><span>Sales Count</span><strong>{payload.summary.salesCount}</strong></div>
              <div><span>Gross Sales</span><strong>{money(payload.summary.grossSales)}</strong></div>
              <div><span>Returns</span><strong>{money(payload.summary.returns)}</strong></div>
              <div><span>Discounts</span><strong>{money(payload.summary.discounts)}</strong></div>
              <div><span>VAT</span><strong>{money(payload.summary.vat)}</strong></div>
              <div><span>Net Received</span><strong>{money(payload.summary.netReceived)}</strong></div>
              <div><span>Expected Cash</span><strong>{money(payload.summary.expectedCash)}</strong></div>
              <div><span>Counted Cash</span><strong>{money(payload.summary.countedCash)}</strong></div>
              <div><span>Variance</span><strong>{money(payload.summary.variance)}</strong></div>
            </div>
          </section>
          <section>
            <h3>VAT Summary</h3>
            <div className="shift-history-detail-grid">
              <div><span>VAT Inclusive Sales</span><strong>{money(payload.vat.vatInclusiveSales)}</strong></div>
              <div><span>VAT Exclusive Sales</span><strong>{money(payload.vat.vatExclusiveSales)}</strong></div>
              <div><span>VAT Exempt Sales</span><strong>{money(payload.vat.vatExemptSales)}</strong></div>
              <div><span>VAT Amount</span><strong>{money(payload.vat.vatAmount)}</strong></div>
              <div><span>Taxable Amount</span><strong>{money(payload.vat.taxableAmount)}</strong></div>
            </div>
          </section>
          <section>
            <h3>Cash Variance Summary</h3>
            <div className="shift-history-detail-grid">
              <div><span>Expected Cash</span><strong>{money(payload.cashVariance.expectedCash)}</strong></div>
              <div><span>Counted Cash</span><strong>{money(payload.cashVariance.countedCash)}</strong></div>
              <div><span>Variance</span><strong>{money(payload.cashVariance.variance)}</strong></div>
              <div><span>Cash Sales</span><strong>{money(payload.cashVariance.cashSales)}</strong></div>
              <div><span>Cash Refunds</span><strong>{money(payload.cashVariance.cashRefunds)}</strong></div>
              <div><span>Drawer Opens</span><strong>{payload.cashVariance.drawerOpens}</strong></div>
              <div><span>Reviewed By</span><strong>{payload.cashVariance.reviewedBy}</strong></div>
            </div>
          </section>
          <section>
            <h3>Daily Sales and Payment Summary</h3>
            <div className="shift-history-detail-grid">
              <div><span>Completed Sales</span><strong>{payload.sales.completedSales}</strong></div>
              <div><span>Net Sales</span><strong>{money(payload.sales.netSales)}</strong></div>
              <div><span>Cash</span><strong>{money(payload.payments.cash)}</strong></div>
              <div><span>EcoCash Placeholder</span><strong>{money(payload.payments.ecocashPlaceholder)}</strong></div>
              <div><span>Innbucks Placeholder</span><strong>{money(payload.payments.innbucksPlaceholder)}</strong></div>
              <div><span>Mukuru Placeholder</span><strong>{money(payload.payments.mukuruPlaceholder)}</strong></div>
              <div><span>Bank Transfer</span><strong>{money(payload.payments.bankTransfer)}</strong></div>
              <div><span>Card Placeholder</span><strong>{money(payload.payments.cardPlaceholder)}</strong></div>
              <div><span>Account / Credit</span><strong>{money(payload.payments.accountCredit)}</strong></div>
              <div><span>Mixed Payment</span><strong>{money(payload.payments.mixedPayment)}</strong></div>
            </div>
          </section>
          <section>
            <h3>Drawer Reconciliation and Shift Activity</h3>
            <div className="shift-history-detail-grid">
              <div><span>Drawer</span><strong>{payload.drawer.drawerId}</strong></div>
              <div><span>Opening Float</span><strong>{money(payload.drawer.openingFloat)}</strong></div>
              <div><span>Cash Sales</span><strong>{money(payload.drawer.cashSales)}</strong></div>
              <div><span>Sales Completed</span><strong>{payload.activity.salesCompleted}</strong></div>
              <div><span>Held Sales</span><strong>{payload.activity.heldSales}</strong></div>
              <div><span>Voided Carts</span><strong>{payload.activity.voidedCarts}</strong></div>
              <div><span>Discounts</span><strong>{payload.activity.discounts}</strong></div>
              <div><span>Stock Movements</span><strong>{payload.activity.stockMovements}</strong></div>
              <div><span>Delivery Events</span><strong>{payload.activity.deliveryEvents}</strong></div>
              <div><span>Cash Drawer Events</span><strong>{payload.activity.cashDrawerEvents}</strong></div>
              <div><span>Approval Events</span><strong>{payload.activity.approvalEvents}</strong></div>
            </div>
          </section>
          <p className="shift-pdf-note">{payload.pdfInstruction}</p>
        </div>
        <footer className="shift-control-modal__footer shift-print-hide">
          <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => window.print()}>
            <Printer size={16} aria-hidden="true" />
            Print EOD Reports
          </button>
          <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => window.print()}>
            <FileText size={16} aria-hidden="true" />
            Save as PDF via device print dialog
          </button>
          <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={onClose}>Close</button>
        </footer>
      </section>
    </div>
  );
}
