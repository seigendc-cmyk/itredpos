import { useEffect, useState } from 'react';
import { FileText, Search } from 'lucide-react';
import RowActionMenu from './RowActionMenu';
import type { FinancialActivityRecord } from '../types';
import { getMoneyInSummary } from '../services/financialControlService';

const money = (value: number) => `$${value.toFixed(2)}`;

export default function MoneyInPanel() {
  const [rows, setRows] = useState<FinancialActivityRecord[]>([]);
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    void getMoneyInSummary({ search }).then(setRows);
  }, [search]);

  return (
    <ActivityPanel title="Money In" subtitle="Cash, bank, mobile, card, debtor and deposit inflow preview." rows={rows} search={search} setSearch={setSearch} openId={openId} setOpenId={setOpenId} />
  );
}

export function ActivityPanel({ title, subtitle, rows, search, setSearch, openId, setOpenId }: { title: string; subtitle: string; rows: FinancialActivityRecord[]; search: string; setSearch: (value: string) => void; openId: string | null; setOpenId: (value: string | null) => void }) {
  return (
    <div className="bg-white border border-slate-200">
      <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-800">{title}</h3>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        <label className="flex items-center gap-2 border border-slate-300 px-3 py-2 text-xs text-slate-600">
          <Search className="w-4 h-4" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} className="outline-none" placeholder="Search activity" />
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider">
            <tr><th className="p-3 text-left">Date</th><th className="p-3 text-left">Activity</th><th className="p-3 text-left">Source</th><th className="p-3 text-left">Reference</th><th className="p-3 text-right">Amount</th><th className="p-3 text-right">Cash</th><th className="p-3 text-right">Bank</th><th className="p-3 text-left">Status</th><th className="p-3 text-left">Action</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.activityId} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="p-3">{row.activityDate}</td>
                <td className="p-3"><div className="font-bold text-slate-800">{row.type}</div><div className="text-slate-500">{row.description}</div></td>
                <td className="p-3">{row.source}</td>
                <td className="p-3 font-bold">{row.sourceReferenceNumber}</td>
                <td className="p-3 text-right">{money(row.amount)}</td>
                <td className="p-3 text-right">{money(row.cashImpact)}</td>
                <td className="p-3 text-right">{money(row.bankImpact)}</td>
                <td className="p-3">{row.status}</td>
                <td className="p-3">
                  <RowActionMenu
                    ariaLabel={`${row.activityNumber} actions`}
                    open={openId === row.activityId}
                    onOpenChange={(open) => setOpenId(open ? row.activityId : null)}
                    items={[
                      { label: 'View Source Placeholder', icon: <FileText className="w-3 h-3" />, onClick: () => undefined },
                      { label: 'Review COA Mapping', onClick: () => undefined },
                      { label: 'Create BI Warning', onClick: () => undefined },
                      { label: 'Export Row Placeholder', onClick: () => undefined }
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
