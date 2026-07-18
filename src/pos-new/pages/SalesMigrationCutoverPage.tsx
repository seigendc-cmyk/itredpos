import { useMemo, useState } from 'react';
import { readSciPosStaffSession, readSciVendorOwnerSession } from '../../sci-auth/StaffAuthService';
import { ENABLE_MOCK_SEED_DATA } from '../utils/vendorDataMode';
import {
  ACTIVE_SALES_AUTHORITY_VERSION,
  canApplySalesMigration,
  createSalesMigrationUiWorkflow,
  resolveSalesMigrationAdminContext,
  type SalesMigrationApplyBundle,
  type SalesMigrationPreviewBundle
} from '../services/salesMigration/uiWorkflow';
import type { SalesMigrationApproval, SalesMigrationTotals } from '../services/salesMigration/types';

const money = (minor: number) => (minor / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const metrics: Array<[keyof SalesMigrationTotals, string, boolean]> = [
  ['saleCount', 'Sale count', false], ['grossMinor', 'Gross amount', true], ['paidMinor', 'Paid amount', true],
  ['creditMinor', 'Credit amount', true], ['itemQuantity', 'Item quantity', false]
];

export default function SalesMigrationCutoverPage() {
  const workflow = useMemo(() => createSalesMigrationUiWorkflow(), []);
  const [bundle, setBundle] = useState<SalesMigrationPreviewBundle>();
  const [approval, setApproval] = useState<SalesMigrationApproval>();
  const [approved, setApproved] = useState(false);
  const [result, setResult] = useState<SalesMigrationApplyBundle>();
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const requestedVendorId = new URLSearchParams(window.location.search).get('vendorId');
  let context;
  try { context = resolveSalesMigrationAdminContext(readSciVendorOwnerSession(), readSciPosStaffSession(), requestedVendorId); }
  catch (accessError) {
    return <main className="min-h-screen bg-slate-950 p-6 text-slate-100"><section role="alert" className="mx-auto max-w-3xl border border-rose-700 bg-rose-950/30 p-6"><h1 className="text-xl font-black uppercase">Sales migration access denied</h1><p className="mt-3 text-sm text-rose-200">{accessError instanceof Error ? accessError.message : 'Authority could not be resolved.'}</p></section></main>;
  }

  const preview = bundle?.preview;
  const applyEnabled = !busy && canApplySalesMigration(preview, approval, approved);
  const unexplained = result ? Object.values(result.reconciliation.differences).some(value => value !== 0) : undefined;

  async function generatePreview() {
    setBusy(true); setError(''); setApproval(undefined); setApproved(false); setResult(undefined); setProgress({ completed: 0, total: 0 });
    try { setBundle(await workflow.preview(context)); }
    catch (failure) { setBundle(undefined); setError(failure instanceof Error ? failure.message : 'Dry-run preview failed.'); }
    finally { setBusy(false); }
  }

  function bindApproval() {
    if (!preview || !approved) return;
    try { setApproval(workflow.approve(preview, context)); setError(''); }
    catch (failure) { setApproval(undefined); setError(failure instanceof Error ? failure.message : 'Approval failed.'); }
  }

  async function applyMigration() {
    if (!preview || !approval || !applyEnabled) return;
    setBusy(true); setError(''); setProgress({ completed: 0, total: preview.readyRecords.length });
    try { setResult(await workflow.apply(context, preview, approval, approved, (completed, total) => setProgress({ completed, total }))); }
    catch (failure) { setResult(undefined); setError(failure instanceof Error ? failure.message : 'Migration service failed.'); }
    finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-slate-950 p-4 text-slate-100 md:p-7">
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="border border-slate-700 bg-slate-900 p-5"><p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">Restricted vendor administration</p><h1 className="mt-2 text-2xl font-black uppercase">Sales Migration and Production Cutover</h1><p className="mt-2 text-sm text-slate-400">Dry-run preview is the default and required first action. This screen never writes directly to Firestore and never calls cashier checkout.</p></header>
      <section aria-label="Authority and vendor context" className="grid gap-3 md:grid-cols-4">
        <Status label="Sales authority version" value={String(ACTIVE_SALES_AUTHORITY_VERSION)} />
        <Status label="Legacy sales writes" value="Disabled" />
        <Status label="Mock-data mode" value={ENABLE_MOCK_SEED_DATA ? 'Enabled — blocked' : 'Disabled'} />
        <Status label="Authority" value={`${context.actorName} (${context.actorRole})`} />
        <Status label="Vendor" value={`${context.vendorName} · ${context.vendorId}`} />
        <Status label="Branch" value={`${context.branchName} · ${context.branchId}`} />
        <Status label="Warehouse" value={`${context.warehouseName} · ${context.warehouseId}`} />
        <Status label="Terminal" value={`${context.terminalName} · ${context.terminalId}`} />
      </section>
      <section className="border border-amber-700 bg-amber-950/20 p-4 text-sm text-amber-100"><strong className="uppercase">No operational reposting:</strong> migration creates canonical historical sale records and durable migration receipts only. Inventory movements, payments, customer debt, audit events, and BI events will not be reposted.</section>
      {error && <div role="alert" className="border border-rose-700 bg-rose-950/30 p-4 text-sm text-rose-200">{error} No mock data was loaded.</div>}
      <section className="border border-slate-700 bg-slate-900 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-black uppercase">1. Dry-run preview</h2><p className="mt-1 text-xs text-slate-400">Reads only the canonical vendor-scoped legacy source.</p></div><button type="button" onClick={() => void generatePreview()} disabled={busy} className="border border-cyan-500 bg-cyan-600 px-4 py-3 text-xs font-black uppercase text-slate-950 disabled:opacity-50">{busy && !preview ? 'Generating…' : 'Generate dry-run preview'}</button></div>
        {bundle && <><div className="mt-4 grid gap-2 md:grid-cols-5"><Count label="Candidate" value={bundle.counts.candidate} /><Count label="Eligible" value={bundle.counts.eligible} /><Count label="Conflict" value={bundle.counts.conflict} /><Count label="Invalid" value={bundle.counts.invalid} /><Count label="Quarantine" value={bundle.counts.quarantine} /></div><p className="mt-3 break-all text-xs text-slate-400">Preview: {preview!.previewVersion} · Run: {preview!.migrationRunId} · Source fingerprint: {preview!.sourceFingerprint}</p></>}
      </section>
      {preview && <section className="grid gap-5 lg:grid-cols-2">
        <div className="border border-slate-700 bg-slate-900 p-5"><h2 className="font-black uppercase">2. Reconciliation preview</h2><TotalsTable source={preview.totals} destination={result?.reconciliation.destination} differences={result?.reconciliation.differences} /><p className={`mt-3 border p-3 text-sm font-black uppercase ${unexplained === true ? 'border-rose-600 text-rose-300' : unexplained === false ? 'border-emerald-600 text-emerald-300' : 'border-slate-700 text-slate-400'}`}>Unexplained difference: {unexplained === undefined ? 'Not calculated — apply has not run' : unexplained ? 'YES — cutover blocked' : 'NO — matched'}</p></div>
        <div className="border border-slate-700 bg-slate-900 p-5"><h2 className="font-black uppercase">Conflict and quarantine review</h2>{preview.quarantine.length ? <div className="mt-3 space-y-2">{preview.quarantine.map(row => <div key={row.quarantineId} className="border border-rose-800 bg-rose-950/20 p-3 text-xs"><strong>{row.legacyRecordId || 'Missing ID'} · {row.codes.join(', ')}</strong><p className="mt-1 text-rose-200">{row.reasons.join(' ')}</p></div>)}</div> : <p className="mt-3 text-sm text-emerald-300">No conflicts or quarantine records in this preview.</p>}</div>
      </section>}
      {preview && <section className="border border-slate-700 bg-slate-900 p-5"><h2 className="font-black uppercase">3. Approval and apply</h2><label className="mt-4 flex gap-3 text-sm"><input type="checkbox" checked={approved} onChange={event => { setApproved(event.target.checked); setApproval(undefined); }} />I explicitly approve this exact run, preview version, vendor, branch, and source fingerprint.</label><div className="mt-4 flex flex-wrap gap-3"><button type="button" disabled={!approved || !preview.canApprove || busy} onClick={bindApproval} className="border border-amber-500 px-4 py-3 text-xs font-black uppercase disabled:opacity-40">Bind approval to preview</button><button type="button" disabled={!applyEnabled} onClick={() => void applyMigration()} className="border border-rose-500 bg-rose-700 px-4 py-3 text-xs font-black uppercase disabled:cursor-not-allowed disabled:opacity-40">Apply approved migration</button></div><p className="mt-3 text-xs text-slate-400">Apply re-reads and re-fingerprints the source. Any changed or stale preview is rejected before the migration service executes.</p></section>}
      {(progress.total > 0 || result) && <section className="border border-slate-700 bg-slate-900 p-5"><h2 className="font-black uppercase">Progress and final result</h2><p className="mt-2 text-sm">{progress.completed} / {progress.total} eligible records processed.</p>{result && <><p className="mt-2 text-sm font-bold">Migrated: {result.results.filter(row => row.status === 'migrated').length} · Replayed: {result.results.filter(row => row.status === 'replayed').length} · Failed: {result.results.filter(row => row.status === 'failed').length} · Reconciliation: {result.reconciliation.status}</p>{result.results.some(row => row.status === 'failed') && <div role="alert" className="mt-3 space-y-2">{result.results.filter(row => row.status === 'failed').map(row => <p key={row.receiptId} className="border border-rose-800 bg-rose-950/20 p-3 text-xs text-rose-200">{row.legacyRecordId}: {row.errorCode || 'MIGRATION_FAILED'} — {row.message || 'The migration service did not complete this record.'}</p>)}</div>}<h3 className="mt-4 text-xs font-black uppercase text-slate-400">Migration receipt references</h3><ul className="mt-2 space-y-1 text-xs">{result.receiptReferences.map(reference => <li key={reference} className="break-all">{reference}</li>)}</ul></>}</section>}
    </div>
  </main>;
}

function Status({ label, value }: { label: string; value: string }) { return <div className="border border-slate-700 bg-slate-900 p-3"><p className="text-[10px] font-black uppercase text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-bold">{value}</p></div>; }
function Count({ label, value }: { label: string; value: number }) { return <div className="border border-slate-700 bg-slate-950 p-3"><p className="text-[10px] font-black uppercase text-slate-500">{label}</p><p className="mt-1 text-xl font-black">{value}</p></div>; }
function TotalsTable({ source, destination, differences }: { source: SalesMigrationTotals; destination?: SalesMigrationTotals; differences?: SalesMigrationTotals }) { return <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr><th className="p-2">Metric</th><th className="p-2">Source</th><th className="p-2">Migrated</th><th className="p-2">Difference</th></tr></thead><tbody>{metrics.map(([key, label, isMoney]) => <tr key={key} className="border-t border-slate-800"><td className="p-2">{label}</td><td className="p-2">{isMoney ? money(source[key]) : source[key]}</td><td className="p-2">{destination ? isMoney ? money(destination[key]) : destination[key] : '—'}</td><td className="p-2">{differences ? isMoney ? money(differences[key]) : differences[key] : '—'}</td></tr>)}</tbody></table></div>; }
