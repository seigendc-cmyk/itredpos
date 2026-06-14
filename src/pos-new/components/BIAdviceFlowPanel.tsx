import { MoreVertical, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { BIAdviceCategory, BIAdviceFilterState, BIAdvicePriority, BIAdviceRecord, BIAdviceStatus } from '../types';

interface BIAdviceFlowPanelProps {
  records: BIAdviceRecord[];
  filters: BIAdviceFilterState;
  onFiltersChange: (filters: BIAdviceFilterState) => void;
  onGenerate: () => void;
  onGenerateShelfPlan: () => void;
  onGenerateReorderWarnings: () => void;
  onRefresh: () => void;
  onViewAdvice: (advice: BIAdviceRecord) => void;
  onCreateTask: (advice: BIAdviceRecord) => void;
  onAssignStaff: (advice: BIAdviceRecord) => void;
  onStartStocktake: (advice: BIAdviceRecord) => void;
  onRequestApproval?: (advice: BIAdviceRecord) => void;
  onResolve: (advice: BIAdviceRecord) => void;
  onDismiss: (advice: BIAdviceRecord) => void;
  onEscalate: (advice: BIAdviceRecord) => void;
  onPrintAdvice?: (advice: BIAdviceRecord) => void;
  onActionMenuOpen?: (advice: BIAdviceRecord) => void;
  canView: boolean;
}

const categories: Array<'ALL' | BIAdviceCategory> = ['ALL', 'Stock Health', 'Reorder Control', 'Shelf Stocktake', 'Staff Behaviour', 'Cash Control', 'Sales Integrity', 'Delivery Verification', 'Pricing Control', 'Approval Control', 'Inventory Risk', 'Customer and Credit Risk'];
const priorities: Array<'ALL' | BIAdvicePriority> = ['ALL', 'Low', 'Medium', 'High', 'Critical'];
const statuses: Array<'ALL' | BIAdviceStatus> = ['ALL', 'New', 'Assigned', 'In Progress', 'Waiting Review', 'Resolved', 'Dismissed', 'Escalated', 'Blocked'];

function summary(records: BIAdviceRecord[]) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    newAdvice: records.filter((record) => record.status === 'New').length,
    assigned: records.filter((record) => record.status === 'Assigned').length,
    inProgress: records.filter((record) => record.status === 'In Progress').length,
    dueToday: records.filter((record) => record.dueDate === today && record.status !== 'Resolved').length,
    assignedToMe: records.filter((record) => record.assignedToStaffName || record.assignedToStaffId).length,
    waitingReview: records.filter((record) => record.status === 'Waiting Review').length,
    critical: records.filter((record) => record.priority === 'Critical' || record.riskLevel === 'Critical').length,
    shelfToday: records.filter((record) => record.category === 'Shelf Stocktake' && record.dueDate === today).length,
    reorderBlocks: records.filter((record) => record.category === 'Reorder Control').length,
    resolvedToday: records.filter((record) => record.status === 'Resolved' && record.resolvedAt?.startsWith(today)).length
  };
}

function supportsStocktake(advice: BIAdviceRecord): boolean {
  return Boolean(
    advice.category === 'Shelf Stocktake' ||
    advice.category === 'Stock Health' ||
    advice.category === 'Inventory Risk' ||
    advice.shelfLocation ||
    advice.productName ||
    advice.recommendedAction === 'Start Stocktake'
  );
}

function assignedToLabel(advice: BIAdviceRecord): string {
  return advice.assignedToStaffName || advice.assignedToRole || advice.assignedDesk || 'Unassigned';
}

export default function BIAdviceFlowPanel({
  records,
  filters,
  onFiltersChange,
  onGenerate,
  onGenerateShelfPlan,
  onGenerateReorderWarnings,
  onRefresh,
  onViewAdvice,
  onCreateTask,
  onAssignStaff,
  onStartStocktake,
  onRequestApproval,
  onResolve,
  onDismiss,
  onEscalate,
  onPrintAdvice,
  onActionMenuOpen,
  canView
}: BIAdviceFlowPanelProps) {
  const totals = summary(records);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const setFilter = (patch: BIAdviceFilterState) => onFiltersChange({ ...filters, ...patch });
  const openAdvice = records.find((advice) => advice.adviceId === openMenuId) || null;

  const closeMenu = () => {
    setOpenMenuId(null);
    setMenuPosition(null);
  };

  const toggleMenu = (advice: BIAdviceRecord, button: HTMLButtonElement) => {
    if (openMenuId === advice.adviceId) {
      closeMenu();
      return;
    }
    const rect = button.getBoundingClientRect();
    const menuWidth = 230;
    setMenuPosition({
      top: Math.min(rect.bottom + 6, window.innerHeight - 320),
      left: Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8))
    });
    setOpenMenuId(advice.adviceId);
    onActionMenuOpen?.(advice);
  };

  const runMenuAction = (action: () => void) => {
    action();
    closeMenu();
  };

  useEffect(() => {
    if (!openMenuId) return undefined;
    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      const target = event.target as HTMLElement;
      if (target.closest('.bi-advice-action-menu-trigger')) return;
      closeMenu();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu();
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openMenuId]);

  if (!canView) {
    return <div className="sci-pos-alert sci-pos-alert--danger">You do not have permission to view this BI advice.</div>;
  }

  return (
    <section className="bi-advice-flow-panel">
      <div className="bi-advice-flow-intro">
        <strong>BI Advice Flow</strong>
        <span>Rule-based business protection advice generated from BI Brain logs and operational triggers.</span>
      </div>
      <div className="bi-advice-summary-grid">
        <div><span>New Advice</span><strong>{totals.newAdvice}</strong></div>
        <div><span>Assigned</span><strong>{totals.assigned}</strong></div>
        <div><span>In Progress</span><strong>{totals.inProgress}</strong></div>
        <div><span>Due Today</span><strong>{totals.dueToday}</strong></div>
        <div><span>Assigned</span><strong>{totals.assignedToMe}</strong></div>
        <div><span>Waiting Review</span><strong>{totals.waitingReview}</strong></div>
        <div><span>Critical</span><strong>{totals.critical}</strong></div>
        <div><span>Shelf Stocktakes Today</span><strong>{totals.shelfToday}</strong></div>
        <div><span>Reorder Blocks</span><strong>{totals.reorderBlocks}</strong></div>
        <div><span>Resolved Today</span><strong>{totals.resolvedToday}</strong></div>
      </div>

      <div className="bi-advice-filterbar">
        <label>
          <Search size={15} aria-hidden="true" />
          <input value={filters.search || ''} onChange={(event) => setFilter({ search: event.target.value })} placeholder="Search BI advice in any word order" />
        </label>
        <select value={filters.category || 'ALL'} onChange={(event) => setFilter({ category: event.target.value as BIAdviceFilterState['category'] })}>
          {categories.map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
        <select value={filters.priority || 'ALL'} onChange={(event) => setFilter({ priority: event.target.value as BIAdviceFilterState['priority'] })} aria-label="Priority filter">
          {priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
        </select>
        <select value={filters.status || 'ALL'} onChange={(event) => setFilter({ status: event.target.value as BIAdviceFilterState['status'] })}>
          {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
        <input value={filters.assignedRole || ''} onChange={(event) => setFilter({ assignedRole: event.target.value })} placeholder="Assigned role" />
        <input value={filters.assignedStaff || ''} onChange={(event) => setFilter({ assignedStaff: event.target.value })} placeholder="Assigned staff" />
        <input value={filters.branch || ''} onChange={(event) => setFilter({ branch: event.target.value })} placeholder="Branch" />
        <input type="date" value={filters.dateFrom || ''} onChange={(event) => setFilter({ dateFrom: event.target.value })} />
        <input type="date" value={filters.dateTo || ''} onChange={(event) => setFilter({ dateTo: event.target.value })} />
        <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={onGenerate}>Generate Advice From Logs</button>
        <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={onGenerateShelfPlan}>Generate Shelf Stocktake Plan</button>
        <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={onGenerateReorderWarnings}>Generate Reorder Block Warnings</button>
        <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={onRefresh}>Refresh</button>
      </div>

      <div className="bi-advice-table-card">
        <div className="bi-advice-table-scroll">
          <table className="bi-trigger-table bi-advice-table">
            <colgroup>
              <col className="bi-advice-col-no" />
              <col className="bi-advice-col-category" />
              <col className="bi-advice-col-risk" />
              <col className="bi-advice-col-narrative" />
              <col className="bi-advice-col-product" />
              <col className="bi-advice-col-assigned" />
              <col className="bi-advice-col-due" />
              <col className="bi-advice-col-action" />
            </colgroup>
            <thead>
              <tr>
                <th>Advice No.</th>
                <th>Domain / Category</th>
                <th>Risk</th>
                <th>Narrative</th>
                <th>Product / SKU</th>
                <th>Assigned To</th>
                <th>Due / Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {records.map((advice) => (
                <tr key={advice.adviceId}>
                  <td><span className="bi-advice-cell-primary">{advice.adviceNumber}</span></td>
                  <td><span className="bi-advice-cell-primary">{advice.category}</span><span className="bi-advice-cell-secondary">{advice.sourceModule}</span></td>
                  <td><span className={`bi-risk-badge bi-risk-badge--${advice.priority.toLowerCase()} bi-advice-risk-text`}>{advice.priority}</span></td>
                  <td><span className="bi-advice-cell-narrative" title={advice.narrative}>{advice.narrative}</span></td>
                  <td><span className="bi-advice-cell-primary">{advice.productName || 'Not linked'}</span><span className="bi-advice-cell-secondary">{[advice.sku, advice.shelfLocation].filter(Boolean).join(' / ') || 'No SKU / shelf'}</span></td>
                  <td><span className="bi-advice-cell-primary">{assignedToLabel(advice)}</span><span className="bi-advice-cell-secondary">{advice.assignedDesk || advice.assignedToRole || 'No desk'}</span></td>
                  <td><span className="bi-advice-cell-primary">{advice.dueDate || 'No due date'}</span><span className="bi-advice-status-text">{advice.status}</span></td>
                  <td className="bi-advice-action-cell">
                    <button
                      type="button"
                      className="bi-advice-action-menu-trigger"
                      onClick={(event) => toggleMenu(advice, event.currentTarget)}
                      aria-label="BI advice actions"
                      aria-expanded={openMenuId === advice.adviceId}
                      title="BI advice actions"
                    >
                      <MoreVertical size={17} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr>
                  <td colSpan={8} className="sci-pos-empty-cell">No BI advice matched your search.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {openAdvice && menuPosition && (
        <div
          ref={menuRef}
          className="bi-advice-action-menu-portal"
          style={{ top: menuPosition.top, left: menuPosition.left }}
          role="menu"
        >
          <button type="button" className="bi-advice-action-menu-item" onClick={() => runMenuAction(() => onViewAdvice(openAdvice))}>Open Advice</button>
          <button type="button" className="bi-advice-action-menu-item" onClick={() => runMenuAction(() => onCreateTask(openAdvice))}>Create Task</button>
          <button type="button" className="bi-advice-action-menu-item" onClick={() => runMenuAction(() => onAssignStaff(openAdvice))}>Assign Staff</button>
          {supportsStocktake(openAdvice) && (
            <button type="button" className="bi-advice-action-menu-item" onClick={() => runMenuAction(() => onStartStocktake(openAdvice))}>Start Stocktake</button>
          )}
          <button type="button" className="bi-advice-action-menu-item" onClick={() => runMenuAction(() => onRequestApproval?.(openAdvice))}>Request Approval</button>
          <button type="button" className="bi-advice-action-menu-item" onClick={() => runMenuAction(() => onResolve(openAdvice))}>Resolve</button>
          <button type="button" className="bi-advice-action-menu-item" onClick={() => runMenuAction(() => onDismiss(openAdvice))}>Dismiss</button>
          <button type="button" className="bi-advice-action-menu-item" onClick={() => runMenuAction(() => onEscalate(openAdvice))}>Escalate</button>
          <button type="button" className="bi-advice-action-menu-item" onClick={() => runMenuAction(() => onPrintAdvice?.(openAdvice))}>Print Advice</button>
        </div>
      )}
    </section>
  );
}
