import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import type { FinancialPositionSummary } from '../types';
import { getFinancialPositionSummary, rebuildFinancialActivityPreview, validateFinancialActivityMappings } from '../services/financialControlService';

const money = (value: number) => `$${value.toFixed(2)}`;

interface FinancialDashboardPanelProps {
  onRefresh?: () => void;
}

export default function FinancialDashboardPanel({ onRefresh }: FinancialDashboardPanelProps) {
  const [summary, setSummary] = useState<FinancialPositionSummary | null>(null);
  const [mapping, setMapping] = useState<{ missing: number; warnings: string[] }>({ missing: 0, warnings: [] });

  const load = async () => {
    const [nextSummary, nextMapping] = await Promise.all([getFinancialPositionSummary(), validateFinancialActivityMappings()]);
    setSummary(nextSummary);
    setMapping(nextMapping);
  };

  useEffect(() => {
    void load();
  }, []);

  const handleRebuild = async () => {
    await rebuildFinancialActivityPreview();
    await load();
    onRefresh?.();
  };

  if (!summary) return <div className="p-4 text-xs text-slate-500">Loading Financial Control dashboard...</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <Metric label="Gross Cash Position" value={money(summary.grossCashPosition)} />
        <Metric label="Protected / Restricted" value={money(summary.lessCOGSReserve + summary.lessVATReserve + summary.lessCustomerDeposits)} tone="amber" />
        <Metric label="Free Usable Cash" value={money(summary.freeUsableCash)} tone={summary.freeUsableCash >= 0 ? 'emerald' : 'rose'} />
        <Metric label="Net Control Position" value={money(summary.netControlPosition)} tone={summary.netControlPosition >= 0 ? 'emerald' : 'rose'} />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200 p-4 xl:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-800">Financial Control Position</h3>
              <p className="text-xs text-slate-500">COA-driven local preview, not final accounting posting.</p>
            </div>
            <button type="button" onClick={handleRebuild} className="inline-flex items-center gap-2 border border-slate-300 px-3 py-2 text-xs font-bold uppercase text-slate-700 hover:bg-slate-50">
              <RefreshCw className="w-4 h-4" />
              Rebuild Preview
            </button>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <Info label="Cash on Hand" value={money(summary.totalCashOnHand)} />
            <Info label="Bank Placeholder" value={money(summary.totalBankBalancePlaceholder)} />
            <Info label="Mobile/Card Controls" value={money(summary.totalMobileMoneyPlaceholder + summary.totalCardControlPlaceholder)} />
            <Info label="Debtors Outstanding" value={money(summary.debtorsOutstanding)} />
            <Info label="Creditors Outstanding" value={money(summary.creditorsOutstanding)} />
            <Info label="Purchase Commitments" value={money(summary.purchaseCommitments)} />
          </div>
        </div>
        <div className="bg-white border border-amber-200 p-4">
          <div className="flex items-center gap-2 text-amber-700">
            <AlertTriangle className="w-4 h-4" />
            <h3 className="text-sm font-black uppercase tracking-wider">BI Control Warnings</h3>
          </div>
          <div className="mt-3 space-y-2 text-xs text-slate-600">
            <p>Unmapped financial activity rows: <strong>{mapping.missing}</strong></p>
            <p>Reserve shortfall placeholder: <strong>{money(summary.reserveShortfall)}</strong></p>
            <p>{mapping.warnings.length ? mapping.warnings.join(', ') : 'Mappings ready for preview reporting.'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, tone = 'slate' }: { label: string; value: string; tone?: 'slate' | 'amber' | 'emerald' | 'rose' }) {
  const toneClass = tone === 'emerald' ? 'text-emerald-700' : tone === 'rose' ? 'text-rose-700' : tone === 'amber' ? 'text-amber-700' : 'text-slate-900';
  return (
    <div className="bg-white border border-slate-200 p-4">
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</div>
      <div className={`mt-2 text-2xl font-black ${toneClass}`}>{value}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-slate-100 bg-slate-50 p-3">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 font-black text-slate-800">{value}</div>
    </div>
  );
}
