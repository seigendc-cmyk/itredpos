import { useEffect, useState } from 'react';
import { CheckCircle, FileText, XCircle } from 'lucide-react';
import RowActionMenu from './RowActionMenu';
import type { OwnerFinancialDecision } from '../types';
import { getOwnerFinancialDecisions, updateOwnerFinancialDecisionStatus } from '../services/cashPlanService';

const money = (value: number) => `$${value.toFixed(2)}`;

export default function OwnerFinancialDecisionsPanel() {
  const [rows, setRows] = useState<OwnerFinancialDecision[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = async () => setRows(await getOwnerFinancialDecisions());

  useEffect(() => {
    void load();
  }, []);

  const updateStatus = async (decision: OwnerFinancialDecision, status: OwnerFinancialDecision['status']) => {
    setRows(await updateOwnerFinancialDecisionStatus(decision.decisionId, status));
  };

  return (
    <div className="bg-white border border-slate-200">
      <div className="p-4 border-b border-slate-200">
        <h3 className="text-sm font-black uppercase tracking-wider text-slate-800">Owner Financial Decisions</h3>
        <p className="text-xs text-slate-500">Decision rows can convert to task, approval, or source-module action.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider">
            <tr><th className="p-3 text-left">Decision</th><th className="p-3 text-left">Source</th><th className="p-3 text-right">Amount</th><th className="p-3 text-left">Risk</th><th className="p-3 text-left">Status</th><th className="p-3 text-left">Action</th></tr>
          </thead>
          <tbody>
            {rows.map((decision) => (
              <tr key={decision.decisionId} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="p-3"><div className="font-bold text-slate-800">{decision.title}</div><div className="text-slate-500">{decision.recommendedAction}</div></td>
                <td className="p-3">{decision.sourceModule}</td>
                <td className="p-3 text-right">{money(decision.amount)}</td>
                <td className="p-3">{decision.riskLevel}</td>
                <td className="p-3">{decision.status}</td>
                <td className="p-3">
                  <RowActionMenu
                    ariaLabel={`${decision.decisionNumber} actions`}
                    open={openId === decision.decisionId}
                    onOpenChange={(open) => setOpenId(open ? decision.decisionId : null)}
                    items={[
                      { label: 'Approve Decision', icon: <CheckCircle className="w-3 h-3" />, onClick: () => void updateStatus(decision, 'Approved') },
                      { label: 'Reject Decision', icon: <XCircle className="w-3 h-3" />, danger: true, onClick: () => void updateStatus(decision, 'Rejected') },
                      { label: 'Convert To Task', icon: <FileText className="w-3 h-3" />, onClick: () => void updateStatus(decision, 'ConvertedToTask') },
                      { label: 'Convert To Approval', onClick: () => void updateStatus(decision, 'ConvertedToApproval') }
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
