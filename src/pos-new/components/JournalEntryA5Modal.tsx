import { useEffect, useMemo, useState } from 'react';
import { Maximize2, Minus, RotateCcw, X } from 'lucide-react';
import type { JournalEntryLine, JournalEntryRecord, JournalEntryType } from '../types/posTypes';
import COAAccountSelector from './COAAccountSelector';
import JournalEntryPrintDocument from './JournalEntryPrintDocument';
import {
  calculateJournalTotals,
  createJournalEntryDraft,
  markJournalPostedPreview,
  submitJournalForReview,
  updateJournalEntry,
  validateJournalBalance
} from '../services/journalEntryService';

interface JournalEntryA5ModalProps {
  open: boolean;
  staffName: string;
  businessName: string;
  initialJournal?: JournalEntryRecord | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}

const journalTypes: JournalEntryType[] = ['General', 'Adjustment', 'AccrualReadiness', 'Reclassification', 'OpeningBalance', 'COGSReserveAdjustment', 'VATReserveAdjustment', 'InventoryValueAdjustment', 'DebtorAdjustment', 'CreditorAdjustment', 'CashbookAdjustment'];

function blankLine(): JournalEntryLine {
  return { lineId: `JLINE-${Date.now()}-${Math.random()}`, accountId: '', accountCode: '', accountName: '', description: '', debit: 0, credit: 0 };
}

export default function JournalEntryA5Modal({ open, staffName, businessName, initialJournal, onClose, onSaved }: JournalEntryA5ModalProps) {
  const [mode, setMode] = useState<'normal' | 'min' | 'max'>('normal');
  const [savedJournal, setSavedJournal] = useState<JournalEntryRecord | null>(initialJournal || null);
  const [form, setForm] = useState({
    journalDate: new Date().toISOString().slice(0, 10),
    journalType: 'General' as JournalEntryType,
    reference: '',
    description: '',
    notes: ''
  });
  const [lines, setLines] = useState<JournalEntryLine[]>([blankLine(), blankLine()]);

  useEffect(() => {
    if (!open) return;
    setSavedJournal(initialJournal || null);
    if (initialJournal) {
      setForm({ journalDate: initialJournal.journalDate, journalType: initialJournal.journalType, reference: initialJournal.reference, description: initialJournal.description, notes: initialJournal.notes });
      setLines(initialJournal.lines.length ? initialJournal.lines : [blankLine(), blankLine()]);
    }
  }, [open, initialJournal]);

  const totals = useMemo(() => calculateJournalTotals(lines), [lines]);
  const validation = useMemo(() => validateJournalBalance(lines), [lines]);
  if (!open) return null;

  const setLine = (lineId: string, patch: Partial<JournalEntryLine>) => setLines((current) => current.map((line) => line.lineId === lineId ? { ...line, ...patch } : line));

  const saveDraft = async () => {
    const payload = { ...form, lines, ...totals };
    if (savedJournal) {
      const rows = await updateJournalEntry(savedJournal.journalId, payload, staffName);
      setSavedJournal(rows.find((row) => row.journalId === savedJournal.journalId) || null);
    } else {
      const rows = await createJournalEntryDraft(payload, staffName);
      setSavedJournal(rows[0]);
    }
    onSaved(totals.balanced ? 'Journal saved as Balanced.' : 'Journal saved as Out of Balance.');
  };

  const action = async (kind: 'review' | 'post') => {
    if (!savedJournal) {
      onSaved('Save draft before running this action.');
      return;
    }
    try {
      const rows = kind === 'review' ? await submitJournalForReview(savedJournal.journalId, staffName) : await markJournalPostedPreview(savedJournal.journalId, staffName);
      setSavedJournal(rows.find((row) => row.journalId === savedJournal.journalId) || rows[0]);
      onSaved(kind === 'review' ? 'Journal submitted for review.' : 'Journal marked Posted Preview.');
    } catch (error) {
      onSaved(error instanceof Error ? error.message : 'Journal action failed.');
    }
  };

  const printJournal = () => {
    const printable = savedJournal;
    if (!printable) {
      onSaved('Save draft before printing.');
      return;
    }
    const popup = window.open('', '_blank', 'width=900,height=700');
    if (popup) {
      const linesHtml = printable.lines.map((line) => `<tr><td>${line.accountCode} - ${line.accountName}</td><td>${line.description}</td><td>${line.debit.toFixed(2)}</td><td>${line.credit.toFixed(2)}</td></tr>`).join('');
      popup.document.write(`<html><head><title>${printable.journalNumber}</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#1e222b}.box{border:1px solid #1e222b;padding:24px;display:grid;gap:14px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #b1b5c2;padding:8px;text-align:left}small{color:#9a3412;font-weight:700;text-transform:uppercase}</style></head><body><div class="box"><h1>${businessName}</h1><h2>Journal Entry Readiness Preview ${printable.journalNumber}</h2><p>${printable.description}</p><table><thead><tr><th>Account</th><th>Description</th><th>Debit</th><th>Credit</th></tr></thead><tbody>${linesHtml}</tbody></table><p>Total Debit: ${printable.totalDebit.toFixed(2)} | Total Credit: ${printable.totalCredit.toFixed(2)} | Difference: ${printable.difference.toFixed(2)}</p><p>Prepared by: ${printable.preparedBy}</p><p>Reviewed by: __________________ Signature: __________________</p><small>Accounting readiness preview only. Not final posted accounts.</small></div></body></html>`);
      popup.document.close();
      popup.print();
    }
  };

  return (
    <div className="a5-tool-backdrop" role="dialog" aria-modal="true">
      <div className={`a5-tool-modal ${mode === 'max' ? 'a5-tool-modal--max' : ''} ${mode === 'min' ? 'a5-tool-modal--min' : ''}`}>
        <header className="a5-tool-header">
          <div><span>Financial Control</span><strong>A5 Journal Entry</strong></div>
          <div className="a5-tool-controls"><button onClick={() => setMode('min')}><Minus size={14} /></button><button onClick={() => setMode('normal')}><RotateCcw size={14} /></button><button onClick={() => setMode('max')}><Maximize2 size={14} /></button><button onClick={onClose}><X size={14} /></button></div>
        </header>
        {mode !== 'min' && (
          <div className="a5-tool-body">
            <div className="a5-tool-grid">
              <Field label="Journal Date" type="date" value={form.journalDate} onChange={(value) => setForm({ ...form, journalDate: value })} />
              <label className="a5-field"><span>Journal Type</span><select value={form.journalType} onChange={(event) => setForm({ ...form, journalType: event.target.value as JournalEntryType })}>{journalTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
              <Field label="Reference" value={form.reference} onChange={(value) => setForm({ ...form, reference: value })} />
              <Field label="Description" value={form.description} onChange={(value) => setForm({ ...form, description: value })} />
            </div>
            <table className="sci-pos-table journal-lines-table">
              <thead><tr><th>Account</th><th>Description</th><th>Debit</th><th>Credit</th><th></th></tr></thead>
              <tbody>{lines.map((line) => <tr key={line.lineId}><td><COAAccountSelector label="Account" value={line.accountId} onChange={(account) => setLine(line.lineId, { accountId: account.id, accountCode: account.accountCode, accountName: account.accountName })} /></td><td><input value={line.description} onChange={(event) => setLine(line.lineId, { description: event.target.value })} /></td><td><input type="number" value={line.debit} onChange={(event) => setLine(line.lineId, { debit: Number(event.target.value) || 0, credit: 0 })} /></td><td><input type="number" value={line.credit} onChange={(event) => setLine(line.lineId, { credit: Number(event.target.value) || 0, debit: 0 })} /></td><td><button type="button" className="sci-pos-button sci-pos-button--danger" onClick={() => setLines((current) => current.filter((item) => item.lineId !== line.lineId))}>Remove</button></td></tr>)}</tbody>
            </table>
            <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => setLines([...lines, blankLine()])}>Add Line</button>
            <div className={`journal-balance-box ${totals.balanced ? 'journal-balance-box--ok' : 'journal-balance-box--bad'}`}>
              <strong>{totals.balanced ? 'Balanced' : 'Out of Balance'}</strong>
              <span>Debits {totals.totalDebit.toFixed(2)} | Credits {totals.totalCredit.toFixed(2)} | Difference {totals.difference.toFixed(2)}</span>
              {!validation.ok && <small>{validation.messages.join(' ')}</small>}
            </div>
            {savedJournal && <JournalEntryPrintDocument journal={savedJournal} businessName={businessName} />}
            <div className="a5-tool-note">Accounting readiness preview only. Not final posted accounts.</div>
            <footer className="a5-tool-actions">
              <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={() => void saveDraft()}>Save Draft</button>
              <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => onSaved(validation.messages.join(' ') || 'Balance check passed.')}>Balance Check</button>
              <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => void action('review')} disabled={!validation.ok}>Submit for Review</button>
              <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => void action('post')} disabled={!validation.ok}>Mark Posted Preview</button>
              <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={printJournal}>Print Journal</button>
            </footer>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="a5-field"><span>{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}
