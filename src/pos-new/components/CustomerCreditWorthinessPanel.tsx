import { ShieldCheck } from 'lucide-react';
import type { CustomerCreditProfile, CustomerCreditWorthinessScore } from '../types';

interface CustomerCreditWorthinessPanelProps {
  score: CustomerCreditWorthinessScore | null;
  profile: CustomerCreditProfile | null;
}

function money(value?: number): string {
  return `USD ${(value || 0).toFixed(2)}`;
}

function dateLabel(value?: string): string {
  if (!value) return 'None';
  return new Date(value).toLocaleDateString();
}

export default function CustomerCreditWorthinessPanel({ score, profile }: CustomerCreditWorthinessPanelProps) {
  if (!score || !profile) {
    return (
      <section className="sci-pos-card pos-credit-panel">
        <div className="sci-pos-card__bar"><div><p className="sci-pos-eyebrow">Credit Worthiness</p><h2>No Score</h2></div><ShieldCheck size={18} /></div>
        <p className="pos-credit-empty-text">Select a customer to calculate credit worthiness locally.</p>
      </section>
    );
  }

  const rows = [
    ['Grade', score.grade],
    ['Score', `${score.score}/100`],
    ['Recommended Credit Limit', money(score.recommendedCreditLimit)],
    ['Current Credit Limit', money(profile.creditLimit)],
    ['Outstanding Balance', money(score.outstandingBalance)],
    ['Overdue Balance', money(score.overdueBalance)],
    ['Average Days to Pay', String(score.averageDaysToPay)],
    ['Late Payment Count', String(score.latePaymentCount)],
    ['Return Count', String(score.returnCount)],
    ['Purchase Frequency', score.totalPurchases > 0 ? `${score.totalCreditSales > 0 ? 'Credit + ' : ''}Active` : 'Low activity'],
    ['Last Payment Date', dateLabel(profile.lastPaymentDate)],
    ['Recommended Action', score.recommendedAction]
  ];

  return (
    <section className="sci-pos-card pos-credit-panel">
      <div className="sci-pos-card__bar"><div><p className="sci-pos-eyebrow">Credit Worthiness</p><h2>{score.grade}</h2></div><ShieldCheck size={18} /></div>
      <div className="pos-credit-profile-grid">{rows.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
      <div className="pos-credit-reasons">
        {score.reasonList.map((reason) => <span key={reason}>{reason}</span>)}
      </div>
    </section>
  );
}
