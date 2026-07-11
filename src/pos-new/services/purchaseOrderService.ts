import {
  PurchaseOrder,
  PurchaseOrderActivityEvent,
  PurchaseOrderFilterState,
  PurchaseOrderLine,
  PurchaseOrderStatus,
  PurchaseOrderSummary
} from '../types';
import {
  mockPurchaseOrderActivityEvents,
  mockPurchaseOrderLines,
  mockPurchaseOrders
} from '../mock/mockPosData';
import { createOperationalApproval } from './approvalService';
import { createGRNDraftFromPO, getPOReceivingSummary } from './goodsReceivingService';
import { flagPOSupplierNotInRecords, getSupplierById, recordSupplierActivity } from './supplierService';
import { getVendorDocumentIdentity } from '../vendor/vendorBootstrapModel';
import { getActiveVendorId, readVendorScopedList, writeVendorScopedList } from '../utils/vendorDataMode';
import { calculateDocumentTax, getCachedVendorTaxSettings } from './vendorTaxSettingsService';
import { assertCanonicalPurchaseSession, hasPurchasePermission, type CanonicalPurchaseSession } from './purchaseSessionService';

const PO_KEY = 'itred_pos_purchase_orders_v1';
const PO_LINE_KEY = 'itred_pos_purchase_order_lines_v1';
const PO_ACTIVITY_KEY = 'itred_pos_purchase_order_activity_v1';

type PurchaseOrderCreatePayload = Omit<PurchaseOrder, 'poId' | 'poNumber' | 'createdAt' | 'updatedAt'> & {
  poId?: string;
  poNumber?: string;
  lines: Array<Omit<PurchaseOrderLine, 'lineId' | 'poId' | 'qtyOutstanding' | 'estimatedLineTotal' | 'lineStatus'> & {
    lineId?: string;
    lineStatus?: PurchaseOrderLine['lineStatus'];
  }>;
};

type PurchaseOrderPatch = Partial<Omit<PurchaseOrder, 'poId' | 'createdAt'>> & {
  lines?: PurchaseOrderCreatePayload['lines'];
};

function readList<T>(key: string, fallback: T[], isValid: (value: unknown) => boolean): T[] {
  const rows = readVendorScopedList<T>(key, fallback);
  return rows.every(isValid) ? rows : [];
}

function saveList<T>(key: string, value: T[]): T[] {
  return writeVendorScopedList(key, value);
}

function isPO(value: unknown): boolean {
  return Boolean(value && typeof value === 'object' && 'poId' in value && 'poNumber' in value);
}

function isPOLine(value: unknown): boolean {
  return Boolean(value && typeof value === 'object' && 'lineId' in value && 'poId' in value);
}

function isPOActivity(value: unknown): boolean {
  return Boolean(value && typeof value === 'object' && 'id' in value && 'eventType' in value && 'poId' in value);
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function nextPONumber(orders: PurchaseOrder[]): string {
  const highest = orders.reduce((max, order) => {
    const match = order.poNumber.match(/PO-(\d+)/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `PO-${String(highest + 1).padStart(4, '0')}`;
}

function recalcOrderTotals(order: PurchaseOrder, lines: PurchaseOrderLine[]): PurchaseOrder {
  const subtotalEstimate = lines.reduce((sum, line) => sum + line.estimatedLineTotal, 0);
  const taxSettings = getCachedVendorTaxSettings(order.vendorId || getActiveVendorId());
  const tax = calculateDocumentTax([{ lineAmount: subtotalEstimate }], {
    ...taxSettings,
    pricesIncludeVat: false
  });
  const taxEstimate = tax.vatAmount;
  const grandTotalEstimate = Number((tax.total + order.deliveryCostEstimate).toFixed(2));
  return {
    ...order,
    purchaseOrderId: order.poId,
    purchaseOrderNumber: order.poNumber,
    orderDate: order.poDate,
    expectedDate: order.expectedDeliveryDate,
    subtotalEstimate,
    subtotal: tax.subtotal,
    discountTotal: order.discountTotal || 0,
    taxableAmount: tax.taxableAmount,
    taxEstimate,
    vatTotal: tax.vatAmount,
    grandTotalEstimate,
    grandTotal: grandTotalEstimate,
    updatedAt: nowIso()
  };
}

function normalizeLine(
  line: PurchaseOrderCreatePayload['lines'][number],
  poId: string,
  order?: Pick<PurchaseOrder, 'vendorId' | 'warehouseId'>
): PurchaseOrderLine {
  const qtyOrdered = Number(line.qtyOrdered) || 0;
  const qtyReceived = Number(line.qtyReceived) || 0;
  const estimatedUnitCost = Number(line.estimatedUnitCost) || 0;
  const lineTotal = Number((qtyOrdered * estimatedUnitCost).toFixed(2));
  const lineId = line.lineId || makeId('PO-LINE');
  return {
    ...line,
    lineId,
    purchaseOrderLineId: lineId,
    poId,
    purchaseOrderId: poId,
    vendorId: order?.vendorId,
    warehouseId: order?.warehouseId,
    qtyOrdered,
    qtyReceived,
    qtyOutstanding: Math.max(qtyOrdered - qtyReceived, 0),
    estimatedUnitCost,
    unitCost: estimatedUnitCost,
    estimatedLineTotal: lineTotal,
    taxableAmount: lineTotal,
    vatRate: 0,
    vatAmount: 0,
    lineTotal,
    lineStatus: line.lineStatus || 'Draft'
  };
}

function matchesDateRange(value: string, from?: string, to?: string): boolean {
  if (from && value < from) return false;
  if (to && value > to) return false;
  return true;
}

async function recordActivity(
  order: PurchaseOrder,
  eventType: PurchaseOrderActivityEvent['eventType'],
  operator: string,
  message: string
): Promise<PurchaseOrderActivityEvent[]> {
  const events = await getPurchaseOrderActivityEvents(order.poId, true);
  const nextEvent: PurchaseOrderActivityEvent = {
    id: makeId('PO-ACT'),
    poId: order.poId,
    poNumber: order.poNumber,
    eventType,
    message,
    operator,
    createdAt: nowIso()
  };
  return saveList(PO_ACTIVITY_KEY, [nextEvent, ...events].slice(0, 120));
}

async function recordSupplierValidationFailure(order: PurchaseOrder, message: string): Promise<void> {
  await recordActivity(order, 'PO_SUPPLIER_VALIDATION_FAILED', order.requestedByStaffName, message);
  await flagPOSupplierNotInRecords(order.supplierName, order.requestedByStaffName, order.poId);
}

function hasLinkedSupplier(order: PurchaseOrder): boolean {
  return Boolean(order.supplierName.trim() && order.supplierId.trim());
}

function orderValue(order: PurchaseOrder): number {
  return Number(order.grandTotalEstimate || 0);
}

function supplierIsUsable(order: PurchaseOrder, session: CanonicalPurchaseSession): { ok: boolean; message: string } {
  if (!hasLinkedSupplier(order)) {
    return { ok: false, message: `${order.poNumber} supplier must be selected or created before continuing.` };
  }
  const supplier = getSupplierById(order.supplierId);
  if (!supplier || supplier.vendorId !== session.vendorId) {
    return { ok: false, message: `${order.poNumber} supplier must be linked to this vendor before continuing.` };
  }
  if (!supplier.active || supplier.status === 'inactive' || supplier.status === 'suspended') {
    return { ok: false, message: `${supplier.supplierName} is not active for purchasing.` };
  }
  if (supplier.paymentTermsDays === undefined || supplier.paymentTermsDays === null || supplier.paymentTermsDays < 0) {
    return { ok: false, message: `${supplier.supplierName} must have explicit credit terms before purchasing.` };
  }
  return { ok: true, message: 'Supplier ready.' };
}

async function recordPurchaseOrderRiskWarnings(order: PurchaseOrder, operator: string): Promise<string[]> {
  const warnings: string[] = [];
  try {
    const discipline = await import('./purchaseDisciplineService');
    const capacity = discipline.getCOGSBuyingCapacitySummary();
    const supplierPressure = discipline.calculateSupplierCreditPressure(order.supplierId);
    if (orderValue(order) > capacity.safeBuyingCapacity) {
      warnings.push('Purchase exceeds available stock reserve.');
    }
    if (supplierPressure.limit > 0 && orderValue(order) + supplierPressure.payable > supplierPressure.limit) {
      warnings.push('Supplier credit limit exceeded.');
    }
    if (order.priority === 'Urgent') {
      warnings.push('Urgent purchase bypass requires review.');
    }
    warnings.forEach((warning) => {
      void discipline.createPOWithoutReserveCheckWarning(order.poNumber, operator);
      void createOperationalApproval({
        vendorId: order.vendorId,
        branchId: order.branchId,
        branch: order.branchId,
        category: 'Purchase Order',
        requestedBy: operator,
        requestedByRole: 'Manager',
        relatedRecord: order.poNumber,
        amountOrValue: `${order.currency} ${order.grandTotalEstimate.toFixed(2)}`,
        risk: warning.includes('exceeded') ? 'High' : 'Medium',
        reason: warning,
        context: 'Cash-plan and supplier-credit warning. Purchase Order remains non-posting until receiving.',
        approvalType: 'PURCHASE_CASH_PLAN_WARNING',
        requiredPermission: 'approvals.approve'
      });
    });
  } catch {
    // Purchase discipline is local/mock in this build and must not block PO controls.
  }
  return warnings;
}

export async function getPurchaseOrders(filters: PurchaseOrderFilterState = {}): Promise<PurchaseOrder[]> {
  const orders = readList<PurchaseOrder>(PO_KEY, mockPurchaseOrders, isPO);
  return orders.filter((order) => {
    const matchesPO = !filters.poNumber || order.poNumber.toLowerCase().includes(filters.poNumber.toLowerCase());
    const matchesSupplier = !filters.supplier || order.supplierName.toLowerCase().includes(filters.supplier.toLowerCase());
    const matchesBranch = !filters.branch || filters.branch === 'ALL' || order.branchId === filters.branch || order.deliveryBranchId === filters.branch;
    const matchesWarehouse = !filters.warehouse || filters.warehouse === 'ALL' || order.warehouseId === filters.warehouse || order.deliveryWarehouseId === filters.warehouse;
    const matchesStatus = !filters.status || filters.status === 'ALL' || order.status === filters.status;
    const matchesPriority = !filters.priority || filters.priority === 'ALL' || order.priority === filters.priority;
    const matchesSource = !filters.source || filters.source === 'ALL' || order.source === filters.source;
    const matchesPODate = matchesDateRange(order.poDate, filters.dateFrom, filters.dateTo);
    const matchesExpected = matchesDateRange(order.expectedDeliveryDate, filters.expectedDeliveryFrom, filters.expectedDeliveryTo);
    return matchesPO && matchesSupplier && matchesBranch && matchesWarehouse && matchesStatus && matchesPriority && matchesSource && matchesPODate && matchesExpected;
  });
}

export async function getPurchaseOrderById(poId: string): Promise<PurchaseOrder | null> {
  const orders = await getPurchaseOrders();
  return orders.find((order) => order.poId === poId) || null;
}

export async function getPurchaseOrderLines(poId: string): Promise<PurchaseOrderLine[]> {
  return readList<PurchaseOrderLine>(PO_LINE_KEY, mockPurchaseOrderLines, isPOLine)
    .filter((line) => line.poId === poId);
}

export async function getPurchaseOrderSummary(filters: PurchaseOrderFilterState = {}): Promise<PurchaseOrderSummary> {
  const orders = await getPurchaseOrders(filters);
  const lines = readList<PurchaseOrderLine>(PO_LINE_KEY, mockPurchaseOrderLines, isPOLine);
  const orderIds = new Set(orders.map((order) => order.poId));
  return {
    totalPOs: orders.length,
    draftPOs: orders.filter((order) => order.status === 'Draft').length,
    pendingApproval: orders.filter((order) => order.status === 'Pending Approval').length,
    approved: orders.filter((order) => order.status === 'Approved').length,
    sentToSupplier: orders.filter((order) => order.status === 'Sent To Supplier').length,
    partiallyReceived: orders.filter((order) => order.status === 'Partially Received').length,
    fullyReceived: orders.filter((order) => order.status === 'Fully Received').length,
    cancelled: orders.filter((order) => order.status === 'Cancelled').length,
    estimatedPOValue: orders.reduce((sum, order) => sum + order.grandTotalEstimate, 0),
    outstandingQty: lines
      .filter((line) => orderIds.has(line.poId))
      .reduce((sum, line) => sum + line.qtyOutstanding, 0)
  };
}

export async function createPurchaseOrder(payload: PurchaseOrderCreatePayload): Promise<PurchaseOrder> {
  const session = assertCanonicalPurchaseSession();
  const orders = readList<PurchaseOrder>(PO_KEY, mockPurchaseOrders, isPO);
  const poId = payload.poId || makeId('PO-ID');
  const createdAt = nowIso();
  const supplier = payload.supplierId ? getSupplierById(payload.supplierId) : null;
  if (!supplier || supplier.vendorId !== session.vendorId) {
    throw new Error('Select an active supplier before creating a Purchase Order.');
  }
  if (!supplier.active || supplier.status === 'inactive' || supplier.status === 'suspended') {
    throw new Error(`${supplier.supplierName} is not active for purchasing.`);
  }
  const order: PurchaseOrder = {
    ...payload,
    poId,
    purchaseOrderId: poId,
    poNumber: payload.poNumber || nextPONumber(orders),
    purchaseOrderNumber: payload.poNumber || nextPONumber(orders),
    vendorId: session.vendorId,
    branchId: session.branchId,
    warehouseId: session.warehouseId,
    deliveryBranchId: session.branchId,
    deliveryWarehouseId: session.warehouseId,
    requestedByStaffId: session.staffId,
    requestedByStaffName: session.staffName,
    supplierName: supplier.supplierName,
    supplierCode: supplier.supplierCode,
    supplierPhone: supplier.phone,
    supplierEmail: supplier.email,
    supplierAddress: supplier.address,
    supplierContactPerson: supplier.contactPerson,
    paymentTermsDays: supplier.paymentTermsDays,
    paymentMethod: payload.paymentMethod || (supplier.paymentTermsDays > 0 ? 'Supplier Credit' : 'Cash'),
    approvalStatus: payload.status === 'Pending Approval' ? 'Pending' : payload.status === 'Approved' ? 'Approved' : 'Not Required',
    postingStatus: 'Not Posted',
    createdBy: session.staffId,
    createdAt,
    updatedAt: createdAt
  };
  const lines = payload.lines.map((line) => normalizeLine(line, poId, order));
  const savedOrder = recalcOrderTotals(order, lines);
  const allLines = readList<PurchaseOrderLine>(PO_LINE_KEY, mockPurchaseOrderLines, isPOLine);
  saveList(PO_KEY, [savedOrder, ...orders]);
  saveList(PO_LINE_KEY, [...lines, ...allLines]);
  await recordActivity(savedOrder, 'PURCHASE_ORDER_DRAFT_CREATED', session.staffName, `${savedOrder.poNumber} draft memo created. No stock, accounting, cashbook, COGS or inventory value posted.`);
  if (savedOrder.supplierId) {
    recordSupplierActivity('SUPPLIER_LINKED_TO_PURCHASE_ORDER', `${savedOrder.supplierName} linked to ${savedOrder.poNumber}.`, session.staffId, savedOrder.supplierId, savedOrder.poId);
  }
  if (!`${payload.notes || ''} ${payload.internalMemo || ''}`.includes('PDR-')) {
    try {
      const { createPOWithoutReserveCheckWarning } = await import('./purchaseDisciplineService');
      await createPOWithoutReserveCheckWarning(savedOrder.poNumber, session.staffId);
    } catch {
      // Purchase discipline warnings are local/mock and must not block PO creation.
    }
  }
  await recordPurchaseOrderRiskWarnings(savedOrder, session.staffName);
  return savedOrder;
}

export async function updatePurchaseOrderDraft(poId: string, patch: PurchaseOrderPatch): Promise<PurchaseOrder | null> {
  const session = assertCanonicalPurchaseSession();
  const orders = readList<PurchaseOrder>(PO_KEY, mockPurchaseOrders, isPO);
  const order = orders.find((item) => item.poId === poId);
  if (!order || ['Fully Received', 'Closed', 'Closed With Outstanding', 'Cancelled'].includes(order.status)) return null;
  if (order.vendorId !== session.vendorId) return null;
  const supplierId = patch.supplierId || order.supplierId;
  const supplier = supplierId ? getSupplierById(supplierId) : null;
  if (!supplier || supplier.vendorId !== session.vendorId || !supplier.active || supplier.status === 'inactive' || supplier.status === 'suspended') {
    throw new Error('Select an active supplier before saving this Purchase Order.');
  }

  let nextLines = readList<PurchaseOrderLine>(PO_LINE_KEY, mockPurchaseOrderLines, isPOLine);
  if (patch.lines) {
    nextLines = [
      ...patch.lines.map((line) => normalizeLine(line, poId, { vendorId: session.vendorId, warehouseId: session.warehouseId })),
      ...nextLines.filter((line) => line.poId !== poId)
    ];
    saveList(PO_LINE_KEY, nextLines);
  }

  const updatedBase: PurchaseOrder = {
    ...order,
    ...patch,
    poId,
    purchaseOrderId: poId,
    vendorId: session.vendorId,
    branchId: session.branchId,
    warehouseId: session.warehouseId,
    deliveryBranchId: session.branchId,
    deliveryWarehouseId: session.warehouseId,
    supplierName: supplier.supplierName,
    supplierCode: supplier.supplierCode,
    supplierPhone: supplier.phone,
    supplierEmail: supplier.email,
    supplierAddress: supplier.address,
    supplierContactPerson: supplier.contactPerson,
    paymentTermsDays: supplier.paymentTermsDays,
    status: patch.status || order.status,
    updatedAt: nowIso()
  };
  const updatedOrder = recalcOrderTotals(updatedBase, nextLines.filter((line) => line.poId === poId));
  saveList(PO_KEY, orders.map((item) => item.poId === poId ? updatedOrder : item));
  await recordActivity(updatedOrder, 'PURCHASE_ORDER_UPDATED', session.staffName, `${updatedOrder.poNumber} purchase order updated. No stock or accounting posted.`);
  if (updatedOrder.supplierId) {
    recordSupplierActivity('SUPPLIER_LINKED_TO_PURCHASE_ORDER', `${updatedOrder.supplierName} linked to ${updatedOrder.poNumber}.`, session.staffId, updatedOrder.supplierId, updatedOrder.poId);
  }
  await recordPurchaseOrderRiskWarnings(updatedOrder, session.staffName);
  return updatedOrder;
}

async function updateStatus(
  poId: string,
  status: PurchaseOrderStatus,
  staffId: string,
  staffName: string,
  eventType: PurchaseOrderActivityEvent['eventType'],
  message: string,
  patch: Partial<PurchaseOrder> = {}
): Promise<PurchaseOrder | null> {
  const session = assertCanonicalPurchaseSession();
  const orders = readList<PurchaseOrder>(PO_KEY, mockPurchaseOrders, isPO);
  const current = orders.find((order) => order.poId === poId);
  if (!current) return null;
  if (current.vendorId !== session.vendorId) return null;
  const updated: PurchaseOrder = {
    ...current,
    ...patch,
    status,
    approvalStatus: status === 'Pending Approval' ? 'Pending' : status === 'Approved' ? 'Approved' : patch.approvalStatus ?? current.approvalStatus,
    postingStatus: status === 'Fully Received' || status === 'Closed' ? 'Closed' : current.postingStatus || 'Not Posted',
    approvedByStaffId: status === 'Approved' ? session.staffId : patch.approvedByStaffId ?? current.approvedByStaffId,
    approvedByStaffName: status === 'Approved' ? session.staffName : patch.approvedByStaffName ?? current.approvedByStaffName,
    approvedBy: status === 'Approved' ? session.staffId : patch.approvedBy ?? current.approvedBy,
    updatedAt: nowIso()
  };
  saveList(PO_KEY, orders.map((order) => order.poId === poId ? updated : order));
  await recordActivity(updated, eventType, session.staffName || staffName || staffId, message);
  return updated;
}

export async function submitPurchaseOrderForApproval(poId: string): Promise<PurchaseOrder | null> {
  const session = assertCanonicalPurchaseSession();
  const order = await getPurchaseOrderById(poId);
  if (!order) return null;
  const lines = await getPurchaseOrderLines(poId);
  const supplierValidation = supplierIsUsable(order, session);
  if (!supplierValidation.ok) {
    await recordSupplierValidationFailure(order, supplierValidation.message);
    return null;
  }
  if (lines.length === 0 || lines.some((line) => line.qtyOrdered <= 0 || line.estimatedUnitCost < 0)) {
    return null;
  }

  await createOperationalApproval({
    vendorId: order.vendorId,
    branchId: order.branchId,
    branch: order.branchId,
    category: 'Purchase Order',
    requestedBy: session.staffName,
    requestedByRole: session.role,
    relatedRecord: order.poNumber,
    amountOrValue: `${order.currency} ${order.grandTotalEstimate.toFixed(2)}`,
    risk: order.priority === 'Urgent' ? 'High' : 'Medium',
    reason: 'Purchase Order Approval Required',
    context: `Inventory / Purchase Orders approval for ${order.poNumber}. PO is a procurement memo only and posts no stock or financial values.`,
    requiredPermission: 'approvals.approve'
  });

  return updateStatus(
    poId,
    'Pending Approval',
    session.staffId,
    session.staffName,
    'PURCHASE_ORDER_SUBMITTED_FOR_APPROVAL',
    `${order.poNumber} submitted for approval. Purchase Order Approval Required.`
  );
}

export async function approvePurchaseOrder(poId: string, staffId: string, notes = ''): Promise<PurchaseOrder | null> {
  const session = assertCanonicalPurchaseSession();
  const order = await getPurchaseOrderById(poId);
  if (!order) return null;
  const supplierValidation = supplierIsUsable(order, session);
  if (!supplierValidation.ok) {
    await recordSupplierValidationFailure(order, supplierValidation.message);
    return null;
  }
  const restricted = order.grandTotalEstimate >= 1000 || order.priority === 'Urgent';
  if (restricted && order.requestedByStaffId === session.staffId && !hasPurchasePermission(session, 'purchaseOrders.selfApprove')) {
    await recordActivity(order, 'PO_SUPPLIER_VALIDATION_FAILED', session.staffName, `${order.poNumber} requires independent approval.`);
    return null;
  }
  return updateStatus(
    poId,
    'Approved',
    session.staffId || staffId,
    session.staffName,
    'PURCHASE_ORDER_APPROVED',
    `${order.poNumber} approved as a supplier ordering memo. ${notes}`.trim()
  );
}

export async function markPurchaseOrderSent(poId: string, staffId: string): Promise<PurchaseOrder | null> {
  const session = assertCanonicalPurchaseSession();
  const order = await getPurchaseOrderById(poId);
  if (!order) return null;
  const supplierValidation = supplierIsUsable(order, session);
  if (!supplierValidation.ok) {
    await recordSupplierValidationFailure(order, supplierValidation.message);
    return null;
  }
  return updateStatus(
    poId,
    'Sent To Supplier',
    session.staffId || staffId,
    session.staffName,
    'PURCHASE_ORDER_SENT_TO_SUPPLIER',
    `${order.poNumber} marked sent to supplier. No stock, cashbook or accounting posting was created.`
  );
}

export async function cancelPurchaseOrder(poId: string, staffId: string, reason: string): Promise<PurchaseOrder | null> {
  const order = await getPurchaseOrderById(poId);
  if (!order || !reason.trim()) return null;
  return updateStatus(
    poId,
    'Cancelled',
    staffId,
    staffId,
    'PURCHASE_ORDER_CANCELLED',
    `${order.poNumber} cancelled. Reason: ${reason}.`
  );
}

export async function closePurchaseOrder(poId: string, staffId: string, notes = ''): Promise<PurchaseOrder | null> {
  const order = await getPurchaseOrderById(poId);
  if (!order) return null;
  return updateStatus(
    poId,
    'Closed',
    staffId,
    staffId,
    'PURCHASE_ORDER_CLOSED',
    `${order.poNumber} closed. ${notes}`.trim()
  );
}

export async function createGoodsReceivingDraftFromPO(poId: string): Promise<{ message: string; order: PurchaseOrder; lines: PurchaseOrderLine[]; grnId?: string; grnNumber?: string } | null> {
  const order = await getPurchaseOrderById(poId);
  if (!order) return null;
  const draft = await createGRNDraftFromPO(poId, order.requestedByStaffName);
  const summary = await getPOReceivingSummary(poId);
  const outstandingLineIds = new Set((summary?.lineStates || []).filter((line) => line.qtyOutstanding > 0).map((line) => line.poLineId));
  const lines = (await getPurchaseOrderLines(poId)).filter((line) => outstandingLineIds.has(line.lineId));
  await recordActivity(
    order,
    'PURCHASE_ORDER_RECEIVING_DRAFT_CREATED',
    order.requestedByStaffName,
    `${draft?.grnNumber || 'Goods Receiving draft'} prepared from outstanding PO lines. Stock will update only after received quantities are posted.`
  );
  return {
    message: 'Goods Receiving draft prepared from PO. Stock will update only after received quantities are posted.',
    order,
    lines,
    grnId: draft?.grnId,
    grnNumber: draft?.grnNumber
  };
}

export async function exportPurchaseOrderPlaceholder(poId: string): Promise<{ success: boolean; message: string }> {
  const order = await getPurchaseOrderById(poId);
  if (!order) return { success: false, message: 'Purchase Order not found.' };
  const identity = getVendorDocumentIdentity({ vendorId: order.vendorId, branchId: order.branchId || order.deliveryBranchId, warehouseId: order.warehouseId || order.deliveryWarehouseId });
  if (!hasLinkedSupplier(order)) {
    await recordSupplierValidationFailure(order, `${order.poNumber} supplier must be selected or created before export preparation.`);
    return { success: false, message: 'Supplier must be selected or created before preparing Purchase Order export.' };
  }
  await recordActivity(
    order,
    'PURCHASE_ORDER_EXPORT_PREPARED',
    order.requestedByStaffName,
    `${order.poNumber} export prepared for ${identity.displayName}. No financial posting created.`
  );
  return { success: true, message: `${order.poNumber} export prepared for ${identity.displayName}.` };
}

export async function getPurchaseOrderActivityEvents(poId?: string, includeAll = false): Promise<PurchaseOrderActivityEvent[]> {
  const events = readList<PurchaseOrderActivityEvent>(PO_ACTIVITY_KEY, mockPurchaseOrderActivityEvents, isPOActivity);
  if (includeAll || !poId) return events;
  return events.filter((event) => event.poId === poId);
}
