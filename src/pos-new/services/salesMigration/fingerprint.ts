import type { SalesMigrationRecord } from './types';

const volatile = new Set(['updatedAt', 'syncedAt', 'lastViewedAt', 'migrationAttemptedAt']);
export function stableSalesMigrationValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableSalesMigrationValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key, item]) => !volatile.has(key) && item !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => [key, stableSalesMigrationValue(item)]));
}
const serialize = (value: unknown) => JSON.stringify(stableSalesMigrationValue(value));
export async function sha256SalesMigration(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(serialize(value)));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
export const fingerprintSalesMigrationRecord = (record: SalesMigrationRecord) => sha256SalesMigration({ vendorId: record.vendorId, branchId: record.branchId, sourceType: record.sourceType, sourceKey: record.sourceKey, legacyRecordId: record.legacyRecordId, sourceVersion: record.sourceVersion, payload: record.payload });
export const fingerprintSalesMigrationSource = async (records: SalesMigrationRecord[]) => sha256SalesMigration(await Promise.all(records.map(async record => ({ id: record.legacyRecordId, fingerprint: await fingerprintSalesMigrationRecord(record) }))));
export const salesMigrationDestinationId = (vendorId: string, legacyId: string) => `migration_sale_${vendorId}_${legacyId}`.replace(/[^A-Za-z0-9_-]/g, '_');
export const salesMigrationReceiptId = (vendorId: string, legacyId: string) => `sales_migration_${vendorId}_${legacyId}`.replace(/[^A-Za-z0-9_-]/g, '_');
