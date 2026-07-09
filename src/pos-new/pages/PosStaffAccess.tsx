import React, { useState, FormEvent, useEffect } from 'react';
import {
  collection,
  getDocs,
  query,
  where
} from 'firebase/firestore';
import { ShieldCheck, KeyRound, Server, Building2, Users, MonitorSmartphone, ArrowRight, ShieldAlert, Cpu } from 'lucide-react';
import { PosSession } from '../types';
import { db } from '../firebase/firebaseApp';
import { createOwnerPosSession, readSciVendorOwnerSession } from '../../sci-auth/StaffAuthService';
import { getActiveStaffByVendorAndBranch, validateStaffPin, ensureDefaultOwnerStaff } from '../services/staffFirestoreService';
import { recordStaffAuditEvent } from '../services/staffAuditService';
import { mapStaffRecordToStaffSetting } from '../services/staffFirestoreService';
import type { StaffSetting } from '../types';


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

  const [staffList, setStaffList] = useState<StaffSetting[]>([]);
  const [staffLoading, setStaffLoading] = useState<boolean>(true);
  const [staffError, setStaffError] = useState<string>('');

  const vendors = vendorId ? [{ id: vendorId, name: session?.vendorName || 'Current Vendor' }] : [];
  const branches = [{ id: 'demo-branch', name: 'Demo Branch', location: 'Demo Branch' }];
  const terminals = [{ id: 'TERM-MAIN-001', name: 'Main POS Terminal', branchId: 'demo-branch', type: 'POS' }];

  const [selectedVendor, setSelectedVendor] = useState<string>(vendors[0]?.name || '');
  const [selectedBranchId, setSelectedBranchId] = useState<string>(branches[0]?.id || '');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [selectedTerminalId, setSelectedTerminalId] = useState<string>(terminals[0]?.id || '');
  const [password, setPassword] = useState<string>('');

  useEffect(() => {
    let active = true;
    setStaffLoading(true);
    setStaffError('');

    const loadStaff = async () => {
      if (!db || !vendorId) {
        if (active) {
          setStaffList([]);
          setSelectedStaffId('');
          setStaffLoading(false);
        }
        return;
      }
      try {
        const records = await getActiveStaffByVendorAndBranch(vendorId, selectedBranchId || branches[0]?.id || '');
        let list = records.map(mapStaffRecordToStaffSetting);
        if (list.length === 0 && vendorId) {
          const defaultOwner = await ensureDefaultOwnerStaff(vendorId, session?.ownerName || 'Owner');
          list = [mapStaffRecordToStaffSetting(defaultOwner)];
        }
        if (active) {
          setStaffList(list);
          setSelectedStaffId(list.length > 0 ? list[0].id : '');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load staff from database.';
        if (active) {
          setStaffError(message);
          setStaffList([]);
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
      const matched = await validateStaffPin(selectedStaffId, password.trim());
      if (!matched) {
        setErrorMsg('ACCESS PERMISSION DENIED: Incorrect PIN or staff record is suspended.');
        setIsAuthenticating(false);
        return;
      }

      const staffSession = createOwnerPosSession();
      const enrichedSession: PosSession = {
        ...staffSession,
        staffId: matched.id,
        staffName: matched.displayName,
        role: matched.roleName,
        branchId: matched.branchId,
        branch: branches.find(b => b.id === matched.branchId)?.name || matched.branchId,
        terminalId: selectedTerminalId,
        terminal: terminals.find(t => t.id === selectedTerminalId)?.name || selectedTerminalId,
      };

      await recordStaffAuditEvent({
        vendorId: matched.vendorId,
        branchId: matched.branchId,
        terminalId: selectedTerminalId,
        staffId: matched.id,
        roleId: matched.roleId,
        eventType: 'STAFF_LOGIN_SUCCESS',
        timestamp: new Date().toISOString(),
        metadata: { displayName: matched.displayName, roleName: matched.roleName }
      });

      onLoginSuccess(enrichedSession);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed.';
      setErrorMsg(message);
      await recordStaffAuditEvent({
        vendorId: '',
        branchId: '',
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
              disabled={true}

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
              disabled={true}

              className="w-full bg-slate-950 text-slate-200 border border-slate-800 focus:border-[#00f0ff] px-3 py-2 outline-none rounded-none text-xs transition-colors cursor-pointer"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Terminal Selector */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                <MonitorSmartphone className="w-3.5 h-3.5 text-emerald-400" />
                3. Terminal Unit
              </label>
              <select
                value={selectedTerminalId}
                onChange={(e) => {
                  setSelectedTerminalId(e.target.value);
                  setErrorMsg('');
                }}
                disabled={true}

                className="w-full bg-slate-950 text-slate-200 border border-slate-800 focus:border-[#00f0ff] px-3 py-2 outline-none rounded-none text-xs transition-colors cursor-pointer"
              >
                {terminals.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Staff Selector */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                <Users className="w-3.5 h-3.5 text-[#00f0ff]" />
                4. Staff Member
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
                    <option key={s.id} value={s.id}>
                      {s.displayName} ({s.roleName})
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
                5. Authentication Password / PIN
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
