import { useState } from 'react';
import type { PurchasingMigrationPreview, PurchasingMigrationStatus } from '../services/purchasingMigration/types';

export function PurchasingMigrationAdminPanel({ preview, status = 'draft', onScan, onApprove, onExecute, onRetry }: { preview?: PurchasingMigrationPreview; status?: PurchasingMigrationStatus; onScan: () => void; onApprove: (warningIds: string[]) => void; onExecute: () => void; onRetry: () => void }) {
  const [acknowledged, setAcknowledged] = useState<string[]>([]);
  const warnings = preview?.issues.filter(row => row.severity === 'warning') || [];
  const errors = preview?.issues.filter(row => row.severity === 'error') || [];
  const allWarningsAcknowledged = warnings.every(row => acknowledged.includes(row.issueId));
  return <section aria-label="Purchasing migration administration" className="rounded border p-4">
    <h2>Purchasing migration, reconciliation and cutover</h2><p>Status: {status}</p>
    <button type="button" onClick={onScan}>Scan legacy source and generate preview</button>
    {preview && <><p>{preview.records.length} source records; {errors.length} errors; {warnings.length} warnings.</p>
      {preview.issues.map(row => <label key={row.issueId} className="block"><input type="checkbox" disabled={row.severity === 'error'} checked={acknowledged.includes(row.issueId)} onChange={event => setAcknowledged(current => event.target.checked ? [...current, row.issueId] : current.filter(id => id !== row.issueId))} /> {row.severity.toUpperCase()}: {row.message}</label>)}
      <button type="button" disabled={!preview.canApprove || !allWarningsAcknowledged} onClick={() => onApprove(acknowledged)}>Approve migration</button></>}
    <button type="button" disabled={status !== 'approved'} onClick={onExecute}>Execute approved migration</button>
    <button type="button" disabled={status !== 'partiallyCompleted' && status !== 'failed'} onClick={onRetry}>Retry eligible failed records</button>
    <p>Document writes alone do not mean success. Completion requires a matched reconciliation and cutover readiness assessment.</p>
  </section>;
}
