import { CommerceOperationContext, publishCommerceEvent, writeAuditLog } from '../../commerce-integration';
import { calculateRunningBalance, postInventoryMovement } from './inventoryMovementService';
import {
  deleteFirestoreInputLine,
  deleteFirestoreOutputLine,
  readFirestoreInputLines,
  readFirestoreOutputLines,
  readFirestoreTransformations,
  writeFirestoreInputLine,
  writeFirestoreOutputLine,
  writeFirestoreTransformation
} from './productTransformationRepository';
import type {
  ProductTransformation,
  ProductTransformationInputLine,
  ProductTransformationOutputLine,
  ProductTransformationStatus
} from '../types';
import { getActiveVendorId } from '../utils/vendorDataMode';

/**
 * STATUS: DRAFT -> PENDING_APPROVAL -> APPROVED -> COMPLETED
 *       |                                        |
 *       +--------------------> CANCELLED <--------+
 */
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

async function updateTransformation(transformationId: string, patch: Partial<ProductTransformation>): Promise<ProductTransformation | null> {
  let updated: ProductTransformation | null = null;
  const nextRecords = readList<ProductTransformation>(TRANSFORMATION_KEY, mockTransformations).map(record => {
    if (record.transformationId === transformationId) {
      updated = { ...record, ...patch, updatedAt: nowIso() };
      return updated;
    }
    return record;
  });
  if (updated) {
    await writeFirestoreTransformation(updated);
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
  await writeFirestoreTransformation(record);
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
  const firestoreRecords = await readFirestoreTransformations(getActiveVendorId(''));
  const records = firestoreRecords.length > 0
    ? firestoreRecords
    : readList<ProductTransformation>(TRANSFORMATION_KEY, mockTransformations);

  return records
    .filter(record => !filters.status || record.status === filters.status)
    .sort((a, b) => b.transformationNumber.localeCompare(a.transformationNumber));
}

/**
 * Retrieves a single product transformation by its ID.
 */
export async function getTransformationById(transformationId: string): Promise<ProductTransformation | null> {
  const firestoreRecords = await readFirestoreTransformations(getActiveVendorId(''));
  const records = firestoreRecords.length > 0
    ? firestoreRecords
    : readList<ProductTransformation>(TRANSFORMATION_KEY, mockTransformations);

  return records.find(t => t.transformationId === transformationId) || null;
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

  const updated = await updateTransformation(transformationId, { status: 'Approved', approvedByStaffId: staffId });

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

  const updated = await updateTransformation(transformationId, { status: 'Cancelled' });

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
  const record = await getTransformationById(transformationId);
  if (!record) return { transformationId, transformationNumber: '', status: 'Draft', stockPosted: false, message: 'Transformation not found.' };
  if (record.status !== 'Approved') return { transformationId, transformationNumber: record.transformationNumber, status: record.status, stockPosted: false, message: 'Transformation must be in Approved state to post.' };

  const inputLines = await getInputLines(transformationId);
  const outputLines = await getOutputLines(transformationId);

  if (inputLines.length === 0 || outputLines.length === 0) return { transformationId, transformationNumber: record.transformationNumber, status: record.status, stockPosted: false, message: 'Transformation requires at least one input and one output line to post.' };
  if (inputLines.some(l => l.qtyConsumed <= 0)) return { transformationId, transformationNumber: record.transformationNumber, status: record.status, stockPosted: false, message: 'All input lines must have a consumed quantity greater than 0.' };
  if (outputLines.some(l => l.qtyProduced <= 0)) return { transformationId, transformationNumber: record.transformationNumber, status: record.status, stockPosted: false, message: 'All output lines must have a produced quantity greater than 0.' };

  const totalInputCost = inputLines.reduce((sum, line) => sum + line.totalCost, 0);
  const totalOutputQty = outputLines.reduce((sum, line) => sum + line.qtyProduced, 0);
  const allocatedOutputUnitCost = totalOutputQty > 0 ? totalInputCost / totalOutputQty : 0;

  const staffId = context?.staffId || record.requestedByStaffId;
  const inputBalances = await Promise.all(
    inputLines.map(async (line) => ({
      line,
      balanceBefore: await calculateRunningBalance(line.productId, line.sourceWarehouseId)
    }))
  );
  const insufficientInput = inputBalances.find(({ line, balanceBefore }) => balanceBefore < line.qtyConsumed);
  if (insufficientInput) {
    return {
      transformationId,
      transformationNumber: record.transformationNumber,
      status: record.status,
      stockPosted: false,
      message: `Insufficient stock for ${insufficientInput.line.sku}. Transformation was not posted.`
    };
  }

  // Post movements for input lines (consumption)
  for (const { line, balanceBefore } of inputBalances) {
    await postInventoryMovement({
      vendorId: record.vendorId,
      branchId: record.branchId,
      warehouseId: line.sourceWarehouseId,
      productId: line.productId,
      sku: line.sku,
      productName: line.productName,
      shelfLocation: line.sourceShelfLocation || '',
      movementType: 'RAW_TO_FINISHED_OUT',
      referenceType: 'ProductTransformation',
      referenceNumber: record.transformationNumber,
      transformationId: record.transformationId,
      qtyIn: 0,
      qtyOut: line.qtyConsumed,
      balanceBefore,
      balanceAfter: balanceBefore - line.qtyConsumed,
      unitCost: line.unitCost,
      sellingPrice: 0,
      staffId,
      staffName: staffId,
      movementDate: nowIso(),
      notes: `Input for transformation ${record.transformationNumber}.`,
      riskFlag: 'None',
      approvalRequired: false,
      status: 'Posted',
    });
  }

  // Post movements for output lines (production)
  for (const line of outputLines) {
    const balanceBefore = await calculateRunningBalance(line.productId, line.destinationWarehouseId);
    await postInventoryMovement({
      vendorId: record.vendorId,
      branchId: record.branchId,
      warehouseId: line.destinationWarehouseId,
      productId: line.productId,
      sku: line.sku,
      productName: line.productName,
      shelfLocation: line.destinationShelfLocation || '',
      movementType: 'RAW_TO_FINISHED_IN',
      referenceType: 'ProductTransformation',
      referenceNumber: record.transformationNumber,
      transformationId: record.transformationId,
      qtyIn: line.qtyProduced,
      qtyOut: 0,
      balanceBefore,
      balanceAfter: balanceBefore + line.qtyProduced,
      unitCost: allocatedOutputUnitCost,
      sellingPrice: 0, // Selling price is not determined here
      staffId,
      staffName: staffId,
      movementDate: nowIso(),
      notes: `Output from transformation ${record.transformationNumber}.`,
      riskFlag: 'None',
      approvalRequired: false,
      status: 'Posted',
    });
  }

  const updated = await updateTransformation(transformationId, { status: 'Completed', completedByStaffId: staffId });

  if (updated && context) {
    void publishCommerceEvent({
      eventType: 'TransformationCompleted',
      ...context,
      module: 'ProductTransformation',
      entityType: 'ProductTransformation',
      entityId: transformationId,
      payload: { summary: `Transformation ${updated.transformationNumber} completed.` }
    });
    void writeAuditLog({
      ...context,
      module: 'ProductTransformation',
      action: 'TransformationCompleted',
      entityType: 'ProductTransformation',
      entityId: transformationId,
      before: { status: record.status },
      after: { status: 'Completed', completedBy: staffId }
    });
  }

  return { transformationId, transformationNumber: record.transformationNumber, status: 'Completed', stockPosted: true, message: 'Transformation posted successfully. Input stock consumed and output stock created.' };
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

  const updated = await updateTransformation(transformationId, { status: 'Rejected' });

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
  const transformation = await getTransformationById(transformationId);
  if (!transformation) return [];
  const firestoreLines = await readFirestoreInputLines(transformation.vendorId, transformationId);
  if (firestoreLines.length > 0) return firestoreLines;

  return readList<ProductTransformationInputLine>(INPUT_LINE_KEY, mockInputLines)
    .filter(line => line.transformationId === transformationId);
}

/**
 * Retrieves all output lines for a given transformation.
 */
export async function getOutputLines(transformationId: string): Promise<ProductTransformationOutputLine[]> {
  const transformation = await getTransformationById(transformationId);
  if (!transformation) return [];
  const firestoreLines = await readFirestoreOutputLines(transformation.vendorId, transformationId);
  if (firestoreLines.length > 0) return firestoreLines;

  return readList<ProductTransformationOutputLine>(OUTPUT_LINE_KEY, mockOutputLines)
    .filter(line => line.transformationId === transformationId);
}

/**
 * Adds a new input (raw material) line to a draft transformation.
 */
export async function addInputLine(
  transformationId: string,
  payload: Omit<ProductTransformationInputLine, 'lineId' | 'transformationId' | 'vendorId' | 'branchId' | 'totalCost' | 'createdAt' | 'updatedAt'>
): Promise<ProductTransformationInputLine | null> {
  const transformation = await getTransformationById(transformationId);
  if (!transformation || transformation.status !== 'Draft') {
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
    vendorId: transformation.vendorId,
    branchId: transformation.branchId,
    totalCost: payload.qtyConsumed * payload.unitCost,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await writeFirestoreInputLine(record);
  saveList(INPUT_LINE_KEY, [record, ...records]);

  return record;
}

/**
 * Updates an existing input line on a draft transformation.
 */
export async function updateInputLine(
  transformationId: string,
  lineId: string,
  patch: Partial<Omit<ProductTransformationInputLine, 'lineId' | 'transformationId' | 'vendorId' | 'branchId' | 'createdAt' | 'updatedAt'>>
): Promise<ProductTransformationInputLine | null> {
  const transformation = await getTransformationById(transformationId);
  if (!transformation || transformation.status !== 'Draft') {
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
        updatedAt: nowIso(),
      };
      return updatedRecord;
    }
    return line;
  });

  if (updatedRecord) {
    await writeFirestoreInputLine(updatedRecord);
    saveList(INPUT_LINE_KEY, nextRecords);
  }
  return updatedRecord;
}

/**
 * Removes an input line from a draft transformation.
 */
export async function removeInputLine(transformationId: string, lineId: string): Promise<boolean> {
  const transformation = await getTransformationById(transformationId);
  if (!transformation || transformation.status !== 'Draft') {
    return false;
  }

  const records = readList<ProductTransformationInputLine>(INPUT_LINE_KEY, mockInputLines);
  const nextRecords = records.filter(line => !(line.transformationId === transformationId && line.lineId === lineId));

  if (nextRecords.length < records.length) {
    await deleteFirestoreInputLine(transformation.vendorId, lineId);
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
  payload: Omit<ProductTransformationOutputLine, 'lineId' | 'transformationId' | 'vendorId' | 'branchId' | 'totalValue' | 'createdAt' | 'updatedAt'>
): Promise<ProductTransformationOutputLine | null> {
  const transformation = await getTransformationById(transformationId);
  if (!transformation || transformation.status !== 'Draft') {
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
    vendorId: transformation.vendorId,
    branchId: transformation.branchId,
    totalValue: payload.qtyProduced * payload.unitCost,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await writeFirestoreOutputLine(record);
  saveList(OUTPUT_LINE_KEY, [record, ...records]);

  return record;
}

/**
 * Updates an existing output line on a draft transformation.
 */
export async function updateOutputLine(
  transformationId: string,
  lineId: string,
  patch: Partial<Omit<ProductTransformationOutputLine, 'lineId' | 'transformationId' | 'vendorId' | 'branchId' | 'createdAt' | 'updatedAt'>>
): Promise<ProductTransformationOutputLine | null> {
  const transformation = await getTransformationById(transformationId);
  if (!transformation || transformation.status !== 'Draft') {
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
      updatedRecord = { ...base, totalValue: base.qtyProduced * base.unitCost, updatedAt: nowIso() };
      return updatedRecord;
    }
    return line;
  });

  if (updatedRecord) {
    await writeFirestoreOutputLine(updatedRecord);
    saveList(OUTPUT_LINE_KEY, nextRecords);
  }
  return updatedRecord;
}

/**
 * Removes an output line from a draft transformation.
 */
export async function removeOutputLine(transformationId: string, lineId: string): Promise<boolean> {
  const transformation = await getTransformationById(transformationId);
  if (!transformation || transformation.status !== 'Draft') {
    return false;
  }

  const records = readList<ProductTransformationOutputLine>(OUTPUT_LINE_KEY, mockOutputLines);
  const nextRecords = records.filter(line => !(line.transformationId === transformationId && line.lineId === lineId));

  if (nextRecords.length < records.length) {
    await deleteFirestoreOutputLine(transformation.vendorId, lineId);
    saveList(OUTPUT_LINE_KEY, nextRecords);
    return true;
  }
  return false;
}

