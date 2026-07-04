import React from 'react';
import { Download, Edit3, Printer, StickyNote, XCircle } from 'lucide-react';
import type { COAAccount } from '../types/posTypes';

interface COAAccountDetailModalProps {
  account: COAAccount;
  onClose: () => void;
  onEditDraft: () => void;
  onMarkInactive: () => void;
  onAddNote: () => void;
  onPrint: () => void;
  onExport: () => void;
}

const readinessAreas = ['Sales Accounting Readiness', 'Payment Posting Preview', 'Cash Control Readiness', 'Inventory Value Readiness'];

export default function COAAccountDetailModal({
  account,
  onClose,
  onEditDraft,
  onMarkInactive,
  onAddNote,
  onPrint,
  onExport
}: COAAccountDetailModalProps) {
  return (
    <div className="owner-cash-modal-backdrop" role="dialog" aria-modal="true" aria-label="COA account detail">
      <div className="owner-cash-modal coa-account-modal">
        <div className="owner-cash-modal-header">
          <div>
            <span>Accounting readiness preview only. Not final posted accounts.</span>
            <h3>{account.accountCode} - {account.accountName}</h3>
          </div>
          <button type="button" onClick={onClose}>Close</button>
        </div>
        <div className="owner-cash-modal-body pos-custom-scroll">
          <div className="owner-cash-detail-grid">
            <Field label="Account Code" value={account.accountCode} />
            <Field label="Account Name" value={account.accountName} />
            <Field label="Account Type" value={account.accountType} />
            <Field label="Linked Domain" value={account.linkedDomain} />
            <Field label="Status" value={account.status} />
            <Field label="Created By" value={account.createdBy || 'Owner Desk'} />
            <Field label="Created At" value={account.createdAt || 'Pending timestamp'} />
            <Field label="Updated At" value={account.updatedAt || 'No update recorded'} />
          </div>
          <section className="coa-account-modal-section">
            <span>Notes</span>
            <p>{account.notes || 'No account note recorded.'}</p>
          </section>
          <section className="coa-account-modal-section">
            <span>Used In Accounting Readiness Areas</span>
            <div className="coa-account-chip-row">
              {readinessAreas.filter((area) => area.toLowerCase().includes(account.linkedDomain.toLowerCase()) || account.linkedDomain === 'Sales' || account.linkedDomain === 'Cash').map((area) => (
                <b key={area}>{area}</b>
              ))}
            </div>
          </section>
          <section className="coa-account-modal-section">
            <span>Linked Transaction Domains</span>
            <p>{account.linkedDomain}, EOD Accounting Readiness, Owner Desk Accounting Preview</p>
          </section>
          <section className="coa-account-modal-section">
            <span>Audit / Activity History</span>
            <p>{account.inactiveReason || account.notes || `${account.accountCode} available in local accounting readiness preview.`}</p>
          </section>
        </div>
        <div className="owner-cash-modal-actions">
          {account.status === 'Draft' && <button type="button" className="industrial-secondary-button" onClick={onEditDraft}><Edit3 className="w-3.5 h-3.5" /> Edit Draft</button>}
          {account.status !== 'Inactive' && <button type="button" className="industrial-secondary-button" onClick={onMarkInactive}><XCircle className="w-3.5 h-3.5" /> Mark Inactive</button>}
          <button type="button" className="industrial-secondary-button" onClick={onAddNote}><StickyNote className="w-3.5 h-3.5" /> Add Owner Note</button>
          <button type="button" className="industrial-secondary-button" onClick={onPrint}><Printer className="w-3.5 h-3.5" /> Print</button>
          <button type="button" className="industrial-secondary-button" onClick={onExport}><Download className="w-3.5 h-3.5" /> Export</button>
          <button type="button" className="industrial-secondary-button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50 border border-[#b1b5c2] p-2 min-h-[48px]">
      <span className="block text-[8px] uppercase font-medium text-orange-700">{label}</span>
      <span className="block text-[10px] font-semibold text-[#1e222b] mt-1">{value}</span>
    </div>
  );
}
