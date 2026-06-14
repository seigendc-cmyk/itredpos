import { useEffect, useState } from 'react';
import { Ban, FileDown, Printer, RotateCcw, Search } from 'lucide-react';
import RowActionMenu from './RowActionMenu';
import type { FinancialControlAccount } from '../types';
import { deactivateFinancialControlAccount, getFinancialControlAccounts, updateFinancialControlAccount } from '../services/financialControlService';

const money = (value: number) => `$${value.toFixed(2)}`;

export default function COACashBankAccountsPanel() {
  const [accounts, setAccounts] = useState<FinancialControlAccount[]>([]);
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const load = async () => setAccounts(await getFinancialControlAccounts({ search }));

  useEffect(() => {
    void load();
  }, [search]);

  const handleDeactivate = async (account: FinancialControlAccount) => {
    setAccounts(await deactivateFinancialControlAccount(account.accountId, 'Marked inactive from Financial Control preview.'));
  };

  const handleReactivate = async (account: FinancialControlAccount) => {
    setAccounts(await updateFinancialControlAccount(account.accountId, { active: true, notes: 'Reactivated from Financial Control preview.' }));
  };

  return (
    <div className="bg-white border border-slate-200">
      <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-800">COA Cash / Bank Control Accounts</h3>
          <p className="text-xs text-slate-500">Accounts are derived from Chart of Accounts placeholders and local mapping rules.</p>
        </div>
        <label className="flex items-center gap-2 border border-slate-300 px-3 py-2 text-xs text-slate-600">
          <Search className="w-4 h-4" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} className="outline-none" placeholder="Search accounts" />
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider">
            <tr><th className="p-3 text-left">Code</th><th className="p-3 text-left">Account</th><th className="p-3 text-left">Type</th><th className="p-3 text-right">Current</th><th className="p-3 text-right">Restricted</th><th className="p-3 text-right">Available</th><th className="p-3 text-left">Status</th><th className="p-3 text-left">Action</th></tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.accountId} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="p-3 font-bold">{account.accountCode}</td>
                <td className="p-3"><div className="font-bold text-slate-800">{account.accountName}</div><div className="text-slate-500">{account.linkedDomain}</div></td>
                <td className="p-3">{account.accountType}</td>
                <td className="p-3 text-right">{money(account.currentBalance)}</td>
                <td className="p-3 text-right">{money(account.restrictedBalance)}</td>
                <td className="p-3 text-right font-bold">{money(account.availableBalance)}</td>
                <td className="p-3">{account.active ? 'Active' : 'Inactive'}{account.protected ? ' / Protected' : ''}</td>
                <td className="p-3">
                  <RowActionMenu
                    ariaLabel={`${account.accountName} actions`}
                    open={openId === account.accountId}
                    onOpenChange={(open) => setOpenId(open ? account.accountId : null)}
                    items={[
                      { label: 'View COA Mapping', onClick: () => undefined },
                      { label: 'Print Account Summary', icon: <Printer className="w-3 h-3" />, onClick: () => window.print() },
                      { label: 'Export Placeholder', icon: <FileDown className="w-3 h-3" />, onClick: () => undefined },
                      account.active
                        ? { label: 'Mark Inactive', icon: <Ban className="w-3 h-3" />, danger: true, onClick: () => void handleDeactivate(account) }
                        : { label: 'Reactivate', icon: <RotateCcw className="w-3 h-3" />, onClick: () => void handleReactivate(account) }
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
