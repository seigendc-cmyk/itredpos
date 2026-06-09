import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  DollarSign,
  Download,
  Eye,
  Lock,
  RefreshCw,
  ShieldAlert,
  UserCheck,
  XCircle
} from 'lucide-react';
import {
  EODChecklistItem,
  EODReconciliationRow,
  OwnerActivityEvent,
  OwnerApprovalItem,
  OwnerApprovalStatus,
  OwnerBIAlert,
  OwnerSummary,
  PosSession,
  TerminalEODSummary
} from '../types/posTypes';
import {
  attemptLockDay,
  exportEODReportPlaceholder,
  getEODChecklist,
  getEODReconciliationRows,
  getOwnerActivityEvents,
  getOwnerApprovals,
  getOwnerBIAlerts,
  getOwnerSummary,
  getTerminalEODSummary,
  recordOwnerActivity,
  runEODCheck,
  updateOwnerApprovalStatus
} from '../services/ownerService';

interface PosOwnerDeskProps {
  session?: PosSession;
}

type FeedbackType = 'success' | 'warning' | 'error';

const statusClass: Record<string, string> = {
  Passed: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  Warning: 'bg-amber-50 text-amber-900 border-amber-300',
  Failed: 'bg-rose-50 text-rose-800 border-rose-300',
  Pending: 'bg-slate-100 text-slate-700 border-slate-300',
  Balanced: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  Variance: 'bg-amber-50 text-amber-900 border-amber-300',
  Review: 'bg-orange-50 text-orange-800 border-orange-300',
  Synced: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  Conflict: 'bg-rose-50 text-rose-800 border-rose-300',
  'Pending Sync': 'bg-amber-50 text-amber-900 border-amber-300',
  Open: 'bg-orange-50 text-orange-800 border-orange-300',
  Approved: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  Rejected: 'bg-rose-50 text-rose-800 border-rose-300',
  Reviewed: 'bg-blue-50 text-blue-800 border-blue-300',
  Escalated: 'bg-amber-50 text-amber-900 border-amber-300'
};

const riskClass: Record<string, string> = {
  Low: 'bg-slate-100 text-slate-700 border-slate-300',
  Medium: 'bg-blue-50 text-blue-800 border-blue-300',
  High: 'bg-amber-50 text-amber-900 border-amber-300',
  Critical: 'bg-rose-50 text-rose-800 border-rose-300'
};

export default function PosOwnerDesk({ session }: PosOwnerDeskProps) {
  const [summary, setSummary] = useState<OwnerSummary | null>(null);
  const [checklist, setChecklist] = useState<EODChecklistItem[]>([]);
  const [reconciliationRows, setReconciliationRows] = useState<EODReconciliationRow[]>([]);
  const [terminalRows, setTerminalRows] = useState<TerminalEODSummary[]>([]);
  const [approvals, setApprovals] = useState<OwnerApprovalItem[]>([]);
  const [biAlerts, setBIAlerts] = useState<OwnerBIAlert[]>([]);
  const [activityEvents, setActivityEvents] = useState<OwnerActivityEvent[]>([]);
  const [feedback, setFeedback] = useState<{ type: FeedbackType; message: string } | null>(null);

  const staffName = session?.staffName || 'Admin User';
  const vendorName = session?.vendor || 'SCI Logistics Ltd';
  const branchName = session?.branch || 'Harare Main';
  const terminalName = session?.terminal || 'POS-01';

  const failedChecklistCount = useMemo(
    () => checklist.filter((item) => item.status === 'Failed').length,
    [checklist]
  );

  useEffect(() => {
    void loadOwnerDesk();
  }, []);

  const loadOwnerDesk = async () => {
    const [
      nextSummary,
      nextChecklist,
      nextReconRows,
      nextTerminalRows,
      nextApprovals,
      nextAlerts,
      nextActivity
    ] = await Promise.all([
      getOwnerSummary(),
      getEODChecklist(),
      getEODReconciliationRows(),
      getTerminalEODSummary(),
      getOwnerApprovals(),
      getOwnerBIAlerts(),
      getOwnerActivityEvents()
    ]);

    setSummary(nextSummary);
    setChecklist(nextChecklist);
    setReconciliationRows(nextReconRows);
    setTerminalRows(nextTerminalRows);
    setApprovals(nextApprovals);
    setBIAlerts(nextAlerts);
    setActivityEvents(nextActivity);
  };

  const showFeedback = (type: FeedbackType, message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000);
  };

  const refreshActivity = async () => {
    setActivityEvents(await getOwnerActivityEvents());
  };

  const handleRunEODCheck = async () => {
    setChecklist(await runEODCheck(staffName));
    setActivityEvents(await getOwnerActivityEvents());
    showFeedback('success', 'EOD readiness checklist refreshed.');
  };

  const handleRecordAction = async (
    eventType: 'OWNER_BI_REVIEW_STARTED' | 'OWNER_CASH_VARIANCE_REVIEWED' | 'OWNER_SYNC_REVIEW_STARTED',
    message: string
  ) => {
    setActivityEvents(await recordOwnerActivity(eventType, message, staffName));
    showFeedback('success', message);
  };

  const handleApprovalAction = async (approvalId: string, status: OwnerApprovalStatus) => {
    setApprovals(await updateOwnerApprovalStatus(approvalId, status, staffName));
    await refreshActivity();
    showFeedback('success', `Approval ${approvalId} updated to ${status}.`);
  };

  const handleLockDay = async () => {
    const result = await attemptLockDay(checklist, staffName);
    setActivityEvents(result.activity);
    showFeedback(result.success ? 'success' : 'error', result.message);
  };

  const handleExportReport = async () => {
    const result = await exportEODReportPlaceholder(staffName);
    setActivityEvents(result.activity);
    showFeedback('success', result.message);
  };

  const metricRows = summary
    ? [
        { label: 'Today Sales', value: summary.todaySales },
        { label: 'Gross Margin Placeholder', value: summary.grossMarginPlaceholder },
        { label: 'Cash Expected', value: summary.cashExpected },
        { label: 'Cash Declared', value: summary.cashDeclared },
        { label: 'Cash Variance', value: summary.cashVariance },
        { label: 'Open Approvals', value: summary.openApprovals.toString() },
        { label: 'Stock Risk Flags', value: summary.stockRiskFlags.toString() },
        { label: 'Pending Sync Items', value: summary.pendingSyncItems.toString() },
        { label: 'Completed Deliveries', value: summary.completedDeliveries.toString() },
        { label: 'WhatsApp Leads', value: summary.whatsAppLeads.toString() },
        { label: 'Converted Orders', value: summary.convertedOrders.toString() },
        { label: 'EOD Status', value: summary.eodStatus }
      ]
    : [];

  return (
    <div className="space-y-6 font-mono text-xs text-[#111827] select-none pb-12">
      <div className="bg-white border-2 border-[#b1b5c2] p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <div className="text-[9px] font-black text-orange-600 uppercase tracking-widest">Owner Desk</div>
          <h1 className="text-base font-black text-[#1e222b] uppercase flex items-center gap-2 mt-1">
            <BarChart3 className="w-5 h-5 text-orange-500" />
            Day-End Control and Business Oversight
          </h1>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2 text-[10px] text-slate-500">
            <span><strong>Vendor:</strong> <span className="font-bold text-[#1e222b]">{vendorName}</span></span>
            <span><strong>Branch:</strong> <span className="font-bold text-[#1e222b]">{branchName}</span></span>
            <span><strong>Terminal:</strong> <span className="font-bold text-[#1e222b]">{terminalName}</span></span>
            <span><strong>Staff:</strong> <span className="font-bold text-[#1e222b]">{staffName}</span></span>
            <span><strong>Mode:</strong> <span className="bg-orange-50 text-orange-700 border border-orange-200 px-1 font-bold">Local Prototype</span></span>
          </div>
        </div>
        <div className="bg-[#1e222b] text-white border-2 border-[#1e222b] px-4 py-3 text-[10px] uppercase font-black">
          EOD Failed Checks: <span className="text-orange-400">{failedChecklistCount}</span>
        </div>
      </div>

      {feedback && (
        <div className={`p-4 border-l-4 flex items-start gap-3 ${
          feedback.type === 'success'
            ? 'bg-emerald-50 border-l-emerald-600 border border-emerald-200 text-emerald-900'
            : feedback.type === 'warning'
            ? 'bg-amber-50 border-l-amber-500 border border-amber-200 text-amber-900'
            : 'bg-rose-50 border-l-rose-600 border border-rose-200 text-rose-900'
        }`}>
          {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
          <div>
            <span className="font-black uppercase text-[10px] block">Owner Desk Notice</span>
            <span className="font-semibold">{feedback.message}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
        {metricRows.map((metric) => (
          <div key={metric.label} className="bg-white border border-[#b1b5c2] border-l-4 border-l-orange-500 p-3 h-[88px] flex flex-col justify-between">
            <span className="text-[8.5px] font-black text-slate-500 uppercase tracking-tight truncate" title={metric.label}>{metric.label}</span>
            <span className="text-base font-black text-[#1e222b] leading-tight truncate" title={metric.value}>{metric.value}</span>
            <span className="text-[8px] text-slate-400 uppercase">Daily control metric</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-8 space-y-6">
          <Panel title="Day-End Readiness Checklist" icon={<ClipboardCheck className="w-4 h-4 text-orange-500" />}>
            <Table>
              <thead>
                <tr>
                  <Th>Check</Th>
                  <Th>Status</Th>
                  <Th>Owner Action</Th>
                  <Th>Notes</Th>
                </tr>
              </thead>
              <tbody>
                {checklist.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <Td strong>{item.label}</Td>
                    <Td><Badge value={item.status} /></Td>
                    <Td>
                      <button className="px-2 py-1 bg-orange-600 hover:bg-orange-700 text-white text-[9px] font-black uppercase">
                        {item.ownerAction}
                      </button>
                    </Td>
                    <Td>{item.notes}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Panel>

          <Panel title="Day-End Reconciliation" icon={<DollarSign className="w-4 h-4 text-orange-500" />}>
            <Table>
              <thead>
                <tr>
                  <Th>Domain</Th>
                  <Th>Expected</Th>
                  <Th>Actual</Th>
                  <Th>Variance</Th>
                  <Th>Status</Th>
                  <Th>Required Action</Th>
                </tr>
              </thead>
              <tbody>
                {reconciliationRows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <Td strong>{row.domain}</Td>
                    <Td>{row.expected}</Td>
                    <Td>{row.actual}</Td>
                    <Td>{row.variance}</Td>
                    <Td><Badge value={row.status} /></Td>
                    <Td>{row.requiredAction}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Panel>

          <Panel title="Branch and Terminal Summary" icon={<UserCheck className="w-4 h-4 text-orange-500" />}>
            <Table>
              <thead>
                <tr>
                  <Th>Branch</Th>
                  <Th>Terminal</Th>
                  <Th>Staff</Th>
                  <Th>Shift Status</Th>
                  <Th>Sales</Th>
                  <Th>Expected Cash</Th>
                  <Th>Declared Cash</Th>
                  <Th>Variance</Th>
                  <Th>Sync Status</Th>
                  <Th>Action</Th>
                </tr>
              </thead>
              <tbody>
                {terminalRows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <Td strong>{row.branch}</Td>
                    <Td>{row.terminal}</Td>
                    <Td>{row.staff}</Td>
                    <Td><Badge value={row.shiftStatus} /></Td>
                    <Td>{row.sales}</Td>
                    <Td>{row.expectedCash}</Td>
                    <Td>{row.declaredCash}</Td>
                    <Td>{row.variance}</Td>
                    <Td><Badge value={row.syncStatus} /></Td>
                    <Td>{row.action}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Panel>

          <Panel title="Approval Control" icon={<ShieldAlert className="w-4 h-4 text-orange-500" />}>
            <Table>
              <thead>
                <tr>
                  <Th>Approval ID</Th>
                  <Th>Type</Th>
                  <Th>Requested By</Th>
                  <Th>Amount / Value</Th>
                  <Th>Risk</Th>
                  <Th>Status</Th>
                  <Th>Action</Th>
                </tr>
              </thead>
              <tbody>
                {approvals.map((approval) => (
                  <tr key={approval.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <Td strong>{approval.id}</Td>
                    <Td>{approval.type}</Td>
                    <Td>{approval.requestedBy}</Td>
                    <Td>{approval.amountOrValue}</Td>
                    <Td><Badge value={approval.risk} risk /></Td>
                    <Td><Badge value={approval.status} /></Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        <SmallAction onClick={() => handleApprovalAction(approval.id, 'Approved')}>Approve</SmallAction>
                        <SmallAction onClick={() => handleApprovalAction(approval.id, 'Rejected')}>Reject</SmallAction>
                        <SmallAction onClick={() => handleApprovalAction(approval.id, 'Reviewed')}>Mark Reviewed</SmallAction>
                        <SmallAction onClick={() => handleApprovalAction(approval.id, 'Escalated')}>Escalate</SmallAction>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Panel>
        </div>

        <div className="xl:col-span-4 space-y-6">
          <Panel title="Owner BI Alerts" icon={<AlertTriangle className="w-4 h-4 text-orange-500" />}>
            <div className="space-y-3">
              {biAlerts.map((alert) => (
                <div key={alert.id} className="border border-[#b1b5c2] bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-black text-[#1e222b] uppercase text-[10px] leading-tight">{alert.eventType}</span>
                    <Badge value={alert.severity} risk />
                  </div>
                  <p className="text-[10.5px] text-slate-600 font-semibold mt-2">{alert.message}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="EOD Actions" icon={<RefreshCw className="w-4 h-4 text-orange-500" />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-2.5">
              <ActionButton icon={<RefreshCw className="w-4 h-4" />} onClick={handleRunEODCheck}>Run EOD Check</ActionButton>
              <ActionButton icon={<Eye className="w-4 h-4" />} onClick={() => handleRecordAction('OWNER_BI_REVIEW_STARTED', 'BI review started.')}>Review Critical BI</ActionButton>
              <ActionButton icon={<DollarSign className="w-4 h-4" />} onClick={() => handleRecordAction('OWNER_CASH_VARIANCE_REVIEWED', 'Cash variance under review.')}>Review Cash Variance</ActionButton>
              <ActionButton icon={<ClipboardCheck className="w-4 h-4" />} onClick={() => handleRecordAction('OWNER_SYNC_REVIEW_STARTED', 'Sync review started.')}>Review Pending Sync</ActionButton>
              <ActionButton icon={<Lock className="w-4 h-4" />} onClick={handleLockDay}>Lock Day Placeholder</ActionButton>
              <ActionButton icon={<Download className="w-4 h-4" />} onClick={handleExportReport}>Export EOD Report Placeholder</ActionButton>
            </div>
          </Panel>

          <Panel title="Owner Activity Feed" icon={<CheckCircle2 className="w-4 h-4 text-orange-500" />}>
            <div className="space-y-3 max-h-[430px] overflow-y-auto pos-custom-scroll">
              {activityEvents.map((event) => (
                <div key={event.id} className="border-l-4 border-l-orange-500 bg-slate-50 border border-[#b1b5c2] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-black text-[#1e222b] uppercase text-[9.5px]">{event.eventType}</span>
                    <span className="text-[8px] text-slate-400 font-bold">{event.timestamp.includes('T') ? event.timestamp.slice(11, 19) : event.timestamp}</span>
                  </div>
                  <p className="text-[10px] text-slate-600 font-semibold mt-1">{event.message}</p>
                  <span className="text-[8px] text-slate-400 uppercase font-black">Operator: {event.operator}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white border-2 border-[#b1b5c2] shadow-sm">
      <div className="bg-[#1e222b] text-white p-3 font-extrabold uppercase text-[9.5px] flex items-center gap-2">
        {icon}
        <span>{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">{children}</table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="p-3 bg-slate-100 text-[8.5px] font-black uppercase text-slate-500 border-b border-[#b1b5c2] whitespace-nowrap">{children}</th>;
}

function Td({ children, strong }: { children: React.ReactNode; strong?: boolean }) {
  return <td className={`p-3 text-[10px] text-slate-600 whitespace-nowrap ${strong ? 'font-black text-[#1e222b]' : 'font-semibold'}`}>{children}</td>;
}

function Badge({ value, risk = false }: { value: string; risk?: boolean }) {
  const classes = risk ? riskClass[value] : statusClass[value];
  const Icon = value === 'Failed' || value === 'Critical' ? XCircle : value === 'Passed' || value === 'Balanced' ? CheckCircle2 : AlertTriangle;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 border text-[8px] uppercase font-black ${classes || 'bg-slate-100 text-slate-700 border-slate-300'}`}>
      <Icon className="w-3 h-3" />
      {value}
    </span>
  );
}

function SmallAction({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="px-1.5 py-0.5 bg-white border border-[#b1b5c2] hover:bg-orange-50 text-[#1e222b] font-black uppercase text-[8px]">
      {children}
    </button>
  );
}

function ActionButton({ children, icon, onClick }: { children: React.ReactNode; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full min-h-[48px] bg-orange-600 hover:bg-orange-700 text-white border border-orange-700 px-3 py-2 text-left font-black uppercase text-[10px] flex items-center gap-2">
      {icon}
      <span>{children}</span>
    </button>
  );
}
