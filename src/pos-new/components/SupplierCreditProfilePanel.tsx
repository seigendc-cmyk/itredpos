import { useEffect, useState } from 'react';
import type { SupplierCreditProfile } from '../types';
import { blockSupplierCredit, getSupplierCreditProfiles, releaseSupplierCredit, updateSupplierCreditProfile } from '../services/creditorsService';

const money = (value: number) => `$${value.toFixed(2)}`;

export default function SupplierCreditProfilePanel() {
  const [profiles, setProfiles] = useState<SupplierCreditProfile[]>([]);
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');

  const load = () => setProfiles(getSupplierCreditProfiles({ search }));
  useEffect(load, [search]);

  const updatePreferred = (profile: SupplierCreditProfile) => {
    updateSupplierCreditProfile(profile.supplierId, { preferredSupplier: !profile.preferredSupplier, creditStatus: !profile.preferredSupplier ? 'Preferred' : 'CreditAllowed' });
    setNotice(`${profile.supplierName} preferred supplier flag updated locally.`);
    load();
  };

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
              <button onClick={() => updatePreferred(profile)}>Mark Preferred</button>
              <button onClick={async () => { await blockSupplierCredit(profile.supplierId, 'Build 19AO supplier credit block review.', 'Manager'); setNotice('Supplier credit block approval placeholder created.'); load(); }}>Block</button>
              <button onClick={async () => { await releaseSupplierCredit(profile.supplierId, 'Build 19AO supplier release review.', 'Manager'); setNotice('Supplier credit release approval placeholder created.'); load(); }}>Release</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
