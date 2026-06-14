import { useEffect, useMemo, useState } from 'react';
import { Maximize2, Minus, RotateCcw, X } from 'lucide-react';
import type { CheckPaymentPurpose, CheckWriterRecord, FinancialControlAccount, PayeeRecord } from '../types/posTypes';
import COAAccountSelector from './COAAccountSelector';
import CheckPrintPreviewDocument from './CheckPrintPreviewDocument';
import { amountInWords } from '../utils/amountInWords';
import { getFinancialControlAccounts } from '../services/financialControlService';
import {
  createCheckDraft,
  generateNextCheckNumber,
  getCheckWriterSettings,
  getPayees,
  markCheckIssuedLocal,
  prepareCheck,
  printCheckPreview,
  voidCheck,
  cancelCheck
} from '../services/checkWriterService';

interface CheckWriterA5ModalProps {
  open: boolean;
  staffName: string;
  businessName: string;
  initialCheck?: CheckWriterRecord | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}

const purposes: CheckPaymentPurpose[] = ['SupplierPayment', 'DrawerExpense', 'PettyCash', 'Refund', 'OwnerDrawing', 'OperatingExpense', 'CustomerDepositRefund', 'COGSReserveUse', 'Other'];

export default function CheckWriterA5Modal({ open, staffName, businessName, initialCheck, onClose, onSaved }: CheckWriterA5ModalProps) {
  const [mode, setMode] = useState<'normal' | 'min' | 'max'>('normal');
  const [accounts, setAccounts] = useState<FinancialControlAccount[]>([]);
  const [payees, setPayees] = useState<PayeeRecord[]>([]);
  const [savedCheck, setSavedCheck] = useState<CheckWriterRecord | null>(initialCheck || null);
  const [form, setForm] = useState({
    checkNumber: '',
    checkDate: new Date().toISOString().slice(0, 10),
    payeeId: '',
    amount: '0',
    currency: 'USD',
    bankAccountId: '',
    debitAccountId: '',
    creditAccountId: '',
    paymentPurpose: 'OperatingExpense' as CheckPaymentPurpose,
    linkedModule: '',
    linkedRecordId: '',
    memo: ''
  });

  useEffect(() => {
    if (!open) return;
    void Promise.all([getFinancialControlAccounts(), getPayees({ activeOnly: true }), generateNextCheckNumber(), getCheckWriterSettings()]).then(([accountRows, payeeRows, nextNumber, settings]) => {
      setAccounts(accountRows);
      setPayees(payeeRows);
      const bank = accountRows.find((account) => account.accountId === settings.defaultBankAccountId) || accountRows.find((account) => account.accountType === 'Bank' || account.accountType === 'Cash') || accountRows[0];
      setForm((current) => ({
        ...current,
        checkNumber: initialCheck?.checkNumber || nextNumber,
        bankAccountId: initialCheck?.bankAccountId || bank?.accountId || '',
        creditAccountId: initialCheck?.creditAccountId || bank?.coaAccountId || '',
        debitAccountId: initialCheck?.debitAccountId || '',
        payeeId: initialCheck?.payeeId || '',
        amount: String(initialCheck?.amount || 0),
        paymentPurpose: initialCheck?.paymentPurpose || current.paymentPurpose,
        memo: initialCheck?.memo || current.memo
      }));
      setSavedCheck(initialCheck || null);
    });
  }, [open, initialCheck]);

  const amount = Number(form.amount) || 0;
  const amountWords = useMemo(() => amountInWords(amount), [amount]);
  const selectedPayee = payees.find((payee) => payee.payeeId === form.payeeId);
  const selectedBank = accounts.find((account) => account.accountId === form.bankAccountId);

  if (!open) return null;

  const saveDraft = async () => {
    try {
      const rows = await createCheckDraft({
        checkNumber: form.checkNumber,
        checkDate: form.checkDate,
        payeeId: selectedPayee?.payeeId,
        payeeName: selectedPayee?.payeeName,
        payeeType: selectedPayee?.payeeType,
        amount,
        amountInWords: amountWords,
        currency: form.currency,
        bankAccountId: selectedBank?.accountId,
        bankAccountName: selectedBank?.accountName,
        creditAccountId: form.creditAccountId || selectedBank?.coaAccountId,
        creditAccountName: selectedBank?.accountName,
        debitAccountId: form.debitAccountId,
        debitAccountName: form.debitAccountId,
        paymentPurpose: form.paymentPurpose,
        linkedModule: form.linkedModule,
        linkedRecordId: form.linkedRecordId,
        memo: form.memo
      }, staffName);
      setSavedCheck(rows[0]);
      onSaved(`${rows[0].checkNumber} saved locally.`);
    } catch (error) {
      onSaved(error instanceof Error ? error.message : 'Check draft could not be saved.');
    }
  };

  const act = async (action: 'prepare' | 'print' | 'issue' | 'void' | 'cancel') => {
    if (!savedCheck) {
      onSaved('Save draft before running this action.');
      return;
    }
    try {
      const rows = action === 'prepare'
        ? await prepareCheck(savedCheck.checkId, staffName)
        : action === 'print'
          ? await printCheckPreview(savedCheck.checkId, staffName)
          : action === 'issue'
            ? await markCheckIssuedLocal(savedCheck.checkId, staffName)
            : action === 'void'
              ? await voidCheck(savedCheck.checkId, staffName, 'Voided from Check Writer.')
              : await cancelCheck(savedCheck.checkId, staffName, 'Cancelled from Check Writer.');
      setSavedCheck(rows.find((row) => row.checkId === savedCheck.checkId) || rows[0]);
      if (action === 'print') {
        const printable = rows.find((row) => row.checkId === savedCheck.checkId) || savedCheck;
        const popup = window.open('', '_blank', 'width=900,height=700');
        if (popup) {
          popup.document.write(`<html><head><title>${printable.checkNumber}</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#1e222b}.box{border:1px solid #1e222b;padding:24px;display:grid;gap:14px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.line{border-bottom:1px solid #b1b5c2;padding-bottom:8px}small{color:#9a3412;font-weight:700;text-transform:uppercase}</style></head><body><div class="box"><h1>${businessName}</h1><h2>Check / Payment Voucher Preview</h2><div class="grid"><div class="line">Check No.<br><strong>${printable.checkNumber}</strong></div><div class="line">Date<br><strong>${printable.checkDate}</strong></div><div class="line">Payee<br><strong>${printable.payeeName}</strong></div><div class="line">Amount<br><strong>${printable.currency} ${printable.amount.toFixed(2)}</strong></div></div><p><strong>${printable.amountInWords}</strong></p><p>${printable.memo}</p><p>Prepared by: ${printable.createdBy}</p><p>Approved by: __________________ Signature: __________________</p><small>Financial Control preview only. Not final posted accounts or banking transaction.</small></div></body></html>`);
          popup.document.close();
          popup.print();
        }
      }
      onSaved(`Check ${action} recorded locally.`);
    } catch (error) {
      onSaved(error instanceof Error ? error.message : 'Action failed.');
    }
  };

  return (
    <div className="a5-tool-backdrop" role="dialog" aria-modal="true">
      <div className={`a5-tool-modal ${mode === 'max' ? 'a5-tool-modal--max' : ''} ${mode === 'min' ? 'a5-tool-modal--min' : ''}`}>
        <header className="a5-tool-header">
          <div><span>Financial Control</span><strong>A5 Check Writer</strong></div>
          <div className="a5-tool-controls">
            <button type="button" onClick={() => setMode('min')}><Minus size={14} /></button>
            <button type="button" onClick={() => setMode('normal')}><RotateCcw size={14} /></button>
            <button type="button" onClick={() => setMode('max')}><Maximize2 size={14} /></button>
            <button type="button" onClick={onClose}><X size={14} /></button>
          </div>
        </header>
        {mode !== 'min' && (
          <div className="a5-tool-body">
            <div className="a5-tool-grid">
              <Field label="Check Number" value={form.checkNumber} onChange={(value) => setForm({ ...form, checkNumber: value })} />
              <Field label="Check Date" type="date" value={form.checkDate} onChange={(value) => setForm({ ...form, checkDate: value })} />
              <label className="a5-field"><span>Payee</span><select value={form.payeeId} onChange={(event) => setForm({ ...form, payeeId: event.target.value, paymentPurpose: payees.find((payee) => payee.payeeId === event.target.value)?.defaultPaymentPurpose || form.paymentPurpose })}><option value="">Select payee</option>{payees.map((payee) => <option key={payee.payeeId} value={payee.payeeId}>{payee.payeeCode} - {payee.payeeName}</option>)}</select></label>
              <Field label="Amount" type="number" value={form.amount} onChange={(value) => setForm({ ...form, amount: value })} />
              <Field label="Currency" value={form.currency} onChange={(value) => setForm({ ...form, currency: value })} />
              <label className="a5-field"><span>Bank / Cash Account</span><select value={form.bankAccountId} onChange={(event) => setForm({ ...form, bankAccountId: event.target.value })}><option value="">Select account</option>{accounts.filter((account) => account.active && ['Bank', 'Cash', 'MobileMoney'].includes(account.accountType)).map((account) => <option key={account.accountId} value={account.accountId}>{account.accountCode} - {account.accountName}</option>)}</select></label>
              <COAAccountSelector label="Debit Account" value={form.debitAccountId} onChange={(account) => setForm({ ...form, debitAccountId: account.id })} />
              <COAAccountSelector label="Credit Account" value={form.creditAccountId} onChange={(account) => setForm({ ...form, creditAccountId: account.id })} />
              <label className="a5-field"><span>Purpose</span><select value={form.paymentPurpose} onChange={(event) => setForm({ ...form, paymentPurpose: event.target.value as CheckPaymentPurpose })}>{purposes.map((purpose) => <option key={purpose} value={purpose}>{purpose}</option>)}</select></label>
              <Field label="Linked Module" value={form.linkedModule} onChange={(value) => setForm({ ...form, linkedModule: value })} />
              <Field label="Linked Record" value={form.linkedRecordId} onChange={(value) => setForm({ ...form, linkedRecordId: value })} />
            </div>
            <label className="a5-field"><span>Amount in Words</span><input value={amountWords} readOnly /></label>
            <label className="a5-field"><span>Memo</span><textarea rows={3} value={form.memo} onChange={(event) => setForm({ ...form, memo: event.target.value })} /></label>
            {savedCheck && <CheckPrintPreviewDocument check={savedCheck} businessName={businessName} />}
            <div className="a5-tool-note">Financial Control preview only. Not final posted accounts or banking transaction.</div>
            <footer className="a5-tool-actions">
              <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={() => void saveDraft()}>Save Draft</button>
              <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => void act('prepare')}>Prepare Check</button>
              <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => void act('print')}>Print Preview</button>
              <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => void act('issue')}>Mark Issued Local</button>
              <button type="button" className="sci-pos-button sci-pos-button--danger" onClick={() => void act('void')}>Void</button>
              <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => void act('cancel')}>Cancel</button>
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
