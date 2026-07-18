const volatileSalesFields = new Set([
  'createdAt',
  'updatedAt',
  'saleDate',
  'receivedAt',
  'occurredAt',
  'postedAt',
  'completedAt',
  'timestamp',
  'receiptNumber',
  'retryCount',
  'retryAttempt',
  'attempt'
]);

function stableSalesValue(value: unknown, field = ''): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => stableSalesValue(item, field));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([key, item]) => item !== undefined && !volatileSalesFields.has(key))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stableSalesValue(item, key)]));
  }
  if (typeof value === 'number') return Object.is(value, -0) ? 0 : Number(value.toFixed(6));
  if (typeof value === 'string' && /(?:Id|Code|Number)$/.test(field)) return value.trim().normalize('NFC');
  return value;
}

export function canonicalizeSalesMutation(operation: string, payload: unknown): string {
  return JSON.stringify({ operation, payload: stableSalesValue(payload) });
}

export async function fingerprintSalesMutation(operation: string, payload: unknown): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('Secure SHA-256 support is required for sales idempotency.');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalizeSalesMutation(operation, payload)));
  return `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

export function createSalesMutationReceiptId(operation: string, vendorId: string, branchId: string, requestId: string): string {
  return `sales_${operation}_${vendorId}_${branchId}_${requestId}`.replace(/[^A-Za-z0-9_-]/g, '_');
}
