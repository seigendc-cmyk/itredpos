import {
  CreditCard,
  FileText,
  Minus,
  PauseCircle,
  Plus,
  ReceiptText,
  Trash2,
  Truck,
  UserRound,
  XCircle
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { CartItem, CustomerRecord, VATMode } from '../types';

export type SalesPaymentMethod =
  | 'Cash'
  | 'EcoCash Placeholder'
  | 'Innbucks Placeholder'
  | 'Mukuru Placeholder'
  | 'ZIPIT Placeholder'
  | 'Bank Transfer'
  | 'Card Placeholder'
  | 'Credit / Account'
  | 'Mixed Payment'
  | 'Already Paid'
  | 'No Payment Due';

export type DeliveryMode =
  | 'No Delivery'
  | 'Customer Collection'
  | 'Vendor Delivery'
  | 'iDeliver Service';

export type SalesDeliveryPriority = 'Normal' | 'High' | 'Urgent';
export type SalesDeliveryPaymentMode = 'Already Paid' | 'Cash On Delivery' | 'Delivery Fee Cash' | 'No Payment Due';

export type SalesCustomerMode =
  | 'Walk-in Customer'
  | 'Existing Customer'
  | 'New Customer Request';

export interface SalesPaymentLine {
  id: string;
  method: SalesPaymentMethod;
  amount: number;
  reference?: string;
}

interface SalesCartTotals {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  deliveryFee: number;
  grandTotal: number;
  paymentReceived: number;
  changeDue: number;
  balanceDue: number;
}

interface SalesCartCardProps {
  cart: CartItem[];
  customerMode: SalesCustomerMode;
  customerName: string;
  customerPhone: string;
  customerWhatsApp: string;
  customerAddress: string;
  customerTaxNumber: string;
  customerNotes: string;
  existingCustomers?: CustomerRecord[];
  selectedCustomerId?: string;
  cashierName: string;
  terminalName: string;
  branchName: string;
  paymentMethod: SalesPaymentMethod;
  paymentAmount: string;
  paymentReference: string;
  payments: SalesPaymentLine[];
  deliveryMode: DeliveryMode;
  deliveryAddress: string;
  deliveryWhatsApp: string;
  deliveryNotes: string;
  deliveryFee: string;
  deliveryPriority: SalesDeliveryPriority;
  deliveryPaymentMode: SalesDeliveryPaymentMode;
  vatMode: VATMode;
  vatRate: string;
  totals: SalesCartTotals;
  canComplete: boolean;
  disableCompleteReason: string;
  onCustomerModeChange: (value: SalesCustomerMode) => void;
  onCustomerNameChange: (value: string) => void;
  onCustomerPhoneChange: (value: string) => void;
  onCustomerWhatsAppChange: (value: string) => void;
  onCustomerAddressChange: (value: string) => void;
  onCustomerTaxNumberChange: (value: string) => void;
  onCustomerNotesChange: (value: string) => void;
  onExistingCustomerSelect?: (customerId: string) => void;
  onSaveCustomerRequest: () => void;
  onQuantityChange: (productId: string, delta: number) => void;
  onRemoveItem: (productId: string) => void;
  onApplyLineDiscount: (productId: string) => void;
  onPaymentMethodChange: (value: SalesPaymentMethod) => void;
  onPaymentAmountChange: (value: string) => void;
  onPaymentReferenceChange: (value: string) => void;
  onAddPayment: () => void;
  onRemovePayment: (paymentId: string) => void;
  onDeliveryModeChange: (value: DeliveryMode) => void;
  onDeliveryAddressChange: (value: string) => void;
  onDeliveryWhatsAppChange: (value: string) => void;
  onDeliveryNotesChange: (value: string) => void;
  onDeliveryFeeChange: (value: string) => void;
  onDeliveryPriorityChange: (value: SalesDeliveryPriority) => void;
  onDeliveryPaymentModeChange: (value: SalesDeliveryPaymentMode) => void;
  onVatModeChange: (value: VATMode) => void;
  onVatRateChange: (value: string) => void;
  onCompleteSale: () => void;
  onHoldSale: () => void;
  onCancelSale: () => void;
}

const paymentMethods: SalesPaymentMethod[] = [
  'Cash',
  'EcoCash Placeholder',
  'Innbucks Placeholder',
  'Mukuru Placeholder',
  'ZIPIT Placeholder',
  'Bank Transfer',
  'Card Placeholder',
  'Credit / Account',
  'Mixed Payment',
  'Already Paid',
  'No Payment Due'
];

const deliveryModes: DeliveryMode[] = [
  'No Delivery',
  'Customer Collection',
  'Vendor Delivery',
  'iDeliver Service'
];

const deliveryPriorities: SalesDeliveryPriority[] = ['Normal', 'High', 'Urgent'];
const deliveryPaymentModes: SalesDeliveryPaymentMode[] = ['Already Paid', 'Cash On Delivery', 'Delivery Fee Cash', 'No Payment Due'];

const paymentLabels: Record<SalesPaymentMethod, string> = {
  Cash: 'Cash',
  'EcoCash Placeholder': 'EcoCash Placeholder',
  'Innbucks Placeholder': 'Innbucks Placeholder',
  'Mukuru Placeholder': 'Mukuru Placeholder',
  'ZIPIT Placeholder': 'ZIPIT Placeholder',
  'Bank Transfer': 'Bank Transfer',
  'Card Placeholder': 'Card Placeholder',
  'Credit / Account': 'Credit / Account',
  'Mixed Payment': 'Mixed Payment',
  'Already Paid': 'Already Paid',
  'No Payment Due': 'No Payment Due'
};

function money(value: number): string {
  return `USD ${value.toFixed(2)}`;
}

function unitPrice(item: CartItem): number {
  return item.overriddenPrice ?? item.product.sellingPrice ?? item.product.price;
}

function lineDiscountAmount(item: CartItem): number {
  return unitPrice(item) * item.quantity * (item.discount / 100);
}

function lineTotal(item: CartItem): number {
  return unitPrice(item) * item.quantity - lineDiscountAmount(item);
}

export default function SalesCartCard({
  cart,
  customerMode,
  customerName,
  customerPhone,
  customerWhatsApp,
  customerAddress,
  customerTaxNumber,
  customerNotes,
  existingCustomers = [],
  selectedCustomerId = '',
  cashierName,
  terminalName,
  branchName,
  paymentMethod,
  paymentAmount,
  paymentReference,
  payments,
  deliveryMode,
  deliveryAddress,
  deliveryWhatsApp,
  deliveryNotes,
  deliveryFee,
  deliveryPriority,
  deliveryPaymentMode,
  vatMode,
  vatRate,
  totals,
  canComplete,
  disableCompleteReason,
  onCustomerModeChange,
  onCustomerNameChange,
  onCustomerPhoneChange,
  onCustomerWhatsAppChange,
  onCustomerAddressChange,
  onCustomerTaxNumberChange,
  onCustomerNotesChange,
  onExistingCustomerSelect,
  onSaveCustomerRequest,
  onQuantityChange,
  onRemoveItem,
  onApplyLineDiscount,
  onPaymentMethodChange,
  onPaymentAmountChange,
  onPaymentReferenceChange,
  onAddPayment,
  onRemovePayment,
  onDeliveryModeChange,
  onDeliveryAddressChange,
  onDeliveryWhatsAppChange,
  onDeliveryNotesChange,
  onDeliveryFeeChange,
  onDeliveryPriorityChange,
  onDeliveryPaymentModeChange,
  onVatModeChange,
  onVatRateChange,
  onCompleteSale,
  onHoldSale,
  onCancelSale
}: SalesCartCardProps) {
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerDrawerOpen, setCustomerDrawerOpen] = useState(false);
  const [deliveryDrawerOpen, setDeliveryDrawerOpen] = useState(false);
  const filteredExistingCustomers = useMemo(() => {
    const query = customerSearch.trim().toLowerCase();
    return existingCustomers.filter((customer) => {
      if (customer.status !== 'Active') return false;
      if (!query) return true;
      return [
        customer.customerName,
        customer.customerCode,
        customer.phone,
        customer.whatsapp,
        customer.email,
        customer.taxNumber,
        customer.cityTown,
        customer.suburb
      ].join(' ').toLowerCase().includes(query);
    });
  }, [customerSearch, existingCustomers]);
  const selectedCustomer = existingCustomers.find((customer) => customer.customerId === selectedCustomerId);

  return (
    <section className="sci-pos-card pos-cart-card" aria-labelledby="cart-title">
      <div className="sci-pos-card__bar">
        <div>
          <p className="sci-pos-eyebrow">Make Sale</p>
          <h2 id="cart-title">Cart</h2>
        </div>
        <div className="pos-receipt-chip">
          <ReceiptText size={16} aria-hidden="true" />
          Draft Receipt
        </div>
      </div>

      <div className="pos-session-strip" aria-label="Sale context">
        <span>Cashier: {cashierName}</span>
        <span>Terminal: {terminalName}</span>
        <span>Branch: {branchName}</span>
      </div>

      <div className="sales-cart-summary-card">
        <div>
          <span>Customer Summary</span>
          <strong>{customerName || 'Walk-in Customer'}</strong>
          <small>{customerMode} | {customerPhone || 'No phone'} | {customerTaxNumber ? 'Tax profile captured' : 'No tax number'}</small>
        </div>
        <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => setCustomerDrawerOpen(true)}>
          <UserRound size={16} aria-hidden="true" />
          Customer Details
        </button>
      </div>

      <div className="pos-section-heading">
        <ReceiptText size={17} aria-hidden="true" />
        Cart Items
      </div>
      <div className="pos-cart-items">
        {cart.map((item) => (
          <div key={item.product.id} className="pos-cart-line">
            <div className="pos-cart-line__product">
              <strong title={item.product.productName || item.product.name}>{item.product.productName || item.product.name}</strong>
              <span>{item.product.sku || item.product.code} - Tax included</span>
            </div>
            <div className="pos-cart-line__controls">
              <div className="pos-qty-stepper">
                <button type="button" onClick={() => onQuantityChange(item.product.id, -1)} disabled={item.quantity <= 1} aria-label="Decrease quantity">
                  <Minus size={14} aria-hidden="true" />
                </button>
                <span>{item.quantity}</span>
                <button type="button" onClick={() => onQuantityChange(item.product.id, 1)} aria-label="Increase quantity">
                  <Plus size={14} aria-hidden="true" />
                </button>
              </div>
              <span className="pos-cart-line__metric">Unit {money(unitPrice(item))}</span>
              <button type="button" className="sci-pos-link-button" onClick={() => onApplyLineDiscount(item.product.id)}>
                {item.discount > 0 ? `Discount ${item.discount}%` : 'Apply Discount'}
              </button>
              <strong className="pos-cart-line__total">{money(lineTotal(item))}</strong>
              <button type="button" className="cart-icon-cta pos-cart-remove" onClick={() => onRemoveItem(item.product.id)} title="Remove item" aria-label="Remove item">
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
        ))}
        {cart.length === 0 && (
          <div className="industrial-empty-state">Cart is empty. Add products from the Product Search card.</div>
        )}
      </div>

      <div className="pos-checkout-section">
        <div className="pos-section-heading">
          <FileText size={17} aria-hidden="true" />
          Tax
        </div>
        <div className="pos-form-grid pos-tax-grid">
          <label>
            VAT Mode
            <select value={vatMode} onChange={(event) => onVatModeChange(event.target.value as VATMode)}>
              <option value="Inclusive">VAT Inclusive</option>
              <option value="Exclusive">VAT Exclusive</option>
              <option value="Not VAT Registered">Not VAT Registered</option>
            </select>
          </label>
          <label>
            VAT Rate
            <input type="number" min="0" value={vatRate} onChange={(event) => onVatRateChange(event.target.value)} />
          </label>
          <div className="pos-tax-status">
            <span>VAT Amount</span>
            <strong>{money(totals.taxTotal)}</strong>
          </div>
          <div className="pos-tax-status">
            <span>VAT Registered Status</span>
            <strong>{vatMode === 'Not VAT Registered' ? 'VAT not charged.' : 'VAT Registered'}</strong>
          </div>
        </div>
      </div>

      <div className="sales-cart-summary-card">
        <div>
          <span>Delivery Summary</span>
          <strong>{deliveryMode}</strong>
          <small>{deliveryPriority} | Fee {money(Number(deliveryFee) || 0)} | {deliveryPaymentMode}</small>
        </div>
        <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => setDeliveryDrawerOpen(true)}>
          <Truck size={16} aria-hidden="true" />
          Delivery / iDeliver
        </button>
      </div>

      <div className="pos-checkout-section">
        <div className="pos-section-heading">
          <CreditCard size={17} aria-hidden="true" />
          Payment
        </div>
        <div className="pos-form-grid pos-payment-grid">
          <label>
            Payment Method
            <select value={paymentMethod} onChange={(event) => onPaymentMethodChange(event.target.value as SalesPaymentMethod)}>
              {paymentMethods.map((method) => <option key={method} value={method}>{paymentLabels[method]}</option>)}
            </select>
          </label>
          <label>
            Payment Amount
            <input type="number" min="0" value={paymentAmount} onChange={(event) => onPaymentAmountChange(event.target.value)} />
          </label>
          <label className="pos-form-grid__wide">
            Payment Notes
            <input value={paymentReference} onChange={(event) => onPaymentReferenceChange(event.target.value)} placeholder="Add payment reference, mobile money confirmation, bank note, or cashier note..." />
          </label>
          <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={onAddPayment}>
            <Plus size={16} aria-hidden="true" />
            Add Payment
          </button>
        </div>
        <div className="pos-payment-lines">
          {payments.length === 0 ? (
            <span>No payment captured.</span>
          ) : payments.map((payment) => (
            <div key={payment.id} className="pos-payment-line">
              <span>{payment.method}</span>
              <strong>{money(payment.amount)}</strong>
              <small>{payment.reference || 'No reference'}</small>
              <button type="button" onClick={() => onRemovePayment(payment.id)} aria-label="Remove payment">
                <XCircle size={15} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="pos-section-heading">
        <FileText size={17} aria-hidden="true" />
        Cart Summary
      </div>
      <div className="pos-summary-box" aria-label="Cart Summary">
        <div><span>Subtotal</span><strong>{money(totals.subtotal)}</strong></div>
        <div><span>Discount Total</span><strong>{money(totals.discountTotal)}</strong></div>
        <div><span>VAT</span><strong>{vatMode === 'Not VAT Registered' ? 'VAT not charged.' : money(totals.taxTotal)}</strong></div>
        <div><span>Delivery Fee</span><strong>{money(totals.deliveryFee)}</strong></div>
        <div className="pos-summary-box__grand"><span>Grand Total</span><strong>{money(totals.grandTotal)}</strong></div>
        <div><span>Total Paid</span><strong>{money(totals.paymentReceived)}</strong></div>
        <div><span>Balance Due</span><strong>{money(totals.balanceDue)}</strong></div>
        <div><span>Change Due</span><strong>{money(totals.changeDue)}</strong></div>
      </div>

      <div className="pos-cart-actions">
        <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={onCompleteSale} disabled={!canComplete} title={disableCompleteReason}>
          <CreditCard size={17} aria-hidden="true" />
          Complete Sale
        </button>
        <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={onHoldSale} disabled={cart.length === 0}>
          <PauseCircle size={17} aria-hidden="true" />
          Hold Sale
        </button>
        <button type="button" className="sci-pos-button sci-pos-button--danger" onClick={onCancelSale} disabled={cart.length === 0}>
          <XCircle size={17} aria-hidden="true" />
          Cancel Sale
        </button>
      </div>
      {customerDrawerOpen && (
        <div className="sales-drawer-backdrop" onClick={() => setCustomerDrawerOpen(false)}>
          <aside className="sales-drawer" onClick={(event) => event.stopPropagation()} aria-label="Customer Details">
            <div className="sales-drawer-header">
              <div><p className="sci-pos-eyebrow">Customer</p><h3>Customer Details</h3></div>
              <button type="button" className="sci-pos-icon-button" onClick={() => setCustomerDrawerOpen(false)} aria-label="Close customer details"><XCircle size={16} aria-hidden="true" /></button>
            </div>
            <div className="sales-drawer-body">
              <section className="sales-drawer-section">
                <label>Customer Type<select value={customerMode} onChange={(event) => onCustomerModeChange(event.target.value as SalesCustomerMode)}><option value="Walk-in Customer">Walk-in Customer</option><option value="Existing Customer">Existing Customer</option><option value="New Customer Request">New Customer Request</option></select></label>
                {customerMode === 'Existing Customer' && (
                  <>
                    <label>Existing Customer Lookup Placeholder<input value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Search name, phone, WhatsApp, tax no." /></label>
                    <label>Existing Customer<select value={selectedCustomerId} onChange={(event) => onExistingCustomerSelect?.(event.target.value)}><option value="">Select active customer</option>{filteredExistingCustomers.map((customer) => <option key={customer.customerId} value={customer.customerId}>{customer.customerName} - {customer.customerCode}</option>)}</select></label>
                    {selectedCustomer && <div className="pos-placeholder-card"><strong>{selectedCustomer.customerName}</strong><span>Tax: {selectedCustomer.taxNumber || 'No tax number'} | Credit: {selectedCustomer.creditStatus}</span><span>Billing: {selectedCustomer.billingAddress || 'No billing address'}</span><span>Delivery: {selectedCustomer.deliveryAddress || 'No delivery address'}</span></div>}
                  </>
                )}
                <label>Customer Name<input value={customerName} onChange={(event) => onCustomerNameChange(event.target.value)} placeholder="Walk-in Customer" /></label>
                <label>Phone<input value={customerPhone} onChange={(event) => onCustomerPhoneChange(event.target.value)} placeholder="+263" /></label>
                <label>WhatsApp<input value={customerWhatsApp} onChange={(event) => onCustomerWhatsAppChange(event.target.value)} placeholder="+263" /></label>
                <label>Address<input value={customerAddress} onChange={(event) => onCustomerAddressChange(event.target.value)} placeholder="Customer address placeholder" /></label>
                <label>Tax Number<input value={customerTaxNumber} onChange={(event) => onCustomerTaxNumberChange(event.target.value)} placeholder="Tax number placeholder" /></label>
                <label>Customer Notes<textarea value={customerNotes} onChange={(event) => onCustomerNotesChange(event.target.value)} placeholder="Customer notes" rows={3} /></label>
                <div className="pos-placeholder-card">New Customer Request Placeholder remains local until saved.</div>
              </section>
            </div>
            <div className="sales-drawer-actions">
              <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={() => setCustomerDrawerOpen(false)}>Save Customer Details</button>
              <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={onSaveCustomerRequest}>New Customer Request Placeholder</button>
              <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => { onCustomerModeChange('Walk-in Customer'); setCustomerDrawerOpen(false); }}>Clear Customer</button>
              <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => setCustomerDrawerOpen(false)}>Close</button>
            </div>
          </aside>
        </div>
      )}
      {deliveryDrawerOpen && (
        <div className="sales-drawer-backdrop" onClick={() => setDeliveryDrawerOpen(false)}>
          <aside className="sales-drawer" onClick={(event) => event.stopPropagation()} aria-label="Delivery / iDeliver Details">
            <div className="sales-drawer-header">
              <div><p className="sci-pos-eyebrow">Delivery</p><h3>Delivery / iDeliver Details</h3></div>
              <button type="button" className="sci-pos-icon-button" onClick={() => setDeliveryDrawerOpen(false)} aria-label="Close delivery details"><XCircle size={16} aria-hidden="true" /></button>
            </div>
            <div className="sales-drawer-body">
              <section className="sales-drawer-section">
                <label>Delivery Method<select value={deliveryMode} onChange={(event) => onDeliveryModeChange(event.target.value as DeliveryMode)}>{deliveryModes.map((mode) => <option key={mode} value={mode}>{mode}</option>)}</select></label>
                <label>Delivery Fee<input type="number" min="0" value={deliveryFee} onChange={(event) => onDeliveryFeeChange(event.target.value)} /></label>
                <label>Priority<select value={deliveryPriority} onChange={(event) => onDeliveryPriorityChange(event.target.value as SalesDeliveryPriority)}>{deliveryPriorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select></label>
                <label>Payment Mode<select value={deliveryPaymentMode} onChange={(event) => onDeliveryPaymentModeChange(event.target.value as SalesDeliveryPaymentMode)}>{deliveryPaymentModes.map((mode) => <option key={mode} value={mode}>{mode}</option>)}</select></label>
                <label>Delivery Address<input value={deliveryAddress} onChange={(event) => onDeliveryAddressChange(event.target.value)} placeholder="Delivery address" /></label>
                <label>WhatsApp<input value={deliveryWhatsApp} onChange={(event) => onDeliveryWhatsAppChange(event.target.value)} placeholder="+263" /></label>
                <label>Delivery Notes<textarea value={deliveryNotes} onChange={(event) => onDeliveryNotesChange(event.target.value)} placeholder="Delivery notes" rows={3} /></label>
                <div className="pos-placeholder-card">iDeliver Broadcast Placeholder and Fulfilment Code Placeholder stay local until sale completion.</div>
              </section>
            </div>
            <div className="sales-drawer-actions">
              <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={() => setDeliveryDrawerOpen(false)}>Save Delivery Details</button>
              <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => setDeliveryDrawerOpen(false)}>Prepare iDeliver Request Placeholder</button>
              <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => { onDeliveryModeChange('No Delivery'); onDeliveryFeeChange('0'); onDeliveryAddressChange(''); onDeliveryWhatsAppChange(''); onDeliveryNotesChange(''); setDeliveryDrawerOpen(false); }}>Clear Delivery</button>
              <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => setDeliveryDrawerOpen(false)}>Close</button>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}
