import { useState, useEffect } from 'react';
import { 
  Clock, 
  LogOut,
  Wifi,
  WifiOff
} from 'lucide-react';
import { PosPageId, PosSession, Role, SyncQueueItem } from '../types';
import { TerminalControlCheck } from '../types';
import { runTerminalControlCheck } from '../services/terminalControlService';

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
  activeShiftStatus,
  onPageChange,
  session,
  onSignOut
}: PosTopbarProps) {
  const [timeStr, setTimeStr] = useState('');
  const [connectivity, setConnectivity] = useState<'ONLINE' | 'OFFLINE'>('ONLINE');
  const [pendingCount, setPendingCount] = useState(0);
  const [, setControlCheck] = useState<TerminalControlCheck | null>(null);

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

  useEffect(() => {
    if (!session) return;
    const branchId = session.branch.toLowerCase().includes('bulawayo') ? 'BR-BYO' : 'BR-HARARE';
    let mounted = true;
    runTerminalControlCheck({
      vendorId: 'SCI-LOG-ZW',
      branchId,
      terminalId: terminalId || session.terminal,
      terminalName: session.terminal,
      staffId: session.staffName,
      staffName: session.staffName,
      role: session.role as Role,
      requiresCashDrawer: false
    }).then((check) => {
      if (mounted) setControlCheck(check);
    }).catch(() => {
      if (mounted) setControlCheck(null);
    });
    const timer = setInterval(() => {
      runTerminalControlCheck({
        vendorId: 'SCI-LOG-ZW',
        branchId,
        terminalId: terminalId || session.terminal,
        terminalName: session.terminal,
        staffId: session.staffName,
        staffName: session.staffName,
        role: session.role as Role,
        requiresCashDrawer: false
      }).then((check) => {
        if (mounted) setControlCheck(check);
      }).catch(() => undefined);
    }, 3000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [session, terminalId, activeShiftStatus]);

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

  return (
    <header id="pos-topbar" className="h-12 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-3 select-none font-mono text-xs w-full">
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-8 h-8 border border-orange-500 bg-orange-500/10 flex items-center justify-center shrink-0" title="POS workspace">
          <span className="w-2 h-2 bg-orange-500 block"></span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-2 text-slate-300 bg-slate-950 px-2 py-1 border border-slate-850" title="Local time">
          <Clock className="w-3.5 h-3.5 text-[#00f0ff]" />
          <span className="font-semibold text-[10px] text-emerald-400 tracking-widest">{timeStr || "TICKING..."}</span>
        </div>

        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
          {connectivity === 'ONLINE' ? (
            <span className="flex items-center justify-center w-8 h-8 bg-emerald-950 border border-emerald-800 text-emerald-400" title="Online">
              <Wifi className="w-3.5 h-3.5" />
            </span>
          ) : (
            <span className="flex items-center justify-center w-8 h-8 bg-rose-950 border border-rose-800 text-[#f43f5e]" title="Offline">
              <WifiOff className="w-3.5 h-3.5" />
            </span>
          )}

          <button 
            onClick={() => onPageChange('SYNC_DESK')}
            className={`w-8 h-8 font-bold text-[10px] cursor-pointer outline-none border ${
              pendingCount > 0 
                ? 'bg-orange-600 text-white border-orange-700'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
            title="Open Sync Desk"
          >
            {pendingCount}
          </button>
        </div>

        {session && onSignOut && (
          <button
            onClick={onSignOut}
            className="bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800 hover:border-rose-500 text-rose-200 w-8 h-8 transition-colors cursor-pointer flex items-center justify-center shrink-0"
            title="Switch Operator Staff Member"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-400" />
          </button>
        )}

      </div>
    </header>
  );
}
