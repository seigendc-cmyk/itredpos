import React, { useState, FormEvent, useMemo } from 'react';
import { 
  DollarSign, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Vault, 
  Terminal as TerminalIcon, 
  AlertTriangle,
  ClipboardList,
  ShieldAlert,
  CheckCircle,
  History,
  Activity,
  User,
  Sliders,
  PlusSquare,
  HelpCircle,
  AlertCircle
} from 'lucide-react';
import { CashLog, Shift, Transaction, BiEvent, PosSession, Role } from '../types';
import { mockCashMovements } from '../mock/mockPosData';
import { canPerformAction } from '../utils/posPermissions';
import { addLocalQueueItem } from '../utils/localQueueStore';

interface PosCashProps {
  cashLogs: CashLog[];
  activeShift: Shift | null;
  onAddCashLog: (type: CashLog['type'], amount: number, reason: string) => void;
  terminalId: string;
  activeOperator: string;
  biEvents: BiEvent[];
  onLogBiEvent: (
    eventType: BiEvent['eventType'],
    operator: string,
    terminal: string,
    payload: any,
    severity: 'INFO' | 'WARNING' | 'CRITICAL'
  ) => void;
  transactions: Transaction[];
  session?: PosSession | null;
}

interface MockMovementRow {
  id: string;
  time: string;
  type: 'Cash In' | 'Cash Out';
  amount: number;
  reason: string;
  staffName: string;
  authorizedBy: string;
  status: 'Approved' | 'Pending Review';
}

interface MockBiAlert {
  id: string;
  tag: string;
  severity: 'Low' | 'Medium' | 'High';
  message: string;
}

export default function PosCash({
  cashLogs: parentCashLogs,
  activeShift,
  onAddCashLog,
  terminalId: parentTerminalId,
  activeOperator: parentActiveOperator,
  biEvents,
  onLogBiEvent,
  transactions,
  session
}: PosCashProps) {

  // Active Session fields extracting with fallbacks to guarantee robust SCI profile parameters
  const vendorName = session?.vendor || 'SCI Logistics Ltd';
  const branchName = session?.branch || 'Harare Main';
  const terminalName = session?.terminal || parentTerminalId || 'Term-A';
  const staffName = session?.staffName || parentActiveOperator || 'Mary Cashier';

  // --- LOCAL INTERACTIVE CASH CONTROL STATES ---
  // To fulfill specific mock requirements beautifully, we pre-seed the exact metric values
  const [openingFloat, setOpeningFloat] = useState<number>(mockCashMovements[0]?.amount || 50.00);
  const [cashSales, setCashSales] = useState<number>(710.00);
  
  // Interactive movements state (loaded with requested mock rows)
  const [movements, setMovements] = useState<MockMovementRow[]>(() => {
    return mockCashMovements.map((m, idx) => {
      const typeStr = m.type === 'INITIAL' ? 'Opening Float' : m.reason;
      return {
        id: m.id,
        time: m.timestamp.includes('T') ? m.timestamp.split('T')[1].substring(0, 5) : '09:00',
        type: m.type === 'PAY_OUT' || m.type === 'SAFE_DROP' ? 'Cash Out' as const : 'Cash In' as const,
        amount: m.amount,
        reason: typeStr,
        staffName: m.operator,
        authorizedBy: 'Tawanda Supervisor',
        status: idx < mockCashMovements.length - 1 ? 'Approved' as const : 'Pending Review' as const
      };
    });
  });

  // Compute live additions (excluding initial opening float from cash-in total list)
  const cashInTotalSum = useMemo(() => {
    return movements
      .filter(m => m.type === 'Cash In' && m.reason !== 'Opening Float')
      .reduce((sum, m) => sum + m.amount, 0);
  }, [movements]);

  // Compute live cash_out sum
  const cashOutTotalSum = useMemo(() => {
    return movements
      .filter(m => m.type === 'Cash Out')
      .reduce((sum, m) => sum + m.amount, 0);
  }, [movements]);

  // Expected Cash calculation = Opening Float + Cash Sales + Cash In - Cash Out
  const expectedDrawerCash = openingFloat + cashSales + cashInTotalSum - cashOutTotalSum; // 800.00

  // Declared cash (mock requested matches exactly USD 795.00)
  const [declaredCash, setDeclaredCash] = useState<number>(795.00);

  // Variance calculation = declaredCash - expectedDrawerCash
  const variance = declaredCash - expectedDrawerCash; // -5.00

  // Form Inputs
  const [movementType, setMovementType] = useState<'Cash In' | 'Cash Out'>('Cash In');
  const [amountInput, setAmountInput] = useState<string>('');
  const [reasonSelect, setReasonSelect] = useState<'Petty Cash' | 'Drawer Top-Up' | 'Cash Banking' | 'Supplier Payment' | 'Owner Withdrawal' | 'Correction'>('Drawer Top-Up');
  const [authorizer, setAuthorizer] = useState<string>('Tawanda Supervisor');
  const [specialNote, setSpecialNote] = useState('');

  // BI Alert Feed State
  const [biAlerts, setBiAlerts] = useState<MockBiAlert[]>([
    {
      id: 'BIA-1',
      tag: 'CASH_VARIANCE_FOUND',
      severity: 'High',
      message: 'Drawer short by USD 5.00'
    },
    {
      id: 'BIA-2',
      tag: 'CASH_OUT_REVIEW_REQUIRED',
      severity: 'Medium',
      message: 'Cash banking movement pending review'
    },
    {
      id: 'BIA-3',
      tag: 'SUPERVISOR_APPROVAL_REQUIRED',
      severity: 'High',
      message: 'Variance cannot be closed by cashier'
    },
    {
      id: 'BIA-4',
      tag: 'CASH_DRAWER_ACTIVE',
      severity: 'Low',
      message: 'Drawer currently active on selected terminal'
    }
  ]);

  // Handle Form Submission
  const handleRecordMovement = (e: FormEvent) => {
    e.preventDefault();

    const currentRole = session?.role || 'Owner';
    if (!canPerformAction(currentRole as Role, 'RECORD_CASH_MOVEMENT')) {
      alert(`[PERMISSION DENIED] ROLE '${currentRole.toUpperCase()}' IS NOT AUTHORIZED TO PERFORMACTION: RECORD_CASH_MOVEMENT`);
      return;
    }

    const amt = parseFloat(amountInput);
    if (isNaN(amt) || amt <= 0) {
      alert('[MOVEMENT ERROR] Movement amount must be a positive quantity.');
      return;
    }

    if (movementType === 'Cash Out' && amt > expectedDrawerCash) {
      alert(`[OVERDRAW PREVENTED] Request amount ${amt} exceeds current expected drawer pool of ${expectedDrawerCash}.`);
      return;
    }

    const timeStr = new Date().toTimeString().split(' ')[0].substring(0, 5);
    const newMovement: MockMovementRow = {
      id: 'ML-' + (movements.length + 1),
      time: timeStr,
      type: movementType,
      amount: amt,
      reason: reasonSelect,
      staffName: staffName,
      authorizedBy: authorizer || 'Supervisor',
      status: movementType === 'Cash Out' ? 'Pending Review' : 'Approved'
    };

    setMovements(prev => [...prev, newMovement]);

    // Update parent's state if callback is listening
    onAddCashLog(
      movementType === 'Cash In' ? 'PAY_IN' : 'PAY_OUT',
      amt,
      `Local movement logged: ${reasonSelect} | Auth: ${authorizer} ${specialNote ? `| Notes: ${specialNote}` : ''}`
    );

    addLocalQueueItem({
      domain: 'Cash',
      eventType: movementType === 'Cash In' ? 'CASH_PAY_IN' : 'CASH_PAY_OUT',
      reference: newMovement.id,
      createdBy: staffName,
      risk: 'High',
      payload: JSON.stringify({
        movement: newMovement,
        specialNote
      })
    });

    // Dynamic additions to Alerts feed
    if (movementType === 'Cash Out' && reasonSelect === 'Cash Banking') {
      const isDuplicated = biAlerts.some(a => a.tag === 'CASH_OUT_REVIEW_REQUIRED');
      if (!isDuplicated) {
        setBiAlerts(prev => [
          {
            id: 'BIA-NEW-' + Date.now(),
            tag: 'CASH_OUT_REVIEW_REQUIRED',
            severity: 'Medium',
            message: `New Cash banking of USD ${amt.toFixed(2)} requires physical signature voucher`
          },
          ...prev
        ]);
      }
    }

    // Reset inputs
    setAmountInput('');
    setSpecialNote('');
  };

  // Allow setting the counted cash dynamically to update metrics perfectly
  const [customCountInput, setCustomCountInput] = useState<string>('795.00');
  const handleUpdateCountedCash = (e: FormEvent) => {
    e.preventDefault();
    const countVal = parseFloat(customCountInput);
    if (isNaN(countVal) || countVal < 0) {
      alert('[ERROR] Cash count must be a positive number.');
      return;
    }
    setDeclaredCash(countVal);
  };

  return (
    <div className="space-y-6 font-mono text-xs text-[#111827] select-none pb-12">
      
      {/* 1. PAGE HEADER */}
      <div className="bg-white border-2 border-[#b1b5c2] p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="text-[9px] font-black text-orange-600 uppercase tracking-widest">SCI LOGISTICS & TRADING</div>
          <h1 className="text-sm font-black text-[#1e222b] uppercase flex items-center gap-2 mt-1">
            <Sliders className="w-5 h-5 text-orange-500" />
            CASH CONTROL DRAWER REGISTRY
          </h1>
          
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2 text-[10px] text-slate-500 font-bold">
            <span className="flex items-center gap-1">
              <strong>Corporate Vendor:</strong> <span className="text-[#13151a] font-black">{vendorName}</span>
            </span>
            <span className="flex items-center gap-1">
              <strong>Branch:</strong> <span className="bg-slate-100 text-[#13151a] px-1.5 py-0.2">{branchName}</span>
            </span>
            <span className="flex items-center gap-1">
              <strong>Terminal ID:</strong> <span className="text-[#13151a] font-extrabold">{terminalName}</span>
            </span>
            <span className="flex items-center gap-1">
              <strong>Authorized Cashier:</strong> <span className="text-orange-600">{staffName}</span>
            </span>
          </div>
        </div>

        {/* Current drawer status tag */}
        <div className="flex items-center gap-2 px-4 py-2 border border-[#b1b5c2] bg-orange-50/10 border-l-4 border-l-orange-500">
          <Activity className="w-4 h-4 text-orange-650 animate-pulse" />
          <div>
            <span className="text-[8px] text-slate-500 font-bold block uppercase tracking-wider">Drawer Solenoid Status</span>
            <span className="text-[10px] font-black text-[#1e222b] uppercase">Active</span>
          </div>
        </div>
      </div>

      {/* 2. CASH DRAWER SUMMARY PANELS (Square Metric Panels) */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4">
        
        {/* Panel 1 (Opening Float) */}
        <div className="bg-white border border-[#b1b5c2] p-4 flex flex-col justify-between h-[100px] border-l-4 border-l-[#1e222b]">
          <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider block">Opening Float</span>
          <div className="mt-2 text-right">
            <span className="text-sm font-black text-slate-900 block">USD {openingFloat.toFixed(2)}</span>
            <span className="text-[8px] text-slate-400 capitalize font-medium block">initial shift reserve</span>
          </div>
        </div>

        {/* Panel 2 (Cash Sales) */}
        <div className="bg-white border border-[#b1b5c2] p-4 flex flex-col justify-between h-[100px] border-l-4 border-l-emerald-600">
          <span className="text-[9px] text-emerald-750 font-black uppercase tracking-wider block">Cash Sales</span>
          <div className="mt-2 text-right">
            <span className="text-sm font-black text-emerald-600 block">USD {cashSales.toFixed(2)}</span>
            <span className="text-[8px] text-slate-400 capitalize font-medium block">completed gross sales</span>
          </div>
        </div>

        {/* Panel 3 (Cash In) */}
        <div className="bg-white border border-[#b1b5c2] p-4 flex flex-col justify-between h-[100px]">
          <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider block">Cash In</span>
          <div className="mt-2 text-right">
            <span className="text-sm font-black text-slate-900 block">USD {cashInTotalSum.toFixed(2)}</span>
            <span className="text-[8px] text-slate-400 capitalize font-medium block">manual drawer additions</span>
          </div>
        </div>

        {/* Panel 4 (Cash Out) */}
        <div className="bg-white border border-[#b1b5c2] p-4 flex flex-col justify-between h-[100px] border-l-4 border-l-red-500">
          <span className="text-[9px] text-red-750 font-black uppercase tracking-wider block">Cash Out</span>
          <div className="mt-2 text-right">
            <span className="text-sm font-black text-red-500 block">USD {cashOutTotalSum.toFixed(2)}</span>
            <span className="text-[8px] text-slate-400 capitalize font-medium block font-bold text-red-500/80">vault drops & petty cash</span>
          </div>
        </div>

        {/* Panel 5 (Expected Drawer Cash) */}
        <div className="bg-white border border-[#b1b5c2] p-4 flex flex-col justify-between h-[100px] border-l-4 border-l-orange-500">
          <span className="text-[9px] text-orange-600 font-black uppercase tracking-wider block">Expected Drawer Cash</span>
          <div className="mt-2 text-right">
            <span className="text-base font-black text-orange-600 block">USD {expectedDrawerCash.toFixed(2)}</span>
            <span className="text-[8px] text-slate-400 capitalize font-medium block">expected on register</span>
          </div>
        </div>

        {/* Panel 6 (Declared Cash) */}
        <div className="bg-white border border-[#b1b5c2] p-4 flex flex-col justify-between h-[100px]">
          <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider block">Declared Cash</span>
          <div className="mt-2 text-right">
            <span className="text-sm font-black text-slate-900 block">USD {declaredCash.toFixed(2)}</span>
            <span className="text-[8px] text-slate-400 capitalize font-medium block">counted physically</span>
          </div>
        </div>

        {/* Panel 7 (Variance) */}
        <div className={`bg-white border border-[#b1b5c2] p-4 flex flex-col justify-between h-[100px] ${variance !== 0 ? 'bg-red-50/10 border-l-4 border-l-red-500' : 'border-l-4 border-l-emerald-500'}`}>
          <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider block">Variance</span>
          <div className="mt-2 text-right font-black">
            <span className={`text-sm ${variance < 0 ? 'text-red-500 animate-pulse' : variance > 0 ? 'text-amber-500' : 'text-emerald-600'}`}>
              USD {variance.toFixed(2)}
            </span>
            <span className="text-[8px] text-slate-400 capitalize block">{variance === 0 ? 'balanced drawer' : 'unbalanced mismatch'}</span>
          </div>
        </div>

        {/* Panel 8 (Review Status) */}
        <div className="bg-white border border-[#b1b5c2] p-4 flex flex-col justify-between h-[100px]">
          <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider block">Review Status</span>
          <div className="mt-2 text-right">
            <span className="text-[10px] font-black text-red-500 block uppercase tracking-tight">
              {variance !== 0 ? 'Supervisor Review Required' : 'Verified Balanced'}
            </span>
            <span className="text-[8px] text-[#1e222b] block uppercase mt-0.5 font-bold">Harare Depot Vault</span>
          </div>
        </div>

      </div>

      {/* DUAL MODE ADJUSTMENT PANEL (Counted Cash quick trigger) */}
      <div className="bg-white border border-[#b1b5c2] p-4 flex flex-col sm:flex-row justify-between items-center gap-3">
        <div className="flex items-center gap-2.5">
          <ClipboardList className="w-5 h-5 text-orange-500 shrink-0" />
          <div className="text-left font-mono text-[9.5px]">
            <span className="font-extrabold text-[#111827] block uppercase">Live Physical Auditing Trigger</span>
            <span className="text-slate-500 block leading-normal mt-0.5 lowercase">mismatching expected values triggers bi alerts immediately for supervisor intervention.</span>
          </div>
        </div>
        
        <form onSubmit={handleUpdateCountedCash} className="flex gap-2 items-center w-full sm:w-auto">
          <span className="text-[10px] font-black text-[#1e222b] uppercase shrink-0">Counted Cash Amount:</span>
          <div className="relative w-full sm:w-[130px]">
            <span className="absolute left-2.5 top-2 text-[9px] text-slate-400 font-extrabold">USD</span>
            <input 
              type="number"
              step="0.1"
              value={customCountInput}
              onChange={e => setCustomCountInput(e.target.value)}
              className="w-full bg-slate-50 border border-[#b1b5c2] focus:border-orange-500 pl-10 pr-2 py-1.5 font-bold text-[#1e222b]"
            />
          </div>
          <button type="submit" className="px-3 py-1.5 bg-[#1e222b] hover:bg-slate-800 text-white font-extrabold uppercase text-[9.5px] cursor-pointer shrink-0">
            Set counted Cash
          </button>
        </form>
      </div>

      {/* 3. CORE DUAL SECTION LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Interactive Section (Movement Form & Movement Table) */}
        <div className="lg:col-span-9 space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            
            {/* 3. CASH MOVEMENT FORM PANEL (5 Col) */}
            <div className="md:col-span-5 bg-white border border-[#b1b5c2] p-5 space-y-4">
              <div className="bg-[#1e222b] p-3 -mx-5 -mt-5 text-white flex items-center justify-between border-b-2 border-slate-900 select-none">
                <span className="font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                  <PlusSquare className="w-4 h-4 text-orange-500" />
                  Log Cash Movement Event
                </span>
                <span className="text-[8px] bg-orange-650/20 border border-orange-500 text-orange-500 px-1.5 py-0.2 font-mono">REGISTRY</span>
              </div>

              <form onSubmit={handleRecordMovement} className="space-y-4">
                <div className="space-y-3 font-mono">
                  
                  {/* Movement Type Radio Selection */}
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-black text-slate-500">Dispatch Type</label>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => setMovementType('Cash In')}
                        className={`py-2 text-[10px] uppercase font-black tracking-wider transition-all border cursor-pointer ${
                          movementType === 'Cash In'
                            ? 'bg-emerald-600 text-white border-emerald-700'
                            : 'bg-slate-50 text-[#1e222b] border-[#b1b5c2] hover:bg-slate-100'
                        }`}
                      >
                        Cash In (+)
                      </button>
                      <button
                        type="button"
                        onClick={() => setMovementType('Cash Out')}
                        className={`py-2 text-[10px] uppercase font-black tracking-wider transition-all border cursor-pointer ${
                          movementType === 'Cash Out'
                            ? 'bg-red-500 text-white border-red-650'
                            : 'bg-slate-50 text-[#1e222b] border-[#b1b5c2] hover:bg-slate-100'
                        }`}
                      >
                        Cash Out (-)
                      </button>
                    </div>
                  </div>

                  {/* Quantity Amount */}
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-black text-slate-500">Movement Amount (USD)</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 text-slate-400 font-extrabold">USD</span>
                      <input
                        type="number"
                        className="w-full bg-white text-[#1e222b] border border-[#b1b5c2] focus:border-orange-500 pl-10 pr-2.5 py-2 text-[11px] font-bold cursor-pointer placeholder-slate-350"
                        placeholder="0.00"
                        value={amountInput}
                        onChange={e => setAmountInput(e.target.value)}
                        required
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>

                  {/* Preloaded Reason Selection Dropdown */}
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-black text-slate-500">Auditable Reason</label>
                    <select
                      className="w-full bg-white text-[#1e222b] border border-[#b1b5c2] focus:border-orange-500 px-2 py-2 text-[10.5px] font-bold cursor-pointer"
                      value={reasonSelect}
                      onChange={e => setReasonSelect(e.target.value as any)}
                    >
                      <option value="Petty Cash">Petty Cash</option>
                      <option value="Drawer Top-Up">Drawer Top-Up</option>
                      <option value="Cash Banking">Cash Banking</option>
                      <option value="Supplier Payment">Supplier Payment</option>
                      <option value="Owner Withdrawal">Owner Withdrawal</option>
                      <option value="Correction">Correction</option>
                    </select>
                  </div>

                  {/* Authorized By Input */}
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-black text-slate-500">Supervisor Authorization Pin/Name</label>
                    <input
                      type="text"
                      className="w-full bg-white text-[#1e222b] border border-[#b1b5c2] focus:border-orange-500 px-2.5 py-2 text-[10.5px] rounded-none font-bold uppercase"
                      value={authorizer}
                      onChange={e => setAuthorizer(e.target.value)}
                      required
                    />
                  </div>

                  {/* Notes Details text field */}
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-black text-slate-500">Auditor Notes</label>
                    <textarea
                      rows={2}
                      className="w-full bg-white text-[#1e222b] border border-[#b1b5c2] focus:border-orange-500 p-2 text-[10px] rounded-none font-sans uppercase resize-none placeholder-slate-400"
                      value={specialNote}
                      onChange={e => setSpecialNote(e.target.value)}
                      placeholder="ENTER EVENT REFERENCE AND DETAILS VOUCHER..."
                    />
                  </div>

                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-[#f97316] hover:bg-[#ea580c] text-white font-black uppercase text-[10.5px] rounded-none flex items-center justify-center gap-1.5 transition-colors cursor-pointer mt-2"
                >
                  <Vault className="w-3.5 h-3.5 stroke-[2.5]" />
                  Record Movement Row
                </button>
              </form>
            </div>

            {/* 4. CASH MOVEMENT TABLE (7 Col) */}
            <div className="md:col-span-7 bg-white border border-[#b1b5c2] p-5 space-y-4">
              <div className="bg-[#1e222b] p-3 -mx-5 -mt-5 text-white flex items-center justify-between border-b-2 border-slate-900 select-none">
                <span className="font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                  <History className="w-4 h-4 text-orange-500" />
                  Solenoid Movement Ledger Row Indexes
                </span>
                <span className="text-[8px] bg-slate-100/10 border border-slate-600 text-slate-400 px-1.5 py-0.2 font-mono">AUDIT_NVRAM</span>
              </div>

              <div className="overflow-x-auto pos-custom-scroll">
                <table className="w-full text-left border-collapse text-[10px]">
                  <thead>
                    <tr className="border-b border-[#b1b5c2] bg-slate-55/65 font-mono text-[8px] text-slate-500 uppercase tracking-wider font-extrabold">
                      <th className="py-2 px-3">Time</th>
                      <th className="py-2 px-3">Type</th>
                      <th className="py-2 px-3 text-right">Amount (USD)</th>
                      <th className="py-2 px-3">Designation Reason</th>
                      <th className="py-2 px-3">Staff</th>
                      <th className="py-2 px-3">Authorized By</th>
                      <th className="py-2 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-150 font-mono text-[10.5px]">
                    {movements.slice().reverse().map(mov => {
                      const isMinus = mov.type === 'Cash Out';
                      return (
                        <tr key={mov.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2 px-3 text-slate-400 font-bold whitespace-nowrap">{mov.time}</td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            <span className={`inline-block px-1.5 py-0.2 font-black text-[7.5px] uppercase border ${
                              isMinus 
                                ? 'border-red-300 bg-red-50 text-red-700' 
                                : 'border-emerald-300 bg-emerald-50/50 text-emerald-800'
                            }`}>
                              {mov.type}
                            </span>
                          </td>
                          <td className={`py-2 px-3 text-right font-black ${isMinus ? 'text-red-650' : 'text-emerald-700'}`}>
                            {isMinus ? '-' : '+'}USD {mov.amount.toFixed(2)}
                          </td>
                          <td className="py-2 px-3 font-bold text-slate-800 uppercase max-w-[130px] truncate">{mov.reason}</td>
                          <td className="py-2 px-3 text-slate-500 font-medium whitespace-nowrap uppercase">{mov.staffName}</td>
                          <td className="py-2 px-3 text-[#1e222b] font-bold uppercase whitespace-nowrap">{mov.authorizedBy}</td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            <span className={`inline-block px-1.5 py-0.2 text-[8px] font-extrabold uppercase border ${
                              mov.status === 'Approved'
                                ? 'bg-emerald-50 border-emerald-355 text-emerald-822'
                                : 'bg-amber-50 border-amber-305 text-amber-655 animate-pulse'
                            }`}>
                              {mov.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="bg-slate-100 p-2.5 border border-slate-250 flex items-center justify-between text-[8px] text-slate-500 font-mono select-none uppercase">
                <span>STORAGE HARDWARE: NVRAM_SYS77</span>
                <span>AUDIT PASS CODE: OK</span>
              </div>
            </div>

          </div>

        </div>

        {/* 5. CASH BI ALERTS FEED (Right 3 Column Panel) */}
        <div className="lg:col-span-3 bg-white border border-[#b1b5c2] p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-150 select-none">
            <Activity className="w-4 h-4 text-orange-500" />
            <span className="font-extrabold text-[#1e222b] text-[10px] uppercase tracking-wider">CASH BI COGNITIVE ALERTS</span>
          </div>

          <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1 pos-custom-scroll">
            {biAlerts.map(alert => {
              let severityStyle = 'border-l-4 border-l-slate-400 bg-slate-50 text-slate-800';
              if (alert.severity === 'Medium') {
                severityStyle = 'border-l-4 border-l-amber-500 bg-amber-50/10 text-amber-800 border-amber-305 font-bold';
              } else if (alert.severity === 'High' || alert.severity === 'Critical') {
                severityStyle = 'border-l-4 border-l-red-500 bg-red-50/10 text-red-800 border-red-305 font-black';
              }

              return (
                <div key={alert.id} className={`p-2.5 border rounded-none flex items-start gap-2.5 hover:bg-slate-100/50 transition-colors ${severityStyle}`}>
                  <ShieldAlert className={`w-4 h-4 shrink-0 mt-0.5 ${alert.severity === 'High' ? 'text-red-500 animate-pulse' : alert.severity === 'Medium' ? 'text-amber-500' : 'text-slate-500'}`} />
                  <div className="space-y-1">
                    <div className="flex justify-between items-baseline gap-2">
                      <span className="text-[8px] font-black uppercase text-slate-500">{alert.tag}</span>
                      <span className="text-[7.5px] uppercase opacity-70 font-mono">[{alert.severity}]</span>
                    </div>
                    <p className="text-[9px] leading-normal font-medium font-sans uppercase">
                      {alert.message}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-slate-100 p-2 border border-slate-250 flex items-center justify-between text-[8px] text-slate-500 font-mono select-none uppercase">
            <span>ALARM THRESHOLD: LIVE</span>
            <span>AUDITED SYSTEM: SHIELD_ACTIVE</span>
          </div>
        </div>

      </div>

    </div>
  );
}
