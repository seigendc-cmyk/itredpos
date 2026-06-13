import { useState } from 'react';
import { getFirebaseAuthShellStatus, getCurrentFirebaseUserProfile, signInWithGooglePlaceholder, signOutFirebasePlaceholder } from '../auth/firebaseAuthShell';
import TenantStaffAccessPanel from './TenantStaffAccessPanel';
import {
  createBuildDevelopmentSession,
  getAuthActivityEvents,
  getCurrentTenantSession,
  getCurrentTenantSessionClaims,
  getTenantSessionReadiness,
  recordAuthActivity,
  resolveTenantPlaceholder
} from '../auth/tenantSessionService';
import { getTenantPermissionMappingRows } from '../auth/tenantPermissionMapping';
import { getTenantResolutionReadinessRows } from '../auth/tenantResolutionService';
import type { AuthShellActionResult, TenantSession } from '../auth/authTypes';
import {
  isBuildDevelopmentBypassEnabled,
  isFirebaseAuthRequired,
  isFirebaseAuthShellEnabled,
  isStaffPinRequired,
  isTenantResolutionEnabled
} from '../repositories/repositoryConfig';

export default function AuthPreviewPanel() {
  const [authResult, setAuthResult] = useState<AuthShellActionResult | null>(null);
  const [session, setSession] = useState<TenantSession>(getCurrentTenantSession());
  const [showStaffPanel, setShowStaffPanel] = useState(false);
  const readiness = getTenantSessionReadiness();
  const resolutionReadiness = getTenantResolutionReadinessRows();
  const permissionRows = getTenantPermissionMappingRows();
  const claims = getCurrentTenantSessionClaims();
  const activity = getAuthActivityEvents().slice(0, 6);

  const checkAuth = () => {
    const status = getFirebaseAuthShellStatus();
    recordAuthActivity({ eventType: 'AUTH_SHELL_CHECKED', label: 'Auth Shell Checked', message: `Firebase Auth shell status: ${status}.`, vendorId: session.vendorId, staffId: session.staffId });
    setAuthResult({ ok: status === 'Ready' || status === 'Signed In', status, message: `Firebase Auth shell status: ${status}.`, profile: getCurrentFirebaseUserProfile() });
  };

  const resolveTenant = () => {
    const identity = resolveTenantPlaceholder(getCurrentFirebaseUserProfile());
    setAuthResult({ ok: true, status: 'Ready', message: `Tenant placeholder resolved: ${identity.vendorName}.` });
  };

  return (
    <section className="bg-white border-2 border-[#b1b5c2]">
      <div className="bg-[#1e222b] text-white p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div>
          <p className="text-[9px] text-orange-400 uppercase font-black">Auth and Tenant Session</p>
          <h2 className="text-sm font-black uppercase">Preparation Shell</h2>
          <p className="text-[10px] text-slate-200 font-bold uppercase">Auth and tenant session preparation is installed. The app still uses build-development access and mock/local data until production tenant activation.</p>
        </div>
        <span className="px-2 py-1 border text-[9px] font-black uppercase bg-slate-50 border-slate-300 text-slate-800">{session.status}</span>
      </div>
      <div className="p-3 space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
          <Metric label="Firebase Auth Shell" value={isFirebaseAuthShellEnabled() ? 'Enabled' : 'Disabled'} />
          <Metric label="Auth Required" value={isFirebaseAuthRequired() ? 'Yes' : 'No'} />
          <Metric label="Current Auth Provider" value={session.authProvider} />
          <Metric label="Tenant Session" value={session.status} />
          <Metric label="Vendor" value={session.vendorName} />
          <Metric label="Staff" value={session.staffName || '-'} />
          <Metric label="Branch" value={session.branchName || '-'} />
          <Metric label="Terminal" value={session.terminalName || '-'} />
          <Metric label="Staff PIN Required" value={isStaffPinRequired() ? 'Yes' : 'No'} />
          <Metric label="Build Development Bypass" value={isBuildDevelopmentBypassEnabled() ? 'Enabled' : 'Disabled'} />
          <Metric label="Tenant Resolution" value={isTenantResolutionEnabled() ? 'Enabled' : 'Mock Mode'} />
          <Metric label="Session Claims" value={claims.posAccessStatus} />
          <Metric label="Claim Permissions" value={String(claims.permissions.length)} />
        </div>

        <div className="flex flex-wrap gap-2">
          <Action label="Check Auth Shell" onClick={checkAuth} />
          <Action label="Sign In With Google Placeholder / Shell" onClick={async () => setAuthResult(await signInWithGooglePlaceholder())} primary />
          <Action label="Sign Out Placeholder" onClick={async () => setAuthResult(await signOutFirebasePlaceholder())} />
          <Action label="Create Build Development Session" onClick={() => setSession(createBuildDevelopmentSession())} />
          <Action label="Resolve Tenant Placeholder" onClick={resolveTenant} />
          <Action label="Open Staff Access Panel" onClick={() => setShowStaffPanel((current) => !current)} />
        </div>

        {authResult && <div className={`border p-2 text-[10px] font-black uppercase ${authResult.ok ? 'bg-emerald-50 border-emerald-400 text-emerald-900' : 'bg-orange-50 border-orange-400 text-orange-950'}`}>{authResult.message}{authResult.error ? ` Error: ${authResult.error}` : ''}</div>}

        <div className="border border-[#b1b5c2] overflow-x-auto">
          <table className="w-full text-left text-[10px]">
            <thead className="bg-[#1e222b] text-white uppercase"><tr>{['Readiness Item', 'Status', 'Notes'].map((header) => <th key={header} className="p-2">{header}</th>)}</tr></thead>
            <tbody className="divide-y divide-[#d6d9e0]">{readiness.map((item) => <tr key={item.item}><td className="p-2 font-black uppercase">{item.item}</td><td className="p-2">{item.status}</td><td className="p-2">{item.notes}</td></tr>)}</tbody>
          </table>
        </div>

        <div className="border border-[#b1b5c2] overflow-x-auto">
          <table className="w-full text-left text-[10px]">
            <thead className="bg-[#1e222b] text-white uppercase"><tr>{['Tenant Resolution Item', 'Status', 'Future Contract Path', 'Notes'].map((header) => <th key={header} className="p-2">{header}</th>)}</tr></thead>
            <tbody className="divide-y divide-[#d6d9e0]">{resolutionReadiness.map((item) => <tr key={item.item}><td className="p-2 font-black uppercase">{item.item}</td><td className="p-2">{item.status}</td><td className="p-2 font-semibold text-slate-700">{item.contractPath}</td><td className="p-2">{item.notes}</td></tr>)}</tbody>
          </table>
        </div>

        <div className="border border-[#b1b5c2] overflow-x-auto">
          <table className="w-full text-left text-[10px]">
            <thead className="bg-[#1e222b] text-white uppercase"><tr>{['Tenant Role', 'POS Role', 'Permissions', 'Menus'].map((header) => <th key={header} className="p-2">{header}</th>)}</tr></thead>
            <tbody className="divide-y divide-[#d6d9e0]">{permissionRows.map((row) => <tr key={row.tenantRole}><td className="p-2 font-black uppercase">{row.tenantRole}</td><td className="p-2">{row.posRole}</td><td className="p-2">{row.permissionCount}</td><td className="p-2">{row.menuCount}</td></tr>)}</tbody>
          </table>
        </div>

        <div className="border border-orange-200 bg-orange-50 p-2 text-[10px] text-orange-950 font-bold uppercase">
          Firebase Auth is not a route guard in this build. Tenant resolution is {isTenantResolutionEnabled() ? 'enabled' : 'placeholder-disabled'} and Firestore business data remains disabled.
        </div>

        {showStaffPanel && <TenantStaffAccessPanel onSessionChange={setSession} />}

        {activity.length > 0 && <div className="grid grid-cols-1 md:grid-cols-2 gap-2">{activity.map((event) => <div key={event.eventId} className="border border-[#b1b5c2] p-2 text-[10px] uppercase"><strong>{event.label}</strong><p className="font-semibold text-slate-700">{event.message}</p></div>)}</div>}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="border border-[#b1b5c2] bg-slate-50 p-3 min-h-16"><span className="block text-[8.5px] text-slate-500 uppercase font-black">{label}</span><strong className="block mt-1 text-[11px] text-[#1e222b] uppercase break-words">{value}</strong></div>;
}

function Action({ label, onClick, primary = false }: { label: string; onClick: () => void; primary?: boolean }) {
  return <button type="button" className={`px-3 py-2 border text-[9px] font-black uppercase ${primary ? 'bg-orange-600 border-orange-700 text-white' : 'bg-white border-[#b1b5c2] text-[#1e222b] hover:bg-orange-50'}`} onClick={onClick}>{label}</button>;
}
