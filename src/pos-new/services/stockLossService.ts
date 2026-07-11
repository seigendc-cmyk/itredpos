import type { PosSession } from '../types';
import { readVendorScopedList, writeVendorScopedList } from '../utils/vendorDataMode';
import { assertCanonicalInventoryContext, assertInventoryPermission, type CanonicalInventoryContext } from './inventoryContextService';
import { recordTheftLoss, writeOffDamagedStock, writeOffExpiredStock, type InventoryMovementRecord } from './inventorySyncService';

const LOSS_KEY = 'sci_pos_stock_losses_v1';
const HIGH_VALUE_LOSS = 250;

export type StockLossType = 'Damage' | 'Expiry' | 'Theft' | 'Breakage' | 'Contamination' | 'Obsolescence' | 'Unknown';
export type StockLossApprovalStatus = 'Not Required' | 'Pending Approval' | 'Approved' | 'Rejected';

export interface StockLossRecord {
  lossId: string;
  vendorId: string;
  branchId: string;
  warehouseId: string;
  productId: string;
  lossType: StockLossType;
  quantity: number;
  unitCost: number;
  totalValue: number;
  batchNumber?: string;
  expiryDate?: string;
  discoveredBy: string;
  discoveredAt: string;
  reason: string;
  approvalStatus: StockLossApprovalStatus;
  approvedBy?: string;
  disposalMethod?: string;
  movementId?: string;
  createdAt: string;
}

export interface RecordStockLossInput {
  session?: PosSession | CanonicalInventoryContext | null;
  vendorId: string;
  branchId: string;
  warehouseId: string;
  productId: string;
  sku?: string;
  productName?: string;
  lossType: StockLossType;
  quantity: number;
  unitCost: number;
  batchNumber?: string;
  expiryDate?: string;
  reason: string;
  disposalMethod?: string;
  approvedBy?: string;
  allowOfflineQueue?: boolean;
}

function nowIso(): string {
  return new Date().toISOString();
}

function safeId(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '_');
}

function records(vendorId?: string): StockLossRecord[] {
  return readVendorScopedList<StockLossRecord>(LOSS_KEY, [], vendorId);
}

function save(rows: StockLossRecord[], vendorId?: string): StockLossRecord[] {
  return writeVendorScopedList(LOSS_KEY, rows, vendorId);
}

export async function getStockLosses(filters: Partial<Pick<StockLossRecord, 'vendorId' | 'branchId' | 'warehouseId' | 'productId' | 'lossType' | 'approvalStatus'>> = {}): Promise<StockLossRecord[]> {
  return records(filters.vendorId).filter((row) => (
    (!filters.vendorId || row.vendorId === filters.vendorId) &&
    (!filters.branchId || row.branchId === filters.branchId) &&
    (!filters.warehouseId || row.warehouseId === filters.warehouseId) &&
    (!filters.productId || row.productId === filters.productId) &&
    (!filters.lossType || row.lossType === filters.lossType) &&
    (!filters.approvalStatus || row.approvalStatus === filters.approvalStatus)
  ));
}

export async function recordStockLoss(input: RecordStockLossInput): Promise<{ loss: StockLossRecord; movement: InventoryMovementRecord | null; message: string }> {
  const session = assertCanonicalInventoryContext(input.session);
  assertInventoryPermission(session, 'inventory.loss.record', 'You do not have permission to record stock loss.');
  if (input.vendorId !== session.vendorId || input.branchId !== session.branchId || input.warehouseId !== session.warehouseId) {
    throw new Error('Your POS session is incomplete. Please sign in again.');
  }
  if (!input.reason.trim()) throw new Error('Loss reason is required.');
  if (input.quantity <= 0) throw new Error('Loss quantity must be greater than zero.');
  const totalValue = Number((input.quantity * input.unitCost).toFixed(2));
  const approvalRequired = totalValue >= HIGH_VALUE_LOSS || input.lossType === 'Theft';
  const approved = !approvalRequired || Boolean(input.approvedBy);
  const now = nowIso();
  const lossId = safeId(`${input.vendorId}_${input.lossType}_${input.productId}_${now}`);
  const baseLoss: StockLossRecord = {
    lossId,
    vendorId: input.vendorId,
    branchId: input.branchId,
    warehouseId: input.warehouseId,
    productId: input.productId,
    lossType: input.lossType,
    quantity: input.quantity,
    unitCost: input.unitCost,
    totalValue,
    batchNumber: input.batchNumber,
    expiryDate: input.expiryDate,
    discoveredBy: session.staffId,
    discoveredAt: now,
    reason: input.reason,
    approvalStatus: approved ? 'Approved' : 'Pending Approval',
    approvedBy: input.approvedBy,
    disposalMethod: input.disposalMethod,
    createdAt: now
  };
  if (!approved) {
    save([baseLoss, ...records(input.vendorId)], input.vendorId);
    return { loss: baseLoss, movement: null, message: 'Loss recorded for approval. Stock not reduced yet.' };
  }
  const movementInput = {
    movementId: safeId(`${input.vendorId}_STOCK_LOSS_${lossId}`),
    vendorId: input.vendorId,
    branchId: input.branchId,
    warehouseId: input.warehouseId,
    productId: input.productId,
    sku: input.sku,
    productName: input.productName,
    quantityOut: input.quantity,
    unitCost: input.unitCost,
    referenceType: 'STOCK_LOSS',
    referenceId: lossId,
    staffId: session.staffId,
    staffName: session.staffName,
    terminalId: session.terminalId,
    reason: input.reason,
    batchNumber: input.batchNumber,
    expiryDate: input.expiryDate,
    allowOfflineQueue: input.allowOfflineQueue,
    notes: `${input.lossType} loss: ${input.reason}`
  };
  const movement = input.lossType === 'Expiry'
    ? await writeOffExpiredStock(movementInput)
    : input.lossType === 'Theft'
      ? await recordTheftLoss(movementInput)
      : await writeOffDamagedStock(movementInput);
  const loss = { ...baseLoss, movementId: movement.movementId };
  save([loss, ...records(input.vendorId).filter((row) => row.lossId !== lossId)], input.vendorId);
  return { loss, movement, message: 'Loss posted through inventory ledger.' };
}
