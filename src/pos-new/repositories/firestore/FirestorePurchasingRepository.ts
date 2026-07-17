import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type QuerySnapshot,
  type Transaction
} from 'firebase/firestore';
import { db, firebaseReady } from '../../firebase/firebaseApp';
import { COMMERCE_SCHEMA_VERSION } from '../../firebase/commerceDataContract';
import { encodeFirestoreId, firestorePaths } from '../../firebase/firestorePaths';
import type { GoodsReceivingLine, GoodsReceivingNote, PurchaseOrder, PurchaseOrderLine, SupplierReturn, SupplierReturnLine } from '../../types';
import type {
  CreatePurchaseOrderCommand,
  PostGoodsReceiptCommand,
  PostSupplierReturnCommand,
  PurchaseRequisition,
  PurchasingFilters,
  PurchasingRepository,
  PurchasingSupplier,
  PurchasingSupplierPayment,
  PurchasingSupplierStatement,
  SupplierInvoice,
  SupplierStatementEntry
} from '../PurchasingRepository';
import {
  assertGoodsReceipt,
  assertManagerRole,
  assertPurchaseOrder,
  assertSupplier,
  assertSupplierInvoice,
  assertSupplierReturn,
  normalizeSupplierContact,
  PurchasingValidationError
} from '../purchasingAssertions';
import { validateRepositoryOperationContext, type RepositoryOperationContext } from '../repositoryContext';
import { mapFirestoreError, REPOSITORY_ERROR_CODES, type RepositoryErrorCode } from './firestoreErrorMapper';

type Failure = { success: false; errorCode: string; errorMessage: string };
const failed = (message: string, code: RepositoryErrorCode | string = REPOSITORY_ERROR_CODES.FAILED_PRECONDITION): Failure => ({ success: false, errorCode: code, errorMessage: message });
const nowIso = (): string => new Date().toISOString();
const cleanId = (...parts: Array<string | undefined>): string => encodeFirestoreId(parts.filter(Boolean).join('_'));
const withoutUndefined = <T extends Record<string, unknown>>(value: T): Record<string, unknown> => Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));

function preflight(context: RepositoryOperationContext): Failure | null {
  try { validateRepositoryOperationContext(context); } catch (error) { return failed(error instanceof Error ? error.message : 'Invalid operation context.'); }
  return firebaseReady && db ? null : failed('Firebase is not configured or Firestore is unavailable.', REPOSITORY_ERROR_CODES.UNAVAILABLE);
}

function mappedFailure(error: unknown): Failure {
  if (error instanceof PurchasingValidationError) return failed(error.message, error.code);
  const mapped = mapFirestoreError(error);
  return failed(mapped.errorMessage, mapped.errorCode);
}

function record<T>(data: DocumentData): T {
  const mapped = { ...data } as Record<string, unknown>;
  for (const key of ['createdAt', 'updatedAt', 'approvedAt', 'rejectedAt', 'postedAt']) {
    const value = mapped[key];
    if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: unknown }).toDate === 'function') {
      mapped[key] = (value as { toDate: () => Date }).toDate().toISOString();
    }
  }
  return mapped as T;
}

function filtered<T>(snapshot: QuerySnapshot, filters?: PurchasingFilters): T[] {
  return snapshot.docs.map((row) => record<T>(row.data())).filter((row) => {
    const value = row as Record<string, unknown>;
    return (!filters?.status || value.status === filters.status || value.receivingStatus === filters.status) &&
      (!filters?.supplierId || value.supplierId === filters.supplierId) &&
      (!filters?.branchId || value.branchId === filters.branchId) &&
      (!filters?.warehouseId || value.warehouseId === filters.warehouseId);
  });
}

async function vendorList<T>(context: RepositoryOperationContext, path: string, filters?: PurchasingFilters) {
  const invalid = preflight(context); if (invalid) return { ...invalid, records: [] as T[] };
  try {
    const snapshot = await getDocs(query(collection(db!, path), where('vendorId', '==', context.vendorId)));
    return { success: true, records: filtered<T>(snapshot, filters) };
  } catch (error) { return { ...mappedFailure(error), records: [] as T[] }; }
}

async function vendorGet<T>(context: RepositoryOperationContext, path: string, label: string) {
  const invalid = preflight(context); if (invalid) return invalid;
  try {
    const snapshot = await getDoc(doc(db!, path));
    if (!snapshot.exists()) return failed(`${label} not found.`, REPOSITORY_ERROR_CODES.NOT_FOUND);
    const value = record<T & { vendorId: string }>(snapshot.data());
    if (value.vendorId !== context.vendorId) return failed(`Cross-vendor ${label.toLowerCase()} access is rejected.`, 'VENDOR_MISMATCH');
    return { success: true, data: value as T };
  } catch (error) { return mappedFailure(error); }
}

function event(transaction: Transaction, context: RepositoryOperationContext, type: string, entityType: string, entityId: string, metadata: Record<string, unknown> = {}): void {
  const id = cleanId(type, context.correlationId, entityId);
  transaction.set(doc(db!, firestorePaths.biEvents(context.vendorId), id), withoutUndefined({
    eventId: id, eventType: type, vendorId: context.vendorId, branchId: context.branchId || '', warehouseId: context.warehouseId || '',
    entityType, entityId, staffId: context.staffId || '', actorId: context.actorId, sourceApp: context.sourceApp,
    timestamp: nowIso(), correlationId: context.correlationId, schemaVersion: COMMERCE_SCHEMA_VERSION, metadata
  }));
}

function audit(transaction: Transaction, context: RepositoryOperationContext, action: string, entityType: string, entityId: string, before: unknown, after: unknown, reason = ''): void {
  const id = cleanId(action, context.correlationId, entityId);
  transaction.set(doc(db!, firestorePaths.auditLogs(context.vendorId), id), withoutUndefined({
    auditId: id, vendorId: context.vendorId, branchId: context.branchId || '', warehouseId: context.warehouseId || '',
    staffId: context.staffId || '', actorId: context.actorId, actorRole: context.actorRole || '', action, entityType, entityId,
    before, after, reason, sourceApp: context.sourceApp, correlationId: context.correlationId, createdAt: nowIso()
  }));
}

function balanceId(context: RepositoryOperationContext, branchId: string, warehouseId: string, productId: string): string {
  return cleanId(context.vendorId, branchId, warehouseId || 'NO_WAREHOUSE', productId);
}

function manager(context: RepositoryOperationContext, operation: string): Failure | null {
  try { assertManagerRole(context.actorRole, operation); return null; } catch (error) { return mappedFailure(error); }
}

export function createFirestorePurchasingRepository(): PurchasingRepository {
  const getSupplier = (context: RepositoryOperationContext, supplierId: string) => vendorGet<PurchasingSupplier>(context, firestorePaths.supplier(context.vendorId, supplierId), 'Supplier');
  const getPurchaseRequisition = (context: RepositoryOperationContext, requisitionId: string) => vendorGet<PurchaseRequisition>(context, firestorePaths.purchaseRequisition(context.vendorId, requisitionId), 'Purchase requisition');
  const getPurchaseOrder = (context: RepositoryOperationContext, poId: string) => vendorGet<PurchaseOrder>(context, firestorePaths.purchaseOrder(context.vendorId, poId), 'Purchase order');
  const getGoodsReceipt = (context: RepositoryOperationContext, grnId: string) => vendorGet<GoodsReceivingNote>(context, firestorePaths.goodsReceivingNote(context.vendorId, grnId), 'Goods receipt');
  const getSupplierInvoice = (context: RepositoryOperationContext, invoiceId: string) => vendorGet<SupplierInvoice>(context, firestorePaths.supplierInvoice(context.vendorId, invoiceId), 'Supplier invoice');
  const getSupplierReturn = (context: RepositoryOperationContext, id: string) => vendorGet<SupplierReturn>(context, firestorePaths.supplierReturn(context.vendorId, id), 'Supplier return');

  return {
    getSupplier,
    listSuppliers: (context, filters) => vendorList<PurchasingSupplier>(context, firestorePaths.suppliers(context.vendorId), filters),
    async createSupplier(context, supplier) {
      const invalid = preflight(context); if (invalid) return invalid;
      try {
        assertSupplier(supplier, context.vendorId);
        const codeMatch = await getDocs(query(collection(db!, firestorePaths.suppliers(context.vendorId)), where('supplierCode', '==', supplier.supplierCode.trim().toUpperCase())));
        if (!codeMatch.empty) return failed('Supplier code already exists.', 'DUPLICATE_SUPPLIER_CODE');
        const normalizedPhone = normalizeSupplierContact(supplier.phone);
        const normalizedEmail = normalizeSupplierContact(supplier.email);
        const warnings: string[] = [];
        if (normalizedPhone && !(await getDocs(query(collection(db!, firestorePaths.suppliers(context.vendorId)), where('normalizedPhone', '==', normalizedPhone)))).empty) warnings.push('Another supplier has the same normalized phone number.');
        if (normalizedEmail && !(await getDocs(query(collection(db!, firestorePaths.suppliers(context.vendorId)), where('normalizedEmail', '==', normalizedEmail)))).empty) warnings.push('Another supplier has the same normalized email address.');
        const value = { ...supplier, supplierCode: supplier.supplierCode.trim().toUpperCase(), normalizedPhone, normalizedEmail, status: supplier.status || 'ACTIVE', sourceApp: context.sourceApp, schemaVersion: COMMERCE_SCHEMA_VERSION, createdBy: context.actorId, updatedBy: context.actorId, createdAt: nowIso(), updatedAt: nowIso() };
        await runTransaction(db!, async (transaction) => {
          const ref = doc(db!, firestorePaths.supplier(context.vendorId, supplier.supplierId));
          if ((await transaction.get(ref)).exists()) throw new PurchasingValidationError('Supplier ID already exists.', 'DUPLICATE_SUPPLIER_ID');
          transaction.set(ref, value);
          event(transaction, context, 'SUPPLIER_CREATED', 'SUPPLIER', supplier.supplierId);
          audit(transaction, context, 'CREATE_SUPPLIER', 'SUPPLIER', supplier.supplierId, null, value);
        });
        return { success: true, data: value, warnings };
      } catch (error) { return mappedFailure(error); }
    },
    async updateSupplier(context, supplierId, changes) {
      const invalid = preflight(context); if (invalid) return invalid;
      if (changes.vendorId && changes.vendorId !== context.vendorId) return failed('Supplier vendor identity is immutable.', 'VENDOR_ID_IMMUTABLE');
      try {
        const currentResult = await getSupplier(context, supplierId); if (!currentResult.success || !currentResult.data) return currentResult;
        const current = currentResult.data;
        const next = { ...current, ...changes, supplierId, vendorId: context.vendorId, updatedAt: nowIso(), updatedBy: context.actorId };
        assertSupplier(next, context.vendorId);
        if (changes.supplierCode && changes.supplierCode !== current.supplierCode) {
          const duplicate = await getDocs(query(collection(db!, firestorePaths.suppliers(context.vendorId)), where('supplierCode', '==', changes.supplierCode.trim().toUpperCase())));
          if (duplicate.docs.some((row) => row.id !== supplierId)) return failed('Supplier code already exists.', 'DUPLICATE_SUPPLIER_CODE');
        }
        const warnings: string[] = [];
        const normalizedPhone = normalizeSupplierContact(next.phone); const normalizedEmail = normalizeSupplierContact(next.email);
        if (normalizedPhone) { const match = await getDocs(query(collection(db!, firestorePaths.suppliers(context.vendorId)), where('normalizedPhone', '==', normalizedPhone))); if (match.docs.some((row) => row.id !== supplierId)) warnings.push('Another supplier has the same normalized phone number.'); }
        if (normalizedEmail) { const match = await getDocs(query(collection(db!, firestorePaths.suppliers(context.vendorId)), where('normalizedEmail', '==', normalizedEmail))); if (match.docs.some((row) => row.id !== supplierId)) warnings.push('Another supplier has the same normalized email address.'); }
        const payload = { ...next, normalizedPhone, normalizedEmail };
        await runTransaction(db!, async (transaction) => { transaction.set(doc(db!, firestorePaths.supplier(context.vendorId, supplierId)), payload); event(transaction, context, 'SUPPLIER_UPDATED', 'SUPPLIER', supplierId); audit(transaction, context, 'UPDATE_SUPPLIER', 'SUPPLIER', supplierId, current, payload); });
        return { success: true, data: next, warnings };
      } catch (error) { return mappedFailure(error); }
    },
    async deactivateSupplier(context, supplierId) {
      const invalid = preflight(context); if (invalid) return invalid;
      try {
        const current = await getSupplier(context, supplierId); if (!current.success || !current.data) return current;
        const next = { ...current.data, status: 'INACTIVE' as const, updatedAt: nowIso(), updatedBy: context.actorId };
        await runTransaction(db!, async (transaction) => { transaction.set(doc(db!, firestorePaths.supplier(context.vendorId, supplierId)), next); event(transaction, context, 'SUPPLIER_DEACTIVATED', 'SUPPLIER', supplierId); audit(transaction, context, 'DEACTIVATE_SUPPLIER', 'SUPPLIER', supplierId, current.data, next); });
        return { success: true, data: next };
      } catch (error) { return mappedFailure(error); }
    },

    getPurchaseRequisition,
    listPurchaseRequisitions: (context, filters) => vendorList<PurchaseRequisition>(context, firestorePaths.purchaseRequisitions(context.vendorId), filters),
    async createPurchaseRequisition(context, requisition) {
      const invalid = preflight(context); if (invalid) return invalid;
      if (requisition.vendorId !== context.vendorId || !requisition.lines.length || requisition.lines.some((line) => !line.productId || line.vendorId !== context.vendorId || line.quantityRequested <= 0)) return failed('Requisition requires canonical vendor products and positive quantities.');
      try {
        const productSnapshots = await Promise.all(requisition.lines.map((line) => getDoc(doc(db!, firestorePaths.productMaster(context.vendorId), line.productId))));
        if (productSnapshots.some((snapshot) => !snapshot.exists() || (snapshot.data().vendorId && snapshot.data().vendorId !== context.vendorId))) return failed('A requisition product does not belong to this vendor.', 'PRODUCT_VENDOR_MISMATCH');
        const value = { ...requisition, status: requisition.status || 'Draft', correlationId: context.correlationId, createdBy: context.actorId, updatedBy: context.actorId, createdAt: nowIso(), updatedAt: nowIso() };
        await runTransaction(db!, async (transaction) => {
          const ref = doc(db!, firestorePaths.purchaseRequisition(context.vendorId, requisition.requisitionId));
          if ((await transaction.get(ref)).exists()) throw new PurchasingValidationError('Purchase requisition already exists.', 'DUPLICATE_REQUISITION');
          transaction.set(ref, value);
          for (const line of value.lines) transaction.set(doc(db!, firestorePaths.purchaseRequisitionLines(context.vendorId), line.lineId), line);
          event(transaction, context, 'PURCHASE_REQUISITION_CREATED', 'PURCHASE_REQUISITION', requisition.requisitionId);
          audit(transaction, context, 'CREATE_PURCHASE_REQUISITION', 'PURCHASE_REQUISITION', requisition.requisitionId, null, value);
        });
        return { success: true, data: value };
      } catch (error) { return mappedFailure(error); }
    },
    async approvePurchaseRequisition(context, requisitionId) {
      const invalid = preflight(context) || manager(context, 'Purchase requisition approval'); if (invalid) return invalid;
      try { const current = await getPurchaseRequisition(context, requisitionId); if (!current.success || !current.data) return current; if (!['Draft', 'Submitted'].includes(current.data.status)) return failed('Only draft or submitted requisitions can be approved.'); const next = { ...current.data, status: 'Approved' as const, approvedBy: context.actorId, approvedAt: nowIso(), updatedBy: context.actorId, updatedAt: nowIso() }; await runTransaction(db!, async (transaction) => { transaction.set(doc(db!, firestorePaths.purchaseRequisition(context.vendorId, requisitionId)), next); event(transaction, context, 'PURCHASE_REQUISITION_APPROVED', 'PURCHASE_REQUISITION', requisitionId); audit(transaction, context, 'APPROVE_PURCHASE_REQUISITION', 'PURCHASE_REQUISITION', requisitionId, current.data, next); }); return { success: true, data: next }; } catch (error) { return mappedFailure(error); }
    },
    async rejectPurchaseRequisition(context, requisitionId, reason) {
      const invalid = preflight(context) || manager(context, 'Purchase requisition rejection'); if (invalid) return invalid;
      if (!reason.trim()) return failed('Rejection reason is required.');
      try { const current = await getPurchaseRequisition(context, requisitionId); if (!current.success || !current.data) return current; const next = { ...current.data, status: 'Rejected' as const, rejectedBy: context.actorId, rejectedAt: nowIso(), rejectionReason: reason, updatedBy: context.actorId, updatedAt: nowIso() }; await setDoc(doc(db!, firestorePaths.purchaseRequisition(context.vendorId, requisitionId)), next); return { success: true, data: next }; } catch (error) { return mappedFailure(error); }
    },

    getPurchaseOrder,
    async listPurchaseOrders(context, filters) {
      const result = await vendorList<PurchaseOrder>(context, firestorePaths.purchaseOrders(context.vendorId), filters);
      if (result.success) {
        const today = new Date().toISOString().slice(0, 10);
        const overdue = result.records.filter((order) => order.expectedDeliveryDate && order.expectedDeliveryDate < today && !['Fully Received', 'Cancelled', 'Closed', 'Closed With Outstanding'].includes(order.status));
        await Promise.all(overdue.map(async (order) => {
          const eventId = cleanId('PURCHASE_OVERDUE', order.poId, order.expectedDeliveryDate);
          try {
            const eventRef = doc(db!, firestorePaths.biEvents(context.vendorId), eventId);
            if ((await getDoc(eventRef)).exists()) return;
            await setDoc(eventRef, {
              eventId, eventType: 'PURCHASE_OVERDUE', vendorId: context.vendorId, branchId: order.branchId, warehouseId: order.warehouseId,
              entityType: 'PURCHASE_ORDER', entityId: order.poId, actorId: context.actorId, sourceApp: context.sourceApp,
              timestamp: nowIso(), correlationId: context.correlationId, schemaVersion: COMMERCE_SCHEMA_VERSION,
              metadata: { poNumber: order.poNumber, expectedDeliveryDate: order.expectedDeliveryDate, supplierId: order.supplierId }
            } satisfies Record<string, unknown>);
          } catch { /* deterministic event already exists or BI publishing is not permitted; listing remains available */ }
        }));
      }
      return result;
    },
    async listPurchaseOrderLines(context, poId) { const invalid = preflight(context); if (invalid) return { ...invalid, records: [] }; try { const snap = await getDocs(query(collection(db!, firestorePaths.purchaseOrderLines(context.vendorId)), where('vendorId', '==', context.vendorId), where('poId', '==', poId))); return { success: true, records: snap.docs.map((row) => record<PurchaseOrderLine>(row.data())) }; } catch (error) { return { ...mappedFailure(error), records: [] }; } },
    async createPurchaseOrder(context, command: CreatePurchaseOrderCommand) {
      const invalid = preflight(context); if (invalid) return invalid;
      try {
        assertPurchaseOrder(command, context.vendorId);
        const supplier = await getSupplier(context, command.order.supplierId); if (!supplier.success) return failed('Purchase order supplier does not belong to this vendor.', 'SUPPLIER_VENDOR_MISMATCH');
        const duplicate = await getDocs(query(collection(db!, firestorePaths.purchaseOrders(context.vendorId)), where('poNumber', '==', command.order.poNumber))); if (!duplicate.empty) return failed('Purchase order number already exists.', 'DUPLICATE_PO_NUMBER');
        const products = await Promise.all(command.lines.map((line) => getDoc(doc(db!, firestorePaths.productMaster(context.vendorId), line.productId)))); if (products.some((snapshot) => !snapshot.exists() || (snapshot.data().vendorId && snapshot.data().vendorId !== context.vendorId))) return failed('A purchase order product does not belong to this vendor.', 'PRODUCT_VENDOR_MISMATCH');
        const order = { ...command.order, subtotal: command.order.subtotal ?? command.order.subtotalEstimate, taxTotal: command.order.vatTotal ?? command.order.taxEstimate, grandTotal: command.order.grandTotal ?? command.order.grandTotalEstimate, status: 'Draft' as const, createdBy: context.actorId, createdAt: nowIso(), updatedAt: nowIso() };
        await runTransaction(db!, async (transaction) => {
          const ref = doc(db!, firestorePaths.purchaseOrder(context.vendorId, order.poId)); if ((await transaction.get(ref)).exists()) throw new PurchasingValidationError('Purchase order ID already exists.', 'DUPLICATE_PO_ID');
          transaction.set(ref, order);
          for (const line of command.lines) transaction.set(doc(db!, firestorePaths.purchaseOrderLine(context.vendorId, line.lineId)), { ...line, vendorId: context.vendorId, quantityOrdered: line.qtyOrdered, quantityReceived: line.qtyReceived, unitCost: line.unitCost ?? line.estimatedUnitCost, taxAmount: line.vatAmount ?? 0, lineTotal: line.lineTotal ?? line.estimatedLineTotal });
          if (command.requisitionId) transaction.update(doc(db!, firestorePaths.purchaseRequisition(context.vendorId, command.requisitionId)), { status: 'Converted', convertedPurchaseOrderIds: [order.poId], updatedAt: nowIso(), updatedBy: context.actorId });
          event(transaction, context, 'PURCHASE_ORDER_CREATED', 'PURCHASE_ORDER', order.poId);
          audit(transaction, context, 'CREATE_PURCHASE_ORDER', 'PURCHASE_ORDER', order.poId, null, order);
        });
        return { success: true, data: order };
      } catch (error) { return mappedFailure(error); }
    },
    async approvePurchaseOrder(context, poId) {
      const invalid = preflight(context) || manager(context, 'Purchase order approval'); if (invalid) return invalid;
      try { const current = await getPurchaseOrder(context, poId); if (!current.success || !current.data) return current; if (!['Draft', 'Pending Approval'].includes(current.data.status)) return failed('Purchase order is not awaiting approval.'); const next = { ...current.data, status: 'Approved' as const, approvedBy: context.actorId, approvedByStaffId: context.actorId, approvedAt: nowIso(), updatedAt: nowIso() }; await runTransaction(db!, async (transaction) => { transaction.set(doc(db!, firestorePaths.purchaseOrder(context.vendorId, poId)), next); event(transaction, context, 'PURCHASE_ORDER_APPROVED', 'PURCHASE_ORDER', poId); audit(transaction, context, 'APPROVE_PURCHASE_ORDER', 'PURCHASE_ORDER', poId, current.data, next); }); return { success: true, data: next }; } catch (error) { return mappedFailure(error); }
    },
    async cancelPurchaseOrder(context, poId, reason) {
      const invalid = preflight(context) || manager(context, 'Purchase order cancellation'); if (invalid) return invalid;
      if (!reason.trim()) return failed('Cancellation reason is required.');
      try { const current = await getPurchaseOrder(context, poId); if (!current.success || !current.data) return current; if (['Fully Received', 'Closed', 'Cancelled'].includes(current.data.status)) return failed('This purchase order cannot be cancelled.'); const next = { ...current.data, status: 'Cancelled' as const, notes: `${current.data.notes || ''}\nCancelled: ${reason}`.trim(), updatedAt: nowIso() }; await runTransaction(db!, async (transaction) => { transaction.set(doc(db!, firestorePaths.purchaseOrder(context.vendorId, poId)), next); event(transaction, context, 'PURCHASE_ORDER_CANCELLED', 'PURCHASE_ORDER', poId); audit(transaction, context, 'CANCEL_PURCHASE_ORDER', 'PURCHASE_ORDER', poId, current.data, next, reason); }); return { success: true, data: next }; } catch (error) { return mappedFailure(error); }
    },

    getGoodsReceipt,
    listGoodsReceipts: (context, filters) => vendorList<GoodsReceivingNote>(context, firestorePaths.goodsReceivingNotes(context.vendorId), filters),
    async listGoodsReceiptLines(context, grnId) { const invalid = preflight(context); if (invalid) return { ...invalid, records: [] }; try { const snap = await getDocs(query(collection(db!, firestorePaths.goodsReceivingLines(context.vendorId)), where('grnId', '==', grnId))); return { success: true, records: snap.docs.map((row) => record<GoodsReceivingLine>(row.data())) }; } catch (error) { return { ...mappedFailure(error), records: [] }; } },
    async postGoodsReceipt(context, command: PostGoodsReceiptCommand) {
      const invalid = preflight(context); if (invalid) return invalid;
      try {
        assertGoodsReceipt(command, context.vendorId);
        const receipt = command.receipt; const lines = command.lines.filter((line) => !line.removeFromCurrentGRN && line.qtyAccepted > 0);
        const result = await runTransaction(db!, async (transaction) => {
          const receiptRef = doc(db!, firestorePaths.goodsReceivingNote(context.vendorId, receipt.grnId));
          const poRef = doc(db!, firestorePaths.purchaseOrder(context.vendorId, receipt.poId!));
          const supplierRef = doc(db!, firestorePaths.supplier(context.vendorId, receipt.supplierId));
          const receiptSnapshot = await transaction.get(receiptRef);
          const poSnapshot = await transaction.get(poRef);
          const supplierSnapshot = await transaction.get(supplierRef);
          const lineSnapshots = await Promise.all(lines.map((line) =>
            transaction.get(doc(db!, firestorePaths.purchaseOrderLine(context.vendorId, line.poLineId!)))
          ));
          const productSnapshots = await Promise.all(lines.map((line) => transaction.get(doc(db!, firestorePaths.productMaster(context.vendorId), line.productId))));
          const balanceSnapshots = await Promise.all(lines.map((line) =>
            transaction.get(doc(db!, firestorePaths.productStockBalance(context.vendorId, balanceId(context, receipt.branchId, receipt.warehouseId, line.productId))))
          ));
          if (receiptSnapshot.exists() && ['Posted', 'Partially Posted'].includes(String(receiptSnapshot.data().receivingStatus))) throw new PurchasingValidationError('Goods receipt has already been posted.', 'GRN_ALREADY_POSTED');
          if (!poSnapshot.exists() || poSnapshot.data().vendorId !== context.vendorId || !['Approved', 'Sent To Supplier', 'Partially Received'].includes(poSnapshot.data().status)) throw new PurchasingValidationError('Goods receipt requires an approved purchase order in this vendor.');
          if (!supplierSnapshot.exists() || supplierSnapshot.data().vendorId !== context.vendorId || receipt.supplierId !== poSnapshot.data().supplierId) throw new PurchasingValidationError('Goods receipt supplier does not match the purchase order.');
          if (productSnapshots.some((snapshot) => !snapshot.exists() || (snapshot.data().vendorId && snapshot.data().vendorId !== context.vendorId))) throw new PurchasingValidationError('A goods receipt product does not belong to this vendor.');
          if (lineSnapshots.some((snapshot) => !snapshot.exists())) throw new PurchasingValidationError('A purchase order line does not exist.');
          const timestamp = nowIso();
          let fullyReceived = true;
          lines.forEach((line, index) => {
            const poLine = lineSnapshots[index].data() as PurchaseOrderLine;
            const nextReceived = Number(poLine.qtyReceived || 0) + line.qtyAccepted;
            if (!command.allowOverReceipt && nextReceived > poLine.qtyOrdered) throw new PurchasingValidationError('Receipt exceeds the ordered quantity.', 'OVER_RECEIPT_NOT_AUTHORIZED');
            const outstanding = Math.max(poLine.qtyOrdered - nextReceived, 0); if (outstanding > 0) fullyReceived = false;
            transaction.update(lineSnapshots[index].ref, { qtyReceived: nextReceived, quantityReceived: nextReceived, qtyOutstanding: outstanding, lineStatus: outstanding > 0 ? 'Partially Received' : 'Fully Received' });
            const id = balanceId(context, receipt.branchId, receipt.warehouseId, line.productId); const balanceRef = doc(db!, firestorePaths.productStockBalance(context.vendorId, id)); const old = balanceSnapshots[index].exists() ? balanceSnapshots[index].data() : {};
            const beforeQty = Number(old.quantityOnHand || 0); const afterQty = beforeQty + line.qtyAccepted; const oldCost = Number(old.averageCost || 0); const unitCost = Number(line.receivedUnitCost || line.unitCost || 0); const averageCost = afterQty ? ((beforeQty * oldCost) + (line.qtyAccepted * unitCost)) / afterQty : unitCost;
            transaction.set(balanceRef, { ...old, sciId: id, balanceId: id, vendorId: context.vendorId, branchId: receipt.branchId, warehouseId: receipt.warehouseId, productId: line.productId, quantityOnHand: afterQty, quantityReserved: Number(old.quantityReserved || 0), quantityInTransit: Number(old.quantityInTransit || 0), quantityAvailable: afterQty - Number(old.quantityReserved || 0), averageCost, stockValue: afterQty * averageCost, syncStatus: 'Synced', schemaVersion: COMMERCE_SCHEMA_VERSION, status: 'Active', sourceApp: context.sourceApp, createdAt: old.createdAt || timestamp, updatedAt: timestamp, createdBy: old.createdBy || context.actorId, updatedBy: context.actorId });
            const movementId = cleanId(receipt.grnId, line.lineId, 'GOODS_RECEIVED');
            transaction.set(doc(db!, firestorePaths.inventoryMovement(context.vendorId, movementId)), { movementId, sciId: movementId, vendorId: context.vendorId, branchId: receipt.branchId, warehouseId: receipt.warehouseId, productId: line.productId, movementType: 'GOODS_RECEIVED', quantityDelta: line.qtyAccepted, quantityBefore: beforeQty, quantityAfter: afterQty, unitCost, valueImpact: line.qtyAccepted * unitCost, referenceType: 'GRN', referenceId: receipt.grnId, actorId: context.actorId, correlationId: context.correlationId, schemaVersion: COMMERCE_SCHEMA_VERSION, status: 'Posted', sourceApp: context.sourceApp, createdAt: timestamp, updatedAt: timestamp, createdBy: context.actorId, updatedBy: context.actorId });
            transaction.set(doc(db!, firestorePaths.goodsReceivingLine(context.vendorId, line.lineId)), { ...line, vendorId: context.vendorId, qtyPosted: line.qtyAccepted, lineStatus: outstanding > 0 ? 'Partially Received' : 'Received' });
          });
          const posted = { ...receipt, receivingStatus: fullyReceived ? 'Posted' as const : 'Partially Posted' as const, status: fullyReceived ? 'Posted' as const : 'Partially Posted' as const, postingStatus: 'Posted' as const, postedAt: timestamp, updatedAt: timestamp };
          transaction.set(receiptRef, posted);
          transaction.update(poRef, { status: fullyReceived ? 'Fully Received' : 'Partially Received', updatedAt: timestamp });
          if (command.createSupplierInvoice && receipt.supplierInvoiceNumber) {
            const invoiceId = cleanId(receipt.supplierId, receipt.supplierInvoiceNumber); const total = lines.reduce((sum, line) => sum + line.qtyAccepted * Number(line.receivedUnitCost || 0), 0);
            if ((await transaction.get(doc(db!, firestorePaths.supplierInvoice(context.vendorId, invoiceId)))).exists()) {
              throw new PurchasingValidationError('Supplier invoice number already exists for this supplier.', 'DUPLICATE_SUPPLIER_INVOICE');
            }
            transaction.set(doc(db!, firestorePaths.supplierInvoice(context.vendorId, invoiceId)), { invoiceId, invoiceNumber: receipt.supplierInvoiceNumber, supplierInvoiceNumber: receipt.supplierInvoiceNumber, vendorId: context.vendorId, supplierId: receipt.supplierId, poId: receipt.poId, grnId: receipt.grnId, branchId: receipt.branchId, warehouseId: receipt.warehouseId, currency: 'USD', subtotal: total, taxTotal: 0, grandTotal: total, paidTotal: 0, outstandingBalance: total, status: 'Draft', lines: [], createdAt: timestamp, updatedAt: timestamp, createdBy: context.actorId, updatedBy: context.actorId });
            event(transaction, context, 'SUPPLIER_INVOICE_CREATED', 'SUPPLIER_INVOICE', invoiceId);
            audit(transaction, context, 'CREATE_SUPPLIER_INVOICE', 'SUPPLIER_INVOICE', invoiceId, null, { grnId: receipt.grnId, amount: total });
          }
          event(transaction, context, 'GOODS_RECEIVED', 'GOODS_RECEIPT', receipt.grnId, { poId: receipt.poId, supplierId: receipt.supplierId, lineCount: lines.length });
          audit(transaction, context, 'POST_GOODS_RECEIPT', 'GOODS_RECEIPT', receipt.grnId, receiptSnapshot.exists() ? receiptSnapshot.data() : null, posted, command.overReceiptReason || '');
          return posted;
        });
        return { success: true, data: result };
      } catch (error) {
        try { await setDoc(doc(db!, firestorePaths.biEvents(context.vendorId), cleanId('GOODS_RECEIPT_FAILED', context.correlationId, command.receipt.grnId)), { eventId: cleanId('GOODS_RECEIPT_FAILED', context.correlationId, command.receipt.grnId), eventType: 'GOODS_RECEIPT_FAILED', vendorId: context.vendorId, entityId: command.receipt.grnId, sourceApp: context.sourceApp, timestamp: nowIso(), correlationId: context.correlationId, metadata: { message: error instanceof Error ? error.message : 'Unknown failure' } }); } catch { /* primary error is returned */ }
        return mappedFailure(error);
      }
    },

    getSupplierInvoice,
    listSupplierInvoices: (context, filters) => vendorList<SupplierInvoice>(context, firestorePaths.supplierInvoices(context.vendorId), filters),
    async createSupplierInvoice(context, invoice) {
      const invalid = preflight(context); if (invalid) return invalid;
      try { assertSupplierInvoice(invoice, context.vendorId); if (!(await getSupplier(context, invoice.supplierId)).success) return failed('Supplier invoice supplier does not belong to this vendor.'); const duplicate = await getDocs(query(collection(db!, firestorePaths.supplierInvoices(context.vendorId)), where('supplierId', '==', invoice.supplierId), where('supplierInvoiceNumber', '==', invoice.supplierInvoiceNumber))); if (!duplicate.empty) return failed('Supplier invoice number already exists for this supplier.', 'DUPLICATE_SUPPLIER_INVOICE'); const value = { ...invoice, status: 'Draft' as const, paidTotal: 0, outstandingBalance: invoice.grandTotal, createdAt: nowIso(), updatedAt: nowIso(), createdBy: context.actorId, updatedBy: context.actorId }; await runTransaction(db!, async (transaction) => { transaction.set(doc(db!, firestorePaths.supplierInvoice(context.vendorId, invoice.invoiceId)), value); for (const line of invoice.lines) transaction.set(doc(db!, firestorePaths.supplierInvoiceLines(context.vendorId), line.lineId), { ...line, vendorId: context.vendorId }); event(transaction, context, 'SUPPLIER_INVOICE_CREATED', 'SUPPLIER_INVOICE', invoice.invoiceId); audit(transaction, context, 'CREATE_SUPPLIER_INVOICE', 'SUPPLIER_INVOICE', invoice.invoiceId, null, value); }); return { success: true, data: value }; } catch (error) { return mappedFailure(error); }
    },
    async approveSupplierInvoice(context, invoiceId) {
      const invalid = preflight(context) || manager(context, 'Supplier invoice approval'); if (invalid) return invalid;
      try { const current = await getSupplierInvoice(context, invoiceId); if (!current.success || !current.data) return current; if (!['Draft', 'PendingApproval'].includes(current.data.status)) return failed('Supplier invoice is not awaiting approval.'); const next = { ...current.data, status: 'Approved' as const, approvedBy: context.actorId, approvedAt: nowIso(), updatedAt: nowIso(), updatedBy: context.actorId }; await runTransaction(db!, async (transaction) => { transaction.set(doc(db!, firestorePaths.supplierInvoice(context.vendorId, invoiceId)), next); audit(transaction, context, 'APPROVE_SUPPLIER_INVOICE', 'SUPPLIER_INVOICE', invoiceId, current.data, next); }); return { success: true, data: next }; } catch (error) { return mappedFailure(error); }
    },

    listSupplierPayments: (context, filters) => vendorList<PurchasingSupplierPayment>(context, firestorePaths.supplierPayments(context.vendorId), filters),
    async recordSupplierPayment(context, payment) {
      const invalid = preflight(context); if (invalid) return invalid;
      if (payment.vendorId !== context.vendorId || payment.amount <= 0) return failed('Supplier payment vendor and amount are invalid.');
      if (payment.paymentMethod !== 'CASH' && !payment.paymentReference?.trim()) return failed('Non-cash supplier payments require a reference.');
      try {
        const value = await runTransaction(db!, async (transaction) => {
          const paymentRef = doc(db!, firestorePaths.supplierPayment(context.vendorId, payment.paymentId)); const invoiceRef = doc(db!, firestorePaths.supplierInvoice(context.vendorId, payment.invoiceId));
          const existing = await transaction.get(paymentRef); const invoiceSnapshot = await transaction.get(invoiceRef);
          if (existing.exists()) throw new PurchasingValidationError('Supplier payment has already been posted.', 'DUPLICATE_PAYMENT');
          if (!invoiceSnapshot.exists()) throw new PurchasingValidationError('Supplier invoice not found.');
          const invoice = record<SupplierInvoice>(invoiceSnapshot.data());
          if (!['Approved', 'PartiallyPaid'].includes(invoice.status)) throw new PurchasingValidationError('An approved supplier invoice is required before payment.');
          if (payment.supplierId !== invoice.supplierId) throw new PurchasingValidationError('Payment supplier does not match the invoice.');
          if (payment.amount > invoice.outstandingBalance) throw new PurchasingValidationError('Supplier payment exceeds the outstanding invoice balance.', 'OVERPAYMENT_NOT_SUPPORTED');
          const posted = { ...payment, status: 'POSTED' as const, createdAt: nowIso(), createdBy: context.actorId };
          const outstandingBalance = invoice.outstandingBalance - payment.amount; transaction.set(paymentRef, posted); transaction.update(invoiceRef, { paidTotal: invoice.paidTotal + payment.amount, outstandingBalance, status: outstandingBalance <= 0.01 ? 'Paid' : 'PartiallyPaid', updatedAt: nowIso(), updatedBy: context.actorId });
          if (payment.paymentMethod === 'CASH') transaction.set(doc(db!, firestorePaths.posCashMovements(context.vendorId), cleanId(payment.paymentId, 'CASH_OUT')), { movementId: cleanId(payment.paymentId, 'CASH_OUT'), vendorId: context.vendorId, branchId: context.branchId || invoice.branchId, movementType: 'SUPPLIER_PAYMENT', direction: 'OUT', amount: payment.amount, referenceId: payment.paymentId, actorId: context.actorId, correlationId: context.correlationId, createdAt: nowIso() });
          event(transaction, context, 'SUPPLIER_PAYMENT_RECORDED', 'SUPPLIER_PAYMENT', payment.paymentId, { invoiceId: payment.invoiceId, amount: payment.amount });
          audit(transaction, context, 'RECORD_SUPPLIER_PAYMENT', 'SUPPLIER_PAYMENT', payment.paymentId, null, posted);
          return posted;
        });
        return { success: true, data: value };
      } catch (error) { return mappedFailure(error); }
    },

    getSupplierReturn,
    listSupplierReturns: (context, filters) => vendorList<SupplierReturn>(context, firestorePaths.supplierReturns(context.vendorId), filters),
    async listSupplierReturnLines(context, supplierReturnId) { const invalid = preflight(context); if (invalid) return { ...invalid, records: [] }; try { const snap = await getDocs(query(collection(db!, firestorePaths.supplierReturnLines(context.vendorId)), where('supplierReturnId', '==', supplierReturnId))); return { success: true, records: snap.docs.map((row) => record<SupplierReturnLine>(row.data())) }; } catch (error) { return { ...mappedFailure(error), records: [] }; } },
    async postSupplierReturn(context, command: PostSupplierReturnCommand) {
      const invalid = preflight(context); if (invalid) return invalid;
      try {
        assertSupplierReturn(command, context.vendorId); const supplierReturn = command.supplierReturn; const lines = command.lines.filter((line) => line.qtyReturnApproved > 0);
        const posted = await runTransaction(db!, async (transaction) => {
          const returnRef = doc(db!, firestorePaths.supplierReturn(context.vendorId, supplierReturn.supplierReturnId)); const grnRef = doc(db!, firestorePaths.goodsReceivingNote(context.vendorId, supplierReturn.grnId!));
          const existing = await transaction.get(returnRef); const grn = await transaction.get(grnRef);
          const sourceLines = await Promise.all(lines.map((line) => {
            if (!line.grnLineId) throw new PurchasingValidationError('Supplier return line requires its original GRN line.', 'GRN_LINE_REQUIRED');
            return transaction.get(doc(db!, firestorePaths.goodsReceivingLine(context.vendorId, line.grnLineId)));
          }));
          const products = await Promise.all(lines.map((line) => transaction.get(doc(db!, firestorePaths.productMaster(context.vendorId), line.productId))));
          const balances = await Promise.all(lines.map((line) =>
            transaction.get(doc(db!, firestorePaths.productStockBalance(context.vendorId, balanceId(context, supplierReturn.branchId, supplierReturn.warehouseId, line.productId))))
          ));
          if (existing.exists() && existing.data().status === 'Posted') throw new PurchasingValidationError('Supplier return has already been posted.', 'SUPPLIER_RETURN_ALREADY_POSTED');
          if (!grn.exists() || !['Posted', 'Partially Posted'].includes(grn.data().receivingStatus)) throw new PurchasingValidationError('Supplier return requires an original posted GRN.');
          if (grn.data().vendorId !== context.vendorId || grn.data().supplierId !== supplierReturn.supplierId || grn.data().branchId !== supplierReturn.branchId || grn.data().warehouseId !== supplierReturn.warehouseId) throw new PurchasingValidationError('Supplier return scope does not match the original GRN.', 'SUPPLIER_RETURN_SCOPE_MISMATCH');
          if (sourceLines.some((snapshot, index) => !snapshot.exists() || snapshot.data().grnId !== supplierReturn.grnId || snapshot.data().productId !== lines[index].productId)) throw new PurchasingValidationError('Supplier return line does not match an original GRN line.', 'GRN_LINE_MISMATCH');
          if (products.some((snapshot) => !snapshot.exists() || (snapshot.data().vendorId && snapshot.data().vendorId !== context.vendorId))) throw new PurchasingValidationError('A supplier return product does not belong to this vendor.', 'PRODUCT_VENDOR_MISMATCH');
          const timestamp = nowIso();
          lines.forEach((line, index) => {
            const sourceLine = sourceLines[index].data();
            const acceptedQuantity = Number(sourceLine.qtyAccepted || sourceLine.quantityAccepted || 0);
            const alreadyReturned = Number(sourceLine.qtyAlreadyReturned || 0);
            if (alreadyReturned + line.qtyReturnApproved > acceptedQuantity) throw new PurchasingValidationError('Cumulative supplier return quantity cannot exceed the accepted received quantity.', 'RETURN_EXCEEDS_RECEIVED');
            const snapshot = balances[index]; const old = snapshot.exists() ? snapshot.data() : {}; const beforeQty = Number(old.quantityOnHand || 0); const availableQty = Number(old.quantityAvailable ?? beforeQty - Number(old.quantityReserved || 0)); const afterQty = beforeQty - line.qtyReturnApproved;
            if (line.qtyReturnApproved > availableQty && (!command.allowNegativeStock || !command.negativeStockOverrideReason?.trim())) throw new PurchasingValidationError('Supplier return would reduce stock below available quantity.', 'INSUFFICIENT_STOCK');
            transaction.update(sourceLines[index].ref, { qtyAlreadyReturned: alreadyReturned + line.qtyReturnApproved });
            const id = balanceId(context, supplierReturn.branchId, supplierReturn.warehouseId, line.productId); transaction.set(doc(db!, firestorePaths.productStockBalance(context.vendorId, id)), { ...old, balanceId: id, sciId: id, vendorId: context.vendorId, branchId: supplierReturn.branchId, warehouseId: supplierReturn.warehouseId, productId: line.productId, quantityOnHand: afterQty, quantityAvailable: afterQty - Number(old.quantityReserved || 0), stockValue: afterQty * Number(old.averageCost || line.unitCost || 0), updatedAt: timestamp, updatedBy: context.actorId });
            const movementId = cleanId(supplierReturn.supplierReturnId, line.lineId, 'SUPPLIER_RETURN'); transaction.set(doc(db!, firestorePaths.inventoryMovement(context.vendorId, movementId)), { movementId, sciId: movementId, vendorId: context.vendorId, branchId: supplierReturn.branchId, warehouseId: supplierReturn.warehouseId, productId: line.productId, movementType: 'SUPPLIER_RETURN', quantityDelta: -line.qtyReturnApproved, quantityBefore: beforeQty, quantityAfter: afterQty, unitCost: line.unitCost, valueImpact: -line.qtyReturnApproved * line.unitCost, referenceType: 'SUPPLIER_RETURN', referenceId: supplierReturn.supplierReturnId, actorId: context.actorId, correlationId: context.correlationId, schemaVersion: COMMERCE_SCHEMA_VERSION, status: 'Posted', sourceApp: context.sourceApp, createdAt: timestamp, updatedAt: timestamp, createdBy: context.actorId, updatedBy: context.actorId });
            transaction.set(doc(db!, firestorePaths.supplierReturnLine(context.vendorId, line.lineId)), { ...line, vendorId: context.vendorId, qtyPostedOut: line.qtyReturnApproved, lineStatus: 'Posted' });
          });
          const value = { ...supplierReturn, status: 'Posted' as const, updatedAt: timestamp }; transaction.set(returnRef, value);
          const creditId = cleanId(supplierReturn.supplierReturnId, 'CREDIT_NOTE'); transaction.set(doc(db!, firestorePaths.supplierCreditNotes(context.vendorId), creditId), { creditNoteId: creditId, vendorId: context.vendorId, supplierId: supplierReturn.supplierId, supplierReturnId: supplierReturn.supplierReturnId, supplierCreditNoteNumber: supplierReturn.supplierCreditNoteNumber || '', amount: supplierReturn.totalReturnValue, status: supplierReturn.supplierCreditNoteNumber ? 'RECEIVED' : 'PENDING', createdAt: timestamp });
          event(transaction, context, 'SUPPLIER_RETURN_POSTED', 'SUPPLIER_RETURN', supplierReturn.supplierReturnId, { grnId: supplierReturn.grnId, amount: supplierReturn.totalReturnValue });
          audit(transaction, context, 'POST_SUPPLIER_RETURN', 'SUPPLIER_RETURN', supplierReturn.supplierReturnId, existing.exists() ? existing.data() : null, value, command.negativeStockOverrideReason || '');
          return value;
        });
        return { success: true, data: posted };
      } catch (error) { return mappedFailure(error); }
    },

    async getSupplierStatement(context, supplierId, periodFrom, periodTo) {
      const invalid = preflight(context); if (invalid) return invalid;
      try {
        if (!(await getSupplier(context, supplierId)).success) return failed('Supplier not found.', REPOSITORY_ERROR_CODES.NOT_FOUND);
        const [invoices, payments, returns, credits] = await Promise.all([
          getDocs(query(collection(db!, firestorePaths.supplierInvoices(context.vendorId)), where('supplierId', '==', supplierId))),
          getDocs(query(collection(db!, firestorePaths.supplierPayments(context.vendorId)), where('supplierId', '==', supplierId))),
          getDocs(query(collection(db!, firestorePaths.supplierReturns(context.vendorId)), where('supplierId', '==', supplierId))),
          getDocs(query(collection(db!, firestorePaths.supplierCreditNotes(context.vendorId)), where('supplierId', '==', supplierId)))
        ]);
        const creditedReturnIds = new Set(credits.docs.map((row) => String(row.data().supplierReturnId || '')).filter(Boolean));
        const raw: Omit<SupplierStatementEntry, 'runningBalance'>[] = [
          ...invoices.docs.map((row) => { const value = record<SupplierInvoice>(row.data()); return { entryId: value.invoiceId, entryType: 'INVOICE' as const, reference: value.supplierInvoiceNumber, occurredAt: value.createdAt, debit: value.grandTotal, credit: 0 }; }),
          ...payments.docs.map((row) => { const value = record<PurchasingSupplierPayment>(row.data()); return { entryId: value.paymentId, entryType: 'PAYMENT' as const, reference: value.paymentNumber, occurredAt: value.createdAt, debit: 0, credit: value.status === 'REVERSED' ? 0 : value.amount }; }),
          ...returns.docs.map((row) => { const value = record<SupplierReturn>(row.data()); return { entryId: value.supplierReturnId, entryType: 'RETURN' as const, reference: value.supplierReturnNumber, occurredAt: value.updatedAt, debit: 0, credit: value.status === 'Posted' && !creditedReturnIds.has(value.supplierReturnId) ? value.totalReturnValue : 0 }; }),
          ...credits.docs.map((row) => { const value = row.data(); return { entryId: String(value.creditNoteId), entryType: 'CREDIT_NOTE' as const, reference: String(value.supplierCreditNoteNumber || value.creditNoteId), occurredAt: String(value.createdAt || ''), debit: 0, credit: Number(value.amount || 0) }; })
        ].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
        const openingRows = raw.filter((entry) => periodFrom && entry.occurredAt < periodFrom); const openingBalance = openingRows.reduce((sum, entry) => sum + entry.debit - entry.credit, 0); const periodRows = raw.filter((entry) => (!periodFrom || entry.occurredAt >= periodFrom) && (!periodTo || entry.occurredAt <= periodTo)); let balance = openingBalance; const entries = periodRows.map((entry) => ({ ...entry, runningBalance: (balance += entry.debit - entry.credit) }));
        const statement: PurchasingSupplierStatement = { statementId: cleanId(supplierId, periodFrom || 'OPEN', periodTo || 'CURRENT'), vendorId: context.vendorId, supplierId, periodFrom, periodTo, openingBalance, closingBalance: balance, entries, generatedAt: nowIso() };
        return { success: true, data: statement };
      } catch (error) { return mappedFailure(error); }
    },
    async listSupplierStatements(context, filters) { if (!filters?.supplierId) return { success: false, records: [], errorCode: 'SUPPLIER_REQUIRED', errorMessage: 'supplierId is required because statements are derived on demand.' }; const result = await this.getSupplierStatement(context, filters.supplierId); return result.success && result.data ? { success: true, records: [result.data] } : { success: false, records: [], errorCode: result.errorCode, errorMessage: result.errorMessage }; },

    subscribeSuppliers(context, listener) { if (preflight(context)) return { unsubscribe: () => undefined }; return { unsubscribe: onSnapshot(query(collection(db!, firestorePaths.suppliers(context.vendorId)), where('vendorId', '==', context.vendorId)), (snapshot) => listener(snapshot.docs.map((row) => record<PurchasingSupplier>(row.data())))) }; },
    subscribePurchaseOrders(context, listener) { if (preflight(context)) return { unsubscribe: () => undefined }; return { unsubscribe: onSnapshot(query(collection(db!, firestorePaths.purchaseOrders(context.vendorId)), where('vendorId', '==', context.vendorId)), (snapshot) => listener(snapshot.docs.map((row) => record<PurchaseOrder>(row.data())))) }; },
    subscribeGoodsReceipts(context, listener) { if (preflight(context)) return { unsubscribe: () => undefined }; return { unsubscribe: onSnapshot(query(collection(db!, firestorePaths.goodsReceivingNotes(context.vendorId)), where('vendorId', '==', context.vendorId)), (snapshot) => listener(snapshot.docs.map((row) => record<GoodsReceivingNote>(row.data())))) }; }
  };
}
