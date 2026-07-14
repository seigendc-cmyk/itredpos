import { COMMERCE_SCHEMA_VERSION, type SharedInventoryBalanceRecord, type SharedInventoryMovementRecord } from '../firebase/commerceDataContract';
import { createRepositoryBundle } from '../repositories/repositoryFactory';
import { validateRepositoryOperationContext, type RepositoryOperationContext } from '../repositories/repositoryContext';
import { ENABLE_MOCK_SEED_DATA, getActiveVendorId, getVendorScopedStorageKey } from '../utils/vendorDataMode';

const MIGRATION_MARKER = 'itred_pos_inventory_firebase_migration_v1';
const LEGACY_PRODUCT_KEY = 'itred_pos_products';
const LEGACY_BALANCE_KEY = 'sci_pos_product_stock_balances';
const NOT_FOUND = 'REPOSITORY_NOT_FOUND';

export interface LegacyInventoryRow { vendorId: string; branchId: string; warehouseId?: string; productId: string; quantityOnHand: number; unitCost: number; source: string; }
export interface InventoryMigrationStatistics { inspected: number; deduplicated: number; eligible: number; migrated: number; skipped: number; failed: number; dryRun: boolean; completed: boolean; errors: string[]; }
export interface InventoryMigrationPreview extends InventoryMigrationStatistics { rows: LegacyInventoryRow[]; }
export interface InventoryMigrationOptions { dryRun?: boolean; markComplete?: boolean; }

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const number = (value: unknown): number => typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : 0;

function readRows(key: string): Record<string, unknown>[] {
  if (typeof localStorage === 'undefined') return [];
  try { const parsed: unknown = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(parsed) ? parsed.filter(isRecord) : []; }
  catch { return []; }
}

function migrationKey(row: Pick<LegacyInventoryRow, 'vendorId' | 'branchId' | 'warehouseId' | 'productId'>): string {
  return [row.vendorId, row.branchId, row.warehouseId || '', row.productId].join('|');
}

function movementId(row: LegacyInventoryRow): string {
  return `inventory_migration_${migrationKey(row).replace(/[^A-Za-z0-9_-]/g, '_')}`;
}

function legacyProducts(vendorId: string): LegacyInventoryRow[] {
  if (ENABLE_MOCK_SEED_DATA) return [];
  return readRows(getVendorScopedStorageKey(LEGACY_PRODUCT_KEY, vendorId)).map((item) => ({
    vendorId: text(item.vendorId) || vendorId,
    branchId: text(item.branchId),
    warehouseId: text(item.warehouseId) || undefined,
    productId: text(item.productId) || text(item.id),
    quantityOnHand: number(item.quantityOnHand ?? item.qtyOnHand ?? item.stock),
    unitCost: number(item.averageCost ?? item.unitCost ?? item.costPrice ?? item.cost),
    source: 'legacy-pos-products'
  }));
}

function legacyBalances(vendorId: string): LegacyInventoryRow[] {
  return readRows(getVendorScopedStorageKey(LEGACY_BALANCE_KEY, vendorId)).map((item) => ({
    vendorId: text(item.vendorId) || vendorId,
    branchId: text(item.branchId),
    warehouseId: text(item.warehouseId) || undefined,
    productId: text(item.productId),
    quantityOnHand: number(item.quantityOnHand ?? item.qtyOnHand),
    unitCost: number(item.averageCost ?? item.unitCost),
    source: 'legacy-product-stock-balances'
  }));
}

/** Read-only inspection. It never writes to Firestore or starts migration. */
export function inspectLegacyInventory(vendorId = getActiveVendorId('')): LegacyInventoryRow[] {
  if (!vendorId.trim()) return [];
  return [...legacyProducts(vendorId), ...legacyBalances(vendorId)].filter((row) => row.productId && Number.isFinite(row.quantityOnHand) && Number.isFinite(row.unitCost));
}

function deduplicate(rows: LegacyInventoryRow[], context: RepositoryOperationContext): LegacyInventoryRow[] {
  const unique = new Map<string, LegacyInventoryRow>();
  for (const row of rows) {
    if (row.vendorId !== context.vendorId) continue;
    const normalized: LegacyInventoryRow = { ...row, branchId: row.branchId || context.branchId || '', warehouseId: row.warehouseId || context.warehouseId };
    if (!normalized.branchId || !normalized.productId) continue;
    const key = migrationKey(normalized);
    const current = unique.get(key);
    if (!current || row.source === 'legacy-product-stock-balances') unique.set(key, normalized);
  }
  return [...unique.values()];
}

function existingBalanceKeys(records: SharedInventoryBalanceRecord[]): Set<string> {
  return new Set(records.map((row) => migrationKey({ vendorId: row.vendorId, branchId: row.branchId, warehouseId: row.warehouseId, productId: row.productId })));
}

export async function previewInventoryMigration(context: RepositoryOperationContext): Promise<InventoryMigrationPreview> {
  const empty = (errors: string[] = []): InventoryMigrationPreview => ({ inspected: 0, deduplicated: 0, eligible: 0, migrated: 0, skipped: 0, failed: errors.length ? 1 : 0, dryRun: true, completed: false, errors, rows: [] });
  try { validateRepositoryOperationContext(context); } catch (error) { return empty([error instanceof Error ? error.message : 'Invalid migration context.']); }
  const inspectedRows = inspectLegacyInventory(context.vendorId);
  const rows = deduplicate(inspectedRows, context);
  const repository = createRepositoryBundle().inventory;
  const [balances, movements] = await Promise.all([repository.listBalances(context), repository.listMovements(context, { referenceType: 'LEGACY_INVENTORY_MIGRATION' })]);
  if (!balances.success || !movements.success) return { ...empty([balances.errorMessage || movements.errorMessage || 'Existing inventory could not be inspected.']), inspected: inspectedRows.length, deduplicated: inspectedRows.length - rows.length, rows };
  const balanceKeys = existingBalanceKeys(balances.records);
  const movementIds = new Set(movements.records.map((row) => row.movementId));
  const eligible = rows.filter((row) => row.quantityOnHand !== 0 && !balanceKeys.has(migrationKey(row)) && !movementIds.has(movementId(row))).length;
  return { inspected: inspectedRows.length, deduplicated: inspectedRows.length - rows.length, eligible, migrated: 0, skipped: rows.length - eligible, failed: 0, dryRun: true, completed: false, errors: [], rows };
}

export async function migrateInventory(context: RepositoryOperationContext, options: InventoryMigrationOptions = {}): Promise<InventoryMigrationStatistics> {
  const preview = await previewInventoryMigration(context);
  if (options.dryRun === true || preview.errors.length) return preview;
  const bundle = createRepositoryBundle();
  let migrated = 0; let skipped = 0; let failed = 0; const errors: string[] = [];
  for (const row of preview.rows) {
    if (row.quantityOnHand === 0) { skipped++; continue; }
    const id = movementId(row);
    const rowContext: RepositoryOperationContext = { ...context, branchId: row.branchId, warehouseId: row.warehouseId, correlationId: `${context.correlationId}-${id}` };
    const existingMovement = await bundle.inventory.getMovement(rowContext, id);
    if (existingMovement.success) { skipped++; continue; }
    if (existingMovement.errorCode && existingMovement.errorCode !== NOT_FOUND) { failed++; errors.push(`${row.productId}: ${existingMovement.errorMessage || 'Movement lookup failed.'}`); continue; }
    const locationId = row.warehouseId || row.branchId;
    const existingBalance = await bundle.inventory.getBalance(rowContext, row.productId, locationId);
    if (existingBalance.success) { skipped++; continue; }
    if (existingBalance.errorCode && existingBalance.errorCode !== NOT_FOUND) { failed++; errors.push(`${row.productId}: ${existingBalance.errorMessage || 'Balance lookup failed.'}`); continue; }
    const timestamp = new Date().toISOString();
    const movement: SharedInventoryMovementRecord = { sciId: id, movementId: id, vendorId: context.vendorId, branchId: row.branchId, warehouseId: row.warehouseId, productId: row.productId, movementType: 'OPENING_BALANCE', quantityDelta: row.quantityOnHand, quantityBefore: 0, quantityAfter: row.quantityOnHand, unitCost: row.unitCost, valueImpact: row.quantityOnHand * row.unitCost, referenceType: 'LEGACY_INVENTORY_MIGRATION', referenceId: id, staffId: context.staffId, actorId: context.actorId, correlationId: rowContext.correlationId, sourceApp: context.sourceApp, createdAt: timestamp, updatedAt: timestamp, createdBy: context.actorId, updatedBy: context.actorId, schemaVersion: COMMERCE_SCHEMA_VERSION, status: 'Posted' };
    const result = await bundle.inventory.postMovement(rowContext, movement);
    if (result.success) migrated++;
    else { failed++; errors.push(`${row.productId}: ${result.errorMessage || 'Migration failed.'}`); }
  }
  const summary = { inspected: preview.inspected, deduplicated: preview.deduplicated, eligible: preview.eligible, migrated, skipped, failed, dryRun: false, completed: failed === 0, errors };
  const audit = await bundle.audit.appendAuditRecord(context, { vendorId: context.vendorId, branchId: context.branchId || '', terminalId: context.terminalId || '', staffId: context.staffId || '', actorId: context.actorId, actorRole: context.actorRole || '', action: 'MIGRATE_LEGACY_INVENTORY', entityType: 'INVENTORY_MIGRATION', entityId: context.correlationId, before: { inspected: preview.inspected }, after: summary, reason: 'Explicit legacy inventory migration', sourceApp: context.sourceApp, createdAt: new Date().toISOString(), correlationId: context.correlationId });
  const bi = await bundle.biEvents.publishEvent(context, { eventId: `inventory_migration_${context.correlationId}`, eventType: summary.completed ? 'INVENTORY_SYNC_COMPLETED' : 'INVENTORY_SYNC_FAILED', vendorId: context.vendorId, branchId: context.branchId || '', terminalId: context.terminalId || '', staffId: context.staffId || '', sourceApp: context.sourceApp, entityType: 'INVENTORY_MIGRATION', entityId: context.correlationId, timestamp: new Date().toISOString(), correlationId: context.correlationId, severity: summary.completed ? 'INFO' : 'HIGH', actionRequired: !summary.completed, metadata: { ...summary }, schemaVersion: COMMERCE_SCHEMA_VERSION });
  if (!audit.success) { summary.failed++; summary.completed = false; summary.errors.push(audit.errorMessage || 'Migration audit failed.'); }
  if (!bi.success) { summary.failed++; summary.completed = false; summary.errors.push(bi.errorMessage || 'Migration BI summary failed.'); }
  if (summary.completed && options.markComplete !== false) markInventoryMigrationComplete(context.vendorId);
  return summary;
}

export function markInventoryMigrationComplete(vendorId: string): void {
  if (!vendorId.trim()) throw new Error('vendorId is required.');
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(getVendorScopedStorageKey(MIGRATION_MARKER, vendorId), JSON.stringify({ vendorId, completedAt: new Date().toISOString() }));
}
