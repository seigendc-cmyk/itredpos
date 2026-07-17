import type { PosSession } from '../types';
import { readVendorScopedList, writeVendorScopedList } from '../utils/vendorDataMode';
import { createOperationalApproval } from './approvalService';
import type { CanonicalCashSession } from './cashSessionService';
import { recordCashOut } from './cashMovementService';
import { releaseReserveForSupplierPayment, validateCOGSReserveForSupplierPayment } from './cogsReserveService';
import { enqueueOfflineAction, getNetworkStatus } from './offlineSyncService';
import {
  allocateSupplierPayment,
  buildOldestDueSupplierAllocations,
  calculateSupplierLedgerBalance,
  recordSupplierAccountEntry,
  type SupplierPaymentAllocation
} from './supplierAccountService';
import { updateSupplierPaymentScheduleStatus } from './supplierPaymentScheduleService';
import { assertCanonicalSupplierContext, type CanonicalSupplierContext } from './supplierContextService';
import { getSupplierById } from './supplierService';

export const SUPPLIER_PAYMENTS_COLLECTION = 'supplier_payments';
export const BANKBOOK_ENTRIES_COLLECTION = 'bankbook_entries';

export type SupplierCanonicalPaymentMethod = 'Cash' | 'Bank' | 'Mobile Money' | 'Other';
export type SupplierPaymentAllocationMode = 'OldestDueFirst' | 'OldestInvoiceFirst' | 'Manual' | 'SpecificInvoice';
export type SupplierPaymentApprovalStatus = 'NotRequired' | 'PendingApproval' | 'Approved' | 'Rejected';

export interface SupplierCanonicalPayment {
  supplierPaymentId: string;
  vendorId: string;
  supplierId: string;
  branchId: string;
  terminalId: string;
  staffId: string;
  amount: number;
  paymentMethod: SupplierCanonicalPaymentMethod;
  paymentReference: string;
  paymentDate: string;
  allocatedEntries: string[];
  unallocatedAmount: number;
  approvalStatus: SupplierPaymentApprovalStatus;
  createdAt: string;
  scheduleId?: string;
  syncStatus?: 'SavedOffline' | 'WaitingToSynchronize' | 'Synchronized' | 'SynchronizationFailed';
}

export interface SupplierBankbookPaymentEntry {
  bankbookEntryId: string;
  vendorId: string;
  branchId: string;
  businessDate: string;
  bankAccountId: string;
  referenceId: string;
  entryType: 'SupplierPayment';
  amount: number;
  status: 'Pending' | 'Posted' | 'Reconciled';
  notes: string;
  createdAt: string;
  updatedAt: string;
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

function methodFrom(value: string): SupplierCanonicalPaymentMethod {
  if (value === 'Cash') return 'Cash';
  if (['Bank', 'Bank Transfer', 'BankPlaceholder'].includes(value)) return 'Bank';
  if (['Mobile Money', 'EcoCash', 'Innbucks', 'Mukuru', 'ZIPIT', 'MobileMoneyPlaceholder'].includes(value)) return 'Mobile Money';
  return 'Other';
}

function paymentIdFor(input: {
  vendorId: string;
  supplierId: string;
  reference: string;
  amount: number;
  paymentDate: string;
}): string {
  return cleanId(`${input.vendorId}_${input.supplierId}_SUPPLIER_PAYMENT_${input.reference || input.paymentDate}_${input.amount}`);
}

function toCashSession(context: CanonicalSupplierContext): CanonicalCashSession {
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

function readPayments(vendorId: string): SupplierCanonicalPayment[] {
  return readVendorScopedList<SupplierCanonicalPayment>(SUPPLIER_PAYMENTS_COLLECTION, [], vendorId);
}

function writePayments(vendorId: string, rows: SupplierCanonicalPayment[]): SupplierCanonicalPayment[] {
  return writeVendorScopedList(SUPPLIER_PAYMENTS_COLLECTION, rows, vendorId);
}

function recordBankbookSupplierPayment(input: {
  paymentId: string;
  amount: number;
  bankAccountId?: string;
  notes?: string;
}, context: CanonicalSupplierContext): SupplierBankbookPaymentEntry {
  const now = nowIso();
  const entry: SupplierBankbookPaymentEntry = {
    bankbookEntryId: cleanId(`${context.vendorId}_${input.paymentId}_BANKBOOK`),
    vendorId: context.vendorId,
    branchId: context.branchId,
    businessDate: now.slice(0, 10),
    bankAccountId: input.bankAccountId || 'BANK-PLACEHOLDER',
    referenceId: input.paymentId,
    entryType: 'SupplierPayment',
    amount: roundMoney(input.amount),
    status: 'Pending',
    notes: input.notes || 'Supplier bank payment pending bank reconciliation.',
    createdAt: now,
    updatedAt: now
  };
  const rows = readVendorScopedList<SupplierBankbookPaymentEntry>(BANKBOOK_ENTRIES_COLLECTION, [], context.vendorId);
  writeVendorScopedList(BANKBOOK_ENTRIES_COLLECTION, [entry, ...rows.filter((row) => row.bankbookEntryId !== entry.bankbookEntryId)], context.vendorId);
  return entry;
}

async function queueSupplierPayment(payment: SupplierCanonicalPayment, context: CanonicalSupplierContext): Promise<void> {
  const network = await getNetworkStatus().catch(() => 'Unknown');
  await enqueueOfflineAction({
    queueId: cleanId(`supplier_payment_${payment.supplierPaymentId}`),
    vendorId: payment.vendorId,
    branchId: payment.branchId,
    terminalId: payment.terminalId,
    staffId: payment.staffId,
    staffName: context.staffName,
    entityType: 'Payment',
    entityId: payment.supplierPaymentId,
    entityNumber: payment.paymentReference,
    operationType: 'CREATE_SUPPLIER_PAYMENT',
    payload: { payment },
    status: network === 'Offline' || network === 'Unstable' ? 'Queued' : 'Ready To Sync',
    notes: network === 'Offline' || network === 'Unstable' ? 'Saved offline. Waiting to synchronize.' : 'Supplier payment ready to synchronize.'
  }).catch(() => undefined);
}

export function getCanonicalSupplierPayments(vendorId: string, supplierId?: string): SupplierCanonicalPayment[] {
  return readPayments(vendorId).filter((payment) => !supplierId || payment.supplierId === supplierId);
}

export async function recordSupplierPayment(input: {
  supplierId: string;
  amount: number;
  paymentMethod: string;
  paymentReference?: string;
  paymentDate?: string;
  allocationMode?: SupplierPaymentAllocationMode;
  allocations?: Array<{ supplierAccountEntryId: string; amountAllocated: number }>;
  shiftId?: string;
  bankAccountId?: string;
  scheduleId?: string;
  notes?: string;
  approvedBy?: string;
  idempotencyKey?: string;
  allowCashWithoutDrawer?: boolean;
  allowOverpayment?: boolean;
}, session?: PosSession | CanonicalSupplierContext | null): Promise<{ payment: SupplierCanonicalPayment; allocations: SupplierPaymentAllocation[] }> {
  throw new Error('Legacy supplier-payment posting is disabled. Use PurchasingTransactionService.recordSupplierPayment.');
  /* Historical implementation retained for Build 09.1C migration reference only. */
  const context = assertCanonicalSupplierContext(session);
  const amount = roundMoney(input.amount);
  if (amount <= 0) throw new Error('Supplier payment amount must be above zero.');
  const supplier = getSupplierById(input.supplierId, context);
  if (!supplier) throw new Error('Supplier record was not found.');
  if (supplier.vendorId !== context.vendorId) throw new Error('Supplier belongs to another vendor.');
  if (supplier.active === false || supplier.status === 'inactive' || supplier.status === 'suspended') {
    throw new Error('Inactive suppliers cannot receive new payments.');
  }
  const outstanding = calculateSupplierLedgerBalance(context.vendorId, input.supplierId);
  if (amount > outstanding && !input.allowOverpayment) throw new Error('Supplier payment cannot exceed outstanding balance.');

  const paymentDate = input.paymentDate || nowIso();
  const method = methodFrom(input.paymentMethod);
  const supplierPaymentId = cleanId(input.idempotencyKey || paymentIdFor({
    vendorId: context.vendorId,
    supplierId: input.supplierId,
    reference: clean(input.paymentReference),
    amount,
    paymentDate
  }));
  const existing = readPayments(context.vendorId).find((payment) => payment.supplierPaymentId === supplierPaymentId);
  if (existing) return { payment: existing, allocations: [] };

  const reserveValidation = validateCOGSReserveForSupplierPayment(amount);
  const approvalStatus: SupplierPaymentApprovalStatus = input.approvedBy
    ? 'Approved'
    : amount > 1000 || !reserveValidation.allowed || reserveValidation.warnings.length > 0
      ? 'PendingApproval'
      : 'NotRequired';
  if (approvalStatus === 'PendingApproval') {
    await createOperationalApproval({
      vendorId: context.vendorId,
      branchId: context.branchId,
      branch: context.branchId,
      category: 'Supplier Payment',
      requestedBy: context.staffName,
      requestedByRole: normalizeOperationalRole(context.role),
      relatedRecord: supplier.supplierName,
      amountOrValue: amount.toFixed(2),
      risk: amount > 5000 ? 'High' : 'Medium',
      reason: reserveValidation.warnings.join(' ') || 'Supplier payment requires approval.',
      context: input.notes || 'Supplier payment approval request.',
      approvalType: 'SUPPLIER_PAYMENT_APPROVAL',
      requiredPermission: 'approvals.approve'
    });
  }

  if (method === 'Cash') {
    if (!input.shiftId && !input.allowCashWithoutDrawer) throw new Error('No open shift. Please open a shift before recording cash.');
    if (input.shiftId) {
      await recordCashOut({
        shiftId: input.shiftId,
        amount,
        reason: input.notes || `Supplier payment to ${supplier.supplierName}.`,
        referenceId: supplierPaymentId,
        approvedBy: input.approvedBy,
        allowInsufficientDrawerCash: false
      }, toCashSession(context));
    }
  }
  if (method === 'Bank') {
    recordBankbookSupplierPayment({
      paymentId: supplierPaymentId,
      amount,
      bankAccountId: input.bankAccountId,
      notes: input.notes
    }, context);
  }

  const requestedAllocations = input.allocations && input.allocations.length > 0
    ? input.allocations
    : buildOldestDueSupplierAllocations(context.vendorId, input.supplierId, amount);
  const allocatedTotal = roundMoney(requestedAllocations.reduce((sum, allocation) => sum + allocation.amountAllocated, 0));
  if (allocatedTotal > amount) throw new Error('Total allocated cannot exceed supplier payment.');

  const payment: SupplierCanonicalPayment = {
    supplierPaymentId,
    vendorId: context.vendorId,
    supplierId: input.supplierId,
    branchId: context.branchId,
    terminalId: context.terminalId,
    staffId: context.staffId,
    amount,
    paymentMethod: method,
    paymentReference: clean(input.paymentReference) || supplierPaymentId,
    paymentDate,
    allocatedEntries: requestedAllocations.filter((row) => row.amountAllocated > 0).map((row) => row.supplierAccountEntryId),
    unallocatedAmount: roundMoney(amount - allocatedTotal),
    approvalStatus,
    createdAt: nowIso(),
    scheduleId: input.scheduleId,
    syncStatus: 'WaitingToSynchronize'
  };

  const allocations = requestedAllocations.length > 0
    ? allocateSupplierPayment({
      supplierPaymentId,
      supplierId: input.supplierId,
      allocations: requestedAllocations
    }, context)
    : [];
  recordSupplierAccountEntry({
    supplierId: input.supplierId,
    branchId: context.branchId,
    entryType: 'PAYMENT',
    referenceType: 'SUPPLIER_PAYMENT',
    referenceId: supplierPaymentId,
    debit: amount,
    transactionDate: paymentDate,
    description: input.notes || `Supplier payment to ${supplier.supplierName}.`,
    entryId: `${supplierPaymentId}_LEDGER`
  }, context);
  if (method !== 'Cash' || input.approvedBy) {
    await releaseReserveForSupplierPayment({
      amount,
      paymentId: supplierPaymentId,
      paymentNumber: payment.paymentReference,
      supplierId: input.supplierId,
      supplierName: supplier.supplierName,
      staffId: context.staffId,
      staffName: context.staffName
    }).catch(() => undefined);
  }
  writePayments(context.vendorId, [payment, ...readPayments(context.vendorId)]);
  if (input.scheduleId) {
    updateSupplierPaymentScheduleStatus({
      scheduleId: input.scheduleId,
      status: payment.unallocatedAmount > 0 ? 'PartiallyPaid' : 'Paid',
      notes: `Payment ${payment.paymentReference} recorded.`
    }, context);
  }
  await queueSupplierPayment(payment, context);
  return { payment, allocations };
}
import { normalizeOperationalRole } from '../auth/roleNormalization';
