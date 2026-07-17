export interface LegacyPurchasingDetection {
  entityType: 'purchaseOrders' | 'goodsReceivingNotes' | 'supplierReturns' | 'supplierPayments' | 'supplierBalances';
  recordCount: number;
  storageKey: string;
  migrationRequired: boolean;
}

const LEGACY_KEYS: Array<[LegacyPurchasingDetection['entityType'], string]> = [
  ['purchaseOrders', 'itred_pos_purchase_orders_v1'],
  ['goodsReceivingNotes', 'itred_pos_goods_receiving_notes_v1'],
  ['supplierReturns', 'itred_pos_supplier_returns_v1'],
  ['supplierPayments', 'itred_pos_supplier_payments_v1'],
  ['supplierBalances', 'itred_pos_supplier_accounts_v1']
];

/** Read-only inventory for Build 09.1C. It never imports, changes, or deletes legacy data. */
export function detectLegacyPurchasingRecords(storage: Pick<Storage, 'getItem'> | undefined = typeof localStorage === 'undefined' ? undefined : localStorage): LegacyPurchasingDetection[] {
  return LEGACY_KEYS.map(([entityType, storageKey]) => {
    let recordCount = 0;
    try {
      const parsed = JSON.parse(storage?.getItem(storageKey) || '[]');
      recordCount = Array.isArray(parsed) ? parsed.length : 0;
    } catch { recordCount = 0; }
    return { entityType, recordCount, storageKey, migrationRequired: recordCount > 0 };
  });
}
