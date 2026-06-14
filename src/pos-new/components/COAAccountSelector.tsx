import { useEffect, useMemo, useState } from 'react';
import type { COAAccount } from '../types/posTypes';
import { getCOAAccounts } from '../services/accountingService';

interface COAAccountSelectorProps {
  label: string;
  value?: string;
  onChange: (account: COAAccount) => void;
  includeInactive?: boolean;
}

export default function COAAccountSelector({ label, value, onChange, includeInactive = false }: COAAccountSelectorProps) {
  const [accounts, setAccounts] = useState<COAAccount[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    void getCOAAccounts().then(setAccounts);
  }, []);

  const filtered = useMemo(() => {
    const parts = search.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return accounts
      .filter((account) => includeInactive || account.status === 'Active')
      .filter((account) => parts.every((part) => `${account.accountCode} ${account.accountName} ${account.accountType} ${account.linkedDomain}`.toLowerCase().includes(part)))
      .slice(0, 80);
  }, [accounts, includeInactive, search]);

  const selectedValue = value || '';

  return (
    <label className="coa-selector">
      <span>{label}</span>
      <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search COA code, name, type, domain" />
      <select
        value={selectedValue}
        onChange={(event) => {
          const account = accounts.find((item) => item.id === event.target.value);
          if (account) onChange(account);
        }}
      >
        <option value="">Select account</option>
        {filtered.map((account) => (
          <option key={account.id} value={account.id}>
            {account.accountCode} - {account.accountName} ({account.accountType})
          </option>
        ))}
      </select>
    </label>
  );
}
