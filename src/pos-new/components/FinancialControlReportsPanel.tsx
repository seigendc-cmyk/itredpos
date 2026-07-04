import { useEffect, useMemo, useState } from 'react';
import type { PosSession } from '../types';
import { getBIAdviceRecords } from '../services/biAdviceService';
import { getCOGSReserveMovements, getCOGSReserveSummary } from '../services/cogsReserveService';
import { getCreditorAgeingSummary, getCreditorRiskHeatMap, getSupplierBills, getSupplierCreditProfiles, getSupplierPayments, getSupplierStatementHistory } from '../services/creditorsService';
import { exportRowsToCsv } from '../services/exportService';
import { getCOGSBuyingCapacitySummary, getPurchaseDisciplineActivityEvents, getPurchaseDisciplineRequests, getReorderProtectionRules, getSupplierPurchaseCommitments } from '../services/purchaseDisciplineService';
import OwnerFinancialControlSummaryReport from './OwnerFinancialControlSummaryReport';
import ReportPrintDocument, { type ReportColumn, type ReportMetric } from './ReportPrintDocument';

type ReportId =
  | 'ownerSummary'
  | 'supplierBalances'
  | 'creditorAgeing'
  | 'supplierPayments'
  | 'supplierStatements'
  | 'cogsReserve'
  | 'purchaseDiscipline'
  | 'purchaseCommitments'
  | 'supplierRisk'
  | 'auditActivity';

interface ReportOption {
  id: ReportId;
  title: string;
  group: string;
  description: string;
}

interface GeneratedReport {
  title: string;
  reportNumber: string;
  columns: ReportColumn[];
  rows: Record<string, string | number>[];
  summary: ReportMetric[];
  notes: string[];
}

const reportOptions: ReportOption[] = [
  { id: 'ownerSummary', title: 'Owner Financial Control Summary', group: 'Owner Control', description: 'Drawer, debtors, creditors, reserve and purchase pressure in one review output.' },
  { id: 'supplierBalances', title: 'Supplier Balance Report', group: 'Creditors', description: 'Supplier credit limits, payables, overdue balance and available credit.' },
  { id: 'creditorAgeing', title: 'Creditor Ageing Report', group: 'Creditors', description: 'Outstanding supplier bills by due date, bucket and overdue status.' },
  { id: 'supplierPayments', title: 'Supplier Payment Report', group: 'Payments', description: 'Supplier payment method, source, reserve and cash-drawer impact.' },
  { id: 'supplierStatements', title: 'Supplier Statement Register', group: 'Statements', description: 'Generated supplier statement history with period and closing balance.' },
  { id: 'cogsReserve', title: 'COGS Reserve Movement Report', group: 'COGS Reserve', description: 'Reserve recovered, released, adjusted, leaked and protected by movement.' },
  { id: 'purchaseDiscipline', title: 'Purchase Discipline Requests', group: 'Purchase Discipline', description: 'Reorder risk checks, approval status and protection decisions.' },
  { id: 'purchaseCommitments', title: 'Supplier Purchase Commitments', group: 'Purchase Discipline', description: 'Open commitments, reserve needed and linked purchase workflow status.' },
  { id: 'supplierRisk', title: 'Supplier BI Risk Report', group: 'BI Risk', description: 'Supplier / purchase discipline BI advice and supplier risk heat-map rows.' },
  { id: 'auditActivity', title: 'Financial Control Audit Trail', group: 'Audit', description: 'Purchase discipline activity and reserve control events for review/export.' }
];

const money = (value: number) => `$${value.toFixed(2)}`;
const today = () => new Date().toISOString().slice(0, 10);

function reportNumber(id: ReportId): string {
  const key = `itred_pos_report_number_${id}_v1`;
  if (typeof localStorage === 'undefined') return `RPT-${id.toUpperCase()}-0001`;
  const next = Number(localStorage.getItem(key) || '0') + 1;
  localStorage.setItem(key, String(next));
  return `RPT-${id.toUpperCase()}-${String(next).padStart(4, '0')}`;
}

function inPeriod(dateValue: string | undefined, from: string, to: string): boolean {
  if (!dateValue) return true;
  const date = dateValue.slice(0, 10);
  return (!from || date >= from) && (!to || date <= to);
}

function total(rows: Record<string, string | number>[], key: string): number {
  return rows.reduce((sum, row) => sum + Number(row[key] || 0), 0);
}

export default function FinancialControlReportsPanel({ session }: { session?: PosSession }) {
  const [activeReportId, setActiveReportId] = useState<ReportId>('ownerSummary');
  const [periodFrom, setPeriodFrom] = useState(today());
  const [periodTo, setPeriodTo] = useState(today());
  const [search, setSearch] = useState('');
  const [generated, setGenerated] = useState<GeneratedReport | null>(null);
  const selected = useMemo(() => reportOptions.find((option) => option.id === activeReportId) || reportOptions[0], [activeReportId]);

  useEffect(() => {
    setGenerated(null);
  }, [activeReportId, periodFrom, periodTo]);

  async function buildReport(id: ReportId): Promise<GeneratedReport> {
    const notes = ['Review report only. No banking, supplier API, PDF package, or final accounting posting is used.'];
    if (id === 'supplierBalances') {
      const rows = getSupplierCreditProfiles({ search }).map((profile) => ({
        supplier: profile.supplierName,
        code: profile.supplierCode,
        status: profile.creditStatus,
        limit: profile.supplierCreditLimit,
        payable: profile.currentPayableBalance,
        overdue: profile.overduePayableBalance,
        available: profile.availableSupplierCredit,
        terms: `${profile.paymentTermsDays} days`
      }));
      return {
        title: selected.title,
        reportNumber: reportNumber(id),
        columns: [
          { key: 'supplier', header: 'Supplier' }, { key: 'code', header: 'Code' }, { key: 'status', header: 'Status' },
          { key: 'limit', header: 'Limit', align: 'right' }, { key: 'payable', header: 'Payable', align: 'right' },
          { key: 'overdue', header: 'Overdue', align: 'right' }, { key: 'available', header: 'Available', align: 'right' }, { key: 'terms', header: 'Terms' }
        ],
        rows,
        summary: [{ label: 'Suppliers', value: String(rows.length) }, { label: 'Payable', value: money(total(rows, 'payable')) }, { label: 'Overdue', value: money(total(rows, 'overdue')) }],
        notes
      };
    }
    if (id === 'creditorAgeing') {
      const ageing = getCreditorAgeingSummary();
      const rows = getSupplierBills({ search }).filter((bill) => inPeriod(bill.billDate, periodFrom, periodTo)).map((bill) => ({
        supplier: bill.supplierName,
        bill: bill.billNumber,
        invoice: bill.supplierInvoiceNumber,
        date: bill.billDate,
        dueDate: bill.dueDate,
        bucket: bill.ageingBucket,
        status: bill.status,
        original: bill.originalAmount,
        paid: bill.paidAmount,
        outstanding: bill.outstandingAmount
      }));
      return {
        title: selected.title,
        reportNumber: reportNumber(id),
        columns: [
          { key: 'supplier', header: 'Supplier' }, { key: 'bill', header: 'Bill' }, { key: 'invoice', header: 'Invoice' }, { key: 'date', header: 'Date' },
          { key: 'dueDate', header: 'Due' }, { key: 'bucket', header: 'Bucket' }, { key: 'status', header: 'Status' }, { key: 'outstanding', header: 'Outstanding', align: 'right' }
        ],
        rows,
        summary: [
          { label: 'Total Payables', value: money(ageing.totalPayables) }, { label: 'Current', value: money(ageing.current) },
          { label: '31-60', value: money(ageing.days31To60) }, { label: '120+', value: money(ageing.days120Plus) }
        ],
        notes
      };
    }
    if (id === 'supplierPayments') {
      const rows = getSupplierPayments().filter((payment) => inPeriod(payment.paymentDate, periodFrom, periodTo)).map((payment) => ({
        date: payment.paymentDate,
        payment: payment.paymentNumber,
        supplier: payment.supplierName,
        method: payment.paymentMethod,
        source: payment.source,
        reserve: payment.cogsReserveAmount,
        nonReserve: payment.nonReserveAmount,
        amount: payment.amount,
        status: payment.status
      }));
      return {
        title: selected.title,
        reportNumber: reportNumber(id),
        columns: [
          { key: 'date', header: 'Date' }, { key: 'payment', header: 'Payment' }, { key: 'supplier', header: 'Supplier' }, { key: 'method', header: 'Method' },
          { key: 'source', header: 'Source' }, { key: 'reserve', header: 'Reserve', align: 'right' }, { key: 'nonReserve', header: 'Non-Reserve', align: 'right' },
          { key: 'amount', header: 'Amount', align: 'right' }, { key: 'status', header: 'Status' }
        ],
        rows,
        summary: [{ label: 'Payments', value: String(rows.length) }, { label: 'Total Paid', value: money(total(rows, 'amount')) }, { label: 'COGS Reserve Used', value: money(total(rows, 'reserve')) }],
        notes
      };
    }
    if (id === 'supplierStatements') {
      const rows = getSupplierStatementHistory().filter((statement) => inPeriod(statement.generatedAt, periodFrom, periodTo)).map((statement) => ({
        statement: statement.statementId,
        supplier: statement.supplierName,
        period: `${statement.periodFrom} to ${statement.periodTo}`,
        bills: statement.bills.length,
        payments: statement.payments.length,
        opening: statement.openingBalance,
        closing: statement.closingBalance,
        generatedBy: statement.generatedBy,
        generatedAt: statement.generatedAt.slice(0, 10)
      }));
      return {
        title: selected.title,
        reportNumber: reportNumber(id),
        columns: [
          { key: 'statement', header: 'Statement' }, { key: 'supplier', header: 'Supplier' }, { key: 'period', header: 'Period' },
          { key: 'bills', header: 'Bills', align: 'right' }, { key: 'payments', header: 'Payments', align: 'right' },
          { key: 'closing', header: 'Closing', align: 'right' }, { key: 'generatedBy', header: 'Generated By' }, { key: 'generatedAt', header: 'Generated' }
        ],
        rows,
        summary: [{ label: 'Statements', value: String(rows.length) }, { label: 'Closing Balance', value: money(total(rows, 'closing')) }],
        notes
      };
    }
    if (id === 'cogsReserve') {
      const reserve = getCOGSReserveSummary();
      const rows = getCOGSReserveMovements({ from: periodFrom, to: periodTo }).map((movement) => ({
        date: movement.movementDate,
        number: movement.movementNumber,
        type: movement.type,
        direction: movement.direction,
        reference: movement.sourceReferenceNumber,
        supplier: movement.supplierName || '',
        amount: movement.amount,
        balance: movement.reserveBalanceAfter,
        protected: movement.protected ? 'Yes' : 'No',
        approval: movement.requiresApproval ? 'Required' : 'No'
      }));
      return {
        title: selected.title,
        reportNumber: reportNumber(id),
        columns: [
          { key: 'date', header: 'Date' }, { key: 'number', header: 'Movement' }, { key: 'type', header: 'Type' }, { key: 'direction', header: 'Direction' },
          { key: 'reference', header: 'Reference' }, { key: 'amount', header: 'Amount', align: 'right' }, { key: 'balance', header: 'Balance', align: 'right' },
          { key: 'protected', header: 'Protected' }, { key: 'approval', header: 'Approval' }
        ],
        rows,
        summary: [
          { label: 'Reserve Balance', value: money(reserve.currentReserveBalance) }, { label: 'Required Reserve', value: money(reserve.requiredReserveLevel) },
          { label: 'Shortfall', value: money(reserve.reserveShortfall) }, { label: 'Status', value: reserve.reserveStatus }
        ],
        notes
      };
    }
    if (id === 'purchaseDiscipline') {
      const rows = getPurchaseDisciplineRequests({ search }).filter((request) => inPeriod(request.requestedAt, periodFrom, periodTo)).map((request) => ({
        request: request.requestNumber,
        product: request.productName,
        supplier: request.supplierName || '',
        qty: request.requestedQty,
        cost: request.estimatedTotalCost,
        margin: `${request.expectedGrossMarginPercent}%`,
        movement: request.stockMovementClass,
        risk: request.riskLevel,
        decision: request.protectionDecision,
        status: request.status
      }));
      return {
        title: selected.title,
        reportNumber: reportNumber(id),
        columns: [
          { key: 'request', header: 'Request' }, { key: 'product', header: 'Product' }, { key: 'supplier', header: 'Supplier' },
          { key: 'qty', header: 'Qty', align: 'right' }, { key: 'cost', header: 'Cost', align: 'right' }, { key: 'margin', header: 'Margin' },
          { key: 'movement', header: 'Movement' }, { key: 'risk', header: 'Risk' }, { key: 'decision', header: 'Decision' }, { key: 'status', header: 'Status' }
        ],
        rows,
        summary: [{ label: 'Requests', value: String(rows.length) }, { label: 'Estimated Cost', value: money(total(rows, 'cost')) }, { label: 'Rules Active', value: String(getReorderProtectionRules().filter((rule) => rule.active).length) }],
        notes
      };
    }
    if (id === 'purchaseCommitments') {
      const capacity = getCOGSBuyingCapacitySummary();
      const rows = getSupplierPurchaseCommitments({ search }).filter((commitment) => inPeriod(commitment.commitmentDate, periodFrom, periodTo)).map((commitment) => ({
        commitment: commitment.commitmentNumber,
        supplier: commitment.supplierName,
        product: commitment.productName || '',
        date: commitment.commitmentDate,
        due: commitment.dueDate,
        amount: commitment.amount,
        reserve: commitment.reserveNeeded,
        status: commitment.status,
        risk: commitment.riskLevel
      }));
      return {
        title: selected.title,
        reportNumber: reportNumber(id),
        columns: [
          { key: 'commitment', header: 'Commitment' }, { key: 'supplier', header: 'Supplier' }, { key: 'product', header: 'Product' },
          { key: 'date', header: 'Date' }, { key: 'due', header: 'Due' }, { key: 'amount', header: 'Amount', align: 'right' },
          { key: 'reserve', header: 'Reserve Needed', align: 'right' }, { key: 'status', header: 'Status' }, { key: 'risk', header: 'Risk' }
        ],
        rows,
        summary: [{ label: 'Commitments', value: String(rows.length) }, { label: 'Committed', value: money(total(rows, 'amount')) }, { label: 'Safe Buying Capacity', value: money(capacity.safeBuyingCapacity) }],
        notes
      };
    }
    if (id === 'supplierRisk') {
      const advice = await getBIAdviceRecords({ category: 'Supplier / Purchase Discipline', search });
      const heatMap = getCreditorRiskHeatMap({ search });
      const rows = [
        ...heatMap.map((risk) => ({
          source: 'Supplier Risk Heat Map',
          reference: risk.supplierName,
          risk: risk.riskLevel,
          priority: risk.riskLevel,
          amount: risk.outstandingAmount,
          overdue: risk.overdueAmount,
          assigned: 'Manager / Owner',
          action: risk.recommendedAction
        })),
        ...advice.map((item) => ({
          source: 'BI Advice',
          reference: item.adviceNumber,
          risk: item.riskLevel,
          priority: item.priority,
          amount: 0,
          overdue: 0,
          assigned: item.assignedToRole || '',
          action: item.recommendedAction
        }))
      ];
      return {
        title: selected.title,
        reportNumber: reportNumber(id),
        columns: [
          { key: 'source', header: 'Source' }, { key: 'reference', header: 'Reference' }, { key: 'risk', header: 'Risk' }, { key: 'priority', header: 'Priority' },
          { key: 'amount', header: 'Amount', align: 'right' }, { key: 'overdue', header: 'Overdue', align: 'right' }, { key: 'assigned', header: 'Assigned' }, { key: 'action', header: 'Action' }
        ],
        rows,
        summary: [{ label: 'Risk Rows', value: String(rows.length) }, { label: 'Supplier Exposure', value: money(total(rows, 'amount')) }, { label: 'Overdue', value: money(total(rows, 'overdue')) }],
        notes
      };
    }
    const purchaseEvents = getPurchaseDisciplineActivityEvents().filter((event) => inPeriod(event.createdAt, periodFrom, periodTo));
    const cogsEvents = getCOGSReserveMovements({ from: periodFrom, to: periodTo });
    const rows = [
      ...purchaseEvents.map((event) => ({ date: event.createdAt.slice(0, 10), source: 'Purchase Discipline', event: event.eventType, reference: event.sourceReference || '', staff: event.staffId || '', notes: event.message })),
      ...cogsEvents.map((movement) => ({ date: movement.createdAt.slice(0, 10), source: 'COGS Reserve', event: movement.type, reference: movement.movementNumber, staff: movement.staffName, notes: movement.notes }))
    ];
    return {
      title: selected.title,
      reportNumber: reportNumber(id),
      columns: [
        { key: 'date', header: 'Date' }, { key: 'source', header: 'Source' }, { key: 'event', header: 'Event' },
        { key: 'reference', header: 'Reference' }, { key: 'staff', header: 'Staff' }, { key: 'notes', header: 'Notes' }
      ],
      rows,
      summary: [{ label: 'Audit Rows', value: String(rows.length) }, { label: 'Purchase Events', value: String(purchaseEvents.length) }, { label: 'Reserve Events', value: String(cogsEvents.length) }],
      notes
    };
  }

  async function handleGenerate() {
    if (activeReportId === 'ownerSummary') return;
    setGenerated(await buildReport(activeReportId));
  }

  function handleExport() {
    if (!generated) return;
    exportRowsToCsv(generated.reportNumber, generated.columns.map((column) => ({ key: column.key, header: column.header })), generated.rows as Record<string, unknown>[]);
  }

  return (
    <section className="creditors-panel financial-reports-panel">
      <div className="creditors-panel-header">
        <div>
          <span>Financial Reports</span>
          <h3>Supplier, creditor, reserve, purchase discipline and audit outputs</h3>
        </div>
        <div className="creditors-actions">
          <button type="button" onClick={() => window.print()}>Print</button>
          <button type="button" onClick={handleExport} disabled={!generated}>Export CSV</button>
        </div>
      </div>

      <div className="report-control-grid">
        <label>Report
          <select value={activeReportId} onChange={(event) => setActiveReportId(event.target.value as ReportId)}>
            {reportOptions.map((option) => <option key={option.id} value={option.id}>{option.group} - {option.title}</option>)}
          </select>
        </label>
        <label>Period From<input type="date" value={periodFrom} onChange={(event) => setPeriodFrom(event.target.value)} /></label>
        <label>Period To<input type="date" value={periodTo} onChange={(event) => setPeriodTo(event.target.value)} /></label>
        <label>Search<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="supplier, bill, risk, reference" /></label>
        <button type="button" onClick={handleGenerate} disabled={activeReportId === 'ownerSummary'}>Generate Report</button>
      </div>

      <div className="report-option-grid">
        {reportOptions.map((option) => (
          <button key={option.id} type="button" className={activeReportId === option.id ? 'active' : ''} onClick={() => setActiveReportId(option.id)}>
            <span>{option.group}</span>
            <strong>{option.title}</strong>
            <small>{option.description}</small>
          </button>
        ))}
      </div>

      {activeReportId === 'ownerSummary' ? (
        <OwnerFinancialControlSummaryReport generatedBy={session?.staffName || 'Local User'} />
      ) : generated ? (
        <ReportPrintDocument
          title={generated.title}
          reportNumber={generated.reportNumber}
          periodLabel={`${periodFrom || 'Start'} to ${periodTo || 'Today'}`}
          generatedBy={session?.staffName || 'Local User'}
          generatedAt={new Date().toISOString()}
          summary={generated.summary}
          columns={generated.columns}
          rows={generated.rows}
          notes={generated.notes}
        />
      ) : (
        <div className="creditors-notice">Choose Generate Report to build the selected financial control output.</div>
      )}
    </section>
  );
}
