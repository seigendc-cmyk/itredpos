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
  const blueprint = preview.blueprint;
  const layout = blueprint?.layout || receipt.businessDetails.receiptLayout || 'Thermal Receipt Roll';
  const paid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const changeDue = Math.max(0, paid - receipt.grandTotal);
  const balanceDue = Math.max(0, receipt.grandTotal - paid);
  const address = blueprint?.businessAddress || receipt.businessDetails.businessAddress || receipt.businessDetails.address;
  const contact = blueprint?.contactNumbers || blueprint?.contactInformation || receipt.businessDetails.contactNumbers || receipt.businessDetails.contactInformation || `${receipt.businessDetails.phone} | ${receipt.businessDetails.whatsApp}`;
  const email = blueprint?.emailAddress || receipt.businessDetails.emailAddress;
  const social = blueprint?.socialMediaHandles || blueprint?.socialMediaInformation || receipt.businessDetails.socialMediaHandles || receipt.businessDetails.socialMediaInformation;
  const businessDescriptor = [receipt.businessDetails.businessType, receipt.businessDetails.industry].filter(Boolean).join(' / ');
  const terminalName = receipt.businessDetails.terminalName || receipt.terminal;

  return (
    <section id="receipt-print-area" className={`receipt-print-document receipt-print-document--${mode} receipt-print-document--${layout.toLowerCase().replace(/\s+/g, '-')}`} aria-label="Receipt print document">
      {instruction && <div className="receipt-print-instruction no-print">{instruction}</div>}
      <header className="receipt-print-header">
        {(blueprint?.logoDataUrl || receipt.businessDetails.logoDataUrl) && (
          <img className="receipt-print-logo" src={blueprint?.logoDataUrl || receipt.businessDetails.logoDataUrl} alt={`${receipt.businessDetails.businessName} logo`} />
        )}
        <h2>{receipt.businessDetails.businessName}</h2>
        {(blueprint?.headerMessage || receipt.businessDetails.headerMessage) && <p className="receipt-print-header-message">{blueprint?.headerMessage || receipt.businessDetails.headerMessage}</p>}
        {businessDescriptor && <p>{businessDescriptor}</p>}
        <p>{address}</p>
        <p>{receipt.businessDetails.branch || receipt.branch} | {terminalName}</p>
        <p>{contact}</p>
        {email && <p>{email}</p>}
        {social && <p>{social}</p>}
        {receipt.businessDetails.vatNumber && <p>VAT: {receipt.businessDetails.vatNumber}</p>}
        {receipt.businessDetails.taxNumber && <p>Tax: {receipt.businessDetails.taxNumber}</p>}
        {receipt.businessDetails.registrationNumber && <p>Registration: {receipt.businessDetails.registrationNumber}</p>}
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
        {receipt.creditDetails && <div><span>Due Date</span><strong>{new Date(receipt.creditDetails.dueDate).toLocaleDateString()}</strong></div>}
        {receipt.creditDetails && <div><span>Account Balance</span><strong>{formatReceiptCurrency(receipt.creditDetails.outstandingAccountBalance)}</strong></div>}
      </div>

      <div className="receipt-print-payments">
        <strong>Payment Method(s)</strong>
        {payments.map((payment) => (
          <p key={payment.id}>{payment.paymentMode}: {formatReceiptCurrency(payment.amount)}{payment.reference ? ` (${payment.reference})` : ''}</p>
        ))}
      </div>

      {receipt.creditDetails && (
        <div className="receipt-print-delivery">
          <strong>Account / Credit Sale</strong>
          <p>Paid: {formatReceiptCurrency(receipt.creditDetails.paidAmount)} | Balance Due: {formatReceiptCurrency(receipt.creditDetails.balanceDue)}</p>
          <p>Credit Terms: {receipt.creditDetails.creditTermsDays} days | Due: {new Date(receipt.creditDetails.dueDate).toLocaleDateString()}</p>
          <p>{receipt.creditDetails.reminderNote}</p>
        </div>
      )}

      {receipt.customer.deliveryAddress && (
        <div className="receipt-print-delivery">
          <strong>Delivery / iDeliver</strong>
          <p>{receipt.customer.deliveryAddress}</p>
          {(receipt.customer.customerWhatsApp || receipt.customer.customerPhone) && <p>{receipt.customer.customerWhatsApp || receipt.customer.customerPhone}</p>}
        </div>
      )}

      <footer className="receipt-print-footer">
        <p>{blueprint?.footerMessage || receipt.businessDetails.footerMessage}</p>
        {(blueprint?.termsAndConditions || receipt.businessDetails.termsAndConditions) && <p>{blueprint?.termsAndConditions || receipt.businessDetails.termsAndConditions}</p>}
        <p>Layout: {layout}</p>
      </footer>
    </section>
  );
}
