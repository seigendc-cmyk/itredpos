import type { BIAlert, BIRecommendation, BIRiskScore } from "../types/biTypes";

export interface BIDashboardSummary {
  businessHealthScore: number;
  criticalAlerts: number;
  highAlerts: number;
  openRecommendations: number;
  topRisks: BIRiskScore[];
  priorityAlerts: BIAlert[];
  priorityRecommendations: BIRecommendation[];
}

export function buildBIDashboardSummary(input: {
  alerts: BIAlert[];
  recommendations: BIRecommendation[];
  riskScores: BIRiskScore[];
}): BIDashboardSummary {
  const openAlerts = input.alerts.filter((alert) => alert.status === "OPEN");

  const criticalAlerts = openAlerts.filter(
    (alert) => alert.severity === "CRITICAL"
  ).length;

  const highAlerts = openAlerts.filter(
    (alert) => alert.severity === "HIGH"
  ).length;

  const openRecommendations = input.recommendations.filter(
    (recommendation) => recommendation.status === "OPEN"
  ).length;

  const averageRisk =
    input.riskScores.length === 0
      ? 0
      : input.riskScores.reduce((total, risk) => total + risk.score, 0) /
        input.riskScores.length;

  const businessHealthScore = Math.max(0, Math.round(100 - averageRisk));

  const topRisks = [...input.riskScores]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const priorityAlerts = [...openAlerts].slice(0, 5);

  const priorityRecommendations = input.recommendations
    .filter((recommendation) => recommendation.status === "OPEN")
    .slice(0, 5);

  return {
    businessHealthScore,
    criticalAlerts,
    highAlerts,
    openRecommendations,
    topRisks,
    priorityAlerts,
    priorityRecommendations,
  };
}
