import type { RepositoryOperationContext } from '../../repositories/repositoryContext';
import type { PurchasingTransactionService } from '../purchasingTransactionService';
import { createPurchasingCorrelationId } from '../purchasingIdempotencyService';
import { encodeFirestoreId } from '../../firebase/firestorePaths';
import type { PurchasingMigrationRecord, PurchasingMigrationRecordType } from './types';
import type { CanonicalMigrationWriter } from './service';
import { PurchasingMigrationError } from './service';
import { translatePurchasingMigrationRecord, type PurchasingMigrationDependencyResolver } from './canonicalTranslator';

export interface CanonicalPurchasingMigrationOperation { migrationRunId: string; vendorId: string; branchId?: string; warehouseId?: string; sourceType: string; legacyRecordId: string; destinationId: string; sourceFingerprint: string; actorId: string; approverId: string; actorRole: string; idempotencyKey: string; normalizedCanonicalPayload: unknown; attemptNumber: number; }
export interface CanonicalPurchasingMigrationResult { canonicalRecordId: string; mutationReceiptId: string; affectedInventoryMovementIds: string[]; affectedSupplierBalanceProjectionIds: string[]; operationStatus: 'completed'; durableIdempotencyStatus: 'completed'; auditReference: string; biEventReference?: string; }
export interface CanonicalPurchasingMigrationAdapter { execute(recordType: PurchasingMigrationRecordType, operation: CanonicalPurchasingMigrationOperation): Promise<CanonicalPurchasingMigrationResult>; }

const clean = (...parts: string[]) => encodeFirestoreId(parts.join('_'));
const operationName: Record<string, string> = { supplier: 'CREATE_SUPPLIER', purchaseOrder: 'CREATE_PURCHASE_ORDER', grn: 'POST_GOODS_RECEIPT', supplierReturn: 'POST_SUPPLIER_RETURN', supplierPayment: 'RECORD_SUPPLIER_PAYMENT', supplierCreditNote: 'POST_SUPPLIER_CREDIT_NOTE', paymentReversal: 'REVERSE_SUPPLIER_PAYMENT' };
const eventName: Record<string, string> = { supplier: 'SUPPLIER_CREATED', purchaseOrder: 'PURCHASE_ORDER_CREATED', grn: 'GOODS_RECEIVED', supplierReturn: 'SUPPLIER_RETURN_POSTED', supplierPayment: 'SUPPLIER_PAYMENT_RECORDED', supplierCreditNote: 'SUPPLIER_CREDIT_NOTE_POSTED', paymentReversal: 'SUPPLIER_PAYMENT_REVERSED' };

export class LiveCanonicalPurchasingMigrationAdapter implements CanonicalPurchasingMigrationAdapter {
  constructor(private readonly transactions: PurchasingTransactionService) {}
  async execute(recordType: PurchasingMigrationRecordType, input: CanonicalPurchasingMigrationOperation): Promise<CanonicalPurchasingMigrationResult> {
    if (input.vendorId !== (input.normalizedCanonicalPayload as { vendorId?: string; order?: { vendorId?: string }; receipt?: { vendorId?: string }; supplierReturn?: { vendorId?: string }; reversal?: { vendorId?: string } }).vendorId && ![ (input.normalizedCanonicalPayload as { order?: { vendorId?: string } }).order?.vendorId, (input.normalizedCanonicalPayload as { receipt?: { vendorId?: string } }).receipt?.vendorId, (input.normalizedCanonicalPayload as { supplierReturn?: { vendorId?: string } }).supplierReturn?.vendorId, (input.normalizedCanonicalPayload as { reversal?: { vendorId?: string } }).reversal?.vendorId ].includes(input.vendorId)) throw new PurchasingMigrationError('VALIDATION_FAILURE', 'Canonical payload vendor mismatch.', false);
    const operation = operationName[recordType]; if (!operation) throw new PurchasingMigrationError('NON_RETRYABLE_WRITE_FAILURE', `Unsupported canonical migration type ${recordType}.`, false);
    const trace = { migrationRunId: input.migrationRunId, legacySourceType: input.sourceType, legacyRecordId: input.legacyRecordId, sourceFingerprint: input.sourceFingerprint, canonicalRecordId: input.destinationId, recordType, actor: input.actorId, approver: input.approverId, vendorId: input.vendorId, branchId: input.branchId || '', operation, attemptNumber: input.attemptNumber };
    const canonical = structuredClone(input.normalizedCanonicalPayload) as Record<string, unknown>; const entityKey = recordType === 'purchaseOrder' ? 'order' : recordType === 'grn' ? 'receipt' : recordType === 'supplierReturn' ? 'supplierReturn' : recordType === 'paymentReversal' ? 'reversal' : '';
    if (entityKey) canonical[entityKey] = { ...(canonical[entityKey] as Record<string, unknown>), migrationMetadata: trace }; else canonical.migrationMetadata = trace;
    const correlationId = createPurchasingCorrelationId(`migration-${recordType}`, `${input.migrationRunId}-${input.legacyRecordId}`); const context: RepositoryOperationContext = { vendorId: input.vendorId, branchId: input.branchId, warehouseId: input.warehouseId, staffId: input.actorId, actorId: input.actorId, actorRole: input.actorRole, sourceApp: 'ITRED_POS', correlationId, idempotencyKey: input.idempotencyKey, occurredAt: new Date().toISOString(), source: `PURCHASING_MIGRATION:${input.migrationRunId}` };
    let result;
    if (recordType === 'supplier') result = await this.transactions.createSupplier(context, canonical as never);
    else if (recordType === 'purchaseOrder') result = await this.transactions.createPurchaseOrder(context, canonical as never);
    else if (recordType === 'grn') result = await this.transactions.postGoodsReceipt(context, canonical as never);
    else if (recordType === 'supplierReturn') result = await this.transactions.postSupplierReturn(context, canonical as never);
    else if (recordType === 'supplierPayment') result = await this.transactions.recordSupplierPayment(context, canonical as never);
    else if (recordType === 'supplierCreditNote') result = await this.transactions.postSupplierCreditNote(context, canonical as never);
    else result = await this.transactions.reverseSupplierPayment(context, canonical as never);
    if (!result.success) throw new PurchasingMigrationError(String(result.errorCode).includes('UNAVAILABLE') ? 'TRANSIENT_WRITE_FAILURE' : 'NON_RETRYABLE_WRITE_FAILURE', result.errorMessage, String(result.errorCode).includes('UNAVAILABLE'));
    const payload = input.normalizedCanonicalPayload as Record<string, unknown>; const lines = (payload.lines || (payload as { receipt?: { lines?: unknown[] } }).receipt?.lines) as Array<Record<string, unknown>> | undefined;
    const movementSuffix = recordType === 'grn' ? 'GOODS_RECEIVED' : 'SUPPLIER_RETURN'; const movementIds = ['grn', 'supplierReturn'].includes(recordType) ? (lines || []).map(line => clean(input.destinationId, String(line.lineId), movementSuffix)) : [];
    const supplierId = String(payload.supplierId || (payload.receipt as Record<string, unknown> | undefined)?.supplierId || (payload.supplierReturn as Record<string, unknown> | undefined)?.supplierId || (payload.reversal as Record<string, unknown> | undefined)?.supplierId || '');
    const auditId = clean(operation, correlationId, input.destinationId), biId = clean(eventName[recordType], correlationId, input.destinationId);
    return { canonicalRecordId: input.destinationId, mutationReceiptId: input.idempotencyKey, affectedInventoryMovementIds: movementIds, affectedSupplierBalanceProjectionIds: supplierId && ['grn', 'supplierReturn', 'supplierPayment', 'supplierCreditNote', 'paymentReversal'].includes(recordType) ? [supplierId] : [], operationStatus: 'completed', durableIdempotencyStatus: 'completed', auditReference: auditId, biEventReference: eventName[recordType] ? biId : undefined };
  }
}

export class CanonicalAdapterMigrationWriter implements CanonicalMigrationWriter {
  constructor(private readonly adapter: CanonicalPurchasingMigrationAdapter | undefined, private readonly actorId: string, private readonly approverId: string, private readonly actorRole = 'Owner', private readonly resolveDependency?: PurchasingMigrationDependencyResolver) {}
  async migrate(record: PurchasingMigrationRecord, metadata: Parameters<CanonicalMigrationWriter['migrate']>[1]) {
    if (!this.adapter) throw new PurchasingMigrationError('NON_RETRYABLE_WRITE_FAILURE', 'Live canonical purchasing migration adapter is unavailable.', false);
    const normalizedCanonicalPayload = translatePurchasingMigrationRecord(record, metadata.destinationId, this.resolveDependency); const idempotencyKey = `purchasing:migration:${encodeURIComponent(record.vendorId)}:${encodeURIComponent(metadata.migrationRunId)}:${encodeURIComponent(record.recordType)}:${encodeURIComponent(record.legacyRecordId)}:${encodeURIComponent(metadata.sourceFingerprint)}`;
    const result = await this.adapter.execute(record.recordType, { migrationRunId: metadata.migrationRunId, vendorId: record.vendorId, branchId: record.branchId, warehouseId: String(record.payload.warehouseId || (record.payload.receipt as Record<string, unknown> | undefined)?.warehouseId || ''), sourceType: record.legacySourceType, legacyRecordId: record.legacyRecordId, destinationId: metadata.destinationId, sourceFingerprint: metadata.sourceFingerprint, actorId: this.actorId, approverId: this.approverId, actorRole: this.actorRole, idempotencyKey, normalizedCanonicalPayload, attemptNumber: 1 });
    return { canonicalRecordId: result.canonicalRecordId, mutationReceiptId: result.mutationReceiptId, affectedInventoryMovementIds: result.affectedInventoryMovementIds, affectedSupplierBalanceProjectionIds: result.affectedSupplierBalanceProjectionIds, auditReference: result.auditReference, biEventReference: result.biEventReference };
  }
}
