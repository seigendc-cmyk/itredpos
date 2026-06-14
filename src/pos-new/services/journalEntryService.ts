import type { JournalEntryLine, JournalEntryRecord, JournalEntryStatus } from '../types/posTypes';
import { createFinancialActivityRecord } from './financialControlService';
import { getFinancialToolEvents } from './checkWriterService';

const JOURNALS_KEY = 'itred_pos_journal_entries_v1';
const JOURNAL_SEQUENCE_KEY = 'itred_pos_journal_sequence_v1';
const CHECK_EVENTS_KEY = 'itred_pos_check_writer_events_v1';

const now = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);

function readJson<T>(key: string, fallback: T): T {
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(fallback));
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch {
    localStorage.setItem(key, JSON.stringify(fallback));
    return fallback;
  }
}

function saveJson<T>(key: string, value: T): T {
  if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(value));
  return value;
}

function addEvent(eventType: string, message: string, staffId = 'Admin User') {
  const rows = getFinancialToolEvents();
  saveJson(CHECK_EVENTS_KEY, [{ eventId: `FTE-${Date.now()}`, eventType, message, staffId, createdAt: now() }, ...rows].slice(0, 120));
}

export function calculateJournalTotals(lines: JournalEntryLine[]) {
  const totalDebit = lines.reduce((total, line) => total + (Number(line.debit) || 0), 0);
  const totalCredit = lines.reduce((total, line) => total + (Number(line.credit) || 0), 0);
  const difference = Number((totalDebit - totalCredit).toFixed(2));
  return { totalDebit, totalCredit, difference, balanced: Math.abs(difference) < 0.01 };
}

export function validateJournalBalance(lines: JournalEntryLine[]): { ok: boolean; messages: string[] } {
  const messages: string[] = [];
  if (lines.length < 2) messages.push('At least two journal lines are required.');
  lines.forEach((line, index) => {
    if (!line.accountId) messages.push(`Line ${index + 1} requires an account.`);
    if ((line.debit || 0) > 0 && (line.credit || 0) > 0) messages.push(`Line ${index + 1} cannot have both debit and credit.`);
    if ((line.debit || 0) <= 0 && (line.credit || 0) <= 0) messages.push(`Line ${index + 1} requires debit or credit greater than zero.`);
  });
  const totals = calculateJournalTotals(lines);
  if (!totals.balanced) messages.push(`Journal is out of balance by ${totals.difference.toFixed(2)}.`);
  return { ok: messages.length === 0, messages };
}

function nextJournalNumber(): string {
  const current = readJson<number>(JOURNAL_SEQUENCE_KEY, 1);
  saveJson(JOURNAL_SEQUENCE_KEY, current + 1);
  return `JRN-${String(current).padStart(6, '0')}`;
}

function defaultJournals(): JournalEntryRecord[] {
  return [];
}

export async function getJournalEntries(filters: { search?: string; status?: JournalEntryStatus | 'All' } = {}): Promise<JournalEntryRecord[]> {
  const rows = readJson<JournalEntryRecord[]>(JOURNALS_KEY, defaultJournals());
  const parts = (filters.search || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
  return rows.filter((row) =>
    (!filters.status || filters.status === 'All' || row.status === filters.status) &&
    parts.every((part) => `${row.journalNumber} ${row.journalType} ${row.reference} ${row.description} ${row.status}`.toLowerCase().includes(part))
  );
}

export async function createJournalEntryDraft(payload: Partial<JournalEntryRecord>, staffId = 'Admin User'): Promise<JournalEntryRecord[]> {
  const rows = await getJournalEntries();
  const totals = calculateJournalTotals(payload.lines || []);
  const next: JournalEntryRecord = {
    journalId: `JRN-ID-${Date.now()}`,
    journalNumber: payload.journalNumber || nextJournalNumber(),
    journalDate: payload.journalDate || today(),
    journalType: payload.journalType || 'General',
    description: payload.description || 'Manual accounting readiness preview.',
    reference: payload.reference || 'Manual',
    lines: payload.lines || [],
    ...totals,
    status: totals.balanced ? 'Balanced' : 'OutOfBalance',
    preparedBy: staffId,
    preparedAt: now(),
    notes: payload.notes || 'Accounting readiness preview only. Not final posted accounts.',
    createdAt: now(),
    updatedAt: now()
  };
  addEvent('JOURNAL_DRAFT_CREATED', `${next.journalNumber} draft created.`, staffId);
  return saveJson(JOURNALS_KEY, [next, ...rows]);
}

export async function updateJournalEntry(journalId: string, patch: Partial<JournalEntryRecord>, staffId = 'Admin User'): Promise<JournalEntryRecord[]> {
  const rows = (await getJournalEntries()).map((row) => {
    if (row.journalId !== journalId) return row;
    const lines = patch.lines || row.lines;
    const totals = calculateJournalTotals(lines);
    return { ...row, ...patch, lines, ...totals, status: totals.balanced ? 'Balanced' as const : 'OutOfBalance' as const, updatedAt: now() };
  });
  addEvent('JOURNAL_BALANCE_CHECK_RUN', `${journalId} balance check run.`, staffId);
  return saveJson(JOURNALS_KEY, rows);
}

export const markJournalBalanced = (journalId: string, staffId = 'Admin User') => updateJournalEntry(journalId, {}, staffId);

async function setJournalStatus(journalId: string, status: JournalEntryStatus, staffId: string, eventType: string, patch: Partial<JournalEntryRecord> = {}) {
  const rows = (await getJournalEntries()).map((row) => row.journalId === journalId ? { ...row, ...patch, status, updatedAt: now() } : row);
  const row = rows.find((item) => item.journalId === journalId);
  addEvent(eventType, `${row?.journalNumber || journalId} ${status}.`, staffId);
  return saveJson(JOURNALS_KEY, rows);
}

export async function submitJournalForReview(journalId: string, staffId = 'Admin User') {
  const journal = (await getJournalEntries()).find((row) => row.journalId === journalId);
  if (!journal || !validateJournalBalance(journal.lines).ok) throw new Error('Journal must be balanced before review.');
  return setJournalStatus(journalId, 'PendingReview', staffId, 'JOURNAL_SUBMITTED_FOR_REVIEW');
}

export async function approveJournalPreview(journalId: string, staffId = 'Admin User', note = '') {
  return setJournalStatus(journalId, 'ApprovedPreview', staffId, 'JOURNAL_SUBMITTED_FOR_REVIEW', { reviewedBy: staffId, reviewedAt: now(), notes: note });
}

export async function markJournalPostedPreview(journalId: string, staffId = 'Admin User', note = '') {
  const journal = (await getJournalEntries()).find((row) => row.journalId === journalId);
  if (!journal || !validateJournalBalance(journal.lines).ok) throw new Error('Journal must be balanced before Posted Preview.');
  await createFinancialActivityRecord({
    type: 'Adjustment',
    source: 'ManualPlaceholder',
    sourceReferenceId: journal.journalId,
    sourceReferenceNumber: journal.journalNumber,
    description: `${journal.journalType} journal posted preview. ${journal.description}`,
    amount: journal.totalDebit,
    status: 'PostedPreview',
    staffName: staffId,
    notes: note || 'Accounting readiness preview only. Not final posted accounts.'
  });
  return setJournalStatus(journalId, 'PostedPreview', staffId, 'JOURNAL_MARKED_POSTED_PREVIEW', { postedPreviewBy: staffId, postedPreviewAt: now(), notes: note });
}

export const voidJournalEntry = (journalId: string, staffId = 'Admin User', reason = '') => setJournalStatus(journalId, 'Voided', staffId, 'JOURNAL_VOIDED', { notes: reason });
export const cancelJournalEntry = (journalId: string, staffId = 'Admin User', reason = '') => setJournalStatus(journalId, 'Cancelled', staffId, 'JOURNAL_CANCELLED', { notes: reason });
