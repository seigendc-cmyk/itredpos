export type CommerceEventType =
  | 'SaleCreated'
  | 'SaleCompleted'
  | 'SaleCancelled'
  | 'SaleRefunded'
  | 'ShiftOpened'
  | 'ShiftClosed'
  | 'StockReceived'
  | 'StockIssued'
  | 'StockAdjusted'
  | 'StockTransferred'
  | 'StockCounted'
  | 'StockDamaged'
  | 'StockExpired'
  | 'PurchaseReceived'
  | 'TransformationCreated'
  | 'TransformationCompleted'
  | 'TransformationCancelled'
  | 'DeliveryRequested'
  | 'DriverAssigned'
  | 'DriverAccepted'
  | 'PickedUp'
  | 'GPSUpdated'
  | 'Delivered'
  | 'DeliveryConfirmed'
  | 'CashCollected'
  | 'CatalogueViewed'
  | 'ProductViewed'
  | 'VendorViewed'
  | 'WhatsAppClicked'
  | 'EnquiryCreated'
  | 'LicenseActivated'
  | 'LicenseExpired'
  | 'LicenseRenewed'
  | 'TokenRedeemed';

export interface CommerceEventPayload {
  summary: string;
  amount?: number;
  quantity?: number;
  currency?: string;
  paymentMethod?: string;
  items?: unknown[];
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
}

export interface CommerceEventInput {
  eventType: CommerceEventType;
  vendorId: string;
  branchId?: string;
  warehouseId?: string;
  staffId?: string;
  customerId?: string;
  supplierId?: string;
  terminalId?: string;
  sourceApp?: string;
  sourceModule?: string;
  module?: string;
  aggregateType?: string;
  aggregateId?: string;
  entityType?: string;
  entityId?: string;
  correlationId?: string;
  causationId?: string;
  payload: CommerceEventPayload;
  riskScore?: number;
}

export interface CommerceEvent extends CommerceEventInput {
  version: number;
  sourceApp: string;
  sourceModule: string;
  aggregateType: string;
  aggregateId: string;
  correlationId: string;
  occurredAt: string;
}
