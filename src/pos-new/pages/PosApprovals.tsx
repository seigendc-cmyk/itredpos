import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Download,
  Eye,
  Filter,
  MessageSquare,
  Printer,
  Search,
  Send,
  ShieldCheck,
  UserCheck,
  X
} from 'lucide-react';
import RowActionMenu, { RowActionMenuItem } from '../components/RowActionMenu';
import ApprovalLiveChatPanel from '../components/ApprovalLiveChatPanel';
import {
  ApprovalNotificationChannel,
  ApprovalNotificationRecord,
  ApprovalStatus,
  OperationalApprovalCategory,
  OperationalApprovalEvent,
  OperationalApprovalRequest,
  PosSession,
  RiskLevel,
  Role
} from '../types';
import {
  assignOperationalApprovalReviewer,
  createApprovalBIWarning,
  createApprovalTask,
  decideOperationalApproval,
  escalateOperationalApproval,
  getOperationalApprovalEvents,
  getOperationalApprovals,
  recordApprovalExport,
  recordApprovalPrint,
  recordApprovalRelatedRecordOpen,
  requestOperationalApprovalInfo,
  startOperationalApprovalReview,
  viewOperationalApproval
} from '../services/approvalService';
import {
  getApprovalNotificationOutbox,
  prepareApprovalNotification,
  sendApprovalNotificationLocal
} from '../services/approvalNotificationService';
import { hasPermission, PermissionKey } from '../utils/posPermissions';

interface PosApprovalsProps {
  session: PosSession;
}

type StatusFilter = 'All' | ApprovalStatus;
type RiskFilter = 'All' | RiskLevel;
type WorkflowMode = 'approve' | 'reject' | 'info' | 'escalate' | 'assign' | 'notify' | 'task' | 'bi' | 'related' | null;

const categories: Array<'All' | OperationalApprovalCategory> = [
  'All',
  'NEW_CUSTOMER',
  'Price Override',
  'Discount Above Limit',
  'Return Request',
  'Credit Note Request',
  'Terminal Activation',
  'Cash Variance Review',
  'Stock Adjustment',
  'Stocktake Variance',
  'Stock Transfer',
  'Inventory Import Approval',
  'Purchase Order',
  'Goods Receiving',
  'Supplier Return',
  'Delivery Provider Approval',
  'Customer Approval'
];

const statusFilters: StatusFilter[] = ['All', 'Pending', 'InReview', 'MoreInfoRequested', 'Escalated', 'Approved', 'Rejected', 'Closed'];
const riskFilters: RiskFilter[] = ['All', 'Low', 'Medium', 'High', 'Critical'];
const permissionBlockedMessage = 'You do not have permission to perform this action.';

function riskClass(risk: RiskLevel): string {
  if (risk === 'Critical') return 'sci-status-pill--danger';
  if (risk === 'High' || risk === 'Medium') return 'sci-status-pill--warning';
  return 'sci-status-pill--success';
}

function statusClass(status: ApprovalStatus): string {
  if (status === 'Approved' || status === 'Closed') return 'sci-status-pill--success';
  if (status === 'Rejected' || status === 'Expired' || status === 'Cancelled') return 'sci-status-pill--danger';
  return 'sci-status-pill--warning';
}

function dateLabel(value?: string): string {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function csvEscape(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function isOverdue(approval: OperationalApprovalRequest): boolean {
  return Boolean(approval.dueAt && new Date(approval.dueAt).getTime() < Date.now() && !['Approved', 'Rejected', 'Closed'].includes(approval.status));
}

export default function PosApprovals({ session }: PosApprovalsProps) {
  const roleName = session.role as Role;
  const operator = session.staffName || 'Admin User';
  const staffId = operator;
  const [approvals, setApprovals] = useState<OperationalApprovalRequest[]>([]);
  const [events, setEvents] = useState<OperationalApprovalEvent[]>([]);
  const [notifications, setNotifications] = useState<ApprovalNotificationRecord[]>([]);
  const [activeCategory, setActiveCategory] = useState<'All' | OperationalApprovalCategory>('All');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedApprovalId, setSelectedApprovalId] = useState<string>('');
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>(null);
  const [workflowNote, setWorkflowNote] = useState('');
  const [reviewerName, setReviewerName] = useState('');
  const [notificationChannel, setNotificationChannel] = useState<ApprovalNotificationChannel>('InApp');
  const [notificationRecipient, setNotificationRecipient] = useState(operator);
  const [notice, setNotice] = useState<string | null>(null);

  const loadData = async () => {
    const [approvalRows, eventRows] = await Promise.all([
      getOperationalApprovals(),
      getOperationalApprovalEvents()
    ]);
    setApprovals(approvalRows);
    setEvents(eventRows);
    setNotifications(getApprovalNotificationOutbox());
    setSelectedApprovalId((current) => current || approvalRows[0]?.id || '');
  };

  useEffect(() => {
    void loadData();
  }, []);

  const can = (permission: PermissionKey) => hasPermission(roleName, permission);

  const filteredApprovals = useMemo(() => approvals.filter((approval) => {
    const categoryMatch = activeCategory === 'All' || approval.category === activeCategory;
    const statusMatch = statusFilter === 'All' || approval.status === statusFilter;
    const riskMatch = riskFilter === 'All' || approval.risk === riskFilter;
    const haystack = [
      approval.id,
      approval.title,
      approval.category,
      approval.requestedBy,
      approval.relatedRecord,
      approval.relatedRecordLabel,
      approval.branch,
      approval.reason,
      approval.context,
      approval.assignedReviewerName
    ].join(' ').toLowerCase();
    const searchMatch = searchTerm.trim().toLowerCase().split(/\s+/).every((part) => haystack.includes(part));
    return categoryMatch && statusMatch && riskMatch && searchMatch;
  }), [activeCategory, approvals, riskFilter, searchTerm, statusFilter]);

  const selectedApproval = approvals.find((approval) => approval.id === selectedApprovalId) || filteredApprovals[0] || null;
  const selectedEvents = selectedApproval ? events.filter((event) => event.approvalId === selectedApproval.id) : events;

  const summary = useMemo(() => ({
    pending: approvals.filter((approval) => approval.status === 'Pending').length,
    inReview: approvals.filter((approval) => approval.status === 'InReview').length,
    highRisk: approvals.filter((approval) => approval.risk === 'High' || approval.risk === 'Critical').length,
    overdue: approvals.filter(isOverdue).length,
    awaitingInfo: approvals.filter((approval) => approval.status === 'MoreInfoRequested').length,
    approvedToday: approvals.filter((approval) => approval.status === 'Approved' && approval.approvedAt?.slice(0, 10) === new Date().toISOString().slice(0, 10)).length
  }), [approvals]);

  const guard = (permission: PermissionKey): boolean => {
    if (can(permission)) return true;
    setNotice(permissionBlockedMessage);
    return false;
  };

  const refresh = async (message?: string) => {
    await loadData();
    if (message) setNotice(message);
  };

  const openWorkflow = (approval: OperationalApprovalRequest, mode: WorkflowMode) => {
    if (!mode) return;
    const permissionByMode: Record<Exclude<WorkflowMode, null>, PermissionKey> = {
      approve: 'approvals.approve',
      reject: 'approvals.reject',
      info: 'approvals.requestInfo',
      escalate: 'approvals.escalate',
      assign: 'approvals.assignReviewer',
      notify: 'approvals.sendNotification',
      task: 'approvals.createTask',
      bi: 'approvals.createBIWarning',
      related: 'approvals.openRelatedRecord'
    };
    if (!guard(permissionByMode[mode])) return;
    setSelectedApprovalId(approval.id);
    setWorkflowMode(mode);
    setWorkflowNote('');
    setReviewerName(approval.assignedReviewerName || operator);
    setNotificationRecipient(approval.assignedReviewerName || approval.requestedBy || operator);
  };

  const handleView = async (approval: OperationalApprovalRequest) => {
    if (!guard('approvals.viewDetail')) return;
    setSelectedApprovalId(approval.id);
    await viewOperationalApproval(approval.id, operator);
    await refresh(`${approval.id} detail loaded.`);
  };

  const handleStartReview = async (approval: OperationalApprovalRequest) => {
    if (!guard('approvals.startReview')) return;
    setSelectedApprovalId(approval.id);
    await startOperationalApprovalReview(approval.id, operator);
    await refresh(`${approval.id} review started.`);
  };

  const submitWorkflow = async () => {
    if (!selectedApproval || !workflowMode) return;
    if (workflowMode === 'approve') await decideOperationalApproval(selectedApproval.id, 'Approved', operator, workflowNote);
    if (workflowMode === 'reject') await decideOperationalApproval(selectedApproval.id, 'Rejected', operator, workflowNote);
    if (workflowMode === 'info') await requestOperationalApprovalInfo(selectedApproval.id, operator, workflowNote);
    if (workflowMode === 'escalate') await escalateOperationalApproval(selectedApproval.id, operator, workflowNote);
    if (workflowMode === 'assign') await assignOperationalApprovalReviewer(selectedApproval.id, operator, reviewerName);
    if (workflowMode === 'task') await createApprovalTask(selectedApproval.id, operator, workflowNote);
    if (workflowMode === 'bi') await createApprovalBIWarning(selectedApproval.id, operator, workflowNote);
    if (workflowMode === 'related') await recordApprovalRelatedRecordOpen(selectedApproval.id, operator);
    if (workflowMode === 'notify') {
      await prepareApprovalNotification({
        approval: selectedApproval,
        channel: notificationChannel,
        recipientName: notificationRecipient,
        recipientAddress: notificationRecipient,
        preparedBy: operator
      });
    }
    const completedMode = workflowMode;
    setWorkflowMode(null);
    setWorkflowNote('');
    await refresh(`${selectedApproval.id} ${completedMode} action recorded locally.`);
  };

  const printApproval = async (approval: OperationalApprovalRequest) => {
    if (!guard('approvals.print')) return;
    const popup = window.open('', '_blank', 'width=860,height=720');
    if (popup) {
      popup.document.write(`<html><head><title>${approval.id}</title></head><body><h1>${approval.id}</h1><p>${approval.title || approval.category}</p><dl><dt>Status</dt><dd>${approval.status}</dd><dt>Risk</dt><dd>${approval.risk}</dd><dt>Related Record</dt><dd>${approval.relatedRecordLabel || approval.relatedRecord}</dd><dt>Reason</dt><dd>${approval.reason}</dd><dt>Context</dt><dd>${approval.context}</dd></dl></body></html>`);
      popup.document.close();
      popup.print();
    }
    await recordApprovalPrint(approval.id, operator);
    await refresh(`${approval.id} print preview opened.`);
  };

  const exportApprovals = async () => {
    if (!guard('approvals.export')) return;
    const rows = filteredApprovals.map((approval) => [
      approval.id,
      approval.title || approval.category,
      approval.requestedBy,
      approval.relatedRecordLabel || approval.relatedRecord,
      approval.amountOrValue,
      approval.risk,
      approval.status,
      approval.assignedReviewerName || '',
      approval.dueAt || ''
    ]);
    const csv = [
      ['Approval ID', 'Type', 'Requested By', 'Related Record', 'Value', 'Risk', 'Status', 'Reviewer', 'Due At'].map(csvEscape).join(','),
      ...rows.map((row) => row.map(csvEscape).join(','))
    ].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `approval-command-centre-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    if (selectedApproval) await recordApprovalExport(selectedApproval.id, operator);
    await refresh('Approval queue exported.');
  };

  const sendNotification = async (notification: ApprovalNotificationRecord) => {
    if (!guard('approvals.sendNotification')) return;
    const rows = await sendApprovalNotificationLocal(notification.id, operator);
    setNotifications(rows);
    await refresh(`${notification.channel} notification marked sent locally.`);
  };

  const rowActions = (approval: OperationalApprovalRequest): RowActionMenuItem[] => [
    { label: 'View Detail', icon: <Eye size={15} />, onClick: () => void handleView(approval), disabled: !can('approvals.viewDetail') },
    { label: 'Start Review', icon: <ShieldCheck size={15} />, onClick: () => void handleStartReview(approval), disabled: !can('approvals.startReview') || approval.status === 'Approved' || approval.status === 'Rejected' },
    { label: 'Approve', icon: <Check size={15} />, onClick: () => openWorkflow(approval, 'approve'), disabled: !can('approvals.approve') || approval.status === 'Approved' || approval.status === 'Rejected' },
    { label: 'Reject', icon: <X size={15} />, onClick: () => openWorkflow(approval, 'reject'), disabled: !can('approvals.reject') || approval.status === 'Approved' || approval.status === 'Rejected', danger: true },
    { label: 'Request Info', icon: <MessageSquare size={15} />, onClick: () => openWorkflow(approval, 'info'), disabled: !can('approvals.requestInfo') },
    { label: 'Escalate', icon: <ShieldCheck size={15} />, onClick: () => openWorkflow(approval, 'escalate'), disabled: !can('approvals.escalate') },
    { label: 'Assign Reviewer', icon: <UserCheck size={15} />, onClick: () => openWorkflow(approval, 'assign'), disabled: !can('approvals.assignReviewer') },
    { label: 'Send Notification', icon: <Send size={15} />, onClick: () => openWorkflow(approval, 'notify'), disabled: !can('approvals.sendNotification') },
    { label: 'Create Task', onClick: () => openWorkflow(approval, 'task'), disabled: !can('approvals.createTask') },
    { label: 'Create BI Warning', onClick: () => openWorkflow(approval, 'bi'), disabled: !can('approvals.createBIWarning') },
    { label: 'Open Related Record', onClick: () => openWorkflow(approval, 'related'), disabled: !can('approvals.openRelatedRecord') },
    { label: 'Print', icon: <Printer size={15} />, onClick: () => void printApproval(approval), disabled: !can('approvals.print') }
  ];

  if (!can('approvals.view')) {
    return <div className="sci-pos-alert" role="alert">You do not have permission to view approvals.</div>;
  }

  return (
    <div className="space-y-5 industrial-font-sans">
      <header className="sci-page-header sci-page-header--compact">
        <div>
          <p className="sci-pos-eyebrow">Industrial Approvals</p>
          <h1>Approvals Command Centre</h1>
          <p>Decision queue for customer, sales, terminal, stock, purchasing, cash, delivery, and accounting approvals.</p>
        </div>
        <div className="sci-page-header__actions">
          <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => {
            const approval = selectedApproval || filteredApprovals[0];
            if (approval) void printApproval(approval);
          }} disabled={!selectedApproval && filteredApprovals.length === 0}>
            <Printer size={16} aria-hidden="true" /> Print
          </button>
          <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={() => void exportApprovals()}>
            <Download size={16} aria-hidden="true" /> Export
          </button>
        </div>
      </header>

      {notice && <div className="sci-pos-alert" role="status">{notice}</div>}

      <section className="pos-approval-summary-grid">
        <Kpi label="Pending" value={summary.pending} />
        <Kpi label="In Review" value={summary.inReview} />
        <Kpi label="High Risk" value={summary.highRisk} tone="danger" />
        <Kpi label="Overdue" value={summary.overdue} tone="danger" />
        <Kpi label="Awaiting Info" value={summary.awaitingInfo} />
        <Kpi label="Approved Today" value={summary.approvedToday} tone="success" />
      </section>

      <section className="sci-pos-card">
        <div className="sci-pos-card__bar">
          <div>
            <p className="sci-pos-eyebrow">Filters</p>
            <h2>Queue Controls</h2>
          </div>
          <Filter size={18} aria-hidden="true" />
        </div>
        <div className="pos-approval-search-row">
          <Search size={17} aria-hidden="true" />
          <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search approval, requester, record, branch, reviewer" />
        </div>
        <div className="pos-approval-filter-row">
          {categories.map((category) => (
            <button key={category} type="button" className={`pos-shift-tab ${activeCategory === category ? 'pos-shift-tab--active' : ''}`} onClick={() => setActiveCategory(category)}>
              {category}
            </button>
          ))}
        </div>
        <div className="pos-approval-filter-row">
          {statusFilters.map((status) => (
            <button key={status} type="button" className={`pos-shift-tab ${statusFilter === status ? 'pos-shift-tab--active' : ''}`} onClick={() => setStatusFilter(status)}>
              {status}
            </button>
          ))}
          {riskFilters.map((risk) => (
            <button key={risk} type="button" className={`pos-shift-tab ${riskFilter === risk ? 'pos-shift-tab--active' : ''}`} onClick={() => setRiskFilter(risk)}>
              {risk}
            </button>
          ))}
        </div>
      </section>

      <div className="pos-approval-layout">
        <section className="sci-pos-card">
          <div className="sci-pos-card__bar">
            <div>
              <p className="sci-pos-eyebrow">Queue</p>
              <h2>Approval Requests</h2>
            </div>
            <span className="sci-status-pill sci-status-pill--warning">{filteredApprovals.length} Visible</span>
          </div>
          <div className="sci-pos-table-wrap">
            <table className="sci-pos-table">
              <thead>
                <tr>
                  <th>Approval ID</th>
                  <th>Type</th>
                  <th>Requested By</th>
                  <th>Related Record</th>
                  <th>Value</th>
                  <th>Risk</th>
                  <th>Status</th>
                  <th>Due</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredApprovals.map((approval) => (
                  <tr key={approval.id} className={selectedApproval?.id === approval.id ? 'pos-approval-row--selected' : ''} onClick={() => setSelectedApprovalId(approval.id)}>
                    <td className="sci-pos-table__strong">{approval.id}</td>
                    <td>{approval.title || approval.category}</td>
                    <td>{approval.requestedBy}</td>
                    <td>{approval.relatedRecordLabel || approval.relatedRecord}</td>
                    <td>{approval.amountOrValue}</td>
                    <td><span className={`sci-status-pill ${riskClass(approval.risk)}`}>{approval.risk}</span></td>
                    <td><span className={`sci-status-pill ${statusClass(approval.status)}`}>{approval.status}</span></td>
                    <td>{dateLabel(approval.dueAt)}</td>
                    <td>
                      <RowActionMenu
                        ariaLabel={`Approval actions for ${approval.id}`}
                        align="top"
                        open={openActionMenuId === approval.id}
                        onOpenChange={(open) => setOpenActionMenuId(open ? approval.id : null)}
                        items={rowActions(approval)}
                      />
                    </td>
                  </tr>
                ))}
                {filteredApprovals.length === 0 && <tr><td colSpan={9} className="sci-pos-empty-cell">No approvals match the selected filters.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="pos-approval-context">
          {selectedApproval ? (
            <>
              <section className="sci-pos-card">
                <div className="sci-pos-card__bar">
                  <div>
                    <p className="sci-pos-eyebrow">Decision File</p>
                    <h2>{selectedApproval.id}</h2>
                  </div>
                  <span className={`sci-status-pill ${statusClass(selectedApproval.status)}`}>{selectedApproval.status}</span>
                </div>
                <div className="pos-approval-detail">
                  <strong>{selectedApproval.title || selectedApproval.category}</strong>
                  <span>{selectedApproval.context}</span>
                  <dl>
                    <div><dt>Branch</dt><dd>{selectedApproval.branch}</dd></div>
                    <div><dt>Requested By</dt><dd>{selectedApproval.requestedBy} ({selectedApproval.requestedByRole})</dd></div>
                    <div><dt>Reviewer</dt><dd>{selectedApproval.assignedReviewerName || 'Unassigned'}</dd></div>
                    <div><dt>Related Module</dt><dd>{selectedApproval.relatedModule || 'Sales'}</dd></div>
                    <div><dt>Related Record</dt><dd>{selectedApproval.relatedRecordLabel || selectedApproval.relatedRecord}</dd></div>
                    <div><dt>Reason</dt><dd>{selectedApproval.reason}</dd></div>
                    <div><dt>Requested</dt><dd>{dateLabel(selectedApproval.requestedAt)}</dd></div>
                    <div><dt>Due</dt><dd>{dateLabel(selectedApproval.dueAt)}</dd></div>
                  </dl>
                  <div className="pos-approval-actions">
                    <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => void handleStartReview(selectedApproval)} disabled={!can('approvals.startReview')}>
                      Start Review
                    </button>
                    <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={() => openWorkflow(selectedApproval, 'approve')} disabled={!can('approvals.approve') || selectedApproval.status === 'Approved'}>
                      <Check size={16} aria-hidden="true" /> Approve
                    </button>
                    <button type="button" className="sci-pos-button sci-pos-button--danger" onClick={() => openWorkflow(selectedApproval, 'reject')} disabled={!can('approvals.reject') || selectedApproval.status === 'Rejected'}>
                      <X size={16} aria-hidden="true" /> Reject
                    </button>
                    <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => openWorkflow(selectedApproval, 'info')}>Request Info</button>
                    <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => openWorkflow(selectedApproval, 'notify')}>Notify</button>
                  </div>
                </div>
              </section>

              {can('approvals.liveChat.view') && (
                <ApprovalLiveChatPanel
                  approvalId={selectedApproval.id}
                  staffId={staffId}
                  staffName={operator}
                  staffRole={roleName}
                  canSend={can('approvals.liveChat.send')}
                  onActivity={() => void loadData()}
                />
              )}
            </>
          ) : (
            <section className="sci-pos-card"><div className="sci-pos-empty-cell">Select an approval to inspect.</div></section>
          )}
        </aside>
      </div>

      <div className="pos-approval-layout">
        <section className="sci-pos-card">
          <div className="sci-pos-card__bar"><div><p className="sci-pos-eyebrow">Audit Trail</p><h2>Approval Activity</h2></div></div>
          <div className="pos-audit-feed">
            {selectedEvents.map((event) => (
              <div key={event.id}>
                <strong>{event.eventType.replace(/_/g, ' ')}</strong>
                <span>{event.message}</span>
                <small>{event.operator} • {dateLabel(event.createdAt)}</small>
              </div>
            ))}
            {selectedEvents.length === 0 && <div className="sci-pos-empty-cell">No approval activity recorded.</div>}
          </div>
        </section>

        <section className="sci-pos-card">
          <div className="sci-pos-card__bar"><div><p className="sci-pos-eyebrow">Notifications</p><h2>Outbox</h2></div></div>
          <div className="pos-audit-feed">
            {notifications.slice(0, 8).map((notification) => (
              <div key={notification.id}>
                <strong>{notification.channel} • {notification.status}</strong>
                <span>{notification.subject}</span>
                <small>{notification.recipientName} • {dateLabel(notification.preparedAt)}</small>
                {notification.waLink && <a href={notification.waLink} target="_blank" rel="noreferrer">Open WhatsApp link</a>}
                <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => void sendNotification(notification)} disabled={notification.status !== 'Prepared'}>
                  Mark Sent Local
                </button>
              </div>
            ))}
            {notifications.length === 0 && <div className="sci-pos-empty-cell">No notification records yet.</div>}
          </div>
        </section>
      </div>

      {workflowMode && selectedApproval && (
        <WorkflowModal
          mode={workflowMode}
          approval={selectedApproval}
          note={workflowNote}
          reviewerName={reviewerName}
          channel={notificationChannel}
          recipient={notificationRecipient}
          onNoteChange={setWorkflowNote}
          onReviewerChange={setReviewerName}
          onChannelChange={setNotificationChannel}
          onRecipientChange={setNotificationRecipient}
          onCancel={() => setWorkflowMode(null)}
          onSubmit={() => void submitWorkflow()}
        />
      )}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone?: 'success' | 'danger' }) {
  return (
    <div>
      <span>{label}</span>
      <strong className={tone === 'danger' ? 'text-red-600' : tone === 'success' ? 'text-emerald-700' : ''}>{value}</strong>
    </div>
  );
}

function WorkflowModal({
  mode,
  approval,
  note,
  reviewerName,
  channel,
  recipient,
  onNoteChange,
  onReviewerChange,
  onChannelChange,
  onRecipientChange,
  onCancel,
  onSubmit
}: {
  mode: Exclude<WorkflowMode, null>;
  approval: OperationalApprovalRequest;
  note: string;
  reviewerName: string;
  channel: ApprovalNotificationChannel;
  recipient: string;
  onNoteChange: (value: string) => void;
  onReviewerChange: (value: string) => void;
  onChannelChange: (value: ApprovalNotificationChannel) => void;
  onRecipientChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const titleByMode: Record<Exclude<WorkflowMode, null>, string> = {
    approve: 'Approve Request',
    reject: 'Reject Request',
    info: 'Request Information',
    escalate: 'Escalate Approval',
    assign: 'Assign Reviewer',
    notify: 'Prepare Notification',
    task: 'Create Task',
    bi: 'Create BI Warning',
    related: 'Open Related Record'
  };
  return (
    <div className="pos-modal-backdrop">
      <div className="pos-modal pos-modal--wide" role="dialog" aria-modal="true" aria-labelledby="approval-workflow-title">
        <div className="pos-modal__header">
          <div>
            <p className="sci-pos-eyebrow">{approval.id}</p>
            <h2 id="approval-workflow-title">{titleByMode[mode]}</h2>
          </div>
          <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={onCancel}>Close</button>
        </div>
        <div className="pos-modal__body space-y-4">
          <div className="pos-approval-detail">
            <strong>{approval.title || approval.category}</strong>
            <span>{approval.relatedRecordLabel || approval.relatedRecord} • {approval.risk} risk • {approval.status}</span>
          </div>
          {mode === 'assign' && (
            <label className="pos-approval-note">
              Reviewer
              <input value={reviewerName} onChange={(event) => onReviewerChange(event.target.value)} />
            </label>
          )}
          {mode === 'notify' && (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="pos-approval-note">
                Channel
                <select value={channel} onChange={(event) => onChannelChange(event.target.value as ApprovalNotificationChannel)}>
                  <option value="InApp">In App</option>
                  <option value="WhatsAppLink">WhatsApp Link</option>
                  <option value="EmailPreview">Email Preview</option>
                  <option value="SMSPreview">SMS Preview</option>
                  <option value="StaffInbox">Staff Inbox</option>
                </select>
              </label>
              <label className="pos-approval-note">
                Recipient
                <input value={recipient} onChange={(event) => onRecipientChange(event.target.value)} />
              </label>
            </div>
          )}
          <label className="pos-approval-note">
            Note
            <textarea rows={5} value={note} onChange={(event) => onNoteChange(event.target.value)} placeholder="Record the decision context, evidence request, escalation reason, or task instruction" />
          </label>
        </div>
        <div className="pos-modal__footer">
          <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={onCancel}>Cancel</button>
          <button type="button" className={`sci-pos-button ${mode === 'reject' ? 'sci-pos-button--danger' : 'sci-pos-button--primary'}`} onClick={onSubmit}>
            Record Action
          </button>
        </div>
      </div>
    </div>
  );
}
