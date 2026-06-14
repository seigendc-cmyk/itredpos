import { useEffect, useState } from 'react';
import RowActionMenu, { RowActionMenuItem } from './RowActionMenu';
import type { JournalEntryRecord, JournalEntryStatus } from '../types/posTypes';
import { getJournalEntries, markJournalBalanced, markJournalPostedPreview, submitJournalForReview, voidJournalEntry } from '../services/journalEntryService';

export default function JournalEntryListPanel({ staffName, onOpen, onNotice }: { staffName: string; onOpen: (journal: JournalEntryRecord) => void; onNotice: (message: string) => void }) {
  const [rows, setRows] = useState<JournalEntryRecord[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<JournalEntryStatus | 'All'>('All');
  const [openId, setOpenId] = useState<string | null>(null);
  const load = () => void getJournalEntries({ search, status }).then(setRows);
  useEffect(load, [search, status]);

  const act = async (journal: JournalEntryRecord, action: 'balance' | 'review' | 'post' | 'void') => {
    try {
      if (action === 'balance') await markJournalBalanced(journal.journalId, staffName);
      if (action === 'review') await submitJournalForReview(journal.journalId, staffName);
      if (action === 'post') await markJournalPostedPreview(journal.journalId, staffName);
      if (action === 'void') await voidJournalEntry(journal.journalId, staffName, 'Voided from list panel.');
      onNotice(`Journal ${action} recorded locally.`);
      load();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'Journal action failed.');
    }
  };

  const items = (journal: JournalEntryRecord): RowActionMenuItem[] => [
    { label: 'View Journal', onClick: () => onOpen(journal) },
    { label: 'Edit Draft', onClick: () => onOpen(journal), disabled: !['Draft', 'Balanced', 'OutOfBalance'].includes(journal.status) },
    { label: 'Balance Check', onClick: () => void act(journal, 'balance') },
    { label: 'Submit for Review', onClick: () => void act(journal, 'review'), disabled: !journal.balanced },
    { label: 'Mark Posted Preview', onClick: () => void act(journal, 'post'), disabled: !journal.balanced },
    { label: 'Void Journal', onClick: () => void act(journal, 'void'), danger: true },
    { label: 'Export Row', onClick: () => onNotice(`${journal.journalNumber} row export prepared.`) }
  ];

  return (
    <section className="sci-pos-card">
      <div className="sci-pos-card__bar"><div><p className="sci-pos-eyebrow">Journal Entry</p><h2>Journal List</h2></div></div>
      <div className="pos-approval-filter-row"><input className="border border-[#b1b5c2] px-3 py-2 text-xs" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search journals" /><select className="border border-[#b1b5c2] px-3 py-2 text-xs" value={status} onChange={(event) => setStatus(event.target.value as JournalEntryStatus | 'All')}><option>All</option>{['Draft', 'Balanced', 'OutOfBalance', 'PendingReview', 'ApprovedPreview', 'PostedPreview', 'Voided', 'Cancelled'].map((item) => <option key={item}>{item}</option>)}</select></div>
      <div className="sci-pos-table-wrap"><table className="sci-pos-table"><thead><tr><th>Journal No.</th><th>Date</th><th>Type</th><th>Reference</th><th>Description</th><th>Total Debit</th><th>Total Credit</th><th>Difference</th><th>Status</th><th>Action</th></tr></thead><tbody>{rows.map((row) => <tr key={row.journalId}><td className="sci-pos-table__strong">{row.journalNumber}</td><td>{row.journalDate}</td><td>{row.journalType}</td><td>{row.reference}</td><td>{row.description}</td><td>{row.totalDebit.toFixed(2)}</td><td>{row.totalCredit.toFixed(2)}</td><td>{row.difference.toFixed(2)}</td><td>{row.status}</td><td><RowActionMenu open={openId === row.journalId} onOpenChange={(open) => setOpenId(open ? row.journalId : null)} items={items(row)} /></td></tr>)}{rows.length === 0 && <tr><td colSpan={10} className="sci-pos-empty-cell">No journal entries saved yet.</td></tr>}</tbody></table></div>
    </section>
  );
}
