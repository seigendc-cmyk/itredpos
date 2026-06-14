import { useEffect, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import type { CashPlanForecast, CashPlanLine } from '../types';
import { addCashPlanLine, getCashPlanForecast, getCashPlanLines, rebuildCashPlanPreview } from '../services/cashPlanService';

const money = (value: number) => `$${value.toFixed(2)}`;

export default function CashPlanForecastPanel() {
  const [forecast, setForecast] = useState<CashPlanForecast | null>(null);
  const [lines, setLines] = useState<CashPlanLine[]>([]);

  const load = async () => {
    const [nextForecast, nextLines] = await Promise.all([getCashPlanForecast(), getCashPlanLines()]);
    setForecast(nextForecast);
    setLines(nextLines);
  };

  useEffect(() => {
    void load();
  }, []);

  const handleAddPlaceholder = async () => {
    await addCashPlanLine({ type: 'Outflow', outflowType: 'OtherPlanned', description: 'Owner review placeholder outflow.', amount: 250, confidence: 'Medium' });
    await load();
  };

  const handleRebuild = async () => {
    await rebuildCashPlanPreview();
    await load();
  };

  if (!forecast) return <div className="p-4 text-xs text-slate-500">Loading CashPlan...</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <PlanMetric label="Opening Free Cash" value={money(forecast.openingCashPosition)} />
        <PlanMetric label="Expected Inflows" value={money(forecast.confirmedInflows + forecast.expectedInflows)} />
        <PlanMetric label="Outflow Pressure" value={money(forecast.confirmedOutflows + forecast.plannedOutflows)} />
        <PlanMetric label="Projected Free Cash" value={money(forecast.projectedFreeCash)} />
      </div>
      <div className="bg-white border border-slate-200">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-800">Rolling CashPlan</h3>
            <p className="text-xs text-slate-500">{forecast.periodFrom} to {forecast.periodTo} / Confidence: {forecast.confidence}</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={handleAddPlaceholder} className="inline-flex items-center gap-2 border border-slate-300 px-3 py-2 text-xs font-bold uppercase"><Plus className="w-4 h-4" />Add Line</button>
            <button type="button" onClick={handleRebuild} className="inline-flex items-center gap-2 border border-slate-300 px-3 py-2 text-xs font-bold uppercase"><RefreshCw className="w-4 h-4" />Rebuild</button>
          </div>
        </div>
        <div className="p-4 text-xs text-slate-700 border-b border-slate-100">{forecast.recommendedOwnerAction}</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider">
              <tr><th className="p-3 text-left">Date</th><th className="p-3 text-left">Type</th><th className="p-3 text-left">Description</th><th className="p-3 text-right">Amount</th><th className="p-3 text-left">Confidence</th><th className="p-3 text-left">Restricted</th></tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.lineId} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="p-3">{line.date}</td>
                  <td className="p-3">{line.inflowType || line.outflowType}</td>
                  <td className="p-3">{line.description}</td>
                  <td className="p-3 text-right font-bold">{money(line.amount)}</td>
                  <td className="p-3">{line.confidence}</td>
                  <td className="p-3">{line.restricted ? 'Protected funds' : 'Free cash'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PlanMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-slate-200 p-4">
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</div>
      <div className="mt-2 text-xl font-black text-slate-900">{value}</div>
    </div>
  );
}
