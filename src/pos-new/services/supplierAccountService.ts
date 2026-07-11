import type { PosSession } from '../types';
import { readVendorScopedList, writeVendorScopedList } from '../utils/vendorDataMode';
import { assertCanonicalSupplierContext, type CanonicalSupplierContext } from './supplierContextService';

export const SUPPLIER_ACCOUNTS_COLLECTION = 'supplier_accounts';
export const SUPPLIER_PAYMENT_ALLOCATIONS_COLLECTION = 'supplier_payment_allocations';

export type SupplierAccountEntryType =
  | 'PURCHASE'
  | 'PAYMENT'
  | 'PURCHASE_RETURN'
  | 'CREDIT_NOTE'
  | 'DEBIT_NOTE'
  | 'OPENING_BALANCE'
  | 'ADJUSTMENT'
  | 'INTEREST'
  | 'REVERSAL';

export interface SupplierAccountEntry {
  entryId: string;
  vendorId: string;
  supplierId: string;
  branchId: string;
  entryType: SupplierAccountEntryType;
  referenceType: string;
  referenceId: string;
  debit: number;
  credit: number;
  balanceAfter: number;
  dueDate?: string;
  transactionDate: string;
  description: string;
  createdBy: string;
  createdAt: string;
  reversedEntryId?: string;
  supplierInvoiceNumber?: string;
  purchaseOrderId?: string;
  goodsReceiptId?: string;
}

export interface SupplierAccountEntryInput {
  entryId?: string;
  vendorId?: string;
  supplierId: string;
  branchId?: string;
  entryType: SupplierAccountEntryType | 'RETURN';
  referenceType: string;
  referenceId: string;
  debit?: number;
  credit?: number;
  dueDate?: string;
  transactionDate?: string;
  createdBy?: string;
  createdAt?: string;
  description?: string;
  notes?: string;
  reversedEntryId?: string;
  supplierInvoiceNumber?: string;
  purchaseOrderId?: string;
  goodsReceiptId?: string;
}

export interface SupplierPaymentAllocation {
  allocationId: string;
  supplierPaymentId: string;
  supplierId: string;
  supplierAccountEntryId: string;
  amountAllocated: number;
  allocatedBy: string;
  allocatedAt: string;
  vendorId: string;
}

export interface OpenSupplierCreditEntry {
  entry: SupplierAccountEntry;
  outstanding: number;
}

function nowIso(): string {
  return new Date().toISOString();
}

function clean(value: unknown): string {
  return String(value ?? '').trim();
}

function cleanId(value: string): string {
  return String(value || '').replace(/[^A-Za-z0-9_-]/g, '_');
}

function roundMoney(value: number): number {
  return Number((Math.round((Number(value) + Number.EPSILON) * 100) / 100).toFixed(2));
}

function normalizeEntryType(type: SupplierAccountEntryInput['entryType']): SupplierAccountEntryType {
  return type === 'RETURN' ? 'PURCHASE_RETURN' : type;
}

function readEntries(vendorId: string): SupplierAccountEntry[] {
  return readVendorScopedList<SupplierAccountEntry>(SUPPLIER_ACCOUNTS_COLLECTION, [], vendorId);
}

function writeEntries(vendorId: string, rows: SupplierAccountEntry[]): SupplierAccountEntry[] {
  return writeVendorScopedList(SUPPLIER_ACCOUNTS_COLLECTION, rows, vendorId);
}

function readAllocations(vendorId: string): SupplierPaymentAllocation[] {
  return readVendorScopedList<SupplierPaymentAllocation>(SUPPLIER_PAYMENT_ALLOCATIONS_COLLECTION, [], vendorId);
}

function writeAllocations(vendorId: string, rows: SupplierPaymentAllocation[]): SupplierPaymentAllocation[] {
  return writeVendorScopedList(SUPPLIER_PAYMENT_ALLOCATIONS_COLLECTION, rows, vendorId);
}

function entryIdFor(input: {
  vendorId: string;
  supplierId: string;
  entryType: SupplierAccountEntryType;
  referenceType: string;
  referenceId: string;
}): string {
  return cleanId(`${input.vendorId}_${input.supplierId}_${input.entryType}_${input.referenceType}_${input.referenceId}`);
}

function sortedSupplierEntries(vendorId: string, supplierId: string): SupplierAccountEntry[] {
  return readEntries(vendorId)
    .filter((entry) => entry.supplierId === supplierId)
    .sort((left, right) =>
      left.transactionDate.localeCompare(right.transactionDate)
      || left.createdAt.localeCompare(right.createdAt)
      || left.entryId.localeCompare(right.entryId)
    );
}

export function calculateSupplierLedgerBalance(vendorId: string, supplierId: string): number {
  return roundMoney(sortedSupplierEntries(vendorId, supplierId).reduce((balance, entry) => balance + entry.credit - entry.debit, 0));
}

export function getSupplierBalance(vendorId: string, supplierId: string): number {
  return calculateSupplierLedgerBalance(vendorId, supplierId);
}

export function getSupplierAccountEntries(filters: Partial<{ vendorId: string; supplierId: string }> = {}): SupplierAccountEntry[] {
  const vendorId = clean(filters.vendorId);
  const rows = vendorId ? readEntries(vendorId) : [];
  return rows
    .filter((entry) => !filters.supplierId || entry.supplierId === filters.supplierId)
    .sort((left, right) =>
      left.transactionDate.localeCompare(right.transactionDate)
      || left.createdAt.localeCompare(right.createdAt)
    );
}

export function getSupplierPaymentAllocations(vendorId: string, supplierPaymentId?: string): SupplierPaymentAllocation[] {
  return readAllocations(vendorId).filter((row) => !supplierPaymentId || row.supplierPaymentId === supplierPaymentId);
}

export function getOpenSupplierCreditEntries(vendorId: string, supplierId: string): OpenSupplierCreditEntry[] {
  const allocations = readAllocations(vendorId);
  return sortedSupplierEntries(vendorId, supplierId)
    .filter((entry) => entry.credit > 0 && !['REVERSAL'].includes(entry.entryType))
    .map((entry) => {
      const allocated = allocations
        .filter((allocation) => allocation.supplierAccountEntryId === entry.entryId)
        .reduce((sum, allocation) => sum + allocation.amountAllocated, 0);
      return { entry, outstanding: roundMoney(Math.max(0, entry.credit - allocated)) };
    })
    .filter((row) => row.outstanding > 0);
}

export function recordSupplierAccountEntry(
  input: SupplierAccountEntryInput,
  session?: PosSession | CanonicalSupplierContext | null
): SupplierAccountEntry {
  const context = assertCanonicalSupplierContext(session || {
    vendorId: input.vendorId || '',
    branchId: input.branchId || '',
    warehouseId: '',
    terminalId: '',
    staffId: input.createdBy || '',
    staffName: input.createdBy || '',
    role: '',
    permissions: []
  });
  const supplierId = clean(input.supplierId);
  const referenceId = clean(input.referenceId);
  if (!supplierId) throw new Error('Supplier is required.');
  if (!referenceId) throw new Error('Supplier account reference is required.');

  const debit = roundMoney(input.debit || 0);
  const credit = roundMoney(input.credit || 0);
  if (debit < 0 || credit < 0) throw new Error('Supplier account amounts cannot be negative.');
  if (debit === 0 && credit === 0) throw new Error('Supplier account entry must include a debit or credit amount.');

  const entryType = normalizeEntryType(input.entryType);
  const entryId = cleanId(input.entryId || entryIdFor({
    vendorId: context.vendorId,
    supplierId,
    entryType,
    referenceType: input.referenceType,
    referenceId
  }));
  const existing = readEntries(context.vendorId).find((entry) => entry.entryId === entryId);
  if (existing) return existing;

  const createdAt = input.createdAt || nowIso();
  const transactionDate = input.transactionDate || createdAt;
  const previousBalance = calculateSupplierLedgerBalance(context.vendorId, supplierId);
  const entry: SupplierAccountEntry = {
    entryId,
    vendorId: context.vendorId,
    supplierId,
    branchId: input.branchId || context.branchId,
    entryType,
    referenceType: input.referenceType,
    referenceId,
    debit,
    credit,
    balanceAfter: roundMoney(previousBalance + credit - debit),
    dueDate: input.dueDate,
    transactionDate,
    description: input.description || input.notes || `${entryType} ${referenceId}`,
    createdBy: input.createdBy || context.staffId,
    createdAt,
    reversedEntryId: input.reversedEntryId,
    supplierInvoiceNumber: clean(input.supplierInvoiceNumber) || undefined,
    purchaseOrderId: clean(input.purchaseOrderId) || undefined,
    goodsReceiptId: clean(input.goodsReceiptId) || undefined
  };

  writeEntries(context.vendorId, [entry, ...readEntries(context.vendorId)]);
  return entry;
}

export function reverseSupplierAccountEntry(input: {
  entryId: string;
  reason: string;
}, session?: PosSession | CanonicalSupplierContext | null): SupplierAccountEntry {
  const context = assertCanonicalSupplierContext(session);
  const original = readEntries(context.vendorId).find((entry) => entry.entryId === input.entryId);
  if (!original) throw new Error('Supplier account entry was not found.');
  return recordSupplierAccountEntry({
    supplierId: original.supplierId,
    branchId: original.branchId,
    entryType: 'REVERSAL',
    referenceType: 'REVERSAL',
    referenceId: original.entryId,
    debit: original.credit,
    credit: original.debit,
    description: input.reason,
    reversedEntryId: original.entryId,
    entryId: `${original.entryId}_REVERSAL`,
    transactionDate: nowIso()
  }, context);
}

export function allocateSupplierPayment(input: {
  supplierPaymentId: string;
  supplierId: string;
  allocations: Array<{ supplierAccountEntryId: string; amountAllocated: number }>;
}, session?: PosSession | CanonicalSupplierContext | null): SupplierPaymentAllocation[] {
  const context = assertCanonicalSupplierContext(session);
  const current = readAllocations(context.vendorId);
  const existingForPayment = current.filter((row) => row.supplierPaymentId === input.supplierPaymentId);
  if (existingForPayment.length > 0) return existingForPayment;
  const openEntries = getOpenSupplierCreditEntries(context.vendorId, input.supplierId);
  const openById = new Map(openEntries.map((row) => [row.entry.entryId, row.outstanding]));
  const total = roundMoney(input.allocations.reduce((sum, allocation) => sum + roundMoney(allocation.amountAllocated), 0));
  if (total <= 0) throw new Error('Supplier payment allocation amount must be above zero.');
  input.allocations.forEach((allocation) => {
    if (roundMoney(allocation.amountAllocated) > (openById.get(allocation.supplierAccountEntryId) || 0)) {
      throw new Error('Supplier payment allocation cannot exceed outstanding entry balance.');
    }
  });
  const allocatedAt = nowIso();
  const rows: SupplierPaymentAllocation[] = input.allocations
    .filter((allocation) => allocation.amountAllocated > 0)
    .map((allocation) => ({
      allocationId: cleanId(`${input.supplierPaymentId}_${allocation.supplierAccountEntryId}`),
      supplierPaymentId: input.supplierPaymentId,
      supplierId: input.supplierId,
      supplierAccountEntryId: allocation.supplierAccountEntryId,
      amountAllocated: roundMoney(allocation.amountAllocated),
      allocatedBy: context.staffId,
      allocatedAt,
      vendorId: context.vendorId
    }));
  writeAllocations(context.vendorId, [...rows, ...current]);
  return rows;
}

export function buildOldestDueSupplierAllocations(vendorId: string, supplierId: string, amount: number): Array<{ supplierAccountEntryId: string; amountAllocated: number }> {
  let remaining = roundMoney(amount);
  return getOpenSupplierCreditEntries(vendorId, supplierId)
    .sort((left, right) => (left.entry.dueDate || left.entry.transactionDate).localeCompare(right.entry.dueDate || right.entry.transactionDate))
    .map((row) => {
      const amountAllocated = Math.min(row.outstanding, remaining);
      remaining = roundMoney(remaining - amountAllocated);
      return { supplierAccountEntryId: row.entry.entryId, amountAllocated };
    })
    .filter((row) => row.amountAllocated > 0);
}

export function recordSupplierAccountPurchase(input: {
  vendorId: string;
  supplierId: string;
  referenceType: string;
  referenceId: string;
  amount: number;
  dueDate?: string;
  createdBy: string;
  createdAt?: string;
  notes?: string;
  branchId?: string;
  supplierInvoiceNumber?: string;
  purchaseOrderId?: string;
  goodsReceiptId?: string;
}): SupplierAccountEntry {
  return recordSupplierAccountEntry({
    vendorId: input.vendorId,
    supplierId: input.supplierId,
    branchId: input.branchId,
    entryType: 'PURCHASE',
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    credit: input.amount,
    dueDate: input.dueDate,
    createdBy: input.createdBy,
    createdAt: input.createdAt,
    transactionDate: input.createdAt,
    description: input.notes,
    supplierInvoiceNumber: input.supplierInvoiceNumber,
    purchaseOrderId: input.purchaseOrderId,
    goodsReceiptId: input.goodsReceiptId
  });
}

export function recordSupplierAccountPayment(input: {
  vendorId: string;
  supplierId: string;
  referenceType: string;
  referenceId: string;
  amount: number;
  createdBy: string;
  createdAt?: string;
  notes?: string;
  branchId?: string;
}): SupplierAccountEntry {
  return recordSupplierAccountEntry({
    vendorId: input.vendorId,
    supplierId: input.supplierId,
    branchId: input.branchId,
    entryType: 'PAYMENT',
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    debit: input.amount,
    createdBy: input.createdBy,
    createdAt: input.createdAt,
    transactionDate: input.createdAt,
    description: input.notes
  });
}

export function recordSupplierAccountReturn(input: {
  vendorId: string;
  supplierId: string;
  referenceType: string;
  referenceId: string;
  amount: number;
  createdBy: string;
  createdAt?: string;
  notes?: string;
  branchId?: string;
}): SupplierAccountEntry {
  return recordSupplierAccountEntry({
    vendorId: input.vendorId,
    supplierId: input.supplierId,
    branchId: input.branchId,
    entryType: 'PURCHASE_RETURN',
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    debit: input.amount,
    createdBy: input.createdBy,
    createdAt: input.createdAt,
    transactionDate: input.createdAt,
    description: input.notes
  });
}
