import type { PurchasingMigrationRecord } from './types';

export function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`).join(',')}}`;
}

export async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function fingerprintInput(record: PurchasingMigrationRecord): string {
  return stableSerialize({ vendorId: record.vendorId, sourceType: record.legacySourceType, sourceRecordIdentifier: record.legacyRecordId, recordType: record.recordType, normalizedSourcePayload: record.payload, sourceVersion: record.sourceVersion || null });
}
export const fingerprintMigrationRecord = async (record: PurchasingMigrationRecord): Promise<string> => sha256(fingerprintInput(record));
export const fingerprintMigrationSource = async (records: PurchasingMigrationRecord[]): Promise<string> => sha256(stableSerialize(await Promise.all(records.map(async record => ({ id: record.legacyRecordId, fingerprint: await fingerprintMigrationRecord(record) })))));
export const deterministicMigrationId = (vendorId: string, sourceType: string, recordType: string, legacyId: string): string => `migration_${vendorId}_${sourceType}_${recordType}_${legacyId}`.replace(/[^A-Za-z0-9_-]/g, '_');
