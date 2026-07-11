import type { PosSession } from '../types';
import { readVendorScopedList, writeVendorScopedList } from '../utils/vendorDataMode';
import { calculateSupplierAgeing, type SupplierAgeingBreakdown } from './supplierAgeingService';
import { calculateSupplierLedgerBalance, getSupplierAccountEntries, type SupplierAccountEntry } from './supplierAccountService';
import { assertCanonicalSupplierContext, type CanonicalSupplierContext } from './supplierContextService';
import { getSupplierById } from './supplierService';

export const SUPPLIER_STATEMENTS_COLLECTION = 'supplier_statements';

export type SupplierStatementStatus = 'Draft' | 'Issued' | 'Reconciled' | 'Cancelled';

export interface SupplierStatementLine {
  date: string;
  description: string;
  reference: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

export interface CanonicalSupplierStatement {
  statementId: string;
  vendorId: string;
  supplierId: string;
  supplierName: string;
  supplierAccountNumber: string;
  periodFrom: string;
  periodTo: string;
  openingBalance: number;
  purchases: number;
  payments: number;
  creditNotes: number;
  purchaseReturns: number;
  adjustments: number;
  transactions: SupplierStatementLine[];
  closingBalance: number;
  ageing: SupplierAgeingBreakdown;
  status: SupplierStatementStatus;
  generatedBy: string;
  generatedAt: string;
  reconciledAt?: string;
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

function inPeriod(entry: SupplierAccountEntry, from: string, to: string): boolean {
  const value = entry.transactionDate.slice(0, 10);
  return value >= from && value <= to;
}

function statementIdFor(vendorId: string, supplierId: string, from: string, to: string): string {
  return cleanId(`${vendorId}_${supplierId}_SUPPLIER_STATEMENT_${from}_${to}`);
}

function readStatements(vendorId: string): CanonicalSupplierStatement[] {
  return readVendorScopedList<CanonicalSupplierStatement>(SUPPLIER_STATEMENTS_COLLECTION, [], vendorId);
}

function buildLines(entries: SupplierAccountEntry[], openingBalance: number): SupplierStatementLine[] {
  let running = openingBalance;
  return entries.map((entry) => {
    running = roundMoney(running + entry.credit - entry.debit);
    return {
      date: entry.transactionDate,
      description: entry.description,
      reference: entry.referenceId,
      debit: entry.debit,
      credit: entry.credit,
      runningBalance: running
    };
  });
}

export function getCanonicalSupplierStatements(vendorId: string, supplierId?: string): CanonicalSupplierStatement[] {
  return readStatements(vendorId).filter((statement) => !supplierId || statement.supplierId === supplierId);
}

export async function generateCanonicalSupplierStatement(input: {
  supplierId: string;
  periodFrom: string;
  periodTo: string;
  issue?: boolean;
}, session?: PosSession | CanonicalSupplierContext | null): Promise<CanonicalSupplierStatement> {
  const context = assertCanonicalSupplierContext(session);
  const supplier = getSupplierById(input.supplierId, context);
  if (!supplier) throw new Error('Supplier record was not found.');
  if (supplier.vendorId !== context.vendorId) throw new Error('Supplier belongs to another vendor.');
  const allEntries = getSupplierAccountEntries({ vendorId: context.vendorId, supplierId: input.supplierId });
  const openingBalance = roundMoney(allEntries
    .filter((entry) => entry.transactionDate.slice(0, 10) < input.periodFrom)
    .reduce((sum, entry) => sum + entry.credit - entry.debit, 0));
  const periodEntries = allEntries.filter((entry) => inPeriod(entry, input.periodFrom, input.periodTo));
  const transactions = buildLines(periodEntries, openingBalance);
  const closingBalance = transactions.length
    ? transactions[transactions.length - 1].runningBalance
    : calculateSupplierLedgerBalance(context.vendorId, input.supplierId);
  const sumEntries = (types: SupplierAccountEntry['entryType'][], side: 'debit' | 'credit') =>
    roundMoney(periodEntries.filter((entry) => types.includes(entry.entryType)).reduce((sum, entry) => sum + entry[side], 0));
  const statement: CanonicalSupplierStatement = {
    statementId: statementIdFor(context.vendorId, input.supplierId, input.periodFrom, input.periodTo),
    vendorId: context.vendorId,
    supplierId: input.supplierId,
    supplierName: supplier.supplierName,
    supplierAccountNumber: supplier.supplierCode,
    periodFrom: input.periodFrom,
    periodTo: input.periodTo,
    openingBalance,
    purchases: sumEntries(['PURCHASE', 'OPENING_BALANCE', 'INTEREST'], 'credit'),
    payments: sumEntries(['PAYMENT'], 'debit'),
    creditNotes: sumEntries(['CREDIT_NOTE'], 'debit'),
    purchaseReturns: sumEntries(['PURCHASE_RETURN'], 'debit'),
    adjustments: roundMoney(sumEntries(['ADJUSTMENT', 'DEBIT_NOTE', 'REVERSAL'], 'debit') - sumEntries(['ADJUSTMENT', 'REVERSAL'], 'credit')),
    transactions,
    closingBalance,
    ageing: calculateSupplierAgeing(input.supplierId, `${input.periodTo}T23:59:59`, context),
    status: input.issue ? 'Issued' : 'Draft',
    generatedBy: context.staffId,
    generatedAt: nowIso()
  };
  writeVendorScopedList(SUPPLIER_STATEMENTS_COLLECTION, [statement, ...readStatements(context.vendorId).filter((row) => row.statementId !== statement.statementId)], context.vendorId);
  return statement;
}

export function markSupplierStatementReconciled(statementId: string, session?: PosSession | CanonicalSupplierContext | null): CanonicalSupplierStatement | null {
  const context = assertCanonicalSupplierContext(session);
  const rows = readStatements(context.vendorId);
  let updated: CanonicalSupplierStatement | null = null;
  writeVendorScopedList(SUPPLIER_STATEMENTS_COLLECTION, rows.map((statement) => {
    if (statement.statementId !== statementId) return statement;
    updated = { ...statement, status: 'Reconciled' as const, reconciledAt: nowIso() };
    return updated;
  }), context.vendorId);
  return updated;
}
