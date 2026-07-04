import { useEffect, useState } from 'react';
import type { PosSession } from '../types';
import ReorderRequestsPanel from '../components/ReorderRequestsPanel';
import PurchaseRiskReviewPanel from '../components/PurchaseRiskReviewPanel';
import SupplierCommitmentsPanel from '../components/SupplierCommitmentsPanel';
import COGSBuyingControlPanel from '../components/COGSBuyingControlPanel';
import ReorderProtectionRulesPanel from '../components/ReorderProtectionRulesPanel';
import PurchaseBIWarningsPanel from '../components/PurchaseBIWarningsPanel';
import PurchaseDisciplineActivityPanel from '../components/PurchaseDisciplineActivityPanel';
import PurchasingDisciplineBIPanel from '../components/PurchasingDisciplineBIPanel';
import SimpleProductSeeder from '../components/SimpleProductSeeder';
import { getPurchaseDisciplineRequests, getPurchasingDisciplineBISummary, getSupplierPurchaseCommitments, type COGSReserveBIControl } from '../services/purchaseDisciplineService';

type PurchaseDisciplineTab =
  | 'BI Overview'
  | 'Reorder Requests'
  | 'Purchase Risk Review'
  | 'Supplier Commitments'
  | 'COGS Buying Control'
  | 'Reorder Protection Rules'
  | 'Product Import'
  | 'Purchase BI Warnings'
  | 'Activity / Audit';

const tabs: PurchaseDisciplineTab[] = ['BI Overview', 'Reorder Requests', 'Purchase Risk Review', 'Supplier Commitments', 'COGS Buying Control', 'Reorder Protection Rules', 'Product Import', 'Purchase BI Warnings', 'Activity / Audit'];
const money = (value: number) => `$${value.toFixed(2)}`;

export default function PosPurchaseDiscipline({ session }: { session?: PosSession | null }) {
  const [activeTab, setActiveTab] = useState<PurchaseDisciplineTab>('BI Overview');
  const [cogsSummary, setCogsSummary] = useState<COGSReserveBIControl | null>(null);
  const [hasPurchaseDisciplineRecords, setHasPurchaseDisciplineRecords] = useState(false);

  useEffect(() => {
    void getPurchasingDisciplineBISummary().then((summary) => setCogsSummary(summary.cogs));
    setHasPurchaseDisciplineRecords(getPurchaseDisciplineRequests().length > 0 || getSupplierPurchaseCommitments().length > 0);
  }, [activeTab]);

  return (
    <div className="pos-page creditors-page">
      <header className="pos-page-header">
        <div>
          <span className="pos-page-kicker">Purchasing Control</span>
          <h1>Purchasing Discipline</h1>
          <p>Supplier analytics, product buying intelligence, COGS reserve health, configurable rules and BI drill-down reports.</p>
        </div>
        <div className="creditors-session-chip">{session?.staffName || 'Staff'} - {session?.role || 'User'}</div>
      </header>

      {cogsSummary && (
        <section className="pd-bi-fixed-summary" aria-label="COGS reserve health summary">
          <div><span>COGS health score</span><strong>{cogsSummary.cogsHealthScore}</strong><small>{cogsSummary.cogsHealthStatus} control risk</small></div>
          <div><span>COGS reserve balance</span><strong>{money(cogsSummary.cogsReserveBalance)}</strong><small>Protected replenishment reserve</small></div>
          <div><span>Supplier commitments</span><strong>{money(cogsSummary.supplierCommitments)}</strong><small>Active exposure</small></div>
          <div><span>Cash available</span><strong>{money(cogsSummary.cashAvailable)}</strong><small>After commitments and supplier bills</small></div>
          <button type="button" onClick={() => setActiveTab('BI Overview')}>Open BI overview</button>
        </section>
      )}

      <nav className="creditors-tabs" aria-label="Purchase Discipline tabs">
        {tabs.map((tab) => <button key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>{tab}</button>)}
      </nav>

      {!hasPurchaseDisciplineRecords && (
        <section className="creditors-panel">
          <div className="creditors-notice">No purchase discipline records yet.</div>
        </section>
      )}

      {activeTab === 'BI Overview' && <PurchasingDisciplineBIPanel onOpenReport={setActiveTab} />}
      {activeTab === 'Reorder Requests' && <ReorderRequestsPanel />}
      {activeTab === 'Purchase Risk Review' && <PurchaseRiskReviewPanel />}
      {activeTab === 'Supplier Commitments' && <SupplierCommitmentsPanel />}
      {activeTab === 'COGS Buying Control' && <COGSBuyingControlPanel />}
      {activeTab === 'Reorder Protection Rules' && <ReorderProtectionRulesPanel />}
      {activeTab === 'Product Import' && <SimpleProductSeeder sourceContext="Purchasing" />}
      {activeTab === 'Purchase BI Warnings' && <PurchaseBIWarningsPanel />}
      {activeTab === 'Activity / Audit' && <PurchaseDisciplineActivityPanel />}
    </div>
  );
}
