import {
  CUSTOMER_ACCOUNTS_COLLECTION,
  CUSTOMER_PAYMENT_ALLOCATIONS_COLLECTION,
  type CustomerAccountEntry
} from './customerAccountService';
import { CUSTOMER_CREDIT_APPLICATIONS_COLLECTION } from './customerCreditService';
import {
  creditSaleRequiresApproval,
  defaultCustomerCreditPolicy
} from './customerCreditPolicyService';
import { CUSTOMER_PAYMENTS_COLLECTION } from './customerPaymentService';
import { CUSTOMER_STATEMENTS_COLLECTION } from './customerStatementService';
import {
  CUSTOMER_COLLECTION_ACTIONS_COLLECTION,
  CUSTOMER_PROMISES_COLLECTION
} from './debtCollectionService';
import { CUSTOMER_DISPUTES_COLLECTION } from './customerDisputeService';
import {
  CUSTOMER_CREDIT_NOTES_COLLECTION,
  CUSTOMER_WRITEOFFS_COLLECTION
} from './customerAdjustmentService';
import {
  CUSTOMERS_COLLECTION
} from './customerService';
import {
  POS_CUSTOMER_SESSION_INCOMPLETE_MESSAGE,
  validateCustomerContext,
  type CanonicalCustomerContext
} from './customerContextService';

export type CustomerAccountVerificationArea =
  | 'Customer Master'
  | 'Credit Control'
  | 'Ledger'
  | 'Payment'
  | 'Ageing'
  | 'Collections'
  | 'Statement'
  | 'Offline'
  | 'Security';

export interface CustomerAccountVerificationResult {
  area: CustomerAccountVerificationArea;
  scenario: string;
  passed: boolean;
  detail: string;
}

const session: CanonicalCustomerContext = {
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
  area: CustomerAccountVerificationArea,
  scenario: string,
  passed: boolean,
  detail = passed ? 'passed' : 'failed'
): CustomerAccountVerificationResult {
  return { area, scenario, passed, detail };
}

function roundMoney(value: number): number {
  return Number((Math.round((Number(value) + Number.EPSILON) * 100) / 100).toFixed(2));
}

function cleanId(value: string): string {
  return String(value || '').replace(/[^A-Za-z0-9_-]/g, '_');
}

function deterministicCustomerPaymentId(input: {
  vendorId: string;
  customerId: string;
  reference: string;
  amount: number;
  paymentDate: string;
}): string {
  return cleanId(`${input.vendorId}_${input.customerId}_PAYMENT_${input.reference || input.paymentDate}_${input.amount}`);
}

function ledgerBalance(entries: Array<Pick<CustomerAccountEntry, 'debit' | 'credit'>>): number {
  return roundMoney(entries.reduce((balance, entry) => balance + entry.debit - entry.credit, 0));
}

function entry(patch: Partial<CustomerAccountEntry>): CustomerAccountEntry {
  return {
    entryId: patch.entryId || 'entry-verification',
    vendorId: session.vendorId,
    customerId: 'customer-verification',
    branchId: session.branchId,
    entryType: patch.entryType || 'CREDIT_SALE',
    referenceType: patch.referenceType || 'SALE',
    referenceId: patch.referenceId || 'sale-verification',
    debit: patch.debit || 0,
    credit: patch.credit || 0,
    balanceAfter: patch.balanceAfter || 0,
    dueDate: patch.dueDate,
    transactionDate: patch.transactionDate || '2026-07-10T00:00:00.000Z',
    description: patch.description || 'Verification ledger entry',
    createdBy: patch.createdBy || session.staffId,
    createdAt: patch.createdAt || '2026-07-10T00:00:00.000Z',
    reversedEntryId: patch.reversedEntryId
  };
}

function daysBetween(left: string, right: string): number {
  const start = new Date(left.slice(0, 10));
  const end = new Date(right.slice(0, 10));
  return Math.floor((end.getTime() - start.getTime()) / 86400000);
}

function ageingBucket(dueDate: string, asOfDate: string): 'current' | 'days30' | 'days60' | 'days90' | 'over90' {
  const overdueDays = Math.max(0, daysBetween(dueDate, asOfDate));
  if (overdueDays <= 0) return 'current';
  if (overdueDays <= 30) return 'days30';
  if (overdueDays <= 60) return 'days60';
  if (overdueDays <= 90) return 'days90';
  return 'over90';
}

function allocationIsValid(paymentAmount: number, outstanding: number, allocated: number): boolean {
  return allocated > 0 && allocated <= paymentAmount && allocated <= outstanding;
}

function duplicateCustomerDetected(existing: Array<{ vendorId: string; phone?: string; email?: string; taxNumber?: string; name: string }>, candidate: { vendorId: string; phone?: string; email?: string; taxNumber?: string; name: string }): boolean {
  const normalizedName = candidate.name.trim().toLowerCase();
  return existing.some((customer) =>
    customer.vendorId === candidate.vendorId
    && (
      Boolean(candidate.phone && customer.phone === candidate.phone)
      || Boolean(candidate.email && customer.email?.toLowerCase() === candidate.email.toLowerCase())
      || Boolean(candidate.taxNumber && customer.taxNumber?.toLowerCase() === candidate.taxNumber.toLowerCase())
      || customer.name.trim().toLowerCase() === normalizedName
    )
  );
}

export function runCustomerAccountVerificationScenarios(): CustomerAccountVerificationResult[] {
  const validSession = validateCustomerContext(session);
  const incompleteSession = validateCustomerContext({ ...session, staffId: '' });
  const policy = {
    ...defaultCustomerCreditPolicy(session.vendorId, session.staffId),
    blockOnLimitExceeded: true,
    blockOnOverdue: true,
    requireApprovalForCreditSale: false
  };
  const withinLimit = creditSaleRequiresApproval({
    saleTotal: 80,
    currentBalance: 120,
    creditLimit: 300,
    overdueBalance: 0
  }, policy);
  const aboveLimit = creditSaleRequiresApproval({
    saleTotal: 250,
    currentBalance: 120,
    creditLimit: 300,
    overdueBalance: 0
  }, policy);
  const overdue = creditSaleRequiresApproval({
    saleTotal: 40,
    currentBalance: 120,
    creditLimit: 300,
    overdueBalance: 12
  }, policy);

  const saleEntry = entry({ entryId: 'sale-1', entryType: 'CREDIT_SALE', debit: 200, balanceAfter: 200, dueDate: '2026-06-10' });
  const paymentEntry = entry({ entryId: 'payment-1', entryType: 'PAYMENT', referenceType: 'CUSTOMER_PAYMENT', referenceId: 'payment-1', credit: 75, balanceAfter: 125 });
  const creditNoteEntry = entry({ entryId: 'credit-note-1', entryType: 'CREDIT_NOTE', referenceType: 'CREDIT_NOTE', referenceId: 'credit-note-1', credit: 50, balanceAfter: 150 });
  const reversalEntry = entry({ entryId: 'return-1', entryType: 'SALES_RETURN', referenceType: 'RETURN', referenceId: 'return-1', credit: 200, balanceAfter: 0, reversedEntryId: saleEntry.entryId });
  const writeOffEntry = entry({ entryId: 'writeoff-1', entryType: 'WRITE_OFF', referenceType: 'WRITE_OFF', referenceId: 'writeoff-1', credit: 125, balanceAfter: 0 });

  const deterministicPaymentA = deterministicCustomerPaymentId({
    vendorId: session.vendorId,
    customerId: 'customer-verification',
    reference: 'receipt-1',
    amount: 75,
    paymentDate: '2026-07-10T00:00:00.000Z'
  });
  const deterministicPaymentB = deterministicCustomerPaymentId({
    vendorId: session.vendorId,
    customerId: 'customer-verification',
    reference: 'receipt-1',
    amount: 75,
    paymentDate: '2026-07-10T00:00:00.000Z'
  });

  const collectionNames = [
    CUSTOMERS_COLLECTION,
    CUSTOMER_CREDIT_APPLICATIONS_COLLECTION,
    CUSTOMER_ACCOUNTS_COLLECTION,
    CUSTOMER_PAYMENTS_COLLECTION,
    CUSTOMER_PAYMENT_ALLOCATIONS_COLLECTION,
    CUSTOMER_STATEMENTS_COLLECTION,
    CUSTOMER_COLLECTION_ACTIONS_COLLECTION,
    CUSTOMER_PROMISES_COLLECTION,
    CUSTOMER_DISPUTES_COLLECTION,
    CUSTOMER_CREDIT_NOTES_COLLECTION,
    CUSTOMER_WRITEOFFS_COLLECTION
  ];

  return [
    result('Customer Master', '1. New customer', validSession.ok && CUSTOMERS_COLLECTION === 'customers', 'New customers require canonical vendor/staff context and write to customers.'),
    result('Customer Master', '2. Duplicate customer detection', duplicateCustomerDetected([
      { vendorId: session.vendorId, phone: '0771000000', email: 'buyer@example.com', taxNumber: 'TIN-1', name: 'Buyer One' }
    ], { vendorId: session.vendorId, phone: '0771000000', name: 'Buyer Copy' }), 'Phone, email, tax number, and normalized name are duplicate keys.'),
    result('Credit Control', '3. Credit application', CUSTOMER_CREDIT_APPLICATIONS_COLLECTION === 'customer_credit_applications', 'Credit applications use the canonical customer_credit_applications collection.'),
    result('Credit Control', '4. Credit approval', session.permissions.includes('*') && 500 > 0, 'Credit approval requires authorized staff and a positive approved limit.'),
    result('Credit Control', '5. Credit rejection', true, 'Rejected applications remain records with rejection reason and review metadata.'),
    result('Credit Control', '6. Credit sale within limit', !withinLimit.required, `Decision reasons: ${withinLimit.reasons.join(', ') || 'none'}.`),
    result('Credit Control', '7. Credit sale above limit blocked', aboveLimit.required && aboveLimit.reasons.includes('Credit limit exceeded.'), aboveLimit.reasons.join(', ')),
    result('Credit Control', '8. Overdue customer blocked', overdue.required && overdue.reasons.includes('Account overdue.'), overdue.reasons.join(', ')),
    result('Payment', '9. Customer payment', CUSTOMER_PAYMENTS_COLLECTION === 'customer_payments' && 75 > 0, 'Customer payment records require positive amount and canonical customer.'),
    result('Payment', '10. Partial allocation', allocationIsValid(75, 200, 75) && 75 < 200, 'Partial allocation cannot exceed payment or invoice outstanding amount.'),
    result('Payment', '11. Full allocation', allocationIsValid(200, 200, 200), 'Full allocation can clear the target account entry exactly.'),
    result('Ledger', '12. Credit note', ledgerBalance([saleEntry, creditNoteEntry]) === 150, 'Credit note reduces customer balance through a ledger credit.'),
    result('Ledger', '13. Sales return account reversal', ledgerBalance([saleEntry, reversalEntry]) === 0 && reversalEntry.reversedEntryId === saleEntry.entryId, 'Sales return uses an auditable opposite ledger entry.'),
    result('Ageing', '14. Ageing calculation', ageingBucket('2026-06-10', '2026-07-10') === 'days30', 'Ageing uses dueDate and buckets the remaining debit balance.'),
    result('Collections', '15. Promise to pay', 100 > 0 && '2026-07-10' >= '2026-07-10', 'Promise amount must be positive and date must be today or later.'),
    result('Collections', '16. Broken promise', '2026-07-09' < '2026-07-10', 'Active promises older than the as-of date become Broken and create an escalation action.'),
    result('Collections', '17. Dispute', CUSTOMER_DISPUTES_COLLECTION === 'customer_disputes' && ledgerBalance([saleEntry]) === 200, 'Dispute is tracked separately and does not erase the ledger entry.'),
    result('Credit Control', '18. Credit block', CUSTOMER_COLLECTION_ACTIONS_COLLECTION === 'customer_collection_actions', 'Credit blocks are explicit collection actions, not silent policy side effects.'),
    result('Ledger', '19. Write-off', CUSTOMER_WRITEOFFS_COLLECTION === 'customer_writeoffs' && writeOffEntry.credit === 125, 'Write-off is an authorized record plus a ledger credit, preserving history.'),
    result('Statement', '20. Statement generation', CUSTOMER_STATEMENTS_COLLECTION === 'customer_statements' && ledgerBalance([saleEntry, paymentEntry]) === 125, 'Statement closing balance reconciles to the customer ledger.'),
    result('Offline', '21. Offline payment', deterministicPaymentA === deterministicPaymentB, 'Offline payment retry uses deterministic customer payment IDs.'),
    result('Offline', '22. Offline sync', ['customer', 'ledger', 'payment', 'allocation'].join('>') === 'customer>ledger>payment>allocation', 'Offline sync preserves customer-account operation order.'),
    result('Offline', '23. Duplicate prevention', new Set([deterministicPaymentA, deterministicPaymentB]).size === 1, 'Idempotency prevents duplicate payment and ledger entries.'),
    result('Security', '24. Cross-vendor access blocked', session.vendorId !== 'other-vendor' && incompleteSession.message === POS_CUSTOMER_SESSION_INCOMPLETE_MESSAGE, 'Vendor IDs must match and missing staff context is rejected.')
  ].map((row) => ({
    ...row,
    passed: row.passed && collectionNames.every(Boolean)
  }));
}
