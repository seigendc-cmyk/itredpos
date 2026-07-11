import { calculateBusinessRiskScore } from './businessRiskScoringService';
import { compareBusinessPeriods, generateDailyBusinessBrief, type BusinessPeriodMetrics } from './dailyBusinessBriefService';
import { createDeterministicBIEventId, type CanonicalBIEvent } from './biEventService';
import { evaluateBIRules, getBIRules } from './biRuleEngine';
import type { BIWarning } from './biWarningService';

export interface BIFoundationVerificationResult { passed: boolean; checks: Array<{ name: string; passed: boolean; detail: string }>; }

/** Pure runtime checks suitable for diagnostics without writing vendor data. */
export function verifyBIFoundation(vendorId = 'verification-vendor'): BIFoundationVerificationResult {
  const now = new Date().toISOString();
  const event = (eventType: CanonicalBIEvent['eventType'], patch: Partial<CanonicalBIEvent> = {}): CanonicalBIEvent => ({ eventId: `EV-${eventType}`, eventType, vendorId, sourceModule: eventType.includes('CASH') ? 'Cash' : eventType.includes('STOCK') ? 'Inventory' : 'Sales', sourceRecordType: 'Verification', sourceRecordId: eventType, occurredAt: now, severity: 'Info', dimensions: {}, summary: `${eventType} verification`, metadata: {}, processingStatus: 'Pending', createdAt: now, ...patch });
  const rules = getBIRules(vendorId); const discount = evaluateBIRules(event('HIGH_DISCOUNT_APPLIED', { dimensions: { percentage: 20 } }), rules); const variance = evaluateBIRules(event('CASH_VARIANCE_FOUND', { dimensions: { variance: 50 } }), rules); const stock = evaluateBIRules(event('LOW_STOCK', { quantity: 2 }), rules);
  const warning: BIWarning = { warningId:'W1', vendorId, sourceEventId:'E1', ruleId:'R1', category:'Cash', title:'Cash variance', summary:'Cash is short by 50.', severity:'Critical', estimatedImpact:50, status:'Open', assignedRole:'Supervisor', dueAt:now, recommendedActions:['Count the drawer again.'], sourceRecordType:'Shift', sourceRecordId:'S1', createdAt:now, updatedAt:now };
  const metrics: BusinessPeriodMetrics = { sales:100, grossProfit:30, transactionCount:5, returns:0, discounts:5, cashVariance:0, stockLoss:0, overdueDebt:0, supplierOverdue:0, deliveryCompleted:2 };
  const checks = [
    { name:'deterministic event ID', passed:createDeterministicBIEventId({vendorId,eventType:'SALE_COMPLETED',sourceModule:'Sales',sourceRecordType:'Sale',sourceRecordId:'S1'}) === createDeterministicBIEventId({vendorId,eventType:'SALE_COMPLETED',sourceModule:'Sales',sourceRecordType:'Sale',sourceRecordId:'S1'}), detail:'Repeated source identity produces one event ID.' },
    { name:'high discount warning', passed:discount.some((m) => m.matched && m.rule.actionType === 'Approval'), detail:'High discount routes to approval.' },
    { name:'cash variance critical', passed:variance.some((m) => m.matched && m.rule.severity === 'Critical'), detail:'Cash variance is critical.' },
    { name:'low stock warning', passed:stock.some((m) => m.matched), detail:'Low stock threshold matches.' },
    { name:'risk scoring explained', passed:calculateBusinessRiskScore(vendorId,'Cash',[warning]).mainDrivers.length === 1, detail:'Risk output includes its driver.' },
    { name:'zero-base comparison safe', passed:compareBusinessPeriods(metrics,{...metrics,sales:0})[0].percentageChange === undefined, detail:'Zero bases do not produce misleading percentages.' },
    { name:'daily brief generated', passed:generateDailyBusinessBrief({vendorId,businessDate:now.slice(0,10),events:[event('SALE_COMPLETED',{amount:100})],warnings:[warning]}).criticalWarnings.length === 1, detail:'Daily brief includes critical action.' }
  ];
  return { passed: checks.every((check) => check.passed), checks };
}
