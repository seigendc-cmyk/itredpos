import { useState } from 'react';
import { Maximize2, Minimize2, RotateCcw, X } from 'lucide-react';
import {
  OfflineSyncActivityEvent,
  OfflineSyncConflict,
  OfflineSyncConflictDecision,
  SyncConflictResolution
} from '../types/posTypes';
import { sanitizePayloadForDisplay, summarizeQueuePayload } from '../utils/offlineSyncUtils';

interface SyncConflictFormProps {
  conflict: OfflineSyncConflict;
  decisions: OfflineSyncConflictDecision[];
  activity: OfflineSyncActivityEvent[];
  onClose: () => void;
  onResolve: (resolution: SyncConflictResolution, reason: string) => void;
}

type Tab = 'Conflict Summary' | 'Local Version' | 'Remote Version' | 'Resolution' | 'Decision History' | 'Activity';
type WindowMode = 'normal' | 'minimized' | 'maximized';

const resolutionActions: SyncConflictResolution[] = ['Use Local', 'Use Remote', 'Merge', 'Retry', 'Cancel Local', 'Hold For Review'];
const noteRequired = new Set<SyncConflictResolution>(['Use Local', 'Use Remote', 'Merge', 'Cancel Local']);

export default function SyncConflictForm({ conflict, decisions, activity, onClose, onResolve }: SyncConflictFormProps) {
  const tabs: Tab[] = ['Conflict Summary', 'Local Version', 'Remote Version', 'Resolution', 'Decision History', 'Activity'];
  const [activeTab, setActiveTab] = useState<Tab>('Conflict Summary');
  const [mode, setMode] = useState<WindowMode>('normal');
  const [reason, setReason] = useState('');
  const shellClass = mode === 'maximized'
    ? 'fixed inset-4 z-50 bg-white border-2 border-[#1e222b] shadow-2xl flex flex-col'
    : 'fixed inset-x-4 top-10 z-50 mx-auto max-w-5xl bg-white border-2 border-[#1e222b] shadow-2xl flex flex-col';

  const submitResolution = (resolution: SyncConflictResolution) => {
    if (noteRequired.has(resolution) && reason.trim().length < 3) return;
    onResolve(resolution, reason.trim() || `${resolution} decision recorded.`);
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/35">
      <section className={shellClass}>
        <header className="bg-[#1e222b] text-white px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[9px] uppercase text-orange-400 font-black">Sync Conflict Review</p>
            <h2 className="text-sm font-black uppercase">Resolve offline and remote data differences safely.</h2>
          </div>
          <div className="flex items-center gap-1">
            <button className="p-2 bg-zinc-800 border border-zinc-700" onClick={() => setMode('minimized')} title="Minimize"><Minimize2 size={14} /></button>
            <button className="p-2 bg-zinc-800 border border-zinc-700" onClick={() => setMode('normal')} title="Restore"><RotateCcw size={14} /></button>
            <button className="p-2 bg-zinc-800 border border-zinc-700" onClick={() => setMode('maximized')} title="Maximize"><Maximize2 size={14} /></button>
            <button className="p-2 bg-orange-600 border border-orange-700" onClick={onClose} title="Close"><X size={14} /></button>
          </div>
        </header>
        {mode === 'minimized' ? (
          <button className="p-4 text-left font-black text-xs uppercase" onClick={() => setMode('normal')}>{conflict.conflictId} minimized. Click to restore.</button>
        ) : (
          <>
            <nav className="flex flex-wrap gap-1 p-3 border-b border-[#d6d9e0] bg-slate-50">
              {tabs.map((tab) => <button key={tab} className={`px-3 py-2 border text-[10px] font-black uppercase ${activeTab === tab ? 'bg-orange-600 text-white border-orange-700' : 'bg-white border-[#b1b5c2] text-[#1e222b]'}`} onClick={() => setActiveTab(tab)}>{tab}</button>)}
            </nav>
            <main className="p-4 overflow-auto">
              {activeTab === 'Conflict Summary' && <FieldGrid rows={[
                ['Conflict Type', conflict.conflictType], ['Entity Type', conflict.entityType], ['Entity Reference', conflict.entityNumber || conflict.entityId],
                ['Local Version', String(conflict.localVersion)], ['Remote Version', conflict.remoteVersion ? String(conflict.remoteVersion) : 'None'],
                ['Local Payload Summary', summarizeQueuePayload(conflict.localPayload)], ['Remote Payload Summary', summarizeQueuePayload(conflict.remotePayload || {})],
                ['Risk Level', conflict.riskLevel], ['Recommended Resolution', conflict.recommendedResolution], ['Notes', conflict.notes || 'None']
              ]} />}
              {activeTab === 'Local Version' && <pre className="bg-slate-950 text-emerald-100 p-4 text-[11px] overflow-auto max-h-96">{JSON.stringify(sanitizePayloadForDisplay(conflict.localPayload), null, 2)}</pre>}
              {activeTab === 'Remote Version' && <pre className="bg-slate-950 text-amber-100 p-4 text-[11px] overflow-auto max-h-96">{JSON.stringify(sanitizePayloadForDisplay(conflict.remotePayload || {}), null, 2)}</pre>}
              {activeTab === 'Resolution' && (
                <div className="space-y-3">
                  <textarea className="w-full border border-[#b1b5c2] p-3 text-xs min-h-24" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Decision notes. Required for each resolution option." />
                  <div className="flex flex-wrap gap-2">
                    {resolutionActions.map((resolution) => <button key={resolution} className={`sci-pos-button ${noteRequired.has(resolution) && reason.trim().length < 3 ? 'sci-pos-button--secondary opacity-60' : resolution === 'Cancel Local' ? 'sci-pos-button--danger' : 'sci-pos-button--primary'}`} onClick={() => submitResolution(resolution)}>{resolution}</button>)}
                  </div>
                </div>
              )}
              {activeTab === 'Decision History' && <div className="space-y-2">{decisions.length === 0 ? <p className="font-bold text-slate-500">No decision records yet.</p> : decisions.map((decision) => <div key={decision.decisionId} className="border border-[#d6d9e0] p-3"><strong className="text-[10px] uppercase">{decision.resolution}</strong><p className="text-[11px] text-slate-600">{decision.reason}</p><span className="text-[9px] text-slate-500">{decision.decidedByStaffName} - {decision.decidedAt}</span></div>)}</div>}
              {activeTab === 'Activity' && <div className="space-y-2">{activity.filter((event) => event.conflictId === conflict.conflictId || event.queueId === conflict.queueId).map((event) => <div key={event.eventId} className="border border-[#d6d9e0] p-3"><strong className="text-[10px] uppercase">{event.eventType.replace(/_/g, ' ')}</strong><p className="text-[11px] text-slate-600">{event.message}</p><span className="text-[9px] text-slate-500">{event.createdAt}</span></div>)}</div>}
            </main>
          </>
        )}
      </section>
    </div>
  );
}

function FieldGrid({ rows }: { rows: Array<[string, string]> }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-2">{rows.map(([label, value]) => <div key={label} className="border border-[#d6d9e0] bg-slate-50 p-3"><span className="block text-[9px] uppercase text-slate-500 font-black">{label}</span><strong className="text-[11px] text-[#1e222b] break-words">{value}</strong></div>)}</div>;
}
