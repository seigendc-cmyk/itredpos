import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export interface MiscellaneousSalePayload {
  description: string;
  quantity: number;
  unitPrice: number;
  taxable: boolean;
  vatRate: number;
  reason: string;
  notes?: string;
  customerRequestReference?: string;
}

interface MiscellaneousSaleModalProps {
  open: boolean;
  onSubmit: (payload: MiscellaneousSalePayload) => void;
  onCancel: () => void;
}

export default function MiscellaneousSaleModal({ open, onSubmit, onCancel }: MiscellaneousSaleModalProps) {
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const [taxable, setTaxable] = useState(true);
  const [vatRate, setVatRate] = useState('15');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [customerRequestReference, setCustomerRequestReference] = useState('');
  const [error, setError] = useState('');

  if (!open) return null;

  const submit = () => {
    const parsedQty = Number(quantity);
    const parsedPrice = Number(unitPrice);
    const parsedVatRate = Number(vatRate);
    if (!description.trim()) return setError('Item Description is required.');
    if (!Number.isFinite(parsedQty) || parsedQty <= 0) return setError('Quantity must be greater than 0.');
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) return setError('Unit Price must be greater than 0.');
    if (!reason.trim()) return setError('Reason is required.');
    onSubmit({
      description: description.trim(),
      quantity: parsedQty,
      unitPrice: parsedPrice,
      taxable,
      vatRate: Number.isFinite(parsedVatRate) ? Math.max(0, parsedVatRate) : 0,
      reason: reason.trim(),
      notes: notes.trim() || undefined,
      customerRequestReference: customerRequestReference.trim() || undefined
    });
    setDescription('');
    setQuantity('1');
    setUnitPrice('');
    setReason('');
    setNotes('');
    setCustomerRequestReference('');
    setError('');
  };

  return (
    <div className="shift-control-modal-backdrop" role="presentation">
      <section className="shift-control-modal" role="dialog" aria-modal="true" aria-labelledby="misc-sale-title">
        <header className="shift-control-modal__header">
          <div>
            <p className="sci-pos-eyebrow">Non-Inventory / BI Flagged</p>
            <h2 id="misc-sale-title"><AlertTriangle size={18} aria-hidden="true" /> Miscellaneous Sale</h2>
          </div>
          <button type="button" className="sci-icon-button" onClick={onCancel} aria-label="Cancel miscellaneous sale">
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="shift-control-modal__body">
          <p className="sales-blocked-copy">Add a non-inventory sale item. This item will not affect inventory stock and will be flagged for management review.</p>
          {error && <div className="sci-pos-alert sci-pos-alert--danger" role="alert">{error}</div>}
          <div className="shift-modal-grid">
            <label className="shift-modal-span">Item Description<input value={description} onChange={(event) => setDescription(event.target.value)} /></label>
            <label>Quantity<input type="number" min="0.01" step="0.01" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>
            <label>Unit Price<input type="number" min="0.01" step="0.01" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} /></label>
            <label>VAT Rate<input type="number" min="0" step="0.01" value={vatRate} onChange={(event) => setVatRate(event.target.value)} disabled={!taxable} /></label>
            <label className="shift-checkbox-inline"><input type="checkbox" checked={taxable} onChange={(event) => setTaxable(event.target.checked)} /> Taxable</label>
            <label className="shift-modal-span">Reason<input value={reason} onChange={(event) => setReason(event.target.value)} /></label>
            <label className="shift-modal-span">Customer Request Reference<input value={customerRequestReference} onChange={(event) => setCustomerRequestReference(event.target.value)} /></label>
            <label className="shift-modal-span">Notes<textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
          </div>
        </div>
        <footer className="shift-control-modal__footer">
          <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={submit}>Add Miscellaneous Item</button>
          <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={onCancel}>Cancel</button>
        </footer>
      </section>
    </div>
  );
}
