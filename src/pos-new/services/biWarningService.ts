import { getActiveVendorId, readVendorScopedList, writeVendorScopedList } from '../utils/vendorDataMode';
import type { BISeverity, CanonicalBIEvent } from './biEventService';

export type BIWarningStatus = 'Open' | 'Assigned' | 'InProgress' | 'WaitingApproval' | 'Escalated' | 'Resolved' | 'Dismissed' | 'Reopened';
export interface BIWarning {
  warningId: string; vendorId: string; branchId?: string; sourceEventId: string; ruleId: string;
  category: string; title: string; summary: string; severity: BISeverity; estimatedImpact?: number;
  status: BIWarningStatus; assignedRole: string; assignedStaffId?: string; dueAt: string;
  escalatedAt?: string; resolvedAt?: string; resolutionNote?: string; recommendedActions: string[];
  sourceRecordType: string; sourceRecordId: string; createdAt: string; updatedAt: string;
  taskIds?: string[]; approvalRequestId?: string;
}
export interface BIInsight {
  insightId: string; vendorId: string; branchId?: string; sourceEventId: string; category: string;
  title: string; summary: string; recommendedActions: string[]; sourceRecordType: string; sourceRecordId: string; createdAt: string;
}

const WARNINGS_KEY = 'itred_pos_bi_warnings_v1';
const INSIGHTS_KEY = 'itred_pos_bi_insights_v1';
const id = (prefix: string, value: string) => `${prefix}-${value.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 180)}`;

export function getBIWarnings(vendorId = getActiveVendorId()): BIWarning[] {
  return readVendorScopedList<BIWarning>(WARNINGS_KEY, [], vendorId).filter((row) => row.vendorId === vendorId);
}
export function getBIInsights(vendorId = getActiveVendorId()): BIInsight[] {
  return readVendorScopedList<BIInsight>(INSIGHTS_KEY, [], vendorId).filter((row) => row.vendorId === vendorId);
}
export function createWarning(event: CanonicalBIEvent, rule: { ruleId: string; ruleName: string; severity: BISeverity; assignedRole: string; dueInMinutes: number; actionType: string; recommendedActions?: string[] }): BIWarning {
  const warningId = id('BIW', `${event.eventId}-${rule.ruleId}`);
  const existing = getBIWarnings(event.vendorId).find((row) => row.warningId === warningId);
  if (existing) return existing;
  const now = new Date();
  const warning: BIWarning = {
    warningId, vendorId: event.vendorId, branchId: event.branchId, sourceEventId: event.eventId, ruleId: rule.ruleId,
    category: event.sourceModule, title: rule.ruleName, summary: event.summary, severity: rule.severity,
    estimatedImpact: event.amount, status: 'Open', assignedRole: rule.assignedRole,
    dueAt: new Date(now.getTime() + rule.dueInMinutes * 60000).toISOString(),
    recommendedActions: rule.recommendedActions || [businessAction(rule.actionType, event.eventType)],
    sourceRecordType: event.sourceRecordType, sourceRecordId: event.sourceRecordId,
    createdAt: now.toISOString(), updatedAt: now.toISOString()
  };
  writeVendorScopedList(WARNINGS_KEY, [warning, ...getBIWarnings(event.vendorId)], event.vendorId);
  return warning;
}
export function createInsight(event: CanonicalBIEvent, title = event.summary): BIInsight {
  const insightId = id('BII', event.eventId);
  const existing = getBIInsights(event.vendorId).find((row) => row.insightId === insightId);
  if (existing) return existing;
  const insight: BIInsight = { insightId, vendorId: event.vendorId, branchId: event.branchId, sourceEventId: event.eventId, category: event.sourceModule, title, summary: event.summary, recommendedActions: [], sourceRecordType: event.sourceRecordType, sourceRecordId: event.sourceRecordId, createdAt: new Date().toISOString() };
  writeVendorScopedList(INSIGHTS_KEY, [insight, ...getBIInsights(event.vendorId)], event.vendorId);
  return insight;
}
export function updateBIWarning(warningId: string, patch: Partial<BIWarning>, vendorId = getActiveVendorId()): BIWarning | null {
  let changed: BIWarning | null = null;
  const rows = getBIWarnings(vendorId).map((row) => row.warningId === warningId ? (changed = { ...row, ...patch, warningId: row.warningId, vendorId: row.vendorId, updatedAt: new Date().toISOString() }) : row);
  writeVendorScopedList(WARNINGS_KEY, rows, vendorId);
  return changed;
}
function businessAction(actionType: string, eventType: string): string {
  if (actionType === 'Approval') return 'Review the related record and make an authorized decision.';
  if (actionType === 'Task') return `Investigate ${eventType.toLowerCase().replace(/_/g, ' ')} and record the corrective action.`;
  return 'Review the related business record and document the outcome.';
}
