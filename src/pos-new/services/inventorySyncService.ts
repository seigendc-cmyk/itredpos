import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  setDoc,
  where,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase/firebaseApp';
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

const LEDGER_COLLECTION = 'inventory_ledger';
const BALANCE_COLLECTION = 'inventory_balances';
const PENDING_QUEUE_KEY = 'sci_pos_pending_inventory_movements';
const SESSION_INCOMPLETE_MESSAGE = 'Your POS session is incomplete. Please sign in again.';
const BLOCKED_VENDOR_IDS = new Set([
  'demo-vendor-001',
  'demo-vendor',
  'DEMO-VENDOR',
  'test-vendor-001',
  'unassigned-vendor'
]);

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

async function readFirestoreBalance(input: InventoryBalanceInput): Promise<InventoryBalanceRecord | null> {
  if (!db) return null;
  const snap = await getDoc(doc(db, BALANCE_COLLECTION, balanceId(input)));
  if (!snap.exists()) return {
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
  const data = snap.data() as Partial<InventoryBalanceRecord>;
  const quantityOnHand = Number(data.quantityOnHand || 0);
  const quantityReserved = Number(data.quantityReserved || 0);
  const quantityInTransit = Number(data.quantityInTransit || 0);
  const averageCost = Number(data.averageCost || 0);
  return {
    ...input,
    ...data,
    balanceId: data.balanceId || balanceId(input),
    quantityOnHand,
    quantityReserved,
    quantityAvailable: Math.max(0, quantityOnHand - quantityReserved),
    quantityInTransit,
    averageCost,
    stockValue: Number(data.stockValue ?? quantityOnHand * averageCost),
    syncStatus: data.syncStatus || 'Synced',
    updatedAt: data.updatedAt || nowIso()
  };
}

async function writeFirestoreMovement(record: InventoryMovementRecord, allowNegativeStock = false): Promise<void> {
  if (!db) throw new Error('Inventory cloud sync is not available.');
  const ledgerRef = doc(db, LEDGER_COLLECTION, record.movementId);
  const balanceRef = doc(db, BALANCE_COLLECTION, balanceId(record));

  await runTransaction(db, async (transaction) => {
    const existingMovement = await transaction.get(ledgerRef);
    if (existingMovement.exists()) return;

    const existingBalance = await transaction.get(balanceRef);
    const balanceData = existingBalance.exists()
      ? existingBalance.data() as Partial<InventoryBalanceRecord>
      : {};
    const currentBalance = existingBalance.exists()
      ? Number(balanceData.quantityOnHand || 0)
      : record.balanceBefore;
    const nextBalance = currentBalance + record.quantityIn - record.quantityOut;
    if (nextBalance < 0 && !allowNegativeStock) {
      throw new Error('Stock available is not enough for this movement.');
    }
    const currentReserved = Number(balanceData.quantityReserved || 0);
    const currentTransit = Number(balanceData.quantityInTransit || 0);
    const nextTransit = record.movementType === 'TRANSFER_OUT'
      ? currentTransit + record.quantityOut
      : record.movementType === 'TRANSFER_IN'
        ? Math.max(0, currentTransit - record.quantityIn)
        : currentTransit;
    const priorAverageCost = Number(balanceData.averageCost || record.unitCost || 0);
    const averageCost = record.quantityIn > 0 && nextBalance > 0
      ? Number((((currentBalance * priorAverageCost) + (record.quantityIn * record.unitCost)) / nextBalance).toFixed(4))
      : priorAverageCost || record.unitCost || 0;
    const syncedAt = nowIso();

    transaction.set(ledgerRef, {
      ...record,
      balanceBefore: currentBalance,
      balanceAfter: nextBalance,
      totalCost: Number(((record.quantityIn || record.quantityOut) * record.unitCost).toFixed(2)),
      syncStatus: 'Synced',
      vendorMessage: 'Synchronized'
    });
    transaction.set(balanceRef, {
      balanceId: balanceId(record),
      vendorId: record.vendorId,
      branchId: record.branchId,
      warehouseId: record.warehouseId,
      productId: record.productId,
      staffId: record.staffId,
      quantityOnHand: nextBalance,
      quantityReserved: currentReserved,
      quantityAvailable: Math.max(0, nextBalance - currentReserved),
      quantityInTransit: nextTransit,
      averageCost,
      stockValue: Number((nextBalance * averageCost).toFixed(2)),
      lastMovementId: record.movementId,
      lastMovementAt: record.createdAt,
      lastSynchronizedAt: syncedAt,
      syncStatus: 'Synced',
      updatedAt: syncedAt
    }, { merge: true });
  });
}

export async function getInventoryBalance(input: InventoryBalanceInput): Promise<InventoryBalanceRecord> {
  assertScoped(input);
  const cloudBalance = db ? await readFirestoreBalance(input).catch(() => null) : null;
  if (cloudBalance) return cloudBalance;
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
    syncStatus: cloudBalance === null ? 'Pending' : 'Synced',
    updatedAt: nowIso()
  };
}

export async function postInventoryMovement(input: InventoryMovementInput): Promise<InventoryMovementRecord> {
  assertMovement(input);
  const quantityIn = quantity(input.quantityIn);
  const quantityOut = quantity(input.quantityOut);
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

  try {
    await writeFirestoreMovement(record, Boolean(input.allowNegativeStock));
    await postLocalInventoryMovement(toLocalMovement({ ...record, syncStatus: 'Synced', vendorMessage: 'Synchronized' }, input));
    return { ...record, syncStatus: 'Synced', vendorMessage: 'Synchronized' };
  } catch (error) {
    console.error('Inventory movement synchronization failed', error);
    if (input.allowOfflineQueue) {
      await postLocalInventoryMovement(toLocalMovement(record, input));
      return queuePendingMovement(record, 'Waiting to synchronize');
    }
    const message = error instanceof Error ? error.message : 'Synchronization failed';
    throw new Error(`Synchronization failed. ${message}`);
  }
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
  const source = await postInventoryMovement({ ...input.source, movementType: 'TRANSFER_OUT', quantityIn: 0 });
  const destination = await postInventoryMovement({ ...input.destination, movementType: 'TRANSFER_IN', quantityOut: 0 });
  return { source, destination };
}

export async function rebuildInventoryBalance(input: InventoryBalanceInput): Promise<InventoryBalanceRecord> {
  assertScoped(input);
  if (!db) return getInventoryBalance(input);

  const rows = await getDocs(query(
    collection(db, LEDGER_COLLECTION),
    where('vendorId', '==', input.vendorId),
    where('branchId', '==', input.branchId),
    where('warehouseId', '==', input.warehouseId),
    where('productId', '==', input.productId),
    orderBy('createdAt', 'asc'),
    limit(1000)
  ));
  const quantityOnHand = rows.docs.reduce((sum, item) => {
    const row = item.data() as Partial<InventoryMovementRecord>;
    return sum + Number(row.quantityIn || 0) - Number(row.quantityOut || 0);
  }, 0);
  const balance: InventoryBalanceRecord = {
    ...input,
    balanceId: balanceId(input),
    quantityOnHand,
    quantityReserved: 0,
    quantityAvailable: Math.max(0, quantityOnHand),
    quantityInTransit: 0,
    averageCost: 0,
    stockValue: 0,
    syncStatus: 'Synced',
    lastSynchronizedAt: nowIso(),
    updatedAt: nowIso()
  };
  await setDoc(doc(db, BALANCE_COLLECTION, balance.balanceId), balance, { merge: true });
  return balance;
}

export async function syncPendingInventoryMovements(): Promise<{ synced: number; failed: number; message: string }> {
  if (!db) return { synced: 0, failed: readPendingQueue().length, message: 'Stock synchronization failed' };

  const queue = readPendingQueue().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const remaining: InventoryMovementRecord[] = [];
  let synced = 0;
  let failed = 0;

  for (const record of queue) {
    try {
      await writeFirestoreMovement(record);
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
  if (!db || records.length === 0) return;
  const batch = writeBatch(db);
  records.forEach((record) => {
    batch.set(doc(db, LEDGER_COLLECTION, record.movementId), { ...record, syncStatus: 'Synced' }, { merge: true });
  });
  await batch.commit();
}
