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

const PRODUCT_MASTER_KEY = 'sci_pos_product_master_records';
const PRODUCT_AUDIT_KEY = 'sci_pos_product_master_audit';
const MANUAL_SUPPLIER_LINK_KEY = 'itred_pos_manual_product_supplier_links_v1';
const MANUAL_PRICE_RECORD_KEY = 'itred_pos_manual_product_price_records_v1';
const MANUAL_REORDER_RULE_KEY = 'itred_pos_manual_product_reorder_rules_v1';

let memoryProducts: ProductMasterRecord[] = [...mockProductMasterRecords];

function readProducts(): ProductMasterRecord[] {
  try {
    const cached = localStorage.getItem(PRODUCT_MASTER_KEY);
    if (!cached) {
      localStorage.setItem(PRODUCT_MASTER_KEY, JSON.stringify(mockProductMasterRecords));
      memoryProducts = [...mockProductMasterRecords];
      return memoryProducts;
    }
    memoryProducts = JSON.parse(cached) as ProductMasterRecord[];
    return memoryProducts;
  } catch {
    return memoryProducts;
  }
}

function writeProducts(products: ProductMasterRecord[]): ProductMasterRecord[] {
  memoryProducts = products;
  try {
    localStorage.setItem(PRODUCT_MASTER_KEY, JSON.stringify(products));
  } catch {
    // localStorage may be unavailable in some test contexts.
  }
  return products;
}

function recordProductAudit(productId: string, eventType: string, message: string, staffId = 'SYSTEM'): void {
  try {
    const cached = localStorage.getItem(PRODUCT_AUDIT_KEY);
    const existing = cached ? JSON.parse(cached) as Array<Record<string, unknown>> : [];
    localStorage.setItem(PRODUCT_AUDIT_KEY, JSON.stringify([{
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
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return [];
    const parsed = JSON.parse(cached);
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
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
  return mockProductStockBalances.filter((balance) => balance.productId === productId);
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

export async function searchProductMaster(query: string, filters: ProductMasterFilterState = {}): Promise<ProductMasterRecord[]> {
  return searchProductMasterRecords(query, filters);
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
  const balances = mockProductStockBalances.filter((balance) => productIds.has(balance.productId));
  const linkedProducts = new Set(mockProductSupplierLinks.map((link) => link.productId));
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
  if (updated) recordProductAudit(productId, 'PRODUCT_MASTER_UPDATED', `${updated.productName} updated.`, staffId);
  return updated;
}

export async function updateProductMaster(productId: string, patch: Partial<ProductMasterRecord>, staffId = 'SYSTEM'): Promise<ProductMasterRecord | null> {
  return updateProductMasterPlaceholder(productId, patch, staffId);
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
  return mockProductBarcodeRecords.filter((barcode) => barcode.productId === productId);
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
    ...mockProductSupplierLinks,
    ...readManualRows<ProductSupplierLink>(MANUAL_SUPPLIER_LINK_KEY)
  ].filter((link) => link.productId === productId);
}

export async function getProductPrices(productId: string): Promise<ProductPriceRecord[]> {
  return [
    ...mockProductPriceRecords,
    ...readManualRows<ProductPriceRecord>(MANUAL_PRICE_RECORD_KEY)
  ].filter((price) => price.productId === productId);
}

export async function getProductReorderRules(productId: string): Promise<ProductReorderRule[]> {
  return [
    ...mockProductReorderRules,
    ...readManualRows<ProductReorderRule>(MANUAL_REORDER_RULE_KEY)
  ].filter((rule) => rule.productId === productId);
}

export async function getProductMasterAudit(productId: string): Promise<Array<{ id: string; productId: string; eventType: string; message: string; staffId: string; createdAt: string }>> {
  try {
    const cached = localStorage.getItem(PRODUCT_AUDIT_KEY);
    const events = cached ? JSON.parse(cached) as Array<{ id: string; productId: string; eventType: string; message: string; staffId: string; createdAt: string }> : [];
    return events.filter((event) => event.productId === productId);
  } catch {
    return [];
  }
}

export async function exportProductMasterPlaceholder(filters: ProductMasterFilterState = {}): Promise<{ message: string; filters: ProductMasterFilterState }> {
  recordProductAudit('ALL', 'PRODUCT_MASTER_EXPORT_PLACEHOLDER', 'Product Master export placeholder requested.');
  return { message: 'Product Master export placeholder prepared locally.', filters };
}
