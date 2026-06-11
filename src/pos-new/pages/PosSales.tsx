import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, 
  Trash2, 
  Plus, 
  Minus, 
  CreditCard, 
  DollarSign, 
  Scan, 
  CheckCircle, 
  X,
  AlertCircle, 
  FileText, 
  Percent, 
  Square, 
  Copy, 
  ArrowRight, 
  Printer, 
  History, 
  Database, 
  Activity, 
  ShieldAlert, 
  Minimize2, 
  Maximize2,
  FolderLock, 
  CheckCircle2,
  HelpCircle,
  TrendingDown,
  ChevronRight,
  ShoppingBag,
  Clock,
  Layers,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  Ban,
  Truck
} from 'lucide-react';
import { Product, CartItem, Transaction, PosSession, PosPageId, Role, ApprovalRequest, ApprovalRequestType, ApprovalStatus, SalesEvent, SalesEventType } from '../types';
import { mockProducts, mockHeldTransactions, mockRecentSales } from '../mock/mockPosData';
import { canPerformAction } from '../utils/posPermissions';
import { addLocalQueueItem } from '../utils/localQueueStore';
import PaymentBreakdownCard from '../components/PaymentBreakdownCard';
import { postReturnMovement, postInventoryMovement, postSaleMovement } from '../services/inventoryMovementService';

interface PosSalesProps {
  products: Product[];
  onProductStockChange: (productId: string, quantitySold: number) => void;
  onAddTransaction: (transaction: Omit<Transaction, 'id' | 'invoiceNo' | 'date'>) => void;
  onNavigate: (page: string) => void;
  activeShiftOperator: string | null;
  session?: PosSession | null;
}

// Local mock products mandated by the specifications
const INITIAL_MOCK_PRODUCTS: Product[] = mockProducts;

// Structures for Held/Suspended transactions
interface LocalHeldTransaction {
  id: string;
  holdNo: string;
  timeStr: string;
  items: CartItem[];
  subtotal: number;
  total: number;
  label: string;
  customerName: string;
  staffName: string;
  branch: string;
  terminal: string;
  approvalStatus: string;
}

// Structure for local BI Event feed entries inside/beside the modal
interface TransactionBiEvent {
  id: string;
  time: string;
  type: 
    | 'PRODUCT_ADDED' 
    | 'SALE_BLOCKED_ZERO_STOCK' 
    | 'DISCOUNT_APPLIED' 
    | 'TRANSACTION_HELD' 
    | 'SALE_COMPLETED' 
    | 'CART_CLEARED'
    | 'PRICE_OVERRIDE_REQUESTED'
    | 'DISCOUNT_ABOVE_ROLE_LIMIT'
    | 'VOID_REQUESTED'
    | 'SALE_COMPLETION_BLOCKED_PENDING_APPROVAL' 
    | string;
  message: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical' | 'Warning';
}

export default function PosSales({
  products,
  onProductStockChange,
  onAddTransaction,
  onNavigate,
  activeShiftOperator,
  session
}: PosSalesProps) {

  // Current session context
  const staffName = session?.staffName || 'Admin User';
  const roleName = session?.role || 'Owner';
  const branchName = session?.branch || 'Harare Main';
  const terminalName = session?.terminal || 'POS-01';
  const vendorName = session?.vendor || 'Demo Vendor';

  // State to manage active floating modal stages
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalState, setModalState] = useState<'normal' | 'minimized' | 'maximized'>('normal');

  // Interactive local list of mock products so stock states update dynamically
  const [localProducts, setLocalProducts] = useState<Product[]>(INITIAL_MOCK_PRODUCTS);

  // Active floating window transaction state values
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'EcoCash' | 'Swipe' | 'Bank Transfer' | 'Split Payment'>('CASH');
  
  // Custom metadata identifiers for parking transactions
  const [customerName, setCustomerName] = useState<string>('');
  const [draftLabel, setDraftLabel] = useState<string>('');
  const [generalDiscountPercent, setGeneralDiscountPercent] = useState<number>(0);

  // State for session logs
  const [localHeldTransactions, setLocalHeldTransactions] = useState<LocalHeldTransaction[]>([
    {
      id: 'HLD-092',
      holdNo: 'HLD-90231',
      timeStr: '12:45 PM',
      items: [
        { product: INITIAL_MOCK_PRODUCTS[1], quantity: 2, discount: 0 }
      ],
      subtotal: 24.00,
      total: 26.40,
      label: 'HOLD FOR MARY COURIER TAXI',
      customerName: 'Mary Courier'
    }
  ]);

  const [recentCompletedSales, setRecentCompletedSales] = useState<Transaction[]>([
    {
      id: 'RCT-1001',
      invoiceNo: 'RCT-0001',
      date: '2026-06-09T09:35:00Z',
      operator: 'Mary Cashier',
      terminal: 'POS-01',
      customerName: 'Walk-in Customer',
      items: [
        { productId: 'MOCK-P-03', name: 'Brake Pads Toyota GD6 Front', code: 'BP-GD6-F', quantity: 2, price: 40.00, total: 80.00 },
        { productId: 'OIL-FLT-15', name: 'Premium Oil Filter 15W40', code: 'OIL-FLT-15', quantity: 1, price: 45.00, total: 45.00 }
      ],
      subtotal: 125.00,
      tax: 12.50,
      discount: 0,
      total: 125.00,
      paymentMethod: 'Cash',
      status: 'COMPLETED'
    },
    {
      id: 'RCT-1002',
      invoiceNo: 'RCT-0002',
      date: '2026-06-09T10:12:00Z',
      operator: 'Mary Cashier',
      terminal: 'POS-01',
      customerName: 'WhatsApp Customer',
      items: [
        { productId: 'PSG-B10', name: 'Dial Pressure Gauge (10 Bar)', code: 'PSG-B10', quantity: 1, price: 30.00, total: 30.00 },
        { productId: 'SP-PLT-G', name: 'Spark Plug Platinum G-Power', code: 'SP-PLT-G', quantity: 1, price: 27.00, total: 27.00 }
      ],
      subtotal: 57.00,
      tax: 5.70,
      discount: 0,
      total: 57.00,
      paymentMethod: 'EcoCash',
      status: 'COMPLETED'
    },
    {
      id: 'RCT-1003',
      invoiceNo: 'RCT-0003',
      date: '2026-06-09T11:20:00Z',
      operator: 'Admin User',
      terminal: 'BACK-01',
      customerName: 'Walk-in Customer',
      items: [
        { productId: 'HEX-B12', name: 'M12 Heavy Hex Bolt (Steel 8.8)', code: 'HEX-B12', quantity: 100, price: 1.50, total: 150.00 },
        { productId: 'FB-VR-HM', name: 'Heavy Duty Fan Belt v-Ribbed', code: 'FB-VR-HM', quantity: 1, price: 60.00, total: 60.00 }
      ],
      subtotal: 210.00,
      tax: 21.00,
      discount: 0,
      total: 210.00,
      paymentMethod: 'Split Payment',
      status: 'COMPLETED'
    }
  ]);

  // BI dynamic list feed relative to the current transaction
  const [biEvents, setBiEvents] = useState<TransactionBiEvent[]>([
    {
      id: 'BI-TX-100',
      time: '15:52:10',
      type: 'PRODUCT_ADDED',
      message: 'Product BP-GD6-F successfully queued to compiler',
      severity: 'Low'
    }
  ]);

  const [salesEvents, setSalesEvents] = useState<SalesEvent[]>([
    {
      id: 'SLS-TX-100',
      timestamp: '15:52:10',
      eventType: 'PRODUCT_ADDED',
      message: 'Product BP-GD6-F successfully queued to compiler',
      operator: staffName
    }
  ]);

  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>([]);
  const [pendingPriceOverrideItem, setPendingPriceOverrideItem] = useState<CartItem | null>(null);
  const [requestedPriceVal, setRequestedPriceVal] = useState<string>('');
  const [overrideReason, setOverrideReason] = useState<string>('Customer negotiated price');

  // Receipt Preview, Return, Refund, Void Modals states
  const [selectedReceiptForPreview, setSelectedReceiptForPreview] = useState<Transaction | null>(null);
  const [selectedReceiptForReturn, setSelectedReceiptForReturn] = useState<Transaction | null>(null);
  const [selectedReceiptForRefund, setSelectedReceiptForRefund] = useState<Transaction | null>(null);
  const [selectedReceiptForVoid, setSelectedReceiptForVoid] = useState<Transaction | null>(null);

  // Return request form inputs
  const [returnProductId, setReturnProductId] = useState<string>('');
  const [returnQuantity, setReturnQuantity] = useState<number>(1);
  const [returnReason, setReturnReason] = useState<string>('Wrong item supplied');
  const [returnCondition, setReturnCondition] = useState<string>('Resellable');
  const [returnNotes, setReturnNotes] = useState<string>('');

  // Refund request form inputs
  const [refundAmountVal, setRefundAmountVal] = useState<string>('');
  const [refundMethodVal, setRefundMethodVal] = useState<string>('Cash');
  const [refundReasonVal, setRefundReasonVal] = useState<string>('Wrong size supplied');
  const [refundNotesVal, setRefundNotesVal] = useState<string>('');

  // Void sale request form inputs
  const [voidReasonVal, setVoidReasonVal] = useState<string>('Wrong sale captured');
  const [voidSupervisorNoteVal, setVoidSupervisorNoteVal] = useState<string>('');

  const [checkoutSuccessTicket, setCheckoutSuccessTicket] = useState<Transaction | null>(null);
  const [isTendering, setIsTendering] = useState<boolean>(false);
  const [cashTendered, setCashTendered] = useState<string>('');

  const getDiscountLimitForRole = (role: Role): number => {
    switch (role) {
      case 'Owner':
      case 'SysAdmin':
        return 100;
      case 'Manager':
        return 30;
      case 'Supervisor':
        return 20;
      case 'Cashier':
        return 5;
      case 'Stock Controller':
      default:
        return 0;
    }
  };

  const canApproveRequest = (role: Role, type: ApprovalRequestType, refundAmt?: number): boolean => {
    if (role === 'Owner' || role === 'SysAdmin') return true;
    if (role === 'Manager') return true;
    if (role === 'Supervisor') {
      if (type === 'Discount Approval' || type === 'Price Override' || type === 'Void Line') return true;
      if (type === 'Return Request') return true;
      if (type === 'Void Sale') return true; // Approved for supervisor same shift
      if (type === 'Refund Request') {
        // Supervisor cannot final-approve above USD 20
        return refundAmt !== undefined ? refundAmt <= 20 : true;
      }
    }
    return false;
  };

  const logSalesEvent = (
    eventType: SalesEventType,
    message: string
  ) => {
    const timestamp = new Date().toTimeString().split(' ')[0];
    const newEv: SalesEvent = {
      id: 'SLS-TX-' + Math.floor(Math.random() * 899 + 100),
      timestamp,
      eventType,
      message,
      operator: staffName
    };
    setSalesEvents(prev => [newEv, ...prev]);
  };

  // Handle addition of events into the event feed
  const logLocalBiEvent = (
    type: TransactionBiEvent['type'],
    message: string,
    severity: TransactionBiEvent['severity']
  ) => {
    const timestamp = new Date().toTimeString().split(' ')[0];
    const newEv: TransactionBiEvent = {
      id: 'BI-TX-' + Math.floor(Math.random() * 899 + 100),
      time: timestamp,
      type,
      message,
      severity
    };
    setBiEvents(prev => [newEv, ...prev]);
  };

  // Filter components
  const selectCategories = useMemo(() => {
    const cats = new Set(localProducts.map(p => p.category));
    return ['ALL', ...Array.from(cats)];
  }, [localProducts]);

  const matchedProductListing = useMemo(() => {
    return localProducts.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCategory = selectedCategory === 'ALL' || p.category === selectedCategory;
      return matchSearch && matchCategory;
    });
  }, [localProducts, searchTerm, selectedCategory]);

  // Cart operations
  const handleAddToCart = (product: Product) => {
    // If stock is zero, trigger critical BI warning and block standard compilation
    if (product.stock <= 0) {
      logLocalBiEvent(
        'SALE_BLOCKED_ZERO_STOCK',
        `SALE_BLOCKED_ZERO_STOCK: Attempted sale of out-of-stock clutch plate ${product.code}`,
        'Critical'
      );
      logSalesEvent('PRODUCT_REMOVED' as any, `PRODUCT_BLOCKED: SKU ${product.code} has zero stock`);
      alert(`[ERROR] TRANSACTION BLOCKED: SKU ${product.code} has zero stock in localized bins. SALE_BLOCKED_ZERO_STOCK event triggered.`);
      return;
    }

    const alreadyInCart = cart.find(c => c.product.id === product.id);
    if (alreadyInCart && alreadyInCart.quantity >= product.stock) {
      logLocalBiEvent(
        'SALE_BLOCKED_ZERO_STOCK',
        `SALE_BLOCKED_ZERO_STOCK: Attempted sale beyond stock limits for ${product.code}`,
        'High'
      );
      alert(`[ERROR] LIMIT EXCEEDED: Only ${product.stock} unit(s) available in local registry.`);
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      } else {
        return [...prev, { product, quantity: 1, discount: 0 }];
      }
    });

    logLocalBiEvent(
      'PRODUCT_ADDED',
      `PRODUCT_ADDED: Added ${product.name} [${product.code}] to transaction`,
      'Low'
    );
    logSalesEvent(
      'PRODUCT_ADDED',
      `PRODUCT_ADDED: Added ${product.name} [${product.code}] to transaction`
    );
  };

  const handleUpdateItemQty = (productId: string, delta: number) => {
    const cartItem = cart.find(c => c.product.id === productId);
    if (!cartItem) return;

    const targetProduct = localProducts.find(p => p.id === productId);
    if (!targetProduct) return;

    const nextQty = cartItem.quantity + delta;
    if (nextQty <= 0) {
      setCart(prev => prev.filter(c => c.product.id !== productId));
      logLocalBiEvent('PRODUCT_ADDED', `PRODUCT_REMOVED: Removed ${cartItem.product.name} from frame`, 'Low');
      logSalesEvent('PRODUCT_REMOVED' as any, `PRODUCT_REMOVED: Removed ${cartItem.product.name} from active slip`);
      return;
    }

    if (nextQty > targetProduct.stock) {
      logLocalBiEvent(
        'SALE_BLOCKED_ZERO_STOCK',
        `SALE_BLOCKED_ZERO_STOCK: Target count ${nextQty} exceeds stock level of ${targetProduct.stock} for ${targetProduct.code}`,
        'High'
      );
      alert(`[WARNING] LIMIT MET: Stock ceiling reached.`);
      return;
    }

    setCart(prev => prev.map(item => item.product.id === productId ? { ...item, quantity: nextQty } : item));
  };

  const handleSetItemDiscount = (productId: string, discountPct: number) => {
    const userRole = roleName as Role;
    const limit = getDiscountLimitForRole(userRole);

    if (discountPct === 0) {
      setCart(prev => prev.map(item => item.product.id === productId ? { ...item, discount: 0 } : item));
      logLocalBiEvent(
        'DISCOUNT_APPLIED',
        `DISCOUNT_APPLIED: Discount line was reset to 0%`,
        'Low'
      );
      return;
    }

    if (discountPct <= limit) {
      setCart(prev => prev.map(item => item.product.id === productId ? { ...item, discount: discountPct } : item));
      logLocalBiEvent(
        'DISCOUNT_APPLIED',
        `DISCOUNT_APPLIED: Manually authorized ${discountPct}% unit line item correction.`,
        'Medium'
      );
      logSalesEvent(
        'DISCOUNT_REQUESTED',
        `DISCOUNT_REQUESTED: Applied ${discountPct}% discount locally.`
      );
    } else {
      const targetItem = cart.find(c => c.product.id === productId);
      if (!targetItem) return;

      const reqId = 'REQ-' + Math.floor(Math.random() * 899 + 100);
      const newRequest: ApprovalRequest = {
        id: reqId,
        type: 'Discount Approval',
        productId,
        productName: targetItem.product.name,
        requestedBy: staffName,
        originalValue: `${targetItem.discount}%`,
        requestedValue: `${discountPct}%`,
        reason: 'Authorized exceed limit campaign',
        status: 'Pending',
        targetDiscountPct: discountPct
      };

      setApprovalRequests(prev => [...prev, newRequest]);

      logLocalBiEvent(
        'PRICE_OVERRIDE_REQUESTED',
        `PRICE_OVERRIDE_REQUESTED: Discount ${discountPct}% requested (exceeds ${userRole} limit ${limit}%)`,
        'High'
      );

      logLocalBiEvent(
        'DISCOUNT_ABOVE_ROLE_LIMIT',
        `DISCOUNT_ABOVE_ROLE_LIMIT: Role ${userRole} limit ${limit}% exceeded with requested ${discountPct}%`,
        'Warning'
      );

      logSalesEvent(
        'DISCOUNT_REQUESTED',
        `DISCOUNT_REQUESTED: Requested ${discountPct}% discount validation for ${targetItem.product.name}`
      );

      alert(`Supervisor approval required for this discount (${discountPct}% exceeds ${userRole} limit of ${limit}%). Request registered with ref id: ${reqId}`);
    }
  };

  // Calculations
  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const price = item.overriddenPrice !== undefined ? item.overriddenPrice : item.product.price;
      return (price * (1 - item.discount / 100)) * item.quantity;
    }, 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    return cartSubtotal * (generalDiscountPercent / 100);
  }, [cartSubtotal, generalDiscountPercent]);

  const cartVat = useMemo(() => {
    return (cartSubtotal - discountAmount) * 0.15; // Standard 15% VAT placeholder
  }, [cartSubtotal, discountAmount]);

  const cartGrandTotal = useMemo(() => {
    return (cartSubtotal - discountAmount) + cartVat;
  }, [cartSubtotal, discountAmount, cartVat]);

  // Initiate sale ticket
  const handleTriggerNewSale = () => {
    setCart([]);
    setCustomerName('');
    setDraftLabel('');
    setGeneralDiscountPercent(0);
    setPaymentMethod('CASH');
    setCheckoutSuccessTicket(null);
    setIsTendering(false);
    setCashTendered('');
    setApprovalRequests([]);
    
    setIsModalOpen(true);
    setModalState('normal');
    logLocalBiEvent('PRODUCT_ADDED', 'TRANSACTION_INITIALIZED: New clean ticket layout spawned', 'Low');
  };

  // Hold / park transaction draft
  const handleHoldDraftTransaction = () => {
    if (cart.length === 0) {
      alert('[ERROR] Cannot hold an empty cart ticket.');
      return;
    }

    const holdRefHash = 'HLD-' + Math.floor(Math.random() * 899 + 100);
    const labelToSubmit = draftLabel.trim().toUpperCase() || `SUSPENDED CUSTOMER_DESK [${holdRefHash}]`;

    const nextHold: LocalHeldTransaction = {
      id: holdRefHash,
      holdNo: 'HLD-' + Math.floor(Math.random() * 89900 + 10000),
      timeStr: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      items: cart,
      subtotal: cartSubtotal,
      total: cartGrandTotal,
      label: labelToSubmit,
      customerName: customerName || 'Unnamed Prospect',
      staffName: staffName,
      branch: branchName,
      terminal: terminalName,
      approvalStatus: approvalRequests.some(r => r.status === 'Pending') ? 'PENDING APPROVALS' : 'CLEAR'
    };

    setLocalHeldTransactions(prev => [nextHold, ...prev]);
    logLocalBiEvent(
      'TRANSACTION_HELD',
      `TRANSACTION_HELD: Parked active transaction to index ledger label: "${nextHold.label}"`,
      'Medium'
    );
    logSalesEvent(
      'TRANSACTION_HELD',
      `TRANSACTION_HELD: Drafted and parked transaction sheet label: "${nextHold.label}"`
    );

    // Keep state clean and close modal
    setCart([]);
    setApprovalRequests([]);
    setIsModalOpen(false);
    alert(`[SUCCESS] Draft Suspended: Transaction saved to local vault under ref ${nextHold.holdNo}`);
  };

  // Restore held transaction to the checkout layout
  const handleRestoreHeldDraft = (held: LocalHeldTransaction) => {
    setCart(held.items);
    setCustomerName(held.customerName);
    setDraftLabel(held.label);
    
    // Clear out this held index
    setLocalHeldTransactions(prev => prev.filter(h => h.id !== held.id));
    
    // Launch form
    setIsModalOpen(true);
    setModalState('normal');
    logLocalBiEvent('PRODUCT_ADDED', `TRANSACTION_RESTORED: Restored draft ref ${held.holdNo}`, 'Low');
  };

  // Discard single held draft
  const handleDeleteHeldDraft = (e: React.MouseEvent, holdId: string) => {
     e.stopPropagation();
    if (confirm('Discard this suspended draft from volatile memory?')) {
      setLocalHeldTransactions(prev => prev.filter(h => h.id !== holdId));
    }
  };

  // Price Override & Void handlers
  const handleInitiatePriceOverride = (item: CartItem) => {
    setPendingPriceOverrideItem(item);
    setRequestedPriceVal(item.product.price.toString());
    setOverrideReason('Customer negotiated bulk discount');
  };

  const handleSubmitPriceOverrideRequest = () => {
    if (!pendingPriceOverrideItem) return;
    const nextPrice = parseFloat(requestedPriceVal);
    if (isNaN(nextPrice) || nextPrice < 0) {
      alert('[ERROR] Please enter a valid decimal price.');
      return;
    }

    const currentPrice = pendingPriceOverrideItem.product.price;
    const reqId = 'REQ-' + Math.floor(Math.random() * 899 + 100);

    const newRequest: ApprovalRequest = {
      id: reqId,
      type: 'Price Override',
      productId: pendingPriceOverrideItem.product.id,
      productName: pendingPriceOverrideItem.product.name,
      requestedBy: staffName,
      originalValue: `USD ${currentPrice.toFixed(2)}`,
      requestedValue: `USD ${nextPrice.toFixed(2)}`,
      reason: overrideReason,
      status: 'Pending',
      targetPrice: nextPrice
    };

    setApprovalRequests(prev => [...prev, newRequest]);
    logLocalBiEvent('PRICE_OVERRIDE_REQUESTED', `PRICE_OVERRIDE_REQUESTED: Requested price override for ${pendingPriceOverrideItem.product.name} to USD ${nextPrice.toFixed(2)}`, 'High');
    logSalesEvent('PRICE_OVERRIDE_REQUESTED', `PRICE_OVERRIDE_REQUESTED: Overriding price for ${pendingPriceOverrideItem.product.name} from USD ${currentPrice.toFixed(2)} to USD ${nextPrice.toFixed(2)}`);

    setPendingPriceOverrideItem(null);
    alert(`Price override request filed for supervisor review. Request Ref: ${reqId}`);
  };

  const handleInitiateVoidLine = (item: CartItem) => {
    // If Owner/SysAdmin/Manager, can do it immediately!
    const userRole = roleName as Role;
    if (userRole === 'Owner' || userRole === 'SysAdmin' || userRole === 'Manager') {
      setCart(prev => prev.filter(c => c.product.id !== item.product.id));
      logLocalBiEvent('PRODUCT_ADDED', `PRODUCT_REMOVED: Removed (Void) ${item.product.name}`, 'Medium');
      logSalesEvent('VOID_REQUESTED', `VOID_AUTHORIZED: Void item ${item.product.name}`);
      return;
    }

    // Cashier, Supervisor, Stock Controller need supervisor approval! Let's check permissions.
    const reqId = 'REQ-' + Math.floor(Math.random() * 899 + 100);
    const newRequest: ApprovalRequest = {
      id: reqId,
      type: 'Void Line',
      productId: item.product.id,
      productName: item.product.name,
      requestedBy: staffName,
      originalValue: `qty ${item.quantity}`,
      requestedValue: 'Void Line Item',
      reason: 'Incorrect commodity entered',
      status: 'Pending'
    };

    setApprovalRequests(prev => [...prev, newRequest]);
    logLocalBiEvent('VOID_REQUESTED', `VOID_REQUESTED: Request registered to Void ${item.product.name}`, 'High');
    logSalesEvent('VOID_REQUESTED', `VOID_REQUESTED: Requested void verification for ${item.product.name}`);
    alert(`Supervisor approval required to Void this line item. Request Ref: ${reqId}`);
  };

  const handleApproveRequest = (request: ApprovalRequest, approverRole: Role, approverName: string) => {
    // Check if the role is authorized to approve this specific request type (with refund limit check)
    if (!canApproveRequest(approverRole, request.type, request.refundAmount)) {
      alert(`[ERROR] Role '${approverRole}' is NOT authorized to resolve a '${request.type}' request.`);
      return;
    }

    setApprovalRequests(prev => prev.map(r => r.id === request.id ? { ...r, status: 'Approved', approvedBy: approverName } : r));

    if (request.type === 'Discount Approval') {
      const discountPct = request.targetDiscountPct || 0;
      setCart(prev => prev.map(item => item.product.id === request.productId ? { ...item, discount: discountPct } : item));
      logLocalBiEvent('DISCOUNT_APPLIED', `DISCOUNT_AUTHORIZED: Approved ${discountPct}% discount on ${request.productName} by ${approverName} (${approverRole})`, 'Medium');
      logSalesEvent('DISCOUNT_REQUESTED', `DISCOUNT_APPROVED: Approved ${discountPct}% discount on ${request.productName} by ${approverName} (${approverRole})`);
    } else if (request.type === 'Price Override') {
      const targetPrice = request.targetPrice || 0;
      setCart(prev => prev.map(item => item.product.id === request.productId ? { ...item, overriddenPrice: targetPrice } : item));
      logLocalBiEvent('PRICE_OVERRIDE_REQUESTED', `PRICE_OVERRIDE_APPROVED: Approved overridden price of USD ${targetPrice.toFixed(2)} on ${request.productName} by ${approverName} (${approverRole})`, 'Medium');
      logSalesEvent('PRICE_OVERRIDE_REQUESTED', `PRICE_OVERRIDE_APPROVED: Price override approved on ${request.productName} to USD ${targetPrice.toFixed(2)} by ${approverName} (${approverRole})`);
    } else if (request.type === 'Void Line') {
      setCart(prev => prev.filter(item => item.product.id !== request.productId));
      logLocalBiEvent('PRODUCT_ADDED', `VOIDED_APPROVED: Item ${request.productName} void finalized by ${approverName} (${approverRole})`, 'Medium');
      logSalesEvent('VOID_REQUESTED', `VOID_APPROVED: Approved voiding of item ${request.productName} by ${approverName} (${approverRole})`);
    } else if (request.type === 'Return Request') {
      setRecentCompletedSales(prev => prev.map(s => s.invoiceNo === request.receiptNo ? { ...s, status: 'RETURNED' } : s));
      const returnQtyMatch = request.requestedValue?.match(/Return Qty:\s*(\d+)/);
      const returnQty = returnQtyMatch ? parseInt(returnQtyMatch[1], 10) : 1;
      const reasonLower = (request.reason || '').toLowerCase();
      const isResellable = reasonLower.includes('resellable') || reasonLower.includes('good') ||
        (!reasonLower.includes('damaged') && !reasonLower.includes('scrap') && !reasonLower.includes('not resellable'));
      const returnedProduct = localProducts.find((product) => product.id === request.productId);
      const returnRef = `RET-${request.id}`;

      if (returnedProduct) {
        if (isResellable) {
          setLocalProducts((prev) => prev.map((product) =>
            product.id === returnedProduct.id
              ? { ...product, stock: product.stock + returnQty }
              : product
          ));
          onProductStockChange(returnedProduct.id, -returnQty);
          void postReturnMovement({
            vendorId: 'SCI-LOG-ZW',
            branchId: returnedProduct.branchId || branchName,
            warehouseId: returnedProduct.warehouseId || returnedProduct.warehouse || 'Main Warehouse',
            productId: returnedProduct.id,
            sku: returnedProduct.sku || returnedProduct.code,
            alu: returnedProduct.alu,
            productNumericNumber: returnedProduct.productNumericNumber,
            productName: returnedProduct.productName || returnedProduct.name,
            shelfLocation: returnedProduct.shelfLocation,
            qtyIn: returnQty,
            qtyOut: 0,
            balanceBefore: returnedProduct.stock,
            unitCost: returnedProduct.costPrice ?? returnedProduct.cost,
            sellingPrice: returnedProduct.sellingPrice ?? returnedProduct.price,
            salesAccountCOA: returnedProduct.salesAccountCOA,
            assetAccountCOA: returnedProduct.assetAccountCOA,
            staffId: approverName,
            staffName: approverName,
            terminalId: terminalName,
            movementDate: new Date().toISOString(),
            referenceNumber: returnRef,
            notes: `Return approved for receipt ${request.receiptNo}. ${request.reason || ''}`,
            riskFlag: 'Low',
            approvalRequired: false,
            status: 'Posted'
          });
          logLocalBiEvent('RETURN_STOCK_POSTED', `RETURN_STOCK_POSTED: ${returnQty} units of ${request.productName} posted back to stock.`, 'Medium');
        } else {
          void postInventoryMovement({
            vendorId: 'SCI-LOG-ZW',
            branchId: returnedProduct.branchId || branchName,
            warehouseId: 'Returns Holding',
            productId: returnedProduct.id,
            sku: returnedProduct.sku || returnedProduct.code,
            alu: returnedProduct.alu,
            productNumericNumber: returnedProduct.productNumericNumber,
            productName: returnedProduct.productName || returnedProduct.name,
            shelfLocation: returnedProduct.shelfLocation,
            movementType: 'DAMAGE_WRITEOFF',
            referenceType: 'RETURN',
            qtyIn: 0,
            qtyOut: returnQty,
            balanceBefore: returnedProduct.stock,
            unitCost: returnedProduct.costPrice ?? returnedProduct.cost,
            sellingPrice: returnedProduct.sellingPrice ?? returnedProduct.price,
            staffId: approverName,
            staffName: approverName,
            terminalId: terminalName,
            movementDate: new Date().toISOString(),
            referenceNumber: returnRef,
            notes: `Non-resellable return routed to review. ${request.reason || ''}`,
            riskFlag: 'High',
            approvalRequired: true,
            status: 'Pending Approval'
          });
          logLocalBiEvent('RETURN_NOT_RESELLABLE_REVIEW_REQUIRED', `RETURN_NOT_RESELLABLE_REVIEW_REQUIRED: ${request.productName} not returned to sellable stock.`, 'High');
        }
      }

      logLocalBiEvent('RETURN_APPROVED', `RETURN_APPROVED: Receipt ${request.receiptNo} return request approved by ${approverName} (${approverRole})`, 'Medium');
      logSalesEvent('RETURN_APPROVED', `RETURN_APPROVED: Supervisor ${approverName} (${approverRole}) finalized Return for ${request.receiptNo}`);
    } else if (request.type === 'Refund Request') {
      setRecentCompletedSales(prev => prev.map(s => s.invoiceNo === request.receiptNo ? { ...s, status: 'REFUNDED' } : s));
      logLocalBiEvent('REFUND_APPROVED', `REFUND_APPROVED: Receipt ${request.receiptNo} refund of USD ${(request.refundAmount || 0).toFixed(2)} approved by ${approverName} (${approverRole})`, 'High');
      logSalesEvent('REFUND_APPROVED', `REFUND_APPROVED: Supervisor ${approverName} (${approverRole}) finalized Refund of USD ${(request.refundAmount || 0).toFixed(2)} for ${request.receiptNo}`);
    } else if (request.type === 'Void Sale') {
      setRecentCompletedSales(prev => prev.map(s => s.invoiceNo === request.receiptNo ? { ...s, status: 'VOIDED' } : s));
      logLocalBiEvent('VOID_APPROVED', `VOID_APPROVED: Receipt ${request.receiptNo} void request approved by ${approverName} (${approverRole})`, 'Critical');
      logSalesEvent('VOID_APPROVED', `VOID_APPROVED: Supervisor ${approverName} (${approverRole}) approved Void of entire Sale ${request.receiptNo}`);
    }

    // Remove approved requests from active queue once processed!
    setApprovalRequests(prev => prev.filter(r => r.id !== request.id));
    alert(`Request ${request.id} successfully authorized by ${approverName}.`);
  };

  const handleRejectRequest = (request: ApprovalRequest, rejecterRole: Role, rejecterName: string) => {
    if (!canApproveRequest(rejecterRole, request.type, request.refundAmount)) {
      alert(`[ERROR] Role '${rejecterRole}' is NOT authorized to resolve a '${request.type}' request.`);
      return;
    }

    setApprovalRequests(prev => prev.map(r => r.id === request.id ? { ...r, status: 'Rejected', approvedBy: rejecterName } : r));

    if (request.type === 'Return Request') {
      logLocalBiEvent('RETURN_REJECTED', `RETURN_REJECTED: Return request for ${request.receiptNo} rejected by ${rejecterName} (${rejecterRole})`, 'High');
      logSalesEvent('RETURN_REJECTED', `RETURN_REJECTED: Return request for ${request.receiptNo} rejected by ${rejecterName} (${rejecterRole})`);
    } else if (request.type === 'Refund Request') {
      logLocalBiEvent('REFUND_REJECTED', `REFUND_REJECTED: Refund request for ${request.receiptNo} of USD ${(request.refundAmount || 0).toFixed(2)} rejected by ${rejecterName} (${rejecterRole})`, 'High');
      logSalesEvent('REFUND_REJECTED', `REFUND_REJECTED: Refund request for ${request.receiptNo} of USD ${(request.refundAmount || 0).toFixed(2)} rejected by ${rejecterName} (${rejecterRole})`);
    } else if (request.type === 'Void Sale') {
      logLocalBiEvent('VOID_REJECTED', `VOID_REJECTED: Void sale request for ${request.receiptNo} rejected by ${rejecterName} (${rejecterRole})`, 'High');
      logSalesEvent('VOID_REJECTED', `VOID_REJECTED: Void sale request for ${request.receiptNo} rejected by ${rejecterName} (${rejecterRole})`);
    } else {
      logLocalBiEvent('PRICE_OVERRIDE_REQUESTED', `REQUEST_REJECTED: Supervisor ${rejecterName} (${rejecterRole}) rejected authorization request ${request.id}`, 'High');
      logSalesEvent('PRICE_OVERRIDE_REQUESTED', `REQUEST_REJECTED: ${request.type} for ${request.productName} rejected by ${rejecterName} (${rejecterRole})`);
    }

    // Remove rejected request
    setApprovalRequests(prev => prev.filter(r => r.id !== request.id));
    alert(`Request ${request.id} has been rejected by ${rejecterName}.`);
  };

  // Complete physical transaction
  const handleFinalizeTransactionComplete = () => {
    if (cart.length === 0) return;

    if (!canPerformAction(roleName as Role, 'COMPLETE_SALE')) {
      alert(`[PERMISSION DENIED] ROLE '${roleName.toUpperCase()}' IS NOT AUTHORIZED TO PERFORMACTION: COMPLETE_SALE`);
      return;
    }

    const pendingRequestCount = approvalRequests.filter(r => r.status === 'Pending').length;
    if (pendingRequestCount > 0) {
      logLocalBiEvent(
        'SALE_COMPLETION_BLOCKED_PENDING_APPROVAL',
        `SALE_COMPLETION_BLOCKED_PENDING_APPROVAL: Compilation blocked. ${pendingRequestCount} approval(s) are currently pending review.`,
        'High'
      );
      logSalesEvent(
        'SALE_COMPLETION_BLOCKED_PENDING_APPROVAL' as any,
        `SALE_COMPLETION_BLOCKED_PENDING_APPROVAL: Checked out blocked with ${pendingRequestCount} pending approvals`
      );
      alert(`[TRANSACTION BLOCKED] Cannot complete sale while supervisor approvals are pending! Please resolve pending requests first.`);
      return;
    }

    const insufficientStockLine = cart.find((item) => {
      const currentProduct = localProducts.find((product) => product.id === item.product.id);
      return !currentProduct || currentProduct.stock < item.quantity;
    });
    if (insufficientStockLine) {
      logLocalBiEvent(
        'SALE_BLOCKED_ZERO_STOCK',
        `SALE_BLOCKED_ZERO_STOCK: ${insufficientStockLine.product.name} has insufficient stock for checkout quantity ${insufficientStockLine.quantity}.`,
        'Critical'
      );
      logSalesEvent('SALE_BLOCKED_ZERO_STOCK' as any, `SALE_BLOCKED_ZERO_STOCK: Blocked insufficient stock sale for ${insufficientStockLine.product.code}`);
      alert(`[SALE BLOCKED] Insufficient stock for ${insufficientStockLine.product.name}.`);
      return;
    }

    // Simulate inventory deductions locally
    const updatedProducts = localProducts.map(p => {
      const soldItem = cart.find(c => c.product.id === p.id);
      if (soldItem) {
        return {
          ...p,
          stock: Math.max(0, p.stock - soldItem.quantity)
        };
      }
      return p;
    });
    setLocalProducts(updatedProducts);

    // Build completed checkout model
    const txnRecord: Transaction = {
      id: 'TXN-' + Math.floor(Math.random() * 8990 + 1000),
      invoiceNo: 'INV-' + Math.floor(Math.random() * 899000 + 100000),
      date: new Date().toISOString(),
      operator: staffName,
      items: cart.map(item => {
        const itemPrice = item.overriddenPrice !== undefined ? item.overriddenPrice : item.product.price;
        return {
          productId: item.product.id,
          name: item.product.name,
          code: item.product.code,
          quantity: item.quantity,
          price: itemPrice * (1 - item.discount / 100),
          total: (itemPrice * (1 - item.discount / 100)) * item.quantity
        };
      }),
      subtotal: cartSubtotal,
      tax: cartVat,
      discount: discountAmount,
      total: cartGrandTotal,
      paymentMethod: paymentMethod === 'CASH' ? 'CASH' : 'CARD', // fallbacks to meet types
      status: 'COMPLETED'
    };

    setRecentCompletedSales(prev => [txnRecord, ...prev]);

    // Dispatch upward callbacks if available
    onAddTransaction({
      operator: staffName,
      items: txnRecord.items,
      subtotal: txnRecord.subtotal,
      tax: txnRecord.tax,
      discount: txnRecord.discount,
      total: txnRecord.total,
      paymentMethod: txnRecord.paymentMethod,
      status: 'COMPLETED'
    });

    cart.forEach(item => {
      onProductStockChange(item.product.id, item.quantity);
      const currentProduct = localProducts.find((product) => product.id === item.product.id) || item.product;
      const balanceBefore = currentProduct.stock;
      void postSaleMovement({
        vendorId: 'SCI-LOG-ZW',
        branchId: currentProduct.branchId || branchName,
        warehouseId: currentProduct.warehouseId || currentProduct.warehouse || 'Main Warehouse',
        productId: currentProduct.id,
        sku: currentProduct.sku || currentProduct.code,
        alu: currentProduct.alu,
        productNumericNumber: currentProduct.productNumericNumber,
        productName: currentProduct.productName || currentProduct.name,
        shelfLocation: currentProduct.shelfLocation,
        qtyIn: 0,
        qtyOut: item.quantity,
        balanceBefore,
        unitCost: currentProduct.costPrice ?? currentProduct.cost,
        sellingPrice: item.overriddenPrice ?? currentProduct.sellingPrice ?? currentProduct.price,
        salesAccountCOA: currentProduct.salesAccountCOA,
        assetAccountCOA: currentProduct.assetAccountCOA,
        staffId: staffName,
        staffName,
        terminalId: terminalName,
        movementDate: txnRecord.date,
        referenceNumber: txnRecord.invoiceNo,
        notes: 'Sale completed from Sales Terminal.',
        riskFlag: 'None',
        approvalRequired: false,
        status: 'Posted'
      });
    });

    logLocalBiEvent(
      'SALE_COMPLETED',
      `SALE_COMPLETED: Successfully compiled invoice ${txnRecord.invoiceNo} totaling USD ${txnRecord.total.toFixed(2)}`,
      'Low'
    );

    addLocalQueueItem({
      domain: 'Sales',
      eventType: 'SALE_COMPLETED',
      reference: txnRecord.invoiceNo,
      createdBy: staffName,
      risk: 'Low',
      payload: JSON.stringify(txnRecord)
    });

    logSalesEvent(
      'SALE_COMPLETED',
      `SALE_COMPLETED: Successfully compiled invoice ${txnRecord.invoiceNo} totaling USD ${txnRecord.total.toFixed(2)}`
    );

    // reset active approvals
    setApprovalRequests([]);

    // Set success modal ticket representation
    setCheckoutSuccessTicket(txnRecord);
  };

  // Print raw slip mockup
  const handleTriggerPrintReceipt = (invoice: Transaction) => {
    alert(`[MOCK RECEIPT PRINTER ROUTE ACTIVATED]\n=====================================\n${vendorName.toUpperCase()}\nBRANCH: ${branchName}\nOPERATOR: ${invoice.operator}\nINVOICE: ${invoice.invoiceNo}\n=====================================\n` + 
      invoice.items.map(i => `${i.name} (x${i.quantity}) - $${i.total.toFixed(2)}`).join('\n') + 
      `\n-------------------------------------\nGRAND TOTAL: USD ${invoice.total.toFixed(2)}\n=====================================`);
  };

  const handleTriggerPrintPreviewAction = (invoice: Transaction) => {
    setSelectedReceiptForPreview(invoice);
    logSalesEvent('RECEIPT_PRINT_PREVIEWED', `RECEIPT_PRINT_PREVIEWED: Opened 80mm secure web receipt preview for ${invoice.invoiceNo}`);
    logLocalBiEvent('RECEIPT_PRINT_PREVIEWED', `RECEIPT_PRINT_PREVIEWED: Opened preview layout for transaction ${invoice.invoiceNo}`, 'Low');
  };

  const handleTriggerReturnFormSubmit = () => {
    if (!selectedReceiptForReturn) return;
    const reqId = 'RET-' + Math.floor(Math.random() * 899 + 100);
    const targetProd = selectedReceiptForReturn.items.find(i => i.productId === returnProductId);
    const prodName = targetProd ? targetProd.name : 'Unknown Product';
    
    const newRequest: ApprovalRequest = {
      id: reqId,
      type: 'Return Request',
      productId: returnProductId,
      productName: prodName,
      receiptNo: selectedReceiptForReturn.invoiceNo,
      requestedBy: staffName,
      originalValue: `qty ${targetProd?.quantity || 1}`,
      requestedValue: `Return Qty: ${returnQuantity}`,
      reason: `${returnReason} (${returnCondition})`,
      status: 'Pending',
      notes: returnNotes
    };

    setApprovalRequests(prev => [...prev, newRequest]);
    
    logSalesEvent('RETURN_REQUESTED', `RETURN_REQUESTED: Return request filled by ${staffName} for product ${prodName} (Qty: ${returnQuantity}) on receipt ${selectedReceiptForReturn.invoiceNo}`);
    logLocalBiEvent('RETURN_REVIEW_REQUIRED' as any, `RETURN_REVIEW_REQUIRED: Supervisor inspection clearance queued for return reference ${reqId}`, 'High');
    
    setSelectedReceiptForReturn(null);
    alert(`Return request submitted successfully. Request Reference: ${reqId}`);
  };

  const handleTriggerRefundFormSubmit = () => {
    if (!selectedReceiptForRefund) return;
    const reqId = 'REF-' + Math.floor(Math.random() * 899 + 100);
    const amount = parseFloat(refundAmountVal) || 0;
    
    const newRequest: ApprovalRequest = {
      id: reqId,
      type: 'Refund Request',
      receiptNo: selectedReceiptForRefund.invoiceNo,
      requestedBy: staffName,
      originalValue: `Receipt Total: USD ${selectedReceiptForRefund.total.toFixed(2)}`,
      requestedValue: `Refund: USD ${amount.toFixed(2)}`,
      reason: refundReasonVal,
      status: 'Pending',
      paymentMethod: refundMethodVal,
      refundAmount: amount,
      notes: refundNotesVal
    };

    setApprovalRequests(prev => [...prev, newRequest]);
    
    logSalesEvent('REFUND_REQUESTED', `REFUND_REQUESTED: Refund of USD ${amount.toFixed(2)} (${refundMethodVal}) filed by ${staffName} for receipt ${selectedReceiptForRefund.invoiceNo}`);
    logLocalBiEvent('REFUND_APPROVAL_REQUIRED' as any, `REFUND_APPROVAL_REQUIRED: Secure clearance code demanded for refund request ${reqId}`, 'High');

    if (amount > 20) {
      logLocalBiEvent('SENSITIVE_SALE_ACTION_REQUESTED' as any, `SENSITIVE_SALE_ACTION_REQUESTED: Refund of USD ${amount.toFixed(2)} exceeds Supervisor authority ($20 limit). Crucial Manager/Owner authentic key required.`, 'High');
    }
    if (refundMethodVal === 'Cash' && amount > 20) {
      logLocalBiEvent('CASH_REFUND_RISK' as any, `CASH_REFUND_RISK: High-volume Cash refund registered. Watch physical cash flows.`, 'Critical');
    }

    setSelectedReceiptForRefund(null);
    alert(`Refund request submitted successfully. Request Reference: ${reqId}`);
  };

  const handleTriggerVoidFormSubmit = () => {
    if (!selectedReceiptForVoid) return;
    const reqId = 'VDS-' + Math.floor(Math.random() * 899 + 100);
    
    const newRequest: ApprovalRequest = {
      id: reqId,
      type: 'Void Sale',
      receiptNo: selectedReceiptForVoid.invoiceNo,
      requestedBy: staffName,
      originalValue: `Active Invoice: USD ${selectedReceiptForVoid.total.toFixed(2)}`,
      requestedValue: 'Void Whole Receipt',
      reason: voidReasonVal,
      status: 'Pending',
      notes: voidSupervisorNoteVal
    };

    setApprovalRequests(prev => [...prev, newRequest]);

    logSalesEvent('VOID_REQUESTED', `VOID_REQUESTED: Void request for entire sale ${selectedReceiptForVoid.invoiceNo} filed by ${staffName}`);
    logLocalBiEvent('VOID_REVIEW_REQUIRED' as any, `VOID_REVIEW_REQUIRED: Secure void clearance queued for transaction ${selectedReceiptForVoid.invoiceNo}`, 'High');

    const existingVoidRequestsCount = approvalRequests.filter(r => r.type === 'Void Sale').length;
    if (existingVoidRequestsCount >= 1) {
      logLocalBiEvent('REPEATED_VOID_ATTEMPT' as any, `REPEATED_VOID_ATTEMPT: Over-concentration of Void Sale requests detected in active session clerk drawers. Monitor for override manipulation.`, 'Critical');
    }

    setSelectedReceiptForVoid(null);
    alert(`Void sale request submitted successfully. Request Reference: ${reqId}`);
  };

  return (
    <div className="space-y-6 font-mono text-xs select-none relative pb-12">
      
      {/* -------------------- MAIN PAGE SUMMARY PANEL AND WORK ENVIRONMENT -------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left main workspace controls */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Header diagnostics ribbon */}
          <div className="bg-white border-2 border-[#b1b5c2] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider font-extrabold">SCI DIVISION • TRANSACTIONS PORTAL</div>
              <h1 className="text-sm font-black text-[#1e222b] uppercase flex items-center gap-2 mt-1">
                <ShoppingBag className="w-5 h-5 text-orange-500" />
                Sales Terminal Clerk Station
              </h1>
              <p className="text-[10px] text-slate-500 mt-1">
                Interactive retail command operations ledger for physical material dispatches and inventory checkout logs.
              </p>
            </div>

            <button
              onClick={handleTriggerTriggerNewSaleWrapper}
              className="px-6 py-3.5 bg-[#f97316] text-white hover:bg-[#ea580c] font-black uppercase tracking-wider flex items-center justify-center gap-2 border border-orange-600 shadow-md hover:shadow-orange-500/10 cursor-pointer text-xs"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              New Sale Form (A5)
            </button>
          </div>

          {/* Local Active Terminal Summary Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            <div className="bg-white border border-[#b1b5c2] p-4 flex items-center gap-3">
              <div className="bg-orange-500/10 p-2.5 text-[#f97316] shrink-0 border border-orange-500/20">
                <Clock className="w-5 h-5" />
              </div>
              <div className="overflow-hidden">
                <span className="text-[8.5px] text-slate-550 block uppercase tracking-wider font-bold">OPERATOR ASSOC</span>
                <span className="font-extrabold text-[#111827] truncate block text-[11px] uppercase mt-0.5">{staffName}</span>
                <span className="text-[9px] text-[#f97316] font-bold block uppercase">{roleName}</span>
              </div>
            </div>

            <div className="bg-white border border-[#b1b5c2] p-4 flex items-center gap-3">
              <div className="bg-slate-100 p-2.5 text-[#1e222b] shrink-0 border border-[#b1b5c2]">
                <Activity className="w-5 h-5" />
              </div>
              <div className="overflow-hidden">
                <span className="text-[8.5px] text-slate-550 block uppercase tracking-wider font-bold">TERMINAL CHASSIS ID</span>
                <span className="font-extrabold text-[#111827] truncate block text-[11px] uppercase mt-0.5">{terminalName}</span>
                <span className="text-[9px] text-slate-500 block uppercase">STATION CONNECTED</span>
              </div>
            </div>

            <div className="bg-white border border-[#b1b5c2] p-4 flex items-center gap-3">
              <div className="bg-orange-500/10 p-2.5 text-[#f97316] shrink-0 border border-orange-500/20">
                <Database className="w-5 h-5" />
              </div>
              <div className="overflow-hidden">
                <span className="text-[8.5px] text-slate-550 block uppercase tracking-wider font-bold">BRANCH REGISTRY</span>
                <span className="font-extrabold text-[#111827] truncate block text-[11px] uppercase mt-0.5">{branchName}</span>
                <span className="text-[9px] text-slate-550 block uppercase">{vendorName}</span>
              </div>
            </div>

          </div>

          {/* Standard Held Cabinet Drafts */}
          <div className="bg-white border border-[#b1b5c2] p-5">
            <div className="text-[10px] font-black text-[#1e222b] uppercase tracking-wider pb-2 border-b border-gray-200 flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FolderLock className="w-4 h-4 text-orange-500" />
                <span>HELD SUSPENDED TRANSACTIONS CABINET</span>
              </div>
              <span className="text-[9px] font-bold text-slate-400">STATUS: VOLATILE RAM STORE</span>
            </div>

            {localHeldTransactions.length === 0 ? (
              <div className="p-12 text-center border-2 border-dashed border-[#b1b5c2] flex flex-col items-center justify-center text-slate-400 bg-gray-50/50">
                <Database className="w-10 h-10 text-slate-300 mb-2" />
                <span className="text-[10px] font-bold uppercase block text-slate-500">Draft Archive Desk Empty</span>
                <span className="text-[9px] mt-1 text-slate-400">Suspend intermediate checkout tickets inside the A5 modal to park them here</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {localHeldTransactions.map(held => (
                  <div
                    key={held.id}
                    onClick={() => handleRestoreHeldDraft(held)}
                    className="border border-[#b1b5c2] hover:border-orange-500 bg-white p-4 flex flex-col justify-between h-36 hover:bg-slate-50/50 transition-colors cursor-pointer group relative"
                  >
                    <div>
                      <div className="flex justify-between items-center text-[9px] font-bold border-b border-gray-100 pb-1.5 mb-2">
                        <span className="text-orange-500">{held.holdNo}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400">{held.timeStr}</span>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteHeldDraft(e, held.id)}
                            className="p-1 text-slate-400 hover:text-red-500 hover:bg-slate-100 uppercase"
                            title="Purge draft file"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <h3 className="font-bold text-[#1e222b] text-[11px] uppercase truncate">
                        {held.label}
                      </h3>
                      <p className="text-[9.5px] text-slate-500 uppercase mt-1">
                        Customer: <strong className="text-slate-700">{held.customerName}</strong>
                      </p>
                    </div>

                    <div className="flex justify-between items-end border-t border-gray-100 pt-2 mt-2">
                      <div>
                        <span className="text-[8px] text-slate-400 block uppercase">Draft Value</span>
                        <span className="text-[#1e222b] font-black text-xs">USD {held.total.toFixed(2)}</span>
                      </div>
                      <span className="text-orange-500 font-extrabold text-[9px] flex items-center gap-1 opacity-80 group-hover:opacity-100 uppercase">
                        Load ticket &rarr;
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SUPERVISOR APPROVAL QUEUE - PART 3 */}
          <div className="bg-white border border-[#b1b5c2] p-5">
            <div className="text-[10px] font-black text-[#1e222b] uppercase tracking-wider pb-2 border-b border-gray-200 flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-orange-500" />
                <span>SUPERVISOR SECURE APPROVAL QUEUE</span>
              </div>
              <span className="text-[8.5px] font-black text-red-500 animate-pulse uppercase">PENDING CLERK OVERRIDES</span>
            </div>

            {/* Mock Reviewer Control Panel */}
            <div className="mb-4 bg-slate-50 border border-slate-200 p-3 grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono">
              <div>
                <label className="text-[8px] font-extrabold text-[#111827] uppercase tracking-wider block mb-1">
                  ACTING REVIEWER ROLE (FOR MOCK TESTING)
                </label>
                <select 
                  id="mock-reviewer-role-picker"
                  defaultValue="Supervisor"
                  className="w-full bg-white text-[#1e222b] border border-[#b1b5c2] rounded-none px-2 py-1.5 font-bold uppercase text-[9px] outline-none"
                >
                  <option value="Supervisor">Supervisor (Authorized for Void/Override/Disc)</option>
                  <option value="Manager">Manager (Authorized for Void/Override/Disc)</option>
                  <option value="SysAdmin">SysAdmin (Universal Access)</option>
                  <option value="Owner">Owner (Universal Access)</option>
                </select>
              </div>

              <div>
                <label className="text-[8px] font-extrabold text-[#111827] uppercase tracking-wider block mb-1">
                  ACTING REVIEWER NAME
                </label>
                <input 
                  id="mock-reviewer-name-input"
                  type="text"
                  defaultValue="Supervisor Steve (SCI-09)"
                  placeholder="Steve (SCI-09)"
                  className="w-full bg-white text-[#1e222b] border border-[#b1b5c2] rounded-none px-2 py-1.5 font-bold text-[9px] uppercase outline-none"
                />
              </div>
            </div>

            {approvalRequests.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-emerald-300 bg-emerald-50/20 text-[#047857] font-mono">
                <span className="text-[9.5px] font-extrabold uppercase block text-emerald-700">All clearance queues are empty</span>
                <span className="text-[8.5px] text-slate-500 mt-1 uppercase block">Any cashier action exceeding role limits will register review tickets here.</span>
              </div>
            ) : (
              <div className="space-y-4">
                {approvalRequests.map(req => (
                  <div key={req.id} className="border-2 border-orange-500 bg-orange-50/10 p-4 space-y-3.5 shadow-sm font-mono text-[10px] text-[#1e222b]">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-2 pb-2 border-b-2 border-orange-200">
                      <div>
                        <span className="text-[7.5px] bg-[#1e222b] text-white px-1.5 py-0.5 font-black uppercase tracking-wider">
                          {req.type}
                        </span>
                        <h4 className="font-extrabold text-[#111827] uppercase mt-1">
                          Ref: {req.id} {req.productName ? `| ${req.productName}` : ''}
                        </h4>
                      </div>
                      <span className="text-[8px] font-black text-orange-600 block uppercase pt-1">
                        STATUS: {req.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-800 uppercase text-[9px] bg-white/40 p-2.5 border border-orange-200/50">
                      <div>
                        <span className="text-[7.5px] text-slate-400 block font-black mb-0.5">REQUESTER</span>
                        <strong className="text-slate-900">{req.requestedBy}</strong>
                      </div>
                      <div>
                        <span className="text-[7.5px] text-slate-400 block font-black mb-0.5">DETAIL / RECEIPT</span>
                        <strong className="text-slate-900">{req.receiptNo || 'Active Checkout'}</strong>
                      </div>
                      <div>
                        <span className="text-[7.5px] text-slate-400 block font-black mb-0.5">ORIGINAL VALUE</span>
                        <strong className="text-slate-900">{req.originalValue}</strong>
                      </div>
                      <div>
                        <span className="text-[7.5px] text-slate-500 block font-black mb-0.5">PROPOSED VALUE</span>
                        <strong className="text-orange-600 font-extrabold">{req.requestedValue}</strong>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[9px]">
                      <div className="bg-white/40 p-2 border border-orange-200/30">
                        <span className="text-[7.5px] text-slate-400 block font-black mb-0.5">REASON / JUSTIFICATION</span>
                        <span className="text-slate-800 font-semibold">{req.reason}</span>
                      </div>
                      {req.notes && (
                        <div className="bg-white/40 p-2 border border-orange-200/30">
                          <span className="text-[7.5px] text-slate-400 block font-black mb-0.5">CLERK SYSTEM NOTES</span>
                          <span className="text-slate-800 font-semibold normal-case truncate block" title={req.notes}>{req.notes}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2.5 pt-2 border-t border-orange-200">
                      <button
                        type="button"
                        onClick={() => {
                          const picker = document.getElementById('mock-reviewer-role-picker') as HTMLSelectElement | null;
                          const nameInput = document.getElementById('mock-reviewer-name-input') as HTMLInputElement | null;
                          const activeRole = (picker?.value || 'Supervisor') as Role;
                          const activeName = nameInput?.value || 'Supervisor Steve';
                          handleApproveRequest(req, activeRole, activeName);
                        }}
                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-750 text-white font-extrabold uppercase text-[9px] tracking-wider text-center cursor-pointer border-0"
                      >
                        Approve &amp; Authenticate
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          alert(`[QUEUE INFO DIALOG - SECURE AUDIT REVIEW]\n======================================\nREASON: ${req.reason}\nREQUESTER: ${req.requestedBy}\nVALUE: ${req.requestedValue}\nRECEIPT REF: ${req.receiptNo || 'N/A'}\nNOTES: ${req.notes || 'None logged by cashier'}\nSTATUS: ${req.status}\n======================================`);
                        }}
                        className="py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white font-extrabold uppercase text-[9px] tracking-wider text-center cursor-pointer border-0"
                      >
                        Review / Info
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const picker = document.getElementById('mock-reviewer-role-picker') as HTMLSelectElement | null;
                          const nameInput = document.getElementById('mock-reviewer-name-input') as HTMLInputElement | null;
                          const activeRole = (picker?.value || 'Supervisor') as Role;
                          const activeName = nameInput?.value || 'Supervisor Steve';
                          handleRejectRequest(req, activeRole, activeName);
                        }}
                        className="py-2 px-4 bg-rose-600 hover:bg-rose-700 text-white font-extrabold uppercase text-[9px] tracking-wider text-center cursor-pointer border-0"
                      >
                        REJECT
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>        {/* Right side operational log */}
        <div className="lg:col-span-4 bg-white border border-[#b1b5c2] p-5 h-[840px] flex flex-col justify-between">
          <div className="flex-1 flex flex-col overflow-hidden">
            
            <div className="border-b border-gray-200 pb-3 mb-4 flex justify-between items-center">
              <span className="text-[10px] font-black text-[#1e222b] uppercase tracking-wider flex items-center gap-2">
                <History className="w-4 h-4 text-orange-500" />
                Completed Receipts Stack
              </span>
              <span className="text-[9px] bg-slate-900 text-white px-2 py-0.5 font-bold">
                {recentCompletedSales.length} SECURED
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pos-custom-scroll pr-1 text-[#1e222b]">
              {recentCompletedSales.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-[#b1b5c2] text-center p-4">
                  <Printer className="w-8 h-8 text-slate-300 mb-2" />
                  <span className="text-[9.5px] font-bold uppercase text-slate-500">No session sales yet</span>
                  <span className="text-[8px] mt-1 text-slate-450">Invoices cleared from active clerk drawers will display in this stack</span>
                </div>
              ) : (
                recentCompletedSales.map(t => (
                  <div 
                    key={t.id} 
                    className="border-2 border-[#b1b5c2] bg-white p-3.5 text-[10px] space-y-2.5 shadow-sm hover:border-orange-500 transition-colors font-mono uppercase"
                  >
                    <div className="flex justify-between items-start border-b border-gray-150 pb-1.5 pb-2">
                      <div>
                        <span className="text-orange-600 font-extrabold text-[11px] block">{t.invoiceNo}</span>
                        <span className="text-[7.5px] text-slate-400 block mt-0.5 font-bold">
                          DATE: {new Date(t.date).toLocaleDateString()} {new Date(t.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="font-extrabold text-slate-900 text-[11px]">USD {t.total.toFixed(2)}</span>
                        <span className={`text-[7.5px] px-1.5 py-0.5 font-black uppercase tracking-wider text-white mt-1 ${
                          t.status === 'COMPLETED' ? 'bg-emerald-600' :
                          t.status === 'REFUNDED' ? 'bg-amber-600' :
                          t.status === 'RETURNED' ? 'bg-indigo-600' :
                          'bg-red-600'
                        }`}>
                          {t.status}
                        </span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[8.5px] text-slate-600 border-b border-gray-100 pb-2">
                      <div>
                        <span className="text-slate-400 text-[7.5px] font-bold block">CLERK</span>
                        <span className="truncate block font-semibold">{t.operator}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[7.5px] font-bold block">TERMINAL</span>
                        <span className="truncate block font-semibold">{t.terminal || 'POS-01'}</span>
                      </div>
                      <div className="col-span-2 mt-0.5">
                        <span className="text-slate-400 text-[7.5px] font-bold block">CUSTOMER</span>
                        <span className="truncate block font-semibold">{t.customerName || 'Walk-in Customer'}</span>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-2 border border-slate-200 text-[8.5px] leading-tight space-y-1">
                      <span className="text-slate-400 text-[7.5px] font-black uppercase block border-b border-slate-150 pb-0.5 mb-1.5">
                        SECURED LINES ({t.items.length})
                      </span>
                      {t.items.map((itm, idx) => (
                        <div key={idx} className="flex justify-between text-slate-700">
                          <span className="truncate max-w-[150px] font-medium">&bull; {itm.name}</span>
                          <span className="font-bold">x{itm.quantity}</span>
                        </div>
                      ))}
                    </div>

                    <div className="text-[8.5px] text-slate-500 uppercase flex justify-between pt-0.5 pb-1">
                      <span>METHOD: <strong className="text-slate-800 font-bold">{t.paymentMethod}</strong></span>
                      <span>REF: <strong className="text-slate-800 font-bold">{t.id}</strong></span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => handleTriggerPrintPreviewAction(t)}
                        className="py-1.5 bg-slate-900 hover:bg-orange-500 text-white font-extrabold uppercase text-[8px] transition-colors cursor-pointer text-center-imp"
                      >
                        Receipt Slip
                      </button>
                      <button
                        disabled={t.status === 'RETURNED' || t.status === 'VOIDED'}
                        onClick={() => {
                          setSelectedReceiptForReturn(t);
                          if (t.items.length > 0) {
                            setReturnProductId(t.items[0].productId);
                          }
                          setReturnQuantity(1);
                          setReturnReason('Wrong item supplied');
                          setReturnCondition('Resellable');
                          setReturnNotes('');
                        }}
                        className="py-1.5 bg-white border border-[#b1b5c2] hover:border-orange-500 hover:text-orange-500 font-bold uppercase text-[8px] transition-colors cursor-pointer disabled:opacity-40 disabled:hover:text-inherit disabled:hover:border-[#b1b5c2]"
                      >
                        Return Stock
                      </button>
                      <button
                        disabled={t.status === 'REFUNDED' || t.status === 'VOIDED'}
                        onClick={() => {
                          setSelectedReceiptForRefund(t);
                          setRefundAmountVal(t.total.toString());
                          setRefundMethodVal('Cash');
                          setRefundReasonVal('Wrong size supplied');
                          setRefundNotesVal('');
                        }}
                        className="py-1.5 bg-white border border-[#b1b5c2] hover:border-orange-500 hover:text-orange-500 font-bold uppercase text-[8px] transition-colors cursor-pointer disabled:opacity-40 disabled:hover:text-inherit disabled:hover:border-[#b1b5c2]"
                      >
                        Refund Cash
                      </button>
                      <button
                        disabled={t.status === 'VOIDED'}
                        onClick={() => {
                          setSelectedReceiptForVoid(t);
                          setVoidReasonVal('Wrong sale captured');
                          setVoidSupervisorNoteVal('');
                        }}
                        className="py-1.5 bg-rose-50 border border-rose-300 hover:bg-rose-100 text-rose-700 font-bold uppercase text-[8px] transition-colors cursor-pointer disabled:opacity-40 disabled:hover:bg-rose-50"
                      >
                        Void Sale
                      </button>
                    </div>

                  </div>
                ))
              )}
            </div>

            {/* LIVE SALES EVENT FEED - PART 7 */}
            <div className="border-t border-gray-200 pt-4 mt-4 flex flex-col flex-1 overflow-hidden">
              <div className="border-b border-gray-200 pb-2 mb-2 flex justify-between items-center">
                <span className="text-[10px] font-black text-[#1e222b] uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-orange-500" />
                  Live Sales Event Feed
                </span>
                <span className="text-[8px] bg-slate-900 text-orange-500 px-1.5 py-0.5 font-bold uppercase tracking-wider">
                  Intel SECURE
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2.5 pos-custom-scroll pr-1 max-h-[280px]">
                {salesEvents.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 uppercase text-[9px]">
                    No security event codes logged yet.
                  </div>
                ) : (
                  salesEvents.map(ev => (
                    <div key={ev.id} className="p-2.5 bg-slate-50 border border-slate-200 text-[9px] leading-snug space-y-1 text-slate-800">
                      <div className="flex justify-between items-start text-slate-400 font-extrabold text-[8px] tracking-tight">
                        <span className="text-orange-600 font-black uppercase">[{ev.eventType}]</span>
                        <span>{ev.timestamp}</span>
                      </div>
                      <p className="uppercase font-semibold text-slate-800 tracking-wide text-[8.5px] leading-tight">
                        {ev.message}
                      </p>
                      <div className="text-slate-400 text-[7.5px] uppercase font-bold pt-0.5 leading-none">
                        Ref ID: {ev.id} &bull; Op: {ev.operator}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

          <div className="border-t border-gray-100 pt-3 flex justify-between text-[8px] uppercase tracking-wider text-slate-400 pt-2.5">
            <span>OFFLINE ARCHIVE PROTOCOL</span>
            <span className="text-emerald-600 font-extrabold animate-pulse">● FEED SECURED</span>
          </div>

        </div>

      </div>

      {/* -------------------- DYNAMIC MINI WINDOW / TASKBAR SYSTEM -------------------- */}
      {isModalOpen && modalState === 'minimized' && (
        <div className="fixed bottom-0 right-0 left-0 bg-slate-900 text-white p-3 z-[999] flex items-center justify-between font-mono animate-pulse border-t-4 border-orange-500 shadow-2xl">
          <div className="flex items-center gap-3">
            <span className="inline-block w-2.5 h-2.5 bg-orange-500 shrink-0"></span>
            <div>
              <span className="text-[10px] text-slate-300 uppercase font-black tracking-wider block">
                MINIMIZED PROCESS: ACTIVE SALE TRANSACTION TERM_A
              </span>
              <span className="text-orange-400 text-[10px] font-bold">
                Cart Buffer: {cart.length} item(s) • Total Queue: USD {cartGrandTotal.toFixed(2)}
              </span>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => setModalState('normal')}
              className="bg-orange-500 text-white border border-orange-600 px-3 py-1.5 text-[9px] uppercase font-black hover:bg-orange-600 cursor-pointer"
            >
              Restore Window (A5)
            </button>
            <button
              onClick={handleCloseModalWithInterlocks}
              className="bg-slate-800 border border-slate-700 text-slate-300 px-3 py-1.5 text-[9px] uppercase font-bold hover:border-rose-500 transition-colors cursor-pointer"
            >
              Erase Ticket
            </button>
          </div>
        </div>
      )}

      {/* -------------------- A5 CORPORATE PORTRAIT FLOATING TRANSACTION WINDOW SYSTEM -------------------- */}
      {isModalOpen && modalState !== 'minimized' && (
        <div className="fixed inset-0 bg-slate-950/70 z-[800] flex items-center justify-center p-4">
          
          <div 
            className={`bg-[#f3f4f6] border-2 border-[#1e222b] shadow-2xl flex flex-col justify-between text-xs tracking-wide transition-all z-[900] ${
              modalState === 'maximized' 
                ? 'w-full h-full max-w-none max-h-none border-t-8 border-t-orange-500' 
                : 'w-[480px] h-[780px] max-w-full max-h-[96vh]' // Clean Portrait A5 Professional desktop sheet limits
            }`}
          >
            
            {/* SOLID CHARCOAL MATTE TITLEBAR HEADER */}
            <div className="h-11 bg-[#1e222b] flex items-center justify-between px-4 select-none shrink-0 border-b-2 border-orange-500 text-white">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-orange-500 shrink-0" />
                <span className="font-black text-[10.5px] uppercase tracking-wider text-slate-50">
                  {modalState === 'maximized' ? 'MAXIMIZED ENGINE: SCI TICKET COMPILER' : 'A5 TICKET: New Sale Transaction'}
                </span>
              </div>

              {/* Standard window controls layout */}
              <div className="flex items-center gap-1.5">
                
                {/* Minimize button */}
                <button
                  type="button"
                  onClick={() => setModalState('minimized')}
                  className="p-1 text-slate-450 hover:text-orange-500 hover:bg-slate-800 border border-transparent transition-colors"
                  title="Minimize window into taskbar"
                >
                  <Minus className="w-3.5 h-3.5 text-slate-400 hover:text-orange-500" />
                </button>

                {/* Maximization to Standard conversions */}
                {modalState === 'maximized' ? (
                  <button
                    type="button"
                    onClick={() => setModalState('normal')}
                    className="p-1 text-slate-450 hover:text-orange-500 hover:bg-slate-800 border border-transparent transition-colors"
                    title="Restore standard window dimensions"
                  >
                    <Copy className="w-3.5 h-3.5 rotate-180 text-slate-450" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setModalState('maximized')}
                    className="p-1 text-slate-450 hover:text-orange-500 hover:bg-slate-800 border border-transparent transition-colors"
                    title="Maximize window to entire desktop layout"
                  >
                    <Square className="w-3.5 h-3.5 text-slate-400 hover:text-orange-500" />
                  </button>
                )}

                {/* Direct Close action */}
                <button
                  type="button"
                  onClick={handleCloseModalWithInterlocks}
                  className="p-1 hover:bg-red-950 transition-colors border border-transparent"
                  title="Close and release active registers"
                >
                  <X className="w-4 h-4 text-red-500 stroke-[3]" />
                </button>

              </div>
            </div>

            {/* DUAL WORKSPACE SPLIT (A5 SHEET LAYER) */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 pos-custom-scroll bg-[#f3f4f6]">
              
              {/* Product quick searches */}
              <div className="bg-white border border-[#b1b5c2] p-3 space-y-3">
                <div className="text-[8.5px] text-slate-500 font-extrabold uppercase tracking-wider flex justify-between">
                  <span>DISPATCH SYSTEM: PRODUCT EXPEDITOR</span>
                  <span className="text-slate-400">VOLATILE CHASSIS CORES</span>
                </div>

                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by SKU, Product Name, Category..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white text-[#1e222b] placeholder-slate-400 border border-[#b1b5c2] focus:border-orange-500 outline-none pl-8 pr-8 py-2 text-[10.5px] rounded-none font-bold uppercase transition-colors"
                  />
                  {searchTerm && (
                    <button 
                      onClick={() => setSearchTerm('')} 
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-800"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Compact styling category selectors */}
                <div className="flex flex-wrap gap-1 border-t border-gray-100 pt-2">
                  {selectCategories.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-2 py-0.5 text-[8px] uppercase border transition-colors rounded-none ${
                        selectedCategory === cat
                          ? 'border-orange-500 text-orange-500 bg-orange-50/50 font-black'
                          : 'border-[#b1b5c2] hover:border-orange-500 text-slate-500 bg-white'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Matched product selector row lists */}
              <div className="bg-white border border-[#b1b5c2] p-3 space-y-2">
                <span className="text-[8.5px] text-slate-500 font-black uppercase tracking-wider block border-b border-slate-100 pb-1">
                  MATCHED REGISTRY ENTRIES ({matchedProductListing.length} ENTITIES)
                </span>

                <div className="grid grid-cols-1 gap-1 max-h-[140px] overflow-y-auto pos-custom-scroll pr-1">
                  {matchedProductListing.map(p => {
                    const isInCart = cart.find(c => c.product.id === p.id);
                    const stockVal = p.stock - (isInCart?.quantity || 0);
                    const isOutOfStock = stockVal <= 0;

                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleAddToCart(p)}
                        className={`text-left p-1.5 border flex items-center justify-between text-[10px] rounded-none transition-all ${
                          isOutOfStock
                            ? 'border-red-200 bg-red-50/40 text-red-750'
                            : 'border-[#b1b5c2] hover:border-orange-500 bg-white text-slate-900 group hover:bg-slate-50'
                        }`}
                      >
                        <div className="truncate max-w-[70%]">
                          <span className="text-slate-400 text-[8px] font-bold font-mono mr-1">[{p.code}]</span>
                          <span className="font-extrabold text-slate-800 uppercase group-hover:text-orange-600 block sm:inline">{p.name}</span>
                          <span className="text-[8px] text-slate-550 block font-normal uppercase">CAT: {p.category} | STOCK BINS: {p.stock}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900 text-[10.5px]">USD {p.price.toFixed(2)}</span>
                          {isInCart && (
                            <span className="bg-orange-500 text-white font-extrabold text-[8.5px] px-1.5 py-0.5">
                              x{isInCart.quantity}
                            </span>
                          )}
                          {isOutOfStock && (
                            <span className="bg-red-500 text-white text-[8px] uppercase font-bold px-1 py-0.2 animate-pulse shrink-0">
                              No Stock
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                  {matchedProductListing.length === 0 && (
                    <div className="text-center py-4 text-slate-400 uppercase text-[9px]">
                      No matching hardware parts found in system logs.
                    </div>
                  )}
                </div>
              </div>

              {/* ACTIVE SHOPPING TICKET MATRIX TABLE */}
              <div className="bg-white border border-[#b1b5c2] align-middle p-3 flex-1 flex flex-col justify-between">
                <div>
                  <div className="text-[9px] font-black text-slate-900 uppercase tracking-wider mb-2 pb-1.5 border-b border-gray-100 flex justify-between">
                    <span>Active Invoice Line Entries ({cart.length})</span>
                    <span>STANDARDIZED CORE RATES</span>
                  </div>

                  {cart.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 bg-slate-50/30 flex flex-col items-center justify-center">
                      <Scan className="w-7 h-7 text-slate-350 mb-2 animate-pulse" />
                      <span className="text-[9.5px] font-bold uppercase block text-slate-550">Shopping Ledger List Empty</span>
                      <span className="text-[8px] text-slate-400 mt-1 uppercase">Select materials from match search lists above to add lines</span>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-[10px] text-left border-collapse min-w-[340px]">
                        <thead>
                          <tr className="border-b-2 border-slate-900 text-slate-400 uppercase text-[8px] font-black">
                            <th className="py-1">Part SKU / Description</th>
                            <th className="py-1 text-center">Qty</th>
                            <th className="py-1 text-center">Disc %</th>
                            <th className="py-1 text-right">Line Total</th>
                            <th className="py-1 text-center w-6"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 font-mono">
                          {cart.map(item => {
                            const basePrice = item.overriddenPrice !== undefined ? item.overriddenPrice : item.product.price;
                            const lineBasePr = basePrice * (1 - item.discount / 100);
                            const lineTotalVal = lineBasePr * item.quantity;

                            return (
                              <tr key={item.product.id} className="hover:bg-slate-50">
                                <td className="py-2 pr-1.5 max-w-[140px]">
                                  <div className="font-extrabold text-[#111827] truncate uppercase">{item.product.name}</div>
                                  <div className="text-[8px] text-slate-400 mt-0.5 space-y-0.5">
                                    <div>SKU: {item.product.code} @ ${item.product.price.toFixed(2)}</div>
                                    {item.overriddenPrice !== undefined && (
                                      <div className="text-[#f97316] font-extrabold uppercase">OVERRIDDEN RATE: USD {item.overriddenPrice.toFixed(2)}</div>
                                    )}
                                  </div>
                                  <div>
                                    <button
                                      type="button"
                                      onClick={() => handleInitiatePriceOverride(item)}
                                      className="mt-1 text-[7.5px] bg-slate-100 hover:bg-orange-500 hover:text-white text-slate-700 px-1 py-0.5 border border-slate-350 font-black uppercase tracking-wider block"
                                      title="Override unit price"
                                    >
                                      OVERRIDE
                                    </button>
                                  </div>
                                </td>
                                
                                <td className="py-1.5 text-center">
                                  <div className="inline-flex items-center border border-[#b1b5c2] bg-[#f3f4f6]">
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateItemQty(item.product.id, -1)}
                                      className="px-1 py-0.5 text-[#1e222b] hover:bg-slate-200 font-black cursor-pointer"
                                    >
                                      <Minus className="w-2 h-2 text-slate-900" />
                                    </button>
                                    <span className="w-4 text-center font-bold text-slate-900 text-[10px]">{item.quantity}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateItemQty(item.product.id, 1)}
                                      className="px-1 py-0.5 text-[#1e222b] hover:bg-slate-200 font-black cursor-pointer"
                                    >
                                      <Plus className="w-2 h-2 text-slate-900" />
                                    </button>
                                  </div>
                                </td>

                                <td className="py-1.5 text-center">
                                  <select
                                    value={item.discount}
                                    onChange={(e) => handleSetItemDiscount(item.product.id, parseInt(e.target.value))}
                                    className="bg-white text-orange-600 border border-[#b1b5c2] text-[8.5px] font-bold p-0.5"
                                  >
                                    <option value={0}>0%</option>
                                    <option value={5}>5%</option>
                                    <option value={10}>10%</option>
                                    <option value={15}>15%</option>
                                    <option value={20}>20%</option>
                                    <option value={30}>30%</option>
                                    <option value={50}>50%</option>
                                    <option value={100}>100%</option>
                                  </select>
                                </td>

                                <td className="py-1.5 text-right font-black text-slate-905">
                                  USD {lineTotalVal.toFixed(2)}
                                </td>

                                <td className="py-1.5 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleInitiateVoidLine(item)}
                                    className="text-slate-400 hover:text-red-500 transition-colors p-0.5"
                                    title="Exclude product (Void)"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 shrink-0" />
                                  </button>
                                </td>

                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {cart.length > 0 && (
                  <div className="flex justify-between items-center text-[8px] text-slate-400 pt-2 border-t border-dashed border-gray-200 mt-2">
                    <span>SECURITY CODES: STAMPED</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('Erase all current checkout entries?')) {
                          setCart([]);
                          logLocalBiEvent('CART_CLEARED', 'CART_CLEARED: Active shopping ledger flushed empty', 'Medium');
                        }
                      }}
                      className="text-red-500 hover:underline font-bold uppercase transition-all"
                    >
                      Clear Checkout Ledger
                    </button>
                  </div>
                )}

              </div>

              {/* IDENTIFYING DISPATCH LABELS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white border border-[#b1b5c2] p-3">
                <div className="space-y-1">
                  <label className="text-[8.5px] font-black block text-slate-500 uppercase tracking-widest">
                    Customer Name / Prospect
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. John Doe / Fleet Dispatch"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full bg-white text-[#1e222b] placeholder-slate-350 border border-[#b1b5c2] focus:border-orange-500 rounded-none px-2.5 py-1.5 text-[10px] font-bold uppercase"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[8.5px] font-black block text-slate-500 uppercase tracking-widest">
                    Internal Dispatch Label/Note
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. RADIATOR ASSEMBLY BACKORDER DRAFT"
                    value={draftLabel}
                    onChange={(e) => setDraftLabel(e.target.value)}
                    className="w-full bg-white text-[#1e222b] placeholder-slate-350 border border-[#b1b5c2] focus:border-orange-500 rounded-none px-2.5 py-1.5 text-[10px] font-bold uppercase"
                  />
                </div>
              </div>

              {/* LOCAL EMBED BI TELEMETRY ALERT EVENT FEED (Beside/Inside the A5 sheet frame) */}
              <div className="bg-[#1e222b] text-[#d1d5db] border border-[#1e222b] p-3 space-y-1.5">
                <p className="text-[8.5px] font-black text-orange-500 uppercase tracking-wider flex items-center justify-between">
                  <span>● RECENT TRANSACTIONS EVENT FEED</span>
                  <span className="text-[8px] text-slate-400">TELEMETRY MONITOR ACTIVE</span>
                </p>
                <div className="h-20 overflow-y-auto pr-1 pos-custom-scroll space-y-1">
                  {biEvents.map((ev) => (
                    <div 
                      key={ev.id} 
                      className="text-[9px] border-b border-slate-800 pb-1 flex justify-between items-start gap-1 font-mono"
                    >
                      <div className="overflow-hidden">
                        <strong className={`font-black uppercase text-[8.5px] ${
                          ev.severity === 'Critical' ? 'text-red-500 animate-pulse' :
                          ev.severity === 'High' ? 'text-orange-500' :
                          'text-orange-400'
                        }`}>
                          [{ev.type}]
                        </strong>
                        <span className="text-slate-300 block leading-tight">{ev.message}</span>
                      </div>
                      <span className="text-slate-550 shrink-0 text-[8px]">{ev.time}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* FLOATING WINDOW TENDER DETAILS PANEL (FOOTER SUMMARY) */}
            <div className="bg-[#1e222b] border-t border-[#1e222b] p-4 text-white space-y-4 shrink-0 font-mono">
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 items-end">
                
                {/* General discount slider % */}
                <div className="space-y-1">
                  <label className="text-[8.5px] text-slate-400 font-bold uppercase block">Window Discount %</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1.5 text-orange-500 text-[9.5px] font-bold">%</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={generalDiscountPercent || ''}
                      onChange={(e) => {
                        if (!canPerformAction(roleName as Role, 'APPLY_DISCOUNT')) {
                          alert(`[PERMISSION DENIED] ROLE '${roleName.toUpperCase()}' IS NOT AUTHORIZED TO PERFORMACTION: APPLY_DISCOUNT`);
                          return;
                        }
                        setGeneralDiscountPercent(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)));
                      }}
                      className="w-full bg-[#2e3542] text-white border border-[#b1b5c2] focus:border-orange-500 pl-6 pr-2.5 py-1 text-[11px] font-bold outline-none rounded-none"
                    />
                  </div>
                </div>

                {/* Subtotals & VAT calculation widgets */}
                <div className="space-y-0.5 text-[10px] text-slate-300 leading-tight">
                  <div className="flex justify-between gap-2">
                    <span>BASE:</span>
                    <span>USD {cartSubtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between gap-2 text-orange-400 font-bold">
                    <span>DISC:</span>
                    <span>-USD {discountAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span>VAT (15%):</span>
                    <span>USD {cartVat.toFixed(2)}</span>
                  </div>
                </div>

                {/* FINAL GRAND TOTAL PANEL */}
                <div className="bg-white/5 border border-dashed border-orange-550 p-2 text-right flex flex-col justify-center h-11 col-span-2 sm:col-span-1">
                  <span className="text-[7.5px] text-slate-400 uppercase leading-none block">Grand Payable</span>
                  <span className="text-[#f97316] font-black text-sm">USD {cartGrandTotal.toFixed(2)}</span>
                </div>

              </div>

              {/* TENDER PAYMENTS METHOD MULTIPLICES */}
              <div className="space-y-1 pt-1">
                <span className="text-[8.5px] text-slate-400 uppercase font-black tracking-wider block">
                  COMMITTED TENDER METHOD SELECTOR
                </span>
                <div className="grid grid-cols-5 gap-1 shadow-sm">
                  {(['CASH', 'EcoCash', 'Swipe', 'Bank Transfer', 'Split Payment'] as const).map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaymentMethod(m)}
                      className={`py-1.5 text-[8.5px] uppercase font-bold transition-all border rounded-none cursor-pointer ${
                        paymentMethod === m
                          ? 'border-orange-500 bg-orange-500/10 text-orange-500'
                          : 'border-[#4b5563] bg-[#2e3542] text-slate-300 hover:border-[#b1b5c2]'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* FOOTER ACTIONS MATRIX BUTTONS */}
              <div className="grid grid-cols-3 gap-2.5 pt-1">
                
                {/* Hold ticket suspend draft */}
                <button
                  type="button"
                  onClick={handleHoldDraftTransaction}
                  className="bg-slate-850 border border-slate-700 hover:border-orange-500 hover:text-orange-500 text-slate-200 uppercase font-extrabold text-[10px] py-3.5 transition-colors flex items-center justify-center gap-1 cursor-pointer rounded-none"
                >
                  <History className="w-3.5 h-3.5" />
                  Hold Draft
                </button>

                {/* Cancel cart clean slate */}
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Are you sure you want to dismiss and clear the current cart?')) {
                      setCart([]);
                      logLocalBiEvent('CART_CLEARED', 'CART_CLEARED: Checkout ledger dismissed', 'Medium');
                    }
                  }}
                  className="bg-slate-850 border border-slate-700 hover:border-red-500 hover:text-red-500 text-slate-305 uppercase font-medium text-[10px] py-3.5 transition-colors flex items-center justify-center gap-1 cursor-pointer rounded-none"
                >
                  Clear Cart
                </button>

                {/* Commit Checkout sequence */}
                <button
                  type="button"
                  disabled={cart.length === 0}
                  onClick={handleTriggerTenderingPanel}
                  className="bg-[#f97316] text-white hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed uppercase font-black tracking-widest text-[10.5px] py-3.5 transition-colors flex items-center justify-center gap-1 cursor-pointer rounded-none"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  Complete
                </button>

              </div>

            </div>

          </div>

          {/* -------------------- FLOATING COMPILER AND REGISTER DISCHARGE MODAL -------------------- */}
          {isTendering && (
            <div className="absolute inset-0 bg-slate-950/95 z-[950] p-6 flex items-center justify-center">
              <div className="w-[380px] bg-white border-2 border-[#1e222b] p-5 space-y-5 shadow-2xl relative text-[#1e222b]">
                
                <div className="flex justify-between items-center border-b border-gray-100 pb-2.5">
                  <span className="text-[10px] font-black uppercase text-orange-500 tracking-wider">TENDER REGISTRY PAYMENTS</span>
                  <button 
                    onClick={() => setIsTendering(false)} 
                    className="text-slate-400 hover:text-slate-850 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="bg-[#1e222b] text-white p-3.5 text-right font-mono">
                    <span className="text-[8px] text-slate-450 block uppercase">TOTAL AMOUNT INVOICED</span>
                    <strong className="text-xl text-[#f97316]">USD {cartGrandTotal.toFixed(2)}</strong>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[8.5px] uppercase font-black block text-slate-500">PAYMENT CHANNEL</span>
                    <div className="bg-[#f3f4f6] text-[11px] font-black text-[#1e222b] p-2.5 border border-[#b1b5c2] uppercase">
                      ⚡ TENDER MET: {paymentMethod}
                    </div>
                  </div>

                  {paymentMethod === 'CASH' && (
                    <div className="space-y-1.5">
                      <label className="text-[8.5px] uppercase font-black text-slate-500 block">CASH PAYLOAD RECEIVED</label>
                      <input
                        type="text"
                        placeholder="0.00"
                        value={cashTendered}
                        onChange={(e) => setCashTendered(e.target.value.replace(/[^0-9.]/g, ''))}
                        className="w-full bg-white text-lg font-black text-[#1e222b] border-2 border-[#1e222b] focus:border-orange-500 px-3 py-2 outline-none text-right font-mono"
                      />
                      
                      <div className="grid grid-cols-4 gap-1 pt-1.5">
                        {['10', '20', '50', '100'].map(amt => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => setCashTendered(amt)}
                            className="bg-slate-100 border border-[#b1b5c2] py-1 text-[9.5px] text-[#1e222b] hover:bg-slate-200 font-bold"
                          >
                            +${amt}
                          </button>
                        ))}
                      </div>

                      <div className="bg-orange-50 hover:bg-orange-100/50 p-3.5 border border-orange-500/30 flex justify-between items-center text-xs pt-3 mt-1 font-mono">
                        <span className="text-slate-550 uppercase text-[9px] font-bold">CHANGE DUE:</span>
                        <strong className="text-[#ea580c] text-sm">
                          USD {Math.max(0, (parseFloat(cashTendered) || 0) - cartGrandTotal).toFixed(2)}
                        </strong>
                      </div>
                    </div>
                  )}

                  {paymentMethod !== 'CASH' && (
                    <div className="bg-emerald-50 text-emerald-800 p-4 border border-emerald-400/40 text-[10px] leading-relaxed">
                      <strong>INTER-BANK SYNC READY:</strong><br />
                      Swipe terminal validation logs completed. Complete sale to commit stock deductions.
                    </div>
                  )}

                </div>

                <div className="flex gap-2.5 pt-2 border-t border-gray-150">
                  <button
                    type="button"
                    onClick={() => setIsTendering(false)}
                    className="w-1/3 py-3 bg-slate-100 hover:bg-slate-200 text-[#1e222b] text-[10px] uppercase font-bold text-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCommitCheckoutProcess}
                    className="w-2/3 py-3 bg-orange-500 hover:bg-orange-600 font-black uppercase text-xs text-white text-center flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <CheckCircle className="w-4 h-4" />
                    DISCHARGE TRAN
                  </button>
                </div>

              </div>
            </div>
          )}

          {/* -------------------- SUCCESS / RECEIPT PRINTER VERIFICATION SHEET OVERLAY -------------------- */}
          {checkoutSuccessTicket && (
            <div className="absolute inset-0 bg-slate-900/98 z-[990] p-6 flex flex-col items-center justify-center text-[#1e222b] font-mono">
              <div className="w-[360px] bg-white border-2 border-orange-500 p-6 space-y-4 shadow-2xl relative text-xs">
                
                <div className="text-center space-y-1">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                  <h3 className="text-sm font-black uppercase text-[#1e222b] tracking-wider pt-1">
                    TRANSACTION DISCHARGED
                  </h3>
                  <p className="text-[9px] text-[#f97316] font-bold uppercase">
                    Transaction confirmed - iTred Commerce POS
                  </p>
                </div>

                <div className="border-t border-b border-dashed border-gray-300 py-3 text-[10.5px] space-y-1 text-slate-700 font-mono">
                  <div className="flex justify-between">
                    <span>INVOICE NUMBER:</span>
                    <span className="font-extrabold text-[#111827]">{checkoutSuccessTicket.invoiceNo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>DATE COMPELLED:</span>
                    <span className="text-slate-800">{new Date(checkoutSuccessTicket.date).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>STATION ID:</span>
                    <span className="text-slate-850 uppercase">{terminalName}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-100 pb-1.5 mb-1.5">
                    <span>CLERK AGENT:</span>
                    <span className="text-slate-850 uppercase">{checkoutSuccessTicket.operator}</span>
                  </div>

                  <div className="max-h-24 overflow-y-auto pr-1 pos-custom-scroll space-y-1">
                    {checkoutSuccessTicket.items.map((i, idx) => (
                      <div key={idx} className="flex justify-between text-[9px] uppercase">
                        <span className="truncate max-w-[200px]">{i.name} (x{i.quantity})</span>
                        <span className="font-bold text-[#111827]">${i.total.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-dashed border-gray-200 pt-2 font-black space-y-0.5 text-xs text-slate-850">
                    <div className="flex justify-between">
                      <span>SUBTOTAL NET:</span>
                      <span>USD {checkoutSuccessTicket.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-orange-600 font-bold">
                      <span>DISCOUNTS APPLIED:</span>
                      <span>-USD {checkoutSuccessTicket.discount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-300 pb-1">
                      <span>VAT PORTION (15%):</span>
                      <span>USD {checkoutSuccessTicket.tax.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-extrabold pt-1">
                      <span>TOTAL PAYABLE:</span>
                      <span className="text-orange-600">USD {checkoutSuccessTicket.total.toFixed(2)}</span>
                    </div>
                  </div>

                </div>

                {/* Receipts overlay action loops */}
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => handleTriggerPrintReceipt(checkoutSuccessTicket)}
                    className="w-full py-3 bg-slate-900 hover:bg-slate-850 font-black uppercase text-xs text-white text-center flex items-center justify-center gap-1.5 rounded-none cursor-pointer border border-slate-950"
                  >
                    <Printer className="w-4 h-4 text-orange-500" />
                    PRINT SLIP RECEIPT
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const cached = localStorage.getItem('sci_pos_delivery_orders');
                      const list = (jsonStr) => {
                        try {
                          return JSON.parse(jsonStr) || [];
                        } catch (e) {
                          return [];
                        }
                      };
                      const ordersList = cached ? list(cached) : [];
                      
                      const newDraft = {
                        id: 'DEL-0' + (ordersList.length + 1) + Math.floor(10 + Math.random() * 90),
                        receiptNumber: checkoutSuccessTicket.invoiceNo,
                        customerName: checkoutSuccessTicket.customerName || 'Walk-In Customer',
                        customerWhatsApp: '+263770000000',
                        deliveryAddress: 'Main Harare Delivery St',
                        district: 'Harare CBD',
                        suburb: 'CBD',
                        deliveryMethod: 'Vendor Delivery',
                        status: 'Pending Assignment',
                        codeStatus: 'Not Generated',
                        notes: 'Draft created from completed sale cashier desk.'
                      };
                      ordersList.push(newDraft);
                      localStorage.setItem('sci_pos_delivery_orders', JSON.stringify(ordersList));

                      const cachedEv = localStorage.getItem('sci_pos_delivery_events');
                      const eventsList = cachedEv ? list(cachedEv) : [];
                      const nextEv = {
                        id: 'DLE-' + (eventsList.length + 101),
                        timestamp: new Date().toISOString(),
                        eventType: 'DELIVERY_ASSIGNED',
                        message: `Delivery draft created for completed sale ${checkoutSuccessTicket.invoiceNo}`,
                        operator: checkoutSuccessTicket.operator || 'Cashier'
                      };
                      eventsList.unshift(nextEv);
                      localStorage.setItem('sci_pos_delivery_events', JSON.stringify(eventsList));

                      alert(`Delivery draft created in Delivery Desk for receipt ${checkoutSuccessTicket.invoiceNo}.`);
                    }}
                    className="w-full py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-extrabold uppercase text-[10.5px] text-center flex items-center justify-center gap-1.5 border border-orange-700"
                  >
                    <Truck className="w-3.5 h-3.5 text-white" />
                    CREATE DELIVERY DRAFT
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCheckoutSuccessTicket(null);
                      setIsModalOpen(false);
                      setCart([]);
                    }}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-[#1e222b] font-bold uppercase text-[10px] text-center"
                  >
                    Dismiss and Return to Workbench
                  </button>
                </div>

              </div>
            </div>
          )}

        </div>
      )}

      {/* -------------------- PRICE OVERRIDE ENFORCEMENT WINDOW - PART 2 -------------------- */}
      {pendingPriceOverrideItem !== null && (
        <div className="fixed inset-0 bg-slate-950/70 z-[1100] flex items-center justify-center p-4 font-mono text-xs">
          <div className="w-[380px] bg-white border-2 border-[#1e222b] p-5 space-y-4 shadow-2xl text-[#1e222b] uppercase">
            
            <div className="border-b-2 border-orange-500 pb-2 flex justify-between items-center text-[#1e222b]">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-orange-500" />
                <span className="text-[10px] font-black tracking-wider block">PRICE OVERRIDE COMPULSORY</span>
              </div>
              <span className="text-[7.5px] bg-[#1e222b] text-white px-1.5 py-0.5 font-bold">SECURITY ENFORCED</span>
            </div>

            <div className="space-y-4 text-[9px]">
              <div>
                <span className="text-slate-400 block font-bold leading-none">PRODUCT ELEMENT</span>
                <strong className="text-slate-900 text-[10.5px] font-black">{pendingPriceOverrideItem.product.name}</strong>
              </div>
              
              <div className="grid grid-cols-2 gap-3 pb-1">
                <div>
                  <span className="text-slate-400 block font-bold">BASE CLERK RATE</span>
                  <strong className="text-slate-800">USD {pendingPriceOverrideItem.product.price.toFixed(2)}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold">QTY COMMITTED</span>
                  <strong className="text-slate-800">QTY {pendingPriceOverrideItem.quantity}</strong>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-500 font-extrabold block">PROPOSED INVOICE UNIT RATE (USD)</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2.5 text-orange-500 font-black text-[11px]">$</span>
                  <input
                    type="text"
                    value={requestedPriceVal}
                    onChange={(e) => setRequestedPriceVal(e.target.value.replace(/[^0-9.]/g, ''))}
                    className="w-full bg-slate-50 text-right font-black text-sm text-[#1e222b] border-2 border-[#1e222b] focus:border-orange-500 px-3 py-2 outline-none font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-500 font-extrabold block">JUSTIFICATION REASONING</label>
                <select
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="w-full bg-white text-[#1e222b] border border-[#b1b5c2] rounded-none px-2 py-1.5 font-bold uppercase text-[9.5px]"
                >
                  <option value="Customer negotiated bulk discount">Customer negotiated bulk discount</option>
                  <option value="Competitor pricing matching scheme">Competitor pricing matching scheme</option>
                  <option value="Approved promotional clearance waiver">Approved promotional clearance waiver</option>
                  <option value="Material defect discount concession">Material defect discount concession</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2.5 pt-3 border-t border-gray-150">
              <button
                type="button"
                onClick={() => setPendingPriceOverrideItem(null)}
                className="w-1/3 py-2.5 bg-slate-100 hover:bg-slate-200 text-[#1e222b] text-[9px] uppercase font-bold text-center border border-[#b1b5c2] cursor-pointer"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={handleSubmitPriceOverrideRequest}
                className="w-2/3 py-2.5 bg-[#f97316] hover:bg-orange-600 font-black uppercase text-[9.5px] text-white text-center flex items-center justify-center gap-1 cursor-pointer border-0"
              >
                Submit Override
              </button>
            </div>

          </div>
        </div>
      )}

      {/* -------------------- RECEIPT PREVIEW (PART 2) -------------------- */}
      {selectedReceiptForPreview !== null && (
        <div className="fixed inset-0 bg-slate-950/70 z-[1200] flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-[360px] bg-white border-2 border-[#1e222b] shadow-2xl text-[#1e222b] uppercase relative leading-tight flex flex-col">
            
            {/* Header */}
            <div className="bg-[#1e222b] text-white px-4 py-3 flex justify-between items-center border-b-2 border-orange-500">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-orange-500" />
                <span className="text-[10px] font-extrabold tracking-wider">RECEIPT PREVIEW SLIP</span>
              </div>
              <button 
                onClick={() => setSelectedReceiptForPreview(null)}
                className="text-slate-400 hover:text-[#f97316] p-1 font-bold outline-none border-0 cursor-pointer bg-transparent"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Inner printable scroll */}
            <div className="p-6 bg-amber-50/10 font-mono text-[9.5px] space-y-4 max-h-[480px] overflow-y-auto flex-1">
              <div className="text-center space-y-1">
                <h2 className="font-black text-xs text-[#1e222b] tracking-tight">{vendorName.toUpperCase()}</h2>
                <div className="text-[8px] text-slate-500 leading-snug">
                  <div>REGISTRY: {branchName} DIVISION</div>
                  <div>SECURE GATEWAY HARARE 4467</div>
                  <div>TEL: +263 242 770901/770902</div>
                </div>
              </div>

              <div className="border-t border-dashed border-slate-350 pt-2 text-[8px] space-y-0.5 text-slate-600 uppercase">
                <div className="flex justify-between">
                  <span>TERMINAL: {selectedReceiptForPreview.terminal || 'POS-01'}</span>
                  <span>CLERK: {selectedReceiptForPreview.operator}</span>
                </div>
                <div className="flex justify-between">
                  <span>INVOICE: {selectedReceiptForPreview.invoiceNo}</span>
                  <span>STATUS: {selectedReceiptForPreview.status}</span>
                </div>
                <div className="flex justify-between">
                  <span>DATE/TIME: {new Date(selectedReceiptForPreview.date).toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-800">
                  <span>CUSTOMER: {selectedReceiptForPreview.customerName || 'Walk-in Customer'}</span>
                </div>
              </div>

              {/* Items grid */}
              <div className="border-t border-b border-dashed border-slate-350 py-2.5">
                <div className="flex justify-between font-bold text-[8.5px] text-slate-400 mb-1">
                  <span>DESCRIPTION</span>
                  <span>TOTAL</span>
                </div>
                <div className="space-y-1.5">
                  {selectedReceiptForPreview.items.map((it, idx) => (
                    <div key={idx} className="space-y-0.5">
                      <div className="flex justify-between font-medium">
                        <span>{it.name}</span>
                        <span>USD {it.total.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-[8px] text-slate-500 pl-2">
                        <span>QTY {it.quantity} &times; USD {((it.total || 0) / (it.quantity || 1)).toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="space-y-1 text-right text-[9px]">
                <div className="flex justify-between text-slate-550">
                  <span>SUBTOTAL</span>
                  <span>USD {selectedReceiptForPreview.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-550">
                  <span>VAT SALES TAX (10%)</span>
                  <span>USD {selectedReceiptForPreview.tax.toFixed(2)}</span>
                </div>
                {selectedReceiptForPreview.discount > 0 && (
                  <div className="flex justify-between text-orange-600 font-bold">
                    <span>DISCOUNT APPLIED</span>
                    <span>-USD {selectedReceiptForPreview.discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[11px] font-black border-t border-dashed border-slate-350 pt-1.5 text-slate-900">
                  <span>NET TOTAL</span>
                  <span>USD {selectedReceiptForPreview.total.toFixed(2)}</span>
                </div>
              </div>

              {/* Footer messages */}
              <div className="text-center pt-3 text-[7.5px] text-slate-450 space-y-1 leading-snug border-t border-dashed border-slate-350">
                <p className="font-bold">THANK YOU FOR SUPPORTING SCI INDUSTRIAL</p>
                <p>Goods returned within 7 days in original condition carry a restocking validation levy. No refund void without manager authorization.</p>
                <div className="text-[7px] text-slate-400 pt-1">BARCODE REF: {selectedReceiptForPreview.id}</div>
              </div>
            </div>

            {/* Actions Panel */}
            <div className="bg-slate-50 p-4 border-t-2 border-slate-200 grid grid-cols-2 gap-2 text-[9.5px]">
              <button
                type="button"
                onClick={() => {
                  alert(`[SUCCESS] Receipt ${selectedReceiptForPreview.invoiceNo} sent to 80mm high-speed queue.`);
                  logSalesEvent('RECEIPT_PRINT_PREVIEWED' as any, `RECEIPT_PRINTED_HARDCOPY: Printed physical slip copy of ${selectedReceiptForPreview.invoiceNo}`);
                }}
                className="py-2.5 bg-[#f97316] hover:bg-orange-600 text-white font-extrabold uppercase transition-colors cursor-pointer text-center flex items-center justify-center gap-1.5 border-0"
              >
                <Printer className="w-3.5 h-3.5" />
                Print (80mm)
              </button>
              <button
                type="button"
                onClick={() => {
                  alert('[SUCCESS] PDF invoice generated. Mock file RCT-' + selectedReceiptForPreview.invoiceNo + '.pdf successfully assembled and saved.');
                }}
                className="py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold uppercase transition-colors cursor-pointer border-0 text-center"
              >
                Download PDF
              </button>
              <button
                type="button"
                onClick={() => setSelectedReceiptForPreview(null)}
                className="col-span-2 py-2 bg-slate-200 hover:bg-slate-300 text-slate-705 font-bold uppercase transition-colors cursor-pointer border-0 text-center"
              >
                Dismiss Preview
              </button>
            </div>

          </div>
        </div>
      )}

      {/* -------------------- RETURN STOCK REQUEST (PART 3) -------------------- */}
      {selectedReceiptForReturn !== null && (
        <div className="fixed inset-0 bg-slate-950/70 z-[1200] flex items-center justify-center p-4">
          <div className="w-[380px] bg-white border-2 border-[#1e222b] shadow-2xl text-[#1e222b] uppercase font-mono text-xs">
            
            <div className="bg-[#1e222b] text-white p-4 flex justify-between items-center border-b-2 border-orange-500">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-orange-500 animate-spin-slow" />
                <span className="text-[10px] font-extrabold tracking-wider">RETURN TRANSACTION REGISTER</span>
              </div>
              <button 
                onClick={() => setSelectedReceiptForReturn(null)}
                className="text-slate-400 hover:text-[#f97316] cursor-pointer bg-transparent border-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-2 text-[9px] bg-slate-50 p-2.5 border border-slate-200 text-slate-650">
                <div>
                  <span className="text-slate-400 font-bold block">RECEIPT NO</span>
                  <span className="font-extrabold text-slate-800">{selectedReceiptForReturn.invoiceNo}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block">RECON STAT</span>
                  <span className="font-extrabold text-[#f97316]">{selectedReceiptForReturn.status}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400 font-bold block">CUSTOMER ORIGIN</span>
                  <span className="font-extrabold text-slate-800">{selectedReceiptForReturn.customerName || 'Walk-in Customer'}</span>
                </div>
              </div>

              {/* Select product row to return */}
              <div className="space-y-1">
                <label className="text-slate-500 font-extrabold block text-[9px]">1. SELECT ELEMENT FOR RETURN</label>
                <select
                  value={returnProductId}
                  onChange={(e) => {
                    setReturnProductId(e.target.value);
                    setReturnQuantity(1);
                  }}
                  className="w-full bg-white text-slate-800 border-2 border-[#1e222b] px-2 py-1.5 font-bold uppercase text-[9.5px]"
                >
                  {selectedReceiptForReturn.items.map((it, idx) => (
                    <option key={idx} value={it.productId}>
                      {it.name} (QTY {it.quantity} AVAILABLE)
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantities row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-500 font-extrabold block text-[9px]">2. RETURN QUANTITY</label>
                  <input
                    type="number"
                    min={1}
                    max={selectedReceiptForReturn.items.find(i => i.productId === returnProductId)?.quantity || 1}
                    value={returnQuantity}
                    onChange={(e) => {
                      const mx = selectedReceiptForReturn.items.find(i => i.productId === returnProductId)?.quantity || 1;
                      const val = parseInt(e.target.value) || 1;
                      setReturnQuantity(Math.min(mx, Math.max(1, val)));
                    }}
                    className="w-full bg-slate-50 text-[#1e222b] border-2 border-[#1e222b] px-2 py-1 font-bold text-center"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-500 font-extrabold block text-[9px]">3. RETURN CONDITION</label>
                  <select
                    value={returnCondition}
                    onChange={(e) => setReturnCondition(e.target.value)}
                    className="w-full bg-white text-slate-800 border border-[#b1b5c2] px-2 py-1.5 font-bold text-[9px]"
                  >
                    <option value="Resellable">Resellable / Clean</option>
                    <option value="Damaged Stock">Damaged / Defect</option>
                    <option value="Repacking Required">Repacking Required</option>
                  </select>
                </div>
              </div>

              {/* Reasons dropdown */}
              <div className="space-y-1">
                <label className="text-slate-500 font-extrabold block text-[9px]">4. RETURN JUSTIFICATION SCHEMA</label>
                <select
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="w-full bg-white text-slate-800 border border-[#b1b5c2] px-2 py-1.5 font-bold text-[9px]"
                >
                  <option value="Wrong item supplied">Wrong item supplied by clerk</option>
                  <option value="Defective component">Defective component / bad tolerance</option>
                  <option value="Over-stocked customer supply">Over-ordered by buyer team</option>
                  <option value="Exchange for alternative dimension">Exchange for alternative dimension</option>
                </select>
              </div>

              {/* Explanatory justification */}
              <div className="space-y-1">
                <label className="text-slate-500 font-extrabold block text-[9px]">5. CLERK CORROBORATING STATEMENT</label>
                <textarea
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  placeholder="Enter details of hardware inspection..."
                  rows={2}
                  className="w-full bg-slate-50 border border-[#b1b5c2] rounded-none p-2 text-[9.5px] uppercase font-mono outline-none focus:border-orange-500 text-slate-800"
                />
              </div>

              <div className="bg-amber-500/10 border-l-2 border-[#f97316] p-2.5 text-[8.5px] text-slate-650 leading-relaxed font-bold">
                NOTICE: CLERKS MAY NOT AUTHORIZE MATERIAL RETURNS. SUBMISSION WILL QUEUE SECURE CLEARANCE PIN SIGNATURE FROM A LICENSED SUPERVISOR.
              </div>
            </div>

            <div className="flex gap-2.5 p-4 bg-slate-50 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setSelectedReceiptForReturn(null)}
                className="w-1/3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold uppercase transition-colors cursor-pointer border-0 text-center"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={handleTriggerReturnFormSubmit}
                className="w-2/3 py-2 bg-[#f97316] hover:bg-orange-600 font-black text-white uppercase transition-colors cursor-pointer border-0 text-center"
              >
                Submit Return Req
              </button>
            </div>

          </div>
        </div>
      )}

      {/* -------------------- REFUND CASH REQUEST (PART 4) -------------------- */}
      {selectedReceiptForRefund !== null && (
        <div className="fixed inset-0 bg-slate-950/70 z-[1200] flex items-center justify-center p-4">
          <div className="w-[380px] bg-white border-2 border-[#1e222b] shadow-2xl text-[#1e222b] uppercase font-mono text-xs">
            
            <div className="bg-[#1e222b] text-white p-4 flex justify-between items-center border-b-2 border-orange-500">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-orange-500" />
                <span className="text-[10px] font-extrabold tracking-wider">CASH REFUND LEDGER MODIFIER</span>
              </div>
              <button 
                onClick={() => setSelectedReceiptForRefund(null)}
                className="text-slate-400 hover:text-[#f97316] cursor-pointer bg-transparent border-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-2 text-[9px] bg-slate-50 p-2.5 border border-slate-200 text-slate-650">
                <div>
                  <span className="text-slate-400 font-bold block">RECEIPT REF</span>
                  <span className="font-extrabold text-slate-800">{selectedReceiptForRefund.invoiceNo}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block">MAX TICKET CREDIT</span>
                  <span className="font-extrabold text-slate-900">USD {selectedReceiptForRefund.total.toFixed(2)}</span>
                </div>
              </div>

              {/* Exact dollar amount */}
              <div className="space-y-1">
                <label className="text-slate-500 font-extrabold block text-[9.5px]">1. PROPOSED REFUND VALUE (USD)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-orange-500 font-extrabold text-sm">$</span>
                  <input
                    type="text"
                    value={refundAmountVal}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9.]/g, '');
                      const num = parseFloat(val) || 0;
                      if (num <= selectedReceiptForRefund.total) {
                        setRefundAmountVal(val);
                      }
                    }}
                    className="w-full bg-slate-50 text-right font-black text-sm text-[#1e222b] border-2 border-[#1e222b] px-3 py-2 outline-none"
                  />
                </div>
                {parseFloat(refundAmountVal) > 20 && (
                  <span className="text-[8px] text-red-500 font-extrabold leading-none block pt-1">
                    ⚠️ VALUE EXCEEDS SUPERVISOR APPRECIATION LIMIT ($20). MANAGER PIN OVERRIDE TRIGGERED.
                  </span>
                )}
              </div>

              {/* Refund Method selection */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-500 font-extrabold block text-[9px]">2. PAYOUT DISPOSITION</label>
                  <select
                    value={refundMethodVal}
                    onChange={(e) => setRefundMethodVal(e.target.value)}
                    className="w-full bg-white text-slate-800 border border-[#b1b5c2] px-2 py-1.5 font-bold text-[9px]"
                  >
                    <option value="Cash">Cash Return</option>
                    <option value="EcoCash">EcoCash Wallet</option>
                    <option value="Card Credit">Card Reversal</option>
                    <option value="Split Methods">Split Reversal</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-slate-500 font-extrabold block text-[9px]">3. REFUND SCHEMA</label>
                  <select
                    value={refundReasonVal}
                    onChange={(e) => setRefundReasonVal(e.target.value)}
                    className="w-full bg-white text-slate-800 border border-[#b1b5c2] px-2 py-1.5 font-bold text-[9px]"
                  >
                    <option value="Wrong size supplied">Wrong size supplied</option>
                    <option value="Over-pushed customer transfer">Duplicate credit transfer</option>
                    <option value="Authorized goodwill adjustment">Goodwill adjustment</option>
                    <option value="Unfavorable hardware grade">Under-performance</option>
                  </select>
                </div>
              </div>

              {/* Refund Notes */}
              <div className="space-y-1">
                <label className="text-slate-500 font-extrabold block text-[9px]">4. CONSOLIDATING REASONS STATEMENT</label>
                <textarea
                  value={refundNotesVal}
                  onChange={(e) => setRefundNotesVal(e.target.value)}
                  placeholder="Justify ledger subtraction..."
                  rows={2}
                  className="w-full bg-slate-50 border border-[#b1b5c2] rounded-none p-2 text-[9.5px] uppercase font-mono outline-none text-slate-800"
                />
              </div>

              {/* Authorization rules visualization */}
              <div className="bg-[#1e222b] text-white p-3 space-y-1 text-[8px] leading-relaxed select-none border-l-2 border-orange-500 font-bold">
                <span className="text-orange-500 uppercase tracking-widest block font-extrabold text-[8.5px] mb-0.5">AUTH RULES SCHEMA Matrix</span>
                <p>&bull; Supervisor limit: USD 20 maximum reimbursement value.</p>
                <p>&bull; Reals above USD 20 require Manager or Owner physical hardware credential key.</p>
                <p>&bull; Cash payouts above USD 20 are flagged to session register balance audit.</p>
              </div>

            </div>

            <div className="flex gap-2.5 p-4 bg-slate-50 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setSelectedReceiptForRefund(null)}
                className="w-1/3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-705 font-bold uppercase transition-colors cursor-pointer border-0 text-center"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={handleTriggerRefundFormSubmit}
                className="w-2/3 py-2 bg-orange-500 hover:bg-orange-600 font-bold text-white uppercase transition-colors cursor-pointer border-0 text-center"
              >
                Submit Refund Req
              </button>
            </div>

          </div>
        </div>
      )}

      {/* -------------------- VOID SALE REQUEST (PART 5) -------------------- */}
      {selectedReceiptForVoid !== null && (
        <div className="fixed inset-0 bg-slate-950/70 z-[1200] flex items-center justify-center p-4">
          <div className="w-[380px] bg-white border-2 border-[#1e222b] shadow-2xl text-[#1e222b] uppercase font-mono text-xs">
            
            <div className="bg-[#1e222b] text-white p-4 flex justify-between items-center border-b-2 border-orange-500">
              <div className="flex items-center gap-2">
                <Ban className="w-4 h-4 text-orange-500" />
                <span className="text-[10px] font-extrabold tracking-wider">ENTIRE INVOICE VOID REQUEST</span>
              </div>
              <button 
                onClick={() => setSelectedReceiptForVoid(null)}
                className="text-slate-400 hover:text-[#f97316] cursor-pointer bg-transparent border-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-2 text-[9px] bg-slate-50 p-2.5 border border-slate-200 text-slate-650">
                <div>
                  <span className="text-slate-400 font-bold block">RECEIPT NO</span>
                  <span className="font-extrabold text-slate-800">{selectedReceiptForVoid.invoiceNo}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block">TOTAL VALUE</span>
                  <span className="font-extrabold text-sky-750">USD {selectedReceiptForVoid.total.toFixed(2)}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400 font-bold block">CLERK COMMITTED</span>
                  <span className="font-extrabold text-slate-800">{selectedReceiptForVoid.operator}</span>
                </div>
              </div>

              {/* Void dropdown */}
              <div className="space-y-1">
                <label className="text-slate-500 font-extrabold block text-[9px]">1. VOID REASON SCHEME</label>
                <select
                  value={voidReasonVal}
                  onChange={(e) => setVoidReasonVal(e.target.value)}
                  className="w-full bg-white text-slate-800 border-2 border-[#1e222b] px-2 py-1.5 font-bold uppercase text-[9.5px]"
                >
                  <option value="Wrong sale captured">Wrong sale captured (User error)</option>
                  <option value="Double invoice dispatch">Double invoice dispatch</option>
                  <option value="Customer card transaction declined">Payment failed / Card declined</option>
                  <option value="Incorrect customer account tag">Incorrect customer account tag</option>
                </select>
              </div>

              {/* Supervisor comment text input */}
              <div className="space-y-1">
                <label className="text-slate-500 font-extrabold block text-[9px]">2. ADD ADDITIONAL SUPERVISORY NOTES</label>
                <textarea
                  value={voidSupervisorNoteVal}
                  onChange={(e) => setVoidSupervisorNoteVal(e.target.value)}
                  placeholder="Provide brief explanation for full transaction void..."
                  rows={2}
                  className="w-full bg-slate-50 border border-[#b1b5c2] rounded-none p-2 text-[9.5px] uppercase font-mono outline-none text-slate-800"
                />
              </div>

              {/* Auth warning block */}
              <div className="border border-red-300 bg-red-50 text-red-500 text-[8.5px] p-3 space-y-1 leading-snug font-bold">
                <p>⚠️ VOID AUTHORIZATION ACTION ALERT:</p>
                <p>&bull; Owner, SysAdmin, or Manager can approve all void invoices.</p>
                <p>&bull; Supervisors can approve same-shift void only.</p>
                <p>&bull; Cashiers must queue void approval requests.</p>
              </div>

            </div>

            <div className="flex gap-2.5 p-4 bg-slate-50 border-t border-gray-200 text-[9.5px]">
              <button
                type="button"
                onClick={() => setSelectedReceiptForVoid(null)}
                className="w-1/3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold uppercase transition-colors cursor-pointer border-0 text-center"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={handleTriggerVoidFormSubmit}
                className="w-2/3 py-2 bg-red-650 hover:bg-red-750 text-white font-bold uppercase transition-colors cursor-pointer border-0 text-center"
              >
                Submit Void Request
              </button>
            </div>

          </div>
        </div>
      )}

      <PaymentBreakdownCard operatorName={staffName} />

      {/* Corporate bottom bar */}
      <div className="border border-[#b1b5c2] p-4 bg-white font-mono text-[9.5px] uppercase text-slate-500 flex flex-wrap justify-between items-center mt-8 gap-4 select-none">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-orange-500" />
          <span>STATION TRANSACTION CACHE: ACTIVE BYPASS</span>
        </div>
        <div>
          <span>STANDARD ISO SECURITIES STATUS: COMPLIANT v8</span>
        </div>
      </div>

    </div>
  );

  // Wrapper for launching action parameters without leaks
  function handleTriggerTriggerNewSaleWrapper() {
    handleTriggerNewSale();
  }

  // Interlocked close modal validator
  function handleCloseModalWithInterlocks() {
    if (cart.length > 0) {
      if (confirm('Active checkout ticket has unsaved material lines. Choose OK to suspend and save draft to local vault, or Cancel to ignore changes.')) {
        handleHoldDraftTransaction();
      } else {
        setCart([]);
        setIsModalOpen(false);
      }
    } else {
      setIsModalOpen(false);
    }
  }

  // Tender panel triggers
  function handleTriggerTenderingPanel() {
    if (cart.length === 0) return;
    setCashTendered(Math.ceil(cartGrandTotal).toString());
    setIsTendering(true);
  }

  // Commit wrapper
  function handleCommitCheckoutProcess() {
    if (paymentMethod === 'CASH') {
      const parsedCash = parseFloat(cashTendered) || 0;
      if (parsedCash < cartGrandTotal) {
        alert('[SECURITY WARN] Insufficient cash payed. Cannot dispatch material.');
        return;
      }
    }
    
    setIsTendering(false);
    handleFinalizeTransactionComplete();
  }

}
