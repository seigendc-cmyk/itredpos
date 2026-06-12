import { Eye, FileText, RotateCcw, Search, Undo2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { mockReceiptRecords } from '../mock/mockPosData';
import { DeliveryRequest, PosSession, ReceiptRecord, Role } from '../types';
import { getDeliveryRequests } from '../services/deliveryService';
import { hasPermission } from '../utils/posPermissions';

interface PosSalesHistoryProps {
  session: PosSession;
  onNavigate?: (page: string) => void;
}

const paymentMethods = ['All', 'Cash', 'EcoCash', 'Swipe', 'Bank Transfer', 'Split Payment'];
const deliveryStatuses = ['All', 'Out for Delivery', 'Assigned', 'Waiting Collection', 'Pending Assignment', 'Failed', 'Not Linked'];
const returnStatuses = ['All', 'Completed', 'Refunded', 'Partially Refunded', 'Voided', 'Fiscal Pending'];

export default function PosSalesHistory({ session, onNavigate }: PosSalesHistoryProps) {
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    receiptNumber: '',
    customer: '',
    cashier: '',
    branch: '',
    terminal: '',
    paymentMethod: 'All',
    deliveryStatus: 'All',
    returnStatus: 'All'
  });
  const [notice, setNotice] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<DeliveryRequest[]>([]);

  useEffect(() => {
    getDeliveryRequests({}).then(setDeliveries).catch(() => setDeliveries([]));
  }, []);

  const deliveryByReceipt = useMemo(() => {
    return new Map(deliveries.map((delivery) => [delivery.receiptNumber, delivery]));
  }, [deliveries]);

  const rows = useMemo(() => {
    return mockReceiptRecords.filter((receipt) => {
      const deliveryStatus = deliveryByReceipt.get(receipt.receiptNumber)?.deliveryStatus || 'Not Linked';
      const receiptDate = receipt.businessDate || receipt.dateTime.slice(0, 10);
      return (
        (!filters.dateFrom || receiptDate >= filters.dateFrom) &&
        (!filters.dateTo || receiptDate <= filters.dateTo) &&
        receipt.receiptNumber.toLowerCase().includes(filters.receiptNumber.toLowerCase()) &&
        receipt.customer.customerName.toLowerCase().includes(filters.customer.toLowerCase()) &&
        receipt.cashier.toLowerCase().includes(filters.cashier.toLowerCase()) &&
        receipt.branch.toLowerCase().includes(filters.branch.toLowerCase()) &&
        receipt.terminal.toLowerCase().includes(filters.terminal.toLowerCase()) &&
        (filters.paymentMethod === 'All' || receipt.paymentMode === filters.paymentMethod) &&
        (filters.deliveryStatus === 'All' || deliveryStatus === filters.deliveryStatus) &&
        (filters.returnStatus === 'All' || receipt.status === filters.returnStatus)
      );
    });
  }, [deliveryByReceipt, filters]);

  const handleAction = (permission: Parameters<typeof hasPermission>[1], label: string, receipt?: ReceiptRecord, delivery?: DeliveryRequest) => {
    if (!hasPermission(session.role as Role, permission)) {
      setNotice('You do not have permission to perform this action.');
      return;
    }
    if (label === 'CAT Form' && receipt) {
      const customer = receipt.customer.customerId
        ? `${receipt.customer.customerName} (${receipt.customer.customerId}) | Phone: ${receipt.customer.customerPhone || 'No phone'} | Tax: ${receipt.customer.customerTaxNo || 'No tax number'} | Address: ${receipt.customer.deliveryAddress || receipt.customer.customerAddress || 'No address'}`
        : `Walk-in Customer | Phone: ${receipt.customer.customerPhone || 'No phone captured'} | Tax: ${receipt.customer.customerTaxNo || 'No tax number'}`;
      const deliveryDetails = delivery
        ? ` Delivery tab: ${delivery.deliveryNumber} | ${delivery.deliveryMethod} | ${delivery.deliveryAddress} | Provider/Driver: ${delivery.providerName || delivery.driverName || 'Pending'} | Status: ${delivery.deliveryStatus} | Tracking: ${delivery.trackingStatus} | Code: ${delivery.confirmationStatus} | Cash: ${delivery.cashStatus} | Cash To Collect: USD ${delivery.cashToCollect.toFixed(2)} | Delivered: ${delivery.deliveredAt || 'Pending'} | Failure: ${delivery.failureReason || 'None'}.`
        : ' Delivery tab: Walk-in / no linked delivery request.';
      setNotice(`CAT Form Customer tab placeholder: ${customer}.${deliveryDetails}`);
      return;
    }
    setNotice(`${label} is a build-development placeholder.`);
  };

  return (
    <div className="space-y-5 text-xs industrial-font-sans">
      <div className="bg-white border border-[#b1b5c2] p-4 flex flex-col lg:flex-row lg:items-end justify-between gap-3">
        <div>
          <div className="text-[10px] text-orange-600 font-black uppercase tracking-wider flex items-center gap-2">
            <Search className="w-4 h-4" />
            iTred Commerce POS
          </div>
          <h2 className="text-xl font-black text-[#1e222b] uppercase mt-1">Sales History</h2>
          <p className="text-[11px] text-slate-600 font-bold uppercase mt-1">
            Receipt Search, Review, Returns, Credit Notes, and Transaction Audit
          </p>
        </div>
        <div className="text-[10px] text-slate-500 font-bold uppercase">Mode: Build Development</div>
      </div>

      {notice && (
        <div className="bg-orange-50 border border-orange-300 text-orange-900 px-3 py-2 font-bold uppercase">
          {notice}
        </div>
      )}

      <div className="bg-white border border-[#b1b5c2] p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3">
          <HistoryField label="Date From" type="date" value={filters.dateFrom} onChange={(value) => setFilters({ ...filters, dateFrom: value })} />
          <HistoryField label="Date To" type="date" value={filters.dateTo} onChange={(value) => setFilters({ ...filters, dateTo: value })} />
          <HistoryField label="Receipt Number" value={filters.receiptNumber} onChange={(value) => setFilters({ ...filters, receiptNumber: value })} />
          <HistoryField label="Customer" value={filters.customer} onChange={(value) => setFilters({ ...filters, customer: value })} />
          <HistoryField label="Cashier" value={filters.cashier} onChange={(value) => setFilters({ ...filters, cashier: value })} />
          <HistoryField label="Branch" value={filters.branch} onChange={(value) => setFilters({ ...filters, branch: value })} />
          <HistoryField label="Terminal" value={filters.terminal} onChange={(value) => setFilters({ ...filters, terminal: value })} />
          <HistorySelect label="Payment Method" value={filters.paymentMethod} options={paymentMethods} onChange={(value) => setFilters({ ...filters, paymentMethod: value })} />
          <HistorySelect label="Delivery Status" value={filters.deliveryStatus} options={deliveryStatuses} onChange={(value) => setFilters({ ...filters, deliveryStatus: value })} />
          <HistorySelect label="Return Status" value={filters.returnStatus} options={returnStatuses} onChange={(value) => setFilters({ ...filters, returnStatus: value })} />
        </div>
      </div>

      <div className="bg-white border border-[#b1b5c2] overflow-x-auto">
        <table className="w-full min-w-[1100px] text-left">
          <thead className="bg-[#1e222b] text-white">
            <tr>
              {['Receipt', 'Date', 'Customer', 'Cashier', 'Branch', 'Terminal', 'Payment', 'Delivery Method', 'Delivery Status', 'Cash Status', 'Code Status', 'Receipt Status', 'Total', 'Action'].map((heading) => (
                <th key={heading} className="px-3 py-2 text-[10px] uppercase font-black">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((receipt) => (
              <HistoryRow
                key={receipt.id}
                receipt={receipt}
                delivery={deliveryByReceipt.get(receipt.receiptNumber)}
                onAction={handleAction}
                onOpenCustomerCentre={() => onNavigate?.('CUSTOMER_CENTRE')}
                onOpenDelivery={() => onNavigate?.('DELIVERY')}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HistoryRow({
  receipt,
  delivery,
  onAction,
  onOpenCustomerCentre,
  onOpenDelivery
}: {
  key?: string;
  receipt: ReceiptRecord;
  delivery?: DeliveryRequest;
  onAction: (permission: Parameters<typeof hasPermission>[1], label: string, receipt?: ReceiptRecord, delivery?: DeliveryRequest) => void;
  onOpenCustomerCentre: () => void;
  onOpenDelivery: () => void;
}) {
  return (
    <tr className="border-t border-[#d6d9e0] text-[11px] text-slate-700">
      <td className="px-3 py-2 font-black text-[#1e222b]">{receipt.receiptNumber}</td>
      <td className="px-3 py-2">{receipt.businessDate}</td>
      <td className="px-3 py-2">{receipt.customer.customerName}</td>
      <td className="px-3 py-2">{receipt.cashier}</td>
      <td className="px-3 py-2">{receipt.branch}</td>
      <td className="px-3 py-2">{receipt.terminal}</td>
      <td className="px-3 py-2">{receipt.paymentMode}</td>
      <td className="px-3 py-2">{delivery?.deliveryMethod || 'No Delivery'}</td>
      <td className="px-3 py-2">{delivery?.deliveryStatus || 'Not Linked'}</td>
      <td className="px-3 py-2">{delivery?.cashStatus || 'Not Required'}</td>
      <td className="px-3 py-2">{delivery?.confirmationStatus || 'Code Pending'}</td>
      <td className="px-3 py-2">{receipt.status}</td>
      <td className="px-3 py-2 font-black">USD {receipt.grandTotal.toFixed(2)}</td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap gap-1.5">
          <HistoryButton icon={Eye} label="View Receipt" onClick={() => onAction('sales.viewHistory', 'View Receipt', receipt)} />
          <HistoryButton icon={Eye} label="Open Delivery" onClick={onOpenDelivery} />
          <HistoryButton icon={FileText} label="Open CAT Form Placeholder" onClick={() => onAction('sales.viewHistory', 'CAT Form', receipt, delivery)} />
          <HistoryButton icon={Eye} label="Open Customer Centre" onClick={onOpenCustomerCentre} />
          <HistoryButton icon={RotateCcw} label="Request Return Placeholder" onClick={() => onAction('returns.request', 'Return Request', receipt)} />
          <HistoryButton icon={Undo2} label="Request Credit Note Placeholder" onClick={() => onAction('creditNotes.request', 'Credit Note Request', receipt)} />
        </div>
      </td>
    </tr>
  );
}

function HistoryButton({ icon: Icon, label, onClick }: { icon: typeof Eye; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="border border-[#b1b5c2] bg-white hover:bg-orange-50 px-2 py-1 text-[9px] font-black uppercase flex items-center gap-1">
      <Icon className="w-3 h-3 text-orange-600" />
      {label}
    </button>
  );
}

function HistoryField({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="space-y-1">
      <span className="block text-[9px] text-slate-500 font-black uppercase">{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="w-full border border-[#b1b5c2] px-2.5 py-2 text-[11px] font-bold" />
    </label>
  );
}

function HistorySelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="space-y-1">
      <span className="block text-[9px] text-slate-500 font-black uppercase">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full border border-[#b1b5c2] px-2.5 py-2 text-[11px] font-bold">
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}
