import { mockProducts } from '../mock/mockPosData';
import type { Product, ProductMasterRecord, StockStatus } from '../types/posTypes';
import { ENABLE_MOCK_SEED_DATA, getVendorScopedStorageKey } from './vendorDataMode';

export const POS_PRODUCT_STORE_KEY = 'itred_pos_products';
export const POS_PRODUCT_STORE_EVENT = 'itred_pos_products_updated';
const LEGACY_STOCK_CATALOG_KEY = 'sci_pos_stock_catalog';

function storageAvailable(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

function safeReadProducts(key: string): Product[] {
  if (!storageAvailable()) return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeProduct) : [];
  } catch {
    return [];
  }
}

function dispatchProductUpdate(): void {
  try {
    window.dispatchEvent(new CustomEvent(POS_PRODUCT_STORE_EVENT));
  } catch {
    // Non-browser contexts can ignore UI refresh notifications.
  }
}

function stockStatusFor(qty: number, minStock: number): StockStatus {
  if (qty <= 0) return 'Out of Stock';
  if (qty <= minStock) return 'Low Stock';
  return 'In Stock';
}

export function normalizeProduct(product: Partial<Product>): Product {
  const sku = String(product.sku || product.code || product.barcode || product.id || `SKU-${Date.now()}`);
  const name = String(product.productName || product.name || 'Imported Product');
  const stock = Number(product.stock ?? product.qtyOnHand ?? product.availableStock ?? 0);
  const minStock = Number(product.minStock ?? product.reorderLevel ?? 0);
  const price = Number(product.price ?? product.sellingPrice ?? 0);
  const cost = Number(product.cost ?? product.costPrice ?? 0);
  const branchId = product.branchId || 'main-branch';
  const branch = product.branch || 'Main Branch';
  const warehouseId = product.warehouseId || 'main-warehouse';
  const warehouse = product.warehouse || 'Main Warehouse';
  const status = (product.stockStatus || product.healthStatus || stockStatusFor(stock, minStock)) as StockStatus;

  return {
    ...product,
    id: String(product.id || product.productNumericNumber || sku),
    code: sku,
    sku,
    name,
    productName: name,
    category: String(product.category || product.productCategory || 'Imported'),
    productCategory: product.productCategory || product.category || 'Imported',
    price,
    sellingPrice: price,
    cost,
    costPrice: cost,
    stock,
    qtyOnHand: stock,
    availableStock: Number(product.availableStock ?? stock),
    minStock,
    reorderLevel: Number(product.reorderLevel ?? minStock),
    unit: String(product.unit || product.unitOfMeasure || 'pcs'),
    unitOfMeasure: String(product.unitOfMeasure || product.unit || 'pcs'),
    branchId,
    branch,
    warehouseId,
    warehouse,
    stockStatus: status,
    healthStatus: status,
    isActive: product.isActive ?? true,
    updatedAt: product.updatedAt || new Date().toISOString()
  };
}

export function productMasterToPosProduct(product: ProductMasterRecord, stock = 0): Product {
  return normalizeProduct({
    id: product.productId,
    code: product.sku || product.productCode,
    sku: product.sku || product.productCode,
    barcode: product.barcode,
    alu: product.alu,
    productNumericNumber: product.productNumericNumber,
    name: product.productName,
    productName: product.productName,
    category: product.category || product.productCategory || 'Imported',
    productCategory: product.productCategory || product.category || 'Imported',
    productSubCategory: product.productSubCategory,
    industrialSector: product.industrialSector || product.sectorAttributes?.sector,
    price: product.defaultSellingPrice,
    sellingPrice: product.defaultSellingPrice,
    cost: product.defaultCostPrice,
    costPrice: product.defaultCostPrice,
    stock,
    qtyOnHand: stock,
    availableStock: stock,
    minStock: product.reorderLevel || 0,
    reorderLevel: product.reorderLevel || 0,
    unit: product.unitOfMeasure || 'pcs',
    unitOfMeasure: product.unitOfMeasure || 'pcs',
    vendorId: product.vendorId,
    brand: product.brand,
    manufacturer: product.manufacturer,
    supplierName: product.supplierName || product.preferredSupplierName,
    salesAccountCOA: product.salesAccountCOA,
    assetAccountCOA: product.assetAccountCOA,
    isActive: (product.productStatus || product.status) !== 'Inactive' && (product.productStatus || product.status) !== 'Blocked',
    createdByStaffId: product.createdByStaffId,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt
  });
}

export function getPosProductStoreKey(vendorId?: string): string {
  return getVendorScopedStorageKey(POS_PRODUCT_STORE_KEY, vendorId);
}

export function loadLocalProducts(vendorId?: string): Product[] {
  const storeKey = getPosProductStoreKey(vendorId);
  const canonical = safeReadProducts(storeKey);
  if (canonical.length > 0) return canonical;

  if (ENABLE_MOCK_SEED_DATA) {
    const legacy = [...safeReadProducts(POS_PRODUCT_STORE_KEY), ...safeReadProducts(LEGACY_STOCK_CATALOG_KEY)];
    const seeded = legacy.length > 0 ? legacy : mockProducts.map(normalizeProduct);
    saveLocalProducts(seeded, false, vendorId);
    return seeded;
  }

  saveLocalProducts([], false, vendorId);
  return [];
}

export function saveLocalProducts(products: Product[], notify = true, vendorId?: string): Product[] {
  const normalized = products.map(normalizeProduct);
  if (storageAvailable()) {
    localStorage.setItem(getPosProductStoreKey(vendorId), JSON.stringify(normalized));
  }
  if (notify) dispatchProductUpdate();
  return normalized;
}

export function upsertLocalProducts(products: Product[]): Product[] {
  const current = loadLocalProducts();
  const next = [...current];
  products.map(normalizeProduct).forEach((product) => {
    const sku = product.sku.toLowerCase();
    const index = next.findIndex((item) => item.id === product.id || item.sku?.toLowerCase() === sku || item.code.toLowerCase() === sku);
    if (index >= 0) {
      next[index] = normalizeProduct({ ...next[index], ...product });
    } else {
      next.unshift(product);
    }
  });
  return saveLocalProducts(next);
}

export function updateLocalProductStock(productId: string, quantityDelta: number): Product[] {
  const next = loadLocalProducts().map((product) => {
    if (product.id !== productId) return product;
    const stock = Math.max(0, (product.qtyOnHand ?? product.stock) + quantityDelta);
    return normalizeProduct({
      ...product,
      stock,
      qtyOnHand: stock,
      availableStock: stock,
      lastMovementDate: new Date().toISOString().slice(0, 10)
    });
  });
  return saveLocalProducts(next);
}
