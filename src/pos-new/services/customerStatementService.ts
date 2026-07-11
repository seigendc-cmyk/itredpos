import { assertCanonicalCustomerContext, type CanonicalCustomerContext } from './customerContextService';
import { calculateCustomerLedgerBalance, getCustomerAccountEntries, type CustomerAccountEntry } from './customerAccountService';
import { calculateCustomerAgeing, type CustomerAgeingBreakdown } from './customerAgeingService';
import { getCustomerById } from './customerService';
import type { CustomerRecord, PosSession } from '../types';
import { readVendorScopedList, writeVendorScopedList } from '../utils/vendorDataMode';

export const CUSTOMER_STATEMENTS_COLLECTION = 'customer_statements';

export type CustomerStatementStatus = 'Draft' | 'Issued' | 'PreparedToSend' | 'Cancelled';

export interface CustomerStatementLine {
  date: string;
  description: string;
  reference: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

export interface CustomerStatementRecord {
  statementId: string;
  vendorId: string;
  customerId: string;
  customerName: string;
  customerAccountNumber: string;
  periodFrom: string;
  periodTo: string;
  openingBalance: number;
  transactions: CustomerStatementLine[];
  closingBalance: number;
  ageing: CustomerAgeingBreakdown;
  paymentInstructions: string;
  contactDetails: string;
  status: CustomerStatementStatus;
  generatedBy: string;
  generatedAt: string;
  issuedAt?: string;
  deliveryPreview?: string;
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

function inPeriod(entry: CustomerAccountEntry, from: string, to: string): boolean {
  const value = entry.transactionDate.slice(0, 10);
  return value >= from && value <= to;
}

function buildLines(entries: CustomerAccountEntry[], openingBalance: number): CustomerStatementLine[] {
  let running = openingBalance;
  return entries.map((entry) => {
    running = roundMoney(running + entry.debit - entry.credit);
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

function statementIdFor(vendorId: string, customerId: string, from: string, to: string): string {
  return cleanId(`${vendorId}_${customerId}_STATEMENT_${from}_${to}`);
}

export function getCustomerStatements(vendorId: string, customerId?: string): CustomerStatementRecord[] {
  return readVendorScopedList<CustomerStatementRecord>(CUSTOMER_STATEMENTS_COLLECTION, [], vendorId)
    .filter((statement) => !customerId || statement.customerId === customerId);
}

export async function generateCanonicalCustomerStatement(input: {
  customerId: string;
  periodFrom: string;
  periodTo: string;
  issue?: boolean;
  paymentInstructions?: string;
}, session?: PosSession | CanonicalCustomerContext | null): Promise<CustomerStatementRecord> {
  const context = assertCanonicalCustomerContext(session);
  const customer = await getCustomerById(input.customerId, context) as CustomerRecord | null;
  if (!customer) throw new Error('Customer record was not found.');
  if (customer.vendorId !== context.vendorId) throw new Error('Customer belongs to another vendor.');
  const allEntries = getCustomerAccountEntries(context.vendorId, input.customerId);
  const openingBalance = roundMoney(allEntries
    .filter((entry) => entry.transactionDate.slice(0, 10) < input.periodFrom)
    .reduce((sum, entry) => sum + entry.debit - entry.credit, 0));
  const periodEntries = allEntries.filter((entry) => inPeriod(entry, input.periodFrom, input.periodTo));
  const transactions = buildLines(periodEntries, openingBalance);
  const closingBalance = transactions.length
    ? transactions[transactions.length - 1].runningBalance
    : calculateCustomerLedgerBalance(context.vendorId, input.customerId);
  const statement: CustomerStatementRecord = {
    statementId: statementIdFor(context.vendorId, input.customerId, input.periodFrom, input.periodTo),
    vendorId: context.vendorId,
    customerId: input.customerId,
    customerName: customer.customerName,
    customerAccountNumber: customer.customerCode || customer.customerId,
    periodFrom: input.periodFrom,
    periodTo: input.periodTo,
    openingBalance,
    transactions,
    closingBalance,
    ageing: calculateCustomerAgeing(input.customerId, `${input.periodTo}T23:59:59`, context),
    paymentInstructions: input.paymentInstructions || 'Please pay using the agreed account payment channels and quote your statement number.',
    contactDetails: [customer.phone, customer.email].filter(Boolean).join(' | '),
    status: input.issue ? 'Issued' : 'Draft',
    generatedBy: context.staffId,
    generatedAt: nowIso(),
    issuedAt: input.issue ? nowIso() : undefined
  };
  const rows = getCustomerStatements(context.vendorId);
  writeVendorScopedList(CUSTOMER_STATEMENTS_COLLECTION, [statement, ...rows.filter((row) => row.statementId !== statement.statementId)], context.vendorId);
  return statement;
}

export function prepareCustomerStatementMessage(statement: CustomerStatementRecord, channel: 'WhatsApp' | 'Email'): CustomerStatementRecord {
  const deliveryPreview = `${channel} preview prepared for ${statement.customerName}. Closing balance USD ${statement.closingBalance.toFixed(2)} for ${statement.periodFrom} to ${statement.periodTo}.`;
  const updated = { ...statement, status: 'PreparedToSend' as const, deliveryPreview };
  const rows = getCustomerStatements(statement.vendorId);
  writeVendorScopedList(CUSTOMER_STATEMENTS_COLLECTION, [updated, ...rows.filter((row) => row.statementId !== statement.statementId)], statement.vendorId);
  return updated;
}
