import {
  InventoryMovement,
  InventoryMovementType,
  Product,
  StockTransfer,
  StockTransferActivityEvent,
  StockTransferActivityEventType,
  StockTransferDispatch,
  StockTransferFilterState,
  StockTransferLine,
  StockTransferLineStatus,
  StockTransferReceive,
  StockTransferStatus,
  StockTransferSummary,
  StockTransferType,
  StockTransferVariance,
  StockTransferVarianceType
} from '../types';
import {
  mockProducts,
  mockStockTransferActivityEvents,
  mockStockTransferDispatches,
  mockStockTransferLines,
  mockStockTransferReceipts,
  mockStockTransferVariances,
  mockStockTransfers
} from '../mock/mockPosData';
import { calculateRunningBalance, postTransferMovement } from './inventoryMovementService';
import { createOperationalApproval } from './approvalService';

const TRANSFER_KEY = 'itred_pos_stock_transfers_v1';
const LINE_KEY = 'itred_pos_stock_transfer_lines_v1';
const DISPATCH_KEY = 'itred_pos_stock_transfer_dispatches_v1';
const RECEIVE_KEY = 'itred_pos_stock_transfer_receipts_v1';
const VARIANCE_KEY = 'itred_pos_stock_transfer_variances_v1';
const ACTIVITY_KEY = 'itred_pos_stock_transfer_activity_v1';

export interface StockTransferDraftPayload {
  vendorId: string;
  transferType: StockTransferType;
  sourceBranchId: string;
  sourceBranchName: string;
  sourceWarehouseId: string;
  sourceWarehouseName: string;
  destinationBranchId: string;
  destinationBranchName: string;
  destinationWarehouseId: string;
  destinationWarehouseName: string;
  requestedByStaffId: string;
  requestedByStaffName: string;
  expectedArrivalDate: string;
  priority: StockTransfer['priority'];
  reason: string;
  transportMethod: string;
  courierReference?: string;
  driverName?: string;
  driverPhone?: string;
  notes?: string;
}

export interface StockTransferDispatchPayload {
  transportMethod?: string;
  courierReference?: string;
  driverName?: string;
  driverPhone?: string;
  notes?: string;
}

export interface StockTransferReceivePayload {
  notes?: string;
}

function canUseLocalStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

function readList<T>(key: string, fallback: T[], validator: (value: unknown) => boolean): T[] {
  if (!canUseLocalStorage()) return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(fallback));
      return fallback;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every(validator) ? parsed as T[] : fallback;
  } catch {
    try {
      localStorage.setItem(key, JSON.stringify(fallback));
    } catch {
      // localStorage can be blocked.
    }
    return fallback;
  }
}

function saveList<T>(key: string, value: T[]): T[] {
  if (canUseLocalStorage()) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // localStorage can be blocked.
    }
  }
  return value;
}

function hasKeys(...keys: string[]) {
  return (value: unknown): boolean => typeof value === 'object' && value !== null && keys.every((key) => key in value);
}

function nowIso(): string {
  return new Date().toISOString();
}

function transfers(): StockTransfer[] {
  return readList<StockTransfer>(TRANSFER_KEY, mockStockTransfers, hasKeys('transferId', 'transferNumber', 'status'));
}

function lines(): StockTransferLine[] {
  return readList<StockTransferLine>(LINE_KEY, mockStockTransferLines, hasKeys('lineId', 'transferId', 'sku'));
}

function dispatches(): StockTransferDispatch[] {
  return readList<StockTransferDispatch>(DISPATCH_KEY, mockStockTransferDispatches, hasKeys('dispatchId', 'transferId'));
}

function receipts(): StockTransferReceive[] {
  return readList<StockTransferReceive>(RECEIVE_KEY, mockStockTransferReceipts, hasKeys('receiveId', 'transferId'));
}

function variances(): StockTransferVariance[] {
  return readList<StockTransferVariance>(VARIANCE_KEY, mockStockTransferVariances, hasKeys('varianceId', 'transferId'));
}

function activities(): StockTransferActivityEvent[] {
  return readList<StockTransferActivityEvent>(ACTIVITY_KEY, mockStockTransferActivityEvents, hasKeys('id', 'eventType'));
}

function saveTransfers(value: StockTransfer[]) { return saveList(TRANSFER_KEY, value); }
function saveLines(value: StockTransferLine[]) { return saveList(LINE_KEY, value); }
function saveDispatches(value: StockTransferDispatch[]) { return saveList(DISPATCH_KEY, value); }
function saveReceipts(value: StockTransferReceive[]) { return saveList(RECEIVE_KEY, value); }
function saveVariances(value: StockTransferVariance[]) { return saveList(VARIANCE_KEY, value); }

async function recordActivity(input: Omit<StockTransferActivityEvent, 'id' | 'createdAt'>): Promise<void> {
  saveList(ACTIVITY_KEY, [{
    ...input,
    id: `TRF-ACT-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`,
    createdAt: nowIso()
  }, ...activities()].slice(0, 150));
}

function updateTransfer(transferId: string, patch: Partial<StockTransfer>): StockTransfer | null {
  let updated: StockTransfer | null = null;
  saveTransfers(transfers().map((transfer) => {
    if (transfer.transferId !== transferId) return transfer;
    updated = { ...transfer, ...patch, updatedAt: nowIso() };
    return updated;
  }));
  return updated;
}

function updateLine(transferId: string, lineId: string, patch: Partial<StockTransferLine>): StockTransferLine | null {
  let updated: StockTransferLine | null = null;
  saveLines(lines().map((line) => {
    if (line.transferId !== transferId || line.lineId !== lineId) return line;
    const next = { ...line, ...patch };
    updated = { ...next, ...recalculateLine(next) };
    return updated;
  }));
  return updated;
}

function recalculateLine(line: StockTransferLine): Pick<StockTransferLine, 'qtyOutstanding' | 'valueImpact' | 'varianceType' | 'lineStatus'> {
  const qtyOutstanding = Math.max(line.qtyDispatched - line.qtyAccepted - line.qtyRejected, 0);
  const varianceType = calculateTransferVariance(line);
  let lineStatus: StockTransferLineStatus = line.lineStatus;
  if (line.lineStatus !== 'Cancelled' && line.lineStatus !== 'Closed Outstanding') {
    if (line.qtyAccepted + line.qtyRejected >= line.qtyDispatched && line.qtyDispatched > 0) lineStatus = varianceType === 'Short Received' ? 'Short Received' : varianceType === 'Over Received' ? 'Over Received' : 'Fully Received';
    else if (line.qtyReceived > 0) lineStatus = 'Partially Received';
    else if (line.qtyDispatched > 0) lineStatus = line.qtyDispatched < line.qtyApproved ? 'Partially Dispatched' : 'In Transit';
    else if (line.qtyApproved > 0) lineStatus = 'Approved';
    else if (line.qtyRequested > 0) lineStatus = 'Requested';
  }
  return { qtyOutstanding, valueImpact: line.qtyApproved * line.unitCost, varianceType, lineStatus };
}

function statusFromLines(transferLines: StockTransferLine[], fallback: StockTransferStatus): StockTransferStatus {
  if (transferLines.length === 0) return fallback;
  if (transferLines.some((line) => line.varianceType !== 'None' && !line.receiptPosted)) return 'Variance Review';
  if (transferLines.every((line) => line.lineStatus === 'Fully Received' || line.lineStatus === 'Cancelled' || line.lineStatus === 'Closed Outstanding')) return 'Fully Received';
  if (transferLines.some((line) => line.qtyReceived > 0 || line.qtyAccepted > 0 || line.qtyRejected > 0)) return 'Partially Received';
  if (transferLines.some((line) => line.qtyDispatched > 0)) return transferLines.every((line) => line.qtyDispatched >= line.qtyApproved) ? 'In Transit' : 'Partially Dispatched';
  return fallback;
}

function movementTypeFor(transfer: StockTransfer, direction: 'IN' | 'OUT'): InventoryMovementType {
  return transfer.transferType.includes('Warehouse') ? `WAREHOUSE_TRANSFER_${direction}` as InventoryMovementType : `BRANCH_TRANSFER_${direction}` as InventoryMovementType;
}

function productById(productId: string): Product | undefined {
  return mockProducts.find((product) => product.id === productId);
}

export async function getStockTransfers(filters: StockTransferFilterState = {}): Promise<StockTransfer[]> {
  const transferLines = lines();
  const fromTime = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`).getTime() : null;
  const toTime = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59`).getTime() : null;
  return transfers().filter((transfer) => {
    const linkedLines = transferLines.filter((line) => line.transferId === transfer.transferId);
    const transferTime = new Date(`${transfer.transferDate}T00:00:00`).getTime();
    const query = filters.productOrSku?.trim().toLowerCase();
    return (!filters.transferNumber || transfer.transferNumber.toLowerCase().includes(filters.transferNumber.toLowerCase())) &&
      (!filters.transferType || filters.transferType === 'ALL' || transfer.transferType === filters.transferType) &&
      (!filters.sourceBranch || filters.sourceBranch === 'ALL' || transfer.sourceBranchName === filters.sourceBranch || transfer.sourceBranchId === filters.sourceBranch) &&
      (!filters.sourceWarehouse || filters.sourceWarehouse === 'ALL' || transfer.sourceWarehouseName === filters.sourceWarehouse || transfer.sourceWarehouseId === filters.sourceWarehouse) &&
      (!filters.destinationBranch || filters.destinationBranch === 'ALL' || transfer.destinationBranchName === filters.destinationBranch || transfer.destinationBranchId === filters.destinationBranch) &&
      (!filters.destinationWarehouse || filters.destinationWarehouse === 'ALL' || transfer.destinationWarehouseName === filters.destinationWarehouse || transfer.destinationWarehouseId === filters.destinationWarehouse) &&
      (!filters.status || filters.status === 'ALL' || transfer.status === filters.status) &&
      (!query || linkedLines.some((line) => `${line.sku} ${line.productName}`.toLowerCase().includes(query))) &&
      (!filters.requestedBy || transfer.requestedByStaffName.toLowerCase().includes(filters.requestedBy.toLowerCase())) &&
      (!filters.varianceType || filters.varianceType === 'ALL' || linkedLines.some((line) => line.varianceType === filters.varianceType)) &&
      (fromTime === null || transferTime >= fromTime) &&
      (toTime === null || transferTime <= toTime);
  }).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function getStockTransferById(transferId: string): Promise<StockTransfer | null> {
  return transfers().find((transfer) => transfer.transferId === transferId) || null;
}

export async function getStockTransferLines(transferId: string): Promise<StockTransferLine[]> {
  return lines().filter((line) => line.transferId === transferId);
}

export async function getStockTransferSummary(filters: StockTransferFilterState = {}): Promise<StockTransferSummary> {
  const records = await getStockTransfers(filters);
  const ids = new Set(records.map((record) => record.transferId));
  const transferLines = lines().filter((line) => ids.has(line.transferId));
  return {
    draftTransfers: records.filter((record) => record.status === 'Draft').length,
    pendingApproval: records.filter((record) => record.status === 'Pending Approval').length,
    approved: records.filter((record) => record.status === 'Approved').length,
    inTransit: records.filter((record) => record.status === 'In Transit' || record.status === 'Dispatched' || record.status === 'Partially Dispatched').length,
    partiallyReceived: records.filter((record) => record.status === 'Partially Received').length,
    varianceReview: records.filter((record) => record.status === 'Variance Review').length,
    fullyReceived: records.filter((record) => record.status === 'Fully Received').length,
    closedOutstanding: records.filter((record) => record.status === 'Closed With Outstanding').length,
    transferQty: transferLines.reduce((sum, line) => sum + line.qtyRequested, 0),
    transferValue: transferLines.reduce((sum, line) => sum + line.valueImpact, 0)
  };
}

export async function createStockTransferDraft(payload: StockTransferDraftPayload): Promise<StockTransfer> {
  const transferNumber = `TRF-${String(transfers().length + 1).padStart(4, '0')}`;
  const record: StockTransfer = {
    ...payload,
    transferId: `TRF-ID-${Date.now()}`,
    transferNumber,
    transferDate: nowIso().slice(0, 10),
    status: 'Draft',
    notes: payload.notes || 'Draft transfer request. No stock movement.',
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  saveTransfers([record, ...transfers()]);
  await recordActivity({ transferId: record.transferId, transferNumber, eventType: 'STOCK_TRANSFER_DRAFT_CREATED', operator: payload.requestedByStaffName, severity: 'Low', message: `${transferNumber} draft created. Stock not changed.` });
  return record;
}

export async function updateStockTransferDraft(transferId: string, patch: Partial<StockTransfer>): Promise<StockTransfer | null> {
  const record = await getStockTransferById(transferId);
  if (!record || record.status !== 'Draft') return null;
  return updateTransfer(transferId, patch);
}

export async function addStockTransferLine(transferId: string, line: Omit<StockTransferLine, 'lineId' | 'transferId' | 'qtyOutstanding' | 'valueImpact' | 'lineStatus' | 'varianceType'>): Promise<StockTransferLine | null> {
  const record = await getStockTransferById(transferId);
  if (!record || record.status !== 'Draft' || line.qtyRequested <= 0) return null;
  const nextBase: StockTransferLine = {
    ...line,
    transferId,
    lineId: `TRF-LINE-${Date.now()}`,
    qtyOutstanding: line.qtyRequested,
    valueImpact: line.qtyRequested * line.unitCost,
    lineStatus: 'Requested',
    varianceType: 'None'
  };
  saveLines([nextBase, ...lines()]);
  return nextBase;
}

export async function updateStockTransferLine(transferId: string, lineId: string, patch: Partial<StockTransferLine>): Promise<StockTransferLine | null> {
  const record = await getStockTransferById(transferId);
  if (!record || record.status === 'Fully Received' || record.status === 'Closed With Outstanding' || record.status === 'Cancelled') return null;
  return updateLine(transferId, lineId, patch);
}

export async function removeStockTransferLine(transferId: string, lineId: string): Promise<boolean> {
  const record = await getStockTransferById(transferId);
  if (!record || record.status !== 'Draft') return false;
  saveLines(lines().filter((line) => line.transferId !== transferId || line.lineId !== lineId));
  return true;
}

export async function submitStockTransferForApproval(transferId: string): Promise<StockTransfer | null> {
  const record = await getStockTransferById(transferId);
  const transferLines = await getStockTransferLines(transferId);
  if (!record || record.status !== 'Draft' || transferLines.length === 0) return null;
  const totalValue = transferLines.reduce((sum, line) => sum + line.valueImpact, 0);
  const updated = updateTransfer(transferId, { status: totalValue > 150 ? 'Pending Approval' : 'Approved' });
  if (updated) {
    saveLines(lines().map((line) => line.transferId === transferId ? { ...line, lineStatus: totalValue > 150 ? 'Requested' : 'Approved', qtyApproved: totalValue > 150 ? line.qtyApproved : line.qtyRequested } : line));
    await recordActivity({ transferId, transferNumber: updated.transferNumber, eventType: 'STOCK_TRANSFER_SUBMITTED_FOR_APPROVAL', operator: updated.requestedByStaffName, severity: totalValue > 150 ? 'Medium' : 'Low', message: `${updated.transferNumber} submitted. Transfer request does not affect stock.` });
    if (totalValue > 150) {
      await createOperationalApproval({ vendorId: updated.vendorId, branchId: updated.sourceBranchId, branch: updated.sourceBranchName, category: 'Stock Transfer', requestedBy: updated.requestedByStaffName, requestedByRole: 'Stock Controller', relatedRecord: updated.transferNumber, amountOrValue: `USD ${totalValue.toFixed(2)}`, risk: totalValue > 500 ? 'High' : 'Medium', reason: 'Stock transfer approval required', context: 'Inventory / Stock Transfers. Stock only moves on dispatch and destination receipt posting.', requiredPermission: 'approvals.approve' });
    }
  }
  return updated;
}

export async function approveStockTransfer(transferId: string, staffId: string, notes = ''): Promise<StockTransfer | null> {
  const record = await getStockTransferById(transferId);
  if (!record || (record.status !== 'Pending Approval' && record.status !== 'Draft')) return null;
  const updated = updateTransfer(transferId, { status: 'Approved', approvedByStaffId: staffId, approvedByStaffName: staffId, notes: notes ? `${record.notes}\nApproval: ${notes}` : record.notes });
  if (updated) {
    saveLines(lines().map((line) => line.transferId === transferId ? { ...line, qtyApproved: line.qtyApproved || line.qtyRequested, lineStatus: 'Approved' } : line));
    await recordActivity({ transferId, transferNumber: updated.transferNumber, eventType: 'STOCK_TRANSFER_APPROVED', operator: staffId, severity: 'Low', message: `${updated.transferNumber} approved. Stock not changed until dispatch.` });
  }
  return updated;
}

export async function rejectStockTransfer(transferId: string, staffId: string, notes = ''): Promise<StockTransfer | null> {
  const record = await getStockTransferById(transferId);
  if (!record || record.status === 'Closed With Outstanding') return null;
  const updated = updateTransfer(transferId, { status: 'Rejected', notes: `${record.notes}\nRejected: ${notes}` });
  if (updated) await recordActivity({ transferId, transferNumber: updated.transferNumber, eventType: 'STOCK_TRANSFER_REJECTED', operator: staffId, severity: 'Medium', message: `${updated.transferNumber} rejected. Stock not changed.` });
  return updated;
}

export async function dispatchStockTransfer(transferId: string, staffId: string, dispatchPayload: StockTransferDispatchPayload = {}): Promise<{ transfer: StockTransfer | null; movements: InventoryMovement[]; message: string }> {
  const record = await getStockTransferById(transferId);
  if (!record || record.status !== 'Approved') return { transfer: record, movements: [], message: 'Transfer must be approved before dispatch.' };
  const transferLines = (await getStockTransferLines(transferId)).filter((line) => line.qtyApproved > 0 && !line.dispatchPosted);
  if (transferLines.length === 0) return { transfer: record, movements: [], message: 'No approved lines are available to dispatch.' };
  const movements: InventoryMovement[] = [];
  for (const line of transferLines) {
    const product = productById(line.productId);
    const balanceBefore = (await calculateRunningBalance(line.productId, record.sourceWarehouseId)) || product?.stock || 0;
    const qtyDispatched = line.qtyDispatched || line.qtyApproved;
    if (qtyDispatched <= 0 || balanceBefore < qtyDispatched) {
      await recordActivity({ transferId, transferNumber: record.transferNumber, eventType: 'STOCK_TRANSFER_SOURCE_STOCK_BLOCKED', operator: staffId, severity: 'High', message: `${record.transferNumber} dispatch blocked for ${line.sku}. Source available ${balanceBefore}, dispatch ${qtyDispatched}.` });
      return { transfer: record, movements, message: 'Source stock is not enough for one or more transfer lines.' };
    }
    const movement = await postTransferMovement({ vendorId: record.vendorId, branchId: record.sourceBranchId, warehouseId: record.sourceWarehouseId, productId: line.productId, sku: line.sku, productName: line.productName, shelfLocation: line.sourceShelfLocation, movementType: movementTypeFor(record, 'OUT'), referenceType: 'STOCK_TRANSFER', referenceNumber: record.transferNumber, transferId: record.transferId, qtyIn: 0, qtyOut: qtyDispatched, balanceBefore, balanceAfter: Math.max(balanceBefore - qtyDispatched, 0), unitCost: line.unitCost, sellingPrice: 0, staffId, staffName: staffId, movementDate: nowIso(), notes: `Transfer dispatch from ${record.sourceBranchName} / ${record.sourceWarehouseName} to ${record.destinationBranchName} / ${record.destinationWarehouseName}. Destination stock not increased until receipt posting. Pending accounting review placeholder only. ${dispatchPayload.notes || ''}`, riskFlag: 'Medium', approvalRequired: false, status: 'Posted' });
    movements.push(movement);
    updateLine(transferId, line.lineId, { qtyDispatched, dispatchPosted: true, dispatchMovementId: movement.movementId, lineStatus: qtyDispatched < line.qtyApproved ? 'Partially Dispatched' : 'In Transit' });
  }
  saveDispatches([{ dispatchId: `TRF-DSP-${Date.now()}`, transferId, dispatchedByStaffId: staffId, dispatchedByStaffName: staffId, dispatchDate: nowIso(), transportMethod: dispatchPayload.transportMethod || record.transportMethod, courierReference: dispatchPayload.courierReference || record.courierReference, driverName: dispatchPayload.driverName || record.driverName, driverPhone: dispatchPayload.driverPhone || record.driverPhone, notes: dispatchPayload.notes || 'Transfer dispatched.' }, ...dispatches()]);
  const updatedLines = await getStockTransferLines(transferId);
  const updated = updateTransfer(transferId, { status: statusFromLines(updatedLines, 'In Transit'), dispatchedByStaffId: staffId, dispatchedByStaffName: staffId, dispatchDate: nowIso(), transportMethod: dispatchPayload.transportMethod || record.transportMethod, courierReference: dispatchPayload.courierReference || record.courierReference, driverName: dispatchPayload.driverName || record.driverName, driverPhone: dispatchPayload.driverPhone || record.driverPhone });
  if (updated) await recordActivity({ transferId, transferNumber: updated.transferNumber, eventType: updated.status === 'Partially Dispatched' ? 'STOCK_TRANSFER_PARTIALLY_DISPATCHED' : 'STOCK_TRANSFER_IN_TRANSIT', operator: staffId, severity: 'Medium', message: `${updated.transferNumber} dispatched. Source movement posted; destination stock not increased.` });
  return { transfer: updated, movements, message: `${record.transferNumber} dispatched. Source stock movement posted only.` };
}

export async function updateTransferDispatchLine(transferId: string, lineId: string, patch: Partial<StockTransferLine>): Promise<StockTransferLine | null> {
  return updateStockTransferLine(transferId, lineId, patch);
}

export async function receiveStockTransfer(transferId: string, staffId: string, receivePayload: StockTransferReceivePayload = {}): Promise<StockTransfer | null> {
  const record = await getStockTransferById(transferId);
  if (!record || !['Dispatched', 'Partially Dispatched', 'In Transit', 'Partially Received', 'Variance Review'].includes(record.status)) return null;
  const updatedLines = (await getStockTransferLines(transferId)).map((line) => {
    const next = recalculateLine(line);
    if (next.varianceType !== 'None') {
      const existing = variances().some((variance) => variance.transferId === transferId && variance.lineId === line.lineId && variance.varianceType === next.varianceType);
      if (!existing) {
        saveVariances([{ varianceId: `TRF-VAR-${Date.now()}-${line.lineId}`, transferId, lineId: line.lineId, varianceType: next.varianceType, severity: next.varianceType === 'Short Received' ? 'High' : 'Medium', message: `${line.sku} ${next.varianceType}.`, approvalRequired: true, resolved: false }, ...variances()]);
      }
    }
    return { ...line, ...next };
  });
  saveLines(lines().map((line) => updatedLines.find((updatedLine) => updatedLine.lineId === line.lineId) || line));
  saveReceipts([{ receiveId: `TRF-REC-${Date.now()}`, transferId, receivedByStaffId: staffId, receivedByStaffName: staffId, receivedDate: nowIso(), notes: receivePayload.notes || 'Receive draft captured. Destination stock not increased until Post Receipt.' }, ...receipts()]);
  const status = statusFromLines(updatedLines, 'Partially Received');
  const updated = updateTransfer(transferId, { status, receivedByStaffId: staffId, receivedByStaffName: staffId, receivedDate: nowIso() });
  if (updated) await recordActivity({ transferId, transferNumber: updated.transferNumber, eventType: status === 'Variance Review' ? 'STOCK_TRANSFER_VARIANCE_FOUND' : status === 'Partially Received' ? 'STOCK_TRANSFER_PARTIALLY_RECEIVED' : 'STOCK_TRANSFER_RECEIVED', operator: staffId, severity: status === 'Variance Review' ? 'High' : 'Low', message: `${updated.transferNumber} receive draft captured. Destination stock not increased.` });
  return updated;
}

export async function updateTransferReceiveLine(transferId: string, lineId: string, patch: Partial<StockTransferLine>): Promise<StockTransferLine | null> {
  const line = lines().find((item) => item.transferId === transferId && item.lineId === lineId);
  if (!line) return null;
  const qtyReceived = patch.qtyReceived ?? line.qtyReceived;
  const qtyAccepted = patch.qtyAccepted ?? line.qtyAccepted;
  const qtyRejected = patch.qtyRejected ?? line.qtyRejected;
  if (qtyReceived < 0 || qtyAccepted < 0 || qtyRejected < 0 || qtyAccepted + qtyRejected > qtyReceived) return null;
  return updateLine(transferId, lineId, patch);
}

export async function postTransferReceipt(transferId: string, staffId: string): Promise<{ transfer: StockTransfer | null; movements: InventoryMovement[]; message: string }> {
  const record = await getStockTransferById(transferId);
  if (!record || !['Partially Received', 'Fully Received', 'Variance Review', 'In Transit'].includes(record.status)) return { transfer: record, movements: [], message: 'Receive draft must be captured before posting destination stock.' };
  const transferLines = (await getStockTransferLines(transferId)).filter((line) => line.qtyAccepted > 0 && !line.receiptPosted);
  if (transferLines.length === 0) return { transfer: record, movements: [], message: 'No accepted quantities are available for destination posting.' };
  const movements: InventoryMovement[] = [];
  for (const line of transferLines) {
    const balanceBefore = await calculateRunningBalance(line.productId, record.destinationWarehouseId);
    const movement = await postTransferMovement({ vendorId: record.vendorId, branchId: record.destinationBranchId, warehouseId: record.destinationWarehouseId, productId: line.productId, sku: line.sku, productName: line.productName, shelfLocation: line.destinationShelfLocation, movementType: movementTypeFor(record, 'IN'), referenceType: 'STOCK_TRANSFER', referenceNumber: record.transferNumber, transferId: record.transferId, qtyIn: line.qtyAccepted, qtyOut: 0, balanceBefore, balanceAfter: balanceBefore + line.qtyAccepted, unitCost: line.unitCost, sellingPrice: 0, staffId, staffName: staffId, movementDate: nowIso(), notes: `Transfer receipt posted to ${record.destinationBranchName} / ${record.destinationWarehouseName}. Rejected or damaged quantity excluded from available stock. Pending accounting review placeholder only.`, riskFlag: line.varianceType === 'None' ? 'Low' : 'High', approvalRequired: line.varianceType !== 'None', status: 'Posted' });
    movements.push(movement);
    updateLine(transferId, line.lineId, { receiptPosted: true, receiptMovementId: movement.movementId, lineStatus: line.qtyOutstanding > 0 ? 'Partially Received' : 'Fully Received' });
  }
  const updatedLines = await getStockTransferLines(transferId);
  const status = statusFromLines(updatedLines, 'Fully Received');
  const updated = updateTransfer(transferId, { status, receivedByStaffId: staffId, receivedByStaffName: staffId, receivedDate: nowIso() });
  if (updated) await recordActivity({ transferId, transferNumber: updated.transferNumber, eventType: 'STOCK_TRANSFER_RECEIPT_POSTED', operator: staffId, severity: status === 'Variance Review' ? 'High' : 'Low', message: `${updated.transferNumber} destination receipt posted. Accepted quantity only entered destination available stock.` });
  return { transfer: updated, movements, message: `${record.transferNumber} destination receipt posted. Accepted quantity only entered destination stock.` };
}

export function calculateTransferVariance(line: StockTransferLine): StockTransferVarianceType {
  if (line.qtyRejected > 0) return 'Damaged In Transit';
  if (line.qtyReceived > line.qtyDispatched && line.qtyDispatched > 0) return 'Over Received';
  if (line.qtyReceived > 0 && line.qtyReceived < line.qtyDispatched) return 'Short Received';
  if (line.qtyDispatched > 0 && line.qtyAccepted + line.qtyRejected < line.qtyDispatched && line.qtyReceived > 0) return 'Short Received';
  return 'None';
}

export async function closeTransferWithOutstanding(transferId: string, staffId: string, reason: string): Promise<StockTransfer | null> {
  const record = await getStockTransferById(transferId);
  if (!record || !reason.trim()) return null;
  saveLines(lines().map((line) => line.transferId === transferId && line.qtyOutstanding > 0 ? { ...line, lineStatus: 'Closed Outstanding' } : line));
  const updated = updateTransfer(transferId, { status: 'Closed With Outstanding', notes: `${record.notes}\nClosed outstanding: ${reason}` });
  if (updated) await recordActivity({ transferId, transferNumber: updated.transferNumber, eventType: 'STOCK_TRANSFER_CLOSED_WITH_OUTSTANDING', operator: staffId, severity: 'High', message: `${updated.transferNumber} closed with outstanding. Reason: ${reason}` });
  return updated;
}

export async function cancelStockTransfer(transferId: string, staffId: string, reason: string): Promise<StockTransfer | null> {
  const record = await getStockTransferById(transferId);
  if (!record || !reason.trim() || record.status === 'Fully Received') return null;
  const updated = updateTransfer(transferId, { status: 'Cancelled', notes: `${record.notes}\nCancelled: ${reason}` });
  if (updated) await recordActivity({ transferId, transferNumber: updated.transferNumber, eventType: 'STOCK_TRANSFER_CANCELLED', operator: staffId, severity: 'Medium', message: `${updated.transferNumber} cancelled. Stock not changed by cancellation.` });
  return updated;
}

export async function reverseTransferPlaceholder(transferId: string, staffId: string, reason: string): Promise<StockTransfer | null> {
  const record = await getStockTransferById(transferId);
  if (!record || !reason.trim()) return null;
  const updated = updateTransfer(transferId, { status: 'Reversed', notes: `${record.notes}\nReverse placeholder: ${reason}` });
  if (updated) await recordActivity({ transferId, transferNumber: updated.transferNumber, eventType: 'STOCK_TRANSFER_REVERSED_PLACEHOLDER', operator: staffId, severity: 'High', message: `${updated.transferNumber} reverse placeholder recorded. Manual movement review required.` });
  return updated;
}

export async function exportStockTransferPlaceholder(transferId: string): Promise<{ message: string; payload: { transfer: StockTransfer | null; lines: StockTransferLine[] } }> {
  const transfer = await getStockTransferById(transferId);
  const transferLines = transfer ? await getStockTransferLines(transferId) : [];
  if (transfer) await recordActivity({ transferId, transferNumber: transfer.transferNumber, eventType: 'STOCK_TRANSFER_EXPORTED', operator: 'System', severity: 'Low', message: `${transfer.transferNumber} export prepared locally.` });
  return { message: transfer ? `${transfer.transferNumber} export prepared locally.` : 'Transfer not found.', payload: { transfer, lines: transferLines } };
}

export async function getStockTransferActivityEvents(filters: StockTransferFilterState = {}): Promise<StockTransferActivityEvent[]> {
  const matchingIds = new Set((await getStockTransfers(filters)).map((transfer) => transfer.transferId));
  return activities()
    .filter((event) => matchingIds.size === 0 || matchingIds.has(event.transferId))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
