import type {
  CreditorAgeingBucket,
  CreditorRiskItem,
  RiskLevel,
  SupplierBill,
  SupplierBillStatus,
  SupplierCreditProfile,
  SupplierPayment,
  SupplierPaymentAllocation,
  SupplierPaymentAllocationMethod,
  SupplierStatementRecord
} from '../types';
import { createOperationalApproval } from './approvalService';
import { createAccountingPostingPlaceholder } from './accountingService';
import { createBIAdviceFromTrigger } from './biAdviceService';
import { releaseReserveForSupplierPayment, validateCOGSReserveForSupplierPayment } from './cogsReserveService';
import { recordSupplierPaymentCashImpact } from './cashControlService';
import { getActiveVendorId, readVendorScopedList, writeVendorScopedList } from '../utils/vendorDataMode';
import { recordSupplierAccountPayment, recordSupplierAccountPurchase } from './supplierAccountService';

const PROFILE_KEY = 'itred_pos_supplier_credit_profiles_v1';
const BILL_KEY = 'itred_pos_supplier_bills_v1';
const PAYMENT_KEY = 'itred_pos_supplier_payments_v1';
const ALLOCATION_KEY = 'itred_pos_supplier_payment_allocations_v1';
const STATEMENT_KEY = 'itred_pos_supplier_statements_v1';

function nowIso(): string {
  return new Date().toISOString();
}

function today(): string {
  return nowIso().slice(0, 10);
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function addDays(date: string, days: number): string {
  const next = new Date(`${date}T12:00:00`);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

function readList<T>(key: string, fallback: T[] = []): T[] {
  return readVendorScopedList<T>(key, fallback);
}

function saveList<T>(key: string, value: T[]): T[] {
  return writeVendorScopedList(key, value);
}

const seedProfiles: SupplierCreditProfile[] = [
  { supplierId: 'SUP-LD', supplierName: 'Local Distributors', supplierCode: 'LD-001', creditStatus: 'CreditAllowed', paymentTermsDays: 30, supplierCreditLimit: 6500, currentPayableBalance: 1240, overduePayableBalance: 420, availableSupplierCredit: 5260, averageDaysToPay: 26, latePaymentCount: 1, disputedAmount: 0, preferredSupplier: true, lastPaymentDate: '2026-06-08', nextReviewDate: '2026-07-14', notes: 'Supplier credit profile.', updatedAt: nowIso() },
  { supplierId: 'SUP-MOTOR', supplierName: 'Motor Parts Wholesale', supplierCode: 'MPW-002', creditStatus: 'ManagerApprovalRequired', paymentTermsDays: 14, supplierCreditLimit: 3000, currentPayableBalance: 2680, overduePayableBalance: 1180, availableSupplierCredit: 320, averageDaysToPay: 38, latePaymentCount: 4, disputedAmount: 220, preferredSupplier: false, blockedReason: 'Near limit and overdue invoices.', nextReviewDate: '2026-06-20', notes: 'High-risk creditor example.', updatedAt: nowIso() }
];

const seedBills: SupplierBill[] = [
  { billId: 'SUP-BILL-DEV-001', billNumber: 'SB-0001', supplierId: 'SUP-LD', supplierName: 'Local Distributors', supplierInvoiceNumber: 'LD-INV-789', purchaseOrderId: 'PO-ID-0003', purchaseOrderNumber: 'PO-0003', grnId: 'GRN-ID-0001', grnNumber: 'GRN-0001', billDate: today(), dueDate: addDays(today(), 30), originalAmount: 820, paidAmount: 250, outstandingAmount: 570, vatAmount: 106.96, currency: 'USD', status: 'PartiallyPaid', ageingBucket: 'Current', overdueDays: 0, branchId: 'BR-HARARE', warehouseId: 'WH-HARARE-01', createdBy: 'Manager', createdAt: nowIso(), postedAt: nowIso(), notes: 'Part-paid supplier bill.' },
  { billId: 'SUP-BILL-DEV-002', billNumber: 'SB-0002', supplierId: 'SUP-MOTOR', supplierName: 'Motor Parts Wholesale', supplierInvoiceNumber: 'MPW-INV-448', purchaseOrderId: 'PO-ID-0001', purchaseOrderNumber: 'PO-0001', grnId: 'GRN-ID-0002', grnNumber: 'GRN-0002', billDate: '2026-04-28', dueDate: '2026-05-12', originalAmount: 1180, paidAmount: 0, outstandingAmount: 1180, vatAmount: 153.91, currency: 'USD', status: 'Overdue', ageingBucket: 'Days31To60', overdueDays: 33, branchId: 'BR-HARARE', warehouseId: 'WH-HARARE-01', createdBy: 'Manager', createdAt: nowIso(), postedAt: nowIso(), notes: 'Overdue supplier bill.' }
];

const seedPayments: SupplierPayment[] = [
  { paymentId: 'SUP-PAY-DEV-001', paymentNumber: 'SP-0001', supplierId: 'SUP-LD', supplierName: 'Local Distributors', paymentDate: today(), amount: 250, paymentMethod: 'Cash', paymentReference: 'DRAWER-SP-0001', source: 'COGSReserve', cogsReserveAmount: 250, nonReserveAmount: 0, status: 'Paid', approvedBy: 'Owner', approvedAt: nowIso(), paidBy: 'Accountant', paidAt: nowIso(), notes: 'Supplier payment from COGS Reserve.' }
];

function nextNumber<T, K extends keyof T>(prefix: string, rows: readonly T[], key: K): string {
  const highest = rows.reduce((max, row) => {
    const match = String(row[key] || '').match(new RegExp(`${prefix}-(\\d+)`));
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `${prefix}-${String(highest + 1).padStart(4, '0')}`;
}

async function createCreditorApproval(input: {
  approvalType: string;
  relatedRecord: string;
  requestedBy: string;
  reason: string;
  amountOrValue?: string;
  risk?: RiskLevel;
  context?: string;
}) {
  return createOperationalApproval({
    vendorId: getActiveVendorId(),
    branchId: 'main-branch',
    branch: 'Main Branch',
    category: 'Purchase Order',
    requestedBy: input.requestedBy,
    requestedByRole: 'Manager',
    relatedRecord: input.relatedRecord,
    amountOrValue: input.amountOrValue || 'Review',
    risk: input.risk || 'High',
    reason: input.reason,
    context: input.context || 'Creditors approval review.',
    approvalType: input.approvalType,
    requiredPermission: 'approvals.approve'
  });
}

export function calculateSupplierBillAgeing(bill: Pick<SupplierBill, 'dueDate'>): { overdueDays: number; ageingBucket: CreditorAgeingBucket } {
  const diff = Math.floor((new Date(`${today()}T12:00:00`).getTime() - new Date(`${bill.dueDate}T12:00:00`).getTime()) / 86400000);
  const overdueDays = Math.max(0, diff);
  if (overdueDays === 0) return { overdueDays, ageingBucket: 'Current' };
  if (overdueDays <= 30) return { overdueDays, ageingBucket: 'Days1To30' };
  if (overdueDays <= 60) return { overdueDays, ageingBucket: 'Days31To60' };
  if (overdueDays <= 90) return { overdueDays, ageingBucket: 'Days61To90' };
  if (overdueDays <= 120) return { overdueDays, ageingBucket: 'Days91To120' };
  return { overdueDays, ageingBucket: 'Days120Plus' };
}

function refreshProfiles(): SupplierCreditProfile[] {
  const profiles = readList<SupplierCreditProfile>(PROFILE_KEY, seedProfiles);
  const bills = getSupplierBills();
  const payments = getSupplierPayments();
  const next = profiles.map((profile) => {
    const supplierBills = bills.filter((bill) => bill.supplierId === profile.supplierId && !['Cancelled', 'Reversed'].includes(bill.status));
    const currentPayableBalance = supplierBills.reduce((sum, bill) => sum + bill.outstandingAmount, 0);
    const overduePayableBalance = supplierBills.filter((bill) => bill.overdueDays > 0).reduce((sum, bill) => sum + bill.outstandingAmount, 0);
    const disputedAmount = supplierBills.filter((bill) => bill.status === 'Disputed').reduce((sum, bill) => sum + bill.outstandingAmount, 0);
    const lastPaymentDate = payments.filter((payment) => payment.supplierId === profile.supplierId && payment.status === 'Paid').sort((a, b) => b.paymentDate.localeCompare(a.paymentDate))[0]?.paymentDate || profile.lastPaymentDate;
    return {
      ...profile,
      currentPayableBalance,
      overduePayableBalance,
      disputedAmount,
      availableSupplierCredit: Math.max(0, profile.supplierCreditLimit - currentPayableBalance),
      lastPaymentDate,
      updatedAt: nowIso()
    };
  });
  return saveList(PROFILE_KEY, next);
}

export function getSupplierCreditProfiles(filters: Partial<{ search: string; status: string }> = {}): SupplierCreditProfile[] {
  return refreshProfiles().filter((profile) => {
    const haystack = `${profile.supplierName} ${profile.supplierCode} ${profile.creditStatus}`.toLowerCase();
    const words = (filters.search || '').toLowerCase().split(/\s+/).filter(Boolean);
    return words.every((word) => haystack.includes(word)) && (!filters.status || filters.status === 'ALL' || profile.creditStatus === filters.status);
  });
}

export function getSupplierCreditProfile(supplierId: string): SupplierCreditProfile | null {
  return getSupplierCreditProfiles().find((profile) => profile.supplierId === supplierId) || null;
}

export function updateSupplierCreditProfile(supplierId: string, patch: Partial<SupplierCreditProfile>): SupplierCreditProfile | null {
  const profiles = readList<SupplierCreditProfile>(PROFILE_KEY, seedProfiles);
  let updated: SupplierCreditProfile | null = null;
  saveList(PROFILE_KEY, profiles.map((profile) => {
    if (profile.supplierId !== supplierId) return profile;
    updated = { ...profile, ...patch, updatedAt: nowIso() };
    return updated;
  }));
  return updated;
}

export function ensureSupplierCreditProfileFromSupplier(payload: {
  supplierId: string;
  supplierName: string;
  supplierCode: string;
  creditStatus?: SupplierCreditProfile['creditStatus'];
  paymentTermsDays?: number;
  supplierCreditLimit?: number;
  preferredSupplier?: boolean;
  notes?: string;
}): SupplierCreditProfile {
  const profiles = readList<SupplierCreditProfile>(PROFILE_KEY, seedProfiles);
  const existing = profiles.find((profile) => profile.supplierId === payload.supplierId);
  if (existing) return existing;
  const profile: SupplierCreditProfile = {
    supplierId: payload.supplierId,
    supplierName: payload.supplierName,
    supplierCode: payload.supplierCode,
    creditStatus: payload.creditStatus || 'UnderReview',
    paymentTermsDays: payload.paymentTermsDays ?? 30,
    supplierCreditLimit: payload.supplierCreditLimit ?? 0,
    currentPayableBalance: 0,
    overduePayableBalance: 0,
    availableSupplierCredit: payload.supplierCreditLimit ?? 0,
    averageDaysToPay: 0,
    latePaymentCount: 0,
    disputedAmount: 0,
    preferredSupplier: payload.preferredSupplier ?? false,
    nextReviewDate: addDays(today(), 14),
    notes: payload.notes || 'Local/mock supplier credit profile created from Purchase Order supplier record.',
    updatedAt: nowIso()
  };
  saveList(PROFILE_KEY, [profile, ...profiles]);
  return profile;
}

export async function blockSupplierCredit(supplierId: string, reason: string, staffId: string): Promise<SupplierCreditProfile | null> {
  await createCreditorApproval({ approvalType: 'SUPPLIER_CREDIT_BLOCK_RELEASE', relatedRecord: supplierId, requestedBy: staffId, reason, context: 'Block supplier credit request.' });
  return updateSupplierCreditProfile(supplierId, { creditStatus: 'CreditBlocked', blockedReason: reason });
}

export async function releaseSupplierCredit(supplierId: string, reason: string, staffId: string): Promise<SupplierCreditProfile | null> {
  await createCreditorApproval({ approvalType: 'SUPPLIER_CREDIT_BLOCK_RELEASE', relatedRecord: supplierId, requestedBy: staffId, reason, context: 'Release supplier credit request.' });
  return updateSupplierCreditProfile(supplierId, { creditStatus: 'CreditAllowed', blockedReason: '' });
}

export function getSupplierBills(filters: Partial<{ search: string; supplierId: string; status: SupplierBillStatus | 'ALL'; ageingBucket: CreditorAgeingBucket | 'ALL' }> = {}): SupplierBill[] {
  const profileCodes = new Map(readList<SupplierCreditProfile>(PROFILE_KEY, seedProfiles).map((profile) => [profile.supplierId, profile.supplierCode]));
  return readList<SupplierBill>(BILL_KEY, seedBills).map((bill) => {
    const ageing = calculateSupplierBillAgeing(bill);
    const status = bill.status === 'Posted' && ageing.overdueDays > 0 && bill.outstandingAmount > 0 ? 'Overdue' : bill.status;
    return { ...bill, ...ageing, status };
  }).filter((bill) => {
    const supplierCode = profileCodes.get(bill.supplierId) || '';
    const haystack = `${bill.supplierName} ${supplierCode} ${bill.billNumber} ${bill.supplierInvoiceNumber} ${bill.grnNumber || ''} ${bill.purchaseOrderNumber || ''} ${bill.status} ${bill.ageingBucket} ${bill.notes}`.toLowerCase();
    const words = (filters.search || '').toLowerCase().split(/\s+/).filter(Boolean);
    return words.every((word) => haystack.includes(word))
      && (!filters.supplierId || bill.supplierId === filters.supplierId)
      && (!filters.status || filters.status === 'ALL' || bill.status === filters.status)
      && (!filters.ageingBucket || filters.ageingBucket === 'ALL' || bill.ageingBucket === filters.ageingBucket);
  }).sort((a, b) => b.billDate.localeCompare(a.billDate));
}

export async function createManualSupplierBill(payload: Omit<SupplierBill, 'billId' | 'billNumber' | 'createdAt' | 'ageingBucket' | 'overdueDays' | 'paidAmount' | 'outstandingAmount' | 'status'> & Partial<Pick<SupplierBill, 'billId' | 'billNumber' | 'paidAmount' | 'status'>>): Promise<SupplierBill> {
  const bills = getSupplierBills();
  if (payload.grnId) {
    const existing = bills.find((bill) => bill.grnId === payload.grnId && bill.status !== 'Reversed' && bill.status !== 'Cancelled');
    if (existing) return existing;
  }
  const duplicateInvoice = bills.find((bill) =>
    bill.supplierId === payload.supplierId
    && bill.supplierInvoiceNumber.trim().toLowerCase() === payload.supplierInvoiceNumber.trim().toLowerCase()
    && bill.status !== 'Reversed'
    && bill.status !== 'Cancelled'
  );
  if (duplicateInvoice) throw new Error(`Duplicate supplier invoice detected: ${payload.supplierInvoiceNumber}.`);
  const paidAmount = Math.max(0, payload.paidAmount || 0);
  const ageing = calculateSupplierBillAgeing({ dueDate: payload.dueDate });
  const bill: SupplierBill = {
    ...payload,
    billId: payload.billId || makeId('SUP-BILL'),
    billNumber: payload.billNumber || nextNumber('SB', bills, 'billNumber'),
    paidAmount,
    outstandingAmount: Math.max(0, payload.originalAmount - paidAmount),
    status: payload.status || 'Draft',
    ageingBucket: ageing.ageingBucket,
    overdueDays: ageing.overdueDays,
    createdAt: nowIso()
  };
  saveList(BILL_KEY, [bill, ...bills]);
  await createAccountingPostingPlaceholder({ source: 'Manual Placeholder', sourceReference: bill.billNumber, branch: bill.branchId, amount: bill.originalAmount });
  return bill;
}

export async function createSupplierBillFromGRN(payload: { supplierId: string; supplierName: string; supplierInvoiceNumber?: string; grnId: string; grnNumber: string; purchaseOrderId?: string; purchaseOrderNumber?: string; grnDate: string; amount: number; vatAmount?: number; branchId: string; warehouseId?: string; createdBy: string; paymentTermsDays?: number; acquisitionType?: 'Paid Cash' | 'Supplier Credit' | 'Part Paid + Supplier Credit' | 'Already Invoiced' | 'Invoice Pending'; paidAmount?: number; }): Promise<SupplierBill> {
  const existing = getSupplierBills().find((bill) => bill.grnId === payload.grnId && bill.status !== 'Reversed' && bill.status !== 'Cancelled');
  if (existing && payload.acquisitionType !== 'Invoice Pending') return existing;
  if (payload.acquisitionType === 'Invoice Pending') {
    await createBIAdviceFromTrigger({ id: payload.grnId, eventType: 'GRN_WITHOUT_SUPPLIER_INVOICE', domain: 'Supplier / Purchase Discipline', severity: 'Medium', description: `${payload.grnNumber} received stock but supplier invoice is pending.`, recommendedAction: 'Follow up supplier invoice before period close.' });
  }
  const terms = payload.paymentTermsDays ?? getSupplierCreditProfile(payload.supplierId)?.paymentTermsDays ?? 30;
  const paidAmount = Math.min(Math.max(0, payload.paidAmount || 0), Math.max(0, payload.amount));
  const bill = await createManualSupplierBill({ supplierId: payload.supplierId, supplierName: payload.supplierName, supplierInvoiceNumber: payload.supplierInvoiceNumber || `PENDING-${payload.grnNumber}`, purchaseOrderId: payload.purchaseOrderId, purchaseOrderNumber: payload.purchaseOrderNumber, grnId: payload.grnId, grnNumber: payload.grnNumber, billDate: payload.grnDate, dueDate: addDays(payload.grnDate, terms), originalAmount: payload.amount, paidAmount, vatAmount: payload.vatAmount, currency: 'USD', branchId: payload.branchId, warehouseId: payload.warehouseId, createdBy: payload.createdBy, notes: `Created from GRN using ${payload.acquisitionType || 'Supplier Credit'} local/mock flow.`, status: paidAmount >= payload.amount ? 'Paid' : paidAmount > 0 ? 'PartiallyPaid' : 'Posted' });
  return postSupplierBill(bill.billId) as Promise<SupplierBill>;
}

export async function postSupplierBill(billId: string): Promise<SupplierBill | null> {
  const bills = getSupplierBills();
  let updated: SupplierBill | null = null;
  saveList(BILL_KEY, bills.map((bill) => {
    if (bill.billId !== billId) return bill;
    updated = { ...bill, status: bill.outstandingAmount <= 0 ? 'Paid' : bill.paidAmount > 0 ? 'PartiallyPaid' : 'Posted', postedAt: nowIso() };
    return updated;
  }));
  if (updated) {
    refreshProfiles();
    await createAccountingPostingPlaceholder({ source: 'Manual Placeholder', sourceReference: updated.billNumber, branch: updated.branchId, amount: updated.originalAmount });
    recordSupplierAccountPurchase({
      vendorId: getActiveVendorId(),
      supplierId: updated.supplierId,
      referenceType: 'SUPPLIER_BILL',
      referenceId: updated.billId,
      amount: updated.originalAmount,
      dueDate: updated.dueDate,
      createdBy: updated.createdBy,
      createdAt: updated.postedAt || nowIso(),
      branchId: updated.branchId,
      supplierInvoiceNumber: updated.supplierInvoiceNumber,
      purchaseOrderId: updated.purchaseOrderId,
      goodsReceiptId: updated.grnId,
      notes: `Supplier bill ${updated.billNumber} posted.`
    });
  }
  return updated;
}

export async function disputeSupplierBill(billId: string, reason: string, staffId: string): Promise<SupplierBill | null> {
  let updated: SupplierBill | null = null;
  saveList(BILL_KEY, getSupplierBills().map((bill) => bill.billId === billId ? (updated = { ...bill, status: 'Disputed', notes: `${bill.notes} Disputed by ${staffId}: ${reason}` }) : bill));
  return updated;
}

export async function reverseSupplierBill(billId: string, reason: string, staffId: string): Promise<SupplierBill | null> {
  await createCreditorApproval({ approvalType: 'SUPPLIER_BILL_REVERSAL', relatedRecord: billId, requestedBy: staffId, reason, context: 'Reverse supplier bill request.' });
  let updated: SupplierBill | null = null;
  saveList(BILL_KEY, getSupplierBills().map((bill) => bill.billId === billId ? (updated = { ...bill, status: 'Reversed', outstandingAmount: 0, notes: `${bill.notes} Reversal requested: ${reason}` }) : bill));
  refreshProfiles();
  return updated;
}

export function getSupplierPayments(filters: Partial<{ supplierId: string; status: string }> = {}): SupplierPayment[] {
  return readList<SupplierPayment>(PAYMENT_KEY, seedPayments).filter((payment) => (!filters.supplierId || payment.supplierId === filters.supplierId) && (!filters.status || filters.status === 'ALL' || payment.status === filters.status)).sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
}

export async function createSupplierPayment(payload: Omit<SupplierPayment, 'paymentId' | 'paymentNumber' | 'status'> & Partial<Pick<SupplierPayment, 'paymentId' | 'paymentNumber' | 'status'>>): Promise<SupplierPayment> {
  if (payload.amount <= 0) throw new Error('Supplier payment amount must be greater than zero.');
  const outstanding = getSupplierBills({ supplierId: payload.supplierId }).filter((bill) => bill.outstandingAmount > 0 && !['Cancelled', 'Reversed'].includes(bill.status)).reduce((sum, bill) => sum + bill.outstandingAmount, 0);
  if (payload.amount > outstanding && !payload.notes.toLowerCase().includes('advance')) throw new Error('Supplier payment cannot exceed outstanding unless supplier advance placeholder is explicit.');
  if (payload.source === 'Mixed' && Number((payload.cogsReserveAmount + payload.nonReserveAmount).toFixed(2)) !== Number(payload.amount.toFixed(2))) throw new Error('Mixed supplier payment must split exactly between reserve and non-reserve amounts.');
  const payments = getSupplierPayments();
  const reserveValidation = payload.cogsReserveAmount > 0 ? validateCOGSReserveForSupplierPayment(payload.cogsReserveAmount) : { allowed: true, warnings: [] };
  if (payload.amount > 1000 || reserveValidation.warnings.length > 0) {
    await createCreditorApproval({ approvalType: reserveValidation.warnings.length ? 'SUPPLIER_PAYMENT_RESERVE_OVERRIDE' : 'SUPPLIER_PAYMENT_APPROVAL', relatedRecord: payload.supplierId, requestedBy: payload.paidBy || payload.approvedBy || 'System', reason: reserveValidation.warnings.join(' ') || 'Supplier payment above local threshold.', amountOrValue: String(payload.amount), context: 'Supplier payment approval placeholder.' });
  }
  const payment: SupplierPayment = { ...payload, paymentId: payload.paymentId || makeId('SUP-PAY'), paymentNumber: payload.paymentNumber || nextNumber('SP', payments, 'paymentNumber'), status: payload.status || 'PendingApproval' };
  saveList(PAYMENT_KEY, [payment, ...payments]);
  return payment;
}

export async function approveSupplierPayment(paymentId: string, staffId: string, note: string): Promise<SupplierPayment | null> {
  let updated: SupplierPayment | null = null;
  saveList(PAYMENT_KEY, getSupplierPayments().map((payment) => payment.paymentId === paymentId ? (updated = { ...payment, status: 'Approved', approvedBy: staffId, approvedAt: nowIso(), notes: `${payment.notes} ${note}` }) : payment));
  return updated;
}

export async function rejectSupplierPayment(paymentId: string, reason: string, staffId: string): Promise<SupplierPayment | null> {
  let updated: SupplierPayment | null = null;
  saveList(PAYMENT_KEY, getSupplierPayments().map((payment) => payment.paymentId === paymentId ? (updated = { ...payment, status: 'Rejected', approvedBy: staffId, approvedAt: nowIso(), notes: `${payment.notes} Rejected: ${reason}` }) : payment));
  return updated;
}

export function previewSupplierPaymentAllocation(supplierId: string, amount: number, method: SupplierPaymentAllocationMethod, selectedBillId?: string): Array<{ billId: string; billNumber: string; outstandingBefore: number; allocatedAmount: number; outstandingAfter: number }> {
  let remaining = Math.max(0, amount);
  let bills = getSupplierBills({ supplierId }).filter((bill) => bill.outstandingAmount > 0 && !['Cancelled', 'Reversed'].includes(bill.status));
  if (method === 'SelectedBillOnly' && selectedBillId) bills = bills.filter((bill) => bill.billId === selectedBillId);
  if (method === 'OldestBillFirst') bills = bills.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  if (method === 'HighestOverdueFirst') bills = bills.sort((a, b) => b.overdueDays - a.overdueDays);
  return bills.map((bill) => {
    const allocatedAmount = Math.min(remaining, bill.outstandingAmount);
    remaining -= allocatedAmount;
    return { billId: bill.billId, billNumber: bill.billNumber, outstandingBefore: bill.outstandingAmount, allocatedAmount, outstandingAfter: Number((bill.outstandingAmount - allocatedAmount).toFixed(2)) };
  }).filter((row) => row.allocatedAmount > 0);
}

export async function allocateSupplierPayment(paymentId: string, allocationMethod: SupplierPaymentAllocationMethod, allocations: Array<{ supplierId: string; billId: string; billNumber: string; allocatedAmount: number; allocatedBy: string; notes?: string }>): Promise<SupplierPaymentAllocation[]> {
  const payment = getSupplierPayments().find((row) => row.paymentId === paymentId);
  if (!payment) return [];
  const totalAllocated = Number(allocations.reduce((sum, allocation) => sum + allocation.allocatedAmount, 0).toFixed(2));
  if (totalAllocated > payment.amount) throw new Error('Allocated amount cannot exceed supplier payment amount.');
  const billMap = new Map(getSupplierBills().map((bill) => [bill.billId, bill]));
  allocations.forEach((allocation) => {
    const bill = billMap.get(allocation.billId);
    if (!bill || ['Paid', 'Cancelled', 'Reversed'].includes(bill.status)) throw new Error('Cannot allocate payment to paid, cancelled or reversed supplier bill.');
    if (allocation.allocatedAmount < 0 || allocation.allocatedAmount > bill.outstandingAmount) throw new Error('Supplier payment allocation is invalid for bill outstanding amount.');
  });
  const created = allocations.map((allocation) => ({ ...allocation, allocationId: makeId('SUP-ALLOC'), paymentId, allocationMethod, allocatedAt: nowIso(), notes: allocation.notes || `${allocationMethod} allocation.` }));
  saveList(ALLOCATION_KEY, [...created, ...readList<SupplierPaymentAllocation>(ALLOCATION_KEY)]);
  const byBill = new Map(created.map((allocation) => [allocation.billId, allocation.allocatedAmount]));
  saveList(BILL_KEY, getSupplierBills().map((bill) => {
    const paid = byBill.get(bill.billId) || 0;
    if (paid <= 0) return bill;
    const paidAmount = Number((bill.paidAmount + paid).toFixed(2));
    const outstandingAmount = Math.max(0, Number((bill.outstandingAmount - paid).toFixed(2)));
    return { ...bill, paidAmount, outstandingAmount, status: outstandingAmount <= 0 ? 'Paid' : 'PartiallyPaid' };
  }));
  refreshProfiles();
  return created;
}

export async function markSupplierPaymentPaid(paymentId: string, staffId: string): Promise<SupplierPayment | null> {
  let updated: SupplierPayment | null = null;
  saveList(PAYMENT_KEY, getSupplierPayments().map((payment) => payment.paymentId === paymentId ? (updated = { ...payment, status: 'Paid', paidBy: staffId, paidAt: nowIso() }) : payment));
  if (updated) {
    const preview = previewSupplierPaymentAllocation(updated.supplierId, updated.amount, 'OldestBillFirst');
    await allocateSupplierPayment(updated.paymentId, 'OldestBillFirst', preview.map((row) => ({ supplierId: updated!.supplierId, billId: row.billId, billNumber: row.billNumber, allocatedAmount: row.allocatedAmount, allocatedBy: staffId })));
    if (updated.cogsReserveAmount > 0) await releaseReserveForSupplierPayment({ amount: updated.cogsReserveAmount, paymentId: updated.paymentId, paymentNumber: updated.paymentNumber, supplierId: updated.supplierId, supplierName: updated.supplierName, staffId, staffName: staffId });
    if (updated.source === 'CashDrawer' || (updated.source === 'Mixed' && updated.nonReserveAmount > 0 && updated.paymentMethod.toLowerCase().includes('cash'))) {
      await recordSupplierPaymentCashImpact({ staffId, staffName: staffId, amount: updated.source === 'CashDrawer' ? updated.amount : updated.nonReserveAmount, paymentId: updated.paymentId, paymentNumber: updated.paymentNumber, supplierId: updated.supplierId, supplierName: updated.supplierName });
    }
    await createAccountingPostingPlaceholder({ source: 'Manual Placeholder', sourceReference: updated.paymentNumber, branch: 'Local Branch', amount: updated.amount });
    recordSupplierAccountPayment({
      vendorId: getActiveVendorId(),
      supplierId: updated.supplierId,
      referenceType: 'SUPPLIER_PAYMENT',
      referenceId: updated.paymentId,
      amount: updated.amount,
      createdBy: staffId,
      createdAt: updated.paidAt || nowIso(),
      notes: `Supplier payment ${updated.paymentNumber} posted.`
    });
  }
  return updated;
}

export function getSupplierPaymentAllocations(paymentId?: string): SupplierPaymentAllocation[] {
  return readList<SupplierPaymentAllocation>(ALLOCATION_KEY).filter((allocation) => !paymentId || allocation.paymentId === paymentId);
}

export function getCreditorAgeingSummary() {
  const bills = getSupplierBills().filter((bill) => bill.outstandingAmount > 0 && !['Cancelled', 'Reversed'].includes(bill.status));
  const bucket = (name: CreditorAgeingBucket) => bills.filter((bill) => bill.ageingBucket === name).reduce((sum, bill) => sum + bill.outstandingAmount, 0);
  return {
    totalPayables: bills.reduce((sum, bill) => sum + bill.outstandingAmount, 0),
    current: bucket('Current'),
    days1To30: bucket('Days1To30'),
    days31To60: bucket('Days31To60'),
    days61To90: bucket('Days61To90'),
    days91To120: bucket('Days91To120'),
    days120Plus: bucket('Days120Plus'),
    suppliersDueToday: new Set(bills.filter((bill) => bill.dueDate === today()).map((bill) => bill.supplierId)).size,
    overdueSuppliers: new Set(bills.filter((bill) => bill.overdueDays > 0).map((bill) => bill.supplierId)).size,
    disputedBills: bills.filter((bill) => bill.status === 'Disputed').length
  };
}

export function calculateSupplierRiskItem(supplierId: string): CreditorRiskItem | null {
  const profile = getSupplierCreditProfile(supplierId);
  if (!profile) return null;
  const bills = getSupplierBills({ supplierId });
  const worst = bills.sort((a, b) => b.overdueDays - a.overdueDays)[0];
  const usage = profile.supplierCreditLimit > 0 ? Math.round((profile.currentPayableBalance / profile.supplierCreditLimit) * 100) : 0;
  const daysSinceLastPayment = profile.lastPaymentDate ? Math.max(0, Math.floor((new Date(`${today()}T12:00:00`).getTime() - new Date(`${profile.lastPaymentDate}T12:00:00`).getTime()) / 86400000)) : 999;
  const riskLevel: RiskLevel = profile.overduePayableBalance > 1000 || usage >= 95 ? 'Critical' : profile.overduePayableBalance > 0 || usage >= 80 ? 'High' : usage >= 60 ? 'Medium' : 'Low';
  return { supplierId, supplierName: profile.supplierName, outstandingAmount: profile.currentPayableBalance, overdueAmount: profile.overduePayableBalance, ageingBucket: worst?.ageingBucket || 'Current', supplierCreditLimitUsagePercent: usage, daysSinceLastPayment, disputedAmount: profile.disputedAmount, riskLevel, recommendedAction: riskLevel === 'Critical' ? 'Pause non-critical supplier commitments and escalate to Owner.' : riskLevel === 'High' ? 'Plan payment allocation and negotiate supplier terms.' : 'Monitor within normal creditor cycle.' };
}

export function getCreditorRiskHeatMap(filters: Partial<{ search: string }> = {}): CreditorRiskItem[] {
  return getSupplierCreditProfiles({ search: filters.search }).map((profile) => calculateSupplierRiskItem(profile.supplierId)).filter(Boolean) as CreditorRiskItem[];
}

export async function generateSupplierStatement(supplierId: string, periodFrom: string, periodTo: string, generatedBy = 'System'): Promise<SupplierStatementRecord | null> {
  const profile = getSupplierCreditProfile(supplierId);
  if (!profile) return null;
  const bills = getSupplierBills({ supplierId }).filter((bill) => bill.billDate >= periodFrom && bill.billDate <= periodTo);
  const payments = getSupplierPayments({ supplierId }).filter((payment) => payment.paymentDate >= periodFrom && payment.paymentDate <= periodTo);
  const statement: SupplierStatementRecord = {
    statementId: makeId('SUP-STMT'),
    supplierId,
    supplierName: profile.supplierName,
    periodFrom,
    periodTo,
    openingBalance: 0,
    bills,
    payments,
    supplierReturns: [],
    creditNotes: [],
    closingBalance: bills.reduce((sum, bill) => sum + bill.outstandingAmount, 0),
    generatedBy,
    generatedAt: nowIso()
  };
  saveList(STATEMENT_KEY, [statement, ...readList<SupplierStatementRecord>(STATEMENT_KEY)]);
  return statement;
}

export function getSupplierStatementHistory(filters: Partial<{ supplierId: string }> = {}): SupplierStatementRecord[] {
  return readList<SupplierStatementRecord>(STATEMENT_KEY).filter((statement) => !filters.supplierId || statement.supplierId === filters.supplierId);
}

export async function createCreditorBIWarnings(): Promise<void> {
  const summary = getCreditorAgeingSummary();
  if (summary.overdueSuppliers > 0) {
    await createBIAdviceFromTrigger({ id: 'SUPPLIER_INVOICE_OVERDUE', eventType: 'SUPPLIER_INVOICE_OVERDUE', domain: 'Supplier / Purchase Discipline', severity: 'High', description: `${summary.overdueSuppliers} supplier(s) have overdue payable balances.`, recommendedAction: 'Review creditor ageing and payment allocation plan.' });
  }
  getSupplierCreditProfiles().filter((profile) => profile.supplierCreditLimit > 0 && (profile.currentPayableBalance / profile.supplierCreditLimit) >= 0.8).forEach((profile) => {
    void createBIAdviceFromTrigger({ id: `${profile.supplierId}-LIMIT`, eventType: 'SUPPLIER_CREDIT_LIMIT_NEAR_MAX', domain: 'Supplier / Purchase Discipline', severity: 'High', description: `${profile.supplierName} payable balance is near supplier credit limit.`, recommendedAction: 'Avoid new supplier credit until payment plan is approved.' });
  });
}
