import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardCheck, Download, Eye, FileText, Flag, PlayCircle, Printer, RefreshCw, Search, ShieldAlert, StickyNote, XCircle } from 'lucide-react';
import { PosSession, Role, TaskActivityEvent, TaskFilterState, TaskPriority, TaskRecord, TaskSourceModule, TaskStatus, TaskSummary } from '../types';
import RowActionMenu, { RowActionMenuItem } from '../components/RowActionMenu';
import { hasPermission, type PermissionKey } from '../utils/posPermissions';
import {
  addTaskNote,
  closeTask,
  completeTask,
  createTask,
  escalateTask,
  getTaskActivityEvents,
  getTaskSummary,
  getTasks,
  linkTaskToApproval,
  linkTaskToBIAdvice,
  markTaskPendingInfo,
  reassignTask,
  startTaskReview
} from '../services/taskService';

interface PosTaskDeskProps {
  session: PosSession;
}

type TaskModalMode = 'view' | 'note' | 'reassign' | 'pendingInfo' | 'escalate' | 'complete' | 'close' | 'approval' | 'bi' | 'related';

const priorityOptions: Array<TaskPriority | 'All'> = ['All', 'Low', 'Medium', 'High', 'Critical'];
const statusOptions: Array<TaskStatus | 'All'> = ['All', 'Open', 'InReview', 'PendingInfo', 'Escalated', 'WaitingApproval', 'Completed', 'Closed', 'Cancelled', 'Overdue'];
const moduleOptions: Array<TaskSourceModule | 'All'> = ['All', 'Customer Centre', 'Sales History', 'Sales Terminal', 'Inventory', 'Stocktake Desk', 'Delivery Desk', 'Cash Control', 'Owner Desk', 'Task Desk', 'Accounting Desk', 'Debtors', 'Creditors', 'COGS Reserve', 'Purchase Discipline', 'BI Desk', 'Approvals', 'Settings', 'Sync Desk'];
const staffOptions = ['Admin User', 'Mary Cashier', 'Tawanda Supervisor', 'John Connor', 'Elena Rostova', 'Cassie Reilly', 'Accountant', 'Stock Controller', 'Cash Control', 'BI Desk'];
const escalationTargets = ['Manager', 'Owner', 'Accountant', 'Stock Controller', 'Cash Control', 'BI Desk'];

export default function PosTaskDesk({ session }: PosTaskDeskProps) {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [activity, setActivity] = useState<TaskActivityEvent[]>([]);
  const [summary, setSummary] = useState<TaskSummary | null>(null);
  const [filters, setFilters] = useState<TaskFilterState>({ priority: 'All', relatedModule: 'All', status: 'All' });
  const [notice, setNotice] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [modal, setModal] = useState<{ mode: TaskModalMode; task: TaskRecord } | null>(null);
  const [workflowNote, setWorkflowNote] = useState('');
  const [reassignTo, setReassignTo] = useState('Admin User');
  const [escalationTarget, setEscalationTarget] = useState('Manager');
  const role = session.role as Role;

  const load = async () => {
    const [nextTasks, nextActivity, nextSummary] = await Promise.all([getTasks(filters), getTaskActivityEvents(), getTaskSummary()]);
    setTasks(nextTasks);
    setActivity(nextActivity);
    setSummary(nextSummary);
  };

  useEffect(() => {
    void load();
  }, [filters]);

  const can = (permission: PermissionKey) => hasPermission(role, permission) || (permission === 'taskDesk.view' || permission === 'taskDesk.viewDetail' ? hasPermission(role, 'tasks.view') : false);
  const staffName = session.staffName || 'Task Desk';
  const staffId = session.staffId || staffName;

  const requirePermission = (permission: PermissionKey): boolean => {
    if (can(permission)) return true;
    setNotice('You do not have permission to perform this action.');
    return false;
  };

  const refreshAfter = async (message: string) => {
    setNotice(message);
    setModal(null);
    setWorkflowNote('');
    await load();
  };

  const startReview = async (task: TaskRecord) => {
    if (!requirePermission('taskDesk.startReview')) return;
    await startTaskReview(task.taskId, staffId, staffName);
    await refreshAfter('Review started.');
  };

  const openModal = async (mode: TaskModalMode, task: TaskRecord) => {
    if (mode === 'view' && !requirePermission('taskDesk.viewDetail')) return;
    if (mode === 'related' && !requirePermission('taskDesk.openRelatedRecord')) return;
    setModal({ mode, task });
    setWorkflowNote('');
    setReassignTo(task.assignedStaffName);
    if (mode === 'view') {
      await addTaskNote(task.taskId, staffId, 'Task viewed.', staffName);
      await load();
    }
  };

  const saveWorkflow = async () => {
    if (!modal) return;
    const note = workflowNote.trim();
    const task = modal.task;
    if (['pendingInfo', 'escalate', 'complete', 'close', 'note'].includes(modal.mode) && !note) {
      setNotice('A note or outcome is required.');
      return;
    }
    if (modal.mode === 'note') {
      if (!requirePermission('taskDesk.addNote')) return;
      await addTaskNote(task.taskId, staffId, note, staffName);
      await refreshAfter('Task note added.');
    } else if (modal.mode === 'reassign') {
      if (!requirePermission('taskDesk.reassign')) return;
      await reassignTask(task.taskId, staffId, reassignTo, note || `Reassigned to ${reassignTo}.`, staffName);
      await refreshAfter('Task reassigned.');
    } else if (modal.mode === 'pendingInfo') {
      if (!requirePermission('taskDesk.pendingInfo')) return;
      await markTaskPendingInfo(task.taskId, note, staffId, staffName);
      await refreshAfter('Task marked pending info.');
    } else if (modal.mode === 'escalate') {
      if (!requirePermission('taskDesk.escalate')) return;
      await escalateTask(task.taskId, staffId, note, escalationTarget, staffName);
      await refreshAfter('Task escalated.');
    } else if (modal.mode === 'complete') {
      if (!requirePermission('taskDesk.complete')) return;
      await completeTask(task.taskId, staffId, note, staffName);
      await refreshAfter('Task completed.');
    } else if (modal.mode === 'close') {
      if (!requirePermission('taskDesk.close')) return;
      await closeTask(task.taskId, staffId, note, staffName);
      await refreshAfter('Task closed.');
    } else if (modal.mode === 'approval') {
      if (!requirePermission('taskDesk.createApproval')) return;
      await linkTaskToApproval(task.taskId, `APR-${task.taskNumber}`);
      await refreshAfter('Approval created and linked locally.');
    } else if (modal.mode === 'bi') {
      if (!requirePermission('taskDesk.createBIWarning')) return;
      await linkTaskToBIAdvice(task.taskId, `BI-${task.taskNumber}`);
      await refreshAfter('BI warning created and linked locally.');
    }
  };

  const printTask = async (task: TaskRecord) => {
    if (!requirePermission('taskDesk.print')) return;
    const printWindow = window.open('', '_blank', 'width=900,height=720');
    if (!printWindow) {
      setNotice('Print window was blocked. Allow pop-ups to print the task.');
      return;
    }
    printWindow.document.write(taskPrintHtml(task));
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    await addTaskNote(task.taskId, staffId, 'Task print prepared.', staffName);
    await refreshAfter('Task print prepared.');
  };

  const exportTask = async (task: TaskRecord) => {
    if (!requirePermission('taskDesk.export')) return;
    const csv = [
      ['Task Number', 'Title', 'Assigned Staff', 'Priority', 'Related Module', 'Related Record', 'Due Date', 'Due Time', 'Status', 'Notes'],
      [task.taskNumber, task.title, task.assignedStaffName, task.priority, task.relatedModule, task.relatedRecordLabel, task.dueDate, task.dueTime, task.status, task.notes]
    ].map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${task.taskNumber}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    await addTaskNote(task.taskId, staffId, 'Task export prepared.', staffName);
    await refreshAfter('Task export prepared locally.');
  };

  const createFollowUpTask = async () => {
    if (!requirePermission('taskDesk.create')) return;
    await createTask({ title: 'Manual follow-up task', relatedModule: 'Task Desk', relatedRecordId: 'MANUAL', relatedRecordLabel: 'Manual Follow-up', assignedStaffName: staffName, assignedStaffId: staffId, createdBy: staffName });
    await refreshAfter('Task created locally.');
  };

  const assignedStaffOptions = useMemo(() => ['All Staff', ...Array.from(new Set(tasks.map((task) => task.assignedStaffName))).sort()], [tasks]);
  const activeFilters = [filters.search, filters.assignedStaffName && filters.assignedStaffName !== 'All Staff', filters.priority && filters.priority !== 'All', filters.relatedModule && filters.relatedModule !== 'All', filters.status && filters.status !== 'All', filters.dueDateFrom, filters.dueDateTo, filters.overdueOnly, filters.criticalOnly].filter(Boolean).length;

  return (
    <div className="space-y-5 text-xs industrial-font-sans">
      <div className="bg-white border border-[#b1b5c2] p-4">
        <div className="text-[10px] text-orange-600 font-black uppercase tracking-wider">iTred Commerce POS</div>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-[#1e222b] uppercase mt-1">Task Desk</h2>
            <p className="text-[11px] text-slate-600 font-bold uppercase mt-1">Staff actions, reviews, approvals, and operational follow-ups</p>
          </div>
          <button type="button" onClick={createFollowUpTask} className="industrial-primary-button min-h-[40px]"><ClipboardCheck className="w-4 h-4" />Create Task</button>
        </div>
        <div className="mt-3 bg-orange-50 border border-orange-200 text-orange-900 p-3 text-[10px] font-bold uppercase">
          Local build-development mode: workflow actions update local task state only.
        </div>
      </div>

      {notice && <div className="bg-orange-50 border border-orange-300 text-orange-900 px-3 py-2 font-bold uppercase">{notice}</div>}

      <div className="grid grid-cols-2 md:grid-cols-5 xl:grid-cols-10 gap-3">
        {summary && [
          ['Total Tasks', summary.totalTasks],
          ['Open', summary.open],
          ['In Review', summary.inReview],
          ['Pending Info', summary.pendingInfo],
          ['Escalated', summary.escalated],
          ['Due Today', summary.dueToday],
          ['Overdue', summary.overdue],
          ['Critical', summary.critical],
          ['Completed Today', summary.completedToday],
          ['Closed Today', summary.closedToday]
        ].map(([label, value]) => <SummaryCard key={label} label={String(label)} value={String(value)} />)}
      </div>

      <div className="bg-white border border-[#b1b5c2] p-3">
        <div className="grid grid-cols-1 md:grid-cols-4 xl:grid-cols-8 gap-2">
          <label className="space-y-1 xl:col-span-2"><span className="task-filter-label">Search</span><div className="flex items-center gap-2 border border-[#b1b5c2] px-2 py-2"><Search className="w-4 h-4 text-orange-600" /><input value={filters.search || ''} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} className="outline-none w-full text-[10px]" placeholder="cash variance critical" /></div></label>
          <Select label="Assigned Staff" value={filters.assignedStaffName || 'All Staff'} options={assignedStaffOptions} onChange={(value) => setFilters((current) => ({ ...current, assignedStaffName: value }))} />
          <Select label="Priority" value={filters.priority || 'All'} options={priorityOptions} onChange={(value) => setFilters((current) => ({ ...current, priority: value as TaskFilterState['priority'] }))} />
          <Select label="Related Module" value={filters.relatedModule || 'All'} options={moduleOptions} onChange={(value) => setFilters((current) => ({ ...current, relatedModule: value as TaskFilterState['relatedModule'] }))} />
          <Select label="Status" value={filters.status || 'All'} options={statusOptions} onChange={(value) => setFilters((current) => ({ ...current, status: value as TaskFilterState['status'] }))} />
          <Input label="Due From" value={filters.dueDateFrom || ''} onChange={(value) => setFilters((current) => ({ ...current, dueDateFrom: value }))} />
          <Input label="Due To" value={filters.dueDateTo || ''} onChange={(value) => setFilters((current) => ({ ...current, dueDateTo: value }))} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Toggle label="Overdue Only" checked={Boolean(filters.overdueOnly)} onChange={(checked) => setFilters((current) => ({ ...current, overdueOnly: checked }))} />
          <Toggle label="Critical Only" checked={Boolean(filters.criticalOnly)} onChange={(checked) => setFilters((current) => ({ ...current, criticalOnly: checked }))} />
          <button type="button" onClick={() => setFilters({ priority: 'All', relatedModule: 'All', status: 'All' })} className="industrial-secondary-button text-[10px]">Clear Filters {activeFilters ? `(${activeFilters})` : ''}</button>
        </div>
      </div>

      <div className="bg-white border border-[#b1b5c2]">
        <div className="p-3 border-b border-[#b1b5c2] flex items-center justify-between">
          <h3 className="text-sm font-black uppercase text-[#1e222b]">Task Workflow Queue</h3>
          <span className="text-[10px] text-slate-500 uppercase font-bold">{tasks.length} visible</span>
        </div>
        <div className="max-h-[520px] overflow-auto pos-custom-scroll">
          <table className="w-full min-w-[980px] text-left task-desk-table">
            <thead className="bg-[#1e222b] text-white sticky top-0 z-10">
              <tr>
                {['Task Title', 'Assigned Staff', 'Priority', 'Related Module', 'Related Record', 'Due Time', 'Status', 'Action'].map((heading) => (
                  <th key={heading} className="px-3 py-2 text-[10px] uppercase font-black">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.taskId} className="border-t border-[#d6d9e0] text-[11px] text-slate-700 align-top">
                  <td className="px-3 py-2 font-bold max-w-[260px]"><div className="text-[#1e222b]">{task.title}</div><div className="text-[9px] text-slate-500">{task.taskNumber}</div></td>
                  <td className="px-3 py-2 font-bold">{task.assignedStaffName}</td>
                  <td className="px-3 py-2"><Badge value={task.priority} risk /></td>
                  <td className="px-3 py-2 font-bold">{task.relatedModule}</td>
                  <td className="px-3 py-2 font-bold max-w-[180px] break-words">{task.relatedRecordLabel}</td>
                  <td className="px-3 py-2 font-bold">{task.dueDate} {task.dueTime}</td>
                  <td className="px-3 py-2"><Badge value={task.status} /></td>
                  <td className="px-3 py-2 w-[52px]">
                    <TaskRowActionMenu
                      task={task}
                      openId={openMenuId}
                      setOpenId={setOpenMenuId}
                      can={can}
                      onView={() => void openModal('view', task)}
                      onStartReview={() => void startReview(task)}
                      onNote={() => void openModal('note', task)}
                      onReassign={() => void openModal('reassign', task)}
                      onPendingInfo={() => void openModal('pendingInfo', task)}
                      onEscalate={() => void openModal('escalate', task)}
                      onApproval={() => void openModal('approval', task)}
                      onBI={() => void openModal('bi', task)}
                      onRelated={() => void openModal('related', task)}
                      onComplete={() => void openModal('complete', task)}
                      onClose={() => void openModal('close', task)}
                      onPrint={() => void printTask(task)}
                      onExport={() => void exportTask(task)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <TaskActivityFeed activity={activity} />

      {modal && (
        <TaskWorkflowModal
          modal={modal}
          note={workflowNote}
          onNoteChange={setWorkflowNote}
          reassignTo={reassignTo}
          onReassignToChange={setReassignTo}
          escalationTarget={escalationTarget}
          onEscalationTargetChange={setEscalationTarget}
          onClose={() => setModal(null)}
          onSave={saveWorkflow}
          onStartReview={() => void startReview(modal.task)}
          onPrint={() => void printTask(modal.task)}
        />
      )}
    </div>
  );
}

function TaskRowActionMenu({
  task,
  openId,
  setOpenId,
  can,
  onView,
  onStartReview,
  onNote,
  onReassign,
  onPendingInfo,
  onEscalate,
  onApproval,
  onBI,
  onRelated,
  onComplete,
  onClose,
  onPrint,
  onExport
}: {
  task: TaskRecord;
  openId: string | null;
  setOpenId: (id: string | null) => void;
  can: (permission: PermissionKey) => boolean;
  onView: () => void;
  onStartReview: () => void;
  onNote: () => void;
  onReassign: () => void;
  onPendingInfo: () => void;
  onEscalate: () => void;
  onApproval: () => void;
  onBI: () => void;
  onRelated: () => void;
  onComplete: () => void;
  onClose: () => void;
  onPrint: () => void;
  onExport: () => void;
}) {
  const items: Array<RowActionMenuItem | false> = [
    can('taskDesk.viewDetail') && { label: 'View Task', icon: <Eye className="w-3.5 h-3.5" />, onClick: onView },
    can('taskDesk.startReview') && { label: 'Start Review', icon: <PlayCircle className="w-3.5 h-3.5" />, onClick: onStartReview },
    can('taskDesk.addNote') && { label: 'Add Note', icon: <StickyNote className="w-3.5 h-3.5" />, onClick: onNote },
    can('taskDesk.reassign') && { label: 'Reassign', icon: <RefreshCw className="w-3.5 h-3.5" />, onClick: onReassign },
    can('taskDesk.pendingInfo') && { label: 'Mark Pending Info', icon: <FileText className="w-3.5 h-3.5" />, onClick: onPendingInfo },
    can('taskDesk.escalate') && { label: 'Escalate', icon: <ShieldAlert className="w-3.5 h-3.5" />, onClick: onEscalate },
    can('taskDesk.createApproval') && { label: 'Create Approval', icon: <ClipboardCheck className="w-3.5 h-3.5" />, onClick: onApproval },
    can('taskDesk.createBIWarning') && { label: 'Create BI Warning', icon: <Flag className="w-3.5 h-3.5" />, onClick: onBI },
    can('taskDesk.openRelatedRecord') && { label: 'Open Related Record', icon: <FileText className="w-3.5 h-3.5" />, onClick: onRelated },
    can('taskDesk.complete') && { label: 'Complete Task', icon: <CheckCircle2 className="w-3.5 h-3.5" />, onClick: onComplete },
    can('taskDesk.close') && { label: 'Close Task', icon: <XCircle className="w-3.5 h-3.5" />, danger: true, onClick: onClose },
    can('taskDesk.print') && { label: 'Print Task', icon: <Printer className="w-3.5 h-3.5" />, onClick: onPrint },
    can('taskDesk.export') && { label: 'Export Row', icon: <Download className="w-3.5 h-3.5" />, onClick: onExport }
  ];
  return <RowActionMenu ariaLabel={`Task actions for ${task.taskNumber}`} align="top" open={openId === task.taskId} onOpenChange={(open) => setOpenId(open ? task.taskId : null)} items={items.filter(Boolean) as RowActionMenuItem[]} />;
}

function TaskWorkflowModal({
  modal,
  note,
  onNoteChange,
  reassignTo,
  onReassignToChange,
  escalationTarget,
  onEscalationTargetChange,
  onClose,
  onSave,
  onStartReview,
  onPrint
}: {
  modal: { mode: TaskModalMode; task: TaskRecord };
  note: string;
  onNoteChange: (value: string) => void;
  reassignTo: string;
  onReassignToChange: (value: string) => void;
  escalationTarget: string;
  onEscalationTargetChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
  onStartReview: () => void;
  onPrint: () => void;
}) {
  const { mode, task } = modal;
  const title = mode === 'view' ? 'View Task' : mode === 'related' ? 'Related Record' : mode === 'close' ? 'Close Task' : mode === 'complete' ? 'Complete Task' : mode === 'approval' ? 'Create Approval' : mode === 'bi' ? 'Create BI Warning' : mode === 'pendingInfo' ? 'Mark Pending Info' : mode === 'escalate' ? 'Escalate Task' : mode === 'reassign' ? 'Reassign Task' : 'Add Note';
  return (
    <div className="fixed inset-0 z-[70] bg-slate-950/60 flex items-center justify-center p-4">
      <div className="bg-white border-2 border-[#1e222b] shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-[#b1b5c2] flex items-center justify-between">
          <div><h3 className="text-sm font-black uppercase tracking-wider text-[#1e222b]">{title}</h3><p className="text-[10px] text-slate-500 uppercase">Local workflow state only.</p></div>
          <button type="button" onClick={onClose} className="industrial-secondary-button text-[10px]">Close</button>
        </div>
        <div className="p-4 overflow-y-auto pos-custom-scroll space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <Info label="Task" value={task.title} />
            <Info label="Task Number" value={task.taskNumber} />
            <Info label="Assigned Staff" value={task.assignedStaffName} />
            <Info label="Priority" value={task.priority} />
            <Info label="Related Module" value={task.relatedModule} />
            <Info label="Related Record" value={task.relatedRecordLabel} />
            <Info label="Due" value={`${task.dueDate} ${task.dueTime}`} />
            <Info label="Status" value={task.status} />
            <Info label="Linked BI Advice" value={task.linkedBIAdviceId || 'None'} />
            <Info label="Linked Approval" value={task.linkedApprovalId || 'None'} />
          </div>
          <div className="bg-slate-50 border border-[#b1b5c2] p-3 text-xs text-slate-700">{mode === 'related' ? relatedRecordNarrative(task) : task.description}</div>
          {mode === 'close' && task.status === 'Open' && <div className="bg-amber-50 border border-amber-300 text-amber-900 p-3 text-xs font-bold">This task has not been reviewed. Close anyway?</div>}
          {(task.linkedApprovalId || task.linkedBIAdviceId) && (mode === 'close' || mode === 'complete') && <div className="bg-orange-50 border border-orange-300 text-orange-900 p-3 text-xs font-bold">Linked BI/approval references exist. Owner/Manager override remains local/mock only.</div>}
          {mode === 'reassign' && <Select label="Assign To" value={reassignTo} options={staffOptions} onChange={onReassignToChange} />}
          {mode === 'escalate' && <Select label="Escalation Target" value={escalationTarget} options={escalationTargets} onChange={onEscalationTargetChange} />}
          {mode !== 'view' && mode !== 'related' && <Textarea label="Note / Outcome" value={note} onChange={onNoteChange} />}
          <div className="border border-[#b1b5c2] p-3">
            <h4 className="text-[10px] font-black uppercase text-[#1e222b] mb-2">Activity Timeline</h4>
            <div className="space-y-2 max-h-[180px] overflow-y-auto pos-custom-scroll">
              {(task.auditEvents || []).length ? task.auditEvents.map((event) => <div key={event.eventId} className="text-[10px] border-b border-slate-100 pb-2"><strong>{humanize(event.eventType)}</strong><p>{event.message}</p><span>{event.staffName} / {timeOnly(event.createdAt)}</span></div>) : <div className="text-xs text-slate-500">No activity recorded yet.</div>}
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-3">
            <button type="button" onClick={onStartReview} className="industrial-secondary-button text-[10px]">Start Review</button>
            <button type="button" onClick={onPrint} className="industrial-secondary-button text-[10px]">Print</button>
            {mode !== 'view' && mode !== 'related' && <button type="button" onClick={onSave} className="industrial-primary-button text-[10px]">Save</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

function TaskActivityFeed({ activity }: { activity: TaskActivityEvent[] }) {
  return (
    <div className="bg-white border border-[#b1b5c2] p-4">
      <h3 className="text-sm font-black uppercase text-[#1e222b] mb-3">Task Activity Feed</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[360px] overflow-y-auto pos-custom-scroll">
        {activity.map((event) => (
          <div key={event.eventId} className="border border-[#b1b5c2] p-3">
            <div className="flex items-start justify-between gap-2"><span className="font-black text-[#1e222b] uppercase text-[10px]">{humanize(event.eventType)}</span><span className="text-[9px] text-slate-700 font-bold">{timeOnly(event.createdAt)}</span></div>
            <p className="text-[10.5px] text-slate-800 font-semibold mt-1 leading-snug">{event.message}</p>
            <span className="text-[9px] text-slate-700 uppercase font-black">Operator: {event.staffName}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return <div className="bg-white border border-[#b1b5c2] border-l-4 border-l-orange-500 p-3 min-h-[72px]"><div className="text-[9px] text-orange-700 uppercase tracking-wide">{label}</div><div className="text-xl font-black text-[#1e222b] mt-1">{value}</div></div>;
}

function Badge({ value, risk = false }: { value: string; risk?: boolean }) {
  const tone = risk
    ? value === 'Critical' ? 'bg-rose-50 text-rose-800 border-rose-300' : value === 'High' ? 'bg-amber-50 text-amber-900 border-amber-300' : value === 'Medium' ? 'bg-blue-50 text-blue-800 border-blue-300' : 'bg-slate-100 text-slate-700 border-slate-300'
    : value === 'Closed' || value === 'Completed' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : value === 'Escalated' || value === 'Overdue' ? 'bg-rose-50 text-rose-800 border-rose-300' : value === 'InReview' ? 'bg-blue-50 text-blue-800 border-blue-300' : value === 'PendingInfo' || value === 'WaitingApproval' ? 'bg-amber-50 text-amber-900 border-amber-300' : 'bg-slate-100 text-slate-700 border-slate-300';
  return <span className={`inline-flex px-2 py-0.5 border text-[8px] uppercase font-black ${tone}`}>{value}</span>;
}

function Select<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly T[]; onChange: (value: T) => void }) {
  return <label className="space-y-1"><span className="task-filter-label">{label}</span><select value={value} onChange={(event) => onChange(event.target.value as T)} className="w-full border border-[#b1b5c2] bg-white px-2 py-2 text-[10px] font-bold text-[#1e222b]">{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="space-y-1"><span className="task-filter-label">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} className="w-full border border-[#b1b5c2] bg-white px-2 py-2 text-[10px] font-bold text-[#1e222b]" /></label>;
}

function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="space-y-1 block"><span className="task-filter-label">{label}</span><textarea value={value} onChange={(event) => onChange(event.target.value)} rows={4} className="w-full border border-[#b1b5c2] bg-white px-2 py-2 text-[10px] font-bold text-[#1e222b]" /></label>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="inline-flex items-center gap-2 border border-[#b1b5c2] px-3 py-2 text-[10px] font-bold uppercase"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />{label}</label>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="bg-slate-50 border border-[#b1b5c2] p-2 min-h-[48px]"><span className="block text-[8px] uppercase text-orange-700">{label}</span><span className="block text-[10px] font-black text-[#1e222b] mt-1 break-words">{value}</span></div>;
}

function humanize(value: string): string {
  return value.toLowerCase().split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function timeOnly(value?: string): string {
  if (!value) return 'Pending';
  return value.includes('T') ? value.slice(11, 19) : value;
}

function relatedRecordNarrative(task: TaskRecord): string {
  return `${task.relatedModule} source ${task.relatedRecordLabel} opened in local detail mode. Navigate to the source desk for full workflow context when that module is implemented.`;
}

function taskPrintHtml(task: TaskRecord): string {
  return `<!doctype html><html><head><title>${task.taskNumber}</title><style>body{font-family:Arial,sans-serif;background:#fff;color:#111;margin:32px}h1{font-size:20px;text-transform:uppercase;margin:0 0 4px}p{font-size:12px;color:#444;margin:0 0 18px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #999;padding:8px;text-align:left}th{background:#f1f5f9;text-transform:uppercase}</style></head><body><h1>${task.title}</h1><p>Local task workflow printout.</p><table><tbody><tr><th>Task Number</th><td>${task.taskNumber}</td></tr><tr><th>Assigned</th><td>${task.assignedStaffName}</td></tr><tr><th>Priority</th><td>${task.priority}</td></tr><tr><th>Related Module</th><td>${task.relatedModule}</td></tr><tr><th>Related Record</th><td>${task.relatedRecordLabel}</td></tr><tr><th>Due</th><td>${task.dueDate} ${task.dueTime}</td></tr><tr><th>Status</th><td>${task.status}</td></tr><tr><th>Description</th><td>${task.description}</td></tr><tr><th>Notes</th><td>${task.notes}</td></tr></tbody></table></body></html>`;
}
