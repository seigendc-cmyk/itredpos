import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Database, Eye, FileSearch, Lock, RefreshCw, ShieldAlert } from 'lucide-react';
import {
  getFirestoreMode,
  getFirestoreModeStatus,
  initializeSCIFirebase,
  setFirestoreMode,
  type FirestoreMode
} from '../firebase/firebaseClient';
import {
  createPlatformFirebaseNotification,
  getPlatformFirebaseAuditEvents,
  getPlatformFirebaseNotifications,
  notifyFirebaseConfigState,
  recordPlatformFirebaseAudit,
  runFirestoreReadinessDiagnostics,
  runFirestoreSeedPreviewDiagnostics,
  writeFirestoreSeedPreviewOnly,
  type FirestoreReadinessDiagnostic,
  type FirestoreSeedPreviewRow,
  type FirestoreSeedWriteResult,
  type PlatformAuditEvent,
  type PlatformNotification
} from '../firebase/firestoreReadinessDiagnostics';

const modeOptions: Array<{ mode: FirestoreMode; label: string; detail: string }> = [
  { mode: 'localPrototype', label: 'Local Prototype Mode', detail: 'Local/mock repositories stay authoritative.' },
  { mode: 'firestoreRead', label: 'Firestore Read Mode', detail: 'Allows read diagnostics when Firebase is configured.' },
  { mode: 'firestoreWrite', label: 'Firestore Write Mode', detail: 'Warning-gated. Never enabled by default.' }
];

const statusClass = (value: string) => {
  if (value === 'READY' || value === 'CONFIGURED' || value === 'Yes') return 'text-emerald-300 border-emerald-700 bg-emerald-950/40';
  if (value === 'NOT_CONFIGURED' || value === 'No' || value === 'BLOCKED') return 'text-rose-300 border-rose-700 bg-rose-950/40';
  return 'text-amber-300 border-amber-700 bg-amber-950/40';
};

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-slate-800 bg-slate-950 p-3">
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-black text-slate-100">{value}</p>
    </div>
  );
}

export default function FirebaseReadinessPage() {
  const [mode, setMode] = useState<FirestoreMode>(() => getFirestoreMode());
  const [diagnostics, setDiagnostics] = useState<FirestoreReadinessDiagnostic[]>([]);
  const [seedPreview, setSeedPreview] = useState<FirestoreSeedPreviewRow[]>([]);
  const [writeResult, setWriteResult] = useState<FirestoreSeedWriteResult | null>(null);
  const [auditEvents, setAuditEvents] = useState<PlatformAuditEvent[]>(() => getPlatformFirebaseAuditEvents());
  const [notifications, setNotifications] = useState<PlatformNotification[]>(() => getPlatformFirebaseNotifications());
  const blockedWriteAuditModeRef = useRef<FirestoreMode | null>(null);

  const readiness = initializeSCIFirebase();
  const modeStatus = useMemo(() => getFirestoreModeStatus(mode, readiness), [mode, readiness.configured, readiness.firestoreReady]);

  const refreshLocalFeeds = () => {
    setAuditEvents(getPlatformFirebaseAuditEvents());
    setNotifications(getPlatformFirebaseNotifications());
  };

  useEffect(() => {
    notifyFirebaseConfigState();
    refreshLocalFeeds();
  }, []);

  useEffect(() => {
    if (modeStatus.writesAllowed || blockedWriteAuditModeRef.current === mode) return;
    blockedWriteAuditModeRef.current = mode;
    recordPlatformFirebaseAudit('FIRESTORE_SEED_WRITE_BLOCKED', 'Seed write button is disabled because Firestore Write Mode is not active.', { mode });
    refreshLocalFeeds();
  }, [mode, modeStatus.writesAllowed]);

  const changeMode = (nextMode: FirestoreMode) => {
    if (nextMode === 'firestoreRead' && !readiness.configured) {
      createPlatformFirebaseNotification('Firebase config missing', 'Firestore Read Mode needs complete Firebase env config.', 'warning');
      refreshLocalFeeds();
      return;
    }

    if (nextMode === 'firestoreWrite') {
      if (!readiness.configured) {
        createPlatformFirebaseNotification('Firebase config missing', 'Firestore Write Mode needs complete Firebase env config.', 'warning');
        refreshLocalFeeds();
        return;
      }
      const confirmed = window.confirm('Firestore Write Mode can enable production actions. Continue?');
      if (!confirmed) return;
      createPlatformFirebaseNotification('Firestore write mode enabled', 'Write mode is active for this browser session. Seed writes remain warning-gated.', 'warning');
    }

    setMode(setFirestoreMode(nextMode));
    recordPlatformFirebaseAudit('FIRESTORE_MODE_CHANGED', `Firestore mode changed to ${nextMode}.`, { mode: nextMode });
    refreshLocalFeeds();
  };

  const runDiagnostics = () => {
    setDiagnostics(runFirestoreReadinessDiagnostics(mode));
    refreshLocalFeeds();
  };

  const openSeedPreview = () => {
    setSeedPreview(runFirestoreSeedPreviewDiagnostics(mode));
    refreshLocalFeeds();
  };

  const attemptSeedWrite = () => {
    const result = writeFirestoreSeedPreviewOnly(mode);
    setWriteResult(result);
    refreshLocalFeeds();
  };

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="border border-slate-800 bg-slate-900 p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Platform</p>
          <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl font-black uppercase text-white">Firebase Readiness</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-400">
                Configuration, initialization, repository mode, diagnostics, and seed preview controls.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  window.history.pushState({}, '', '/platform/pricing-plans');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }}
                className="border border-emerald-600 bg-emerald-600 px-4 py-2 text-xs font-black uppercase text-white hover:bg-emerald-500"
              >
                Open Pricing Plans Manager
              </button>
              <button
                type="button"
                onClick={() => {
                  window.history.pushState({}, '', '/platform/vendor-verification');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }}
                className="border border-orange-600 bg-orange-600 px-4 py-2 text-xs font-black uppercase text-white hover:bg-orange-500"
              >
                Open Vendor Verification Queue
              </button>
              <button
                type="button"
                onClick={() => {
                  window.history.pushState({}, '', '/');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }}
                className="border border-slate-700 bg-slate-950 px-4 py-2 text-xs font-black uppercase text-slate-200 hover:border-cyan-400"
              >
                Back
              </button>
            </div>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-4">
          <Metric label="Firebase Config" value={readiness.statusLabel} />
          <Metric label="Project ID" value={readiness.projectId} />
          <Metric label="Auth Domain" value={readiness.authDomain} />
          <Metric label="Measurement ID" value={readiness.measurementId} />
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <div className="border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-300" />
              <h2 className="text-sm font-black uppercase">Firebase Initialization</h2>
            </div>
            <div className="mt-4 grid gap-2">
              <Metric label="Firebase app initialized" value={readiness.appInitialized ? 'Yes' : 'No'} />
              <Metric label="Auth ready" value={readiness.authReady ? 'Yes' : 'No'} />
              <Metric label="Firestore ready" value={readiness.firestoreReady ? 'Yes' : 'No'} />
            </div>
          </div>

          <div className="border border-slate-800 bg-slate-900 p-4 lg:col-span-2">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-cyan-300" />
              <h2 className="text-sm font-black uppercase">Firestore Mode Selector</h2>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {modeOptions.map((option) => {
                const disabled = option.mode !== 'localPrototype' && !readiness.configured;
                return (
                  <button
                    key={option.mode}
                    type="button"
                    onClick={() => changeMode(option.mode)}
                    disabled={disabled}
                    className={`min-h-[108px] border p-3 text-left transition ${
                      mode === option.mode
                        ? 'border-cyan-400 bg-cyan-950/40'
                        : 'border-slate-700 bg-slate-950 hover:border-cyan-700'
                    } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
                  >
                    <span className="block text-xs font-black uppercase text-white">{option.label}</span>
                    <span className="mt-2 block text-xs text-slate-400">{option.detail}</span>
                    {option.mode === 'firestoreWrite' && <span className="mt-2 block text-[10px] font-black uppercase text-amber-300">Requires confirmation</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-5">
          <Metric label="Environment mode" value={modeStatus.environmentMode} />
          <Metric label="Current Firestore mode" value={modeStatus.currentModeLabel} />
          <Metric label="Reads allowed" value={modeStatus.readsAllowed ? 'Yes' : 'No'} />
          <Metric label="Writes allowed" value={modeStatus.writesAllowed ? 'Yes' : 'No'} />
          <Metric label="Production actions enabled" value={modeStatus.productionActionsEnabled ? 'Yes' : 'No'} />
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileSearch className="h-4 w-4 text-cyan-300" />
                <h2 className="text-sm font-black uppercase">Readiness Diagnostics</h2>
              </div>
              <button type="button" onClick={runDiagnostics} className="border border-cyan-600 bg-cyan-600 px-3 py-2 text-xs font-black uppercase text-slate-950 hover:bg-cyan-400">
                Run
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {diagnostics.map((row) => (
                <div key={row.name} className="border border-slate-800 bg-slate-950 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-xs uppercase text-white">{row.name}</strong>
                    <span className={`border px-2 py-1 text-[10px] font-black uppercase ${statusClass(row.status)}`}>{row.status}</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">{row.message}</p>
                </div>
              ))}
              {diagnostics.length === 0 && <div className="border border-slate-800 bg-slate-950 p-4 text-xs text-slate-500">Run diagnostics to read current Firebase and repository readiness.</div>}
            </div>
          </div>

          <div className="border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-emerald-300" />
                <h2 className="text-sm font-black uppercase">Seed Preview</h2>
              </div>
              <button type="button" onClick={openSeedPreview} className="border border-emerald-600 bg-emerald-600 px-3 py-2 text-xs font-black uppercase text-slate-950 hover:bg-emerald-400">
                Preview
              </button>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="bg-slate-950 text-[10px] uppercase text-slate-500">
                  <tr>
                    <th className="border border-slate-800 p-2">Collection</th>
                    <th className="border border-slate-800 p-2">Records</th>
                    <th className="border border-slate-800 p-2">Protected</th>
                    <th className="border border-slate-800 p-2">Message</th>
                  </tr>
                </thead>
                <tbody>
                  {seedPreview.map((row) => (
                    <tr key={row.collectionName}>
                      <td className="border border-slate-800 p-2 font-black text-white">{row.collectionName}</td>
                      <td className="border border-slate-800 p-2">{row.recordCount}</td>
                      <td className="border border-slate-800 p-2">{row.writeProtected ? 'Yes' : 'No'}</td>
                      <td className="border border-slate-800 p-2 text-slate-400">{row.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {seedPreview.length === 0 && <div className="border border-t-0 border-slate-800 bg-slate-950 p-4 text-xs text-slate-500">Open seed preview to inspect collection counts and write protection.</div>}
            </div>
          </div>
        </section>

        <section className="border border-amber-700 bg-amber-950/20 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex gap-3">
              <ShieldAlert className="mt-1 h-5 w-5 shrink-0 text-amber-300" />
              <div>
                <h2 className="text-sm font-black uppercase text-amber-200">Seed Write Button</h2>
                <p className="mt-1 text-xs text-amber-100/80">Disabled unless Firestore Write Mode is active. Attempts are audited and this build keeps seed writing preview-only.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={attemptSeedWrite}
              disabled={!modeStatus.writesAllowed}
              className="border border-amber-500 bg-amber-500 px-4 py-3 text-xs font-black uppercase text-slate-950 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Write Seed Preview Only
            </button>
          </div>
          {writeResult && (
            <div className={`mt-3 border p-3 text-xs ${writeResult.blocked ? 'border-rose-700 bg-rose-950/40 text-rose-200' : 'border-emerald-700 bg-emerald-950/40 text-emerald-200'}`}>
              <strong>{writeResult.reason}</strong> - {writeResult.message}
            </div>
          )}
          {!modeStatus.writesAllowed && (
            <div className="mt-3 flex items-center gap-2 text-xs text-amber-200">
              <Lock className="h-4 w-4" />
              Seed write blocked: Firestore Write Mode is not active.
            </div>
          )}
        </section>

        {(readiness.warnings.length > 0 || !readiness.configured) && (
          <section className="border border-rose-800 bg-rose-950/20 p-4">
            <div className="flex gap-3">
              <AlertTriangle className="mt-1 h-5 w-5 shrink-0 text-rose-300" />
              <div>
                <h2 className="text-sm font-black uppercase text-rose-200">Configuration Notice</h2>
                <p className="mt-1 text-xs text-rose-100/80">{readiness.configured ? readiness.warnings.join(' ') : `Missing: ${readiness.missingKeys.join(', ')}`}</p>
              </div>
            </div>
          </section>
        )}

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-slate-300" />
              <h2 className="text-sm font-black uppercase">Audit Trail</h2>
            </div>
            <div className="mt-4 space-y-2">
              {auditEvents.slice(0, 6).map((event) => (
                <div key={event.id} className="border border-slate-800 bg-slate-950 p-3 text-xs">
                  <strong className="text-white">{event.eventType}</strong>
                  <p className="mt-1 text-slate-400">{event.message}</p>
                  <small className="text-slate-600">{event.createdAt}</small>
                </div>
              ))}
              {auditEvents.length === 0 && <div className="border border-slate-800 bg-slate-950 p-4 text-xs text-slate-500">No Firebase readiness audit events yet.</div>}
            </div>
          </div>

          <div className="border border-slate-800 bg-slate-900 p-4">
            <h2 className="text-sm font-black uppercase">Notifications</h2>
            <div className="mt-4 space-y-2">
              {notifications.slice(0, 6).map((notification) => (
                <div key={notification.id} className="border border-slate-800 bg-slate-950 p-3 text-xs">
                  <strong className="text-white">{notification.title}</strong>
                  <p className="mt-1 text-slate-400">{notification.message}</p>
                  <small className="text-slate-600">{notification.createdAt}</small>
                </div>
              ))}
              {notifications.length === 0 && <div className="border border-slate-800 bg-slate-950 p-4 text-xs text-slate-500">No Firebase readiness notifications yet.</div>}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
