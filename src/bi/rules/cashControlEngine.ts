import type { BIRiskLevel } from "../types/biTypes";

export interface CashControlInput {
  staffId?: string;
  branchId?: string;
  terminalId?: string;

  openingFloat: number;
  cashSales: number;
  cashRefunds?: number;
  paidOuts?: number;
  countedCash: number;

  drawerOpenWithoutSaleCount?: number;
  previousVarianceCount?: number;
  deliveryCashExpected?: number;
  deliveryCashRemitted?: number;
}

export interface CashControlResult {
  expectedCash: number;
  countedCash: number;
  variance: number;
  deliveryCashVariance: number;
  totalCashExposure: number;
  riskLevel: BIRiskLevel;
  reasons: string[];
}

export function calculateCashControl(
  input: CashControlInput
): CashControlResult {
  const expectedCash =
    input.openingFloat +
    input.cashSales -
    (input.cashRefunds ?? 0) -
    (input.paidOuts ?? 0);

  const variance = input.countedCash - expectedCash;

  const deliveryCashVariance =
    (input.deliveryCashRemitted ?? 0) - (input.deliveryCashExpected ?? 0);

  const totalCashExposure =
    Math.abs(variance) + Math.abs(deliveryCashVariance);

  const reasons: string[] = [];
  let riskLevel: BIRiskLevel = "LOW";

  if (variance < 0) reasons.push("Cash shortage detected");
  if (variance > 0) reasons.push("Cash overage detected");

  if (deliveryCashVariance < 0) {
    reasons.push("Delivery cash not fully remitted");
  }

  if ((input.drawerOpenWithoutSaleCount ?? 0) > 0) {
    reasons.push("Cash drawer opened without sale");
  }

  if ((input.previousVarianceCount ?? 0) > 0) {
    reasons.push("Previous cash variance history exists");
  }

  if (totalCashExposure >= 500) {
    riskLevel = "CRITICAL";
  } else if (totalCashExposure >= 100) {
    riskLevel = "HIGH";
  } else if (
    totalCashExposure > 0 ||
    (input.drawerOpenWithoutSaleCount ?? 0) > 0
  ) {
    riskLevel = "MEDIUM";
  }

  if (reasons.length === 0) {
    reasons.push("Cash control is within acceptable range");
  }

  return {
    expectedCash: Number(expectedCash.toFixed(2)),
    countedCash: Number(input.countedCash.toFixed(2)),
    variance: Number(variance.toFixed(2)),
    deliveryCashVariance: Number(deliveryCashVariance.toFixed(2)),
    totalCashExposure: Number(totalCashExposure.toFixed(2)),
    riskLevel,
    reasons,
  };
}
