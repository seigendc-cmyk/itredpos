import { useEffect, useState } from 'react';
import type { ProfitabilitySummary, ProfitabilityViewMode } from '../types';
import { getProfitabilityDrivers, getProfitabilitySummary } from '../services/profitabilityService';

const money = (value: number) => `$${value.toFixed(2)}`;

export default function ProfitabilityPanel() {
  const [mode, setMode] = useState<ProfitabilityViewMode>('HybridManagement');
  const [summary, setSummary] = useState<ProfitabilitySummary | null>(null);
  const [drivers, setDrivers] = useState<Array<{ label: string; value: string | number; status: string }>>([]);

  useEffect(() => {
    void Promise.all([getProfitabilitySummary(mode), getProfitabilityDrivers()]).then(([nextSummary, nextDrivers]) => {
      setSummary(nextSummary);
      setDrivers(nextDrivers);
    });
  }, [mode]);

  if (!summary) return <div className="p-4 text-xs text-slate-500">Loading profitability...</div>;

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-800">Profitability Preview</h3>
          <p className="text-xs text-slate-500">{summary.periodFrom} to {summary.periodTo}</p>
        </div>
        <select value={mode} onChange={(event) => setMode(event.target.value as ProfitabilityViewMode)} className="border border-slate-300 px-3 py-2 text-xs font-bold uppercase">
          <option value="HybridManagement">Hybrid Management</option>
          <option value="CashBasis">Cash Basis</option>
          <option value="AccrualReadiness">Accrual Readiness</option>
        </select>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <ProfitMetric label="Net Sales" value={money(summary.netSales)} />
        <ProfitMetric label="Gross Profit" value={money(summary.grossProfit)} />
        <ProfitMetric label="Net Operating Profit" value={money(summary.netOperatingProfit)} />
        <ProfitMetric label="Net Margin" value={`${summary.netMarginPercent.toFixed(1)}%`} />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 p-4">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Profit Build-Up</h4>
          <dl className="mt-3 space-y-2 text-xs">
            <Row label="Gross Sales" value={money(summary.grossSales)} />
            <Row label="Discounts / Returns" value={`-${money(summary.discounts + summary.returns)}`} />
            <Row label="COGS" value={`-${money(summary.cogs)}`} />
            <Row label="Operating / Delivery / Drawer Costs" value={`-${money(summary.operatingExpenses + summary.deliveryCosts + summary.drawerExpenses)}`} />
            <Row label="Cash Shortages" value={`-${money(summary.cashShortages)}`} />
          </dl>
        </div>
        <div className="bg-white border border-slate-200 p-4">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Drivers</h4>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
            {drivers.map((driver) => (
              <div key={driver.label} className="border border-slate-100 bg-slate-50 p-3 text-xs">
                <div className="font-bold text-slate-800">{driver.label}</div>
                <div className="mt-1 text-slate-600">{typeof driver.value === 'number' ? money(driver.value) : driver.value} / {driver.status}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfitMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-slate-200 p-4">
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</div>
      <div className="mt-2 text-xl font-black text-slate-900">{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between border-b border-slate-100 pb-2"><dt>{label}</dt><dd className="font-bold">{value}</dd></div>;
}
