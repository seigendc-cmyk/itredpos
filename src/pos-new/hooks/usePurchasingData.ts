import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GoodsReceivingLine, GoodsReceivingNote, PurchaseOrder, PurchaseOrderLine, SupplierReturn, SupplierReturnLine } from '../types';
import type { RepositoryOperationContext, RepositorySubscription } from '../repositories/repositoryContext';
import type {
  CreatePurchaseOrderCommand,
  PostGoodsReceiptCommand,
  PostSupplierReturnCommand,
  PurchaseRequisition,
  PurchasingFilters,
  PurchasingSupplier,
  PurchasingSupplierPayment,
  PurchasingSupplierStatement,
  SupplierInvoice
} from '../repositories/PurchasingRepository';
import { getPurchasingTransactionService, isFirebasePurchasingMode } from '../services/purchasingTransactionService';

export function usePurchasingData({ context }: { context: RepositoryOperationContext }) {
  const service = useMemo(() => getPurchasingTransactionService(), []);
  const firebaseMode = isFirebasePurchasingMode();
  const [suppliers, setSuppliers] = useState<PurchasingSupplier[]>([]);
  const [requisitions, setRequisitions] = useState<PurchaseRequisition[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [goodsReceipts, setGoodsReceipts] = useState<GoodsReceivingNote[]>([]);
  const [supplierInvoices, setSupplierInvoices] = useState<SupplierInvoice[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<PurchasingSupplierPayment[]>([]);
  const [supplierReturns, setSupplierReturns] = useState<SupplierReturn[]>([]);
  const [supplierStatements, setSupplierStatements] = useState<PurchasingSupplierStatement[]>([]);
  const [loading, setLoading] = useState(firebaseMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const subscriptions = useRef<RepositorySubscription[]>([]);

  const ensure = useCallback(<T extends { success: boolean; errorMessage?: string }>(result: T): T => {
    if (!result.success) throw new Error(result.errorMessage || 'Purchasing operation failed.');
    return result;
  }, []);

  const refresh = useCallback(async (filters?: PurchasingFilters) => {
    if (!firebaseMode) { setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const [supplierResult, requisitionResult, poResult, grnResult, invoiceResult, paymentResult, returnResult] = await Promise.all([
        service.listSuppliers(context, filters), service.listPurchaseRequisitions(context, filters), service.listPurchaseOrders(context, filters),
        service.listGoodsReceipts(context, filters), service.listSupplierInvoices(context, filters), service.listSupplierPayments(context, filters), service.listSupplierReturns(context, filters)
      ]);
      setSuppliers(ensure(supplierResult).records); setRequisitions(ensure(requisitionResult).records); setPurchaseOrders(ensure(poResult).records);
      setGoodsReceipts(ensure(grnResult).records); setSupplierInvoices(ensure(invoiceResult).records); setSupplierPayments(ensure(paymentResult).records); setSupplierReturns(ensure(returnResult).records);
      if (filters?.supplierId) { const statements = await service.listSupplierStatements(context, filters); setSupplierStatements(ensure(statements).records); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Failed to load purchasing data.'); }
    finally { setLoading(false); }
  }, [context, ensure, firebaseMode, service]);

  useEffect(() => {
    if (!firebaseMode) return;
    void refresh();
    subscriptions.current = [
      service.subscribeSuppliers(context, setSuppliers),
      service.subscribePurchaseOrders(context, setPurchaseOrders),
      service.subscribeGoodsReceipts(context, setGoodsReceipts),
      service.subscribeSupplierReturns(context, setSupplierReturns)
    ];
    return () => { subscriptions.current.forEach((subscription) => subscription.unsubscribe()); subscriptions.current = []; };
  }, [context, firebaseMode, refresh, service]);

  const mutate = useCallback(async <T,>(operation: () => Promise<T>): Promise<T> => {
    if (saving) throw new Error('A purchasing operation is already being saved.');
    setSaving(true); setError(null);
    try { const result = await operation(); ensure(result as T & { success: boolean; errorMessage?: string }); await refresh(); return result; }
    catch (cause) { const message = cause instanceof Error ? cause.message : 'Purchasing operation failed.'; setError(message); throw cause; }
    finally { setSaving(false); }
  }, [ensure, refresh, saving]);

  return {
    firebaseMode, suppliers, requisitions, purchaseOrders, goodsReceipts, supplierInvoices, supplierPayments, supplierReturns, supplierStatements,
    loading, saving, error, refresh,
    listPurchaseOrderLines: (poId: string) => service.listPurchaseOrderLines(context, poId),
    listGoodsReceiptLines: (grnId: string) => service.listGoodsReceiptLines(context, grnId),
    listSupplierReturnLines: (id: string) => service.listSupplierReturnLines(context, id),
    createSupplier: (value: PurchasingSupplier) => mutate(() => service.createSupplier(context, value)),
    updateSupplier: (id: string, value: Partial<PurchasingSupplier>) => mutate(() => service.updateSupplier(context, id, value)),
    deactivateSupplier: (id: string) => mutate(() => service.deactivateSupplier(context, id)),
    createPurchaseRequisition: (value: PurchaseRequisition) => mutate(() => service.createPurchaseRequisition(context, value)),
    approvePurchaseRequisition: (id: string) => mutate(() => service.approvePurchaseRequisition(context, id)),
    rejectPurchaseRequisition: (id: string, reason: string) => mutate(() => service.rejectPurchaseRequisition(context, id, reason)),
    createPurchaseOrder: (command: CreatePurchaseOrderCommand) => mutate(() => service.createPurchaseOrder(context, command)),
    approvePurchaseOrder: (id: string) => mutate(() => service.approvePurchaseOrder(context, id)),
    cancelPurchaseOrder: (id: string, reason: string) => mutate(() => service.cancelPurchaseOrder(context, id, reason)),
    postGoodsReceipt: (command: PostGoodsReceiptCommand) => mutate(() => service.postGoodsReceipt(context, command)),
    createSupplierInvoice: (value: SupplierInvoice) => mutate(() => service.createSupplierInvoice(context, value)),
    approveSupplierInvoice: (id: string) => mutate(() => service.approveSupplierInvoice(context, id)),
    recordSupplierPayment: (value: PurchasingSupplierPayment) => mutate(() => service.recordSupplierPayment(context, value)),
    postSupplierReturn: (command: PostSupplierReturnCommand) => mutate(() => service.postSupplierReturn(context, command)),
    getSupplierStatement: async (supplierId: string, from?: string, to?: string) => ensure(await service.getSupplierStatement(context, supplierId, from, to)).data,
    setDraftPurchaseOrders: (_rows: PurchaseOrder[]) => undefined,
    toGoodsReceiptCommand: (receipt: GoodsReceivingNote, lines: GoodsReceivingLine[]): PostGoodsReceiptCommand => ({ receipt, lines }),
    toPurchaseOrderCommand: (order: PurchaseOrder, lines: PurchaseOrderLine[]): CreatePurchaseOrderCommand => ({ order, lines }),
    toSupplierReturnCommand: (supplierReturn: SupplierReturn, lines: SupplierReturnLine[]): PostSupplierReturnCommand => ({ supplierReturn, lines })
  };
}
