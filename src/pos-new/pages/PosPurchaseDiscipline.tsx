import { useState } from 'react';
import type { PosSession } from '../types';
import ReorderRequestsPanel from '../components/ReorderRequestsPanel';
import PurchaseRiskReviewPanel from '../components/PurchaseRiskReviewPanel';
import SupplierCommitmentsPanel from '../components/SupplierCommitmentsPanel';
import COGSBuyingControlPanel from '../components/COGSBuyingControlPanel';
import ReorderProtectionRulesPanel from '../components/ReorderProtectionRulesPanel';
import PurchaseBIWarningsPanel from '../components/PurchaseBIWarningsPanel';
import PurchaseDisciplineActivityPanel from '../components/PurchaseDisciplineActivityPanel';

type PurchaseDisciplineTab =
  | 'Reorder Requests'
  | 'Purchase Risk Review'
  | 'Supplier Commitments'
  | 'COGS Buying Control'
  | 'Reorder Protection Rules'
  | 'Purchase BI Warnings'
  | 'Activity / Audit';

const tabs: PurchaseDisciplineTab[] = ['Reorder Requests', 'Purchase Risk Review', 'Supplier Commitments', 'COGS Buying Control', 'Reorder Protection Rules', 'Purchase BI Warnings', 'Activity / Audit'];

export default function PosPurchaseDiscipline({ session }: { session?: PosSession | null }) {
  const [activeTab, setActiveTab] = useState<PurchaseDisciplineTab>('Reorder Requests');
  return (
    <div className="pos-page creditors-page">
      <header className="pos-page-header">
        <div>
          <span className="pos-page-kicker">Build 19AQ</span>
          <h1>Purchase Discipline</h1>
          <p>Reorder protection, supplier commitments, COGS buying controls, risk scoring, approvals and BI warnings.</p>
        </div>
        <div className="creditors-session-chip">{session?.staffName || 'Local User'} · {session?.role || 'Build Development'}</div>
      </header>
      <nav className="creditors-tabs" aria-label="Purchase Discipline tabs">
        {tabs.map((tab) => <button key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>{tab}</button>)}
      </nav>
      {activeTab === 'Reorder Requests' && <ReorderRequestsPanel />}
      {activeTab === 'Purchase Risk Review' && <PurchaseRiskReviewPanel />}
      {activeTab === 'Supplier Commitments' && <SupplierCommitmentsPanel />}
      {activeTab === 'COGS Buying Control' && <COGSBuyingControlPanel />}
      {activeTab === 'Reorder Protection Rules' && <ReorderProtectionRulesPanel />}
      {activeTab === 'Purchase BI Warnings' && <PurchaseBIWarningsPanel />}
      {activeTab === 'Activity / Audit' && <PurchaseDisciplineActivityPanel />}
    </div>
  );
}
