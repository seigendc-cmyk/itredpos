import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Wrench, Cpu } from 'lucide-react';
import {
  getVendorBusinessUserMirror,
  mirrorOwnerAsBusinessUser,
  type VendorBusinessUserMirror
} from '../services/vendorStaffMirrorService';
import { readPosAuthContext } from '../auth/posVendorAuthState';
import { resolveDiagnosticVendorId } from '../utils/vendorDataMode';
import { seedOrRepairVendorAndOwnerMirror } from '../services/vendorOwnerSeedService';

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown mirror error.';
}

/**
 * Developer / admin diagnostic panel for the vendor-rooted Firestore staff mirror:
 *   vendors/{vendorId}/businessUsers/{uid}
 *
 * It only reads/repairs the OWNER mirror (keyed by the current Google session uid).
 * It never exposes PINs, PIN hashes, passwords, or any auth secret.
 * If vendorId or uid is missing the panel shows a safe empty state and never crashes.
 */
export default function VendorStaffMirrorDiagnosticsPanel() {
  const [mirror, setMirror] = useState<VendorBusinessUserMirror | null>(null);
  const [loading, setLoading] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const auth = readPosAuthContext();
  // Real tenant lookup priority — no DEMO-VENDOR fallback (see resolveDiagnosticVendorId).
  const vendorId = resolveDiagnosticVendorId();
  const uid = auth?.googleUid || '';
  const ownerEmail = auth?.googleEmail || '';
  const ownerName = auth?.googleEmail?.split('@')[0] || auth?.vendorName || '';

  const hasVendorId = Boolean(vendorId);
  const hasUid = Boolean(uid);
  const canAct = hasVendorId && hasUid;

  const loadStatus = useCallback(async () => {
    if (!vendorId || !uid) {
      setMirror(null);
      setMessage('vendorId or uid is missing — mirror cannot be read.');
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      setMirror(await getVendorBusinessUserMirror(vendorId, uid));
    } catch (error) {
      setMirror(null);
      setMessage(`Failed to read mirror: ${describeError(error)}`);
    } finally {
      setLoading(false);
    }
  }, [vendorId, uid]);

  const repairOwner = useCallback(async () => {
    if (!vendorId || !uid) {
      setMessage('Cannot repair owner mirror: vendorId or uid is missing.');
      return;
    }
    setRepairing(true);
    setMessage(null);
    try {
      setMirror(await mirrorOwnerAsBusinessUser(vendorId, uid, ownerEmail, ownerName));
      setMessage('Owner mirror created / repaired at vendors/' + vendorId + '/businessUsers/' + uid);
    } catch (error) {
      setMessage(`Owner mirror repair failed: ${describeError(error)}`);
    } finally {
      setRepairing(false);
    }
  }, [vendorId, uid, ownerEmail, ownerName]);

  useEffect(() => {
    if (!canAct) {
      setMirror(null);
      return;
    }
    void loadStatus();
  }, [canAct, loadStatus]);

  return (
    <div className="space-y-4">
      <div className="border-b border-slate-800 pb-2 flex items-center justify-between">
        <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Cpu className="w-4 h-4 text-orange-500" />
          STAFF MIRROR DIAGNOSTICS
        </span>
        <span className="text-[9px] text-orange-400 uppercase bg-slate-950 px-1 border border-slate-900">
          DEV / ADMIN
        </span>
      </div>

      <p className="text-[10px] text-slate-400 uppercase leading-relaxed">
        Verifies the vendor-rooted membership mirror at vendors/&#123;vendorId&#125;/businessUsers/&#123;uid&#125;.
        No PINs or secrets are exposed.
      </p>

      {!hasVendorId && (
        <div className="p-3 bg-slate-950 border border-slate-800 text-amber-400 font-mono text-[10px] uppercase">
          No vendorId resolved. Sign in or activate a vendor before repairing mirror.
        </div>
      )}

      {!hasUid && (
        <div className="p-3 bg-slate-950 border border-slate-800 text-amber-400 font-mono text-[10px] uppercase">
          No Firebase UID resolved. Google owner sign-in is required.
        </div>
      )}

      {canAct && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] font-mono">
          <Field label="vendorId" value={vendorId} />
          <Field label="Firebase uid" value={uid} />
          <Field
            label="Owner mirror"
            value={mirror ? 'FOUND' : 'NOT FOUND'}
            tone={mirror ? 'ok' : 'warn'}
          />
          <Field label="role" value={mirror?.role ?? '—'} />
          <Field label="status" value={mirror?.status ?? '—'} tone={mirror?.status === 'active' ? 'ok' : 'warn'} />
          <Field label="permissions" value={mirror ? String(mirror.permissions?.length ?? 0) : '—'} />
          <Field label="updatedAt" value={mirror?.updatedAt ?? '—'} />
        </div>
      )}

      {message && (
        <div className="p-2 bg-slate-950 border border-slate-800 text-slate-300 font-mono text-[10px] uppercase break-words">
          {message}
        </div>
      )}

      {(hasVendorId || hasUid) && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadStatus()}
            disabled={loading || !canAct}
            className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white px-3 py-1.5 text-[10px] font-black uppercase flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Refreshing…' : 'Refresh Mirror Status'}
          </button>
          <button
            type="button"
            onClick={() => void repairOwner()}
            disabled={repairing || !canAct}
            className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white px-3 py-1.5 text-[10px] font-black uppercase flex items-center gap-1.5"
          >
            <Wrench className="w-3 h-3" />
            {repairing ? 'Repairing…' : 'Create / Repair Owner Mirror'}
          </button>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'warn' }) {
  const toneClass = tone === 'ok' ? 'text-emerald-400' : tone === 'warn' ? 'text-amber-400' : 'text-slate-200';
  return (
    <div className="p-2 bg-slate-950 border border-slate-800 flex flex-col gap-0.5">
      <span className="text-[9px] text-slate-500 uppercase">{label}</span>
      <span className={`break-words ${toneClass}`}>{value}</span>
    </div>
  );
}
