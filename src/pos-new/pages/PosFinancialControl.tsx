import { useState } from 'react';
import type { ComponentType } from 'react';
import { AlertTriangle, Banknote, BarChart3, BriefcaseBusiness, Calculator, FileText, Landmark, PenLine, ShieldCheck, TrendingDown, TrendingUp, UserRoundPlus, WalletCards } from 'lucide-react';
import type { CheckWriterRecord, JournalEntryRecord, PosSession, Role } from '../types';
import FinancialDashboardPanel from '../components/FinancialDashboardPanel';
import COACashBankAccountsPanel from '../components/COACashBankAccountsPanel';
import MoneyInPanel from '../components/MoneyInPanel';
import MoneyOutPanel from '../components/MoneyOutPanel';
import CashPlanForecastPanel from '../components/CashPlanForecastPanel';
import ProfitabilityPanel from '../components/ProfitabilityPanel';
import ReserveProtectionPanel from '../components/ReserveProtectionPanel';
import DebtorsCreditorsPositionPanel from '../components/DebtorsCreditorsPositionPanel';
import OwnerFinancialDecisionsPanel from '../components/OwnerFinancialDecisionsPanel';
import CheckWriterA5Modal from '../components/CheckWriterA5Modal';
import PayeeRegisterModal from '../components/PayeeRegisterModal';
import JournalEntryA5Modal from '../components/JournalEntryA5Modal';
import CheckWriterListPanel from '../components/CheckWriterListPanel';
import JournalEntryListPanel from '../components/JournalEntryListPanel';
import { hasPermission } from '../utils/posPermissions';

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
  const [notice, setNotice] = useState<string | null>(null);
  const [checkOpen, setCheckOpen] = useState(false);
  const [payeeOpen, setPayeeOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [editingCheck, setEditingCheck] = useState<CheckWriterRecord | null>(null);
  const [editingJournal, setEditingJournal] = useState<JournalEntryRecord | null>(null);
  const role = (session?.role || 'Viewer') as Role;
  const staffName = session?.staffName || 'Admin User';
  const businessName = session?.vendor || 'Local Vendor';
  const can = (permission: Parameters<typeof hasPermission>[1]) => hasPermission(role, permission);
  const openCheck = (check: CheckWriterRecord | null = null) => {
    if (!can('financialControl.checkWriter.view')) {
      setNotice('You do not have permission to open Check Writer.');
      return;
    }
    setEditingCheck(check);
    setCheckOpen(true);
  };
  const openJournal = (journal: JournalEntryRecord | null = null) => {
    if (!can('financialControl.journal.view')) {
      setNotice('You do not have permission to open Journal Entry.');
      return;
    }
    setEditingJournal(journal);
    setJournalOpen(true);
  };

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
            Finance control view for reviewing POS activity, chart of accounts readiness, and posting preparation.
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={() => openCheck()}>
              <PenLine className="w-4 h-4" /> Write Check
            </button>
            <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => setPayeeOpen(true)} disabled={!can('financialControl.payee.view')}>
              <UserRoundPlus className="w-4 h-4" /> Payee Register
            </button>
            <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => openJournal()}>
              <FileText className="w-4 h-4" /> Journal Entry
            </button>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {notice && <div className="sci-pos-alert" role="status">{notice}</div>}
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
        {activeTab === 'Money Out' && (
          <>
            <MoneyOutPanel />
            <CheckWriterListPanel staffName={staffName} onOpen={openCheck} onNotice={setNotice} />
            <JournalEntryListPanel staffName={staffName} onOpen={openJournal} onNotice={setNotice} />
          </>
        )}
        {activeTab === 'CashPlan' && <CashPlanForecastPanel />}
        {activeTab === 'Profitability' && <ProfitabilityPanel />}
        {activeTab === 'Reserve Protection' && <ReserveProtectionPanel />}
        {activeTab === 'Debtors/Creditors' && <DebtorsCreditorsPositionPanel />}
        {activeTab === 'Owner Decisions' && <OwnerFinancialDecisionsPanel />}
        {activeTab === 'BI Warnings' && <FinancialDashboardPanel key={`bi-${refreshKey}`} onRefresh={() => setRefreshKey((value) => value + 1)} />}
      </div>
      <CheckWriterA5Modal open={checkOpen} staffName={staffName} businessName={businessName} initialCheck={editingCheck} onClose={() => setCheckOpen(false)} onSaved={(message) => { setNotice(message); setRefreshKey((value) => value + 1); }} />
      <PayeeRegisterModal open={payeeOpen} staffName={staffName} onClose={() => setPayeeOpen(false)} onSaved={setNotice} />
      <JournalEntryA5Modal open={journalOpen} staffName={staffName} businessName={businessName} initialJournal={editingJournal} onClose={() => setJournalOpen(false)} onSaved={(message) => { setNotice(message); setRefreshKey((value) => value + 1); }} />
    </div>
  );
}
