import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, Download, Eye, RefreshCw, Search, Wifi, WifiOff } from 'lucide-react';
import AuthPreviewPanel from '../components/AuthPreviewPanel';
import OfflineQueueItemForm from '../components/OfflineQueueItemForm';
import SyncConflictForm from '../components/SyncConflictForm';
import {
  LocalTerminalSnapshot,
  NetworkStatus,
  OfflineSyncActivityEvent,
  OfflineSyncBatch,
  OfflineSyncConflict,
  OfflineSyncConflictDecision,
  OfflineSyncFilterState,
  OfflineSyncHealth,
  OfflineSyncQueueItem,
  PosSession,
  Role,
  SyncConflictResolution,
  SyncEntityType,
  SyncPriority,
  SyncQueueStatus
} from '../types/posTypes';
import {
  cancelQueueItem,
  clearSyncedItemsPlaceholder,
  createSyncBatch,
  detectSyncConflict,
  exportSyncReportPlaceholder,
  getNetworkStatus,
  getOfflineSyncActivityEvents,
  getOfflineSyncConflictDecisions,
  getOfflineSyncHealth,
  getOfflineSyncQueue,
  getLocalTerminalSnapshots,
  getSyncBatches,
  getSyncConflicts,
  holdConflictForReview,
  markQueueItemSyncedPlaceholder,
  prepareSyncBatch,
  retryFailedItems,
  retryQueueItem,
  runSyncBatchPlaceholder,
  setNetworkStatusPlaceholder,
  updateQueueItem,
  resolveSyncConflict
} from '../services/offlineSyncService';
import { getFirebaseEnvironmentSummary, getFirebaseHealthStatus, getFirebaseReadinessChecklist } from '../services/firebaseHealthService';
import { getRepositoryDescriptors, getRepositoryHealthSummary } from '../services/repositoryHealthService';
import { firestoreDataContracts, getFirestoreContractStatus } from '../firebase/firestoreDataRegistry';
import { createDisabledFirestoreRepository } from '../repositories/disabledFirestoreRepository';
import { createMockLocalRepository } from '../repositories/mockLocalRepository';
import { formatSyncStatus, isRetryAllowed } from '../utils/offlineSyncUtils';
import { canPerformAction } from '../utils/posPermissions';
import { getActiveVendorId } from '../utils/vendorDataMode';

interface PosSyncDeskProps {
  session?: PosSession;
}

type Tab = 'Sync Overview' | 'Offline Queue' | 'Sync Batches' | 'Conflicts' | 'Terminal Health' | 'Local Snapshots' | 'Sync Activity';

const tabs: Tab[] = ['Sync Overview', 'Offline Queue', 'Sync Batches', 'Conflicts', 'Terminal Health', 'Local Snapshots', 'Sync Activity'];
const entityTypes: Array<'ALL' | SyncEntityType> = ['ALL', 'Sale', 'Receipt', 'Payment', 'Customer Request', 'Approval Request', 'Delivery Request', 'Inventory Movement', 'Purchase Order', 'Goods Receiving', 'Supplier Return', 'Stock Adjustment', 'Stocktake', 'Stock Transfer', 'Accounting Readiness', 'BI Event', 'Audit Event', 'Settings Change', 'Terminal Session', 'Shift Session'];
const queueStatuses: Array<'ALL' | SyncQueueStatus> = ['ALL', 'Queued', 'Ready To Sync', 'Syncing', 'Synced', 'Failed', 'Conflict', 'Cancelled', 'Held For Review'];
const priorities: Array<'ALL' | SyncPriority> = ['ALL', 'Low', 'Normal', 'High', 'Critical'];
const SHOW_DEV_BADGES = false;

export default function PosSyncDesk({ session }: PosSyncDeskProps) {
  const role = (session?.role || 'Owner') as Role;
  const staffId = session?.staffName || 'ST-ADMIN';
  const staffName = session?.staffName || 'Admin User';
  const [activeTab, setActiveTab] = useState<Tab>('Sync Overview');
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>('Unknown');
  const [queue, setQueue] = useState<OfflineSyncQueueItem[]>([]);
  const [batches, setBatches] = useState<OfflineSyncBatch[]>([]);
  const [conflicts, setConflicts] = useState<OfflineSyncConflict[]>([]);
  const [decisions, setDecisions] = useState<OfflineSyncConflictDecision[]>([]);
  const [health, setHealth] = useState<OfflineSyncHealth[]>([]);
  const [snapshots, setSnapshots] = useState<LocalTerminalSnapshot[]>([]);
  const [activity, setActivity] = useState<OfflineSyncActivityEvent[]>([]);
  const [filters, setFilters] = useState<OfflineSyncFilterState>({ entityType: 'ALL', status: 'ALL', priority: 'ALL', conflictType: 'ALL' });
  const [notice, setNotice] = useState('');
  const [repositoryTestResult, setRepositoryTestResult] = useState('');
  const [selectedQueueItem, setSelectedQueueItem] = useState<OfflineSyncQueueItem | null>(null);
  const [selectedConflict, setSelectedConflict] = useState<OfflineSyncConflict | null>(null);

  const canResolve = canPerformAction(role, 'sync.conflict.resolve') || role === 'Owner';
  const canRun = canPerformAction(role, 'sync.batch.run') || role === 'Owner';
  const canRetry = canPerformAction(role, 'sync.retry') || role === 'Owner';
  const canExport = canPerformAction(role, 'sync.export') || role === 'Owner';
  const cashierBlocked = (conflict: OfflineSyncConflict) => role === 'Cashier' && (conflict.riskLevel === 'High' || conflict.riskLevel === 'Critical');

  const load = async () => {
    const [network, q, batchRows, conflictRows, decisionRows, healthRows, snapshotRows, activityRows] = await Promise.all([
      getNetworkStatus(),
      getOfflineSyncQueue(filters),
      getSyncBatches(filters),
      getSyncConflicts(filters),
      getOfflineSyncConflictDecisions(),
      getOfflineSyncHealth(filters),
      getLocalTerminalSnapshots(filters),
      getOfflineSyncActivityEvents(filters)
    ]);
    setNetworkStatus(network);
    setQueue(q);
    setBatches(batchRows);
    setConflicts(conflictRows);
    setDecisions(decisionRows);
    setHealth(healthRows);
    setSnapshots(snapshotRows);
    setActivity(activityRows);
  };

  useEffect(() => {
    void load();
  }, [filters.entityType, filters.status, filters.priority, filters.branchId, filters.terminalId, filters.staffId, filters.dateFrom, filters.dateTo, filters.conflictType, filters.searchReference]);

  const show = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 4500);
  };

  const summary = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const activeHealth = health[0]?.syncHealth || 'Unknown';
    return {
      networkStatus,
      queuedItems: queue.filter((item) => item.status === 'Queued').length,
      readyToSync: queue.filter((item) => item.status === 'Ready To Sync').length,
      failedItems: queue.filter((item) => item.status === 'Failed').length,
      conflicts: queue.filter((item) => item.status === 'Conflict').length || conflicts.length,
      syncedToday: queue.filter((item) => item.status === 'Synced' && item.syncedAt?.startsWith(today)).length,
      heldForReview: queue.filter((item) => item.status === 'Held For Review').length,
      criticalItems: queue.filter((item) => item.priority === 'Critical').length,
      lastSync: queue.find((item) => item.syncedAt)?.syncedAt || health.find((row) => row.lastSyncAt)?.lastSyncAt || 'No sync today',
      terminalHealth: activeHealth
    };
  }, [queue, conflicts, health, networkStatus]);

  const blocked = () => show('You do not have permission to perform this action.');

  const retry = async (queueId: string) => {
    if (!canRetry) return blocked();
    const item = queue.find((row) => row.queueId === queueId);
    if (item && !isRetryAllowed(item)) return show(item.status === 'Synced' ? 'Synced item cannot be retried.' : 'Conflict item must be resolved before sync.');
    await retryQueueItem(queueId, staffId);
    show('Retry prepared.');
    await load();
  };

  const markSynced = async (queueId: string) => {
    if (!canRun) return blocked();
    await markQueueItemSyncedPlaceholder(queueId, staffId);
    show('Item marked synced.');
    await load();
  };

  const holdItem = async (queueId: string) => {
    await updateQueueItem(queueId, { status: 'Held For Review', notes: 'Held for review from Sync Desk.' });
    show('Queue item held for review.');
    await load();
  };

  const cancelItem = async (queueId: string) => {
    const reason = window.prompt('Reason required to cancel local queue item.');
    if (!reason) return;
    await cancelQueueItem(queueId, staffId, reason);
    show('Queue item cancelled locally. Original audit trail remains.');
    await load();
  };

  const detectConflict = async (item: OfflineSyncQueueItem) => {
    await detectSyncConflict(item);
    show('Conflict detected and displayed for review.');
    await load();
  };

  const resolveConflict = async (conflict: OfflineSyncConflict, resolution: SyncConflictResolution, reason: string) => {
    if (!canResolve || cashierBlocked(conflict)) return blocked();
    await resolveSyncConflict(conflict.conflictId, { resolution, staffId, staffName, reason });
    show('Conflict decision recorded with staff, reason, and decision.');
    setSelectedConflict(null);
    await load();
  };

  const runExport = async () => {
    if (!canExport) return blocked();
    await exportSyncReportPlaceholder(filters);
    show('Sync report export prepared.');
    await load();
  };

  const branchOptions = Array.from(new Set([...queue.map((item) => item.branchId), ...health.map((item) => item.branchId), ...snapshots.map((item) => item.branchId)]));
  const terminalOptions = Array.from(new Set([...queue.map((item) => item.terminalId), ...health.map((item) => item.terminalId), ...snapshots.map((item) => item.terminalId)]));
  const staffOptions = Array.from(new Set(queue.map((item) => item.staffId)));
  const firebaseHealth = getFirebaseHealthStatus();
  const firebaseSummary = getFirebaseEnvironmentSummary();
  const firebaseChecklist = getFirebaseReadinessChecklist();
  const firestoreContractStatus = getFirestoreContractStatus();
  const repositoryHealthSummary = getRepositoryHealthSummary();
  const repositoryDescriptors = getRepositoryDescriptors();

  const testMockRepository = async () => {
    const repository = createMockLocalRepository({ entityName: 'Repository Test', initialRows: [{ id: 'repo-test-1', label: 'Local Ready' }] });
    const result = await repository.list({ vendorId: getActiveVendorId() });
    setRepositoryTestResult(result.ok ? `Offline workspace returned ${result.rows.length} row(s).` : result.error || 'Offline workspace check failed.');
  };

  const testDisabledFirestoreRepository = async () => {
    const repository = createDisabledFirestoreRepository<{ id: string }>('Repository Test');
    const result = await repository.create({ id: 'disabled-test' }, { vendorId: getActiveVendorId(), reason: 'Repository readiness check' });
    setRepositoryTestResult(result.error || 'Repository returned no message.');
  };

  return (
    <div className="space-y-5 text-[#111827] pb-10">
      <header className="bg-white border-2 border-[#b1b5c2]">
        <div className="bg-[#1e222b] text-white p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="text-[10px] text-orange-400 font-black uppercase">Offline-first sync control</p>
            <h1 className="text-xl font-black uppercase">Sync Desk</h1>
            <p className="text-[11px] text-slate-200 font-bold">Offline queue, sync batches, conflict resolution, and terminal sync health.</p>
          </div>
          <div className="flex gap-2">
            {(['Online', 'Offline', 'Unstable'] as NetworkStatus[]).map((status) => <button key={status} className={`px-3 py-2 border text-[10px] font-black uppercase ${networkStatus === status ? 'bg-orange-600 border-orange-700 text-white' : 'bg-white text-[#1e222b] border-white'}`} onClick={async () => { await setNetworkStatusPlaceholder(status); show(`Network status set to ${status}.`); await load(); }}>{status === 'Online' ? <Wifi className="inline w-3 h-3 mr-1" /> : <WifiOff className="inline w-3 h-3 mr-1" />}{status}</button>)}
          </div>
        </div>
        <div className="p-3 bg-orange-50 border-t border-orange-200 text-[11px] font-bold text-orange-950 flex gap-2"><AlertTriangle size={16} /> Sync actions use the current workspace and queue safely when offline.</div>
      </header>

      {notice && <div className="bg-emerald-50 border-2 border-emerald-500 text-emerald-900 p-3 text-xs font-bold">{notice}</div>}

      <section className="grid grid-cols-2 md:grid-cols-5 xl:grid-cols-10 gap-2">
        {[
          ['Network Status', summary.networkStatus], ['Queued Items', summary.queuedItems], ['Ready To Sync', summary.readyToSync], ['Failed Items', summary.failedItems],
          ['Conflicts', summary.conflicts], ['Synced Today', summary.syncedToday], ['Held For Review', summary.heldForReview], ['Critical Items', summary.criticalItems],
          ['Last Sync', summary.lastSync], ['Terminal Health', summary.terminalHealth]
        ].map(([label, value]) => <div key={label} className="bg-white border border-[#b1b5c2] border-l-4 border-l-orange-600 p-3 min-h-20"><span className="text-[9px] text-slate-500 uppercase font-black">{label}</span><strong className="block text-sm text-[#1e222b] break-words">{value}</strong></div>)}
      </section>

      <section className="bg-white border-2 border-[#b1b5c2]">
        <div className="bg-[#1e222b] text-white p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div>
            <p className="text-[9px] text-orange-400 uppercase font-black">Cloud Sync Readiness</p>
            <h2 className="text-sm font-black uppercase">Cloud Services Preparation</h2>
          </div>
          <span className={`px-2 py-1 border text-[9px] font-black uppercase ${firebaseHealth.configured ? 'bg-emerald-50 border-emerald-400 text-emerald-800' : 'bg-orange-50 border-orange-400 text-orange-900'}`}>
            {firebaseHealth.configured ? 'Config Ready' : 'Config Missing'}
          </span>
        </div>
        <div className="p-3 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2">
            {firebaseSummary.map(([label, value]) => <ReadinessMetric key={label} label={label} value={value} />)}
            <ReadinessMetric label="Cloud Data Contracts" value={firestoreContractStatus.ready ? 'Ready' : 'Missing'} />
            <ReadinessMetric label="Mapped Entities Count" value={String(firestoreContractStatus.mappedEntitiesCount)} />
            <ReadinessMetric label="Live Reads" value={firestoreContractStatus.liveReads} />
            <ReadinessMetric label="Live Writes" value={firestoreContractStatus.liveWrites} />
            <ReadinessMetric label="Repositories" value={firestoreContractStatus.repositories} />
            <ReadinessMetric label="Next Step" value={firestoreContractStatus.nextStep} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="border border-[#b1b5c2] p-3">
              <div className="text-[9px] text-slate-500 uppercase font-black mb-2">Readiness Checklist</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {firebaseChecklist.map((item) => <div key={item.label} className="flex items-center justify-between gap-2 border border-[#d6d9e0] p-2 text-[10px] font-black uppercase"><span>{item.label}</span><Badge value={item.status} /></div>)}
              </div>
            </div>
            <div className="border border-orange-200 bg-orange-50 p-3 text-[10px] text-orange-950 font-bold uppercase space-y-2">
              <p>Cloud sync preparation is in progress. POS workflows continue safely in the offline workspace until full cloud services are activated.</p>
              {firebaseHealth.missingKeys.length > 0 && <p>Missing keys: {firebaseHealth.missingKeys.join(', ')}</p>}
              {firebaseHealth.warnings.map((warning) => <p key={warning}>{warning}</p>)}
            </div>
          </div>
          <div className="border border-[#b1b5c2] overflow-x-auto">
            <table className="w-full text-left text-[10px]">
              <thead className="bg-[#1e222b] text-white uppercase">
                <tr>
                  {['Entity', 'Collection', 'Source', 'Reads', 'Writes', 'Offline Sync', 'Status'].map((header) => <th key={header} className="p-2 whitespace-nowrap">{header}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d6d9e0]">
                {firestoreDataContracts.map((contract) => (
                  <tr key={contract.entityType}>
                    <td className="p-2 font-black uppercase text-[#1e222b]">{contract.entityType}</td>
                    <td className="p-2 font-semibold text-slate-700">{contract.collectionPathName}</td>
                    <td className="p-2"><Badge value="Offline Cache" /></td>
                    <td className="p-2"><Badge value={contract.liveReadsEnabled ? 'Enabled' : 'Disabled'} /></td>
                    <td className="p-2"><Badge value={contract.liveWritesEnabled ? 'Enabled' : 'Disabled'} /></td>
                    <td className="p-2"><Badge value={contract.offlineSyncEnabledPlaceholder ? 'Ready' : 'Off'} /></td>
                    <td className="p-2"><Badge value="Ready" /></td>
                  </tr>
                ))}
                {SHOW_DEV_BADGES && ['connectivityTests', 'repositoryTests', 'syncNotes'].map((entity) => (
                  <tr key={entity}>
                    <td className="p-2 font-black uppercase text-[#1e222b]">{entity}</td>
                    <td className="p-2 font-semibold text-slate-700">{entity}</td>
                    <td className="p-2"><Badge value="Cloud Readiness" /></td>
                    <td className="p-2"><Badge value="Enabled" /></td>
                    <td className="p-2"><Badge value="Enabled" /></td>
                    <td className="p-2"><Badge value="Disabled" /></td>
                    <td className="p-2"><Badge value="Ready" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="bg-white border-2 border-[#b1b5c2]">
        <div className="bg-[#1e222b] text-white p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div>
            <p className="text-[9px] text-orange-400 uppercase font-black">Repository Layer Readiness</p>
            <h2 className="text-sm font-black uppercase">Service Boundary Preparation</h2>
          </div>
          <span className="px-2 py-1 border text-[9px] font-black uppercase bg-slate-50 border-slate-300 text-slate-800">
            {repositoryHealthSummary.currentDefaultSourceMode}
          </span>
        </div>
        <div className="p-3 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2">
            <ReadinessMetric label="Total Repositories" value={String(repositoryHealthSummary.totalRepositories)} />
            <ReadinessMetric label="Offline Cache Active" value={String(repositoryHealthSummary.mockLocalRepositories)} />
            <ReadinessMetric label="Cloud Pending" value={String(repositoryHealthSummary.firestoreDisabledRepositories)} />
            <ReadinessMetric label="Live Reads" value={String(repositoryHealthSummary.liveReadEnabledCount)} />
            <ReadinessMetric label="Live Writes" value={String(repositoryHealthSummary.liveWriteEnabledCount)} />
            <ReadinessMetric label="Offline Queue Enabled" value={String(repositoryHealthSummary.offlineQueueEnabledCount)} />
            <ReadinessMetric label="Default Source Mode" value={repositoryHealthSummary.currentDefaultSourceMode} />
            <ReadinessMetric label="Cloud Readiness" value={repositoryHealthSummary.sandboxReadsEnabled && repositoryHealthSummary.sandboxWritesEnabled ? 'Enabled' : 'Disabled'} />
            <ReadinessMetric label="Business Cloud Sync" value={!repositoryHealthSummary.businessReadsEnabled && !repositoryHealthSummary.businessWritesEnabled ? 'Disabled' : 'Enabled'} />
          </div>
          <div className="border border-orange-200 bg-orange-50 p-3 text-[10px] text-orange-950 font-bold uppercase">
            Repository boundaries are prepared. Cloud reads and writes remain pending until activation.
          </div>
          <div className="border border-[#b1b5c2] overflow-x-auto">
            <table className="w-full text-left text-[10px]">
              <thead className="bg-[#1e222b] text-white uppercase">
                <tr>
                  {['Module', 'Entity', 'Source Mode', 'Reads', 'Writes', 'Offline Queue', 'Health', 'Notes'].map((header) => <th key={header} className="p-2 whitespace-nowrap">{header}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d6d9e0]">
                {repositoryDescriptors.map((descriptor) => (
                  <tr key={`${descriptor.moduleName}-${descriptor.entityName}`}>
                    <td className="p-2 font-black uppercase text-[#1e222b]">{descriptor.moduleName}</td>
                    <td className="p-2 font-semibold text-slate-700">{descriptor.entityName}</td>
                    <td className="p-2"><Badge value={descriptor.sourceMode} /></td>
                    <td className="p-2"><Badge value={descriptor.liveReadsEnabled ? 'Enabled' : 'Disabled'} /></td>
                    <td className="p-2"><Badge value={descriptor.liveWritesEnabled ? 'Enabled' : 'Disabled'} /></td>
                    <td className="p-2"><Badge value={descriptor.offlineQueueEnabled ? 'Enabled' : 'Disabled'} /></td>
                    <td className="p-2"><Badge value={descriptor.healthStatus} /></td>
                    <td className="p-2 font-semibold text-slate-700">{descriptor.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border border-[#b1b5c2] p-3">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div>
                <div className="text-[9px] text-slate-500 uppercase font-black">Repository Test Panel</div>
                <p className="text-[10px] text-slate-700 font-bold uppercase">Readiness check only. No business data is posted.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => void testMockRepository()}>Test Local Repository</button>
                <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => void testDisabledFirestoreRepository()}>Test Cloud Repository</button>
              </div>
            </div>
            {repositoryTestResult && <div className="mt-3 border border-[#d6d9e0] bg-slate-50 p-2 text-[10px] font-black uppercase text-[#1e222b]">{repositoryTestResult}</div>}
          </div>
        </div>
      </section>

      {SHOW_DEV_BADGES && <AuthPreviewPanel />}

      <section className="bg-white border-2 border-[#b1b5c2] p-3">
        <div className="grid grid-cols-2 md:grid-cols-5 xl:grid-cols-10 gap-2">
          <Select label="Entity Type" value={filters.entityType || 'ALL'} options={entityTypes} onChange={(value) => setFilters({ ...filters, entityType: value as OfflineSyncFilterState['entityType'] })} />
          <Select label="Status" value={filters.status || 'ALL'} options={queueStatuses} onChange={(value) => setFilters({ ...filters, status: value as OfflineSyncFilterState['status'] })} />
          <Select label="Priority" value={filters.priority || 'ALL'} options={priorities} onChange={(value) => setFilters({ ...filters, priority: value as OfflineSyncFilterState['priority'] })} />
          <Select label="Branch" value={filters.branchId || 'ALL'} options={['ALL', ...branchOptions]} onChange={(value) => setFilters({ ...filters, branchId: value })} />
          <Select label="Terminal" value={filters.terminalId || 'ALL'} options={['ALL', ...terminalOptions]} onChange={(value) => setFilters({ ...filters, terminalId: value })} />
          <Select label="Staff" value={filters.staffId || 'ALL'} options={['ALL', ...staffOptions]} onChange={(value) => setFilters({ ...filters, staffId: value })} />
          <Input label="Date From" type="date" value={filters.dateFrom || ''} onChange={(value) => setFilters({ ...filters, dateFrom: value })} />
          <Input label="Date To" type="date" value={filters.dateTo || ''} onChange={(value) => setFilters({ ...filters, dateTo: value })} />
          <Select label="Conflict Type" value={filters.conflictType || 'ALL'} options={['ALL', 'Duplicate Receipt', 'Stock Quantity Conflict', 'Customer Duplicate', 'Shift Closed Remotely', 'Version Mismatch', 'Permission Conflict']} onChange={(value) => setFilters({ ...filters, conflictType: value as OfflineSyncFilterState['conflictType'] })} />
          <label className="text-[9px] uppercase font-black text-slate-500">Search Reference<div className="relative"><Search className="absolute left-2 top-2.5 w-3 h-3 text-slate-400" /><input className="w-full pl-7 p-2 border border-[#b1b5c2] text-xs" value={filters.searchReference || ''} onChange={(event) => setFilters({ ...filters, searchReference: event.target.value })} /></div></label>
        </div>
      </section>

      <nav className="flex flex-wrap gap-1">
        {tabs.map((tab) => <button key={tab} className={`px-3 py-2 border text-[10px] font-black uppercase ${activeTab === tab ? 'bg-orange-600 text-white border-orange-700' : 'bg-white text-[#1e222b] border-[#b1b5c2]'}`} onClick={() => setActiveTab(tab)}>{tab}</button>)}
      </nav>

      {activeTab === 'Sync Overview' && <Overview queue={queue} conflicts={conflicts} health={health} onCreateBatch={async () => { await createSyncBatch(filters, staffId); show('Sync batch created locally.'); await load(); }} onExport={runExport} />}
      {activeTab === 'Offline Queue' && <QueueTable queue={queue} onView={setSelectedQueueItem} onRetry={retry} onMarkSynced={markSynced} onDetectConflict={detectConflict} onHold={holdItem} onCancel={cancelItem} onPrepareBatch={async () => { await createSyncBatch(filters, staffId); show('Batch prepared from current filters.'); await load(); }} />}
      {activeTab === 'Sync Batches' && <BatchTable batches={batches} canRun={canRun} onPrepare={async (id) => { await prepareSyncBatch(id); show('Batch prepared locally.'); await load(); }} onRun={async (id) => { if (!canRun) return blocked(); await runSyncBatchPlaceholder(id, staffId); show('Run Sync Placeholder completed locally.'); await load(); }} onRetryFailed={async () => { await retryFailedItems(filters, staffId); show('Failed items moved to retry placeholder.'); await load(); }} onExport={runExport} />}
      {activeTab === 'Conflicts' && <ConflictTable conflicts={conflicts} onView={setSelectedConflict} onResolve={(conflict, resolution) => void resolveConflict(conflict, resolution, `${resolution} from Conflicts tab.`)} onHold={async (conflict) => { await holdConflictForReview(conflict.conflictId, staffId, 'Held from Conflicts tab.'); show('Conflict held for review.'); await load(); }} canResolve={(conflict) => canResolve && !cashierBlocked(conflict)} />}
      {activeTab === 'Terminal Health' && <HealthTable rows={health} onSnapshot={(terminalId) => setActiveTab('Local Snapshots')} onBatch={async () => { await createSyncBatch(filters, staffId); show('Terminal batch created locally.'); await load(); }} onExport={runExport} />}
      {activeTab === 'Local Snapshots' && <SnapshotTable rows={snapshots} onClear={async () => { await clearSyncedItemsPlaceholder(filters, staffId); show('Synced placeholder items cleared. Unsynced data preserved.'); await load(); }} onExport={runExport} />}
      {activeTab === 'Sync Activity' && <ActivityTable rows={activity} />}

      {selectedQueueItem && <OfflineQueueItemForm item={selectedQueueItem} conflict={conflicts.find((conflict) => conflict.conflictId === selectedQueueItem.conflictId)} activity={activity} onClose={() => setSelectedQueueItem(null)} onRetry={retry} onMarkSynced={markSynced} onDetectConflict={detectConflict} onHold={holdItem} onCancel={cancelItem} onPrepareExport={() => void runExport()} />}
      {selectedConflict && <SyncConflictForm conflict={selectedConflict} decisions={decisions.filter((decision) => decision.conflictId === selectedConflict.conflictId)} activity={activity} onClose={() => setSelectedConflict(null)} onResolve={(resolution, reason) => void resolveConflict(selectedConflict, resolution, reason)} />}
    </div>
  );
}

function Overview({ queue, conflicts, health, onCreateBatch, onExport }: { queue: OfflineSyncQueueItem[]; conflicts: OfflineSyncConflict[]; health: OfflineSyncHealth[]; onCreateBatch: () => void; onExport: () => void }) {
  return <section className="grid grid-cols-1 lg:grid-cols-3 gap-4"><Panel title="Pending Work"><p>{queue.filter((item) => item.status !== 'Synced' && item.status !== 'Cancelled').length} offline queue item(s) need sync, review, or placeholder action.</p><p>{conflicts.length} conflict record(s) are visible and will not be overwritten silently.</p></Panel><Panel title="Terminal Sync Health"><p>{health.map((row) => `${row.terminalId}: ${row.syncHealth}`).join(' | ')}</p></Panel><Panel title="Local Actions"><div className="flex gap-2 flex-wrap"><button className="sci-pos-button sci-pos-button--primary" onClick={onCreateBatch}><RefreshCw size={14} />Create Batch</button><button className="sci-pos-button sci-pos-button--secondary" onClick={onExport}><Download size={14} />Export Placeholder</button></div></Panel></section>;
}

function QueueTable(props: { queue: OfflineSyncQueueItem[]; onView: (item: OfflineSyncQueueItem) => void; onRetry: (id: string) => void; onMarkSynced: (id: string) => void; onDetectConflict: (item: OfflineSyncQueueItem) => void; onHold: (id: string) => void; onCancel: (id: string) => void; onPrepareBatch: () => void }) {
  return <Table headers={['Queue ID', 'Entity', 'Reference', 'Operation', 'Branch', 'Terminal', 'Staff', 'Priority', 'Status', 'Retry', 'Queued At', 'Last Attempt', 'Action']}>{props.queue.map((item) => <tr key={item.queueId}><Td strong>{item.queueId}</Td><Td>{item.entityType}</Td><Td>{item.entityNumber || item.entityId}</Td><Td>{item.operationType}</Td><Td>{item.branchId}</Td><Td>{item.terminalId}</Td><Td>{item.staffName}</Td><Td><Badge value={item.priority} /></Td><Td><Badge value={formatSyncStatus(item.status)} /></Td><Td>{item.retryCount}</Td><Td>{dateLabel(item.queuedAt)}</Td><Td>{item.lastAttemptAt ? dateLabel(item.lastAttemptAt) : '-'}</Td><Td><div className="flex flex-wrap gap-1"><IconButton label="View Payload" onClick={() => props.onView(item)} /><Action label="Retry" onClick={() => props.onRetry(item.queueId)} /><Action label="Mark Synced Placeholder" onClick={() => props.onMarkSynced(item.queueId)} /><Action label="Detect Conflict" onClick={() => props.onDetectConflict(item)} /><Action label="Hold" onClick={() => props.onHold(item.queueId)} /><Action label="Cancel" danger onClick={() => props.onCancel(item.queueId)} /><Action label="Prepare Batch" onClick={props.onPrepareBatch} /></div></Td></tr>)}</Table>;
}

function BatchTable({ batches, canRun, onPrepare, onRun, onRetryFailed, onExport }: { batches: OfflineSyncBatch[]; canRun: boolean; onPrepare: (id: string) => void; onRun: (id: string) => void; onRetryFailed: () => void; onExport: () => void }) {
  return <Table headers={['Batch ID', 'Date', 'Branch', 'Terminal', 'Created By', 'Items', 'High Priority', 'Failed', 'Conflicts', 'Status', 'Completed At', 'Action']}>{batches.map((batch) => <tr key={batch.batchId}><Td strong>{batch.batchId}</Td><Td>{dateLabel(batch.createdAt)}</Td><Td>{batch.branchId}</Td><Td>{batch.terminalId}</Td><Td>{batch.createdByStaffName}</Td><Td>{batch.itemCount}</Td><Td>{batch.highPriorityCount}</Td><Td>{batch.failedCount}</Td><Td>{batch.conflictCount}</Td><Td><Badge value={batch.status} /></Td><Td>{batch.completedAt ? dateLabel(batch.completedAt) : '-'}</Td><Td><div className="flex flex-wrap gap-1"><Action label="View Batch" onClick={() => undefined} /><Action label="Prepare Sync" onClick={() => onPrepare(batch.batchId)} /><Action label="Run Sync Placeholder" onClick={() => canRun && onRun(batch.batchId)} /><Action label="Retry Failed" onClick={onRetryFailed} /><Action label="Export Placeholder" onClick={onExport} /></div></Td></tr>)}</Table>;
}

function ConflictTable({ conflicts, onView, onResolve, onHold, canResolve }: { conflicts: OfflineSyncConflict[]; onView: (conflict: OfflineSyncConflict) => void; onResolve: (conflict: OfflineSyncConflict, resolution: SyncConflictResolution) => void; onHold: (conflict: OfflineSyncConflict) => void; canResolve: (conflict: OfflineSyncConflict) => boolean }) {
  return <Table headers={['Conflict ID', 'Queue ID', 'Entity', 'Reference', 'Conflict Type', 'Branch', 'Terminal', 'Risk', 'Recommended Resolution', 'Status', 'Detected At', 'Action']}>{conflicts.map((conflict) => <tr key={conflict.conflictId}><Td strong>{conflict.conflictId}</Td><Td>{conflict.queueId}</Td><Td>{conflict.entityType}</Td><Td>{conflict.entityNumber || conflict.entityId}</Td><Td>{conflict.conflictType}</Td><Td>{conflict.branchId}</Td><Td>{conflict.terminalId}</Td><Td><Badge value={conflict.riskLevel} /></Td><Td>{conflict.recommendedResolution}</Td><Td><Badge value={conflict.status} /></Td><Td>{dateLabel(conflict.detectedAt)}</Td><Td><div className="flex flex-wrap gap-1"><IconButton label="View Conflict" onClick={() => onView(conflict)} /><Action label="Use Local Placeholder" onClick={() => canResolve(conflict) && onResolve(conflict, 'Use Local')} /><Action label="Use Remote Placeholder" onClick={() => canResolve(conflict) && onResolve(conflict, 'Use Remote')} /><Action label="Merge Placeholder" onClick={() => canResolve(conflict) && onResolve(conflict, 'Merge')} /><Action label="Retry" onClick={() => canResolve(conflict) && onResolve(conflict, 'Retry')} /><Action label="Hold For Review" onClick={() => onHold(conflict)} /><Action label="Cancel Local" danger onClick={() => canResolve(conflict) && onResolve(conflict, 'Cancel Local')} /></div></Td></tr>)}</Table>;
}

function HealthTable({ rows, onBatch, onExport }: { rows: OfflineSyncHealth[]; onSnapshot: (terminalId: string) => void; onBatch: () => void; onExport: () => void }) {
  return <Table headers={['Terminal', 'Branch', 'Network Status', 'Last Sync', 'Queue Count', 'Failed Count', 'Conflict Count', 'Local Storage Status', 'Sync Health', 'Action']}>{rows.map((row) => <tr key={row.terminalId}><Td strong>{row.terminalName}</Td><Td>{row.branchName}</Td><Td>{row.networkStatus}</Td><Td>{row.lastSyncAt ? dateLabel(row.lastSyncAt) : '-'}</Td><Td>{row.queueCount}</Td><Td>{row.failedCount}</Td><Td>{row.conflictCount}</Td><Td>{row.localStorageStatus}</Td><Td><Badge value={row.syncHealth} /></Td><Td><div className="flex gap-1 flex-wrap"><Action label="View Snapshot" onClick={() => undefined} /><Action label="Prepare Sync Batch" onClick={onBatch} /><Action label="Export Placeholder" onClick={onExport} /></div></Td></tr>)}</Table>;
}

function SnapshotTable({ rows, onClear, onExport }: { rows: LocalTerminalSnapshot[]; onClear: () => void; onExport: () => void }) {
  return <Table headers={['Terminal', 'Branch', 'Staff', 'Open Shift', 'Local Receipts', 'Local Customers', 'Local Deliveries', 'Local Inventory Events', 'Local BI Events', 'Last Snapshot', 'Storage Estimate', 'Action']}>{rows.map((row) => <tr key={row.snapshotId}><Td strong>{row.terminalName}</Td><Td>{row.branchName}</Td><Td>{row.staffName}</Td><Td>{row.openShiftId || '-'}</Td><Td>{row.localReceipts}</Td><Td>{row.localCustomers}</Td><Td>{row.localDeliveries}</Td><Td>{row.localInventoryEvents}</Td><Td>{row.localBIEvents}</Td><Td>{dateLabel(row.lastSnapshotAt)}</Td><Td>{row.storageEstimate}</Td><Td><div className="flex gap-1 flex-wrap"><Action label="View Snapshot" onClick={() => undefined} /><Action label="Export Placeholder" onClick={onExport} /><Action label="Clear Synced Placeholder" onClick={onClear} /></div></Td></tr>)}</Table>;
}

function ActivityTable({ rows }: { rows: OfflineSyncActivityEvent[] }) {
  return <Table headers={['Date', 'Event', 'Queue', 'Batch', 'Conflict', 'Staff', 'Terminal', 'Message']}>{rows.map((row) => <tr key={row.eventId}><Td>{dateLabel(row.createdAt)}</Td><Td strong>{row.eventType.replace(/_/g, ' ')}</Td><Td>{row.queueId || '-'}</Td><Td>{row.batchId || '-'}</Td><Td>{row.conflictId || '-'}</Td><Td>{row.staffName || row.staffId || '-'}</Td><Td>{row.terminalId || '-'}</Td><Td>{row.message}</Td></tr>)}</Table>;
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <section className="bg-white border-2 border-[#b1b5c2]"><div className="bg-[#1e222b] text-white p-3 text-[10px] font-black uppercase">{title}</div><div className="p-4 text-xs font-bold text-slate-700 space-y-2">{children}</div></section>;
}

function ReadinessMetric({ label, value }: { label: string; value: string }) {
  return <div className="border border-[#b1b5c2] bg-slate-50 p-3 min-h-16"><span className="block text-[8.5px] text-slate-500 uppercase font-black">{label}</span><strong className="block mt-1 text-[11px] text-[#1e222b] uppercase break-words">{value}</strong></div>;
}

function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return <section className="bg-white border-2 border-[#b1b5c2] overflow-x-auto"><table className="w-full text-left text-[11px]"><thead className="bg-[#1e222b] text-white uppercase text-[9px]"><tr>{headers.map((header) => <th key={header} className="p-3 whitespace-nowrap">{header}</th>)}</tr></thead><tbody className="divide-y divide-[#d6d9e0]">{children}</tbody></table></section>;
}

function Td({ children, strong }: { children: ReactNode; strong?: boolean }) {
  return <td className={`p-3 align-top ${strong ? 'font-black text-[#1e222b]' : 'font-semibold text-slate-700'}`}>{children}</td>;
}

function Badge({ value }: { value: string }) {
  const danger = ['Critical', 'Failed', 'Conflict', 'Offline'].includes(value);
  const warn = ['High', 'Held For Review', 'Warning', 'Unstable'].includes(value);
  return <span className={`px-2 py-1 border text-[9px] font-black uppercase whitespace-nowrap ${danger ? 'bg-rose-50 border-rose-400 text-rose-800' : warn ? 'bg-orange-50 border-orange-400 text-orange-800' : 'bg-slate-50 border-slate-300 text-slate-800'}`}>{value}</span>;
}

function Action({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return <button className={`px-2 py-1 border text-[9px] font-black uppercase ${danger ? 'bg-rose-50 border-rose-400 text-rose-800' : 'bg-white border-[#b1b5c2] text-[#1e222b] hover:bg-orange-50'}`} onClick={onClick}>{label}</button>;
}

function IconButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button className="p-1.5 border border-[#b1b5c2] bg-white hover:bg-orange-50" title={label} onClick={onClick}><Eye size={13} /></button>;
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="text-[9px] uppercase font-black text-slate-500">{label}<select className="w-full p-2 border border-[#b1b5c2] text-xs bg-white" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function Input({ label, value, type, onChange }: { label: string; value: string; type: string; onChange: (value: string) => void }) {
  return <label className="text-[9px] uppercase font-black text-slate-500">{label}<input className="w-full p-2 border border-[#b1b5c2] text-xs" type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function dateLabel(value: string): string {
  return value ? value.replace('T', ' ').slice(0, 16) : '-';
}
