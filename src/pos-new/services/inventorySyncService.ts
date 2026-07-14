import { createFirestoreInventoryRepository } from '../repositories/firestore/FirestoreInventoryRepository';
import type { SharedInventoryMovementRecord, SharedInventoryMovementType } from '../firebase/commerceDataContract';
import type { RepositoryOperationContext } from '../repositories/repositoryContext';
import type { InventoryMovement as LocalInventoryMovement, InventoryMovementType } from '../types';
import {
  calculateRunningBalance,
  getInventoryMovementById,
  postInventoryMovement as postLocalInventoryMovement
} from './inventoryMovementService';

export type InventorySyncStatus = 'Pending' | 'Synced' | 'Failed';

export type CanonicalInventoryMovementType =
  | 'OPENING_BALANCE'
  | 'GOODS_RECEIVED'
  | 'SALE'
  | 'SALES_RETURN'
  | 'PURCHASE_RETURN'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'STOCKTAKE_ADJUSTMENT'
  | 'DAMAGE_WRITEOFF'
  | 'EXPIRY_WRITEOFF'
  | 'THEFT_LOSS'
  | 'MANUAL_CORRECTION'
  | 'PRODUCTION_IN'
  | 'PRODUCTION_OUT'
  | 'REVERSAL';

export interface InventoryMovementInput {
  movementId?: string;
  vendorId: string;
  branchId: string;
  warehouseId: string;
  destinationBranchId?: string;
  destinationWarehouseId?: string;
  productId: string;
  sku?: string;
  productName?: string;
  shelfLocation?: string;
  movementType: CanonicalInventoryMovementType;
  quantityIn?: number;
  quantityOut?: number;
  unitCost?: number;
  sellingPrice?: number;
  referenceType: string;
  referenceId: string;
  staffId: string;
  staffName?: string;
  terminalId?: string;
  approvalId?: string;
  batchNumber?: string;
  expiryDate?: string;
  serialNumber?: string;
  reason?: string;
  createdAt?: string;
  allowNegativeStock?: boolean;
  allowOfflineQueue?: boolean;
  notes?: string;
}

export interface InventoryMovementRecord {
  movementId: string;
  vendorId: string;
  branchId: string;
  warehouseId: string;
  destinationBranchId?: string;
  destinationWarehouseId?: string;
  productId: string;
  sku?: string;
  productName?: string;
  movementType: CanonicalInventoryMovementType;
  quantityIn: number;
  quantityOut: number;
  balanceBefore: number;
  balanceAfter: number;
  unitCost: number;
  totalCost: number;
  referenceType: string;
  referenceId: string;
  staffId: string;
  terminalId?: string;
  approvalId?: string;
  batchNumber?: string;
  expiryDate?: string;
  serialNumber?: string;
  reason?: string;
  createdAt: string;
  syncStatus: InventorySyncStatus;
  shelfLocation?: string;
  staffName?: string;
  vendorMessage?: string;
}

export interface InventoryBalanceInput {
  vendorId: string;
  branchId: string;
  warehouseId: string;
  productId: string;
  staffId?: string;
}

export interface InventoryBalanceRecord extends InventoryBalanceInput {
  balanceId: string;
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number;
  quantityInTransit: number;
  averageCost: number;
  stockValue: number;
  lastMovementId?: string;
  lastMovementAt?: string;
  lastSynchronizedAt?: string;
  syncStatus: InventorySyncStatus;
  updatedAt: string;
}

const PENDING_QUEUE_KEY = 'sci_pos_pending_inventory_movements';
const SESSION_INCOMPLETE_MESSAGE = 'Your POS session is incomplete. Please sign in again.';
const BLOCKED_VENDOR_IDS = new Set([
  'demo-vendor-001',
  'demo-vendor',
  'DEMO-VENDOR',
  'test-vendor-001',
  'unassigned-vendor'
]);

const sharedInventoryRepository = createFirestoreInventoryRepository();

function usesSharedFirebaseInventory(): boolean {
  return import.meta.env.VITE_STORAGE_MODE === 'firebase';
}

function repositoryContext(input: InventoryMovementInput | InventoryBalanceInput): RepositoryOperationContext {
  const movement = input as InventoryMovementInput;
  return {
    vendorId: input.vendorId,
    branchId: input.branchId,
    warehouseId: input.warehouseId,
    terminalId: movement.terminalId,
    staffId: movement.staffId || input.staffId,
    actorId: movement.staffId || input.staffId || '',
    sourceApp: 'ITRED_POS',
    correlationId: movement.referenceId
      ? cleanId(`inventory_${movement.referenceType}_${movement.referenceId}`)
      : cleanId(`inventory_balance_${input.vendorId}_${input.productId}`)
  };
}

function sharedMovementType(type: CanonicalInventoryMovementType, delta: number): SharedInventoryMovementType {
  const mapped: Partial<Record<CanonicalInventoryMovementType, SharedInventoryMovementType>> = {
    OPENING_BALANCE: 'OPENING_BALANCE',
    GOODS_RECEIVED: 'GOODS_RECEIVED',
    SALE: 'SALE_ISSUE',
    SALES_RETURN: 'SALE_RETURN',
    PURCHASE_RETURN: 'SUPPLIER_RETURN',
    TRANSFER_IN: 'TRANSFER_IN',
    TRANSFER_OUT: 'TRANSFER_OUT',
    MANUAL_CORRECTION: delta >= 0 ? 'STOCK_ADJUSTMENT_IN' : 'STOCK_ADJUSTMENT_OUT',
    STOCKTAKE_ADJUSTMENT: delta >= 0 ? 'STOCKTAKE_GAIN' : 'STOCKTAKE_LOSS',
    DAMAGE_WRITEOFF: 'STOCK_ADJUSTMENT_OUT',
    EXPIRY_WRITEOFF: 'STOCK_ADJUSTMENT_OUT',
    THEFT_LOSS: 'STOCK_ADJUSTMENT_OUT',
    PRODUCTION_IN: 'PRODUCT_TRANSFORMATION_OUTPUT',
    PRODUCTION_OUT: 'PRODUCT_TRANSFORMATION_INPUT',
    REVERSAL: 'MANUAL_CORRECTION'
  };
  return mapped[type] || 'MANUAL_CORRECTION';
}

function fromSharedMovement(movement: SharedInventoryMovementRecord, input: InventoryMovementInput): InventoryMovementRecord {
  return {
    movementId: movement.movementId,
    vendorId: movement.vendorId,
    branchId: movement.branchId,
    warehouseId: movement.warehouseId || input.warehouseId,
    destinationBranchId: input.destinationBranchId,
    destinationWarehouseId: input.destinationWarehouseId,
    productId: movement.productId,
    sku: input.sku,
    productName: input.productName,
    movementType: input.movementType,
    quantityIn: Math.max(movement.quantityDelta, 0),
    quantityOut: Math.max(-movement.quantityDelta, 0),
    balanceBefore: movement.quantityBefore,
    balanceAfter: movement.quantityAfter,
    unitCost: movement.unitCost || 0,
    totalCost: Math.abs(movement.valueImpact || 0),
    referenceType: movement.referenceType,
    referenceId: movement.referenceId,
    staffId: movement.staffId || input.staffId,
    terminalId: input.terminalId,
    approvalId: input.approvalId,
    batchNumber: input.batchNumber,
    expiryDate: input.expiryDate,
    serialNumber: input.serialNumber,
    reason: input.reason,
    createdAt: movement.createdAt,
    syncStatus: 'Synced',
    shelfLocation: input.shelfLocation,
    staffName: input.staffName,
    vendorMessage: 'Synchronized'
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

function cleanId(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '_');
}

function balanceId(input: InventoryBalanceInput): string {
  return cleanId(`${input.vendorId}_${input.warehouseId}_${input.productId}`);
}

export function createInventoryMovementId(input: Pick<InventoryMovementInput, 'movementId' | 'vendorId' | 'referenceType' | 'referenceId' | 'productId' | 'movementType'>): string {
  return cleanId(input.movementId || `${input.vendorId}_${input.referenceType}_${input.referenceId}_${input.productId}_${input.movementType}`);
}

function movementId(input: InventoryMovementInput): string {
  return createInventoryMovementId(input);
}

function quantity(value: unknown): number {
  const next = Number(value);
  return Number.isFinite(next) ? Math.max(0, next) : 0;
}

export function calculateMovementBalance(input: {
  balanceBefore: number;
  quantityIn?: number;
  quantityOut?: number;
  allowNegativeStock?: boolean;
}): { quantityIn: number; quantityOut: number; balanceAfter: number } {
  const quantityIn = quantity(input.quantityIn);
  const quantityOut = quantity(input.quantityOut);
  if (quantityIn > 0 && quantityOut > 0) {
    throw new Error('Inventory movement cannot increase and decrease stock at the same time.');
  }
  if (quantityIn <= 0 && quantityOut <= 0) {
    throw new Error('Inventory movement quantity must be greater than zero.');
  }
  const balanceAfter = Number(input.balanceBefore || 0) + quantityIn - quantityOut;
  if (balanceAfter < 0 && !input.allowNegativeStock) {
    throw new Error('Stock available is not enough for this movement.');
  }
  return { quantityIn, quantityOut, balanceAfter };
}

function assertScoped(input: InventoryBalanceInput): void {
  if (!input.vendorId || BLOCKED_VENDOR_IDS.has(input.vendorId) || BLOCKED_VENDOR_IDS.has(input.vendorId.toLowerCase())) {
    throw new Error(SESSION_INCOMPLETE_MESSAGE);
  }
  if (!input.branchId) throw new Error(SESSION_INCOMPLETE_MESSAGE);
  if (!input.warehouseId) throw new Error(SESSION_INCOMPLETE_MESSAGE);
  if (!input.productId) throw new Error('Product record missing.');
}

function assertMovement(input: InventoryMovementInput): void {
  assertScoped(input);
  if (!input.referenceType || !input.referenceId) throw new Error('Inventory movement reference is required.');
  if (!input.staffId) throw new Error(SESSION_INCOMPLETE_MESSAGE);
  if ((input.batchNumber === '' || input.expiryDate === '' || input.serialNumber === '') && input.reason === 'TRACKING_REQUIRED') {
    throw new Error('Batch, expiry, or serial detail is required for this product.');
  }
}

function canUseLocalStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

function readPendingQueue(): InventoryMovementRecord[] {
  if (!canUseLocalStorage()) return [];
  try {
    const raw = localStorage.getItem(PENDING_QUEUE_KEY);
    const rows = raw ? JSON.parse(raw) : [];
    return Array.isArray(rows) ? rows as InventoryMovementRecord[] : [];
  } catch {
    return [];
  }
}

function writePendingQueue(rows: InventoryMovementRecord[]): InventoryMovementRecord[] {
  if (canUseLocalStorage()) {
    localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(rows));
  }
  return rows;
}

function queuePendingMovement(record: InventoryMovementRecord, vendorMessage = 'Stock update pending'): InventoryMovementRecord {
  const queue = readPendingQueue();
  const nextRecord = { ...record, syncStatus: 'Pending' as const, vendorMessage };
  const next = [nextRecord, ...queue.filter((item) => item.movementId !== record.movementId)];
  writePendingQueue(next);
  return nextRecord;
}

function toLocalMovement(record: InventoryMovementRecord, input: InventoryMovementInput): LocalInventoryMovement {
  const qtyIn = record.quantityIn;
  const qtyOut = record.quantityOut;
  const localType = record.movementType === 'SALES_RETURN'
    ? 'SALE_RETURN'
    : record.movementType === 'PURCHASE_RETURN'
      ? 'SUPPLIER_RETURN'
      : record.movementType === 'STOCKTAKE_ADJUSTMENT'
        ? (qtyIn >= qtyOut ? 'STOCKTAKE_ADJUSTMENT_IN' : 'STOCKTAKE_ADJUSTMENT_OUT')
        : record.movementType as InventoryMovementType;
  return {
    movementId: record.movementId,
    vendorId: record.vendorId,
    branchId: record.branchId,
    warehouseId: record.warehouseId,
    productId: record.productId,
    sku: record.sku || record.productId,
    productName: record.productName || record.productId,
    shelfLocation: record.shelfLocation,
    movementType: localType,
    referenceType: input.referenceType === 'SALE' ? 'RECEIPT' : (input.referenceType as LocalInventoryMovement['referenceType']),
    referenceNumber: record.referenceId,
    qtyIn,
    qtyOut,
    balanceBefore: record.balanceBefore,
    balanceAfter: record.balanceAfter,
    unitCost: record.unitCost,
    sellingPrice: input.sellingPrice || 0,
    totalCostImpact: (qtyIn - qtyOut) * record.unitCost,
    staffId: record.staffId,
    staffName: record.staffName || record.staffId,
    terminalId: record.terminalId,
    movementDate: record.createdAt,
    notes: input.notes || `${record.movementType} movement posted through inventory sync.`,
    riskFlag: 'None',
    approvalRequired: false,
    status: 'Posted',
    createdAt: record.createdAt,
    updatedAt: record.createdAt
  };
}

export async function getInventoryBalance(input: InventoryBalanceInput): Promise<InventoryBalanceRecord> {
  assertScoped(input);
  if (usesSharedFirebaseInventory()) {
    const result = await sharedInventoryRepository.getBalance(repositoryContext(input), input.productId, input.warehouseId);
    if (!result.success || !result.data) {
      if (result.errorCode !== 'REPOSITORY_NOT_FOUND') throw new Error(result.errorMessage || 'Inventory balance could not be loaded.');
      return {
        ...input,
        balanceId: balanceId(input),
        quantityOnHand: 0,
        quantityReserved: 0,
        quantityAvailable: 0,
        quantityInTransit: 0,
        averageCost: 0,
        stockValue: 0,
        syncStatus: 'Synced',
        updatedAt: nowIso()
      };
    }
    return {
      ...input,
      balanceId: result.data.balanceId,
      quantityOnHand: result.data.quantityOnHand,
      quantityReserved: result.data.quantityReserved,
      quantityAvailable: result.data.quantityAvailable,
      quantityInTransit: result.data.quantityInTransit,
      averageCost: result.data.averageCost,
      stockValue: result.data.stockValue,
      lastMovementId: result.data.lastMovementId,
      lastMovementAt: result.data.lastMovementAt,
      lastSynchronizedAt: result.data.lastSyncAt,
      syncStatus: 'Synced',
      updatedAt: result.data.updatedAt
    };
  }
  const quantityOnHand = await calculateRunningBalance(input.productId, input.warehouseId);
  return {
    ...input,
    balanceId: balanceId(input),
    quantityOnHand,
    quantityReserved: 0,
    quantityAvailable: Math.max(0, quantityOnHand),
    quantityInTransit: 0,
    averageCost: 0,
    stockValue: 0,
    syncStatus: 'Synced',
    updatedAt: nowIso()
  };
}

export async function postInventoryMovement(input: InventoryMovementInput): Promise<InventoryMovementRecord> {
  assertMovement(input);
  const quantityIn = quantity(input.quantityIn);
  const quantityOut = quantity(input.quantityOut);
  if (usesSharedFirebaseInventory()) {
    const delta = quantityIn - quantityOut;
    const timestamp = input.createdAt || nowIso();
    const context = repositoryContext(input);
    const movement: SharedInventoryMovementRecord = {
      sciId: movementId(input),
      movementId: movementId(input),
      vendorId: input.vendorId,
      branchId: input.branchId,
      warehouseId: input.warehouseId,
      productId: input.productId,
      movementType: sharedMovementType(input.movementType, delta),
      quantityDelta: delta,
      quantityBefore: 0,
      quantityAfter: 0,
      unitCost: input.unitCost,
      valueImpact: Math.abs(delta) * Number(input.unitCost || 0),
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      staffId: input.staffId,
      actorId: context.actorId,
      correlationId: context.correlationId,
      sourceApp: context.sourceApp,
      createdAt: timestamp,
      updatedAt: timestamp,
      createdBy: context.actorId,
      updatedBy: context.actorId,
      schemaVersion: 1,
      status: 'Posted'
    };
    const result = await sharedInventoryRepository.postMovement(context, movement);
    if (!result.success || !result.data) {
      if (input.allowOfflineQueue) {
        const balanceBefore = await calculateRunningBalance(input.productId, input.warehouseId);
        const pendingBalance = calculateMovementBalance({ balanceBefore, quantityIn, quantityOut, allowNegativeStock: input.allowNegativeStock });
        return queuePendingMovement({
          movementId: movement.movementId,
          vendorId: input.vendorId,
          branchId: input.branchId,
          warehouseId: input.warehouseId,
          destinationBranchId: input.destinationBranchId,
          destinationWarehouseId: input.destinationWarehouseId,
          productId: input.productId,
          sku: input.sku,
          productName: input.productName,
          movementType: input.movementType,
          quantityIn,
          quantityOut,
          balanceBefore,
          balanceAfter: pendingBalance.balanceAfter,
          unitCost: Number(input.unitCost || 0),
          totalCost: Math.abs(delta) * Number(input.unitCost || 0),
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          staffId: input.staffId,
          terminalId: input.terminalId,
          reason: input.reason,
          createdAt: timestamp,
          syncStatus: 'Pending',
          shelfLocation: input.shelfLocation,
          staffName: input.staffName
        }, 'Waiting to synchronize');
      }
      throw new Error(result.errorMessage || 'Inventory synchronization failed.');
    }
    return fromSharedMovement(result.data, input);
  }
  const existingId = movementId(input);
  const existingPending = readPendingQueue().find((item) => item.movementId === existingId);
  if (existingPending) return existingPending;
  const existingLocal = await getInventoryMovementById(existingId);
  if (existingLocal) {
    return {
      movementId: existingLocal.movementId,
      vendorId: existingLocal.vendorId,
      branchId: existingLocal.branchId,
      warehouseId: existingLocal.warehouseId,
      productId: existingLocal.productId,
      movementType: input.movementType,
      quantityIn: existingLocal.qtyIn,
      quantityOut: existingLocal.qtyOut,
      balanceBefore: existingLocal.balanceBefore,
      balanceAfter: existingLocal.balanceAfter,
      unitCost: existingLocal.unitCost,
      totalCost: Math.abs(existingLocal.totalCostImpact),
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      staffId: existingLocal.staffId,
      terminalId: existingLocal.terminalId,
      createdAt: existingLocal.createdAt,
      syncStatus: 'Synced',
      sku: existingLocal.sku,
      productName: existingLocal.productName,
      shelfLocation: existingLocal.shelfLocation,
      staffName: existingLocal.staffName,
      vendorMessage: 'Stock synchronized'
    };
  }

  const balance = await getInventoryBalance(input);
  const movementBalance = calculateMovementBalance({
    balanceBefore: balance.quantityOnHand,
    quantityIn,
    quantityOut,
    allowNegativeStock: input.allowNegativeStock
  });

  const record: InventoryMovementRecord = {
    movementId: existingId,
    vendorId: input.vendorId,
    branchId: input.branchId,
    warehouseId: input.warehouseId,
    destinationBranchId: input.destinationBranchId,
    destinationWarehouseId: input.destinationWarehouseId,
    productId: input.productId,
    sku: input.sku,
    productName: input.productName,
    movementType: input.movementType,
    quantityIn: movementBalance.quantityIn,
    quantityOut: movementBalance.quantityOut,
    balanceBefore: balance.quantityOnHand,
    balanceAfter: movementBalance.balanceAfter,
    unitCost: Number(input.unitCost) || 0,
    totalCost: Number(((movementBalance.quantityIn || movementBalance.quantityOut) * (Number(input.unitCost) || 0)).toFixed(2)),
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    staffId: input.staffId,
    terminalId: input.terminalId,
    approvalId: input.approvalId,
    batchNumber: input.batchNumber,
    expiryDate: input.expiryDate,
    serialNumber: input.serialNumber,
    reason: input.reason || input.notes,
    createdAt: input.createdAt || nowIso(),
    syncStatus: 'Pending',
    shelfLocation: input.shelfLocation,
    staffName: input.staffName,
    vendorMessage: input.allowOfflineQueue ? 'Waiting to synchronize' : 'Stock update pending'
  };

  await postLocalInventoryMovement(toLocalMovement({ ...record, syncStatus: 'Synced', vendorMessage: 'Stored locally' }, input));
  return { ...record, syncStatus: 'Synced', vendorMessage: 'Stored locally' };
}

export async function receiveStock(input: Omit<InventoryMovementInput, 'movementType'>): Promise<InventoryMovementRecord> {
  return postInventoryMovement({ ...input, movementType: 'GOODS_RECEIVED' });
}

export async function consumeStockForSale(input: Omit<InventoryMovementInput, 'movementType' | 'quantityIn'>): Promise<InventoryMovementRecord> {
  return postInventoryMovement({ ...input, movementType: 'SALE', quantityIn: 0 });
}

export async function restoreStockForReturn(input: Omit<InventoryMovementInput, 'movementType' | 'quantityOut'>): Promise<InventoryMovementRecord> {
  return postInventoryMovement({ ...input, movementType: 'SALES_RETURN', quantityOut: 0 });
}

export async function returnStockToSupplier(input: Omit<InventoryMovementInput, 'movementType' | 'quantityIn'>): Promise<InventoryMovementRecord> {
  return postInventoryMovement({ ...input, movementType: 'PURCHASE_RETURN', quantityIn: 0 });
}

export async function adjustStock(input: Omit<InventoryMovementInput, 'movementType'>): Promise<InventoryMovementRecord> {
  return postInventoryMovement({ ...input, movementType: 'MANUAL_CORRECTION' });
}

export async function transferStock(input: {
  source: Omit<InventoryMovementInput, 'movementType' | 'quantityIn'>;
  destination: Omit<InventoryMovementInput, 'movementType' | 'quantityOut'>;
}): Promise<{ source: InventoryMovementRecord; destination: InventoryMovementRecord }> {
  if (usesSharedFirebaseInventory()) {
    assertMovement({ ...input.source, movementType: 'TRANSFER_OUT' });
    assertMovement({ ...input.destination, movementType: 'TRANSFER_IN' });
    if (input.source.vendorId !== input.destination.vendorId || input.source.productId !== input.destination.productId) {
      throw new Error('Cross-vendor or cross-product transfer is rejected.');
    }
    const result = await sharedInventoryRepository.transferStock(repositoryContext(input.source), {
      productId: input.source.productId,
      sourceBranchId: input.source.branchId,
      sourceWarehouseId: input.source.warehouseId,
      destinationBranchId: input.destination.branchId,
      destinationWarehouseId: input.destination.warehouseId,
      quantity: quantity(input.source.quantityOut),
      referenceType: input.source.referenceType,
      referenceId: input.source.referenceId,
      reason: input.source.reason || input.source.notes
    });
    if (!result.success || !result.movements || result.movements.length !== 2) throw new Error(result.errorMessage || 'Stock transfer synchronization failed.');
    const outgoing = result.movements.find((item) => item.movementType === 'TRANSFER_OUT')!;
    const incoming = result.movements.find((item) => item.movementType === 'TRANSFER_IN')!;
    return {
      source: fromSharedMovement(outgoing, { ...input.source, movementType: 'TRANSFER_OUT' }),
      destination: fromSharedMovement(incoming, { ...input.destination, movementType: 'TRANSFER_IN' })
    };
  }
  const source = await postInventoryMovement({ ...input.source, movementType: 'TRANSFER_OUT', quantityIn: 0 });
  const destination = await postInventoryMovement({ ...input.destination, movementType: 'TRANSFER_IN', quantityOut: 0 });
  return { source, destination };
}

export async function rebuildInventoryBalance(input: InventoryBalanceInput): Promise<InventoryBalanceRecord> {
  assertScoped(input);
  // In Firebase mode balances are rebuilt only by replay tooling on the backend;
  // browser code must never overwrite the authoritative balance independently.
  return getInventoryBalance(input);
}

async function syncQueuedMovement(record: InventoryMovementRecord): Promise<void> {
  const context: RepositoryOperationContext = {
    vendorId: record.vendorId,
    branchId: record.branchId,
    warehouseId: record.warehouseId,
    terminalId: record.terminalId,
    staffId: record.staffId,
    actorId: record.staffId,
    sourceApp: 'ITRED_POS',
    correlationId: cleanId(`inventory_${record.referenceType}_${record.referenceId}`)
  };
  const timestamp = record.createdAt || nowIso();
  const result = await sharedInventoryRepository.postMovement(context, {
    sciId: record.movementId,
    movementId: record.movementId,
    vendorId: record.vendorId,
    branchId: record.branchId,
    warehouseId: record.warehouseId,
    productId: record.productId,
    movementType: sharedMovementType(record.movementType, record.quantityIn - record.quantityOut),
    quantityDelta: record.quantityIn - record.quantityOut,
    quantityBefore: record.balanceBefore,
    quantityAfter: record.balanceAfter,
    unitCost: record.unitCost,
    valueImpact: record.totalCost,
    referenceType: record.referenceType,
    referenceId: record.referenceId,
    staffId: record.staffId,
    actorId: record.staffId,
    correlationId: context.correlationId,
    sourceApp: context.sourceApp,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: record.staffId,
    updatedBy: record.staffId,
    schemaVersion: 1,
    status: 'Posted'
  });
  if (!result.success) throw new Error(result.errorMessage || 'Inventory movement synchronization failed.');
}

export async function syncPendingInventoryMovements(): Promise<{ synced: number; failed: number; message: string }> {
  const queue = readPendingQueue().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const remaining: InventoryMovementRecord[] = [];
  let synced = 0;
  let failed = 0;

  for (const record of queue) {
    try {
      await syncQueuedMovement(record);
      synced += 1;
    } catch (error) {
      console.error('Inventory movement synchronization failed', error);
      remaining.push({ ...record, syncStatus: 'Failed', vendorMessage: 'Synchronization failed' });
      failed += 1;
    }
  }

  writePendingQueue(remaining);
  return {
    synced,
    failed,
    message: failed > 0 ? 'Synchronization failed' : 'Synchronized'
  };
}

export async function postStocktakeAdjustment(input: Omit<InventoryMovementInput, 'movementType'>): Promise<InventoryMovementRecord> {
  return postInventoryMovement({ ...input, movementType: 'STOCKTAKE_ADJUSTMENT' });
}

export async function writeOffDamagedStock(input: Omit<InventoryMovementInput, 'movementType' | 'quantityIn'>): Promise<InventoryMovementRecord> {
  return postInventoryMovement({ ...input, movementType: 'DAMAGE_WRITEOFF', quantityIn: 0 });
}

export async function writeOffExpiredStock(input: Omit<InventoryMovementInput, 'movementType' | 'quantityIn'>): Promise<InventoryMovementRecord> {
  return postInventoryMovement({ ...input, movementType: 'EXPIRY_WRITEOFF', quantityIn: 0 });
}

export async function recordTheftLoss(input: Omit<InventoryMovementInput, 'movementType' | 'quantityIn'>): Promise<InventoryMovementRecord> {
  return postInventoryMovement({ ...input, movementType: 'THEFT_LOSS', quantityIn: 0 });
}

export function getPendingInventoryMovements(): InventoryMovementRecord[] {
  return readPendingQueue();
}

export async function flushInventoryMovementBatch(records: InventoryMovementRecord[]): Promise<void> {
  for (const record of records) await syncQueuedMovement(record);
}
