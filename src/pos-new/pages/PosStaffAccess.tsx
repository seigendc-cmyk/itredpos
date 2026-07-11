import React, { useState, FormEvent, useEffect } from 'react';
import { ShieldCheck, KeyRound, Server, Building2, Users, MonitorSmartphone, ArrowRight, ShieldAlert, Cpu } from 'lucide-react';
import { PosSession } from '../types';
import {
  adaptSciStaffSessionToPosSession,
  authenticateStaffAccess,
  loadStaffAccessData,
  readSciVendorOwnerSession,
  saveSciPosStaffSession,
  type StaffAccessBranch,
  type StaffAccessStaff,
  type StaffAccessTerminal,
  type StaffAccessWarehouse
} from '../../sci-auth/StaffAuthService';
import { recordStaffAuditEvent } from '../services/staffAuditService';


interface PosStaffAccessProps {
  onLoginSuccess: (session: PosSession) => void;
  onBackToBios: () => void;
}

const SHOW_DEV_BADGES = false;

export default function PosStaffAccess({
  onLoginSuccess,
  onBackToBios
}: PosStaffAccessProps) {

  const session = readSciVendorOwnerSession();
  const vendorId = session?.vendorId || '';

  const [staffList, setStaffList] = useState<StaffAccessStaff[]>([]);
  const [branches, setBranches] = useState<StaffAccessBranch[]>([]);
  const [warehouses, setWarehouses] = useState<StaffAccessWarehouse[]>([]);
  const [terminals, setTerminals] = useState<StaffAccessTerminal[]>([]);
  const [staffLoading, setStaffLoading] = useState<boolean>(true);
  const [staffError, setStaffError] = useState<string>('');

  const vendors = vendorId ? [{ id: vendorId, name: session?.vendorName || 'Current Vendor' }] : [];

  const [selectedVendor, setSelectedVendor] = useState<string>(vendors[0]?.name || '');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [selectedTerminalId, setSelectedTerminalId] = useState<string>('');
  const [password, setPassword] = useState<string>('');

  useEffect(() => {
    let active = true;
    setStaffLoading(true);
    setStaffError('');

    const loadStaff = async () => {
      if (!vendorId) {
        if (active) {
          setStaffError('Vendor session missing');
          setStaffList([]);
          setBranches([]);
          setWarehouses([]);
          setTerminals([]);
          setSelectedStaffId('');
          setStaffLoading(false);
        }
        return;
      }
      try {
        const data = await loadStaffAccessData(vendorId);
        if (active) {
          setStaffList(data.staff);
          setBranches(data.branches);
          setWarehouses(data.warehouses);
          setTerminals(data.terminals);
          setSelectedBranchId(data.branches[0]?.branchId || '');
          setSelectedWarehouseId(data.warehouses.find((warehouse) => warehouse.branchId === data.branches[0]?.branchId)?.warehouseId || data.warehouses[0]?.warehouseId || '');
          setSelectedTerminalId(data.terminals.find((terminal) => terminal.branchId === data.branches[0]?.branchId)?.terminalId || data.terminals[0]?.terminalId || '');
          setSelectedStaffId(data.staff.length > 0 ? data.staff[0].staffId : '');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load staff from database.';
        if (active) {
          console.error('[PosStaffAccess] Staff access load failed', err);
          setStaffError(message);
          setStaffList([]);
          setBranches([]);
          setWarehouses([]);
          setTerminals([]);
          setSelectedStaffId('');
        }
      } finally {
        if (active) setStaffLoading(false);
      }
    };

    void loadStaff();
    return () => {
      active = false;
    };
  }, [vendorId]);

  useEffect(() => {
    if (!selectedBranchId) return;
    const branchWarehouses = warehouses.filter((warehouse) => warehouse.branchId === selectedBranchId);
    const branchTerminals = terminals.filter((terminal) => terminal.branchId === selectedBranchId);
    if (branchWarehouses.length > 0 && !branchWarehouses.some((warehouse) => warehouse.warehouseId === selectedWarehouseId)) {
      setSelectedWarehouseId(branchWarehouses[0].warehouseId);
    }
    if (branchTerminals.length > 0 && !branchTerminals.some((terminal) => terminal.terminalId === selectedTerminalId)) {
      setSelectedTerminalId(branchTerminals[0].terminalId);
    }
  }, [selectedBranchId, selectedTerminalId, selectedWarehouseId, terminals, warehouses]);

  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (staffLoading) {
      setErrorMsg('AUTHENTICATION BLOCKED: Staff records are still loading.');
      return;
    }

    if (staffList.length === 0) {
      setErrorMsg('No active staff found for this branch. Induct staff before terminal access.');
      return;
    }

    if (!selectedStaffId) {
      setErrorMsg('AUTHENTICATION BLOCKED: Select a staff member to continue.');
      return;
    }

    if (!password.trim()) {
      setErrorMsg('AUTHENTICATION BLOCKED: PIN/PASSWORD REQUIRED FOR ACCESS TOKEN CREATION');
      return;
    }

    setIsAuthenticating(true);

    try {
      if (!session) {
        setErrorMsg('Vendor session missing');
        setIsAuthenticating(false);
        return;
      }

      const result = authenticateStaffAccess({
        vendorSession: session,
        staffId: selectedStaffId,
        pin: password.trim(),
        branchId: selectedBranchId,
        warehouseId: selectedWarehouseId,
        terminalId: selectedTerminalId,
        staff: staffList,
        branches,
        warehouses,
        terminals
      });

      if (!result.ok || !result.session) {
        setErrorMsg(result.message);
        setIsAuthenticating(false);
        return;
      }

      saveSciPosStaffSession(result.session);
      const enrichedSession: PosSession = adaptSciStaffSessionToPosSession(result.session);

      await recordStaffAuditEvent({
        vendorId: result.session.vendorId,
        branchId: result.session.branchId,
        terminalId: selectedTerminalId,
        staffId: result.session.staffId,
        roleId: result.session.role,
        eventType: 'STAFF_LOGIN_SUCCESS',
        timestamp: new Date().toISOString(),
        metadata: { displayName: result.session.staffName, roleName: result.session.role }
      });

      onLoginSuccess(enrichedSession);
    } catch (err) {
      console.error('[PosStaffAccess] Staff login failed', err);
      const message = err instanceof Error ? err.message : 'Authentication failed.';
      setErrorMsg(message);
      await recordStaffAuditEvent({
        vendorId,
        branchId: selectedBranchId,
        terminalId: selectedTerminalId,
        staffId: selectedStaffId,
        roleId: '',
        eventType: 'STAFF_LOGIN_FAILED',
        timestamp: new Date().toISOString(),
        metadata: { reason: message }
      });
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090d] text-slate-300 flex flex-col justify-center items-center p-4 md:p-8 font-mono select-none antialiased relative overflow-hidden text-xs">
      {/* Visual background scanning layer */}
      <div className="absolute inset-0 bg-slate-950/40 pointer-events-none z-10 scan-pulse"></div>

      {/* Title & Metadata Header */}
      <div className="w-full max-w-lg mb-6 text-center space-y-1">
        <div className="text-[10px] tracking-widest text-[#00f0ff] font-bold uppercase">
          iTred Commerce POS - Vendor Commerce Terminal
        </div>
        <h1 className="text-xl font-black text-slate-100 tracking-tight flex items-center justify-center gap-2">
          <Cpu className="w-5 h-5 text-amber-500 animate-pulse" />
          Staff Access
        </h1>
        <div className="h-[1px] bg-gradient-to-r from-transparent via-slate-800 to-transparent my-2" />
      </div>

      {/* Main access gateway card */}
      <div className="w-full max-w-lg bg-[#0f131a] border border-slate-800 p-6 md:p-8 relative z-20 shadow-2xl">
        {/* Precise angular cuts representing machinery look */}
        <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-amber-500"></div>
        <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-amber-400"></div>
        <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-amber-400"></div>
        <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-amber-500"></div>

        {staffError && (
          <div className="mb-4 bg-rose-950/40 border border-rose-800 p-3 text-rose-400 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="leading-tight text-[10px]">
              <span className="font-bold block text-rose-300 uppercase">LOAD FAILURE</span>
              {staffError}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Vendor Selector */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              <Building2 className="w-3.5 h-3.5 text-amber-500" />
              1. Enterprise Vendor
            </label>
            <select
              value={selectedVendor}
              onChange={(e) => setSelectedVendor(e.target.value)}
              disabled={staffLoading || branches.length === 0}

              className="w-full bg-slate-950 text-emerald-400 border border-slate-800 focus:border-[#00f0ff] px-3 py-2 outline-none rounded-none text-xs font-bold transition-colors cursor-pointer"
            >
              {vendors.map((v) => (
                <option key={v.id} value={v.name}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          {/* Branch Selector */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              <Server className="w-3.5 h-3.5 text-indigo-400" />
              2. Branch Location
            </label>
            <select
              value={selectedBranchId}
              onChange={(e) => {
                setSelectedBranchId(e.target.value);
                setErrorMsg('');
              }}
              disabled={staffLoading || branches.length === 0}

              className="w-full bg-slate-950 text-slate-200 border border-slate-800 focus:border-[#00f0ff] px-3 py-2 outline-none rounded-none text-xs transition-colors cursor-pointer"
            >
              {branches.map((b) => (
                <option key={b.branchId} value={b.branchId}>
                  {b.branchName}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Warehouse Selector */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                <Server className="w-3.5 h-3.5 text-indigo-400" />
                3. Warehouse
              </label>
              <select
                value={selectedWarehouseId}
                onChange={(e) => {
                  setSelectedWarehouseId(e.target.value);
                  setErrorMsg('');
                }}
                disabled={staffLoading || warehouses.length === 0}

                className="w-full bg-slate-950 text-slate-200 border border-slate-800 focus:border-[#00f0ff] px-3 py-2 outline-none rounded-none text-xs transition-colors cursor-pointer"
              >
                {warehouses
                  .filter((warehouse) => !selectedBranchId || warehouse.branchId === selectedBranchId)
                  .map((warehouse) => (
                    <option key={warehouse.warehouseId} value={warehouse.warehouseId}>
                      {warehouse.warehouseName}
                    </option>
                  ))}
              </select>
            </div>

            {/* Terminal Selector */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                <MonitorSmartphone className="w-3.5 h-3.5 text-emerald-400" />
                4. Terminal Unit
              </label>
              <select
                value={selectedTerminalId}
                onChange={(e) => {
                  setSelectedTerminalId(e.target.value);
                  setErrorMsg('');
                }}
                disabled={staffLoading || terminals.length === 0}

                className="w-full bg-slate-950 text-slate-200 border border-slate-800 focus:border-[#00f0ff] px-3 py-2 outline-none rounded-none text-xs transition-colors cursor-pointer"
              >
                {terminals
                  .filter((terminal) => !selectedBranchId || terminal.branchId === selectedBranchId)
                  .map((t) => (
                    <option key={t.terminalId} value={t.terminalId}>
                      {t.terminalName}
                    </option>
                  ))}
              </select>
            </div>

            {/* Staff Selector */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                <Users className="w-3.5 h-3.5 text-[#00f0ff]" />
                5. Staff Member
              </label>
              <select
                value={selectedStaffId}
                onChange={(e) => {
                  setSelectedStaffId(e.target.value);
                  setErrorMsg('');
                }}
                disabled={staffLoading || staffList.length === 0}

                className="w-full bg-slate-950 text-slate-200 border border-slate-800 focus:border-[#00f0ff] px-3 py-2 outline-none rounded-none text-xs transition-colors cursor-pointer"
              >
                {staffLoading ? (
                  <option value="">Loading...</option>
                ) : staffList.length === 0 ? (
                  <option value="">No active staff found</option>
                ) : (
                  staffList.map((s) => (
                    <option key={s.staffId} value={s.staffId}>
                      {s.staffName} ({s.role})
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Empty state */}
          {!staffLoading && staffList.length === 0 && (
            <div className="bg-slate-950 border border-slate-800 p-4 text-slate-400 text-[10px] uppercase tracking-wider text-center">
              No active staff found for this branch. Induct staff before terminal access.
            </div>
          )}

          {/* Password field */}
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between items-center text-[10px]">
              <label className="flex items-center gap-2 text-slate-500 font-bold uppercase tracking-wider">
                <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                6. Authentication Password / PIN
              </label>
            </div>
            <input
              type="password"
              placeholder="ENTER SECURE ACCESS CODE"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrorMsg('');
              }}
              disabled={isAuthenticating}
              className="w-full bg-slate-950 text-slate-200 border border-slate-800 focus:border-amber-500 px-3 py-2 outline-none rounded-none text-xs tracking-widest placeholder:text-slate-800"
            />
          </div>

          {/* Validation Error reporting */}
          {errorMsg && (
            <div className="bg-rose-950/40 border border-rose-800 p-3 text-rose-400 flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="leading-tight text-[10px]">
                <span className="font-bold block text-rose-300 uppercase">ACCESS PERMISSION DENIED</span>
                {errorMsg}
              </div>
            </div>
          )}

          {/* Open POS Submission */}
          <button
            type="submit"
            disabled={isAuthenticating || staffLoading || staffList.length === 0}
            className="w-full py-3 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 disabled:bg-slate-800 text-slate-950 disabled:text-slate-500 font-extrabold tracking-widest uppercase transition-all duration-150 rounded-none cursor-pointer flex items-center justify-center gap-2 text-center shadow-lg hover:shadow-amber-500/10 border border-amber-400 disabled:border-slate-800"
          >
            {isAuthenticating ? (
              <>
                <KeyRound className="w-4 h-4 animate-spin text-slate-950" />
                VERIFYING PERMISSION GATES...
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 text-slate-950" />
                Open POS
                <ArrowRight className="w-4 h-4 text-slate-950" />
              </>
            )}
          </button>

        </form>
      </div>

      {/* Diagnostics / Back control options footer */}
      <div className="mt-8 text-center space-y-4 z-20">
        <button
          onClick={onBackToBios}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors underline cursor-pointer"
        >
          &larr; Return to Main Application
        </button>
        {SHOW_DEV_BADGES && (
          <div className="text-[9px] text-slate-600 leading-normal max-w-md mx-auto uppercase">
            iTred Commerce POS - Vendor Commerce Terminal<br />
            Diagnostics Enabled / Local Services
          </div>
        )}
      </div>
    </div>
  );
}
