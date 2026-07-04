import {
  InventoryMovement,
  Product,
  StocktakeActivityEvent,
  StocktakeActivityEventType,
  StocktakeCountMode,
  StocktakeFilterState,
  StocktakeLine,
  StocktakeLineStatus,
  StocktakePostingResult,
  StocktakeScope,
  StocktakeSession,
  StocktakeSessionStatus,
  StocktakeSessionSummary,
  StocktakeVarianceRisk,
  StocktakeVarianceSummary
} from '../types';
import {
  mockProducts,
  mockStocktakeActivityEvents,
  mockStocktakeLines,
  mockStocktakeSessions
} from '../mock/mockPosData';
import { createOperationalApproval } from './approvalService';
import { calculateRunningBalance, postStocktakeAdjustmentMovement } from './inventoryMovementService';
import { getVendorDocumentIdentity } from '../vendor/vendorBootstrapModel';

const SESSION_KEY = 'itred_pos_stocktake_sessions_v1';
const LINE_KEY = 'itred_pos_stocktake_lines_v1';
const ACTIVITY_KEY = 'itred_pos_stocktake_activity_v1';
const MEDIUM_VALUE_THRESHOLD = 50;
const HIGH_VALUE_THRESHOLD = 150;
const CRITICAL_VALUE_THRESHOLD = 300;

export interface StocktakeSessionPayload {
  vendorId: string;
  branchId: string;
  warehouseId?: string;
  scope: StocktakeScope;
  countMode: StocktakeCountMode;
  requestedByStaffId: string;
  requestedByStaffName: string;
  notes?: string;
  categoryFilter?: string;
  supplierFilter?: string;
  shelfLocationFilter?: string;
  selectedProductIds?: string[];
}

type SessionPatch = Partial<Omit<StocktakeSession, 'stocktakeId' | 'stocktakeNumber' | 'createdAt'>>;

function canUseLocalStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

function readList<T>(key: string, fallback: T[], isValid: (value: unknown) => boolean): T[] {
  if (!canUseLocalStorage()) return fallback;
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
      // Local persistence may be blocked.
    }
    return fallback;
  }
}

function saveList<T>(key: string, value: T[]): T[] {
  if (canUseLocalStorage()) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Keep local/mock workflow usable without persistence.
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

function getSessions(): StocktakeSession[] {
  return readList<StocktakeSession>(SESSION_KEY, mockStocktakeSessions, hasKeys('stocktakeId', 'stocktakeNumber'));
}

function saveSessions(records: StocktakeSession[]): StocktakeSession[] {
  return saveList(SESSION_KEY, records);
}

function getLines(): StocktakeLine[] {
  return readList<StocktakeLine>(LINE_KEY, mockStocktakeLines, hasKeys('lineId', 'stocktakeId'));
}

function saveLines(lines: StocktakeLine[]): StocktakeLine[] {
  return saveList(LINE_KEY, lines);
}

function nextStocktakeNumber(records: StocktakeSession[]): string {
  const highest = records.reduce((max, record) => {
    const match = record.stocktakeNumber.match(/STK-(\d+)/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `STK-${String(highest + 1).padStart(4, '0')}`;
}

function riskRank(risk: StocktakeVarianceRisk): number {
  return { None: 0, Low: 1, Medium: 2, High: 3, Critical: 4 }[risk];
}

function topRisk(lines: StocktakeLine[]): StocktakeVarianceRisk {
  return lines.reduce<StocktakeVarianceRisk>((highest, line) => riskRank(line.varianceRisk) > riskRank(highest) ? line.varianceRisk : highest, 'None');
}

function approvalRisk(lines: StocktakeLine[]): 'Low' | 'Medium' | 'High' | 'Critical' {
  const risk = topRisk(lines);
  return risk === 'None' ? 'Low' : risk;
}

export function calculateStocktakeVarianceRisk(line: StocktakeLine): StocktakeVarianceRisk {
  if (line.countedQty === null) return 'Medium';
  const varianceQty = line.countedQty - line.systemQty;
  const absQty = Math.abs(varianceQty);
  const absValue = Math.abs(varianceQty * line.unitCost);
  if (absQty === 0) return 'None';
  if (varianceQty < -5 || absValue >= CRITICAL_VALUE_THRESHOLD || line.riskLevel === 'Critical') return 'Critical';
  if (absQty > 5 || absValue >= HIGH_VALUE_THRESHOLD || line.riskLevel === 'High') return 'High';
  if (absQty > 2 || absValue >= MEDIUM_VALUE_THRESHOLD) return 'Medium';
  return 'Low';
}

export function calculateStocktakeVariance(line: StocktakeLine): StocktakeLine {
  if (line.countedQty === null || Number.isNaN(line.countedQty)) {
    return {
      ...line,
      countedQty: null,
      varianceQty: 0,
      valueImpact: 0,
      varianceRisk: line.lineStatus === 'Excluded' ? 'None' : line.varianceRisk === 'None' ? 'Medium' : line.varianceRisk,
      lineStatus: line.lineStatus === 'Excluded' ? 'Excluded' : line.lineStatus === 'Recount Required' ? 'Recount Required' : 'Not Counted'
    };
  }
  const countedQty = Math.max(0, line.countedQty);
  const varianceQty = countedQty - line.systemQty;
  const valueImpact = varianceQty * line.unitCost;
  const lineStatus: StocktakeLineStatus = line.lineStatus === 'Excluded'
    ? 'Excluded'
    : line.lineStatus === 'Recount Required'
      ? 'Recount Required'
    : varianceQty === 0
      ? 'No Variance'
      : 'Variance';
  const varianceRisk = lineStatus === 'Excluded' ? 'None' : calculateStocktakeVarianceRisk({ ...line, countedQty, varianceQty, valueImpact });
  return {
    ...line,
    countedQty,
    varianceQty,
    valueImpact,
    varianceRisk,
    lineStatus,
    variance: varianceQty,
    riskLevel: varianceRisk === 'None' ? 'Low' : varianceRisk,
    status: varianceQty === 0 ? 'Matched' : varianceQty > 0 ? 'Over Count' : 'Short Count'
  };
}

function normalizeLine(line: StocktakeLine): StocktakeLine {
  return calculateStocktakeVariance(line);
}

async function recordActivity(input: Omit<StocktakeActivityEvent, 'id' | 'createdAt'>): Promise<StocktakeActivityEvent[]> {
  const events = readList<StocktakeActivityEvent>(ACTIVITY_KEY, mockStocktakeActivityEvents, hasKeys('id', 'eventType'));
  const nextEvent: StocktakeActivityEvent = {
    ...input,
    id: makeId('STK-ACT'),
    createdAt: nowIso()
  };
  return saveList(ACTIVITY_KEY, [nextEvent, ...events].slice(0, 160));
}

function updateSession(stocktakeId: string, patch: Partial<StocktakeSession>): StocktakeSession | null {
  let updated: StocktakeSession | null = null;
  const next = getSessions().map((record) => {
    if (record.stocktakeId !== stocktakeId) return record;
    updated = { ...record, ...patch, updatedAt: nowIso() };
    return updated;
  });
  saveSessions(next);
  return updated;
}

function matchesFilters(record: StocktakeSession, lines: StocktakeLine[], filters: StocktakeFilterState): boolean {
  const relatedLines = lines.filter((line) => line.stocktakeId === record.stocktakeId).map(normalizeLine);
  const fromTime = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`).getTime() : null;
  const toTime = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59`).getTime() : null;
  const recordTime = new Date(record.startedAt).getTime();
  return (!filters.stocktakeNumber || record.stocktakeNumber.toLowerCase().includes(filters.stocktakeNumber.toLowerCase()))
    && (!filters.branch || filters.branch === 'ALL' || record.branchId === filters.branch)
    && (!filters.warehouse || filters.warehouse === 'ALL' || record.warehouseId === filters.warehouse)
    && (!filters.scope || filters.scope === 'ALL' || record.scope === filters.scope)
    && (!filters.countMode || filters.countMode === 'ALL' || record.countMode === filters.countMode)
    && (!filters.status || filters.status === 'ALL' || record.status === filters.status)
    && (!filters.requestedBy || record.requestedByStaffName.toLowerCase().includes(filters.requestedBy.toLowerCase()))
    && (!filters.countedBy || (record.countedByStaffName || '').toLowerCase().includes(filters.countedBy.toLowerCase()))
    && (!filters.varianceRisk || filters.varianceRisk === 'ALL' || relatedLines.some((line) => line.varianceRisk === filters.varianceRisk))
    && (fromTime === null || recordTime >= fromTime)
    && (toTime === null || recordTime <= toTime);
}

function productToStocktakeLine(product: Product, stocktakeId: string): StocktakeLine {
  const systemQty = product.qtyOnHand ?? product.stock;
  return {
    lineId: makeId('STK-LINE'),
    stocktakeId,
    productId: product.id,
    sku: product.sku || product.code,
    productName: product.productName || product.name,
    brand: product.brand || 'N/A',
    category: product.productCategory || product.category,
    shelfLocation: product.shelfLocation || '',
    systemQty,
    countedQty: null,
    varianceQty: 0,
    unitCost: product.costPrice ?? product.cost,
    valueImpact: 0,
    varianceRisk: product.riskLevel || 'Low',
    lineStatus: 'Not Counted',
    countNotes: '',
    recountNotes: '',
    numericNo: product.productNumericNumber,
    alu: product.alu,
    industrialSector: product.industrialSector,
    riskLevel: product.riskLevel || 'Low',
    status: 'Pending'
  };
}

function linesForScope(stocktakeId: string, record: StocktakeSession): StocktakeLine[] {
  let products = mockProducts;
  if (record.scope === 'Category' && record.categoryFilter) {
    products = products.filter((product) => product.category === record.categoryFilter || product.productCategory === record.categoryFilter);
  }
  if (record.scope === 'Supplier' && record.supplierFilter) {
    products = products.filter((product) => product.supplierName === record.supplierFilter || product.supplierId === record.supplierFilter);
  }
  if (record.scope === 'Shelf Location' && record.shelfLocationFilter) {
    products = products.filter((product) => product.shelfLocation === record.shelfLocationFilter);
  }
  if (record.scope === 'Selected Products' && record.selectedProductIds?.length) {
    products = products.filter((product) => record.selectedProductIds?.includes(product.id));
  }
  if (record.scope === 'High Risk Products') {
    products = products.filter((product) => product.riskLevel === 'High' || product.riskLevel === 'Critical' || product.healthStatus === 'Variance Risk');
  }
  if (record.scope === 'Low Stock Products') {
    products = products.filter((product) => product.stock <= product.minStock || product.healthStatus === 'Low Stock');
  }
  if (record.scope === 'No Movement Products') {
    products = products.filter((product) => product.healthStatus === 'Dead Stock');
  }
  if (record.scope === 'Branch') {
    products = products.filter((product) => product.branch === record.branchId || product.branchId === record.branchId);
  }
  if (record.scope === 'Warehouse') {
    products = products.filter((product) => product.warehouse === record.warehouseId || product.warehouseId === record.warehouseId);
  }
  return products.map((product) => productToStocktakeLine(product, stocktakeId));
}

function approvalRequired(lines: StocktakeLine[]): boolean {
  return lines.some((line) => line.lineStatus !== 'Excluded' && (
    riskRank(line.varianceRisk) >= 3 ||
    Math.abs(line.valueImpact) >= HIGH_VALUE_THRESHOLD ||
    line.varianceQty < -5 ||
    line.lineStatus === 'Recount Required'
  ));
}

export async function getStocktakeSessions(filters: StocktakeFilterState = {}): Promise<StocktakeSession[]> {
  const lines = getLines();
  return getSessions()
    .filter((record) => matchesFilters(record, lines, filters))
    .sort((a, b) => b.stocktakeNumber.localeCompare(a.stocktakeNumber));
}

export async function getStocktakeSessionById(stocktakeId: string): Promise<StocktakeSession | null> {
  return getSessions().find((record) => record.stocktakeId === stocktakeId) || null;
}

export async function getStocktakeLines(stocktakeId: string): Promise<StocktakeLine[]> {
  return getLines().filter((line) => line.stocktakeId === stocktakeId).map(normalizeLine);
}

export async function getStocktakeSessionSummary(filters: StocktakeFilterState = {}): Promise<StocktakeSessionSummary> {
  const records = await getStocktakeSessions(filters);
  const ids = new Set(records.map((record) => record.stocktakeId));
  const lines = getLines().filter((line) => ids.has(line.stocktakeId)).map(normalizeLine);
  const todayDate = today();
  return {
    openSessions: records.filter((record) => !['Posted', 'Cancelled', 'Closed'].includes(record.status)).length,
    counting: records.filter((record) => record.status === 'Counting').length,
    submitted: records.filter((record) => record.status === 'Submitted').length,
    pendingApproval: records.filter((record) => record.status === 'Pending Approval').length,
    recountRequired: records.filter((record) => record.status === 'Recount Requested').length + lines.filter((line) => line.lineStatus === 'Recount Required').length,
    postedToday: records.filter((record) => record.status === 'Posted' && (record.postedAt || record.updatedAt).slice(0, 10) === todayDate).length,
    positiveVariance: lines.filter((line) => line.varianceQty > 0).length,
    negativeVariance: lines.filter((line) => line.varianceQty < 0).length,
    highRiskVariance: lines.filter((line) => line.varianceRisk === 'High' || line.varianceRisk === 'Critical').length,
    estimatedValueImpact: lines.reduce((sum, line) => sum + line.valueImpact, 0)
  };
}

export async function createStocktakeSession(payload: StocktakeSessionPayload): Promise<StocktakeSession> {
  const records = getSessions();
  const now = nowIso();
  const record: StocktakeSession = {
    stocktakeId: makeId('STK-ID'),
    stocktakeNumber: nextStocktakeNumber(records),
    vendorId: payload.vendorId,
    branchId: payload.branchId,
    warehouseId: payload.warehouseId,
    scope: payload.scope,
    countMode: payload.countMode,
    status: 'Draft',
    requestedByStaffId: payload.requestedByStaffId,
    requestedByStaffName: payload.requestedByStaffName,
    startedAt: now,
    notes: payload.notes || 'Draft stocktake session. Draft does not affect stock.',
    createdAt: now,
    updatedAt: now,
    categoryFilter: payload.categoryFilter,
    supplierFilter: payload.supplierFilter,
    shelfLocationFilter: payload.shelfLocationFilter,
    selectedProductIds: payload.selectedProductIds
  };
  saveSessions([record, ...records]);
  await recordActivity({ stocktakeId: record.stocktakeId, stocktakeNumber: record.stocktakeNumber, eventType: 'STOCKTAKE_SESSION_CREATED', operator: record.requestedByStaffName, severity: 'Low', message: `${record.stocktakeNumber} created. Stock not changed.` });
  await generateStocktakeLinesFromScope(record.stocktakeId, record.scope);
  return record;
}

export async function updateStocktakeSessionDraft(stocktakeId: string, patch: SessionPatch): Promise<StocktakeSession | null> {
  const record = await getStocktakeSessionById(stocktakeId);
  if (!record || record.status === 'Posted' || record.status === 'Cancelled' || record.status === 'Closed') return null;
  return updateSession(stocktakeId, patch);
}

export async function generateStocktakeLinesFromScope(stocktakeId: string, _scope: StocktakeScope): Promise<StocktakeLine[]> {
  const record = await getStocktakeSessionById(stocktakeId);
  if (!record || record.status === 'Posted') return [];
  const existing = getLines().filter((line) => line.stocktakeId !== stocktakeId);
  const generated = linesForScope(stocktakeId, record);
  saveLines([...generated, ...existing]);
  return generated;
}

export async function updateStocktakeLineCount(stocktakeId: string, lineId: string, countedQty: number | null, notes = ''): Promise<StocktakeLine | null> {
  const record = await getStocktakeSessionById(stocktakeId);
  if (!record || record.status === 'Posted' || record.status === 'Cancelled' || (countedQty !== null && countedQty < 0)) return null;
  let updatedLine: StocktakeLine | null = null;
  const next = getLines().map((line) => {
    if (line.stocktakeId !== stocktakeId || line.lineId !== lineId) return line;
    const nextStatus = line.lineStatus === 'Recount Required' && countedQty !== null ? 'Counted' : line.lineStatus;
    updatedLine = normalizeLine({ ...line, countedQty, lineStatus: nextStatus, countNotes: notes || line.countNotes });
    return updatedLine;
  });
  saveLines(next);
  if (updatedLine) {
    await recordActivity({ stocktakeId, stocktakeNumber: record.stocktakeNumber, eventType: countedQty === null ? 'STOCKTAKE_LINE_CLEARED' : 'STOCKTAKE_LINE_COUNTED', operator: record.countedByStaffName || record.requestedByStaffName, severity: updatedLine.varianceRisk, message: countedQty === null ? `${updatedLine.sku} count cleared. Stock not changed.` : `${updatedLine.sku} counted. Variance ${updatedLine.varianceQty}. Stock not changed.` });
    if (updatedLine.varianceQty !== 0) {
      await recordActivity({ stocktakeId, stocktakeNumber: record.stocktakeNumber, eventType: 'STOCKTAKE_VARIANCE_FOUND', operator: record.countedByStaffName || record.requestedByStaffName, severity: updatedLine.varianceRisk, message: `${updatedLine.sku} variance found. Posting blocked until session post.` });
    }
  }
  return updatedLine;
}

export async function excludeStocktakeLine(stocktakeId: string, lineId: string, staffId: string, reason = 'Count deferred'): Promise<StocktakeLine | null> {
  const record = await getStocktakeSessionById(stocktakeId);
  if (!record || record.status === 'Posted' || record.status === 'Cancelled') return null;
  let updatedLine: StocktakeLine | null = null;
  const next = getLines().map((line) => {
    if (line.stocktakeId !== stocktakeId || line.lineId !== lineId) return line;
    updatedLine = {
      ...line,
      countedQty: null,
      varianceQty: 0,
      valueImpact: 0,
      varianceRisk: 'None',
      lineStatus: 'Excluded',
      countNotes: `${line.countNotes ? `${line.countNotes} | ` : ''}Excluded: ${reason}. Not posted.`
    };
    return updatedLine;
  });
  saveLines(next);
  if (updatedLine) {
    await recordActivity({ stocktakeId, stocktakeNumber: record.stocktakeNumber, eventType: 'STOCKTAKE_LINE_EXCLUDED', operator: staffId, severity: 'Low', message: `${updatedLine.sku} excluded from stocktake posting. Reason: ${reason}.` });
  }
  return updatedLine;
}

export async function restoreStocktakeLine(stocktakeId: string, lineId: string, staffId: string): Promise<StocktakeLine | null> {
  const record = await getStocktakeSessionById(stocktakeId);
  if (!record || record.status === 'Posted' || record.status === 'Cancelled') return null;
  let updatedLine: StocktakeLine | null = null;
  const next = getLines().map((line) => {
    if (line.stocktakeId !== stocktakeId || line.lineId !== lineId) return line;
    updatedLine = normalizeLine({ ...line, lineStatus: line.countedQty === null ? 'Not Counted' : 'Counted', countNotes: `${line.countNotes ? `${line.countNotes} | ` : ''}Restored to active count.` });
    return updatedLine;
  });
  saveLines(next);
  if (updatedLine) {
    await recordActivity({ stocktakeId, stocktakeNumber: record.stocktakeNumber, eventType: 'STOCKTAKE_LINE_RESTORED', operator: staffId, severity: updatedLine.varianceRisk, message: `${updatedLine.sku} restored to active stocktake lines.` });
  }
  return updatedLine;
}

export async function completeStocktakeRecount(stocktakeId: string, lineIds: string[], staffId: string, notes = ''): Promise<StocktakeLine[]> {
  const record = await getStocktakeSessionById(stocktakeId);
  if (!record || record.status === 'Posted' || record.status === 'Cancelled') return [];
  const next = getLines().map((line) => {
    if (line.stocktakeId !== stocktakeId || !lineIds.includes(line.lineId)) return line;
    return normalizeLine({ ...line, lineStatus: line.countedQty === null ? 'Not Counted' : 'Counted', recountNotes: notes || line.recountNotes });
  });
  saveLines(next);
  await recordActivity({ stocktakeId, stocktakeNumber: record.stocktakeNumber, eventType: 'STOCKTAKE_RECOUNT_COMPLETED', operator: staffId, severity: 'Medium', message: `${record.stocktakeNumber} recount completed for ${lineIds.length} line(s). Stock not changed.` });
  return getStocktakeLines(stocktakeId);
}

export async function bulkUpdateStocktakeCounts(stocktakeId: string, lines: Array<{ lineId: string; countedQty: number | null; notes?: string }>): Promise<StocktakeLine[]> {
  for (const line of lines) {
    await updateStocktakeLineCount(stocktakeId, line.lineId, line.countedQty, line.notes || '');
  }
  const record = await getStocktakeSessionById(stocktakeId);
  if (record) {
    await recordActivity({ stocktakeId, stocktakeNumber: record.stocktakeNumber, eventType: 'STOCKTAKE_BULK_COUNT_APPLIED', operator: record.countedByStaffName || record.requestedByStaffName, severity: 'Low', message: `${record.stocktakeNumber} bulk count action applied. Stock not changed.` });
  }
  return getStocktakeLines(stocktakeId);
}

export async function calculateStocktakeVarianceSummary(stocktakeId: string): Promise<StocktakeVarianceSummary> {
  const lines = await getStocktakeLines(stocktakeId);
  return {
    totalLines: lines.length,
    countedLines: lines.filter((line) => line.countedQty !== null && line.lineStatus !== 'Excluded').length,
    notCounted: lines.filter((line) => line.countedQty === null && line.lineStatus !== 'Excluded').length,
    excludedLines: lines.filter((line) => line.lineStatus === 'Excluded').length,
    noVariance: lines.filter((line) => line.varianceQty === 0 && line.countedQty !== null && line.lineStatus !== 'Excluded').length,
    varianceLines: lines.filter((line) => line.varianceQty !== 0 && line.lineStatus !== 'Excluded').length,
    positiveVarianceLines: lines.filter((line) => line.varianceQty > 0 && line.lineStatus !== 'Excluded').length,
    negativeVarianceLines: lines.filter((line) => line.varianceQty < 0 && line.lineStatus !== 'Excluded').length,
    totalGainQty: lines.filter((line) => line.varianceQty > 0 && line.lineStatus !== 'Excluded').reduce((sum, line) => sum + line.varianceQty, 0),
    totalLossQty: Math.abs(lines.filter((line) => line.varianceQty < 0 && line.lineStatus !== 'Excluded').reduce((sum, line) => sum + line.varianceQty, 0)),
    estimatedValueImpact: lines.filter((line) => line.lineStatus !== 'Excluded').reduce((sum, line) => sum + line.valueImpact, 0),
    highestRisk: topRisk(lines.filter((line) => line.lineStatus !== 'Excluded')),
    approvalRequired: approvalRequired(lines)
  };
}

export async function requestRecount(stocktakeId: string, lineIds: string[], staffId: string, notes = ''): Promise<StocktakeLine[]> {
  const record = await getStocktakeSessionById(stocktakeId);
  if (!record || record.status === 'Posted' || record.status === 'Cancelled') return [];
  const next = getLines().map((line) => (
    line.stocktakeId === stocktakeId && lineIds.includes(line.lineId)
      ? { ...line, lineStatus: 'Recount Required' as const, varianceRisk: riskRank(line.varianceRisk) >= 3 ? line.varianceRisk : 'High' as const, recountNotes: notes || 'Recount requested before approval/posting.' }
      : line
  ));
  saveLines(next);
  updateSession(stocktakeId, { status: 'Recount Requested', countMode: 'Recount' });
  await recordActivity({ stocktakeId, stocktakeNumber: record.stocktakeNumber, eventType: 'STOCKTAKE_RECOUNT_REQUESTED', operator: staffId, severity: 'High', message: `${record.stocktakeNumber} recount requested. Stock not changed.` });
  return getStocktakeLines(stocktakeId);
}

export async function submitStocktake(stocktakeId: string, staffId: string): Promise<StocktakeSession | null> {
  const record = await getStocktakeSessionById(stocktakeId);
  if (!record || ['Posted', 'Cancelled', 'Closed'].includes(record.status)) return null;
  const lines = await getStocktakeLines(stocktakeId);
  if (lines.length === 0 || lines.every((line) => line.countedQty === null || line.lineStatus === 'Excluded') || lines.some((line) => line.lineStatus === 'Recount Required')) {
    await recordActivity({ stocktakeId, stocktakeNumber: record.stocktakeNumber, eventType: 'STOCKTAKE_SUBMIT_BLOCKED', operator: staffId, severity: 'High', message: `${record.stocktakeNumber} submit blocked by missing counts or unresolved recount lines.` });
    return null;
  }
  const requiresApproval = approvalRequired(lines);
  const status: StocktakeSessionStatus = requiresApproval ? 'Pending Approval' : 'Submitted';
  const updated = updateSession(stocktakeId, { status, submittedAt: nowIso(), countedByStaffId: staffId, countedByStaffName: staffId });
  if (updated) {
    await recordActivity({ stocktakeId, stocktakeNumber: updated.stocktakeNumber, eventType: 'STOCKTAKE_SUBMITTED', operator: staffId, severity: topRisk(lines), message: `${updated.stocktakeNumber} submitted. Submitted stocktake does not affect stock.` });
    await recordActivity({ stocktakeId, stocktakeNumber: updated.stocktakeNumber, eventType: 'STOCKTAKE_VARIANCE_REVIEWED', operator: staffId, severity: topRisk(lines), message: `${updated.stocktakeNumber} variance review completed before approval/posting.` });
    if (requiresApproval) {
      await createOperationalApproval({
        vendorId: updated.vendorId,
        branchId: updated.branchId,
        branch: updated.branchId,
        category: 'Stocktake Variance',
        requestedBy: updated.requestedByStaffName,
        requestedByRole: 'Stock Controller',
        relatedRecord: updated.stocktakeNumber,
        amountOrValue: `USD ${Math.abs(lines.reduce((sum, line) => sum + line.valueImpact, 0)).toFixed(2)}`,
        risk: approvalRisk(lines),
        reason: 'Stocktake Variance Approval Required',
        context: 'Inventory / Stocktake Desk. Submitted and approved stocktakes do not change stock until Post Variance.',
        requiredPermission: 'approvals.approve'
      });
      await recordActivity({ stocktakeId, stocktakeNumber: updated.stocktakeNumber, eventType: 'STOCKTAKE_HIGH_RISK_VARIANCE', operator: staffId, severity: topRisk(lines), message: `${updated.stocktakeNumber} queued for approval before variance posting.` });
    }
  }
  return updated;
}

export async function approveStocktake(stocktakeId: string, staffId: string, notes = ''): Promise<StocktakeSession | null> {
  const record = await getStocktakeSessionById(stocktakeId);
  if (!record || (record.status !== 'Pending Approval' && record.status !== 'Submitted')) return null;
  const updated = updateSession(stocktakeId, {
    status: 'Approved',
    approvedByStaffId: staffId,
    approvedByStaffName: staffId,
    approvedAt: nowIso(),
    notes: notes ? `${record.notes}\nApproval: ${notes}` : record.notes
  });
  if (updated) {
    await recordActivity({ stocktakeId, stocktakeNumber: updated.stocktakeNumber, eventType: 'STOCKTAKE_APPROVED', operator: staffId, severity: 'Medium', message: `${updated.stocktakeNumber} approved. Approval does not affect stock until posting.` });
  }
  return updated;
}

export async function rejectStocktakePlaceholder(stocktakeId: string, staffId: string, notes = ''): Promise<StocktakeSession | null> {
  const record = await getStocktakeSessionById(stocktakeId);
  if (!record || record.status === 'Posted') return null;
  const updated = updateSession(stocktakeId, { status: 'Recount Requested', notes: `${record.notes}\nRejected placeholder: ${notes}` });
  if (updated) {
    await recordActivity({ stocktakeId, stocktakeNumber: updated.stocktakeNumber, eventType: 'STOCKTAKE_RECOUNT_REQUESTED', operator: staffId, severity: 'High', message: `${updated.stocktakeNumber} rejected placeholder. Recount required; stock not changed.` });
  }
  return updated;
}

export async function postStocktakeVariance(stocktakeId: string, staffId: string, options: { allowOwnerOverride?: boolean; hasPostPermission?: boolean } = {}): Promise<StocktakePostingResult | null> {
  const record = await getStocktakeSessionById(stocktakeId);
  if (!record) return null;
  if (options.hasPostPermission === false) {
    return { stocktakeId, stocktakeNumber: record.stocktakeNumber, status: record.status, stockPosted: false, postedLines: [], movements: [], message: 'You do not have permission to post stocktake variance.' };
  }
  if (record.status === 'Posted') {
    return { stocktakeId, stocktakeNumber: record.stocktakeNumber, status: record.status, stockPosted: false, postedLines: [], movements: [], message: 'Posted stocktake cannot be posted again.' };
  }
  if (record.status === 'Cancelled' || record.status === 'Closed') {
    return { stocktakeId, stocktakeNumber: record.stocktakeNumber, status: record.status, stockPosted: false, postedLines: [], movements: [], message: 'Stocktake must be approved before posting.' };
  }
  const lines = await getStocktakeLines(stocktakeId);
  const requiresApproval = approvalRequired(lines);
  const unresolvedRecount = lines.filter((line) => line.lineStatus === 'Recount Required');
  const invalidCount = lines.find((line) => line.lineStatus !== 'Excluded' && line.countedQty !== null && (!Number.isFinite(line.countedQty) || line.countedQty < 0));
  const approvalOverrideAllowed = Boolean(options.allowOwnerOverride && (record.status === 'Submitted' || record.status === 'Pending Approval'));
  if (record.status !== 'Approved' && !approvalOverrideAllowed) {
    await recordActivity({ stocktakeId, stocktakeNumber: record.stocktakeNumber, eventType: 'STOCKTAKE_POST_BLOCKED', operator: staffId, severity: 'High', message: `${record.stocktakeNumber} post blocked. Stocktake must be approved before posting.` });
    return { stocktakeId, stocktakeNumber: record.stocktakeNumber, status: record.status, stockPosted: false, postedLines: [], movements: [], message: 'Stocktake must be approved before posting.' };
  }
  if (requiresApproval && !record.approvedAt && !approvalOverrideAllowed) {
    await recordActivity({ stocktakeId, stocktakeNumber: record.stocktakeNumber, eventType: 'STOCKTAKE_POST_REVIEW_REQUIRED', operator: staffId, severity: topRisk(lines), message: `${record.stocktakeNumber} high-risk variance requires approval before posting.` });
    return { stocktakeId, stocktakeNumber: record.stocktakeNumber, status: record.status, stockPosted: false, postedLines: [], movements: [], message: 'Stocktake must be approved before posting.' };
  }
  if (unresolvedRecount.length > 0) {
    await recordActivity({ stocktakeId, stocktakeNumber: record.stocktakeNumber, eventType: 'STOCKTAKE_POST_BLOCKED', operator: staffId, severity: 'High', message: `${record.stocktakeNumber} post blocked. Recount lines must be resolved before posting.` });
    return { stocktakeId, stocktakeNumber: record.stocktakeNumber, status: record.status, stockPosted: false, postedLines: [], movements: [], message: 'Recount lines must be resolved before posting.' };
  }
  if (invalidCount) {
    await recordActivity({ stocktakeId, stocktakeNumber: record.stocktakeNumber, eventType: 'STOCKTAKE_POST_BLOCKED', operator: staffId, severity: 'High', message: `${record.stocktakeNumber} post blocked. Counted quantity cannot be negative.` });
    return { stocktakeId, stocktakeNumber: record.stocktakeNumber, status: record.status, stockPosted: false, postedLines: [], movements: [], message: 'Counted quantity cannot be negative.' };
  }
  const movements: InventoryMovement[] = [];
  const updatedLines: StocktakeLine[] = [];
  for (const line of lines) {
    if (line.lineStatus === 'Excluded' || line.countedQty === null || line.varianceQty === 0) continue;
    const balanceBefore = (await calculateRunningBalance(line.productId, record.warehouseId || '')) || line.systemQty;
    const balanceAfter = balanceBefore + line.varianceQty;
    if (balanceAfter < 0) {
      return { stocktakeId, stocktakeNumber: record.stocktakeNumber, status: record.status, stockPosted: false, postedLines: [], movements, message: `Negative resulting stock blocked for ${line.sku}.` };
    }
    const movement = await postStocktakeAdjustmentMovement({
      vendorId: record.vendorId,
      branchId: record.branchId,
      warehouseId: record.warehouseId || 'Main Warehouse',
      productId: line.productId,
      sku: line.sku,
      productName: line.productName,
      shelfLocation: line.shelfLocation,
      movementType: line.varianceQty > 0 ? 'STOCKTAKE_GAIN' : 'STOCKTAKE_LOSS',
      referenceType: 'STOCKTAKE',
      referenceNumber: record.stocktakeNumber,
      qtyIn: line.varianceQty > 0 ? line.varianceQty : 0,
      qtyOut: line.varianceQty < 0 ? Math.abs(line.varianceQty) : 0,
      balanceBefore,
      balanceAfter,
      unitCost: line.unitCost,
      sellingPrice: 0,
      staffId,
      staffName: staffId,
      movementDate: nowIso(),
      notes: `Stocktake ${record.stocktakeNumber} variance posted. Pending Accounting Review Placeholder only; no cashbook, supplier payment, sales or COGS posting.`,
      riskFlag: line.varianceRisk,
      approvalRequired: false,
      status: 'Posted'
    });
    movements.push(movement);
    await recordActivity({
      stocktakeId,
      stocktakeNumber: record.stocktakeNumber,
      eventType: line.varianceQty > 0 ? 'STOCKTAKE_GAIN_POSTED' : 'STOCKTAKE_LOSS_POSTED',
      operator: staffId,
      severity: line.varianceRisk,
      message: `${record.stocktakeNumber} ${line.varianceQty > 0 ? 'gain' : 'loss'} posted for ${line.sku}.`
    });
    updatedLines.push({ ...line, lineStatus: 'Posted', postedMovementId: movement.movementId });
  }
  const nextLines = getLines().map((line) => {
    if (line.stocktakeId !== stocktakeId) return line;
    const postedLine = updatedLines.find((updatedLine) => updatedLine.lineId === line.lineId);
    if (postedLine) return postedLine;
    if (line.lineStatus === 'Excluded' || line.countedQty === null) return line;
    return { ...line, lineStatus: 'Posted' as StocktakeLineStatus };
  });
  saveLines(nextLines);
  const updated = updateSession(stocktakeId, { status: 'Posted', postedByStaffId: staffId, postedByStaffName: staffId, postedAt: nowIso() });
  if (updated) {
    await recordActivity({ stocktakeId, stocktakeNumber: updated.stocktakeNumber, eventType: 'STOCKTAKE_VARIANCE_POSTED', operator: staffId, severity: topRisk(lines), message: `${updated.stocktakeNumber} posted. Inventory movements and product ledger rows created through movement service only.` });
    await recordActivity({ stocktakeId, stocktakeNumber: updated.stocktakeNumber, eventType: 'STOCKTAKE_POSTED_LOCKED', operator: staffId, severity: 'Low', message: `${updated.stocktakeNumber} posted and locked from editing.` });
  }
  return {
    stocktakeId,
    stocktakeNumber: record.stocktakeNumber,
    status: 'Posted',
    stockPosted: movements.length > 0,
    postedLines: updatedLines,
    movements,
    message: `${record.stocktakeNumber} posted. Variance movements created; no financial cashbook posting.`
  };
}

export async function cancelStocktake(stocktakeId: string, staffId: string, reason: string): Promise<StocktakeSession | null> {
  const record = await getStocktakeSessionById(stocktakeId);
  if (!record || record.status === 'Posted' || record.status === 'Closed') return null;
  const updated = updateSession(stocktakeId, { status: 'Cancelled', notes: `${record.notes}\nCancelled: ${reason}` });
  if (updated) {
    await recordActivity({ stocktakeId, stocktakeNumber: updated.stocktakeNumber, eventType: 'STOCKTAKE_CANCELLED', operator: staffId, severity: 'Medium', message: `${updated.stocktakeNumber} cancelled. Stock not changed.` });
  }
  return updated;
}

export async function exportStocktakePlaceholder(stocktakeId: string): Promise<{ message: string; payload: { record: StocktakeSession | null; lines: StocktakeLine[] } }> {
  const record = await getStocktakeSessionById(stocktakeId);
  const lines = record ? await getStocktakeLines(stocktakeId) : [];
  const identity = record ? getVendorDocumentIdentity({ vendorId: record.vendorId, branchId: record.branchId, warehouseId: record.warehouseId }) : null;
  return {
    message: record ? `${record.stocktakeNumber} export prepared for ${identity?.displayName || 'vendor'}.` : 'Stocktake not found.',
    payload: { record, lines }
  };
}

export async function getStocktakeActivityEvents(filters: StocktakeFilterState = {}): Promise<StocktakeActivityEvent[]> {
  const matchingIds = new Set((await getStocktakeSessions(filters)).map((record) => record.stocktakeId));
  const events = readList<StocktakeActivityEvent>(ACTIVITY_KEY, mockStocktakeActivityEvents, hasKeys('id', 'eventType'));
  return events
    .filter((event) => matchingIds.size === 0 || matchingIds.has(event.stocktakeId))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
