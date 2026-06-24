import type { BIRiskLevel } from "../types/biTypes";

export interface COGSInput {
  productId: string;
  productName?: string;
  sellingPrice: number;
  purchaseCost: number;
  transportCost?: number;
  dutyCost?: number;
  packagingCost?: number;
  handlingCost?: number;
  branchTransferCost?: number;
  targetMarginPercent?: number;
}

export interface COGSResult {
  productId: string;
  productName?: string;
  trueCost: number;
  grossProfit: number;
  grossMarginPercent: number;
  targetMarginPercent: number;
  recommendedSellingPrice: number;
  riskLevel: BIRiskLevel;
  reasons: string[];
}

export function calculateTrueCost(input: COGSInput): number {
  return (
    input.purchaseCost +
    (input.transportCost ?? 0) +
    (input.dutyCost ?? 0) +
    (input.packagingCost ?? 0) +
    (input.handlingCost ?? 0) +
    (input.branchTransferCost ?? 0)
  );
}

export function calculateCOGS(input: COGSInput): COGSResult {
  const trueCost = calculateTrueCost(input);
  const grossProfit = input.sellingPrice - trueCost;
  const grossMarginPercent =
    input.sellingPrice === 0 ? 0 : (grossProfit / input.sellingPrice) * 100;

  const targetMarginPercent = input.targetMarginPercent ?? 25;
  const recommendedSellingPrice =
    trueCost / (1 - targetMarginPercent / 100);

  const reasons: string[] = [];
  let riskLevel: BIRiskLevel = "LOW";

  if (grossProfit < 0) {
    riskLevel = "CRITICAL";
    reasons.push("Product is being sold below true cost");
  } else if (grossMarginPercent < targetMarginPercent * 0.5) {
    riskLevel = "HIGH";
    reasons.push("Gross margin is far below target margin");
  } else if (grossMarginPercent < targetMarginPercent) {
    riskLevel = "MEDIUM";
    reasons.push("Gross margin is below target margin");
  } else {
    reasons.push("Gross margin is within safe range");
  }

  return {
    productId: input.productId,
    productName: input.productName,
    trueCost: Number(trueCost.toFixed(2)),
    grossProfit: Number(grossProfit.toFixed(2)),
    grossMarginPercent: Number(grossMarginPercent.toFixed(2)),
    targetMarginPercent,
    recommendedSellingPrice: Number(recommendedSellingPrice.toFixed(2)),
    riskLevel,
    reasons,
  };
}
