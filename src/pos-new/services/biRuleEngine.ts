import { getActiveVendorId, readVendorScopedList, writeVendorScopedList } from '../utils/vendorDataMode';
import type { BIEventType, BISeverity, CanonicalBIEvent } from './biEventService';
import { getCanonicalBIEvents, updateBIEventProcessing } from './biEventService';
import { createInsight, createWarning, getBIWarnings, updateBIWarning } from './biWarningService';
import { routeBIWarning, type BIActiveStaff } from './biActionRoutingService';

export type BIRuleActionType = 'Warning' | 'Insight' | 'Task' | 'Approval' | 'Escalation';
export interface BIRuleCondition { field?: 'amount' | 'quantity' | 'percentage' | 'count' | 'durationMinutes' | 'variance' | 'ratio' | 'stockDaysRemaining' | 'riskLevel'; operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq'; value?: number | string; }
export interface BIRule { ruleId: string; vendorId: string; ruleName: string; eventType: BIEventType; enabled: boolean; condition: BIRuleCondition; severity: BISeverity; actionType: BIRuleActionType; assignedRole: string; escalationRole: string; dueInMinutes: number; cooldownMinutes: number; threshold?: number; createdAt: string; updatedAt: string; }
export interface BIRuleMatch { rule: BIRule; matched: boolean; reason: string; }
const RULES_KEY = 'itred_pos_bi_rules_v1';

const defaults: Array<Omit<BIRule, 'vendorId' | 'createdAt' | 'updatedAt'>> = [
  ['HIGH_DISCOUNT_APPLIED','Discount above allowed threshold','percentage','gte',15,'High','Approval','Manager','Owner',30,60],
  ['LOW_MARGIN_SALE','Margin below target','percentage','lt',10,'High','Task','Manager','Owner',120,240],
  ['LARGE_SALE','Unusually large sale','amount','gte',1000,'Medium','Warning','Manager','Owner',120,120],
  ['SALE_COMPLETED','Sale completed','amount','gte',0,'Info','Insight','Manager','Owner',1440,0],
  ['CASH_VARIANCE_FOUND','Cash variance above tolerance','variance','gte',10,'Critical','Task','Supervisor','Owner',15,60],
  ['CASH_SHORTAGE','Repeated cash shortage','amount','gte',10,'Critical','Task','Supervisor','Owner',15,60],
  ['CASH_OUT_POSTED','Large cash out','amount','gte',200,'High','Approval','Owner','Owner',30,120],
  ['DRAWER_COUNT_OVERDUE','Drawer count overdue','durationMinutes','gte',30,'High','Task','Supervisor','Owner',15,60],
  ['LOW_STOCK','Stock below reorder level','quantity','lte',5,'High','Task','Stock Controller','Owner',240,720],
  ['OUT_OF_STOCK','Fast-moving product out of stock','quantity','lte',0,'Critical','Task','Stock Controller','Owner',60,240],
  ['STOCKTAKE_VARIANCE','Stocktake variance above tolerance','variance','gte',50,'High','Approval','Manager','Owner',120,240],
  ['STOCK_LOSS_RECORDED','Stock loss above threshold','amount','gte',100,'Critical','Task','Manager','Owner',60,240],
  ['CUSTOMER_OVERDUE','Customer account overdue','durationMinutes','gte',1,'High','Task','Credit Controller','Owner',1440,1440],
  ['CREDIT_LIMIT_EXCEEDED','Customer credit limit exceeded','percentage','gte',100,'High','Approval','Manager','Owner',60,240],
  ['BROKEN_PROMISE_TO_PAY','Promise to pay missed','count','gte',1,'High','Task','Credit Controller','Owner',240,1440],
  ['SUPPLIER_PAYMENT_OVERDUE','Supplier payment overdue','durationMinutes','gte',1,'High','Task','Finance Officer','Owner',1440,1440],
  ['DUPLICATE_SUPPLIER_INVOICE','Possible duplicate supplier invoice','count','gte',1,'Critical','Approval','Finance Officer','Owner',60,1440],
  ['COST_INCREASE_DETECTED','Supplier cost increase above tolerance','percentage','gte',10,'High','Approval','Finance Officer','Owner',240,1440],
  ['DELIVERY_DELAYED','Delivery overdue','durationMinutes','gte',30,'High','Task','Delivery Coordinator','Manager',60,120],
  ['DELIVERY_FAILED','Delivery failed','count','gte',1,'High','Task','Delivery Coordinator','Manager',60,120],
  ['DELIVERY_CASH_NOT_HANDED_OVER','Delivery cash not handed over','durationMinutes','gte',1,'Critical','Task','Delivery Coordinator','Owner',15,60],
  ['DELIVERY_CASH_VARIANCE','Delivery cash handover variance','variance','gte',1,'Critical','Task','Manager','Owner',15,60],
  ['APPROVAL_OVERDUE','Approval overdue','durationMinutes','gte',1,'Critical','Escalation','Manager','Owner',15,60],
  ['TASK_OVERDUE','Task overdue','durationMinutes','gte',1,'High','Escalation','Manager','Owner',30,60],
  ['SYNC_FAILED','Transactions failed to synchronize','count','gte',1,'Critical','Task','Manager','Owner',15,60],
  ['BUSINESS_DAY_LOCK_BLOCKED','Business day lock blocked','count','gte',1,'Critical','Task','Manager','Owner',15,60]
].map(([eventType,ruleName,field,operator,value,severity,actionType,assignedRole,escalationRole,dueInMinutes,cooldownMinutes], index) => ({ ruleId: `SYS-${String(index + 1).padStart(3,'0')}`, ruleName: String(ruleName), eventType: eventType as BIEventType, enabled: true, condition: { field: field as BIRuleCondition['field'], operator: operator as BIRuleCondition['operator'], value: value as number }, threshold: value as number, severity: severity as BISeverity, actionType: actionType as BIRuleActionType, assignedRole: String(assignedRole), escalationRole: String(escalationRole), dueInMinutes: dueInMinutes as number, cooldownMinutes: cooldownMinutes as number }));

export function getBIRules(vendorId = getActiveVendorId()): BIRule[] {
  const stored = readVendorScopedList<BIRule>(RULES_KEY, [], vendorId);
  const now = new Date().toISOString();
  const merged = defaults.map((rule) => stored.find((item) => item.ruleId === rule.ruleId) || { ...rule, vendorId, createdAt: now, updatedAt: now });
  return [...merged, ...stored.filter((item) => !defaults.some((rule) => rule.ruleId === item.ruleId))].filter((rule) => rule.vendorId === vendorId);
}
export function saveBIRule(rule: BIRule, vendorId = getActiveVendorId()): BIRule {
  if (rule.vendorId !== vendorId) throw new Error('Cross-vendor BI rule access is not allowed.');
  const rows = getBIRules(vendorId).filter((item) => item.ruleId !== rule.ruleId);
  const saved = { ...rule, updatedAt: new Date().toISOString() };
  writeVendorScopedList(RULES_KEY, [...rows, saved], vendorId); return saved;
}
export function evaluateBIRules(event: CanonicalBIEvent, rules = getBIRules(event.vendorId)): BIRuleMatch[] {
  return rules.filter((rule) => rule.enabled && rule.vendorId === event.vendorId && rule.eventType === event.eventType).map((rule) => {
    const actual = valueFor(event, rule.condition.field); const expected = rule.condition.value ?? rule.threshold ?? 0;
    const matched = compare(actual, expected, rule.condition.operator);
    return { rule, matched, reason: matched ? `${rule.ruleName}: ${String(actual)} met the configured threshold ${String(expected)}.` : `${rule.ruleName}: threshold not met.` };
  });
}
function valueFor(event: CanonicalBIEvent, field?: BIRuleCondition['field']): number | string {
  if (field === 'amount') return Math.abs(event.amount || 0); if (field === 'quantity') return event.quantity || 0;
  const value = event.dimensions[field || ''] ?? event.metadata[field || '']; return typeof value === 'number' || typeof value === 'string' ? value : 0;
}
function compare(actual: number | string, expected: number | string, operator: BIRuleCondition['operator']): boolean {
  if (operator === 'eq') return actual === expected; const a = Number(actual); const b = Number(expected);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return operator === 'gt' ? a > b : operator === 'gte' ? a >= b : operator === 'lt' ? a < b : a <= b;
}

export interface BIProcessingAdapters {
  activeStaff?: BIActiveStaff[];
  createTask?: (input: { taskId: string; vendorId: string; branchId?: string; warningId: string; title: string; description: string; assignedRole: string; priority: BISeverity; dueAt: string }) => Promise<string> | string;
  createApproval?: (input: { approvalId: string; vendorId: string; branchId?: string; warningId: string; title: string; assignedRole: string; dueAt: string; sourceRecordId: string }) => Promise<string> | string;
}
export async function processPendingBIEvents(adapters: BIProcessingAdapters = {}, vendorId = getActiveVendorId()): Promise<Array<{ eventId: string; result: string }>> {
  const results: Array<{ eventId: string; result: string }> = [];
  for (const event of getCanonicalBIEvents(vendorId).filter((row) => row.processingStatus === 'Pending' || row.processingStatus === 'RetryScheduled')) {
    updateBIEventProcessing(event.eventId, 'Processing', undefined, vendorId);
    try {
      const matches = evaluateBIRules(event).filter((match) => match.matched);
      if (!matches.length) { updateBIEventProcessing(event.eventId, 'Processed', 'No active rule matched.', vendorId); results.push({ eventId: event.eventId, result: 'No match' }); continue; }
      const outputs: string[] = [];
      for (const match of matches) {
        if (match.rule.actionType === 'Insight') { outputs.push(createInsight(event, match.rule.ruleName).insightId); continue; }
        const cutoff = Date.now() - match.rule.cooldownMinutes * 60000;
        const recent = getBIWarnings(vendorId).find((warning) => warning.ruleId === match.rule.ruleId && warning.sourceRecordId === event.sourceRecordId && new Date(warning.createdAt).getTime() >= cutoff);
        if (recent) { outputs.push(`cooldown:${recent.warningId}`); continue; }
        const warning = createWarning(event, match.rule); const route = routeBIWarning(warning, match.rule, adapters.activeStaff);
        if ((match.rule.actionType === 'Task' || match.rule.actionType === 'Escalation') && adapters.createTask) {
          const taskId = await adapters.createTask({ taskId: `BIT-${warning.warningId}`, vendorId, branchId: warning.branchId, warningId: warning.warningId, title: warning.title, description: warning.summary, assignedRole: route.assignedRole, priority: warning.severity, dueAt: warning.dueAt }); updateBIWarning(warning.warningId, { taskIds: [...(warning.taskIds || []), taskId] }, vendorId);
        }
        if (match.rule.actionType === 'Approval' && adapters.createApproval) {
          const approvalRequestId = await adapters.createApproval({ approvalId: `BIA-${warning.warningId}`, vendorId, branchId: warning.branchId, warningId: warning.warningId, title: warning.title, assignedRole: route.assignedRole, dueAt: warning.dueAt, sourceRecordId: warning.sourceRecordId }); updateBIWarning(warning.warningId, { approvalRequestId, status: 'WaitingApproval' }, vendorId);
        }
        outputs.push(warning.warningId);
      }
      const result = outputs.join(', '); updateBIEventProcessing(event.eventId, 'Processed', result, vendorId); results.push({ eventId: event.eventId, result });
    } catch (error) { const reason = error instanceof Error ? error.message : 'BI processing failed.'; updateBIEventProcessing(event.eventId, 'RetryScheduled', reason, vendorId); results.push({ eventId: event.eventId, result: `Retry scheduled: ${reason}` }); }
  }
  return results;
}
