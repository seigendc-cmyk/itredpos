import { useState } from 'react';
import { cancelPurchaseCommitment, getSupplierPurchaseCommitments, linkCommitmentToGRN, markCommitmentFulfilled } from '../services/purchaseDisciplineService';

const money = (value: number) => `$${value.toFixed(2)}`;

export default function SupplierCommitmentsPanel() {
  const [search, setSearch] = useState('');
  const [version, setVersion] = useState(0);
  const commitments = getSupplierPurchaseCommitments({ search });
  void version;
  const reload = () => setVersion((value) => value + 1);
  return (
    <section className="creditors-panel">
      <div className="creditors-panel-header"><div><span>Supplier Commitments</span><h3>Approved reorder, PO, GRN and supplier-bill buying exposure</h3></div><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search supplier, product, commitment..." /></div>
      <div className="creditors-table-wrap"><table className="creditors-table"><thead><tr><th>Commitment No.</th><th>Type</th><th>Supplier</th><th>Product</th><th>Reference</th><th>Due</th><th>Amount</th><th>Reserve Needed</th><th>Reserve At Creation</th><th>Risk</th><th>Status</th><th>Action</th></tr></thead><tbody>{commitments.map((row) => <tr key={row.commitmentId}><td>{row.commitmentNumber}</td><td>{row.purchaseOrderId ? 'Purchase Order' : row.grnId ? 'GRN' : 'Reorder Request'}</td><td>{row.supplierName}</td><td>{row.productName || '-'}</td><td>{row.purchaseOrderId || row.grnId || row.sourceRequestId || '-'}</td><td>{row.dueDate || '-'}</td><td>{money(row.amount)}</td><td>{money(row.reserveNeeded)}</td><td>{money(row.reserveAvailableAtCreation)}</td><td>{row.riskLevel}</td><td>{row.status}</td><td><select defaultValue="" onChange={(event) => { const action = event.target.value; if (action === 'fulfill') markCommitmentFulfilled(row.commitmentId); if (action === 'linkgrn') linkCommitmentToGRN(row.commitmentId, `GRN-${Date.now().toString().slice(-4)}`); if (action === 'cancel') cancelPurchaseCommitment(row.commitmentId, 'Cancelled from Purchase Discipline.', 'Manager'); event.currentTarget.value = ''; reload(); }}><option value="">...</option><option value="linkgrn">Link GRN</option><option value="fulfill">Mark Fulfilled</option><option value="cancel">Cancel</option></select></td></tr>)}</tbody></table></div>
    </section>
  );
}
