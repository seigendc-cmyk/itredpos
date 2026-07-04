import { useMemo, useState } from 'react';
import { getCurrentFirebaseUserProfile } from '../auth/firebaseAuthShell';
import {
  activateStaffMappedSession,
  clearTenantSession,
  createBuildDevelopmentSession,
  getCurrentTenantSession,
  getCurrentTenantSessionClaims,
  getTenantMembershipsForCurrentProfile,
  loadBranchesForCurrentTenant,
  loadStaffProfilesForCurrentTenant,
  loadTerminalsForCurrentBranch,
  resolveTenantPlaceholder,
  selectTenantMembershipForSession
} from '../auth/tenantSessionService';
import type { TenantSession } from '../auth/authTypes';
import type {
  TenantBranchAccessContract,
  TenantMembershipContract,
  TenantSessionClaims,
  TenantStaffProfileContract,
  TenantTerminalAccessContract
} from '../auth/tenantResolutionTypes';
import TenantSessionClaimsPanel from './TenantSessionClaimsPanel';

export default function TenantStaffAccessPanel({ onSessionChange }: { onSessionChange?: (session: TenantSession) => void }) {
  const current = getCurrentTenantSession();
  const [session, setSession] = useState<TenantSession>(current);
  const [memberships, setMemberships] = useState<TenantMembershipContract[]>(() => getTenantMembershipsForCurrentProfile(getCurrentFirebaseUserProfile()));
  const [membershipId, setMembershipId] = useState(current.membershipId || memberships[0]?.membershipId || '');
  const [staffRows, setStaffRows] = useState<TenantStaffProfileContract[]>(() => loadStaffProfilesForCurrentTenant());
  const [staffId, setStaffId] = useState(current.staffId || staffRows[0]?.staffId || '');
  const [branchRows, setBranchRows] = useState<TenantBranchAccessContract[]>(() => loadBranchesForCurrentTenant(current.staffId || staffRows[0]?.staffId));
  const [branchId, setBranchId] = useState(current.branchId || branchRows[0]?.branchId || '');
  const [terminalRows, setTerminalRows] = useState<TenantTerminalAccessContract[]>(() => loadTerminalsForCurrentBranch(current.branchId || branchRows[0]?.branchId || '', current.staffId || staffRows[0]?.staffId));
  const [terminalId, setTerminalId] = useState(current.terminalId || terminalRows[0]?.terminalId || '');
  const [pinOrPassword, setPinOrPassword] = useState('');
  const [claims, setClaims] = useState<TenantSessionClaims>(() => getCurrentTenantSessionClaims());
  const selectedMembership = useMemo(() => memberships.find((row) => row.membershipId === membershipId), [memberships, membershipId]);
  const selectedStaff = useMemo(() => staffRows.find((row) => row.staffId === staffId), [staffRows, staffId]);
  const selectedBranch = useMemo(() => branchRows.find((row) => row.branchId === branchId), [branchRows, branchId]);
  const selectedTerminal = useMemo(() => terminalRows.find((row) => row.terminalId === terminalId), [terminalRows, terminalId]);

  const applySession = (next: TenantSession) => {
    setSession(next);
    setClaims(getCurrentTenantSessionClaims());
    onSessionChange?.(next);
  };

  const resolveTenant = () => {
    resolveTenantPlaceholder(getCurrentFirebaseUserProfile());
    const nextMemberships = getTenantMembershipsForCurrentProfile(getCurrentFirebaseUserProfile());
    setMemberships(nextMemberships);
    const nextMembershipId = nextMemberships[0]?.membershipId || membershipId;
    setMembershipId(nextMembershipId);
    applySession(getCurrentTenantSession());
  };

  const selectMembership = () => {
    const next = selectTenantMembershipForSession(membershipId);
    const nextStaffRows = loadStaffProfilesForCurrentTenant();
    setStaffRows(nextStaffRows);
    setStaffId(next.staffId || nextStaffRows[0]?.staffId || '');
    applySession(next);
  };

  const loadStaff = () => {
    const rows = loadStaffProfilesForCurrentTenant();
    setStaffRows(rows);
    setStaffId(rows[0]?.staffId || staffId);
  };

  const loadBranches = (nextStaffId = staffId) => {
    const rows = loadBranchesForCurrentTenant(nextStaffId);
    setBranchRows(rows);
    setBranchId(rows[0]?.branchId || branchId);
    return rows;
  };

  const loadTerminals = (nextBranchId = branchId, nextStaffId = staffId) => {
    const rows = loadTerminalsForCurrentBranch(nextBranchId, nextStaffId);
    setTerminalRows(rows);
    setTerminalId(rows[0]?.terminalId || terminalId);
    return rows;
  };

  const activate = () => applySession(activateStaffMappedSession(staffId, branchId, terminalId, pinOrPassword));

  return (
    <section className="bg-white border-2 border-[#b1b5c2]">
      <div className="bg-[#1e222b] text-white p-3">
        <p className="text-[9px] text-orange-400 uppercase font-black">Tenant Resolution Mock Mode</p>
        <h2 className="text-sm font-black uppercase">Tenant Staff Access Panel</h2>
      </div>
      <div className="p-3 space-y-3">
        <div className="border border-orange-200 bg-orange-50 p-2 text-[10px] text-orange-950 font-bold uppercase">
          Tenant resolution uses the mock directory in this build. Production Firestore tenant lookup, production Auth gate, and business Firestore reads/writes are not activated.
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2">
          <Metric label="Signed-In Email" value={session.googleEmail || session.vendorEmail || selectedMembership?.signedInEmail || 'owner@build.local'} />
          <Metric label="Vendor Tenant" value={selectedMembership?.vendorName || session.vendorName} />
          <Metric label="Membership" value={membershipId || '-'} />
          <Metric label="Membership Role" value={selectedMembership?.role || session.membershipRole || '-'} />
          <Metric label="POS Access" value={claims.posAccessStatus} />
          <Metric label="Session" value={session.status} />
          <Metric label="Staff Profile" value={selectedStaff ? `${selectedStaff.staffName} / ${selectedStaff.status}` : '-'} />
          <Metric label="Branch Access" value={selectedBranch ? `${selectedBranch.branchName} / ${selectedBranch.accessStatus}` : '-'} />
          <Metric label="Terminal Access" value={selectedTerminal ? `${selectedTerminal.terminalName} / ${selectedTerminal.accessStatus}` : '-'} />
          <Metric label="PIN Placeholder" value={selectedStaff?.pinRequired ? 'Required' : 'Not Required'} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Select label="Membership" value={membershipId} onChange={setMembershipId} options={memberships.map((row) => [row.membershipId, `${row.vendorName} (${row.role} / ${row.accessStatus})`])} />
          <Select label="Staff Profile" value={staffId} onChange={(value) => { setStaffId(value); const branches = loadBranches(value); loadTerminals(branches[0]?.branchId || branchId, value); }} options={staffRows.map((staff) => [staff.staffId, `${staff.staffName} (${staff.role} / ${staff.status})`])} />
          <Select label="Branch" value={branchId} onChange={(value) => { setBranchId(value); loadTerminals(value, staffId); }} options={branchRows.map((branch) => [branch.branchId, `${branch.branchName} (${branch.accessStatus})`])} />
          <Select label="Terminal / Desk" value={terminalId} onChange={setTerminalId} options={terminalRows.map((terminal) => [terminal.terminalId, `${terminal.terminalName} (${terminal.accessStatus})`])} />
        </div>
        <Input label="Staff PIN / Password Placeholder" value={pinOrPassword} onChange={setPinOrPassword} type="password" />

        <div className="flex flex-wrap gap-2">
          <Action label="Resolve Tenant Placeholder" onClick={resolveTenant} />
          <Action label="Select Membership" onClick={selectMembership} />
          <Action label="Load Staff Profiles" onClick={loadStaff} />
          <Action label="Load Branch Access" onClick={() => loadBranches()} />
          <Action label="Load Terminal Access" onClick={() => loadTerminals()} />
          <Action label="Activate Staff Session" onClick={activate} primary />
          <Action label="Create Owner Session" onClick={() => applySession(createBuildDevelopmentSession())} />
          <Action label="Clear Session" onClick={() => applySession(clearTenantSession())} />
        </div>

        <TenantSessionClaimsPanel claims={claims} />
      </div>
    </section>
  );
}

function Input({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="block text-[9px] uppercase font-black text-slate-500">{label}<input className="w-full p-2 border border-[#b1b5c2] text-xs" type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[][] }) {
  return <label className="text-[9px] uppercase font-black text-slate-500">{label}<select className="w-full p-2 border border-[#b1b5c2] text-xs bg-white" value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([id, text]) => <option key={id} value={id}>{text}</option>)}</select></label>;
}

function Action({ label, onClick, primary = false }: { label: string; onClick: () => void; primary?: boolean }) {
  return <button type="button" className={`px-3 py-2 border text-[9px] font-black uppercase ${primary ? 'bg-orange-600 border-orange-700 text-white' : 'bg-white border-[#b1b5c2] text-[#1e222b] hover:bg-orange-50'}`} onClick={onClick}>{label}</button>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="border border-[#b1b5c2] bg-slate-50 p-2 min-h-14"><span className="block text-[8px] uppercase font-black text-slate-500">{label}</span><strong className="block text-[10px] uppercase text-[#1e222b] break-words">{value}</strong></div>;
}
