import type {
  BIAlert,
  BIEvent,
  BIRecommendation,
  BIRiskScore,
  BIStocktakeTask,
} from "./types/biTypes";

import { createBIEvent, type CreateBIEventInput } from "./events/biEventLogger";
import { calculateStockIntegrity, type StockIntegrityInput } from "./rules/stockIntegrityEngine";
import { generateStocktakeTasks, type StocktakeCandidate } from "./rules/stocktakeIntelligenceEngine";
import { calculateTheftRisk, type TheftRiskInput } from "./rules/theftDetectionEngine";
import { calculateCOGS, type COGSInput } from "./rules/cogsIntelligenceEngine";
import { calculateProfitProtection, type ProfitProtectionInput } from "./rules/profitProtectionEngine";
import { calculateCashControl, type CashControlInput } from "./rules/cashControlEngine";
import { calculateRiskScore } from "./scoring/riskScoringEngine";
import { createBIAlert } from "./alerts/alertsEngine";
import { createBIRecommendation } from "./recommendations/recommendationEngine";
import { predictStockout, type StockoutPredictionInput } from "./predictions/predictiveModelsEngine";
import { buildBIDashboardSummary } from "./dashboard/biDashboardSummary";

export interface BIEngineState {
  events: BIEvent[];
  alerts: BIAlert[];
  recommendations: BIRecommendation[];
  riskScores: BIRiskScore[];
  stocktakeTasks: BIStocktakeTask[];
}

export const createEmptyBIEngineState = (): BIEngineState => ({
  events: [],
  alerts: [],
  recommendations: [],
  riskScores: [],
  stocktakeTasks: [],
});

export function processBIEvent(
  state: BIEngineState,
  input: CreateBIEventInput
): BIEngineState {
  const event = createBIEvent(input);

  return {
    ...state,
    events: [event, ...state.events],
  };
}

export function runStockIntegrityBI(
  state: BIEngineState,
  input: StockIntegrityInput & {
    vendorId: string;
    branchId?: string;
    warehouseId?: string;
  }
): BIEngineState {
  const result = calculateStockIntegrity(input);

  const riskScore = calculateRiskScore({
    vendorId: input.vendorId,
    branchId: input.branchId,
    entityType: "PRODUCT",
    entityId: input.productId,
    riskFactors: result.reasons.map((reason) => ({
      reason,
      weight:
        result.riskLevel === "CRITICAL"
          ? 35
          : result.riskLevel === "HIGH"
          ? 25
          : result.riskLevel === "MEDIUM"
          ? 12
          : 3,
    })),
  });

  const alerts =
    result.riskLevel === "HIGH" || result.riskLevel === "CRITICAL"
      ? [
          createBIAlert({
            vendorId: input.vendorId,
            branchId: input.branchId,
            alertType: "STOCK_INTEGRITY_VARIANCE",
            severity: result.riskLevel === "CRITICAL" ? "CRITICAL" : "HIGH",
            title: "Stock variance detected",
            description: `${result.productName || result.productId} has variance of ${result.varianceQuantity}.`,
            entityType: "PRODUCT",
            entityId: input.productId,
            financialImpact: Math.abs(result.varianceCostValue || 0),
            recommendedAction: "Run supervisor review and physical recount.",
          }),
        ]
      : [];

  const recommendations =
    result.riskLevel === "HIGH" || result.riskLevel === "CRITICAL"
      ? [
          createBIRecommendation({
            vendorId: input.vendorId,
            branchId: input.branchId,
            title: "Investigate stock variance",
            observation: `${result.productName || result.productId} stock does not match expected quantity.`,
            reason: result.reasons.join("; "),
            risk: "Possible stock leakage, wrong receiving, adjustment abuse, or count error.",
            recommendedAction: "Start a physical recount and review stock movement logs.",
            expectedBenefit: "Improves stock integrity and reduces silent stock loss.",
            priority: result.riskLevel === "CRITICAL" ? "URGENT" : "HIGH",
          }),
        ]
      : [];

  return {
    ...state,
    riskScores: [riskScore, ...state.riskScores],
    alerts: [...alerts, ...state.alerts],
    recommendations: [...recommendations, ...state.recommendations],
  };
}

export function runStocktakeBI(
  state: BIEngineState,
  candidates: StocktakeCandidate[],
  maxTasks = 10
): BIEngineState {
  const tasks = generateStocktakeTasks({ candidates, maxTasks });

  return {
    ...state,
    stocktakeTasks: [...tasks, ...state.stocktakeTasks],
  };
}

export function runTheftDetectionBI(
  state: BIEngineState,
  input: TheftRiskInput & { vendorId: string; branchId?: string }
): BIEngineState {
  const result = calculateTheftRisk(input);

  const riskScore = calculateRiskScore({
    vendorId: input.vendorId,
    branchId: input.branchId,
    entityType: input.entityType === "DELIVERY" ? "DRIVER" : input.entityType,
    entityId: input.entityId,
    baseScore: result.score,
    riskFactors: result.reasons.map((reason) => ({ reason, weight: 0 })),
  });

  const alerts =
    result.riskLevel === "HIGH" || result.riskLevel === "CRITICAL"
      ? [
          createBIAlert({
            vendorId: input.vendorId,
            branchId: input.branchId,
            alertType: "THEFT_RISK_DETECTED",
            severity: result.riskLevel === "CRITICAL" ? "CRITICAL" : "HIGH",
            title: "Theft risk detected",
            description: `${input.entityName || input.entityId} has ${result.riskLevel} theft risk.`,
            entityType: input.entityType,
            entityId: input.entityId,
            recommendedAction: "Review audit trail, stock movements, staff activity, and related transactions.",
          }),
        ]
      : [];

  return {
    ...state,
    riskScores: [riskScore, ...state.riskScores],
    alerts: [...alerts, ...state.alerts],
  };
}

export function runCOGSBI(
  state: BIEngineState,
  input: COGSInput & { vendorId: string; branchId?: string }
): BIEngineState {
  const result = calculateCOGS(input);

  const alerts =
    result.riskLevel === "HIGH" || result.riskLevel === "CRITICAL"
      ? [
          createBIAlert({
            vendorId: input.vendorId,
            branchId: input.branchId,
            alertType: "COGS_MARGIN_RISK",
            severity: result.riskLevel === "CRITICAL" ? "CRITICAL" : "HIGH",
            title: "COGS margin risk",
            description: `${result.productName || result.productId} margin is ${result.grossMarginPercent}%.`,
            entityType: "PRODUCT",
            entityId: input.productId,
            recommendedAction: `Review price. Recommended selling price: ${result.recommendedSellingPrice}.`,
          }),
        ]
      : [];

  return {
    ...state,
    alerts: [...alerts, ...state.alerts],
  };
}

export function runProfitProtectionBI(
  state: BIEngineState,
  input: ProfitProtectionInput & { vendorId: string; branchId?: string }
): BIEngineState {
  const result = calculateProfitProtection(input);

  const alerts =
    result.riskLevel === "HIGH" || result.riskLevel === "CRITICAL"
      ? [
          createBIAlert({
            vendorId: input.vendorId,
            branchId: input.branchId,
            alertType: "PROTECTED_PROFIT_RISK",
            severity: result.riskLevel === "CRITICAL" ? "CRITICAL" : "HIGH",
            title: "Protected profit risk",
            description: `Protected profit is ${result.protectedProfit}. Leakage is ${result.totalLeakage}.`,
            financialImpact: result.totalLeakage,
            recommendedAction: "Review stock loss, discount leakage, refunds, write-offs, cash variance, and delivery loss.",
          }),
        ]
      : [];

  return {
    ...state,
    alerts: [...alerts, ...state.alerts],
  };
}

export function runCashControlBI(
  state: BIEngineState,
  input: CashControlInput & { vendorId: string }
): BIEngineState {
  const result = calculateCashControl(input);

  const alerts =
    result.riskLevel === "HIGH" || result.riskLevel === "CRITICAL"
      ? [
          createBIAlert({
            vendorId: input.vendorId,
            branchId: input.branchId,
            terminalId: input.terminalId,
            staffId: input.staffId,
            alertType: "CASH_CONTROL_VARIANCE",
            severity: result.riskLevel === "CRITICAL" ? "CRITICAL" : "HIGH",
            title: "Cash control variance",
            description: `Cash variance detected. Exposure: ${result.totalCashExposure}.`,
            financialImpact: result.totalCashExposure,
            recommendedAction: "Supervisor must review shift cash, drawer openings, refunds, and delivery remittances.",
          }),
        ]
      : [];

  return {
    ...state,
    alerts: [...alerts, ...state.alerts],
  };
}

export function runStockoutPredictionBI(
  state: BIEngineState,
  input: StockoutPredictionInput & { vendorId: string; branchId?: string }
): BIEngineState {
  const prediction = predictStockout(input);

  const alerts =
    prediction.riskLevel === "HIGH" || prediction.riskLevel === "CRITICAL"
      ? [
          createBIAlert({
            vendorId: input.vendorId,
            branchId: input.branchId,
            alertType: "STOCKOUT_PREDICTION",
            severity: prediction.riskLevel === "CRITICAL" ? "CRITICAL" : "HIGH",
            title: "Stockout predicted",
            description: prediction.message,
            entityType: "PRODUCT",
            entityId: input.productId,
            recommendedAction: prediction.recommendedAction,
          }),
        ]
      : [];

  return {
    ...state,
    alerts: [...alerts, ...state.alerts],
  };
}

export function buildBIControlCentre(state: BIEngineState) {
  return buildBIDashboardSummary({
    alerts: state.alerts,
    recommendations: state.recommendations,
    riskScores: state.riskScores,
  });
}