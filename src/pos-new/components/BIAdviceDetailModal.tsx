import { useState } from 'react';
import { ClipboardList, X } from 'lucide-react';
import type { BIAdviceActivityEvent, BIAdviceRecord, BIShelfStocktakeAssignment } from '../types';

interface BIAdviceDetailModalProps {
  advice: BIAdviceRecord | null;
  activity: BIAdviceActivityEvent[];
  shelfAssignment?: BIShelfStocktakeAssignment | null;
  onAssign: () => void;
  onCreateTask: () => void;
  onStartStocktake: () => void;
  onResolve: () => void;
  onDismiss: () => void;
  onEscalate: () => void;
  onClose: () => void;
}

type DetailTab = 'Narrative' | 'Source Trigger' | 'Action Points' | 'Assignment' | 'History';

const tabs: DetailTab[] = ['Narrative', 'Source Trigger', 'Action Points', 'Assignment', 'History'];

export default function BIAdviceDetailModal({
  advice,
  activity,
  shelfAssignment,
  onAssign,
  onCreateTask,
  onStartStocktake,
  onResolve,
  onDismiss,
  onEscalate,
  onClose
}: BIAdviceDetailModalProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('Narrative');
  if (!advice) return null;

  return (
    <div className="shift-control-modal-backdrop" role="presentation">
      <section className="shift-control-modal shift-control-modal--wide" role="dialog" aria-modal="true" aria-labelledby="bi-advice-detail-title">
        <header className="shift-control-modal__header">
          <div>
            <p className="sci-pos-eyebrow">{advice.adviceNumber} / {advice.category}</p>
            <h2 id="bi-advice-detail-title"><ClipboardList size={18} aria-hidden="true" /> BI Advice Detail</h2>
          </div>
          <button type="button" className="sci-icon-button" onClick={onClose} aria-label="Close BI advice detail">
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="shift-history-tabs" role="tablist" aria-label="BI advice detail tabs">
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
              <small>Business risk: {advice.riskLevel} / Priority: {advice.priority}</small>
              <small>Rule trigger: {advice.sourceTriggerId}</small>
              <small>Recommended action: {advice.recommendedAction}</small>
            </div>
          )}
          {activeTab === 'Source Trigger' && (
            <div className="shift-history-detail-grid">
              <div><span>Source Module</span><strong>{advice.sourceModule}</strong></div>
              <div><span>Source Trigger</span><strong>{advice.sourceTriggerId}</strong></div>
              <div><span>Source Log</span><strong>{advice.sourceLogId || advice.sourceTriggerId}</strong></div>
              <div><span>Product</span><strong>{advice.productName || 'Not linked'}</strong></div>
              <div><span>SKU</span><strong>{advice.sku || 'Not linked'}</strong></div>
              <div><span>Risk</span><strong>{advice.riskLevel}</strong></div>
              <div><span>Priority</span><strong>{advice.priority}</strong></div>
            </div>
          )}
          {activeTab === 'Action Points' && (
            <div className="bi-advice-action-list">
              {advice.actionPoints.map((point) => (
                <article key={point.actionPointId}>
                  <strong>{point.label}</strong>
                  <span>{point.actionType} / {point.status}</span>
                  <p>{point.description}</p>
                  <small>Assigned: {point.assignedToRole || point.assignedToStaffId || 'Unassigned'} / Due: {point.dueDate || 'No due date'}</small>
                </article>
              ))}
            </div>
          )}
          {activeTab === 'Assignment' && (
            <div className="shift-history-detail-grid">
              <div><span>Assigned Staff</span><strong>{advice.assignedToStaffName || shelfAssignment?.assignedStaffName || 'Unassigned'}</strong></div>
              <div><span>Assigned Role</span><strong>{advice.assignedToRole || 'Unassigned'}</strong></div>
              <div><span>Assigned Desk</span><strong>{advice.assignedDesk || 'Unrouted'}</strong></div>
              <div><span>Due Date</span><strong>{advice.dueDate || shelfAssignment?.assignedDate || 'No due date'}</strong></div>
              <div><span>Shelf</span><strong>{advice.shelfLocation || shelfAssignment?.shelfLocation || 'Not linked'}</strong></div>
              <div><span>Status</span><strong>{advice.status}</strong></div>
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
              {activity.length === 0 && <div className="sci-pos-empty-cell">No advice history recorded.</div>}
            </div>
          )}
          <footer className="shift-control-modal__footer">
            <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={onAssign}>Assign Staff</button>
            <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={onCreateTask}>Create Task</button>
            <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={onStartStocktake}>Start Stocktake</button>
            <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={onResolve}>Resolve</button>
            <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={onDismiss}>Dismiss</button>
            <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={onEscalate}>Escalate</button>
            <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={onClose}>Close</button>
          </footer>
        </div>
      </section>
    </div>
  );
}
