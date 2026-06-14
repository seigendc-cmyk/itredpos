import { useEffect, useState } from 'react';
import type { SupplierBill } from '../types';
import { createManualSupplierBill, disputeSupplierBill, getSupplierBills, getSupplierCreditProfiles, postSupplierBill, reverseSupplierBill } from '../services/creditorsService';

const money = (value: number) => `$${value.toFixed(2)}`;

export default function SupplierBillsPanel() {
  const [bills, setBills] = useState<SupplierBill[]>([]);
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const suppliers = getSupplierCreditProfiles();
  const firstSupplier = suppliers[0];

  const load = () => setBills(getSupplierBills({ search }));
  useEffect(load, [search]);

  const createBill = async () => {
    if (!firstSupplier) return;
    await createManualSupplierBill({
      supplierId: firstSupplier.supplierId,
      supplierName: firstSupplier.supplierName,
      supplierInvoiceNumber: `MAN-${Date.now().toString().slice(-5)}`,
      billDate: new Date().toISOString().slice(0, 10),
      dueDate: new Date(Date.now() + firstSupplier.paymentTermsDays * 86400000).toISOString().slice(0, 10),
      originalAmount: 100,
      vatAmount: 13.04,
      currency: 'USD',
      branchId: 'BR-HARARE',
      warehouseId: 'WH-HARARE-01',
      createdBy: 'Build 19AO',
      notes: 'Manual supplier bill local/mock placeholder.'
    });
    setNotice('Manual supplier bill draft created locally.');
    load();
  };

  return (
    <section className="creditors-panel">
      <div className="creditors-panel-header">
        <div><span>Supplier Bills / Invoices</span><h3>GRN-linked and manual supplier payable records</h3></div>
        <div className="creditors-toolbar"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search supplier, bill, invoice, GRN..." /><button onClick={createBill}>Create Bill</button></div>
      </div>
      {notice && <div className="creditors-notice">{notice}</div>}
      <div className="creditors-table-wrap">
        <table className="creditors-table">
          <thead><tr><th>Supplier</th><th>Bill No.</th><th>Invoice</th><th>GRN / PO</th><th>Bill Date</th><th>Due</th><th>Original</th><th>Paid</th><th>Outstanding</th><th>Ageing</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            {bills.map((bill) => (
              <tr key={bill.billId}>
                <td>{bill.supplierName}</td><td>{bill.billNumber}</td><td>{bill.supplierInvoiceNumber}</td><td>{bill.grnNumber || bill.purchaseOrderNumber || 'Manual'}</td><td>{bill.billDate}</td><td>{bill.dueDate}</td><td>{money(bill.originalAmount)}</td><td>{money(bill.paidAmount)}</td><td>{money(bill.outstandingAmount)}</td><td>{bill.ageingBucket}</td><td>{bill.status}</td>
                <td><select onChange={async (event) => { const action = event.target.value; if (action === 'post') await postSupplierBill(bill.billId); if (action === 'dispute') await disputeSupplierBill(bill.billId, 'Build 19AO dispute placeholder.', 'Manager'); if (action === 'reverse') await reverseSupplierBill(bill.billId, 'Build 19AO reversal placeholder.', 'Manager'); event.currentTarget.value = ''; setNotice(`Action ${action} completed locally for ${bill.billNumber}.`); load(); }} defaultValue=""><option value="">...</option><option value="post">Post Bill</option><option value="dispute">Dispute</option><option value="reverse">Reverse</option></select></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
