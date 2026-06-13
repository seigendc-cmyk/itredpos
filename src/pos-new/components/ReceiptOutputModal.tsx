import { ExternalLink, FileDown, History, MessageCircle, Printer, X } from 'lucide-react';
import { useState } from 'react';
import type { ReceiptPrintPreview } from '../types';
import {
  formatReceiptCurrency,
  prepareReceiptPdfPrintPayload,
  prepareReceiptPrintPayload,
  prepareReceiptWhatsAppMessage
} from '../services/receiptService';
import ReceiptPrintDocument from './ReceiptPrintDocument';

interface ReceiptOutputModalProps {
  preview: ReceiptPrintPreview | null;
  canPrint: boolean;
  canPdf: boolean;
  canWhatsApp: boolean;
  onClose: () => void;
  onOpenSalesHistory: () => void;
  onActivity?: (eventType: string, message: string) => void;
}

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d]/g, '');
}

export default function ReceiptOutputModal({
  preview,
  canPrint,
  canPdf,
  canWhatsApp,
  onClose,
  onOpenSalesHistory,
  onActivity
}: ReceiptOutputModalProps) {
  const [phoneEntryOpen, setPhoneEntryOpen] = useState(false);
  const [whatsAppPhone, setWhatsAppPhone] = useState('');
  const [printInstruction, setPrintInstruction] = useState('');

  if (!preview) return null;

  const { receipt, lines, payments } = preview;
  const paid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const balance = Math.max(0, receipt.grandTotal - paid);
  const change = Math.max(0, paid - receipt.grandTotal);
  const customerPhone = receipt.customer.customerWhatsApp || receipt.customer.customerPhone || '';

  const runPrint = (mode: 'print' | 'pdf') => {
    if (mode === 'print') {
      prepareReceiptPrintPayload(receipt);
      setPrintInstruction('');
      onActivity?.('RECEIPT_PRINT_STARTED', `Print started for ${receipt.receiptNumber}.`);
    } else {
      prepareReceiptPdfPrintPayload(receipt);
      setPrintInstruction('Choose "Save as PDF" in your device print dialog.');
      onActivity?.('RECEIPT_PDF_PREPARED', `Save as PDF prepared for ${receipt.receiptNumber}.`);
    }
    window.setTimeout(() => window.print(), 80);
  };

  const openWhatsApp = (phone: string) => {
    const normalized = normalizePhone(phone);
    if (!normalized) {
      setPhoneEntryOpen(true);
      return;
    }
    const message = prepareReceiptWhatsAppMessage(receipt, normalized);
    onActivity?.('RECEIPT_WHATSAPP_SHARE_PREPARED', `WhatsApp share prepared for ${receipt.receiptNumber}.`);
    window.open(`https://wa.me/${normalized}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
    setPhoneEntryOpen(false);
  };

  return (
    <div className="receipt-output-backdrop" onClick={onClose}>
      <section className="receipt-output-modal" onClick={(event) => event.stopPropagation()} aria-label="Receipt Generated">
        <header className="receipt-output-header">
          <div>
            <p className="sci-pos-eyebrow">Receipt Output</p>
            <h3>Receipt Generated</h3>
            <span>Sale completed successfully. Print, save, or share the receipt.</span>
          </div>
          <button type="button" className="sci-pos-icon-button" onClick={onClose} aria-label="Close receipt output">
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <div className="receipt-output-body">
          <div className="receipt-output-summary">
            <div><span>Business</span><strong>{receipt.businessDetails.businessName}</strong></div>
            <div><span>Branch</span><strong>{receipt.branch}</strong></div>
            <div><span>Terminal</span><strong>{receipt.terminal}</strong></div>
            <div><span>Cashier</span><strong>{receipt.cashier}</strong></div>
            <div><span>Receipt No.</span><strong>{receipt.receiptNumber}</strong></div>
            <div><span>Date / Time</span><strong>{new Date(receipt.dateTime).toLocaleString()}</strong></div>
            <div><span>Customer</span><strong>{receipt.customer.customerName || 'Walk-in Customer'}</strong></div>
            <div><span>Total</span><strong>{formatReceiptCurrency(receipt.grandTotal)}</strong></div>
            <div><span>Paid</span><strong>{formatReceiptCurrency(paid)}</strong></div>
            <div><span>{change > 0 ? 'Change Due' : 'Balance'}</span><strong>{formatReceiptCurrency(change > 0 ? change : balance)}</strong></div>
          </div>

          <ReceiptPrintDocument preview={preview} instruction={printInstruction} />

          <div className="receipt-output-detail">
            <strong>Items</strong>
            {lines.map((line) => (
              <span key={line.id}>{line.quantity} x {line.productName}{line.sku === 'MISC-SALE' ? ' (Miscellaneous item)' : ''} - {formatReceiptCurrency(line.lineTotal)}</span>
            ))}
            <strong>Payment method(s)</strong>
            {payments.map((payment) => <span key={payment.id}>{payment.paymentMode} - {formatReceiptCurrency(payment.amount)}</span>)}
            {receipt.customer.deliveryAddress && (
              <>
                <strong>Delivery / iDeliver details</strong>
                <span>{receipt.customer.deliveryAddress}</span>
                <span>{receipt.customer.customerWhatsApp || receipt.customer.customerPhone || 'No customer delivery phone captured'}</span>
              </>
            )}
          </div>

          {phoneEntryOpen && (
            <div className="receipt-whatsapp-entry">
              <label>WhatsApp Number<input value={whatsAppPhone} onChange={(event) => setWhatsAppPhone(event.target.value)} placeholder="+263..." /></label>
              <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={() => openWhatsApp(whatsAppPhone)}>
                <ExternalLink size={16} aria-hidden="true" /> Open WhatsApp
              </button>
            </div>
          )}
        </div>

        <footer className="receipt-output-actions">
          <button type="button" className="sci-pos-button sci-pos-button--primary" disabled={!canPrint} onClick={() => runPrint('print')} title={canPrint ? '' : 'You do not have permission to reprint receipts.'}>
            <Printer size={16} aria-hidden="true" /> Print Receipt
          </button>
          <button type="button" className="sci-pos-button sci-pos-button--secondary" disabled={!canPdf} onClick={() => runPrint('pdf')} title={canPdf ? '' : 'You do not have permission to save receipt PDF.'}>
            <FileDown size={16} aria-hidden="true" /> Save as PDF
          </button>
          <button type="button" className="sci-pos-button sci-pos-button--secondary" disabled={!canWhatsApp} onClick={() => openWhatsApp(customerPhone)} title={canWhatsApp ? '' : 'You do not have permission to share receipts by WhatsApp.'}>
            <MessageCircle size={16} aria-hidden="true" /> Send via WhatsApp
          </button>
          <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={onOpenSalesHistory}>
            <History size={16} aria-hidden="true" /> Open Sales History
          </button>
          <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={onClose}>Close</button>
        </footer>
      </section>
    </div>
  );
}
