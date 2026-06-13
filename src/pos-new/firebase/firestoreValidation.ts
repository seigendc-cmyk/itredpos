import type { FirestoreJsonRecord } from './firestoreContracts';

export interface FirestoreValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const result = (errors: string[], warnings: string[] = []): FirestoreValidationResult => ({ valid: errors.length === 0, errors, warnings });
const isRecord = (doc: unknown): doc is FirestoreJsonRecord => Boolean(doc && typeof doc === 'object' && !Array.isArray(doc));
const hasText = (doc: FirestoreJsonRecord, key: string): boolean => typeof doc[key] === 'string' && String(doc[key]).trim().length > 0;
const hasNumber = (doc: FirestoreJsonRecord, key: string): boolean => typeof doc[key] === 'number' && Number.isFinite(doc[key] as number);

export function validateVendorScopedDoc(doc: unknown): FirestoreValidationResult {
  if (!isRecord(doc)) return result(['Document must be a plain object.']);
  const errors = [
    !hasText(doc, 'id') ? 'id is required.' : '',
    !hasText(doc, 'vendorId') ? 'vendorId is required.' : '',
    !hasNumber(doc, 'schemaVersion') ? 'schemaVersion is required.' : '',
    !hasText(doc, 'createdAt') ? 'createdAt is required.' : '',
    !hasText(doc, 'updatedAt') ? 'updatedAt is required.' : ''
  ].filter(Boolean);
  return result(errors);
}

export function validateProductMasterDoc(doc: unknown): FirestoreValidationResult {
  const base = validateVendorScopedDoc(doc);
  if (!isRecord(doc)) return base;
  const errors = [...base.errors, !hasText(doc, 'productName') ? 'productName is required for products.' : ''].filter(Boolean);
  return result(errors, base.warnings);
}

export function validateStockBalanceDoc(doc: unknown): FirestoreValidationResult {
  const base = validateVendorScopedDoc(doc);
  if (!isRecord(doc)) return base;
  const errors = [
    ...base.errors,
    !hasText(doc, 'productId') ? 'productId is required for stock balances.' : '',
    !hasNumber(doc, 'qtyOnHand') ? 'qtyOnHand must be numeric.' : '',
    !hasNumber(doc, 'qtyAvailable') ? 'qtyAvailable must be numeric.' : ''
  ].filter(Boolean);
  return result(errors, base.warnings);
}

export function validateInventoryMovementDoc(doc: unknown): FirestoreValidationResult {
  const base = validateVendorScopedDoc(doc);
  if (!isRecord(doc)) return base;
  const errors = [...base.errors, !hasText(doc, 'movementType') ? 'movementType is required.' : ''].filter(Boolean);
  return result(errors, base.warnings);
}

export function validateSalesReceiptDoc(doc: unknown): FirestoreValidationResult {
  const base = validateVendorScopedDoc(doc);
  if (!isRecord(doc)) return base;
  const errors = [...base.errors, !hasText(doc, 'receiptNumber') ? 'receiptNumber is required.' : ''].filter(Boolean);
  return result(errors, base.warnings);
}

export function validateOfflineQueueDoc(doc: unknown): FirestoreValidationResult {
  const base = validateVendorScopedDoc(doc);
  if (!isRecord(doc)) return base;
  const errors = [...base.errors, !hasText(doc, 'status') ? 'queue status is required.' : ''].filter(Boolean);
  return result(errors, base.warnings);
}

export function validateFirestoreContract(entityType: string, doc: unknown): FirestoreValidationResult {
  switch (entityType) {
    case 'productMaster':
      return validateProductMasterDoc(doc);
    case 'productStockBalances':
      return validateStockBalanceDoc(doc);
    case 'inventoryMovements':
    case 'productLedger':
      return validateInventoryMovementDoc(doc);
    case 'salesReceipts':
      return validateSalesReceiptDoc(doc);
    case 'offlineSyncQueue':
      return validateOfflineQueueDoc(doc);
    default:
      return validateVendorScopedDoc(doc);
  }
}

