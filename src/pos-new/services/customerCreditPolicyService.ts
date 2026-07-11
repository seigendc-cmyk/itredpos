import { assertCanonicalCustomerContext, type CanonicalCustomerContext } from './customerContextService';
import type { PosSession } from '../types';
import { readVendorScopedJson, writeVendorScopedJson } from '../utils/vendorDataMode';

export const CUSTOMER_CREDIT_POLICY_COLLECTION = 'customer_credit_policies';

const POLICY_KEY = 'itred_pos_customer_credit_policy_canonical_v1';

export interface CustomerCreditPolicy {
  vendorId: string;
  defaultCreditLimit: number;
  defaultPaymentTermsDays: number;
  maxCreditLimitWithoutApproval: number;
  overdueGraceDays: number;
  blockOnOverdue: boolean;
  blockOnLimitExceeded: boolean;
  requireApprovalForCreditSale: boolean;
  allowPartialCreditPayment: boolean;
  reminderSchedule: number[];
  updatedAt: string;
  updatedBy: string;
}

export function defaultCustomerCreditPolicy(vendorId: string, updatedBy = 'system'): CustomerCreditPolicy {
  return {
    vendorId,
    defaultCreditLimit: 300,
    defaultPaymentTermsDays: 30,
    maxCreditLimitWithoutApproval: 500,
    overdueGraceDays: 0,
    blockOnOverdue: true,
    blockOnLimitExceeded: true,
    requireApprovalForCreditSale: false,
    allowPartialCreditPayment: true,
    reminderSchedule: [0, 7, 30, 60],
    updatedAt: new Date().toISOString(),
    updatedBy
  };
}

export function getCustomerCreditPolicy(session?: PosSession | CanonicalCustomerContext | null): CustomerCreditPolicy {
  const context = assertCanonicalCustomerContext(session);
  return readVendorScopedJson<CustomerCreditPolicy>(
    POLICY_KEY,
    defaultCustomerCreditPolicy(context.vendorId, context.staffId),
    context.vendorId
  );
}

export function saveCustomerCreditPolicy(
  patch: Partial<CustomerCreditPolicy>,
  session?: PosSession | CanonicalCustomerContext | null
): CustomerCreditPolicy {
  const context = assertCanonicalCustomerContext(session);
  const current = getCustomerCreditPolicy(context);
  const next: CustomerCreditPolicy = {
    ...current,
    ...patch,
    vendorId: context.vendorId,
    updatedAt: new Date().toISOString(),
    updatedBy: context.staffId
  };
  return writeVendorScopedJson(POLICY_KEY, next, context.vendorId);
}

export function creditLimitRequiresApproval(limit: number, policy: CustomerCreditPolicy): boolean {
  return limit > policy.maxCreditLimitWithoutApproval;
}

export function creditSaleRequiresApproval(input: {
  saleTotal: number;
  currentBalance: number;
  creditLimit: number;
  overdueBalance: number;
}, policy: CustomerCreditPolicy): { required: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (policy.requireApprovalForCreditSale) reasons.push('Approval required by vendor policy.');
  if (policy.blockOnLimitExceeded && input.currentBalance + input.saleTotal > input.creditLimit) reasons.push('Credit limit exceeded.');
  if (policy.blockOnOverdue && input.overdueBalance > 0) reasons.push('Account overdue.');
  return { required: reasons.length > 0, reasons };
}
