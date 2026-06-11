import React, { useState } from 'react';
import { 
  TrendingUp, 
  Layers, 
  Lock, 
  Unlock, 
  Users, 
  Monitor, 
  ShieldAlert, 
  DollarSign, 
  Clock, 
  Activity, 
  CheckCircle2, 
  Building, 
  AlertTriangle, 
  ArrowRight, 
  Check, 
  Database,
  Zap,
  Package,
  ClipboardList,
  PlusCircle,
  Truck,
  FileCheck,
  RotateCcw,
  RefreshCw,
  Eye,
  ShieldCheck,
  FileText
} from 'lucide-react';
import { Product, Transaction, Shift, CashLog, PosSession, PosPageId } from '../types';

interface PosDashboardProps {
  products: Product[];
  transactions: Transaction[];
  activeShift: Shift | null;
  cashLogs: CashLog[];
  onNavigate: (page: PosPageId) => void;
  session?: PosSession | null;
}

export default function PosDashboard({
  products,
  transactions,
  activeShift,
  cashLogs,
  onNavigate,
  session
}: PosDashboardProps) {

  // Retrieve current active operator name
  const staffName = session?.staffName || 'Admin User';
  const roleName = session?.role || 'Owner';
  const vendorName = session?.vendor || 'Demo Vendor';
  const branchName = session?.branch || 'Harare Main';
  const terminalName = session?.terminal || 'POS-01';

  // State to simulate system notification feedback when quick actions are clicked
  const [consoleNotification, setConsoleNotification] = useState<string>('Sync Status: Fully Synchronized');
  const [notificationType, setNotificationType] = useState<'info' | 'success' | 'warning'>('info');

  // Local state for approval queue cards to allow interactive approving
  const [overridesCount, setOverridesCount] = useState(2);
  const [refundsCount, setRefundsCount] = useState(1);
  const [adjustmentsCount, setAdjustmentsCount] = useState(3);
  const [varianceCount, setVarianceCount] = useState(0);

  // Alert simulation triggers
  const triggerNotification = (message: string, type: 'info' | 'success' | 'warning' = 'info') => {
    setConsoleNotification(message);
    setNotificationType(type);
    setTimeout(() => {
      setConsoleNotification('Sync Status: Fully Synchronized');
      setNotificationType('info');
    }, 4000);
  };

  // Handle local approval actions
  const approvePriceOverride = () => {
    if (overridesCount > 0) {
      setOverridesCount(prev => prev - 1);
      triggerNotification(`APPROVED: Price override bypass granted for operator.`, 'success');
    } else {
      triggerNotification(`No price overrides pending in approval queue.`, 'info');
    }
  };

  const approveRefund = () => {
    if (refundsCount > 0) {
      setRefundsCount(prev => prev - 1);
      triggerNotification(`APPROVED: Customer refund of USD 45.00 authorized.`, 'success');
    } else {
      triggerNotification(`No active refunds pending.`, 'info');
    }
  };

  const approveAdjustment = () => {
    if (adjustmentsCount > 0) {
      setAdjustmentsCount(prev => prev - 1);
      triggerNotification(`APPROVED: Inventory write-in stock correction processed.`, 'success');
    } else {
      triggerNotification(`No pending stock adjustments.`, 'info');
    }
  };

  // Exact BI alerts mandated by the user specification
  const BI_ALERTS = [
    {
      id: 'AL-109',
      type: 'LOW_STOCK_REMINDER',
      severity: 'Medium',
      message: 'Brake Pads Toyota GD6 below reorder level',
      time: '15:48:12',
    },
    {
      id: 'AL-110',
      type: 'PRICE_OVERRIDE_REQUESTED',
      severity: 'High',
      message: 'Cashier requested 15% discount on radiator',
      time: '15:40:02',
    },
    {
      id: 'AL-111',
      type: 'SALE_BLOCKED_ZERO_STOCK',
      severity: 'Critical',
      message: 'Attempted sale of out-of-stock clutch plate',
      time: '15:21:49',
    },
    {
      id: 'AL-112',
      type: 'FAILED_TERMINAL_LOGIN',
      severity: 'Medium',
      message: 'Failed access attempt on POS-02',
      time: '14:55:01',
    },
    {
      id: 'AL-113',
      type: 'RECOMMEND_MAJOR_STOCKTAKE',
      severity: 'High',
      message: 'Branch stock variance risk increasing',
      time: '14:30:15',
    }
  ];

  return (
    <div className="space-y-6 select-none font-mono text-xs text-slate-300">
      
      {/* 0. Top Operational Context Banner */}
      <div id="dashboard-context-banner" className="bg-[#0f131a] border border-slate-800 p-4 relative overflow-hidden">
        {/* Corner machinery visual lines */}
        <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-amber-500"></div>
        <div className="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r border-amber-500"></div>
        <div className="absolute bottom-0 left-0 w-1.5 h-1.5 border-b border-l border-amber-500"></div>
        <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-amber-500"></div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 bg-emerald-500 animate-pulse shrink-0"></div>
            <div>
              <div className="text-[10px] text-slate-550 font-black uppercase tracking-widest leading-none">
                ACTIVE OPERATIONAL SITE IDENTITY CONTEXT
              </div>
              <div className="text-slate-100 font-bold text-xs mt-1 uppercase flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>VENDOR: <strong className="text-amber-500">{vendorName}</strong></span>
                <span className="text-slate-700 font-normal">|</span>
                <span>BRANCH: <strong className="text-[#00f0ff]">{branchName}</strong></span>
                <span className="text-slate-700 font-normal">|</span>
                <span>TERMINAL: <strong className="text-slate-200">{terminalName}</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 md:pl-5 shrink-0">
            <div className="bg-amber-500/10 border border-amber-500/30 p-2 shrink-0">
              <Users className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <div className="text-[9px] text-slate-500 uppercase font-black tracking-widest leading-none">
                AUTHENTICATED OPERATOR
              </div>
              <div className="text-slate-200 font-bold text-xs mt-1 uppercase">
                {staffName} <span className="text-amber-400 font-normal">[{roleName}]</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Status notification feedback */}
      <div className={`p-3 border text-[10px] tracking-wide uppercase transition-all duration-300 flex items-center justify-between ${
        notificationType === 'success' ? 'bg-emerald-950/30 border-emerald-800 text-emerald-400' :
        notificationType === 'warning' ? 'bg-amber-950/30 border-amber-800 text-amber-400' :
        'bg-slate-950 border-slate-850 text-sky-400'
      }`}>
        <div className="flex items-center gap-2">
          {notificationType === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> :
           notificationType === 'warning' ? <ShieldAlert className="w-4 h-4 shrink-0" /> :
           <Activity className="w-4 h-4 shrink-0 animate-pulse" />}
          <span>{consoleNotification}</span>
        </div>
        <div className="text-[9px] text-slate-600 font-black">
          UTC: {new Date().toISOString().substring(11, 19)}
        </div>
      </div>

      {/* Main Grid: Left Side Operations (cols-2), Right Side BI Alerts (cols-1) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT COLUMN SPANS */}
        <div className="lg:col-span-2 space-y-6">

          {/* 1. Today Trading Summary */}
          <div className="space-y-3">
            <h3 className="text-[11px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              1. Today Trading Summary
            </h3>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              
              {/* Metric 1 */}
              <div className="bg-[#10141e] border border-slate-800 p-4 relative flex flex-col justify-between h-28 hover:border-[#00f0ff] transition-all">
                <div className="text-[9px] text-slate-500 uppercase font-black tracking-wider leading-none">
                  Gross Sales (USD)
                </div>
                <div className="text-lg font-black text-slate-50 font-mono tracking-tight my-1">
                  USD 1,245.00
                </div>
                <div className="text-[9px] text-emerald-400 uppercase font-black tracking-widest flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-none shrink-0" />
                  +12.8% VS PRIOR
                </div>
              </div>

              {/* Metric 2 */}
              <div className="bg-[#10141e] border border-slate-800 p-4 relative flex flex-col justify-between h-28 hover:border-[#00f0ff] transition-all">
                <div className="text-[9px] text-slate-500 uppercase font-black tracking-wider leading-none">
                  Transactions
                </div>
                <div className="text-lg font-black text-slate-50 font-mono tracking-tight my-1">
                  38 Units
                </div>
                <div className="text-[9px] text-indigo-400 uppercase font-black tracking-widest flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-indigo-500 rounded-none shrink-0" />
                  LEDGER POSTED
                </div>
              </div>

              {/* Metric 3 */}
              <div className="bg-[#10141e] border border-slate-800 p-4 relative flex flex-col justify-between h-28 hover:border-[#00f0ff] transition-all">
                <div className="text-[9px] text-slate-500 uppercase font-black tracking-wider leading-none">
                  Average Basket
                </div>
                <div className="text-lg font-black text-slate-50 font-mono tracking-tight my-1">
                  USD 32.76
                </div>
                <div className="text-[9px] text-cyan-400 uppercase font-black tracking-widest flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-cyan-400 rounded-none shrink-0" />
                  STABLE RANGE
                </div>
              </div>

              {/* Metric 4 */}
              <div className="bg-[#10141e] border border-slate-800 p-4 relative flex flex-col justify-between h-28 hover:border-[#00f0ff] transition-all">
                <div className="text-[9px] text-slate-500 uppercase font-black tracking-wider leading-none">
                  Items Sold
                </div>
                <div className="text-lg font-black text-slate-50 font-mono tracking-tight my-1">
                  96 Pcs
                </div>
                <div className="text-[9px] text-[#00f0ff] uppercase font-black tracking-widest flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-[#00f0ff] rounded-none shrink-0" />
                  DISPATCH ORDERED
                </div>
              </div>

            </div>
          </div>

          {/* 2 & 3: Shift Status & Stock Health in Double Columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* 2. Shift Status */}
            <div className="space-y-3">
              <h3 className="text-[11px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                2. Shift Status
              </h3>

              <div className="bg-[#0f131a] border border-slate-800 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                  <span className="text-slate-500 uppercase font-bold text-[10px]">Active Shift Lock:</span>
                  <span className="bg-emerald-950/60 border border-emerald-800 text-emerald-400 px-2 py-0.5 text-[9px] font-black tracking-widest uppercase">
                    [Open / Active]
                  </span>
                </div>

                <div className="space-y-2 text-[10.5px]">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Opened By:</span>
                    <span className="text-slate-200 font-bold uppercase">{staffName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Opening Float:</span>
                    <span className="text-slate-200 font-mono">USD 50.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Expected Cash:</span>
                    <span className="text-amber-500 font-mono font-bold">USD 710.00</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-900/50 pt-2 text-[10px]">
                    <span className="text-slate-500">Declared Cash:</span>
                    <span className="text-slate-400 italic">Pending Reconcile</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-slate-500">Variance:</span>
                    <span className="text-slate-400 italic">Pending Audit</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-900">
                  <button
                    onClick={() => onNavigate('SHIFT')}
                    className="w-full text-center py-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-[#00f0ff] hover:text-[#4df5ff] transition-colors text-[9px] uppercase font-bold tracking-wider"
                  >
                    Manage Shift Registers &rarr;
                  </button>
                </div>
              </div>
            </div>

            {/* 3. Stock Health */}
            <div className="space-y-3">
              <h3 className="text-[11px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
                <Package className="w-4 h-4 text-[#00f0ff]" />
                3. Stock Health
              </h3>

              <div className="bg-[#0f131a] border border-slate-800 p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3.5">
                  
                  <div className="bg-slate-950 p-2.5 border border-slate-800 hover:border-amber-500/50 transition-colors">
                    <div className="text-[9px] text-amber-500 uppercase font-black tracking-wider leading-none">
                      Low Stock
                    </div>
                    <div className="text-lg font-black text-slate-100 font-mono mt-1">
                      12 Items
                    </div>
                    <span className="text-[8px] text-slate-500 block uppercase">BELOW SAFETY VAL</span>
                  </div>

                  <div className="bg-slate-950 p-2.5 border border-slate-800 hover:border-rose-500/50 transition-colors">
                    <div className="text-[9px] text-rose-500 uppercase font-black tracking-wider leading-none">
                      Out of Stock
                    </div>
                    <div className="text-lg font-black text-slate-100 font-mono mt-1">
                      4 Items
                    </div>
                    <span className="text-[8px] text-rose-400 block uppercase font-bold animate-pulse">0 BAL SHUTDOWN</span>
                  </div>

                  <div className="bg-slate-950 p-2.5 border border-slate-800 hover:border-slate-700 transition-colors">
                    <div className="text-[9px] text-slate-500 uppercase font-black tracking-wider leading-none">
                      Dead Stock
                    </div>
                    <div className="text-lg font-black text-slate-100 font-mono mt-1">
                      7 Items
                    </div>
                    <span className="text-[8px] text-slate-500 block uppercase">NO MVMNT &gt; 90D</span>
                  </div>

                  <div className="bg-slate-950 p-2.5 border border-slate-800 hover:border-amber-500 transition-colors">
                    <div className="text-[9px] text-yellow-500 uppercase font-black tracking-wider leading-none">
                      Variance Risk
                    </div>
                    <div className="text-lg font-black text-slate-100 font-mono mt-1">
                      3 Items
                    </div>
                    <span className="text-[8px] text-slate-500 block uppercase">DRIFT SUSPICION</span>
                  </div>

                </div>

                <div className="pt-1">
                  <button
                    onClick={() => onNavigate('STOCK')}
                    className="w-full text-center py-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-[#00f0ff] hover:text-[#4df5ff] transition-colors text-[9px] uppercase font-bold tracking-wider"
                  >
                    Open Stock Control Log &rarr;
                  </button>
                </div>
              </div>
            </div>

          </div>

          {/* 4. Approval Queue */}
          <div className="space-y-3">
            <h3 className="text-[11px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              4. Price & Transaction Approval Queue
            </h3>

            <div className="bg-[#0f131a] border border-slate-800 p-4">
              <div className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-3 leading-none">
                Approval Requests From Active Terminals:
              </div>

              <div className="space-y-2.5">
                
                {/* Override Queue Row */}
                <div className="flex items-center justify-between p-2.5 bg-slate-950 border border-slate-850 hover:border-slate-750">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="bg-amber-500/10 border border-amber-500/30 text-amber-500 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider">
                        PRICE OVERRIDE
                      </span>
                      <strong className="text-slate-200 text-[10.5px] font-mono">{overridesCount} Active Request(s)</strong>
                    </div>
                    <p className="text-[9px] text-slate-500 max-w-md truncate">Cashier is requesting manually set 15% discount override on Radiators.</p>
                  </div>
                  <button
                    onClick={approvePriceOverride}
                    disabled={overridesCount === 0}
                    className="bg-amber-500 hover:bg-amber-600 disabled:bg-slate-850 text-slate-950 disabled:text-slate-600 px-3 py-1.5 font-bold uppercase transition-colors shrink-0 text-[10px]"
                  >
                    {overridesCount > 0 ? 'Review & Sign' : 'Cleared'}
                  </button>
                </div>

                {/* Refund Row */}
                <div className="flex items-center justify-between p-2.5 bg-slate-950 border border-slate-850 hover:border-slate-750">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="bg-[#00f0ff]/10 border border-[#00f0ff]/30 text-[#00f0ff] px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider">
                        REFUND QUEUE
                      </span>
                      <strong className="text-slate-200 text-[10.5px] font-mono">{refundsCount} Active Request(s)</strong>
                    </div>
                    <p className="text-[9px] text-slate-500 max-w-md truncate">Cash refund request for 20 M12 Heavy Hex Bolts returned due to size error.</p>
                  </div>
                  <button
                    onClick={approveRefund}
                    disabled={refundsCount === 0}
                    className="bg-amber-500 hover:bg-amber-600 disabled:bg-slate-850 text-slate-950 disabled:text-slate-600 px-3 py-1.5 font-bold uppercase transition-colors shrink-0 text-[10px]"
                  >
                    {refundsCount > 0 ? 'Review & Sign' : 'Cleared'}
                  </button>
                </div>

                {/* Stock write-in Row */}
                <div className="flex items-center justify-between p-2.5 bg-slate-950 border border-slate-850 hover:border-slate-750">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider">
                        STOCK ADJUSTMENT
                      </span>
                      <strong className="text-slate-200 text-[10.5px] font-mono">{adjustmentsCount} Active Request(s)</strong>
                    </div>
                    <p className="text-[9px] text-slate-500 max-w-md truncate">Manual write-in request to adjust Steel Thread Tapes counts upwards (+5 units).</p>
                  </div>
                  <button
                    onClick={approveAdjustment}
                    disabled={adjustmentsCount === 0}
                    className="bg-amber-500 hover:bg-amber-600 disabled:bg-slate-850 text-slate-950 disabled:text-slate-600 px-3 py-1.5 font-bold uppercase transition-colors shrink-0 text-[10px]"
                  >
                    {adjustmentsCount > 0 ? 'Review & Sign' : 'Cleared'}
                  </button>
                </div>

                {/* Cash Variance Row */}
                <div className="flex items-center justify-between p-2.5 bg-slate-950 border border-slate-850 hover:border-slate-750">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="bg-rose-500/10 border border-rose-500/30 text-rose-400 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider">
                        CASH VARIANCE REVIEWS
                      </span>
                      <strong className="text-slate-200 text-[10.5px] font-mono">{varianceCount} Active Request(s)</strong>
                    </div>
                    <p className="text-[9px] text-slate-500 max-w-md truncate">Drawer discrepancy flagged beneath allowed standard float bounds.</p>
                  </div>
                  <button
                    disabled
                    className="bg-slate-850 text-slate-600 px-3 py-1.5 font-bold uppercase transition-colors shrink-0 text-[10px]"
                  >
                    No Alerts
                  </button>
                </div>

              </div>
            </div>
          </div>

          {/* 6. Quick Actions */}
          <div className="space-y-3">
            <h3 className="text-[11px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
              <TableActionsIcon className="w-4 h-4 text-emerald-400" />
              6. Quick Actions
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              
              <button
                onClick={() => onNavigate('SALES')}
                className="bg-[#141822] hover:bg-[#1a2130] border border-slate-800 hover:border-[#00f0ff] p-4 text-center cursor-pointer group transition-all text-slate-200"
              >
                <PlusCircle className="w-6 h-6 text-emerald-400 mx-auto mb-2 group-hover:scale-105 transition-transform" />
                <span className="block font-bold uppercase text-[10px] tracking-wider text-slate-100">New Sale</span>
                <span className="text-[8.5px] text-slate-550 block mt-1">OPEN TERMINAL</span>
              </button>

              <button
                onClick={() => {
                  onNavigate('STOCK');
                  triggerNotification('STOCKTAKE UTILITY LOADED: Initiating visual scanner sequence.', 'info');
                }}
                className="bg-[#141822] hover:bg-[#1a2130] border border-slate-800 hover:border-amber-500 p-4 text-center cursor-pointer group transition-all text-slate-200"
              >
                <ClipboardList className="w-6 h-6 text-amber-500 mx-auto mb-2 group-hover:scale-105 transition-transform" />
                <span className="block font-bold uppercase text-[10px] tracking-wider text-slate-100">Open Stocktake</span>
                <span className="text-[8.5px] text-slate-550 block mt-1">INVENTORY COUNT</span>
              </button>

              <button
                onClick={() => {
                  onNavigate('STOCK');
                  triggerNotification('Goods receiving workspace opened. Fill incoming stock details below.', 'info');
                }}
                className="bg-[#141822] hover:bg-[#1a2130] border border-slate-800 hover:border-sky-500 p-4 text-center cursor-pointer group transition-all text-slate-200"
              >
                <Truck className="w-6 h-6 text-sky-400 mx-auto mb-2 group-hover:scale-105 transition-transform" />
                <span className="block font-bold uppercase text-[10px] tracking-wider text-slate-100">Receive Goods</span>
                <span className="text-[8.5px] text-slate-550 block mt-1">STOCK RECEIVING</span>
              </button>

              <button
                onClick={() => onNavigate('CASH')}
                className="bg-[#141822] hover:bg-[#1a2130] border border-slate-800 hover:border-emerald-500 p-4 text-center cursor-pointer group transition-all text-slate-200"
              >
                <FileCheck className="w-6 h-6 text-emerald-500 mx-auto mb-2 group-hover:scale-105 transition-transform" />
                <span className="block font-bold uppercase text-[10px] tracking-wider text-slate-100">Cash Count</span>
                <span className="text-[8.5px] text-slate-550 block mt-1">VERIFY CASH FLOAT</span>
              </button>

              <button
                onClick={() => {
                  triggerNotification('Approval request sent to branch supervisors.', 'warning');
                }}
                className="bg-[#141822] hover:bg-[#1a2130] border border-slate-800 hover:border-amber-400 p-4 text-center cursor-pointer group transition-all text-slate-200"
              >
                <Zap className="w-6 h-6 text-amber-400 mx-auto mb-2 group-hover:scale-105 transition-transform animate-pulse" />
                <span className="block font-bold uppercase text-[10px] tracking-wider text-slate-100">Request Approval</span>
                <span className="text-[8.5px] text-slate-550 block mt-1">SUBMIT APPROVAL</span>
              </button>

              <button
                onClick={() => onNavigate('BI_DESK')}
                className="bg-[#141822] hover:bg-[#1a2130] border border-slate-800 hover:border-[#00f0ff] p-4 text-center cursor-pointer group transition-all text-slate-200"
              >
                <Eye className="w-6 h-6 text-[#00f0ff] mx-auto mb-2 group-hover:scale-105 transition-transform" />
                <span className="block font-bold uppercase text-[10px] tracking-wider text-slate-100">View BI Desk</span>
                <span className="text-[8.5px] text-slate-550 block mt-1">LIVE ACTIVITY FEED</span>
              </button>

            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: 5. BI ALERTS READOUT (1 Col) */}
        <div className="space-y-3">
          <h3 className="text-[11px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-500 animate-pulse" />
            5. BI Risk Alerts
          </h3>

          <div className="bg-[#0f131a] border border-slate-800 p-4 h-[730px] flex flex-col justify-between relative overflow-hidden">
            {/* Fine framing indicators */}
            <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-slate-700"></div>
            <div className="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r border-slate-700"></div>
            <div className="absolute bottom-0 left-0 w-1.5 h-1.5 border-b border-l border-slate-700"></div>
            <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-slate-700"></div>

            <div className="space-y-4">
              <div className="border-b border-slate-900 pb-2">
                <div className="text-[10px] font-black text-slate-100 uppercase tracking-widest flex items-center justify-between">
                  <span>Live Activity Feed</span>
                  <span className="text-[8px] bg-amber-500/10 border border-amber-500/20 text-amber-500 px-1.5 py-0.5 animate-pulse">
                    LIVE STREAM
                  </span>
                </div>
                <p className="text-[9px] text-slate-500 mt-1 leading-normal">
                  Realtime notification stream mapping core hardware interaction faults, bypasses, price corrections, and zero stock events.
                </p>
              </div>

              {/* Precise vertical list mapping the 5 specific alerts */}
              <div className="space-y-3 max-h-[580px] overflow-y-auto pr-1 pos-custom-scroll">
                
                {BI_ALERTS.map((alert) => (
                  <div 
                    key={alert.id} 
                    className={`p-3 border text-[10.5px] relative group hover:bg-slate-900/40 transition-colors ${
                      alert.severity === 'Critical' ? 'bg-rose-950/10 border-rose-900/60' :
                      alert.severity === 'High' ? 'bg-amber-950/10 border-amber-900/60' :
                      'bg-slate-950 border-slate-850'
                    }`}
                  >
                    {/* Tiny accent decoration representing active alert sync */}
                    <div className={`absolute top-0 left-0 w-1 h-full ${
                      alert.severity === 'Critical' ? 'bg-rose-500' :
                      alert.severity === 'High' ? 'bg-amber-500' :
                      'bg-indigo-500'
                    }`} />

                    <div className="pl-2.5">
                      <div className="flex items-center justify-between text-[8px] uppercase font-black text-slate-500 mb-1">
                        <span>ID: {alert.id} • HRE_M3</span>
                        <span className={`px-1.5 py-0.5 font-bold ${
                          alert.severity === 'Critical' ? 'bg-rose-950 border border-rose-800 text-rose-400' :
                          alert.severity === 'High' ? 'bg-amber-950 border border-amber-800 text-amber-400' :
                          'bg-indigo-950 border border-indigo-900 text-indigo-400'
                        }`}>
                          {alert.severity}
                        </span>
                      </div>

                      <div className="text-[10px] font-black text-slate-200 uppercase tracking-wide flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-none inline-block shrink-0 bg-slate-550" />
                        {alert.type}
                      </div>

                      <p className="text-[10px] text-slate-300 font-medium leading-relaxed mt-1 text-slate-300">
                        {alert.message}
                      </p>

                      <div className="mt-2 pt-1 border-t border-slate-900 flex justify-between items-center text-[8.5px] text-slate-500">
                        <span>STATION ID: {terminalName}</span>
                        <span>⌛ {alert.time}</span>
                      </div>
                    </div>
                  </div>
                ))}

              </div>
            </div>

            {/* Total count footer log */}
            <div className="border-t border-slate-900 pt-3 flex items-center justify-between text-[9px] text-slate-600 font-black">
              <span>ALERT STREAM BUFFER: 5 RECORDS</span>
              <span>STATE: OPERATIONAL</span>
            </div>
          </div>
        </div>

      </div>

      {/* Modern Industrial Footer Diagnostics Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border border-slate-800 bg-slate-950 p-4 font-mono text-[10px] uppercase text-slate-400">
        <div className="flex items-center gap-3">
          <Clock className="w-4 h-4 text-amber-500 shrink-0" />
          <div>
            <div className="text-slate-600 text-[9px]">LOCALIZED REGISTRY DATE</div>
            <div className="text-slate-300 font-bold">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 border-t md:border-t-0 md:border-x border-slate-800 py-2 md:py-0 md:px-4">
          <Database className="w-4 h-4 text-indigo-400 shrink-0" />
          <div>
            <div className="text-slate-600 text-[9px]">Data Storage Status</div>
            <div className="text-slate-200 font-bold">SOLID_STATE LOCALBYPASS BUFFER</div>
          </div>
        </div>

        <div className="flex items-center gap-3 border-t md:border-t-0 py-2 md:py-0">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <div>
            <div className="text-slate-600 text-[9px]">DIAGNOSTIC STATUS</div>
            <div className="text-emerald-400 font-bold">Terminal Ready</div>
          </div>
        </div>
      </div>

    </div>
  );
}

// Compact helper components to keep compilation smooth & type-safe
function TableActionsIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect x="3" y="3" width="18" height="18" rx="0" />
      <path d="M21 9H3" />
      <path d="M21 15H3" />
      <path d="M12 3v18" />
    </svg>
  );
}
