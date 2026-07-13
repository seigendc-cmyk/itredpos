import {
  SupplierReturn,
  SupplierReturnActivityEvent,
  SupplierReturnCreditNotePlaceholder,
  SupplierReturnDispatchDetails,
  SupplierReturnFilterState,
  SupplierReturnLine,
  SupplierReturnReason,
  SupplierReturnStatus,
  SupplierReturnSummary
} from '../types';
import {
  mockSupplierReturnActivityEvents,
  mockSupplierReturnCreditNotes,
  mockSupplierReturnLines,
  mockSupplierReturns
} from '../mock/mockPosData';
import { createOperationalApproval } from './approvalService';
import { getGoodsReceivingLines, getGoodsReceivingNoteById } from './goodsReceivingService';
import { returnStockToSupplier } from './inventorySyncService';
import { loadInventoryMovements } from '../utils/localInventoryStore';
import { getVendorDocumentIdentity } from '../vendor/vendorBootstrapModel';
import { readVendorScopedList, writeVendorScopedList } from '../utils/vendorDataMode';
import { calculateDocumentTax, getCachedVendorTaxSettings } from './vendorTaxSettingsService';
import { recordSupplierAccountReturn } from './supplierAccountService';
import { assertCanonicalPurchaseSession } from './purchaseSessionService';

const RETURN_KEY = 'itred_pos_supplier_returns_v1';
const RETURN_LINE_KEY = 'itred_pos_supplier_return_lines_v1';
const RETURN_ACTIVITY_KEY = 'itred_pos_supplier_return_activity_v1';
const RETURN_CREDIT_KEY = 'itred_pos_supplier_return_credit_notes_v1';

type SupplierReturnPatch = Partial<Omit<SupplierReturn, 'supplierReturnId' | 'createdAt'>>;
type SupplierReturnLinePatch = Partial<Omit<SupplierReturnLine, 'lineId' | 'supplierReturnId'>>;

export interface SupplierReturnPostingResult {
  supplierReturnId: string;
  supplierReturnNumber: string;
  status: SupplierReturnStatus;
  stockPosted: boolean;
  postedLines: SupplierReturnLine[];
  noStockImpactLines: SupplierReturnLine[];
  message: string;
}

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

function today(): string {
  return nowIso().slice(0, 10);
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function safeId(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '_');
}

function getReturns(): SupplierReturn[] {
  return readList<SupplierReturn>(RETURN_KEY, mockSupplierReturns, hasKeys('supplierReturnId', 'supplierReturnNumber'));
}

function saveReturns(records: SupplierReturn[]): SupplierReturn[] {
  return saveList(RETURN_KEY, records);
}

function getLines(): SupplierReturnLine[] {
  return readList<SupplierReturnLine>(RETURN_LINE_KEY, mockSupplierReturnLines, hasKeys('lineId', 'supplierReturnId'));
}

function saveLines(lines: SupplierReturnLine[]): SupplierReturnLine[] {
  return saveList(RETURN_LINE_KEY, lines);
}

function getCreditNotes(): SupplierReturnCreditNotePlaceholder[] {
  return readList<SupplierReturnCreditNotePlaceholder>(RETURN_CREDIT_KEY, mockSupplierReturnCreditNotes, hasKeys('creditNoteId', 'supplierReturnId'));
}

function saveCreditNotes(notes: SupplierReturnCreditNotePlaceholder[]): SupplierReturnCreditNotePlaceholder[] {
  return saveList(RETURN_CREDIT_KEY, notes);
}

function nextReturnNumber(records: SupplierReturn[]): string {
  const highest = records.reduce((max, record) => {
    const match = record.supplierReturnNumber.match(/SRT-(\d+)/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `SRT-${String(highest + 1).padStart(4, '0')}`;
}

function normalizeLine(line: SupplierReturnLine): SupplierReturnLine {
  const returnableQty = line.stockWasPosted
    ? Math.max(line.qtyAcceptedIntoStock - line.qtyAlreadyReturned, 0)
    : Math.max(line.qtyReceived - line.qtyAlreadyReturned, 0);
  const qtyReturnRequested = Math.max(line.qtyReturnRequested, 0);
  const qtyReturnApproved = Math.min(Math.max(line.qtyReturnApproved, 0), returnableQty);
  return {
    ...line,
    qtyReturnRequested,
    qtyReturnApproved,
    lineTotal: qtyReturnApproved * line.unitCost
  };
}

function returnableQty(line: SupplierReturnLine): number {
  return line.stockWasPosted
    ? Math.max(line.qtyAcceptedIntoStock - line.qtyAlreadyReturned, 0)
    : Math.max(line.qtyReceived - line.qtyAlreadyReturned, 0);
}

function postedReturnQtyByGRNLine(grnLineId?: string): number {
  if (!grnLineId) return 0;
  const postedReturnIds = new Set(getReturns().filter((record) => record.status === 'Posted').map((record) => record.supplierReturnId));
  return getLines()
    .filter((line) => line.grnLineId === grnLineId && postedReturnIds.has(line.supplierReturnId))
    .reduce((sum, line) => sum + Math.max(line.qtyPostedOut, 0), 0);
}

async function recordActivity(input: Omit<SupplierReturnActivityEvent, 'id' | 'createdAt'>): Promise<SupplierReturnActivityEvent[]> {
  const events = readList<SupplierReturnActivityEvent>(RETURN_ACTIVITY_KEY, mockSupplierReturnActivityEvents, hasKeys('id', 'eventType'));
  const nextEvent: SupplierReturnActivityEvent = {
    ...input,
    id: makeId('SRT-ACT'),
    createdAt: nowIso()
  };
  return saveList(RETURN_ACTIVITY_KEY, [nextEvent, ...events].slice(0, 120));
}

function updateReturnStatus(supplierReturnId: string, patch: Partial<SupplierReturn>): SupplierReturn | null {
  const records = getReturns();
  let updated: SupplierReturn | null = null;
  const next = records.map((record) => {
    if (record.supplierReturnId !== supplierReturnId) return record;
    updated = { ...record, ...patch, updatedAt: nowIso() };
    return updated;
  });
  saveReturns(next);
  return updated;
}

function filtersMatch(record: SupplierReturn, filters: SupplierReturnFilterState): boolean {
  const fromTime = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`).getTime() : null;
  const toTime = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59`).getTime() : null;
  const returnTime = new Date(`${record.returnDate}T12:00:00`).getTime();
  return (!filters.supplierReturnNumber || record.supplierReturnNumber.toLowerCase().includes(filters.supplierReturnNumber.toLowerCase()))
    && (!filters.supplier || record.supplierName.toLowerCase().includes(filters.supplier.toLowerCase()))
    && (!filters.poNumber || (record.poNumber || '').toLowerCase().includes(filters.poNumber.toLowerCase()))
    && (!filters.grnNumber || (record.grnNumber || '').toLowerCase().includes(filters.grnNumber.toLowerCase()))
    && (!filters.branch || record.branchId.toLowerCase().includes(filters.branch.toLowerCase()))
    && (!filters.warehouse || record.warehouseId.toLowerCase().includes(filters.warehouse.toLowerCase()))
    && (!filters.status || filters.status === 'ALL' || record.status === filters.status)
    && (!filters.reason || filters.reason === 'ALL' || record.reason === filters.reason)
    && (!filters.resolution || filters.resolution === 'ALL' || record.resolution === filters.resolution)
    && (fromTime === null || returnTime >= fromTime)
    && (toTime === null || returnTime <= toTime);
}

export async function getSupplierReturns(filters: SupplierReturnFilterState = {}): Promise<SupplierReturn[]> {
  return getReturns().filter((record) => filtersMatch(record, filters)).sort((a, b) => b.supplierReturnNumber.localeCompare(a.supplierReturnNumber));
}

export async function getSupplierReturnById(supplierReturnId: string): Promise<SupplierReturn | null> {
  return getReturns().find((record) => record.supplierReturnId === supplierReturnId) || null;
}

export async function getSupplierReturnLines(supplierReturnId: string): Promise<SupplierReturnLine[]> {
  return getLines().filter((line) => line.supplierReturnId === supplierReturnId).map(normalizeLine);
}

export async function getSupplierReturnSummary(filters: SupplierReturnFilterState = {}): Promise<SupplierReturnSummary> {
  const records = await getSupplierReturns(filters);
  const ids = new Set(records.map((record) => record.supplierReturnId));
  const lines = getLines().filter((line) => ids.has(line.supplierReturnId)).map(normalizeLine);
  return {
    draftReturns: records.filter((record) => record.status === 'Draft').length,
    pendingApproval: records.filter((record) => record.status === 'Pending Approval').length,
    postedReturns: records.filter((record) => record.status === 'Posted').length,
    dispatched: records.filter((record) => record.status === 'Dispatched To Supplier').length,
    creditNotesPending: records.filter((record) => record.status === 'Credit Note Pending' || (record.resolution === 'Credit Note Expected' && !record.supplierCreditNoteNumber)).length,
    replacementsPending: records.filter((record) => record.status === 'Replacement Pending' || record.replacementExpected).length,
    supplierRejected: records.filter((record) => record.status === 'Supplier Rejected').length,
    closedReturns: records.filter((record) => record.status === 'Closed').length,
    returnQty: lines.reduce((sum, line) => sum + Math.max(line.qtyReturnApproved || line.qtyReturnRequested, 0), 0),
    returnValueEstimate: lines.reduce((sum, line) => sum + line.lineTotal, 0)
  };
}

export async function createSupplierReturnFromGRN(grnId: string, staffId: string): Promise<SupplierReturn | null> {
  const session = assertCanonicalPurchaseSession();
  const note = await getGoodsReceivingNoteById(grnId);
  if (!note) return null;
  if (note.vendorId !== session.vendorId || note.branchId !== session.branchId || note.warehouseId !== session.warehouseId) return null;

  const grnLines = await getGoodsReceivingLines(grnId);
  const candidates = grnLines.filter((line) => line.qtyAccepted > 0 || line.qtyRejected > 0 || line.varianceType === 'Over' || line.varianceType === 'Damaged' || line.varianceType === 'Wrong Product');
  if (candidates.length === 0) return null;

  const records = getReturns();
  const now = nowIso();
  const record: SupplierReturn = {
    supplierReturnId: makeId('SRT-ID'),
    supplierReturnNumber: nextReturnNumber(records),
    vendorId: note.vendorId,
    branchId: note.branchId,
    warehouseId: note.warehouseId,
    supplierId: note.supplierId,
    supplierName: note.supplierName,
    poId: note.poId,
    poNumber: note.poNumber,
    grnId: note.grnId,
    grnNumber: note.grnNumber,
    requestedByStaffId: session.staffId || staffId,
    requestedByStaffName: session.staffName,
    returnDate: today(),
    status: 'Draft',
    reason: candidates.some((line) => line.qtyRejected > 0 || line.varianceType === 'Damaged') ? 'Damaged' : 'Wrong Product',
    resolution: 'Pending Supplier Decision',
    supplierContactPerson: '',
    supplierPhone: '',
    supplierEmail: '',
    dispatchMethod: 'Not Dispatched',
    courierReference: '',
    supplierCreditNoteNumber: '',
    supplierCreditNoteAmount: 0,
    replacementExpected: false,
    totalReturnValue: candidates.reduce((sum, line) => sum + (line.qtyAccepted - (postedReturnQtyByGRNLine(line.lineId) || 0)) * line.receivedUnitCost, 0),
    approvalRequired: candidates.some((line) => line.qtyAccepted > 0),
    notes: 'Supplier Return draft created from GRN. No stock is reduced until the return is posted.',
    createdAt: now,
    updatedAt: now
  };

  const newLines = candidates.map((line) => {
    const stockWasPosted = (note.receivingStatus === 'Posted' || note.receivingStatus === 'Partially Posted') && line.qtyAccepted > 0;
    const qtyAlreadyReturned = postedReturnQtyByGRNLine(line.lineId);
    const baseReturnQty = stockWasPosted
      ? Math.max(line.qtyAccepted - qtyAlreadyReturned, 0)
      : Math.max(line.qtyRejected || line.qtyReceivedNow, 0);
    const reason: SupplierReturnReason = line.varianceType === 'Over'
      ? 'Over Supplied'
      : line.varianceType === 'Wrong Product'
        ? 'Wrong Product'
        : 'Damaged';
    const supplierLine: SupplierReturnLine = {
      lineId: makeId('SRT-LINE'),
      supplierReturnId: record.supplierReturnId,
      productId: line.productId,
      sku: line.sku,
      productName: line.productName,
      brand: line.brand,
      manufacturer: line.manufacturer,
      grnLineId: line.lineId,
      poLineId: line.poLineId,
      qtyReceived: line.qtyReceivedNow,
      qtyAcceptedIntoStock: line.qtyAccepted,
      qtyAlreadyReturned,
      qtyReturnRequested: baseReturnQty,
      qtyReturnApproved: baseReturnQty,
      qtyPostedOut: 0,
      unitCost: line.receivedUnitCost,
      lineTotal: baseReturnQty * line.receivedUnitCost,
      shelfLocation: line.shelfLocation || 'Receiving Hold',
      returnReason: reason,
      resolution: 'Pending Supplier Decision',
      lineStatus: 'Draft',
      stockWasPosted,
      notes: stockWasPosted ? 'Return will reduce stock only when posted.' : 'No stock reduction required. Goods were not accepted into inventory.'
    };
    return supplierLine;
  });

  saveReturns([record, ...records]);
  saveLines([...newLines, ...getLines()]);
  await recordActivity({
    supplierReturnId: record.supplierReturnId,
    supplierReturnNumber: record.supplierReturnNumber,
    grnId: record.grnId,
    grnNumber: record.grnNumber,
    poId: record.poId,
    poNumber: record.poNumber,
    eventType: 'SUPPLIER_RETURN_DRAFT_CREATED',
    operator: staffId,
    message: `${record.supplierReturnNumber} draft created from ${record.grnNumber}. Draft return does not reduce stock.`
  });
  return record;
}

export async function createSupplierReturnFromMovement(movementId: string, staffId: string): Promise<SupplierReturn | null> {
  const movement = loadInventoryMovements().find((item) => item.movementId === movementId && item.status === 'Posted');
  if (!movement) return null;
  const records = getReturns();
  const now = nowIso();
  const qty = Math.max(movement.qtyIn - movement.qtyOut, 0);
  const record: SupplierReturn = {
    supplierReturnId: makeId('SRT-ID'),
    supplierReturnNumber: nextReturnNumber(records),
    vendorId: movement.vendorId,
    branchId: movement.branchId,
    warehouseId: movement.warehouseId,
    supplierId: 'SUP-UNKNOWN',
    supplierName: 'Supplier From Movement',
    requestedByStaffId: staffId,
    requestedByStaffName: staffId,
    returnDate: today(),
    status: 'Draft',
    reason: 'Other',
    resolution: 'Pending Supplier Decision',
    supplierContactPerson: '',
    supplierPhone: '',
    supplierEmail: '',
    dispatchMethod: 'Not Dispatched',
    replacementExpected: false,
    totalReturnValue: qty * movement.unitCost,
    approvalRequired: qty > 0,
    notes: `Supplier Return draft created from posted movement ${movement.referenceNumber}.`,
    createdAt: now,
    updatedAt: now
  };
  const line: SupplierReturnLine = {
    lineId: makeId('SRT-LINE'),
    supplierReturnId: record.supplierReturnId,
    productId: movement.productId,
    sku: movement.sku,
    productName: movement.productName,
    brand: '',
    manufacturer: '',
    qtyReceived: qty,
    qtyAcceptedIntoStock: qty,
    qtyAlreadyReturned: 0,
    qtyReturnRequested: qty,
    qtyReturnApproved: qty,
    qtyPostedOut: 0,
    unitCost: movement.unitCost,
    lineTotal: qty * movement.unitCost,
    shelfLocation: movement.shelfLocation || '',
    returnReason: 'Other',
    resolution: 'Pending Supplier Decision',
    lineStatus: 'Draft',
    stockWasPosted: true,
    notes: 'Created from posted stock movement. Return posting will create stock-out movement.'
  };
  saveReturns([record, ...records]);
  saveLines([line, ...getLines()]);
  await recordActivity({
    supplierReturnId: record.supplierReturnId,
    supplierReturnNumber: record.supplierReturnNumber,
    eventType: 'SUPPLIER_RETURN_DRAFT_CREATED',
    operator: staffId,
    message: `${record.supplierReturnNumber} draft created from movement ${movement.referenceNumber}.`
  });
  return record;
}

export async function updateSupplierReturnDraft(supplierReturnId: string, patch: SupplierReturnPatch): Promise<SupplierReturn | null> {
  const record = await getSupplierReturnById(supplierReturnId);
  if (!record || record.status !== 'Draft') return null;
  const updated = updateReturnStatus(supplierReturnId, patch);
  if (updated) {
    await recordActivity({
      supplierReturnId,
      supplierReturnNumber: updated.supplierReturnNumber,
      grnId: updated.grnId,
      grnNumber: updated.grnNumber,
      poId: updated.poId,
      poNumber: updated.poNumber,
      eventType: 'SUPPLIER_RETURN_UPDATED',
      operator: updated.requestedByStaffName,
      message: `${updated.supplierReturnNumber} draft updated.`
    });
  }
  return updated;
}

export async function updateSupplierReturnLine(supplierReturnId: string, lineId: string, patch: SupplierReturnLinePatch): Promise<SupplierReturnLine | null> {
  const record = await getSupplierReturnById(supplierReturnId);
  if (!record || record.status !== 'Draft') return null;
  let updated: SupplierReturnLine | null = null;
  const next = getLines().map((line) => {
    if (line.supplierReturnId !== supplierReturnId || line.lineId !== lineId) return line;
    updated = normalizeLine({ ...line, ...patch });
    return updated;
  });
  saveLines(next);
  if (updated) {
    await recordActivity({
      supplierReturnId,
      supplierReturnNumber: record.supplierReturnNumber,
      grnId: record.grnId,
      grnNumber: record.grnNumber,
      poId: record.poId,
      poNumber: record.poNumber,
      eventType: 'SUPPLIER_RETURN_UPDATED',
      operator: record.requestedByStaffName,
      message: `${record.supplierReturnNumber} line ${updated.sku} updated.`
    });
  }
  return updated;
}

export async function submitSupplierReturnForApproval(supplierReturnId: string): Promise<SupplierReturn | null> {
  const record = await getSupplierReturnById(supplierReturnId);
  if (!record || record.status !== 'Draft') return null;
  const value = (await getSupplierReturnLines(supplierReturnId)).reduce((sum, line) => sum + line.lineTotal, 0);
  const updated = updateReturnStatus(supplierReturnId, { status: 'Pending Approval' });
  saveLines(getLines().map((line) => line.supplierReturnId === supplierReturnId ? { ...line, lineStatus: 'Pending' } : line));
  if (updated) {
    await createOperationalApproval({
      vendorId: updated.vendorId,
      branchId: updated.branchId,
      branch: updated.branchId,
      category: 'Supplier Return',
      requestedBy: updated.requestedByStaffName,
      requestedByRole: 'Stock Controller',
      relatedRecord: updated.supplierReturnNumber,
      amountOrValue: `USD ${value.toFixed(2)}`,
      risk: value > 250 || updated.reason === 'Wrong Product' ? 'High' : 'Medium',
      reason: updated.reason,
      context: 'Supplier Return approval review. No cashbook, payment, sales or COGS posting.',
      requiredPermission: 'approvals.approve'
    });
    await recordActivity({
      supplierReturnId,
      supplierReturnNumber: updated.supplierReturnNumber,
      grnId: updated.grnId,
      grnNumber: updated.grnNumber,
      poId: updated.poId,
      poNumber: updated.poNumber,
      eventType: 'SUPPLIER_RETURN_SUBMITTED_FOR_APPROVAL',
      operator: updated.requestedByStaffName,
      message: `${updated.supplierReturnNumber} submitted for approval. Stock not reduced.`
    });
  }
  return updated;
}

export async function approveSupplierReturn(supplierReturnId: string, staffId: string, notes = ''): Promise<SupplierReturn | null> {
  const record = await getSupplierReturnById(supplierReturnId);
  if (!record || record.status !== 'Pending Approval') return null;
  const updated = updateReturnStatus(supplierReturnId, {
    status: 'Approved',
    approvedByStaffId: staffId,
    approvedByStaffName: staffId,
    notes: notes ? `${record.notes}\nApproval: ${notes}` : record.notes
  });
  saveLines(getLines().map((line) => line.supplierReturnId === supplierReturnId ? { ...line, lineStatus: 'Approved' } : line));
  if (updated) {
    await recordActivity({
      supplierReturnId,
      supplierReturnNumber: updated.supplierReturnNumber,
      grnId: updated.grnId,
      grnNumber: updated.grnNumber,
      poId: updated.poId,
      poNumber: updated.poNumber,
      eventType: 'SUPPLIER_RETURN_APPROVED',
      operator: staffId,
      message: `${updated.supplierReturnNumber} approved for return posting.`
    });
  }
  return updated;
}

export async function postSupplierReturn(supplierReturnId: string, staffId: string): Promise<SupplierReturnPostingResult | null> {
  const session = assertCanonicalPurchaseSession();
  const record = await getSupplierReturnById(supplierReturnId);
  if (!record || (record.status !== 'Draft' && record.status !== 'Approved')) return null;
  if (record.vendorId !== session.vendorId || record.branchId !== session.branchId || record.warehouseId !== session.warehouseId) return null;
  const lines = (await getSupplierReturnLines(supplierReturnId)).filter((line) => line.qtyReturnApproved > 0);
  if (lines.length === 0) {
    return {
      supplierReturnId,
      supplierReturnNumber: record.supplierReturnNumber,
      status: record.status,
      stockPosted: false,
      postedLines: [],
      noStockImpactLines: [],
      message: 'At least one approved supplier return line is required before posting.'
    };
  }

  const postedLines: SupplierReturnLine[] = [];
  const noStockImpactLines: SupplierReturnLine[] = [];

  for (const line of lines) {
    if (line.stockWasPosted) {
      await returnStockToSupplier({
        movementId: safeId(`${record.vendorId}_PURCHASE_RETURN_${record.supplierReturnId}_${line.lineId}`),
        vendorId: record.vendorId,
        branchId: record.branchId,
        warehouseId: record.warehouseId,
        productId: line.productId,
        sku: line.sku,
        productName: line.productName,
        shelfLocation: line.shelfLocation,
        quantityOut: line.qtyReturnApproved,
        unitCost: line.unitCost,
        sellingPrice: 0,
        staffId: session.staffId || staffId,
        staffName: session.staffName,
        terminalId: session.terminalId,
        createdAt: nowIso(),
        referenceType: 'PURCHASE_RETURN',
        referenceId: record.supplierReturnId,
        notes: `Purchase Return ${record.supplierReturnNumber}: ${line.returnReason}. VAT reversal and supplier credit evidence recorded separately.`
      });
      postedLines.push({ ...line, qtyPostedOut: line.qtyReturnApproved, lineStatus: 'Posted' });
      await recordActivity({
        supplierReturnId,
        supplierReturnNumber: record.supplierReturnNumber,
        grnId: record.grnId,
        grnNumber: record.grnNumber,
        poId: record.poId,
        poNumber: record.poNumber,
        eventType: 'SUPPLIER_RETURN_POSTED_TO_STOCK',
        operator: session.staffName,
        message: `${record.supplierReturnNumber} posted ${line.qtyReturnApproved} ${line.sku} out of stock.`
      });
    } else {
      noStockImpactLines.push({ ...line, lineStatus: 'Posted' });
      await recordActivity({
        supplierReturnId,
        supplierReturnNumber: record.supplierReturnNumber,
        grnId: record.grnId,
        grnNumber: record.grnNumber,
        poId: record.poId,
        poNumber: record.poNumber,
        eventType: 'SUPPLIER_REJECTION_RECORDED_NO_STOCK_IMPACT',
        operator: session.staffName,
        message: `${record.supplierReturnNumber} recorded supplier rejection for ${line.sku}. No stock reduction required.`
      });
    }
  }

  const settings = getCachedVendorTaxSettings(record.vendorId);
  const tax = calculateDocumentTax(postedLines.map((line) => ({ lineAmount: line.qtyPostedOut * line.unitCost })), settings);
  if (tax.total > 0) {
    recordSupplierAccountReturn({
      vendorId: record.vendorId,
      supplierId: record.supplierId,
      referenceType: 'PURCHASE_RETURN',
      referenceId: record.supplierReturnId,
      amount: tax.total,
      createdBy: session.staffId || staffId,
      createdAt: nowIso(),
      branchId: record.branchId,
      notes: `Purchase return ${record.supplierReturnNumber} reduces supplier balance or creates supplier credit. VAT reversal: ${tax.vatAmount.toFixed(2)}.`
    });
  }

  const postedLineIds = new Set([...postedLines, ...noStockImpactLines].map((line) => line.lineId));
  saveLines(getLines().map((line) => {
    const posted = [...postedLines, ...noStockImpactLines].find((item) => item.lineId === line.lineId);
    if (line.supplierReturnId !== supplierReturnId || !postedLineIds.has(line.lineId) || !posted) return line;
    return { ...line, qtyPostedOut: posted.qtyPostedOut, lineStatus: 'Posted' };
  }));
  updateReturnStatus(supplierReturnId, { status: 'Posted' });
  await recordActivity({
    supplierReturnId,
    supplierReturnNumber: record.supplierReturnNumber,
    grnId: record.grnId,
    grnNumber: record.grnNumber,
    poId: record.poId,
    poNumber: record.poNumber,
    eventType: 'SUPPLIER_RETURN_POSTED',
    operator: session.staffName,
    message: `${record.supplierReturnNumber} posted. Stock reduced only for accepted goods already in inventory and supplier account evidence was recorded.`
  });

  return {
    supplierReturnId,
    supplierReturnNumber: record.supplierReturnNumber,
    status: 'Posted',
    stockPosted: postedLines.length > 0,
    postedLines,
    noStockImpactLines,
    message: `${record.supplierReturnNumber} posted. Stock reduced only for accepted goods already in inventory and supplier balance evidence was recorded.`
  };
}

export async function markDispatchedToSupplier(supplierReturnId: string, dispatchDetails: SupplierReturnDispatchDetails): Promise<SupplierReturn | null> {
  const record = await getSupplierReturnById(supplierReturnId);
  if (!record || record.status === 'Cancelled' || record.status === 'Closed') return null;
  const updated = updateReturnStatus(supplierReturnId, {
    status: 'Dispatched To Supplier',
    dispatchMethod: dispatchDetails.dispatchMethod,
    courierReference: dispatchDetails.courierReference || record.courierReference,
    notes: `${record.notes}\nDispatch: ${dispatchDetails.dispatchNotes || 'Dispatched to supplier.'}`
  });
  saveLines(getLines().map((line) => line.supplierReturnId === supplierReturnId ? { ...line, lineStatus: 'Dispatched' } : line));
  if (updated) {
    await recordActivity({
      supplierReturnId,
      supplierReturnNumber: updated.supplierReturnNumber,
      grnId: updated.grnId,
      grnNumber: updated.grnNumber,
      poId: updated.poId,
      poNumber: updated.poNumber,
      eventType: 'SUPPLIER_RETURN_DISPATCHED',
      operator: dispatchDetails.dispatchedByStaffName || updated.requestedByStaffName,
      message: `${updated.supplierReturnNumber} dispatched to supplier.`
    });
  }
  return updated;
}

export async function markSupplierAccepted(supplierReturnId: string, staffId: string, notes: string): Promise<SupplierReturn | null> {
  const record = await getSupplierReturnById(supplierReturnId);
  const updated = record ? updateReturnStatus(supplierReturnId, { status: 'Supplier Accepted', notes: `${record.notes}\nSupplier accepted: ${notes}` }) : null;
  if (updated) {
    saveLines(getLines().map((line) => line.supplierReturnId === supplierReturnId ? { ...line, lineStatus: 'Accepted By Supplier' } : line));
    await recordActivity({ supplierReturnId, supplierReturnNumber: updated.supplierReturnNumber, grnId: updated.grnId, grnNumber: updated.grnNumber, poId: updated.poId, poNumber: updated.poNumber, eventType: 'SUPPLIER_RETURN_UPDATED', operator: staffId, message: `${updated.supplierReturnNumber} accepted by supplier.` });
  }
  return updated;
}

export async function markSupplierRejected(supplierReturnId: string, staffId: string, notes: string): Promise<SupplierReturn | null> {
  const record = await getSupplierReturnById(supplierReturnId);
  const updated = record ? updateReturnStatus(supplierReturnId, { status: 'Supplier Rejected', notes: `${record.notes}\nSupplier rejected: ${notes}` }) : null;
  if (updated) {
    saveLines(getLines().map((line) => line.supplierReturnId === supplierReturnId ? { ...line, lineStatus: 'Rejected By Supplier' } : line));
    await recordActivity({ supplierReturnId, supplierReturnNumber: updated.supplierReturnNumber, grnId: updated.grnId, grnNumber: updated.grnNumber, poId: updated.poId, poNumber: updated.poNumber, eventType: 'SUPPLIER_RETURN_UPDATED', operator: staffId, message: `${updated.supplierReturnNumber} rejected by supplier.` });
  }
  return updated;
}

export async function recordSupplierCreditNotePlaceholder(supplierReturnId: string, payload: { supplierCreditNoteNumber: string; supplierCreditNoteAmount: number; notes?: string }): Promise<SupplierReturn | null> {
  const record = await getSupplierReturnById(supplierReturnId);
  if (!record) return null;
  const credit: SupplierReturnCreditNotePlaceholder = {
    creditNoteId: makeId('SRT-CN'),
    supplierReturnId,
    supplierReturnNumber: record.supplierReturnNumber,
    supplierCreditNoteNumber: payload.supplierCreditNoteNumber,
    supplierCreditNoteAmount: payload.supplierCreditNoteAmount,
    receivedDate: today(),
    status: 'Pending Accounting Review',
    notes: payload.notes || 'Supplier credit note captured for accounting review only.',
    createdAt: nowIso()
  };
  saveCreditNotes([credit, ...getCreditNotes()]);
  const updated = updateReturnStatus(supplierReturnId, {
    status: 'Credit Note Received',
    supplierCreditNoteNumber: payload.supplierCreditNoteNumber,
    supplierCreditNoteAmount: payload.supplierCreditNoteAmount
  });
  if (updated) {
    await recordActivity({ supplierReturnId, supplierReturnNumber: updated.supplierReturnNumber, grnId: updated.grnId, grnNumber: updated.grnNumber, poId: updated.poId, poNumber: updated.poNumber, eventType: 'SUPPLIER_CREDIT_NOTE_RECORDED', operator: updated.requestedByStaffName, message: `${updated.supplierReturnNumber} supplier credit note captured. No cashbook posting.` });
  }
  return updated;
}

export async function recordReplacementExpected(supplierReturnId: string, payload: { notes?: string }): Promise<SupplierReturn | null> {
  const record = await getSupplierReturnById(supplierReturnId);
  if (!record) return null;
  const updated = updateReturnStatus(supplierReturnId, {
    status: 'Replacement Pending',
    replacementExpected: true,
    resolution: 'Replacement Expected',
    notes: `${record.notes}\nReplacement expected: ${payload.notes || 'Awaiting supplier replacement.'}`
  });
  if (updated) {
    await recordActivity({ supplierReturnId, supplierReturnNumber: updated.supplierReturnNumber, grnId: updated.grnId, grnNumber: updated.grnNumber, poId: updated.poId, poNumber: updated.poNumber, eventType: 'SUPPLIER_REPLACEMENT_EXPECTED', operator: updated.requestedByStaffName, message: `${updated.supplierReturnNumber} replacement expected recorded.` });
  }
  return updated;
}

export async function closeSupplierReturn(supplierReturnId: string, staffId: string, notes: string): Promise<SupplierReturn | null> {
  const record = await getSupplierReturnById(supplierReturnId);
  if (!record) return null;
  const updated = updateReturnStatus(supplierReturnId, { status: 'Closed', notes: `${record.notes}\nClosed: ${notes}` });
  saveLines(getLines().map((line) => line.supplierReturnId === supplierReturnId ? { ...line, lineStatus: 'Closed' } : line));
  if (updated) {
    await recordActivity({ supplierReturnId, supplierReturnNumber: updated.supplierReturnNumber, grnId: updated.grnId, grnNumber: updated.grnNumber, poId: updated.poId, poNumber: updated.poNumber, eventType: 'SUPPLIER_RETURN_CLOSED', operator: staffId, message: `${updated.supplierReturnNumber} closed.` });
  }
  return updated;
}

export async function cancelSupplierReturn(supplierReturnId: string, staffId: string, reason: string): Promise<SupplierReturn | null> {
  const record = await getSupplierReturnById(supplierReturnId);
  if (!record || record.status === 'Posted' || record.status === 'Closed') return null;
  const updated = updateReturnStatus(supplierReturnId, { status: 'Cancelled', notes: `${record.notes}\nCancelled: ${reason}` });
  if (updated) {
    await recordActivity({ supplierReturnId, supplierReturnNumber: updated.supplierReturnNumber, grnId: updated.grnId, grnNumber: updated.grnNumber, poId: updated.poId, poNumber: updated.poNumber, eventType: 'SUPPLIER_RETURN_CANCELLED', operator: staffId, message: `${updated.supplierReturnNumber} cancelled. No stock was reduced.` });
  }
  return updated;
}

export async function exportSupplierReturnPlaceholder(supplierReturnId: string): Promise<{ message: string; payload: { record: SupplierReturn | null; lines: SupplierReturnLine[] } }> {
  const record = await getSupplierReturnById(supplierReturnId);
  const lines = record ? await getSupplierReturnLines(supplierReturnId) : [];
  const identity = record ? getVendorDocumentIdentity({ vendorId: record.vendorId, branchId: record.branchId, warehouseId: record.warehouseId }) : null;
  return {
    message: record ? `${record.supplierReturnNumber} export prepared for ${identity?.displayName || 'vendor'}.` : 'Supplier Return not found.',
    payload: { record, lines }
  };
}

export async function getSupplierReturnActivityEvents(filters: SupplierReturnFilterState = {}): Promise<SupplierReturnActivityEvent[]> {
  const events = readList<SupplierReturnActivityEvent>(RETURN_ACTIVITY_KEY, mockSupplierReturnActivityEvents, hasKeys('id', 'eventType'));
  const matchingIds = new Set((await getSupplierReturns(filters)).map((record) => record.supplierReturnId));
  return events
    .filter((event) => matchingIds.size === 0 || matchingIds.has(event.supplierReturnId))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
