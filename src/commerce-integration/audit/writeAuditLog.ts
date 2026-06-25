export interface AuditLogInput {
  vendorId: string;
  branchId?: string;
  warehouseId?: string;
  terminalId?: string;
  staffId?: string;
  application?: string;
  module: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  device?: Record<string, unknown> | null;
  ipAddress?: string | null;
  gps?: {
    lat: number;
    lng: number;
  } | null;
  riskScore?: number;
  correlationId?: string;
}

export interface AuditLog extends AuditLogInput {
  application: string;
  riskScore: number;
  createdAt: string;
}

export async function writeAuditLog(input: AuditLogInput): Promise<AuditLog> {
  const auditLog: AuditLog = {
    ...input,
    application: input.application ?? 'iTredPOS',
    riskScore: input.riskScore ?? 0,
    createdAt: new Date().toISOString(),
  };

  console.info('[AuditLog]', auditLog);

  return auditLog;
}
