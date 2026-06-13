import {
  AlertTriangle,
  Banknote,
  Calculator,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  MoreVertical,
  PauseCircle,
  ReceiptText,
  ShoppingCart,
  Truck,
  UserRound,
  XCircle
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { CartItem, CustomerRecord, VATMode } from '../types';
import FloatingCartItemsCard from './FloatingCartItemsCard';

export type SalesPaymentMethod =
  | 'Cash'
  | 'EcoCash'
  | 'Innbucks'
  | 'Mukuru'
  | 'ZIPIT'
  | 'Bank Transfer'
  | 'Card'
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

type CartToolPanel =
  | 'discount'
  | 'credit'
  | 'loyalty'
  | 'account'
  | 'void'
  | 'clear'
  | 'notes'
  | 'hold'
  | null;

type CheckoutFlowStep =
  | 'Idle'
  | 'CartReview'
  | 'DeliveryReview'
  | 'PaymentReview'
  | 'ReadyToComplete'
  | 'Completed';

export interface SalesDiscountPayload {
  scope: 'Cart' | 'Line';
  productId?: string;
  type: 'Percentage' | 'Fixed Amount';
  value: number;
  reason: string;
  notes?: string;
}

export interface SalesCreditRedemptionPayload {
  amount: number;
  reference: string;
  notes?: string;
}

export interface SalesLoyaltyRedemptionPayload {
  points: number;
  value: number;
  notes?: string;
}

export interface SalesCartNotesPayload {
  internalNote: string;
  receiptNote: string;
  deliveryNote: string;
}

export type SalesWorkspaceClearMode = 'Search Only' | 'Cart and Draft' | 'Entire Workspace';

export interface SalesVoidCartPayload {
  reason: string;
  keepCustomer: boolean;
}

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
  cartDiscountAmount: number;
  creditRedemptionAmount: number;
  loyaltyRedemptionAmount: number;
  cartInternalNote: string;
  receiptNote: string;
  cartDeliveryNote: string;
  availableCredit: number;
  availableLoyaltyPoints: number;
  canComplete: boolean;
  canReceivePayment: boolean;
  canApplyDiscount: boolean;
  canRedeemCredit: boolean;
  canUseLoyalty: boolean;
  canUseAccountSale: boolean;
  canVoidCart: boolean;
  canReprintReceipt: boolean;
  canHoldSale: boolean;
  canSaveDelivery: boolean;
  canBroadcastDelivery: boolean;
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
  onQuantitySet: (productId: string, quantity: number) => void;
  onQuantityChange: (productId: string, delta: number) => void;
  onRemoveItem: (productId: string) => void;
  onApplyLineDiscount: (productId: string) => void;
  onCartNotice?: (message: string) => void;
  onApplyCartDiscount: (payload: SalesDiscountPayload) => void;
  onRedeemCredit: (payload: SalesCreditRedemptionPayload) => void;
  onRedeemLoyalty: (payload: SalesLoyaltyRedemptionPayload) => void;
  onApplyAccountPayment: () => void;
  onVoidCart: (payload: SalesVoidCartPayload) => void;
  onReprintLastReceipt: () => void;
  onClearWorkspace: (mode: SalesWorkspaceClearMode) => void;
  onSaveCartNotes: (payload: SalesCartNotesPayload) => void;
  onPrepareIDeliverRequest: () => void;
  onGenerateDeliveryCode: () => void;
  onPrepareDeliveryWhatsApp: () => void;
  onCustomerDetailsSaved: () => void;
  onDeliveryDetailsSaved: () => void;
  onCheckoutActivity?: (eventType: string, message: string) => void;
  onPaymentMethodChange: (value: SalesPaymentMethod) => void;
  onPaymentAmountChange: (value: string) => void;
  onPaymentReferenceChange: (value: string) => void;
  onAddPayment: () => void;
  onRemovePayment: (paymentId: string) => void;
  onClearPayments: () => void;
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
  'EcoCash',
  'Innbucks',
  'Mukuru',
  'ZIPIT',
  'Bank Transfer',
  'Card',
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
  EcoCash: 'EcoCash',
  Innbucks: 'Innbucks',
  Mukuru: 'Mukuru',
  ZIPIT: 'ZIPIT',
  'Bank Transfer': 'Bank Transfer',
  Card: 'Card',
  'Credit / Account': 'Credit / Account',
  'Mixed Payment': 'Mixed Payment',
  'Already Paid': 'Already Paid',
  'No Payment Due': 'No Payment Due'
};

function money(value: number): string {
  return `USD ${value.toFixed(2)}`;
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
  cartDiscountAmount,
  creditRedemptionAmount,
  loyaltyRedemptionAmount,
  cartInternalNote,
  receiptNote,
  cartDeliveryNote,
  availableCredit,
  availableLoyaltyPoints,
  canComplete,
  canReceivePayment,
  canApplyDiscount,
  canRedeemCredit,
  canUseLoyalty,
  canUseAccountSale,
  canVoidCart,
  canReprintReceipt,
  canHoldSale,
  canSaveDelivery,
  canBroadcastDelivery,
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
  onQuantitySet,
  onQuantityChange,
  onRemoveItem,
  onApplyLineDiscount,
  onCartNotice,
  onApplyCartDiscount,
  onRedeemCredit,
  onRedeemLoyalty,
  onApplyAccountPayment,
  onVoidCart,
  onReprintLastReceipt,
  onClearWorkspace,
  onSaveCartNotes,
  onPrepareIDeliverRequest,
  onGenerateDeliveryCode,
  onPrepareDeliveryWhatsApp,
  onCustomerDetailsSaved,
  onDeliveryDetailsSaved,
  onCheckoutActivity,
  onPaymentMethodChange,
  onPaymentAmountChange,
  onPaymentReferenceChange,
  onAddPayment,
  onRemovePayment,
  onClearPayments,
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
  const [taxDrawerOpen, setTaxDrawerOpen] = useState(false);
  const [paymentDrawerOpen, setPaymentDrawerOpen] = useState(false);
  const [cartToolsOpen, setCartToolsOpen] = useState(false);
  const [cartItemsOpen, setCartItemsOpen] = useState(false);
  const [activeToolPanel, setActiveToolPanel] = useState<CartToolPanel>(null);
  const [discountScope, setDiscountScope] = useState<'Cart' | 'Line'>('Cart');
  const [discountProductId, setDiscountProductId] = useState('');
  const [discountType, setDiscountType] = useState<'Percentage' | 'Fixed Amount'>('Percentage');
  const [discountValue, setDiscountValue] = useState('5');
  const [discountReason, setDiscountReason] = useState('');
  const [discountNotes, setDiscountNotes] = useState('');
  const [creditAmount, setCreditAmount] = useState('');
  const [creditReference, setCreditReference] = useState('');
  const [creditNotes, setCreditNotes] = useState('');
  const [loyaltyPoints, setLoyaltyPoints] = useState('');
  const [loyaltyNotes, setLoyaltyNotes] = useState('');
  const [draftInternalNote, setDraftInternalNote] = useState(cartInternalNote);
  const [draftReceiptNote, setDraftReceiptNote] = useState(receiptNote);
  const [draftDeliveryNote, setDraftDeliveryNote] = useState(cartDeliveryNote);
  const [voidReason, setVoidReason] = useState('');
  const [voidKeepCustomer, setVoidKeepCustomer] = useState(true);
  const [voidConfirmed, setVoidConfirmed] = useState(false);
  const [clearMode, setClearMode] = useState<SalesWorkspaceClearMode>('Search Only');
  const [holdReason, setHoldReason] = useState('');
  const [holdExpiry, setHoldExpiry] = useState('');
  const [checkoutFlowStep, setCheckoutFlowStep] = useState<CheckoutFlowStep>('Idle');
  const [checkoutStartedFromCartItems, setCheckoutStartedFromCartItems] = useState(false);
  const [pendingCheckoutAfterDelivery, setPendingCheckoutAfterDelivery] = useState(false);
  const [pendingCheckoutAfterPayment, setPendingCheckoutAfterPayment] = useState(false);
  const [deliveryStepIncluded, setDeliveryStepIncluded] = useState(false);
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
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const lastCartItem = cart[cart.length - 1];
  const paymentStatus = totals.paymentReceived <= 0
    ? 'No payment captured'
    : totals.balanceDue > 0
      ? 'Partial payment'
      : 'Paid';
  const knownCustomerSelected = customerMode !== 'Walk-in Customer' && Boolean(customerName.trim());
  const loyaltyRedemptionValue = Math.min(Number(loyaltyPoints) || 0, availableLoyaltyPoints) * 0.01;
  const deliveryFeeAmount = Math.max(0, Number(deliveryFee) || 0);
  const deliveryRequiresCashCollection = deliveryPaymentMode === 'Cash On Delivery' || deliveryPaymentMode === 'Delivery Fee Cash';
  const shouldOpenDeliveryBeforePayment = () => {
    if (deliveryMode === 'Vendor Delivery' || deliveryMode === 'iDeliver Service') return true;
    if (deliveryMode === 'Customer Collection' && (deliveryNotes.trim() || deliveryFeeAmount > 0)) return true;
    if (deliveryFeeAmount > 0) return true;
    if (deliveryAddress.trim() || deliveryWhatsApp.trim() || deliveryNotes.trim()) return true;
    return deliveryRequiresCashCollection;
  };
  const checkoutSteps = deliveryStepIncluded
    ? ['Cart Review', 'Delivery Review', 'Payment', 'Complete']
    : ['Cart Review', 'Payment', 'Complete'];
  const activeStepLabel = checkoutFlowStep === 'DeliveryReview'
    ? 'Delivery Review'
    : checkoutFlowStep === 'PaymentReview' || checkoutFlowStep === 'ReadyToComplete'
      ? 'Payment'
      : checkoutFlowStep === 'Completed'
        ? 'Complete'
        : 'Cart Review';

  const emitCheckoutActivity = (eventType: string, message: string) => {
    onCheckoutActivity?.(eventType, message);
  };

  const validateCartForCheckout = (): boolean => {
    if (cart.length === 0) {
      onCartNotice?.('Cart is empty. Add products before checkout.');
      return false;
    }
    const invalidLine = cart.find((item) => item.quantity <= 0);
    if (invalidLine) {
      onCartNotice?.('Cart contains a zero or negative quantity. Correct quantities before checkout.');
      return false;
    }
    const blockedLine = cart.find((item) => {
      const available = item.product.availableStock ?? item.product.qtyOnHand ?? item.product.stock;
      return available <= 0 || item.quantity > available;
    });
    if (blockedLine) {
      onCartNotice?.(`Stock is not available for ${blockedLine.product.productName || blockedLine.product.name}.`);
      return false;
    }
    return true;
  };

  const openToolPanel = (panel: CartToolPanel) => {
    setCartToolsOpen(false);
    if (panel === 'notes') {
      setDraftInternalNote(cartInternalNote);
      setDraftReceiptNote(receiptNote);
      setDraftDeliveryNote(cartDeliveryNote);
    }
    setActiveToolPanel(panel);
  };

  const renderCheckoutFlowIndicator = () => (
    <div className="checkout-flow-indicator" aria-label="Checkout flow">
      {checkoutSteps.map((step) => (
        <span key={step} className={step === activeStepLabel ? 'active' : undefined}>{step}</span>
      ))}
    </div>
  );

  const openPaymentFromCheckout = () => {
    setCartItemsOpen(false);
    setDeliveryDrawerOpen(false);
    setPaymentDrawerOpen(true);
    setCheckoutFlowStep('PaymentReview');
    setPendingCheckoutAfterPayment(true);
    emitCheckoutActivity('CHECKOUT_PAYMENT_OPENED', 'Receive Payment opened from checkout flow.');
  };

  const startCheckoutFromCartItems = () => {
    setCheckoutStartedFromCartItems(true);
    setCheckoutFlowStep('CartReview');
    emitCheckoutActivity('CHECKOUT_STARTED_FROM_CART_ITEMS', 'Checkout started from Cart Items.');
    if (!validateCartForCheckout()) return;
    const deliveryRequired = shouldOpenDeliveryBeforePayment();
    setDeliveryStepIncluded(deliveryRequired);
    if (deliveryRequired) {
      setCartItemsOpen(false);
      setDeliveryDrawerOpen(true);
      setPendingCheckoutAfterDelivery(true);
      setCheckoutFlowStep('DeliveryReview');
      emitCheckoutActivity('CHECKOUT_DELIVERY_REQUIRED', 'Delivery review required before payment.');
      emitCheckoutActivity('CHECKOUT_DELIVERY_REVIEW_OPENED', 'Delivery / iDeliver checkout review opened.');
      return;
    }
    emitCheckoutActivity('CHECKOUT_DELIVERY_SKIPPED', 'Delivery review skipped for no-delivery checkout.');
    openPaymentFromCheckout();
  };

  const backToCartItemsFromCheckout = () => {
    setPaymentDrawerOpen(false);
    setDeliveryDrawerOpen(false);
    setCartItemsOpen(true);
    setCheckoutFlowStep('CartReview');
    emitCheckoutActivity('CHECKOUT_BACK_TO_CART', 'Returned to Cart Items during checkout.');
  };

  const backToDeliveryFromPayment = () => {
    setPaymentDrawerOpen(false);
    setDeliveryDrawerOpen(true);
    setCheckoutFlowStep('DeliveryReview');
    emitCheckoutActivity('CHECKOUT_BACK_TO_DELIVERY', 'Returned to Delivery Review during checkout.');
  };

  const validateDeliveryForPayment = (): boolean => {
    if (!shouldOpenDeliveryBeforePayment()) return true;
    if ((deliveryMode === 'Vendor Delivery' || deliveryMode === 'iDeliver Service') && !deliveryAddress.trim() && !deliveryNotes.trim()) {
      onCartNotice?.('Delivery address or a clear delivery note is required before payment.');
      return false;
    }
    if (!canSaveDelivery) {
      onCartNotice?.('You do not have permission to save delivery details.');
      return false;
    }
    if (deliveryMode === 'iDeliver Service' && !canBroadcastDelivery) {
      onCartNotice?.('You do not have permission to prepare iDeliver requests.');
      return false;
    }
    if (!canUseAccountSale && deliveryRequiresCashCollection && !canReceivePayment) {
      onCartNotice?.('You do not have permission to prepare a delivery cash collection.');
      return false;
    }
    return true;
  };

  const continueFromDeliveryToPayment = () => {
    if (!canComplete && !canReceivePayment && !canUseAccountSale) {
      onCartNotice?.('You do not have permission to continue checkout payment.');
      return;
    }
    if (!validateDeliveryForPayment()) return;
    onDeliveryDetailsSaved();
    if (deliveryMode === 'iDeliver Service') onPrepareIDeliverRequest();
    if (deliveryMode === 'Vendor Delivery' || deliveryMode === 'iDeliver Service' || deliveryRequiresCashCollection) onGenerateDeliveryCode();
    setPendingCheckoutAfterDelivery(false);
    emitCheckoutActivity('CHECKOUT_DELIVERY_SAVED', 'Delivery review saved during checkout.');
    if (deliveryMode === 'iDeliver Service') emitCheckoutActivity('CHECKOUT_IDELIVER_REQUEST_PREPARED', 'Local iDeliver request prepared during checkout.');
    openPaymentFromCheckout();
  };

  const completeTransactionFromPayment = () => {
    if (!canComplete) {
      onCartNotice?.('You do not have permission to complete this sale.');
      return;
    }
    if (totals.balanceDue > 0 && !['Credit / Account', 'Already Paid', 'No Payment Due'].includes(paymentMethod)) {
      onCartNotice?.('Balance remains. Capture payment or choose an allowed payment mode before completing.');
      return;
    }
    setCheckoutFlowStep('Completed');
    emitCheckoutActivity('CHECKOUT_COMPLETED', 'Checkout completed from payment review.');
    onCompleteSale();
  };

  const submitDiscount = () => {
    if (!canApplyDiscount) {
      onCartNotice?.('You do not have permission to apply discounts.');
      return;
    }
    const value = Math.max(0, Number(discountValue) || 0);
    if (value <= 0) {
      onCartNotice?.('Enter a discount value above zero.');
      return;
    }
    onApplyCartDiscount({
      scope: discountScope,
      productId: discountScope === 'Line' ? discountProductId : undefined,
      type: discountType,
      value,
      reason: discountReason.trim() || 'Local sale discount',
      notes: discountNotes.trim() || undefined
    });
    setActiveToolPanel(null);
  };

  const submitCredit = () => {
    if (!knownCustomerSelected) {
      onCartNotice?.('Select a customer before redeeming credit.');
      return;
    }
    if (!canRedeemCredit) {
      onCartNotice?.('You do not have permission to redeem customer credit.');
      return;
    }
    const amount = Math.max(0, Number(creditAmount) || 0);
    if (amount <= 0) {
      onCartNotice?.('Enter a credit redemption amount above zero.');
      return;
    }
    onRedeemCredit({ amount, reference: creditReference.trim() || `CR-${Date.now().toString().slice(-6)}`, notes: creditNotes.trim() || undefined });
    setActiveToolPanel(null);
  };

  const submitLoyalty = () => {
    if (!knownCustomerSelected) {
      onCartNotice?.('Select a customer before redeeming loyalty rewards.');
      return;
    }
    if (!canUseLoyalty) {
      onCartNotice?.('You do not have permission to redeem loyalty rewards.');
      return;
    }
    const points = Math.max(0, Math.floor(Number(loyaltyPoints) || 0));
    if (points <= 0) {
      onCartNotice?.('Enter loyalty points above zero.');
      return;
    }
    onRedeemLoyalty({ points, value: loyaltyRedemptionValue, notes: loyaltyNotes.trim() || undefined });
    setActiveToolPanel(null);
  };

  const submitVoidCart = () => {
    if (!canVoidCart) {
      onCartNotice?.('You do not have permission to void the cart.');
      return;
    }
    if (cart.length === 0) {
      onCartNotice?.('Cart is already empty.');
      return;
    }
    if (!voidConfirmed || !voidReason.trim()) {
      onCartNotice?.('Enter a void reason and confirm the action.');
      return;
    }
    onVoidCart({ reason: voidReason.trim(), keepCustomer: voidKeepCustomer });
    setVoidConfirmed(false);
    setVoidReason('');
    setActiveToolPanel(null);
  };

  return (
    <section className="sci-pos-card pos-cart-card sales-cart-shell" aria-labelledby="cart-title">
      <div className="sci-pos-card__bar sales-cart-fixed-header">
        <div>
          <p className="sci-pos-eyebrow">Make Sale</p>
          <h2 id="cart-title">Cart</h2>
        </div>
        <div className="sales-cart-header-actions">
          <div className="pos-receipt-chip">
            <ReceiptText size={16} aria-hidden="true" />
            Draft Receipt
          </div>
          <button type="button" className="sales-cart-items-trigger" onClick={() => setCartItemsOpen(true)}>
            <ShoppingCart size={16} aria-hidden="true" />
            Cart Items
            <span>{itemCount}</span>
          </button>
          <div className="sales-cart-tools-host">
            <button type="button" className="sci-pos-icon-button" onClick={() => setCartToolsOpen((current) => !current)} aria-label="Cart tools" aria-expanded={cartToolsOpen}>
              <MoreVertical size={16} aria-hidden="true" />
            </button>
            {cartToolsOpen && (
              <>
                <button type="button" className="sales-menu-dismiss-layer" aria-label="Close cart tools" onClick={() => setCartToolsOpen(false)} />
                <div className="sales-cart-tools-menu">
                  <strong>Cart Tools</strong>
                  <button type="button" disabled={!canApplyDiscount} onClick={() => openToolPanel('discount')}>Apply Discount</button>
                  <button type="button" disabled={!canRedeemCredit} onClick={() => openToolPanel('credit')}>Redeem Credit</button>
                  <button type="button" disabled={!canUseLoyalty} onClick={() => openToolPanel('loyalty')}>Loyalty / Rewards</button>
                  <button type="button" disabled={!canUseAccountSale} onClick={() => openToolPanel('account')}>Customer Account</button>
                  <button type="button" disabled={!canVoidCart} onClick={() => openToolPanel('void')}>Void Cart</button>
                  <button type="button" disabled={!canReprintReceipt} onClick={() => { setCartToolsOpen(false); onReprintLastReceipt(); }}>Reprint Last Receipt</button>
                  <button type="button" onClick={() => openToolPanel('clear')}>Clear Workspace</button>
                  <button type="button" onClick={() => openToolPanel('notes')}>Cart Notes</button>
                  <button type="button" disabled={!canHoldSale || cart.length === 0} onClick={() => openToolPanel('hold')}>Suspend / Hold Sale</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="pos-session-strip sales-cart-session-card" aria-label="Sale context">
        <span><strong>Cashier</strong>{cashierName}</span>
        <span><strong>Terminal</strong>{terminalName}</span>
        <span><strong>Branch</strong>{branchName}</span>
      </div>

      <div className="sales-cart-body">
        <section className="sales-cart-mini-card sales-cart-items-card">
          <div className="sales-cart-mini-card__header">
            <div>
              <ShoppingCart size={17} aria-hidden="true" />
              <h3>Cart Items</h3>
            </div>
            <span>{itemCount} item(s)</span>
          </div>
          <div className="sales-cart-items-summary">
            <span>Items <strong>{itemCount}</strong></span>
            <span>Subtotal <strong>{money(totals.subtotal)}</strong></span>
            <span>Last Added <strong>{lastCartItem ? `${lastCartItem.product.productName || lastCartItem.product.name} x${lastCartItem.quantity}` : 'None'}</strong></span>
            <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => setCartItemsOpen(true)} disabled={cart.length === 0}>
              View / Edit Cart Items
            </button>
          </div>
        </section>

        <section className="sales-cart-mini-card">
          <div className="sales-cart-mini-card__header">
            <div>
              <UserRound size={17} aria-hidden="true" />
              <h3>Customer</h3>
            </div>
          </div>
          <div className="sales-cart-compact-summary">
            <strong>{customerName || 'Walk-in Customer'}</strong>
            <span>{customerMode}</span>
            <span>{customerPhone || customerWhatsApp || 'No phone / WhatsApp'}</span>
            <span>{customerTaxNumber ? `Tax ${customerTaxNumber}` : 'No tax number'}</span>
            <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => setCustomerDrawerOpen(true)}>
              Customer Details
            </button>
          </div>
        </section>

        <section className="sales-cart-mini-card">
          <div className="sales-cart-mini-card__header">
            <div>
              <Calculator size={17} aria-hidden="true" />
              <h3>Tax</h3>
            </div>
            <button type="button" className="sci-pos-link-button" onClick={() => setTaxDrawerOpen(true)}>View / Edit Tax</button>
          </div>
          <div className="sales-cart-compact-summary sales-cart-metrics-row">
            <span>VAT Mode <strong>{vatMode}</strong></span>
            <span>VAT Rate <strong>{vatRate}%</strong></span>
            <span>VAT Amount <strong>{money(totals.taxTotal)}</strong></span>
            <span>Status <strong>{vatMode === 'Not VAT Registered' ? 'VAT not charged' : 'VAT Registered'}</strong></span>
          </div>
        </section>

        <section className="sales-cart-mini-card">
          <div className="sales-cart-mini-card__header">
            <div>
              <Truck size={17} aria-hidden="true" />
              <h3>Delivery / iDeliver</h3>
            </div>
            <button type="button" className="sci-pos-link-button" onClick={() => setDeliveryDrawerOpen(true)}>Delivery / iDeliver</button>
          </div>
          <div className="sales-cart-compact-summary sales-cart-metrics-row">
            <span>Method <strong>{deliveryMode}</strong></span>
            <span>Priority <strong>{deliveryPriority}</strong></span>
            <span>Fee <strong>{money(Number(deliveryFee) || 0)}</strong></span>
            <span>Payment <strong>{deliveryPaymentMode}</strong></span>
          </div>
        </section>

        <section className="sales-cart-mini-card">
          <div className="sales-cart-mini-card__header">
            <div>
              <Banknote size={17} aria-hidden="true" />
              <h3>Payment</h3>
            </div>
            <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => setPaymentDrawerOpen(true)} disabled={!canReceivePayment}>
              Receive Payment
            </button>
          </div>
          <div className="sales-cart-compact-summary sales-cart-metrics-row">
            <span>Status <strong>{paymentStatus}</strong></span>
            <span>Captured <strong>{money(totals.paymentReceived)}</strong></span>
            <span>Balance <strong>{money(totals.balanceDue)}</strong></span>
            <span>Lines <strong>{payments.length}</strong></span>
          </div>
        </section>
      </div>

      <footer className="sales-cart-footer" aria-label="Checkout Totals">
        <div className="sales-cart-footer-totals">
          <span>Subtotal <strong>{money(totals.subtotal)}</strong></span>
          <span>Discount <strong>{money(totals.discountTotal)}</strong></span>
          <span>Credit / Loyalty <strong>{money(creditRedemptionAmount + loyaltyRedemptionAmount)}</strong></span>
          <span>Tax <strong>{vatMode === 'Not VAT Registered' ? 'None' : money(totals.taxTotal)}</strong></span>
          <span>Delivery <strong>{money(totals.deliveryFee)}</strong></span>
          <span>Paid <strong>{money(totals.paymentReceived)}</strong></span>
          <span>Balance <strong>{money(totals.balanceDue)}</strong></span>
          <span className="sales-cart-footer-total">Total <strong>{money(totals.grandTotal)}</strong></span>
        </div>
        <div className="sales-cart-footer-actions">
          <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={onHoldSale} disabled={cart.length === 0}>
            <PauseCircle size={17} aria-hidden="true" />
            Hold Sale
          </button>
          <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={onCompleteSale} disabled={!canComplete} title={disableCompleteReason}>
            <CreditCard size={17} aria-hidden="true" />
            Complete Sale
          </button>
        </div>
      </footer>
      <FloatingCartItemsCard
        open={cartItemsOpen}
        cart={cart}
        subtotal={totals.subtotal}
        onClose={() => setCartItemsOpen(false)}
        onQuantitySet={onQuantitySet}
        onQuantityChange={onQuantityChange}
        onRemoveItem={onRemoveItem}
        onApplyLineDiscount={onApplyLineDiscount}
        onHoldSale={onHoldSale}
        onCheckout={startCheckoutFromCartItems}
        flowIndicator={checkoutStartedFromCartItems ? renderCheckoutFlowIndicator() : undefined}
        onNotice={onCartNotice}
      />
      {activeToolPanel && (
        <div className="sales-drawer-backdrop" onClick={() => setActiveToolPanel(null)}>
          <aside className="sales-drawer sales-tool-drawer" onClick={(event) => event.stopPropagation()} aria-label="Cart tool">
            <div className="sales-drawer-header">
              <div>
                <p className="sci-pos-eyebrow">Cart Tools</p>
                <h3>{activeToolPanel === 'discount' ? 'Apply Discount' : activeToolPanel === 'credit' ? 'Redeem Credit' : activeToolPanel === 'loyalty' ? 'Loyalty / Rewards' : activeToolPanel === 'account' ? 'Customer Account' : activeToolPanel === 'void' ? 'Void Cart' : activeToolPanel === 'clear' ? 'Clear Workspace' : activeToolPanel === 'hold' ? 'Suspend / Hold Sale' : 'Cart Notes'}</h3>
              </div>
              <button type="button" className="sci-pos-icon-button" onClick={() => setActiveToolPanel(null)} aria-label="Close cart tool"><XCircle size={16} aria-hidden="true" /></button>
            </div>
            <div className="sales-drawer-body">
              {activeToolPanel === 'discount' && (
                <section className="sales-drawer-section">
                  <div className="sales-tool-summary"><AlertTriangle size={16} /><span>High discounts are flagged locally for manager review.</span></div>
                  <label>Discount Scope<select value={discountScope} onChange={(event) => setDiscountScope(event.target.value as 'Cart' | 'Line')}><option value="Cart">Whole Cart</option><option value="Line">Selected Line</option></select></label>
                  {discountScope === 'Line' && <label>Cart Line<select value={discountProductId} onChange={(event) => setDiscountProductId(event.target.value)}><option value="">Select line</option>{cart.map((item) => <option key={item.product.id} value={item.product.id}>{item.product.productName || item.product.name}</option>)}</select></label>}
                  <label>Discount Type<select value={discountType} onChange={(event) => setDiscountType(event.target.value as 'Percentage' | 'Fixed Amount')}><option value="Percentage">Percentage</option><option value="Fixed Amount">Fixed Amount</option></select></label>
                  <label>Discount Value<input type="number" min="0" value={discountValue} onChange={(event) => setDiscountValue(event.target.value)} /></label>
                  <label>Reason<input value={discountReason} onChange={(event) => setDiscountReason(event.target.value)} placeholder="Damaged pack, customer retention, manager approved..." /></label>
                  <label>Notes<textarea rows={3} value={discountNotes} onChange={(event) => setDiscountNotes(event.target.value)} /></label>
                  <div className="sales-tool-summary"><CheckCircle2 size={16} /><span>Current cart discount: <strong>{money(cartDiscountAmount)}</strong></span></div>
                </section>
              )}
              {activeToolPanel === 'credit' && (
                <section className="sales-drawer-section">
                  <div className="pos-placeholder-card"><strong>{customerName || 'No customer selected'}</strong><span>Available local credit: {money(availableCredit)}</span><span>Current redemption: {money(creditRedemptionAmount)}</span></div>
                  <label>Redeem Amount<input type="number" min="0" value={creditAmount} onChange={(event) => setCreditAmount(event.target.value)} /></label>
                  <label>Credit Note / Reference<input value={creditReference} onChange={(event) => setCreditReference(event.target.value)} placeholder="Credit note or manager reference" /></label>
                  <label>Notes<textarea rows={3} value={creditNotes} onChange={(event) => setCreditNotes(event.target.value)} /></label>
                </section>
              )}
              {activeToolPanel === 'loyalty' && (
                <section className="sales-drawer-section">
                  <div className="pos-placeholder-card"><strong>{customerName || 'No customer selected'}</strong><span>Available points: {availableLoyaltyPoints}</span><span>Estimated earned points: {Math.floor(totals.grandTotal)}</span><span>Redemption value: {money(loyaltyRedemptionValue)}</span></div>
                  <label>Points to Redeem<input type="number" min="0" value={loyaltyPoints} onChange={(event) => setLoyaltyPoints(event.target.value)} /></label>
                  <label>Notes<textarea rows={3} value={loyaltyNotes} onChange={(event) => setLoyaltyNotes(event.target.value)} /></label>
                </section>
              )}
              {activeToolPanel === 'account' && (
                <section className="sales-drawer-section">
                  <div className="sales-account-grid">
                    <div><span>Customer</span><strong>{customerName || 'No customer selected'}</strong></div>
                    <div><span>Phone</span><strong>{customerPhone || customerWhatsApp || '-'}</strong></div>
                    <div><span>Account Status</span><strong>{knownCustomerSelected ? 'Local Active' : 'Select customer'}</strong></div>
                    <div><span>Credit Limit</span><strong>{money(availableCredit + 250)}</strong></div>
                    <div><span>Available Credit</span><strong>{money(availableCredit)}</strong></div>
                    <div><span>Outstanding Balance</span><strong>{money(Math.max(0, 250 - availableCredit))}</strong></div>
                    <div><span>Last Purchase</span><strong>Local recent sale</strong></div>
                  </div>
                  <label>Account Note<textarea rows={3} value={customerNotes} onChange={(event) => onCustomerNotesChange(event.target.value)} /></label>
                </section>
              )}
              {activeToolPanel === 'void' && (
                <section className="sales-drawer-section">
                  <div className="sales-tool-summary sales-tool-summary--danger"><AlertTriangle size={16} /><span>Void clears the active local cart and draft reductions. Completed receipts are not deleted.</span></div>
                  <label>Reason<textarea rows={3} value={voidReason} onChange={(event) => setVoidReason(event.target.value)} /></label>
                  <label className="sales-profit-check"><input type="checkbox" checked={voidKeepCustomer} onChange={(event) => setVoidKeepCustomer(event.target.checked)} /> Keep customer details</label>
                  <label className="sales-profit-check"><input type="checkbox" checked={voidConfirmed} onChange={(event) => setVoidConfirmed(event.target.checked)} /> Confirm void cart</label>
                </section>
              )}
              {activeToolPanel === 'clear' && (
                <section className="sales-drawer-section">
                  <label>Clear Mode<select value={clearMode} onChange={(event) => setClearMode(event.target.value as SalesWorkspaceClearMode)}><option value="Search Only">Clear Search Only</option><option value="Cart and Draft">Clear Cart and Draft</option><option value="Entire Workspace">Clear Entire Workspace</option></select></label>
                  <div className="pos-placeholder-card">Completed receipts and held sale history are retained.</div>
                </section>
              )}
              {activeToolPanel === 'notes' && (
                <section className="sales-drawer-section">
                  <label>Internal Sale Note<textarea rows={3} value={draftInternalNote} onChange={(event) => setDraftInternalNote(event.target.value)} /></label>
                  <label>Receipt Note<textarea rows={3} value={draftReceiptNote} onChange={(event) => setDraftReceiptNote(event.target.value)} /></label>
                  <label>Delivery Note Handoff<textarea rows={3} value={draftDeliveryNote} onChange={(event) => setDraftDeliveryNote(event.target.value)} /></label>
                </section>
              )}
              {activeToolPanel === 'hold' && (
                <section className="sales-drawer-section">
                  <div className="sales-tool-summary"><ClipboardList size={16} /><span>{itemCount} item(s), {money(totals.grandTotal)} held by {cashierName}</span></div>
                  <label>Reason / Note<textarea rows={3} value={holdReason} onChange={(event) => setHoldReason(event.target.value)} /></label>
                  <label>Hold Expiry<input type="datetime-local" value={holdExpiry} onChange={(event) => setHoldExpiry(event.target.value)} /></label>
                </section>
              )}
            </div>
            <div className="sales-drawer-actions">
              {activeToolPanel === 'discount' && <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={submitDiscount}>Apply Discount</button>}
              {activeToolPanel === 'credit' && <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={submitCredit}>Redeem Credit</button>}
              {activeToolPanel === 'loyalty' && <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={submitLoyalty}>Redeem Rewards</button>}
              {activeToolPanel === 'account' && <button type="button" className="sci-pos-button sci-pos-button--primary" disabled={!canUseAccountSale || !knownCustomerSelected} onClick={() => { onApplyAccountPayment(); setActiveToolPanel(null); }}>Apply Account Payment Method</button>}
              {activeToolPanel === 'account' && <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => onCartNotice?.('Customer Centre opened from sale context locally.')}>Open Customer Centre</button>}
              {activeToolPanel === 'void' && <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={submitVoidCart}>Void Cart</button>}
              {activeToolPanel === 'clear' && <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={() => { onClearWorkspace(clearMode); setActiveToolPanel(null); }}>Clear Workspace</button>}
              {activeToolPanel === 'notes' && <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={() => { onSaveCartNotes({ internalNote: draftInternalNote, receiptNote: draftReceiptNote, deliveryNote: draftDeliveryNote }); setActiveToolPanel(null); }}>Save Notes</button>}
              {activeToolPanel === 'hold' && <button type="button" className="sci-pos-button sci-pos-button--primary" disabled={!canHoldSale || cart.length === 0} onClick={() => { onPaymentReferenceChange(holdExpiry ? `${holdReason || 'Held sale'} | Expiry ${holdExpiry}` : holdReason); onHoldSale(); setActiveToolPanel(null); }}>Hold Sale</button>}
              <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => setActiveToolPanel(null)}>Close</button>
            </div>
          </aside>
        </div>
      )}
      {taxDrawerOpen && (
        <div className="sales-drawer-backdrop" onClick={() => setTaxDrawerOpen(false)}>
          <aside className="sales-drawer" onClick={(event) => event.stopPropagation()} aria-label="Tax Details">
            <div className="sales-drawer-header">
              <div><p className="sci-pos-eyebrow">Tax</p><h3>Tax Details</h3></div>
              <button type="button" className="sci-pos-icon-button" onClick={() => setTaxDrawerOpen(false)} aria-label="Close tax details"><XCircle size={16} aria-hidden="true" /></button>
            </div>
            <div className="sales-drawer-body">
              <section className="sales-drawer-section">
                <label>VAT Mode<select value={vatMode} onChange={(event) => onVatModeChange(event.target.value as VATMode)}><option value="Inclusive">VAT Inclusive</option><option value="Exclusive">VAT Exclusive</option><option value="Not VAT Registered">Not VAT Registered</option></select></label>
                <label>VAT Rate<input type="number" min="0" value={vatRate} onChange={(event) => onVatRateChange(event.target.value)} /></label>
                <div className="pos-tax-status"><span>VAT Amount</span><strong>{money(totals.taxTotal)}</strong></div>
                <div className="pos-tax-status"><span>VAT Registered Status</span><strong>{vatMode === 'Not VAT Registered' ? 'VAT not charged.' : 'VAT Registered'}</strong></div>
                <div className="pos-tax-status"><span>Tax Number</span><strong>{customerTaxNumber || 'No customer tax number'}</strong></div>
                <label>Tax Notes<textarea rows={3} placeholder="Tax notes. No tax posting rules are changed." /></label>
              </section>
            </div>
            <div className="sales-drawer-actions">
              <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={() => setTaxDrawerOpen(false)}>Save Tax Details</button>
              <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => setTaxDrawerOpen(false)}>Close</button>
            </div>
          </aside>
        </div>
      )}
      {paymentDrawerOpen && (
        <div className="sales-drawer-backdrop" onClick={() => setPaymentDrawerOpen(false)}>
          <aside className="sales-drawer" onClick={(event) => event.stopPropagation()} aria-label="Receive Payment">
            <div className="sales-drawer-header">
              <div><p className="sci-pos-eyebrow">Payment</p><h3>Receive Payment</h3></div>
              <button type="button" className="sci-pos-icon-button" onClick={() => setPaymentDrawerOpen(false)} aria-label="Close receive payment"><XCircle size={16} aria-hidden="true" /></button>
            </div>
            {checkoutStartedFromCartItems && renderCheckoutFlowIndicator()}
            <div className="sales-drawer-body">
              <section className="sales-drawer-section">
                {checkoutStartedFromCartItems && (
                  <div className="checkout-payment-summary">
                    <span>Subtotal <strong>{money(totals.subtotal)}</strong></span>
                    <span>Discount <strong>{money(totals.discountTotal)}</strong></span>
                    <span>Credit / Loyalty <strong>{money(creditRedemptionAmount + loyaltyRedemptionAmount)}</strong></span>
                    <span>Tax <strong>{money(totals.taxTotal)}</strong></span>
                    <span>Delivery <strong>{money(totals.deliveryFee)}</strong></span>
                    <span>Total <strong>{money(totals.grandTotal)}</strong></span>
                    <span>Paid <strong>{money(totals.paymentReceived)}</strong></span>
                    <span>Balance <strong>{money(totals.balanceDue)}</strong></span>
                  </div>
                )}
                <label>Payment Method<select value={paymentMethod} onChange={(event) => onPaymentMethodChange(event.target.value as SalesPaymentMethod)}>{paymentMethods.map((method) => <option key={method} value={method}>{paymentLabels[method]}</option>)}</select></label>
                <label>Payment Amount<input type="number" min="0" value={paymentAmount} onChange={(event) => onPaymentAmountChange(event.target.value)} /></label>
                <label>Payment Notes<input value={paymentReference} onChange={(event) => onPaymentReferenceChange(event.target.value)} placeholder="Add payment reference, mobile money confirmation, bank note, or cashier note..." /></label>
                <label>Reference Number / Confirmation Code<input value={paymentReference} onChange={(event) => onPaymentReferenceChange(event.target.value)} placeholder="Reference or confirmation code" /></label>
                <div className="sales-payment-placeholder-grid">
                  <div><span>Split Payment</span><strong>{paymentMethod === 'Mixed Payment' ? 'Selected' : 'Available'}</strong></div>
                  <div><span>Cash Tendered</span><strong>{money(Number(paymentAmount) || 0)}</strong></div>
                  <div><span>Change Due</span><strong>{money(totals.changeDue)}</strong></div>
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
              </section>
            </div>
            <div className="sales-drawer-actions">
              <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={() => { onAddPayment(); emitCheckoutActivity('CHECKOUT_PAYMENT_ADDED', 'Payment line added during checkout.'); }} disabled={!canReceivePayment}>Add Payment</button>
              <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={onClearPayments}>Clear Payment</button>
              {checkoutStartedFromCartItems && deliveryStepIncluded && <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={backToDeliveryFromPayment}>Back to Delivery</button>}
              {checkoutStartedFromCartItems && <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={backToCartItemsFromCheckout}>Back to Cart Items</button>}
              {checkoutStartedFromCartItems && <button type="button" className="sci-pos-button sci-pos-button--primary" disabled={!canComplete} title={disableCompleteReason} onClick={completeTransactionFromPayment}>Complete Transaction</button>}
              <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => setPaymentDrawerOpen(false)}>Close</button>
            </div>
          </aside>
        </div>
      )}
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
                <label>Existing Customer Lookup<input value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Search name, phone, WhatsApp, tax no." /></label>
                    <label>Existing Customer<select value={selectedCustomerId} onChange={(event) => onExistingCustomerSelect?.(event.target.value)}><option value="">Select active customer</option>{filteredExistingCustomers.map((customer) => <option key={customer.customerId} value={customer.customerId}>{customer.customerName} - {customer.customerCode}</option>)}</select></label>
                    {selectedCustomer && <div className="pos-placeholder-card"><strong>{selectedCustomer.customerName}</strong><span>Tax: {selectedCustomer.taxNumber || 'No tax number'} | Credit: {selectedCustomer.creditStatus}</span><span>Billing: {selectedCustomer.billingAddress || 'No billing address'}</span><span>Delivery: {selectedCustomer.deliveryAddress || 'No delivery address'}</span></div>}
                  </>
                )}
                <label>Customer Name<input value={customerName} onChange={(event) => onCustomerNameChange(event.target.value)} placeholder="Walk-in Customer" /></label>
                <label>Phone<input value={customerPhone} onChange={(event) => onCustomerPhoneChange(event.target.value)} placeholder="+263" /></label>
                <label>WhatsApp<input value={customerWhatsApp} onChange={(event) => onCustomerWhatsAppChange(event.target.value)} placeholder="+263" /></label>
                <label>Address<input value={customerAddress} onChange={(event) => onCustomerAddressChange(event.target.value)} placeholder="Customer address" /></label>
                <label>Tax Number<input value={customerTaxNumber} onChange={(event) => onCustomerTaxNumberChange(event.target.value)} placeholder="Tax number" /></label>
                <label>Customer Notes<textarea value={customerNotes} onChange={(event) => onCustomerNotesChange(event.target.value)} placeholder="Customer notes" rows={3} /></label>
                <div className="pos-placeholder-card">New customer request is saved locally and queued when offline sync is active.</div>
              </section>
            </div>
            <div className="sales-drawer-actions">
              <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={() => { onCustomerDetailsSaved(); setCustomerDrawerOpen(false); }}>Save Customer Details</button>
              <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={onSaveCustomerRequest}>Create New Customer Request</button>
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
              <div><p className="sci-pos-eyebrow">Delivery</p><h3>{pendingCheckoutAfterDelivery ? 'Delivery / iDeliver Checkout Review' : 'Delivery / iDeliver Details'}</h3></div>
              <button type="button" className="sci-pos-icon-button" onClick={() => setDeliveryDrawerOpen(false)} aria-label="Close delivery details"><XCircle size={16} aria-hidden="true" /></button>
            </div>
            {checkoutStartedFromCartItems && renderCheckoutFlowIndicator()}
            <div className="sales-drawer-body">
              <section className="sales-drawer-section">
                {pendingCheckoutAfterDelivery && (
                  <div className="checkout-payment-summary">
                    <span>Method <strong>{deliveryMode}</strong></span>
                    <span>Address <strong>{deliveryAddress || 'Not captured'}</strong></span>
                    <span>WhatsApp <strong>{deliveryWhatsApp || customerWhatsApp || '-'}</strong></span>
                    <span>Priority <strong>{deliveryPriority}</strong></span>
                    <span>Fee <strong>{money(Number(deliveryFee) || 0)}</strong></span>
                    <span>Payment <strong>{deliveryPaymentMode}</strong></span>
                    <span>iDeliver Status <strong>{deliveryMode === 'iDeliver Service' ? 'Local draft ready' : 'Not required'}</strong></span>
                    <span>Fulfilment Code <strong>{deliveryNotes.includes('Fulfilment') ? 'Captured in notes' : 'Generated when continuing'}</strong></span>
                  </div>
                )}
                <label>Delivery Method<select value={deliveryMode} onChange={(event) => onDeliveryModeChange(event.target.value as DeliveryMode)}>{deliveryModes.map((mode) => <option key={mode} value={mode}>{mode}</option>)}</select></label>
                <label>Delivery Fee<input type="number" min="0" value={deliveryFee} onChange={(event) => onDeliveryFeeChange(event.target.value)} /></label>
                <label>Priority<select value={deliveryPriority} onChange={(event) => onDeliveryPriorityChange(event.target.value as SalesDeliveryPriority)}>{deliveryPriorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select></label>
                <label>Payment Mode<select value={deliveryPaymentMode} onChange={(event) => onDeliveryPaymentModeChange(event.target.value as SalesDeliveryPaymentMode)}>{deliveryPaymentModes.map((mode) => <option key={mode} value={mode}>{mode}</option>)}</select></label>
                <label>Delivery Address<input value={deliveryAddress} onChange={(event) => onDeliveryAddressChange(event.target.value)} placeholder="Delivery address" /></label>
                <label>WhatsApp<input value={deliveryWhatsApp} onChange={(event) => onDeliveryWhatsAppChange(event.target.value)} placeholder="+263" /></label>
                <label>Delivery Notes<textarea value={deliveryNotes} onChange={(event) => onDeliveryNotesChange(event.target.value)} placeholder="Delivery notes" rows={3} /></label>
                <div className="pos-placeholder-card">Delivery, iDeliver broadcast, fulfilment code, and WhatsApp message drafts stay local until sale completion.</div>
              </section>
            </div>
            <div className="sales-drawer-actions">
              <button type="button" className="sci-pos-button sci-pos-button--primary" disabled={!canSaveDelivery} onClick={() => { onDeliveryDetailsSaved(); emitCheckoutActivity('CHECKOUT_DELIVERY_SAVED', 'Delivery details saved locally.'); setDeliveryDrawerOpen(false); }}>Save Delivery Details</button>
              <button type="button" className="sci-pos-button sci-pos-button--secondary" disabled={!canBroadcastDelivery || deliveryMode !== 'iDeliver Service'} onClick={() => { onPrepareIDeliverRequest(); emitCheckoutActivity('CHECKOUT_IDELIVER_REQUEST_PREPARED', 'Local iDeliver request prepared.'); }}>Prepare iDeliver Request</button>
              <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={onGenerateDeliveryCode}>Generate Fulfilment Code</button>
              <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={onPrepareDeliveryWhatsApp}>Prepare WhatsApp Message</button>
              {checkoutStartedFromCartItems && <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={backToCartItemsFromCheckout}>Back to Cart Items</button>}
              {pendingCheckoutAfterDelivery && <button type="button" className="sci-pos-button sci-pos-button--primary" disabled={!canSaveDelivery || (deliveryMode === 'iDeliver Service' && !canBroadcastDelivery)} onClick={continueFromDeliveryToPayment}>Continue to Payment</button>}
              <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => { onDeliveryModeChange('No Delivery'); onDeliveryFeeChange('0'); onDeliveryAddressChange(''); onDeliveryWhatsAppChange(''); onDeliveryNotesChange(''); setDeliveryDrawerOpen(false); }}>Clear Delivery</button>
              <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => setDeliveryDrawerOpen(false)}>Close</button>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}
