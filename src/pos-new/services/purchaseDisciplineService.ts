import type {
  Product,
  PurchaseCommitmentStatus,
  PurchaseDisciplineRequest,
  PurchaseDisciplineStatus,
  PurchasePressureSignal,
  PurchaseRiskAssessment,
  PurchaseRiskLevel,
  ReorderProtectionDecision,
  ReorderProtectionRule,
  SupplierPurchaseCommitment,
  PurchaseOrder,
  GoodsReceivingNote,
  Sale
} from '../types';
import { mockProducts, mockRecentSales } from '../mock/mockPosData';
import { createOperationalApproval } from './approvalService';
import { createBIAdviceFromTrigger, createBIAdviceTaskFromAdvice } from './biAdviceService';
import { getCOGSReserveSummary } from './cogsReserveService';
import { getSupplierBills, getSupplierCreditProfile, getSupplierCreditProfiles } from './creditorsService';
import { getCustomerDebtRecords } from './customerCreditService';
import { createPurchaseOrder, getPurchaseOrders } from './purchaseOrderService';
import { getGoodsReceivingLines, getGoodsReceivingNotes } from './goodsReceivingService';

const REQUEST_KEY = 'itred_pos_purchase_discipline_requests_v1';
const ASSESSMENT_KEY = 'itred_pos_purchase_risk_assessments_v1';
const COMMITMENT_KEY = 'itred_pos_supplier_purchase_commitments_v1';
const RULE_KEY = 'itred_pos_reorder_protection_rules_v1';
const ACTIVITY_KEY = 'itred_pos_purchase_discipline_activity_v1';
const BI_RULE_KEY = 'itred_pos_purchasing_discipline_bi_rules_v1';

export interface PurchaseDisciplineActivityEvent {
  eventId: string;
  eventType: string;
  message: string;
  sourceReference?: string;
  staffId?: string;
  createdAt: string;
}

type RequestPayload = Omit<PurchaseDisciplineRequest, 'requestId' | 'requestNumber' | 'requestedAt' | 'status' | 'riskLevel' | 'protectionDecision' | 'riskScore' | 'riskNarrative' | 'stockMovementClass' | 'estimatedTotalCost' | 'expectedGrossMarginAmount' | 'expectedGrossMarginPercent'> & {
  requestId?: string;
  requestNumber?: string;
};

export interface PurchasingDisciplineBIRule {
  ruleId: string;
  ruleCode: string;
  title: string;
  active: boolean;
  threshold: number;
  weight: number;
  severity: PurchaseRiskLevel;
  description: string;
}

export interface PurchasingSupplierAnalytics {
  supplierId: string;
  supplierName: string;
  reliabilityScore: number;
  riskScore: number;
  leadTimeScore: number;
  deliveryPerformance: number;
  packagingComplaints: number;
  correctSupplyRate: number;
  recommendation: string;
}

export interface PurchasingProductAnalytics {
  productId: string;
  sku: string;
  productName: string;
  supplierName: string;
  salesVelocity: number;
  purchaseFrequency: number;
  supplierAvailability: number;
  brandTolerance: number;
  marginPerformance: number;
  recommendation: string;
}

export interface COGSReserveBIControl {
  cogsReserveBalance: number;
  supplierCommitments: number;
  cashAvailable: number;
  oneWeekForecast: number;
  twoWeekForecast: number;
  threeWeekForecast: number;
  cogsHealthScore: number;
  cogsHealthStatus: PurchaseRiskLevel;
  summary: string;
}

export interface PurchasingDisciplineBISummary {
  generatedAt: string;
  cogs: COGSReserveBIControl;
  suppliers: PurchasingSupplierAnalytics[];
  products: PurchasingProductAnalytics[];
  rules: PurchasingDisciplineBIRule[];
  drillReports: Array<{ reportId: string; title: string; description: string; riskLevel: PurchaseRiskLevel; count: number }>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function today(): string {
  return nowIso().slice(0, 10);
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function addDays(date: string, days: number): string {
  const next = new Date(`${date}T12:00:00`);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

function readList<T>(key: string, fallback: T[] = []): T[] {
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
    return fallback;
  }
}

function saveList<T>(key: string, value: T[]): T[] {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Local/mock persistence is best-effort.
    }
  }
  return value;
}

function nextNumber(prefix: string, rows: Array<Record<string, string>>, key: string): string {
  const highest = rows.reduce((max, row) => {
    const match = String(row[key] || '').match(new RegExp(`${prefix}-(\\d+)`));
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `${prefix}-${String(highest + 1).padStart(4, '0')}`;
}

function productName(product: Product): string {
  return product.productName || product.name;
}

function productSku(product: Product): string {
  return product.sku || product.code;
}

function productStock(product: Product): number {
  return product.availableStock ?? product.qtyOnHand ?? product.stock ?? 0;
}

function productCost(product: Product): number {
  return product.costPrice ?? product.cost ?? 0;
}

function productPrice(product: Product): number {
  return product.sellingPrice ?? product.price ?? 0;
}

const seedRules: ReorderProtectionRule[] = [
  { ruleId: 'RPR-001', ruleCode: 'REORDER_WITH_INSUFFICIENT_COGS_RESERVE', title: 'Insufficient COGS Reserve', active: true, severity: 'High', threshold: 80, decision: 'RequireApproval', description: 'Purchase weakens protected replacement-stock reserve below safe coverage.' },
  { ruleId: 'RPR-002', ruleCode: 'REORDER_DEAD_STOCK_BLOCK', title: 'Dead Stock Reorder Block', active: true, severity: 'Blocked', threshold: 90, decision: 'Block', description: 'Dead stock cannot be reordered without Owner override.' },
  { ruleId: 'RPR-003', ruleCode: 'REORDER_SLOW_STOCK_WARNING', title: 'Slow Stock Warning', active: true, severity: 'Medium', threshold: 45, decision: 'Warn', description: 'Slow-moving product needs demand review before buying.' },
  { ruleId: 'RPR-004', ruleCode: 'FAST_MOVING_PRODUCT_NOT_REORDERED', title: 'Fast Moving Stockout', active: true, severity: 'High', threshold: 0, decision: 'Warn', description: 'Fast-moving product below reorder level should be replenished.' },
  { ruleId: 'RPR-005', ruleCode: 'LOW_MARGIN_REORDER_RISK', title: 'Low Margin Reorder Risk', active: true, severity: 'High', threshold: 18, decision: 'RequireApproval', description: 'Low margin stock may consume reserve without enough gross profit.' },
  { ruleId: 'RPR-006', ruleCode: 'SUPPLIER_CREDIT_PRESSURE_HIGH', title: 'Supplier Credit Pressure', active: true, severity: 'High', threshold: 80, decision: 'RequireApproval', description: 'Supplier payable balance is near limit or overdue.' },
  { ruleId: 'RPR-007', ruleCode: 'PURCHASE_WHILE_DEBTORS_OVERDUE', title: 'Debtors Overdue Pressure', active: true, severity: 'Medium', threshold: 250, decision: 'Warn', description: 'Major purchase while customer debts are overdue needs review.' },
  { ruleId: 'RPR-008', ruleCode: 'PURCHASE_WITHOUT_APPROVAL', title: 'Purchase Without Approval', active: true, severity: 'Blocked', threshold: 75, decision: 'Block', description: 'High-risk purchase must not convert to PO without approval.' },
  { ruleId: 'RPR-009', ruleCode: 'PO_RAISED_WITHOUT_RESERVE_CHECK', title: 'PO Without Reserve Check', active: true, severity: 'Medium', threshold: 0, decision: 'Warn', description: 'Purchase order should reference a purchase discipline request.' },
  { ruleId: 'RPR-010', ruleCode: 'GRN_RECEIVED_WITHOUT_PURCHASE_DISCIPLINE', title: 'GRN Without Discipline', active: true, severity: 'High', threshold: 0, decision: 'RequireApproval', description: 'Goods received without purchase discipline review.' }
];

const seedBIRules: PurchasingDisciplineBIRule[] = [
  { ruleId: 'PDBI-001', ruleCode: 'SUPPLIER_RELIABILITY_MINIMUM', title: 'Supplier Reliability Minimum', active: true, threshold: 70, weight: 14, severity: 'High', description: 'Flags suppliers with weak payment, delivery or fulfilment reliability.' },
  { ruleId: 'PDBI-002', ruleCode: 'SUPPLIER_RISK_MAXIMUM', title: 'Supplier Risk Maximum', active: true, threshold: 45, weight: 12, severity: 'High', description: 'Raises BI risk when supplier overdue, disputed or credit-pressure score is high.' },
  { ruleId: 'PDBI-003', ruleCode: 'LEAD_TIME_SCORE_MINIMUM', title: 'Lead Time Minimum', active: true, threshold: 65, weight: 8, severity: 'Medium', description: 'Warns when supplier lead-time score does not support urgent replenishment.' },
  { ruleId: 'PDBI-004', ruleCode: 'CORRECT_SUPPLY_RATE_MINIMUM', title: 'Correct Supply Rate Minimum', active: true, threshold: 88, weight: 12, severity: 'High', description: 'Flags suppliers with short supply, damaged goods, wrong products or variance-heavy GRNs.' },
  { ruleId: 'PDBI-005', ruleCode: 'SALES_VELOCITY_REORDER_SIGNAL', title: 'Sales Velocity Reorder Signal', active: true, threshold: 3, weight: 9, severity: 'Medium', description: 'Highlights products selling fast enough to justify earlier reorder checks.' },
  { ruleId: 'PDBI-006', ruleCode: 'MARGIN_PERFORMANCE_MINIMUM', title: 'Margin Performance Minimum', active: true, threshold: 22, weight: 10, severity: 'High', description: 'Protects cash by warning on low-margin purchase decisions.' },
  { ruleId: 'PDBI-007', ruleCode: 'COGS_HEALTH_MINIMUM', title: 'COGS Health Minimum', active: true, threshold: 75, weight: 18, severity: 'Critical', description: 'Blocks aggressive buying when COGS reserve health is below safe threshold.' },
  { ruleId: 'PDBI-008', ruleCode: 'COMMITMENT_PRESSURE_MAXIMUM', title: 'Supplier Commitment Pressure', active: true, threshold: 60, weight: 17, severity: 'High', description: 'Compares active supplier commitments with protected reserve capacity.' }
];

function seedRequests(): PurchaseDisciplineRequest[] {
  const fast = mockProducts.find((product) => product.stock <= (product.reorderLevel ?? product.minStock)) || mockProducts[0];
  const dead = mockProducts.find((product) => product.stockStatus === 'Dead Stock' || product.healthStatus === 'Dead Stock') || mockProducts[1] || fast;
  return [
    buildSeedRequest('PDR-0001', fast, 8, 'SUP-LD', 'Local Distributors', 'Fast-moving product at reorder level. Build Development sample.'),
    buildSeedRequest('PDR-0002', dead, 5, 'SUP-MOTOR', 'Motor Parts Wholesale', 'Dead/slow stock reorder blocked sample.', 'Blocked')
  ];
}

function buildSeedRequest(number: string, product: Product, qty: number, supplierId: string, supplierName: string, reason: string, status: PurchaseDisciplineStatus = 'RiskChecked'): PurchaseDisciplineRequest {
  const estimatedUnitCost = productCost(product) || 10;
  const expectedSellingPrice = productPrice(product) || estimatedUnitCost * 1.35;
  const marginAmount = expectedSellingPrice - estimatedUnitCost;
  const marginPercent = expectedSellingPrice > 0 ? Math.round((marginAmount / expectedSellingPrice) * 100) : 0;
  const movementClass = product.stockStatus === 'Dead Stock' || product.healthStatus === 'Dead Stock' ? 'DeadStock' : product.stockStatus === 'Slow Moving' || product.healthStatus === 'Slow Moving' ? 'SlowMoving' : product.stockStatus === 'Fast Moving' || product.healthStatus === 'Fast Moving' ? 'FastMoving' : productStock(product) <= (product.reorderLevel ?? product.minStock) ? 'FastMoving' : 'Normal';
  const blocked = movementClass === 'DeadStock';
  return {
    requestId: `PDR-ID-${number}`,
    requestNumber: number,
    productId: product.id,
    productName: productName(product),
    sku: productSku(product),
    branchId: product.branchId || 'BR-HARARE',
    branchName: product.branch || 'Harare Main',
    warehouseId: product.warehouseId || product.warehouse || 'WH-HARARE-01',
    supplierId,
    supplierName,
    requestedQty: qty,
    currentStockQty: productStock(product),
    reorderLevel: product.reorderLevel ?? product.minStock,
    suggestedReorderQty: (product as Product & { reorderQty?: number }).reorderQty || qty,
    estimatedUnitCost,
    estimatedTotalCost: qty * estimatedUnitCost,
    expectedSellingPrice,
    expectedGrossMarginAmount: marginAmount,
    expectedGrossMarginPercent: marginPercent,
    stockMovementClass: movementClass,
    requestedBy: 'Build 19AQ',
    requestedAt: nowIso(),
    reason,
    status,
    riskLevel: blocked ? 'Blocked' : 'Medium',
    protectionDecision: blocked ? 'Block' : 'Warn',
    riskScore: blocked ? 100 : 45,
    riskNarrative: reason,
    notes: 'Build Development local purchase discipline sample.'
  };
}

function recordActivity(eventType: string, message: string, sourceReference?: string, staffId?: string): PurchaseDisciplineActivityEvent {
  const event: PurchaseDisciplineActivityEvent = { eventId: makeId('PD-ACT'), eventType, message, sourceReference, staffId, createdAt: nowIso() };
  saveList(ACTIVITY_KEY, [event, ...readList<PurchaseDisciplineActivityEvent>(ACTIVITY_KEY)].slice(0, 160));
  return event;
}

function riskFromScore(score: number, blocked = false): PurchaseRiskLevel {
  if (blocked) return 'Blocked';
  if (score <= 20) return 'Low';
  if (score <= 50) return 'Medium';
  if (score <= 75) return 'High';
  return 'Critical';
}

function decisionFromRisk(risk: PurchaseRiskLevel): ReorderProtectionDecision {
  if (risk === 'Blocked') return 'Block';
  if (risk === 'Critical' || risk === 'High') return 'RequireApproval';
  if (risk === 'Medium') return 'Warn';
  return 'Allow';
}

async function createPurchaseApproval(input: { approvalType: string; relatedRecord: string; requestedBy: string; reason: string; amount: number; risk: PurchaseRiskLevel }) {
  return createOperationalApproval({
    vendorId: 'SCI-LOG-ZW',
    branchId: 'BR-HARARE',
    branch: 'Harare Main',
    category: 'Purchase Order',
    requestedBy: input.requestedBy,
    requestedByRole: 'Manager',
    relatedRecord: input.relatedRecord,
    amountOrValue: `USD ${input.amount.toFixed(2)}`,
    risk: input.risk === 'Blocked' ? 'Critical' : input.risk === 'Low' ? 'Low' : input.risk === 'Medium' ? 'Medium' : 'High',
    reason: input.reason,
    context: 'Build 19AQ local/mock purchase discipline approval placeholder.',
    approvalType: input.approvalType,
    requiredPermission: 'approvals.approve'
  });
}

async function createPurchaseBI(eventType: string, description: string, severity: PurchaseRiskLevel = 'High', sourceReference?: string) {
  const advice = await createBIAdviceFromTrigger({
    id: sourceReference || makeId('PD-BI'),
    eventType,
    domain: 'Purchase Discipline',
    severity: severity === 'Blocked' ? 'Critical' : severity,
    description,
    recommendedAction: 'Review purchase discipline risk, reserve coverage, supplier exposure and approval status before buying stock.',
    notes: description
  });
  if (severity === 'High' || severity === 'Critical' || severity === 'Blocked') await createBIAdviceTaskFromAdvice(advice);
  recordActivity('PURCHASE_BI_WARNING_CREATED', `${eventType}: ${description}`, sourceReference);
  return advice;
}

export function getPurchaseDisciplineRequests(filters: Partial<{ search: string; status: PurchaseDisciplineStatus | 'ALL'; riskLevel: PurchaseRiskLevel | 'ALL' }> = {}): PurchaseDisciplineRequest[] {
  return readList<PurchaseDisciplineRequest>(REQUEST_KEY, seedRequests()).filter((request) => {
    const haystack = `${request.requestNumber} ${request.productName} ${request.sku} ${request.supplierName || ''} ${request.status} ${request.riskLevel} ${request.riskNarrative} ${request.notes}`.toLowerCase();
    const words = (filters.search || '').toLowerCase().split(/\s+/).filter(Boolean);
    return words.every((word) => haystack.includes(word))
      && (!filters.status || filters.status === 'ALL' || request.status === filters.status)
      && (!filters.riskLevel || filters.riskLevel === 'ALL' || request.riskLevel === filters.riskLevel);
  }).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
}

export function getPurchaseDisciplineRequest(requestId: string): PurchaseDisciplineRequest | null {
  return getPurchaseDisciplineRequests().find((request) => request.requestId === requestId) || null;
}

export function calculateProductMovementClass(productId: string): PurchaseDisciplineRequest['stockMovementClass'] {
  const product = mockProducts.find((item) => item.id === productId);
  if (!product) return 'Unknown';
  if (product.stockStatus === 'Dead Stock' || product.healthStatus === 'Dead Stock') return 'DeadStock';
  if (product.stockStatus === 'Slow Moving' || product.healthStatus === 'Slow Moving') return 'SlowMoving';
  if (product.stockStatus === 'Fast Moving' || product.healthStatus === 'Fast Moving') return 'FastMoving';
  if (productStock(product) <= (product.reorderLevel ?? product.minStock)) return 'FastMoving';
  return 'Normal';
}

export function calculateProductMarginRisk(productId: string): number {
  const product = mockProducts.find((item) => item.id === productId);
  if (!product) return 25;
  const price = productPrice(product);
  const cost = productCost(product);
  if (price <= 0 || cost <= 0) return 25;
  const marginPercent = ((price - cost) / price) * 100;
  if (marginPercent < 10) return 30;
  if (marginPercent < 18) return 22;
  if (marginPercent < 30) return 12;
  return 4;
}

export function calculateSupplierCreditPressure(supplierId?: string): { score: number; payable: number; limit: number; usage: number; overdueBills: number } {
  if (!supplierId) return { score: 8, payable: 0, limit: 0, usage: 0, overdueBills: 0 };
  const profile = getSupplierCreditProfile(supplierId);
  if (!profile) return { score: 12, payable: 0, limit: 0, usage: 0, overdueBills: 0 };
  const usage = profile.supplierCreditLimit > 0 ? Math.round((profile.currentPayableBalance / profile.supplierCreditLimit) * 100) : 0;
  const overdueBills = getSupplierBills({ supplierId }).filter((bill) => bill.overdueDays > 0 && bill.outstandingAmount > 0).length;
  const score = usage >= 95 || overdueBills > 2 ? 25 : usage >= 80 || overdueBills > 0 ? 18 : usage >= 60 ? 10 : 4;
  return { score, payable: profile.currentPayableBalance, limit: profile.supplierCreditLimit, usage, overdueBills };
}

export function calculateCOGSReservePressure(estimatedTotalCost: number): { score: number; before: number; required: number; after: number; coverage: number } {
  const summary = getCOGSReserveSummary();
  const after = Number((summary.currentReserveBalance - estimatedTotalCost).toFixed(2));
  const coverage = summary.requiredReserveLevel > 0 ? Math.round((after / summary.requiredReserveLevel) * 100) : 100;
  const score = after < 0 ? 30 : coverage < 25 ? 26 : coverage < 50 ? 20 : coverage < 80 ? 12 : 3;
  return { score, before: summary.currentReserveBalance, required: estimatedTotalCost, after, coverage };
}

export function calculateDebtorPressure(): { score: number; overdueTotal: number } {
  const records = getCustomerDebtRecords() as unknown;
  const overdueTotal = Array.isArray(records)
    ? records.filter((debt) => debt.overdueDays > 0 && debt.outstandingAmount > 0).reduce((sum, debt) => sum + debt.outstandingAmount, 0)
    : 0;
  return { score: overdueTotal > 1500 ? 16 : overdueTotal > 500 ? 10 : overdueTotal > 0 ? 6 : 0, overdueTotal };
}

export function calculateCashPressure(): { score: number; cashAvailable: number } {
  const reserve = getCOGSReserveSummary();
  const cashAvailable = Math.max(0, reserve.currentReserveBalance - reserve.requiredReserveLevel * 0.5);
  return { score: cashAvailable <= 0 ? 12 : cashAvailable < 500 ? 6 : 0, cashAvailable };
}

export function calculatePurchaseRiskScore(inputs: { movement: PurchaseDisciplineRequest['stockMovementClass']; marginScore: number; supplierScore: number; cashScore: number; debtorScore: number; reserveScore: number }): number {
  const movementScore = inputs.movement === 'DeadStock' ? 35 : inputs.movement === 'SlowMoving' ? 18 : inputs.movement === 'Unknown' ? 10 : inputs.movement === 'FastMoving' ? 0 : 5;
  return Math.min(100, Math.round(movementScore + inputs.marginScore + inputs.supplierScore + inputs.cashScore + inputs.debtorScore + inputs.reserveScore));
}

export function runReorderProtectionRules(payload: Pick<PurchaseDisciplineRequest, 'stockMovementClass' | 'estimatedTotalCost' | 'expectedGrossMarginPercent' | 'supplierId'>): { decision: ReorderProtectionDecision; warnings: string[]; signals: PurchasePressureSignal[]; blocked: boolean } {
  const rules = getReorderProtectionRules().filter((rule) => rule.active);
  const reserve = calculateCOGSReservePressure(payload.estimatedTotalCost);
  const supplier = calculateSupplierCreditPressure(payload.supplierId);
  const debtors = calculateDebtorPressure();
  const warnings: string[] = [];
  const signals: PurchasePressureSignal[] = [];
  let decision: ReorderProtectionDecision = 'Allow';
  let blocked = false;
  const raise = (ruleCode: string, signal: PurchasePressureSignal) => {
    const rule = rules.find((item) => item.ruleCode === ruleCode);
    if (!rule) return;
    warnings.push(rule.title);
    signals.push(signal);
    if (rule.decision === 'Block') blocked = true;
    if (rule.decision === 'RequireApproval' && decision !== 'Block') decision = 'RequireApproval';
    if (rule.decision === 'Warn' && decision === 'Allow') decision = 'Warn';
    recordActivity('REORDER_PROTECTION_RULE_TRIGGERED', `${rule.ruleCode}: ${rule.description}`, rule.ruleId);
  };
  if (reserve.after < 0 || reserve.coverage < 80) raise('REORDER_WITH_INSUFFICIENT_COGS_RESERVE', 'COGSReserveLow');
  if (payload.stockMovementClass === 'DeadStock') raise('REORDER_DEAD_STOCK_BLOCK', 'DeadStock');
  if (payload.stockMovementClass === 'SlowMoving') raise('REORDER_SLOW_STOCK_WARNING', 'SlowStock');
  if ((payload.expectedGrossMarginPercent || 0) < 18) raise('LOW_MARGIN_REORDER_RISK', 'LowMargin');
  if (supplier.usage >= 80 || supplier.overdueBills > 0) raise('SUPPLIER_CREDIT_PRESSURE_HIGH', 'SupplierCreditHigh');
  if (debtors.overdueTotal > 250) raise('PURCHASE_WHILE_DEBTORS_OVERDUE', 'DebtorsOverdue');
  if (blocked) decision = 'Block';
  return { decision, warnings, signals, blocked };
}

export function previewPurchaseRisk(payload: RequestPayload): PurchaseRiskAssessment {
  const product = mockProducts.find((item) => item.id === payload.productId);
  const estimatedTotalCost = Math.max(0, payload.requestedQty * payload.estimatedUnitCost);
  const expectedSellingPrice = payload.expectedSellingPrice ?? (product ? productPrice(product) : payload.estimatedUnitCost * 1.35);
  const grossMarginAmount = expectedSellingPrice - payload.estimatedUnitCost;
  const grossMarginPercent = expectedSellingPrice > 0 ? Math.round((grossMarginAmount / expectedSellingPrice) * 100) : 0;
  const movement = calculateProductMovementClass(payload.productId);
  const marginScore = grossMarginPercent < 18 ? 22 : calculateProductMarginRisk(payload.productId);
  const supplier = calculateSupplierCreditPressure(payload.supplierId);
  const reserve = calculateCOGSReservePressure(estimatedTotalCost);
  const debtors = calculateDebtorPressure();
  const cash = calculateCashPressure();
  const totalRiskScore = calculatePurchaseRiskScore({ movement, marginScore, supplierScore: supplier.score, cashScore: cash.score, debtorScore: debtors.score, reserveScore: reserve.score });
  const ruleResult = runReorderProtectionRules({ stockMovementClass: movement, estimatedTotalCost, expectedGrossMarginPercent: grossMarginPercent, supplierId: payload.supplierId });
  const riskLevel = riskFromScore(totalRiskScore, ruleResult.blocked);
  const decision = ruleResult.decision === 'Allow' ? decisionFromRisk(riskLevel) : ruleResult.decision;
  return {
    assessmentId: makeId('PRA'),
    requestId: payload.requestId || 'PREVIEW',
    assessedAt: nowIso(),
    assessedBy: payload.requestedBy,
    productId: payload.productId,
    supplierId: payload.supplierId,
    cogsReserveBefore: reserve.before,
    cogsReserveRequired: reserve.required,
    cogsReserveAfter: reserve.after,
    reserveCoveragePercent: reserve.coverage,
    supplierPayableBalance: supplier.payable,
    supplierCreditLimit: supplier.limit,
    supplierCreditUsagePercent: supplier.usage,
    overdueSupplierBills: supplier.overdueBills,
    overdueDebtorsTotal: debtors.overdueTotal,
    cashAvailable: cash.cashAvailable,
    productMovementScore: movement === 'DeadStock' ? 35 : movement === 'SlowMoving' ? 18 : movement === 'FastMoving' ? 0 : 5,
    productMarginScore: marginScore,
    supplierRiskScore: supplier.score,
    cashPressureScore: cash.score,
    debtorPressureScore: debtors.score,
    reserveRiskScore: reserve.score,
    totalRiskScore,
    riskLevel,
    decision,
    warnings: ruleResult.warnings,
    recommendedAction: decision === 'Block' ? 'Block purchase until Owner override and demand proof.' : decision === 'RequireApproval' ? 'Route to Manager/Owner approval before buying.' : decision === 'Warn' ? 'Review reserve, supplier and stock movement pressure before proceeding.' : 'Purchase can proceed under normal controls.'
  };
}

export async function createPurchaseDisciplineRequest(payload: RequestPayload): Promise<PurchaseDisciplineRequest> {
  const requests = getPurchaseDisciplineRequests();
  const product = mockProducts.find((item) => item.id === payload.productId);
  const preview = previewPurchaseRisk(payload);
  const expectedSellingPrice = payload.expectedSellingPrice ?? (product ? productPrice(product) : payload.estimatedUnitCost * 1.35);
  const grossMarginAmount = expectedSellingPrice - payload.estimatedUnitCost;
  const request: PurchaseDisciplineRequest = {
    ...payload,
    requestId: payload.requestId || makeId('PDR-ID'),
    requestNumber: payload.requestNumber || nextNumber('PDR', requests, 'requestNumber'),
    productName: payload.productName || (product ? productName(product) : 'Unknown Product'),
    sku: payload.sku || (product ? productSku(product) : ''),
    currentStockQty: payload.currentStockQty ?? (product ? productStock(product) : 0),
    reorderLevel: payload.reorderLevel ?? product?.reorderLevel ?? product?.minStock,
    suggestedReorderQty: payload.suggestedReorderQty ?? (product as Product & { reorderQty?: number } | undefined)?.reorderQty ?? payload.requestedQty,
    estimatedTotalCost: payload.requestedQty * payload.estimatedUnitCost,
    expectedSellingPrice,
    expectedGrossMarginAmount: grossMarginAmount,
    expectedGrossMarginPercent: expectedSellingPrice > 0 ? Math.round((grossMarginAmount / expectedSellingPrice) * 100) : 0,
    stockMovementClass: calculateProductMovementClass(payload.productId),
    requestedAt: nowIso(),
    status: preview.decision === 'Block' ? 'Blocked' : 'RiskChecked',
    riskLevel: preview.riskLevel,
    protectionDecision: preview.decision,
    riskScore: preview.totalRiskScore,
    riskNarrative: preview.warnings.length ? preview.warnings.join('; ') : preview.recommendedAction
  };
  saveList(REQUEST_KEY, [request, ...requests]);
  saveList(ASSESSMENT_KEY, [{ ...preview, requestId: request.requestId }, ...readList<PurchaseRiskAssessment>(ASSESSMENT_KEY)].slice(0, 160));
  recordActivity('PURCHASE_DISCIPLINE_REQUEST_CREATED', `${request.requestNumber} created for ${request.productName}.`, request.requestId, request.requestedBy);
  if (request.protectionDecision === 'RequireApproval' || request.protectionDecision === 'Block' || request.riskLevel === 'High' || request.riskLevel === 'Critical') {
    const approvalType = request.stockMovementClass === 'DeadStock' ? 'DEAD_STOCK_REORDER_OVERRIDE' : request.estimatedTotalCost > preview.cogsReserveBefore ? 'INSUFFICIENT_RESERVE_PURCHASE_APPROVAL' : 'HIGH_RISK_REORDER_APPROVAL';
    const approvals = await createPurchaseApproval({ approvalType, relatedRecord: request.requestNumber, requestedBy: request.requestedBy, reason: request.riskNarrative, amount: request.estimatedTotalCost, risk: request.riskLevel });
    const approvalId = approvals[0]?.id;
    request.approvalId = approvalId;
    request.status = request.protectionDecision === 'Block' ? 'Blocked' : 'PendingApproval';
    saveList(REQUEST_KEY, [request, ...requests]);
    await createPurchaseBI(approvalType, `${request.requestNumber} requires approval: ${request.riskNarrative}`, request.riskLevel, request.requestId);
  }
  return request;
}

export function updatePurchaseDisciplineRequest(requestId: string, patch: Partial<PurchaseDisciplineRequest>): PurchaseDisciplineRequest | null {
  let updated: PurchaseDisciplineRequest | null = null;
  saveList(REQUEST_KEY, getPurchaseDisciplineRequests().map((request) => {
    if (request.requestId !== requestId) return request;
    updated = { ...request, ...patch };
    return updated;
  }));
  return updated;
}

export async function assessPurchaseRequestRisk(requestId: string): Promise<PurchaseRiskAssessment | null> {
  const request = getPurchaseDisciplineRequest(requestId);
  if (!request) return null;
  const assessment = previewPurchaseRisk(request);
  const finalAssessment = { ...assessment, requestId };
  saveList(ASSESSMENT_KEY, [finalAssessment, ...readList<PurchaseRiskAssessment>(ASSESSMENT_KEY).filter((row) => row.requestId !== requestId)].slice(0, 160));
  updatePurchaseDisciplineRequest(requestId, { riskScore: finalAssessment.totalRiskScore, riskLevel: finalAssessment.riskLevel, protectionDecision: finalAssessment.decision, riskNarrative: finalAssessment.warnings.join('; ') || finalAssessment.recommendedAction, status: finalAssessment.decision === 'Block' ? 'Blocked' : 'RiskChecked' });
  recordActivity('PURCHASE_RISK_ASSESSED', `${request.requestNumber} risk assessed as ${finalAssessment.riskLevel}.`, requestId, finalAssessment.assessedBy);
  return finalAssessment;
}

export function getPurchaseRiskAssessment(requestId: string): PurchaseRiskAssessment | null {
  return readList<PurchaseRiskAssessment>(ASSESSMENT_KEY).find((assessment) => assessment.requestId === requestId) || null;
}

export async function approvePurchaseDisciplineRequest(requestId: string, staffId: string, note: string): Promise<PurchaseDisciplineRequest | null> {
  const updated = updatePurchaseDisciplineRequest(requestId, { status: 'Approved', notes: `${getPurchaseDisciplineRequest(requestId)?.notes || ''} Approved: ${note}`.trim() });
  if (updated) recordActivity('PURCHASE_REQUEST_APPROVED', `${updated.requestNumber} approved.`, requestId, staffId);
  return updated;
}

export async function rejectPurchaseDisciplineRequest(requestId: string, reason: string, staffId: string): Promise<PurchaseDisciplineRequest | null> {
  const updated = updatePurchaseDisciplineRequest(requestId, { status: 'Rejected', notes: `${getPurchaseDisciplineRequest(requestId)?.notes || ''} Rejected: ${reason}`.trim() });
  if (updated) recordActivity('PURCHASE_REQUEST_REJECTED', `${updated.requestNumber} rejected.`, requestId, staffId);
  return updated;
}

export async function cancelPurchaseDisciplineRequest(requestId: string, reason: string, staffId: string): Promise<PurchaseDisciplineRequest | null> {
  const updated = updatePurchaseDisciplineRequest(requestId, { status: 'Cancelled', notes: `${getPurchaseDisciplineRequest(requestId)?.notes || ''} Cancelled: ${reason}`.trim() });
  if (updated) recordActivity('PURCHASE_REQUEST_REJECTED', `${updated.requestNumber} cancelled.`, requestId, staffId);
  return updated;
}

export async function createSupplierPurchaseCommitment(payload: Omit<SupplierPurchaseCommitment, 'commitmentId' | 'commitmentNumber' | 'createdAt'> & { commitmentId?: string; commitmentNumber?: string }): Promise<SupplierPurchaseCommitment> {
  const rows = getSupplierPurchaseCommitments();
  const existing = rows.find((row) => payload.sourceRequestId && row.sourceRequestId === payload.sourceRequestId && row.status !== 'Cancelled');
  if (existing) return existing;
  if (payload.amount > payload.reserveAvailableAtCreation) {
    await createPurchaseBI('PURCHASE_COMMITMENTS_EXCEED_RESERVE', `${payload.supplierName} commitment exceeds available COGS reserve.`, payload.riskLevel, payload.sourceRequestId);
    await createPurchaseApproval({ approvalType: 'PURCHASE_COMMITMENT_APPROVAL', relatedRecord: payload.sourceRequestId || payload.supplierName, requestedBy: payload.createdBy, reason: 'Purchase commitment exceeds reserve or threshold.', amount: payload.amount, risk: payload.riskLevel });
  }
  const commitment: SupplierPurchaseCommitment = { ...payload, commitmentId: payload.commitmentId || makeId('SPC-ID'), commitmentNumber: payload.commitmentNumber || nextNumber('SPC', rows, 'commitmentNumber'), createdAt: nowIso() };
  saveList(COMMITMENT_KEY, [commitment, ...rows]);
  if (payload.sourceRequestId) updatePurchaseDisciplineRequest(payload.sourceRequestId, { linkedCommitmentId: commitment.commitmentId });
  recordActivity('PURCHASE_COMMITMENT_CREATED', `${commitment.commitmentNumber} created for ${commitment.supplierName}.`, commitment.commitmentId, commitment.createdBy);
  return commitment;
}

export function getSupplierPurchaseCommitments(filters: Partial<{ search: string; status: PurchaseCommitmentStatus | 'ALL' }> = {}): SupplierPurchaseCommitment[] {
  return readList<SupplierPurchaseCommitment>(COMMITMENT_KEY, [
    { commitmentId: 'SPC-ID-0001', commitmentNumber: 'SPC-0001', sourceRequestId: 'PDR-ID-PDR-0001', supplierId: 'SUP-LD', supplierName: 'Local Distributors', productId: mockProducts[0]?.id, productName: productName(mockProducts[0]), commitmentDate: today(), dueDate: addDays(today(), 14), amount: 280, reserveNeeded: 280, reserveAvailableAtCreation: getCOGSReserveSummary().currentReserveBalance, status: 'Active', riskLevel: 'Medium', approvedBy: 'Manager', approvedAt: nowIso(), createdBy: 'Build 19AQ', createdAt: nowIso(), notes: 'Build Development approved purchase commitment.' }
  ]).filter((commitment) => {
    const haystack = `${commitment.commitmentNumber} ${commitment.supplierName} ${commitment.productName || ''} ${commitment.status} ${commitment.riskLevel} ${commitment.notes}`.toLowerCase();
    const words = (filters.search || '').toLowerCase().split(/\s+/).filter(Boolean);
    return words.every((word) => haystack.includes(word)) && (!filters.status || filters.status === 'ALL' || commitment.status === filters.status);
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function convertRequestToPurchaseOrder(requestId: string) {
  const request = getPurchaseDisciplineRequest(requestId);
  if (!request) return null;
  if (request.protectionDecision === 'Block' || (['High', 'Critical', 'Blocked'].includes(request.riskLevel) && request.status !== 'Approved')) {
    await createPurchaseApproval({ approvalType: 'PURCHASE_WITHOUT_APPROVAL', relatedRecord: request.requestNumber, requestedBy: request.requestedBy, reason: 'Blocked or high-risk request cannot convert without approval.', amount: request.estimatedTotalCost, risk: request.riskLevel });
    await createPurchaseBI('PURCHASE_WITHOUT_APPROVAL', `${request.requestNumber} attempted PO conversion without approval.`, request.riskLevel, request.requestId);
    return null;
  }
  const po = await createPurchaseOrder({
    vendorId: 'SCI-LOG-ZW',
    branchId: request.branchId,
    warehouseId: request.warehouseId || 'WH-HARARE-01',
    supplierId: request.supplierId || 'SUP-LOCAL',
    supplierName: request.supplierName || 'Local Supplier',
    supplierPhone: '',
    supplierEmail: '',
    supplierAddress: '',
    supplierContactPerson: '',
    requestedByStaffId: request.requestedBy,
    requestedByStaffName: request.requestedBy,
    poDate: today(),
    expectedDeliveryDate: addDays(today(), 7),
    priority: request.riskLevel === 'Low' ? 'Normal' : 'High',
    source: 'Manual',
    status: 'Draft',
    deliveryBranchId: request.branchId,
    deliveryWarehouseId: request.warehouseId || 'WH-HARARE-01',
    deliveryAddress: request.branchName,
    currency: 'USD',
    deliveryCostEstimate: 0,
    notes: `Linked Purchase Discipline Request ${request.requestNumber}. Risk ${request.riskLevel}.`,
    internalMemo: request.riskNarrative,
    termsAndConditions: 'Local/mock purchase discipline conversion. No stock or accounting posted.',
    lines: [{
      productId: request.productId,
      sku: request.sku,
      productName: request.productName,
      brand: '',
      manufacturer: '',
      unitOfMeasure: 'pcs',
      qtyOrdered: request.requestedQty,
      qtyReceived: 0,
      estimatedUnitCost: request.estimatedUnitCost,
      lastCostPrice: request.estimatedUnitCost,
      currentSellingPrice: request.expectedSellingPrice,
      shelfLocation: '',
      notes: `From ${request.requestNumber}`
    }]
  });
  updatePurchaseDisciplineRequest(requestId, { status: 'ConvertedToPO', linkedPurchaseOrderId: po.poId });
  const commitment = await createSupplierPurchaseCommitment({ sourceRequestId: requestId, purchaseOrderId: po.poId, supplierId: request.supplierId || 'SUP-LOCAL', supplierName: request.supplierName || 'Local Supplier', productId: request.productId, productName: request.productName, commitmentDate: today(), dueDate: po.expectedDeliveryDate, amount: request.estimatedTotalCost, reserveNeeded: request.estimatedTotalCost, reserveAvailableAtCreation: getCOGSReserveSummary().currentReserveBalance, status: 'LinkedToPO', riskLevel: request.riskLevel, approvedBy: request.status === 'Approved' ? request.requestedBy : undefined, createdBy: request.requestedBy, notes: `Converted to ${po.poNumber}.` });
  updatePurchaseDisciplineRequest(requestId, { linkedCommitmentId: commitment.commitmentId });
  recordActivity('PURCHASE_REQUEST_CONVERTED_TO_PO', `${request.requestNumber} converted to ${po.poNumber}.`, requestId, request.requestedBy);
  return po;
}

export function linkCommitmentToPurchaseOrder(commitmentId: string, purchaseOrderId: string): SupplierPurchaseCommitment | null {
  let updated: SupplierPurchaseCommitment | null = null;
  saveList(COMMITMENT_KEY, getSupplierPurchaseCommitments().map((commitment) => commitment.commitmentId === commitmentId ? (updated = { ...commitment, purchaseOrderId, status: 'LinkedToPO' }) : commitment));
  if (updated) recordActivity('PURCHASE_COMMITMENT_LINKED_TO_PO', `${updated.commitmentNumber} linked to PO.`, purchaseOrderId);
  return updated;
}

export function linkCommitmentToGRN(commitmentId: string, grnId: string): SupplierPurchaseCommitment | null {
  let updated: SupplierPurchaseCommitment | null = null;
  saveList(COMMITMENT_KEY, getSupplierPurchaseCommitments().map((commitment) => commitment.commitmentId === commitmentId ? (updated = { ...commitment, grnId, status: 'LinkedToGRN' }) : commitment));
  if (updated) recordActivity('PURCHASE_COMMITMENT_LINKED_TO_GRN', `${updated.commitmentNumber} linked to GRN.`, grnId);
  return updated;
}

export function markCommitmentFulfilled(commitmentId: string): SupplierPurchaseCommitment | null {
  let updated: SupplierPurchaseCommitment | null = null;
  saveList(COMMITMENT_KEY, getSupplierPurchaseCommitments().map((commitment) => commitment.commitmentId === commitmentId ? (updated = { ...commitment, status: 'Fulfilled' }) : commitment));
  if (updated) recordActivity('PURCHASE_COMMITMENT_FULFILLED', `${updated.commitmentNumber} fulfilled.`, commitmentId);
  return updated;
}

export function cancelPurchaseCommitment(commitmentId: string, reason: string, staffId: string): SupplierPurchaseCommitment | null {
  let updated: SupplierPurchaseCommitment | null = null;
  saveList(COMMITMENT_KEY, getSupplierPurchaseCommitments().map((commitment) => commitment.commitmentId === commitmentId ? (updated = { ...commitment, status: 'Cancelled', notes: `${commitment.notes} Cancelled: ${reason}` }) : commitment));
  if (updated) recordActivity('PURCHASE_COMMITMENT_FULFILLED', `${updated.commitmentNumber} cancelled.`, commitmentId, staffId);
  return updated;
}

export function getReorderProtectionRules(): ReorderProtectionRule[] {
  return readList<ReorderProtectionRule>(RULE_KEY, seedRules);
}

export function updateReorderProtectionRule(ruleId: string, patch: Partial<ReorderProtectionRule>): ReorderProtectionRule | null {
  let updated: ReorderProtectionRule | null = null;
  saveList(RULE_KEY, getReorderProtectionRules().map((rule) => rule.ruleId === ruleId ? (updated = { ...rule, ...patch }) : rule));
  return updated;
}

export function getPurchasingDisciplineBIRules(): PurchasingDisciplineBIRule[] {
  return readList<PurchasingDisciplineBIRule>(BI_RULE_KEY, seedBIRules);
}

export function updatePurchasingDisciplineBIRule(ruleId: string, patch: Partial<PurchasingDisciplineBIRule>): PurchasingDisciplineBIRule | null {
  let updated: PurchasingDisciplineBIRule | null = null;
  saveList(BI_RULE_KEY, getPurchasingDisciplineBIRules().map((rule) => {
    if (rule.ruleId !== ruleId) return rule;
    updated = { ...rule, ...patch };
    return updated;
  }));
  return updated;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function healthFromScore(score: number): PurchaseRiskLevel {
  if (score < 35) return 'Critical';
  if (score < 55) return 'High';
  if (score < 75) return 'Medium';
  return 'Low';
}

function saleUnitCost(item: Sale['items'][number]): number {
  return Number(item.unitCost ?? item.costPrice ?? 0);
}

function weeklyCOGSDemand(sales: Sale[]): number {
  const completed = sales.filter((sale) => sale.status === 'COMPLETED');
  const cogs = completed.reduce((sum, sale) => sum + sale.items.reduce((lineSum, item) => lineSum + saleUnitCost(item) * item.quantity, 0), 0);
  return Math.max(250, Math.round((cogs / Math.max(1, completed.length)) * 5));
}

function supplierPOs(supplierId: string, purchaseOrders: PurchaseOrder[]): PurchaseOrder[] {
  return purchaseOrders.filter((order) => order.supplierId === supplierId || order.supplierName.toLowerCase().includes(supplierId.toLowerCase()));
}

function supplierGRNs(supplierName: string, notes: GoodsReceivingNote[]): GoodsReceivingNote[] {
  return notes.filter((note) => note.supplierName.toLowerCase() === supplierName.toLowerCase());
}

export async function getPurchasingDisciplineBISummary(): Promise<PurchasingDisciplineBISummary> {
  const rules = getPurchasingDisciplineBIRules();
  const reserve = getCOGSBuyingCapacitySummary();
  const commitments = getSupplierPurchaseCommitments().filter((commitment) => !['Cancelled', 'Fulfilled'].includes(commitment.status));
  const purchaseOrders = await getPurchaseOrders();
  const grns = await getGoodsReceivingNotes();
  const supplierLineStats = new Map<string, { received: number; accepted: number; complaints: number; varianceNotes: number }>();

  for (const note of grns) {
    const lines = await getGoodsReceivingLines(note.grnId);
    const current = supplierLineStats.get(note.supplierName) || { received: 0, accepted: 0, complaints: 0, varianceNotes: 0 };
    lines.forEach((line) => {
      current.received += Math.max(0, line.qtyReceivedNow || 0);
      current.accepted += Math.max(0, line.qtyAccepted || 0);
      if (line.varianceType === 'Damaged' || line.varianceType === 'Wrong Product') current.complaints += 1;
      if (line.varianceType && line.varianceType !== 'None') current.varianceNotes += 1;
    });
    supplierLineStats.set(note.supplierName, current);
  }

  const suppliers = getSupplierCreditProfiles().map<PurchasingSupplierAnalytics>((profile) => {
    const profilePOs = supplierPOs(profile.supplierId, purchaseOrders);
    const profileGRNs = supplierGRNs(profile.supplierName, grns);
    const lineStats = supplierLineStats.get(profile.supplierName) || { received: 0, accepted: 0, complaints: 0, varianceNotes: 0 };
    const creditUsage = profile.supplierCreditLimit > 0 ? (profile.currentPayableBalance / profile.supplierCreditLimit) * 100 : 0;
    const overduePenalty = profile.overduePayableBalance > 0 ? 18 : 0;
    const disputePenalty = profile.disputedAmount > 0 ? 10 : 0;
    const latePenalty = Math.min(24, profile.latePaymentCount * 6);
    const reliabilityScore = clampScore(100 - overduePenalty - disputePenalty - latePenalty - Math.max(0, creditUsage - 70) / 2);
    const riskScore = clampScore(100 - reliabilityScore + Math.max(0, creditUsage - 60) / 2 + profile.latePaymentCount * 4);
    const averageLeadDays = profilePOs.length
      ? profilePOs.reduce((sum, po) => {
        const start = new Date(`${po.poDate}T12:00:00`).getTime();
        const expected = new Date(`${po.expectedDeliveryDate}T12:00:00`).getTime();
        return sum + Math.max(1, Math.round((expected - start) / 86400000));
      }, 0) / profilePOs.length
      : profile.paymentTermsDays;
    const leadTimeScore = clampScore(100 - averageLeadDays * 2);
    const deliveryPerformance = profilePOs.length ? clampScore((profileGRNs.length / profilePOs.length) * 100) : profile.preferredSupplier ? 85 : 65;
    const correctSupplyRate = lineStats.received > 0 ? clampScore((lineStats.accepted / lineStats.received) * 100 - lineStats.varianceNotes * 2) : 80;
    const recommendation = riskScore > 60 || correctSupplyRate < 75
      ? 'Require manager review before replenishment'
      : reliabilityScore >= 80 && deliveryPerformance >= 75
        ? 'Preferred for controlled replenishment'
        : 'Use with monitored purchase discipline';
    return {
      supplierId: profile.supplierId,
      supplierName: profile.supplierName,
      reliabilityScore,
      riskScore,
      leadTimeScore,
      deliveryPerformance,
      packagingComplaints: lineStats.complaints,
      correctSupplyRate,
      recommendation
    };
  }).sort((a, b) => b.riskScore - a.riskScore);

  const requests = getPurchaseDisciplineRequests();
  const products = mockProducts.slice(0, 24).map<PurchasingProductAnalytics>((product) => {
    const productId = product.id;
    const sku = productSku(product);
    const salesQty = mockRecentSales
      .filter((sale) => sale.status === 'COMPLETED')
      .flatMap((sale) => sale.items)
      .filter((item) => item.productId === productId || item.code === sku)
      .reduce((sum, item) => sum + item.quantity, 0);
    const productRequests = requests.filter((request) => request.productId === productId || request.sku === sku);
    const productCommitments = commitments.filter((commitment) => commitment.productId === productId || commitment.productName === productName(product));
    const cost = productCost(product);
    const price = productPrice(product);
    const marginPercent = price > 0 ? ((price - cost) / price) * 100 : 0;
    const salesVelocity = Number((salesQty / 3).toFixed(1));
    const purchaseFrequency = productRequests.length + productCommitments.length;
    const supplierAvailability = clampScore((product.supplierId || product.supplierName ? 50 : 20) + (productStock(product) > 0 ? 25 : 0) + (product.reorderLevel ? 15 : 0) + (productCommitments.length > 0 ? 10 : 0));
    const brandTolerance = clampScore((product.brand ? 55 : 35) + (product.manufacturer ? 15 : 0) + (product.category ? 10 : 0) + (product.stockStatus === 'Fast Moving' || product.healthStatus === 'Fast Moving' ? 15 : 0));
    const marginPerformance = clampScore(marginPercent * 2.4);
    const recommendation = marginPercent < 18
      ? 'Do not buy without margin review'
      : salesVelocity >= 3 && supplierAvailability >= 65
        ? 'Replenishment candidate'
        : purchaseFrequency > 1 && salesVelocity < 1
          ? 'Check slow-moving risk before purchase'
          : 'Monitor demand before buying';
    return {
      productId,
      sku,
      productName: productName(product),
      supplierName: product.supplierName || 'Unassigned',
      salesVelocity,
      purchaseFrequency,
      supplierAvailability,
      brandTolerance,
      marginPerformance,
      recommendation
    };
  }).sort((a, b) => b.salesVelocity - a.salesVelocity);

  const weeklyDemand = weeklyCOGSDemand(mockRecentSales);
  const supplierCommitments = commitments.reduce((sum, commitment) => sum + commitment.reserveNeeded, 0);
  const cashAvailable = reserve.safeBuyingCapacity;
  const coverageScore = clampScore(reserve.reserveCoveragePercent);
  const commitmentPressure = reserve.currentReserveBalance > 0 ? (supplierCommitments / reserve.currentReserveBalance) * 100 : 100;
  const forecastScore = clampScore((cashAvailable - weeklyDemand * 2) / Math.max(1, weeklyDemand * 2) * 100 + 70);
  const cogsHealthScore = clampScore(coverageScore * 0.45 + (100 - Math.min(100, commitmentPressure)) * 0.3 + forecastScore * 0.25);
  const cogsHealthStatus = healthFromScore(cogsHealthScore);
  const cogs: COGSReserveBIControl = {
    cogsReserveBalance: reserve.currentReserveBalance,
    supplierCommitments,
    cashAvailable,
    oneWeekForecast: Number((cashAvailable - weeklyDemand).toFixed(2)),
    twoWeekForecast: Number((cashAvailable - weeklyDemand * 2).toFixed(2)),
    threeWeekForecast: Number((cashAvailable - weeklyDemand * 3).toFixed(2)),
    cogsHealthScore,
    cogsHealthStatus,
    summary: cogsHealthScore >= 75
      ? 'COGS reserve can support controlled replenishment.'
      : cogsHealthScore >= 55
        ? 'COGS reserve requires monitored buying decisions.'
        : 'COGS reserve is under pressure. Require approval before aggressive buying.'
  };

  return {
    generatedAt: nowIso(),
    cogs,
    suppliers,
    products,
    rules,
    drillReports: [
      { reportId: 'supplier-risk', title: 'Supplier risk analytics', description: 'Reliability, delivery, packaging and correct-supply supplier scorecard.', riskLevel: suppliers.some((supplier) => supplier.riskScore > 60) ? 'High' : 'Low', count: suppliers.length },
      { reportId: 'product-buying', title: 'Product buying analytics', description: 'Sales velocity, purchase frequency, margin and availability intelligence.', riskLevel: products.some((product) => product.marginPerformance < 45 && product.salesVelocity > 1) ? 'High' : 'Medium', count: products.length },
      { reportId: 'cogs-control', title: 'COGS reserve control', description: 'Reserve balance, supplier commitments, available cash and three-week forecast.', riskLevel: cogs.cogsHealthStatus, count: rules.filter((rule) => rule.active).length },
      { reportId: 'rule-config', title: 'Configurable rule library', description: 'Default system rules controlling supplier, product and COGS reserve BI scoring.', riskLevel: rules.some((rule) => !rule.active) ? 'Medium' : 'Low', count: rules.length }
    ]
  };
}

export function getCOGSBuyingCapacitySummary() {
  const reserve = getCOGSReserveSummary();
  const commitments = getSupplierPurchaseCommitments().filter((commitment) => !['Cancelled', 'Fulfilled'].includes(commitment.status));
  const pendingCommitments = commitments.reduce((sum, commitment) => sum + commitment.reserveNeeded, 0);
  const supplierBillsDue = getSupplierBills().filter((bill) => bill.outstandingAmount > 0).reduce((sum, bill) => sum + bill.outstandingAmount, 0);
  const safeBuyingCapacity = Math.max(0, reserve.currentReserveBalance - pendingCommitments - supplierBillsDue);
  return { ...reserve, pendingPurchaseCommitments: pendingCommitments, supplierBillsDue, safeBuyingCapacity, availableForReorder: Math.max(0, reserve.currentReserveBalance - pendingCommitments) };
}

export async function createPOWithoutReserveCheckWarning(poNumber: string, staffId: string): Promise<void> {
  await createPurchaseBI('PO_RAISED_WITHOUT_RESERVE_CHECK', `${poNumber} was raised without a linked purchase discipline reserve check.`, 'Medium', poNumber);
  recordActivity('PO_RESERVE_CHECK_FAILED', `${poNumber} has no linked purchase discipline request.`, poNumber, staffId);
}

export async function createGRNWithoutPurchaseDisciplineWarning(grnNumber: string, staffId: string): Promise<void> {
  await createPurchaseBI('GRN_RECEIVED_WITHOUT_PURCHASE_DISCIPLINE', `${grnNumber} was received without a linked purchase discipline request.`, 'High', grnNumber);
  await createPurchaseApproval({ approvalType: 'GRN_WITHOUT_PURCHASE_DISCIPLINE_OVERRIDE', relatedRecord: grnNumber, requestedBy: staffId, reason: 'GRN received without purchase discipline link.', amount: 0, risk: 'High' });
  recordActivity('GRN_PURCHASE_DISCIPLINE_WARNING_CREATED', `${grnNumber} has no linked purchase discipline request.`, grnNumber, staffId);
}

export async function createPurchaseDisciplineWarnings(): Promise<void> {
  const capacity = getCOGSBuyingCapacitySummary();
  if (capacity.safeBuyingCapacity < 250) await createPurchaseBI('COGS_RESERVE_SAFE_BUYING_CAPACITY_LOW', `Safe buying capacity is USD ${capacity.safeBuyingCapacity.toFixed(2)}.`, 'High', 'COGS-CAPACITY');
  const activeCommitments = getSupplierPurchaseCommitments().filter((commitment) => !['Cancelled', 'Fulfilled'].includes(commitment.status));
  if (activeCommitments.reduce((sum, commitment) => sum + commitment.reserveNeeded, 0) > capacity.currentReserveBalance) await createPurchaseBI('PURCHASE_COMMITMENTS_EXCEED_RESERVE', 'Active purchase commitments exceed current COGS Reserve.', 'High', 'COMMITMENTS');
  activeCommitments.filter((commitment) => commitment.dueDate && commitment.dueDate < today()).forEach((commitment) => void createPurchaseBI('PURCHASE_COMMITMENT_OVERDUE', `${commitment.commitmentNumber} is overdue.`, commitment.riskLevel, commitment.commitmentId));
}

export function getPurchaseDisciplineActivityEvents(): PurchaseDisciplineActivityEvent[] {
  return readList<PurchaseDisciplineActivityEvent>(ACTIVITY_KEY);
}

export function getPurchaseDisciplineProducts(): Product[] {
  return mockProducts.slice(0, 80);
}

export function getPurchaseDisciplineSuppliers() {
  return getSupplierCreditProfiles().map((profile) => ({ supplierId: profile.supplierId, supplierName: profile.supplierName }));
}
