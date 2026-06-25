import type { BIRiskLevel } from "../types/biTypes";

export interface StaffBehaviourInput {
  staffId: string;
  staffName?: string;
  branchId?: string;

  salesCount?: number;
  refundCount?: number;
  voidCount?: number;
  discountCount?: number;
  priceOverrideCount?: number;
  manualStockAdjustmentCount?: number;
  stockVarianceLinks?: number;
  cashVarianceCount?: number;
  cashVarianceValue?: number;
  approvalRequestCount?: number;
  lateShiftCloseCount?: number;
  drawerOpenWithoutSaleCount?: number;
  failedLoginCount?: number;
}

export interface StaffBehaviourResult {
  staffId: string;
  staffName?: string;
  branchId?: string;
  trustScore: number;
  riskScore: number;
  riskLevel: BIRiskLevel;
  strengths: string[];
  concerns: string[];
  recommendedActions: string[];
}

export function classifyStaffBehaviourRisk(score: number): BIRiskLevel {
  if (score >= 81) return "CRITICAL";
  if (score >= 61) return "HIGH";
  if (score >= 31) return "MEDIUM";
  return "LOW";
}

export function calculateStaffBehaviour(
  input: StaffBehaviourInput
): StaffBehaviourResult {
  let riskScore = 0;
  const strengths: string[] = [];
  const concerns: string[] = [];
  const recommendedActions: string[] = [];

  const salesCount = input.salesCount ?? 0;

  if ((input.refundCount ?? 0) > 0) {
    const refundRate = salesCount > 0 ? (input.refundCount ?? 0) / salesCount : input.refundCount ?? 0;
    riskScore += refundRate > 0.1 ? 18 : 8;
    concerns.push("Refund activity detected");
  }

  if ((input.voidCount ?? 0) > 0) {
    const voidRate = salesCount > 0 ? (input.voidCount ?? 0) / salesCount : input.voidCount ?? 0;
    riskScore += voidRate > 0.1 ? 18 : 8;
    concerns.push("Void activity detected");
  }

  if ((input.discountCount ?? 0) > 0) {
    riskScore += Math.min((input.discountCount ?? 0) * 4, 20);
    concerns.push("Discount activity requires review");
  }

  if ((input.priceOverrideCount ?? 0) > 0) {
    riskScore += Math.min((input.priceOverrideCount ?? 0) * 6, 24);
    concerns.push("Price override activity detected");
  }

  if ((input.manualStockAdjustmentCount ?? 0) > 0) {
    riskScore += Math.min((input.manualStockAdjustmentCount ?? 0) * 8, 24);
    concerns.push("Manual stock adjustment activity detected");
  }

  if ((input.stockVarianceLinks ?? 0) > 0) {
    riskScore += Math.min((input.stockVarianceLinks ?? 0) * 12, 36);
    concerns.push("Staff activity is linked to stock variance");
  }

  if ((input.cashVarianceCount ?? 0) > 0 || Math.abs(input.cashVarianceValue ?? 0) > 0) {
    riskScore += Math.min((input.cashVarianceCount ?? 0) * 12 + Math.abs(input.cashVarianceValue ?? 0) / 20, 35);
    concerns.push("Cash variance linked to staff");
  }

  if ((input.drawerOpenWithoutSaleCount ?? 0) > 0) {
    riskScore += Math.min((input.drawerOpenWithoutSaleCount ?? 0) * 8, 32);
    concerns.push("Drawer opened without sale");
  }

  if ((input.failedLoginCount ?? 0) > 0) {
    riskScore += Math.min((input.failedLoginCount ?? 0) * 5, 15);
    concerns.push("Failed login attempts detected");
  }

  if ((input.lateShiftCloseCount ?? 0) > 0) {
    riskScore += Math.min((input.lateShiftCloseCount ?? 0) * 5, 15);
    concerns.push("Late shift closure detected");
  }

  riskScore = Math.min(100, Math.round(riskScore));
  const trustScore = Math.max(0, 100 - riskScore);
  const riskLevel = classifyStaffBehaviourRisk(riskScore);

  if (trustScore >= 80) strengths.push("Strong operational discipline");
  if (salesCount > 0 && concerns.length === 0) strengths.push("Clean transaction behaviour");

  if (riskLevel === "HIGH" || riskLevel === "CRITICAL") {
    recommendedActions.push("Supervisor review required");
    recommendedActions.push("Review refunds, voids, discounts, cash movements, and stock variance links");
  }

  if ((input.stockVarianceLinks ?? 0) > 0) {
    recommendedActions.push("Assign independent stocktake review for products handled by this staff member");
  }

  if ((input.cashVarianceCount ?? 0) > 0) {
    recommendedActions.push("Review shift close records and cash drawer activity");
  }

  if (recommendedActions.length === 0) {
    recommendedActions.push("Continue normal monitoring");
  }

  return {
    staffId: input.staffId,
    staffName: input.staffName,
    branchId: input.branchId,
    trustScore,
    riskScore,
    riskLevel,
    strengths,
    concerns,
    recommendedActions,
  };
}
