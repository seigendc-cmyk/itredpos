import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Check,
  ClipboardCheck,
  Database,
  Filter,
  HelpCircle,
  Radio,
  Search,
  ShieldAlert,
  Sliders
} from 'lucide-react';
import BIAdviceDetailModal from '../components/BIAdviceDetailModal';
import BIAdviceFlowPanel from '../components/BIAdviceFlowPanel';
import BIShelfStocktakeAssignmentModal from '../components/BIShelfStocktakeAssignmentModal';
import {
  assignBIAdvice,
  createBIAdviceActionPoint,
  generateBIAdviceFromTriggerLogs,
  getBIAdviceActivityEvents,
  getBIAdviceRecords,
  getBIShelfStocktakeAssignments,
  resolveBIAdvice,
  dismissBIAdvice,
  escalateBIAdvice,
  updateBIAdviceStatus,
  updateBIShelfStocktakeAssignmentStatus
} from '../services/biAdviceService';
import { routeBIAdviceToDesk } from '../services/biAdviceRoutingService';
import { BiEvent, PosSession, Product, Role, Transaction } from '../types';
import type { BIAdviceActivityEvent, BIAdviceFilterState, BIAdviceRecord, BIShelfStocktakeAssignment } from '../types';
import { mockBIEvents } from '../mock/mockPosData';
import { canPerformAction } from '../utils/posPermissions';
import { matchesFreeOrderSearch } from '../utils/searchUtils';

interface PosBIDeskProps {
  transactions: Transaction[];
  products: Product[];
  biEvents: BiEvent[];
  onLogBiEvent: (
    eventType: BiEvent['eventType'],
    operator: string,
    terminal: string,
    payload: any,
    severity: 'INFO' | 'WARNING' | 'CRITICAL' | 'Low' | 'Medium' | 'High' | 'Critical'
  ) => void;
  session?: PosSession | null;
}

interface BiAlertRow {
  id: string;
  eventType: string;
  domain: BiRuleDomain | 'Approval';
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  trigger: string;
  description: string;
  recommendedAction: string;
  status: 'Open' | 'Pending Approval' | 'Resolved' | 'Completed' | 'Reminder Created' | 'Stocktake Initiated' | 'Followed Up';
  actionLabel: 'Review' | 'Approve' | 'Start Stocktake' | 'Create Task' | 'Follow Up' | 'Done';
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
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ACTION';
}

interface BiRuleDefinition {
  ruleName: string;
  ruleTrigger: string;
  description: string;
  riskLevel: BiAlertRow['severity'];
  recommendedAction: string;
}

type BiDeskTab = 'BI Overview' | 'Ruleset Library' | 'Trigger Logs' | 'BI Advice Flow' | 'Risk Output' | 'BI Activity' | 'Settings / Thresholds';
type BiRuleDomain = 'Anti-Theft' | 'Stock Health' | 'Cash Control' | 'Staff Behaviour' | 'Sales Integrity' | 'Delivery Verification';

const biTabs: BiDeskTab[] = ['BI Overview', 'Ruleset Library', 'Trigger Logs', 'BI Advice Flow', 'Risk Output', 'BI Activity', 'Settings / Thresholds'];
const ruleDomains: BiRuleDomain[] = ['Anti-Theft', 'Stock Health', 'Cash Control', 'Staff Behaviour', 'Sales Integrity', 'Delivery Verification'];

const ruleDescriptions: Record<BiRuleDomain, string> = {
  'Anti-Theft': 'Monitors drawer behavior, suspicious movement, zero-stock attempts, and repeated override patterns.',
  'Stock Health': 'Reviews dead stock, low stock, out-of-stock, fast-moving reorder, variance, and missing shelf signals.',
  'Cash Control': 'Tracks drawer variance, cash-out authorization, unresolved shift variance, and solenoid movement logs.',
  'Staff Behaviour': 'Highlights failed logins, high override frequency, refund patterns, and out-of-branch terminal use.',
  'Sales Integrity': 'Protects checkout pricing, quote overrides, bulk discount patterns, and stock-backed sale validation.',
  'Delivery Verification': 'Reviews delivery completion codes, pending dispatch follow-up, and failed confirmation events.'
};

const rulesMap: Record<BiRuleDomain, BiRuleDefinition[]> = {
  'Anti-Theft': [
    { ruleName: 'Block sale when stock is zero', ruleTrigger: 'SALE_BLOCKED_ZERO_STOCK', description: 'Prevents negative stock indices and manual count overrides on nonexistent parts.', riskLevel: 'Critical', recommendedAction: 'Block sale and require stock review.' },
    { ruleName: 'Flag repeated price overrides', ruleTrigger: 'PRICE_OVERRIDE_REQUESTED', description: 'Logs cashier accounts attempting over 3 manual price updates in a single hour.', riskLevel: 'High', recommendedAction: 'Supervisor price override review.' },
    { ruleName: 'Flag suspicious stock adjustments', ruleTrigger: 'STOCK_ADJUSTMENT_REQUESTED', description: 'Triggers audit requirements when items are adjusted without a valid reference invoice.', riskLevel: 'High', recommendedAction: 'Require supervisor approval.' },
    { ruleName: 'Flag cash drawer variance', ruleTrigger: 'CASH_VARIANCE_FOUND', description: 'Logs a warning if declared terminal float is beyond the local tolerance.', riskLevel: 'High', recommendedAction: 'Supervisor drawer recount.' },
    { ruleName: 'Flag repeated failed staff logins', ruleTrigger: 'FAILED_TERMINAL_LOGIN', description: 'Alerts security if staff credentials fail repeatedly in a short period.', riskLevel: 'High', recommendedAction: 'Verify staff identity and terminal use.' }
  ],
  'Stock Health': [
    { ruleName: 'Low stock reminder', ruleTrigger: 'LOW_STOCK_REMINDER', description: 'Triggers system notice when inventory item falls below safety stock margins.', riskLevel: 'Medium', recommendedAction: 'Create purchase reminder.' },
    { ruleName: 'Out of stock alert', ruleTrigger: 'OUT_OF_STOCK_ALERT', description: 'Logs critical alarm when high-velocity parts fall to zero.', riskLevel: 'Critical', recommendedAction: 'Reorder or stock review.' },
    { ruleName: 'Dead stock warning', ruleTrigger: 'DEAD_STOCK_WARNING', description: 'Identifies inventory sitting over 90 days with zero sales.', riskLevel: 'Medium', recommendedAction: 'Discount or clearance review.' },
    { ruleName: 'Slow moving item warning', ruleTrigger: 'SLOW_MOVING_STOCK_WARNING', description: 'Logs notification for parts with extended turnover cycles.', riskLevel: 'Low', recommendedAction: 'Review price and demand.' },
    { ruleName: 'Variance risk warning', ruleTrigger: 'VARIANCE_RISK_FOUND', description: 'Signals risk when warehouse counts deviate from theoretical receipt balances.', riskLevel: 'Critical', recommendedAction: 'Stocktake required.' },
    { ruleName: 'Recommend major stocktake', ruleTrigger: 'RECOMMEND_MAJOR_STOCKTAKE', description: 'Assembles stocktake instructions when audit counts flag repeated negative records.', riskLevel: 'High', recommendedAction: 'Schedule major stocktake.' }
  ],
  'Cash Control': [
    { ruleName: 'Variance requires supervisor review', ruleTrigger: 'CASH_VARIANCE_FOUND', description: 'Blocks cashiers from closing shift with unresolved drawer variance.', riskLevel: 'High', recommendedAction: 'Supervisor review before shift closure.' },
    { ruleName: 'Cash out requires authorization', ruleTrigger: 'CASH_OUT_AUTH_REQUIRED', description: 'Forces second operator verification for payout or banking drop.', riskLevel: 'Medium', recommendedAction: 'Authorize payout locally.' },
    { ruleName: 'Shift cannot close with unresolved variance', ruleTrigger: 'SHIFT_CLOSE_BLOCKED', description: 'Restricts terminal unlock functions until supervisor logs override keys.', riskLevel: 'High', recommendedAction: 'Resolve cash variance.' },
    { ruleName: 'Drawer movement must be logged', ruleTrigger: 'DRAWER_OPENED_MANUALLY', description: 'Records every mechanical solenoid open and links to a terminal event.', riskLevel: 'Medium', recommendedAction: 'Review drawer event trail.' }
  ],
  'Staff Behaviour': [
    { ruleName: 'Failed login monitoring', ruleTrigger: 'FAILED_TERMINAL_LOGIN', description: 'Performs lockouts and registers warning logs for repeated failed access.', riskLevel: 'High', recommendedAction: 'Verify staff identity.' },
    { ruleName: 'High override frequency', ruleTrigger: 'PRICE_OVERRIDE_REQUESTED', description: 'Identifies clerks whose override ratio exceeds local supervisor limits.', riskLevel: 'High', recommendedAction: 'Review cashier override pattern.' },
    { ruleName: 'Frequent void/refund requests', ruleTrigger: 'VOID_REFUND_PATTERN', description: 'Highlights clerks showing an outlying rate of voided tickets post-print.', riskLevel: 'Medium', recommendedAction: 'Review sales history.' },
    { ruleName: 'Terminal activity outside assigned branch', ruleTrigger: 'OUT_OF_BRANCH_TERMINAL_USE', description: 'Signals incorrect branch logins immediately.', riskLevel: 'High', recommendedAction: 'Lock session pending review.' }
  ],
  'Sales Integrity': [
    { ruleName: 'Block sale when stock is zero', ruleTrigger: 'SALE_BLOCKED_ZERO_STOCK', description: 'Maintains catalog integrity and prevents arbitrary checkout of unavailable parts.', riskLevel: 'Critical', recommendedAction: 'Block sale and recount shelf.' },
    { ruleName: 'Flag price deviations', ruleTrigger: 'PRICE_OVERRIDE_REQUESTED', description: 'Identifies margin leakage by monitoring products sold below distributor cost.', riskLevel: 'High', recommendedAction: 'Manager approval required.' },
    { ruleName: 'Mandate supervisor PIN for custom quotes', ruleTrigger: 'CUSTOM_QUOTE_OVERRIDE', description: 'Demands double signature keys for manual invoice prices.', riskLevel: 'Medium', recommendedAction: 'Supervisor PIN approval.' },
    { ruleName: 'Flag frequent bulk discounts', ruleTrigger: 'BULK_DISCOUNT_PATTERN', description: 'Identifies large commercial orders processed without account registration.', riskLevel: 'Medium', recommendedAction: 'Create account review task.' }
  ],
  'Delivery Verification': [
    { ruleName: 'Delivery completion requires customer secret code', ruleTrigger: 'DELIVERY_CODE_REQUIRED', description: 'Enforces six-digit confirmation code entry at dispatch completion.', riskLevel: 'High', recommendedAction: 'Require customer code.' },
    { ruleName: 'Pending delivery code must be followed up', ruleTrigger: 'DELIVERY_CODE_PENDING', description: 'Generates warnings if dispatches are in transit beyond local threshold.', riskLevel: 'Medium', recommendedAction: 'Follow up with driver/customer.' },
    { ruleName: 'Failed delivery confirmation is flagged', ruleTrigger: 'DELIVERY_CONFIRMATION_FAILED', description: 'Alerts depot manager if customer rejects parts or code fails to authorize.', riskLevel: 'High', recommendedAction: 'Review delivery proof.' }
  ]
};

const STOCK_HEALTH_EVENT_TYPES = new Set([
  'DEAD_STOCK_WARNING',
  'LOW_STOCK_REMINDER',
  'VARIANCE_RISK_FOUND',
  'NEGATIVE_STOCK_ALERT',
  'FAST_MOVING_REORDER_RECOMMENDED',
  'OUT_OF_STOCK_ALERT',
  'SLOW_MOVING_STOCK_WARNING',
  'MISSING_SHELF_LOCATION',
  'STOCK_HEALTH_EVALUATED'
]);

function mapSeverity(value: BiEvent['severity']): BiAlertRow['severity'] {
  if (value === 'Critical' || value === 'CRITICAL') return 'Critical';
  if (value === 'High') return 'High';
  if (value === 'Medium' || value === 'WARNING') return 'Medium';
  return 'Low';
}

function mapBiEventToAlertRow(event: BiEvent): BiAlertRow {
  let domain: BiAlertRow['domain'] = 'Anti-Theft';
  let trigger = 'Pattern flag activated';
  let recommendedAction = 'Investigate operator logs';
  let actionLabel: BiAlertRow['actionLabel'] = 'Review';

  if (event.eventType === 'CASH_VARIANCE_FOUND') {
    domain = 'Cash Control';
    trigger = 'Declared cash does not match expected cash';
    recommendedAction = 'Supervisor review before shift closure';
  } else if (event.eventType === 'SALE_BLOCKED_ZERO_STOCK') {
    domain = 'Stock Health';
    trigger = 'Product quantity is zero';
    recommendedAction = 'Block sale and require stock review';
  } else if (event.eventType === 'PRICE_OVERRIDE_REQUESTED') {
    domain = 'Sales Integrity';
    trigger = 'Discount above allowed cashier threshold';
    recommendedAction = 'Manager approval required';
    actionLabel = 'Approve';
  } else if (event.eventType === 'FAILED_TERMINAL_LOGIN') {
    domain = 'Staff Behaviour';
    trigger = 'Multiple failed access attempts';
    recommendedAction = 'Verify staff identity and terminal use';
  } else if (event.eventType === 'STOCK_ADJUSTMENT_REQUESTED') {
    domain = 'Stock Health';
    trigger = 'Manual adjustment requested';
    recommendedAction = 'Require supervisor approval';
    actionLabel = 'Approve';
  } else if (event.eventType === 'DELIVERY_CODE_PENDING') {
    domain = 'Delivery Verification';
    trigger = 'Verification code not entered';
    recommendedAction = 'Verify dispatch with customer';
    actionLabel = 'Follow Up';
  } else if (event.eventType === 'SUSPICIOUS_MOVEMENT_ALERT') {
    domain = 'Anti-Theft';
    trigger = 'Drawer opened manually';
    recommendedAction = 'Check security footage near register';
  } else if (event.eventType === 'RECOMMEND_MAJOR_STOCKTAKE') {
    domain = 'Stock Health';
    trigger = 'Variance risk increasing';
    recommendedAction = 'Schedule major stocktake';
    actionLabel = 'Start Stocktake';
  } else if (STOCK_HEALTH_EVENT_TYPES.has(event.eventType)) {
    domain = 'Stock Health';
    trigger = 'Stock health rule evaluated';
    recommendedAction = 'Review stock position';
  }

  return {
    id: event.id,
    eventType: event.eventType,
    domain,
    severity: mapSeverity(event.severity),
    trigger,
    description: event.payload?.productName || event.payload?.details || event.payload?.message || 'Rule activation logged',
    recommendedAction,
    status: 'Open',
    actionLabel,
    productName: event.payload?.productName,
    sku: event.payload?.sku,
    staffName: event.operator,
    branchName: event.payload?.branchName,
    terminalName: event.terminal,
    eventMessage: event.payload?.details || event.payload?.message,
    notes: event.payload?.notes || event.payload?.reason
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

function mapProductToTriggerRow(product: Product, branchName: string, terminalName: string): BiAlertRow | null {
  const stock = productStock(product);
  const status = product.stockStatus || product.healthStatus;
  const name = productName(product);
  const sku = productSku(product);

  if (stock <= 0) {
    return {
      id: `BI-PROD-OUT-${product.id}`,
      eventType: 'OUT_OF_STOCK_ALERT',
      domain: 'Stock Health',
      severity: 'Critical',
      trigger: 'Product quantity is zero',
      description: `${name} is out of stock.`,
      recommendedAction: 'Reorder / stock review',
      status: 'Open',
      actionLabel: 'Review',
      productName: name,
      sku,
      branchName,
      terminalName,
      eventMessage: `${name} stock is zero.`,
      notes: status || 'Out of stock local trigger',
      localDerived: true
    };
  }

  if (status === 'Variance Risk' || product.riskLevel === 'Critical' || product.riskLevel === 'High') {
    return {
      id: `BI-PROD-VAR-${product.id}`,
      eventType: 'VARIANCE_RISK_FOUND',
      domain: 'Stock Health',
      severity: product.riskLevel === 'Critical' ? 'Critical' : 'High',
      trigger: 'Stocktake or adjustment movement in last 30 days',
      description: `${name} variance risk requires review.`,
      recommendedAction: 'Stocktake required',
      status: 'Open',
      actionLabel: 'Start Stocktake',
      productName: name,
      sku,
      branchName,
      terminalName,
      eventMessage: `${sku} variance risk found.`,
      notes: status || product.riskLevel || 'Variance risk local trigger',
      localDerived: true
    };
  }

  if (stock <= product.minStock) {
    return {
      id: `BI-PROD-REORDER-${product.id}`,
      eventType: status === 'Fast Moving' ? 'FAST_MOVING_REORDER_RECOMMENDED' : 'LOW_STOCK_REMINDER',
      domain: 'Stock Health',
      severity: status === 'Fast Moving' ? 'High' : 'Medium',
      trigger: status === 'Fast Moving' ? 'Multiple sale movements in last 7 days' : 'Quantity on hand at or below reorder level',
      description: `${name} is at or below reorder level.`,
      recommendedAction: status === 'Fast Moving' ? 'Reorder fast-moving item' : 'Create purchase reminder',
      status: 'Open',
      actionLabel: 'Create Task',
      productName: name,
      sku,
      branchName,
      terminalName,
      eventMessage: `${sku} reorder trigger generated locally.`,
      notes: status || 'Low stock local trigger',
      localDerived: true
    };
  }

  return null;
}

function riskBadgeClass(severity: BiAlertRow['severity']): string {
  if (severity === 'Critical') return 'bi-risk-badge bi-risk-badge--critical';
  if (severity === 'High') return 'bi-risk-badge bi-risk-badge--high';
  if (severity === 'Medium') return 'bi-risk-badge bi-risk-badge--medium';
  return 'bi-risk-badge bi-risk-badge--low';
}

function triggerActionText(row: BiAlertRow): string {
  if (row.actionLabel === 'Start Stocktake') return 'Start Stocktake';
  if (row.actionLabel === 'Create Task') return row.eventType.includes('LOW_STOCK') ? 'Create Reminder' : 'Create Task';
  if (row.actionLabel === 'Approve') return 'Open Advice';
  if (row.domain === 'Stock Health') return 'Review Stock';
  if (row.domain === 'Staff Behaviour') return 'Assign Staff';
  return 'Open Advice';
}

function permissionMessage(): JSX.Element {
  return <div className="sci-pos-alert sci-pos-alert--danger">You do not have permission to view this BI section.</div>;
}

export default function PosBIDesk({
  transactions,
  products,
  biEvents,
  onLogBiEvent,
  session
}: PosBIDeskProps) {
  const vendorName = session?.vendor || 'SCI Logistics Ltd';
  const branchName = session?.branch || 'Harare Main';
  const terminalName = session?.terminal || 'Term-A';
  const staffName = session?.staffName || 'Admin User';
  const roleName = (session?.role || 'Owner') as Role;

  const [activeDeskTab, setActiveDeskTab] = useState<BiDeskTab>('BI Overview');
  const [selectedDomain, setSelectedDomain] = useState<BiRuleDomain>('Anti-Theft');
  const [rulesetSearch, setRulesetSearch] = useState('');
  const [triggerSearch, setTriggerSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [domainFilter, setDomainFilter] = useState('ALL');
  const [adviceFilters, setAdviceFilters] = useState<BIAdviceFilterState>({});
  const [adviceRecords, setAdviceRecords] = useState<BIAdviceRecord[]>([]);
  const [adviceActivity, setAdviceActivity] = useState<BIAdviceActivityEvent[]>([]);
  const [shelfAssignments, setShelfAssignments] = useState<BIShelfStocktakeAssignment[]>([]);
  const [selectedAdvice, setSelectedAdvice] = useState<BIAdviceRecord | null>(null);
  const [selectedShelfAssignment, setSelectedShelfAssignment] = useState<BIShelfStocktakeAssignment | null>(null);
  const [activityFeed, setActivityFeed] = useState<ActivityLogItem[]>([
    { id: 'BIA-1', timestamp: '16:05:22', message: 'Rule evaluated: SALE_BLOCKED_ZERO_STOCK (Gate: Blocked transaction output)', type: 'INFO' },
    { id: 'BIA-2', timestamp: '15:45:11', message: 'Supervisor review opened for cash variance: USD -5.00 on register 01', type: 'WARNING' },
    { id: 'BIA-3', timestamp: '14:30:15', message: 'Price override approved by mock manager: Radiator discount authorized at 15%', type: 'SUCCESS' },
    { id: 'BIA-4', timestamp: '13:10:05', message: 'Major stocktake recommendation created for low velocity category Motor Spares', type: 'ACTION' },
    { id: 'BIA-5', timestamp: '11:32:00', message: 'Delivery code follow-up assigned to supervisor: Ref GD6 Pending verification code', type: 'ACTION' }
  ]);
  const [alertsTable, setAlertsTable] = useState<BiAlertRow[]>(() => mockBIEvents.map(mapBiEventToAlertRow));

  const hasBiView = canPerformAction(roleName, 'bi.view');
  const canReviewRisk = canPerformAction(roleName, 'bi.riskReview') || canPerformAction(roleName, 'bi.review');
  const canManageRules = canPerformAction(roleName, 'bi.rules.manage');
  const canExportBi = canPerformAction(roleName, 'bi.export') || canPerformAction(roleName, 'reports.export');
  const canViewAdvice = canPerformAction(roleName, 'bi.advice.view');
  const canAssignAdvice = canPerformAction(roleName, 'bi.advice.assign');
  const canResolveAdvice = canPerformAction(roleName, 'bi.advice.resolve');
  const canDismissAdvice = canPerformAction(roleName, 'bi.advice.dismiss');
  const canEscalateAdvice = canPerformAction(roleName, 'bi.advice.escalate');
  const canCreateAdviceTask = canPerformAction(roleName, 'bi.advice.createTask');
  const productTriggerRows = useMemo(
    () => products.map((product) => mapProductToTriggerRow(product, branchName, terminalName)).filter((row): row is BiAlertRow => Boolean(row)),
    [branchName, products, terminalName]
  );
  const triggerRows = useMemo(() => {
    const existingIds = new Set(alertsTable.map((row) => row.id));
    return [...alertsTable, ...productTriggerRows.filter((row) => !existingIds.has(row.id))];
  }, [alertsTable, productTriggerRows]);

  const addActivity = (message: string, type: ActivityLogItem['type'] = 'INFO') => {
    const timestamp = new Date().toTimeString().split(' ')[0];
    setActivityFeed((current) => [{ id: `BIA-${Date.now()}`, timestamp, message, type }, ...current].slice(0, 30));
  };

  useEffect(() => {
    const stockHealthEvents = biEvents.filter((event) => STOCK_HEALTH_EVENT_TYPES.has(event.eventType));
    if (stockHealthEvents.length === 0) return;
    setAlertsTable((current) => {
      const existingIds = new Set(current.map((row) => row.id));
      const newRows = stockHealthEvents.filter((event) => !existingIds.has(event.id)).map(mapBiEventToAlertRow);
      return newRows.length > 0 ? [...newRows, ...current] : current;
    });
  }, [biEvents]);

  const loadAdvice = async (filters: BIAdviceFilterState = adviceFilters) => {
    const [records, activity, assignments] = await Promise.all([
      getBIAdviceRecords(filters),
      getBIAdviceActivityEvents(),
      getBIShelfStocktakeAssignments()
    ]);
    setAdviceRecords(records);
    setAdviceActivity(activity);
    setShelfAssignments(assignments);
  };

  useEffect(() => {
    void loadAdvice(adviceFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adviceFilters]);

  const openTab = (tab: BiDeskTab) => {
    setActiveDeskTab(tab);
    const eventType = tab === 'Ruleset Library' ? 'BI_RULESET_LIBRARY_OPENED'
      : tab === 'Trigger Logs' ? 'BI_TRIGGER_LOGS_OPENED'
        : 'BI_TAB_OPENED';
    addActivity(`${eventType}: ${tab}`, 'INFO');
  };

  const selectDomain = (domain: BiRuleDomain) => {
    setSelectedDomain(domain);
    addActivity(`BI_RULESET_DOMAIN_SELECTED: ${domain}`, 'ACTION');
  };

  const handleAlertAction = (rowId: string, actionType: BiAlertRow['actionLabel']) => {
    if (!canReviewRisk) {
      addActivity('Risk review blocked by permission.', 'WARNING');
      return;
    }
    const triggerRow = triggerRows.find((row) => row.id === rowId);
    if (triggerRow?.localDerived) {
      addActivity(`BI_RULESET_OUTPUT_VIEWED: ${actionType} noted for local product trigger ${triggerRow.productName || triggerRow.eventType}.`, 'ACTION');
      onLogBiEvent('BI_RISK_ACTION_RECORDED' as BiEvent['eventType'], staffName, terminalName, { rowId, actionType, localDerived: true }, 'INFO');
      return;
    }
    setAlertsTable((current) => current.map((row) => {
      if (row.id !== rowId) return row;
      let nextStatus: BiAlertRow['status'] = 'Resolved';
      if (actionType === 'Approve') nextStatus = 'Completed';
      if (actionType === 'Start Stocktake') nextStatus = 'Stocktake Initiated';
      if (actionType === 'Create Task') nextStatus = 'Reminder Created';
      if (actionType === 'Follow Up') nextStatus = 'Followed Up';
      addActivity(`User triggered [${actionType}] on ${row.eventType}: ${row.description.slice(0, 45)}... status updated to [${nextStatus}]`, actionType === 'Approve' ? 'SUCCESS' : 'ACTION');
      onLogBiEvent('BI_RISK_ACTION_RECORDED' as BiEvent['eventType'], staffName, terminalName, { rowId, actionType, nextStatus }, 'INFO');
      return { ...row, status: nextStatus, actionLabel: 'Done' };
    }));
  };

  const handleGenerateAdvice = async () => {
    if (!canViewAdvice) {
      addActivity('BI advice generation blocked by permission.', 'WARNING');
      return;
    }
    const generated = await generateBIAdviceFromTriggerLogs(triggerRows, products);
    await Promise.all(generated.map(routeBIAdviceToDesk));
    addActivity(`BI_ADVICE_GENERATED: ${generated.length} advice record(s) prepared from trigger logs.`, 'SUCCESS');
    await loadAdvice(adviceFilters);
  };

  const handleOpenAdvice = async (advice: BIAdviceRecord) => {
    setSelectedAdvice(advice);
    const assignment = shelfAssignments.find((item) => item.createdFromBIAdviceId === advice.adviceId) || null;
    setSelectedShelfAssignment(assignment);
    setAdviceActivity(await getBIAdviceActivityEvents({ adviceId: advice.adviceId }));
  };

  const handleCreateTaskFromAdvice = async (advice: BIAdviceRecord) => {
    if (!canCreateAdviceTask) {
      addActivity('Create Task from BI advice blocked by permission.', 'WARNING');
      return;
    }
    await createBIAdviceActionPoint({
      adviceId: advice.adviceId,
      actionType: 'Create Task',
      label: 'Create Task',
      description: `Local task placeholder created from ${advice.adviceNumber}.`,
      assignedToRole: advice.assignedToRole,
      dueDate: advice.dueDate
    });
    addActivity(`BI_TASK_CREATED_FROM_ADVICE: ${advice.adviceNumber} task placeholder created.`, 'ACTION');
    await loadAdvice(adviceFilters);
  };

  const handleAssignAdvice = async (advice: BIAdviceRecord) => {
    if (!canAssignAdvice) {
      addActivity('BI advice assignment blocked by permission.', 'WARNING');
      return;
    }
    const assigned = await assignBIAdvice(advice.adviceId, {
      assignedToStaffName: advice.assignedToStaffName || staffName,
      assignedToStaffId: advice.assignedToStaffId || staffName.toUpperCase().replace(/[^A-Z0-9]+/g, '-'),
      assignedToRole: advice.assignedToRole || 'Manager',
      assignedDesk: advice.assignedDesk || 'BI Desk',
      dueDate: advice.dueDate || new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      note: 'Assigned locally from BI Advice Flow.'
    });
    if (assigned) await routeBIAdviceToDesk(assigned);
    addActivity(`BI_ADVICE_ASSIGNED: ${advice.adviceNumber} assigned.`, 'ACTION');
    await loadAdvice(adviceFilters);
  };

  const handleStartStocktakeAdvice = async (advice: BIAdviceRecord) => {
    const assignment = shelfAssignments.find((item) => item.createdFromBIAdviceId === advice.adviceId) || null;
    if (assignment) {
      setSelectedShelfAssignment(assignment);
      setSelectedAdvice(advice);
      return;
    }
    await createBIAdviceActionPoint({
      adviceId: advice.adviceId,
      actionType: 'Start Stocktake',
      label: 'Start Stocktake',
      description: 'Stocktake session prepared for this shelf.',
      assignedToRole: advice.assignedToRole || 'Stock Controller',
      dueDate: advice.dueDate
    });
    addActivity(`BI_ACTION_POINT_CREATED: Stocktake session prepared for ${advice.adviceNumber}.`, 'ACTION');
    await loadAdvice(adviceFilters);
  };

  const handleResolveAdvice = async (advice: BIAdviceRecord) => {
    if (!canResolveAdvice) {
      addActivity('BI advice resolve blocked by permission.', 'WARNING');
      return;
    }
    await resolveBIAdvice(advice.adviceId, staffName, 'Resolved locally from BI Advice Flow.');
    addActivity(`BI_ADVICE_RESOLVED: ${advice.adviceNumber}.`, 'SUCCESS');
    await loadAdvice(adviceFilters);
  };

  const handleDismissAdvice = async (advice: BIAdviceRecord) => {
    if (!canDismissAdvice) {
      addActivity('BI advice dismiss blocked by permission.', 'WARNING');
      return;
    }
    await dismissBIAdvice(advice.adviceId, staffName, 'Dismissed locally after review.');
    addActivity(`BI_ADVICE_DISMISSED: ${advice.adviceNumber}.`, 'INFO');
    await loadAdvice(adviceFilters);
  };

  const handleEscalateAdvice = async (advice: BIAdviceRecord) => {
    if (!canEscalateAdvice) {
      addActivity('BI advice escalation blocked by permission.', 'WARNING');
      return;
    }
    const escalated = await escalateBIAdvice(advice.adviceId, staffName, 'Escalated to Owner for deterministic rule review.');
    if (escalated) await routeBIAdviceToDesk({ ...escalated, assignedDesk: 'Owner Desk', assignedToRole: 'Owner' });
    addActivity(`BI_ADVICE_ESCALATED: ${advice.adviceNumber}.`, 'WARNING');
    await loadAdvice(adviceFilters);
  };

  const handleShelfStatus = async (status: BIShelfStocktakeAssignment['status']) => {
    if (!selectedShelfAssignment) return;
    await updateBIShelfStocktakeAssignmentStatus(selectedShelfAssignment.assignmentId, status);
    if (selectedAdvice) await updateBIAdviceStatus(selectedAdvice.adviceId, status === 'Completed' ? 'Resolved' : 'In Progress', staffName, `Shelf stocktake ${status}.`);
    addActivity(`BI_SHELF_STOCKTAKE_ASSIGNED: ${selectedShelfAssignment.shelfLocation} marked ${status}.`, 'ACTION');
    setSelectedShelfAssignment(null);
    await loadAdvice(adviceFilters);
  };

  const domainRules = rulesMap[selectedDomain];
  const filteredRules = domainRules.filter((rule) => matchesFreeOrderSearch(
    { domain: selectedDomain, ...rule },
    rulesetSearch,
    ['domain', 'ruleName', 'ruleTrigger', 'description', 'riskLevel', 'recommendedAction']
  ));

  const filteredAlerts = triggerRows.filter((row) => {
    const matchesSearch = matchesFreeOrderSearch(row, triggerSearch, [
      'eventType',
      'domain',
      'severity',
      'trigger',
      'description',
      'recommendedAction',
      'productName',
      'sku',
      'staffName',
      'branchName',
      'terminalName',
      'eventMessage',
      'notes',
      (item) => item.status,
      () => branchName,
      () => terminalName
    ]);
    const matchesSeverity = severityFilter === 'ALL' || row.severity === severityFilter;
    const matchesDomain = domainFilter === 'ALL' || row.domain === domainFilter;
    return matchesSearch && matchesSeverity && matchesDomain;
  });

  const metrics = useMemo(() => {
    const critical = triggerRows.filter((row) => row.severity === 'Critical' && row.status === 'Open').length;
    const high = triggerRows.filter((row) => row.severity === 'High' && row.status === 'Open').length;
    const medium = triggerRows.filter((row) => row.severity === 'Medium' && row.status === 'Open').length;
    return {
      critical,
      high,
      medium,
      staff: triggerRows.filter((row) => row.domain === 'Staff Behaviour').length,
      stock: triggerRows.filter((row) => row.domain === 'Stock Health').length,
      cash: triggerRows.filter((row) => row.domain === 'Cash Control').length,
      spotChecks: products.filter((product) => product.stock <= product.minStock).length,
      reviews: triggerRows.filter((row) => row.status === 'Open' || row.status === 'Pending Approval').length
    };
  }, [products, triggerRows]);

  const severityMix = useMemo(() => {
    const rules = rulesMap[selectedDomain];
    return ['Critical', 'High', 'Medium', 'Low'].map((severity) => `${severity}: ${rules.filter((rule) => rule.riskLevel === severity).length}`).join(' / ');
  }, [selectedDomain]);

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
          <h1><Sliders size={20} aria-hidden="true" /> Rule-Based POS Intelligence Desk</h1>
          <p>{vendorName} / {branchName} / {terminalName} / Build Development Rules</p>
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
          <button key={tab} type="button" className={`bi-tab ${activeDeskTab === tab ? 'bi-tab-active' : ''}`} onClick={() => openTab(tab)}>
            {tab}
          </button>
        ))}
      </nav>

      {activeDeskTab === 'BI Overview' && (
        <section className="bi-overview-grid">
          {[
            ['Critical Alerts', metrics.critical, 'high hazard locks'],
            ['High Risk Alerts', metrics.high, 'require supervisor review'],
            ['Medium Alerts', metrics.medium, 'general audit anomalies'],
            ['Staff Risk Flags', metrics.staff, 'credential/override anomalies'],
            ['Stock Risk Flags', metrics.stock, 'shrinkage/out of stock'],
            ['Cash Risk Flags', metrics.cash, 'drawer drift counts'],
            ['Spot Checks', metrics.spotChecks, 'bin recount tasks'],
            ['Pending Reviews', metrics.reviews, 'supervisor ledger signs']
          ].map(([label, value, help]) => (
            <article key={label} className="bi-metric-card">
              <span>{label}</span>
              <strong>{value}</strong>
              <small>{help}</small>
            </article>
          ))}

          <article className="sci-pos-card bi-overview-panel">
            <div className="bi-section-header">
              <HelpCircle className="bi-section-header-icon" size={18} aria-hidden="true" />
              <div>
                <h2 className="bi-section-header-title">Deterministic Logic</h2>
                <span>Rule-Based BI evaluation</span>
              </div>
            </div>
            <div className="bi-text-panel">
              <p>The BI Desk evaluates POS logs against strict corporate rulesets rather than statistical models or unverified blackbox calculations.</p>
              <p><strong>Risk Assessment:</strong> Scans local triggers for cash declarations, stock levels, terminal overrides, and delivery codes.</p>
              <p><strong>Current Scan:</strong> {transactions.length} transaction rows, {products.length} product rows, {triggerRows.length} trigger logs.</p>
            </div>
          </article>
        </section>
      )}

      {activeDeskTab === 'Ruleset Library' && (
        <section className="sci-pos-card">
          <div className="bi-section-header">
            <BookOpen className="bi-section-header-icon" size={18} aria-hidden="true" />
            <div>
              <h2 className="bi-section-header-title">Ruleset Library</h2>
              <span>Active rules, rule descriptions, severity mix, and output preview.</span>
            </div>
          </div>
          {!canReviewRisk && permissionMessage()}
          {canReviewRisk && (
            <div className="bi-ruleset-layout">
              <aside className="bi-ruleset-list">
                <label className="bi-trigger-searchbar">
                  <Search size={15} aria-hidden="true" />
                  <input value={rulesetSearch} onChange={(event) => { setRulesetSearch(event.target.value); addActivity('BI_RULESET_OUTPUT_VIEWED: ruleset search updated', 'INFO'); }} placeholder="Search rules in any word order" />
                </label>
                {ruleDomains.map((domain) => (
                  <button key={domain} type="button" className={selectedDomain === domain ? 'active' : ''} onClick={() => selectDomain(domain)}>
                    <strong>{domain}</strong>
                    <span>{rulesMap[domain].length} active rules</span>
                  </button>
                ))}
              </aside>
              <div className="bi-ruleset-output">
                <div className="bi-ruleset-summary">
                  <div><span>Domain</span><strong>{selectedDomain}</strong></div>
                  <div><span>Active Rule Count</span><strong>{filteredRules.length} / {domainRules.length}</strong></div>
                  <div><span>Severity Mix</span><strong>{severityMix}</strong></div>
                  <div><span>Rules Management</span><strong>{canManageRules ? 'Allowed' : 'View only'}</strong></div>
                </div>
                <p>{ruleDescriptions[selectedDomain]}</p>
                <div className="bi-ruleset-rules">
                  {filteredRules.map((rule) => (
                    <article key={rule.ruleName}>
                      <span className={riskBadgeClass(rule.riskLevel)}>{rule.riskLevel}</span>
                      <strong>{rule.ruleName}</strong>
                      <small>{rule.ruleTrigger}</small>
                      <p>{rule.description}</p>
                      <b>{rule.recommendedAction}</b>
                    </article>
                  ))}
                  {filteredRules.length === 0 && <div className="sci-pos-empty-cell">No rules matched your search.</div>}
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {activeDeskTab === 'Trigger Logs' && (
        <section className="sci-pos-card bi-trigger-card">
          <div className="bi-section-header">
            <ShieldAlert className="bi-section-header-icon" size={18} aria-hidden="true" />
            <div>
              <h2 className="bi-section-header-title">Trigger Logs</h2>
              <span>Search BI rule triggers, incident descriptions, risk levels, and recommended resolve paths.</span>
            </div>
          </div>
          <div className="bi-trigger-searchbar">
            <Search size={15} aria-hidden="true" />
            <input value={triggerSearch} onChange={(event) => { setTriggerSearch(event.target.value); addActivity('BI_TRIGGER_SEARCH_APPLIED: trigger search updated', 'INFO'); }} placeholder="Search trigger logs in any word order" />
            <Filter size={15} aria-hidden="true" />
            <select value={severityFilter} onChange={(event) => { setSeverityFilter(event.target.value); addActivity(`BI_TRIGGER_FILTER_APPLIED: severity ${event.target.value}`, 'INFO'); }}>
              <option value="ALL">All Severities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
            <select value={domainFilter} onChange={(event) => { setDomainFilter(event.target.value); addActivity(`BI_TRIGGER_FILTER_APPLIED: domain ${event.target.value}`, 'INFO'); }}>
              <option value="ALL">All Domains</option>
              {ruleDomains.map((domain) => <option key={domain} value={domain}>{domain}</option>)}
            </select>
            <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => { setTriggerSearch(''); setSeverityFilter('ALL'); setDomainFilter('ALL'); }}>
              Reset Filters
            </button>
          </div>
          <div className="bi-trigger-result-count">{filteredAlerts.length} trigger logs found</div>
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
                  const isDone = row.status !== 'Open' && row.status !== 'Pending Approval';
                  return (
                    <tr key={row.id}>
                      <td>{row.eventType}</td>
                      <td>{row.domain}</td>
                      <td><span className={riskBadgeClass(row.severity)}>{row.severity}</span></td>
                      <td>{row.trigger}</td>
                      <td>{row.description}</td>
                      <td>{row.recommendedAction}</td>
                      <td>{row.status}</td>
                      <td>
                        {isDone ? (
                          <span className="bi-done-label"><Check size={13} aria-hidden="true" /> Done</span>
                        ) : (
                          <button type="button" className="bi-log-action-button" onClick={() => handleAlertAction(row.id, row.actionLabel)} title={triggerActionText(row)} aria-label={triggerActionText(row)}>
                            {triggerActionText(row)}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredAlerts.length === 0 && (
                  <tr>
                    <td colSpan={8} className="sci-pos-empty-cell">No trigger logs matched your search.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeDeskTab === 'BI Advice Flow' && (
        <section className="sci-pos-card">
          <div className="bi-section-header">
            <BookOpen className="bi-section-header-icon" size={18} aria-hidden="true" />
            <div>
              <h2 className="bi-section-header-title">BI Advice Flow</h2>
              <span>Rule-based warnings, recommendations, assigned action points, and staff desk routing.</span>
            </div>
          </div>
          <BIAdviceFlowPanel
            records={adviceRecords}
            filters={adviceFilters}
            onFiltersChange={setAdviceFilters}
            onGenerate={handleGenerateAdvice}
            onViewAdvice={handleOpenAdvice}
            onCreateTask={handleCreateTaskFromAdvice}
            onAssignStaff={handleAssignAdvice}
            onStartStocktake={handleStartStocktakeAdvice}
            onResolve={handleResolveAdvice}
            onDismiss={handleDismissAdvice}
            onEscalate={handleEscalateAdvice}
            canView={canViewAdvice}
          />
        </section>
      )}

      {activeDeskTab === 'Risk Output' && (
        <section className="sci-pos-card">
          <div className="bi-section-header">
            <AlertTriangle className="bi-section-header-icon" size={18} aria-hidden="true" />
            <div>
              <h2 className="bi-section-header-title">Risk Output</h2>
              <span>Current local risk output grouped by operational domain.</span>
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
                    <small>{rows.filter((row) => row.severity === 'Critical' || row.severity === 'High').length} high-risk outputs</small>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {activeDeskTab === 'BI Activity' && (
        <section className="sci-pos-card">
          <div className="bi-section-header">
            <Activity className="bi-section-header-icon" size={18} aria-hidden="true" />
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

      {activeDeskTab === 'Settings / Thresholds' && (
        <section className="sci-pos-card">
          <div className="bi-section-header">
            <ClipboardCheck className="bi-section-header-icon" size={18} aria-hidden="true" />
            <div>
              <h2 className="bi-section-header-title">Settings / Thresholds</h2>
              <span>Local threshold visibility only. Rules are not changed in this build.</span>
            </div>
          </div>
          <div className="bi-risk-output-grid">
            <article><Database size={17} aria-hidden="true" /><strong>Rules Engine</strong><span>Deterministic local rules</span><small>No business rule changes applied.</small></article>
            <article><ShieldAlert size={17} aria-hidden="true" /><strong>Risk Review</strong><span>{canReviewRisk ? 'Allowed' : 'Restricted'}</span><small>Permission: bi.riskReview</small></article>
            <article><BookOpen size={17} aria-hidden="true" /><strong>Rules Manage</strong><span>{canManageRules ? 'Allowed' : 'Restricted'}</span><small>Permission: bi.rules.manage</small></article>
            <article><Activity size={17} aria-hidden="true" /><strong>BI Export</strong><span>{canExportBi ? 'Allowed' : 'Restricted'}</span><small>Permission: bi.export</small></article>
          </div>
        </section>
      )}

      <BIAdviceDetailModal
        advice={selectedAdvice}
        activity={adviceActivity}
        shelfAssignment={selectedShelfAssignment}
        onAssign={() => selectedAdvice && void handleAssignAdvice(selectedAdvice)}
        onCreateTask={() => selectedAdvice && void handleCreateTaskFromAdvice(selectedAdvice)}
        onStartStocktake={() => selectedAdvice && void handleStartStocktakeAdvice(selectedAdvice)}
        onResolve={() => selectedAdvice && void handleResolveAdvice(selectedAdvice)}
        onDismiss={() => selectedAdvice && void handleDismissAdvice(selectedAdvice)}
        onEscalate={() => selectedAdvice && void handleEscalateAdvice(selectedAdvice)}
        onClose={() => setSelectedAdvice(null)}
      />
      <BIShelfStocktakeAssignmentModal
        assignment={selectedShelfAssignment}
        advice={selectedAdvice}
        onStart={() => void handleShelfStatus('In Progress')}
        onMarkInProgress={() => void handleShelfStatus('In Progress')}
        onMarkCompleted={() => void handleShelfStatus('Completed')}
        onClose={() => setSelectedShelfAssignment(null)}
      />
    </div>
  );
}
