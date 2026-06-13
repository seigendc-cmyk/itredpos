const fallbackRandom = (): string => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function sanitizeDocId(value: string | number): string {
  return String(value || 'unassigned')
    .trim()
    .replace(/[\/\\#?\[\]\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 160) || 'unassigned';
}

export function createFirestoreId(prefix: string): string {
  const randomId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : fallbackRandom();
  return sanitizeDocId(`${prefix}-${randomId}`);
}

export function createVendorScopedId(prefix: string, vendorId: string): string {
  return sanitizeDocId(`${prefix}-${vendorId}-${createFirestoreId('doc')}`);
}

export function createReceiptDocId(vendorId: string, branchId: string, terminalId: string, receiptNumber: string): string {
  return sanitizeDocId(`receipt-${vendorId}-${branchId}-${terminalId}-${receiptNumber}`);
}

export function createInventoryMovementDocId(vendorId: string, movementNumber: string): string {
  return sanitizeDocId(`movement-${vendorId}-${movementNumber}`);
}

export function createOfflineQueueDocId(vendorId: string, terminalId: string, queueId: string): string {
  return sanitizeDocId(`sync-${vendorId}-${terminalId}-${queueId}`);
}

export function getIdPrefixForEntity(entityType: string): string {
  const map: Record<string, string> = {
    productMaster: 'prod',
    productStockBalances: 'bal',
    customers: 'cust',
    purchaseOrders: 'po',
    goodsReceivingNotes: 'grn',
    supplierReturns: 'sr',
    stockAdjustments: 'adj',
    stocktakes: 'stk',
    stockTransfers: 'trf',
    inventoryMovements: 'mov',
    productLedger: 'led',
    salesReceipts: 'sale',
    payments: 'pay',
    deliveryRequests: 'del',
    approvals: 'apr',
    tasks: 'task',
    biEvents: 'bi',
    auditEvents: 'audit',
    offlineSyncQueue: 'queue',
    syncConflicts: 'conflict',
    accountingReadiness: 'acct'
  };
  return map[entityType] || sanitizeDocId(entityType || 'doc');
}

