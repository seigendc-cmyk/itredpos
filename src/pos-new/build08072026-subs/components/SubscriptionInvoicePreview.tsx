import type { SubscriptionInvoice, SubscriptionWhatsAppRequestConfig } from '../models/subscriptionModels';
import { buildWhatsAppActivationRequestUrl } from '../services/subscriptionInvoiceService';

interface SubscriptionInvoicePreviewProps {
  invoice: SubscriptionInvoice;
  config: SubscriptionWhatsAppRequestConfig;
}

function money(value: number, currency: string): string {
  return `${currency} ${value.toFixed(2)}`;
}

export default function SubscriptionInvoicePreview({ invoice, config }: SubscriptionInvoicePreviewProps) {
  const handleRequestToken = () => {
    const url = buildWhatsAppActivationRequestUrl(invoice, config);
    window.open(url, '_blank');
  };

  return (
    <div className="border border-[#b1b5c2] bg-white">
      <div className="flex items-center justify-between border-b border-[#d6d9e0] bg-slate-50 px-3 py-2">
        <h3 className="text-sm font-black uppercase text-[#1e222b]">Billing Invoice Preview</h3>
        <span className="bg-orange-600 px-2 py-0.5 text-[9px] font-black uppercase text-white">Pending Token Request</span>
      </div>

      <div className="space-y-3 p-3 text-xs">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 border border-[#e6e8ee] bg-slate-50 p-2 font-mono text-[10px]">
          <div className="flex justify-between text-slate-500"><span>Invoice No</span><span className="text-[#1e222b] font-bold">{invoice.invoiceNumber}</span></div>
          <div className="flex justify-between text-slate-500"><span>Date</span><span className="text-[#1e222b]">{new Date(invoice.invoiceDate).toLocaleString()}</span></div>
          <div className="flex justify-between text-slate-500"><span>Vendor</span><span className="text-[#1e222b]">{invoice.vendorName}</span></div>
          <div className="flex justify-between text-slate-500"><span>Vendor ID</span><span className="text-[#1e222b]">{invoice.vendorId}</span></div>
          <div className="flex justify-between text-slate-500"><span>Current Plan</span><span className="text-[#1e222b]">{invoice.currentPlan}</span></div>
          <div className="flex justify-between text-slate-500"><span>Requested Plan</span><span className="text-[#1e222b] font-bold">{invoice.requestedPlan}</span></div>
        </div>

        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr className="bg-slate-100 border-b border-[#b1b5c2] text-[8px] uppercase text-slate-500 font-black">
              <th className="p-1.5 text-left">Item</th>
              <th className="p-1.5 text-left">Type</th>
              <th className="p-1.5 text-right">Qty</th>
              <th className="p-1.5 text-right">Unit</th>
              <th className="p-1.5 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoice.lines.map((line) => (
              <tr key={line.refId} className="text-slate-700">
                <td className="p-1.5 font-semibold text-[#1e222b]">{line.name}</td>
                <td className="p-1.5 text-slate-500">{line.type}</td>
                <td className="p-1.5 text-right">{line.quantity}</td>
                <td className="p-1.5 text-right">{money(line.unitPriceUsd, invoice.currency)}</td>
                <td className="p-1.5 text-right font-bold text-[#1e222b]">{money(line.lineSubtotalUsd, invoice.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="space-y-1 border-t border-[#d6d9e0] pt-2 text-[10px] font-bold uppercase text-slate-700">
          <div className="flex justify-between"><span>Subtotal</span><span className="text-[#1e222b]">{money(invoice.subtotalUsd, invoice.currency)}</span></div>
          <div className="flex justify-between"><span>Tax</span><span className="text-[#1e222b]">{money(invoice.taxAmountUsd, invoice.currency)}</span></div>
          <div className="flex justify-between border-t border-[#e6e8ee] pt-1 text-xs"><span>Grand Total</span><span className="text-orange-700">{money(invoice.grandTotalUsd, invoice.currency)}</span></div>
        </div>

        <div className="flex items-center justify-between border border-orange-200 bg-orange-50 p-2 text-[10px] font-bold uppercase text-orange-800">
          <span>Status: {invoice.status.replace(/_/g, ' ')}</span>
          <span>{invoice.currency}</span>
        </div>

        <button
          type="button"
          onClick={handleRequestToken}
          className="w-full bg-orange-600 hover:bg-orange-700 text-white font-black text-xs uppercase py-3 border border-orange-500 flex items-center justify-center gap-2 cursor-pointer"
        >
          Request Activation Token via WhatsApp
        </button>
        <p className="text-[8px] uppercase text-slate-400">WhatsApp number is fallback/demo config; Backend Console supplies the real number later. No token is consumed or activated in this step.</p>
      </div>
    </div>
  );
}
