import type {
  InventoryImportBatch,
  InventoryImportBatchStatus,
  InventoryImportColumn,
  InventoryImportFileType,
  InventoryImportMappingTemplate,
  InventoryImportRowPreview,
  InventoryImportValidationIssue,
  ProductImportBatch,
  ProductImportColumnMapping,
  ProductImportRow,
  ProductImportValidationIssue
} from '../types/posTypes';
import { getInventoryImportFieldDefinitions } from './inventoryImportFieldDefinitions';
import {
  approveImportBatch,
  autoSuggestColumnMappings,
  createProductImportBatch,
  getProductImportBatchById,
  getProductImportBatches,
  getProductImportColumnMappings,
  getProductImportRows,
  importApprovedBatch,
  mapImportColumns,
  parseCSVTextPlaceholder,
  prepareImportPreview,
  rejectImportBatch,
  submitImportForApproval,
  validateImportBatch
} from './productImportService';
import { getActiveVendorId } from '../utils/vendorDataMode';

const TEMPLATE_KEY = 'itred_pos_inventory_import_mapping_templates_v1';
const now = () => new Date().toISOString();

function readList<T>(key: string, fallback: T[]): T[] {
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(fallback));
      return fallback;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as T[] : fallback;
  } catch {
    localStorage.setItem(key, JSON.stringify(fallback));
    return fallback;
  }
}

function saveList<T>(key: string, rows: T[]): T[] {
  if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(rows));
  return rows;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) {
      out.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else current += char;
  }
  out.push(current.trim().replace(/^"|"$/g, ''));
  return out;
}

function columnLetter(index: number): string {
  let n = index + 1;
  let letters = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function detectImportFileType(fileName: string): InventoryImportFileType {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.csv')) return 'CSV';
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return 'Excel';
  if (!fileName) return 'ManualPaste';
  return 'Unknown';
}

export function parseCsvText(text: string): string[][] {
  return text.split(/\r?\n/).filter((line) => line.trim()).map(splitCsvLine);
}

export const parseManualPaste = parseCsvText;

export function createImportPreviewFromRows(rows: string[][], startRow: number): Array<Record<string, string>> {
  if (!rows.length) return [];
  const headerIndex = Math.max(0, startRow - 1);
  const headers = rows[headerIndex] || [];
  return rows.slice(headerIndex + 1).map((row) => headers.reduce<Record<string, string>>((acc, header, index) => {
    acc[header || `Column ${index + 1}`] = row[index] || '';
    return acc;
  }, {}));
}

export function detectColumns(rows: string[][]): InventoryImportColumn[] {
  const headers = rows[0] || [];
  return detectLikelyFieldMappings(headers.map((header, index) => ({
    columnIndex: index,
    columnLetter: columnLetter(index),
    sourceColumnName: header || `Column ${index + 1}`,
    sampleValues: rows.slice(1, 5).map((row) => row[index] || '').filter(Boolean),
    confidenceScore: 0,
    ignored: false,
    notes: ''
  })));
}

export function detectLikelyFieldMappings(columns: InventoryImportColumn[]): InventoryImportColumn[] {
  const definitions = getInventoryImportFieldDefinitions();
  return columns.map((column) => {
    const source = normalize(column.sourceColumnName);
    let best = { fieldKey: '', score: 0 };
    definitions.forEach((definition) => {
      const aliases = [definition.fieldKey, definition.fieldLabel, ...definition.acceptedAliases].map(normalize);
      const match = aliases.find((alias) => alias === source || alias.includes(source) || source.includes(alias));
      if (match) best = { fieldKey: definition.fieldKey, score: match === source ? 98 : 82 };
    });
    return { ...column, detectedFieldKey: best.fieldKey || undefined, mappedFieldKey: best.fieldKey || undefined, confidenceScore: best.score, notes: best.fieldKey ? 'Auto matched locally.' : 'Needs manual mapping.' };
  });
}

function defaultTemplates(): InventoryImportMappingTemplate[] {
  const base = (templateName: string, sector: string, mappings: Array<{ sourceColumnName: string; targetFieldKey: string }>, defaultTemplate = false): InventoryImportMappingTemplate => ({
    templateId: `INV-TPL-${normalize(templateName)}`,
    templateName,
    sector,
    description: `${templateName} mapping template.`,
    mappings,
    startRow: 1,
    createdBy: 'System',
    createdAt: now(),
    updatedAt: now(),
    defaultTemplate
  });
  const common = [
    { sourceColumnName: 'Item Name', targetFieldKey: 'productName' },
    { sourceColumnName: 'Item Number', targetFieldKey: 'sku' },
    { sourceColumnName: 'Regular Price', targetFieldKey: 'sellingPrice' },
    { sourceColumnName: 'On Hand', targetFieldKey: 'openingQuantity' },
    { sourceColumnName: 'Average Unit Cost', targetFieldKey: 'unitCost' },
    { sourceColumnName: 'Department', targetFieldKey: 'category' }
  ];
  return [
    base('Default Inventory Template', 'General', common, true),
    base('Automotive Parts Template', 'Automotive Parts', [...common, { sourceColumnName: 'Make', targetFieldKey: 'vehicleMake' }, { sourceColumnName: 'Model', targetFieldKey: 'vehicleModel' }, { sourceColumnName: 'Part No', targetFieldKey: 'partNumber' }]),
    base('Grocery Template', 'Grocery', common),
    base('Hardware Template', 'Hardware', common),
    base('Pharmacy Template', 'Pharmacy', common),
    base('General Dealer Template', 'General Dealer', common),
    base('QuickBooks POS Style Template', 'QuickBooks POS', common)
  ];
}

export function createDefaultTemplates(): InventoryImportMappingTemplate[] {
  return saveList(TEMPLATE_KEY, defaultTemplates());
}

export async function getImportMappingTemplates(): Promise<InventoryImportMappingTemplate[]> {
  return readList(TEMPLATE_KEY, defaultTemplates());
}

export async function createImportMappingTemplate(payload: Partial<InventoryImportMappingTemplate>): Promise<InventoryImportMappingTemplate[]> {
  const rows = await getImportMappingTemplates();
  const next: InventoryImportMappingTemplate = {
    templateId: `INV-TPL-${Date.now()}`,
    templateName: payload.templateName || 'New Import Template',
    sector: payload.sector || 'General',
    description: payload.description || 'Created locally from mapping wizard.',
    mappings: payload.mappings || [],
    startRow: payload.startRow || 1,
    createdBy: payload.createdBy || 'Admin User',
    createdAt: now(),
    updatedAt: now(),
    defaultTemplate: payload.defaultTemplate || false
  };
  return saveList(TEMPLATE_KEY, [next, ...rows]);
}

export async function updateImportMappingTemplate(templateId: string, patch: Partial<InventoryImportMappingTemplate>): Promise<InventoryImportMappingTemplate[]> {
  return saveList(TEMPLATE_KEY, (await getImportMappingTemplates()).map((row) => row.templateId === templateId ? { ...row, ...patch, updatedAt: now() } : row));
}

export async function deleteImportMappingTemplate(templateId: string): Promise<InventoryImportMappingTemplate[]> {
  return saveList(TEMPLATE_KEY, (await getImportMappingTemplates()).filter((row) => row.templateId !== templateId));
}

export async function applyMappingTemplate(templateId: string, columns: InventoryImportColumn[]): Promise<InventoryImportColumn[]> {
  const template = (await getImportMappingTemplates()).find((row) => row.templateId === templateId);
  if (!template) return columns;
  return columns.map((column) => {
    const mapping = template.mappings.find((item) => normalize(item.sourceColumnName) === normalize(column.sourceColumnName));
    return mapping ? { ...column, mappedFieldKey: mapping.targetFieldKey, confidenceScore: 100, ignored: false, notes: `Template ${template.templateName}` } : column;
  });
}

export function validateImportMapping(columns: InventoryImportColumn[]): InventoryImportValidationIssue[] {
  const required = getInventoryImportFieldDefinitions().filter((field) => field.required).map((field) => field.fieldKey);
  const mapped = columns.filter((column) => !column.ignored).map((column) => column.mappedFieldKey).filter(Boolean) as string[];
  const issues: InventoryImportValidationIssue[] = [];
  required.forEach((fieldKey) => {
    if (!mapped.includes(fieldKey) && !(fieldKey === 'productCode' && mapped.includes('sku'))) {
      issues.push({ issueId: `INV-ISS-${fieldKey}`, batchId: 'WIZARD', fieldKey, severity: 'Error', code: 'REQUIRED_FIELD_UNMAPPED', message: `${fieldKey} must be mapped.`, recommendedAction: 'Map a source column to this required field.', createdAt: now() });
    }
  });
  mapped.forEach((fieldKey) => {
    if (mapped.filter((item) => item === fieldKey).length > 1) {
      issues.push({ issueId: `INV-ISS-DUP-${fieldKey}`, batchId: 'WIZARD', fieldKey, severity: 'Warning', code: 'DUPLICATE_TARGET_MAPPING', message: `${fieldKey} is mapped more than once.`, recommendedAction: 'Keep one source column or ignore duplicate columns.', createdAt: now() });
    }
  });
  return issues;
}

function rowStatusFromIssues(errors: string[], warnings: string[], duplicateScore: number): InventoryImportRowPreview['status'] {
  if (errors.length) return 'Error';
  if (duplicateScore >= 90) return 'Duplicate';
  if (warnings.length) return 'Warning';
  return 'Ready';
}

export function validateRequiredFields(mappedData: Record<string, string | number | undefined>): string[] {
  const errors: string[] = [];
  if (!mappedData.productName) errors.push('Missing product name.');
  if (!mappedData.sku && !mappedData.productCode) errors.push('Missing SKU/product code.');
  if (mappedData.sellingPrice === undefined || mappedData.sellingPrice === '') errors.push('Missing selling price.');
  if (mappedData.openingQuantity === undefined && mappedData.qty === undefined) errors.push('Missing opening quantity.');
  return errors;
}

export function validatePricesAndCost(mappedData: Record<string, string | number | undefined>): string[] {
  const warnings: string[] = [];
  const price = Number(mappedData.sellingPrice || 0);
  const cost = Number(mappedData.unitCost || mappedData.costPrice || 0);
  if (price <= 0) warnings.push('Zero or invalid selling price.');
  if (!cost) warnings.push('Missing unit cost.');
  if (cost && price < cost) warnings.push('Selling price below cost.');
  return warnings;
}

export function validateQuantities(mappedData: Record<string, string | number | undefined>): string[] {
  const warnings: string[] = [];
  const qty = Number(mappedData.openingQuantity ?? mappedData.qty ?? 0);
  if (qty < 0) warnings.push('Negative quantity.');
  if (qty > 1000) warnings.push('Very high quantity.');
  return warnings;
}

export function detectDuplicateProducts(rows: InventoryImportRowPreview[]): InventoryImportRowPreview[] {
  const seen = new Map<string, number>();
  return rows.map((row) => {
    const sku = String(row.mappedData.sku || row.mappedData.productCode || '').toLowerCase();
    const count = seen.get(sku) || 0;
    seen.set(sku, count + 1);
    return sku && count > 0 ? { ...row, status: 'Duplicate', duplicateScore: 95, warnings: [...row.warnings, 'Duplicate SKU in file.'] } : row;
  });
}

export const detectExistingProductMatches = detectDuplicateProducts;

export async function validateImportRows(batchId: string): Promise<InventoryImportRowPreview[]> {
  await validateImportBatch(batchId);
  return (await getProductImportRows(batchId)).map(toPreviewRow);
}

export async function createInventoryImportBatch(payload: { fileName: string; staffName: string; csvText?: string; startRow?: number }): Promise<ProductImportBatch> {
  const batch = await createProductImportBatch({ vendorId: getActiveVendorId(), branchId: 'main-branch', warehouseId: 'main-warehouse', industrialSectorCode: 'GENERAL_RETAIL', source: payload.csvText ? 'CSV Upload' : 'Manual Batch', fileName: payload.fileName, uploadedByStaffId: payload.staffName, uploadedByStaffName: payload.staffName, notes: 'Created from Inventory Import Mapping Wizard.' });
  if (payload.csvText) await parseCSVTextPlaceholder(batch.batchId, payload.csvText);
  return batch;
}

export async function updateInventoryImportBatch(batchId: string, _patch: Partial<InventoryImportBatch>): Promise<ProductImportBatch | undefined> {
  return getProductImportBatchById(batchId);
}

export const getInventoryImportBatches = getProductImportBatches;
export const getInventoryImportBatch = getProductImportBatchById;

export async function cancelInventoryImportBatch(batchId: string, reason: string, staffId: string) {
  return rejectImportBatch(batchId, staffId, reason);
}

export const submitInventoryImportForApproval = submitImportForApproval;
export const approveInventoryImportBatch = approveImportBatch;
export const rejectInventoryImportBatch = rejectImportBatch;
export const postInventoryImportBatchLocal = importApprovedBatch;

export async function calculateImportSummary(batchId: string) {
  return prepareImportPreview(batchId);
}

function severity(issue: ProductImportValidationIssue): InventoryImportValidationIssue['severity'] {
  return issue.severity === 'Error' ? 'Error' : issue.severity === 'Warning' ? 'Warning' : 'Info';
}

export async function createImportValidationIssues(batchId: string): Promise<InventoryImportValidationIssue[]> {
  const rows = await getProductImportRows(batchId);
  return rows.flatMap((row) => row.validationIssues.map((issue) => ({
    issueId: issue.issueId,
    batchId,
    rowId: row.rowId,
    rowNumber: row.rowNumber,
    fieldKey: issue.field,
    severity: severity(issue),
    code: normalize(issue.issueType).toUpperCase(),
    message: issue.message,
    recommendedAction: issue.suggestedFix,
    createdAt: now()
  })));
}

function toPreviewRow(row: ProductImportRow): InventoryImportRowPreview {
  const cost = Number(row.mappedProduct.unitCost || row.mappedProduct.costPrice || 0);
  const qty = Number(row.mappedProduct.openingQuantity || row.mappedProduct.qty || 0);
  const errors = row.validationIssues.filter((issue) => issue.severity === 'Error').map((issue) => issue.message);
  const warnings = row.validationIssues.filter((issue) => issue.severity !== 'Error').map((issue) => issue.message);
  return {
    rowId: row.rowId,
    batchId: row.batchId,
    rowNumber: row.rowNumber,
    sourceData: row.rawData,
    mappedData: row.mappedProduct,
    status: row.status === 'Imported' ? 'Posted' : row.status === 'Valid' ? 'Ready' : row.status,
    action: row.status === 'Duplicate' ? 'NeedsReview' : row.status === 'Skipped' ? 'SkipRow' : 'CreateNewProduct',
    matchedProductId: row.duplicateProductId,
    matchedProductName: row.duplicateProductId,
    warnings,
    errors,
    duplicateScore: row.duplicateProductId ? 95 : 0,
    estimatedStockValue: cost * qty,
    notes: row.notes || ''
  };
}

export async function previewProductCreatesAndUpdates(batchId: string): Promise<InventoryImportRowPreview[]> {
  return (await getProductImportRows(batchId)).map(toPreviewRow);
}

export const createProductRecordsFromBatchLocal = importApprovedBatch;
export const createOpeningStockFromBatchLocal = importApprovedBatch;
export const createSupplierPlaceholdersFromBatchLocal = async (_batchId: string) => [];
export const createCategoryPlaceholdersFromBatchLocal = async (_batchId: string) => [];

export function mapWizardColumnsToProductMappings(batchId: string, columns: InventoryImportColumn[]): ProductImportColumnMapping[] {
  return columns.filter((column) => !column.ignored && column.mappedFieldKey).map((column) => ({
    mappingId: `PIM-MAP-${Date.now()}-${column.columnIndex}`,
    batchId,
    sourceColumn: column.sourceColumnName,
    targetField: column.mappedFieldKey === 'openingQuantity' ? 'qty' : column.mappedFieldKey === 'unitCost' ? 'costPrice' : column.mappedFieldKey || '',
    required: ['productName', 'sku', 'productCode', 'sellingPrice', 'openingQuantity'].includes(column.mappedFieldKey || ''),
    sectorSpecific: ['vehicleMake', 'vehicleModel', 'partNumber', 'side', 'engineCode', 'chassisCode'].includes(column.mappedFieldKey || ''),
    sampleValue: column.sampleValues[0] || '',
    status: 'Mapped'
  }));
}

export async function saveWizardMappingsToBatch(batchId: string, columns: InventoryImportColumn[]): Promise<ProductImportColumnMapping[]> {
  await mapImportColumns(batchId, mapWizardColumnsToProductMappings(batchId, columns));
  return getProductImportColumnMappings(batchId);
}

export function toInventoryBatch(batch: ProductImportBatch): InventoryImportBatch {
  const statusMap: Record<string, InventoryImportBatchStatus> = {
    Draft: 'Draft',
    Mapping: 'Mapped',
    Validating: 'Mapped',
    'Validation Failed': 'Failed',
    'Ready For Approval': 'Validated',
    'Pending Approval': 'PendingApproval',
    Approved: 'Approved',
    Imported: 'Posted',
    'Partially Imported': 'Posted',
    Rejected: 'Rejected',
    Cancelled: 'Cancelled'
  };
  return {
    batchId: batch.batchId,
    batchNumber: batch.batchNumber,
    fileName: batch.fileName || 'manual-paste.csv',
    fileType: detectImportFileType(batch.fileName || ''),
    startRow: 1,
    status: statusMap[batch.status] || 'Draft',
    totalRows: batch.totalRows,
    validRows: batch.validRows,
    warningRows: batch.warningRows,
    errorRows: batch.errorRows,
    duplicateRows: batch.duplicateRows,
    skippedRows: batch.skippedRows,
    postedRows: batch.importedRows,
    createdBy: batch.uploadedByStaffName,
    createdAt: batch.createdAt,
    notes: batch.notes
  };
}
