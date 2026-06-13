import {
  EODChecklistItem,
  EODReconciliationRow,
  OwnerActivityEvent,
  OwnerActivityEventType,
  OwnerApprovalItem,
  OwnerApprovalStatus,
  OwnerBIAlert,
  OwnerSummary,
  TerminalEODSummary
} from '../types/posTypes';
import {
  mockEODChecklist,
  mockEODReconciliationRows,
  mockOwnerActivityEvents,
  mockOwnerApprovals,
  mockOwnerBIAlerts,
  mockOwnerSummary,
  mockTerminalEODSummary
} from '../mock/mockPosData';
import {
  getOpeningBalanceDrafts as getImportOpeningBalanceDrafts,
  getProductImportBatches,
  getProductImportRows
} from './productImportService';
import {
  getOpeningBalanceDrafts as getManualOpeningBalanceDrafts,
  getProductCreationActivityEvents
} from './manualProductService';
import { getProductMasterRecords } from './productMasterService';
import { getProductStockBalances } from './stockBalanceService';

const CHECKLIST_KEY = 'itred_pos_owner_eod_checklist';
const APPROVALS_KEY = 'itred_pos_owner_approvals';
const ACTIVITY_KEY = 'itred_pos_owner_activity';

function readList<T>(key: string, fallback: T[]): T[] {
  const raw = localStorage.getItem(key);
  if (!raw) {
    localStorage.setItem(key, JSON.stringify(fallback));
    return fallback;
  }

  try {
    return JSON.parse(raw) as T[];
  } catch {
    localStorage.setItem(key, JSON.stringify(fallback));
    return fallback;
  }
}

function saveList<T>(key: string, list: T[]): T[] {
  localStorage.setItem(key, JSON.stringify(list));
  return list;
}

function addOwnerActivity(
  eventType: OwnerActivityEventType,
  message: string,
  operator = 'Owner Desk'
): OwnerActivityEvent[] {
  const current = readList<OwnerActivityEvent>(ACTIVITY_KEY, mockOwnerActivityEvents);
  const next: OwnerActivityEvent = {
    id: `OWN-ACT-${Math.floor(10000 + Math.random() * 90000)}`,
    timestamp: new Date().toISOString(),
    eventType,
    message,
    operator
  };
  return saveList(ACTIVITY_KEY, [next, ...current].slice(0, 20));
}

async function getProductImportOwnerChecks(): Promise<EODChecklistItem[]> {
  const importBatches = await getProductImportBatches({});
  const importRows = (await Promise.all(importBatches.map((batch) => getProductImportRows(batch.batchId)))).flat();
  const openingDrafts = await getImportOpeningBalanceDrafts();
  const checks: EODChecklistItem[] = [];
  const pendingApproval = importBatches.filter((batch) => batch.status === 'Pending Approval').length;
  const validationErrors = importBatches.filter((batch) => batch.status === 'Validation Failed' || batch.errorRows > 0).length;
  const duplicateHeld = importRows.filter((row) => row.status === 'Duplicate' && row.duplicateAction === 'Hold For Review').length;
  const pendingOpeningDrafts = openingDrafts.filter((draft) => draft.status === 'Draft - Not Posted').length;
  const importedPendingReview = importBatches.filter((batch) => ['Imported', 'Partially Imported'].includes(batch.status)).length;

  if (pendingApproval > 0) checks.push({ id: 'OWN-PIM-APPROVAL', check: 'Product import pending approval', domain: 'Inventory', status: 'Warning', risk: 'Medium', requiredAction: `${pendingApproval} import batch(es) pending owner approval.` });
  if (validationErrors > 0) checks.push({ id: 'OWN-PIM-ERRORS', check: 'Product import validation errors', domain: 'Inventory', status: 'Failed', risk: 'High', requiredAction: `${validationErrors} import batch(es) have validation errors.` });
  if (duplicateHeld > 0) checks.push({ id: 'OWN-PIM-DUPLICATES', check: 'Duplicate import rows held for review', domain: 'Inventory', status: 'Warning', risk: 'Medium', requiredAction: `${duplicateHeld} duplicate row(s) must be resolved before import.` });
  if (pendingOpeningDrafts > 0) checks.push({ id: 'OWN-PIM-OPENING-DRAFTS', check: 'Opening balance drafts pending posting', domain: 'Inventory', status: 'Warning', risk: 'Medium', requiredAction: `${pendingOpeningDrafts} opening balance draft(s) from imports are not posted.` });
  if (importedPendingReview > 0) checks.push({ id: 'OWN-PIM-PRODUCT-REVIEW', check: 'Imported products pending review', domain: 'Inventory', status: 'Warning', risk: 'Low', requiredAction: `${importedPendingReview} imported batch(es) should be reviewed in Product Master.` });
  return checks;
}

async function getManualProductOwnerChecks(): Promise<EODChecklistItem[]> {
  const [products, openingDrafts, balances, activity] = await Promise.all([
    getProductMasterRecords({}),
    getManualOpeningBalanceDrafts({}),
    getProductStockBalances(),
    getProductCreationActivityEvents({})
  ]);
  const checks: EODChecklistItem[] = [];
  const productDrafts = products.filter((product) => ['Draft', 'Pending Review'].includes(product.productStatus || product.status)).length;
  const pendingOpening = openingDrafts.filter((draft) => draft.status === 'Draft' || draft.status === 'Pending Approval').length;
  const approvedNotPosted = openingDrafts.filter((draft) => draft.status === 'Approved').length;
  const duplicateRisk = activity.filter((event) => event.eventType === 'PRODUCT_DUPLICATE_WARNING').length;
  const activeNoBalance = products.filter((product) => (product.productStatus || product.status) === 'Active' && !balances.some((balance) => balance.productId === product.productId)).length;

  if (productDrafts > 0) checks.push({ id: 'OWN-MANUAL-PRODUCT-DRAFTS', check: 'Product drafts pending activation', domain: 'Inventory', status: 'Warning', risk: 'Medium', requiredAction: `${productDrafts} product draft(s) require activation or review.` });
  if (pendingOpening > 0) checks.push({ id: 'OWN-MANUAL-OPENING-PENDING', check: 'Opening balance drafts pending approval', domain: 'Inventory', status: 'Warning', risk: 'Medium', requiredAction: `${pendingOpening} opening balance draft(s) are not approved.` });
  if (approvedNotPosted > 0) checks.push({ id: 'OWN-MANUAL-OPENING-APPROVED', check: 'Opening balance approved but not posted', domain: 'Inventory', status: 'Warning', risk: 'Medium', requiredAction: `${approvedNotPosted} approved opening balance draft(s) must be posted or cancelled.` });
  if (duplicateRisk > 0) checks.push({ id: 'OWN-MANUAL-DUPLICATE-RISK', check: 'Duplicate product risk pending review', domain: 'Inventory', status: 'Warning', risk: 'High', requiredAction: `${duplicateRisk} duplicate warning(s) require owner review.` });
  if (activeNoBalance > 0) checks.push({ id: 'OWN-MANUAL-ACTIVE-NO-BALANCE', check: 'Active products with no stock balance', domain: 'Inventory', status: 'Warning', risk: 'Medium', requiredAction: `${activeNoBalance} active product(s) have no stock balance.` });
  return checks;
}

export async function getOwnerSummary(): Promise<OwnerSummary> {
  return mockOwnerSummary;
}

export async function getEODChecklist(): Promise<EODChecklistItem[]> {
  const saved = readList<EODChecklistItem>(CHECKLIST_KEY, mockEODChecklist);
  const [importChecks, manualChecks] = await Promise.all([getProductImportOwnerChecks(), getManualProductOwnerChecks()]);
  const savedWithoutDynamicChecks = saved.filter((item) => !item.id.startsWith('OWN-PIM-') && !item.id.startsWith('OWN-MANUAL-'));
  return [...savedWithoutDynamicChecks, ...importChecks, ...manualChecks];
}

export async function runEODCheck(operator?: string): Promise<EODChecklistItem[]> {
  const refreshed = [
    ...mockEODChecklist.map((item) => ({ ...item })),
    ...await getProductImportOwnerChecks(),
    ...await getManualProductOwnerChecks()
  ];
  saveList(CHECKLIST_KEY, refreshed);
  addOwnerActivity('EOD_CHECK_RUN', 'EOD readiness checklist refreshed.', operator);
  return refreshed;
}

export async function getEODReconciliationRows(): Promise<EODReconciliationRow[]> {
  return mockEODReconciliationRows;
}

export async function getTerminalEODSummary(): Promise<TerminalEODSummary[]> {
  return mockTerminalEODSummary;
}

export async function getOwnerApprovals(): Promise<OwnerApprovalItem[]> {
  return readList<OwnerApprovalItem>(APPROVALS_KEY, mockOwnerApprovals);
}

export async function updateOwnerApprovalStatus(
  approvalId: string,
  status: OwnerApprovalStatus,
  operator?: string
): Promise<OwnerApprovalItem[]> {
  const current = await getOwnerApprovals();
  const updated = current.map((approval) =>
    approval.id === approvalId ? { ...approval, status } : approval
  );
  saveList(APPROVALS_KEY, updated);

  if (status === 'Reviewed') {
    addOwnerActivity('APPROVAL_MARKED_REVIEWED', `Approval ${approvalId} marked reviewed.`, operator);
  }

  return updated;
}

export async function getOwnerBIAlerts(): Promise<OwnerBIAlert[]> {
  return mockOwnerBIAlerts;
}

export async function getOwnerActivityEvents(): Promise<OwnerActivityEvent[]> {
  return readList<OwnerActivityEvent>(ACTIVITY_KEY, mockOwnerActivityEvents);
}

export async function recordOwnerActivity(
  eventType: OwnerActivityEventType,
  message: string,
  operator?: string
): Promise<OwnerActivityEvent[]> {
  return addOwnerActivity(eventType, message, operator);
}

export async function attemptLockDay(
  checklist: EODChecklistItem[],
  operator?: string
): Promise<{ success: boolean; message: string; activity: OwnerActivityEvent[] }> {
  const hasFailedChecks = checklist.some((item) => item.status === 'Failed');
  const message = hasFailedChecks
    ? 'Day cannot be locked while failed checks remain.'
    : 'Day locked successfully.';
  const activity = addOwnerActivity('EOD_LOCK_ATTEMPTED', message, operator);
  return { success: !hasFailedChecks, message, activity };
}

export async function exportEODReportPlaceholder(
  operator?: string
): Promise<{ message: string; activity: OwnerActivityEvent[] }> {
  const message = 'EOD report export prepared.';
  const activity = addOwnerActivity('EOD_REPORT_EXPORT_PREPARED', message, operator);
  return { message, activity };
}
