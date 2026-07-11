import { enqueueOfflineAction, getNetworkStatus } from './offlineSyncService';
import { recordCashIn } from './cashMovementService';
import type { CanonicalCashSession } from './cashSessionService';
import { assertCanonicalCustomerContext, type CanonicalCustomerContext } from './customerContextService';
import { applyPaymentToPromises } from './debtCollectionService';
import { getCustomerById } from './customerService';
import {
  allocateCustomerPayment,
  buildOldestDueAllocations,
  recordCustomerAccountEntry,
  type CustomerPaymentAllocation
} from './customerAccountService';
import type { PosSession } from '../types';
import { readVendorScopedList, writeVendorScopedList } from '../utils/vendorDataMode';

export const CUSTOMER_PAYMENTS_COLLECTION = 'customer_payments';

export type CustomerPaymentMethod = 'Cash' | 'Mobile Money' | 'Card' | 'Bank Transfer' | 'Other';
export type CustomerPaymentAllocationMode = 'OldestDueFirst' | 'OldestTransactionFirst' | 'Manual' | 'SpecificInvoice';

export interface CustomerPaymentRecord {
  customerPaymentId: string;
  vendorId: string;
  customerId: string;
  branchId: string;
  terminalId: string;
  staffId: string;
  amount: number;
  paymentMethod: CustomerPaymentMethod;
  reference: string;
  paymentDate: string;
  allocatedEntries: string[];
  unallocatedAmount: number;
  createdAt: string;
  syncStatus?: 'SavedOffline' | 'WaitingToSynchronize' | 'Synchronized' | 'SynchronizationFailed';
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

function methodFrom(value: string): CustomerPaymentMethod {
  if (value === 'Cash') return 'Cash';
  if (['EcoCash', 'Innbucks', 'Mukuru', 'ZIPIT', 'Mobile Money'].includes(value)) return 'Mobile Money';
  if (value === 'Card') return 'Card';
  if (value === 'Bank Transfer') return 'Bank Transfer';
  return 'Other';
}

function paymentIdFor(input: {
  vendorId: string;
  customerId: string;
  reference: string;
  amount: number;
  paymentDate: string;
}): string {
  return cleanId(`${input.vendorId}_${input.customerId}_PAYMENT_${input.reference || input.paymentDate}_${input.amount}`);
}

function toCashSession(context: CanonicalCustomerContext): CanonicalCashSession {
  return {
    vendorId: context.vendorId,
    vendorName: context.vendorId,
    branchId: context.branchId,
    branchName: context.branchId,
    warehouseId: context.warehouseId,
    terminalId: context.terminalId,
    terminalName: context.terminalId,
    staffId: context.staffId,
    staffName: context.staffName,
    role: context.role,
    permissions: context.permissions,
    signedInAt: nowIso()
  };
}

function readPayments(vendorId: string): CustomerPaymentRecord[] {
  return readVendorScopedList<CustomerPaymentRecord>(CUSTOMER_PAYMENTS_COLLECTION, [], vendorId);
}

function writePayments(vendorId: string, rows: CustomerPaymentRecord[]): CustomerPaymentRecord[] {
  return writeVendorScopedList(CUSTOMER_PAYMENTS_COLLECTION, rows, vendorId);
}

async function queuePayment(payment: CustomerPaymentRecord, context: CanonicalCustomerContext): Promise<void> {
  const network = await getNetworkStatus().catch(() => 'Unknown');
  await enqueueOfflineAction({
    queueId: cleanId(`customer_payment_${payment.customerPaymentId}`),
    vendorId: payment.vendorId,
    branchId: payment.branchId,
    terminalId: payment.terminalId,
    staffId: payment.staffId,
    staffName: context.staffName,
    entityType: 'Payment',
    entityId: payment.customerPaymentId,
    entityNumber: payment.reference,
    operationType: 'CREATE_CUSTOMER_PAYMENT',
    payload: { payment },
    status: network === 'Offline' || network === 'Unstable' ? 'Queued' : 'Ready To Sync',
    notes: network === 'Offline' || network === 'Unstable' ? 'Saved offline. Waiting to synchronize.' : 'Customer payment ready to synchronize.'
  }).catch(() => undefined);
}

export function getCustomerPayments(vendorId: string, customerId?: string): CustomerPaymentRecord[] {
  return readPayments(vendorId).filter((row) => !customerId || row.customerId === customerId);
}

export async function recordCustomerPayment(input: {
  customerId: string;
  amount: number;
  paymentMethod: string;
  reference?: string;
  paymentDate?: string;
  allocationMode?: CustomerPaymentAllocationMode;
  allocations?: Array<{ accountEntryId: string; amountAllocated: number }>;
  shiftId?: string;
  notes?: string;
  idempotencyKey?: string;
  allowCashWithoutDrawer?: boolean;
}, session?: PosSession | CanonicalCustomerContext | null): Promise<{ payment: CustomerPaymentRecord; allocations: CustomerPaymentAllocation[] }> {
  const context = assertCanonicalCustomerContext(session);
  const amount = roundMoney(input.amount);
  if (amount <= 0) throw new Error('Payment amount must be above zero.');
  if (!clean(input.customerId)) throw new Error('Customer payment requires a customer.');
  const customer = await getCustomerById(input.customerId, context);
  if (!customer) throw new Error('Customer record was not found.');
  if (customer.vendorId !== context.vendorId) throw new Error('Customer belongs to another vendor.');
  if (customer.status !== 'Active') throw new Error('Inactive customers cannot transact unless reactivated.');
  const paymentDate = input.paymentDate || nowIso();
  const method = methodFrom(input.paymentMethod);
  const customerPaymentId = cleanId(input.idempotencyKey || paymentIdFor({
    vendorId: context.vendorId,
    customerId: input.customerId,
    reference: clean(input.reference),
    amount,
    paymentDate
  }));
  const existing = readPayments(context.vendorId).find((payment) => payment.customerPaymentId === customerPaymentId);
  if (existing) {
    return {
      payment: existing,
      allocations: []
    };
  }

  if (method === 'Cash') {
    if (!input.shiftId && !input.allowCashWithoutDrawer) {
      throw new Error('No open shift. Please open a shift before recording cash.');
    }
    if (input.shiftId) {
      await recordCashIn({
        shiftId: input.shiftId,
        amount,
        reason: input.notes || 'Customer account payment received.',
        referenceId: customerPaymentId
      }, toCashSession(context));
    }
  }

  const requestedAllocations = input.allocations && input.allocations.length > 0
    ? input.allocations
    : buildOldestDueAllocations(context.vendorId, input.customerId, amount);
  const allocatedTotal = roundMoney(requestedAllocations.reduce((sum, allocation) => sum + allocation.amountAllocated, 0));
  if (allocatedTotal > amount) throw new Error('Total allocated cannot exceed payment.');

  const payment: CustomerPaymentRecord = {
    customerPaymentId,
    vendorId: context.vendorId,
    customerId: input.customerId,
    branchId: context.branchId,
    terminalId: context.terminalId,
    staffId: context.staffId,
    amount,
    paymentMethod: method,
    reference: clean(input.reference) || customerPaymentId,
    paymentDate,
    allocatedEntries: requestedAllocations.filter((row) => row.amountAllocated > 0).map((row) => row.accountEntryId),
    unallocatedAmount: roundMoney(amount - allocatedTotal),
    createdAt: nowIso(),
    syncStatus: 'WaitingToSynchronize'
  };

  const allocations = requestedAllocations.length > 0
    ? allocateCustomerPayment({
      customerPaymentId,
      customerId: input.customerId,
      allocations: requestedAllocations
    }, context)
    : [];
  recordCustomerAccountEntry({
    customerId: input.customerId,
    entryType: 'PAYMENT',
    referenceType: 'CUSTOMER_PAYMENT',
    referenceId: customerPaymentId,
    credit: amount,
    transactionDate: paymentDate,
    description: input.notes || 'Customer account payment received.',
    idempotencyKey: `${customerPaymentId}_LEDGER`
  }, context);
  writePayments(context.vendorId, [payment, ...readPayments(context.vendorId)]);
  applyPaymentToPromises({
    customerId: input.customerId,
    amount,
    paymentDate
  }, context);
  await queuePayment(payment, context);
  return { payment, allocations };
}
