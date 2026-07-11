import { assertCanonicalCustomerContext, type CanonicalCustomerContext } from './customerContextService';
import type { PosSession } from '../types';
import { readVendorScopedList, writeVendorScopedList } from '../utils/vendorDataMode';

export const CUSTOMER_ACCOUNTS_COLLECTION = 'customer_accounts';
export const CUSTOMER_PAYMENT_ALLOCATIONS_COLLECTION = 'customer_payment_allocations';

export type CustomerAccountEntryType =
  | 'CREDIT_SALE'
  | 'PAYMENT'
  | 'CREDIT_NOTE'
  | 'SALES_RETURN'
  | 'OPENING_BALANCE'
  | 'ADJUSTMENT'
  | 'INTEREST'
  | 'WRITE_OFF'
  | 'REVERSAL';

export interface CustomerAccountEntry {
  entryId: string;
  vendorId: string;
  customerId: string;
  branchId: string;
  entryType: CustomerAccountEntryType;
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
}

export interface CustomerPaymentAllocation {
  allocationId: string;
  customerPaymentId: string;
  customerId: string;
  accountEntryId: string;
  amountAllocated: number;
  allocatedBy: string;
  allocatedAt: string;
  vendorId: string;
}

export interface OpenCustomerDebitEntry {
  entry: CustomerAccountEntry;
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

function entryIdFor(input: {
  vendorId: string;
  customerId: string;
  entryType: CustomerAccountEntryType;
  referenceType: string;
  referenceId: string;
}): string {
  return cleanId(`${input.vendorId}_${input.customerId}_${input.entryType}_${input.referenceType}_${input.referenceId}`);
}

function readEntries(vendorId: string): CustomerAccountEntry[] {
  return readVendorScopedList<CustomerAccountEntry>(CUSTOMER_ACCOUNTS_COLLECTION, [], vendorId);
}

function writeEntries(vendorId: string, rows: CustomerAccountEntry[]): CustomerAccountEntry[] {
  return writeVendorScopedList(CUSTOMER_ACCOUNTS_COLLECTION, rows, vendorId);
}

function readAllocations(vendorId: string): CustomerPaymentAllocation[] {
  return readVendorScopedList<CustomerPaymentAllocation>(CUSTOMER_PAYMENT_ALLOCATIONS_COLLECTION, [], vendorId);
}

function writeAllocations(vendorId: string, rows: CustomerPaymentAllocation[]): CustomerPaymentAllocation[] {
  return writeVendorScopedList(CUSTOMER_PAYMENT_ALLOCATIONS_COLLECTION, rows, vendorId);
}

function sortedCustomerEntries(vendorId: string, customerId: string): CustomerAccountEntry[] {
  return readEntries(vendorId)
    .filter((entry) => entry.customerId === customerId)
    .sort((left, right) =>
      left.transactionDate.localeCompare(right.transactionDate)
      || left.createdAt.localeCompare(right.createdAt)
      || left.entryId.localeCompare(right.entryId)
    );
}

export function calculateCustomerLedgerBalance(vendorId: string, customerId: string): number {
  return roundMoney(sortedCustomerEntries(vendorId, customerId).reduce((balance, entry) => balance + entry.debit - entry.credit, 0));
}

export function getCustomerAccountEntries(vendorId: string, customerId?: string): CustomerAccountEntry[] {
  return readEntries(vendorId)
    .filter((entry) => !customerId || entry.customerId === customerId)
    .sort((left, right) =>
      left.transactionDate.localeCompare(right.transactionDate)
      || left.createdAt.localeCompare(right.createdAt)
    );
}

export function getCustomerPaymentAllocations(vendorId: string, paymentId?: string): CustomerPaymentAllocation[] {
  return readAllocations(vendorId).filter((row) => !paymentId || row.customerPaymentId === paymentId);
}

export function getOpenCustomerDebitEntries(vendorId: string, customerId: string): OpenCustomerDebitEntry[] {
  const allocations = readAllocations(vendorId);
  return sortedCustomerEntries(vendorId, customerId)
    .filter((entry) => entry.debit > 0 && !['REVERSAL'].includes(entry.entryType))
    .map((entry) => {
      const allocated = allocations
        .filter((allocation) => allocation.accountEntryId === entry.entryId)
        .reduce((sum, allocation) => sum + allocation.amountAllocated, 0);
      return { entry, outstanding: roundMoney(Math.max(0, entry.debit - allocated)) };
    })
    .filter((row) => row.outstanding > 0);
}

export function recordCustomerAccountEntry(input: {
  customerId: string;
  entryType: CustomerAccountEntryType;
  referenceType: string;
  referenceId: string;
  debit?: number;
  credit?: number;
  dueDate?: string;
  transactionDate?: string;
  description: string;
  branchId?: string;
  idempotencyKey?: string;
  reversedEntryId?: string;
}, session?: PosSession | CanonicalCustomerContext | null): CustomerAccountEntry {
  const context = assertCanonicalCustomerContext(session);
  const debit = roundMoney(input.debit || 0);
  const credit = roundMoney(input.credit || 0);
  if (debit < 0 || credit < 0) throw new Error('Customer account amounts cannot be negative.');
  if (debit === 0 && credit === 0) throw new Error('Customer account entry requires a debit or credit amount.');
  if (!clean(input.customerId)) throw new Error('Customer account entry requires a customer.');
  if (!clean(input.referenceId)) throw new Error('Customer account entry requires a source reference.');

  const entryId = cleanId(input.idempotencyKey || entryIdFor({
    vendorId: context.vendorId,
    customerId: input.customerId,
    entryType: input.entryType,
    referenceType: input.referenceType,
    referenceId: input.referenceId
  }));
  const existing = readEntries(context.vendorId).find((entry) => entry.entryId === entryId);
  if (existing) return existing;

  const transactionDate = input.transactionDate || nowIso();
  const currentBalance = calculateCustomerLedgerBalance(context.vendorId, input.customerId);
  const entry: CustomerAccountEntry = {
    entryId,
    vendorId: context.vendorId,
    customerId: input.customerId,
    branchId: input.branchId || context.branchId,
    entryType: input.entryType,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    debit,
    credit,
    balanceAfter: roundMoney(currentBalance + debit - credit),
    dueDate: input.dueDate,
    transactionDate,
    description: input.description,
    createdBy: context.staffId,
    createdAt: nowIso(),
    reversedEntryId: input.reversedEntryId
  };
  writeEntries(context.vendorId, [entry, ...readEntries(context.vendorId)]);
  return entry;
}

export function reverseCustomerAccountEntry(input: {
  entryId: string;
  reason: string;
}, session?: PosSession | CanonicalCustomerContext | null): CustomerAccountEntry {
  const context = assertCanonicalCustomerContext(session);
  const original = readEntries(context.vendorId).find((entry) => entry.entryId === input.entryId);
  if (!original) throw new Error('Customer account entry was not found.');
  return recordCustomerAccountEntry({
    customerId: original.customerId,
    entryType: 'REVERSAL',
    referenceType: 'REVERSAL',
    referenceId: original.entryId,
    debit: original.credit,
    credit: original.debit,
    transactionDate: nowIso(),
    description: input.reason,
    reversedEntryId: original.entryId,
    idempotencyKey: `${original.entryId}_REVERSAL`
  }, context);
}

export function allocateCustomerPayment(input: {
  customerPaymentId: string;
  customerId: string;
  allocations: Array<{ accountEntryId: string; amountAllocated: number }>;
}, session?: PosSession | CanonicalCustomerContext | null): CustomerPaymentAllocation[] {
  const context = assertCanonicalCustomerContext(session);
  const current = readAllocations(context.vendorId);
  const createdAt = nowIso();
  const existingForPayment = current.filter((row) => row.customerPaymentId === input.customerPaymentId);
  if (existingForPayment.length > 0) return existingForPayment;
  const openEntries = getOpenCustomerDebitEntries(context.vendorId, input.customerId);
  const openById = new Map(openEntries.map((row) => [row.entry.entryId, row.outstanding]));
  const total = input.allocations.reduce((sum, allocation) => sum + roundMoney(allocation.amountAllocated), 0);
  if (total <= 0) throw new Error('Payment allocation amount must be above zero.');
  input.allocations.forEach((allocation) => {
    if (roundMoney(allocation.amountAllocated) > (openById.get(allocation.accountEntryId) || 0)) {
      throw new Error('Payment allocation cannot exceed outstanding entry balance.');
    }
  });
  const rows: CustomerPaymentAllocation[] = input.allocations
    .filter((allocation) => allocation.amountAllocated > 0)
    .map((allocation) => ({
      allocationId: cleanId(`${input.customerPaymentId}_${allocation.accountEntryId}`),
      customerPaymentId: input.customerPaymentId,
      customerId: input.customerId,
      accountEntryId: allocation.accountEntryId,
      amountAllocated: roundMoney(allocation.amountAllocated),
      allocatedBy: context.staffId,
      allocatedAt: createdAt,
      vendorId: context.vendorId
    }));
  writeAllocations(context.vendorId, [...rows, ...current]);
  return rows;
}

export function buildOldestDueAllocations(vendorId: string, customerId: string, amount: number): Array<{ accountEntryId: string; amountAllocated: number }> {
  let remaining = roundMoney(amount);
  return getOpenCustomerDebitEntries(vendorId, customerId)
    .sort((left, right) => (left.entry.dueDate || left.entry.transactionDate).localeCompare(right.entry.dueDate || right.entry.transactionDate))
    .map((row) => {
      const amountAllocated = Math.min(row.outstanding, remaining);
      remaining = roundMoney(remaining - amountAllocated);
      return { accountEntryId: row.entry.entryId, amountAllocated };
    })
    .filter((row) => row.amountAllocated > 0);
}
