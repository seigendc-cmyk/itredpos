import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Eye,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  WifiOff
} from 'lucide-react';
import {
  listVendorSyncStatuses,
  listVendorSyncEvents,
  markVendorSyncReviewed,
  retryPendingVendorSync,
  VENDOR_SYNC_SEVERITIES,
  VENDOR_SYNC_STATUSES,
  type VendorSyncEventRecord,
  type VendorSyncSeverity,
  type VendorSyncStatus,
  type VendorSyncStatusSummary
} from './vendorSyncMonitorService';

type StatusFilter = 'All' | VendorSyncStatus;
type SeverityFilter = 'All' | VendorSyncSeverity;

const statusOptions: StatusFilter[] = ['All', ...VENDOR_SYNC_STATUSES];
const severityOptions: SeverityFilter[] = ['All', ...VENDOR_SYNC_SEVERITIES];

function navigateTo(path: string): void {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function dateLabel(value?: string): string {
  if (!value) return '-';
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toLocaleString() : value;
}

function statusClass(value: VendorSyncStatus): string {
  if (value === 'Synced') return 'border-emerald-300 bg-emerald-50 text-emerald-800';
  if (value === 'PendingSync') return 'border-amber-300 bg-amber-50 text-amber-800';
  if (value === 'Failed') return 'border-rose-300 bg-rose-50 text-rose-800';
  if (value === 'Offline') return 'border-slate-400 bg-slate-100 text-slate-800';
  return 'border-slate-300 bg-white text-slate-600';
}

function severityClass(value?: VendorSyncSeverity): string {
  if (value === 'Critical') return 'border-red-400 bg-red-50 text-red-800';
  if (value === 'Error') return 'border-rose-300 bg-rose-50 text-rose-800';
  if (value === 'Warning') return 'border-amber-300 bg-amber-50 text-amber-800';
  return 'border-cyan-300 bg-cyan-50 text-cyan-800';
}

function StatusChip({ value }: { value: VendorSyncStatus }) {
  return <span className={`inline-flex border px-2 py-1 text-[10px] font-black uppercase ${statusClass(value)}`}>{value}</span>;
}

function SeverityChip({ value }: { value?: VendorSyncSeverity }) {
  return <span className={`inline-flex border px-2 py-1 text-[10px] font-black uppercase ${severityClass(value)}`}>{value || 'Info'}</span>;
}

function Metric({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="border border-slate-300 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</p>
        <div className="text-slate-400">{icon}</div>
      </div>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function inputClass(): string {
  return 'w-full border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-950 outline-none focus:border-orange-500';
}

function ActionButton({
  children,
  onClick,
  disabled,
  tone = 'slate'
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'slate' | 'orange' | 'emerald';
}) {
  const classes = tone === 'emerald'
    ? 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-500'
    : tone === 'orange'
      ? 'border-orange-600 bg-orange-600 text-white hover:bg-orange-500'
      : 'border-slate-700 bg-slate-900 text-white hover:bg-slate-800';
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 border px-3 py-2 text-xs font-black uppercase disabled:cursor-wait disabled:opacity-60 ${classes}`}
    >
      {children}
    </button>
  );
}

export default function VendorSyncMonitorPage() {
  const [statuses, setStatuses] = useState<VendorSyncStatusSummary[]>([]);
  const [events, setEvents] = useState<VendorSyncEventRecord[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('All');
  const [offlineOnly, setOfflineOnly] = useState(false);
  const [failedOnly, setFailedOnly] = useState(false);
  const [reviewedBy, setReviewedBy] = useState('Console Admin');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Loading vendor sync monitor...');

  const selectedVendor = useMemo(
    () => statuses.find((vendor) => vendor.vendorId === selectedVendorId),
    [selectedVendorId, statuses]
  );

  const kpis = useMemo(() => ({
    total: statuses.length,
    synced: statuses.filter((vendor) => vendor.syncStatus === 'Synced').length,
    pending: statuses.filter((vendor) => vendor.syncStatus === 'PendingSync').length,
    failed: statuses.filter((vendor) => vendor.syncStatus === 'Failed').length,
    offline: statuses.filter((vendor) => vendor.syncStatus === 'Offline').length,
    notReviewed: statuses.filter((vendor) => !vendor.reviewedAt).length
  }), [statuses]);

  const hasSyncActivity = useMemo(() => statuses.some((vendor) => (
    vendor.syncStatus !== 'Unknown' ||
    Boolean(vendor.latestEventAt) ||
    Boolean(vendor.lastSyncAt) ||
    Boolean(vendor.lastPOSHeartbeatAt) ||
    Boolean(vendor.lastConsoleUpdateAt) ||
    vendor.pendingWritesCount > 0 ||
    vendor.failedWritesCount > 0 ||
    Boolean(vendor.lastError) ||
    Boolean(vendor.reviewedAt)
  )), [statuses]);

  const filteredStatuses = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return statuses.filter((vendor) => {
      const haystack = `${vendor.vendorId} ${vendor.businessName} ${vendor.ownerName} ${vendor.ownerEmail} ${vendor.phone} ${vendor.whatsapp}`.toLowerCase();
      if (needle && !haystack.includes(needle)) return false;
      if (statusFilter !== 'All' && vendor.syncStatus !== statusFilter) return false;
      if (
        severityFilter !== 'All' &&
        vendor.latestSeverity !== severityFilter &&
        vendor.highestSeverity !== severityFilter
      ) {
        return false;
      }
      if (offlineOnly && vendor.syncStatus !== 'Offline') return false;
      if (failedOnly && vendor.syncStatus !== 'Failed' && vendor.failedWritesCount === 0 && !vendor.lastError) return false;
      return true;
    });
  }, [failedOnly, offlineOnly, search, severityFilter, statusFilter, statuses]);

  const load = async () => {
    setBusy(true);
    try {
      const rows = await listVendorSyncStatuses();
      const nextSelectedVendorId = selectedVendorId || rows[0]?.vendorId || '';
      const nextEvents = nextSelectedVendorId ? await listVendorSyncEvents(nextSelectedVendorId) : [];
      setStatuses(rows);
      setSelectedVendorId(nextSelectedVendorId);
      setEvents(nextEvents);
      const activity = rows.some((vendor) => (
        vendor.syncStatus !== 'Unknown' ||
        Boolean(vendor.latestEventAt) ||
        Boolean(vendor.lastSyncAt) ||
        Boolean(vendor.lastPOSHeartbeatAt) ||
        Boolean(vendor.lastConsoleUpdateAt) ||
        vendor.pendingWritesCount > 0 ||
        vendor.failedWritesCount > 0 ||
        Boolean(vendor.lastError) ||
        Boolean(vendor.reviewedAt)
      ));
      setMessage(activity ? 'Vendor sync monitor ready.' : 'No vendor sync events have been recorded yet.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Vendor sync monitor failed to load.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const viewEvents = async (vendorId: string) => {
    setBusy(true);
    try {
      setSelectedVendorId(vendorId);
      const rows = await listVendorSyncEvents(vendorId);
      setEvents(rows);
      setMessage(rows.length > 0 ? `Loaded ${rows.length} sync event(s).` : 'No vendor sync events have been recorded yet.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Sync events failed to load.');
    } finally {
      setBusy(false);
    }
  };

  const runAction = async (action: () => Promise<string>) => {
    setBusy(true);
    try {
      const nextMessage = await action();
      setMessage(nextMessage);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Vendor sync action failed.');
    } finally {
      setBusy(false);
    }
  };

  const markReviewed = (vendorId: string) => void runAction(async () => {
    const status = await markVendorSyncReviewed(vendorId, reviewedBy);
    return `${status.businessName} marked reviewed.`;
  });

  const retrySync = (vendorId: string) => void runAction(async () => {
    const result = await retryPendingVendorSync(vendorId, reviewedBy);
    return `Sync retry requested for ${result.vendorId}. Records touched: ${result.rebuiltCollections.join(', ')}.`;
  });

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-950">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="border border-slate-800 bg-slate-900 p-5 text-white">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-orange-300">SCI / iTred Console</p>
          <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-2xl font-black uppercase tracking-wide">Vendor Sync Monitor</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                Review POS sync health, pending writes, offline vendors, sync failures, and Console repair requests.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ActionButton tone="slate" onClick={() => navigateTo('/platform/firebase-readiness')}>
                <ArrowLeft className="h-4 w-4" />
                Firebase Readiness
              </ActionButton>
              <ActionButton tone="slate" onClick={() => navigateTo('/platform/vendor-verification')}>
                Vendor Verification
              </ActionButton>
              <ActionButton tone="orange" onClick={() => void load()} disabled={busy}>
                <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
                Refresh
              </ActionButton>
            </div>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Metric label="Total Vendors" value={String(kpis.total)} icon={<Activity className="h-5 w-5" />} />
          <Metric label="Synced" value={String(kpis.synced)} icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />} />
          <Metric label="Pending Sync" value={String(kpis.pending)} icon={<RefreshCw className="h-5 w-5 text-amber-500" />} />
          <Metric label="Failed Sync" value={String(kpis.failed)} icon={<AlertTriangle className="h-5 w-5 text-rose-500" />} />
          <Metric label="Offline Vendors" value={String(kpis.offline)} icon={<WifiOff className="h-5 w-5 text-slate-500" />} />
          <Metric label="Not Reviewed" value={String(kpis.notReviewed)} icon={<ShieldCheck className="h-5 w-5 text-cyan-500" />} />
        </section>

        <section className="border border-slate-300 bg-white p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(220px,1.3fr)_170px_170px_160px_160px_180px]">
            <Field label="Search">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className={`${inputClass()} pl-9`}
                  placeholder="Vendor, owner, email, phone"
                />
              </div>
            </Field>
            <Field label="Sync Status">
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} className={inputClass()}>
                {statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </Field>
            <Field label="Severity">
              <select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value as SeverityFilter)} className={inputClass()}>
                {severityOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </Field>
            <Field label="Offline Only">
              <button
                type="button"
                onClick={() => setOfflineOnly((value) => !value)}
                className={`w-full border px-3 py-2 text-xs font-black uppercase ${offlineOnly ? 'border-slate-800 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700'}`}
              >
                {offlineOnly ? 'On' : 'Off'}
              </button>
            </Field>
            <Field label="Failed Only">
              <button
                type="button"
                onClick={() => setFailedOnly((value) => !value)}
                className={`w-full border px-3 py-2 text-xs font-black uppercase ${failedOnly ? 'border-rose-700 bg-rose-700 text-white' : 'border-slate-300 bg-white text-slate-700'}`}
              >
                {failedOnly ? 'On' : 'Off'}
              </button>
            </Field>
            <Field label="Reviewed By">
              <input value={reviewedBy} onChange={(event) => setReviewedBy(event.target.value)} className={inputClass()} />
            </Field>
          </div>
          <p className="mt-3 border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">{message}</p>
        </section>

        {!hasSyncActivity ? (
          <section className="border border-slate-300 bg-white p-8 text-center">
            <Activity className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-3 text-sm font-black uppercase text-slate-700">No vendor sync events have been recorded yet.</p>
          </section>
        ) : (
          <section className="overflow-hidden border border-slate-300 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 p-4">
              <div>
                <h2 className="text-sm font-black uppercase text-slate-950">Vendor Sync Status</h2>
                <p className="mt-1 text-xs font-bold text-slate-500">{filteredStatuses.length} vendor(s) match the current filters.</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Vendor</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Sync Health</th>
                    <th className="px-4 py-3">Writes</th>
                    <th className="px-4 py-3">Reviewed</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredStatuses.map((vendor) => (
                    <tr key={vendor.vendorId} className={vendor.vendorId === selectedVendorId ? 'bg-orange-50/70' : 'bg-white'}>
                      <td className="px-4 py-4 align-top">
                        <p className="font-black text-slate-950">{vendor.businessName}</p>
                        <p className="mt-1 font-mono text-[10px] text-slate-500">{vendor.vendorId}</p>
                        <p className="mt-2 text-slate-600">{vendor.ownerName || '-'}</p>
                        <p className="text-slate-500">{vendor.ownerEmail || '-'}</p>
                        <p className="text-slate-500">{vendor.phone || vendor.whatsapp || '-'}</p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex flex-col items-start gap-2">
                          <StatusChip value={vendor.syncStatus} />
                          <SeverityChip value={vendor.latestSeverity || vendor.highestSeverity} />
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="space-y-1 text-slate-600">
                          <p><span className="font-black text-slate-500">Last sync:</span> {dateLabel(vendor.lastSyncAt)}</p>
                          <p><span className="font-black text-slate-500">POS heartbeat:</span> {dateLabel(vendor.lastPOSHeartbeatAt)}</p>
                          <p><span className="font-black text-slate-500">Console update:</span> {dateLabel(vendor.lastConsoleUpdateAt)}</p>
                          {vendor.lastError ? <p className="font-bold text-rose-700">{vendor.lastError}</p> : null}
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <p className="font-black text-slate-950">Pending: {vendor.pendingWritesCount}</p>
                        <p className="mt-1 font-black text-rose-700">Failed: {vendor.failedWritesCount}</p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <p className="font-bold text-slate-700">{dateLabel(vendor.reviewedAt)}</p>
                        <p className="mt-1 text-slate-500">{vendor.reviewedBy || '-'}</p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex min-w-[260px] flex-wrap gap-2">
                          <ActionButton tone="slate" onClick={() => void viewEvents(vendor.vendorId)} disabled={busy}>
                            <Eye className="h-4 w-4" />
                            View Sync Events
                          </ActionButton>
                          <ActionButton tone="emerald" onClick={() => markReviewed(vendor.vendorId)} disabled={busy}>
                            <CheckCircle2 className="h-4 w-4" />
                            Mark Reviewed
                          </ActionButton>
                          <ActionButton tone="orange" onClick={() => retrySync(vendor.vendorId)} disabled={busy}>
                            <RotateCcw className="h-4 w-4" />
                            Retry Sync
                          </ActionButton>
                          <ActionButton tone="slate" onClick={() => navigateTo('/platform/payment-renewals')}>
                            <ExternalLink className="h-4 w-4" />
                            Open Vendor License Dashboard
                          </ActionButton>
                          <ActionButton tone="slate" onClick={() => navigateTo('/platform/vendor-verification')}>
                            <ExternalLink className="h-4 w-4" />
                            Open Vendor Verification
                          </ActionButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredStatuses.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm font-bold text-slate-500">
                        No vendors match the current sync filters.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="border border-slate-300 bg-white">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-sm font-black uppercase text-slate-950">Sync Events</h2>
              <p className="mt-1 text-xs font-bold text-slate-500">
                {selectedVendor ? `${selectedVendor.businessName} (${selectedVendor.vendorId})` : 'Select a vendor to inspect sync events.'}
              </p>
            </div>
            {selectedVendor ? (
              <ActionButton tone="slate" onClick={() => void viewEvents(selectedVendor.vendorId)} disabled={busy}>
                <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
                Reload Events
              </ActionButton>
            ) : null}
          </div>
          {events.length === 0 ? (
            <div className="p-8 text-center">
              <Activity className="mx-auto h-8 w-8 text-slate-400" />
              <p className="mt-3 text-sm font-black uppercase text-slate-700">No vendor sync events have been recorded yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Severity</th>
                    <th className="px-4 py-3">Event</th>
                    <th className="px-4 py-3">Message</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {events.map((event) => (
                    <tr key={event.syncEventId}>
                      <td className="px-4 py-3 font-bold text-slate-600">{dateLabel(event.createdAt)}</td>
                      <td className="px-4 py-3"><SeverityChip value={event.severity} /></td>
                      <td className="px-4 py-3">
                        <p className="font-black text-slate-950">{event.eventType}</p>
                        {event.performedBy ? <p className="mt-1 text-slate-500">{event.performedBy}</p> : null}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{event.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
