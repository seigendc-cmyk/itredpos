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
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(fallback));
      return fallback;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every(isValid) ? parsed as T[] : fallback;
  } catch {
    try {
      localStorage.setItem(key, JSON.stringify(fallback));
    } catch {
      // Local storage can be unavailable in restricted browser modes.
    }
    return fallback;
  }
}

function saveList<T>(key: string, value: T[]): T[] {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Purchase Orders remain in memory for the current action if persistence fails.
    }
  }
  return value;
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
  const taxEstimate = Number((subtotalEstimate * 0.15).toFixed(2));
  const grandTotalEstimate = Number((subtotalEstimate + taxEstimate + order.deliveryCostEstimate).toFixed(2));
  return {
    ...order,
    subtotalEstimate,
    taxEstimate,
    grandTotalEstimate,
    updatedAt: nowIso()
  };
}

function normalizeLine(
  line: PurchaseOrderCreatePayload['lines'][number],
  poId: string
): PurchaseOrderLine {
  const qtyOrdered = Number(line.qtyOrdered) || 0;
  const qtyReceived = Number(line.qtyReceived) || 0;
  const estimatedUnitCost = Number(line.estimatedUnitCost) || 0;
  return {
    ...line,
    lineId: line.lineId || makeId('PO-LINE'),
    poId,
    qtyOrdered,
    qtyReceived,
    qtyOutstanding: Math.max(qtyOrdered - qtyReceived, 0),
    estimatedUnitCost,
    estimatedLineTotal: Number((qtyOrdered * estimatedUnitCost).toFixed(2)),
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
  const orders = readList<PurchaseOrder>(PO_KEY, mockPurchaseOrders, isPO);
  const poId = payload.poId || makeId('PO-ID');
  const createdAt = nowIso();
  const order: PurchaseOrder = {
    ...payload,
    poId,
    poNumber: payload.poNumber || nextPONumber(orders),
    createdAt,
    updatedAt: createdAt
  };
  const lines = payload.lines.map((line) => normalizeLine(line, poId));
  const savedOrder = recalcOrderTotals(order, lines);
  const allLines = readList<PurchaseOrderLine>(PO_LINE_KEY, mockPurchaseOrderLines, isPOLine);
  saveList(PO_KEY, [savedOrder, ...orders]);
  saveList(PO_LINE_KEY, [...lines, ...allLines]);
  await recordActivity(savedOrder, 'PURCHASE_ORDER_DRAFT_CREATED', payload.requestedByStaffName, `${savedOrder.poNumber} draft memo created. No stock, accounting, cashbook, COGS or inventory value posted.`);
  return savedOrder;
}

export async function updatePurchaseOrderDraft(poId: string, patch: PurchaseOrderPatch): Promise<PurchaseOrder | null> {
  const orders = readList<PurchaseOrder>(PO_KEY, mockPurchaseOrders, isPO);
  const order = orders.find((item) => item.poId === poId);
  if (!order || order.status !== 'Draft') return null;

  let nextLines = readList<PurchaseOrderLine>(PO_LINE_KEY, mockPurchaseOrderLines, isPOLine);
  if (patch.lines) {
    nextLines = [
      ...patch.lines.map((line) => normalizeLine(line, poId)),
      ...nextLines.filter((line) => line.poId !== poId)
    ];
    saveList(PO_LINE_KEY, nextLines);
  }

  const updatedBase: PurchaseOrder = {
    ...order,
    ...patch,
    poId,
    status: patch.status || order.status,
    updatedAt: nowIso()
  };
  const updatedOrder = recalcOrderTotals(updatedBase, nextLines.filter((line) => line.poId === poId));
  saveList(PO_KEY, orders.map((item) => item.poId === poId ? updatedOrder : item));
  await recordActivity(updatedOrder, 'PURCHASE_ORDER_UPDATED', updatedOrder.requestedByStaffName, `${updatedOrder.poNumber} draft memo updated. No stock or accounting posted.`);
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
  const orders = readList<PurchaseOrder>(PO_KEY, mockPurchaseOrders, isPO);
  const current = orders.find((order) => order.poId === poId);
  if (!current) return null;
  const updated: PurchaseOrder = {
    ...current,
    ...patch,
    status,
    approvedByStaffId: status === 'Approved' ? staffId : patch.approvedByStaffId ?? current.approvedByStaffId,
    approvedByStaffName: status === 'Approved' ? staffName : patch.approvedByStaffName ?? current.approvedByStaffName,
    updatedAt: nowIso()
  };
  saveList(PO_KEY, orders.map((order) => order.poId === poId ? updated : order));
  await recordActivity(updated, eventType, staffName, message);
  return updated;
}

export async function submitPurchaseOrderForApproval(poId: string): Promise<PurchaseOrder | null> {
  const order = await getPurchaseOrderById(poId);
  if (!order) return null;
  const lines = await getPurchaseOrderLines(poId);
  if (!order.supplierName.trim() || lines.length === 0 || lines.some((line) => line.qtyOrdered <= 0 || line.estimatedUnitCost < 0)) {
    return null;
  }

  await createOperationalApproval({
    vendorId: order.vendorId,
    branchId: order.branchId,
    branch: order.branchId,
    category: 'Purchase Order',
    requestedBy: order.requestedByStaffName,
    requestedByRole: 'Stock Controller',
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
    order.requestedByStaffId,
    order.requestedByStaffName,
    'PURCHASE_ORDER_SUBMITTED_FOR_APPROVAL',
    `${order.poNumber} submitted for approval. Purchase Order Approval Required.`
  );
}

export async function approvePurchaseOrder(poId: string, staffId: string, notes = ''): Promise<PurchaseOrder | null> {
  const order = await getPurchaseOrderById(poId);
  if (!order) return null;
  return updateStatus(
    poId,
    'Approved',
    staffId,
    staffId,
    'PURCHASE_ORDER_APPROVED',
    `${order.poNumber} approved as a supplier ordering memo. ${notes}`.trim()
  );
}

export async function markPurchaseOrderSent(poId: string, staffId: string): Promise<PurchaseOrder | null> {
  const order = await getPurchaseOrderById(poId);
  if (!order) return null;
  return updateStatus(
    poId,
    'Sent To Supplier',
    staffId,
    staffId,
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

export async function createGoodsReceivingDraftFromPO(poId: string): Promise<{ message: string; order: PurchaseOrder; lines: PurchaseOrderLine[] } | null> {
  const order = await getPurchaseOrderById(poId);
  if (!order) return null;
  const lines = await getPurchaseOrderLines(poId);
  await recordActivity(
    order,
    'PURCHASE_ORDER_RECEIVING_DRAFT_CREATED',
    order.requestedByStaffName,
    'Goods Receiving draft prepared from PO. Stock will update only after received quantities are posted.'
  );
  return {
    message: 'Goods Receiving draft prepared from PO. Stock will update only after received quantities are posted.',
    order,
    lines
  };
}

export async function exportPurchaseOrderPlaceholder(poId: string): Promise<{ success: boolean; message: string }> {
  const order = await getPurchaseOrderById(poId);
  if (!order) return { success: false, message: 'Purchase Order not found.' };
  await recordActivity(
    order,
    'PURCHASE_ORDER_EXPORT_PREPARED',
    order.requestedByStaffName,
    `${order.poNumber} export placeholder prepared. No financial posting created.`
  );
  return { success: true, message: `${order.poNumber} export placeholder prepared.` };
}

export async function getPurchaseOrderActivityEvents(poId?: string, includeAll = false): Promise<PurchaseOrderActivityEvent[]> {
  const events = readList<PurchaseOrderActivityEvent>(PO_ACTIVITY_KEY, mockPurchaseOrderActivityEvents, isPOActivity);
  if (includeAll || !poId) return events;
  return events.filter((event) => event.poId === poId);
}
