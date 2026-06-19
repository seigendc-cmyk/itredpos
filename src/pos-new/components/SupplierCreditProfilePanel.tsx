import { useEffect, useState } from 'react';
import type { SupplierCreditProfile } from '../types';
import { blockSupplierCredit, getSupplierCreditProfiles, releaseSupplierCredit, updateSupplierCreditProfile } from '../services/creditorsService';
import RowActionMenu, { type RowActionMenuItem } from './RowActionMenu';

const money = (value: number) => `$${value.toFixed(2)}`;

export default function SupplierCreditProfilePanel() {
  const [profiles, setProfiles] = useState<SupplierCreditProfile[]>([]);
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const load = () => setProfiles(getSupplierCreditProfiles({ search }));
  useEffect(load, [search]);

  const updatePreferred = (profile: SupplierCreditProfile) => {
    updateSupplierCreditProfile(profile.supplierId, { preferredSupplier: !profile.preferredSupplier, creditStatus: !profile.preferredSupplier ? 'Preferred' : 'CreditAllowed' });
    setNotice(`${profile.supplierName} preferred supplier flag updated locally.`);
    load();
  };

  const supplierActions = (profile: SupplierCreditProfile): RowActionMenuItem[] => [
    { id: 'preferred', label: profile.preferredSupplier ? 'Clear Preferred' : 'Mark Preferred', onClick: () => updatePreferred(profile) },
    { id: 'block', label: 'Block', danger: true, separatorBefore: true, disabled: profile.creditStatus === 'CreditBlocked', onClick: async () => { await blockSupplierCredit(profile.supplierId, 'Build 19AO supplier credit block review.', 'Manager'); setNotice('Supplier credit block approval placeholder created.'); load(); } },
    { id: 'release', label: 'Release', disabled: profile.creditStatus !== 'CreditBlocked', onClick: async () => { await releaseSupplierCredit(profile.supplierId, 'Build 19AO supplier release review.', 'Manager'); setNotice('Supplier credit release approval placeholder created.'); load(); } }
  ];

  return (
    <section className="creditors-panel">
      <div className="creditors-panel-header">
        <div>
          <span>Supplier Credit Profiles</span>
          <h3>Supplier terms, credit limits, payable balances and risk controls</h3>
        </div>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search supplier, code, status..." />
      </div>
      {notice && <div className="creditors-notice">{notice}</div>}
      <div className="creditors-card-grid">
        {profiles.map((profile) => (
          <article className="creditors-card" key={profile.supplierId}>
            <div className="creditors-card-title">
              <strong>{profile.supplierName}</strong>
              <span>{profile.supplierCode}</span>
            </div>
            <dl className="creditors-metrics">
              <div><dt>Status</dt><dd>{profile.creditStatus}</dd></div>
              <div><dt>Terms</dt><dd>{profile.paymentTermsDays} days</dd></div>
              <div><dt>Limit</dt><dd>{money(profile.supplierCreditLimit)}</dd></div>
              <div><dt>Payable</dt><dd>{money(profile.currentPayableBalance)}</dd></div>
              <div><dt>Overdue</dt><dd>{money(profile.overduePayableBalance)}</dd></div>
              <div><dt>Available</dt><dd>{money(profile.availableSupplierCredit)}</dd></div>
              <div><dt>Avg Pay</dt><dd>{profile.averageDaysToPay} days</dd></div>
              <div><dt>Late Count</dt><dd>{profile.latePaymentCount}</dd></div>
              <div><dt>Disputed</dt><dd>{money(profile.disputedAmount)}</dd></div>
              <div><dt>Next Review</dt><dd>{profile.nextReviewDate || 'Not set'}</dd></div>
            </dl>
            <p>{profile.notes}</p>
            {profile.blockedReason && <p className="creditors-warning">{profile.blockedReason}</p>}
            <div className="creditors-actions">
              <RowActionMenu rowId={profile.supplierId} ariaLabel={`Supplier actions for ${profile.supplierName}`} open={openMenuId === profile.supplierId} onOpenChange={(open) => setOpenMenuId(open ? profile.supplierId : null)} items={supplierActions(profile)} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
