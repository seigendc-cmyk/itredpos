import { useEffect, useMemo, useState } from 'react';
import { History, MoreVertical, Printer, RotateCcw, ShieldCheck, X } from 'lucide-react';
import ProductSearchCard from '../components/ProductSearchCard';
import SalesCartCard, {
  DeliveryMode,
  SalesCartNotesPayload,
  SalesCreditRedemptionPayload,
  SalesLoyaltyRedemptionPayload,
  SalesDeliveryPaymentMode,
  SalesDeliveryPriority,
  SalesDiscountPayload,
  SalesCustomerMode,
  SalesPaymentLine,
  SalesPaymentMethod,
  SalesVoidCartPayload,
  SalesWorkspaceClearMode
} from '../components/SalesCartCard';
import ReceiptPreview80mm from '../components/ReceiptPreview80mm';
import SalesReceiptReviewModal from '../components/SalesReceiptReviewModal';
import ReceiptOutputModal from '../components/ReceiptOutputModal';
import SalesProfitSnapshotCard from '../components/SalesProfitSnapshotCard';
import MiscellaneousSaleModal, { MiscellaneousSalePayload } from '../components/MiscellaneousSaleModal';
import { mockProducts, mockRecentSales } from '../mock/mockPosData';
import { ENABLE_MOCK_SEED_DATA } from '../utils/vendorDataMode';
import { createAccountingPostingPlaceholder } from '../services/accountingService';
import { biEventService } from '../services/biEventService';
import { createReceiptFromSale, getReceiptPreview } from '../services/receiptService';
import { postSaleMovement } from '../services/inventoryMovementService';
import { createDeliveryRequestFromReceipt } from '../services/deliveryService';
import { recordPaymentReportEvent } from '../services/paymentReportService';
import { recordCOGSRecoveryFromSale } from '../services/cogsReserveService';
import { canSellInventoryItems as canSellInventoryItemsForSession, logTerminalControlEvent, runTerminalControlCheck } from '../services/terminalControlService';
import { createMiscellaneousSaleAdvice } from '../services/biAdviceService';
import { routeBIAdviceToDesk } from '../services/biAdviceRoutingService';
import {
  canCustomerBuyOnCredit,
  createCustomerCreditApprovalRequest,
  createCustomerCreditBIAdvice,
  createCustomerDebtFromCreditSale,
  type CreditDecision
} from '../services/customerCreditService';
import {
  clearShiftRecoveryState,
  getShiftRecoveryState,
  hasRecoverableShiftState,
  recoverShiftState
} from '../services/shiftRecoveryService';
import { createCustomerRequest, getCustomers, recordCustomerSaleBridgeEvent, recordCustomerSelectedForSale } from '../services/customerService';
import { enqueueOfflineAction, getNetworkStatus } from '../services/offlineSyncService';
import { getProductTotalAvailableStock } from '../services/stockBalanceService';
import {
  cancelHeldSalePlaceholder,
  deleteAllHeldSales,
  deleteHeldSale,
  getHeldSaleExpiryStatus,
  getHeldSales,
  HeldSaleRecord,
  holdCurrentSale,
  markHeldSaleResumed,
  reopenHeldSale
} from '../services/salesService';
import {
  CartItem,
  CustomerRecord,
  PaymentMode,
  PosSession,
  Product,
  ReceiptPrintPreview,
  Role,
  Sale,
  TaxSetting,
  TerminalControlCheck,
  VATMode
} from '../types';
import { canPerformAction } from '../utils/posPermissions';
import { matchesFreeOrderSearch } from '../utils/searchUtils';
import { calculateVATExclusive, calculateVATInclusive } from '../utils/taxUtils';

interface PosSalesProps {
  products: Product[];
  onProductStockChange: (productId: string, quantitySold: number) => void;
  onAddTransaction: (transaction: Omit<Sale, 'id' | 'invoiceNo' | 'date'>) => void;
  onNavigate: (page: string) => void;
  activeShiftOperator: string | null;
  session?: PosSession | null;
  taxSetting: TaxSetting;
}

interface SalesAuditEvent {
  id: string;
  time: string;
  eventType: string;
  message: string;
}

type SalesWorkspaceDrawer = 'recentReceipts' | 'heldSales' | 'activityFeed' | null;

const DEFAULT_PRODUCTS = ENABLE_MOCK_SEED_DATA ? mockProducts : [];
const DEFAULT_VENDOR_ID = 'unassigned-vendor';
const SHIFT_START_INTENT_KEY = 'itred_pos_open_shift_start_wizard_v1';
const SELECTED_CUSTOMER_FOR_SALE_KEY = 'itred-pos-selected-customer-for-sale';
const SELECTED_CUSTOMER_FOR_SALE_SESSION_KEY = 'itred_pos_selected_customer_for_sale_v1';
const paymentReferenceRequired = new Set<SalesPaymentMethod>(['EcoCash', 'Innbucks', 'Mukuru', 'ZIPIT', 'Bank Transfer', 'Card']);

interface SelectedCustomerForSaleBridge {
  customerId: string;
  customerCode: string;
  customerName: string;
  customerType?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  cityTown?: string;
  district?: string;
  suburb?: string;
  address?: string;
  taxNumber?: string;
  creditStatus?: CustomerRecord['creditStatus'];
  creditLimit?: number;
  selectedAt: string;
  selectedByStaffId?: string;
  source?: 'Customer Centre';
}

function money(value: number): string {
  return `USD ${value.toFixed(2)}`;
}

function productName(product: Product): string {
  return product.productName || product.name;
}

function productSku(product: Product): string {
  return product.sku || product.code;
}

function productPrice(product: Product): number {
  return product.sellingPrice ?? product.price;
}

function productStock(product: Product): number {
  return product.availableStock ?? product.qtyOnHand ?? product.stock;
}

function branchIdFromName(branchName: string): string {
  return branchName.toLowerCase().includes('bulawayo') ? 'BR-BYO' : 'BR-HARARE';
}

function receiptPaymentMode(method: SalesPaymentMethod): PaymentMode {
  if (method === 'Credit / Account') return 'Credit Sale';
  if (method === 'Card') return 'Swipe';
  if (method === 'Mixed Payment') return 'Split Payment';
  if (method === 'Already Paid' || method === 'No Payment Due') return 'Cash';
  if (method === 'Innbucks' || method === 'Mukuru' || method === 'ZIPIT') return 'Bank Transfer';
  return method;
}

function salePaymentMethod(method: SalesPaymentMethod): Sale['paymentMethod'] {
  if (method === 'Cash') return 'CASH';
  if (method === 'Mixed Payment') return 'SPLIT';
  if (method === 'Credit / Account') return 'Credit Sale';
  return 'CARD';
}

function cartLineTotal(item: CartItem): number {
  const base = (item.overriddenPrice ?? productPrice(item.product)) * item.quantity;
  return base - base * (item.discount / 100);
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function readSelectedCustomerForSaleBridge(): SelectedCustomerForSaleBridge | null {
  try {
    const raw = localStorage.getItem(SELECTED_CUSTOMER_FOR_SALE_KEY) || sessionStorage.getItem(SELECTED_CUSTOMER_FOR_SALE_SESSION_KEY);
    return raw ? JSON.parse(raw) as SelectedCustomerForSaleBridge : null;
  } catch {
    return null;
  }
}

function clearSelectedCustomerForSaleBridge(): void {
  try {
    localStorage.removeItem(SELECTED_CUSTOMER_FOR_SALE_KEY);
  } catch {
    // Local bridge is best-effort.
  }
  try {
    sessionStorage.removeItem(SELECTED_CUSTOMER_FOR_SALE_SESSION_KEY);
  } catch {
    // Session bridge is best-effort.
  }
}

export default function PosSales({
  products,
  onProductStockChange,
  onAddTransaction,
  onNavigate,
  session,
  taxSetting
}: PosSalesProps) {
  const staffName = session?.staffName || 'Admin User';
  const roleName = (session?.role || 'Owner') as Role;
  const branchName = session?.branch || 'Main Branch';
  const terminalName = session?.terminal || 'POS-01';
  const vendorName = session?.vendor || 'Business';
  const vendorId = session?.vendorId || DEFAULT_VENDOR_ID;
  const warehouseName = 'Main Warehouse';

  const [localProducts, setLocalProducts] = useState<Product[]>(products.length > 0 ? products : DEFAULT_PRODUCTS);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerMode, setCustomerMode] = useState<SalesCustomerMode>('Walk-in Customer');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [activeCustomers, setActiveCustomers] = useState<CustomerRecord[]>([]);
  const [customerName, setCustomerName] = useState('Walk-in Customer');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerWhatsApp, setCustomerWhatsApp] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerTaxNumber, setCustomerTaxNumber] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<SalesPaymentMethod>('Cash');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [payments, setPayments] = useState<SalesPaymentLine[]>([]);
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('No Delivery');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryWhatsApp, setDeliveryWhatsApp] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('0');
  const [deliveryPriority, setDeliveryPriority] = useState<SalesDeliveryPriority>('Normal');
  const [deliveryPaymentMode, setDeliveryPaymentMode] = useState<SalesDeliveryPaymentMode>('Already Paid');
  const defaultVatMode: VATMode = taxSetting.inclusive ? 'Inclusive' : 'Exclusive';
  const [vatMode, setVatMode] = useState<VATMode>(defaultVatMode);
  const [vatRate, setVatRate] = useState(String(taxSetting.vatRatePct ?? 0));
  const [vatManuallyChanged, setVatManuallyChanged] = useState(false);

  useEffect(() => {
    if (vatManuallyChanged) return;
    setVatMode(taxSetting.inclusive ? 'Inclusive' : 'Exclusive');
    setVatRate(String(taxSetting.vatRatePct ?? 0));
  }, [taxSetting.inclusive, taxSetting.vatRatePct, vatManuallyChanged]);
  const [cartDiscountAmount, setCartDiscountAmount] = useState(0);
  const [creditRedemptionAmount, setCreditRedemptionAmount] = useState(0);
  const [loyaltyRedemptionAmount, setLoyaltyRedemptionAmount] = useState(0);
  const [cartInternalNote, setCartInternalNote] = useState('');
  const [receiptNote, setReceiptNote] = useState('');
  const [cartDeliveryNote, setCartDeliveryNote] = useState('');
  const [deliveryFulfilmentCode, setDeliveryFulfilmentCode] = useState('');
  const [deliveryDraftMessage, setDeliveryDraftMessage] = useState('');
  const [heldSales, setHeldSales] = useState<HeldSaleRecord[]>([]);
  const [recentSales, setRecentSales] = useState<Sale[]>(ENABLE_MOCK_SEED_DATA ? mockRecentSales.slice(0, 5) : []);
  const [auditEvents, setAuditEvents] = useState<SalesAuditEvent[]>([]);
  const [statusMessage, setStatusMessage] = useState('');
  const [receiptPreview, setReceiptPreview] = useState<ReceiptPrintPreview | null>(null);
  const [receiptReviewSale, setReceiptReviewSale] = useState<Sale | null>(null);
  const [preparedReceiptPreview, setPreparedReceiptPreview] = useState<ReceiptPrintPreview | null>(null);
  const [receiptOutputPreview, setReceiptOutputPreview] = useState<ReceiptPrintPreview | null>(null);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [workspaceDrawer, setWorkspaceDrawer] = useState<SalesWorkspaceDrawer>(null);
  const [profitSnapshotOpen, setProfitSnapshotOpen] = useState(false);
  const [collapseFieldsSignal, setCollapseFieldsSignal] = useState(0);
  const [miscSaleOpen, setMiscSaleOpen] = useState(false);
  const [heldSaleSearch, setHeldSaleSearch] = useState('');
  const [recentReceiptSearch, setRecentReceiptSearch] = useState('');
  const [salesReadiness, setSalesReadiness] = useState<TerminalControlCheck | null>(null);
  const [salesRecoveryFound, setSalesRecoveryFound] = useState(hasRecoverableShiftState());
  const [salesRecoveryDetailsOpen, setSalesRecoveryDetailsOpen] = useState(false);
  const [activitySearch, setActivitySearch] = useState('');
  const [creditDecision, setCreditDecision] = useState<CreditDecision | null>(null);
  const [pendingBridgeCustomer, setPendingBridgeCustomer] = useState<SelectedCustomerForSaleBridge | null>(null);
  const [bridgeCustomerChecked, setBridgeCustomerChecked] = useState(false);

  useEffect(() => {
    const baseProducts = products.length > 0 ? products : DEFAULT_PRODUCTS;
    setLocalProducts(baseProducts);
    let cancelled = false;
    Promise.all(baseProducts.map(async (product) => {
      try {
        const availableStock = await getProductTotalAvailableStock(product.id);
        return availableStock > 0 || product.stock === 0 ? { ...product, availableStock } : product;
      } catch {
        return product;
      }
    })).then((nextProducts) => {
      if (!cancelled) setLocalProducts(nextProducts);
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [products]);

  useEffect(() => {
    getCustomers({ status: 'Active' }).then(setActiveCustomers).catch(() => setActiveCustomers([]));
  }, []);

  useEffect(() => {
    getHeldSales().then(setHeldSales).catch(() => setHeldSales([]));
  }, []);

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + cartLineTotal(item), 0), [cart]);
  const lineDiscountTotal = useMemo(() => cart.reduce((sum, item) => {
    const base = (item.overriddenPrice ?? productPrice(item.product)) * item.quantity;
    return sum + base * (item.discount / 100);
  }, 0), [cart]);
  const parsedDeliveryFee = Math.max(0, Number(deliveryFee) || 0);
  const parsedVatRate = Math.max(0, Number(vatRate) || 0);
  const taxableSubtotal = Math.max(0, subtotal - cartDiscountAmount);
  // TODO: Surtax requires a separate line-level tax model before adding to cart totals.
  const taxTotal = useMemo(() => {
    if (vatMode === 'Not VAT Registered') return 0;
    if (vatMode === 'Exclusive') return calculateVATExclusive(taxableSubtotal, parsedVatRate).vatAmount;
    return calculateVATInclusive(taxableSubtotal, parsedVatRate).vatAmount;
  }, [parsedVatRate, taxableSubtotal, vatMode]);
  const grandTotalBeforeCredit = vatMode === 'Exclusive' ? taxableSubtotal + taxTotal + parsedDeliveryFee : taxableSubtotal + parsedDeliveryFee;
  const grandTotal = Math.max(0, grandTotalBeforeCredit - creditRedemptionAmount - loyaltyRedemptionAmount);
  const paymentReceived = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const nonCreditPaymentReceived = payments.filter((payment) => payment.method !== 'Credit / Account').reduce((sum, payment) => sum + payment.amount, 0);
  const changeDue = Math.max(0, paymentReceived - grandTotal);
  const balanceDue = Math.max(0, grandTotal - paymentReceived);
  const creditSaleRequested = paymentMethod === 'Credit / Account' || payments.some((payment) => payment.method === 'Credit / Account');
  const creditDebtAmount = creditSaleRequested ? Math.max(0, grandTotal - nonCreditPaymentReceived) : 0;
  const creditSaleAllowed = paymentMethod === 'Already Paid' || (paymentMethod === 'No Payment Due' && grandTotal === 0) ||
    payments.some((payment) => payment.method === 'Already Paid' || (payment.method === 'No Payment Due' && grandTotal === 0)) ||
    (creditSaleRequested && creditDecision?.decision === 'Allowed' && canPerformAction(roleName, 'sales.creditSale'));
  const creditSaleOverrideAllowed = creditSaleRequested && creditDecision?.decision === 'Requires Approval' && canPerformAction(roleName, 'sales.creditSale.override');
  const canComplete = cart.length > 0 && (creditSaleAllowed || creditSaleOverrideAllowed || paymentReceived >= grandTotal);
  const canCompleteWithPermission = canComplete && canPerformAction(roleName, 'sales.complete');
  const canViewProfitSnapshot = canPerformAction(roleName, 'sales.profitSnapshot.view');
  const canGenerateProfitSnapshot = canPerformAction(roleName, 'sales.profitSnapshot.generate');
  const canExportProfitSnapshot = canPerformAction(roleName, 'sales.profitSnapshot.export');
  const canPrintProfitSnapshot = canPerformAction(roleName, 'sales.profitSnapshot.print');
  const canCreateMiscellaneousSale = canPerformAction(roleName, 'sales.miscellaneous.create');
  const canViewSalesHistory = canPerformAction(roleName, 'sales.viewHistory');
  const canProcessSalesReturns = canPerformAction(roleName, 'sales.return');
  const canSellInventoryItems = canSellInventoryItemsForSession({
    check: salesReadiness,
    staffSessionValid: Boolean(session?.staffName || staffName),
    branchExists: Boolean(branchName),
    terminalExists: Boolean(terminalName),
    recoveryBlocked: salesRecoveryFound
  });
  const inventoryBlockedMessage = 'Terminal is not active. Activate terminal and open shift to sell inventory items.';
  const disableCompleteReason = cart.length === 0
    ? 'Cart is empty.'
    : !canPerformAction(roleName, 'sales.complete')
      ? 'You do not have permission to complete a sale.'
      : creditSaleAllowed || creditSaleOverrideAllowed || paymentReceived >= grandTotal
      ? ''
      : 'Payment is under the sale total.';

  const logEvent = (eventType: string, message: string) => {
    setAuditEvents((current) => [{
      id: makeId('SAE'),
      time: new Date().toLocaleTimeString(),
      eventType,
      message
    }, ...current].slice(0, 8));
  };

  useEffect(() => {
    let cancelled = false;
    runTerminalControlCheck({
      vendorId,
      branchId: branchIdFromName(branchName),
      terminalId: terminalName,
      terminalName,
      staffId: staffName,
      staffName,
      role: roleName,
      requiresCashDrawer: true
    }).then((check) => {
      if (!cancelled) setSalesReadiness(check);
    }).catch(() => {
      if (!cancelled) setSalesReadiness(null);
    });
    setSalesRecoveryFound(hasRecoverableShiftState());
    return () => {
      cancelled = true;
    };
  }, [branchName, roleName, staffName, terminalName]);

  useEffect(() => {
    logEvent('CART_HEADER_RENDERED', `Cart header rendered for ${staffName} at ${terminalName}.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cart.length === 0) return;
    logEvent('CART_TOTALS_UPDATED', `Cart totals updated. Total ${money(grandTotal)}.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal, taxTotal, parsedDeliveryFee, cartDiscountAmount, creditRedemptionAmount, loyaltyRedemptionAmount, paymentReceived, grandTotal]);

  const eventTitle = (eventType: string): string => {
    const titles: Record<string, string> = {
      PRODUCT_ADDED_TO_CART: 'Product Added',
      PRODUCT_REMOVED_FROM_CART: 'Product Removed',
      SALE_BLOCKED_ZERO_STOCK: 'Sale Blocked: Zero Stock',
      CUSTOMER_CREATED_PENDING: 'Customer Request Created',
      PAYMENT_METHOD_SELECTED: 'Payment Added',
      SALE_HELD: 'Sale Held',
      HELD_SALE_REOPENED: 'Held Sale Reopened',
      RECENT_RECEIPT_OPENED_FOR_REVIEW: 'Receipt Opened For Review',
      TRANSACTION_RESUMED: 'Sale Resumed',
      SALE_CANCELLED: 'Sale Cancelled',
      SALE_COMPLETED: 'Sale Completed',
      RECEIPT_DRAFTED: 'Receipt Drafted',
      SALE_BLOCKED_SHIFT_OR_TERMINAL: 'Sale Blocked: Terminal or Shift',
      CUSTOMER_SELECTED_FOR_SALE: 'Customer Selected for Sale',
      SALES_DISCOUNT_APPLIED: 'Discount Applied',
      CUSTOMER_CREDIT_REDEEMED_LOCAL: 'Customer Credit Redeemed',
      LOYALTY_POINTS_REDEEMED_LOCAL: 'Loyalty Redeemed',
      LOYALTY_POINTS_EARNED_ESTIMATE: 'Loyalty Earned Estimate',
      CUSTOMER_ACCOUNT_VIEWED_FROM_SALE: 'Customer Account Viewed',
      SALE_CART_VOIDED: 'Cart Voided',
      SALES_WORKSPACE_CLEARED: 'Workspace Cleared',
      SALE_CART_NOTE_UPDATED: 'Cart Notes Updated',
      RECEIPT_REPRINT_PREPARED: 'Receipt Reprint Prepared',
      RECEIPT_DUPLICATED_TO_NEW_CART: 'Receipt Duplicated',
      PAYMENT_LINE_ADDED: 'Payment Added',
      PAYMENT_LINE_REMOVED: 'Payment Removed',
      PAYMENT_DRAFT_CLEARED: 'Payment Draft Cleared',
      CUSTOMER_DETAILS_UPDATED: 'Customer Details Updated',
      NEW_CUSTOMER_REQUEST_CREATED_FROM_SALE: 'New Customer Request',
      DELIVERY_DETAILS_UPDATED: 'Delivery Details Updated',
      IDELIVER_REQUEST_PREPARED_LOCAL: 'iDeliver Request Prepared',
      DELIVERY_CODE_GENERATED: 'Delivery Code Generated',
      WHATSAPP_DELIVERY_MESSAGE_PREPARED: 'WhatsApp Message Prepared',
      SALES_PRODUCT_FILTERS_APPLIED: 'Product Filters Applied',
      SALES_PRODUCT_FIELDS_UPDATED: 'Product Fields Updated',
      SALES_FIELDS_CARD_OPENED: 'Fields Card Opened',
      SALES_FIELDS_CARD_COLLAPSED: 'Fields Card Collapsed',
      SALES_FIELDS_DEFAULTS_RESTORED: 'Default Fields Restored',
      CAT_FORM_OPENED_LOCAL: 'CAT Form Opened',
      CHECKOUT_STARTED_FROM_CART_ITEMS: 'Checkout Started',
      CHECKOUT_BUTTON_CLICKED: 'Checkout Button Clicked',
      CHECKOUT_VALIDATION_FAILED: 'Checkout Validation Failed',
      CHECKOUT_DELIVERY_REQUIRED: 'Checkout Delivery Required',
      CHECKOUT_DELIVERY_SKIPPED: 'Checkout Delivery Skipped',
      CHECKOUT_DELIVERY_REVIEW_OPENED: 'Checkout Delivery Review',
      CHECKOUT_DELIVERY_SAVED: 'Checkout Delivery Saved',
      CHECKOUT_IDELIVER_REQUEST_PREPARED: 'Checkout iDeliver Prepared',
      CHECKOUT_PAYMENT_OPENED: 'Checkout Payment Opened',
      CHECKOUT_DELIVERY_STEP_OPENED: 'Checkout Delivery Step Opened',
      CHECKOUT_PAYMENT_STEP_OPENED: 'Checkout Payment Step Opened',
      CHECKOUT_PAYMENT_ADDED: 'Checkout Payment Added',
      CHECKOUT_COMPLETE_TRANSACTION_CLICKED: 'Checkout Complete Clicked',
      CART_HEADER_RENDERED: 'Cart Header Rendered',
      CART_TOTALS_UPDATED: 'Cart Totals Updated',
      CHECKOUT_BACK_TO_CART: 'Checkout Back to Cart',
      CHECKOUT_BACK_TO_DELIVERY: 'Checkout Back to Delivery',
      CHECKOUT_COMPLETED: 'Checkout Completed',
      TERMINAL_INVENTORY_SALES_BLOCKED: 'Inventory Sales Blocked',
      MISCELLANEOUS_SALE_MODAL_OPENED: 'Miscellaneous Sale Opened',
      MISCELLANEOUS_SALE_LINE_ADDED: 'Miscellaneous Sale Added',
      MISCELLANEOUS_SALE_BI_FLAG_CREATED: 'Miscellaneous Sale BI Flag Created',
      MISCELLANEOUS_SALE_REVIEW_REQUIRED: 'Miscellaneous Sale Review Required',
      SALE_COMPLETED_WITH_MISCELLANEOUS_LINE: 'Sale Completed With Miscellaneous Line'
    };
    return titles[eventType] || eventType.toLowerCase().split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const collapseProductFieldsForOperation = (operation: string) => {
    setCollapseFieldsSignal((current) => current + 1);
    logEvent('SALES_FIELDS_CARD_COLLAPSED', `Product fields card collapsed for ${operation}.`);
  };

  const clearCartState = () => {
    setCart([]);
    setPayments([]);
    setPaymentAmount('');
    setPaymentReference('');
    setDeliveryMode('No Delivery');
    setDeliveryAddress('');
    setDeliveryWhatsApp('');
    setDeliveryNotes('');
    setDeliveryFee('0');
    setDeliveryPriority('Normal');
    setDeliveryPaymentMode('Already Paid');
    setCustomerName('Walk-in Customer');
    setCustomerMode('Walk-in Customer');
    setSelectedCustomerId('');
    setCustomerPhone('');
    setCustomerWhatsApp('');
    setCustomerAddress('');
    setCustomerTaxNumber('');
    setCustomerNotes('');
    setCartDiscountAmount(0);
    setCreditRedemptionAmount(0);
    setLoyaltyRedemptionAmount(0);
    setCartInternalNote('');
    setReceiptNote('');
    setCartDeliveryNote('');
    setDeliveryFulfilmentCode('');
    setDeliveryDraftMessage('');
    setVatManuallyChanged(false);
    setVatMode(taxSetting.inclusive ? 'Inclusive' : 'Exclusive');
    setVatRate(String(taxSetting.vatRatePct ?? 0));
  };

  const filteredRecentSales = useMemo(() => recentSales.filter((sale) => matchesFreeOrderSearch(sale, recentReceiptSearch, [
    'invoiceNo',
    'customerName',
    'paymentMethod',
    'operator',
    'terminal',
    'status',
    'total',
    (row) => row.items.map((item) => item.name).join(' '),
    (row) => row.items.map((item) => item.code).join(' ')
  ])), [recentReceiptSearch, recentSales]);

  const visibleHeldSales = useMemo(() => heldSales.filter((sale) => sale.status !== 'Deleted'), [heldSales]);

  const filteredHeldSales = useMemo(() => visibleHeldSales.filter((heldSale) => matchesFreeOrderSearch(heldSale, heldSaleSearch, [
    'heldSaleNumber',
    'customerName',
    'customerPhone',
    'heldBy',
    'note',
    'status',
    'total',
    'expiryDateTime',
    (row) => row.items.map((item) => item.product.productName || item.product.name).join(' '),
    (row) => row.items.map((item) => item.product.sku || item.product.code).join(' ')
  ])), [heldSaleSearch, visibleHeldSales]);

  const filteredAuditEvents = useMemo(() => auditEvents.filter((event) => matchesFreeOrderSearch(event, activitySearch, [
    'eventType',
    'message',
    'time'
  ])), [activitySearch, auditEvents]);

  const selectedCustomer = activeCustomers.find((customer) => customer.customerId === selectedCustomerId);
  const availableCustomerCredit = customerMode === 'Walk-in Customer' ? 0 : Math.max(25, 300 - Math.abs(selectedCustomer?.currentBalance || 0));
  const availableLoyaltyPoints = customerMode === 'Walk-in Customer' ? 0 : Math.max(100, Math.floor((selectedCustomer?.currentBalance || 0) + customerName.length * 18));

  useEffect(() => {
    let cancelled = false;
    if (!creditSaleRequested || !selectedCustomerId || creditDebtAmount <= 0) {
      setCreditDecision(null);
      return;
    }
    canCustomerBuyOnCredit(selectedCustomerId, creditDebtAmount).then((decision) => {
      if (!cancelled) setCreditDecision(decision);
    }).catch(() => {
      if (!cancelled) setCreditDecision(null);
    });
    return () => {
      cancelled = true;
    };
  }, [creditDebtAmount, creditSaleRequested, selectedCustomerId]);

  const resetSaleReductions = () => {
    setCartDiscountAmount(0);
    setCreditRedemptionAmount(0);
    setLoyaltyRedemptionAmount(0);
  };

  const handleRemoveItem = (productId: string) => {
    const removedItem = cart.find((item) => item.product.id === productId);
    setCart((current) => current.filter((item) => item.product.id !== productId));
    if (removedItem) {
      logEvent('PRODUCT_REMOVED_FROM_CART', `${productSku(removedItem.product)} removed from cart.`);
    }
  };

  const handleCustomerModeChange = (mode: SalesCustomerMode) => {
    setCustomerMode(mode);
    if (mode === 'Walk-in Customer') {
      setSelectedCustomerId('');
      setCustomerName('Walk-in Customer');
      setCustomerPhone('');
      setCustomerWhatsApp('');
      setCustomerAddress('');
      setCustomerTaxNumber('');
      setCustomerNotes('');
    }
    if (mode === 'Existing Customer' && customerName === 'Walk-in Customer') {
      const firstCustomer = activeCustomers.find((customer) => customer.customerId !== 'CUST-WALKIN');
      if (firstCustomer) handleExistingCustomerSelect(firstCustomer.customerId);
    }
    if (mode === 'New Customer Request') {
      setSelectedCustomerId('');
      setCustomerName('');
    }
  };

  const handleExistingCustomerSelect = (customerId: string) => {
    const customer = activeCustomers.find((item) => item.customerId === customerId);
    setSelectedCustomerId(customerId);
    if (!customer) return;
    setCustomerName(customer.customerName);
    setCustomerPhone(customer.phone);
    setCustomerWhatsApp(customer.whatsapp);
    setCustomerAddress(customer.deliveryAddress || customer.billingAddress);
    setCustomerTaxNumber(customer.taxNumber);
    setCustomerNotes(`${customer.creditStatus}${customer.currentBalance ? ` - Balance ${money(customer.currentBalance)}` : ''}`);
    void recordCustomerSelectedForSale(customer.customerId, staffName);
    logEvent('CUSTOMER_SELECTED_FOR_SALE', `${customer.customerName} selected for sale.`);
  };

  const applyBridgeCustomerToSale = async (bridgeCustomer: SelectedCustomerForSaleBridge) => {
    const customer = activeCustomers.find((item) => item.customerId === bridgeCustomer.customerId);
    setCustomerMode('Existing Customer');
    setSelectedCustomerId(bridgeCustomer.customerId);
    setCustomerName(customer?.customerName || bridgeCustomer.customerName);
    setCustomerPhone(customer?.phone || bridgeCustomer.phone || '');
    setCustomerWhatsApp(customer?.whatsapp || bridgeCustomer.whatsapp || bridgeCustomer.phone || '');
    setCustomerAddress(customer?.deliveryAddress || customer?.billingAddress || bridgeCustomer.address || '');
    setCustomerTaxNumber(customer?.taxNumber || bridgeCustomer.taxNumber || '');
    const creditStatus = customer?.creditStatus || bridgeCustomer.creditStatus;
    const balance = customer?.currentBalance;
    setCustomerNotes(`${creditStatus || 'Customer loaded'}${balance ? ` - Balance ${money(balance)}` : bridgeCustomer.creditLimit ? ` - Limit ${money(bridgeCustomer.creditLimit)}` : ''}`);
    clearSelectedCustomerForSaleBridge();
    setPendingBridgeCustomer(null);
    setStatusMessage('Customer loaded for sale.');
    logEvent('CUSTOMER_LOADED_FROM_CUSTOMER_CENTRE', `${bridgeCustomer.customerName} loaded from Customer Centre.`);
    await recordCustomerSaleBridgeEvent(bridgeCustomer.customerId, staffName, 'CUSTOMER_LOADED_FROM_CUSTOMER_CENTRE', 'Customer loaded into Sales Terminal cart from Customer Centre selection.');
  };

  useEffect(() => {
    if (bridgeCustomerChecked || activeCustomers.length === 0) return;
    const bridgeCustomer = readSelectedCustomerForSaleBridge();
    setBridgeCustomerChecked(true);
    if (!bridgeCustomer) return;
    const currentHasDifferentCustomer = customerMode !== 'Walk-in Customer' && selectedCustomerId && selectedCustomerId !== bridgeCustomer.customerId;
    if (currentHasDifferentCustomer) {
      setPendingBridgeCustomer(bridgeCustomer);
      setStatusMessage('A customer from Customer Centre is ready for this sale.');
      return;
    }
    void applyBridgeCustomerToSale(bridgeCustomer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCustomers.length, bridgeCustomerChecked]);

  const handleSaveCustomerRequest = async () => {
    if (!canPerformAction(roleName, 'customers.createRequest')) {
      setStatusMessage('You do not have permission to perform this action.');
      return;
    }
    const created = await createCustomerRequest({
      customerName: customerName || 'Pending Customer',
      phone: customerPhone,
      whatsapp: customerWhatsApp,
      taxNumber: customerTaxNumber,
      billingAddress: customerAddress,
      deliveryAddress: customerAddress,
      notes: customerNotes,
      source: 'Sales Terminal',
      requestedByStaffId: staffName,
      requestedByStaffName: staffName,
      requestedByRole: roleName
    });
    logEvent('NEW_CUSTOMER_REQUEST_CREATED_FROM_SALE', `${created.customerName} customer request saved.`);
    const network = await getNetworkStatus();
    if (network === 'Offline' || network === 'Unstable') {
      await enqueueOfflineAction({
        vendorId,
        branchId: branchIdFromName(branchName),
        terminalId: terminalName,
        staffId: staffName,
        staffName,
        entityType: 'Customer Request',
        entityId: created.customerId,
        entityNumber: created.customerCode,
        operationType: 'CREATE_CUSTOMER_REQUEST',
        payload: { customerId: created.customerId, customerName: created.customerName, phone: created.phone, status: created.status },
        status: 'Queued',
        notes: 'Customer request saved and queued for sync.'
      });
      await enqueueOfflineAction({
        vendorId,
        branchId: branchIdFromName(branchName),
        terminalId: terminalName,
        staffId: staffName,
        staffName,
        entityType: 'Approval Request',
        entityId: created.customerId,
        entityNumber: created.customerCode,
        operationType: 'CREATE_APPROVAL_REQUEST',
        payload: { approvalType: 'CUSTOMER_REQUEST', customerId: created.customerId, status: 'Pending Approval' },
        status: 'Queued',
        notes: 'Approval request queued for customer request.'
      });
    }
    try {
      await biEventService.recordBIEvent({
        eventType: 'CUSTOMER_CREATED_PENDING',
        operator: staffName,
        terminal: terminalName,
        severity: 'INFO',
        payload: { customerId: created.customerId, customerName: created.customerName, status: created.status }
      });
    } catch {
      logEvent('CUSTOMER_CREATED_PENDING_BI_SKIPPED', 'Customer business insight update was skipped safely.');
    }
    setStatusMessage(network === 'Offline' || network === 'Unstable' ? 'Customer request saved and queued for sync.' : 'Customer request created and sent for approval.');
    getCustomers({ status: 'Active' }).then(setActiveCustomers).catch(() => undefined);
  };

  const handleBlockedProduct = (product: Product) => {
    const message = canSellInventoryItems ? 'Cannot add product. Stock is not available.' : inventoryBlockedMessage;
    logEvent('SALE_BLOCKED_ZERO_STOCK', `${message} ${productSku(product)} ${productName(product)}.`);
    setStatusMessage(message);
  };

  const handleAddProduct = (product: Product) => {
    if (!canSellInventoryItems) {
      setStatusMessage(inventoryBlockedMessage);
      logEvent('TERMINAL_INVENTORY_SALES_BLOCKED', inventoryBlockedMessage);
      return;
    }
    const currentProduct = localProducts.find((item) => item.id === product.id) || product;
    const availableStock = productStock(currentProduct);
    if (availableStock <= 0) {
      handleBlockedProduct(currentProduct);
      return;
    }

    setCart((current) => {
      const existing = current.find((item) => item.product.id === currentProduct.id);
      if (existing) {
        if (existing.quantity + 1 > availableStock) {
          setStatusMessage('Cannot add more. Available stock limit reached.');
          return current;
        }
        return current.map((item) => item.product.id === currentProduct.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...current, { product: currentProduct, quantity: 1, discount: 0, lineType: 'InventoryItem', isInventoryAsset: true, inventoryProductId: currentProduct.id, sku: productSku(currentProduct), stockMovementRequired: true }];
    });
    logEvent('PRODUCT_ADDED_TO_CART', `${productSku(currentProduct)} added to cart.`);
  };

  const handleOpenMiscellaneousSale = () => {
    collapseProductFieldsForOperation('Miscellaneous Sale');
    setWorkspaceMenuOpen(false);
    if (!canCreateMiscellaneousSale) {
      setStatusMessage('You do not have permission to add miscellaneous sales.');
      return;
    }
    setMiscSaleOpen(true);
    logEvent('MISCELLANEOUS_SALE_MODAL_OPENED', 'Miscellaneous sale modal opened.');
  };

  const handleAddMiscellaneousSale = async (payload: MiscellaneousSalePayload) => {
    const product: Product = {
      id: makeId('MISC'),
      code: 'MISC-SALE',
      sku: 'MISC-SALE',
      name: payload.description,
      productName: payload.description,
      category: 'Miscellaneous',
      productCategory: 'Miscellaneous',
      stock: 0,
      unit: 'Each',
      qtyOnHand: 0,
      availableStock: 0,
      minStock: 0,
      price: payload.unitPrice,
      sellingPrice: payload.unitPrice,
      cost: 0,
      costPrice: 0,
      branch: branchName,
      branchId: branchIdFromName(branchName),
      warehouse: warehouseName,
      warehouseId: warehouseName,
      taxRate: payload.taxable ? payload.vatRate : 0
    } as Product;
    setCart((current) => [...current, {
      product,
      quantity: payload.quantity,
      discount: 0,
      overriddenPrice: payload.unitPrice,
      lineType: 'MiscellaneousItem',
      isInventoryAsset: false,
      inventoryProductId: undefined,
      sku: 'MISC-SALE',
      miscReason: payload.reason,
      miscNotes: [payload.notes, payload.customerRequestReference ? `Reference: ${payload.customerRequestReference}` : ''].filter(Boolean).join(' | '),
      requiresManagementReview: true,
      biFlagged: true,
      stockMovementRequired: false,
      taxable: payload.taxable,
      vatRate: payload.vatRate
    }]);
    const amount = payload.quantity * payload.unitPrice;
    const advice = await createMiscellaneousSaleAdvice({
      description: payload.description,
      amount,
      quantity: payload.quantity,
      reason: payload.reason,
      staffName,
      terminalName,
      branchName,
      notes: payload.notes
    });
    await routeBIAdviceToDesk(advice);
    setMiscSaleOpen(false);
    setStatusMessage('Miscellaneous sale item added and flagged for management review.');
    logEvent('MISCELLANEOUS_SALE_LINE_ADDED', `${payload.description} added as MISC-SALE for ${money(amount)}.`);
    logEvent('MISCELLANEOUS_SALE_BI_FLAG_CREATED', 'BI Advice Flow warning created for miscellaneous sale.');
    logEvent('MISCELLANEOUS_SALE_REVIEW_REQUIRED', 'Manager review required for non-inventory sale line.');
  };

  const handleQuantityChange = (productId: string, delta: number) => {
    setCart((current) => current.flatMap((item) => {
      if (item.product.id !== productId) return [item];
      if (item.lineType === 'MiscellaneousItem') return [{ ...item, quantity: Math.max(1, item.quantity + delta) }];
      const availableStock = productStock(localProducts.find((product) => product.id === productId) || item.product);
      const nextQuantity = item.quantity + delta;
      if (nextQuantity < 1) return [item];
      if (nextQuantity > availableStock) {
        setStatusMessage('Cannot add more. Available stock limit reached.');
        return [item];
      }
      return [{ ...item, quantity: nextQuantity }];
    }));
  };

  const handleQuantitySet = (productId: string, quantity: number) => {
    const requestedQuantity = Math.max(1, Math.floor(quantity || 1));
    setCart((current) => current.map((item) => {
      if (item.product.id !== productId) return item;
      if (item.lineType === 'MiscellaneousItem') return { ...item, quantity: requestedQuantity };
      const availableStock = productStock(localProducts.find((product) => product.id === productId) || item.product);
      if (requestedQuantity > availableStock) {
        setStatusMessage('Cannot set quantity above available stock.');
        return item;
      }
      return { ...item, quantity: requestedQuantity };
    }));
  };

  const handleApplyLineDiscount = (productId: string) => {
    if (!canPerformAction(roleName, 'sales.discount')) {
      setStatusMessage('Current role cannot apply line discounts.');
      return;
    }
    setCart((current) => current.map((item) => item.product.id === productId ? { ...item, discount: item.discount > 0 ? 0 : 5 } : item));
    logEvent('SALES_DISCOUNT_APPLIED', 'Line discount updated.');
  };

  const handleApplyCartDiscount = (payload: SalesDiscountPayload) => {
    if (!canPerformAction(roleName, 'sales.discount')) {
      setStatusMessage('You do not have permission to apply discounts.');
      return;
    }
    if (payload.scope === 'Line' && payload.productId) {
      setCart((current) => current.map((item) => {
        if (item.product.id !== payload.productId) return item;
        const lineBase = (item.overriddenPrice ?? productPrice(item.product)) * item.quantity;
        const discountPercent = payload.type === 'Percentage'
          ? Math.min(100, payload.value)
          : Math.min(100, (Math.min(payload.value, lineBase) / Math.max(lineBase, 1)) * 100);
        return { ...item, discount: Number(discountPercent.toFixed(2)) };
      }));
    } else {
      const nextDiscount = payload.type === 'Percentage'
        ? subtotal * (Math.min(100, payload.value) / 100)
        : payload.value;
      setCartDiscountAmount(Math.min(subtotal, Math.max(0, nextDiscount)));
    }
    const highDiscount = payload.type === 'Percentage' ? payload.value >= 15 : payload.value >= subtotal * 0.15;
    setStatusMessage(highDiscount ? 'Discount applied. Manager approval warning recorded.' : 'Discount applied.');
    logEvent('SALES_DISCOUNT_APPLIED', `${payload.scope} discount applied. Reason: ${payload.reason}.`);
  };

  const handleRedeemCredit = (payload: SalesCreditRedemptionPayload) => {
    if (!canPerformAction(roleName, 'sales.creditRedeem') && !canPerformAction(roleName, 'customers.creditView')) {
      setStatusMessage('You do not have permission to redeem customer credit.');
      return;
    }
    if (customerMode === 'Walk-in Customer') {
      setStatusMessage('Select a customer before redeeming credit.');
      return;
    }
    const maxRedeem = Math.min(availableCustomerCredit, grandTotalBeforeCredit);
    const amount = Math.min(maxRedeem, Math.max(0, payload.amount));
    setCreditRedemptionAmount(amount);
    setStatusMessage(`Customer credit redeemed for ${money(amount)}.`);
    logEvent('CUSTOMER_CREDIT_REDEEMED_LOCAL', `${money(amount)} redeemed with reference ${payload.reference}.`);
  };

  const handleRedeemLoyalty = (payload: SalesLoyaltyRedemptionPayload) => {
    if (!canPerformAction(roleName, 'sales.loyalty')) {
      setStatusMessage('You do not have permission to redeem loyalty rewards.');
      return;
    }
    if (customerMode === 'Walk-in Customer') {
      setStatusMessage('Select a customer before redeeming loyalty rewards.');
      return;
    }
    const points = Math.min(availableLoyaltyPoints, Math.max(0, payload.points));
    const amount = Math.min(grandTotalBeforeCredit, payload.value || points * 0.01);
    setLoyaltyRedemptionAmount(amount);
    setStatusMessage(`Loyalty rewards redeemed for ${money(amount)}.`);
    logEvent('LOYALTY_POINTS_REDEEMED_LOCAL', `${points} point(s) redeemed.`);
    logEvent('LOYALTY_POINTS_EARNED_ESTIMATE', `${Math.floor(grandTotal)} point(s) estimated from this sale.`);
  };

  const handleApplyAccountPayment = () => {
    if (!canPerformAction(roleName, 'sales.creditSale')) {
      setStatusMessage('You do not have permission to sell on credit.');
      return;
    }
    if (customerMode === 'Walk-in Customer') {
      setStatusMessage('Select a registered customer before selling on credit.');
      return;
    }
    if (!selectedCustomerId) {
      setStatusMessage('Select a customer before choosing Credit / Account.');
      return;
    }
    setPaymentMethod('Credit / Account');
    setStatusMessage('Customer account payment method applied.');
    logEvent('CUSTOMER_ACCOUNT_VIEWED_FROM_SALE', `${customerName} account viewed and applied to sale.`);
  };

  const handleAddPayment = () => {
    if (!canPerformAction(roleName, 'payment.capture') && !canPerformAction(roleName, 'sales.complete')) {
      setStatusMessage('You do not have permission to capture payment.');
      return;
    }
    if (paymentMethod === 'Credit / Account' && customerMode === 'Walk-in Customer') {
      setStatusMessage('Select a customer account before capturing account payment.');
      return;
    }
    if (paymentMethod === 'Credit / Account') {
      if (!canPerformAction(roleName, 'sales.creditSale')) {
        setStatusMessage('You do not have permission to sell on credit.');
        return;
      }
      if (creditDecision?.decision === 'Blocked') {
        setStatusMessage(`Credit sale blocked. ${creditDecision.reasonList.join(' ')}`);
        return;
      }
      if (creditDecision?.decision === 'Requires Approval' && !canPerformAction(roleName, 'sales.creditSale.override')) {
        setStatusMessage(`Credit sale requires Owner/Manager approval. ${creditDecision.reasonList.join(' ')}`);
        void createCustomerCreditApprovalRequest({
          customerName,
          requestedBy: staffName,
          requestedByRole: roleName,
          approvalType: creditDecision.reasonList.some((reason) => reason.toLowerCase().includes('overdue')) ? 'OVERDUE_CUSTOMER_OVERRIDE' : 'CREDIT_SALE_OVERRIDE',
          branchId: branchIdFromName(branchName),
          branch: branchName,
          relatedRecord: selectedCustomerId || customerName,
          amountOrValue: money(creditDebtAmount),
          risk: 'High',
          reason: 'Risky credit sale requires approval.',
          context: creditDecision.reasonList.join(' ')
        });
        return;
      }
      setPayments((current) => current.some((payment) => payment.method === 'Credit / Account') ? current : [{
        id: makeId('PAY'),
        method: paymentMethod,
        amount: 0,
        reference: paymentReference.trim() || `Account balance ${money(creditDebtAmount)}`
      }, ...current]);
      setPaymentAmount('');
      setPaymentReference('');
      logEvent('PAYMENT_CAPTURED', `Account credit line added for balance ${money(creditDebtAmount)}.`);
      return;
    }
    if (paymentMethod === 'Already Paid' && paymentReference.trim().length === 0) {
      setStatusMessage('Already Paid requires a payment note or reference.');
      return;
    }
    if (paymentMethod === 'No Payment Due' && grandTotal > 0) {
      setStatusMessage('No Payment Due is only available for zero-balance sales.');
      return;
    }
    const amount = Number(paymentAmount);
    if (paymentMethod === 'No Payment Due' && grandTotal === 0) {
      setPayments((current) => [{
        id: makeId('PAY'),
        method: paymentMethod,
        amount: 0,
        reference: paymentReference.trim() || 'Zero balance sale'
      }, ...current]);
      setPaymentAmount('');
      setPaymentReference('');
      logEvent('PAYMENT_CAPTURED', 'No Payment Due line added for zero-balance sale.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setStatusMessage('Enter a payment amount above zero.');
      return;
    }
    if (amount > balanceDue && paymentMethod !== 'Cash') {
      setStatusMessage('Payment amount exceeds balance. Use Cash for tender/change or reduce the amount.');
      return;
    }
    if (paymentReferenceRequired.has(paymentMethod) && paymentReference.trim().length === 0) {
      setStatusMessage(`${paymentMethod} requires a payment reference.`);
      return;
    }
    setPayments((current) => [{
      id: makeId('PAY'),
      method: paymentMethod,
      amount,
      reference: paymentReference.trim() || undefined
    }, ...current]);
    setPaymentAmount('');
    setPaymentReference('');
    logEvent('PAYMENT_CAPTURED', `${paymentMethod} payment captured for ${money(amount)}.`);
    logEvent('PAYMENT_LINE_ADDED', `${paymentMethod} payment added for ${money(amount)}.`);
  };

  const validateSale = (): string | null => {
    if (!canPerformAction(roleName, 'sales.complete')) return 'You do not have permission to complete a sale.';
    if (cart.length === 0) return 'Cart is empty.';
    const insufficientLine = cart.find((item) => {
      if (item.lineType === 'MiscellaneousItem' || item.isInventoryAsset === false || item.stockMovementRequired === false) return false;
      const currentProduct = localProducts.find((product) => product.id === item.product.id) || item.product;
      return productStock(currentProduct) < item.quantity;
    });
    if (insufficientLine) return `Insufficient stock for ${productName(insufficientLine.product)}.`;
    if (creditSaleRequested) {
      if (!canPerformAction(roleName, 'sales.creditSale')) return 'You do not have permission to sell on credit.';
      if (customerMode === 'Walk-in Customer') return 'Select a registered customer before selling on credit.';
      if (!selectedCustomerId) return 'Select a customer before choosing Credit / Account.';
      if (!creditDecision) return 'Credit decision is still loading. Try again in a moment.';
      if (creditDecision.decision === 'Blocked') return `Credit sale blocked. ${creditDecision.reasonList.join(' ')}`;
      if (creditDecision.decision === 'Requires Approval' && !canPerformAction(roleName, 'sales.creditSale.override')) return `Credit sale requires approval. ${creditDecision.reasonList.join(' ')}`;
    }
    if (!creditSaleAllowed && !creditSaleOverrideAllowed && paymentReceived < grandTotal) return 'Payment is under the sale total.';
    if ((paymentMethod === 'Already Paid' || payments.some((payment) => payment.method === 'Already Paid')) && !paymentReference.trim() && !payments.some((payment) => payment.method === 'Already Paid' && payment.reference)) return 'Already Paid requires a payment note or reference.';
    if ((paymentMethod === 'No Payment Due' || payments.some((payment) => payment.method === 'No Payment Due')) && grandTotal > 0) return 'No Payment Due is only available for zero-balance sales.';
    return null;
  };

  const handleCompleteSale = async (): Promise<boolean> => {
    collapseProductFieldsForOperation('Complete Sale');
    setPreparedReceiptPreview(null);
    setReceiptOutputPreview(null);
    const validationMessage = validateSale();
    if (validationMessage) {
      setStatusMessage(validationMessage);
      return false;
    }

    const salePayment = payments[0]?.method || paymentMethod;
    const requiresCashDrawer = salePayment === 'Cash' || payments.some((payment) => payment.method === 'Cash');
    const hasInventoryLines = cart.some((item) => item.lineType !== 'MiscellaneousItem' && item.isInventoryAsset !== false && item.stockMovementRequired !== false);
    const hasMiscellaneousLines = cart.some((item) => item.lineType === 'MiscellaneousItem' || item.biFlagged);
    const controlCheck = await runTerminalControlCheck({
      vendorId,
      branchId: branchIdFromName(branchName),
      terminalId: terminalName,
      terminalName,
      staffId: staffName,
      staffName,
      role: roleName,
      requiresCashDrawer
    });
    if (!controlCheck.allowed && hasInventoryLines) {
      const reason = controlCheck.message || 'Sale cannot be completed because the terminal or shift is not active.';
      setStatusMessage(reason);
      logEvent('SALE_BLOCKED_SHIFT_OR_TERMINAL', reason);
      await logTerminalControlEvent({
        vendorId,
        branchId: branchIdFromName(branchName),
        terminalId: terminalName,
        staffId: staffName,
        staffName,
        eventType: 'SALE_BLOCKED_SHIFT_OR_TERMINAL',
        message: reason,
        severity: 'WARNING'
      });
      try {
        await biEventService.recordBIEvent({
          eventType: 'SALE_BLOCKED_SHIFT_OR_TERMINAL',
          operator: staffName,
          terminal: terminalName,
          severity: 'WARNING',
          payload: { reason, reasons: controlCheck.reasons }
        });
      } catch {
        logEvent('SALE_BLOCKED_SHIFT_OR_TERMINAL_BI_SKIPPED', 'Blocked sale business insight update was skipped safely.');
      }
      return false;
    }

    const now = new Date().toISOString();
    const invoiceNo = `INV-${Date.now().toString().slice(-8)}`;
    const sale: Sale = {
      id: makeId('TXN'),
      invoiceNo,
      date: now,
      operator: staffName,
      customerName,
      customerId: selectedCustomerId || undefined,
      customerCode: selectedCustomer?.customerCode,
      customerPhone: customerPhone || selectedCustomer?.phone,
      branch: branchName,
      terminal: terminalName,
      items: cart.map((item) => ({
        productId: item.product.id,
        name: productName(item.product),
        code: item.sku || productSku(item.product),
        quantity: item.quantity,
        price: item.overriddenPrice ?? productPrice(item.product),
        total: cartLineTotal(item),
        unitCost: item.product.costPrice ?? item.product.cost,
        costPrice: item.product.costPrice ?? item.product.cost,
        lineType: item.lineType,
        isInventoryAsset: item.isInventoryAsset !== false,
        requiresManagementReview: item.requiresManagementReview,
        biFlagged: item.biFlagged
      })),
      subtotal,
      tax: taxTotal,
      discount: lineDiscountTotal + cartDiscountAmount + creditRedemptionAmount + loyaltyRedemptionAmount,
      total: grandTotal,
      paymentMethod: salePaymentMethod(payments[0]?.method || paymentMethod),
      cashReceived: paymentReceived,
      changeGiven: changeDue,
      status: 'COMPLETED'
    };
    let saleQueuedLocally = false;
    let deliveryQueuedLocally = false;

    try {
      onAddTransaction({
        operator: sale.operator,
        customerName: sale.customerName,
        customerId: sale.customerId,
        customerCode: sale.customerCode,
        customerPhone: sale.customerPhone,
        branch: sale.branch,
        terminal: sale.terminal,
        items: sale.items,
        subtotal: sale.subtotal,
        tax: sale.tax,
        discount: sale.discount,
        total: sale.total,
        paymentMethod: sale.paymentMethod,
        cashReceived: sale.cashReceived,
        changeGiven: sale.changeGiven,
        status: sale.status
      });

      await Promise.all(cart.filter((item) => item.lineType !== 'MiscellaneousItem' && item.isInventoryAsset !== false && item.stockMovementRequired !== false).map((item) => {
        const currentProduct = localProducts.find((product) => product.id === item.product.id) || item.product;
        const balanceBefore = productStock(currentProduct);
        return postSaleMovement({
          vendorId,
          branchId: currentProduct.branchId || branchIdFromName(branchName),
          warehouseId: currentProduct.warehouseId || currentProduct.warehouse || warehouseName,
          productId: currentProduct.id,
          sku: productSku(currentProduct),
          alu: currentProduct.alu,
          productNumericNumber: currentProduct.productNumericNumber,
          productName: productName(currentProduct),
          shelfLocation: currentProduct.shelfLocation,
          qtyIn: 0,
          qtyOut: item.quantity,
          balanceBefore,
          balanceAfter: Math.max(0, balanceBefore - item.quantity),
          unitCost: currentProduct.costPrice ?? currentProduct.cost,
          sellingPrice: item.overriddenPrice ?? productPrice(currentProduct),
          salesAccountCOA: currentProduct.salesAccountCOA,
          assetAccountCOA: currentProduct.assetAccountCOA,
          staffId: staffName,
          staffName,
          terminalId: terminalName,
          movementDate: now,
          referenceNumber: invoiceNo,
          notes: 'Sale completed from Sales Terminal.',
          riskFlag: 'None',
          approvalRequired: false,
          status: 'Posted'
        });
      }));

      await recordCOGSRecoveryFromSale(sale);

      cart.filter((item) => item.lineType !== 'MiscellaneousItem' && item.isInventoryAsset !== false && item.stockMovementRequired !== false).forEach((item) => onProductStockChange(item.product.id, item.quantity));
      setLocalProducts((current) => current.map((product) => {
        const soldLine = cart.find((item) => item.product.id === product.id && item.lineType !== 'MiscellaneousItem' && item.isInventoryAsset !== false && item.stockMovementRequired !== false);
        return soldLine ? {
          ...product,
          stock: Math.max(0, product.stock - soldLine.quantity),
          qtyOnHand: Math.max(0, (product.qtyOnHand ?? product.stock) - soldLine.quantity),
          availableStock: Math.max(0, productStock(product) - soldLine.quantity)
        } : product;
      }));

      const selectedCustomer = activeCustomers.find((customer) => customer.customerId === selectedCustomerId);
      const nonCreditPaymentLines = payments.filter((payment) => payment.method !== 'Credit / Account');
      const receiptPaymentLines = creditSaleRequested
        ? [
            ...nonCreditPaymentLines.map((payment) => ({ method: payment.method, amount: payment.amount, reference: payment.reference })),
            { method: 'Credit / Account', amount: 0, reference: `Balance due ${money(creditDebtAmount)}` }
          ]
        : payments.length > 0
          ? payments.map((payment) => ({ method: payment.method, amount: payment.amount, reference: payment.reference }))
          : [{ method: paymentMethod, amount: grandTotal, reference: paymentReference.trim() || undefined }];
      const receipt = await createReceiptFromSale({
        sale,
        vendorId,
        businessVendor: vendorName,
        branchId: branchIdFromName(branchName),
        branch: branchName,
        terminalId: terminalName,
        terminal: terminalName,
        cashierId: staffName,
        cashier: staffName,
        customerId: selectedCustomer?.customerId,
        customerName,
        customerPhone,
        customerWhatsApp,
        customerTaxNumber,
        customerBillingAddress: selectedCustomer?.billingAddress || customerAddress,
        customerDeliveryAddress: deliveryAddress || selectedCustomer?.deliveryAddress || customerAddress,
        customerCreditStatus: selectedCustomer?.creditStatus,
        paymentMode: creditSaleRequested ? 'Credit Sale' : receiptPaymentMode(payments[0]?.method || paymentMethod),
        paymentLines: receiptPaymentLines,
        creditDetails: creditSaleRequested && creditDecision ? {
          paymentType: 'Account / Credit',
          paidAmount: nonCreditPaymentReceived,
          balanceDue: creditDebtAmount,
          dueDate: creditDecision.dueDate,
          creditTermsDays: creditDecision.profile.paymentTermsDays,
          outstandingAccountBalance: creditDecision.newBalance,
          reminderNote: 'Please settle your account balance by the due date.'
        } : undefined,
        vatMode,
        vatRate: parsedVatRate
      });
      if (creditSaleRequested && selectedCustomer && creditDebtAmount > 0 && creditDecision) {
        await createCustomerDebtFromCreditSale({
          customerId: selectedCustomer.customerId,
          customerName,
          receiptId: receipt.id,
          receiptNumber: receipt.receiptNumber,
          saleId: sale.id,
          saleDate: now,
          saleTotal: grandTotal,
          paidAmount: nonCreditPaymentReceived,
          creditAmount: creditDebtAmount,
          branchId: branchIdFromName(branchName),
          branchName,
          terminalId: terminalName,
          cashierStaffId: staffName,
          paymentTermsDays: creditDecision.profile.paymentTermsDays,
          notes: creditSaleOverrideAllowed ? 'Credit sale completed with manager override.' : 'Credit sale completed within account rules.'
        });
        if (creditSaleOverrideAllowed) {
          await createCustomerCreditApprovalRequest({
            customerName,
            requestedBy: staffName,
            requestedByRole: roleName,
            approvalType: creditDecision.reasonList.some((reason) => reason.toLowerCase().includes('overdue')) ? 'OVERDUE_CUSTOMER_OVERRIDE' : 'CREDIT_SALE_OVERRIDE',
            branchId: branchIdFromName(branchName),
            branch: branchName,
            relatedRecord: receipt.receiptNumber,
            amountOrValue: money(creditDebtAmount),
            risk: 'High',
            reason: 'Credit override used at Sales Terminal.',
            context: creditDecision.reasonList.join(' ')
          });
        }
        if (creditDecision.profile.overdueBalance > 0) {
          await createCustomerCreditBIAdvice('OVERDUE_CUSTOMER_TRYING_TO_BUY', customerName, `${customerName} has overdue balance before new credit sale.`, 'High');
        }
      }
      const network = await getNetworkStatus();
      const shouldQueueOffline = network === 'Offline' || network === 'Unstable';
      const queueStatus = shouldQueueOffline ? 'Queued' : 'Ready To Sync';
      await enqueueOfflineAction({
        vendorId,
        branchId: branchIdFromName(branchName),
        terminalId: terminalName,
        staffId: staffName,
        staffName,
        entityType: 'Receipt',
        entityId: receipt.id,
        entityNumber: receipt.receiptNumber,
        operationType: 'CREATE_RECEIPT',
        payload: { receiptNumber: receipt.receiptNumber, invoiceNo, total: grandTotal, paymentMode: receiptPaymentMode(payments[0]?.method || paymentMethod), offlineCompleted: shouldQueueOffline },
        status: queueStatus,
        notes: shouldQueueOffline ? 'Sale completed and queued for sync.' : 'Sale completed and ready for sync.'
      });
      await enqueueOfflineAction({
        vendorId,
        branchId: branchIdFromName(branchName),
        terminalId: terminalName,
        staffId: staffName,
        staffName,
        entityType: 'Payment',
        entityId: receipt.receiptNumber,
        entityNumber: receipt.receiptNumber,
        operationType: 'CREATE_PAYMENT',
        payload: { receiptNumber: receipt.receiptNumber, amount: creditSaleRequested ? nonCreditPaymentReceived : grandTotal, paymentMode: creditSaleRequested ? 'Credit Sale' : receiptPaymentMode(payments[0]?.method || paymentMethod), payments: receiptPaymentLines },
        status: queueStatus,
        notes: 'Payment queued for sync.'
      });
      await enqueueOfflineAction({
        vendorId,
        branchId: branchIdFromName(branchName),
        terminalId: terminalName,
        staffId: staffName,
        staffName,
        entityType: 'BI Event',
        entityId: `BI-${receipt.receiptNumber}`,
        entityNumber: receipt.receiptNumber,
        operationType: 'CREATE_BI_EVENT',
        payload: { eventType: shouldQueueOffline ? 'SALE_COMPLETED_OFFLINE' : 'SALE_COMPLETED', receiptNumber: receipt.receiptNumber, total: grandTotal },
        status: queueStatus,
        notes: 'Sales activity queued for sync.'
      });
      saleQueuedLocally = shouldQueueOffline;
      try {
        await createAccountingPostingPlaceholder({
          sourceReference: invoiceNo,
          source: 'Sale',
          branch: branchName,
          amount: grandTotal
        });
        await recordPaymentReportEvent('PAYMENT_BREAKDOWN_VIEWED', staffName);
        await biEventService.recordBIEvent({
          eventType: 'SALE_COMPLETED',
          operator: staffName,
          terminal: terminalName,
          severity: 'INFO',
          payload: {
            invoiceNo,
            total: grandTotal,
            customerName,
            paymentMethod: creditSaleRequested ? 'Credit Sale' : receiptPaymentMode(payments[0]?.method || paymentMethod)
          }
        });
        if (hasMiscellaneousLines) {
          await Promise.all(cart.filter((item) => item.lineType === 'MiscellaneousItem' || item.biFlagged).map(async (item) => {
            const advice = await createMiscellaneousSaleAdvice({
            receiptNo: invoiceNo,
            description: productName(item.product),
            amount: cartLineTotal(item),
            quantity: item.quantity,
            reason: item.miscReason || 'Miscellaneous non-inventory sale completed.',
            staffName,
            terminalName,
            branchName,
            notes: item.miscNotes
            });
            await routeBIAdviceToDesk(advice);
          }));
        }
      } catch {
        logEvent('SALE_COMPLETION_SERVICE_PENDING', 'Optional accounting, payment, or business insight update was skipped safely.');
      }
      const preview = await getReceiptPreview(receipt.receiptNumber, '80mm');
      if (!preview || preview.receipt.receiptNumber !== receipt.receiptNumber) {
        throw new Error('Receipt preview could not be created for the completed sale.');
      }
      if (deliveryMode !== 'No Delivery') {
        const deliveryRequest = await createDeliveryRequestFromReceipt({
          vendorId,
          receiptId: receipt.id,
          receiptNumber: receipt.receiptNumber,
          branchId: branchIdFromName(branchName),
          branchName,
          terminalId: terminalName,
          cashierStaffId: staffName,
          cashierStaffName: staffName,
          customerId: selectedCustomer?.customerId,
          customerName,
          customerPhone,
          customerWhatsapp: deliveryWhatsApp || customerWhatsApp || customerPhone,
          deliveryMethod: deliveryMode,
          priority: deliveryPriority,
          deliveryAddress: deliveryAddress || selectedCustomer?.deliveryAddress || customerAddress,
          deliveryNotes,
          deliveryFee: parsedDeliveryFee,
          paymentMode: deliveryPaymentMode,
          totalReceiptAmount: grandTotal,
          cashToCollect: deliveryPaymentMode === 'Cash On Delivery' ? grandTotal : deliveryPaymentMode === 'Delivery Fee Cash' ? parsedDeliveryFee : 0,
          lines: cart.map((item) => ({
            productId: item.product.id,
            sku: productSku(item.product),
            productName: productName(item.product),
            qty: item.quantity
          }))
        });
        if (deliveryRequest) {
          logEvent('DELIVERY_REQUEST_CREATED', `${deliveryRequest.deliveryNumber} prepared for ${receipt.receiptNumber}.`);
          if (shouldQueueOffline) {
            await enqueueOfflineAction({
              vendorId,
              branchId: branchIdFromName(branchName),
              terminalId: terminalName,
              staffId: staffName,
              staffName,
              entityType: 'Delivery Request',
              entityId: deliveryRequest.deliveryId,
              entityNumber: deliveryRequest.deliveryNumber,
              operationType: 'CREATE_DELIVERY_REQUEST',
              payload: { deliveryId: deliveryRequest.deliveryId, deliveryNumber: deliveryRequest.deliveryNumber, receiptNumber: receipt.receiptNumber, deliveryMethod: deliveryMode },
              status: 'Queued',
              notes: 'Delivery request queued for sync. WhatsApp draft prepared.'
            });
            deliveryQueuedLocally = true;
          }
          try {
            await biEventService.recordBIEvent({
              eventType: deliveryMode === 'iDeliver Service' ? 'IDELIVER_BROADCAST_PREPARED' : 'DELIVERY_REQUEST_CREATED',
              operator: staffName,
              terminal: terminalName,
              severity: 'INFO',
              payload: { deliveryId: deliveryRequest.deliveryId, deliveryNumber: deliveryRequest.deliveryNumber, receiptNumber: receipt.receiptNumber, deliveryMethod: deliveryMode }
            });
          } catch {
            logEvent('DELIVERY_BI_SKIPPED', 'Delivery business insight update was skipped safely.');
          }
        }
      }
      const completedSaleForReceipts = { ...sale, invoiceNo: receipt.receiptNumber };
      setPreparedReceiptPreview(preview);
      setReceiptOutputPreview(preview);
      setRecentSales((current) => [completedSaleForReceipts, ...current].slice(0, 6));
      clearCartState();
      setStatusMessage('Sale completed successfully.');
      logEvent('SALE_COMPLETED', `Sale ${invoiceNo} completed for ${money(grandTotal)}.`);
      if (hasMiscellaneousLines) logEvent('SALE_COMPLETED_WITH_MISCELLANEOUS_LINE', `Sale ${invoiceNo} included miscellaneous non-inventory line(s).`);
      logEvent('RECEIPT_GENERATED', `Receipt ${receipt.receiptNumber} generated for completed sale.`);
      if (saleQueuedLocally || deliveryQueuedLocally) logEvent('SALE_COMPLETED_SYNC_QUEUE', 'Completed sale sync queue updated.');
      return true;
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Sale completion failed.');
      return false;
    }
  };

  const handleHoldSale = async (payload?: { expiryDateTime?: string }) => {
    if (!canPerformAction(roleName, 'sales.hold')) {
      setStatusMessage('You do not have permission to hold sales.');
      return;
    }
    if (cart.length === 0) {
      setStatusMessage('Cart is empty.');
      return;
    }
    const hold = await holdCurrentSale({
      customerMode,
      selectedCustomerId,
      customerName,
      customerPhone,
      customerWhatsApp,
      customerAddress,
      customerTaxNumber,
      customerNotes,
      items: cart,
      total: grandTotal,
      heldBy: staffName,
      heldAt: new Date().toLocaleString(),
      note: paymentReference || cartInternalNote || customerNotes || deliveryNotes || 'Held from Sales Terminal.',
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
      expiryDateTime: payload?.expiryDateTime
    });
    setHeldSales(await getHeldSales());
    clearCartState();
    setStatusMessage('Sale held successfully.');
    logEvent('SALE_HELD', `Held sale ${hold.heldSaleNumber}.`);
  };

  const handleResumeHeldSale = async (heldSale: HeldSaleRecord) => {
    if (!canPerformAction(roleName, 'sales.open') && !canPerformAction(roleName, 'sales.hold')) {
      setStatusMessage('You do not have permission to reopen held sales.');
      return;
    }
    const expiryStatus = getHeldSaleExpiryStatus(heldSale.expiryDateTime);
    if (expiryStatus === 'Expired' && !canReopenExpiredHeldSale) {
      setStatusMessage('Expired — manager approval required.');
      return;
    }
    const record = await reopenHeldSale(heldSale.id);
    if (!record) {
      setStatusMessage('Held sale could not be found.');
      return;
    }
    setCart(record.items);
    setCustomerMode(record.customerMode);
    setSelectedCustomerId(record.selectedCustomerId || '');
    setCustomerName(record.customerName);
    setCustomerPhone(record.customerPhone || '');
    setCustomerWhatsApp(record.customerWhatsApp || '');
    setCustomerAddress(record.customerAddress || '');
    setCustomerTaxNumber(record.customerTaxNumber || '');
    setCustomerNotes(record.customerNotes || '');
    setPaymentMethod(record.paymentMethod);
    setPaymentAmount(record.paymentAmount || '');
    setPaymentReference(record.paymentReference || '');
    setPayments(record.payments || []);
    setDeliveryMode(record.deliveryMode);
    setDeliveryAddress(record.deliveryAddress || '');
    setDeliveryWhatsApp(record.deliveryWhatsApp || '');
    setDeliveryNotes(record.deliveryNotes || '');
    setDeliveryFee(record.deliveryFee || '0');
    setDeliveryPriority(record.deliveryPriority);
    setDeliveryPaymentMode(record.deliveryPaymentMode);
    setVatMode(record.vatMode);
    setVatRate(record.vatRate);
    await markHeldSaleResumed(record.id, staffName);
    setHeldSales(await getHeldSales());
    setStatusMessage('Held sale reopened into cart.');
    logEvent('HELD_SALE_REOPENED', `Held sale ${record.heldSaleNumber} reopened into cart.`);
  };

  const handleCancelHeldSale = async (heldSale: HeldSaleRecord) => {
    await cancelHeldSalePlaceholder(heldSale.id, staffName, 'Cancelled from Held Sales drawer');
    setHeldSales(await getHeldSales());
    setStatusMessage(`Held sale cancelled for ${heldSale.heldSaleNumber}.`);
    logEvent('SALE_CANCELLED', `Held sale ${heldSale.heldSaleNumber} cancelled.`);
  };

  const canReopenExpiredHeldSale = canPerformAction(roleName, 'sales.heldSale.reopenExpired') && ['Owner', 'SysAdmin', 'Manager'].includes(roleName);

  const canDeleteHeldSale = (heldSale: HeldSaleRecord) => {
    if (!canPerformAction(roleName, 'sales.heldSale.delete')) return false;
    if (['Owner', 'SysAdmin'].includes(roleName)) return true;
    if (['Manager', 'Supervisor'].includes(roleName)) return true;
    if (roleName === 'Cashier' && heldSale.heldBy === staffName) return true;
    return false;
  };

  const canDeleteAllHeldSales = canPerformAction(roleName, 'sales.heldSale.delete') && ['Owner', 'SysAdmin', 'Manager', 'Supervisor'].includes(roleName);

  const handleDeleteHeldSale = async (heldSale: HeldSaleRecord) => {
    if (!canDeleteHeldSale(heldSale)) {
      setStatusMessage('You do not have permission to delete this held sale.');
      return;
    }
    const confirmed = window.confirm(
      `Delete held sale ${heldSale.heldSaleNumber} for customer "${heldSale.customerName}" (${money(heldSale.total)})? This cannot be undone.`
    );
    if (!confirmed) return;
    await deleteHeldSale(heldSale.id, staffName, staffName, `Deleted from Held Sales drawer by ${staffName}`);
    setHeldSales(await getHeldSales());
    setStatusMessage(`Held sale ${heldSale.heldSaleNumber} deleted.`);
    logEvent('HELD_SALE_DELETED', `Held sale ${heldSale.heldSaleNumber} deleted. Customer: ${heldSale.customerName}, Amount: ${money(heldSale.total)}, Staff: ${staffName}.`);
  };

  const handleDeleteAllHeldSales = async () => {
    if (!canDeleteAllHeldSales) {
      setStatusMessage('You do not have permission to delete all held sales.');
      return;
    }
    const activeCount = heldSales.filter((sale) => sale.status === 'Held').length;
    if (activeCount === 0) {
      setStatusMessage('No active held sales to delete.');
      return;
    }
    const confirmed = window.confirm(
      `Are you sure you want to delete ALL ${activeCount} held sale(s)? This action cannot be undone.`
    );
    if (!confirmed) return;
    const strongConfirm = window.confirm('This will permanently remove all active held sales for this session. Confirm again?');
    if (!strongConfirm) return;
    await deleteAllHeldSales(staffName, staffName, `Bulk deleted from Held Sales drawer by ${staffName}`);
    setHeldSales(await getHeldSales());
    setStatusMessage(`All ${activeCount} held sales cleared.`);
    logEvent('HELD_SALES_CLEARED', `All held sales cleared by ${staffName}. Total: ${activeCount}.`);
  };

  const handleOpenReceiptReview = async (sale: Sale) => {
    if (!canPerformAction(roleName, 'sales.viewHistory') && !canPerformAction(roleName, 'sales.open')) {
      setStatusMessage('You do not have permission to view receipt history.');
      return;
    }
    const preview = await getReceiptPreview(sale.invoiceNo, '80mm');
    if (preview) setReceiptOutputPreview(preview);
    setReceiptReviewSale(sale);
    setStatusMessage('Receipt opened for review.');
    logEvent('RECENT_RECEIPT_OPENED_FOR_REVIEW', `Receipt ${sale.invoiceNo} opened for read-only review.`);
  };

  const handleCancelSale = () => {
    if (cart.length === 0) return;
    const confirmed = window.confirm('Cancel this sale and clear all cart items?');
    if (!confirmed) return;
    clearCartState();
    setStatusMessage('Sale cancelled.');
    logEvent('SALE_CANCELLED', 'Current sale was cancelled and cart cleared.');
  };

  const handleVoidCart = (payload: SalesVoidCartPayload) => {
    if (!canPerformAction(roleName, 'sales.void')) {
      setStatusMessage('You do not have permission to void the cart.');
      return;
    }
    if (cart.length === 0) {
      setStatusMessage('Cart is already empty.');
      return;
    }
    const keepCustomer = payload.keepCustomer;
    const preservedCustomer = { customerMode, selectedCustomerId, customerName, customerPhone, customerWhatsApp, customerAddress, customerTaxNumber, customerNotes };
    clearCartState();
    if (keepCustomer) {
      setCustomerMode(preservedCustomer.customerMode);
      setSelectedCustomerId(preservedCustomer.selectedCustomerId);
      setCustomerName(preservedCustomer.customerName);
      setCustomerPhone(preservedCustomer.customerPhone);
      setCustomerWhatsApp(preservedCustomer.customerWhatsApp);
      setCustomerAddress(preservedCustomer.customerAddress);
      setCustomerTaxNumber(preservedCustomer.customerTaxNumber);
      setCustomerNotes(preservedCustomer.customerNotes);
    }
    setStatusMessage('Cart voided.');
    logEvent('SALE_CART_VOIDED', `Cart voided. Reason: ${payload.reason}.`);
  };

  const handleClearWorkspace = (mode: SalesWorkspaceClearMode) => {
    if (mode === 'Search Only') {
      setHeldSaleSearch('');
      setRecentReceiptSearch('');
      setActivitySearch('');
    }
    if (mode === 'Cart and Draft' || mode === 'Entire Workspace') {
      clearCartState();
    }
    if (mode === 'Entire Workspace') {
      setHeldSaleSearch('');
      setRecentReceiptSearch('');
      setActivitySearch('');
      setWorkspaceDrawer(null);
      setWorkspaceMenuOpen(false);
      setReceiptPreview(null);
      setReceiptReviewSale(null);
      setPreparedReceiptPreview(null);
      setReceiptOutputPreview(null);
    }
    setStatusMessage(`${mode} cleared.`);
    logEvent('SALES_WORKSPACE_CLEARED', `${mode} cleared from Sales Terminal.`);
  };

  const handleSaveCartNotes = (payload: SalesCartNotesPayload) => {
    setCartInternalNote(payload.internalNote);
    setReceiptNote(payload.receiptNote);
    setCartDeliveryNote(payload.deliveryNote);
    if (payload.deliveryNote) setDeliveryNotes(payload.deliveryNote);
    setStatusMessage('Cart notes saved.');
    logEvent('SALE_CART_NOTE_UPDATED', payload.internalNote || payload.receiptNote || payload.deliveryNote || 'Cart notes cleared.');
  };

  const handleReprintSale = async (sale: Sale) => {
    if (!canPerformAction(roleName, 'sales.reprintReceipt')) {
      setStatusMessage('You do not have permission to reprint receipts.');
      return;
    }
    const preview = await getReceiptPreview(sale.invoiceNo, '80mm');
    if (preview) {
      setReceiptOutputPreview(preview);
    } else {
      setReceiptReviewSale(sale);
    }
    setStatusMessage(`Reprint prepared for ${sale.invoiceNo}. Use Print Receipt from the receipt output modal.`);
    logEvent('RECEIPT_REPRINT_PREPARED', `${sale.invoiceNo} prepared for reprint.`);
  };

  const handleReprintLastReceipt = () => {
    const lastReceipt = recentSales.find((sale) => String(sale.status).toUpperCase() === 'COMPLETED') || recentSales[0];
    if (!lastReceipt) {
      setStatusMessage('No recent receipt available for reprint.');
      return;
    }
    void handleReprintSale(lastReceipt);
  };

  const handleDuplicateSaleToCart = (sale: Sale) => {
    if (!canPerformAction(roleName, 'sales.open')) {
      setStatusMessage('You do not have permission to duplicate this receipt.');
      return;
    }
    const confirmed = window.confirm(`Duplicate ${sale.invoiceNo} into a new editable cart? Stock will not change until the new sale is completed.`);
    if (!confirmed) return;
    const nextCart: CartItem[] = sale.items.map((item) => {
      const product = localProducts.find((row) => row.id === item.productId || productSku(row) === item.code) || {
        id: item.productId,
        code: item.code,
        name: item.name,
        category: 'Duplicated Receipt',
        price: item.price,
        cost: item.price * 0.62,
        stock: item.quantity,
        availableStock: item.quantity,
        minStock: 0,
        unit: 'EA',
        sku: item.code,
        productName: item.name,
        sellingPrice: item.price
      };
      return { product, quantity: item.quantity, discount: 0, overriddenPrice: item.price };
    });
    setCart(nextCart);
    setCustomerName(sale.customerName || 'Walk-in Customer');
    setPaymentMethod('Cash');
    setPayments([]);
    resetSaleReductions();
    setWorkspaceDrawer(null);
    setReceiptReviewSale(null);
    setStatusMessage(`${sale.invoiceNo} duplicated into a new cart.`);
    logEvent('RECEIPT_DUPLICATED_TO_NEW_CART', `${sale.invoiceNo} duplicated into active cart.`);
  };

  const handlePrepareIDeliverRequest = () => {
    if (!canPerformAction(roleName, 'delivery.create') && !canPerformAction(roleName, 'delivery.broadcast')) {
      setStatusMessage('You do not have permission to prepare delivery requests.');
      return;
    }
    setDeliveryMode('iDeliver Service');
    const code = deliveryFulfilmentCode || `${Math.floor(100000 + Math.random() * 900000)}`;
    setDeliveryFulfilmentCode(code);
    setStatusMessage(`iDeliver request prepared. Fulfilment code ${code}.`);
    logEvent('IDELIVER_REQUEST_PREPARED_LOCAL', `iDeliver draft prepared for ${customerName}.`);
  };

  const handleGenerateDeliveryCode = () => {
    const code = `${Math.floor(100000 + Math.random() * 900000)}`;
    setDeliveryFulfilmentCode(code);
    setStatusMessage(`Fulfilment code generated: ${code}.`);
    logEvent('DELIVERY_CODE_GENERATED', `Fulfilment code ${code} generated.`);
  };

  const handlePrepareDeliveryWhatsApp = () => {
    const code = deliveryFulfilmentCode || `${Math.floor(100000 + Math.random() * 900000)}`;
    setDeliveryFulfilmentCode(code);
    const message = `Hi ${customerName || 'Customer'}, your ${deliveryMode} order from ${branchName} is being prepared. Fulfilment code: ${code}. Total: ${money(grandTotal)}.`;
    setDeliveryDraftMessage(message);
    setDeliveryNotes([deliveryNotes, message].filter(Boolean).join('\n'));
    setStatusMessage('WhatsApp delivery message prepared.');
    logEvent('WHATSAPP_DELIVERY_MESSAGE_PREPARED', message);
  };

  const openWorkspaceDrawer = (drawer: SalesWorkspaceDrawer) => {
    collapseProductFieldsForOperation(drawer || 'Sales Workspace');
    setWorkspaceDrawer(drawer);
    setWorkspaceMenuOpen(false);
  };

  const handleRecoverSalesShift = () => {
    const recovered = recoverShiftState();
    if (!recovered) {
      setStatusMessage('No recoverable shift state found on this device.');
      setSalesRecoveryFound(false);
      return;
    }
    setSalesRecoveryDetailsOpen(true);
    setSalesRecoveryFound(true);
    setStatusMessage('Recoverable shift state restored for review.');
    logEvent('SHIFT_RECOVERY_STATE_RESTORED', `Recovered ${recovered.terminalName} for ${recovered.staffName}.`);
  };

  const handleClearSalesRecovery = () => {
    if (!window.confirm('Clear the saved recovery state from this device? Completed shift history will not be deleted.')) return;
    clearShiftRecoveryState();
    setSalesRecoveryFound(false);
    setSalesRecoveryDetailsOpen(false);
    setStatusMessage('Recovery state cleared.');
    logEvent('SHIFT_RECOVERY_STATE_CLEARED', 'Local recovery state cleared from Sales Terminal.');
  };

  const handleStartSellingFromSales = () => {
    try {
      localStorage.setItem(SHIFT_START_INTENT_KEY, 'open');
    } catch {
      // Start Selling navigation still works without localStorage.
    }
    logEvent('START_SELLING_CLICKED', 'Start Selling clicked from Sales Terminal blocked state.');
    onNavigate('SHIFT');
  };

  const openSalesHistoryFromMenu = (intent: 'Sales History' | 'Sales Returns') => {
    collapseProductFieldsForOperation(intent);
    setWorkspaceMenuOpen(false);
    if (intent === 'Sales Returns') {
      setStatusMessage('Sales Returns opened through Sales History. Select a receipt and use Sales Return.');
      logEvent('SALES_RETURNS_MENU_OPENED', 'Sales Returns action opened Sales History.');
    } else {
      logEvent('SALES_HISTORY_MENU_OPENED', 'Sales History opened from Sales Terminal menu.');
    }
    onNavigate('SALES_HISTORY');
  };

  const salesBlocked = salesReadiness ? !salesReadiness.allowed : false;

  return (
    <div className="sales-terminal-shell">
      <header className="sci-page-header sci-page-header--compact sales-terminal-page-header">
        <div>
          <p className="sci-pos-eyebrow">iTred Commerce POS - Vendor Commerce Terminal</p>
          <h1>Sales Terminal</h1>
          <p>Two-card checkout workspace for product search, cart, payment, delivery, tax, receipts, and sales activity.</p>
        </div>
        <div className="sci-page-header__actions">
          <div className="sales-workspace-menu-host">
            <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => { collapseProductFieldsForOperation('Sales Workspace Menu'); setWorkspaceMenuOpen((current) => !current); }} aria-expanded={workspaceMenuOpen}>
              <MoreVertical size={17} aria-hidden="true" />
              Sales Workspace Menu
            </button>
            {workspaceMenuOpen && (
              <>
                <button type="button" className="sales-menu-dismiss-layer" aria-label="Close sales workspace menu" onClick={() => setWorkspaceMenuOpen(false)} />
                <div className="sales-workspace-menu" role="menu">
                  <strong>Sales Workspace Menu</strong>
                  <button type="button" onClick={() => openWorkspaceDrawer('recentReceipts')}>Recent Receipts</button>
                  <button type="button" onClick={() => openWorkspaceDrawer('heldSales')}>Held Sales</button>
                  <button type="button" onClick={() => openWorkspaceDrawer('activityFeed')}>Sales Activity Feed</button>
                  {canViewProfitSnapshot && (
                    <button type="button" onClick={() => { collapseProductFieldsForOperation('Sales Profit Snapshot'); setProfitSnapshotOpen(true); setWorkspaceMenuOpen(false); }}>Sales Profit Snapshot</button>
                  )}
                  <button type="button" onClick={() => { collapseProductFieldsForOperation('Draft Receipt'); setStatusMessage(`Draft receipt prepared. Items: ${cart.length}, total: ${money(grandTotal)}${receiptNote ? `, note: ${receiptNote}` : ''}.`); logEvent('RECEIPT_DRAFTED', 'Draft receipt prepared from active cart.'); setWorkspaceMenuOpen(false); }}>Draft Receipt</button>
                  {canProcessSalesReturns && <button type="button" onClick={() => openSalesHistoryFromMenu('Sales Returns')}>Sales Returns</button>}
                  {canViewSalesHistory && <button type="button" onClick={() => openSalesHistoryFromMenu('Sales History')}>Sales History</button>}
                  {canCreateMiscellaneousSale && <button type="button" onClick={handleOpenMiscellaneousSale}>Miscellaneous Sales</button>}
                  <button type="button" onClick={() => { collapseProductFieldsForOperation('Clear Workspace'); handleClearWorkspace('Entire Workspace'); setWorkspaceMenuOpen(false); }}>Clear Workspace</button>
                </div>
              </>
            )}
          </div>
          {canViewSalesHistory && <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => onNavigate('SALES_HISTORY')}>
            <History size={17} aria-hidden="true" />
            Sales History
          </button>}
          <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={handleCompleteSale} disabled={!canCompleteWithPermission} title={disableCompleteReason}>
            <ShieldCheck size={17} aria-hidden="true" />
            Complete
          </button>
        </div>
      </header>

      {statusMessage && (
        <div className="sci-pos-alert" role="status">
          <span>{statusMessage}</span>
          {preparedReceiptPreview && statusMessage === 'Sale completed successfully.' && (
            <button
              type="button"
              className="sci-pos-button sci-pos-button--primary"
              onClick={() => setReceiptPreview(preparedReceiptPreview)}
            >
              <Printer size={16} aria-hidden="true" />
              Preview Receipt
            </button>
          )}
        </div>
      )}

      {salesBlocked && (
        <section className="shift-recovery-banner sales-readiness-banner">
          <ShieldCheck size={18} aria-hidden="true" />
          <div>
            <strong>Sales Not Ready</strong>
            <span>{salesReadiness?.message || 'Terminal activation, shift opening, or drawer assignment is incomplete.'}</span>
          </div>
          <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={handleStartSellingFromSales}>
            Start Selling
          </button>
          {canCreateMiscellaneousSale && (
            <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={handleOpenMiscellaneousSale}>
              Add Miscellaneous Sale
            </button>
          )}
        </section>
      )}

      {salesRecoveryFound && (
        <section className="shift-recovery-banner sales-readiness-banner">
          <RotateCcw size={18} aria-hidden="true" />
          <div>
            <strong>Recoverable Shift State Found</strong>
            <span>The previous terminal session was interrupted. You can recover the last shift state from this device.</span>
          </div>
          <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={handleRecoverSalesShift}>Recover Shift</button>
          <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => setSalesRecoveryDetailsOpen((current) => !current)}>Review Recovery Details</button>
          <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={handleClearSalesRecovery}>Clear Recovery State</button>
        </section>
      )}

      {salesRecoveryDetailsOpen && (
        <section className="sci-pos-card shift-history-card">
          <div className="shift-history-detail-grid">
            <div><span>Terminal</span><strong>{getShiftRecoveryState()?.terminalName || terminalName}</strong></div>
            <div><span>Staff</span><strong>{getShiftRecoveryState()?.staffName || staffName}</strong></div>
            <div><span>Shift</span><strong>{getShiftRecoveryState()?.shift?.status || 'Review required'}</strong></div>
            <div><span>Saved At</span><strong>{getShiftRecoveryState()?.savedAt ? new Date(getShiftRecoveryState()!.savedAt).toLocaleString() : 'Not recorded'}</strong></div>
          </div>
        </section>
      )}

      {localProducts.length === 0 && (
        <section className="sci-pos-card border-l-4 border-l-orange-500">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <p className="sci-pos-eyebrow">Inventory Required</p>
              <h2 className="text-lg font-black uppercase text-[#1e222b]">No sellable products yet</h2>
              <p className="text-xs font-semibold text-slate-600 mt-1">Add inventory before starting sales.</p>
            </div>
            <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={() => onNavigate('STOCK')}>
              Go to Stock / Product Master
            </button>
          </div>
        </section>
      )}

      <div className="pos-sales-layout sales-terminal-workspace">
        <ProductSearchCard
          products={localProducts}
          branchName={branchName}
          warehouseName={warehouseName}
          onAddProduct={handleAddProduct}
          onBlockedProduct={handleBlockedProduct}
          onBlockedStockAttempt={handleBlockedProduct}
          onActivity={logEvent}
          canSellInventoryItems={canSellInventoryItems}
          inventoryBlockedMessage={inventoryBlockedMessage}
          canAddMiscellaneousSale={canCreateMiscellaneousSale}
          onNavigateShiftControl={() => onNavigate('SHIFT')}
          onActivateTerminal={() => onNavigate('SHIFT')}
          onOpenShift={() => onNavigate('SHIFT')}
          onAssignDrawer={() => onNavigate('SHIFT')}
          onAddMiscellaneousSale={handleOpenMiscellaneousSale}
          collapseFieldsSignal={collapseFieldsSignal}
        />
        <SalesCartCard
          cart={cart}
          customerMode={customerMode}
          customerName={customerName}
          customerPhone={customerPhone}
          customerWhatsApp={customerWhatsApp}
          customerAddress={customerAddress}
          customerTaxNumber={customerTaxNumber}
          customerNotes={customerNotes}
          existingCustomers={activeCustomers.filter((customer) => customer.customerId !== 'CUST-WALKIN')}
          selectedCustomerId={selectedCustomerId}
          cashierName={staffName}
          terminalName={terminalName}
          branchName={branchName}
          paymentMethod={paymentMethod}
          paymentAmount={paymentAmount}
          paymentReference={paymentReference}
          payments={payments}
          deliveryMode={deliveryMode}
          deliveryAddress={deliveryAddress}
          deliveryWhatsApp={deliveryWhatsApp}
          deliveryNotes={deliveryNotes}
          deliveryFee={deliveryFee}
          deliveryPriority={deliveryPriority}
          deliveryPaymentMode={deliveryPaymentMode}
          vatMode={vatMode}
          vatRate={vatRate}
          totals={{
            subtotal,
            discountTotal: lineDiscountTotal + cartDiscountAmount,
            taxTotal,
            deliveryFee: parsedDeliveryFee,
            grandTotal,
            paymentReceived,
            changeDue,
            balanceDue
          }}
          cartDiscountAmount={cartDiscountAmount}
          creditRedemptionAmount={creditRedemptionAmount}
          loyaltyRedemptionAmount={loyaltyRedemptionAmount}
          cartInternalNote={cartInternalNote}
          receiptNote={receiptNote}
          cartDeliveryNote={cartDeliveryNote}
          availableCredit={availableCustomerCredit}
          creditDecision={creditDecision}
          availableLoyaltyPoints={availableLoyaltyPoints}
          canComplete={canCompleteWithPermission}
          canReceivePayment={canPerformAction(roleName, 'payment.capture') || canPerformAction(roleName, 'sales.complete')}
          canApplyDiscount={canPerformAction(roleName, 'sales.discount')}
          canRedeemCredit={canPerformAction(roleName, 'sales.creditRedeem') || canPerformAction(roleName, 'customers.creditView')}
          canUseLoyalty={canPerformAction(roleName, 'sales.loyalty')}
          canUseAccountSale={canPerformAction(roleName, 'sales.creditSale')}
          canVoidCart={canPerformAction(roleName, 'sales.void')}
          canReprintReceipt={canPerformAction(roleName, 'sales.reprintReceipt')}
          canHoldSale={canPerformAction(roleName, 'sales.hold')}
          canSaveDelivery={canPerformAction(roleName, 'delivery.create')}
          canBroadcastDelivery={canPerformAction(roleName, 'delivery.broadcast')}
          disableCompleteReason={disableCompleteReason}
          onCustomerModeChange={handleCustomerModeChange}
          onCustomerNameChange={setCustomerName}
          onCustomerPhoneChange={setCustomerPhone}
          onCustomerWhatsAppChange={setCustomerWhatsApp}
          onCustomerAddressChange={setCustomerAddress}
          onCustomerTaxNumberChange={setCustomerTaxNumber}
          onCustomerNotesChange={setCustomerNotes}
          onExistingCustomerSelect={handleExistingCustomerSelect}
          onSaveCustomerRequest={handleSaveCustomerRequest}
          onQuantitySet={handleQuantitySet}
          onQuantityChange={handleQuantityChange}
          onRemoveItem={handleRemoveItem}
          onApplyLineDiscount={handleApplyLineDiscount}
          onCartNotice={setStatusMessage}
          onApplyCartDiscount={handleApplyCartDiscount}
          onRedeemCredit={handleRedeemCredit}
          onRedeemLoyalty={handleRedeemLoyalty}
          onApplyAccountPayment={handleApplyAccountPayment}
          onVoidCart={handleVoidCart}
          onReprintLastReceipt={handleReprintLastReceipt}
          onClearWorkspace={handleClearWorkspace}
          onSaveCartNotes={handleSaveCartNotes}
          onPrepareIDeliverRequest={handlePrepareIDeliverRequest}
          onGenerateDeliveryCode={handleGenerateDeliveryCode}
          onPrepareDeliveryWhatsApp={handlePrepareDeliveryWhatsApp}
          onPaymentMethodChange={setPaymentMethod}
          onPaymentAmountChange={setPaymentAmount}
          onPaymentReferenceChange={setPaymentReference}
          onAddPayment={handleAddPayment}
          onRemovePayment={(paymentId) => {
            setPayments((current) => current.filter((payment) => payment.id !== paymentId));
            logEvent('PAYMENT_LINE_REMOVED', 'Payment line removed.');
          }}
          onClearPayments={() => {
            setPayments([]);
            setPaymentAmount('');
            setPaymentReference('');
            logEvent('PAYMENT_DRAFT_CLEARED', 'Payment draft cleared.');
          }}
          onDeliveryModeChange={setDeliveryMode}
          onDeliveryAddressChange={setDeliveryAddress}
          onDeliveryWhatsAppChange={setDeliveryWhatsApp}
          onDeliveryNotesChange={setDeliveryNotes}
          onDeliveryFeeChange={setDeliveryFee}
          onDeliveryPriorityChange={setDeliveryPriority}
          onDeliveryPaymentModeChange={setDeliveryPaymentMode}
          onCustomerDetailsSaved={() => {
            setStatusMessage('Customer details saved to current cart draft.');
            logEvent('CUSTOMER_DETAILS_UPDATED', `${customerName || 'Customer'} details updated.`);
          }}
          onDeliveryDetailsSaved={() => {
            setStatusMessage('Delivery details saved to current cart draft.');
            logEvent('DELIVERY_DETAILS_UPDATED', `${deliveryMode} details saved.`);
          }}
          onCheckoutActivity={logEvent}
          onVatModeChange={(value) => {
            setVatManuallyChanged(true);
            setVatMode(value);
          }}
          onVatRateChange={(value) => {
            setVatManuallyChanged(true);
            setVatRate(value);
          }}
          onCompleteSale={handleCompleteSale}
          onHoldSale={handleHoldSale}
          onCancelSale={handleCancelSale}
          onSalesOperationStart={collapseProductFieldsForOperation}
        />
      </div>

      {receiptPreview && (
        <section className="sci-pos-card pos-receipt-preview-panel">
          <div className="sci-pos-card__bar">
            <div>
              <p className="sci-pos-eyebrow">Preview Receipt</p>
              <h2>{receiptPreview.receipt.receiptNumber}</h2>
            </div>
            <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => setReceiptPreview(null)}>
              Close Preview
            </button>
          </div>
          <ReceiptPreview80mm preview={receiptPreview} />
        </section>
      )}
      {workspaceDrawer && (
        <div className="sales-drawer-backdrop" onClick={() => setWorkspaceDrawer(null)}>
          <aside className="sales-drawer sales-workspace-drawer" onClick={(event) => event.stopPropagation()} aria-label="Sales workspace drawer">
            <div className="sales-drawer-header">
              <div>
                <p className="sci-pos-eyebrow">Sales Workspace</p>
                <h3>{workspaceDrawer === 'recentReceipts' ? 'Recent Receipts' : workspaceDrawer === 'heldSales' ? 'Held Sales' : 'Sales Activity Feed'}</h3>
              </div>
              <button type="button" className="sci-pos-icon-button" onClick={() => setWorkspaceDrawer(null)} aria-label="Close sales workspace drawer">
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <div className="sales-drawer-body">
              {workspaceDrawer === 'recentReceipts' && (
                <div className="sales-drawer-list">
                  <p className="sales-drawer-note">Double-click a receipt to open read-only receipt review.</p>
                  <label className="sales-drawer-search">Search Recent Receipts<input value={recentReceiptSearch} onChange={(event) => setRecentReceiptSearch(event.target.value)} placeholder="Search receipt, customer, payment, cashier, item, SKU..." /></label>
                  {filteredRecentSales.map((sale) => (
                    <article key={sale.id} className="sales-drawer-row" onDoubleClick={() => void handleOpenReceiptReview(sale)}>
                      <div><strong>{sale.invoiceNo}</strong><span>{sale.customerName || 'Walk-in Customer'} | {sale.items.length} item(s) | {sale.paymentMethod} | {new Date(sale.date).toLocaleString()}</span></div>
                      <b>{money(sale.total)}</b>
                      <small>{sale.status}</small>
                      <div className="pos-recent-receipt__actions">
                        <button type="button" className="sci-pos-link-button" onClick={() => void handleOpenReceiptReview(sale)}>View Receipt</button>
                        <button type="button" className="sci-pos-link-button" onClick={() => { setStatusMessage(`CAT form opened for ${sale.invoiceNo}.`); logEvent('CAT_FORM_OPENED_LOCAL', `${sale.invoiceNo} CAT form opened.`); }}>Open CAT Form</button>
                        <button type="button" className="sci-pos-link-button" onClick={() => void handleReprintSale(sale)}>Reprint</button>
                        <button type="button" className="sci-pos-link-button" disabled={!canPerformAction(roleName, 'sales.open')} onClick={() => handleDuplicateSaleToCart(sale)}>Duplicate as New Sale</button>
                      </div>
                    </article>
                  ))}
                  {filteredRecentSales.length === 0 && <div className="sci-pos-empty-cell">No recent receipts match the search.</div>}
                </div>
              )}
              {workspaceDrawer === 'heldSales' && (
                <div className="sales-drawer-list">
                  <p className="sales-drawer-note">Double-click a held sale to reopen it into the active cart.</p>
                  <label className="sales-drawer-search">Search Held Sales<input value={heldSaleSearch} onChange={(event) => setHeldSaleSearch(event.target.value)} placeholder="Search hold no., customer, phone, note, SKU, product..." /></label>
                  {canDeleteAllHeldSales && visibleHeldSales.some((sale) => sale.status === 'Held') && (
                    <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => void handleDeleteAllHeldSales()}>Clear All Held Sales</button>
                  )}
                  {filteredHeldSales.map((heldSale) => {
                    const expiryStatus = getHeldSaleExpiryStatus(heldSale.expiryDateTime);
                    const isExpired = expiryStatus === 'Expired';
                    const isExpiringSoon = expiryStatus === 'Expiring Soon';
                    const reopenDisabled = heldSale.status !== 'Held' || (isExpired && !canReopenExpiredHeldSale);
                    return (
                      <article key={heldSale.id} className={`sales-drawer-row${heldSale.status === 'Cancelled' ? ' sales-drawer-row--cancelled' : ''}`} onDoubleClick={() => { if (!reopenDisabled) { void handleResumeHeldSale(heldSale); setWorkspaceDrawer(null); } }}>
                        <div><strong>{heldSale.heldSaleNumber}</strong><span>{heldSale.customerName} | {heldSale.items.length} item(s) | Held by {heldSale.heldBy}</span></div>
                        <b>{money(heldSale.total)}</b>
                        <small>{heldSale.heldAt} | Expiry: {heldSale.expiryDateTime ? new Date(heldSale.expiryDateTime).toLocaleString() : 'No expiry set'} | {heldSale.status}</small>
                        <span className={`held-sale-status held-sale-status--${expiryStatus.toLowerCase().replace(' ', '-')}`}>{expiryStatus}</span>
                        {isExpired && <small className="held-sale-expired-warning">Expired — manager approval required</small>}
                        <div className="pos-recent-receipt__actions">
                          <button type="button" className="sci-pos-link-button" disabled={reopenDisabled} onClick={() => { void handleResumeHeldSale(heldSale); setWorkspaceDrawer(null); }}><RotateCcw size={14} aria-hidden="true" /> Reopen Sale</button>
                          <button type="button" className="sci-pos-link-button" onClick={() => setStatusMessage(`${heldSale.heldSaleNumber}: ${heldSale.note || 'No details note captured.'}`)}>View Details</button>
                          <button type="button" className="sci-pos-link-button" disabled={heldSale.status !== 'Held'} onClick={() => { void handleCancelHeldSale(heldSale); }}>Cancel Held Sale</button>
                          {canDeleteHeldSale(heldSale) && (
                            <button type="button" className="sci-pos-link-button sci-pos-link-button--danger" onClick={() => void handleDeleteHeldSale(heldSale)}>Delete Held Sale</button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                  {filteredHeldSales.length === 0 && <div className="sci-pos-empty-cell">No held sales match the search.</div>}
                </div>
              )}
              {workspaceDrawer === 'activityFeed' && (
                <div className="pos-audit-feed sales-activity-drawer-feed">
                  <label className="sales-drawer-search">Search Sales Activity<input value={activitySearch} onChange={(event) => setActivitySearch(event.target.value)} placeholder="Search event, message, timestamp..." /></label>
                  {filteredAuditEvents.map((event) => (
                    <div key={event.id}>
                      <strong>{eventTitle(event.eventType)}</strong>
                      <span>{event.message}</span>
                      <small>{event.time}</small>
                    </div>
                  ))}
                  {filteredAuditEvents.length === 0 && <div className="sci-pos-empty-cell">No sale events match the search.</div>}
                </div>
              )}
            </div>
            <div className="sales-drawer-actions">
              <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => setWorkspaceDrawer(null)}>Close</button>
            </div>
          </aside>
        </div>
      )}
      <SalesReceiptReviewModal
        sale={receiptReviewSale}
        onClose={() => setReceiptReviewSale(null)}
        onReprint={handleReprintSale}
        onCatForm={(sale) => { setStatusMessage(`CAT form opened for ${sale.invoiceNo}.`); logEvent('CAT_FORM_OPENED_LOCAL', `${sale.invoiceNo} CAT form opened.`); }}
        onDuplicate={handleDuplicateSaleToCart}
        canReprint={canPerformAction(roleName, 'sales.reprintReceipt')}
        canOpenCatForm={canPerformAction(roleName, 'customers.purchaseHistory.view')}
        canDuplicate={canPerformAction(roleName, 'sales.open')}
      />
      <ReceiptOutputModal
        preview={receiptOutputPreview}
        canPrint={canPerformAction(roleName, 'sales.reprintReceipt')}
        canPdf={canPerformAction(roleName, 'receipt.pdf')}
        canWhatsApp={canPerformAction(roleName, 'receipt.whatsappShare')}
        onClose={() => setReceiptOutputPreview(null)}
        onOpenSalesHistory={() => {
          setReceiptOutputPreview(null);
          onNavigate('SALES_HISTORY');
        }}
        onActivity={logEvent}
      />
      {pendingBridgeCustomer && (
        <div className="pos-modal-backdrop" role="presentation">
          <section className="pos-customer-replace-modal" role="dialog" aria-modal="true" aria-labelledby="replace-cart-customer-title">
            <div className="pos-new-customer-modal__header">
              <div>
                <p className="sci-pos-eyebrow">Customer Centre</p>
                <h2 id="replace-cart-customer-title">Replace current cart customer?</h2>
              </div>
              <button type="button" className="sci-pos-icon-button" aria-label="Close replace customer modal" onClick={() => setPendingBridgeCustomer(null)}><X size={18} /></button>
            </div>
            <p className="pos-credit-empty-text">
              {pendingBridgeCustomer.customerName} was selected in Customer Centre. The current sale already has {customerName || 'another customer'}.
            </p>
            <div className="pos-new-customer-modal__actions">
              <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={() => void applyBridgeCustomerToSale(pendingBridgeCustomer)}>Replace Customer</button>
              <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => {
                clearSelectedCustomerForSaleBridge();
                setPendingBridgeCustomer(null);
                setStatusMessage('Kept current cart customer.');
              }}>Keep Current Customer</button>
              <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => setPendingBridgeCustomer(null)}>Cancel</button>
            </div>
          </section>
        </div>
      )}
      <SalesProfitSnapshotCard
        open={profitSnapshotOpen}
        allowed={canViewProfitSnapshot}
        canGenerate={canGenerateProfitSnapshot}
        canExport={canExportProfitSnapshot}
        canPrint={canPrintProfitSnapshot}
        sales={recentSales}
        products={localProducts}
        generatedBy={staffName}
        branchName={branchName}
        terminalName={terminalName}
        cashierName={staffName}
        onClose={() => setProfitSnapshotOpen(false)}
        onNotice={setStatusMessage}
      />
      <MiscellaneousSaleModal
        open={miscSaleOpen}
        onSubmit={(payload) => void handleAddMiscellaneousSale(payload)}
        onCancel={() => setMiscSaleOpen(false)}
      />
    </div>
  );
}

