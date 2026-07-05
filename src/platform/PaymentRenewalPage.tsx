import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, Banknote, CheckCircle2, FileText, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import type { PlanCode } from '../shared/backend';
import {
  createVendorInvoice,
  listExpiringVendors,
  listPaymentRenewalPlans,
  listPaymentRenewalVendors,
  listVendorInvoices,
  listVendorPayments,
  markInvoicePaid,
  recordVendorPayment,
  renewVendorLicense,
  type ExpiringVendorRecord,
  type PaymentRenewalVendorOption,
  type VendorInvoiceRecord,
  type VendorPaymentRecord
} from './paymentRenewalService';

const defaultDueDate = () => {
  const next = new Date();
  next.setDate(next.getDate() + 7);
  return next.toISOString().slice(0, 10);
};

function navigateTo(path: string): void {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function money(amount: number, currency: string): string {
  return `${currency || 'USD'} ${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dateLabel(value?: string): string {
  if (!value) return '-';
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toLocaleString() : value;
}

function statusClass(value?: string): string {
  const status = String(value || '').toLowerCase();
  if (status === 'active' || status === 'paid' || status === 'confirmed') return 'border-emerald-300 bg-emerald-50 text-emerald-800';
  if (status === 'expired' || status === 'suspended' || status === 'rejected' || status === 'cancelled') return 'border-rose-300 bg-rose-50 text-rose-800';
  return 'border-amber-300 bg-amber-50 text-amber-800';
}

function StatusChip({ value }: { value?: string }) {
  return <span className={`inline-flex border px-2 py-1 text-[10px] font-black uppercase ${statusClass(value)}`}>{value || '-'}</span>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function textInputClass(): string {
  return 'w-full border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-950 outline-none focus:border-orange-500';
}

function ActionButton({
  children,
  onClick,
  disabled,
  tone = 'orange'
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'orange' | 'slate' | 'emerald';
}) {
  const classes = tone === 'emerald'
    ? 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-500'
    : tone === 'slate'
      ? 'border-slate-700 bg-slate-900 text-white hover:bg-slate-800'
      : 'border-orange-600 bg-orange-600 text-white hover:bg-orange-500';
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 border px-4 py-3 text-xs font-black uppercase disabled:cursor-wait disabled:opacity-60 ${classes}`}
    >
      {children}
    </button>
  );
}

export default function PaymentRenewalPage() {
  const [vendors, setVendors] = useState<PaymentRenewalVendorOption[]>([]);
  const [plans, setPlans] = useState<PlanCode[]>(['DEMO', 'STARTER', 'STANDARD', 'PRO', 'ENTERPRISE']);
  const [payments, setPayments] = useState<VendorPaymentRecord[]>([]);
  const [invoices, setInvoices] = useState<VendorInvoiceRecord[]>([]);
  const [expiringVendors, setExpiringVendors] = useState<ExpiringVendorRecord[]>([]);
  const [vendorSearch, setVendorSearch] = useState('');
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [planCode, setPlanCode] = useState<PlanCode>('STARTER');
  const [amount, setAmount] = useState('0');
  const [currency, setCurrency] = useState('USD');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [reference, setReference] = useState('');
  const [months, setMonths] = useState(1);
  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [performedBy, setPerformedBy] = useState('Console Admin');
  const [message, setMessage] = useState('Loading payment renewal workspace...');
  const [busy, setBusy] = useState(false);

  const selectedVendor = useMemo(() => vendors.find((vendor) => vendor.vendorId === selectedVendorId), [selectedVendorId, vendors]);
  const filteredVendors = useMemo(() => {
    const needle = vendorSearch.trim().toLowerCase();
    if (!needle) return vendors;
    return vendors.filter((vendor) => `${vendor.vendorName} ${vendor.vendorId} ${vendor.ownerEmail || ''}`.toLowerCase().includes(needle));
  }, [vendorSearch, vendors]);

  const load = async () => {
    setBusy(true);
    try {
      const [vendorRows, planRows, paymentRows, invoiceRows, expiringRows] = await Promise.all([
        listPaymentRenewalVendors(),
        listPaymentRenewalPlans(),
        listVendorPayments(),
        listVendorInvoices(),
        listExpiringVendors()
      ]);
      setVendors(vendorRows);
      setPlans(planRows);
      setPayments(paymentRows);
      setInvoices(invoiceRows);
      setExpiringVendors(expiringRows);
      if (!selectedVendorId && vendorRows[0]) setSelectedVendorId(vendorRows[0].vendorId);
      if (!planRows.includes(planCode) && planRows[0]) setPlanCode(planRows[0]);
      setMessage('Payment renewal workspace ready.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Payment renewal workspace failed to load.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const requireVendor = (): string => {
    if (!selectedVendorId) throw new Error('Select a vendor first.');
    return selectedVendorId;
  };

  const runAction = async (action: () => Promise<string>) => {
    setBusy(true);
    try {
      const nextMessage = await action();
      setMessage(nextMessage);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Payment renewal action failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleRecordPayment = () => void runAction(async () => {
    const payment = await recordVendorPayment(requireVendor(), Number(amount), currency, paymentMethod, reference, performedBy);
    return `Payment recorded for ${payment.vendorName}: ${money(payment.amount, payment.currency)}.`;
  });

  const handleRenewLicense = () => void runAction(async () => {
    const result = await renewVendorLicense(requireVendor(), planCode, months, performedBy);
    return `License renewed on ${result.planCode}. New expiry: ${dateLabel(result.expiresAt)}.`;
  });

  const handleCreateInvoice = () => void runAction(async () => {
    const invoice = await createVendorInvoice(requireVendor(), planCode, Number(amount), currency, dueDate, performedBy);
    return `Invoice ${invoice.invoiceId} created for ${invoice.vendorName}.`;
  });

  const handleMarkInvoicePaid = (invoice: VendorInvoiceRecord) => {
    const paymentReference = window.prompt('Payment reference for this invoice:', invoice.paymentReference || reference || invoice.invoiceId);
    if (!paymentReference) return;
    void runAction(async () => {
      await markInvoicePaid(invoice.invoiceId, paymentReference, performedBy);
      return `Invoice ${invoice.invoiceId} marked paid.`;
    });
  };

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-950">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="border border-slate-800 bg-slate-900 p-5 text-white">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-orange-300">SCI / iTred Console</p>
          <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-2xl font-black uppercase tracking-wide">Payment Renewals</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                Record vendor payments, create invoices, renew plans, and keep POS license status synchronized.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ActionButton tone="slate" onClick={() => navigateTo('/platform/firebase-readiness')}>
                <ArrowLeft className="h-4 w-4" />
                Firebase Readiness
              </ActionButton>
              <ActionButton tone="slate" onClick={() => navigateTo('/platform/pricing-plans')}>
                Pricing Plans
              </ActionButton>
              <ActionButton tone="orange" onClick={() => void load()} disabled={busy}>
                <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
                Refresh
              </ActionButton>
            </div>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-5">
          <Metric label="Vendors" value={String(vendors.length)} />
          <Metric label="Payments" value={String(payments.length)} />
          <Metric label="Invoices" value={String(invoices.length)} />
          <Metric label="Expiring" value={String(expiringVendors.length)} />
          <Metric label="Status" value={message} />
        </section>

        <section className="border border-slate-200 bg-white p-4">
          <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr_1fr_1fr]">
            <Field label="Vendor search">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input className={`${textInputClass()} pl-8`} value={vendorSearch} onChange={(event) => setVendorSearch(event.target.value)} placeholder="Search vendor name, ID, or email" />
              </div>
            </Field>
            <Field label="Vendor">
              <select className={textInputClass()} value={selectedVendorId} onChange={(event) => setSelectedVendorId(event.target.value)}>
                <option value="">Select vendor</option>
                {filteredVendors.map((vendor) => (
                  <option key={vendor.vendorId} value={vendor.vendorId}>{vendor.vendorName} - {vendor.vendorId}</option>
                ))}
              </select>
            </Field>
            <Field label="Plan">
              <select className={textInputClass()} value={planCode} onChange={(event) => setPlanCode(event.target.value as PlanCode)}>
                {plans.map((plan) => <option key={plan} value={plan}>{plan}</option>)}
              </select>
            </Field>
            <Field label="Performed by">
              <input className={textInputClass()} value={performedBy} onChange={(event) => setPerformedBy(event.target.value)} />
            </Field>
          </div>

          {selectedVendor && (
            <div className="mt-4 grid gap-2 md:grid-cols-5">
              <Metric label="Vendor" value={selectedVendor.vendorName} light />
              <Metric label="Current Plan" value={selectedVendor.planCode || '-'} light />
              <Metric label="License" value={selectedVendor.licenseStatus || '-'} light />
              <Metric label="Activation" value={selectedVendor.activationStatus || '-'} light />
              <Metric label="Expires" value={dateLabel(selectedVendor.expiresAt)} light />
            </div>
          )}

          <div className="mt-4 grid gap-3 lg:grid-cols-6">
            <Field label="Amount">
              <input className={textInputClass()} type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
            </Field>
            <Field label="Currency">
              <input className={textInputClass()} value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} />
            </Field>
            <Field label="Payment method">
              <select className={textInputClass()} value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                <option>Cash</option>
                <option>Bank Transfer</option>
                <option>Mobile Money</option>
                <option>Card</option>
                <option>Other</option>
              </select>
            </Field>
            <Field label="Payment reference">
              <input className={textInputClass()} value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Receipt, transfer, or invoice ref" />
            </Field>
            <Field label="Renew months">
              <input className={textInputClass()} type="number" min="1" value={months} onChange={(event) => setMonths(Number(event.target.value) || 1)} />
            </Field>
            <Field label="Invoice due date">
              <input className={textInputClass()} type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </Field>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <ActionButton onClick={handleRecordPayment} disabled={busy || !selectedVendorId}>
              <Banknote className="h-4 w-4" />
              Record Payment
            </ActionButton>
            <ActionButton tone="emerald" onClick={handleRenewLicense} disabled={busy || !selectedVendorId}>
              <ShieldCheck className="h-4 w-4" />
              Renew License
            </ActionButton>
            <ActionButton tone="slate" onClick={handleCreateInvoice} disabled={busy || !selectedVendorId}>
              <FileText className="h-4 w-4" />
              Create Invoice
            </ActionButton>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <Panel title="Recent Payments">
            <Table headers={['Vendor', 'Amount', 'Method', 'Reference', 'Status', 'Received']}>
              {payments.map((payment) => (
                <tr key={payment.paymentId}>
                  <Td strong>{payment.vendorName}</Td>
                  <Td>{money(payment.amount, payment.currency)}</Td>
                  <Td>{payment.paymentMethod}</Td>
                  <Td>{payment.reference}</Td>
                  <Td><StatusChip value={payment.status} /></Td>
                  <Td>{dateLabel(payment.receivedAt)}</Td>
                </tr>
              ))}
            </Table>
          </Panel>

          <Panel title="Recent Invoices">
            <Table headers={['Vendor', 'Plan', 'Amount', 'Due', 'Status', 'Action']}>
              {invoices.map((invoice) => (
                <tr key={invoice.invoiceId}>
                  <Td strong>{invoice.vendorName}</Td>
                  <Td>{invoice.planCode}</Td>
                  <Td>{money(invoice.amount, invoice.currency)}</Td>
                  <Td>{invoice.dueDate}</Td>
                  <Td><StatusChip value={invoice.status} /></Td>
                  <Td>
                    <button
                      type="button"
                      disabled={invoice.status === 'Paid' || busy}
                      onClick={() => handleMarkInvoicePaid(invoice)}
                      className="border border-emerald-600 bg-emerald-600 px-2 py-1 text-[10px] font-black uppercase text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Mark Paid
                    </button>
                  </Td>
                </tr>
              ))}
            </Table>
          </Panel>

          <Panel title="Expiring Vendors">
            <Table headers={['Vendor', 'Plan', 'License', 'Expires', 'Days']}>
              {expiringVendors.map((vendor) => (
                <tr key={vendor.vendorId}>
                  <Td strong>{vendor.vendorName}</Td>
                  <Td>{vendor.planCode || '-'}</Td>
                  <Td><StatusChip value={vendor.licenseStatus} /></Td>
                  <Td>{dateLabel(vendor.expiresAt)}</Td>
                  <Td>{vendor.daysRemaining === null ? '-' : vendor.daysRemaining}</Td>
                </tr>
              ))}
            </Table>
          </Panel>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value, light }: { label: string; value: string; light?: boolean }) {
  return (
    <div className={`border p-3 ${light ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-white'}`}>
      <span className="block text-[9px] font-black uppercase tracking-wide text-slate-500">{label}</span>
      <strong className="mt-1 block break-words text-xs text-slate-950">{value}</strong>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border border-slate-200 bg-white">
      <header className="border-b border-slate-200 bg-slate-900 p-3 text-white">
        <h2 className="text-sm font-black uppercase">{title}</h2>
      </header>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <table className="w-full border-collapse text-left text-[10px]">
      <thead className="bg-slate-50 uppercase text-slate-500">
        <tr>{headers.map((header) => <th key={header} className="border-b border-slate-200 p-2">{header}</th>)}</tr>
      </thead>
      <tbody className="divide-y divide-slate-100">{children}</tbody>
    </table>
  );
}

function Td({ children, strong }: { children: ReactNode; strong?: boolean }) {
  return <td className={`p-2 align-top ${strong ? 'font-black text-slate-950' : 'font-semibold text-slate-700'}`}>{children}</td>;
}
