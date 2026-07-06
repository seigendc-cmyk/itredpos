export interface AuditLogRecord {
  auditId: string;
  vendorId: string;
  branchId?: string;
  terminalId?: string;
  eventType: string;
  message: string;
  performedBy: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}
