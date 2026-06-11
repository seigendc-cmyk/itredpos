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
import {
  CartItem,
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
  return product.qtyOnHand ?? product.stock;
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
  activeShiftOperator,
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
    setLocalProducts(products.length > 0 ? products : DEFAULT_PRODUCTS);
  }, [products]);

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
      RECEIPT_CREATED: 'Receipt Created'
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
      setCustomerName('Walk-in Customer');
      setCustomerPhone('');
      setCustomerWhatsApp('');
      setCustomerAddress('');
      setCustomerTaxNumber('');
      setCustomerNotes('');
    }
    if (mode === 'Existing Customer' && customerName === 'Walk-in Customer') {
      setCustomerName('Mary Courier');
    }
    if (mode === 'New Customer Request') {
      setCustomerName('');
    }
  };

  const handleSaveCustomerRequest = () => {
    logEvent('CUSTOMER_CREATED_PENDING', `${customerName || 'New customer'} customer request saved locally.`);
    setStatusMessage('Customer request saved locally.');
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
  };

  const validateSale = (): string | null => {
    if (!canPerformAction(roleName, 'sales.complete')) return 'Current role cannot complete sales.';
    if (!canPerformAction(roleName, 'sales.complete')) return 'You do not have permission to perform this action.';
    if (!activeShiftOperator) return 'Open a shift before completing sale.';
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
        customerName,
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
      setReceiptPreview(preview || null);
      setRecentSales((current) => [sale, ...current].slice(0, 6));
      clearCartState();
      setStatusMessage('Sale completed successfully.');
      logEvent('SALE_COMPLETED', `Sale ${invoiceNo} completed for ${money(grandTotal)}.`);
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
          <p>Two-card checkout workspace with product search, cart, payment, delivery, tax, receipts, and local development audit events.</p>
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
          {statusMessage}
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
          onSaveCustomerRequest={handleSaveCustomerRequest}
          onQuantityChange={handleQuantityChange}
          onRemoveItem={(productId) => setCart((current) => current.filter((item) => item.product.id !== productId))}
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
                      <button type="button" className="sci-pos-icon-button" onClick={() => handleResumeHeldSale(heldSale)} title="Resume held sale">
                        <RotateCcw size={16} aria-hidden="true" />
                        <span className="sr-only">Resume held sale</span>
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
          <div className="pos-recent-receipts">
            {recentSales.map((sale) => (
              <div key={sale.id} className="pos-recent-receipt">
                <div>
                  <strong>{sale.invoiceNo}</strong>
                  <span>{sale.customerName || 'Walk-in Customer'} - {money(sale.total)}</span>
                </div>
                <div className="pos-recent-receipt__actions">
                  <button type="button" className="sci-pos-link-button" onClick={() => setStatusMessage(`View Receipt placeholder for ${sale.invoiceNo}.`)}>
                    View Receipt
                  </button>
                  <button type="button" className="sci-pos-link-button" onClick={() => onNavigate('SALES_HISTORY')}>
                    Open in Sales History <ArrowRight size={14} aria-hidden="true" />
                  </button>
                  <button type="button" className="sci-pos-link-button" onClick={() => setStatusMessage(`Refund placeholder for ${sale.invoiceNo}.`)}>
                    Refund Placeholder
                  </button>
                  <button type="button" className="sci-pos-link-button" onClick={() => setStatusMessage(`Void placeholder for ${sale.invoiceNo}.`)}>
                    Void Placeholder
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="sci-pos-card">
        <div className="sci-pos-card__bar">
          <div>
            <p className="sci-pos-eyebrow">Audit</p>
            <h2>Sales Events</h2>
          </div>
          <FileText size={18} aria-hidden="true" />
        </div>
        <div className="pos-audit-feed">
          {auditEvents.map((event) => (
            <div key={event.id}>
              <strong>{event.eventType}</strong>
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
