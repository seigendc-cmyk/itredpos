import type { BIStocktakeTask } from "../types/biTypes";
import type { StockIntegrityResult } from "./stockIntegrityEngine";

export interface StocktakeCandidate {
  vendorId: string;
  branchId?: string;
  warehouseId?: string;
  productId: string;
  productName?: string;
  shelfId?: string;
  categoryId?: string;
  unitCost?: number;
  unitSellingPrice?: number;

  salesVelocity?: number;
  previousVarianceCount?: number;
  previousVarianceValue?: number;
  manualAdjustmentCount?: number;
  refundCount?: number;
  voidCount?: number;
  transferMismatchCount?: number;
  daysSinceLastCount?: number;
  isHighValue?: boolean;
  isFastMoving?: boolean;
}

export interface GenerateStocktakeTasksInput {
  candidates: StocktakeCandidate[];
  maxTasks?: number;
  createdBy?: string;
}

export function calculateStocktakePriority(candidate: StocktakeCandidate): number {
  let score = 0;

  if (candidate.isHighValue) score += 20;
  if (candidate.isFastMoving) score += 15;

  score += (candidate.previousVarianceCount ?? 0) * 10;
  score += Math.min(candidate.previousVarianceValue ?? 0, 1000) / 50;
  score += (candidate.manualAdjustmentCount ?? 0) * 8;
  score += (candidate.refundCount ?? 0) * 4;
  score += (candidate.voidCount ?? 0) * 4;
  score += (candidate.transferMismatchCount ?? 0) * 10;
  score += Math.min(candidate.daysSinceLastCount ?? 0, 90) / 3;

  return Math.round(score);
}

export function determineStocktakeTaskType(
  candidate: StocktakeCandidate
): BIStocktakeTask["taskType"] {
  if ((candidate.previousVarianceCount ?? 0) > 0) return "VARIANCE_FOLLOW_UP";
  if (candidate.isHighValue) return "HIGH_VALUE_COUNT";
  if (candidate.isFastMoving) return "FAST_MOVER_COUNT";
  if ((candidate.transferMismatchCount ?? 0) > 0) return "RISK_BASED_COUNT";

  return "RANDOM_SPOT_COUNT";
}

export function generateStocktakeTasks(
  input: GenerateStocktakeTasksInput
): BIStocktakeTask[] {
  const maxTasks = input.maxTasks ?? 10;

  return [...input.candidates]
    .sort(
      (a, b) =>
        calculateStocktakePriority(b) - calculateStocktakePriority(a)
    )
    .slice(0, maxTasks)
    .map((candidate) => ({
      taskId: crypto.randomUUID(),
      vendorId: candidate.vendorId,
      branchId: candidate.branchId,
      warehouseId: candidate.warehouseId,
      taskType: determineStocktakeTaskType(candidate),
      productId: candidate.productId,
      shelfId: candidate.shelfId,
      categoryId: candidate.categoryId,
      expectedQuantityHidden: true,
      createdAt: new Date().toISOString(),
      status: "OPEN",
    }));
}

export function shouldRequireSupervisorReview(
  result: StockIntegrityResult
): boolean {
  return result.riskLevel === "HIGH" || result.riskLevel === "CRITICAL";
}
