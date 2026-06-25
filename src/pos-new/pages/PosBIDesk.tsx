import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Check,
  ClipboardCheck,
  Database,
  Filter,
  FileText,
  HelpCircle,
  Radio,
  Search,
  ShieldAlert,
  Sliders,
  DollarSign,
} from "lucide-react";
import BIAssignAdviceModal, {
  BIAssignAdvicePayload,
} from "../components/BIAssignAdviceModal";
import BIAdviceDetailModal from "../components/BIAdviceDetailModal";
import BIAdviceFlowPanel from "../components/BIAdviceFlowPanel";
import BIManagementAdviceDetailModal from "../components/BIManagementAdviceDetailModal";
import BIShelfStocktakeAssignmentModal from "../components/BIShelfStocktakeAssignmentModal";
import RowActionMenu from "../components/RowActionMenu";
import BIAlertPanel from "../components/BIAlertPanel";
import {
  assignBIAdvice,
  createBIAdviceActionPoint,
  createBIAdviceTaskFromAdvice,
  generateBIAdviceFromTriggerLogs,
  generateReorderBlockWarnings,
  generateShelfStocktakeAssignmentsForMonth,
  getBIAdviceActivityEvents,
  getBIAdviceRecords,
  getBIShelfStocktakeAssignments,
  recordBIAdviceActivityEvent,
  resolveBIAdvice,
  dismissBIAdvice,
  escalateBIAdvice,
  updateBIAdviceStatus,
  updateBIShelfStocktakeAssignmentStatus,
} from "../services/biAdviceService";
import { routeBIAdviceToDesk } from "../services/biAdviceRoutingService";
import {
  evaluateBIManagementRules,
  getBIManagementActivityEvents,
  recordBIManagementActivityEvent,
  searchBIManagementAdvice,
  updateBIManagementActionPoint,
  updateBIManagementAdviceStatus,
} from "../services/biManagementRuleService";
import { routeBIManagementAdvice } from "../services/biManagementRoutingService";
import {
  generateSalesProfitSnapshot,
  getSalesProfitDefaultFilter,
  recordSalesProfitSnapshotExportPlaceholder,
  recordSalesProfitSnapshotPrintPlaceholder,
} from "../services/salesProfitService";
import { BiEvent, PosSession, Product, Role, Transaction } from "../types";
import type {
  BIAdviceActivityEvent,
  BIAdviceFilterState,
  BIAdviceRecord,
  BIManagementActivityEvent,
  BIManagementAdvice,
  BIManagementInsightPayload,
  BIManagementActionPoint,
  BIManagementAdviceStatus,
  BIManagementActionStatus,
  BIReorderBlockWarning,
  BIShelfStocktakeAssignment,
  SalesProfitSnapshotPayload,
} from "../types";
import { mockBIEvents, mockBranches, mockStaff } from "../mock/mockPosData";
import { canPerformAction } from "../utils/posPermissions";
import { matchesFreeOrderSearch } from "../utils/searchUtils";
import { biService } from "../../services/biService";
import type {
  BIDashboardMetrics,
  BIDrillDownLog,
  BIFilterState,
} from "../../services/biService";

interface PosBIDeskProps {
  transactions: Transaction[];
  products: Product[];
  biEvents: BiEvent[];
  onLogBiEvent: (
    eventType: BiEvent["eventType"],
    operator: string,
    terminal: string,
    payload: any,
    severity:
      | "INFO"
      | "WARNING"
      | "CRITICAL"
      | "Low"
      | "Medium"
      | "High"
      | "Critical",
  ) => void;
  session?: PosSession | null;
}

interface BiAlertRow {
  id: string;
  eventType: string;
  domain: BiRuleDomain | "Approval";
  severity: "Low" | "Medium" | "High" | "Critical";
  trigger: string;
  description: string;
  recommendedAction: string;
  status:
    | "Open"
    | "Pending Approval"
    | "Resolved"
    | "Completed"
    | "Reminder Created"
    | "Stocktake Initiated"
    | "Followed Up";
  actionLabel:
    | "Review"
    | "Approve"
    | "Start Stocktake"
    | "Create Task"
    | "Follow Up"
    | "Done";
  productName?: string;
  sku?: string;
  staffName?: string;
  branchName?: string;
  terminalName?: string;
  eventMessage?: string;
  notes?: string;
  localDerived?: boolean;
}

interface ActivityLogItem {
  id: string;
  timestamp: string;
  message: string;
  type: "INFO" | "SUCCESS" | "WARNING" | "ACTION";
}

interface BiRuleDefinition {
  ruleName: string;
  ruleTrigger: string;
  description: string;
  riskLevel: BiAlertRow["severity"];
  recommendedAction: string;
}

type BiDeskTab =
  | "BI Overview"
  | "Management BI"
  | "Ruleset Library"
  | "Trigger Logs"
  | "Active Alerts"
  | "BI Advice Flow"
  | "Risk Output"
  | "BI Activity"
  | "Settings / Thresholds";
type BiRuleDomain =
  | "Anti-Theft"
  | "Stock Health"
  | "Cash Control"
  | "Staff Behaviour"
  | "Sales Integrity"
  | "Delivery Verification";

const biTabs: BiDeskTab[] = [
  "BI Overview",
  "Management BI",
  "Ruleset Library",
  "Trigger Logs",
  "Active Alerts",
  "BI Advice Flow",
  "Risk Output",
  "BI Activity",
  "Settings / Thresholds",
];
const ruleDomains: BiRuleDomain[] = [
  "Anti-Theft",
  "Stock Health",
  "Cash Control",
  "Staff Behaviour",
  "Sales Integrity",
  "Delivery Verification",
];

const ruleDescriptions: Record<BiRuleDomain, string> = {
  "Anti-Theft":
    "Monitors drawer behavior, suspicious movement, zero-stock attempts, and repeated override patterns.",
  "Stock Health":
    "Reviews dead stock, low stock, out-of-stock, fast-moving reorder, variance, and missing shelf signals.",
  "Cash Control":
    "Tracks drawer variance, cash-out authorization, unresolved shift variance, and solenoid movement logs.",
  "Staff Behaviour":
    "Highlights failed logins, high override frequency, refund patterns, and out-of-branch terminal use.",
  "Sales Integrity":
    "Protects checkout pricing, quote overrides, bulk discount patterns, and stock-backed sale validation.",
  "Delivery Verification":
    "Reviews delivery completion codes, pending dispatch follow-up, and failed confirmation events.",
};

const rulesMap: Record<BiRuleDomain, BiRuleDefinition[]> = {
  "Anti-Theft": [
    {
      ruleName: "Block sale when stock is zero",
      ruleTrigger: "SALE_BLOCKED_ZERO_STOCK",
      description:
        "Prevents negative stock indices and manual count overrides on nonexistent parts.",
      riskLevel: "Critical",
      recommendedAction: "Block sale and require stock review.",
    },
    {
      ruleName: "Flag repeated price overrides",
      ruleTrigger: "PRICE_OVERRIDE_REQUESTED",
      description:
        "Logs cashier accounts attempting over 3 manual price updates in a single hour.",
      riskLevel: "High",
      recommendedAction: "Supervisor price override review.",
    },
    {
      ruleName: "Flag suspicious stock adjustments",
      ruleTrigger: "STOCK_ADJUSTMENT_REQUESTED",
      description:
        "Triggers audit requirements when items are adjusted without a valid reference invoice.",
      riskLevel: "High",
      recommendedAction: "Require supervisor approval.",
    },
    {
      ruleName: "Flag cash drawer variance",
      ruleTrigger: "CASH_VARIANCE_FOUND",
      description:
        "Logs a warning if declared terminal float is beyond the local tolerance.",
      riskLevel: "High",
      recommendedAction: "Supervisor drawer recount.",
    },
    {
      ruleName: "Flag repeated failed staff logins",
      ruleTrigger: "FAILED_TERMINAL_LOGIN",
      description:
        "Alerts security if staff credentials fail repeatedly in a short period.",
      riskLevel: "High",
      recommendedAction: "Verify staff identity and terminal use.",
    },
  ],
  "Stock Health": [
    {
      ruleName: "Low stock reminder",
      ruleTrigger: "LOW_STOCK_REMINDER",
      description:
        "Triggers system notice when inventory item falls below safety stock margins.",
      riskLevel: "Medium",
      recommendedAction: "Create purchase reminder.",
    },
    {
      ruleName: "Out of stock alert",
      ruleTrigger: "OUT_OF_STOCK_ALERT",
      description: "Logs critical alarm when high-velocity parts fall to zero.",
      riskLevel: "Critical",
      recommendedAction: "Reorder or stock review.",
    },
    {
      ruleName: "Dead stock warning",
      ruleTrigger: "DEAD_STOCK_WARNING",
      description: "Identifies inventory sitting over 90 days with zero sales.",
      riskLevel: "Medium",
      recommendedAction: "Discount or clearance review.",
    },
    {
      ruleName: "Slow moving item warning",
      ruleTrigger: "SLOW_MOVING_STOCK_WARNING",
      description: "Logs notification for parts with extended turnover cycles.",
      riskLevel: "Low",
      recommendedAction: "Review price and demand.",
    },
    {
      ruleName: "Variance risk warning",
      ruleTrigger: "VARIANCE_RISK_FOUND",
      description:
        "Signals risk when warehouse counts deviate from theoretical receipt balances.",
      riskLevel: "Critical",
      recommendedAction: "Stocktake required.",
    },
    {
      ruleName: "Recommend major stocktake",
      ruleTrigger: "RECOMMEND_MAJOR_STOCKTAKE",
      description:
        "Assembles stocktake instructions when audit counts flag repeated negative records.",
      riskLevel: "High",
      recommendedAction: "Schedule major stocktake.",
    },
  ],
  "Cash Control": [
    {
      ruleName: "Variance requires supervisor review",
      ruleTrigger: "CASH_VARIANCE_FOUND",
      description:
        "Blocks cashiers from closing shift with unresolved drawer variance.",
      riskLevel: "High",
      recommendedAction: "Supervisor review before shift closure.",
    },
    {
      ruleName: "Cash out requires authorization",
      ruleTrigger: "CASH_OUT_AUTH_REQUIRED",
      description:
        "Forces second operator verification for payout or banking drop.",
      riskLevel: "Medium",
      recommendedAction: "Authorize payout locally.",
    },
    {
      ruleName: "Shift cannot close with unresolved variance",
      ruleTrigger: "SHIFT_CLOSE_BLOCKED",
      description:
        "Restricts terminal unlock functions until supervisor logs override keys.",
      riskLevel: "High",
      recommendedAction: "Resolve cash variance.",
    },
    {
      ruleName: "Drawer movement must be logged",
      ruleTrigger: "DRAWER_OPENED_MANUALLY",
      description:
        "Records every mechanical solenoid open and links to a terminal event.",
      riskLevel: "Medium",
      recommendedAction: "Review drawer event trail.",
    },
  ],
  "Staff Behaviour": [
    {
      ruleName: "Failed login monitoring",
      ruleTrigger: "FAILED_TERMINAL_LOGIN",
      description:
        "Performs lockouts and registers warning logs for repeated failed access.",
      riskLevel: "High",
      recommendedAction: "Verify staff identity.",
    },
    {
      ruleName: "High override frequency",
      ruleTrigger: "PRICE_OVERRIDE_REQUESTED",
      description:
        "Identifies clerks whose override ratio exceeds local supervisor limits.",
      riskLevel: "High",
      recommendedAction: "Review cashier override pattern.",
    },
    {
      ruleName: "Frequent void/refund requests",
      ruleTrigger: "VOID_REFUND_PATTERN",
      description:
        "Highlights clerks showing an outlying rate of voided tickets post-print.",
      riskLevel: "Medium",
      recommendedAction: "Review sales history.",
    },
    {
      ruleName: "Terminal activity outside assigned branch",
      ruleTrigger: "OUT_OF_BRANCH_TERMINAL_USE",
      description: "Signals incorrect branch logins immediately.",
      riskLevel: "High",
      recommendedAction: "Lock session pending review.",
    },
  ],
  "Sales Integrity": [
    {
      ruleName: "Block sale when stock is zero",
      ruleTrigger: "SALE_BLOCKED_ZERO_STOCK",
      description:
        "Maintains catalog integrity and prevents arbitrary checkout of unavailable parts.",
      riskLevel: "Critical",
      recommendedAction: "Block sale and recount shelf.",
    },
    {
      ruleName: "Flag price deviations",
      ruleTrigger: "PRICE_OVERRIDE_REQUESTED",
      description:
        "Identifies margin leakage by monitoring products sold below distributor cost.",
      riskLevel: "High",
      recommendedAction: "Manager approval required.",
    },
    {
      ruleName: "Mandate supervisor PIN for custom quotes",
      ruleTrigger: "CUSTOM_QUOTE_OVERRIDE",
      description: "Demands double signature keys for manual invoice prices.",
      riskLevel: "Medium",
      recommendedAction: "Supervisor PIN approval.",
    },
    {
      ruleName: "Flag frequent bulk discounts",
      ruleTrigger: "BULK_DISCOUNT_PATTERN",
      description:
        "Identifies large commercial orders processed without account registration.",
      riskLevel: "Medium",
      recommendedAction: "Create account review task.",
    },
  ],
  "Delivery Verification": [
    {
      ruleName: "Delivery completion requires customer secret code",
      ruleTrigger: "DELIVERY_CODE_REQUIRED",
      description:
        "Enforces six-digit confirmation code entry at dispatch completion.",
      riskLevel: "High",
      recommendedAction: "Require customer code.",
    },
    {
      ruleName: "Pending delivery code must be followed up",
      ruleTrigger: "DELIVERY_CODE_PENDING",
      description:
        "Generates warnings if dispatches are in transit beyond local threshold.",
      riskLevel: "Medium",
      recommendedAction: "Follow up with driver/customer.",
    },
    {
      ruleName: "Failed delivery confirmation is flagged",
      ruleTrigger: "DELIVERY_CONFIRMATION_FAILED",
      description:
        "Alerts depot manager if customer rejects parts or code fails to authorize.",
      riskLevel: "High",
      recommendedAction: "Review delivery proof.",
    },
  ],
};

const STOCK_HEALTH_EVENT_TYPES = new Set([
  "DEAD_STOCK_WARNING",
  "LOW_STOCK_REMINDER",
  "VARIANCE_RISK_FOUND",
  "NEGATIVE_STOCK_ALERT",
  "FAST_MOVING_REORDER_RECOMMENDED",
  "OUT_OF_STOCK_ALERT",
  "SLOW_MOVING_STOCK_WARNING",
  "MISSING_SHELF_LOCATION",
  "STOCK_HEALTH_EVALUATED",
]);

function mapSeverity(value: BiEvent["severity"]): BiAlertRow["severity"] {
  if (value === "Critical" || value === "CRITICAL") return "Critical";
  if (value === "High") return "High";
  if (value === "Medium" || value === "WARNING") return "Medium";
  return "Low";
}

function mapBiEventToAlertRow(event: BiEvent): BiAlertRow {
  let domain: BiAlertRow["domain"] = "Anti-Theft";
  let trigger = "Pattern flag activated";
  let recommendedAction = "Investigate operator logs";
  let actionLabel: BiAlertRow["actionLabel"] = "Review";

  if (event.eventType === "CASH_VARIANCE_FOUND") {
    domain = "Cash Control";
    trigger = "Declared cash does not match expected cash";
    recommendedAction = "Supervisor review before shift closure";
  } else if (event.eventType === "SALE_BLOCKED_ZERO_STOCK") {
    domain = "Stock Health";
    trigger = "Product quantity is zero";
    recommendedAction = "Block sale and require stock review";
  } else if (event.eventType === "PRICE_OVERRIDE_REQUESTED") {
    domain = "Sales Integrity";
    trigger = "Discount above allowed cashier threshold";
    recommendedAction = "Manager approval required";
    actionLabel = "Approve";
  } else if (event.eventType === "FAILED_TERMINAL_LOGIN") {
    domain = "Staff Behaviour";
    trigger = "Multiple failed access attempts";
    recommendedAction = "Verify staff identity and terminal use";
  } else if (event.eventType === "STOCK_ADJUSTMENT_REQUESTED") {
    domain = "Stock Health";
    trigger = "Manual adjustment requested";
    recommendedAction = "Require supervisor approval";
    actionLabel = "Approve";
  } else if (event.eventType === "DELIVERY_CODE_PENDING") {
    domain = "Delivery Verification";
    trigger = "Verification code not entered";
    recommendedAction = "Verify dispatch with customer";
    actionLabel = "Follow Up";
  } else if (event.eventType === "SUSPICIOUS_MOVEMENT_ALERT") {
    domain = "Anti-Theft";
    trigger = "Drawer opened manually";
    recommendedAction = "Check security footage near register";
  } else if (event.eventType === "RECOMMEND_MAJOR_STOCKTAKE") {
    domain = "Stock Health";
    trigger = "Variance risk increasing";
    recommendedAction = "Schedule major stocktake";
    actionLabel = "Start Stocktake";
  } else if (STOCK_HEALTH_EVENT_TYPES.has(event.eventType)) {
    domain = "Stock Health";
    trigger = "Stock health rule evaluated";
    recommendedAction = "Review stock position";
  }

  return {
    id: event.id,
    eventType: event.eventType,
    domain,
    severity: mapSeverity(event.severity),
    trigger,
    description:
      event.payload?.productName ||
      event.payload?.details ||
      event.payload?.message ||
      "Rule activation logged",
    recommendedAction,
    status: "Open",
    actionLabel,
    productName: event.payload?.productName,
    sku: event.payload?.sku,
    staffName: event.operator,
    branchName: event.payload?.branchName,
    terminalName: event.terminal,
    eventMessage: event.payload?.details || event.payload?.message,
    notes: event.payload?.notes || event.payload?.reason,
  };
}

function productName(product: Product): string {
  return product.productName || product.name;
}

function productSku(product: Product): string {
  return product.sku || product.code;
}

function productStock(product: Product): number {
  return product.availableStock ?? product.qtyOnHand ?? product.stock;
}

function mapProductToTriggerRow(
  product: Product,
  branchName: string,
  terminalName: string,
): BiAlertRow | null {
  const stock = productStock(product);
  const status = product.stockStatus || product.healthStatus;
  const name = productName(product);
  const sku = productSku(product);

  if (stock <= 0) {
    return {
      id: `BI-PROD-OUT-${product.id}`,
      eventType: "OUT_OF_STOCK_ALERT",
      domain: "Stock Health",
      severity: "Critical",
      trigger: "Product quantity is zero",
      description: `${name} is out of stock.`,
      recommendedAction: "Reorder / stock review",
      status: "Open",
      actionLabel: "Review",
      productName: name,
      sku,
      branchName,
      terminalName,
      eventMessage: `${name} stock is zero.`,
      notes: status || "Out of stock local trigger",
      localDerived: true,
    };
  }

  if (
    status === "Variance Risk" ||
    product.riskLevel === "Critical" ||
    product.riskLevel === "High"
  ) {
    return {
      id: `BI-PROD-VAR-${product.id}`,
      eventType: "VARIANCE_RISK_FOUND",
      domain: "Stock Health",
      severity: product.riskLevel === "Critical" ? "Critical" : "High",
      trigger: "Stocktake or adjustment movement in last 30 days",
      description: `${name} variance risk requires review.`,
      recommendedAction: "Stocktake required",
      status: "Open",
      actionLabel: "Start Stocktake",
      productName: name,
      sku,
      branchName,
      terminalName,
      eventMessage: `${sku} variance risk found.`,
      notes: status || product.riskLevel || "Variance risk local trigger",
      localDerived: true,
    };
  }

  if (stock <= product.minStock) {
    return {
      id: `BI-PROD-REORDER-${product.id}`,
      eventType:
        status === "Fast Moving"
          ? "FAST_MOVING_REORDER_RECOMMENDED"
          : "LOW_STOCK_REMINDER",
      domain: "Stock Health",
      severity: status === "Fast Moving" ? "High" : "Medium",
      trigger:
        status === "Fast Moving"
          ? "Multiple sale movements in last 7 days"
          : "Quantity on hand at or below reorder level",
      description: `${name} is at or below reorder level.`,
      recommendedAction:
        status === "Fast Moving"
          ? "Reorder fast-moving item"
          : "Create purchase reminder",
      status: "Open",
      actionLabel: "Create Task",
      productName: name,
      sku,
      branchName,
      terminalName,
      eventMessage: `${sku} reorder trigger generated locally.`,
      notes: status || "Low stock local trigger",
      localDerived: true,
    };
  }

  return null;
}

function riskBadgeClass(severity: BiAlertRow["severity"]): string {
  if (severity === "Critical") return "bi-risk-badge bi-risk-badge--critical";
  if (severity === "High") return "bi-risk-badge bi-risk-badge--high";
  if (severity === "Medium") return "bi-risk-badge bi-risk-badge--medium";
  return "bi-risk-badge bi-risk-badge--low";
}

function triggerActionText(row: BiAlertRow): string {
  if (row.actionLabel === "Start Stocktake") return "Start Stocktake";
  if (row.actionLabel === "Create Task")
    return row.eventType.includes("LOW_STOCK")
      ? "Create Reminder"
      : "Create Task";
  if (row.actionLabel === "Approve") return "Open Advice";
  if (row.domain === "Stock Health") return "Review Stock";
  if (row.domain === "Staff Behaviour") return "Assign Staff";
  return "Open Advice";
}

function permissionMessage() {
  return (
    <div className="sci-pos-alert sci-pos-alert--danger">
      You do not have permission to view this BI section.
    </div>
  );
}

export default function PosBIDesk({
  transactions,
  products,
  biEvents,
  onLogBiEvent,
  session,
}: PosBIDeskProps) {
  const vendorName = session?.vendor || "SCI Logistics Ltd";
  const branchName = session?.branch || "Harare Main";
  const terminalName = session?.terminal || "Term-A";
  const staffName = session?.staffName || "Admin User";
  const roleName = (session?.role || "Owner") as Role;

  const [activeDeskTab, setActiveDeskTab] = useState<BiDeskTab>("BI Overview");
  const [selectedDomain, setSelectedDomain] =
    useState<BiRuleDomain>("Anti-Theft");
  const [rulesetSearch, setRulesetSearch] = useState("");
  const [triggerSearch, setTriggerSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [domainFilter, setDomainFilter] = useState("ALL");
  const [adviceFilters, setAdviceFilters] = useState<BIAdviceFilterState>({});
  const [adviceRecords, setAdviceRecords] = useState<BIAdviceRecord[]>([]);
  const [adviceActivity, setAdviceActivity] = useState<BIAdviceActivityEvent[]>(
    [],
  );
  const [shelfAssignments, setShelfAssignments] = useState<
    BIShelfStocktakeAssignment[]
  >([]);
  const [selectedAdvice, setSelectedAdvice] = useState<BIAdviceRecord | null>(
    null,
  );
  const [selectedShelfAssignment, setSelectedShelfAssignment] =
    useState<BIShelfStocktakeAssignment | null>(null);
  const [assignAdviceTarget, setAssignAdviceTarget] =
    useState<BIAdviceRecord | null>(null);
  const [managementInsight, setManagementInsight] =
    useState<BIManagementInsightPayload | null>(null);
  const [managementSearch, setManagementSearch] = useState("");
  const [selectedManagementAdvice, setSelectedManagementAdvice] =
    useState<BIManagementAdvice | null>(null);
  const [managementActivity, setManagementActivity] = useState<
    BIManagementActivityEvent[]
  >([]);
  const [openManagementMenuId, setOpenManagementMenuId] = useState("");
  const [profitSnapshot, setProfitSnapshot] =
    useState<SalesProfitSnapshotPayload | null>(null);
  const [activityFeed, setActivityFeed] = useState<ActivityLogItem[]>([
    {
      id: "BIA-1",
      timestamp: "16:05:22",
      message:
        "Rule evaluated: SALE_BLOCKED_ZERO_STOCK (Gate: Blocked transaction output)",
      type: "INFO",
    },
    {
      id: "BIA-2",
      timestamp: "15:45:11",
      message:
        "Supervisor review opened for cash variance: USD -5.00 on register 01",
      type: "WARNING",
    },
    {
      id: "BIA-3",
      timestamp: "14:30:15",
      message:
        "Price override approved by mock manager: Radiator discount authorized at 15%",
      type: "SUCCESS",
    },
    {
      id: "BIA-4",
      timestamp: "13:10:05",
      message:
        "Major stocktake recommendation created for low velocity category Motor Spares",
      type: "ACTION",
    },
    {
      id: "BIA-5",
      timestamp: "11:32:00",
      message:
        "Delivery code follow-up assigned to supervisor: Ref GD6 Pending verification code",
      type: "ACTION",
    },
  ]);
  const [alertsTable, setAlertsTable] = useState<BiAlertRow[]>(() =>
    mockBIEvents.map(mapBiEventToAlertRow),
  );

  // BI Dashboard Activation States
  const [biBranchFilter, setBiBranchFilter] = useState<string>("");
  const [biStartDateFilter, setBiStartDateFilter] = useState<string>("");
  const [biEndDateFilter, setBiEndDateFilter] = useState<string>("");
  const [biStaffFilter, setBiStaffFilter] = useState<string>("");
  const [biProductFilter, setBiProductFilter] = useState<string>("");

  const [biMetrics, setBiMetrics] = useState<BIDashboardMetrics | null>(null);
  const [isLoadingBi, setIsLoadingBi] = useState<boolean>(true);
  const [selectedDrillDownKey, setSelectedDrillDownKey] = useState<
    string | null
  >(null);
  const [hasLoggedOpened, setHasLoggedOpened] = useState(false);

  const logAudit = async (eventType: string, payload: any = {}) => {
    onLogBiEvent(
      eventType as BiEvent["eventType"],
      staffName,
      terminalName,
      payload,
      "INFO",
    );

    try {
      const storageKey = "itred_pos_session_audit_events";
      const existing = localStorage.getItem(storageKey);
      const list = existing ? JSON.parse(existing) : [];
      const newEvent = {
        id: `AUDIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toISOString(),
        eventType,
        operator: staffName,
        terminal: terminalName,
        payload,
        severity: "INFO",
      };
      list.unshift(newEvent);
      localStorage.setItem(storageKey, JSON.stringify(list.slice(0, 500)));
    } catch (e) {
      console.warn("Failed to save audit event to localStorage:", e);
    }

    try {
      const { db, firebaseReady } = await import("../firebase/firebaseApp");
      if (firebaseReady && db && session?.vendor) {
        const { collection, addDoc } = await import("firebase/firestore");
        const colRef = collection(
          db,
          "vendors",
          session.vendor,
          "sessionAuditEvents",
        );
        await addDoc(colRef, {
          timestamp: new Date().toISOString(),
          eventType,
          operator: staffName,
          terminal: terminalName,
          payload,
          severity: "INFO",
        });
      }
    } catch (err) {
      console.warn("Failed to write audit event to Firestore:", err);
    }
  };

  const handleBranchFilterChange = (val: string) => {
    setBiBranchFilter(val);
    void logAudit("BI_FILTER_CHANGED", { filterType: "branch", value: val });
  };

  const handleStaffFilterChange = (val: string) => {
    setBiStaffFilter(val);
    void logAudit("BI_FILTER_CHANGED", { filterType: "staffId", value: val });
  };

  const handleProductFilterChange = (val: string) => {
    setBiProductFilter(val);
    void logAudit("BI_FILTER_CHANGED", { filterType: "productId", value: val });
  };

  const handleStartDateFilterChange = (val: string) => {
    setBiStartDateFilter(val);
    void logAudit("BI_FILTER_CHANGED", { filterType: "startDate", value: val });
  };

  const handleEndDateFilterChange = (val: string) => {
    setBiEndDateFilter(val);
    void logAudit("BI_FILTER_CHANGED", { filterType: "endDate", value: val });
  };

  const handleResetFilters = () => {
    setBiBranchFilter("");
    setBiStartDateFilter("");
    setBiEndDateFilter("");
    setBiStaffFilter("");
    setBiProductFilter("");
    void logAudit("BI_FILTER_CHANGED", { action: "reset" });
  };

  const handleOpenDrillDown = (key: string) => {
    setSelectedDrillDownKey(key);
    void logAudit("BI_DRILLDOWN_OPENED", { cardKey: key });
  };

  useEffect(() => {
    if (activeDeskTab === "BI Overview" && !hasLoggedOpened) {
      void logAudit("BI_DASHBOARD_OPENED", { tab: "BI Overview" });
      setHasLoggedOpened(true);
    }
  }, [activeDeskTab, hasLoggedOpened]);

  useEffect(() => {
    let active = true;
    const loadBIData = async () => {
      setIsLoadingBi(true);
      try {
        const filters: BIFilterState = {};
        if (biBranchFilter) filters.branchId = biBranchFilter;
        if (biStartDateFilter) filters.startDate = biStartDateFilter;
        if (biEndDateFilter) filters.endDate = biEndDateFilter;
        if (biStaffFilter) filters.staffId = biStaffFilter;
        if (biProductFilter) filters.productId = biProductFilter;

        const metricsData = await biService.getBIDashboardMetrics(
          session?.vendor || "SCI Logistics Ltd",
          session?.branch || undefined,
          filters,
        );

        if (active) {
          setBiMetrics(metricsData);
          setIsLoadingBi(false);
        }
      } catch (error) {
        console.error("Failed to load BI dashboard metrics:", error);
        if (active) {
          setIsLoadingBi(false);
        }
      }
    };
    void loadBIData();
    return () => {
      active = false;
    };
  }, [
    session,
    biBranchFilter,
    biStartDateFilter,
    biEndDateFilter,
    biStaffFilter,
    biProductFilter,
  ]);

  const hasBiView = canPerformAction(roleName, "bi.view");
  const canReviewRisk =
    canPerformAction(roleName, "bi.riskReview") ||
    canPerformAction(roleName, "bi.review");
  const canManageRules = canPerformAction(roleName, "bi.rules.manage");
  const canExportBi =
    canPerformAction(roleName, "bi.export") ||
    canPerformAction(roleName, "reports.export");
  const canViewAdvice = canPerformAction(roleName, "bi.advice.view");
  const canGenerateAdvice = canPerformAction(roleName, "bi.advice.generate");
  const canAssignAdvice = canPerformAction(roleName, "bi.advice.assign");
  const canResolveAdvice = canPerformAction(roleName, "bi.advice.resolve");
  const canDismissAdvice = canPerformAction(roleName, "bi.advice.dismiss");
  const canEscalateAdvice = canPerformAction(roleName, "bi.advice.escalate");
  const canCreateAdviceTask = canPerformAction(
    roleName,
    "bi.advice.createTask",
  );
  const canAssignShelfStocktake = canPerformAction(
    roleName,
    "bi.shelfStocktake.assign",
  );
  const canReviewReorderBlock = canPerformAction(
    roleName,
    "bi.reorderBlock.review",
  );
  const canViewManagement = canPerformAction(roleName, "bi.management.view");
  const canGenerateManagement = canPerformAction(
    roleName,
    "bi.management.generate",
  );
  const canManageActionPoints = canPerformAction(
    roleName,
    "bi.actionPoints.manage",
  );
  const canViewActionPoints = canPerformAction(
    roleName,
    "bi.actionPoints.view",
  );
  const canViewReorderProtection =
    canPerformAction(roleName, "bi.reorderProtection.view") ||
    canReviewReorderBlock;
  const canOverrideReorderProtection = canPerformAction(
    roleName,
    "bi.reorderProtection.override",
  );
  const canViewTaxReadiness = canPerformAction(
    roleName,
    "bi.taxReadiness.view",
  );
  const canViewProfitSnapshot =
    canPerformAction(roleName, "bi.profitSnapshot.view") ||
    canPerformAction(roleName, "sales.profitSnapshot.view");
  const productTriggerRows = useMemo(
    () =>
      products
        .map((product) =>
          mapProductToTriggerRow(product, branchName, terminalName),
        )
        .filter((row): row is BiAlertRow => Boolean(row)),
    [branchName, products, terminalName],
  );
  const triggerRows = useMemo(() => {
    const existingIds = new Set(alertsTable.map((row) => row.id));
    return [
      ...alertsTable,
      ...productTriggerRows.filter((row) => !existingIds.has(row.id)),
    ];
  }, [alertsTable, productTriggerRows]);

  const addActivity = (
    message: string,
    type: ActivityLogItem["type"] = "INFO",
  ) => {
    const timestamp = new Date().toTimeString().split(" ")[0];
    setActivityFeed((current) =>
      [{ id: `BIA-${Date.now()}`, timestamp, message, type }, ...current].slice(
        0,
        30,
      ),
    );
  };

  useEffect(() => {
    const stockHealthEvents = biEvents.filter((event) =>
      STOCK_HEALTH_EVENT_TYPES.has(event.eventType),
    );
    if (stockHealthEvents.length === 0) return;
    setAlertsTable((current) => {
      const existingIds = new Set(current.map((row) => row.id));
      const newRows = stockHealthEvents
        .filter((event) => !existingIds.has(event.id))
        .map(mapBiEventToAlertRow);
      return newRows.length > 0 ? [...newRows, ...current] : current;
    });
  }, [biEvents]);

  const loadAdvice = async (filters: BIAdviceFilterState = adviceFilters) => {
    const [records, activity, assignments] = await Promise.all([
      getBIAdviceRecords(filters),
      getBIAdviceActivityEvents(),
      getBIShelfStocktakeAssignments(),
    ]);
    setAdviceRecords(records);
    setAdviceActivity(activity);
    setShelfAssignments(assignments);
  };

  const loadManagementInsight = async () => {
    const insight = evaluateBIManagementRules({
      branchName,
      terminalName,
      staffName,
      products,
      transactions,
      biEvents,
    });
    await Promise.all(insight.advice.slice(0, 12).map(routeBIManagementAdvice));
    setManagementInsight(insight);
    setManagementActivity(await getBIManagementActivityEvents());
    if (!profitSnapshot) {
      setProfitSnapshot(
        generateSalesProfitSnapshot(
          getSalesProfitDefaultFilter(),
          undefined,
          products,
          staffName,
          { branchName, terminalName, cashierName: staffName },
        ),
      );
    }
  };

  useEffect(() => {
    void loadAdvice(adviceFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adviceFilters]);

  useEffect(() => {
    void loadManagementInsight();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchName, terminalName, staffName, products, transactions, biEvents]);

  const openTab = (tab: BiDeskTab) => {
    setActiveDeskTab(tab);
    const eventType =
      tab === "Ruleset Library"
        ? "BI_RULESET_LIBRARY_OPENED"
        : tab === "Trigger Logs"
          ? "BI_TRIGGER_LOGS_OPENED"
          : "BI_TAB_OPENED";
    addActivity(`${eventType}: ${tab}`, "INFO");
  };

  const selectDomain = (domain: BiRuleDomain) => {
    setSelectedDomain(domain);
    addActivity(`BI_RULESET_DOMAIN_SELECTED: ${domain}`, "ACTION");
  };

  const handleAlertAction = (
    rowId: string,
    actionType: BiAlertRow["actionLabel"],
  ) => {
    if (!canReviewRisk) {
      addActivity("Risk review blocked by permission.", "WARNING");
      return;
    }
    const triggerRow = triggerRows.find((row) => row.id === rowId);
    if (triggerRow?.localDerived) {
      addActivity(
        `BI_RULESET_OUTPUT_VIEWED: ${actionType} noted for local product trigger ${triggerRow.productName || triggerRow.eventType}.`,
        "ACTION",
      );
      onLogBiEvent(
        "BI_RISK_ACTION_RECORDED" as BiEvent["eventType"],
        staffName,
        terminalName,
        { rowId, actionType, localDerived: true },
        "INFO",
      );
      return;
    }
    setAlertsTable((current) =>
      current.map((row) => {
        if (row.id !== rowId) return row;
        let nextStatus: BiAlertRow["status"] = "Resolved";
        if (actionType === "Approve") nextStatus = "Completed";
        if (actionType === "Start Stocktake")
          nextStatus = "Stocktake Initiated";
        if (actionType === "Create Task") nextStatus = "Reminder Created";
        if (actionType === "Follow Up") nextStatus = "Followed Up";
        addActivity(
          `User triggered [${actionType}] on ${row.eventType}: ${row.description.slice(0, 45)}... status updated to [${nextStatus}]`,
          actionType === "Approve" ? "SUCCESS" : "ACTION",
        );
        onLogBiEvent(
          "BI_RISK_ACTION_RECORDED" as BiEvent["eventType"],
          staffName,
          terminalName,
          { rowId, actionType, nextStatus },
          "INFO",
        );
        return { ...row, status: nextStatus, actionLabel: "Done" };
      }),
    );
  };

  const handleGenerateAdvice = async () => {
    if (!canGenerateAdvice) {
      addActivity("BI advice generation blocked by permission.", "WARNING");
      return;
    }
    const generated = await generateBIAdviceFromTriggerLogs(
      triggerRows,
      products,
    );
    await Promise.all(generated.map(routeBIAdviceToDesk));
    addActivity(
      `BI_ADVICE_GENERATED: ${generated.length} advice record(s) prepared from trigger logs.`,
      "SUCCESS",
    );
    await loadAdvice(adviceFilters);
  };

  const handleGenerateShelfPlan = async () => {
    if (!canAssignShelfStocktake) {
      addActivity(
        "Shelf stocktake plan generation blocked by permission.",
        "WARNING",
      );
      return;
    }
    const generated = await generateShelfStocktakeAssignmentsForMonth({
      branchId: branchName.toUpperCase().replace(/[^A-Z0-9]+/g, "-"),
      branchName,
      warehouseId: "WH-LOCAL",
      products,
      staff: [
        {
          id: staffName.toUpperCase().replace(/[^A-Z0-9]+/g, "-"),
          name: staffName,
        },
      ],
    });
    addActivity(
      `BI_SHELF_STOCKTAKE_PLAN_CREATED: ${generated.length} shelf assignment(s) generated.`,
      "SUCCESS",
    );
    await loadAdvice(adviceFilters);
  };

  const handleGenerateReorderWarnings = async () => {
    if (!canReviewReorderBlock) {
      addActivity(
        "Reorder block warning generation blocked by permission.",
        "WARNING",
      );
      return;
    }
    const warnings = await generateReorderBlockWarnings({ products });
    addActivity(
      `BI_REORDER_BLOCK_WARNING_CREATED: ${warnings.length} reorder warning(s) prepared.`,
      "WARNING",
    );
    await loadAdvice(adviceFilters);
  };

  const handleGenerateManagement = async () => {
    if (!canGenerateManagement) {
      addActivity("Management BI generation blocked by permission.", "WARNING");
      return;
    }
    await loadManagementInsight();
    addActivity(
      "BI_MANAGEMENT_EVALUATED: management BI refreshed from local deterministic rules.",
      "SUCCESS",
    );
  };

  const handleOpenManagementAdvice = async (advice: BIManagementAdvice) => {
    setSelectedManagementAdvice(advice);
    recordBIManagementActivityEvent({
      eventType: "BI_MANAGEMENT_ADVICE_OPENED",
      domain: advice.domain,
      adviceId: advice.adviceId,
      staffId: staffName,
      message: `${advice.adviceNumber} opened.`,
    });
    setManagementActivity(await getBIManagementActivityEvents());
  };

  const handleManagementAdviceStatus = async (
    advice: BIManagementAdvice,
    status: BIManagementAdviceStatus,
  ) => {
    if (!canManageActionPoints && status !== "In Progress") {
      addActivity("Management BI action blocked by permission.", "WARNING");
      return;
    }
    const note =
      status === "Resolved"
        ? window.prompt(
            "Resolution proof",
            "Reviewed locally and action completed.",
          )
        : status === "Dismissed"
          ? window.prompt(
              "Dismiss reason",
              "Dismissed after management review.",
            )
          : status === "Escalated"
            ? window.prompt(
                "Escalation reason",
                "Escalated to owner/manager review.",
              )
            : `${status} from Management BI.`;
    if (note === null) return;
    await updateBIManagementAdviceStatus(
      advice.adviceId,
      status,
      staffName,
      String(note || status),
    );
    addActivity(
      `BI_MANAGEMENT_ADVICE_${status.toUpperCase().replace(/\s+/g, "_")}: ${advice.adviceNumber}.`,
      status === "Resolved" ? "SUCCESS" : "ACTION",
    );
    await loadManagementInsight();
  };

  const handleManagementActionPoint = async (
    point: BIManagementActionPoint,
    status: BIManagementActionStatus,
  ) => {
    if (!canManageActionPoints) {
      addActivity("BI action point update blocked by permission.", "WARNING");
      return;
    }
    const note =
      status === "Resolved"
        ? window.prompt("Action result note", "Completed locally.")
        : `${status} from Management BI.`;
    if (note === null) return;
    await updateBIManagementActionPoint(
      point.actionPointId,
      status,
      staffName,
      String(note || status),
    );
    addActivity(
      `BI_MANAGEMENT_ACTION_POINT_UPDATED: ${point.label} -> ${status}.`,
      "ACTION",
    );
    await loadManagementInsight();
  };

  const handlePrintManagementAdvice = (advice: BIManagementAdvice) => {
    recordBIManagementActivityEvent({
      eventType: "BI_MANAGEMENT_ADVICE_PRINTED",
      domain: advice.domain,
      adviceId: advice.adviceId,
      staffId: staffName,
      message: `${advice.adviceNumber} print dialog opened.`,
    });
    window.print();
  };

  const handleExportManagementCsv = () => {
    if (!managementInsight) return;
    const rows = [
      ["Advice No", "Domain", "Risk", "Title", "Desk", "Role", "Status"],
      ...managementInsight.advice.map((advice) => [
        advice.adviceNumber,
        advice.domain,
        advice.riskLevel,
        advice.title,
        advice.assignedDesk,
        advice.assignedRole,
        advice.status,
      ]),
    ];
    const csv = rows
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bi-management-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    addActivity(
      "BI_MANAGEMENT_EXPORT_PREPARED: CSV placeholder exported.",
      "SUCCESS",
    );
  };

  const handleOpenAdvice = async (advice: BIAdviceRecord) => {
    setSelectedAdvice(advice);
    const assignment =
      shelfAssignments.find(
        (item) => item.createdFromBIAdviceId === advice.adviceId,
      ) || null;
    setSelectedShelfAssignment(assignment);
    recordBIAdviceActivityEvent({
      eventType: "BI_ADVICE_DETAIL_OPENED",
      adviceId: advice.adviceId,
      staffId: staffName,
      message: `${advice.adviceNumber} detail opened.`,
    });
    addActivity(`BI_ADVICE_DETAIL_OPENED: ${advice.adviceNumber}.`, "INFO");
    setAdviceActivity(
      await getBIAdviceActivityEvents({ adviceId: advice.adviceId }),
    );
  };

  const handleAdviceActionMenuOpen = (advice: BIAdviceRecord) => {
    recordBIAdviceActivityEvent({
      eventType: "BI_ADVICE_ACTION_MENU_OPENED",
      adviceId: advice.adviceId,
      staffId: staffName,
      message: `${advice.adviceNumber} action menu opened.`,
    });
    addActivity(
      `BI_ADVICE_ACTION_MENU_OPENED: ${advice.adviceNumber}.`,
      "INFO",
    );
  };

  const handleRequestApprovalFromAdvice = async (advice: BIAdviceRecord) => {
    await createBIAdviceActionPoint({
      adviceId: advice.adviceId,
      actionType: "Request Approval",
      label: "Request Approval",
      description: `${advice.adviceNumber} approval request prepared locally for ${advice.assignedToRole || "Manager"}.`,
      assignedToRole: advice.assignedToRole || "Manager",
      dueDate: advice.dueDate || new Date().toISOString().slice(0, 10),
    });
    await updateBIAdviceStatus(
      advice.adviceId,
      "Waiting Review",
      staffName,
      "Approval requested locally.",
    );
    addActivity(
      `BI_ADVICE_APPROVAL_REQUESTED: ${advice.adviceNumber}.`,
      "ACTION",
    );
    await loadAdvice(adviceFilters);
  };

  const handlePrintAdvice = (advice: BIAdviceRecord) => {
    recordBIAdviceActivityEvent({
      eventType: "BI_ADVICE_DETAIL_OPENED",
      adviceId: advice.adviceId,
      staffId: staffName,
      message: `${advice.adviceNumber} print dialog opened.`,
    });
    window.print();
  };

  const handleCreateTaskFromAdvice = async (advice: BIAdviceRecord) => {
    if (!canCreateAdviceTask) {
      addActivity(
        "Create Task from BI advice blocked by permission.",
        "WARNING",
      );
      return;
    }
    const task = await createBIAdviceTaskFromAdvice(advice);
    addActivity(
      `BI_TASK_CREATED_FROM_ADVICE: ${task.taskId} created from ${advice.adviceNumber}.`,
      "ACTION",
    );
    await loadAdvice(adviceFilters);
    if (selectedAdvice?.adviceId === advice.adviceId) {
      setSelectedAdvice(
        await getBIAdviceRecords({ search: advice.adviceNumber }).then(
          (records) =>
            records.find((record) => record.adviceId === advice.adviceId) ||
            advice,
        ),
      );
      setAdviceActivity(
        await getBIAdviceActivityEvents({ adviceId: advice.adviceId }),
      );
    }
  };

  const handleAssignAdvice = (advice: BIAdviceRecord) => {
    if (!canAssignAdvice) {
      addActivity("BI advice assignment blocked by permission.", "WARNING");
      return;
    }
    setAssignAdviceTarget(advice);
  };

  const handleSubmitAdviceAssignment = async (
    payload: BIAssignAdvicePayload,
  ) => {
    if (!assignAdviceTarget) return;
    const assigned = await assignBIAdvice(assignAdviceTarget.adviceId, {
      assignedToStaffName: payload.assignedToStaffName,
      assignedToStaffId: payload.assignedToStaffId,
      assignedToRole: payload.assignedToRole,
      assignedDesk: payload.assignedDesk,
      dueDate: payload.dueDate,
      note: payload.note,
    });
    if (assigned) await routeBIAdviceToDesk(assigned);
    addActivity(
      `BI_ADVICE_ASSIGNED: ${assignAdviceTarget.adviceNumber} assigned.`,
      "ACTION",
    );
    setAssignAdviceTarget(null);
    await loadAdvice(adviceFilters);
    if (selectedAdvice?.adviceId === assignAdviceTarget.adviceId && assigned) {
      setSelectedAdvice(assigned);
      setAdviceActivity(
        await getBIAdviceActivityEvents({
          adviceId: assignAdviceTarget.adviceId,
        }),
      );
    }
  };

  const handleStartStocktakeAdvice = async (advice: BIAdviceRecord) => {
    if (!canAssignShelfStocktake) {
      addActivity(
        "Start Stocktake from BI advice blocked by permission.",
        "WARNING",
      );
      return;
    }
    const assignment =
      shelfAssignments.find(
        (item) => item.createdFromBIAdviceId === advice.adviceId,
      ) || null;
    if (assignment) {
      setSelectedShelfAssignment(assignment);
      setSelectedAdvice(advice);
      await updateBIAdviceStatus(
        advice.adviceId,
        "In Progress",
        staffName,
        "Shelf stocktake assignment started.",
      );
      recordBIAdviceActivityEvent({
        eventType: "BI_SHELF_STOCKTAKE_STARTED_FROM_ADVICE",
        adviceId: advice.adviceId,
        staffId: staffName,
        message: `${advice.adviceNumber} shelf stocktake assignment started.`,
      });
      addActivity(
        `BI_SHELF_STOCKTAKE_STARTED_FROM_ADVICE: ${advice.adviceNumber}.`,
        "ACTION",
      );
      await loadAdvice(adviceFilters);
      return;
    }
    await createBIAdviceActionPoint({
      adviceId: advice.adviceId,
      actionType: "Start Stocktake",
      label: "Start Stocktake",
      description: advice.shelfLocation
        ? `Stocktake session started for ${advice.shelfLocation}.`
        : "Product stocktake review session prepared locally.",
      assignedToRole: advice.assignedToRole || "Stock Controller",
      dueDate: advice.dueDate,
    });
    await updateBIAdviceStatus(
      advice.adviceId,
      "In Progress",
      staffName,
      "Stocktake assignment started.",
    );
    recordBIAdviceActivityEvent({
      eventType: "BI_SHELF_STOCKTAKE_STARTED_FROM_ADVICE",
      adviceId: advice.adviceId,
      staffId: staffName,
      message: `${advice.adviceNumber} stocktake assignment started.`,
    });
    addActivity(
      `BI_SHELF_STOCKTAKE_STARTED_FROM_ADVICE: Stocktake assignment started for ${advice.adviceNumber}.`,
      "ACTION",
    );
    await loadAdvice(adviceFilters);
  };

  const handleResolveAdvice = async (advice: BIAdviceRecord) => {
    if (!canResolveAdvice) {
      addActivity("BI advice resolve blocked by permission.", "WARNING");
      return;
    }
    const resolutionType = window.prompt(
      "Resolution Type: Reviewed, Stocktake Completed, Reorder Block Confirmed, Task Completed, False Alarm, Other",
      "Reviewed",
    );
    if (resolutionType === null) return;
    const note = window.prompt(
      "Resolution Note",
      `${resolutionType}: reviewed locally.`,
    );
    if (note === null || !note.trim()) return;
    await resolveBIAdvice(
      advice.adviceId,
      staffName,
      `${resolutionType || "Reviewed"} - ${note.trim()}`,
    );
    addActivity(`BI_ADVICE_RESOLVED: ${advice.adviceNumber}.`, "SUCCESS");
    await loadAdvice(adviceFilters);
  };

  const handleDismissAdvice = async (advice: BIAdviceRecord) => {
    if (!canDismissAdvice) {
      addActivity("BI advice dismiss blocked by permission.", "WARNING");
      return;
    }
    const reason = window.prompt(
      "Dismiss Reason",
      "Dismissed after local review.",
    );
    if (reason === null || !reason.trim()) return;
    await dismissBIAdvice(advice.adviceId, staffName, reason.trim());
    addActivity(`BI_ADVICE_DISMISSED: ${advice.adviceNumber}.`, "INFO");
    await loadAdvice(adviceFilters);
  };

  const handleEscalateAdvice = async (advice: BIAdviceRecord) => {
    if (!canEscalateAdvice) {
      addActivity("BI advice escalation blocked by permission.", "WARNING");
      return;
    }
    const reason = window.prompt(
      "Escalation Reason",
      "Escalated for manager or owner review.",
    );
    if (reason === null || !reason.trim()) return;
    const target =
      window.prompt(
        "Escalate To: Owner, Manager, Approvals Desk, Cash Control, Stock Desk, Delivery Desk",
        "Owner",
      ) || "Owner";
    const roleByTarget: Record<string, { role: string; desk: string }> = {
      Owner: { role: "Owner", desk: "Owner Desk" },
      Manager: { role: "Manager", desk: "Manager Desk" },
      "Approvals Desk": { role: "Manager", desk: "Approvals Desk" },
      "Cash Control": { role: "Manager", desk: "Cash Control" },
      "Stock Desk": { role: "Stock Controller", desk: "Stock Desk" },
      "Delivery Desk": { role: "Delivery Staff", desk: "Delivery Desk" },
    };
    const route = roleByTarget[target] || roleByTarget.Owner;
    const assigned = await assignBIAdvice(advice.adviceId, {
      assignedToRole: route.role,
      assignedDesk: route.desk,
      note: `Escalation target: ${target}.`,
    });
    const escalated = await escalateBIAdvice(
      advice.adviceId,
      staffName,
      reason.trim(),
    );
    if (escalated)
      await routeBIAdviceToDesk({
        ...(assigned || escalated),
        assignedDesk: route.desk,
        assignedToRole: route.role,
      });
    addActivity(`BI_ADVICE_ESCALATED: ${advice.adviceNumber}.`, "WARNING");
    await loadAdvice(adviceFilters);
  };

  const handleShelfStatus = async (
    status: BIShelfStocktakeAssignment["status"],
  ) => {
    if (!selectedShelfAssignment) return;
    await updateBIShelfStocktakeAssignmentStatus(
      selectedShelfAssignment.assignmentId,
      status,
    );
    if (selectedAdvice)
      await updateBIAdviceStatus(
        selectedAdvice.adviceId,
        status === "Completed" ? "Resolved" : "In Progress",
        staffName,
        `Shelf stocktake ${status}.`,
      );
    addActivity(
      `BI_SHELF_STOCKTAKE_ASSIGNED: ${selectedShelfAssignment.shelfLocation} marked ${status}.`,
      "ACTION",
    );
    setSelectedShelfAssignment(null);
    await loadAdvice(adviceFilters);
  };

  const domainRules = rulesMap[selectedDomain];
  const filteredRules = domainRules.filter((rule) =>
    matchesFreeOrderSearch({ domain: selectedDomain, ...rule }, rulesetSearch, [
      "domain",
      "ruleName",
      "ruleTrigger",
      "description",
      "riskLevel",
      "recommendedAction",
    ]),
  );

  const filteredAlerts = triggerRows.filter((row) => {
    const matchesSearch = matchesFreeOrderSearch(row, triggerSearch, [
      "eventType",
      "domain",
      "severity",
      "trigger",
      "description",
      "recommendedAction",
      "productName",
      "sku",
      "staffName",
      "branchName",
      "terminalName",
      "eventMessage",
      "notes",
      (item) => item.status,
      () => branchName,
      () => terminalName,
    ]);
    const matchesSeverity =
      severityFilter === "ALL" || row.severity === severityFilter;
    const matchesDomain = domainFilter === "ALL" || row.domain === domainFilter;
    return matchesSearch && matchesSeverity && matchesDomain;
  });

  const metrics = useMemo(() => {
    const critical = triggerRows.filter(
      (row) => row.severity === "Critical" && row.status === "Open",
    ).length;
    const high = triggerRows.filter(
      (row) => row.severity === "High" && row.status === "Open",
    ).length;
    const medium = triggerRows.filter(
      (row) => row.severity === "Medium" && row.status === "Open",
    ).length;
    return {
      critical,
      high,
      medium,
      staff: triggerRows.filter((row) => row.domain === "Staff Behaviour")
        .length,
      stock: triggerRows.filter((row) => row.domain === "Stock Health").length,
      cash: triggerRows.filter((row) => row.domain === "Cash Control").length,
      spotChecks: products.filter(
        (product) => product.stock <= product.minStock,
      ).length,
      reviews: triggerRows.filter(
        (row) => row.status === "Open" || row.status === "Pending Approval",
      ).length,
    };
  }, [products, triggerRows]);

  const severityMix = useMemo(() => {
    const rules = rulesMap[selectedDomain];
    return ["Critical", "High", "Medium", "Low"]
      .map(
        (severity) =>
          `${severity}: ${rules.filter((rule) => rule.riskLevel === severity).length}`,
      )
      .join(" / ");
  }, [selectedDomain]);

  const filteredManagementAdvice = useMemo(() => {
    if (!managementInsight) return [];
    return searchBIManagementAdvice(managementInsight.advice, managementSearch);
  }, [managementInsight, managementSearch]);

  const managementActionPoints = useMemo(() => {
    return filteredManagementAdvice.flatMap((advice) =>
      advice.actionPoints.map((point) => ({ ...point, advice })),
    );
  }, [filteredManagementAdvice]);

  const reorderProtectionRows: BIReorderBlockWarning[] = useMemo(() => {
    return products
      .filter((product) => productStock(product) > 0)
      .map((product) => {
        const staleDays = product.lastMovementDate
          ? Math.max(
              0,
              Math.floor(
                (Date.now() - new Date(product.lastMovementDate).getTime()) /
                  86400000,
              ),
            )
          : 999;
        return {
          warningId: `BIRP-${product.id}`,
          productId: product.id,
          sku: productSku(product),
          productName: productName(product),
          currentQty: product.stock,
          availableQty: productStock(product),
          lastMovementDate: product.lastMovementDate,
          daysWithoutMovement: staleDays,
          blocked: staleDays >= 60,
          reason:
            staleDays >= 90
              ? "Block until approval"
              : staleDays >= 30
                ? "Review first"
                : "Allow reorder",
          createdAt: new Date().toISOString(),
        };
      })
      .sort((a, b) => b.daysWithoutMovement - a.daysWithoutMovement)
      .slice(0, 8);
  }, [products]);

  if (!hasBiView) {
    return (
      <div className="bi-desk-page">
        <header className="sci-page-header sci-page-header--compact">
          <div>
            <p className="sci-pos-eyebrow">BI Desk</p>
            <h1>Rule-Based POS Intelligence Desk</h1>
          </div>
        </header>
        {permissionMessage()}
      </div>
    );
  }

  return (
    <div className="bi-desk-page" id="bi-desk-root">
      <header className="sci-page-header sci-page-header--compact">
        <div>
          <p className="sci-pos-eyebrow">SCI Cognitive Registry</p>
          <h1>
            <Sliders size={20} aria-hidden="true" /> Rule-Based POS Intelligence
            Desk
          </h1>
          <p>
            {vendorName} / {branchName} / {terminalName} / Build Development
            Rules
          </p>
        </div>
        <div className="sci-page-header__actions">
          <span className="sci-status-pill sci-status-pill--success">
            <Radio size={14} aria-hidden="true" />
            Deterministic Active
          </span>
          <span className="sci-status-pill">Logs {triggerRows.length}</span>
        </div>
      </header>

      <nav className="bi-tab-bar" aria-label="BI Desk sections">
        {biTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`bi-tab ${activeDeskTab === tab ? "bi-tab-active" : ""}`}
            onClick={() => openTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>

      {activeDeskTab === "BI Overview" && (
        <div
          style={{
            backgroundColor: "#f4f5f7",
            padding: "1.5rem",
            border: "1px solid #e5e7eb",
            minHeight: "600px",
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem",
            borderRadius: 0,
          }}
        >
          {/* Owner Command Header */}
          <div
            style={{
              backgroundColor: "#1e222b",
              color: "#ffffff",
              padding: "1rem 1.5rem",
              borderLeft: "4px solid #f26a1b",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderRadius: 0,
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: "18px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Owner Decision Command Centre</h2>
              <p style={{ margin: "0.25rem 0 0 0", fontSize: "12px", color: "#a0aec0" }}>
                Vendor: {vendorName} | Terminal: {terminalName} | Mode: Deterministic Verification
              </p>
            </div>
            <div style={{ backgroundColor: "#f26a1b", color: "#ffffff", padding: "0.5rem 1rem", fontSize: "12px", fontWeight: "bold", textTransform: "uppercase", borderRadius: 0 }}>
              Live Operational View
            </div>
          </div>

          {/* Industrial Filter Panel */}
          <div
            style={{
              backgroundColor: "#1e222b",
              padding: "1.25rem",
              borderLeft: "4px solid #f26a1b",
              color: "#ffffff",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "1rem",
              alignItems: "end",
              borderRadius: 0,
            }}
          >
            {/* Branch Filter */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
              }}
            >
              <label
                style={{
                  fontSize: "10px",
                  textTransform: "uppercase",
                  color: "#a0aec0",
                  fontWeight: "bold",
                }}
              >
                Branch Location
              </label>
              <select
                value={biBranchFilter}
                onChange={(e) => handleBranchFilterChange(e.target.value)}
                style={{
                  backgroundColor: "#2d3748",
                  border: "1px solid #4a5568",
                  color: "#ffffff",
                  padding: "0.45rem",
                  outline: "none",
                  borderRadius: 0,
                  fontSize: "12px",
                }}
              >
                <option value="">All Branches</option>
                {mockBranches.map((b) => (
                  <option key={b.id} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Cashier/Staff Filter */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
              }}
            >
              <label
                style={{
                  fontSize: "10px",
                  textTransform: "uppercase",
                  color: "#a0aec0",
                  fontWeight: "bold",
                }}
              >
                Cashier / Staff
              </label>
              <select
                value={biStaffFilter}
                onChange={(e) => handleStaffFilterChange(e.target.value)}
                style={{
                  backgroundColor: "#2d3748",
                  border: "1px solid #4a5568",
                  color: "#ffffff",
                  padding: "0.45rem",
                  outline: "none",
                  borderRadius: 0,
                  fontSize: "12px",
                }}
              >
                <option value="">All Staff</option>
                {mockStaff.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name} ({s.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Product Filter */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
              }}
            >
              <label
                style={{
                  fontSize: "10px",
                  textTransform: "uppercase",
                  color: "#a0aec0",
                  fontWeight: "bold",
                }}
              >
                Product Line
              </label>
              <select
                value={biProductFilter}
                onChange={(e) => handleProductFilterChange(e.target.value)}
                style={{
                  backgroundColor: "#2d3748",
                  border: "1px solid #4a5568",
                  color: "#ffffff",
                  padding: "0.45rem",
                  outline: "none",
                  borderRadius: 0,
                  fontSize: "12px",
                }}
              >
                <option value="">All Products</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.productName || p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Start Date */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
              }}
            >
              <label
                style={{
                  fontSize: "10px",
                  textTransform: "uppercase",
                  color: "#a0aec0",
                  fontWeight: "bold",
                }}
              >
                Start Date
              </label>
              <input
                type="date"
                value={biStartDateFilter}
                onChange={(e) => handleStartDateFilterChange(e.target.value)}
                style={{
                  backgroundColor: "#2d3748",
                  border: "1px solid #4a5568",
                  color: "#ffffff",
                  padding: "0.4rem",
                  outline: "none",
                  borderRadius: 0,
                  fontSize: "12px",
                }}
              />
            </div>

            {/* End Date */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
              }}
            >
              <label
                style={{
                  fontSize: "10px",
                  textTransform: "uppercase",
                  color: "#a0aec0",
                  fontWeight: "bold",
                }}
              >
                End Date
              </label>
              <input
                type="date"
                value={biEndDateFilter}
                onChange={(e) => handleEndDateFilterChange(e.target.value)}
                style={{
                  backgroundColor: "#2d3748",
                  border: "1px solid #4a5568",
                  color: "#ffffff",
                  padding: "0.4rem",
                  outline: "none",
                  borderRadius: 0,
                  fontSize: "12px",
                }}
              />
            </div>

            {/* Reset Button */}
            <div>
              <button
                type="button"
                onClick={handleResetFilters}
                style={{
                  width: "100%",
                  backgroundColor: "#f26a1b",
                  color: "#ffffff",
                  border: "none",
                  padding: "0.55rem",
                  fontWeight: "bold",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  transition: "background-color 0.2s",
                  borderRadius: 0,
                  fontSize: "12px",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "#d45610")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "#f26a1b")
                }
              >
                Reset Filters
              </button>
            </div>
          </div>

          {/* Executive Risk Strip */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
            <div style={{ backgroundColor: "#ffffff", border: "1px solid #1e222b", borderTop: "4px solid #e53e3e", padding: "1rem", borderRadius: 0 }}>
              <div style={{ fontSize: "10px", color: "#718096", textTransform: "uppercase", fontWeight: "bold" }}>Critical Active Incidents</div>
              <div style={{ fontSize: "24px", color: "#1e222b", fontWeight: 900 }}>{metrics.critical}</div>
            </div>
            <div style={{ backgroundColor: "#ffffff", border: "1px solid #1e222b", borderTop: "4px solid #dd6b20", padding: "1rem", borderRadius: 0 }}>
              <div style={{ fontSize: "10px", color: "#718096", textTransform: "uppercase", fontWeight: "bold" }}>High Priority Exceptions</div>
              <div style={{ fontSize: "24px", color: "#1e222b", fontWeight: 900 }}>{metrics.high}</div>
            </div>
            <div style={{ backgroundColor: "#ffffff", border: "1px solid #1e222b", borderTop: "4px solid #f26a1b", padding: "1rem", borderRadius: 0 }}>
              <div style={{ fontSize: "10px", color: "#718096", textTransform: "uppercase", fontWeight: "bold" }}>Staff Behaviour Flags</div>
              <div style={{ fontSize: "24px", color: "#1e222b", fontWeight: 900 }}>{metrics.staff}</div>
            </div>
            <div style={{ backgroundColor: "#ffffff", border: "1px solid #1e222b", borderTop: "4px solid #3182ce", padding: "1rem", borderRadius: 0 }}>
              <div style={{ fontSize: "10px", color: "#718096", textTransform: "uppercase", fontWeight: "bold" }}>Cash Control Variances</div>
              <div style={{ fontSize: "24px", color: "#1e222b", fontWeight: 900 }}>{metrics.cash}</div>
            </div>
          </div>

          {/* Business Health Index (Replacing Metric Cards Grid) */}
          <div style={{ padding: "1rem", backgroundColor: "#ffffff", border: "1px solid #1e222b", borderLeft: "4px solid #1e222b", borderRadius: 0 }}>
            <h3 style={{ margin: "0 0 1rem 0", fontSize: "14px", textTransform: "uppercase", color: "#1e222b" }}>Business Health Index</h3>
            {isLoadingBi ? (
            <div
              style={{
                padding: "4rem",
                textTransform: "uppercase",
                fontWeight: "bold",
                fontSize: "12px",
                color: "#1e222b",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#ffffff",
                border: "1px solid #edf2f7",
                borderRadius: 0,
              }}
            >
              <span className="animate-pulse" style={{ color: "#f26a1b" }}>
                [LOADING DETECTED: AGGREGATING DECISION METRICS...]
              </span>
            </div>
          ) : biMetrics ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
                gap: "1rem",
              }}
            >
              {[
                {
                  key: "stockRisk",
                  label: "Stock Risk Score",
                  value: biMetrics.stockRiskScore,
                  max: "/100",
                  help:
                    biMetrics.stockRiskScore > 40
                      ? "CRITICAL ADJUSTMENTS"
                      : "STABLE LEVELS",
                  statusColor:
                    biMetrics.stockRiskScore > 40 ? "#e53e3e" : "#38a169",
                },
                {
                  key: "cashierRisk",
                  label: "Cashier Risk Score",
                  value: biMetrics.cashierRiskScore,
                  max: "/100",
                  help:
                    biMetrics.cashierRiskScore > 40
                      ? "OVERRIDE ANOMALIES"
                      : "STANDARD OVERRIDES",
                  statusColor:
                    biMetrics.cashierRiskScore > 40 ? "#e53e3e" : "#38a169",
                },
                {
                  key: "theftAlerts",
                  label: "Theft/Variance Alerts",
                  value: biMetrics.theftVarianceAlerts,
                  help:
                    biMetrics.theftVarianceAlerts > 0
                      ? "SUSPICIOUS DRAWER DRAINS"
                      : "NO DRAWER DRIFT",
                  statusColor:
                    biMetrics.theftVarianceAlerts > 0 ? "#e53e3e" : "#a0aec0",
                },
                {
                  key: "lowStock",
                  label: "Low Stock Alerts",
                  value: biMetrics.lowStockAlerts,
                  help:
                    biMetrics.lowStockAlerts > 5
                      ? "REORDER REQUIRED"
                      : "STABLE RESERVE",
                  statusColor:
                    biMetrics.lowStockAlerts > 5 ? "#dd6b20" : "#a0aec0",
                },
                {
                  key: "deadStock",
                  label: "Dead Stock Warnings",
                  value: biMetrics.deadStockWarnings,
                  help:
                    biMetrics.deadStockWarnings > 10
                      ? "SLUGGISH TURNOVER"
                      : "EFFICIENT ROTATION",
                  statusColor:
                    biMetrics.deadStockWarnings > 10 ? "#dd6b20" : "#a0aec0",
                },
                {
                  key: "fastMoving",
                  label: "Fast Moving Stock",
                  value: biMetrics.fastMovingStock,
                  help: "HIGH VELOCITY LINES",
                  statusColor: "#3182ce",
                },
                {
                  key: "suspiciousDiscounts",
                  label: "Suspicious Discounts/Voids",
                  value: biMetrics.suspiciousDiscountsCount,
                  help:
                    biMetrics.suspiciousDiscountsCount > 2
                      ? "AUDIT VOIDS DETECTED"
                      : "STANDARD DISTRIBUTION",
                  statusColor:
                    biMetrics.suspiciousDiscountsCount > 2
                      ? "#dd6b20"
                      : "#a0aec0",
                },
                {
                  key: "deliveryScore",
                  label: "Delivery Completion Score",
                  value: biMetrics.deliveryCompletionScore,
                  max: "%",
                  help:
                    biMetrics.deliveryCompletionScore < 90
                      ? "LATE SLA SHIPMENTS"
                      : "OPTIMAL DISPATCH",
                  statusColor:
                    biMetrics.deliveryCompletionScore < 90
                      ? "#dd6b20"
                      : "#38a169",
                },
                {
                  key: "cashConfirmation",
                  label: "Cash Confirmation Status",
                  value:
                    biMetrics.cashReceivedConfirmationStatus.status ===
                    "All Confirmed"
                      ? "All Confirmed"
                      : `${biMetrics.cashReceivedConfirmationStatus.missingCount} Missing`,
                  help:
                    biMetrics.cashReceivedConfirmationStatus.missingCount > 0
                      ? "PENDING CASHIER ESCROW"
                      : "FULLY RECONCILED",
                  statusColor:
                    biMetrics.cashReceivedConfirmationStatus.missingCount > 0
                      ? "#e53e3e"
                      : "#38a169",
                },
                {
                  key: "branchPerformance",
                  label: "Branch Performance Summary",
                  value: `${biMetrics.branchPerformance.length} Monitored`,
                  help: "PHYSICAL STORE AUDIT",
                  statusColor: "#3182ce",
                },
              ].map((card) => (
                <div
                  key={card.key}
                  onClick={() => handleOpenDrillDown(card.key)}
                  style={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #1e222b",
                    borderLeft: "4px solid #f26a1b",
                    padding: "1.25rem",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    minHeight: "130px",
                    transition: "transform 0.15s, box-shadow 0.15s",
                    borderRadius: 0,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow =
                      "0 6px 12px rgba(0, 0, 0, 0.08)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "none";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div>
                    <span
                      style={{
                        fontSize: "10px",
                        textTransform: "uppercase",
                        color: "#718096",
                        fontWeight: "bold",
                        display: "block",
                        marginBottom: "0.35rem",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {card.label}
                    </span>
                    <strong
                      style={{
                        fontSize: "28px",
                        color: "#1e222b",
                        fontWeight: 800,
                        fontFamily: "monospace",
                      }}
                    >
                      {card.value}
                      {card.max && (
                        <span
                          style={{
                            fontSize: "14px",
                            color: "#a0aec0",
                            fontWeight: "normal",
                          }}
                        >
                          {card.max}
                        </span>
                      )}
                    </strong>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginTop: "0.75rem",
                      borderTop: "1px solid #edf2f7",
                      paddingTop: "0.45rem",
                    }}
                  >
                    <small
                      style={{
                        fontSize: "9px",
                        fontWeight: "bold",
                        color: card.statusColor,
                        letterSpacing: "0.02em",
                      }}
                    >
                      {card.help}
                    </small>
                    <span
                      style={{
                        fontSize: "10px",
                        color: "#f26a1b",
                        fontWeight: "bold",
                      }}
                    >
                      DRILL DOWN &rarr;
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                padding: "3rem",
                textTransform: "uppercase",
                fontWeight: "bold",
                fontSize: "12px",
                color: "#e53e3e",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: 0,
              }}
            >
              [ERROR DETECTED: FAILED TO PARSE BI SERVICES METRIC PAYLOAD]
            </div>
          )}
          </div>

          {/* 3-Column Layout: Owner Action Centre, Risk Rankings, Delivery Intelligence */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1.5rem" }}>
            {/* Owner Action Centre */}
            <div style={{ backgroundColor: "#ffffff", border: "1px solid #1e222b", padding: "1rem", borderRadius: 0, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <h3 style={{ margin: 0, fontSize: "14px", textTransform: "uppercase", color: "#1e222b", borderBottom: "1px solid #edf2f7", paddingBottom: "0.5rem" }}>Owner Action Centre</h3>
              <button style={{ backgroundColor: "#1e222b", color: "#ffffff", padding: "0.75rem", border: "none", textAlign: "left", fontSize: "12px", textTransform: "uppercase", cursor: "pointer", borderRadius: 0 }} onClick={() => openTab("Management BI")}>Review Management BI Advice</button>
              <button style={{ backgroundColor: "#1e222b", color: "#ffffff", padding: "0.75rem", border: "none", textAlign: "left", fontSize: "12px", textTransform: "uppercase", cursor: "pointer", borderRadius: 0 }} onClick={() => openTab("Ruleset Library")}>Configure Deterministic Rules</button>
              <button style={{ backgroundColor: "#1e222b", color: "#ffffff", padding: "0.75rem", border: "none", textAlign: "left", fontSize: "12px", textTransform: "uppercase", cursor: "pointer", borderRadius: 0 }} onClick={handleGenerateShelfPlan}>Generate Stocktake Plan</button>
            </div>

            {/* Risk Rankings */}
            <div style={{ backgroundColor: "#ffffff", border: "1px solid #1e222b", padding: "1rem", borderRadius: 0 }}>
              <h3 style={{ margin: "0 0 1rem 0", fontSize: "14px", textTransform: "uppercase", color: "#1e222b", borderBottom: "1px solid #edf2f7", paddingBottom: "0.5rem" }}>Risk Rankings (Top Flags)</h3>
              <div style={{ fontSize: "12px", color: "#4a5568", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {triggerRows.slice(0, 3).map((r, i) => (
                  <div key={r.id} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #edf2f7", paddingBottom: "0.25rem" }}>
                    <span>{i+1}. {r.staffName || r.productName || "System Event"}</span>
                    <strong style={{ color: "#e53e3e" }}>{r.severity}</strong>
                  </div>
                ))}
                {triggerRows.length === 0 && <div style={{ color: "#a0aec0" }}>No active risk flags logged.</div>}
              </div>
            </div>

            {/* Delivery Intelligence Preview */}
            <div style={{ backgroundColor: "#ffffff", border: "1px solid #1e222b", padding: "1rem", borderRadius: 0, display: "flex", flexDirection: "column" }}>
              <h3 style={{ margin: "0 0 1rem 0", fontSize: "14px", textTransform: "uppercase", color: "#1e222b", borderBottom: "1px solid #edf2f7", paddingBottom: "0.5rem" }}>Delivery Intelligence</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "12px", color: "#4a5568", textTransform: "uppercase", fontWeight: "bold" }}>Completion Score</span>
                  <strong style={{ fontSize: "16px", color: biMetrics?.deliveryCompletionScore && biMetrics.deliveryCompletionScore < 90 ? "#dd6b20" : "#38a169" }}>{biMetrics?.deliveryCompletionScore || 0}%</strong>
                </div>
                <div style={{ fontSize: "11px", color: "#718096", lineHeight: 1.4 }}>
                  Rule-based tracking of dispatch delays, pending codes, and failed confirmation events without predictive scoring.
                </div>
                <div style={{ flex: 1 }}></div>
                <button style={{ backgroundColor: "#f26a1b", color: "#ffffff", padding: "0.5rem", border: "none", fontSize: "10px", textTransform: "uppercase", cursor: "pointer", width: "100%", borderRadius: 0, fontWeight: "bold" }} onClick={() => { selectDomain("Delivery Verification"); openTab("Ruleset Library"); }}>View Delivery Rules</button>
              </div>
            </div>
          </div>

          {/* Live Trigger Stream */}
          <div style={{ backgroundColor: "#ffffff", border: "1px solid #1e222b", padding: "1rem", borderRadius: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1e222b", paddingBottom: "0.75rem", marginBottom: "1rem" }}>
              <h3 style={{ margin: 0, fontSize: "14px", textTransform: "uppercase", color: "#1e222b" }}>Live Trigger Stream</h3>
              <button style={{ background: "none", border: "none", color: "#f26a1b", fontSize: "11px", textTransform: "uppercase", cursor: "pointer", fontWeight: "bold" }} onClick={() => openTab("Trigger Logs")}>View Full Logs &rarr;</button>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f7fafc", color: "#718096", textTransform: "uppercase", fontSize: "10px" }}>
                    <th style={{ padding: "0.5rem", borderBottom: "2px solid #1e222b" }}>Time/ID</th>
                    <th style={{ padding: "0.5rem", borderBottom: "2px solid #1e222b" }}>Domain</th>
                    <th style={{ padding: "0.5rem", borderBottom: "2px solid #1e222b" }}>Severity</th>
                    <th style={{ padding: "0.5rem", borderBottom: "2px solid #1e222b" }}>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {triggerRows.slice(0, 4).map((row) => (
                    <tr key={row.id} style={{ borderBottom: "1px solid #edf2f7" }}>
                      <td style={{ padding: "0.5rem", color: "#a0aec0", fontFamily: "monospace" }}>{row.id.slice(0, 8)}</td>
                      <td style={{ padding: "0.5rem", fontWeight: "bold", color: "#1e222b" }}>{row.domain}</td>
                      <td style={{ padding: "0.5rem", color: row.severity === "Critical" ? "#e53e3e" : row.severity === "High" ? "#dd6b20" : "#718096", fontWeight: "bold" }}>{row.severity}</td>
                      <td style={{ padding: "0.5rem", color: "#4a5568" }}>{row.description.slice(0, 60)}{row.description.length > 60 ? "..." : ""}</td>
                    </tr>
                  ))}
                  {triggerRows.length === 0 && (
                    <tr><td colSpan={4} style={{ padding: "1rem", textAlign: "center", color: "#a0aec0" }}>No recent triggers logged.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Active BI Alerts Section Header & Panel */}
          <div
            style={{
              padding: "1rem",
              backgroundColor: "#ffffff",
              border: "1px solid #1e222b",
              borderLeft: "4px solid #f26a1b",
              borderRadius: 0,
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: "16px",
                fontWeight: "bold",
                textTransform: "uppercase",
                color: "#1e222b",
              }}
            >
              Active BI Alerts
            </h2>
            <p
              style={{
                margin: "0.25rem 0 0 0",
                fontSize: "12px",
                color: "#718096",
              }}
            >
              Deterministic rule-based alerts requiring Owner or SysAdmin attention.
            </p>
          </div>
          <BIAlertPanel
            vendorId={session?.vendor || "default"}
            terminalName={terminalName}
          />

          {/* Audit & Diagnostic Footer Panel */}
          <div
            style={{
              backgroundColor: "#ffffff",
              border: "1px solid #1e222b",
              borderLeft: "4px solid #1e222b",
              padding: "1.25rem",
              display: "grid",
              gridTemplateColumns: "1fr auto",
              alignItems: "center",
              gap: "1rem",
              borderRadius: 0,
            }}
          >
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: "14px",
                  color: "#1e222b",
                  fontWeight: "bold",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <div
                  style={{
                    width: "8px",
                    height: "8px",
                    backgroundColor: "#f26a1b",
                  }}
                ></div>
                Deterministic Verification Protocol
              </h3>
              <p
                style={{
                  margin: "0.25rem 0 0 0",
                  fontSize: "12px",
                  color: "#718096",
                  lineHeight: 1.4,
                }}
              >
                Operational intelligence scores are computed dynamically from
                logged transactional incidents. AI predictions, ML scoring
                heuristics, and statistical assumptions are completely excluded.
              </p>
            </div>
            <div
              style={{
                fontSize: "11px",
                color: "#1e222b",
                fontWeight: "bold",
                backgroundColor: "#edf2f7",
                padding: "0.5rem 0.75rem",
                border: "1px solid #cbd5e0",
                fontFamily: "monospace",
                borderRadius: 0,
              }}
            >
              SOURCE FEED: {transactions.length} SALES | {products.length}{" "}
              PRODUCTS | {triggerRows.length} AUDIT LOGS
            </div>
          </div>
        </div>
      )}

      {/* Drill-down Detail Panel Modal */}
      {selectedDrillDownKey &&
        biMetrics &&
        (() => {
          const drillDownInfo =
            selectedDrillDownKey === "branchPerformance"
              ? {
                  reason:
                    "Analysis of sales transaction volumes, gross values, and cashier override statistics per physical store branch.",
                  recommendedAction:
                    "Schedule a stocktake recount and cashmere override review for branches exhibiting risk scores above 15.",
                  logs: biMetrics.branchPerformance.map((bp) => ({
                    id: bp.branchId,
                    timestamp: new Date().toISOString(),
                    description: `Branch: ${bp.branchName} | Sales: ${bp.salesCount} ($${bp.totalSales}) | Risk Score: ${bp.riskScore}/100 [${bp.riskLevel}]`,
                    severity: (bp.riskLevel === "CRITICAL"
                      ? "Critical"
                      : bp.riskLevel === "HIGH"
                        ? "High"
                        : bp.riskLevel === "MEDIUM"
                          ? "Medium"
                          : "Low") as "Low" | "Medium" | "High" | "Critical",
                    branchName: bp.branchName,
                  })),
                }
              : biMetrics.drillDowns[selectedDrillDownKey] || {
                  reason: "No detailed warning rationale found.",
                  recommendedAction:
                    "Verify active filter configurations and scan logs.",
                  logs: [],
                };

          return (
            <div
              style={{
                position: "fixed",
                inset: 0,
                backgroundColor: "rgba(30, 34, 43, 0.85)",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                zIndex: 9999,
                padding: "1.5rem",
                backdropFilter: "blur(2px)",
              }}
            >
              <div
                style={{
                  backgroundColor: "#ffffff",
                  border: "2px solid #1e222b",
                  borderTop: "6px solid #f26a1b",
                  width: "100%",
                  maxWidth: "950px",
                  maxHeight: "85vh",
                  display: "flex",
                  flexDirection: "column",
                  borderRadius: 0,
                  boxShadow:
                    "0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.3)",
                }}
              >
                {/* Modal Header */}
                <div
                  style={{
                    backgroundColor: "#1e222b",
                    padding: "1.25rem",
                    color: "#ffffff",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <h2
                      style={{
                        margin: 0,
                        fontSize: "16px",
                        fontWeight: "bold",
                        textTransform: "uppercase",
                        color: "#ffffff",
                        letterSpacing: "0.03em",
                      }}
                    >
                      {selectedDrillDownKey === "stockRisk" &&
                        "Stock Risk Score Audit"}
                      {selectedDrillDownKey === "cashierRisk" &&
                        "Cashier Risk Score Audit"}
                      {selectedDrillDownKey === "theftAlerts" &&
                        "Theft / Variance Alerts Audit"}
                      {selectedDrillDownKey === "lowStock" &&
                        "Low Stock Safety Threshold Audit"}
                      {selectedDrillDownKey === "deadStock" &&
                        "Dead Stock Warning Audit"}
                      {selectedDrillDownKey === "fastMoving" &&
                        "Fast Moving Stock Velocity Report"}
                      {selectedDrillDownKey === "suspiciousDiscounts" &&
                        "Suspicious Discounts / Voids / Refunds Audit"}
                      {selectedDrillDownKey === "deliveryScore" &&
                        "Delivery Fulfillment SLA Audit"}
                      {selectedDrillDownKey === "cashConfirmation" &&
                        "Delivery Cash Handover Audit"}
                      {selectedDrillDownKey === "branchPerformance" &&
                        "Branch Performance Risk Audit"}
                    </h2>
                    <span
                      style={{
                        fontSize: "10px",
                        color: "#a0aec0",
                        textTransform: "uppercase",
                        fontWeight: "bold",
                        display: "block",
                        marginTop: "0.2rem",
                        letterSpacing: "0.05em",
                      }}
                    >
                      Metric ID: {selectedDrillDownKey} | Active Scan Scope
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedDrillDownKey(null)}
                    style={{
                      backgroundColor: "transparent",
                      border: "1px solid #4a5568",
                      color: "#ffffff",
                      padding: "0.35rem 0.75rem",
                      cursor: "pointer",
                      fontWeight: "bold",
                      borderRadius: 0,
                      fontSize: "11px",
                      textTransform: "uppercase",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.borderColor = "#f26a1b")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.borderColor = "#4a5568")
                    }
                  >
                    CLOSE [ESC]
                  </button>
                </div>

                {/* Modal Body */}
                <div
                  style={{
                    padding: "1.5rem",
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: "1.25rem",
                  }}
                >
                  {/* Score Reason */}
                  <div
                    style={{
                      backgroundColor: "#f7fafc",
                      borderLeft: "4px solid #f26a1b",
                      padding: "1rem",
                      border: "1px solid #e2e8f0",
                      borderLeftWidth: "4px",
                      borderRadius: 0,
                    }}
                  >
                    <h4
                      style={{
                        margin: "0 0 0.35rem 0",
                        fontSize: "10px",
                        textTransform: "uppercase",
                        color: "#718096",
                        fontWeight: "bold",
                        letterSpacing: "0.05em",
                      }}
                    >
                      Deterministic Rationale
                    </h4>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "13px",
                        color: "#1e222b",
                        lineHeight: 1.45,
                        fontWeight: "bold",
                      }}
                    >
                      {drillDownInfo.reason}
                    </p>
                  </div>

                  {/* Recommended Action */}
                  <div
                    style={{
                      backgroundColor: "#fffaf0",
                      borderLeft: "4px solid #dd6b20",
                      padding: "1rem",
                      border: "1px solid #feebc8",
                      borderLeftWidth: "4px",
                      borderRadius: 0,
                    }}
                  >
                    <h4
                      style={{
                        margin: "0 0 0.35rem 0",
                        fontSize: "10px",
                        textTransform: "uppercase",
                        color: "#dd6b20",
                        fontWeight: "bold",
                        letterSpacing: "0.05em",
                      }}
                    >
                      Recommended Action Path
                    </h4>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "13px",
                        color: "#2d3748",
                        lineHeight: 1.45,
                      }}
                    >
                      {drillDownInfo.recommendedAction}
                    </p>
                  </div>

                  {/* Logs Table */}
                  <div>
                    <h3
                      style={{
                        margin: "0 0 0.75rem 0",
                        fontSize: "12px",
                        textTransform: "uppercase",
                        color: "#1e222b",
                        fontWeight: "bold",
                        letterSpacing: "0.02em",
                      }}
                    >
                      Related Diagnostic Log Entries (
                      {drillDownInfo.logs.length})
                    </h3>

                    {drillDownInfo.logs.length > 0 ? (
                      <div
                        style={{
                          overflowX: "auto",
                          border: "1px solid #cbd5e0",
                          borderRadius: 0,
                        }}
                      >
                        <table
                          style={{
                            width: "100%",
                            borderCollapse: "collapse",
                            fontSize: "11px",
                            textRendering: "optimizeLegibility",
                            borderRadius: 0,
                          }}
                        >
                          <thead>
                            <tr
                              style={{
                                backgroundColor: "#1e222b",
                                color: "#ffffff",
                                textAlign: "left",
                              }}
                            >
                              <th
                                style={{
                                  padding: "0.75rem",
                                  borderRight: "1px solid #4a5568",
                                  fontWeight: "bold",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.02em",
                                }}
                              >
                                Timestamp
                              </th>
                              <th
                                style={{
                                  padding: "0.75rem",
                                  borderRight: "1px solid #4a5568",
                                  fontWeight: "bold",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.02em",
                                }}
                              >
                                Description
                              </th>
                              <th
                                style={{
                                  padding: "0.75rem",
                                  borderRight: "1px solid #4a5568",
                                  fontWeight: "bold",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.02em",
                                }}
                              >
                                Severity
                              </th>
                              <th
                                style={{
                                  padding: "0.75rem",
                                  borderRight: "1px solid #4a5568",
                                  fontWeight: "bold",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.02em",
                                }}
                              >
                                Operator
                              </th>
                              <th
                                style={{
                                  padding: "0.75rem",
                                  fontWeight: "bold",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.02em",
                                }}
                              >
                                Context
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {drillDownInfo.logs.map((log: any, idx: number) => (
                              <tr
                                key={log.id || idx}
                                style={{
                                  backgroundColor:
                                    idx % 2 === 0 ? "#ffffff" : "#f7fafc",
                                  borderBottom: "1px solid #edf2f7",
                                }}
                              >
                                <td
                                  style={{
                                    padding: "0.75rem",
                                    whiteSpace: "nowrap",
                                    borderRight: "1px solid #edf2f7",
                                    color: "#4a5568",
                                    fontFamily: "monospace",
                                  }}
                                >
                                  {log.timestamp.includes("T")
                                    ? log.timestamp.split("T")[0] +
                                      " " +
                                      log.timestamp.split("T")[1].slice(0, 8)
                                    : log.timestamp}
                                </td>
                                <td
                                  style={{
                                    padding: "0.75rem",
                                    borderRight: "1px solid #edf2f7",
                                    color: "#1e222b",
                                    fontWeight: "bold",
                                    lineHeight: 1.4,
                                  }}
                                >
                                  {log.description}
                                </td>
                                <td
                                  style={{
                                    padding: "0.75rem",
                                    borderRight: "1px solid #edf2f7",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  <span
                                    style={{
                                      backgroundColor:
                                        log.severity === "Critical"
                                          ? "#fed7d7"
                                          : log.severity === "High"
                                            ? "#feebc8"
                                            : log.severity === "Medium"
                                              ? "#e2e8f0"
                                              : "#e6fffa",
                                      color:
                                        log.severity === "Critical"
                                          ? "#9b2c2c"
                                          : log.severity === "High"
                                            ? "#c05621"
                                            : log.severity === "Medium"
                                              ? "#4a5568"
                                              : "#234e52",
                                      padding: "0.25rem 0.5rem",
                                      fontSize: "9px",
                                      fontWeight: "bold",
                                      textTransform: "uppercase",
                                      borderRadius: 0,
                                    }}
                                  >
                                    {log.severity}
                                  </span>
                                </td>
                                <td
                                  style={{
                                    padding: "0.75rem",
                                    borderRight: "1px solid #edf2f7",
                                    color: "#4a5568",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {log.operator || "SYSTEM"}
                                </td>
                                <td
                                  style={{
                                    padding: "0.75rem",
                                    color: "#718096",
                                    fontSize: "10px",
                                  }}
                                >
                                  {log.branchName &&
                                    `Branch: ${log.branchName}`}
                                  {log.terminal && ` | Term: ${log.terminal}`}
                                  {log.productName &&
                                    ` | Prod: ${log.productName}`}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div
                        style={{
                          padding: "3rem",
                          border: "1px dashed #cbd5e0",
                          color: "#718096",
                          textAlign: "center",
                          fontSize: "12px",
                          backgroundColor: "#f7fafc",
                          borderRadius: 0,
                        }}
                      >
                        No matching log exceptions in active filter scope.
                      </div>
                    )}
                  </div>
                </div>

                {/* Modal Footer */}
                <div
                  style={{
                    backgroundColor: "#f7fafc",
                    padding: "1.25rem",
                    borderTop: "1px solid #edf2f7",
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "0.5rem",
                    borderRadius: 0,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedDrillDownKey(null)}
                    style={{
                      backgroundColor: "#1e222b",
                      color: "#ffffff",
                      border: "none",
                      padding: "0.6rem 2rem",
                      fontWeight: "bold",
                      cursor: "pointer",
                      textTransform: "uppercase",
                      borderRadius: 0,
                      fontSize: "12px",
                      transition: "background-color 0.2s",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor = "#f26a1b")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = "#1e222b")
                    }
                  >
                    Acknowledge & Close
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {activeDeskTab === "Management BI" && (
        <section className="bi-management-shell">
          {!canViewManagement && permissionMessage()}
          {canViewManagement && managementInsight && (
            <>
              <div className="bi-management-toolbar">
                <label className="bi-trigger-searchbar">
                  <Search size={15} aria-hidden="true" />
                  <input
                    value={managementSearch}
                    onChange={(event) =>
                      setManagementSearch(event.target.value)
                    }
                    placeholder="Search BI management logs, advice, action points"
                  />
                </label>
                <button
                  type="button"
                  className="sci-pos-button sci-pos-button--primary"
                  onClick={handleGenerateManagement}
                >
                  Generate Management BI
                </button>
                <button
                  type="button"
                  className="sci-pos-button sci-pos-button--secondary"
                  onClick={handleExportManagementCsv}
                >
                  Export CSV
                </button>
                <button
                  type="button"
                  className="sci-pos-button sci-pos-button--secondary"
                  onClick={() => window.print()}
                >
                  Print Dashboard
                </button>
              </div>

              <div className="bi-management-metric-grid">
                {managementInsight.metrics.map((metric) => (
                  <article key={metric.metricId} className="bi-metric-card">
                    <span>{metric.label}</span>
                    <strong>{metric.value}</strong>
                    <small>{metric.help}</small>
                  </article>
                ))}
              </div>

              <div className="bi-management-domain-grid">
                {managementInsight.domainCards.map((card) => (
                  <article
                    key={card.domain}
                    className="bi-management-domain-card"
                  >
                    <div>
                      <strong>{card.domain}</strong>
                      <span className={riskBadgeClass(card.riskLevel)}>
                        {card.riskLevel}
                      </span>
                    </div>
                    <p>
                      Risk score {card.riskScore} / Open warnings{" "}
                      {card.openWarnings}
                    </p>
                    <small>Due action points: {card.dueActionPoints}</small>
                    <small>Last trigger: {card.lastTrigger}</small>
                    <button
                      type="button"
                      className="sci-pos-button sci-pos-button--secondary"
                      onClick={() => setManagementSearch(card.domain)}
                    >
                      View Advice
                    </button>
                  </article>
                ))}
              </div>

              <ManagementAdviceTable
                records={filteredManagementAdvice}
                openMenuId={openManagementMenuId}
                setOpenMenuId={setOpenManagementMenuId}
                onOpen={handleOpenManagementAdvice}
                onStart={(advice) =>
                  void handleManagementAdviceStatus(advice, "In Progress")
                }
                onResolve={(advice) =>
                  void handleManagementAdviceStatus(advice, "Resolved")
                }
                onDismiss={(advice) =>
                  void handleManagementAdviceStatus(advice, "Dismissed")
                }
                onEscalate={(advice) =>
                  void handleManagementAdviceStatus(advice, "Escalated")
                }
                onPrint={handlePrintManagementAdvice}
              />

              {canViewActionPoints && (
                <BIActionPointsPanel
                  points={managementActionPoints}
                  onOpen={(advice) => void handleOpenManagementAdvice(advice)}
                  onUpdate={(point, status) =>
                    void handleManagementActionPoint(point, status)
                  }
                />
              )}

              {canViewReorderProtection && (
                <ReorderProtectionPanel
                  rows={reorderProtectionRows}
                  canOverride={canOverrideReorderProtection}
                  onAction={(label, row) =>
                    addActivity(
                      `BI_REORDER_PROTECTION_ACTION: ${label} for ${row.sku}.`,
                      "ACTION",
                    )
                  }
                />
              )}

              <div className="bi-management-two-col">
                {canViewProfitSnapshot && profitSnapshot && (
                  <ProfitSnapshotPanel
                    snapshot={profitSnapshot}
                    onRefresh={() => {
                      setProfitSnapshot(
                        generateSalesProfitSnapshot(
                          getSalesProfitDefaultFilter(),
                          undefined,
                          products,
                          staffName,
                          { branchName, terminalName, cashierName: staffName },
                        ),
                      );
                      addActivity(
                        "SALES_PROFIT_SNAPSHOT_GENERATED: BI Management snapshot refreshed.",
                        "SUCCESS",
                      );
                    }}
                    onPrint={() => {
                      recordSalesProfitSnapshotPrintPlaceholder(staffName);
                      window.print();
                    }}
                    onExport={() => {
                      recordSalesProfitSnapshotExportPlaceholder(staffName);
                      addActivity(
                        "SALES_PROFIT_SNAPSHOT_EXPORT_PLACEHOLDER: Export placeholder recorded.",
                        "SUCCESS",
                      );
                    }}
                  />
                )}
                {canViewTaxReadiness && (
                  <VatReadinessPanel
                    advice={filteredManagementAdvice}
                    onAction={(label) =>
                      addActivity(
                        `BI_TAX_READINESS_ACTION: ${label}.`,
                        "ACTION",
                      )
                    }
                  />
                )}
              </div>
            </>
          )}
        </section>
      )}

      {activeDeskTab === "Ruleset Library" && (
        <section className="sci-pos-card">
          <div className="bi-section-header">
            <BookOpen
              className="bi-section-header-icon"
              size={18}
              aria-hidden="true"
            />
            <div>
              <h2 className="bi-section-header-title">Ruleset Library</h2>
              <span>
                Active rules, rule descriptions, severity mix, and output
                preview.
              </span>
            </div>
          </div>
          {!canReviewRisk && permissionMessage()}
          {canReviewRisk && (
            <div className="bi-ruleset-layout">
              <aside className="bi-ruleset-list">
                <label className="bi-trigger-searchbar">
                  <Search size={15} aria-hidden="true" />
                  <input
                    value={rulesetSearch}
                    onChange={(event) => {
                      setRulesetSearch(event.target.value);
                      addActivity(
                        "BI_RULESET_OUTPUT_VIEWED: ruleset search updated",
                        "INFO",
                      );
                    }}
                    placeholder="Search rules in any word order"
                  />
                </label>
                {ruleDomains.map((domain) => (
                  <button
                    key={domain}
                    type="button"
                    className={selectedDomain === domain ? "active" : ""}
                    onClick={() => selectDomain(domain)}
                  >
                    <strong>{domain}</strong>
                    <span>{rulesMap[domain].length} active rules</span>
                  </button>
                ))}
              </aside>
              <div className="bi-ruleset-output">
                <div className="bi-ruleset-summary">
                  <div>
                    <span>Domain</span>
                    <strong>{selectedDomain}</strong>
                  </div>
                  <div>
                    <span>Active Rule Count</span>
                    <strong>
                      {filteredRules.length} / {domainRules.length}
                    </strong>
                  </div>
                  <div>
                    <span>Severity Mix</span>
                    <strong>{severityMix}</strong>
                  </div>
                  <div>
                    <span>Rules Management</span>
                    <strong>{canManageRules ? "Allowed" : "View only"}</strong>
                  </div>
                </div>
                <p>{ruleDescriptions[selectedDomain]}</p>
                <div className="bi-ruleset-rules">
                  {filteredRules.map((rule) => (
                    <article key={rule.ruleName}>
                      <span className={riskBadgeClass(rule.riskLevel)}>
                        {rule.riskLevel}
                      </span>
                      <strong>{rule.ruleName}</strong>
                      <small>{rule.ruleTrigger}</small>
                      <p>{rule.description}</p>
                      <b>{rule.recommendedAction}</b>
                    </article>
                  ))}
                  {filteredRules.length === 0 && (
                    <div className="sci-pos-empty-cell">
                      No rules matched your search.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {activeDeskTab === "Trigger Logs" && (
        <section className="sci-pos-card bi-trigger-card">
          <div className="bi-section-header">
            <ShieldAlert
              className="bi-section-header-icon"
              size={18}
              aria-hidden="true"
            />
            <div>
              <h2 className="bi-section-header-title">Trigger Logs</h2>
              <span>
                Search BI rule triggers, incident descriptions, risk levels, and
                recommended resolve paths.
              </span>
            </div>
          </div>
          <div className="bi-trigger-searchbar">
            <Search size={15} aria-hidden="true" />
            <input
              value={triggerSearch}
              onChange={(event) => {
                setTriggerSearch(event.target.value);
                addActivity(
                  "BI_TRIGGER_SEARCH_APPLIED: trigger search updated",
                  "INFO",
                );
              }}
              placeholder="Search trigger logs in any word order"
            />
            <Filter size={15} aria-hidden="true" />
            <select
              value={severityFilter}
              onChange={(event) => {
                setSeverityFilter(event.target.value);
                addActivity(
                  `BI_TRIGGER_FILTER_APPLIED: severity ${event.target.value}`,
                  "INFO",
                );
              }}
            >
              <option value="ALL">All Severities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
            <select
              value={domainFilter}
              onChange={(event) => {
                setDomainFilter(event.target.value);
                addActivity(
                  `BI_TRIGGER_FILTER_APPLIED: domain ${event.target.value}`,
                  "INFO",
                );
              }}
            >
              <option value="ALL">All Domains</option>
              {ruleDomains.map((domain) => (
                <option key={domain} value={domain}>
                  {domain}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="sci-pos-button sci-pos-button--secondary"
              onClick={() => {
                setTriggerSearch("");
                setSeverityFilter("ALL");
                setDomainFilter("ALL");
              }}
            >
              Reset Filters
            </button>
          </div>
          <div className="bi-trigger-result-count">
            {filteredAlerts.length} trigger logs found
          </div>
          <div className="bi-trigger-table-scroll">
            <table className="bi-trigger-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Domain</th>
                  <th>Risk Level</th>
                  <th>Rule Trigger</th>
                  <th>Incident Description</th>
                  <th>Recommended Resolve Path</th>
                  <th>Status</th>
                  <th>Gate Key</th>
                </tr>
              </thead>
              <tbody>
                {filteredAlerts.map((row) => {
                  const isDone =
                    row.status !== "Open" && row.status !== "Pending Approval";
                  return (
                    <tr key={row.id}>
                      <td>{row.eventType}</td>
                      <td>{row.domain}</td>
                      <td>
                        <span className={riskBadgeClass(row.severity)}>
                          {row.severity}
                        </span>
                      </td>
                      <td>{row.trigger}</td>
                      <td>{row.description}</td>
                      <td>{row.recommendedAction}</td>
                      <td>{row.status}</td>
                      <td>
                        {isDone ? (
                          <span className="bi-done-label">
                            <Check size={13} aria-hidden="true" /> Done
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="bi-log-action-button"
                            onClick={() =>
                              handleAlertAction(row.id, row.actionLabel)
                            }
                            title={triggerActionText(row)}
                            aria-label={triggerActionText(row)}
                          >
                            {triggerActionText(row)}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredAlerts.length === 0 && (
                  <tr>
                    <td colSpan={8} className="sci-pos-empty-cell">
                      No trigger logs matched your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeDeskTab === "Active Alerts" && (
        <BIAlertPanel
          vendorId={session?.vendor || "default"}
          terminalName={terminalName}
        />
      )}

      {activeDeskTab === "BI Advice Flow" && (
        <section className="sci-pos-card">
          <div className="bi-section-header">
            <BookOpen
              className="bi-section-header-icon"
              size={18}
              aria-hidden="true"
            />
            <div>
              <h2 className="bi-section-header-title">BI Advice Flow</h2>
              <span>
                Rule-based warnings, recommendations, assigned action points,
                and staff desk routing.
              </span>
            </div>
          </div>
          <BIAdviceFlowPanel
            records={adviceRecords}
            filters={adviceFilters}
            onFiltersChange={setAdviceFilters}
            onGenerate={handleGenerateAdvice}
            onGenerateShelfPlan={handleGenerateShelfPlan}
            onGenerateReorderWarnings={handleGenerateReorderWarnings}
            onRefresh={() => void loadAdvice(adviceFilters)}
            onViewAdvice={handleOpenAdvice}
            onCreateTask={handleCreateTaskFromAdvice}
            onAssignStaff={handleAssignAdvice}
            onStartStocktake={handleStartStocktakeAdvice}
            onRequestApproval={handleRequestApprovalFromAdvice}
            onResolve={handleResolveAdvice}
            onDismiss={handleDismissAdvice}
            onEscalate={handleEscalateAdvice}
            onPrintAdvice={handlePrintAdvice}
            onActionMenuOpen={handleAdviceActionMenuOpen}
            canView={canViewAdvice}
          />
        </section>
      )}

      {activeDeskTab === "Risk Output" && (
        <section className="sci-pos-card">
          <div className="bi-section-header">
            <AlertTriangle
              className="bi-section-header-icon"
              size={18}
              aria-hidden="true"
            />
            <div>
              <h2 className="bi-section-header-title">Risk Output</h2>
              <span>
                Current local risk output grouped by operational domain.
              </span>
            </div>
          </div>
          {!canReviewRisk && permissionMessage()}
          {canReviewRisk && (
            <div className="bi-risk-output-grid">
              {ruleDomains.map((domain) => {
                const rows = triggerRows.filter((row) => row.domain === domain);
                return (
                  <article key={domain}>
                    <strong>{domain}</strong>
                    <span>{rows.length} trigger logs</span>
                    <small>
                      {
                        rows.filter(
                          (row) =>
                            row.severity === "Critical" ||
                            row.severity === "High",
                        ).length
                      }{" "}
                      high-risk outputs
                    </small>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {activeDeskTab === "BI Activity" && (
        <section className="sci-pos-card">
          <div className="bi-section-header">
            <Activity
              className="bi-section-header-icon"
              size={18}
              aria-hidden="true"
            />
            <div>
              <h2 className="bi-section-header-title">BI Activity</h2>
              <span>Local UI events and rule review actions.</span>
            </div>
          </div>
          <div className="bi-activity-list">
            {activityFeed.map((feed) => (
              <div key={feed.id}>
                <span>{feed.timestamp}</span>
                <strong>{feed.type}</strong>
                <p>{feed.message}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeDeskTab === "Settings / Thresholds" && (
        <section className="sci-pos-card">
          <div className="bi-section-header">
            <ClipboardCheck
              className="bi-section-header-icon"
              size={18}
              aria-hidden="true"
            />
            <div>
              <h2 className="bi-section-header-title">Settings / Thresholds</h2>
              <span>
                Local threshold visibility only. Rules are not changed in this
                build.
              </span>
            </div>
          </div>
          <div className="bi-risk-output-grid">
            <article>
              <Database size={17} aria-hidden="true" />
              <strong>Rules Engine</strong>
              <span>Deterministic local rules</span>
              <small>No business rule changes applied.</small>
            </article>
            <article>
              <ShieldAlert size={17} aria-hidden="true" />
              <strong>Risk Review</strong>
              <span>{canReviewRisk ? "Allowed" : "Restricted"}</span>
              <small>Permission: bi.riskReview</small>
            </article>
            <article>
              <BookOpen size={17} aria-hidden="true" />
              <strong>Rules Manage</strong>
              <span>{canManageRules ? "Allowed" : "Restricted"}</span>
              <small>Permission: bi.rules.manage</small>
            </article>
            <article>
              <Activity size={17} aria-hidden="true" />
              <strong>BI Export</strong>
              <span>{canExportBi ? "Allowed" : "Restricted"}</span>
              <small>Permission: bi.export</small>
            </article>
          </div>
        </section>
      )}

      <BIAdviceDetailModal
        advice={selectedAdvice}
        activity={adviceActivity}
        shelfAssignment={selectedShelfAssignment}
        onAssign={() =>
          selectedAdvice && void handleAssignAdvice(selectedAdvice)
        }
        onCreateTask={() =>
          selectedAdvice && void handleCreateTaskFromAdvice(selectedAdvice)
        }
        onStartStocktake={() =>
          selectedAdvice && void handleStartStocktakeAdvice(selectedAdvice)
        }
        onResolve={() =>
          selectedAdvice && void handleResolveAdvice(selectedAdvice)
        }
        onDismiss={() =>
          selectedAdvice && void handleDismissAdvice(selectedAdvice)
        }
        onEscalate={() =>
          selectedAdvice && void handleEscalateAdvice(selectedAdvice)
        }
        onClose={() => setSelectedAdvice(null)}
      />
      <BIManagementAdviceDetailModal
        advice={selectedManagementAdvice}
        activity={managementActivity.filter(
          (event) =>
            !selectedManagementAdvice ||
            event.adviceId === selectedManagementAdvice.adviceId,
        )}
        onStart={(advice) =>
          void handleManagementAdviceStatus(advice, "In Progress")
        }
        onResolve={(advice) =>
          void handleManagementAdviceStatus(advice, "Resolved")
        }
        onDismiss={(advice) =>
          void handleManagementAdviceStatus(advice, "Dismissed")
        }
        onEscalate={(advice) =>
          void handleManagementAdviceStatus(advice, "Escalated")
        }
        onPrint={handlePrintManagementAdvice}
        onClose={() => setSelectedManagementAdvice(null)}
      />
      <BIShelfStocktakeAssignmentModal
        assignment={selectedShelfAssignment}
        advice={selectedAdvice}
        onStart={() => void handleShelfStatus("In Progress")}
        onMarkInProgress={() => void handleShelfStatus("In Progress")}
        onMarkCompleted={() => void handleShelfStatus("Completed")}
        onClose={() => setSelectedShelfAssignment(null)}
      />
      <BIAssignAdviceModal
        advice={assignAdviceTarget}
        currentStaffName={staffName}
        onAssign={(payload) => void handleSubmitAdviceAssignment(payload)}
        onCancel={() => setAssignAdviceTarget(null)}
      />
    </div>
  );
}

function ManagementAdviceTable({
  records,
  openMenuId,
  setOpenMenuId,
  onOpen,
  onStart,
  onResolve,
  onDismiss,
  onEscalate,
  onPrint,
}: {
  records: BIManagementAdvice[];
  openMenuId: string;
  setOpenMenuId: (id: string) => void;
  onOpen: (advice: BIManagementAdvice) => void;
  onStart: (advice: BIManagementAdvice) => void;
  onResolve: (advice: BIManagementAdvice) => void;
  onDismiss: (advice: BIManagementAdvice) => void;
  onEscalate: (advice: BIManagementAdvice) => void;
  onPrint: (advice: BIManagementAdvice) => void;
}) {
  return (
    <section className="sci-pos-card bi-management-table-card">
      <div className="bi-section-header">
        <ShieldAlert
          className="bi-section-header-icon"
          size={18}
          aria-hidden="true"
        />
        <div>
          <h2 className="bi-section-header-title">Management Advice</h2>
          <span>
            Rule outputs, routed desks, assigned roles, and action menus.
          </span>
        </div>
      </div>
      <div className="bi-trigger-table-scroll">
        <table className="bi-trigger-table bi-management-table">
          <thead>
            <tr>
              {[
                "Advice No.",
                "Domain",
                "Risk",
                "Narrative",
                "Desk",
                "Role",
                "Due",
                "Status",
                "Action",
              ].map((heading) => (
                <th key={heading}>{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.map((advice) => (
              <tr key={advice.adviceId}>
                <td>{advice.adviceNumber}</td>
                <td>{advice.domain}</td>
                <td>
                  <span
                    className={`bi-risk-badge bi-risk-badge--${advice.riskLevel.toLowerCase()}`}
                  >
                    {advice.riskLevel}
                  </span>
                </td>
                <td>{advice.narrative}</td>
                <td>{advice.assignedDesk}</td>
                <td>{advice.assignedRole}</td>
                <td>{advice.dueDate || "No due date"}</td>
                <td>{advice.status}</td>
                <td className="bi-advice-row-actions">
                  <RowActionMenu
                    rowId={advice.adviceId}
                    ariaLabel={`Actions for ${advice.adviceNumber}`}
                    open={openMenuId === advice.adviceId}
                    onOpenChange={(open) =>
                      setOpenMenuId(open ? advice.adviceId : "")
                    }
                    items={[
                      {
                        id: "open",
                        label: "Open Advice",
                        onClick: () => onOpen(advice),
                      },
                      {
                        id: "start",
                        label: "Create Task / Start",
                        onClick: () => onStart(advice),
                      },
                      {
                        id: "resolve",
                        label: "Resolve",
                        separatorBefore: true,
                        onClick: () => onResolve(advice),
                      },
                      {
                        id: "dismiss",
                        label: "Dismiss",
                        onClick: () => onDismiss(advice),
                      },
                      {
                        id: "escalate",
                        label: "Escalate",
                        danger: true,
                        onClick: () => onEscalate(advice),
                      },
                      {
                        id: "print",
                        label: "Print Advice",
                        separatorBefore: true,
                        onClick: () => onPrint(advice),
                      },
                    ]}
                  />
                </td>
              </tr>
            ))}
            {records.length === 0 && (
              <tr>
                <td colSpan={9} className="sci-pos-empty-cell">
                  No management advice matched your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BIActionPointsPanel({
  points,
  onOpen,
  onUpdate,
}: {
  points: Array<BIManagementActionPoint & { advice: BIManagementAdvice }>;
  onOpen: (advice: BIManagementAdvice) => void;
  onUpdate: (
    point: BIManagementActionPoint,
    status: BIManagementActionStatus,
  ) => void;
}) {
  return (
    <section className="sci-pos-card bi-management-table-card">
      <div className="bi-section-header">
        <ClipboardCheck
          className="bi-section-header-icon"
          size={18}
          aria-hidden="true"
        />
        <div>
          <h2 className="bi-section-header-title">BI Action Points</h2>
          <span>
            Action number, source advice, owner, due date, and local status
            updates.
          </span>
        </div>
      </div>
      <div className="bi-management-action-grid">
        {points.slice(0, 12).map((point) => (
          <article key={point.actionPointId}>
            <strong>{point.label}</strong>
            <span>
              {point.advice.domain} / {point.status}
            </span>
            <p>{point.description}</p>
            <small>
              {point.assignedRole} / {point.assignedDesk} / Due {point.dueDate}
            </small>
            <div>
              <button
                type="button"
                className="sci-pos-button sci-pos-button--secondary"
                onClick={() => onOpen(point.advice)}
              >
                Open
              </button>
              <button
                type="button"
                className="sci-pos-button sci-pos-button--secondary"
                onClick={() => onUpdate(point, "In Progress")}
              >
                Start
              </button>
              <button
                type="button"
                className="sci-pos-button sci-pos-button--primary"
                onClick={() => onUpdate(point, "Resolved")}
              >
                Complete
              </button>
              <button
                type="button"
                className="sci-pos-button sci-pos-button--secondary"
                onClick={() => onUpdate(point, "Escalated")}
              >
                Escalate
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ReorderProtectionPanel({
  rows,
  canOverride,
  onAction,
}: {
  rows: BIReorderBlockWarning[];
  canOverride: boolean;
  onAction: (label: string, row: BIReorderBlockWarning) => void;
}) {
  return (
    <section className="sci-pos-card bi-management-table-card">
      <div className="bi-section-header">
        <Database
          className="bi-section-header-icon"
          size={18}
          aria-hidden="true"
        />
        <div>
          <h2 className="bi-section-header-title">Reorder Protection</h2>
          <span>
            Stagnant stock protection before purchase discipline is broken.
          </span>
        </div>
      </div>
      <div className="bi-trigger-table-scroll">
        <table className="bi-trigger-table">
          <thead>
            <tr>
              {[
                "Product",
                "Qty",
                "Available",
                "Last Movement",
                "Days",
                "BI Decision",
                "Action",
              ].map((heading) => (
                <th key={heading}>{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.warningId}>
                <td>
                  {row.productName}
                  <small>{row.sku}</small>
                </td>
                <td>{row.currentQty}</td>
                <td>{row.availableQty}</td>
                <td>{row.lastMovementDate || "No movement"}</td>
                <td>{row.daysWithoutMovement}</td>
                <td>
                  {row.daysWithoutMovement >= 60
                    ? "block until approval"
                    : row.daysWithoutMovement >= 30
                      ? "review first"
                      : "allow reorder"}
                </td>
                <td>
                  <div className="pos-approval-actions">
                    <button
                      type="button"
                      className="sci-pos-button sci-pos-button--secondary"
                      onClick={() => onAction("Review Stock", row)}
                    >
                      Review Stock
                    </button>
                    <button
                      type="button"
                      className="sci-pos-button sci-pos-button--secondary"
                      onClick={() => onAction("Start Stocktake", row)}
                    >
                      Start Stocktake
                    </button>
                    <button
                      type="button"
                      className="sci-pos-button sci-pos-button--secondary"
                      onClick={() => onAction("Create Purchase Reminder", row)}
                    >
                      Reminder
                    </button>
                    <button
                      type="button"
                      className="sci-pos-button sci-pos-button--secondary"
                      disabled={!canOverride}
                      onClick={() => onAction("Request Manager Approval", row)}
                    >
                      Approval
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ProfitSnapshotPanel({
  snapshot,
  onRefresh,
  onPrint,
  onExport,
}: {
  snapshot: SalesProfitSnapshotPayload;
  onRefresh: () => void;
  onPrint: () => void;
  onExport: () => void;
}) {
  return (
    <section className="sci-pos-card bi-management-subpanel">
      <div className="bi-section-header">
        <DollarSign
          className="bi-section-header-icon"
          size={18}
          aria-hidden="true"
        />
        <div>
          <h2 className="bi-section-header-title">
            Profit and Drawer Snapshot
          </h2>
          <span>
            {snapshot.period} / {snapshot.branchName} / {snapshot.terminalName}
          </span>
        </div>
      </div>
      <div className="bi-management-ledger">
        <div>
          <span>Gross Sales Revenue</span>
          <strong>USD {snapshot.grossSalesRevenue.toFixed(2)}</strong>
        </div>
        <div>
          <span>COGS</span>
          <strong>USD {snapshot.cogs.toFixed(2)}</strong>
        </div>
        <div>
          <span>Gross Profit</span>
          <strong>USD {snapshot.grossProfit.toFixed(2)}</strong>
        </div>
        <div>
          <span>Drawer Expenses</span>
          <strong>USD {snapshot.drawerExpenses.toFixed(2)}</strong>
        </div>
        <div>
          <span>Drawer Net Profit</span>
          <strong>USD {snapshot.netDrawerProfit.toFixed(2)}</strong>
        </div>
      </div>
      <div className="pos-approval-actions">
        <button
          type="button"
          className="sci-pos-button sci-pos-button--secondary"
          onClick={onRefresh}
        >
          Refresh
        </button>
        <button
          type="button"
          className="sci-pos-button sci-pos-button--secondary"
          onClick={onPrint}
        >
          Print
        </button>
        <button
          type="button"
          className="sci-pos-button sci-pos-button--secondary"
          onClick={onExport}
        >
          Export
        </button>
      </div>
    </section>
  );
}

function VatReadinessPanel({
  advice,
  onAction,
}: {
  advice: BIManagementAdvice[];
  onAction: (label: string) => void;
}) {
  const taxWarnings = advice.filter(
    (item) => item.domain === "Tax / VAT Readiness",
  );
  const missingTax = taxWarnings.filter(
    (item) => item.sourceRuleCode === "MISSING_TAX_NUMBER",
  ).length;
  return (
    <section className="sci-pos-card bi-management-subpanel">
      <div className="bi-section-header">
        <FileText
          className="bi-section-header-icon"
          size={18}
          aria-hidden="true"
        />
        <div>
          <h2 className="bi-section-header-title">VAT / Tax Readiness</h2>
          <span>Local readiness output for EOD and finance review.</span>
        </div>
      </div>
      <div className="bi-management-ledger">
        <div>
          <span>VAT Collected</span>
          <strong>USD 184.50</strong>
        </div>
        <div>
          <span>Taxable Sales</span>
          <strong>USD 1,230.00</strong>
        </div>
        <div>
          <span>VAT Exempt Sales</span>
          <strong>USD 95.00</strong>
        </div>
        <div>
          <span>Missing Tax Customers</span>
          <strong>{missingTax}</strong>
        </div>
        <div>
          <span>VAT Mismatch</span>
          <strong>
            {
              taxWarnings.filter(
                (item) => item.sourceRuleCode === "VAT_AMOUNT_INCONSISTENCY",
              ).length
            }
          </strong>
        </div>
        <div>
          <span>EOD VAT Status</span>
          <strong>
            {taxWarnings.length > 0 ? "Review Required" : "Ready"}
          </strong>
        </div>
      </div>
      <div className="pos-approval-actions">
        <button
          type="button"
          className="sci-pos-button sci-pos-button--secondary"
          onClick={() => onAction("Open VAT Summary")}
        >
          Open VAT Summary
        </button>
        <button
          type="button"
          className="sci-pos-button sci-pos-button--secondary"
          onClick={() => onAction("Create VAT Review Task")}
        >
          Create VAT Review Task
        </button>
        <button
          type="button"
          className="sci-pos-button sci-pos-button--primary"
          onClick={() => onAction("Mark Reviewed")}
        >
          Mark Reviewed
        </button>
      </div>
    </section>
  );
}
