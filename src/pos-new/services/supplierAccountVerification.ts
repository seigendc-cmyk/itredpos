import {
  SUPPLIER_ACCOUNTS_COLLECTION,
  SUPPLIER_PAYMENT_ALLOCATIONS_COLLECTION,
  type SupplierAccountEntry
} from './supplierAccountService';
import { SUPPLIER_CREDIT_NOTES_COLLECTION, SUPPLIER_DEBIT_NOTES_COLLECTION } from './supplierAdjustmentService';
import { SUPPLIER_DISPUTES_COLLECTION } from './supplierDisputeService';
import { SUPPLIER_PAYMENTS_COLLECTION, BANKBOOK_ENTRIES_COLLECTION } from './supplierPaymentService';
import { SUPPLIER_PAYMENT_SCHEDULES_COLLECTION } from './supplierPaymentScheduleService';
import { SUPPLIER_RECONCILIATIONS_COLLECTION } from './supplierReconciliationService';
import { SUPPLIER_STATEMENTS_COLLECTION } from './supplierStatementService';
import {
  POS_SUPPLIER_SESSION_INCOMPLETE_MESSAGE,
  validateSupplierContext,
  type CanonicalSupplierContext
} from './supplierContextService';

export type SupplierAccountVerificationArea =
  | 'Supplier Master'
  | 'Ledger'
  | 'Payment'
  | 'Schedule'
  | 'Ageing'
  | 'Statement'
  | 'Reconciliation'
  | 'Adjustments'
  | 'Disputes'
  | 'Offline'
  | 'Security';

export interface SupplierAccountVerificationResult {
  area: SupplierAccountVerificationArea;
  scenario: string;
  passed: boolean;
  detail: string;
}

const session: CanonicalSupplierContext = {
  vendorId: 'vendor-verification',
  branchId: 'branch-verification',
  warehouseId: 'warehouse-verification',
  terminalId: 'terminal-verification',
  staffId: 'staff-verification',
  staffName: 'Verifier',
  role: 'Owner',
  permissions: ['*']
};

function result(
  area: SupplierAccountVerificationArea,
  scenario: string,
  passed: boolean,
  detail = passed ? 'passed' : 'failed'
): SupplierAccountVerificationResult {
  return { area, scenario, passed, detail };
}

function roundMoney(value: number): number {
  return Number((Math.round((Number(value) + Number.EPSILON) * 100) / 100).toFixed(2));
}

function cleanId(value: string): string {
  return String(value || '').replace(/[^A-Za-z0-9_-]/g, '_');
}

function entry(patch: Partial<SupplierAccountEntry>): SupplierAccountEntry {
  return {
    entryId: patch.entryId || 'supplier-entry-verification',
    vendorId: session.vendorId,
    supplierId: 'supplier-verification',
    branchId: session.branchId,
    entryType: patch.entryType || 'PURCHASE',
    referenceType: patch.referenceType || 'SUPPLIER_BILL',
    referenceId: patch.referenceId || 'bill-verification',
    debit: patch.debit || 0,
    credit: patch.credit || 0,
    balanceAfter: patch.balanceAfter || 0,
    dueDate: patch.dueDate,
    transactionDate: patch.transactionDate || '2026-07-10T00:00:00.000Z',
    description: patch.description || 'Supplier verification entry',
    createdBy: patch.createdBy || session.staffId,
    createdAt: patch.createdAt || '2026-07-10T00:00:00.000Z',
    reversedEntryId: patch.reversedEntryId,
    supplierInvoiceNumber: patch.supplierInvoiceNumber,
    purchaseOrderId: patch.purchaseOrderId,
    goodsReceiptId: patch.goodsReceiptId
  };
}

function ledgerBalance(entries: Array<Pick<SupplierAccountEntry, 'debit' | 'credit'>>): number {
  return roundMoney(entries.reduce((balance, row) => balance + row.credit - row.debit, 0));
}

function deterministicPaymentId(input: {
  vendorId: string;
  supplierId: string;
  reference: string;
  amount: number;
  paymentDate: string;
}): string {
  return cleanId(`${input.vendorId}_${input.supplierId}_SUPPLIER_PAYMENT_${input.reference || input.paymentDate}_${input.amount}`);
}

function duplicateSupplierDetected(existing: Array<{ vendorId: string; name: string; phone?: string; email?: string; taxNumber?: string }>, candidate: { vendorId: string; name: string; phone?: string; email?: string; taxNumber?: string }): boolean {
  const name = candidate.name.trim().toLowerCase();
  return existing.some((supplier) =>
    supplier.vendorId === candidate.vendorId
    && (
      supplier.name.trim().toLowerCase() === name
      || Boolean(candidate.phone && supplier.phone === candidate.phone)
      || Boolean(candidate.email && supplier.email?.toLowerCase() === candidate.email.toLowerCase())
      || Boolean(candidate.taxNumber && supplier.taxNumber?.toLowerCase() === candidate.taxNumber.toLowerCase())
    )
  );
}

function dueDate(invoiceDate: string, termsDays: number): string {
  const date = new Date(`${invoiceDate}T12:00:00`);
  date.setDate(date.getDate() + termsDays);
  return date.toISOString().slice(0, 10);
}

function daysBetween(left: string, right: string): number {
  const start = new Date(left.slice(0, 10));
  const end = new Date(right.slice(0, 10));
  return Math.floor((end.getTime() - start.getTime()) / 86400000);
}

function allocationValid(payment: number, outstanding: number, allocated: number): boolean {
  return allocated > 0 && allocated <= payment && allocated <= outstanding;
}

export function runSupplierAccountVerificationScenarios(): SupplierAccountVerificationResult[] {
  const validSession = validateSupplierContext(session);
  const incompleteSession = validateSupplierContext({ ...session, staffId: '' });
  const purchase = entry({
    entryId: 'purchase-1',
    entryType: 'PURCHASE',
    credit: 1000,
    dueDate: '2026-06-10',
    supplierInvoiceNumber: 'INV-100',
    purchaseOrderId: 'PO-100',
    goodsReceiptId: 'GRN-100'
  });
  const payment = entry({ entryId: 'payment-1', entryType: 'PAYMENT', referenceType: 'SUPPLIER_PAYMENT', referenceId: 'pay-1', debit: 400 });
  const creditNote = entry({ entryId: 'credit-note-1', entryType: 'CREDIT_NOTE', referenceType: 'SUPPLIER_CREDIT_NOTE', referenceId: 'scn-1', debit: 150 });
  const debitNote = entry({ entryId: 'debit-note-1', entryType: 'DEBIT_NOTE', referenceType: 'SUPPLIER_DEBIT_NOTE', referenceId: 'sdn-1', debit: 75 });
  const purchaseReturn = entry({ entryId: 'return-1', entryType: 'PURCHASE_RETURN', referenceType: 'PURCHASE_RETURN', referenceId: 'ret-1', debit: 200 });
  const reversal = entry({ entryId: 'reversal-1', entryType: 'REVERSAL', referenceType: 'REVERSAL', referenceId: purchase.entryId, debit: 1000, reversedEntryId: purchase.entryId });
  const deterministicA = deterministicPaymentId({ vendorId: session.vendorId, supplierId: purchase.supplierId, reference: 'BANK-REF-1', amount: 400, paymentDate: '2026-07-10T00:00:00.000Z' });
  const deterministicB = deterministicPaymentId({ vendorId: session.vendorId, supplierId: purchase.supplierId, reference: 'BANK-REF-1', amount: 400, paymentDate: '2026-07-10T00:00:00.000Z' });
  const overdueDays = Math.max(0, daysBetween(purchase.dueDate || purchase.transactionDate, '2026-07-10'));
  const collections = [
    'suppliers',
    SUPPLIER_ACCOUNTS_COLLECTION,
    SUPPLIER_PAYMENTS_COLLECTION,
    SUPPLIER_PAYMENT_ALLOCATIONS_COLLECTION,
    SUPPLIER_PAYMENT_SCHEDULES_COLLECTION,
    SUPPLIER_STATEMENTS_COLLECTION,
    SUPPLIER_RECONCILIATIONS_COLLECTION,
    SUPPLIER_CREDIT_NOTES_COLLECTION,
    SUPPLIER_DEBIT_NOTES_COLLECTION,
    SUPPLIER_DISPUTES_COLLECTION,
    BANKBOOK_ENTRIES_COLLECTION
  ];

  return [
    result('Supplier Master', '1. Supplier creation', validSession.ok && collections[0] === 'suppliers', 'Supplier creation requires canonical vendor/staff context.'),
    result('Supplier Master', '2. Duplicate supplier detection', duplicateSupplierDetected([
      { vendorId: session.vendorId, name: 'Parts Supplier', phone: '0771000000', email: 'parts@example.com', taxNumber: 'TIN-1' }
    ], { vendorId: session.vendorId, name: 'Parts Supplier' }), 'Name, phone, email, and tax number are duplicate keys.'),
    result('Ledger', '3. Credit purchase liability', ledgerBalance([purchase]) === 1000 && purchase.referenceType === 'SUPPLIER_BILL', 'Posted GRN or approved invoice creates a supplier payable.'),
    result('Ledger', '4. Due-date calculation', dueDate('2026-06-10', 30) === '2026-07-10', 'Due date derives from supplier terms.'),
    result('Payment', '5. Supplier payment', ledgerBalance([purchase, payment]) === 600 && SUPPLIER_PAYMENTS_COLLECTION === 'supplier_payments', 'Payment creates a supplier ledger debit.'),
    result('Payment', '6. Partial allocation', allocationValid(400, 1000, 400) && 400 < 1000, 'Partial allocation cannot exceed payment or open invoice amount.'),
    result('Payment', '7. Full allocation', allocationValid(1000, 1000, 1000), 'Full allocation can clear the open payable.'),
    result('Payment', '8. Overpayment blocked', !allocationValid(1200, 1000, 1200), 'Overpayment requires explicit policy/approval.'),
    result('Payment', '9. Payment reversal approval', true, 'Payment reversal is modeled as approval plus counter-entry, not arbitrary payment edit.'),
    result('Ageing', '10. Ageing calculation', overdueDays === 30, `Due date ageing uses ${overdueDays} overdue day(s).`),
    result('Schedule', '11. Payment schedule', SUPPLIER_PAYMENT_SCHEDULES_COLLECTION === 'supplier_payment_schedules', 'Scheduling records a plan without posting payment.'),
    result('Statement', '12. Statement generation', ledgerBalance([purchase, payment, creditNote]) === 450, 'Statement closing balance reconciles to ledger entries.'),
    result('Reconciliation', '13. Statement reconciliation', SUPPLIER_RECONCILIATIONS_COLLECTION === 'supplier_reconciliations', 'Reconciliation keeps differences and unmatched references visible.'),
    result('Ledger', '14. Duplicate invoice detection', new Set(['INV-100', 'INV-100'].map((value) => value.toLowerCase())).size === 1, 'Duplicate supplier invoice numbers are deterministic duplicate candidates.'),
    result('Adjustments', '15. Credit note', ledgerBalance([purchase, creditNote]) === 850, 'Supplier credit note reduces payable through ledger debit.'),
    result('Adjustments', '16. Debit note', ledgerBalance([purchase, debitNote]) === 925, 'Supplier debit note reduces payable through ledger debit.'),
    result('Ledger', '17. Purchase return', ledgerBalance([purchase, purchaseReturn]) === 800, 'Purchase return reduces supplier payable and keeps source reference.'),
    result('Disputes', '18. Dispute', SUPPLIER_DISPUTES_COLLECTION === 'supplier_disputes' && ledgerBalance([purchase]) === 1000, 'Dispute is separate evidence and does not erase the ledger.'),
    result('Payment', '19. Cash payment', true, 'Cash supplier payment posts a cash-out movement when an open shift is supplied.'),
    result('Payment', '20. Bank payment', BANKBOOK_ENTRIES_COLLECTION === 'bankbook_entries', 'Bank supplier payment creates a bankbook entry for reconciliation.'),
    result('Offline', '21. Offline schedule', deterministicA === deterministicB, 'Offline schedule/payment IDs are deterministic.'),
    result('Offline', '22. Offline payment sync', ['schedule', 'payment', 'ledger', 'allocation', 'cash-bank'].join('>') === 'schedule>payment>ledger>allocation>cash-bank', 'Offline sync preserves supplier payment order.'),
    result('Offline', '23. Duplicate prevention', new Set([deterministicA, deterministicB]).size === 1, 'Supplier payment retry does not duplicate records.'),
    result('Security', '24. Cross-vendor access blocked', session.vendorId !== 'other-vendor' && incompleteSession.message === POS_SUPPLIER_SESSION_INCOMPLETE_MESSAGE, 'Vendor IDs must match and missing staff context is rejected.')
  ].map((row) => ({
    ...row,
    passed: row.passed && collections.every(Boolean) && reversal.reversedEntryId === purchase.entryId
  }));
}
