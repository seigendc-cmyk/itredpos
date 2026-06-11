import {
  mockOperationalApprovalEvents,
  mockOperationalApprovals
} from '../mock/mockPosData';
import {
  OperationalApprovalDecision,
  OperationalApprovalEvent,
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

async function recordApprovalEvent(input: Omit<OperationalApprovalEvent, 'id' | 'createdAt'>): Promise<OperationalApprovalEvent[]> {
  const events = readList<OperationalApprovalEvent>(APPROVAL_EVENT_KEY, mockOperationalApprovalEvents);
  const nextEvent: OperationalApprovalEvent = {
    ...input,
    id: makeId('OP-APR-EV'),
    createdAt: nowIso()
  };
  return saveList(APPROVAL_EVENT_KEY, [nextEvent, ...events].slice(0, 80));
}

export async function getOperationalApprovals(): Promise<OperationalApprovalRequest[]> {
  return readList<OperationalApprovalRequest>(APPROVAL_KEY, mockOperationalApprovals);
}

export async function getOperationalApprovalEvents(): Promise<OperationalApprovalEvent[]> {
  return readList<OperationalApprovalEvent>(APPROVAL_EVENT_KEY, mockOperationalApprovalEvents);
}

export async function createOperationalApproval(
  request: Omit<OperationalApprovalRequest, 'id' | 'status' | 'requestedAt'>
): Promise<OperationalApprovalRequest[]> {
  const approvals = await getOperationalApprovals();
  const nextApproval: OperationalApprovalRequest = {
    ...request,
    id: makeId('OP-APR'),
    status: 'Pending',
    requestedAt: nowIso()
  };
  await recordApprovalEvent({
    approvalId: nextApproval.id,
    eventType: 'APPROVAL_CREATED',
    operator: request.requestedBy,
    message: `${request.category} approval created.`
  });
  return saveList(APPROVAL_KEY, [nextApproval, ...approvals]);
}

export async function viewOperationalApproval(approvalId: string, operator: string): Promise<OperationalApprovalEvent[]> {
  return recordApprovalEvent({
    approvalId,
    eventType: 'APPROVAL_VIEWED',
    operator,
    message: `Approval ${approvalId} context viewed.`
  });
}

export async function decideOperationalApproval(
  approvalId: string,
  decision: OperationalApprovalDecision,
  operator: string,
  decisionNote = ''
): Promise<OperationalApprovalRequest[]> {
  const approvals = await getOperationalApprovals();
  const timestamp = nowIso();
  const updated = approvals.map((approval) => {
    if (approval.id !== approvalId) return approval;
    return decision === 'Approved'
      ? {
          ...approval,
          status: 'Approved' as const,
          approvedBy: operator,
          approvedAt: timestamp,
          decisionNote
        }
      : {
          ...approval,
          status: 'Rejected' as const,
          rejectedBy: operator,
          rejectedAt: timestamp,
          decisionNote
        };
  });
  saveList(APPROVAL_KEY, updated);
  await recordApprovalEvent({
    approvalId,
    eventType: decision === 'Approved' ? 'APPROVAL_APPROVED' : 'APPROVAL_REJECTED',
    operator,
    message: `Approval ${approvalId} ${decision.toLowerCase()}.`
  });
  return updated;
}
