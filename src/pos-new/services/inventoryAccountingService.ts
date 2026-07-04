import {
  AccountingMappingRule,
  ChartOfAccountsPlaceholder,
  InventoryAccountingActivityEvent,
  InventoryAccountingFilterState,
  InventoryAccountingImpactType,
  InventoryAccountingReadinessLine,
  InventoryAccountingReadinessRecord,
  InventoryAccountingReadinessStatus,
  InventoryAccountingSourceType,
  InventoryAccountingSummary,
  InventoryMovement,
  InventoryMovementType
} from '../types';
import {
  mockAccountingMappingRules,
  mockChartOfAccountsPlaceholders,
  mockInventoryAccountingActivityEvents,
  mockInventoryAccountingReadinessLines,
  mockInventoryAccountingReadinessRecords
} from '../mock/mockPosData';
import { getInventoryMovementById } from './inventoryMovementService';
import { ENABLE_MOCK_SEED_DATA, getActiveVendorId, readVendorScopedList, writeVendorScopedList } from '../utils/vendorDataMode';

const RECORDS_KEY = 'sci_pos_inventory_accounting_readiness_records';
const LINES_KEY = 'sci_pos_inventory_accounting_readiness_lines';
const EVENTS_KEY = 'sci_pos_inventory_accounting_readiness_events';

let memoryRecords: InventoryAccountingReadinessRecord[] = ENABLE_MOCK_SEED_DATA ? [...mockInventoryAccountingReadinessRecords] : [];
let memoryLines: InventoryAccountingReadinessLine[] = ENABLE_MOCK_SEED_DATA ? [...mockInventoryAccountingReadinessLines] : [];

function readList<T>(key: string, fallback: T[]): T[] {
  return readVendorScopedList<T>(key, fallback);
}

function writeList<T>(key: string, rows: T[]): T[] {
  return writeVendorScopedList(key, rows);
}

function records(): InventoryAccountingReadinessRecord[] {
  memoryRecords = readList(RECORDS_KEY, memoryRecords);
  return memoryRecords;
}

function lines(): InventoryAccountingReadinessLine[] {
  memoryLines = readList(LINES_KEY, memoryLines);
  return memoryLines;
}

function saveRecords(rows: InventoryAccountingReadinessRecord[]): InventoryAccountingReadinessRecord[] {
  memoryRecords = rows;
  return writeList(RECORDS_KEY, rows);
}

function saveLines(rows: InventoryAccountingReadinessLine[]): InventoryAccountingReadinessLine[] {
  memoryLines = rows;
  return writeList(LINES_KEY, rows);
}

function addEvent(eventType: string, message: string, readinessId?: string, sourceNumber?: string, staffId = 'SYSTEM', notes?: string): InventoryAccountingActivityEvent[] {
  const current = readList(EVENTS_KEY, mockInventoryAccountingActivityEvents);
  const next: InventoryAccountingActivityEvent = {
    id: `IAR-ACT-${Date.now()}`,
    eventType,
    readinessId,
    sourceNumber,
    message,
    staffId,
    notes,
    createdAt: new Date().toISOString()
  };
  return writeList(EVENTS_KEY, [next, ...current].slice(0, 100));
}

function movementImpactType(type: InventoryMovementType): InventoryAccountingImpactType {
  if (type === 'GOODS_RECEIVED' || type === 'STOCK_ADJUSTMENT_IN') return 'Inventory Asset Increase';
  if (type === 'SUPPLIER_RETURN') return 'Supplier Return Credit Expected';
  if (type === 'STOCK_ADJUSTMENT_OUT') return 'Inventory Asset Decrease';
  if (type === 'WRITE_OFF' || type === 'DAMAGE_WRITEOFF') return 'Inventory Write Off';
  if (type === 'STOCKTAKE_GAIN' || type === 'STOCKTAKE_ADJUSTMENT_IN') return 'Stocktake Gain';
  if (type === 'STOCKTAKE_LOSS' || type === 'STOCKTAKE_ADJUSTMENT_OUT') return 'Stocktake Loss';
  if (type.includes('TRANSFER')) return 'Transfer Neutral';
  return 'Unknown Impact Review';
}

function sourceTypeForMovement(type: InventoryMovementType): InventoryAccountingSourceType {
  if (type === 'GOODS_RECEIVED') return 'GRN';
  if (type === 'SUPPLIER_RETURN') return 'Supplier Return';
  if (type.includes('STOCK_ADJUSTMENT') || type === 'WRITE_OFF' || type === 'DAMAGE_WRITEOFF') return 'Stock Adjustment';
  if (type.includes('STOCKTAKE')) return 'Stocktake';
  if (type.includes('TRANSFER')) return 'Stock Transfer';
  return 'Inventory Movement';
}

function riskForMovement(movement: InventoryMovement, impactType: InventoryAccountingImpactType): InventoryAccountingReadinessRecord['riskLevel'] {
  const value = Math.abs((movement.qtyIn - movement.qtyOut) * movement.unitCost);
  if (movement.riskFlag === 'Critical' || impactType === 'Stocktake Loss' && value >= 300) return 'Critical';
  if (movement.riskFlag === 'High' || impactType === 'Inventory Write Off' || value >= 150) return 'High';
  if (movement.riskFlag === 'Medium' || impactType === 'Supplier Return Credit Expected') return 'Medium';
  return 'Low';
}

function makeNumber(): string {
  return `IAR-${String(records().length + 1).padStart(4, '0')}`;
}

function mapLineAccounts(movementType: InventoryMovementType): Partial<InventoryAccountingReadinessLine> {
  const rule = mockAccountingMappingRules.find((item) => item.movementType === movementType);
  const debit = mockChartOfAccountsPlaceholders.find((account) => account.accountCode === rule?.debitAccountCode);
  const credit = mockChartOfAccountsPlaceholders.find((account) => account.accountCode === rule?.creditAccountCode);
  return {
    debitAccountCode: debit?.accountCode,
    debitAccountName: debit?.accountName,
    creditAccountCode: credit?.accountCode,
    creditAccountName: credit?.accountName,
    mappingStatus: rule?.mappingStatus || 'Unresolved'
  };
}

function filterRecords(rows: InventoryAccountingReadinessRecord[], filters: InventoryAccountingFilterState = {}): InventoryAccountingReadinessRecord[] {
  const fromTime = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`).getTime() : null;
  const toTime = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59`).getTime() : null;
  return rows.filter((row) => {
    const created = new Date(row.createdAt).getTime();
    return (!filters.readinessNumber || row.readinessNumber.toLowerCase().includes(filters.readinessNumber.toLowerCase())) &&
      (!filters.sourceType || filters.sourceType === 'ALL' || row.sourceType === filters.sourceType) &&
      (!filters.sourceNumber || row.sourceNumber.toLowerCase().includes(filters.sourceNumber.toLowerCase())) &&
      (!filters.movementType || filters.movementType === 'ALL' || row.movementType === filters.movementType) &&
      (!filters.impactType || filters.impactType === 'ALL' || row.impactType === filters.impactType) &&
      (!filters.branchId || filters.branchId === 'ALL' || row.branchId === filters.branchId || row.branchName === filters.branchId) &&
      (!filters.warehouseId || filters.warehouseId === 'ALL' || row.warehouseId === filters.warehouseId || row.warehouseName === filters.warehouseId) &&
      (!filters.status || filters.status === 'ALL' || row.status === filters.status) &&
      (!filters.riskLevel || filters.riskLevel === 'ALL' || row.riskLevel === filters.riskLevel) &&
      (fromTime === null || created >= fromTime) &&
      (toTime === null || created <= toTime);
  });
}

export async function getInventoryAccountingReadinessRecords(filters: InventoryAccountingFilterState = {}): Promise<InventoryAccountingReadinessRecord[]> {
  return filterRecords(records(), filters).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getInventoryAccountingReadinessById(readinessId: string): Promise<InventoryAccountingReadinessRecord | null> {
  return records().find((row) => row.readinessId === readinessId) || null;
}

export async function getInventoryAccountingReadinessLines(readinessId: string): Promise<InventoryAccountingReadinessLine[]> {
  return lines().filter((line) => line.readinessId === readinessId);
}

export async function getInventoryAccountingSummary(filters: InventoryAccountingFilterState = {}): Promise<InventoryAccountingSummary> {
  const rows = await getInventoryAccountingReadinessRecords(filters);
  return {
    pendingReview: rows.filter((row) => row.status === 'Pending Review').length,
    reviewed: rows.filter((row) => row.status === 'Reviewed').length,
    approvedForPosting: rows.filter((row) => row.status === 'Approved For Posting').length,
    onHold: rows.filter((row) => row.status === 'On Hold').length,
    highRisk: rows.filter((row) => row.riskLevel === 'High').length,
    critical: rows.filter((row) => row.riskLevel === 'Critical').length,
    inventoryIncreaseValue: rows.filter((row) => row.impactType === 'Inventory Asset Increase' || row.impactType === 'Stocktake Gain').reduce((sum, row) => sum + Math.abs(row.totalValueImpact), 0),
    inventoryDecreaseValue: rows.filter((row) => row.impactType === 'Inventory Asset Decrease' || row.impactType === 'Inventory Write Off' || row.impactType === 'Stocktake Loss').reduce((sum, row) => sum + Math.abs(row.totalValueImpact), 0),
    writeOffValue: rows.filter((row) => row.impactType === 'Inventory Write Off').reduce((sum, row) => sum + Math.abs(row.totalValueImpact), 0),
    stocktakeLossValue: rows.filter((row) => row.impactType === 'Stocktake Loss').reduce((sum, row) => sum + Math.abs(row.totalValueImpact), 0),
    supplierCreditExpected: rows.filter((row) => row.impactType === 'Supplier Return Credit Expected').reduce((sum, row) => sum + Math.abs(row.totalValueImpact), 0),
    transferNeutral: rows.filter((row) => row.impactType === 'Transfer Neutral').length
  };
}

export async function generateReadinessFromInventoryMovement(movementId: string): Promise<{ record: InventoryAccountingReadinessRecord | null; message: string }> {
  const existing = records().find((row) => row.movementId === movementId);
  if (existing) return { record: existing, message: 'Accounting review already exists for this movement.' };

  const movement = await getInventoryMovementById(movementId);
  if (!movement || movement.status !== 'Posted') return { record: null, message: 'Only posted inventory movements can prepare accounting review.' };

  const impactType = movementImpactType(movement.movementType);
  const totalValueImpact = impactType === 'Transfer Neutral' ? 0 : (movement.qtyIn - movement.qtyOut) * movement.unitCost;
  const now = new Date().toISOString();
  const readinessId = `IAR-ID-${Date.now()}`;
  const record: InventoryAccountingReadinessRecord = {
    readinessId,
    readinessNumber: makeNumber(),
    vendorId: movement.vendorId,
    sourceType: sourceTypeForMovement(movement.movementType),
    sourceId: movement.referenceNumber,
    sourceNumber: movement.referenceNumber,
    movementId: movement.movementId,
    movementType: movement.movementType,
    impactType,
    branchId: movement.branchId,
    branchName: movement.branchId,
    warehouseId: movement.warehouseId,
    warehouseName: movement.warehouseId,
    status: 'Pending Review',
    riskLevel: riskForMovement(movement, impactType),
    totalValueImpact,
    currency: 'USD',
    notes: 'Prepared from posted inventory movement. Review layer only; no journal, cashbook, bank, supplier payment, COGS or stock quantity posting.',
    createdAt: now,
    updatedAt: now
  };
  const line: InventoryAccountingReadinessLine = {
    lineId: `IAR-LINE-${Date.now()}`,
    readinessId,
    productId: movement.productId,
    sku: movement.sku,
    productName: movement.productName,
    movementType: movement.movementType,
    qtyIn: movement.qtyIn,
    qtyOut: movement.qtyOut,
    unitCost: movement.unitCost,
    valueImpact: totalValueImpact,
    ...mapLineAccounts(movement.movementType),
    mappingStatus: mapLineAccounts(movement.movementType).mappingStatus || 'Unresolved',
    notes: 'Mapping placeholder only.'
  };
  saveRecords([record, ...records()]);
  saveLines([line, ...lines()]);
  addEvent('INVENTORY_ACCOUNTING_REVIEW_PREPARED', 'Inventory accounting review prepared.', record.readinessId, record.sourceNumber);
  return { record, message: 'Inventory accounting review prepared.' };
}

async function generateBySource(sourceType: InventoryAccountingSourceType, sourceId: string, movementType: InventoryMovementType): Promise<{ record: InventoryAccountingReadinessRecord | null; message: string }> {
  const existing = records().find((row) => row.sourceId === sourceId || row.sourceNumber === sourceId);
  if (existing) return { record: existing, message: 'Accounting review already exists for this source.' };
  const now = new Date().toISOString();
  const impactType = sourceType === 'Stock Transfer' ? 'Transfer Neutral' : movementImpactType(movementType);
  const readinessId = `IAR-ID-${Date.now()}`;
  const record: InventoryAccountingReadinessRecord = {
    readinessId,
    readinessNumber: makeNumber(),
    vendorId: getActiveVendorId(),
    sourceType,
    sourceId,
    sourceNumber: sourceId,
    movementType,
    impactType,
    branchId: 'main-branch',
    branchName: 'Main Branch',
    warehouseId: 'main-warehouse',
    warehouseName: 'Main Warehouse',
    status: 'Pending Review',
    riskLevel: impactType === 'Transfer Neutral' ? 'Low' : 'Medium',
    totalValueImpact: impactType === 'Transfer Neutral' ? 0 : 125,
    currency: 'USD',
    notes: `${sourceType} accounting review prepared only when source is posted.`,
    createdAt: now,
    updatedAt: now
  };
  saveRecords([record, ...records()]);
  addEvent('INVENTORY_ACCOUNTING_REVIEW_PREPARED', `${sourceType} accounting review prepared.`, record.readinessId, record.sourceNumber);
  return { record, message: 'Inventory accounting review prepared.' };
}

export async function generateReadinessFromGRN(grnId: string) { return generateBySource('GRN', grnId, 'GOODS_RECEIVED'); }
export async function generateReadinessFromSupplierReturn(supplierReturnId: string) { return generateBySource('Supplier Return', supplierReturnId, 'SUPPLIER_RETURN'); }
export async function generateReadinessFromStockAdjustment(adjustmentId: string) { return generateBySource('Stock Adjustment', adjustmentId, 'STOCK_ADJUSTMENT_OUT'); }
export async function generateReadinessFromStocktake(stocktakeId: string) { return generateBySource('Stocktake', stocktakeId, 'STOCKTAKE_LOSS'); }
export async function generateReadinessFromStockTransfer(transferId: string) { return generateBySource('Stock Transfer', transferId, 'BRANCH_TRANSFER_OUT'); }

async function updateStatus(readinessId: string, status: InventoryAccountingReadinessStatus, staffId: string, notes: string, eventType: string): Promise<InventoryAccountingReadinessRecord | null> {
  let updated: InventoryAccountingReadinessRecord | null = null;
  const now = new Date().toISOString();
  saveRecords(records().map((record) => {
    if (record.readinessId !== readinessId) return record;
    updated = {
      ...record,
      status,
      reviewedByStaffId: status === 'Reviewed' ? staffId : record.reviewedByStaffId,
      reviewedByStaffName: status === 'Reviewed' ? staffId : record.reviewedByStaffName,
      approvedByStaffId: status === 'Approved For Posting' ? staffId : record.approvedByStaffId,
      approvedByStaffName: status === 'Approved For Posting' ? staffId : record.approvedByStaffName,
      notes: notes ? `${record.notes} | ${notes}` : record.notes,
      updatedAt: now
    };
    return updated;
  }));
  if (updated) addEvent(eventType, `Inventory accounting readiness ${status}.`, readinessId, updated.sourceNumber, staffId, notes);
  return updated;
}

export async function reviewInventoryAccountingRecord(readinessId: string, staffId: string, notes: string) { return updateStatus(readinessId, 'Reviewed', staffId, notes, 'INVENTORY_ACCOUNTING_REVIEWED'); }
export async function approveInventoryAccountingRecord(readinessId: string, staffId: string, notes: string) { return updateStatus(readinessId, 'Approved For Posting', staffId, notes, 'INVENTORY_ACCOUNTING_APPROVED_FOR_POSTING'); }
export async function rejectInventoryAccountingRecord(readinessId: string, staffId: string, notes: string) { if (!notes.trim()) return null; return updateStatus(readinessId, 'Rejected', staffId, notes, 'INVENTORY_ACCOUNTING_REJECTED'); }
export async function holdInventoryAccountingRecord(readinessId: string, staffId: string, notes: string) { if (!notes.trim()) return null; return updateStatus(readinessId, 'On Hold', staffId, notes, 'INVENTORY_ACCOUNTING_ON_HOLD'); }
export async function markPostedPlaceholder(readinessId: string, staffId: string, notes: string) { return updateStatus(readinessId, 'Posted Placeholder', staffId, notes || 'Marked posted placeholder only. No final journal created.', 'INVENTORY_ACCOUNTING_POSTED_PLACEHOLDER'); }

export async function getAccountingMappingRules(): Promise<AccountingMappingRule[]> { return mockAccountingMappingRules; }
export async function getChartOfAccountsPlaceholders(): Promise<ChartOfAccountsPlaceholder[]> { return mockChartOfAccountsPlaceholders; }
export async function exportInventoryAccountingPlaceholder(filters: InventoryAccountingFilterState = {}): Promise<{ message: string; filters: InventoryAccountingFilterState }> {
  addEvent('ACCOUNTING_REPORT_EXPORT_PREPARED', 'Inventory accounting readiness export placeholder prepared.');
  return { message: 'Inventory accounting readiness export placeholder prepared.', filters };
}
export async function getInventoryAccountingActivityEvents(): Promise<InventoryAccountingActivityEvent[]> {
  return readList(EVENTS_KEY, mockInventoryAccountingActivityEvents);
}
