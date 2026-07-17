import { useEffect, useMemo, useState } from 'react';
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
import { usePurchasingData } from '../hooks/usePurchasingData';
import type { RepositoryOperationContext } from '../repositories/repositoryContext';
import { getActiveVendorId } from '../utils/vendorDataMode';

type TabId = 'Supplier List' | 'Supplier Credit Profiles' | 'Supplier Bills / Invoices' | 'Creditors Ageing' | 'Supplier Payments' | 'COGS Reserve' | 'Purchase Commitments' | 'Supplier Statements' | 'Supplier Returns / Credit Notes' | 'Financial Reports' | 'Creditor BI Warnings' | 'Activity / Audit';

const tabs: TabId[] = ['Supplier List', 'Supplier Credit Profiles', 'Supplier Bills / Invoices', 'Creditors Ageing', 'Supplier Payments', 'COGS Reserve', 'Purchase Commitments', 'Supplier Statements', 'Supplier Returns / Credit Notes', 'Financial Reports', 'Creditor BI Warnings', 'Activity / Audit'];

export default function PosCreditors({ session }: { session?: PosSession }) {
  const [activeTab, setActiveTab] = useState<TabId>('Supplier Credit Profiles');
  const [hasCreditorRecords, setHasCreditorRecords] = useState(false);
  const context = useMemo<RepositoryOperationContext>(() => {
    const vendorId = session?.vendorId || getActiveVendorId();
    return { vendorId, branchId: session?.branchId, warehouseId: session?.warehouseId, terminalId: session?.terminalId, staffId: session?.staffId, actorId: session?.staffId || session?.staffName || 'creditors-user', actorRole: session?.role, sourceApp: 'ITRED_POS', correlationId: `creditors-ui-${vendorId}-${session?.staffId || 'user'}` };
  }, [session?.branchId, session?.role, session?.staffId, session?.staffName, session?.terminalId, session?.vendorId, session?.warehouseId]);
  const purchasing = usePurchasingData({ context });

  useEffect(() => {
    setHasCreditorRecords(purchasing.firebaseMode
      ? purchasing.suppliers.length + purchasing.supplierInvoices.length + purchasing.supplierPayments.length > 0
      : getSupplierCreditProfiles().length > 0 || getSupplierBills().length > 0 || getSupplierPayments().length > 0);
  }, [activeTab, purchasing.firebaseMode, purchasing.supplierInvoices.length, purchasing.supplierPayments.length, purchasing.suppliers.length]);

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

      {purchasing.firebaseMode && purchasing.loading && <section className="creditors-panel"><div className="creditors-notice">Loading canonical supplier purchasing records…</div></section>}
      {purchasing.firebaseMode && purchasing.error && <section className="creditors-panel"><div className="creditors-notice">{purchasing.error}</div></section>}

      {!hasCreditorRecords && (
        <section className="creditors-panel">
          <div className="creditors-notice">No creditors recorded yet.</div>
        </section>
      )}

      {purchasing.firebaseMode && (activeTab === 'Supplier List' || activeTab === 'Supplier Credit Profiles') && (
        <section className="creditors-panel"><div className="creditors-panel-header"><div><span>Firebase Supplier Centre</span><h3>Canonical suppliers</h3></div></div><div className="creditors-list">
          {purchasing.suppliers.map((supplier) => <div key={supplier.supplierId} className="creditors-notice"><strong>{supplier.supplierCode} — {supplier.supplierName}</strong><div>{supplier.email || supplier.phone || 'No contact'} · {supplier.status}</div>{supplier.status === 'ACTIVE' && <button type="button" disabled={purchasing.saving} onClick={() => void purchasing.deactivateSupplier(supplier.supplierId)}>Deactivate</button>}</div>)}
        </div></section>
      )}
      {!purchasing.firebaseMode && (activeTab === 'Supplier List' || activeTab === 'Supplier Credit Profiles') && <SupplierCreditProfilePanel />}
      {purchasing.firebaseMode && activeTab === 'Supplier Bills / Invoices' && <section className="creditors-panel"><div className="creditors-panel-header"><div><span>Firebase Supplier Invoice</span><h3>Canonical invoices</h3></div></div>{purchasing.supplierInvoices.map((invoice) => <div key={invoice.invoiceId} className="creditors-notice"><strong>{invoice.supplierInvoiceNumber}</strong> · {invoice.currency} {invoice.outstandingBalance.toFixed(2)} · {invoice.status}{['Draft', 'PendingApproval'].includes(invoice.status) && <button type="button" disabled={purchasing.saving} onClick={() => void purchasing.approveSupplierInvoice(invoice.invoiceId)}>Approve</button>}</div>)}</section>}
      {!purchasing.firebaseMode && activeTab === 'Supplier Bills / Invoices' && <SupplierBillsPanel />}
      {activeTab === 'Creditors Ageing' && <CreditorsAgeingPanel />}
      {purchasing.firebaseMode && activeTab === 'Supplier Payments' && <section className="creditors-panel"><div className="creditors-panel-header"><div><span>Firebase Supplier Payment</span><h3>Immutable posted payments</h3></div></div>{purchasing.supplierPayments.map((payment) => <div key={payment.paymentId} className="creditors-notice"><strong>{payment.paymentNumber}</strong> · {payment.currency} {payment.amount.toFixed(2)} · {payment.paymentMethod} · {payment.status}</div>)}</section>}
      {!purchasing.firebaseMode && activeTab === 'Supplier Payments' && <SupplierPaymentsPanel />}
      {activeTab === 'COGS Reserve' && <COGSReservePanel />}
      {activeTab === 'Purchase Commitments' && <PurchaseCommitmentsPanel />}
      {purchasing.firebaseMode && activeTab === 'Supplier Statements' && <section className="creditors-panel"><div className="creditors-panel-header"><div><span>Firebase Supplier Statement</span><h3>Derived transaction statements</h3></div></div>{purchasing.suppliers.map((supplier) => <button key={supplier.supplierId} type="button" disabled={purchasing.saving} onClick={() => void purchasing.refresh({ supplierId: supplier.supplierId })}>{supplier.supplierName}</button>)}{purchasing.supplierStatements.map((statement) => <div key={statement.statementId} className="creditors-notice">Opening {statement.openingBalance.toFixed(2)} · Closing {statement.closingBalance.toFixed(2)} · {statement.entries.length} entries</div>)}</section>}
      {!purchasing.firebaseMode && activeTab === 'Supplier Statements' && <SupplierStatementsPanel />}
      {purchasing.firebaseMode && activeTab === 'Supplier Returns / Credit Notes' && <section className="creditors-panel"><div className="creditors-panel-header"><div><span>Firebase Supplier Return</span><h3>Canonical returns and credits</h3></div></div>{purchasing.supplierReturns.map((record) => <div key={record.supplierReturnId} className="creditors-notice"><strong>{record.supplierReturnNumber}</strong> · {record.supplierName} · {record.status} · {record.totalReturnValue.toFixed(2)}</div>)}</section>}
      {!purchasing.firebaseMode && activeTab === 'Supplier Returns / Credit Notes' && <SupplierReturnsCreditNotesPanel />}
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
