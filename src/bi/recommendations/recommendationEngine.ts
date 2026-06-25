import type { BIBaseScope, BIRecommendation } from "../types/biTypes";

export interface CreateBIRecommendationInput extends BIBaseScope {
  title: string;
  observation: string;
  reason: string;
  risk: string;
  recommendedAction: string;
  expectedBenefit?: string;
  priority: BIRecommendation["priority"];
}

export function createBIRecommendation(
  input: CreateBIRecommendationInput
): BIRecommendation {
  return {
    recommendationId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: "OPEN",
    ...input,
  };
}

export function prioritizeRecommendations(
  recommendations: BIRecommendation[]
): BIRecommendation[] {
  const priorityWeight: Record<BIRecommendation["priority"], number> = {
    URGENT: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
  };

  return [...recommendations].sort(
    (a, b) => priorityWeight[b.priority] - priorityWeight[a.priority]
  );
}
