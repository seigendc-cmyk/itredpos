import { useEffect, useState } from 'react';
import type { PosSession } from '../types';
import SupplierCreditProfilePanel from '../components/SupplierCreditProfilePanel';
import SupplierBillsPanel from '../components/SupplierBillsPanel';
import CreditorsAgeingPanel from '../components/CreditorsAgeingPanel';
import SupplierPaymentsPanel from '../components/SupplierPaymentsPanel';
import COGSReservePanel from '../components/COGSReservePanel';
import PurchaseCommitmentsPanel from '../components/PurchaseCommitmentsPanel';
import SupplierStatementsPanel from '../components/SupplierStatementsPanel';
import SupplierReturnsCreditNotesPanel from '../components/SupplierReturnsCreditNotesPanel';
import CreditorBIWarningsPanel from '../components/CreditorBIWarningsPanel';
import FinancialControlReportsPanel from '../components/FinancialControlReportsPanel';
import { getSupplierBills, getSupplierCreditProfiles, getSupplierPayments } from '../services/creditorsService';

type TabId = 'Supplier List' | 'Supplier Credit Profiles' | 'Supplier Bills / Invoices' | 'Creditors Ageing' | 'Supplier Payments' | 'COGS Reserve' | 'Purchase Commitments' | 'Supplier Statements' | 'Supplier Returns / Credit Notes' | 'Financial Reports' | 'Creditor BI Warnings' | 'Activity / Audit';

const tabs: TabId[] = ['Supplier List', 'Supplier Credit Profiles', 'Supplier Bills / Invoices', 'Creditors Ageing', 'Supplier Payments', 'COGS Reserve', 'Purchase Commitments', 'Supplier Statements', 'Supplier Returns / Credit Notes', 'Financial Reports', 'Creditor BI Warnings', 'Activity / Audit'];

export default function PosCreditors({ session }: { session?: PosSession }) {
  const [activeTab, setActiveTab] = useState<TabId>('Supplier Credit Profiles');
  const [hasCreditorRecords, setHasCreditorRecords] = useState(false);

  useEffect(() => {
    setHasCreditorRecords(getSupplierCreditProfiles().length > 0 || getSupplierBills().length > 0 || getSupplierPayments().length > 0);
  }, [activeTab]);

  return (
    <div className="pos-page creditors-page">
      <header className="pos-page-header">
        <div>
          <span className="pos-page-kicker">Supplier Finance</span>
          <h1>Creditors Management</h1>
          <p>Supplier credit control, payable ageing, COGS reserve protection and accounting readiness.</p>
        </div>
        <div className="creditors-session-chip">{session?.staffName || 'Staff'} - {session?.role || 'User'}</div>
      </header>

      <nav className="creditors-tabs" aria-label="Creditors Management tabs">
        {tabs.map((tab) => <button key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>{tab}</button>)}
      </nav>

      {!hasCreditorRecords && (
        <section className="creditors-panel">
          <div className="creditors-notice">No creditors recorded yet.</div>
        </section>
      )}

      {(activeTab === 'Supplier List' || activeTab === 'Supplier Credit Profiles') && <SupplierCreditProfilePanel />}
      {activeTab === 'Supplier Bills / Invoices' && <SupplierBillsPanel />}
      {activeTab === 'Creditors Ageing' && <CreditorsAgeingPanel />}
      {activeTab === 'Supplier Payments' && <SupplierPaymentsPanel />}
      {activeTab === 'COGS Reserve' && <COGSReservePanel />}
      {activeTab === 'Purchase Commitments' && <PurchaseCommitmentsPanel />}
      {activeTab === 'Supplier Statements' && <SupplierStatementsPanel />}
      {activeTab === 'Supplier Returns / Credit Notes' && <SupplierReturnsCreditNotesPanel />}
      {activeTab === 'Financial Reports' && <FinancialControlReportsPanel session={session} />}
      {activeTab === 'Creditor BI Warnings' && <CreditorBIWarningsPanel />}
      {activeTab === 'Activity / Audit' && (
        <section className="creditors-panel">
          <div className="creditors-panel-header"><div><span>Activity / Audit</span><h3>Creditor audit events</h3></div></div>
          <div className="creditors-notice">Supplier bill, supplier payment, COGS reserve, approval and BI warning actions are prepared for accounting review.</div>
        </section>
      )}
    </div>
  );
}
