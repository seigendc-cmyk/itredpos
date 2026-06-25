import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  getActiveBIAlerts,
  updateBIAlertStatus,
} from "../../services/biAlertService";
import type {
  BIAlert,
  BIAlertSeverity,
  BIAlertStatus,
} from "../../services/biAlertService";

interface BIAlertPanelProps {
  alerts?: BIAlert[];
  vendorId?: string;
  terminalName?: string;
  canManage?: boolean;
  onViewDetails?: (alert: BIAlert) => void;
  onAcknowledge?: (alert: BIAlert) => void;
  onResolve?: (alert: BIAlert) => void;
}

const severityOrder: Record<BIAlertSeverity, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

const severityStyles: Record<BIAlertSeverity, CSSProperties> = {
  CRITICAL: {
    background: "#3b0d0d",
    color: "#fff",
    border: "1px solid #b91c1c",
  },
  HIGH: {
    background: "#4a2607",
    color: "#fff",
    border: "1px solid #f26a1b",
  },
  MEDIUM: {
    background: "#3b3208",
    color: "#fff",
    border: "1px solid #d6a500",
  },
  LOW: {
    background: "#132d1f",
    color: "#fff",
    border: "1px solid #16a34a",
  },
};

const statusStyles: Record<BIAlertStatus, CSSProperties> = {
  OPEN: {
    background: "#f26a1b",
    color: "#fff",
  },
  ACKNOWLEDGED: {
    background: "#1e222b",
    color: "#fff",
  },
  RESOLVED: {
    background: "#e5e7eb",
    color: "#374151",
  },
};

const formatDateTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export function BIAlertPanel({
  alerts,
  vendorId,
  terminalName,
  canManage = true,
  onViewDetails,
  onAcknowledge,
  onResolve,
}: BIAlertPanelProps) {
  const [localAlerts, setLocalAlerts] = useState<BIAlert[]>([]);
  const [severityFilter, setSeverityFilter] = useState<"ALL" | BIAlertSeverity>(
    "ALL",
  );
  const [statusFilter, setStatusFilter] = useState<"ALL" | BIAlertStatus>(
    "ALL",
  );
  const [searchTerm, setSearchTerm] = useState("");

  const alertsToUse = alerts || localAlerts;

  useEffect(() => {
    if (!alerts && vendorId) {
      const loadAlerts = async () => {
        try {
          const fetched = await getActiveBIAlerts(vendorId);
          setLocalAlerts(fetched);
        } catch (err) {
          console.error("Failed to load active BI alerts:", err);
        }
      };
      void loadAlerts();
    }
  }, [alerts, vendorId]);

  const handleAcknowledge = async (alert: BIAlert) => {
    if (onAcknowledge) {
      onAcknowledge(alert);
    } else if (vendorId) {
      try {
        const updated = await updateBIAlertStatus(vendorId, alert.id, "ACKNOWLEDGED");
        if (updated) {
          const fetched = await getActiveBIAlerts(vendorId);
          setLocalAlerts(fetched);
        }
      } catch (err) {
        console.error("Failed to acknowledge alert:", err);
      }
    }
  };

  const handleResolve = async (alert: BIAlert) => {
    if (onResolve) {
      onResolve(alert);
    } else if (vendorId) {
      try {
        const updated = await updateBIAlertStatus(vendorId, alert.id, "RESOLVED");
        if (updated) {
          const fetched = await getActiveBIAlerts(vendorId);
          setLocalAlerts(fetched);
        }
      } catch (err) {
        console.error("Failed to resolve alert:", err);
      }
    }
  };

  const filteredAlerts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return [...alertsToUse]
      .filter((alert) =>
        severityFilter === "ALL" ? true : alert.severity === severityFilter,
      )
      .filter((alert) =>
        statusFilter === "ALL" ? true : alert.status === statusFilter,
      )
      .filter((alert) => {
        if (!normalizedSearch) return true;

        return [
          alert.title,
          alert.reason,
          alert.recommendedAction,
          alert.branchId,
          alert.staffId,
          alert.productId,
          alert.transactionId,
          alert.deliveryId,
          alert.alertType,
          alert.severity,
          alert.status,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value).toLowerCase().includes(normalizedSearch),
          );
      })
      .sort((a, b) => {
        const severityDiff =
          severityOrder[b.severity] - severityOrder[a.severity];
        if (severityDiff !== 0) return severityDiff;
        return b.createdAt.localeCompare(a.createdAt);
      });
  }, [alertsToUse, searchTerm, severityFilter, statusFilter]);

  const openCount = alertsToUse.filter((alert) => alert.status === "OPEN").length;
  const criticalCount = alertsToUse.filter(
    (alert) => alert.severity === "CRITICAL" && alert.status !== "RESOLVED",
  ).length;
  const highCount = alertsToUse.filter(
    (alert) => alert.severity === "HIGH" && alert.status !== "RESOLVED",
  ).length;

  return (
    <section
      style={{
        background: "#f5f6f8",
        border: "1px solid #d8dde5",
        padding: "16px",
        borderRadius: 0,
      }}
    >
      <div
        style={{
          background: "#1e222b",
          color: "#fff",
          padding: "14px 16px",
          borderRadius: 0,
          borderLeft: "6px solid #f26a1b",
          display: "flex",
          justifyContent: "space-between",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 800 }}>
            Active BI Alerts
          </h2>
          <p style={{ margin: "4px 0 0", color: "#cbd5e1", fontSize: "13px" }}>
            Rule-based operational exceptions requiring Owner or SysAdmin
            review.
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <SummaryPill label="Open" value={openCount} />
          <SummaryPill label="Critical" value={criticalCount} />
          <SummaryPill label="High" value={highCount} />
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "10px",
          marginTop: "12px",
        }}
      >
        <label style={filterLabelStyle}>
          Severity
          <select
            value={severityFilter}
            onChange={(event) =>
              setSeverityFilter(event.target.value as "ALL" | BIAlertSeverity)
            }
            style={filterInputStyle}
          >
            <option value="ALL">All severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </label>

        <label style={filterLabelStyle}>
          Status
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as "ALL" | BIAlertStatus)
            }
            style={filterInputStyle}
          >
            <option value="ALL">All statuses</option>
            <option value="OPEN">Open</option>
            <option value="ACKNOWLEDGED">Acknowledged</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </label>

        <label style={filterLabelStyle}>
          Search
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search branch, staff, product, reason..."
            style={filterInputStyle}
          />
        </label>
      </div>

      <div style={{ marginTop: "14px", display: "grid", gap: "10px" }}>
        {filteredAlerts.length === 0 ? (
          <div
            style={{
              background: "#fff",
              border: "1px dashed #cbd5e1",
              padding: "16px",
              borderRadius: 0,
              color: "#475569",
              fontSize: "14px",
            }}
          >
            No BI alerts match the selected filters.
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <article
              key={alert.id}
              style={{
                background: "#fff",
                border: "1px solid #d8dde5",
                borderLeft:
                  alert.severity === "CRITICAL"
                    ? "6px solid #b91c1c"
                    : alert.severity === "HIGH"
                      ? "6px solid #f26a1b"
                      : "6px solid #1e222b",
                borderRadius: 0,
                padding: "14px",
                boxShadow:
                  alert.severity === "CRITICAL"
                    ? "0 0 0 2px rgba(185,28,28,0.10)"
                    : "none",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "10px",
                  flexWrap: "wrap",
                  alignItems: "flex-start",
                }}
              >
                <div>
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      flexWrap: "wrap",
                      marginBottom: "8px",
                    }}
                  >
                    <span
                      style={{
                        ...badgeStyle,
                        ...severityStyles[alert.severity],
                      }}
                    >
                      {alert.severity}
                    </span>
                    <span
                      style={{ ...badgeStyle, ...statusStyles[alert.status] }}
                    >
                      {alert.status}
                    </span>
                    <span
                      style={{
                        ...badgeStyle,
                        background: "#eef2f7",
                        color: "#1e222b",
                      }}
                    >
                      {alert.alertType.replaceAll("_", " ")}
                    </span>
                  </div>

                  <h3
                    style={{
                      margin: 0,
                      fontSize: "16px",
                      fontWeight: 800,
                      color: "#1e222b",
                    }}
                  >
                    {alert.title}
                  </h3>

                  <p
                    style={{
                      margin: "6px 0 0",
                      color: "#334155",
                      fontSize: "13px",
                      lineHeight: 1.5,
                    }}
                  >
                    {alert.reason}
                  </p>
                </div>

                <div
                  style={{
                    color: "#64748b",
                    fontSize: "12px",
                    minWidth: "150px",
                    textAlign: "right",
                  }}
                >
                  {formatDateTime(alert.createdAt)}
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: "8px",
                  marginTop: "12px",
                }}
              >
                <Meta label="Branch" value={alert.branchId} />
                <Meta label="Staff" value={alert.staffId} />
                <Meta label="Product" value={alert.productId} />
                <Meta label="Transaction" value={alert.transactionId} />
                <Meta label="Delivery" value={alert.deliveryId} />
              </div>

              <div
                style={{
                  marginTop: "12px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  padding: "10px",
                  borderRadius: 0,
                  color: "#1e293b",
                  fontSize: "13px",
                }}
              >
                <strong>Recommended action:</strong> {alert.recommendedAction}
              </div>

              <div
                style={{
                  marginTop: "12px",
                  display: "flex",
                  gap: "8px",
                  flexWrap: "wrap",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  type="button"
                  onClick={() => onViewDetails?.(alert)}
                  style={secondaryButtonStyle}
                >
                  View Details
                </button>

                {canManage && alert.status === "OPEN" ? (
                  <button
                    type="button"
                    onClick={() => handleAcknowledge(alert)}
                    style={secondaryButtonStyle}
                  >
                    Acknowledge
                  </button>
                ) : null}

                {canManage && alert.status !== "RESOLVED" ? (
                  <button
                    type="button"
                    onClick={() => handleResolve(alert)}
                    style={primaryButtonStyle}
                  >
                    Resolve
                  </button>
                ) : null}
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function SummaryPill({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.18)",
        padding: "8px 10px",
        minWidth: "82px",
        textAlign: "center",
        background: "rgba(255,255,255,0.06)",
        borderRadius: 0,
      }}
    >
      <div style={{ fontSize: "16px", fontWeight: 900 }}>{value}</div>
      <div
        style={{
          fontSize: "11px",
          color: "#cbd5e1",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value?: string }) {
  return (
    <div
      style={{
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        padding: "8px",
        borderRadius: 0,
      }}
    >
      <div
        style={{
          fontSize: "10px",
          color: "#64748b",
          textTransform: "uppercase",
          fontWeight: 800,
        }}
      >
        {label}
      </div>
      <div style={{ marginTop: "2px", fontSize: "12px", color: "#1e222b" }}>
        {value || "—"}
      </div>
    </div>
  );
}

const filterLabelStyle: CSSProperties = {
  display: "grid",
  gap: "4px",
  fontSize: "12px",
  fontWeight: 800,
  color: "#1e222b",
  textTransform: "uppercase",
};

const filterInputStyle: CSSProperties = {
  width: "100%",
  border: "1px solid #cbd5e1",
  padding: "9px 10px",
  borderRadius: 0,
  fontSize: "13px",
  background: "#fff",
  color: "#1e222b",
};

const badgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "4px 8px",
  borderRadius: 0,
  fontSize: "11px",
  fontWeight: 900,
  letterSpacing: "0.03em",
  textTransform: "uppercase",
};

const primaryButtonStyle: CSSProperties = {
  border: "1px solid #f26a1b",
  background: "#f26a1b",
  color: "#fff",
  padding: "8px 10px",
  borderRadius: 0,
  fontSize: "12px",
  fontWeight: 900,
  cursor: "pointer",
};

const secondaryButtonStyle: CSSProperties = {
  border: "1px solid #1e222b",
  background: "#fff",
  color: "#1e222b",
  padding: "8px 10px",
  borderRadius: 0,
  fontSize: "12px",
  fontWeight: 900,
  cursor: "pointer",
};

export default BIAlertPanel;
