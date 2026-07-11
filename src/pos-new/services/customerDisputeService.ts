import { assertCanonicalCustomerContext, type CanonicalCustomerContext } from './customerContextService';
import { recordCustomerAccountEntry } from './customerAccountService';
import type { PosSession } from '../types';
import { readVendorScopedList, writeVendorScopedList } from '../utils/vendorDataMode';

export const CUSTOMER_DISPUTES_COLLECTION = 'customer_disputes';

export type CustomerDisputeStatus = 'Open' | 'UnderReview' | 'Resolved' | 'Rejected' | 'Escalated';

export interface CustomerDispute {
  disputeId: string;
  vendorId: string;
  customerId: string;
  referenceType: string;
  referenceId: string;
  disputeReason: string;
  disputedAmount: number;
  openedBy: string;
  openedAt: string;
  status: CustomerDisputeStatus;
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

function rows(vendorId: string): CustomerDispute[] {
  return readVendorScopedList<CustomerDispute>(CUSTOMER_DISPUTES_COLLECTION, [], vendorId);
}

export function getCustomerDisputes(vendorId: string, customerId?: string): CustomerDispute[] {
  return rows(vendorId).filter((row) => !customerId || row.customerId === customerId);
}

export function openCustomerDispute(input: {
  customerId: string;
  referenceType: string;
  referenceId: string;
  disputeReason: string;
  disputedAmount: number;
}, session?: PosSession | CanonicalCustomerContext | null): CustomerDispute {
  const context = assertCanonicalCustomerContext(session);
  const amount = roundMoney(input.disputedAmount);
  if (amount <= 0) throw new Error('Disputed amount must be above zero.');
  const dispute: CustomerDispute = {
    disputeId: cleanId(`${context.vendorId}_${input.customerId}_DISPUTE_${input.referenceId}`),
    vendorId: context.vendorId,
    customerId: input.customerId,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    disputeReason: input.disputeReason,
    disputedAmount: amount,
    openedBy: context.staffId,
    openedAt: nowIso(),
    status: 'Open'
  };
  writeVendorScopedList(CUSTOMER_DISPUTES_COLLECTION, [dispute, ...rows(context.vendorId).filter((row) => row.disputeId !== dispute.disputeId)], context.vendorId);
  return dispute;
}

export function resolveCustomerDispute(input: {
  disputeId: string;
  resolution: string;
  createAdjustmentAmount?: number;
}, session?: PosSession | CanonicalCustomerContext | null): CustomerDispute {
  const context = assertCanonicalCustomerContext(session);
  const current = rows(context.vendorId);
  const dispute = current.find((row) => row.disputeId === input.disputeId);
  if (!dispute) throw new Error('Customer dispute was not found.');
  const resolved: CustomerDispute = {
    ...dispute,
    status: 'Resolved',
    resolution: input.resolution,
    resolvedBy: context.staffId,
    resolvedAt: nowIso()
  };
  if (input.createAdjustmentAmount && input.createAdjustmentAmount > 0) {
    recordCustomerAccountEntry({
      customerId: dispute.customerId,
      entryType: 'ADJUSTMENT',
      referenceType: 'DISPUTE',
      referenceId: dispute.disputeId,
      credit: input.createAdjustmentAmount,
      description: input.resolution,
      idempotencyKey: `${dispute.disputeId}_ADJUSTMENT`
    }, context);
  }
  writeVendorScopedList(CUSTOMER_DISPUTES_COLLECTION, [resolved, ...current.filter((row) => row.disputeId !== input.disputeId)], context.vendorId);
  return resolved;
}
