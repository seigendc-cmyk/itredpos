import { 
  Terminal, 
  Box, 
  Clock, 
  DollarSign, 
  BarChart2, 
  Settings, 
  Monitor, 
  LogOut,
  Layers,
  Lock,
  Truck,
  RefreshCw,
  BriefcaseBusiness,
  ClipboardCheck,
  History,
  ListChecks,
  Users
} from 'lucide-react';
import { PosPageId, PosSession } from '../types';

interface PosSidebarProps {
  activePage: PosPageId;
  onPageChange: (pageId: PosPageId) => void;
  operatorName: string;
  activeShiftStatus: 'ACTIVE' | 'CLOSED';
  session?: PosSession;
  onSignOut?: () => void;
  allowedPages?: PosPageId[];
}

export default function PosSidebar({
  activePage,
  onPageChange,
  operatorName,
  activeShiftStatus,
  session,
  onSignOut,
  allowedPages
}: PosSidebarProps) {
  const navigationItems = [
    { id: 'DASHBOARD' as const, label: 'Dashboard', icon: Monitor },
    { id: 'OWNER_DESK' as const, label: 'Owner Desk', icon: BriefcaseBusiness },
    { id: 'SALES' as const, label: 'Sales Terminal', icon: Terminal },
    { id: 'SALES_HISTORY' as const, label: 'Sales History', icon: History },
    { id: 'CUSTOMER_CENTRE' as const, label: 'Customer Centre', icon: Users },
    { id: 'DELIVERY' as const, label: 'Delivery Desk', icon: Truck },
    { id: 'STOCK' as const, label: 'Inventory', icon: Box },
    { id: 'TASK_DESK' as const, label: 'Task Desk', icon: ListChecks },
    { id: 'APPROVALS' as const, label: 'Approvals', icon: ClipboardCheck },
    { id: 'SHIFT' as const, label: 'Shift Control', icon: Clock },
    { id: 'CASH' as const, label: 'Cash Control', icon: DollarSign },
    { id: 'BI_DESK' as const, label: 'BI Desk', icon: BarChart2 },
    { id: 'SYNC_DESK' as const, label: 'Sync Desk', icon: RefreshCw },
    { id: 'SETTINGS' as const, label: 'Settings', icon: Settings },
  ].filter(item => !allowedPages || allowedPages.includes(item.id));


  return (
    <aside id="pos-sidebar-root" className="w-64 bg-slate-950 border-r border-slate-800 text-slate-300 flex flex-col justify-between h-screen shrink-0 relative select-none font-mono">
      <div>
        
        {/* Brand title */}
        <div className="p-4 border-b border-slate-800 flex items-center gap-2.5 bg-slate-900/40">
          <Layers className="w-5 h-5 text-[#00f0ff] animate-pulse" />
          <div>
            <div className="font-extrabold text-sm text-slate-100 tracking-wider">iTred Commerce POS</div>
            <div className="text-[9px] text-orange-400 uppercase tracking-widest font-bold leading-none">Vendor Commerce Terminal</div>
          </div>
        </div>

        {/* Dynamic operator diagnostic panel */}
        <div className="p-3 bg-slate-950 border-b border-slate-900 text-[10px] space-y-2">
          {session ? (
            <div className="space-y-1.5 border border-slate-800 bg-slate-900/30 p-2 font-mono">
              <div className="text-[9px] text-orange-300 font-bold uppercase tracking-wider">Active Session</div>
              <div className="flex justify-between items-center text-slate-500">
                <span>Vendor:</span>
                <span className="text-[#00f0ff] font-bold truncate max-w-[130px]" title={session.vendor}>{session.vendor}</span>
              </div>
              <div className="flex justify-between items-center text-slate-500">
                <span>Branch:</span>
                <span className="text-slate-300 font-bold truncate max-w-[130px]" title={session.branch}>{session.branch}</span>
              </div>
              <div className="flex justify-between items-center text-slate-500">
                <span>Terminal:</span>
                <span className="text-amber-500 font-bold truncate max-w-[130px]" title={session.terminal}>{session.terminal}</span>
              </div>
              <div className="flex justify-between items-center text-slate-500">
                <span>Staff:</span>
                <span className="text-emerald-400 font-bold" title={`${session.staffName} [${session.role}]`}>{session.staffName}</span>
              </div>
              <div className="flex justify-between items-center text-slate-500">
                <span>ROLE:</span>
                <span className="text-amber-600 font-bold text-[9px]">{session.role}</span>
              </div>
            </div>
          ) : (
            <div className="flex justify-between items-center text-slate-500">
            <span>Operator:</span>
              <span className="text-[#00f0ff] font-bold">{operatorName || "SYS_ADMIN"}</span>
            </div>
          )}
          
          <div className="flex justify-between items-center text-slate-500">
            <span>Shift Device Status:</span>
            <span className={`font-bold flex items-center gap-1 ${
              activeShiftStatus === 'ACTIVE' ? 'text-emerald-400' : 'text-rose-500'
            }`}>
              {activeShiftStatus === 'ACTIVE' ? 'LIVE' : 'LOCKED'}
            </span>
          </div>
        </div>

        {/* Menu list */}
        <nav className="p-2 space-y-1">
          <div className="text-[9px] text-slate-600 font-bold px-2 py-1.5 uppercase tracking-wider">
            Main Menu
          </div>

          <div className="space-y-0.5">
            {navigationItems.map(item => {
              const IconComp = item.icon;
              const isActive = activePage === item.id;

              return (
                <button
                  id={`nav-item-${item.id.toLowerCase()}`}
                  key={item.id}
                  onClick={() => onPageChange(item.id)}
                  className={`w-full text-left py-2.5 px-3 flex items-center gap-3 transition-colors text-xs rounded-none border-l-2 outline-none cursor-pointer ${
                    isActive 
                      ? 'bg-slate-900 text-[#00f0ff] font-bold border-[#00f0ff]' 
                      : 'border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-900/60'
                  }`}
                >
                  <IconComp className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#00f0ff]' : 'text-slate-500'}`} />
                  <span className="flex-1 truncate uppercase tracking-wide">{item.label}</span>
                  
                  {/* Active flashing LED dots */}
                  {isActive && (
                    <span className="w-1.5 h-1.5 bg-[#00f0ff] animate-pulse"></span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      {/* Footer warning logs inside sidebar */}
      <div className="p-4 border-t border-slate-900 bg-slate-900/10 text-[9px] text-slate-500 space-y-1.5 font-mono">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 bg-emerald-500 rounded-none shrink-0"></span>
          <span>TERMINAL DEVICES: READY</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 bg-slate-500 rounded-none shrink-0"></span>
          <span>BACKEND: MOCK / LOCAL SERVICES</span>
        </div>
        
        {/* Simple sign-out action (back to dashboard fallback) and Disconnect router */}
        <div className="pt-2 border-t border-slate-900 space-y-2">
          {session && onSignOut && (
            <button 
              onClick={onSignOut}
              className="w-full text-[10px] text-rose-400 hover:text-rose-300 uppercase transition-colors flex items-center gap-1.5 cursor-pointer outline-none font-bold"
            >
              <LogOut className="w-3 h-3 text-rose-500" />
              Switch Staff
            </button>
          )}

          <button 
            onClick={() => onPageChange('DASHBOARD')}
            className="w-full text-[10px] text-slate-500 hover:text-white uppercase transition-colors flex items-center gap-1.5 cursor-pointer outline-none"
          >
            <LogOut className="w-3 h-3 text-slate-600" />
            Return to Dashboard
          </button>
          
          <button 
            onClick={() => {
              window.history.pushState({}, '', '/');
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
            className="w-full text-[10px] text-amber-500/80 hover:text-amber-400 uppercase transition-colors flex items-center gap-1.5 cursor-pointer outline-none"
          >
            <Lock className="w-3 h-3 text-amber-600" />
            Exit Terminal
          </button>
        </div>
      </div>
    </aside>
  );
}
