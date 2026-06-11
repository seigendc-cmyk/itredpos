import { useState, useEffect } from 'react';
import { 
  Clock, 
  Cpu, 
  Zap,
  LogOut,
  Wifi,
  WifiOff
} from 'lucide-react';
import { PosPageId, PosSession, SyncQueueItem } from '../types';

interface PosTopbarProps {
  terminalId: string;
  activeOperator: string;
  activeShiftStatus: 'ACTIVE' | 'CLOSED';
  activePage: PosPageId;
  onPageChange: (pageId: PosPageId) => void;
  session?: PosSession;
  onSignOut?: () => void;
}

export default function PosTopbar({
  terminalId,
  activeOperator,
  activeShiftStatus,
  activePage,
  onPageChange,
  session,
  onSignOut
}: PosTopbarProps) {
  const [timeStr, setTimeStr] = useState('');
  const [connectivity, setConnectivity] = useState<'ONLINE' | 'OFFLINE'>('ONLINE');
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const checkSyncStatus = () => {
      try {
        const conn = localStorage.getItem('sci_pos_terminal_connectivity') === 'OFFLINE' ? 'OFFLINE' : 'ONLINE';
        setConnectivity(conn);

        const dataStr = localStorage.getItem('sci_pos_sync_queue');
        if (dataStr) {
          const items = JSON.parse(dataStr);
          if (Array.isArray(items)) {
            const pending = (items as SyncQueueItem[]).filter((item) => item.syncStatus !== 'Synced').length;
            setPendingCount(pending);
          }
        } else {
          setPendingCount(7);
        }
      } catch {
        setConnectivity('ONLINE');
        setPendingCount(0);
      }
    };

    checkSyncStatus();
    const interval = setInterval(checkSyncStatus, 1500);
    return () => clearInterval(interval);
  }, []);

  // Live ticking clock matching ISO time format 
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      const yr = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      const da = String(d.getDate()).padStart(2, '0');
      const hr = String(d.getHours()).padStart(2, '0');
      const mi = String(d.getMinutes()).padStart(2, '0');
      const se = String(d.getSeconds()).padStart(2, '0');
      setTimeStr(`${yr}-${mo}-${da} ${hr}:${mi}:${se}`);
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const pageSubtitle: Record<PosPageId, string> = {
    DASHBOARD: 'Operations Overview',
    OWNER_DESK: 'Owner Review Desk',
    SALES: 'Sales Terminal',
    SALES_HISTORY: 'Sales History',
    DELIVERY: 'Delivery Desk',
    STOCK: 'Inventory',
    TASK_DESK: 'Task Desk',
    APPROVALS: 'Approvals',
    SHIFT: 'Shift Control',
    CASH: 'Cash Control',
    BI_DESK: 'BI Desk',
    SYNC_DESK: 'Sync Desk',
    SETTINGS: 'Settings'
  };

  return (
    <header id="pos-topbar" className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 select-none font-mono text-xs w-full">
      {/* Current contextual page heading and active session details */}
      <div className="flex items-center gap-3 overflow-hidden">
        <div className="bg-amber-500/10 border border-amber-500/45 text-amber-500 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider shrink-0">
          iTred Commerce POS
        </div>

        <div className="bg-slate-950 px-2.5 py-1 border border-slate-800 text-[10px] text-[#00f0ff] font-bold uppercase tracking-wider shrink-0">
          PAGE: {activePage}
        </div>

        <div className="bg-slate-950 px-2.5 py-1 border border-slate-850 text-[10px] text-amber-500 font-bold uppercase tracking-wider shrink-0">
          ROLE ACCESS: {session ? session.role : 'SysAdmin'}
        </div>

        {session ? (
          <div className="hidden xl:flex items-center gap-4 text-[9.5px] text-slate-400 bg-slate-950/50 border border-slate-800 px-3 py-1 font-mono uppercase tracking-wide shrink-0">
            <span className="text-slate-500">VNDR: <strong className="text-amber-500 font-bold">{session.vendor}</strong></span>
            <span className="text-slate-700">/</span>
            <span className="text-slate-500">BRCH: <strong className="text-slate-300 font-semibold">{session.branch}</strong></span>
            <span className="text-slate-700">/</span>
            <span className="text-slate-500">TERM: <strong className="text-[#00f0ff] font-semibold">{session.terminal}</strong></span>
            <span className="text-slate-700">/</span>
            <span className="text-slate-500">STAFF: <strong className="text-emerald-400 font-bold">{session.staffName} ({session.role})</strong></span>
          </div>
        ) : (
          <span className="text-slate-500 uppercase text-[10px] hidden md:inline truncate max-w-sm">
            {pageSubtitle[activePage]}
          </span>
        )}
      </div>

      {/* Grid of details */}
      <div className="flex items-center gap-4">
        {/* Compact medium-viewport session info */}
        {session && (
          <div className="hidden md:flex xl:hidden items-center gap-2 text-[9px] text-[#00f0ff] font-mono bg-slate-950 border border-slate-850 px-2 py-1 uppercase max-w-[200px] truncate shrink-0">
            <span className="truncate">{session.staffName} [{session.role}] @ {session.terminal}</span>
          </div>
        )}
        
        {/* Dynamic ticking clock widget */}
        <div className="flex items-center gap-2 text-slate-300 border-r border-slate-800 pr-4 bg-slate-950 px-2.5 py-1.5 border border-slate-850">
          <Clock className="w-3.5 h-3.5 text-[#00f0ff]" />
          <span className="font-bold text-[10px] text-emerald-400 tracking-widest">{timeStr || "TICKING..."}</span>
        </div>

        {/* Hardware telemetry details */}
        <div className="hidden sm:flex items-center gap-4 text-[10px] text-slate-500 font-mono">
          <div className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-amber-500" />
            <span>TEMP: <span className="text-slate-300 font-bold">42.8°C</span></span>
          </div>

          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-[#00f0ff]" />
            <span>POWER: <span className="text-emerald-400 font-bold">MAX_STABLE</span></span>
          </div>

          <div className="flex items-center gap-2">
            {connectivity === 'ONLINE' ? (
              <span className="flex items-center gap-1 bg-emerald-950 px-2 py-0.5 border border-emerald-800 text-emerald-400 font-extrabold text-[9px] uppercase">
                <Wifi className="w-3" />
                ONLINE
              </span>
            ) : (
              <span className="flex items-center gap-1 bg-rose-950 px-2 py-0.5 border border-rose-800 text-[#f43f5e] font-extrabold text-[9px] uppercase">
                <WifiOff className="w-3" />
                OFFLINE
              </span>
            )}

            <button 
              onClick={() => onPageChange('SYNC_DESK')}
              className={`px-1.5 py-0.5 font-bold text-[9px] cursor-pointer outline-none border-0 ${
                pendingCount > 0 
                  ? 'bg-orange-600 text-white'
                  : 'bg-slate-800 text-slate-400'
              }`}
              title="Navigate to Sync Desk to inspect transaction queue"
            >
              Q-BUFFER: {pendingCount}
            </button>
          </div>
        </div>

        {session && onSignOut && (
          <button
            onClick={onSignOut}
            className="bg-rose-950/40 hover:bg-rose-905-6 bg-rose-900/40 border border-rose-800 hover:border-rose-500 text-rose-200 px-2.5 py-1.5 transition-colors cursor-pointer text-[10px] uppercase font-bold flex items-center gap-1.5 shrink-0"
            title="Switch Operator Staff Member"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-400" />
            Switch Staff
          </button>
        )}

      </div>
    </header>
  );
}
