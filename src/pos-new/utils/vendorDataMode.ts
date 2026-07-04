export const ENABLE_MOCK_SEED_DATA = false;

export type VendorDataMode = 'liveVendorEmpty' | 'mockSeed';

const AUTH_CONTEXT_KEY = 'sci_pos_vendor_auth_context';
const BUSINESS_PROFILE_KEY = 'itred_pos_business_profile';

const OPERATIONAL_LIST_STORE_KEYS = [
  'itred_pos_products',
  'itred_pos_transactions',
  'itred_pos_cash_logs',
  'itred_pos_shifthistory',
  'itred_pos_bi_events',
  'itred_pos_customers',
  'itred_pos_customers_v1',
  'itred_pos_customer_purchase_history_v1',
  'itred_pos_customer_notes_v1',
  'itred_pos_customer_activity_v1',
  'itred_pos_customer_debts_v1',
  'itred_pos_receipts_v1',
  'itred_pos_receipt_lines_v1',
  'itred_pos_receipt_payments_v1',
  'itred_pos_receipt_sequence_v1',
  'itred_pos_receipt_audit_v1',
  'sci_pos_delivery_requests_v2',
  'sci_pos_delivery_request_lines_v2',
  'sci_pos_delivery_providers_v2',
  'sci_pos_delivery_assignments_v2',
  'sci_pos_delivery_tracking_v2',
  'sci_pos_delivery_codes_v2',
  'sci_pos_delivery_cash_v2',
  'sci_pos_delivery_activity_v2',
  'sci_pos_delivery_whatsapp_v2',
  'sci_pos_walk_in_collections',
  'sci_pos_delivery_orders',
  'sci_pos_delivery_persons',
  'sci_pos_delivery_events',
  'sci_pos_product_master_records',
  'sci_pos_product_master_audit',
  'sci_pos_product_stock_balances',
  'itred_pos_manual_product_supplier_links_v1',
  'itred_pos_manual_product_price_records_v1',
  'itred_pos_manual_product_reorder_rules_v1',
  'itred_pos_operational_approvals_v1',
  'itred_pos_operational_approval_events_v1',
  'itred_pos_task_desk_tasks_v1',
  'itred_pos_task_desk_activity_v1',
  'itred_pos_purchase_discipline_requests_v1',
  'itred_pos_purchase_risk_assessments_v1',
  'itred_pos_supplier_purchase_commitments_v1',
  'itred_pos_reorder_protection_rules_v1',
  'itred_pos_purchase_discipline_activity_v1',
  'itred_pos_purchasing_discipline_bi_rules_v1',
  'itred_pos_supplier_credit_profiles_v1',
  'itred_pos_supplier_bills_v1',
  'itred_pos_supplier_payments_v1',
  'itred_pos_supplier_payment_allocations_v1',
  'itred_pos_supplier_statements_v1',
  'sci_pos_purchase_orders_v2',
  'sci_pos_purchase_order_lines_v2',
  'sci_pos_purchase_order_activity_v2',
  'sci_pos_goods_receiving_notes_v2',
  'sci_pos_goods_receiving_lines_v2',
  'sci_pos_goods_receiving_activity_v2',
  'sci_pos_supplier_returns_v2',
  'sci_pos_supplier_return_lines_v2',
  'sci_pos_supplier_return_credit_notes_v2',
  'sci_pos_supplier_return_activity_v2',
  'sci_pos_stock_adjustments_v2',
  'sci_pos_stock_adjustment_lines_v2',
  'sci_pos_stock_adjustment_activity_v2',
  'sci_pos_stock_approvals'
] as const;

const OPERATIONAL_VALUE_STORE_KEYS = [
  ['itred_pos_active_shift', null]
] as const;

function storageAvailable(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

function readObject(key: string): Record<string, unknown> | null {
  if (!storageAvailable()) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function storageSafeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/^_+|_+$/g, '');
}

export function getVendorDataMode(): VendorDataMode {
  return ENABLE_MOCK_SEED_DATA ? 'mockSeed' : 'liveVendorEmpty';
}

export function shouldUseMockSeedData(): boolean {
  return getVendorDataMode() === 'mockSeed';
}

export function seedRows<T>(rows: T[]): T[] {
  return shouldUseMockSeedData() ? rows : [];
}

export function getActiveVendorId(fallback = 'unassigned-vendor'): string {
  const auth = readObject(AUTH_CONTEXT_KEY);
  const profile = readObject(BUSINESS_PROFILE_KEY);
  const vendorId = asText(auth?.vendorId) || asText(profile?.vendorId) || fallback;
  return storageSafeId(vendorId) || fallback;
}

export function getVendorScopedStorageKey(baseKey: string, vendorId?: string): string {
  return `${baseKey}_${storageSafeId(vendorId || getActiveVendorId()) || 'unassigned-vendor'}`;
}

export function readVendorScopedJson<T>(baseKey: string, fallback: T, vendorId?: string): T {
  if (!storageAvailable()) return fallback;
  const scopedKey = getVendorScopedStorageKey(baseKey, vendorId);
  try {
    const scopedRaw = localStorage.getItem(scopedKey);
    if (scopedRaw) return JSON.parse(scopedRaw) as T;
    if (shouldUseMockSeedData()) {
      const legacyRaw = localStorage.getItem(baseKey);
      if (legacyRaw) return JSON.parse(legacyRaw) as T;
    }
    localStorage.setItem(scopedKey, JSON.stringify(fallback));
    return fallback;
  } catch {
    return fallback;
  }
}

export function writeVendorScopedJson<T>(baseKey: string, value: T, vendorId?: string): T {
  if (storageAvailable()) {
    try {
      localStorage.setItem(getVendorScopedStorageKey(baseKey, vendorId), JSON.stringify(value));
    } catch {
      // Vendor-scoped persistence is best-effort in restricted browser modes.
    }
  }
  return value;
}

export function readVendorScopedList<T>(baseKey: string, fallback: T[] = [], vendorId?: string): T[] {
  const rows = readVendorScopedJson<unknown>(baseKey, seedRows(fallback), vendorId);
  return Array.isArray(rows) ? rows as T[] : seedRows(fallback);
}

export function writeVendorScopedList<T>(baseKey: string, rows: T[], vendorId?: string): T[] {
  return writeVendorScopedJson(baseKey, rows, vendorId);
}

export function initializeEmptyVendorOperationalStores(vendorId = getActiveVendorId()): void {
  if (!storageAvailable()) return;
  OPERATIONAL_LIST_STORE_KEYS.forEach((baseKey) => {
    const scopedKey = getVendorScopedStorageKey(baseKey, vendorId);
    try {
      if (localStorage.getItem(scopedKey) === null) {
        localStorage.setItem(scopedKey, JSON.stringify([]));
      }
    } catch {
      // Storage initialization must never block onboarding.
    }
  });
  OPERATIONAL_VALUE_STORE_KEYS.forEach(([baseKey, initialValue]) => {
    const scopedKey = getVendorScopedStorageKey(baseKey, vendorId);
    try {
      if (localStorage.getItem(scopedKey) === null) {
        localStorage.setItem(scopedKey, JSON.stringify(initialValue));
      }
    } catch {
      // Storage initialization must never block onboarding.
    }
  });
}
