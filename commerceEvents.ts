export type CommerceEventType =
  // Sales
  | 'SaleCreated'
  | 'SaleCompleted'
  | 'SaleCancelled'
  | 'SaleRefunded'
  // Shift
  | 'ShiftOpened'
  | 'ShiftClosed'
  // Inventory
  | 'StockReceived'
  | 'StockIssued'
  | 'StockAdjusted'
  | 'StockTransferred'
  | 'StockCounted'
  | 'StockDamaged'
  | 'StockExpired'
  // Purchases
  | 'PurchaseReceived'
  // Product Transformation
  | 'TransformationCreated'
  | 'TransformationCompleted'
  | 'TransformationCancelled'
  // Delivery
  | 'DeliveryRequested'
  | 'DriverAssigned'
  | 'DriverAccepted'
  | 'PickedUp'
  | 'GPSUpdated'
  | 'Delivered'
  | 'DeliveryConfirmed'
  | 'CashCollected'
  // Discovery
  | 'CatalogueViewed'
  | 'ProductViewed'
  | 'VendorViewed'
  | 'WhatsAppClicked'
  | 'EnquiryCreated'
  // License
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
  items?: any[];
  before?: any;
  after?: any;
  metadata?: Record<string, any>;
}

export interface CommerceEvent {
  eventType: CommerceEventType;
  vendorId: string;
  branchId: string;
  staffId: string;
  terminalId: string;
  sourceApp: string;
  module: string;
  entityType: string;
  entityId: string;
  payload: CommerceEventPayload;
  riskScore: number;
  createdAt: string; // ISO 8601
}

export interface CommerceEventInput extends Omit<CommerceEvent, 'createdAt' | 'sourceApp' | 'riskScore'> {
  riskScore?: number;
}