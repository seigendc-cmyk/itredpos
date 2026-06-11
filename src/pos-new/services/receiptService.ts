import {
  FiscalizationPlaceholderRecord,
  FiscalizationStatus,
  PaymentMode,
  ReceiptAuditEvent,
  ReceiptAuditEventType,
  ReceiptFormat,
  ReceiptLine,
  ReceiptPaymentLine,
  ReceiptPrintPreview,
  ReceiptRecord,
  ReceiptSequenceControl,
  ReceiptStatus,
  Sale,
  VATMode
} from '../types/posTypes';
import {
  mockFiscalizationPlaceholderRecords,
  mockReceiptAuditEvents,
  mockReceiptLines,
  mockReceiptPayments,
  mockReceiptRecords,
  mockReceiptReprintAudits,
  mockReceiptSequenceControls
} from '../mock/mockPosData';
import { calculateReceiptTaxSummary } from '../utils/taxUtils';

export interface ReceiptFilters {
  vendorId?: string;
  branch?: string;
  terminal?: string;
  cashier?: string;
  customer?: string;
  receiptNumber?: string;
  paymentMode?: PaymentMode | 'All';
  receiptStatus?: ReceiptStatus | 'All';
  fiscalizationStatus?: FiscalizationStatus | 'All';
  dateFrom?: string;
  dateTo?: string;
}

export interface ReceiptSalePayload {
  sale: Sale;
  vendorId: string;
  businessVendor: string;
  branchId: string;
  branch: string;
  terminalId: string;
  terminal: string;
  cashierId: string;
  cashier: string;
  customerName?: string;
  paymentMode: PaymentMode;
  vatMode?: VATMode;
  vatRate?: number;
}

const RECEIPTS_KEY = 'itred_pos_receipts_v1';
const LINES_KEY = 'itred_pos_receipt_lines_v1';
const PAYMENTS_KEY = 'itred_pos_receipt_payments_v1';
const SEQUENCE_KEY = 'itred_pos_receipt_sequence_v1';
const FISCAL_KEY = 'itred_pos_fiscal_placeholder_v1';
const AUDIT_KEY = 'itred_pos_receipt_audit_v1';

function readList<T>(key: string, fallback: T[]): T[] {
  const raw = localStorage.getItem(key);
  if (!raw) {
    localStorage.setItem(key, JSON.stringify(fallback));
    return fallback;
  }

  try {
    return JSON.parse(raw) as T[];
  } catch {
    localStorage.setItem(key, JSON.stringify(fallback));
    return fallback;
  }
}

function saveList<T>(key: string, value: T[]): T[] {
  localStorage.setItem(key, JSON.stringify(value));
  return value;
}

function addAudit(eventType: ReceiptAuditEventType, receiptNumber: string, message: string, operator = 'Admin User'): ReceiptAuditEvent[] {
  const current = readList<ReceiptAuditEvent>(AUDIT_KEY, mockReceiptAuditEvents);
  const next: ReceiptAuditEvent = {
    id: `RAE-${Math.floor(10000 + Math.random() * 90000)}`,
    timestamp: new Date().toISOString(),
    eventType,
    receiptNumber,
    message,
    operator
  };
  return saveList(AUDIT_KEY, [next, ...current].slice(0, 60));
}

function branchMatch(rowBranch: string, branch?: string): boolean {
  return !branch || branch === 'All Branches' || rowBranch === branch;
}

function terminalMatch(rowTerminal: string, terminal?: string): boolean {
  return !terminal || terminal === 'All Terminals' || rowTerminal === terminal;
}

function cashierMatch(rowCashier: string, cashier?: string): boolean {
  return !cashier || cashier === 'All Staff' || rowCashier === cashier;
}

export async function getReceipts(filters: ReceiptFilters): Promise<ReceiptRecord[]> {
  return readList<ReceiptRecord>(RECEIPTS_KEY, mockReceiptRecords).filter((receipt) =>
    branchMatch(receipt.branch, filters.branch) &&
    terminalMatch(receipt.terminal, filters.terminal) &&
    cashierMatch(receipt.cashier, filters.cashier) &&
    (!filters.customer || receipt.customer.customerName.toLowerCase().includes(filters.customer.toLowerCase())) &&
    (!filters.receiptNumber || receipt.receiptNumber.toLowerCase().includes(filters.receiptNumber.toLowerCase())) &&
    (!filters.paymentMode || filters.paymentMode === 'All' || receipt.paymentMode === filters.paymentMode) &&
    (!filters.receiptStatus || filters.receiptStatus === 'All' || receipt.status === filters.receiptStatus) &&
    (!filters.fiscalizationStatus || filters.fiscalizationStatus === 'All' || receipt.fiscalizationStatus === filters.fiscalizationStatus)
  );
}

export async function getReceiptByNumber(receiptNumber: string): Promise<ReceiptRecord | undefined> {
  return readList<ReceiptRecord>(RECEIPTS_KEY, mockReceiptRecords).find((receipt) => receipt.receiptNumber === receiptNumber);
}

export async function generateReceiptNumber(branchId: string, terminalId: string): Promise<string> {
  const sequenceRows = readList<ReceiptSequenceControl>(SEQUENCE_KEY, mockReceiptSequenceControls);
  const sequence = sequenceRows.find((row) => row.terminal === terminalId || row.terminal === branchId) || sequenceRows[0];
  const nextNumber = Number(sequence.nextReceiptNo.replace(/\D/g, '')) || mockReceiptRecords.length + 1;
  return `${sequence.prefix}-${String(nextNumber).padStart(4, '0')}`;
}

export async function createReceiptFromSale(payload: ReceiptSalePayload): Promise<ReceiptRecord> {
  const receiptNumber = await generateReceiptNumber(payload.branchId, payload.terminal);
  const now = payload.sale.date || new Date().toISOString();
  const lines: ReceiptLine[] = payload.sale.items.map((item, index) => ({
    id: `RL-${receiptNumber}-${index + 1}`,
    receiptNumber,
    productId: item.productId,
    sku: item.code,
    productName: item.name,
    quantity: item.quantity,
    unitPrice: item.price,
    discountAmount: 0,
    lineNetAmount: item.total,
    vatAmount: payload.vatMode === 'Not VAT Registered' ? 0 : item.total * ((payload.vatRate || 15) / 100),
    lineTotal: item.total
  }));
  const taxSummary = calculateReceiptTaxSummary(lines, payload.vatMode || 'Inclusive', payload.vatRate || 15);
  const receipt: ReceiptRecord = {
    id: `REC-${receiptNumber}`,
    receiptNumber,
    vendorId: payload.vendorId,
    businessVendor: payload.businessVendor,
    branchId: payload.branchId,
    branch: payload.branch,
    terminalId: payload.terminalId,
    terminal: payload.terminal,
    cashierId: payload.cashierId,
    cashier: payload.cashier,
    businessDate: now.slice(0, 10),
    dateTime: now,
    customer: { customerName: payload.customerName || 'Walk-in Customer' },
    businessDetails: {
      businessName: payload.businessVendor,
      tradingName: payload.businessVendor,
      vendorId: payload.vendorId,
      branch: payload.branch,
      address: payload.branch === 'Bulawayo Branch' ? '4 Plumtree Road, Bulawayo' : '12 Enterprise Road, Harare',
      phone: '+263 242 000 100',
      whatsApp: '+263 77 000 0100',
      vatNumber: 'VAT-ZW-82190B',
      vatRegistered: payload.vatMode !== 'Not VAT Registered',
      footerMessage: 'Thank you for shopping with Demo Vendor.'
    },
    subtotal: payload.sale.subtotal,
    discountTotal: payload.sale.discount,
    vatTotal: taxSummary.vatAmount,
    grandTotal: payload.sale.total,
    paymentMode: payload.paymentMode,
    status: 'Completed',
    fiscalizationStatus: 'Disabled In Development',
    fiscalReferencePlaceholder: `FISC-DEV-${receiptNumber}`,
    reprintCount: 0,
    offlineQueued: false,
    createdByStaffId: payload.cashierId,
    createdAt: now,
    updatedAt: now
  };

  saveList(RECEIPTS_KEY, [receipt, ...readList<ReceiptRecord>(RECEIPTS_KEY, mockReceiptRecords)]);
  saveList(LINES_KEY, [...lines, ...readList<ReceiptLine>(LINES_KEY, mockReceiptLines)]);
  saveList(PAYMENTS_KEY, [
    {
      id: `RP-${receiptNumber}`,
      receiptNumber,
      paymentMode: payload.paymentMode,
      amount: payload.sale.total,
      reference: `${payload.paymentMode}-${payload.terminal}`,
      confirmed: true
    },
    ...readList<ReceiptPaymentLine>(PAYMENTS_KEY, mockReceiptPayments)
  ]);
  addAudit('RECEIPT_CREATED', receiptNumber, `Receipt ${receiptNumber} created from completed sale.`, payload.cashier);
  return receipt;
}

export async function getReceiptPreview(receiptNumber: string, format: ReceiptFormat): Promise<ReceiptPrintPreview | undefined> {
  const receipt = await getReceiptByNumber(receiptNumber);
  if (!receipt) return undefined;
  const lines = readList<ReceiptLine>(LINES_KEY, mockReceiptLines).filter((line) => line.receiptNumber === receiptNumber);
  const payments = readList<ReceiptPaymentLine>(PAYMENTS_KEY, mockReceiptPayments).filter((payment) => payment.receiptNumber === receiptNumber);
  return {
    receipt,
    lines,
    payments,
    taxSummary: calculateReceiptTaxSummary(lines, receipt.businessDetails.vatRegistered ? 'Inclusive' : 'Not VAT Registered', 15),
    format,
    isReprint: receipt.reprintCount > 0 || receipt.status === 'Reprinted'
  };
}

export async function reprintReceiptPlaceholder(receiptNumber: string, staffId: string, reason: string): Promise<ReceiptAuditEvent[]> {
  const receipts = readList<ReceiptRecord>(RECEIPTS_KEY, mockReceiptRecords).map((receipt) =>
    receipt.receiptNumber === receiptNumber
      ? { ...receipt, status: 'Reprinted' as const, reprintCount: receipt.reprintCount + 1, updatedAt: new Date().toISOString() }
      : receipt
  );
  saveList(RECEIPTS_KEY, receipts);
  return addAudit('RECEIPT_REPRINTED', receiptNumber, `Receipt reprint placeholder recorded: ${reason}`, staffId);
}

export async function voidReceiptPlaceholder(receiptNumber: string, staffId: string, reason: string): Promise<ReceiptAuditEvent[]> {
  saveList(RECEIPTS_KEY, readList<ReceiptRecord>(RECEIPTS_KEY, mockReceiptRecords).map((receipt) =>
    receipt.receiptNumber === receiptNumber ? { ...receipt, status: 'Voided', voidReference: `VOID-${receiptNumber}`, updatedAt: new Date().toISOString() } : receipt
  ));
  return addAudit('RECEIPT_VOIDED', receiptNumber, `Void placeholder recorded: ${reason}`, staffId);
}

export async function refundReceiptPlaceholder(receiptNumber: string, staffId: string, reason: string): Promise<ReceiptAuditEvent[]> {
  saveList(RECEIPTS_KEY, readList<ReceiptRecord>(RECEIPTS_KEY, mockReceiptRecords).map((receipt) =>
    receipt.receiptNumber === receiptNumber ? { ...receipt, status: 'Partially Refunded', refundReference: `REF-${receiptNumber}`, updatedAt: new Date().toISOString() } : receipt
  ));
  return addAudit('RECEIPT_REFUNDED', receiptNumber, `Refund placeholder recorded: ${reason}`, staffId);
}

export async function getReceiptSequenceControl(filters: ReceiptFilters): Promise<ReceiptSequenceControl[]> {
  return readList<ReceiptSequenceControl>(SEQUENCE_KEY, mockReceiptSequenceControls).filter((row) =>
    branchMatch(row.branch, filters.branch) && terminalMatch(row.terminal, filters.terminal)
  );
}

export async function runReceiptSequenceCheck(filters: ReceiptFilters): Promise<ReceiptSequenceControl[]> {
  const rows = await getReceiptSequenceControl(filters);
  addAudit('RECEIPT_SEQUENCE_CHECKED', rows[0]?.lastReceiptNo || 'ALL', 'Receipt sequence check run.');
  if (rows.some((row) => row.gapCount > 0)) {
    addAudit('RECEIPT_GAP_DETECTED', rows[0]?.lastReceiptNo || 'ALL', 'Receipt gap warning detected.');
  }
  if (rows.some((row) => row.duplicateRisk === 'High' || row.sequenceStatus === 'Duplicate Risk')) {
    addAudit('DUPLICATE_RECEIPT_RISK', rows[0]?.lastReceiptNo || 'ALL', 'Duplicate receipt risk detected.');
  }
  return rows;
}

export async function queueFiscalizationPlaceholder(receiptNumber: string): Promise<ReceiptAuditEvent[]> {
  const fiscalRows = readList<FiscalizationPlaceholderRecord>(FISCAL_KEY, mockFiscalizationPlaceholderRecords);
  const exists = fiscalRows.some((row) => row.receiptNumber === receiptNumber);
  if (!exists) {
    saveList(FISCAL_KEY, [
      {
        id: `FISC-${Math.floor(10000 + Math.random() * 90000)}`,
        receiptNumber,
        dateTime: new Date().toISOString(),
        branch: 'Harare Main',
        terminal: 'POS-01',
        fiscalStatus: 'Queued',
        fiscalReferencePlaceholder: `FISC-DEV-${receiptNumber}`,
        queueStatus: 'Queued'
      },
      ...fiscalRows
    ]);
  }
  return addAudit('FISCALIZATION_QUEUED', receiptNumber, 'Fiscalization placeholder queued.');
}

export async function getFiscalizationPlaceholderStatus(receiptNumber?: string): Promise<FiscalizationPlaceholderRecord[]> {
  const rows = readList<FiscalizationPlaceholderRecord>(FISCAL_KEY, mockFiscalizationPlaceholderRecords);
  return receiptNumber ? rows.filter((row) => row.receiptNumber === receiptNumber) : rows;
}

export async function exportReceiptPlaceholder(receiptNumber: string, format: ReceiptFormat): Promise<{ message: string; activity: ReceiptAuditEvent[] }> {
  const activity = addAudit(format === 'PDF Placeholder' ? 'RECEIPT_PDF_EXPORT_PREPARED' : 'RECEIPT_PRINTED', receiptNumber, `${format} receipt export placeholder prepared.`);
  return { message: `${format} receipt export placeholder prepared.`, activity };
}

export async function getReceiptReprintAudits(): Promise<typeof mockReceiptReprintAudits> {
  return mockReceiptReprintAudits;
}

export async function getReceiptAuditEvents(): Promise<ReceiptAuditEvent[]> {
  return readList<ReceiptAuditEvent>(AUDIT_KEY, mockReceiptAuditEvents);
}
