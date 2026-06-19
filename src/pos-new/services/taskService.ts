import type {
  TaskActivityEvent,
  TaskActivityEventType,
  TaskFilterState,
  TaskPriority,
  TaskRecord,
  TaskSourceModule,
  TaskStatus,
  TaskSummary
} from '../types/posTypes';

const TASKS_KEY = 'itred_pos_task_desk_tasks_v1';
const ACTIVITY_KEY = 'itred_pos_task_desk_activity_v1';

const now = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);
const tomorrow = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
};

function readList<T>(key: string, fallback: T[]): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(fallback));
      return fallback;
    }
    return JSON.parse(raw) as T[];
  } catch {
    return fallback;
  }
}

function saveList<T>(key: string, rows: T[]): T[] {
  try {
    localStorage.setItem(key, JSON.stringify(rows));
  } catch {
    // Local workflow remains usable in memory if storage is blocked.
  }
  return rows;
}

const makeId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

function defaultTasks(): TaskRecord[] {
  const rows: Array<[string, string, TaskPriority, TaskSourceModule, string, string, string, TaskStatus, string]> = [
    ['Customer Approval', 'Mary Cashier', 'High', 'Customer Centre', 'CUST-REQ-001', today(), '15:00', 'Open', 'Review new customer request and duplicate warning.'],
    ['Return Approval', 'Tawanda Supervisor', 'High', 'Sales History', 'RET-0002', today(), '16:00', 'PendingInfo', 'Confirm return reason and receipt link before approval.'],
    ['Credit Note Approval', 'John Connor', 'Medium', 'Sales History', 'CN-0001', tomorrow(), '09:00', 'Open', 'Review customer credit note request.'],
    ['Terminal Activation', 'Admin User', 'Medium', 'Settings', 'TERM-HARARE-01', tomorrow(), '10:30', 'Open', 'Confirm readiness before terminal activation.'],
    ['Product Import Review', 'Elena Rostova', 'Medium', 'Inventory', 'IMPORT-004', today(), '17:00', 'InReview', 'Validate mapped product import rows.'],
    ['Stocktake Review', 'Elena Rostova', 'High', 'Stocktake Desk', 'STK-2026-001', today(), '18:00', 'Open', 'Review stocktake variance list.'],
    ['Stock Adjustment Approval', 'John Connor', 'High', 'Inventory', 'ADJ-0019', today(), '14:30', 'WaitingApproval', 'Approval needed for inventory value adjustment.'],
    ['Delivery Follow-up', 'Mary Cashier', 'Medium', 'Delivery Desk', 'DEL-005', today(), '15:30', 'Open', 'Follow up delayed delivery verification.'],
    ['Cash Variance Review', 'Tawanda Supervisor', 'Critical', 'Cash Control', 'SHIFT-2026-06-09', today(), '19:00', 'Open', 'Investigate critical shift cash variance.'],
    ['Price Override Approval', 'John Connor', 'Medium', 'Sales Terminal', 'OVR-0007', today(), '13:45', 'Overdue', 'Review price override request.'],
    ['Debtor Promise Follow-up', 'Admin User', 'High', 'Debtors', 'PTP-0042', today(), '12:00', 'Overdue', 'Contact customer about overdue promise-to-pay.'],
    ['Supplier Payment Review', 'Cassie Reilly', 'High', 'Creditors', 'SUP-PAY-009', tomorrow(), '11:00', 'Escalated', 'Confirm supplier payment reserve impact.'],
    ['Accounting Readiness Issue', 'Admin User', 'High', 'Accounting Desk', 'ACC-READY-009', today(), '16:30', 'Open', 'Resolve missing accounting control mapping.'],
    ['COGS Reserve Warning', 'Cassie Reilly', 'Critical', 'COGS Reserve', 'COGS-WARN-003', today(), '17:45', 'Open', 'Review possible reserve leakage.'],
    ['Purchase Discipline Warning', 'Elena Rostova', 'High', 'Purchase Discipline', 'PUR-RISK-011', tomorrow(), '08:30', 'Open', 'Review risky purchase request before conversion.']
  ];

  return rows.map(([title, staff, priority, module, record, dueDate, dueTime, status, description], index) => {
    const taskId = `TASK-${String(index + 1).padStart(4, '0')}`;
    const taskNumber = `TD-${String(index + 1).padStart(5, '0')}`;
    return {
      taskId,
      taskNumber,
      title,
      actionType: actionTypeForModule(module),
      assignedStaffId: staff.toUpperCase().replace(/\s+/g, '-'),
      assignedStaffName: staff,
      priority,
      relatedModule: module,
      relatedRecordId: record,
      relatedRecordLabel: record,
      dueDate,
      dueTime,
      status,
      description,
      notes: 'Local build-development task workflow data.',
      createdBy: 'System',
      createdAt: now(),
      escalatedAt: status === 'Escalated' ? now() : undefined,
      linkedBIAdviceId: module === 'BI Desk' || title.includes('Warning') ? `BI-${record}` : undefined,
      linkedApprovalId: status === 'WaitingApproval' ? `APR-${record}` : undefined,
      linkedCustomerId: module === 'Customer Centre' || module === 'Debtors' ? `CUST-${record}` : undefined,
      linkedSupplierId: module === 'Creditors' ? `SUP-${record}` : undefined,
      auditEvents: []
    };
  });
}

function actionTypeForModule(module: TaskSourceModule): TaskRecord['actionType'] {
  if (module === 'Cash Control') return 'ResolveVariance';
  if (module === 'Debtors') return 'CollectPayment';
  if (module === 'Creditors') return 'ContactSupplier';
  if (module === 'Delivery Desk') return 'VerifyDelivery';
  if (module === 'Inventory' || module === 'Stocktake Desk') return 'CheckStock';
  if (module === 'Accounting Desk') return 'AccountingReview';
  if (module === 'Owner Desk') return 'OwnerDecision';
  if (module === 'Approvals') return 'Approve';
  return 'Review';
}

function activity(task: TaskRecord, eventType: TaskActivityEventType, staffId: string, staffName: string, message: string): TaskActivityEvent {
  return {
    eventId: makeId('TASKACT'),
    taskId: task.taskId,
    taskNumber: task.taskNumber,
    eventType,
    message,
    staffId,
    staffName,
    createdAt: now()
  };
}

function persistTaskEvent(task: TaskRecord, event: TaskActivityEvent): TaskActivityEvent[] {
  const current = readList<TaskActivityEvent>(ACTIVITY_KEY, []);
  return saveList(ACTIVITY_KEY, [event, ...current].slice(0, 160));
}

async function patchTask(taskId: string, patch: Partial<TaskRecord>, eventType: TaskActivityEventType, staffId: string, staffName: string, message: string): Promise<TaskRecord[]> {
  const rows = await getTasks();
  let event: TaskActivityEvent | null = null;
  const next = rows.map((task) => {
    if (task.taskId !== taskId) return task;
    const updated = { ...task, ...patch };
    event = activity(updated, eventType, staffId, staffName, message);
    updated.auditEvents = [event, ...(task.auditEvents || [])].slice(0, 40);
    return updated;
  });
  if (event) persistTaskEvent(next.find((task) => task.taskId === taskId) as TaskRecord, event);
  return saveList(TASKS_KEY, next);
}

function matchesSearch(task: TaskRecord, search = ''): boolean {
  const terms = search.toLowerCase().split(/\s+/).map((term) => term.trim()).filter(Boolean);
  if (!terms.length) return true;
  const haystack = [
    task.title,
    task.assignedStaffName,
    task.priority,
    task.relatedModule,
    task.relatedRecordLabel,
    task.relatedRecordId,
    task.status,
    task.dueTime,
    task.notes,
    task.description,
    task.linkedBIAdviceId,
    task.linkedApprovalId,
    task.linkedCustomerId,
    task.linkedSupplierId
  ].join(' ').toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

function isOverdue(task: TaskRecord): boolean {
  if (task.status === 'Closed' || task.status === 'Completed' || task.status === 'Cancelled') return false;
  const due = `${task.dueDate}T${task.dueTime || '23:59'}:00`;
  return new Date(due).getTime() < Date.now() || task.status === 'Overdue';
}

export async function getTasks(filters: TaskFilterState = {}): Promise<TaskRecord[]> {
  return readList<TaskRecord>(TASKS_KEY, defaultTasks()).filter((task) =>
    matchesSearch(task, filters.search) &&
    (!filters.assignedStaffName || filters.assignedStaffName === 'All Staff' || task.assignedStaffName === filters.assignedStaffName) &&
    (!filters.priority || filters.priority === 'All' || task.priority === filters.priority) &&
    (!filters.relatedModule || filters.relatedModule === 'All' || task.relatedModule === filters.relatedModule) &&
    (!filters.status || filters.status === 'All' || task.status === filters.status) &&
    (!filters.dueDateFrom || task.dueDate >= filters.dueDateFrom) &&
    (!filters.dueDateTo || task.dueDate <= filters.dueDateTo) &&
    (!filters.overdueOnly || isOverdue(task)) &&
    (!filters.criticalOnly || task.priority === 'Critical')
  );
}

export async function getTaskById(taskId: string): Promise<TaskRecord | null> {
  return (await getTasks()).find((task) => task.taskId === taskId) || null;
}

export async function createTask(payload: Partial<TaskRecord>): Promise<TaskRecord[]> {
  const task: TaskRecord = {
    taskId: makeId('TASK'),
    taskNumber: `TD-${Date.now().toString().slice(-5)}`,
    title: payload.title || 'New Follow-up Task',
    actionType: payload.actionType || 'Review',
    assignedStaffId: payload.assignedStaffId || 'ADMIN-USER',
    assignedStaffName: payload.assignedStaffName || 'Admin User',
    priority: payload.priority || 'Medium',
    relatedModule: payload.relatedModule || 'Task Desk',
    relatedRecordId: payload.relatedRecordId || 'LOCAL',
    relatedRecordLabel: payload.relatedRecordLabel || 'Local Follow-up',
    dueDate: payload.dueDate || today(),
    dueTime: payload.dueTime || '16:00',
    status: payload.status || 'Open',
    description: payload.description || 'Local task created in Task Desk.',
    notes: payload.notes || '',
    createdBy: payload.createdBy || 'Task Desk',
    createdAt: now(),
    linkedBIAdviceId: payload.linkedBIAdviceId,
    linkedApprovalId: payload.linkedApprovalId,
    linkedCustomerId: payload.linkedCustomerId,
    linkedSupplierId: payload.linkedSupplierId,
    auditEvents: []
  };
  const event = activity(task, 'TASK_CREATED', 'TASK-DESK', 'Task Desk', `${task.taskNumber} created.`);
  task.auditEvents = [event];
  persistTaskEvent(task, event);
  return saveList(TASKS_KEY, [task, ...(await getTasks())]);
}

export const updateTask = async (taskId: string, patch: Partial<TaskRecord>) => patchTask(taskId, patch, 'TASK_NOTE_ADDED', 'SYSTEM', 'System', 'Task updated locally.');
export const startTaskReview = async (taskId: string, staffId: string, staffName = staffId) => patchTask(taskId, { status: 'InReview', startedAt: now() }, 'TASK_REVIEW_STARTED', staffId, staffName, 'Review started.');
export const markTaskPendingInfo = async (taskId: string, note: string, staffId = 'Task Desk', staffName = staffId) => patchTask(taskId, { status: 'PendingInfo', notes: note }, 'TASK_MARKED_PENDING_INFO', staffId, staffName, note);
export const escalateTask = async (taskId: string, staffId: string, note: string, target = 'Manager', staffName = staffId) => patchTask(taskId, { status: 'Escalated', escalatedAt: now(), notes: `${note} Escalated to ${target}.` }, 'TASK_ESCALATED', staffId, staffName, `${note} Escalated to ${target}.`);
export const completeTask = async (taskId: string, staffId: string, outcomeNote: string, staffName = staffId) => patchTask(taskId, { status: 'Completed', completedAt: now(), outcomeNote }, 'TASK_COMPLETED', staffId, staffName, outcomeNote);
export const closeTask = async (taskId: string, staffId: string, closeNote: string, staffName = staffId) => patchTask(taskId, { status: 'Closed', closedAt: now(), outcomeNote: closeNote }, 'TASK_CLOSED', staffId, staffName, closeNote);
export const cancelTask = async (taskId: string, staffId: string, reason: string, staffName = staffId) => patchTask(taskId, { status: 'Cancelled', outcomeNote: reason }, 'TASK_CANCELLED', staffId, staffName, reason);
export const reassignTask = async (taskId: string, staffId: string, newAssignedStaffId: string, note: string, staffName = staffId) => patchTask(taskId, { assignedStaffId: newAssignedStaffId.toUpperCase().replace(/\s+/g, '-'), assignedStaffName: newAssignedStaffId, notes: note }, 'TASK_REASSIGNED', staffId, staffName, `${note} Reassigned to ${newAssignedStaffId}.`);
export const addTaskNote = async (taskId: string, staffId: string, note: string, staffName = staffId) => patchTask(taskId, { notes: note }, 'TASK_NOTE_ADDED', staffId, staffName, note);
export const recordTaskRelatedRecordOpen = async (taskId: string, staffId: string, staffName = staffId) => patchTask(taskId, {}, 'TASK_RELATED_RECORD_OPENED', staffId, staffName, 'Related record opened through workflow routing.');
export const linkTaskToBIAdvice = async (taskId: string, biAdviceId: string) => patchTask(taskId, { linkedBIAdviceId: biAdviceId }, 'TASK_BI_WARNING_CREATED', 'BI-DESK', 'BI Desk', `Linked BI advice ${biAdviceId}.`);
export const linkTaskToApproval = async (taskId: string, approvalId: string) => patchTask(taskId, { linkedApprovalId: approvalId, status: 'WaitingApproval' }, 'TASK_APPROVAL_CREATED', 'APPROVALS', 'Approvals', `Linked approval ${approvalId}.`);

export async function createTaskFromBIAdvice(biAdvice: { adviceId?: string; adviceNumber?: string; title?: string; assignedToStaffId?: string }): Promise<TaskRecord[]> {
  return createTask({ title: biAdvice.title || 'BI advice follow-up', relatedModule: 'BI Desk', relatedRecordId: biAdvice.adviceId || 'BI-LOCAL', relatedRecordLabel: biAdvice.adviceNumber || biAdvice.adviceId || 'BI Advice', linkedBIAdviceId: biAdvice.adviceId, assignedStaffId: biAdvice.assignedToStaffId || 'BI-DESK', assignedStaffName: biAdvice.assignedToStaffId || 'BI Desk', priority: 'High' });
}

export async function createTaskFromApproval(approval: { id?: string; approvalId?: string; title?: string; category?: string }): Promise<TaskRecord[]> {
  const approvalId = approval.approvalId || approval.id || 'APR-LOCAL';
  return createTask({ title: approval.title || approval.category || 'Approval follow-up', relatedModule: 'Approvals', relatedRecordId: approvalId, relatedRecordLabel: approvalId, linkedApprovalId: approvalId, priority: 'High', status: 'WaitingApproval' });
}

export async function getTaskActivityEvents(filters: { taskId?: string } = {}): Promise<TaskActivityEvent[]> {
  return readList<TaskActivityEvent>(ACTIVITY_KEY, []).filter((event) => !filters.taskId || event.taskId === filters.taskId);
}

export const getOverdueTasks = async () => (await getTasks()).filter(isOverdue);
export const getTasksDueToday = async () => (await getTasks()).filter((task) => task.dueDate === today());

export async function getTaskSummary(): Promise<TaskSummary> {
  const tasks = await getTasks();
  return {
    totalTasks: tasks.length,
    open: tasks.filter((task) => task.status === 'Open' || task.status === 'Overdue').length,
    inReview: tasks.filter((task) => task.status === 'InReview').length,
    pendingInfo: tasks.filter((task) => task.status === 'PendingInfo').length,
    escalated: tasks.filter((task) => task.status === 'Escalated').length,
    dueToday: tasks.filter((task) => task.dueDate === today()).length,
    overdue: tasks.filter(isOverdue).length,
    critical: tasks.filter((task) => task.priority === 'Critical').length,
    completedToday: tasks.filter((task) => task.status === 'Completed' && task.completedAt?.startsWith(today())).length,
    closedToday: tasks.filter((task) => task.status === 'Closed' && task.closedAt?.startsWith(today())).length
  };
}
