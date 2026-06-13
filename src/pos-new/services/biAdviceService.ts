import type {
  BIAdviceActionPoint,
  BIAdviceActionType,
  BIAdviceActivityEvent,
  BIAdviceCategory,
  BIAdviceFilterState,
  BIAdviceRecord,
  BIAdviceStatus,
  BIReorderBlockWarning,
  BIShelfStocktakeAssignment,
  Product,
  RiskLevel
} from '../types';
import { matchesFreeOrderSearch } from '../utils/searchUtils';

const ADVICE_KEY = 'itred_pos_bi_advice_records_v1';
const ACTIVITY_KEY = 'itred_pos_bi_advice_activity_v1';
const REORDER_WARNING_KEY = 'itred_pos_bi_reorder_block_warnings_v1';
const SHELF_ASSIGNMENT_KEY = 'itred_pos_bi_shelf_stocktake_assignments_v1';

type TriggerLike = {
  id?: string;
  eventType?: string;
  domain?: string;
  severity?: RiskLevel | string;
  trigger?: string;
  description?: string;
  recommendedAction?: string;
  productId?: string;
  productName?: string;
  sku?: string;
  staffName?: string;
  branchName?: string;
  shelfLocation?: string;
  terminalName?: string;
  notes?: string;
};

export interface BIAdviceAssignmentPayload {
  assignedToStaffId?: string;
  assignedToStaffName?: string;
  assignedToRole?: string;
  assignedDesk?: string;
  dueDate?: string;
  note?: string;
}

export interface CreateBIAdviceActionPointPayload {
  adviceId: string;
  actionType: BIAdviceActionType;
  label: string;
  description: string;
  assignedToStaffId?: string;
  assignedToRole?: string;
  dueDate?: string;
}

function canUseLocalStorage(): boolean {
  return typeof localStorage !== 'undefined';
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function readList<T>(key: string, fallback: T[] = []): T[] {
  if (!canUseLocalStorage()) return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as T[] : fallback;
  } catch {
    return fallback;
  }
}

function saveList<T>(key: string, value: T[]): void {
  if (!canUseLocalStorage()) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local BI advice persistence is best-effort.
  }
}

function daysSince(dateValue?: string): number {
  if (!dateValue) return 999;
  const time = new Date(dateValue).getTime();
  if (Number.isNaN(time)) return 999;
  return Math.max(0, Math.floor((Date.now() - time) / 86400000));
}

function productName(product: Product): string {
  return product.productName || product.name;
}

function productSku(product: Product): string {
  return product.sku || product.code;
}

function productQty(product: Product): number {
  return product.availableStock ?? product.qtyOnHand ?? product.stock;
}

function normalizeRisk(value?: string): RiskLevel {
  if (value === 'Critical' || value === 'High' || value === 'Medium' || value === 'Low') return value;
  return 'Medium';
}

function categoryFromTrigger(trigger: TriggerLike): BIAdviceCategory {
  const domain = String(trigger.domain || '');
  const eventType = String(trigger.eventType || '');
  if (domain.includes('Cash') || eventType.includes('CASH')) return 'Cash Control';
  if (domain.includes('Delivery') || eventType.includes('DELIVERY')) return 'Delivery Verification';
  if (domain.includes('Staff') || eventType.includes('LOGIN')) return 'Staff Behaviour';
  if (domain.includes('Sales') || eventType.includes('PRICE')) return 'Sales Integrity';
  if (eventType.includes('REORDER')) return 'Reorder Control';
  return 'Stock Health';
}

function recommendedActionFromCategory(category: BIAdviceCategory, trigger: TriggerLike): BIAdviceActionType {
  const eventType = String(trigger.eventType || '');
  if (category === 'Cash Control') return 'Review Cash Variance';
  if (category === 'Delivery Verification') return 'Review Delivery';
  if (category === 'Staff Behaviour') return 'Review Staff Action';
  if (category === 'Reorder Control') return 'Block Reorder';
  if (eventType.includes('STOCKTAKE') || eventType.includes('VARIANCE')) return 'Start Stocktake';
  if (eventType.includes('LOW_STOCK') || eventType.includes('REORDER')) return 'Create Purchase Reminder';
  return 'Review Stock';
}

function makeActionPoint(adviceId: string, actionType: BIAdviceActionType, description: string, assignedToRole?: string, dueDate?: string): BIAdviceActionPoint {
  return {
    actionPointId: makeId('BIAP'),
    adviceId,
    actionType,
    label: actionType,
    description,
    assignedToRole,
    dueDate,
    status: assignedToRole ? 'Assigned' : 'New'
  };
}

function recordActivity(input: Omit<BIAdviceActivityEvent, 'eventId' | 'createdAt'>): BIAdviceActivityEvent {
  const event: BIAdviceActivityEvent = {
    ...input,
    eventId: makeId('BIACT'),
    createdAt: nowIso()
  };
  saveList(ACTIVITY_KEY, [event, ...readList<BIAdviceActivityEvent>(ACTIVITY_KEY)].slice(0, 120));
  return event;
}

function upsertAdvice(advice: BIAdviceRecord): BIAdviceRecord {
  const records = readList<BIAdviceRecord>(ADVICE_KEY);
  const existing = records.find((item) => item.sourceTriggerId === advice.sourceTriggerId);
  if (existing) return existing;
  saveList(ADVICE_KEY, [advice, ...records]);
  recordActivity({ eventType: 'BI_ADVICE_GENERATED', adviceId: advice.adviceId, message: `${advice.adviceNumber} generated: ${advice.title}.` });
  return advice;
}

export async function getBIAdviceRecords(filters: BIAdviceFilterState = {}): Promise<BIAdviceRecord[]> {
  const records = readList<BIAdviceRecord>(ADVICE_KEY);
  return records.filter((record) => {
    const matchesSearch = matchesFreeOrderSearch(record, filters.search || '', [
      'adviceNumber',
      'category',
      'title',
      'narrative',
      'riskLevel',
      'priority',
      'recommendedAction',
      'productName',
      'sku',
      'shelfLocation',
      'assignedToStaffName',
      'assignedToRole',
      'assignedDesk',
      'status',
      'notes'
    ]);
    const matchesCategory = !filters.category || filters.category === 'ALL' || record.category === filters.category;
    const matchesRisk = !filters.riskLevel || filters.riskLevel === 'ALL' || record.riskLevel === filters.riskLevel;
    const matchesStatus = !filters.status || filters.status === 'ALL' || record.status === filters.status;
    const matchesRole = !filters.assignedRole || record.assignedToRole === filters.assignedRole;
    const matchesStaff = !filters.assignedStaff || record.assignedToStaffName === filters.assignedStaff || record.assignedToStaffId === filters.assignedStaff;
    const matchesBranch = !filters.branch || record.branchName === filters.branch || record.branchId === filters.branch;
    const created = new Date(record.createdAt).getTime();
    const afterFrom = !filters.dateFrom || created >= new Date(filters.dateFrom).getTime();
    const beforeTo = !filters.dateTo || created <= new Date(filters.dateTo).getTime() + 86400000;
    return matchesSearch && matchesCategory && matchesRisk && matchesStatus && matchesRole && matchesStaff && matchesBranch && afterFrom && beforeTo;
  });
}

export async function getBIAdviceRecordById(adviceId: string): Promise<BIAdviceRecord | null> {
  return readList<BIAdviceRecord>(ADVICE_KEY).find((record) => record.adviceId === adviceId) || null;
}

export async function createBIAdviceFromTrigger(trigger: TriggerLike): Promise<BIAdviceRecord> {
  const category = categoryFromTrigger(trigger);
  const riskLevel = normalizeRisk(String(trigger.severity || 'Medium'));
  const recommendedAction = recommendedActionFromCategory(category, trigger);
  const adviceId = makeId('BIADV');
  const narrative = trigger.description || trigger.notes || `${trigger.eventType || 'BI trigger'} requires deterministic review.`;
  const advice: BIAdviceRecord = {
    adviceId,
    adviceNumber: `BIA-${Date.now().toString().slice(-8)}`,
    category,
    title: `${category}: ${trigger.eventType || trigger.trigger || 'Advice'}`,
    narrative,
    riskLevel,
    priority: riskLevel,
    sourceTriggerId: trigger.id || makeId('TRG'),
    sourceLogId: trigger.id,
    sourceModule: 'BI Desk',
    productName: trigger.productName,
    sku: trigger.sku,
    branchName: trigger.branchName,
    shelfLocation: trigger.shelfLocation,
    assignedToRole: category === 'Cash Control' ? 'Manager' : category === 'Delivery Verification' ? 'Delivery Staff' : 'Stock Controller',
    assignedDesk: category === 'Cash Control' ? 'Cash Control' : category === 'Delivery Verification' ? 'Delivery Desk' : 'Stock Desk',
    dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    status: 'New',
    recommendedAction,
    actionPoints: [makeActionPoint(adviceId, recommendedAction, narrative, category === 'Cash Control' ? 'Manager' : 'Stock Controller')],
    createdAt: nowIso(),
    updatedAt: nowIso(),
    notes: trigger.notes || trigger.recommendedAction
  };
  return upsertAdvice(advice);
}

export async function generateBIAdviceFromTriggerLogs(triggers: TriggerLike[] = [], products: Product[] = []): Promise<BIAdviceRecord[]> {
  const generated: BIAdviceRecord[] = [];
  for (const trigger of triggers) {
    generated.push(await createBIAdviceFromTrigger(trigger));
  }
  for (const product of products) {
    const warning = createReorderBlockWarningForProduct(product);
    if (warning) generated.push(createAdviceFromReorderWarning(warning, product));
  }
  const shelfAssignments = createMonthlyShelfStocktakeAssignments(products);
  generated.push(...shelfAssignments.map(createAdviceFromShelfAssignment));
  return generated;
}

export async function createBIAdviceActionPoint(payload: CreateBIAdviceActionPointPayload): Promise<BIAdviceActionPoint | null> {
  const records = readList<BIAdviceRecord>(ADVICE_KEY);
  const record = records.find((item) => item.adviceId === payload.adviceId);
  if (!record) return null;
  const actionPoint = makeActionPoint(payload.adviceId, payload.actionType, payload.description, payload.assignedToRole, payload.dueDate);
  actionPoint.label = payload.label;
  actionPoint.assignedToStaffId = payload.assignedToStaffId;
  const next = records.map((item) => item.adviceId === payload.adviceId ? { ...item, actionPoints: [actionPoint, ...item.actionPoints], updatedAt: nowIso() } : item);
  saveList(ADVICE_KEY, next);
  recordActivity({ eventType: 'BI_ACTION_POINT_CREATED', adviceId: payload.adviceId, message: `${payload.label} action point created.` });
  return actionPoint;
}

export async function assignBIAdvice(adviceId: string, assignmentPayload: BIAdviceAssignmentPayload): Promise<BIAdviceRecord | null> {
  const records = readList<BIAdviceRecord>(ADVICE_KEY);
  let updated: BIAdviceRecord | null = null;
  const next = records.map((record) => {
    if (record.adviceId !== adviceId) return record;
    updated = {
      ...record,
      ...assignmentPayload,
      status: 'Assigned',
      updatedAt: nowIso(),
      notes: [record.notes, assignmentPayload.note].filter(Boolean).join(' | ')
    };
    return updated;
  });
  saveList(ADVICE_KEY, next);
  if (updated) recordActivity({ eventType: 'BI_ADVICE_ASSIGNED', adviceId, message: `${updated.adviceNumber} assigned.` });
  return updated;
}

export async function updateBIAdviceStatus(adviceId: string, status: BIAdviceStatus, staffId: string, note: string): Promise<BIAdviceRecord | null> {
  const records = readList<BIAdviceRecord>(ADVICE_KEY);
  let updated: BIAdviceRecord | null = null;
  const next = records.map((record) => {
    if (record.adviceId !== adviceId) return record;
    updated = {
      ...record,
      status,
      updatedAt: nowIso(),
      resolvedAt: status === 'Resolved' ? nowIso() : record.resolvedAt,
      notes: [record.notes, `${staffId}: ${note}`].filter(Boolean).join(' | ')
    };
    return updated;
  });
  saveList(ADVICE_KEY, next);
  return updated;
}

export async function resolveBIAdvice(adviceId: string, staffId: string, note: string): Promise<BIAdviceRecord | null> {
  const record = await updateBIAdviceStatus(adviceId, 'Resolved', staffId, note);
  if (record) recordActivity({ eventType: 'BI_ADVICE_RESOLVED', adviceId, staffId, message: `${record.adviceNumber} resolved.` });
  return record;
}

export async function dismissBIAdvice(adviceId: string, staffId: string, reason: string): Promise<BIAdviceRecord | null> {
  const record = await updateBIAdviceStatus(adviceId, 'Dismissed', staffId, reason);
  if (record) recordActivity({ eventType: 'BI_ADVICE_DISMISSED', adviceId, staffId, message: `${record.adviceNumber} dismissed.` });
  return record;
}

export async function escalateBIAdvice(adviceId: string, staffId: string, reason: string): Promise<BIAdviceRecord | null> {
  const record = await updateBIAdviceStatus(adviceId, 'Escalated', staffId, reason);
  if (record) recordActivity({ eventType: 'BI_ADVICE_ESCALATED', adviceId, staffId, message: `${record.adviceNumber} escalated to Owner.` });
  return record;
}

export async function getBIAdviceActivityEvents(filters: { adviceId?: string } = {}): Promise<BIAdviceActivityEvent[]> {
  return readList<BIAdviceActivityEvent>(ACTIVITY_KEY).filter((event) => !filters.adviceId || event.adviceId === filters.adviceId);
}

export function createReorderBlockWarningForProduct(product: Product): BIReorderBlockWarning | null {
  const availableQty = productQty(product);
  const staleDays = daysSince(product.lastMovementDate);
  const isFastMoving = product.healthStatus === 'Fast Moving' || product.stockStatus === 'Fast Moving';
  const threshold = product.healthStatus === 'Slow Moving' || product.stockStatus === 'Slow Moving' ? 60 : 30;
  if (availableQty <= 0 || staleDays <= threshold || isFastMoving) return null;
  const warning: BIReorderBlockWarning = {
    warningId: `BRW-${product.id}`,
    productId: product.id,
    sku: productSku(product),
    productName: productName(product),
    currentQty: product.stock,
    availableQty,
    lastMovementDate: product.lastMovementDate,
    daysWithoutMovement: staleDays,
    blocked: true,
    reason: 'This product still exists in stock but has no significant movement in the selected period. Ordering more stock may increase dead stock risk. Review shelf quantity, stock condition, and sales history before reorder.',
    createdAt: nowIso()
  };
  const records = readList<BIReorderBlockWarning>(REORDER_WARNING_KEY);
  if (!records.some((item) => item.warningId === warning.warningId)) {
    saveList(REORDER_WARNING_KEY, [warning, ...records]);
    recordActivity({ eventType: 'BI_REORDER_BLOCK_WARNING_CREATED', message: `${warning.sku} reorder block warning created.` });
  }
  return warning;
}

function createAdviceFromReorderWarning(warning: BIReorderBlockWarning, product: Product): BIAdviceRecord {
  const adviceId = `BIA-REORDER-${product.id}`;
  return upsertAdvice({
    adviceId,
    adviceNumber: `BIA-RB-${productSku(product)}`,
    category: 'Reorder Control',
    title: `Reorder block warning: ${warning.productName}`,
    narrative: warning.reason,
    riskLevel: warning.availableQty * (product.cost || 0) > 300 ? 'Critical' : 'High',
    priority: warning.availableQty * (product.cost || 0) > 300 ? 'Critical' : 'High',
    sourceTriggerId: warning.warningId,
    sourceModule: 'BI Desk',
    productId: product.id,
    productName: warning.productName,
    sku: warning.sku,
    branchName: product.branch,
    shelfLocation: product.shelfLocation,
    assignedToRole: 'Manager',
    assignedDesk: 'Manager Desk',
    dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    status: 'New',
    recommendedAction: 'Block Reorder',
    actionPoints: [makeActionPoint(adviceId, 'Review Stock', 'Review existing stock before ordering.', 'Manager')],
    createdAt: nowIso(),
    updatedAt: nowIso(),
    notes: `Days without movement: ${warning.daysWithoutMovement}`
  });
}

function workingDaysThisMonth(): string[] {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const days: string[] = [];
  for (let date = new Date(first); date.getMonth() === first.getMonth(); date.setDate(date.getDate() + 1)) {
    if (date.getDay() !== 0) days.push(date.toISOString().slice(0, 10));
  }
  return days;
}

export function createMonthlyShelfStocktakeAssignments(products: Product[], branchName = 'Harare Main', assignedStaffName = 'Stock Controller'): BIShelfStocktakeAssignment[] {
  const shelves = Array.from(new Set(products.map((product) => product.shelfLocation || product.binLocation || 'UNASSIGNED').filter(Boolean)));
  if (shelves.length === 0) return [];
  const workingDays = workingDaysThisMonth();
  const today = new Date().toISOString().slice(0, 10);
  const assignments = shelves.map((shelf, index): BIShelfStocktakeAssignment => {
    const assignedDate = workingDays[index % workingDays.length] || today;
    const shelfProducts = products.filter((product) => (product.shelfLocation || product.binLocation || 'UNASSIGNED') === shelf);
    return {
      assignmentId: `BISA-${shelf.replace(/[^a-z0-9]/gi, '-')}-${assignedDate}`,
      branchId: 'BR-LOCAL',
      branchName,
      warehouseId: shelfProducts[0]?.warehouseId || 'WH-LOCAL',
      shelfLocation: shelf,
      assignedDate,
      assignedStaffId: 'ROLE-STOCK-CONTROLLER',
      assignedStaffName,
      itemCount: shelfProducts.length,
      status: assignedDate === today ? 'Assigned' : 'Pending',
      reason: 'Monthly rotating shelf stocktake',
      createdFromBIAdviceId: `BIA-SHELF-${shelf}`
    };
  });
  const existing = readList<BIShelfStocktakeAssignment>(SHELF_ASSIGNMENT_KEY);
  const existingIds = new Set(existing.map((item) => item.assignmentId));
  const fresh = assignments.filter((item) => !existingIds.has(item.assignmentId));
  if (fresh.length > 0) {
    saveList(SHELF_ASSIGNMENT_KEY, [...fresh, ...existing]);
    recordActivity({ eventType: 'BI_SHELF_STOCKTAKE_PLAN_CREATED', message: `${fresh.length} monthly shelf stocktake assignments prepared.` });
  }
  return assignments.filter((assignment) => assignment.assignedDate === today);
}

function createAdviceFromShelfAssignment(assignment: BIShelfStocktakeAssignment): BIAdviceRecord {
  const adviceId = assignment.createdFromBIAdviceId;
  const advice = upsertAdvice({
    adviceId,
    adviceNumber: `BIA-SH-${assignment.shelfLocation}`,
    category: 'Shelf Stocktake',
    title: `Shelf stocktake due: ${assignment.shelfLocation}`,
    narrative: `Today's shelf stocktake assignment covers ${assignment.shelfLocation}. Count this shelf as part of the monthly rotating stocktake plan.`,
    riskLevel: 'Medium',
    priority: 'Medium',
    sourceTriggerId: assignment.assignmentId,
    sourceModule: 'BI Desk',
    branchId: assignment.branchId,
    branchName: assignment.branchName,
    shelfLocation: assignment.shelfLocation,
    assignedToStaffId: assignment.assignedStaffId,
    assignedToStaffName: assignment.assignedStaffName,
    assignedToRole: 'Stock Controller',
    assignedDesk: 'Stock Desk',
    dueDate: assignment.assignedDate,
    status: 'Assigned',
    recommendedAction: 'Assign Shelf Stocktake',
    actionPoints: [makeActionPoint(adviceId, 'Start Stocktake', `Start shelf count for ${assignment.shelfLocation}.`, 'Stock Controller', assignment.assignedDate)],
    createdAt: nowIso(),
    updatedAt: nowIso(),
    notes: assignment.reason
  });
  recordActivity({ eventType: 'BI_SHELF_STOCKTAKE_ASSIGNED', adviceId, message: `${assignment.shelfLocation} assigned for shelf stocktake.` });
  return advice;
}

export async function getBIShelfStocktakeAssignments(): Promise<BIShelfStocktakeAssignment[]> {
  return readList<BIShelfStocktakeAssignment>(SHELF_ASSIGNMENT_KEY);
}

export async function updateBIShelfStocktakeAssignmentStatus(assignmentId: string, status: BIShelfStocktakeAssignment['status']): Promise<BIShelfStocktakeAssignment | null> {
  const records = readList<BIShelfStocktakeAssignment>(SHELF_ASSIGNMENT_KEY);
  let updated: BIShelfStocktakeAssignment | null = null;
  saveList(SHELF_ASSIGNMENT_KEY, records.map((record) => {
    if (record.assignmentId !== assignmentId) return record;
    updated = { ...record, status };
    return updated;
  }));
  if (updated && status === 'Completed') recordActivity({ eventType: 'BI_ACTION_POINT_COMPLETED', message: `${updated.shelfLocation} shelf stocktake completed.` });
  return updated;
}

export async function getBIReorderBlockWarnings(): Promise<BIReorderBlockWarning[]> {
  return readList<BIReorderBlockWarning>(REORDER_WARNING_KEY);
}
