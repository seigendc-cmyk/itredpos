import type { ReceiptPrintPreview } from '../types';
import { formatReceiptCurrency } from '../services/receiptService';

interface ReceiptPrintDocumentProps {
  preview: ReceiptPrintPreview | null;
  mode?: 'screen' | 'print';
  instruction?: string;
}

export default function ReceiptPrintDocument({ preview, mode = 'screen', instruction }: ReceiptPrintDocumentProps) {
  if (!preview) return null;

  const { receipt, lines, payments } = preview;
  const paid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const changeDue = Math.max(0, paid - receipt.grandTotal);
  const balanceDue = Math.max(0, receipt.grandTotal - paid);

  return (
    <section id="receipt-print-area" className={`receipt-print-document receipt-print-document--${mode}`} aria-label="Receipt print document">
      {instruction && <div className="receipt-print-instruction no-print">{instruction}</div>}
      <header className="receipt-print-header">
        <h2>{receipt.businessDetails.businessName}</h2>
        <p>{receipt.businessDetails.address}</p>
        <p>{receipt.branch} | {receipt.terminal}</p>
        <p>{receipt.businessDetails.phone} | {receipt.businessDetails.whatsApp}</p>
        {receipt.businessDetails.vatNumber && <p>VAT: {receipt.businessDetails.vatNumber}</p>}
      </header>

      <div className="receipt-print-meta">
        <div><span>Receipt</span><strong>{receipt.receiptNumber}</strong></div>
        <div><span>Date</span><strong>{new Date(receipt.dateTime).toLocaleString()}</strong></div>
        <div><span>Cashier</span><strong>{receipt.cashier}</strong></div>
        <div><span>Customer</span><strong>{receipt.customer.customerName || 'Walk-in Customer'}</strong></div>
      </div>

      <table className="receipt-print-table">
        <thead>
          <tr><th>Item</th><th>Qty</th><th>Total</th></tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id}>
              <td>
                <strong>{line.productName}</strong>
                <span>{line.sku === 'MISC-SALE' ? 'Miscellaneous item' : line.sku}</span>
              </td>
              <td>{line.quantity}</td>
              <td>{formatReceiptCurrency(line.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="receipt-print-totals">
        <div><span>Subtotal</span><strong>{formatReceiptCurrency(receipt.subtotal)}</strong></div>
        <div><span>Discount</span><strong>{formatReceiptCurrency(receipt.discountTotal)}</strong></div>
        <div><span>VAT / Tax</span><strong>{formatReceiptCurrency(receipt.vatTotal)}</strong></div>
        <div><span>Total</span><strong>{formatReceiptCurrency(receipt.grandTotal)}</strong></div>
        <div><span>Paid</span><strong>{formatReceiptCurrency(paid)}</strong></div>
        <div><span>{changeDue > 0 ? 'Change Due' : 'Balance'}</span><strong>{formatReceiptCurrency(changeDue > 0 ? changeDue : balanceDue)}</strong></div>
      </div>

      <div className="receipt-print-payments">
        <strong>Payment Method(s)</strong>
        {payments.map((payment) => (
          <p key={payment.id}>{payment.paymentMode}: {formatReceiptCurrency(payment.amount)}{payment.reference ? ` (${payment.reference})` : ''}</p>
        ))}
      </div>

      {receipt.customer.deliveryAddress && (
        <div className="receipt-print-delivery">
          <strong>Delivery / iDeliver</strong>
          <p>{receipt.customer.deliveryAddress}</p>
          {(receipt.customer.customerWhatsApp || receipt.customer.customerPhone) && <p>{receipt.customer.customerWhatsApp || receipt.customer.customerPhone}</p>}
        </div>
      )}

      <footer className="receipt-print-footer">
        <p>{receipt.businessDetails.footerMessage}</p>
        <p>Keep this receipt for your records.</p>
      </footer>
    </section>
  );
}
