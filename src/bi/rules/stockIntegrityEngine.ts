import type { BIRiskLevel } from "../types/biTypes";

export interface StockIntegrityInput {
  productId: string;
  productName?: string;
  openingStock: number;
  stockReceived: number;
  transfersIn: number;
  customerReturns: number;
  sales: number;
  transfersOut: number;
  supplierReturns: number;
  writeOffs: number;
  approvedAdjustments: number;
  physicalStock?: number;
  unitCost?: number;
  unitSellingPrice?: number;
}

export interface StockIntegrityResult {
  productId: string;
  productName?: string;
  expectedStock: number;
  physicalStock?: number;
  varianceQuantity?: number;
  varianceCostValue?: number;
  varianceSellingValue?: number;
  integrityScore: number;
  riskLevel: BIRiskLevel;
  reasons: string[];
}

export function calculateExpectedStock(input: StockIntegrityInput): number {
  return (
    input.openingStock +
    input.stockReceived +
    input.transfersIn +
    input.customerReturns -
    input.sales -
    input.transfersOut -
    input.supplierReturns -
    input.writeOffs -
    input.approvedAdjustments
  );
}

export function classifyStockRisk(
  varianceQuantity: number,
  expectedStock: number
): BIRiskLevel {
  const absoluteVariance = Math.abs(varianceQuantity);

  if (absoluteVariance === 0) return "LOW";

  const varianceRate =
    expectedStock === 0 ? absoluteVariance : absoluteVariance / Math.abs(expectedStock);

  if (varianceRate >= 0.25) return "CRITICAL";
  if (varianceRate >= 0.15) return "HIGH";
  if (varianceRate >= 0.05) return "MEDIUM";

  return "LOW";
}

export function calculateStockIntegrity(
  input: StockIntegrityInput
): StockIntegrityResult {
  const expectedStock = calculateExpectedStock(input);
  const reasons: string[] = [];

  if (input.physicalStock === undefined) {
    return {
      productId: input.productId,
      productName: input.productName,
      expectedStock,
      integrityScore: 100,
      riskLevel: "LOW",
      reasons: ["No physical count submitted yet"],
    };
  }

  const varianceQuantity = input.physicalStock - expectedStock;
  const varianceCostValue = varianceQuantity * (input.unitCost ?? 0);
  const varianceSellingValue = varianceQuantity * (input.unitSellingPrice ?? 0);

  const varianceRate =
    expectedStock === 0 ? Math.abs(varianceQuantity) : Math.abs(varianceQuantity) / Math.abs(expectedStock);

  const integrityScore = Math.max(0, Math.round(100 - varianceRate * 100));
  const riskLevel = classifyStockRisk(varianceQuantity, expectedStock);

  if (varianceQuantity < 0) {
    reasons.push("Physical stock is lower than expected stock");
  }

  if (varianceQuantity > 0) {
    reasons.push("Physical stock is higher than expected stock");
  }

  if (riskLevel === "HIGH" || riskLevel === "CRITICAL") {
    reasons.push("Variance is above safe threshold");
  }

  return {
    productId: input.productId,
    productName: input.productName,
    expectedStock,
    physicalStock: input.physicalStock,
    varianceQuantity,
    varianceCostValue,
    varianceSellingValue,
    integrityScore,
    riskLevel,
    reasons,
  };
}
