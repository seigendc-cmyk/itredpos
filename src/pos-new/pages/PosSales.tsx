import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Clock, FileText, History, Printer, RotateCcw, ShieldCheck } from 'lucide-react';
import ProductSearchCard from '../components/ProductSearchCard';
import SalesCartCard, {
  DeliveryMode,
  SalesCustomerMode,
  SalesPaymentLine,
  SalesPaymentMethod
} from '../components/SalesCartCard';
import ReceiptPreview80mm from '../components/ReceiptPreview80mm';
import { mockProducts, mockRecentSales } from '../mock/mockPosData';
import { createAccountingPostingPlaceholder } from '../services/accountingService';
import { biEventService } from '../services/biEventService';
import { createReceiptFromSale, getReceiptPreview } from '../services/receiptService';
import { postSaleMovement } from '../services/inventoryMovementService';
import { recordPaymentReportEvent } from '../services/paymentReportService';
import { logTerminalControlEvent, runTerminalControlCheck } from '../services/terminalControlService';
import { createCustomerRequest, getCustomers, recordCustomerSelectedForSale } from '../services/customerService';
import { getProductTotalAvailableStock } from '../services/stockBalanceService';
import {
  CartItem,
  CustomerRecord,
  PaymentMode,
  PosSession,
  Product,
  ReceiptPrintPreview,
  Role,
  Sale,
  VATMode
} from '../types';
import { canPerformAction } from '../utils/posPermissions';
import { calculateVATExclusive, calculateVATInclusive } from '../utils/taxUtils';

interface PosSalesProps {
  products: Product[];
  onProductStockChange: (productId: string, quantitySold: number) => void;
  onAddTransaction: (transaction: Omit<Sale, 'id' | 'invoiceNo' | 'date'>) => void;
  onNavigate: (page: string) => void;
  activeShiftOperator: string | null;
  session?: PosSession | null;
}

interface HeldSale {
  id: string;
  customerName: string;
  items: CartItem[];
  total: number;
  cashier: string;
  time: string;
}

interface SalesAuditEvent {
  id: string;
  time: string;
  eventType: string;
  message: string;
}

const DEFAULT_PRODUCTS = mockProducts;
const VENDOR_ID = 'SCI-LOG-ZW';
const paymentReferenceRequired = new Set<SalesPaymentMethod>(['EcoCash', 'Swipe', 'Bank Transfer']);

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
  if (method === 'Credit Sale Placeholder') return 'Credit Sale';
  if (method === 'Store Credit Placeholder') return 'Store Credit';
  return method;
}

function salePaymentMethod(method: SalesPaymentMethod): Sale['paymentMethod'] {
  if (method === 'Cash') return 'CASH';
  if (method === 'Split Payment') return 'SPLIT';
  return 'CARD';
}

function cartLineTotal(item: CartItem): number {
  const base = (item.overriddenPrice ?? productPrice(item.product)) * item.quantity;
  return base - base * (item.discount / 100);
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

export default function PosSales({
  products,
  onProductStockChange,
  onAddTransaction,
  onNavigate,
  session
}: PosSalesProps) {
  const staffName = session?.staffName || 'Admin User';
  const roleName = (session?.role || 'Owner') as Role;
  const branchName = session?.branch || 'Harare Main';
  const terminalName = session?.terminal || 'POS-01';
  const vendorName = session?.vendor || 'iTred Commerce POS';
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
  const [vatMode, setVatMode] = useState<VATMode>('Inclusive');
  const [vatRate, setVatRate] = useState('15');
  const [heldSales, setHeldSales] = useState<HeldSale[]>([]);
  const [recentSales, setRecentSales] = useState<Sale[]>(mockRecentSales.slice(0, 5));
  const [auditEvents, setAuditEvents] = useState<SalesAuditEvent[]>([]);
  const [statusMessage, setStatusMessage] = useState('');
  const [receiptPreview, setReceiptPreview] = useState<ReceiptPrintPreview | null>(null);
  const [preparedReceiptPreview, setPreparedReceiptPreview] = useState<ReceiptPrintPreview | null>(null);

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

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + cartLineTotal(item), 0), [cart]);
  const lineDiscountTotal = useMemo(() => cart.reduce((sum, item) => {
    const base = (item.overriddenPrice ?? productPrice(item.product)) * item.quantity;
    return sum + base * (item.discount / 100);
  }, 0), [cart]);
  const parsedDeliveryFee = Math.max(0, Number(deliveryFee) || 0);
  const parsedVatRate = Math.max(0, Number(vatRate) || 0);
  const taxTotal = useMemo(() => {
    if (vatMode === 'Not VAT Registered') return 0;
    if (vatMode === 'Exclusive') return calculateVATExclusive(subtotal, parsedVatRate).vatAmount;
    return calculateVATInclusive(subtotal, parsedVatRate).vatAmount;
  }, [parsedVatRate, subtotal, vatMode]);
  const grandTotal = vatMode === 'Exclusive' ? subtotal + taxTotal + parsedDeliveryFee : subtotal + parsedDeliveryFee;
  const paymentReceived = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const changeDue = Math.max(0, paymentReceived - grandTotal);
  const balanceDue = Math.max(0, grandTotal - paymentReceived);
  const creditSaleAllowed = paymentMethod === 'Credit Sale Placeholder' || payments.some((payment) => payment.method === 'Credit Sale Placeholder');
  const canComplete = cart.length > 0 && (creditSaleAllowed || paymentReceived >= grandTotal);
  const disableCompleteReason = cart.length === 0
    ? 'Cart is empty.'
    : creditSaleAllowed || paymentReceived >= grandTotal
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

  const eventTitle = (eventType: string): string => {
    const titles: Record<string, string> = {
      PRODUCT_ADDED: 'Product Added',
      PRODUCT_REMOVED: 'Product Removed',
      SALE_BLOCKED_ZERO_STOCK: 'Sale Blocked: Zero Stock',
      CUSTOMER_CREATED_PENDING: 'Customer Request Created',
      PAYMENT_ADDED: 'Payment Added',
      TRANSACTION_HELD: 'Sale Held',
      TRANSACTION_RESUMED: 'Sale Resumed',
      SALE_CANCELLED: 'Sale Cancelled',
      SALE_COMPLETED: 'Sale Completed',
      RECEIPT_CREATED: 'Receipt Created',
      SALE_BLOCKED_SHIFT_OR_TERMINAL: 'Sale Blocked: Terminal or Shift',
      CUSTOMER_SELECTED_FOR_SALE: 'Customer Selected for Sale'
    };
    return titles[eventType] || eventType.toLowerCase().split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
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
    setCustomerName('Walk-in Customer');
    setCustomerMode('Walk-in Customer');
    setSelectedCustomerId('');
    setCustomerPhone('');
    setCustomerWhatsApp('');
    setCustomerAddress('');
    setCustomerTaxNumber('');
    setCustomerNotes('');
  };

  const handleRemoveItem = (productId: string) => {
    const removedItem = cart.find((item) => item.product.id === productId);
    setCart((current) => current.filter((item) => item.product.id !== productId));
    if (removedItem) {
      logEvent('PRODUCT_REMOVED', `${productSku(removedItem.product)} removed from cart.`);
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
    logEvent('CUSTOMER_CREATED_PENDING', `${created.customerName} customer request saved locally.`);
    try {
      await biEventService.recordBIEvent({
        eventType: 'CUSTOMER_CREATED_PENDING',
        operator: staffName,
        terminal: terminalName,
        severity: 'INFO',
        payload: { customerId: created.customerId, customerName: created.customerName, status: created.status }
      });
    } catch {
      logEvent('CUSTOMER_CREATED_PENDING_BI_SKIPPED', 'Customer pending BI placeholder was skipped safely.');
    }
    setStatusMessage('Customer request created and sent for approval.');
    getCustomers({ status: 'Active' }).then(setActiveCustomers).catch(() => undefined);
  };

  const handleBlockedProduct = (product: Product) => {
    const message = 'Cannot add product. Stock is not available.';
    logEvent('SALE_BLOCKED_ZERO_STOCK', `${message} ${productSku(product)} ${productName(product)}.`);
    setStatusMessage(message);
  };

  const handleAddProduct = (product: Product) => {
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
      return [...current, { product: currentProduct, quantity: 1, discount: 0 }];
    });
    logEvent('PRODUCT_ADDED', `${productSku(currentProduct)} added to cart.`);
  };

  const handleQuantityChange = (productId: string, delta: number) => {
    setCart((current) => current.flatMap((item) => {
      if (item.product.id !== productId) return [item];
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

  const handleApplyLineDiscount = (productId: string) => {
    if (!canPerformAction(roleName, 'sales.discount')) {
      setStatusMessage('Current role cannot apply line discounts.');
      return;
    }
    setCart((current) => current.map((item) => item.product.id === productId ? { ...item, discount: item.discount > 0 ? 0 : 5 } : item));
    logEvent('DISCOUNT_APPLIED', 'Line discount placeholder updated.');
  };

  const handleAddPayment = () => {
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setStatusMessage('Enter a payment amount above zero.');
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
    logEvent('PAYMENT_ADDED', `${paymentMethod} payment added for ${money(amount)}.`);
  };

  const validateSale = (): string | null => {
    if (!canPerformAction(roleName, 'sales.complete')) return 'You do not have permission to complete a sale.';
    if (cart.length === 0) return 'Cart is empty.';
    const insufficientLine = cart.find((item) => {
      const currentProduct = localProducts.find((product) => product.id === item.product.id) || item.product;
      return productStock(currentProduct) < item.quantity;
    });
    if (insufficientLine) return `Insufficient stock for ${productName(insufficientLine.product)}.`;
    if (!creditSaleAllowed && paymentReceived < grandTotal) return 'Payment is under the sale total.';
    return null;
  };

  const handleCompleteSale = async () => {
    const validationMessage = validateSale();
    if (validationMessage) {
      setStatusMessage(validationMessage);
      return;
    }

    const salePayment = payments[0]?.method || paymentMethod;
    const requiresCashDrawer = salePayment === 'Cash' || payments.some((payment) => payment.method === 'Cash');
    const controlCheck = await runTerminalControlCheck({
      vendorId: VENDOR_ID,
      branchId: branchIdFromName(branchName),
      terminalId: terminalName,
      terminalName,
      staffId: staffName,
      staffName,
      role: roleName,
      requiresCashDrawer
    });
    if (!controlCheck.allowed) {
      const reason = controlCheck.message || 'Sale cannot be completed because the terminal or shift is not active.';
      setStatusMessage(reason);
      logEvent('SALE_BLOCKED_SHIFT_OR_TERMINAL', reason);
      await logTerminalControlEvent({
        vendorId: VENDOR_ID,
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
        logEvent('SALE_BLOCKED_SHIFT_OR_TERMINAL_BI_SKIPPED', 'Blocked sale BI placeholder was skipped safely.');
      }
      return;
    }

    const now = new Date().toISOString();
    const invoiceNo = `INV-${Date.now().toString().slice(-8)}`;
    const sale: Sale = {
      id: makeId('TXN'),
      invoiceNo,
      date: now,
      operator: staffName,
      customerName,
      terminal: terminalName,
      items: cart.map((item) => ({
        productId: item.product.id,
        name: productName(item.product),
        code: productSku(item.product),
        quantity: item.quantity,
        price: item.overriddenPrice ?? productPrice(item.product),
        total: cartLineTotal(item)
      })),
      subtotal,
      tax: taxTotal,
      discount: lineDiscountTotal,
      total: grandTotal,
      paymentMethod: salePaymentMethod(payments[0]?.method || paymentMethod),
      cashReceived: paymentReceived,
      changeGiven: changeDue,
      status: 'COMPLETED'
    };

    try {
      onAddTransaction({
        operator: sale.operator,
        customerName: sale.customerName,
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

      await Promise.all(cart.map((item) => {
        const currentProduct = localProducts.find((product) => product.id === item.product.id) || item.product;
        const balanceBefore = productStock(currentProduct);
        return postSaleMovement({
          vendorId: VENDOR_ID,
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

      cart.forEach((item) => onProductStockChange(item.product.id, item.quantity));
      setLocalProducts((current) => current.map((product) => {
        const soldLine = cart.find((item) => item.product.id === product.id);
        return soldLine ? { ...product, stock: Math.max(0, product.stock - soldLine.quantity), qtyOnHand: Math.max(0, productStock(product) - soldLine.quantity) } : product;
      }));

      const selectedCustomer = activeCustomers.find((customer) => customer.customerId === selectedCustomerId);
      const receipt = await createReceiptFromSale({
        sale,
        vendorId: VENDOR_ID,
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
        customerDeliveryAddress: selectedCustomer?.deliveryAddress || customerAddress,
        customerCreditStatus: selectedCustomer?.creditStatus,
        paymentMode: receiptPaymentMode(payments[0]?.method || paymentMethod),
        vatMode,
        vatRate: parsedVatRate
      });
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
            paymentMethod: receiptPaymentMode(payments[0]?.method || paymentMethod)
          }
        });
      } catch {
        logEvent('SALE_COMPLETION_SERVICE_PLACEHOLDER', 'Optional accounting, payment, or BI placeholder service was skipped safely.');
      }
      const preview = await getReceiptPreview(receipt.receiptNumber, '80mm');
      setPreparedReceiptPreview(preview || null);
      setRecentSales((current) => [sale, ...current].slice(0, 6));
      clearCartState();
      setStatusMessage('Sale completed successfully.');
      logEvent('SALE_COMPLETED', `Sale ${invoiceNo} completed for ${money(grandTotal)}.`);
      logEvent('RECEIPT_CREATED', `Receipt ${receipt.receiptNumber} prepared for preview.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Sale completion failed.');
    }
  };

  const handleHoldSale = () => {
    if (cart.length === 0) return;
    const hold: HeldSale = {
      id: makeId('HOLD'),
      customerName,
      items: cart,
      total: grandTotal,
      cashier: staffName,
      time: new Date().toLocaleString()
    };
    setHeldSales((current) => [hold, ...current].slice(0, 8));
    clearCartState();
    setStatusMessage('Sale held successfully.');
    logEvent('TRANSACTION_HELD', `Held sale ${hold.id}.`);
  };

  const handleResumeHeldSale = (heldSale: HeldSale) => {
    setCart(heldSale.items);
    setCustomerName(heldSale.customerName);
    setHeldSales((current) => current.filter((item) => item.id !== heldSale.id));
    setStatusMessage(`Resumed ${heldSale.id}.`);
    logEvent('TRANSACTION_RESUMED', `Held sale ${heldSale.id} resumed.`);
  };

  const handleCancelSale = () => {
    if (cart.length === 0) return;
    const confirmed = window.confirm('Cancel this sale and clear all cart items?');
    if (!confirmed) return;
    clearCartState();
    setStatusMessage('Sale cancelled.');
    logEvent('SALE_CANCELLED', 'Current sale was cancelled and cart cleared.');
  };

  return (
    <div className="space-y-6">
      <header className="sci-page-header sci-page-header--compact">
        <div>
          <p className="sci-pos-eyebrow">iTred Commerce POS - Vendor Commerce Terminal</p>
          <h1>Sales Terminal</h1>
          <p>Two-card checkout workspace for product search, cart, payment, delivery, tax, receipts, and local audit events.</p>
        </div>
        <div className="sci-page-header__actions">
          <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => onNavigate('SALES_HISTORY')}>
            <History size={17} aria-hidden="true" />
            Sales History
          </button>
          <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={handleCompleteSale} disabled={!canComplete} title={disableCompleteReason}>
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

      <div className="pos-sales-layout">
        <ProductSearchCard
          products={localProducts}
          branchName={branchName}
          warehouseName={warehouseName}
          onAddProduct={handleAddProduct}
          onBlockedProduct={handleBlockedProduct}
          onBlockedStockAttempt={handleBlockedProduct}
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
          vatMode={vatMode}
          vatRate={vatRate}
          totals={{
            subtotal,
            discountTotal: lineDiscountTotal,
            taxTotal,
            deliveryFee: parsedDeliveryFee,
            grandTotal,
            paymentReceived,
            changeDue,
            balanceDue
          }}
          canComplete={canComplete}
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
          onQuantityChange={handleQuantityChange}
          onRemoveItem={handleRemoveItem}
          onApplyLineDiscount={handleApplyLineDiscount}
          onPaymentMethodChange={setPaymentMethod}
          onPaymentAmountChange={setPaymentAmount}
          onPaymentReferenceChange={setPaymentReference}
          onAddPayment={handleAddPayment}
          onRemovePayment={(paymentId) => setPayments((current) => current.filter((payment) => payment.id !== paymentId))}
          onDeliveryModeChange={setDeliveryMode}
          onDeliveryAddressChange={setDeliveryAddress}
          onDeliveryWhatsAppChange={setDeliveryWhatsApp}
          onDeliveryNotesChange={setDeliveryNotes}
          onDeliveryFeeChange={setDeliveryFee}
          onVatModeChange={setVatMode}
          onVatRateChange={setVatRate}
          onCompleteSale={handleCompleteSale}
          onHoldSale={handleHoldSale}
          onCancelSale={handleCancelSale}
        />
      </div>

      <div className="pos-sales-support-grid">
        <section className="sci-pos-card">
          <div className="sci-pos-card__bar">
            <div>
              <p className="sci-pos-eyebrow">Suspended</p>
              <h2>Held Sales</h2>
            </div>
            <Clock size={18} aria-hidden="true" />
          </div>
          <div className="sci-pos-table-wrap">
            <table className="sci-pos-table">
              <thead>
                <tr>
                  <th>Hold ID</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Cashier</th>
                  <th>Time</th>
                  <th>Resume</th>
                </tr>
              </thead>
              <tbody>
                {heldSales.map((heldSale) => (
                  <tr key={heldSale.id}>
                    <td>{heldSale.id}</td>
                    <td>{heldSale.customerName}</td>
                    <td>{heldSale.items.length}</td>
                    <td>{money(heldSale.total)}</td>
                    <td>{heldSale.cashier}</td>
                    <td>{heldSale.time}</td>
                    <td>
                      <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => handleResumeHeldSale(heldSale)} title="Resume held sale">
                        <RotateCcw size={16} aria-hidden="true" />
                        Resume
                      </button>
                    </td>
                  </tr>
                ))}
                {heldSales.length === 0 && (
                  <tr>
                    <td colSpan={7} className="sci-pos-empty-cell">No held sales.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="sci-pos-card">
          <div className="sci-pos-card__bar">
            <div>
              <p className="sci-pos-eyebrow">Receipts</p>
              <h2>Recent Receipts</h2>
            </div>
            <Printer size={18} aria-hidden="true" />
          </div>
          <div className="sci-pos-table-wrap pos-recent-receipts-table">
            <table className="sci-pos-table">
              <thead>
                <tr>
                  <th>Receipt No.</th>
                  <th>Date / Time</th>
                  <th>Customer</th>
                  <th>Cashier</th>
                  <th>Payment</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentSales.map((sale) => (
                  <tr key={sale.id}>
                    <td className="sci-pos-table__strong">{sale.invoiceNo}</td>
                    <td>{new Date(sale.date).toLocaleString()}</td>
                    <td>{sale.customerName || 'Walk-in Customer'}</td>
                    <td>{sale.operator}</td>
                    <td>{sale.paymentMethod}</td>
                    <td>{money(sale.total)}</td>
                    <td><span className="sci-status-pill sci-status-pill--success">{sale.status}</span></td>
                    <td>
                      <div className="pos-recent-receipt__actions">
                        <button type="button" className="sci-pos-link-button" onClick={() => setStatusMessage(`View Receipt prepared for ${sale.invoiceNo}.`)}>
                          View Receipt
                        </button>
                        <button
                          type="button"
                          className="sci-pos-link-button"
                          onClick={() => preparedReceiptPreview ? setReceiptPreview(preparedReceiptPreview) : setStatusMessage('Receipt preview prepared.')}
                        >
                          Preview 80mm
                        </button>
                        <button type="button" className="sci-pos-link-button" onClick={() => onNavigate('SALES_HISTORY')}>
                          Open Sales History <ArrowRight size={14} aria-hidden="true" />
                        </button>
                        <button type="button" className="sci-pos-link-button" onClick={() => setStatusMessage(`Refund placeholder prepared for ${sale.invoiceNo}.`)}>
                          Refund
                        </button>
                        <button type="button" className="sci-pos-link-button" onClick={() => setStatusMessage(`Void placeholder prepared for ${sale.invoiceNo}.`)}>
                          Void
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="sci-pos-card">
        <div className="sci-pos-card__bar">
          <div>
            <p className="sci-pos-eyebrow">Audit</p>
            <h2>Sales Activity Feed</h2>
          </div>
          <FileText size={18} aria-hidden="true" />
        </div>
        <div className="pos-audit-feed">
          {auditEvents.map((event) => (
            <div key={event.id}>
              <strong>{eventTitle(event.eventType)}</strong>
              <span>{event.message}</span>
              <small>{event.time}</small>
            </div>
          ))}
          {auditEvents.length === 0 && <div className="sci-pos-empty-cell">No sale events recorded for this session.</div>}
        </div>
      </section>

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
    </div>
  );
}
