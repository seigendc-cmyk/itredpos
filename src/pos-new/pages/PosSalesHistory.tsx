import {
  CopyPlus,
  Download,
  Eye,
  FileText,
  MessageCircle,
  Printer,
  ReceiptText,
  RotateCcw,
  Search,
  ShieldCheck,
  Truck,
  WalletCards,
  X
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import RowActionMenu, { RowActionMenuItem } from '../components/RowActionMenu';
import ReceiptOutputModal from '../components/ReceiptOutputModal';
import ReceiptPrintDocument from '../components/ReceiptPrintDocument';
import { mockReceiptLines, mockReceiptPayments, mockReceiptRecords } from '../mock/mockPosData';
import type { SalesRecordDetails } from '../repositories/SalesRepository';
import type { RepositoryOperationContext } from '../repositories/repositoryContext';
import { getDeliveryRequests } from '../services/deliveryService';
import { formatReceiptCurrency, getActiveReceiptBlueprint, prepareReceiptWhatsAppMessage } from '../services/receiptService';
import { getCommittedSaleDetails, listCommittedSales, refundSaleCommand, subscribeCommittedSales, voidSaleCommand } from '../services/salesTransactionService';
import { DeliveryRequest, PaymentMode, PosSession, ReceiptLine, ReceiptPaymentLine, ReceiptPrintPreview, ReceiptRecord, Role } from '../types';
import { hasPermission, PermissionKey } from '../utils/posPermissions';
import { matchesFreeOrderSearch } from '../utils/searchUtils';
import { seedRows } from '../utils/vendorDataMode';

interface PosSalesHistoryProps {
  session: PosSession;
  onNavigate?: (page: string) => void;
}

type DetailModal = 'CAT' | 'Payment' | 'Delivery' | 'CreditNote' | null;
type ReturnAction = 'Draft' | 'Approval';

const paymentMethods = ['All', 'Cash', 'EcoCash', 'Swipe', 'Bank Transfer', 'Split Payment'];
const deliveryStatuses = ['All', 'Out for Delivery', 'Assigned', 'Waiting Collection', 'Pending Assignment', 'Failed', 'Not Linked'];
const returnStatuses = ['All', 'Completed', 'Refunded', 'Partially Refunded', 'Voided', 'Fiscal Pending'];

type RepositoryReceiptRecord = ReceiptRecord & { repositoryLines?: ReceiptLine[]; repositoryPayments?: ReceiptPaymentLine[]; repositoryRefundedQuantities?: Record<string, number> };

function makeReceiptPreview(receipt: ReceiptRecord): ReceiptPrintPreview {
  const repositoryReceipt = receipt as RepositoryReceiptRecord;
  const lines = repositoryReceipt.repositoryLines || seedRows(mockReceiptLines).filter((line) => line.receiptNumber === receipt.receiptNumber);
  const payments = repositoryReceipt.repositoryPayments || seedRows(mockReceiptPayments).filter((payment) => payment.receiptNumber === receipt.receiptNumber);
  const blueprint = getActiveReceiptBlueprint();
  return {
    receipt,
    lines,
    payments,
    taxSummary: {
      receiptNumber: receipt.receiptNumber,
      vatMode: receipt.businessDetails.vatRegistered ? 'Inclusive' : 'Not VAT Registered',
      vatRate: receipt.subtotal > 0 ? Number(((receipt.vatTotal / receipt.subtotal) * 100).toFixed(2)) : 0,
      taxableAmount: receipt.subtotal,
      vatAmount: receipt.vatTotal,
      nonTaxableAmount: 0,
      taxLabel: receipt.businessDetails.vatRegistered ? 'VAT' : 'No VAT'
    },
    format: blueprint.layout || 'Receipt Roll',
    blueprint,
    isReprint: receipt.reprintCount > 0
  };
}

function receiptLines(receipt: ReceiptRecord): ReceiptLine[] {
  return (receipt as RepositoryReceiptRecord).repositoryLines || seedRows(mockReceiptLines).filter((line) => line.receiptNumber === receipt.receiptNumber);
}

function paymentMode(details: SalesRecordDetails): PaymentMode {
  if (details.payments.length > 1) return 'Split Payment';
  const method = details.payments[0]?.paymentMethod;
  if (method === 'Mobile Money') return 'EcoCash';
  if (method === 'Card') return 'Swipe';
  if (method === 'Credit') return 'Credit Sale';
  if (method === 'Bank Transfer' || method === 'Cash') return method;
  return 'Split Payment';
}

function toReceiptRecord(details: SalesRecordDetails, session: PosSession): RepositoryReceiptRecord {
  const { sale } = details;
  const receiptNumber = sale.receiptNumber || sale.saleNumber;
  const mode = paymentMode(details);
  return {
    id: sale.saleId,
    saleId: sale.saleId,
    receiptNumber,
    vendorId: sale.vendorId,
    businessVendor: session.vendor || sale.vendorId,
    branchId: sale.branchId,
    branch: session.branch || sale.branchId,
    terminalId: sale.terminalId,
    terminal: session.terminal || sale.terminalId,
    cashierId: sale.staffId,
    cashier: sale.staffName,
    businessDate: sale.saleDate.slice(0, 10),
    dateTime: sale.saleDate,
    customer: { customerId: sale.customerId === 'WALK-IN' ? undefined : sale.customerId, customerName: sale.customerName },
    businessDetails: { businessName: session.vendor || sale.vendorId, tradingName: session.vendor || sale.vendorId, vendorId: sale.vendorId, branch: session.branch || sale.branchId, address: '', phone: '', whatsApp: '', vatRegistered: sale.vatTotal > 0, footerMessage: '' },
    subtotal: sale.subtotal,
    discountTotal: sale.discountTotal,
    vatTotal: sale.vatTotal,
    grandTotal: sale.grandTotal,
    paymentMode: mode,
    status: sale.saleStatus === 'Voided' ? 'Voided' : sale.saleStatus === 'Returned' ? 'Refunded' : sale.saleStatus === 'Partially Returned' ? 'Partially Refunded' : 'Completed',
    fiscalizationStatus: 'Not Required',
    reprintCount: 0,
    offlineQueued: sale.postingStatus === 'PendingSync',
    createdByStaffId: sale.staffId,
    createdAt: sale.createdAt,
    updatedAt: sale.updatedAt,
    repositoryLines: details.saleLines.map((line) => ({ id: line.saleLineId, receiptNumber, productId: line.productId, sku: line.sku, productName: line.productName, quantity: line.quantity, unitPrice: line.unitPrice, discountAmount: line.discountAmount, lineNetAmount: line.taxableAmount, vatAmount: line.vatAmount, lineTotal: line.lineTotal })),
    repositoryPayments: details.payments.map((payment) => ({ id: payment.paymentId, receiptNumber, paymentMode: mode, amount: payment.amount, reference: payment.reference, confirmed: true }))
    , repositoryRefundedQuantities: sale.refundedQuantities || {}
  };
}

export default function PosSalesHistory({ session, onNavigate }: PosSalesHistoryProps) {
  const role = session.role as Role;
  const [filters, setFilters] = useState({
    search: '',
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
  const [openMenuReceipt, setOpenMenuReceipt] = useState<string | null>(null);
  const [receiptOutputPreview, setReceiptOutputPreview] = useState<ReceiptPrintPreview | null>(null);
  const [printPreview, setPrintPreview] = useState<ReceiptPrintPreview | null>(null);
  const [printInstruction, setPrintInstruction] = useState('');
  const [detailReceipt, setDetailReceipt] = useState<ReceiptRecord | null>(null);
  const [detailModal, setDetailModal] = useState<DetailModal>(null);
  const [returnReceipt, setReturnReceipt] = useState<ReceiptRecord | null>(null);
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [returnReason, setReturnReason] = useState('Customer return request');
  const [returnNotes, setReturnNotes] = useState('');
  const [returnRestock, setReturnRestock] = useState(false);
  const [returnCondition, setReturnCondition] = useState('Good');
  const [reviewedReceipts, setReviewedReceipts] = useState<Set<string>>(new Set());
  const [whatsAppReceipt, setWhatsAppReceipt] = useState<ReceiptRecord | null>(null);
  const [whatsAppPhone, setWhatsAppPhone] = useState('');
  const [, setActivityEvents] = useState<string[]>([]);
  const [committedReceipts, setCommittedReceipts] = useState<RepositoryReceiptRecord[]>([]);
  const [salesLoading, setSalesLoading] = useState(import.meta.env.VITE_STORAGE_MODE === 'firebase');
  const [salesError, setSalesError] = useState<string | null>(null);
  const [reversalSaving, setReversalSaving] = useState(false);
  const [reversalSuccess, setReversalSuccess] = useState<string | null>(null);
  const [reversalError, setReversalError] = useState<string | null>(null);
  const refundAttemptRef = useRef<{ fingerprint: string; idempotencyKey: string } | null>(null);
  const salesContext = useMemo<RepositoryOperationContext>(() => ({
    vendorId: session.vendorId || '',
    branchId: session.branchId,
    warehouseId: session.warehouseId,
    terminalId: session.terminalId,
    staffId: session.staffId,
    actorId: session.staffId || session.staffName || 'POS',
    actorRole: session.role,
    sourceApp: 'ITRED_POS',
    correlationId: `sales-history-${session.vendorId || 'missing'}-${session.staffId || 'staff'}`
  }), [session.vendorId, session.branchId, session.warehouseId, session.terminalId, session.staffId, session.staffName, session.role]);

  useEffect(() => {
    getDeliveryRequests({}).then(setDeliveries).catch(() => setDeliveries([]));
  }, []);

  useEffect(() => {
    if (import.meta.env.VITE_STORAGE_MODE !== 'firebase') { setSalesLoading(false); return undefined; }
    let active = true;
    if (!salesContext.vendorId) { setSalesError('Missing vendor context. Sign in again.'); setSalesLoading(false); return undefined; }
    const loadDetails = async (saleIds: string[]) => {
      setSalesLoading(true);
      try {
        const details = await Promise.all(saleIds.map((saleId) => getCommittedSaleDetails(salesContext, saleId)));
        if (active) { setCommittedReceipts(details.map((row) => toReceiptRecord(row, session))); setSalesError(null); }
      } catch (reason) {
        if (active) setSalesError(reason instanceof Error ? reason.message : 'Sales history could not be loaded.');
      } finally {
        if (active) setSalesLoading(false);
      }
    };
    void listCommittedSales(salesContext).then((rows) => loadDetails(rows.map((row) => row.saleId))).catch((reason) => {
      if (active) { setSalesError(reason instanceof Error ? reason.message : 'Sales history could not be loaded.'); setSalesLoading(false); }
    });
    const subscription = subscribeCommittedSales(salesContext, (rows) => { if (active) void loadDetails(rows.map((row) => row.saleId)); });
    return () => { active = false; subscription.unsubscribe(); };
  }, [salesContext, session]);

  const deliveryByReceipt = useMemo(() => {
    return new Map(deliveries.map((delivery) => [delivery.receiptNumber, delivery]));
  }, [deliveries]);

  const can = (permission: PermissionKey) => hasPermission(role, permission);

  const recordEvent = (eventType: string, message: string) => {
    setActivityEvents((current) => [`${new Date().toLocaleTimeString()} ${eventType}: ${message}`, ...current].slice(0, 20));
  };

  const rows = useMemo(() => {
    const sourceRows = import.meta.env.VITE_STORAGE_MODE === 'firebase' ? committedReceipts : seedRows(mockReceiptRecords);
    return sourceRows.filter((receipt) => {
      const delivery = deliveryByReceipt.get(receipt.receiptNumber);
      const deliveryStatus = delivery?.deliveryStatus || 'Not Linked';
      const receiptDate = receipt.businessDate || receipt.dateTime.slice(0, 10);
      const lines = receiptLines(receipt);
      const baseMatches = (
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
      if (!baseMatches) return false;
      if (!filters.search.trim()) return true;
      return matchesFreeOrderSearch({
        ...receipt,
        phone: receipt.customer.customerPhone || receipt.customer.customerWhatsApp || '',
        deliveryStatus,
        deliveryMethod: delivery?.deliveryMethod || 'No Delivery',
        itemNames: lines.map((line) => line.productName).join(' '),
        skus: lines.map((line) => line.sku).join(' '),
        taxAmount: receipt.vatTotal,
        totalAmount: receipt.grandTotal
      }, filters.search, [
        'receiptNumber',
        'businessDate',
        'cashier',
        'branch',
        'terminal',
        'paymentMode',
        'status',
        'phone',
        'deliveryStatus',
        'deliveryMethod',
        'itemNames',
        'skus',
        'taxAmount',
        'totalAmount',
        (row) => row.customer.customerName
      ]);
    });
  }, [committedReceipts, deliveryByReceipt, filters]);

  const requirePermission = (permission: PermissionKey, action: string): boolean => {
    if (can(permission)) return true;
    setNotice(`Permission required for ${action}.`);
    return false;
  };

  const openReceipt = (receipt: ReceiptRecord) => {
    if (!requirePermission('sales.viewHistory', 'View Receipt')) return;
    setReceiptOutputPreview(makeReceiptPreview(receipt));
    setNotice(`${receipt.receiptNumber} opened read-only.`);
    recordEvent('SALES_HISTORY_RECEIPT_VIEWED', `${receipt.receiptNumber} opened.`);
  };

  const openDetail = (receipt: ReceiptRecord, modal: DetailModal) => {
    setDetailReceipt(receipt);
    setDetailModal(modal);
  };

  const startPrint = (receipt: ReceiptRecord, pdf = false) => {
    if (!requirePermission(pdf ? 'receipt.pdf' : 'sales.reprintReceipt', pdf ? 'Save Receipt as PDF' : 'Print Receipt')) return;
    setPrintPreview(makeReceiptPreview(receipt));
    setPrintInstruction(pdf ? 'Choose "Save as PDF" in your device print dialog.' : '');
    setNotice(pdf ? 'Choose "Save as PDF" in your device print dialog.' : `${receipt.receiptNumber} print view prepared.`);
    recordEvent(pdf ? 'SALES_HISTORY_RECEIPT_PDF_PREPARED' : 'SALES_HISTORY_RECEIPT_PRINTED', `${receipt.receiptNumber} print path prepared.`);
    window.setTimeout(() => window.print(), 80);
  };

  const openWhatsApp = (receipt: ReceiptRecord, phone?: string) => {
    if (!requirePermission('receipt.whatsappShare', 'Send Receipt via WhatsApp')) return;
    const targetPhone = (phone || receipt.customer.customerWhatsApp || receipt.customer.customerPhone || '').replace(/[^\d]/g, '');
    if (!targetPhone) {
      setWhatsAppReceipt(receipt);
      setWhatsAppPhone('');
      return;
    }
    window.open(`https://wa.me/${targetPhone}?text=${encodeURIComponent(prepareReceiptWhatsAppMessage(receipt, targetPhone))}`, '_blank', 'noopener,noreferrer');
    setNotice(`WhatsApp share prepared for ${receipt.receiptNumber}.`);
    recordEvent('SALES_HISTORY_RECEIPT_WHATSAPP_PREPARED', `${receipt.receiptNumber} WhatsApp link prepared.`);
    setWhatsAppReceipt(null);
  };

  const startReturn = (receipt: ReceiptRecord) => {
    if (!requirePermission('sales.return', 'Sales Return')) return;
    setReturnReceipt(receipt);
    setReturnQuantities({});
    setReturnReason('Customer return request');
    setReturnNotes('');
    setReturnRestock(false);
    setReturnCondition('Good');
    recordEvent('SALES_RETURN_STARTED', `${receipt.receiptNumber} return started.`);
  };

  const finishReturn = async (action: ReturnAction) => {
    if (!returnReceipt || reversalSaving) return;
    const selectedTotal = Object.keys(returnQuantities).reduce((sum, lineId) => sum + (returnQuantities[lineId] || 0), 0);
    if (selectedTotal <= 0) {
      setNotice('Select at least one return quantity.');
      return;
    }
    if (!returnReason.trim()) { setReversalError('A refund reason is required.'); return; }
    if (action === 'Draft' && import.meta.env.VITE_STORAGE_MODE !== 'firebase') {
      setNotice(`Return draft created locally for ${returnReceipt.receiptNumber}.`);
      recordEvent('SALES_RETURN_DRAFT_CREATED', `${returnReceipt.receiptNumber} return draft created.`);
      setReturnReceipt(null);
      return;
    }
    const saleId = returnReceipt.saleId || returnReceipt.id;
    const lines = Object.entries(returnQuantities).filter(([, quantity]) => quantity > 0).map(([saleLineId, quantity]) => ({ saleLineId, quantity }));
    const fingerprint = JSON.stringify({ saleId, lines, reason: returnReason.trim(), notes: returnNotes.trim() });
    if (!refundAttemptRef.current || refundAttemptRef.current.fingerprint !== fingerprint) refundAttemptRef.current = { fingerprint, idempotencyKey: `refund-${saleId}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}` };
    setReversalSaving(true);
    setReversalError(null);
    setReversalSuccess(null);
    try {
      const result = await refundSaleCommand(salesContext, { saleId, idempotencyKey: refundAttemptRef.current.idempotencyKey, lines, reason: returnReason.trim(), notes: [returnNotes.trim(), `Condition: ${returnCondition}`].filter(Boolean).join(' | ') });
      const message = result.duplicate ? `Refund ${result.reversalId} was already posted.` : `Refund posted for ${returnReceipt.receiptNumber}.`;
      setNotice(message);
      setReversalSuccess(message);
      recordEvent('SALE_REFUNDED', message);
      setReturnReceipt(null);
    } catch (reason) {
      setReversalError(reason instanceof Error ? reason.message : 'Refund could not be posted.');
    } finally {
      setReversalSaving(false);
    }
  };

  const handleVoidSale = async (receipt: ReceiptRecord) => {
    if (reversalSaving || !requirePermission('sales.void', 'Void Sale')) return;
    const reason = window.prompt(`Reason for voiding ${receipt.receiptNumber}?`);
    if (!reason?.trim()) return;
    setReversalSaving(true);
    setReversalError(null);
    setReversalSuccess(null);
    try {
      const result = await voidSaleCommand(salesContext, receipt.saleId || receipt.id, reason.trim());
      const message = result.duplicate ? `${receipt.receiptNumber} was already voided.` : `${receipt.receiptNumber} voided without deleting the original sale.`;
      setNotice(message);
      setReversalSuccess(message);
      recordEvent('SALE_VOIDED', message);
    } catch (error) {
      setReversalError(error instanceof Error ? error.message : 'Sale could not be voided.');
    } finally {
      setReversalSaving(false);
    }
  };

  const createCreditNote = (receipt: ReceiptRecord) => {
    if (!requirePermission('sales.creditNote', 'Create Credit Note')) return;
    openDetail(receipt, 'CreditNote');
    setNotice(`Credit note draft created locally for ${receipt.receiptNumber}.`);
    recordEvent('CREDIT_NOTE_DRAFT_CREATED', `${receipt.receiptNumber} credit note draft created.`);
  };

  const duplicateReceipt = (receipt: ReceiptRecord) => {
    if (!requirePermission('sales.duplicateReceipt', 'Duplicate as New Sale')) return;
    if (!window.confirm(`Duplicate ${receipt.receiptNumber} into a new local sale draft?`)) return;
    setNotice(`${receipt.receiptNumber} duplicated into a local new-sale draft. Original receipt was not changed.`);
    recordEvent('SALES_RECEIPT_DUPLICATED_TO_CART', `${receipt.receiptNumber} duplicated locally.`);
  };

  const markReviewed = (receipt: ReceiptRecord) => {
    if (!requirePermission('audit.view', 'Mark Reviewed')) return;
    setReviewedReceipts((current) => new Set(current).add(receipt.receiptNumber));
    setNotice(`${receipt.receiptNumber} marked reviewed locally.`);
    recordEvent('SALES_HISTORY_ROW_REVIEWED', `${receipt.receiptNumber} reviewed.`);
  };

  const exportRow = (receipt: ReceiptRecord) => {
    if (!requirePermission('reports.export', 'Export Row')) return;
    const csv = [
      ['Receipt', 'Date', 'Customer', 'Cashier', 'Terminal', 'Payment', 'Tax', 'Total', 'Status'].join(','),
      [receipt.receiptNumber, receipt.dateTime, receipt.customer.customerName, receipt.cashier, receipt.terminal, receipt.paymentMode, receipt.vatTotal, receipt.grandTotal, receipt.status].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')
    ].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${receipt.receiptNumber}-sales-history-row.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice(`${receipt.receiptNumber} CSV row exported locally.`);
    recordEvent('SALES_HISTORY_ROW_EXPORTED', `${receipt.receiptNumber} exported.`);
  };

  const menuItemsFor = (receipt: ReceiptRecord, delivery?: DeliveryRequest): RowActionMenuItem[] => [
    { label: 'View Receipt', icon: <Eye size={14} />, onClick: () => openReceipt(receipt), disabled: !can('sales.viewHistory') },
    { label: 'Open CAT Form', icon: <FileText size={14} />, onClick: () => { openDetail(receipt, 'CAT'); recordEvent('SALES_HISTORY_CAT_OPENED', `${receipt.receiptNumber} CAT opened.`); }, disabled: !can('sales.viewHistory') },
    { label: 'Print Receipt', icon: <Printer size={14} />, onClick: () => startPrint(receipt), disabled: !can('sales.reprintReceipt') },
    { label: 'Save Receipt as PDF', icon: <Download size={14} />, onClick: () => startPrint(receipt, true), disabled: !can('receipt.pdf') },
    { label: 'Send Receipt via WhatsApp', icon: <MessageCircle size={14} />, onClick: () => openWhatsApp(receipt), disabled: !can('receipt.whatsappShare') },
    { label: 'Sales Return', icon: <RotateCcw size={14} />, onClick: () => startReturn(receipt), disabled: !can('sales.return') },
    { label: 'Void Sale', icon: <X size={14} />, onClick: () => void handleVoidSale(receipt), disabled: !can('sales.void') || receipt.status !== 'Completed' || reversalSaving, danger: true },
    { label: 'Create Credit Note', icon: <FileText size={14} />, onClick: () => createCreditNote(receipt), disabled: !can('sales.creditNote') },
    { label: 'Duplicate as New Sale', icon: <CopyPlus size={14} />, onClick: () => duplicateReceipt(receipt), disabled: !can('sales.duplicateReceipt') },
    { label: 'View Payment Detail', icon: <WalletCards size={14} />, onClick: () => openDetail(receipt, 'Payment'), disabled: !can('sales.paymentDetail.view') },
    { label: 'View Delivery Detail', icon: <Truck size={14} />, onClick: () => openDetail(receipt, 'Delivery'), disabled: !can('delivery.view') || !delivery },
    { label: 'Mark Reviewed', icon: <ShieldCheck size={14} />, onClick: () => markReviewed(receipt), disabled: !can('audit.view') },
    { label: 'Export Row', icon: <Download size={14} />, onClick: () => exportRow(receipt), disabled: !can('reports.export') }
  ];

  return (
    <div className="sales-history-page industrial-font-sans">
      <div className="sales-history-hero">
        <div>
          <div className="sales-history-kicker">
            <Search className="w-4 h-4" />
            iTred Commerce POS
          </div>
          <h2>Sales History</h2>
          <p>Receipt Search, Review, Returns, Credit Notes, and Transaction Audit</p>
        </div>
        <div className="sales-history-mode">Receipt Review</div>
      </div>

      {notice && (
        <div className="sales-history-notice" role="status">
          {notice}
        </div>
      )}
      {salesLoading && <div className="sales-history-notice" role="status">Loading committed sales…</div>}
      {salesError && <div className="sci-pos-error" role="alert">{salesError}</div>}
      {reversalSaving && <div className="sales-history-notice" role="status">Posting sale reversal…</div>}
      {reversalSuccess && <div className="sales-history-notice" role="status">{reversalSuccess}</div>}
      {reversalError && <div className="sci-pos-error" role="alert">{reversalError}</div>}

      <div className="sales-history-filter-card">
        <div className="sales-history-filter-grid">
          <HistoryField label="Any Order Search" value={filters.search} onChange={(value) => setFilters({ ...filters, search: value })} />
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

      <section className="sales-history-card">
        <div className="sales-history-card-header">
          <strong>{rows.length} receipt(s)</strong>
          <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => onNavigate?.('SALES')}>
            Sales Returns Desk
          </button>
        </div>
        <div className="sales-history-table-scroll pos-custom-scroll">
          <table className="sales-history-table">
            <thead>
              <tr>
                {['Receipt No.', 'Date/Time', 'Customer', 'Cashier', 'Terminal', 'Items', 'Payment', 'Tax', 'Total', 'Status', 'Action'].map((heading) => (
                  <th key={heading}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((receipt) => {
                const delivery = deliveryByReceipt.get(receipt.receiptNumber);
                const lines = receiptLines(receipt);
                return (
                  <tr key={receipt.id} className={reviewedReceipts.has(receipt.receiptNumber) ? 'sales-history-reviewed-row' : undefined}>
                    <td><strong title={receipt.receiptNumber}>{receipt.receiptNumber}</strong></td>
                    <td title={new Date(receipt.dateTime).toLocaleString()}>{new Date(receipt.dateTime).toLocaleString()}</td>
                    <td title={`${receipt.customer.customerName} ${receipt.customer.customerPhone || ''}`}>{receipt.customer.customerName}<span>{receipt.customer.customerPhone || 'No phone'}</span></td>
                    <td title={receipt.cashier}>{receipt.cashier}</td>
                    <td title={`${receipt.terminal} | ${receipt.branch}`}>{receipt.terminal}<span>{receipt.branch}</span></td>
                    <td title={lines.map((line) => `${line.sku} ${line.productName}`).join(', ')}>{lines.length} line(s)<span>{lines[0]?.sku || '-'}</span></td>
                    <td title={receipt.paymentMode}>{receipt.paymentMode}<span>{delivery?.cashStatus || 'Payment captured'}</span></td>
                    <td>{formatReceiptCurrency(receipt.vatTotal)}</td>
                    <td><strong>{formatReceiptCurrency(receipt.grandTotal)}</strong></td>
                    <td title={`${receipt.status} | ${delivery?.deliveryStatus || 'Not Linked'}`}>{receipt.status}<span>{delivery?.deliveryStatus || 'Not Linked'}</span></td>
                    <td>
                      <RowActionMenu
                        ariaLabel={`Sales history actions for ${receipt.receiptNumber}`}
                        open={openMenuReceipt === receipt.receiptNumber}
                        onOpenChange={(open) => {
                          setOpenMenuReceipt(open ? receipt.receiptNumber : null);
                          if (open) recordEvent('SALES_HISTORY_ACTION_MENU_OPENED', `${receipt.receiptNumber} action menu opened.`);
                        }}
                        items={menuItemsFor(receipt, delivery)}
                      />
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={11} className="sales-history-empty">No sales completed yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {printPreview && <ReceiptPrintDocument preview={printPreview} instruction={printInstruction} />}
      <ReceiptOutputModal
        preview={receiptOutputPreview}
        canPrint={can('sales.reprintReceipt')}
        canPdf={can('receipt.pdf')}
        canWhatsApp={can('receipt.whatsappShare')}
        onClose={() => setReceiptOutputPreview(null)}
        onOpenSalesHistory={() => setReceiptOutputPreview(null)}
        onActivity={recordEvent}
      />
      <DetailModalView
        modal={detailModal}
        receipt={detailReceipt}
        delivery={detailReceipt ? deliveryByReceipt.get(detailReceipt.receiptNumber) : undefined}
        onClose={() => { setDetailModal(null); setDetailReceipt(null); }}
      />
      <ReturnModal
        receipt={returnReceipt}
        quantities={returnQuantities}
        reason={returnReason}
        notes={returnNotes}
        restock={returnRestock}
        condition={returnCondition}
        saving={reversalSaving}
        onQuantityChange={(lineId, value) => setReturnQuantities((current) => ({ ...current, [lineId]: value }))}
        onReasonChange={setReturnReason}
        onNotesChange={setReturnNotes}
        onRestockChange={setReturnRestock}
        onConditionChange={setReturnCondition}
        onCreateDraft={() => finishReturn('Draft')}
        onSubmitApproval={() => finishReturn('Approval')}
        onClose={() => setReturnReceipt(null)}
      />
      {whatsAppReceipt && (
        <div className="sales-history-modal-backdrop" onClick={() => setWhatsAppReceipt(null)}>
          <section className="sales-history-modal sales-history-modal--sm" onClick={(event) => event.stopPropagation()}>
            <ModalHeader title="WhatsApp Number" subtitle={whatsAppReceipt.receiptNumber} onClose={() => setWhatsAppReceipt(null)} />
            <div className="sales-history-modal-body">
              <HistoryField label="WhatsApp Number" value={whatsAppPhone} onChange={setWhatsAppPhone} />
            </div>
            <footer className="sales-history-modal-actions">
              <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={() => openWhatsApp(whatsAppReceipt, whatsAppPhone)}>Open WhatsApp</button>
              <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => setWhatsAppReceipt(null)}>Cancel</button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}

function DetailModalView({ modal, receipt, delivery, onClose }: { modal: DetailModal; receipt: ReceiptRecord | null; delivery?: DeliveryRequest; onClose: () => void }) {
  if (!modal || !receipt) return null;
  const lines = receiptLines(receipt);
  const payments = seedRows(mockReceiptPayments).filter((payment) => payment.receiptNumber === receipt.receiptNumber);
  const title = modal === 'CAT' ? 'CAT Form Audit' : modal === 'Payment' ? 'Payment Detail' : modal === 'Delivery' ? 'Delivery Detail' : 'Credit Note Review';
  return (
    <div className="sales-history-modal-backdrop" onClick={onClose}>
      <section className="sales-history-modal" onClick={(event) => event.stopPropagation()}>
        <ModalHeader title={title} subtitle={receipt.receiptNumber} onClose={onClose} />
        <div className="sales-history-modal-body">
          <div className="sales-history-detail-grid">
            <Detail label="Customer" value={receipt.customer.customerName} />
            <Detail label="Date / Time" value={new Date(receipt.dateTime).toLocaleString()} />
            <Detail label="Cashier" value={receipt.cashier} />
            <Detail label="Terminal" value={receipt.terminal} />
            <Detail label="Subtotal" value={formatReceiptCurrency(receipt.subtotal)} />
            <Detail label="VAT / Tax" value={formatReceiptCurrency(receipt.vatTotal)} />
            <Detail label="Discount" value={formatReceiptCurrency(receipt.discountTotal)} />
            <Detail label="Total" value={formatReceiptCurrency(receipt.grandTotal)} />
            <Detail label="Receipt Status" value={receipt.status} />
            <Detail label="Fiscal Placeholder" value={receipt.fiscalReferencePlaceholder || 'Not prepared'} />
            <Detail label="Delivery" value={delivery ? `${delivery.deliveryMethod} | ${delivery.deliveryStatus}` : 'No linked delivery'} />
            <Detail label="Delivery Address" value={delivery?.deliveryAddress || receipt.customer.deliveryAddress || 'No address'} />
          </div>
          <div className="sales-history-modal-table-wrap">
            <table className="sales-history-modal-table">
              <thead><tr><th>SKU</th><th>Item</th><th>Qty</th><th>Line Total</th></tr></thead>
              <tbody>{lines.map((line) => <tr key={line.id}><td>{line.sku}</td><td>{line.productName}</td><td>{line.quantity}</td><td>{formatReceiptCurrency(line.lineTotal)}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="sales-history-detail-grid">
            {payments.map((payment) => (
              <div key={payment.id}>
                <span>{payment.paymentMode}</span>
                <strong>{formatReceiptCurrency(payment.amount)} | {payment.reference || 'No reference'} | {payment.confirmed ? 'Confirmed' : 'Pending'}</strong>
              </div>
            ))}
          </div>
          {modal === 'CreditNote' && <div className="sales-history-local-note">Credit note draft prepared for review. No accounting, cashbook, or refund posting was created.</div>}
          {modal === 'CAT' && <div className="sales-history-local-note">CAT audit view is read-only and combines receipt, tax, payment, inventory line, delivery, and audit details.</div>}
        </div>
        <footer className="sales-history-modal-actions">
          <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={onClose}>Close</button>
        </footer>
      </section>
    </div>
  );
}

function ReturnModal({
  receipt,
  quantities,
  reason,
  notes,
  restock,
  condition,
  saving,
  onQuantityChange,
  onReasonChange,
  onNotesChange,
  onRestockChange,
  onConditionChange,
  onCreateDraft,
  onSubmitApproval,
  onClose
}: {
  receipt: ReceiptRecord | null;
  quantities: Record<string, number>;
  reason: string;
  notes: string;
  restock: boolean;
  condition: string;
  saving: boolean;
  onQuantityChange: (lineId: string, value: number) => void;
  onReasonChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onRestockChange: (value: boolean) => void;
  onConditionChange: (value: string) => void;
  onCreateDraft: () => void;
  onSubmitApproval: () => void;
  onClose: () => void;
}) {
  if (!receipt) return null;
  const lines = receiptLines(receipt);
  return (
    <div className="sales-history-modal-backdrop" onClick={onClose}>
      <section className="sales-history-modal" onClick={(event) => event.stopPropagation()}>
        <ModalHeader title="Sales Return" subtitle={`${receipt.receiptNumber} | ${receipt.customer.customerName}`} onClose={onClose} />
        <div className="sales-history-modal-body">
          <div className="sales-history-detail-grid">
            <Detail label="Receipt Number" value={receipt.receiptNumber} />
            <Detail label="Sale Date" value={new Date(receipt.dateTime).toLocaleString()} />
            <Detail label="Customer" value={receipt.customer.customerName} />
            <Detail label="Refund Method" value="Original payment method reversal" />
          </div>
          <div className="sales-history-modal-table-wrap">
            <table className="sales-history-modal-table">
              <thead><tr><th>Select Line</th><th>Sold Qty</th><th>Return Qty</th><th>Reason</th></tr></thead>
              <tbody>{lines.map((line) => {
                const qty = quantities[line.id] || 0;
                const remainingQty = Math.max(0, line.quantity - Number((receipt as RepositoryReceiptRecord).repositoryRefundedQuantities?.[line.id] || 0));
                return (
                  <tr key={line.id}>
                    <td>{line.sku}<span>{line.productName}</span></td>
                    <td>{line.quantity}</td>
                    <td><input type="number" min={0} max={remainingQty} disabled={remainingQty === 0 || saving} value={qty} onChange={(event) => onQuantityChange(line.id, Math.min(remainingQty, Math.max(0, Number(event.target.value) || 0)))} /></td>
                    <td>{reason}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
          <div className="sales-history-return-form">
            <HistoryField label="Reason" value={reason} onChange={onReasonChange} />
            <HistorySelect label="Condition" value={condition} options={['Good', 'Damaged', 'Opened', 'Wrong Item', 'Other']} onChange={onConditionChange} />
            <label className="sales-history-checkbox"><input type="checkbox" checked={import.meta.env.VITE_STORAGE_MODE === 'firebase' ? true : restock} disabled={import.meta.env.VITE_STORAGE_MODE === 'firebase' || saving} onChange={(event) => onRestockChange(event.target.checked)} /> Return inventory to stock</label>
            <label><span>Notes</span><textarea rows={3} value={notes} onChange={(event) => onNotesChange(event.target.value)} /></label>
          </div>
        </div>
        <footer className="sales-history-modal-actions">
          {import.meta.env.VITE_STORAGE_MODE !== 'firebase' && <button type="button" className="sci-pos-button sci-pos-button--primary" disabled={saving} onClick={onCreateDraft}>Create Return Draft</button>}
          <button type="button" className="sci-pos-button sci-pos-button--primary" disabled={saving} onClick={onSubmitApproval}>{saving ? 'Posting Refund…' : import.meta.env.VITE_STORAGE_MODE === 'firebase' ? 'Post Refund' : 'Submit Return for Approval'}</button>
          <button type="button" className="sci-pos-button sci-pos-button--secondary" disabled={saving} onClick={onClose}>Cancel</button>
        </footer>
      </section>
    </div>
  );
}

function ModalHeader({ title, subtitle, onClose }: { title: string; subtitle: string; onClose: () => void }) {
  return (
    <header className="sales-history-modal-header">
      <div><h3>{title}</h3><span>{subtitle}</span></div>
      <button type="button" className="sci-pos-icon-button" onClick={onClose} aria-label="Close modal"><X size={16} /></button>
    </header>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function HistoryField({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="sales-history-field">
      <span>{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function HistorySelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="sales-history-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}
