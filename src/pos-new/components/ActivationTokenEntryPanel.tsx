import { useState } from 'react';
import { CheckCircle2, KeyRound, X } from 'lucide-react';
import { redeemActivationToken, validateActivationToken, type ActivationTokenResult } from '../auth/activationTokenService';

interface ActivationTokenEntryPanelProps {
  vendorId: string;
  onCancel: () => void;
  onActivated?: (result: ActivationTokenResult) => void;
}

export default function ActivationTokenEntryPanel({
  vendorId,
  onCancel,
  onActivated
}: ActivationTokenEntryPanelProps) {
  const [activationCode, setActivationCode] = useState('');
  const [notice, setNotice] = useState('Enter the activation code issued by your administrator.');
  const [busy, setBusy] = useState(false);

  const activate = async () => {
    setBusy(true);
    setNotice('Checking activation code...');
    try {
      const validation = await validateActivationToken(activationCode, vendorId);
      if (!validation.ok) {
        setNotice(validation.message);
        return;
      }
      const result = await redeemActivationToken(activationCode, vendorId);
      setNotice(result.message);
      if (result.ok) onActivated?.(result);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="border border-slate-200 bg-slate-50 p-4 text-left">
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-orange-600" />
        <h3 className="text-xs font-black uppercase text-slate-900">Enter Activation Code</h3>
      </div>
      <label className="mt-3 block text-[10px] font-black uppercase text-slate-500">
        Activation code
        <input
          value={activationCode}
          onChange={(event) => setActivationCode(event.target.value.toUpperCase())}
          placeholder="SCI-XXXX-XXXX-XXXX"
          className="mt-1 w-full border border-slate-300 bg-white px-3 py-3 text-sm font-black uppercase tracking-wide text-slate-950 outline-none focus:border-orange-500"
        />
      </label>
      <div className="mt-3 border border-slate-200 bg-white p-3 text-xs font-bold text-slate-700">
        {notice}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void activate()}
          className="inline-flex items-center gap-2 bg-orange-600 px-4 py-2 text-xs font-black uppercase text-white hover:bg-orange-500 disabled:cursor-wait disabled:opacity-60"
        >
          <CheckCircle2 className="h-4 w-4" />
          Activate
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="inline-flex items-center gap-2 border border-slate-300 bg-white px-4 py-2 text-xs font-black uppercase text-slate-800 hover:border-orange-400 disabled:cursor-wait disabled:opacity-60"
        >
          <X className="h-4 w-4" />
          Cancel
        </button>
      </div>
    </section>
  );
}
