import type { BIEvent, BIBaseScope } from "../types/biTypes";

export interface CreateBIEventInput extends BIBaseScope {
  eventType: string;
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

  approvalStatus?: BIEvent["approvalStatus"];
  riskFlag?: boolean;
  riskLevel?: BIEvent["riskLevel"];

  metadata?: Record<string, unknown>;
}

export function createBIEvent(input: CreateBIEventInput): BIEvent {
  return {
    eventId: crypto.randomUUID(),
    eventTimestamp: new Date().toISOString(),
    ...input,
  };
}

export function validateBIEvent(event: BIEvent): string[] {
  const errors: string[] = [];

  if (!event.eventId) errors.push("eventId is required");
  if (!event.eventType) errors.push("eventType is required");
  if (!event.eventTimestamp) errors.push("eventTimestamp is required");
  if (!event.vendorId) errors.push("vendorId is required");
  if (!event.sourceModule) errors.push("sourceModule is required");

  return errors;
}
