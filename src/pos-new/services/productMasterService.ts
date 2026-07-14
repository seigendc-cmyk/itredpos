import {
  ProductBarcodeRecord,
  ProductMasterFilterState,
  ProductMasterRecord,
  ProductMasterSummary,
  ProductPriceRecord,
  ProductReorderRule,
  ProductStockBalance,
  ProductSupplierLink
} from '../types/posTypes';
import {
  mockProductBarcodeRecords,
  mockProductMasterRecords,
  mockProductPriceRecords,
  mockProductReorderRules,
  mockProductStockBalances,
  mockProductSupplierLinks
} from '../mock/mockPosData';
import {
  getProductStockBalances as getStockBalanceRows,
  getProductTotalAvailableStock as getTotalAvailableStock
} from './stockBalanceService';
import { loadLocalProducts, productMasterToPosProduct, saveLocalProducts, upsertLocalProducts } from '../utils/localProductStore';
import { ENABLE_MOCK_SEED_DATA, getVendorScopedStorageKey, readVendorScopedList, writeVendorScopedList } from '../utils/vendorDataMode';
import { createRepositoryBundle, type RepositoryBundle } from '../repositories/repositoryFactory';
import type { RepositoryOperationContext } from '../repositories/repositoryContext';
import type { ProductRepository, ProductListFilters } from '../repositories/ProductRepository';
import type { SharedProductRecord, SharedBIEventRecord } from '../firebase/commerceDataContract';
import { REPOSITORY_ERROR_CODES } from '../repositories/firestore/firestoreErrorMapper';
import { mayUseLocalOperationalAuthority } from '../utils/storageAuthority';

const PRODUCT_MASTER_KEY = 'sci_pos_product_master_records';
const PRODUCT_AUDIT_KEY = 'sci_pos_product_master_audit';
const MANUAL_SUPPLIER_LINK_KEY = 'itred_pos_manual_product_supplier_links_v1';
const MANUAL_PRICE_RECORD_KEY = 'itred_pos_manual_product_price_records_v1';
const MANUAL_REORDER_RULE_KEY = 'itred_pos_manual_product_reorder_rules_v1';

let memoryProducts: ProductMasterRecord[] = ENABLE_MOCK_SEED_DATA ? [...mockProductMasterRecords] : [];

function readProducts(): ProductMasterRecord[] {
  if (!mayUseLocalOperationalAuthority()) return [];
  memoryProducts = readVendorScopedList<ProductMasterRecord>(PRODUCT_MASTER_KEY, mockProductMasterRecords);
  return memoryProducts;
}

function writeProducts(products: ProductMasterRecord[]): ProductMasterRecord[] {
  memoryProducts = products;
  if (!mayUseLocalOperationalAuthority()) return products;
  return writeVendorScopedList(PRODUCT_MASTER_KEY, products);
}

function recordProductAudit(productId: string, eventType: string, message: string, staffId = 'SYSTEM'): void {
  if (!mayUseLocalOperationalAuthority()) return;
  try {
    const cached = localStorage.getItem(getVendorScopedStorageKey(PRODUCT_AUDIT_KEY));
    const existing = cached ? JSON.parse(cached) as Array<Record<string, unknown>> : [];
    localStorage.setItem(getVendorScopedStorageKey(PRODUCT_AUDIT_KEY), JSON.stringify([{
      id: `PMA-${Date.now()}`,
      productId,
      eventType,
      message,
      staffId,
      createdAt: new Date().toISOString()
    }, ...existing].slice(0, 200)));
  } catch {
    // localStorage may be unavailable in some test contexts.
  }
}

function readManualRows<T>(key: string): T[] {
  if (!mayUseLocalOperationalAuthority()) return [];
  return readVendorScopedList<T>(key, []);
}

function matchesProductSearch(product: ProductMasterRecord, query = ''): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return [
    product.productCode,
    product.sku,
    product.barcode,
    product.alu,
    product.vendorSku,
    product.productNumericNumber,
    product.productName,
    product.description,
    product.brand,
    product.manufacturer,
    product.supplierName,
    product.supplierItemCode,
    product.partNumber,
    product.oemNumber,
    product.make,
    product.model,
    product.yearFrom,
    product.yearTo,
    product.side,
    ...(product.tags || []),
    product.category,
    product.preferredSupplierName,
    product.sectorAttributes.sector,
    product.sectorAttributes.productCategory
  ].filter(Boolean).some((value) => String(value).toLowerCase().includes(normalized));
}

function productBalanceMeta(productId: string): ProductStockBalance[] {
  return readVendorScopedList<ProductStockBalance>('sci_pos_product_stock_balances', mockProductStockBalances).filter((balance) => balance.productId === productId);
}

function applyFilters(products: ProductMasterRecord[], filters: ProductMasterFilterState = {}): ProductMasterRecord[] {
  return products.filter((product) => {
    const balances = productBalanceMeta(product.productId);
    const matchesSearch = matchesProductSearch(product, filters.search);
    const matchesSku = !filters.sku || product.sku.toLowerCase().includes(filters.sku.toLowerCase());
    const matchesBarcode = !filters.barcode || (product.barcode || '').toLowerCase().includes(filters.barcode.toLowerCase());
    const matchesAlu = !filters.alu || (product.alu || '').toLowerCase().includes(filters.alu.toLowerCase());
    const matchesProductName = !filters.productName || product.productName.toLowerCase().includes(filters.productName.toLowerCase());
    const matchesBrand = !filters.brand || (product.brand || product.sectorAttributes.brand || '').toLowerCase().includes(filters.brand.toLowerCase());
    const matchesManufacturer = !filters.manufacturer || (product.manufacturer || product.sectorAttributes.manufacturer || '').toLowerCase().includes(filters.manufacturer.toLowerCase());
    const statusFilter = filters.productStatus || filters.status;
    const matchesStatus = !statusFilter || statusFilter === 'ALL' || (product.productStatus || product.status) === statusFilter;
    const matchesRisk = !filters.riskStatus || filters.riskStatus === 'ALL' || product.riskStatus === filters.riskStatus;
    const sectorFilter = filters.industrialSector || filters.sector;
    const matchesSector = !sectorFilter || sectorFilter === 'ALL' || product.industrialSector === sectorFilter || product.sectorAttributes.sector === sectorFilter;
    const matchesCategory = !filters.category || filters.category === 'ALL' || product.category === filters.category || product.productCategory === filters.category || product.sectorAttributes.productCategory === filters.category;
    const matchesSubCategory = !filters.subCategory || filters.subCategory === 'ALL' || product.productSubCategory === filters.subCategory || product.sectorAttributes.productSubCategory === filters.subCategory;
    const matchesSupplier = !filters.supplier || filters.supplier === 'ALL' || product.supplierName === filters.supplier || product.preferredSupplierName === filters.supplier || product.preferredSupplierId === filters.supplier;
    const matchesBranch = !filters.branchId || filters.branchId === 'ALL' || balances.some((balance) => balance.branchId === filters.branchId);
    const matchesWarehouse = !filters.warehouseId || filters.warehouseId === 'ALL' || balances.some((balance) => balance.warehouseId === filters.warehouseId);
    const matchesLocationType = !filters.locationType || filters.locationType === 'ALL' || balances.some((balance) => balance.locationType === filters.locationType);
    const matchesStockStatus = !filters.stockStatus || filters.stockStatus === 'ALL' || balances.some((balance) => balance.status === filters.stockStatus);
    return matchesSearch && matchesSku && matchesBarcode && matchesAlu && matchesProductName && matchesBrand && matchesManufacturer &&
      matchesStatus && matchesRisk && matchesSector && matchesCategory && matchesSubCategory && matchesSupplier &&
      matchesBranch && matchesWarehouse && matchesLocationType && matchesStockStatus;
  });
}

export async function getProductMasterRecords(filters: ProductMasterFilterState = {}): Promise<ProductMasterRecord[]> {
  return applyFilters(readProducts(), filters).sort((a, b) => a.productName.localeCompare(b.productName));
}

export async function searchProductMasterRecords(query: string, filters: ProductMasterFilterState = {}): Promise<ProductMasterRecord[]> {
  return getProductMasterRecords({ ...filters, search: query });
}

export async function searchProductMaster(query: string, filters: ProductMasterFilterState): Promise<ProductMasterRecord[]>;
export async function searchProductMaster(context: RepositoryOperationContext, searchTerm: string, filters?: ProductListFilters): Promise<ProductMasterListResult<SharedProductRecord>>;
export async function searchProductMaster(first: unknown, second?: unknown, third?: unknown): Promise<unknown> {
  if (typeof first === 'string') {
    return searchProductMasterRecords(first, second as ProductMasterFilterState);
  }
  const context = first as RepositoryOperationContext;
  const searchTerm = String(second ?? '');
  const filters = third as ProductListFilters | undefined;
  const bundle = getBundle();
  const result = await bundle.products.searchProducts(context, searchTerm, filters);
  return mapListResult(result);
}

export async function getProductMasterById(productId: string): Promise<ProductMasterRecord | null> {
  return readProducts().find((product) => product.productId === productId) || null;
}

export async function getProductById(productId: string): Promise<ProductMasterRecord | null> {
  return getProductMasterById(productId);
}

export async function getProductMasterSummary(filters: ProductMasterFilterState = {}): Promise<ProductMasterSummary> {
  const products = await getProductMasterRecords(filters);
  const productIds = new Set(products.map((product) => product.productId));
  const balances = (await getStockBalanceRows()).filter((balance) => productIds.has(balance.productId));
  const linkedProducts = new Set(readManualRows<ProductSupplierLink>(MANUAL_SUPPLIER_LINK_KEY).map((link) => link.productId));
  return {
    totalProducts: products.length,
    activeProducts: products.filter((product) => (product.productStatus || product.status) === 'Active').length,
    draftProducts: products.filter((product) => (product.productStatus || product.status) === 'Draft').length,
    blockedProducts: products.filter((product) => (product.productStatus || product.status) === 'Blocked').length,
    inactiveProducts: products.filter((product) => (product.productStatus || product.status) === 'Inactive' || (product.productStatus || product.status) === 'Discontinued').length,
    lowStockProducts: new Set(balances.filter((balance) => balance.status === 'Reorder Required').map((balance) => balance.productId)).size,
    outOfStockProducts: new Set(balances.filter((balance) => balance.status === 'Out Of Stock' || balance.status === 'Out of Stock').map((balance) => balance.productId)).size,
    multiLocationProducts: products.filter((product) => new Set(balances.filter((balance) => balance.productId === product.productId).map((balance) => balance.locationId)).size > 1).length,
    damagedHoldingProducts: new Set(balances.filter((balance) => balance.qtyDamaged > 0).map((balance) => balance.productId)).size,
    returnHoldingProducts: new Set(balances.filter((balance) => (balance.qtyReturnHolding || 0) > 0).map((balance) => balance.productId)).size,
    inTransitProducts: new Set(balances.filter((balance) => balance.qtyInTransit > 0).map((balance) => balance.productId)).size,
    reorderRequiredProducts: new Set(balances.filter((balance) => balance.status === 'Reorder Required').map((balance) => balance.productId)).size,
    supplierLinkedProducts: products.filter((product) => linkedProducts.has(product.productId)).length,
    riskProducts: products.filter((product) => product.riskStatus !== 'None' && product.riskStatus !== 'Normal').length
  };
}

export async function createProductMasterDraft(payload: Omit<ProductMasterRecord, 'productId' | 'createdAt' | 'updatedAt'>): Promise<ProductMasterRecord> {
  const now = new Date().toISOString();
  const product: ProductMasterRecord = {
    ...payload,
    productId: `PM-${Date.now()}`,
    createdAt: now,
    updatedAt: now
  };
  writeProducts([product, ...readProducts()]);
  upsertLocalProducts([productMasterToPosProduct(product, 0)]);
  recordProductAudit(product.productId, 'PRODUCT_MASTER_CREATED', `${product.productName} created.`, product.createdByStaffId);
  return product;
}

export async function createProductDraft(payload: Omit<ProductMasterRecord, 'productId' | 'createdAt' | 'updatedAt'>): Promise<ProductMasterRecord> {
  return createProductMasterDraft(payload);
}

export async function updateProductMasterPlaceholder(productId: string, patch: Partial<ProductMasterRecord>, staffId = 'SYSTEM'): Promise<ProductMasterRecord | null> {
  let updated: ProductMasterRecord | null = null;
  const next = readProducts().map((product) => {
    if (product.productId !== productId) return product;
    updated = { ...product, ...patch, updatedAt: new Date().toISOString() };
    return updated;
  });
  writeProducts(next);
  if (updated) {
    const existingPosProduct = loadLocalProducts().find((product) => product.id === productId);
    upsertLocalProducts([productMasterToPosProduct(updated, existingPosProduct?.qtyOnHand ?? existingPosProduct?.stock ?? 0)]);
    recordProductAudit(productId, 'PRODUCT_MASTER_UPDATED', `${updated.productName} updated.`, staffId);
  }
  return updated;
}

export async function updateProductMaster(productId: string, patch: Partial<ProductMasterRecord>, staffId = 'SYSTEM'): Promise<ProductMasterRecord | null> {
  return updateProductMasterPlaceholder(productId, patch, staffId);
}

export async function deleteProductMasterPlaceholder(productId: string, staffId = 'SYSTEM'): Promise<boolean> {
  const existing = readProducts();
  const target = existing.find((product) => product.productId === productId);
  if (!target) return false;
  writeProducts(existing.filter((product) => product.productId !== productId));
  saveLocalProducts(loadLocalProducts().filter((product) => product.id !== productId));
  recordProductAudit(productId, 'PRODUCT_MASTER_DELETED', `${target.productName} deleted from local Product Master.`, staffId);
  return true;
}

export async function blockProduct(productId: string, staffId: string, notes: string): Promise<ProductMasterRecord | null> {
  const updated = await updateProductMasterPlaceholder(productId, { status: 'Blocked', riskStatus: 'Blocked Sale' }, staffId);
  if (updated) recordProductAudit(productId, 'PRODUCT_BLOCKED', notes || `${updated.productName} blocked.`, staffId);
  return updated;
}

export async function markProductInactive(productId: string, staffId: string, notes: string): Promise<ProductMasterRecord | null> {
  const updated = await updateProductMasterPlaceholder(productId, { status: 'Inactive' }, staffId);
  if (updated) recordProductAudit(productId, 'PRODUCT_INACTIVE', notes || `${updated.productName} marked inactive.`, staffId);
  return updated;
}

export async function getProductBarcodes(productId: string): Promise<ProductBarcodeRecord[]> {
  return (ENABLE_MOCK_SEED_DATA ? mockProductBarcodeRecords : []).filter((barcode) => barcode.productId === productId);
}

export async function getProductStockBalances(productId: string): Promise<ProductStockBalance[]> {
  return getStockBalanceRows(productId);
}

export async function getProductAvailableStock(productId: string, branchId?: string, warehouseId?: string): Promise<number> {
  const balances = await getStockBalanceRows(productId);
  return balances
    .filter((balance) => (!branchId || balance.branchId === branchId) && (!warehouseId || balance.warehouseId === warehouseId))
    .reduce((sum, balance) => sum + Math.max(0, balance.qtyAvailable), 0);
}

export async function getProductTotalAvailableStock(productId: string): Promise<number> {
  return getTotalAvailableStock(productId);
}

export async function getProductLocationBalances(productId: string): Promise<Array<ProductStockBalance & { locationDisplay: string }>> {
  const balances = await getStockBalanceRows(productId);
  return balances.map((balance) => ({
    ...balance,
    locationDisplay: `${balance.branchName} / ${balance.warehouseName} / ${balance.locationType}${balance.shelfLocation ? ` / ${balance.shelfLocation}` : ''}`
  }));
}

export async function getProductSupplierLinks(productId: string): Promise<ProductSupplierLink[]> {
  return [
    ...(ENABLE_MOCK_SEED_DATA ? mockProductSupplierLinks : []),
    ...readManualRows<ProductSupplierLink>(MANUAL_SUPPLIER_LINK_KEY)
  ].filter((link) => link.productId === productId);
}

export async function getProductPrices(productId: string): Promise<ProductPriceRecord[]> {
  return [
    ...(ENABLE_MOCK_SEED_DATA ? mockProductPriceRecords : []),
    ...readManualRows<ProductPriceRecord>(MANUAL_PRICE_RECORD_KEY)
  ].filter((price) => price.productId === productId);
}

export async function getProductReorderRules(productId: string): Promise<ProductReorderRule[]> {
  return [
    ...(ENABLE_MOCK_SEED_DATA ? mockProductReorderRules : []),
    ...readManualRows<ProductReorderRule>(MANUAL_REORDER_RULE_KEY)
  ].filter((rule) => rule.productId === productId);
}

export async function getProductMasterAudit(productId: string): Promise<Array<{ id: string; productId: string; eventType: string; message: string; staffId: string; createdAt: string }>> {
  if (!mayUseLocalOperationalAuthority()) return [];
  try {
    const cached = localStorage.getItem(getVendorScopedStorageKey(PRODUCT_AUDIT_KEY));
    const events = cached ? JSON.parse(cached) as Array<{ id: string; productId: string; eventType: string; message: string; staffId: string; createdAt: string }> : [];
    return events.filter((event) => event.productId === productId);
  } catch {
    return [];
  }
}

export async function exportProductMasterPlaceholder(filters: ProductMasterFilterState = {}): Promise<{ message: string; filters: ProductMasterFilterState }> {
  recordProductAudit('ALL', 'PRODUCT_MASTER_EXPORT_PREPARED', 'Product Master export prepared.');
  return { message: 'Product Master export prepared.', filters };
}

export type ProductMasterErrorCode =
  | 'PERMISSION_DENIED'
  | 'UNAUTHENTICATED'
  | 'TENANT_CONTEXT_MISSING'
  | 'NOT_FOUND'
  | 'ALREADY_EXISTS'
  | 'SERVICE_UNAVAILABLE'
  | 'VALIDATION_ERROR'
  | 'UNKNOWN';

export interface ProductMasterResult<T> {
  success: boolean;
  data?: T;
  errorCode?: ProductMasterErrorCode;
  errorMessage?: string;
}

export interface ProductMasterListResult<T> {
  success: boolean;
  records: T[];
  errorCode?: ProductMasterErrorCode;
  errorMessage?: string;
}

function toProductMasterErrorCode(code?: string): ProductMasterErrorCode {
  if (!code) return 'UNKNOWN';
  switch (code) {
    case REPOSITORY_ERROR_CODES.PERMISSION_DENIED:
      return 'PERMISSION_DENIED';
    case REPOSITORY_ERROR_CODES.UNAUTHENTICATED:
      return 'UNAUTHENTICATED';
    case REPOSITORY_ERROR_CODES.NOT_FOUND:
      return 'NOT_FOUND';
    case REPOSITORY_ERROR_CODES.ALREADY_EXISTS:
      return 'ALREADY_EXISTS';
    case REPOSITORY_ERROR_CODES.UNAVAILABLE:
      return 'SERVICE_UNAVAILABLE';
    case REPOSITORY_ERROR_CODES.FAILED_PRECONDITION:
      return 'VALIDATION_ERROR';
    default:
      return 'UNKNOWN';
  }
}

function mapOperationResult<T>(result: { success: boolean; data?: T; errorCode?: string; errorMessage?: string }): ProductMasterResult<T> {
  return {
    success: result.success,
    data: result.data,
    errorCode: toProductMasterErrorCode(result.errorCode),
    errorMessage: result.errorMessage
  };
}

function mapListResult<T>(result: { success: boolean; records: T[]; errorCode?: string; errorMessage?: string }): ProductMasterListResult<T> {
  return {
    success: result.success,
    records: result.records,
    errorCode: toProductMasterErrorCode(result.errorCode),
    errorMessage: result.errorMessage
  };
}

let cachedBundle: RepositoryBundle | null = null;

function getBundle(): RepositoryBundle {
  if (!cachedBundle) {
    cachedBundle = createRepositoryBundle();
  }
  return cachedBundle;
}

export function resetProductMasterBundle(): void {
  cachedBundle = null;
}

export async function loadProductMaster(context: RepositoryOperationContext, filters?: ProductListFilters): Promise<ProductMasterListResult<SharedProductRecord>> {
  const bundle = getBundle();
  const result = await bundle.products.listProducts(context, filters);
  return mapListResult(result);
}

export async function createProductCommand(context: RepositoryOperationContext, input: Partial<SharedProductRecord>): Promise<ProductMasterResult<SharedProductRecord>> {
  const bundle = getBundle();
  const productRepo = bundle.products;

  if (!input.productName || input.productName.trim().length === 0) {
    return { success: false, errorCode: 'VALIDATION_ERROR', errorMessage: 'Product name is required.' };
  }

  if (input.costPrice !== undefined && input.costPrice < 0) {
    return { success: false, errorCode: 'VALIDATION_ERROR', errorMessage: 'Cost price cannot be negative.' };
  }

  if (input.sellingPrice !== undefined && input.sellingPrice < 0) {
    return { success: false, errorCode: 'VALIDATION_ERROR', errorMessage: 'Selling price cannot be negative.' };
  }

  const productId = input.productId || `PROD-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const sciId = input.sciId || `SCI-${productId}`;

  const existingBySku = input.sku ? await productRepo.getProductBySku(context, input.sku) : null;
  if (existingBySku && existingBySku.success && existingBySku.data) {
    return { success: false, errorCode: 'ALREADY_EXISTS', errorMessage: 'A product with this SKU already exists.' };
  }

  const existingByBarcode = input.barcode ? await productRepo.getProductByBarcode(context, input.barcode) : null;
  if (existingByBarcode && existingByBarcode.success && existingByBarcode.data) {
    return { success: false, errorCode: 'ALREADY_EXISTS', errorMessage: 'A product with this barcode already exists.' };
  }

  const product: SharedProductRecord = {
    sciId,
    schemaVersion: 1,
    status: input.status || 'ACTIVE',
    vendorId: context.vendorId,
    productId,
    sku: input.sku || '',
    numericNo: input.numericNo,
    alu: input.alu,
    barcode: input.barcode,
    productName: input.productName,
    description: input.description,
    industrialSector: input.industrialSector,
    category: input.category,
    subcategory: input.subcategory,
    brand: input.brand,
    unitOfMeasure: input.unitOfMeasure || 'pcs',
    purchaseUnit: input.purchaseUnit,
    salesUnit: input.salesUnit,
    costPrice: input.costPrice,
    sellingPrice: input.sellingPrice,
    wholesalePrice: input.wholesalePrice,
    taxable: input.taxable,
    vatRatePct: input.vatRatePct,
    marketplaceVisible: input.marketplaceVisible,
    catalogueVisible: input.catalogueVisible,
    createdAt: '',
    updatedAt: '',
    createdBy: context.actorId,
    updatedBy: context.actorId,
    sourceApp: context.sourceApp,
    lastSyncAt: undefined
  };

  const result = await productRepo.createProduct(context, product);
  const mapped = mapOperationResult(result);
  if (mapped.success) {
    await appendAuditEvent(context, 'CREATE_PRODUCT', 'product', productId, { product });
    await publishBIEvent(context, 'PRODUCT_CREATED', 'product', productId, { productId, productName: product.productName });
  }
  return mapped;
}

export async function updateProductCommand(context: RepositoryOperationContext, productId: string, changes: Partial<SharedProductRecord>): Promise<ProductMasterResult<SharedProductRecord>> {
  const bundle = getBundle();
  const productRepo = bundle.products;

  if (!productId || productId.trim().length === 0) {
    return { success: false, errorCode: 'VALIDATION_ERROR', errorMessage: 'productId must be a non-blank string.' };
  }

  const existing = await productRepo.getProduct(context, productId);
  if (!existing.success || !existing.data) {
    return { success: false, errorCode: 'NOT_FOUND', errorMessage: 'Product not found.' };
  }

  if (changes.sku && changes.sku !== existing.data.sku) {
    const skuConflict = await productRepo.getProductBySku(context, changes.sku);
    if (skuConflict.success && skuConflict.data && skuConflict.data.productId !== productId) {
      return { success: false, errorCode: 'ALREADY_EXISTS', errorMessage: 'A product with this SKU already exists.' };
    }
  }

  if (changes.barcode && changes.barcode !== existing.data.barcode) {
    const barcodeConflict = await productRepo.getProductByBarcode(context, changes.barcode);
    if (barcodeConflict.success && barcodeConflict.data && barcodeConflict.data.productId !== productId) {
      return { success: false, errorCode: 'ALREADY_EXISTS', errorMessage: 'A product with this barcode already exists.' };
    }
  }

  if (changes.costPrice !== undefined && changes.costPrice < 0) {
    return { success: false, errorCode: 'VALIDATION_ERROR', errorMessage: 'Cost price cannot be negative.' };
  }

  if (changes.sellingPrice !== undefined && changes.sellingPrice < 0) {
    return { success: false, errorCode: 'VALIDATION_ERROR', errorMessage: 'Selling price cannot be negative.' };
  }

  const result = await productRepo.updateProduct(context, productId, changes);
  const mapped = mapOperationResult(result);
  if (mapped.success) {
    const before = existing.data;
    const after = mapped.data || existing.data;
    await appendAuditEvent(context, 'UPDATE_PRODUCT', 'product', productId, { before, after });

    const detectedEvents: Array<[string, Record<string, unknown>]> = [];
    if (changes.costPrice !== undefined || changes.sellingPrice !== undefined) {
      detectedEvents.push(['PRODUCT_PRICE_CHANGED', { productId, costPrice: changes.costPrice, sellingPrice: changes.sellingPrice }]);
    }
    if (changes.marketplaceVisible !== undefined || changes.catalogueVisible !== undefined) {
      detectedEvents.push(['PRODUCT_VISIBILITY_CHANGED', { productId, marketplaceVisible: changes.marketplaceVisible, catalogueVisible: changes.catalogueVisible }]);
    }
    if (changes.category !== undefined && changes.category !== before.category) {
      detectedEvents.push(['PRODUCT_CATEGORY_CHANGED', { productId, fromCategory: before.category, toCategory: changes.category }]);
    }
    if (changes.brand !== undefined && changes.brand !== before.brand) {
      detectedEvents.push(['PRODUCT_BRAND_CHANGED', { productId, fromBrand: before.brand, toBrand: changes.brand }]);
    }
    if (changes.status !== undefined && changes.status !== before.status) {
      if (changes.status === 'ACTIVE') {
        detectedEvents.push(['PRODUCT_REACTIVATED', { productId, fromStatus: before.status, toStatus: changes.status }]);
      } else if (changes.status === 'INACTIVE') {
        detectedEvents.push(['PRODUCT_DEACTIVATED', { productId, fromStatus: before.status, toStatus: changes.status }]);
      }
    }
    for (const [eventType, metadata] of detectedEvents) {
      await publishBIEvent(context, eventType, 'product', productId, metadata);
    }
  }
  return mapped;
}

export async function deactivateProductCommand(context: RepositoryOperationContext, productId: string): Promise<ProductMasterResult<SharedProductRecord>> {
  const bundle = getBundle();
  const productRepo = bundle.products;

  if (!productId || productId.trim().length === 0) {
    return { success: false, errorCode: 'VALIDATION_ERROR', errorMessage: 'productId must be a non-blank string.' };
  }

  const existing = await productRepo.getProduct(context, productId);
  if (!existing.success || !existing.data) {
    return { success: false, errorCode: 'NOT_FOUND', errorMessage: 'Product not found.' };
  }

  const result = await productRepo.deactivateProduct(context, productId);
  const mapped = mapOperationResult(result);
  if (mapped.success) {
    await appendAuditEvent(context, 'DEACTIVATE_PRODUCT', 'product', productId, { before: existing.data, after: mapped.data });
    await publishBIEvent(context, 'PRODUCT_DEACTIVATED', 'product', productId, { productId, productName: existing.data.productName });
  }
  return mapped;
}

export async function resolveProductBySku(context: RepositoryOperationContext, sku: string): Promise<ProductMasterResult<SharedProductRecord>> {
  const bundle = getBundle();
  const result = await bundle.products.getProductBySku(context, sku);
  return mapOperationResult(result);
}

export async function resolveProductByBarcode(context: RepositoryOperationContext, barcode: string): Promise<ProductMasterResult<SharedProductRecord>> {
  const bundle = getBundle();
  const result = await bundle.products.getProductByBarcode(context, barcode);
  return mapOperationResult(result);
}

export async function appendAuditEvent(
  context: RepositoryOperationContext,
  action: string,
  entityType: string,
  entityId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const bundle = getBundle();
  const auditRepo = bundle.audit;
  await auditRepo.appendAuditRecord(context, {
    vendorId: context.vendorId,
    branchId: context.branchId || '',
    terminalId: context.terminalId || '',
    staffId: context.staffId || '',
    actorId: context.actorId,
    actorRole: context.actorRole || '',
    action,
    entityType,
    entityId,
    before: null,
    after: payload,
    reason: '',
    sourceApp: context.sourceApp,
    createdAt: new Date().toISOString()
  });
}

export async function publishBIEvent(
  context: RepositoryOperationContext,
  eventType: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  const bundle = getBundle();
  const biRepo = bundle.biEvents;
  const event: SharedBIEventRecord = {
    eventId: `${entityType}-${entityId}-${Date.now().toString(36)}`,
    eventType,
    vendorId: context.vendorId,
    branchId: context.branchId || '',
    terminalId: context.terminalId || '',
    staffId: context.staffId || '',
    sourceApp: context.sourceApp,
    entityType,
    entityId,
    timestamp: new Date().toISOString(),
    severity: 'INFO',
    actionRequired: false,
    metadata,
    schemaVersion: 1
  };
  await biRepo.publishEvent(context, event);
}
