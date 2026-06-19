import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Download, Eye, Filter, Printer, RotateCcw } from 'lucide-react';
import { PaymentReceiptRow, ReceiptPaymentType } from '../types/posTypes';
import { getPaymentReceiptRows, recordPaymentReportEvent } from '../services/paymentReportService';

interface PaymentBreakdownCardProps {
  operatorName: string;
}

const paymentTypes: Array<'ALL' | ReceiptPaymentType> = [
  'ALL',
  'Cash',
  'EcoCash',
  'Swipe',
  'Bank Transfer',
  'Split Payment',
  'Credit Sale Placeholder',
  'Store Credit Placeholder'
];

export default function PaymentBreakdownCard({ operatorName }: PaymentBreakdownCardProps) {
  const [receipts, setReceipts] = useState<PaymentReceiptRow[]>([]);
  const [vendorFilter, setVendorFilter] = useState('ALL');
  const [branchFilter, setBranchFilter] = useState('ALL');
  const [cashierFilter, setCashierFilter] = useState('ALL');
  const [terminalFilter, setTerminalFilter] = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | ReceiptPaymentType>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void getPaymentReceiptRows().then((rows) => {
      setReceipts(rows);
      void recordPaymentReportEvent('PAYMENT_BREAKDOWN_VIEWED', operatorName);
    });
  }, [operatorName]);

  const filteredReceipts = useMemo(() => {
    return receipts.filter((receipt) => {
      const createdDate = receipt.createdAt.slice(0, 10);
      return (
        (vendorFilter === 'ALL' || receipt.businessVendor === vendorFilter) &&
        (branchFilter === 'ALL' || receipt.branch === branchFilter) &&
        (cashierFilter === 'ALL' || receipt.cashier === cashierFilter) &&
        (terminalFilter === 'ALL' || receipt.terminal === terminalFilter) &&
        (paymentFilter === 'ALL' || receipt.paymentType === paymentFilter) &&
        (!dateFrom || createdDate >= dateFrom) &&
        (!dateTo || createdDate <= dateTo)
      );
    });
  }, [receipts, vendorFilter, branchFilter, cashierFilter, terminalFilter, paymentFilter, dateFrom, dateTo]);

  const totals = useMemo(() => {
    const byPayment = (paymentType: ReceiptPaymentType) =>
      filteredReceipts.filter((receipt) => receipt.paymentType === paymentType).reduce((sum, receipt) => sum + receipt.netAmount, 0);
    return {
      totalReceipts: filteredReceipts.length,
      totalSales: filteredReceipts.reduce((sum, receipt) => sum + receipt.grossAmount, 0),
      cashTotal: byPayment('Cash'),
      ecoCashTotal: byPayment('EcoCash'),
      swipeTotal: byPayment('Swipe'),
      bankTransferTotal: byPayment('Bank Transfer'),
      splitPaymentTotal: byPayment('Split Payment'),
      refundsTotal: filteredReceipts.reduce((sum, receipt) => sum + receipt.refund, 0),
      netReceipts: filteredReceipts.reduce((sum, receipt) => sum + receipt.netAmount, 0)
    };
  }, [filteredReceipts]);

  const unique = (selector: (row: PaymentReceiptRow) => string): string[] => ['ALL', ...Array.from(new Set<string>(receipts.map(selector)))];

  const applyFilters = () => {
    void recordPaymentReportEvent('RECEIPTS_FILTER_APPLIED', operatorName);
    setNotice('Receipt filters applied.');
  };

  const action = (message: string, eventType: 'RECEIPT_REPRINT_PREVIEWED' | 'PAYMENT_REPORT_EXPORT_PREPARED') => {
    void recordPaymentReportEvent(eventType, operatorName);
    setNotice(message);
  };

  return (
    <div className="bg-white border-2 border-[#b1b5c2] text-[#111827] font-mono text-xs">
      <div className="bg-[#1e222b] text-white p-3 flex items-center justify-between border-b-2 border-orange-500">
        <span className="font-black uppercase text-[10px] tracking-wider">Receipts Breakdown by Payment Type</span>
        <span className="text-[8px] bg-orange-600 px-2 py-0.5 font-black">{filteredReceipts.length} RECEIPTS</span>
      </div>

      <div className="p-4 space-y-4">
        {notice && (
          <div className="border border-orange-200 bg-orange-50 text-orange-900 p-2 text-[10px] font-bold uppercase">{notice}</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 xl:grid-cols-7 gap-2">
          <Select label="Business / Vendor" value={vendorFilter} onChange={setVendorFilter} options={unique((r) => r.businessVendor)} />
          <Select label="Branch" value={branchFilter} onChange={setBranchFilter} options={unique((r) => r.branch)} />
          <Select label="Cashier" value={cashierFilter} onChange={setCashierFilter} options={unique((r) => r.cashier)} />
          <Select label="Terminal" value={terminalFilter} onChange={setTerminalFilter} options={unique((r) => r.terminal)} />
          <DateInput label="Date From" value={dateFrom} onChange={setDateFrom} />
          <DateInput label="Date To" value={dateTo} onChange={setDateTo} />
          <Select label="Payment Type" value={paymentFilter} onChange={(value) => setPaymentFilter(value as 'ALL' | ReceiptPaymentType)} options={paymentTypes} />
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={applyFilters} className="px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white font-black uppercase text-[9px] flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Apply Filters
          </button>
          <button onClick={() => action('Payment report export prepared.', 'PAYMENT_REPORT_EXPORT_PREPARED')} className="px-3 py-2 bg-white border border-[#b1b5c2] text-[#1e222b] font-black uppercase text-[9px] flex items-center gap-1">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 xl:grid-cols-9 gap-2">
          <Metric label="Total Receipts" value={totals.totalReceipts.toString()} />
          <Metric label="Total Sales" value={money(totals.totalSales)} />
          <Metric label="Cash Total" value={money(totals.cashTotal)} />
          <Metric label="EcoCash Total" value={money(totals.ecoCashTotal)} />
          <Metric label="Swipe Total" value={money(totals.swipeTotal)} />
          <Metric label="Bank Transfer Total" value={money(totals.bankTransferTotal)} />
          <Metric label="Split Payment Total" value={money(totals.splitPaymentTotal)} />
          <Metric label="Refunds Total" value={money(totals.refundsTotal)} />
          <Metric label="Net Receipts" value={money(totals.netReceipts)} />
        </div>

        <div className="overflow-x-auto pos-custom-scroll">
          <table className="w-full text-left border-collapse text-[10px]">
            <thead>
              <tr className="bg-slate-100 border-b border-[#b1b5c2] text-[8px] uppercase text-slate-500 font-black">
                {['Receipt No.', 'Date / Time', 'Business / Vendor', 'Branch', 'Terminal', 'Cashier', 'Customer', 'Payment Type', 'Gross Amount', 'Discount', 'Refund', 'Net Amount', 'Status', 'Action'].map((head) => (
                  <th key={head} className="p-2 whitespace-nowrap">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredReceipts.map((receipt) => (
                <tr key={receipt.id} className="hover:bg-slate-50">
                  <td className="p-2 font-black text-[#1e222b]">{receipt.receiptNo}</td>
                  <td className="p-2 whitespace-nowrap">{receipt.dateTime}</td>
                  <td className="p-2 whitespace-nowrap">{receipt.businessVendor}</td>
                  <td className="p-2 whitespace-nowrap">{receipt.branch}</td>
                  <td className="p-2 whitespace-nowrap">{receipt.terminal}</td>
                  <td className="p-2 whitespace-nowrap">{receipt.cashier}</td>
                  <td className="p-2 whitespace-nowrap">{receipt.customer}</td>
                  <td className="p-2 whitespace-nowrap">{receipt.paymentType}</td>
                  <td className="p-2 text-right">{money(receipt.grossAmount)}</td>
                  <td className="p-2 text-right">{money(receipt.discount)}</td>
                  <td className="p-2 text-right">{money(receipt.refund)}</td>
                  <td className="p-2 text-right font-black">{money(receipt.netAmount)}</td>
                  <td className="p-2 whitespace-nowrap">{receipt.status}</td>
                  <td className="p-2">
                    <div className="flex gap-1">
                      <IconButton title="View Receipt" onClick={() => setNotice(`Viewing ${receipt.receiptNo}.`)} icon={<Eye className="w-3 h-3" />} />
                      <IconButton title="Reprint Placeholder" onClick={() => action(`Reprint preview prepared for ${receipt.receiptNo}.`, 'RECEIPT_REPRINT_PREVIEWED')} icon={<Printer className="w-3 h-3" />} />
                      <IconButton title="Refund" onClick={() => setNotice(`Refund action opened for ${receipt.receiptNo}.`)} icon={<RotateCcw className="w-3 h-3" />} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function money(value: number): string {
  return `USD ${value.toFixed(2)}`;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[#b1b5c2] bg-slate-50 p-2 h-[70px] flex flex-col justify-between">
      <span className="text-[8px] text-slate-500 font-black uppercase truncate">{label}</span>
      <span className="text-sm text-[#1e222b] font-black truncate">{value}</span>
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <label className="space-y-1">
      <span className="text-[8px] text-slate-500 font-black uppercase">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full border border-[#b1b5c2] bg-white p-2 text-[10px] font-bold">
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-1">
      <span className="text-[8px] text-slate-500 font-black uppercase">{label}</span>
      <input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="w-full border border-[#b1b5c2] bg-white p-2 text-[10px] font-bold" />
    </label>
  );
}

function IconButton({ title, icon, onClick }: { title: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button title={title} onClick={onClick} className="p-1.5 border border-[#b1b5c2] bg-white hover:bg-orange-50 text-[#1e222b]">
      {icon}
    </button>
  );
}
