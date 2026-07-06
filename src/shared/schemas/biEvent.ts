export interface BiEventRecord {
  eventId: string;
  eventType: string;
  vendorId: string;
  branchId?: string;
  terminalId?: string;
  userId?: string;
  role?: string;
  timestamp: string;
  entityType?: string;
  entityId?: string;
  amount?: number;
  quantity?: number;
  severity: "Info" | "Warning" | "Error" | "Critical";
  actionRequired: boolean;
  metadata?: Record<string, unknown>;
}
