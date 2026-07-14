export type FirestoreJsonPrimitive = string | number | boolean | null;
export type FirestoreJsonValue = FirestoreJsonPrimitive | FirestoreJsonValue[] | { [key: string]: FirestoreJsonValue };
export type FirestoreJsonRecord = { [key: string]: FirestoreJsonValue | undefined };

export type FirestoreDocumentStatus = 'Active' | 'Draft' | 'Pending' | 'Posted' | 'Cancelled' | 'Archived' | 'Deleted';

export interface FirestoreAuditFields extends FirestoreJsonRecord {
  createdAt: string;
  updatedAt: string;
  createdByStaffId?: string;
  updatedByStaffId?: string;
  terminalId?: string;
  branchId?: string;
}

export interface FirestoreDocBase extends FirestoreAuditFields {
  id: string;
  vendorId: string;
  schemaVersion: number;
  syncVersion: number;
  deleted: boolean;
  deletedAt?: string;
}

export interface FirestoreMoney extends FirestoreJsonRecord {
  amount: number;
  currency: string;
}

export interface FirestoreQuantity extends FirestoreJsonRecord {
  value: number;
  unitOfMeasure: string;
}

export interface FirestoreProductMasterDoc extends FirestoreDocBase {
  productId: string;
  sku?: string;
  barcode?: string;
  alu?: string;
  productName: string;
  brand?: string;
  manufacturer?: string;
  industrialSector?: string;
  category?: string;
  status: FirestoreDocumentStatus | string;
}

export interface FirestoreProductStockBalanceDoc extends FirestoreDocBase {
  balanceId: string;
  productId: string;
  sku?: string;
  productName?: string;
  warehouseId: string;
  shelfLocation?: string;
  qtyOnHand: number;
  qtyAvailable: number;
  qtyReserved?: number;
  unitOfMeasure?: string;
  status?: string;
}

export interface FirestoreProductImportBatchDoc extends FirestoreDocBase {
  batchId: string;
  batchNumber: string;
  source?: string;
  status: string;
  totalRows?: number;
  importedRows?: number;
}

export interface FirestoreProductImportRowDoc extends FirestoreDocBase {
  rowId: string;
  batchId: string;
  rowNumber: number;
  status: string;
  mappedProduct?: FirestoreJsonRecord;
}

export interface FirestoreCustomerDoc extends FirestoreDocBase {
  customerId: string;
  sciId: string;
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
  status: string;
  creditAllowed?: boolean;
  creditLimit?: number;
  paymentTermsDays?: number;
}

export interface FirestoreCustomerAddressDoc extends FirestoreDocBase {
  addressId: string; customerId: string; addressLine1: string; country: string; status: string;
}

export interface FirestoreCustomerInteractionDoc extends FirestoreDocBase {
  interactionId: string; customerId: string; interactionType: string; channel: string; actorId: string;
}

export interface FirestoreCustomerRequestDoc extends FirestoreDocBase {
  requestId: string; customerId?: string; requestType: string; title: string; status: string;
}

export interface FirestorePurchaseOrderDoc extends FirestoreDocBase {
  poId: string;
  poNumber: string;
  supplierId?: string;
  supplierName: string;
  status: string;
  totalEstimate?: FirestoreMoney;
}

export interface FirestorePurchaseOrderLineDoc extends FirestoreDocBase {
  lineId: string;
  poId: string;
  productId?: string;
  sku?: string;
  productName: string;
  qtyOrdered: number;
  estimatedUnitCost?: number;
}

export interface FirestoreGoodsReceivingDoc extends FirestoreDocBase {
  grnId: string;
  grnNumber: string;
  poId?: string;
  poNumber?: string;
  supplierName?: string;
  status: string;
}

export interface FirestoreGoodsReceivingLineDoc extends FirestoreDocBase {
  lineId: string;
  grnId: string;
  productId?: string;
  sku?: string;
  productName: string;
  qtyReceived: number;
}

export interface FirestoreSupplierReturnDoc extends FirestoreDocBase {
  supplierReturnId: string;
  supplierReturnNumber: string;
  supplierName?: string;
  status: string;
}

export interface FirestoreSupplierReturnLineDoc extends FirestoreDocBase {
  lineId: string;
  supplierReturnId: string;
  sku?: string;
  productName: string;
  qtyReturned: number;
}

export interface FirestoreStockAdjustmentDoc extends FirestoreDocBase {
  adjustmentId: string;
  adjustmentNumber: string;
  reason: string;
  status: string;
}

export interface FirestoreStockAdjustmentLineDoc extends FirestoreDocBase {
  lineId: string;
  adjustmentId: string;
  productId?: string;
  sku?: string;
  productName: string;
  qtyDelta: number;
}

export interface FirestoreStocktakeDoc extends FirestoreDocBase {
  stocktakeId: string;
  stocktakeNumber: string;
  scope: string;
  status: string;
}

export interface FirestoreStocktakeLineDoc extends FirestoreDocBase {
  lineId: string;
  stocktakeId: string;
  productId?: string;
  sku?: string;
  productName: string;
  systemQty: number;
  countedQty: number;
  variance: number;
}

export interface FirestoreStockTransferDoc extends FirestoreDocBase {
  transferId: string;
  transferNumber: string;
  fromBranchId?: string;
  toBranchId?: string;
  status: string;
}

export interface FirestoreStockTransferLineDoc extends FirestoreDocBase {
  lineId: string;
  transferId: string;
  productId?: string;
  sku?: string;
  productName: string;
  qtyRequested: number;
}

export interface FirestoreInventoryMovementDoc extends FirestoreDocBase {
  movementId: string;
  movementNumber: string;
  movementType: string;
  productId: string;
  sku?: string;
  quantity: number;
  referenceType?: string;
  referenceNumber?: string;
  status: string;
}

export interface FirestoreProductLedgerDoc extends FirestoreInventoryMovementDoc {
  ledgerId: string;
}

export interface FirestoreSalesReceiptDoc extends FirestoreDocBase {
  receiptId: string;
  receiptNumber: string;
  cashierStaffId?: string;
  customerId?: string;
  total: FirestoreMoney;
  status: string;
}

export interface FirestoreSalesReceiptLineDoc extends FirestoreDocBase {
  lineId: string;
  receiptId: string;
  productId?: string;
  sku?: string;
  productName: string;
  qty: number;
  lineTotal: FirestoreMoney;
}

export interface FirestorePaymentDoc extends FirestoreDocBase {
  paymentId: string;
  receiptId: string;
  paymentMethod: string;
  amount: FirestoreMoney;
  status: string;
}

export interface FirestoreDeliveryRequestDoc extends FirestoreDocBase {
  deliveryId: string;
  deliveryNumber: string;
  receiptNumber?: string;
  customerName?: string;
  status: string;
}

export interface FirestoreApprovalDoc extends FirestoreDocBase {
  approvalId: string;
  approvalType: string;
  status: string;
  requestedBy?: string;
}

export interface FirestoreTaskDoc extends FirestoreDocBase {
  taskId: string;
  title: string;
  status: string;
  assignedToStaffId?: string;
}

export interface FirestoreBIEventDoc extends FirestoreDocBase {
  eventId: string;
  eventType: string;
  severity?: string;
  message: string;
}

export interface FirestoreAuditEventDoc extends FirestoreDocBase {
  auditId: string;
  eventType: string;
  actorStaffId?: string;
  message: string;
}

export interface FirestoreOfflineSyncQueueDoc extends FirestoreDocBase {
  queueId: string;
  entityType: string;
  entityId: string;
  operationType: string;
  status: string;
  payload?: FirestoreJsonRecord;
}

export interface FirestoreSyncConflictDoc extends FirestoreDocBase {
  conflictId: string;
  queueId?: string;
  entityType: string;
  conflictType: string;
  status: string;
  recommendedResolution?: string;
}

export interface FirestoreAccountingReadinessDoc extends FirestoreDocBase {
  readinessId: string;
  sourceType: string;
  sourceId: string;
  status: string;
  readinessStatus?: string;
}

export type FirestoreContractDoc =
  | FirestoreProductMasterDoc
  | FirestoreProductStockBalanceDoc
  | FirestoreProductImportBatchDoc
  | FirestoreProductImportRowDoc
  | FirestoreCustomerDoc
  | FirestorePurchaseOrderDoc
  | FirestorePurchaseOrderLineDoc
  | FirestoreGoodsReceivingDoc
  | FirestoreGoodsReceivingLineDoc
  | FirestoreSupplierReturnDoc
  | FirestoreSupplierReturnLineDoc
  | FirestoreStockAdjustmentDoc
  | FirestoreStockAdjustmentLineDoc
  | FirestoreStocktakeDoc
  | FirestoreStocktakeLineDoc
  | FirestoreStockTransferDoc
  | FirestoreStockTransferLineDoc
  | FirestoreInventoryMovementDoc
  | FirestoreProductLedgerDoc
  | FirestoreSalesReceiptDoc
  | FirestoreSalesReceiptLineDoc
  | FirestorePaymentDoc
  | FirestoreDeliveryRequestDoc
  | FirestoreApprovalDoc
  | FirestoreTaskDoc
  | FirestoreBIEventDoc
  | FirestoreAuditEventDoc
  | FirestoreOfflineSyncQueueDoc
  | FirestoreSyncConflictDoc
  | FirestoreAccountingReadinessDoc;
