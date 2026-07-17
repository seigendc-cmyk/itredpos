import type { GoodsReceivingNote, PurchaseOrder, SupplierReturn } from '../types';
import { createRepositoryBundle } from '../repositories/repositoryFactory';
import type { RepositoryOperationContext } from '../repositories/repositoryContext';
import type {
  CreatePurchaseOrderCommand,
  PostGoodsReceiptCommand,
  PostSupplierReturnCommand,
  PurchaseRequisition,
  PurchasingFilters,
  PurchasingRepository,
  PurchasingSupplier,
  PurchasingSupplierPayment,
  SupplierInvoice
} from '../repositories/PurchasingRepository';

const inFlight = new Map<string, Promise<unknown>>();

function once<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const active = inFlight.get(key) as Promise<T> | undefined;
  if (active) return active;
  const pending = operation().finally(() => inFlight.delete(key));
  inFlight.set(key, pending);
  return pending;
}

export class PurchasingTransactionService {
  constructor(private readonly repository: PurchasingRepository) {}

  getSupplier = (context: RepositoryOperationContext, id: string) => this.repository.getSupplier(context, id);
  listSuppliers = (context: RepositoryOperationContext, filters?: PurchasingFilters) => this.repository.listSuppliers(context, filters);
  createSupplier = (context: RepositoryOperationContext, value: PurchasingSupplier) => once(`supplier:create:${context.vendorId}:${value.supplierId}`, () => this.repository.createSupplier(context, value));
  updateSupplier = (context: RepositoryOperationContext, id: string, changes: Partial<PurchasingSupplier>) => once(`supplier:update:${context.vendorId}:${id}`, () => this.repository.updateSupplier(context, id, changes));
  deactivateSupplier = (context: RepositoryOperationContext, id: string) => once(`supplier:deactivate:${context.vendorId}:${id}`, () => this.repository.deactivateSupplier(context, id));

  getPurchaseRequisition = (context: RepositoryOperationContext, id: string) => this.repository.getPurchaseRequisition(context, id);
  listPurchaseRequisitions = (context: RepositoryOperationContext, filters?: PurchasingFilters) => this.repository.listPurchaseRequisitions(context, filters);
  createPurchaseRequisition = (context: RepositoryOperationContext, value: PurchaseRequisition) => once(`requisition:create:${context.vendorId}:${value.requisitionId}`, () => this.repository.createPurchaseRequisition(context, value));
  approvePurchaseRequisition = (context: RepositoryOperationContext, id: string) => once(`requisition:approve:${context.vendorId}:${id}`, () => this.repository.approvePurchaseRequisition(context, id));
  rejectPurchaseRequisition = (context: RepositoryOperationContext, id: string, reason: string) => once(`requisition:reject:${context.vendorId}:${id}`, () => this.repository.rejectPurchaseRequisition(context, id, reason));

  getPurchaseOrder = (context: RepositoryOperationContext, id: string) => this.repository.getPurchaseOrder(context, id);
  listPurchaseOrders = (context: RepositoryOperationContext, filters?: PurchasingFilters) => this.repository.listPurchaseOrders(context, filters);
  listPurchaseOrderLines = (context: RepositoryOperationContext, id: string) => this.repository.listPurchaseOrderLines(context, id);
  createPurchaseOrder = (context: RepositoryOperationContext, command: CreatePurchaseOrderCommand) => once(`po:create:${context.vendorId}:${command.order.poId}`, () => this.repository.createPurchaseOrder(context, command));
  approvePurchaseOrder = (context: RepositoryOperationContext, id: string) => once(`po:approve:${context.vendorId}:${id}`, () => this.repository.approvePurchaseOrder(context, id));
  cancelPurchaseOrder = (context: RepositoryOperationContext, id: string, reason: string) => once(`po:cancel:${context.vendorId}:${id}`, () => this.repository.cancelPurchaseOrder(context, id, reason));

  getGoodsReceipt = (context: RepositoryOperationContext, id: string) => this.repository.getGoodsReceipt(context, id);
  listGoodsReceipts = (context: RepositoryOperationContext, filters?: PurchasingFilters) => this.repository.listGoodsReceipts(context, filters);
  listGoodsReceiptLines = (context: RepositoryOperationContext, id: string) => this.repository.listGoodsReceiptLines(context, id);
  postGoodsReceipt = (context: RepositoryOperationContext, command: PostGoodsReceiptCommand) => once(`grn:post:${context.vendorId}:${command.receipt.grnId}`, () => this.repository.postGoodsReceipt(context, command));

  getSupplierInvoice = (context: RepositoryOperationContext, id: string) => this.repository.getSupplierInvoice(context, id);
  listSupplierInvoices = (context: RepositoryOperationContext, filters?: PurchasingFilters) => this.repository.listSupplierInvoices(context, filters);
  createSupplierInvoice = (context: RepositoryOperationContext, value: SupplierInvoice) => once(`invoice:create:${context.vendorId}:${value.invoiceId}`, () => this.repository.createSupplierInvoice(context, value));
  approveSupplierInvoice = (context: RepositoryOperationContext, id: string) => once(`invoice:approve:${context.vendorId}:${id}`, () => this.repository.approveSupplierInvoice(context, id));

  listSupplierPayments = (context: RepositoryOperationContext, filters?: PurchasingFilters) => this.repository.listSupplierPayments(context, filters);
  recordSupplierPayment = (context: RepositoryOperationContext, value: PurchasingSupplierPayment) => once(`payment:record:${context.vendorId}:${value.paymentId}`, () => this.repository.recordSupplierPayment(context, value));

  getSupplierReturn = (context: RepositoryOperationContext, id: string) => this.repository.getSupplierReturn(context, id);
  listSupplierReturns = (context: RepositoryOperationContext, filters?: PurchasingFilters) => this.repository.listSupplierReturns(context, filters);
  listSupplierReturnLines = (context: RepositoryOperationContext, id: string) => this.repository.listSupplierReturnLines(context, id);
  postSupplierReturn = (context: RepositoryOperationContext, command: PostSupplierReturnCommand) => once(`return:post:${context.vendorId}:${command.supplierReturn.supplierReturnId}`, () => this.repository.postSupplierReturn(context, command));

  getSupplierStatement = (context: RepositoryOperationContext, supplierId: string, from?: string, to?: string) => this.repository.getSupplierStatement(context, supplierId, from, to);
  listSupplierStatements = (context: RepositoryOperationContext, filters?: PurchasingFilters) => this.repository.listSupplierStatements(context, filters);

  subscribeSuppliers = (context: RepositoryOperationContext, listener: (rows: PurchasingSupplier[]) => void) => this.repository.subscribeSuppliers(context, listener);
  subscribePurchaseOrders = (context: RepositoryOperationContext, listener: (rows: PurchaseOrder[]) => void) => this.repository.subscribePurchaseOrders(context, listener);
  subscribeGoodsReceipts = (context: RepositoryOperationContext, listener: (rows: GoodsReceivingNote[]) => void) => this.repository.subscribeGoodsReceipts(context, listener);
  subscribeSupplierReturns(context: RepositoryOperationContext, listener: (rows: SupplierReturn[]) => void) {
    let active = true;
    const refresh = async () => { const result = await this.listSupplierReturns(context); if (active && result.success) listener(result.records); };
    void refresh();
    const timer = window.setInterval(refresh, 30000);
    return { unsubscribe: () => { active = false; window.clearInterval(timer); } };
  }
}

let service: PurchasingTransactionService | null = null;

export function getPurchasingTransactionService(): PurchasingTransactionService {
  if (!service) service = new PurchasingTransactionService(createRepositoryBundle().purchasing);
  return service;
}

export function isFirebasePurchasingMode(): boolean {
  return (import.meta.env.VITE_STORAGE_MODE || 'local') === 'firebase';
}
