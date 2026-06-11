import { useEffect, useMemo, useState } from 'react';
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
  BriefcaseBusiness
} from 'lucide-react';
import { POSFeatureEntitlement, POSFeatureKey, PosPageId, PosSession } from '../types';
import { getPOSFeatureEntitlements } from '../services/posEntitlementService';

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
  const [entitlements, setEntitlements] = useState<POSFeatureEntitlement[]>([]);
  const [planMessage, setPlanMessage] = useState<string | null>(null);

  useEffect(() => {
    const vendorId = session?.vendor === 'SCI Logistics Ltd' ? 'SCI-LOG-ZW' : session?.vendor || 'SCI-LOG-ZW';
    void getPOSFeatureEntitlements(vendorId).then(setEntitlements);
  }, [session?.vendor]);

  const entitlementByFeature = useMemo(() => {
    return entitlements.reduce<Partial<Record<POSFeatureKey, POSFeatureEntitlement>>>((acc, entitlement) => {
      acc[entitlement.featureKey] = entitlement;
      return acc;
    }, {});
  }, [entitlements]);

  const showPlanMessage = () => {
    setPlanMessage('Feature access is controlled by local role permissions during build-development.');
    setTimeout(() => setPlanMessage(null), 4500);
  };
  
  // Custom navigation items representing the requested lists
  const navigationItems = [
    { id: 'DASHBOARD' as const, label: 'Dashboard', icon: Monitor },
    { id: 'OWNER_DESK' as const, label: 'Owner Desk', icon: BriefcaseBusiness, feature: 'OWNER_DESK' as POSFeatureKey },
    { id: 'SALES' as const, label: 'Sales Terminal', icon: Terminal, actionHighlight: true, feature: 'SALES_TERMINAL' as POSFeatureKey },
    { id: 'DELIVERY' as const, label: 'Delivery Desk', icon: Truck, feature: 'DELIVERY_DESK' as POSFeatureKey },
    { id: 'STOCK' as const, label: 'Stock Control', icon: Box, feature: 'STOCK_CONTROL' as POSFeatureKey },
    { id: 'SHIFT' as const, label: 'Shift Control', icon: Clock, feature: 'SHIFT_CONTROL' as POSFeatureKey },
    { id: 'CASH' as const, label: 'Cash Control', icon: DollarSign, feature: 'CASH_CONTROL' as POSFeatureKey },
    { id: 'BI_DESK' as const, label: 'BI Desk', icon: BarChart2, feature: 'BI_DESK' as POSFeatureKey },
    { id: 'SYNC_DESK' as const, label: 'Sync Desk', icon: RefreshCw, feature: 'SYNC_DESK' as POSFeatureKey },
    { id: 'SETTINGS' as const, label: 'Settings', icon: Settings, feature: 'SETTINGS' as POSFeatureKey },
  ].filter(item => !allowedPages || allowedPages.includes(item.id));


  return (
    <aside id="pos-sidebar-root" className="w-64 bg-slate-950 border-r border-slate-800 text-slate-300 flex flex-col justify-between h-screen shrink-0 relative select-none font-mono">
      <div>
        
        {/* Brand/Hardware Console title */}
        <div className="p-4 border-b border-slate-800 flex items-center gap-2.5 bg-slate-900/40">
          <Layers className="w-5 h-5 text-[#00f0ff] animate-pulse" />
          <div>
            <div className="font-extrabold text-sm text-slate-100 tracking-wider">iTredPOS v4.2</div>
            <div className="text-[9px] text-[#00f0ff] uppercase tracking-widest font-bold leading-none">Industrial OS Core</div>
          </div>
        </div>

        {/* Dynamic operator diagnostic panel */}
        <div className="p-3 bg-slate-950 border-b border-slate-900 text-[10px] space-y-2">
          {session ? (
            <div className="space-y-1.5 border border-slate-800 bg-slate-900/30 p-2 font-mono">
              <div className="text-[9px] text-amber-500 font-bold uppercase tracking-wider">ACTIVE CONFIG:</div>
              <div className="flex justify-between items-center text-slate-500">
                <span>VNDR:</span>
                <span className="text-[#00f0ff] font-bold truncate max-w-[130px]" title={session.vendor}>{session.vendor}</span>
              </div>
              <div className="flex justify-between items-center text-slate-500">
                <span>BRCH:</span>
                <span className="text-slate-300 font-bold truncate max-w-[130px]" title={session.branch}>{session.branch}</span>
              </div>
              <div className="flex justify-between items-center text-slate-500">
                <span>TERM:</span>
                <span className="text-amber-500 font-bold truncate max-w-[130px]" title={session.terminal}>{session.terminal}</span>
              </div>
              <div className="flex justify-between items-center text-slate-500">
                <span>CLERK:</span>
                <span className="text-emerald-400 font-bold" title={`${session.staffName} [${session.role}]`}>{session.staffName}</span>
              </div>
              <div className="flex justify-between items-center text-slate-500">
                <span>ROLE:</span>
                <span className="text-amber-600 font-bold text-[9px]">{session.role}</span>
              </div>
            </div>
          ) : (
            <div className="flex justify-between items-center text-slate-500">
              <span>OPERATOR SIGNATURE:</span>
              <span className="text-[#00f0ff] font-bold">{operatorName || "SYS_ADMIN"}</span>
            </div>
          )}
          
          <div className="flex justify-between items-center text-slate-500">
            <span>SHIFT HARDWARE GATE:</span>
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
            OPERATIONAL COMMANDS:
          </div>

          <div className="space-y-0.5">
            {planMessage && (
              <div className="mb-2 border border-orange-500/60 bg-orange-950/30 px-2 py-2 text-[9px] leading-snug text-orange-200 font-bold uppercase">
                {planMessage}
              </div>
            )}
            {navigationItems.map(item => {
              const IconComp = item.icon;
              const isActive = activePage === item.id;
              const entitlement = item.feature ? entitlementByFeature[item.feature] : null;
              // During build-development, Owner has full access. Plan-based feature enforcement will be implemented later from the internal iTredVD Console backend.
              const isPlanDisabled = false;

              return (
                <button
                  id={`nav-item-${item.id.toLowerCase()}`}
                  key={item.id}
                  onClick={() => {
                    if (isPlanDisabled) {
                      showPlanMessage();
                      return;
                    }
                    onPageChange(item.id);
                  }}
                  className={`w-full text-left py-2.5 px-3 flex items-center gap-3 transition-colors text-xs rounded-none border-l-2 outline-none cursor-pointer ${
                    isPlanDisabled
                      ? 'border-transparent text-slate-600 bg-slate-950/60 cursor-not-allowed'
                      : isActive 
                      ? 'bg-slate-900 text-[#00f0ff] font-bold border-[#00f0ff]' 
                      : 'border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-900/60'
                  }`}
                >
                  <IconComp className={`w-4 h-4 shrink-0 ${isPlanDisabled ? 'text-slate-700' : isActive ? 'text-[#00f0ff]' : 'text-slate-500'}`} />
                  <span className="flex-1 truncate uppercase tracking-wide">{item.label}</span>
                  {isPlanDisabled && entitlement && (
                    <span className="text-[7px] border border-slate-700 px-1 py-0.5 text-slate-500 uppercase">
                      {entitlement.status}
                    </span>
                  )}
                  
                  {/* Active flashing LED dots */}
                  {isActive && !isPlanDisabled && (
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
          <span>LASER: CALIBRATED (CCD-B2)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 bg-slate-500 rounded-none shrink-0"></span>
          <span>NET BYPASS: OFFLINE LOCK_ON</span>
        </div>
        
        {/* Simple sign-out action (back to dashboard fallback) and Disconnect router */}
        <div className="pt-2 border-t border-slate-900 space-y-2">
          {session && onSignOut && (
            <button 
              onClick={onSignOut}
              className="w-full text-[10px] text-rose-400 hover:text-rose-300 uppercase transition-colors flex items-center gap-1.5 cursor-pointer outline-none font-bold"
            >
              <LogOut className="w-3 h-3 text-rose-500" />
              Sign Out Staff Identity
            </button>
          )}

          <button 
            onClick={() => onPageChange('DASHBOARD')}
            className="w-full text-[10px] text-slate-500 hover:text-white uppercase transition-colors flex items-center gap-1.5 cursor-pointer outline-none"
          >
            <LogOut className="w-3 h-3 text-slate-600" />
            Reset Seats / Dash
          </button>
          
          <button 
            onClick={() => {
              window.history.pushState({}, '', '/');
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
            className="w-full text-[10px] text-amber-500/80 hover:text-amber-400 uppercase transition-colors flex items-center gap-1.5 cursor-pointer outline-none"
          >
            <Lock className="w-3 h-3 text-amber-600" />
            Exit Terminal Gateway
          </button>
        </div>
      </div>
    </aside>
  );
}
