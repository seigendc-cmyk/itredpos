import type { BIRiskLevel } from "../types/biTypes";

export interface TheftRiskInput {
  entityId: string;
  entityName?: string;
  entityType: "PRODUCT" | "SHELF" | "STAFF" | "BRANCH" | "DELIVERY" | "SUPPLIER";

  isHighValue?: boolean;
  isFastMoving?: boolean;
  isEasyToConceal?: boolean;

  negativeVarianceCount?: number;
  negativeVarianceValue?: number;
  manualAdjustmentCount?: number;
  refundCount?: number;
  voidCount?: number;
  priceOverrideCount?: number;
  transferMismatchCount?: number;
  deliveryMismatchCount?: number;
  cashVarianceCount?: number;
}

export interface TheftRiskResult {
  entityId: string;
  entityName?: string;
  entityType: TheftRiskInput["entityType"];
  score: number;
  riskLevel: BIRiskLevel;
  reasons: string[];
}

export function classifyTheftRisk(score: number): BIRiskLevel {
  if (score >= 81) return "CRITICAL";
  if (score >= 61) return "HIGH";
  if (score >= 31) return "MEDIUM";
  return "LOW";
}

export function calculateTheftRisk(input: TheftRiskInput): TheftRiskResult {
  const reasons: string[] = [];
  let score = 0;

  if (input.isHighValue) {
    score += 15;
    reasons.push("High-value entity");
  }

  if (input.isFastMoving) {
    score += 10;
    reasons.push("Fast-moving stock behavior");
  }

  if (input.isEasyToConceal) {
    score += 10;
    reasons.push("Easy-to-conceal item");
  }

  if ((input.negativeVarianceCount ?? 0) > 0) {
    score += (input.negativeVarianceCount ?? 0) * 12;
    reasons.push("Repeated negative stock variance");
  }

  if ((input.negativeVarianceValue ?? 0) > 0) {
    score += Math.min(input.negativeVarianceValue ?? 0, 1000) / 40;
    reasons.push("Financial loss exposure from variance");
  }

  if ((input.manualAdjustmentCount ?? 0) > 0) {
    score += (input.manualAdjustmentCount ?? 0) * 8;
    reasons.push("Manual adjustment activity");
  }

  if ((input.refundCount ?? 0) > 0) {
    score += (input.refundCount ?? 0) * 4;
    reasons.push("Refund activity linked to entity");
  }

  if ((input.voidCount ?? 0) > 0) {
    score += (input.voidCount ?? 0) * 4;
    reasons.push("Void activity linked to entity");
  }

  if ((input.priceOverrideCount ?? 0) > 0) {
    score += (input.priceOverrideCount ?? 0) * 5;
    reasons.push("Price override activity");
  }

  if ((input.transferMismatchCount ?? 0) > 0) {
    score += (input.transferMismatchCount ?? 0) * 10;
    reasons.push("Transfer mismatch activity");
  }

  if ((input.deliveryMismatchCount ?? 0) > 0) {
    score += (input.deliveryMismatchCount ?? 0) * 10;
    reasons.push("Delivery mismatch activity");
  }

  if ((input.cashVarianceCount ?? 0) > 0) {
    score += (input.cashVarianceCount ?? 0) * 8;
    reasons.push("Cash variance activity");
  }

  const finalScore = Math.min(100, Math.round(score));

  return {
    entityId: input.entityId,
    entityName: input.entityName,
    entityType: input.entityType,
    score: finalScore,
    riskLevel: classifyTheftRisk(finalScore),
    reasons,
  };
}
