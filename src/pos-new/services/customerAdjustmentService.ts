import { createAccountingPostingPlaceholder } from './accountingService';
import { assertCanonicalCustomerContext, type CanonicalCustomerContext } from './customerContextService';
import { recordCustomerAccountEntry } from './customerAccountService';
import type { PosSession } from '../types';
import { readVendorScopedList, writeVendorScopedList } from '../utils/vendorDataMode';

export const CUSTOMER_CREDIT_NOTES_COLLECTION = 'customer_credit_notes';
export const CUSTOMER_WRITEOFFS_COLLECTION = 'customer_writeoffs';

export interface CanonicalCustomerCreditNote {
  creditNoteId: string;
  vendorId: string;
  customerId: string;
  referenceSaleId: string;
  amount: number;
  vatAmount: number;
  reason: string;
  status: 'Draft' | 'Approved' | 'Posted' | 'Cancelled' | 'Reversed';
  createdBy: string;
  approvedBy?: string;
  createdAt: string;
}

export interface CustomerWriteOff {
  writeOffId: string;
  vendorId: string;
  customerId: string;
  amount: number;
  reason: string;
  supportingEvidence: string;
  requestedBy: string;
  approvedBy?: string;
  approvedAt?: string;
  accountingEntryId?: string;
  status: 'Requested' | 'Approved' | 'Posted' | 'Rejected';
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

export function createCustomerCreditNoteEntry(input: {
  customerId: string;
  referenceSaleId: string;
  amount: number;
  vatAmount?: number;
  reason: string;
  approvedBy?: string;
}, session?: PosSession | CanonicalCustomerContext | null): CanonicalCustomerCreditNote {
  const context = assertCanonicalCustomerContext(session);
  const amount = roundMoney(input.amount);
  if (amount <= 0) throw new Error('Credit note amount must be above zero.');
  const note: CanonicalCustomerCreditNote = {
    creditNoteId: cleanId(`${context.vendorId}_${input.customerId}_CREDIT_NOTE_${input.referenceSaleId}`),
    vendorId: context.vendorId,
    customerId: input.customerId,
    referenceSaleId: input.referenceSaleId,
    amount,
    vatAmount: roundMoney(input.vatAmount || 0),
    reason: input.reason,
    status: input.approvedBy ? 'Posted' : 'Draft',
    createdBy: context.staffId,
    approvedBy: input.approvedBy,
    createdAt: nowIso()
  };
  const rows = readVendorScopedList<CanonicalCustomerCreditNote>(CUSTOMER_CREDIT_NOTES_COLLECTION, [], context.vendorId);
  writeVendorScopedList(CUSTOMER_CREDIT_NOTES_COLLECTION, [note, ...rows.filter((row) => row.creditNoteId !== note.creditNoteId)], context.vendorId);
  if (input.approvedBy) {
    recordCustomerAccountEntry({
      customerId: input.customerId,
      entryType: 'CREDIT_NOTE',
      referenceType: 'CREDIT_NOTE',
      referenceId: note.creditNoteId,
      credit: amount,
      description: input.reason,
      idempotencyKey: `${note.creditNoteId}_LEDGER`
    }, context);
  }
  return note;
}

export async function requestCustomerWriteOff(input: {
  customerId: string;
  amount: number;
  reason: string;
  supportingEvidence: string;
  approvedBy?: string;
}, session?: PosSession | CanonicalCustomerContext | null): Promise<CustomerWriteOff> {
  const context = assertCanonicalCustomerContext(session);
  const amount = roundMoney(input.amount);
  if (amount <= 0) throw new Error('Write-off amount must be above zero.');
  const writeOff: CustomerWriteOff = {
    writeOffId: cleanId(`${context.vendorId}_${input.customerId}_WRITEOFF_${amount}_${Date.now()}`),
    vendorId: context.vendorId,
    customerId: input.customerId,
    amount,
    reason: input.reason,
    supportingEvidence: input.supportingEvidence,
    requestedBy: context.staffId,
    approvedBy: input.approvedBy,
    approvedAt: input.approvedBy ? nowIso() : undefined,
    status: input.approvedBy ? 'Posted' : 'Requested'
  };
  if (input.approvedBy) {
    const entry = recordCustomerAccountEntry({
      customerId: input.customerId,
      entryType: 'WRITE_OFF',
      referenceType: 'WRITE_OFF',
      referenceId: writeOff.writeOffId,
      credit: amount,
      description: input.reason,
      idempotencyKey: `${writeOff.writeOffId}_LEDGER`
    }, context);
    await createAccountingPostingPlaceholder({
      source: 'Manual Adjustment',
      sourceReference: writeOff.writeOffId,
      branch: context.branchId,
      amount
    }).catch(() => undefined);
    writeOff.accountingEntryId = entry.entryId;
  }
  const rows = readVendorScopedList<CustomerWriteOff>(CUSTOMER_WRITEOFFS_COLLECTION, [], context.vendorId);
  writeVendorScopedList(CUSTOMER_WRITEOFFS_COLLECTION, [writeOff, ...rows.filter((row) => row.writeOffId !== writeOff.writeOffId)], context.vendorId);
  return writeOff;
}
