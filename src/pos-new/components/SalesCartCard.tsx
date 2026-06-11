import React from 'react';
import {
  CreditCard,
  FileText,
  Minus,
  PauseCircle,
  Plus,
  ReceiptText,
  Trash2,
  Truck,
  XCircle
} from 'lucide-react';
import { CartItem, VATMode } from '../types';

export type SalesPaymentMethod =
  | 'Cash'
  | 'EcoCash'
  | 'Swipe'
  | 'Bank Transfer'
  | 'Split Payment'
  | 'Credit Sale Placeholder'
  | 'Store Credit Placeholder';

export type DeliveryMode =
  | 'No Delivery'
  | 'Customer Collection'
  | 'Vendor Delivery'
  | 'iDeliver Service Placeholder';

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
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerTaxNumber: string;
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
  vatMode: VATMode;
  vatRate: string;
  totals: SalesCartTotals;
  canComplete: boolean;
  disableCompleteReason: string;
  onCustomerNameChange: (value: string) => void;
  onCustomerPhoneChange: (value: string) => void;
  onCustomerAddressChange: (value: string) => void;
  onCustomerTaxNumberChange: (value: string) => void;
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
  onVatModeChange: (value: VATMode) => void;
  onVatRateChange: (value: string) => void;
  onCompleteSale: () => void;
  onHoldSale: () => void;
  onCancelSale: () => void;
}

const paymentMethods: SalesPaymentMethod[] = [
  'Cash',
  'EcoCash',
  'Swipe',
  'Bank Transfer',
  'Split Payment',
  'Credit Sale Placeholder',
  'Store Credit Placeholder'
];

const deliveryModes: DeliveryMode[] = [
  'No Delivery',
  'Customer Collection',
  'Vendor Delivery',
  'iDeliver Service Placeholder'
];

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
  customerName,
  customerPhone,
  customerAddress,
  customerTaxNumber,
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
  vatMode,
  vatRate,
  totals,
  canComplete,
  disableCompleteReason,
  onCustomerNameChange,
  onCustomerPhoneChange,
  onCustomerAddressChange,
  onCustomerTaxNumberChange,
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
  onVatModeChange,
  onVatRateChange,
  onCompleteSale,
  onHoldSale,
  onCancelSale
}: SalesCartCardProps) {
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

      <div className="pos-form-grid pos-customer-grid">
        <label>
          Customer
          <select value={customerName} onChange={(event) => onCustomerNameChange(event.target.value)}>
            <option value="Walk-in Customer">Walk-in Customer</option>
            <option value="Existing Customer">Existing Customer</option>
            <option value="New Customer Request">New Customer Request</option>
          </select>
        </label>
        <label>
          Phone
          <input value={customerPhone} onChange={(event) => onCustomerPhoneChange(event.target.value)} placeholder="+263" />
        </label>
        <label>
          Address
          <input value={customerAddress} onChange={(event) => onCustomerAddressChange(event.target.value)} placeholder="Customer address placeholder" />
        </label>
        <label>
          Tax Number
          <input value={customerTaxNumber} onChange={(event) => onCustomerTaxNumberChange(event.target.value)} placeholder="Tax number placeholder" />
        </label>
      </div>

      <div className="sci-pos-table-wrap pos-cart-items">
        <table className="sci-pos-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Qty</th>
              <th>Unit Price</th>
              <th>Discount</th>
              <th>Tax</th>
              <th>Line Total</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {cart.map((item) => (
              <tr key={item.product.id}>
                <td className="sci-pos-table__strong">{item.product.productName || item.product.name}</td>
                <td>
                  <div className="pos-qty-stepper">
                    <button type="button" onClick={() => onQuantityChange(item.product.id, -1)} aria-label="Decrease quantity">
                      <Minus size={14} aria-hidden="true" />
                    </button>
                    <span>{item.quantity}</span>
                    <button type="button" onClick={() => onQuantityChange(item.product.id, 1)} aria-label="Increase quantity">
                      <Plus size={14} aria-hidden="true" />
                    </button>
                  </div>
                </td>
                <td>{money(unitPrice(item))}</td>
                <td>
                  <button type="button" className="sci-pos-link-button" onClick={() => onApplyLineDiscount(item.product.id)}>
                    {item.discount > 0 ? `${item.discount}%` : 'Apply'}
                  </button>
                </td>
                <td>Included</td>
                <td>{money(lineTotal(item))}</td>
                <td>
                  <button type="button" className="sci-pos-icon-button" onClick={() => onRemoveItem(item.product.id)} title="Remove item">
                    <Trash2 size={16} aria-hidden="true" />
                    <span className="sr-only">Remove item</span>
                  </button>
                </td>
              </tr>
            ))}
            {cart.length === 0 && (
              <tr>
                <td colSpan={7} className="sci-pos-empty-cell">Cart is empty.</td>
              </tr>
            )}
          </tbody>
        </table>
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
        </div>
      </div>

      <div className="pos-checkout-section">
        <div className="pos-section-heading">
          <Truck size={17} aria-hidden="true" />
          Delivery
        </div>
        <div className="pos-form-grid pos-delivery-grid">
          <label>
            Delivery Method
            <select value={deliveryMode} onChange={(event) => onDeliveryModeChange(event.target.value as DeliveryMode)}>
              {deliveryModes.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
            </select>
          </label>
          <label>
            Delivery Fee
            <input type="number" min="0" value={deliveryFee} onChange={(event) => onDeliveryFeeChange(event.target.value)} />
          </label>
          <label>
            Address
            <input value={deliveryAddress} onChange={(event) => onDeliveryAddressChange(event.target.value)} placeholder="Delivery address" />
          </label>
          <label>
            WhatsApp
            <input value={deliveryWhatsApp} onChange={(event) => onDeliveryWhatsAppChange(event.target.value)} placeholder="+263" />
          </label>
          <label className="pos-form-grid__wide">
            Notes
            <input value={deliveryNotes} onChange={(event) => onDeliveryNotesChange(event.target.value)} placeholder="Delivery notes" />
          </label>
        </div>
        {deliveryMode === 'iDeliver Service Placeholder' && (
          <div className="pos-placeholder-card">iDeliver service placeholder is ready for future dispatch integration.</div>
        )}
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
              {paymentMethods.map((method) => <option key={method} value={method}>{method}</option>)}
            </select>
          </label>
          <label>
            Amount Tendered
            <input type="number" min="0" value={paymentAmount} onChange={(event) => onPaymentAmountChange(event.target.value)} />
          </label>
          <label>
            Reference
            <input value={paymentReference} onChange={(event) => onPaymentReferenceChange(event.target.value)} placeholder="Required for non-cash" />
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

      <div className="pos-summary-box" aria-label="Cart Summary">
        <div><span>Subtotal</span><strong>{money(totals.subtotal)}</strong></div>
        <div><span>Discount Total</span><strong>{money(totals.discountTotal)}</strong></div>
        <div><span>Tax/VAT</span><strong>{money(totals.taxTotal)}</strong></div>
        <div><span>Delivery Fee</span><strong>{money(totals.deliveryFee)}</strong></div>
        <div className="pos-summary-box__grand"><span>Grand Total</span><strong>{money(totals.grandTotal)}</strong></div>
        <div><span>Payment Received</span><strong>{money(totals.paymentReceived)}</strong></div>
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
    </section>
  );
}
