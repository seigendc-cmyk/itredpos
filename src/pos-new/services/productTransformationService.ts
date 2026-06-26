import { CommerceOperationContext, publishCommerceEvent, writeAuditLog } from '../../commerce-integration';

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

function updateTransformation(transformationId: string, patch: Partial<ProductTransformation>): ProductTransformation | null {
  let updated: ProductTransformation | null = null;
  const nextRecords = readList<ProductTransformation>(TRANSFORMATION_KEY, mockTransformations).map(record => {
    if (record.transformationId === transformationId) {
      updated = { ...record, ...patch, updatedAt: nowIso() };
      return updated;
    }
    return record;
  });
  if (updated) {
    saveList(TRANSFORMATION_KEY, nextRecords);
  }
  return updated;
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

  if (context) {
    void publishCommerceEvent({
      eventType: 'TransformationCreated',
      ...context,
      module: 'ProductTransformation',
      entityType: 'ProductTransformation',
      entityId: record.transformationId,
      payload: { summary: `Transformation ${record.transformationNumber} created in draft.` }
    });
    void writeAuditLog({
      ...context,
      module: 'ProductTransformation',
      action: 'TransformationCreated',
      entityType: 'ProductTransformation',
      entityId: record.transformationId,
      before: {},
      after: { status: 'Draft', requestedBy: payload.requestedByStaffName }
    });
  }
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
export async function approveTransformation(
  transformationId: string,
  staffId: string,
  context?: CommerceOperationContext
): Promise<ProductTransformation | null> {
  const record = await getTransformationById(transformationId);
  if (!record || record.status === 'Completed' || record.status === 'Cancelled') {
    return null;
  }

  const updated = updateTransformation(transformationId, { status: 'Approved', approvedByStaffId: staffId });

  if (updated && context) {
    void writeAuditLog({
      ...context,
      module: 'ProductTransformation',
      action: 'TransformationApproved',
      entityType: 'ProductTransformation',
      entityId: transformationId,
      before: { status: record.status },
      after: { status: 'Approved', approvedBy: staffId }
    });
  }

  return updated;
}

/**
 * Cancels a draft or approved transformation.
 */
export async function cancelTransformation(
  transformationId: string,
  context?: CommerceOperationContext
): Promise<ProductTransformation | null> {
  const record = await getTransformationById(transformationId);
  if (!record || record.status === 'Completed') {
    return null;
  }

  const updated = updateTransformation(transformationId, { status: 'Cancelled' });

  if (updated && context) {
    void publishCommerceEvent({
      eventType: 'TransformationCancelled',
      ...context,
      module: 'ProductTransformation',
      entityType: 'ProductTransformation',
      entityId: transformationId,
      payload: { summary: `Transformation ${updated.transformationNumber} was cancelled.` }
    });
    void writeAuditLog({
      ...context,
      module: 'ProductTransformation',
      action: 'TransformationCancelled',
      entityType: 'ProductTransformation',
      entityId: transformationId,
      before: { status: record.status },
      after: { status: 'Cancelled' }
    });
  }
  return updated;
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

/**
 * Rejects a transformation, preventing it from being posted.
 */
export async function rejectTransformation(
  transformationId: string,
  staffId: string,
  context?: CommerceOperationContext
): Promise<ProductTransformation | null> {
  const record = await getTransformationById(transformationId);
  if (!record || record.status === 'Completed' || record.status === 'Cancelled') {
    return null;
  }

  const updated = updateTransformation(transformationId, { status: 'Rejected' });

  if (updated && context) {
    void writeAuditLog({
      ...context,
      module: 'ProductTransformation',
      action: 'TransformationRejected',
      entityType: 'ProductTransformation',
      entityId: transformationId,
      before: { status: record.status },
      after: { status: 'Rejected', rejectedBy: staffId }
    });
  }
  return updated;
}

/**
 * Retrieves all input lines for a given transformation.
 */
export async function getInputLines(transformationId: string): Promise<ProductTransformationInputLine[]> {
  return readList<ProductTransformationInputLine>(INPUT_LINE_KEY, mockInputLines)
    .filter(line => line.transformationId === transformationId);
}

/**
 * Retrieves all output lines for a given transformation.
 */
export async function getOutputLines(transformationId: string): Promise<ProductTransformationOutputLine[]> {
  return readList<ProductTransformationOutputLine>(OUTPUT_LINE_KEY, mockOutputLines)
    .filter(line => line.transformationId === transformationId);
}

/**
 * Adds a new input (raw material) line to a draft transformation.
 */
export async function addInputLine(
  transformationId: string,
  payload: Omit<ProductTransformationInputLine, 'lineId' | 'transformationId' | 'totalCost'>
): Promise<ProductTransformationInputLine | null> {
  const transformation = await getTransformationById(transformationId);
  if (!transformation || transformation.status === 'Completed' || transformation.status === 'Cancelled') {
    return null; // Prevent changes to completed or cancelled transformations
  }
  if (payload.qtyConsumed <= 0 || payload.unitCost < 0) {
    return null; // Basic validation
  }

  const records = readList<ProductTransformationInputLine>(INPUT_LINE_KEY, mockInputLines);
  const record: ProductTransformationInputLine = {
    ...payload,
    lineId: makeId('TRN-IN'),
    transformationId,
    totalCost: payload.qtyConsumed * payload.unitCost,
  };
  saveList(INPUT_LINE_KEY, [record, ...records]);
  return record;
}

/**
 * Updates an existing input line on a draft transformation.
 */
export async function updateInputLine(
  transformationId: string,
  lineId: string,
  patch: Partial<Omit<ProductTransformationInputLine, 'lineId' | 'transformationId'>>
): Promise<ProductTransformationInputLine | null> {
  const transformation = await getTransformationById(transformationId);
  if (!transformation || transformation.status === 'Completed' || transformation.status === 'Cancelled') {
    return null;
  }
  if ((patch.qtyConsumed !== undefined && patch.qtyConsumed <= 0) || (patch.unitCost !== undefined && patch.unitCost < 0)) {
    return null;
  }

  const records = readList<ProductTransformationInputLine>(INPUT_LINE_KEY, mockInputLines);
  let updatedRecord: ProductTransformationInputLine | null = null;
  const nextRecords = records.map(line => {
    if (line.transformationId === transformationId && line.lineId === lineId) {
      const base = { ...line, ...patch };
      updatedRecord = {
        ...base,
        totalCost: base.qtyConsumed * base.unitCost,
      };
      return updatedRecord;
    }
    return line;
  });

  if (updatedRecord) {
    saveList(INPUT_LINE_KEY, nextRecords);
  }
  return updatedRecord;
}

/**
 * Removes an input line from a draft transformation.
 */
export async function removeInputLine(transformationId: string, lineId: string): Promise<boolean> {
  const transformation = await getTransformationById(transformationId);
  if (!transformation || transformation.status === 'Completed' || transformation.status === 'Cancelled') {
    return false;
  }

  const records = readList<ProductTransformationInputLine>(INPUT_LINE_KEY, mockInputLines);
  const nextRecords = records.filter(line => !(line.transformationId === transformationId && line.lineId === lineId));

  if (nextRecords.length < records.length) {
    saveList(INPUT_LINE_KEY, nextRecords);
    return true;
  }
  return false;
}

/**
 * Adds a new output (finished good) line to a draft transformation.
 */
export async function addOutputLine(
  transformationId: string,
  payload: Omit<ProductTransformationOutputLine, 'lineId' | 'transformationId' | 'totalValue'>
): Promise<ProductTransformationOutputLine | null> {
  const transformation = await getTransformationById(transformationId);
  if (!transformation || transformation.status === 'Completed' || transformation.status === 'Cancelled') {
    return null;
  }
  if (payload.qtyProduced <= 0 || payload.unitCost < 0) {
    return null;
  }

  const records = readList<ProductTransformationOutputLine>(OUTPUT_LINE_KEY, mockOutputLines);
  const record: ProductTransformationOutputLine = {
    ...payload,
    lineId: makeId('TRN-OUT'),
    transformationId,
    totalValue: payload.qtyProduced * payload.unitCost,
  };
  saveList(OUTPUT_LINE_KEY, [record, ...records]);
  return record;
}

/**
 * Updates an existing output line on a draft transformation.
 */
export async function updateOutputLine(
  transformationId: string,
  lineId: string,
  patch: Partial<Omit<ProductTransformationOutputLine, 'lineId' | 'transformationId'>>
): Promise<ProductTransformationOutputLine | null> {
  const transformation = await getTransformationById(transformationId);
  if (!transformation || transformation.status === 'Completed' || transformation.status === 'Cancelled') {
    return null;
  }
  if ((patch.qtyProduced !== undefined && patch.qtyProduced <= 0) || (patch.unitCost !== undefined && patch.unitCost < 0)) {
    return null;
  }

  const records = readList<ProductTransformationOutputLine>(OUTPUT_LINE_KEY, mockOutputLines);
  let updatedRecord: ProductTransformationOutputLine | null = null;
  const nextRecords = records.map(line => {
    if (line.transformationId === transformationId && line.lineId === lineId) {
      const base = { ...line, ...patch };
      updatedRecord = { ...base, totalValue: base.qtyProduced * base.unitCost };
      return updatedRecord;
    }
    return line;
  });

  if (updatedRecord) {
    saveList(OUTPUT_LINE_KEY, nextRecords);
  }
  return updatedRecord;
}

/**
 * Removes an output line from a draft transformation.
 */
export async function removeOutputLine(transformationId: string, lineId: string): Promise<boolean> {
  const transformation = await getTransformationById(transformationId);
  if (!transformation || transformation.status === 'Completed' || transformation.status === 'Cancelled') {
    return false;
  }

  const records = readList<ProductTransformationOutputLine>(OUTPUT_LINE_KEY, mockOutputLines);
  const nextRecords = records.filter(line => !(line.transformationId === transformationId && line.lineId === lineId));

  if (nextRecords.length < records.length) {
    saveList(OUTPUT_LINE_KEY, nextRecords);
    return true;
  }
  return false;
}