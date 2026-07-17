import type { LegacyPurchasingWritePathStatus, PurchasingMigrationRecord, PurchasingMigrationRecordType } from './types';

export interface PurchasingLegacySourceDefinition { storageKey: string; recordType: PurchasingMigrationRecordType; idFields: string[]; parentFields?: string[]; }

export const PURCHASING_LEGACY_SOURCES: readonly PurchasingLegacySourceDefinition[] = [
  { storageKey: 'itred_pos_supplier_records_v1', recordType: 'supplier', idFields: ['supplierId', 'id'] },
  { storageKey: 'itred_pos_purchase_orders_v1', recordType: 'purchaseOrder', idFields: ['poId', 'purchaseOrderId', 'id'], parentFields: ['supplierId'] },
  { storageKey: 'itred_pos_goods_receiving_notes_v1', recordType: 'grn', idFields: ['grnId', 'id'], parentFields: ['poId', 'purchaseOrderId'] },
  { storageKey: 'itred_pos_supplier_returns_v1', recordType: 'supplierReturn', idFields: ['supplierReturnId', 'returnId', 'id'], parentFields: ['grnId'] },
  { storageKey: 'itred_pos_supplier_return_credit_notes_v1', recordType: 'supplierCreditNote', idFields: ['creditNoteId', 'id'], parentFields: ['supplierReturnId'] },
  { storageKey: 'itred_pos_supplier_payments_v1', recordType: 'supplierPayment', idFields: ['paymentId', 'id'], parentFields: ['supplierId'] },
  { storageKey: 'itred_pos_supplier_payment_reversals_v1', recordType: 'paymentReversal', idFields: ['reversalId', 'id'], parentFields: ['originalPaymentId'] },
  { storageKey: 'itred_pos_supplier_accounts_v1', recordType: 'reconciliationProjection', idFields: ['supplierId', 'id'] }
] as const;

/** Operational cutover evidence. These legacy mutation entry points must remain fail-closed. */
export function getLegacyPurchasingWritePathStatus(): LegacyPurchasingWritePathStatus[] {
  return [
    'goodsReceivingService.postGRN', 'supplierReturnService.postSupplierReturn', 'supplierAccountService.recordSupplierAccountEntry',
    'creditorsService.createSupplierPayment', 'purchaseOrderService.createPurchaseOrder'
  ].map(path => ({ path, enabled: false }));
}

const firstString = (value: Record<string, unknown>, fields: readonly string[]): string | undefined => fields.map(field => value[field]).find(item => typeof item === 'string' && item.trim().length > 0) as string | undefined;

/** Reads and copies supported legacy browser records. It never writes or deletes source data. */
export function readLegacyPurchasingSource(vendorId: string, branchId?: string, storage: Pick<Storage, 'getItem'> | undefined = typeof localStorage === 'undefined' ? undefined : localStorage): PurchasingMigrationRecord[] {
  if (!vendorId || !storage) return [];
  const records: PurchasingMigrationRecord[] = [];
  for (const source of PURCHASING_LEGACY_SOURCES) {
    let rows: unknown = [];
    try { rows = JSON.parse(storage.getItem(source.storageKey) || '[]'); } catch { rows = []; }
    if (!Array.isArray(rows)) continue;
    for (const raw of rows) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
      const payload = structuredClone(raw as Record<string, unknown>);
      records.push({ legacySourceType: 'browserStorage', legacyRecordId: firstString(payload, source.idFields) || '', legacyParentId: source.parentFields ? firstString(payload, source.parentFields) : undefined, vendorId: typeof payload.vendorId === 'string' ? payload.vendorId : vendorId, branchId: typeof payload.branchId === 'string' ? payload.branchId : branchId, recordType: source.recordType, sourceVersion: 'v1', payload });
    }
  }
  return records;
}
