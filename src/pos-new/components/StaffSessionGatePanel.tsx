import { useEffect, useMemo, useState } from 'react';
import {
  activateStaffGateSession,
  clearStaffGateSession,
  getAllowedActionsForStaffSession,
  getAllowedMenusForStaffSession,
  getCurrentStaffGateSession,
  lockStaffGateSession,
  startStaffGateSession,
  verifyStaffGatePin
} from '../auth/staffSessionGateService';
import { createBuildDevelopmentSession } from '../auth/tenantSessionService';
import { getStaffByVendor, getActiveStaffByVendorAndBranch } from '../services/staffFirestoreService';
import { mapStaffRecordToStaffSetting } from '../services/staffFirestoreService';
import { readPosAuthContext } from '../auth/posVendorAuthState';
import type { StaffDeskType, StaffGateSession } from '../auth/staffPinTypes';
import type { StaffSetting } from '../types';

const deskTypes: StaffDeskType[] = ['Sales Terminal', 'Stock Desk', 'Delivery Desk', 'Owner Desk', 'Manager Desk', 'Accounting Desk', 'Sync Desk', 'Reports Desk', 'General POS'];

export default function StaffSessionGatePanel() {
  const [session, setSession] = useState<StaffGateSession>(() => getCurrentStaffGateSession());
  const [staffOptions, setStaffOptions] = useState<StaffSetting[]>([]);
  const [staffLoading, setStaffLoading] = useState<boolean>(true);
  const [staffError, setStaffError] = useState<string>('');
  const [staffId, setStaffId] = useState(session.staffId);
  const [branchId, setBranchId] = useState(session.branchId);
  const [terminalId, setTerminalId] = useState(session.terminalId);
  const [deskType, setDeskType] = useState<StaffDeskType>(session.deskType);
  const [pin, setPin] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  const vendorId = readPosAuthContext()?.vendorId || '';

  useEffect(() => {
    let active = true;
    setStaffLoading(true);
    setStaffError('');

    const load = async () => {
      if (!vendorId) {
        if (active) {
          setStaffOptions([]);
          setStaffLoading(false);
        }
        return;
      }
      try {
        const records = await getStaffByVendor(vendorId);
        const mapped = records.map(mapStaffRecordToStaffSetting);
        if (active) {
          setStaffOptions(mapped);
          if (mapped.length > 0 && !mapped.find(s => s.id === staffId)) {
            setStaffId(mapped[0].id);
            setBranchId(mapped[0].branchId);
          }
        }
      } catch (err) {
        if (active) {
          setStaffError(err instanceof Error ? err.message : 'Failed to load staff.');
        }
      } finally {
        if (active) setStaffLoading(false);
      }
    };

    void load();
    return () => { active = false; };
  }, [vendorId]);

  const selectedStaff = useMemo(() => staffOptions.find((row) => row.id === staffId) || staffOptions[0], [staffId, staffOptions]);
  const branchOptions = useMemo(() => selectedStaff ? [{ branchId: selectedStaff.branchId, branchName: selectedStaff.branchId }] : [], [selectedStaff]);
  const selectedBranch = branchOptions.find((row) => row.branchId === branchId) || branchOptions[0];
  const terminalOptions = useMemo(() => selectedStaff?.assignedTerminalIds?.map(tid => ({ terminalId: tid, terminalName: tid })) || [], [selectedStaff]);
  const selectedTerminal = terminalOptions.find((row) => row.terminalId === terminalId) || terminalOptions[0];

  const apply = (next: StaffGateSession) => setSession(next);

  const start = () => {
    if (!selectedStaff) return;
    apply(startStaffGateSession({
      vendorId: selectedStaff.vendorId || vendorId,
      staffId: selectedStaff.id,
      staffName: selectedStaff.displayName,
      staffRole: selectedStaff.roleName,
      branchId: selectedStaff.branchId,
      branchName: selectedStaff.branchId,
      terminalId: selectedTerminal?.terminalId || '',
      terminalName: selectedTerminal?.terminalName || '',
      deskType,
      expiresAt: expiresAt || undefined
    }));
  };

  const ownerBypass = () => {
    createBuildDevelopmentSession();
    apply(clearStaffGateSession());
  };

  return (
    <section className="bg-white border-2 border-[#b1b5c2] text-[#1e222b]">
      <div className="bg-[#1e222b] text-white p-3">
        <p className="text-[9px] text-orange-400 uppercase font-black">Staff Gate Preview</p>
        <h2 className="text-sm font-black uppercase">Staff Session Gate</h2>
        <p className="text-[10px] text-slate-200 font-bold uppercase">Select staff, branch, terminal, and desk before activating a POS session.</p>
      </div>
      <div className="p-3 space-y-3">
        {staffError && (
          <div className="border border-rose-200 bg-rose-50 p-2 text-[10px] text-rose-950 font-bold uppercase">
            {staffError}
          </div>
        )}
        <div className="border border-orange-200 bg-orange-50 p-2 text-[10px] text-orange-950 font-bold uppercase">
          Staff gate is in preview mode. It does not lock the app until production gate enforcement is enabled.
        </div>
        <div className="border border-[#b1b5c2] bg-slate-50 p-2 text-[10px] text-slate-700 font-bold uppercase">
          Staff Access Rights matrix is available in Settings for role hierarchy and permission override preview.
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <Metric label="Vendor" value={selectedStaff?.vendorId || session.vendorId} />
          <Select label="Staff Member" value={staffId} onChange={(value) => { setStaffId(value); const s = staffOptions.find(row => row.id === value); if (s) setBranchId(s.branchId); }} options={staffOptions.map((row) => [row.id, `${row.displayName} (${row.roleName})`])} />
          <Select label="Branch" value={branchId} onChange={(value) => setBranchId(value)} options={branchOptions.map((row) => [row.branchId, row.branchName])} />
          <Select label="Terminal / Desk" value={terminalId} onChange={setTerminalId} options={terminalOptions.map((row) => [row.terminalId, row.terminalName])} />
          <Select label="Desk Type" value={deskType} onChange={(value) => setDeskType(value as StaffDeskType)} options={deskTypes.map((row) => [row, row])} />
          <Input label="Session Expiry Placeholder" value={expiresAt} onChange={setExpiresAt} type="datetime-local" />
        </div>
        <Input label="PIN / Password" value={pin} onChange={setPin} type="password" />
        <div className="flex flex-wrap gap-2">
          <Action label="Start Gate Session" onClick={start} />
          <Action label="Verify PIN" onClick={() => apply(verifyStaffGatePin(session.gateSessionId, pin))} />
          <Action label="Activate Session" onClick={() => apply(activateStaffGateSession(session.gateSessionId))} primary />
          <Action label="Continue as Owner" onClick={ownerBypass} />
          <Action label="Lock Session" onClick={() => apply(lockStaffGateSession(session.gateSessionId, 'Locked from Staff Session Gate panel.'))} />
          <Action label="Clear Session" onClick={() => apply(clearStaffGateSession())} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
          <Metric label="Gate Status" value={session.gateStatus} />
          <Metric label="PIN Status" value={session.pinStatus} />
          <Metric label="Staff Role" value={String(session.staffRole)} />
          <Metric label="Allowed Menus" value={String(getAllowedMenusForStaffSession(session).length)} />
          <Metric label="Allowed Actions" value={String(getAllowedActionsForStaffSession(session).length)} />
          <Metric label="Failed Attempts" value={String(session.failedAttempts)} />
          <Metric label="Last Active" value={session.lastActiveAt.replace('T', ' ').slice(0, 16)} />
          <Metric label="Desk Type" value={session.deskType} />
        </div>
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
