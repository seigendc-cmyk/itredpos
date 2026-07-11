import type { PosSession } from '../types';
import { readVendorScopedList, writeVendorScopedList } from '../utils/vendorDataMode';
import { recordSupplierAccountEntry } from './supplierAccountService';
import { assertCanonicalSupplierContext, type CanonicalSupplierContext } from './supplierContextService';

export const SUPPLIER_DISPUTES_COLLECTION = 'supplier_disputes';

export type SupplierDisputeReason =
  | 'Price mismatch'
  | 'Quantity mismatch'
  | 'Damaged goods'
  | 'Duplicate invoice'
  | 'Missing credit note'
  | 'Payment not recognized'
  | 'Tax mismatch'
  | 'Other';

export type SupplierDisputeStatus = 'Open' | 'UnderReview' | 'Resolved' | 'Rejected' | 'Escalated';

export interface SupplierDisputeRecord {
  disputeId: string;
  vendorId: string;
  supplierId: string;
  referenceType: string;
  referenceId: string;
  disputeReason: SupplierDisputeReason;
  disputedAmount: number;
  openedBy: string;
  openedAt: string;
  status: SupplierDisputeStatus;
  resolution?: string;
  resolvedBy?: string;
  resolvedAt?: string;
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

function rows(vendorId: string): SupplierDisputeRecord[] {
  return readVendorScopedList<SupplierDisputeRecord>(SUPPLIER_DISPUTES_COLLECTION, [], vendorId);
}

export function getSupplierDisputes(vendorId: string, supplierId?: string): SupplierDisputeRecord[] {
  return rows(vendorId).filter((row) => !supplierId || row.supplierId === supplierId);
}

export function openSupplierDispute(input: {
  supplierId: string;
  referenceType: string;
  referenceId: string;
  disputeReason: SupplierDisputeReason;
  disputedAmount: number;
}, session?: PosSession | CanonicalSupplierContext | null): SupplierDisputeRecord {
  const context = assertCanonicalSupplierContext(session);
  const amount = roundMoney(input.disputedAmount);
  if (amount <= 0) throw new Error('Disputed amount must be above zero.');
  const dispute: SupplierDisputeRecord = {
    disputeId: cleanId(`${context.vendorId}_${input.supplierId}_DISPUTE_${input.referenceId}`),
    vendorId: context.vendorId,
    supplierId: input.supplierId,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    disputeReason: input.disputeReason,
    disputedAmount: amount,
    openedBy: context.staffId,
    openedAt: nowIso(),
    status: 'Open'
  };
  writeVendorScopedList(SUPPLIER_DISPUTES_COLLECTION, [dispute, ...rows(context.vendorId).filter((row) => row.disputeId !== dispute.disputeId)], context.vendorId);
  return dispute;
}

export function resolveSupplierDispute(input: {
  disputeId: string;
  resolution: string;
  createAdjustmentAmount?: number;
}, session?: PosSession | CanonicalSupplierContext | null): SupplierDisputeRecord {
  const context = assertCanonicalSupplierContext(session);
  const current = rows(context.vendorId);
  const dispute = current.find((row) => row.disputeId === input.disputeId);
  if (!dispute) throw new Error('Supplier dispute was not found.');
  const resolved: SupplierDisputeRecord = {
    ...dispute,
    status: 'Resolved',
    resolution: input.resolution,
    resolvedBy: context.staffId,
    resolvedAt: nowIso()
  };
  if (input.createAdjustmentAmount && input.createAdjustmentAmount > 0) {
    recordSupplierAccountEntry({
      supplierId: dispute.supplierId,
      entryType: 'ADJUSTMENT',
      referenceType: 'SUPPLIER_DISPUTE',
      referenceId: dispute.disputeId,
      debit: input.createAdjustmentAmount,
      description: input.resolution,
      entryId: `${dispute.disputeId}_ADJUSTMENT`
    }, context);
  }
  writeVendorScopedList(SUPPLIER_DISPUTES_COLLECTION, [resolved, ...current.filter((row) => row.disputeId !== input.disputeId)], context.vendorId);
  return resolved;
}
