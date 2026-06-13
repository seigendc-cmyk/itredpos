import { FormEvent, useEffect, useState } from 'react';
import { Unlock, X } from 'lucide-react';

interface OpenShiftModalProps {
  open: boolean;
  staffName: string;
  branchName: string;
  terminalName: string;
  drawerId?: string;
  terminalRegistered: boolean;
  staffSessionActive: boolean;
  hasOpenShift: boolean;
  cashSalesEnabled: boolean;
  onCancel: () => void;
  onSubmit: (payload: { openingFloat: number; drawerId: string; notes: string }) => Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
}

export default function OpenShiftModal({
  open,
  staffName,
  branchName,
  terminalName,
  drawerId = '',
  terminalRegistered,
  staffSessionActive,
  hasOpenShift,
  cashSalesEnabled,
  onCancel,
  onSubmit,
  onDirtyChange
}: OpenShiftModalProps) {
  const [openingFloat, setOpeningFloat] = useState('120.00');
  const [selectedDrawer, setSelectedDrawer] = useState(drawerId || 'DRAWER-POS-01-A');
  const [notes, setNotes] = useState('Opening float counted and shift ready.');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedDrawer(drawerId || 'DRAWER-POS-01-A');
    onDirtyChange?.(false);
  }, [drawerId, onDirtyChange, open]);

  if (!open) return null;

  const updateDirty = () => onDirtyChange?.(true);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!terminalRegistered) {
      setError('Terminal must be active or registered before opening shift.');
      return;
    }
    if (!staffSessionActive) {
      setError('Staff session is not active.');
      return;
    }
    if (hasOpenShift) {
      setError('An open shift already exists for this terminal.');
      return;
    }
    if (cashSalesEnabled && !selectedDrawer.trim()) {
      setError('Cash drawer is required when cash sales are enabled.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSubmit({
        openingFloat: Math.max(0, Number(openingFloat) || 0),
        drawerId: selectedDrawer.trim(),
        notes: notes.trim()
      });
      onDirtyChange?.(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="shift-control-modal-backdrop" role="presentation">
      <section className="shift-control-modal" role="dialog" aria-modal="true" aria-labelledby="open-shift-title">
        <header className="shift-control-modal__header">
          <div>
            <p className="sci-pos-eyebrow">Start Work</p>
            <h2 id="open-shift-title"><Unlock size={18} aria-hidden="true" /> Open Shift</h2>
          </div>
          <button type="button" className="sci-icon-button" onClick={onCancel} aria-label="Cancel open shift">
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <form className="shift-control-modal__body" onSubmit={handleSubmit}>
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
              Opening Float
              <input type="number" min="0" step="0.01" value={openingFloat} onChange={(event) => { setOpeningFloat(event.target.value); updateDirty(); }} />
            </label>
            <label>
              Cash Drawer
              <input value={selectedDrawer} onChange={(event) => { setSelectedDrawer(event.target.value); updateDirty(); }} />
            </label>
            <label className="shift-modal-span">
              Shift Notes
              <textarea rows={4} value={notes} onChange={(event) => { setNotes(event.target.value); updateDirty(); }} />
            </label>
          </div>
          <div className="shift-check-grid">
            <span className={terminalRegistered ? 'is-ok' : 'is-blocked'}>Terminal {terminalRegistered ? 'registered' : 'needs activation'}</span>
            <span className={staffSessionActive ? 'is-ok' : 'is-blocked'}>Staff session {staffSessionActive ? 'active' : 'inactive'}</span>
            <span className={!hasOpenShift ? 'is-ok' : 'is-blocked'}>{hasOpenShift ? 'Shift already open' : 'No open shift conflict'}</span>
            <span className={!cashSalesEnabled || selectedDrawer.trim() ? 'is-ok' : 'is-blocked'}>{cashSalesEnabled ? 'Cash drawer checked' : 'Cash drawer optional'}</span>
          </div>
          {error && <div className="sci-pos-alert sci-pos-alert--danger" role="alert">{error}</div>}
          <footer className="shift-control-modal__footer">
            <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={onCancel}>Cancel</button>
            <button type="submit" className="sci-pos-button sci-pos-button--primary" disabled={saving}>
              <Unlock size={16} aria-hidden="true" />
              {saving ? 'Opening...' : 'Open Shift'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
