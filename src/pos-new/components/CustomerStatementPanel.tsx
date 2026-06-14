import { FileDown, MessageCircle, Printer } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { CustomerRecord } from '../types';
import {
  generateCustomerStatement,
  prepareDebtReminderWhatsAppMessage,
  type CustomerStatementPayload
} from '../services/customerCreditService';
import CustomerStatementDocument from './CustomerStatementDocument';

interface CustomerStatementPanelProps {
  customers: CustomerRecord[];
  selectedCustomerId: string;
  generatedBy: string;
  canPrint: boolean;
  canWhatsApp: boolean;
  onNotice: (message: string) => void;
}

function csvValue(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export default function CustomerStatementPanel({
  customers,
  selectedCustomerId,
  generatedBy,
  canPrint,
  canWhatsApp,
  onNotice
}: CustomerStatementPanelProps) {
  const [customerId, setCustomerId] = useState(selectedCustomerId);
  const [dateFrom, setDateFrom] = useState(new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [includePaidDebts, setIncludePaidDebts] = useState(true);
  const [includeOpenDebts, setIncludeOpenDebts] = useState(true);
  const [includeCreditNotes, setIncludeCreditNotes] = useState(true);
  const [includeReturns, setIncludeReturns] = useState(true);
  const [includePayments, setIncludePayments] = useState(true);
  const [statementType, setStatementType] = useState<'Summary' | 'Detailed'>('Detailed');
  const [statement, setStatement] = useState<CustomerStatementPayload | null>(null);

  const selectedCustomer = useMemo(() => customers.find((customer) => customer.customerId === customerId) || null, [customerId, customers]);

  const generate = async () => {
    if (!customerId) {
      onNotice('Select a customer before generating a statement.');
      return;
    }
    const next = await generateCustomerStatement({ customerId, dateFrom, dateTo, includePaidDebts, includeOpenDebts, includePayments, statementType, generatedBy });
    setStatement(next);
    onNotice('Customer statement generated locally.');
  };

  const print = () => {
    if (!statement) {
      onNotice('Generate a statement before printing.');
      return;
    }
    window.setTimeout(() => window.print(), 80);
  };

  const sendWhatsApp = () => {
    if (!statement || !selectedCustomer) {
      onNotice('Generate a statement before preparing WhatsApp.');
      return;
    }
    const phone = selectedCustomer.whatsapp || selectedCustomer.phone || window.prompt('WhatsApp phone number', '') || '';
    const normalized = phone.replace(/[^\d]/g, '');
    if (!normalized) {
      onNotice('WhatsApp reminder cancelled. No phone number was provided.');
      return;
    }
    const message = prepareDebtReminderWhatsAppMessage(selectedCustomer, statement.debts, 'Statement Summary');
    window.open(`https://wa.me/${normalized}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
    onNotice('Statement WhatsApp link prepared locally.');
  };

  const exportCsv = () => {
    if (!statement) {
      onNotice('Generate a statement before exporting.');
      return;
    }
    const rows = [
      ['Date', 'Type', 'Reference', 'Debit', 'Credit', 'Balance', 'Staff', 'Notes'],
      ...statement.ledger.map((row) => [row.date, row.type, row.reference, row.debit, row.credit, row.balance, row.staff, row.notes])
    ];
    const blob = new Blob([rows.map((row) => row.map(csvValue).join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${statement.customer?.customerCode || 'customer'}-statement.csv`;
    link.click();
    URL.revokeObjectURL(url);
    onNotice('Statement CSV exported locally.');
  };

  return (
    <section className="sci-pos-card pos-statement-panel">
      <div className="sci-pos-card__bar"><div><p className="sci-pos-eyebrow">Customer Statements</p><h2>Statement Generator</h2></div><span>{statement?.statementType || 'Not generated'}</span></div>
      <div className="pos-credit-config-grid">
        <label>Customer<select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>{customers.map((customer) => <option key={customer.customerId} value={customer.customerId}>{customer.customerName}</option>)}</select></label>
        <label>Date From<input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
        <label>Date To<input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
        <label>Statement Type<select value={statementType} onChange={(event) => setStatementType(event.target.value as 'Summary' | 'Detailed')}><option>Summary</option><option>Detailed</option></select></label>
        <label className="pos-credit-checkbox"><input type="checkbox" checked={includePaidDebts} onChange={(event) => setIncludePaidDebts(event.target.checked)} /> Include Paid Debts</label>
        <label className="pos-credit-checkbox"><input type="checkbox" checked={includeOpenDebts} onChange={(event) => setIncludeOpenDebts(event.target.checked)} /> Include Open Debts</label>
        <label className="pos-credit-checkbox"><input type="checkbox" checked={includeCreditNotes} onChange={(event) => setIncludeCreditNotes(event.target.checked)} /> Include Credit Notes</label>
        <label className="pos-credit-checkbox"><input type="checkbox" checked={includeReturns} onChange={(event) => setIncludeReturns(event.target.checked)} /> Include Returns</label>
        <label className="pos-credit-checkbox"><input type="checkbox" checked={includePayments} onChange={(event) => setIncludePayments(event.target.checked)} /> Include Payments</label>
      </div>
      <div className="pos-new-customer-modal__actions">
        <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={() => void generate()}>Generate Statement</button>
        <button type="button" className="sci-pos-button sci-pos-button--secondary" disabled={!canPrint} onClick={print}><Printer size={15} />Print Statement</button>
        <button type="button" className="sci-pos-button sci-pos-button--secondary" disabled={!canPrint} onClick={print}><FileDown size={15} />Save as PDF</button>
        <button type="button" className="sci-pos-button sci-pos-button--secondary" disabled={!canWhatsApp} onClick={sendWhatsApp}><MessageCircle size={15} />Send via WhatsApp</button>
        <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={exportCsv}>Export CSV</button>
      </div>
      <CustomerStatementDocument statement={statement} />
    </section>
  );
}
