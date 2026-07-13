import type { PosSession } from '../types';
import { readVendorScopedList, writeVendorScopedList } from '../utils/vendorDataMode';
import { createAccountingPostingPlaceholder } from './accountingService';
import { recordSupplierAccountEntry } from './supplierAccountService';
import { assertCanonicalSupplierContext, type CanonicalSupplierContext } from './supplierContextService';

export const SUPPLIER_CREDIT_NOTES_COLLECTION = 'supplier_credit_notes';
export const SUPPLIER_DEBIT_NOTES_COLLECTION = 'supplier_debit_notes';

export interface SupplierCreditNoteRecord {
  supplierCreditNoteId: string;
  vendorId: string;
  supplierId: string;
  referencePurchaseId: string;
  referenceGoodsReceiptId?: string;
  amount: number;
  vatAmount: number;
  reason: string;
  status: 'Draft' | 'Approved' | 'Posted' | 'Cancelled' | 'Reversed';
  approvedBy?: string;
  createdBy: string;
  createdAt: string;
}

export interface SupplierDebitNoteRecord {
  debitNoteId: string;
  vendorId: string;
  supplierId: string;
  referenceId: string;
  amount: number;
  vatAmount: number;
  reason: string;
  status: 'Draft' | 'Approved' | 'Posted' | 'Cancelled' | 'Reversed';
  approvedBy?: string;
  createdBy: string;
  createdAt: string;
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

export function getSupplierCreditNotes(vendorId: string, supplierId?: string): SupplierCreditNoteRecord[] {
  return readVendorScopedList<SupplierCreditNoteRecord>(SUPPLIER_CREDIT_NOTES_COLLECTION, [], vendorId)
    .filter((row) => !supplierId || row.supplierId === supplierId);
}

export function getSupplierDebitNotes(vendorId: string, supplierId?: string): SupplierDebitNoteRecord[] {
  return readVendorScopedList<SupplierDebitNoteRecord>(SUPPLIER_DEBIT_NOTES_COLLECTION, [], vendorId)
    .filter((row) => !supplierId || row.supplierId === supplierId);
}

export async function createSupplierCreditNote(input: {
  supplierId: string;
  referencePurchaseId: string;
  referenceGoodsReceiptId?: string;
  amount: number;
  vatAmount?: number;
  reason: string;
  approvedBy?: string;
}, session?: PosSession | CanonicalSupplierContext | null): Promise<SupplierCreditNoteRecord> {
  const context = assertCanonicalSupplierContext(session);
  const amount = roundMoney(input.amount);
  if (amount <= 0) throw new Error('Supplier credit note amount must be above zero.');
  const note: SupplierCreditNoteRecord = {
    supplierCreditNoteId: cleanId(`${context.vendorId}_${input.supplierId}_SUPPLIER_CREDIT_NOTE_${input.referencePurchaseId}_${amount}`),
    vendorId: context.vendorId,
    supplierId: input.supplierId,
    referencePurchaseId: input.referencePurchaseId,
    referenceGoodsReceiptId: input.referenceGoodsReceiptId,
    amount,
    vatAmount: roundMoney(input.vatAmount || 0),
    reason: input.reason,
    status: input.approvedBy ? 'Posted' : 'Draft',
    approvedBy: input.approvedBy,
    createdBy: context.staffId,
    createdAt: nowIso()
  };
  const rows = getSupplierCreditNotes(context.vendorId);
  writeVendorScopedList(SUPPLIER_CREDIT_NOTES_COLLECTION, [note, ...rows.filter((row) => row.supplierCreditNoteId !== note.supplierCreditNoteId)], context.vendorId);
  if (input.approvedBy) {
    recordSupplierAccountEntry({
      supplierId: input.supplierId,
      entryType: 'CREDIT_NOTE',
      referenceType: 'SUPPLIER_CREDIT_NOTE',
      referenceId: note.supplierCreditNoteId,
      debit: amount,
      description: input.reason,
      entryId: `${note.supplierCreditNoteId}_LEDGER`
    }, context);
    await createAccountingPostingPlaceholder({
      source: 'Manual Adjustment',
      sourceReference: note.supplierCreditNoteId,
      branch: context.branchId,
      amount
    }).catch(() => undefined);
  }
  return note;
}

export async function createSupplierDebitNote(input: {
  supplierId: string;
  referenceId: string;
  amount: number;
  vatAmount?: number;
  reason: string;
  approvedBy?: string;
}, session?: PosSession | CanonicalSupplierContext | null): Promise<SupplierDebitNoteRecord> {
  const context = assertCanonicalSupplierContext(session);
  const amount = roundMoney(input.amount);
  if (amount <= 0) throw new Error('Supplier debit note amount must be above zero.');
  const note: SupplierDebitNoteRecord = {
    debitNoteId: cleanId(`${context.vendorId}_${input.supplierId}_SUPPLIER_DEBIT_NOTE_${input.referenceId}_${amount}`),
    vendorId: context.vendorId,
    supplierId: input.supplierId,
    referenceId: input.referenceId,
    amount,
    vatAmount: roundMoney(input.vatAmount || 0),
    reason: input.reason,
    status: input.approvedBy ? 'Posted' : 'Draft',
    approvedBy: input.approvedBy,
    createdBy: context.staffId,
    createdAt: nowIso()
  };
  const rows = getSupplierDebitNotes(context.vendorId);
  writeVendorScopedList(SUPPLIER_DEBIT_NOTES_COLLECTION, [note, ...rows.filter((row) => row.debitNoteId !== note.debitNoteId)], context.vendorId);
  if (input.approvedBy) {
    recordSupplierAccountEntry({
      supplierId: input.supplierId,
      entryType: 'DEBIT_NOTE',
      referenceType: 'SUPPLIER_DEBIT_NOTE',
      referenceId: note.debitNoteId,
      debit: amount,
      description: input.reason,
      entryId: `${note.debitNoteId}_LEDGER`
    }, context);
  }
  return note;
}
