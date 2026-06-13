import { FormEvent, useEffect, useState } from 'react';
import { Wallet, X } from 'lucide-react';

interface CashDrawerAssignmentModalProps {
  open: boolean;
  staffName: string;
  branchName: string;
  terminalName: string;
  currentDrawerId?: string;
  cashSalesEnabled: boolean;
  canRelease: boolean;
  onAssign: (payload: { drawerId: string; openingFloat: number; cashSalesEnabled: boolean; notes: string }) => Promise<void>;
  onRelease: () => Promise<void>;
  onCancel: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export default function CashDrawerAssignmentModal({
  open,
  staffName,
  branchName,
  terminalName,
  currentDrawerId,
  cashSalesEnabled,
  canRelease,
  onAssign,
  onRelease,
  onCancel,
  onDirtyChange
}: CashDrawerAssignmentModalProps) {
  const [drawerId, setDrawerId] = useState(currentDrawerId || 'DRAWER-POS-01-A');
  const [openingFloat, setOpeningFloat] = useState('120.00');
  const [cashEnabled, setCashEnabled] = useState(cashSalesEnabled);
  const [notes, setNotes] = useState('Drawer counted and assigned for cash sales.');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDrawerId(currentDrawerId || 'DRAWER-POS-01-A');
    setCashEnabled(cashSalesEnabled);
    onDirtyChange?.(false);
  }, [cashSalesEnabled, currentDrawerId, onDirtyChange, open]);

  if (!open) return null;

  const updateDirty = () => onDirtyChange?.(true);

  const handleAssign = async (event: FormEvent) => {
    event.preventDefault();
    if (cashEnabled && !drawerId.trim()) {
      setError('Cash sales require a drawer assignment.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onAssign({
        drawerId: drawerId.trim(),
        openingFloat: Math.max(0, Number(openingFloat) || 0),
        cashSalesEnabled: cashEnabled,
        notes: notes.trim()
      });
      onDirtyChange?.(false);
    } finally {
      setSaving(false);
    }
  };

  const handleRelease = async () => {
    setSaving(true);
    setError('');
    try {
      await onRelease();
      onDirtyChange?.(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="shift-control-modal-backdrop" role="presentation">
      <section className="shift-control-modal" role="dialog" aria-modal="true" aria-labelledby="cash-drawer-title">
        <header className="shift-control-modal__header">
          <div>
            <p className="sci-pos-eyebrow">Cash Control</p>
            <h2 id="cash-drawer-title"><Wallet size={18} aria-hidden="true" /> Cash Drawer Assignment</h2>
          </div>
          <button type="button" className="sci-icon-button" onClick={onCancel} aria-label="Cancel drawer assignment">
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <form className="shift-control-modal__body" onSubmit={handleAssign}>
          <div className="shift-modal-grid">
            <label>
              Staff
              <input value={staffName} readOnly />
            </label>
            <label>
              Branch
              <input value={branchName} readOnly />
            </label>
            <label>
              Terminal
              <input value={terminalName} readOnly />
            </label>
            <label>
              Drawer
              <input value={drawerId} onChange={(event) => { setDrawerId(event.target.value); updateDirty(); }} />
            </label>
            <label>
              Opening Float
              <input type="number" min="0" step="0.01" value={openingFloat} onChange={(event) => { setOpeningFloat(event.target.value); updateDirty(); }} />
            </label>
            <label className="shift-checkbox-inline">
              <input type="checkbox" checked={cashEnabled} onChange={(event) => { setCashEnabled(event.target.checked); updateDirty(); }} />
              Cash sales enabled
            </label>
            <label className="shift-modal-span">
              Drawer Notes
              <textarea rows={4} value={notes} onChange={(event) => { setNotes(event.target.value); updateDirty(); }} />
            </label>
          </div>
          {error && <div className="sci-pos-alert sci-pos-alert--danger" role="alert">{error}</div>}
          <footer className="shift-control-modal__footer">
            <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={onCancel}>Cancel</button>
            {canRelease && (
              <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={handleRelease} disabled={saving}>
                Release Drawer
              </button>
            )}
            <button type="submit" className="sci-pos-button sci-pos-button--primary" disabled={saving}>
              <Wallet size={16} aria-hidden="true" />
              {saving ? 'Saving...' : 'Assign Drawer'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
