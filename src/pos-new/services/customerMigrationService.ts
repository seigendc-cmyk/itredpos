import type { SharedCustomerRecord } from '../firebase/commerceDataContract';
import type { RepositoryOperationContext } from '../repositories/repositoryContext';
import type { CustomerRecord } from '../types';
import { getVendorScopedStorageKey } from '../utils/vendorDataMode';
import { auditLegacyCustomerMigration, createCustomerCommand, loadCustomerMaster, normalizeCustomerEmail, normalizeCustomerPhone, publishCustomerMigrationCompleted, updateCustomerCommand } from './customerMasterService';

export interface CustomerMigrationOptions { dryRun?: boolean; updateExisting?: boolean; }
export interface CustomerMigrationSummary { totalFound: number; eligible: number; created: number; updated: number; skipped: number; possibleDuplicates: number; failed: number; }
export interface LegacyCustomerInspection { count: number; keys: string[]; sample: CustomerRecord[]; }

const LEGACY_KEYS = ['itred_pos_customers_v1', 'itred_pos_customers'];
const MARKER = 'itred_pos_customer_migration_complete';

function readLegacy(vendorId?: string): { rows: CustomerRecord[]; keys: string[] } {
  if (typeof localStorage === 'undefined') return { rows: [], keys: [] };
  const candidates = [...LEGACY_KEYS, ...LEGACY_KEYS.map((key) => vendorId ? getVendorScopedStorageKey(key, vendorId) : '')].filter(Boolean);
  const rows = new Map<string, CustomerRecord>(); const keys: string[] = [];
  candidates.forEach((key) => { try { const parsed = JSON.parse(localStorage.getItem(key) || '[]') as CustomerRecord[]; if (!Array.isArray(parsed)) return; if (parsed.length) keys.push(key); parsed.forEach((row) => { if (row?.customerId) rows.set(row.customerId, row); }); } catch { /* malformed legacy input is ignored during inspection */ } });
  return { rows: [...rows.values()], keys };
}

function toShared(row: CustomerRecord, context: RepositoryOperationContext): Partial<SharedCustomerRecord> {
  return { customerId: row.customerId, sciId: `SCI-${row.customerId}`, vendorId: context.vendorId, displayName: row.customerName, businessName: row.tradingName, phone: normalizeCustomerPhone(row.phone), whatsappNumber: normalizeCustomerPhone(row.whatsapp), email: normalizeCustomerEmail(row.email), taxNumber: row.taxNumber?.trim() || undefined, customerType: row.customerType, status: row.status === 'Inactive' || row.status === 'Suspended' ? 'INACTIVE' : 'ACTIVE', creditAllowed: Boolean(row.creditEnabled || row.creditStatus === 'Credit Allowed' || row.creditStatus === 'Approved'), creditLimit: row.creditLimit, paymentTermsDays: row.paymentTermsDays, createdAt: row.createdAt, updatedAt: row.updatedAt, createdBy: row.createdByStaffId || context.actorId, updatedBy: context.actorId, sourceApp: context.sourceApp, schemaVersion: 1 };
}

export function inspectLegacyCustomers(vendorId?: string): LegacyCustomerInspection { const legacy = readLegacy(vendorId); return { count: legacy.rows.length, keys: legacy.keys, sample: legacy.rows.slice(0, 5) }; }

async function run(context: RepositoryOperationContext, options: CustomerMigrationOptions, execute: boolean): Promise<CustomerMigrationSummary> {
  const summary: CustomerMigrationSummary = { totalFound: 0, eligible: 0, created: 0, updated: 0, skipped: 0, possibleDuplicates: 0, failed: 0 };
  const legacy = readLegacy(context.vendorId); summary.totalFound = legacy.rows.length;
  const current = await loadCustomerMaster(context); if (!current.success) { summary.failed = legacy.rows.length || 1; return summary; }
  const byId = new Map(current.records.map((row) => [row.customerId, row]));
  const byPhone = new Map(current.records.filter((row) => row.phone).map((row) => [row.phone!, row]));
  const byEmail = new Map(current.records.filter((row) => row.email).map((row) => [row.email!, row]));
  for (const row of legacy.rows) {
    if (row.vendorId && row.vendorId !== context.vendorId) { summary.skipped++; continue; }
    const mapped = toShared(row, context); summary.eligible++;
    const sameId = byId.get(row.customerId); const phoneMatch = mapped.phone ? byPhone.get(mapped.phone) : undefined; const emailMatch = mapped.email ? byEmail.get(mapped.email) : undefined;
    const uncertain = [phoneMatch, emailMatch].find((match) => match && match.customerId !== row.customerId);
    if (uncertain) { summary.possibleDuplicates++; summary.skipped++; continue; }
    if (sameId) {
      if (!options.updateExisting) { summary.skipped++; continue; }
      if (!execute) { summary.updated++; continue; }
      const { customerId: _customerId, sciId: _sciId, vendorId: _vendorId, createdAt: _createdAt, createdBy: _createdBy, ...changes } = mapped;
      const result = await updateCustomerCommand(context, row.customerId, changes); if (result.success) { summary.updated++; await auditLegacyCustomerMigration(context, row.customerId, result.data); } else summary.failed++;
      continue;
    }
    if (!execute) { summary.created++; continue; }
    const result = await createCustomerCommand(context, mapped); if (result.success && result.data) { summary.created++; byId.set(result.data.customerId, result.data); if (result.data.phone) byPhone.set(result.data.phone, result.data); if (result.data.email) byEmail.set(result.data.email, result.data); await auditLegacyCustomerMigration(context, result.data.customerId, result.data); } else if (result.errorCode === 'POSSIBLE_DUPLICATE') { summary.possibleDuplicates++; summary.skipped++; } else summary.failed++;
  }
  if (execute) { if (summary.failed === 0) markCustomerMigrationComplete(context.vendorId); await publishCustomerMigrationCompleted(context, { ...summary }); }
  return summary;
}

export const previewCustomerMigration = (context: RepositoryOperationContext): Promise<CustomerMigrationSummary> => run(context, { dryRun: true }, false);
export const migrateCustomers = (context: RepositoryOperationContext, options: CustomerMigrationOptions = {}): Promise<CustomerMigrationSummary> => run(context, options, options.dryRun !== true);
export function markCustomerMigrationComplete(vendorId: string): void { if (typeof localStorage !== 'undefined' && vendorId.trim()) localStorage.setItem(getVendorScopedStorageKey(MARKER, vendorId), JSON.stringify({ vendorId, completedAt: new Date().toISOString() })); }
