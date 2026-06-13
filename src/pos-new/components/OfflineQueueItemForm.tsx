import { useState } from 'react';
import { Maximize2, Minimize2, RotateCcw, X } from 'lucide-react';
import { OfflineSyncActivityEvent, OfflineSyncConflict, OfflineSyncQueueItem } from '../types/posTypes';
import { sanitizePayloadForDisplay, summarizeQueuePayload } from '../utils/offlineSyncUtils';

interface OfflineQueueItemFormProps {
  item: OfflineSyncQueueItem;
  conflict?: OfflineSyncConflict;
  activity: OfflineSyncActivityEvent[];
  onClose: () => void;
  onRetry: (queueId: string) => void;
  onMarkSynced: (queueId: string) => void;
  onDetectConflict: (item: OfflineSyncQueueItem) => void;
  onHold: (queueId: string) => void;
  onCancel: (queueId: string) => void;
  onPrepareExport: (queueId: string) => void;
}

type WindowMode = 'normal' | 'minimized' | 'maximized';
type Tab = 'Details' | 'Payload Summary' | 'Retry History' | 'Conflict' | 'Activity';

export default function OfflineQueueItemForm({ item, conflict, activity, onClose, onRetry, onMarkSynced, onDetectConflict, onHold, onCancel, onPrepareExport }: OfflineQueueItemFormProps) {
  const tabs: Tab[] = ['Details', 'Payload Summary', 'Retry History', 'Conflict', 'Activity'];
  const [activeTab, setActiveTab] = useState<Tab>('Details');
  const [mode, setMode] = useState<WindowMode>('normal');
  const shellClass = mode === 'maximized'
    ? 'fixed inset-4 z-50 bg-white border-2 border-[#1e222b] shadow-2xl flex flex-col'
    : 'fixed inset-x-4 top-10 z-50 mx-auto max-w-5xl bg-white border-2 border-[#1e222b] shadow-2xl flex flex-col';

  return (
    <div className="fixed inset-0 z-40 bg-black/35">
      <section className={shellClass}>
        <header className="bg-[#1e222b] text-white px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[9px] uppercase text-orange-400 font-black">Offline Queue Item</p>
            <h2 className="text-sm font-black uppercase">Local offline transaction waiting for sync or review.</h2>
          </div>
          <div className="flex items-center gap-1">
            <button className="p-2 bg-zinc-800 border border-zinc-700" onClick={() => setMode('minimized')} title="Minimize"><Minimize2 size={14} /></button>
            <button className="p-2 bg-zinc-800 border border-zinc-700" onClick={() => setMode('normal')} title="Restore"><RotateCcw size={14} /></button>
            <button className="p-2 bg-zinc-800 border border-zinc-700" onClick={() => setMode('maximized')} title="Maximize"><Maximize2 size={14} /></button>
            <button className="p-2 bg-orange-600 border border-orange-700" onClick={onClose} title="Close"><X size={14} /></button>
          </div>
        </header>
        {mode === 'minimized' ? (
          <button className="p-4 text-left font-black text-xs uppercase" onClick={() => setMode('normal')}>{item.queueId} minimized. Click to restore.</button>
        ) : (
          <>
            <nav className="flex flex-wrap gap-1 p-3 border-b border-[#d6d9e0] bg-slate-50">
              {tabs.map((tab) => <button key={tab} className={`px-3 py-2 border text-[10px] font-black uppercase ${activeTab === tab ? 'bg-orange-600 text-white border-orange-700' : 'bg-white border-[#b1b5c2] text-[#1e222b]'}`} onClick={() => setActiveTab(tab)}>{tab}</button>)}
            </nav>
            <main className="p-4 overflow-auto">
              {activeTab === 'Details' && <FieldGrid rows={[
                ['Queue ID', item.queueId], ['Entity Type', item.entityType], ['Entity Reference', item.entityNumber || item.entityId], ['Operation Type', item.operationType],
                ['Branch', item.branchId], ['Terminal', item.terminalId], ['Staff', `${item.staffName} (${item.staffId})`], ['Priority', item.priority],
                ['Status', item.status], ['Retry Count', String(item.retryCount)], ['Payload Hash', item.payloadHash], ['Local Version', String(item.localVersion)],
                ['Remote Version', item.remoteVersion ? String(item.remoteVersion) : 'None'], ['Last Error', item.lastError || 'None'], ['Queued At', item.queuedAt],
                ['Last Attempt', item.lastAttemptAt || 'None'], ['Synced At', item.syncedAt || 'None']
              ]} />}
              {activeTab === 'Payload Summary' && <pre className="bg-slate-950 text-emerald-100 p-4 text-[11px] overflow-auto max-h-96">{JSON.stringify(sanitizePayloadForDisplay(item.payload), null, 2)}{"\n\n"}Summary: {summarizeQueuePayload(item.payload)}</pre>}
              {activeTab === 'Retry History' && <FieldGrid rows={[['Retry Count', String(item.retryCount)], ['Last Attempt', item.lastAttemptAt || 'None'], ['Last Error', item.lastError || 'None'], ['Next Step', item.status === 'Failed' ? 'Retry allowed' : item.status === 'Synced' ? 'Already synced placeholder' : 'Review current status']]} />}
              {activeTab === 'Conflict' && (conflict ? <FieldGrid rows={[['Conflict ID', conflict.conflictId], ['Conflict Type', conflict.conflictType], ['Risk', conflict.riskLevel], ['Recommended Resolution', conflict.recommendedResolution], ['Status', conflict.status], ['Notes', conflict.notes || 'None']]} /> : <p className="font-bold text-slate-500">No conflict is linked to this queue item.</p>)}
              {activeTab === 'Activity' && <div className="space-y-2">{activity.filter((event) => event.queueId === item.queueId || event.conflictId === item.conflictId).map((event) => <div key={event.eventId} className="border border-[#d6d9e0] p-3"><strong className="text-[10px] uppercase">{event.eventType.replace(/_/g, ' ')}</strong><p className="text-[11px] text-slate-600">{event.message}</p><span className="text-[9px] text-slate-500">{event.createdAt}</span></div>)}</div>}
            </main>
            <footer className="p-3 border-t border-[#d6d9e0] flex flex-wrap gap-2 justify-end">
              <button className="sci-pos-button sci-pos-button--secondary" onClick={() => onRetry(item.queueId)}>Retry</button>
              <button className="sci-pos-button sci-pos-button--primary" onClick={() => onMarkSynced(item.queueId)}>Mark Synced Placeholder</button>
              <button className="sci-pos-button sci-pos-button--secondary" onClick={() => onDetectConflict(item)}>Detect Conflict</button>
              <button className="sci-pos-button sci-pos-button--secondary" onClick={() => onHold(item.queueId)}>Hold For Review</button>
              <button className="sci-pos-button sci-pos-button--danger" onClick={() => onCancel(item.queueId)}>Cancel</button>
              <button className="sci-pos-button sci-pos-button--secondary" onClick={() => onPrepareExport(item.queueId)}>Prepare Export</button>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}

function FieldGrid({ rows }: { rows: Array<[string, string]> }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-2">{rows.map(([label, value]) => <div key={label} className="border border-[#d6d9e0] bg-slate-50 p-3"><span className="block text-[9px] uppercase text-slate-500 font-black">{label}</span><strong className="text-[11px] text-[#1e222b] break-words">{value}</strong></div>)}</div>;
}
