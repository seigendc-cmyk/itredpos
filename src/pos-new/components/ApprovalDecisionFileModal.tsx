import {
  Check,
  Download,
  MessageSquare,
  Printer,
  Send,
  ShieldCheck,
  UserCheck,
  X
} from 'lucide-react';
import {
  ApprovalNotificationRecord,
  OperationalApprovalEvent,
  OperationalApprovalRequest
} from '../types';

export type ApprovalDecisionFileAction =
  | 'approve'
  | 'reject'
  | 'info'
  | 'escalate'
  | 'assign'
  | 'notify'
  | 'task'
  | 'bi'
  | 'related';

interface ApprovalDecisionFileModalProps {
  approval: OperationalApprovalRequest;
  events: OperationalApprovalEvent[];
  notifications: ApprovalNotificationRecord[];
  canStartReview: boolean;
  canApprove: boolean;
  canReject: boolean;
  canRequestInfo: boolean;
  canNotify: boolean;
  canOpenChat: boolean;
  onClose: () => void;
  onStartReview: () => void;
  onAction: (action: ApprovalDecisionFileAction) => void;
  onPrint: () => void;
  onExport: () => void;
  onOpenChat: () => void;
}

function dateLabel(value?: string): string {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function valueLabel(value?: string | number): string {
  if (value === undefined || value === null || value === '') return '-';
  return String(value);
}

export default function ApprovalDecisionFileModal({
  approval,
  events,
  notifications,
  canStartReview,
  canApprove,
  canReject,
  canRequestInfo,
  canNotify,
  canOpenChat,
  onClose,
  onStartReview,
  onAction,
  onPrint,
  onExport,
  onOpenChat
}: ApprovalDecisionFileModalProps) {
  const decisionEvents = events.filter((event) => event.approvalId === approval.id);
  const approvalNotifications = notifications.filter((notification) => notification.approvalId === approval.id);
  const hasLinkedTask = decisionEvents.some((event) => event.eventType === 'APPROVAL_TASK_CREATED');
  const hasLinkedBIWarning = decisionEvents.some((event) => event.eventType === 'APPROVAL_BI_WARNING_CREATED');

  return (
    <div className="pos-modal-backdrop">
      <div className="pos-modal pos-modal--wide approval-decision-modal" role="dialog" aria-modal="true" aria-labelledby="approval-decision-file-title">
        <div className="pos-modal__header">
          <div>
            <p className="sci-pos-eyebrow">Decision File</p>
            <h2 id="approval-decision-file-title">{approval.id}</h2>
          </div>
          <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={onClose}>Close</button>
        </div>

        <div className="pos-modal__body approval-decision-modal__body">
          <section className="approval-decision-hero">
            <div>
              <strong>{approval.title || approval.approvalType || approval.category}</strong>
              <span>{approval.context}</span>
            </div>
            <div className="approval-decision-badges">
              <span className="sci-status-pill sci-status-pill--warning">{approval.status}</span>
              <span className="sci-status-pill sci-status-pill--danger">{approval.risk} Risk</span>
              <span className="sci-status-pill">{approval.priority || 'Normal'}</span>
            </div>
          </section>

          <section className="approval-decision-section">
            <div className="sci-pos-card__bar">
              <div>
                <p className="sci-pos-eyebrow">Request</p>
                <h3>Approval Context</h3>
              </div>
            </div>
            <dl className="approval-decision-grid">
              <div><dt>Approval ID</dt><dd>{approval.id}</dd></div>
              <div><dt>Type</dt><dd>{approval.category}</dd></div>
              <div><dt>Requested By</dt><dd>{approval.requestedBy} ({approval.requestedByRole})</dd></div>
              <div><dt>Reviewer</dt><dd>{approval.assignedReviewerName || 'Unassigned'}</dd></div>
              <div><dt>Module</dt><dd>{approval.relatedModule || 'Sales'}</dd></div>
              <div><dt>Record</dt><dd>{approval.relatedRecordLabel || approval.relatedRecord}</dd></div>
              <div><dt>Branch</dt><dd>{approval.branch}</dd></div>
              <div><dt>Terminal</dt><dd>{approval.terminalId || '-'}</dd></div>
              <div><dt>Value</dt><dd>{valueLabel(approval.amountOrValue || approval.valueAmount)}</dd></div>
              <div><dt>Customer</dt><dd>{approval.customerName || approval.customerId || '-'}</dd></div>
              <div><dt>Supplier</dt><dd>{approval.supplierName || approval.supplierId || '-'}</dd></div>
              <div><dt>Requested</dt><dd>{dateLabel(approval.requestedAt)}</dd></div>
              <div><dt>Due</dt><dd>{dateLabel(approval.dueAt)}</dd></div>
              <div><dt>Decision By</dt><dd>{approval.decisionBy || approval.approvedBy || approval.rejectedBy || '-'}</dd></div>
            </dl>
          </section>

          <section className="approval-decision-section">
            <div className="sci-pos-card__bar">
              <div>
                <p className="sci-pos-eyebrow">Risk</p>
                <h3>Reason and Evidence</h3>
              </div>
            </div>
            <div className="approval-decision-notes">
              <div><span>Reason</span><p>{approval.reason || '-'}</p></div>
              <div><span>Business Risk</span><p>{approval.context || '-'}</p></div>
              <div><span>Decision Note</span><p>{approval.decisionNote || '-'}</p></div>
              <div><span>Conditions</span><p>{approval.conditions?.join(', ') || '-'}</p></div>
              <div><span>Linked Task</span><p>{hasLinkedTask ? 'Created from this decision file' : '-'}</p></div>
              <div><span>Linked BI Warning</span><p>{hasLinkedBIWarning ? 'Created from this decision file' : '-'}</p></div>
            </div>
          </section>

          <section className="approval-decision-section">
            <div className="sci-pos-card__bar">
              <div>
                <p className="sci-pos-eyebrow">Audit</p>
                <h3>Decision History</h3>
              </div>
            </div>
            <div className="pos-audit-feed approval-decision-feed">
              {decisionEvents.map((event) => (
                <div key={event.id}>
                  <strong>{event.eventType.replace(/_/g, ' ')}</strong>
                  <span>{event.message}</span>
                  <small>{event.operator} - {dateLabel(event.createdAt)}</small>
                </div>
              ))}
              {decisionEvents.length === 0 && <div className="sci-pos-empty-cell">No decision history recorded.</div>}
            </div>
          </section>

          <section className="approval-decision-section">
            <div className="sci-pos-card__bar">
              <div>
                <p className="sci-pos-eyebrow">Notification</p>
                <h3>Outbox History</h3>
              </div>
            </div>
            <div className="pos-audit-feed approval-decision-feed">
              {approvalNotifications.map((notification) => (
                <div key={notification.id}>
                  <strong>{notification.channel} - {notification.status}</strong>
                  <span>{notification.subject}</span>
                  <small>{notification.recipientName} - {dateLabel(notification.preparedAt)}</small>
                </div>
              ))}
              {approvalNotifications.length === 0 && <div className="sci-pos-empty-cell">No notification history for this approval.</div>}
            </div>
          </section>
        </div>

        <div className="pos-modal__footer approval-decision-footer">
          <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={onStartReview} disabled={!canStartReview}>
            <ShieldCheck size={16} aria-hidden="true" /> Start Review
          </button>
          <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={() => onAction('approve')} disabled={!canApprove || approval.status === 'Approved'}>
            <Check size={16} aria-hidden="true" /> Approve
          </button>
          <button type="button" className="sci-pos-button sci-pos-button--danger" onClick={() => onAction('reject')} disabled={!canReject || approval.status === 'Rejected'}>
            <X size={16} aria-hidden="true" /> Reject
          </button>
          <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => onAction('info')} disabled={!canRequestInfo}>
            <MessageSquare size={16} aria-hidden="true" /> Request Info
          </button>
          <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => onAction('assign')}>
            <UserCheck size={16} aria-hidden="true" /> Assign
          </button>
          <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => onAction('notify')} disabled={!canNotify}>
            <Send size={16} aria-hidden="true" /> Notify
          </button>
          <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={onOpenChat} disabled={!canOpenChat}>
            <MessageSquare size={16} aria-hidden="true" /> Live Chat
          </button>
          <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={onPrint}>
            <Printer size={16} aria-hidden="true" /> Print
          </button>
          <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={onExport}>
            <Download size={16} aria-hidden="true" /> Export Row
          </button>
        </div>
      </div>
    </div>
  );
}
