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

export type Role = 'Owner' | 'SysAdmin' | 'Manager' | 'Cashier' | 'Stock Controller' | 'Supervisor' | 'Delivery Staff' | 'Accountant' | 'Viewer';

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
  | 'Inventory Risk'
  | 'Customer and Credit Risk'
  | 'Tax / VAT Readiness'
  | 'Shift / EOD Control'
  | 'Supplier / Purchase Discipline'
  | 'Offline Sync Risk'
  | 'Management Profit Snapshot'
  | 'Miscellaneous Sales Review';

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

export type BIDomain =
  | 'Sales Integrity'
  | 'Stock Integrity'
  | 'Cash Control'
  | 'Staff Behaviour'
  | 'Shift / EOD Control'
  | 'Delivery Fulfilment'
  | 'Customer and Credit Risk'
  | 'Tax / VAT Readiness'
  | 'Reorder Discipline'
  | 'Branch / Terminal Performance'
  | 'Approval Pressure'
  | 'Management Profit Snapshot'
  | 'Miscellaneous Sales Review'
  | 'Supplier / Purchase Discipline'
  | 'Offline Sync Risk';

export type BIRiskLevel = RiskLevel;
export type BITriggerType =
  | 'DISCOUNT_ABOVE_LIMIT'
  | 'REPEATED_PRICE_OVERRIDE'
  | 'MISCELLANEOUS_SALE_REVIEW'
  | 'RETURN_AFTER_SHORT_TIME'
  | 'REPEATED_RECEIPT_REPRINT'
  | 'ZERO_STOCK_SALE_BLOCKED'
  | 'NEGATIVE_STOCK_ATTEMPT'
  | 'DEAD_STOCK_REORDER_WARNING'
  | 'SHELF_STOCKTAKE_DUE'
  | 'HIGH_VARIANCE_STOCKTAKE'
  | 'DRAWER_VARIANCE'
  | 'DRAWER_OPEN_TOO_OFTEN'
  | 'PAYMENT_METHOD_MISMATCH'
  | 'DELIVERY_CASH_PENDING'
  | 'REPEATED_FAILED_LOGIN'
  | 'STAFF_OVERRIDE_PATTERN'
  | 'UNUSUAL_SALE_VOID_PATTERN'
  | 'END_OF_DAY_DELAY'
  | 'DELIVERY_CODE_NOT_VERIFIED'
  | 'DELIVERY_CASH_NOT_CONFIRMED'
  | 'DELIVERY_TIME_RISK'
  | 'CREDIT_LIMIT_EXCEEDED'
  | 'REPEAT_UNPAID_CUSTOMER'
  | 'SUSPICIOUS_CUSTOMER_RETURNS'
  | 'MISSING_TAX_NUMBER'
  | 'VAT_AMOUNT_INCONSISTENCY'
  | 'EOD_VAT_SUMMARY_MISSING'
  | 'TOO_MANY_PENDING_APPROVALS'
  | 'HIGH_RISK_APPROVAL_WAITING'
  | 'OFFLINE_SALES_NOT_SYNCED'
  | 'CONFLICT_PENDING';
export type BIRuleStatus = 'Active' | 'Inactive' | 'Draft';
export type BIManagementAdviceStatus = 'New' | 'Assigned' | 'In Progress' | 'Waiting Review' | 'Resolved' | 'Dismissed' | 'Escalated' | 'Blocked';
export type BIManagementActionStatus = 'New' | 'Assigned' | 'In Progress' | 'Waiting Review' | 'Resolved' | 'Dismissed' | 'Escalated' | 'Blocked';
export type BIManagementDesk =
  | 'BI Desk'
  | 'Manager Desk'
  | 'Owner Desk'
  | 'Stock Controller Desk'
  | 'Inventory'
  | 'Cash Control'
  | 'Shift Control'
  | 'Delivery Desk'
  | 'Customer Centre'
  | 'Approvals'
  | 'Accounting / Finance'
  | 'Sync Desk'
  | 'Task Desk';
export type BIManagementScoreType = 'Staff' | 'Stock' | 'Cash' | 'Sales' | 'Delivery' | 'Customer' | 'Tax' | 'Shift' | 'Domain';

export interface BIRuleDefinition {
  ruleId: string;
  ruleCode: BITriggerType;
  domain: BIDomain;
  title: string;
  description: string;
  riskLevel: BIRiskLevel;
  triggerConditionNarrative: string;
  recommendedAction: string;
  assignedDesk: BIManagementDesk;
  assignedRole: string;
  active: boolean;
  severityWeight: number;
  createdAt: string;
  updatedAt: string;
}

export interface BIRuleEvaluationContext {
  branchId?: string;
  branchName?: string;
  terminalId?: string;
  terminalName?: string;
  staffId?: string;
  staffName?: string;
  products?: Product[];
  transactions?: Transaction[];
  biEvents?: BiEvent[];
  customerRecords?: CustomerRecord[];
}

export interface BIRuleTriggerLog {
  triggerId: string;
  ruleId: string;
  ruleCode: BITriggerType;
  domain: BIDomain;
  title: string;
  narrative: string;
  riskLevel: BIRiskLevel;
  relatedRecordId?: string;
  relatedModule: string;
  productId?: string;
  productName?: string;
  sku?: string;
  staffId?: string;
  staffName?: string;
  customerId?: string;
  customerName?: string;
  branchId?: string;
  branchName?: string;
  terminalId?: string;
  terminalName?: string;
  assignedDesk: BIManagementDesk;
  assignedRole: string;
  recommendedAction: string;
  createdAt: string;
}

export interface BIManagementActionPoint {
  actionPointId: string;
  adviceId: string;
  label: string;
  description: string;
  assignedDesk: BIManagementDesk;
  assignedRole: string;
  assignedStaffId?: string;
  dueDate: string;
  status: BIManagementActionStatus;
  completedAt?: string;
  completedBy?: string;
  resultNote?: string;
}

export interface BIManagementAdvice {
  adviceId: string;
  adviceNumber: string;
  domain: BIDomain;
  title: string;
  narrative: string;
  businessRisk: string;
  recommendedAction: string;
  riskLevel: BIRiskLevel;
  priority: BIRiskLevel;
  sourceRuleCode: BITriggerType;
  sourceTriggerId: string;
  relatedRecordId?: string;
  relatedModule: string;
  productId?: string;
  productName?: string;
  sku?: string;
  staffId?: string;
  staffName?: string;
  customerId?: string;
  customerName?: string;
  branchId?: string;
  branchName?: string;
  terminalId?: string;
  terminalName?: string;
  assignedDesk: BIManagementDesk;
  assignedRole: string;
  assignedStaffId?: string;
  dueDate?: string;
  status: BIManagementAdviceStatus;
  actionPoints: BIManagementActionPoint[];
  createdAt: string;
  resolvedAt?: string;
  resolutionNote?: string;
}

export interface BIStaffRiskScore { staffId: string; staffName: string; score: number; riskLevel: BIRiskLevel; openWarnings: number; }
export interface BIStockRiskScore { productId: string; productName: string; sku: string; score: number; riskLevel: BIRiskLevel; availableQty: number; }
export interface BICashRiskScore { drawerId: string; terminalName: string; score: number; riskLevel: BIRiskLevel; varianceAmount: number; }
export interface BISalesRiskScore { branchName: string; score: number; riskLevel: BIRiskLevel; openWarnings: number; }
export interface BIDeliveryRiskScore { branchName: string; score: number; riskLevel: BIRiskLevel; openWarnings: number; }
export interface BICustomerRiskScore { customerId: string; customerName: string; score: number; riskLevel: BIRiskLevel; currentBalance: number; }
export interface BITaxReadinessScore { branchName: string; score: number; riskLevel: BIRiskLevel; warnings: number; }
export interface BIShiftScore { shiftId: string; branchName: string; score: number; riskLevel: BIRiskLevel; openWarnings: number; }

export interface BIManagementDashboardMetric {
  metricId: string;
  label: string;
  value: number | string;
  riskLevel: BIRiskLevel;
  help: string;
}

export interface BIManagementInsightPayload {
  metrics: BIManagementDashboardMetric[];
  domainCards: Array<{ domain: BIDomain; riskScore: number; openWarnings: number; dueActionPoints: number; lastTrigger: string; riskLevel: BIRiskLevel }>;
  triggerLogs: BIRuleTriggerLog[];
  advice: BIManagementAdvice[];
  actionPoints: BIManagementActionPoint[];
}

export interface BIManagementActivityEvent {
  eventId: string;
  eventType: string;
  domain?: BIDomain;
  adviceId?: string;
  actionPointId?: string;
  message: string;
  staffId?: string;
  createdAt: string;
}

export type PaymentMethod = 'Cash' | 'EcoCash' | 'Swipe' | 'Bank Transfer' | 'Split Payment' | 'Credit Sale' | 'CASH' | 'CARD' | 'NFC' | 'SPLIT';

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
    unitCost?: number;
    costPrice?: number;
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

export type SupplierCreditStatus = 'CashOnly' | 'CreditAllowed' | 'CreditBlocked' | 'Suspended' | 'Preferred' | 'UnderReview' | 'ManagerApprovalRequired';
export type SupplierBillStatus = 'Draft' | 'Posted' | 'PartiallyPaid' | 'Paid' | 'Overdue' | 'Disputed' | 'Cancelled' | 'Reversed';
export type SupplierPaymentStatus = 'Draft' | 'PendingApproval' | 'Approved' | 'Paid' | 'Rejected' | 'Reversed';
export type SupplierPaymentAllocationMethod = 'OldestBillFirst' | 'SelectedBillOnly' | 'HighestOverdueFirst' | 'ManualAllocation';
export type CreditorAgeingBucket = 'Current' | 'Days1To30' | 'Days31To60' | 'Days61To90' | 'Days91To120' | 'Days120Plus';
export type COGSReserveMovementType = 'OpeningReserve' | 'COGSRecoveredFromSale' | 'SupplierPayment' | 'StockPurchaseCash' | 'StockPurchaseCreditSettlement' | 'ReserveAdjustment' | 'ReserveLeakage' | 'ReserveRelease' | 'ReserveProtectionCorrection';
export type COGSReserveMovementDirection = 'In' | 'Out' | 'Neutral';
export type COGSReserveStatus = 'Healthy' | 'Watch' | 'Low' | 'Critical' | 'Overdrawn';

export interface SupplierCreditProfile {
  supplierId: string;
  supplierName: string;
  supplierCode: string;
  creditStatus: SupplierCreditStatus;
  paymentTermsDays: number;
  supplierCreditLimit: number;
  currentPayableBalance: number;
  overduePayableBalance: number;
  availableSupplierCredit: number;
  averageDaysToPay: number;
  latePaymentCount: number;
  disputedAmount: number;
  preferredSupplier: boolean;
  blockedReason?: string;
  lastPaymentDate?: string;
  nextReviewDate?: string;
  notes: string;
  updatedAt: string;
}

export interface SupplierBill {
  billId: string;
  billNumber: string;
  supplierId: string;
  supplierName: string;
  supplierInvoiceNumber: string;
  purchaseOrderId?: string;
  purchaseOrderNumber?: string;
  grnId?: string;
  grnNumber?: string;
  billDate: string;
  dueDate: string;
  originalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  vatAmount?: number;
  currency: string;
  status: SupplierBillStatus;
  ageingBucket: CreditorAgeingBucket;
  overdueDays: number;
  branchId: string;
  warehouseId?: string;
  createdBy: string;
  createdAt: string;
  postedAt?: string;
  notes: string;
}

export interface SupplierPayment {
  paymentId: string;
  paymentNumber: string;
  supplierId: string;
  supplierName: string;
  paymentDate: string;
  amount: number;
  paymentMethod: string;
  paymentReference: string;
  source: 'COGSReserve' | 'CashDrawer' | 'BankPlaceholder' | 'MobileMoneyPlaceholder' | 'OwnerFundsPlaceholder' | 'Mixed';
  cogsReserveAmount: number;
  nonReserveAmount: number;
  status: SupplierPaymentStatus;
  approvedBy?: string;
  approvedAt?: string;
  paidBy?: string;
  paidAt?: string;
  notes: string;
}

export interface SupplierPaymentAllocation {
  allocationId: string;
  paymentId: string;
  supplierId: string;
  billId: string;
  billNumber: string;
  allocatedAmount: number;
  allocationMethod: SupplierPaymentAllocationMethod;
  allocatedBy: string;
  allocatedAt: string;
  notes: string;
}

export interface COGSReserveMovement {
  movementId: string;
  movementNumber: string;
  movementDate: string;
  type: COGSReserveMovementType;
  direction: COGSReserveMovementDirection;
  amount: number;
  sourceReferenceType: 'Sale' | 'SupplierBill' | 'SupplierPayment' | 'GRN' | 'PurchaseOrder' | 'ManualAdjustment' | 'CashControl';
  sourceReferenceId: string;
  sourceReferenceNumber: string;
  saleId?: string;
  supplierId?: string;
  supplierName?: string;
  branchId?: string;
  terminalId?: string;
  staffId: string;
  staffName: string;
  reserveBalanceAfter: number;
  protected: boolean;
  requiresApproval: boolean;
  notes: string;
  createdAt: string;
}

export interface COGSReserveSummary {
  openingReserve: number;
  recoveredFromSales: number;
  usedForSupplierPayments: number;
  usedForCashStockPurchases: number;
  adjustments: number;
  leakage: number;
  currentReserveBalance: number;
  requiredReserveLevel: number;
  reserveShortfall: number;
  reserveStatus: COGSReserveStatus;
  reserveCoveragePercent: number;
  lastUpdatedAt: string;
}

export interface SupplierStatementRecord {
  statementId: string;
  supplierId: string;
  supplierName: string;
  periodFrom: string;
  periodTo: string;
  openingBalance: number;
  bills: SupplierBill[];
  payments: SupplierPayment[];
  supplierReturns: Array<{ reference: string; date: string; amount: number; notes: string }>;
  creditNotes: Array<{ reference: string; date: string; amount: number; notes: string }>;
  closingBalance: number;
  generatedBy: string;
  generatedAt: string;
}

export interface CreditorRiskItem {
  supplierId: string;
  supplierName: string;
  outstandingAmount: number;
  overdueAmount: number;
  ageingBucket: CreditorAgeingBucket;
  supplierCreditLimitUsagePercent: number;
  daysSinceLastPayment: number;
  disputedAmount: number;
  riskLevel: RiskLevel;
  recommendedAction: string;
}

export type PurchaseDisciplineStatus = 'Draft' | 'RiskChecked' | 'PendingApproval' | 'Approved' | 'Rejected' | 'ConvertedToPO' | 'Cancelled' | 'Blocked';
export type PurchaseRiskLevel = 'Low' | 'Medium' | 'High' | 'Critical' | 'Blocked';
export type ReorderProtectionDecision = 'Allow' | 'Warn' | 'RequireApproval' | 'Block';
export type PurchaseCommitmentStatus = 'Draft' | 'Active' | 'LinkedToPO' | 'LinkedToGRN' | 'PartiallyFulfilled' | 'Fulfilled' | 'Cancelled' | 'Overdue';
export type PurchasePressureSignal =
  | 'COGSReserveLow'
  | 'SupplierCreditHigh'
  | 'DebtorsOverdue'
  | 'CashWeak'
  | 'DeadStock'
  | 'SlowStock'
  | 'LowMargin'
  | 'FastMovingStockout'
  | 'SupplierOverdue'
  | 'GRNPendingInvoice'
  | 'ApprovalMissing';

export interface PurchaseDisciplineRequest {
  requestId: string;
  requestNumber: string;
  productId: string;
  productName: string;
  sku: string;
  branchId: string;
  branchName: string;
  warehouseId?: string;
  supplierId?: string;
  supplierName?: string;
  requestedQty: number;
  currentStockQty: number;
  reorderLevel?: number;
  suggestedReorderQty?: number;
  estimatedUnitCost: number;
  estimatedTotalCost: number;
  expectedSellingPrice?: number;
  expectedGrossMarginAmount?: number;
  expectedGrossMarginPercent?: number;
  stockMovementClass: 'FastMoving' | 'Normal' | 'SlowMoving' | 'DeadStock' | 'NewProduct' | 'Unknown';
  requestedBy: string;
  requestedAt: string;
  reason: string;
  status: PurchaseDisciplineStatus;
  riskLevel: PurchaseRiskLevel;
  protectionDecision: ReorderProtectionDecision;
  riskScore: number;
  riskNarrative: string;
  approvalId?: string;
  linkedPurchaseOrderId?: string;
  linkedCommitmentId?: string;
  notes: string;
}

export interface PurchaseRiskAssessment {
  assessmentId: string;
  requestId: string;
  assessedAt: string;
  assessedBy: string;
  productId: string;
  supplierId?: string;
  cogsReserveBefore: number;
  cogsReserveRequired: number;
  cogsReserveAfter: number;
  reserveCoveragePercent: number;
  supplierPayableBalance: number;
  supplierCreditLimit: number;
  supplierCreditUsagePercent: number;
  overdueSupplierBills: number;
  overdueDebtorsTotal: number;
  cashAvailable: number;
  productMovementScore: number;
  productMarginScore: number;
  supplierRiskScore: number;
  cashPressureScore: number;
  debtorPressureScore: number;
  reserveRiskScore: number;
  totalRiskScore: number;
  riskLevel: PurchaseRiskLevel;
  decision: ReorderProtectionDecision;
  warnings: string[];
  recommendedAction: string;
}

export interface SupplierPurchaseCommitment {
  commitmentId: string;
  commitmentNumber: string;
  sourceRequestId?: string;
  purchaseOrderId?: string;
  grnId?: string;
  supplierId: string;
  supplierName: string;
  productId?: string;
  productName?: string;
  commitmentDate: string;
  dueDate?: string;
  amount: number;
  reserveNeeded: number;
  reserveAvailableAtCreation: number;
  status: PurchaseCommitmentStatus;
  riskLevel: PurchaseRiskLevel;
  approvedBy?: string;
  approvedAt?: string;
  createdBy: string;
  createdAt: string;
  notes: string;
}

export interface ReorderProtectionRule {
  ruleId: string;
  ruleCode: string;
  title: string;
  active: boolean;
  severity: PurchaseRiskLevel;
  threshold: number;
  decision: ReorderProtectionDecision;
  description: string;
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

export type CashMovementType =
  | 'OpeningFloat'
  | 'CashSale'
  | 'CashDebtorPayment'
  | 'CashDeliveryHandover'
  | 'CashRefund'
  | 'CashReturnRefund'
  | 'CashDrop'
  | 'DrawerExpense'
  | 'PettyCashPayout'
  | 'SupplierPayment'
  | 'CashCorrection'
  | 'CashVarianceAdjustment';

export type CashMovementDirection = 'In' | 'Out' | 'Neutral';
export type CashMovementSource = 'Sale' | 'DebtPayment' | 'Delivery' | 'Shift' | 'EOD' | 'Expense' | 'Refund' | 'SupplierPayment' | 'ManualAdjustment' | 'Recovery';
export type CashReconciliationStatus = 'Draft' | 'InProgress' | 'Balanced' | 'VarianceFound' | 'PendingReview' | 'Approved' | 'Rejected' | 'Closed';
export type CashVarianceType = 'Short' | 'Over' | 'Balanced';
export type CashEquivalencePolicy = 'PhysicalCashOnly' | 'IncludeMobileMoneyAsCashEquivalent' | 'IncludeBankTransferAsCashEquivalent' | 'IncludeCardAsCashEquivalent' | 'Custom';

export interface CashDrawerMovement {
  movementId: string;
  movementNumber: string;
  shiftId: string;
  branchId: string;
  branchName: string;
  terminalId: string;
  terminalName: string;
  drawerId: string;
  drawerName: string;
  staffId: string;
  staffName: string;
  type: CashMovementType;
  direction: CashMovementDirection;
  source: CashMovementSource;
  amount: number;
  paymentMethod: string;
  referenceId: string;
  referenceNumber: string;
  customerId?: string;
  customerName?: string;
  deliveryId?: string;
  notes: string;
  createdAt: string;
  reviewed: boolean;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface CashDrawerCountLine {
  denomination: string;
  value: number;
  count: number;
  total: number;
}

export interface CashDrawerReconciliation {
  reconciliationId: string;
  shiftId: string;
  branchId: string;
  terminalId: string;
  drawerId: string;
  openingFloat: number;
  cashSales: number;
  cashDebtorPayments: number;
  cashDeliveryHandovers: number;
  cashRefunds: number;
  drawerExpenses: number;
  pettyCashPayouts: number;
  supplierCashPayments: number;
  cashDrops: number;
  expectedCash: number;
  countedCash: number;
  variance: number;
  varianceType: CashVarianceType;
  status: CashReconciliationStatus;
  notes: string;
  preparedBy: string;
  reviewedBy?: string;
  createdAt: string;
  closedAt?: string;
}

export interface CashVarianceRecord {
  varianceId: string;
  reconciliationId: string;
  shiftId: string;
  drawerId: string;
  staffName: string;
  expectedCash: number;
  countedCash: number;
  variance: number;
  varianceType: CashVarianceType;
  status: CashReconciliationStatus;
  reviewNotes: string;
  createdAt: string;
}

export interface DrawerExpenseRecord {
  expenseId: string;
  shiftId: string;
  drawerId: string;
  amount: number;
  expenseType: string;
  reason: string;
  approvedBy?: string;
  paidTo?: string;
  notes: string;
  createdBy: string;
  createdAt: string;
  status: CashReconciliationStatus;
}

export interface CashDropRecord {
  cashDropId: string;
  shiftId: string;
  drawerId: string;
  amount: number;
  handedTo: string;
  receivedBy: string;
  reason: string;
  notes: string;
  createdBy: string;
  createdAt: string;
  status: CashReconciliationStatus;
}

export interface DebtorPaymentCashLink {
  linkId: string;
  paymentId: string;
  debtId: string;
  drawerId: string;
  shiftId: string;
  amount: number;
  cashEquivalent: boolean;
  createdAt: string;
}

export interface DeliveryCashHandoverRecord {
  handoverId: string;
  deliveryId: string;
  shiftId: string;
  drawerId: string;
  customerName: string;
  driverName: string;
  cashExpected: number;
  cashReceived: number;
  difference: number;
  handoverStatus: 'Pending' | 'Confirmed' | 'Queried' | 'Rejected';
  receivedBy: string;
  createdAt: string;
  notes: string;
}

export interface CashControlActivityEvent {
  eventId: string;
  eventType: string;
  message: string;
  shiftId?: string;
  drawerId?: string;
  staffName: string;
  createdAt: string;
}

export interface CashControlFilterState {
  shiftId?: string;
  branchId?: string;
  terminalId?: string;
  drawerId?: string;
  staffName?: string;
  dateFrom?: string;
  dateTo?: string;
  source?: CashMovementSource | 'All';
  movementType?: CashMovementType | 'All';
  status?: CashReconciliationStatus | 'All';
  cashEquivalencePolicy?: CashEquivalencePolicy;
}

export interface CashControlSummary {
  openingFloat: number;
  cashSales: number;
  cashDebtorPayments: number;
  deliveryCashHandovers: number;
  cashRefunds: number;
  drawerExpenses: number;
  pettyCashPayouts: number;
  cashDrops: number;
  expectedCash: number;
  countedCash: number;
  variance: number;
  varianceType: CashVarianceType;
  pendingReview: number;
  highRiskAlerts: number;
  debtorNonCashPayments: number;
  deliveryCashPending: number;
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
  | 'PURCHASE_DISCIPLINE'
  | 'CREDITORS'
  | 'TASK_DESK'
  | 'APPROVALS'
  | 'SHIFT'
  | 'CASH'
  | 'FINANCIAL_CONTROL'
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

export type ApprovalStatus =
  | 'Pending'
  | 'InReview'
  | 'MoreInfoRequested'
  | 'Escalated'
  | 'Approved'
  | 'Rejected'
  | 'Cancelled'
  | 'Expired'
  | 'Closed';

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
export type ApprovalPriority = 'Low' | 'Normal' | 'High' | 'Urgent';
export type ApprovalRelatedModule =
  | 'Sales'
  | 'Customer'
  | 'Inventory'
  | 'Purchasing'
  | 'Cash Control'
  | 'Delivery'
  | 'Terminal'
  | 'Accounting'
  | 'BI'
  | 'Task Desk';
export type ApprovalDecisionType = 'Approve' | 'Reject' | 'RequestInfo' | 'Escalate' | 'AssignReviewer' | 'Hold' | 'Close';
export type ApprovalNotificationChannel = 'InApp' | 'WhatsAppLink' | 'EmailPreview' | 'SMSPreview' | 'StaffInbox';
export type ApprovalNotificationStatus = 'Prepared' | 'SentLocal' | 'Read' | 'Cancelled';
export type ApprovalChatMessageType = 'Text' | 'System' | 'Decision' | 'AttachmentPlaceholder' | 'Notification';
export type OperationalApprovalEventType =
  | 'APPROVAL_CREATED'
  | 'APPROVAL_VIEWED'
  | 'APPROVAL_REVIEW_STARTED'
  | 'APPROVAL_APPROVED'
  | 'APPROVAL_REJECTED'
  | 'APPROVAL_MORE_INFO_REQUESTED'
  | 'APPROVAL_ESCALATED'
  | 'APPROVAL_REVIEWER_ASSIGNED'
  | 'APPROVAL_DECISION_FILE_OPENED'
  | 'APPROVAL_QUEUE_SEARCHED'
  | 'APPROVAL_QUEUE_FILTERED'
  | 'APPROVAL_LIVE_CHAT_OPENED'
  | 'APPROVAL_NOTIFICATION_MODAL_OPENED'
  | 'APPROVAL_QUEUE_PRINTED'
  | 'APPROVAL_QUEUE_EXPORTED'
  | 'APPROVAL_NOTIFICATION_PREPARED'
  | 'APPROVAL_NOTIFICATION_SENT_LOCAL'
  | 'APPROVAL_CHAT_MESSAGE_SENT'
  | 'APPROVAL_TASK_CREATED'
  | 'APPROVAL_BI_WARNING_CREATED'
  | 'APPROVAL_RELATED_RECORD_OPENED'
  | 'APPROVAL_PRINTED'
  | 'APPROVAL_EXPORTED'
  | 'APPROVAL_NOTE_ADDED';

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
  approvalType?: string;
  requiredPermission: 'approvals.approve' | 'approvals.reject' | 'approvals.credit.approve';
  title?: string;
  priority?: ApprovalPriority;
  assignedReviewerId?: string;
  assignedReviewerName?: string;
  reviewedAt?: string;
  decidedAt?: string;
  decisionBy?: string;
  dueAt?: string;
  relatedModule?: ApprovalRelatedModule;
  relatedRecordId?: string;
  relatedRecordLabel?: string;
  valueAmount?: number;
  currency?: string;
  customerId?: string;
  customerName?: string;
  supplierId?: string;
  supplierName?: string;
  terminalId?: string;
  notificationStatus?: ApprovalNotificationStatus;
  unreadChatCount?: number;
  conditions?: string[];
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  decisionNote?: string;
}

export interface OperationalApprovalEvent {
  id: string;
  approvalId: string;
  eventType: OperationalApprovalEventType;
  operator: string;
  message: string;
  createdAt: string;
}

export interface ApprovalNotificationRecord {
  id: string;
  approvalId: string;
  channel: ApprovalNotificationChannel;
  recipientName: string;
  recipientAddress: string;
  subject: string;
  body: string;
  status: ApprovalNotificationStatus;
  preparedBy: string;
  preparedAt: string;
  sentAt?: string;
  readAt?: string;
  waLink?: string;
}

export interface ApprovalChatMessage {
  id: string;
  approvalId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  message: string;
  messageType: ApprovalChatMessageType;
  createdAt: string;
  readByStaffIds?: string[];
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
  | 'NotAllowed'
  | 'Review'
  | 'Approved'
  | 'Suspended'
  | 'Blocked'
  | 'OverLimit'
  | 'Overdue'
  | 'Watchlist'
  | 'Cash Only'
  | 'Credit Allowed'
  | 'Credit Suspended'
  | 'Credit Review Required'
  | 'Not Applicable';

export type CreditSaleStatus =
  | 'Open'
  | 'PartiallyPaid'
  | 'Paid'
  | 'Overdue'
  | 'WrittenOff'
  | 'Disputed'
  | 'Cancelled';

export type DebtAgeingBucket =
  | 'Current'
  | 'DueSoon'
  | 'Overdue1'
  | 'Overdue2'
  | 'Overdue3'
  | 'Overdue4'
  | 'SevereOverdue';

export type CreditWorthinessGrade =
  | 'Excellent'
  | 'Good'
  | 'Fair'
  | 'Watch'
  | 'Risky'
  | 'Blocked';

export type CustomerBehaviourSegment =
  | 'New'
  | 'Repeat'
  | 'Loyal'
  | 'HighValue'
  | 'DiscountDriven'
  | 'SlowPayer'
  | 'ReturnRisk'
  | 'Dormant'
  | 'Seasonal'
  | 'CreditRisk';

export interface CustomerCreditProfile {
  customerId: string;
  creditStatus: CustomerCreditStatus;
  creditLimit: number;
  availableCredit: number;
  currentBalance: number;
  overdueBalance: number;
  paymentTermsDays: number;
  defaultAgeingIntervalConfigId: string;
  lastPaymentDate?: string;
  lastCreditSaleDate?: string;
  creditNotes: string;
  approvedBy?: string;
  approvedAt?: string;
  blockedReason?: string;
}

export interface CustomerDebtRecord {
  debtId: string;
  customerId: string;
  customerName: string;
  receiptId: string;
  receiptNumber: string;
  saleId: string;
  saleDate: string;
  saleTotal?: number;
  initialSalePaidAmount?: number;
  creditAmountCreated?: number;
  dueDate: string;
  originalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  overdueDays: number;
  ageingBucket: DebtAgeingBucket;
  status: CreditSaleStatus;
  branchId: string;
  branchName: string;
  terminalId: string;
  shiftId?: string;
  cashierStaffId: string;
  paymentTermsDays: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerDebtPayment {
  paymentId: string;
  debtId: string;
  customerId: string;
  amount: number;
  paymentMethod: PaymentMode | string;
  reference: string;
  notes: string;
  receivedByStaffId: string;
  receivedAt: string;
  branchId?: string;
  shiftId?: string;
}

export type CreditApplicationStatus = 'Draft' | 'Submitted' | 'PendingReview' | 'Approved' | 'Rejected' | 'Suspended' | 'ReviewDue';
export type CustomerCreditControlStatus = 'CashOnly' | 'CreditAllowed' | 'CreditBlocked' | 'DepositRequired' | 'Suspended' | 'ManagerApprovalRequired' | 'UnderReview';
export type PromiseToPayStatus = 'Pending' | 'Kept' | 'Broken' | 'Rescheduled' | 'Cancelled';
export type PromiseToPayMethod = 'PhoneCall' | 'WhatsApp' | 'CustomerVisit' | 'Email' | 'InPerson' | 'Other';
export type StatementAcknowledgementStatus = 'Sent' | 'Delivered' | 'Acknowledged' | 'Disputed' | 'ReconciliationRequested' | 'PaymentPromised' | 'NoResponse';
export type DebtDisputeStatus = 'Open' | 'UnderReview' | 'Resolved' | 'Rejected' | 'Escalated';
export type CollectionDiaryItemStatus = 'DueToday' | 'Pending' | 'Completed' | 'Overdue' | 'Escalated' | 'Cancelled';
export type CollectionDiaryItemType = 'PaymentDue' | 'PromiseDue' | 'BrokenPromise' | 'StatementFollowUp' | 'ManagerCall' | 'CustomerVisit' | 'DisputeFollowUp' | 'CreditReview';

export interface CustomerCreditApplication {
  applicationId: string;
  customerId: string;
  customerName: string;
  requestedCreditLimit: number;
  approvedCreditLimit: number;
  requestedPaymentTermsDays: number;
  approvedPaymentTermsDays: number;
  status: CreditApplicationStatus;
  reasonForCreditRequest: string;
  supportingNotes: string;
  guarantorName?: string;
  guarantorPhone?: string;
  contactPersonName?: string;
  contactPersonPhone?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  reviewDate?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface PromiseToPayRecord {
  promiseId: string;
  customerId: string;
  customerName: string;
  debtId?: string;
  debtReference?: string;
  promisedAmount: number;
  promisedDate: string;
  promiseMethod: PromiseToPayMethod;
  status: PromiseToPayStatus;
  capturedBy: string;
  capturedAt: string;
  followUpNote: string;
  assignedTo?: string;
  paymentId?: string;
  rescheduledFromPromiseId?: string;
  keptAt?: string;
  brokenAt?: string;
  brokenReason?: string;
  updatedAt: string;
}

export interface CustomerCreditBlockRecord {
  blockId: string;
  customerId: string;
  customerName: string;
  previousStatus: CustomerCreditStatus | CustomerCreditControlStatus;
  newStatus: CustomerCreditStatus | CustomerCreditControlStatus;
  reason: string;
  blockedBy: string;
  blockedAt: string;
  releaseRequestedBy?: string;
  releasedBy?: string;
  releasedAt?: string;
  releaseReason?: string;
  approvalId?: string;
  active: boolean;
}

export interface StatementAcknowledgementRecord {
  acknowledgementId: string;
  statementId: string;
  customerId: string;
  customerName: string;
  statementPeriodFrom: string;
  statementPeriodTo: string;
  sentVia: string;
  sentTo: string;
  status: StatementAcknowledgementStatus;
  sentBy: string;
  sentAt: string;
  acknowledgedAt?: string;
  disputeReason?: string;
  promisedPaymentAmount?: number;
  promisedPaymentDate?: string;
  notes: string;
  updatedAt: string;
}

export interface DebtDisputeRecord {
  disputeId: string;
  customerId: string;
  customerName: string;
  debtId: string;
  debtReference: string;
  disputedAmount: number;
  reason: string;
  status: DebtDisputeStatus;
  openedBy: string;
  openedAt: string;
  assignedTo?: string;
  resolutionNote?: string;
  resolvedBy?: string;
  resolvedAt?: string;
}

export interface CollectionDiaryItem {
  diaryItemId: string;
  customerId: string;
  customerName: string;
  debtId?: string;
  debtReference?: string;
  type: CollectionDiaryItemType;
  priority: RiskLevel;
  dueDate: string;
  assignedTo: string;
  status: CollectionDiaryItemStatus;
  notes: string;
  createdBy: string;
  createdAt: string;
  completedAt?: string;
  outcomeNote?: string;
}

export type DebtorOpeningBalanceStatus = 'Draft' | 'PendingApproval' | 'Approved' | 'Posted' | 'Rejected' | 'Reversed';
export type DebtPaymentAllocationMethod = 'OldestDebtFirst' | 'SelectedDebtOnly' | 'HighestOverdueFirst' | 'ManualAllocation' | 'AutoClearSmallBalances';
export type CustomerDepositStatus = 'Received' | 'PartiallyApplied' | 'FullyApplied' | 'Refunded' | 'Reversed';
export type CustomerDepositSource = 'Cash' | 'EcoCashPlaceholder' | 'InnbucksPlaceholder' | 'MukuruPlaceholder' | 'BankTransfer' | 'CardPlaceholder' | 'Other';
export type CustomerCreditNoteStatus = 'Draft' | 'PendingApproval' | 'Approved' | 'PartiallyApplied' | 'FullyApplied' | 'Cancelled' | 'Reversed';
export type BulkCollectionActionType = 'GenerateDueTodayReminders' | 'GenerateOverdueReminders' | 'PrintStatementBatch' | 'ExportDebtorsList' | 'CreateFollowUpTasks' | 'GenerateFinalNotices';
export type DebtorPeriodLockStatus = 'Open' | 'Locked' | 'UnlockRequested' | 'TemporarilyUnlocked' | 'Closed';
export type DebtorAdjustmentType = 'OpeningBalance' | 'AllocationCorrection' | 'DepositApplication' | 'CreditNoteApplication' | 'WriteOffAdjustment' | 'PeriodCorrection';

export interface DebtorOpeningBalance {
  openingBalanceId: string;
  customerId: string;
  customerName: string;
  openingReference: string;
  openingBalanceDate: string;
  originalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  dueDate: string;
  ageingBucket: DebtAgeingBucket;
  notes: string;
  status: DebtorOpeningBalanceStatus;
  importedBy: string;
  importedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  postedAt?: string;
  reversedBy?: string;
  reversedAt?: string;
  reversalReason?: string;
}

export interface DebtPaymentAllocation {
  allocationId: string;
  paymentId: string;
  customerId: string;
  debtId: string;
  debtReference: string;
  allocatedAmount: number;
  allocationMethod: DebtPaymentAllocationMethod;
  allocatedBy: string;
  allocatedAt: string;
  notes: string;
}

export interface CustomerDepositRecord {
  depositId: string;
  depositNumber: string;
  customerId: string;
  customerName: string;
  amountReceived: number;
  amountApplied: number;
  balance: number;
  source: CustomerDepositSource;
  paymentReference: string;
  receivedBy: string;
  receivedAt: string;
  status: CustomerDepositStatus;
  notes: string;
  linkedSaleId?: string;
  linkedDebtIds?: string[];
  refundedAmount?: number;
  refundedBy?: string;
  refundedAt?: string;
  refundReason?: string;
}

export interface CustomerCreditNote {
  creditNoteId: string;
  creditNoteNumber: string;
  customerId: string;
  customerName: string;
  linkedSaleId?: string;
  linkedDebtId?: string;
  reason: string;
  originalAmount: number;
  amountApplied: number;
  balance: number;
  status: CustomerCreditNoteStatus;
  createdBy: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  appliedAt?: string;
  notes: string;
}

export interface BulkCollectionBatch {
  batchId: string;
  batchNumber: string;
  actionType: BulkCollectionActionType;
  filterSummary: string;
  customerCount: number;
  debtCount: number;
  totalAmount: number;
  status: 'Preview' | 'Generated' | 'Completed' | 'Cancelled';
  generatedBy: string;
  generatedAt: string;
  completedAt?: string;
  notes: string;
}

export interface DebtorRiskHeatMapItem {
  customerId: string;
  customerName: string;
  outstandingAmount: number;
  overdueAmount: number;
  ageingBucket: DebtAgeingBucket;
  creditLimitUsagePercent: number;
  brokenPromiseCount: number;
  disputedAmount: number;
  daysSinceLastPayment: number;
  riskLevel: RiskLevel;
  recommendedAction: string;
}

export interface DebtorPeriodLock {
  periodLockId: string;
  periodStart: string;
  periodEnd: string;
  status: DebtorPeriodLockStatus;
  lockedBy?: string;
  lockedAt?: string;
  unlockRequestedBy?: string;
  unlockRequestedAt?: string;
  unlockReason?: string;
  temporaryUnlockExpiresAt?: string;
  closedBy?: string;
  closedAt?: string;
  notes: string;
}

export interface DebtorPeriodAdjustment {
  adjustmentId: string;
  periodLockId: string;
  customerId: string;
  debtId?: string;
  adjustmentType: DebtorAdjustmentType;
  amount: number;
  reason: string;
  approvalId?: string;
  createdBy: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  postedAt?: string;
}

export interface CustomerAgeingIntervalConfig {
  configId: string;
  name: string;
  currentMaxDays: number;
  bucket1From: number;
  bucket1To: number;
  bucket2From: number;
  bucket2To: number;
  bucket3From: number;
  bucket3To: number;
  bucket4From: number;
  bucket4To: number;
  severeFrom: number;
  active: boolean;
}

export interface CustomerAgeingAnalysis {
  totalCreditCustomers: number;
  totalOutstanding: number;
  current: number;
  dueSoon: number;
  overdue1: number;
  overdue2: number;
  overdue3: number;
  overdue4: number;
  severeOverdue: number;
  overdueCustomers: number;
  blockedCustomers: number;
  debts: CustomerDebtRecord[];
}

export interface CustomerCreditWorthinessScore {
  customerId: string;
  grade: CreditWorthinessGrade;
  score: number;
  reasonList: string[];
  totalPurchases: number;
  totalCreditSales: number;
  totalPaid: number;
  outstandingBalance: number;
  overdueBalance: number;
  averageDaysToPay: number;
  latePaymentCount: number;
  returnCount: number;
  discountDependenceScore: number;
  lastActivityDate: string;
  recommendedCreditLimit: number;
  recommendedAction: string;
}

export interface CustomerBuyingPreferenceProfile {
  customerId: string;
  topCategories: string[];
  topProducts: string[];
  preferredBrands: string[];
  averageBasketValue: number;
  purchaseFrequency: string;
  preferredPaymentMethod: string;
  preferredBranch: string;
  preferredSalesPeriod: string;
  priceSensitivity: string;
  lastPurchaseDate: string;
}

export interface CustomerBehaviourAnalytics {
  customerId: string;
  segment: CustomerBehaviourSegment;
  repeatPurchaseCount: number;
  daysSinceLastPurchase: number;
  totalLifetimeValue: number;
  averageBasketValue: number;
  returnRate: number;
  discountUsageRate: number;
  creditUsageRate: number;
  paymentReliabilityScore: number;
  notes: string;
}

export interface CustomerCreditActivityEvent {
  id: string;
  customerId: string;
  dateTime: string;
  eventType: string;
  user: string;
  notes: string;
  relatedRecord?: string;
}

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
    | 'CUSTOMER_SELECTED_SALES_TERMINAL_CTA_SHOWN'
    | 'CUSTOMER_SELECTED_SALES_TERMINAL_OPENED'
    | 'CUSTOMER_LOADED_FROM_CUSTOMER_CENTRE'
    | 'CUSTOMER_SELECTED_FOR_SALE_CLEARED'
    | 'CUSTOMER_NOTE_ADDED'
    | 'CUSTOMER_PURCHASE_RECORDED'
    | 'CUSTOMER_SERVICE_RISK'
    | 'CUSTOMER_CREDIT_REVIEW_REQUIRED'
    | 'CREDIT_APPLICATION_CREATED'
    | 'CREDIT_APPLICATION_SUBMITTED'
    | 'CREDIT_APPLICATION_APPROVED'
    | 'CREDIT_APPLICATION_REJECTED'
    | 'CUSTOMER_CREDIT_BLOCKED'
    | 'CUSTOMER_CREDIT_RELEASE_REQUESTED'
    | 'CUSTOMER_CREDIT_RELEASED'
    | 'CUSTOMER_SET_CASH_ONLY'
    | 'CUSTOMER_DEPOSIT_REQUIRED'
    | 'PROMISE_TO_PAY_CREATED'
    | 'PROMISE_TO_PAY_KEPT'
    | 'PROMISE_TO_PAY_BROKEN'
    | 'PROMISE_TO_PAY_RESCHEDULED'
    | 'STATEMENT_SENT'
    | 'STATEMENT_ACKNOWLEDGED'
    | 'STATEMENT_DISPUTED'
    | 'STATEMENT_PAYMENT_PROMISED'
    | 'DEBT_DISPUTE_OPENED'
    | 'DEBT_DISPUTE_RESOLVED'
    | 'COLLECTION_DIARY_ITEM_CREATED'
    | 'COLLECTION_DIARY_ITEM_COMPLETED'
    | 'COLLECTION_DIARY_ITEM_ESCALATED'
    | 'DEBTOR_OPENING_BALANCE_CREATED'
    | 'DEBTOR_OPENING_BALANCE_APPROVED'
    | 'DEBTOR_OPENING_BALANCE_POSTED'
    | 'DEBTOR_OPENING_BALANCE_REVERSED'
    | 'DEBT_PAYMENT_ALLOCATED'
    | 'DEBT_PAYMENT_ALLOCATION_REVERSED'
    | 'CUSTOMER_DEPOSIT_RECEIVED'
    | 'CUSTOMER_DEPOSIT_APPLIED_TO_SALE'
    | 'CUSTOMER_DEPOSIT_APPLIED_TO_DEBT'
    | 'CUSTOMER_DEPOSIT_REFUNDED'
    | 'CUSTOMER_CREDIT_NOTE_CREATED'
    | 'CUSTOMER_CREDIT_NOTE_APPROVED'
    | 'CUSTOMER_CREDIT_NOTE_APPLIED'
    | 'CUSTOMER_CREDIT_NOTE_CANCELLED'
    | 'BULK_COLLECTION_BATCH_CREATED'
    | 'DEBTOR_PERIOD_LOCKED'
    | 'DEBTOR_PERIOD_UNLOCK_REQUESTED'
    | 'DEBTOR_PERIOD_TEMPORARILY_UNLOCKED'
    | 'DEBTOR_PERIOD_CLOSED'
    | 'DEBTOR_PERIOD_ADJUSTMENT_CREATED';
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
  supplierBillId?: string;
  supplierBillNumber?: string;
  supplierPaymentId?: string;
  supplierPaymentNumber?: string;
  acquisitionType?: GoodsReceivingAcquisitionType;
  message: string;
}

export type GoodsReceivingAcquisitionType =
  | 'Paid Cash'
  | 'Supplier Credit'
  | 'Part Paid + Supplier Credit'
  | 'Already Invoiced'
  | 'Invoice Pending';

export type GoodsReceivingPaymentSource =
  | 'COGSReserve'
  | 'CashDrawer'
  | 'BankPlaceholder'
  | 'MobileMoneyPlaceholder'
  | 'OwnerFundsPlaceholder'
  | 'Mixed';

export interface GoodsReceivingPostOptions {
  acquisitionType: GoodsReceivingAcquisitionType;
  paidAmount?: number;
  paymentSource?: GoodsReceivingPaymentSource;
  supplierInvoiceNumber?: string;
  linkedSupplierBillId?: string;
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
  | 'GRN_SUPPLIER_BILL_CREATED'
  | 'GRN_INVOICE_PENDING_FLAGGED'
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

export type InventoryImportBatchStatus = 'Draft' | 'Mapped' | 'Validated' | 'PendingApproval' | 'Approved' | 'Posted' | 'Rejected' | 'Cancelled' | 'Failed';
export type InventoryImportFileType = 'CSV' | 'ExcelPlaceholder' | 'ManualPaste' | 'Unknown';
export type InventoryImportRowStatus = 'Ready' | 'Warning' | 'Error' | 'Duplicate' | 'Skipped' | 'Posted';
export type InventoryImportSeverity = 'Info' | 'Warning' | 'Error' | 'Critical';
export type InventoryImportAction = 'CreateNewProduct' | 'UpdateExistingProduct' | 'CreateOpeningStock' | 'UpdateStockBalance' | 'CreateSupplierPlaceholder' | 'CreateCategoryPlaceholder' | 'SkipRow' | 'NeedsReview';
export type InventoryFieldType = 'Required' | 'Recommended' | 'Optional' | 'MotorSpares' | 'Financial' | 'System';
export type InventoryImportValidationType = 'Text' | 'Number' | 'Money' | 'Quantity' | 'Date' | 'Boolean' | 'Enum' | 'Tags';
export type InventoryImportTargetDomain = 'Product' | 'Stock' | 'Supplier' | 'Pricing' | 'Tax' | 'MotorSpares' | 'Location' | 'Financial';

export interface InventoryImportFieldDefinition {
  fieldKey: string;
  fieldLabel: string;
  fieldType: InventoryFieldType;
  required: boolean;
  description: string;
  acceptedAliases: string[];
  sampleValue: string;
  validationType: InventoryImportValidationType;
  targetDomain: InventoryImportTargetDomain;
}

export interface InventoryImportColumn {
  columnIndex: number;
  columnLetter: string;
  sourceColumnName: string;
  sampleValues: string[];
  detectedFieldKey?: string;
  mappedFieldKey?: string;
  confidenceScore: number;
  ignored: boolean;
  notes: string;
}

export interface InventoryImportMappingTemplate {
  templateId: string;
  templateName: string;
  sector: string;
  description: string;
  mappings: Array<{ sourceColumnName: string; targetFieldKey: string }>;
  startRow: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  defaultTemplate: boolean;
}

export interface InventoryImportBatch {
  batchId: string;
  batchNumber: string;
  fileName: string;
  fileType: InventoryImportFileType;
  sheetName?: string;
  startRow: number;
  status: InventoryImportBatchStatus;
  templateId?: string;
  templateName?: string;
  totalRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
  duplicateRows: number;
  skippedRows: number;
  postedRows: number;
  createdBy: string;
  createdAt: string;
  submittedBy?: string;
  submittedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  postedBy?: string;
  postedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  notes: string;
}

export interface InventoryImportRowPreview {
  rowId: string;
  batchId: string;
  rowNumber: number;
  sourceData: Record<string, string>;
  mappedData: Record<string, string | number | undefined>;
  status: InventoryImportRowStatus;
  action: InventoryImportAction;
  matchedProductId?: string;
  matchedProductName?: string;
  warnings: string[];
  errors: string[];
  duplicateScore: number;
  estimatedStockValue: number;
  notes: string;
}

export interface InventoryImportValidationIssue {
  issueId: string;
  batchId: string;
  rowId?: string;
  rowNumber?: number;
  fieldKey?: string;
  severity: InventoryImportSeverity;
  code: string;
  message: string;
  recommendedAction: string;
  createdAt: string;
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
  | 'CASH_VARIANCE_REVIEW_OPENED'
  | 'CASH_VARIANCE_MARKED_REVIEWED'
  | 'CASH_RECONCILIATION_MARKED_BALANCED'
  | 'CASH_RECONCILIATION_OWNER_NOTE_ADDED'
  | 'CASH_RECONCILIATION_BI_WARNING_CREATED'
  | 'CASH_RECONCILIATION_ESCALATED'
  | 'CASH_RECONCILIATION_PRINTED'
  | 'CASH_RECONCILIATION_EXPORTED'
  | 'EOD_READINESS_CHECK_VIEWED'
  | 'EOD_READINESS_MARKED_READY'
  | 'EOD_READINESS_MARKED_NOT_READY'
  | 'EOD_READINESS_OWNER_NOTE_ADDED'
  | 'EOD_READINESS_BI_WARNING_CREATED'
  | 'EOD_READINESS_TASK_CREATED'
  | 'EOD_READINESS_ESCALATED'
  | 'EOD_READINESS_PRINTED'
  | 'EOD_READINESS_EXPORTED'
  | 'PAYMENT_MODE_DETAIL_VIEWED'
  | 'PAYMENT_MODE_MARKED_REVIEWED'
  | 'PAYMENT_MODE_RECONCILED'
  | 'PAYMENT_MODE_OWNER_NOTE_ADDED'
  | 'PAYMENT_MODE_BI_WARNING_CREATED'
  | 'PAYMENT_MODE_PRINTED'
  | 'PAYMENT_MODE_EXPORTED'
  | 'OWNER_DESK_PLACEHOLDER_VIEWED'
  | 'OWNER_DESK_PLACEHOLDER_UPDATED'
  | 'OWNER_DESK_TASK_CREATED'
  | 'OWNER_DESK_BI_WARNING_CREATED'
  | 'OWNER_DESK_ESCALATED'
  | 'OWNER_DESK_ROW_PRINTED'
  | 'OWNER_DESK_ROW_EXPORTED'
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
  | 'Posted Preview'
  | 'Ready for Review'
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
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  inactiveReason?: string;
}

export type FinancialControlAccountType =
  | 'Cash'
  | 'Bank'
  | 'MobileMoney'
  | 'CardControl'
  | 'ReceivablesControl'
  | 'PayablesControl'
  | 'InventoryControl'
  | 'COGSReserveControl'
  | 'VATReserveControl'
  | 'CustomerDepositControl'
  | 'SupplierDepositControl'
  | 'ExpenseControl'
  | 'RevenueControl'
  | 'ContraControl'
  | 'OwnerFundsControl'
  | 'SuspenseControl';

export type FinancialActivityType =
  | 'SaleRevenue'
  | 'SaleCashReceipt'
  | 'SaleMobileReceipt'
  | 'SaleCardReceipt'
  | 'SaleBankReceipt'
  | 'CreditSaleReceivable'
  | 'DebtorPaymentReceipt'
  | 'CustomerDepositReceived'
  | 'CustomerDepositApplied'
  | 'SupplierBillCreated'
  | 'SupplierPaymentMade'
  | 'COGSRecoveredFromSale'
  | 'COGSReserveUsed'
  | 'DrawerExpense'
  | 'CashDrop'
  | 'Refund'
  | 'Return'
  | 'CreditNoteApplied'
  | 'OpeningBalance'
  | 'InventoryAssetMovement'
  | 'VATCollected'
  | 'VATInputPlaceholder'
  | 'VATReserveMovement'
  | 'OwnerInjection'
  | 'OwnerDrawing'
  | 'Adjustment';

export type FinancialActivitySource =
  | 'SalesTerminal'
  | 'Debtors'
  | 'Creditors'
  | 'CashControl'
  | 'Inventory'
  | 'COGSReserve'
  | 'PurchaseDiscipline'
  | 'OwnerDesk'
  | 'EOD'
  | 'ManualPlaceholder';

export type CashPlanInflowType =
  | 'ActualCash'
  | 'ActualBank'
  | 'ActualMobile'
  | 'DebtorDueToday'
  | 'DebtorPromise'
  | 'ExpectedDebtorPayment'
  | 'OwnerInjectionPlaceholder'
  | 'DepositExpected'
  | 'OtherExpected';

export type CashPlanOutflowType =
  | 'SupplierPaymentDue'
  | 'SupplierPaymentOverdue'
  | 'DrawerExpensePlanned'
  | 'PurchaseCommitment'
  | 'COGSReserveRequirement'
  | 'VATReserveRequirement'
  | 'RefundExpected'
  | 'DeliveryCashSettlement'
  | 'OwnerDrawingRequest'
  | 'OtherPlanned';

export type CashPlanConfidence = 'Confirmed' | 'High' | 'Medium' | 'Low' | 'Risky' | 'Disputed';
export type FinancialDecisionStatus = 'Draft' | 'PendingOwnerDecision' | 'Approved' | 'Rejected' | 'ConvertedToTask' | 'ConvertedToApproval' | 'ExecutedBySourceModule' | 'Cancelled';
export type ProfitabilityViewMode = 'CashBasis' | 'AccrualReadiness' | 'HybridManagement';

export interface FinancialControlAccount {
  accountId: string;
  coaAccountId: string;
  accountCode: string;
  accountName: string;
  accountType: FinancialControlAccountType;
  linkedDomain: string;
  currency: string;
  openingBalance: number;
  currentBalance: number;
  restrictedBalance: number;
  availableBalance: number;
  active: boolean;
  protected: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinancialActivityRecord {
  activityId: string;
  activityNumber: string;
  activityDate: string;
  type: FinancialActivityType;
  source: FinancialActivitySource;
  sourceReferenceId: string;
  sourceReferenceNumber: string;
  description: string;
  debitAccountId?: string;
  debitAccountName?: string;
  creditAccountId?: string;
  creditAccountName?: string;
  amount: number;
  currency: string;
  cashImpact: number;
  bankImpact: number;
  reserveImpact: number;
  profitImpact: number;
  restrictedCashImpact: number;
  status: string;
  staffId?: string;
  staffName?: string;
  notes: string;
  createdAt: string;
}

export type CheckStatus = 'Draft' | 'Prepared' | 'PendingApproval' | 'Approved' | 'PrintedPreview' | 'IssuedLocal' | 'Voided' | 'Cancelled';
export type CheckPayeeType = 'Supplier' | 'Customer' | 'Staff' | 'ExpenseVendor' | 'Owner' | 'Other';
export type CheckPaymentPurpose =
  | 'SupplierPayment'
  | 'DrawerExpense'
  | 'PettyCash'
  | 'Refund'
  | 'OwnerDrawing'
  | 'OperatingExpense'
  | 'CustomerDepositRefund'
  | 'COGSReserveUse'
  | 'Other';
export type JournalEntryStatus = 'Draft' | 'Balanced' | 'OutOfBalance' | 'PendingReview' | 'ApprovedPreview' | 'PostedPreview' | 'Voided' | 'Cancelled';
export type JournalEntryType =
  | 'General'
  | 'Adjustment'
  | 'AccrualReadiness'
  | 'Reclassification'
  | 'OpeningBalance'
  | 'COGSReserveAdjustment'
  | 'VATReserveAdjustment'
  | 'InventoryValueAdjustment'
  | 'DebtorAdjustment'
  | 'CreditorAdjustment'
  | 'CashbookAdjustment';

export interface CheckWriterSettings {
  settingsId: string;
  chequePrefix: string;
  nextChequeNumber: number;
  chequeNumberPadding: number;
  defaultBankAccountId?: string;
  requireApprovalAboveAmount: boolean;
  approvalThresholdAmount: number;
  allowManualChequeNumber: boolean;
  printBusinessName: boolean;
  printPayeeLine: boolean;
  printAmountInWords: boolean;
  printMemo: boolean;
  updatedBy: string;
  updatedAt: string;
}

export interface PayeeRecord {
  payeeId: string;
  payeeCode: string;
  payeeName: string;
  payeeType: CheckPayeeType;
  linkedSupplierId?: string;
  linkedCustomerId?: string;
  linkedStaffId?: string;
  phone?: string;
  email?: string;
  address?: string;
  defaultCOAAccountId?: string;
  defaultPaymentPurpose?: CheckPaymentPurpose;
  active: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface CheckWriterRecord {
  checkId: string;
  checkNumber: string;
  checkDate: string;
  payeeId: string;
  payeeName: string;
  payeeType: CheckPayeeType;
  amount: number;
  amountInWords: string;
  currency: string;
  bankAccountId: string;
  bankAccountName: string;
  creditAccountId: string;
  creditAccountName: string;
  debitAccountId: string;
  debitAccountName: string;
  paymentPurpose: CheckPaymentPurpose;
  linkedModule?: string;
  linkedRecordId?: string;
  memo: string;
  status: CheckStatus;
  approvalId?: string;
  printedAt?: string;
  issuedBy?: string;
  issuedAt?: string;
  voidedBy?: string;
  voidedAt?: string;
  voidReason?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface JournalEntryLine {
  lineId: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  description: string;
  debit: number;
  credit: number;
  linkedDomain?: string;
  linkedRecordId?: string;
}

export interface JournalEntryRecord {
  journalId: string;
  journalNumber: string;
  journalDate: string;
  journalType: JournalEntryType;
  description: string;
  reference: string;
  lines: JournalEntryLine[];
  totalDebit: number;
  totalCredit: number;
  difference: number;
  balanced: boolean;
  status: JournalEntryStatus;
  approvalId?: string;
  preparedBy: string;
  preparedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  postedPreviewBy?: string;
  postedPreviewAt?: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinancialPositionSummary {
  totalCashOnHand: number;
  totalBankBalancePlaceholder: number;
  totalMobileMoneyPlaceholder: number;
  totalCardControlPlaceholder: number;
  grossCashPosition: number;
  lessCOGSReserve: number;
  lessVATReserve: number;
  lessCustomerDeposits: number;
  lessCommittedSupplierPayments: number;
  freeUsableCash: number;
  debtorsOutstanding: number;
  creditorsOutstanding: number;
  purchaseCommitments: number;
  reserveShortfall: number;
  netControlPosition: number;
  generatedAt: string;
}

export interface CashPlanForecast {
  forecastId: string;
  periodFrom: string;
  periodTo: string;
  openingCashPosition: number;
  confirmedInflows: number;
  expectedInflows: number;
  riskyInflows: number;
  confirmedOutflows: number;
  plannedOutflows: number;
  reserveRequirements: number;
  supplierPaymentPressure: number;
  debtorCollectionExpectation: number;
  projectedFreeCash: number;
  projectedReserveShortfall: number;
  projectedCashGap: number;
  confidence: CashPlanConfidence;
  recommendedOwnerAction: string;
  generatedAt: string;
}

export interface CashPlanLine {
  lineId: string;
  forecastId: string;
  date: string;
  type: 'Inflow' | 'Outflow';
  inflowType?: CashPlanInflowType;
  outflowType?: CashPlanOutflowType;
  description: string;
  sourceReferenceId?: string;
  sourceReferenceNumber?: string;
  amount: number;
  confidence: CashPlanConfidence;
  includedInFreeCash: boolean;
  restricted: boolean;
  notes: string;
}

export interface ProfitabilitySummary {
  periodFrom: string;
  periodTo: string;
  grossSales: number;
  discounts: number;
  returns: number;
  netSales: number;
  cogs: number;
  grossProfit: number;
  operatingExpenses: number;
  drawerExpenses: number;
  deliveryCosts: number;
  cashShortages: number;
  adjustments: number;
  netOperatingProfit: number;
  cashSales: number;
  creditSales: number;
  debtorCollections: number;
  cashProfitIndicator: number;
  accrualProfitIndicator: number;
  grossMarginPercent: number;
  netMarginPercent: number;
  generatedAt: string;
}

export interface OwnerFinancialDecision {
  decisionId: string;
  decisionNumber: string;
  decisionDate: string;
  decisionType: 'PaySupplier' | 'HoldSupplierPayment' | 'ProtectReserve' | 'ChaseDebtor' | 'BlockExpense' | 'ApproveExpense' | 'DelayPurchase' | 'ApprovePurchase' | 'InjectOwnerFunds' | 'ReduceDrawings' | 'Other';
  title: string;
  narrative: string;
  amount: number;
  sourceModule: FinancialActivitySource;
  sourceReferenceId?: string;
  riskLevel: RiskLevel;
  recommendedAction: string;
  status: FinancialDecisionStatus;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  executionNote?: string;
  createdAt: string;
}

export type TaskStatus =
  | 'Open'
  | 'InReview'
  | 'PendingInfo'
  | 'Escalated'
  | 'WaitingApproval'
  | 'Completed'
  | 'Closed'
  | 'Cancelled'
  | 'Overdue';

export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Critical';

export type TaskSourceModule =
  | 'Customer Centre'
  | 'Sales History'
  | 'Sales Terminal'
  | 'Inventory'
  | 'Stocktake Desk'
  | 'Delivery Desk'
  | 'Cash Control'
  | 'Owner Desk'
  | 'Task Desk'
  | 'Accounting Desk'
  | 'Debtors'
  | 'Creditors'
  | 'COGS Reserve'
  | 'Purchase Discipline'
  | 'BI Desk'
  | 'Approvals'
  | 'Settings'
  | 'Sync Desk';

export type TaskActionType =
  | 'Review'
  | 'Approve'
  | 'FollowUp'
  | 'Investigate'
  | 'Reconcile'
  | 'CollectPayment'
  | 'ContactCustomer'
  | 'ContactSupplier'
  | 'VerifyDelivery'
  | 'CheckStock'
  | 'ResolveVariance'
  | 'AccountingReview'
  | 'OwnerDecision';

export type TaskActivityEventType =
  | 'TASK_CREATED'
  | 'TASK_VIEWED'
  | 'TASK_REVIEW_STARTED'
  | 'TASK_NOTE_ADDED'
  | 'TASK_REASSIGNED'
  | 'TASK_MARKED_PENDING_INFO'
  | 'TASK_ESCALATED'
  | 'TASK_APPROVAL_CREATED'
  | 'TASK_BI_WARNING_CREATED'
  | 'TASK_COMPLETED'
  | 'TASK_CLOSED'
  | 'TASK_CANCELLED'
  | 'TASK_PRINTED'
  | 'TASK_EXPORTED'
  | 'TASK_RELATED_RECORD_OPENED';

export interface TaskActivityEvent {
  eventId: string;
  taskId: string;
  taskNumber: string;
  eventType: TaskActivityEventType;
  message: string;
  staffId: string;
  staffName: string;
  createdAt: string;
}

export interface TaskRecord {
  taskId: string;
  taskNumber: string;
  title: string;
  actionType: TaskActionType;
  assignedStaffId: string;
  assignedStaffName: string;
  priority: TaskPriority;
  relatedModule: TaskSourceModule;
  relatedRecordId: string;
  relatedRecordLabel: string;
  dueTime: string;
  dueDate: string;
  status: TaskStatus;
  description: string;
  notes: string;
  createdBy: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  closedAt?: string;
  escalatedAt?: string;
  outcomeNote?: string;
  linkedBIAdviceId?: string;
  linkedApprovalId?: string;
  linkedCustomerId?: string;
  linkedSupplierId?: string;
  auditEvents: TaskActivityEvent[];
}

export interface TaskFilterState {
  search?: string;
  assignedStaffName?: string;
  priority?: TaskPriority | 'All';
  relatedModule?: TaskSourceModule | 'All';
  status?: TaskStatus | 'All';
  dueDateFrom?: string;
  dueDateTo?: string;
  overdueOnly?: boolean;
  criticalOnly?: boolean;
}

export interface TaskSummary {
  totalTasks: number;
  open: number;
  inReview: number;
  pendingInfo: number;
  escalated: number;
  dueToday: number;
  overdue: number;
  critical: number;
  completedToday: number;
  closedToday: number;
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
  settlementStatus: 'Settled' | 'Pending' | 'Variance' | 'Under Review';
  variance: number | 'Pending';
  postingStatus: PostingStatus;
  settlementDate?: string;
  settlementReference?: string;
  settledBy?: string;
  ownerNote?: string;
  varianceType?: string;
  riskLevel?: RiskLevel;
  assignedTo?: string;
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
  | 'COA_ACCOUNT_VIEWED'
  | 'COA_ACCOUNT_DRAFT_EDITED'
  | 'COA_ACCOUNT_MARKED_INACTIVE'
  | 'COA_ACCOUNT_REACTIVATED'
  | 'COA_ACCOUNT_OWNER_NOTE_ADDED'
  | 'COA_ACCOUNT_DETAIL_PRINTED'
  | 'COA_ACCOUNT_ROW_EXPORTED'
  | 'COA_ACCOUNT_REPLACEMENT_CREATED'
  | 'SALES_POSTING_REVIEWED'
  | 'SALES_POSTING_DETAIL_VIEWED'
  | 'SALES_POSTING_MARKED_REVIEWED'
  | 'SALES_POSTING_MARKED_POSTED_PREVIEW'
  | 'SALES_POSTING_ISSUE_FLAGGED'
  | 'SALES_POSTING_TASK_CREATED'
  | 'SALES_POSTING_BI_WARNING_CREATED'
  | 'PAYMENT_POSTING_REVIEWED'
  | 'PAYMENT_MODE_MARKED_SETTLED'
  | 'PAYMENT_MODE_RECEIPTS_VIEWED'
  | 'PAYMENT_MODE_VARIANCE_FLAGGED'
  | 'PAYMENT_MODE_DETAIL_VIEWED'
  | 'PAYMENT_POSTING_OWNER_NOTE_ADDED'
  | 'PAYMENT_POSTING_TASK_CREATED'
  | 'PAYMENT_POSTING_BI_WARNING_CREATED'
  | 'PAYMENT_POSTING_SUMMARY_PRINTED'
  | 'PAYMENT_POSTING_ROW_EXPORTED'
  | 'PAYMENT_SETTLEMENT_REOPENED'
  | 'CASHBOOK_DETAIL_VIEWED'
  | 'CASHBOOK_MARKED_REVIEWED'
  | 'CASHBOOK_RECONCILED_PREVIEW'
  | 'CASHBOOK_VARIANCE_FLAGGED'
  | 'CASHBOOK_OWNER_NOTE_ADDED'
  | 'VAT_DETAIL_VIEWED'
  | 'VAT_MARKED_REVIEWED'
  | 'VAT_ISSUE_FLAGGED'
  | 'VAT_RESERVE_WARNING_CREATED'
  | 'VAT_TASK_CREATED'
  | 'COGS_RESERVE_ACCOUNTING_DETAIL_VIEWED'
  | 'COGS_RESERVE_ACCOUNTING_MARKED_REVIEWED'
  | 'COGS_RESERVE_ACCOUNTING_ISSUE_FLAGGED'
  | 'COGS_RESERVE_ACCOUNTING_TASK_CREATED'
  | 'INVENTORY_ASSET_POSTING_DETAIL_VIEWED'
  | 'INVENTORY_ASSET_POSTING_MARKED_REVIEWED'
  | 'INVENTORY_ASSET_POSTING_ISSUE_FLAGGED'
  | 'INVENTORY_ASSET_POSTING_TASK_CREATED'
  | 'INVENTORY_ACCOUNTING_READINESS_CHECK_VIEWED'
  | 'INVENTORY_ACCOUNTING_READINESS_MARKED_REVIEWED'
  | 'INVENTORY_ACCOUNTING_READINESS_TASK_CREATED'
  | 'INVENTORY_ACCOUNTING_READINESS_BI_CREATED'
  | 'ACCOUNTING_READINESS_DOMAIN_VIEWED'
  | 'ACCOUNTING_READINESS_MARKED_REVIEWED'
  | 'ACCOUNTING_READINESS_TASK_CREATED'
  | 'ACCOUNTING_READINESS_BI_CREATED'
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
  creditDetails?: {
    paymentType: 'Account / Credit';
    paidAmount: number;
    balanceDue: number;
    dueDate: string;
    creditTermsDays: number;
    outstandingAccountBalance: number;
    reminderNote: string;
  };
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
