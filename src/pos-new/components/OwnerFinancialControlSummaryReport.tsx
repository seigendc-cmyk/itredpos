import { useEffect, useState } from 'react';
import { getBIAdviceRecords } from '../services/biAdviceService';
import { getCashControlSummary } from '../services/cashControlService';
import { getCOGSReserveSummary } from '../services/cogsReserveService';
import { getCreditorAgeingSummary, getSupplierBills, getSupplierPayments } from '../services/creditorsService';
import { getCustomerDebtRecords } from '../services/customerCreditService';
import { getCOGSBuyingCapacitySummary, getSupplierPurchaseCommitments } from '../services/purchaseDisciplineService';

const money = (value: number) => `$${value.toFixed(2)}`;

interface OwnerSummaryState {
  expectedCash: number;
  drawerVariance: number;
  debtorOutstanding: number;
  supplierPayables: number;
  overdueSupplierBills: number;
  supplierPayments: number;
  reserveBalance: number;
  reserveShortfall: number;
  safeBuyingCapacity: number;
  activeCommitments: number;
  highRiskAdvice: number;
}

export default function OwnerFinancialControlSummaryReport({ generatedBy = 'Local User' }: { generatedBy?: string }) {
  const [summary, setSummary] = useState<OwnerSummaryState | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const [cash, debts, advice] = await Promise.all([
        getCashControlSummary(),
        getCustomerDebtRecords(),
        getBIAdviceRecords({ category: 'Supplier / Purchase Discipline' })
      ]);
      const creditors = getCreditorAgeingSummary();
      const reserve = getCOGSReserveSummary();
      const capacity = getCOGSBuyingCapacitySummary();
      const payments = getSupplierPayments().filter((payment) => payment.status === 'Paid');
      const activeCommitments = getSupplierPurchaseCommitments().filter((commitment) => !['Cancelled', 'Fulfilled'].includes(commitment.status));
      const debtorOutstanding = debts.reduce((sum, debt) => sum + debt.outstandingAmount, 0);
      if (!mounted) return;
      setSummary({
        expectedCash: cash.expectedCash,
        drawerVariance: cash.variance,
        debtorOutstanding,
        supplierPayables: creditors.totalPayables,
        overdueSupplierBills: getSupplierBills().filter((bill) => bill.overdueDays > 0 && bill.outstandingAmount > 0).length,
        supplierPayments: payments.reduce((sum, payment) => sum + payment.amount, 0),
        reserveBalance: reserve.currentReserveBalance,
        reserveShortfall: reserve.reserveShortfall,
        safeBuyingCapacity: capacity.safeBuyingCapacity,
        activeCommitments: activeCommitments.reduce((sum, commitment) => sum + commitment.amount, 0),
        highRiskAdvice: advice.filter((item) => item.priority === 'High' || item.priority === 'Critical').length
      });
    }
    void load();
    return () => { mounted = false; };
  }, []);

  if (!summary) {
    return <div className="creditors-notice">Loading owner financial control summary...</div>;
  }

  return (
    <article className="print-document owner-financial-summary">
      <header className="report-print-document__header">
        <div><span>Business</span><strong>iTred Commerce POS</strong><small>Owner financial control output</small></div>
        <div><span>Report</span><strong>Owner Financial Control Summary</strong><small>Management-control review</small></div>
        <div><span>Generated</span><strong>{new Date().toLocaleString()}</strong><small>Prepared by {generatedBy}</small></div>
      </header>
      <section className="report-print-document__summary">
        <div><span>Expected Drawer Cash</span><strong>{money(summary.expectedCash)}</strong></div>
        <div><span>Drawer Variance</span><strong>{money(summary.drawerVariance)}</strong></div>
        <div><span>Customer Debtors</span><strong>{money(summary.debtorOutstanding)}</strong></div>
        <div><span>Supplier Payables</span><strong>{money(summary.supplierPayables)}</strong></div>
        <div><span>COGS Reserve</span><strong>{money(summary.reserveBalance)}</strong></div>
        <div><span>Safe Buying Capacity</span><strong>{money(summary.safeBuyingCapacity)}</strong></div>
      </section>
      <section className="report-control-grid">
        <div>
          <span>Supplier Pressure</span>
          <strong>{summary.overdueSupplierBills} overdue bill(s)</strong>
          <p>{money(summary.supplierPayments)} paid to suppliers in payment records.</p>
        </div>
        <div>
          <span>Reserve Protection</span>
          <strong>{money(summary.reserveShortfall)} shortfall</strong>
          <p>{money(summary.activeCommitments)} active purchase commitments currently reserve-linked.</p>
        </div>
        <div>
          <span>BI Risk</span>
          <strong>{summary.highRiskAdvice} high/critical supplier advice item(s)</strong>
          <p>Review supplier, COGS reserve and purchase discipline warnings before buying stock.</p>
        </div>
      </section>
      <footer className="report-print-document__footer">
        <div><span>Owner Review</span><p>Use this output to compare drawer cash, debtors, creditors, COGS reserve, and purchase commitments before EOD/period review.</p></div>
        <div><span>Prepared By</span><strong>{generatedBy}</strong></div>
        <div><span>Signature / Review</span><strong>____________________________</strong></div>
      </footer>
    </article>
  );
}
