import { CommerceOperationContext } from '../../commerce-integration';

/**
 * STATUS: DRAFT -> PENDING_APPROVAL -> APPROVED -> COMPLETED
 *       |                                        |
 *       +--------------------> CANCELLED <--------+
 */
export type ProductTransformationStatus =
  | 'Draft'
  | 'Pending Approval'
  | 'Approved'
  | 'Completed'
  | 'Cancelled'
  | 'Rejected';

export interface ProductTransformationInputLine {
  lineId: string;
  transformationId: string;
  productId: string;
  sku: string;
  productName: string;
  qtyConsumed: number;
  unitCost: number;
  totalCost: number;
  sourceWarehouseId: string;
  sourceShelfLocation?: string;
}

export interface ProductTransformationOutputLine {
  lineId: string;
  transformationId: string;
  productId: string;
  sku: string;
  productName: string;
  qtyProduced: number;
  unitCost: number; // Can be calculated from sum of input costs
  totalValue: number;
  destinationWarehouseId: string;
  destinationShelfLocation?: string;
}

export interface ProductTransformation {
  transformationId: string;
  transformationNumber: string;
  status: ProductTransformationStatus;
  vendorId: string;
  branchId: string;
  transformationDate: string;
  notes?: string;
  requestedByStaffId: string;
  requestedByStaffName: string;
  approvedByStaffId?: string;
  completedByStaffId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductTransformationDraftPayload {
  vendorId: string;
  branchId: string;
  requestedByStaffId: string;
  requestedByStaffName: string;
  notes?: string;
  // Lines will be added via separate functions
}

export interface ProductTransformationPostingResult {
  transformationId: string;
  transformationNumber: string;
  status: ProductTransformationStatus;
  stockPosted: boolean;
  message: string;
}

const TRANSFORMATION_KEY = 'itred_pos_product_transformations_v1';
const INPUT_LINE_KEY = 'itred_pos_product_transformation_inputs_v1';
const OUTPUT_LINE_KEY = 'itred_pos_product_transformation_outputs_v1';

let mockTransformations: ProductTransformation[] = [];
let mockInputLines: ProductTransformationInputLine[] = [];
let mockOutputLines: ProductTransformationOutputLine[] = [];

function readList<T>(key: string, fallback: T[]): T[] {
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : fallback;
  } catch {
    return fallback;
  }
}

function saveList<T>(key: string, data: T[]): void {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch {
      // Ignore persistence errors in environments where it's blocked
    }
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

/**
 * Creates a new draft product transformation job.
 * This is the initial step before defining input and output lines.
 */
export async function createTransformationDraft(
  payload: ProductTransformationDraftPayload,
  context?: CommerceOperationContext
): Promise<ProductTransformation> {
  const records = readList<ProductTransformation>(TRANSFORMATION_KEY, mockTransformations);
  const record: ProductTransformation = {
    transformationId: makeId('TRN-ID'),
    transformationNumber: `TRN-${String(records.length + 1).padStart(4, '0')}`,
    status: 'Draft',
    transformationDate: nowIso().slice(0, 10),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    ...payload,
  };
  saveList(TRANSFORMATION_KEY, [record, ...records]);

  // TODO: Publish TransformationCreated event after successful draft creation
  // if (context) {
  //   publishCommerceEvent({ eventType: 'TransformationCreated', ... });
  //   writeAuditLog({ action: 'TransformationCreated', ... });
  // }

  return record;
}

/**
 * Retrieves a list of product transformations, optionally filtered.
 */
export async function getTransformations(filters: { status?: ProductTransformationStatus } = {}): Promise<ProductTransformation[]> {
  const records = readList<ProductTransformation>(TRANSFORMATION_KEY, mockTransformations);
  return records
    .filter(record => !filters.status || record.status === filters.status)
    .sort((a, b) => b.transformationNumber.localeCompare(a.transformationNumber));
}

/**
 * Retrieves a single product transformation by its ID.
 */
export async function getTransformationById(transformationId: string): Promise<ProductTransformation | null> {
  return readList<ProductTransformation>(TRANSFORMATION_KEY, mockTransformations).find(t => t.transformationId === transformationId) || null;
}

/**
 * Approves a transformation, allowing it to be posted.
 */
export async function approveTransformation(transformationId: string, staffId: string): Promise<ProductTransformation | null> {
  // Placeholder: Find, update status to 'Approved', and save.
  console.log(`[TODO] Approve transformation ${transformationId} by ${staffId}`);
  return getTransformationById(transformationId);
}

/**
 * Cancels a draft or approved transformation.
 */
export async function cancelTransformation(
  transformationId: string,
  context?: CommerceOperationContext
): Promise<ProductTransformation | null> {
  // Placeholder: Find, update status to 'Cancelled', and save.
  console.log(`[TODO] Cancel transformation ${transformationId}`);

  // TODO: Publish TransformationCancelled event
  // if (context) {
  //   publishCommerceEvent({ eventType: 'TransformationCancelled', ... });
  //   writeAuditLog({ action: 'TransformationCancelled', ... });
  // }

  return getTransformationById(transformationId);
}

/**
 * Posts the transformation, consuming input stock and creating output stock.
 */
export async function postTransformation(
  transformationId: string,
  context?: CommerceOperationContext
): Promise<ProductTransformationPostingResult> {
  const transformation = await getTransformationById(transformationId);
  if (!transformation || (transformation.status !== 'Approved' && transformation.status !== 'Draft')) {
    return { transformationId, transformationNumber: '', status: 'Draft', stockPosted: false, message: 'Transformation not found or not in a postable state.' };
  }

  // TODO: Post inventory movements for input lines (RAW_TO_FINISHED_OUT or similar)
  console.log('[TODO] Post inventory movements for consumed input items.');

  // TODO: Post inventory movements for output lines (RAW_TO_FINISHED_IN or similar)
  console.log('[TODO] Post inventory movements for produced output items.');

  // TODO: Update transformation status to 'Completed' and save.

  // TODO: Publish TransformationCompleted event after all movements are successful.
  // if (context) {
  //   publishCommerceEvent({ eventType: 'TransformationCompleted', ... });
  //   writeAuditLog({ action: 'TransformationCompleted', ... });
  // }

  return {
    transformationId,
    transformationNumber: transformation.transformationNumber,
    status: 'Completed',
    stockPosted: true,
    message: 'Transformation posted successfully (placeholder).',
  };
}