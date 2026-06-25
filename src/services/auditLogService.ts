export type AuditEventType =
  | "BI_DASHBOARD_OPENED"
  | "BI_FILTER_CHANGED"
  | "BI_DRILLDOWN_OPENED"
  | "BI_ALERT_CREATED"
  | "BI_ALERT_ACKNOWLEDGED"
  | "BI_ALERT_RESOLVED"
  | "BI_ALERT_VIEWED"
  | "BI_OWNER_NOTIFICATION_CREATED";

export interface AuditLogEntry {
  id: string;
  vendorId: string;
  branchId?: string;
  staffId?: string;
  actorId?: string;
  actorRole?: string;
  eventType: AuditEventType;
  message: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface WriteAuditLogInput {
  vendorId: string;
  branchId?: string;
  staffId?: string;
  actorId?: string;
  actorRole?: string;
  eventType: AuditEventType;
  message: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

const getStorageKey = (vendorId: string): string =>
  `itredpos_audit_logs_${vendorId}`;

const nowIso = (): string => new Date().toISOString();

const safeRandomId = (): string => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `audit_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const readLocalAuditLogs = (vendorId: string): AuditLogEntry[] => {
  if (typeof localStorage === "undefined") return [];

  try {
    const raw = localStorage.getItem(getStorageKey(vendorId));
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AuditLogEntry[]) : [];
  } catch {
    return [];
  }
};

const writeLocalAuditLogs = (vendorId: string, logs: AuditLogEntry[]): void => {
  if (typeof localStorage === "undefined") return;

  const cappedLogs = logs
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 500);

  localStorage.setItem(getStorageKey(vendorId), JSON.stringify(cappedLogs));
};

export const createAuditLogEntry = (
  input: WriteAuditLogInput,
): AuditLogEntry => ({
  id: safeRandomId(),
  vendorId: input.vendorId,
  branchId: input.branchId,
  staffId: input.staffId,
  actorId: input.actorId,
  actorRole: input.actorRole,
  eventType: input.eventType,
  message: input.message,
  entityType: input.entityType,
  entityId: input.entityId,
  metadata: input.metadata,
  createdAt: nowIso(),
});

export const writeAuditLog = async (
  input: WriteAuditLogInput,
): Promise<AuditLogEntry> => {
  const entry = createAuditLogEntry(input);
  const existingLogs = readLocalAuditLogs(input.vendorId);

  writeLocalAuditLogs(input.vendorId, [entry, ...existingLogs]);

  return entry;
};

export const getAuditLogs = async (
  vendorId: string,
): Promise<AuditLogEntry[]> => {
  return readLocalAuditLogs(vendorId).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
};

export const getAuditLogsByEventType = async (
  vendorId: string,
  eventType: AuditEventType,
): Promise<AuditLogEntry[]> => {
  const logs = await getAuditLogs(vendorId);
  return logs.filter((log) => log.eventType === eventType);
};

export const clearLocalAuditLogs = async (vendorId: string): Promise<void> => {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(getStorageKey(vendorId));
};
