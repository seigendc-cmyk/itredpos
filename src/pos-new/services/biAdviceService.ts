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
const ADVICE_TASK_KEY = 'itred_pos_bi_advice_tasks_v1';

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

export interface BIAdviceLocalTask {
  taskId: string;
  title: string;
  description: string;
  sourceModule: 'BI Desk';
  sourceAdviceId: string;
  category: BIAdviceCategory;
  priority: BIAdvicePriority;
  assignedToRole?: string;
  assignedToStaffId?: string;
  dueDate?: string;
  status: 'Open';
  createdAt: string;
}

function canUseLocalStorage(): boolean {
  return typeof localStorage !== 'undefined';
}

function nowIso(): string {
  return new Date().toISOString();
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
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

function mockAdviceRecords(): BIAdviceRecord[] {
  const now = nowIso();
  const today = todayIsoDate();
  return [
    {
      adviceId: 'BIA-MOCK-REORDER-STAGNANT',
      adviceNumber: 'BIA-RB-MOCK-001',
      category: 'Reorder Control',
      title: 'Stagnant Stock Reorder Warning',
      narrative: 'Product is available in stock but has no significant movement in the last 45 days. Reordering is risky until shelf quantity, condition, and sales history are reviewed.',
      riskLevel: 'High',
      priority: 'High',
      sourceTriggerId: 'MOCK-STAGNANT-45D',
      sourceLogId: 'BI-LOG-STAGNANT-45D',
      sourceModule: 'BI Brain Trigger Logs',
      productId: 'PROD-MOCK-STAGNANT',
      productName: 'Industrial Bearing Kit',
      sku: 'BRG-KIT-45D',
      branchName: 'Harare Main',
      shelfLocation: 'A1-S4',
      assignedToRole: 'Stock Controller + Manager',
      assignedDesk: 'Stock Desk / Manager Desk',
      dueDate: today,
      status: 'New',
      recommendedAction: 'Block Reorder',
      actionPoints: [makeActionPoint('BIA-MOCK-REORDER-STAGNANT', 'Block Reorder', 'Block reorder until Manager approval and shelf condition review are complete.', 'Manager', today)],
      createdAt: now,
      updatedAt: now,
      notes: 'Manager approval required before purchase order continuation.'
    },
    {
      adviceId: 'BIA-MOCK-SHELF-STOCKTAKE',
      adviceNumber: 'BIA-SH-MOCK-001',
      category: 'Shelf Stocktake',
      title: 'Shelf Stocktake Assignment',
      narrative: 'Monthly rotating shelf stocktake has assigned Shelf A1-S3 for today. Staff must count items and submit variance before close of day.',
      riskLevel: 'Medium',
      priority: 'Medium',
      sourceTriggerId: 'MOCK-SHELF-A1-S3',
      sourceLogId: 'BI-LOG-SHELF-A1-S3',
      sourceModule: 'BI Shelf Stocktake Planner',
      branchName: 'Harare Main',
      shelfLocation: 'A1-S3',
      assignedToStaffId: 'ST-BLESSING',
      assignedToStaffName: 'Blessing Stock',
      assignedToRole: 'Stock Controller',
      assignedDesk: 'Stock Desk',
      dueDate: today,
      status: 'Assigned',
      recommendedAction: 'Start Stocktake',
      actionPoints: [makeActionPoint('BIA-MOCK-SHELF-STOCKTAKE', 'Start Stocktake', 'Start shelf stocktake and submit variance before close of day.', 'Stock Controller', today)],
      createdAt: now,
      updatedAt: now,
      notes: 'Shelf A1-S3 assigned to Stock Controller One today.'
    },
    {
      adviceId: 'BIA-MOCK-CASH-VARIANCE',
      adviceNumber: 'BIA-CASH-MOCK-001',
      category: 'Cash Control',
      title: 'Cash Drawer Variance Review',
      narrative: 'Counted cash is higher/lower than expected drawer cash. Review sales, refunds, cash drops, and drawer open logs before EOD approval.',
      riskLevel: 'Critical',
      priority: 'Critical',
      sourceTriggerId: 'MOCK-CASH-VARIANCE',
      sourceLogId: 'BI-LOG-CASH-VARIANCE',
      sourceModule: 'Shift EOD Control',
      branchName: 'Harare Main',
      assignedToRole: 'Manager / Owner',
      assignedDesk: 'Cash Control / Owner Desk',
      dueDate: today,
      status: 'New',
      recommendedAction: 'Review Cash Variance',
      actionPoints: [makeActionPoint('BIA-MOCK-CASH-VARIANCE', 'Review Cash Variance', 'Review sales, refunds, cash drops, and drawer open logs before EOD approval.', 'Manager', today)],
      createdAt: now,
      updatedAt: now,
      notes: 'Cash variance owner review route.'
    },
    {
      adviceId: 'BIA-MOCK-PRICE-OVERRIDE',
      adviceNumber: 'BIA-PRICE-MOCK-001',
      category: 'Pricing Control',
      title: 'Price Override Review',
      narrative: 'Repeated manual price overrides were detected in the selected shift. Review cashier behaviour and product pricing rules.',
      riskLevel: 'High',
      priority: 'High',
      sourceTriggerId: 'MOCK-PRICE-OVERRIDE',
      sourceLogId: 'BI-LOG-PRICE-OVERRIDE',
      sourceModule: 'Sales Integrity',
      branchName: 'Harare Main',
      assignedToRole: 'Manager / Supervisor',
      assignedDesk: 'Manager Desk',
      dueDate: today,
      status: 'New',
      recommendedAction: 'Review Staff Action',
      actionPoints: [makeActionPoint('BIA-MOCK-PRICE-OVERRIDE', 'Review Staff Action', 'Supervisor must review manual price override pattern.', 'Supervisor', today)],
      createdAt: now,
      updatedAt: now,
      notes: 'Pricing control warning for cashier behaviour.'
    },
    {
      adviceId: 'BIA-MOCK-DELIVERY-CODE',
      adviceNumber: 'BIA-DEL-MOCK-001',
      category: 'Delivery Verification',
      title: 'Delivery Code Verification Risk',
      narrative: 'Delivery fulfilment code was not verified or had failed attempts. Review delivery confirmation before marking delivery complete.',
      riskLevel: 'Medium',
      priority: 'Medium',
      sourceTriggerId: 'MOCK-DELIVERY-CODE',
      sourceLogId: 'BI-LOG-DELIVERY-CODE',
      sourceModule: 'Delivery Verification',
      branchName: 'Harare Main',
      assignedToRole: 'Delivery Staff / Manager',
      assignedDesk: 'Delivery Desk / Manager Desk',
      dueDate: today,
      status: 'Assigned',
      recommendedAction: 'Review Delivery',
      actionPoints: [makeActionPoint('BIA-MOCK-DELIVERY-CODE', 'Review Delivery', 'Delivery supervisor must verify customer code attempts before completion.', 'Delivery Staff', today)],
      createdAt: now,
      updatedAt: now,
      notes: 'Delivery Desk / Manager Desk route.'
    }
  ];
}

function ensureAdviceSeeded(): BIAdviceRecord[] {
  const records = readList<BIAdviceRecord>(ADVICE_KEY);
  if (records.length > 0) return records;
  const seeded = mockAdviceRecords();
  saveList(ADVICE_KEY, seeded);
  seeded.forEach((record) => recordActivity({ eventType: 'BI_ADVICE_GENERATED', adviceId: record.adviceId, message: `${record.adviceNumber} seeded for local BI Advice Flow.` }));
  return seeded;
}

function categoryFromTrigger(trigger: TriggerLike): BIAdviceCategory {
  const domain = String(trigger.domain || '');
  const eventType = String(trigger.eventType || '');
  if (domain.includes('Cash') || eventType.includes('CASH')) return 'Cash Control';
  if (domain.includes('Delivery') || eventType.includes('DELIVERY')) return 'Delivery Verification';
  if (domain.includes('Staff') || eventType.includes('LOGIN')) return 'Staff Behaviour';
  if (eventType.includes('PRICE')) return 'Pricing Control';
  if (domain.includes('Sales')) return 'Sales Integrity';
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

export function recordBIAdviceActivityEvent(input: Omit<BIAdviceActivityEvent, 'eventId' | 'createdAt'>): BIAdviceActivityEvent {
  return recordActivity(input);
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
  const records = ensureAdviceSeeded();
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
    const matchesPriority = !filters.priority || filters.priority === 'ALL' || record.priority === filters.priority;
    const matchesRisk = !filters.riskLevel || filters.riskLevel === 'ALL' || record.riskLevel === filters.riskLevel;
    const matchesStatus = !filters.status || filters.status === 'ALL' || record.status === filters.status;
    const matchesRole = !filters.assignedRole || record.assignedToRole === filters.assignedRole;
    const matchesStaff = !filters.assignedStaff || record.assignedToStaffName === filters.assignedStaff || record.assignedToStaffId === filters.assignedStaff;
    const matchesBranch = !filters.branch || record.branchName === filters.branch || record.branchId === filters.branch;
    const created = new Date(record.createdAt).getTime();
    const afterFrom = !filters.dateFrom || created >= new Date(filters.dateFrom).getTime();
    const beforeTo = !filters.dateTo || created <= new Date(filters.dateTo).getTime() + 86400000;
    return matchesSearch && matchesCategory && matchesPriority && matchesRisk && matchesStatus && matchesRole && matchesStaff && matchesBranch && afterFrom && beforeTo;
  });
}

export async function getBIAdviceSummary(): Promise<{
  newAdvice: number;
  assigned: number;
  inProgress: number;
  critical: number;
  shelfStocktakesToday: number;
  reorderBlocks: number;
  resolvedToday: number;
}> {
  const records = ensureAdviceSeeded();
  const today = todayIsoDate();
  return {
    newAdvice: records.filter((record) => record.status === 'New').length,
    assigned: records.filter((record) => record.status === 'Assigned').length,
    inProgress: records.filter((record) => record.status === 'In Progress').length,
    critical: records.filter((record) => record.priority === 'Critical' || record.riskLevel === 'Critical').length,
    shelfStocktakesToday: records.filter((record) => record.category === 'Shelf Stocktake' && record.dueDate === today).length,
    reorderBlocks: records.filter((record) => record.category === 'Reorder Control').length,
    resolvedToday: records.filter((record) => record.status === 'Resolved' && record.resolvedAt?.startsWith(today)).length
  };
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
  const seeded = ensureAdviceSeeded();
  if (triggers.length === 0 && products.length === 0) return seeded;
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

export async function createBIAdviceTaskFromAdvice(advice: BIAdviceRecord): Promise<BIAdviceLocalTask> {
  const task: BIAdviceLocalTask = {
    taskId: makeId('BITASK'),
    title: `BI task: ${advice.title || advice.adviceNumber}`,
    description: advice.recommendedAction || advice.narrative,
    sourceModule: 'BI Desk',
    sourceAdviceId: advice.adviceId,
    category: advice.category,
    priority: advice.priority,
    assignedToRole: advice.assignedToRole,
    assignedToStaffId: advice.assignedToStaffId,
    dueDate: advice.dueDate,
    status: 'Open',
    createdAt: nowIso()
  };
  saveList(ADVICE_TASK_KEY, [task, ...readList<BIAdviceLocalTask>(ADVICE_TASK_KEY)].slice(0, 120));
  await createBIAdviceActionPoint({
    adviceId: advice.adviceId,
    actionType: 'Create Task',
    label: 'Task created',
    description: `${task.taskId} created from ${advice.adviceNumber}.`,
    assignedToStaffId: advice.assignedToStaffId,
    assignedToRole: advice.assignedToRole,
    dueDate: advice.dueDate
  });
  if (advice.status === 'New') {
    await updateBIAdviceStatus(advice.adviceId, 'Assigned', advice.assignedToStaffId || 'BI-DESK', 'Task created from BI advice.');
  }
  recordActivity({ eventType: 'BI_TASK_CREATED_FROM_ADVICE', adviceId: advice.adviceId, staffId: advice.assignedToStaffId, message: `${task.taskId} created from ${advice.adviceNumber}.` });
  return task;
}

export async function getBIAdviceLocalTasks(filters: { sourceAdviceId?: string } = {}): Promise<BIAdviceLocalTask[]> {
  return readList<BIAdviceLocalTask>(ADVICE_TASK_KEY).filter((task) => !filters.sourceAdviceId || task.sourceAdviceId === filters.sourceAdviceId);
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

export async function generateReorderBlockWarnings(filters: { products?: Product[] } = {}): Promise<BIReorderBlockWarning[]> {
  const sourceProducts = filters.products || [];
  const warnings = sourceProducts.map(createReorderBlockWarningForProduct).filter((warning): warning is BIReorderBlockWarning => Boolean(warning));
  if (warnings.length === 0) {
    const mockWarning: BIReorderBlockWarning = {
      warningId: 'BRW-MOCK-STAGNANT-45D',
      productId: 'PROD-MOCK-STAGNANT',
      sku: 'BRG-KIT-45D',
      productName: 'Industrial Bearing Kit',
      currentQty: 18,
      availableQty: 18,
      lastMovementDate: new Date(Date.now() - 45 * 86400000).toISOString(),
      daysWithoutMovement: 45,
      blocked: true,
      reason: 'Product is available in stock but has no significant movement in the last 45 days. Manager approval is required before reorder.',
      createdAt: nowIso()
    };
    saveList(REORDER_WARNING_KEY, [mockWarning, ...readList<BIReorderBlockWarning>(REORDER_WARNING_KEY).filter((item) => item.warningId !== mockWarning.warningId)]);
    createAdviceFromReorderWarning(mockWarning, {
      id: mockWarning.productId,
      code: mockWarning.sku,
      sku: mockWarning.sku,
      name: mockWarning.productName,
      productName: mockWarning.productName,
      category: 'Industrial Spares',
      stock: mockWarning.currentQty,
      availableStock: mockWarning.availableQty,
      minStock: 5,
      price: 120,
      cost: 82,
      branch: 'Harare Main',
      shelfLocation: 'A1-S4',
      lastMovementDate: mockWarning.lastMovementDate
    } as Product);
    return [mockWarning];
  }
  return warnings;
}

export async function createMiscellaneousSaleAdvice(payload: {
  receiptNo?: string;
  description: string;
  amount: number;
  quantity: number;
  reason: string;
  staffName: string;
  terminalName: string;
  branchName: string;
  notes?: string;
}): Promise<BIAdviceRecord> {
  const adviceId = `BIA-MISC-${Date.now()}`;
  const priority = payload.amount >= 250 ? 'High' : 'Medium';
  return upsertAdvice({
    adviceId,
    adviceNumber: `BIA-MISC-${Date.now().toString().slice(-8)}`,
    category: 'Sales Integrity',
    title: 'Miscellaneous Sale Review Required',
    narrative: 'A miscellaneous non-inventory sale was captured. This item is not part of the inventory asset register and must be reviewed to confirm whether it should become a product, service, or approved one-off sale.',
    riskLevel: priority,
    priority,
    sourceTriggerId: `MISCELLANEOUS_SALE_REVIEW_REQUIRED-${payload.receiptNo || adviceId}`,
    sourceLogId: payload.receiptNo,
    sourceModule: 'Sales Terminal',
    productName: payload.description,
    sku: 'MISC-SALE',
    branchName: payload.branchName,
    assignedToRole: priority === 'High' ? 'Owner' : 'Manager',
    assignedDesk: 'Manager Desk / Owner Desk / BI Desk',
    dueDate: todayIsoDate(),
    status: 'New',
    recommendedAction: 'Create Task',
    actionPoints: [
      makeActionPoint(adviceId, 'Create Task', 'Review receipt for miscellaneous sale classification.', 'Manager', todayIsoDate()),
      makeActionPoint(adviceId, 'Review Stock', 'Verify reason and decide whether to create product master item.', 'Manager', todayIsoDate()),
      makeActionPoint(adviceId, 'Request Approval', 'Approve as one-off sale or request correction.', priority === 'High' ? 'Owner' : 'Manager', todayIsoDate())
    ],
    createdAt: nowIso(),
    updatedAt: nowIso(),
    notes: `Reason: ${payload.reason}. Amount: USD ${payload.amount.toFixed(2)}. Staff: ${payload.staffName}. Terminal: ${payload.terminalName}.${payload.notes ? ` Notes: ${payload.notes}` : ''}`
  });
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

export async function generateShelfStocktakeAssignmentsForMonth(payload: {
  branchId?: string;
  branchName?: string;
  warehouseId?: string;
  month?: string;
  workingDays?: string[];
  staff?: Array<{ id: string; name: string }>;
  products?: Product[];
} = {}): Promise<BIShelfStocktakeAssignment[]> {
  const products = payload.products || [];
  const fallbackShelves = ['A1-S1', 'A1-S2', 'B1-S1', 'B1-S2', 'C1-S1'];
  const workingDays = payload.workingDays && payload.workingDays.length > 0 ? payload.workingDays : workingDaysThisMonth();
  const shelves = products.length > 0
    ? Array.from(new Set(products.map((product) => product.shelfLocation || product.binLocation || 'UNASSIGNED').filter(Boolean)))
    : fallbackShelves;
  const today = todayIsoDate();
  const staff = payload.staff && payload.staff.length > 0 ? payload.staff : [{ id: 'ST-BLESSING', name: 'Stock Controller One' }];
  const assignments = shelves.map((shelf, index): BIShelfStocktakeAssignment => {
    const assignedDate = workingDays[index % workingDays.length] || today;
    const assignedStaff = staff[index % staff.length];
    const shelfProducts = products.filter((product) => (product.shelfLocation || product.binLocation || 'UNASSIGNED') === shelf);
    return {
      assignmentId: `BISA-${shelf.replace(/[^a-z0-9]/gi, '-')}-${assignedDate}`,
      branchId: payload.branchId || 'BR-LOCAL',
      branchName: payload.branchName || 'Harare Main',
      warehouseId: payload.warehouseId || shelfProducts[0]?.warehouseId || 'WH-LOCAL',
      shelfLocation: shelf,
      assignedDate,
      assignedStaffId: assignedStaff.id,
      assignedStaffName: assignedStaff.name,
      itemCount: shelfProducts.length || 12,
      status: assignedDate === today ? 'Assigned' : 'Pending',
      reason: 'Monthly rotating shelf stocktake',
      createdFromBIAdviceId: `BIA-SHELF-${shelf}`
    };
  });
  const existing = readList<BIShelfStocktakeAssignment>(SHELF_ASSIGNMENT_KEY);
  const merged = [...assignments, ...existing.filter((item) => !assignments.some((assignment) => assignment.assignmentId === item.assignmentId))];
  saveList(SHELF_ASSIGNMENT_KEY, merged);
  assignments.filter((assignment) => assignment.assignedDate === today).forEach(createAdviceFromShelfAssignment);
  recordActivity({ eventType: 'BI_SHELF_STOCKTAKE_PLAN_CREATED', message: `${assignments.length} shelf stocktake assignment(s) generated for ${payload.month || today.slice(0, 7)}.` });
  return assignments;
}

export async function getTodayShelfStocktakeAssignments(filters: { branchId?: string; staffId?: string } = {}): Promise<BIShelfStocktakeAssignment[]> {
  const today = todayIsoDate();
  const assignments = readList<BIShelfStocktakeAssignment>(SHELF_ASSIGNMENT_KEY);
  return assignments.filter((assignment) =>
    assignment.assignedDate === today &&
    (!filters.branchId || assignment.branchId === filters.branchId) &&
    (!filters.staffId || assignment.assignedStaffId === filters.staffId)
  );
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
