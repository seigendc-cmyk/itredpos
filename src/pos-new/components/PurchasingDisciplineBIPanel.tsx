import { useEffect, useState } from 'react';
import { BarChart3, ChevronRight, RefreshCcw, Save, ShieldAlert, SlidersHorizontal, Truck } from 'lucide-react';
import {
  getPurchasingDisciplineBISummary,
  updatePurchasingDisciplineBIRule,
  type PurchasingDisciplineBIRule,
  type PurchasingDisciplineBISummary
} from '../services/purchaseDisciplineService';

const money = (value: number) => `$${value.toFixed(2)}`;
const score = (value: number) => `${Math.round(value)}%`;

interface PurchasingDisciplineBIPanelProps {
  onOpenReport?: (target: 'Supplier Commitments' | 'COGS Buying Control' | 'Reorder Protection Rules' | 'Purchase BI Warnings') => void;
}

function riskClass(value: string): string {
  if (value === 'Critical' || value === 'Blocked' || value === 'High') return 'pd-bi-risk-high';
  if (value === 'Medium') return 'pd-bi-risk-medium';
  return 'pd-bi-risk-low';
}

function MetricCard({ label, value, note, tone }: { label: string; value: string; note: string; tone?: string }) {
  return (
    <div className={`pd-bi-metric ${tone || ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}

export default function PurchasingDisciplineBIPanel({ onOpenReport }: PurchasingDisciplineBIPanelProps) {
  const [summary, setSummary] = useState<PurchasingDisciplineBISummary | null>(null);
  const [activeRule, setActiveRule] = useState<PurchasingDisciplineBIRule | null>(null);

  const load = () => {
    void getPurchasingDisciplineBISummary().then(setSummary);
  };

  useEffect(() => {
    load();
  }, []);

  const saveRule = () => {
    if (!activeRule) return;
    updatePurchasingDisciplineBIRule(activeRule.ruleId, activeRule);
    setActiveRule(null);
    load();
  };

  if (!summary) {
    return (
      <section className="pd-bi-panel">
        <div className="pd-bi-loading">Loading purchasing discipline intelligence...</div>
      </section>
    );
  }

  const reportTarget = (reportId: string): 'Supplier Commitments' | 'COGS Buying Control' | 'Reorder Protection Rules' | 'Purchase BI Warnings' => {
    if (reportId === 'supplier-risk') return 'Supplier Commitments';
    if (reportId === 'cogs-control') return 'COGS Buying Control';
    if (reportId === 'rule-config') return 'Reorder Protection Rules';
    return 'Purchase BI Warnings';
  };

  return (
    <section className="pd-bi-panel">
      <div className="pd-bi-panel-header">
        <div>
          <span>Purchasing Discipline BI</span>
          <h2>Supplier, product and reserve intelligence</h2>
          <p>Decision control for replenishment, supplier exposure and protected COGS reserve buying.</p>
        </div>
        <button type="button" onClick={load}><RefreshCcw className="w-4 h-4" /> Refresh BI</button>
      </div>

      <div className="pd-bi-health-card">
        <div>
          <span>COGS Health Score</span>
          <strong>{summary.cogs.cogsHealthScore}</strong>
          <small className={riskClass(summary.cogs.cogsHealthStatus)}>{summary.cogs.cogsHealthStatus} control risk</small>
        </div>
        <p>{summary.cogs.summary}</p>
        <button type="button" onClick={() => onOpenReport?.('COGS Buying Control')}>Drill into reserve control <ChevronRight className="w-4 h-4" /></button>
      </div>

      <div className="pd-bi-metric-grid">
        <MetricCard label="COGS reserve balance" value={money(summary.cogs.cogsReserveBalance)} note="Protected stock replacement cash" />
        <MetricCard label="Supplier commitments" value={money(summary.cogs.supplierCommitments)} note="Active buying exposure" />
        <MetricCard label="Cash available" value={money(summary.cogs.cashAvailable)} note="Reserve after commitments and bills" />
        <MetricCard label="1 week forecast" value={money(summary.cogs.oneWeekForecast)} note="Projected reserve after demand" />
        <MetricCard label="2 week forecast" value={money(summary.cogs.twoWeekForecast)} note="Projected reserve after demand" />
        <MetricCard label="3 week forecast" value={money(summary.cogs.threeWeekForecast)} note="Projected reserve after demand" />
      </div>

      <div className="pd-bi-two-column">
        <div className="pd-bi-card">
          <div className="pd-bi-card-header">
            <div><Truck className="w-4 h-4" /><span>Supplier analytics</span></div>
            <button type="button" onClick={() => onOpenReport?.('Supplier Commitments')}>Open report</button>
          </div>
          <div className="pd-bi-table-wrap">
            <table className="pd-bi-table">
              <thead><tr><th>Supplier</th><th>Reliability</th><th>Risk</th><th>Lead time</th><th>Delivery</th><th>Packaging</th><th>Correct supply</th><th>Decision</th></tr></thead>
              <tbody>
                {summary.suppliers.map((supplier) => (
                  <tr key={supplier.supplierId}>
                    <td>{supplier.supplierName}</td>
                    <td>{score(supplier.reliabilityScore)}</td>
                    <td className={supplier.riskScore > 60 ? 'pd-bi-danger-text' : ''}>{score(supplier.riskScore)}</td>
                    <td>{score(supplier.leadTimeScore)}</td>
                    <td>{score(supplier.deliveryPerformance)}</td>
                    <td>{supplier.packagingComplaints}</td>
                    <td>{score(supplier.correctSupplyRate)}</td>
                    <td>{supplier.recommendation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="pd-bi-card">
          <div className="pd-bi-card-header">
            <div><BarChart3 className="w-4 h-4" /><span>Product analytics</span></div>
            <button type="button" onClick={() => onOpenReport?.('Purchase BI Warnings')}>Open report</button>
          </div>
          <div className="pd-bi-table-wrap">
            <table className="pd-bi-table">
              <thead><tr><th>Product</th><th>Sales velocity</th><th>Purchase freq.</th><th>Supplier availability</th><th>Brand tolerance</th><th>Margin</th><th>Decision</th></tr></thead>
              <tbody>
                {summary.products.slice(0, 12).map((product) => (
                  <tr key={product.productId}>
                    <td><strong>{product.productName}</strong><small>{product.sku} / {product.supplierName}</small></td>
                    <td>{product.salesVelocity}</td>
                    <td>{product.purchaseFrequency}</td>
                    <td>{score(product.supplierAvailability)}</td>
                    <td>{score(product.brandTolerance)}</td>
                    <td className={product.marginPerformance < 45 ? 'pd-bi-danger-text' : ''}>{score(product.marginPerformance)}</td>
                    <td>{product.recommendation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="pd-bi-report-grid">
        {summary.drillReports.map((report) => (
          <button key={report.reportId} type="button" onClick={() => onOpenReport?.(reportTarget(report.reportId))} className="pd-bi-report-card">
            <span className={riskClass(report.riskLevel)}>{report.riskLevel}</span>
            <strong>{report.title}</strong>
            <small>{report.description}</small>
            <em>{report.count} records</em>
          </button>
        ))}
      </div>

      <div className="pd-bi-card">
        <div className="pd-bi-card-header">
          <div><SlidersHorizontal className="w-4 h-4" /><span>Configurable system rules</span></div>
          <button type="button" onClick={() => onOpenReport?.('Reorder Protection Rules')}>Rules library</button>
        </div>
        <div className="pd-bi-rules-grid">
          {summary.rules.map((rule) => (
            <button key={rule.ruleId} type="button" className="pd-bi-rule" onClick={() => setActiveRule(rule)}>
              <span>{rule.active ? 'Active' : 'Inactive'}</span>
              <strong>{rule.title}</strong>
              <small>{rule.description}</small>
              <em>Threshold {rule.threshold} / Weight {rule.weight}</em>
            </button>
          ))}
        </div>
      </div>

      {activeRule && (
        <div className="pd-bi-modal-backdrop" role="presentation" onClick={() => setActiveRule(null)}>
          <div className="pd-bi-modal" role="dialog" aria-modal="true" aria-label="Edit BI rule" onClick={(event) => event.stopPropagation()}>
            <div className="pd-bi-card-header">
              <div><ShieldAlert className="w-4 h-4" /><span>Edit BI rule</span></div>
              <button type="button" onClick={() => setActiveRule(null)}>Close</button>
            </div>
            <label>Rule title<input value={activeRule.title} onChange={(event) => setActiveRule({ ...activeRule, title: event.target.value })} /></label>
            <label>Threshold<input type="number" value={activeRule.threshold} onChange={(event) => setActiveRule({ ...activeRule, threshold: Number(event.target.value) || 0 })} /></label>
            <label>Weight<input type="number" value={activeRule.weight} onChange={(event) => setActiveRule({ ...activeRule, weight: Number(event.target.value) || 0 })} /></label>
            <label>Severity<select value={activeRule.severity} onChange={(event) => setActiveRule({ ...activeRule, severity: event.target.value as PurchasingDisciplineBIRule['severity'] })}><option>Low</option><option>Medium</option><option>High</option><option>Critical</option><option>Blocked</option></select></label>
            <label className="pd-bi-checkbox"><input type="checkbox" checked={activeRule.active} onChange={(event) => setActiveRule({ ...activeRule, active: event.target.checked })} /> Active rule</label>
            <label>Description<textarea rows={3} value={activeRule.description} onChange={(event) => setActiveRule({ ...activeRule, description: event.target.value })} /></label>
            <button type="button" className="pd-bi-save" onClick={saveRule}><Save className="w-4 h-4" /> Save rule</button>
          </div>
        </div>
      )}
    </section>
  );
}
