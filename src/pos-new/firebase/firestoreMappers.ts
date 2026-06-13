import type {
  FirestoreAccountingReadinessDoc,
  FirestoreApprovalDoc,
  FirestoreCustomerDoc,
  FirestoreDeliveryRequestDoc,
  FirestoreGoodsReceivingDoc,
  FirestoreInventoryMovementDoc,
  FirestoreJsonRecord,
  FirestoreOfflineSyncQueueDoc,
  FirestoreProductMasterDoc,
  FirestoreProductStockBalanceDoc,
  FirestorePurchaseOrderDoc,
  FirestoreSalesReceiptDoc
} from './firestoreContracts';
import { sanitizeDocId } from './firestoreIds';
import { nowIso, toFirestoreDateValue } from './firestoreTime';

export type AppModel = Record<string, unknown>;

const stringValue = (value: unknown, fallback = ''): string => typeof value === 'string' && value.trim() ? value : fallback;
const numberValue = (value: unknown, fallback = 0): number => typeof value === 'number' && Number.isFinite(value) ? value : Number(value) || fallback;
const recordValue = (value: unknown): FirestoreJsonRecord => value && typeof value === 'object' && !Array.isArray(value) ? value as FirestoreJsonRecord : {};

function withBase<T extends AppModel>(input: T, entityId: string): AppModel {
  const createdAt = toFirestoreDateValue(input.createdAt as string | undefined);
  return {
    ...input,
    id: sanitizeDocId(stringValue(input.id, entityId)),
    vendorId: stringValue(input.vendorId, 'UNSCOPED_VENDOR'),
    createdAt,
    updatedAt: toFirestoreDateValue(input.updatedAt as string | undefined || nowIso()),
    schemaVersion: numberValue(input.schemaVersion, 1),
    syncVersion: numberValue(input.syncVersion, 1),
    deleted: Boolean(input.deleted),
    deletedAt: input.deletedAt ? toFirestoreDateValue(input.deletedAt as string) : undefined
  };
}

function fromFirestore<TDoc extends AppModel>(doc: TDoc): AppModel {
  return { ...doc };
}

export function productMasterToFirestore(product: AppModel): FirestoreProductMasterDoc {
  const productId = stringValue(product.productId, stringValue(product.id, stringValue(product.sku, 'product')));
  return {
    ...withBase(product, productId),
    productId,
    sku: stringValue(product.sku, stringValue(product.code)),
    barcode: stringValue(product.barcode),
    alu: stringValue(product.alu),
    productName: stringValue(product.productName, stringValue(product.name, 'Unnamed Product')),
    brand: stringValue(product.brand),
    manufacturer: stringValue(product.manufacturer),
    industrialSector: stringValue(product.industrialSector),
    category: stringValue(product.category, stringValue(product.productCategory)),
    status: stringValue(product.status, 'Active')
  } as FirestoreProductMasterDoc;
}

export function productMasterFromFirestore(doc: FirestoreProductMasterDoc): AppModel {
  return fromFirestore(doc);
}

export function stockBalanceToFirestore(balance: AppModel): FirestoreProductStockBalanceDoc {
  const balanceId = stringValue(balance.balanceId, stringValue(balance.id, `${stringValue(balance.productId, 'product')}-${stringValue(balance.branchId, 'branch')}`));
  return {
    ...withBase(balance, balanceId),
    balanceId,
    productId: stringValue(balance.productId),
    sku: stringValue(balance.sku),
    productName: stringValue(balance.productName),
    branchId: stringValue(balance.branchId),
    warehouseId: stringValue(balance.warehouseId),
    shelfLocation: stringValue(balance.shelfLocation),
    qtyOnHand: numberValue(balance.qtyOnHand),
    qtyAvailable: numberValue(balance.qtyAvailable, numberValue(balance.qtyOnHand)),
    qtyReserved: numberValue(balance.qtyReserved),
    unitOfMeasure: stringValue(balance.unitOfMeasure),
    status: stringValue(balance.status, 'Active')
  } as FirestoreProductStockBalanceDoc;
}

export function stockBalanceFromFirestore(doc: FirestoreProductStockBalanceDoc): AppModel {
  return fromFirestore(doc);
}

export function customerToFirestore(customer: AppModel): FirestoreCustomerDoc {
  const customerId = stringValue(customer.customerId, stringValue(customer.id, 'customer'));
  return {
    ...withBase(customer, customerId),
    customerId,
    customerName: stringValue(customer.customerName, stringValue(customer.name, 'Unnamed Customer')),
    phone: stringValue(customer.phone),
    email: stringValue(customer.email),
    status: stringValue(customer.status, 'Active')
  } as FirestoreCustomerDoc;
}

export function customerFromFirestore(doc: FirestoreCustomerDoc): AppModel {
  return fromFirestore(doc);
}

export function purchaseOrderToFirestore(po: AppModel): FirestorePurchaseOrderDoc {
  const poId = stringValue(po.poId, stringValue(po.id, stringValue(po.poNumber, 'po')));
  return {
    ...withBase(po, poId),
    poId,
    poNumber: stringValue(po.poNumber, poId),
    supplierId: stringValue(po.supplierId),
    supplierName: stringValue(po.supplierName, 'Unknown Supplier'),
    status: stringValue(po.status, 'Draft'),
    totalEstimate: { amount: numberValue(po.grandTotalEstimate, numberValue(po.totalEstimate)), currency: stringValue(po.currency, 'USD') }
  } as FirestorePurchaseOrderDoc;
}

export function purchaseOrderFromFirestore(doc: FirestorePurchaseOrderDoc): AppModel {
  return fromFirestore(doc);
}

export function goodsReceivingToFirestore(grn: AppModel): FirestoreGoodsReceivingDoc {
  const grnId = stringValue(grn.grnId, stringValue(grn.id, stringValue(grn.grnNumber, 'grn')));
  return {
    ...withBase(grn, grnId),
    grnId,
    grnNumber: stringValue(grn.grnNumber, grnId),
    poId: stringValue(grn.poId),
    poNumber: stringValue(grn.poNumber),
    supplierName: stringValue(grn.supplierName),
    status: stringValue(grn.status, 'Draft')
  } as FirestoreGoodsReceivingDoc;
}

export function goodsReceivingFromFirestore(doc: FirestoreGoodsReceivingDoc): AppModel {
  return fromFirestore(doc);
}

export function inventoryMovementToFirestore(movement: AppModel): FirestoreInventoryMovementDoc {
  const movementId = stringValue(movement.movementId, stringValue(movement.id, stringValue(movement.movementNumber, 'movement')));
  return {
    ...withBase(movement, movementId),
    movementId,
    movementNumber: stringValue(movement.movementNumber, movementId),
    movementType: stringValue(movement.movementType),
    productId: stringValue(movement.productId),
    sku: stringValue(movement.sku),
    quantity: numberValue(movement.quantity, numberValue(movement.qty)),
    referenceType: stringValue(movement.referenceType),
    referenceNumber: stringValue(movement.referenceNumber),
    status: stringValue(movement.status, 'Posted')
  } as FirestoreInventoryMovementDoc;
}

export function inventoryMovementFromFirestore(doc: FirestoreInventoryMovementDoc): AppModel {
  return fromFirestore(doc);
}

export function salesReceiptToFirestore(receipt: AppModel): FirestoreSalesReceiptDoc {
  const receiptId = stringValue(receipt.receiptId, stringValue(receipt.id, stringValue(receipt.receiptNumber, 'receipt')));
  return {
    ...withBase(receipt, receiptId),
    receiptId,
    receiptNumber: stringValue(receipt.receiptNumber, receiptId),
    cashierStaffId: stringValue(receipt.cashierStaffId, stringValue(receipt.staffId)),
    customerId: stringValue(receipt.customerId),
    total: { amount: numberValue(receipt.total, numberValue(receipt.grandTotal)), currency: stringValue(receipt.currency, 'USD') },
    status: stringValue(receipt.status, 'Posted')
  } as FirestoreSalesReceiptDoc;
}

export function salesReceiptFromFirestore(doc: FirestoreSalesReceiptDoc): AppModel {
  return fromFirestore(doc);
}

export function deliveryRequestToFirestore(delivery: AppModel): FirestoreDeliveryRequestDoc {
  const deliveryId = stringValue(delivery.deliveryId, stringValue(delivery.id, stringValue(delivery.deliveryNumber, 'delivery')));
  return {
    ...withBase(delivery, deliveryId),
    deliveryId,
    deliveryNumber: stringValue(delivery.deliveryNumber, deliveryId),
    receiptNumber: stringValue(delivery.receiptNumber),
    customerName: stringValue(delivery.customerName),
    status: stringValue(delivery.status, 'Draft')
  } as FirestoreDeliveryRequestDoc;
}

export function deliveryRequestFromFirestore(doc: FirestoreDeliveryRequestDoc): AppModel {
  return fromFirestore(doc);
}

export function approvalRequestToFirestore(approval: AppModel): FirestoreApprovalDoc {
  const approvalId = stringValue(approval.approvalId, stringValue(approval.id, 'approval'));
  return {
    ...withBase(approval, approvalId),
    approvalId,
    approvalType: stringValue(approval.approvalType, stringValue(approval.type, 'Approval')),
    status: stringValue(approval.status, 'Pending'),
    requestedBy: stringValue(approval.requestedBy)
  } as FirestoreApprovalDoc;
}

export function approvalRequestFromFirestore(doc: FirestoreApprovalDoc): AppModel {
  return fromFirestore(doc);
}

export function offlineQueueItemToFirestore(queueItem: AppModel): FirestoreOfflineSyncQueueDoc {
  const queueId = stringValue(queueItem.queueId, stringValue(queueItem.id, 'queue'));
  return {
    ...withBase(queueItem, queueId),
    queueId,
    entityType: stringValue(queueItem.entityType, stringValue(queueItem.domain, 'Unknown')),
    entityId: stringValue(queueItem.entityId, stringValue(queueItem.reference)),
    operationType: stringValue(queueItem.operationType, 'UPSERT'),
    status: stringValue(queueItem.status, stringValue(queueItem.syncStatus, 'Queued')),
    payload: recordValue(queueItem.payload)
  } as FirestoreOfflineSyncQueueDoc;
}

export function offlineQueueItemFromFirestore(doc: FirestoreOfflineSyncQueueDoc): AppModel {
  return fromFirestore(doc);
}

export function accountingReadinessToFirestore(record: AppModel): FirestoreAccountingReadinessDoc {
  const readinessId = stringValue(record.readinessId, stringValue(record.id, 'accounting-readiness'));
  return {
    ...withBase(record, readinessId),
    readinessId,
    sourceType: stringValue(record.sourceType, stringValue(record.sourceModule, 'Unknown')),
    sourceId: stringValue(record.sourceId, stringValue(record.referenceId)),
    status: stringValue(record.status, 'Pending'),
    readinessStatus: stringValue(record.readinessStatus)
  } as FirestoreAccountingReadinessDoc;
}

export function accountingReadinessFromFirestore(doc: FirestoreAccountingReadinessDoc): AppModel {
  return fromFirestore(doc);
}

