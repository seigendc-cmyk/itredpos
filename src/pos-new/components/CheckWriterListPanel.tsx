import { useEffect, useState } from 'react';
import RowActionMenu, { RowActionMenuItem } from './RowActionMenu';
import type { CheckStatus, CheckWriterRecord } from '../types/posTypes';
import { getChecks, markCheckIssuedLocal, prepareCheck, printCheckPreview, voidCheck } from '../services/checkWriterService';

export default function CheckWriterListPanel({ staffName, onOpen, onNotice }: { staffName: string; onOpen: (check: CheckWriterRecord) => void; onNotice: (message: string) => void }) {
  const [rows, setRows] = useState<CheckWriterRecord[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<CheckStatus | 'All'>('All');
  const [openId, setOpenId] = useState<string | null>(null);

  const load = () => void getChecks({ search, status }).then(setRows);
  useEffect(load, [search, status]);

  const act = async (check: CheckWriterRecord, action: 'prepare' | 'print' | 'issue' | 'void') => {
    try {
      if (action === 'prepare') await prepareCheck(check.checkId, staffName);
      if (action === 'print') await printCheckPreview(check.checkId, staffName);
      if (action === 'issue') await markCheckIssuedLocal(check.checkId, staffName);
      if (action === 'void') await voidCheck(check.checkId, staffName, 'Voided from list panel.');
      onNotice(`Check ${action} recorded locally.`);
      load();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'Check action failed.');
    }
  };

  const items = (check: CheckWriterRecord): RowActionMenuItem[] => [
    { label: 'View Check', onClick: () => onOpen(check) },
    { label: 'Edit Draft', onClick: () => onOpen(check), disabled: check.status !== 'Draft' },
    { label: 'Submit for Approval', onClick: () => void act(check, 'prepare') },
    { label: 'Print Preview', onClick: () => void act(check, 'print') },
    { label: 'Mark Issued Local', onClick: () => void act(check, 'issue') },
    { label: 'Void Check', onClick: () => void act(check, 'void'), danger: true },
    { label: 'Export Row', onClick: () => onNotice(`${check.checkNumber} row export prepared.`) }
  ];

  return (
    <section className="sci-pos-card">
      <div className="sci-pos-card__bar"><div><p className="sci-pos-eyebrow">Check Writer</p><h2>Check List</h2></div></div>
      <div className="pos-approval-filter-row"><input className="border border-[#b1b5c2] px-3 py-2 text-xs" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search checks" /><select className="border border-[#b1b5c2] px-3 py-2 text-xs" value={status} onChange={(event) => setStatus(event.target.value as CheckStatus | 'All')}><option>All</option>{['Draft', 'Prepared', 'PendingApproval', 'Approved', 'PrintedPreview', 'IssuedLocal', 'Voided', 'Cancelled'].map((item) => <option key={item}>{item}</option>)}</select></div>
      <div className="sci-pos-table-wrap"><table className="sci-pos-table"><thead><tr><th>Check No.</th><th>Date</th><th>Payee</th><th>Purpose</th><th>Amount</th><th>Bank Account</th><th>Status</th><th>Action</th></tr></thead><tbody>{rows.map((row) => <tr key={row.checkId}><td className="sci-pos-table__strong">{row.checkNumber}</td><td>{row.checkDate}</td><td>{row.payeeName}</td><td>{row.paymentPurpose}</td><td>{row.currency} {row.amount.toFixed(2)}</td><td>{row.bankAccountName}</td><td>{row.status}</td><td><RowActionMenu open={openId === row.checkId} onOpenChange={(open) => setOpenId(open ? row.checkId : null)} items={items(row)} /></td></tr>)}{rows.length === 0 && <tr><td colSpan={8} className="sci-pos-empty-cell">No checks saved yet.</td></tr>}</tbody></table></div>
    </section>
  );
}
