import React, { useMemo, useState } from 'react';
import type { AccountType, COAAccount } from '../types/posTypes';

interface COAAccountEditDraftModalProps {
  account: COAAccount;
  accounts: COAAccount[];
  onClose: () => void;
  onSave: (changes: Partial<COAAccount>) => void;
}

const accountTypeOptions: AccountType[] = ['Asset', 'Liability', 'Equity', 'Income', 'Cost of Sales', 'Expense', 'Control', 'Tax'];
const linkedDomainOptions = ['Cash', 'EcoCash', 'Swipe', 'Bank', 'Sales', 'Receivables', 'Payables', 'Inventory', 'COGS', 'VAT', 'Deposits', 'COGS Reserve', 'Creditors', 'Debtors', 'Other'];

export default function COAAccountEditDraftModal({
  account,
  accounts,
  onClose,
  onSave
}: COAAccountEditDraftModalProps) {
  const [accountCode, setAccountCode] = useState(account.accountCode);
  const [accountName, setAccountName] = useState(account.accountName);
  const [accountType, setAccountType] = useState<AccountType>(account.accountType);
  const [linkedDomain, setLinkedDomain] = useState(account.linkedDomain);
  const [status, setStatus] = useState<COAAccount['status']>(account.status);
  const [notes, setNotes] = useState(account.notes || '');

  const validationMessage = useMemo(() => {
    if (!accountCode.trim()) return 'Account code is required.';
    if (!accountName.trim()) return 'Account name is required.';
    if (!accountType) return 'Account type is required.';
    if (!linkedDomain.trim()) return 'Linked domain is required.';
    const duplicate = accounts.some((item) =>
      item.id !== account.id &&
      item.status === 'Active' &&
      item.accountCode.trim().toLowerCase() === accountCode.trim().toLowerCase()
    );
    if (duplicate) return 'Account code already exists on another active account.';
    return '';
  }, [account.id, accountCode, accountName, accountType, accounts, linkedDomain]);

  return (
    <div className="owner-cash-modal-backdrop" role="dialog" aria-modal="true" aria-label="Edit draft COA account">
      <div className="owner-cash-modal coa-account-modal">
        <div className="owner-cash-modal-header">
          <div>
            <span>Accounting readiness preview only. Not final posted accounts.</span>
            <h3>Edit Draft Account</h3>
          </div>
          <button type="button" onClick={onClose}>Close</button>
        </div>
        <div className="owner-cash-modal-body pos-custom-scroll">
          {account.status !== 'Draft' && (
            <div className="owner-cash-warning">Active accounts cannot be edited as draft. Mark inactive or create a new replacement placeholder.</div>
          )}
          <div className="coa-edit-grid">
            <label><span>Account Code</span><input value={accountCode} onChange={(event) => setAccountCode(event.target.value)} disabled={account.status !== 'Draft'} /></label>
            <label><span>Account Name</span><input value={accountName} onChange={(event) => setAccountName(event.target.value)} disabled={account.status !== 'Draft'} /></label>
            <label><span>Account Type</span><select value={accountType} onChange={(event) => setAccountType(event.target.value as AccountType)} disabled={account.status !== 'Draft'}>{accountTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
            <label><span>Linked Domain</span><select value={linkedDomain} onChange={(event) => setLinkedDomain(event.target.value)} disabled={account.status !== 'Draft'}>{linkedDomainOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
            <label><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value as COAAccount['status'])} disabled={account.status !== 'Draft'}>{['Draft', 'Active', 'Inactive'].map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
            <label className="coa-edit-grid-wide"><span>Notes</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={5} disabled={account.status !== 'Draft'} /></label>
          </div>
          {validationMessage && <div className="owner-cash-warning">{validationMessage}</div>}
        </div>
        <div className="owner-cash-modal-actions">
          <button
            type="button"
            className="industrial-primary-button"
            disabled={Boolean(validationMessage) || account.status !== 'Draft'}
            onClick={() => onSave({ accountCode: accountCode.trim(), accountName: accountName.trim(), accountType, linkedDomain: linkedDomain.trim(), status, notes: notes.trim() })}
          >
            Save Draft
          </button>
          <button type="button" className="industrial-secondary-button" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
