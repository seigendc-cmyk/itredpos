import type { BIRiskLevel } from "../types/biTypes";

export interface ProfitProtectionInput {
  salesValue: number;
  cogsValue: number;
  stockVarianceLoss?: number;
  discountLeakage?: number;
  refundLoss?: number;
  writeOffLoss?: number;
  cashVarianceLoss?: number;
  deliveryLoss?: number;
}

export interface ProfitProtectionResult {
  salesValue: number;
  cogsValue: number;
  grossProfit: number;
  totalLeakage: number;
  protectedProfit: number;
  protectedProfitMarginPercent: number;
  riskLevel: BIRiskLevel;
  reasons: string[];
}

export function calculateProfitProtection(
  input: ProfitProtectionInput
): ProfitProtectionResult {
  const grossProfit = input.salesValue - input.cogsValue;

  const totalLeakage =
    (input.stockVarianceLoss ?? 0) +
    (input.discountLeakage ?? 0) +
    (input.refundLoss ?? 0) +
    (input.writeOffLoss ?? 0) +
    (input.cashVarianceLoss ?? 0) +
    (input.deliveryLoss ?? 0);

  const protectedProfit = grossProfit - totalLeakage;

  const protectedProfitMarginPercent =
    input.salesValue === 0 ? 0 : (protectedProfit / input.salesValue) * 100;

  const reasons: string[] = [];
  let riskLevel: BIRiskLevel = "LOW";

  if (protectedProfit < 0) {
    riskLevel = "CRITICAL";
    reasons.push("Protected profit is negative");
  } else if (grossProfit > 0 && totalLeakage / grossProfit >= 0.5) {
    riskLevel = "HIGH";
    reasons.push("Leakage is consuming more than half of gross profit");
  } else if (grossProfit > 0 && totalLeakage / grossProfit >= 0.25) {
    riskLevel = "MEDIUM";
    reasons.push("Leakage is materially reducing gross profit");
  } else {
    reasons.push("Protected profit is within acceptable range");
  }

  return {
    salesValue: Number(input.salesValue.toFixed(2)),
    cogsValue: Number(input.cogsValue.toFixed(2)),
    grossProfit: Number(grossProfit.toFixed(2)),
    totalLeakage: Number(totalLeakage.toFixed(2)),
    protectedProfit: Number(protectedProfit.toFixed(2)),
    protectedProfitMarginPercent: Number(
      protectedProfitMarginPercent.toFixed(2)
    ),
    riskLevel,
    reasons,
  };
}
