import type React from 'react';
import { Maximize2, Minus, Square, X } from 'lucide-react';
import { useState } from 'react';

interface A5FloatingFormProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
}

type WindowState = 'normal' | 'minimized' | 'maximized';

export default function A5FloatingForm({ title, open, onClose, children, footer }: A5FloatingFormProps) {
  const [windowState, setWindowState] = useState<WindowState>('normal');

  if (!open) return null;

  const sizeClass = windowState === 'maximized'
    ? 'w-[calc(100vw-48px)] h-[calc(100vh-48px)]'
    : windowState === 'minimized'
    ? 'w-[420px] h-[46px]'
    : 'w-[560px] max-w-[calc(100vw-32px)] h-[790px] max-h-[calc(100vh-32px)]';

  return (
    <div className="fixed inset-0 z-[1200] pointer-events-none flex items-center justify-center p-4">
      <div className={`${sizeClass} pointer-events-auto bg-white border-2 border-[#1e222b] shadow-2xl flex flex-col rounded-none overflow-hidden`}>
        <div className="h-11 bg-[#1e222b] text-white border-b-2 border-orange-500 px-4 flex items-center justify-between shrink-0">
          <span className="font-black uppercase text-[10px] tracking-wider">{title}</span>
          <div className="flex items-center gap-1">
            <button type="button" title="Minimize" onClick={() => setWindowState('minimized')} className="p-1 border border-slate-700 hover:bg-slate-800">
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button type="button" title="Restore" onClick={() => setWindowState('normal')} className="p-1 border border-slate-700 hover:bg-slate-800">
              <Square className="w-3.5 h-3.5" />
            </button>
            <button type="button" title="Maximize" onClick={() => setWindowState('maximized')} className="p-1 border border-slate-700 hover:bg-slate-800">
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button type="button" title="Close" onClick={onClose} className="p-1 border border-slate-700 hover:bg-rose-900 text-rose-200">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        {windowState !== 'minimized' && (
          <>
            <div className="flex-1 overflow-y-auto p-5 bg-white text-[#1e222b]">
              {children}
            </div>
            <div className="shrink-0 bg-slate-50 border-t border-[#b1b5c2] p-4">
              {footer}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
