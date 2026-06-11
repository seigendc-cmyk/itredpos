import { CheckCircle2, Eye, PlayCircle } from 'lucide-react';
import { useState } from 'react';
import { PosSession, Role } from '../types';
import { hasPermission } from '../utils/posPermissions';

interface PosTaskDeskProps {
  session: PosSession;
}

const taskRows = [
  ['Customer Approval', 'Mary Cashier', 'High', 'Customer Centre', 'CUST-REQ-001', 'Today 15:00', 'Open'],
  ['Return Approval', 'Tawanda Supervisor', 'High', 'Sales History', 'RET-0002', 'Today 16:00', 'Pending Review'],
  ['Credit Note Approval', 'John Connor', 'Medium', 'Sales History', 'CN-0001', 'Tomorrow 09:00', 'Open'],
  ['Terminal Activation', 'Admin User', 'Medium', 'Settings', 'TERM-HARARE-01', 'Tomorrow 10:30', 'Open'],
  ['Product Import Review', 'Elena Rostova', 'Medium', 'Inventory', 'IMPORT-004', 'Today 17:00', 'Pending Review'],
  ['Stocktake Review', 'Elena Rostova', 'High', 'Stocktake Desk', 'STK-2026-001', 'Today 18:00', 'Open'],
  ['Stock Adjustment Approval', 'John Connor', 'High', 'Inventory', 'ADJ-0019', 'Today 14:30', 'Pending Review'],
  ['Delivery Follow-up', 'Mary Cashier', 'Medium', 'Delivery Desk', 'DEL-005', 'Today 15:30', 'Open'],
  ['Cash Variance Review', 'Tawanda Supervisor', 'Critical', 'Cash Control', 'SHIFT-2026-06-09', 'Today 19:00', 'Open'],
  ['Price Override Approval', 'John Connor', 'Medium', 'Sales Terminal', 'OVR-0007', 'Today 13:45', 'Pending Review']
];

export default function PosTaskDesk({ session }: PosTaskDeskProps) {
  const [notice, setNotice] = useState<string | null>(null);

  const handleAction = (permission: 'tasks.view' | 'tasks.close', label: string) => {
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
        <h2 className="text-xl font-black text-[#1e222b] uppercase mt-1">Task Desk</h2>
        <p className="text-[11px] text-slate-600 font-bold uppercase mt-1">Staff Actions, Reviews, Approvals, and Operational Follow-ups</p>
      </div>

      {notice && <div className="bg-orange-50 border border-orange-300 text-orange-900 px-3 py-2 font-bold uppercase">{notice}</div>}

      <div className="bg-white border border-[#b1b5c2] overflow-x-auto">
        <table className="w-full min-w-[980px] text-left">
          <thead className="bg-[#1e222b] text-white">
            <tr>
              {['Task Title', 'Assigned Staff', 'Priority', 'Related Module', 'Related Record', 'Due Time', 'Status', 'Action'].map((heading) => (
                <th key={heading} className="px-3 py-2 text-[10px] uppercase font-black">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {taskRows.map((row) => (
              <tr key={`${row[0]}-${row[4]}`} className="border-t border-[#d6d9e0] text-[11px] text-slate-700">
                {row.map((value) => <td key={value} className="px-3 py-2 font-bold">{value}</td>)}
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1.5">
                    <TaskButton icon={Eye} label="View" onClick={() => handleAction('tasks.view', 'View')} />
                    <TaskButton icon={PlayCircle} label="Start Review Placeholder" onClick={() => handleAction('tasks.view', 'Start Review')} />
                    <TaskButton icon={CheckCircle2} label="Close Placeholder" onClick={() => handleAction('tasks.close', 'Close Task')} />
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

function TaskButton({ icon: Icon, label, onClick }: { icon: typeof Eye; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="border border-[#b1b5c2] bg-white hover:bg-orange-50 px-2 py-1 text-[9px] font-black uppercase flex items-center gap-1">
      <Icon className="w-3 h-3 text-orange-600" />
      {label}
    </button>
  );
}
