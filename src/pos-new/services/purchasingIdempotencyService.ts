const volatileFields = new Set(['createdAt', 'updatedAt', 'occurredAt', 'postedAt', 'completedAt', 'serverTimestamp', 'retryCount', 'retryAttempt', 'attempt']);

const stable = (value: unknown, field = ''): unknown => {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => stable(item, field));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key, item]) => item !== undefined && !volatileFields.has(key))
    .sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, stable(item, key)]));
  if (typeof value === 'number') return Object.is(value, -0) ? 0 : Number(value.toFixed(6));
  if (typeof value === 'string' && /(?:Id|Code|Number)$/.test(field)) return value.trim().normalize('NFC');
  if (typeof value === 'string' && /(?:Date|On)$/.test(field)) {
    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? value.trim() : new Date(timestamp).toISOString();
  }
  return value;
};

export async function fingerprintPurchasingMutation(operation: string, payload: unknown): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('Secure SHA-256 support is required for purchasing idempotency.');
  const canonicalRequest = JSON.stringify({ operation, payload: stable(payload) });
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalRequest));
  return `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

export function createPurchasingIdempotencyKey(operation: string, vendorId: string, stableRequestId: string): string {
  return `purchasing:${encodeURIComponent(operation)}:${encodeURIComponent(vendorId)}:${encodeURIComponent(stableRequestId)}`;
}

export function createPurchasingCorrelationId(operation: string, stableRequestId: string): string {
  return `purchasing-${operation}-${stableRequestId}`.replace(/[^A-Za-z0-9_-]/g, '_');
}
