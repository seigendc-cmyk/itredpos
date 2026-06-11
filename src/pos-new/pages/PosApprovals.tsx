import { Check, Eye, X } from 'lucide-react';
import { useState } from 'react';
import { PosSession, RiskLevel, Role } from '../types';
import { hasPermission } from '../utils/posPermissions';

interface PosApprovalsProps {
  session: PosSession;
}

const approvalRows: Array<[string, string, string, string, RiskLevel, string, string]> = [
  ['APR-0001', 'New Customer Approval', 'Mary Cashier', 'CUST-REQ-001', 'Medium', 'Pending', '2026-06-09 09:30'],
  ['APR-0002', 'Return Approval', 'Mary Cashier', 'RET-0002', 'High', 'Pending', '2026-06-09 10:10'],
  ['APR-0003', 'Credit Note Approval', 'Tawanda Supervisor', 'CN-0001', 'High', 'Pending', '2026-06-09 10:45'],
  ['APR-0004', 'Terminal Activation', 'Admin User', 'TERM-HARARE-01', 'Medium', 'Open', '2026-06-09 11:00'],
  ['APR-0005', 'Inventory Import Approval', 'Elena Rostova', 'IMPORT-004', 'Medium', 'Pending', '2026-06-09 11:25'],
  ['APR-0006', 'Stock Adjustment Approval', 'Elena Rostova', 'ADJ-0019', 'High', 'Pending', '2026-06-09 12:05'],
  ['APR-0007', 'Price Override Approval', 'Mary Cashier', 'OVR-0007', 'Medium', 'Pending', '2026-06-09 12:40'],
  ['APR-0008', 'Delivery Provider Approval', 'Tawanda Supervisor', 'DRV-004', 'Low', 'Open', '2026-06-09 13:15'],
  ['APR-0009', 'Cash Variance Approval', 'Tawanda Supervisor', 'SHIFT-2026-06-09', 'Critical', 'Pending', '2026-06-09 13:45']
];

export default function PosApprovals({ session }: PosApprovalsProps) {
  const [notice, setNotice] = useState<string | null>(null);

  const handleAction = (permission: 'approvals.view' | 'approvals.approve' | 'approvals.reject', label: string) => {
    if (!hasPermission(session.role as Role, permission)) {
      setNotice('You do not have permission to perform this action.');
      return;
    }
    setNotice(`${label} is a build-development placeholder.`);
  };

  return (
    <div className="space-y-5 text-xs industrial-font-sans">
      <div className="bg-white border border-[#b1b5c2] p-4">
        <div className="text-[10px] text-orange-600 font-black uppercase tracking-wider">iTred Commerce POS</div>
        <h2 className="text-xl font-black text-[#1e222b] uppercase mt-1">Approvals</h2>
        <p className="text-[11px] text-slate-600 font-bold uppercase mt-1">Central approval queue placeholder</p>
      </div>

      {notice && <div className="bg-orange-50 border border-orange-300 text-orange-900 px-3 py-2 font-bold uppercase">{notice}</div>}

      <div className="bg-white border border-[#b1b5c2] overflow-x-auto">
        <table className="w-full min-w-[980px] text-left">
          <thead className="bg-[#1e222b] text-white">
            <tr>
              {['Approval ID', 'Type', 'Requested By', 'Related Record', 'Risk', 'Status', 'Requested At', 'Action'].map((heading) => (
                <th key={heading} className="px-3 py-2 text-[10px] uppercase font-black">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {approvalRows.map((row) => (
              <tr key={row[0]} className="border-t border-[#d6d9e0] text-[11px] text-slate-700">
                {row.map((value) => <td key={value} className="px-3 py-2 font-bold">{value}</td>)}
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1.5">
                    <ApprovalButton icon={Check} label="Approve Placeholder" onClick={() => handleAction('approvals.approve', 'Approve')} />
                    <ApprovalButton icon={X} label="Reject Placeholder" onClick={() => handleAction('approvals.reject', 'Reject')} />
                    <ApprovalButton icon={Eye} label="View Context Placeholder" onClick={() => handleAction('approvals.view', 'View Context')} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ApprovalButton({ icon: Icon, label, onClick }: { icon: typeof Eye; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="border border-[#b1b5c2] bg-white hover:bg-orange-50 px-2 py-1 text-[9px] font-black uppercase flex items-center gap-1">
      <Icon className="w-3 h-3 text-orange-600" />
      {label}
    </button>
  );
}
