export interface Vendor {
  id: string;
  name: string;
  legalName: string;
  taxNo: string;
  regNo: string;
  address: string;
  currency: string;
}

export interface Branch {
  id: string;
  name: string;
  location: string;
}

export interface Warehouse {
  id: string;
  name: string;
  branchId: string;
}

export interface Terminal {
  id: string;
  name: string;
  branchId: string;
  type: string;
}

export type Role = 'Owner' | 'SysAdmin' | 'Manager' | 'Cashier' | 'Stock Controller' | 'Supervisor';

export type Permission = string;

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  pass: string;
  branchId: string;
}

export type BISeverity = 'Low' | 'Medium' | 'High' | 'Critical' | 'INFO' | 'WARNING' | 'CRITICAL';

export type StockStatus = 'In Stock' | 'Low Stock' | 'Out of Stock' | 'Dead Stock' | 'Variance Risk' | 'Fast Moving' | 'Slow Moving';

export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export type PaymentMethod = 'Cash' | 'EcoCash' | 'Swipe' | 'Bank Transfer' | 'Split Payment' | 'CASH' | 'CARD' | 'NFC' | 'SPLIT';

export interface Product {
  id: string;
  code: string; // SKU or Barcode
  name: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  minStock: number;
  unit: string;
  branch?: string;
  warehouse?: string;
  lastMovementDate?: string;
  healthStatus?: StockStatus;
}

export interface CartItem {
  product: Product;
  quantity: number;
  discount: number; // custom percentage or dollar
  overriddenPrice?: number;
}

export interface SalePayment {
  method: PaymentMethod;
  amount: number;
  reference?: string;
}

export interface Sale {
  id: string;
  invoiceNo: string;
  date: string;
  operator: string;
  customerName?: string;
  terminal?: string;
  items: {
    productId: string;
    name: string;
    code: string;
    quantity: number;
    price: number;
    total: number;
  }[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: 'CASH' | 'CARD' | 'NFC' | 'SPLIT' | PaymentMethod;
  cashReceived?: number;
  changeGiven?: number;
  status: 'COMPLETED' | 'VOIDED' | 'RETURNED' | 'REFUNDED' | string;
}

export interface HeldTransaction {
  id: string;
  date: string;
  notes?: string;
  items: CartItem[];
  total: number;
}

export interface Shift {
  id: string;
  operator: string;
  status: 'ACTIVE' | 'CLOSED';
  startTime: string;
  endTime?: string;
  startingCash: number;
  expectedCash: number;
  actualCash?: number;
  difference?: number;
  salesCount: number;
  totalSales: number;
}

export interface CashMovement {
  id: string;
  timestamp: string;
  type: 'PAY_IN' | 'PAY_OUT' | 'SAFE_DROP' | 'INITIAL';
  amount: number;
  reason: string;
  operator: string;
}

export interface BIEvent {
  id: string;
  timestamp: string;
  eventType: 
    | 'SHIFT_OPENED' 
    | 'SHIFT_CLOSED' 
    | 'CASH_VARIANCE_FOUND'
    | 'SALE_BLOCKED_ZERO_STOCK'
    | 'PRICE_OVERRIDE_REQUESTED'
    | 'STOCK_ADJUSTMENT_REQUESTED'
    | 'FAILED_TERMINAL_LOGIN'
    | 'RECOMMEND_MAJOR_STOCKTAKE'
    | 'SUSPICIOUS_MOVEMENT_ALERT'
    | 'DELIVERY_CODE_PENDING'
    | string;
  operator: string;
  terminal: string;
  payload: {
    floatAmount?: number;
    salesTotal?: number;
    expectedCash?: number;
    actualCash?: number;
    difference?: number;
    approvedBy?: string;
    reason?: string;
    details?: string;
    sku?: string;
    productName?: string;
    attemptedQty?: number;
    standardPrice?: number;
    requestedPrice?: number;
    user?: string;
    attemptsCount?: number;
    suspicionScore?: number;
    [key: string]: any;
  };
  severity: BISeverity;
}

export interface POSSession {
  vendor: string;
  branch: string;
  terminal: string;
  staffName: string;
  role: string;
}

export interface POSSettings {
  businessProfile: {
    legalName: string;
    taxNo: string;
    regNo: string;
    address: string;
    currency: string;
  };
  hardwareSetting: {
    laserFocus: string;
    drawerSignal: string;
  };
  taxSetting: {
    vatRatePct: number;
    surtaxPct: number;
    inclusive: boolean;
  };
  receiptSetting: {
    header: string;
    footer: string;
    slipWidth: string;
    showTaxBreakdown: boolean;
  };
}

export interface BusinessProfile {
  legalName: string;
  taxNo: string;
  regNo: string;
  address: string;
  currency: string;
}

export interface BranchSetting {
  id: string;
  name: string;
  location: string;
}

export interface WarehouseSetting {
  id: string;
  name: string;
  branchId: string;
}

export interface TerminalSetting {
  id: string;
  name: string;
  branchId: string;
  type: string;
}

export interface StaffSetting {
  id: string;
  name: string;
  email: string;
  role: Role;
  pass: string;
  branchId: string;
}

export interface HardwareSetting {
  laserFocus: string;
  drawerSignal: string;
}

export interface TaxSetting {
  vatRatePct: number;
  surtaxPct: number;
  inclusive: boolean;
}

export interface ReceiptSetting {
  header: string;
  footer: string;
  slipWidth: string;
  showTaxBreakdown: boolean;
}

export type PosPageId = 
  | 'DASHBOARD'
  | 'OWNER_DESK'
  | 'SALES'
  | 'DELIVERY'
  | 'STOCK'
  | 'SHIFT'
  | 'CASH'
  | 'BI_DESK'
  | 'SYNC_DESK'
  | 'SETTINGS';

export interface AuditEvent {
  id: string;
  timestamp: string;
  eventType: string;
  operator: string;
  category: string;
  description: string;
  details?: string;
}

// Aliases for compatibility
export type Transaction = Sale;
export type CashLog = CashMovement;
export type BiEvent = BIEvent;
export type PosSession = POSSession;

export type ApprovalRequestType = 
  | 'Discount Approval' 
  | 'Price Override' 
  | 'Void Line' 
  | 'Refund Request placeholder'
  | 'Return Request'
  | 'Refund Request'
  | 'Void Sale'
  | 'GRN Variance Approval'
  | 'Cost Spike Approval'
  | 'Stock Adjustment Approval'
  | 'Supplier Return Approval'
  | 'Stocktake Variance Approval';

export type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected';

export interface ApprovalRequest {
  id: string;
  type: ApprovalRequestType;
  productId?: string;
  productName?: string;
  receiptNo?: string;
  requestedBy: string;
  originalValue?: string;
  requestedValue?: string;
  reason?: string;
  status: ApprovalStatus;
  targetDiscountPct?: number;
  targetPrice?: number;
  generalDiscountPct?: number;
  paymentMethod?: string;
  refundAmount?: number;
  approvedBy?: string;
  notes?: string;
  createdAt?: string;
  payload?: any;
}

export type SalesEventType = 
  | 'PRODUCT_ADDED'
  | 'DISCOUNT_REQUESTED'
  | 'PRICE_OVERRIDE_REQUESTED'
  | 'APPROVAL_GRANTED'
  | 'APPROVAL_REJECTED'
  | 'VOID_REQUESTED'
  | 'VOID_APPROVED'
  | 'VOID_REJECTED'
  | 'TRANSACTION_HELD'
  | 'SALE_COMPLETED'
  | 'CART_CLEARED'
  | 'PRODUCT_REMOVED'
  | 'RECEIPT_PRINT_PREVIEWED'
  | 'RETURN_REQUESTED'
  | 'RETURN_APPROVED'
  | 'RETURN_REJECTED'
  | 'REFUND_REQUESTED'
  | 'REFUND_APPROVED'
  | 'REFUND_REJECTED';

export interface ReturnRequest {
  id: string;
  receiptNo: string;
  productId: string;
  productName: string;
  quantity: number;
  reason: string;
  condition: string;
  requestedBy: string;
  notes?: string;
  status: ApprovalStatus;
}

export interface RefundRequest {
  id: string;
  receiptNo: string;
  refundAmount: number;
  refundMethod: string;
  reason: string;
  requestedBy: string;
  notes?: string;
  status: ApprovalStatus;
}

export interface VoidRequest {
  id: string;
  receiptNo: string;
  reason: string;
  requestedBy: string;
  notes?: string;
  status: ApprovalStatus;
}

export type SensitiveSaleActionType = 
  | 'RETURN_REQUEST'
  | 'REFUND_REQUEST'
  | 'VOID_SALE'
  | 'PRICE_OVERRIDE'
  | 'VOID_LINE';

export interface SalesEvent {
  id: string;
  timestamp: string;
  eventType: SalesEventType;
  message: string;
  operator: string;
}

export interface PurchaseOrder {
  poNumber: string;
  supplierName: string;
  createdDate: string;
  expectedDate: string;
  itemsCount: number;
  totalCost: number;
  status: 'Open' | 'Partially Received' | 'Closed' | 'Overdue';
  items: {
    sku: string;
    productName: string;
    quantity: number;
    cost: number;
  }[];
}

export interface GRNLine {
  sku: string;
  productName: string;
  orderedQty: number;
  receivedQty: number;
  costPrice: number;
  prevCostPrice: number;
  currentPrice: number;
  suggestedPrice: number;
  status: 'Matched' | 'Short Received' | 'Over Received' | 'Cost Spike' | 'Pending' | string;
  accepted: boolean;
  rejected: boolean;
  priceUpdated: boolean;
  flagged: boolean;
}

export interface GoodsReceivedNote {
  grnNumber: string;
  supplierName: string;
  supplierInvoiceNo: string;
  purchaseOrderNo: string;
  branchName: string;
  warehouseName: string;
  receivedBy: string;
  receivedDate: string;
  notes: string;
  items: GRNLine[];
  status: 'Pending Approval' | 'Posted' | 'Rejected';
}

export interface SupplierReturn {
  id: string;
  supplierName: string;
  originalGrn: string;
  sku: string;
  productName: string;
  quantityReturned: number;
  reason: 'Wrong item supplied' | 'Damaged item' | 'Short expiry' | 'Warranty claim' | 'Over supplied' | 'Other' | string;
  condition: 'Resellable' | 'Damaged' | 'Repair needed' | 'Scrap' | string;
  status: 'Draft' | 'Pending Approval' | 'Shipped' | 'Credited';
  createdDate: string;
  requestedBy: string;
}

export interface StockAdjustmentRequest {
  id: string;
  sku: string;
  productName: string;
  systemQty: number;
  countedQty: number;
  reason: 'Stocktake variance' | 'Damaged stock' | 'Lost stock' | 'Found stock' | 'Data correction' | 'Supplier issue' | 'Theft suspicion' | string;
  requestedBy: string;
  supervisorRequired: boolean;
  notes: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  createdDate: string;
}

export interface StocktakeLine {
  sku: string;
  productName: string;
  systemQty: number;
  countedQty: number;
  variance: number;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'Pending' | 'Counted' | 'Risk Flagged';
}

export interface StocktakeSession {
  id: string;
  startDate: string;
  status: 'In Progress' | 'Completed';
  type: 'Spot Check' | 'Full Stocktake';
  items: StocktakeLine[];
}

export interface PurchaseDisciplineEvent {
  id: string;
  timestamp: string;
  eventType: 'SHORT_RECEIVED' | 'OVER_RECEIVED' | 'COST_PRICE_SPIKE' | 'SELLING_BELOW_COST_BLOCKED' | 'GOODS_RECEIVED' | 'PURCHASE_VARIANCE_FOUND';
  grnNumber: string;
  sku: string;
  productName: string;
  details: string;
  operator: string;
}

export type DeliveryStatus = 'Pending Assignment' | 'Assigned' | 'Out for Delivery' | 'Completed' | 'Failed' | 'Waiting Collection';
export type DeliveryMethod = 'Vendor Delivery' | 'External Delivery' | 'Customer Collection' | 'Courier Placeholder';
export type VehicleType = 'Bike' | 'Car' | 'Kombi' | 'Lorry' | 'Walking Courier' | 'Other';
export type DeliveryCodeStatus = 'Not Generated' | 'Code Generated' | 'Code Sent' | 'Code Pending' | 'Code Confirmed';
export type DeliveryFailureReason = 'Customer unavailable' | 'Wrong address' | 'Customer rejected delivery' | 'Delivery person failed to confirm code' | 'Vehicle breakdown' | 'Product issue' | 'Other' | '';

export interface DeliveryOrder {
  id: string;
  receiptNumber: string;
  customerName: string;
  customerWhatsApp: string;
  deliveryAddress: string;
  district: string;
  suburb: string;
  deliveryMethod: DeliveryMethod;
  status: DeliveryStatus;
  secretCode?: string;
  codeStatus: DeliveryCodeStatus;
  deliveryPersonId?: string;
  vehicleType?: VehicleType;
  vehicleRegistration?: string;
  driverPhone?: string;
  deliveryCharge?: number;
  notes?: string;
  failedReason?: string;
  nextAction?: string;
  recipientName?: string;
  timeFlagged?: string;
}

export interface DeliveryPerson {
  driverId: string;
  name: string;
  phone: string;
  vehicleType: VehicleType;
  vehicleRegistration: string;
  licenceNumber: string;
  nationalIdPlaceholder: string;
  serviceArea: string;
  status: 'Active' | 'Pending Verification' | 'Disabled';
}

export interface WalkInCollection {
  receiptNumber: string;
  customerName: string;
  customerWhatsApp: string;
  collectionCode: string;
  collectedBy?: string;
  notes?: string;
  status: 'Pending' | 'Completed' | 'Failed';
}

export type DeliveryEventType = 
  | 'DELIVERY_ASSIGNED'
  | 'DELIVERY_SECRET_CODE_GENERATED'
  | 'DELIVERY_CODE_SENT_PENDING_CONFIRMATION'
  | 'DELIVERY_COMPLETED'
  | 'DELIVERY_CODE_FAILED'
  | 'WALK_IN_COLLECTION_COMPLETED'
  | 'DELIVERY_FAILED'
  | 'COLLECTION_CODE_FAILED';

export interface DeliveryEvent {
  id: string;
  timestamp: string;
  eventType: DeliveryEventType;
  message: string;
  operator: string;
}

// Offline Terminal Queue & Sync Status Prototype Types
export type SyncDomain = 'Sales' | 'Stock' | 'Cash' | 'BI' | 'Delivery' | 'CRM' | 'Settings';

export type SyncStatus = 'Pending' | 'Ready' | 'Synced' | 'Conflict' | 'Failed';

export type SyncRisk = 'Low' | 'Medium' | 'High' | 'Critical';

export interface SyncQueueItem {
  id: string; // e.g., Q-001
  domain: SyncDomain;
  eventType: string; // e.g., SALE_COMPLETED
  reference: string; // e.g., RCT-0008, ADJ-0002
  createdBy: string;
  createdAt: string; // timestamp ISO or formatted
  syncStatus: SyncStatus;
  risk: SyncRisk;
  payload: string; // stringified JSON
}

export interface SyncConflict {
  id: string; // SC-001
  conflictType: string; // STOCK_CONFLICT, etc
  risk: SyncRisk;
  description: string;
  recommendedAction: string;
}

export type SyncActivityType = 
  | 'TERMINAL_OFFLINE_MODE_ENABLED' 
  | 'TERMINAL_ONLINE_MODE_ENABLED' 
  | 'LOCAL_QUEUE_ITEM_CREATED' 
  | 'SYNC_CHECK_COMPLETED' 
  | 'LOCAL_QUEUE_SYNCED' 
  | 'SYNC_CONFLICT_FLAGGED' 
  | 'SYNCED_QUEUE_CLEARED' 
  | 'OFFLINE_AUDIT_EXPORT_PREPARED';

export interface SyncActivityEvent {
  id: string;
  timestamp: string;
  eventType: SyncActivityType;
  message: string;
  operator: string;
}

export type TerminalConnectivityStatus = 'ONLINE' | 'OFFLINE';

export type EODStatus =
  | 'Passed'
  | 'Warning'
  | 'Failed'
  | 'Pending'
  | 'Balanced'
  | 'Variance'
  | 'Review';

export interface OwnerSummary {
  todaySales: string;
  grossMarginPlaceholder: string;
  cashExpected: string;
  cashDeclared: string;
  cashVariance: string;
  openApprovals: number;
  stockRiskFlags: number;
  pendingSyncItems: number;
  completedDeliveries: number;
  whatsAppLeads: number;
  convertedOrders: number;
  eodStatus: string;
}

export interface EODChecklistItem {
  id: string;
  label: string;
  status: Extract<EODStatus, 'Passed' | 'Warning' | 'Failed' | 'Pending'>;
  ownerAction: string;
  notes: string;
}

export interface EODReconciliationRow {
  id: string;
  domain: string;
  expected: string;
  actual: string;
  variance: string;
  status: Extract<EODStatus, 'Balanced' | 'Variance' | 'Review' | 'Failed'>;
  requiredAction: string;
}

export interface TerminalEODSummary {
  id: string;
  branch: string;
  terminal: string;
  staff: string;
  shiftStatus: 'Open' | 'Closed';
  sales: string;
  expectedCash: string;
  declaredCash: string;
  variance: string;
  syncStatus: 'Pending Sync' | 'Synced' | 'Conflict';
  action: 'Review' | 'View';
}

export type OwnerApprovalStatus = 'Pending' | 'Approved' | 'Rejected' | 'Reviewed' | 'Escalated' | 'Open';

export interface OwnerApprovalItem {
  id: string;
  type: string;
  requestedBy: string;
  amountOrValue: string;
  risk: RiskLevel;
  status: OwnerApprovalStatus;
  action: string;
}

export interface OwnerBIAlert {
  id: string;
  eventType: string;
  severity: RiskLevel;
  message: string;
}

export type OwnerActivityEventType =
  | 'EOD_CHECK_RUN'
  | 'OWNER_BI_REVIEW_STARTED'
  | 'OWNER_CASH_VARIANCE_REVIEWED'
  | 'OWNER_SYNC_REVIEW_STARTED'
  | 'APPROVAL_MARKED_REVIEWED'
  | 'EOD_LOCK_ATTEMPTED'
  | 'EOD_REPORT_EXPORT_PREPARED';

export interface OwnerActivityEvent {
  id: string;
  timestamp: string;
  eventType: OwnerActivityEventType;
  message: string;
  operator: string;
}


