import type { Product } from '../types';
import { readVendorScopedList, writeVendorScopedList } from '../utils/vendorDataMode';
import { createOperationalApproval } from './approvalService';
import { assertCanonicalPurchaseSession, type CanonicalPurchaseSession } from './purchaseSessionService';

export type PurchaseRequestStatus = 'Draft' | 'Review Required' | 'Pending Approval' | 'Approved' | 'Converted' | 'Cancelled' | 'Rejected';
export type PurchaseRequestPriority = 'Low' | 'Normal' | 'High' | 'Urgent';

export interface PurchaseRequestLine {
  lineId: string;
  productId: string;
  sku: string;
  productName: string;
  quantityRequested: number;
  currentStock: number;
  reorderLevel: number;
  preferredSupplierId?: string;
  estimatedUnitCost: number;
  estimatedTotal: number;
}

export interface PurchaseRequest {
  requestId: string;
  vendorId: string;
  branchId: string;
  warehouseId: string;
  requestedBy: string;
  requestedAt: string;
  reason: string;
  status: PurchaseRequestStatus;
  priority: PurchaseRequestPriority;
  requiredByDate?: string;
  lines: PurchaseRequestLine[];
  approvalStatus: 'Not Required' | 'Pending' | 'Approved' | 'Rejected';
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseRequestCreateInput {
  reason: string;
  priority?: PurchaseRequestPriority;
  requiredByDate?: string;
  lines: Array<Partial<PurchaseRequestLine> & Pick<PurchaseRequestLine, 'productId' | 'sku' | 'productName' | 'quantityRequested'>>;
  session?: CanonicalPurchaseSession | null;
}

const PURCHASE_REQUEST_KEY = 'itred_pos_purchase_requests_v1';
const HIGH_VALUE_REQUEST_THRESHOLD = 1000;

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function money(value: unknown): number {
  const amount = Number(value);
  return Number.isFinite(amount) ? Number(Math.max(0, amount).toFixed(2)) : 0;
}

function readRequests(vendorId?: string): PurchaseRequest[] {
  return readVendorScopedList<PurchaseRequest>(PURCHASE_REQUEST_KEY, [], vendorId);
}

function saveRequests(requests: PurchaseRequest[], vendorId?: string): PurchaseRequest[] {
  return writeVendorScopedList(PURCHASE_REQUEST_KEY, requests, vendorId);
}

function normalizeLine(line: PurchaseRequestCreateInput['lines'][number]): PurchaseRequestLine {
  const quantityRequested = money(line.quantityRequested);
  const estimatedUnitCost = money(line.estimatedUnitCost);
  return {
    lineId: line.lineId || makeId('PR-LINE'),
    productId: line.productId,
    sku: line.sku,
    productName: line.productName,
    quantityRequested,
    currentStock: Number(line.currentStock || 0),
    reorderLevel: Number(line.reorderLevel || 0),
    preferredSupplierId: line.preferredSupplierId,
    estimatedUnitCost,
    estimatedTotal: Number((quantityRequested * estimatedUnitCost).toFixed(2))
  };
}

export function buildPurchaseRequestLineFromProduct(product: Product, quantityRequested: number): PurchaseRequestLine {
  const estimatedUnitCost = money(product.costPrice ?? product.cost ?? 0);
  const currentStock = Number(product.qtyOnHand ?? product.stock ?? product.availableStock ?? 0);
  return {
    lineId: makeId('PR-LINE'),
    productId: product.id,
    sku: product.sku || product.code,
    productName: product.productName || product.name,
    quantityRequested,
    currentStock,
    reorderLevel: Number(product.reorderLevel ?? product.minStock ?? 0),
    preferredSupplierId: product.supplierId,
    estimatedUnitCost,
    estimatedTotal: Number((quantityRequested * estimatedUnitCost).toFixed(2))
  };
}

export function validatePurchaseRequest(input: PurchaseRequestCreateInput): { valid: boolean; errors: string[]; approvalRequired: boolean; total: number } {
  const errors: string[] = [];
  if (!input.reason.trim()) errors.push('Purchase request reason is required.');
  if (input.lines.length === 0) errors.push('At least one purchase request line is required.');
  const lines = input.lines.map(normalizeLine);
  lines.forEach((line) => {
    if (line.quantityRequested <= 0) errors.push(`${line.sku}: quantity requested must be greater than zero.`);
  });
  const total = lines.reduce((sum, line) => sum + line.estimatedTotal, 0);
  const approvalRequired = total >= HIGH_VALUE_REQUEST_THRESHOLD || input.priority === 'Urgent';
  return { valid: errors.length === 0, errors, approvalRequired, total };
}

export async function createPurchaseRequest(input: PurchaseRequestCreateInput): Promise<PurchaseRequest> {
  const session = assertCanonicalPurchaseSession(input.session);
  const validation = validatePurchaseRequest(input);
  if (!validation.valid) throw new Error(validation.errors.join(' '));

  const createdAt = nowIso();
  const request: PurchaseRequest = {
    requestId: makeId('PR-ID'),
    vendorId: session.vendorId,
    branchId: session.branchId,
    warehouseId: session.warehouseId,
    requestedBy: session.staffId,
    requestedAt: createdAt,
    reason: input.reason.trim(),
    status: validation.approvalRequired ? 'Pending Approval' : 'Review Required',
    priority: input.priority || 'Normal',
    requiredByDate: input.requiredByDate,
    lines: input.lines.map(normalizeLine),
    approvalStatus: validation.approvalRequired ? 'Pending' : 'Not Required',
    createdAt,
    updatedAt: createdAt
  };

  saveRequests([request, ...readRequests(session.vendorId)], session.vendorId);

  if (validation.approvalRequired) {
    await createOperationalApproval({
      vendorId: session.vendorId,
      branchId: session.branchId,
      branch: session.branchName,
      category: 'Purchase Order',
      requestedBy: session.staffName,
      requestedByRole: normalizeOperationalRole(session.role),
      relatedRecord: request.requestId,
      amountOrValue: `USD ${validation.total.toFixed(2)}`,
      risk: input.priority === 'Urgent' ? 'High' : 'Medium',
      reason: 'Purchase request approval required.',
      context: 'Purchase request does not create inventory, supplier liability, cashbook or accounting posting.',
      approvalType: 'PURCHASE_REQUEST_APPROVAL',
      requiredPermission: 'approvals.approve'
    });
  }

  return request;
}

export function getPurchaseRequests(filters: Partial<{ vendorId: string; status: PurchaseRequestStatus | 'ALL' }> = {}): PurchaseRequest[] {
  return readRequests(filters.vendorId)
    .filter((request) => !filters.vendorId || request.vendorId === filters.vendorId)
    .filter((request) => !filters.status || filters.status === 'ALL' || request.status === filters.status)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function markPurchaseRequestConverted(requestId: string, purchaseOrderId: string, session?: CanonicalPurchaseSession | null): PurchaseRequest | null {
  const currentSession = assertCanonicalPurchaseSession(session);
  const requests = readRequests(currentSession.vendorId);
  let updated: PurchaseRequest | null = null;
  saveRequests(requests.map((request) => {
    if (request.requestId !== requestId || request.vendorId !== currentSession.vendorId) return request;
    updated = {
      ...request,
      status: 'Converted',
      updatedAt: nowIso(),
      reason: `${request.reason}\nConverted to Purchase Order ${purchaseOrderId}.`
    };
    return updated;
  }), currentSession.vendorId);
  return updated;
}
import { normalizeOperationalRole } from '../auth/roleNormalization';
