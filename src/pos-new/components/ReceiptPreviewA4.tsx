import { ReceiptPrintPreview } from '../types/posTypes';

interface ReceiptPreviewA4Props {
  preview: ReceiptPrintPreview;
  onExport?: () => void;
}

export default function ReceiptPreviewA4({ preview, onExport }: ReceiptPreviewA4Props) {
  const { receipt, lines, payments, taxSummary } = preview;

  return (
    <div className="bg-white border-2 border-[#1e222b] p-6 text-[#111827] font-mono max-w-4xl mx-auto">
      <div className="flex justify-between gap-6 border-b-2 border-[#1e222b] pb-4">
        <div>
          <div className="text-xl font-black uppercase">{receipt.businessDetails.businessName}</div>
          <div className="text-xs font-bold uppercase text-slate-700">{receipt.businessDetails.tradingName}</div>
          <div className="text-[10px] mt-2">{receipt.businessDetails.address}</div>
          <div className="text-[10px]">Phone: {receipt.businessDetails.phone} | WhatsApp: {receipt.businessDetails.whatsApp}</div>
          {receipt.businessDetails.vatRegistered && <div className="text-[10px] font-bold">VAT No: {receipt.businessDetails.vatNumber}</div>}
        </div>
        <div className="text-right">
          <div className="text-lg font-black uppercase">Receipt</div>
          <div className="text-orange-600 font-black">{receipt.receiptNumber}</div>
          <div className="text-[10px] mt-2">Date: {new Date(receipt.dateTime).toLocaleString()}</div>
          <div className="text-[10px]">Terminal: {receipt.terminal}</div>
          <div className="text-[10px]">Served By: {receipt.cashier}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 py-4 text-[10px]">
        <div className="border border-[#b1b5c2] p-3">
          <div className="font-black uppercase text-slate-700 mb-1">Customer</div>
          <div className="font-bold">{receipt.customer.customerName || 'Walk-in Customer'}</div>
          <div>{receipt.customer.customerPhone || 'No phone captured'}</div>
          <div>{receipt.customer.customerTaxNo || 'No customer tax number'}</div>
        </div>
        <div className="border border-[#b1b5c2] p-3">
          <div className="font-black uppercase text-slate-700 mb-1">Fiscal Status</div>
          <div>Status: <strong>{receipt.fiscalizationStatus}</strong></div>
          <div>Reference: <strong>{receipt.fiscalReferencePlaceholder || 'Not connected'}</strong></div>
          <div>Mode: Disabled In Development</div>
        </div>
      </div>

      <table className="w-full text-left border-collapse text-[10px]">
        <thead>
          <tr className="bg-slate-100">
            <th className="p-2 border border-[#b1b5c2]">Item</th>
            <th className="p-2 border border-[#b1b5c2]">Qty</th>
            <th className="p-2 border border-[#b1b5c2]">Unit</th>
            <th className="p-2 border border-[#b1b5c2]">Discount</th>
            <th className="p-2 border border-[#b1b5c2]">VAT</th>
            <th className="p-2 border border-[#b1b5c2]">Total</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id}>
              <td className="p-2 border border-[#b1b5c2] font-bold">{line.productName}</td>
              <td className="p-2 border border-[#b1b5c2]">{line.quantity}</td>
              <td className="p-2 border border-[#b1b5c2]">USD {line.unitPrice.toFixed(2)}</td>
              <td className="p-2 border border-[#b1b5c2]">USD {line.discountAmount.toFixed(2)}</td>
              <td className="p-2 border border-[#b1b5c2]">USD {line.vatAmount.toFixed(2)}</td>
              <td className="p-2 border border-[#b1b5c2] font-black">USD {line.lineTotal.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="grid grid-cols-2 gap-4 mt-4 text-[10px]">
        <div className="border border-[#b1b5c2] p-3">
          <div className="font-black uppercase text-slate-700 mb-2">Payment Summary</div>
          {payments.map((payment) => (
            <div key={payment.id} className="flex justify-between">
              <span>{payment.paymentMode}</span>
              <strong>USD {payment.amount.toFixed(2)}</strong>
            </div>
          ))}
        </div>
        <div className="border border-[#b1b5c2] p-3 space-y-1">
          <div className="flex justify-between"><span>Subtotal</span><strong>USD {receipt.subtotal.toFixed(2)}</strong></div>
          <div className="flex justify-between"><span>Discount</span><strong>USD {receipt.discountTotal.toFixed(2)}</strong></div>
          <div className="flex justify-between"><span>{taxSummary.taxLabel}</span><strong>USD {taxSummary.vatAmount.toFixed(2)}</strong></div>
          <div className="flex justify-between text-sm font-black border-t border-slate-300 pt-2"><span>Total</span><span>USD {receipt.grandTotal.toFixed(2)}</span></div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-6 text-[10px]">
        <div className="border-t border-[#1e222b] pt-2">Customer Signature Placeholder</div>
        <div className="border-t border-[#1e222b] pt-2">Served By: {receipt.cashier}</div>
      </div>

      {onExport && (
        <button onClick={onExport} className="mt-5 bg-orange-600 hover:bg-orange-700 text-white border border-orange-700 px-4 py-2 text-[10px] font-black uppercase">
          Export PDF Placeholder
        </button>
      )}
    </div>
  );
}
