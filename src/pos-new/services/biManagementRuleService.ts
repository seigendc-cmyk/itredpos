import { mockBIEvents, mockCustomers, mockProducts, mockRecentSales } from '../mock/mockPosData';
import type {
  BIManagementActionPoint,
  BIManagementActionStatus,
  BIManagementActivityEvent,
  BIManagementAdvice,
  BIManagementDashboardMetric,
  BIManagementInsightPayload,
  BIManagementScoreType,
  BIManagementAdviceStatus,
  BIDomain,
  BIRiskLevel,
  BIRuleDefinition,
  BIRuleEvaluationContext,
  BIRuleTriggerLog,
  BITriggerType,
  CustomerRecord,
  Product,
  Transaction
} from '../types';
import { matchesFreeOrderSearch } from '../utils/searchUtils';

const ACTIVITY_KEY = 'itred_pos_bi_management_activity_v1';
const ADVICE_KEY = 'itred_pos_bi_management_advice_v1';
const TRIGGER_KEY = 'itred_pos_bi_management_triggers_v1';

function nowIso(): string {
  return new Date().toISOString();
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function readList<T>(key: string, fallback: T[] = []): T[] {
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as T[] : fallback;
  } catch {
    return fallback;
  }
}

function saveList<T>(key: string, value: T[]): T[] {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(value));
  } catch {
    return value;
  }
  return value;
}

function productName(product: Product): string {
  return product.productName || product.name;
}

function productSku(product: Product): string {
  return product.sku || product.code;
}

function productQty(product: Product): number {
  return product.availableStock ?? product.qtyOnHand ?? product.stock;
}

function daysSince(dateValue?: string): number {
  if (!dateValue) return 999;
  const time = new Date(dateValue).getTime();
  if (Number.isNaN(time)) return 999;
  return Math.max(0, Math.floor((Date.now() - time) / 86400000));
}

function dueTomorrow(): string {
  return new Date(Date.now() + 86400000).toISOString().slice(0, 10);
}

function riskScore(risk: BIRiskLevel): number {
  if (risk === 'Critical') return 95;
  if (risk === 'High') return 78;
  if (risk === 'Medium') return 52;
  return 25;
}

function scoreRisk(score: number): BIRiskLevel {
  if (score >= 85) return 'Critical';
  if (score >= 65) return 'High';
  if (score >= 40) return 'Medium';
  return 'Low';
}

function routeForDomain(domain: BIDomain): { desk: BIRuleDefinition['assignedDesk']; role: string } {
  if (domain === 'Stock Integrity' || domain === 'Reorder Discipline' || domain === 'Supplier / Purchase Discipline') return { desk: 'Stock Controller Desk', role: 'Stock Controller' };
  if (domain === 'Cash Control') return { desk: 'Cash Control', role: 'Manager' };
  if (domain === 'Staff Behaviour') return { desk: 'Manager Desk', role: 'Manager' };
  if (domain === 'Shift / EOD Control') return { desk: 'Shift Control', role: 'Supervisor' };
  if (domain === 'Delivery Fulfilment') return { desk: 'Delivery Desk', role: 'Delivery Staff' };
  if (domain === 'Customer and Credit Risk') return { desk: 'Customer Centre', role: 'Manager' };
  if (domain === 'Tax / VAT Readiness' || domain === 'Management Profit Snapshot') return { desk: 'Accounting / Finance', role: 'Manager' };
  if (domain === 'Offline Sync Risk') return { desk: 'Sync Desk', role: 'Manager' };
  if (domain === 'Approval Pressure') return { desk: 'Approvals', role: 'Manager' };
  return { desk: 'Manager Desk', role: 'Manager' };
}

function rule(ruleCode: BITriggerType, domain: BIDomain, title: string, riskLevel: BIRiskLevel, triggerConditionNarrative: string, recommendedAction: string, severityWeight: number): BIRuleDefinition {
  const route = routeForDomain(domain);
  const timestamp = '2026-06-13T00:00:00.000Z';
  return {
    ruleId: `BIR-${ruleCode}`,
    ruleCode,
    domain,
    title,
    description: `${title} protects management control in ${domain}.`,
    riskLevel,
    triggerConditionNarrative,
    recommendedAction,
    assignedDesk: route.desk,
    assignedRole: route.role,
    active: true,
    severityWeight,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

const managementRules: BIRuleDefinition[] = [
  rule('DISCOUNT_ABOVE_LIMIT', 'Sales Integrity', 'Discount Above Limit', 'High', 'Discount exceeds configured cashier or supervisor threshold.', 'Manager must review discount and margin leakage.', 8),
  rule('REPEATED_PRICE_OVERRIDE', 'Sales Integrity', 'Repeated Price Override', 'High', 'Staff changes price more than configured threshold in one shift.', 'Review staff override pattern and product price setup.', 8),
  rule('MISCELLANEOUS_SALE_REVIEW', 'Miscellaneous Sales Review', 'Miscellaneous Sale Review', 'Medium', 'Sale includes a non-inventory or miscellaneous line.', 'Classify the item as product, service, or approved one-off sale.', 5),
  rule('RETURN_AFTER_SHORT_TIME', 'Sales Integrity', 'Return After Short Time', 'Medium', 'Return is created soon after the original sale.', 'Review receipt, item condition, and cashier/customer pattern.', 5),
  rule('REPEATED_RECEIPT_REPRINT', 'Sales Integrity', 'Repeated Receipt Reprint', 'Medium', 'Receipt is reprinted more than the configured threshold.', 'Audit receipt history and customer handover proof.', 4),
  rule('ZERO_STOCK_SALE_BLOCKED', 'Stock Integrity', 'Zero Stock Sale Blocked', 'Critical', 'Sale attempts to use item with zero available stock.', 'Block sale or require manager override after stock check.', 10),
  rule('NEGATIVE_STOCK_ATTEMPT', 'Stock Integrity', 'Negative Stock Attempt', 'Critical', 'Sale or adjustment would create negative stock.', 'Stop transaction and run ledger/shelf review.', 10),
  rule('DEAD_STOCK_REORDER_WARNING', 'Reorder Discipline', 'Dead Stock Reorder Warning', 'High', 'Product has stock available but no movement for 30/60/90 days.', 'Block reorder until stock condition and demand are reviewed.', 7),
  rule('SHELF_STOCKTAKE_DUE', 'Stock Integrity', 'Shelf Stocktake Due', 'Medium', 'Shelf appears in rotating monthly count plan.', 'Assign daily shelf stocktake to stock controller.', 5),
  rule('HIGH_VARIANCE_STOCKTAKE', 'Stock Integrity', 'High Variance Stocktake', 'Critical', 'Stocktake variance exceeds allowed quantity or value.', 'Require recount, manager approval, and variance note.', 9),
  rule('DRAWER_VARIANCE', 'Cash Control', 'Drawer Variance', 'Critical', 'Counted cash differs from expected cash.', 'Review sales, refunds, cash drops, and drawer events before EOD.', 10),
  rule('DRAWER_OPEN_TOO_OFTEN', 'Cash Control', 'Drawer Open Too Often', 'High', 'Drawer opens without sale or above frequency threshold.', 'Review drawer log and cashier activity.', 7),
  rule('PAYMENT_METHOD_MISMATCH', 'Cash Control', 'Payment Method Mismatch', 'High', 'Sale says paid but no matching payment line is captured.', 'Hold EOD until payment evidence is fixed.', 7),
  rule('DELIVERY_CASH_PENDING', 'Cash Control', 'Delivery Cash Pending', 'High', 'Delivery cash has not been handed over.', 'Cash Control and Delivery Desk must reconcile handover.', 7),
  rule('REPEATED_FAILED_LOGIN', 'Staff Behaviour', 'Repeated Failed Login', 'High', 'Staff has repeated failed terminal login attempts.', 'Verify identity and lock session if needed.', 7),
  rule('STAFF_OVERRIDE_PATTERN', 'Staff Behaviour', 'Staff Override Pattern', 'High', 'Staff repeatedly overrides price, discount, or stock gates.', 'Manager must review staff behaviour pattern.', 8),
  rule('UNUSUAL_SALE_VOID_PATTERN', 'Staff Behaviour', 'Unusual Sale Void Pattern', 'Medium', 'Staff voids many carts in a short period.', 'Review voided carts and CCTV/drawer events.', 5),
  rule('END_OF_DAY_DELAY', 'Shift / EOD Control', 'End of Day Delay', 'High', 'Shift remains open beyond expected operating duration.', 'Supervisor must close or explain shift delay.', 7),
  rule('DELIVERY_CODE_NOT_VERIFIED', 'Delivery Fulfilment', 'Delivery Code Not Verified', 'High', 'Fulfilment code was not verified.', 'Confirm customer proof before marking delivery complete.', 7),
  rule('DELIVERY_CASH_NOT_CONFIRMED', 'Delivery Fulfilment', 'Delivery Cash Not Confirmed', 'High', 'Delivery cash confirmation is missing.', 'Delivery and Cash Control must reconcile cash handover.', 8),
  rule('DELIVERY_TIME_RISK', 'Delivery Fulfilment', 'Delivery Time Risk', 'Medium', 'Delivery exceeds expected time.', 'Follow up driver and customer confirmation.', 5),
  rule('CREDIT_LIMIT_EXCEEDED', 'Customer and Credit Risk', 'Credit Limit Exceeded', 'High', 'Account sale exceeds customer credit limit.', 'Require approval before account sale proceeds.', 8),
  rule('REPEAT_UNPAID_CUSTOMER', 'Customer and Credit Risk', 'Repeat Unpaid Customer', 'High', 'Customer has repeated unpaid or credit transactions.', 'Review credit account and suspend if needed.', 7),
  rule('SUSPICIOUS_CUSTOMER_RETURNS', 'Customer and Credit Risk', 'Suspicious Customer Returns', 'Medium', 'Customer has repeated returns.', 'Review purchase history and return notes.', 5),
  rule('MISSING_TAX_NUMBER', 'Tax / VAT Readiness', 'Missing Tax Number', 'Medium', 'VAT/business sale has missing customer tax details.', 'Capture tax record before VAT report finalisation.', 5),
  rule('VAT_AMOUNT_INCONSISTENCY', 'Tax / VAT Readiness', 'VAT Amount Inconsistency', 'High', 'VAT amount does not match configured rate.', 'Create VAT review task for finance.', 7),
  rule('EOD_VAT_SUMMARY_MISSING', 'Tax / VAT Readiness', 'EOD VAT Summary Missing', 'High', 'Shift closes without VAT summary.', 'Hold finance review until VAT summary is present.', 7),
  rule('TOO_MANY_PENDING_APPROVALS', 'Approval Pressure', 'Too Many Pending Approvals', 'Medium', 'Pending approvals exceed threshold.', 'Manager must clear approval backlog.', 5),
  rule('HIGH_RISK_APPROVAL_WAITING', 'Approval Pressure', 'High Risk Approval Waiting', 'Critical', 'Critical approval remains pending.', 'Escalate to Owner.', 9),
  rule('OFFLINE_SALES_NOT_SYNCED', 'Offline Sync Risk', 'Offline Sales Not Synced', 'High', 'Offline sales remain unsynced.', 'Sync Desk must flush local queue before EOD.', 8),
  rule('CONFLICT_PENDING', 'Offline Sync Risk', 'Conflict Pending', 'Critical', 'Sync conflict is unresolved.', 'Block EOD finalisation or require owner note.', 9)
];

export function getBIManagementRules(): BIRuleDefinition[] {
  return managementRules;
}

function contextProducts(context: BIRuleEvaluationContext): Product[] {
  return context.products && context.products.length > 0 ? context.products : mockProducts;
}

function contextTransactions(context: BIRuleEvaluationContext): Transaction[] {
  return context.transactions && context.transactions.length > 0 ? context.transactions : mockRecentSales as unknown as Transaction[];
}

function contextCustomers(context: BIRuleEvaluationContext): CustomerRecord[] {
  return context.customerRecords && context.customerRecords.length > 0 ? context.customerRecords : mockCustomers;
}

function baseTrigger(ruleDef: BIRuleDefinition, context: BIRuleEvaluationContext, patch: Partial<BIRuleTriggerLog> = {}): BIRuleTriggerLog {
  return {
    triggerId: makeId('BIMTRG'),
    ruleId: ruleDef.ruleId,
    ruleCode: ruleDef.ruleCode,
    domain: ruleDef.domain,
    title: ruleDef.title,
    narrative: ruleDef.triggerConditionNarrative,
    riskLevel: ruleDef.riskLevel,
    relatedModule: patch.relatedModule || ruleDef.domain,
    branchId: context.branchId || patch.branchId || 'BR-LOCAL',
    branchName: context.branchName || patch.branchName || 'Harare Main',
    terminalId: context.terminalId || patch.terminalId || 'TERM-LOCAL',
    terminalName: context.terminalName || patch.terminalName || 'POS Terminal',
    assignedDesk: ruleDef.assignedDesk,
    assignedRole: ruleDef.assignedRole,
    recommendedAction: ruleDef.recommendedAction,
    createdAt: nowIso(),
    ...patch
  };
}

function getRule(code: BITriggerType): BIRuleDefinition {
  return managementRules.find((item) => item.ruleCode === code) || managementRules[0];
}

export function createTriggerLogFromRule(ruleDef: BIRuleDefinition, context: BIRuleEvaluationContext): BIRuleTriggerLog {
  return baseTrigger(ruleDef, context);
}

function trigger(ruleCode: BITriggerType, context: BIRuleEvaluationContext, patch: Partial<BIRuleTriggerLog> = {}): BIRuleTriggerLog {
  return baseTrigger(getRule(ruleCode), context, patch);
}

function makeActionPoint(adviceId: string, triggerLog: BIRuleTriggerLog): BIManagementActionPoint {
  return {
    actionPointId: makeId('BIMAP'),
    adviceId,
    label: triggerLog.recommendedAction,
    description: `Complete management action for ${triggerLog.title}.`,
    assignedDesk: triggerLog.assignedDesk,
    assignedRole: triggerLog.assignedRole,
    dueDate: triggerLog.riskLevel === 'Critical' ? todayIso() : dueTomorrow(),
    status: 'New'
  };
}

export function createAdviceFromTrigger(triggerLog: BIRuleTriggerLog): BIManagementAdvice {
  const adviceId = `BIMADV-${triggerLog.ruleCode}-${triggerLog.relatedRecordId || triggerLog.productId || triggerLog.customerId || triggerLog.triggerId}`.replace(/[^A-Z0-9-]/gi, '-');
  return {
    adviceId,
    adviceNumber: `BM-${Date.now().toString().slice(-7)}-${triggerLog.ruleCode.slice(0, 4)}`,
    domain: triggerLog.domain,
    title: triggerLog.title,
    narrative: triggerLog.narrative,
    businessRisk: `If ignored, ${triggerLog.domain} control weakness may cause cash leakage, stock loss, compliance gaps, or unapproved management exposure.`,
    recommendedAction: triggerLog.recommendedAction,
    riskLevel: triggerLog.riskLevel,
    priority: triggerLog.riskLevel,
    sourceRuleCode: triggerLog.ruleCode,
    sourceTriggerId: triggerLog.triggerId,
    relatedRecordId: triggerLog.relatedRecordId,
    relatedModule: triggerLog.relatedModule,
    productId: triggerLog.productId,
    productName: triggerLog.productName,
    sku: triggerLog.sku,
    staffId: triggerLog.staffId,
    staffName: triggerLog.staffName,
    customerId: triggerLog.customerId,
    customerName: triggerLog.customerName,
    branchId: triggerLog.branchId,
    branchName: triggerLog.branchName,
    terminalId: triggerLog.terminalId,
    terminalName: triggerLog.terminalName,
    assignedDesk: triggerLog.assignedDesk,
    assignedRole: triggerLog.assignedRole,
    dueDate: triggerLog.riskLevel === 'Critical' ? todayIso() : dueTomorrow(),
    status: 'New',
    actionPoints: [makeActionPoint(adviceId, triggerLog)],
    createdAt: nowIso()
  };
}

function evaluateByCodes(context: BIRuleEvaluationContext, codes: BITriggerType[]): BIRuleTriggerLog[] {
  const products = contextProducts(context);
  const customers = contextCustomers(context);
  const biEvents = context.biEvents && context.biEvents.length > 0 ? context.biEvents : mockBIEvents;
  const logs: BIRuleTriggerLog[] = [];

  codes.forEach((code) => {
    if (code === 'ZERO_STOCK_SALE_BLOCKED' || code === 'NEGATIVE_STOCK_ATTEMPT') {
      products.filter((product) => productQty(product) <= 0).slice(0, 2).forEach((product) => logs.push(trigger(code, context, {
        narrative: `${productName(product)} has zero or negative available stock and needs sale blocking or override review.`,
        relatedModule: 'Inventory',
        relatedRecordId: product.id,
        productId: product.id,
        productName: productName(product),
        sku: productSku(product)
      })));
      return;
    }
    if (code === 'DEAD_STOCK_REORDER_WARNING') {
      products.filter((product) => productQty(product) > 0 && daysSince(product.lastMovementDate) >= 30).slice(0, 4).forEach((product) => logs.push(trigger(code, context, {
        narrative: `${productName(product)} has ${productQty(product)} available with ${daysSince(product.lastMovementDate)} days without movement.`,
        relatedModule: 'Inventory',
        relatedRecordId: product.id,
        productId: product.id,
        productName: productName(product),
        sku: productSku(product)
      })));
      return;
    }
    if (code === 'MISSING_TAX_NUMBER') {
      customers.filter((customer) => customer.customerType !== 'Individual' && !customer.taxNumber).slice(0, 3).forEach((customer) => logs.push(trigger(code, context, {
        narrative: `${customer.customerName} is a business-style customer without tax number on file.`,
        relatedModule: 'Customer Centre',
        relatedRecordId: customer.customerId,
        customerId: customer.customerId,
        customerName: customer.customerName
      })));
      return;
    }
    if (code === 'CREDIT_LIMIT_EXCEEDED' || code === 'REPEAT_UNPAID_CUSTOMER') {
      customers.filter((customer) => (customer.currentBalance || 0) >= (customer.creditLimit || 1) && (customer.creditLimit || 0) > 0).slice(0, 3).forEach((customer) => logs.push(trigger(code, context, {
        narrative: `${customer.customerName} balance is at or above the configured credit limit.`,
        relatedModule: 'Customer Centre',
        relatedRecordId: customer.customerId,
        customerId: customer.customerId,
        customerName: customer.customerName
      })));
      return;
    }
    const eventMatch = biEvents.find((event) => String(event.eventType).includes(code.split('_')[0]) || String(event.eventType).includes('CASH') || String(event.eventType).includes('DELIVERY'));
    logs.push(trigger(code, context, {
      narrative: eventMatch?.payload?.details || eventMatch?.payload?.message || getRule(code).triggerConditionNarrative,
      relatedModule: eventMatch ? 'BI Trigger Logs' : getRule(code).domain,
      relatedRecordId: eventMatch?.id,
      staffName: eventMatch?.operator || context.staffName,
      terminalName: eventMatch?.terminal || context.terminalName || 'POS Terminal'
    }));
  });

  return logs;
}

export function evaluateSalesIntegrityRules(context: BIRuleEvaluationContext): BIRuleTriggerLog[] {
  return evaluateByCodes(context, ['DISCOUNT_ABOVE_LIMIT', 'REPEATED_PRICE_OVERRIDE', 'MISCELLANEOUS_SALE_REVIEW', 'RETURN_AFTER_SHORT_TIME', 'REPEATED_RECEIPT_REPRINT']);
}

export function evaluateStockIntegrityRules(context: BIRuleEvaluationContext): BIRuleTriggerLog[] {
  return evaluateByCodes(context, ['ZERO_STOCK_SALE_BLOCKED', 'NEGATIVE_STOCK_ATTEMPT', 'SHELF_STOCKTAKE_DUE', 'HIGH_VARIANCE_STOCKTAKE']);
}

export function evaluateCashControlRules(context: BIRuleEvaluationContext): BIRuleTriggerLog[] {
  return evaluateByCodes(context, ['DRAWER_VARIANCE', 'DRAWER_OPEN_TOO_OFTEN', 'PAYMENT_METHOD_MISMATCH', 'DELIVERY_CASH_PENDING']);
}

export function evaluateStaffBehaviourRules(context: BIRuleEvaluationContext): BIRuleTriggerLog[] {
  return evaluateByCodes(context, ['REPEATED_FAILED_LOGIN', 'STAFF_OVERRIDE_PATTERN', 'UNUSUAL_SALE_VOID_PATTERN']);
}

export function evaluateShiftEodRules(context: BIRuleEvaluationContext): BIRuleTriggerLog[] {
  return evaluateByCodes(context, ['END_OF_DAY_DELAY']);
}

export function evaluateDeliveryFulfilmentRules(context: BIRuleEvaluationContext): BIRuleTriggerLog[] {
  return evaluateByCodes(context, ['DELIVERY_CODE_NOT_VERIFIED', 'DELIVERY_CASH_NOT_CONFIRMED', 'DELIVERY_TIME_RISK']);
}

export function evaluateCustomerCreditRules(context: BIRuleEvaluationContext): BIRuleTriggerLog[] {
  return evaluateByCodes(context, ['CREDIT_LIMIT_EXCEEDED', 'REPEAT_UNPAID_CUSTOMER', 'SUSPICIOUS_CUSTOMER_RETURNS']);
}

export function evaluateTaxVatReadinessRules(context: BIRuleEvaluationContext): BIRuleTriggerLog[] {
  return evaluateByCodes(context, ['MISSING_TAX_NUMBER', 'VAT_AMOUNT_INCONSISTENCY', 'EOD_VAT_SUMMARY_MISSING']);
}

export function evaluateReorderDisciplineRules(context: BIRuleEvaluationContext): BIRuleTriggerLog[] {
  return evaluateByCodes(context, ['DEAD_STOCK_REORDER_WARNING']);
}

export function evaluateApprovalPressureRules(context: BIRuleEvaluationContext): BIRuleTriggerLog[] {
  return evaluateByCodes(context, ['TOO_MANY_PENDING_APPROVALS', 'HIGH_RISK_APPROVAL_WAITING']);
}

export function evaluateOfflineSyncRiskRules(context: BIRuleEvaluationContext): BIRuleTriggerLog[] {
  return evaluateByCodes(context, ['OFFLINE_SALES_NOT_SYNCED', 'CONFLICT_PENDING']);
}

export function evaluateBIManagementRules(context: BIRuleEvaluationContext = {}): BIManagementInsightPayload {
  const triggerLogs = [
    ...evaluateSalesIntegrityRules(context),
    ...evaluateStockIntegrityRules(context),
    ...evaluateCashControlRules(context),
    ...evaluateStaffBehaviourRules(context),
    ...evaluateShiftEodRules(context),
    ...evaluateDeliveryFulfilmentRules(context),
    ...evaluateCustomerCreditRules(context),
    ...evaluateTaxVatReadinessRules(context),
    ...evaluateReorderDisciplineRules(context),
    ...evaluateApprovalPressureRules(context),
    ...evaluateOfflineSyncRiskRules(context),
    ...evaluateByCodes(context, ['DELIVERY_CASH_PENDING', 'VAT_AMOUNT_INCONSISTENCY'])
  ];
  const savedTriggers = saveList(TRIGGER_KEY, triggerLogs);
  const generatedAdvice = triggerLogs.map(createAdviceFromTrigger);
  const existingAdvice = readList<BIManagementAdvice>(ADVICE_KEY);
  const existingIds = new Set(existingAdvice.map((advice) => advice.sourceTriggerId));
  const advice = saveList(ADVICE_KEY, [
    ...generatedAdvice.filter((item) => !existingIds.has(item.sourceTriggerId)),
    ...existingAdvice
  ].slice(0, 120));
  const actionPoints = advice.flatMap((item) => item.actionPoints);
  const domains = Array.from(new Set(managementRules.map((item) => item.domain)));
  const domainCards = domains.map((domain) => {
    const domainTriggers = savedTriggers.filter((triggerLog) => triggerLog.domain === domain);
    const score = Math.min(100, domainTriggers.reduce((sum, item) => sum + riskScore(item.riskLevel), 0) / Math.max(1, domainTriggers.length));
    const dueActionPoints = actionPoints.filter((point) => point.assignedDesk === routeForDomain(domain).desk && point.status !== 'Resolved').length;
    return {
      domain,
      riskScore: Math.round(score),
      openWarnings: domainTriggers.length,
      dueActionPoints,
      lastTrigger: domainTriggers[0]?.title || 'No trigger',
      riskLevel: scoreRisk(score)
    };
  });
  const metrics: BIManagementDashboardMetric[] = [
    { metricId: 'critical-alerts', label: 'Critical Alerts', value: triggerLogs.filter((item) => item.riskLevel === 'Critical').length, riskLevel: 'Critical', help: 'Critical rule triggers requiring owner/manager action.' },
    { metricId: 'cash-risk', label: 'Cash Risk', value: domainCards.find((item) => item.domain === 'Cash Control')?.riskScore || 0, riskLevel: 'High', help: 'Drawer variance, cash mismatch, and handover exposure.' },
    { metricId: 'stock-risk', label: 'Stock Risk', value: domainCards.find((item) => item.domain === 'Stock Integrity')?.riskScore || 0, riskLevel: 'High', help: 'Zero stock, variance, and shelf count exposure.' },
    { metricId: 'staff-risk', label: 'Staff Risk', value: domainCards.find((item) => item.domain === 'Staff Behaviour')?.riskScore || 0, riskLevel: 'Medium', help: 'Login, override, and void pattern warnings.' },
    { metricId: 'delivery-risk', label: 'Delivery Risk', value: domainCards.find((item) => item.domain === 'Delivery Fulfilment')?.riskScore || 0, riskLevel: 'Medium', help: 'Fulfilment code, cash, and timing warnings.' },
    { metricId: 'tax-warnings', label: 'Tax/VAT Warnings', value: triggerLogs.filter((item) => item.domain === 'Tax / VAT Readiness').length, riskLevel: 'High', help: 'VAT and customer tax readiness warnings.' },
    { metricId: 'pending-action-points', label: 'Pending Action Points', value: actionPoints.filter((point) => point.status !== 'Resolved').length, riskLevel: 'Medium', help: 'Open BI management action points.' },
    { metricId: 'resolved-today', label: 'Resolved Today', value: advice.filter((item) => item.resolvedAt?.startsWith(todayIso())).length, riskLevel: 'Low', help: 'BI management advice resolved today.' }
  ];
  recordBIManagementActivityEvent({ eventType: 'BI_MANAGEMENT_EVALUATED', message: `${triggerLogs.length} management trigger(s) evaluated.` });
  return { metrics, domainCards, triggerLogs: savedTriggers, advice, actionPoints };
}

export async function getBIManagementActivityEvents(): Promise<BIManagementActivityEvent[]> {
  return readList<BIManagementActivityEvent>(ACTIVITY_KEY);
}

export function recordBIManagementActivityEvent(input: Omit<BIManagementActivityEvent, 'eventId' | 'createdAt'>): BIManagementActivityEvent {
  const event: BIManagementActivityEvent = {
    ...input,
    eventId: makeId('BIMACT'),
    createdAt: nowIso()
  };
  saveList(ACTIVITY_KEY, [event, ...readList<BIManagementActivityEvent>(ACTIVITY_KEY)].slice(0, 120));
  return event;
}

export async function updateBIManagementAdviceStatus(adviceId: string, status: BIManagementAdviceStatus, staffId: string, note = ''): Promise<BIManagementAdvice | null> {
  const records = readList<BIManagementAdvice>(ADVICE_KEY);
  let updated: BIManagementAdvice | null = null;
  const next = records.map((record) => {
    if (record.adviceId !== adviceId) return record;
    updated = {
      ...record,
      status,
      resolvedAt: status === 'Resolved' ? nowIso() : record.resolvedAt,
      resolutionNote: note || record.resolutionNote
    };
    return updated;
  });
  saveList(ADVICE_KEY, next);
  if (updated) recordBIManagementActivityEvent({ eventType: `BI_MANAGEMENT_ADVICE_${status.toUpperCase().replace(/\s+/g, '_')}`, adviceId, message: `${updated.adviceNumber} marked ${status}.`, staffId });
  return updated;
}

export async function updateBIManagementActionPoint(actionPointId: string, status: BIManagementActionStatus, staffId: string, note = ''): Promise<BIManagementActionPoint | null> {
  const records = readList<BIManagementAdvice>(ADVICE_KEY);
  let updated: BIManagementActionPoint | null = null;
  const next = records.map((advice) => ({
    ...advice,
    actionPoints: advice.actionPoints.map((point) => {
      if (point.actionPointId !== actionPointId) return point;
      updated = {
        ...point,
        status,
        completedAt: status === 'Resolved' ? nowIso() : point.completedAt,
        completedBy: status === 'Resolved' ? staffId : point.completedBy,
        resultNote: note || point.resultNote
      };
      return updated;
    })
  }));
  saveList(ADVICE_KEY, next);
  if (updated) recordBIManagementActivityEvent({ eventType: 'BI_MANAGEMENT_ACTION_POINT_UPDATED', actionPointId, message: `${updated.label} marked ${status}.`, staffId });
  return updated;
}

export function searchBIManagementAdvice(records: BIManagementAdvice[], query: string): BIManagementAdvice[] {
  return records.filter((record) => matchesFreeOrderSearch(record, query, [
    'domain',
    'sourceRuleCode',
    'title',
    'narrative',
    'riskLevel',
    'productName',
    'sku',
    'staffName',
    'customerName',
    'terminalName',
    'branchName',
    'assignedDesk',
    'assignedRole',
    'status',
    'recommendedAction'
  ]));
}

export function getBIManagementScoreSummary(insight: BIManagementInsightPayload): Array<{ type: BIManagementScoreType; score: number; riskLevel: BIRiskLevel }> {
  return [
    { type: 'Sales', score: insight.domainCards.find((item) => item.domain === 'Sales Integrity')?.riskScore || 0, riskLevel: 'Medium' },
    { type: 'Stock', score: insight.domainCards.find((item) => item.domain === 'Stock Integrity')?.riskScore || 0, riskLevel: 'High' },
    { type: 'Cash', score: insight.domainCards.find((item) => item.domain === 'Cash Control')?.riskScore || 0, riskLevel: 'High' },
    { type: 'Staff', score: insight.domainCards.find((item) => item.domain === 'Staff Behaviour')?.riskScore || 0, riskLevel: 'Medium' },
    { type: 'Delivery', score: insight.domainCards.find((item) => item.domain === 'Delivery Fulfilment')?.riskScore || 0, riskLevel: 'Medium' },
    { type: 'Customer', score: insight.domainCards.find((item) => item.domain === 'Customer and Credit Risk')?.riskScore || 0, riskLevel: 'Medium' },
    { type: 'Tax', score: insight.domainCards.find((item) => item.domain === 'Tax / VAT Readiness')?.riskScore || 0, riskLevel: 'High' },
    { type: 'Shift', score: insight.domainCards.find((item) => item.domain === 'Shift / EOD Control')?.riskScore || 0, riskLevel: 'Medium' }
  ];
}
