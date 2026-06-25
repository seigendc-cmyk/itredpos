import type { BIBaseScope, BIAlert } from "../types/biTypes";

export interface CreateBIAlertInput extends BIBaseScope {
  alertType: string;
  severity: BIAlert["severity"];
  title: string;
  description: string;
  entityType?: string;
  entityId?: string;
  financialImpact?: number;
  recommendedAction?: string;
}

export function createBIAlert(input: CreateBIAlertInput): BIAlert {
  return {
    alertId: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
    status: "OPEN",
    ...input,
  };
}
