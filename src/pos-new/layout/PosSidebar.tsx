import { FocusEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart2,
  Box,
  BriefcaseBusiness,
  ChevronDown,
  ClipboardCheck,
  Clock,
  DollarSign,
  FileBarChart,
  History,
  HelpCircle,
  Landmark,
  Layers,
  ListChecks,
  Lock,
  LogOut,
  Monitor,
  RefreshCw,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Store,
  Terminal,
  Truck,
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

type SidebarGroupId = 'operations' | 'stock' | 'control' | 'reports' | 'finance' | 'system';
type SidebarNavItem = { id: PosPageId; label: string; icon: typeof Monitor };
type SidebarGroup = { id: SidebarGroupId; label: string; icon: typeof Monitor; items: SidebarNavItem[] };

const sidebarGroups: SidebarGroup[] = [
  {
    id: 'operations',
    label: 'Operations',
    icon: Store,
    items: [
      { id: 'DASHBOARD', label: 'Dashboard', icon: Monitor },
      { id: 'SALES', label: 'Sales terminal', icon: Terminal },
      { id: 'SALES_HISTORY', label: 'Sales history', icon: History },
      { id: 'CUSTOMER_CENTRE', label: 'Customer centre', icon: Users },
      { id: 'DELIVERY', label: 'Delivery desk', icon: Truck }
    ]
  },
  {
    id: 'stock',
    label: 'Stock and purchasing',
    icon: Box,
    items: [
      { id: 'STOCK', label: 'Inventory', icon: Box },
      { id: 'PURCHASE_DISCIPLINE', label: 'Purchasing discipline', icon: ShoppingCart },
      { id: 'CREDITORS', label: 'Creditors', icon: Landmark }
    ]
  },
  {
    id: 'control',
    label: 'Control desk',
    icon: ShieldCheck,
    items: [
      { id: 'TASK_DESK', label: 'Task desk', icon: ListChecks },
      { id: 'APPROVALS', label: 'Approvals', icon: ClipboardCheck },
      { id: 'SHIFT', label: 'Shift control', icon: Clock },
      { id: 'CASH', label: 'Cash control', icon: DollarSign }
    ]
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: Landmark,
    items: [
      { id: 'FINANCIAL_CONTROL', label: 'Financial control', icon: Landmark },
      { id: 'OWNER_DESK', label: 'Owner desk', icon: BriefcaseBusiness }
    ]
  },
  {
    id: 'reports',
    label: 'REPORTS',
    icon: FileBarChart,
    items: [
      { id: 'REPORTS', label: 'Reports', icon: FileBarChart }
    ]
  },
  {
    id: 'system',
    label: 'Intelligence and system',
    icon: BarChart2,
    items: [
      { id: 'BI_DESK', label: 'BI Layer', icon: BarChart2 },
      { id: 'SYNC_DESK', label: 'Sync desk', icon: RefreshCw },
      { id: 'HELP_DESK', label: 'Help desk', icon: HelpCircle },
      { id: 'SETTINGS', label: 'Settings', icon: Settings }
    ]
  }
];

export default function PosSidebar({
  activePage,
  onPageChange,
  operatorName,
  activeShiftStatus,
  session,
  onSignOut,
  allowedPages
}: PosSidebarProps) {
  const sidebarRef = useRef<HTMLElement | null>(null);
  const [openGroupId, setOpenGroupId] = useState<SidebarGroupId | null>(null);

  const visibleGroups = useMemo(() => {
    const allowed = allowedPages ? new Set(allowedPages) : null;
    return sidebarGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => !allowed || allowed.has(item.id))
      }))
      .filter((group) => group.items.length > 0);
  }, [allowedPages]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!openGroupId) return;
      if (sidebarRef.current?.contains(event.target as Node)) return;
      setOpenGroupId(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenGroupId(null);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openGroupId]);

  const handleBlur = (event: FocusEvent<HTMLElement>) => {
    const nextTarget = event.relatedTarget as Node | null;
    if (nextTarget && event.currentTarget.contains(nextTarget)) return;
    setOpenGroupId(null);
  };

  const selectPage = (pageId: PosPageId) => {
    onPageChange(pageId);
    setOpenGroupId(null);
  };

  return (
    <aside
      id="pos-sidebar-root"
      ref={sidebarRef}
      onBlur={handleBlur}
      className="w-64 bg-slate-950 border-r border-slate-800 text-slate-300 flex flex-col h-screen shrink-0 relative select-none font-mono"
    >
      {/* Brand title */}
      <div className="p-4 border-b border-slate-800 flex items-center gap-2.5 bg-slate-900/40 shrink-0">
        <Layers className="w-5 h-5 text-orange-400" />
        <div className="min-w-0">
          <div className="font-extrabold text-sm text-orange-300 tracking-wider truncate">iTred Commerce OS</div>
          <div className="text-[9px] text-orange-500 font-bold leading-none truncate">Marketplace ready</div>
        </div>
      </div>

      {/* Dynamic operator diagnostic panel */}
      <div className="p-3 bg-slate-950 border-b border-slate-900 text-[10px] space-y-2 shrink-0">
        {session ? (
          <div className="space-y-1.5 border border-slate-800 bg-slate-900/30 p-2 font-mono">
            <div className="text-[9px] text-orange-300 font-bold tracking-wider">Active session</div>
            <div className="flex justify-between items-center text-slate-500 gap-2">
              <span>Vendor:</span>
              <span className="text-orange-300 font-bold truncate max-w-[130px]" title={session.vendor}>{session.vendor}</span>
            </div>
            <div className="flex justify-between items-center text-slate-500 gap-2">
              <span>Branch:</span>
              <span className="text-slate-300 font-bold truncate max-w-[130px]" title={session.branch}>{session.branch}</span>
            </div>
            <div className="flex justify-between items-center text-slate-500 gap-2">
              <span>Terminal:</span>
              <span className="text-amber-500 font-bold truncate max-w-[130px]" title={session.terminal}>{session.terminal}</span>
            </div>
            <div className="flex justify-between items-center text-slate-500 gap-2">
              <span>Staff:</span>
              <span className="text-emerald-400 font-bold truncate max-w-[130px]" title={`${session.staffName} [${session.role}]`}>{session.staffName}</span>
            </div>
            <div className="flex justify-between items-center text-slate-500 gap-2">
              <span>Role:</span>
              <span className="text-amber-600 font-bold text-[9px] truncate max-w-[130px]">{session.role}</span>
            </div>
          </div>
        ) : (
          <div className="flex justify-between items-center text-slate-500 gap-2">
            <span>Operator:</span>
            <span className="text-orange-300 font-bold truncate">{operatorName || 'SYS_ADMIN'}</span>
          </div>
        )}

        <div className="flex justify-between items-center text-slate-500 gap-2">
          <span>Shift Device Status:</span>
          <span className={`font-bold flex items-center gap-1 ${
            activeShiftStatus === 'ACTIVE' ? 'text-emerald-400' : 'text-rose-500'
          }`}>
            {activeShiftStatus === 'ACTIVE' ? 'LIVE' : 'LOCKED'}
          </span>
        </div>
      </div>

      {/* Menu list */}
      <nav className="pos-sidebar-menu p-2 space-y-1 flex-1 min-h-0 overflow-y-auto pos-custom-scroll" aria-label="POS navigation">
        <div className="text-[9px] text-slate-500 font-bold px-2 py-1.5 uppercase tracking-wider">
          Main menu
        </div>

        <div className="space-y-1">
          {visibleGroups.map((group) => {
            const GroupIcon = group.icon;
            const isOpen = openGroupId === group.id;
            const isGroupActive = group.items.some((item) => item.id === activePage);

            return (
              <section
                key={group.id}
                className={`pos-sidebar-group ${isOpen ? 'pos-sidebar-group-open' : ''} ${isGroupActive ? 'pos-sidebar-group-active' : ''}`}
              >
                <button
                  type="button"
                  className="pos-sidebar-group-header"
                  aria-expanded={isOpen}
                  aria-controls={`sidebar-submenu-${group.id}`}
                  onClick={() => setOpenGroupId((current) => current === group.id ? null : group.id)}
                >
                  <GroupIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span className="pos-sidebar-group-label">{group.label}</span>
                  {isGroupActive && <span className="pos-sidebar-active-marker" aria-label="Active group" />}
                  <ChevronDown className="pos-sidebar-chevron w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                </button>

                {isOpen && (
                  <div id={`sidebar-submenu-${group.id}`} className="pos-sidebar-submenu">
                    {group.items.map((item) => {
                      const ItemIcon = item.icon;
                      const isActive = activePage === item.id;

                      return (
                        <button
                          id={`nav-item-${item.id.toLowerCase()}`}
                          key={item.id}
                          type="button"
                          onClick={() => selectPage(item.id)}
                          className={`pos-sidebar-subitem ${isActive ? 'pos-sidebar-subitem-active' : ''}`}
                        >
                          <ItemIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </nav>

      {/* Footer warning logs inside sidebar */}
      <div className="p-4 border-t border-slate-900 bg-slate-900/10 text-[9px] text-slate-500 space-y-1.5 font-mono shrink-0">
        <div className="flex items-center gap-1.5">
          <span className={`inline-block w-1.5 h-1.5 rounded-none shrink-0 ${activeShiftStatus === 'ACTIVE' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
          <span className={activeShiftStatus === 'ACTIVE' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
            Terminal devices: {activeShiftStatus === 'ACTIVE' ? 'READY' : 'NOT READY'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 bg-orange-500 rounded-none shrink-0"></span>
          <span className="text-orange-300 font-bold">Marketplace Ready</span>
        </div>

        <div className="pt-2 border-t border-slate-900 space-y-2">
          {session && onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              className="w-full text-[10px] text-rose-400 hover:text-rose-300 uppercase transition-colors flex items-center gap-1.5 cursor-pointer outline-none font-bold"
            >
              <LogOut className="w-3 h-3 text-rose-500" />
              Switch Staff
            </button>
          )}

          <button
            type="button"
            onClick={() => selectPage('DASHBOARD')}
            className="w-full text-[10px] text-slate-500 hover:text-white uppercase transition-colors flex items-center gap-1.5 cursor-pointer outline-none"
          >
            <LogOut className="w-3 h-3 text-slate-600" />
            Return to Dashboard
          </button>

          <button
            type="button"
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
