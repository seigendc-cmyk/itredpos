import { useEffect, useMemo, useState } from 'react';
import { Check, Eye, Filter, ShieldCheck, X } from 'lucide-react';
import {
  OperationalApprovalCategory,
  OperationalApprovalEvent,
  OperationalApprovalRequest,
  PosSession,
  RiskLevel,
  Role
} from '../types';
import {
  decideOperationalApproval,
  getOperationalApprovalEvents,
  getOperationalApprovals,
  viewOperationalApproval
} from '../services/approvalService';
import { approveCustomer, rejectCustomer } from '../services/customerService';
import { hasPermission } from '../utils/posPermissions';

interface PosApprovalsProps {
  session: PosSession;
}

type StatusFilter = 'All' | 'Pending' | 'Approved' | 'Rejected';
type RiskFilter = 'All' | RiskLevel;

const categories: Array<'All' | OperationalApprovalCategory> = [
  'All',
  'Price Override',
  'Discount Above Limit',
  'Return Request',
  'Credit Note Request',
  'Terminal Activation',
  'Cash Variance Review',
  'Stock Adjustment',
  'Stocktake Variance',
  'Inventory Import Approval',
  'Delivery Provider Approval',
  'Customer Approval'
];

const statusFilters: StatusFilter[] = ['All', 'Pending', 'Approved', 'Rejected'];
const riskFilters: RiskFilter[] = ['All', 'Low', 'Medium', 'High', 'Critical'];
const permissionBlockedMessage = 'You do not have permission to perform this action.';

function riskClass(risk: RiskLevel): string {
  if (risk === 'Critical') return 'sci-status-pill--danger';
  if (risk === 'High') return 'sci-status-pill--warning';
  if (risk === 'Medium') return 'sci-status-pill--warning';
  return 'sci-status-pill--success';
}

function statusClass(status: OperationalApprovalRequest['status']): string {
  if (status === 'Approved') return 'sci-status-pill--success';
  if (status === 'Rejected') return 'sci-status-pill--danger';
  return 'sci-status-pill--warning';
}

function moneylessDate(value: string): string {
  return new Date(value).toLocaleString();
}

export default function PosApprovals({ session }: PosApprovalsProps) {
  const roleName = session.role as Role;
  const operator = session.staffName || 'Admin User';
  const [approvals, setApprovals] = useState<OperationalApprovalRequest[]>([]);
  const [events, setEvents] = useState<OperationalApprovalEvent[]>([]);
  const [activeCategory, setActiveCategory] = useState<'All' | OperationalApprovalCategory>('All');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('Pending');
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('All');
  const [selectedApprovalId, setSelectedApprovalId] = useState<string>('');
  const [decisionNote, setDecisionNote] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const loadApprovals = async () => {
    const [approvalRows, eventRows] = await Promise.all([
      getOperationalApprovals(),
      getOperationalApprovalEvents()
    ]);
    setApprovals(approvalRows);
    setEvents(eventRows);
    setSelectedApprovalId((current) => current || approvalRows[0]?.id || '');
  };

  useEffect(() => {
    void loadApprovals();
  }, []);

  const filteredApprovals = useMemo(() => approvals.filter((approval) => {
    const categoryMatch = activeCategory === 'All' || approval.category === activeCategory;
    const statusMatch = statusFilter === 'All' || approval.status === statusFilter;
    const riskMatch = riskFilter === 'All' || approval.risk === riskFilter;
    return categoryMatch && statusMatch && riskMatch;
  }), [activeCategory, approvals, riskFilter, statusFilter]);

  const selectedApproval = approvals.find((approval) => approval.id === selectedApprovalId) || filteredApprovals[0] || null;
  const pendingCount = approvals.filter((approval) => approval.status === 'Pending').length;
  const highRiskCount = approvals.filter((approval) => approval.status === 'Pending' && (approval.risk === 'High' || approval.risk === 'Critical')).length;
  const approvedCount = approvals.filter((approval) => approval.status === 'Approved').length;
  const rejectedCount = approvals.filter((approval) => approval.status === 'Rejected').length;

  const handleViewContext = async (approval: OperationalApprovalRequest) => {
    if (!hasPermission(roleName, 'approvals.view')) {
      setNotice(permissionBlockedMessage);
      return;
    }
    setSelectedApprovalId(approval.id);
    setNotice(`${approval.category} context loaded.`);
    await viewOperationalApproval(approval.id, operator);
    setEvents(await getOperationalApprovalEvents());
  };

  const handleDecision = async (approval: OperationalApprovalRequest, decision: 'Approved' | 'Rejected') => {
    const permission = decision === 'Approved' ? 'approvals.approve' : 'approvals.reject';
    if (!hasPermission(roleName, permission)) {
      setNotice(permissionBlockedMessage);
      return;
    }
    const updated = await decideOperationalApproval(approval.id, decision, operator, decisionNote.trim());
    if (approval.category === 'Customer Approval') {
      if (decision === 'Approved') {
        await approveCustomer(approval.relatedRecord, operator, decisionNote.trim() || 'Approved from Approvals Desk.');
      } else {
        await rejectCustomer(approval.relatedRecord, operator, decisionNote.trim() || 'Rejected from Approvals Desk.');
      }
    }
    setApprovals(updated);
    setEvents(await getOperationalApprovalEvents());
    setNotice(`${approval.category} ${decision.toLowerCase()}.`);
    setDecisionNote('');
  };

  return (
    <div className="space-y-5 industrial-font-sans">
      <header className="sci-page-header sci-page-header--compact">
        <div>
          <p className="sci-pos-eyebrow">Operational Review</p>
          <h1>Approvals</h1>
          <p>Central queue for price, discount, return, credit note, terminal, cash, stock, delivery, and customer approvals.</p>
        </div>
        <div className="sci-page-header__actions">
          <span className="sci-status-pill sci-status-pill--warning">{pendingCount} Pending</span>
          <span className="sci-status-pill sci-status-pill--danger">{highRiskCount} High Risk</span>
        </div>
      </header>

      {notice && <div className="sci-pos-alert" role="status">{notice}</div>}

      <section className="pos-approval-summary-grid">
        <div>
          <span>Pending</span>
          <strong>{pendingCount}</strong>
        </div>
        <div>
          <span>High Risk</span>
          <strong>{highRiskCount}</strong>
        </div>
        <div>
          <span>Approved</span>
          <strong>{approvedCount}</strong>
        </div>
        <div>
          <span>Rejected</span>
          <strong>{rejectedCount}</strong>
        </div>
      </section>

      <section className="sci-pos-card">
        <div className="sci-pos-card__bar">
          <div>
            <p className="sci-pos-eyebrow">Filters</p>
            <h2>Approval Types</h2>
          </div>
          <Filter size={18} aria-hidden="true" />
        </div>
        <div className="pos-approval-filter-row">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              className={`pos-shift-tab ${activeCategory === category ? 'pos-shift-tab--active' : ''}`}
              onClick={() => setActiveCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>
        <div className="pos-approval-filter-row">
          {statusFilters.map((status) => (
            <button
              key={status}
              type="button"
              className={`pos-shift-tab ${statusFilter === status ? 'pos-shift-tab--active' : ''}`}
              onClick={() => setStatusFilter(status)}
            >
              {status}
            </button>
          ))}
          {riskFilters.map((risk) => (
            <button
              key={risk}
              type="button"
              className={`pos-shift-tab ${riskFilter === risk ? 'pos-shift-tab--active' : ''}`}
              onClick={() => setRiskFilter(risk)}
            >
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
            <ShieldCheck size={18} aria-hidden="true" />
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
                  <th>Requested At</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredApprovals.map((approval) => (
                  <tr key={approval.id} className={selectedApproval?.id === approval.id ? 'pos-approval-row--selected' : ''}>
                    <td className="sci-pos-table__strong">{approval.id}</td>
                    <td>{approval.category}</td>
                    <td>{approval.requestedBy}</td>
                    <td>{approval.relatedRecord}</td>
                    <td>{approval.amountOrValue}</td>
                    <td><span className={`sci-status-pill ${riskClass(approval.risk)}`}>{approval.risk}</span></td>
                    <td><span className={`sci-status-pill ${statusClass(approval.status)}`}>{approval.status}</span></td>
                    <td>{moneylessDate(approval.requestedAt)}</td>
                    <td>
                      <div className="pos-approval-actions">
                        <ApprovalButton icon={Eye} label="View Context" onClick={() => handleViewContext(approval)} />
                        <ApprovalButton icon={Check} label="Approve" onClick={() => handleDecision(approval, 'Approved')} disabled={approval.status !== 'Pending'} />
                        <ApprovalButton icon={X} label="Reject" onClick={() => handleDecision(approval, 'Rejected')} disabled={approval.status !== 'Pending'} />
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredApprovals.length === 0 && (
                  <tr>
                    <td colSpan={9} className="sci-pos-empty-cell">No approvals match the selected filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="sci-pos-card pos-approval-context">
          <div className="sci-pos-card__bar">
            <div>
              <p className="sci-pos-eyebrow">Context</p>
              <h2>Review Detail</h2>
            </div>
          </div>
          {selectedApproval ? (
            <div className="pos-approval-detail">
              <strong>{selectedApproval.category}</strong>
              <span>{selectedApproval.context}</span>
              <dl>
                <div><dt>Approval ID</dt><dd>{selectedApproval.id}</dd></div>
                <div><dt>Related Record</dt><dd>{selectedApproval.relatedRecord}</dd></div>
                <div><dt>Requested By</dt><dd>{selectedApproval.requestedBy} ({selectedApproval.requestedByRole})</dd></div>
                <div><dt>Reason</dt><dd>{selectedApproval.reason}</dd></div>
                <div><dt>Value</dt><dd>{selectedApproval.amountOrValue}</dd></div>
                <div><dt>Branch</dt><dd>{selectedApproval.branch}</dd></div>
              </dl>
              <label className="pos-approval-note">
                Decision Note
                <textarea rows={4} value={decisionNote} onChange={(event) => setDecisionNote(event.target.value)} />
              </label>
              <div className="pos-approval-actions">
                <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={() => handleDecision(selectedApproval, 'Approved')} disabled={selectedApproval.status !== 'Pending'}>
                  <Check size={16} aria-hidden="true" />
                  Approve
                </button>
                <button type="button" className="sci-pos-button sci-pos-button--danger" onClick={() => handleDecision(selectedApproval, 'Rejected')} disabled={selectedApproval.status !== 'Pending'}>
                  <X size={16} aria-hidden="true" />
                  Reject
                </button>
              </div>
            </div>
          ) : (
            <div className="sci-pos-empty-cell">Select an approval request to review context.</div>
          )}
        </aside>
      </div>

      <section className="sci-pos-card">
        <div className="sci-pos-card__bar">
          <div>
            <p className="sci-pos-eyebrow">Audit</p>
            <h2>Approval Activity</h2>
          </div>
        </div>
        <div className="pos-audit-feed">
          {events.map((event) => (
            <div key={event.id}>
              <strong>{event.eventType.replace(/_/g, ' ')}</strong>
              <span>{event.message}</span>
              <small>{moneylessDate(event.createdAt)}</small>
            </div>
          ))}
          {events.length === 0 && <div className="sci-pos-empty-cell">No approval activity recorded.</div>}
        </div>
      </section>
    </div>
  );
}

function ApprovalButton({
  icon: Icon,
  label,
  onClick,
  disabled = false
}: {
  icon: typeof Eye;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="sci-pos-button sci-pos-button--secondary">
      <Icon size={15} aria-hidden="true" />
      {label}
    </button>
  );
}
