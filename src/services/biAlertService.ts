export type BIAlertType =
  | "STOCK_RISK"
  | "CASHIER_RISK"
  | "THEFT_VARIANCE"
  | "DELIVERY_FULFILMENT"
  | "MISSING_CASH_CONFIRMATION"
  | "SUSPICIOUS_TRANSACTION";

export type BIAlertSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type BIAlertStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED";

export interface BIAlert {
  id: string;
  vendorId: string;
  branchId?: string;
  staffId?: string;
  productId?: string;
  transactionId?: string;
  deliveryId?: string;
  alertType: BIAlertType;
  severity: BIAlertSeverity;
  title: string;
  reason: string;
  recommendedAction: string;
  status: BIAlertStatus;
  createdAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  acknowledgedBy?: string;
  resolvedBy?: string;
  sourceLogIds: string[];
}

export interface BIAlertInput {
  vendorId: string;
  branchId?: string;
  staffId?: string;
  productId?: string;
  transactionId?: string;
  deliveryId?: string;
  alertType: BIAlertType;
  severity: BIAlertSeverity;
  title: string;
  reason: string;
  recommendedAction: string;
  sourceLogIds?: string[];
}

export interface BIAlertEvaluationInput {
  vendorId: string;
  branchId?: string;
  staffId?: string;
  productId?: string;
  transactionId?: string;
  deliveryId?: string;

  stockRiskScore?: number;
  cashierRiskScore?: number;
  deliveryCompletionScore?: number;

  negativeStockCount?: number;
  repeatedVarianceCount?: number;
  unapprovedAdjustmentCount?: number;

  highRefundCount?: number;
  excessiveVoidCount?: number;
  suspiciousDiscountCount?: number;
  cashDrawerVarianceCount?: number;

  missingCashConfirmationCount?: number;
  lateDeliveryCount?: number;
  deliveryCodeNotConfirmedCount?: number;
  stuckDeliveryCount?: number;

  modifiedCompletedTransactionCount?: number;
  missingApprovalCount?: number;

  sourceLogIds?: string[];
}

const getStorageKey = (vendorId: string): string =>
  `itredpos_bi_alerts_${vendorId}`;

const nowIso = (): string => new Date().toISOString();

const safeRandomId = (): string => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `bi_alert_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const clampScore = (value: number | undefined): number => {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, value));
};

const createDuplicateKey = (
  alert: Pick<
    BIAlert,
    | "vendorId"
    | "alertType"
    | "branchId"
    | "staffId"
    | "productId"
    | "transactionId"
    | "deliveryId"
    | "createdAt"
  >,
): string =>
  [
    alert.vendorId,
    alert.alertType,
    alert.branchId ?? "none",
    alert.staffId ?? "none",
    alert.productId ?? "none",
    alert.transactionId ?? "none",
    alert.deliveryId ?? "none",
    alert.createdAt.slice(0, 10),
  ].join("__");

const readLocalAlerts = (vendorId: string): BIAlert[] => {
  if (typeof localStorage === "undefined") return [];

  try {
    const raw = localStorage.getItem(getStorageKey(vendorId));
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as BIAlert[]) : [];
  } catch {
    return [];
  }
};

const writeLocalAlerts = (vendorId: string, alerts: BIAlert[]): void => {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(getStorageKey(vendorId), JSON.stringify(alerts));
};

const getStockSeverity = (score: number): BIAlertSeverity => {
  if (score >= 85) return "CRITICAL";
  if (score >= 70) return "HIGH";
  return "MEDIUM";
};

const getCashierSeverity = (score: number): BIAlertSeverity => {
  if (score >= 85) return "CRITICAL";
  if (score >= 70) return "HIGH";
  return "MEDIUM";
};

const getDeliverySeverity = (
  input: BIAlertEvaluationInput,
): BIAlertSeverity => {
  if ((input.missingCashConfirmationCount ?? 0) > 0) return "CRITICAL";
  if ((input.deliveryCodeNotConfirmedCount ?? 0) > 0) return "HIGH";
  return "MEDIUM";
};

const getSuspiciousTransactionSeverity = (
  input: BIAlertEvaluationInput,
): BIAlertSeverity => {
  const riskyCount =
    (input.highRefundCount ?? 0) +
    (input.excessiveVoidCount ?? 0) +
    (input.suspiciousDiscountCount ?? 0) +
    (input.modifiedCompletedTransactionCount ?? 0);

  if ((input.missingApprovalCount ?? 0) > 0 && riskyCount >= 3) {
    return "CRITICAL";
  }

  if (riskyCount >= 3) return "HIGH";
  return "MEDIUM";
};

export const createBIAlert = (input: BIAlertInput): BIAlert => ({
  id: safeRandomId(),
  vendorId: input.vendorId,
  branchId: input.branchId,
  staffId: input.staffId,
  productId: input.productId,
  transactionId: input.transactionId,
  deliveryId: input.deliveryId,
  alertType: input.alertType,
  severity: input.severity,
  title: input.title,
  reason: input.reason,
  recommendedAction: input.recommendedAction,
  status: "OPEN",
  createdAt: nowIso(),
  sourceLogIds: input.sourceLogIds ?? [],
});

export const getBIAlerts = async (vendorId: string): Promise<BIAlert[]> => {
  return readLocalAlerts(vendorId).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
};

export const getActiveBIAlerts = async (
  vendorId: string,
): Promise<BIAlert[]> => {
  const alerts = await getBIAlerts(vendorId);
  return alerts.filter((alert) => alert.status !== "RESOLVED");
};

export const writeBIAlert = async (input: BIAlertInput): Promise<BIAlert> => {
  const existingAlerts = await getBIAlerts(input.vendorId);
  const newAlert = createBIAlert(input);
  const newDuplicateKey = createDuplicateKey(newAlert);

  const duplicate = existingAlerts.find(
    (alert) => createDuplicateKey(alert) === newDuplicateKey,
  );

  if (duplicate) return duplicate;

  const nextAlerts = [newAlert, ...existingAlerts];
  writeLocalAlerts(input.vendorId, nextAlerts);

  return newAlert;
};

export const updateBIAlertStatus = async (
  vendorId: string,
  alertId: string,
  status: BIAlertStatus,
  actorId?: string,
): Promise<BIAlert | null> => {
  const alerts = await getBIAlerts(vendorId);
  const timestamp = nowIso();

  let updatedAlert: BIAlert | null = null;

  const nextAlerts = alerts.map((alert) => {
    if (alert.id !== alertId) return alert;

    updatedAlert = {
      ...alert,
      status,
      acknowledgedAt:
        status === "ACKNOWLEDGED" ? timestamp : alert.acknowledgedAt,
      acknowledgedBy:
        status === "ACKNOWLEDGED" ? actorId : alert.acknowledgedBy,
      resolvedAt: status === "RESOLVED" ? timestamp : alert.resolvedAt,
      resolvedBy: status === "RESOLVED" ? actorId : alert.resolvedBy,
    };

    return updatedAlert;
  });

  writeLocalAlerts(vendorId, nextAlerts);

  return updatedAlert;
};

export const acknowledgeBIAlert = async (
  vendorId: string,
  alertId: string,
  actorId?: string,
): Promise<BIAlert | null> =>
  updateBIAlertStatus(vendorId, alertId, "ACKNOWLEDGED", actorId);

export const resolveBIAlert = async (
  vendorId: string,
  alertId: string,
  actorId?: string,
): Promise<BIAlert | null> =>
  updateBIAlertStatus(vendorId, alertId, "RESOLVED", actorId);

export const evaluateBIAlerts = (
  input: BIAlertEvaluationInput,
): BIAlertInput[] => {
  const alerts: BIAlertInput[] = [];

  const stockRiskScore = clampScore(input.stockRiskScore);
  const cashierRiskScore = clampScore(input.cashierRiskScore);
  const deliveryCompletionScore = clampScore(input.deliveryCompletionScore);
  const sourceLogIds = input.sourceLogIds ?? [];

  if (
    stockRiskScore >= 70 ||
    (input.negativeStockCount ?? 0) > 0 ||
    (input.repeatedVarianceCount ?? 0) > 0 ||
    (input.unapprovedAdjustmentCount ?? 0) > 0
  ) {
    alerts.push({
      vendorId: input.vendorId,
      branchId: input.branchId,
      productId: input.productId,
      alertType: "STOCK_RISK",
      severity: getStockSeverity(stockRiskScore),
      title: "Stock Risk Alert",
      reason: `Stock risk score is ${stockRiskScore}. Negative stock: ${
        input.negativeStockCount ?? 0
      }. Repeated variances: ${
        input.repeatedVarianceCount ?? 0
      }. Unapproved adjustments: ${input.unapprovedAdjustmentCount ?? 0}.`,
      recommendedAction:
        "Review stock movement logs, approve or reject pending adjustments, and perform a supervised stock count.",
      sourceLogIds,
    });
  }

  if (
    cashierRiskScore >= 70 ||
    (input.highRefundCount ?? 0) > 0 ||
    (input.excessiveVoidCount ?? 0) > 0 ||
    (input.suspiciousDiscountCount ?? 0) > 0 ||
    (input.cashDrawerVarianceCount ?? 0) > 0
  ) {
    alerts.push({
      vendorId: input.vendorId,
      branchId: input.branchId,
      staffId: input.staffId,
      alertType: "CASHIER_RISK",
      severity: getCashierSeverity(cashierRiskScore),
      title: "Cashier Risk Alert",
      reason: `Cashier risk score is ${cashierRiskScore}. Refunds: ${
        input.highRefundCount ?? 0
      }. Voids: ${input.excessiveVoidCount ?? 0}. Suspicious discounts: ${
        input.suspiciousDiscountCount ?? 0
      }. Cash drawer variances: ${input.cashDrawerVarianceCount ?? 0}.`,
      recommendedAction:
        "Review cashier shift, refund, void, discount, and cash drawer logs before closing the trading day.",
      sourceLogIds,
    });
  }

  if (
    (input.repeatedVarianceCount ?? 0) > 0 ||
    (input.unapprovedAdjustmentCount ?? 0) > 0
  ) {
    const repeated = (input.repeatedVarianceCount ?? 0) > 1;
    const unapproved = (input.unapprovedAdjustmentCount ?? 0) > 0;

    alerts.push({
      vendorId: input.vendorId,
      branchId: input.branchId,
      productId: input.productId,
      alertType: "THEFT_VARIANCE",
      severity:
        repeated && unapproved ? "CRITICAL" : repeated ? "HIGH" : "MEDIUM",
      title: "Theft / Variance Alert",
      reason: `Variance pattern detected. Repeated variances: ${
        input.repeatedVarianceCount ?? 0
      }. Unapproved adjustments: ${input.unapprovedAdjustmentCount ?? 0}.`,
      recommendedAction:
        "Lock further stock adjustment for the item until Owner/SysAdmin reviews the variance and physical stock count.",
      sourceLogIds,
    });
  }

  if (
    (deliveryCompletionScore > 0 && deliveryCompletionScore < 80) ||
    (input.lateDeliveryCount ?? 0) > 0 ||
    (input.deliveryCodeNotConfirmedCount ?? 0) > 0 ||
    (input.stuckDeliveryCount ?? 0) > 0
  ) {
    alerts.push({
      vendorId: input.vendorId,
      branchId: input.branchId,
      deliveryId: input.deliveryId,
      alertType: "DELIVERY_FULFILMENT",
      severity: getDeliverySeverity(input),
      title: "Delivery Fulfilment Alert",
      reason: `Delivery completion score is ${deliveryCompletionScore}. Late deliveries: ${
        input.lateDeliveryCount ?? 0
      }. Unconfirmed delivery codes: ${
        input.deliveryCodeNotConfirmedCount ?? 0
      }. Stuck deliveries: ${input.stuckDeliveryCount ?? 0}.`,
      recommendedAction:
        "Contact delivery team, verify customer confirmation code, and resolve stuck dispatched or in-transit orders.",
      sourceLogIds,
    });
  }

  if ((input.missingCashConfirmationCount ?? 0) > 0) {
    alerts.push({
      vendorId: input.vendorId,
      branchId: input.branchId,
      deliveryId: input.deliveryId,
      alertType: "MISSING_CASH_CONFIRMATION",
      severity: "HIGH",
      title: "Missing Cash Confirmation",
      reason: `There are ${
        input.missingCashConfirmationCount ?? 0
      } completed delivery orders without confirmed cash receipt.`,
      recommendedAction:
        "Require delivery cash handover confirmation before closing the shift or releasing the next delivery batch.",
      sourceLogIds,
    });
  }

  if (
    (input.highRefundCount ?? 0) > 0 ||
    (input.excessiveVoidCount ?? 0) > 0 ||
    (input.suspiciousDiscountCount ?? 0) > 0 ||
    (input.modifiedCompletedTransactionCount ?? 0) > 0 ||
    (input.missingApprovalCount ?? 0) > 0
  ) {
    alerts.push({
      vendorId: input.vendorId,
      branchId: input.branchId,
      staffId: input.staffId,
      transactionId: input.transactionId,
      alertType: "SUSPICIOUS_TRANSACTION",
      severity: getSuspiciousTransactionSeverity(input),
      title: "Suspicious Transaction Alert",
      reason: `Risky transaction activity detected. Refunds: ${
        input.highRefundCount ?? 0
      }. Voids: ${input.excessiveVoidCount ?? 0}. Discounts: ${
        input.suspiciousDiscountCount ?? 0
      }. Modified completed transactions: ${
        input.modifiedCompletedTransactionCount ?? 0
      }. Missing approvals: ${input.missingApprovalCount ?? 0}.`,
      recommendedAction:
        "Review transaction audit trail and require manager approval for any correction, refund, void, or discount pattern.",
      sourceLogIds,
    });
  }

  return alerts;
};

export const generateAndPersistBIAlerts = async (
  input: BIAlertEvaluationInput,
): Promise<BIAlert[]> => {
  const alertInputs = evaluateBIAlerts(input);
  const savedAlerts: BIAlert[] = [];

  for (const alertInput of alertInputs) {
    const savedAlert = await writeBIAlert(alertInput);
    savedAlerts.push(savedAlert);
  }

  return savedAlerts;
};
