import {
  GoodsReceivingActivityEvent,
  GoodsReceivingFilterState,
  GoodsReceivingLine,
  GoodsReceivingPostOptions,
  GoodsReceivingNote,
  GoodsReceivingPostingResult,
  GoodsReceivingStatus,
  POReceivingSummary,
  PurchaseOrder,
  PurchaseOrderActivityEvent,
  PurchaseOrderLine,
  ReceivingVarianceType
} from '../types';
import {
  mockGoodsReceivingActivityEvents,
  mockGoodsReceivingLines,
  mockGoodsReceivingNotes,
  mockPurchaseOrderActivityEvents,
  mockPurchaseOrderLines,
  mockPurchaseOrders
} from '../mock/mockPosData';
import { createOperationalApproval } from './approvalService';
import { receiveStock } from './inventorySyncService';
import { createSupplierBillFromGRN, createSupplierPayment, markSupplierPaymentPaid } from './creditorsService';
import { publishCommerceEvent, writeAuditLog, CommerceOperationContext } from '../../commerce-integration';
import { getVendorDocumentIdentity } from '../vendor/vendorBootstrapModel';
import { readVendorScopedList, writeVendorScopedList } from '../utils/vendorDataMode';
import { calculateDocumentTax, getCachedVendorTaxSettings } from './vendorTaxSettingsService';
import { recordSupplierAccountPayment, recordSupplierAccountPurchase } from './supplierAccountService';
import { assertCanonicalPurchaseSession, type CanonicalPurchaseSession } from './purchaseSessionService';

const GRN_KEY = 'itred_pos_goods_receiving_notes_v1';
const GRN_LINE_KEY = 'itred_pos_goods_receiving_lines_v1';
const GRN_ACTIVITY_KEY = 'itred_pos_goods_receiving_activity_v1';
const PO_KEY = 'itred_pos_purchase_orders_v1';
const PO_LINE_KEY = 'itred_pos_purchase_order_lines_v1';
const PO_ACTIVITY_KEY = 'itred_pos_purchase_order_activity_v1';

type GRNPatch = Partial<Omit<GoodsReceivingNote, 'grnId' | 'createdAt'>>;
type GRNLinePatch = Partial<Omit<GoodsReceivingLine, 'lineId' | 'grnId'>>;

function readList<T>(key: string, fallback: T[], isValid: (value: unknown) => boolean): T[] {
  const rows = readVendorScopedList<T>(key, fallback);
  return rows.every(isValid) ? rows : [];
}

function saveList<T>(key: string, value: T[]): T[] {
  return writeVendorScopedList(key, value);
}

function hasKeys(...keys: string[]) {
  return (value: unknown) => Boolean(value && typeof value === 'object' && keys.every((key) => key in value));
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function safeId(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '_');
}

function nextGRNNumber(notes: GoodsReceivingNote[]): string {
  const highest = notes.reduce((max, note) => {
    const match = note.grnNumber.match(/GRN-(\d+)/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `GRN-${String(highest + 1).padStart(4, '0')}`;
}

function getPOs(): PurchaseOrder[] {
  return readList<PurchaseOrder>(PO_KEY, mockPurchaseOrders, hasKeys('poId', 'poNumber'));
}

function savePOs(orders: PurchaseOrder[]): PurchaseOrder[] {
  return saveList(PO_KEY, orders);
}

function getPOLines(): PurchaseOrderLine[] {
  return readList<PurchaseOrderLine>(PO_LINE_KEY, mockPurchaseOrderLines, hasKeys('lineId', 'poId'));
}

function savePOLines(lines: PurchaseOrderLine[]): PurchaseOrderLine[] {
  return saveList(PO_LINE_KEY, lines);
}

function getGRNs(): GoodsReceivingNote[] {
  return readList<GoodsReceivingNote>(GRN_KEY, mockGoodsReceivingNotes, hasKeys('grnId', 'grnNumber'));
}

function saveGRNs(notes: GoodsReceivingNote[]): GoodsReceivingNote[] {
  return saveList(GRN_KEY, notes);
}

function getGRNLines(): GoodsReceivingLine[] {
  return readList<GoodsReceivingLine>(GRN_LINE_KEY, mockGoodsReceivingLines, hasKeys('lineId', 'grnId'));
}

function saveGRNLines(lines: GoodsReceivingLine[]): GoodsReceivingLine[] {
  return saveList(GRN_LINE_KEY, lines);
}

function postedLinesForPO(poId: string): GoodsReceivingLine[] {
  const postedGrnIds = new Set(getGRNs()
    .filter((note) => note.poId === poId && (note.receivingStatus === 'Posted' || note.receivingStatus === 'Partially Posted'))
    .map((note) => note.grnId));
  return getGRNLines().filter((line) => line.poId === poId && postedGrnIds.has(line.grnId) && !line.removeFromCurrentGRN && line.lineStatus !== 'Not Supplied' && line.lineStatus !== 'Cancelled');
}

function postedAcceptedQtyByPOLine(poId: string): Map<string, number> {
  const totals = new Map<string, number>();
  postedLinesForPO(poId).forEach((line) => {
    if (!line.poLineId) return;
    totals.set(line.poLineId, (totals.get(line.poLineId) || 0) + Math.max(line.qtyAccepted, 0));
  });
  return totals;
}

function calculateLineStatus(line: GoodsReceivingLine): GoodsReceivingLine['lineStatus'] {
  if (line.removeFromCurrentGRN) return 'Removed From GRN';
  if (line.markUnavailableFromSupplier || line.qtyReceivedNow === 0) return 'Not Supplied';
  if (line.qtyAccepted + line.qtyRejected > line.qtyReceivedNow) return 'Variance Review';
  if (line.qtyReceivedNow > line.qtyOutstandingBeforeGRN) return 'Over Received';
  if (line.varianceType !== 'None') return line.qtyOutstandingAfterGRN > 0 ? 'Partially Received' : 'Received';
  return line.qtyOutstandingAfterGRN > 0 ? 'Partially Received' : 'Received';
}

export function calculateGRNVariance(line: GoodsReceivingLine): ReceivingVarianceType {
  if (line.markUnavailableFromSupplier || line.qtyReceivedNow < line.qtyOutstandingBeforeGRN) return 'Short';
  if (line.qtyReceivedNow > line.qtyOutstandingBeforeGRN) return 'Over';
  if (line.receivedUnitCost > line.previousCostPrice * 1.15) return 'Cost Increase';
  if (line.previousCostPrice > 0 && line.receivedUnitCost < line.previousCostPrice * 0.9) return 'Cost Decrease';
  if (line.qtyRejected > 0 || line.damagedReason) return 'Damaged';
  return 'None';
}

function normalizeLine(line: GoodsReceivingLine): GoodsReceivingLine {
  const qtyReceivedNow = Math.max(Number(line.qtyReceivedNow) || 0, 0);
  const qtyAccepted = Math.max(Number(line.qtyAccepted) || 0, 0);
  const qtyRejected = Math.max(Number(line.qtyRejected) || 0, 0);
  const varianceType = calculateGRNVariance({ ...line, qtyReceivedNow, qtyAccepted, qtyRejected });
  const qtyOutstandingAfterGRN = line.removeFromCurrentGRN || line.markUnavailableFromSupplier
    ? line.qtyOutstandingBeforeGRN
    : Math.max(line.qtyOutstandingBeforeGRN - qtyAccepted, 0);
  const normalized = {
    ...line,
    qtyReceivedNow,
    qtyAccepted,
    qtyRejected,
    qtyOutstandingAfterGRN,
    varianceType
  };
  return {
    ...normalized,
    goodsReceiptLineId: normalized.goodsReceiptLineId || normalized.lineId,
    goodsReceiptId: normalized.goodsReceiptId || normalized.grnId,
    purchaseOrderId: normalized.purchaseOrderId || normalized.poId,
    purchaseOrderLineId: normalized.purchaseOrderLineId || normalized.poLineId,
    quantityReceived: qtyReceivedNow,
    quantityAccepted: qtyAccepted,
    quantityRejected: qtyRejected,
    unitCost: normalized.receivedUnitCost,
    lineStatus: calculateLineStatus(normalized)
  };
}

function calculatePostedLineTax(note: GoodsReceivingNote, lines: GoodsReceivingLine[]) {
  const settings = {
    ...getCachedVendorTaxSettings(note.vendorId),
    pricesIncludeVat: getCachedVendorTaxSettings(note.vendorId).pricesIncludeVat
  };
  const tax = calculateDocumentTax(lines.map((line) => ({
    quantity: line.qtyAccepted,
    unitPrice: line.receivedUnitCost
  })), settings);
  const byLineId = new Map<string, { netUnitCost: number; vatRate: number; vatAmount: number; lineTotal: number }>();
  lines.forEach((line, index) => {
    const taxLine = tax.lines[index];
    const netUnitCost = line.qtyAccepted > 0 ? Number((taxLine.netAmount / line.qtyAccepted).toFixed(4)) : 0;
    byLineId.set(line.lineId, {
      netUnitCost,
      vatRate: taxLine.vatRate,
      vatAmount: taxLine.vatAmount,
      lineTotal: taxLine.total
    });
  });
  return { tax, byLineId };
}

function grnMovementId(note: GoodsReceivingNote, line: GoodsReceivingLine): string {
  return safeId(`${note.vendorId}_GOODS_RECEIPT_${note.grnId}_${line.lineId}_GOODS_RECEIVED`);
}

function duplicateSupplierDocumentExists(note: GoodsReceivingNote): boolean {
  const invoice = note.supplierInvoiceNumber.trim().toLowerCase();
  if (!invoice) return false;
  return getGRNs().some((item) => (
    item.grnId !== note.grnId
    && item.vendorId === note.vendorId
    && item.supplierId === note.supplierId
    && item.supplierInvoiceNumber.trim().toLowerCase() === invoice
    && !['Cancelled', 'Rejected', 'Reversed'].includes(item.receivingStatus)
  ));
}

async function recordActivity(input: Omit<GoodsReceivingActivityEvent, 'id' | 'createdAt'>): Promise<GoodsReceivingActivityEvent[]> {
  const events = readList<GoodsReceivingActivityEvent>(GRN_ACTIVITY_KEY, mockGoodsReceivingActivityEvents, hasKeys('id', 'eventType'));
  const nextEvent: GoodsReceivingActivityEvent = {
    ...input,
    id: makeId('GRN-ACT'),
    createdAt: nowIso()
  };
  return saveList(GRN_ACTIVITY_KEY, [nextEvent, ...events].slice(0, 160));
}

function recordPOActivity(order: PurchaseOrder, eventType: PurchaseOrderActivityEvent['eventType'], operator: string, message: string): void {
  const events = readList<PurchaseOrderActivityEvent>(PO_ACTIVITY_KEY, mockPurchaseOrderActivityEvents, hasKeys('id', 'eventType', 'poId'));
  const nextEvent: PurchaseOrderActivityEvent = {
    id: makeId('PO-ACT'),
    poId: order.poId,
    poNumber: order.poNumber,
    eventType,
    operator,
    message,
    createdAt: nowIso()
  };
  saveList(PO_ACTIVITY_KEY, [nextEvent, ...events].slice(0, 160));
}

function syncPOFromPostedGRNs(poId: string, operator: string): PurchaseOrder | null {
  const orders = getPOs();
  const order = orders.find((item) => item.poId === poId);
  if (!order) return null;
  const postedTotals = postedAcceptedQtyByPOLine(poId);
  const allPOLines = getPOLines();
  const poLines = allPOLines.filter((line) => line.poId === poId);
  const updatedLines = allPOLines.map((line) => {
    if (line.poId !== poId) return line;
    const qtyReceived = Math.min(postedTotals.get(line.lineId) || 0, line.qtyOrdered);
    const qtyOutstanding = Math.max(line.qtyOrdered - qtyReceived, 0);
    return {
      ...line,
      qtyReceived,
      qtyOutstanding,
      lineStatus: qtyOutstanding === 0 ? 'Fully Received' as const : qtyReceived > 0 ? 'Partially Received' as const : line.lineStatus
    };
  });
  savePOLines(updatedLines);

  const totalReceived = poLines.reduce((sum, line) => sum + Math.min(postedTotals.get(line.lineId) || 0, line.qtyOrdered), 0);
  const totalOrdered = poLines.reduce((sum, line) => sum + line.qtyOrdered, 0);
  const status = totalReceived <= 0
    ? order.status
    : totalReceived >= totalOrdered
      ? 'Fully Received'
      : 'Partially Received';
  const updatedOrder: PurchaseOrder = {
    ...order,
    status,
    approvalStatus: order.approvalStatus || 'Approved',
    postingStatus: status === 'Fully Received' ? 'Closed' : status === 'Partially Received' ? 'Partially Posted' : order.postingStatus || 'Not Posted',
    updatedAt: nowIso()
  };
  savePOs(orders.map((item) => item.poId === poId ? updatedOrder : item));

  if (status === 'Fully Received') {
    recordPOActivity(updatedOrder, 'PURCHASE_ORDER_FULLY_RECEIVED', operator, `${updatedOrder.poNumber} fully received from posted GRNs.`);
  } else if (status === 'Partially Received') {
    recordPOActivity(updatedOrder, 'PURCHASE_ORDER_PARTIALLY_RECEIVED', operator, `${updatedOrder.poNumber} partially received from posted GRNs and remains open.`);
  }
  return updatedOrder;
}

function matchesDate(value: string, from?: string, to?: string): boolean {
  if (from && value < from) return false;
  if (to && value > to) return false;
  return true;
}

export async function getGoodsReceivingNotes(filters: GoodsReceivingFilterState = {}): Promise<GoodsReceivingNote[]> {
  const notes = getGRNs();
  const lines = getGRNLines();
  return notes.filter((note) => {
    const noteLines = lines.filter((line) => line.grnId === note.grnId);
    const matchesVariance = !filters.varianceType || filters.varianceType === 'ALL' || noteLines.some((line) => line.varianceType === filters.varianceType);
    return (!filters.grnNumber || note.grnNumber.toLowerCase().includes(filters.grnNumber.toLowerCase()))
      && (!filters.poNumber || (note.poNumber || '').toLowerCase().includes(filters.poNumber.toLowerCase()))
      && (!filters.supplier || note.supplierName.toLowerCase().includes(filters.supplier.toLowerCase()))
      && (!filters.branch || filters.branch === 'ALL' || note.branchId === filters.branch)
      && (!filters.warehouse || filters.warehouse === 'ALL' || note.warehouseId === filters.warehouse)
      && (!filters.status || filters.status === 'ALL' || note.receivingStatus === filters.status)
      && (!filters.receivedBy || note.receivedByStaffName.toLowerCase().includes(filters.receivedBy.toLowerCase()))
      && matchesDate(note.receivedDate, filters.dateFrom, filters.dateTo)
      && matchesVariance;
  });
}

export async function getGoodsReceivingNoteById(grnId: string): Promise<GoodsReceivingNote | null> {
  return getGRNs().find((note) => note.grnId === grnId) || null;
}

export async function getGoodsReceivingLines(grnId: string): Promise<GoodsReceivingLine[]> {
  return getGRNLines().filter((line) => line.grnId === grnId);
}

export async function getPOReceivingSummary(poId: string): Promise<POReceivingSummary | null> {
  const order = getPOs().find((item) => item.poId === poId);
  if (!order) return null;
  const poLines = getPOLines().filter((line) => line.poId === poId);
  const postedTotals = postedAcceptedQtyByPOLine(poId);
  const notes = getGRNs().filter((note) => note.poId === poId);
  const lineStates = poLines.map((line) => {
    const qtyPostedReceived = Math.min(postedTotals.get(line.lineId) || 0, line.qtyOrdered);
    const qtyOutstanding = Math.max(line.qtyOrdered - qtyPostedReceived, 0);
    return {
      poLineId: line.lineId,
      productId: line.productId,
      sku: line.sku,
      productName: line.productName,
      qtyOrdered: line.qtyOrdered,
      qtyPostedReceived,
      qtyOutstanding,
      fulfillmentStatus: qtyOutstanding === 0 ? 'Fully Received' as const : qtyPostedReceived > 0 ? 'Partially Received' as const : 'Not Received' as const
    };
  });
  const totalOrderedQty = lineStates.reduce((sum, line) => sum + line.qtyOrdered, 0);
  const totalPostedReceivedQty = lineStates.reduce((sum, line) => sum + line.qtyPostedReceived, 0);
  const totalOutstandingQty = lineStates.reduce((sum, line) => sum + line.qtyOutstanding, 0);
  return {
    poId,
    poNumber: order.poNumber,
    supplierName: order.supplierName,
    fulfillmentStatus: order.status === 'Closed With Outstanding'
      ? 'Closed With Outstanding'
      : totalOutstandingQty === 0 && totalOrderedQty > 0
        ? 'Fully Received'
        : totalPostedReceivedQty > 0
          ? 'Partially Received'
          : 'Not Received',
    totalOrderedQty,
    totalPostedReceivedQty,
    totalOutstandingQty,
    postedGRNCount: notes.filter((note) => note.receivingStatus === 'Posted' || note.receivingStatus === 'Partially Posted').length,
    draftGRNCount: notes.filter((note) => note.receivingStatus === 'Draft' || note.receivingStatus === 'Pending Approval').length,
    lineStates
  };
}

export async function createGRNDraftFromPO(poId: string, staffId: string): Promise<GoodsReceivingNote | null> {
  const session = assertCanonicalPurchaseSession();
  const order = getPOs().find((item) => item.poId === poId);
  if (!order) return null;
  if (order.vendorId !== session.vendorId) return null;
  if (!['Approved', 'Sent To Supplier', 'Partially Received'].includes(order.status)) return null;
  const summary = await getPOReceivingSummary(poId);
  const outstandingLines = (summary?.lineStates || []).filter((line) => line.qtyOutstanding > 0);
  if (outstandingLines.length === 0) return null;

  const notes = getGRNs();
  const createdAt = nowIso();
  const grnId = makeId('GRN-ID');
  const note: GoodsReceivingNote = {
    grnId,
    goodsReceiptId: grnId,
    grnNumber: nextGRNNumber(notes),
    goodsReceiptNumber: nextGRNNumber(notes),
    vendorId: session.vendorId,
    poId: order.poId,
    poNumber: order.poNumber,
    branchId: session.branchId,
    warehouseId: session.warehouseId,
    supplierId: order.supplierId,
    supplierName: order.supplierName,
    receivedByStaffId: session.staffId || staffId,
    receivedByStaffName: session.staffName,
    receivedDate: createdAt.slice(0, 10),
    receivedAt: createdAt,
    supplierInvoiceNumber: '',
    supplierInvoiceDate: '',
    supplierInvoiceAmount: 0,
    deliveryNoteNumber: '',
    vehicleOrCourierReference: '',
    receivingStatus: 'Draft',
    status: 'Draft',
    postingStatus: 'Draft',
    approvalRequired: false,
    notes: 'Draft GRN created from outstanding PO lines. No stock is updated until posting.',
    createdAt,
    updatedAt: createdAt
  };

  const poLines = getPOLines();
  const newLines: GoodsReceivingLine[] = outstandingLines.map((state) => {
    const poLine = poLines.find((line) => line.lineId === state.poLineId);
    const base: GoodsReceivingLine = {
      lineId: makeId('GRN-LINE'),
      goodsReceiptLineId: '',
      grnId,
      goodsReceiptId: grnId,
      poId: order.poId,
      purchaseOrderId: order.poId,
      poLineId: state.poLineId,
      purchaseOrderLineId: state.poLineId,
      productId: state.productId,
      sku: state.sku,
      productName: state.productName,
      brand: poLine?.brand || '',
      manufacturer: poLine?.manufacturer || '',
      unitOfMeasure: poLine?.unitOfMeasure || 'pcs',
      qtyOrdered: state.qtyOrdered,
      qtyPreviouslyReceived: state.qtyPostedReceived,
      qtyOutstandingBeforeGRN: state.qtyOutstanding,
      qtyReceivedNow: state.qtyOutstanding,
      quantityReceived: state.qtyOutstanding,
      qtyAccepted: state.qtyOutstanding,
      quantityAccepted: state.qtyOutstanding,
      qtyRejected: 0,
      quantityRejected: 0,
      qtyOutstandingAfterGRN: 0,
      previousCostPrice: poLine?.lastCostPrice || poLine?.estimatedUnitCost || 0,
      receivedUnitCost: poLine?.estimatedUnitCost || 0,
      unitCost: poLine?.estimatedUnitCost || 0,
      vatRate: 0,
      vatAmount: 0,
      lineTotal: Number((state.qtyOutstanding * (poLine?.estimatedUnitCost || 0)).toFixed(2)),
      sellingPrice: poLine?.currentSellingPrice || 0,
      shelfLocation: poLine?.shelfLocation || '',
      varianceType: 'None',
      lineStatus: 'Pending',
      removeFromCurrentGRN: false,
      markUnavailableFromSupplier: false,
      notes: ''
    };
    return normalizeLine(base);
  });

  saveGRNs([note, ...notes]);
  saveGRNLines([...newLines, ...getGRNLines()]);
  await recordActivity({
    grnId,
    grnNumber: note.grnNumber,
    poId: order.poId,
    poNumber: order.poNumber,
    eventType: 'GRN_DRAFT_CREATED_FROM_PO',
    message: `${note.grnNumber} draft created from outstanding lines on ${order.poNumber}. Draft GRN does not update stock.`,
    operator: staffId
  });
  return note;
}

export async function updateGRNDraft(grnId: string, patch: GRNPatch): Promise<GoodsReceivingNote | null> {
  const notes = getGRNs();
  const note = notes.find((item) => item.grnId === grnId);
  if (!note || note.receivingStatus !== 'Draft') return null;
  const updated = { ...note, ...patch, grnId, receivingStatus: patch.receivingStatus || note.receivingStatus, updatedAt: nowIso() };
  saveGRNs(notes.map((item) => item.grnId === grnId ? updated : item));
  await recordActivity({
    grnId,
    grnNumber: updated.grnNumber,
    poId: updated.poId,
    poNumber: updated.poNumber,
    eventType: 'GRN_DRAFT_UPDATED',
    message: `${updated.grnNumber} draft updated. No stock updated.`,
    operator: updated.receivedByStaffName
  });
  return updated;
}

export async function updateGRNLine(grnId: string, lineId: string, patch: GRNLinePatch): Promise<GoodsReceivingLine | null> {
  const note = await getGoodsReceivingNoteById(grnId);
  if (!note || note.receivingStatus !== 'Draft') return null;
  const lines = getGRNLines();
  const line = lines.find((item) => item.grnId === grnId && item.lineId === lineId);
  if (!line) return null;
  const updated = normalizeLine({ ...line, ...patch, lineId, grnId });
  saveGRNLines(lines.map((item) => item.lineId === lineId ? updated : item));
  await recordActivity({
    grnId,
    grnNumber: note.grnNumber,
    poId: note.poId,
    poNumber: note.poNumber,
    eventType: 'GRN_LINE_UPDATED',
    message: `${updated.sku} receiving line updated.`,
    operator: note.receivedByStaffName
  });
  return updated;
}

export async function removeLineFromCurrentGRN(grnId: string, lineId: string, reason: string): Promise<GoodsReceivingLine | null> {
  const line = await updateGRNLine(grnId, lineId, {
    qtyReceivedNow: 0,
    qtyAccepted: 0,
    qtyRejected: 0,
    removeFromCurrentGRN: true,
    lineStatus: 'Removed From GRN',
    notes: reason
  });
  const note = await getGoodsReceivingNoteById(grnId);
  if (line && note) {
    await recordActivity({
      grnId,
      grnNumber: note.grnNumber,
      poId: note.poId,
      poNumber: note.poNumber,
      eventType: 'GRN_LINE_REMOVED_FROM_CURRENT_RECEIVING',
      message: `${line.sku} removed from current GRN. PO outstanding quantity remains unchanged.`,
      operator: note.receivedByStaffName
    });
  }
  return line;
}

export async function markLineNotSupplied(grnId: string, lineId: string, reason: string): Promise<GoodsReceivingLine | null> {
  const line = await updateGRNLine(grnId, lineId, {
    qtyReceivedNow: 0,
    qtyAccepted: 0,
    qtyRejected: 0,
    markUnavailableFromSupplier: true,
    lineStatus: 'Not Supplied',
    varianceType: 'Short',
    notes: reason
  });
  const note = await getGoodsReceivingNoteById(grnId);
  if (line && note) {
    await recordActivity({
      grnId,
      grnNumber: note.grnNumber,
      poId: note.poId,
      poNumber: note.poNumber,
      eventType: 'GRN_LINE_MARKED_NOT_SUPPLIED',
      message: `${line.sku} marked not supplied. PO outstanding quantity remains unchanged.`,
      operator: note.receivedByStaffName
    });
  }
  return line;
}

export async function validateGRNBeforePost(grnId: string, options: { allowMissingSupplierInvoice?: boolean } = {}): Promise<{ valid: boolean; approvalRequired: boolean; errors: string[]; warnings: string[] }> {
  const note = await getGoodsReceivingNoteById(grnId);
  const lines = await getGoodsReceivingLines(grnId);
  const errors: string[] = [];
  const warnings: string[] = [];
  let approvalRequired = false;

  if (!note) errors.push('GRN not found.');
  if (note && !note.supplierInvoiceNumber.trim()) {
    warnings.push('Supplier invoice number is missing.');
    approvalRequired = !options.allowMissingSupplierInvoice;
    await recordActivity({ grnId, grnNumber: note.grnNumber, poId: note.poId, poNumber: note.poNumber, eventType: 'GRN_SUPPLIER_INVOICE_MISSING', message: 'Supplier invoice missing before posting.', operator: note.receivedByStaffName });
  }
  if (note && duplicateSupplierDocumentExists(note)) {
    errors.push('Duplicate supplier invoice number for this supplier.');
  }

  lines.forEach((line) => {
    if (line.qtyReceivedNow < 0) errors.push(`${line.sku}: received quantity cannot be negative.`);
    if (line.qtyAccepted + line.qtyRejected > line.qtyReceivedNow) errors.push(`${line.sku}: accepted + rejected cannot exceed received now.`);
    if (line.qtyReceivedNow > line.qtyOutstandingBeforeGRN) {
      warnings.push(`${line.sku}: over receiving flagged.`);
      approvalRequired = true;
    }
    if (line.receivedUnitCost > line.previousCostPrice * 1.15) {
      warnings.push(`${line.sku}: cost increase above 15 percent requires approval.`);
      approvalRequired = true;
    }
    if (!line.shelfLocation.trim() && line.qtyAccepted > 0) warnings.push(`${line.sku}: shelf location missing.`);
    if (line.qtyRejected > 0 || line.damagedReason) warnings.push(`${line.sku}: damaged/rejected quantity recorded.`);
    if (!line.poLineId) {
      warnings.push(`${line.sku}: unordered item requires approval.`);
      approvalRequired = true;
    }
  });

  return { valid: errors.length === 0, approvalRequired, errors, warnings };
}

export async function submitGRNForApproval(grnId: string): Promise<GoodsReceivingNote | null> {
  const session = assertCanonicalPurchaseSession();
  const note = await getGoodsReceivingNoteById(grnId);
  if (!note || note.receivingStatus !== 'Draft') return null;
  if (note.vendorId !== session.vendorId) return null;
  const validation = await validateGRNBeforePost(grnId);
  if (!validation.valid) return null;
  const notes = getGRNs();
  const updated = { ...note, receivingStatus: 'Pending Approval' as const, status: 'Pending Approval' as const, postingStatus: 'Pending' as const, approvalRequired: true, updatedAt: nowIso() };
  saveGRNs(notes.map((item) => item.grnId === grnId ? updated : item));
  await createOperationalApproval({
    vendorId: note.vendorId,
    branchId: note.branchId,
    branch: note.branchId,
    category: 'Goods Receiving',
    requestedBy: session.staffName,
    requestedByRole: normalizeOperationalRole(session.role),
    relatedRecord: note.grnNumber,
    amountOrValue: `${note.supplierInvoiceAmount.toFixed(2)} invoice reference`,
    risk: 'High',
    reason: 'Goods Receiving variance approval required.',
    context: `${note.grnNumber} has receiving variances. Draft/pending GRNs do not update stock.`,
    requiredPermission: 'approvals.approve'
  });
  await recordActivity({ grnId, grnNumber: note.grnNumber, poId: note.poId, poNumber: note.poNumber, eventType: 'GRN_SUBMITTED_FOR_APPROVAL', message: `${note.grnNumber} submitted for approval. Stock not updated.`, operator: session.staffName });
  return updated;
}

export async function approveGRN(grnId: string, staffId: string, notesText = ''): Promise<GoodsReceivingNote | null> {
  const session = assertCanonicalPurchaseSession();
  const notes = getGRNs();
  const note = notes.find((item) => item.grnId === grnId);
  if (!note || note.receivingStatus !== 'Pending Approval') return null;
  if (note.vendorId !== session.vendorId) return null;
  const updated = { ...note, receivingStatus: 'Draft' as const, status: 'Draft' as const, postingStatus: 'Draft' as const, approvedByStaffId: session.staffId || staffId, approvedByStaffName: session.staffName, approvalRequired: false, notes: `${note.notes}\nApproval note: ${notesText}`.trim(), updatedAt: nowIso() };
  saveGRNs(notes.map((item) => item.grnId === grnId ? updated : item));
  await recordActivity({ grnId, grnNumber: note.grnNumber, poId: note.poId, poNumber: note.poNumber, eventType: 'GRN_APPROVED', message: `${note.grnNumber} approved for posting.`, operator: session.staffName });
  return updated;
}

export async function postGRN(
  grnId: string,
  staffId: string,
  options: GoodsReceivingPostOptions = { acquisitionType: 'Supplier Credit' },
  context?: CommerceOperationContext): Promise<GoodsReceivingPostingResult | null> {
  const session = assertCanonicalPurchaseSession();
  const note = await getGoodsReceivingNoteById(grnId);
  if (!note || note.receivingStatus !== 'Draft') return null;
  if (note.vendorId !== session.vendorId || note.branchId !== session.branchId || note.warehouseId !== session.warehouseId) {
    throw new Error('Your POS session is incomplete. Please sign in again.');
  }
  const validation = await validateGRNBeforePost(grnId, { allowMissingSupplierInvoice: options.acquisitionType === 'Invoice Pending' });
  if (!validation.valid) {
    return { grnId, grnNumber: note.grnNumber, status: note.receivingStatus, stockPosted: false, approvalRequired: validation.approvalRequired, postedLines: [], skippedLines: await getGoodsReceivingLines(grnId), acquisitionType: options.acquisitionType, message: validation.errors.join(' ') };
  }
  if (validation.approvalRequired && !note.approvedByStaffId) {
    await submitGRNForApproval(grnId);
    return { grnId, grnNumber: note.grnNumber, status: 'Pending Approval', stockPosted: false, approvalRequired: true, postedLines: [], skippedLines: await getGoodsReceivingLines(grnId), acquisitionType: options.acquisitionType, message: 'GRN requires approval. Stock was not updated.' };
  }

  const lines = (await getGoodsReceivingLines(grnId)).map(normalizeLine);
  const postedLines = lines.filter((line) => !line.removeFromCurrentGRN && line.lineStatus !== 'Not Supplied' && line.lineStatus !== 'Cancelled' && line.qtyAccepted > 0);
  const postingStaffId = context?.staffId || session.staffId || staffId;
  const postingStaffName = session.staffName || postingStaffId;
  const skippedLines = lines.filter((line) => !postedLines.some((posted) => posted.lineId === line.lineId));
  const lineTax = calculatePostedLineTax(note, postedLines);
  const taxByLineId = lineTax.byLineId;
  const postedAt = nowIso();

  for (const line of postedLines) {
    const taxLine = taxByLineId.get(line.lineId);
    await receiveStock({
      movementId: grnMovementId(note, line),
      vendorId: note.vendorId,
      branchId: note.branchId,
      warehouseId: note.warehouseId,
      productId: line.productId,
      sku: line.sku,
      productName: line.productName,
      shelfLocation: line.shelfLocation,
      quantityIn: line.qtyAccepted,
      quantityOut: 0,
      unitCost: taxLine?.netUnitCost ?? line.receivedUnitCost,
      sellingPrice: line.sellingPrice,
      staffId: postingStaffId,
      staffName: postingStaffName,
      terminalId: context?.terminalId || session.terminalId,
      createdAt: postedAt,
      referenceType: 'GOODS_RECEIPT',
      referenceId: note.grnId,
      notes: `Posted goods receipt ${note.grnNumber}. Rejected goods excluded from stock. Cost policy: vendor VAT settings with recoverable VAT excluded from inventory cost.`
    });
  }

  const nextStatus: GoodsReceivingStatus = skippedLines.some((line) => line.qtyOutstandingAfterGRN > 0) ? 'Partially Posted' : 'Posted';
  const updatedLines = lines.map((line) => {
    const taxLine = taxByLineId.get(line.lineId);
    return taxLine ? {
      ...line,
      vatRate: taxLine.vatRate,
      vatAmount: taxLine.vatAmount,
      lineTotal: taxLine.lineTotal,
      unitCost: taxLine.netUnitCost
    } : line;
  });
  const updatedNote = {
    ...note,
    goodsReceiptId: note.grnId,
    goodsReceiptNumber: note.grnNumber,
    supplierDocumentNumber: note.supplierInvoiceNumber || note.deliveryNoteNumber,
    receivedAt: note.receivedAt || postedAt,
    subtotal: lineTax.tax.subtotal,
    vatTotal: lineTax.tax.vatAmount,
    total: lineTax.tax.total,
    receivingStatus: nextStatus,
    status: nextStatus,
    postingStatus: 'Posted' as const,
    approvalRequired: false,
    postedAt,
    updatedAt: postedAt
  };
  saveGRNs(getGRNs().map((item) => item.grnId === grnId ? updatedNote : item));
  saveGRNLines(getGRNLines().map((line) => line.grnId === grnId ? (updatedLines.find((updated) => updated.lineId === line.lineId) || line) : line));

  if (note.poId) syncPOFromPostedGRNs(note.poId, postingStaffId);
  await recordActivity({ grnId, grnNumber: note.grnNumber, poId: note.poId, poNumber: note.poNumber, eventType: 'GRN_POSTED_TO_STOCK', message: `${note.grnNumber} posted accepted quantities to stock. Rejected goods did not update inventory. Supplier liability or payment is handled by the selected acquisition type.`, operator: postingStaffId });
  await recordActivity({ grnId, grnNumber: note.grnNumber, poId: note.poId, poNumber: note.poNumber, eventType: 'GOODS_RECEIVED_POSTED', message: `${postedLines.length} accepted lines posted to inventory movements.`, operator: postingStaffId });
  try {
    const discipline = await import('./purchaseDisciplineService');
    const linkedCommitment = discipline.getSupplierPurchaseCommitments().find((commitment) => (
      (note.poId && commitment.purchaseOrderId === note.poId) ||
      (!commitment.grnId && commitment.supplierId === note.supplierId && commitment.status !== 'Cancelled' && commitment.status !== 'Fulfilled')
    ));
    if (linkedCommitment) {
      discipline.linkCommitmentToGRN(linkedCommitment.commitmentId, note.grnId);
      discipline.markCommitmentFulfilled(linkedCommitment.commitmentId);
    } else {
      await discipline.createGRNWithoutPurchaseDisciplineWarning(note.grnNumber, postingStaffId);
    }
  } catch {
    // Purchase discipline checks are local/mock and must not block stock posting.
  }

  const purchaseValue = lineTax.tax.total;
  let supplierBillId: string | undefined;
  let supplierBillNumber: string | undefined;
  let supplierPaymentId: string | undefined;
  let supplierPaymentNumber: string | undefined;
  let creditorMessage = 'No supplier payable created.';

  if (options.acquisitionType === 'Supplier Credit' || options.acquisitionType === 'Part Paid + Supplier Credit' || options.acquisitionType === 'Paid Cash') {
    const paidAmount = options.acquisitionType === 'Paid Cash'
      ? purchaseValue
      : options.acquisitionType === 'Part Paid + Supplier Credit'
        ? Math.min(Math.max(0, options.paidAmount || 0), purchaseValue)
        : 0;
    const bill = await createSupplierBillFromGRN({
      supplierId: note.supplierId,
      supplierName: note.supplierName,
      supplierInvoiceNumber: options.supplierInvoiceNumber || note.supplierInvoiceNumber || undefined,
      grnId: note.grnId,
      grnNumber: note.grnNumber,
      purchaseOrderId: note.poId,
      purchaseOrderNumber: note.poNumber,
      grnDate: note.receivedDate,
      amount: purchaseValue,
      vatAmount: lineTax.tax.vatAmount,
      branchId: note.branchId,
      warehouseId: note.warehouseId,
      createdBy: postingStaffId,
      acquisitionType: options.acquisitionType,
      paidAmount: 0
    });
    supplierBillId = bill.billId;
    supplierBillNumber = bill.billNumber;
    recordSupplierAccountPurchase({
      vendorId: note.vendorId,
      supplierId: note.supplierId,
      referenceType: 'SUPPLIER_BILL',
      referenceId: bill.billId,
      amount: purchaseValue,
      dueDate: bill.dueDate,
      createdBy: postingStaffId,
      createdAt: postedAt,
      branchId: note.branchId,
      supplierInvoiceNumber: bill.supplierInvoiceNumber,
      purchaseOrderId: note.poId,
      goodsReceiptId: note.grnId,
      notes: `Goods receipt ${note.grnNumber} posted supplier liability.`
    });
    creditorMessage = `${bill.billNumber} supplier bill posted.`;
    if (paidAmount > 0) {
      const payment = await createSupplierPayment({
        supplierId: note.supplierId,
        supplierName: note.supplierName,
        paymentDate: note.receivedDate,
        amount: paidAmount,
        paymentMethod: options.paymentSource === 'CashDrawer' ? 'Cash' : options.paymentSource === 'BankPlaceholder' ? 'Bank Transfer' : options.paymentSource === 'MobileMoneyPlaceholder' ? 'Mobile Money' : options.paymentSource === 'OwnerFundsPlaceholder' ? 'Owner Funds' : 'COGS Reserve',
        paymentReference: options.acquisitionType === 'Paid Cash' ? `${note.grnNumber}-PAID` : `${note.grnNumber}-PARTPAY`,
        source: options.paymentSource || 'COGSReserve',
        cogsReserveAmount: (options.paymentSource || 'COGSReserve') === 'COGSReserve' ? paidAmount : 0,
        nonReserveAmount: (options.paymentSource || 'COGSReserve') === 'COGSReserve' ? 0 : paidAmount,
        approvedBy: postingStaffId,
        paidBy: postingStaffId,
        notes: `${options.acquisitionType} GRN supplier payment for ${note.grnNumber}.`
      });
      await markSupplierPaymentPaid(payment.paymentId, postingStaffId);
      recordSupplierAccountPayment({
        vendorId: note.vendorId,
        supplierId: note.supplierId,
        referenceType: 'SUPPLIER_PAYMENT',
        referenceId: payment.paymentId,
        amount: paidAmount,
        createdBy: postingStaffId,
        createdAt: postedAt,
        branchId: note.branchId,
        notes: `Supplier payment allocated for ${note.grnNumber}.`
      });
      supplierPaymentId = payment.paymentId;
      supplierPaymentNumber = payment.paymentNumber;
      creditorMessage = `${bill.billNumber} supplier bill posted and ${payment.paymentNumber} allocated.`;
    }
  } else if (options.acquisitionType === 'Invoice Pending') {
    await recordActivity({ grnId, grnNumber: note.grnNumber, poId: note.poId, poNumber: note.poNumber, eventType: 'GRN_INVOICE_PENDING_FLAGGED', message: `${note.grnNumber} posted with invoice pending. Supplier bill not posted.`, operator: postingStaffId });
    creditorMessage = 'Invoice pending warning created. No posted supplier bill created.';
  } else if (options.acquisitionType === 'Already Invoiced') {
    creditorMessage = options.linkedSupplierBillId ? `Linked to existing supplier bill ${options.linkedSupplierBillId}.` : 'Already invoiced selected. No duplicate supplier bill created.';
  }

  await recordActivity({ grnId, grnNumber: note.grnNumber, poId: note.poId, poNumber: note.poNumber, eventType: 'GRN_SUPPLIER_BILL_CREATED', message: creditorMessage, operator: postingStaffId });
  void writeAuditLog({
    vendorId: note.vendorId,
    branchId: note.branchId,
    warehouseId: note.warehouseId,
    terminalId: context?.terminalId || session.terminalId,
    staffId: postingStaffId,
    module: 'Purchasing',
    action: 'GOODS_RECEIPT_POSTED',
    entityType: 'goods_receipts',
    entityId: note.grnId,
    after: { grnNumber: note.grnNumber, total: purchaseValue, postedLines: postedLines.length },
    correlationId: context?.correlationId
  });
  void publishCommerceEvent({
    eventType: 'PurchaseReceived',
    vendorId: note.vendorId,
    branchId: note.branchId,
    warehouseId: note.warehouseId,
    terminalId: context?.terminalId || session.terminalId,
    staffId: postingStaffId,
    supplierId: note.supplierId,
    sourceModule: 'Purchasing',
    aggregateType: 'goods_receipts',
    aggregateId: note.grnId,
    correlationId: context?.correlationId,
    payload: {
      summary: `${note.grnNumber} posted accepted goods.`,
      amount: purchaseValue,
      quantity: postedLines.reduce((sum, line) => sum + line.qtyAccepted, 0),
      currency: 'USD',
      items: postedLines.map((line) => ({ productId: line.productId, sku: line.sku, quantity: line.qtyAccepted }))
    }
  });

  return { grnId, grnNumber: note.grnNumber, status: nextStatus, stockPosted: true, approvalRequired: false, postedLines: updatedLines.filter((line) => postedLines.some((posted) => posted.lineId === line.lineId)), skippedLines, supplierBillId, supplierBillNumber, supplierPaymentId, supplierPaymentNumber, acquisitionType: options.acquisitionType, message: `${note.grnNumber} posted. Accepted quantities updated inventory. ${creditorMessage}` };
}

export async function cancelGRN(grnId: string, staffId: string, reason: string): Promise<GoodsReceivingNote | null> {
  if (!reason.trim()) return null;
  const notes = getGRNs();
  const note = notes.find((item) => item.grnId === grnId);
  if (!note || note.receivingStatus === 'Posted' || note.receivingStatus === 'Partially Posted') return null;
  const updated = { ...note, receivingStatus: 'Cancelled' as const, notes: `${note.notes}\nCancelled: ${reason}`.trim(), updatedAt: nowIso() };
  saveGRNs(notes.map((item) => item.grnId === grnId ? updated : item));
  await recordActivity({ grnId, grnNumber: note.grnNumber, poId: note.poId, poNumber: note.poNumber, eventType: 'GRN_CANCELLED', message: `${note.grnNumber} cancelled. No stock updated.`, operator: staffId });
  return updated;
}

export async function reverseGRNPlaceholder(grnId: string, staffId: string, reason: string): Promise<GoodsReceivingNote | null> {
  if (!reason.trim()) return null;
  const notes = getGRNs();
  const note = notes.find((item) => item.grnId === grnId);
  if (!note || (note.receivingStatus !== 'Posted' && note.receivingStatus !== 'Partially Posted')) return null;
  const updated = { ...note, receivingStatus: 'Reversed' as const, notes: `${note.notes}\nReversal review: ${reason}`.trim(), updatedAt: nowIso() };
  saveGRNs(notes.map((item) => item.grnId === grnId ? updated : item));
  await recordActivity({ grnId, grnNumber: note.grnNumber, poId: note.poId, poNumber: note.poNumber, eventType: 'GRN_REVERSED_PLACEHOLDER', message: `${note.grnNumber} reversal review recorded.`, operator: staffId });
  return updated;
}

export async function closePOWithOutstanding(poId: string, staffId: string, reason: string): Promise<PurchaseOrder | null> {
  if (!reason.trim()) return null;
  const orders = getPOs();
  const order = orders.find((item) => item.poId === poId);
  if (!order) return null;
  const updated = { ...order, status: 'Closed With Outstanding' as const, notes: `${order.notes}\nClosed with outstanding: ${reason}`.trim(), updatedAt: nowIso() };
  savePOs(orders.map((item) => item.poId === poId ? updated : item));
  recordPOActivity(updated, 'PURCHASE_ORDER_CLOSED_WITH_OUTSTANDING', staffId, `${updated.poNumber} closed with outstanding quantities. Reason: ${reason}.`);
  await recordActivity({ poId, poNumber: updated.poNumber, eventType: 'PURCHASE_ORDER_CLOSED_WITH_OUTSTANDING', message: `${updated.poNumber} closed with outstanding quantities.`, operator: staffId });
  return updated;
}

export async function reopenPOPlaceholder(poId: string, staffId: string, reason: string): Promise<PurchaseOrder | null> {
  const orders = getPOs();
  const order = orders.find((item) => item.poId === poId);
  if (!order) return null;
  const updated = { ...order, status: 'Partially Received' as const, notes: `${order.notes}\nReopened: ${reason}`.trim(), updatedAt: nowIso() };
  savePOs(orders.map((item) => item.poId === poId ? updated : item));
  await recordActivity({ poId, poNumber: updated.poNumber, eventType: 'PURCHASE_ORDER_LEFT_OPEN_FOR_FULFILLMENT', message: `${updated.poNumber} left open for future fulfillment.`, operator: staffId });
  return updated;
}

export async function exportGRNPlaceholder(grnId: string): Promise<{ success: boolean; message: string }> {
  const note = await getGoodsReceivingNoteById(grnId);
  if (!note) return { success: false, message: 'GRN not found.' };
  const identity = getVendorDocumentIdentity({ vendorId: note.vendorId, branchId: note.branchId, warehouseId: note.warehouseId });
  await recordActivity({ grnId, grnNumber: note.grnNumber, poId: note.poId, poNumber: note.poNumber, eventType: 'GRN_DRAFT_UPDATED', message: `${note.grnNumber} export prepared for ${identity.displayName}.`, operator: note.receivedByStaffName });
  return { success: true, message: `${note.grnNumber} export prepared for ${identity.displayName}.` };
}

export async function getGoodsReceivingActivityEvents(filters: GoodsReceivingFilterState = {}): Promise<GoodsReceivingActivityEvent[]> {
  const events = readList<GoodsReceivingActivityEvent>(GRN_ACTIVITY_KEY, mockGoodsReceivingActivityEvents, hasKeys('id', 'eventType'));
  return events.filter((event) => {
    return (!filters.grnNumber || (event.grnNumber || '').toLowerCase().includes(filters.grnNumber.toLowerCase()))
      && (!filters.poNumber || (event.poNumber || '').toLowerCase().includes(filters.poNumber.toLowerCase()));
  });
}
import { normalizeOperationalRole } from '../auth/roleNormalization';
