import type {
  CreatePurchaseOrderCommand,
  PostGoodsReceiptCommand,
  PostSupplierReturnCommand,
  PurchasingSupplier,
  SupplierInvoice
} from './PurchasingRepository';

export class PurchasingValidationError extends Error {
  constructor(message: string, public readonly code = 'PURCHASING_VALIDATION_FAILED') {
    super(message);
    this.name = 'PurchasingValidationError';
  }
}

const required = (value: unknown, label: string): void => {
  if (typeof value !== 'string' || value.trim().length === 0) throw new PurchasingValidationError(`${label} is required.`);
};

const positive = (value: number, label: string): void => {
  if (!Number.isFinite(value) || value <= 0) throw new PurchasingValidationError(`${label} must be positive.`);
};

export const normalizeSupplierContact = (value: string | undefined): string => (value || '').trim().toLowerCase().replace(/\s+/g, '');

export function assertSupplier(supplier: PurchasingSupplier, vendorId: string): void {
  required(supplier.supplierId, 'supplierId');
  required(supplier.supplierCode, 'supplierCode');
  required(supplier.supplierName, 'supplierName');
  if (supplier.vendorId !== vendorId) throw new PurchasingValidationError('Supplier vendor identity must match the operation context.', 'VENDOR_MISMATCH');
  if (supplier.paymentTermsDays < 0 || supplier.creditLimit < 0) throw new PurchasingValidationError('Supplier payment terms and credit limit cannot be negative.');
}

export function assertPurchaseOrder(command: CreatePurchaseOrderCommand, vendorId: string): void {
  const { order, lines } = command;
  required(order.poId, 'poId');
  required(order.poNumber, 'poNumber');
  required(order.supplierId, 'supplierId');
  required(order.branchId, 'branchId');
  required(order.warehouseId, 'warehouseId');
  if (order.vendorId !== vendorId) throw new PurchasingValidationError('Purchase order vendor identity must match the operation context.', 'VENDOR_MISMATCH');
  if (lines.length === 0) throw new PurchasingValidationError('Purchase order requires at least one line.');
  lines.forEach((line, index) => {
    required(line.productId, `lines[${index}].productId`);
    positive(line.qtyOrdered, `lines[${index}].quantityOrdered`);
    positive(line.estimatedUnitCost, `lines[${index}].unitCost`);
    if (line.poId !== order.poId) throw new PurchasingValidationError(`lines[${index}] does not belong to this purchase order.`);
  });
}

export function assertSupplierInvoice(invoice: SupplierInvoice, vendorId: string): void {
  if (invoice.vendorId !== vendorId) throw new PurchasingValidationError('Supplier invoice vendor identity must match the operation context.', 'VENDOR_MISMATCH');
  required(invoice.invoiceId, 'invoiceId');
  required(invoice.supplierId, 'supplierId');
  required(invoice.supplierInvoiceNumber, 'supplierInvoiceNumber');
  if (invoice.lines.length === 0) throw new PurchasingValidationError('Supplier invoice requires at least one line.');
  const subtotal = invoice.lines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0);
  const taxTotal = invoice.lines.reduce((sum, line) => sum + line.taxAmount, 0);
  const grandTotal = subtotal + taxTotal;
  const close = (a: number, b: number) => Math.abs(a - b) <= 0.01;
  if (!close(invoice.subtotal, subtotal) || !close(invoice.taxTotal, taxTotal) || !close(invoice.grandTotal, grandTotal)) {
    throw new PurchasingValidationError('Supplier invoice totals do not reconcile with its lines and tax.');
  }
}

export function assertGoodsReceipt(command: PostGoodsReceiptCommand, vendorId: string): void {
  const { receipt, lines } = command;
  if (receipt.vendorId !== vendorId) throw new PurchasingValidationError('Goods receipt vendor identity must match the operation context.', 'VENDOR_MISMATCH');
  required(receipt.grnId, 'grnId');
  required(receipt.poId, 'poId');
  required(receipt.supplierId, 'supplierId');
  required(receipt.branchId, 'branchId');
  required(receipt.warehouseId, 'warehouseId');
  if (lines.length === 0) throw new PurchasingValidationError('Goods receipt requires at least one line.');
  for (const line of lines) {
    required(line.productId, 'Goods receipt line productId');
    if (line.grnId !== receipt.grnId) throw new PurchasingValidationError('Goods receipt line belongs to another receipt.');
    if (line.qtyAccepted < 0 || line.qtyRejected < 0 || line.qtyReceivedNow < 0) throw new PurchasingValidationError('Goods receipt quantities cannot be negative.');
    if (line.qtyAccepted + line.qtyRejected > line.qtyReceivedNow) throw new PurchasingValidationError('Accepted and rejected quantities exceed received quantity.');
    const over = line.qtyAccepted > line.qtyOutstandingBeforeGRN;
    if (over && (!command.allowOverReceipt || !command.hasOverReceiptPermission || !command.overReceiptReason?.trim())) {
      throw new PurchasingValidationError('Over-receipt requires explicit permission and a reason.', 'OVER_RECEIPT_NOT_AUTHORIZED');
    }
  }
}

export function assertSupplierReturn(command: PostSupplierReturnCommand, vendorId: string): void {
  const record = command.supplierReturn;
  if (record.vendorId !== vendorId) throw new PurchasingValidationError('Supplier return vendor identity must match the operation context.', 'VENDOR_MISMATCH');
  required(record.supplierReturnId, 'supplierReturnId');
  required(record.grnId, 'grnId');
  if (command.lines.length === 0) throw new PurchasingValidationError('Supplier return requires at least one line.');
  command.lines.forEach((line) => {
    required(line.productId, 'Supplier return line productId');
    if (line.supplierReturnId !== record.supplierReturnId) throw new PurchasingValidationError('Supplier return line belongs to another return.');
    if (line.qtyReturnApproved <= 0) throw new PurchasingValidationError('Supplier return quantity must be positive.');
    if (line.qtyAlreadyReturned + line.qtyReturnApproved > line.qtyAcceptedIntoStock) {
      throw new PurchasingValidationError('Cumulative supplier return quantity cannot exceed the accepted received quantity.', 'RETURN_EXCEEDS_RECEIVED');
    }
  });
}

export function assertManagerRole(actorRole: string | undefined, operation: string): void {
  const normalized = (actorRole || '').toLowerCase();
  if (!['owner', 'manager', 'admin', 'administrator'].includes(normalized)) {
    throw new PurchasingValidationError(`${operation} requires an authorized manager.`, 'PERMISSION_DENIED');
  }
}

export function assertPostedDocumentTransition(currentStatus: string, nextStatus: string, entity = 'Posted document'): void {
  if (['Posted', 'POSTED', 'Partially Posted'].includes(currentStatus) && ['Draft', 'DRAFT'].includes(nextStatus)) {
    throw new PurchasingValidationError(`${entity} cannot transition back to Draft.`, 'POSTED_DOCUMENT_IMMUTABLE');
  }
}

export function assertPurchaseOrderTransition(currentStatus: string, nextStatus: string, actorRole?: string): void {
  const allowed: Record<string, string[]> = {
    Draft: ['Submitted', 'Cancelled'],
    'Pending Approval': ['Approved', 'Rejected'],
    Submitted: ['Approved', 'Rejected'],
    Approved: ['Partially Received', 'PartiallyReceived', 'Fully Received', 'Completed'],
    PartiallyReceived: ['Completed'],
    'Partially Received': ['Fully Received', 'Completed']
  };
  if (!allowed[currentStatus]?.includes(nextStatus)) throw new PurchasingValidationError(`Purchase order cannot transition from ${currentStatus} to ${nextStatus}.`, 'INVALID_STATUS_TRANSITION');
  if (['Approved', 'Rejected'].includes(nextStatus)) assertManagerRole(actorRole, `Purchase order ${nextStatus.toLowerCase()}`);
}
