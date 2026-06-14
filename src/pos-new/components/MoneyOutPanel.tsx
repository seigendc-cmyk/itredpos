import { useEffect, useState } from 'react';
import type { FinancialActivityRecord } from '../types';
import { getMoneyOutSummary } from '../services/financialControlService';
import { ActivityPanel } from './MoneyInPanel';

export default function MoneyOutPanel() {
  const [rows, setRows] = useState<FinancialActivityRecord[]>([]);
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    void getMoneyOutSummary({ search }).then(setRows);
  }, [search]);

  return (
    <ActivityPanel title="Money Out" subtitle="Supplier payment, drawer expense, refund, purchase and reserve pressure preview." rows={rows} search={search} setSearch={setSearch} openId={openId} setOpenId={setOpenId} />
  );
}
