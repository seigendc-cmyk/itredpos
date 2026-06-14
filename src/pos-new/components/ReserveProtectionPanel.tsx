import { useEffect, useState } from 'react';
import type { FinancialControlAccount } from '../types';
import { getProtectedFundsSummary } from '../services/financialControlService';

const money = (value: number) => `$${value.toFixed(2)}`;

export default function ReserveProtectionPanel() {
  const [accounts, setAccounts] = useState<FinancialControlAccount[]>([]);

  useEffect(() => {
    void getProtectedFundsSummary().then(setAccounts);
  }, []);

  return (
    <div className="bg-white border border-slate-200">
      <div className="p-4 border-b border-slate-200">
        <h3 className="text-sm font-black uppercase tracking-wider text-slate-800">Reserve Protection</h3>
        <p className="text-xs text-slate-500">Restricted funds are excluded from free usable cash in the management view.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider">
            <tr><th className="p-3 text-left">Account</th><th className="p-3 text-left">Type</th><th className="p-3 text-right">Balance</th><th className="p-3 text-right">Restricted</th><th className="p-3 text-left">Rule</th></tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.accountId} className="border-t border-slate-100">
                <td className="p-3 font-bold">{account.accountName}</td>
                <td className="p-3">{account.accountType}</td>
                <td className="p-3 text-right">{money(account.currentBalance)}</td>
                <td className="p-3 text-right font-bold text-amber-700">{money(account.restrictedBalance)}</td>
                <td className="p-3">{account.protected ? 'Owner protected' : 'Restricted balance only'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
