import {
  mockOperationalApprovalEvents,
  mockOperationalApprovals
} from '../mock/mockPosData';
import {
  ApprovalRelatedModule,
  OperationalApprovalDecision,
  OperationalApprovalEvent,
  OperationalApprovalEventType,
  OperationalApprovalRequest
} from '../types';

const APPROVAL_KEY = 'itred_pos_operational_approvals_v1';
const APPROVAL_EVENT_KEY = 'itred_pos_operational_approval_events_v1';

function readList<T>(key: string, fallback: T[]): T[] {
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(fallback));
      return fallback;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as T[] : fallback;
  } catch {
    localStorage.setItem(key, JSON.stringify(fallback));
    return fallback;
  }
}

function saveList<T>(key: string, value: T[]): T[] {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(key, JSON.stringify(value));
  }
  return value;
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function inferRelatedModule(approval: OperationalApprovalRequest): ApprovalRelatedModule {
  if (approval.relatedModule) return approval.relatedModule;
  if (approval.category.includes('Customer')) return 'Customer';
  if (approval.category.includes('Stock') || approval.category.includes('Inventory')) return 'Inventory';
  if (approval.category.includes('Purchase') || approval.category.includes('Goods') || approval.category.includes('Supplier')) return 'Purchasing';
  if (approval.category.includes('Cash')) return 'Cash Control';
  if (approval.category.includes('Delivery')) return 'Delivery';
  if (approval.category.includes('Terminal')) return 'Terminal';
  return 'Sales';
}

function normalizeApproval(approval: OperationalApprovalRequest): OperationalApprovalRequest {
  return {
    ...approval,
    title: approval.title || approval.approvalType || approval.category,
    priority: approval.priority || (approval.risk === 'Critical' ? 'Urgent' : approval.risk === 'High' ? 'High' : 'Normal'),
    relatedModule: inferRelatedModule(approval),
    relatedRecordId: approval.relatedRecordId || approval.relatedRecord,
    relatedRecordLabel: approval.relatedRecordLabel || approval.relatedRecord,
    valueAmount: approval.valueAmount || Number(String(approval.amountOrValue).replace(/[^0-9.-]+/g, '')) || undefined,
    currency: approval.currency || 'USD',
    dueAt: approval.dueAt || new Date(new Date(approval.requestedAt).getTime() + 24 * 60 * 60 * 1000).toISOString(),
    notificationStatus: approval.notificationStatus || 'Prepared',
    unreadChatCount: approval.unreadChatCount || 0
  };
}

export async function recordApprovalAuditEvent(input: Omit<OperationalApprovalEvent, 'id' | 'createdAt'>): Promise<OperationalApprovalEvent[]> {
  const events = readList<OperationalApprovalEvent>(APPROVAL_EVENT_KEY, mockOperationalApprovalEvents);
  const nextEvent: OperationalApprovalEvent = {
    ...input,
    id: makeId('OP-APR-EV'),
    createdAt: nowIso()
  };
  return saveList(APPROVAL_EVENT_KEY, [nextEvent, ...events].slice(0, 160));
}

async function setApproval(
  approvalId: string,
  updater: (approval: OperationalApprovalRequest, timestamp: string) => OperationalApprovalRequest,
  eventType: OperationalApprovalEventType,
  operator: string,
  message: string
): Promise<OperationalApprovalRequest[]> {
  const approvals = await getOperationalApprovals();
  const timestamp = nowIso();
  const updated = approvals.map((approval) => approval.id === approvalId ? normalizeApproval(updater(approval, timestamp)) : approval);
  saveList(APPROVAL_KEY, updated);
  await recordApprovalAuditEvent({ approvalId, eventType, operator, message });
  return updated;
}

export async function getOperationalApprovals(): Promise<OperationalApprovalRequest[]> {
  const approvals = readList<OperationalApprovalRequest>(APPROVAL_KEY, mockOperationalApprovals).map(normalizeApproval);
  saveList(APPROVAL_KEY, approvals);
  return approvals;
}

export async function getOperationalApprovalEvents(): Promise<OperationalApprovalEvent[]> {
  return readList<OperationalApprovalEvent>(APPROVAL_EVENT_KEY, mockOperationalApprovalEvents);
}

export async function getOperationalApprovalById(approvalId: string): Promise<OperationalApprovalRequest | undefined> {
  return (await getOperationalApprovals()).find((approval) => approval.id === approvalId);
}

export async function createOperationalApproval(
  request: Omit<OperationalApprovalRequest, 'id' | 'status' | 'requestedAt'>
): Promise<OperationalApprovalRequest[]> {
  const approvals = await getOperationalApprovals();
  const nextApproval = normalizeApproval({
    ...request,
    id: makeId('OP-APR'),
    status: 'Pending',
    requestedAt: nowIso()
  });
  await recordApprovalAuditEvent({
    approvalId: nextApproval.id,
    eventType: 'APPROVAL_CREATED',
    operator: request.requestedBy,
    message: `${request.category} approval created.`
  });
  return saveList(APPROVAL_KEY, [nextApproval, ...approvals]);
}

export async function viewOperationalApproval(approvalId: string, operator: string): Promise<OperationalApprovalEvent[]> {
  return recordApprovalAuditEvent({
    approvalId,
    eventType: 'APPROVAL_VIEWED',
    operator,
    message: `Approval ${approvalId} context viewed.`
  });
}

export async function startOperationalApprovalReview(
  approvalId: string,
  operator: string
): Promise<OperationalApprovalRequest[]> {
  return setApproval(
    approvalId,
    (approval, timestamp) => ({
      ...approval,
      status: approval.status === 'Pending' ? 'InReview' : approval.status,
      assignedReviewerName: approval.assignedReviewerName || operator,
      reviewedAt: approval.reviewedAt || timestamp
    }),
    'APPROVAL_REVIEW_STARTED',
    operator,
    `Approval ${approvalId} review started.`
  );
}

export async function requestOperationalApprovalInfo(
  approvalId: string,
  operator: string,
  note: string
): Promise<OperationalApprovalRequest[]> {
  return setApproval(
    approvalId,
    (approval) => ({ ...approval, status: 'MoreInfoRequested', decisionNote: note }),
    'APPROVAL_MORE_INFO_REQUESTED',
    operator,
    note || `More information requested for approval ${approvalId}.`
  );
}

export async function escalateOperationalApproval(
  approvalId: string,
  operator: string,
  note: string
): Promise<OperationalApprovalRequest[]> {
  return setApproval(
    approvalId,
    (approval) => ({ ...approval, status: 'Escalated', priority: 'Urgent', decisionNote: note }),
    'APPROVAL_ESCALATED',
    operator,
    note || `Approval ${approvalId} escalated.`
  );
}

export async function assignOperationalApprovalReviewer(
  approvalId: string,
  operator: string,
  reviewerName: string
): Promise<OperationalApprovalRequest[]> {
  return setApproval(
    approvalId,
    (approval) => ({ ...approval, assignedReviewerName: reviewerName || operator, status: approval.status === 'Pending' ? 'InReview' : approval.status }),
    'APPROVAL_REVIEWER_ASSIGNED',
    operator,
    `Approval ${approvalId} assigned to ${reviewerName || operator}.`
  );
}

export async function decideOperationalApproval(
  approvalId: string,
  decision: OperationalApprovalDecision,
  operator: string,
  decisionNote = ''
): Promise<OperationalApprovalRequest[]> {
  const timestamp = nowIso();
  const approvals = await getOperationalApprovals();
  const updated = approvals.map((approval) => {
    if (approval.id !== approvalId) return approval;
    return normalizeApproval(decision === 'Approved'
      ? {
          ...approval,
          status: 'Approved',
          approvedBy: operator,
          approvedAt: timestamp,
          decidedAt: timestamp,
          decisionBy: operator,
          decisionNote
        }
      : {
          ...approval,
          status: 'Rejected',
          rejectedBy: operator,
          rejectedAt: timestamp,
          decidedAt: timestamp,
          decisionBy: operator,
          decisionNote
        });
  });
  saveList(APPROVAL_KEY, updated);
  await recordApprovalAuditEvent({
    approvalId,
    eventType: decision === 'Approved' ? 'APPROVAL_APPROVED' : 'APPROVAL_REJECTED',
    operator,
    message: decisionNote || `Approval ${approvalId} ${decision.toLowerCase()}.`
  });
  return updated;
}

export async function createApprovalTask(approvalId: string, operator: string, note: string): Promise<OperationalApprovalEvent[]> {
  return recordApprovalAuditEvent({
    approvalId,
    eventType: 'APPROVAL_TASK_CREATED',
    operator,
    message: note || `Task created from approval ${approvalId}.`
  });
}

export async function createApprovalBIWarning(approvalId: string, operator: string, note: string): Promise<OperationalApprovalEvent[]> {
  return recordApprovalAuditEvent({
    approvalId,
    eventType: 'APPROVAL_BI_WARNING_CREATED',
    operator,
    message: note || `BI warning created from approval ${approvalId}.`
  });
}

export async function recordApprovalRelatedRecordOpen(approvalId: string, operator: string): Promise<OperationalApprovalEvent[]> {
  return recordApprovalAuditEvent({
    approvalId,
    eventType: 'APPROVAL_RELATED_RECORD_OPENED',
    operator,
    message: `Related record opened for approval ${approvalId}.`
  });
}

export async function recordApprovalPrint(approvalId: string, operator: string): Promise<OperationalApprovalEvent[]> {
  return recordApprovalAuditEvent({
    approvalId,
    eventType: 'APPROVAL_PRINTED',
    operator,
    message: `Approval ${approvalId} printed.`
  });
}

export async function recordApprovalExport(approvalId: string, operator: string): Promise<OperationalApprovalEvent[]> {
  return recordApprovalAuditEvent({
    approvalId,
    eventType: 'APPROVAL_EXPORTED',
    operator,
    message: `Approval ${approvalId} exported.`
  });
}
