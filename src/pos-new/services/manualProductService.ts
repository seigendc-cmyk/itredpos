import {
  ManualProductDraft,
  ManualProductValidationIssue,
  OpeningBalanceDraft,
  OpeningBalanceDraftStatus,
  ProductCreationActivityEvent,
  ProductMasterRecord,
  ProductPriceRecord,
  ProductReorderRule,
  ProductSupplierLink
} from '../types/posTypes';
import { createProductMasterDraft, getProductMasterById, getProductMasterRecords, updateProductMasterPlaceholder } from './productMasterService';
import { postInventoryMovement } from './inventoryMovementService';
import { createOperationalApproval } from './approvalService';
import { enqueueOfflineAction, getNetworkStatus } from './offlineSyncService';
import { getActiveVendorId, readVendorScopedList, writeVendorScopedList } from '../utils/vendorDataMode';
import { getCachedVendorTaxSettings } from './vendorTaxSettingsService';

const SUPPLIER_LINK_KEY = 'itred_pos_manual_product_supplier_links_v1';
const PRICE_RECORD_KEY = 'itred_pos_manual_product_price_records_v1';
const REORDER_RULE_KEY = 'itred_pos_manual_product_reorder_rules_v1';
const OPENING_BALANCE_KEY = 'itred_pos_manual_opening_balance_drafts_v1';
const ACTIVITY_KEY = 'itred_pos_manual_product_activity_v1';

const moneyNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

function safeReadList<T>(key: string, fallback: T[] = []): T[] {
  return readVendorScopedList<T>(key, fallback);
}

function safeWriteList<T>(key: string, value: T[]): T[] {
  return writeVendorScopedList(key, value);
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function now(): string {
  return new Date().toISOString();
}

function activityRows(): ProductCreationActivityEvent[] {
  return safeReadList<ProductCreationActivityEvent>(ACTIVITY_KEY, []);
}

function addActivity(event: Omit<ProductCreationActivityEvent, 'eventId' | 'createdAt'>): ProductCreationActivityEvent {
  const next: ProductCreationActivityEvent = { ...event, eventId: makeId('PCA'), createdAt: now() };
  safeWriteList(ACTIVITY_KEY, [next, ...activityRows()].slice(0, 160));
  return next;
}

function openingRows(): OpeningBalanceDraft[] {
  return safeReadList<OpeningBalanceDraft>(OPENING_BALANCE_KEY, []);
}

function saveOpeningRows(rows: OpeningBalanceDraft[]): OpeningBalanceDraft[] {
  return safeWriteList(OPENING_BALANCE_KEY, rows);
}

export function readManualSupplierLinks(): ProductSupplierLink[] {
  return safeReadList<ProductSupplierLink>(SUPPLIER_LINK_KEY, []);
}

export function readManualPriceRecords(): ProductPriceRecord[] {
  return safeReadList<ProductPriceRecord>(PRICE_RECORD_KEY, []);
}

export function readManualReorderRules(): ProductReorderRule[] {
  return safeReadList<ProductReorderRule>(REORDER_RULE_KEY, []);
}

function calculateMargin(sellingPrice = 0, costPrice = 0): number {
  return sellingPrice > 0 ? Math.round(((sellingPrice - costPrice) / sellingPrice) * 100) : 0;
}

function compactNotes(rows: Array<[string, string | number | boolean | undefined]>): string {
  return rows
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([label, value]) => `${label}: ${typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value}`)
    .join('; ');
}

function toProductMasterPayload(payload: ManualProductDraft, status: 'Draft' | 'Active' | 'Pending Review' | 'Blocked' | 'Inactive' = 'Draft'): Omit<ProductMasterRecord, 'productId' | 'createdAt' | 'updatedAt'> {
  const vendorId = payload.vendorId || getActiveVendorId();
  const defaultVatRate = getCachedVendorTaxSettings(vendorId).defaultVatRate;
  const productName = payload.productName.trim() || 'Manual Product Draft';
  const sku = payload.sku?.trim() || payload.barcode?.trim() || payload.alu?.trim() || payload.vendorSku?.trim() || `MAN-${Date.now()}`;
  const cost = moneyNumber(payload.costPrice) || 0;
  const selling = moneyNumber(payload.sellingPrice) || 0;
  const sectorNotes = compactNotes([
    ['Wattage', payload.wattage],
    ['Voltage', payload.voltage],
    ['Battery Capacity', payload.batteryCapacity],
    ['Panel Type', payload.panelType],
    ['Inverter Type', payload.inverterType],
    ['Regulatory Notes', payload.regulatoryNotes],
    ['Storage Requirement', payload.storageRequirement]
  ]);
  return {
    vendorId,
    productCode: sku,
    sku,
    barcode: payload.barcode || undefined,
    alu: payload.alu || undefined,
    vendorSku: payload.vendorSku || undefined,
    productNumericNumber: payload.productNumericNumber || undefined,
    productName,
    description: payload.description || `${productName} manual product draft.`,
    brand: payload.brand || undefined,
    manufacturer: payload.manufacturer || undefined,
    supplierName: payload.supplierName || undefined,
    supplierItemCode: payload.supplierItemCode || undefined,
    industrialSector: payload.industrialSector,
    productCategory: payload.category || 'General',
    productSubCategory: payload.subcategory || undefined,
    productType: 'Stock Item',
    status,
    productStatus: status,
    riskStatus: status === 'Blocked' ? 'Blocked' : 'Normal',
    category: payload.category || 'General',
    unitOfMeasure: payload.unitOfMeasure || 'pcs',
    condition: payload.condition || 'New',
    colour: payload.colour || undefined,
    imageUrl: payload.imageUrl || undefined,
    make: payload.make || undefined,
    model: payload.model || payload.vehicleModel || undefined,
    yearFrom: payload.yearFrom || undefined,
    yearTo: payload.yearTo || undefined,
    side: payload.side || undefined,
    partNumber: payload.partNumber || undefined,
    oemNumber: payload.oemNumber || undefined,
    tags: payload.tags?.length ? payload.tags : ['Manual Product'],
    taxCode: defaultVatRate > 0 ? 'STANDARD' : 'EXEMPT',
    taxMode: payload.taxMode || 'VAT Registered',
    vatRate: moneyNumber(payload.vatRate) ?? defaultVatRate,
    defaultSellingPrice: selling,
    defaultCostPrice: cost,
    reorderLevel: moneyNumber(payload.reorderLevel) || 0,
    reorderQty: moneyNumber(payload.reorderQty) || 0,
    marginPercent: calculateMargin(selling, cost),
    preferredSupplierName: payload.supplierName || undefined,
    sectorAttributes: {
      sector: payload.industrialSector,
      productName,
      sku,
      barcode: payload.barcode || undefined,
      productCategory: payload.category || 'General',
      productSubCategory: payload.subcategory || undefined,
      brand: payload.brand || undefined,
      manufacturer: payload.manufacturer || undefined,
      unitOfMeasure: payload.unitOfMeasure || 'pcs',
      packSize: payload.packSize || undefined,
      supplierName: payload.supplierName || undefined,
      branchOrWarehouse: payload.businessLocation || [payload.branchId, payload.warehouseId].filter(Boolean).join(' / ') || undefined,
      openingStock: moneyNumber(payload.openingQty),
      imageUrl: payload.imageUrl || undefined,
      status: payload.status || payload.productStatus,
      make: payload.make || undefined,
      model: payload.model || payload.vehicleModel || undefined,
      yearFrom: payload.yearFrom || undefined,
      yearTo: payload.yearTo || undefined,
      side: payload.side || undefined,
      partNumber: payload.partNumber || undefined,
      oemNumber: payload.oemNumber || undefined,
      engineCode: payload.engineCode || undefined,
      chassisCode: payload.chassisCode || undefined,
      size: payload.size || undefined,
      material: payload.material || undefined,
      weight: payload.weight || undefined,
      warrantyPeriod: payload.warranty || undefined,
      productGrade: payload.grade || undefined,
      productType: payload.productType || undefined,
      colour: payload.colour || undefined,
      batchNumber: payload.batchNumber || undefined,
      expiryDate: payload.expiryDate || undefined,
      perishableFlag: payload.perishableFlag ?? undefined,
      chemicalActiveIngredient: payload.chemicalActiveIngredient || undefined,
      applicationRate: payload.applicationRate || undefined,
      regulatoryNotes: payload.regulatoryNotes || undefined,
      dosage: payload.dosage || undefined,
      strength: payload.strength || undefined,
      prescriptionRequired: payload.prescriptionRequired ?? undefined,
      gender: payload.gender || undefined,
      fabric: payload.fabric || undefined,
      style: payload.style || undefined,
      modelNumber: payload.modelNumber || undefined,
      serialNumberSupport: payload.serialNumberSupport ?? undefined,
      powerRating: payload.powerRating || undefined,
      dimensions: payload.dimensions || undefined,
      fragileFlag: payload.fragileFlag ?? undefined,
      storageRequirement: payload.storageRequirement || undefined,
      vehicleMake: payload.vehicleMake || payload.make || undefined,
      vehicleModel: payload.vehicleModel || payload.model || undefined,
      yearRange: payload.yearRange || ([payload.yearFrom, payload.yearTo].filter(Boolean).join(' - ') || undefined),
      seedVariety: payload.seedVariety || undefined,
      expiryRequired: ['GROCERY', 'AGRICULTURE', 'PHARMACY'].includes(payload.industrialSector),
      serialTrackingRequired: payload.serialNumberSupport ?? ['ELECTRONICS'].includes(payload.industrialSector),
      batchTrackingRequired: ['GROCERY', 'PHARMACY'].includes(payload.industrialSector) || Boolean(payload.batchNumber),
      notes: sectorNotes || 'Created from Manual Product form.'
    },
    createdByStaffId: payload.createdByStaffId || 'MANUAL_PRODUCT'
  };
}

export async function validateManualProduct(payload: ManualProductDraft): Promise<ManualProductValidationIssue[]> {
  const issues: ManualProductValidationIssue[] = [];
  const add = (field: string, severity: ManualProductValidationIssue['severity'], message: string, suggestedFix: string) => {
    issues.push({ issueId: makeId('MPV'), field, severity, message, suggestedFix });
  };
  const cost = moneyNumber(payload.costPrice);
  const selling = moneyNumber(payload.sellingPrice);
  const openingQty = moneyNumber(payload.openingQty);
  const openingUnitCost = moneyNumber(payload.openingUnitCost);
  if (!payload.productName?.trim()) add('productName', 'Error', 'Product name is required.', 'Enter a clear product name.');
  if (!payload.sku && !payload.barcode && !payload.alu && !payload.vendorSku) add('identifier', 'Error', 'At least one identifier is required.', 'Enter SKU, barcode, ALU, or vendor SKU.');
  if (!payload.industrialSector) add('industrialSector', 'Error', 'Industrial sector is required.', 'Select an industrial sector.');
  if (selling === undefined || selling < 0) add('sellingPrice', 'Error', 'Selling price must be zero or above before activation.', 'Enter a valid selling price.');
  if (cost !== undefined && cost < 0) add('costPrice', 'Error', 'Cost price cannot be negative.', 'Enter zero or a positive cost.');
  if (openingQty !== undefined && openingQty < 0) add('openingQty', 'Error', 'Opening quantity cannot be negative.', 'Enter zero or a positive quantity.');
  if (openingUnitCost !== undefined && openingUnitCost < 0) add('openingUnitCost', 'Error', 'Opening unit cost cannot be negative.', 'Enter zero or a positive unit cost.');
  if (cost === undefined) add('costPrice', 'Warning', 'Cost price is recommended.', 'Enter a cost price for margin review.');
  if (!payload.supplierName) add('supplierName', 'Warning', 'Supplier link is recommended.', 'Add supplier details or save as draft.');
  if (!payload.shelfLocation) add('shelfLocation', 'Warning', 'Shelf/location is recommended.', 'Enter shelf or location for stock setup.');
  if (!payload.category) add('category', 'Warning', 'Category is recommended.', 'Select or enter a product category.');
  if (selling !== undefined && cost !== undefined && selling < cost) add('sellingPrice', 'Warning', 'Selling price is below cost.', 'Review margin before activation.');
  if (payload.industrialSector === 'MOTOR_SPARES' && (!payload.make || !payload.model || !payload.yearFrom)) add('make/model/year', 'Warning', 'Motor spares should include make, model, and year.', 'Add fitment details or confirm universal part.');
  if (payload.industrialSector === 'GROCERY' && (!payload.expiryDate || !payload.batchNumber)) add('expiry/batch', 'Warning', 'Grocery products should include expiry date and batch number.', 'Capture batch and expiry for traceability.');
  if (payload.industrialSector === 'HARDWARE' && (!payload.material || !payload.size)) add('material/size', 'Warning', 'Hardware products should include material and size.', 'Add industrial specification details.');
  if (payload.industrialSector === 'AGRICULTURE' && (!payload.seedVariety && !payload.chemicalActiveIngredient)) add('agriculture', 'Warning', 'Agriculture products should include seed variety or active ingredient.', 'Add agriculture compliance details.');
  if (payload.industrialSector === 'PHARMACY' && (!payload.batchNumber || !payload.expiryDate || !payload.dosage)) add('pharmacy', 'Warning', 'Pharmacy products should include batch, expiry, and dosage.', 'Capture medicine control details.');
  if (payload.industrialSector === 'ELECTRONICS' && !payload.modelNumber) add('modelNumber', 'Warning', 'Electronics products should include model number.', 'Add model or serial support details.');
  if (payload.industrialSector === 'OTHER' && !payload.notes?.trim()) add('notes', 'Info', 'Other sector products benefit from extra notes.', 'Capture identifying notes for this product.');
  const duplicate = await detectManualProductDuplicate(payload);
  if (duplicate) {
    addActivity({ eventType: 'PRODUCT_DUPLICATE_WARNING', productId: duplicate.productId, message: `Manual product duplicate risk detected for ${duplicate.productName}.` });
  }
  if (duplicate && (duplicate.productStatus || duplicate.status) === 'Active') add('duplicate', 'Error', `Duplicate active product detected: ${duplicate.productName}.`, 'Use a different SKU/barcode/ALU or review existing product.');
  if (duplicate && (duplicate.productStatus || duplicate.status) !== 'Active') add('duplicate', 'Warning', `Possible duplicate draft/review product: ${duplicate.productName}.`, 'Review before activation.');
  return issues;
}

export async function detectManualProductDuplicate(payload: ManualProductDraft): Promise<ProductMasterRecord | undefined> {
  const products = await getProductMasterRecords();
  return products.find((product) => {
    const skuMatch = payload.sku && payload.sku.toLowerCase() === product.sku?.toLowerCase();
    const barcodeMatch = payload.barcode && payload.barcode.toLowerCase() === product.barcode?.toLowerCase();
    const aluMatch = payload.alu && payload.alu.toLowerCase() === product.alu?.toLowerCase();
    const vendorSkuMatch = payload.vendorSku && payload.vendorSku.toLowerCase() === product.vendorSku?.toLowerCase();
    const nameMatch = payload.productName && payload.productName.toLowerCase() === product.productName.toLowerCase();
    const brandMatch = !payload.brand || payload.brand.toLowerCase() === String(product.brand || '').toLowerCase();
    const makeMatch = !payload.make || payload.make.toLowerCase() === String(product.make || '').toLowerCase();
    const modelMatch = !payload.model || payload.model.toLowerCase() === String(product.model || '').toLowerCase();
    return Boolean(skuMatch || barcodeMatch || aluMatch || vendorSkuMatch || (nameMatch && brandMatch && makeMatch && modelMatch));
  });
}

export async function createManualProductDraft(payload: ManualProductDraft): Promise<ProductMasterRecord> {
  const product = await createProductMasterDraft(toProductMasterPayload(payload, 'Draft'));
  addActivity({ eventType: 'PRODUCT_DRAFT_CREATED', productId: product.productId, message: `${product.productName} draft created.`, staffId: payload.createdByStaffId, staffName: payload.createdByStaffName });
  await createSupplierLinkFromProduct(product.productId, payload);
  await createPriceRecordFromProduct(product.productId, payload);
  await createReorderRuleFromProduct(product.productId, payload);
  if ((await getNetworkStatus()) !== 'Online') {
    await enqueueOfflineAction({
      vendorId: product.vendorId,
      branchId: payload.branchId || 'BR-HARARE',
      terminalId: 'BACK-01',
      staffId: payload.createdByStaffId || 'MANUAL_PRODUCT',
      staffName: payload.createdByStaffName || 'Manual Product',
      entityType: 'Inventory Movement',
      entityId: product.productId,
      entityNumber: product.sku,
      operationType: 'PRODUCT_DRAFT_CREATED',
      payload: { productName: product.productName, sku: product.sku },
      status: 'Queued',
      notes: 'Manual product draft created offline. No backend call made.'
    });
  }
  return product;
}

export async function updateManualProductDraft(productId: string, patch: Partial<ManualProductDraft>): Promise<ProductMasterRecord | null> {
  const product = await getProductMasterById(productId);
  if (!product) return null;
  const mergedDraft: ManualProductDraft = {
    vendorId: product.vendorId,
    productId,
    productName: patch.productName || product.productName,
    sku: patch.sku || product.sku,
    barcode: patch.barcode || product.barcode,
    alu: patch.alu || product.alu,
    vendorSku: patch.vendorSku || product.vendorSku,
    productNumericNumber: patch.productNumericNumber || product.productNumericNumber,
    description: patch.description || product.description,
    brand: patch.brand || product.brand,
    manufacturer: patch.manufacturer || product.manufacturer,
    industrialSector: patch.industrialSector || product.industrialSector || product.sectorAttributes.sector,
    category: patch.category || product.category,
    subcategory: patch.subcategory || product.productSubCategory,
    unitOfMeasure: patch.unitOfMeasure || product.unitOfMeasure,
    condition: patch.condition || product.condition,
    colour: patch.colour || product.colour,
    productStatus: patch.productStatus || (product.productStatus as ManualProductDraft['productStatus']) || 'Draft',
    costPrice: moneyNumber(patch.costPrice) ?? product.defaultCostPrice,
    sellingPrice: moneyNumber(patch.sellingPrice) ?? product.defaultSellingPrice,
    taxMode: patch.taxMode || product.taxMode,
    vatRate: moneyNumber(patch.vatRate) ?? product.vatRate,
    reorderLevel: moneyNumber(patch.reorderLevel) ?? product.reorderLevel,
    reorderQty: moneyNumber(patch.reorderQty) ?? product.reorderQty,
    imageUrl: patch.imageUrl || product.imageUrl,
    createdByStaffId: patch.createdByStaffId
  };
  return updateProductMasterPlaceholder(productId, {
    ...toProductMasterPayload(mergedDraft, product.status),
    productId,
    createdAt: product.createdAt,
    updatedAt: now()
  }, patch.createdByStaffId || 'MANUAL_PRODUCT');
}

export async function activateProduct(productId: string, staffId: string): Promise<ProductMasterRecord | null> {
  const updated = await updateProductMasterPlaceholder(productId, { status: 'Active', productStatus: 'Active', approvedByStaffId: staffId, riskStatus: 'Normal' }, staffId);
  if (updated) addActivity({ eventType: 'PRODUCT_ACTIVATED', productId, message: `${updated.productName} activated. Stock was not changed.`, staffId });
  return updated;
}

export async function blockProduct(productId: string, staffId: string, reason: string): Promise<ProductMasterRecord | null> {
  const updated = await updateProductMasterPlaceholder(productId, { status: 'Blocked', productStatus: 'Blocked', riskStatus: 'Blocked' }, staffId);
  if (updated) addActivity({ eventType: 'PRODUCT_BLOCKED', productId, message: reason || `${updated.productName} blocked.`, staffId });
  return updated;
}

export async function createSupplierLinkFromProduct(productId: string, payload: Partial<ManualProductDraft>): Promise<ProductSupplierLink | undefined> {
  if (!payload.supplierName) return undefined;
  const link: ProductSupplierLink = {
    supplierLinkId: makeId('PSL'),
    productId,
    supplierId: `SUP-${String(payload.supplierName).replace(/\W+/g, '-').toUpperCase()}`,
    supplierName: payload.supplierName,
    supplierItemCode: payload.supplierItemCode,
    supplierSku: payload.supplierItemCode,
    lastCost: moneyNumber(payload.lastCost) ?? moneyNumber(payload.costPrice) ?? 0,
    leadTimeDays: moneyNumber(payload.leadTimeDays) ?? 0,
    minimumOrderQty: moneyNumber(payload.minimumOrderQty) ?? 1,
    isPreferred: payload.preferredSupplier ?? true,
    status: 'Active'
  };
  safeWriteList(SUPPLIER_LINK_KEY, [link, ...readManualSupplierLinks()]);
  addActivity({ eventType: 'SUPPLIER_LINK_CREATED', productId, message: `Supplier link created for ${payload.supplierName}.`, staffId: payload.createdByStaffId, staffName: payload.createdByStaffName });
  return link;
}

export async function createPriceRecordFromProduct(productId: string, payload: Partial<ManualProductDraft>): Promise<ProductPriceRecord> {
  const cost = moneyNumber(payload.costPrice) ?? 0;
  const selling = moneyNumber(payload.sellingPrice) ?? 0;
  const defaultVatRate = getCachedVendorTaxSettings(payload.vendorId || getActiveVendorId()).defaultVatRate;
  const price: ProductPriceRecord = {
    priceId: makeId('PPR'),
    productId,
    priceListName: 'Default Retail',
    sellingPrice: selling,
    costPrice: cost,
    marginPercent: calculateMargin(selling, cost),
    markupPercent: cost > 0 ? Math.round(((selling - cost) / cost) * 100) : 0,
    taxMode: payload.taxMode || 'VAT Registered',
    vatRate: moneyNumber(payload.vatRate) ?? defaultVatRate,
    currency: 'USD',
    effectiveFrom: payload.priceEffectiveDate || now().slice(0, 10),
    status: 'Active'
  };
  safeWriteList(PRICE_RECORD_KEY, [price, ...readManualPriceRecords()]);
  addActivity({ eventType: 'PRICE_RECORD_CREATED', productId, message: 'Default price record created.', staffId: payload.createdByStaffId, staffName: payload.createdByStaffName });
  return price;
}

export async function createReorderRuleFromProduct(productId: string, payload: Partial<ManualProductDraft>): Promise<ProductReorderRule | undefined> {
  const reorderLevel = moneyNumber(payload.reorderLevel);
  const reorderQty = moneyNumber(payload.reorderQty);
  if (reorderLevel === undefined && reorderQty === undefined) return undefined;
  const rule: ProductReorderRule = {
    ruleId: makeId('PRR'),
    productId,
    branchId: payload.branchId || 'BR-HARARE',
    warehouseId: payload.warehouseId || 'WH-HARARE-01',
    locationType: payload.locationType || 'Main Warehouse',
    minQty: reorderLevel || 0,
    maxQty: Math.max(reorderLevel || 0, reorderQty || 0),
    reorderQty: reorderQty || 0,
    preferredSupplierName: payload.supplierName,
    leadTimeDays: moneyNumber(payload.leadTimeDays) ?? 0,
    isActive: true,
    status: 'Active',
    notes: 'Created from Manual Product form.'
  };
  safeWriteList(REORDER_RULE_KEY, [rule, ...readManualReorderRules()]);
  addActivity({ eventType: 'REORDER_RULE_CREATED', productId, message: 'Reorder rule created.', staffId: payload.createdByStaffId, staffName: payload.createdByStaffName });
  return rule;
}

export async function createOpeningBalanceDraft(payload: {
  vendorId: string;
  branchId: string;
  warehouseId: string;
  productId: string;
  sku: string;
  productName: string;
  shelfLocation?: string;
  qty: number;
  unitCost: number;
  createdByStaffId: string;
  createdByStaffName: string;
  notes?: string;
}): Promise<OpeningBalanceDraft> {
  const draft: OpeningBalanceDraft = {
    openingBalanceId: makeId('OBD'),
    openingBalanceNumber: `OB-${new Date().getFullYear()}-${String(openingRows().length + 1).padStart(4, '0')}`,
    vendorId: payload.vendorId,
    branchId: payload.branchId,
    warehouseId: payload.warehouseId,
    productId: payload.productId,
    sku: payload.sku,
    productName: payload.productName,
    shelfLocation: payload.shelfLocation,
    qty: Math.max(0, payload.qty),
    unitCost: Math.max(0, payload.unitCost),
    valueEstimate: Math.max(0, payload.qty) * Math.max(0, payload.unitCost),
    status: 'Draft',
    createdByStaffId: payload.createdByStaffId,
    createdByStaffName: payload.createdByStaffName,
    notes: payload.notes || 'Opening balance draft only. Stock is not posted until approval and posting.',
    createdAt: now(),
    updatedAt: now()
  };
  saveOpeningRows([draft, ...openingRows()]);
  addActivity({ eventType: 'OPENING_BALANCE_DRAFT_CREATED', productId: payload.productId, openingBalanceId: draft.openingBalanceId, message: `${draft.openingBalanceNumber} created. Stock was not posted.`, staffId: payload.createdByStaffId, staffName: payload.createdByStaffName });
  if (draft.valueEstimate >= 1000) {
    await createOperationalApproval({
      vendorId: draft.vendorId,
      branchId: draft.branchId,
      branch: draft.branchId,
      category: 'Stock Adjustment',
      requestedBy: draft.createdByStaffId,
      requestedByRole: 'Stock Controller',
      relatedRecord: draft.openingBalanceNumber,
      amountOrValue: `USD ${draft.valueEstimate.toFixed(2)}`,
      risk: 'High',
      reason: 'Opening Balance Draft approval required',
      context: `${draft.productName}; qty ${draft.qty}; unit cost ${draft.unitCost}; stock not posted.`,
      requiredPermission: 'stockAdjustments.approve'
    });
  }
  if ((await getNetworkStatus()) !== 'Online') {
    await enqueueOfflineAction({
      vendorId: draft.vendorId,
      branchId: draft.branchId,
      terminalId: 'BACK-01',
      staffId: draft.createdByStaffId,
      staffName: draft.createdByStaffName,
      entityType: 'Stock Adjustment',
      entityId: draft.openingBalanceId,
      entityNumber: draft.openingBalanceNumber,
      operationType: 'OPENING_BALANCE_DRAFT_CREATED',
      payload: { sku: draft.sku, qty: draft.qty, openingBalanceDraftOnly: true },
      status: 'Queued',
      notes: 'Opening balance draft queued offline. No stock posted.'
    });
  }
  return draft;
}

export async function getOpeningBalanceDrafts(filters: { status?: 'ALL' | OpeningBalanceDraftStatus; productId?: string; search?: string } = {}): Promise<OpeningBalanceDraft[]> {
  return openingRows().filter((draft) => {
    if (filters.status && filters.status !== 'ALL' && draft.status !== filters.status) return false;
    if (filters.productId && draft.productId !== filters.productId) return false;
    if (filters.search) {
      const text = `${draft.openingBalanceNumber} ${draft.productName} ${draft.sku}`.toLowerCase();
      if (!text.includes(filters.search.toLowerCase())) return false;
    }
    return true;
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function updateOpeningBalance(openingBalanceId: string, patch: Partial<OpeningBalanceDraft>): OpeningBalanceDraft | undefined {
  let updated: OpeningBalanceDraft | undefined;
  saveOpeningRows(openingRows().map((draft) => {
    if (draft.openingBalanceId !== openingBalanceId) return draft;
    updated = { ...draft, ...patch, updatedAt: now() };
    return updated;
  }));
  return updated;
}

export async function approveOpeningBalanceDraft(openingBalanceId: string, staffId: string, notes: string): Promise<OpeningBalanceDraft | undefined> {
  const updated = updateOpeningBalance(openingBalanceId, { status: 'Approved', approvedByStaffId: staffId, notes: notes || 'Opening balance approved locally.' });
  if (updated) addActivity({ eventType: 'OPENING_BALANCE_APPROVED', productId: updated.productId, openingBalanceId, message: `${updated.openingBalanceNumber} approved.`, staffId });
  return updated;
}

export async function postOpeningBalanceDraft(openingBalanceId: string, staffId: string): Promise<OpeningBalanceDraft | undefined> {
  const draft = openingRows().find((row) => row.openingBalanceId === openingBalanceId);
  if (!draft || draft.status !== 'Approved') return draft;
  await postInventoryMovement({
    vendorId: draft.vendorId,
    branchId: draft.branchId,
    warehouseId: draft.warehouseId,
    productId: draft.productId,
    sku: draft.sku,
    productName: draft.productName,
    shelfLocation: draft.shelfLocation,
    movementType: 'OPENING_BALANCE',
    referenceType: 'OPENING_BALANCE',
    referenceNumber: draft.openingBalanceNumber,
    qtyIn: draft.qty,
    qtyOut: 0,
    balanceBefore: 0,
    unitCost: draft.unitCost,
    sellingPrice: 0,
    staffId,
    staffName: staffId,
    movementDate: now(),
    notes: 'Opening balance posted from approved draft.',
    riskFlag: draft.valueEstimate >= 1000 ? 'Medium' : 'None',
    approvalRequired: false,
    status: 'Posted'
  });
  const updated = updateOpeningBalance(openingBalanceId, { status: 'Posted', postedByStaffId: staffId });
  if (updated) addActivity({ eventType: 'OPENING_BALANCE_POSTED', productId: updated.productId, openingBalanceId, message: `${updated.openingBalanceNumber} posted as OPENING_BALANCE movement.`, staffId });
  return updated;
}

export async function cancelOpeningBalanceDraft(openingBalanceId: string, staffId: string, reason: string): Promise<OpeningBalanceDraft | undefined> {
  const updated = updateOpeningBalance(openingBalanceId, { status: 'Cancelled', notes: reason || 'Opening balance draft cancelled.' });
  if (updated) addActivity({ eventType: 'OPENING_BALANCE_CANCELLED', productId: updated.productId, openingBalanceId, message: reason || `${updated.openingBalanceNumber} cancelled.`, staffId });
  return updated;
}

export async function getProductCreationActivityEvents(filters: { productId?: string; openingBalanceId?: string; search?: string } = {}): Promise<ProductCreationActivityEvent[]> {
  return activityRows().filter((event) => {
    if (filters.productId && event.productId !== filters.productId) return false;
    if (filters.openingBalanceId && event.openingBalanceId !== filters.openingBalanceId) return false;
    if (filters.search && !event.message.toLowerCase().includes(filters.search.toLowerCase())) return false;
    return true;
  });
}
