import { useMemo, useState, type ReactNode } from 'react';
import { Maximize2, Minimize2, RotateCcw, Upload, X } from 'lucide-react';
import {
  IndustrialSectorCode,
  IndustrialSectorMappingTemplate,
  OpeningBalanceDraftFromImport,
  ProductImportActivityEvent,
  ProductImportBatch,
  ProductImportColumnMapping,
  ProductImportPreviewSummary,
  ProductImportRow,
  ProductImportSource
} from '../types';

interface ProductImportFormProps {
  batch: ProductImportBatch | null;
  rows: ProductImportRow[];
  mappings: ProductImportColumnMapping[];
  templates: IndustrialSectorMappingTemplate[];
  activity: ProductImportActivityEvent[];
  openingBalanceDrafts: OpeningBalanceDraftFromImport[];
  preview: ProductImportPreviewSummary | null;
  staffId: string;
  staffName: string;
  onClose: () => void;
  onCreateBatch: (payload: {
    industrialSectorCode: IndustrialSectorCode;
    source: ProductImportSource;
    fileName?: string;
    notes?: string;
  }) => Promise<void>;
  onParseCsv: (batchId: string, csvText: string) => Promise<void>;
  onUploadPlaceholder: (batchId: string, fileName: string) => Promise<void>;
  onAutoMap: (batchId: string, sectorCode: IndustrialSectorCode) => Promise<void>;
  onValidate: (batchId: string) => Promise<void>;
  onSubmitApproval: (batchId: string) => Promise<void>;
  onApprove: (batchId: string) => Promise<void>;
  onImport: (batchId: string) => Promise<void>;
  onSkipRow: (batchId: string, rowId: string) => Promise<void>;
  onExportErrors: (batchId: string) => Promise<void>;
}

type ImportTab = 'Import Setup' | 'Column Mapping' | 'Sector Mapping' | 'Validation Issues' | 'Import Preview' | 'Duplicate Review' | 'Opening Balance Drafts' | 'Activity';
type WindowMode = 'normal' | 'minimized' | 'maximized';

const tabs: ImportTab[] = ['Import Setup', 'Column Mapping', 'Sector Mapping', 'Validation Issues', 'Import Preview', 'Duplicate Review', 'Opening Balance Drafts', 'Activity'];
const targetFields = ['productName', 'sku', 'barcode', 'alu', 'vendorSku', 'productNumericNumber', 'description', 'brand', 'manufacturer', 'supplierName', 'supplierItemCode', 'industrialSector', 'productCategory', 'productSubCategory', 'unitOfMeasure', 'condition', 'colour', 'costPrice', 'sellingPrice', 'taxMode', 'vatRate', 'qty', 'shelfLocation', 'reorderLevel', 'reorderQty', 'tags', 'make', 'model', 'yearFrom', 'yearTo', 'side', 'partNumber', 'oemNumber', 'engineCode', 'chassisCode', 'size', 'material', 'grade', 'productType', 'wattage', 'voltage', 'batteryCapacity', 'panelType', 'inverterType'];
const sampleCsv = `productName,sku,barcode,alu,brand,make,model,side,category,costPrice,sellingPrice,qty,shelfLocation,supplierName
Toyota Hilux GD6 Mirror Right Chrome,MIR-GD6-RC,,MIR-GD6-RC,Toyota,Toyota,Hilux GD6,Right,Body Parts,34,68,2,A1-S4,Motor Spares Wholesalers
Universal Radiator Cap 1.1 Bar,RAD-CAP-11,,,Universal,,,,Cooling,3.5,8,10,A2-S2,Motor Spares Wholesalers`;

export default function ProductImportForm(props: ProductImportFormProps) {
  const [activeTab, setActiveTab] = useState<ImportTab>('Import Setup');
  const [mode, setMode] = useState<WindowMode>('normal');
  const [csvText, setCsvText] = useState(sampleCsv);
  const [sector, setSector] = useState<IndustrialSectorCode>(props.batch?.industrialSectorCode || 'MOTOR_SPARES');
  const [source, setSource] = useState<ProductImportSource>(props.batch?.source || 'Paste Table');
  const [fileName, setFileName] = useState(props.batch?.fileName || 'product-import.csv');
  const [notes, setNotes] = useState(props.batch?.notes || '');

  const selectedTemplate = useMemo(() => props.templates.find((template) => template.industrialSectorCode === (props.batch?.industrialSectorCode || sector)) || props.templates[0], [props.templates, props.batch?.industrialSectorCode, sector]);
  const validationIssues = props.rows.flatMap((row) => row.validationIssues);
  const duplicateRows = props.rows.filter((row) => row.status === 'Duplicate' || row.duplicateProductId);
  const currentBatchId = props.batch?.batchId || '';
  const shellClass = mode === 'maximized'
    ? 'fixed inset-4 z-50 bg-white border-2 border-[#1e222b] shadow-2xl flex flex-col'
    : 'fixed inset-x-4 top-8 z-50 mx-auto max-w-6xl bg-white border-2 border-[#1e222b] shadow-2xl flex flex-col';

  return (
    <div className="fixed inset-0 z-40 bg-black/35">
      <section className={shellClass}>
        <header className="bg-[#1e222b] text-white px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[9px] uppercase text-orange-400 font-black">Product Import Desk</p>
            <h2 className="text-sm font-black uppercase">Map spreadsheet columns into Product Master and sector-specific inventory fields.</h2>
          </div>
          <div className="flex items-center gap-1">
            <button className="p-2 bg-zinc-800 border border-zinc-700" onClick={() => setMode('minimized')} title="Minimize"><Minimize2 size={14} /></button>
            <button className="p-2 bg-zinc-800 border border-zinc-700" onClick={() => setMode('normal')} title="Restore"><RotateCcw size={14} /></button>
            <button className="p-2 bg-zinc-800 border border-zinc-700" onClick={() => setMode('maximized')} title="Maximize"><Maximize2 size={14} /></button>
            <button className="p-2 bg-orange-600 border border-orange-700" onClick={props.onClose} title="Close"><X size={14} /></button>
          </div>
        </header>
        {mode === 'minimized' ? (
          <button className="p-4 text-left font-black text-xs uppercase" onClick={() => setMode('normal')}>{props.batch?.batchNumber || 'New Import'} minimized. Click to restore.</button>
        ) : (
          <>
            <div className="p-3 bg-orange-50 border-b border-orange-200 text-[11px] font-bold text-orange-950">
              Product import does not directly post stock. Imported quantities become Opening Balance or Stock Adjustment drafts until posted.
            </div>
            <nav className="flex flex-wrap gap-1 p-3 border-b border-[#d6d9e0] bg-slate-50">
              {tabs.map((tab) => <button key={tab} className={`px-3 py-2 border text-[10px] font-black uppercase ${activeTab === tab ? 'bg-orange-600 text-white border-orange-700' : 'bg-white border-[#b1b5c2] text-[#1e222b]'}`} onClick={() => setActiveTab(tab)}>{tab}</button>)}
            </nav>
            <main className="p-4 overflow-auto">
              {activeTab === 'Import Setup' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <Field label="Batch Number" value={props.batch?.batchNumber || 'Auto-generated placeholder'} readOnly />
                    <Select label="Source" value={source} options={['Excel Upload Placeholder', 'CSV Upload', 'Paste Table', 'Manual Batch', 'Supplier File', 'Offline Catalogue File']} onChange={(value) => setSource(value as ProductImportSource)} />
                    <Field label="File Name" value={fileName} onChange={setFileName} />
                    <Select label="Industrial Sector" value={sector} options={props.templates.map((template) => template.industrialSectorCode)} onChange={(value) => setSector(value as IndustrialSectorCode)} />
                    <Field label="Branch" value={props.batch?.branchId || 'BR-HARARE'} readOnly />
                    <Field label="Warehouse" value={props.batch?.warehouseId || 'WH-HARARE-01'} readOnly />
                    <Field label="Default Supplier" value="Motor Spares Wholesalers" readOnly />
                    <Field label="Default Category" value={selectedTemplate?.defaultCategoryOptions[0] || 'Imported'} readOnly />
                    <Field label="Default Subcategory" value={selectedTemplate?.defaultSubcategoryOptions[0] || 'Standard'} readOnly />
                    <Field label="Default Unit Of Measure" value="pcs" readOnly />
                    <Field label="Default Tax Mode" value="VAT Registered" readOnly />
                    <Field label="Default VAT Rate" value="15" readOnly />
                  </div>
                  <label className="block text-[9px] uppercase font-black text-slate-500">Notes<textarea className="w-full border border-[#b1b5c2] p-3 text-xs min-h-16" value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
                  <label className="block text-[9px] uppercase font-black text-slate-500">CSV Text Paste Area<textarea className="w-full border border-[#b1b5c2] p-3 text-xs min-h-36 font-mono" value={csvText} onChange={(event) => setCsvText(event.target.value)} /></label>
                  <div className="flex flex-wrap gap-2">
                    <button className="sci-pos-button sci-pos-button--primary" onClick={() => props.onCreateBatch({ industrialSectorCode: sector, source, fileName, notes })}>Create Batch</button>
                    <button className="sci-pos-button sci-pos-button--primary" disabled={!currentBatchId} onClick={() => props.onParseCsv(currentBatchId, csvText)}>Parse CSV Placeholder</button>
                    <button className="sci-pos-button sci-pos-button--secondary" disabled={!currentBatchId} onClick={() => props.onUploadPlaceholder(currentBatchId, fileName)}><Upload size={14} />Upload File Placeholder</button>
                    <button className="sci-pos-button sci-pos-button--secondary" onClick={() => setCsvText('')}>Clear</button>
                  </div>
                  <p className="text-[11px] text-slate-600 font-bold">Excel parser will be connected later. CSV paste/import is available for build-development.</p>
                </div>
              )}
              {activeTab === 'Column Mapping' && (
                <div className="space-y-3">
                  <div className="flex gap-2"><button className="sci-pos-button sci-pos-button--primary" disabled={!currentBatchId} onClick={() => props.onAutoMap(currentBatchId, sector)}>Auto Map Columns</button><button className="sci-pos-button sci-pos-button--secondary" disabled={!currentBatchId} onClick={() => props.onValidate(currentBatchId)}>Validate Mapping</button></div>
                  <SimpleTable headers={['Source Column', 'Sample Value', 'Target Field', 'Required', 'Sector Specific', 'Status']}>{props.mappings.map((mapping) => <tr key={mapping.mappingId}><Td>{mapping.sourceColumn}</Td><Td>{mapping.sampleValue}</Td><Td><select className="border border-[#b1b5c2] p-1 bg-white" value={mapping.targetField} onChange={() => undefined}>{targetFields.map((field) => <option key={field}>{field}</option>)}</select></Td><Td>{mapping.required ? 'Yes' : 'No'}</Td><Td>{mapping.sectorSpecific ? 'Yes' : 'No'}</Td><Td><Badge value={mapping.status} /></Td></tr>)}</SimpleTable>
                </div>
              )}
              {activeTab === 'Sector Mapping' && selectedTemplate && <SectorTemplateView template={selectedTemplate} />}
              {activeTab === 'Validation Issues' && <SimpleTable headers={['Row No.', 'Field', 'Issue Type', 'Message', 'Severity', 'Suggested Fix', 'Action']}>{validationIssues.map((issue) => <tr key={issue.issueId}><Td>{issue.rowNumber}</Td><Td>{issue.field}</Td><Td>{issue.issueType}</Td><Td>{issue.message}</Td><Td><Badge value={issue.severity} /></Td><Td>{issue.suggestedFix}</Td><Td><button className="sci-pos-button sci-pos-button--secondary" onClick={() => props.onSkipRow(issue.batchId, issue.rowId)}>Skip Row</button></Td></tr>)}</SimpleTable>}
              {activeTab === 'Import Preview' && <ImportPreview rows={props.rows} preview={props.preview} onSkipRow={(row) => props.onSkipRow(row.batchId, row.rowId)} />}
              {activeTab === 'Duplicate Review' && <SimpleTable headers={['Row No.', 'Imported SKU', 'Imported Barcode', 'Imported ALU', 'Imported Product Name', 'Matched Product', 'Match Reason', 'Confidence', 'Duplicate Action', 'Action']}>{duplicateRows.map((row) => <tr key={row.rowId}><Td>{row.rowNumber}</Td><Td>{String(row.mappedProduct.sku || '-')}</Td><Td>{String(row.mappedProduct.barcode || '-')}</Td><Td>{String(row.mappedProduct.alu || '-')}</Td><Td>{String(row.mappedProduct.productName || '-')}</Td><Td>{row.duplicateProductId || '-'}</Td><Td>Identifier or name/brand/model match</Td><Td>High</Td><Td>{row.duplicateAction}</Td><Td><button className="sci-pos-button sci-pos-button--secondary" onClick={() => props.onSkipRow(row.batchId, row.rowId)}>Skip</button></Td></tr>)}</SimpleTable>}
              {activeTab === 'Opening Balance Drafts' && <OpeningBalanceDrafts rows={props.rows} drafts={props.openingBalanceDrafts} />}
              {activeTab === 'Activity' && <SimpleTable headers={['Date', 'Event', 'Batch', 'Row', 'Staff', 'Message']}>{props.activity.map((event) => <tr key={event.eventId}><Td>{dateLabel(event.createdAt)}</Td><Td>{event.eventType.replace(/_/g, ' ')}</Td><Td>{event.batchId || '-'}</Td><Td>{event.rowId || '-'}</Td><Td>{event.staffName || event.staffId || '-'}</Td><Td>{event.message}</Td></tr>)}</SimpleTable>}
            </main>
            <footer className="p-3 border-t border-[#d6d9e0] flex flex-wrap gap-2 justify-end">
              <button className="sci-pos-button sci-pos-button--secondary" disabled={!currentBatchId} onClick={() => props.onValidate(currentBatchId)}>Validate Import</button>
              <button className="sci-pos-button sci-pos-button--secondary" disabled={!currentBatchId} onClick={() => props.onSubmitApproval(currentBatchId)}>Submit for Approval</button>
              <button className="sci-pos-button sci-pos-button--primary" disabled={!currentBatchId} onClick={() => props.onApprove(currentBatchId)}>Approve</button>
              <button className="sci-pos-button sci-pos-button--primary" disabled={!currentBatchId} onClick={() => props.onImport(currentBatchId)}>Import Approved Batch</button>
              <button className="sci-pos-button sci-pos-button--secondary" disabled={!currentBatchId} onClick={() => props.onExportErrors(currentBatchId)}>Export Errors</button>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}

function SectorTemplateView({ template }: { template: IndustrialSectorMappingTemplate }) {
  const rows = [
    ['Required Fields', template.requiredFields.join(', ')],
    ['Recommended Fields', template.recommendedFields.join(', ')],
    ['Optional Fields', template.optionalFields.join(', ')],
    ['Sector Specific Fields', template.sectorSpecificFields.join(', ')],
    ['Category Suggestions', template.defaultCategoryOptions.join(', ')],
    ['Subcategory Suggestions', template.defaultSubcategoryOptions.join(', ')]
  ];
  return <div className="space-y-3"><div className="bg-[#1e222b] text-white p-3"><h3 className="font-black uppercase">{template.sectorName}</h3></div><div className="grid grid-cols-1 md:grid-cols-2 gap-3">{rows.map(([label, value]) => <div key={label} className="border border-[#b1b5c2] bg-slate-50 p-3"><span className="text-[9px] uppercase text-slate-500 font-black">{label}</span><p className="text-xs font-bold text-[#1e222b] mt-1">{value}</p></div>)}</div></div>;
}

function ImportPreview({ rows, preview, onSkipRow }: { rows: ProductImportRow[]; preview: ProductImportPreviewSummary | null; onSkipRow: (row: ProductImportRow) => void }) {
  return <div className="space-y-3">{preview && <div className="grid grid-cols-2 md:grid-cols-7 gap-2">{[['Total Rows', preview.totalRows], ['Valid Rows', preview.validRows], ['Warning Rows', preview.warningRows], ['Error Rows', preview.errorRows], ['Duplicate Rows', preview.duplicateRows], ['Products To Create', preview.productsToCreate], ['Opening Balance Drafts', preview.openingBalanceDraftsToCreate]].map(([label, value]) => <div key={label} className="border border-[#b1b5c2] p-3"><span className="text-[9px] uppercase text-slate-500 font-black">{label}</span><strong className="block text-sm">{value}</strong></div>)}</div>}<SimpleTable headers={['Row No.', 'SKU', 'Barcode', 'ALU', 'Product Name', 'Brand', 'Sector', 'Category', 'Cost', 'Price', 'Qty', 'Branch', 'Warehouse', 'Shelf', 'Status', 'Action']}>{rows.map((row) => <tr key={row.rowId}><Td>{row.rowNumber}</Td><Td>{String(row.mappedProduct.sku || '-')}</Td><Td>{String(row.mappedProduct.barcode || '-')}</Td><Td>{String(row.mappedProduct.alu || '-')}</Td><Td>{String(row.mappedProduct.productName || '-')}</Td><Td>{String(row.mappedProduct.brand || '-')}</Td><Td>{String(row.mappedProduct.industrialSector || '-')}</Td><Td>{String(row.mappedProduct.productCategory || row.mappedProduct.category || '-')}</Td><Td>{String(row.mappedProduct.costPrice || '-')}</Td><Td>{String(row.mappedProduct.sellingPrice || '-')}</Td><Td>{String(row.mappedProduct.qty || '-')}</Td><Td>BR-HARARE</Td><Td>WH-HARARE-01</Td><Td>{String(row.mappedProduct.shelfLocation || '-')}</Td><Td><Badge value={row.status} /></Td><Td><button className="sci-pos-button sci-pos-button--secondary" onClick={() => onSkipRow(row)}>Skip Row</button></Td></tr>)}</SimpleTable></div>;
}

function OpeningBalanceDrafts({ rows, drafts }: { rows: ProductImportRow[]; drafts: OpeningBalanceDraftFromImport[] }) {
  const rowsWithQty = rows.filter((row) => Number(row.mappedProduct.qty || 0) > 0);
  return <SimpleTable headers={['Row No.', 'SKU', 'Product', 'Branch', 'Warehouse', 'Shelf', 'Imported Qty', 'Unit Cost', 'Value Estimate', 'Status', 'Action']}>{rowsWithQty.map((row) => <tr key={row.rowId}><Td>{row.rowNumber}</Td><Td>{String(row.mappedProduct.sku || '-')}</Td><Td>{String(row.mappedProduct.productName || '-')}</Td><Td>BR-HARARE</Td><Td>WH-HARARE-01</Td><Td>{String(row.mappedProduct.shelfLocation || '-')}</Td><Td>{String(row.mappedProduct.qty || '0')}</Td><Td>{String(row.mappedProduct.costPrice || '0')}</Td><Td>{(Number(row.mappedProduct.qty || 0) * Number(row.mappedProduct.costPrice || 0)).toFixed(2)}</Td><Td>{drafts.some((draft) => draft.rowId === row.rowId) ? 'Draft Created - Not Posted' : 'Preview Only - Not Posted'}</Td><Td><button className="sci-pos-button sci-pos-button--secondary">Open Stock Adjustment Placeholder</button></Td></tr>)}</SimpleTable>;
}

function SimpleTable({ headers, children }: { headers: string[]; children: ReactNode }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-[10.5px] text-left border-collapse"><thead><tr className="bg-[#1e222b] text-white uppercase text-[8.5px] font-black">{headers.map((header) => <th key={header} className="py-2 px-3">{header}</th>)}</tr></thead><tbody className="divide-y divide-[#d6d9e0]">{children}</tbody></table></div>;
}

function Td({ children }: { children: ReactNode }) {
  return <td className="py-2 px-3 align-top font-semibold text-slate-700">{children}</td>;
}

function Badge({ value }: { value: string }) {
  const danger = ['Error', 'Validation Failed', 'Duplicate'].includes(value);
  const warn = ['Warning', 'Pending Approval', 'Hold For Review'].includes(value);
  return <span className={`px-2 py-1 border text-[9px] font-black uppercase whitespace-nowrap ${danger ? 'bg-rose-50 border-rose-400 text-rose-800' : warn ? 'bg-orange-50 border-orange-400 text-orange-800' : 'bg-slate-50 border-slate-300 text-slate-800'}`}>{value}</span>;
}

function Field({ label, value, onChange, readOnly }: { label: string; value: string; onChange?: (value: string) => void; readOnly?: boolean }) {
  return <label className="text-[9px] uppercase font-black text-slate-500">{label}<input className="w-full p-2 border border-[#b1b5c2] text-xs bg-white" value={value} readOnly={readOnly} onChange={(event) => onChange?.(event.target.value)} /></label>;
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="text-[9px] uppercase font-black text-slate-500">{label}<select className="w-full p-2 border border-[#b1b5c2] text-xs bg-white" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function dateLabel(value: string): string {
  return value ? value.replace('T', ' ').slice(0, 16) : '-';
}
