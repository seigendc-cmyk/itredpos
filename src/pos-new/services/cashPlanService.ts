import type { CashPlanForecast, CashPlanLine, FinancialDecisionStatus, OwnerFinancialDecision } from '../types/posTypes';
import { getFinancialPositionSummary } from './financialControlService';

const FORECAST_LINES_KEY = 'itred_pos_cash_plan_lines';
const DECISIONS_KEY = 'itred_pos_owner_financial_decisions';
const now = () => new Date().toISOString();

function readList<T>(key: string, fallback: T[]): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(fallback));
      return fallback;
    }
    return JSON.parse(raw) as T[];
  } catch {
    return fallback;
  }
}

function saveList<T>(key: string, rows: T[]): T[] {
  try {
    localStorage.setItem(key, JSON.stringify(rows));
  } catch {
    // Local preview storage is best-effort.
  }
  return rows;
}

const daysFromNow = (offset: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
};

function defaultLines(forecastId = 'CPF-ROLLING-7'): CashPlanLine[] {
  return [
    line('CPL-001', forecastId, 0, 'Inflow', 'ActualCash', undefined, 'Cash drawer funds counted and available.', 2000, 'Confirmed', true, false),
    line('CPL-002', forecastId, 1, 'Inflow', 'ExpectedDebtorPayment', undefined, 'Promise-to-pay collections expected tomorrow.', 900, 'High', true, false),
    line('CPL-003', forecastId, 2, 'Inflow', 'ExpectedDebtorPayment', undefined, 'Risky customer debt collection bucket.', 650, 'Risky', true, false),
    line('CPL-004', forecastId, 0, 'Outflow', undefined, 'SupplierPaymentDue', 'Supplier payments due today.', 860, 'Confirmed', true, false),
    line('CPL-005', forecastId, 1, 'Outflow', undefined, 'PurchaseCommitment', 'Approved purchase commitment placeholder.', 1250, 'High', true, false),
    line('CPL-006', forecastId, 0, 'Outflow', undefined, 'COGSReserveRequirement', 'COGS reserve protection requirement.', 2200, 'Confirmed', false, true),
    line('CPL-007', forecastId, 3, 'Outflow', undefined, 'VATReserveRequirement', 'VAT reserve placeholder requirement.', 710, 'Medium', false, true),
    line('CPL-008', forecastId, 4, 'Outflow', undefined, 'DrawerExpensePlanned', 'Known drawer expense placeholder.', 120, 'Medium', true, false)
  ];
}

function line(
  lineId: string,
  forecastId: string,
  dayOffset: number,
  type: CashPlanLine['type'],
  inflowType: CashPlanLine['inflowType'],
  outflowType: CashPlanLine['outflowType'],
  description: string,
  amount: number,
  confidence: CashPlanLine['confidence'],
  includedInFreeCash: boolean,
  restricted: boolean
): CashPlanLine {
  return {
    lineId,
    forecastId,
    date: daysFromNow(dayOffset),
    type,
    inflowType,
    outflowType,
    description,
    sourceReferenceId: lineId,
    sourceReferenceNumber: lineId.replace('CPL', 'PLAN'),
    amount,
    confidence,
    includedInFreeCash,
    restricted,
    notes: 'CashPlan build-development placeholder. Not a bank feed or final posting.'
  };
}

function defaultDecisions(): OwnerFinancialDecision[] {
  return [
    decision('OFD-001', 'PaySupplier', 'Pay critical supplier from free usable cash only.', 860, 'Creditors', 'Medium', 'Approve supplier payment if reserve shortfall stays zero.', 'PendingOwnerDecision'),
    decision('OFD-002', 'ProtectReserve', 'Protect COGS reserve before discretionary spending.', 2200, 'COGSReserve', 'High', 'Ring-fence reserve and block owner drawings until replenished.', 'Draft'),
    decision('OFD-003', 'ChaseDebtor', 'Chase high-value debtor collections.', 900, 'Debtors', 'Medium', 'Convert promise-to-pay rows into collection diary follow-up.', 'ConvertedToTask'),
    decision('OFD-004', 'DelayPurchase', 'Delay non-critical purchase commitment.', 1250, 'PurchaseDiscipline', 'High', 'Hold purchase unless cash gap clears inside seven days.', 'PendingOwnerDecision')
  ];
}

function decision(
  decisionId: string,
  type: OwnerFinancialDecision['decisionType'],
  title: string,
  amount: number,
  sourceModule: OwnerFinancialDecision['sourceModule'],
  riskLevel: OwnerFinancialDecision['riskLevel'],
  recommendedAction: string,
  status: FinancialDecisionStatus
): OwnerFinancialDecision {
  return {
    decisionId,
    decisionNumber: decisionId.replace('OFD', 'FINDEC'),
    decisionDate: daysFromNow(0),
    decisionType: type,
    title,
    narrative: `${title} Source data is generated from the local Financial Control preview layer.`,
    amount,
    sourceModule,
    sourceReferenceId: decisionId,
    riskLevel,
    recommendedAction,
    status,
    createdAt: now()
  };
}

export async function getCashPlanLines(): Promise<CashPlanLine[]> {
  return readList<CashPlanLine>(FORECAST_LINES_KEY, defaultLines());
}

export async function addCashPlanLine(payload: Partial<CashPlanLine>): Promise<CashPlanLine[]> {
  const rows = await getCashPlanLines();
  const next: CashPlanLine = {
    lineId: `CPL-${Date.now()}`,
    forecastId: payload.forecastId || 'CPF-ROLLING-7',
    date: payload.date || daysFromNow(1),
    type: payload.type || 'Outflow',
    inflowType: payload.inflowType,
    outflowType: payload.outflowType || 'OtherPlanned',
    description: payload.description || 'Manual CashPlan placeholder.',
    sourceReferenceId: payload.sourceReferenceId || 'MANUAL',
    sourceReferenceNumber: payload.sourceReferenceNumber || 'MANUAL',
    amount: payload.amount || 0,
    confidence: payload.confidence || 'Medium',
    includedInFreeCash: payload.includedInFreeCash ?? true,
    restricted: payload.restricted ?? false,
    notes: payload.notes || 'Created locally for CashPlan preview.'
  };
  return saveList(FORECAST_LINES_KEY, [next, ...rows]);
}

export async function getCashPlanForecast(): Promise<CashPlanForecast> {
  const [summary, rows] = await Promise.all([getFinancialPositionSummary(), getCashPlanLines()]);
  const confirmedInflows = rows.filter((row) => row.type === 'Inflow' && row.confidence === 'Confirmed').reduce((total, row) => total + row.amount, 0);
  const expectedInflows = rows.filter((row) => row.type === 'Inflow' && row.confidence !== 'Confirmed' && row.confidence !== 'Risky').reduce((total, row) => total + row.amount, 0);
  const riskyInflows = rows.filter((row) => row.type === 'Inflow' && row.confidence === 'Risky').reduce((total, row) => total + row.amount, 0);
  const confirmedOutflows = rows.filter((row) => row.type === 'Outflow' && row.confidence === 'Confirmed' && row.includedInFreeCash).reduce((total, row) => total + row.amount, 0);
  const plannedOutflows = rows.filter((row) => row.type === 'Outflow' && row.confidence !== 'Confirmed' && row.includedInFreeCash).reduce((total, row) => total + row.amount, 0);
  const reserveRequirements = rows.filter((row) => row.restricted).reduce((total, row) => total + row.amount, 0);
  const projectedFreeCash = summary.freeUsableCash + confirmedInflows + expectedInflows - confirmedOutflows - plannedOutflows;
  const projectedReserveShortfall = Math.max(0, reserveRequirements - summary.lessCOGSReserve - summary.lessVATReserve);
  return {
    forecastId: 'CPF-ROLLING-7',
    periodFrom: daysFromNow(0),
    periodTo: daysFromNow(7),
    openingCashPosition: summary.freeUsableCash,
    confirmedInflows,
    expectedInflows,
    riskyInflows,
    confirmedOutflows,
    plannedOutflows,
    reserveRequirements,
    supplierPaymentPressure: confirmedOutflows + plannedOutflows,
    debtorCollectionExpectation: expectedInflows + riskyInflows,
    projectedFreeCash,
    projectedReserveShortfall,
    projectedCashGap: Math.min(0, projectedFreeCash - projectedReserveShortfall),
    confidence: projectedFreeCash < 0 ? 'Risky' : riskyInflows > expectedInflows ? 'Medium' : 'High',
    recommendedOwnerAction: projectedFreeCash < 0 ? 'Delay non-critical purchases and chase debtor collections.' : 'Approve committed payments only after reserve protection check.',
    generatedAt: now()
  };
}

export async function getOwnerFinancialDecisions(): Promise<OwnerFinancialDecision[]> {
  return readList<OwnerFinancialDecision>(DECISIONS_KEY, defaultDecisions());
}

export async function updateOwnerFinancialDecisionStatus(decisionId: string, status: FinancialDecisionStatus, staffName = 'Owner Preview'): Promise<OwnerFinancialDecision[]> {
  const rows = (await getOwnerFinancialDecisions()).map((decisionRow) => {
    if (decisionRow.decisionId !== decisionId) return decisionRow;
    return {
      ...decisionRow,
      status,
      approvedBy: status === 'Approved' ? staffName : decisionRow.approvedBy,
      approvedAt: status === 'Approved' ? now() : decisionRow.approvedAt,
      rejectedBy: status === 'Rejected' ? staffName : decisionRow.rejectedBy,
      rejectedAt: status === 'Rejected' ? now() : decisionRow.rejectedAt,
      executionNote: `Decision status moved to ${status} in local preview.`
    };
  });
  return saveList(DECISIONS_KEY, rows);
}

export async function rebuildCashPlanPreview(): Promise<{ forecast: CashPlanForecast; lines: CashPlanLine[]; decisions: OwnerFinancialDecision[] }> {
  const lines = saveList(FORECAST_LINES_KEY, defaultLines());
  const decisions = saveList(DECISIONS_KEY, defaultDecisions());
  return { forecast: await getCashPlanForecast(), lines, decisions };
}
