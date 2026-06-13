import { useEffect, useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import type { CustomerCreditStatus, CustomerRecord, CustomerSource, CustomerType } from '../types';
import type { CustomerCreatePayload } from '../services/customerService';
import { validateCustomerPayload } from '../services/customerService';

interface NewCustomerModalProps {
  open: boolean;
  initialCustomer?: CustomerRecord | null;
  canSaveAndUse?: boolean;
  onClose: () => void;
  onSubmit: (payload: CustomerCreatePayload, useInSale: boolean) => Promise<void>;
}

const customerTypeOptions: Array<{ label: string; value: CustomerType }> = [
  { label: 'Individual', value: 'Individual' },
  { label: 'Company', value: 'Business' },
  { label: 'Walk-in converted', value: 'Walk-in' },
  { label: 'Government / Institution', value: 'Government' },
  { label: 'School / Organisation', value: 'School' },
  { label: 'Fleet Customer', value: 'Fleet Customer' },
  { label: 'Dealer', value: 'Dealer' }
];

const sourceOptions: Array<{ label: string; value: CustomerSource }> = [
  { label: 'POS', value: 'Sales Terminal' },
  { label: 'WhatsApp', value: 'WhatsApp Catalogue' },
  { label: 'Referral', value: 'Referral' },
  { label: 'Online Catalogue', value: 'Commerce Access Hub' },
  { label: 'Delivery', value: 'Other' },
  { label: 'Field Agent', value: 'Other' },
  { label: 'Other', value: 'Other' }
];

const creditOptions: CustomerCreditStatus[] = ['Cash Only', 'Credit Allowed', 'Credit Review Required', 'Credit Suspended', 'Not Applicable'];

const emptyPayload: CustomerCreatePayload = {
  customerName: '',
  customerType: 'Individual',
  phone: '',
  whatsapp: '',
  email: '',
  taxNumber: '',
  billingAddress: '',
  deliveryAddress: '',
  cityTown: '',
  district: '',
  suburb: '',
  source: 'Sales Terminal',
  creditStatus: 'Cash Only',
  creditLimit: 0,
  notes: ''
};

function customerToPayload(customer?: CustomerRecord | null): CustomerCreatePayload {
  if (!customer) return emptyPayload;
  return {
    customerName: customer.customerName,
    customerType: customer.customerType,
    phone: customer.phone,
    whatsapp: customer.whatsapp,
    email: customer.email,
    taxNumber: customer.taxNumber,
    billingAddress: customer.billingAddress,
    deliveryAddress: customer.deliveryAddress,
    cityTown: customer.cityTown,
    district: customer.district,
    suburb: customer.suburb,
    source: customer.source,
    creditStatus: customer.creditStatus,
    creditLimit: customer.creditLimit || 0,
    currentBalance: customer.currentBalance || 0,
    notes: customer.notes
  };
}

export default function NewCustomerModal({ open, initialCustomer, canSaveAndUse = false, onClose, onSubmit }: NewCustomerModalProps) {
  const [form, setForm] = useState<CustomerCreatePayload>(emptyPayload);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const isEdit = Boolean(initialCustomer);

  useEffect(() => {
    if (!open) return;
    setForm(customerToPayload(initialCustomer));
    setErrors([]);
    setBusy(false);
  }, [initialCustomer, open]);

  const title = useMemo(() => isEdit ? 'Edit Customer' : 'New Customer', [isEdit]);

  if (!open) return null;

  const setField = <K extends keyof CustomerCreatePayload>(key: K, value: CustomerCreatePayload[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (useInSale: boolean) => {
    const nextErrors = validateCustomerPayload(form);
    setErrors(nextErrors);
    if (nextErrors.length) return;
    setBusy(true);
    try {
      await onSubmit(form, useInSale);
      onClose();
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Customer could not be saved.']);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pos-modal-backdrop" role="presentation">
      <section className="pos-new-customer-modal" role="dialog" aria-modal="true" aria-labelledby="new-customer-title">
        <div className="pos-new-customer-modal__header">
          <div>
            <p className="sci-pos-eyebrow">Customer Centre</p>
            <h2 id="new-customer-title">{title}</h2>
          </div>
          <button type="button" className="sci-pos-icon-button" aria-label="Close new customer modal" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {errors.length > 0 && (
          <div className="sci-pos-alert sci-pos-alert--danger" role="alert">
            {errors.map((error) => <div key={error}>{error}</div>)}
          </div>
        )}

        <div className="pos-new-customer-grid">
          <label>Customer Name<input value={form.customerName} onChange={(event) => setField('customerName', event.target.value)} /></label>
          <label>Customer Type<select value={form.customerType} onChange={(event) => setField('customerType', event.target.value as CustomerType)}>{customerTypeOptions.map((option) => <option key={option.label} value={option.value}>{option.label}</option>)}</select></label>
          <label>Phone<input value={form.phone || ''} onChange={(event) => setField('phone', event.target.value)} /></label>
          <label>WhatsApp<input value={form.whatsapp || ''} onChange={(event) => setField('whatsapp', event.target.value)} /></label>
          <label>Email<input type="email" value={form.email || ''} onChange={(event) => setField('email', event.target.value)} /></label>
          <label>Tax Number<input value={form.taxNumber || ''} onChange={(event) => setField('taxNumber', event.target.value)} /></label>
          <label>Billing Address<input value={form.billingAddress || ''} onChange={(event) => setField('billingAddress', event.target.value)} /></label>
          <label>Delivery Address<input value={form.deliveryAddress || ''} onChange={(event) => setField('deliveryAddress', event.target.value)} /></label>
          <label>City / Town<input value={form.cityTown || ''} onChange={(event) => setField('cityTown', event.target.value)} /></label>
          <label>District<input value={form.district || ''} onChange={(event) => setField('district', event.target.value)} /></label>
          <label>Suburb<input value={form.suburb || ''} onChange={(event) => setField('suburb', event.target.value)} /></label>
          <label>Source<select value={form.source} onChange={(event) => setField('source', event.target.value as CustomerSource)}>{sourceOptions.map((option) => <option key={`${option.label}-${option.value}`} value={option.value}>{option.label}</option>)}</select></label>
          <label>Credit Status<select value={form.creditStatus} onChange={(event) => setField('creditStatus', event.target.value as CustomerCreditStatus)}>{creditOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
          <label>Credit Limit<input type="number" min="0" value={form.creditLimit || 0} onChange={(event) => setField('creditLimit', Number(event.target.value))} /></label>
          <label className="pos-new-customer-grid__wide">Notes<textarea rows={3} value={form.notes || ''} onChange={(event) => setField('notes', event.target.value)} /></label>
        </div>

        <div className="pos-new-customer-modal__actions">
          <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={onClose}>Cancel</button>
          {canSaveAndUse && !isEdit && (
            <button type="button" className="sci-pos-button sci-pos-button--secondary" disabled={busy} onClick={() => void submit(true)}>
              <Check size={15} />Save and Use in Sale
            </button>
          )}
          <button type="button" className="sci-pos-button sci-pos-button--primary" disabled={busy} onClick={() => void submit(false)}>
            <Check size={15} />{isEdit ? 'Save Changes' : 'Save Customer'}
          </button>
        </div>
      </section>
    </div>
  );
}
