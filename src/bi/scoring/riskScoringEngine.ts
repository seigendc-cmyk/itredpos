import type { BIRiskLevel, BIRiskScore } from "../types/biTypes";

export interface RiskScoreInput {
  vendorId: string;
  branchId?: string;
  entityType: BIRiskScore["entityType"];
  entityId: string;
  baseScore?: number;
  riskFactors: Array<{
    reason: string;
    weight: number;
  }>;
}

export function classifyRiskScore(score: number): BIRiskLevel {
  if (score >= 81) return "CRITICAL";
  if (score >= 61) return "HIGH";
  if (score >= 31) return "MEDIUM";
  return "LOW";
}

export function calculateRiskScore(input: RiskScoreInput): BIRiskScore {
  const score = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        (input.baseScore ?? 0) +
          input.riskFactors.reduce((total, factor) => total + factor.weight, 0)
      )
    )
  );

  return {
    scoreId: crypto.randomUUID(),
    vendorId: input.vendorId,
    branchId: input.branchId,
    entityType: input.entityType,
    entityId: input.entityId,
    score,
    riskLevel: classifyRiskScore(score),
    reasons: input.riskFactors.map((factor) => factor.reason),
    lastCalculatedAt: new Date().toISOString(),
  };
}

export function applyRiskDecay(score: number, decayAmount = 5): number {
  return Math.max(0, score - decayAmount);
}
