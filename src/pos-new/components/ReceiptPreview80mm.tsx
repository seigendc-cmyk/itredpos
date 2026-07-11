import { ReceiptPrintPreview } from '../types/posTypes';

interface ReceiptPreview80mmProps {
  preview: ReceiptPrintPreview;
}

export default function ReceiptPreview80mm({ preview }: ReceiptPreview80mmProps) {
  const { receipt, lines, payments, taxSummary, isReprint } = preview;
  const blueprint = preview.blueprint;
  const layout = blueprint?.layout || receipt.businessDetails.receiptLayout || preview.format;
  const address = blueprint?.businessAddress || receipt.businessDetails.businessAddress || receipt.businessDetails.address;
  const contact = blueprint?.contactNumbers || blueprint?.contactInformation || receipt.businessDetails.contactNumbers || receipt.businessDetails.contactInformation || `Phone: ${receipt.businessDetails.phone} | WhatsApp: ${receipt.businessDetails.whatsApp}`;
  const email = blueprint?.emailAddress || receipt.businessDetails.emailAddress;
  const social = blueprint?.socialMediaHandles || blueprint?.socialMediaInformation || receipt.businessDetails.socialMediaHandles || receipt.businessDetails.socialMediaInformation;
  const businessDescriptor = [receipt.businessDetails.businessType, receipt.businessDetails.industry].filter(Boolean).join(' / ');
  const terminalName = receipt.businessDetails.terminalName || receipt.terminal;

  return (
    <div className="bg-white border-2 border-[#1e222b] p-4 text-[#111827] font-mono w-[320px] max-w-full mx-auto receipt-roll-preview">
      <div className="text-center border-b border-dashed border-slate-400 pb-3">
        {(blueprint?.logoDataUrl || receipt.businessDetails.logoDataUrl) && <img className="receipt-roll-preview__logo" src={blueprint?.logoDataUrl || receipt.businessDetails.logoDataUrl} alt={`${receipt.businessDetails.businessName} logo`} />}
        <div className="text-sm font-black uppercase">{receipt.businessDetails.businessName}</div>
        {(blueprint?.headerMessage || receipt.businessDetails.headerMessage) && <div className="text-[9px] font-bold uppercase">{blueprint?.headerMessage || receipt.businessDetails.headerMessage}</div>}
        <div className="text-[10px] font-bold uppercase">{receipt.businessDetails.tradingName}</div>
        {businessDescriptor && <div className="text-[8px] uppercase">{businessDescriptor}</div>}
        <div className="text-[9px] mt-1">{receipt.businessDetails.branch} | {terminalName}</div>
        <div className="text-[8px] leading-tight">{address}</div>
        <div className="text-[8px]">{contact}</div>
        {email && <div className="text-[8px]">{email}</div>}
        {social && <div className="text-[8px]">{social}</div>}
        {receipt.businessDetails.vatRegistered && <div className="text-[8px] font-bold">VAT No: {receipt.businessDetails.vatNumber}</div>}
        {receipt.businessDetails.taxNumber && <div className="text-[8px] font-bold">Tax No: {receipt.businessDetails.taxNumber}</div>}
        {receipt.businessDetails.registrationNumber && <div className="text-[8px] font-bold">Reg No: {receipt.businessDetails.registrationNumber}</div>}
        {isReprint && <div className="mt-2 border border-orange-500 text-orange-700 font-black text-[9px] uppercase">Reprint Copy</div>}
      </div>

      <div className="py-3 border-b border-dashed border-slate-400 text-[9px] space-y-1">
        <div className="flex justify-between"><span>Receipt</span><strong>{receipt.receiptNumber}</strong></div>
        <div className="flex justify-between"><span>Date</span><strong>{new Date(receipt.dateTime).toLocaleString()}</strong></div>
        <div className="flex justify-between"><span>Terminal</span><strong>{receipt.terminal}</strong></div>
        <div className="flex justify-between"><span>Cashier</span><strong>{receipt.cashier}</strong></div>
        <div className="flex justify-between"><span>Customer</span><strong>{receipt.customer.customerName || 'Walk-in Customer'}</strong></div>
      </div>

      <div className="py-3 border-b border-dashed border-slate-400 space-y-2">
        {lines.map((line) => (
          <div key={line.id} className="text-[9px]">
            <div className="font-black uppercase leading-tight">{line.productName}</div>
            <div className="flex justify-between">
              <span>{line.quantity} x USD {line.unitPrice.toFixed(2)}</span>
              <strong>USD {line.lineTotal.toFixed(2)}</strong>
            </div>
            {line.discountAmount > 0 && <div className="text-[8px] text-orange-700">Discount: USD {line.discountAmount.toFixed(2)}</div>}
          </div>
        ))}
      </div>

      <div className="py-3 border-b border-dashed border-slate-400 text-[9px] space-y-1">
        <div className="flex justify-between"><span>Subtotal</span><strong>USD {receipt.subtotal.toFixed(2)}</strong></div>
        <div className="flex justify-between"><span>Discount</span><strong>USD {receipt.discountTotal.toFixed(2)}</strong></div>
        {taxSummary.vatMode !== 'Not VAT Registered' && (
          <div className="flex justify-between"><span>{taxSummary.taxLabel}</span><strong>USD {taxSummary.vatAmount.toFixed(2)}</strong></div>
        )}
        <div className="flex justify-between text-[12px] font-black border-t border-slate-300 pt-2 mt-2"><span>Total</span><span>USD {receipt.grandTotal.toFixed(2)}</span></div>
      </div>

      <div className="py-3 border-b border-dashed border-slate-400 text-[9px] space-y-1">
        {payments.map((payment) => (
          <div key={payment.id} className="flex justify-between">
            <span>{payment.paymentMode}</span>
            <strong>USD {payment.amount.toFixed(2)}</strong>
          </div>
        ))}
        {receipt.creditDetails && (
          <>
            <div className="flex justify-between"><span>Payment Type</span><strong>Account / Credit</strong></div>
            <div className="flex justify-between"><span>Paid</span><strong>USD {receipt.creditDetails.paidAmount.toFixed(2)}</strong></div>
            <div className="flex justify-between"><span>Balance Due</span><strong>USD {receipt.creditDetails.balanceDue.toFixed(2)}</strong></div>
            <div className="flex justify-between"><span>Due Date</span><strong>{new Date(receipt.creditDetails.dueDate).toLocaleDateString()}</strong></div>
            <div className="flex justify-between"><span>Terms</span><strong>{receipt.creditDetails.creditTermsDays} days</strong></div>
            <div className="flex justify-between"><span>Account Balance</span><strong>USD {receipt.creditDetails.outstandingAccountBalance.toFixed(2)}</strong></div>
          </>
        )}
        {!receipt.creditDetails && <div className="flex justify-between"><span>Change Due</span><strong>USD 0.00</strong></div>}
      </div>

      <div className="pt-3 text-center text-[8px] space-y-1">
        <div className="font-black uppercase">Fiscalization: {receipt.fiscalizationStatus}</div>
        {receipt.creditDetails && <div>{receipt.creditDetails.reminderNote}</div>}
        <div>{blueprint?.footerMessage || receipt.businessDetails.footerMessage}</div>
        {(blueprint?.termsAndConditions || receipt.businessDetails.termsAndConditions) && <div>{blueprint?.termsAndConditions || receipt.businessDetails.termsAndConditions}</div>}
        <div className="font-bold uppercase">Layout: {layout}</div>
      </div>
    </div>
  );
}
