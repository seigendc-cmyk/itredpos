import React, { useState } from 'react';
import PosSidebar from './PosSidebar';
import PosTopbar from './PosTopbar';
import { PosPageId, PosSession } from '../types';
import { Menu, X } from 'lucide-react';

interface PosShellProps {
  children: React.ReactNode;
  activePage: PosPageId;
  onPageChange: (pageId: PosPageId) => void;
  terminalId: string;
  activeOperator: string;
  activeShiftStatus: 'ACTIVE' | 'CLOSED';
  activeSession?: PosSession;
  onSignOut?: () => void;
  allowedPages?: PosPageId[];
}

export default function PosShell({
  children,
  activePage,
  onPageChange,
  terminalId,
  activeOperator,
  activeShiftStatus,
  activeSession,
  onSignOut,
  allowedPages
}: PosShellProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Auto-redirect to Dashboard if the active page becomes disallowed
  React.useEffect(() => {
    if (allowedPages && !allowedPages.includes(activePage)) {
      onPageChange('DASHBOARD');
    }
  }, [allowedPages, activePage, onPageChange]);

  // Simple page toggle callbacks to auto-close drawer on mobile
  const handlePageSelect = (pageId: PosPageId) => {
    onPageChange(pageId);
    setMobileSidebarOpen(false);
  };

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-[#0c0e12] text-slate-100 select-none terminal-overlay uppercase">
      {/* Background static scanner grid glow inside workspace */}
      <div className="absolute inset-0 bg-slate-950/20 scan-pulse pointer-events-none z-[1]"></div>

      {/* MOBILE TRIGGER RAILS */}
      <div className="xl:hidden bg-slate-900 border-b border-slate-800 h-12 w-full flex items-center justify-between px-3 absolute top-0 left-0 z-30">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            className="text-slate-300 hover:text-white p-1 bg-slate-950 border border-slate-800 outline-none rounded-none cursor-pointer"
          >
            {mobileSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <span className="w-2 h-2 bg-orange-500 block" title="POS workspace"></span>
        </div>
      </div>

      {/* DESKTOP SIDEBAR PANEL (Permanent leftmost column) */}
      <div className="hidden xl:block z-10">
        <PosSidebar 
          activePage={activePage}
          onPageChange={handlePageSelect}
          operatorName={activeOperator}
          activeShiftStatus={activeShiftStatus}
          session={activeSession}
          onSignOut={onSignOut}
          allowedPages={allowedPages}
        />
      </div>

      {/* MOBILE SIDEBAR MODAL SYSTEM */}
      {mobileSidebarOpen && (
        <div className="xl:hidden fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-64 h-full">
            <PosSidebar 
              activePage={activePage}
              onPageChange={handlePageSelect}
              operatorName={activeOperator}
              activeShiftStatus={activeShiftStatus}
              session={activeSession}
              onSignOut={onSignOut}
              allowedPages={allowedPages}
            />
          </div>
          {/* backdrop click closes drawer */}
          <div className="absolute inset-0 -z-10" onClick={() => setMobileSidebarOpen(false)}></div>
        </div>
      )}

      {/* RIGHTMOST CONTENT SECTION (Workspace) */}
      <div className="flex-1 flex flex-col min-w-0 pt-12 xl:pt-0 z-[2]">
        
        {/* TOP COMMAND BAR */}
        <PosTopbar 
          terminalId={terminalId}
          activeOperator={activeOperator}
          activeShiftStatus={activeShiftStatus}
          activePage={activePage}
          onPageChange={handlePageSelect}
          session={activeSession}
          onSignOut={onSignOut}
        />

        {/* MAIN OPERATIONS WORKSPACE PANEL */}
        <main className="flex-1 overflow-y-auto px-4 py-6 md:p-6 lg:p-8 pos-custom-scroll">
          <div className="max-w-7xl mx-auto h-full">
            {children}
          </div>
        </main>
      </div>

    </div>
  );
}
