import { COMMERCE_SCHEMA_VERSION, type SharedInventoryMovementRecord } from '../firebase/commerceDataContract';
import { createRepositoryBundle } from '../repositories/repositoryFactory';
import type { RepositoryOperationContext } from '../repositories/repositoryContext';
import { loadLocalProducts } from '../utils/localProductStore';
import { getActiveVendorId, getVendorScopedStorageKey } from '../utils/vendorDataMode';

const MIGRATION_MARKER = 'itred_pos_inventory_firebase_migration_v1';

export interface LegacyInventoryRow {
  vendorId: string;
  branchId: string;
  warehouseId?: string;
  productId: string;
  quantityOnHand: number;
  unitCost: number;
  source: string;
}

export interface InventoryMigrationStatistics {
  inspected: number;
  deduplicated: number;
  eligible: number;
  migrated: number;
  skipped: number;
  failed: number;
  dryRun: boolean;
  completed: boolean;
  errors: string[];
}

export interface InventoryMigrationPreview extends InventoryMigrationStatistics {
  rows: LegacyInventoryRow[];
}

export interface InventoryMigrationOptions {
  dryRun?: boolean;
  markComplete?: boolean;
}

function migrationKey(row: LegacyInventoryRow): string {
  return [row.vendorId, row.branchId, row.warehouseId || '', row.productId].join('|');
}

function movementId(row: LegacyInventoryRow): string {
  return `inventory_migration_${migrationKey(row).replace(/[^A-Za-z0-9_-]/g, '_')}`;
}

function readLegacyBalanceRows(vendorId: string): LegacyInventoryRow[] {
  const rows: LegacyInventoryRow[] = [];
  try {
    const raw = localStorage.getItem(getVendorScopedStorageKey('sci_pos_product_stock_balances', vendorId));
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) {
      parsed.forEach((item: Record<string, unknown>) => rows.push({
        vendorId: String(item.vendorId || vendorId),
        branchId: String(item.branchId || 'main-branch'),
        warehouseId: item.warehouseId ? String(item.warehouseId) : undefined,
        productId: String(item.productId || ''),
        quantityOnHand: Number(item.quantityOnHand ?? item.qtyOnHand ?? 0),
        unitCost: Number(item.averageCost ?? item.unitCost ?? 0),
        source: 'legacy-product-stock-balances'
      }));
    }
  } catch {
    // A corrupt compatibility snapshot is ignored and reported by the empty preview.
  }
  return rows;
}

export function inspectLegacyInventory(): LegacyInventoryRow[] {
  const vendorId = getActiveVendorId('');
  if (!vendorId) return [];
  const products = loadLocalProducts(vendorId).map((product) => ({
    vendorId: product.vendorId || vendorId,
    branchId: product.branchId || 'main-branch',
    warehouseId: product.warehouseId,
    productId: product.id,
    quantityOnHand: Number(product.qtyOnHand ?? product.stock ?? 0),
    unitCost: Number(product.costPrice ?? product.cost ?? 0),
    source: 'legacy-pos-products'
  }));
  return [...products, ...readLegacyBalanceRows(vendorId)].filter((row) => row.productId && Number.isFinite(row.quantityOnHand));
}

function deduplicate(rows: LegacyInventoryRow[], context: RepositoryOperationContext): LegacyInventoryRow[] {
  const unique = new Map<string, LegacyInventoryRow>();
  rows.forEach((row) => {
    if (row.vendorId !== context.vendorId) return;
    const normalized = {
      ...row,
      branchId: row.branchId || context.branchId || '',
      warehouseId: row.warehouseId || context.warehouseId
    };
    unique.set(migrationKey(normalized), normalized);
  });
  return [...unique.values()];
}

export async function previewInventoryMigration(context: RepositoryOperationContext): Promise<InventoryMigrationPreview> {
  const inspectedRows = inspectLegacyInventory();
  const rows = deduplicate(inspectedRows, context);
  return {
    inspected: inspectedRows.length,
    deduplicated: inspectedRows.length - rows.length,
    eligible: rows.filter((row) => row.quantityOnHand !== 0).length,
    migrated: 0,
    skipped: rows.filter((row) => row.quantityOnHand === 0).length,
    failed: 0,
    dryRun: true,
    completed: false,
    errors: [],
    rows
  };
}

export async function migrateInventory(context: RepositoryOperationContext, options: InventoryMigrationOptions = {}): Promise<InventoryMigrationStatistics> {
  const preview = await previewInventoryMigration(context);
  if (options.dryRun !== false) return preview;
  const bundle = createRepositoryBundle();
  let migrated = 0;
  let skipped = preview.skipped;
  let failed = 0;
  const errors: string[] = [];
  for (const row of preview.rows) {
    if (row.quantityOnHand === 0) continue;
    const id = movementId(row);
    const existing = await bundle.inventory.getMovement(context, id);
    if (existing.success) {
      skipped += 1;
      continue;
    }
    const timestamp = new Date().toISOString();
    const movement: SharedInventoryMovementRecord = {
      sciId: id,
      movementId: id,
      vendorId: context.vendorId,
      branchId: row.branchId,
      warehouseId: row.warehouseId,
      productId: row.productId,
      movementType: 'OPENING_BALANCE',
      quantityDelta: row.quantityOnHand,
      quantityBefore: 0,
      quantityAfter: row.quantityOnHand,
      unitCost: row.unitCost,
      valueImpact: row.quantityOnHand * row.unitCost,
      referenceType: 'LEGACY_INVENTORY_MIGRATION',
      referenceId: id,
      staffId: context.staffId,
      actorId: context.actorId,
      correlationId: context.correlationId,
      sourceApp: context.sourceApp,
      createdAt: timestamp,
      updatedAt: timestamp,
      createdBy: context.actorId,
      updatedBy: context.actorId,
      schemaVersion: COMMERCE_SCHEMA_VERSION,
      status: 'Posted'
    };
    const result = await bundle.inventory.postMovement(context, movement);
    if (result.success) migrated += 1;
    else {
      failed += 1;
      errors.push(`${row.productId}: ${result.errorMessage || 'Migration failed.'}`);
    }
  }
  const completed = failed === 0;
  if (completed && options.markComplete !== false) markInventoryMigrationComplete(context.vendorId);
  await bundle.audit.appendAuditRecord(context, {
    vendorId: context.vendorId,
    branchId: context.branchId || '',
    terminalId: context.terminalId || '',
    staffId: context.staffId || '',
    actorId: context.actorId,
    actorRole: context.actorRole || '',
    action: 'MIGRATE_LEGACY_INVENTORY',
    entityType: 'INVENTORY_MIGRATION',
    entityId: context.correlationId,
    before: { inspected: preview.inspected },
    after: { migrated, skipped, failed },
    reason: 'Explicit legacy inventory migration',
    sourceApp: context.sourceApp,
    createdAt: new Date().toISOString(),
    correlationId: context.correlationId
  });
  await bundle.biEvents.publishEvent(context, {
    eventId: `inventory_migration_${context.correlationId}`,
    eventType: completed ? 'INVENTORY_SYNC_COMPLETED' : 'INVENTORY_SYNC_FAILED',
    vendorId: context.vendorId,
    branchId: context.branchId || '',
    terminalId: context.terminalId || '',
    staffId: context.staffId || '',
    sourceApp: context.sourceApp,
    entityType: 'INVENTORY_MIGRATION',
    entityId: context.correlationId,
    timestamp: new Date().toISOString(),
    severity: completed ? 'INFO' : 'HIGH',
    actionRequired: !completed,
    metadata: { inspected: preview.inspected, deduplicated: preview.deduplicated, migrated, skipped, failed },
    schemaVersion: COMMERCE_SCHEMA_VERSION
  });
  return { ...preview, migrated, skipped, failed, dryRun: false, completed, errors };
}

export function markInventoryMigrationComplete(vendorId: string): void {
  if (!vendorId.trim()) throw new Error('vendorId is required.');
  try {
    localStorage.setItem(getVendorScopedStorageKey(MIGRATION_MARKER, vendorId), JSON.stringify({ vendorId, completedAt: new Date().toISOString() }));
  } catch {
    // The Firestore movements remain the idempotency authority when local storage is unavailable.
  }
}
