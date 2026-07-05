import { useState, useEffect } from 'react';
import PosPrototypeApp from './pos-new/PosPrototypeApp';
import PosVendorAuthGate from './pos-new/auth/PosVendorAuthGate';
import FirebaseReadinessPage from './platform/FirebaseReadinessPage';
import VendorVerificationQueuePage from './platform/VendorVerificationQueuePage';
import PricingPlansManagerPage from './platform/PricingPlansManagerPage';
import ActivationTokenManagerPage from './platform/ActivationTokenManagerPage';
import PaymentRenewalPage from './platform/PaymentRenewalPage';
import VendorSyncMonitorPage from './platform/VendorSyncMonitorPage';
import { Cpu, ShieldCheck, Power, RefreshCw } from 'lucide-react';

export default function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [biosProgress, setBiosProgress] = useState(0);
  const [bootLog, setBootLog] = useState<string[]>([]);

  // Listen to window location modifications
  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  // BIOS boot simulation on standard loading
  useEffect(() => {
    if (currentPath !== '/pos-prototype') {
      const logs = [
        "INITIALIZING CORE SYSTEM BOOT STRAPRAP v4.18...",
        "CPU INTEL CORE-OS HARDWARE: STATUS OK",
        "RAM DIAGNOSTIC MEMORY CHUNKS: 16384 MB SECTOR OK",
        "PCI SOLENOID ADAPTER INTERFACE ENERGIZED (12VDC/24VDC)",
        "PROXIMITY BARCODE CHIPS CALIBRATION MATCHED (650NM RED)",
        "HDD WRITE TEST SECTORS SYNCE: OK (100% HEALTH)",
        "MOUNTING NVRAM DATABASE /LOCAL_BYPASS CACHE DIRECTORIES...",
        "DECRYPTING LOCAL DATA ASSETS: SEED DATA INTEGRITY READY",
        "STANDBY FOR COMMAND EXECUTION GATES..."
      ];

      let currentIndex = 0;
      const interval = setInterval(() => {
        if (currentIndex < logs.length) {
          setBootLog(prev => [...prev, logs[currentIndex]]);
          setBiosProgress(prev => Math.min(100, Math.floor(((currentIndex + 1) / logs.length) * 100)));
          currentIndex++;
        } else {
          clearInterval(interval);
        }
      }, 180);

      return () => clearInterval(interval);
    }
  }, [currentPath]);

  const handleRouteToPos = () => {
    // Coordinate HTML5 History state push
    window.history.pushState({}, '', '/pos-prototype');
    setCurrentPath('/pos-prototype');
  };

  // If path is indeed /pos-prototype, mount our primary modern shell application
  if (currentPath === '/pos-prototype') {
    return (
      <PosVendorAuthGate>
        <PosPrototypeApp />
      </PosVendorAuthGate>
    );
  }

  if (currentPath === '/platform/firebase-readiness') {
    return <FirebaseReadinessPage />;
  }

  if (currentPath === '/platform/vendor-verification') {
    return <VendorVerificationQueuePage />;
  }

  if (currentPath === '/platform/pricing-plans') {
    return <PricingPlansManagerPage />;
  }

  if (currentPath === '/platform/activation-tokens') {
    return <ActivationTokenManagerPage />;
  }

  if (currentPath === '/platform/payment-renewals') {
    return <PaymentRenewalPage />;
  }

  if (currentPath === '/platform/vendor-sync-monitor') {
    return <VendorSyncMonitorPage />;
  }

  // Otherwise, render an elegant mechanical industrial loader BIOS
  return (
    <div className="h-screen w-screen bg-[#07090d] text-slate-300 flex flex-col justify-between items-center p-6 md:p-12 font-mono select-none relative overflow-hidden text-xs">
      {/* Heavy Scanline texture */}
      <div className="absolute inset-0 bg-slate-950/40 pointer-events-none z-10 scan-pulse"></div>

      {/* BIOS Header */}
      <div className="w-full max-w-3xl border border-slate-800 bg-[#0f131a] p-4 flex justify-between items-center uppercase text-[10px] text-slate-500">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-amber-500 animate-spin" style={{ animationDuration: '6s' }} />
          <span>MOTHERBOARD SYSTEM BIOS: T-09_NCORE</span>
        </div>
        <div>TEMP: 38.5°C</div>
      </div>

      {/* Main Terminal Screen log */}
      <div className="w-full max-w-3xl flex-1 my-6 bg-slate-950 border border-slate-800 p-6 flex flex-col justify-between overflow-hidden relative">
        <div className="space-y-2 text-[11px]">
          {bootLog.map((log, i) => (
            <div key={i} className="flex gap-3 text-slate-300 text-left">
              <span className="text-slate-600">[{1000 + i * 24}]</span>
              <span className={i === bootLog.length - 1 ? 'text-[#00f0ff] font-bold animate-pulse' : ''}>
                {log}
              </span>
            </div>
          ))}

          {/* Blink cursor */}
          {biosProgress === 100 && (
            <div className="text-amber-500 font-bold mt-4 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>DIAGNOSTIC MEMORIES: SECURE. STANDBY_READY FOR POS TERMINAL INTERACTION.</span>
            </div>
          )}
        </div>

        {/* Progress block */}
        <div className="mt-8 space-y-2">
          <div className="flex justify-between items-center text-[10px] text-slate-500">
            <span>REGISTERING MODULE SYMBOLS...</span>
            <span className="text-amber-500 font-bold">{biosProgress}%</span>
          </div>
          <div className="w-full h-2 bg-slate-900 border border-slate-800">
            <div 
              className="bg-amber-500 h-full transition-all duration-300"
              style={{ width: `${biosProgress}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Boot actions footer */}
      <div className="w-full max-w-3xl flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="text-slate-600 text-[10px] leading-tight text-center md:text-left">
          BYPASS REGISTER CORES • FORWARD ALL SOLENIOD TRAFFIC VIA LOOP GATE 24V<br />
          MANUAL ENTRYPOINT: ACCELERATED IP-FRAME PATH /POS-PROTOTYPE
        </div>

        {biosProgress === 100 ? (
          <div className="flex">
            <button
              onClick={handleRouteToPos}
              className="bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-black tracking-widest uppercase px-8 py-4 border border-amber-400 transition-colors rounded-none flex items-center gap-3 animate-pulse cursor-pointer shadow-lg shadow-amber-500/10"
            >
              <Power className="w-5 h-5 text-slate-950" />
              Boot Pos Terminal Gate
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={handleRouteToPos}
              className="px-4 py-2 border border-slate-700 hover:border-amber-500 text-slate-500 hover:text-amber-500 bg-slate-950 hover:bg-slate-900 transition-all font-bold text-[10px] tracking-wide uppercase cursor-pointer"
            >
              Boot Pos Terminal Gate
            </button>
            <div className="text-slate-500 uppercase tracking-widest font-bold text-[10px] py-4 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Warming Cores...
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
