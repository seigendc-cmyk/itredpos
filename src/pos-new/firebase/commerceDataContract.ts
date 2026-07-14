export type CommerceSourceApp =
  | 'ITRED_POS'
  | 'ITRED_CONSOLE'
  | 'ITRED_DISCOVERY'
  | 'MARKETSPACE'
  | 'IDELIVER'
  | 'CASHPLAN'
  | 'POOLWISE'
  | 'SYSTEM';

export interface TenantScope {
  vendorId: string;
  branchId?: string;
  warehouseId?: string;
  terminalId?: string;
}

export interface CommerceAuditFields {
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  sourceApp: CommerceSourceApp;
}

export interface CommerceDocumentIdentity {
  vendorId: string;
  branchId?: string;
  terminalId?: string;
  staffId?: string;
}

export interface SharedCommerceDocument
  extends CommerceDocumentIdentity,
    CommerceAuditFields {
  sciId: string;
  schemaVersion: number;
  status: string;
  lastSyncAt?: string;
}

export const COMMERCE_SCHEMA_VERSION = 1 as const;

export interface SharedVendorAppAccessRecord {
  vendorId: string;
  appCode: string;
  enabled: boolean;
  planCode: string;
  licenseStatus: string;
  activatedAt: string;
  expiresAt: string;
  featureFlags: Record<string, unknown>;
  schemaVersion: number;
  sourceApp: CommerceSourceApp;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface SharedVendorRecord extends SharedCommerceDocument {
  vendorId: string;
  vendorName: string;
  status: string;
  legalName?: string;
  tradingName?: string;
  registrationNumber?: string;
  taxNumber?: string;
  phone?: string;
  email?: string;
  website?: string;
  physicalAddress?: string;
  city?: string;
  province?: string;
  country?: string;
  currency?: string;
  timezone?: string;
  logoUrl?: string;
  receiptHeader?: string;
  businessSector?: string;
}

export interface SharedBranchRecord extends SharedCommerceDocument {
  vendorId: string;
  branchId: string;
  branchName: string;
  status: string;
}

export interface SharedWarehouseRecord extends SharedCommerceDocument {
  vendorId: string;
  warehouseId: string;
  branchId?: string;
  warehouseName: string;
  status: string;
}

export interface SharedTerminalRecord extends SharedCommerceDocument {
  vendorId: string;
  branchId: string;
  terminalId: string;
  terminalName: string;
  status: string;
}

export interface SharedProductRecord extends SharedCommerceDocument {
  vendorId: string;
  productId: string;
  sciId: string;
  sku: string;
  numericNo?: string;
  alu?: string;
  barcode?: string;
  productName: string;
  description?: string;
  industrialSector?: string;
  category?: string;
  subcategory?: string;
  brand?: string;
  unitOfMeasure: string;
  purchaseUnit?: string;
  salesUnit?: string;
  costPrice?: number;
  sellingPrice?: number;
  wholesalePrice?: number;
  taxable?: boolean;
  vatRatePct?: number;
  status: string;
  marketplaceVisible?: boolean;
  catalogueVisible?: boolean;
  schemaVersion: number;
  sourceApp: CommerceSourceApp;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  lastSyncAt?: string;
}

export type SharedInventoryMovementType =
  | 'OPENING_BALANCE'
  | 'GOODS_RECEIVED'
  | 'SALE_ISSUE'
  | 'SALE_RETURN'
  | 'STOCK_ADJUSTMENT_IN'
  | 'STOCK_ADJUSTMENT_OUT'
  | 'TRANSFER_OUT'
  | 'TRANSFER_IN'
  | 'STOCKTAKE_GAIN'
  | 'STOCKTAKE_LOSS'
  | 'PRODUCT_TRANSFORMATION_INPUT'
  | 'PRODUCT_TRANSFORMATION_OUTPUT'
  | 'SUPPLIER_RETURN'
  | 'DELIVERY_RETURN'
  | 'MANUAL_CORRECTION'
  | 'RESERVATION'
  | 'RELEASE';

export interface SharedInventoryBalanceRecord extends SharedCommerceDocument {
  balanceId: string;
  branchId: string;
  productId: string;
  warehouseId?: string;
  shelfLocation?: string;
  quantityOnHand: number;
  quantityReserved: number;
  quantityInTransit: number;
  quantityAvailable: number;
  averageCost: number;
  stockValue: number;
  lastMovementId?: string;
  lastMovementAt?: string;
  syncStatus: string;
}

export interface SharedInventoryMovementRecord extends SharedCommerceDocument {
  movementId: string;
  branchId: string;
  productId: string;
  warehouseId?: string;
  movementType: SharedInventoryMovementType;
  quantityDelta: number;
  quantityBefore: number;
  quantityAfter: number;
  unitCost?: number;
  valueImpact?: number;
  referenceType: string;
  referenceId: string;
  actorId: string;
  correlationId: string;
}

export interface SharedCustomerRecord extends SharedCommerceDocument {
  vendorId: string;
  customerId: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  businessName?: string;
  phone?: string;
  whatsappNumber?: string;
  email?: string;
  nationalId?: string;
  taxNumber?: string;
  customerType?: string;
  creditAllowed?: boolean;
  creditLimit?: number;
  paymentTermsDays?: number;
  firstTransactionAt?: string;
  lastTransactionAt?: string;
  orderCount?: number;
  lifetimeValue?: number;
}

export interface SharedCustomerAddressRecord {
  addressId: string;
  vendorId: string;
  customerId: string;
  label?: string;
  addressLine1: string;
  addressLine2?: string;
  suburb?: string;
  city?: string;
  province?: string;
  country: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  isDefaultBilling?: boolean;
  isDefaultDelivery?: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface SharedCustomerInteractionRecord {
  interactionId: string;
  vendorId: string;
  customerId: string;
  interactionType: string;
  channel: string;
  subject?: string;
  notes?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  staffId?: string;
  actorId: string;
  sourceApp: CommerceSourceApp;
  createdAt: string;
  schemaVersion: number;
}

export interface SharedCustomerRequestRecord {
  requestId: string;
  vendorId: string;
  customerId?: string;
  requestType: string;
  title: string;
  description?: string;
  status: string;
  priority?: string;
  relatedProductId?: string;
  relatedSaleId?: string;
  relatedDeliveryId?: string;
  assignedStaffId?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface SharedMarketplaceListingRecord extends SharedCommerceDocument {
  vendorId: string;
  listingId: string;
  productId: string;
  branchId?: string;
  title: string;
  description?: string;
  price: number;
  currency: string;
}

export interface SharedMarketplaceOrderRecord extends SharedCommerceDocument {
  vendorId: string;
  orderId: string;
  customerId?: string;
  customerName?: string;
  total: number;
  currency: string;
}

export interface SharedBIEventRecord {
  eventId: string;
  eventType: string;
  vendorId: string;
  branchId: string;
  warehouseId?: string;
  productId?: string;
  terminalId: string;
  staffId: string;
  sourceApp: CommerceSourceApp;
  entityType: string;
  entityId: string;
  timestamp: string;
  correlationId?: string;
  severity: string;
  actionRequired: boolean;
  metadata: Record<string, unknown>;
  schemaVersion?: number;
}

export interface SharedAuditRecord {
  vendorId: string;
  branchId: string;
  terminalId: string;
  staffId: string;
  actorId: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
  reason: string;
  sourceApp: CommerceSourceApp;
  createdAt: string;
  correlationId?: string;
}
