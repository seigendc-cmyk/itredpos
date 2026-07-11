import type { PosSession } from '../types';
import { readVendorScopedList, writeVendorScopedList } from '../utils/vendorDataMode';
import { assertCanonicalInventoryContext, assertInventoryPermission, type CanonicalInventoryContext } from './inventoryContextService';
import { getAvailableStock } from './inventoryBalanceService';

const RESERVATION_KEY = 'sci_pos_stock_reservations_v1';

export type StockReservationStatus = 'Active' | 'Released' | 'Consumed' | 'Expired' | 'Cancelled';
export type StockReservationReferenceType = 'SALES_ORDER' | 'DELIVERY_ORDER' | 'LAYBY' | 'INTERNAL_ORDER' | 'TRANSFER_REQUEST';

export interface StockReservationRecord {
  reservationId: string;
  vendorId: string;
  branchId: string;
  warehouseId: string;
  productId: string;
  referenceType: StockReservationReferenceType;
  referenceId: string;
  quantityReserved: number;
  status: StockReservationStatus;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface StockReservationInput {
  session?: PosSession | CanonicalInventoryContext | null;
  vendorId: string;
  branchId: string;
  warehouseId: string;
  productId: string;
  referenceType: StockReservationReferenceType;
  referenceId: string;
  quantityReserved: number;
  expiresAt: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function safeId(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '_');
}

function records(vendorId?: string): StockReservationRecord[] {
  return readVendorScopedList<StockReservationRecord>(RESERVATION_KEY, [], vendorId);
}

function save(records: StockReservationRecord[], vendorId?: string): StockReservationRecord[] {
  return writeVendorScopedList(RESERVATION_KEY, records, vendorId);
}

function reservationId(input: Pick<StockReservationInput, 'vendorId' | 'referenceType' | 'referenceId' | 'productId'>): string {
  return safeId(`${input.vendorId}_${input.referenceType}_${input.referenceId}_${input.productId}`);
}

function activeReservation(row: StockReservationRecord): boolean {
  return row.status === 'Active' && row.expiresAt > nowIso();
}

export async function getStockReservations(filters: Partial<Pick<StockReservationRecord, 'vendorId' | 'branchId' | 'warehouseId' | 'productId' | 'status'>> = {}): Promise<StockReservationRecord[]> {
  return records(filters.vendorId).filter((row) => (
    (!filters.vendorId || row.vendorId === filters.vendorId) &&
    (!filters.branchId || row.branchId === filters.branchId) &&
    (!filters.warehouseId || row.warehouseId === filters.warehouseId) &&
    (!filters.productId || row.productId === filters.productId) &&
    (!filters.status || row.status === filters.status)
  ));
}

export async function createStockReservation(input: StockReservationInput): Promise<StockReservationRecord> {
  const session = assertCanonicalInventoryContext(input.session);
  assertInventoryPermission(session, 'inventory.reserve', 'You do not have permission to reserve stock.');
  if (input.vendorId !== session.vendorId || input.branchId !== session.branchId || input.warehouseId !== session.warehouseId) {
    throw new Error('Your POS session is incomplete. Please sign in again.');
  }
  if (input.quantityReserved <= 0) throw new Error('Reserved quantity must be greater than zero.');
  const id = reservationId(input);
  const existing = records(input.vendorId).find((row) => row.reservationId === id && activeReservation(row));
  if (existing) return existing;
  const availability = await getAvailableStock(input);
  if (availability.quantityAvailable < input.quantityReserved) {
    throw new Error('Reservation cannot exceed available stock.');
  }
  const now = nowIso();
  const record: StockReservationRecord = {
    reservationId: id,
    vendorId: input.vendorId,
    branchId: input.branchId,
    warehouseId: input.warehouseId,
    productId: input.productId,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    quantityReserved: input.quantityReserved,
    status: 'Active',
    expiresAt: input.expiresAt,
    createdAt: now,
    updatedAt: now
  };
  save([record, ...records(input.vendorId).filter((row) => row.reservationId !== id)], input.vendorId);
  return record;
}

export async function releaseStockReservation(reservationId: string, vendorId: string, status: Exclude<StockReservationStatus, 'Active'> = 'Released'): Promise<StockReservationRecord | null> {
  let updated: StockReservationRecord | null = null;
  save(records(vendorId).map((row) => {
    if (row.reservationId !== reservationId) return row;
    updated = { ...row, status, updatedAt: nowIso() };
    return updated;
  }), vendorId);
  return updated;
}

export async function expireStockReservations(vendorId: string): Promise<StockReservationRecord[]> {
  const now = nowIso();
  const updated = records(vendorId).map((row) => (
    row.status === 'Active' && row.expiresAt <= now
      ? { ...row, status: 'Expired' as const, updatedAt: now }
      : row
  ));
  return save(updated, vendorId).filter((row) => row.status === 'Expired');
}
