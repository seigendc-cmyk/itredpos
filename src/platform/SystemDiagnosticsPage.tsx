import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Cpu,
  Database,
  FileSearch,
  HardDrive,
  KeyRound,
  RefreshCw,
  ShieldCheck
} from 'lucide-react';
import {
  getFirestoreMode,
  getFirestoreModeStatus,
  initializeSCIFirebase
} from '../firebase/firebaseClient';
import { readPosAuthContext, type PosVendorAuthContext } from '../pos-new/auth/posVendorAuthState';
import VendorStaffMirrorDiagnosticsPanel from '../pos-new/components/VendorStaffMirrorDiagnosticsPanel';
import {
  getOfflineSyncQueue,
  getSyncBatches,
  getSyncConflicts
} from '../pos-new/services/offlineSyncService';

type DeveloperAuthContext = PosVendorAuthContext & { developerMode?: boolean };

type SyncDiagnostics = {
  queueItems: number;
  pendingItems: number;
  failedItems: number;
  conflictItems: number;
  batches: number;
  conflicts: number;
};

const emptySyncDiagnostics: SyncDiagnostics = {
  queueItems: 0,
  pendingItems: 0,
  failedItems: 0,
  conflictItems: 0,
  batches: 0,
  conflicts: 0
};

export function canAccessSystemDiagnostics(): boolean {
  const auth = readPosAuthContext() as DeveloperAuthContext | null;
  return auth?.staffRole === 'Owner' && auth.developerMode === true;
}

function navigate(path: string) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export default function SystemDiagnosticsPage() {
  const auth = readPosAuthContext() as DeveloperAuthContext | null;
  const allowed = canAccessSystemDiagnostics();
  const readiness = initializeSCIFirebase();
  const mode = getFirestoreMode();
  const modeStatus = useMemo(() => getFirestoreModeStatus(mode, readiness), [mode, readiness.configured, readiness.firestoreReady]);
  const [syncDiagnostics, setSyncDiagnostics] = useState<SyncDiagnostics>(emptySyncDiagnostics);

  useEffect(() => {
    if (!allowed) return;
    let active = true;
    void Promise.all([
      getOfflineSyncQueue(),
      getSyncBatches(),
      getSyncConflicts()
    ]).then(([queue, batches, conflicts]) => {
      if (!active) return;
      setSyncDiagnostics({
        queueItems: queue.length,
        pendingItems: queue.filter((item) => !['Synced', 'Cancelled'].includes(item.status)).length,
        failedItems: queue.filter((item) => item.status === 'Failed').length,
        conflictItems: queue.filter((item) => item.status === 'Conflict').length,
        batches: batches.length,
        conflicts: conflicts.length
      });
    });
    return () => {
      active = false;
    };
  }, [allowed]);

  if (!allowed) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
        <div className="mx-auto max-w-3xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-orange-400" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-orange-400">Platform</p>
              <h1 className="text-xl font-black uppercase text-white">System Diagnostics Locked</h1>
            </div>
          </div>
          <p className="mt-4 text-sm font-bold uppercase leading-relaxed text-slate-300">
            This page is available only when the current user role is Owner and developer mode is enabled.
          </p>
          <button
            type="button"
            onClick={() => navigate('/pos-prototype')}
            className="mt-5 inline-flex items-center gap-2 border border-orange-600 bg-orange-600 px-4 py-2 text-xs font-black uppercase text-white hover:bg-orange-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to POS
          </button>
        </div>
      </main>
    );
  }

  const databaseId = String(import.meta.env.VITE_FIRESTORE_DATABASE_ID || import.meta.env.VITE_FIREBASE_DATABASE_ID || '(default)');
  const collectionHealth = [
    ['vendors', readiness.firestoreReady ? 'Readable when rules allow' : 'Firestore unavailable'],
    ['vendorUsers', readiness.firestoreReady ? 'Readiness pending role checks' : 'Firestore unavailable'],
    ['branches', readiness.firestoreReady ? 'Readiness pending vendor scope' : 'Firestore unavailable'],
    ['warehouses', readiness.firestoreReady ? 'Readiness pending vendor scope' : 'Firestore unavailable'],
    ['staff', readiness.firestoreReady ? 'Staff collection configured' : 'Firestore unavailable'],
    ['pos_terminals', readiness.firestoreReady ? 'Terminal collection configured' : 'Firestore unavailable'],
    ['licenses', readiness.firestoreReady ? 'License collection configured' : 'Firestore unavailable'],
    ['vendor_settings', readiness.firestoreReady ? 'Tax/settings collection configured' : 'Firestore unavailable']
  ];

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="border border-slate-800 bg-slate-900 p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-orange-400">Platform</p>
              <h1 className="mt-2 text-2xl font-black uppercase text-white">System Diagnostics</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-400">
                Internal platform identifiers, collection health, rule warnings, sync queue details, mirror diagnostics, and license state.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/pos-prototype')}
              className="inline-flex items-center gap-2 border border-slate-700 bg-slate-950 px-4 py-2 text-xs font-black uppercase text-slate-200 hover:border-orange-500"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to POS
            </button>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-4">
          <Metric label="Firebase project ID" value={readiness.projectId || 'Not configured'} />
          <Metric label="Firestore database ID" value={databaseId} />
          <Metric label="Firestore mode" value={modeStatus.currentModeLabel} />
          <Metric label="Rules errors" value={readiness.warnings.length ? `${readiness.warnings.length} warning(s)` : 'None reported'} />
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <Panel title="Identity IDs" icon={KeyRound}>
            <Field label="Google UID" value={auth?.googleUid || 'Missing'} />
            <Field label="vendorId" value={auth?.vendorId || 'Missing'} />
            <Field label="branchId" value={auth?.branchId || 'Missing'} />
            <Field label="staffId" value={auth?.staffId || 'Missing'} />
            <Field label="terminalId" value={auth?.terminalId || 'Missing'} />
          </Panel>

          <Panel title="License Diagnostics" icon={FileSearch}>
            <Field label="Plan code" value={auth?.planCode || 'Missing'} />
            <Field label="License mode" value={auth?.licenseMode || 'Missing'} />
            <Field label="License status" value={auth?.licenseStatus || 'Missing'} />
            <Field label="Activation status" value={auth?.activationStatus || 'Missing'} />
            <Field label="Trial expires" value={auth?.trialExpiresAt || auth?.demoExpiresAt || 'Missing'} />
          </Panel>

          <Panel title="Sync Queue Details" icon={RefreshCw}>
            <Field label="Queue items" value={String(syncDiagnostics.queueItems)} />
            <Field label="Pending items" value={String(syncDiagnostics.pendingItems)} />
            <Field label="Failed items" value={String(syncDiagnostics.failedItems)} />
            <Field label="Conflict items" value={String(syncDiagnostics.conflictItems)} />
            <Field label="Batches" value={String(syncDiagnostics.batches)} />
            <Field label="Conflict records" value={String(syncDiagnostics.conflicts)} />
          </Panel>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Panel title="Collection Health" icon={Database}>
            <div className="grid gap-2">
              {collectionHealth.map(([name, status]) => (
                <div key={name} className="grid grid-cols-1 gap-1 border border-slate-800 bg-slate-950 p-3 md:grid-cols-3">
                  <span className="text-[10px] font-black uppercase text-orange-300">{name}</span>
                  <span className="text-xs font-bold text-slate-300 md:col-span-2">{status}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Rule Verification" icon={AlertTriangle}>
            {readiness.warnings.length > 0 ? (
              <div className="space-y-2">
                {readiness.warnings.map((warning) => (
                  <div key={warning} className="border border-orange-700 bg-orange-950/40 p-3 text-xs font-bold text-orange-200">
                    {warning}
                  </div>
                ))}
              </div>
            ) : (
              <div className="border border-emerald-800 bg-emerald-950/30 p-3 text-xs font-bold text-emerald-200">
                No Firebase readiness warnings are currently reported.
              </div>
            )}
          </Panel>
        </section>

        <section className="border border-slate-800 bg-slate-900 p-4">
          <div className="mb-4 flex items-center gap-2">
            <Cpu className="h-4 w-4 text-orange-400" />
            <h2 className="text-sm font-black uppercase text-white">Owner Mirror / Staff Mirror</h2>
          </div>
          <VendorStaffMirrorDiagnosticsPanel />
        </section>

        <section className="border border-slate-800 bg-slate-900 p-4">
          <div className="mb-4 flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-orange-400" />
            <h2 className="text-sm font-black uppercase text-white">Activation Token Diagnostics</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Metric label="Account status" value={auth?.accountStatus || 'Missing'} />
            <Metric label="Verification status" value={auth?.verificationStatus || 'Missing'} />
            <Metric label="Console provisioned at" value={auth?.consoleProvisionedAt || 'Missing'} />
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-slate-800 bg-slate-900 p-3">
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-black text-slate-100">{value}</p>
    </div>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <section className="border border-slate-800 bg-slate-900 p-4">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-4 w-4 text-orange-400" />
        <h2 className="text-sm font-black uppercase text-white">{title}</h2>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-slate-800 bg-slate-950 p-3">
      <p className="text-[9px] font-black uppercase text-slate-500">{label}</p>
      <p className="mt-1 break-words text-xs font-bold text-slate-200">{value}</p>
    </div>
  );
}
