import type { BIRiskLevel } from "../types/biTypes";

export interface StockoutPredictionInput {
  productId: string;
  productName?: string;
  currentStock: number;
  averageDailySales: number;
  supplierLeadTimeDays: number;
  safetyStock?: number;
}

export interface PredictionResult {
  entityId: string;
  entityName?: string;
  predictionType: string;
  riskLevel: BIRiskLevel;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  message: string;
  recommendedAction: string;
}

export function predictStockout(
  input: StockoutPredictionInput
): PredictionResult {
  const safetyStock = input.safetyStock ?? 0;
  const usableStock = input.currentStock - safetyStock;

  const daysUntilStockout =
    input.averageDailySales <= 0
      ? Infinity
      : usableStock / input.averageDailySales;

  let riskLevel: BIRiskLevel = "LOW";
  let confidence: PredictionResult["confidence"] = "MEDIUM";

  if (daysUntilStockout <= input.supplierLeadTimeDays) {
    riskLevel = "CRITICAL";
    confidence = "HIGH";
  } else if (daysUntilStockout <= input.supplierLeadTimeDays + 3) {
    riskLevel = "HIGH";
  } else if (daysUntilStockout <= input.supplierLeadTimeDays + 7) {
    riskLevel = "MEDIUM";
  }

  return {
    entityId: input.productId,
    entityName: input.productName,
    predictionType: "STOCKOUT_PREDICTION",
    riskLevel,
    confidence,
    message:
      daysUntilStockout === Infinity
        ? "No stockout prediction because average daily sales is zero"
        : `Predicted stockout in ${Math.max(0, Math.round(daysUntilStockout))} days`,
    recommendedAction:
      riskLevel === "LOW"
        ? "Continue monitoring stock movement"
        : "Review reorder quantity and supplier lead time immediately",
  };
}
