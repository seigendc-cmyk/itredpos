import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { HelpCircle, Maximize2, Minimize2, RotateCcw, Upload, X } from 'lucide-react';
import type {
  IndustrialSectorCode,
  InventoryImportColumn,
  InventoryImportValidationIssue,
  ProductImportActivityEvent,
  ProductImportBatch,
  ProductImportColumnMapping,
  ProductImportPreviewSummary,
  ProductImportRow,
  ProductImportSource
} from '../types';
import InventoryImportIssueReport from './InventoryImportIssueReport';
import InventoryImportMappingTemplateModal from './InventoryImportMappingTemplateModal';
import { getInventoryImportFieldDefinitions } from '../services/inventoryImportFieldDefinitions';
import {
  createImportValidationIssues,
  detectColumns,
  detectImportFileType,
  mapWizardColumnsToProductMappings,
  parseCsvText,
  validateImportMapping
} from '../services/inventoryImportService';

interface WizardProps {
  batch: ProductImportBatch | null;
  rows: ProductImportRow[];
  mappings: ProductImportColumnMapping[];
  activity: ProductImportActivityEvent[];
  preview: ProductImportPreviewSummary | null;
  staffId: string;
  staffName: string;
  onClose: () => void;
  onCreateBatch: (payload: { industrialSectorCode: IndustrialSectorCode; source: ProductImportSource; fileName?: string; notes?: string }) => Promise<void>;
  onParseCsv: (batchId: string, csvText: string) => Promise<void>;
  onAutoMap: (batchId: string, sectorCode: IndustrialSectorCode) => Promise<void>;
  onValidate: (batchId: string) => Promise<void>;
  onSubmitApproval: (batchId: string) => Promise<void>;
  onApprove: (batchId: string) => Promise<void>;
  onImport: (batchId: string) => Promise<void>;
  onSkipRow: (batchId: string, rowId: string) => Promise<void>;
  onExportErrors: (batchId: string) => Promise<void>;
}

type WizardStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;
type WindowMode = 'normal' | 'minimized' | 'maximized';

const sampleCsv = `Item Name,Item Number,Regular Price,Average Unit Cost,On Hand,Department,Supplier,Location,Make,Model,Part No
Toyota Hilux GD6 Mirror Right Chrome,MIR-GD6-RC,68,34,2,Body Parts,Motor Spares Wholesalers,A1-S4,Toyota,Hilux GD6,MIR-GD6-RC
Brake Pads Toyota GD6 Front,BP-GD6-F,28,34,4,Braking,,B2-S2,Toyota,Hilux GD6,BP-GD6-F
Universal Radiator Cap 1.1 Bar,RAD-CAP-11,8,,10,Cooling,Motor Spares Wholesalers,A2-S2,,,RAD-CAP-11`;

const steps: Array<{ id: WizardStep; label: string }> = [
  { id: 1, label: 'Select File / Paste Data' },
  { id: 2, label: 'Sheet / Start Row' },
  { id: 3, label: 'Column Preview' },
  { id: 4, label: 'Mapping' },
  { id: 5, label: 'Validation Preview' },
  { id: 6, label: 'Import Preview' },
  { id: 7, label: 'Submit / Approve / Post' }
];

export default function InventoryImportMappingWizard(props: WizardProps) {
  const [step, setStep] = useState<WizardStep>(1);
  const [mode, setMode] = useState<WindowMode>('normal');
  const [fileName, setFileName] = useState(props.batch?.fileName || 'quickbooks-pos-style-import.csv');
  const [manualText, setManualText] = useState(sampleCsv);
  const [startRow, setStartRow] = useState(1);
  const [sheetName, setSheetName] = useState('Sheet1');
  const [sector, setSector] = useState<IndustrialSectorCode>(props.batch?.industrialSectorCode || 'MOTOR_SPARES');
  const [columns, setColumns] = useState<InventoryImportColumn[]>([]);
  const [mappingIssues, setMappingIssues] = useState<InventoryImportValidationIssue[]>([]);
  const [rowIssues, setRowIssues] = useState<InventoryImportValidationIssue[]>([]);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [notice, setNotice] = useState('');

  const parsedRows = useMemo(() => parseCsvText(manualText), [manualText]);
  const fileType = detectImportFileType(fileName);
  const currentBatchId = props.batch?.batchId || '';
  const shellClass = mode === 'maximized'
    ? 'fixed inset-4 z-50 bg-white border-2 border-[#1e222b] shadow-2xl flex flex-col'
    : 'fixed inset-x-4 top-8 z-50 mx-auto max-w-[1400px] max-h-[92vh] bg-white border-2 border-[#1e222b] shadow-2xl flex flex-col';

  useEffect(() => {
    if (parsedRows.length) setColumns(detectColumns(parsedRows.slice(Math.max(0, startRow - 1))));
  }, [manualText, startRow]);

  useEffect(() => {
    if (props.mappings.length && !columns.length) {
      setColumns(props.mappings.map((mapping, index) => ({ columnIndex: index, columnLetter: String.fromCharCode(65 + index), sourceColumnName: mapping.sourceColumn, sampleValues: [mapping.sampleValue], detectedFieldKey: mapping.targetField, mappedFieldKey: mapping.targetField, confidenceScore: mapping.status === 'Mapped' ? 100 : 0, ignored: mapping.targetField === 'Ignore', notes: mapping.status })));
    }
  }, [props.mappings, columns.length]);

  const fields = getInventoryImportFieldDefinitions();
  const estimatedValue = props.rows.reduce((sum, row) => sum + (Number(row.mappedProduct.qty || 0) * Number(row.mappedProduct.costPrice || row.mappedProduct.unitCost || 0)), 0);
  const validationRows = props.rows.flatMap((row) => row.validationIssues);

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 4000);
  };

  const createBatchAndParse = async () => {
    await props.onCreateBatch({ industrialSectorCode: sector, source: fileType === 'CSV' ? 'CSV Upload' : fileType === 'ManualPaste' ? 'Paste Table' : 'Excel Upload Placeholder', fileName, notes: `Sheet ${sheetName}; start row ${startRow}. Created from mapping wizard.` });
    showNotice('Draft import batch created. Parse CSV after batch is selected.');
  };

  const parseIntoBatch = async () => {
    if (!currentBatchId) {
      await createBatchAndParse();
      return;
    }
    await props.onParseCsv(currentBatchId, manualText);
    showNotice('CSV/manual paste parsed locally.');
    setStep(3);
  };

  const saveCurrentMapping = async () => {
    if (!currentBatchId) {
      showNotice('Create a batch before saving mappings.');
      return;
    }
    const mappings = mapWizardColumnsToProductMappings(currentBatchId, columns);
    if (!mappings.length) {
      showNotice('No mapped columns to save.');
      return;
    }
    await props.onAutoMap(currentBatchId, sector);
    showNotice(`${mappings.length} mapping row(s) prepared. Auto-match refreshed existing local batch mapping.`);
  };

  const validateMapping = () => {
    const issues = validateImportMapping(columns);
    setMappingIssues(issues);
    showNotice(issues.length ? `${issues.length} mapping issue(s) found.` : 'Mapping validation passed.');
    return issues.length === 0;
  };

  const validateRows = async () => {
    if (!currentBatchId) return;
    await props.onValidate(currentBatchId);
    const issues = await createImportValidationIssues(currentBatchId);
    setRowIssues(issues);
    setStep(5);
  };

  const printSummary = () => {
    const popup = window.open('', '_blank', 'width=980,height=720');
    if (!popup) return;
    popup.document.write(`<html><head><title>Inventory Import Summary</title><style>body{font-family:Arial;padding:24px;color:#1e222b}table{width:100%;border-collapse:collapse}td,th{border:1px solid #b1b5c2;padding:8px;text-align:left}th{background:#1e222b;color:white}</style></head><body><h1>Inventory Import Batch Summary</h1><p>${props.batch?.batchNumber || 'Draft'} - ${fileName}</p><p>Rows ${props.preview?.totalRows || props.rows.length}; Valid ${props.preview?.validRows || 0}; Warnings ${props.preview?.warningRows || 0}; Errors ${props.preview?.errorRows || 0}; Estimated Value ${estimatedValue.toFixed(2)}</p><p>Local/mock preview only. Imported product data does not update live stock before approval and local post.</p></body></html>`);
    popup.document.close();
    popup.print();
  };

  const exportPreview = () => {
    const csv = ['Row,SKU,Product,Status,Action,Estimated Value', ...props.rows.map((row) => [row.rowNumber, row.mappedProduct.sku || row.mappedProduct.productCode || '', row.mappedProduct.productName || '', row.status, row.duplicateAction, Number(row.mappedProduct.qty || 0) * Number(row.mappedProduct.costPrice || row.mappedProduct.unitCost || 0)].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'inventory-import-preview.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/35">
      <section className={shellClass}>
        <header className="bg-[#1e222b] text-white px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[9px] uppercase text-orange-400 font-black">Inventory Import Mapping Wizard</p>
            <h2 className="text-sm font-black uppercase">Map spreadsheet columns to iTredPOS product, stock, supplier, tax, motor spares, and financial fields.</h2>
          </div>
          <div className="flex items-center gap-1">
            <button className="p-2 bg-zinc-800 border border-zinc-700" onClick={() => setMode('minimized')} title="Minimize"><Minimize2 size={14} /></button>
            <button className="p-2 bg-zinc-800 border border-zinc-700" onClick={() => setMode('normal')} title="Restore"><RotateCcw size={14} /></button>
            <button className="p-2 bg-zinc-800 border border-zinc-700" onClick={() => setMode('maximized')} title="Maximize"><Maximize2 size={14} /></button>
            <button className="p-2 bg-orange-600 border border-orange-700" onClick={props.onClose} title="Close"><X size={14} /></button>
          </div>
        </header>
        {mode === 'minimized' ? (
          <button className="p-4 text-left font-black text-xs uppercase" onClick={() => setMode('normal')}>{props.batch?.batchNumber || 'Inventory Import Wizard'} minimized. Click to restore.</button>
        ) : (
          <>
            <div className="p-3 bg-orange-50 border-b border-orange-200 text-[11px] font-bold text-orange-950">
              Imported product data is held as draft/import preview until validated, approved, and posted locally. No Firestore, cloud upload, or final stock posting is connected.
            </div>
            {notice && <div className="mx-4 mt-3 border border-orange-200 bg-orange-50 text-orange-900 p-2 text-[10px] font-bold uppercase">{notice}</div>}
            <nav className="flex flex-wrap gap-1 p-3 border-b border-[#d6d9e0] bg-slate-50">
              {steps.map((item) => <button key={item.id} className={`px-3 py-2 border text-[10px] font-black uppercase ${step === item.id ? 'bg-orange-600 text-white border-orange-700' : 'bg-white border-[#b1b5c2] text-[#1e222b]'}`} onClick={() => setStep(item.id)}>{item.id}. {item.label}</button>)}
            </nav>
            <main className="p-4 overflow-auto">
              {step === 1 && <StepPanel title="Select File / Paste Data"><div className="grid grid-cols-1 md:grid-cols-4 gap-3"><Field label="File Name" value={fileName} onChange={setFileName} /><Field label="Detected Type" value={fileType} readOnly /><Select label="Sector" value={sector} options={['MOTOR_SPARES', 'HARDWARE', 'GROCERY', 'PHARMACY', 'GENERAL_RETAIL', 'OTHER']} onChange={(value) => setSector(value as IndustrialSectorCode)} /><label className="text-[9px] uppercase font-black text-slate-500">Local File Input<input type="file" accept=".csv,.txt,.xlsx,.xls" className="w-full p-2 border border-[#b1b5c2] bg-white text-xs" onChange={(event) => setFileName(event.target.files?.[0]?.name || fileName)} /></label></div><label className="block text-[9px] uppercase font-black text-slate-500 mt-3">Manual Paste / CSV Text<textarea className="w-full border border-[#b1b5c2] p-3 text-xs min-h-52 font-mono" value={manualText} onChange={(event) => setManualText(event.target.value)} /></label><div className="mt-3 flex flex-wrap gap-2"><button className="sci-pos-button sci-pos-button--primary" onClick={() => void parseIntoBatch()}><Upload size={14} /> Create / Parse Preview</button><button className="sci-pos-button sci-pos-button--secondary" onClick={() => setManualText(sampleCsv)}>Load Sample</button></div></StepPanel>}
              {step === 2 && <StepPanel title="Choose Sheet / Start Row"><div className="grid grid-cols-1 md:grid-cols-3 gap-3"><Select label="Sheet" value={sheetName} options={['Sheet1', 'Inventory', 'Products', 'QuickBooks Export']} onChange={setSheetName} /><Field label="Start Row" value={String(startRow)} onChange={(value) => setStartRow(Math.max(1, Number(value) || 1))} /><Field label="Rows Detected" value={String(parsedRows.length)} readOnly /></div><PreviewTable rows={parsedRows.slice(0, 8)} /></StepPanel>}
              {step === 3 && <StepPanel title="Column Preview"><SimpleTable headers={['Column', 'Source Column', 'Samples', 'Detected Field', 'Confidence', 'Ignore']}>{columns.map((column) => <tr key={column.columnIndex}><Td>{column.columnLetter}</Td><Td>{column.sourceColumnName}</Td><Td>{column.sampleValues.join(' | ')}</Td><Td>{column.detectedFieldKey || '-'}</Td><Td>{column.confidenceScore}%</Td><Td><input type="checkbox" checked={column.ignored} onChange={(event) => setColumns((current) => current.map((item) => item.columnIndex === column.columnIndex ? { ...item, ignored: event.target.checked } : item))} /></Td></tr>)}</SimpleTable></StepPanel>}
              {step === 4 && <StepPanel title="QuickBooks-Like Column Mapping"><div className="flex flex-wrap gap-2 mb-3"><button className="sci-pos-button sci-pos-button--primary" onClick={() => setColumns(detectColumns(parsedRows))}>Auto Match Fields</button><button className="sci-pos-button sci-pos-button--secondary" onClick={validateMapping}>Validate Mapping</button><button className="sci-pos-button sci-pos-button--secondary" onClick={() => setTemplateOpen(true)}>Manage Templates</button><button className="sci-pos-button sci-pos-button--secondary" onClick={() => void saveCurrentMapping()}>Save Draft Mapping</button></div><SimpleTable headers={['Import Data: Source Column', 'Sample Values', 'iTredPOS Field: Target Destination', 'Required?', 'Status']}>{columns.map((column) => { const definition = fields.find((field) => field.fieldKey === column.mappedFieldKey); return <tr key={column.columnIndex}><Td>{column.sourceColumnName}</Td><Td>{column.sampleValues.join(' | ')}</Td><Td><select className="border border-[#b1b5c2] p-2 bg-white min-w-64" value={column.mappedFieldKey || ''} onChange={(event) => setColumns((current) => current.map((item) => item.columnIndex === column.columnIndex ? { ...item, mappedFieldKey: event.target.value || undefined, ignored: !event.target.value } : item))}><option value="">Ignore / Unmapped</option>{fields.map((field) => <option key={field.fieldKey} value={field.fieldKey}>{field.fieldLabel} ({field.fieldType})</option>)}</select></Td><Td>{definition?.required ? 'Required' : definition?.fieldType || '-'}</Td><Td>{column.ignored ? 'Ignored' : column.mappedFieldKey ? 'Mapped' : 'Unmapped'}</Td></tr>; })}</SimpleTable>{mappingIssues.length > 0 && <InventoryImportIssueReport issues={mappingIssues} onCreateTask={(issue) => showNotice(`Task placeholder created for ${issue.code}.`)} onCreateBIWarning={(issue) => showNotice(`BI warning placeholder created for ${issue.code}.`)} />}</StepPanel>}
              {step === 5 && <StepPanel title="Validation Preview"><div className="flex flex-wrap gap-2 mb-3"><button className="sci-pos-button sci-pos-button--primary" disabled={!currentBatchId} onClick={() => void validateRows()}>Validate Rows</button><button className="sci-pos-button sci-pos-button--secondary" disabled={!currentBatchId} onClick={() => void props.onExportErrors(currentBatchId)}>Export Issues</button></div><InventoryImportIssueReport issues={rowIssues.length ? rowIssues : validationRows.map((issue) => ({ issueId: issue.issueId, batchId: issue.batchId, rowId: issue.rowId, rowNumber: issue.rowNumber, fieldKey: issue.field, severity: issue.severity === 'Error' ? 'Error' : issue.severity === 'Warning' ? 'Warning' : 'Info', code: issue.issueType.replace(/\s+/g, '_').toUpperCase(), message: issue.message, recommendedAction: issue.suggestedFix, createdAt: new Date().toISOString() }))} onCreateTask={(issue) => showNotice(`Import task placeholder created for ${issue.code}.`)} onCreateBIWarning={(issue) => showNotice(`Import BI warning placeholder created for ${issue.code}.`)} /></StepPanel>}
              {step === 6 && <StepPanel title="Import Preview"><Summary preview={props.preview} estimatedValue={estimatedValue} /><SimpleTable headers={['Row', 'SKU', 'Product', 'Cost', 'Price', 'Qty', 'Action', 'Status', 'Issues']}>{props.rows.map((row) => <tr key={row.rowId}><Td>{row.rowNumber}</Td><Td>{String(row.mappedProduct.sku || row.mappedProduct.productCode || '-')}</Td><Td>{String(row.mappedProduct.productName || '-')}</Td><Td>{String(row.mappedProduct.costPrice || row.mappedProduct.unitCost || '-')}</Td><Td>{String(row.mappedProduct.sellingPrice || '-')}</Td><Td>{String(row.mappedProduct.qty || row.mappedProduct.openingQuantity || '-')}</Td><Td>{row.duplicateProductId ? 'Needs Review' : row.status === 'Skipped' ? 'Skip Row' : 'Create New Product / Opening Stock Draft'}</Td><Td>{row.status}</Td><Td>{row.validationIssues.length}</Td></tr>)}</SimpleTable><div className="mt-3 flex gap-2"><button className="sci-pos-button sci-pos-button--secondary" onClick={exportPreview}>Export Preview Rows</button><button className="sci-pos-button sci-pos-button--secondary" onClick={printSummary}>Print Import Summary</button></div></StepPanel>}
              {step === 7 && <StepPanel title="Submit / Approve / Post"><Summary preview={props.preview} estimatedValue={estimatedValue} /><div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4"><Metric label="Batch" value={props.batch?.batchNumber || 'Draft'} /><Metric label="Status" value={props.batch?.status || 'Not Created'} /><Metric label="File" value={fileName} /></div><div className="flex flex-wrap gap-2"><button className="sci-pos-button sci-pos-button--secondary" disabled={!currentBatchId} onClick={() => void props.onSubmitApproval(currentBatchId)}>Submit for Approval</button><button className="sci-pos-button sci-pos-button--primary" disabled={!currentBatchId} onClick={() => void props.onApprove(currentBatchId)}>Approve Locally</button><button className="sci-pos-button sci-pos-button--primary" disabled={!currentBatchId || props.batch?.status !== 'Approved'} onClick={() => void props.onImport(currentBatchId)}>Post Import Local</button><button className="sci-pos-button sci-pos-button--secondary" onClick={printSummary}>Print Posted Summary</button></div><div className="a5-tool-note mt-4">Posting creates product drafts and opening balance drafts locally only. Error rows do not post. No Firestore business reads/writes or final live stock posting.</div><Activity rows={props.activity} /></StepPanel>}
            </main>
            <footer className="p-3 border-t border-[#d6d9e0] flex flex-wrap gap-2 justify-between">
              <button className="sci-pos-button sci-pos-button--secondary"><HelpCircle size={14} /> Help</button>
              <div className="flex flex-wrap gap-2"><button className="sci-pos-button sci-pos-button--secondary" disabled={step === 1} onClick={() => setStep((Math.max(1, step - 1) as WizardStep))}>Previous</button><button className="sci-pos-button sci-pos-button--primary" disabled={step === 7} onClick={() => setStep((Math.min(7, step + 1) as WizardStep))}>Next</button><button className="sci-pos-button sci-pos-button--secondary" onClick={props.onClose}>Close</button></div>
            </footer>
          </>
        )}
      </section>
      <InventoryImportMappingTemplateModal open={templateOpen} columns={columns} staffName={props.staffName} onClose={() => setTemplateOpen(false)} onApply={setColumns} onNotice={showNotice} />
    </div>
  );
}

function StepPanel({ title, children }: { title: string; children: ReactNode }) {
  return <section className="space-y-4"><div className="bg-[#1e222b] text-white p-3"><h3 className="font-black uppercase text-sm">{title}</h3></div>{children}</section>;
}

function Summary({ preview, estimatedValue }: { preview: ProductImportPreviewSummary | null; estimatedValue: number }) {
  return <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-3"><Metric label="Rows" value={preview?.totalRows || 0} /><Metric label="Valid" value={preview?.validRows || 0} /><Metric label="Warnings" value={preview?.warningRows || 0} /><Metric label="Errors" value={preview?.errorRows || 0} /><Metric label="Duplicates" value={preview?.duplicateRows || 0} /><Metric label="Est. Value" value={estimatedValue.toFixed(2)} /></div>;
}

function Metric({ label, value }: { label: string; value: ReactNode }) {
  return <div className="border border-[#b1b5c2] bg-slate-50 p-3"><span className="block text-[9px] text-slate-500 uppercase font-black">{label}</span><strong className="block text-sm text-[#1e222b]">{value}</strong></div>;
}

function PreviewTable({ rows }: { rows: string[][] }) {
  return <div className="overflow-x-auto mt-3"><table className="sci-pos-table"><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>;
}

function Activity({ rows }: { rows: ProductImportActivityEvent[] }) {
  return <SimpleTable headers={['Date', 'Event', 'Message']}>{rows.slice(0, 8).map((row) => <tr key={row.eventId}><Td>{row.createdAt.replace('T', ' ').slice(0, 16)}</Td><Td>{row.eventType.replace(/_/g, ' ')}</Td><Td>{row.message}</Td></tr>)}</SimpleTable>;
}

function SimpleTable({ headers, children }: { headers: string[]; children: ReactNode }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-[10.5px] text-left border-collapse"><thead><tr className="bg-[#1e222b] text-white uppercase text-[8.5px] font-black">{headers.map((header) => <th key={header} className="py-2 px-3">{header}</th>)}</tr></thead><tbody className="divide-y divide-[#d6d9e0]">{children}</tbody></table></div>;
}

function Td({ children }: { children: ReactNode }) {
  return <td className="py-2 px-3 align-top font-semibold text-slate-700">{children}</td>;
}

function Field({ label, value, onChange, readOnly }: { label: string; value: string; onChange?: (value: string) => void; readOnly?: boolean }) {
  return <label className="text-[9px] uppercase font-black text-slate-500">{label}<input className="w-full p-2 border border-[#b1b5c2] text-xs bg-white" value={value} readOnly={readOnly} onChange={(event) => onChange?.(event.target.value)} /></label>;
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="text-[9px] uppercase font-black text-slate-500">{label}<select className="w-full p-2 border border-[#b1b5c2] text-xs bg-white" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}
