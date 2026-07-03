import type { SCIPOSActivationRecord } from "./licensingTypes";

export type SCIPOSActivationDecisionCode =
  | "ACTIVATION_ACTIVE"
  | "NO_ACTIVATION_FOUND"
  | "ACTIVATION_PENDING"
  | "ACTIVATION_SUSPENDED"
  | "ACTIVATION_EXPIRED"
  | "ACTIVATION_REVOKED"
  | "EMAIL_NOT_LINKED"
  | "INVALID_STORAGE_MODE";

export interface SCIPOSActivationDecision {
  allowed: boolean;
  reasonCode: SCIPOSActivationDecisionCode;
  message: string;
  activation?: SCIPOSActivationRecord;
}

export function validateSCIActivationForEmail(input: {
  email: string;
  activations: SCIPOSActivationRecord[];
}): SCIPOSActivationDecision {
  const email = input.email.trim().toLowerCase();

  const activation = input.activations.find(
    (item) => item.ownerEmail.trim().toLowerCase() === email
  );

  if (!activation) {
    return {
      allowed: false,
      reasonCode: "NO_ACTIVATION_FOUND",
      message: "No POS activation exists for this Google account.",
    };
  }

  if (activation.status === "pending") {
    return {
      allowed: false,
      reasonCode: "ACTIVATION_PENDING",
      message: "POS activation is pending approval.",
      activation,
    };
  }

  if (activation.status === "suspended") {
    return {
      allowed: false,
      reasonCode: "ACTIVATION_SUSPENDED",
      message: "POS activation has been suspended.",
      activation,
    };
  }

  if (activation.status === "revoked") {
    return {
      allowed: false,
      reasonCode: "ACTIVATION_REVOKED",
      message: "POS activation has been revoked.",
      activation,
    };
  }

  if (activation.status === "expired" || new Date(activation.expiresAt) < new Date()) {
    return {
      allowed: false,
      reasonCode: "ACTIVATION_EXPIRED",
      message: "POS activation has expired.",
      activation,
    };
  }

  if (activation.licenseMode === "production" && activation.storageMode !== "cloud") {
    return {
      allowed: false,
      reasonCode: "INVALID_STORAGE_MODE",
      message: "Production POS activation must use cloud storage mode.",
      activation,
    };
  }

  return {
    allowed: true,
    reasonCode: "ACTIVATION_ACTIVE",
    message: "POS activation is active.",
    activation,
  };
}
