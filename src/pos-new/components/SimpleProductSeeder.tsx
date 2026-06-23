import { ChangeEvent, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle, FileSpreadsheet, Upload } from 'lucide-react';
import type { Product } from '../types';
import { loadLocalProducts, POS_PRODUCT_STORE_KEY, upsertLocalProducts } from '../utils/localProductStore';

type ImportMode = 'create' | 'update';
type ProductField = 'productName' | 'sku' | 'sellingPrice' | 'qty' | 'costPrice' | 'category' | 'shelfLocation';

interface SimpleProductSeederProps {
  sourceContext?: 'Stock' | 'Purchasing';
}

interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

interface PreviewRow {
  rowNumber: number;
  productName: string;
  sku: string;
  sellingPrice?: number;
  qty?: number;
  costPrice?: number;
  category: string;
  shelfLocation: string;
  errors: string[];
  warnings: string[];
  duplicate: boolean;
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: number;
}

const SAMPLE_CSV = `Product Name,SKU,Selling Price,Qty,Cost Price,Shelf Location,Category
M12 Heavy Hex Bolt,HEX-B12,USD 2.45,150,USD 1.20,A1,Fasteners
Safety Helmet,SAF-H04,19.90,25,10.00,PPE-2,Safety
Brass Hose Adapter,BRS-A38,4.20,80,2.00,B3,Fittings`;

const FIELD_ALIASES: Record<ProductField, string[]> = {
  productName: ['productname', 'name', 'description'],
  sku: ['sku', 'code', 'barcode', 'productcode'],
  sellingPrice: ['sellingprice', 'price', 'unitprice'],
  qty: ['qty', 'quantity', 'stock', 'openingstock', 'qtyonhand'],
  costPrice: ['costprice', 'cost', 'unitcost'],
  category: ['category'],
  shelfLocation: ['shelflocation', 'shelf', 'bin', 'rack']
};

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_\-/\\]+/g, '').replace(/[^a-z0-9]/g, '');
}

function splitCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

function parseCsv(text: string): ParsedCsv {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = splitCsvLine(lines[0]).map((header) => header.trim());
  const rows = lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return headers.reduce<Record<string, string>>((record, header, index) => {
      record[header] = values[index]?.trim() || '';
      return record;
    }, {});
  });

  return { headers, rows };
}

function resolveMapping(headers: string[]): Partial<Record<ProductField, string>> {
  const normalizedHeaders = headers.map((header) => ({ header, normalized: normalizeHeader(header) }));

  return (Object.keys(FIELD_ALIASES) as ProductField[]).reduce<Partial<Record<ProductField, string>>>((mapping, field) => {
    const match = normalizedHeaders.find((candidate) => FIELD_ALIASES[field].includes(candidate.normalized));
    if (match) mapping[field] = match.header;
    return mapping;
  }, {});
}

function readMappedValue(row: Record<string, string>, mapping: Partial<Record<ProductField, string>>, field: ProductField): string {
  const mappedHeader = mapping[field];
  return mappedHeader ? row[mappedHeader]?.trim() || '' : '';
}

function parseNumber(value: string): number | undefined {
  const raw = value.trim();
  if (!raw) return undefined;

  const cleaned = raw.replace(/[^\d,.-]/g, '').replace(/,(?=\d{1,2}$)/, '.').replace(/,/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') return undefined;

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function stableSku(productName: string, rowNumber: number): string {
  const base = productName.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 18);
  return `${base || 'ITEM'}-${String(rowNumber).padStart(3, '0')}`;
}

function duplicateSkuSet(products: Product[]): Set<string> {
  return new Set(products.map((product) => product.sku || product.code).filter(Boolean).map((sku) => sku.toLowerCase()));
}

function buildProduct(row: PreviewRow, existingProduct?: Product): Product {
  const now = new Date().toISOString();
  const qty = row.qty ?? 0;
  const price = row.sellingPrice ?? 0;
  const cost = row.costPrice ?? 0;

  return {
    ...(existingProduct || {}),
    id: existingProduct?.id || `SEED-${row.sku}-${Date.now()}-${row.rowNumber}`,
    code: row.sku,
    sku: row.sku,
    name: row.productName,
    productName: row.productName,
    category: row.category || existingProduct?.category || 'Imported',
    productCategory: row.category || existingProduct?.productCategory || 'Imported',
    price,
    sellingPrice: price,
    cost,
    costPrice: cost,
    stock: qty,
    qtyOnHand: qty,
    availableStock: qty,
    minStock: existingProduct?.minStock ?? 0,
    reorderLevel: existingProduct?.reorderLevel ?? 0,
    unit: existingProduct?.unit || 'pcs',
    unitOfMeasure: existingProduct?.unitOfMeasure || 'pcs',
    branchId: existingProduct?.branchId || 'BR-HARARE',
    branch: existingProduct?.branch || 'Harare Main',
    warehouseId: existingProduct?.warehouseId || 'WH-HARARE-01',
    warehouse: existingProduct?.warehouse || 'Harare Spares Depot',
    shelfLocation: row.shelfLocation || existingProduct?.shelfLocation,
    stockStatus: qty <= 0 ? 'Out of Stock' : 'In Stock',
    healthStatus: qty <= 0 ? 'Out of Stock' : 'In Stock',
    isActive: true,
    createdByStaffId: existingProduct?.createdByStaffId || 'SIMPLE_PRODUCT_SEEDER',
    createdAt: existingProduct?.createdAt || now,
    updatedAt: now
  };
}

export default function SimpleProductSeeder({ sourceContext = 'Stock' }: SimpleProductSeederProps) {
  const [csvText, setCsvText] = useState(SAMPLE_CSV);
  const [autoGenerateSku, setAutoGenerateSku] = useState(true);
  const [importMode, setImportMode] = useState<ImportMode>('create');
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);

  const parsed = useMemo(() => parseCsv(csvText), [csvText]);
  const mapping = useMemo(() => resolveMapping(parsed.headers), [parsed.headers]);
  const existingProducts = useMemo(() => loadLocalProducts(), [result]);

  const previewRows = useMemo<PreviewRow[]>(() => {
    const existingSkus = duplicateSkuSet(existingProducts);

    return parsed.rows.map((row, index) => {
      const rowNumber = index + 2;
      const productName = readMappedValue(row, mapping, 'productName');
      const mappedSku = readMappedValue(row, mapping, 'sku');
      const sku = mappedSku || (autoGenerateSku && productName ? stableSku(productName, rowNumber) : '');
      const sellingPrice = parseNumber(readMappedValue(row, mapping, 'sellingPrice'));
      const qty = parseNumber(readMappedValue(row, mapping, 'qty'));
      const costPrice = parseNumber(readMappedValue(row, mapping, 'costPrice'));
      const category = readMappedValue(row, mapping, 'category') || 'Imported';
      const shelfLocation = readMappedValue(row, mapping, 'shelfLocation');
      const errors: string[] = [];
      const warnings: string[] = [];

      if (!productName) errors.push('Product name required');
      if (!sku) errors.push('SKU required');
      if (sellingPrice === undefined || sellingPrice <= 0) errors.push('Selling price must be greater than zero');
      if (qty === undefined || qty < 0) errors.push('Qty must be zero or greater');
      if (costPrice === undefined) warnings.push('Cost price missing');

      const duplicate = Boolean(sku && existingSkus.has(sku.toLowerCase()));
      if (duplicate) warnings.push(importMode === 'update' ? 'Duplicate SKU will update existing product' : 'Duplicate SKU will be skipped');

      return { rowNumber, productName, sku, sellingPrice, qty, costPrice, category, shelfLocation, errors, warnings, duplicate };
    });
  }, [autoGenerateSku, existingProducts, importMode, mapping, parsed.rows]);

  const summary = useMemo(() => ({
    valid: previewRows.filter((row) => row.errors.length === 0).length,
    warnings: previewRows.filter((row) => row.warnings.length > 0).length,
    errors: previewRows.filter((row) => row.errors.length > 0).length,
    duplicates: previewRows.filter((row) => row.duplicate).length
  }), [previewRows]);

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setCsvText(await file.text());
    setResult(null);
  };

  const handleImport = () => {
    const currentProducts = loadLocalProducts();
    const productsBySku = new Map(currentProducts.map((product) => [(product.sku || product.code).toLowerCase(), product]));
    let skipped = 0;
    const validRows = previewRows.filter((row) => row.errors.length === 0);
    const productsToImport = validRows.flatMap((row) => {
      const existingProduct = productsBySku.get(row.sku.toLowerCase());
      if (existingProduct && importMode !== 'update') {
        skipped += 1;
        return [];
      }
      return [buildProduct(row, existingProduct)];
    });

    if (productsToImport.length > 0) {
      upsertLocalProducts(productsToImport);
    }

    setResult({ imported: productsToImport.length, skipped, errors: summary.errors });
  };

  return (
    <section className="space-y-4">
      <div className="border border-[#b1b5c2] bg-[#1e222b] p-4 text-white">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-400">{sourceContext} Product Import</div>
             <h2 className="mt-1 text-xl font-black uppercase inventory-mapping-title">Inventory Mapping</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-300">
              Imports valid rows into the POS product store used by Sales Terminal search, Inventory and stock control.
            </p>
          </div>
          <div className="border border-slate-600 px-3 py-2 text-xs uppercase text-slate-300">
            Store: <span className="font-black text-orange-300">{POS_PRODUCT_STORE_KEY}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="border border-[#b1b5c2] bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 border border-[#222831] bg-[#222831] px-3 py-2 text-xs font-black uppercase text-white">
              <Upload size={15} />
              Upload CSV
              <input type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
            </label>
            <span className="text-xs font-bold text-slate-600">{fileName || 'Paste CSV below or use the bundled sample.'}</span>
          </div>
          <textarea
            value={csvText}
            onChange={(event) => {
              setCsvText(event.target.value);
              setResult(null);
            }}
            className="h-72 w-full border border-slate-400 bg-slate-50 p-3 font-mono text-sm text-slate-900 outline-none focus:border-orange-500"
            spellCheck={false}
          />
        </div>

        <aside className="border border-[#b1b5c2] bg-white p-4">
          <div className="mb-4 text-xs font-black uppercase tracking-[0.16em] text-slate-500">Import Controls</div>
          <div className="space-y-3">
            <label className="flex items-center justify-between border border-slate-300 px-3 py-2 text-sm font-bold">
              Auto-generate missing SKU
              <input type="checkbox" checked={autoGenerateSku} onChange={(event) => setAutoGenerateSku(event.target.checked)} />
            </label>
            <label className="block text-xs font-black uppercase text-slate-600">
              Duplicate SKU Mode
              <select
                value={importMode}
                onChange={(event) => setImportMode(event.target.value as ImportMode)}
                className="mt-1 w-full border border-slate-400 bg-white px-3 py-2 text-sm font-bold text-slate-900"
              >
                <option value="create">Skip duplicates</option>
                <option value="update">Update existing products</option>
              </select>
            </label>
            <button
              type="button"
              disabled={summary.valid === 0}
              onClick={handleImport}
              className="flex w-full items-center justify-center gap-2 border border-orange-600 bg-orange-500 px-4 py-3 text-sm font-black uppercase text-[#fff] disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300 inventory-import-cta"
            >
              <FileSpreadsheet size={16} />
              Import Valid Products
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs font-black uppercase">
            <div className="border border-slate-300 p-3"><div className="text-xl text-emerald-700">{summary.valid}</div>Valid</div>
            <div className="border border-slate-300 p-3"><div className="text-xl text-orange-600">{summary.warnings}</div>Warnings</div>
            <div className="border border-slate-300 p-3"><div className="text-xl text-red-700">{summary.errors}</div>Errors</div>
            <div className="border border-slate-300 p-3"><div className="text-xl text-slate-700">{summary.duplicates}</div>Duplicates</div>
          </div>

          {result && (
            <div className="mt-4 border border-emerald-700 bg-emerald-50 p-3 text-sm font-bold text-emerald-900">
              <CheckCircle className="mr-2 inline" size={16} />
              Imported {result.imported}. Skipped {result.skipped}. Errors {result.errors}.
            </div>
          )}
        </aside>
      </div>

      <div className="border border-[#b1b5c2] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-300 bg-slate-100 px-4 py-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Validation Preview</div>
            <div className="text-sm font-bold text-slate-700">Detected headers: {parsed.headers.join(', ') || 'None'}</div>
          </div>
          {summary.errors > 0 && <div className="text-xs font-black uppercase text-red-700"><AlertCircle className="mr-1 inline" size={15} />Fix errors before import</div>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-[#222831] text-xs uppercase text-white">
              <tr>
                <th className="px-3 py-2">Row</th>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2">Price</th>
                <th className="px-3 py-2">Qty</th>
                <th className="px-3 py-2">Cost</th>
                <th className="px-3 py-2">Shelf</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row) => (
                <tr key={`${row.rowNumber}-${row.sku || row.productName}`} className="border-b border-slate-200">
                  <td className="px-3 py-2 font-bold">{row.rowNumber}</td>
                  <td className="px-3 py-2">{row.productName || '-'}</td>
                  <td className="px-3 py-2 font-mono">{row.sku || '-'}</td>
                  <td className="px-3 py-2">{row.sellingPrice === undefined ? '-' : row.sellingPrice.toFixed(2)}</td>
                  <td className="px-3 py-2">{row.qty === undefined ? '-' : row.qty}</td>
                  <td className="px-3 py-2">{row.costPrice === undefined ? '-' : row.costPrice.toFixed(2)}</td>
                  <td className="px-3 py-2">{row.shelfLocation || '-'}</td>
                  <td className="px-3 py-2">{row.category}</td>
                  <td className="px-3 py-2">
                    {row.errors.length === 0 ? (
                      <span className="font-black text-emerald-700">Valid</span>
                    ) : (
                      <span className="font-black text-red-700">{row.errors.join('; ')}</span>
                    )}
                    {row.warnings.length > 0 && <div className="mt-1 text-xs font-bold text-orange-700">{row.warnings.join('; ')}</div>}
                  </td>
                </tr>
              ))}
              {previewRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-sm font-bold text-slate-500">No CSV rows detected.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
