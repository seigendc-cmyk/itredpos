import type { BIRiskLevel } from "../types/biTypes";

export interface ProductBehaviourInput {
  productId: string;
  productName?: string;
  categoryId?: string;

  currentStock: number;
  minStock?: number;
  maxStock?: number;

  unitsSoldLast30Days?: number;
  unitsSoldPrevious30Days?: number;
  refundCount?: number;
  returnCount?: number;
  stockVarianceCount?: number;
  stockVarianceValue?: number;
  manualAdjustmentCount?: number;

  grossMarginPercent?: number;
  targetMarginPercent?: number;

  daysSinceLastSale?: number;
  isHighValue?: boolean;
  isEasyToConceal?: boolean;
}

export interface ProductBehaviourResult {
  productId: string;
  productName?: string;
  categoryId?: string;
  movementClass: "FAST_MOVER" | "NORMAL_MOVER" | "SLOW_MOVER" | "DEAD_STOCK";
  riskScore: number;
  riskLevel: BIRiskLevel;
  concerns: string[];
  recommendedActions: string[];
}

export function classifyProductRisk(score: number): BIRiskLevel {
  if (score >= 81) return "CRITICAL";
  if (score >= 61) return "HIGH";
  if (score >= 31) return "MEDIUM";
  return "LOW";
}

export function classifyProductMovement(input: ProductBehaviourInput): ProductBehaviourResult["movementClass"] {
  const sold = input.unitsSoldLast30Days ?? 0;
  const daysSinceLastSale = input.daysSinceLastSale ?? 999;

  if (daysSinceLastSale >= 90) return "DEAD_STOCK";
  if (sold >= 30) return "FAST_MOVER";
  if (sold <= 3) return "SLOW_MOVER";
  return "NORMAL_MOVER";
}

export function calculateProductBehaviour(input: ProductBehaviourInput): ProductBehaviourResult {
  let riskScore = 0;
  const concerns: string[] = [];
  const recommendedActions: string[] = [];

  const movementClass = classifyProductMovement(input);

  if (movementClass === "DEAD_STOCK") {
    riskScore += 25;
    concerns.push("Product has dead stock behaviour");
    recommendedActions.push("Review reorder block and discount clearance strategy");
  }

  if (movementClass === "FAST_MOVER" && input.currentStock <= (input.minStock ?? 0)) {
    riskScore += 25;
    concerns.push("Fast-moving product is near or below minimum stock");
    recommendedActions.push("Review reorder quantity and supplier lead time");
  }

  if ((input.stockVarianceCount ?? 0) > 0) {
    riskScore += Math.min((input.stockVarianceCount ?? 0) * 12, 36);
    concerns.push("Product has stock variance history");
    recommendedActions.push("Assign risk-based stocktake");
  }

  if ((input.manualAdjustmentCount ?? 0) > 0) {
    riskScore += Math.min((input.manualAdjustmentCount ?? 0) * 8, 24);
    concerns.push("Manual stock adjustments detected");
  }

  if ((input.refundCount ?? 0) > 0 || (input.returnCount ?? 0) > 0) {
    riskScore += Math.min(((input.refundCount ?? 0) + (input.returnCount ?? 0)) * 5, 25);
    concerns.push("Refund or return activity detected");
  }

  if ((input.grossMarginPercent ?? 100) < (input.targetMarginPercent ?? 25)) {
    riskScore += 20;
    concerns.push("Product margin is below target");
    recommendedActions.push("Review COGS and selling price");
  }

  if (input.isHighValue) {
    riskScore += 10;
    concerns.push("High-value product requires tighter control");
  }

  if (input.isEasyToConceal) {
    riskScore += 10;
    concerns.push("Product is easy to conceal and requires spot checks");
  }

  riskScore = Math.min(100, Math.round(riskScore));

  if (recommendedActions.length === 0) {
    recommendedActions.push("Continue normal product monitoring");
  }

  return {
    productId: input.productId,
    productName: input.productName,
    categoryId: input.categoryId,
    movementClass,
    riskScore,
    riskLevel: classifyProductRisk(riskScore),
    concerns,
    recommendedActions,
  };
}
