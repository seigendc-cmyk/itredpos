import { useState, FormEvent } from 'react';
import { KeyRound, ShieldCheck, Loader2, AlertTriangle, ArrowRight } from 'lucide-react';
import { consumeActivationCode, getDeviceId } from '../auth/posActivationCodeService';
import type { POSActivationSnapshotLocal } from '../../shared/backend';

// Deprecated: activation UI is not a runtime login blocker for the core POS auth path.
interface ActivationLandingPageProps {
  onActivated: (snapshot: POSActivationSnapshotLocal) => void;
}

export default function ActivationLandingPage({ onActivated }: ActivationLandingPageProps) {
  const [activationCode, setActivationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const deviceId = getDeviceId();
      const result = await consumeActivationCode(activationCode, deviceId);

      if (!result.ok || !result.snapshot) {
        setError(result.message);
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);
      setTimeout(() => {
        onActivated(result.snapshot!);
      }, 600);
    } catch {
      setError('Activation could not be completed. Please try again.');
      setLoading(false);
    }
  };

  const handleQuickFill = () => {
    setActivationCode('SCI-ALPHA-0001');
    setError(null);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#07090d] text-slate-300 flex items-center justify-center p-6">
        <div className="w-full max-w-md border border-emerald-500/40 bg-[#0f131a] p-8 text-center space-y-4">
          <ShieldCheck className="mx-auto h-12 w-12 text-emerald-400" />
          <h1 className="text-2xl font-black uppercase text-emerald-400">Activation Successful</h1>
          <p className="text-sm text-slate-300">Opening Staff Access...</p>
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-emerald-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07090d] text-slate-300 flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-md bg-[#0f131a] border border-slate-800 p-6 md:p-8 relative shadow-2xl">
        <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-amber-500"></div>
        <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-amber-400"></div>
        <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-amber-400"></div>
        <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-amber-500"></div>

        <div className="text-center mb-6">
          <KeyRound className="mx-auto h-10 w-10 text-amber-500 mb-3" />
          <h1 className="text-xl font-black uppercase text-slate-100 tracking-tight">
            Activate iTredPOS
          </h1>
          <p className="text-xs text-slate-400 mt-2">
            Enter the activation code provided by your administrator to unlock the POS terminal.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Activation Code
            </label>
            <input
              type="text"
              value={activationCode}
              onChange={(e) => {
                setActivationCode(e.target.value.toUpperCase());
                setError(null);
              }}
              placeholder="SCI-XXXX-XXXX-XXXX"
              disabled={loading}
              className="w-full bg-slate-950 text-slate-200 border border-slate-800 focus:border-amber-500 px-4 py-3 outline-none rounded-none text-sm tracking-widest placeholder:text-slate-700 font-bold"
            />
          </div>

          {error && (
            <div className="bg-rose-950/40 border border-rose-800 p-3 text-rose-400 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="leading-tight text-xs">
                <span className="font-bold block text-rose-300 uppercase text-[10px]">Activation Failed</span>
                {error}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !activationCode.trim()}
            className="w-full py-3 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-extrabold tracking-widest uppercase transition-all duration-150 rounded-none cursor-pointer flex items-center justify-center gap-2 shadow-lg hover:shadow-amber-500/10 border border-amber-400 disabled:border-slate-800"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                VERIFYING...
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 text-slate-950" />
                Activate POS
                <ArrowRight className="w-4 h-4 text-slate-950" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-[10px] text-slate-600 font-mono">
          Activation code unlocks POS access only.<br />
          Staff login is still required after activation.
        </div>
      </div>
    </div>
  );
}
