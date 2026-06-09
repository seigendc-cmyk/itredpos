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

export async function getOwnerSummary(): Promise<OwnerSummary> {
  return mockOwnerSummary;
}

export async function getEODChecklist(): Promise<EODChecklistItem[]> {
  return readList<EODChecklistItem>(CHECKLIST_KEY, mockEODChecklist);
}

export async function runEODCheck(operator?: string): Promise<EODChecklistItem[]> {
  const refreshed = mockEODChecklist.map((item) => ({ ...item }));
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
