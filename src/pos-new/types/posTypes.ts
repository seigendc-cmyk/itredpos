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

export type TerminalLifecycleStatus =
  | 'Registered'
  | 'Activation Requested'
  | 'Active'
  | 'Suspended'
  | 'Deactivated'
  | 'Locked'
  | 'Pending Review';

export type ShiftLifecycleStatus =
  | 'Not Opened'
  | 'Open'
  | 'Closing Review'
  | 'Closed'
  | 'Force Closed'
  | 'Locked';

export type TerminalActionType =
  | 'ACTIVATE_TERMINAL'
  | 'DEACTIVATE_TERMINAL'
  | 'LOCK_TERMINAL'
  | 'REQUEST_REACTIVATION'
  | 'OPEN_SHIFT'
  | 'CLOSE_SHIFT'
  | 'FORCE_CLOSE_SHIFT'
  | 'ASSIGN_CASH_DRAWER'
  | 'UNASSIGN_CASH_DRAWER'
  | 'SALE_BLOCKED_SHIFT_OR_TERMINAL';

export interface TerminalLifecycleRecord {
  id: string;
  vendorId: string;
  branchId: string;
  terminalId: string;
  terminalName: string;
  status: TerminalLifecycleStatus;
  requestedBy?: string;
  requestedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  reason?: string;
  lockedReason?: string;
  updatedAt: string;
}

export interface TerminalActivationRequest {
  id: string;
  vendorId: string;
  branchId: string;
  terminalId: string;
  terminalName: string;
  status: 'Activation Requested' | 'Active' | 'Pending Review';
  requestedBy: string;
  requestedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  reason: string;
}

export interface ShiftSessionControl {
  id: string;
  vendorId: string;
  branchId: string;
  terminalId: string;
  terminalName: string;
  staffId: string;
  staffName: string;
  status: ShiftLifecycleStatus;
  openedAt?: string;
  closedAt?: string;
  openingFloat: number;
  expectedCash: number;
  declaredCash?: number;
  variance?: number;
  notes?: string;
  reviewedBy?: string;
}

export interface CashDrawerAssignment {
  id: string;
  vendorId: string;
  branchId: string;
  terminalId: string;
  terminalName: string;
  drawerId: string;
  staffId: string;
  staffName: string;
  status: 'Assigned' | 'Unassigned' | 'Review';
  openingFloat: number;
  assignedAt: string;
  unassignedAt?: string;
  notes?: string;
}

export interface TerminalControlCheck {
  allowed: boolean;
  message: string;
  reasons: string[];
  terminalStatus?: TerminalLifecycleStatus;
  shiftStatus?: ShiftLifecycleStatus;
  drawerAssigned: boolean;
  salesAllowed: boolean;
}

export interface TerminalControlEvent {
  id: string;
  vendorId: string;
  branchId: string;
  terminalId: string;
  staffId?: string;
  staffName?: string;
  eventType: TerminalActionType | string;
  message: string;
  severity: BISeverity;
  createdAt: string;
}

export type Role = 'Owner' | 'SysAdmin' | 'Manager' | 'Cashier' | 'Stock Controller' | 'Supervisor' | 'Delivery Staff';

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

export type BIAdviceStatus =
  | 'New'
  | 'Assigned'
  | 'In Progress'
  | 'Waiting Review'
  | 'Resolved'
  | 'Dismissed'
  | 'Escalated'
  | 'Blocked';

export type BIAdviceCategory =
  | 'Stock Health'
  | 'Reorder Control'
  | 'Shelf Stocktake'
  | 'Staff Behaviour'
  | 'Cash Control'
  | 'Sales Integrity'
  | 'Delivery Verification'
  | 'Pricing Control'
  | 'Approval Control'
  | 'Inventory Risk';

export type BIAdvicePriority = 'Low' | 'Medium' | 'High' | 'Critical';

export type BIAdviceActionType =
  | 'Review Stock'
  | 'Block Reorder'
  | 'Create Purchase Reminder'
  | 'Assign Shelf Stocktake'
  | 'Start Stocktake'
  | 'Create Task'
  | 'Request Approval'
  | 'Review Staff Action'
  | 'Review Cash Variance'
  | 'Review Delivery'
  | 'Dismiss Warning'
  | 'Escalate To Owner';

export type BIAdviceRecipientType = 'Staff' | 'Role' | 'Desk' | 'Branch' | 'Owner';

export interface BIAdviceActionPoint {
  actionPointId: string;
  adviceId: string;
  actionType: BIAdviceActionType;
  label: string;
  description: string;
  assignedToStaffId?: string;
  assignedToRole?: string;
  dueDate?: string;
  status: BIAdviceStatus;
  completedAt?: string;
  completedByStaffId?: string;
  resultNote?: string;
}

export interface BIAdviceRecord {
  adviceId: string;
  adviceNumber: string;
  category: BIAdviceCategory;
  title: string;
  narrative: string;
  riskLevel: RiskLevel;
  priority: BIAdvicePriority;
  sourceTriggerId: string;
  sourceLogId?: string;
  sourceModule: string;
  productId?: string;
  productName?: string;
  sku?: string;
  branchId?: string;
  branchName?: string;
  shelfLocation?: string;
  assignedToStaffId?: string;
  assignedToStaffName?: string;
  assignedToRole?: string;
  assignedDesk?: string;
  dueDate?: string;
  status: BIAdviceStatus;
  recommendedAction: BIAdviceActionType;
  actionPoints: BIAdviceActionPoint[];
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  notes?: string;
}

export interface BIAdviceRuleResult {
  ruleName: string;
  triggered: boolean;
  riskLevel: RiskLevel;
  advice?: BIAdviceRecord;
  warning?: BIReorderBlockWarning;
  notes: string;
}

export interface BIShelfStocktakeAssignment {
  assignmentId: string;
  branchId: string;
  branchName: string;
  warehouseId: string;
  shelfLocation: string;
  assignedDate: string;
  assignedStaffId: string;
  assignedStaffName: string;
  itemCount: number;
  status: 'Assigned' | 'In Progress' | 'Completed' | 'Pending' | 'Reassigned';
  reason: string;
  createdFromBIAdviceId: string;
}

export interface BIReorderBlockWarning {
  warningId: string;
  productId: string;
  sku: string;
  productName: string;
  currentQty: number;
  availableQty: number;
  lastMovementDate?: string;
  daysWithoutMovement: number;
  reorderRequestId?: string;
  blocked: boolean;
  reason: string;
  createdAt: string;
}

export interface BIAdviceFilterState {
  search?: string;
  category?: 'ALL' | BIAdviceCategory;
  priority?: 'ALL' | BIAdvicePriority;
  riskLevel?: 'ALL' | RiskLevel;
  status?: 'ALL' | BIAdviceStatus;
  assignedRole?: string;
  assignedStaff?: string;
  branch?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface BIAdviceActivityEvent {
  eventId: string;
  eventType:
    | 'BI_ADVICE_GENERATED'
    | 'BI_ADVICE_ACTION_MENU_OPENED'
    | 'BI_ADVICE_DETAIL_OPENED'
    | 'BI_ADVICE_ASSIGNED'
    | 'BI_ADVICE_ROUTED_TO_DESK'
    | 'BI_ACTION_POINT_CREATED'
    | 'BI_ACTION_POINT_COMPLETED'
    | 'BI_REORDER_BLOCK_WARNING_CREATED'
    | 'BI_SHELF_STOCKTAKE_PLAN_CREATED'
    | 'BI_SHELF_STOCKTAKE_ASSIGNED'
    | 'BI_SHELF_STOCKTAKE_STARTED_FROM_ADVICE'
    | 'BI_ADVICE_RESOLVED'
    | 'BI_ADVICE_DISMISSED'
    | 'BI_ADVICE_ESCALATED'
    | 'BI_TASK_CREATED_FROM_ADVICE';
  adviceId?: string;
  message: string;
  staffId?: string;
  createdAt: string;
}

export type PaymentMethod = 'Cash' | 'EcoCash' | 'Swipe' | 'Bank Transfer' | 'Split Payment' | 'CASH' | 'CARD' | 'NFC' | 'SPLIT';

export interface Product {
  id: string;
  code: string; // SKU or Barcode
  name: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  availableStock?: number;
  minStock: number;
  unit: string;
  vendorId?: string;
  branchId?: string;
  warehouseId?: string;
  industrialSector?: string;
  productCategory?: string;
  productSubCategory?: string;
  sku?: string;
  barcode?: string;
  alu?: string;
  productNumericNumber?: string;
  productName?: string;
  brand?: string;
  manufacturer?: string;
  supplierId?: string;
  supplierName?: string;
  shelfLocation?: string;
  binLocation?: string;
  serialNumber?: string;
  batchNumber?: string;
  unitOfMeasure?: string;
  qtyOnHand?: number;
  reorderLevel?: number;
  costPrice?: number;
  sellingPrice?: number;
  salesAccountCOA?: string;
  assetAccountCOA?: string;
  stockStatus?: StockStatus;
  riskLevel?: RiskLevel;
  isSerialized?: boolean;
  isActive?: boolean;
  createdByStaffId?: string;
  createdAt?: string;
  updatedAt?: string;
  branch?: string;
  warehouse?: string;
  lastMovementDate?: string;
  healthStatus?: StockStatus;
}

export type ProductStatus = 'Draft' | 'Active' | 'Blocked' | 'Inactive' | 'Discontinued' | 'Pending Review';

export type StockLocationType =
  | 'Sales Floor'
  | 'Branch Sales Floor'
  | 'Branch Warehouse'
  | 'Main Warehouse'
  | 'Back Store'
  | 'Shelf'
  | 'Holding Area'
  | 'Damaged Holding'
  | 'Damaged Stock'
  | 'Return Holding'
  | 'Supplier Return Preparation'
  | 'In Transit'
  | 'Quarantine'
  | 'Other'
  | 'Supplier Return Bay'
  | 'Virtual';

export type StockBalanceStatus =
  | 'Available'
  | 'Low Stock'
  | 'Out Of Stock'
  | 'Out of Stock'
  | 'Reserved'
  | 'Damaged'
  | 'Return Holding'
  | 'In Transit'
  | 'Blocked'
  | 'Quarantine'
  | 'Reorder Required'
  | 'Stocktake Review';

export type ProductRiskStatus =
  | 'Normal'
  | 'Low Stock'
  | 'Out Of Stock'
  | 'Overstocked'
  | 'No Movement'
  | 'Slow Moving'
  | 'Fast Moving'
  | 'Variance Risk'
  | 'Blocked'
  | 'None'
  | 'Low Margin'
  | 'Supplier Risk'
  | 'Dead Stock'
  | 'Blocked Sale'
  | 'Credit Review';

export interface ProductSectorAttributes {
  sector: string;
  productCategory: string;
  productSubCategory?: string;
  brand?: string;
  manufacturer?: string;
  model?: string;
  size?: string;
  colour?: string;
  material?: string;
  weight?: string;
  warrantyPeriod?: string;
  make?: string;
  yearFrom?: string;
  yearTo?: string;
  side?: string;
  partNumber?: string;
  oemNumber?: string;
  engineCode?: string;
  chassisCode?: string;
  productType?: string;
  productGrade?: string;
  expiryRequired?: boolean;
  serialTrackingRequired?: boolean;
  batchTrackingRequired?: boolean;
  notes?: string;
}

export interface ProductMasterRecord {
  productId: string;
  vendorId: string;
  productCode: string;
  sku: string;
  barcode?: string;
  alu?: string;
  vendorSku?: string;
  productNumericNumber?: string;
  productName: string;
  description?: string;
  shortDescription?: string;
  brand?: string;
  manufacturer?: string;
  supplierName?: string;
  supplierItemCode?: string;
  industrialSector?: string;
  productCategory?: string;
  productSubCategory?: string;
  productType: 'Stock Item' | 'Service' | 'Bundle' | 'Consumable' | 'Non-Stock';
  status: ProductStatus;
  productStatus?: ProductStatus;
  riskStatus: ProductRiskStatus;
  category: string;
  unitOfMeasure: string;
  condition?: string;
  colour?: string;
  make?: string;
  model?: string;
  yearFrom?: string;
  yearTo?: string;
  side?: string;
  partNumber?: string;
  oemNumber?: string;
  tags?: string[];
  taxCode: string;
  taxMode?: string;
  vatRate?: number;
  defaultSellingPrice: number;
  defaultCostPrice: number;
  reorderLevel?: number;
  reorderQty?: number;
  marginPercent: number;
  preferredSupplierId?: string;
  preferredSupplierName?: string;
  salesAccountCOA?: string;
  assetAccountCOA?: string;
  cogsAccountCOA?: string;
  sectorAttributes: ProductSectorAttributes;
  imageUrl?: string;
  createdByStaffId: string;
  approvedByStaffId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductBarcodeRecord {
  barcodeId: string;
  productId: string;
  barcode: string;
  barcodeType: 'Primary' | 'Alternate' | 'Supplier' | 'Case Pack';
  packSize: number;
  isActive: boolean;
  notes?: string;
}

export interface ProductStockBalance {
  balanceId: string;
  vendorId: string;
  productId: string;
  sku: string;
  productName: string;
  branchId: string;
  branchName: string;
  warehouseId: string;
  warehouseName: string;
  locationId: string;
  locationName: string;
  locationType: StockLocationType;
  shelfLocation?: string;
  binLocation?: string;
  qtyOnHand: number;
  qtyReserved: number;
  qtyAvailable: number;
  qtyDamaged: number;
  qtyReturnHolding?: number;
  qtyInTransit: number;
  qtyBlocked?: number;
  reorderLevel: number;
  reorderQty: number;
  status: StockBalanceStatus;
  lastMovementDate?: string;
  lastMovementAt?: string;
  lastStocktakeAt?: string;
  updatedAt: string;
}

export interface ProductLocationBalance extends ProductStockBalance {
  locationDisplay: string;
}

export interface ProductReorderRule {
  ruleId: string;
  productId: string;
  branchId: string;
  warehouseId: string;
  locationType?: StockLocationType;
  minQty: number;
  maxQty: number;
  reorderQty: number;
  preferredSupplierId?: string;
  preferredSupplierName?: string;
  leadTimeDays: number;
  isActive: boolean;
  status?: 'Active' | 'Inactive' | 'Review';
  notes?: string;
}

export interface ProductSupplierLink {
  supplierLinkId: string;
  productId: string;
  supplierId: string;
  supplierName: string;
  supplierSku?: string;
  supplierItemCode?: string;
  supplierBarcode?: string;
  lastCost: number;
  leadTimeDays: number;
  minimumOrderQty: number;
  isPreferred: boolean;
  status: 'Active' | 'Inactive' | 'Review';
}

export interface ProductPriceRecord {
  priceId: string;
  productId: string;
  priceListName: string;
  sellingPrice: number;
  costPrice: number;
  marginPercent: number;
  markupPercent?: number;
  taxMode?: string;
  vatRate?: number;
  lastCostPrice?: number;
  currentSellingPrice?: number;
  currency: string;
  effectiveFrom: string;
  effectiveTo?: string;
  status: 'Active' | 'Scheduled' | 'Expired';
}

export interface ProductMasterFilterState {
  search?: string;
  sku?: string;
  barcode?: string;
  alu?: string;
  productName?: string;
  brand?: string;
  manufacturer?: string;
  status?: 'ALL' | ProductStatus;
  productStatus?: 'ALL' | ProductStatus;
  riskStatus?: 'ALL' | ProductRiskStatus;
  sector?: string;
  industrialSector?: string;
  category?: string;
  subCategory?: string;
  supplier?: string;
  branchId?: string;
  warehouseId?: string;
  locationType?: 'ALL' | StockLocationType;
  stockStatus?: 'ALL' | StockBalanceStatus;
}

export interface ProductMasterSummary {
  totalProducts: number;
  activeProducts: number;
  draftProducts?: number;
  blockedProducts: number;
  inactiveProducts: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  multiLocationProducts: number;
  damagedHoldingProducts?: number;
  returnHoldingProducts?: number;
  inTransitProducts?: number;
  reorderRequiredProducts?: number;
  supplierLinkedProducts: number;
  riskProducts: number;
}

export type ManualProductFormMode = 'Create' | 'Edit' | 'View';

export type ProductCreationStatus = 'Draft' | 'Active' | 'Pending Review' | 'Blocked' | 'Rejected';

export type OpeningBalanceDraftStatus = 'Draft' | 'Pending Approval' | 'Approved' | 'Posted' | 'Cancelled';

export interface ManualProductDraft {
  productId?: string;
  vendorId: string;
  productName: string;
  sku?: string;
  barcode?: string;
  alu?: string;
  vendorSku?: string;
  productNumericNumber?: string;
  description?: string;
  brand?: string;
  manufacturer?: string;
  industrialSector: string;
  category?: string;
  subcategory?: string;
  unitOfMeasure?: string;
  condition?: string;
  colour?: string;
  tags?: string[];
  productStatus: ProductCreationStatus;
  make?: string;
  model?: string;
  yearFrom?: string;
  yearTo?: string;
  side?: string;
  partNumber?: string;
  oemNumber?: string;
  engineCode?: string;
  chassisCode?: string;
  size?: string;
  material?: string;
  grade?: string;
  productType?: string;
  wattage?: string;
  voltage?: string;
  batteryCapacity?: string;
  panelType?: string;
  inverterType?: string;
  costPrice?: number;
  sellingPrice?: number;
  taxMode?: string;
  vatRate?: number;
  priceEffectiveDate?: string;
  priceNotes?: string;
  supplierName?: string;
  supplierItemCode?: string;
  supplierContact?: string;
  supplierPhone?: string;
  supplierEmail?: string;
  lastCost?: number;
  leadTimeDays?: number;
  minimumOrderQty?: number;
  preferredSupplier?: boolean;
  supplierNotes?: string;
  branchId?: string;
  warehouseId?: string;
  shelfLocation?: string;
  openingQty?: number;
  openingUnitCost?: number;
  reorderLevel?: number;
  reorderQty?: number;
  locationType?: StockLocationType;
  notes?: string;
  createdByStaffId?: string;
  createdByStaffName?: string;
}

export interface ManualProductValidationIssue {
  issueId: string;
  field: string;
  severity: 'Error' | 'Warning' | 'Info';
  message: string;
  suggestedFix: string;
}

export interface OpeningBalanceDraftLine {
  lineId: string;
  openingBalanceId: string;
  productId: string;
  sku: string;
  productName: string;
  shelfLocation?: string;
  qty: number;
  unitCost: number;
  valueEstimate: number;
}

export interface OpeningBalanceDraft {
  openingBalanceId: string;
  openingBalanceNumber: string;
  vendorId: string;
  branchId: string;
  warehouseId: string;
  productId: string;
  sku: string;
  productName: string;
  shelfLocation?: string;
  qty: number;
  unitCost: number;
  valueEstimate: number;
  status: OpeningBalanceDraftStatus;
  createdByStaffId: string;
  createdByStaffName: string;
  approvedByStaffId?: string;
  postedByStaffId?: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type ProductCreationActivityEventType =
  | 'PRODUCT_DRAFT_CREATED'
  | 'PRODUCT_CREATED'
  | 'PRODUCT_ACTIVATED'
  | 'PRODUCT_DUPLICATE_WARNING'
  | 'PRODUCT_BLOCKED'
  | 'SUPPLIER_LINK_CREATED'
  | 'PRICE_RECORD_CREATED'
  | 'REORDER_RULE_CREATED'
  | 'OPENING_BALANCE_DRAFT_CREATED'
  | 'OPENING_BALANCE_APPROVED'
  | 'OPENING_BALANCE_POSTED'
  | 'OPENING_BALANCE_CANCELLED';

export interface ProductCreationActivityEvent {
  eventId: string;
  eventType: ProductCreationActivityEventType;
  productId?: string;
  openingBalanceId?: string;
  message: string;
  staffId?: string;
  staffName?: string;
  createdAt: string;
}

export interface ProductStockBalanceSummary {
  totalLocations: number;
  totalQtyOnHand: number;
  totalQtyAvailable: number;
  totalQtyReserved: number;
  totalQtyDamaged: number;
  totalQtyReturnHolding?: number;
  totalQtyInTransit: number;
  totalQtyBlocked?: number;
  reorderRequiredLocations?: number;
  lowStockLocations: number;
  outOfStockLocations: number;
  stocktakeReviewLocations: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
  discount: number; // custom percentage or dollar
  overriddenPrice?: number;
  lineType?: 'InventoryItem' | 'MiscellaneousItem' | 'ServiceItem' | 'DeliveryFee' | 'Discount' | 'Credit';
  isInventoryAsset?: boolean;
  inventoryProductId?: string;
  sku?: string;
  miscReason?: string;
  miscNotes?: string;
  requiresManagementReview?: boolean;
  biFlagged?: boolean;
  stockMovementRequired?: boolean;
  taxable?: boolean;
  vatRate?: number;
}

export interface SalePayment {
  method: PaymentMethod;
  amount: number;
  reference?: string;
}

export type SalesProfitPeriod = 'Today' | 'Current Shift' | 'Yesterday' | 'This Week' | 'This Month' | 'Custom';

export type SalesProfitSnapshotStatus = 'Ready' | 'Empty' | 'Restricted' | 'Generated' | 'Error';

export interface SalesProfitSnapshotFilter {
  period: SalesProfitPeriod;
  dateFrom?: string;
  dateTo?: string;
  branchId?: string;
  terminalId?: string;
  cashierStaffId?: string;
  includeHeldSales?: boolean;
  includeReturns?: boolean;
  includeDiscounts?: boolean;
  includeDeliveryFees?: boolean;
  includeOpex?: boolean;
  includeDrawerExpenses?: boolean;
}

export interface SalesProfitDrawerExpense {
  expenseId: string;
  expenseType: string;
  amount: number;
  note: string;
  staff: string;
  time: string;
}

export interface SalesProfitSnapshotMetric {
  label: string;
  value: number | string;
  tone?: 'Neutral' | 'Good' | 'Warning' | 'Danger';
}

export interface SalesProfitSnapshotPayload {
  snapshotId: string;
  generatedAt: string;
  generatedBy: string;
  period: SalesProfitPeriod;
  dateFrom?: string;
  dateTo?: string;
  branchName: string;
  terminalName: string;
  cashierName: string;
  grossSalesRevenue: number;
  returnsValue: number;
  netSalesRevenue: number;
  cogs: number;
  grossProfit: number;
  opex: number;
  drawerExpenses: number;
  netDrawerProfit: number;
  drawerExpenseBreakdown: SalesProfitDrawerExpense[];
  salesCount: number;
  itemCount: number;
  averageGrossMargin: number;
  notes: string;
  status: SalesProfitSnapshotStatus;
}

export interface SalesProfitSnapshotActivityEvent {
  eventId: string;
  eventType: 'SALES_PROFIT_SNAPSHOT_GENERATED' | 'SALES_PROFIT_SNAPSHOT_PRINT_PLACEHOLDER' | 'SALES_PROFIT_SNAPSHOT_EXPORT_PLACEHOLDER' | 'SALES_PROFIT_SNAPSHOT_RESTRICTED';
  message: string;
  staffId?: string;
  createdAt: string;
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
    lineType?: CartItem['lineType'];
    isInventoryAsset?: boolean;
    requiresManagementReview?: boolean;
    biFlagged?: boolean;
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
  businessProfile: BusinessProfile;
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
  businessName?: string;
  tradingName?: string;
  businessType?: string;
  industrialSector?: string;
  cityTown?: string;
  district?: string;
  suburb?: string;
  districtSuburb?: string;
  legalName: string;
  taxNo: string;
  regNo: string;
  address: string;
  country?: string;
  phoneNumber1?: string;
  phoneNumber2?: string;
  phoneNumber3?: string;
  whatsAppNumber1?: string;
  whatsAppNumber2?: string;
  whatsAppNumber3?: string;
  primaryEmail?: string;
  supportEmail?: string;
  websitePlaceholder?: string;
  isBusinessRegistered?: boolean;
  isRegisteredBusiness?: boolean;
  registeredBusinessName?: string;
  companyRegistrationNumber?: string;
  tradeCertificateRegistrationNumber?: string;
  registrationDate?: string;
  registrationPlace?: string;
  registrationAuthority?: string;
  taxIdentificationNumber?: string;
  vatRegistered?: boolean;
  vatNumber?: string;
  taxCollector?: boolean;
  isTaxCollector?: boolean;
  taxCollectorType?: string;
  taxRegistrationNumber?: string;
  taxCollectorName?: string;
  taxCollectorContactNumber?: string;
  taxCollectorEmail?: string;
  taxOfficeRegion?: string;
  taxNotes?: string;
  ownerFullName?: string;
  ownerNationalId?: string;
  ownerNationalIdPlaceholder?: string;
  ownerContact?: string;
  ownerPhone?: string;
  ownerWhatsApp?: string;
  ownerEmail?: string;
  ownerRoleTitle?: string;
  businessAdministratorName?: string;
  businessAdministratorPhone?: string;
  administratorEmail?: string;
  accountantName?: string;
  accountantPhone?: string;
  accountantEmail?: string;
  profileStatus?: string;
  profileLastUpdatedAt?: string;
  profileUpdatedBy?: string;
  currency: string;
  receiptBusinessName?: string;
  receiptFooterMessage?: string;
  businessStatus?: string;
}

export interface BranchSetting {
  id: string;
  name: string;
  location: string;
  vendorId?: string;
  branchCode?: string;
  branchType?: 'Main Branch' | 'Retail Branch' | 'Warehouse Branch' | 'Mobile Branch' | 'Admin Office' | 'Distribution Point' | string;
  cityTown?: string;
  district?: string;
  suburb?: string;
  physicalAddress?: string;
  phoneNumber1?: string;
  phoneNumber2?: string;
  whatsAppNumber?: string;
  email?: string;
  branchManager?: string;
  status?: string;
  notes?: string;
  createdByStaffId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type ProductLedgerMovementType =
  | 'Opening Balance'
  | 'Sale'
  | 'Return'
  | 'Goods Received'
  | 'Stock Adjustment'
  | 'Stocktake Adjustment'
  | 'Transfer In'
  | 'Transfer Out'
  | 'Supplier Return'
  | 'Damage / Write-Off'
  | 'Write Off'
  | 'Reversal'
  | 'Correction';

export type ProductLedgerReferenceType =
  | 'Receipt'
  | 'GRN'
  | 'Stocktake'
  | 'Adjustment'
  | 'Transfer'
  | 'Return'
  | 'Supplier Return'
  | 'Manual';

export interface ProductLedgerEntry {
  id: string;
  vendorId: string;
  productId: string;
  sku: string;
  productNumericNumber?: string;
  alu?: string;
  dateTime: string;
  movementType: ProductLedgerMovementType;
  referenceType: ProductLedgerReferenceType;
  referenceNo: string;
  branch: string;
  warehouse: string;
  shelfLocation: string;
  qtyIn: number;
  qtyOut: number;
  balanceAfter: number;
  unitCost: number;
  sellingPrice: number;
  staffId?: string;
  staffName: string;
  notes: string;
  riskFlag: 'None' | 'Low' | 'Medium' | 'High' | 'Critical';
}

export interface ProductLedgerFilters {
  dateFrom?: string;
  dateTo?: string;
  branch?: string;
  warehouse?: string;
  shelfLocation?: string;
  movementType?: 'ALL' | ProductLedgerMovementType | InventoryMovementType;
  referenceType?: 'ALL' | ProductLedgerReferenceType | InventoryReferenceType;
  staff?: string;
  status?: 'ALL' | InventoryMovementStatus;
}

export interface ProductListSearchState {
  query: string;
  branch: string;
  warehouse: string;
  sector: string;
  category: string;
  shelfLocation: string;
}

export interface ProductLedgerSummary {
  openingBalance: number;
  totalQtyIn: number;
  totalQtyOut: number;
  closingBalance: number;
  salesMovements: number;
  returnMovements: number;
  goodsReceivedMovements: number;
  adjustmentMovements: number;
  stocktakeVariances: number;
  transferMovements: number;
  lastMovementDate: string;
  currentSystemQty: number;
}

export type InventoryMovementType =
  | 'OPENING_BALANCE'
  | 'SALE'
  | 'SALE_RETURN'
  | 'CUSTOMER_RETURN'
  | 'GOODS_RECEIVED'
  | 'STOCK_ADJUSTMENT_IN'
  | 'STOCK_ADJUSTMENT_OUT'
  | 'STOCKTAKE_ADJUSTMENT_IN'
  | 'STOCKTAKE_ADJUSTMENT_OUT'
  | 'STOCKTAKE_GAIN'
  | 'STOCKTAKE_LOSS'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'BRANCH_TRANSFER_IN'
  | 'BRANCH_TRANSFER_OUT'
  | 'WAREHOUSE_TRANSFER_IN'
  | 'WAREHOUSE_TRANSFER_OUT'
  | 'SUPPLIER_RETURN'
  | 'DAMAGE_WRITEOFF'
  | 'WRITE_OFF'
  | 'REVERSAL'
  | 'MANUAL_CORRECTION';

export type InventoryReferenceType =
  | 'RECEIPT'
  | 'RETURN'
  | 'GRN'
  | 'OPENING_BALANCE'
  | 'STOCKTAKE'
  | 'ADJUSTMENT'
  | 'TRANSFER'
  | 'STOCK_TRANSFER'
  | 'SUPPLIER_RETURN'
  | 'DAMAGE'
  | 'MANUAL';

export type InventoryMovementStatus = 'Draft' | 'Posted' | 'Pending Approval' | 'Reversed' | 'Rejected';

export interface InventoryMovement {
  movementId: string;
  vendorId: string;
  branchId: string;
  warehouseId: string;
  productId: string;
  sku: string;
  alu?: string;
  productNumericNumber?: string;
  productName: string;
  shelfLocation?: string;
  movementType: InventoryMovementType;
  referenceType: InventoryReferenceType;
  referenceNumber: string;
  transferId?: string;
  qtyIn: number;
  qtyOut: number;
  balanceBefore: number;
  balanceAfter: number;
  unitCost: number;
  sellingPrice: number;
  totalCostImpact: number;
  salesAccountCOA?: string;
  assetAccountCOA?: string;
  staffId: string;
  staffName: string;
  terminalId?: string;
  movementDate: string;
  notes: string;
  riskFlag: 'None' | 'Low' | 'Medium' | 'High' | 'Critical';
  approvalRequired: boolean;
  status: InventoryMovementStatus;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryMovementFilters {
  vendorId?: string;
  productId?: string;
  sku?: string;
  dateFrom?: string;
  dateTo?: string;
  branchId?: string;
  warehouseId?: string;
  shelfLocation?: string;
  movementType?: 'ALL' | InventoryMovementType;
  referenceType?: 'ALL' | InventoryReferenceType;
  referenceNumber?: string;
  staffName?: string;
  status?: 'ALL' | InventoryMovementStatus;
  sector?: string;
  category?: string;
}

export type InventoryMovementPayload = Omit<InventoryMovement, 'movementId' | 'createdAt' | 'updatedAt' | 'balanceAfter' | 'totalCostImpact' | 'movementType' | 'referenceType'> & {
  movementId?: string;
  movementType?: InventoryMovementType;
  referenceType?: InventoryReferenceType;
  balanceAfter?: number;
  totalCostImpact?: number;
};

export interface InventoryMovementSummary {
  totalSaleQtyOut: number;
  totalReturnQtyIn: number;
  totalGoodsReceivedQtyIn: number;
  totalAdjustmentQtyIn: number;
  totalAdjustmentQtyOut: number;
  totalTransferIn: number;
  totalTransferOut: number;
  totalSupplierReturnQtyOut: number;
  netMovement: number;
  highRiskMovements: number;
}

export type InventoryMovementRecord = InventoryMovement;
export type InventoryMovementFilterState = InventoryMovementFilters;

export interface ProductLedgerRow {
  movementId: string;
  productId: string;
  sku: string;
  productName: string;
  movementDate: string;
  movementType: InventoryMovementType;
  referenceType: InventoryReferenceType;
  referenceNumber: string;
  branchId: string;
  warehouseId: string;
  qtyIn: number;
  qtyOut: number;
  balanceBefore: number;
  balanceAfter: number;
  unitCost: number;
  valueImpact: number;
  staffId: string;
  staffName: string;
  notes: string;
}

export type MovementClass = 'Fast Moving' | 'Normal Moving' | 'Slow Moving' | 'Dead Stock' | 'No Movement Data';

export type RecommendedStockAction =
  | 'Reorder'
  | 'Reorder / Stock Review'
  | 'Stop Reordering'
  | 'Discount / Clearance'
  | 'Check Shelf'
  | 'Stocktake Required'
  | 'Supplier Follow-Up'
  | 'Review Price'
  | 'Review Supplier Performance'
  | 'Immediate Stock Review'
  | 'No Action';

export type StockHealthStatus =
  | 'Healthy'
  | 'Low Stock'
  | 'Out Of Stock'
  | 'Dead Stock'
  | 'Slow Moving'
  | 'Fast Moving'
  | 'Overstocked'
  | 'Variance Risk'
  | 'Damaged'
  | 'Return Holding'
  | 'Reorder Required'
  | 'Review Required';

export type StockHealthSeverity = 'Info' | 'Low' | 'Medium' | 'High' | 'Critical';

export type InventoryRecommendationType =
  | 'Create PO Recommendation'
  | 'Transfer Stock Recommendation'
  | 'Stocktake Recommendation'
  | 'Price Review Recommendation'
  | 'Supplier Review Recommendation'
  | 'Dead Stock Clearance Recommendation'
  | 'Overstock Review Recommendation'
  | 'Damage Review Recommendation';

export interface StockHealthFilters {
  vendorId?: string;
  branch?: string;
  warehouse?: string;
  industrialSector?: string;
  category?: string;
  brand?: string;
  supplier?: string;
  shelfLocation?: string;
  stockStatus?: string;
  riskLevel?: string;
  movementPeriod?: 'Today' | 'Last 7 Days' | 'Last 30 Days' | 'Last 90 Days' | 'Custom';
  includeSerialized?: boolean;
  dateFrom?: string;
  dateTo?: string;
}

export interface StockHealthSummary {
  totalProducts: number;
  totalStockUnits: number;
  inventoryValueAtCost: number;
  inventoryValueAtSellingPrice: number;
  lowStockItems: number;
  outOfStockItems: number;
  deadStockItems: number;
  slowMovingItems: number;
  fastMovingItems: number;
  varianceRiskItems: number;
  serializedItems: number;
  productsWithoutShelfLocation: number;
}

export interface StockHealthRow {
  productId: string;
  numericNo: string;
  sku: string;
  alu: string;
  productName: string;
  branchId?: string;
  branchName?: string;
  warehouseId?: string;
  warehouseName?: string;
  locationType?: StockLocationType;
  sector: string;
  category: string;
  brand: string;
  supplier: string;
  branch: string;
  warehouse: string;
  shelfLocation: string;
  qtyOnHand: number;
  qtyAvailable?: number;
  qtyReserved?: number;
  qtyDamaged?: number;
  qtyReturnHolding?: number;
  qtyInTransit?: number;
  reorderLevel: number;
  reorderQty?: number;
  lastSaleDate: string;
  lastMovementDate?: string;
  lastReceivedDate: string;
  daysSinceLastSale: number | null;
  movementCount?: number;
  salesVelocity?: number;
  stockHealthStatus?: StockHealthStatus;
  severity?: StockHealthSeverity;
  estimatedStockValue?: number;
  notes?: string;
  stockStatus: string;
  movementClass: MovementClass;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  recommendedAction: RecommendedStockAction;
}

export type InventoryReportType =
  | 'STOCK_ON_HAND'
  | 'LOW_STOCK'
  | 'OUT_OF_STOCK'
  | 'DEAD_STOCK'
  | 'SLOW_MOVING'
  | 'FAST_MOVING'
  | 'STOCK_VALUATION'
  | 'INVENTORY_MOVEMENT'
  | 'PRODUCT_LEDGER'
  | 'STOCK_ADJUSTMENT'
  | 'STOCKTAKE_VARIANCE'
  | 'GOODS_RECEIVED'
  | 'SUPPLIER_RETURNS'
  | 'STOCK_TRANSFER'
  | 'DAMAGED_HOLDING'
  | 'REORDER'
  | 'INVENTORY_RISK'
  | 'PRODUCT_MASTER_EXPORT'
  | 'Inventory Summary'
  | 'Low Stock'
  | 'Out Of Stock'
  | 'Dead Stock'
  | 'Slow Moving'
  | 'Fast Moving'
  | 'Overstock'
  | 'Stock Value'
  | 'Variance Risk'
  | 'Reorder Recommendation'
  | 'Supplier Performance'
  | 'GRN Delay'
  | 'Transfer Delay'
  | 'Damaged Holding'
  | 'Return Holding'
  | 'Movement Audit'
  | 'Stock Valuation'
  | 'Movement Summary'
  | 'Low Stock Report'
  | 'Out of Stock Report'
  | 'Dead Stock Report'
  | 'Slow Moving Stock Report'
  | 'Fast Moving Stock Report'
  | 'Variance Risk Report'
  | 'Supplier Stock Report'
  | 'Shelf / Location Report'
  | 'COA Inventory Report';

export type InventoryReportOutputMode = 'Preview' | 'Print' | 'PdfDownload' | 'ExportPlaceholder';

export type InventoryReportStatus = 'Ready' | 'Empty' | 'Error' | 'Generated' | 'Printed' | 'PdfPrepared';

export interface InventoryReportColumn {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
}

export interface InventoryReportDefinition {
  reportType: InventoryReportType;
  reportName: string;
  description: string;
  category: 'Stock Position' | 'Movement and Control' | 'Procurement' | 'Intelligence' | 'Master Data';
  requiredPermission: string;
  defaultColumns: InventoryReportColumn[];
  supportsPrint: boolean;
  supportsPdf: boolean;
  supportsCsvPlaceholder: boolean;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  sortOrder: number;
}

export interface InventoryReportFilters {
  vendorId?: string;
  search?: string;
  sku?: string;
  branch?: string;
  branchId?: string;
  branchName?: string;
  warehouse?: string;
  warehouseId?: string;
  warehouseName?: string;
  locationType?: 'ALL' | StockLocationType;
  industrialSector?: string;
  category?: string;
  brand?: string;
  supplier?: string;
  shelfLocation?: string;
  stockHealthStatus?: 'ALL' | StockHealthStatus;
  severity?: 'ALL' | StockHealthSeverity;
  movementType?: 'ALL' | InventoryMovementType;
  dateFrom?: string;
  dateTo?: string;
  reportType?: InventoryReportType;
  supplierName?: string;
  productStatus?: string;
  stockStatus?: string;
  riskStatus?: string;
  searchQuery?: string;
  includeZeroStock?: boolean;
  includeInactive?: boolean;
  staffId?: string;
  approvalStatus?: string;
}

export type InventoryReportFilterState = InventoryReportFilters;

export interface InventoryReportRow {
  rowId: string;
  values: Record<string, string | number | boolean | null | undefined>;
}

export interface InventoryReportSummaryMetric {
  label: string;
  value: string | number;
}

export interface InventoryReportPayload {
  reportId: string;
  reportType: InventoryReportType;
  reportName: string;
  vendorName: string;
  branchName: string;
  warehouseName: string;
  generatedAt: string;
  generatedBy: string;
  filters: InventoryReportFilterState;
  summaryMetrics: InventoryReportSummaryMetric[];
  columns: InventoryReportColumn[];
  rows: InventoryReportRow[];
  notes: string;
  status: InventoryReportStatus;
}

export interface InventoryReportPrintOptions {
  outputMode: InventoryReportOutputMode;
  includeFilters: boolean;
  includeSummary: boolean;
  pageSize?: 'A4' | 'Letter';
  orientation?: 'Portrait' | 'Landscape';
}

export interface InventoryReportSummary {
  totalStockValue: number;
  lowStockItems: number;
  outOfStockItems: number;
  deadStockItems: number;
  slowMovingItems: number;
  fastMovingItems: number;
  overstockedItems: number;
  varianceRiskItems: number;
  damagedHoldingQty: number;
  returnHoldingQty: number;
  inTransitQty: number;
  reorderRecommendations: number;
}

export interface StockHealthRecommendation {
  recommendationId: string;
  recommendationType: InventoryRecommendationType;
  severity: StockHealthSeverity;
  productId?: string;
  sku?: string;
  productName?: string;
  branchId?: string;
  warehouseId?: string;
  title: string;
  description: string;
  recommendedAction: string;
  relatedReportType: InventoryReportType;
  status: 'Open' | 'Reviewed' | 'Dismissed' | 'Converted Placeholder';
  createdAt: string;
}

export interface InventoryValueReportRow {
  sku: string;
  productName: string;
  branch: string;
  warehouse: string;
  location: string;
  qtyOnHand: number;
  availableQty: number;
  unitCost: number;
  estimatedStockValue: number;
  damagedValue: number;
  returnHoldingValue: number;
  inTransitValue: number;
  lastCost: number;
  status: StockHealthStatus;
}

export interface StockMovementAuditRow {
  movementId: string;
  dateTime: string;
  sku: string;
  productName: string;
  movementType: InventoryMovementType;
  reference: string;
  branch: string;
  warehouse: string;
  qtyIn: number;
  qtyOut: number;
  balanceBefore: number;
  balanceAfter: number;
  staff: string;
  risk: string;
  notes: string;
}

export interface SupplierPerformanceRow {
  supplier: string;
  productsSupplied: number;
  purchaseOrders: number;
  grns: number;
  supplierReturns: number;
  averageDeliveryDays: number;
  lateDeliveries: number;
  damagedWrongItems: number;
  creditNotesPending: number;
  performanceScore: number;
  risk: StockHealthSeverity;
}

export interface TransferDelayRow {
  transferNo: string;
  source: string;
  destination: string;
  dispatchedDate: string;
  expectedArrival: string;
  receivedDate?: string;
  daysInTransit: number;
  status: string;
  variance: string;
}

export interface GRNDelayRow {
  grnNo: string;
  poNo: string;
  supplier: string;
  expectedDelivery: string;
  receivedDate?: string;
  daysLate: number;
  status: string;
  variance: string;
  invoiceStatus: string;
}

export interface ReorderRecommendationRow {
  sku: string;
  productName: string;
  branch: string;
  warehouse: string;
  availableQty: number;
  reorderLevel: number;
  reorderQty: number;
  preferredSupplier: string;
  salesVelocity: number;
  daysCover: number;
  recommendation: string;
  priority: StockHealthSeverity;
}

export interface InventoryReportActivityEvent {
  id: string;
  eventType:
    | 'INVENTORY_REPORT_SELECTED'
    | 'INVENTORY_REPORT_GENERATED'
    | 'INVENTORY_REPORT_FILTERED'
    | 'INVENTORY_REPORT_PRINT_PREPARED'
    | 'INVENTORY_REPORT_PRINTED_PLACEHOLDER'
    | 'INVENTORY_REPORT_PDF_PREPARED'
    | 'INVENTORY_REPORT_CSV_EXPORTED_PLACEHOLDER'
    | 'INVENTORY_REPORT_PERMISSION_RESTRICTED'
    | string;
  reportType?: InventoryReportType;
  message: string;
  staffId?: string;
  notes?: string;
  createdAt: string;
}

export interface StockValuationRow {
  numericNo: string;
  sku: string;
  productName: string;
  sector: string;
  brand: string;
  supplier: string;
  branch: string;
  warehouse: string;
  qtyOnHand: number;
  unitCost: number;
  sellingPrice: number;
  totalCostValue: number;
  totalSellingValue: number;
  marginValue: number;
  marginPct: number;
  assetAccountCOA: string;
  salesAccountCOA: string;
}

export interface MovementSummaryRow {
  productId: string;
  product: string;
  openingBalance: number;
  qtyIn: number;
  qtyOut: number;
  transferIn: number;
  transferOut: number;
  returnsIn: number;
  supplierReturnsOut: number;
  adjustmentsIn: number;
  adjustmentsOut: number;
  closingBalance: number;
  netMovement: number;
  risk: string;
}

export interface MovementSummaryReportTotals {
  totalQtyIn: number;
  totalQtyOut: number;
  netMovement: number;
  highRiskMovements: number;
  reversalCount: number;
  pendingApprovalMovements: number;
}

export interface ShelfLocationReportRow {
  shelfLocation: string;
  productsCount: number;
  totalUnits: number;
  totalCostValue: number;
  lowStockItems: number;
  outOfStockItems: number;
  varianceRiskItems: number;
  lastStocktakeDate: string;
  recommendedAction: RecommendedStockAction;
}

export interface COAInventoryReportRow {
  coaAccount: string;
  accountType: 'Asset' | 'Sales';
  productsCount: number;
  totalUnits: number;
  totalCostValue: number;
  totalSellingValue: number;
  movementCount: number;
  lastMovementDate: string;
}

export interface SupplierStockReportRow {
  supplier: string;
  productsCount: number;
  totalUnits: number;
  stockValueAtCost: number;
  lowStockItems: number;
  deadStockItems: number;
  lastReceivedDate: string;
  supplierReturnCount: number;
  recommendedAction: RecommendedStockAction;
}

export interface WarehouseSetting {
  id: string;
  name: string;
  branchId: string;
  vendorId?: string;
  warehouseCode?: string;
  warehouseType?: 'Main Warehouse' | 'Retail Stock' | 'Reserve Stock' | 'Returns Holding' | 'Damaged Stock' | 'Consignment Stock' | 'Transit Stock' | string;
  shelfLocationPrefix?: string;
  cityTown?: string;
  district?: string;
  suburb?: string;
  physicalAddress?: string;
  responsibleStaff?: string;
  status?: string;
  notes?: string;
  createdByStaffId?: string;
  createdAt?: string;
  updatedAt?: string;
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
  | 'SALES_HISTORY'
  | 'CUSTOMER_CENTRE'
  | 'DELIVERY'
  | 'STOCK'
  | 'TASK_DESK'
  | 'APPROVALS'
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
  | 'Stocktake Variance Approval'
  | 'Purchase Order Approval'
  | 'Goods Receiving Approval';

export type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected';

export type OperationalApprovalCategory =
  | 'NEW_CUSTOMER'
  | 'Price Override'
  | 'Discount Above Limit'
  | 'Return Request'
  | 'Credit Note Request'
  | 'Terminal Activation'
  | 'Cash Variance Review'
  | 'Stock Adjustment'
  | 'Stocktake Variance'
  | 'Stock Transfer'
  | 'Inventory Import Approval'
  | 'Purchase Order'
  | 'Goods Receiving'
  | 'Supplier Return'
  | 'Delivery Provider Approval'
  | 'Customer Approval';

export type OperationalApprovalDecision = 'Approved' | 'Rejected';

export interface OperationalApprovalRequest {
  id: string;
  vendorId: string;
  branchId: string;
  branch: string;
  category: OperationalApprovalCategory;
  requestedBy: string;
  requestedByRole: Role;
  relatedRecord: string;
  amountOrValue: string;
  risk: RiskLevel;
  status: ApprovalStatus;
  requestedAt: string;
  reason: string;
  context: string;
  requiredPermission: 'approvals.approve' | 'approvals.reject';
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  decisionNote?: string;
}

export interface OperationalApprovalEvent {
  id: string;
  approvalId: string;
  eventType: 'APPROVAL_CREATED' | 'APPROVAL_VIEWED' | 'APPROVAL_APPROVED' | 'APPROVAL_REJECTED';
  operator: string;
  message: string;
  createdAt: string;
}

export type CustomerStatus =
  | 'Pending Approval'
  | 'Active'
  | 'Rejected'
  | 'Duplicate'
  | 'Suspended'
  | 'Inactive';

export type CustomerType =
  | 'Walk-in'
  | 'Individual'
  | 'Business'
  | 'Government'
  | 'School'
  | 'Fleet Customer'
  | 'Dealer'
  | 'Internal Account';

export type CustomerCreditStatus =
  | 'Cash Only'
  | 'Credit Allowed'
  | 'Credit Suspended'
  | 'Credit Review Required'
  | 'Not Applicable';

export type CustomerSource =
  | 'Walk-in'
  | 'WhatsApp Catalogue'
  | 'Commerce Access Hub'
  | 'Referral'
  | 'Phone Call'
  | 'Facebook'
  | 'Sales Terminal'
  | 'Imported'
  | 'Other';

export interface CustomerAddress {
  id: string;
  customerId: string;
  type: 'Billing' | 'Delivery';
  addressLine: string;
  cityTown: string;
  district: string;
  suburb: string;
}

export interface CustomerContact {
  id: string;
  customerId: string;
  name: string;
  role?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
}

export interface CustomerRecord {
  customerId: string;
  vendorId: string;
  customerCode: string;
  customerName: string;
  customerType: CustomerType;
  phone: string;
  whatsapp: string;
  email: string;
  taxNumber: string;
  billingAddress: string;
  deliveryAddress: string;
  cityTown: string;
  district: string;
  suburb: string;
  source: CustomerSource;
  status: CustomerStatus;
  creditStatus: CustomerCreditStatus;
  creditLimit?: number;
  currentBalance?: number;
  notes: string;
  createdByStaffId: string;
  approvedByStaffId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerApprovalRequest {
  requestId: string;
  customerId: string;
  vendorId: string;
  customerName: string;
  phone: string;
  whatsapp: string;
  source: CustomerSource;
  requestedBy: string;
  requestedAt: string;
  duplicateRisk: 'Low' | 'Medium' | 'High';
  status: CustomerStatus;
}

export interface CustomerPurchaseHistoryRow {
  id: string;
  customerId: string;
  receiptNo: string;
  date: string;
  branch: string;
  cashier: string;
  items: number;
  total: number;
  paymentMethod: string;
  deliveryStatus: string;
  returnStatus: string;
}

export interface CustomerNote {
  id: string;
  customerId: string;
  dateTime: string;
  note: string;
  addedBy: string;
  role: Role;
  relatedRecord?: string;
}

export interface CustomerActivityEvent {
  id: string;
  customerId: string;
  dateTime: string;
  eventType:
    | 'CUSTOMER_CREATED_PENDING'
    | 'CUSTOMER_CREATED'
    | 'CUSTOMER_UPDATED'
    | 'CUSTOMER_APPROVED'
    | 'CUSTOMER_REJECTED'
    | 'CUSTOMER_DUPLICATE_FLAGGED'
    | 'CUSTOMER_SUSPENDED'
    | 'CUSTOMER_REACTIVATED'
    | 'CUSTOMER_SELECTED_FOR_SALE'
    | 'CUSTOMER_NOTE_ADDED'
    | 'CUSTOMER_PURCHASE_RECORDED'
    | 'CUSTOMER_SERVICE_RISK'
    | 'CUSTOMER_CREDIT_REVIEW_REQUIRED';
  user: string;
  notes: string;
}

export interface CustomerFilterState {
  search?: string;
  customerType?: CustomerType | 'All';
  status?: CustomerStatus | 'All';
  creditStatus?: CustomerCreditStatus | 'All';
  source?: CustomerSource | 'All';
  cityTown?: string;
  district?: string;
  suburb?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface CustomerSummary {
  totalCustomers: number;
  activeCustomers: number;
  pendingApproval: number;
  duplicateReview: number;
  suspended: number;
  whatsAppLeads: number;
  repeatCustomers: number;
  creditReview: number;
}

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

export type PurchaseOrderStatus =
  | 'Draft'
  | 'Pending Approval'
  | 'Approved'
  | 'Sent To Supplier'
  | 'Partially Received'
  | 'Fully Received'
  | 'Cancelled'
  | 'Closed'
  | 'Closed With Outstanding';

export type PurchaseOrderPriority = 'Low' | 'Normal' | 'High' | 'Urgent';

export type PurchaseOrderSource =
  | 'Manual'
  | 'Low Stock Recommendation'
  | 'Stock Health Recommendation'
  | 'Supplier Reorder'
  | 'Import Draft'
  | 'Owner Request';

export type PurchaseOrderLineStatus =
  | 'Draft'
  | 'Ordered'
  | 'Partially Received'
  | 'Fully Received'
  | 'Cancelled';

export interface PurchaseOrderSupplierDetails {
  supplierId: string;
  supplierName: string;
  supplierPhone: string;
  supplierEmail: string;
  supplierAddress: string;
  supplierContactPerson: string;
}

export interface PurchaseOrderDeliveryDetails {
  deliveryBranchId: string;
  deliveryWarehouseId: string;
  deliveryAddress: string;
  deliveryNotes?: string;
}

export interface PurchaseOrderApprovalDetails {
  requestedByStaffId: string;
  requestedByStaffName: string;
  approvedByStaffId?: string;
  approvedByStaffName?: string;
  approvedAt?: string;
  approvalNotes?: string;
}

export interface PurchaseOrder {
  poId: string;
  poNumber: string;
  vendorId: string;
  branchId: string;
  warehouseId: string;
  supplierId: string;
  supplierName: string;
  supplierPhone: string;
  supplierEmail: string;
  supplierAddress: string;
  supplierContactPerson: string;
  requestedByStaffId: string;
  requestedByStaffName: string;
  approvedByStaffId?: string;
  approvedByStaffName?: string;
  poDate: string;
  expectedDeliveryDate: string;
  priority: PurchaseOrderPriority;
  source: PurchaseOrderSource;
  status: PurchaseOrderStatus;
  deliveryBranchId: string;
  deliveryWarehouseId: string;
  deliveryAddress: string;
  currency: string;
  subtotalEstimate: number;
  taxEstimate: number;
  deliveryCostEstimate: number;
  grandTotalEstimate: number;
  notes: string;
  internalMemo: string;
  termsAndConditions: string;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrderLine {
  lineId: string;
  poId: string;
  productId: string;
  sku: string;
  productName: string;
  brand: string;
  manufacturer: string;
  supplierItemCode?: string;
  unitOfMeasure: string;
  qtyOrdered: number;
  qtyReceived: number;
  qtyOutstanding: number;
  estimatedUnitCost: number;
  estimatedLineTotal: number;
  lastCostPrice?: number;
  currentSellingPrice?: number;
  shelfLocation?: string;
  lineStatus: PurchaseOrderLineStatus;
  notes: string;
}

export type PurchaseOrderActivityEventType =
  | 'PURCHASE_ORDER_DRAFT_CREATED'
  | 'PURCHASE_ORDER_UPDATED'
  | 'PURCHASE_ORDER_SUBMITTED_FOR_APPROVAL'
  | 'PURCHASE_ORDER_APPROVED'
  | 'PURCHASE_ORDER_SENT_TO_SUPPLIER'
  | 'PURCHASE_ORDER_EXPORT_PREPARED'
  | 'PURCHASE_ORDER_CANCELLED'
  | 'PURCHASE_ORDER_RECEIVING_DRAFT_CREATED'
  | 'PURCHASE_ORDER_CLOSED'
  | 'PURCHASE_ORDER_PARTIALLY_RECEIVED'
  | 'PURCHASE_ORDER_FULLY_RECEIVED'
  | 'PURCHASE_ORDER_CLOSED_WITH_OUTSTANDING'
  | 'PURCHASE_ORDER_LEFT_OPEN_FOR_FULFILLMENT';

export interface PurchaseOrderActivityEvent {
  id: string;
  poId: string;
  poNumber: string;
  eventType: PurchaseOrderActivityEventType;
  message: string;
  operator: string;
  createdAt: string;
}

export interface PurchaseOrderFilterState {
  poNumber?: string;
  supplier?: string;
  branch?: string;
  warehouse?: string;
  status?: PurchaseOrderStatus | 'ALL';
  priority?: PurchaseOrderPriority | 'ALL';
  source?: PurchaseOrderSource | 'ALL';
  dateFrom?: string;
  dateTo?: string;
  expectedDeliveryFrom?: string;
  expectedDeliveryTo?: string;
}

export interface PurchaseOrderSummary {
  totalPOs: number;
  draftPOs: number;
  pendingApproval: number;
  approved: number;
  sentToSupplier: number;
  partiallyReceived: number;
  fullyReceived: number;
  cancelled: number;
  estimatedPOValue: number;
  outstandingQty: number;
}

export type GoodsReceivingStatus =
  | 'Draft'
  | 'Pending Approval'
  | 'Posted'
  | 'Partially Posted'
  | 'Cancelled'
  | 'Rejected'
  | 'Reversed';

export type GoodsReceivingLineStatus =
  | 'Pending'
  | 'Received'
  | 'Partially Received'
  | 'Not Supplied'
  | 'Removed From GRN'
  | 'Over Received'
  | 'Variance Review'
  | 'Cancelled';

export type ReceivingVarianceType =
  | 'None'
  | 'Short'
  | 'Over'
  | 'Cost Increase'
  | 'Cost Decrease'
  | 'Unordered Item'
  | 'Damaged'
  | 'Wrong Product'
  | 'Missing Supplier Invoice';

export type POFulfillmentStatus =
  | 'Not Received'
  | 'Partially Received'
  | 'Fully Received'
  | 'Closed With Outstanding'
  | 'Cancelled';

export interface GoodsReceivingNote {
  grnId: string;
  grnNumber: string;
  vendorId: string;
  poId?: string;
  poNumber?: string;
  branchId: string;
  warehouseId: string;
  supplierId: string;
  supplierName: string;
  receivedByStaffId: string;
  receivedByStaffName: string;
  receivedDate: string;
  supplierInvoiceNumber: string;
  supplierInvoiceDate: string;
  supplierInvoiceAmount: number;
  deliveryNoteNumber: string;
  vehicleOrCourierReference?: string;
  receivingStatus: GoodsReceivingStatus;
  approvalRequired: boolean;
  approvedByStaffId?: string;
  approvedByStaffName?: string;
  postedAt?: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface GoodsReceivingLine {
  lineId: string;
  grnId: string;
  poId?: string;
  poLineId?: string;
  productId: string;
  sku: string;
  productName: string;
  brand: string;
  manufacturer: string;
  unitOfMeasure: string;
  qtyOrdered: number;
  qtyPreviouslyReceived: number;
  qtyOutstandingBeforeGRN: number;
  qtyReceivedNow: number;
  qtyAccepted: number;
  qtyRejected: number;
  qtyOutstandingAfterGRN: number;
  previousCostPrice: number;
  receivedUnitCost: number;
  sellingPrice: number;
  shelfLocation: string;
  varianceType: ReceivingVarianceType;
  lineStatus: GoodsReceivingLineStatus;
  removeFromCurrentGRN: boolean;
  markUnavailableFromSupplier: boolean;
  damagedReason?: string;
  notes: string;
}

export interface GoodsReceivingSupplierInvoice {
  grnId: string;
  supplierInvoiceNumber: string;
  supplierInvoiceDate: string;
  supplierInvoiceAmount: number;
  capturedForAccountingReview: boolean;
}

export interface GoodsReceivingVariance {
  varianceId: string;
  grnId: string;
  lineId?: string;
  varianceType: ReceivingVarianceType;
  severity: RiskLevel;
  message: string;
  approvalRequired: boolean;
  resolved: boolean;
}

export interface GoodsReceivingPostingResult {
  grnId: string;
  grnNumber: string;
  status: GoodsReceivingStatus;
  stockPosted: boolean;
  approvalRequired: boolean;
  postedLines: GoodsReceivingLine[];
  skippedLines: GoodsReceivingLine[];
  message: string;
}

export type GoodsReceivingActivityEventType =
  | 'GRN_DRAFT_CREATED_FROM_PO'
  | 'GRN_DRAFT_UPDATED'
  | 'GRN_LINE_UPDATED'
  | 'GRN_LINE_REMOVED_FROM_CURRENT_RECEIVING'
  | 'GRN_LINE_MARKED_NOT_SUPPLIED'
  | 'GRN_SUBMITTED_FOR_APPROVAL'
  | 'GRN_APPROVED'
  | 'GRN_POSTED_TO_STOCK'
  | 'GOODS_RECEIVED_POSTED'
  | 'GRN_CANCELLED'
  | 'GRN_REVERSED_PLACEHOLDER'
  | 'PURCHASE_ORDER_PARTIALLY_RECEIVED'
  | 'PURCHASE_ORDER_FULLY_RECEIVED'
  | 'PURCHASE_ORDER_CLOSED_WITH_OUTSTANDING'
  | 'PURCHASE_ORDER_LEFT_OPEN_FOR_FULFILLMENT'
  | 'GRN_SHORT_RECEIPT'
  | 'GRN_OVER_RECEIPT'
  | 'GRN_COST_INCREASE_REVIEW_REQUIRED'
  | 'GRN_DAMAGED_GOODS_RECORDED'
  | 'GRN_SUPPLIER_INVOICE_MISSING'
  | 'GRN_UNORDERED_ITEM_REVIEW_REQUIRED';

export interface GoodsReceivingActivityEvent {
  id: string;
  grnId?: string;
  grnNumber?: string;
  poId?: string;
  poNumber?: string;
  eventType: GoodsReceivingActivityEventType;
  message: string;
  operator: string;
  createdAt: string;
}

export interface GoodsReceivingFilterState {
  grnNumber?: string;
  poNumber?: string;
  supplier?: string;
  branch?: string;
  warehouse?: string;
  status?: GoodsReceivingStatus | 'ALL';
  dateFrom?: string;
  dateTo?: string;
  varianceType?: ReceivingVarianceType | 'ALL';
  receivedBy?: string;
}

export interface POReceivingLineState {
  poLineId: string;
  productId: string;
  sku: string;
  productName: string;
  qtyOrdered: number;
  qtyPostedReceived: number;
  qtyOutstanding: number;
  fulfillmentStatus: POFulfillmentStatus;
}

export interface POReceivingSummary {
  poId: string;
  poNumber: string;
  supplierName: string;
  fulfillmentStatus: POFulfillmentStatus;
  totalOrderedQty: number;
  totalPostedReceivedQty: number;
  totalOutstandingQty: number;
  postedGRNCount: number;
  draftGRNCount: number;
  lineStates: POReceivingLineState[];
}

export interface POCloseRequest {
  poId: string;
  staffId: string;
  reason: string;
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

export type SupplierReturnStatus =
  | 'Draft'
  | 'Pending Approval'
  | 'Approved'
  | 'Posted'
  | 'Dispatched To Supplier'
  | 'Supplier Accepted'
  | 'Supplier Rejected'
  | 'Credit Note Pending'
  | 'Credit Note Received'
  | 'Replacement Pending'
  | 'Replacement Received'
  | 'Cancelled'
  | 'Closed';

export type SupplierReturnReason =
  | 'Damaged'
  | 'Wrong Product'
  | 'Over Supplied'
  | 'Quality Issue'
  | 'Expired'
  | 'Supplier Recall'
  | 'Duplicate Supply'
  | 'Price Dispute'
  | 'Not Ordered'
  | 'Other';

export type SupplierReturnResolution =
  | 'Credit Note Expected'
  | 'Replacement Expected'
  | 'Supplier Refund Expected'
  | 'No Credit'
  | 'Internal Write Off Review'
  | 'Pending Supplier Decision';

export type SupplierReturnLineStatus =
  | 'Draft'
  | 'Pending'
  | 'Approved'
  | 'Posted'
  | 'Dispatched'
  | 'Accepted By Supplier'
  | 'Rejected By Supplier'
  | 'Closed';

export interface SupplierReturn {
  supplierReturnId: string;
  supplierReturnNumber: string;
  vendorId: string;
  branchId: string;
  warehouseId: string;
  supplierId: string;
  supplierName: string;
  poId?: string;
  poNumber?: string;
  grnId?: string;
  grnNumber?: string;
  requestedByStaffId: string;
  requestedByStaffName: string;
  approvedByStaffId?: string;
  approvedByStaffName?: string;
  returnDate: string;
  status: SupplierReturnStatus;
  reason: SupplierReturnReason;
  resolution: SupplierReturnResolution;
  supplierContactPerson: string;
  supplierPhone: string;
  supplierEmail: string;
  dispatchMethod: string;
  courierReference?: string;
  supplierCreditNoteNumber?: string;
  supplierCreditNoteAmount?: number;
  replacementExpected: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
  id?: string;
  originalGrn?: string;
  sku?: string;
  productName?: string;
  quantityReturned?: number;
  condition?: string;
  createdDate?: string;
  requestedBy?: string;
}

export interface SupplierReturnLine {
  lineId: string;
  supplierReturnId: string;
  productId: string;
  sku: string;
  productName: string;
  brand: string;
  manufacturer: string;
  grnLineId?: string;
  poLineId?: string;
  qtyReceived: number;
  qtyAcceptedIntoStock: number;
  qtyAlreadyReturned: number;
  qtyReturnRequested: number;
  qtyReturnApproved: number;
  qtyPostedOut: number;
  unitCost: number;
  lineTotal: number;
  shelfLocation: string;
  returnReason: SupplierReturnReason;
  resolution: SupplierReturnResolution;
  lineStatus: SupplierReturnLineStatus;
  stockWasPosted: boolean;
  notes: string;
}

export interface SupplierReturnCreditNotePlaceholder {
  creditNoteId: string;
  supplierReturnId: string;
  supplierReturnNumber: string;
  supplierCreditNoteNumber: string;
  supplierCreditNoteAmount: number;
  receivedDate: string;
  status: 'Pending Accounting Review' | 'Captured' | 'Cancelled';
  notes: string;
  createdAt: string;
}

export interface SupplierReturnDispatchDetails {
  dispatchMethod: string;
  courierReference?: string;
  dispatchNotes?: string;
  dispatchedAt?: string;
  dispatchedByStaffId?: string;
  dispatchedByStaffName?: string;
}

export type SupplierReturnActivityEventType =
  | 'SUPPLIER_RETURN_DRAFT_CREATED'
  | 'SUPPLIER_RETURN_UPDATED'
  | 'SUPPLIER_RETURN_SUBMITTED_FOR_APPROVAL'
  | 'SUPPLIER_RETURN_APPROVED'
  | 'SUPPLIER_RETURN_POSTED'
  | 'SUPPLIER_RETURN_POSTED_TO_STOCK'
  | 'SUPPLIER_REJECTION_RECORDED_NO_STOCK_IMPACT'
  | 'SUPPLIER_RETURN_DISPATCHED'
  | 'SUPPLIER_CREDIT_NOTE_RECORDED'
  | 'SUPPLIER_REPLACEMENT_EXPECTED'
  | 'SUPPLIER_RETURN_CLOSED'
  | 'SUPPLIER_RETURN_CANCELLED';

export interface SupplierReturnActivityEvent {
  id: string;
  supplierReturnId: string;
  supplierReturnNumber: string;
  grnId?: string;
  grnNumber?: string;
  poId?: string;
  poNumber?: string;
  eventType: SupplierReturnActivityEventType;
  message: string;
  operator: string;
  createdAt: string;
}

export interface SupplierReturnFilterState {
  supplierReturnNumber?: string;
  supplier?: string;
  poNumber?: string;
  grnNumber?: string;
  branch?: string;
  warehouse?: string;
  status?: SupplierReturnStatus | 'ALL';
  reason?: SupplierReturnReason | 'ALL';
  resolution?: SupplierReturnResolution | 'ALL';
  dateFrom?: string;
  dateTo?: string;
}

export interface SupplierReturnSummary {
  draftReturns: number;
  pendingApproval: number;
  postedReturns: number;
  dispatched: number;
  creditNotesPending: number;
  replacementsPending: number;
  supplierRejected: number;
  closedReturns: number;
  returnQty: number;
  returnValueEstimate: number;
}

export type StockAdjustmentStatus =
  | 'Draft'
  | 'Pending Approval'
  | 'Approved'
  | 'Posted'
  | 'Rejected'
  | 'Cancelled'
  | 'Reversed';

export type StockAdjustmentReason =
  | 'Opening Balance'
  | 'Physical Count Correction'
  | 'Damaged Stock'
  | 'Expired Stock'
  | 'Theft / Loss'
  | 'Internal Use'
  | 'Data Correction'
  | 'Supplier Correction'
  | 'Customer Return Correction'
  | 'Branch Transfer Correction'
  | 'Write Off'
  | 'Other';

export type StockAdjustmentDirection =
  | 'Increase'
  | 'Decrease'
  | 'Set Quantity';

export type StockAdjustmentRiskLevel =
  | 'Low'
  | 'Medium'
  | 'High'
  | 'Critical';

export interface StockAdjustment {
  adjustmentId: string;
  adjustmentNumber: string;
  vendorId: string;
  branchId: string;
  warehouseId: string;
  requestedByStaffId: string;
  requestedByStaffName: string;
  approvedByStaffId?: string;
  approvedByStaffName?: string;
  postedByStaffId?: string;
  postedByStaffName?: string;
  adjustmentDate: string;
  status: StockAdjustmentStatus;
  reason: StockAdjustmentReason;
  riskLevel: StockAdjustmentRiskLevel;
  approvalRequired: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface StockAdjustmentLine {
  lineId: string;
  adjustmentId: string;
  productId: string;
  sku: string;
  productName: string;
  brand: string;
  shelfLocation: string;
  currentQty: number;
  adjustmentDirection: StockAdjustmentDirection;
  adjustmentQty: number;
  newQty: number;
  unitCost: number;
  valueImpact: number;
  reason: StockAdjustmentReason;
  riskLevel: StockAdjustmentRiskLevel;
  notes: string;
}

export type StockAdjustmentActivityEventType =
  | 'STOCK_ADJUSTMENT_DRAFT_CREATED'
  | 'STOCK_ADJUSTMENT_DRAFT_UPDATED'
  | 'STOCK_ADJUSTMENT_LINE_UPDATED'
  | 'STOCK_ADJUSTMENT_SUBMITTED_FOR_APPROVAL'
  | 'STOCK_ADJUSTMENT_APPROVED'
  | 'STOCK_ADJUSTMENT_REJECTED'
  | 'STOCK_ADJUSTMENT_POSTED'
  | 'STOCK_ADJUSTMENT_CANCELLED'
  | 'STOCK_ADJUSTMENT_REVERSE_REQUESTED'
  | 'STOCK_ADJUSTMENT_REVERSAL_PLACEHOLDER_PREPARED'
  | 'STOCK_ADJUSTMENT_EXPORT_PREPARED'
  | 'STOCK_ADJUSTMENT_DUPLICATED_PLACEHOLDER'
  | 'STOCK_ADJUSTMENT_HIGH_RISK'
  | 'STOCK_ADJUSTMENT_NEGATIVE_STOCK_BLOCKED';

export interface StockAdjustmentActivityEvent {
  id: string;
  adjustmentId: string;
  adjustmentNumber: string;
  eventType: StockAdjustmentActivityEventType;
  message: string;
  operator: string;
  createdAt: string;
}

export interface StockAdjustmentFilterState {
  adjustmentNumber?: string;
  product?: string;
  sku?: string;
  branch?: string;
  warehouse?: string;
  status?: StockAdjustmentStatus | 'ALL';
  reason?: StockAdjustmentReason | 'ALL';
  riskLevel?: StockAdjustmentRiskLevel | 'ALL';
  requestedBy?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface StockAdjustmentSummary {
  draftAdjustments: number;
  pendingApproval: number;
  approved: number;
  postedToday: number;
  highRisk: number;
  critical: number;
  positiveAdjustments: number;
  negativeAdjustments: number;
  writeOffValue: number;
  awaitingOwnerReview: number;
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

export type StocktakeSessionStatus =
  | 'Draft'
  | 'Counting'
  | 'Count Completed'
  | 'Submitted'
  | 'Pending Approval'
  | 'Approved'
  | 'Posted'
  | 'Recount Requested'
  | 'Cancelled'
  | 'Closed';

export type StocktakeScope =
  | 'Full Inventory'
  | 'Branch'
  | 'Warehouse'
  | 'Category'
  | 'Supplier'
  | 'Shelf Location'
  | 'Selected Products'
  | 'High Risk Products'
  | 'Low Stock Products'
  | 'No Movement Products';

export type StocktakeCountMode =
  | 'Visible System Qty'
  | 'Blind Count'
  | 'Supervisor Count'
  | 'Recount';

export type StocktakeLineStatus =
  | 'Not Counted'
  | 'Counted'
  | 'Variance'
  | 'No Variance'
  | 'Recount Required'
  | 'Approved'
  | 'Posted'
  | 'Excluded'
  | 'Cancelled';

export type StocktakeVarianceRisk =
  | 'None'
  | 'Low'
  | 'Medium'
  | 'High'
  | 'Critical';

export interface StocktakeLine {
  lineId: string;
  stocktakeId: string;
  productId: string;
  sku: string;
  productName: string;
  brand: string;
  category: string;
  shelfLocation: string;
  systemQty: number;
  countedQty: number | null;
  varianceQty: number;
  unitCost: number;
  valueImpact: number;
  varianceRisk: StocktakeVarianceRisk;
  lineStatus: StocktakeLineStatus;
  countNotes: string;
  recountNotes: string;
  postedMovementId?: string;
  numericNo?: string;
  alu?: string;
  industrialSector?: string;
  variance?: number;
  riskLevel?: 'Low' | 'Medium' | 'High' | 'Critical';
  status?: 'Pending' | 'Counted' | 'Risk Flagged' | 'Matched' | 'Short Count' | 'Over Count' | 'Review Required';
  stocktakeType?: 'Full' | 'Spot' | 'Audit';
  countedBy?: string;
}

export interface StocktakeSession {
  stocktakeId: string;
  stocktakeNumber: string;
  vendorId: string;
  branchId: string;
  warehouseId?: string;
  scope: StocktakeScope;
  countMode: StocktakeCountMode;
  status: StocktakeSessionStatus;
  requestedByStaffId: string;
  requestedByStaffName: string;
  countedByStaffId?: string;
  countedByStaffName?: string;
  approvedByStaffId?: string;
  approvedByStaffName?: string;
  postedByStaffId?: string;
  postedByStaffName?: string;
  startedAt: string;
  submittedAt?: string;
  approvedAt?: string;
  postedAt?: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  categoryFilter?: string;
  supplierFilter?: string;
  shelfLocationFilter?: string;
  selectedProductIds?: string[];
  id?: string;
  startDate?: string;
  type?: 'Spot Check' | 'Full Stocktake' | 'Full' | 'Spot' | 'Audit';
  items?: StocktakeLine[];
}

export interface StocktakeVarianceSummary {
  totalLines: number;
  countedLines: number;
  notCounted: number;
  excludedLines?: number;
  noVariance: number;
  varianceLines?: number;
  positiveVarianceLines: number;
  negativeVarianceLines: number;
  totalGainQty: number;
  totalLossQty: number;
  estimatedValueImpact: number;
  highestRisk: StocktakeVarianceRisk;
  approvalRequired?: boolean;
}

export type StocktakeActivityEventType =
  | 'STOCKTAKE_SESSION_CREATED'
  | 'STOCKTAKE_BULK_COUNT_APPLIED'
  | 'STOCKTAKE_COUNT_STARTED'
  | 'STOCKTAKE_LINE_CLEARED'
  | 'STOCKTAKE_LINE_COUNTED'
  | 'STOCKTAKE_SUBMITTED'
  | 'STOCKTAKE_RECOUNT_REQUESTED'
  | 'STOCKTAKE_RECOUNT_COMPLETED'
  | 'STOCKTAKE_LINE_EXCLUDED'
  | 'STOCKTAKE_LINE_RESTORED'
  | 'STOCKTAKE_VARIANCE_REVIEWED'
  | 'STOCKTAKE_SUBMIT_BLOCKED'
  | 'STOCKTAKE_VARIANCE_FOUND'
  | 'STOCKTAKE_APPROVED'
  | 'STOCKTAKE_VARIANCE_POSTED'
  | 'STOCKTAKE_GAIN_POSTED'
  | 'STOCKTAKE_LOSS_POSTED'
  | 'STOCKTAKE_POST_BLOCKED'
  | 'STOCKTAKE_POST_REVIEW_REQUIRED'
  | 'STOCKTAKE_POSTED_LOCKED'
  | 'STOCKTAKE_CANCELLED'
  | 'STOCKTAKE_HIGH_RISK_VARIANCE'
  | 'STOCKTAKE_STARTED'
  | 'STOCKTAKE_COUNT_LOGGED'
  | 'STOCK_ADJUSTMENT_REQUESTED'
  | 'AUDIT_STOCKTAKE_REVIEW_REQUIRED';

export interface StocktakeActivityEvent {
  id: string;
  stocktakeId: string;
  stocktakeNumber: string;
  eventType: StocktakeActivityEventType;
  message: string;
  operator: string;
  severity: StocktakeVarianceRisk;
  createdAt: string;
}

export interface StocktakeFilterState {
  stocktakeNumber?: string;
  branch?: string;
  warehouse?: string;
  scope?: StocktakeScope | 'ALL';
  countMode?: StocktakeCountMode | 'ALL';
  status?: StocktakeSessionStatus | 'ALL';
  requestedBy?: string;
  countedBy?: string;
  dateFrom?: string;
  dateTo?: string;
  varianceRisk?: StocktakeVarianceRisk | 'ALL';
}

export interface StocktakeSessionSummary {
  openSessions: number;
  counting: number;
  submitted: number;
  pendingApproval: number;
  recountRequired: number;
  postedToday: number;
  positiveVariance: number;
  negativeVariance: number;
  highRiskVariance: number;
  estimatedValueImpact: number;
}

export interface StocktakePostingResult {
  stocktakeId: string;
  stocktakeNumber: string;
  status: StocktakeSessionStatus;
  stockPosted: boolean;
  postedLines: StocktakeLine[];
  movements: InventoryMovement[];
  message: string;
}

export type StockTransferStatus =
  | 'Draft'
  | 'Pending Approval'
  | 'Approved'
  | 'Dispatched'
  | 'Partially Dispatched'
  | 'In Transit'
  | 'Partially Received'
  | 'Fully Received'
  | 'Variance Review'
  | 'Closed With Outstanding'
  | 'Cancelled'
  | 'Rejected'
  | 'Reversed';

export type StockTransferType =
  | 'Branch To Branch'
  | 'Warehouse To Warehouse'
  | 'Warehouse To Branch'
  | 'Branch To Warehouse'
  | 'Store To Sales Floor'
  | 'Sales Floor To Store'
  | 'Good Stock To Damaged Holding'
  | 'Good Stock To Return Holding'
  | 'Return Holding To Supplier Return Preparation'
  | 'Other';

export type StockTransferLineStatus =
  | 'Draft'
  | 'Requested'
  | 'Approved'
  | 'Dispatched'
  | 'Partially Dispatched'
  | 'In Transit'
  | 'Partially Received'
  | 'Fully Received'
  | 'Short Received'
  | 'Over Received'
  | 'Damaged In Transit'
  | 'Cancelled'
  | 'Closed Outstanding';

export type StockTransferVarianceType =
  | 'None'
  | 'Short Received'
  | 'Over Received'
  | 'Damaged In Transit'
  | 'Wrong Product'
  | 'Missing Line'
  | 'Unapproved Product'
  | 'Source Stock Short'
  | 'Destination Rejected';

export interface StockTransfer {
  transferId: string;
  transferNumber: string;
  vendorId: string;
  transferType: StockTransferType;
  sourceBranchId: string;
  sourceBranchName: string;
  sourceWarehouseId: string;
  sourceWarehouseName: string;
  destinationBranchId: string;
  destinationBranchName: string;
  destinationWarehouseId: string;
  destinationWarehouseName: string;
  requestedByStaffId: string;
  requestedByStaffName: string;
  approvedByStaffId?: string;
  approvedByStaffName?: string;
  dispatchedByStaffId?: string;
  dispatchedByStaffName?: string;
  receivedByStaffId?: string;
  receivedByStaffName?: string;
  transferDate: string;
  expectedArrivalDate: string;
  dispatchDate?: string;
  receivedDate?: string;
  status: StockTransferStatus;
  priority: 'Low' | 'Normal' | 'High' | 'Urgent';
  reason: string;
  transportMethod: string;
  courierReference?: string;
  driverName?: string;
  driverPhone?: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface StockTransferLine {
  lineId: string;
  transferId: string;
  productId: string;
  sku: string;
  productName: string;
  brand: string;
  category: string;
  sourceShelfLocation: string;
  destinationShelfLocation: string;
  qtyRequested: number;
  qtyApproved: number;
  qtyDispatched: number;
  qtyReceived: number;
  qtyAccepted: number;
  qtyRejected: number;
  qtyOutstanding: number;
  unitCost: number;
  valueImpact: number;
  lineStatus: StockTransferLineStatus;
  varianceType: StockTransferVarianceType;
  notes: string;
  dispatchPosted?: boolean;
  receiptPosted?: boolean;
  dispatchMovementId?: string;
  receiptMovementId?: string;
}

export interface StockTransferDispatch {
  dispatchId: string;
  transferId: string;
  dispatchedByStaffId: string;
  dispatchedByStaffName: string;
  dispatchDate: string;
  transportMethod: string;
  courierReference?: string;
  driverName?: string;
  driverPhone?: string;
  notes: string;
}

export interface StockTransferReceive {
  receiveId: string;
  transferId: string;
  receivedByStaffId: string;
  receivedByStaffName: string;
  receivedDate: string;
  notes: string;
}

export interface StockTransferVariance {
  varianceId: string;
  transferId: string;
  lineId: string;
  varianceType: StockTransferVarianceType;
  severity: StocktakeVarianceRisk;
  message: string;
  approvalRequired: boolean;
  resolved: boolean;
}

export type StockTransferActivityEventType =
  | 'STOCK_TRANSFER_DRAFT_CREATED'
  | 'STOCK_TRANSFER_SUBMITTED_FOR_APPROVAL'
  | 'STOCK_TRANSFER_APPROVED'
  | 'STOCK_TRANSFER_REJECTED'
  | 'STOCK_TRANSFER_DISPATCHED'
  | 'STOCK_TRANSFER_PARTIALLY_DISPATCHED'
  | 'STOCK_TRANSFER_IN_TRANSIT'
  | 'STOCK_TRANSFER_RECEIVED'
  | 'STOCK_TRANSFER_PARTIALLY_RECEIVED'
  | 'STOCK_TRANSFER_RECEIPT_POSTED'
  | 'STOCK_TRANSFER_VARIANCE_FOUND'
  | 'STOCK_TRANSFER_CLOSED_WITH_OUTSTANDING'
  | 'STOCK_TRANSFER_LEFT_OPEN'
  | 'STOCK_TRANSFER_CANCELLED'
  | 'STOCK_TRANSFER_SOURCE_STOCK_BLOCKED'
  | 'STOCK_TRANSFER_REVERSED_PLACEHOLDER'
  | 'STOCK_TRANSFER_EXPORTED';

export interface StockTransferActivityEvent {
  id: string;
  transferId: string;
  transferNumber: string;
  eventType: StockTransferActivityEventType;
  message: string;
  operator: string;
  severity: StocktakeVarianceRisk;
  createdAt: string;
}

export interface StockTransferFilterState {
  transferNumber?: string;
  transferType?: StockTransferType | 'ALL';
  sourceBranch?: string;
  sourceWarehouse?: string;
  destinationBranch?: string;
  destinationWarehouse?: string;
  status?: StockTransferStatus | 'ALL';
  productOrSku?: string;
  requestedBy?: string;
  dateFrom?: string;
  dateTo?: string;
  varianceType?: StockTransferVarianceType | 'ALL';
}

export interface StockTransferSummary {
  draftTransfers: number;
  pendingApproval: number;
  approved: number;
  inTransit: number;
  partiallyReceived: number;
  varianceReview: number;
  fullyReceived: number;
  closedOutstanding: number;
  transferQty: number;
  transferValue: number;
}

export interface StockTransferCloseRequest {
  transferId: string;
  staffId: string;
  reason: string;
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

export type DeliveryMethod =
  | 'No Delivery'
  | 'Customer Collection'
  | 'Vendor Delivery'
  | 'iDeliver Service'
  | 'External Delivery'
  | 'Courier Placeholder';

export type DeliveryStatus =
  | 'Not Required'
  | 'Draft'
  | 'Pending Assignment'
  | 'Broadcast To iDeliver'
  | 'Provider Selected'
  | 'Assigned'
  | 'Accepted By Driver'
  | 'Picked Up'
  | 'In Transit'
  | 'Arrived'
  | 'Delivered'
  | 'Delivery Failed'
  | 'Cancelled'
  | 'Returned To Vendor'
  | 'Cash Pending Review'
  | 'Closed'
  | 'Out for Delivery'
  | 'Completed'
  | 'Failed'
  | 'Waiting Collection';

export type VehicleType = 'Bike' | 'Car' | 'Kombi' | 'Lorry' | 'Walking Courier' | 'Other';
export type DeliveryCodeStatus = 'Not Generated' | 'Code Generated' | 'Code Sent' | 'Code Pending' | 'Code Confirmed' | DeliveryConfirmationStatus;
export type DeliveryFailureReason = 'Customer unavailable' | 'Wrong address' | 'Customer rejected delivery' | 'Delivery person failed to confirm code' | 'Vehicle breakdown' | 'Product issue' | 'Other' | '';

export type DeliveryPriority = 'Normal' | 'High' | 'Urgent';
export type DeliveryPaymentMode = 'Already Paid' | 'Cash On Delivery' | 'Delivery Fee Cash' | 'Mixed Payment' | 'No Payment Due';
export type DeliveryCashStatus = 'Not Required' | 'Pending Collection' | 'Collected By Driver' | 'Confirmed By Vendor' | 'Variance Review' | 'Missing Cash' | 'Closed';
export type DeliveryProviderType = 'Vendor Staff' | 'iDeliver Partner' | 'External Courier' | 'Customer Pickup';
export type DeliveryTrackingStatus = 'Not Started' | 'Location Shared' | 'En Route' | 'Delayed' | 'Arrived' | 'Completed' | 'Tracking Unavailable';
export type DeliveryConfirmationStatus = 'Code Pending' | 'Code Sent' | 'Code Verified' | 'Code Failed' | 'Manual Override Required';

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

export interface DeliveryRequest {
  deliveryId: string;
  deliveryNumber: string;
  vendorId: string;
  receiptId: string;
  receiptNumber: string;
  branchId: string;
  branchName: string;
  terminalId: string;
  cashierStaffId: string;
  cashierStaffName: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  customerWhatsapp: string;
  deliveryMethod: DeliveryMethod;
  deliveryStatus: DeliveryStatus;
  priority: DeliveryPriority;
  deliveryAddress: string;
  deliverySuburb?: string;
  deliveryCityTown?: string;
  deliveryNotes: string;
  deliveryFee: number;
  paymentMode: DeliveryPaymentMode;
  cashStatus: DeliveryCashStatus;
  totalReceiptAmount: number;
  cashToCollect: number;
  providerId?: string;
  providerName?: string;
  driverStaffId?: string;
  driverName?: string;
  driverPhone?: string;
  confirmationCode: string;
  confirmationStatus: DeliveryConfirmationStatus;
  trackingStatus: DeliveryTrackingStatus;
  requestedAt: string;
  assignedAt?: string;
  acceptedAt?: string;
  pickedUpAt?: string;
  deliveredAt?: string;
  cancelledAt?: string;
  failureReason?: string;
  verificationAttempts?: number;
  verifiedAt?: string;
  verifiedByStaffId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryRequestLine {
  lineId: string;
  deliveryId: string;
  productId: string;
  sku: string;
  productName: string;
  qty: number;
  receiptLineId?: string;
  lineStatus: string;
  notes: string;
}

export interface DeliveryProvider {
  providerId: string;
  providerName: string;
  providerType: DeliveryProviderType;
  phone: string;
  vehiclePlaceholder: string;
  active: boolean;
  ratingPlaceholder: number;
  completedDeliveries: number;
  failedDeliveries: number;
  cashVarianceCount: number;
}

export interface DeliveryAssignment {
  assignmentId: string;
  deliveryId: string;
  providerId?: string;
  providerName?: string;
  driverStaffId?: string;
  driverName?: string;
  driverPhone?: string;
  vehiclePlaceholder?: string;
  assignedAt: string;
  acceptedAt?: string;
  assignedByStaffId: string;
}

export interface DeliveryTrackingEvent {
  trackingEventId: string;
  deliveryId: string;
  dateTime: string;
  status: DeliveryTrackingStatus;
  locationText: string;
  latitudePlaceholder?: string;
  longitudePlaceholder?: string;
  notes: string;
  updatedByStaffId: string;
}

export interface DeliveryConfirmationCode {
  codeId: string;
  deliveryId: string;
  code: string;
  status: DeliveryConfirmationStatus;
  sentToCustomer: boolean;
  attempts: number;
  verifiedAt?: string;
  verifiedByStaffId?: string;
  createdAt: string;
}

export interface DeliveryCashCollection {
  cashCollectionId: string;
  deliveryId: string;
  paymentMode: DeliveryPaymentMode;
  cashToCollect: number;
  deliveryFeeCash: number;
  amountCollectedByDriver: number;
  driverCollectionNotes: string;
  vendorCashConfirmed: boolean;
  vendorConfirmedAmount: number;
  cashVariance: number;
  cashStatus: DeliveryCashStatus;
  updatedAt: string;
}

export interface DeliveryActivityEvent {
  id: string;
  deliveryId?: string;
  deliveryNumber?: string;
  receiptNumber?: string;
  eventType: string;
  message: string;
  staffId?: string;
  notes?: string;
  createdAt: string;
}

export interface DeliveryFilterState {
  deliveryNumber?: string;
  receiptNumber?: string;
  customer?: string;
  phone?: string;
  deliveryMethod?: 'ALL' | DeliveryMethod;
  deliveryStatus?: 'ALL' | DeliveryStatus;
  provider?: string;
  driver?: string;
  cashStatus?: 'ALL' | DeliveryCashStatus;
  confirmationStatus?: 'ALL' | DeliveryConfirmationStatus;
  priority?: 'ALL' | DeliveryPriority;
  dateFrom?: string;
  dateTo?: string;
}

export interface DeliverySummary {
  pendingAssignment: number;
  broadcastToIDeliver: number;
  assigned: number;
  inTransit: number;
  deliveredToday: number;
  failedDeliveries: number;
  cashPendingReview: number;
  codeVerificationPending: number;
  returnedToVendor: number;
  urgentDeliveries: number;
}

export interface DeliveryBroadcastPayload {
  deliveryNumber: string;
  receiptNumber: string;
  vendorId: string;
  branchId: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryFee: number;
  cashToCollect: number;
  priority: DeliveryPriority;
  itemCount: number;
  notes: string;
}

export interface DeliveryWhatsAppMessageDraft {
  draftId: string;
  deliveryId: string;
  messageType: 'Customer Code' | 'Customer Status' | 'Driver Assignment' | 'Vendor Cash Reminder';
  recipient: string;
  messageText: string;
  createdAt: string;
  status: 'Prepared' | 'Copied Placeholder' | 'Open WhatsApp Placeholder';
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

export type NetworkStatus = 'Online' | 'Offline' | 'Unstable' | 'Unknown';

export type SyncQueueStatus =
  | 'Queued'
  | 'Ready To Sync'
  | 'Syncing'
  | 'Synced'
  | 'Failed'
  | 'Conflict'
  | 'Cancelled'
  | 'Held For Review';

export type SyncEntityType =
  | 'Sale'
  | 'Receipt'
  | 'Payment'
  | 'Customer'
  | 'Customer Request'
  | 'Approval Request'
  | 'Delivery Request'
  | 'Inventory Movement'
  | 'Purchase Order'
  | 'Goods Receiving'
  | 'Supplier Return'
  | 'Stock Adjustment'
  | 'Stocktake'
  | 'Stock Transfer'
  | 'Accounting Readiness'
  | 'BI Event'
  | 'Audit Event'
  | 'Settings Change'
  | 'Terminal Session'
  | 'Shift Session';

export type SyncConflictType =
  | 'Duplicate Receipt'
  | 'Stock Quantity Conflict'
  | 'Customer Duplicate'
  | 'Price Changed'
  | 'Product Changed'
  | 'Shift Closed Remotely'
  | 'Terminal Deactivated Remotely'
  | 'Approval Status Changed'
  | 'Delivery Status Changed'
  | 'Document Already Posted'
  | 'Version Mismatch'
  | 'Permission Conflict'
  | 'Unknown Conflict';

export type SyncConflictResolution =
  | 'Use Local'
  | 'Use Remote'
  | 'Merge'
  | 'Retry'
  | 'Cancel Local'
  | 'Hold For Review'
  | 'Manual Review Required';

export type SyncPriority = 'Low' | 'Normal' | 'High' | 'Critical';

export type OfflineSyncHealthStatus = 'Healthy' | 'Warning' | 'Critical' | 'Offline' | 'Unknown';

export type OfflineSyncActivityEventType =
  | 'OFFLINE_ACTION_QUEUED'
  | 'SYNC_BATCH_CREATED'
  | 'SYNC_BATCH_PREPARED'
  | 'SYNC_BATCH_RUN_PLACEHOLDER'
  | 'SYNC_ITEM_SYNCED_PLACEHOLDER'
  | 'SYNC_ITEM_FAILED'
  | 'SYNC_ITEM_RETRIED'
  | 'SYNC_CONFLICT_DETECTED'
  | 'SYNC_CONFLICT_RESOLVED'
  | 'SYNC_CONFLICT_HELD_FOR_REVIEW'
  | 'SYNC_ITEM_CANCELLED'
  | 'TERMINAL_SYNC_HEALTH_REVIEWED'
  | 'LOCAL_SNAPSHOT_CREATED'
  | 'SYNC_REPORT_EXPORT_PREPARED';

export interface OfflineSyncQueueItem {
  queueId: string;
  vendorId: string;
  branchId: string;
  terminalId: string;
  staffId: string;
  staffName: string;
  entityType: SyncEntityType;
  entityId: string;
  entityNumber?: string;
  operationType: string;
  payload: Record<string, unknown>;
  payloadHash: string;
  localVersion: number;
  remoteVersion?: number;
  priority: SyncPriority;
  status: SyncQueueStatus;
  retryCount: number;
  lastError?: string;
  conflictId?: string;
  queuedAt: string;
  lastAttemptAt?: string;
  syncedAt?: string;
  notes?: string;
}

export interface OfflineSyncBatch {
  batchId: string;
  vendorId: string;
  branchId: string;
  terminalId: string;
  createdByStaffId: string;
  createdByStaffName: string;
  itemCount: number;
  highPriorityCount: number;
  failedCount: number;
  conflictCount: number;
  status: SyncQueueStatus;
  createdAt: string;
  completedAt?: string;
  notes?: string;
}

export interface OfflineSyncConflict {
  conflictId: string;
  queueId: string;
  vendorId: string;
  branchId: string;
  terminalId: string;
  entityType: SyncEntityType;
  entityId: string;
  entityNumber?: string;
  conflictType: SyncConflictType;
  localPayload: Record<string, unknown>;
  remotePayload?: Record<string, unknown>;
  localVersion: number;
  remoteVersion?: number;
  detectedAt: string;
  status: SyncQueueStatus;
  recommendedResolution: SyncConflictResolution;
  riskLevel: RiskLevel;
  notes?: string;
}

export interface OfflineSyncConflictDecision {
  decisionId: string;
  conflictId: string;
  queueId: string;
  resolution: SyncConflictResolution;
  decidedByStaffId: string;
  decidedByStaffName: string;
  reason: string;
  decidedAt: string;
}

export interface OfflineSyncHealth {
  terminalId: string;
  terminalName: string;
  branchId: string;
  branchName: string;
  networkStatus: NetworkStatus;
  lastSyncAt?: string;
  queueCount: number;
  failedCount: number;
  conflictCount: number;
  localStorageStatus: 'Available' | 'Unavailable' | 'Unknown';
  syncHealth: OfflineSyncHealthStatus;
}

export interface OfflineSyncActivityEvent {
  eventId: string;
  eventType: OfflineSyncActivityEventType;
  queueId?: string;
  batchId?: string;
  conflictId?: string;
  message: string;
  staffId?: string;
  staffName?: string;
  terminalId?: string;
  branchId?: string;
  createdAt: string;
}

export interface OfflineSyncFilterState {
  entityType?: 'ALL' | SyncEntityType;
  status?: 'ALL' | SyncQueueStatus;
  priority?: 'ALL' | SyncPriority;
  branchId?: string;
  terminalId?: string;
  staffId?: string;
  dateFrom?: string;
  dateTo?: string;
  conflictType?: 'ALL' | SyncConflictType;
  searchReference?: string;
}

export interface OfflineSyncSummary {
  networkStatus: NetworkStatus;
  queuedItems: number;
  readyToSync: number;
  failedItems: number;
  conflicts: number;
  syncedToday: number;
  heldForReview: number;
  criticalItems: number;
  lastSync?: string;
  terminalHealth: OfflineSyncHealthStatus;
}

export interface LocalTerminalSnapshot {
  snapshotId: string;
  terminalId: string;
  terminalName: string;
  branchId: string;
  branchName: string;
  staffId: string;
  staffName: string;
  openShiftId?: string;
  localReceipts: number;
  localCustomers: number;
  localDeliveries: number;
  localInventoryEvents: number;
  localBIEvents: number;
  lastSnapshotAt: string;
  storageEstimate: string;
}

export interface LocalDataVersionRecord {
  recordId: string;
  entityType: SyncEntityType;
  entityId: string;
  localVersion: number;
  remoteVersion?: number;
  payloadHash: string;
  updatedAt: string;
}

export type ProductImportBatchStatus =
  | 'Draft'
  | 'Mapping'
  | 'Validating'
  | 'Validation Failed'
  | 'Ready For Approval'
  | 'Pending Approval'
  | 'Approved'
  | 'Imported'
  | 'Partially Imported'
  | 'Rejected'
  | 'Cancelled';

export type ProductImportRowStatus =
  | 'Pending'
  | 'Valid'
  | 'Warning'
  | 'Error'
  | 'Duplicate'
  | 'Imported'
  | 'Skipped';

export type ProductImportSource =
  | 'Excel Upload Placeholder'
  | 'CSV Upload'
  | 'Paste Table'
  | 'Manual Batch'
  | 'Supplier File'
  | 'Offline Catalogue File';

export type ProductImportDuplicateAction =
  | 'Skip'
  | 'Update Existing Draft'
  | 'Create New Product'
  | 'Hold For Review';

export type IndustrialSectorCode =
  | 'MOTOR_SPARES'
  | 'HARDWARE'
  | 'GROCERY'
  | 'AGRICULTURE'
  | 'CLOTHING'
  | 'FURNITURE'
  | 'ELECTRONICS'
  | 'LUBRICANTS'
  | 'PHARMACY'
  | 'BUILDING_MATERIALS'
  | 'SOLAR_PRODUCTS'
  | 'GENERAL_RETAIL'
  | 'OTHER';

export type ProductImportIssueSeverity = 'Error' | 'Warning' | 'Info';

export interface ProductImportValidationIssue {
  issueId: string;
  batchId: string;
  rowId: string;
  rowNumber: number;
  field: string;
  issueType: string;
  message: string;
  severity: ProductImportIssueSeverity;
  suggestedFix: string;
}

export interface ProductImportRow {
  rowId: string;
  batchId: string;
  rowNumber: number;
  rawData: Record<string, string>;
  mappedProduct: Record<string, string | number | undefined>;
  validationIssues: ProductImportValidationIssue[];
  duplicateProductId?: string;
  duplicateAction: ProductImportDuplicateAction;
  status: ProductImportRowStatus;
  notes?: string;
}

export interface ProductImportBatch {
  batchId: string;
  batchNumber: string;
  vendorId: string;
  branchId: string;
  warehouseId: string;
  industrialSectorCode: IndustrialSectorCode;
  source: ProductImportSource;
  status: ProductImportBatchStatus;
  fileName?: string;
  uploadedByStaffId: string;
  uploadedByStaffName: string;
  totalRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
  duplicateRows: number;
  importedRows: number;
  skippedRows: number;
  createdAt: string;
  updatedAt: string;
  notes: string;
}

export interface ProductImportColumnMapping {
  mappingId: string;
  batchId: string;
  sourceColumn: string;
  targetField: string;
  required: boolean;
  sectorSpecific: boolean;
  sampleValue: string;
  status: 'Mapped' | 'Unmapped' | 'Review Required';
}

export interface ProductImportPreviewSummary {
  batchId: string;
  totalRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
  duplicateRows: number;
  productsToCreate: number;
  openingBalanceDraftsToCreate: number;
}

export interface OpeningBalanceDraftFromImport {
  draftId: string;
  batchId: string;
  rowId: string;
  rowNumber: number;
  sku?: string;
  productName: string;
  branchId: string;
  warehouseId: string;
  shelfLocation?: string;
  importedQty: number;
  unitCost: number;
  valueEstimate: number;
  status: 'Draft - Not Posted' | 'Skipped' | 'Ready For Posting Placeholder';
  createdAt: string;
  notes?: string;
}

export interface IndustrialSectorMappingTemplate {
  templateId: string;
  industrialSectorCode: IndustrialSectorCode;
  sectorName: string;
  requiredFields: string[];
  recommendedFields: string[];
  optionalFields: string[];
  sectorSpecificFields: string[];
  defaultCategoryOptions: string[];
  defaultSubcategoryOptions: string[];
}

export type ProductImportActivityEventType =
  | 'PRODUCT_IMPORT_BATCH_CREATED'
  | 'PRODUCT_IMPORT_FILE_PARSED_PLACEHOLDER'
  | 'PRODUCT_IMPORT_COLUMNS_MAPPED'
  | 'PRODUCT_IMPORT_VALIDATED'
  | 'PRODUCT_IMPORT_VALIDATION_FAILED'
  | 'PRODUCT_IMPORT_DUPLICATES_FOUND'
  | 'PRODUCT_IMPORT_SUBMITTED_FOR_APPROVAL'
  | 'PRODUCT_IMPORT_APPROVED'
  | 'PRODUCT_IMPORT_REJECTED'
  | 'PRODUCT_IMPORT_BATCH_IMPORTED'
  | 'PRODUCT_IMPORT_ROW_SKIPPED'
  | 'OPENING_BALANCE_DRAFT_CREATED_FROM_IMPORT';

export interface ProductImportActivityEvent {
  eventId: string;
  batchId?: string;
  rowId?: string;
  eventType: ProductImportActivityEventType;
  message: string;
  staffId?: string;
  staffName?: string;
  createdAt: string;
}

export interface ProductImportFilterState {
  batchNumber?: string;
  industrialSectorCode?: 'ALL' | IndustrialSectorCode;
  status?: 'ALL' | ProductImportBatchStatus;
  source?: 'ALL' | ProductImportSource;
  uploadedBy?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export type EODCheckStatus =
  | 'Passed'
  | 'Warning'
  | 'Failed'
  | 'Pending';

export type EODStatus =
  | 'Open'
  | 'In Review'
  | 'Ready To Lock'
  | 'Locked'
  | 'Blocked';

export type PaymentMode =
  | 'Cash'
  | 'EcoCash'
  | 'Swipe'
  | 'Bank Transfer'
  | 'Split Payment'
  | 'Credit Sale'
  | 'Store Credit';

export interface EODSession {
  id: string;
  vendorId: string;
  businessVendor: string;
  businessDate: string;
  branch: string;
  status: Extract<EODStatus, 'Open' | 'In Review' | 'Ready To Lock' | 'Locked' | 'Blocked'>;
  lastCheckTime: string;
  todaySales: number;
  netReceipts: number;
  cashExpected: number;
  cashDeclared: number;
  cashVariance: number;
  refunds: number;
  voids: number;
  openShifts: number;
  pendingStockMovements: number;
  pendingDeliveries: number;
  criticalBIAlerts: number;
  syncPendingItems: number;
  lockedAt?: string;
  lockedBy?: string;
}

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
  label?: string;
  check?: string;
  domain?: string;
  status: EODCheckStatus;
  risk?: RiskLevel;
  requiredAction?: string;
  reviewedBy?: string;
  ownerAction?: string;
  notes?: string;
}

export interface EODReconciliationRow {
  id: string;
  domain: string;
  expected: string;
  actual: string;
  variance: string;
  status: 'Balanced' | 'Variance' | 'Review' | 'Failed';
  requiredAction: string;
}

export interface EODPaymentSummary {
  id: string;
  paymentMode: PaymentMode | 'Refunds' | 'Net Receipts';
  receiptCount: number;
  grossAmount: number;
  discounts: number;
  refunds: number;
  netAmount: number;
  expectedSettlement: number;
  declaredOrConfirmed: number | 'Pending';
  variance: number | 'Pending';
  status: 'Balanced' | 'Variance' | 'Review';
}

export interface EODShiftSummary {
  id: string;
  shiftId: string;
  branch: string;
  terminal: string;
  staff: string;
  openedAt: string;
  closedAt: string;
  status: 'Open' | 'Closed' | 'Force Closed Placeholder';
  salesTotal: number;
  expectedCash: number;
  declaredCash: number | 'Pending';
  variance: number | 'Pending';
  syncStatus: 'Synced' | 'Pending Sync' | 'Conflict';
  reviewedBy?: string;
}

export interface EODCashReconciliation {
  id: string;
  branch: string;
  terminal: string;
  cashier: string;
  shiftId: string;
  openingFloat: number;
  cashSales: number;
  cashIn: number;
  cashOut: number;
  expectedCash: number;
  declaredCash: number;
  variance: number;
  status: 'Balanced' | 'Variance' | 'Reviewed';
  requiredAction: string;
  reviewedBy?: string;
  ownerNote?: string;
}

export interface EODInventoryClosingRow {
  id: string;
  movementId: string;
  product: string;
  movementType: string;
  reference: string;
  branch: string;
  warehouse: string;
  qtyIn: number;
  qtyOut: number;
  status: 'Posted' | 'Pending Approval' | 'Reviewed' | 'Reversed';
  risk: RiskLevel;
  requiredAction: string;
  reviewedBy?: string;
}

export interface EODDeliveryClosingRow {
  id: string;
  deliveryId: string;
  branch?: string;
  receipt: string;
  customer: string;
  deliveryMethod: string;
  driver: string;
  status: 'Completed' | 'Pending' | 'Failed' | 'Follow Up';
  secretCodeStatus: 'Confirmed' | 'Pending' | 'Not Required' | 'Mismatch';
  completedAt: string;
  risk: RiskLevel;
  requiredAction: string;
  reviewedBy?: string;
}

export interface EODBIReviewItem {
  id: string;
  eventType: string;
  domain: string;
  severity: RiskLevel;
  description: string;
  recommendedAction: string;
  status: 'Open' | 'Reviewed' | 'Owner Note Added';
  reviewedBy?: string;
}

export type EODActivityEventType =
  | 'EOD_CHECK_RUN'
  | 'CASH_VARIANCE_REVIEWED'
  | 'PAYMENT_SUMMARY_REVIEWED'
  | 'SHIFT_FORCE_CLOSE_PLACEHOLDER'
  | 'INVENTORY_CLOSING_REVIEWED'
  | 'DELIVERY_CLOSING_REVIEWED'
  | 'BI_REVIEW_COMPLETED'
  | 'EOD_LOCK_ATTEMPTED'
  | 'EOD_LOCK_BLOCKED'
  | 'EOD_DAY_LOCKED'
  | 'EOD_REPORT_EXPORT_PREPARED';

export interface EODActivityEvent {
  id: string;
  timestamp: string;
  eventType: EODActivityEventType;
  message: string;
  operator: string;
}

export interface DayLockAttempt {
  success: boolean;
  message: string;
  session: EODSession;
  blockingReasons: string[];
  activity: EODActivityEvent[];
}

export type AccountType =
  | 'Asset'
  | 'Liability'
  | 'Equity'
  | 'Income'
  | 'Cost of Sales'
  | 'Expense'
  | 'Tax'
  | 'Control';

export type COAAccountStatus = 'Active' | 'Inactive' | 'Draft';

export type PostingStatus =
  | 'Draft'
  | 'Posted'
  | 'Pending Review'
  | 'Reversed';

export type AccountingSource =
  | 'Sale'
  | 'Refund'
  | 'Void'
  | 'Cash Movement'
  | 'Inventory Movement'
  | 'EOD'
  | 'Manual Placeholder';

export interface COAAccount {
  id: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  linkedDomain: string;
  status: COAAccountStatus;
  notes?: string;
}

export interface AccountingPostingLine {
  id: string;
  postingId: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  memo: string;
}

export interface AccountingPosting {
  id: string;
  source: AccountingSource;
  sourceReference: string;
  businessDate: string;
  branch: string;
  postingStatus: PostingStatus;
  totalDebit: number;
  totalCredit: number;
  reviewedBy?: string;
  reason?: string;
}

export interface CashbookEntry {
  id: string;
  dateTime: string;
  branch: string;
  terminal: string;
  staff: string;
  movementType: 'Opening Float' | 'Cash Sale' | 'Cash In' | 'Cash Out' | 'Refund' | 'Banking' | 'Owner Withdrawal' | 'Petty Cash' | 'Cash Variance';
  reference: string;
  cashIn: number;
  cashOut: number;
  balanceAfter: number;
  account: string;
  status: PostingStatus;
  notes: string;
}

export interface SalesAccountingSummary {
  id: string;
  receiptNo: string;
  dateTime: string;
  branch: string;
  terminal: string;
  cashier: string;
  grossSale: number;
  discount: number;
  vat: number;
  netSale: number;
  salesAccount: string;
  postingStatus: PostingStatus;
}

export interface PaymentAccountingSummary {
  id: string;
  paymentMode: PaymentMode | 'Refunds' | 'Store Credit';
  receiptCount: number;
  grossAmount: number;
  refunds: number;
  netAmount: number;
  controlAccount: string;
  settlementStatus: 'Settled' | 'Pending' | 'Variance' | 'Placeholder';
  variance: number | 'Pending';
  postingStatus: PostingStatus;
}

export interface COGSReserveSummary {
  id: string;
  product: string;
  receiptReference: string;
  qtySold: number;
  unitCost: number;
  sellingPrice: number;
  estimatedCOGS: number;
  suggestedReserve: number;
  reserveStatus: 'Reserved' | 'Pending' | 'Used' | 'Misuse Risk' | 'Review Required';
}

export interface VATSummary {
  id: string;
  receiptNo: string;
  date: string;
  grossAmount: number;
  vatableAmount: number;
  vatAmount: number;
  vatMode: 'Inclusive' | 'Exclusive' | 'Not VAT Registered';
  vatNumber: string;
  status: PostingStatus;
}

export interface InventoryAssetPostingRow {
  id: string;
  product: string;
  movementType: string;
  reference: string;
  qtyIn: number;
  qtyOut: number;
  unitCost: number;
  costImpact: number;
  assetAccount: string;
  cogsAccount: string;
  salesAccount: string;
  postingStatus: PostingStatus;
  risk: RiskLevel;
}

export interface AccountingReadinessCheck {
  id: string;
  check: string;
  domain: string;
  status: EODCheckStatus;
  requiredAction: string;
}

export type InventoryAccountingReadinessStatus =
  | 'Pending Review'
  | 'Reviewed'
  | 'Approved For Posting'
  | 'Posted Placeholder'
  | 'Rejected'
  | 'On Hold'
  | 'Reversal Requested'
  | 'Closed';

export type InventoryAccountingImpactType =
  | 'Inventory Asset Increase'
  | 'Inventory Asset Decrease'
  | 'Inventory Write Off'
  | 'Stocktake Gain'
  | 'Stocktake Loss'
  | 'Supplier Return Credit Expected'
  | 'GRN Supplier Invoice Pending'
  | 'Transfer Neutral'
  | 'Cost Variance Review'
  | 'Unknown Impact Review';

export type InventoryAccountingSourceType =
  | 'GRN'
  | 'Supplier Return'
  | 'Stock Adjustment'
  | 'Stocktake'
  | 'Stock Transfer'
  | 'Inventory Movement'
  | 'Product Ledger';

export type InventoryAccountingRiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export interface InventoryAccountingReadinessRecord {
  readinessId: string;
  readinessNumber: string;
  vendorId: string;
  sourceType: InventoryAccountingSourceType;
  sourceId: string;
  sourceNumber: string;
  movementId?: string;
  movementType: InventoryMovementType;
  impactType: InventoryAccountingImpactType;
  branchId: string;
  branchName: string;
  warehouseId: string;
  warehouseName: string;
  status: InventoryAccountingReadinessStatus;
  riskLevel: InventoryAccountingRiskLevel;
  totalValueImpact: number;
  currency: string;
  reviewedByStaffId?: string;
  reviewedByStaffName?: string;
  approvedByStaffId?: string;
  approvedByStaffName?: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryAccountingReadinessLine {
  lineId: string;
  readinessId: string;
  productId: string;
  sku: string;
  productName: string;
  movementType: InventoryMovementType;
  qtyIn: number;
  qtyOut: number;
  unitCost: number;
  valueImpact: number;
  debitAccountCode?: string;
  debitAccountName?: string;
  creditAccountCode?: string;
  creditAccountName?: string;
  mappingStatus: 'Mapped' | 'Unresolved' | 'Review Required';
  notes: string;
}

export interface InventoryAccountingSummary {
  pendingReview: number;
  reviewed: number;
  approvedForPosting: number;
  onHold: number;
  highRisk: number;
  critical: number;
  inventoryIncreaseValue: number;
  inventoryDecreaseValue: number;
  writeOffValue: number;
  stocktakeLossValue: number;
  supplierCreditExpected: number;
  transferNeutral: number;
}

export interface InventoryAccountingFilterState {
  readinessNumber?: string;
  sourceType?: 'ALL' | InventoryAccountingSourceType;
  sourceNumber?: string;
  movementType?: 'ALL' | InventoryMovementType;
  impactType?: 'ALL' | InventoryAccountingImpactType;
  branchId?: string;
  warehouseId?: string;
  status?: 'ALL' | InventoryAccountingReadinessStatus;
  riskLevel?: 'ALL' | InventoryAccountingRiskLevel;
  dateFrom?: string;
  dateTo?: string;
}

export interface InventoryAccountingActivityEvent {
  id: string;
  eventType: string;
  readinessId?: string;
  sourceNumber?: string;
  message: string;
  staffId?: string;
  notes?: string;
  createdAt: string;
}

export interface ChartOfAccountsPlaceholder {
  accountCode: string;
  accountName: string;
  accountType: AccountType | 'Review';
  normalBalance: 'Debit' | 'Credit';
  linkedDomain: string;
  status: 'Active' | 'Review' | 'Inactive';
}

export interface AccountingMappingRule {
  ruleId: string;
  movementType: InventoryMovementType;
  impactType: InventoryAccountingImpactType;
  debitAccountCode?: string;
  creditAccountCode?: string;
  mappingStatus: 'Mapped' | 'Unresolved' | 'Review Required';
  notes: string;
}

export interface InventoryValuationSnapshot {
  snapshotId: string;
  productId: string;
  sku: string;
  productName: string;
  qtyOnHand: number;
  unitCost: number;
  totalValue: number;
  branchId: string;
  warehouseId: string;
  createdAt: string;
}

export type AccountingActivityEventType =
  | 'SALES_POSTING_REVIEWED'
  | 'PAYMENT_POSTING_REVIEWED'
  | 'CASHBOOK_ENTRY_CREATED'
  | 'VAT_SUMMARY_VIEWED'
  | 'COGS_RESERVED'
  | 'COGS_USED'
  | 'COGS_MISUSE_ATTEMPT'
  | 'COGS_RESERVE_REVIEW_REQUIRED'
  | 'INVENTORY_ASSET_POSTING_REVIEWED'
  | 'ACCOUNTING_READINESS_CHECK_RUN'
  | 'ACCOUNTING_REPORT_EXPORT_PREPARED'
  | 'INVENTORY_ACCOUNTING_REVIEW_PREPARED'
  | 'INVENTORY_ACCOUNTING_REVIEWED'
  | 'INVENTORY_ACCOUNTING_APPROVED_FOR_POSTING'
  | 'INVENTORY_ACCOUNTING_ON_HOLD'
  | 'INVENTORY_ACCOUNTING_REJECTED'
  | 'INVENTORY_ACCOUNTING_POSTED_PLACEHOLDER'
  | 'INVENTORY_VALUE_INCREASE_REVIEW'
  | 'INVENTORY_VALUE_DECREASE_REVIEW'
  | 'INVENTORY_WRITE_OFF_REVIEW'
  | 'SUPPLIER_CREDIT_EXPECTED_REVIEW'
  | 'STOCKTAKE_LOSS_ACCOUNTING_REVIEW'
  | 'ACCOUNT_MAPPING_UNRESOLVED';

export interface AccountingActivityEvent {
  id: string;
  timestamp: string;
  eventType: AccountingActivityEventType;
  message: string;
  operator: string;
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
  | 'EOD_LOCK_BLOCKED'
  | 'EOD_DAY_LOCKED'
  | 'EOD_REPORT_EXPORT_PREPARED';

export interface OwnerActivityEvent {
  id: string;
  timestamp: string;
  eventType: OwnerActivityEventType;
  message: string;
  operator: string;
}

export type POSPlanTier = 'POS Starter' | 'POS Growth' | 'POS Pro' | 'POS Enterprise';

export type POSSubscriptionStatus =
  | 'Trial'
  | 'Active'
  | 'Past Due'
  | 'Suspended'
  | 'Expired'
  | 'Cancelled';

export type POSLicenseStatus =
  | 'Active'
  | 'Grace Period'
  | 'Suspended'
  | 'Expired'
  | 'Pending Activation';

export type POSFeatureKey =
  | 'SALES_TERMINAL'
  | 'STOCK_CONTROL'
  | 'SHIFT_CONTROL'
  | 'CASH_CONTROL'
  | 'BI_DESK'
  | 'CUSTOMER_DESK'
  | 'DELIVERY_DESK'
  | 'SYNC_DESK'
  | 'OWNER_DESK'
  | 'SETTINGS'
  | 'OFFLINE_QUEUE'
  | 'RECEIPT_PREVIEW'
  | 'RETURNS_REFUNDS'
  | 'GOODS_RECEIVING'
  | 'STOCKTAKE'
  | 'ROLE_PERMISSIONS'
  | 'EOD_RECONCILIATION';

export type POSPlanLimitKey =
  | 'branches'
  | 'terminals'
  | 'staff'
  | 'products'
  | 'offlineGraceDays';

export interface POSPlan {
  tier: POSPlanTier;
  monthlyPrice: number | 'custom';
  branchesAllowed: number | 'unlimited';
  terminalsAllowed: number | 'unlimited';
  staffAllowed: number | 'unlimited';
  productsAllowed: number | 'unlimited';
  enabledFeatures: POSFeatureKey[];
}

export interface VendorPOSSubscription {
  vendorId: string;
  planTier: POSPlanTier;
  status: POSSubscriptionStatus;
  trialStartedAt: string;
  trialEndsAt: string;
  currentPeriodEndsAt: string;
  billingCurrency: string;
  billingSource: string;
  graceDaysRemaining: number;
}

export interface VendorPOSLicense {
  vendorId: string;
  licenseStatus: POSLicenseStatus;
  licenseKey: string;
  activatedAt: string;
  expiresAt: string;
  lastCheckedAt: string;
  activationSource: string;
  offlineGraceAllowed: boolean;
  offlineGraceDays: number;
}

export interface POSFeatureEntitlement {
  vendorId: string;
  featureKey: POSFeatureKey;
  label: string;
  enabled: boolean;
  sourcePlan: POSPlanTier;
  status: 'Enabled' | 'Pro Feature' | 'Not in Plan';
  uiEffect: string;
}

export interface POSPlanLimit {
  key: POSPlanLimitKey;
  label: string;
  allowed: number | 'unlimited';
  currentUsage: number;
  status: 'Within Limit' | 'At Limit' | 'Over Limit';
  requiredAction: string;
}

export interface POSAccessSnapshot {
  vendorId: string;
  plan: POSPlan;
  subscription: VendorPOSSubscription;
  license: VendorPOSLicense;
  entitlements: POSFeatureEntitlement[];
  limits: POSPlanLimit[];
}

export type ReceiptPaymentType =
  | 'Cash'
  | 'EcoCash'
  | 'Swipe'
  | 'Bank Transfer'
  | 'Split Payment'
  | 'Credit Sale Placeholder'
  | 'Store Credit Placeholder';

export interface PaymentReceiptRow {
  id: string;
  vendorId: string;
  businessVendor: string;
  branchId: string;
  branch: string;
  terminalId: string;
  terminal: string;
  cashierId: string;
  cashier: string;
  receiptNo: string;
  dateTime: string;
  customer: string;
  paymentType: ReceiptPaymentType;
  grossAmount: number;
  discount: number;
  refund: number;
  netAmount: number;
  status: 'Completed' | 'Refund Partial' | 'Voided' | string;
  createdByStaffId: string;
  createdAt: string;
  updatedAt: string;
}

export type PaymentReportEventType =
  | 'PAYMENT_BREAKDOWN_VIEWED'
  | 'RECEIPTS_FILTER_APPLIED'
  | 'RECEIPT_REPRINT_PREVIEWED'
  | 'PAYMENT_REPORT_EXPORT_PREPARED';

export type ReceiptStatus =
  | 'Draft'
  | 'Completed'
  | 'Reprinted'
  | 'Refunded'
  | 'Partially Refunded'
  | 'Voided'
  | 'Fiscal Pending'
  | 'Fiscalized'
  | 'Fiscal Failed';

export type ReceiptFormat = '80mm' | 'A4' | 'PDF Placeholder';

export type VATMode = 'Inclusive' | 'Exclusive' | 'Not VAT Registered';

export type FiscalizationStatus =
  | 'Not Required'
  | 'Pending'
  | 'Queued'
  | 'Fiscalized'
  | 'Failed'
  | 'Offline Pending'
  | 'Disabled In Development';

export type ReceiptAuditEventType =
  | 'RECEIPT_CREATED'
  | 'RECEIPT_PRINTED'
  | 'RECEIPT_REPRINTED'
  | 'RECEIPT_VOIDED'
  | 'RECEIPT_REFUNDED'
  | 'RECEIPT_SEQUENCE_CHECKED'
  | 'RECEIPT_GAP_DETECTED'
  | 'DUPLICATE_RECEIPT_RISK'
  | 'FISCALIZATION_QUEUED'
  | 'FISCALIZATION_PLACEHOLDER_CREATED'
  | 'RECEIPT_PDF_EXPORT_PREPARED'
  | 'RECEIPT_PRINT_STARTED'
  | 'RECEIPT_PDF_PREPARED'
  | 'RECEIPT_WHATSAPP_SHARE_PREPARED';

export interface ReceiptBusinessDetails {
  businessName: string;
  tradingName: string;
  vendorId: string;
  branch: string;
  address: string;
  phone: string;
  whatsApp: string;
  vatNumber?: string;
  vatRegistered: boolean;
  footerMessage: string;
}

export interface ReceiptCustomerDetails {
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  customerWhatsApp?: string;
  customerTaxNo?: string;
  customerAddress?: string;
  billingAddress?: string;
  deliveryAddress?: string;
  creditStatus?: CustomerCreditStatus;
}

export interface ReceiptLine {
  id: string;
  receiptNumber: string;
  productId: string;
  sku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  lineNetAmount: number;
  vatAmount: number;
  lineTotal: number;
  salesAccountCOA?: string;
  assetAccountCOA?: string;
}

export interface ReceiptPaymentLine {
  id: string;
  receiptNumber: string;
  paymentMode: PaymentMode;
  amount: number;
  reference?: string;
  confirmed: boolean;
}

export interface ReceiptTaxSummary {
  receiptNumber: string;
  vatMode: VATMode;
  vatRate: number;
  taxableAmount: number;
  vatAmount: number;
  nonTaxableAmount: number;
  taxLabel: string;
}

export interface ReceiptRecord {
  id: string;
  receiptNumber: string;
  vendorId: string;
  businessVendor: string;
  branchId: string;
  branch: string;
  terminalId: string;
  terminal: string;
  cashierId: string;
  cashier: string;
  businessDate: string;
  dateTime: string;
  customer: ReceiptCustomerDetails;
  businessDetails: ReceiptBusinessDetails;
  subtotal: number;
  discountTotal: number;
  vatTotal: number;
  grandTotal: number;
  paymentMode: PaymentMode;
  status: ReceiptStatus;
  fiscalizationStatus: FiscalizationStatus;
  fiscalReferencePlaceholder?: string;
  originalReceiptNumber?: string;
  refundReference?: string;
  voidReference?: string;
  reprintCount: number;
  offlineQueued: boolean;
  createdByStaffId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReceiptSequenceControl {
  id: string;
  vendorId: string;
  businessVendor: string;
  branch: string;
  terminal: string;
  prefix: string;
  lastReceiptNo: string;
  nextReceiptNo: string;
  sequenceStatus: 'Healthy' | 'Gap Detected' | 'Duplicate Risk' | 'Offline Pending' | 'Review Required';
  gapCount: number;
  duplicateRisk: RiskLevel;
  lastChecked: string;
  reviewedBy?: string;
}

export interface ReceiptPrintPreview {
  receipt: ReceiptRecord;
  lines: ReceiptLine[];
  payments: ReceiptPaymentLine[];
  taxSummary: ReceiptTaxSummary;
  format: ReceiptFormat;
  isReprint: boolean;
}

export interface ReceiptReprintAudit {
  id: string;
  receiptNumber: string;
  originalPrintedAt: string;
  reprintedAt: string;
  reprintedBy: string;
  reason: string;
  reprintCount: number;
  approvalRequired: boolean;
  status: 'Logged' | 'Review Required' | 'Approved Placeholder';
}

export interface FiscalizationPlaceholderRecord {
  id: string;
  receiptNumber: string;
  dateTime: string;
  branch: string;
  terminal: string;
  fiscalStatus: FiscalizationStatus;
  fiscalReferencePlaceholder: string;
  queueStatus: 'Not Queued' | 'Queued' | 'Retry Pending' | 'Completed Placeholder';
  errorMessagePlaceholder?: string;
}

export interface ReceiptAuditEvent {
  id: string;
  timestamp: string;
  eventType: ReceiptAuditEventType;
  receiptNumber: string;
  message: string;
  operator: string;
}
