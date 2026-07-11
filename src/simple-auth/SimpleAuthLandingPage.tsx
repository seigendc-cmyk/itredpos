import { useState, useCallback } from 'react';
import { signInWithGoogle, clearSimpleAuthContext } from './simpleGoogleAuthService';
import { createDefaultOwnerProfile } from './simpleOwnerProvisioningService';
import { saveSimpleAuthContext, readSimpleAuthContext } from './simpleAuthStorage';
import type { SimpleAuthStage, SimpleOwnerAuthContext } from './simpleAuthTypes';

// Deprecated: retained for reference only. App.tsx now routes through src/sci-auth/VendorAuthGate.tsx.
export default function SimpleAuthLandingPage() {
  const [stage, setStage] = useState<SimpleAuthStage>(() => {
    const existing = readSimpleAuthContext();
    return existing ? 'ready' : 'idle';
  });
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = useCallback(async () => {
    setStage('loading');
    setError(null);

    try {
      const googleContext = await signInWithGoogle();
      const ownerProfile = createDefaultOwnerProfile(googleContext.ownerUid, googleContext.ownerEmail, googleContext.ownerName);
      saveSimpleAuthContext(ownerProfile);
      setStage('ready');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Google sign-in failed.';
      setError(message);
      setStage('error');
    }
  }, []);

  const handleSignOut = useCallback(() => {
    clearSimpleAuthContext();
    setStage('idle');
    setError(null);
  }, []);

  if (stage === 'ready') {
    return (
      <div className="min-h-screen bg-[#07090d] text-slate-300 flex items-center justify-center p-6">
        <div className="w-full max-w-md border border-emerald-500/40 bg-[#0f131a] p-8 text-center space-y-4">
          <p className="text-sm text-slate-300">Owner session active.</p>
          <button
            type="button"
            onClick={handleSignOut}
            className="px-4 py-2 border border-slate-700 text-slate-300 hover:text-white text-xs uppercase tracking-widest"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07090d] text-slate-300 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-[#0f131a] border border-slate-800 p-8 relative shadow-2xl space-y-6">
        <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-amber-500"></div>
        <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-amber-400"></div>
        <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-amber-400"></div>
        <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-amber-500"></div>

        <div className="text-center space-y-2">
          <h1 className="text-2xl font-black uppercase text-slate-100 tracking-tight">iTredPOS</h1>
          <p className="text-xs text-slate-400">Owner Authentication</p>
        </div>

        {error && (
          <div className="bg-rose-950/40 border border-rose-800 p-3 text-rose-400 text-xs">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={stage === 'loading'}
            className="w-full py-3 bg-white hover:bg-slate-200 text-slate-900 font-bold tracking-widest uppercase transition-all duration-150 rounded-none cursor-pointer flex items-center justify-center gap-2 text-sm"
          >
            {stage === 'loading' ? 'Signing in...' : 'Sign in with Google'}
          </button>
        </div>

        <p className="text-[10px] text-slate-600 text-center">
          First-time users will receive a default owner profile.<br />
          No activation code is required for this flow.
        </p>
      </div>
    </div>
  );
}
