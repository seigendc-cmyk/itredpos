import { useEffect, useMemo, useState } from 'react';
import type { PurchaseDisciplineRequest } from '../types';
import {
  approvePurchaseDisciplineRequest,
  cancelPurchaseDisciplineRequest,
  convertRequestToPurchaseOrder,
  createPurchaseDisciplineRequest,
  createSupplierPurchaseCommitment,
  getCOGSBuyingCapacitySummary,
  getPurchaseDisciplineProducts,
  getPurchaseDisciplineRequests,
  getPurchaseDisciplineSuppliers,
  previewPurchaseRisk,
  rejectPurchaseDisciplineRequest
} from '../services/purchaseDisciplineService';

const money = (value: number) => `$${value.toFixed(2)}`;

export default function ReorderRequestsPanel() {
  const products = getPurchaseDisciplineProducts();
  const suppliers = getPurchaseDisciplineSuppliers();
  const [productId, setProductId] = useState(products[0]?.id || '');
  const [supplierId, setSupplierId] = useState(suppliers[0]?.supplierId || '');
  const [qty, setQty] = useState('5');
  const [reason, setReason] = useState('Build 19AQ reorder request review.');
  const [rows, setRows] = useState<PurchaseDisciplineRequest[]>([]);
  const [notice, setNotice] = useState('');
  const product = products.find((item) => item.id === productId) || products[0];
  const supplier = suppliers.find((item) => item.supplierId === supplierId) || suppliers[0];
  const requestQty = Math.max(0, Number(qty) || 0);
  const estimatedUnitCost = product?.costPrice ?? product?.cost ?? 0;
  const preview = useMemo(() => product ? previewPurchaseRisk({
    productId: product.id,
    productName: product.productName || product.name,
    sku: product.sku || product.code,
    branchId: product.branchId || 'BR-HARARE',
    branchName: product.branch || 'Harare Main',
    warehouseId: product.warehouseId || product.warehouse,
    supplierId: supplier?.supplierId,
    supplierName: supplier?.supplierName,
    requestedQty: requestQty,
    currentStockQty: product.availableStock ?? product.qtyOnHand ?? product.stock,
    reorderLevel: product.reorderLevel ?? product.minStock,
    suggestedReorderQty: requestQty,
    estimatedUnitCost,
    expectedSellingPrice: product.sellingPrice ?? product.price,
    requestedBy: 'Stock Controller',
    reason,
    notes: 'Local preview.'
  }) : null, [product, supplier, requestQty, estimatedUnitCost, reason]);

  const load = () => setRows(getPurchaseDisciplineRequests());
  useEffect(load, []);

  const createRequest = async () => {
    if (!product || requestQty <= 0) {
      setNotice('Select product and enter requested quantity above zero.');
      return;
    }
    const request = await createPurchaseDisciplineRequest({
      productId: product.id,
      productName: product.productName || product.name,
      sku: product.sku || product.code,
      branchId: product.branchId || 'BR-HARARE',
      branchName: product.branch || 'Harare Main',
      warehouseId: product.warehouseId || product.warehouse,
      supplierId: supplier?.supplierId,
      supplierName: supplier?.supplierName,
      requestedQty: requestQty,
      currentStockQty: product.availableStock ?? product.qtyOnHand ?? product.stock,
      reorderLevel: product.reorderLevel ?? product.minStock,
      suggestedReorderQty: requestQty,
      estimatedUnitCost,
      expectedSellingPrice: product.sellingPrice ?? product.price,
      requestedBy: 'Stock Controller',
      reason,
      notes: 'Build 19AQ local reorder request.'
    });
    setNotice(`${request.requestNumber} created with ${request.riskLevel} risk and ${request.protectionDecision} decision.`);
    load();
  };

  const createCommitment = async (request: PurchaseDisciplineRequest) => {
    const capacity = getCOGSBuyingCapacitySummary();
    await createSupplierPurchaseCommitment({
      sourceRequestId: request.requestId,
      supplierId: request.supplierId || 'SUP-LOCAL',
      supplierName: request.supplierName || 'Local Supplier',
      productId: request.productId,
      productName: request.productName,
      commitmentDate: new Date().toISOString().slice(0, 10),
      dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      amount: request.estimatedTotalCost,
      reserveNeeded: request.estimatedTotalCost,
      reserveAvailableAtCreation: capacity.currentReserveBalance,
      status: request.status === 'Approved' ? 'Active' : 'Draft',
      riskLevel: request.riskLevel,
      approvedBy: request.status === 'Approved' ? 'Manager' : undefined,
      createdBy: 'Stock Controller',
      notes: `Created from ${request.requestNumber}.`
    });
    setNotice(`Commitment created for ${request.requestNumber}.`);
  };

  return (
    <section className="creditors-panel">
      <div className="creditors-panel-header"><div><span>Reorder Requests</span><h3>Create and review stock buying requests</h3></div><button onClick={createRequest}>Create Request</button></div>
      {notice && <div className="creditors-notice">{notice}</div>}
      <div className="creditors-form-grid">
        <label>Product<select value={productId} onChange={(event) => setProductId(event.target.value)}>{products.map((item) => <option key={item.id} value={item.id}>{item.productName || item.name}</option>)}</select></label>
        <label>Supplier<select value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>{suppliers.map((item) => <option key={item.supplierId} value={item.supplierId}>{item.supplierName}</option>)}</select></label>
        <label>Requested Qty<input value={qty} onChange={(event) => setQty(event.target.value)} /></label>
        <label>Reason<input value={reason} onChange={(event) => setReason(event.target.value)} /></label>
      </div>
      {preview && <div className="creditors-summary-grid">
        <div className="creditors-summary-card"><span>Risk Score</span><strong>{preview.totalRiskScore}</strong></div>
        <div className="creditors-summary-card"><span>Risk Level</span><strong>{preview.riskLevel}</strong></div>
        <div className="creditors-summary-card"><span>Decision</span><strong>{preview.decision}</strong></div>
        <div className="creditors-summary-card"><span>Reserve After</span><strong>{money(preview.cogsReserveAfter)}</strong></div>
      </div>}
      <div className="creditors-table-wrap"><table className="creditors-table"><thead><tr><th>Request No.</th><th>Product</th><th>Current</th><th>Qty</th><th>Supplier</th><th>Cost</th><th>Movement</th><th>Risk</th><th>Decision</th><th>Status</th><th>Action</th></tr></thead><tbody>{rows.map((row) => <tr key={row.requestId}><td>{row.requestNumber}</td><td>{row.productName}</td><td>{row.currentStockQty}</td><td>{row.requestedQty}</td><td>{row.supplierName}</td><td>{money(row.estimatedTotalCost)}</td><td>{row.stockMovementClass}</td><td>{row.riskLevel}</td><td>{row.protectionDecision}</td><td>{row.status}</td><td><select defaultValue="" onChange={async (event) => { const action = event.target.value; if (action === 'approve') await approvePurchaseDisciplineRequest(row.requestId, 'Manager', 'Approved locally.'); if (action === 'reject') await rejectPurchaseDisciplineRequest(row.requestId, 'Rejected in QA.', 'Manager'); if (action === 'convert') await convertRequestToPurchaseOrder(row.requestId); if (action === 'commit') await createCommitment(row); if (action === 'cancel') await cancelPurchaseDisciplineRequest(row.requestId, 'Cancelled in QA.', 'Manager'); event.currentTarget.value = ''; load(); }}><option value="">...</option><option value="approve">Approve</option><option value="reject">Reject</option><option value="convert">Convert to PO</option><option value="commit">Create Commitment</option><option value="cancel">Cancel</option></select></td></tr>)}</tbody></table></div>
    </section>
  );
}
