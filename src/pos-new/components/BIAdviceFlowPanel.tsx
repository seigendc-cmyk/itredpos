import { Search } from 'lucide-react';
import type { BIAdviceCategory, BIAdviceFilterState, BIAdviceRecord, BIAdviceStatus, RiskLevel } from '../types';

interface BIAdviceFlowPanelProps {
  records: BIAdviceRecord[];
  filters: BIAdviceFilterState;
  onFiltersChange: (filters: BIAdviceFilterState) => void;
  onGenerate: () => void;
  onViewAdvice: (advice: BIAdviceRecord) => void;
  onCreateTask: (advice: BIAdviceRecord) => void;
  onAssignStaff: (advice: BIAdviceRecord) => void;
  onStartStocktake: (advice: BIAdviceRecord) => void;
  onResolve: (advice: BIAdviceRecord) => void;
  onDismiss: (advice: BIAdviceRecord) => void;
  onEscalate: (advice: BIAdviceRecord) => void;
  canView: boolean;
}

const categories: Array<'ALL' | BIAdviceCategory> = ['ALL', 'Stock Health', 'Reorder Control', 'Shelf Stocktake', 'Staff Behaviour', 'Cash Control', 'Sales Integrity', 'Delivery Verification', 'Pricing Control', 'Approval Control', 'Inventory Risk'];
const risks: Array<'ALL' | RiskLevel> = ['ALL', 'Low', 'Medium', 'High', 'Critical'];
const statuses: Array<'ALL' | BIAdviceStatus> = ['ALL', 'New', 'Assigned', 'In Progress', 'Waiting Review', 'Resolved', 'Dismissed', 'Escalated', 'Blocked'];

function summary(records: BIAdviceRecord[]) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    newAdvice: records.filter((record) => record.status === 'New').length,
    assigned: records.filter((record) => record.status === 'Assigned').length,
    inProgress: records.filter((record) => record.status === 'In Progress').length,
    critical: records.filter((record) => record.priority === 'Critical' || record.riskLevel === 'Critical').length,
    shelfToday: records.filter((record) => record.category === 'Shelf Stocktake' && record.dueDate === today).length,
    reorderBlocks: records.filter((record) => record.category === 'Reorder Control').length,
    resolvedToday: records.filter((record) => record.status === 'Resolved' && record.resolvedAt?.startsWith(today)).length
  };
}

export default function BIAdviceFlowPanel({
  records,
  filters,
  onFiltersChange,
  onGenerate,
  onViewAdvice,
  onCreateTask,
  onAssignStaff,
  onStartStocktake,
  onResolve,
  onDismiss,
  onEscalate,
  canView
}: BIAdviceFlowPanelProps) {
  const totals = summary(records);

  if (!canView) {
    return <div className="sci-pos-alert sci-pos-alert--danger">You do not have permission to view this BI advice.</div>;
  }

  const setFilter = (patch: BIAdviceFilterState) => onFiltersChange({ ...filters, ...patch });

  return (
    <section className="bi-advice-flow-panel">
      <div className="bi-advice-summary-grid">
        <div><span>New Advice</span><strong>{totals.newAdvice}</strong></div>
        <div><span>Assigned</span><strong>{totals.assigned}</strong></div>
        <div><span>In Progress</span><strong>{totals.inProgress}</strong></div>
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
        <select value={filters.riskLevel || 'ALL'} onChange={(event) => setFilter({ riskLevel: event.target.value as BIAdviceFilterState['riskLevel'] })}>
          {risks.map((risk) => <option key={risk} value={risk}>{risk}</option>)}
        </select>
        <select value={filters.status || 'ALL'} onChange={(event) => setFilter({ status: event.target.value as BIAdviceFilterState['status'] })}>
          {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
        <input value={filters.assignedRole || ''} onChange={(event) => setFilter({ assignedRole: event.target.value })} placeholder="Assigned role" />
        <input value={filters.assignedStaff || ''} onChange={(event) => setFilter({ assignedStaff: event.target.value })} placeholder="Assigned staff" />
        <input value={filters.branch || ''} onChange={(event) => setFilter({ branch: event.target.value })} placeholder="Branch" />
        <input type="date" value={filters.dateFrom || ''} onChange={(event) => setFilter({ dateFrom: event.target.value })} />
        <input type="date" value={filters.dateTo || ''} onChange={(event) => setFilter({ dateTo: event.target.value })} />
        <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={onGenerate}>Generate BI Advice</button>
      </div>

      <div className="bi-advice-table-scroll">
        <table className="bi-trigger-table bi-advice-table">
          <thead>
            <tr>
              <th>Advice No.</th>
              <th>Category</th>
              <th>Priority</th>
              <th>Narrative</th>
              <th>Product / SKU</th>
              <th>Shelf</th>
              <th>Assigned To</th>
              <th>Due Date</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {records.map((advice) => (
              <tr key={advice.adviceId}>
                <td>{advice.adviceNumber}</td>
                <td>{advice.category}</td>
                <td><span className={`bi-risk-badge bi-risk-badge--${advice.priority.toLowerCase()}`}>{advice.priority}</span></td>
                <td>{advice.narrative}</td>
                <td>{[advice.productName, advice.sku].filter(Boolean).join(' / ') || 'Not linked'}</td>
                <td>{advice.shelfLocation || 'N/A'}</td>
                <td>{advice.assignedToStaffName || advice.assignedToRole || advice.assignedDesk || 'Unassigned'}</td>
                <td>{advice.dueDate || 'No due date'}</td>
                <td>{advice.status}</td>
                <td>
                  <div className="bi-advice-row-actions">
                    <button type="button" onClick={() => onViewAdvice(advice)} title="Open Advice">Open Advice</button>
                    <button type="button" onClick={() => onCreateTask(advice)} title="Create Task">Create Task</button>
                    <button type="button" onClick={() => onAssignStaff(advice)} title="Assign Staff">Assign Staff</button>
                    <button type="button" onClick={() => onStartStocktake(advice)} title="Start Stocktake">Start Stocktake</button>
                    <button type="button" onClick={() => onResolve(advice)} title="Resolve">Resolve</button>
                    <button type="button" onClick={() => onDismiss(advice)} title="Dismiss">Dismiss</button>
                    <button type="button" onClick={() => onEscalate(advice)} title="Escalate">Escalate</button>
                  </div>
                </td>
              </tr>
            ))}
            {records.length === 0 && (
              <tr>
                <td colSpan={10} className="sci-pos-empty-cell">No BI advice matched your search.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
