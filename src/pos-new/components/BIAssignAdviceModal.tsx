import { useEffect, useState } from 'react';
import type { BIAdviceRecord } from '../types';

export interface BIAssignAdvicePayload {
  assignedToRole: string;
  assignedToStaffName: string;
  assignedToStaffId: string;
  assignedDesk: string;
  dueDate: string;
  note: string;
}

interface BIAssignAdviceModalProps {
  advice: BIAdviceRecord | null;
  currentStaffName: string;
  onAssign: (payload: BIAssignAdvicePayload) => void;
  onCancel: () => void;
}

const roleOptions = ['Owner', 'Manager', 'Supervisor', 'Stock Controller', 'Cashier', 'Delivery Staff', 'Accountant'];

function staffIdFromName(name: string): string {
  return name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-') || 'STAFF-LOCAL';
}

function deskFromRole(role: string): string {
  if (role === 'Owner') return 'Owner Desk';
  if (role === 'Stock Controller') return 'Stock Desk';
  if (role === 'Delivery Staff') return 'Delivery Desk';
  if (role === 'Cashier') return 'Sales Desk';
  if (role === 'Accountant') return 'Accounting Desk';
  return 'Manager Desk';
}

export default function BIAssignAdviceModal({ advice, currentStaffName, onAssign, onCancel }: BIAssignAdviceModalProps) {
  const [assignedToRole, setAssignedToRole] = useState('Manager');
  const [assignedToStaffName, setAssignedToStaffName] = useState(currentStaffName);
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!advice) return;
    setAssignedToRole(advice.assignedToRole || 'Manager');
    setAssignedToStaffName(advice.assignedToStaffName || currentStaffName);
    setDueDate(advice.dueDate || new Date(Date.now() + 86400000).toISOString().slice(0, 10));
    setNote('');
  }, [advice, currentStaffName]);

  if (!advice) return null;

  const submit = () => {
    const staffName = assignedToStaffName.trim() || currentStaffName;
    onAssign({
      assignedToRole,
      assignedToStaffName: staffName,
      assignedToStaffId: staffIdFromName(staffName),
      assignedDesk: deskFromRole(assignedToRole),
      dueDate,
      note: note.trim() || 'Assigned locally from BI Advice Flow.'
    });
  };

  return (
    <div className="shift-control-modal-backdrop" role="presentation">
      <section className="shift-control-modal" role="dialog" aria-modal="true" aria-labelledby="bi-assign-advice-title">
        <header className="shift-control-modal__header">
          <div>
            <p className="sci-pos-eyebrow">BI Advice Assignment</p>
            <h2 id="bi-assign-advice-title">Assign BI Advice</h2>
            <span>{advice.adviceNumber} / {advice.category}</span>
          </div>
          <button type="button" className="sci-pos-icon-button" onClick={onCancel} aria-label="Close assignment modal">x</button>
        </header>
        <div className="shift-control-modal__body">
          <div className="shift-modal-grid">
            <label>
              Assigned Role
              <select value={assignedToRole} onChange={(event) => setAssignedToRole(event.target.value)}>
                {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
              </select>
            </label>
            <label>
              Assigned Staff
              <input value={assignedToStaffName} onChange={(event) => setAssignedToStaffName(event.target.value)} />
            </label>
            <label>
              Due Date
              <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </label>
            <label className="shift-modal-span">
              Assignment Note
              <textarea rows={4} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Reason, desk route, or instruction" />
            </label>
          </div>
        </div>
        <footer className="shift-control-modal__footer">
          <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={onCancel}>Cancel</button>
          <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={submit}>Assign</button>
        </footer>
      </section>
    </div>
  );
}
