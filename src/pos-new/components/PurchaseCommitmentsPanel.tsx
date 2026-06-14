import { useEffect, useState } from 'react';
import { getCOGSReserveSummary } from '../services/cogsReserveService';
import { getSupplierBills } from '../services/creditorsService';
import { getGoodsReceivingNotes } from '../services/goodsReceivingService';
import type { GoodsReceivingNote } from '../types';

const money = (value: number) => `$${value.toFixed(2)}`;

export default function PurchaseCommitmentsPanel() {
  const [invoicePendingGrns, setInvoicePendingGrns] = useState<GoodsReceivingNote[]>([]);
  const reserve = getCOGSReserveSummary();
  const bills = getSupplierBills();
  useEffect(() => {
    void getGoodsReceivingNotes().then((notes) => {
      const billedGrnIds = new Set(bills.map((bill) => bill.grnId).filter(Boolean));
      setInvoicePendingGrns(notes.filter((note) => (note.receivingStatus === 'Posted' || note.receivingStatus === 'Partially Posted') && !note.supplierInvoiceNumber.trim() && !billedGrnIds.has(note.grnId)));
    });
  }, [bills.length]);

  const commitments = bills.filter((bill) => bill.outstandingAmount > 0).map((bill) => ({
    type: bill.grnNumber ? 'Posted GRN unpaid' : 'Supplier Bill',
    supplier: bill.supplierName,
    reference: bill.grnNumber || bill.billNumber,
    dueDate: bill.dueDate,
    amount: bill.outstandingAmount,
    reserveNeeded: bill.outstandingAmount,
    reserveAvailable: reserve.currentReserveBalance,
    risk: bill.outstandingAmount > reserve.currentReserveBalance ? 'High' : bill.overdueDays > 0 ? 'Medium' : 'Low'
  })).concat(invoicePendingGrns.map((note) => ({
    type: 'Invoice Pending GRN',
    supplier: note.supplierName,
    reference: note.grnNumber,
    dueDate: note.receivedDate,
    amount: note.supplierInvoiceAmount || 0,
    reserveNeeded: note.supplierInvoiceAmount || 0,
    reserveAvailable: reserve.currentReserveBalance,
    risk: 'Medium'
  })));

  return (
    <section className="creditors-panel">
      <div className="creditors-panel-header"><div><span>Purchase Commitments</span><h3>Future supplier and replacement-stock reserve needs</h3></div></div>
      <div className="creditors-table-wrap">
        <table className="creditors-table"><thead><tr><th>Commitment Type</th><th>Supplier</th><th>Reference</th><th>Due Date</th><th>Amount</th><th>Reserve Needed</th><th>Reserve Available</th><th>Risk</th><th>Action</th></tr></thead><tbody>{commitments.map((item) => <tr key={`${item.reference}-${item.supplier}`}><td>{item.type}</td><td>{item.supplier}</td><td>{item.reference}</td><td>{item.dueDate}</td><td>{money(item.amount)}</td><td>{money(item.reserveNeeded)}</td><td>{money(item.reserveAvailable)}</td><td>{item.risk}</td><td><button>Review</button></td></tr>)}</tbody></table>
      </div>
    </section>
  );
}
