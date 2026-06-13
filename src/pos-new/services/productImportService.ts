import {
  IndustrialSectorCode,
  IndustrialSectorMappingTemplate,
  OpeningBalanceDraftFromImport,
  ProductImportActivityEvent,
  ProductImportBatch,
  ProductImportBatchStatus,
  ProductImportColumnMapping,
  ProductImportDuplicateAction,
  ProductImportFilterState,
  ProductImportPreviewSummary,
  ProductImportRow,
  ProductImportRowStatus,
  ProductImportSource,
  ProductImportValidationIssue,
  ProductMasterRecord
} from '../types';
import {
  mockIndustrialSectorMappingTemplates,
  mockProductImportActivityEvents,
  mockProductImportBatches,
  mockProductImportColumnMappings,
  mockProductImportRows,
  mockOpeningBalanceDraftsFromImport,
  mockProductMasterRecords
} from '../mock/mockPosData';
import { createOperationalApproval } from './approvalService';
import { createProductMasterDraft, getProductMasterRecords } from './productMasterService';
import { enqueueOfflineAction, getNetworkStatus } from './offlineSyncService';

const BATCH_KEY = 'itred_pos_product_import_batches_v1';
const ROW_KEY = 'itred_pos_product_import_rows_v1';
const MAPPING_KEY = 'itred_pos_product_import_mappings_v1';
const ACTIVITY_KEY = 'itred_pos_product_import_activity_v1';
const OPENING_BALANCE_DRAFT_KEY = 'itred_pos_product_import_opening_balance_drafts_v1';

let ramBatches = [...mockProductImportBatches];
let ramRows = [...mockProductImportRows];
let ramMappings = [...mockProductImportColumnMappings];
let ramActivity = [...mockProductImportActivityEvents];
let ramOpeningBalanceDrafts: OpeningBalanceDraftFromImport[] = [...mockOpeningBalanceDraftsFromImport];

function storageAvailable(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    const key = '__pim_storage_test__';
    localStorage.setItem(key, '1');
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function readList<T>(key: string, fallback: T[], ram: T[]): T[] {
  if (!storageAvailable()) return ram;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(fallback));
      return [...fallback];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [...fallback];
  } catch {
    return [...fallback];
  }
}

function writeList<T>(key: string, value: T[], setRam: (next: T[]) => void): T[] {
  setRam(value);
  if (storageAvailable()) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Keep RAM copy if localStorage is full or unavailable.
    }
  }
  return value;
}

function batches(): ProductImportBatch[] {
  return readList(BATCH_KEY, mockProductImportBatches, ramBatches);
}

function saveBatches(next: ProductImportBatch[]): ProductImportBatch[] {
  return writeList(BATCH_KEY, next, (value) => { ramBatches = value; });
}

function rows(): ProductImportRow[] {
  return readList(ROW_KEY, mockProductImportRows, ramRows);
}

function saveRows(next: ProductImportRow[]): ProductImportRow[] {
  return writeList(ROW_KEY, next, (value) => { ramRows = value; });
}

function mappings(): ProductImportColumnMapping[] {
  return readList(MAPPING_KEY, mockProductImportColumnMappings, ramMappings);
}

function saveMappings(next: ProductImportColumnMapping[]): ProductImportColumnMapping[] {
  return writeList(MAPPING_KEY, next, (value) => { ramMappings = value; });
}

function activity(): ProductImportActivityEvent[] {
  return readList(ACTIVITY_KEY, mockProductImportActivityEvents, ramActivity);
}

function saveActivity(next: ProductImportActivityEvent[]): ProductImportActivityEvent[] {
  return writeList(ACTIVITY_KEY, next, (value) => { ramActivity = value; });
}

function openingDrafts(): OpeningBalanceDraftFromImport[] {
  return readList(OPENING_BALANCE_DRAFT_KEY, mockOpeningBalanceDraftsFromImport, ramOpeningBalanceDrafts);
}

function saveOpeningDrafts(next: OpeningBalanceDraftFromImport[]): OpeningBalanceDraftFromImport[] {
  return writeList(OPENING_BALANCE_DRAFT_KEY, next, (value) => { ramOpeningBalanceDrafts = value; });
}

function now(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function addActivity(event: Omit<ProductImportActivityEvent, 'eventId' | 'createdAt'>): ProductImportActivityEvent {
  const nextEvent: ProductImportActivityEvent = { ...event, eventId: makeId('PIM-ACT'), createdAt: now() };
  saveActivity([nextEvent, ...activity()].slice(0, 120));
  return nextEvent;
}

function updateBatchCounts(batchId: string, status?: ProductImportBatchStatus): ProductImportBatch | undefined {
  const batchRows = rows().filter((row) => row.batchId === batchId);
  let updated: ProductImportBatch | undefined;
  saveBatches(batches().map((batch) => {
    if (batch.batchId !== batchId) return batch;
    updated = {
      ...batch,
      status: status || batch.status,
      totalRows: batchRows.length,
      validRows: batchRows.filter((row) => row.status === 'Valid').length,
      warningRows: batchRows.filter((row) => row.status === 'Warning').length,
      errorRows: batchRows.filter((row) => row.status === 'Error').length,
      duplicateRows: batchRows.filter((row) => row.status === 'Duplicate').length,
      importedRows: batchRows.filter((row) => row.status === 'Imported').length,
      skippedRows: batchRows.filter((row) => row.status === 'Skipped').length,
      updatedAt: now()
    };
    return updated;
  }));
  return updated;
}

function normalizeHeader(header: string): string {
  return header.trim().replace(/\s+/g, '').replace(/[_-]/g, '').toLowerCase();
}

const headerTargets: Record<string, string> = {
  productname: 'productName',
  name: 'productName',
  sku: 'sku',
  barcode: 'barcode',
  alu: 'alu',
  vendorsku: 'vendorSku',
  numericnumber: 'productNumericNumber',
  productnumericnumber: 'productNumericNumber',
  description: 'description',
  brand: 'brand',
  manufacturer: 'manufacturer',
  supplier: 'supplierName',
  suppliername: 'supplierName',
  supplieritemcode: 'supplierItemCode',
  category: 'productCategory',
  subcategory: 'productSubCategory',
  unit: 'unitOfMeasure',
  unitofmeasure: 'unitOfMeasure',
  cost: 'costPrice',
  costprice: 'costPrice',
  price: 'sellingPrice',
  sellingprice: 'sellingPrice',
  qty: 'qty',
  quantity: 'qty',
  shelf: 'shelfLocation',
  shelflocation: 'shelfLocation',
  make: 'make',
  model: 'model',
  yearfrom: 'yearFrom',
  yearto: 'yearTo',
  side: 'side',
  partnumber: 'partNumber',
  oemnumber: 'oemNumber',
  size: 'size',
  material: 'material',
  grade: 'grade',
  producttype: 'productType',
  wattage: 'wattage',
  watts: 'wattage',
  voltage: 'voltage',
  batterycapacity: 'batteryCapacity',
  paneltype: 'panelType',
  invertertype: 'inverterType'
};

function parseNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function splitCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values.map((value) => value.replace(/^"|"$/g, ''));
}

function mapRawData(rawData: Record<string, string>, mappingRows: ProductImportColumnMapping[]): Record<string, string | number | undefined> {
  const mapped: Record<string, string | number | undefined> = {};
  mappingRows.forEach((mapping) => {
    if (!mapping.targetField || mapping.targetField === 'Ignore') return;
    const rawValue = rawData[mapping.sourceColumn];
    mapped[mapping.targetField] = ['sellingPrice', 'costPrice', 'qty', 'vatRate', 'reorderLevel', 'reorderQty'].includes(mapping.targetField)
      ? parseNumber(rawValue)
      : rawValue;
  });
  return mapped;
}

export async function getProductImportBatches(filters: ProductImportFilterState = {}): Promise<ProductImportBatch[]> {
  return batches().filter((batch) => {
    if (filters.batchNumber && !batch.batchNumber.toLowerCase().includes(filters.batchNumber.toLowerCase())) return false;
    if (filters.industrialSectorCode && filters.industrialSectorCode !== 'ALL' && batch.industrialSectorCode !== filters.industrialSectorCode) return false;
    if (filters.status && filters.status !== 'ALL' && batch.status !== filters.status) return false;
    if (filters.source && filters.source !== 'ALL' && batch.source !== filters.source) return false;
    if (filters.uploadedBy && filters.uploadedBy !== 'ALL' && batch.uploadedByStaffName !== filters.uploadedBy && batch.uploadedByStaffId !== filters.uploadedBy) return false;
    if (filters.dateFrom && batch.createdAt.slice(0, 10) < filters.dateFrom) return false;
    if (filters.dateTo && batch.createdAt.slice(0, 10) > filters.dateTo) return false;
    if (filters.search) {
      const haystack = `${batch.fileName || ''} ${batch.notes} ${batch.batchNumber}`.toLowerCase();
      if (!haystack.includes(filters.search.toLowerCase())) return false;
    }
    return true;
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getProductImportBatchById(batchId: string): Promise<ProductImportBatch | undefined> {
  return batches().find((batch) => batch.batchId === batchId);
}

export async function getProductImportRows(batchId: string): Promise<ProductImportRow[]> {
  return rows().filter((row) => row.batchId === batchId).sort((a, b) => a.rowNumber - b.rowNumber);
}

export async function getProductImportColumnMappings(batchId: string): Promise<ProductImportColumnMapping[]> {
  return mappings().filter((mapping) => mapping.batchId === batchId);
}

export async function getIndustrialSectorTemplates(): Promise<IndustrialSectorMappingTemplate[]> {
  return mockIndustrialSectorMappingTemplates;
}

export async function getIndustrialSectorTemplate(sectorCode: IndustrialSectorCode): Promise<IndustrialSectorMappingTemplate | undefined> {
  return mockIndustrialSectorMappingTemplates.find((template) => template.industrialSectorCode === sectorCode) || mockIndustrialSectorMappingTemplates.find((template) => template.industrialSectorCode === 'GENERAL_RETAIL');
}

export async function createProductImportBatch(payload: {
  vendorId: string;
  branchId: string;
  warehouseId: string;
  industrialSectorCode: IndustrialSectorCode;
  source: ProductImportSource;
  fileName?: string;
  uploadedByStaffId: string;
  uploadedByStaffName: string;
  notes?: string;
}): Promise<ProductImportBatch> {
  const next: ProductImportBatch = {
    batchId: makeId('PIM-BATCH'),
    batchNumber: `PIM-${new Date().getFullYear()}-${String(batches().length + 1).padStart(4, '0')}`,
    vendorId: payload.vendorId,
    branchId: payload.branchId,
    warehouseId: payload.warehouseId,
    industrialSectorCode: payload.industrialSectorCode,
    source: payload.source,
    status: 'Draft',
    fileName: payload.fileName,
    uploadedByStaffId: payload.uploadedByStaffId,
    uploadedByStaffName: payload.uploadedByStaffName,
    totalRows: 0,
    validRows: 0,
    warningRows: 0,
    errorRows: 0,
    duplicateRows: 0,
    importedRows: 0,
    skippedRows: 0,
    createdAt: now(),
    updatedAt: now(),
    notes: payload.notes || 'Product import batch created locally.'
  };
  saveBatches([next, ...batches()]);
  addActivity({ batchId: next.batchId, eventType: 'PRODUCT_IMPORT_BATCH_CREATED', message: `Product import batch ${next.batchNumber} created.`, staffId: payload.uploadedByStaffId, staffName: payload.uploadedByStaffName });
  if ((await getNetworkStatus()) !== 'Online') {
    await enqueueOfflineAction({
      vendorId: payload.vendorId,
      branchId: payload.branchId,
      terminalId: 'BACK-01',
      staffId: payload.uploadedByStaffId,
      staffName: payload.uploadedByStaffName,
      entityType: 'Inventory Movement',
      entityId: next.batchId,
      entityNumber: next.batchNumber,
      operationType: 'PRODUCT_IMPORT_BATCH_CREATED',
      payload: { batchNumber: next.batchNumber, source: next.source, sector: next.industrialSectorCode },
      status: 'Queued',
      notes: 'Product import batch created offline. No backend call made.'
    });
  }
  return next;
}

export async function parseCSVTextPlaceholder(batchId: string, csvText: string): Promise<ProductImportRow[]> {
  const batch = await getProductImportBatchById(batchId);
  if (!batch) return [];
  const lines = csvText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]);
  const existingRows = rows().filter((row) => row.batchId !== batchId);
  const parsedRows: ProductImportRow[] = lines.slice(1).map((line, index) => {
    const values = splitCsvLine(line);
    const rawData = headers.reduce<Record<string, string>>((acc, header, headerIndex) => {
      acc[header] = values[headerIndex] || '';
      return acc;
    }, {});
    return { rowId: makeId('PIM-ROW'), batchId, rowNumber: index + 1, rawData, mappedProduct: {}, validationIssues: [], duplicateAction: 'Hold For Review', status: 'Pending' };
  });
  saveRows([...existingRows, ...parsedRows]);
  await autoSuggestColumnMappings(batchId, batch.industrialSectorCode);
  addActivity({ batchId, eventType: 'PRODUCT_IMPORT_FILE_PARSED_PLACEHOLDER', message: `CSV/paste placeholder parsed ${parsedRows.length} row(s).`, staffId: batch.uploadedByStaffId, staffName: batch.uploadedByStaffName });
  updateBatchCounts(batchId, 'Mapping');
  return parsedRows;
}

export async function parseExcelUploadPlaceholder(batchId: string, fileMeta: { fileName: string; size?: number }): Promise<ProductImportBatch | undefined> {
  const updated = saveBatches(batches().map((batch) => batch.batchId === batchId ? { ...batch, fileName: fileMeta.fileName, source: 'Excel Upload Placeholder', status: 'Mapping', notes: 'Excel parser will be connected later. CSV paste/import is available for build-development.', updatedAt: now() } : batch)).find((batch) => batch.batchId === batchId);
  if (updated) addActivity({ batchId, eventType: 'PRODUCT_IMPORT_FILE_PARSED_PLACEHOLDER', message: 'Excel parser will be connected later. CSV paste/import is available for build-development.', staffId: updated.uploadedByStaffId, staffName: updated.uploadedByStaffName });
  return updated;
}

export async function mapImportColumns(batchId: string, nextMappings: ProductImportColumnMapping[]): Promise<ProductImportColumnMapping[]> {
  saveMappings([...mappings().filter((mapping) => mapping.batchId !== batchId), ...nextMappings]);
  addActivity({ batchId, eventType: 'PRODUCT_IMPORT_COLUMNS_MAPPED', message: 'Import columns mapped locally.' });
  updateBatchCounts(batchId, 'Mapping');
  return getProductImportColumnMappings(batchId);
}

export async function autoSuggestColumnMappings(batchId: string, sectorCode: IndustrialSectorCode): Promise<ProductImportColumnMapping[]> {
  const firstRow = rows().find((row) => row.batchId === batchId);
  if (!firstRow) return [];
  const template = await getIndustrialSectorTemplate(sectorCode);
  const requiredSet = new Set(['productName', 'sku', 'barcode', 'alu', 'sellingPrice']);
  const sectorSet = new Set(template?.sectorSpecificFields || []);
  const suggested = Object.keys(firstRow.rawData).map((sourceColumn) => {
    const targetField = headerTargets[normalizeHeader(sourceColumn)] || sourceColumn;
    return {
      mappingId: makeId('PIM-MAP'),
      batchId,
      sourceColumn,
      targetField,
      required: requiredSet.has(targetField),
      sectorSpecific: sectorSet.has(targetField),
      sampleValue: firstRow.rawData[sourceColumn],
      status: targetField ? 'Mapped' as const : 'Unmapped' as const
    };
  });
  await mapImportColumns(batchId, suggested);
  return suggested;
}

export async function validateImportRow(row: ProductImportRow, sectorTemplate?: IndustrialSectorMappingTemplate): Promise<ProductImportRow> {
  const mapped = row.mappedProduct;
  const issues: ProductImportValidationIssue[] = [];
  const addIssue = (field: string, issueType: string, message: string, severity: ProductImportValidationIssue['severity'], suggestedFix: string) => {
    issues.push({ issueId: makeId('PIM-ISS'), batchId: row.batchId, rowId: row.rowId, rowNumber: row.rowNumber, field, issueType, message, severity, suggestedFix });
  };
  if (!mapped.productName) addIssue('productName', 'Required Field', 'Product name is required.', 'Error', 'Enter product name or skip the row.');
  if (!mapped.sku && !mapped.barcode && !mapped.alu && !mapped.vendorSku) addIssue('identifier', 'Required Field', 'At least one identifier is required: SKU, barcode, ALU, or vendor SKU.', 'Error', 'Map or enter a product identifier.');
  if (!mapped.industrialSectorCode && !sectorTemplate) addIssue('industrialSectorCode', 'Required Field', 'Industrial sector is required.', 'Error', 'Select an industrial sector for the import batch.');
  const sellingPrice = parseNumber(mapped.sellingPrice);
  const costPrice = parseNumber(mapped.costPrice);
  const qty = parseNumber(mapped.qty);
  if (sellingPrice === undefined || sellingPrice < 0) addIssue('sellingPrice', 'Invalid Number', 'Selling price is required and must be zero or above.', 'Error', 'Enter a valid selling price.');
  if (costPrice !== undefined && costPrice < 0) addIssue('costPrice', 'Invalid Number', 'Cost price must be zero or above.', 'Error', 'Enter a valid cost price.');
  if (qty !== undefined && qty < 0) addIssue('qty', 'Invalid Quantity', 'Quantity cannot be negative.', 'Error', 'Enter zero or a positive quantity.');
  if (qty !== undefined && qty > 0 && (!mapped.branchId || !mapped.warehouseId)) addIssue('branch/warehouse', 'Opening Balance Warning', 'Quantity exists but no branch or warehouse is selected.', 'Warning', 'Select branch and warehouse before creating opening balance drafts.');
  if (costPrice === undefined) addIssue('costPrice', 'Missing Recommended Field', 'Cost price is recommended.', 'Warning', 'Apply a default cost price or review margin later.');
  if (!mapped.shelfLocation) addIssue('shelfLocation', 'Missing Recommended Field', 'Shelf location is recommended.', 'Warning', 'Apply default shelf or map shelf column.');
  if (!mapped.supplierName) addIssue('supplierName', 'Missing Recommended Field', 'Supplier name is recommended.', 'Warning', 'Apply default supplier or map supplier column.');
  if (sellingPrice !== undefined && costPrice !== undefined && sellingPrice < costPrice) addIssue('sellingPrice', 'Margin Warning', 'Selling price is below cost price.', 'Warning', 'Review margin before approving import.');
  if (!mapped.productCategory && !mapped.category) addIssue('category', 'Missing Recommended Field', 'Category is recommended.', 'Warning', 'Apply default category or map category column.');
  if (String(mapped.productName || '').length > 90) addIssue('productName', 'Length Warning', 'Product name is very long.', 'Warning', 'Shorten product name for receipt/search readability.');
  if (sectorTemplate?.industrialSectorCode === 'MOTOR_SPARES' && (!mapped.make || !mapped.model || !mapped.side)) addIssue('make/model/side', 'Sector Warning', 'Motor spares should include make, model, and side where applicable.', 'Warning', 'Map fitment fields or confirm universal item.');
  if (sectorTemplate?.industrialSectorCode === 'HARDWARE' && (!mapped.productCategory && !mapped.category || !mapped.unitOfMeasure)) addIssue('category/unitOfMeasure', 'Sector Warning', 'Hardware should include category and unit of measure.', 'Warning', 'Apply defaults for category and unit.');
  if (sectorTemplate?.industrialSectorCode === 'GROCERY' && !mapped.unitOfMeasure) addIssue('unitOfMeasure', 'Sector Warning', 'Grocery products should include unit of measure.', 'Warning', 'Map unit or apply default unit.');
  if (sectorTemplate?.industrialSectorCode === 'PHARMACY' && (!mapped.batchNumber && !mapped.expiryDate)) addIssue('expiry/batch', 'Sector Warning', 'Pharmacy import should include expiry and batch placeholders.', 'Warning', 'Add expiry and batch columns before future pharmacy posting.');
  if (sectorTemplate?.industrialSectorCode === 'SOLAR_PRODUCTS' && !mapped.wattage && !mapped.batteryCapacity && !mapped.capacity) addIssue('wattage/capacity', 'Sector Warning', 'Solar products should include wattage or capacity placeholder.', 'Warning', 'Map wattage, battery capacity, panel type, or inverter type field.');
  const duplicate = await detectDuplicateProduct({ ...row, validationIssues: issues });
  const status: ProductImportRowStatus = issues.some((issue) => issue.severity === 'Error') ? 'Error' : duplicate ? 'Duplicate' : issues.some((issue) => issue.severity === 'Warning') ? 'Warning' : 'Valid';
  return { ...row, validationIssues: issues, duplicateProductId: duplicate?.productId, duplicateAction: duplicate ? 'Hold For Review' : row.duplicateAction === 'Hold For Review' ? 'Create New Product' : row.duplicateAction, status };
}

export async function detectDuplicateProduct(row: ProductImportRow): Promise<ProductMasterRecord | undefined> {
  const mapped = row.mappedProduct;
  const products = [...await getProductMasterRecords(), ...mockProductMasterRecords];
  return products.find((product) => {
    const skuMatch = mapped.sku && String(mapped.sku).toLowerCase() === product.sku?.toLowerCase();
    const barcodeMatch = mapped.barcode && String(mapped.barcode).toLowerCase() === product.barcode?.toLowerCase();
    const aluMatch = mapped.alu && String(mapped.alu).toLowerCase() === product.alu?.toLowerCase();
    const vendorSkuMatch = mapped.vendorSku && String(mapped.vendorSku).toLowerCase() === product.vendorSku?.toLowerCase();
    const nameMatch = mapped.productName && String(mapped.productName).toLowerCase() === product.productName.toLowerCase();
    const brandMatch = !mapped.brand || String(mapped.brand).toLowerCase() === String(product.brand || '').toLowerCase();
    const makeMatch = !mapped.make || String(mapped.make).toLowerCase() === String(product.make || '').toLowerCase();
    const modelMatch = !mapped.model || String(mapped.model).toLowerCase() === String(product.model || '').toLowerCase();
    return Boolean(skuMatch || barcodeMatch || aluMatch || vendorSkuMatch || (nameMatch && brandMatch && makeMatch && modelMatch));
  });
}

export async function validateImportBatch(batchId: string): Promise<ProductImportRow[]> {
  const batch = await getProductImportBatchById(batchId);
  if (!batch) return [];
  const template = await getIndustrialSectorTemplate(batch.industrialSectorCode);
  const batchMappings = await getProductImportColumnMappings(batchId);
  const validated: ProductImportRow[] = [];
  for (const row of await getProductImportRows(batchId)) {
    validated.push(await validateImportRow({
      ...row,
      mappedProduct: {
        ...mapRawData(row.rawData, batchMappings),
        industrialSectorCode: batch.industrialSectorCode,
        branchId: batch.branchId,
        warehouseId: batch.warehouseId
      }
    }, template));
  }
  saveRows([...rows().filter((row) => row.batchId !== batchId), ...validated]);
  const hasErrors = validated.some((row) => row.status === 'Error');
  const hasDuplicates = validated.some((row) => row.status === 'Duplicate');
  updateBatchCounts(batchId, hasErrors ? 'Validation Failed' : 'Ready For Approval');
  addActivity({ batchId, eventType: hasErrors ? 'PRODUCT_IMPORT_VALIDATION_FAILED' : 'PRODUCT_IMPORT_VALIDATED', message: hasErrors ? 'Import validation failed. Errors block import.' : 'Import batch validated locally.' });
  if (hasDuplicates) addActivity({ batchId, eventType: 'PRODUCT_IMPORT_DUPLICATES_FOUND', message: 'Duplicate import rows detected and held for review.' });
  return validated;
}

export async function prepareImportPreview(batchId: string): Promise<ProductImportPreviewSummary> {
  const batchRows = await getProductImportRows(batchId);
  return {
    batchId,
    totalRows: batchRows.length,
    validRows: batchRows.filter((row) => row.status === 'Valid').length,
    warningRows: batchRows.filter((row) => row.status === 'Warning').length,
    errorRows: batchRows.filter((row) => row.status === 'Error').length,
    duplicateRows: batchRows.filter((row) => row.status === 'Duplicate').length,
    productsToCreate: batchRows.filter((row) => ['Valid', 'Warning'].includes(row.status) || row.duplicateAction === 'Create New Product').length,
    openingBalanceDraftsToCreate: batchRows.filter((row) => Number(row.mappedProduct.qty || 0) > 0 && row.status !== 'Error' && row.status !== 'Skipped').length
  };
}

export async function submitImportForApproval(batchId: string, staffId: string): Promise<ProductImportBatch | undefined> {
  const batch = updateBatchCounts(batchId, 'Pending Approval');
  if (!batch) return undefined;
  const preview = await prepareImportPreview(batchId);
  await createOperationalApproval({
    vendorId: batch.vendorId,
    branchId: batch.branchId,
    branch: batch.branchId,
    category: 'Inventory Import Approval',
    requestedBy: staffId,
    requestedByRole: 'Stock Controller',
    relatedRecord: batch.batchNumber,
    amountOrValue: `${preview.productsToCreate} products / ${preview.openingBalanceDraftsToCreate} opening balance drafts`,
    risk: preview.errorRows > 0 || preview.duplicateRows > 0 ? 'High' : 'Medium',
    reason: 'Product Import Approval Required',
    context: `Batch ${batch.batchNumber}; sector ${batch.industrialSectorCode}; total rows ${preview.totalRows}; errors ${preview.errorRows}; warnings ${preview.warningRows}; duplicates ${preview.duplicateRows}; products ${preview.productsToCreate}; opening balance drafts ${preview.openingBalanceDraftsToCreate}.`,
    requiredPermission: 'approvals.approve'
  });
  addActivity({ batchId, eventType: 'PRODUCT_IMPORT_SUBMITTED_FOR_APPROVAL', message: 'Product import batch submitted for approval.', staffId });
  return batch;
}

export async function approveImportBatch(batchId: string, staffId: string, notes: string): Promise<ProductImportBatch | undefined> {
  const updated = updateBatchCounts(batchId, 'Approved');
  if (updated) addActivity({ batchId, eventType: 'PRODUCT_IMPORT_APPROVED', message: notes || 'Product import batch approved.', staffId });
  return updated;
}

export async function rejectImportBatch(batchId: string, staffId: string, notes: string): Promise<ProductImportBatch | undefined> {
  const updated = updateBatchCounts(batchId, 'Rejected');
  if (updated) addActivity({ batchId, eventType: 'PRODUCT_IMPORT_REJECTED', message: notes || 'Product import batch rejected.', staffId });
  return updated;
}

export async function createProductDraftFromImportRow(row: ProductImportRow): Promise<ProductMasterRecord> {
  const mapped = row.mappedProduct;
  const productName = String(mapped.productName || 'Imported Product Draft');
  return createProductMasterDraft({
    vendorId: 'SCI-LOG-ZW',
    productCode: String(mapped.sku || mapped.barcode || mapped.alu || `IMP-${Date.now()}`),
    sku: String(mapped.sku || mapped.barcode || mapped.alu || `IMP-${Date.now()}`),
    barcode: mapped.barcode ? String(mapped.barcode) : undefined,
    alu: mapped.alu ? String(mapped.alu) : undefined,
    vendorSku: mapped.vendorSku ? String(mapped.vendorSku) : undefined,
    productNumericNumber: mapped.productNumericNumber ? String(mapped.productNumericNumber) : undefined,
    productName,
    description: mapped.description ? String(mapped.description) : `${productName} imported draft.`,
    brand: mapped.brand ? String(mapped.brand) : undefined,
    manufacturer: mapped.manufacturer ? String(mapped.manufacturer) : undefined,
    supplierName: mapped.supplierName ? String(mapped.supplierName) : undefined,
    supplierItemCode: mapped.supplierItemCode ? String(mapped.supplierItemCode) : undefined,
    industrialSector: String(mapped.industrialSectorCode || mapped.industrialSector || 'Imported'),
    productCategory: String(mapped.productCategory || mapped.category || 'Imported'),
    productSubCategory: mapped.productSubCategory ? String(mapped.productSubCategory) : undefined,
    productType: 'Stock Item',
    status: 'Draft',
    productStatus: 'Draft',
    riskStatus: 'Normal',
    category: String(mapped.productCategory || mapped.category || 'Imported'),
    unitOfMeasure: String(mapped.unitOfMeasure || 'pcs'),
    condition: mapped.condition ? String(mapped.condition) : 'New',
    colour: mapped.colour ? String(mapped.colour) : undefined,
    make: mapped.make ? String(mapped.make) : undefined,
    model: mapped.model ? String(mapped.model) : undefined,
    yearFrom: mapped.yearFrom ? String(mapped.yearFrom) : undefined,
    yearTo: mapped.yearTo ? String(mapped.yearTo) : undefined,
    side: mapped.side ? String(mapped.side) : undefined,
    partNumber: mapped.partNumber ? String(mapped.partNumber) : undefined,
    oemNumber: mapped.oemNumber ? String(mapped.oemNumber) : undefined,
    tags: mapped.tags ? String(mapped.tags).split('|') : ['Imported Draft'],
    taxCode: 'VAT15',
    taxMode: mapped.taxMode ? String(mapped.taxMode) : 'VAT Registered',
    vatRate: parseNumber(mapped.vatRate) || 15,
    defaultSellingPrice: parseNumber(mapped.sellingPrice) || 0,
    defaultCostPrice: parseNumber(mapped.costPrice) || 0,
    reorderLevel: parseNumber(mapped.reorderLevel) || 0,
    reorderQty: parseNumber(mapped.reorderQty) || 0,
    marginPercent: 0,
    preferredSupplierName: mapped.supplierName ? String(mapped.supplierName) : undefined,
    sectorAttributes: {
      sector: String(mapped.industrialSectorCode || mapped.industrialSector || 'Imported'),
      productCategory: String(mapped.productCategory || mapped.category || 'Imported'),
      productSubCategory: mapped.productSubCategory ? String(mapped.productSubCategory) : undefined,
      brand: mapped.brand ? String(mapped.brand) : undefined,
      manufacturer: mapped.manufacturer ? String(mapped.manufacturer) : undefined,
      make: mapped.make ? String(mapped.make) : undefined,
      model: mapped.model ? String(mapped.model) : undefined,
      yearFrom: mapped.yearFrom ? String(mapped.yearFrom) : undefined,
      yearTo: mapped.yearTo ? String(mapped.yearTo) : undefined,
      side: mapped.side ? String(mapped.side) : undefined,
      partNumber: mapped.partNumber ? String(mapped.partNumber) : undefined,
      oemNumber: mapped.oemNumber ? String(mapped.oemNumber) : undefined,
      notes: 'Created from Product Import Desk draft.'
    },
    createdByStaffId: 'PRODUCT_IMPORT'
  });
}

export async function createOpeningBalanceDraftFromImportRow(row: ProductImportRow): Promise<OpeningBalanceDraftFromImport | undefined> {
  const qty = parseNumber(row.mappedProduct.qty);
  if (!qty || qty <= 0) return undefined;
  const draft: OpeningBalanceDraftFromImport = {
    draftId: makeId('OB-DRAFT'),
    batchId: row.batchId,
    rowId: row.rowId,
    rowNumber: row.rowNumber,
    sku: row.mappedProduct.sku ? String(row.mappedProduct.sku) : undefined,
    productName: String(row.mappedProduct.productName || 'Imported Product Draft'),
    branchId: String(row.mappedProduct.branchId || 'BR-HARARE'),
    warehouseId: String(row.mappedProduct.warehouseId || 'WH-HARARE-01'),
    shelfLocation: row.mappedProduct.shelfLocation ? String(row.mappedProduct.shelfLocation) : undefined,
    importedQty: qty,
    unitCost: parseNumber(row.mappedProduct.costPrice) || 0,
    valueEstimate: qty * (parseNumber(row.mappedProduct.costPrice) || 0),
    status: 'Draft - Not Posted',
    createdAt: now(),
    notes: 'Created from product import. Opening balance draft only; stock not posted.'
  };
  saveOpeningDrafts([draft, ...openingDrafts()]);
  addActivity({ batchId: row.batchId, rowId: row.rowId, eventType: 'OPENING_BALANCE_DRAFT_CREATED_FROM_IMPORT', message: `Opening balance draft created for row ${row.rowNumber}. Stock was not posted.` });
  return draft;
}

export async function importApprovedBatch(batchId: string, staffId: string): Promise<ProductImportBatch | undefined> {
  const batch = await getProductImportBatchById(batchId);
  if (!batch || batch.status !== 'Approved' || batch.errorRows > 0) return batch;
  const batchRows = await getProductImportRows(batchId);
  if (batchRows.some((row) => row.status === 'Duplicate' && row.duplicateAction === 'Hold For Review')) return batch;
  const importableRows = batchRows.filter((row) => row.status !== 'Error' && row.status !== 'Skipped' && row.duplicateAction !== 'Hold For Review');
  let imported = 0;
  for (const row of importableRows) {
    await createProductDraftFromImportRow(row);
    await createOpeningBalanceDraftFromImportRow(row);
    imported += 1;
  }
  saveRows(rows().map((row) => row.batchId === batchId && importableRows.some((item) => item.rowId === row.rowId) ? { ...row, status: 'Imported' } : row));
  const updated = updateBatchCounts(batchId, imported === batch.totalRows ? 'Imported' : 'Partially Imported');
  addActivity({ batchId, eventType: 'PRODUCT_IMPORT_BATCH_IMPORTED', message: `${imported} product draft(s) created. Imported quantities created opening balance drafts only.`, staffId });
  if ((await getNetworkStatus()) !== 'Online') {
    await enqueueOfflineAction({
      vendorId: batch.vendorId,
      branchId: batch.branchId,
      terminalId: 'BACK-01',
      staffId,
      staffName: staffId,
      entityType: 'Inventory Movement',
      entityId: batch.batchId,
      entityNumber: batch.batchNumber,
      operationType: 'PRODUCT_IMPORT_BATCH_IMPORTED',
      payload: { batchNumber: batch.batchNumber, importedRows: imported, openingBalanceDraftsOnly: true },
      status: 'Queued',
      notes: 'Approved import completed locally and queued for sync. No stock posted.'
    });
  }
  return updated;
}

export async function skipImportRow(batchId: string, rowId: string, reason: string): Promise<ProductImportRow | undefined> {
  let updated: ProductImportRow | undefined;
  saveRows(rows().map((row) => {
    if (row.batchId !== batchId || row.rowId !== rowId) return row;
    updated = { ...row, status: 'Skipped', notes: reason };
    return updated;
  }));
  updateBatchCounts(batchId);
  addActivity({ batchId, rowId, eventType: 'PRODUCT_IMPORT_ROW_SKIPPED', message: reason || 'Import row skipped.' });
  return updated;
}

export async function exportImportErrorsPlaceholder(batchId: string): Promise<string> {
  const issueRows = (await getProductImportRows(batchId)).flatMap((row) => row.validationIssues);
  return JSON.stringify({ batchId, createdAt: now(), issues: issueRows }, null, 2);
}

export async function getProductImportActivityEvents(filters: ProductImportFilterState = {}): Promise<ProductImportActivityEvent[]> {
  return activity().filter((event) => !filters.search || event.message.toLowerCase().includes(filters.search.toLowerCase()));
}

export async function getOpeningBalanceDrafts(batchId?: string): Promise<OpeningBalanceDraftFromImport[]> {
  return openingDrafts().filter((draft) => !batchId || draft.batchId === batchId);
}
