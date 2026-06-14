import { useState } from 'react';
import type { ComponentType } from 'react';
import { AlertTriangle, Banknote, BarChart3, BriefcaseBusiness, Calculator, Landmark, ShieldCheck, TrendingDown, TrendingUp, WalletCards } from 'lucide-react';
import type { PosSession } from '../types';
import FinancialDashboardPanel from '../components/FinancialDashboardPanel';
import COACashBankAccountsPanel from '../components/COACashBankAccountsPanel';
import MoneyInPanel from '../components/MoneyInPanel';
import MoneyOutPanel from '../components/MoneyOutPanel';
import CashPlanForecastPanel from '../components/CashPlanForecastPanel';
import ProfitabilityPanel from '../components/ProfitabilityPanel';
import ReserveProtectionPanel from '../components/ReserveProtectionPanel';
import DebtorsCreditorsPositionPanel from '../components/DebtorsCreditorsPositionPanel';
import OwnerFinancialDecisionsPanel from '../components/OwnerFinancialDecisionsPanel';

type FinancialControlTab =
  | 'Dashboard'
  | 'COA Cash/Bank Accounts'
  | 'Money In'
  | 'Money Out'
  | 'CashPlan'
  | 'Profitability'
  | 'Reserve Protection'
  | 'Debtors/Creditors'
  | 'Owner Decisions'
  | 'BI Warnings';

interface PosFinancialControlProps {
  session: PosSession | null;
}

const tabs: Array<{ id: FinancialControlTab; icon: ComponentType<{ className?: string }> }> = [
  { id: 'Dashboard', icon: Calculator },
  { id: 'COA Cash/Bank Accounts', icon: Landmark },
  { id: 'Money In', icon: TrendingUp },
  { id: 'Money Out', icon: TrendingDown },
  { id: 'CashPlan', icon: WalletCards },
  { id: 'Profitability', icon: BarChart3 },
  { id: 'Reserve Protection', icon: ShieldCheck },
  { id: 'Debtors/Creditors', icon: Banknote },
  { id: 'Owner Decisions', icon: BriefcaseBusiness },
  { id: 'BI Warnings', icon: AlertTriangle }
];

export default function PosFinancialControl({ session }: PosFinancialControlProps) {
  const [activeTab, setActiveTab] = useState<FinancialControlTab>('Dashboard');
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="border-b border-slate-300 bg-white px-5 py-4">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Owner Desk / Accounting Control</div>
            <h1 className="text-2xl font-black uppercase tracking-wide text-slate-900">Financial Control</h1>
            <p className="mt-1 text-xs text-slate-500">
              COA-driven cash, bank, reserve, debtor, creditor, CashPlan and profitability preview for {session?.vendor || 'local vendor'}.
            </p>
          </div>
          <div className="border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 max-w-xl">
            Build-development control layer only. It reads local POS activity and COA placeholders; it does not post final accounts or connect to vendor consoles.
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5">
        <div className="bg-white border border-slate-200 p-2 flex flex-wrap gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                type="button"
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 px-3 py-2 text-[11px] font-black uppercase tracking-wide border ${
                  active ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.id}
              </button>
            );
          })}
        </div>

        {activeTab === 'Dashboard' && <FinancialDashboardPanel key={refreshKey} onRefresh={() => setRefreshKey((value) => value + 1)} />}
        {activeTab === 'COA Cash/Bank Accounts' && <COACashBankAccountsPanel />}
        {activeTab === 'Money In' && <MoneyInPanel />}
        {activeTab === 'Money Out' && <MoneyOutPanel />}
        {activeTab === 'CashPlan' && <CashPlanForecastPanel />}
        {activeTab === 'Profitability' && <ProfitabilityPanel />}
        {activeTab === 'Reserve Protection' && <ReserveProtectionPanel />}
        {activeTab === 'Debtors/Creditors' && <DebtorsCreditorsPositionPanel />}
        {activeTab === 'Owner Decisions' && <OwnerFinancialDecisionsPanel />}
        {activeTab === 'BI Warnings' && <FinancialDashboardPanel key={`bi-${refreshKey}`} onRefresh={() => setRefreshKey((value) => value + 1)} />}
      </div>
    </div>
  );
}
