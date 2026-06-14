import { useState } from 'react';
import type { ReorderProtectionDecision } from '../types';
import { getReorderProtectionRules, updateReorderProtectionRule } from '../services/purchaseDisciplineService';

export default function ReorderProtectionRulesPanel() {
  const [version, setVersion] = useState(0);
  const rules = getReorderProtectionRules();
  void version;
  const reload = () => setVersion((value) => value + 1);
  return (
    <section className="creditors-panel">
      <div className="creditors-panel-header"><div><span>Reorder Protection Rules</span><h3>Local purchase discipline rule thresholds and decisions</h3></div><button onClick={() => window.print()}>Print Rules</button></div>
      <div className="creditors-table-wrap"><table className="creditors-table"><thead><tr><th>Rule</th><th>Title</th><th>Active</th><th>Severity</th><th>Threshold</th><th>Decision</th><th>Description</th><th>Action</th></tr></thead><tbody>{rules.map((rule) => <tr key={rule.ruleId}><td>{rule.ruleCode}</td><td>{rule.title}</td><td>{rule.active ? 'Yes' : 'No'}</td><td>{rule.severity}</td><td>{rule.threshold}</td><td>{rule.decision}</td><td>{rule.description}</td><td><select defaultValue="" onChange={(event) => { const action = event.target.value; if (action === 'toggle') updateReorderProtectionRule(rule.ruleId, { active: !rule.active }); if (action === 'warn') updateReorderProtectionRule(rule.ruleId, { decision: 'Warn' as ReorderProtectionDecision }); if (action === 'approval') updateReorderProtectionRule(rule.ruleId, { decision: 'RequireApproval' as ReorderProtectionDecision }); if (action === 'block') updateReorderProtectionRule(rule.ruleId, { decision: 'Block' as ReorderProtectionDecision }); event.currentTarget.value = ''; reload(); }}><option value="">...</option><option value="toggle">Enable / Disable</option><option value="warn">Set Warn</option><option value="approval">Set Approval</option><option value="block">Set Block</option></select></td></tr>)}</tbody></table></div>
    </section>
  );
}
