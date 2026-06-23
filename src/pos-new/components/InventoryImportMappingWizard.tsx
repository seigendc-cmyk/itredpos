import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Database, FileSpreadsheet, Search, Upload, X } from 'lucide-react';
import type {
  IndustrialSectorCode,
  InventoryImportColumn,
  InventoryImportValidationIssue,
  ProductImportActivityEvent,
  ProductImportBatch,
  ProductImportColumnMapping,
  ProductImportDataCategory,
  ProductImportMode,
  ProductImportPreviewSummary,
  ProductImportRow,
  ProductImportSource
} from '../types';
import InventoryImportIssueReport from './InventoryImportIssueReport';
import { getInventoryImportFieldDefinitions } from '../services/inventoryImportFieldDefinitions';
import {
  createImportValidationIssues,
  detectColumns,
  detectImportFileType,
  parseCsvText,
  saveWizardMappingsToBatch,
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
  onCreateBatch: (payload: {
    industrialSectorCode: IndustrialSectorCode;
    importMode: ProductImportMode;
    dataCategory: ProductImportDataCategory;
    source: ProductImportSource;
    fileName?: string;
    worksheetName?: string;
    startRowNumber?: number;
    notes?: string;
  }) => Promise<void>;
  onParseCsv: (batchId: string, csvText: string) => Promise<void>;
  onAutoMap: (batchId: string, sectorCode: IndustrialSectorCode) => Promise<void>;
  onValidate: (batchId: string) => Promise<void>;
  onSubmitApproval: (batchId: string) => Promise<void>;
  onApprove: (batchId: string) => Promise<void>;
  onImport: (batchId: string) => Promise<void>;
  onRollback: (batchId: string) => Promise<void>;
  onSkipRow: (batchId: string, rowId: string) => Promise<void>;
  onExportErrors: (batchId: string) => Promise<void>;
}

type WizardStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

const steps: Array<{ id: WizardStep; label: string }> = [
  { id: 1, label: 'Import Mode' },
  { id: 2, label: 'Data Category' },
  { id: 3, label: 'Source Type' },
  { id: 4, label: 'Upload File' },
  { id: 5, label: 'Worksheet' },
  { id: 6, label: 'Mapping' },
  { id: 7, label: 'Validation' },
  { id: 8, label: 'Import' }
];

const sectorProfiles: Array<{ label: string; code: IndustrialSectorCode; keywords: string[] }> = [
  { label: 'Grocery', code: 'GROCERY', keywords: ['barcode', 'expiryDate', 'batchNumber', 'unitOfMeasure', 'packSize'] },
  { label: 'Agriculture', code: 'AGRICULTURE', keywords: ['seedVariety', 'chemicalActiveIngredient', 'applicationRate', 'expiryDate', 'regulatoryNotes'] },
  { label: 'Motor Spares', code: 'MOTOR_SPARES', keywords: ['make', 'model', 'vehicleMake', 'vehicleModel', 'yearRange', 'partNumber', 'oemNumber', 'side'] },
  { label: 'Hardware', code: 'HARDWARE', keywords: ['size', 'material', 'grade', 'weight', 'unitOfMeasure'] },
  { label: 'Pharmacy', code: 'PHARMACY', keywords: ['dosage', 'strength', 'batchNumber', 'expiryDate', 'prescriptionRequired'] },
  { label: 'Clothing', code: 'CLOTHING', keywords: ['size', 'colour', 'gender', 'fabric', 'style'] },
  { label: 'Electronics', code: 'ELECTRONICS', keywords: ['modelNumber', 'serialNumberSupport', 'warranty', 'powerRating'] },
  { label: 'Logistics / Warehousing', code: 'LOGISTICS_WAREHOUSING', keywords: ['weight', 'dimensions', 'fragileFlag', 'storageRequirement'] }
];

const categoryFields: Record<ProductImportDataCategory, Array<{ key: string; label: string; required?: boolean }>> = {
  'Inventory List': [],
  Images: [
    { key: 'sku', label: 'SKU', required: true },
    { key: 'barcode', label: 'Barcode' },
    { key: 'imageUrl', label: 'Image URL', required: true }
  ],
  Vendors: [
    { key: 'supplierName', label: 'Vendor Name', required: true },
    { key: 'supplierItemCode', label: 'Vendor Item Code' },
    { key: 'supplierEmail', label: 'Vendor Email' }
  ],
  Customers: [
    { key: 'customerName', label: 'Customer Name', required: true },
    { key: 'phone', label: 'Phone Number' },
    { key: 'email', label: 'Email Address' }
  ]
};

const sampleSheet = `Product Name,SKU,Barcode,Selling Price,Cost Price,Qty,Category,Supplier Name,Shelf Location,Make,Model,Part Number
Toyota Hilux GD6 Mirror Right Chrome,MIR-GD6-RC,,68,34,2,Body Parts,Motor Spares Wholesalers,A1-S4,Toyota,Hilux GD6,MIR-GD6-RC
Brake Pads Toyota GD6 Front,BP-GD6-F,,28,16,4,Braking,Motor Spares Wholesalers,B2-S2,Toyota,Hilux GD6,04465-0K290
Universal Radiator Cap 1.1 Bar,RAD-CAP-11,,8,3.5,10,Cooling,Motor Spares Wholesalers,A2-S2,,,RAD-CAP-11`;

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseWorksheetText(text: string): string[][] {
  if (text.includes('\t')) return text.split(/\r?\n/).filter(Boolean).map((row) => row.split('\t').map((cell) => cell.trim()));
  return parseCsvText(text);
}

export default function InventoryImportMappingWizard(props: WizardProps) {
  const [step, setStep] = useState<WizardStep>(1);
  const [importMode, setImportMode] = useState<ProductImportMode>(props.batch?.importMode || 'New Import');
  const [dataCategory, setDataCategory] = useState<ProductImportDataCategory>(props.batch?.dataCategory || 'Inventory List');
  const [sectorLabel, setSectorLabel] = useState(() => sectorProfiles.find((profile) => profile.code === props.batch?.industrialSectorCode)?.label || 'Motor Spares');
  const [sourceType, setSourceType] = useState<'Custom Excel File'>('Custom Excel File');
  const [fileName, setFileName] = useState(props.batch?.fileName || 'inventory-import.xlsx');
  const [worksheetName, setWorksheetName] = useState(props.batch?.worksheetName || 'Sheet1');
  const [startRow, setStartRow] = useState(props.batch?.startRowNumber || 1);
  const [worksheetText, setWorksheetText] = useState(sampleSheet);
  const [columns, setColumns] = useState<InventoryImportColumn[]>([]);
  const [fieldSearch, setFieldSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [mappingIssues, setMappingIssues] = useState<InventoryImportValidationIssue[]>([]);
  const [rowIssues, setRowIssues] = useState<InventoryImportValidationIssue[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [rollbackLog, setRollbackLog] = useState<string[]>([]);

  const selectedSector = sectorProfiles.find((profile) => profile.label === sectorLabel) || sectorProfiles[2];
  const parsedRows = useMemo(() => parseWorksheetText(worksheetText), [worksheetText]);
  const sheetRows = useMemo(() => parsedRows.slice(Math.max(0, startRow - 1)), [parsedRows, startRow]);
  const currentBatchId = props.batch?.batchId || '';
  const allDefinitions = getInventoryImportFieldDefinitions();

  const systemFields = useMemo(() => {
    if (dataCategory !== 'Inventory List') {
      return categoryFields[dataCategory]
        .filter((field) => {
          const search = normalize(fieldSearch);
          return !search || normalize(`${field.label} ${field.key}`).includes(search);
        })
        .map((field) => ({
          fieldKey: field.key,
          fieldLabel: field.label,
          fieldType: field.required ? 'Required' : 'Optional',
          required: Boolean(field.required),
          targetDomain: dataCategory,
          validationType: 'Text'
        }));
    }
    return allDefinitions.filter((definition) => {
      const search = normalize(fieldSearch);
      const searchMatch = !search || normalize(`${definition.fieldLabel} ${definition.fieldKey} ${definition.targetDomain}`).includes(search);
      const sectorMatch = selectedSector.keywords.includes(definition.fieldKey) || definition.required || ['Product', 'Stock', 'Pricing', 'Supplier', 'Location'].includes(definition.targetDomain);
      return searchMatch && sectorMatch;
    });
  }, [allDefinitions, dataCategory, fieldSearch, selectedSector]);

  const validationSummary = useMemo(() => {
    const issues = [...mappingIssues, ...rowIssues];
    return {
      errors: issues.filter((issue) => issue.severity === 'Error').length,
      warnings: issues.filter((issue) => issue.severity === 'Warning').length,
      missingMappings: issues.filter((issue) => issue.code === 'REQUIRED_FIELD_UNMAPPED').length,
      duplicateProducts: props.rows.filter((row) => row.status === 'Duplicate' || row.duplicateProductId).length,
      missingIdentifiers: props.rows.filter((row) => {
        const mapped = row.mappedProduct;
        return !mapped.sku && !mapped.barcode && !mapped.alu && !mapped.vendorSku;
      }).length,
      invalidPrices: props.rows.filter((row) => row.validationIssues.some((issue) => issue.field === 'sellingPrice' || issue.field === 'costPrice')).length,
      invalidQuantities: props.rows.filter((row) => row.validationIssues.some((issue) => issue.field === 'qty')).length
    };
  }, [mappingIssues, props.rows, rowIssues]);

  useEffect(() => {
    setColumns(detectColumns(sheetRows));
  }, [sheetRows]);

  useEffect(() => {
    if (!props.mappings.length) return;
    setColumns((current) => current.map((column) => {
      const saved = props.mappings.find((mapping) => normalize(mapping.sourceColumn) === normalize(column.sourceColumnName));
      return saved ? { ...column, mappedFieldKey: saved.targetField, ignored: false, confidenceScore: 100, notes: 'Saved mapping' } : column;
    }));
  }, [props.mappings]);

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 4200);
  };

  const selectedColumnForField = (fieldKey: string) => columns.find((column) => column.mappedFieldKey === fieldKey)?.sourceColumnName || '';

  const mapFieldToColumn = (fieldKey: string, sourceColumnName: string) => {
    setColumns((current) => current.map((column) => {
      if (column.mappedFieldKey === fieldKey && column.sourceColumnName !== sourceColumnName) {
        return { ...column, mappedFieldKey: undefined, ignored: true };
      }
      if (column.sourceColumnName === sourceColumnName) {
        return { ...column, mappedFieldKey: fieldKey || undefined, ignored: !fieldKey, confidenceScore: 100, notes: fieldKey ? 'Mapped by import desk user.' : 'Ignored by user.' };
      }
      return column;
    }));
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    setFileName(file.name);
    const detectedType = detectImportFileType(file.name);
    if (detectedType === 'CSV') {
      setWorksheetText(await file.text());
      showNotice('Worksheet rows loaded from upload.');
      return;
    }
    showNotice('Excel workbook captured locally. Enter worksheet details in the next step. For offline preview, paste exported worksheet rows if needed.');
  };

  const createBatch = async () => {
    await props.onCreateBatch({
      industrialSectorCode: selectedSector.code,
      importMode,
      dataCategory,
      source: 'Excel Upload',
      fileName,
      worksheetName,
      startRowNumber: startRow,
      notes: `${importMode}; ${dataCategory}; ${sourceType}; worksheet ${worksheetName}; start row ${startRow}.`
    });
    showNotice('Import batch created locally.');
  };

  const parseIntoBatch = async () => {
    if (!currentBatchId) {
      await createBatch();
      showNotice('Batch created. Continue with Parse Worksheet once the batch is loaded.');
      return;
    }
    const rowsToParse = sheetRows.length ? sheetRows : parseWorksheetText(sampleSheet);
    await props.onParseCsv(currentBatchId, rowsToParse.map((row) => row.join(',')).join('\n'));
    showNotice('Worksheet rows parsed into the import batch.');
    setStep(6);
  };

  const autoMap = () => {
    setColumns(detectColumns(sheetRows).map((column) => {
      const source = normalize(column.sourceColumnName);
      const sectorField = allDefinitions.find((definition) => {
        const aliases = [definition.fieldKey, definition.fieldLabel, ...definition.acceptedAliases];
        return aliases.some((alias) => normalize(alias) === source || source.includes(normalize(alias)));
      });
      return sectorField ? { ...column, mappedFieldKey: sectorField.fieldKey, confidenceScore: 96, ignored: false, notes: `${sectorLabel} sector match` } : column;
    }));
    showNotice(`${sectorLabel} sector mapping applied.`);
  };

  const saveMapping = async () => {
    if (!currentBatchId) {
      showNotice('Create and parse a batch before saving mappings.');
      return;
    }
    await saveWizardMappingsToBatch(currentBatchId, columns);
    showNotice('Mapping grid saved to the import batch.');
  };

  const validateAll = async () => {
    const nextMappingIssues = validateImportMapping(columns);
    const categoryIssues: InventoryImportValidationIssue[] = dataCategory === 'Inventory List' ? [] : categoryFields[dataCategory]
      .filter((field) => field.required && !columns.some((column) => !column.ignored && column.mappedFieldKey === field.key))
      .map((field) => ({
        issueId: `IMP-CAT-${field.key}`,
        batchId: currentBatchId || 'DRAFT',
        fieldKey: field.key,
        severity: 'Error',
        code: 'REQUIRED_FIELD_UNMAPPED',
        message: `${field.label} is required for ${dataCategory} imports.`,
        recommendedAction: `Map an Excel column to ${field.label}.`,
        createdAt: new Date().toISOString()
      }));

    setMappingIssues([...nextMappingIssues, ...categoryIssues]);
    if (currentBatchId) {
      await saveWizardMappingsToBatch(currentBatchId, columns);
      await props.onValidate(currentBatchId);
      setRowIssues(await createImportValidationIssues(currentBatchId));
    }
    setStep(7);
    showNotice('Validation preview updated.');
  };

  const validImportRows = props.preview?.validRows || props.rows.filter((row) => row.status === 'Valid').length;
  const canStartImport = currentBatchId && validImportRows > 0 && validationSummary.errors === 0 && validationSummary.missingMappings === 0;

  const processImport = async () => {
    if (!currentBatchId) {
      showNotice('Create and validate a batch before starting import.');
      return;
    }
    if (!canStartImport) {
      showNotice('Import is blocked by required field mapping errors or row validation errors.');
      return;
    }
    setProcessing(true);
    setProgress(10);
    await props.onSubmitApproval(currentBatchId);
    setProgress(35);
    await props.onApprove(currentBatchId);
    setProgress(65);
    await props.onImport(currentBatchId);
    setProgress(100);
    setRollbackLog((current) => [`${new Date().toLocaleTimeString()} - Import completed for ${props.batch?.batchNumber || currentBatchId}.`, ...current]);
    setProcessing(false);
    showNotice('Import completed with local execution log and rollback point.');
  };

  const rollbackImport = async () => {
    if (!currentBatchId) {
      showNotice('No imported batch is loaded for rollback.');
      return;
    }
    await props.onRollback(currentBatchId);
    setProgress(0);
    setProcessing(false);
    setRollbackLog((current) => [`${new Date().toLocaleTimeString()} - Rollback executed for ${props.batch?.batchNumber || currentBatchId}.`, ...current]);
    showNotice('Rollback completed where local reversal was possible.');
  };

  return (
    <div className="industrial-import-overlay">
      <section className="industrial-import-wizard">
        <header className="industrial-import-header">
          <div>
            <span>Product Import Desk</span>
            <h2>Industrial Grade Data Import Wizard</h2>
            <p>{props.batch?.batchNumber || 'Draft batch'} | {fileName} | {sectorLabel}</p>
          </div>
          <button type="button" onClick={props.onClose} aria-label="Close import wizard"><X size={18} /></button>
        </header>

        {notice && <div className="industrial-import-notice">{notice}</div>}

        <nav className="industrial-import-steps" aria-label="Import wizard steps">
          {steps.map((item) => (
            <button key={item.id} type="button" className={step === item.id ? 'active' : ''} onClick={() => setStep(item.id)}>
              <span>{item.id}</span>{item.label}
            </button>
          ))}
        </nav>

        <main className="industrial-import-body">
          {step === 1 && (
            <Step title="Step 1" subtitle="Import Mode">
              <ChoiceGrid value={importMode} options={['New Import', 'Update Existing Inventory List']} onChange={(value) => setImportMode(value as ProductImportMode)} />
              <InfoGrid rows={[['Current batch', props.batch?.batchNumber || 'Not created'], ['Operator', props.staffName], ['Mode effect', importMode === 'New Import' ? 'Creates new local product drafts.' : 'Updates matched local inventory records where possible.']]} />
            </Step>
          )}

          {step === 2 && (
            <Step title="Step 2" subtitle="Data Category">
              <ChoiceGrid value={dataCategory} options={['Inventory List', 'Images', 'Vendors', 'Customers']} onChange={(value) => setDataCategory(value as ProductImportDataCategory)} />
              <div className="industrial-import-sector-grid">
                {sectorProfiles.map((profile) => (
                  <button key={profile.label} type="button" className={sectorLabel === profile.label ? 'active' : ''} onClick={() => setSectorLabel(profile.label)}>
                    <strong>{profile.label}</strong>
                    <span>{profile.keywords.slice(0, 4).join(', ')}</span>
                  </button>
                ))}
              </div>
            </Step>
          )}

          {step === 3 && (
            <Step title="Step 3" subtitle="Source File Type">
              <ChoiceGrid value={sourceType} options={['Custom Excel File']} onChange={() => setSourceType('Custom Excel File')} />
              <InfoGrid rows={[['Accepted file types', '.xlsx, .xls, .csv, .tsv, .txt'], ['Source registration', 'Excel uploads are staged locally inside Product Import Desk.'], ['Selected source', sourceType]]} />
            </Step>
          )}

          {step === 4 && (
            <Step title="Step 4" subtitle="Browse And Upload Excel File">
              <div className="industrial-import-file-panel">
                <FileSpreadsheet size={38} />
                <div>
                  <strong>Custom Excel File Upload</strong>
                  <span>Upload the supplier or internal workbook. Text-based sheets load directly for preview. Binary Excel workbooks are registered locally with worksheet metadata for controlled mapping and validation.</span>
                </div>
                <input type="file" accept=".xlsx,.xls,.csv,.tsv,.txt" onChange={(event) => void handleFile(event.target.files?.[0])} />
              </div>
              <InfoGrid rows={[['File name', fileName], ['Detected file type', detectImportFileType(fileName)], ['Preview rows detected', String(parsedRows.length)]]} />
              <div className="industrial-import-actions"><button type="button" onClick={() => void createBatch()}><Upload size={14} /> Create Batch</button></div>
            </Step>
          )}

          {step === 5 && (
            <Step title="Step 5" subtitle="Worksheet And Starting Row">
              <div className="industrial-import-form-grid">
                <label>Worksheet / Tab Name<input value={worksheetName} onChange={(event) => setWorksheetName(event.target.value)} /></label>
                <label>Starting Row Number<input type="number" min={1} value={startRow} onChange={(event) => setStartRow(Math.max(1, Number(event.target.value) || 1))} /></label>
              </div>
              <textarea className="industrial-import-worksheet-input" value={worksheetText} onChange={(event) => setWorksheetText(event.target.value)} />
              <Preview rows={sheetRows.slice(0, 8)} />
              <div className="industrial-import-actions"><button type="button" onClick={() => void parseIntoBatch()}><Database size={14} /> Parse Worksheet</button></div>
            </Step>
          )}

          {step === 6 && (
            <Step title="Step 6" subtitle="Mapping Modal">
              <div className="industrial-import-toolbar">
                <div className="industrial-import-search"><Search size={15} /><input value={fieldSearch} onChange={(event) => setFieldSearch(event.target.value)} placeholder="Search system fields" /></div>
                <button type="button" onClick={autoMap}>Apply Sector Mapping</button>
                <button type="button" onClick={() => void props.onAutoMap(currentBatchId, selectedSector.code)} disabled={!currentBatchId}>Auto Map Batch</button>
                <button type="button" onClick={() => void saveMapping()} disabled={!currentBatchId}>Save Mapping</button>
              </div>
              <div className="industrial-import-mapping-grid">
                <div className="industrial-import-mapping-head">System Inventory Fields</div>
                <div className="industrial-import-mapping-head">Excel Sheet Columns</div>
                {systemFields.map((field) => (
                  <div className="industrial-import-mapping-row" key={field.fieldKey}>
                    <div>
                      <strong>{field.fieldLabel}{field.required ? ' *' : ''}</strong>
                      <span>{field.fieldKey} | {field.targetDomain} | {field.required ? 'Required' : field.fieldType}</span>
                    </div>
                    <SearchableColumnCombo
                      fieldKey={field.fieldKey}
                      value={selectedColumnForField(field.fieldKey)}
                      columns={columns}
                      onChange={(value) => mapFieldToColumn(field.fieldKey, value)}
                    />
                  </div>
                ))}
              </div>
            </Step>
          )}

          {step === 7 && (
            <Step title="Step 7" subtitle="Validation Preview">
              <div className="industrial-import-actions">
                <button type="button" onClick={() => void validateAll()}><CheckCircle2 size={14} /> Run Validation</button>
                <button type="button" disabled={!currentBatchId} onClick={() => void props.onExportErrors(currentBatchId)}>Export Issues</button>
              </div>
              <SummaryCards rows={[
                ['Valid rows', props.preview?.validRows || 0],
                ['Warning rows', props.preview?.warningRows || 0],
                ['Error rows', props.preview?.errorRows || 0],
                ['Duplicate products', validationSummary.duplicateProducts],
                ['Missing SKU / barcode', validationSummary.missingIdentifiers],
                ['Invalid prices', validationSummary.invalidPrices],
                ['Invalid quantities', validationSummary.invalidQuantities],
                ['Missing required mappings', validationSummary.missingMappings]
              ]} />
              <InventoryImportIssueReport
                issues={[...mappingIssues, ...rowIssues]}
                onCreateTask={(issue) => showNotice(`Task logged for ${issue.code}.`)}
                onCreateBIWarning={(issue) => showNotice(`BI warning logged for ${issue.code}.`)}
              />
            </Step>
          )}

          {step === 8 && (
            <Step title="Step 8" subtitle="Start Import Process">
              <SummaryCards rows={[
                ['Progress', `${progress}%`],
                ['Products to create', props.preview?.productsToCreate || 0],
                ['Rows to import', props.preview?.totalRows || props.batch?.totalRows || 0],
                ['Opening balance drafts', props.preview?.openingBalanceDraftsToCreate || 0],
                ['Status', props.batch?.status || 'Draft']
              ]} />
              <div className="industrial-import-progress"><span style={{ width: `${progress}%` }} /></div>
              <div className="industrial-import-actions">
                <button type="button" onClick={() => void processImport()} disabled={processing || !canStartImport}>{processing ? 'Processing...' : 'Start Import Process'}</button>
                <button type="button" onClick={() => void rollbackImport()} disabled={!currentBatchId}><AlertTriangle size={14} /> Rollback</button>
              </div>
              <div className="industrial-import-log-grid">
                <LogPanel title="Import Log" rows={props.activity.map((event) => `${event.createdAt.replace('T', ' ').slice(0, 16)} - ${event.eventType.replace(/_/g, ' ')} - ${event.message}`)} />
                <LogPanel title="Rollback Log" rows={rollbackLog} />
              </div>
            </Step>
          )}
        </main>

        <footer className="industrial-import-footer">
          <button type="button" disabled={step === 1} onClick={() => setStep(Math.max(1, step - 1) as WizardStep)}>Previous</button>
          <button type="button" disabled={step === 8} onClick={() => setStep(Math.min(8, step + 1) as WizardStep)}>Next</button>
        </footer>
      </section>
    </div>
  );
}

function SearchableColumnCombo({
  fieldKey,
  value,
  columns,
  onChange
}: {
  fieldKey: string;
  value: string;
  columns: InventoryImportColumn[];
  onChange: (value: string) => void;
}) {
  const listId = `import-cols-${fieldKey}`;
  return (
    <div className="industrial-import-mapping-combo">
      <input value={value} onChange={(event) => onChange(event.target.value)} list={listId} placeholder="Search or select column" />
      <datalist id={listId}>
        {columns.map((column) => (
          <option key={column.columnIndex} value={column.sourceColumnName}>{column.columnLetter} - {column.sourceColumnName}</option>
        ))}
      </datalist>
    </div>
  );
}

function Step({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return <section className="industrial-import-step"><div className="industrial-import-step-title"><span>{title}</span><h3>{subtitle}</h3></div>{children}</section>;
}

function ChoiceGrid({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  return <div className="industrial-import-choice-grid">{options.map((option) => <button key={option} type="button" className={value === option ? 'active' : ''} onClick={() => onChange(option)}>{option}</button>)}</div>;
}

function InfoGrid({ rows }: { rows: Array<[string, ReactNode]> }) {
  return <div className="industrial-import-info-grid">{rows.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>;
}

function SummaryCards({ rows }: { rows: Array<[string, ReactNode]> }) {
  return <div className="industrial-import-summary-grid">{rows.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>;
}

function Preview({ rows }: { rows: string[][] }) {
  return <div className="industrial-import-preview"><table><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>)}</tr>)}</tbody></table></div>;
}

function LogPanel({ title, rows }: { title: string; rows: string[] }) {
  return <section className="industrial-import-log-panel"><h4>{title}</h4>{rows.length ? rows.slice(0, 12).map((row, index) => <p key={`${row}-${index}`}>{row}</p>) : <p>No log entries yet.</p>}</section>;
}
