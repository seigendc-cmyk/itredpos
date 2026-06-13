import {
  InventoryMovement,
  StockAdjustment,
  StockAdjustmentActivityEvent,
  StockAdjustmentDirection,
  StockAdjustmentFilterState,
  StockAdjustmentLine,
  StockAdjustmentReason,
  StockAdjustmentRiskLevel,
  StockAdjustmentStatus,
  StockAdjustmentSummary
} from '../types';
import {
  mockStockAdjustmentActivityEvents,
  mockStockAdjustmentLines,
  mockStockAdjustments
} from '../mock/mockPosData';
import { createOperationalApproval } from './approvalService';
import { calculateRunningBalance, postStockAdjustmentMovement } from './inventoryMovementService';

const ADJUSTMENT_KEY = 'itred_pos_stock_adjustments_v1';
const ADJUSTMENT_LINE_KEY = 'itred_pos_stock_adjustment_lines_v1';
const ADJUSTMENT_ACTIVITY_KEY = 'itred_pos_stock_adjustment_activity_v1';

type StockAdjustmentPatch = Partial<Omit<StockAdjustment, 'adjustmentId' | 'createdAt'>>;
type StockAdjustmentLinePatch = Partial<Omit<StockAdjustmentLine, 'lineId' | 'adjustmentId'>>;

export interface StockAdjustmentDraftPayload {
  vendorId: string;
  branchId: string;
  warehouseId: string;
  requestedByStaffId: string;
  requestedByStaffName: string;
  reason: StockAdjustmentReason;
  notes?: string;
}

export interface StockAdjustmentPostingResult {
  adjustmentId: string;
  adjustmentNumber: string;
  status: StockAdjustmentStatus;
  stockPosted: boolean;
  postedLines: StockAdjustmentLine[];
  movements: InventoryMovement[];
  message: string;
}

function readList<T>(key: string, fallback: T[], isValid: (value: unknown) => boolean): T[] {
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(fallback));
      return fallback;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every(isValid) ? parsed as T[] : fallback;
  } catch {
    try {
      localStorage.setItem(key, JSON.stringify(fallback));
    } catch {
      // Local persistence may be unavailable in test/private contexts.
    }
    return fallback;
  }
}

function saveList<T>(key: string, value: T[]): T[] {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Keep the local/mock workflow usable even if persistence is blocked.
    }
  }
  return value;
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

function getAdjustments(): StockAdjustment[] {
  return readList<StockAdjustment>(ADJUSTMENT_KEY, mockStockAdjustments, hasKeys('adjustmentId', 'adjustmentNumber'));
}

function saveAdjustments(records: StockAdjustment[]): StockAdjustment[] {
  return saveList(ADJUSTMENT_KEY, records);
}

function getLines(): StockAdjustmentLine[] {
  return readList<StockAdjustmentLine>(ADJUSTMENT_LINE_KEY, mockStockAdjustmentLines, hasKeys('lineId', 'adjustmentId'));
}

function saveLines(lines: StockAdjustmentLine[]): StockAdjustmentLine[] {
  return saveList(ADJUSTMENT_LINE_KEY, lines);
}

function nextAdjustmentNumber(records: StockAdjustment[]): string {
  const highest = records.reduce((max, record) => {
    const match = record.adjustmentNumber.match(/STA-(\d+)/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `STA-${String(highest + 1).padStart(4, '0')}`;
}

function normalizeLine(line: StockAdjustmentLine): StockAdjustmentLine {
  const currentQty = Math.max(line.currentQty, 0);
  const adjustmentQty = Math.max(line.adjustmentQty, 0);
  const newQty = line.adjustmentDirection === 'Increase'
    ? currentQty + adjustmentQty
    : line.adjustmentDirection === 'Decrease'
      ? currentQty - adjustmentQty
      : line.newQty;
  const qtyImpact = newQty - currentQty;
  return {
    ...line,
    currentQty,
    adjustmentQty,
    newQty,
    valueImpact: qtyImpact * line.unitCost,
    riskLevel: calculateLineRisk({ ...line, currentQty, adjustmentQty, newQty, valueImpact: qtyImpact * line.unitCost })
  };
}

function calculateLineRisk(line: StockAdjustmentLine): StockAdjustmentRiskLevel {
  const absValue = Math.abs(line.valueImpact);
  if (line.reason === 'Theft / Loss' || line.newQty < 0 || absValue >= 250) return 'Critical';
  if (line.reason === 'Write Off' || line.reason === 'Damaged Stock' || line.adjustmentDirection === 'Decrease' || absValue >= 100) return 'High';
  if (line.reason === 'Physical Count Correction' || absValue >= 50) return 'Medium';
  return 'Low';
}

function rankRisk(risk: StockAdjustmentRiskLevel): number {
  return { Low: 1, Medium: 2, High: 3, Critical: 4 }[risk];
}

function topRisk(lines: StockAdjustmentLine[], fallback: StockAdjustmentRiskLevel): StockAdjustmentRiskLevel {
  return lines.reduce((max, line) => rankRisk(line.riskLevel) > rankRisk(max) ? line.riskLevel : max, fallback);
}

function approvalRequiredFor(lines: StockAdjustmentLine[], reason: StockAdjustmentReason): boolean {
  return lines.some((line) => rankRisk(line.riskLevel) >= 3 || line.newQty < 0 || line.adjustmentDirection === 'Decrease')
    || reason === 'Theft / Loss'
    || reason === 'Write Off'
    || reason === 'Damaged Stock';
}

async function recordActivity(input: Omit<StockAdjustmentActivityEvent, 'id' | 'createdAt'>): Promise<StockAdjustmentActivityEvent[]> {
  const events = readList<StockAdjustmentActivityEvent>(ADJUSTMENT_ACTIVITY_KEY, mockStockAdjustmentActivityEvents, hasKeys('id', 'eventType'));
  const nextEvent: StockAdjustmentActivityEvent = {
    ...input,
    id: makeId('STA-ACT'),
    createdAt: nowIso()
  };
  return saveList(ADJUSTMENT_ACTIVITY_KEY, [nextEvent, ...events].slice(0, 120));
}

function updateAdjustment(adjustmentId: string, patch: Partial<StockAdjustment>): StockAdjustment | null {
  let updated: StockAdjustment | null = null;
  const next = getAdjustments().map((record) => {
    if (record.adjustmentId !== adjustmentId) return record;
    updated = { ...record, ...patch, updatedAt: nowIso() };
    return updated;
  });
  saveAdjustments(next);
  return updated;
}

function matchesFilters(record: StockAdjustment, lines: StockAdjustmentLine[], filters: StockAdjustmentFilterState): boolean {
  const relatedLines = lines.filter((line) => line.adjustmentId === record.adjustmentId);
  const fromTime = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`).getTime() : null;
  const toTime = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59`).getTime() : null;
  const adjustmentTime = new Date(`${record.adjustmentDate}T12:00:00`).getTime();
  const productQuery = (filters.product || '').toLowerCase();
  const skuQuery = (filters.sku || '').toLowerCase();
  return (!filters.adjustmentNumber || record.adjustmentNumber.toLowerCase().includes(filters.adjustmentNumber.toLowerCase()))
    && (!filters.product || relatedLines.some((line) => line.productName.toLowerCase().includes(productQuery)))
    && (!filters.sku || relatedLines.some((line) => line.sku.toLowerCase().includes(skuQuery)))
    && (!filters.branch || record.branchId.toLowerCase().includes(filters.branch.toLowerCase()))
    && (!filters.warehouse || record.warehouseId.toLowerCase().includes(filters.warehouse.toLowerCase()))
    && (!filters.status || filters.status === 'ALL' || record.status === filters.status)
    && (!filters.reason || filters.reason === 'ALL' || record.reason === filters.reason)
    && (!filters.riskLevel || filters.riskLevel === 'ALL' || record.riskLevel === filters.riskLevel)
    && (!filters.requestedBy || record.requestedByStaffName.toLowerCase().includes(filters.requestedBy.toLowerCase()))
    && (fromTime === null || adjustmentTime >= fromTime)
    && (toTime === null || adjustmentTime <= toTime);
}

export async function getStockAdjustments(filters: StockAdjustmentFilterState = {}): Promise<StockAdjustment[]> {
  const lines = getLines();
  return getAdjustments()
    .filter((record) => matchesFilters(record, lines, filters))
    .sort((a, b) => b.adjustmentNumber.localeCompare(a.adjustmentNumber));
}

export async function getStockAdjustmentById(adjustmentId: string): Promise<StockAdjustment | null> {
  return getAdjustments().find((record) => record.adjustmentId === adjustmentId) || null;
}

export async function getStockAdjustmentLines(adjustmentId: string): Promise<StockAdjustmentLine[]> {
  return getLines().filter((line) => line.adjustmentId === adjustmentId).map(normalizeLine);
}

export async function getStockAdjustmentSummary(filters: StockAdjustmentFilterState = {}): Promise<StockAdjustmentSummary> {
  const records = await getStockAdjustments(filters);
  const ids = new Set(records.map((record) => record.adjustmentId));
  const lines = getLines().filter((line) => ids.has(line.adjustmentId)).map(normalizeLine);
  const todayDate = today();
  return {
    draftAdjustments: records.filter((record) => record.status === 'Draft').length,
    pendingApproval: records.filter((record) => record.status === 'Pending Approval').length,
    approved: records.filter((record) => record.status === 'Approved').length,
    postedToday: records.filter((record) => record.status === 'Posted' && record.updatedAt.slice(0, 10) === todayDate).length,
    highRisk: records.filter((record) => record.riskLevel === 'High').length,
    critical: records.filter((record) => record.riskLevel === 'Critical').length,
    positiveAdjustments: lines.filter((line) => line.valueImpact > 0).length,
    negativeAdjustments: lines.filter((line) => line.valueImpact < 0).length,
    writeOffValue: Math.abs(lines.filter((line) => line.reason === 'Write Off' || line.reason === 'Damaged Stock').reduce((sum, line) => sum + Math.min(line.valueImpact, 0), 0)),
    awaitingOwnerReview: records.filter((record) => record.status === 'Pending Approval' && (record.riskLevel === 'High' || record.riskLevel === 'Critical')).length
  };
}

export async function createStockAdjustmentDraft(payload: StockAdjustmentDraftPayload): Promise<StockAdjustment> {
  const records = getAdjustments();
  const record: StockAdjustment = {
    adjustmentId: makeId('STA-ID'),
    adjustmentNumber: nextAdjustmentNumber(records),
    vendorId: payload.vendorId,
    branchId: payload.branchId,
    warehouseId: payload.warehouseId,
    requestedByStaffId: payload.requestedByStaffId,
    requestedByStaffName: payload.requestedByStaffName,
    adjustmentDate: today(),
    status: 'Draft',
    reason: payload.reason,
    riskLevel: 'Low',
    approvalRequired: false,
    notes: payload.notes || 'Draft stock adjustment. No stock movement posted.',
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  saveAdjustments([record, ...records]);
  await recordActivity({
    adjustmentId: record.adjustmentId,
    adjustmentNumber: record.adjustmentNumber,
    eventType: 'STOCK_ADJUSTMENT_DRAFT_CREATED',
    operator: record.requestedByStaffName,
    message: `${record.adjustmentNumber} draft created. Draft does not affect stock.`
  });
  return record;
}

export async function updateStockAdjustmentDraft(adjustmentId: string, patch: StockAdjustmentPatch): Promise<StockAdjustment | null> {
  const record = await getStockAdjustmentById(adjustmentId);
  if (!record || record.status !== 'Draft') return null;
  const lines = await getStockAdjustmentLines(adjustmentId);
  const riskLevel = topRisk(lines, patch.riskLevel || record.riskLevel);
  const approvalRequired = approvalRequiredFor(lines, patch.reason || record.reason);
  const updated = updateAdjustment(adjustmentId, { ...patch, riskLevel, approvalRequired });
  if (updated) {
    await recordActivity({
      adjustmentId,
      adjustmentNumber: updated.adjustmentNumber,
      eventType: 'STOCK_ADJUSTMENT_DRAFT_UPDATED',
      operator: updated.requestedByStaffName,
      message: `${updated.adjustmentNumber} draft updated.`
    });
  }
  return updated;
}

export async function updateStockAdjustmentLine(adjustmentId: string, lineId: string, patch: StockAdjustmentLinePatch): Promise<StockAdjustmentLine | null> {
  const record = await getStockAdjustmentById(adjustmentId);
  if (!record || record.status !== 'Draft') return null;
  let updatedLine: StockAdjustmentLine | null = null;
  const next = getLines().map((line) => {
    if (line.adjustmentId !== adjustmentId || line.lineId !== lineId) return line;
    updatedLine = normalizeLine({ ...line, ...patch });
    return updatedLine;
  });
  saveLines(next);
  const lines = next.filter((line) => line.adjustmentId === adjustmentId).map(normalizeLine);
  updateAdjustment(adjustmentId, {
    riskLevel: topRisk(lines, record.riskLevel),
    approvalRequired: approvalRequiredFor(lines, record.reason)
  });
  if (updatedLine) {
    await recordActivity({
      adjustmentId,
      adjustmentNumber: record.adjustmentNumber,
      eventType: 'STOCK_ADJUSTMENT_LINE_UPDATED',
      operator: record.requestedByStaffName,
      message: `${record.adjustmentNumber} line ${updatedLine.sku} updated.`
    });
  }
  return updatedLine;
}

export async function addStockAdjustmentLine(adjustmentId: string, line: Omit<StockAdjustmentLine, 'lineId' | 'adjustmentId' | 'valueImpact' | 'riskLevel'> & { riskLevel?: StockAdjustmentRiskLevel }): Promise<StockAdjustmentLine | null> {
  const record = await getStockAdjustmentById(adjustmentId);
  if (!record || record.status !== 'Draft') return null;
  const nextLine = normalizeLine({
    ...line,
    lineId: makeId('STA-LINE'),
    adjustmentId,
    valueImpact: 0,
    riskLevel: line.riskLevel || 'Low'
  });
  saveLines([nextLine, ...getLines()]);
  await updateStockAdjustmentDraft(adjustmentId, {});
  return nextLine;
}

export async function removeStockAdjustmentLine(adjustmentId: string, lineId: string): Promise<StockAdjustmentLine[]> {
  const record = await getStockAdjustmentById(adjustmentId);
  if (!record || record.status !== 'Draft') return getLines().filter((line) => line.adjustmentId === adjustmentId);
  const next = getLines().filter((line) => !(line.adjustmentId === adjustmentId && line.lineId === lineId));
  saveLines(next);
  await updateStockAdjustmentDraft(adjustmentId, {});
  return next.filter((line) => line.adjustmentId === adjustmentId);
}

export async function calculateStockAdjustmentRisk(adjustment: StockAdjustment): Promise<StockAdjustmentRiskLevel> {
  return topRisk(await getStockAdjustmentLines(adjustment.adjustmentId), adjustment.riskLevel);
}

export async function validateStockAdjustmentBeforePost(adjustmentId: string): Promise<{ valid: boolean; approvalRequired: boolean; errors: string[]; warnings: string[] }> {
  const record = await getStockAdjustmentById(adjustmentId);
  const lines = await getStockAdjustmentLines(adjustmentId);
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!record) errors.push('Stock adjustment not found.');
  if (record && !record.branchId) errors.push('Branch is required.');
  if (record && !record.warehouseId) errors.push('Warehouse is required.');
  if (record && !record.reason) errors.push('Reason is required.');
  if (lines.length === 0) errors.push('At least one stock adjustment line is required.');
  lines.forEach((line) => {
    if (!line.productId || !line.sku) errors.push(`Product is required on line ${line.lineId}.`);
    if (line.adjustmentDirection !== 'Set Quantity' && line.adjustmentQty <= 0) errors.push(`Adjustment quantity must be greater than zero for ${line.sku}.`);
    if (line.newQty < 0 && record?.status !== 'Approved') errors.push(`Negative stock is blocked for ${line.sku} unless approved override exists.`);
    if (line.riskLevel === 'High' || line.riskLevel === 'Critical') warnings.push(`${line.sku} requires high-risk review.`);
  });
  const approvalRequired = record ? record.approvalRequired || approvalRequiredFor(lines, record.reason) : false;
  if (record && approvalRequired && record.status !== 'Approved') {
    errors.push('Approval is required before posting this stock adjustment.');
  }
  return { valid: errors.length === 0, approvalRequired, errors, warnings };
}

export async function submitStockAdjustmentForApproval(adjustmentId: string): Promise<StockAdjustment | null> {
  const record = await getStockAdjustmentById(adjustmentId);
  if (!record || record.status !== 'Draft') return null;
  const lines = await getStockAdjustmentLines(adjustmentId);
  const riskLevel = topRisk(lines, record.riskLevel);
  const updated = updateAdjustment(adjustmentId, { status: 'Pending Approval', riskLevel, approvalRequired: true });
  if (updated) {
    const totalValue = lines.reduce((sum, line) => sum + Math.abs(line.valueImpact), 0);
    await createOperationalApproval({
      vendorId: updated.vendorId,
      branchId: updated.branchId,
      branch: updated.branchId,
      category: 'Stock Adjustment',
      requestedBy: updated.requestedByStaffName,
      requestedByRole: 'Stock Controller',
      relatedRecord: updated.adjustmentNumber,
      amountOrValue: `USD ${totalValue.toFixed(2)}`,
      risk: riskLevel,
      reason: 'Stock Adjustment Approval Required',
      context: 'Inventory / Stock Adjustments. Draft and pending adjustments do not affect stock.',
      requiredPermission: 'approvals.approve'
    });
    await recordActivity({
      adjustmentId,
      adjustmentNumber: updated.adjustmentNumber,
      eventType: 'STOCK_ADJUSTMENT_SUBMITTED_FOR_APPROVAL',
      operator: updated.requestedByStaffName,
      message: `${updated.adjustmentNumber} submitted for approval. Stock not changed.`
    });
    if (riskLevel === 'High' || riskLevel === 'Critical') {
      await recordActivity({
        adjustmentId,
        adjustmentNumber: updated.adjustmentNumber,
        eventType: 'STOCK_ADJUSTMENT_HIGH_RISK',
        operator: updated.requestedByStaffName,
        message: `${updated.adjustmentNumber} flagged ${riskLevel} for Owner review.`
      });
    }
  }
  return updated;
}

export async function approveStockAdjustment(adjustmentId: string, staffId: string, notes = ''): Promise<StockAdjustment | null> {
  const record = await getStockAdjustmentById(adjustmentId);
  if (!record || record.status !== 'Pending Approval') return null;
  const updated = updateAdjustment(adjustmentId, {
    status: 'Approved',
    approvedByStaffId: staffId,
    approvedByStaffName: staffId,
    notes: notes ? `${record.notes}\nApproval: ${notes}` : record.notes
  });
  if (updated) {
    await recordActivity({ adjustmentId, adjustmentNumber: updated.adjustmentNumber, eventType: 'STOCK_ADJUSTMENT_APPROVED', operator: staffId, message: `${updated.adjustmentNumber} approved for posting.` });
  }
  return updated;
}

export async function rejectStockAdjustment(adjustmentId: string, staffId: string, notes = ''): Promise<StockAdjustment | null> {
  const record = await getStockAdjustmentById(adjustmentId);
  if (!record || (record.status !== 'Pending Approval' && record.status !== 'Approved')) return null;
  const updated = updateAdjustment(adjustmentId, { status: 'Rejected', notes: `${record.notes}\nRejected: ${notes}` });
  if (updated) {
    await recordActivity({ adjustmentId, adjustmentNumber: updated.adjustmentNumber, eventType: 'STOCK_ADJUSTMENT_REJECTED', operator: staffId, message: `${updated.adjustmentNumber} rejected. Stock not changed.` });
  }
  return updated;
}

export async function postStockAdjustment(adjustmentId: string, staffId: string): Promise<StockAdjustmentPostingResult | null> {
  const record = await getStockAdjustmentById(adjustmentId);
  if (!record || (record.status !== 'Draft' && record.status !== 'Approved')) return null;
  const validation = await validateStockAdjustmentBeforePost(adjustmentId);
  if (!validation.valid) {
    return { adjustmentId, adjustmentNumber: record.adjustmentNumber, status: record.status, stockPosted: false, postedLines: [], movements: [], message: validation.errors.join(' ') };
  }
  const lines = await getStockAdjustmentLines(adjustmentId);
  const movements: InventoryMovement[] = [];
  for (const line of lines) {
    const qtyImpact = line.newQty - line.currentQty;
    if (qtyImpact === 0) continue;
    const movementType = record.reason === 'Write Off'
      ? 'WRITE_OFF'
      : qtyImpact > 0
        ? 'STOCK_ADJUSTMENT_IN'
        : 'STOCK_ADJUSTMENT_OUT';
    const currentBalance = await calculateRunningBalance(line.productId, record.warehouseId);
    const balanceBefore = currentBalance || line.currentQty;
    const movement = await postStockAdjustmentMovement({
      vendorId: record.vendorId,
      branchId: record.branchId,
      warehouseId: record.warehouseId,
      productId: line.productId,
      sku: line.sku,
      productName: line.productName,
      shelfLocation: line.shelfLocation,
      movementType,
      referenceType: 'ADJUSTMENT',
      referenceNumber: record.adjustmentNumber,
      qtyIn: qtyImpact > 0 ? qtyImpact : 0,
      qtyOut: qtyImpact < 0 ? Math.abs(qtyImpact) : 0,
      balanceBefore,
      balanceAfter: balanceBefore + qtyImpact,
      unitCost: line.unitCost,
      sellingPrice: 0,
      staffId,
      staffName: staffId,
      movementDate: nowIso(),
      notes: `Stock Adjustment ${record.adjustmentNumber}: ${line.reason}. Pending Accounting Review Placeholder only; no cashbook posting.`,
      riskFlag: line.riskLevel,
      approvalRequired: false,
      status: 'Posted'
    });
    movements.push(movement);
  }
  const updated = updateAdjustment(adjustmentId, { status: 'Posted', postedByStaffId: staffId, postedByStaffName: staffId });
  if (updated) {
    await recordActivity({ adjustmentId, adjustmentNumber: updated.adjustmentNumber, eventType: 'STOCK_ADJUSTMENT_POSTED', operator: staffId, message: `${updated.adjustmentNumber} posted. Inventory movements created; no cashbook, supplier payment or tax posting.` });
  }
  return {
    adjustmentId,
    adjustmentNumber: record.adjustmentNumber,
    status: 'Posted',
    stockPosted: movements.length > 0,
    postedLines: lines,
    movements,
    message: `${record.adjustmentNumber} posted. Stock updated through controlled inventory movements.`
  };
}

export async function cancelStockAdjustment(adjustmentId: string, staffId: string, reason: string): Promise<StockAdjustment | null> {
  const record = await getStockAdjustmentById(adjustmentId);
  if (!record || record.status === 'Posted' || record.status === 'Reversed') return null;
  const updated = updateAdjustment(adjustmentId, { status: 'Cancelled', notes: `${record.notes}\nCancelled: ${reason}` });
  if (updated) {
    await recordActivity({ adjustmentId, adjustmentNumber: updated.adjustmentNumber, eventType: 'STOCK_ADJUSTMENT_CANCELLED', operator: staffId, message: `${updated.adjustmentNumber} cancelled. Stock not changed.` });
  }
  return updated;
}

export async function reverseStockAdjustmentPlaceholder(adjustmentId: string, staffId: string, reason: string): Promise<StockAdjustment | null> {
  const record = await getStockAdjustmentById(adjustmentId);
  if (!record || record.status !== 'Posted') return null;
  const updated = updateAdjustment(adjustmentId, { status: 'Reversed', notes: `${record.notes}\nReversal placeholder: ${reason}` });
  if (updated) {
    await recordActivity({ adjustmentId, adjustmentNumber: updated.adjustmentNumber, eventType: 'STOCK_ADJUSTMENT_REVERSAL_PLACEHOLDER_PREPARED', operator: staffId, message: `${updated.adjustmentNumber} reverse adjustment placeholder prepared. Final reversal workflow will create a controlled correction movement.` });
  }
  return updated;
}

export async function recordStockAdjustmentPlaceholderActivity(
  adjustmentId: string,
  staffId: string,
  eventType: 'STOCK_ADJUSTMENT_EXPORT_PREPARED' | 'STOCK_ADJUSTMENT_DUPLICATED_PLACEHOLDER',
  message: string
): Promise<StockAdjustmentActivityEvent[]> {
  const record = await getStockAdjustmentById(adjustmentId);
  if (!record) return getStockAdjustmentActivityEvents();
  return recordActivity({
    adjustmentId,
    adjustmentNumber: record.adjustmentNumber,
    eventType,
    operator: staffId,
    message
  });
}

export async function exportStockAdjustmentPlaceholder(adjustmentId: string): Promise<{ message: string; payload: { record: StockAdjustment | null; lines: StockAdjustmentLine[] } }> {
  const record = await getStockAdjustmentById(adjustmentId);
  const lines = record ? await getStockAdjustmentLines(adjustmentId) : [];
  return {
    message: record ? `${record.adjustmentNumber} export placeholder prepared.` : 'Stock Adjustment not found.',
    payload: { record, lines }
  };
}

export async function getStockAdjustmentActivityEvents(filters: StockAdjustmentFilterState = {}): Promise<StockAdjustmentActivityEvent[]> {
  const matchingIds = new Set((await getStockAdjustments(filters)).map((record) => record.adjustmentId));
  const events = readList<StockAdjustmentActivityEvent>(ADJUSTMENT_ACTIVITY_KEY, mockStockAdjustmentActivityEvents, hasKeys('id', 'eventType'));
  return events
    .filter((event) => matchingIds.size === 0 || matchingIds.has(event.adjustmentId))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
