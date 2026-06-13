import { useState } from 'react';
import { ClipboardList, X } from 'lucide-react';
import type { BIManagementActivityEvent, BIManagementAdvice } from '../types';

interface BIManagementAdviceDetailModalProps {
  advice: BIManagementAdvice | null;
  activity: BIManagementActivityEvent[];
  onStart: (advice: BIManagementAdvice) => void;
  onResolve: (advice: BIManagementAdvice) => void;
  onDismiss: (advice: BIManagementAdvice) => void;
  onEscalate: (advice: BIManagementAdvice) => void;
  onPrint: (advice: BIManagementAdvice) => void;
  onClose: () => void;
}

type DetailTab = 'Narrative' | 'Business Risk' | 'Source Logs' | 'Recommended Action' | 'Action Points' | 'Assignment' | 'History';

const tabs: DetailTab[] = ['Narrative', 'Business Risk', 'Source Logs', 'Recommended Action', 'Action Points', 'Assignment', 'History'];

export default function BIManagementAdviceDetailModal({
  advice,
  activity,
  onStart,
  onResolve,
  onDismiss,
  onEscalate,
  onPrint,
  onClose
}: BIManagementAdviceDetailModalProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('Narrative');
  if (!advice) return null;

  return (
    <div className="shift-control-modal-backdrop" role="presentation">
      <section className="shift-control-modal shift-control-modal--wide bi-management-detail-modal" role="dialog" aria-modal="true" aria-labelledby="bi-management-advice-title">
        <header className="shift-control-modal__header">
          <div>
            <p className="sci-pos-eyebrow">{advice.adviceNumber} / {advice.domain}</p>
            <h2 id="bi-management-advice-title"><ClipboardList size={18} aria-hidden="true" /> Management Advice Detail</h2>
          </div>
          <button type="button" className="sci-icon-button" onClick={onClose} aria-label="Close management advice detail">
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="shift-history-tabs" role="tablist" aria-label="BI management advice detail tabs">
          {tabs.map((tab) => (
            <button key={tab} type="button" className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>
              {tab}
            </button>
          ))}
        </div>

        <div className="shift-control-modal__body">
          {activeTab === 'Narrative' && (
            <div className="bi-advice-narrative">
              <strong>{advice.title}</strong>
              <p>{advice.narrative}</p>
              <small>Priority: {advice.priority} / Status: {advice.status}</small>
            </div>
          )}
          {activeTab === 'Business Risk' && (
            <div className="bi-advice-narrative">
              <strong>Why this matters</strong>
              <p>{advice.businessRisk}</p>
              <small>Risk if ignored: cash leakage, stock loss, false EOD control, compliance exposure, or unmanaged staff behaviour.</small>
            </div>
          )}
          {activeTab === 'Source Logs' && (
            <div className="shift-history-detail-grid">
              <div><span>Rule Code</span><strong>{advice.sourceRuleCode}</strong></div>
              <div><span>Trigger ID</span><strong>{advice.sourceTriggerId}</strong></div>
              <div><span>Module</span><strong>{advice.relatedModule}</strong></div>
              <div><span>Record</span><strong>{advice.relatedRecordId || 'Local / derived'}</strong></div>
              <div><span>Product</span><strong>{advice.productName || 'Not linked'}</strong></div>
              <div><span>SKU</span><strong>{advice.sku || 'Not linked'}</strong></div>
              <div><span>Staff</span><strong>{advice.staffName || 'Not linked'}</strong></div>
              <div><span>Customer</span><strong>{advice.customerName || 'Not linked'}</strong></div>
            </div>
          )}
          {activeTab === 'Recommended Action' && (
            <div className="bi-advice-narrative">
              <strong>{advice.recommendedAction}</strong>
              <p>Owner or assigned staff must record evidence that the trigger was reviewed and that the business risk has been controlled.</p>
              <small>Resolution proof should mention who checked it, what was checked, and what changed.</small>
            </div>
          )}
          {activeTab === 'Action Points' && (
            <div className="bi-advice-action-list">
              {advice.actionPoints.map((point) => (
                <article key={point.actionPointId}>
                  <strong>{point.label}</strong>
                  <span>{point.assignedDesk} / {point.status}</span>
                  <p>{point.description}</p>
                  <small>Assigned Role: {point.assignedRole} / Due: {point.dueDate}</small>
                  {point.resultNote && <small>Result: {point.resultNote}</small>}
                </article>
              ))}
            </div>
          )}
          {activeTab === 'Assignment' && (
            <div className="shift-history-detail-grid">
              <div><span>Desk</span><strong>{advice.assignedDesk}</strong></div>
              <div><span>Role</span><strong>{advice.assignedRole}</strong></div>
              <div><span>Staff ID</span><strong>{advice.assignedStaffId || 'Unassigned'}</strong></div>
              <div><span>Due Date</span><strong>{advice.dueDate || 'No due date'}</strong></div>
              <div><span>Branch</span><strong>{advice.branchName || 'All branches'}</strong></div>
              <div><span>Terminal</span><strong>{advice.terminalName || 'All terminals'}</strong></div>
            </div>
          )}
          {activeTab === 'History' && (
            <div className="bi-activity-list">
              {activity.map((event) => (
                <div key={event.eventId}>
                  <span>{new Date(event.createdAt).toLocaleString()}</span>
                  <strong>{event.eventType}</strong>
                  <p>{event.message}</p>
                </div>
              ))}
              {activity.length === 0 && <div className="sci-pos-empty-cell">No management advice history recorded.</div>}
            </div>
          )}

          <footer className="shift-control-modal__footer">
            <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => onStart(advice)}>Start</button>
            <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={() => onResolve(advice)}>Resolve</button>
            <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => onDismiss(advice)}>Dismiss</button>
            <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => onEscalate(advice)}>Escalate</button>
            <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => onPrint(advice)}>Print Advice</button>
            <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={onClose}>Close</button>
          </footer>
        </div>
      </section>
    </div>
  );
}
