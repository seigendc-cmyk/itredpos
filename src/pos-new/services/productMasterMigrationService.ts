import { createRepositoryBundle, type RepositoryBundle } from '../repositories/repositoryFactory';
import type { RepositoryOperationContext } from '../repositories/repositoryContext';
import type { SharedProductRecord } from '../firebase/commerceDataContract';
import { loadProductMaster, createProductCommand, appendAuditEvent, publishBIEvent } from '../services/productMasterService';

export interface LegacyProductMigrationOptions {
  dryRun?: boolean;
  batchSize?: number;
}

export interface LegacyProductMigrationReport {
  totalFound: number;
  eligible: number;
  created: number;
  updated: number;
  skipped: number;
  duplicates: number;
  failed: number;
}

const LEGACY_MIGRATION_FLAG_KEY = 'itred_pos_product_migration_complete';

function isMigrationComplete(vendorId: string): boolean {
  try {
    const raw = localStorage.getItem(LEGACY_MIGRATION_FLAG_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return Boolean(parsed[vendorId]);
  } catch {
    return false;
  }
}

function markMigrationComplete(vendorId: string): void {
  try {
    const raw = localStorage.getItem(LEGACY_MIGRATION_FLAG_KEY);
    const parsed = raw ? JSON.parse(raw) as Record<string, boolean> : {};
    parsed[vendorId] = true;
    localStorage.setItem(LEGACY_MIGRATION_FLAG_KEY, JSON.stringify(parsed));
  } catch {
    // localStorage may be unavailable.
  }
}

export async function inspectLegacyProducts(): Promise<{ count: number; sample: SharedProductRecord[] }> {
  const storeKey = 'itred_pos_products';
  try {
    const raw = localStorage.getItem(storeKey);
    if (!raw) return { count: 0, sample: [] };
    const parsed = JSON.parse(raw) as SharedProductRecord[];
    const sample = parsed.slice(0, 5);
    return { count: parsed.length, sample };
  } catch {
    return { count: 0, sample: [] };
  }
}

export async function previewLegacyMigration(context: RepositoryOperationContext, options: LegacyProductMigrationOptions = {}): Promise<LegacyProductMigrationReport> {
  const dryRun = options.dryRun !== false;
  const storeKey = 'itred_pos_products';
  const report: LegacyProductMigrationReport = {
    totalFound: 0,
    eligible: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    duplicates: 0,
    failed: 0
  };

  try {
    const raw = localStorage.getItem(storeKey);
    if (!raw) return report;
    const legacyProducts = JSON.parse(raw) as SharedProductRecord[];
    report.totalFound = legacyProducts.length;

    if (isMigrationComplete(context.vendorId)) {
      report.skipped = legacyProducts.length;
      return report;
    }

    const existing = await loadProductMaster(context);
    const existingById = new Map<string, SharedProductRecord>();
    const existingBySku = new Map<string, SharedProductRecord>();
    const existingByBarcode = new Map<string, SharedProductRecord>();
    existing.records.forEach((product) => {
      if (product.productId) existingById.set(product.productId, product);
      if (product.sku) existingBySku.set(product.sku.toLowerCase(), product);
      if (product.barcode) existingByBarcode.set(product.barcode.toLowerCase(), product);
    });

    for (const legacy of legacyProducts) {
      if (legacy.vendorId && legacy.vendorId !== context.vendorId) {
        report.skipped++;
        continue;
      }

      report.eligible++;

      const skuKey = (legacy.sku || '').toLowerCase();
      const barcodeKey = (legacy.barcode || '').toLowerCase();
      const existingByIdProduct = legacy.productId ? existingById.get(legacy.productId) : undefined;
      const existingBySkuProduct = skuKey ? existingBySku.get(skuKey) : undefined;
      const existingByBarcodeProduct = barcodeKey ? existingByBarcode.get(barcodeKey) : undefined;

      if (existingByIdProduct || existingBySkuProduct || existingByBarcodeProduct) {
        report.duplicates++;
        continue;
      }

      if (dryRun) {
        report.created++;
      }
    }

    return report;
  } catch {
    report.failed = 1;
    return report;
  }
}

export async function migrateLegacyProducts(context: RepositoryOperationContext, options: LegacyProductMigrationOptions = {}): Promise<LegacyProductMigrationReport> {
  const dryRun = options.dryRun === true;
  const storeKey = 'itred_pos_products';
  const report: LegacyProductMigrationReport = {
    totalFound: 0,
    eligible: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    duplicates: 0,
    failed: 0
  };

  try {
    const raw = localStorage.getItem(storeKey);
    if (!raw) return report;
    const legacyProducts = JSON.parse(raw) as SharedProductRecord[];
    report.totalFound = legacyProducts.length;

    if (isMigrationComplete(context.vendorId) && !dryRun) {
      report.skipped = legacyProducts.length;
      return report;
    }

    const existing = await loadProductMaster(context);
    const existingById = new Map<string, SharedProductRecord>();
    const existingBySku = new Map<string, SharedProductRecord>();
    const existingByBarcode = new Map<string, SharedProductRecord>();
    existing.records.forEach((product) => {
      if (product.productId) existingById.set(product.productId, product);
      if (product.sku) existingBySku.set(product.sku.toLowerCase(), product);
      if (product.barcode) existingByBarcode.set(product.barcode.toLowerCase(), product);
    });

    for (const legacy of legacyProducts) {
      if (legacy.vendorId && legacy.vendorId !== context.vendorId) {
        report.skipped++;
        continue;
      }

      report.eligible++;

      const skuKey = (legacy.sku || '').toLowerCase();
      const barcodeKey = (legacy.barcode || '').toLowerCase();
      const existingByIdProduct = legacy.productId ? existingById.get(legacy.productId) : undefined;
      const existingBySkuProduct = skuKey ? existingBySku.get(skuKey) : undefined;
      const existingByBarcodeProduct = barcodeKey ? existingByBarcode.get(barcodeKey) : undefined;

      if (existingByIdProduct || existingBySkuProduct || existingByBarcodeProduct) {
        report.duplicates++;
        continue;
      }

      if (dryRun) {
        report.created++;
        continue;
      }

      const product: SharedProductRecord = {
        sciId: legacy.sciId || `SCI-${legacy.productId}`,
        schemaVersion: 1,
        status: legacy.status || 'ACTIVE',
        vendorId: context.vendorId,
        productId: legacy.productId,
        sku: legacy.sku || '',
        numericNo: legacy.numericNo,
        alu: legacy.alu,
        barcode: legacy.barcode,
        productName: legacy.productName,
        description: legacy.description,
        industrialSector: legacy.industrialSector,
        category: legacy.category,
        subcategory: legacy.subcategory,
        brand: legacy.brand,
        unitOfMeasure: legacy.unitOfMeasure || 'pcs',
        purchaseUnit: legacy.purchaseUnit,
        salesUnit: legacy.salesUnit,
        costPrice: legacy.costPrice,
        sellingPrice: legacy.sellingPrice,
        wholesalePrice: legacy.wholesalePrice,
        taxable: legacy.taxable,
        vatRatePct: legacy.vatRatePct,
        marketplaceVisible: legacy.marketplaceVisible,
        catalogueVisible: legacy.catalogueVisible,
        createdAt: legacy.createdAt || '',
        updatedAt: legacy.updatedAt || '',
        createdBy: context.actorId,
        updatedBy: context.actorId,
        sourceApp: context.sourceApp,
        lastSyncAt: undefined
      };

      const result = await createProductCommand(context, product);
      if (result.success) {
        report.created++;
        if (product.sku) existingBySku.set(product.sku.toLowerCase(), product);
        if (product.barcode) existingByBarcode.set(product.barcode.toLowerCase(), product);
      } else {
        report.failed++;
      }
    }

    if (!dryRun) {
      markMigrationComplete(context.vendorId);
      await appendAuditEvent(context, 'MIGRATE_LEGACY_PRODUCT', 'product', 'batch', { report });
      await publishBIEvent(context, 'LEGACY_PRODUCT_MIGRATION_COMPLETED', 'product', 'batch', { report });
    }

    return report;
  } catch {
    report.failed = 1;
    return report;
  }
}

export function markLegacyMigrationComplete(vendorId: string): void {
  markMigrationComplete(vendorId);
}
