export type BIRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type BISeverity = "INFO" | "WARNING" | "HIGH" | "CRITICAL";

export type BIEventStatus = "OPEN" | "REVIEWED" | "RESOLVED" | "ARCHIVED";

export interface BIBaseScope {
  vendorId: string;
  branchId?: string;
  terminalId?: string;
  warehouseId?: string;
  staffId?: string;
  roleId?: string;
}

export interface BIEvent extends BIBaseScope {
  eventId: string;
  eventType: string;
  eventTimestamp: string;
  sourceModule: string;

  transactionReference?: string;
  productId?: string;
  productName?: string;
  categoryId?: string;
  shelfId?: string;
  supplierId?: string;
  customerId?: string;
  driverId?: string;

  quantity?: number;
  costValue?: number;
  sellingValue?: number;

  beforeValue?: unknown;
  afterValue?: unknown;

  approvalStatus?: "NOT_REQUIRED" | "PENDING" | "APPROVED" | "REJECTED";
  riskFlag?: boolean;
  riskLevel?: BIRiskLevel;

  metadata?: Record<string, unknown>;
}

export interface BIRiskScore extends BIBaseScope {
  scoreId: string;
  entityType:
    | "PRODUCT"
    | "SHELF"
    | "WAREHOUSE"
    | "BRANCH"
    | "STAFF"
    | "SUPPLIER"
    | "CUSTOMER"
    | "DRIVER"
    | "TERMINAL"
    | "CATEGORY";

  entityId: string;
  score: number;
  riskLevel: BIRiskLevel;
  reasons: string[];
  lastCalculatedAt: string;
}

export interface BIAlert extends BIBaseScope {
  alertId: string;
  alertType: string;
  severity: BISeverity;
  title: string;
  description: string;
  entityType?: string;
  entityId?: string;
  financialImpact?: number;
  recommendedAction?: string;
  status: BIEventStatus;
  createdAt: string;
  resolvedAt?: string;
}

export interface BIRecommendation extends BIBaseScope {
  recommendationId: string;
  title: string;
  observation: string;
  reason: string;
  risk: string;
  recommendedAction: string;
  expectedBenefit?: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  createdAt: string;
  status: "OPEN" | "ACCEPTED" | "DISMISSED" | "COMPLETED";
}

export interface BIStocktakeTask extends BIBaseScope {
  taskId: string;
  taskType:
    | "RANDOM_SPOT_COUNT"
    | "RISK_BASED_COUNT"
    | "FAST_MOVER_COUNT"
    | "HIGH_VALUE_COUNT"
    | "SHELF_COUNT"
    | "VARIANCE_FOLLOW_UP"
    | "STAFF_LINKED_COUNT"
    | "SUPPLIER_LINKED_COUNT"
    | "DELIVERY_LINKED_COUNT";

  productId?: string;
  shelfId?: string;
  categoryId?: string;

  expectedQuantityHidden: true;
  expectedQuantity?: number;
  submittedQuantity?: number;
  varianceQuantity?: number;
  varianceCostValue?: number;
  varianceSellingValue?: number;

  assignedToStaffId?: string;
  createdAt: string;
  submittedAt?: string;
  status: "OPEN" | "SUBMITTED" | "REVIEW_REQUIRED" | "RESOLVED";
}
