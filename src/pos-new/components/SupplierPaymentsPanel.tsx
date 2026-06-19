import { useEffect, useMemo, useState } from 'react';
import type { SupplierPayment, SupplierPaymentAllocationMethod } from '../types';
import { createSupplierPayment, getSupplierCreditProfiles, getSupplierPayments, markSupplierPaymentPaid, previewSupplierPaymentAllocation } from '../services/creditorsService';
import { previewSupplierPaymentReserveImpact } from '../services/cogsReserveService';

const money = (value: number) => `$${value.toFixed(2)}`;

export default function SupplierPaymentsPanel() {
  const suppliers = getSupplierCreditProfiles();
  const [supplierId, setSupplierId] = useState(suppliers[0]?.supplierId || '');
  const [amount, setAmount] = useState('100');
  const [source, setSource] = useState<SupplierPayment['source']>('COGSReserve');
  const [allocationMethod, setAllocationMethod] = useState<SupplierPaymentAllocationMethod>('OldestBillFirst');
  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const [notice, setNotice] = useState('');
  const supplier = suppliers.find((item) => item.supplierId === supplierId) || suppliers[0];
  const numericAmount = Math.max(0, Number(amount) || 0);
  const impact = previewSupplierPaymentReserveImpact(source === 'COGSReserve' ? numericAmount : 0);
  const allocation = useMemo(() => supplier ? previewSupplierPaymentAllocation(supplier.supplierId, numericAmount, allocationMethod) : [], [supplier, numericAmount, allocationMethod]);

  const load = () => setPayments(getSupplierPayments({ supplierId }));
  useEffect(load, [supplierId]);

  const createPayment = async () => {
    if (!supplier || numericAmount <= 0) {
      setNotice('Enter a supplier and payment amount above zero.');
      return;
    }
    const payment = await createSupplierPayment({
      supplierId: supplier.supplierId,
      supplierName: supplier.supplierName,
      paymentDate: new Date().toISOString().slice(0, 10),
      amount: numericAmount,
      paymentMethod: source === 'CashDrawer' ? 'Cash' : source === 'BankPlaceholder' ? 'Bank Transfer Preview' : 'COGS Reserve',
      paymentReference: `SUP-PAY-${Date.now().toString().slice(-5)}`,
      source,
      cogsReserveAmount: source === 'COGSReserve' ? numericAmount : 0,
      nonReserveAmount: source === 'COGSReserve' ? 0 : numericAmount,
      approvedBy: 'Manager',
      paidBy: 'Accountant',
      notes: `${allocationMethod} local/mock supplier payment.`
    });
    await markSupplierPaymentPaid(payment.paymentId, 'Accountant');
    setNotice(`${payment.paymentNumber} created, paid and allocated locally.`);
    load();
  };

  return (
    <section className="creditors-panel">
      <div className="creditors-panel-header"><div><span>Supplier Payments</span><h3>Payment capture, reserve impact and bill allocation</h3></div></div>
      {notice && <div className="creditors-notice">{notice}</div>}
      <div className="creditors-form-grid">
        <label>Supplier<select value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>{suppliers.map((item) => <option key={item.supplierId} value={item.supplierId}>{item.supplierName}</option>)}</select></label>
        <label>Payment Amount<input value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
        <label>Source<select value={source} onChange={(event) => setSource(event.target.value as SupplierPayment['source'])}><option value="COGSReserve">COGS Reserve</option><option value="CashDrawer">Cash Drawer</option><option value="BankPlaceholder">Bank Preview</option><option value="MobileMoneyPlaceholder">Mobile Money Preview</option><option value="OwnerFundsPlaceholder">Owner Funds Preview</option><option value="Mixed">Mixed</option></select></label>
        <label>Allocation<select value={allocationMethod} onChange={(event) => setAllocationMethod(event.target.value as SupplierPaymentAllocationMethod)}><option value="OldestBillFirst">Oldest Bill First</option><option value="SelectedBillOnly">Selected Bill Only</option><option value="HighestOverdueFirst">Highest Overdue First</option><option value="ManualAllocation">Manual Allocation</option></select></label>
      </div>
      <div className="creditors-summary-grid">
        <div className="creditors-summary-card"><span>Supplier Outstanding Before</span><strong>{money(supplier?.currentPayableBalance || 0)}</strong></div>
        <div className="creditors-summary-card"><span>Outstanding After</span><strong>{money(Math.max(0, (supplier?.currentPayableBalance || 0) - numericAmount))}</strong></div>
        <div className="creditors-summary-card"><span>Reserve Before</span><strong>{money(impact.before)}</strong></div>
        <div className="creditors-summary-card"><span>Reserve After</span><strong>{money(impact.after)}</strong></div>
        <div className="creditors-summary-card"><span>Reserve Status After</span><strong>{impact.statusAfter}</strong></div>
      </div>
      <button className="creditors-primary" onClick={createPayment}>Create And Pay Supplier</button>
      <div className="creditors-table-wrap">
        <table className="creditors-table"><thead><tr><th>Bill</th><th>Outstanding Before</th><th>Allocated</th><th>Outstanding After</th></tr></thead><tbody>{allocation.map((row) => <tr key={row.billId}><td>{row.billNumber}</td><td>{money(row.outstandingBefore)}</td><td>{money(row.allocatedAmount)}</td><td>{money(row.outstandingAfter)}</td></tr>)}</tbody></table>
      </div>
      <div className="creditors-table-wrap">
        <table className="creditors-table"><thead><tr><th>Date</th><th>Payment</th><th>Supplier</th><th>Amount</th><th>Source</th><th>Status</th></tr></thead><tbody>{payments.map((payment) => <tr key={payment.paymentId}><td>{payment.paymentDate}</td><td>{payment.paymentNumber}</td><td>{payment.supplierName}</td><td>{money(payment.amount)}</td><td>{payment.source}</td><td>{payment.status}</td></tr>)}</tbody></table>
      </div>
    </section>
  );
}
