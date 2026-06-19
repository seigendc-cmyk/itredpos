import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { CheckPayeeType, CheckPaymentPurpose, PayeeRecord } from '../types/posTypes';
import COAAccountSelector from './COAAccountSelector';
import RowActionMenu, { type RowActionMenuItem } from './RowActionMenu';
import { createPayee, deactivatePayee, getPayees, updatePayee } from '../services/checkWriterService';

interface PayeeRegisterModalProps {
  open: boolean;
  staffName: string;
  onClose: () => void;
  onSelect?: (payee: PayeeRecord) => void;
  onSaved: (message: string) => void;
}

const payeeTypes: CheckPayeeType[] = ['Supplier', 'Customer', 'Staff', 'ExpenseVendor', 'Owner', 'Other'];
const purposes: CheckPaymentPurpose[] = ['SupplierPayment', 'DrawerExpense', 'PettyCash', 'Refund', 'OwnerDrawing', 'OperatingExpense', 'CustomerDepositRefund', 'COGSReserveUse', 'Other'];

const emptyForm: Partial<PayeeRecord> = { payeeCode: '', payeeName: '', payeeType: 'Other', active: true, notes: '', defaultPaymentPurpose: 'Other' };

export default function PayeeRegisterModal({ open, staffName, onClose, onSelect, onSaved }: PayeeRegisterModalProps) {
  const [rows, setRows] = useState<PayeeRecord[]>([]);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<PayeeRecord>>(emptyForm);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const load = () => void getPayees().then(setRows);
  useEffect(() => {
    if (open) load();
  }, [open]);

  const filtered = useMemo(() => {
    const parts = search.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return rows.filter((row) => parts.every((part) => `${row.payeeCode} ${row.payeeName} ${row.payeeType} ${row.phone || ''} ${row.email || ''}`.toLowerCase().includes(part)));
  }, [rows, search]);

  if (!open) return null;

  const save = async () => {
    if (editingId) {
      await updatePayee(editingId, form, staffName);
      onSaved('Payee updated locally.');
    } else {
      await createPayee(form, staffName);
      onSaved('Payee created locally.');
    }
    setForm(emptyForm);
    setEditingId(null);
    load();
  };

  const edit = (row: PayeeRecord) => {
    setEditingId(row.payeeId);
    setForm(row);
  };

  const payeeActions = (row: PayeeRecord): RowActionMenuItem[] => [
    { id: 'edit', label: 'Edit', onClick: () => edit(row) },
    { id: 'select', label: 'Select', onClick: () => onSelect?.(row), disabled: !onSelect },
    { id: 'deactivate', label: 'Deactivate', danger: true, separatorBefore: true, disabled: !row.active, onClick: () => void deactivatePayee(row.payeeId, 'Deactivated from Payee Register.', staffName).then(load) }
  ];

  const exportPayees = () => {
    const csv = ['Code,Name,Type,Phone,Email,Active', ...rows.map((row) => [row.payeeCode, row.payeeName, row.payeeType, row.phone || '', row.email || '', row.active ? 'Yes' : 'No'].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'payee-register.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="a5-tool-backdrop" role="dialog" aria-modal="true">
      <div className="a5-tool-modal a5-tool-modal--max">
        <header className="a5-tool-header">
          <div><span>Financial Control</span><strong>Payee Register</strong></div>
          <div className="a5-tool-controls"><button type="button" onClick={onClose}><X size={14} /></button></div>
        </header>
        <div className="a5-tool-body">
          <div className="a5-tool-grid">
            <Field label="Payee Code" value={form.payeeCode || ''} onChange={(value) => setForm({ ...form, payeeCode: value.toUpperCase() })} />
            <Field label="Payee Name" value={form.payeeName || ''} onChange={(value) => setForm({ ...form, payeeName: value })} />
            <label className="a5-field"><span>Payee Type</span><select value={form.payeeType || 'Other'} onChange={(event) => setForm({ ...form, payeeType: event.target.value as CheckPayeeType })}>{payeeTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
            <label className="a5-field"><span>Default Purpose</span><select value={form.defaultPaymentPurpose || 'Other'} onChange={(event) => setForm({ ...form, defaultPaymentPurpose: event.target.value as CheckPaymentPurpose })}>{purposes.map((purpose) => <option key={purpose}>{purpose}</option>)}</select></label>
            <Field label="Phone" value={form.phone || ''} onChange={(value) => setForm({ ...form, phone: value })} />
            <Field label="Email" value={form.email || ''} onChange={(value) => setForm({ ...form, email: value })} />
            <Field label="Linked Supplier" value={form.linkedSupplierId || ''} onChange={(value) => setForm({ ...form, linkedSupplierId: value })} />
            <Field label="Linked Customer" value={form.linkedCustomerId || ''} onChange={(value) => setForm({ ...form, linkedCustomerId: value })} />
            <Field label="Linked Staff" value={form.linkedStaffId || ''} onChange={(value) => setForm({ ...form, linkedStaffId: value })} />
            <COAAccountSelector label="Default COA Account" value={form.defaultCOAAccountId} onChange={(account) => setForm({ ...form, defaultCOAAccountId: account.id })} />
          </div>
          <label className="a5-field"><span>Address</span><textarea rows={2} value={form.address || ''} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label>
          <label className="a5-field"><span>Notes</span><textarea rows={2} value={form.notes || ''} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
          <div className="a5-tool-actions">
            <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={() => void save()}>{editingId ? 'Update Payee' : 'Add Payee'}</button>
            <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={exportPayees}>Export Payees</button>
          </div>
          <div className="pos-approval-search-row"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search payees" /></div>
          <div className="sci-pos-table-wrap">
            <table className="sci-pos-table">
              <thead><tr><th>Code</th><th>Name</th><th>Type</th><th>Purpose</th><th>Active</th><th>Action</th></tr></thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.payeeId}><td>{row.payeeCode}</td><td>{row.payeeName}</td><td>{row.payeeType}</td><td>{row.defaultPaymentPurpose}</td><td>{row.active ? 'Yes' : 'No'}</td><td className="pos-approval-actions"><RowActionMenu rowId={row.payeeId} ariaLabel={`Payee actions for ${row.payeeName}`} open={openMenuId === row.payeeId} onOpenChange={(open) => setOpenMenuId(open ? row.payeeId : null)} items={payeeActions(row)} /></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="a5-field"><span>{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}
