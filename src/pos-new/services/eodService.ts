import {
  DayLockAttempt,
  EODActivityEvent,
  EODActivityEventType,
  EODBIReviewItem,
  EODCashReconciliation,
  EODChecklistItem,
  EODDeliveryClosingRow,
  EODInventoryClosingRow,
  EODPaymentSummary,
  EODSession,
  EODShiftSummary,
  PaymentMode
} from '../types/posTypes';
import {
  mockEODActivityEvents,
  mockEODBIReviewItems,
  mockEODCashReconciliationRows,
  mockEODChecklistItems,
  mockEODDeliveryClosingRows,
  mockEODInventoryClosingRows,
  mockEODPaymentSummary,
  mockEODSession,
  mockEODShiftSummaries
} from '../mock/mockPosData';
import {
  getAccountingReadinessChecks,
  getSalesAccountingSummary
} from './accountingService';
import { getDeliveryRequests } from './deliveryService';

export interface EODFilters {
  vendorId?: string;
  businessDate?: string;
  branch?: string;
  terminal?: string;
  cashier?: string;
  dateFrom?: string;
  dateTo?: string;
  paymentMode?: PaymentMode | 'All';
}

const SESSION_KEY = 'itred_pos_eod_session';
const CHECKLIST_KEY = 'itred_pos_eod_checklist_v2';
const CASH_KEY = 'itred_pos_eod_cash_rows';
const INVENTORY_KEY = 'itred_pos_eod_inventory_rows';
const DELIVERY_KEY = 'itred_pos_eod_delivery_rows';
const BI_KEY = 'itred_pos_eod_bi_items';
const ACTIVITY_KEY = 'itred_pos_eod_activity';

function readObject<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  if (!raw) {
    localStorage.setItem(key, JSON.stringify(fallback));
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    localStorage.setItem(key, JSON.stringify(fallback));
    return fallback;
  }
}

function saveObject<T>(key: string, value: T): T {
  localStorage.setItem(key, JSON.stringify(value));
  return value;
}

function readList<T>(key: string, fallback: T[]): T[] {
  return readObject<T[]>(key, fallback);
}

function saveList<T>(key: string, list: T[]): T[] {
  return saveObject(key, list);
}

function addActivity(
  eventType: EODActivityEventType,
  message: string,
  operator = 'Admin User'
): EODActivityEvent[] {
  const current = readList<EODActivityEvent>(ACTIVITY_KEY, mockEODActivityEvents);
  const next: EODActivityEvent = {
    id: `EOD-ACT-${Math.floor(10000 + Math.random() * 90000)}`,
    timestamp: new Date().toISOString(),
    eventType,
    message,
    operator
  };
  return saveList(ACTIVITY_KEY, [next, ...current].slice(0, 40));
}

function isBranchMatch(rowBranch: string, branch?: string): boolean {
  return !branch || branch === 'All Branches' || rowBranch === branch;
}

function formatBusinessDate(date?: string): string {
  return date || mockEODSession.businessDate;
}

export async function getEODSession(vendorId: string, businessDate: string): Promise<EODSession> {
  const session = readObject<EODSession>(SESSION_KEY, mockEODSession);
  return {
    ...session,
    vendorId: vendorId || session.vendorId,
    businessDate: formatBusinessDate(businessDate)
  };
}

export async function getEODChecklist(_vendorId: string, _businessDate: string): Promise<EODChecklistItem[]> {
  return readList<EODChecklistItem>(CHECKLIST_KEY, mockEODChecklistItems);
}

export async function runEODReadinessCheck(vendorId: string, businessDate: string): Promise<EODChecklistItem[]> {
  const refreshed = mockEODChecklistItems.map((item) => ({ ...item }));
  saveList(CHECKLIST_KEY, refreshed);
  const session = await getEODSession(vendorId, businessDate);
  saveObject<EODSession>(SESSION_KEY, { ...session, status: 'Blocked', lastCheckTime: new Date().toISOString() });
  addActivity('EOD_CHECK_RUN', 'EOD readiness check run for Demo Vendor.');
  return refreshed;
}

export async function getEODPaymentSummary(filters: EODFilters): Promise<EODPaymentSummary[]> {
  return mockEODPaymentSummary.filter((row) =>
    !filters.paymentMode || filters.paymentMode === 'All' || row.paymentMode === filters.paymentMode
  );
}

export async function getEODShiftSummaries(filters: EODFilters): Promise<EODShiftSummary[]> {
  return mockEODShiftSummaries.filter((row) =>
    isBranchMatch(row.branch, filters.branch) &&
    (!filters.terminal || filters.terminal === 'All Terminals' || row.terminal === filters.terminal) &&
    (!filters.cashier || filters.cashier === 'All Staff' || row.staff === filters.cashier)
  );
}

export async function getEODCashReconciliation(filters: EODFilters): Promise<EODCashReconciliation[]> {
  return readList<EODCashReconciliation>(CASH_KEY, mockEODCashReconciliationRows).filter((row) =>
    isBranchMatch(row.branch, filters.branch) &&
    (!filters.terminal || filters.terminal === 'All Terminals' || row.terminal === filters.terminal) &&
    (!filters.cashier || filters.cashier === 'All Staff' || row.cashier === filters.cashier)
  );
}

export async function getEODInventoryClosing(filters: EODFilters): Promise<EODInventoryClosingRow[]> {
  return readList<EODInventoryClosingRow>(INVENTORY_KEY, mockEODInventoryClosingRows).filter((row) =>
    isBranchMatch(row.branch, filters.branch)
  );
}

export async function getEODDeliveryClosing(filters: EODFilters): Promise<EODDeliveryClosingRow[]> {
  const baseRows = readList<EODDeliveryClosingRow>(DELIVERY_KEY, mockEODDeliveryClosingRows);
  const requestRows = (await getDeliveryRequests({})).map((delivery): EODDeliveryClosingRow => {
    const failed = ['Delivery Failed', 'Returned To Vendor', 'Cancelled'].includes(delivery.deliveryStatus);
    const pending = ['Pending Assignment', 'Broadcast To iDeliver', 'Provider Selected', 'Assigned', 'Picked Up', 'In Transit', 'Arrived', 'Cash Pending Review'].includes(delivery.deliveryStatus);
    const cashRisk = delivery.cashStatus === 'Collected By Driver' || delivery.cashStatus === 'Variance Review' || delivery.cashStatus === 'Missing Cash';
    return {
      id: `EOD-${delivery.deliveryId}`,
      deliveryId: delivery.deliveryNumber,
      branch: delivery.branchName,
      receipt: delivery.receiptNumber,
      customer: delivery.customerName,
      deliveryMethod: delivery.deliveryMethod,
      driver: delivery.driverName || delivery.providerName || 'Pending',
      status: failed ? 'Failed' : pending ? 'Pending' : 'Completed',
      secretCodeStatus: delivery.confirmationStatus === 'Code Verified' ? 'Confirmed' : delivery.confirmationStatus === 'Code Failed' ? 'Mismatch' : delivery.deliveryMethod === 'No Delivery' ? 'Not Required' : 'Pending',
      completedAt: delivery.deliveredAt || delivery.updatedAt,
      risk: failed || cashRisk ? 'High' : pending ? 'Medium' : 'Low',
      requiredAction: failed
        ? 'Failed / returned delivery requires follow-up.'
        : cashRisk
          ? 'Delivery cash pending EOD review. No cashbook posting created.'
          : pending
            ? 'Delivery unresolved at day end.'
            : 'Review completed delivery handoff.'
    };
  });
  const byId = new Map([...baseRows, ...requestRows].map((row) => [row.deliveryId, row]));
  return Array.from(byId.values()).filter((row) =>
    isBranchMatch(row.branch || 'Harare Main', filters.branch)
  );
}

export async function getEODBIReviewItems(_filters: EODFilters): Promise<EODBIReviewItem[]> {
  return readList<EODBIReviewItem>(BI_KEY, mockEODBIReviewItems);
}

export async function getEODActivityEvents(): Promise<EODActivityEvent[]> {
  return readList<EODActivityEvent>(ACTIVITY_KEY, mockEODActivityEvents);
}

export async function recordEODActivity(
  eventType: EODActivityEventType,
  message: string,
  operator = 'Admin User'
): Promise<EODActivityEvent[]> {
  return addActivity(eventType, message, operator);
}

export async function markEODItemReviewed(itemId: string): Promise<EODActivityEvent[]> {
  const checklist = readList<EODChecklistItem>(CHECKLIST_KEY, mockEODChecklistItems).map((item) =>
    item.id === itemId ? { ...item, status: 'Passed' as const, reviewedBy: 'Admin User', notes: 'Marked reviewed locally.' } : item
  );
  saveList(CHECKLIST_KEY, checklist);

  saveList<EODCashReconciliation>(
    CASH_KEY,
    readList<EODCashReconciliation>(CASH_KEY, mockEODCashReconciliationRows).map((row) =>
      row.id === itemId ? { ...row, status: 'Reviewed', reviewedBy: 'Admin User', requiredAction: 'Owner note recorded' } : row
    )
  );
  saveList<EODInventoryClosingRow>(
    INVENTORY_KEY,
    readList<EODInventoryClosingRow>(INVENTORY_KEY, mockEODInventoryClosingRows).map((row) =>
      row.id === itemId ? { ...row, status: 'Reviewed', reviewedBy: 'Admin User', requiredAction: 'Reviewed locally' } : row
    )
  );
  saveList<EODDeliveryClosingRow>(
    DELIVERY_KEY,
    readList<EODDeliveryClosingRow>(DELIVERY_KEY, mockEODDeliveryClosingRows).map((row) =>
      row.id === itemId ? { ...row, status: 'Follow Up', reviewedBy: 'Admin User', requiredAction: 'Follow-up note recorded' } : row
    )
  );
  saveList<EODBIReviewItem>(
    BI_KEY,
    readList<EODBIReviewItem>(BI_KEY, mockEODBIReviewItems).map((row) =>
      row.id === itemId ? { ...row, status: 'Reviewed', reviewedBy: 'Admin User' } : row
    )
  );

  const eventType: EODActivityEventType = itemId.includes('CASH')
    ? 'CASH_VARIANCE_REVIEWED'
    : itemId.includes('INV')
    ? 'INVENTORY_CLOSING_REVIEWED'
    : itemId.includes('DEL')
    ? 'DELIVERY_CLOSING_REVIEWED'
    : itemId.includes('BI')
    ? 'BI_REVIEW_COMPLETED'
    : 'PAYMENT_SUMMARY_REVIEWED';
  return addActivity(eventType, `${itemId} marked reviewed locally.`);
}

export async function attemptDayLock(vendorId: string, businessDate: string): Promise<DayLockAttempt> {
  const session = await getEODSession(vendorId, businessDate);
  const checklist = await getEODChecklist(vendorId, businessDate);
  const cashRows = await getEODCashReconciliation({ vendorId, businessDate });
  const shiftRows = await getEODShiftSummaries({ vendorId, businessDate });
  const inventoryRows = await getEODInventoryClosing({ vendorId, businessDate });
  const biRows = await getEODBIReviewItems({ vendorId, businessDate });
  const accountingReadiness = await getAccountingReadinessChecks(vendorId);
  const salesAccounting = await getSalesAccountingSummary({ vendorId, businessDate });

  const blockingReasons = [
    checklist.some((item) => item.status === 'Failed') ? 'Failed EOD checks remain' : '',
    cashRows.some((row) => row.variance !== 0 && row.status !== 'Reviewed') ? 'Cash variance not reviewed' : '',
    shiftRows.some((row) => row.status === 'Open') ? 'Open shift exists' : '',
    checklist.some((item) => item.domain === 'Sync' && item.status === 'Failed') ? 'Sync queue has critical conflicts' : '',
    biRows.some((row) => row.severity === 'Critical' && row.status !== 'Reviewed') ? 'Critical BI alerts not reviewed' : '',
    inventoryRows.some((row) => row.status === 'Pending Approval') ? 'Pending approval inventory movements exist' : '',
    accountingReadiness.some((row) => row.check.includes('Product Sales Account') && row.status !== 'Passed') ? 'Missing Sales Account COA' : '',
    accountingReadiness.some((row) => row.check.includes('Product Asset Account') && row.status !== 'Passed') ? 'Missing Asset Account COA' : '',
    salesAccounting.some((row) => row.postingStatus === 'Pending Review') ? 'Unreviewed accounting postings' : ''
  ].filter(Boolean);

  addActivity('EOD_LOCK_ATTEMPTED', 'Day lock attempted.');

  if (blockingReasons.length > 0) {
    const blockedSession = saveObject<EODSession>(SESSION_KEY, { ...session, status: 'Blocked' });
    const activity = addActivity('EOD_LOCK_BLOCKED', 'Day cannot be locked while failed checks remain.');
    return {
      success: false,
      message: 'Day cannot be locked while failed checks remain.',
      session: blockedSession,
      blockingReasons,
      activity
    };
  }

  const lockedSession = saveObject<EODSession>(SESSION_KEY, {
    ...session,
    status: 'Locked',
    lockedAt: new Date().toISOString(),
    lockedBy: 'Admin User'
  });
  const activity = addActivity('EOD_DAY_LOCKED', 'Day locked successfully.');
  return {
    success: true,
    message: 'Day locked successfully.',
    session: lockedSession,
    blockingReasons: [],
    activity
  };
}

export async function exportEODReportPlaceholder(_filters: EODFilters): Promise<{ message: string; activity: EODActivityEvent[] }> {
  const activity = addActivity('EOD_REPORT_EXPORT_PREPARED', 'EOD report export prepared.');
  return { message: 'EOD report export prepared.', activity };
}
