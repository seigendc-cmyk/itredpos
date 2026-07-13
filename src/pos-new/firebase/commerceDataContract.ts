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

export interface SharedVendorRecord extends SharedCommerceDocument {
  vendorId: string;
  vendorName: string;
  status: string;
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
  sku?: string;
  barcode?: string;
  productName: string;
  brand?: string;
  category?: string;
  status: string;
}

export interface SharedInventoryBalanceRecord extends SharedCommerceDocument {
  vendorId: string;
  balanceId: string;
  productId: string;
  warehouseId: string;
  branchId?: string;
  shelfLocation?: string;
  qtyOnHand: number;
  qtyAvailable: number;
  qtyReserved?: number;
  unitOfMeasure?: string;
}

export interface SharedInventoryMovementRecord extends SharedCommerceDocument {
  vendorId: string;
  movementId: string;
  productId: string;
  warehouseId: string;
  branchId?: string;
  movementType: string;
  qtyDelta: number;
  reason?: string;
}

export interface SharedCustomerRecord extends SharedCommerceDocument {
  vendorId: string;
  customerId: string;
  customerName: string;
  phone?: string;
  email?: string;
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
  terminalId: string;
  staffId: string;
  sourceApp: CommerceSourceApp;
  entityType: string;
  entityId: string;
  timestamp: string;
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
}
