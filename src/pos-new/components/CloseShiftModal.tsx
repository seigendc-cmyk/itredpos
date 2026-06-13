import { FormEvent, useEffect, useMemo, useState } from 'react';
import { FileText, Lock, X } from 'lucide-react';
import type { ShiftEodPrintPayload } from '../services/shiftEodReportService';

interface CloseShiftModalProps {
  open: boolean;
  expectedCash: number;
  salesTotal: number;
  paymentTotal: number;
  vatTotal: number;
  pendingDeliveryCash: number;
  hasActiveSale: boolean;
  canOverride: boolean;
  eodPreview: ShiftEodPrintPayload | null;
  onGeneratePreview: (payload: { countedCash: number; cashNotes: string; closingNotes: string }) => Promise<void>;
  onCloseShift: (payload: { countedCash: number; cashNotes: string; closingNotes: string }) => Promise<void>;
  onCancel: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

function money(value: number): string {
  return `USD ${value.toFixed(2)}`;
}

export default function CloseShiftModal({
  open,
  expectedCash,
  salesTotal,
  paymentTotal,
  vatTotal,
  pendingDeliveryCash,
  hasActiveSale,
  canOverride,
  eodPreview,
  onGeneratePreview,
  onCloseShift,
  onCancel,
  onDirtyChange
}: CloseShiftModalProps) {
  const [countedCash, setCountedCash] = useState(String(expectedCash.toFixed(2)));
  const [cashNotes, setCashNotes] = useState('Cash counted at terminal close.');
  const [closingNotes, setClosingNotes] = useState('Shift close reviewed locally.');
  const [confirmedNoPendingSales, setConfirmedNoPendingSales] = useState(false);
  const [confirmedDeliveryReview, setConfirmedDeliveryReview] = useState(pendingDeliveryCash === 0);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCountedCash(String(expectedCash.toFixed(2)));
    setConfirmedDeliveryReview(pendingDeliveryCash === 0);
    onDirtyChange?.(false);
  }, [expectedCash, onDirtyChange, open, pendingDeliveryCash]);

  const counted = Math.max(0, Number(countedCash) || 0);
  const variance = useMemo(() => counted - expectedCash, [counted, expectedCash]);

  if (!open) return null;

  const updateDirty = () => onDirtyChange?.(true);
  const payload = { countedCash: counted, cashNotes: cashNotes.trim(), closingNotes: closingNotes.trim() };

  const validateClose = () => {
    if (hasActiveSale && !canOverride) return 'Active sale must be held or voided before closing shift.';
    if (!confirmedNoPendingSales && !canOverride) return 'Confirm no pending sales before closing shift.';
    if (pendingDeliveryCash > 0 && !confirmedDeliveryReview && !canOverride) return 'Confirm delivery cash review before closing shift.';
    if (!eodPreview && !canOverride) return 'Generate EOD preview before closing shift.';
    return '';
  };

  const handlePreview = async () => {
    setSaving(true);
    setError('');
    try {
      await onGeneratePreview(payload);
      onDirtyChange?.(true);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const validationMessage = validateClose();
    if (validationMessage) {
      setError(validationMessage);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onCloseShift(payload);
      onDirtyChange?.(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="shift-control-modal-backdrop" role="presentation">
      <section className="shift-control-modal shift-control-modal--wide" role="dialog" aria-modal="true" aria-labelledby="close-shift-title">
        <header className="shift-control-modal__header">
          <div>
            <p className="sci-pos-eyebrow">End Work</p>
            <h2 id="close-shift-title"><Lock size={18} aria-hidden="true" /> Close Shift</h2>
          </div>
          <button type="button" className="sci-icon-button" onClick={onCancel} aria-label="Cancel close shift">
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <form className="shift-control-modal__body" onSubmit={handleSubmit}>
          <div className="shift-modal-grid">
            <label>
              Expected Cash
              <input value={money(expectedCash)} readOnly />
            </label>
            <label>
              Counted Cash
              <input type="number" min="0" step="0.01" value={countedCash} onChange={(event) => { setCountedCash(event.target.value); updateDirty(); }} />
            </label>
            <label>
              Cash Variance
              <input value={money(variance)} readOnly />
            </label>
            <label>
              Cash Notes
              <textarea rows={3} value={cashNotes} onChange={(event) => { setCashNotes(event.target.value); updateDirty(); }} />
            </label>
            <label className="shift-modal-span">
              Closing Notes
              <textarea rows={3} value={closingNotes} onChange={(event) => { setClosingNotes(event.target.value); updateDirty(); }} />
            </label>
          </div>
          <div className="shift-eod-preview-grid">
            <div><span>Sales Summary</span><strong>{money(salesTotal)}</strong></div>
            <div><span>Payment Summary</span><strong>{money(paymentTotal)}</strong></div>
            <div><span>VAT Summary</span><strong>{money(vatTotal)}</strong></div>
            <div><span>Cash Variance</span><strong>{money(variance)}</strong></div>
            <div><span>Pending Issues</span><strong>{hasActiveSale ? 'Active sale' : pendingDeliveryCash > 0 ? 'Delivery cash' : 'None'}</strong></div>
            <div><span>EOD Reports Preview</span><strong>{eodPreview ? 'Generated' : 'Required'}</strong></div>
          </div>
          <div className="shift-checkbox-stack">
            <label>
              <input type="checkbox" checked={confirmedNoPendingSales} onChange={(event) => { setConfirmedNoPendingSales(event.target.checked); updateDirty(); }} />
              Confirm no pending sales
            </label>
            <label>
              <input type="checkbox" checked={confirmedDeliveryReview} onChange={(event) => { setConfirmedDeliveryReview(event.target.checked); updateDirty(); }} />
              Confirm delivery cash review
            </label>
          </div>
          {error && <div className="sci-pos-alert sci-pos-alert--danger" role="alert">{error}</div>}
          <footer className="shift-control-modal__footer">
            <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={onCancel}>Cancel</button>
            <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={handlePreview} disabled={saving}>
              <FileText size={16} aria-hidden="true" />
              Generate EOD Preview
            </button>
            <button type="submit" className="sci-pos-button sci-pos-button--primary" disabled={saving}>
              <Lock size={16} aria-hidden="true" />
              {saving ? 'Closing...' : 'Close Shift'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
