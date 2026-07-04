import type { ProductMasterRecord } from '../types';
import { createBIAdviceFromTrigger } from './biAdviceService';
import { createProductMasterDraft, getProductLocationBalances, getProductMasterById, getProductMasterRecords } from './productMasterService';
import { getProductTotalAvailableStock } from './stockBalanceService';
import { createTask } from './taskService';
import { getActiveVendorId } from '../utils/vendorDataMode';

const PO_PRODUCT_ACTIVITY_KEY = 'itred_pos_po_product_activity_v1';

export type POProductActivityEventType =
  | 'PO_PRODUCT_SEARCHED'
  | 'PO_PRODUCT_SELECTED'
  | 'PO_PRODUCT_NOT_FOUND'
  | 'PO_CREATE_PRODUCT_MODAL_OPENED'
  | 'PRODUCT_CREATED_FROM_PURCHASE_ORDER'
  | 'PRODUCT_ADDED_TO_PO_LINE'
  | 'PO_LINE_PRODUCT_DUPLICATE_WARNING'
  | 'PO_LINE_PRODUCT_COST_WARNING'
  | 'PO_LINE_PRODUCT_DATA_QUALITY_TASK_CREATED'
  | 'PO_PRODUCT_BI_WARNING_CREATED';

export interface POProductSearchResult {
  product: ProductMasterRecord;
  currentStock: number;
  shelfLocation?: string;
}

export interface POProductCreatePayload {
  sku?: string;
  productName: string;
  brand?: string;
  manufacturer?: string;
  category?: string;
  department?: string;
  supplierId?: string;
  supplierName?: string;
  supplierItemCode?: string;
  upc?: string;
  unitOfMeasure?: string;
  estimatedUnitCost?: number;
  sellingPrice?: number;
  shelfLocation?: string;
  reorderPoint?: number;
  taxCode?: string;
  notes?: string;
  partNumber?: string;
  alternatePartNumber?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  yearFrom?: string;
  yearTo?: string;
  side?: string;
  condition?: string;
  compatibilityTags?: string;
  createdByStaffId: string;
  poId?: string;
}

export interface ProductDuplicateResult {
  duplicateSku?: ProductMasterRecord;
  possibleNameMatches: ProductMasterRecord[];
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function normalize(value = ''): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function words(value = ''): string[] {
  return normalize(value).split(/\s+/).filter(Boolean);
}

function matchesAnyOrder(haystack: string, query = ''): boolean {
  const queryWords = words(query);
  if (!queryWords.length) return true;
  const normalizedHaystack = `${normalize(haystack)} ${normalize(haystack).replace(/\s+/g, '')}`;
  return queryWords.every((word) => normalizedHaystack.includes(word));
}

function readList<T>(key: string): T[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

function saveList<T>(key: string, value: T[]): T[] {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Local/mock activity should not block PO use.
    }
  }
  return value;
}

function productHaystack(product: ProductMasterRecord): string {
  return [
    product.sku,
    product.productCode,
    product.productName,
    product.brand,
    product.manufacturer,
    product.supplierItemCode,
    product.barcode,
    product.category,
    product.productCategory,
    product.productSubCategory,
    product.industrialSector,
    product.description,
    product.shortDescription,
    product.make,
    product.model,
    product.partNumber,
    product.oemNumber,
    product.side,
    product.condition,
    product.sectorAttributes.make,
    product.sectorAttributes.model,
    product.sectorAttributes.partNumber,
    product.sectorAttributes.oemNumber,
    product.sectorAttributes.productCategory,
    product.sectorAttributes.productSubCategory,
    ...(product.tags || [])
  ].filter(Boolean).join(' ');
}

export function recordPOProductActivity(eventType: POProductActivityEventType, message: string, staffId: string, productId?: string, poId?: string) {
  const current = readList<Record<string, string | undefined>>(PO_PRODUCT_ACTIVITY_KEY);
  saveList(PO_PRODUCT_ACTIVITY_KEY, [{
    id: makeId('PO-PROD-ACT'),
    eventType,
    message,
    staffId,
    productId,
    poId,
    createdAt: nowIso()
  }, ...current].slice(0, 160));
}

export async function searchProductsAnyOrder(query: string): Promise<POProductSearchResult[]> {
  const products = await getProductMasterRecords();
  const matches = products.filter((product) => matchesAnyOrder(productHaystack(product), query)).slice(0, 20);
  const rows = await Promise.all(matches.map(async (product) => {
    const [currentStock, balances] = await Promise.all([
      getProductTotalAvailableStock(product.productId),
      getProductLocationBalances(product.productId)
    ]);
    return {
      product,
      currentStock,
      shelfLocation: balances.find((balance) => balance.shelfLocation)?.shelfLocation || balances[0]?.locationDisplay
    };
  }));
  return rows;
}

export async function getProductById(productId: string): Promise<ProductMasterRecord | null> {
  return getProductMasterById(productId);
}

export async function generateProductSku(payload: Pick<POProductCreatePayload, 'productName' | 'brand' | 'sku'>): Promise<string> {
  if (payload.sku?.trim()) return payload.sku.trim().toUpperCase();
  const prefix = `${payload.brand || ''} ${payload.productName}`.replace(/[^a-zA-Z0-9 ]/g, '').split(/\s+/).filter(Boolean).map((part) => part.slice(0, 3)).join('-').slice(0, 18).toUpperCase() || 'PO-PROD';
  const products = await getProductMasterRecords();
  const next = products.filter((product) => product.sku.startsWith(prefix)).length + 1;
  return `${prefix}-${String(next).padStart(3, '0')}`;
}

export async function detectDuplicateProduct(payload: Pick<POProductCreatePayload, 'sku' | 'productName' | 'brand' | 'manufacturer'>): Promise<ProductDuplicateResult> {
  const products = await getProductMasterRecords();
  const sku = normalize(payload.sku);
  const nameWords = words(`${payload.productName} ${payload.brand || ''} ${payload.manufacturer || ''}`);
  const duplicateSku = sku ? products.find((product) => normalize(product.sku) === sku || normalize(product.productCode) === sku) : undefined;
  const possibleNameMatches = products.filter((product) => {
    const haystack = normalize(`${product.productName} ${product.brand || ''} ${product.manufacturer || ''}`);
    return nameWords.length >= 2 && nameWords.filter((word) => haystack.includes(word)).length >= Math.min(2, nameWords.length);
  }).slice(0, 6);
  return { duplicateSku, possibleNameMatches };
}

async function createProductDataQualityWarning(product: ProductMasterRecord, payload: POProductCreatePayload) {
  const warnings: Array<[POProductActivityEventType, string, string]> = [];
  if (!product.defaultCostPrice) warnings.push(['PO_LINE_PRODUCT_COST_WARNING', 'PRODUCT_CREATED_WITH_ZERO_COST', `${product.productName} was created from PO with zero cost.`]);
  if (product.defaultCostPrice > 0 && product.defaultSellingPrice < product.defaultCostPrice) warnings.push(['PO_LINE_PRODUCT_COST_WARNING', 'PRODUCT_CREATED_PRICE_BELOW_COST', `${product.productName} selling price is below cost.`]);
  if (!product.category) warnings.push(['PO_LINE_PRODUCT_DATA_QUALITY_TASK_CREATED', 'PO_LINE_PRODUCT_WITHOUT_CATEGORY', `${product.productName} is missing category.`]);
  if (!product.taxCode) warnings.push(['PO_LINE_PRODUCT_DATA_QUALITY_TASK_CREATED', 'PO_LINE_PRODUCT_WITHOUT_TAX_CODE', `${product.productName} is missing tax code.`]);
  if (!payload.supplierId && !payload.supplierName) warnings.push(['PO_LINE_PRODUCT_DATA_QUALITY_TASK_CREATED', 'PO_LINE_PRODUCT_WITHOUT_SUPPLIER', `${product.productName} was added without a linked supplier.`]);

  for (const [activityType, eventType, description] of warnings) {
    await createBIAdviceFromTrigger({
      id: `${product.productId}-${eventType}`,
      eventType,
      domain: 'Inventory / Product Master / Purchase Discipline / Data Quality',
      severity: eventType.includes('PRICE') ? 'High' : 'Medium',
      description,
      recommendedAction: 'Review product master data before GRN or reorder use.'
    });
    recordPOProductActivity('PO_PRODUCT_BI_WARNING_CREATED', description, payload.createdByStaffId, product.productId, payload.poId);
    recordPOProductActivity(activityType, description, payload.createdByStaffId, product.productId, payload.poId);
  }

  if (!product.defaultCostPrice) {
    await createTask({
      title: 'Confirm product cost',
      actionType: 'Review',
      relatedModule: 'Inventory',
      relatedRecordId: product.productId,
      relatedRecordLabel: product.productName,
      assignedStaffId: 'INVENTORY-DESK',
      assignedStaffName: 'Inventory Desk',
      priority: 'Medium',
      description: `Confirm cost for ${product.productName} created from Purchase Order.`,
      createdBy: payload.createdByStaffId
    });
  }
  if (!product.category) {
    await createTask({
      title: 'Confirm product category',
      actionType: 'Review',
      relatedModule: 'Inventory',
      relatedRecordId: product.productId,
      relatedRecordLabel: product.productName,
      assignedStaffId: 'INVENTORY-DESK',
      assignedStaffName: 'Inventory Desk',
      priority: 'Medium',
      description: `Add category for ${product.productName}.`,
      createdBy: payload.createdByStaffId
    });
  }
  if (!product.taxCode) {
    await createTask({
      title: 'Add missing tax code',
      actionType: 'Review',
      relatedModule: 'Inventory',
      relatedRecordId: product.productId,
      relatedRecordLabel: product.productName,
      assignedStaffId: 'ACCOUNTING-DESK',
      assignedStaffName: 'Accounting Desk',
      priority: 'Medium',
      description: `Add tax code for ${product.productName}.`,
      createdBy: payload.createdByStaffId
    });
  }
  if (!product.supplierItemCode) {
    await createTask({
      title: 'Confirm supplier item code',
      actionType: 'ContactSupplier',
      relatedModule: 'Inventory',
      relatedRecordId: product.productId,
      relatedRecordLabel: product.productName,
      assignedStaffId: 'PURCHASE-DESK',
      assignedStaffName: 'Purchase Discipline',
      priority: 'Low',
      description: `Confirm supplier item code for ${product.productName}.`,
      createdBy: payload.createdByStaffId
    });
  }
}

export async function createProductFromPurchaseOrder(payload: POProductCreatePayload): Promise<ProductMasterRecord> {
  const productName = payload.productName.trim();
  if (!productName) throw new Error('Product name is required.');
  const sku = await generateProductSku(payload);
  const duplicates = await detectDuplicateProduct({ ...payload, sku });
  if (duplicates.duplicateSku) throw new Error(`Duplicate SKU found: ${duplicates.duplicateSku.sku}.`);
  if (duplicates.possibleNameMatches.length) {
    recordPOProductActivity('PO_LINE_PRODUCT_DUPLICATE_WARNING', `Possible duplicate product for ${productName}.`, payload.createdByStaffId, duplicates.possibleNameMatches[0].productId, payload.poId);
    await createBIAdviceFromTrigger({
      id: `${payload.poId || sku}-PRODUCT-DUPLICATE`,
      eventType: 'PRODUCT_POSSIBLE_DUPLICATE',
      domain: 'Inventory / Product Master / Purchase Discipline / Data Quality',
      severity: 'Medium',
      description: `${productName} may duplicate ${duplicates.possibleNameMatches.map((product) => product.productName).join(', ')}.`,
      recommendedAction: 'Review possible duplicate product before activating the product master record.'
    });
    await createTask({
      title: 'Review possible duplicate product',
      actionType: 'Investigate',
      relatedModule: 'Inventory',
      relatedRecordId: payload.poId || sku,
      relatedRecordLabel: productName,
      assignedStaffId: 'INVENTORY-DESK',
      assignedStaffName: 'Inventory Desk',
      priority: 'Medium',
      description: `Review possible duplicate product created from PO: ${productName}.`,
      notes: duplicates.possibleNameMatches.map((product) => product.productName).join('\n'),
      createdBy: payload.createdByStaffId
    });
  }

  const cost = Math.max(0, payload.estimatedUnitCost || 0);
  const price = Math.max(0, payload.sellingPrice || 0);
  const category = payload.category?.trim() || payload.department?.trim() || '';
  const product = await createProductMasterDraft({
    vendorId: getActiveVendorId(),
    productCode: sku,
    sku,
    barcode: payload.upc?.trim(),
    productName,
    description: payload.notes || 'Created from Purchase Order workflow.',
    brand: payload.brand?.trim(),
    manufacturer: payload.manufacturer?.trim(),
    supplierName: payload.supplierName?.trim(),
    supplierItemCode: payload.supplierItemCode?.trim(),
    industrialSector: 'GENERAL_RETAIL',
    productCategory: category,
    productSubCategory: payload.department?.trim(),
    productType: 'Stock Item',
    status: 'Draft',
    productStatus: 'Draft',
    riskStatus: 'Normal',
    category,
    unitOfMeasure: payload.unitOfMeasure || 'pcs',
    condition: payload.condition,
    make: payload.vehicleMake,
    model: payload.vehicleModel,
    yearFrom: payload.yearFrom,
    yearTo: payload.yearTo,
    side: payload.side,
    partNumber: payload.partNumber,
    oemNumber: payload.alternatePartNumber,
    tags: payload.compatibilityTags?.split(',').map((tag) => tag.trim()).filter(Boolean),
    taxCode: payload.taxCode?.trim() || '',
    defaultSellingPrice: price,
    defaultCostPrice: cost,
    reorderLevel: payload.reorderPoint || 0,
    reorderQty: payload.reorderPoint || 0,
    marginPercent: price > 0 ? Number((((price - cost) / price) * 100).toFixed(2)) : 0,
    preferredSupplierId: payload.supplierId,
    preferredSupplierName: payload.supplierName,
    sectorAttributes: {
      sector: 'MOTOR_SPARES',
      productCategory: category,
      brand: payload.brand,
      manufacturer: payload.manufacturer,
      make: payload.vehicleMake,
      model: payload.vehicleModel,
      yearFrom: payload.yearFrom,
      yearTo: payload.yearTo,
      side: payload.side,
      partNumber: payload.partNumber,
      oemNumber: payload.alternatePartNumber,
      notes: payload.notes
    },
    createdByStaffId: payload.createdByStaffId
  });

  recordPOProductActivity('PRODUCT_CREATED_FROM_PURCHASE_ORDER', `${product.productName} created from Purchase Order.`, payload.createdByStaffId, product.productId, payload.poId);
  await createBIAdviceFromTrigger({
    id: `${product.productId}-CREATED-FROM-PO`,
    eventType: 'PRODUCT_CREATED_FROM_PURCHASE_ORDER',
    domain: 'Inventory / Product Master / Purchase Discipline / Data Quality',
    severity: 'Low',
    description: `${product.productName} was created from a Purchase Order. It is a draft product only and did not create stock quantity.`,
    recommendedAction: 'Review product master details before activation or GRN posting.'
  });
  await createTask({
    title: 'Review new product created from PO',
    actionType: 'Review',
    relatedModule: 'Inventory',
    relatedRecordId: product.productId,
    relatedRecordLabel: product.productName,
    assignedStaffId: 'INVENTORY-DESK',
    assignedStaffName: 'Inventory Desk',
    priority: 'Medium',
    description: `Review Product Master draft ${product.productName} created from Purchase Order.`,
    createdBy: payload.createdByStaffId
  });
  await createProductDataQualityWarning(product, payload);
  return product;
}

export async function updateLocalProductMaster(product: ProductMasterRecord): Promise<ProductMasterRecord> {
  return product;
}
