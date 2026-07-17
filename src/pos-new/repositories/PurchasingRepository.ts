import type {
  GoodsReceivingLine,
  GoodsReceivingNote,
  PurchaseOrder,
  PurchaseOrderLine,
  SupplierReturn,
  SupplierReturnLine
} from '../types';
import type { CommerceSourceApp } from '../firebase/commerceDataContract';
import type { RepositoryOperationContext, RepositorySubscription } from './repositoryContext';
import type { RepositoryListResult, RepositoryResult } from './repositoryTypes';

export type SupplierStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'UNDER_REVIEW';

export interface PurchasingSupplier {
  supplierId: string;
  sciId: string;
  vendorId: string;
  supplierCode: string;
  supplierName: string;
  contactPerson: string;
  phone: string;
  whatsappNumber: string;
  email: string;
  address: string;
  city: string;
  country: string;
  taxNumber: string;
  registrationNumber: string;
  paymentTermsDays: number;
  creditLimit: number;
  currency: string;
  status: SupplierStatus;
  sourceApp: CommerceSourceApp;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export type PurchaseRequisitionStatus = 'Draft' | 'Submitted' | 'Approved' | 'Rejected' | 'Converted' | 'Cancelled';

export interface PurchaseRequisitionLine {
  lineId: string;
  requisitionId: string;
  vendorId: string;
  productId: string;
  sku: string;
  productNameSnapshot: string;
  quantityRequested: number;
  estimatedUnitCost: number;
  notes?: string;
}

export interface PurchaseRequisition {
  requisitionId: string;
  requisitionNumber: string;
  vendorId: string;
  branchId: string;
  warehouseId: string;
  status: PurchaseRequisitionStatus;
  reason: string;
  lines: PurchaseRequisitionLine[];
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  convertedPurchaseOrderIds?: string[];
  correlationId: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export type SupplierInvoiceStatus = 'Draft' | 'PendingApproval' | 'Approved' | 'PartiallyPaid' | 'Paid' | 'Disputed' | 'Cancelled';

export interface SupplierInvoiceLine {
  lineId: string;
  invoiceId: string;
  productId?: string;
  description: string;
  quantity: number;
  unitCost: number;
  taxAmount: number;
  lineTotal: number;
}

export interface SupplierInvoice {
  invoiceId: string;
  invoiceNumber: string;
  supplierInvoiceNumber: string;
  vendorId: string;
  supplierId: string;
  poId?: string;
  grnId?: string;
  branchId: string;
  warehouseId?: string;
  currency: string;
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  paidTotal: number;
  outstandingBalance: number;
  status: SupplierInvoiceStatus;
  lines: SupplierInvoiceLine[];
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export type SupplierPaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'MOBILE_MONEY' | 'CARD' | 'OTHER';

export interface PurchasingSupplierPayment {
  paymentId: string;
  paymentNumber: string;
  vendorId: string;
  supplierId: string;
  invoiceId: string;
  amount: number;
  currency: string;
  paymentMethod: SupplierPaymentMethod;
  paymentReference?: string;
  status: 'POSTED' | 'REVERSED';
  reversalOfPaymentId?: string;
  createdAt: string;
  createdBy: string;
}

export interface SupplierStatementEntry {
  entryId: string;
  entryType: 'INVOICE' | 'PAYMENT' | 'RETURN' | 'CREDIT_NOTE' | 'ADJUSTMENT';
  reference: string;
  occurredAt: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

export interface PurchasingSupplierStatement {
  statementId: string;
  vendorId: string;
  supplierId: string;
  periodFrom?: string;
  periodTo?: string;
  openingBalance: number;
  closingBalance: number;
  entries: SupplierStatementEntry[];
  generatedAt: string;
}

export interface PurchasingFilters {
  status?: string;
  supplierId?: string;
  branchId?: string;
  warehouseId?: string;
}

export interface CreatePurchaseOrderCommand { order: PurchaseOrder; lines: PurchaseOrderLine[]; requisitionId?: string; }
export interface PostGoodsReceiptCommand {
  receipt: GoodsReceivingNote;
  lines: GoodsReceivingLine[];
  createSupplierInvoice?: boolean;
  allowOverReceipt?: boolean;
  overReceiptReason?: string;
  hasOverReceiptPermission?: boolean;
}
export interface PostSupplierReturnCommand {
  supplierReturn: SupplierReturn;
  lines: SupplierReturnLine[];
  allowNegativeStock?: boolean;
  negativeStockOverrideReason?: string;
}

export interface PurchasingRepository {
  getSupplier(context: RepositoryOperationContext, supplierId: string): Promise<RepositoryResult<PurchasingSupplier>>;
  listSuppliers(context: RepositoryOperationContext, filters?: PurchasingFilters): Promise<RepositoryListResult<PurchasingSupplier>>;
  createSupplier(context: RepositoryOperationContext, supplier: PurchasingSupplier): Promise<RepositoryResult<PurchasingSupplier> & { warnings?: string[] }>;
  updateSupplier(context: RepositoryOperationContext, supplierId: string, changes: Partial<PurchasingSupplier>): Promise<RepositoryResult<PurchasingSupplier> & { warnings?: string[] }>;
  deactivateSupplier(context: RepositoryOperationContext, supplierId: string): Promise<RepositoryResult<PurchasingSupplier>>;

  getPurchaseRequisition(context: RepositoryOperationContext, requisitionId: string): Promise<RepositoryResult<PurchaseRequisition>>;
  listPurchaseRequisitions(context: RepositoryOperationContext, filters?: PurchasingFilters): Promise<RepositoryListResult<PurchaseRequisition>>;
  createPurchaseRequisition(context: RepositoryOperationContext, requisition: PurchaseRequisition): Promise<RepositoryResult<PurchaseRequisition>>;
  approvePurchaseRequisition(context: RepositoryOperationContext, requisitionId: string): Promise<RepositoryResult<PurchaseRequisition>>;
  rejectPurchaseRequisition(context: RepositoryOperationContext, requisitionId: string, reason: string): Promise<RepositoryResult<PurchaseRequisition>>;

  getPurchaseOrder(context: RepositoryOperationContext, poId: string): Promise<RepositoryResult<PurchaseOrder>>;
  listPurchaseOrders(context: RepositoryOperationContext, filters?: PurchasingFilters): Promise<RepositoryListResult<PurchaseOrder>>;
  listPurchaseOrderLines(context: RepositoryOperationContext, poId: string): Promise<RepositoryListResult<PurchaseOrderLine>>;
  createPurchaseOrder(context: RepositoryOperationContext, command: CreatePurchaseOrderCommand): Promise<RepositoryResult<PurchaseOrder>>;
  approvePurchaseOrder(context: RepositoryOperationContext, poId: string): Promise<RepositoryResult<PurchaseOrder>>;
  cancelPurchaseOrder(context: RepositoryOperationContext, poId: string, reason: string): Promise<RepositoryResult<PurchaseOrder>>;

  getGoodsReceipt(context: RepositoryOperationContext, grnId: string): Promise<RepositoryResult<GoodsReceivingNote>>;
  listGoodsReceipts(context: RepositoryOperationContext, filters?: PurchasingFilters): Promise<RepositoryListResult<GoodsReceivingNote>>;
  listGoodsReceiptLines(context: RepositoryOperationContext, grnId: string): Promise<RepositoryListResult<GoodsReceivingLine>>;
  postGoodsReceipt(context: RepositoryOperationContext, command: PostGoodsReceiptCommand): Promise<RepositoryResult<GoodsReceivingNote>>;

  getSupplierInvoice(context: RepositoryOperationContext, invoiceId: string): Promise<RepositoryResult<SupplierInvoice>>;
  listSupplierInvoices(context: RepositoryOperationContext, filters?: PurchasingFilters): Promise<RepositoryListResult<SupplierInvoice>>;
  createSupplierInvoice(context: RepositoryOperationContext, invoice: SupplierInvoice): Promise<RepositoryResult<SupplierInvoice>>;
  approveSupplierInvoice(context: RepositoryOperationContext, invoiceId: string): Promise<RepositoryResult<SupplierInvoice>>;

  listSupplierPayments(context: RepositoryOperationContext, filters?: PurchasingFilters): Promise<RepositoryListResult<PurchasingSupplierPayment>>;
  recordSupplierPayment(context: RepositoryOperationContext, payment: PurchasingSupplierPayment): Promise<RepositoryResult<PurchasingSupplierPayment>>;

  getSupplierReturn(context: RepositoryOperationContext, supplierReturnId: string): Promise<RepositoryResult<SupplierReturn>>;
  listSupplierReturns(context: RepositoryOperationContext, filters?: PurchasingFilters): Promise<RepositoryListResult<SupplierReturn>>;
  listSupplierReturnLines(context: RepositoryOperationContext, supplierReturnId: string): Promise<RepositoryListResult<SupplierReturnLine>>;
  postSupplierReturn(context: RepositoryOperationContext, command: PostSupplierReturnCommand): Promise<RepositoryResult<SupplierReturn>>;

  getSupplierStatement(context: RepositoryOperationContext, supplierId: string, periodFrom?: string, periodTo?: string): Promise<RepositoryResult<PurchasingSupplierStatement>>;
  listSupplierStatements(context: RepositoryOperationContext, filters?: PurchasingFilters): Promise<RepositoryListResult<PurchasingSupplierStatement>>;

  subscribeSuppliers(context: RepositoryOperationContext, listener: (records: PurchasingSupplier[]) => void): RepositorySubscription;
  subscribePurchaseOrders(context: RepositoryOperationContext, listener: (records: PurchaseOrder[]) => void): RepositorySubscription;
  subscribeGoodsReceipts(context: RepositoryOperationContext, listener: (records: GoodsReceivingNote[]) => void): RepositorySubscription;
}
