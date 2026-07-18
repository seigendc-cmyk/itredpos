import { getVendorScopedStorageKey } from '../../utils/vendorDataMode';
import type { SalesMigrationRecord } from './types';

export const LEGACY_COMPLETED_SALES_KEY = 'itred_pos_transactions';
const KNOWN_MOCK_SALE_IDS = new Set(['TXN-88220', 'TXN-88221']);

export interface LegacySalesSourceScan { records: SalesMigrationRecord[]; ignoredMockRecordIds: string[]; sourceKey: string; sourceError?: string; }
export function readLegacySalesSource(input: {
  vendorId: string;
  branchId: string;
  storage: Pick<Storage, 'getItem'> | undefined;
  sourceKind: 'legacyProduction' | 'mock';
}): LegacySalesSourceScan {
  const sourceKey = getVendorScopedStorageKey(LEGACY_COMPLETED_SALES_KEY, input.vendorId);
  if (!input.vendorId || !input.branchId || !input.storage) return { records: [], ignoredMockRecordIds: [], sourceKey };
  let rows: unknown;
  try { rows = JSON.parse(input.storage.getItem(sourceKey) || '[]'); }
  catch { return { records: [], ignoredMockRecordIds: [], sourceKey, sourceError: 'The vendor-scoped legacy sales source could not be read or parsed.' }; }
  if (!Array.isArray(rows)) return { records: [], ignoredMockRecordIds: [], sourceKey, sourceError: 'The vendor-scoped legacy sales source is not a valid sales array.' };
  const ignoredMockRecordIds: string[] = [];
  const records: SalesMigrationRecord[] = [];
  rows.forEach(raw => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return;
    const payload = structuredClone(raw as Record<string, unknown>);
    const id = String(payload.id || payload.saleId || '').trim();
    const mockData = input.sourceKind === 'mock' || payload.__mockData === true || KNOWN_MOCK_SALE_IDS.has(id);
    if (mockData) { ignoredMockRecordIds.push(id || 'unknown'); return; }
    records.push({ sourceType: 'legacyBrowserStorage', sourceKey, legacyRecordId: id, vendorId: String(payload.vendorId || input.vendorId), branchId: String(payload.branchId || input.branchId), sourceVersion: 'v1', payload, mockData: false });
  });
  return { records, ignoredMockRecordIds, sourceKey };
}

export const LEGACY_SALES_WRITE_PATHS = [
  { path: 'saleService.completeSale', enabled: false },
  { path: 'salesCheckoutService.saveCheckoutRecords(authoritative)', enabled: false }
] as const;
export function assertLegacySalesWritesDisabled(): void {
  const active = LEGACY_SALES_WRITE_PATHS.filter(path => path.enabled);
  if (active.length) throw new Error(`Legacy sales writes remain enabled: ${active.map(path => path.path).join(', ')}`);
}
