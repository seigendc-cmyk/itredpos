import type { PosSession } from '../types';
import { readVendorScopedList, writeVendorScopedList } from '../utils/vendorDataMode';
import { getSupplierAccountEntries } from './supplierAccountService';
import { assertCanonicalSupplierContext, type CanonicalSupplierContext } from './supplierContextService';
import { getSupplierById } from './supplierService';

export const SUPPLIER_RECONCILIATIONS_COLLECTION = 'supplier_reconciliations';

export type SupplierReconciliationStatus = 'Draft' | 'DifferenceFound' | 'UnderReview' | 'Reconciled' | 'Approved' | 'Reopened';

export interface SupplierExternalStatementLine {
  reference: string;
  amount: number;
  type: 'Invoice' | 'Payment' | 'Credit' | 'Return';
}

export interface SupplierReconciliationRecord {
  reconciliationId: string;
  vendorId: string;
  supplierId: string;
  statementPeriodStart: string;
  statementPeriodEnd: string;
  internalClosingBalance: number;
  supplierClosingBalance: number;
  difference: number;
  unmatchedInvoices: string[];
  unmatchedPayments: string[];
  unmatchedCredits: string[];
  status: SupplierReconciliationStatus;
  notes: string;
  reviewedBy: string;
  reviewedAt: string;
  reopenedReason?: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function cleanId(value: string): string {
  return String(value || '').replace(/[^A-Za-z0-9_-]/g, '_');
}

function roundMoney(value: number): number {
  return Number((Math.round((Number(value) + Number.EPSILON) * 100) / 100).toFixed(2));
}

function readRows(vendorId: string): SupplierReconciliationRecord[] {
  return readVendorScopedList<SupplierReconciliationRecord>(SUPPLIER_RECONCILIATIONS_COLLECTION, [], vendorId);
}

export function getSupplierReconciliations(vendorId: string, supplierId?: string): SupplierReconciliationRecord[] {
  return readRows(vendorId).filter((row) => !supplierId || row.supplierId === supplierId);
}

export function createSupplierReconciliation(input: {
  supplierId: string;
  statementPeriodStart: string;
  statementPeriodEnd: string;
  supplierClosingBalance: number;
  supplierLines?: SupplierExternalStatementLine[];
  notes?: string;
}, session?: PosSession | CanonicalSupplierContext | null): SupplierReconciliationRecord {
  const context = assertCanonicalSupplierContext(session);
  const supplier = getSupplierById(input.supplierId, context);
  if (!supplier) throw new Error('Supplier record was not found.');
  const entries = getSupplierAccountEntries({ vendorId: context.vendorId, supplierId: input.supplierId })
    .filter((entry) => entry.transactionDate.slice(0, 10) <= input.statementPeriodEnd);
  const periodReferences = new Set(entries
    .filter((entry) => entry.transactionDate.slice(0, 10) >= input.statementPeriodStart)
    .map((entry) => entry.referenceId));
  const internalClosingBalance = roundMoney(entries.reduce((sum, entry) => sum + entry.credit - entry.debit, 0));
  const supplierClosingBalance = roundMoney(input.supplierClosingBalance);
  const difference = roundMoney(supplierClosingBalance - internalClosingBalance);
  const external = input.supplierLines || [];
  const unmatched = (type: SupplierExternalStatementLine['type']) => external
    .filter((line) => line.type === type && !periodReferences.has(line.reference))
    .map((line) => line.reference);
  const record: SupplierReconciliationRecord = {
    reconciliationId: cleanId(`${context.vendorId}_${input.supplierId}_RECON_${input.statementPeriodStart}_${input.statementPeriodEnd}`),
    vendorId: context.vendorId,
    supplierId: input.supplierId,
    statementPeriodStart: input.statementPeriodStart,
    statementPeriodEnd: input.statementPeriodEnd,
    internalClosingBalance,
    supplierClosingBalance,
    difference,
    unmatchedInvoices: unmatched('Invoice'),
    unmatchedPayments: unmatched('Payment'),
    unmatchedCredits: [...unmatched('Credit'), ...unmatched('Return')],
    status: difference === 0 && external.every((line) => periodReferences.has(line.reference)) ? 'Reconciled' : 'DifferenceFound',
    notes: input.notes || '',
    reviewedBy: context.staffId,
    reviewedAt: nowIso()
  };
  const rows = readRows(context.vendorId);
  writeVendorScopedList(SUPPLIER_RECONCILIATIONS_COLLECTION, [record, ...rows.filter((row) => row.reconciliationId !== record.reconciliationId)], context.vendorId);
  return record;
}

export function updateSupplierReconciliationStatus(input: {
  reconciliationId: string;
  status: SupplierReconciliationStatus;
  notes?: string;
  reopenedReason?: string;
}, session?: PosSession | CanonicalSupplierContext | null): SupplierReconciliationRecord | null {
  const context = assertCanonicalSupplierContext(session);
  const rows = readRows(context.vendorId);
  let updated: SupplierReconciliationRecord | null = null;
  writeVendorScopedList(SUPPLIER_RECONCILIATIONS_COLLECTION, rows.map((row) => {
    if (row.reconciliationId !== input.reconciliationId) return row;
    if (row.status === 'Approved' && input.status !== 'Reopened') throw new Error('Approved reconciliation is read-only unless reopened.');
    if (input.status === 'Reopened' && !input.reopenedReason?.trim()) throw new Error('Reopen requires a reason.');
    updated = {
      ...row,
      status: input.status,
      notes: [row.notes, input.notes].filter(Boolean).join(' '),
      reopenedReason: input.reopenedReason,
      reviewedBy: context.staffId,
      reviewedAt: nowIso()
    };
    return updated;
  }), context.vendorId);
  return updated;
}
