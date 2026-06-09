import React, { useState, FormEvent, useMemo } from 'react';
import { 
  Lock, 
  Unlock, 
  Activity, 
  Plus, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  User, 
  Terminal as TerminalIcon, 
  TrendingUp, 
  ArrowRight,
  ShieldAlert,
  Sliders,
  DollarSign,
  Briefcase,
  HelpCircle,
  FileSpreadsheet,
  AlertCircle
} from 'lucide-react';
import { Shift, Transaction, CashLog, BiEvent, PosSession, Role } from '../types';
import { mockShift } from '../mock/mockPosData';
import { canPerformAction } from '../utils/posPermissions';

interface PosShiftProps {
  activeShift: Shift | null;
  shiftHistory: Shift[];
  transactions: Transaction[];
  onOpenShift: (operatorName: string, startingFloat: number) => void;
  onCloseShift: (actualFloat: number) => void;
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
  cashLogs: CashLog[];
  session?: PosSession | null;
}

interface MockShiftEvent {
  id: string;
  time: string;
  type: 'SHIFT_OPENED' | 'CASH_SALE_RECORDED' | 'NON_CASH_PAYMENT_RECORDED' | 'CASH_VARIANCE_FOUND' | 'SHIFT_CLOSED';
  severity: 'Low' | 'Medium' | 'High';
  message: string;
}

export default function PosShift({
  activeShift: parentActiveShift,
  shiftHistory: parentShiftHistory,
  transactions: parentTransactions,
  onOpenShift,
  onCloseShift,
  terminalId: parentTerminalId,
  activeOperator: parentActiveOperator,
  biEvents,
  onLogBiEvent,
  cashLogs,
  session
}: PosShiftProps) {

  // Active Session extraction with fallbacks to guarantee robust SCI profile parameters
  const vendorName = session?.vendor || 'SCI Logistics Ltd';
  const branchName = session?.branch || 'Harare Main';
  const terminalName = session?.terminal || parentTerminalId || 'Term-A';
  const staffName = session?.staffName || parentActiveOperator || 'Mary Cashier';

  // --- LOCAL INTERACTIVE SHIFT STATE ---
  // We use interactive local state to make the prototype feel fully working and robust
  const [shiftIsOpen, setShiftIsOpen] = useState(mockShift.status === 'ACTIVE');
  const [currentCashier, setCurrentCashier] = useState(mockShift.operator || staffName);
  const [openFloat, setOpenFloat] = useState<number>(mockShift.startingCash);
  const [supervisorNote, setSupervisorNote] = useState('Standard Harare Main Morning Dispatch Allocation');

  // Sales aggregates
  const [cashSales, setCashSales] = useState<number>(710.00);
  const [nonCashSales, setNonCashSales] = useState<number>(535.00);
  const totalSalesCount = cashSales + nonCashSales; // USD 1,245.00

  // Expected Cash calculation
  const expectedCash = openFloat + cashSales; // USD 760.00

  // Close shift inputs
  const [declaredCashInput, setDeclaredCashInput] = useState<string>('');
  const [cardEcoCashTotalInput, setCardEcoCashTotalInput] = useState<string>('535.00');
  const [cashRemovedInput, setCashRemovedInput] = useState<string>('710.00');
  const [closingNote, setClosingNote] = useState('Completed standard cashier shift reconciliation.');

  // Shift calculation outputs (on close)
  const [closeCalculated, setCloseCalculated] = useState(false);
  const [declaredCash, setDeclaredCash] = useState<number | 'Pending'>('Pending');
  const [variance, setVariance] = useState<number | 'Pending'>('Pending');
  const [varianceStatus, setVarianceStatus] = useState<'Pending' | 'Balanced' | 'Short' | 'Over'>('Pending');

  // Shift Activity Feed
  const [shiftActivityEvents, setShiftActivityEvents] = useState<MockShiftEvent[]>([
    {
      id: 'SE-1',
      time: '08:00:15',
      type: 'SHIFT_OPENED',
      severity: 'Low',
      message: `Shift opened by ${staffName}`
    },
    {
      id: 'SE-2',
      time: '10:15:22',
      type: 'CASH_SALE_RECORDED',
      severity: 'Low',
      message: 'Cash sale added to expected drawer cash (Engine Oil 5W30 5L)'
    },
    {
      id: 'SE-3',
      time: '12:45:10',
      type: 'NON_CASH_PAYMENT_RECORDED',
      severity: 'Low',
      message: 'EcoCash payment recorded (Ball Joint Honda Fit GD1)'
    },
    {
      id: 'SE-4',
      time: '14:30:05',
      type: 'CASH_SALE_RECORDED',
      severity: 'Low',
      message: 'Cash sale added to expected drawer cash (Head Lamp FJ200)'
    }
  ]);

  // Handle open shift submit
  const handleOpenShiftLocal = (e: FormEvent) => {
    e.preventDefault();
    if (shiftIsOpen) return;

    setShiftIsOpen(true);
    setDeclaredCash('Pending');
    setVariance('Pending');
    setVarianceStatus('Pending');
    setCloseCalculated(false);
    setDeclaredCashInput('');

    // Trigger parent callback
    onOpenShift(currentCashier, openFloat);

    // Activity Log
    const timeStr = new Date().toTimeString().split(' ')[0];
    const newEv: MockShiftEvent = {
      id: 'SE-' + (shiftActivityEvents.length + 1),
      time: timeStr,
      type: 'SHIFT_OPENED',
      severity: 'Low',
      message: `Shift opened by ${currentCashier} with float USD ${openFloat.toFixed(2)}`
    };
    setShiftActivityEvents(prev => [newEv, ...prev]);
  };

  // Handle Close Shift submit
  const handleCloseShiftLocal = (e: FormEvent) => {
    e.preventDefault();
    if (!shiftIsOpen) return;

    const currentRole = session?.role || 'Owner';
    if (!canPerformAction(currentRole as Role, 'CLOSE_SHIFT')) {
      alert(`[PERMISSION DENIED] ROLE '${currentRole.toUpperCase()}' IS NOT AUTHORIZED TO PERFORMACTION: CLOSE_SHIFT`);
      return;
    }

    const decCashVal = parseFloat(declaredCashInput);
    if (isNaN(decCashVal) || decCashVal < 0) {
      alert('[RECONCILIATION ERROR] Declared Cash input must be a valid positive number.');
      return;
    }

    const calculatedVariance = decCashVal - expectedCash;
    setDeclaredCash(decCashVal);
    setVariance(calculatedVariance);

    let status: typeof varianceStatus = 'Balanced';
    if (calculatedVariance < 0) {
      status = 'Short';
    } else if (calculatedVariance > 0) {
      status = 'Over';
    }

    setVarianceStatus(status);
    setCloseCalculated(true);
    setShiftIsOpen(false);

    // Invoke parent callback
    onCloseShift(decCashVal);

    const timeStr = new Date().toTimeString().split(' ')[0];
    const newEvents: MockShiftEvent[] = [];

    if (calculatedVariance !== 0) {
      newEvents.push({
        id: `SE-V-${Date.now()}`,
        time: timeStr,
        type: 'CASH_VARIANCE_FOUND',
        severity: 'High',
        message: `Cash variance found: USD ${calculatedVariance.toFixed(2)} requires supervisor review.`
      });
    }

    newEvents.push({
      id: `SE-C-${Date.now()}`,
      time: timeStr,
      type: 'SHIFT_CLOSED',
      severity: 'Medium',
      message: `Shift closed pending reconciliation. Declared: USD ${decCashVal.toFixed(2)}`
    });

    setShiftActivityEvents(prev => [...newEvents, ...prev]);

    // Track dynamic system telemetry via parent logging
    onLogBiEvent(
      'SHIFT_CLOSED',
      currentCashier,
      terminalName,
      {
        expectedCash,
        actualCash: decCashVal,
        difference: calculatedVariance,
        note: closingNote
      },
      calculatedVariance !== 0 ? 'WARNING' : 'INFO'
    );
  };

  return (
    <div className="space-y-6 font-mono text-xs text-[#111827] select-none pb-12">
      
      {/* 1. PAGE HEADER */}
      <div className="bg-white border-2 border-[#b1b5c2] p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="text-[9px] font-black text-orange-600 uppercase tracking-widest">SCI LOGISTICS & TRADING</div>
          <h1 className="text-sm font-black text-[#1e222b] uppercase flex items-center gap-2 mt-1">
            <Sliders className="w-5 h-5 text-orange-500" />
            SHIFT CONTROL REGISTRY CHAMBER
          </h1>
          
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2 text-[10px] text-slate-500">
            <span className="flex items-center gap-1">
              <strong>Corporate Vendor:</strong> <span className="text-[#13151a] font-bold">{vendorName}</span>
            </span>
            <span className="flex items-center gap-1">
              <strong>Branch:</strong> <span className="bg-slate-100 text-[#13151a] font-bold px-1.5 py-0.2">{branchName}</span>
            </span>
            <span className="flex items-center gap-1">
              <strong>Terminal:</strong> <span className="text-[#13151a] font-bold">{terminalName}</span>
            </span>
            <span className="flex items-center gap-1">
              <strong>Active staff:</strong> <span className="text-orange-600 font-bold">{currentCashier}</span>
            </span>
          </div>
        </div>

        {/* Current status tag */}
        <div className={`flex items-center gap-2 px-4 py-2 border border-[#b1b5c2] ${
          shiftIsOpen 
            ? 'bg-orange-500/10 border-l-4 border-l-orange-500' 
            : 'bg-slate-100 border-l-4 border-l-slate-500'
        }`}>
          <Clock className={`w-4 h-4 ${shiftIsOpen ? 'text-orange-600 animate-pulse' : 'text-slate-500'}`} />
          <div>
            <span className="text-[8px] text-slate-500 font-bold block uppercase tracking-wider">Current Shift Status</span>
            <span className="text-[10px] font-black text-[#1e222b] uppercase">
              {shiftIsOpen ? 'Open' : 'Closed / Reconciled'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. SHIFT SUMMARY PANELS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-8 gap-4">
        
        {/* Panel 1 */}
        <div className={`bg-white border border-[#b1b5c2] p-4 flex flex-col justify-between h-[96px] ${shiftIsOpen ? 'border-l-4 border-l-orange-505' : 'border-l-4 border-l-slate-400'}`}>
          <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider block">SHIFT STATUS</span>
          <div className="mt-2 flex justify-between items-baseline">
            <span className={`text-lg font-black uppercase ${shiftIsOpen ? 'text-orange-600' : 'text-slate-500'}`}>
              {shiftIsOpen ? 'OPEN' : 'CLOSED'}
            </span>
            <span className="text-[8px] bg-slate-100 text-[#1c1f26] font-bold px-1.5 py-0.2">GATE</span>
          </div>
        </div>

        {/* Panel 2 */}
        <div className="bg-white border border-[#b1b5c2] p-4 flex flex-col justify-between h-[96px]">
          <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider block">OPENING FLOAT</span>
          <div className="mt-2 flex justify-between items-baseline">
            <span className="text-base font-black text-slate-800">USD {openFloat.toFixed(2)}</span>
            <span className="text-[8px] text-slate-400 uppercase font-mono">FLOAT</span>
          </div>
        </div>

        {/* Panel 3 */}
        <div className="bg-white border border-[#b1b5c2] p-4 flex flex-col justify-between h-[96px] border-l-4 border-l-emerald-650">
          <span className="text-[9px] text-emerald-600 font-black uppercase tracking-wider block">CASH SALES</span>
          <div className="mt-2 flex justify-between items-baseline">
            <span className="text-base font-black text-emerald-600">USD {cashSales.toFixed(2)}</span>
            <span className="text-[8px] bg-emerald-50 text-emerald-700 px-1 py-0.2 font-bold">LIVE</span>
          </div>
        </div>

        {/* Panel 4 */}
        <div className="bg-white border border-[#b1b5c2] p-4 flex flex-col justify-between h-[96px]">
          <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider block">NON-CASH SALES</span>
          <div className="mt-2 flex justify-between items-baseline">
            <span className="text-base font-black text-slate-800 font-mono">USD {nonCashSales.toFixed(2)}</span>
            <span className="text-[8px] text-slate-400 font-bold uppercase">ECOCASH</span>
          </div>
        </div>

        {/* Panel 5 */}
        <div className="bg-white border border-[#b1b5c2] p-4 flex flex-col justify-between h-[96px]">
          <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider block">TOTAL SALES</span>
          <div className="mt-2 flex justify-between items-baseline">
            <span className="text-base font-black text-[#1c1f26]">USD {totalSalesCount.toFixed(2)}</span>
            <span className="text-[8px] text-slate-400 font-bold uppercase">GROSS</span>
          </div>
        </div>

        {/* Panel 6 */}
        <div className="bg-white border border-[#b1b5c2] p-4 flex flex-col justify-between h-[96px] border-l-4 border-l-orange-500">
          <span className="text-[9px] text-orange-600 font-black uppercase tracking-wider block">EXPECTED CASH</span>
          <div className="mt-2 flex justify-between items-baseline">
            <span className="text-base font-black text-orange-600">USD {expectedCash.toFixed(2)}</span>
            <span className="text-[8px] text-slate-400 font-bold uppercase">DRAWER</span>
          </div>
        </div>

        {/* Panel 7 */}
        <div className="bg-white border border-[#b1b5c2] p-4 flex flex-col justify-between h-[96px]">
          <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider block">DECLARED CASH</span>
          <div className="mt-2 flex justify-between items-baseline">
            <span className="text-base font-black text-slate-800">
              {declaredCash === 'Pending' ? 'PENDING' : `USD ${declaredCash.toFixed(2)}`}
            </span>
            <span className="text-[8px] text-slate-400 font-bold uppercase">COUNTED</span>
          </div>
        </div>

        {/* Panel 8 */}
        <div className={`bg-white border border-[#b1b5c2] p-4 flex flex-col justify-between h-[96px] ${
          varianceStatus === 'Balanced' ? 'border-l-4 border-l-emerald-500 bg-emerald-50/10' :
          varianceStatus === 'Short' ? 'border-l-4 border-l-red-500 bg-red-50/10' :
          varianceStatus === 'Over' ? 'border-l-4 border-l-yellow-500 bg-yellow-50/10' : ''
        }`}>
          <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider block">VARIANCE</span>
          <div className="mt-2 flex justify-between items-baseline">
            <span className={`text-base font-black ${
              varianceStatus === 'Balanced' ? 'text-emerald-600' :
              varianceStatus === 'Short' ? 'text-red-500 animate-pulse' :
              varianceStatus === 'Over' ? 'text-amber-600' : 'text-slate-400'
            }`}>
              {variance === 'Pending' ? 'PENDING' : 
               variance === 0 ? 'USD 0.00' : 
               variance < 0 ? `-USD ${Math.abs(variance).toFixed(2)}` : 
               `+USD ${variance.toFixed(2)}`}
            </span>
            <span className="text-[8px] text-slate-400 font-bold uppercase">{varianceStatus}</span>
          </div>
        </div>

      </div>

      {/* 3. SHIFT GATE FORMS SPLIT LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Shift Control actions column */}
        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* A. OPEN SHIFT FORM PANEL */}
          <div className="bg-white border border-[#b1b5c2] p-5 space-y-4">
            <div className="bg-[#1e222b] p-3 -mx-5 -mt-5 text-white flex items-center justify-between border-b-2 border-slate-900">
              <span className="font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-2">
                <Unlock className="w-4 h-4 text-orange-500" />
                Shift Initialization Form
              </span>
              <span className="text-[8px] bg-orange-605/20 border border-orange-500 text-orange-500 px-1.5 py-0.2 font-mono">OP: ACTIVE</span>
            </div>

            {shiftIsOpen ? (
              <div className="py-8 text-center text-slate-400 font-bold space-y-3 bg-slate-50/50 border border-dashed border-slate-200">
                <Lock className="w-8 h-8 text-orange-500 mx-auto" />
                <div className="uppercase text-[11px] tracking-wide">SHIFT IS ALREADY OPEN</div>
                <p className="text-[9px] font-medium text-slate-405 lowercase max-w-xs mx-auto">
                  A cashier shift session is currently active on terminal <span className="font-bold text-slate-700">{terminalName}</span>. Please reconcile and close the current shift before executing initialization sequences.
                </p>
                <div className="text-[10px] border border-slate-205 py-1 px-2.5 inline-block text-slate-700 bg-white font-black uppercase">
                  Staff Op: {currentCashier}
                </div>
              </div>
            ) : (
              <form onSubmit={handleOpenShiftLocal} className="space-y-4">
                <div className="space-y-3">
                  
                  {/* Cashier name input */}
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-black text-slate-500">Signatory Cashier / Operator</label>
                    <input
                      type="text"
                      className="w-full bg-white text-[#1e222b] border border-[#b1b5c2] focus:border-orange-500 px-2.5 py-2 text-[10.5px] rounded-none font-bold uppercase"
                      value={currentCashier}
                      onChange={e => setCurrentCashier(e.target.value)}
                      required
                    />
                  </div>

                  {/* Branch & Terminal info layout */}
                  <div className="grid grid-cols-2 gap-3 pb-1">
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-black text-slate-500">Dispatch Location</label>
                      <div className="w-full bg-slate-100 text-[#1e222b] border border-[#b1b5c2] px-2.5 py-2 text-[10.5px] font-bold uppercase">
                        {branchName}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-black text-slate-500">Target Terminal ID</label>
                      <div className="w-full bg-slate-100 text-[#1e222b] border border-[#b1b5c2] px-2.5 py-2 text-[10.5px] font-bold uppercase">
                        {terminalName}
                      </div>
                    </div>
                  </div>

                  {/* Float level input */}
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-black text-slate-500">Starting Coinage Float (USD)</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 py-0.5 text-slate-400 font-extrabold">USD</span>
                      <input
                        type="number"
                        className="w-full bg-white text-[#1e222b] border border-[#b1b5c2] focus:border-orange-500 pl-10 pr-2.5 py-2 text-[11px] rounded-none font-bold cursor-pointer"
                        value={openFloat}
                        onChange={e => setOpenFloat(parseFloat(e.target.value) || 0)}
                        required
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <p className="text-[8.5px] text-slate-400">Specifies exact count of physical reserves placed in register.</p>
                  </div>

                  {/* Supervisor notes textarea */}
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-black text-slate-500">Supervisor Note & Allocation Hash</label>
                    <textarea
                      rows={2}
                      className="w-full bg-white text-[#1e222b] border border-[#b1b5c2] focus:border-orange-500 p-2 text-[10.5px] rounded-none font-sans uppercase resize-none"
                      value={supervisorNote}
                      onChange={e => setSupervisorNote(e.target.value)}
                    />
                  </div>

                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-[#f97316] hover:bg-[#ea580c] text-white font-black uppercase text-[10.5px] rounded-none flex items-center justify-center gap-1.5 border border-orange-600 transition-colors cursor-pointer mt-2"
                >
                  <Unlock className="w-3.5 h-3.5 stroke-[2.5]" />
                  Open Cashier Shift
                </button>
              </form>
            )}

          </div>

          {/* B. CLOSE SHIFT & RECONCILIATION PANEL */}
          <div className="bg-white border border-[#b1b5c2] p-5 space-y-4">
            <div className="bg-[#1e222b] p-3 -mx-5 -mt-5 text-white flex items-center justify-between border-b-2 border-slate-900">
              <span className="font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-2">
                <Lock className="w-4 h-4 text-orange-500" />
                Shift Reconciliation & Closure
              </span>
              <span className="text-[8px] bg-red-650/25 border border-red-500 text-red-500 px-1.5 py-0.2 font-mono">FINAL AUDIT</span>
            </div>

            {!shiftIsOpen && !closeCalculated ? (
              <div className="py-8 text-center text-slate-400 font-bold space-y-2 bg-slate-50/50 border border-dashed border-slate-200">
                <Lock className="w-8 h-8 text-slate-400 mx-auto" />
                <div className="uppercase text-[11px] tracking-wide">SHIFT IS CURRENTLY CLOSED</div>
                <p className="text-[9px] font-medium text-slate-405 lowercase max-w-xs mx-auto">
                  Execute "Shift Initialization Form" to unlock registry gates and launch active sales processes.
                </p>
              </div>
            ) : (
              <form onSubmit={handleCloseShiftLocal} className="space-y-3">
                <div className="space-y-2.5">
                  
                  {/* Equations display inside form */}
                  <div className="bg-slate-50 border border-slate-200 p-2.5 space-y-1.5 font-mono text-[9.5px] text-slate-600">
                    <div className="flex justify-between">
                      <span>OPENING FLOAT BANK:</span>
                      <span className="font-bold text-slate-800">USD {openFloat.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>CASH SALES TOTAL:</span>
                      <span className="font-bold text-slate-800">+USD {cashSales.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-200 pt-1.5 text-[#1e222b] font-black text-[10px]">
                      <span>SYSTEM EXPECTED COINS:</span>
                      <span className="text-orange-605 text-[10.5px]">USD {expectedCash.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Input 1: Declared cash input physically counted */}
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-black text-slate-500">Physically Counted Coins & Cash (USD)</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 py-0.5 text-slate-400 font-extrabold">USD</span>
                      <input
                        type="number"
                        className="w-full bg-white text-[#1e222b] border border-[#b1b5c2] focus:border-orange-500 pl-10 pr-2.5 py-2 text-[11px] rounded-none font-extrabold cursor-pointer placeholder-slate-350"
                        placeholder="0.00"
                        value={declaredCashInput}
                        onChange={e => setDeclaredCashInput(e.target.value)}
                        required={shiftIsOpen}
                        disabled={!shiftIsOpen}
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <p className="text-[8.5px] text-slate-400">Physically count every drawer denomination and enter total.</p>
                  </div>

                  {/* Input 2: Card/EcoCash total input */}
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-black text-slate-500">Card / EcoCash Terminal Audit (USD)</label>
                    <input
                      type="number"
                      className="w-full bg-slate-50 text-[#1e222b] border border-[#b1b5c2] px-2.5 py-1.5 text-[10.5px] rounded-none font-bold"
                      value={cardEcoCashTotalInput}
                      onChange={e => setCardEcoCashTotalInput(e.target.value)}
                      disabled
                    />
                  </div>

                  {/* Input 3: Cash removed count */}
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-black text-slate-500">Cash Dispatched to Armored Vault Drop (USD)</label>
                    <input
                      type="number"
                      className="w-full bg-white text-[#1e222b] border border-[#b1b5c2] focus:border-orange-500 px-2.5 py-1.5 text-[10.5px] rounded-none font-bold"
                      value={cashRemovedInput}
                      onChange={e => setCashRemovedInput(e.target.value)}
                      disabled={!shiftIsOpen}
                      min="0"
                      step="0.01"
                    />
                  </div>

                  {/* Input 4: Note */}
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-black text-slate-500">Auditor Closing Remarks</label>
                    <textarea
                      rows={1}
                      className="w-full bg-white text-[#1e222b] border border-[#b1b5c2] focus:border-orange-500 p-1.5 text-[10px] rounded-none font-sans uppercase resize-none"
                      value={closingNote}
                      onChange={e => setClosingNote(e.target.value)}
                      disabled={!shiftIsOpen}
                    />
                  </div>

                </div>

                {shiftIsOpen ? (
                  <button
                    type="submit"
                    className="w-full py-3 bg-[#1e222b] hover:bg-slate-800 text-white font-black uppercase text-[10.5px] rounded-none flex items-center justify-center gap-1.5 transition-colors cursor-pointer mt-3"
                  >
                    <Lock className="w-3.5 h-3.5 text-orange-500" />
                    Close Operator Shift
                  </button>
                ) : (
                  <div className="bg-emerald-50 text-emerald-800 border border-emerald-300 p-2 text-center uppercase font-bold text-[9px] tracking-wide">
                    Shift Reconciliation Flow Complete
                  </div>
                )}
              </form>
            )}

            {/* SUPERVISOR AUDIT FLAG IF NOT BALANCED */}
            {closeCalculated && variance !== 'Pending' && variance !== 0 && (
              <div className="p-3 bg-red-50 border border-red-300 space-y-1.5">
                <div className="flex gap-2 items-start text-red-700">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-extrabold text-[10px] block uppercase">SUPERVISOR REVIEW COMPULSORY</span>
                    <span className="text-[8.5px] text-slate-500 block uppercase mt-0.5">DRAWER DISCREPANCY AUDIT PATH LOCKED</span>
                  </div>
                </div>
                <p className="text-[8.5px] font-medium text-slate-500 lowercase leading-normal font-sans">
                  The difference count of <strong className="text-red-700">USD {variance.toFixed(2)}</strong> does not equal absolute zero. A corrective incident record is logged in the system. Handover keys to Bulawayo Depot inspector.
                </p>
                <div className="inline-block bg-[#1e222b] text-white font-black text-[9px] uppercase py-0.5 px-2">
                  CODE: COMPLIANCE_DISPATCH_FAULT
                </div>
              </div>
            )}

          </div>

        </div>

        {/* Shift Activity feed column */}
        <div className="lg:col-span-4 bg-white border border-[#b1b5c2] p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-150">
            <Activity className="w-4 h-4 text-orange-500" />
            <span className="font-black text-[#1e222b] text-[10px] uppercase tracking-wider">SHIFT REGISTRY EVENT AUDIT LOG</span>
          </div>

          <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1 pos-custom-scroll">
            {shiftActivityEvents.map(ev => {
              let tagBg = 'bg-slate-100 text-slate-700 border-slate-350';
              if (ev.severity === 'Medium') tagBg = 'bg-orange-50/50 text-orange-800 border-orange-300 font-bold';
              else if (ev.severity === 'High') tagBg = 'bg-red-50 text-red-800 border-red-350 font-black animate-pulse';

              let titleLabel = ev.type.replace(/_/g, ' ');

              return (
                <div key={ev.id} className="p-2.5 border border-slate-200 bg-slate-50/40 hover:bg-slate-50 transition-colors space-y-1">
                  <div className="flex justify-between items-center text-[8px] font-mono select-none">
                    <span className="text-slate-400 font-bold">{ev.time}</span>
                    <span className={`px-1.5 py-0.2 border rounded-none uppercase text-[7.5px] ${tagBg}`}>
                      {ev.severity}
                    </span>
                  </div>
                  <h4 className="font-bold text-[#1e222b] uppercase text-[9.5px] font-mono tracking-tight">{titleLabel}</h4>
                  <p className="text-[9px] font-medium text-slate-500 lowercase leading-normal font-sans">
                    {ev.message}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="bg-slate-100 p-2 border border-slate-250 flex items-center justify-between text-[8px] text-slate-500 font-mono select-none uppercase">
            <span>TERMINAL STORAGE: BUF_04</span>
            <span>MEM PARITY: SHA-256</span>
          </div>
        </div>

      </div>

    </div>
  );
}
