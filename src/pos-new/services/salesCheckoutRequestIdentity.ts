export interface CheckoutRequestScope {
  vendorId: string;
  branchId: string;
  terminalId: string;
}

export interface CheckoutRequestStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface EnumerableCheckoutRequestStorage extends CheckoutRequestStorage {
  readonly length: number;
  key(index: number): string | null;
}

export function checkoutRequestStorageKey(scope: CheckoutRequestScope): string {
  return `sci_pos_checkout_request:${encodeURIComponent(scope.vendorId)}:${encodeURIComponent(scope.branchId)}:${encodeURIComponent(scope.terminalId)}`;
}

export function createCheckoutRequestId(scope: CheckoutRequestScope): string {
  const nonce = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  return `checkout-${scope.vendorId}-${scope.branchId}-${scope.terminalId}-${nonce}`.replace(/[^A-Za-z0-9_-]/g, '_');
}

export function getOrCreateCheckoutRequestId(storage: CheckoutRequestStorage, scope: CheckoutRequestScope): string {
  const key = checkoutRequestStorageKey(scope);
  const existing = storage.getItem(key)?.trim();
  if (existing) return existing;
  const requestId = createCheckoutRequestId(scope);
  storage.setItem(key, requestId);
  return requestId;
}

export function saveCheckoutRequestId(storage: CheckoutRequestStorage, scope: CheckoutRequestScope, requestId: string): string {
  const stableRequestId = requestId.trim();
  if (!stableRequestId) throw new Error('Checkout request identity is required.');
  storage.setItem(checkoutRequestStorageKey(scope), stableRequestId);
  return stableRequestId;
}

export function clearCheckoutRequestId(storage: CheckoutRequestStorage, scope: CheckoutRequestScope): void {
  storage.removeItem(checkoutRequestStorageKey(scope));
}

export function clearAllCheckoutRequestIds(storage: EnumerableCheckoutRequestStorage): void {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith('sci_pos_checkout_request:')) keys.push(key);
  }
  keys.forEach((key) => storage.removeItem(key));
}
