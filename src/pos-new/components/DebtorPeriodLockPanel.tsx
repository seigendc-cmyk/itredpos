import { useState } from 'react';
import type { DebtorAdjustmentType, DebtorPeriodLock } from '../types';
import { approveTemporaryDebtorUnlock, closeDebtorPeriod, createDebtorPeriodAdjustment, createDebtorPeriodLock, getDebtorPeriodLocks, lockDebtorPeriod, requestDebtorPeriodUnlock } from '../services/customerCreditService';

interface DebtorPeriodLockPanelProps {
  staffName: string;
  customerId?: string;
  canManage: boolean;
  onNotice: (message: string) => void;
}

const adjustmentTypes: DebtorAdjustmentType[] = ['OpeningBalance', 'AllocationCorrection', 'DepositApplication', 'CreditNoteApplication', 'WriteOffAdjustment', 'PeriodCorrection'];

export default function DebtorPeriodLockPanel({ staffName, customerId = 'PERIOD', canManage, onNotice }: DebtorPeriodLockPanelProps) {
  const [locks, setLocks] = useState<DebtorPeriodLock[]>(() => getDebtorPeriodLocks());
  const [periodStart, setPeriodStart] = useState(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [adjustmentType, setAdjustmentType] = useState<DebtorAdjustmentType>('PeriodCorrection');
  const [amount, setAmount] = useState(0);

  const load = () => setLocks(getDebtorPeriodLocks());
  const firstLock = locks[0];

  const create = () => {
    createDebtorPeriodLock(periodStart, periodEnd, staffName);
    onNotice('Debtor period created locally.');
    load();
  };

  const act = async (lock: DebtorPeriodLock, action: 'Lock' | 'Unlock' | 'Temporary' | 'Close') => {
    if (action === 'Lock') await lockDebtorPeriod(lock.periodLockId, staffName, note || 'Locked locally.');
    if (action === 'Unlock') await requestDebtorPeriodUnlock(lock.periodLockId, staffName, note || 'Unlock requested locally.');
    if (action === 'Temporary') await approveTemporaryDebtorUnlock(lock.periodLockId, staffName, new Date(Date.now() + 86400000).toISOString(), note || 'Temporary unlock approved locally.');
    if (action === 'Close') await closeDebtorPeriod(lock.periodLockId, staffName, note || 'Closed.');
    onNotice(`Period ${action.toLowerCase()} action completed.`);
    load();
  };

  const adjustment = async () => {
    if (!firstLock) return;
    await createDebtorPeriodAdjustment({ periodLockId: firstLock.periodLockId, customerId, adjustmentType, amount, reason: note || 'Debtor period adjustment placeholder.', createdBy: staffName });
    onNotice('Debtor period adjustment placeholder created locally.');
  };

  return (
    <section className="sci-pos-card debtor-control-panel">
      <div className="sci-pos-card__bar"><div><p className="sci-pos-eyebrow">Audit Control</p><h2>Debtor Period Lock</h2></div><span>{locks.length} periods</span></div>
      <div className="pos-credit-config-grid">
        <label>Period Start<input type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} /></label>
        <label>Period End<input type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} /></label>
        <label>Adjustment Type<select value={adjustmentType} onChange={(event) => setAdjustmentType(event.target.value as DebtorAdjustmentType)}>{adjustmentTypes.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Adjustment Amount<input type="number" value={amount} onChange={(event) => setAmount(Number(event.target.value))} /></label>
        <label className="pos-credit-config-grid__wide">Reason / Notes<textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} /></label>
      </div>
      <div className="pos-new-customer-modal__actions">
        <button disabled={!canManage} className="pos-action-button pos-action-button-secondary" onClick={create}>Create Period</button>
        <button disabled={!canManage || !firstLock} className="pos-action-button pos-action-button-primary" onClick={() => void adjustment()}>Create Adjustment</button>
      </div>
      <div className="collection-diary-table-scroll">
        <table className="sci-pos-table collection-diary-table">
          <thead><tr><th>Period</th><th>Status</th><th>Locked By</th><th>Unlock Reason</th><th>Notes</th><th>Actions</th></tr></thead>
          <tbody>{locks.map((lock) => <tr key={lock.periodLockId}><td>{lock.periodStart} to {lock.periodEnd}</td><td>{lock.status}</td><td>{lock.lockedBy || 'None'}</td><td>{lock.unlockReason || 'None'}</td><td>{lock.notes}</td><td><button disabled={!canManage} onClick={() => void act(lock, 'Lock')}>Lock</button><button disabled={!canManage} onClick={() => void act(lock, 'Unlock')}>Request Unlock</button><button disabled={!canManage} onClick={() => void act(lock, 'Temporary')}>Temp Unlock</button><button disabled={!canManage} onClick={() => void act(lock, 'Close')}>Close</button></td></tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}
