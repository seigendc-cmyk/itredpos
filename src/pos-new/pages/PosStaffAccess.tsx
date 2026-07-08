import React, { useState, FormEvent, useEffect } from 'react';
import { ShieldCheck, KeyRound, Server, Building2, Users, MonitorSmartphone, ArrowRight, ShieldAlert, Cpu } from 'lucide-react';
import { PosSession } from '../types';
import { loadStaffForCurrentVendor, authenticateStaffAccess, readSciVendorOwnerSession } from '../../sci-auth/StaffAuthService';


interface PosStaffAccessProps {
  onLoginSuccess: (session: PosSession) => void;
  onBackToBios: () => void;
}

const SHOW_DEV_BADGES = false;

export default function PosStaffAccess({ 
  onLoginSuccess, 
  onBackToBios
}: PosStaffAccessProps) {
  
  // Build-development tenant data source.
  // This is resolved after Google Authentication completes in the parent gate.
  const staffProfiles = loadStaffForCurrentVendor();
  const ownerStaff = staffProfiles[0];

  // SCI owner-session is the single canonical authority for Staff Access.
  // We intentionally present a single owner staff identity and disable selectors.
  const vendors = [{ id: 'demo-vendor-001', name: ownerStaff?.staffName || 'Demo Business' }];
  const branches = [{ id: 'main-branch', name: 'Main Branch', location: 'Main Branch' }];
  const terminals = [{ id: 'TERM-MAIN-001', name: 'Main POS Terminal', branchId: 'main-branch', type: 'POS' }];
  const staffList = [
    {
      id: ownerStaff?.staffId || 'owner-staff',
      name: ownerStaff?.staffName || 'Owner',
      email: '',
      role: ownerStaff?.role || 'Owner',
      pass: '',
      branchId: 'main-branch'
    }
  ];


  const [selectedVendor, setSelectedVendor] = useState<string>(vendors[0].name);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(branches[0]?.id || '');
  const [selectedStaffId, setSelectedStaffId] = useState<string>(staffList[0]?.id || '');

  

  const [selectedTerminalId, setSelectedTerminalId] = useState<string>(terminals[0]?.id || '');
  const [password, setPassword] = useState<string>('');

  // Initialize selections once from the single owner session.
  useEffect(() => {
    setSelectedVendor(vendors[0]?.name || 'Current Vendor');
    setSelectedBranchId(branches[0]?.id || 'main-branch');
    setSelectedStaffId(staffList[0]?.id || 'owner-staff');
    setSelectedTerminalId(terminals[0]?.id || 'TERM-MAIN-001');
  }, []);

  
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (branches.length === 0 || terminals.length === 0 || staffList.length === 0) {
      setErrorMsg('AUTHENTICATION BLOCKED: No staff access records were loaded for this tenant.');
      return;
    }

    if (!password.trim()) {
      setErrorMsg('AUTHENTICATION BLOCKED: PIN/PASSWORD REQUIRED FOR ACCESS TOKEN CREATION');
      return;
    }

    setIsAuthenticating(true);

    setTimeout(() => {
      setIsAuthenticating(false);

      const authResult = authenticateStaffAccess({
        vendorId: readSciVendorOwnerSession()?.vendorId || vendors[0]?.id || "demo-vendor-001",
        staffId: selectedStaffId,
        pin: password
      });


      if (!authResult.ok || !authResult.session) {
        setErrorMsg(authResult.message || 'INVALID PIN OR STAFF ACCESS DENIED');
        return;
      }

      onLoginSuccess(authResult.session);
    }, 300);
  };

  const handleQuickFill = () => {
    setPassword('op-bypass-992');
    setErrorMsg('');
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
                disabled={true}

                className="w-full bg-slate-950 text-slate-200 border border-slate-800 focus:border-[#00f0ff] px-3 py-2 outline-none rounded-none text-xs transition-colors cursor-pointer"
              >
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Password field */}
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between items-center text-[10px]">
              <label className="flex items-center gap-2 text-slate-500 font-bold uppercase tracking-wider">
                <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                5. Authentication Password / PIN
              </label>
              {SHOW_DEV_BADGES && (
                <button
                  type="button"
                  onClick={handleQuickFill}
                  className="text-[#00f0ff] hover:text-[#4df5ff] transition-all underline cursor-pointer"
                >
                  [Auto-Fill PIN]
                </button>
              )}
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
            disabled={isAuthenticating}
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

