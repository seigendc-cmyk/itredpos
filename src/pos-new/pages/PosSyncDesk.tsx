import React, { useState, useEffect } from 'react';
import { 
  Wifi, 
  WifiOff, 
  Search, 
  Activity, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Trash2, 
  FileJson, 
  RefreshCw, 
  Eye, 
  ShieldAlert, 
  ArrowUpRight, 
  Database,
  Lock,
  UserCheck
} from 'lucide-react';
import { 
  PosSession, 
  SyncQueueItem, 
  SyncDomain, 
  SyncStatus, 
  SyncRisk, 
  SyncConflict, 
  SyncActivityEvent 
} from '../types/posTypes';
import { 
  getLocalSyncQueue, 
  runSyncCheck, 
  syncReadyItems, 
  flagSyncConflict, 
  clearSyncedItems, 
  exportQueuePlaceholder 
} from '../services/syncService';
import { 
  mockSyncConflicts 
} from '../mock/mockPosData';
import { 
  loadTerminalConnectivity, 
  saveTerminalConnectivity,
  loadLocalSyncActivity,
  addLocalSyncActivity,
  saveLocalQueue,
  updateLocalQueueItem
} from '../utils/localQueueStore';

interface PosSyncDeskProps {
  session?: PosSession;
}

export default function PosSyncDesk({ session }: PosSyncDeskProps) {
  // Central Session Variables
  const activeBranch = session?.branch || 'Harare Main';
  const staffName = session?.staffName || 'Admin Operator';
  const vendorName = session?.vendor || 'SCI Logistics Ltd';
  const terminalName = session?.terminal || 'Term-A';
  const userRole = session?.role || 'Owner';

  // State managers
  const [queue, setQueue] = useState<SyncQueueItem[]>([]);
  const [conflicts, setConflicts] = useState<SyncConflict[]>(mockSyncConflicts);
  const [activities, setActivities] = useState<SyncActivityEvent[]>([]);
  const [connectivity, setConnectivity] = useState<'ONLINE' | 'OFFLINE'>('ONLINE');
  const [lastSyncTime, setLastSyncTime] = useState<string>('Today 14:20');

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [domainFilter, setDomainFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [riskFilter, setRiskFilter] = useState<string>('ALL');

  // Interactive View Overlay / Selected Item Details
  const [activePayloadItem, setActivePayloadItem] = useState<SyncQueueItem | null>(null);

  // Status Notification Feedback
  const [feedback, setFeedback] = useState<{ type: 'success' | 'warning' | 'error'; message: string } | null>(null);

  // Initial Loading
  useEffect(() => {
    setConnectivity(loadTerminalConnectivity());
    loadAllSyncData();
  }, []);

  const loadAllSyncData = async () => {
    try {
      const q = await getLocalSyncQueue();
      const logs = loadLocalSyncActivity();
      setQueue(q);
      setActivities(logs);
    } catch (e) {
      console.error('Failed to bind Sync Desk storage buffers:', e);
    }
  };

  const showFeedback = (type: 'success' | 'warning' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000);
  };

  // Connectivity Toggles
  const handleToggleConnectivity = (status: 'ONLINE' | 'OFFLINE') => {
    saveTerminalConnectivity(status);
    setConnectivity(status);
    
    const eventType = status === 'OFFLINE' ? 'TERMINAL_OFFLINE_MODE_ENABLED' : 'TERMINAL_ONLINE_MODE_ENABLED';
    const msg = status === 'OFFLINE' 
      ? 'Terminal is OFFLINE. Operations are secured and cached inside LocalStorage SQLite drafts.' 
      : 'Terminal is ONLINE. Queue connections established. Verification is active for master syncing.';

    addLocalSyncActivity({
      eventType,
      message: msg,
      operator: staffName
    });

    showFeedback(
      status === 'OFFLINE' ? 'warning' : 'success', 
      StatusOfflineWarning(status)
    );
    loadAllSyncData();
  };

  const StatusOfflineWarning = (status: 'ONLINE' | 'OFFLINE') => {
    return status === 'OFFLINE' 
      ? 'Connectivity drop simulated. All upcoming actions will bypass remote APIs to write directly to buffer queue.'
      : 'Connectivity recovered. Master APIs re-registered.';
  };

  // Permission Checks: PART 1
  const isAllowedToManageAll = () => {
    return userRole === 'Owner' || userRole === 'SysAdmin';
  };

  const isAllowedToManageSync = () => {
    return isAllowedToManageAll() || userRole === 'Manager' || userRole === 'Supervisor';
  };

  const canActionRow = (item: SyncQueueItem) => {
    if (isAllowedToManageSync()) return true;
    if (userRole === 'Cashier' && item.domain === 'Sales') return true;
    if (userRole === 'Stock Controller' && item.domain === 'Stock') return true;
    return false;
  };

  const isRestrictedWorkerLevel = () => {
    return userRole === 'Cashier' || userRole === 'Stock Controller';
  };

  // Row Manipulation Handlers (Updates state and persistence)
  const handleMarkReady = (itemId: string) => {
    const updated = updateLocalQueueItem(itemId, { syncStatus: 'Ready' });
    if (updated) {
      addLocalSyncActivity({
        eventType: 'LOCAL_QUEUE_ITEM_CREATED',
        message: `Queue item override manually raised to READY state: [${itemId}]`,
        operator: staffName
      });
      showFeedback('success', `Item ${itemId} offset status updated to READY.`);
      loadAllSyncData();
    }
  };

  const handleSimulateSync = (itemId: string) => {
    if (connectivity === 'OFFLINE') {
      showFeedback('error', `Cannot transmit record ${itemId} while Terminal is OFFLINE.`);
      return;
    }
    const updated = updateLocalQueueItem(itemId, { syncStatus: 'Synced' });
    if (updated) {
      addLocalSyncActivity({
        eventType: 'LOCAL_QUEUE_SYNCED',
        message: `Direct row flush sync: Local record ${itemId} broadcasted to cloud endpoint.`,
        operator: staffName
      });
      showFeedback('success', `Direct sync completed for item ${itemId}.`);
      loadAllSyncData();
    }
  };

  const handleFlagConflict = async (itemId: string) => {
    const res = await flagSyncConflict(itemId, staffName);
    if (res) {
      showFeedback('warning', `Item ${itemId} flagged as Conflict. Dispatch log created.`);
      loadAllSyncData();
    }
  };

  const handleRemoveLocalDraft = (itemId: string) => {
    const updated = queue.filter(q => q.id !== itemId);
    saveLocalQueue(updated);

    addLocalSyncActivity({
      eventType: 'LOCAL_QUEUE_ITEM_CREATED',
      message: `Manual database scrub: Removed local item ${itemId} from buffer queue.`,
      operator: staffName
    });
    
    showFeedback('success', `Draft record ${itemId} permanently dropped from buffer.`);
    loadAllSyncData();
  };

  // PART 7: CENTRAL SYNC SIMULATIONS
  const handleRunSyncCheck = async () => {
    const updated = await runSyncCheck(staffName);
    setQueue(updated);
    showFeedback('success', 'Sync validation completed. Low-risk records are certified in ready state.');
    loadAllSyncData();
  };

  const handleSyncReadyItems = async () => {
    if (connectivity === 'OFFLINE') {
      showFeedback('error', 'Sync aborted: Terminal is currently offline. Establish a connection first.');
      return;
    }

    const updated = await syncReadyItems(staffName);
    setQueue(updated);
    setLastSyncTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
    showFeedback('success', 'Ready records have been pushed downstream to the master logistics database.');
    loadAllSyncData();
  };

  const handleClearSyncedItems = async () => {
    const updated = await clearSyncedItems(staffName);
    setQueue(updated);
    showFeedback('success', 'Local buffer scrubbed of all synchronized logs.');
    loadAllSyncData();
  };

  const handleExportJSON = async () => {
    const raw = await exportQueuePlaceholder(staffName);
    showFeedback('success', 'Queue export compiled for offline ledger audit.');
    loadAllSyncData();

    // Trigger raw download
    const blob = new Blob([raw], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `terminal_${terminalName}_sync_queue_draft.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Raw counts calculations: PART 3
  const getCountsByDomain = (dom: SyncDomain) => {
    return queue.filter(q => q.domain === dom && q.syncStatus !== 'Synced').length;
  };

  const pendingSalesCount = getCountsByDomain('Sales');
  const pendingStockCount = getCountsByDomain('Stock');
  const pendingCashCount = getCountsByDomain('Cash');
  const pendingBiCount = getCountsByDomain('BI');
  const pendingDeliveryCount = getCountsByDomain('Delivery');
  
  // Total risk or conflicts in list
  const hasCriticalConflict = queue.some(q => q.syncStatus === 'Conflict' || q.risk === 'Critical');
  const riskAssessment = hasCriticalConflict ? 'Review Required' : 'Minimal Risk';

  // Search/Filters application
  const filteredQueue = queue.filter(item => {
    const sTerm = searchTerm.toLowerCase();
    const matchesSearch = 
      item.id.toLowerCase().includes(sTerm) ||
      item.eventType.toLowerCase().includes(sTerm) ||
      item.reference.toLowerCase().includes(sTerm) ||
      item.createdBy.toLowerCase().includes(sTerm) ||
      item.payload.toLowerCase().includes(sTerm);

    const matchesDomain = domainFilter === 'ALL' || item.domain === domainFilter;
    const matchesStatus = statusFilter === 'ALL' || item.syncStatus === statusFilter;
    const matchesRisk = riskFilter === 'ALL' || item.risk === riskFilter;

    return matchesSearch && matchesDomain && matchesStatus && matchesRisk;
  });

  return (
    <div className="space-y-6 font-mono text-xs text-[#111827] select-none pb-12">
      
      {/* PART 2: PAGE HEADER */}
      <div className="bg-white border-2 border-[#b1b5c2] p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="text-[9px] font-black text-orange-600 uppercase tracking-widest">SCI OFFLINE RECONNECT SYNC CONTROL</div>
          <h1 className="text-sm font-black text-[#1e222b] uppercase flex items-center gap-2 mt-1">
            <RefreshCw className="w-5 h-5 text-orange-500 animate-spin-slow" />
            Sync Desk - Offline Terminal Queue & Sync Status
          </h1>
          
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2 text-[10px] text-slate-500">
            <span className="flex items-center gap-1">
              <strong>Tenant Vendor:</strong> <span className="bg-slate-100 text-[#1e222b] font-bold px-1.5 py-0.2">{vendorName}</span>
            </span>
            <span className="flex items-center gap-1">
              <strong>Branch:</strong> <span className="text-[#1e222b] font-bold">{activeBranch}</span>
            </span>
            <span className="flex items-center gap-1">
              <strong>Terminal:</strong> <span className="bg-slate-100 text-[#1e222b] font-bold px-1">{terminalName}</span>
            </span>
            <span className="flex items-center gap-1">
              <strong>Cashier Role:</strong> <span className="text-emerald-700 font-extrabold uppercase">{userRole} ({staffName})</span>
            </span>
            <span className="flex items-center gap-1">
              <strong>Mode:</strong> <span className="bg-blue-50 text-blue-700 font-bold px-1">Build Development</span>
            </span>
          </div>
        </div>

        {/* Dynamic status badge right aligned */}
        <div className="flex items-center gap-2">
          {connectivity === 'ONLINE' ? (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border-2 border-emerald-500/35">
              <span className="w-2.5 h-2.5 rounded-none bg-emerald-600 animate-pulse"></span>
              <span className="font-black text-emerald-800 uppercase text-[9px]">Status: Online</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 border-2 border-rose-500/35">
              <span className="w-2.5 h-2.5 rounded-none bg-rose-600 animate-pulse"></span>
              <span className="font-black text-rose-800 uppercase text-[9px]">Status: Offline</span>
            </div>
          )}
        </div>
      </div>

      {/* FEEDBACK STATUS ALERTS */}
      {feedback && (
        <div className={`p-4 border-l-4 rounded-none h-auto flex items-start gap-3 transition-all duration-300 ${
          feedback.type === 'success' 
            ? 'bg-emerald-50 border-l-emerald-600 border border-[#b1b5c2] text-emerald-800' 
            : feedback.type === 'warning' 
            ? 'bg-amber-50 border-l-amber-500 border border-[#b1b5c2] text-amber-800'
            : 'bg-rose-50 border-l-rose-600 border border-[#b1b5c2] text-rose-800'
        }`}>
          {feedback.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />}
          {feedback.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />}
          {feedback.type === 'error' && <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />}
          <div>
            <span className="font-extrabold uppercase text-[10px] block mb-0.5">
              Sync Desk System Alert ({feedback.type})
            </span>
            <p className="text-xs font-semibold">{feedback.message}</p>
          </div>
        </div>
      )}

      {/* OFFLINE MANUALLY CONTROL TOGGLES (PART 3 WARNING PANELS) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        
        {/* Toggle Panel Left */}
        <div className="md:col-span-8 bg-white border-2 border-[#b1b5c2] p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="text-[10px] text-slate-500 font-extrabold block uppercase tracking-wider">Simulate Network Health</span>
            <p className="text-[11px] font-semibold text-slate-700 mt-0.5">
              Toggle terminal state to simulate disconnect behavior and local storage data-caching mechanisms.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleToggleConnectivity('ONLINE')}
              className={`px-4 py-2 border-2 font-black uppercase text-[10px] tracking-wider rounded-none cursor-pointer flex items-center gap-1 transition-all ${
                connectivity === 'ONLINE'
                  ? 'bg-emerald-600 text-white border-emerald-700'
                  : 'bg-white text-slate-500 border-slate-300'
              }`}
            >
              <Wifi className="w-3.5 h-3.5" />
              Simulate Online
            </button>
            <button
              onClick={() => handleToggleConnectivity('OFFLINE')}
              className={`px-4 py-2 border-2 font-black uppercase text-[10px] tracking-wider rounded-none cursor-pointer flex items-center gap-1 transition-all ${
                connectivity === 'OFFLINE'
                  ? 'bg-rose-600 text-white border-rose-700'
                  : 'bg-white text-slate-500 border-slate-300'
              }`}
            >
              <WifiOff className="w-3.5 h-3.5" />
              Simulate Offline
            </button>
          </div>
        </div>

        {/* Active Warning Indicators Panel Right */}
        <div className="md:col-span-4 select-none">
          {connectivity === 'OFFLINE' ? (
            <div className="p-4 bg-orange-50 border-2 border-orange-400/80 text-orange-950 flex gap-2 h-full items-start">
              <AlertTriangle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5 animate-bounce" />
              <div>
                <span className="font-black text-[10px] uppercase block">Terminal is Offline</span>
                <span className="text-[10px] leading-tight font-bold mt-0.5 block text-orange-900">
                  New actions will be queued locally. Master endpoints bypassed.
                </span>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-emerald-50 border-2 border-emerald-400/80 text-emerald-950 flex gap-2 h-full items-start">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-black text-[10px] uppercase block">Terminal is Online</span>
                <span className="text-[10px] leading-tight font-bold mt-0.5 block text-emerald-900">
                  Queue is connected and ready for sync simulation.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* PART 3: SYNC SUMMARY PANELS */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        {[
          { label: 'Terminal Connect', value: connectivity, comment: connectivity === 'ONLINE' ? 'Socket Active' : 'Cached SQLite', color: connectivity === 'ONLINE' ? 'border-l-emerald-600 bg-emerald-50/20' : 'border-l-rose-600 bg-rose-50/20' },
          { label: 'Pending Sales', value: pendingSalesCount, comment: 'Ready for invoice ledger', color: 'border-l-orange-500 bg-orange-50/10' },
          { label: 'Pending Stock', value: pendingStockCount, comment: 'Inventory variances', color: 'border-l-amber-500 bg-amber-50/10' },
          { label: 'Pending Cash', value: pendingCashCount, comment: 'Safe drops & shifts', color: 'border-l-teal-600 bg-teal-50/10' },
          { label: 'Pending BI Logs', value: pendingBiCount, comment: 'Compliance/Auditing', color: 'border-l-purple-500 bg-purple-50/10' },
          { label: 'Pending Delivery', value: pendingDeliveryCount, comment: 'Closed proof of codes', color: 'border-l-blue-500 bg-blue-50/10' },
          { label: 'Last Master Sync', value: lastSyncTime, comment: 'UTC network tick', color: 'border-l-[#1e222b] bg-slate-100' },
          { label: 'Threat Sync Risk', value: riskAssessment, comment: 'Data collidability', color: hasCriticalConflict ? 'border-l-red-600 text-rose-800 font-extrabold bg-red-50/10' : 'border-l-slate-400 text-slate-800' }
        ].map(card => (
          <div key={card.label} className={`bg-white border border-[#b1b5c2] border-l-4 ${card.color} p-3 flex flex-col justify-between h-[85px]`}>
            <span className="text-[8.5px] font-black text-slate-500 uppercase tracking-tight block truncate" title={card.label}>
              {card.label}
            </span>
            <span className="text-base font-black text-[#1e222b] leading-tight block truncate uppercase">
              {card.value}
            </span>
            <span className="text-[8px] text-slate-400 block truncate leading-none uppercase">
              {card.comment}
            </span>
          </div>
        ))}
      </div>

      {/* MAIN TWO-COLUMN SPLIT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: FILTER CONTROLS & QUEUE TABLE (8 cols) */}
        <div className="lg:col-span-8 space-y-6">

          {/* TABLE FILTERS & CONTROLS */}
          <div className="bg-white border-2 border-[#b1b5c2] p-4 space-y-3">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              
              {/* Search */}
              <div className="relative w-full md:w-80">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                  <Search className="h-3.5 w-3.5 text-slate-400" />
                </span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-[#b1b5c2] text-xs focus:bg-white text-[#1e222b]"
                  placeholder="Filter queue elements..."
                />
              </div>

              {/* Filters list */}
              <div className="flex flex-wrap gap-2 w-full md:w-auto items-center justify-end">
                
                {/* Domain filter */}
                <div>
                  <select 
                    value={domainFilter} 
                    onChange={(e) => setDomainFilter(e.target.value)}
                    className="px-2 py-1.5 bg-slate-50 border border-[#b1b5c2] font-semibold text-[10px]"
                  >
                    <option value="ALL">All Domains</option>
                    <option value="Sales">Sales Only</option>
                    <option value="Stock">Stock Only</option>
                    <option value="Cash">Cash Only</option>
                    <option value="BI">BI Only</option>
                    <option value="Delivery">Delivery Only</option>
                    <option value="CRM">CRM Only</option>
                    <option value="Settings">Settings Only</option>
                  </select>
                </div>

                {/* Status filter */}
                <div>
                  <select 
                    value={statusFilter} 
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-2 py-1.5 bg-slate-50 border border-[#b1b5c2] font-semibold text-[10px]"
                  >
                    <option value="ALL">All Sync States</option>
                    <option value="Pending">Pending</option>
                    <option value="Ready">Ready</option>
                    <option value="Synced">Synced</option>
                    <option value="Conflict">Conflict</option>
                    <option value="Failed">Failed</option>
                  </select>
                </div>

                {/* Risk filter */}
                <div>
                  <select 
                    value={riskFilter} 
                    onChange={(e) => setRiskFilter(e.target.value)}
                    className="px-2 py-1.5 bg-slate-50 border border-[#b1b5c2] font-semibold text-[10px]"
                  >
                    <option value="ALL">All Risk Levels</option>
                    <option value="Low">Low Risk</option>
                    <option value="Medium">Medium Risk</option>
                    <option value="High">High Risk</option>
                    <option value="Critical">Critical Risk</option>
                  </select>
                </div>

              </div>
            </div>
          </div>

          {/* QUEUE TABLE */}
          <div className="bg-white border-2 border-[#b1b5c2] p-0 overflow-x-auto shadow-sm">
            <div className="bg-[#1e222b] text-white p-3 font-extrabold flex items-center justify-between">
              <span className="uppercase text-[9.5px]">LOCAL REGULATOR OFFLINE BUFFER (SQLITE REPLICA)</span>
              <span className="text-[8px] bg-orange-600 text-white px-2 py-0.5 px-1 font-bold">
                {filteredQueue.length} ITEMS MATCHED
              </span>
            </div>

            {filteredQueue.length === 0 ? (
              <div className="p-8 text-center text-slate-400 font-bold bg-slate-50">
                No local transaction rows found matching constraints.
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-[#b1b5c2] font-black uppercase text-[8.5px] tracking-wider text-slate-500">
                    <th className="p-3">ID</th>
                    <th className="p-3">Domain</th>
                    <th className="p-3">Event Type</th>
                    <th className="p-3">Reference</th>
                    <th className="p-3">Operator</th>
                    <th className="p-3">Date/Time</th>
                    <th className="p-3">Sync Status</th>
                    <th className="p-3 text-center">Risk</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredQueue.map((item) => {
                    const statusColors = {
                      Pending: 'bg-zinc-150 text-slate-800 border-slate-300',
                      Ready: 'bg-orange-50 text-orange-700 border-orange-500/30 font-bold',
                      Synced: 'bg-emerald-50 text-emerald-800 border-emerald-500/25',
                      Conflict: 'bg-amber-50 text-amber-800 border-amber-600/30 font-bold',
                      Failed: 'bg-rose-50 text-rose-800 border-rose-500/25'
                    };

                    const riskColors = {
                      Low: 'bg-slate-100 text-slate-700 border-slate-200',
                      Medium: 'bg-blue-50 text-blue-700 border-blue-200',
                      High: 'bg-amber-50 text-amber-700 border-amber-300',
                      Critical: 'bg-rose-100 text-rose-800 border-rose-400 font-extrabold'
                    };

                    const isActionable = canActionRow(item);

                    return (
                      <tr 
                        key={item.id} 
                        className={`hover:bg-slate-50/80 transition-all ${
                          activePayloadItem?.id === item.id ? 'bg-orange-50/15' : ''
                        }`}
                      >
                        <td className="p-3 font-extrabold text-[#1e222b]">{item.id}</td>
                        <td className="p-3">
                          <span className="font-extrabold bg-[#1e222b] text-white text-[8px] px-1.5 py-0.2 uppercase">
                            {item.domain}
                          </span>
                        </td>
                        <td className="p-3 font-semibold uppercase text-slate-800 text-[10px]" title={item.eventType}>
                          {item.eventType}
                        </td>
                        <td className="p-3 text-slate-600 font-mono font-bold">{item.reference}</td>
                        <td className="p-3 text-slate-500">{item.createdBy}</td>
                        <td className="p-3 text-slate-400 select-all" title={item.createdAt}>
                          {item.createdAt.includes('T') ? item.createdAt.slice(11, 16) : item.createdAt}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 border text-[9px] uppercase ${statusColors[item.syncStatus] || 'bg-slate-100 text-slate-600'}`}>
                            {item.syncStatus}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.3 border text-[8px] uppercase font-black tracking-tighter ${riskColors[item.risk] || 'bg-slate-100'}`}>
                            {item.risk}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            
                            {/* View Payload Action */}
                            <button
                              onClick={() => setActivePayloadItem(activePayloadItem?.id === item.id ? null : item)}
                              className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                              title="Inspect RAW JSON payload"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {/* Conditional action row controls */}
                            {isActionable ? (
                              <>
                                {/* Mark Ready */}
                                {item.syncStatus === 'Pending' && (
                                  <button
                                    onClick={() => handleMarkReady(item.id)}
                                    className="px-1.5 py-0.5 bg-white border border-[#b1b5c2] hover:bg-slate-100 text-[#1e222b] font-black uppercase text-[8px] cursor-pointer"
                                    title="Authorize ready for sync connection"
                                  >
                                    Ready
                                  </button>
                                )}

                                {/* Sync simulation single */}
                                {item.syncStatus === 'Ready' && (
                                  <button
                                    onClick={() => handleSimulateSync(item.id)}
                                    className="px-1.5 py-0.5 bg-orange-600 hover:bg-orange-700 text-white font-black uppercase text-[8px] cursor-pointer"
                                    title="Push item to main DB"
                                  >
                                    Push
                                  </button>
                                )}

                                {/* Flag Conflict simulation */}
                                {(item.syncStatus === 'Pending' || item.syncStatus === 'Ready') && isAllowedToManageSync() && (
                                  <button
                                    onClick={() => handleFlagConflict(item.id)}
                                    className="px-1.5 py-0.5 bg-amber-500 hover:bg-amber-600 text-white font-black uppercase text-[8px] cursor-pointer"
                                    title="Flag duplicate state error"
                                  >
                                    Conflict
                                  </button>
                                )}

                                {/* Delete Draft Option */}
                                {isAllowedToManageAll() && (
                                  <button
                                    onClick={() => handleRemoveLocalDraft(item.id)}
                                    className="p-1 bg-red-100 hover:bg-red-200 text-rose-700 cursor-pointer"
                                    title="Erase row draft from buffer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </>
                            ) : (
                              <span className="text-[7.5px] font-semibold text-slate-400 uppercase italic">
                                {isRestrictedWorkerLevel() ? `${userRole} Lock` : 'No Auth'}
                              </span>
                            )}

                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* ACTIVE PAYLOAD VIEWER DRAWER (Charcoal terminal aesthetics) */}
          {activePayloadItem && (
            <div className="bg-[#1e222b] text-zinc-100 border-4 border-orange-500 p-5 font-mono text-[11px] space-y-3 shadow-md">
              <div className="flex items-center justify-between border-b border-zinc-700 pb-2">
                <span className="text-orange-400 font-extrabold text-[12px] flex items-center gap-1.5">
                  <Database className="w-4 h-4" />
                  RAW TRANSACTIONS JSON OFFSET: {activePayloadItem.id} ({activePayloadItem.domain})
                </span>
                <button
                  onClick={() => setActivePayloadItem(null)}
                  className="text-slate-400 hover:text-white font-black cursor-pointer uppercase text-[9px]"
                >
                  [Close Shield x]
                </button>
              </div>

              <div className="p-3 bg-zinc-900 border border-zinc-800 h-auto overflow-y-auto max-h-56 text-[#a7f3d0]">
                <pre className="whitespace-pre-wrap font-mono leading-relaxed select-all">
                  {JSON.stringify(JSON.parse(activePayloadItem.payload), null, 2)}
                </pre>
              </div>

              <div className="flex items-center justify-between text-[10px] text-zinc-400 font-bold pt-1.5">
                <span>Created At: <strong className="text-zinc-200">{activePayloadItem.createdAt}</strong></span>
                <span>Payload Size: <strong className="text-zinc-200">{activePayloadItem.payload.length} bytes</strong></span>
              </div>
            </div>
          )}

          {/* CONTROL SIMULATION TERMINAL BUTTONS Panel */}
          <div className="bg-white border-2 border-[#b1b5c2] p-5">
            <h3 className="text-xs font-black text-[#1e222b] uppercase tracking-wider mb-3">
              INTEGRATION SIMULATOR ROUTINES (PART 7)
            </h3>
            
            {isAllowedToManageSync() ? (
              <div className="flex flex-wrap gap-2.5">
                <button
                  onClick={handleRunSyncCheck}
                  className="px-4 py-2.5 bg-[#1e222b] hover:bg-zinc-800 text-white font-black uppercase text-[10px] tracking-wider rounded-none cursor-pointer flex items-center gap-1 border border-slate-700"
                  title="Checks queue and moves Low risk items from Pending to Ready."
                >
                  Run Sync Check
                </button>

                <button
                  onClick={handleSyncReadyItems}
                  className="px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-black uppercase text-[10px] tracking-wider rounded-none cursor-pointer flex items-center gap-1"
                  title="Sends all Ready items to the master database."
                >
                  Sync Ready Items
                </button>

                <button
                  onClick={handleClearSyncedItems}
                  className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-black uppercase text-[10px] tracking-wider rounded-none cursor-pointer"
                  title="Saves storage by wiping records with Synced status."
                >
                  Clear Synced Items
                </button>

                <button
                  onClick={handleExportJSON}
                  className="px-4 py-2.5 bg-white border-2 border-[#b1b5c2] text-[#1e222b] hover:bg-slate-50 font-black uppercase text-[10px] tracking-wider rounded-none cursor-pointer flex items-center gap-1"
                  title="Dumps the queue as JSON for inspection or backup."
                >
                  <FileJson className="w-3.5 h-3.5 text-orange-500" />
                  Export Queue JSON
                </button>
              </div>
            ) : (
              <div className="bg-rose-50 border border-rose-200 p-3 flex items-center gap-2 text-rose-950 font-semibold text-[11px]">
                <Lock className="w-4 h-4 text-rose-500 flex-shrink-0" />
                <span>
                  <strong>AUTHENTICATION RESTRAINT:</strong> Staff member level role <strong>{userRole}</strong> is restricted from executing central synchronization sequences. Please request Owner or Supervisor credentials to simulate master sync protocols.
                </span>
              </div>
            )}
          </div>

        </div>

        {/* RIGHT COLUMN: ACTION FEED & CONFLICT WARNING PANELS (4 cols) */}
        <div className="lg:col-span-4 space-y-6">

          {/* PART 8: CONFLICT WARNINGS COMPONENT */}
          <div className="bg-white border-2 border-[#b1b5c2] p-0 shadow-sm">
            <div className="bg-[#1e222b] text-white p-3 font-extrabold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-orange-500 animate-pulse" />
              <span className="uppercase text-[9.5px]">SYNC CONFLICT REGISTER</span>
            </div>
            
            <div className="p-4 space-y-3.5">
              <p className="text-[10px] leading-relaxed text-slate-500 font-medium">
                Below are simulated conflict layouts that occur when offline-modified records collide with state changes posted on other nodes.
              </p>

              <div className="space-y-3">
                {conflicts.map((conf) => {
                  const riskColors = {
                    Low: 'bg-slate-100 text-slate-700',
                    Medium: 'bg-blue-100 text-blue-800',
                    High: 'bg-amber-100 text-amber-900 border-amber-300',
                    Critical: 'bg-rose-100 text-rose-950 border-rose-300'
                  };

                  return (
                    <div key={conf.id} className="p-3 bg-slate-50 border border-[#b1b5c2] space-y-1.5">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                        <span className="font-extrabold text-[10px] text-slate-900 flex items-center gap-1.5 uppercase">
                          <span className="w-1.5 h-1.5 rounded-none bg-orange-500"></span>
                          {conf.conflictType}
                        </span>
                        <span className={`px-1.5 py-0.2 text-[8px] font-bold uppercase ${riskColors[conf.risk] || 'bg-slate-200'}`}>
                          {conf.risk}
                        </span>
                      </div>
                      
                      <p className="text-[10px] text-slate-700 font-semibold leading-relaxed">
                        {conf.description}
                      </p>

                      <div className="bg-white p-2 border border-slate-200 text-[8.5px] font-mono leading-relaxed">
                        <strong className="text-orange-600 block uppercase font-bold text-[8px]">RECONCILIATION ROUTINE:</strong>
                        <span className="text-slate-600">{conf.recommendedAction}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* PART 11: SYNC ACTIVITY FEED */}
          <div className="bg-white border-2 border-[#b1b5c2] p-0 shadow-sm">
            <div className="bg-[#1e222b] text-white p-3 font-extrabold flex items-center gap-2">
              <Activity className="w-4 h-4 text-orange-500" />
              <span className="uppercase text-[9.5px]">SYNC ACTIVITY FEED</span>
            </div>

            <div className="p-4 space-y-3 max-h-96 overflow-y-auto divide-y divide-slate-100">
              {activities.length === 0 ? (
                <div className="text-center font-bold text-slate-400 py-6">
                  No actions logged. Turn on simulator switches to populate.
                </div>
              ) : (
                activities.map((act) => {
                  const eventIcons = {
                    TERMINAL_OFFLINE_MODE_ENABLED: '🚫',
                    TERMINAL_ONLINE_MODE_ENABLED: '🌐',
                    LOCAL_QUEUE_ITEM_CREATED: '📥',
                    SYNC_CHECK_COMPLETED: '🔍',
                    LOCAL_QUEUE_SYNCED: '🚀',
                    SYNC_CONFLICT_FLAGGED: '⚠️',
                    SYNCED_QUEUE_CLEARED: '🧼',
                    OFFLINE_AUDIT_EXPORT_PREPARED: '💾'
                  };

                  return (
                    <div key={act.id} className="pt-2.5 first:pt-0 pb-1 text-[10px] space-y-1">
                      <div className="flex justify-between items-center text-[9px]">
                        <span className="font-bold text-[#1e222b] bg-slate-100 px-1 py-0.2 uppercase font-black" title={act.eventType}>
                          {eventIcons[act.eventType] || '⚙️'} {act.eventType.replace(/_/g, ' ')}
                        </span>
                        <span className="text-slate-400">
                          {act.timestamp.includes('T') ? act.timestamp.slice(11, 19) : act.timestamp}
                        </span>
                      </div>
                      <p className="text-slate-600 font-semibold leading-relaxed">
                        {act.message}
                      </p>
                      <div className="flex items-center gap-1.5 text-[8.5px] text-slate-400 font-black uppercase">
                        <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>OPERATOR: {act.operator}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
